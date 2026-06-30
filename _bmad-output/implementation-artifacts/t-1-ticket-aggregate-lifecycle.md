# Story T-1: Ticket Aggregate + Lifecycle State Machine

Status: ready-for-dev

## Story

As a Ticketing service,
I want to create tickets with unique IDs, classify them, and enforce a strict lifecycle state machine,
so that OmniCare can request ticket creation + advance stages, and the service maintains domain invariants (FR21-24, FR20).

## Acceptance Criteria

1. **Create ticket (FR21-23):** `CreateTicketCommand` → assigns `SC-XXXXXX` ID + classifies type/priority + applies dual SLA policy (ack + resolve deadlines).
2. **Auto-transition (FR-T2.3):** first agent response → auto RECEIVED → IN_PROGRESS (stops Ack clock).
3. **Strict transitions (FR-T2.1-2.2):** invalid transitions rejected with `INVALID_TRANSITION`.
4. **Events:** each transition emits `TicketStateChanged`; CLOSE emits `TicketClosed`.
5. **Persistence:** ticket saved to PostgreSQL `tickets` table via Drizzle write repository (mirrors `ConversationRepository` pattern).

## DDD Structure (mirrors `modules/messaging/`)

```
src/modules/ticketing/
  domain/
    value-objects/
      ticket-id.value-object.ts          (SC-XXXXXX format validation)
      ticket-priority.value-object.ts    (P0-P3 + schedule: 24/7 | BUSINESS_HOURS)
      ticket-stage.value-object.ts       (5 stages + allowed transitions map)
    entities/
      ticket.entity.ts                   (AggregateRoot extends @core AggregateRoot)
    events/
      ticket-created.event.ts
      ticket-stage-changed.event.ts
      ticket-closed.event.ts
    repositories/
      ticket.repository.interface.ts     (extends IAggregateRepository<Ticket>)
    index.ts
  application/
    commands/
      create-ticket.command.ts
      create-ticket.handler.ts           (@CommandHandler, mirrors ReceiveInboundMessageHandler)
      advance-stage.command.ts
      advance-stage.handler.ts
      index.ts
    dtos/
      create-ticket.dto.ts               (class-validator: priority @IsIn(['P0'..'P3']))
      advance-stage.dto.ts
      index.ts
    index.ts
  infrastructure/
    http/
      ticketing.controller.ts            (@Controller, mirrors InboundWebhookController)
      index.ts
    persistence/
      drizzle/schema/
        ticketing.schema.ts              (ticketsTable + indexes, mirrors messaging.schema.ts)
        index.ts
      write/
        ticket.repository.ts             (extends BaseAggregateRepository, UPSERT pattern)
        index.ts
    index.ts
  constants/
    tokens.ts                            (TICKET_REPOSITORY_TOKEN)
    index.ts
  ticketing.module.ts                    (@Module imports SharedCqrsModule + providers)
  index.ts
```

## Dev Notes

### Mirror the messaging module exactly:
- `Ticket extends AggregateRoot` (same base as `Conversation`)
- `Ticket.create()` factory → enqueues `TicketCreated` event + markAsModified
- `Ticket.advanceStage(newStage)` → validates transition map + enqueues `TicketStageChanged`
- `Ticket.close()` → sets closedAt + enqueues `TicketClosed`
- Repository uses UPSERT pattern (fixed in wave-1 code review)
- Controller uses `@Inject(COMMAND_BUS_TOKEN)` + delegates to handlers

### SLA fields on Ticket entity:
```typescript
private _ackDeadline: Date;        // createdAt + ackMs
private _resolveDeadline: Date;    // createdAt + resolveMs
private _acknowledgedAt: Date | null;  // set on first agent response
private _escalated: boolean = false;
private _reopenedFromCsat: boolean = false;
```

### State transitions map:
```typescript
const TRANSITIONS = {
  RECEIVED:    ['IN_PROGRESS'],
  IN_PROGRESS: ['WAITING', 'RESOLVED', 'CLOSED'],
  WAITING:     ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED:    ['CLOSED', 'IN_PROGRESS'],  // reopen allowed
  CLOSED:      ['IN_PROGRESS'],             // CSAT reopen only
};
```

### Drizzle schema:
```typescript
export const ticketsTable = pgTable('tickets', {
  id: varchar('id', { length: 36 }).primaryKey(),
  conversationId: varchar('conversation_id', { length: 36 }),
  customerId: varchar('customer_id', { length: 36 }),
  channel: varchar('channel', { length: 20 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  stage: varchar('stage', { length: 20 }).notNull().default('RECEIVED'),
  priority: varchar('priority', { length: 5 }).notNull(),
  assignee: varchar('assignee', { length: 36 }),
  parentId: varchar('parent_id', { length: 36 }),
  acknowledgedAt: timestamp('acknowledged_at'),
  ackDeadline: timestamp('ack_deadline').notNull(),
  resolveDeadline: timestamp('resolve_deadline').notNull(),
  escalated: boolean('escalated').default(false),
  reopenedFromCsat: boolean('reopened_from_csat').default(false),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at'),
});
```

## References
- **PRD:** FR-T1, FR-T2 — [prd-ticketing-sla-service.md](../../_bmad-output/planning-artifacts/prd-ticketing-sla-service.md)
- **Pattern:** `modules/messaging/domain/entities/conversation.entity.ts` (mirror exactly)
- **@core:** `AggregateRoot`, `DomainException`, `ICommandHandler`, `IAggregateRepository`
- **@shared:** `SharedCqrsModule`, `CommandHandler` decorator, `BaseAggregateRepository`
