import {
  Ticket,
  TicketPriorityEnum,
  TicketStageEnum,
  TicketPriority,
  type EscalationLevel,
} from '../../domain';

describe('Ticket Aggregate', () => {
  const createTestTicket = (priority: TicketPriorityEnum = TicketPriorityEnum.P0) =>
    Ticket.create('SC-TEST01', {
      channel: 'ZALO',
      title: 'Vỡ ống nước',
      description: 'Báo sự cố',
      priority: TicketPriority.create(priority),
      conversationId: 'conv-1',
      customerId: 'cust-1',
    });

  describe('create()', () => {
    it('creates with RECEIVED stage + SC- ID', () => {
      const t = createTestTicket();
      expect(t.id).toBe('SC-TEST01');
      expect(t.stage.value).toBe(TicketStageEnum.RECEIVED);
      expect(t.priority.value).toBe(TicketPriorityEnum.P0);
      expect(t.escalated).toBe(false);
    });

    it('enqueues TicketCreated event with SLA deadlines', () => {
      const t = createTestTicket(TicketPriorityEnum.P0);
      const events = t.getDomainEvents();
      expect(events.some(e => e.eventType === 'TicketCreated')).toBe(true);
      expect(t.ackDeadline.getTime()).toBeGreaterThan(Date.now());
      expect(t.resolveDeadline.getTime()).toBeGreaterThan(t.ackDeadline.getTime());
    });

    it('P0 SLA: ack=1h, resolve=4h, schedule=24/7', () => {
      const t = createTestTicket(TicketPriorityEnum.P0);
      const ackMs = t.ackDeadline.getTime() - t.createdAt.getTime();
      const resolveMs = t.resolveDeadline.getTime() - t.createdAt.getTime();
      expect(ackMs).toBeCloseTo(3600 * 1000, -2);
      expect(resolveMs).toBeCloseTo(4 * 3600 * 1000, -2);
    });

    it('P2 SLA: ack=24h, resolve=7d, schedule=BUSINESS_HOURS', () => {
      const t = createTestTicket(TicketPriorityEnum.P2);
      const ackMs = t.ackDeadline.getTime() - t.createdAt.getTime();
      const resolveMs = t.resolveDeadline.getTime() - t.createdAt.getTime();
      expect(ackMs).toBeCloseTo(24 * 3600 * 1000, -2);
      expect(resolveMs).toBeCloseTo(7 * 24 * 3600 * 1000, -2);
    });
  });

  describe('advanceStage()', () => {
    it('RECEIVED → IN_PROGRESS sets acknowledgedAt (auto ack)', () => {
      const t = createTestTicket();
      expect(t.acknowledgedAt).toBeNull();
      t.advanceStage(TicketStageEnum.IN_PROGRESS);
      expect(t.stage.value).toBe(TicketStageEnum.IN_PROGRESS);
      expect(t.acknowledgedAt).not.toBeNull();
    });

    it('IN_PROGRESS → WAITING → RESOLVED → CLOSED works', () => {
      const t = createTestTicket();
      t.advanceStage(TicketStageEnum.IN_PROGRESS);
      t.advanceStage(TicketStageEnum.WAITING);
      t.advanceStage(TicketStageEnum.IN_PROGRESS);
      t.advanceStage(TicketStageEnum.RESOLVED);
      t.advanceStage(TicketStageEnum.CLOSED);
      expect(t.stage.value).toBe(TicketStageEnum.CLOSED);
      expect(t.closedAt).not.toBeNull();
    });

    it('CLOSED emits TicketClosed event', () => {
      const t = createTestTicket();
      t.advanceStage(TicketStageEnum.IN_PROGRESS);
      t.advanceStage(TicketStageEnum.CLOSED);
      const events = t.getDomainEvents();
      expect(events.some(e => e.eventType === 'TicketClosed')).toBe(true);
    });

    it('rejects invalid transition: RECEIVED → CLOSED directly', () => {
      const t = createTestTicket();
      expect(() => t.advanceStage(TicketStageEnum.CLOSED)).toThrow('Invalid transition');
    });

    it('RESOLVED → IN_PROGRESS allowed (reopen path)', () => {
      const t = createTestTicket();
      t.advanceStage(TicketStageEnum.IN_PROGRESS);
      t.advanceStage(TicketStageEnum.RESOLVED);
      t.advanceStage(TicketStageEnum.IN_PROGRESS);
      expect(t.stage.value).toBe(TicketStageEnum.IN_PROGRESS);
    });
  });

  describe('escalate()', () => {
    it('sets escalated=true + level', () => {
      const t = createTestTicket();
      expect(t.escalated).toBe(false);
      t.escalate('TEAM_LEAD');
      expect(t.escalated).toBe(true);
      expect(t.escalationLevel).toBe('TEAM_LEAD');
    });

    it('idempotent — same level does not re-fire', () => {
      const t = createTestTicket();
      t.escalate('TEAM_LEAD');
      t.clearDomainEvents();
      t.escalate('TEAM_LEAD');
      expect(t.getDomainEvents().length).toBe(0);
    });
  });

  describe('reopenFromCsat()', () => {
    it('CLOSED → IN_PROGRESS + escalated + new 24h SLA', () => {
      const t = createTestTicket();
      t.advanceStage(TicketStageEnum.IN_PROGRESS);
      t.advanceStage(TicketStageEnum.CLOSED);

      t.reopenFromCsat();
      expect(t.stage.value).toBe(TicketStageEnum.IN_PROGRESS);
      expect(t.escalated).toBe(true);
      expect(t.escalationLevel).toBe('URGENT');
      expect(t.reopenedFromCsat).toBe(true);
      expect(t.closedAt).toBeNull();
      // New SLA = 24h from now
      const newResolveMs = t.resolveDeadline.getTime() - Date.now();
      expect(newResolveMs).toBeLessThan(25 * 3600 * 1000);
      expect(newResolveMs).toBeGreaterThan(23 * 3600 * 1000);
    });

    it('throws if ticket is not CLOSED', () => {
      const t = createTestTicket();
      expect(() => t.reopenFromCsat()).toThrow('Cannot reopen');
    });
  });

  describe('Parent-Incident', () => {
    it('attachToParent sets parentId', () => {
      const t = createTestTicket();
      expect(t.parentId).toBeNull();
      t.attachToParent('SC-PARENT01');
      expect(t.parentId).toBe('SC-PARENT01');
    });

    it('detachFromParent clears parentId', () => {
      const t = createTestTicket();
      t.attachToParent('SC-PARENT01');
      t.detachFromParent();
      expect(t.parentId).toBeNull();
    });
  });

  describe('SLA getters', () => {
    it('ackRemainingMs > 0 before acknowledged', () => {
      const t = createTestTicket(TicketPriorityEnum.P0);
      expect(t.ackRemainingMs).toBeGreaterThan(0);
    });

    it('ackRemainingMs = 0 after acknowledged (IN_PROGRESS)', () => {
      const t = createTestTicket(TicketPriorityEnum.P0);
      t.advanceStage(TicketStageEnum.IN_PROGRESS);
      expect(t.ackRemainingMs).toBe(0);
    });

    it('resolveRemainingMs = 0 when RESOLVED', () => {
      const t = createTestTicket(TicketPriorityEnum.P0);
      t.advanceStage(TicketStageEnum.IN_PROGRESS);
      t.advanceStage(TicketStageEnum.RESOLVED);
      expect(t.resolveRemainingMs).toBe(0);
    });
  });
});
