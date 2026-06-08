import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { z } from 'zod';
import { IPortAdapter } from '@shared/port/port.interface';

/**
 * Auth Port Interface
 *
 * Defines the contract for downstream auth service communication.
 * MockAuthAdapter returns mock data during development.
 * Live adapter will call the actual backend auth service.
 */
export interface IAuthPort extends IPortAdapter {
  // Methods: login, register, verify-otp
}

/**
 * Zod schemas for mock auth responses
 */
export const LoginResponseSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(['customer', 'admin']),
  status: z.enum(['active', 'suspended', 'deleted']),
  sessionId: z.string().uuid(),
  expiresAt: z.string(),
});

export const RegisterResponseSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(['customer', 'admin']),
  status: z.enum(['active', 'suspended', 'deleted']),
  isNewUser: z.boolean(),
});

export const VerifyOtpResponseSchema = z.object({
  userId: z.string().uuid(),
  phone: z.string(),
  isVerified: z.boolean(),
  isNewUser: z.boolean(),
});

/**
 * Mock Auth Adapter
 *
 * Returns mock auth responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockAuthAdapter extends MockAdapterBase implements IAuthPort {
  constructor() {
    super(
      'auth',
      {
        login: LoginResponseSchema,
        register: RegisterResponseSchema,
        'verify-otp': VerifyOtpResponseSchema,
      },
      new Logger('auth-mock-adapter'),
    );
  }
}
