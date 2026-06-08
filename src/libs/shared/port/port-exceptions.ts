/**
 * Port Exception Classes
 *
 * Typed exceptions for the Hexagonal Port infrastructure.
 * Extends BaseException from the domain layer for consistent error handling.
 *
 * Replaces generic `new Error()` calls with typed exceptions that:
 * - Carry machine-readable `code` and `details` fields
 * - Support `instanceof` checks for upstream exception filters
 * - Preserve error chains via `cause`
 */

import { BaseException } from '../../core/common/exceptions';

/**
 * Base exception for all port-related errors.
 */
export class PortException extends BaseException {
  constructor(message: string, code?: string, details?: Record<string, unknown>) {
    super(message, code ?? 'PORT_ERROR', details);
  }
}

/**
 * Thrown when a downstream service returns a non-ok HTTP response.
 * Carries the status code so callers and circuit breakers can distinguish
 * client errors (4xx) from infrastructure failures (5xx).
 */
export class PortDownstreamException extends PortException {
  /** HTTP status code from the downstream response */
  readonly statusCode: number;
  /** HTTP status text from the downstream response */
  readonly statusText: string;
  /** Port name that made the call */
  readonly portName: string;
  /** Full URL that was called */
  readonly url: string;

  constructor(portName: string, statusCode: number, statusText: string, url: string) {
    super(
      `Downstream call failed [${portName}]: ${statusCode} ${statusText}`,
      'PORT_DOWNSTREAM_ERROR',
      { portName, statusCode, statusText, url },
    );
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.portName = portName;
    this.url = url;
  }
}

/**
 * Thrown when a downstream call exceeds the configured timeout.
 */
export class PortTimeoutException extends PortException {
  /** Port name that timed out */
  readonly portName: string;
  /** Configured timeout in milliseconds */
  readonly timeout: number;

  constructor(portName: string, timeout: number) {
    super(
      `Request timeout [${portName}] after ${timeout}ms`,
      'PORT_TIMEOUT',
      { portName, timeout },
    );
    this.portName = portName;
    this.timeout = timeout;
  }
}

/**
 * Thrown when a port name is not found in the registry.
 */
export class PortNotRegisteredException extends PortException {
  /** Port name that was not registered */
  readonly portName: string;

  constructor(portName: string) {
    super(
      `Port not registered: ${portName}`,
      'PORT_NOT_REGISTERED',
      { portName },
    );
    this.portName = portName;
  }
}

/**
 * Thrown when both the primary call and the fallback fail.
 * Preserves the original error via `cause` for upstream inspection.
 */
export class PortFallbackException extends PortException {
  /** Port name that failed */
  readonly portName: string;

  constructor(portName: string, originalError?: Error) {
    const message = originalError
      ? `Port call and fallback both failed [${portName}]: ${originalError.message}`
      : `Port fallback failed [${portName}]: no cached fallback available`;

    super(
      message,
      'PORT_FALLBACK_FAILED',
      {
        portName,
        originalError: originalError?.message,
      },
    );
    this.portName = portName;

    if (originalError) {
      this.cause = originalError;
    }
  }
}
