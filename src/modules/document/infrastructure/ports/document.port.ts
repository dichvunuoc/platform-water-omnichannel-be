/**
 * Document Port Interface & Mock Adapter
 *
 * Owns the 'document' downstream port (extracted from the ticket module).
 * Methods are dispatched via PortRegistry.execute('document', method, params).
 *
 * Cache tier: transaction (NO CACHE) — presigned URLs are one-time use (FR58/FR60).
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  GetUploadUrlResponseSchema,
  GetDownloadUrlResponseSchema,
  DocumentListResponseSchema,
} from '../../application/dtos/document.dto';

export interface IDocumentPort extends IPortAdapter {
  // Methods: get-upload-url, get-download-url, get-list
  // (dispatched via execute(method, params) from IPortAdapter)
}

/**
 * Mock Document Adapter — reads mocks/document/*.json + Zod-validates.
 */
@Injectable()
export class MockDocumentAdapter extends MockAdapterBase implements IDocumentPort {
  constructor() {
    super(
      'document',
      {
        'get-upload-url': GetUploadUrlResponseSchema,
        'get-download-url': GetDownloadUrlResponseSchema,
        'get-list': DocumentListResponseSchema,
      },
      new Logger('document-mock-adapter'),
    );
  }
}
