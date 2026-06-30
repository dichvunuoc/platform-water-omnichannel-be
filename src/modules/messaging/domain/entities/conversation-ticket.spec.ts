import { Channel, Conversation, ConversationStatus } from '../../domain';
import { TicketingStubService } from '../../../ticketing-stub/ticketing-stub.service';

describe('Epic 3 — Ticket Interaction & SLA (integration)', () => {
  let stub: TicketingStubService;

  beforeEach(() => {
    stub = new TicketingStubService(undefined as any);
  });

  // ── 3-1: Request Ticket Create + Link Conversation (FR19) ──

  describe('Story 3-1: Create ticket + link', () => {
    it('stub creates a ticket with ID + SLA deadline', () => {
      const ticket = stub.createTicket({
        conversationId: 'conv-test-1',
        customerId: 'cust-001',
        channel: 'ZALO',
        priority: 'P0',
        title: 'Vỡ ống nước',
      });

      expect(ticket.id).toMatch(/^SC-\d+$/);
      expect(ticket.conversationId).toBe('conv-test-1');
      expect(ticket.stage).toBe('RECEIVED');
      expect(ticket.priority).toBe('P0');
      expect(ticket.slaDeadline).toBeGreaterThan(Date.now());
    });

    it('conversation links to ticket via linkTicket()', () => {
      const conv = Conversation.create('conv-test-2', {
        customerChannelId: 'zalo-user-1',
        channel: Channel.zalo(),
      });

      expect(conv.ticketId).toBeNull();

      conv.linkTicket('SC-2050');
      expect(conv.ticketId).toBe('SC-2050');
    });

    it('linkTicket is idempotent — second call does NOT overwrite', () => {
      const conv = Conversation.create('conv-test-3', {
        customerChannelId: 'zalo-user-1',
        channel: Channel.zalo(),
      });

      conv.linkTicket('SC-2050');
      conv.linkTicket('SC-2051'); // ignored

      expect(conv.ticketId).toBe('SC-2050');
    });

    it('linkTicket throws on empty ticketId', () => {
      const conv = Conversation.create('conv-test-4', {
        customerChannelId: 'zalo-user-1',
        channel: Channel.zalo(),
      });

      expect(() => conv.linkTicket('')).toThrow();
    });

    it('fastForwardSla sets a near-breach deadline', () => {
      const ticket = stub.createTicket({
        conversationId: 'conv-test-5',
        priority: 'P2',
        fastForwardSla: true,
      });

      const remaining = ticket.slaDeadline - Date.now();
      expect(remaining).toBeLessThan(6 * 60 * 1000); // <6 min
      expect(remaining).toBeGreaterThan(3 * 60 * 1000); // >3 min
    });
  });

  // ── 3-2: Kanban View + SLA Countdown (FR20/FR60) ──

  describe('Story 3-2: Kanban + SLA', () => {
    it('stub returns kanban with all 5 stages', () => {
      const kanban = stub.getKanban();

      expect(kanban.total).toBeGreaterThan(0); // has seeded data
      expect(kanban.RECEIVED.length).toBeGreaterThanOrEqual(0);
      expect(kanban.IN_PROGRESS.length).toBeGreaterThanOrEqual(0);
      expect(kanban.WAITING.length).toBeGreaterThanOrEqual(0);
      expect(kanban.RESOLVED.length).toBeGreaterThanOrEqual(0);
      expect(kanban.CLOSED).toBeDefined();
    });

    it('advanceStage moves ticket RECEIVED → IN_PROGRESS', () => {
      const ticket = stub.createTicket({
        conversationId: 'conv-advance-1',
        priority: 'P2',
      });

      stub.advanceStage(ticket.id, 'IN_PROGRESS');
      const updated = stub.getTicket(ticket.id);

      expect(updated?.stage).toBe('IN_PROGRESS');
    });

    it('advanceStage to RESOLVED sets closedAt', () => {
      const ticket = stub.createTicket({
        conversationId: 'conv-resolve-1',
        priority: 'P1',
      });

      stub.advanceStage(ticket.id, 'RESOLVED');
      const resolved = stub.getTicket(ticket.id);

      expect(resolved?.stage).toBe('RESOLVED');
      expect(resolved?.closedAt).not.toBeNull();
    });

    it('getByConversation finds linked ticket', () => {
      const ticket = stub.createTicket({
        conversationId: 'conv-find-me',
        priority: 'P2',
      });

      const found = stub.getByConversation('conv-find-me');
      expect(found?.id).toBe(ticket.id);
    });

    it('getByConversation returns null for unlinked conversation', () => {
      expect(stub.getByConversation('nonexistent-conv')).toBeNull();
    });

    it('reassign changes assignee', () => {
      const ticket = stub.createTicket({
        conversationId: 'conv-reassign-1',
        priority: 'P2',
      });

      stub.reassign(ticket.id, 'agent-999');
      const updated = stub.getTicket(ticket.id);

      expect(updated?.assignee).toBe('agent-999');
    });
  });

  // ── 3-3: SlaWarning emit (FR25) ──

  describe('Story 3-3: SLA Warning', () => {
    it('triggerSlaWarning fires without error', () => {
      const ticket = stub.createTicket({
        conversationId: 'conv-sla-1',
        priority: 'P0',
      });

      // Should not throw — event bus is undefined, so it just logs
      expect(() => stub.triggerSlaWarning(ticket.id, 'WARNING')).not.toThrow();
      expect(() => stub.triggerSlaWarning(ticket.id, 'BREACHED')).not.toThrow();
    });

    it('triggerSlaWarning throws for nonexistent ticket', () => {
      expect(() => stub.triggerSlaWarning('SC-9999', 'WARNING')).toThrow('not found');
    });

    it('fastForwardSla + triggerSlaWarning simulates J3 demo', () => {
      const ticket = stub.createTicket({
        conversationId: 'conv-j3-demo',
        priority: 'P0',
        title: 'Báo mất nước大面积',
      });

      // Fast-forward to 1 minute remaining
      stub.fastForwardSla(ticket.id, 1);

      // Trigger warning — agent would see red flash on Kanban
      expect(() => stub.triggerSlaWarning(ticket.id, 'WARNING')).not.toThrow();

      const updated = stub.getTicket(ticket.id);
      expect(updated).not.toBeNull();
      expect(updated!.slaDeadline - Date.now()).toBeLessThan(2 * 60 * 1000);
    });
  });

  // ── Cross-story: full J3 flow ──

  describe('J3 Demo Flow: full SLA firefighting', () => {
    it('creates ticket → advances → fast-forward SLA → warning fires', () => {
      // 1. Agent creates ticket from conversation
      const ticket = stub.createTicket({
        conversationId: 'conv-j3-full',
        customerId: 'cust-001',
        channel: 'ZALO',
        priority: 'P0',
        title: 'Báo mất nước — P. Hòa Bình',
        fastForwardSla: true, // 5 min SLA for demo
      });

      expect(ticket.stage).toBe('RECEIVED');

      // 2. Supervisor advances to IN_PROGRESS
      stub.advanceStage(ticket.id, 'IN_PROGRESS');
      expect(stub.getTicket(ticket.id)?.stage).toBe('IN_PROGRESS');

      // 3. Time passes (fast-forward to 2 min remaining)
      stub.fastForwardSla(ticket.id, 2);

      // 4. SLA warning fires — Kanban would flash red
      stub.triggerSlaWarning(ticket.id, 'WARNING');

      // 5. Supervisor reassigns to free agent
      stub.reassign(ticket.id, 'agent-free-001');
      expect(stub.getTicket(ticket.id)?.assignee).toBe('agent-free-001');

      // 6. Agent resolves
      stub.advanceStage(ticket.id, 'RESOLVED');
      expect(stub.getTicket(ticket.id)?.stage).toBe('RESOLVED');
      expect(stub.getTicket(ticket.id)?.closedAt).not.toBeNull();
    });
  });
});
