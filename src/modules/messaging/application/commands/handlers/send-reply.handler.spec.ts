import { Channel, Conversation, ConversationStatus, MessageDirection, SenderType } from '../../../domain';

// Mock factory
function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
  const conv = Conversation.create('conv-reply-1', {
    customerChannelId: 'zalo-user-789',
    channel: Channel.zalo(),
  });
  conv.clearDomainEvents();
  return conv;
}

function createMockRepo(conv: Conversation | null = createMockConversation()) {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    getById: jest.fn().mockResolvedValue(conv),
    delete: jest.fn(),
    findActiveByCustomerChannel: jest.fn(),
    findActiveConversations: jest.fn(),
  };
}

function createMockAdapters() {
  const mockSend = jest.fn().mockResolvedValue({ success: true, externalId: 'ext-1' });
  return {
    map: new Map([
      ['ZALO', { send: mockSend, channel: 'ZALO' }],
      ['APP', { send: jest.fn().mockResolvedValue({ success: true }), channel: 'APP' }],
    ]),
    mockSend,
  };
}

describe('SendReplyHandler', () => {
  // Lazy-require to avoid module-scoped NestJS metadata issues
  let SendReplyHandler: any;
  let SendReplyCommand: any;

  beforeAll(() => {
    SendReplyHandler = require('./send-reply.handler').SendReplyHandler;
    SendReplyCommand = require('../send-reply.command').SendReplyCommand;
  });

  it('creates an OUTBOUND message + appends to conversation + saves', async () => {
    const conv = createMockConversation();
    const repo = createMockRepo(conv);
    const { map, mockSend } = createMockAdapters();

    const handler = new SendReplyHandler(repo, map);
    const result = await handler.execute(
      new SendReplyCommand('conv-reply-1', 'agent-001', 'Cảm ơn bác đã báo, đội hiện trường đang đến'),
    );

    expect(result.messageId).toBeDefined();
    expect(repo.save).toHaveBeenCalledTimes(1);
    const savedConv = repo.save.mock.calls[0][0] as Conversation;
    expect(savedConv.messages.length).toBe(1);
    expect(savedConv.messages[0].direction).toBe(MessageDirection.OUTBOUND);
    expect(savedConv.messages[0].senderType).toBe(SenderType.AGENT);
    expect(savedConv.messages[0].content).toBe('Cảm ơn bác đã báo, đội hiện trường đang đến');
  });

  it('fires outbound channel send (fire-and-forget)', async () => {
    const conv = createMockConversation();
    const repo = createMockRepo(conv);
    const { map, mockSend } = createMockAdapters();

    const handler = new SendReplyHandler(repo, map);
    await handler.execute(new SendReplyCommand('conv-reply-1', 'agent-001', 'reply text'));

    // Give fire-and-forget a tick to resolve
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSend).toHaveBeenCalledWith('zalo-user-789', 'reply text', []);
  });

  it('throws NotFoundException if conversation not found', async () => {
    const repo = createMockRepo(null);
    const { map } = createMockAdapters();
    const handler = new SendReplyHandler(repo, map);

    await expect(
      handler.execute(new SendReplyCommand('nonexistent', 'agent-001', 'text')),
    ).rejects.toThrow();
  });

  it('throws DomainException if conversation is CLOSED', async () => {
    const conv = createMockConversation();
    conv.close();
    const repo = createMockRepo(conv);
    const { map } = createMockAdapters();
    const handler = new SendReplyHandler(repo, map);

    await expect(
      handler.execute(new SendReplyCommand('conv-reply-1', 'agent-001', 'text')),
    ).rejects.toThrow('not active');
  });
});
