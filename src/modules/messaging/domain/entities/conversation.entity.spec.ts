import { Channel } from '../value-objects/channel.value-object';
import {
  Conversation,
  ConversationStatus,
} from './conversation.entity';
import {
  Message,
  MessageDirection,
  SenderType,
} from './message.entity';

describe('Conversation Aggregate', () => {
  const channel = Channel.zalo();

  const makeMessage = (id: string, content = 'hello'): Message =>
    Message.create({
      id,
      conversationId: 'conv-1',
      channel,
      direction: MessageDirection.INBOUND,
      senderType: SenderType.CUSTOMER,
      content,
      externalId: `ext-${id}`,
    });

  describe('create()', () => {
    it('creates with ACTIVE status + customerChannelId', () => {
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
      });
      expect(conv.status).toBe(ConversationStatus.ACTIVE);
      expect(conv.customerChannelId).toBe('zalo-user-123');
      expect(conv.channel.value).toBe('ZALO');
      expect(conv.messages.length).toBe(0); // no firstMessage
    });

    it('enqueues ConversationStarted event', () => {
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
      });
      const events = conv.getDomainEvents();
      expect(events.some((e) => e.eventType === 'ConversationStarted')).toBe(true);
    });

    it('with firstMessage: enqueues ConversationStarted + MessageReceived', () => {
      const msg = makeMessage('msg-1');
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
        firstMessage: msg,
      });
      expect(conv.messages.length).toBe(1);
      const events = conv.getDomainEvents();
      expect(events.some((e) => e.eventType === 'ConversationStarted')).toBe(true);
      expect(events.some((e) => e.eventType === 'MessageReceived')).toBe(true);
    });

    it('throws if customerChannelId is empty', () => {
      expect(() =>
        Conversation.create('conv-1', { customerChannelId: '', channel }),
      ).toThrow();
    });
  });

  describe('receiveMessage()', () => {
    it('appends message + enqueues MessageReceived on ACTIVE conversation', () => {
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
      });
      conv.clearDomainEvents();

      const msg = makeMessage('msg-1', 'bác Nam đây');
      conv.receiveMessage(msg);

      expect(conv.messages.length).toBe(1);
      expect(conv.lastMessage?.content).toBe('bác Nam đây');

      const events = conv.getDomainEvents();
      expect(events.some((e) => e.eventType === 'MessageReceived')).toBe(true);
      const receivedEvent = events.find((e) => e.eventType === 'MessageReceived');
      expect(receivedEvent?.aggregateId).toBe('conv-1');
    });

    it('maintains chronological order (append-only)', () => {
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
      });
      conv.receiveMessage(makeMessage('msg-1', 'first'));
      conv.receiveMessage(makeMessage('msg-2', 'second'));

      expect(conv.messages[0].content).toBe('first');
      expect(conv.messages[1].content).toBe('second');
    });

    it('throws on CLOSED conversation', () => {
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
      });
      conv.close();
      expect(() => conv.receiveMessage(makeMessage('msg-x'))).toThrow(
        'CLOSED',
      );
    });
  });

  describe('close() + archive()', () => {
    it('close() sets status to CLOSED', () => {
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
      });
      conv.close();
      expect(conv.status).toBe(ConversationStatus.CLOSED);
      expect(conv.isActive).toBe(false);
    });

    it('close() throws on already CLOSED', () => {
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
      });
      conv.close();
      expect(() => conv.close()).toThrow('CLOSED');
    });

    it('archive() sets status to ARCHIVED', () => {
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
      });
      conv.close(); // must close first (can't archive ACTIVE per current impl)
      conv.archive();
      expect(conv.status).toBe(ConversationStatus.ARCHIVED);
    });
  });

  describe('assignCustomer()', () => {
    it('sets the resolved customerId (identity resolution — Epic 2)', () => {
      const conv = Conversation.create('conv-1', {
        customerChannelId: 'zalo-user-123',
        channel,
      });
      expect(conv.customerId).toBeNull();
      conv.assignCustomer('global-customer-456');
      expect(conv.customerId).toBe('global-customer-456');
    });
  });

  describe('reconstitute()', () => {
    it('rebuilds from persistence with all fields', () => {
      const msgs = [makeMessage('msg-1'), makeMessage('msg-2')];
      const conv = Conversation.reconstitute(
        'conv-1',
        'zalo-user-123',
        channel,
        'cust-456',
        msgs,
        ConversationStatus.ACTIVE,
        3,
        new Date('2026-06-22'),
        new Date('2026-06-23'),
      );
      expect(conv.id).toBe('conv-1');
      expect(conv.customerId).toBe('cust-456');
      expect(conv.messages.length).toBe(2);
      expect(conv.status).toBe(ConversationStatus.ACTIVE);
      expect(conv.version).toBe(3);
    });
  });
});
