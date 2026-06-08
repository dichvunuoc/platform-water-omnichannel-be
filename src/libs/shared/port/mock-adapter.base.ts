/**
 * MockAdapter Base Class
 *
 * Reads JSON from mocks/{portName}/{methodName}.json,
 * validates against Zod schema, and returns normalized data.
 *
 * AC: #2 (MOCK_MODE Override), #6 (Contract Validation Gate)
 */

import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import type { ZodType } from 'zod';
import type { IPortAdapter } from './port.interface';
import { NotFoundException, ValidationException } from '../../core/common/exceptions';

/**
 * Abstract base class for mock adapters.
 * Concrete adapters extend this and provide port-specific Zod schemas.
 *
 * Usage:
 * ```typescript
 * class InvoiceMockAdapter extends MockAdapterBase {
 *   constructor(logger: Logger) {
 *     super('invoice', { 'get-list': InvoiceListSchema, 'get-detail': InvoiceDetailSchema }, logger);
 *   }
 * }
 * ```
 */
export abstract class MockAdapterBase implements IPortAdapter {
  protected readonly logger: Logger;

  constructor(
    protected readonly portName: string,
    protected readonly schemas: Record<string, ZodType<unknown>>,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(`${portName}-mock-adapter`);
  }

  /**
   * Execute a mock method — read JSON file, validate against Zod schema.
   * Fix #7: Uses async fs.promises.readFile to avoid blocking the event loop.
   *
   * AC: #6 — In non-production, Zod validation failure throws fatal error (fail-to-start).
   * In production, logs warning and returns raw data (graceful degradation).
   */
  async execute(method: string, _params: Record<string, unknown>): Promise<unknown> {
    const filePath = path.resolve(process.cwd(), 'mocks', this.portName, `${method}.json`);

    this.logger.debug(`Reading mock file: ${filePath}`);

    let rawData: unknown;
    try {
      const fileContent = await fsPromises.readFile(filePath, 'utf-8');
      rawData = JSON.parse(fileContent);
    } catch (error) {
      throw new NotFoundException(
        `Mock file not found or invalid JSON [${this.portName}/${method}]: ${(error as Error).message}`,
        'MOCK_FILE_NOT_FOUND',
        { portName: this.portName, method },
      );
    }

    // Validate against Zod schema if one exists for this method
    const schema = this.schemas[method];
    if (schema) {
      const result = schema.safeParse(rawData);
      if (!result.success) {
        const errorMsg = `Mock contract violation [${this.portName}/${method}]: ${result.error.message}`;

        // AC: #6 — Fail-to-start in non-production
        if (process.env.NODE_ENV !== 'production') {
          throw new ValidationException(errorMsg);
        }

        // In production: log warning, return raw data (graceful)
        this.logger.warn(errorMsg);
        return rawData;
      }
      return result.data;
    }

    // No schema defined for this method — return raw data
    return rawData;
  }
}
