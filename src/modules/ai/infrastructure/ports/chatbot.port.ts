import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { ChatbotReplySchema, ConversationSchema } from '../../application/dtos/chatbot.dto';

/**
 * Chatbot Port — AI customer assistant (Phase 2/3, S24).
 * NOTE: MVP mock returns canned replies; wire to an LLM/intent service when ready.
 */
export interface IChatbotPort extends IPortAdapter {
  // Methods: send-message, get-conversation
}

@Injectable()
export class MockChatbotAdapter extends MockAdapterBase implements IChatbotPort {
  constructor() {
    super(
      'chatbot',
      {
        'send-message': ChatbotReplySchema,
        'get-conversation': ConversationSchema,
      },
      new Logger('chatbot-mock-adapter'),
    );
  }
}
