/**
 * 7 CSKH aggregation modules (lean port-adapter) — mỗi module 1 domain, Mock default,
 * export token. Khi service sẵn → thêm RealAdapter + useFactory (giống NotificationModule).
 * 7 class trong 1 file (gộp cho gọn; mỗi class = 1 module DI riêng).
 */
import { Module } from '@nestjs/common';
import {
  INCIDENT_PORT_TOKEN,
  TELEPHONY_PORT_TOKEN,
  CSAT_PORT_TOKEN,
  KNOWLEDGE_PORT_TOKEN,
  CHATBOT_PORT_TOKEN,
  BROADCAST_PORT_TOKEN,
  DASHBOARD_PORT_TOKEN,
} from '../messaging/constants/cskh-aggregation.tokens';
import {
  MockIncidentAdapter,
  MockTelephonyAdapter,
  MockCsatAdapter,
  MockKnowledgeAdapter,
  MockChatbotAdapter,
  MockBroadcastAdapter,
  MockDashboardAdapter,
} from '../messaging/infrastructure/adapters/mock/mock-cskh-aggregation.adapters';

@Module({
  providers: [MockIncidentAdapter, { provide: INCIDENT_PORT_TOKEN, useExisting: MockIncidentAdapter }],
  exports: [INCIDENT_PORT_TOKEN],
})
export class IncidentModule {}

@Module({
  providers: [MockTelephonyAdapter, { provide: TELEPHONY_PORT_TOKEN, useExisting: MockTelephonyAdapter }],
  exports: [TELEPHONY_PORT_TOKEN],
})
export class TelephonyModule {}

@Module({
  providers: [MockCsatAdapter, { provide: CSAT_PORT_TOKEN, useExisting: MockCsatAdapter }],
  exports: [CSAT_PORT_TOKEN],
})
export class CsatModule {}

@Module({
  providers: [MockKnowledgeAdapter, { provide: KNOWLEDGE_PORT_TOKEN, useExisting: MockKnowledgeAdapter }],
  exports: [KNOWLEDGE_PORT_TOKEN],
})
export class KnowledgeModule {}

@Module({
  providers: [MockChatbotAdapter, { provide: CHATBOT_PORT_TOKEN, useExisting: MockChatbotAdapter }],
  exports: [CHATBOT_PORT_TOKEN],
})
export class ChatbotModule {}

@Module({
  providers: [MockBroadcastAdapter, { provide: BROADCAST_PORT_TOKEN, useExisting: MockBroadcastAdapter }],
  exports: [BROADCAST_PORT_TOKEN],
})
export class BroadcastModule {}

@Module({
  providers: [MockDashboardAdapter, { provide: DASHBOARD_PORT_TOKEN, useExisting: MockDashboardAdapter }],
  exports: [DASHBOARD_PORT_TOKEN],
})
export class DashboardModule {}
