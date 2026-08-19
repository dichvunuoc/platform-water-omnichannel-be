/**
 * DashboardModule port + token + adapters.
 *
 * MockDashboardAdapter: đọc cskh-fixture (static demo data).
 * RealDashboardAdapter: aggregate từ ConversationReadDao + TicketRepository (real DB).
 * Swap qua config: DASHBOARD_REAL=true → real, default → mock.
 */
import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { cskhDash, type DashboardData } from '../cskh-bff/cskh-fixture';
import { CONVERSATION_READ_DAO_TOKEN } from '../messaging/constants/tokens';
import type { ConversationReadDao } from '../messaging/infrastructure/persistence/read/conversation-read-dao';
import { TICKET_REPOSITORY_TOKEN } from '../ticketing/constants';
import type { ITicketRepository, Ticket } from '../ticketing/domain';

export const DASHBOARD_PORT_TOKEN = 'CSKH_DASHBOARD_PORT';
export interface IDashboardPort {
  get(): Promise<DashboardData>;
}

// ─── Mock (fixture, static demo data) ─────────────────────────────────────────
@Injectable()
export class MockDashboardAdapter implements IDashboardPort {
  async get(): Promise<DashboardData> {
    return cskhDash;
  }
}

// ─── Real (aggregate từ DB) ───────────────────────────────────────────────────
@Injectable()
export class RealDashboardAdapter implements IDashboardPort {
  private readonly logger = new Logger('RealDashboardAdapter');

  constructor(
    @Inject(CONVERSATION_READ_DAO_TOKEN)
    private readonly readDao: ConversationReadDao,
    @Inject(TICKET_REPOSITORY_TOKEN)
    private readonly ticketRepo: ITicketRepository,
  ) {}

  async get(): Promise<DashboardData> {
    // 1. Conversation metrics
    const [activeCount, inboxPage] = await Promise.all([
      this.readDao.countActive(),
      this.readDao.findInbox({}, 1, 100),
    ]);

    // Volume by channel (từ inbox items)
    const channelMap = new Map<string, number>();
    for (const item of inboxPage.items) {
      const ch = (item.channel || 'unknown').toLowerCase();
      channelMap.set(ch, (channelMap.get(ch) ?? 0) + 1);
    }
    const volByChannel = Array.from(channelMap.entries()).map(([ch, n]) => ({
      ch,
      n,
    }));

    // Hourly distribution (từ createdAt hour of day)
    const hourly = new Array(24).fill(0);
    for (const item of inboxPage.items) {
      const d =
        item.createdAt instanceof Date
          ? item.createdAt
          : new Date(item.createdAt);
      if (!isNaN(d.getTime())) hourly[d.getHours()]++;
    }

    // 2. Ticket metrics
    const allTickets = await this.ticketRepo.findAll();
    const openTickets = allTickets.filter(
      (t) => t.stage.value !== 'RESOLVED' && t.stage.value !== 'CLOSED',
    );

    // SLA computation
    const now = Date.now();
    let breached = 0;
    let warning = 0;
    const stageMap = new Map<string, number>();
    for (const t of openTickets) {
      const stage = t.stage.value;
      stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
      const resolveMs =
        t.resolveDeadline instanceof Date
          ? t.resolveDeadline.getTime()
          : new Date(t.resolveDeadline as any).getTime();
      const remaining = resolveMs - now;
      if (remaining <= 0) breached++;
      else if (remaining < 30 * 60 * 1000) warning++;
    }

    const totalForSla = openTickets.length;
    const slaComplianceRate =
      totalForSla > 0
        ? Math.round(((totalForSla - breached) / totalForSla) * 1000) / 10
        : 100;

    // 3. Build KPIs
    const kpis = [
      {
        label: 'Hội thoại đang mở',
        value: activeCount,
        unit: 'conv',
        icon: 'IcInbox',
        tone: '#8250DF',
        sub: `${inboxPage.total} tổng hội thoại`,
        up: true,
      },
      {
        label: 'Vé đang mở',
        value: openTickets.length,
        unit: 'vé',
        icon: 'IcChat',
        tone: '#0969DA',
        sub: `${breached} vé trễ SLA`,
        up: false,
      },
      {
        label: 'Đúng hạn SLA',
        value: slaComplianceRate,
        unit: '%',
        icon: 'IcClock',
        tone: '#1A7F37',
        sub: `Mục tiêu ≥ 92%`,
        up: slaComplianceRate >= 92,
      },
      {
        label: 'Cảnh báo SLA',
        value: warning,
        unit: 'vé',
        icon: 'IcStar',
        tone: '#9A6700',
        sub: `${breached} đã trễ hạn`,
        up: false,
      },
    ];

    this.logger.log(
      `Dashboard aggregate: ${activeCount} conv, ${openTickets.length} tickets, ${breached} breached, ${slaComplianceRate}% SLA`,
    );

    return {
      kpis,
      volByChannel,
      volByTopic: [], // Phase 1.5+ (cần topic classification)
      hourly,
      slaTrend: [], // Phase 1.5+ (cần historical data)
      agents: [], // Phase 1.5+ (cần agent metrics)
    };
  }
}
