import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { getJwtSecret } from '../common/jwt.helper';
import { ACCESS_TOKEN_COOKIE } from './cookies.helper';
import { PrismaService } from '../common/prisma.service';

// Cookie-only auth: the access token rides in an httpOnly cookie set on
// login and rotated by /auth/refresh. JS can't read it, so XSS can't lift
// it. Bearer headers are no longer accepted.
const fromAccessCookie = (req: Request): string | null => {
  return (req?.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromAccessCookie]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    // Verify the user still exists. Without this check, a deleted user's
    // access token (15-minute TTL) stays valid on stale devices until
    // expiration. Refresh tokens are already cascade-deleted, but
    // existing access tokens remain valid because JWT verification is
    // stateless. One indexed PK lookup is the price of immediate revocation.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub, email: payload.email };
  }
}
