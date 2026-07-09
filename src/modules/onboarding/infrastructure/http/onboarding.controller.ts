import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { CreateOnboardingRequestCommand } from '../../application/commands/create-onboarding-request.command';
import { SubmitDocumentsCommand } from '../../application/commands/submit-documents.command';
import { GetOnboardingStatusQuery } from '../../application/queries/get-onboarding-status.query';

@ApiTags('Onboarding')
@ApiBearerAuth('JWT-auth')
@Controller('onboarding')
export class OnboardingController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() body: { address: string; customerType: 'sinh_hoat' | 'san_xuat' | 'kcn'; documents: string[] },
  ) {
    return this.commandBus.execute(new CreateOnboardingRequestCommand(userId, body));
  }

  @Get(':requestId')
  async status(@Param('requestId') requestId: string) {
    return this.queryBus.execute(new GetOnboardingStatusQuery(requestId));
  }

  @Post(':requestId/documents')
  async submitDocuments(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
    @Body() body: { documents: string[] },
  ) {
    return this.commandBus.execute(
      new SubmitDocumentsCommand(requestId, userId, body.documents ?? []),
    );
  }
}
