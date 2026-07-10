# Story T-2: Dual-Clock SLA Engine

Status: ready-for-dev

## Story

As a Ticketing service,
I want to track two SLA countdowns (acknowledge + resolve) per ticket with P0/P1=24/7 and P2/P3=business-hours,
so that approaching breaches trigger SlaWarning and past-deadline triggers SlaBreached (FR24).

## Acceptance Criteria

1. **Dual clock:** each ticket has `ackDeadline` + `resolveDeadline` computed from priority policy at creation.
2. **Business-hours computation:** P2/P3 SLA pauses outside 08:00–17:00 Mon–Fri. P0/P1 counts 24/7.
3. **Background worker:** `@Cron(EVERY_MINUTE)` scans open tickets → computes remaining → emits events.
4. **Warning:** <30 min remaining → `SlaWarning` (once per ticket per clock).
5. **Breach:** past deadline → `SlaBreached`.
6. **Ack clock stops:** on first agent response (auto RECEIVED→IN_PROGRESS sets `acknowledgedAt`).

## DDD Structure

```
modules/ticketing/
  domain/
    value-objects/sla-policy.value-object.ts
      (ackMs + resolveMs + schedule: '24/7' | 'BUSINESS_HOURS')
    services/sla-calculator.domain-service.ts
      (pure function: given createdAt, acknowledgedAt?, priority → { ackRemaining, resolveRemaining })
  infrastructure/
    sla-worker/sla-worker.service.ts
      (@Cron — query open tickets, compute via SlaCalculator, emit events via EventEmitterService)
```

## Dev Notes

### Business-hours calculation:
```typescript
// Pure domain service — no I/O, testable
function calculateRemainingMs(
  createdAt: Date,
  deadline: Date,
  schedule: '24/7' | 'BUSINESS_HOURS',
  now: Date = new Date()
): number {
  if (schedule === '24/7') return deadline.getTime() - now.getTime();
  // BUSINESS_HOURS: count only 08:00–17:00 Mon–Fri
  // Iterate from createdAt to now, sum elapsed business hours,
  // subtract from total SLA budget
}
```

### SLA policy table (seed):
```typescript
const POLICIES = {
  P0: { ackMs: 1*3600*1000,  resolveMs: 4*3600*1000,     schedule: '24/7' },
  P1: { ackMs: 2*3600*1000,  resolveMs: 8*3600*1000,     schedule: '24/7' },
  P2: { ackMs: 24*3600*1000, resolveMs: 7*24*3600*1000,  schedule: 'BUSINESS_HOURS' },
  P3: { ackMs: 48*3600*1000, resolveMs: 14*24*3600*1000, schedule: 'BUSINESS_HOURS' },
};
```

### Worker pattern (mirrors stub's sla-checker but real):
```typescript
@Cron(CronExpression.EVERY_MINUTE)
async checkSla() {
  const openTickets = await this.repo.findOpenTickets();
  for (const ticket of openTickets) {
    const { ackRemaining, resolveRemaining } = this.calculator.calculate(ticket);
    if (resolveRemaining <= 0) this.emitBreached(ticket);
    else if (resolveRemaining < 30*60*1000) this.emitWarning(ticket);
  }
}
```

## References
- **PRD:** §2.1 SLA table, FR-T3 — [prd-ticketing-sla-service.md](../../_bmad-output/planning-artifacts/prd-ticketing-sla-service.md)
- **Dependencies:** Epic T-1 (tickets exist)
