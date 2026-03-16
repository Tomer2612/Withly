/**
 * Shared auth helpers for token management and 401 handling.
 */

/** Clear all auth state and redirect to login (unless already on login/signup) */
export function clearSessionAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('userProfileCache');
  document.cookie = 'auth-token=; path=/; max-age=0';
  const path = window.location.pathname;
  if (path !== '/login' && path !== '/signup') {
    window.location.href = '/login?expired=true';
  }
}

/** Clear token and cookie without redirecting (for use on login/signup pages). */
export function clearSessionData() {
  localStorage.removeItem('token');
  localStorage.removeItem('userProfileCache');
  document.cookie = 'auth-token=; path=/; max-age=0';
}

/**
 * Wrapper around fetch that automatically injects the auth token.
 * 401 responses are handled globally by the interceptor in ClientProviders.
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}
