/** DashboardModule port + token + mock adapter (điều hành CSKH → aggregate metrics). */
import { Injectable } from '@nestjs/common';
import { cskhDash, type DashboardData } from '../cskh-bff/cskh-fixture';

export const DASHBOARD_PORT_TOKEN = 'CSKH_DASHBOARD_PORT';
export interface IDashboardPort {
  get(): DashboardData;
}

@Injectable()
export class MockDashboardAdapter implements IDashboardPort {
  get() {
    return cskhDash;
  }
}
