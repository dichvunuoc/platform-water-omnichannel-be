/**
 * ⚠️ DEV-ONLY — seed 2 hội thoại thật (Zalo + Facebook) vào DB qua webhook ingest.
 *
 * Cách hoạt động: POST /webhooks/{zalo,facebook} (normalizer → ReceiveInboundMessageCommand
 * → persist conversation + inbound message) + POST /bff/conversations/:id/reply (agent reply
 * → outbound message). Mỗi hội thoại 3 tin (customer → agent → customer).
 *
 * Chạy:  bun scripts/seed-conversations.ts
 *        (BE phải chạy, default http://localhost:4001; override: BE_URL=... bun ...)
 *
 * An toàn: script ngoài, KHÔNG đổi code BE, KHÔNG đăng ký trong app. Xóa file = sạch.
 * Idempotent: mỗi tin có externalMessageId random unique → chạy lại tạo hội thoại mới
 * (không trùng). Để reset: truncate bảng conversations + messages trong DB.
 */
const BE = process.env.BE_URL ?? 'http://localhost:4001'

async function post(path: string, body: unknown) {
  const res = await fetch(`${BE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
