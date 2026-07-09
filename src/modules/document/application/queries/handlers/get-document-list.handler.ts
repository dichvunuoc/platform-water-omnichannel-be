import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetDocumentListQuery, GetDocumentListResult } from '../get-document-list.query';
import type { DocumentListResponse } from '../../dtos/document.dto';

@QueryHandler(GetDocumentListQuery)
export class GetDocumentListHandler implements IQueryHandler<GetDocumentListQuery> {
  private readonly logger = new Logger(GetDocumentListHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetDocumentListQuery): Promise<GetDocumentListResult> {
    const { customerId } = query;
    this.logger.log(`Listing documents for customer ${customerId}`);

    const result: PortResult<DocumentListResponse> =
      await this.portRegistry.execute<DocumentListResponse>(
        'document',
        'get-list',
        { customerId },
      );

    const data = result?.data;
    if (!data) throw new PortFallbackException('document');
    return data;
  }
}
