import { Channel, Conversation, ConversationStatus } from '../../../domain';

function createActiveConversation(): Conversation {
  const conv = Conversation.create('conv-close-1', {
    customerChannelId: 'zalo-user-close',
    channel: Channel.zalo(),
  });
  conv.clearDomainEvents();
  return conv;
}

function createMockRepo(conv: Conversation | null = createActiveConversation()) {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    getById: jest.fn().mockResolvedValue(conv),
    delete: jest.fn(),
    findActiveByCustomerChannel: jest.fn(),
    findActiveConversations: jest.fn(),
  };
}

describe('CloseConversationHandler', () => {
  let CloseConversationHandler: any;
  let CloseConversationCommand: any;

  beforeAll(() => {
    CloseConversationHandler = require('./close-conversation.handler').CloseConversationHandler;
    CloseConversationCommand = require('../close-conversation.command').CloseConversationCommand;
  });

  it('closes an ACTIVE conversation', async () => {
    const conv = createActiveConversation();
    const repo = createMockRepo(conv);
    const handler = new CloseConversationHandler(repo);

    await handler.execute(new CloseConversationCommand('conv-close-1', 'agent-001'));

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(conv.status).toBe(ConversationStatus.CLOSED);
  });

  it('throws if conversation not found', async () => {
    const repo = createMockRepo(null);
    const handler = new CloseConversationHandler(repo);

    await expect(
      handler.execute(new CloseConversationCommand('missing', 'agent-001')),
    ).rejects.toThrow();
  });
});

describe('ArchiveConversationHandler', () => {
  let ArchiveConversationHandler: any;
  let ArchiveConversationCommand: any;

  beforeAll(() => {
    ArchiveConversationHandler = require('./archive-conversation.handler').ArchiveConversationHandler;
    ArchiveConversationCommand = require('../archive-conversation.command').ArchiveConversationCommand;
  });

  it('closes then archives an ACTIVE conversation', async () => {
    const conv = createActiveConversation();
    const repo = createMockRepo(conv);
    const handler = new ArchiveConversationHandler(repo);

    await handler.execute(new ArchiveConversationCommand('conv-close-1', 'agent-001'));

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(conv.status).toBe(ConversationStatus.ARCHIVED);
  });

  it('archives an already-CLOSED conversation', async () => {
    const conv = createActiveConversation();
    conv.close();
    const repo = createMockRepo(conv);
    const handler = new ArchiveConversationHandler(repo);

    await handler.execute(new ArchiveConversationCommand('conv-close-1', 'agent-001'));

    expect(conv.status).toBe(ConversationStatus.ARCHIVED);
  });

  it('throws if conversation not found', async () => {
    const repo = createMockRepo(null);
    const handler = new ArchiveConversationHandler(repo);

    await expect(
      handler.execute(new ArchiveConversationCommand('missing', 'agent-001')),
    ).rejects.toThrow();
  });
});

describe('Conversation archive() domain guard', () => {
  it('throws if archiving ACTIVE conversation directly (must close first)', () => {
    const conv = createActiveConversation();
    expect(() => conv.archive()).toThrow('CLOSED');
  });

  it('succeeds if CLOSED first', () => {
    const conv = createActiveConversation();
    conv.close();
    expect(() => conv.archive()).not.toThrow();
    expect(conv.status).toBe(ConversationStatus.ARCHIVED);
  });
});
