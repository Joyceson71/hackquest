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
    // Employees list
    if (path === '/employees') {
      return await handleEmployees(event);
    }

    // My tasks
    if (path === '/me/tasks') {
      return await handleMeTasks(event);
    }

    // Meetings — list / create
    if (path === '/meetings') {
      return await handleMeetings(event);
    }

    // Single meeting — get / patch / delete
    if (path === '/meetings/{id}') {
      return await handleMeetings(event);
    }

    // Upload presigned URL
    if (path === '/meetings/{id}/upload') {
      return await handleUpload(event);
    }

    // Proposed items — list
    if (path === '/meetings/{id}/proposed-items') {
      return await handleProposed(event);
    }

    // Proposed item — confirm / reject
    if (path === '/meetings/{id}/proposed-items/{itemId}') {
      return await handleProposed(event);
    }

    // Confirmed actions — list
    if (path === '/meetings/{id}/confirmed-actions') {
      return await handleActions(event);
    }

    // Confirmed action — update status / delete
    if (path === '/meetings/{id}/confirmed-actions/{actionId}') {
      return await handleActions(event);
    }

    // Escalation — accept
    if (path === '/meetings/{id}/confirmed-actions/{actionId}/escalation/accept') {
      return await handleActions(event);
    }

    // Escalation — decline
    if (path === '/meetings/{id}/confirmed-actions/{actionId}/escalation/decline') {
      return await handleActions(event);
    }

    // Escalation inbox for a meeting
    if (path === '/meetings/{id}/escalations') {
      return await handleEscalations(event);
    }

    // Participants — mark unavailable (triggers immediate escalation scan)
    if (path === '/meetings/{id}/participants/unavailable') {
      return await handleParticipants(event);
    }

    // Team Routes
    const teamRouteResponse = await handleTeamRoutes(path, method, event, auth, isAdmin);
    if (teamRouteResponse !== null) {
      return teamRouteResponse;
    }

    return {
      statusCode: 404,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Route not found' }),
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
