import type { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
// Holds no secret — only "this browser has a refresh session". The frontend
// middleware runs on page URLs, where it can't see the refresh cookie
// (path-restricted to /auth), so once the 15-minute access cookie expired it
// treated a signed-in user as logged out and bounced them to /preview or
// /login. With this hint it lets the page load; the first API call 401s, the
// client interceptor refreshes, and the request is retried. Never used for
// authorization — the backend still verifies the JWT on every request.
// Name must match SESSION_HINT_COOKIE in frontend/middleware.ts.
const SESSION_HINT_COOKIE = 'signed_in';

// Short-lived access cookie + long-lived refresh cookie. When the access
// cookie expires, the next API call gets 401 and the frontend interceptor
// silently rotates via /auth/refresh.
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const isProd = process.env.NODE_ENV === 'production';

// Refresh cookie path — must match the URL the BROWSER hits, which depends
// on whether nginx (or another proxy) prepends a path prefix in front of
// the NestJS routes. NestJS's internal route is `/auth/refresh`, but on
// prod nginx exposes the API under `/api/*` so the browser actually calls
// `/api/auth/refresh`. Set REFRESH_COOKIE_PATH=/api/auth on prod; default
// `/auth` is correct for local dev (no proxy prefix).
const REFRESH_COOKIE_PATH = process.env.REFRESH_COOKIE_PATH ?? '/auth';

export function setAccessCookie(res: Response, token: string) {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_TTL_MS,
    path: '/',
  });
}

// Refresh cookie is path-restricted (see REFRESH_COOKIE_PATH above) so it
// isn't shipped on every regular API request — only on refresh and logout.
export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: REFRESH_COOKIE_PATH,
  });
  // Same lifetime as the refresh session it describes, but site-wide so the
  // frontend middleware can see it (see SESSION_HINT_COOKIE above).
  res.cookie(SESSION_HINT_COOKIE, '1', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/',
  });
}

export function clearAuthCookies(res: Response) {
  // Pass the same attribute shape we set the cookie with — strict browsers
  // (Chrome with SameSite enforcement) sometimes refuse the clear if the
  // SameSite/Secure on the clear don't match the original.
  const clearOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
  };
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...clearOptions, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...clearOptions, path: REFRESH_COOKIE_PATH });
  res.clearCookie(SESSION_HINT_COOKIE, { ...clearOptions, path: '/' });
}
