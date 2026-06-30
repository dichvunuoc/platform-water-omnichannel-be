# Story T-5: Parent-Incident Grouping

Status: ready-for-dev

## Story

As a coordinator,
I want to group child tickets under a Parent-Incident,
so that I can track a widespread outage as one unit (FR61).

## Acceptance Criteria

1. **Attach:** child ticket attaches to parent (sets parentId).
2. **Detach:** child detaches from parent (clears parentId).
3. **Split:** a child is split out to become its own standalone ticket.
4. **View:** get parent + all children in one query.
5. **(G2) Auto-merge:** based on GIS pipe-segment isolation (mock wave-2).

## DDD Structure

```
modules/ticketing/
  domain/
    entities/parent-incident.entity.ts (AggregateRoot: childTicketIds[])
    events/child-attached.event.ts
    events/child-detached.event.ts
  application/
    commands/attach-to-parent.command.ts + handler
    commands/detach-from-parent.command.ts + handler
    commands/split-from-parent.command.ts + handler
    queries/get-parent-with-children.query.ts + handler
```

## References
- **PRD:** §2.3, FR-T6
