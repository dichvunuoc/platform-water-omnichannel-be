import { Channel, Conversation } from '../../domain';

describe('Conversation ↔ Ticket linking (domain)', () => {
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
});
