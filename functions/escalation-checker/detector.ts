import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export interface EscalationCandidate {
  actionId: string;
  meetingId: string;
  task: string;
  currentOwner: string | null;
  deadline: string | null;
  escalationReason: 'DEADLINE_PASSED_INACTIVE' | 'OWNER_UNAVAILABLE' | 'BOTH';
  gracePeriodHours: number;
}

export interface ParticipantEntry {
  name: string;
  role?: string;
  isAvailable: boolean;
  unavailableSince?: string;
}

/**
 * Detects all actions that require escalation:
 * - Trigger A: PENDING/IN_PROGRESS actions where deadline + gracePeriod < now AND escalationStatus = NONE
 * - Trigger B: handled separately by markParticipantUnavailable endpoint
 */
export async function detectInactivityEscalations(
  meetingId: string,
  gracePeriodHours: number,
  participants: ParticipantEntry[]
): Promise<EscalationCandidate[]> {
  const now = new Date();
  const unavailableNames = new Set(
    participants.filter(p => !p.isAvailable).map(p => p.name.toLowerCase())
  );

  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    FilterExpression: '#s IN (:pending, :in_progress) AND escalationStatus = :none',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':pk': { S: meetingId },
      ':skPrefix': { S: 'ACTION#' },
      ':pending': { S: 'PENDING' },
      ':in_progress': { S: 'IN_PROGRESS' },
      ':none': { S: 'NONE' },
    },
  }));

  const candidates: EscalationCandidate[] = [];

  for (const item of (Items || [])) {
    const actionId = item.actionId?.S || '';
    const deadline = item.deadline?.S || null;
    const currentOwner = item.currentOwner?.S || item.owner?.S || null;
    const task = item.task?.S || '';

    let deadlinePassed = false;
    if (deadline) {
      const deadlineDate = new Date(deadline);
      const cutoffDate = new Date(deadlineDate.getTime() + gracePeriodHours * 60 * 60 * 1000);
      deadlinePassed = now > cutoffDate;
    }

    const ownerUnavailable = currentOwner
      ? unavailableNames.has(currentOwner.toLowerCase())
      : false;

    if (!deadlinePassed && !ownerUnavailable) continue;

    let reason: EscalationCandidate['escalationReason'];
    if (deadlinePassed && ownerUnavailable) {
      reason = 'BOTH';
    } else if (deadlinePassed) {
      reason = 'DEADLINE_PASSED_INACTIVE';
    } else {
      reason = 'OWNER_UNAVAILABLE';
    }

    candidates.push({
      actionId,
      meetingId,
      task,
      currentOwner,
      deadline,
      escalationReason: reason,
      gracePeriodHours,
    });
  }

  return candidates;
}

/**
 * Parse participant directory string into structured entries.
 * Format: one per line, "Name (Role)" or "Name"
 */
export function parseParticipants(participantsStr: string): ParticipantEntry[] {
  return participantsStr
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map(line => {
      const match = line.match(/^(.+?)\s*\((.+?)\)\s*$/);
      return {
        name: (match ? match[1] : line).trim(),
        role: match ? match[2].trim() : undefined,
        isAvailable: true, // Default — availability tracked separately in DynamoDB
      };
    });
}
