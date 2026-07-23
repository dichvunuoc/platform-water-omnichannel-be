# Customer 360 Integration — note cho team customer/CRM

> Mục đích: khi khách hàng nhắn tin tới CSKH (qua app-tu-phuc-vu hoặc kênh khác),
> `omichannel_be` (CSKH agent desktop) cần **profile khách (Customer360)** để hiển thị
> lên inbox agent (tên, mã danh bộ, địa chỉ, loại KH…). Note này mô tả contract để
> team customer/CRM implement bên service của họ.

## 1. Context & trigger

```
[app-tu-phuc-vu] customer gửi tin → omichannel_be /webhooks/app {userId, messageId, text}
                                       │
                                       ▼  (tạo conversation, channel=APP, customerChannelId=userId)
                          omichannel_be CẦN resolve: userId (Keycloak sub) → CustomerProfile
                                       │
                                       ▼
                          Customer BFF  ← omichannel_be gọi ĐÂY (không gọi service trực tiếp)
                                       │   (aggregation + auth boundary + map identity)
                                       ▼
                          Customer/CRM service (sở hữu data — internal, không expose ra ngoài)
```

> **Kiến trúc 3 lớp**: `omichannel_be` (CSKH BFF) → **Customer BFF** (lớp trung gian) →
> customer/CRM service. `omichannel_be` KHÔNG bao giờ gọi thẳng customer service —
> luôn qua Customer BFF (giống pattern platform: service không gọi service trực tiếp,
> qua BFF/gateway).

- **Khi nào cần**: mỗi khi có inbound message mới (conversation mới hoặc tiếp nối) →
  agent inbox cần hiện Customer360 panel.
- **Tần suất**: on-demand, theo từng khách — không phải batch.
- **Độ trễ chấp nhận**: < 500ms (agent đang chờ xem thread).

## 2. Input / Output omichannel_be cần

### Input (lookup key) — 1 trong các dạng:
| Trường | Khi nào | Ví dụ |
|---|---|---|
| `channel` + `customerChannelId` | Mặc định — key theo kênh | `APP` + `<Keycloak user sub>` |
| `customerId` / `maHb` | Khi đã resolve được internal id | `04-1207-00` |
| `phone` | Khi channel = hotline/SMS | `0908 215 770` |

→ **Ưu tiên**: `resolveIdentity(channel, customerChannelId)` → trả `customerId`;
sau đó `getProfile(customerId)` → full profile. (2 bước) hoặc gộp 1 bước.

### Output — `CustomerProfile` (omichannel_be kỳ vọng field này, khớp `ICustomer360Port`):
```jsonc
{
  "id": "04-1207-00",            // mã danh bộ / internal id (bắt buộc)
  "name": "Nguyễn Thị Hồng Vân",  // họ tên (bắt buộc)
  "phone": "0908 215 770",        // SĐT
  "address": "128 Lê Lợi",        // địa chỉ
  "phuong": "P. Lê Lợi",          // phường/khu vực
  "customerType": "sh",           // 'sh' | 'kddv' | 'hcsn' | 'sx'
  "contract": "HD-2024-0001",     // hợp đồng
  "receivables": "215400",        // công nợ (tùy chọn)
  "consumption": "18 m³"          // tiêu thụ kỳ gần nhất (tùy chọn)
}
```
- Nếu **không tìm thấy** → trả `null` (omichannel_be sẽ đánh dấu "chưa xác định khách",
  agent có thể link thủ công sau).

## 3. Hai đường tích hợp (theo quy tắc 3-nấc platform, ref `06-notification.md`)

### Đường A — **gRPC/HTTP đồng bộ qua Customer BFF (KHUYẾN NGHỊ cho on-demand)**

**Customer BFF** expose 1 endpoint `omichannel_be` gọi; BFF tự gọi customer/CRM service
trong nội bộ platform (aggregation + auth boundary + identity map):

```
omichannel_be (ICustomer360Port) ──► Customer BFF ──► customer/CRM service
                         gRPC/HTTP          (nội bộ, BFF lo)
```

- **gRPC** `CustomerBff/GetProfile` (hoặc HTTP `GET /api/customer-bff/profile?...`):
  ```proto
  service CustomerBff {
    rpc GetProfile (GetProfileRequest) returns (GetProfileReply);
  }
  message GetProfileRequest {
    string customer_id = 1;       // ưu tiên (maHb / internal id)
    string channel = 2;           // + customer_channel_id khi chưa có id
    string customer_channel_id = 3;
    string phone = 4;
  }
  message GetProfileReply {
    CustomerProfile profile = 1;  // null nếu không tìm thấy
  }
  ```
- **Địa chỉ Customer BFF** nội bộ cluster (vd `customer-bff:8081`) — team customer quyết định;
  KHÔNG expose qua APISIX (chỉ internal service-to-BFF).
- **Auth**: metadata `authorization: Bearer <SA token>` (Keycloak client_credentials,
  cùng pattern notification `06-notification.md` §4). Local dev: `AUTH_ENABLED=false`.
- **Identity map `(channel, customerChannelId) → customerId` nằm ở Customer BFF**
  (không phải omichannel_be) — BFF biết service sở hữu data + map đa kênh.

**omichannel_be side (đã sẵn plug point)**: `ICustomer360Port` ở
`src/modules/messaging/domain/ports/customer-360.port.ts` (`resolveIdentity`, `getProfile`).
Hiện `MockCustomer360Adapter` (3 profile giả). **Thay bằng adapter thật gọi endpoint này**
(clone pattern `notification-grpc.adapter.ts`). Wire trong `messaging.module.ts`.

### Đường B — **Event bus (nếu muốn pre-cache / push update)**

Customer/CRM service publish event khi profile thay đổi; omichannel_be subscribe + cache:

- Exchange `water-platform`, routing key = `eventType`, envelope `schemaVersion:1`
  (xem `03-event-bus.md`):
  ```jsonc
  {
    "eventType": "customer.profile.changed",
    "eventId": "uuid-v7",
    "schemaVersion": 1,
    "tenantId": "hawaco",
    "occurredAt": "2026-07-21T09:00:00Z",
    "actor": { "clientId": "customer-be" },
    "payload": {
      "customerId": "04-1207-00",
      "channelLinks": [{ "channel": "APP", "customerChannelId": "<Keycloak sub>" }],
      "profile": { /* CustomerProfile như §2 */ }
    }
  }
  ```
- omichannel_be bind queue `omnicare.customer.profile`, cache vào read-model
  (table riêng hoặc Redis), tra cứu khi có inbound.
- **Lưu ý**: event là fire-and-forget → **không dùng cho tra cứu lần đầu** nếu cache lạnh.
  Khuyên dùng **A cho lookup on-demand + B cho sync update** (giữ cache tươi).

> Nếu team customer chỉ muốn emit **1 event "để lấy thông tin"** (request–reply qua bus):
  omichannel_be emit `customer.profile.requested`, customer-be reply bằng event
  `customer.profile.resolved` (correlationId). Phức tạp hơn, chỉ nên dùng khi không
  tiện expose gRPC/HTTP. Khuyến nghị **đường A** cho MVP.

## 4. Identity mapping (quan trọng)

`customerChannelId` theo kênh KHÁC internal `customerId`:
- **App** (app-tu-phuc-vu): `customerChannelId` = **Keycloak user sub** (UUID).
  Customer service phải có map `Keycloak sub → maHb/customerId` (table user_link /
  identity_link). Đây là phần team customer cần có.
- **Zalo**: `customerChannelId` = Zalo user id.
- **Hotline/SMS**: `customerChannelId` = SĐT.
- **Email**: `customerChannelId` = email.

→ Customer service cần 1 bảng/lookup **`(channel, customerChannelId) → customerId`**
để resolve đa kênh. omichannel_be gửi (`channel`, `customerChannelId`), customer service
trả `customerId` + profile.

## 5. Contract tóm tắt — chia theo lớp

### Lớp Customer BFF (boundary mà omichannel_be gọi)
1. **Expose** `GetProfile` (gRPC `CustomerBff/GetProfile` hoặc HTTP) với input
   `(customerId | channel+customerChannelId | phone)` → `CustomerProfile | null`.
2. **Map identity đa kênh** `(channel, customerChannelId) → customerId` tại BFF
   (đặc biệt App = Keycloak sub → maHb). Đây là trách nhiệm của BFF.
3. **Auth**: SA token Keycloak (client_credentials) cho omichannel_be → BFF.
4. **Aggregate**: BFF gọi 1 hoặc nhiều customer service nội bộ để lắp profile đầy đủ.

### Lớp Customer/CRM service (sau BFF — internal)
5. Cung cấp data thô (maHb, tên, SĐT, địa chỉ, loại KH, hợp đồng…) cho BFF
   (qua gRPC/HTTP internal hoặc event). Không expose ra ngoài — chỉ BFF gọi.

### Khi customer service chưa sẵn sàng
6. Customer BFF trả **mock/dummy profile** (hoặc null); omichannel_be fallback
   "chưa xác định khách" (agent link thủ công sau). Wire không vỡ.

## 6. Sau khi customer service sẵn sàng

omichannel_be sẽ:
- Tạo `Customer360GrpcAdapter` (hoặc `HttpAdapter`) implement `ICustomer360Port`.
- Thay `useExisting: MockCustomer360Adapter` → real adapter trong `messaging.module.ts`.
- Khi inbound → `ReceiveInboundMessageCommand` / BFF `resolve-identity` endpoint gọi
  `resolveIdentity` → fill `conversation.customerId` + `customer360` trong `ConversationDetail`.

## Tham chiếu
- Port hiện tại: `omichannel_be/src/modules/messaging/domain/ports/customer-360.port.ts`
- Mock adapter: `omichannel_be/src/modules/messaging/infrastructure/adapters/mock/mock-customer-360.adapter.ts`
- BFF adapter (omichannel_be đã làm): `src/modules/messaging/infrastructure/adapters/http/customer-360-bff.adapter.ts` (HTTP → cskh-bff, config-gated `CSKH_BFF_URL`)
- Pattern gRPC clone: `omichannel_be/src/modules/messaging/infrastructure/adapters/grpc/notification-grpc.adapter.ts`
- Platform event/gRPC quy tắc: `app-tu-phuc-vu/docs/06-notification.md`, `03-event-bus.md`

---

## 7. Code reference cho team cskh-bff (.NET `water-business-cskh-bff`)

> omichannel_be đã làm adapter (gọi cskh-bff). Phần .NET cskh-bff **team cskh-bff tự thêm**
> — code mẫu dưới đây (đã test pattern, build OK khi có SDK 10). 3 file:

**a) `Domain/Models/CskhModels.cs`** — thêm record (sau `Ticket`):
```csharp
// ─── Customer 360 (profile lookup cho omichannel_be ICustomer360Port) ───
public sealed record CustomerProfile(
    string Id, string Name, string? Phone, string? Address,
    string? Phuong, string? CustType, string? Contract);
```

**b) `Endpoints/CustomersEndpoint.cs`** (file mới) — derive profile từ ticket data:
```csharp
using Water.Business.Cskh.Bff.Api;
using Water.Business.Cskh.Bff.Domain;

namespace Water.Business.Cskh.Bff.Endpoints;

public static class CustomersEndpoint
{
    public static void Map(WebApplication app, bool authEnabled)
    {
        // GET /api/cskh/customers/{id}  (id = maHb)
        var detail = app.MapGet("/api/cskh/customers/{id}", (CskhStore store, string id) =>
        {
            var t = store.Tickets.FirstOrDefault(x => x.MaHb == id);
            if (t is null) return ApiEnvelope.Fail(404, $"Không tìm thấy khách {id}", "NOT_FOUND");
            return ApiEnvelope.Ok(ToProfile(t));
        });
        // GET /api/cskh/customers/resolve?channel=&customerChannelId=  (demo: treat ccid as maHb)
        var resolve = app.MapGet("/api/cskh/customers/resolve",
            (CskhStore store, string? channel, string? customerChannelId) =>
        {
            if (string.IsNullOrEmpty(customerChannelId))
                return ApiEnvelope.Fail(400, "customerChannelId required", "BAD_REQUEST");
            var t = store.Tickets.FirstOrDefault(x => x.MaHb == customerChannelId);
            if (t is null) return ApiEnvelope.Fail(404, "Không tìm thấy khách", "NOT_FOUND");
            return ApiEnvelope.Ok(ToProfile(t));
        });
        if (authEnabled) { detail.RequireAuthorization(); resolve.RequireAuthorization(); }
    }
    private static CustomerProfile ToProfile(Ticket t) =>
        new(t.MaHb, t.Name, t.Phone, t.Addr, t.Phuong, t.CustType, null);
}
```

**c) `Program.cs`** — wire (sau `TicketsEndpoint.Map`):
```csharp
CustomersEndpoint.Map(app, authEnabled);
```

**Lưu ý cho team cskh-bff**: `resolve` demo treat `customerChannelId` as `maHb`. Real: BFF cần
map `(channel, customerChannelId) → customerId` (đặc biệt App = Keycloak sub → maHb) — thêm
lookup từ customer/CRM service nội bộ (BFF gọi, không expose ra ngoài). Field `custType` →
omichannel_be map sang `customerType` (đã xử lý phía adapter). Envelope `{success,message,data,error:{code,detail}}`.

---

