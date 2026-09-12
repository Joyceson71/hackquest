import { DynamoDBClient, QueryCommand, UpdateItemCommand, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

function mapActionItem(item: any) {
  const corrections = item.corrections?.L?.map((c: any) => {
    const m = c.M;
    return {
      field: m?.field?.S || '',
      originalValue: m?.originalValue?.S || '',
      correctedValue: m?.correctedValue?.S || '',
      correctedBy: m?.correctedBy?.S || '',
      correctedAt: m?.correctedAt?.S || '',
      source: m?.source?.S || 'REVIEW',
    };
  }) || [];

  const timeline = item.timeline?.L?.map((t: any) => {
    const m = t.M;
    return {
      event: m?.event?.S || '',
      actor: m?.actor?.S || '',
      timestamp: m?.timestamp?.S || '',
      note: m?.note?.S || '',
    };
  }) || [];

  const ownershipHistory = item.ownershipHistory?.L?.map((e: any) => {
    const m = e.M;
    return {
      fromOwner: m?.fromOwner?.S || null,
      toOwner: m?.toOwner?.S || '',
      changedBy: m?.changedBy?.S || '',
      changedAt: m?.changedAt?.S || '',
      reason: m?.reason?.S || 'INITIAL',
      escalationEventId: m?.escalationEventId?.S || null,
    };
  }) || [];

  const missedDeadlines = item.missedDeadlines?.L?.map((e: any) => {
    const m = e.M;
    return {
      deadline: m?.deadline?.S || '',
      detectedAt: m?.detectedAt?.S || '',
      ownerAtTime: m?.ownerAtTime?.S || '',
      reason: m?.reason?.S || 'INACTIVITY',
      gracePeriodHours: parseInt(m?.gracePeriodHours?.N || '24', 10),
    };
  }) || [];

  const replacementRankingSnapshot = item.replacementRankingSnapshot?.L?.map((e: any) => {
    const m = e.M;
    return {
      name: m?.name?.S || '',
      openActionCount: parseInt(m?.openActionCount?.N || '0', 10),
      rank: parseInt(m?.rank?.N || '0', 10),
    };
  }) || [];

  return {
    actionId: item.actionId?.S || '',
    sourceProposedItemId: item.sourceProposedItemId?.S || null,
    task: item.task?.S || '',
    // Immutable original fields
    originalOwner: item.originalOwner?.S || null,
    originalDeadline: item.originalDeadline?.S || null,
    // Mutable current fields
    currentOwner: item.currentOwner?.S || item.owner?.S || null,
    owner: item.currentOwner?.S || item.owner?.S || null, // backward compat
    deadline: item.deadline?.S || null,
    // Evidence — immutable
    evidenceLineStart: parseInt(item.evidenceLineStart?.N || '0', 10),
    evidenceLineEnd: parseInt(item.evidenceLineEnd?.N || '0', 10),
    evidenceTimestamp: item.evidenceTimestamp?.S || null,
    speakerContext: item.speakerContext?.S || null,
    resolvedFromRelative: item.resolvedFromRelative?.S || null,
    // Status
    status: item.status?.S || 'PENDING',
    // Escalation
    escalationStatus: item.escalationStatus?.S || 'NONE',
    escalationTriggeredAt: item.escalationTriggeredAt?.S || null,
    escalationReason: item.escalationReason?.S || null,
    suggestedReplacementOwner: item.suggestedReplacementOwner?.S || null,
    replacementRankingSnapshot,
    replacementConfirmedBy: item.replacementConfirmedBy?.S || null,
    replacementConfirmedAt: item.replacementConfirmedAt?.S || null,
    // History
    corrections,
    missedDeadlines,
    ownershipHistory,
    timeline,
    // Metadata
    confirmedBy: item.confirmedBy?.S || null,
    confirmedAt: item.confirmedAt?.S || null,
    completedAt: item.completedAt?.S || null,
  };
}

export const handleActions = async (event: any) => {
  const method = event.httpMethod;
  const meetingId = event.pathParameters?.id;
  const actionId = event.pathParameters?.actionId;
  const subPath = event.pathParameters?.subPath; // "escalation/accept" or "escalation/decline"
  const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';
  const userName = event.requestContext?.authorizer?.claims?.name
    || event.requestContext?.authorizer?.claims?.email
    || userId;

  if (!meetingId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing meeting ID' }) };
  }

  // GET /meetings/:id/confirmed-actions
  if (method === 'GET' && !actionId) {
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': { S: meetingId },
        ':skPrefix': { S: 'ACTION#' },
      },
    }));

    const items = (Items || []).map(mapActionItem);
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(items) };
  }

  // POST /meetings/:id/confirmed-actions/:actionId/escalation/accept
  if (method === 'POST' && actionId && event.path?.endsWith('/accept')) {
    return await handleEscalationAccept(meetingId, actionId, userId, userName, event);
  }

  // POST /meetings/:id/confirmed-actions/:actionId/escalation/decline
  if (method === 'POST' && actionId && event.path?.endsWith('/decline')) {
    return await handleEscalationDecline(meetingId, actionId, userId, userName);
  }

  // PUT /meetings/:id/confirmed-actions/:actionId — update status
  if (method === 'PUT' && actionId) {
    const body = JSON.parse(event.body || '{}');
    const newStatus = body.status;
    const now = new Date().toISOString();

    if (!['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(newStatus)) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Invalid status' }) };
    }

    const updateExpr = newStatus === 'DONE' || newStatus === 'CANCELLED'
      ? 'SET #s = :s, completedAt = :ca, #tl = list_append(if_not_exists(#tl, :empty_list), :new_event)'
      : 'SET #s = :s, #tl = list_append(if_not_exists(#tl, :empty_list), :new_event)';

    const timelineEvent = {
      M: {
        event: { S: `Status changed to ${newStatus}` },
        actor: { S: userName },
        timestamp: { S: now },
        note: { S: '' }
      }
    };

    const exprVals: any = {
      ':s': { S: newStatus },
      ':empty_list': { L: [] },
      ':new_event': { L: [timelineEvent] }
    };
    if (newStatus === 'DONE' || newStatus === 'CANCELLED') {
      exprVals[':ca'] = { S: now };
    }

    await docClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: { '#s': 'status', '#tl': 'timeline' },
      ExpressionAttributeValues: exprVals,
    }));

    const auditEventId = uuidv4();
    await docClient.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: meetingId },
        SK: { S: `AUDIT#${now}#${auditEventId}` },
        eventType: { S: newStatus === 'CANCELLED' ? 'ACTION_CANCELLED' : 'ACTION_STATUS_CHANGED' },
        actorId: { S: userId },
        actionId: { S: actionId },
        timestamp: { S: now },
        before: { M: { actionId: { S: actionId } } },
        after: { M: { status: { S: newStatus } } },
        metadata: { M: {} },
      }
    }));

    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true }) };
  }

  // DELETE /meetings/:id/confirmed-actions/:actionId
  if (method === 'DELETE' && actionId) {
    await docClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
      UpdateExpression: 'SET #s = :s, completedAt = :ca',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':s': { S: 'CANCELLED' },
        ':ca': { S: new Date().toISOString() },
      },
    }));

    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Invalid request' }) };
};

async function handleEscalationAccept(meetingId: string, actionId: string, userId: string, userName: string, event: any) {
  const body = JSON.parse(event.body || '{}');
  const newDeadline = body.newDeadline;
  const now = new Date().toISOString();

  if (!newDeadline) {
    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'newDeadline is required to accept escalation' }) };
  }

  // Validate ISO date
  const parsedDate = new Date(newDeadline);
  if (isNaN(parsedDate.getTime())) {
    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'newDeadline must be a valid ISO 8601 date' }) };
  }

  // Fetch current action to get current state
  const { Item: actionItem } = await docClient.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
  }));

  if (!actionItem) {
    return { statusCode: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Action not found' }) };
  }

  const prevOwner = actionItem.currentOwner?.S || actionItem.owner?.S || null;
  const escalationEventId = uuidv4();

  const ownershipEvent = {
    M: {
      fromOwner: prevOwner ? { S: prevOwner } : { NULL: true },
      toOwner: { S: userName },
      changedBy: { S: userId },
      changedAt: { S: now },
      reason: { S: 'ESCALATION_ACCEPTED' },
      escalationEventId: { S: escalationEventId },
    }
  };

  const deadlineCorrection = {
    M: {
      field: { S: 'deadline' },
      originalValue: { S: actionItem.deadline?.S || '' },
      correctedValue: { S: newDeadline },
      correctedBy: { S: userId },
      correctedAt: { S: now },
      source: { S: 'ESCALATION_ACCEPTANCE' },
    }
  };

  const ownerCorrection = {
    M: {
      field: { S: 'owner' },
      originalValue: { S: prevOwner || '' },
      correctedValue: { S: userName },
      correctedBy: { S: userId },
      correctedAt: { S: now },
      source: { S: 'ESCALATION_ACCEPTANCE' },
    }
  };

  const timelineEvent = {
    M: {
      event: { S: `Escalation accepted by ${userName}. New deadline: ${newDeadline}` },
      actor: { S: userName },
      timestamp: { S: now },
      note: { S: '' },
    }
  };

  await docClient.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
    UpdateExpression: `SET currentOwner = :co, #owner = :co, deadline = :dl, escalationStatus = :es,
      replacementConfirmedBy = :rcb, replacementConfirmedAt = :rca, #s = :s,
      ownershipHistory = list_append(if_not_exists(ownershipHistory, :empty), :ohe),
      corrections = list_append(if_not_exists(corrections, :empty), :corr),
      #tl = list_append(if_not_exists(#tl, :empty), :te)`,
    ExpressionAttributeNames: { '#s': 'status', '#tl': 'timeline', '#owner': 'owner' },
    ExpressionAttributeValues: {
      ':co': { S: userName },
      ':dl': { S: newDeadline },
      ':es': { S: 'RESOLVED' },
      ':rcb': { S: userId },
      ':rca': { S: now },
      ':s': { S: 'PENDING' },
      ':empty': { L: [] },
      ':ohe': { L: [ownershipEvent] },
      ':corr': { L: [ownerCorrection, deadlineCorrection] },
      ':te': { L: [timelineEvent] },
    },
  }));

  // Write AuditLog
  const auditId = uuidv4();
  await docClient.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: { S: meetingId },
      SK: { S: `AUDIT#${now}#${auditId}` },
      eventType: { S: 'ESCALATION_ACCEPTED' },
      actorId: { S: userId },
      actionId: { S: actionId },
      timestamp: { S: now },
      before: { M: { owner: prevOwner ? { S: prevOwner } : { NULL: true } } },
      after: { M: { owner: { S: userName }, deadline: { S: newDeadline }, escalationStatus: { S: 'RESOLVED' } } },
      metadata: { M: { escalationEventId: { S: escalationEventId } } },
    }
  }));

  return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true }) };
}

async function handleEscalationDecline(meetingId: string, actionId: string, userId: string, userName: string) {
  const now = new Date().toISOString();

  const timelineEvent = {
    M: {
      event: { S: `Escalation declined by ${userName}. Organizer must manually reassign.` },
      actor: { S: userName },
      timestamp: { S: now },
      note: { S: '' },
    }
  };

  await docClient.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
    UpdateExpression: 'SET escalationStatus = :es, #tl = list_append(if_not_exists(#tl, :empty), :te)',
    ExpressionAttributeNames: { '#tl': 'timeline' },
    ExpressionAttributeValues: {
      ':es': { S: 'DECLINED' },
      ':empty': { L: [] },
      ':te': { L: [timelineEvent] },
    },
  }));

  const auditId = uuidv4();
  await docClient.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: { S: meetingId },
      SK: { S: `AUDIT#${now}#${auditId}` },
      eventType: { S: 'ESCALATION_DECLINED' },
      actorId: { S: userId },
      actionId: { S: actionId },
      timestamp: { S: now },
      before: { M: { escalationStatus: { S: 'PENDING_ACCEPTANCE' } } },
      after: { M: { escalationStatus: { S: 'DECLINED' } } },
      metadata: { M: {} },
    }
  }));

  return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: true }) };
}
