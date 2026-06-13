import { TicketWebhookController } from './ticket-webhook.controller';
import { ValidationException } from '@core/common';
import { HandleTicketWebhookCommand } from '../../application/commands/handle-ticket-webhook.command';
import { InterServiceApiKeyGuard } from '@shared/security';

function mockBuses() {
  return { commandBus: { execute: jest.fn() }, queryBus: { execute: jest.fn() } };
}

describe('TicketWebhookController', () => {
  let controller: TicketWebhookController;
  let buses: ReturnType<typeof mockBuses>;

  const validPayload = {
    ticketId: 'TICK-001',
    trackingId: 'TK-2026-002',
    customerId: 'USR-001',
    oldStatus: 'assigned',
    newStatus: 'in_progress',
    updatedAt: '2026-06-10T11:00:00Z',
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new TicketWebhookController(buses.commandBus as any);
  });

  // ── POST /webhooks/ticket/status (AC#3) ─────────────────────────────────────

  describe('POST /webhooks/ticket/status', () => {
    it('should return { received: true } on valid payload', async () => {
      buses.commandBus.execute.mockResolvedValue(undefined);

      const result = await controller.handleTicketStatus(validPayload);

      expect(result).toEqual({ received: true });
    });

    it('should dispatch HandleTicketWebhookCommand', async () => {
      buses.commandBus.execute.mockResolvedValue(undefined);

      await controller.handleTicketStatus(validPayload);

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(HandleTicketWebhookCommand);
      expect(callArg.payload.ticketId).toBe('TICK-001');
      expect(callArg.payload.trackingId).toBe('TK-2026-002');
      expect(callArg.payload.customerId).toBe('USR-001');
      expect(callArg.payload.oldStatus).toBe('assigned');
      expect(callArg.payload.newStatus).toBe('in_progress');
    });

    it('should throw ValidationException for missing ticketId', async () => {
      await expect(
        controller.handleTicketStatus({ ...validPayload, ticketId: undefined }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing trackingId', async () => {
      await expect(
        controller.handleTicketStatus({ ...validPayload, trackingId: undefined }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing customerId', async () => {
      await expect(
        controller.handleTicketStatus({ ...validPayload, customerId: undefined }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid oldStatus', async () => {
      await expect(
        controller.handleTicketStatus({ ...validPayload, oldStatus: 'unknown' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid newStatus', async () => {
      await expect(
        controller.handleTicketStatus({ ...validPayload, newStatus: 'pending' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing updatedAt', async () => {
      await expect(
        controller.handleTicketStatus({ ...validPayload, updatedAt: undefined }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty body', async () => {
      await expect(
        controller.handleTicketStatus({}),
      ).rejects.toThrow(ValidationException);
    });

    it('should accept all valid status transitions', async () => {
      const statuses = ['submitted', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
      buses.commandBus.execute.mockResolvedValue(undefined);

      for (const status of statuses) {
        const payload = { ...validPayload, oldStatus: status, newStatus: 'closed' };
        const result = await controller.handleTicketStatus(payload);
        expect(result).toEqual({ received: true });
      }

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(5);
    });
  });

  // ── Guard verification (AC#3 — InterServiceApiKeyGuard) ──────────────────────

  describe('Auth protection', () => {
    it('should have @UseGuards(InterServiceApiKeyGuard) decorator', () => {
      const guards = Reflect.getMetadata('__guards__', TicketWebhookController);
      expect(guards).toBeDefined();
      expect(guards.some((g: any) => g === InterServiceApiKeyGuard)).toBe(true);
    });
  });

  // ── Command class type verification ─────────────────────────────────────────

  describe('Command class types', () => {
    it('should dispatch HandleTicketWebhookCommand from POST /webhooks/ticket/status', async () => {
      buses.commandBus.execute.mockResolvedValue(undefined);

      await controller.handleTicketStatus(validPayload);

      expect(buses.commandBus.execute.mock.calls[0][0]).toBeInstanceOf(HandleTicketWebhookCommand);
    });
  });
});
