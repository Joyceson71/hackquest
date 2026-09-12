import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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
          title: { S: body.title?.trim() || 'Untitled Meeting' },
          participants: { S: body.participants?.trim() || '' },
          status: { S: 'UPLOADING' },
          extractionStatus: { S: 'PENDING' },
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
      
      // Generate presigned GET URL if transcriptS3Key exists
      if (unmarshalledItem.transcriptS3Key) {
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: unmarshalledItem.transcriptS3Key
        });
        unmarshalledItem.transcriptUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
      }
      
      return { statusCode: 200, headers, body: JSON.stringify(unmarshalledItem) };
    }

    if (meetingId && path === `/meetings/${meetingId}` && method === 'DELETE') {
      // Query all items for this meeting (MEETING, PROPOSED#*, ACTION#*, AUDIT#*)
      const { Items: meetingItems } = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': { S: meetingId } }
      }));

      if (meetingItems && meetingItems.length > 0) {
        for (const item of meetingItems) {
          if (item.SK?.S) {
            await docClient.send(new DeleteItemCommand({
              TableName: TABLE_NAME,
              Key: { PK: { S: meetingId }, SK: { S: item.SK.S } }
            }));
          }
        }
      } else {
        await docClient.send(new DeleteItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: 'MEETING' } }
        }));
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
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
        const now = new Date().toISOString();
        const lineStart = typeof body.evidenceLineStart === 'number' ? body.evidenceLineStart : parseInt(body.evidenceLineStart, 10) || 0;
        const lineEnd = typeof body.evidenceLineEnd === 'number' ? body.evidenceLineEnd : parseInt(body.evidenceLineEnd, 10) || lineStart;
        
        // Mark PROPOSED item as CONFIRMED
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
          UpdateExpression: 'SET reviewStatus = :rs',
          ExpressionAttributeValues: { ':rs': { S: 'CONFIRMED' } }
        }));
        
        // Create CONFIRMED item with safe DynamoDB types
        await docClient.send(new PutItemCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: { S: meetingId },
            SK: { S: `ACTION#${actionId}` },
            actionId: { S: actionId },
            sourceProposedItemId: { S: itemId },
            task: { S: body.task || 'Untitled Task' },
            owner: body.owner ? { S: body.owner } : { NULL: true },
            deadline: body.deadline ? { S: body.deadline } : { NULL: true },
            status: { S: 'PENDING' },
            evidenceLineStart: { N: lineStart.toString() },
            evidenceLineEnd: { N: lineEnd.toString() },
            confirmedAt: { S: now },
            timeline: {
              L: [
                {
                  M: {
                    event: { S: 'Action confirmed' },
                    actor: { S: 'user' },
                    timestamp: { S: now },
                    note: { S: '' }
                  }
                }
              ]
            }
          }
        }));

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, actionId }) };
      }

      if (body.action === 'REJECT') {
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `PROPOSED#${itemId}` } },
          UpdateExpression: 'SET reviewStatus = :rs, rejectionNote = :rn',
          ExpressionAttributeValues: {
            ':rs': { S: 'REJECTED' },
            ':rn': body.rejectionNote ? { S: body.rejectionNote } : { NULL: true }
          }
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
      const now = new Date().toISOString();
      const newStatus = body.status || 'PENDING';
      
      const newTimelineEvent = {
        M: {
          event: { S: `Status changed to ${newStatus}` },
          actor: { S: 'user' },
          timestamp: { S: now },
          note: body.note ? { S: body.note } : { S: '' }
        }
      };

      try {
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
          UpdateExpression: 'SET #status = :s, timeline = list_append(if_not_exists(timeline, :empty_list), :new_event)',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':s': { S: newStatus },
            ':empty_list': { L: [] },
            ':new_event': { L: [newTimelineEvent] }
          }
        }));
      } catch {
        // Fallback without timeline append if list_append fails
        await docClient.send(new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } },
          UpdateExpression: 'SET #status = :s',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':s': { S: newStatus } }
        }));
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (meetingId && path.includes('/confirmed-actions/') && method === 'DELETE') {
      const actionId = event.pathParameters?.actionId;
      await docClient.send(new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: meetingId }, SK: { S: `ACTION#${actionId}` } }
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Route not found' }) };

  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
