/**
 * fn-extract-actions — S3 event handler
 * Triggered when a transcript is uploaded to S3.
 * 1. Reads transcript from S3
 * 2. Calls Bedrock/Claude via extractor
 * 3. Validates response via validator
 * 4. Writes ProposedItems via writer
 * 5. Updates Meeting status
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { callExtractor } from './extractor';
import { validateExtraction } from './validator';
import { writeProposedItems } from './writer';

const s3Client = new S3Client({});
const docClient = new DynamoDBClient({});

const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  console.log('S3 Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    // meetingId is the filename without extension
    const meetingId = key.replace(/\.[^/.]+$/, '');

    try {
      // Update status to EXTRACTING
      await updateMeetingStatus(meetingId, 'EXTRACTING');

      // 1. Read transcript from S3
      const { Body, ContentType } = await s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      const transcriptText = await Body?.transformToString();

      if (!transcriptText) throw new Error('Empty transcript file');

      // Validate MIME type server-side
      const validMimeTypes = ['text/plain', 'text/vtt', 'text/srt', 'application/octet-stream'];
      if (ContentType && !validMimeTypes.includes(ContentType)) {
        throw new Error(`Invalid MIME type: ${ContentType}. Expected text/plain, text/vtt, or text/srt.`);
      }

      // Validate size — 500 KB max
      if (transcriptText.length > 500 * 1024) {
        throw new Error('Transcript exceeds 500 KB limit');
      }

      const transcriptLines = transcriptText.split('\n');

      // 2. Fetch participant directory from Meeting record
      let participantDirectory = '';
      try {
        const { Items } = await docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: { ':pk': { S: meetingId }, ':sk': { S: 'MEETING' } }
        }));
        if (Items && Items[0]?.participants?.S) {
          participantDirectory = Items[0].participants.S;
        }
      } catch (e) {
        console.warn('Could not fetch participant directory, proceeding with empty', e);
      }

      // 3. Call AI extractor
      const rawResponse = await callExtractor(transcriptLines, participantDirectory);

      // 4. Validate
      const { items, errors } = validateExtraction(rawResponse, transcriptLines.length);
      if (errors.length > 0) {
        console.warn('Validation warnings:', errors);
      }

      // If JSON parsing failed entirely (items empty AND errors include parse failure)
      if (items.length === 0 && errors.some(e => e.includes('not valid JSON'))) {
        throw new Error(`AI response failed JSON parse: ${errors.join('; ')}`);
      }

      // 5. Write to DynamoDB
      await writeProposedItems(TABLE_NAME, meetingId, items);

      // 6. Update meeting status to READY
      await updateMeetingStatus(meetingId, 'READY');
      console.log(`Extraction complete: ${items.length} items written for meeting ${meetingId}`);

    } catch (error: any) {
      console.error('Extraction failed:', error);
      await updateMeetingStatus(meetingId, 'FAILED', error.message || 'Unknown error');
    }
  }
};

async function updateMeetingStatus(meetingId: string, status: string, errorMessage?: string) {
  const updateExpression = errorMessage
    ? 'SET extractionStatus = :s, errorMessage = :e, extractedAt = :t'
    : 'SET extractionStatus = :s, extractedAt = :t';

  const expressionAttributeValues: Record<string, any> = {
    ':s': { S: status },
    ':t': { S: new Date().toISOString() },
  };
  if (errorMessage) {
    expressionAttributeValues[':e'] = { S: errorMessage };
  }

  await docClient.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { PK: { S: meetingId }, SK: { S: 'MEETING' } },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
  }));
}
