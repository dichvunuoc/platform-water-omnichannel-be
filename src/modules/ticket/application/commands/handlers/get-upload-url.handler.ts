/**
 * Get Upload URL Command Handler (AC#2 — FR58, FR60)
 *
 * Calls Document Service via PortRegistry to get a presigned upload URL.
 * Cache tier: transaction — presigned URLs are one-time use, NO CACHE.
 *
 * Pattern: SetupAutoDebitHandler (single port call, null guard).
 */

import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { GetUploadUrlCommand, GetUploadUrlResult } from '../get-upload-url.command';
import type { GetUploadUrlResponse } from '../../dtos/ticket.dto';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';

@CommandHandler(GetUploadUrlCommand)
export class GetUploadUrlHandler implements ICommandHandler<GetUploadUrlCommand> {
  private readonly logger = new Logger(GetUploadUrlHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: GetUploadUrlCommand): Promise<GetUploadUrlResult> {
    const { customerId, fileName, fileType } = command;

    this.logger.log(`Getting upload URL for customer: ${customerId}, file: ${fileName}`);

    const result: PortResult<GetUploadUrlResponse> =
      await this.portRegistry.execute<GetUploadUrlResponse>(
        'document',
        'get-upload-url',
        { customerId, fileName, fileType, metadata: { source: 'incident_report' } },
      );

    const uploadInfo = result?.data;

    if (!uploadInfo) {
      throw new PortFallbackException('document');
    }

    return uploadInfo;
  }
}
