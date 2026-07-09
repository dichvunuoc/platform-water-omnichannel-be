import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetDownloadUrlQuery, GetDownloadUrlResult } from '../get-download-url.query';
import type { GetDownloadUrlResponse } from '../../dtos/document.dto';

@QueryHandler(GetDownloadUrlQuery)
export class GetDownloadUrlHandler implements IQueryHandler<GetDownloadUrlQuery> {
  private readonly logger = new Logger(GetDownloadUrlHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetDownloadUrlQuery): Promise<GetDownloadUrlResult> {
    const { customerId, fileKey } = query;
    this.logger.log(`Getting download URL for customer ${customerId}, file ${fileKey}`);

    const result: PortResult<GetDownloadUrlResponse> =
      await this.portRegistry.execute<GetDownloadUrlResponse>(
        'document',
        'get-download-url',
        { customerId, fileKey },
      );

    const data = result?.data;
    if (!data) throw new PortFallbackException('document');
    return data;
  }
}
