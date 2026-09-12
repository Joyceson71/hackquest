/**
 * fn-escalation-checker
 * Triggered every hour by EventBridge Scheduler.
 * Scans all meetings for ConfirmedActions that have passed their deadline + grace period
 * and fires the escalation flow for each matching action.
 */

import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { detectInactivityEscalations, parseParticipants } from './detector';
import { rankReplacementCandidates } from './ranker';
import { writeEscalation } from './writer';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  console.log('[escalation-checker] Starting hourly escalation scan', JSON.stringify(event));

  try {
    // 1. Fetch all meetings (scan for MEETING SK records)
    // In production with large tables, use a GSI. For MVP, scan is acceptable.
    const { Items: meetingItems } = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk AND (attribute_not_exists(#del) OR #del = :false)',
      ExpressionAttributeNames: { '#del': 'deleted' },
      ExpressionAttributeValues: {
        ':sk': { S: 'MEETING' },
        ':false': { BOOL: false },
      },
    }));

    let totalEscalated = 0;

    for (const meeting of (meetingItems || [])) {
      const meetingId = meeting.PK?.S;
      if (!meetingId) continue;

      const participantsStr = meeting.participants?.S || '';
      const gracePeriodHours = parseInt(meeting.gracePeriodHours?.N || '24', 10);
      const participants = parseParticipants(participantsStr);

      // 2. Detect which actions need escalation for this meeting
      const candidates = await detectInactivityEscalations(meetingId, gracePeriodHours, participants);

      if (candidates.length === 0) continue;

      console.log(`[escalation-checker] Meeting ${meetingId}: ${candidates.length} action(s) to escalate`);

      const availableParticipantNames = participants
        .filter(p => p.isAvailable)
        .map(p => p.name);

      // 3. For each candidate, rank replacements and write escalation
      for (const candidate of candidates) {
        try {
          const replacementCandidates = await rankReplacementCandidates(
            meetingId,
            candidate.currentOwner,
            availableParticipantNames
          );

          await writeEscalation(candidate, replacementCandidates);
          totalEscalated++;

          console.log(`[escalation-checker] Escalated action ${candidate.actionId} in meeting ${meetingId}. Suggested: ${replacementCandidates[0]?.name || 'none'}`);
        } catch (err) {
          console.error(`[escalation-checker] Failed to escalate action ${candidate.actionId}:`, err);
          // Continue processing other actions — don't let one failure block the rest
        }
      }
    }

    console.log(`[escalation-checker] Scan complete. Total escalated: ${totalEscalated}`);
    return { statusCode: 200, body: JSON.stringify({ escalated: totalEscalated }) };

  } catch (error: any) {
    console.error('[escalation-checker] Fatal error:', error);
    throw error; // Re-throw so EventBridge can retry
  }
};
