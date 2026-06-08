/**
 * MockAdapterBase Tests
 *
 * AC: #2 (MOCK_MODE), #6 (Contract Validation Gate)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { MockAdapterBase } from './mock-adapter.base';

// Concrete test implementation
class TestMockAdapter extends MockAdapterBase {
  constructor(schemas: Record<string, z.ZodType<unknown>>) {
    super('test-port', schemas);
  }
}

describe('MockAdapterBase', () => {
  let adapter: TestMockAdapter;
  const mockDir = path.resolve(process.cwd(), 'mocks', 'test-port');

  const simpleSchema = z.object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
  });

  beforeAll(() => {
    // Create test mock directory and files
    fs.mkdirSync(mockDir, { recursive: true });

    // Valid mock data
    fs.writeFileSync(
      path.join(mockDir, 'get-item.json'),
      JSON.stringify({ id: 'TEST-001', name: 'Test Item', value: 42 }),
    );

    // Invalid mock data (schema mismatch)
    fs.writeFileSync(
      path.join(mockDir, 'invalid-item.json'),
      JSON.stringify({ id: 'TEST-002', name: 123, value: 'not-a-number' }),
    );
  });

  afterAll(() => {
    // Cleanup test mock files
    fs.rmSync(mockDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    adapter = new TestMockAdapter({
      'get-item': simpleSchema,
      'invalid-item': simpleSchema,
    });
  });

  describe('execute — JSON read + Zod validation pass', () => {
    it('should read JSON file and return validated data', async () => {
      const result = await adapter.execute('get-item', {});

      expect(result).toEqual({
        id: 'TEST-001',
        name: 'Test Item',
        value: 42,
      });
    });
  });

  describe('execute — Zod validation failure (non-production)', () => {
    it('should throw fatal error when Zod schema does not match in non-prod', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await expect(adapter.execute('invalid-item', {})).rejects.toThrow(
        'Mock contract violation [test-port/invalid-item]',
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('execute — Zod validation failure (production)', () => {
    it('should log warning and return raw data in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = await adapter.execute('invalid-item', {});

      // Returns raw data (graceful degradation)
      expect(result).toEqual({ id: 'TEST-002', name: 123, value: 'not-a-number' });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('execute — no schema defined', () => {
    it('should return raw data when no schema exists for the method', async () => {
      // Create a file for an unschemad method
      fs.writeFileSync(
        path.join(mockDir, 'no-schema.json'),
        JSON.stringify({ anything: 'goes' }),
      );

      const noSchemaAdapter = new TestMockAdapter({});
      const result = await noSchemaAdapter.execute('no-schema', {});

      expect(result).toEqual({ anything: 'goes' });
    });
  });

  describe('execute — file not found', () => {
    it('should throw error when mock file does not exist', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow(
        'Mock file not found or invalid JSON [test-port/nonexistent]',
      );
    });
  });
});
