# Preparation: fastify-raw-body + HMAC Verification Setup

**Mục đích:** Nghiên cứu và document setup `fastify-raw-body` cho Zalo webhook HMAC verification.
**Người phụ trách:** Dana (QA Engineer)
**Ngày:** 2026-06-12

---

## 1. Vấn đề

Fastify mặc định parse body thành JSON object. Trong quá trình parse:
- Thứ tự field có thể thay đổi
- Whitespace có thể bị normalize
- Ký tự escape có thể bị transform

→ HMAC SHA-256 computed trên **parsed body** sẽ KHÁC với HMAC computed trên **raw body gốc** từ Zalo.

**Giải pháp:** Đăng ký `rawBody` cho webhook endpoints cụ thể, compute HMAC trên raw string.

## 2. Setup fastify-raw-body

### 2.1 Install

```bash
bun add fastify-raw-body
```

### 2.2 Registration — Global nhưng chỉ active cho webhook routes

```typescript
// src/main.ts hoặc src/app.setup.ts
import fastifyRawBody from 'fastify-raw-body';

await app.register(fastifyRawBody, {
  field: 'rawBody',         // request.rawBody sẽ chứa raw string
  global: false,            // KHÔNG enable global — chỉ webhook routes
  encoding: 'utf8',         // Giữ raw string dạng UTF-8
  runOnBodyParser: true,    // Chạy cùng lúc với body parser
});
```

### 2.3 Alternative: Custom Content Type Parser (không cần thêm dependency)

```typescript
// Đăng ký cho route cụ thể
app.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (req, body, done) => {
    // Lưu raw body string trước khi parse
    (req as any).rawBody = body;
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error);
    }
  }
);
```

**Khuyến nghị:** Dùng `fastify-raw-body` — được maintain tốt, hỗ trợ Fastify v5, không reinvent wheel.

## 3. ZaloSignatureGuard Implementation Guide

```typescript
// src/modules/communication/infrastructure/guards/zalo-signature.guard.ts
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ZaloSignatureGuard implements CanActivate {
  private readonly logger = new Logger(ZaloSignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // 1. Lấy raw body — BẮT BUỘC dùng rawBody, KHÔNG dùng body
    const rawBody = request.rawBody;
    if (!rawBody) {
      this.logger.error('No rawBody found — fastify-raw-body not configured for this route');
      return false;
    }

    // 2. Lấy signature từ header
    const signature = request.headers['x-zeca-signature'];
    if (!signature) {
      this.logger.warn('Missing X-ZECA-Signature header');
      return false;
    }

    // 3. Compute HMAC SHA-256
    const secret = process.env.ZALOA_SECRET_KEY;
    if (!secret) {
      this.logger.error('ZALOA_SECRET_KEY env var not set');
      return false;
    }

    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)    // ← rawBody string, KHÔNG phải parsed JSON
      .digest('hex');

    // 4. Timing-safe comparison (prevent timing attack)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature),
    );

    if (!isValid) {
      this.logger.warn(`Zalo webhook signature mismatch — computed=${computed}, received=${signature}`);
    }

    return isValid;
  }
}
```

## 4. HMAC Test Vectors

Để verify implementation đúng trước khi dùng thật:

```typescript
// Test vector 1: Known secret + known payload = known HMAC
const TEST_SECRET = 'test-secret-key-12345';
const TEST_PAYLOAD = JSON.stringify({
  event_name: 'user_send_text',
  message: { text: 'Xin chào' },
  sender: { id: '123456789' },
});
// Expected HMAC: computed bằng `echo -n '<payload>' | openssl dgst -sha256 -hmac '<secret>'`
// Dùng test này để verify guard logic trước khi kết nối Zalo thật

describe('ZaloSignatureGuard', () => {
  it('should verify a known HMAC correctly', () => {
    const secret = 'test-secret';
    const payload = '{"test":"data"}';
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Mock request với rawBody và header
    const request = {
      rawBody: payload,
      headers: { 'x-zeca-signature': hmac },
    };

    // ... guard.canActivate() → true
  });

  it('should reject tampered payload', () => {
    const secret = 'test-secret';
    const payload = '{"test":"data"}';
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const request = {
      rawBody: '{"test":"TAMPERED"}', // payload bị thay đổi
      headers: { 'x-zeca-signature': hmac }, // HMAC gốc
    };

    // ... guard.canActivate() → false
  });

  it('should reject missing signature', () => {
    const request = {
      rawBody: '{"test":"data"}',
      headers: {}, // thiếu X-ZECA-Signature
    };

    // ... guard.canActivate() → false
  });
});
```

## 5. InterServiceApiKeyGuard (Đơn giản hơn — static key)

```typescript
// src/modules/communication/infrastructure/guards/inter-service-api-key.guard.ts
// Dùng cho: Payment IPN, Ticket status, Notification delivery webhooks
// KHÔNG dùng JWT — per FR72

@Injectable()
export class InterServiceApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const expectedKey = process.env.INTER_SERVICE_API_KEY;

    if (!apiKey || !expectedKey) return false;

    return crypto.timingSafeEqual(
      Buffer.from(apiKey),
      Buffer.from(expectedKey),
    );
  }
}
```

## 6. Controller Setup cho Webhooks

```typescript
// Webhook controllers PHẢI cấu hình rawBody cho Zalo routes
@Controller('webhooks/zalo')
@UseGuards(ZaloSignatureGuard)  // ← áp dụng cho tất cả routes trong controller
export class ZaloWebhookController {
  // Zalo routes tự động nhận rawBody vì guard trigger trước handler
}

@Controller('webhooks/payment')
@UseGuards(InterServiceApiKeyGuard)  // ← static key, không cần rawBody
export class PaymentWebhookController {
  // ...
}
```

## 7. Checklist cho Story 7.3

- [ ] Install `fastify-raw-body`
- [ ] Register plugin trong app setup (global: false)
- [ ] Tạo `ZaloSignatureGuard` với HMAC SHA-256 + timing-safe comparison
- [ ] Tạo `InterServiceApiKeyGuard` với static key + timing-safe comparison
- [ ] Apply guards lên webhook controllers
- [ ] Verify test vectors pass
- [ ] Verify rawBody available trên `/webhooks/zalo/*` routes
- [ ] Verify parsed body vẫn hoạt động bình thường (request.body)

---

_Nghiên cứu artifact cho Epic 7 Story 7.3 — Webhook Security Guards._
