# CSKH Aggregation Ports — handoff cho 7 service team

`omichannel_be` (CSKH BFF) aggregate 7 domain qua **port lean**. Mỗi port có Mock (đọc fixture) → khi service sẵn, team service expose endpoint + omichannel_be thêm RealAdapter (swap qua config, FE không vỡ).

## 7 port — team nào làm gì

| Port | Team service | Endpoint cần expose | Input → Output |
|---|---|---|---|
| **Incident** | incident-service | `GET /incidents`, `POST /:id/{triage,kind,dispatch}` | `(id, kind) → Incident` |
| **Telephony** | telephony/PBX (CTI) | `GET /softphone/{queue,active,log,lookup/:phone}`, `GET /calls/:id/recording` | `(phone) → CallerProfile` |
| **CSAT** | csat service | `GET /csat`, `POST /csat/submit` | `(score…) → {reopened}` |
| **Knowledge** | kb/CMS | `GET /knowledge` | `→ {kb[], canned[]}` |
| **Chatbot** | chatbot/Zalo ZNS | `GET /chatbot`, `POST /chatbot/toggle` | `(enabled) → BotData` |
| **Broadcast** | broadcast service | `GET /broadcasts`, `POST /broadcasts`, `POST /:id/send` | `(title,channels,area,window) → Broadcast` |
| **Dashboard** | aggregate (read-model) | `GET /dashboard` | `→ {kpis, volByChannel, volByTopic, hourly, slaTrend, agents}` |

> Chi tiết field: xem `omichannel_be/src/modules/messaging/domain/ports/cskh-aggregation.ports.ts` + `cskh-fixture.ts` (mock data = output shape mẫu).

## Pattern tích hợp (đồng bộ cho mọi port)

- **Giao thức**: gRPC hoặc HTTP (gRPC khuyến nghị nội bộ cluster; HTTP đơn giản hơn). omichannel_be gọi qua **BFF của service đó** (không gọi thẳng service).
- **Auth**: SA token Keycloak (`client_credentials`, `authorization: Bearer …`) — cùng pattern `notification-be-rs` (`06-notification.md`).
- **Envelope** (HTTP): `{success, message, data, error:{code, detail}}`.
- **Mock-first**: khi service chưa sẵn → Mock adapter giữ FE chạy. omichannel_be không vỡ.

## Khi service sẵn — omichannel_be làm (không cần team service quan tâm)

1. Tạo RealAdapter implement port (clone `notification-grpc.adapter.ts`).
2. Wire `messaging.module.ts` (useFactory: `config.get('URL') ? real : mock`).
3. Env `.env`: `<DOMAIN>_SERVICE_URL` (empty = mock).
4. Controller không đổi (đã gọi port).

## Ghi chú
- Ticket + Catalogs: giữ direct trong omichannel_be (core/config, không phải service aggregation).
- Messaging ingest (conversation, realtime): core DDD, giữ nguyên.
