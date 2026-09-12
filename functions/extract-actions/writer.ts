/**
 * Writer — writes validated ProposedItems to DynamoDB.
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ValidatedItem } from './validator';

const docClient = new DynamoDBClient({});

export async function writeProposedItems(
  tableName: string,
  meetingId: string,
  items: ValidatedItem[]
): Promise<void> {
  const now = new Date().toISOString();

  for (const item of items) {
    const itemId = uuidv4();
    await docClient.send(new PutItemCommand({
      TableName: tableName,
      Item: {
        PK: { S: meetingId },
        SK: { S: `PROPOSED#${itemId}` },
        itemId: { S: itemId },
        type: { S: item.type },
        rawText: { S: item.rawText },
        suggestedOwner: item.suggestedOwner ? { S: item.suggestedOwner } : { NULL: true },
        suggestedDeadline: item.suggestedDeadline ? { S: item.suggestedDeadline } : { NULL: true },
        confidenceScore: { N: item.confidenceScore.toString() },
        confidenceReason: { S: item.confidenceReason },
        evidenceLineStart: { N: item.evidenceLineStart.toString() },
        evidenceLineEnd: { N: item.evidenceLineEnd.toString() },
        extractedAt: { S: now },
        reviewStatus: { S: 'PENDING' },
      }
    }));
  }
}
