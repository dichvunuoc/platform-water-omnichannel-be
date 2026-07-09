import { IQuery } from '@core/application';
import type { DocumentListResponse } from '../dtos/document.dto';

export class GetDocumentListQuery extends IQuery<DocumentListResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}

export type GetDocumentListResult = DocumentListResponse;
