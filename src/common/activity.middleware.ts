import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from './prisma.service';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from './jwt.helper';
import { ACCESS_TOKEN_COOKIE } from '../auth/cookies.helper';

// Skip the DB write if we already updated lastActiveAt for this user
// within the throttle window. Users on multiple tabs can fire dozens
// of requests per minute and all of them would update the same row
// to a near-identical timestamp — pointless write amplification.
const ACTIVITY_THROTTLE_MS = 60_000;

@Injectable()
export class ActivityMiddleware implements NestMiddleware {
  private lastWriteByUser = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Pull the access token from the httpOnly cookie set on login.
      const cookieToken = (req as Request & { cookies?: Record<string, string> })
        .cookies?.[ACCESS_TOKEN_COOKIE];
      if (cookieToken) {
        const decoded = jwt.verify(cookieToken, getJwtSecret()) as { sub?: string };

        if (decoded?.sub) {
          const userId = decoded.sub;
          const now = Date.now();
          const last = this.lastWriteByUser.get(userId);

          if (!last || now - last > ACTIVITY_THROTTLE_MS) {
            this.lastWriteByUser.set(userId, now);
            // Update lastActiveAt in background (don't await to not slow down request)
            this.prisma.user.update({
              where: { id: userId },
              data: { lastActiveAt: new Date() },
            }).catch(() => {
              // Silently ignore errors (user might not exist, etc.)
            });
          }
        }
      }
    } catch {
      // Invalid/expired token — skip the activity update silently
    }

    next();
  }
}
