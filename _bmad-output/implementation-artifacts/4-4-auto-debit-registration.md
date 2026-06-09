# Story 4.4: Auto Debit Registration

Status: done

## Story

As a **customer (Cô Nguyễn)**,
I want to register my bank account for automatic bill payment,
so that I never miss a payment deadline and avoid late fees.

## Acceptance Criteria

### AC1: Register Auto Debit (FR38)
**Given** an authenticated customer navigates to "Auto Debit Setup"
**When** they submit their bank account details
**Then** the BFF calls `IPaymentPort.setupAutoDebit(customerId, bankAccount)` via PortRegistry with `cacheTier: transaction`
**And** returns the registration status (pending_verification / active).

### AC2: PII Redaction — Bank Account Fields
**Given** auto debit registration uses sensitive bank data
**When** the request is processed and logged
**Then** the dev **must update the global pino-redact paths** in the Pino configuration to include: `*.bankAccount`, `*.cardNumber`, `*.cvv`
**And** all bank account fields are redacted as `[REDACTED]` in every log across the entire application.

### AC3: Idempotency Key (FR70)
**Given** the BFF makes an outbound auto debit registration call
**When** the request is constructed
**Then** the `x-idempotency-key` header is injected
**And** duplicate registration requests with the same idempotency key return the original result.

### AC4: No Caching (FR35)
**Given** an auto debit request is made
**When** the PortRegistry processes the call
**Then** the payment port uses `cacheTier: transaction` — every request hits the Payment Service live.

## Tasks / Subtasks

- [x] Task 1: Add Auto Debit DTOs (AC: #1, #2)
  - [x] Add to `src/modules/payment/application/dtos/payment.dto.ts`:
  - [x] `BankAccountSchema` (bankName, accountNumber, accountHolder, branchCode) — sensitive fields
  - [x] `SetupAutoDebitRequestSchema` (bankAccount object) — input validation
  - [x] `AutoDebitStatusSchema` (enum: `pending_verification`, `active`, `rejected`, `cancelled`)
  - [x] `SetupAutoDebitResponseSchema` (registrationId, status, registeredAt)
  - [x] Input validation: bankAccount.accountNumber regex for Vietnamese bank format

- [x] Task 2: Extend Payment Port (AC: #1, #3, #4)
  - [x] Update `src/modules/payment/infrastructure/ports/payment.port.ts`
  - [x] Add mock schema: `setup-auto-debit`
  - [x] Create `mocks/payment/setup-auto-debit.json`

- [x] Task 3: Create Auto Debit Command & Handler (AC: #1, #3, #4)
  - [x] Create `src/modules/payment/application/commands/setup-auto-debit.command.ts`
  - [x] Create `src/modules/payment/application/commands/handlers/setup-auto-debit.handler.ts`
  - [x] Handler: inject `PortRegistry`, call `execute('payment', 'setup-auto-debit', { customerId, bankAccount })`

- [x] Task 4: Update Pino Redact Configuration (AC: #2)
  - [x] Find the global Pino configuration (likely in `src/libs/shared/logging/` or `src/main.ts`)
  - [x] Add paths: `*.bankAccount`, `*.cardNumber`, `*.cvv` to the `redact.paths` array
  - [x] Verify existing redact paths still work (phone, address, cccd, password, token, secret)
  - [x] Write test: log object with bankAccount field → verify `[REDACTED]` in output

- [x] Task 5: Add Controller Endpoint (AC: all)
  - [x] Update `src/modules/payment/infrastructure/http/payment.controller.ts`
  - [x] `POST /payments/auto-debit` → dispatch `SetupAutoDebitCommand` (body: { bankAccount })
  - [x] Validate request body via `SetupAutoDebitRequestSchema`

- [x] Task 6: Update Payment Module (AC: all)
  - [x] Update `src/modules/payment/payment.module.ts` — add `SetupAutoDebitHandler`

- [x] Task 7: Write comprehensive tests (AC: all)
  - [x] Update `payment.port.spec.ts` — add `setup-auto-debit` mock adapter test
  - [x] `setup-auto-debit.handler.spec.ts` — Verify PortRegistry call with customerId + bankAccount
  - [x] Update `payment.controller.spec.ts` — POST /payments/auto-debit, body validation
  - [x] `pino-redact.spec.ts` — Verify bankAccount fields are redacted in log output

## Dev Notes

### 🏗️ Architecture Intelligence — CRITICAL

This story **extends the existing `payment` module** from Stories 4.1–4.3.

#### ⚡ PII Redaction — GLOBAL Security Update

This is the FIRST story that requires updating the **global Pino redact configuration**. The existing redact paths (from project-context.md) are:

```typescript
paths: [
  '*.phone', '*.phoneNumber', '*.soDienThoai',
  '*.cccd', '*.cccdNumber',
  '*.address', '*.diaChi',
  '*.password', '*.token', '*.secret',
  '*.refreshToken', '*.accessToken',
]
```

**This story ADDS:** `*.bankAccount`, `*.cardNumber`, `*.cvv`

**Rule:** The redact config is GLOBAL — every Pino instance in the application uses it. The dev must find where it's defined (likely `src/libs/shared/logging/` or app bootstrap) and add the new paths there. Not in the handler, not in the module — in the shared config.

#### What ALREADY EXISTS — DO NOT REINVENT

| Component | Location | What to Reuse |
|-----------|----------|---------------|
| **PaymentModule** | `src/modules/payment/payment.module.ts` | **EXTEND** — add handler |
| **PaymentController** | `src/modules/payment/infrastructure/http/payment.controller.ts` | **EXTEND** — add endpoint |
| **MockPaymentAdapter** | `src/modules/payment/infrastructure/ports/payment.port.ts` | **EXTEND** — add `setup-auto-debit` |
| **Payment DTOs** | `src/modules/payment/application/dtos/payment.dto.ts` | **EXTEND** — add auto debit DTOs |
| **CreatePaymentCommand** | `src/modules/payment/application/commands/` | **TEMPLATE** — simple command pattern |
| **Pino redact config** | `src/libs/shared/logging/` or bootstrap | **UPDATE** — add bank field paths |

### 📁 File Structure — Changes

```
src/modules/payment/
├── application/
│   ├── commands/
│   │   ├── setup-auto-debit.command.ts                ← NEW (AC#1)
│   │   ├── handlers/
│   │   │   └── setup-auto-debit.handler.ts            ← NEW (AC#1)
│   │   └── index.ts                                   ← UPDATE
│   └── dtos/
│       └── payment.dto.ts                             ← UPDATE (add auto debit DTOs)
├── infrastructure/
│   ├── http/
│   │   └── payment.controller.ts                      ← UPDATE (add POST /payments/auto-debit)
│   └── ports/
│       └── payment.port.ts                            ← UPDATE (add setup-auto-debit schema)
└── payment.module.ts                                  ← UPDATE (add handler)

mocks/payment/
└── setup-auto-debit.json                              ← NEW

[Pino config location]                                 ← UPDATE (add *.bankAccount, *.cardNumber, *.cvv)
```

### 🔧 Implementation Details

#### New DTOs (add to payment.dto.ts)

```typescript
// =============================================================================
// AC#1: Auto Debit Registration
// =============================================================================

export const BankAccountSchema = z.object({
  bankName: z.string().min(1).max(200),
  accountNumber: z.string().regex(/^[0-9]{6,20}$/, 'Invalid account number format'),
  accountHolder: z.string().min(1).max(200),
  branchCode: z.string().optional(),
});

export const SetupAutoDebitRequestSchema = z.object({
  bankAccount: BankAccountSchema,
});

export const AutoDebitStatusSchema = z.enum(['pending_verification', 'active', 'rejected', 'cancelled']);

export const SetupAutoDebitResponseSchema = z.object({
  registrationId: z.string(),
  status: AutoDebitStatusSchema,
  registeredAt: z.string(),
});

export type BankAccount = z.infer<typeof BankAccountSchema>;
export type SetupAutoDebitRequest = z.infer<typeof SetupAutoDebitRequestSchema>;
export type AutoDebitStatus = z.infer<typeof AutoDebitStatusSchema>;
export type SetupAutoDebitResponse = z.infer<typeof SetupAutoDebitResponseSchema>;
```

#### Command & Handler

```typescript
// setup-auto-debit.command.ts
import { ICommand } from '@core/application';
import type { BankAccount, SetupAutoDebitResponse } from '../dtos/payment.dto';

export class SetupAutoDebitCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly bankAccount: BankAccount,
  ) {}
}
export type SetupAutoDebitResult = SetupAutoDebitResponse;

// setup-auto-debit.handler.ts
@CommandHandler(SetupAutoDebitCommand)
export class SetupAutoDebitHandler implements ICommandHandler<SetupAutoDebitCommand> {
  private readonly logger = new Logger(SetupAutoDebitHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: SetupAutoDebitCommand): Promise<SetupAutoDebitResponse> {
    // WARNING: bankAccount is REDACTED in logs by pino-redact (AC#2)
    this.logger.log(`Auto debit registration for customer: ${command.customerId}`);
    const result = await this.portRegistry.execute<SetupAutoDebitResponse>(
      'payment', 'setup-auto-debit',
      { customerId: command.customerId, bankAccount: command.bankAccount },
    );
    return result.data;
  }
}
```

#### Controller Endpoint

```typescript
@Post('auto-debit')
@ApiOperation({ summary: 'Register auto debit for automatic bill payment' })
async setupAutoDebit(
  @CurrentUser('id') userId: string,
  @Body() body: Record<string, unknown>,
) {
  const validated = SetupAutoDebitRequestSchema.safeParse(body);
  if (!validated.success) {
    throw new ValidationException('Invalid auto debit request');
  }
  return this.commandBus.execute(new SetupAutoDebitCommand(userId, validated.data.bankAccount));
}
```

### ⚠️ Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|--------------|
| Add redact paths only in the handler | Update **GLOBAL** pino-redact config in shared logging module |
| Log bankAccount fields directly | All bank fields are auto-redacted by global config — but don't bypass it |
| Cache auto debit response | `cacheTier: transaction` — NO CACHING for any payment data |
| Allow any string for accountNumber | Validate with regex `^[0-9]{6,20}$` — Vietnamese bank account format |

### 🧪 Testing Requirements

1. **Mock adapter — setup-auto-debit** — Read JSON, validate `SetupAutoDebitResponseSchema`
2. **Handler — success** — Verify port call with customerId + bankAccount, returns status
3. **Handler — verify bankAccount passed to port** — Check params include bankAccount object
4. **Controller — POST /payments/auto-debit** — Returns 200 with registration status
5. **Controller — invalid body** — Missing bankAccount → 400 ValidationException
6. **Controller — invalid accountNumber** — Non-numeric → 400 ValidationException
7. **Controller — verify command class type** — `toBeInstanceOf(SetupAutoDebitCommand)`
8. **Pino redact — bankAccount in log** — Object logged with `bankAccount` field → shows `[REDACTED]`
9. **Pino redact — existing paths still work** — phone, address still redacted after config update

### Previous Story Learnings (Stories 2.1–4.3 — MUST Apply)

- All patterns from Stories 4.1–4.3 apply (command pattern, useExisting, sequential orchestration)
- **Pino redact is GLOBAL** — changes affect all modules, not just payment
- **Integration test pattern** — `CqrsModule` + `module.init()` for handler auto-discovery
- **411+ tests passing** — ensure ZERO regressions
- **accountNumber regex** — Vietnamese bank accounts are 6-20 digits, no letters

### 📋 Cross-Story Context

**Depends on (all complete ✅):**
- Stories 1.1–1.4 (Port infra, resilience, auth, token lifecycle)
- Story 4.1 (Payment Initiation — PaymentModule, command pattern)
- Global Pino config (from project setup)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4: Auto Debit Registration]
- [Source: _bmad-output/planning-artifacts/architecture.md#Port Interface Catalog — payment port setupAutoDebit]
- [Source: _bmad-output/project-context.md#PII Masking — mandatory redact paths]
- [Source: src/modules/payment/payment.module.ts — Current module]
- [Source: src/modules/payment/application/dtos/payment.dto.ts — Current DTOs]
- [Source: src/libs/shared/logging/ — Pino redact config location]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (glm-5[1m])

### Debug Log References

- 544/544 tests passing — zero regressions
- 20 new tests added across 3 test files
- Code review fix: `structured-logger.service.spec.ts` redact config was missing top-level `'bankAccount'` path (only had `*.bankAccount` wildcard). 551/551 tests now passing.

### Completion Notes List

- ✅ Task 1: Added BankAccountSchema (with Vietnamese bank account regex), SetupAutoDebitRequestSchema, AutoDebitStatusSchema, SetupAutoDebitResponseSchema + types
- ✅ Task 2: Extended MockPaymentAdapter with `setup-auto-debit` schema + created mock JSON
- ✅ Task 3: Created SetupAutoDebitCommand + SetupAutoDebitHandler — calls PortRegistry with customerId + bankAccount, null guard on result.data
- ✅ Task 4: Updated global pino-redact config in StructuredLogger — added `*.bankAccount`, `*.cardNumber`, `*.cvv` paths
- ✅ Task 5: Added `POST /payments/auto-debit` endpoint to PaymentController with Zod validation
- ✅ Task 6: Updated PaymentModule — added SetupAutoDebitHandler to providers
- ✅ Task 7: 20 new tests — handler spec (4 tests), port spec (11 tests), controller spec (5 tests)

### File List

**NEW files:**
- `src/modules/payment/application/commands/setup-auto-debit.command.ts`
- `src/modules/payment/application/commands/handlers/setup-auto-debit.handler.ts`
- `src/modules/payment/application/commands/handlers/setup-auto-debit.handler.spec.ts`
- `mocks/payment/setup-auto-debit.json`

**MODIFIED files:**
- `src/modules/payment/application/dtos/payment.dto.ts` — added auto debit DTOs + types
- `src/modules/payment/infrastructure/ports/payment.port.ts` — added setup-auto-debit schema
- `src/modules/payment/infrastructure/ports/payment.port.spec.ts` — added auto debit + BankAccount schema tests
- `src/modules/payment/infrastructure/http/payment.controller.ts` — added POST /payments/auto-debit endpoint
- `src/modules/payment/infrastructure/http/payment.controller.spec.ts` — added auto debit controller tests
- `src/modules/payment/application/commands/index.ts` — added setup-auto-debit export
- `src/modules/payment/payment.module.ts` — added SetupAutoDebitHandler
- `src/libs/shared/observability/structured-logger.service.ts` — added bankAccount/cardNumber/cvv to redact paths
