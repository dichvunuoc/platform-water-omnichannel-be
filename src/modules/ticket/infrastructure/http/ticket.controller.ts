/**
 * Ticket Controller
 *
 * REST endpoints for incident report / ticket operations.
 * Thin pass-through: validates input → dispatches CQRS command/query → returns result.
 *
 * Story 5.1: AC#1,#3,#4 POST /tickets, AC#2 POST /tickets/upload-url
 * Story 5.2: AC#1 GET /tickets/:trackingId, AC#2 GET /tickets (history)
 *
 * Uses COMMAND_BUS_TOKEN for commands and QUERY_BUS_TOKEN for queries.
 * Pattern: TariffController (query bus injection) + PaymentController (command bus).
 */

import { Controller, Post, Get, Body, Param, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CreateTicketCommand } from '../../application/commands/create-ticket.command';
import { GetUploadUrlCommand } from '../../application/commands/get-upload-url.command';
import { SubmitFeedbackCommand } from '../../application/commands/submit-feedback.command';
import { GetTicketStatusQuery } from '../../application/queries/get-ticket-status.query';
import { GetTicketHistoryQuery } from '../../application/queries/get-ticket-history.query';
import {
  CreateTicketRequestSchema,
  GetUploadUrlRequestSchema,
  TicketHistoryQuerySchema,
  SubmitFeedbackRequestSchema,
} from '../../application/dtos/ticket.dto';
import { ValidationException } from '@core/common';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';

@ApiTags('Tickets')
@ApiBearerAuth('JWT-auth')
@Controller('tickets')
export class TicketController {

  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  /**
   * GET /tickets
   * List ticket history with pagination and filters (AC#2 — FR46)
   *
   * MUST be defined BEFORE GET /tickets/:trackingId to avoid route conflict.
   */
  @Get()
  @ApiOperation({ summary: 'Get ticket history' })
  async getTicketHistory(
    @CurrentUser('id') userId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const validated = TicketHistoryQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }

    return this.queryBus.execute(
      new GetTicketHistoryQuery(
        userId,
        validated.data.status,
        validated.data.page,
        validated.data.pageSize,
      ),
    );
  }

  /**
   * GET /tickets/:trackingId
   * Track ticket status with full timeline (AC#1 — FR43)
   */
  @Get(':trackingId')
  @ApiOperation({ summary: 'Track ticket status with timeline' })
  async getTicketStatus(
    @Param('trackingId') trackingId: string,
  ) {
    return this.queryBus.execute(new GetTicketStatusQuery(trackingId));
  }

  /**
   * POST /tickets/:trackingId/feedback
   * Submit CSAT feedback for a closed ticket (AC#1, #2 — FR45)
   */
  @Post(':trackingId/feedback')
  @ApiOperation({ summary: 'Submit CSAT feedback for a ticket' })
  async submitFeedback(
    @CurrentUser('id') userId: string,
    @Param('trackingId') trackingId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = SubmitFeedbackRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }

    return this.commandBus.execute(
      new SubmitFeedbackCommand(
        trackingId,
        userId,
        validated.data.score,
        validated.data.comment,
      ),
    );
  }

  /**
   * POST /tickets
   * Submit incident report / create ticket (AC#1, #3, #4)
   */
  @Post()
  @ApiOperation({ summary: 'Submit incident report / create ticket' })
  async createTicket(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = CreateTicketRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }

    return this.commandBus.execute(
      new CreateTicketCommand(
        userId,
        validated.data.type,
        validated.data.description,
        validated.data.imageUrls,
      ),
    );
  }

  /**
   * POST /tickets/upload-url
   * Get presigned URL for photo upload (AC#2 — FR58, FR60)
   */
  @Post('upload-url')
  @ApiOperation({ summary: 'Get presigned URL for photo upload' })
  async getUploadUrl(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = GetUploadUrlRequestSchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }

    return this.commandBus.execute(
      new GetUploadUrlCommand(userId, validated.data.fileName, validated.data.fileType),
    );
  }
}
