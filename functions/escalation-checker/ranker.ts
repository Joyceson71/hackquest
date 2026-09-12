import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export interface ReplacementCandidate {
  name: string;
  openActionCount: number;
  rank: number;
}

/**
 * Ranks available participants by ascending open action count (fewest = rank 1).
 * Excludes the current owner of the escalated action.
 */
export async function rankReplacementCandidates(
  meetingId: string,
  excludeOwner: string | null,
  availableParticipantNames: string[]
): Promise<ReplacementCandidate[]> {
  // Fetch all open actions for this meeting to count per-participant load
  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    FilterExpression: '#s IN (:pending, :in_progress)',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':pk': { S: meetingId },
      ':skPrefix': { S: 'ACTION#' },
      ':pending': { S: 'PENDING' },
      ':in_progress': { S: 'IN_PROGRESS' },
    },
  }));

  // Count open actions per participant
  const countMap = new Map<string, number>();
  for (const item of (Items || [])) {
    const owner = item.currentOwner?.S || item.owner?.S || null;
    if (owner) {
      countMap.set(owner, (countMap.get(owner) || 0) + 1);
    }
  }

  // Build candidate list — only available participants, exclude current owner
  const excludeLower = (excludeOwner || '').toLowerCase();
  const candidates = availableParticipantNames
    .filter(name => name.toLowerCase() !== excludeLower)
    .map(name => ({
      name,
      openActionCount: countMap.get(name) || 0,
    }))
    .sort((a, b) => a.openActionCount - b.openActionCount)
    .map((c, idx) => ({ ...c, rank: idx + 1 }));

  return candidates;
}
