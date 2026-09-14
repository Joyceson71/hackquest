import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand, DeleteItemCommand, ScanCommand, TransactWriteItemsCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
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
function forbidden(msg: string) { return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: msg }) }; }

export async function handleTeamRoutes(path: string, method: string, event: any, auth: any, isAdmin: boolean) {
  const now = new Date().toISOString();
  
  // POST /teams (Admin creates team)
  if (path === '/teams' && method === 'POST') {
    if (!isAdmin) return forbidden('Admin only');
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
        leaderUserId: { NULL: true },
        leaderRequired: { BOOL: true },
        config: { M: {
          autoReassignmentEnabled: { BOOL: true },
          reminderAfterHours: { N: '12' },
          leaderAlertAfterHours: { N: '24' },
          autoReassignAfterHours: { N: '48' },
          maxReassignments: { N: '2' },
        }}
      }
    }));
    return ok({ teamId, name: body.name });
  }

  // GET /teams (Admin list all teams)
  if (path === '/teams' && method === 'GET') {
    if (!isAdmin) return forbidden('Admin only');
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
    
    // Auth Check: Admin, or Member of the team
    if (!isAdmin) {
      const { Item: membership } = await docClient.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: `MEMBER#${auth.userId}` } }
      }));
      if (!membership) return forbidden('You must be a member of this team to view it');
    }

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
    if (!isAdmin) return forbidden('Admin only');
    const teamId = memberPostMatch[1];
    const body = JSON.parse(event.body || '{}');
    let email = (body.email || '').toLowerCase();
    let userId = body.userId;

    if (!userId && email && process.env.USER_POOL_ID) {
      try {
        const cognito = new CognitoIdentityProviderClient({});
        const { Users } = await cognito.send(new ListUsersCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Filter: `email = "${email}"`,
          Limit: 1
        }));
        if (Users && Users.length > 0) {
          userId = Users[0].Username; // sub is stored in Username for custom aliases
        }
      } catch (e) {
        console.error('Cognito lookup failed:', e);
      }
    }

    if (!userId) return badRequest('Member userId could not be determined. Make sure they have registered.');

    // Check if team exists
    const { Item: teamData } = await docClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: 'METADATA' } }
    }));
    if (!teamData) return badRequest('Team not found');

    const role = body.role === 'LEADER' ? 'LEADER' : 'MEMBER';
    const txItems: any[] = [];

    // If assigning leader, conditionally remove current leader
    if (role === 'LEADER') {
      const currentLeaderUserId = teamData.leaderUserId?.S;
      if (currentLeaderUserId && currentLeaderUserId !== body.userId) {
        txItems.push({
          Update: {
            TableName: TABLE_NAME,
            Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: `MEMBER#${currentLeaderUserId}` } },
            UpdateExpression: 'SET #r = :m',
            ExpressionAttributeNames: { '#r': 'role' },
            ExpressionAttributeValues: { ':m': { S: 'MEMBER' } }
          }
        });
      }
      
      txItems.push({
        Update: {
          TableName: TABLE_NAME,
          Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: 'METADATA' } },
          UpdateExpression: 'SET leaderUserId = :le, leaderEmail = :lem, leaderRequired = :lr, updatedAt = :now',
          ExpressionAttributeValues: { ':le': { S: body.userId }, ':lem': { S: email }, ':lr': { BOOL: false }, ':now': { S: now } }
        }
      });
    }

    txItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: { S: `TEAM#${teamId}` },
          SK: { S: `MEMBER#${body.userId}` },
          GSI1PK: { S: `USER#${body.userId}` },
          GSI1SK: { S: `TEAM#${teamId}` },
          teamId: { S: teamId },
          userId: { S: userId },
          email: { S: email },
          name: { S: body.name || email }, // Best effort name
          role: { S: role },
          status: { S: 'ACTIVE' },
          joinedAt: { S: now },
        }
      }
    });

    await docClient.send(new TransactWriteItemsCommand({ TransactItems: txItems }));
    return ok({ success: true, userId });
  }

  // DELETE /teams/{teamId}/members/{userId} (Admin removes member)
  const memberDelMatch = path.match(/^\/teams\/([a-zA-Z0-9-]+)\/members\/(.+)$/);
  if (memberDelMatch && method === 'DELETE') {
    if (!isAdmin) return forbidden('Admin only');
    const teamId = memberDelMatch[1];
    const userId = decodeURIComponent(memberDelMatch[2]);

    const { Item: teamData } = await docClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: 'METADATA' } }
    }));
    if (!teamData) return badRequest('Team not found');

    const txItems: any[] = [];
    
    // If they were leader, clear leaderUserId on team metadata
    if (teamData.leaderUserId?.S === userId) {
       txItems.push({
         Update: {
           TableName: TABLE_NAME,
           Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: 'METADATA' } },
           UpdateExpression: 'REMOVE leaderUserId, leaderEmail SET leaderRequired = :true, updatedAt = :now',
           ExpressionAttributeValues: { ':true': { BOOL: true }, ':now': { S: now } }
         }
       });
    }

    txItems.push({
      Delete: {
        TableName: TABLE_NAME,
        Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: `MEMBER#${userId}` } }
      }
    });

    await docClient.send(new TransactWriteItemsCommand({ TransactItems: txItems }));
    return ok({ success: true });
  }

  // POST /teams/{teamId}/tasks (Leader manual task creation)
  const taskPostMatch = path.match(/^\/teams\/([a-zA-Z0-9-]+)\/tasks$/);
  if (taskPostMatch && method === 'POST') {
    const teamId = taskPostMatch[1];
    const body = JSON.parse(event.body || '{}');

    // Auth Check: Admin or Team Leader
    if (!isAdmin) {
      const { Item: teamData } = await docClient.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: 'METADATA' } }
      }));
      if (teamData?.leaderUserId?.S !== auth.userId) {
         return forbidden('Only the team leader or admin can create tasks');
      }
    }

    const taskId = uuidv4();
    const assigneeUserId = body.assigneeUserId || null;
    
    await docClient.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: `TASK#${taskId}` }, // Standalone task PK
        SK: { S: `ACTION#${taskId}` },
        GSI1PK: { S: `TEAM#${teamId}` },
        GSI1SK: { S: `ACTION#${taskId}` },
        // Add GSI2 for user task efficient querying
        ...(assigneeUserId ? { GSI2PK: { S: `USER#${assigneeUserId}` }, GSI2SK: { S: `ACTION#${taskId}` } } : {}),
        teamId: { S: teamId },
        actionId: { S: taskId },
        task: { S: body.task || 'Untitled Task' },
        description: { S: body.description || '' },
        priority: { S: body.priority || 'MEDIUM' },
        assigneeUserId: assigneeUserId ? { S: assigneeUserId } : { NULL: true },
        currentOwner: body.assigneeEmail ? { S: body.assigneeEmail } : { NULL: true }, // display fallback
        deadline: body.deadline ? { S: body.deadline } : { NULL: true },
        status: { S: 'PENDING' },
        assignmentVersion: { N: '1' },
        escalationStatus: { S: 'NONE' },
        escalationLevel: { S: 'NONE' },
        confirmedAt: { S: now },
        createdAt: { S: now },
        lastActivityAt: { S: now },
        acknowledgedAt: { NULL: true },
        startedAt: { NULL: true },
        timeline: {
          L: [{
            M: {
              event: { S: 'Task created and assigned' },
              actorId: { S: auth.userId },
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
    
    // Auth Check: Admin or Member of team
    if (!isAdmin) {
      const { Item: membership } = await docClient.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: `MEMBER#${auth.userId}` } }
      }));
      if (!membership) return forbidden('You must be a member of this team to view its tasks');
    }

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
    const pk = body.pk || `TASK#${taskId}`;

    // 1. Fetch Task
    const { Item: actionItem } = await docClient.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: pk }, SK: { S: `ACTION#${taskId}` } }
    }));
    if (!actionItem) return badRequest('Task not found');
    
    // Auth Check: Is caller assigneeUserId, Team Leader, or Admin?
    const assigneeUserId = actionItem.assigneeUserId?.S;
    if (!isAdmin && assigneeUserId !== auth.userId) {
       // Check if they are team leader
       const teamId = actionItem.teamId?.S;
       if (!teamId) return forbidden('Only the assignee can update this task');
       const { Item: teamData } = await docClient.send(new GetItemCommand({
         TableName: TABLE_NAME,
         Key: { PK: { S: `TEAM#${teamId}` }, SK: { S: 'METADATA' } }
       }));
       if (teamData?.leaderUserId?.S !== auth.userId) {
         return forbidden('Only the assignee, team leader, or admin can update this task');
       }
    }

    const currentStatus = actionItem.status?.S || 'PENDING';
    const newStatus = body.status;

    // Enforce valid transitions if status is changing
    if (newStatus && newStatus !== currentStatus) {
      const validTransitions: Record<string, string[]> = {
         'PENDING': ['ACKNOWLEDGED', 'REASSIGNED'],
         'ACKNOWLEDGED': ['IN_PROGRESS'],
         'IN_PROGRESS': ['COMPLETED', 'BLOCKED', 'REASSIGNED'],
         'BLOCKED': ['IN_PROGRESS', 'REASSIGNED'],
         'COMPLETED': ['IN_PROGRESS'], // reopen
      };
      
      if (!validTransitions[currentStatus]?.includes(newStatus)) {
         return badRequest(`Invalid state transition from ${currentStatus} to ${newStatus}`);
      }
    }

    const parts = [];
    const vals: any = { ':now': { S: now } };
    const names: any = {};

    if (newStatus && newStatus !== currentStatus) {
      parts.push('#s = :st');
      names['#s'] = 'status';
      vals[':st'] = { S: newStatus };
      
      if (newStatus === 'ACKNOWLEDGED') {
        parts.push('acknowledgedAt = :now');
      }
      if (newStatus === 'IN_PROGRESS' && currentStatus !== 'IN_PROGRESS') {
        parts.push('startedAt = :now');
      }
      if (newStatus === 'COMPLETED') {
        parts.push('completedAt = :now');
      }
    }

    parts.push('lastActivityAt = :now');

    const tlEvent = {
      M: {
        event: { S: newStatus ? `Status changed to ${newStatus}` : 'Task updated' },
        actorId: { S: auth.userId },
        timestamp: { S: now },
        note: { S: body.note || '' }
      }
    };
    parts.push('timeline = list_append(if_not_exists(timeline, :el), :te)');
    vals[':el'] = { L: [] };
    vals[':te'] = { L: [tlEvent] };
    
    // Assignment Version Bump if reassigned
    if (newStatus === 'REASSIGNED') {
      parts.push('assignmentVersion = assignmentVersion + :one');
      vals[':one'] = { N: '1' };
    }

    await docClient.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: pk }, SK: { S: `ACTION#${taskId}` } },
      UpdateExpression: `SET ${parts.join(', ')}`,
      ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
      ExpressionAttributeValues: vals
    }));

    return ok({ success: true });
  }

  // GET /me/teams (Get all teams the caller belongs to)
  if (path === '/me/teams' && method === 'GET') {
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gpk AND begins_with(GSI1SK, :gskPrefix)',
      ExpressionAttributeValues: { ':gpk': { S: `USER#${auth.userId}` }, ':gskPrefix': { S: 'TEAM#' } }
    }));
    
    return ok((Items || []).map(item => unmarshall(item)));
  }

  return null;
}
