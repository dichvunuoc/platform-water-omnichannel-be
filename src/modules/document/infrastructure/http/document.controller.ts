import {
  Controller,
  Get,
  Inject,
  Logger,
  Query,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetDownloadUrlQuery } from '../../application/queries/get-download-url.query';
import { GetDocumentListQuery } from '../../application/queries/get-document-list.query';

/**
 * Document Controller — canonical /documents surface (download-url + list).
 * Upload-url for ticket attachments remains on the ticket endpoint.
 */
@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get(':fileKey/download-url')
  @ApiOperation({ summary: 'Get a presigned download URL for a document' })
  @ApiResponse({ status: 200, description: 'Presigned download URL' })
  async getDownloadUrl(
    @CurrentUser('id') userId: string,
    @Param('fileKey') fileKey: string,
  ) {
    return this.queryBus.execute(new GetDownloadUrlQuery(userId, fileKey));
  }

  @Get()
  @ApiOperation({ summary: 'List documents for the authenticated customer' })
  @ApiResponse({ status: 200, description: 'Document list' })
  async listDocuments(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetDocumentListQuery(userId));
  }
}
