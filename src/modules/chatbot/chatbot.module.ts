/** ChatbotModule — Zalo OA chatbot port. Mock default. */
import { Module } from '@nestjs/common';
import { CHATBOT_PORT_TOKEN } from '../messaging/constants/cskh-aggregation.tokens';
import { MockChatbotAdapter } from '../messaging/infrastructure/adapters/mock/mock-cskh-aggregation.adapters';

@Module({
  providers: [MockChatbotAdapter, { provide: CHATBOT_PORT_TOKEN, useExisting: MockChatbotAdapter }],
  exports: [CHATBOT_PORT_TOKEN],
})
export class ChatbotModule {}
