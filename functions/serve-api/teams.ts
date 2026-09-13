import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand, DeleteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const docClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function ok(body: any) { return { statusCode: 200, headers: CORS, body: JSON.stringify(body) }; }
function badRequest(msg: string) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: msg }) }; }

export async function handleTeamRoutes(path: string, method: string, event: any) {
  const now = new Date().toISOString();
  
  // POST /teams (Admin creates team)
  if (path === '/teams' && method === 'POST') {
    const body = JSON.parse(event.body || '{}');
    if (!body.name) return badRequest('Team name is required');
    
    const teamId = uuidv4();
    await docClient.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: `TEAM#${teamId}` },
        SK: { S: 'METADATA' },
        GSI1PK: { S: `TEAM#${teamId}` },
        GSI1SK: { S: 'METADATA' },
        teamId: { S: teamId },
        name: { S: body.name },
        description: { S: body.description || '' },
        status: { S: 'ACTIVE' },
        createdAt: { S: now },
        updatedAt: { S: now },
        leaderEmail: { NULL: true },
      }
    }));
    return ok({ teamId, name: body.name });
  }

  // GET /teams (Admin list all teams)
  if (path === '/teams' && method === 'GET') {
    // Scan is acceptable here since the number of teams is very small in an org.
    // If it gets large, we'd add a dedicated GSI pattern like GSI2PK="ALL_TEAMS".
    const { Items } = await docClient.send(new ScanCommand({
       TableName: TABLE_NAME,
       FilterExpression: 'SK = :sk AND begins_with(PK, :prefix)',
       ExpressionAttributeValues: { ':sk': { S: 'METADATA' }, ':prefix': { S: 'TEAM#' } }
    }));
    return ok((Items || []).map(item => unmarshall(item)));
  }

  // GET /teams/{teamId}
  const teamMatch = path.match(/^\/teams\/([a-zA-Z0-9-]+)$/);
  if (teamMatch && method === 'GET') {
    const teamId = teamMatch[1];
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': { S: `TEAM#${teamId}` } }
    }));
    
    if (!Items || Items.length === 0) return badRequest('Team not found');
    
    let teamData: any = null;
    const members: any[] = [];
    
    for (const item of Items) {
      const parsed = unmarshall(item);
      if (parsed.SK === 'METADATA') {
        teamData = parsed;
      } else if (parsed.SK.startsWith('MEMBER#')) {
        members.push(parsed);
      }
    }
    
    return ok({ ...teamData, members });
  }

  // POST /teams/{teamId}/members (Admin adds member)
  const memberPostMatch = path.match(/^\/teams\/([a-zA-Z0-9-]+)\/members$/);
  if (memberPostMatch && method === 'POST') {
    const teamId = memberPostMatch[1];
    const body = JSON.parse(event.body || '{}');
    if (!body.email) return badRequest('Member email is required');
    const email = body.email.toLowerCase();

    // Check if team exists
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: { ':pk': { S: `TEAM#${teamId}` }, ':sk': { S: 'METADATA' } }
    }));
    if (!Items || Items.length === 0) return badRequest('Team not found');

    await docClient.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: `TEAM#${teamId}` },
        SK: { S: `MEMBER#${email}` },
        GSI1PK: { S: `USER#${email}` },
        GSI1SK: { S: `TEAM#${teamId}` },
        teamId: { S: teamId },
        email: { S: email },
        name: { S: body.name || email }, // Best effort name
        role: { S: body.role || 'MEMBER' }, // 'LEADER' | 'MEMBER'
        status: { S: 'ACTIVE' },
        joinedAt: { S: now },
      }
    }));
    
    // If assigned as leader, update the team metadata
    if (body.role === 'LEADER') {
      await docClient.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: 'METADATA' } },
        UpdateExpression: 'SET leaderEmail = :le, updatedAt = :now',
        ExpressionAttributeValues: { ':le': { S: email }, ':now': { S: now } }
      }));
    }

    return ok({ success: true, email });
  }

  // DELETE /teams/{teamId}/members/{email} (Admin removes member)
  const memberDelMatch = path.match(/^\/teams\/([a-zA-Z0-9-]+)\/members\/(.+)$/);
  if (memberDelMatch && method === 'DELETE') {
    const teamId = memberDelMatch[1];
    const email = decodeURIComponent(memberDelMatch[2]).toLowerCase();

    // Soft delete or hard delete? A hard delete works for MVP.
    // If they were leader, clear leaderEmail on team metadata
    await docClient.send(new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: `MEMBER#${email}` } }
    }));

    return ok({ success: true });
  }

  // POST /teams/{teamId}/tasks (Leader manual task creation)
  const taskPostMatch = path.match(/^\/teams\/([a-zA-Z0-9-]+)\/tasks$/);
  if (taskPostMatch && method === 'POST') {
    const teamId = taskPostMatch[1];
    const body = JSON.parse(event.body || '{}');
    const taskId = uuidv4();
    
    await docClient.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: `TASK#${taskId}` }, // Standalone task PK
        SK: { S: `ACTION#${taskId}` },
        GSI1PK: { S: `TEAM#${teamId}` },
        GSI1SK: { S: `ACTION#${taskId}` },
        teamId: { S: teamId },
        actionId: { S: taskId },
        task: { S: body.task || 'Untitled Task' },
        description: { S: body.description || '' },
        priority: { S: body.priority || 'MEDIUM' },
        owner: body.assignee ? { S: body.assignee } : { NULL: true },
        currentOwner: body.assignee ? { S: body.assignee } : { NULL: true },
        deadline: body.deadline ? { S: body.deadline } : { NULL: true },
        status: { S: 'PENDING' },
        escalationStatus: { S: 'NONE' },
        confirmedAt: { S: now },
        createdAt: { S: now },
        lastActivityAt: { S: now },
        timeline: {
          L: [{
            M: {
              event: { S: 'Task created and assigned' },
              actor: { S: body.assignedBy || 'leader' },
              timestamp: { S: now },
              note: { S: '' }
            }
          }]
        }
      }
    }));

    return ok({ success: true, taskId });
  }

  // GET /teams/{teamId}/tasks (List tasks for a team)
  const taskGetMatch = path.match(/^\/teams\/([a-zA-Z0-9-]+)\/tasks$/);
  if (taskGetMatch && method === 'GET') {
    const teamId = taskGetMatch[1];
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gpk AND begins_with(GSI1SK, :gskPrefix)',
      ExpressionAttributeValues: { ':gpk': { S: `TEAM#${teamId}` }, ':gskPrefix': { S: 'ACTION#' } }
    }));
    return ok((Items || []).map(item => unmarshall(item)));
  }

  // PUT /tasks/{taskId} (Status updates / Acknowledgement)
  const taskUpdateMatch = path.match(/^\/tasks\/([a-zA-Z0-9-]+)$/);
  if (taskUpdateMatch && method === 'PUT') {
    const taskId = taskUpdateMatch[1];
    const body = JSON.parse(event.body || '{}');

    // First find the PK of the task using GSI1 if we only have taskId?
    // Wait, we know PK is TASK#taskId OR meetingId.
    // If it's a meeting action, its PK is meetingId. 
    // To update a task by just taskId, we'd need to know its PK.
    // Let's assume the frontend passes `meetingId` if it belongs to a meeting, or `pk` in the body.
    const pk = body.pk || `TASK#${taskId}`;

    const parts = [];
    const vals: any = { ':now': { S: now } };

    if (body.status) {
      parts.push('#s = :st');
      vals[':st'] = { S: body.status };
    }
    if (body.status === 'ACKNOWLEDGED' && body.previousStatus === 'PENDING') {
      parts.push('acknowledgedAt = :now');
    }
    if (body.status === 'IN_PROGRESS' && body.previousStatus !== 'IN_PROGRESS') {
      parts.push('startedAt = :now');
    }
    if (body.status === 'COMPLETED') {
      parts.push('completedAt = :now');
    }

    parts.push('lastActivityAt = :now');

    const tlEvent = {
      M: {
        event: { S: `Status changed to ${body.status}` },
        actor: { S: body.actor || 'user' },
        timestamp: { S: now },
        note: { S: '' }
      }
    };
    parts.push('timeline = list_append(if_not_exists(timeline, :el), :te)');
    vals[':el'] = { L: [] };
    vals[':te'] = { L: [tlEvent] };

    await docClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: pk }, SK: { S: `ACTION#${taskId}` } },
      UpdateExpression: `SET ${parts.join(', ')}`,
      ExpressionAttributeNames: body.status ? { '#s': 'status' } : undefined,
      ExpressionAttributeValues: vals
    }));

    return ok({ success: true });
  }

  // GET /users/{email}/teams (Get all teams a user belongs to)
  const userTeamsMatch = path.match(/^\/users\/(.+)\/teams$/);
  if (userTeamsMatch && method === 'GET') {
    const email = decodeURIComponent(userTeamsMatch[1]).toLowerCase();
    
    // Query GSI1 for USER#email
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gpk AND begins_with(GSI1SK, :gskPrefix)',
      ExpressionAttributeValues: { ':gpk': { S: `USER#${email}` }, ':gskPrefix': { S: 'TEAM#' } }
    }));
    
    return ok((Items || []).map(item => unmarshall(item)));
  }

  return null;
}
