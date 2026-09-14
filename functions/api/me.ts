import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handleMeTasks = async (event: any) => {
  try {
    const userId = event.requestContext?.authorizer?.claims?.sub;
    
    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Unauthorized: Missing claims' })
      };
    }

    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :gpk AND begins_with(GSI2SK, :gskPrefix)',
      ExpressionAttributeValues: { 
        ':gpk': { S: `USER#${userId}` }, 
        ':gskPrefix': { S: 'ACTION#' } 
      }
    }));
    
    const tasks = (Items || []).map(item => unmarshall(item));
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(tasks)
    };
  } catch (error: any) {
    console.error('API Error /me/tasks:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
