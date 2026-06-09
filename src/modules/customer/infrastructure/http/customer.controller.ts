/**
 * Customer Controller
 *
 * REST endpoints for customer profile operations.
 * Thin pass-through: validates input → dispatches CQRS → returns result.
 *
 * AC: #1 (profile), #2 (timeline), #3 (update), #4 (related accounts)
 */

import { Controller, Get, Put, Body, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN, COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus, ICommandBus } from '@core/application';
import { GetCustomerProfileQuery } from '../../application/queries/get-customer-profile.query';
import { GetCustomerTimelineQuery } from '../../application/queries/get-customer-timeline.query';
import { GetRelatedAccountsQuery } from '../../application/queries/get-related-accounts.query';
import { UpdateCustomerProfileCommand } from '../../application/commands/update-customer-profile.command';
import { UpdateProfileSchema } from '../../application/dtos/update-profile.dto';
import { ValidationException } from '@core/common';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';

@ApiTags('Customer')
@ApiBearerAuth('JWT-auth')
@Controller('customers')
export class CustomerController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  /**
   * GET /customers/profile
   * Get customer 360° profile (AC#1)
   */
  @Get('profile')
  @ApiOperation({ summary: 'Get customer 360° profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetCustomerProfileQuery(userId));
  }

  /**
   * GET /customers/timeline
   * Get customer interaction timeline (AC#2)
   */
  @Get('timeline')
  @ApiOperation({ summary: 'Get customer interaction timeline' })
  async getTimeline(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetCustomerTimelineQuery(userId));
  }

  /**
   * GET /customers/related-accounts
   * Get related accounts — KCN relationship tree (AC#4)
   */
  @Get('related-accounts')
  @ApiOperation({ summary: 'Get related accounts (KCN relationship tree)' })
  async getRelatedAccounts(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetRelatedAccountsQuery(userId));
  }

  /**
   * PUT /customers/profile
   * Update customer contact info (AC#3)
   * Handler invalidates cache + re-fetches fresh profile.
   */
  @Put('profile')
  @ApiOperation({ summary: 'Update customer contact info' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() body: unknown) {
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationException(parsed.error.message);
    }
    return this.commandBus.execute(new UpdateCustomerProfileCommand(userId, parsed.data));
  }
}
