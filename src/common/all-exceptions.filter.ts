import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/**
 * Global exception filter — every error that escapes a controller comes through
 * here so responses share one shape:
 *   { statusCode, message, path, timestamp }
 *
 * Known cases:
 *   HttpException (NotFound, Forbidden, BadRequest, ...) → its own status + message.
 *   Prisma's PrismaClientKnownRequestError → mapped where it makes sense (P2025
 *     unique-not-found → 404, P2002 unique-constraint → 409). Everything else
 *     becomes 500 to avoid leaking internal details.
 *   Anything else → 500 with a generic message; the real error is logged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    // Extra fields a thrower attached to an object-form HttpException
    // (e.g. `throw new ConflictException({ error: 'CARD_IN_USE', communities: [...] })`).
    // Preserved so structured error payloads survive the global normalization.
    let extras: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      // res is either a string or { message, statusCode, error, ... }
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        if ('message' in res) {
          message = (res as { message: string | string[] }).message;
        }
        extras = { ...(res as Record<string, unknown>) };
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Map a couple of common Prisma errors to sensible HTTP statuses.
      switch (exception.code) {
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Resource not found';
          break;
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'Resource already exists';
          break;
        default:
          this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`);
      }
    } else if (exception instanceof Error) {
      // Don't leak Error.message to clients — could expose internals.
      this.logger.error(`Unhandled error on ${request?.url}: ${exception.message}`, exception.stack);
    }

    httpAdapter.reply(
      response,
      {
        ...extras,
        statusCode: status,
        message,
        path: httpAdapter.getRequestUrl(request),
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}
