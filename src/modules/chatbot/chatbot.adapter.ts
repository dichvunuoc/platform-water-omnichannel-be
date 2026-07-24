/** ChatbotModule port + token + mock adapter (Zalo OA → chatbot service). */
import { Injectable } from '@nestjs/common';
import { cskhBot, type BotData } from '../cskh-bff/cskh-fixture';

export const CHATBOT_PORT_TOKEN = 'CSKH_CHATBOT_PORT';
export interface IChatbotPort {
  stats(): BotData;
  toggle(enabled: boolean): BotData;
}

@Injectable()
export class MockChatbotAdapter implements IChatbotPort {
  stats(): BotData {
    return cskhBot;
  }
  toggle(enabled: boolean): BotData {
    cskhBot.enabled = enabled;
    return cskhBot;
  }
}
