/**
 * ⚠️ DEV-ONLY — seed 2 hội thoại thật (Zalo + Facebook) vào DB qua webhook ingest.
 *
 * Cách hoạt động: POST /webhooks/{zalo,facebook} (normalizer → ReceiveInboundMessageCommand
 * → persist conversation + inbound message) + POST /bff/conversations/:id/reply (agent reply
 * → outbound message). Mỗi hội thoại 3 tin (customer → agent → customer).
 *
 * Chạy:  bun scripts/seed-conversations.ts
 *        (BE phải chạy, default http://localhost:4001; override: BE_URL=... bun ...)
 *        /webhooks/* có WebhookHmacGuard → script phải ký HMAC; cần WEBHOOK_HMAC_SECRET
 *        (cùng giá trị .env của BE): WEBHOOK_HMAC_SECRET=... bun scripts/seed-conversations.ts
 *
 * An toàn: script ngoài, KHÔNG đổi code BE, KHÔNG đăng ký trong app. Xóa file = sạch.
 * Idempotent: mỗi tin có externalMessageId random unique → chạy lại tạo hội thoại mới
 * (không trùng). Để reset: truncate bảng conversations + messages trong DB.
 */
import { createHash, createHmac } from 'node:crypto'

const BE = process.env.BE_URL ?? 'http://localhost:4001'
const HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET ?? ''

/**
 * Headers cho 1 request POST. Route /webhooks/* có WebhookHmacGuard → ký HMAC v1
 * (canonical giống app BFF: v1:{ts}:{METHOD}:{path}:{sha256(body)}); route /bff/*
 * không có guard → header thường (thêm header ký cũng vô hại, nhưng ký chọn lọc
 * cho rõ intent).
 */
function headersFor(path: string, body: string): Record<string, string> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!path.startsWith('/webhooks')) return base
  if (!HMAC_SECRET) {
    throw new Error('WEBHOOK_HMAC_SECRET chưa set — /webhooks/* giờ yêu cầu HMAC (guard fail-closed). Set cùng giá trị .env của BE.')
  }
  const ts = Math.floor(Date.now() / 1000)
  const canonical = `v1:${ts}:POST:${path}:${createHash('sha256').update(body).digest('hex')}`
  const signature = `v1=${createHmac('sha256', HMAC_SECRET).update(canonical).digest('hex')}`
  return { ...base, 'x-timestamp': String(ts), 'x-signature': signature }
}

async function post(path: string, body: unknown) {
  const raw = JSON.stringify(body)
  const res = await fetch(`${BE}${path}`, {
    method: 'POST',
    headers: headersFor(path, raw),
    body: raw,
  })
  const json: any = await res.json().catch(() => null)
  return { status: res.status, convId: json?.data?.conversationId ?? json?.conversationId }
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`

// ─── Zalo: customer báo vỡ ống → agent tiếp nhận → customer cảm ơn ─────────
async function seedZalo() {
  const sender = 'zalo-seed-bac-nam'
  let r = await post('/webhooks/zalo', {
    event: 'message',
    sender: { id: sender },
    message: { msg_id: uid('zalo'), text: 'Anh ơi, đường ống trước nhà tôi bị vỡ, nước chảy ra đường nhiều lắm' },
    trackingId: uid('track'),
  })
  const convId = r.convId
  console.log(`  Zalo inbound 1: ${r.status}  conv=${convId}`)
  r = await post(`/bff/conversations/${convId}/reply`, { agentId: 'agent-mvp', content: 'Dạ em ghi nhận sự cố vỡ ống. Em điều phối đội sửa chữa đến trong 30 phút ạ.' })
  console.log(`  Zalo outbound : ${r.status}`)
  r = await post('/webhooks/zalo', {
    event: 'message',
    sender: { id: sender },
    message: { msg_id: uid('zalo'), text: 'Cảm ơn anh, tôi chờ đội đến ạ' },
    trackingId: uid('track'),
  })
  console.log(`  Zalo inbound 2: ${r.status}`)
  return convId
}

// ─── Facebook: customer báo nước đục → agent xử lý → customer bổ sung địa chỉ ──
async function seedFacebook() {
  const sender = 'fb-seed-hoa'
  let r = await post('/webhooks/facebook', {
    object: 'page',
    entry: [{ messaging: [{ sender: { id: sender }, message: { mid: uid('fb'), text: 'Nước sinh hoạt mấy hôm nay đục, có mùi lạ, gia đình tôi không dám dùng' } }] }],
  })
  const convId = r.convId
  console.log(`  FB   inbound 1: ${r.status}  conv=${convId}`)
  r = await post(`/bff/conversations/${convId}/reply`, { agentId: 'agent-mvp', content: 'Dạ em ghi nhận phản ánh chất lượng nước. Đội kiểm định sẽ lấy mẫu trong 24h và báo kết quả ạ.' })
  console.log(`  FB   outbound : ${r.status}`)
  r = await post('/webhooks/facebook', {
    object: 'page',
    entry: [{ messaging: [{ sender: { id: sender }, message: { mid: uid('fb'), text: 'Khu vực tôi ở P. Tân Thành, mong công ty kiểm tra sớm' } }] }],
  })
  console.log(`  FB   inbound 2: ${r.status}`)
  return convId
}

// main() wrapper — top-level await không hợp lệ trong file script CommonJS theo
// tsconfig (TS1309, lỗi pre-existing từ trước branch này).
async function main() {
  console.log('=== Seed 2 hội thoại (Zalo + Facebook) ===')
  const zaloConv = await seedZalo()
  const fbConv = await seedFacebook()
  console.log('\n=== Seed xong ===')
  console.log(`  Zalo     conv: ${zaloConv}`)
  console.log(`  Facebook conv: ${fbConv}`)
  console.log(`\nKiểm tra (curl):`)
  console.log(`  curl -s ${BE}/bff/inbox`)
  console.log(`  curl -s ${BE}/bff/conversations/${zaloConv}`)
  console.log(`  curl -s ${BE}/bff/conversations/${fbConv}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
