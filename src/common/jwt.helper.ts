import * as jwt from 'jsonwebtoken';

/**
 * Single accessor for the JWT signing/verification secret. main.ts asserts
 * the env var is set during bootstrap, so this is non-null at request time.
 */
export function getJwtSecret(): string {
  return process.env.JWT_SECRET!;
}

/**
 * For optional-auth endpoints: extract the user id from a Bearer token
 * if one is present and valid, otherwise return undefined. Never throws.
 *
 * Don't use this where auth is required — use AuthGuard('jwt') for that.
 */
export function getUserIdFromAuthHeader(authHeader?: string): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, getJwtSecret()) as { sub?: string };
    return decoded.sub;
  } catch {
    return undefined;
  }
}
