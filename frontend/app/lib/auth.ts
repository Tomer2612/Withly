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
 * Wipe the legacy `auth-token` cookie set by pre-cookie-auth versions of
 * the frontend. Nothing reads it after S7+S9 phase 2, but a user who
 * logged in before that deploy still has it sitting in their browser.
 * Calling this on every logout/expiry path cleans it up over time.
 */
function clearLegacyAuthCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'auth-token=; path=/; max-age=0';
  }
}

/**
 * Clear local auth-derived caches and redirect to login (unless already
 * on login/signup). The httpOnly cookies themselves are cleared
 * server-side — the global 401 interceptor calls this after a failed
 * refresh, and the logout button calls serverLogout first.
 */
export function clearSessionAndRedirect() {
  localStorage.removeItem('userProfileCache');
  clearLegacyAuthCookie();
  const path = window.location.pathname;
  if (path !== '/login' && path !== '/signup') {
    window.location.href = '/login?expired=true';
  }
}

/** Clear local auth-derived caches without redirecting. */
export function clearSessionData() {
  localStorage.removeItem('userProfileCache');
  clearLegacyAuthCookie();
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
