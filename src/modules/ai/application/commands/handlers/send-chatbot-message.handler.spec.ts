import { SendChatbotMessageHandler } from './send-chatbot-message.handler';
import { SendChatbotMessageCommand } from '../send-chatbot-message.command';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('SendChatbotMessageHandler', () => {
  let handler: SendChatbotMessageHandler;
  let portRegistry: any;

  beforeEach(() => {
    portRegistry = { execute: jest.fn() };
    handler = new SendChatbotMessageHandler(portRegistry);
  });

  it('calls PortRegistry with correct params and returns data', async () => {
    const data = { conversationId: 'CONV-1', messageId: 'MSG-1', reply: 'Tôi có thể giúp gì?', intent: 'faq', confidence: 0.9 };
    portRegistry.execute.mockResolvedValue({ data });

    const result = await handler.execute(new SendChatbotMessageCommand('USR-1', 'CONV-1', 'Xin chào'));

    expect(portRegistry.execute).toHaveBeenCalledWith('chatbot', 'send-message', {
      customerId: 'USR-1',
      conversationId: 'CONV-1',
      message: 'Xin chào',
      useCache: false,
    });
    expect(result).toEqual(data);
  });

  it('throws PortFallbackException when result.data is null', async () => {
    portRegistry.execute.mockResolvedValue({ data: null });
    await expect(handler.execute(new SendChatbotMessageCommand('USR-1', 'CONV-1', 'hi'))).rejects.toThrow(
      PortFallbackException,
    );
  });
});
