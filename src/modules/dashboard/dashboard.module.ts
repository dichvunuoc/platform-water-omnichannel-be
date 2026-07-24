/** DashboardModule — điều hành CSKH metrics port (aggregate read-model). Mock default. */
import { Module } from '@nestjs/common';
import { DASHBOARD_PORT_TOKEN, MockDashboardAdapter } from './dashboard.adapter';

@Module({
  providers: [MockDashboardAdapter, { provide: DASHBOARD_PORT_TOKEN, useExisting: MockDashboardAdapter }],
  exports: [DASHBOARD_PORT_TOKEN],
})
export class DashboardModule {}
