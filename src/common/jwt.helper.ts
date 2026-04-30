import * as jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../auth/cookies.helper';

/**
 * Single accessor for the JWT signing/verification secret. main.ts asserts
 * the env var is set during bootstrap, so this is non-null at request time.
 */
export function getJwtSecret(): string {
  return process.env.JWT_SECRET!;
}

/**
 * For optional-auth endpoints: extract the user id from the access cookie
 * if present and valid, otherwise return undefined. Never throws.
 *
 * Don't use this where auth is required — use AuthGuard('jwt') for that.
 */
export function getUserIdFromRequest(req: Request): string | undefined {
  const cookieToken = (req as Request & { cookies?: Record<string, string> })
    .cookies?.[ACCESS_TOKEN_COOKIE];
  if (!cookieToken) return undefined;
  try {
    const decoded = jwt.verify(cookieToken, getJwtSecret()) as { sub?: string };
    return decoded.sub;
  } catch {
    return undefined;
  }
}
