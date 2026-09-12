import { DynamoDBClient, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { parseParticipants } from '../escalation-checker/detector';
import { rankReplacementCandidates } from '../escalation-checker/ranker';
import { writeEscalation } from '../escalation-checker/writer';
import type { EscalationCandidate } from '../escalation-checker/detector';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handleParticipants = async (event: any) => {
  const method = event.httpMethod;
  const meetingId = event.pathParameters?.id;
  const path = event.path || '';

  if (!meetingId) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing meeting ID' }),
    };
  }

  // POST /meetings/:id/participants/unavailable
  // Immediately escalates ALL open actions owned by the named participant.
  // If an action also has a passed deadline, the reason is recorded as BOTH.
  if (method === 'POST' && path.endsWith('/unavailable')) {
    const body = JSON.parse(event.body || '{}');
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Participant name is required' }),
      };
    }

    const cleanName = name.trim();

    // 1. Fetch meeting for grace period and participant list
    const { Item: meeting } = await docClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: meetingId }, SK: { S: 'MEETING' } },
    }));

    if (!meeting) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Meeting not found' }),
      };
    }

    const participantsStr = meeting.participants?.S || '';
    const gracePeriodHours = parseInt(meeting.gracePeriodHours?.N || '24', 10);
    const allParticipants = parseParticipants(participantsStr);

    // Verify participant exists in meeting directory
    const found = allParticipants.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
    if (!found) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: `Participant "${cleanName}" not found in this meeting's participant directory` }),
      };
    }

    // 2. Fetch all PENDING/IN_PROGRESS actions owned by this participant
    //    (escalationStatus must be NONE — don't double-escalate)
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: '#s IN (:p, :ip) AND escalationStatus = :none',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':pk': { S: meetingId },
        ':prefix': { S: 'ACTION#' },
        ':p': { S: 'PENDING' },
        ':ip': { S: 'IN_PROGRESS' },
        ':none': { S: 'NONE' },
      },
    }));

    // Filter to actions owned by the unavailable participant
    const now = new Date();
    const ownedActions = (Items || []).filter(item => {
      const owner = item.currentOwner?.S || item.owner?.S || '';
      return owner.toLowerCase() === cleanName.toLowerCase();
    });

    if (ownedActions.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, escalatedActions: 0, message: 'No open non-escalated actions found for this participant.' }),
      };
    }

    // 3. Build escalation candidates, assigning the correct reason
    const candidates: EscalationCandidate[] = ownedActions.map(item => {
      const deadline = item.deadline?.S || null;
      let deadlinePassed = false;
      if (deadline) {
        const deadlineDate = new Date(deadline);
        const cutoff = new Date(deadlineDate.getTime() + gracePeriodHours * 60 * 60 * 1000);
        deadlinePassed = now > cutoff;
      }

      // Combined: deadline also passed → BOTH
      const escalationReason = deadlinePassed ? 'BOTH' : 'OWNER_UNAVAILABLE';

      return {
        actionId: item.actionId?.S || '',
        meetingId,
        task: item.task?.S || '',
        currentOwner: item.currentOwner?.S || item.owner?.S || null,
        deadline,
        escalationReason,
        gracePeriodHours,
      };
    });

    // 4. Rank available replacement candidates (exclude the unavailable participant)
    const availableNames = allParticipants
      .filter(p => p.name.toLowerCase() !== cleanName.toLowerCase())
      .map(p => p.name);

    // 5. Write escalation for each action
    let escalatedCount = 0;
    const errors: string[] = [];

    for (const candidate of candidates) {
      try {
        const replacements = await rankReplacementCandidates(meetingId, candidate.currentOwner, availableNames);
        await writeEscalation(candidate, replacements);
        escalatedCount++;
      } catch (err: any) {
        // ConditionalCheckFailedException = already escalated — skip silently
        if (err?.name !== 'ConditionalCheckFailedException') {
          errors.push(`Action ${candidate.actionId}: ${err.message}`);
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        escalatedActions: escalatedCount,
        errors: errors.length ? errors : undefined,
      }),
    };
  }

  return {
    statusCode: 405,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
