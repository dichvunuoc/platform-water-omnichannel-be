import { MockTicketAdapter } from './ticket.port';
import {
  CreateTicketResponseSchema,
  CreateTicketRequestSchema,
  IncidentTypeSchema,
  TicketStatusResponseSchema,
  TicketHistoryResponseSchema,
  TicketHistoryQuerySchema,
  TicketWebhookPayloadSchema,
  TicketStatusEnum,
  SubmitFeedbackResponseSchema,
  SubmitFeedbackRequestSchema,
  CsatScoreSchema,
} from '../../application/dtos/ticket.dto';

describe('MockTicketAdapter', () => {
  let adapter: MockTicketAdapter;

  beforeEach(() => {
    adapter = new MockTicketAdapter();
  });

  // ── AC#3,#4: create-ticket (Story 5.1) ──────────────────────────────────────

  describe('execute - create-ticket', () => {
    it('should read and validate create-ticket.json mock data', async () => {
      const result = await adapter.execute('create-ticket', {
        customerId: 'USR-001',
        type: 'water_outage',
        description: 'No water supply since morning',
      });

      expect(result).toBeDefined();
      const parsed = CreateTicketResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.trackingId).toMatch(/^TK-\d{4}-\d+$/);
        expect(parsed.data.status).toBe('submitted');
        expect(parsed.data.createdAt).toBeDefined();
      }
    });

    it('should return valid tracking ID format', async () => {
      const result = await adapter.execute('create-ticket', {
        customerId: 'USR-001',
        type: 'leak',
        description: 'Water leaking from pipe',
      });

      const parsed = CreateTicketResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.trackingId).toBe('TK-2026-002');
      }
    });
  });

  // ── AC#1: get-ticket-status (Story 5.2) ─────────────────────────────────────

  describe('execute - get-ticket-status', () => {
    it('should read and validate get-ticket-status.json mock data', async () => {
      const result = await adapter.execute('get-ticket-status', {
        ticketId: 'TK-2026-002',
      });

      expect(result).toBeDefined();
      const parsed = TicketStatusResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.trackingId).toBe('TK-2026-002');
        expect(parsed.data.status).toBe('in_progress');
        expect(parsed.data.timeline).toBeDefined();
        expect(parsed.data.timeline.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should return timeline with non-empty entries', async () => {
      const result = await adapter.execute('get-ticket-status', {
        ticketId: 'TK-2026-002',
      });

      const parsed = TicketStatusResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.timeline.length).toBeGreaterThan(0);
        parsed.data.timeline.forEach((entry) => {
          expect(entry.status).toBeDefined();
          expect(entry.timestamp).toBeDefined();
        });
      }
    });

    it('should return ETA and assigned team from mock', async () => {
      const result = await adapter.execute('get-ticket-status', {
        ticketId: 'TK-2026-002',
      });

      const parsed = TicketStatusResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.eta).toBeDefined();
        expect(parsed.data.assignedTeam).toBeDefined();
      }
    });
  });

  // ── AC#2: get-ticket-history (Story 5.2) ────────────────────────────────────

  describe('execute - get-ticket-history', () => {
    it('should read and validate get-ticket-history.json mock data', async () => {
      const result = await adapter.execute('get-ticket-history', {
        customerId: 'USR-001',
      });

      expect(result).toBeDefined();
      const parsed = TicketHistoryResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.tickets).toBeDefined();
        expect(parsed.data.tickets.length).toBeGreaterThan(0);
        expect(parsed.data.total).toBeGreaterThan(0);
        expect(parsed.data.page).toBe(1);
        expect(parsed.data.pageSize).toBe(10);
      }
    });

    it('should return tickets with required fields', async () => {
      const result = await adapter.execute('get-ticket-history', {
        customerId: 'USR-001',
      });

      const parsed = TicketHistoryResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        parsed.data.tickets.forEach((ticket) => {
          expect(ticket.trackingId).toBeDefined();
          expect(ticket.type).toBeDefined();
          expect(ticket.status).toBeDefined();
          expect(ticket.createdAt).toBeDefined();
          expect(ticket.updatedAt).toBeDefined();
        });
      }
    });
  });

  // ── AC#2: submit-feedback (Story 5.3) ───────────────────────────────────────

  describe('execute - submit-feedback', () => {
    it('should read and validate submit-feedback.json mock data', async () => {
      const result = await adapter.execute('submit-feedback', {
        ticketId: 'TK-2026-002',
        customerId: 'USR-001',
        score: 4,
      });

      expect(result).toBeDefined();
      const parsed = SubmitFeedbackResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.ticketId).toBe('TICK-2026-002');
        expect(parsed.data.score).toBe(4);
        expect(parsed.data.submittedAt).toBeDefined();
      }
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('execute - missing method', () => {
    it('should throw for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  // ── Schema validation: IncidentTypeSchema ───────────────────────────────────

  describe('IncidentTypeSchema', () => {
    it('should accept water_outage', () => {
      expect(IncidentTypeSchema.safeParse('water_outage').success).toBe(true);
    });

    it('should accept leak', () => {
      expect(IncidentTypeSchema.safeParse('leak').success).toBe(true);
    });

    it('should accept water_quality', () => {
      expect(IncidentTypeSchema.safeParse('water_quality').success).toBe(true);
    });

    it('should accept meter_issue', () => {
      expect(IncidentTypeSchema.safeParse('meter_issue').success).toBe(true);
    });

    it('should accept other', () => {
      expect(IncidentTypeSchema.safeParse('other').success).toBe(true);
    });

    it('should reject invalid type', () => {
      expect(IncidentTypeSchema.safeParse('billing_issue').success).toBe(false);
    });
  });

  // ── Schema validation: CreateTicketRequestSchema ───────────────────────────

  describe('CreateTicketRequestSchema', () => {
    it('should accept valid ticket request', () => {
      const result = CreateTicketRequestSchema.safeParse({
        type: 'water_outage',
        description: 'No water since morning',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('water_outage');
        expect(result.data.description).toBe('No water since morning');
        expect(result.data.imageUrls).toBeUndefined();
      }
    });

    it('should accept request with imageUrls', () => {
      const result = CreateTicketRequestSchema.safeParse({
        type: 'leak',
        description: 'Pipe burst',
        imageUrls: ['https://storage.ioc.local/img1.jpg'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toHaveLength(1);
      }
    });

    it('should accept max 5 imageUrls', () => {
      const urls = Array.from({ length: 5 }, (_, i) => `https://storage.ioc.local/img${i}.jpg`);
      expect(CreateTicketRequestSchema.safeParse({
        type: 'leak',
        description: 'Multiple photos',
        imageUrls: urls,
      }).success).toBe(true);
    });

    it('should reject more than 5 imageUrls', () => {
      const urls = Array.from({ length: 6 }, (_, i) => `https://storage.ioc.local/img${i}.jpg`);
      expect(CreateTicketRequestSchema.safeParse({
        type: 'leak',
        description: 'Too many photos',
        imageUrls: urls,
      }).success).toBe(false);
    });

    it('should reject missing type', () => {
      expect(CreateTicketRequestSchema.safeParse({
        description: 'Some description',
      }).success).toBe(false);
    });

    it('should reject missing description', () => {
      expect(CreateTicketRequestSchema.safeParse({
        type: 'water_outage',
      }).success).toBe(false);
    });

    it('should reject empty description', () => {
      expect(CreateTicketRequestSchema.safeParse({
        type: 'water_outage',
        description: '',
      }).success).toBe(false);
    });

    it('should reject description exceeding 2000 chars', () => {
      expect(CreateTicketRequestSchema.safeParse({
        type: 'water_outage',
        description: 'A'.repeat(2001),
      }).success).toBe(false);
    });

    it('should reject invalid imageUrl (not a URL)', () => {
      expect(CreateTicketRequestSchema.safeParse({
        type: 'leak',
        description: 'Photo',
        imageUrls: ['not-a-url'],
      }).success).toBe(false);
    });
  });

  // ── Schema validation: CreateTicketResponseSchema ──────────────────────────

  describe('CreateTicketResponseSchema', () => {
    it('should accept valid response', () => {
      const result = CreateTicketResponseSchema.safeParse({
        trackingId: 'TK-2026-001',
        status: 'submitted',
        createdAt: '2026-06-10T09:30:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid tracking ID format', () => {
      expect(CreateTicketResponseSchema.safeParse({
        trackingId: 'INVALID-123',
        status: 'submitted',
        createdAt: '2026-06-10T09:30:00Z',
      }).success).toBe(false);
    });

    it('should reject invalid status', () => {
      expect(CreateTicketResponseSchema.safeParse({
        trackingId: 'TK-2026-001',
        status: 'unknown',
        createdAt: '2026-06-10T09:30:00Z',
      }).success).toBe(false);
    });

    it('should reject missing createdAt', () => {
      expect(CreateTicketResponseSchema.safeParse({
        trackingId: 'TK-2026-001',
        status: 'submitted',
      }).success).toBe(false);
    });
  });

  // ── Schema validation: TicketStatusEnum (Story 5.2) ────────────────────────

  describe('TicketStatusEnum', () => {
    it('should accept all valid statuses', () => {
      const statuses = ['submitted', 'assigned', 'in_progress', 'resolved', 'closed'];
      for (const status of statuses) {
        expect(TicketStatusEnum.safeParse(status).success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      expect(TicketStatusEnum.safeParse('pending').success).toBe(false);
    });
  });

  // ── Schema validation: TicketHistoryQuerySchema (Story 5.2) ────────────────

  describe('TicketHistoryQuerySchema', () => {
    it('should apply defaults for empty query', () => {
      const result = TicketHistoryQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(10);
        expect(result.data.status).toBeUndefined();
      }
    });

    it('should coerce string page/pageSize to numbers', () => {
      const result = TicketHistoryQuerySchema.safeParse({ page: '2', pageSize: '20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it('should reject page < 1', () => {
      expect(TicketHistoryQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    });

    it('should reject pageSize > 50', () => {
      expect(TicketHistoryQuerySchema.safeParse({ pageSize: 51 }).success).toBe(false);
    });

    it('should accept valid status filter', () => {
      const result = TicketHistoryQuerySchema.safeParse({ status: 'in_progress' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('in_progress');
      }
    });
  });

  // ── Schema validation: TicketWebhookPayloadSchema (Story 5.2) ──────────────

  describe('TicketWebhookPayloadSchema', () => {
    it('should accept valid webhook payload', () => {
      const result = TicketWebhookPayloadSchema.safeParse({
        ticketId: 'TICK-001',
        trackingId: 'TK-2026-002',
        customerId: 'USR-001',
        oldStatus: 'submitted',
        newStatus: 'assigned',
        updatedAt: '2026-06-10T11:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing ticketId', () => {
      expect(TicketWebhookPayloadSchema.safeParse({
        trackingId: 'TK-2026-002',
        customerId: 'USR-001',
        oldStatus: 'submitted',
        newStatus: 'assigned',
        updatedAt: '2026-06-10T11:00:00Z',
      }).success).toBe(false);
    });

    it('should reject invalid oldStatus', () => {
      expect(TicketWebhookPayloadSchema.safeParse({
        ticketId: 'TICK-001',
        trackingId: 'TK-2026-002',
        customerId: 'USR-001',
        oldStatus: 'pending',
        newStatus: 'assigned',
        updatedAt: '2026-06-10T11:00:00Z',
      }).success).toBe(false);
    });
  });

  // ── Schema validation: CsatScoreSchema (Story 5.3) ──────────────────────────

  describe('CsatScoreSchema', () => {
    it('should accept scores 1-5', () => {
      for (const score of [1, 2, 3, 4, 5]) {
        expect(CsatScoreSchema.safeParse(score).success).toBe(true);
      }
    });

    it('should reject score = 0', () => {
      expect(CsatScoreSchema.safeParse(0).success).toBe(false);
    });

    it('should reject score = 6', () => {
      expect(CsatScoreSchema.safeParse(6).success).toBe(false);
    });

    it('should reject non-integer (3.5)', () => {
      expect(CsatScoreSchema.safeParse(3.5).success).toBe(false);
    });

    it('should reject string score', () => {
      expect(CsatScoreSchema.safeParse('5').success).toBe(false);
    });
  });

  // ── Schema validation: SubmitFeedbackRequestSchema (Story 5.3) ──────────────

  describe('SubmitFeedbackRequestSchema', () => {
    it('should accept valid request with score only', () => {
      const result = SubmitFeedbackRequestSchema.safeParse({ score: 4 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(4);
        expect(result.data.comment).toBeUndefined();
      }
    });

    it('should accept request with comment', () => {
      const result = SubmitFeedbackRequestSchema.safeParse({
        score: 5,
        comment: 'Great service!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.comment).toBe('Great service!');
      }
    });

    it('should reject missing score', () => {
      expect(SubmitFeedbackRequestSchema.safeParse({}).success).toBe(false);
    });

    it('should reject score below 1', () => {
      expect(SubmitFeedbackRequestSchema.safeParse({ score: 0 }).success).toBe(false);
    });

    it('should reject score above 5', () => {
      expect(SubmitFeedbackRequestSchema.safeParse({ score: 6 }).success).toBe(false);
    });
  });
});
