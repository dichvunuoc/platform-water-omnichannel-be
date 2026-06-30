# Story 2-2: Customer 360° Card in Conversation View

Status: review

<!-- Code complete. Built as part of story 2-1 (BFF endpoints + mock profiles). -->

## Story

As an agent,
I want the customer's 360° profile (contract, receivables, consumption, address) displayed beside the conversation,
so that I have full context to resolve the issue (FR29).

## Acceptance Criteria

1. **Customer 360 endpoint:** `GET /bff/customers/:customerId` returns the full profile (name, phone, address, contract, receivables, consumption, customerType) — matching the Customer 360 card in the delivered FE (right panel).
2. **Conversation detail includes Customer 360 stub:** `GET /bff/conversations/:id` returns a `customer360` field with mock data when a `customerId` is assigned to the conversation (already built in ConversationReadDao from story 1-4).
3. **404 on unknown customer:** `GET /bff/customers/:nonexistent` returns HTTP 404 (not 200 with error body).
4. **Mock data matches UI mockups:** profiles match the J1 journey ("Nguyễn Văn Nam" with contract/debt/consumption) and the delivered FE dashboard card layout.

## Tasks / Subtasks

### ✅ DONE (built via story 2-1 + 1-4)

- [x] **BFF endpoint** (AC: 1)
  - [x] `GET /bff/customers/:customerId` in `BffController` → delegates to `customer360.getProfile()`
  - [x] Returns `CustomerProfile` (name, phone, address, contract, receivables, consumption, customerType)
- [x] **Conversation detail Customer 360 stub** (AC: 2)
  - [x] `ConversationReadDao.findById()` returns `customer360` field with mock data when `customerId` is set (built in story 1-4)
  - [x] Mock: `{ name: "Customer {id}", contract: "HD-2024-0001", debt: "0 VND", consumption: "32 m³" }`
- [x] **404 on unknown** (AC: 3)
  - [x] `GET /bff/customers/:customerId` throws `NotFoundException` when profile not found
- [x] **Mock profiles** (AC: 4)
  - [x] 3 profiles in `MockCustomer360Adapter` matching Vietnamese UI mockup data:
    - Nguyễn Văn Nam (J1 — pipe burst): HD-2024-0001, 32 m³/tháng
    - Trần Thị Hoa (J2 — billing): HD-2024-0042, 48 m³/tháng ↑3x, công nợ 125.000 VND
    - Anh Khang (J4 — self-service): HD-2023-0156, 18 m³/tháng

### ☐ REMAINING (for `done` status)

- [ ] **Integration test:** `GET /bff/customers/cust-001` → returns Nguyễn Văn Nam profile
- [ ] **Integration test:** `GET /bff/customers/nonexistent` → 404
- [ ] **Integration test:** `POST /bff/conversations/:id/resolve-identity` → customerId assigned + `GET /bff/conversations/:id` shows the resolved Customer 360 card

## Dev Notes

### What the FE sees (matching the delivered UI)
The delivered FE Inbox screen (image #1 from the mockups) shows a Customer 360 panel on the right side of each conversation:
- Customer name, phone
- Contract number
- Debt/receivables
- Water consumption chart (3× spike for chị Hoa)

The BFF serves this data via two paths:
1. **`GET /bff/conversations/:id`** — includes `customer360` inline (read DAO builds mock data from `customerId`)
2. **`GET /bff/customers/:customerId`** — standalone profile lookup (for when the FE needs to refresh just the card)

### Wave-3 upgrade
In wave-3, the `MockCustomer360Adapter` is replaced by a real `Customer360Adapter` that calls the actual Customer 360 service (via HTTP/gRPC). The `ICustomer360Port` contract stays the same — zero BFF/controller change.

## References
- **PRD:** FR29 (view customer 360° profile alongside conversation) — [prd.md §4](../../_bmad-output/planning-artifacts/prd.md)
- **Architecture:** §4 BFF `GET /bff/customers/:customerId` + `GET /bff/conversations/:id` (customer360 field) — [architecture.md](../../_bmad-output/planning-artifacts/architecture.md)
- **Story 1-4:** `ConversationReadDao.findById()` already returns `customer360` mock field
- **Story 2-1:** `MockCustomer360Adapter` + `AssignCustomerHandler` (this story depends on 2-1 for the resolution flow)

## Dev Agent Record
### Agent Model Used
Claude (BMAD SM Bob, *yolo mode)
### File List
**No new files (this story reuses 2-1's BFF endpoints + 1-4's read DAO mock)**
**Edited:** none (story 2-1's build covers both 2-1 and 2-2 ACs)
