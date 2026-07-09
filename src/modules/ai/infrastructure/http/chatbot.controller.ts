import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { ICommandBus, IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { SendChatbotMessageCommand } from '../../application/commands/send-chatbot-message.command';
import { GetConversationQuery } from '../../application/queries/get-conversation.query';

@ApiTags('Chatbot (AI)')
@ApiBearerAuth('JWT-auth')
@Controller('chatbot')
export class ChatbotController {
  constructor(
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  @Post('conversations/:conversationId/messages')
  async send(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
    @Body() body: { message: string },
  ) {
    return this.commandBus.execute(
      new SendChatbotMessageCommand(userId, conversationId, body.message),
    );
  }

  @Get('conversations/:conversationId')
  async conversation(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.queryBus.execute(new GetConversationQuery(userId, conversationId));
  }
}
