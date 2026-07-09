import { ICommand } from '@core/application';
import type { ChatbotReply } from '../dtos/chatbot.dto';

export class SendChatbotMessageCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly conversationId: string,
    public readonly message: string,
  ) {}
}
export type SendChatbotMessageResult = ChatbotReply;
