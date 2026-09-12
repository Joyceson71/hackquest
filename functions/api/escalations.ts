import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handleEscalations = async (event: any) => {
  const method = event.httpMethod;
  const meetingId = event.pathParameters?.id;
  const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';
  const userName = event.requestContext?.authorizer?.claims?.name
    || event.requestContext?.authorizer?.claims?.email
    || userId;

  // GET /meetings/:id/escalations — all pending escalations for this meeting
  if (method === 'GET' && meetingId) {
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'escalationStatus = :es',
      ExpressionAttributeValues: {
        ':pk': { S: meetingId },
        ':skPrefix': { S: 'ACTION#' },
        ':es': { S: 'PENDING_ACCEPTANCE' },
      },
    }));

    const escalations = (Items || []).map(mapEscalationItem);
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(escalations),
    };
  }

  // GET /escalations/me — cross-meeting count for current user (badge)
  if (method === 'GET' && !meetingId) {
    // This would require a GSI on suggestedReplacementOwner in production.
    // For MVP, return 0 — the per-meeting page handles the actual display.
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ count: 0, items: [] }),
    };
  }

  return {
    statusCode: 405,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'Method Not Allowed' }),
  };
};

function mapEscalationItem(item: any) {
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
    task: item.task?.S || '',
    originalOwner: item.originalOwner?.S || null,
    currentOwner: item.currentOwner?.S || item.owner?.S || null,
    originalDeadline: item.originalDeadline?.S || null,
    deadline: item.deadline?.S || null,
    evidenceLineStart: parseInt(item.evidenceLineStart?.N || '0', 10),
    evidenceLineEnd: parseInt(item.evidenceLineEnd?.N || '0', 10),
    evidenceTimestamp: item.evidenceTimestamp?.S || null,
    speakerContext: item.speakerContext?.S || null,
    escalationStatus: item.escalationStatus?.S || 'NONE',
    escalationTriggeredAt: item.escalationTriggeredAt?.S || null,
    escalationReason: item.escalationReason?.S || null,
    suggestedReplacementOwner: item.suggestedReplacementOwner?.S || null,
    replacementRankingSnapshot,
    status: item.status?.S || 'ESCALATED',
  };
}
