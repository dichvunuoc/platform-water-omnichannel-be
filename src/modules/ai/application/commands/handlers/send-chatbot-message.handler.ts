import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { SendChatbotMessageCommand, SendChatbotMessageResult } from '../send-chatbot-message.command';
import type { ChatbotReply } from '../../dtos/chatbot.dto';

@CommandHandler(SendChatbotMessageCommand)
export class SendChatbotMessageHandler implements ICommandHandler<SendChatbotMessageCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: SendChatbotMessageCommand): Promise<SendChatbotMessageResult> {
    const r = await this.portRegistry.execute<ChatbotReply>('chatbot', 'send-message', {
      customerId: command.customerId,
      conversationId: command.conversationId,
      message: command.message,
      useCache: false,
    });
    if (!r?.data) throw new PortFallbackException('chatbot');
    return r.data;
  }
}
