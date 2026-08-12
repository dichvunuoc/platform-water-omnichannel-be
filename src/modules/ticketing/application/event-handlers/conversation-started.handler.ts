/**
 * ConversationStartedTicketHandler — DISABLED (Phase 2c fix).
 *
 * Trước: auto-create Ticket cho MỌI conversation mới → sai domain:
 * đa số tin nhắn là hỏi đáp/góp ý, không cần Ticket + SLA.
 *
 * Fix: Ticket tạo CỐ Ý qua POST /bff/conversations/:id/create-ticket (FR19),
 * do agent quyết định. Handler giữ lại (không xóa) để dễ re-enable nếu cần
 * classification-driven auto-create sau này.
 */
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ConversationStartedTicketHandler {
  private readonly logger = new Logger('ConversationStartedTicketHandler');

  constructor() {
    this.logger.log('DISABLED — ticket tạo thủ công qua FR19 (agent quyết định), không auto-create');
  }
}
