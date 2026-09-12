import { DynamoDBClient, UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { EscalationCandidate } from './detector';
import { ReplacementCandidate } from './ranker';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * Writes all DynamoDB updates for a triggered escalation atomically in sequence.
 * Per the spec, all of these are written:
 * 1. MissedDeadline entry appended to missedDeadlines[]
 * 2. escalationStatus = TRIGGERED → PENDING_ACCEPTANCE
 * 3. replacementRankingSnapshot stored
 * 4. suggestedReplacementOwner set
 * 5. AuditLog: ESCALATION_TRIGGERED written
 */
export async function writeEscalation(
  candidate: EscalationCandidate,
  replacementCandidates: ReplacementCandidate[]
): Promise<void> {
  const now = new Date().toISOString();
  const suggestedReplacement = replacementCandidates[0] || null;

  // Build MissedDeadline entry
  const missedDeadlineEntry = {
    M: {
      deadline: candidate.deadline ? { S: candidate.deadline } : { NULL: true },
      detectedAt: { S: now },
      ownerAtTime: candidate.currentOwner ? { S: candidate.currentOwner } : { NULL: true },
      reason: { S: candidate.escalationReason === 'BOTH' ? 'BOTH' : candidate.escalationReason === 'OWNER_UNAVAILABLE' ? 'MANUAL_UNAVAILABLE' : 'INACTIVITY' },
      gracePeriodHours: { N: String(candidate.gracePeriodHours) },
    }
  };

  // Build replacement ranking snapshot
  const rankingSnapshot = replacementCandidates.map(r => ({
    M: {
      name: { S: r.name },
      openActionCount: { N: String(r.openActionCount) },
      rank: { N: String(r.rank) },
    }
  }));

  const timelineEvent = {
    M: {
      event: { S: `Escalated by system: ${candidate.escalationReason}` },
      actor: { S: 'SYSTEM' },
      timestamp: { S: now },
      note: { S: suggestedReplacement ? `Suggested replacement: ${suggestedReplacement.name}` : 'No replacement candidate found' },
    }
  };

  // 1. Update the ConfirmedAction
  await docClient.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { PK: { S: candidate.meetingId }, SK: { S: `ACTION#${candidate.actionId}` } },
    UpdateExpression: `SET #s = :s,
      escalationStatus = :es,
      escalationTriggeredAt = :eta,
      escalationReason = :er,
      suggestedReplacementOwner = :sro,
      replacementRankingSnapshot = :rrs,
      missedDeadlines = list_append(if_not_exists(missedDeadlines, :empty), :md),
      #tl = list_append(if_not_exists(#tl, :empty), :te)`,
    ExpressionAttributeNames: { '#s': 'status', '#tl': 'timeline' },
    ExpressionAttributeValues: {
      ':s': { S: 'ESCALATED' },
      ':es': { S: 'PENDING_ACCEPTANCE' },
      ':eta': { S: now },
      ':er': { S: candidate.escalationReason },
      ':sro': suggestedReplacement ? { S: suggestedReplacement.name } : { NULL: true },
      ':rrs': { L: rankingSnapshot },
      ':empty': { L: [] },
      ':md': { L: [missedDeadlineEntry] },
      ':te': { L: [timelineEvent] },
    },
    // Only escalate if still not escalated (prevent double-fire)
    ConditionExpression: 'escalationStatus = :none OR attribute_not_exists(escalationStatus)',
    ExpressionAttributeValues: {
      ':s': { S: 'ESCALATED' },
      ':es': { S: 'PENDING_ACCEPTANCE' },
      ':eta': { S: now },
      ':er': { S: candidate.escalationReason },
      ':sro': suggestedReplacement ? { S: suggestedReplacement.name } : { NULL: true },
      ':rrs': { L: rankingSnapshot },
      ':empty': { L: [] },
      ':md': { L: [missedDeadlineEntry] },
      ':te': { L: [timelineEvent] },
      ':none': { S: 'NONE' },
    },
  })).catch((err: any) => {
    // ConditionalCheckFailedException = already escalated, skip silently
    if (err?.name !== 'ConditionalCheckFailedException') throw err;
    console.log(`Action ${candidate.actionId} already escalated, skipping.`);
  });

  // 2. Write AuditLog (write-only, always write even if condition failed — idempotent read is fine)
  const auditId = uuidv4();
  await docClient.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: { S: candidate.meetingId },
      SK: { S: `AUDIT#${now}#${auditId}` },
      eventType: { S: 'ESCALATION_TRIGGERED' },
      actorId: { S: 'SYSTEM' },
      actionId: { S: candidate.actionId },
      timestamp: { S: now },
      before: { M: { escalationStatus: { S: 'NONE' }, status: { S: 'PENDING' } } },
      after: { M: {
        escalationStatus: { S: 'PENDING_ACCEPTANCE' },
        status: { S: 'ESCALATED' },
        suggestedReplacementOwner: suggestedReplacement ? { S: suggestedReplacement.name } : { NULL: true },
      }},
      metadata: { M: {
        escalationReason: { S: candidate.escalationReason },
        deadline: candidate.deadline ? { S: candidate.deadline } : { NULL: true },
        currentOwner: candidate.currentOwner ? { S: candidate.currentOwner } : { NULL: true },
        candidateCount: { N: String(replacementCandidates.length) },
      }},
    }
  }));
}
