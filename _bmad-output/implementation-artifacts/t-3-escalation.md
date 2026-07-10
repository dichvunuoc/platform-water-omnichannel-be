# Story T-3: Escalation Engine

Status: ready-for-dev

## Story

As a supervisor,
I want tickets to auto-escalate when SLA warning/breach fires or CSAT <3,
so that urgent tickets reach the right authority automatically (FR26).

## Acceptance Criteria

1. **Warning escalation:** SlaWarning → ticket.escalate(EscalationLevel.TEAM_LEAD)
2. **Breach escalation:** SlaBreached → ticket.escalate(EscalationLevel.DEPT_HEAD)
3. **CSAT escalation:** rating <3 → immediate escalate(EscalationLevel.URGENT)
4. **Idempotent:** escalate() is idempotent — same level doesn't re-fire.
5. **Event:** escalation emits `TicketEscalated` event (consumed by OmniCare dashboard).

## DDD Structure

```
modules/ticketing/
  domain/
    value-objects/escalation-level.value-object.ts (TEAM_LEAD | DEPT_HEAD | URGENT)
    ticket.entity.ts
      escalate(level): sets _escalated=true + _escalationLevel, markAsModified
  application/
    commands/escalate.command.ts + handler
```

## References
- **PRD:** §2.4, FR-T4
