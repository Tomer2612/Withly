import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from './prisma.service';
import * as jwt from 'jsonwebtoken';

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
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { sub?: string };

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
