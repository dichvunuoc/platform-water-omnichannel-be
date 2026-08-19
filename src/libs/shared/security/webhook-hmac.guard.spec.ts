/**
 * WebhookHmacGuard — verify matrix (mirror inter-service-api-key.guard.spec.ts
 * của app BFF, context Fastify-shaped: headers + method + raw.url + rawBody).
 *
 * Mỗi test recompute signature bằng node:crypto độc lập (không dùng code guard)
 * — pin canonical format từ phía verifier.
 */
import { createHash, createHmac } from 'crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  WebhookHmacGuard,
  WEBHOOK_HMAC_MAX_AGE_SECONDS,
} from './webhook-hmac.guard';

const SECRET = 'test-webhook-secret-0123456789abcdef';
const BODY = JSON.stringify({ userId: 'u1', messageId: 'm1', text: 'hi' });

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function sign(
  ts: number,
  method: string,
  target: string,
  body: string | Buffer = '',
  secret: string = SECRET,
): string {
  const canonical = `v1:${ts}:${method}:${target}:${sha256Hex(body)}`;
  return `v1=${createHmac('sha256', secret).update(canonical).digest('hex')}`;
}

function mockContext(opts: {
  method?: string;
  target?: string;
  rawBody?: Buffer;
  timestamp?: string;
  signature?: string;
}) {
  const headers: Record<string, string> = {};
  if (opts.timestamp !== undefined) headers['x-timestamp'] = opts.timestamp;
  if (opts.signature !== undefined) headers['x-signature'] = opts.signature;
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        method: opts.method ?? 'POST',
        raw: { url: opts.target ?? '/webhooks/app' },
        rawBody: opts.rawBody,
      }),
    }),
    // Guard đọc metadata qua reflector instance (stub ở makeGuard), không qua context
    getHandler: () => 'h',
    getClass: () => 'c',
  } as any;
}

function makeGuard(skip = false) {
  const reflector = {
    getAllAndOverride: () => (skip ? true : undefined),
  } as any;
  return new WebhookHmacGuard(reflector);
}

describe('WebhookHmacGuard', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.WEBHOOK_HMAC_SECRET;
    process.env.WEBHOOK_HMAC_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.WEBHOOK_HMAC_SECRET = originalEnv;
  });

  const now = () => Math.floor(Date.now() / 1000);

  // ── Valid ───────────────────────────────────────────────────────────────────

  it('cho qua POST có ts + signature đúng (canonical recompute độc lập)', () => {
    const ts = now();
    const guard = makeGuard();
    expect(
      guard.canActivate(
        mockContext({
          method: 'POST',
          target: '/webhooks/app',
          rawBody: Buffer.from(BODY),
          timestamp: String(ts),
          signature: sign(ts, 'POST', '/webhooks/app', BODY),
        }),
      ),
    ).toBe(true);
  });

  it('cho qua GET (không rawBody → hash chuỗi rỗng, query nằm trong canonical)', () => {
    const ts = now();
    const guard = makeGuard();
    const target = '/webhooks/app/conversation?userId=usr%201';
    expect(
      guard.canActivate(
        mockContext({
          method: 'GET',
          target,
          timestamp: String(ts),
          signature: sign(ts, 'GET', target),
        }),
      ),
    ).toBe(true);
  });

  it('cho qua khi route có @SkipWebhookHmac metadata (escape hatch provider)', () => {
    const guard = makeGuard(true);
    expect(
      guard.canActivate(mockContext({ timestamp: '', signature: '' })),
    ).toBe(true);
  });

  // ── Fail-closed: secret unset ───────────────────────────────────────────────

  it('secret unset → 403 ForbiddenException (config alarm, KHÔNG phải 401)', () => {
    delete process.env.WEBHOOK_HMAC_SECRET;
    const guard = makeGuard();
    expect(() => guard.canActivate(mockContext({}))).toThrow(
      ForbiddenException,
    );
  });

  // ── Header / timestamp ──────────────────────────────────────────────────────

  it('thiếu x-signature → 401', () => {
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(mockContext({ timestamp: String(now()) })),
    ).toThrow(UnauthorizedException);
  });

  it('thiếu x-timestamp → 401', () => {
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        mockContext({ signature: sign(now(), 'POST', '/webhooks/app', BODY) }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('timestamp non-numeric → 401', () => {
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        mockContext({ timestamp: 'not-a-number', signature: 'v1=abc' }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it(`timestamp cũ hơn ${WEBHOOK_HMAC_MAX_AGE_SECONDS}s → 401 (replay window)`, () => {
    const old = now() - WEBHOOK_HMAC_MAX_AGE_SECONDS - 1;
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        mockContext({
          timestamp: String(old),
          signature: sign(old, 'POST', '/webhooks/app', BODY),
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it(`timestamp trong tương lai quá ${WEBHOOK_HMAC_MAX_AGE_SECONDS}s → 401 (clock skew)`, () => {
    const future = now() + WEBHOOK_HMAC_MAX_AGE_SECONDS + 1;
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        mockContext({
          timestamp: String(future),
          signature: sign(future, 'POST', '/webhooks/app', BODY),
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  // ── Signature mismatch ──────────────────────────────────────────────────────

  it('sai secret → 401', () => {
    const ts = now();
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        mockContext({
          rawBody: Buffer.from(BODY),
          timestamp: String(ts),
          signature: sign(ts, 'POST', '/webhooks/app', BODY, 'wrong-secret'),
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('body bị sửa sau khi ký → 401 (hash body lệch)', () => {
    const ts = now();
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        mockContext({
          rawBody: Buffer.from(
            JSON.stringify({ userId: 'ATTACKER', messageId: 'm1' }),
          ),
          timestamp: String(ts),
          signature: sign(ts, 'POST', '/webhooks/app', BODY),
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('query bị sửa sau khi ký → 401 (GET userId tamper-proof)', () => {
    const ts = now();
    const guard = makeGuard();
    const signedTarget = '/webhooks/app/conversation?userId=victim';
    const attackedTarget = '/webhooks/app/conversation?userId=attacker';
    expect(() =>
      guard.canActivate(
        mockContext({
          method: 'GET',
          target: attackedTarget,
          timestamp: String(ts),
          signature: sign(ts, 'GET', signedTarget),
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('signature khác 1 ký tự → 401', () => {
    const ts = now();
    const sig = sign(ts, 'POST', '/webhooks/app', BODY);
    const flipped = sig.slice(0, -2) + (sig.endsWith('a') ? 'b' : 'a');
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        mockContext({
          rawBody: Buffer.from(BODY),
          timestamp: String(ts),
          signature: flipped,
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('POST có body nhưng thiếu rawBody → 401 (fail-closed: hash rỗng sẽ mismatch)', () => {
    const ts = now();
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        mockContext({
          // KHÔNG truyền rawBody
          timestamp: String(ts),
          signature: sign(ts, 'POST', '/webhooks/app', BODY),
        }),
      ),
    ).toThrow(UnauthorizedException);
  });
});
