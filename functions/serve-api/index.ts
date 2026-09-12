import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const docClient = new DynamoDBClient({});
const s3Client = new S3Client({});
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const path = event.path;
  const method = event.httpMethod;
  const meetingId = event.pathParameters?.id;

  try {
    // CORS Headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    };

    if (path === '/meetings' && method === 'GET') {
      const { Items } = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: { ':sk': { S: 'MEETING' } },
      }));
      const unmarshalledItems = (Items || []).map(item => unmarshall(item));
      return { statusCode: 200, headers, body: JSON.stringify(unmarshalledItems) };
    }

    if (path === '/meetings' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const newMeetingId = uuidv4();
      const s3Key = `${newMeetingId}.txt`;

      await docClient.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: { S: newMeetingId },
          SK: { S: 'MEETING' },
          title: { S: body.title || 'Untitled Meeting' },
          status: { S: 'UPLOADING' },
          createdAt: { S: new Date().toISOString() },
          transcriptS3Key: { S: s3Key },
        }
      }));

      // Generate Presigned URL
      const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key, ContentType: 'text/plain' });
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

      return {
        statusCode: 200, headers,
        body: JSON.stringify({ meetingId: newMeetingId, uploadUrl })
      };
    }

    if (meetingId && path === `/meetings/${meetingId}` && method === 'GET') {
      const { Items } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: { ':pk': { S: meetingId }, ':sk': { S: 'MEETING' } }
      }));
      const unmarshalledItem = Items && Items.length > 0 ? unmarshall(Items[0]) : {};
      return { statusCode: 200, headers, body: JSON.stringify(unmarshalledItem) };
    }

    if (meetingId && path === `/meetings/${meetingId}/proposed-items` && method === 'GET') {
      const { Items } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': { S: meetingId }, ':skPrefix': { S: 'PROPOSED#' } }
      }));
      const unmarshalledItems = (Items || []).map(item => unmarshall(item));
      return { statusCode: 200, headers, body: JSON.stringify(unmarshalledItems) };
    }

    if (meetingId && path.includes('/proposed-items/') && method === 'PUT') {
      const itemId = event.pathParameters?.itemId;
      const body = JSON.parse(event.body || '{}');
      
      if (body.action === 'CONFIRM') {
        const actionId = uuidv4();
        
        // Mark PROPOSED item as CONFIRMED
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
          UpdateExpression: 'SET reviewStatus = :rs',
          ExpressionAttributeValues: { ':rs': { S: 'CONFIRMED' } }
        }));
        
        // Create CONFIRMED item
        await docClient.send(new PutItemCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: { S: meetingId },
            SK: { S: `ACTION#${actionId}` },
            actionId: { S: actionId },
            sourceProposedItemId: { S: itemId },
            task: { S: body.task },
            owner: { S: body.owner },
            deadline: { S: body.deadline },
            status: { S: 'PENDING' },
            evidenceLineStart: { N: body.evidenceLineStart.toString() },
            confirmedAt: { S: new Date().toISOString() },
          }
        }));

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, actionId }) };
      }

      if (body.action === 'REJECT') {
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
          UpdateExpression: 'SET reviewStatus = :rs',
          ExpressionAttributeValues: { ':rs': { S: 'REJECTED' } }
        }));
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (meetingId && path === `/meetings/${meetingId}/confirmed-actions` && method === 'GET') {
      const { Items } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': { S: meetingId }, ':skPrefix': { S: 'ACTION#' } }
      }));
      const unmarshalledItems = (Items || []).map(item => unmarshall(item));
      return { statusCode: 200, headers, body: JSON.stringify(unmarshalledItems) };
    }

    if (meetingId && path.includes('/confirmed-actions/') && method === 'PUT') {
      const actionId = event.pathParameters?.actionId;
      const body = JSON.parse(event.body || '{}');
      
      await docClient.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
        UpdateExpression: 'SET #status = :s',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':s': { S: body.status } }
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Route not found' }) };

  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
