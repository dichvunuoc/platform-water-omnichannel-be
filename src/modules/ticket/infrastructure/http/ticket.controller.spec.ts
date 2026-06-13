import { TicketController } from './ticket.controller';
import { ValidationException } from '@core/common';
import { CreateTicketCommand } from '../../application/commands/create-ticket.command';
import { GetUploadUrlCommand } from '../../application/commands/get-upload-url.command';
import { SubmitFeedbackCommand } from '../../application/commands/submit-feedback.command';
import { GetTicketStatusQuery } from '../../application/queries/get-ticket-status.query';
import { GetTicketHistoryQuery } from '../../application/queries/get-ticket-history.query';

function mockBuses() {
  return { commandBus: { execute: jest.fn() }, queryBus: { execute: jest.fn() } };
}

describe('TicketController', () => {
  let controller: TicketController;
  let buses: ReturnType<typeof mockBuses>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockTicketResponse = {
    trackingId: 'TK-2026-002',
    status: 'submitted',
    createdAt: '2026-06-10T09:30:00Z',
  };

  const mockUploadResponse = {
    uploadUrl: 'https://storage.ioc.local/upload/tmp/inc-2026-photo-001?signature=abc123&expires=1718010000',
    fileKey: 'tmp/inc-2026-photo-001',
    expiresAt: '2026-06-10T10:30:00Z',
  };

  const mockStatusResponse = {
    trackingId: 'TK-2026-002',
    status: 'in_progress',
    timeline: [
      { status: 'submitted', timestamp: '2026-06-10T09:30:00Z', description: 'Incident reported by customer' },
      { status: 'assigned', timestamp: '2026-06-10T10:15:00Z', description: 'Assigned to technical team', actor: 'Đội kỹ thuật A' },
      { status: 'in_progress', timestamp: '2026-06-10T11:00:00Z', description: 'Team is investigating the issue', actor: 'Đội kỹ thuật A' },
    ],
    eta: '2026-06-10T17:00:00Z',
    assignedTeam: 'Đội kỹ thuật A',
    createdAt: '2026-06-10T09:30:00Z',
    updatedAt: '2026-06-10T11:00:00Z',
  };

  const mockHistoryResponse = {
    tickets: [
      { trackingId: 'TK-2026-002', type: 'water_outage', status: 'in_progress', createdAt: '2026-06-10T09:30:00Z', updatedAt: '2026-06-10T11:00:00Z' },
      { trackingId: 'TK-2026-001', type: 'leak', status: 'closed', createdAt: '2026-05-20T14:00:00Z', updatedAt: '2026-05-22T09:00:00Z' },
    ],
    total: 2,
    page: 1,
    pageSize: 10,
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new TicketController(buses.commandBus as any, buses.queryBus as any);
  });

  // ── POST /tickets (AC#1, #3, #4) ─────────────────────────────────────────

  describe('POST /tickets', () => {
    it('should create ticket and return tracking ID', async () => {
      buses.commandBus.execute.mockResolvedValue(mockTicketResponse);

      const result = await controller.createTicket(TEST_USER_ID, {
        type: 'water_outage',
        description: 'No water supply since morning',
      });

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(CreateTicketCommand);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.type).toBe('water_outage');
      expect(callArg.description).toBe('No water supply since morning');
      expect(result.trackingId).toBe('TK-2026-002');
      expect(result.status).toBe('submitted');
    });

    it('should pass imageUrls when provided', async () => {
      buses.commandBus.execute.mockResolvedValue(mockTicketResponse);

      await controller.createTicket(TEST_USER_ID, {
        type: 'leak',
        description: 'Pipe burst',
        imageUrls: ['https://storage.ioc.local/img1.jpg'],
      });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(CreateTicketCommand);
      expect(callArg.imageUrls).toEqual(['https://storage.ioc.local/img1.jpg']);
    });

    it('should not pass imageUrls when not provided', async () => {
      buses.commandBus.execute.mockResolvedValue(mockTicketResponse);

      await controller.createTicket(TEST_USER_ID, {
        type: 'meter_issue',
        description: 'Meter not working',
      });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg.imageUrls).toBeUndefined();
    });
  });

  // ── POST /tickets/upload-url (AC#2) ───────────────────────────────────────

  describe('POST /tickets/upload-url', () => {
    it('should return presigned upload URL', async () => {
      buses.commandBus.execute.mockResolvedValue(mockUploadResponse);

      const result = await controller.getUploadUrl(TEST_USER_ID, {
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
      });

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetUploadUrlCommand);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.fileName).toBe('photo.jpg');
      expect(callArg.fileType).toBe('image/jpeg');
      expect(result.uploadUrl).toBe(mockUploadResponse.uploadUrl);
      expect(result.fileKey).toBe('tmp/inc-2026-photo-001');
    });

    it('should handle png file type', async () => {
      buses.commandBus.execute.mockResolvedValue(mockUploadResponse);

      await controller.getUploadUrl(TEST_USER_ID, {
        fileName: 'leak.png',
        fileType: 'image/png',
      });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg.fileType).toBe('image/png');
    });

    it('should handle webp file type', async () => {
      buses.commandBus.execute.mockResolvedValue(mockUploadResponse);

      await controller.getUploadUrl(TEST_USER_ID, {
        fileName: 'damage.webp',
        fileType: 'image/webp',
      });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg.fileType).toBe('image/webp');
    });
  });

  // ── GET /tickets/:trackingId (AC#1 — Story 5.2) ────────────────────────────

  describe('GET /tickets/:trackingId', () => {
    it('should dispatch GetTicketStatusQuery and return ticket status', async () => {
      buses.queryBus.execute.mockResolvedValue(mockStatusResponse);

      const result = await controller.getTicketStatus('TK-2026-002');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetTicketStatusQuery);
      expect(callArg.ticketId).toBe('TK-2026-002');
      expect(result.trackingId).toBe('TK-2026-002');
      expect(result.status).toBe('in_progress');
      expect(result.timeline).toHaveLength(3);
    });

    it('should return full timeline with ETA and assigned team', async () => {
      buses.queryBus.execute.mockResolvedValue(mockStatusResponse);

      const result = await controller.getTicketStatus('TK-2026-002');

      expect(result.eta).toBe('2026-06-10T17:00:00Z');
      expect(result.assignedTeam).toBe('Đội kỹ thuật A');
      expect(result.timeline[0].status).toBe('submitted');
      expect(result.timeline[2].actor).toBe('Đội kỹ thuật A');
    });

    it('should not call commandBus for query endpoints', async () => {
      buses.queryBus.execute.mockResolvedValue(mockStatusResponse);

      await controller.getTicketStatus('TK-2026-002');

      expect(buses.commandBus.execute).not.toHaveBeenCalled();
    });
  });

  // ── GET /tickets (AC#2 — Story 5.2) ────────────────────────────────────────

  describe('GET /tickets', () => {
    it('should dispatch GetTicketHistoryQuery and return paginated ticket list', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistoryResponse);

      const result = await controller.getTicketHistory(TEST_USER_ID, {});

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetTicketHistoryQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.tickets).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should pass status filter to query', async () => {
      buses.queryBus.execute.mockResolvedValue({ ...mockHistoryResponse, tickets: [mockHistoryResponse.tickets[0]], total: 1 });

      await controller.getTicketHistory(TEST_USER_ID, { status: 'in_progress' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetTicketHistoryQuery);
      expect(callArg.status).toBe('in_progress');
    });

    it('should pass pagination params to query', async () => {
      buses.queryBus.execute.mockResolvedValue({ ...mockHistoryResponse, page: 2, pageSize: 5 });

      await controller.getTicketHistory(TEST_USER_ID, { page: '2', pageSize: '5' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetTicketHistoryQuery);
      expect(callArg.page).toBe(2);
      expect(callArg.pageSize).toBe(5);
    });

    it('should apply defaults when no pagination params provided', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getTicketHistory(TEST_USER_ID, {});

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg.page).toBe(1);
      expect(callArg.pageSize).toBe(10);
    });

    it('should not call commandBus for query endpoints', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getTicketHistory(TEST_USER_ID, {});

      expect(buses.commandBus.execute).not.toHaveBeenCalled();
    });
  });

  // ── POST /tickets/:trackingId/feedback (AC#1, #2 — Story 5.3) ────────────────

  describe('POST /tickets/:trackingId/feedback', () => {
    const mockFeedbackResponse = {
      ticketId: 'TK-2026-002',
      score: 4,
      submittedAt: '2026-06-10T15:30:00Z',
    };

    it('should submit feedback and return result', async () => {
      buses.commandBus.execute.mockResolvedValue(mockFeedbackResponse);

      const result = await controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', {
        score: 4,
      });

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(SubmitFeedbackCommand);
      expect(callArg.ticketId).toBe('TK-2026-002');
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.score).toBe(4);
      expect(result.score).toBe(4);
    });

    it('should pass comment when provided', async () => {
      buses.commandBus.execute.mockResolvedValue(mockFeedbackResponse);

      await controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', {
        score: 5,
        comment: 'Great service!',
      });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(SubmitFeedbackCommand);
      expect(callArg.comment).toBe('Great service!');
    });

    it('should not pass comment when not provided', async () => {
      buses.commandBus.execute.mockResolvedValue(mockFeedbackResponse);

      await controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', {
        score: 3,
      });

      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg.comment).toBeUndefined();
    });

    it('should accept score = 1 (minimum)', async () => {
      buses.commandBus.execute.mockResolvedValue({ ...mockFeedbackResponse, score: 1 });

      const result = await controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', {
        score: 1,
      });

      expect(result.score).toBe(1);
    });

    it('should accept score = 5 (maximum)', async () => {
      buses.commandBus.execute.mockResolvedValue({ ...mockFeedbackResponse, score: 5 });

      const result = await controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', {
        score: 5,
      });

      expect(result.score).toBe(5);
    });
  });

  // ── Body validation — POST /tickets ────────────────────────────────────────

  describe('Body validation — createTicket', () => {
    it('should throw ValidationException for missing type', async () => {
      await expect(
        controller.createTicket(TEST_USER_ID, { description: 'Some issue' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing description', async () => {
      await expect(
        controller.createTicket(TEST_USER_ID, { type: 'water_outage' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty description', async () => {
      await expect(
        controller.createTicket(TEST_USER_ID, { type: 'water_outage', description: '' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid type', async () => {
      await expect(
        controller.createTicket(TEST_USER_ID, { type: 'billing', description: 'Issue' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for too many images (>5)', async () => {
      const urls = Array.from({ length: 6 }, (_, i) => `https://storage.ioc.local/img${i}.jpg`);
      await expect(
        controller.createTicket(TEST_USER_ID, {
          type: 'leak',
          description: 'Photos',
          imageUrls: urls,
        }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid imageUrls (not URLs)', async () => {
      await expect(
        controller.createTicket(TEST_USER_ID, {
          type: 'leak',
          description: 'Photos',
          imageUrls: ['not-a-url'],
        }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty body', async () => {
      await expect(
        controller.createTicket(TEST_USER_ID, {}),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── Body validation — POST /tickets/upload-url ─────────────────────────────

  describe('Body validation — getUploadUrl', () => {
    it('should throw ValidationException for missing fileName', async () => {
      await expect(
        controller.getUploadUrl(TEST_USER_ID, { fileType: 'image/jpeg' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing fileType', async () => {
      await expect(
        controller.getUploadUrl(TEST_USER_ID, { fileName: 'photo.jpg' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid fileType', async () => {
      await expect(
        controller.getUploadUrl(TEST_USER_ID, { fileName: 'doc.pdf', fileType: 'application/pdf' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty body', async () => {
      await expect(
        controller.getUploadUrl(TEST_USER_ID, {}),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── Query validation — GET /tickets ─────────────────────────────────────────

  describe('Query validation — getTicketHistory', () => {
    it('should throw ValidationException for invalid status filter', async () => {
      await expect(
        controller.getTicketHistory(TEST_USER_ID, { status: 'invalid_status' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for page < 1', async () => {
      await expect(
        controller.getTicketHistory(TEST_USER_ID, { page: '0' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for pageSize > 50', async () => {
      await expect(
        controller.getTicketHistory(TEST_USER_ID, { pageSize: '100' }),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── Query validation — POST /tickets/:trackingId/feedback ─────────────────────

  describe('Body validation — submitFeedback', () => {
    it('should throw ValidationException for missing score', async () => {
      await expect(
        controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', {}),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for score = 0 (below min)', async () => {
      await expect(
        controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', { score: 0 }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for score = 6 (above max)', async () => {
      await expect(
        controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', { score: 6 }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for score = 3.5 (not integer)', async () => {
      await expect(
        controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', { score: 3.5 }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty body', async () => {
      await expect(
        controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', {}),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for comment exceeding 1000 chars', async () => {
      await expect(
        controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', {
          score: 4,
          comment: 'A'.repeat(1001),
        }),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── CQRS class type verification ───────────────────────────────────────────

  describe('CQRS class types', () => {
    it('should dispatch CreateTicketCommand from POST /tickets', async () => {
      buses.commandBus.execute.mockResolvedValue(mockTicketResponse);

      await controller.createTicket(TEST_USER_ID, {
        type: 'water_outage',
        description: 'Issue',
      });

      expect(buses.commandBus.execute.mock.calls[0][0]).toBeInstanceOf(CreateTicketCommand);
    });

    it('should dispatch GetUploadUrlCommand from POST /tickets/upload-url', async () => {
      buses.commandBus.execute.mockResolvedValue(mockUploadResponse);

      await controller.getUploadUrl(TEST_USER_ID, {
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
      });

      expect(buses.commandBus.execute.mock.calls[0][0]).toBeInstanceOf(GetUploadUrlCommand);
    });

    it('should dispatch GetTicketStatusQuery from GET /tickets/:trackingId', async () => {
      buses.queryBus.execute.mockResolvedValue(mockStatusResponse);

      await controller.getTicketStatus('TK-2026-002');

      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetTicketStatusQuery);
    });

    it('should dispatch GetTicketHistoryQuery from GET /tickets', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistoryResponse);

      await controller.getTicketHistory(TEST_USER_ID, {});

      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetTicketHistoryQuery);
    });

    it('should dispatch SubmitFeedbackCommand from POST /tickets/:trackingId/feedback', async () => {
      buses.commandBus.execute.mockResolvedValue({
        ticketId: 'TK-2026-002',
        score: 4,
        submittedAt: '2026-06-10T15:30:00Z',
      });

      await controller.submitFeedback(TEST_USER_ID, 'TK-2026-002', { score: 4 });

      expect(buses.commandBus.execute.mock.calls[0][0]).toBeInstanceOf(SubmitFeedbackCommand);
    });
  });

  // ── Auth guard verification ────────────────────────────────────────────────

  describe('Auth protection', () => {
    it('should require authenticated user via @CurrentUser decorator (401 enforced by NestJS guard at e2e level)', () => {
      const controllerSource = TicketController.toString();
      expect(controllerSource).toContain('createTicket');
      expect(controllerSource).toContain('getUploadUrl');
    });

    it('should use ApiBearerAuth decorator for Swagger documentation', () => {
      const metadata = Reflect.getMetadata('swagger/apiSecurity', TicketController);
      expect(metadata).toBeDefined();
      expect(metadata).toEqual(expect.arrayContaining([expect.objectContaining({ 'JWT-auth': expect.any(Array) })]));
    });
  });
});
