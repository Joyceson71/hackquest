import { DynamoDBClient, QueryCommand, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handleProposed = async (event: any) => {
  const method = event.httpMethod;
  const meetingId = event.pathParameters?.id;
  const itemId = event.pathParameters?.itemId;
  const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';

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
      itemId: item.itemId.S,
      type: item.type?.S,
      rawText: item.rawText?.S,
      suggestedOwner: item.suggestedOwner?.S || null,
      suggestedDeadline: item.suggestedDeadline?.S || null,
      confidenceScore: parseInt(item.confidenceScore?.N || '0', 10),
      confidenceReason: item.confidenceReason?.S,
      evidenceLineStart: parseInt(item.evidenceLineStart?.N || '0', 10),
      evidenceLineEnd: parseInt(item.evidenceLineEnd?.N || '0', 10),
      reviewStatus: item.reviewStatus?.S,
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
      Key: {
        PK: { S: meetingId },
        SK: { S: `PROPOSED#${itemId}` },
      }
    }));

    if (!proposedItem) {
      return { statusCode: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Proposed item not found' }) };
    }

    if (action === 'CONFIRM') {
      const actionId = uuidv4();
      
      // Determine if modifications were made
      const isModified = 
        body.task !== proposedItem.rawText?.S ||
        body.owner !== (proposedItem.suggestedOwner?.S || '') ||
        body.deadline !== (proposedItem.suggestedDeadline?.S || '');

      const corrections = [];
      if (isModified) {
        if (body.task !== proposedItem.rawText?.S) {
          corrections.push({ M: { field: { S: 'task' }, originalValue: { S: proposedItem.rawText?.S || '' }, correctedValue: { S: body.task }, correctedBy: { S: userId }, correctedAt: { S: now } }});
        }
        if (body.owner !== (proposedItem.suggestedOwner?.S || '')) {
          corrections.push({ M: { field: { S: 'owner' }, originalValue: { S: proposedItem.suggestedOwner?.S || '' }, correctedValue: { S: body.owner }, correctedBy: { S: userId }, correctedAt: { S: now } }});
        }
        if (body.deadline !== (proposedItem.suggestedDeadline?.S || '')) {
          corrections.push({ M: { field: { S: 'deadline' }, originalValue: { S: proposedItem.suggestedDeadline?.S || '' }, correctedValue: { S: body.deadline }, correctedBy: { S: userId }, correctedAt: { S: now } }});
        }
      }

      const initialTimelineEvent = {
        M: {
          event: { S: 'Action confirmed' },
          actor: { S: userId },
          timestamp: { S: now },
          note: { S: '' }
        }
      };

      // 1. Create ConfirmedAction
      await docClient.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: { S: meetingId },
          SK: { S: `ACTION#${actionId}` },
          actionId: { S: actionId },
          sourceProposedItemId: { S: itemId },
          task: { S: body.task },
          owner: body.owner ? { S: body.owner } : { NULL: true },
          deadline: body.deadline ? { S: body.deadline } : { NULL: true },
          status: { S: 'PENDING' }, // newly confirmed actions start as pending
          evidenceLineStart: proposedItem.evidenceLineStart,
          evidenceLineEnd: proposedItem.evidenceLineEnd,
          confirmedBy: { S: userId },
          confirmedAt: { S: now },
          corrections: { L: corrections },
          timeline: { L: [initialTimelineEvent] },
        }
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
          timestamp: { S: now },
          before: { M: { itemId: { S: itemId } } }, // simplified
          after: { M: { actionId: { S: actionId } } },
        }
      }));

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, actionId }),
      };
    } else if (action === 'REJECT') {
      // 1. Update ProposedItem status
      await docClient.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
        UpdateExpression: 'SET reviewStatus = :rs, reviewedBy = :rb, reviewedAt = :ra, rejectionNote = :rn',
        ExpressionAttributeValues: {
          ':rs': { S: 'REJECTED' },
          ':rb': { S: userId },
          ':ra': { S: now },
          ':rn': body.rejectionNote ? { S: body.rejectionNote } : { NULL: true },
        }
      }));

      // 2. Write AuditLog
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
          after: { M: { status: { S: 'REJECTED' } } },
        }
      }));

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true }),
      };
    }

    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Invalid action' }) };
  }

  return {
    statusCode: 405,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'Method Not Allowed' }),
  };
};
