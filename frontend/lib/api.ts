import { fetchAuthSession } from 'aws-amplify/auth';

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
