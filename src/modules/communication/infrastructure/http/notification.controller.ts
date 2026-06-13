/**
 * Notification Controller
 *
 * REST endpoints for notification preferences and history.
 * Thin pass-through: validates input → dispatches CQRS query/command → returns result.
 *
 * AC: #1 (get preferences), #2 (update preferences), #3 (history)
 *
 * ⚠️ Route ordering: GET /preferences and GET /history MUST come BEFORE any :id routes.
 */

import { Controller, Get, Patch, Body, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN, COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import type { ICommandBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetNotificationPreferencesQuery } from '../../application/queries/get-notification-preferences.query';
import { GetNotificationHistoryQuery } from '../../application/queries/get-notification-history.query';
import { UpdateNotificationPreferencesCommand } from '../../application/commands/update-notification-preferences.command';
import {
  NotificationHistoryQuerySchema,
  UpdatePreferencesBodySchema,
} from '../../application/dtos/notification-preferences.dto';
import { ValidationException } from '@core/common';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * GET /notifications/preferences
   * Get notification preferences for the authenticated customer (AC#1)
   */
  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetNotificationPreferencesQuery(userId));
  }

  /**
   * PATCH /notifications/preferences
   * Update notification preferences (AC#2)
   */
  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const validated = UpdatePreferencesBodySchema.safeParse(body);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }
    return this.commandBus.execute(
      new UpdateNotificationPreferencesCommand(userId, validated.data),
    );
  }

  /**
   * GET /notifications/history
   * Get notification history with pagination and filters (AC#3)
   */
  @Get('history')
  @ApiOperation({ summary: 'Get notification history' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const validated = NotificationHistoryQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }
    return this.queryBus.execute(new GetNotificationHistoryQuery(userId, validated.data));
  }
}
