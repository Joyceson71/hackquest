import { DynamoDBClient, QueryCommand, UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handleActions = async (event: any) => {
  const method = event.httpMethod;
  const meetingId = event.pathParameters?.id;
  const actionId = event.pathParameters?.actionId;
  const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';

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

    const items = (Items || []).map((item) => {
      // Map DynamoDB list of maps to plain array of objects for corrections
      const corrections = item.corrections?.L?.map(c => {
        const m = c.M;
        return {
          field: m?.field?.S || '',
          originalValue: m?.originalValue?.S || '',
          correctedValue: m?.correctedValue?.S || '',
          correctedBy: m?.correctedBy?.S || '',
          correctedAt: m?.correctedAt?.S || '',
        };
      }) || [];

      const timeline = item.timeline?.L?.map(t => {
        const m = t.M;
        return {
          event: m?.event?.S || '',
          actor: m?.actor?.S || '',
          timestamp: m?.timestamp?.S || '',
          note: m?.note?.S || '',
        };
      }) || [];

      return {
        actionId: item.actionId.S,
        sourceProposedItemId: item.sourceProposedItemId?.S,
        task: item.task?.S,
        owner: item.owner?.S || null,
        deadline: item.deadline?.S || null,
        status: item.status?.S,
        evidenceLineStart: parseInt(item.evidenceLineStart?.N || '0', 10),
        evidenceLineEnd: parseInt(item.evidenceLineEnd?.N || '0', 10),
        confirmedBy: item.confirmedBy?.S,
        confirmedAt: item.confirmedAt?.S,
        completedAt: item.completedAt?.S || null,
        corrections,
        timeline,
      };
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(items),
    };
  }

  // PUT /meetings/:id/confirmed-actions/:actionId
  if (method === 'PUT' && actionId) {
    const body = JSON.parse(event.body || '{}');
    const newStatus = body.status;
    const now = new Date().toISOString();

    if (!['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(newStatus)) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Invalid status' }) };
    }

    // 1. Update ConfirmedAction status and append to timeline
    const updateExpr = newStatus === 'DONE' || newStatus === 'CANCELLED'
      ? 'SET #s = :s, completedAt = :ca, #tl = list_append(if_not_exists(#tl, :empty_list), :new_event)'
      : 'SET #s = :s, #tl = list_append(if_not_exists(#tl, :empty_list), :new_event)';
    
    const timelineEvent = {
      M: {
        event: { S: `Status changed to ${newStatus}` },
        actor: { S: userId },
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

    // 2. Write AuditLog
    const auditEventId = uuidv4();
    await docClient.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: meetingId },
        SK: { S: `AUDIT#${now}#${auditEventId}` },
        eventType: { S: newStatus === 'CANCELLED' ? 'ACTION_CANCELLED' : 'ACTION_STATUS_CHANGED' },
        actorId: { S: userId },
        timestamp: { S: now },
        before: { M: { actionId: { S: actionId } } },
        after: { M: { status: { S: newStatus } } },
      }
    }));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true }),
    };
  }

  return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Invalid request' }) };
};
