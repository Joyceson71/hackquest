import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const docClient = new DynamoDBClient({});
const s3Client = new S3Client({});
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handleMeetings = async (event: any) => {
  const method = event.httpMethod;

  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const meetingId = uuidv4();
    
    // Validate inputs
    const title = body.title?.trim().substring(0, 200) || 'Untitled';
    const participants = body.participants?.trim().substring(0, 2000) || '';
    const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';

    await docClient.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: meetingId },
        SK: { S: 'MEETING' },
        title: { S: title },
        organizer: { S: userId },
        createdAt: { S: new Date().toISOString() },
        participants: { S: participants },
        extractionStatus: { S: 'PENDING' },
      }
    }));

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${meetingId}.txt`,
      ContentType: 'text/plain',
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return {
      statusCode: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ meetingId, uploadUrl }),
    };
  }

  if (method === 'GET') {
    const meetingId = event.pathParameters?.id;
    if (!meetingId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing meeting ID' }) };
    }

    const result = await docClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: { S: meetingId },
        SK: { S: 'MEETING' },
      }
    }));

    if (!result.Item) {
      return { statusCode: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Meeting not found' }) };
    }

    // Convert DynamoDB format to simple JSON (simplified for MVP)
    const item = {
      meetingId: result.Item.PK.S,
      title: result.Item.title?.S,
      extractionStatus: result.Item.extractionStatus?.S,
    };

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(item),
    };
  }
};
