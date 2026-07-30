/**
 * DashboardModule — điều hành CSKH metrics port.
 * Imports MessagingModule (CONVERSATION_READ_DAO) + TicketingModule (TICKET_REPOSITORY)
 * để RealDashboardAdapter có đủ deps. Mock fallback vẫn available.
 */
import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { TicketingModule } from '../ticketing/ticketing.module';
import { DASHBOARD_PORT_TOKEN, MockDashboardAdapter, RealDashboardAdapter } from './dashboard.adapter';

@Module({
  imports: [MessagingModule, TicketingModule],
  providers: [
    MockDashboardAdapter,
    RealDashboardAdapter,
    { provide: DASHBOARD_PORT_TOKEN, useExisting: RealDashboardAdapter },
  ],
  exports: [DASHBOARD_PORT_TOKEN],
})
export class DashboardModule {}
