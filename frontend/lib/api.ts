import { fetchAuthSession } from 'aws-amplify/auth';

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Normalize double slashes in URL path
  let normalizedUrl = input;
  if (typeof input === 'string') {
    normalizedUrl = input.replace(/([^:]\/)\/+/g, '$1');
  } else if (input instanceof URL) {
    normalizedUrl = input.href.replace(/([^:]\/)\/+/g, '$1');
  }

  try {
    const res = await fetch(normalizedUrl, {
      ...init,
      headers,
    });
    return res;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      console.error(
        `[authenticatedFetch] Network or CORS Error fetching ${normalizedUrl}. ` +
        `This often happens if API Gateway rejects the token (401 Unauthorized) but does not return CORS headers.`
      );
      // Return a graceful 401 response to prevent the app from completely crashing
      return new Response(JSON.stringify({ error: 'Network or CORS Error (Likely Unauthorized)' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw error;
  }
}
