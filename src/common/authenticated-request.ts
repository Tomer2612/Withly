import type { Request } from 'express';

// What JwtStrategy.validate() puts on req.user for routes behind
// @UseGuards(AuthGuard('jwt')). Routes without the guard must use plain
// `Request` (and getUserIdFromRequest) — there `user` may be missing.
interface AuthUser {
  userId: string;
  email: string;
}

export type AuthenticatedRequest = Request & { user: AuthUser };

// What GoogleStrategy.validate() puts on req.user for the Google OAuth
// callback (AuthGuard('google')) — a profile, not a signed-in user yet.
interface GoogleProfileUser {
  email: string;
  name: string;
  picture: string | null;
  provider: string;
}

export type GoogleAuthRequest = Request & { user: GoogleProfileUser };
