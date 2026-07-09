import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetConversationQuery, GetConversationResult } from '../get-conversation.query';
import type { Conversation } from '../../dtos/chatbot.dto';

@QueryHandler(GetConversationQuery)
export class GetConversationHandler implements IQueryHandler<GetConversationQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetConversationQuery): Promise<GetConversationResult> {
    const r = await this.portRegistry.execute<Conversation>('chatbot', 'get-conversation', {
      customerId: query.customerId,
      conversationId: query.conversationId,
    });
    if (!r?.data) throw new PortFallbackException('chatbot');
    return r.data;
  }
}
