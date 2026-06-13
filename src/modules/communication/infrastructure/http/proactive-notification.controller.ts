/**
 * Proactive Notification Controller
 *
 * REST endpoints for proactive area alert operations.
 * Thin pass-through: validates input → dispatches CQRS query/command → returns result.
 *
 * AC: #1 (active alerts), #2 (alert history), #3 (acknowledge), #4 (dynamic cache)
 *
 * Uses BOTH buses: QUERY_BUS_TOKEN (reads) + COMMAND_BUS_TOKEN (acknowledge — write).
 *
 * ⚠️ Route ordering: GET /active and GET /history MUST come BEFORE any :alertId routes.
 */

import { Controller, Get, Post, Query, Param, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN, COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import type { ICommandBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetActiveAlertsQuery } from '../../application/queries/get-active-alerts.query';
import { GetAlertHistoryQuery } from '../../application/queries/get-alert-history.query';
import { AcknowledgeAlertCommand } from '../../application/commands/acknowledge-alert.command';
import {
  AlertHistoryQuerySchema,
  AlertIdParamSchema,
} from '../../application/dtos/proactive-notification.dto';
import { ValidationException } from '@core/common';

@ApiTags('Proactive Alerts')
@ApiBearerAuth('JWT-auth')
@Controller('proactive-notifications')
export class ProactiveNotificationController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * GET /proactive-notifications/active
   * Get active alerts for customer's area (AC#1)
   */
  @Get('active')
  @ApiOperation({ summary: 'Get active alerts for customer area' })
  async getActiveAlerts(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetActiveAlertsQuery(userId));
  }

  /**
   * GET /proactive-notifications/history
   * Get alert history with optional filters (AC#2)
   *
   * ⚠️ MUST be defined BEFORE any @Post(':alertId/...') routes — NestJS route ordering
   */
  @Get('history')
  @ApiOperation({ summary: 'Get alert history' })
  async getAlertHistory(
    @CurrentUser('id') userId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const validated = AlertHistoryQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }
    return this.queryBus.execute(new GetAlertHistoryQuery(userId, validated.data));
  }

  /**
   * POST /proactive-notifications/:alertId/acknowledge
   * Acknowledge an alert (AC#3)
   */
  @Post(':alertId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  async acknowledgeAlert(
    @CurrentUser('id') userId: string,
    @Param() params: Record<string, string>,
  ) {
    const validated = AlertIdParamSchema.safeParse(params);
    if (!validated.success) {
      throw new ValidationException(validated.error.message);
    }
    return this.commandBus.execute(
      new AcknowledgeAlertCommand(validated.data.alertId, userId),
    );
  }
}
