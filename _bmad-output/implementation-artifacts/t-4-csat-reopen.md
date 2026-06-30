# Story T-4: CSAT Reopen

Status: ready-for-dev

## Story

As a customer,
I want my closed ticket to reopen if I rate <3 stars,
so that the company follows up within 24 hours (FR27).

## Acceptance Criteria

1. **Reopen:** rating <3 + ticket CLOSED → `ticket.reopenFromCsat()` → IN_PROGRESS + escalated=true.
2. **New SLA:** reopen sets a new 24h resolve deadline (24/7, hard).
3. **30-day limit:** reopen rejected if CLOSED >30 days.
4. **Event:** emits `TicketReopened` (OmniCare dashboard + Kanban updates).

## DDD Structure

```
modules/ticketing/
  domain/
    ticket.entity.ts
      reopenFromCsat(): CLOSED→IN_PROGRESS + new 24h SLA + escalate(URGENT)
  application/
    commands/handle-csat.command.ts + handler
```

## References
- **PRD:** §2.5, FR-T5
