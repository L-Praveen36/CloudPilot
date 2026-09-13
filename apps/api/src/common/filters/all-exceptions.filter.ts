import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * AllExceptionsFilter
 *
 * Catches any exception NOT already handled by HttpExceptionFilter
 * (e.g. unhandled Promise rejections, Prisma errors, runtime crashes).
 *
 * Returns a safe 500 response — never leaks internal details (error type,
 * file paths, DB queries, stack frames) to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // Let HttpExceptionFilter handle Http-typed exceptions.
    if (exception instanceof HttpException) {
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Log the full error server-side (stack trace included).
    const errMessage = exception instanceof Error ? exception.message : String(exception);
    const errStack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}: ${errMessage}`,
      errStack,
    );

    response.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
