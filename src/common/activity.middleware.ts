import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from './prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class ActivityMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { sub?: string };

        if (decoded?.sub) {
          // Update lastActiveAt in background (don't await to not slow down request)
          this.prisma.user.update({
            where: { id: decoded.sub },
            data: { lastActiveAt: new Date() },
          }).catch(() => {
            // Silently ignore errors (user might not exist, etc.)
          });
        }
      }
    } catch {
      // Invalid/expired token — skip the activity update silently
    }

    next();
  }
}
