# Story 2-1: Customer Identity Resolution + Fallback

Status: review

<!-- Code complete. Built this session. -->

## Story

As a backend system,
I want to resolve a channel-side customer identifier (zalo_user_id, phone, email) to a unified GlobalCustomerID,
so that agents see the correct customer profile (FR28/FR30/FR31).

## Acceptance Criteria

1. **Identity resolution (FR28):** when a conversation arrives (or on demand), the backend calls the Customer 360 port to resolve `customerChannelId` → `CustomerProfile` (global id, name, phone, address, contract, debt, consumption).
2. **Fallback for unknown (FR30):** if resolution fails (unknown customer), the conversation retains `customerId = null` and the system does NOT lose the inbound message — the conversation still appears in the inbox.
3. **Manual assign (FR31):** an agent can create or link a provisional customer profile via `POST /bff/conversations/:id/assign-customer` with a `customerId`.
4. **OCC-safe assignment:** `Conversation.assignCustomer()` increments version (markAsModified) — concurrent operations don't clobber the assignment.
5. **Mock adapter (wave-1):** `MockCustomer360Adapter` returns static Vietnamese profiles matching the UI mockups (bác Nam, chị Hoa, anh Khang).

## Tasks / Subtasks

### ✅ DONE

- [x] **Port interface** (AC: 1)
  - [x] `domain/ports/customer-360.port.ts` — `ICustomer360Port { resolveIdentity(channel, cid) → CustomerProfile | null; getProfile(id) → CustomerProfile | null }`
  - [x] `CustomerProfile` interface (id, name, phone, address, contract, receivables, consumption, customerType)
  - [x] `IdentityResolutionResult` interface (resolved, customer, fallbackAction)
- [x] **Mock adapter** (AC: 5)
  - [x] `infrastructure/adapters/mock/mock-customer-360.adapter.ts` — 3 static profiles (Nguyễn Văn Nam, Trần Thị Hoa, Anh Khang) matching J1/J2 journeys
  - [x] `resolveWithFallback()` method returns `IdentityResolutionResult`
- [x] **Assign command + handler** (AC: 1, 3)
  - [x] `application/commands/assign-customer.command.ts` — `AssignCustomerCommand(conversationId, customerId?, agentId?)`
  - [x] `application/commands/handlers/assign-customer.handler.ts` — load conversation → resolve via port (or use provided customerId) → assignCustomer → save
  - [x] Returns `{ resolved: boolean, customerId: string | null }`
- [x] **Fallback path** (AC: 2)
  - [x] Handler returns `{ resolved: false, customerId: null }` on resolution failure — conversation NOT lost
- [x] **OCC** (AC: 4)
  - [x] `Conversation.assignCustomer()` calls `markAsModified()` (fixed in Epic 1 review)
- [x] **DI wiring**
  - [x] `constants/customer-tokens.ts` — `CUSTOMER_360_PORT_TOKEN`
  - [x] `messaging.module.ts` — provider `{ provide: CUSTOMER_360_PORT_TOKEN, useExisting: MockCustomer360Adapter }`
  - [x] Barrel exports updated (commands, handlers indices)

## Dev Notes

- **FR28 vs FR30:** FR28 is the happy path (identity resolved → customerId set). FR30 is the fallback (unresolved → conversation still appears, customerId null). Both paths are handled in the same handler.
- **No ConversationStarted → auto-resolve yet:** in the final design, identity resolution triggers automatically when `ConversationStarted` fires (via an event consumer on the broker). For wave-1 MVP, it's a manual call (`POST /bff/conversations/:id/resolve-identity`) or called from the handler when a new conversation is created. The auto-trigger will be wired when the outbox publisher + event consumer infrastructure is live.
- **Customer 360 is mock:** the mock adapter has 3 pre-seeded profiles. Real Customer 360 (wave-3) replaces the mock behind the same `ICustomer360Port` contract.

## References
- **PRD:** FR28 (identity resolution), FR30 (fallback), FR31 (manual assign) — [prd.md §4](../../_bmad-output/planning-artifacts/prd.md)
- **Architecture:** §3.1 `incident` module mentions Customer 360 port; §4 BFF `GET /bff/customers/:customerId` — [architecture.md](../../_bmad-output/planning-artifacts/architecture.md)
- **Epics:** Epic 2 (Customer Identity & 360° Context) — [epics.md](../../_bmad-output/planning-artifacts/epics.md)
- **Dependencies:** `Conversation.assignCustomer()` (Epic 1, markAsModified fix applied)

## Dev Agent Record
### Agent Model Used
Claude (BMAD SM Bob, *yolo mode)
### File List
**Created (this session):**
- `src/modules/messaging/domain/ports/customer-360.port.ts`
- `src/modules/messaging/infrastructure/adapters/mock/mock-customer-360.adapter.ts`
- `src/modules/messaging/application/commands/assign-customer.command.ts`
- `src/modules/messaging/application/commands/handlers/assign-customer.handler.ts`
- `src/modules/messaging/constants/customer-tokens.ts`
**Edited:**
- `src/modules/messaging/infrastructure/http/bff.controller.ts` (3 new endpoints)
- `src/modules/messaging/messaging.module.ts` (providers + imports)
- `src/modules/messaging/application/commands/handlers/index.ts` (export)
- `src/modules/messaging/application/commands/index.ts` (export)
