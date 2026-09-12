import { DynamoDBClient, QueryCommand, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handleProposed = async (event: any) => {
  const method = event.httpMethod;
  const meetingId = event.pathParameters?.id;
  const itemId = event.pathParameters?.itemId;
  const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';
  const userEmail = event.requestContext?.authorizer?.claims?.email || '';
  const userName = event.requestContext?.authorizer?.claims?.name || userEmail || userId;

  if (!meetingId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing meeting ID' }) };
  }

  // GET /meetings/:id/proposed-items
  if (method === 'GET' && !itemId) {
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': { S: meetingId },
        ':skPrefix': { S: 'PROPOSED#' },
      },
    }));

    const items = (Items || []).map((item) => ({
      itemId: item.itemId?.S,
      type: item.type?.S,
      rawText: item.rawText?.S,
      suggestedOwner: item.suggestedOwner?.S || null,
      suggestedDeadline: item.suggestedDeadline?.S || null,
      resolvedFromRelative: item.resolvedFromRelative?.S || null,
      confidenceScore: parseInt(item.confidenceScore?.N || '0', 10),
      confidenceReason: item.confidenceReason?.S || '',
      evidenceLineStart: parseInt(item.evidenceLineStart?.N || '0', 10),
      evidenceLineEnd: parseInt(item.evidenceLineEnd?.N || '0', 10),
      evidenceTimestamp: item.evidenceTimestamp?.S || null,
      speakerContext: item.speakerContext?.S || null,
      reviewStatus: item.reviewStatus?.S || 'PENDING',
      reviewedBy: item.reviewedBy?.S || null,
      reviewedAt: item.reviewedAt?.S || null,
      rejectionNote: item.rejectionNote?.S || null,
    }));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(items),
    };
  }

  // PUT /meetings/:id/proposed-items/:itemId (Confirm, Reject, Edit)
  if (method === 'PUT' && itemId) {
    const body = JSON.parse(event.body || '{}');
    const action = body.action; // 'CONFIRM' or 'REJECT'
    const now = new Date().toISOString();

    // Fetch the proposed item
    const { Item: proposedItem } = await docClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
    }));

    if (!proposedItem) {
      return { statusCode: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Proposed item not found' }) };
    }

    if (action === 'CONFIRM') {
      const actionId = uuidv4();

      // Determine final values (edit-and-confirm uses body values, plain confirm uses extracted values)
      const finalTask = (body.task || proposedItem.rawText?.S || '').substring(0, 1000).trim();
      const finalOwner = (body.owner || proposedItem.suggestedOwner?.S || '').substring(0, 100).trim() || null;
      const finalDeadline = body.deadline || proposedItem.suggestedDeadline?.S || null;

      // originalOwner and originalDeadline ALWAYS come from the extraction — immutable after this point
      const originalOwner = (proposedItem.suggestedOwner?.S || null);
      const originalDeadline = (proposedItem.suggestedDeadline?.S || null);

      // Determine if modifications were made vs extraction
      const isModified =
        finalTask !== proposedItem.rawText?.S ||
        finalOwner !== originalOwner ||
        finalDeadline !== originalDeadline;

      // Build corrections array
      const corrections: any[] = [];
      if (finalTask !== proposedItem.rawText?.S && proposedItem.rawText?.S) {
        corrections.push({ M: { field: { S: 'task' }, originalValue: { S: proposedItem.rawText.S }, correctedValue: { S: finalTask }, correctedBy: { S: userId }, correctedAt: { S: now }, source: { S: 'REVIEW' } } });
      }
      if (finalOwner !== originalOwner) {
        corrections.push({ M: { field: { S: 'owner' }, originalValue: { S: originalOwner || '' }, correctedValue: { S: finalOwner || '' }, correctedBy: { S: userId }, correctedAt: { S: now }, source: { S: 'REVIEW' } } });
      }
      if (finalDeadline !== originalDeadline) {
        corrections.push({ M: { field: { S: 'deadline' }, originalValue: { S: originalDeadline || '' }, correctedValue: { S: finalDeadline || '' }, correctedBy: { S: userId }, correctedAt: { S: now }, source: { S: 'REVIEW' } } });
      }

      // Initial ownership event
      const initialOwnershipEvent = {
        M: {
          fromOwner: { NULL: true },
          toOwner: { S: finalOwner || 'Unassigned' },
          changedBy: { S: userId },
          changedAt: { S: now },
          reason: { S: 'INITIAL' },
        }
      };

      const initialTimelineEvent = {
        M: {
          event: { S: 'Action confirmed from transcript extraction' },
          actor: { S: userName },
          timestamp: { S: now },
          note: { S: isModified ? 'Confirmed with modifications' : '' },
        }
      };

      // Build DynamoDB item — store ALL spec-required fields
      const actionItem: Record<string, any> = {
        PK: { S: meetingId },
        SK: { S: `ACTION#${actionId}` },
        actionId: { S: actionId },
        sourceProposedItemId: { S: itemId },
        // Task
        task: { S: finalTask },
        // Owner fields — immutable originals + mutable current
        originalOwner: originalOwner ? { S: originalOwner } : { NULL: true },
        currentOwner: finalOwner ? { S: finalOwner } : { NULL: true },
        owner: finalOwner ? { S: finalOwner } : { NULL: true }, // backward compat
        // Deadline fields — immutable originals + mutable current
        originalDeadline: originalDeadline ? { S: originalDeadline } : { NULL: true },
        deadline: finalDeadline ? { S: finalDeadline } : { NULL: true },
        // Evidence fields — immutable
        evidenceLineStart: proposedItem.evidenceLineStart || { N: '0' },
        evidenceLineEnd: proposedItem.evidenceLineEnd || { N: '0' },
        evidenceTimestamp: proposedItem.evidenceTimestamp || { NULL: true },
        speakerContext: proposedItem.speakerContext || { NULL: true },
        resolvedFromRelative: proposedItem.resolvedFromRelative || { NULL: true },
        // Status
        status: { S: 'PENDING' },
        // Escalation fields — all start as NONE/null
        escalationStatus: { S: 'NONE' },
        escalationTriggeredAt: { NULL: true },
        escalationReason: { NULL: true },
        suggestedReplacementOwner: { NULL: true },
        replacementRankingSnapshot: { L: [] },
        replacementConfirmedBy: { NULL: true },
        replacementConfirmedAt: { NULL: true },
        // History — all append-only arrays
        corrections: { L: corrections },
        missedDeadlines: { L: [] },
        ownershipHistory: { L: [initialOwnershipEvent] },
        timeline: { L: [initialTimelineEvent] },
        // Metadata
        confirmedBy: { S: userId },
        confirmedAt: { S: now },
        completedAt: { NULL: true },
      };

      // 1. Create ConfirmedAction
      await docClient.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: actionItem,
      }));

      // 2. Update ProposedItem status
      await docClient.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
        UpdateExpression: 'SET reviewStatus = :rs, reviewedBy = :rb, reviewedAt = :ra',
        ExpressionAttributeValues: {
          ':rs': { S: isModified ? 'MODIFIED' : 'CONFIRMED' },
          ':rb': { S: userId },
          ':ra': { S: now },
        }
      }));

      // 3. Write AuditLog
      const auditEventId = uuidv4();
      await docClient.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: { S: meetingId },
          SK: { S: `AUDIT#${now}#${auditEventId}` },
          eventType: { S: isModified ? 'ITEM_MODIFIED' : 'ITEM_CONFIRMED' },
          actorId: { S: userId },
          actionId: { S: actionId },
          timestamp: { S: now },
          before: { M: { itemId: { S: itemId }, rawText: { S: proposedItem.rawText?.S || '' } } },
          after: { M: { actionId: { S: actionId }, task: { S: finalTask }, owner: finalOwner ? { S: finalOwner } : { NULL: true } } },
          metadata: { M: { isModified: { BOOL: isModified }, corrections: { N: String(corrections.length) } } },
        }
      }));

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, actionId }),
      };

    } else if (action === 'REJECT') {
      const rejectionNote = (body.rejectionNote || '').substring(0, 200).trim();

      await docClient.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
        UpdateExpression: 'SET reviewStatus = :rs, reviewedBy = :rb, reviewedAt = :ra, rejectionNote = :rn',
        ExpressionAttributeValues: {
          ':rs': { S: 'REJECTED' },
          ':rb': { S: userId },
          ':ra': { S: now },
          ':rn': rejectionNote ? { S: rejectionNote } : { NULL: true },
        }
      }));

      const auditEventId = uuidv4();
      await docClient.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: { S: meetingId },
          SK: { S: `AUDIT#${now}#${auditEventId}` },
          eventType: { S: 'ITEM_REJECTED' },
          actorId: { S: userId },
          timestamp: { S: now },
          before: { M: { itemId: { S: itemId } } },
          after: { M: { status: { S: 'REJECTED' }, rejectionNote: rejectionNote ? { S: rejectionNote } : { NULL: true } } },
          metadata: { M: {} },
        }
      }));

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true }),
      };
    }

    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Invalid action. Use CONFIRM or REJECT.' }) };
  }

  return {
    statusCode: 405,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'Method Not Allowed' }),
  };
};
