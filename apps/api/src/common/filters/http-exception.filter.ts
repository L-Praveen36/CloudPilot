import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * GlobalHttpExceptionFilter
 *
 * Catches all HttpExceptions (including ValidationPipe errors) and returns a
 * consistent, sanitized JSON error response. Stack traces are NEVER serialized
 * to API responses — they are logged server-side only.
 *
 * Response shape:
 *   { statusCode, error, message, timestamp, path }
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Flatten ValidationPipe message arrays into a readable string.
    let message: string | string[];
    if (
      exception instanceof BadRequestException &&
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const msg = (exceptionResponse as any).message;
      message = Array.isArray(msg) ? msg : String(msg);
    } else if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      message = String((exceptionResponse as any).message);
    } else {
      message = exception.message;
    }

    // Derive HTTP error name from status code for the `error` field.
    const errorName = exception.name !== 'HttpException' ? exception.name : this.statusToError(statusCode);

    // Log server-side (with stack in development only).
    const logMessage = `HTTP ${statusCode} ${request.method} ${request.url} — ${Array.isArray(message) ? message.join('; ') : message}`;
    if (statusCode >= 500) {
      this.logger.error(logMessage, exception.stack);
    } else {
      this.logger.warn(logMessage);
    }

    response.status(statusCode).json({
      statusCode,
      error: errorName,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private statusToError(status: number): string {
    const map: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      410: 'Gone',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return map[status] || 'Error';
  }
}
