# Story T-6: Contract Integration + Cutover

Status: OBSOLETE (v1.3) — superseded

> **(v1.3) Obsolete.** This story specified a **separate-service** cutover: `src/apps/ticketing/main.ts` on port 3001 + HTTP calls from the BFF. PRD v1.3 builds Ticketing **in-project** instead (modular monolith, in-process `IEventBus`), so there is no separate bootstrap and no HTTP cutover. The contract (commands/events) and the `IEventBus` port from this story are **preserved** as the in-module contract (Architecture §5). If Ticketing is ever extracted to its own deployable, this story's structure can be revived behind the same contract (ADR-1 extraction path).

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
