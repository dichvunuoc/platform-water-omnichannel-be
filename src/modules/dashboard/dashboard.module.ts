/** DashboardModule — điều hành CSKH metrics port (aggregate read-model). Mock default. */
import { Module } from '@nestjs/common';
import { DASHBOARD_PORT_TOKEN } from '../messaging/constants/cskh-aggregation.tokens';
import { MockDashboardAdapter } from '../messaging/infrastructure/adapters/mock/mock-cskh-aggregation.adapters';

@Module({
  providers: [MockDashboardAdapter, { provide: DASHBOARD_PORT_TOKEN, useExisting: MockDashboardAdapter }],
  exports: [DASHBOARD_PORT_TOKEN],
})
export class DashboardModule {}
