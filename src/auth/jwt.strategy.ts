import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { getJwtSecret } from '../common/jwt.helper';
import { ACCESS_TOKEN_COOKIE } from './cookies.helper';

// Phase 1: cookie is preferred but Bearer header still works so the
// existing localStorage-based frontend keeps logging in. Phase 3 will drop
// the Bearer fallback once the frontend is fully on cookies.
const fromAccessCookie = (req: Request): string | null => {
  return (req?.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        fromAccessCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
