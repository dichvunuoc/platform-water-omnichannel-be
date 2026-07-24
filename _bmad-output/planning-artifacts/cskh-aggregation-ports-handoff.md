# CSKH Aggregation Ports — handoff cho 7 service team

> omichannel_be (CSKH BFF) giờ aggregate 7 domain qua **lean port-adapter** (KHÔNG DDD).
> Mỗi port có Mock default (đọc `cskh-fixture.ts`) + sẵn plug point cho RealAdapter.
> Khi service thật sẵn → team service implement endpoint + omichannel_be thêm RealAdapter
> (gRPC/HTTP) swap qua config (giống `notification-grpc.adapter.ts`, `customer-360-bff.adapter.ts`).

## Trạng thái

| Port | Interface | Mock (đọc fixture) | Endpoint omichannel_be | Service thật (note) |
|---|---|---|---|---|
| Incident | `IIncidentPort` | `MockIncidentAdapter` (cskhIncidents) | `/api/cskh/incidents`, `/:id/triage\|kind\|dispatch` | **incident-service** (riêng, `[[cskh-incident-pending]]`) |
| Telephony | `ITelephonyPort` | `MockTelephonyAdapter` (cskhTelephony) | `/api/cskh/softphone/{queue,active,log,lookup/:phone}`, `/calls/:callId/recording` | **telephony/PBX** (ADR-13 planned) |
| CSAT | `ICsatPort` | `MockCsatAdapter` (cskhCsat) | `/api/cskh/csat` | csat service |
| Knowledge | `IKnowledgePort` | `MockKnowledgeAdapter` (cskhKnowledge) | `/api/cskh/knowledge` | kb service |
| Chatbot | `IChatbotPort` | `MockChatbotAdapter` (cskhBot) | `/api/cskh/chatbot`, `/chatbot/toggle` | chatbot service |
| Broadcast | `IBroadcastPort` | `MockBroadcastAdapter` (cskhBroadcasts) | `/api/cskh/broadcasts`, `/broadcasts`, `/:id/send` | broadcast service |
| Dashboard | `IDashboardPort` | `MockDashboardAdapter` (cskhDash) | `/api/cskh/dashboard` | aggregate (metrics từ ticket/SLA/incident) |

Files (omichannel_be):
- Ports: `src/modules/messaging/domain/ports/cskh-aggregation.ports.ts` (7 interface)
- Tokens: `src/modules/messaging/constants/cskh-aggregation.tokens.ts`
- Mock adapters: `src/modules/messaging/infrastructure/adapters/mock/mock-cskh-aggregation.adapters.ts`
- Wire: `messaging.module.ts` (7 × useExisting MockAdapter)
- Controller: `cskh.controller.ts` (inject 7 port, gọi port)

## Contract cho mỗi service team implement

Mỗi service expose endpoint (gRPC/HTTP) mà RealAdapter gọi. Pattern thống nhất:
- **Đồng bộ** (gRPC/HTTP) cho lookup on-demand — Recommended (giống customer-360, notification).
- **Auth**: SA token Keycloak (client_credentials) — cùng pattern notification-be-rs.
- **Envelope**: `{success, message, data, error:{code,detail}}` (nếu HTTP) hoặc proto (nếu gRPC).
- Mock-first: khi service chưa sẵn → Mock adapter (hiện tại) giữ FE chạy, không vỡ.

### Chi tiết method mỗi port (xem `cskh-aggregation.ports.ts`)

- **IIncidentPort**: `list(): Incident[]`, `triage(id)`, `setKind(id, kind)`, `dispatch(id)`.
  Real: incident-service (sự cố hiện trường — GIS triage, work-order dispatch).
- **ITelephonyPort**: `queue(): CallSummary[]`, `activeCall()`, `log()`, `lookupPhone(phone)`, `recording(callId)`.
  Real: telephony/PBX (CTI — queue, screen-pop, recording + consent).
- **ICsatPort**: `aggregate(): CsatAggregate`, `submit({ticketId, score, ch, agent, topic, text})`.
  Real: csat service (NPS, dist, byChannel, reopen < 3★).
- **IKnowledgePort**: `list(): {kb, canned}`. Real: kb/CMS service.
- **IChatbotPort**: `stats(): BotData`, `toggle(enabled)`. Real: chatbot/Zalo ZNS service.
- **IBroadcastPort**: `list()`, `create({title, channels, area, window})`, `send(id)`.
  Real: broadcast service (hoặc notification-be-rs bulk — xem `06-notification.md`).
- **IDashboardPort**: `get(): DashboardData`. Real: aggregate từ ticket/SLA/incident (read-model).

## Khi service sẵn sàng — omichannel_be làm gì

1. Tạo `RealAdapter` implement port (gRPC/HTTP → service). Clone `notification-grpc.adapter.ts`.
2. Wire trong `messaging.module.ts`: `{ provide: TOKEN, useFactory: (config, mock, real) => config.get('URL') ? real : mock, inject: [...] }`.
3. Env `.env`: `<DOMAIN>_SERVICE_URL` (empty = mock fallback).
4. Controller KHÔNG đổi (đã gọi port).

## Note
- Ticket + Catalogs KHÔNG qua port (core omichannel_be + reference data, không phải aggregation service).
- Messaging ingest (conversation, realtime) là core DDD — giữ nguyên.
