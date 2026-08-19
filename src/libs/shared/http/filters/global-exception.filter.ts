import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  BaseException,
  DomainException,
  ValidationException,
  ConcurrencyException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from 'src/libs/core/common';

/**
 * Global Exception Filter
 *
 * Catches all exceptions and transforms them into standardized HTTP responses
 * Maps domain exceptions to appropriate HTTP status codes
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, response, request);
    }

    // Handle custom domain exceptions
    if (exception instanceof BaseException) {
      return this.handleBaseException(exception, response, request);
    }

    // Handle unknown errors
    return this.handleUnknownError(exception, response, request);
  }

  private handleHttpException(
    exception: HttpException,
    response: FastifyReply,
    request: FastifyRequest,
  ) {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const isString = typeof exceptionResponse === 'string';
    const respObj = isString ? null : (exceptionResponse as any);
    const message = isString
      ? exceptionResponse
      : Array.isArray(respObj?.message)
        ? respObj.message.join(', ')
        : respObj?.message || exception.message;

    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      // P1-D1 (R0): error là object {code, detail} khớp FE Zod apiErrorSchema
      error: {
        code: respObj?.code || this.statusToCode(status),
        detail: null,
      },
      message,
    };

    response.status(status).send(errorResponse);
  }

  private handleBaseException(
    exception: BaseException,
    response: FastifyReply,
    request: FastifyRequest,
  ) {
    const status = this.getHttpStatus(exception);
    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      // P1-D1 (R0): error object {code, detail}; code = BaseException.code
      error: {
        code: exception.code,
        detail: exception.details ? JSON.stringify(exception.details) : null,
      },
      message: exception.message,
    };

    response.status(status).send(errorResponse);
  }

  private handleUnknownError(
    exception: unknown,
    response: FastifyReply,
    request: FastifyRequest,
  ) {
    const error =
      exception instanceof Error ? exception : new Error('Unknown error');
    const isDevelopment = process.env.NODE_ENV !== 'production';

    const errorResponse = {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      // P1-D1 (R0): error object {code, detail}
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        detail: isDevelopment ? (error.stack ?? null) : null,
      },
      message: isDevelopment ? error.message : 'An unexpected error occurred',
    };

    if (!isDevelopment) {
      console.error('Unhandled exception:', error);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(errorResponse);
  }

  /**
   * Map HTTP status → mã lỗi nghiệp vụ chuẩn cho FE (P1-D1).
   * Dùng khi exception là NestJS HttpException (không có domain code).
   */
  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'INVALID_TRANSITION';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR';
    }
  }

  private getHttpStatus(exception: BaseException): number {
    if (exception instanceof NotFoundException) {
      return HttpStatus.NOT_FOUND;
    }
    if (exception instanceof UnauthorizedException) {
      return HttpStatus.UNAUTHORIZED;
    }
    if (exception instanceof ForbiddenException) {
      return HttpStatus.FORBIDDEN;
    }
    if (exception instanceof ConflictException) {
      return HttpStatus.CONFLICT;
    }
    if (exception instanceof ConcurrencyException) {
      return HttpStatus.CONFLICT;
    }
    if (exception instanceof ValidationException) {
      return HttpStatus.BAD_REQUEST;
    }
    if (exception instanceof DomainException) {
      return HttpStatus.BAD_REQUEST;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
