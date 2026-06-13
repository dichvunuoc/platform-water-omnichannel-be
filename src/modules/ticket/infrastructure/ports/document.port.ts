/**
 * Document Port Interface & Mock Adapter
 *
 * Defines the contract for downstream document service communication.
 * MockDocumentAdapter returns mock data during development.
 *
 * AC: #2 (presigned URL for photo upload — FR58, FR60)
 *
 * Cache tier: transaction (NO CACHE) — presigned URLs are one-time use.
 *
 * NOTE: This port lives in the ticket module because document upload is
 * currently only needed for ticket photo attachments. If a dedicated
 * document module is created later, this port can be moved there.
 * Same pattern as debt.port.ts living in payment module.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { GetUploadUrlResponseSchema } from '../../application/dtos/ticket.dto';

/**
 * Document Port Interface
 *
 * Methods: get-upload-url (Story 5.1)
 * Future: get-download-url, delete-file, get-file-info
 * Each method is dispatched via PortRegistry.execute('document', method, params).
 */
export interface IDocumentPort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Document Adapter
 *
 * Returns mock document responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockDocumentAdapter extends MockAdapterBase implements IDocumentPort {
  constructor() {
    super(
      'document',
      {
        'get-upload-url': GetUploadUrlResponseSchema,
      },
      new Logger('document-mock-adapter'),
    );
  }
}
