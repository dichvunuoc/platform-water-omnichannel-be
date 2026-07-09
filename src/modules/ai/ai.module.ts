import { Module, OnModuleInit } from '@nestjs/common';
import { ChatbotController } from './infrastructure/http/chatbot.controller';
import { MockChatbotAdapter } from './infrastructure/ports/chatbot.port';
import { CHATBOT_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { SendChatbotMessageHandler } from './application/commands/handlers/send-chatbot-message.handler';
import { GetConversationHandler } from './application/queries/handlers/get-conversation.handler';

@Module({
  controllers: [ChatbotController],
  providers: [
    MockChatbotAdapter,
    { provide: CHATBOT_PORT_TOKEN, useExisting: MockChatbotAdapter },
    SendChatbotMessageHandler,
    GetConversationHandler,
  ],
  exports: [CHATBOT_PORT_TOKEN],
})
export class AiModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockChatbotAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('chatbot', this.mockAdapter, this.mockAdapter);
  }
}
