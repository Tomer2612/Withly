import type { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

// Phase 1: access cookie aligned with the 30-day JWT expiry so the
// unrefactored frontend doesn't lose its session mid-flow. Phase 3 will
// drop both to 15m once the refresh-on-401 loop ships on the frontend.
export const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const isProd = process.env.NODE_ENV === 'production';

export function setAccessCookie(res: Response, token: string) {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_TTL_MS,
    path: '/',
  });
}

// Refresh cookie is path-restricted to /auth so it isn't shipped on every
// regular API request — only on refresh and logout.
export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/auth',
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/auth' });
}
