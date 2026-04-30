import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { getJwtSecret } from '../common/jwt.helper';
import { ACCESS_TOKEN_COOKIE } from './cookies.helper';

// Cookie-only auth: the access token rides in an httpOnly cookie set on
// login and rotated by /auth/refresh. JS can't read it, so XSS can't lift
// it. Bearer headers are no longer accepted.
const fromAccessCookie = (req: Request): string | null => {
  return (req?.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromAccessCookie]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
