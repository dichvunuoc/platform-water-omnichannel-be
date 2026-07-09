import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { GetContractQuery } from '../../application/queries/get-contract.query';
import { SignContractCommand } from '../../application/commands/sign-contract.command';

@ApiTags('e-Contract')
@ApiBearerAuth('JWT-auth')
@Controller('econtracts')
export class EcontractController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  @Get(':dossierId')
  async get(@CurrentUser('id') userId: string, @Param('dossierId') dossierId: string) {
    return this.queryBus.execute(new GetContractQuery(userId, dossierId));
  }

  @Post(':dossierId/sign')
  async sign(
    @CurrentUser('id') userId: string,
    @Param('dossierId') dossierId: string,
    @Body() body: { signatureRef: string },
  ) {
    return this.commandBus.execute(
      new SignContractCommand(userId, dossierId, body.signatureRef),
    );
  }
}
