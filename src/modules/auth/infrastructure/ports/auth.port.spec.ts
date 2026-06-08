import { MockAuthAdapter, LoginResponseSchema, RegisterResponseSchema, VerifyOtpResponseSchema } from './auth.port';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

describe('MockAuthAdapter', () => {
  let adapter: MockAuthAdapter;

  beforeEach(() => {
    adapter = new MockAuthAdapter();
  });

  describe('execute - login', () => {
    it('should read and validate login.json mock data', async () => {
      const result = await adapter.execute('login', {});

      expect(result).toBeDefined();
      // Validate against schema
      const parsed = LoginResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.userId).toBeDefined();
        expect(parsed.data.role).toBe('customer');
        expect(parsed.data.status).toBe('active');
        expect(parsed.data.sessionId).toBeDefined();
      }
    });
  });

  describe('execute - register', () => {
    it('should read and validate register.json mock data', async () => {
      const result = await adapter.execute('register', {});

      expect(result).toBeDefined();
      const parsed = RegisterResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.userId).toBeDefined();
        expect(parsed.data.isNewUser).toBe(true);
      }
    });
  });

  describe('execute - verify-otp', () => {
    it('should read and validate verify-otp.json mock data', async () => {
      const result = await adapter.execute('verify-otp', {});

      expect(result).toBeDefined();
      const parsed = VerifyOtpResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.isVerified).toBe(true);
        expect(parsed.data.phone).toBeDefined();
      }
    });
  });

  describe('execute - missing method', () => {
    it('should throw NotFoundException for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  describe('Zod schemas validation', () => {
    it('LoginResponseSchema should reject invalid data', () => {
      const result = LoginResponseSchema.safeParse({
        userId: 'not-a-uuid',
        // missing required fields
      });
      expect(result.success).toBe(false);
    });

    it('RegisterResponseSchema should reject invalid role', () => {
      const result = RegisterResponseSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test',
        phone: '0901234567',
        email: null,
        role: 'superadmin', // invalid
        status: 'active',
        isNewUser: true,
      });
      expect(result.success).toBe(false);
    });

    it('VerifyOtpResponseSchema should accept valid data', () => {
      const result = VerifyOtpResponseSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        phone: '0901234567',
        isVerified: true,
        isNewUser: false,
      });
      expect(result.success).toBe(true);
    });
  });
});
