/**
 * Session Controller
 *
 * REST endpoints for session data and events.
 * Thin pass-through: validates input → dispatches CQRS → returns result.
 *
 * AC: #1 (session detail), #2 (continuation), #3 (auto-create), #4 (events history)
 *
 * ⚠️ Route ordering: GET /me and GET /me/events MUST come BEFORE any :id routes.
 */

import { Controller, Get, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN, COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import type { ICommandBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetSessionDetailQuery } from '../../application/queries/get-session-detail.query';
import { GetSessionEventsQuery } from '../../application/queries/get-session-events.query';
import { EnsureSessionCommand } from '../../application/commands/ensure-session.command';
import { SessionEventsQuerySchema } from '../../application/dtos/session-query.dto';
import { ChannelTypeSchema } from '../../domain/events/session-event.types';
import { ValidationException } from '@core/common';

@ApiTags('Sessions')
@ApiBearerAuth('JWT-auth')
@Controller('sessions')
export class SessionController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * GET /sessions/me
   * Get current session metadata + recent events (last 2h) (AC#1, #2, #3)
   *
   * Triggers EnsureSessionCommand to auto-create/continue session.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current session detail' })
  async getSessionDetail(
    @CurrentUser('id') userId: string,
    @Query('channel') channel?: string,
  ) {
    // Validate channel param, default to 'web'
    const effectiveChannel = channel || 'web';
    const channelResult = ChannelTypeSchema.safeParse(effectiveChannel);
    if (!channelResult.success) {
      throw new ValidationException(`Invalid channel: ${effectiveChannel}`);
    }
    await this.commandBus.execute(
      new EnsureSessionCommand(userId, channelResult.data),
    );

    return this.queryBus.execute(new GetSessionDetailQuery(userId));
  }

  /**
   * GET /sessions/me/events
   * Get session events with pagination and filters (AC#4)
   */
  @Get('me/events')
  @ApiOperation({ summary: 'Get session event history' })
  async getSessionEvents(
    @CurrentUser('id') userId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const validated = SessionEventsQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }
    return this.queryBus.execute(
      new GetSessionEventsQuery(userId, validated.data),
    );
  }
}
