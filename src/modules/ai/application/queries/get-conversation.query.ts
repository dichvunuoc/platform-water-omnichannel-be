import { IQuery } from '@core/application';
import type { Conversation } from '../dtos/chatbot.dto';

export class GetConversationQuery extends IQuery<Conversation> {
  constructor(
    public readonly customerId: string,
    public readonly conversationId: string,
  ) {
    super();
  }
}
export type GetConversationResult = Conversation;
