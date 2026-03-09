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

/**
 * Wrapper around fetch that automatically handles 401 responses
 * by clearing the session and redirecting to login.
 * Use this for any authenticated API call.
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearSessionAndRedirect();
  }

  return res;
}
