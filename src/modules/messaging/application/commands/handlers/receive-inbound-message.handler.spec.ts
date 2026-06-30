import { randomUUID } from 'crypto';
import {
  Channel,
  ChannelEnum,
  Conversation,
  ConversationStatus,
} from '../../../domain';
import type { IConversationRepository } from '../../../domain';
import { ReceiveInboundMessageCommand } from '../receive-inbound-message.command';
import { ReceiveInboundMessageHandler } from './receive-inbound-message.handler';

/**
 * Mock factory for IConversationRepository
 */
function createMockRepo(overrides: Partial<IConversationRepository> = {}): IConversationRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    getById: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
    findActiveByCustomerChannel: jest.fn().mockResolvedValue(null),
    findActiveConversations: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    ...overrides,
  } as unknown as IConversationRepository;
}

/**
 * Mock factory for IdempotencyService
 */
function createMockIdempotency(existingResult: unknown = null) {
  return {
    getExisting: jest.fn().mockResolvedValue(existingResult),
    store: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ReceiveInboundMessageHandler', () => {
  const channel = ChannelEnum.ZALO;
  const customerChannelId = 'zalo-user-bac-nam';
  const externalMessageId = 'zalo-msg-001';
  const content = 'Ống nước vỡ trước nhà rồi!';
  const attachments = ['https://cdn.zalo.ai/photo/123.jpg'];

  it('creates a new conversation when none exists (no idempotency hit)', async () => {
    const mockRepo = createMockRepo({
      findActiveByCustomerChannel: jest.fn().mockResolvedValue(null),
    });
    const mockIdempotency = createMockIdempotency(null);

    const handler = new ReceiveInboundMessageHandler(
      mockRepo as any,
      mockIdempotency as any,
    );

    const result = await handler.execute(
      new ReceiveInboundMessageCommand(
        channel,
        customerChannelId,
        externalMessageId,
        content,
        attachments,
      ),
    );

    // Creates conversation (save called)
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    const savedConv = (mockRepo.save as jest.Mock).mock.calls[0][0] as Conversation;
    expect(savedConv.customerChannelId).toBe(customerChannelId);
    expect(savedConv.messages.length).toBe(1); // the first message
    expect(savedConv.messages[0].content).toBe(content);
    expect(savedConv.messages[0].externalId).toBe(externalMessageId);

    // Stores idempotency result
    expect(mockIdempotency.store).toHaveBeenCalledWith(
      `${channel}:${externalMessageId}`,
      expect.objectContaining({ conversationId: savedConv.id, messageId: expect.any(String) }),
      'ReceiveInboundMessage',
    );

    // Returns ids
    expect(result.conversationId).toBe(savedConv.id);
    expect(result.messageId).toBe(savedConv.messages[0].id);
  });

  it('appends to existing conversation when one is active', async () => {
    // Simulate an existing conversation (reconstituted, 1 message already)
    const existingConv = Conversation.reconstitute(
      'conv-existing-1',
      customerChannelId,
      Channel.create(channel),
      null,
      [],
      ConversationStatus.ACTIVE,
      1,
      new Date(),
      new Date(),
    );

    const mockRepo = createMockRepo({
      findActiveByCustomerChannel: jest.fn().mockResolvedValue(existingConv),
    });
    const mockIdempotency = createMockIdempotency(null);

    const handler = new ReceiveInboundMessageHandler(
      mockRepo as any,
      mockIdempotency as any,
    );

    const result = await handler.execute(
      new ReceiveInboundMessageCommand(
        channel,
        customerChannelId,
        'zalo-msg-002',
        'Cảm ơn đã tiếp nhận',
      ),
    );

    // Saves the EXISTING conversation (not a new one)
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    const savedConv = (mockRepo.save as jest.Mock).mock.calls[0][0] as Conversation;
    expect(savedConv.id).toBe('conv-existing-1');
    expect(savedConv.messages.length).toBe(1); // the new message appended

    expect(result.conversationId).toBe('conv-existing-1');
  });

  it('returns cached result on idempotency HIT (FR3 dedup)', async () => {
    const cachedResult = {
      conversationId: 'conv-cached',
      messageId: 'msg-cached',
    };
    const mockRepo = createMockRepo();
    const mockIdempotency = createMockIdempotency({
      result: cachedResult,
      storedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      commandType: 'ReceiveInboundMessage',
    });

    const handler = new ReceiveInboundMessageHandler(
      mockRepo as any,
      mockIdempotency as any,
    );

    const result = await handler.execute(
      new ReceiveInboundMessageCommand(
        channel,
        customerChannelId,
        externalMessageId, // same key as before
        content,
      ),
    );

    // Returns cached result — NO save, NO store
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockIdempotency.store).not.toHaveBeenCalled();
    expect(result).toEqual(cachedResult);
  });

  it('builds idempotency key as channel:externalMessageId', async () => {
    const mockRepo = createMockRepo();
    const mockIdempotency = createMockIdempotency(null);

    const handler = new ReceiveInboundMessageHandler(
      mockRepo as any,
      mockIdempotency as any,
    );

    await handler.execute(
      new ReceiveInboundMessageCommand(
        ChannelEnum.APP,
        'app-user-789',
        'app-msg-xyz',
        'test',
      ),
    );

    expect(mockIdempotency.getExisting).toHaveBeenCalledWith('APP:app-msg-xyz');
  });
});
