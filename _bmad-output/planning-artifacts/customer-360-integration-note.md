# Customer 360 — handoff cho team cskh-bff + customer/CRM

Khi khách nhắn tin tới CSKH, `omichannel_be` cần **CustomerProfile** để hiện inbox agent. Flow 3 lớp:

```
omichannel_be (ICustomer360Port) ──► Customer BFF ──► customer/CRM service
                         HTTP/gRPC          (nội bộ, BFF lo)
```

> omichannel_be KHÔNG gọi thẳng customer service — qua **Customer BFF** (boundary + identity map + auth).

## Endpoint Customer BFF cần expose

omichannel_be gọi 2 method (HTTP hoặc gRPC, BFF quyết định):

| Method | Input | Output |
|---|---|---|
| `GET /customers/{id}` | `id` = maHb / customerId | `CustomerProfile \| null` (404 NOT_FOUND nếu không thấy) |
| `GET /customers/resolve?channel=&customerChannelId=` | `(channel, customerChannelId)` — App: Keycloak sub | `CustomerProfile \| null` |

**CustomerProfile**:
```jsonc
{ "id": "04-1207-00", "name": "Nguyễn Thị Hồng Vân", "phone": "0908 215 770",
  "address": "128 Lê Lợi", "phuong": "P. Lê Lợi", "customerType": "sh", "contract": "HD-2024-0001" }
```

## Trách nhiệm mỗi lớp

- **Customer BFF**: expose endpoint trên + **map identity đa kênh** `(channel, customerChannelId) → customerId` (đặc biệt **App: Keycloak sub → maHb**) + auth SA token + aggregate từ customer service nội bộ.
- **Customer/CRM service**: cung cấp data thô cho BFF (internal, không expose ra ngoài).
- **omichannel_be**: đã có `Customer360BffAdapter` (HTTP, config-gated `CSKH_BFF_URL`, fallback Mock). Chỉ cần BFF expose endpoint → set env là chạy.

## Auth + envelope

- SA token Keycloak (`client_credentials`, `authorization: Bearer …`) — pattern `notification-be-rs`.
- Envelope (HTTP): `{success, message, data, error:{code, detail}}`.

## Code reference cho team cskh-bff (.NET `water-business-cskh-bff`)

`omichannel_be` làm adapter rồi; phần .NET team cskh-bff tự thêm — code mẫu (đã test pattern):

**`Domain/Models/CskhModels.cs`** — thêm record:
```csharp
public sealed record CustomerProfile(
    string Id, string Name, string? Phone, string? Address,
    string? Phuong, string? CustType, string? Contract);
```

**`Endpoints/CustomersEndpoint.cs`** (file mới):
```csharp
using Water.Business.Cskh.Bff.Api;
using Water.Business.Cskh.Bff.Domain;
namespace Water.Business.Cskh.Bff.Endpoints;

public static class CustomersEndpoint
{
    public static void Map(WebApplication app, bool authEnabled)
    {
        var detail = app.MapGet("/api/cskh/customers/{id}", (CskhStore store, string id) =>
        {
            var t = store.Tickets.FirstOrDefault(x => x.MaHb == id);
            if (t is null) return ApiEnvelope.Fail(404, $"Không tìm thấy khách {id}", "NOT_FOUND");
            return ApiEnvelope.Ok(ToProfile(t));
        });
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

**`Program.cs`** — wire (sau `TicketsEndpoint.Map`):
```csharp
CustomersEndpoint.Map(app, authEnabled);
```

> Demo: `resolve` treat `customerChannelId` as `maHb`. Real: BFF map `(channel, customerChannelId) → customerId` từ customer service nội bộ.

## Tham chiếu
- Port: `omichannel_be/src/modules/messaging/domain/ports/customer-360.port.ts`
- Adapter: `src/modules/messaging/infrastructure/adapters/http/customer-360-bff.adapter.ts`
- Pattern gRPC clone: `src/modules/messaging/infrastructure/adapters/grpc/notification-grpc.adapter.ts`
