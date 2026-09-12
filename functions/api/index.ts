import { handleMeetings } from './meetings';
import { handleUpload } from './upload';
import { handleProposed } from './proposed';
import { handleActions } from './actions';

export const handler = async (event: any) => {
  const method = event.httpMethod;
  const path = event.resource;

  console.log(`[API] ${method} ${path}`);

  try {
    if (path === '/meetings') {
      return await handleMeetings(event);
    }
    
    if (path === '/meetings/{id}') {
      return await handleMeetings(event);
    }

    if (path === '/meetings/{id}/upload') {
      return await handleUpload(event);
    }

    if (path === '/meetings/{id}/proposed-items') {
      return await handleProposed(event);
    }

    if (path === '/meetings/{id}/proposed-items/{itemId}') {
      return await handleProposed(event);
    }

    if (path === '/meetings/{id}/confirmed-actions') {
      return await handleActions(event);
    }

    if (path === '/meetings/{id}/confirmed-actions/{actionId}') {
      return await handleActions(event);
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
