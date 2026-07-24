/**
 * CskhModule — CSKH BFF layer. Hosts CskhController (FE agent desktop contract,
 * /api/cskh/*). Imports 9 service modules (cung cấp port tokens qua exports).
 * Messaging core tách riêng (MessagingModule) — chỉ lo ingest/conversation/inbox.
 */
import { Module } from '@nestjs/common';
import { CskhController } from '../messaging/infrastructure/http/cskh.controller';
import { NotificationModule } from '../notification/notification.module';
import { Customer360Module } from '../customer-360/customer-360.module';
import {
  IncidentModule,
  TelephonyModule,
  CsatModule,
  KnowledgeModule,
  ChatbotModule,
  BroadcastModule,
  DashboardModule,
} from '../cskh-aggregation/cskh-aggregation.modules';

@Module({
  imports: [
    NotificationModule,
    Customer360Module,
    IncidentModule,
    TelephonyModule,
    CsatModule,
    KnowledgeModule,
    ChatbotModule,
    BroadcastModule,
    DashboardModule,
  ],
  controllers: [CskhController],
})
export class CskhModule {}
