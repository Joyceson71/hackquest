import { handleMeetings } from './meetings';
import { handleUpload } from './upload';
import { handleProposed } from './proposed';
import { handleActions } from './actions';
import { handleEscalations } from './escalations';
import { handleParticipants } from './participants';
import { handleEmployees } from './employees';
import { handleMeTasks } from './me';
import { handleTeamRoutes } from './teams';

export const handler = async (event: any) => {
  const method = event.httpMethod;
  const path = event.resource || event.path || '';

  console.log(`[API] ${method} ${path}`, JSON.stringify(event.pathParameters));

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization'
      },
      body: ''
    };
  }

  // Extract auth for routes that need it (teams uses this explicitly)
  const claims = event.requestContext?.authorizer?.claims || {};
  const auth = {
    userId: claims.sub,
    email: claims.email?.toLowerCase(),
    name: claims.name || claims.email,
    groups: claims['cognito:groups'] || '',
  };
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = adminEmails.includes(auth.email) || auth.groups.includes('Admins');

  try {
    if (path === '/employees') return await handleEmployees(event);
    if (path === '/me/tasks') return await handleMeTasks(event);
    if (path === '/meetings') return await handleMeetings(event);

    if (!event.pathParameters) {
      event.pathParameters = {};
    }

    const meetingMatch = path.match(/^\/meetings\/([a-zA-Z0-9-]+)(?:\/(.*))?$/);
    if (meetingMatch) {
      event.pathParameters.id = meetingMatch[1];
      const sub = meetingMatch[2];

      if (!sub) return await handleMeetings(event);
      if (sub === 'upload') return await handleUpload(event);
      if (sub === 'proposed-items') return await handleProposed(event);

      const proposedMatch = sub.match(/^proposed-items\/([a-zA-Z0-9-]+)$/);
      if (proposedMatch) {
        event.pathParameters.itemId = proposedMatch[1];
        return await handleProposed(event);
      }

      if (sub === 'confirmed-actions') return await handleActions(event);

      const actionMatch = sub.match(/^confirmed-actions\/([a-zA-Z0-9-]+)(?:\/(.*))?$/);
      if (actionMatch) {
        event.pathParameters.actionId = actionMatch[1];
        const actionSub = actionMatch[2];

        if (!actionSub) return await handleActions(event);
        if (actionSub === 'escalation/accept' || actionSub === 'escalation/decline') {
          event.pathParameters.subPath = actionSub;
          return await handleActions(event);
        }
      }

      if (sub === 'escalations') return await handleEscalations(event);
      if (sub === 'participants/unavailable') return await handleParticipants(event);
    }

    // Team Routes
    if (path.startsWith('/teams')) {
      const teamRouteResponse = await handleTeamRoutes(path, method, event, auth, isAdmin);
      if (teamRouteResponse !== null) return teamRouteResponse;
    }

    return {
      statusCode: 404,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: `Route not found: ${method} ${path}` }),
    };

  } catch (error: any) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
