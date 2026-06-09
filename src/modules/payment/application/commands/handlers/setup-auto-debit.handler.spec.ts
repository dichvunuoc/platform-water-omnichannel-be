import { SetupAutoDebitHandler } from './setup-auto-debit.handler';
import { SetupAutoDebitCommand } from '../setup-auto-debit.command';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { SetupAutoDebitResponse } from '../../dtos/payment.dto';
import type { BankAccount } from '../../dtos/payment.dto';

describe('SetupAutoDebitHandler', () => {
  let handler: SetupAutoDebitHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockBankAccount: BankAccount = {
    bankName: 'Vietcombank',
    accountNumber: '1234567890',
    accountHolder: 'Nguyen Van A',
    branchCode: 'VCB001',
  };

  const mockResponse: SetupAutoDebitResponse = {
    registrationId: 'AD-2026-001',
    status: 'pending_verification',
    registeredAt: '2026-06-09T10:30:00Z',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new SetupAutoDebitHandler(portRegistry);
  });

  // ── AC#1: Successful auto debit registration ──────────────────────────────────

  describe('successful auto debit registration', () => {
    it('should call portRegistry with customerId and bankAccount', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(
        new SetupAutoDebitCommand('USR-001', mockBankAccount),
      );

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'payment',
        'setup-auto-debit',
        { customerId: 'USR-001', bankAccount: mockBankAccount },
      );

      expect(result.registrationId).toBe('AD-2026-001');
      expect(result.status).toBe('pending_verification');
    });

    it('should return active status when port returns active', async () => {
      portRegistry.execute.mockResolvedValue({
        data: { ...mockResponse, status: 'active' },
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(
        new SetupAutoDebitCommand('USR-001', mockBankAccount),
      );

      expect(result.status).toBe('active');
    });

    it('should pass bankAccount object correctly', async () => {
      portRegistry.execute.mockResolvedValue({
        data: mockResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await handler.execute(
        new SetupAutoDebitCommand('USR-001', mockBankAccount),
      );

      const callArgs = portRegistry.execute.mock.calls[0][2] as Record<string, unknown>;
      expect(callArgs.bankAccount).toEqual(mockBankAccount);
    });
  });

  // ── Null guard ─────────────────────────────────────────────────────────────────

  describe('null guard', () => {
    it('should throw NotFoundException when port returns null data', async () => {
      portRegistry.execute.mockResolvedValue({
        data: null,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      await expect(
        handler.execute(new SetupAutoDebitCommand('USR-001', mockBankAccount)),
      ).rejects.toThrow('Auto debit registration failed — no response from payment service');
    });
  });
});
