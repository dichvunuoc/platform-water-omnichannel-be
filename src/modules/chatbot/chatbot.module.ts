/** ChatbotModule — Zalo OA chatbot port. Mock default. */
import { Module } from '@nestjs/common';
import { CHATBOT_PORT_TOKEN, MockChatbotAdapter } from './chatbot.adapter';

@Module({
  providers: [
    MockChatbotAdapter,
    { provide: CHATBOT_PORT_TOKEN, useExisting: MockChatbotAdapter },
  ],
  exports: [CHATBOT_PORT_TOKEN],
})
export class ChatbotModule {}
