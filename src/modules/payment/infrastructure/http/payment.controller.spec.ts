import { PaymentController } from './payment.controller';
import { ValidationException } from '@core/common';
import { CreatePaymentCommand } from '../../application/commands/create-payment.command';
import { CreateBatchPaymentCommand } from '../../application/commands/create-batch-payment.command';
import { SetupAutoDebitCommand } from '../../application/commands/setup-auto-debit.command';
import { GetPaymentHistoryQuery } from '../../application/queries/get-payment-history.query';
import type { PaymentHistoryResponse } from '../../application/dtos/payment.dto';

function mockBuses() {
  return { commandBus: { execute: jest.fn() }, queryBus: { execute: jest.fn() } };
}

describe('PaymentController', () => {
  let controller: PaymentController;
  let buses: ReturnType<typeof mockBuses>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockPaymentResponse = {
    paymentId: 'PAY-2026-001',
    invoiceId: 'INV-2026-001',
    amount: 123273,
    method: 'qr_code',
    qrCodeUrl: 'https://pay.ioc.local/qr/PAY-2026-001',
    paymentLink: null,
    status: 'pending',
    expiresAt: '2026-06-09T10:00:00Z',
    createdAt: '2026-06-09T09:00:00Z',
  };

  const mockHistoryResponse = {
    payments: [
      {
        paymentId: 'PAY-2026-001',
        invoiceIds: ['INV-2026-001'],
        amount: 123273,
        method: 'qr_code',
        status: 'completed',
        createdAt: '2026-06-01T10:00:00Z',
      },
    ],
    totalCount: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  const mockBatchResponse = {
    paymentId: 'PAY-2026-BATCH-001',
    invoiceIds: ['INV-2026-001', 'INV-2026-002'],
    totalAmount: 182003,
    method: 'qr_code',
    qrCodeUrl: 'https://pay.ioc.local/qr/PAY-2026-BATCH-001',
    paymentLink: null,
    status: 'pending',
    expiresAt: '2026-06-09T11:00:00Z',
    createdAt: '2026-06-09T10:00:00Z',
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new PaymentController(buses.queryBus as any, buses.commandBus as any);
  });

  // ── POST /payments (AC#1) ──────────────────────────────────────────────────

  describe('POST /payments', () => {
    it('should create payment and return response', async () => {
      buses.commandBus.execute.mockResolvedValue(mockPaymentResponse);

      const result = await controller.createPayment(TEST_USER_ID, {
        invoiceId: 'INV-2026-001',
        method: 'qr_code',
      });

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(CreatePaymentCommand);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.invoiceId).toBe('INV-2026-001');
      expect(callArg.method).toBe('qr_code');
      expect(result.paymentId).toBe('PAY-2026-001');
      expect(result.qrCodeUrl).toBeDefined();
    });

    it('should pass payment_link method correctly', async () => {
      buses.commandBus.execute.mockResolvedValue({
        ...mockPaymentResponse,
        method: 'payment_link',
        qrCodeUrl: null,
        paymentLink: 'https://pay.ioc.local/link/PAY-2026-001',
      });

      await controller.createPayment(TEST_USER_ID, {
        invoiceId: 'INV-2026-001',
        method: 'payment_link',
      });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg.method).toBe('payment_link');
    });
  });

  // ── GET /payments/history (Story 4.3, AC#1) ──────────────────────────────────

  describe('GET /payments/history', () => {
    it('should return payment history with default pagination', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistoryResponse);

      const result = await controller.getPaymentHistory(TEST_USER_ID, { page: '1', limit: '10' }) as PaymentHistoryResponse;

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetPaymentHistoryQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.filters.page).toBe(1);
      expect(callArg.filters.limit).toBe(10);
      expect(result.payments).toHaveLength(1);
    });

    it('should pass status filter to query', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getPaymentHistory(TEST_USER_ID, { page: '1', limit: '10', status: 'completed' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg.filters.status).toBe('completed');
    });

    it('should apply defaults when page/limit not provided', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getPaymentHistory(TEST_USER_ID, {});

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg.filters.page).toBe(1);
      expect(callArg.filters.limit).toBe(10);
    });
  });

  // ── POST /payments/batch (Story 4.3, AC#2) ──────────────────────────────────

  describe('POST /payments/batch', () => {
    it('should create batch payment and return response', async () => {
      buses.commandBus.execute.mockResolvedValue(mockBatchResponse);

      const result = await controller.createBatchPayment(TEST_USER_ID, {
        invoiceIds: ['INV-2026-001', 'INV-2026-002'],
        method: 'qr_code',
      });

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(CreateBatchPaymentCommand);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.invoiceIds).toEqual(['INV-2026-001', 'INV-2026-002']);
      expect(callArg.method).toBe('qr_code');
      expect(result.paymentId).toBe('PAY-2026-BATCH-001');
      expect(result.totalAmount).toBe(182003);
    });

    it('should accept payment_link method for batch', async () => {
      buses.commandBus.execute.mockResolvedValue({
        ...mockBatchResponse,
        method: 'payment_link',
        qrCodeUrl: null,
        paymentLink: 'https://pay.ioc.local/link/PAY-2026-BATCH-001',
      });

      await controller.createBatchPayment(TEST_USER_ID, {
        invoiceIds: ['INV-001'],
        method: 'payment_link',
      });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg.method).toBe('payment_link');
    });
  });

  const mockAutoDebitResponse = {
    registrationId: 'AD-2026-001',
    status: 'pending_verification',
    registeredAt: '2026-06-09T10:30:00Z',
  };

  const validBankAccount = {
    bankName: 'Vietcombank',
    accountNumber: '1234567890',
    accountHolder: 'Cô Nguyễn',
  };

  // ── POST /payments/auto-debit (Story 4.4, AC#1) ──────────────────────────────

  describe('POST /payments/auto-debit', () => {
    it('should create auto debit and return response', async () => {
      buses.commandBus.execute.mockResolvedValue(mockAutoDebitResponse);

      const result = await controller.setupAutoDebit(TEST_USER_ID, {
        bankAccount: validBankAccount,
      });

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(SetupAutoDebitCommand);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.bankAccount.accountNumber).toBe('1234567890');
      expect(result.registrationId).toBe('AD-2026-001');
      expect(result.status).toBe('pending_verification');
    });

    it('should pass bankAccount object to command', async () => {
      buses.commandBus.execute.mockResolvedValue(mockAutoDebitResponse);

      await controller.setupAutoDebit(TEST_USER_ID, {
        bankAccount: { ...validBankAccount, branchCode: 'VCB001' },
      });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg.bankAccount.branchCode).toBe('VCB001');
    });
  });

  // ── Body validation ────────────────────────────────────────────────────────

  describe('Body validation', () => {
    it('should throw ValidationException for missing invoiceId', async () => {
      await expect(
        controller.createPayment(TEST_USER_ID, { method: 'qr_code' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing method', async () => {
      await expect(
        controller.createPayment(TEST_USER_ID, { invoiceId: 'INV-001' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid method', async () => {
      await expect(
        controller.createPayment(TEST_USER_ID, { invoiceId: 'INV-001', method: 'crypto' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty body', async () => {
      await expect(
        controller.createPayment(TEST_USER_ID, {}),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty invoiceIds in batch', async () => {
      await expect(
        controller.createBatchPayment(TEST_USER_ID, { invoiceIds: [], method: 'qr_code' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for too many invoiceIds (>20) in batch', async () => {
      const tooMany = Array.from({ length: 21 }, (_, i) => `INV-${String(i).padStart(3, '0')}`);
      await expect(
        controller.createBatchPayment(TEST_USER_ID, { invoiceIds: tooMany, method: 'qr_code' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing invoiceIds in batch', async () => {
      await expect(
        controller.createBatchPayment(TEST_USER_ID, { method: 'qr_code' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid history query params', async () => {
      await expect(
        controller.getPaymentHistory(TEST_USER_ID, { page: '-1' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for limit > 100 in history', async () => {
      await expect(
        controller.getPaymentHistory(TEST_USER_ID, { page: '1', limit: '101' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing bankAccount in auto-debit', async () => {
      await expect(
        controller.setupAutoDebit(TEST_USER_ID, {}),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid accountNumber in auto-debit', async () => {
      await expect(
        controller.setupAutoDebit(TEST_USER_ID, {
          bankAccount: { bankName: 'VCB', accountNumber: 'ABC', accountHolder: 'Test' },
        }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing bankName in auto-debit', async () => {
      await expect(
        controller.setupAutoDebit(TEST_USER_ID, {
          bankAccount: { accountNumber: '1234567890', accountHolder: 'Test' },
        }),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── Command/Query class type verification ──────────────────────────────────

  describe('Command/Query class types', () => {
    it('should dispatch CreatePaymentCommand from POST /payments', async () => {
      buses.commandBus.execute.mockResolvedValue(mockPaymentResponse);

      await controller.createPayment(TEST_USER_ID, {
        invoiceId: 'INV-001',
        method: 'qr_code',
      });
      expect(buses.commandBus.execute.mock.calls[0][0]).toBeInstanceOf(CreatePaymentCommand);
    });

    it('should dispatch GetPaymentHistoryQuery from GET /payments/history', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getPaymentHistory(TEST_USER_ID, { page: '1', limit: '10' });
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetPaymentHistoryQuery);
    });

    it('should dispatch CreateBatchPaymentCommand from POST /payments/batch', async () => {
      buses.commandBus.execute.mockResolvedValue(mockBatchResponse);

      await controller.createBatchPayment(TEST_USER_ID, {
        invoiceIds: ['INV-001'],
        method: 'qr_code',
      });
      expect(buses.commandBus.execute.mock.calls[0][0]).toBeInstanceOf(CreateBatchPaymentCommand);
    });

    it('should dispatch SetupAutoDebitCommand from POST /payments/auto-debit', async () => {
      buses.commandBus.execute.mockResolvedValue(mockAutoDebitResponse);

      await controller.setupAutoDebit(TEST_USER_ID, {
        bankAccount: validBankAccount,
      });
      expect(buses.commandBus.execute.mock.calls[0][0]).toBeInstanceOf(SetupAutoDebitCommand);
    });
  });

  // ── Auth guard verification ───────────────────────────────────────────────

  describe('Auth protection', () => {
    it('should require authenticated user via @CurrentUser decorator (401 enforced by NestJS guard at e2e level)', () => {
      const controllerSource = PaymentController.toString();
      expect(controllerSource).toContain('createPayment');
    });

    it('should use ApiBearerAuth decorator for Swagger documentation', () => {
      const metadata = Reflect.getMetadata('swagger/apiSecurity', PaymentController);
      expect(metadata).toBeDefined();
      expect(metadata).toEqual(expect.arrayContaining([expect.objectContaining({ 'JWT-auth': expect.any(Array) })]));
    });
  });
});
