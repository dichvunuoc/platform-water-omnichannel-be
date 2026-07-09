import { GetConversationHandler } from './get-conversation.handler';
import { GetConversationQuery } from '../get-conversation.query';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetConversationHandler', () => {
  let handler: GetConversationHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new GetConversationHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { conversationId: 'CONV-1', messages: [{ role: 'user', content: 'hi', at: '2026-07-07T09:00:00Z' }] };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new GetConversationQuery('USR-1', 'CONV-1'));

    expect(portRegistry.execute).toHaveBeenCalledWith('chatbot', 'get-conversation', {
      customerId: 'USR-1',
      conversationId: 'CONV-1',
    });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new GetConversationQuery('USR-1', 'CONV-1'))).rejects.toThrow(
      PortFallbackException,
    );
  });
});
