import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  requestId: string | null;
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: unknown }>();
    const response = http.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, details } = this.describe(exception, statusCode);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponse = {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      ...(details === undefined ? {} : { details }),
      requestId: request.id === undefined ? null : String(request.id),
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private describe(
    exception: unknown,
    statusCode: number,
  ): { message: string; details?: unknown } {
    if (
      !(exception instanceof HttpException) ||
      statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      return { message: 'Internal server error' };
    }

    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { message: payload };
    }

    const { message, details } = payload as {
      message?: string | string[];
      details?: unknown;
    };

    if (Array.isArray(message)) {
      return { message: 'Validation failed', details: details ?? message };
    }

    return { message: message ?? exception.message, details };
  }
}
