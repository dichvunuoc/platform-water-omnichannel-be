import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { CreateSurveyRequestCommand } from '../../application/commands/create-survey-request.command';
import { GetSurveyResultQuery } from '../../application/queries/get-survey-result.query';

@ApiTags('Site Survey')
@ApiBearerAuth('JWT-auth')
@Controller('site-surveys')
export class SiteSurveyController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() body: { address: string; preferredDate: string },
  ) {
    return this.commandBus.execute(
      new CreateSurveyRequestCommand(userId, body.address, body.preferredDate),
    );
  }

  @Get(':surveyId')
  async get(@Param('surveyId') surveyId: string) {
    return this.queryBus.execute(new GetSurveyResultQuery(surveyId));
  }
}
