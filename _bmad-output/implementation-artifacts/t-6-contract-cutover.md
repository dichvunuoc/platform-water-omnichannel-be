# Story T-6: Contract Integration + Cutover

Status: ready-for-dev

## Story

As a system architect,
I want to replace the wave-1 stub with the real Ticketing service,
so that OmniCare calls the real service and both share contracts via monorepo (zero rewrite).

## Acceptance Criteria

1. **Shared contracts:** `src/contracts/` contains all event/command DTOs shared between both services.
2. **Separate bootstrap:** `src/apps/ticketing/main.ts` — NestJS app on port 3001 (imports TicketingModule + SharedInfra only).
3. **OmniCare BFF switch:** BffController calls `http://localhost:3001/bff/tickets/*` instead of in-process stub.
4. **Contract tests:** both services agree on event/command shapes (consumer-driven).
5. **Zero OmniCare rewrite:** only the base URL changes (stub→real).

## Structure

```
src/
  contracts/
    ticketing-events.ts     (SlaWarning, SlaBreached, TicketClosed, TicketStateChanged)
    ticketing-commands.ts   (TicketCreateRequested, TicketStateChanged, TicketReassignRequested)
    index.ts
  apps/
    ticketing/
      main.ts               (port 3001)
      ticketing-app.module.ts
      index.ts
    omnichannel/
      main.ts               (port 3000 — moved from src/main.ts)
      omnichannel-app.module.ts (moved from src/app.module.ts)
      index.ts
```

## References
- **PRD:** §6 Contract, NFR-T5/T6
- **Architecture:** §5, §10
