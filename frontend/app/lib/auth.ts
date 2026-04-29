/**
 * Shared auth helpers for token management and 401 handling.
 *
 * Auth lives in two httpOnly cookies set by the backend (access_token,
 * refresh_token). They're invisible to JS. Browsers send them automatically
 * on every API request as long as `credentials: 'include'` is set, which
 * the global fetch interceptor in ClientProviders does for us.
 */

/**
 * Tell the backend to revoke the refresh token and clear the httpOnly
 * cookies. Best-effort: a network failure shouldn't block the user from
 * logging out locally, so we swallow errors.
 */
export async function serverLogout(): Promise<void> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Ignore — local cleanup proceeds regardless.
  }
}

/**
 * Clear local auth-derived caches and redirect to login (unless already
 * on login/signup). The cookies themselves are httpOnly and only the
 * server can clear them — the global 401 interceptor calls this after a
 * failed refresh, and the logout button calls serverLogout first.
 */
export function clearSessionAndRedirect() {
  localStorage.removeItem('userProfileCache');
  const path = window.location.pathname;
  if (path !== '/login' && path !== '/signup') {
    window.location.href = '/login?expired=true';
  }
}

/** Clear local auth-derived caches without redirecting. */
export function clearSessionData() {
  localStorage.removeItem('userProfileCache');
}

/**
 * Wrapper around fetch for API calls. Cookies are sent automatically by
 * the global fetch interceptor — this wrapper exists mostly so call sites
 * can keep using the same import name and so future auth concerns have a
 * single place to live.
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { ...(options ?? {}), credentials: 'include' });
}
