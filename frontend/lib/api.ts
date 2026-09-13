import { fetchAuthSession } from 'aws-amplify/auth';

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Normalize double slashes in URL path (e.g. if NEXT_PUBLIC_API_URL ends with a slash)
  let normalizedUrl = input;
  if (typeof input === 'string') {
    normalizedUrl = input.replace(/([^:]\/)\/+/g, '$1');
  } else if (input instanceof URL) {
    normalizedUrl = input.href.replace(/([^:]\/)\/+/g, '$1');
  }

  return fetch(normalizedUrl, {
    ...init,
    headers,
  });
}
