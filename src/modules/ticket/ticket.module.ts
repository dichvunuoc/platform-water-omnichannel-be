/**
 * Ticket Module
 *
 * NestJS module for ticket, document upload, and knowledge base operations.
 * Registers three port adapters with PortRegistry via onModuleInit.
 *
 * Three ports, one module:
 *   ticket         — cacheTier: dynamic (5-15 min cache, FR41-FR46)
 *   document       — cacheTier: transaction (NO CACHE, FR58/FR60 — presigned URLs)
 *   knowledge-base — cacheTier: static (12-24h cache, FR47-FR49)
 *
 * Story 5.1: CreateTicketHandler, GetUploadUrlHandler
 * Story 5.2: GetTicketStatusHandler, GetTicketHistoryHandler, HandleTicketWebhookHandler, TicketWebhookController
 * Story 5.3: SubmitFeedbackHandler
 * Story 5.4: GetKbCategoriesHandler, SearchArticlesHandler, GetArticleHandler, RateArticleHandler, KnowledgeBaseController
 *
 * Pattern: PaymentModule (multi-port, OnModuleInit, useExisting).
 * Module ordering: ...PaymentModule → TicketModule → AuthPropagationModule → PortModule
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { TicketController } from './infrastructure/http/ticket.controller';
import { TicketWebhookController } from './infrastructure/http/ticket-webhook.controller';
import { KnowledgeBaseController } from './infrastructure/http/knowledge-base.controller';
import { MockTicketAdapter } from './infrastructure/ports/ticket.port';
import { MockDocumentAdapter } from './infrastructure/ports/document.port';
import { MockKnowledgeBaseAdapter } from './infrastructure/ports/knowledge-base.port';
import { TICKET_PORT_TOKEN, DOCUMENT_PORT_TOKEN, KNOWLEDGE_BASE_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { CreateTicketHandler } from './application/commands/handlers/create-ticket.handler';
import { GetUploadUrlHandler } from './application/commands/handlers/get-upload-url.handler';
import { HandleTicketWebhookHandler } from './application/commands/handlers/handle-ticket-webhook.handler';
import { SubmitFeedbackHandler } from './application/commands/handlers/submit-feedback.handler';
import { RateArticleHandler } from './application/commands/handlers/rate-article.handler';
import { GetTicketStatusHandler } from './application/queries/handlers/get-ticket-status.handler';
import { GetTicketHistoryHandler } from './application/queries/handlers/get-ticket-history.handler';
import { GetKbCategoriesHandler } from './application/queries/handlers/get-kb-categories.handler';
import { SearchArticlesHandler } from './application/queries/handlers/search-articles.handler';
import { GetArticleHandler } from './application/queries/handlers/get-article.handler';

@Module({
  controllers: [TicketController, TicketWebhookController, KnowledgeBaseController],
  providers: [
    // Port Adapters (single instance shared via useExisting)
    MockTicketAdapter,
    {
      provide: TICKET_PORT_TOKEN,
      useExisting: MockTicketAdapter,
    },
    MockDocumentAdapter,
    {
      provide: DOCUMENT_PORT_TOKEN,
      useExisting: MockDocumentAdapter,
    },
    MockKnowledgeBaseAdapter,
    {
      provide: KNOWLEDGE_BASE_PORT_TOKEN,
      useExisting: MockKnowledgeBaseAdapter,
    },
    // CQRS Command Handlers
    CreateTicketHandler,
    GetUploadUrlHandler,
    HandleTicketWebhookHandler,
    SubmitFeedbackHandler,
    RateArticleHandler,
    // CQRS Query Handlers
    GetTicketStatusHandler,
    GetTicketHistoryHandler,
    GetKbCategoriesHandler,
    SearchArticlesHandler,
    GetArticleHandler,
  ],
  exports: [TICKET_PORT_TOKEN, DOCUMENT_PORT_TOKEN, KNOWLEDGE_BASE_PORT_TOKEN],
})
export class TicketModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockTicketAdapter: MockTicketAdapter,
    private readonly mockDocumentAdapter: MockDocumentAdapter,
    private readonly mockKbAdapter: MockKnowledgeBaseAdapter,
  ) {}

  /**
   * Register ports with PortRegistry on module init.
   * ticket: dynamic tier — 5-15 min cache (FR41-FR46)
   * document: transaction tier — NO CACHE (FR58/FR60 — presigned URLs)
   * knowledge-base: static tier — 12-24h cache (FR47-FR49)
   */
  onModuleInit() {
    this.portRegistry.register(
      'ticket',
      this.mockTicketAdapter,
      this.mockTicketAdapter,
    );
    this.portRegistry.register(
      'document',
      this.mockDocumentAdapter,
      this.mockDocumentAdapter,
    );
    this.portRegistry.register(
      'knowledge-base',
      this.mockKbAdapter,
      this.mockKbAdapter,
    );
  }
}
