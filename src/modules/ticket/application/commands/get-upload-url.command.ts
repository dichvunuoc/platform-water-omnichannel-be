/**
 * Get Upload URL Command (AC#2)
 *
 * Generates a presigned upload URL for ticket attachments.
 *
 * Flow:
 * 1. Customer requests upload URL with file name + type
 * 2. Backend generates presigned URL via document port
 * 3. Return upload URL, file key, and expiry
 */

import { ICommand } from '@core/application';
import type { GetUploadUrlResponse, GetUploadUrlRequest } from '../dtos/ticket.dto';

export class GetUploadUrlCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly fileName: string,
    public readonly fileType: GetUploadUrlRequest['fileType'],
  ) {}
}

export type GetUploadUrlResult = GetUploadUrlResponse;
