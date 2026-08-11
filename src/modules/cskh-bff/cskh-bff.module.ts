/**
 * CskhBffModule — CSKH agent-desktop BFF API layer. Hosts CskhController (/api/cskh/*).
 * Imports 9 service modules (port tokens qua exports). Tách biệt Messaging core
 * (ingest/conversation) — chỉ lo hợp đồng FE agent desktop.
 */
import { Module } from '@nestjs/common';
import { SharedCqrsModule } from 'src/libs/shared';
import { CskhController } from './cskh.controller';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationModule } from '../notification/notification.module';
import { Customer360Module } from '../customer-360/customer-360.module';
import { IncidentModule } from '../incident/incident.module';
import { TelephonyModule } from '../telephony/telephony.module';
import { CsatModule } from '../csat/csat.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { TicketingModule } from '../ticketing/ticketing.module';

@Module({
  imports: [
    SharedCqrsModule,
    MessagingModule,
    NotificationModule,
    Customer360Module,
    IncidentModule,
    TelephonyModule,
    CsatModule,
    KnowledgeModule,
    ChatbotModule,
    BroadcastModule,
    DashboardModule,
    TicketingModule,
  ],
  controllers: [CskhController],
})
export class CskhBffModule {}
