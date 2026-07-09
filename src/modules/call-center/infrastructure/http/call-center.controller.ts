import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { CreateClickToCallCommand } from '../../application/commands/create-click-to-call.command';
import { GetCallHistoryQuery } from '../../application/queries/get-call-history.query';

@ApiTags('Call Center')
@ApiBearerAuth('JWT-auth')
@Controller('call-center')
export class CallCenterController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  @Post('click-to-call')
  async clickToCall(
    @CurrentUser('id') userId: string,
    @Body() body: { phoneNumber: string },
  ) {
    return this.commandBus.execute(new CreateClickToCallCommand(userId, body.phoneNumber));
  }

  @Get('history')
  async history(@CurrentUser('id') userId: string) {
    return this.queryBus.execute(new GetCallHistoryQuery(userId));
  }
}
