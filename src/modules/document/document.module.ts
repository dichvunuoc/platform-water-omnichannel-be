import { Module, OnModuleInit } from '@nestjs/common';
import { DocumentController } from './infrastructure/http/document.controller';
import { MockDocumentAdapter } from './infrastructure/ports/document.port';
import { DOCUMENT_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetDownloadUrlHandler } from './application/queries/handlers/get-download-url.handler';
import { GetDocumentListHandler } from './application/queries/handlers/get-document-list.handler';

/**
 * Document Module — owns the 'document' downstream port (transaction tier — no cache,
 * presigned URLs are one-time use). Extracted from the ticket module so document
 * upload/download/list is a first-class capability (FR58-FR60).
 *
 * Pattern: ...PaymentModule → TicketModule(imports DocumentModule) → CommunicationModule
 */
@Module({
  controllers: [DocumentController],
  providers: [
    MockDocumentAdapter,
    { provide: DOCUMENT_PORT_TOKEN, useExisting: MockDocumentAdapter },
    GetDownloadUrlHandler,
    GetDocumentListHandler,
  ],
  exports: [DOCUMENT_PORT_TOKEN],
})
export class DocumentModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockDocumentAdapter: MockDocumentAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register(
      'document',
      this.mockDocumentAdapter,
      this.mockDocumentAdapter,
    );
  }
}
