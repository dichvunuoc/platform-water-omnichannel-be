/**
 * CSKH fixture — port verbatim từ FE `mocks/data/cskh-full.ts` + `cskh.ts`.
 *
 * BE trả data y hệt MSW (deterministic, đa kênh giữ nguyên 5 channels).
 * Mutable `let` exports để CskhController mutate in-memory (giống MSW handlers).
 * Sau này thay bằng real backing (conversation ingest → Ticket, real dashboard, etc.).
 */

// ─── Catalogs (đa kênh: 5 channels) ──────────────────────────────────────────
export const cskhCatalogs = {
  channels: {
    hotline: { id: 'hotline', label: 'Tổng đài 1900', short: 'Tổng đài', color: '#1A7F37', icon: 'IcPhone' },
    zalo: { id: 'zalo', label: 'Zalo OA', short: 'Zalo', color: '#0969DA', icon: 'IcZalo' },
    app: { id: 'app', label: 'App khách hàng', short: 'App', color: '#8250DF', icon: 'IcMobile' },
    web: { id: 'web', label: 'Web / Email', short: 'Web', color: '#0E7C86', icon: 'IcMail' },
    facebook: { id: 'facebook', label: 'Facebook', short: 'Facebook', color: '#9A6700', icon: 'IcFacebook' },
  },
  topics: {
    suco: { id: 'suco', label: 'Sự cố kỹ thuật', short: 'Sự cố', color: '#D1242F', icon: 'IcWrench' },
    chatluong: { id: 'chatluong', label: 'Chất lượng nước', short: 'Chất lượng', color: '#9A6700', icon: 'IcDroplet' },
    hoadon: { id: 'hoadon', label: 'Hoá đơn & công nợ', short: 'Hoá đơn', color: '#0969DA', icon: 'IcReceipt' },
    daunoi: { id: 'daunoi', label: 'Lắp mới / Đấu nối', short: 'Đấu nối', color: '#1A7F37', icon: 'IcPipe' },
    thongtin: { id: 'thongtin', label: 'Đổi thông tin', short: 'Thông tin', color: '#0E7C86', icon: 'IcId' },
    gopy: { id: 'gopy', label: 'Góp ý / Khiếu nại', short: 'Góp ý', color: '#8250DF', icon: 'IcChat' },
  },
  incKinds: {
    vo_ong: { id: 'vo_ong', label: 'Vỡ / bể ống', color: '#D1242F', icon: 'IcPipe' },
    ro_ri: { id: 'ro_ri', label: 'Rò rỉ nước', color: '#9A6700', icon: 'IcDroplet' },
    nuoc_duc: { id: 'nuoc_duc', label: 'Nước đục / bẩn', color: '#8B6914', icon: 'IcFlask' },
    mat_nuoc: { id: 'mat_nuoc', label: 'Mất nước', color: '#8250DF', icon: 'IcWifiOff' },
    yeu_ap: { id: 'yeu_ap', label: 'Nước yếu / áp thấp', color: '#0969DA', icon: 'IcGauge' },
    dong_ho: { id: 'dong_ho', label: 'Đồng hồ hỏng', color: '#0E7C86', icon: 'IcGauge' },
  },
  priority: {
    urgent: { id: 'urgent', label: 'Khẩn cấp', color: '#D1242F', slaH: 2 },
    high: { id: 'high', label: 'Cao', color: '#9A6700', slaH: 8 },
    normal: { id: 'normal', label: 'Thường', color: '#0969DA', slaH: 24 },
    low: { id: 'low', label: 'Thấp', color: '#7E8997', slaH: 72 },
  },
  status: {
    new: { id: 'new', label: 'Mới tiếp nhận', color: '#0969DA' },
    progress: { id: 'progress', label: 'Đang xử lý', color: '#9A6700' },
    waiting: { id: 'waiting', label: 'Chờ khách', color: '#8250DF' },
    resolved: { id: 'resolved', label: 'Đã xử lý', color: '#1A7F37' },
    closed: { id: 'closed', label: 'Đã đóng', color: '#7E8997' },
  },
  sentiment: {
    pos: { id: 'pos', label: 'Tích cực', color: '#1A7F37', icon: 'IcSmile' },
    neu: { id: 'neu', label: 'Trung tính', color: '#7E8997', icon: 'IcMeh' },
    neg: { id: 'neg', label: 'Tiêu cực', color: '#D1242F', icon: 'IcFrown' },
  },
  agents: [
    { id: 'a1', name: 'Trần Thị Lan', role: 'GDV · CSKH', online: true, team: 'Tổng đài' },
    { id: 'a2', name: 'Nguyễn Văn Hùng', role: 'GDV · CSKH', online: true, team: 'Tổng đài' },
    { id: 'a3', name: 'Phạm Minh Đức', role: 'Điều phối viên', online: true, team: 'Số hoá' },
    { id: 'a4', name: 'Lê Thị Hồng', role: 'GDV · CSKH', online: false, team: 'Số hoá' },
    { id: 'a5', name: 'Võ Quốc Bảo', role: 'Tổ trưởng CSKH', online: true, team: 'Điều hành' },
  ],
}

// ─── Message / Ticket types ──────────────────────────────────────────────────
export type MessageFrom = 'cust' | 'agent' | 'bot' | 'sys'
export interface Msg { from: MessageFrom; text: string; time: string; photo?: string }
const m = (from: MessageFrom, text: string, time: string, photo?: string): Msg =>
  photo ? { from, text, time, photo } : { from, text, time }

export interface Ticket {
  id: string; code: string; topic: string; channel: string; kind: string | null
  priority: string; status: string; sentiment: string; aiTag: boolean; aiConf: number
  name: string; maHb: string; phone: string; addr: string; phuong: string; custType: string
  preview: string; messages: Msg[]; agent: string; openedAt: number; ageH: number
  slaLeftH: number | null; slaTotalH: number; unread: number; msgTime: string
}
export type TicketDto = Ticket
export interface TicketListDto { items: TicketDto[]; total: number; page: number; pageSize: number }

// ─── Conversation sets ───────────────────────────────────────────────────────
const CONV_SUCO_VO: Msg[] = [
  m('cust', 'Alo, đường ống trước nhà tôi bị bể, nước phun lênh láng cả con hẻm rồi!', '09:42'),
  m('cust', '', '09:42', 'vo_ong'),
  m('agent', 'Dạ em tiếp nhận thông tin của anh/chị. Em xác nhận địa chỉ là 128 Lê Lợi, P. Lê Lợi đúng không ạ?', '09:43'),
  m('cust', 'Đúng rồi, ngay đầu hẻm. Mấy nhà xung quanh cũng mất nước theo.', '09:44'),
  m('agent', 'Em đã tạo phiếu sự cố ưu tiên KHẨN và chuyển đội hiện trường (FSM). Dự kiến đội tới trong 90 phút ạ. Em xin số để báo tiến độ.', '09:45'),
]
const CONV_NUOC_DUC: Msg[] = [
  m('cust', 'Nước nhà mình mấy hôm nay hơi đục, có cặn vàng. Có sao không em?', '14:10'),
  m('cust', '', '14:11', 'nuoc_duc'),
  m('bot', 'Cảm ơn anh/chị đã phản ánh. Hệ thống ghi nhận khu vực P. Phú Mỹ đang súc xả tuyến ống định kỳ. Em chuyển GDV hỗ trợ thêm ạ.', '14:11'),
  m('agent', 'Dạ khu mình đang trong đợt súc rửa đường ống tới hết hôm nay. Anh/chị xả vòi 3-5 phút cho trong lại giúp em nhé. Nếu còn đục em cử người lấy mẫu ạ.', '14:18'),
]
const CONV_HOADON: Msg[] = [
  m('cust', 'Cho hỏi hoá đơn tháng này sao cao gấp đôi vậy? Nhà tôi có dùng gì nhiều đâu.', '10:05'),
  m('agent', 'Dạ để em tra cứu danh bộ giúp anh/chị. Mã 04-1207-00 đúng không ạ?', '10:06'),
  m('cust', 'Ừ đúng rồi.', '10:06'),
  m('agent', 'Em thấy chỉ số kỳ này 47 m³, tăng 22 m³ so với kỳ trước. Có thể do rò rỉ sau đồng hồ. Em đặt lịch kiểm tra hiện trường miễn phí cho mình nhé?', '10:09'),
  m('cust', 'Vậy đặt giúp tôi sáng mai.', '10:10'),
]
const CONV_MAT_NUOC: Msg[] = [
  m('cust', 'Khu mình mất nước từ tối qua tới giờ chưa có lại. Bao giờ có nước vậy?', '07:30'),
  m('agent', 'Dạ khu P. Hoà Bình đang có lịch cắt nước sửa chữa van tuyến chính, dự kiến cấp lại trước 12h trưa nay ạ.', '07:33'),
  m('cust', 'Sao không báo trước gì hết vậy trời.', '07:33'),
  m('agent', 'Em xin lỗi vì bất tiện. Đây là sự cố đột xuất tối qua. Em đã bật thông báo Zalo cho mình để cập nhật ngay khi có nước lại ạ.', '07:35'),
]
const CONV_GOPY: Msg[] = [
  m('cust', 'Thái độ nhân viên ghi chỉ số hôm qua không được lịch sự cho lắm.', '16:20'),
  m('agent', 'Em rất tiếc về trải nghiệm của anh/chị. Em ghi nhận góp ý và chuyển tổ trưởng địa bàn xử lý, sẽ phản hồi anh/chị trong 24h ạ.', '16:24'),
]
const CONV_DAUNOI: Msg[] = [
  m('cust', 'Mình muốn lắp đồng hồ nước cho nhà mới xây thì làm thủ tục gì?', '11:00'),
  m('bot', 'Dạ để đăng ký lắp mới, anh/chị cần: CCCD chủ hộ, giấy tờ nhà/đất, sơ đồ vị trí. Em gửi link đăng ký online và chuyển bộ phận đấu nối ạ.', '11:00'),
  m('agent', 'Em là Lan hỗ trợ hồ sơ lắp mới. Anh/chị gửi giúp em ảnh CCCD và địa chỉ lắp đặt, em tạo phiếu khảo sát hiện trường trong hôm nay nhé.', '11:05'),
]

// ─── Fixed "đẹp" tickets ─────────────────────────────────────────────────────
const FIXED_TICKETS: Ticket[] = [
  { id: 'tk-0001', code: 'YC24512', topic: 'suco', kind: 'vo_ong', channel: 'hotline', priority: 'urgent', status: 'progress', sentiment: 'neg', aiTag: true, aiConf: 96, name: 'Nguyễn Thị Hồng Vân', maHb: '04-1207-00', phone: '0908 215 770', addr: '128 Lê Lợi', phuong: 'P. Lê Lợi', custType: 'sh', preview: 'Đường ống trước nhà bị bể, nước phun lênh láng…', messages: CONV_SUCO_VO, agent: 'Trần Thị Lan', openedAt: 9.7, ageH: 0.4, msgTime: '2 phút', unread: 1, slaLeftH: 1.6, slaTotalH: 2 },
  { id: 'tk-0002', code: 'YC24231', topic: 'chatluong', kind: 'nuoc_duc', channel: 'zalo', priority: 'high', status: 'progress', sentiment: 'neu', aiTag: true, aiConf: 91, name: 'Trần Văn Bình', maHb: '07-3318-21', phone: '0917 200 551', addr: '45 Phú Mỹ', phuong: 'P. Phú Mỹ', custType: 'sh', preview: 'Nước mấy hôm nay hơi đục, có cặn vàng…', messages: CONV_NUOC_DUC, agent: 'Nguyễn Văn Hùng', openedAt: 14.1, ageH: 5.9, msgTime: '32 phút', unread: 0, slaLeftH: 2.1, slaTotalH: 8 },
  { id: 'tk-0003', code: 'YC24088', topic: 'hoadon', kind: null, channel: 'app', priority: 'normal', status: 'waiting', sentiment: 'neu', aiTag: true, aiConf: 88, name: 'Lê Thị Mai', maHb: '04-1207-00', phone: '0917 882 314', addr: '12 Trần Phú', phuong: 'P. Lê Lợi', custType: 'sh', preview: 'Hoá đơn tháng này sao cao gấp đôi vậy?', messages: CONV_HOADON, agent: 'Trần Thị Lan', openedAt: 10.1, ageH: 9.9, msgTime: '1 giờ', unread: 0, slaLeftH: 14.1, slaTotalH: 24 },
  { id: 'tk-0004', code: 'YC24375', topic: 'suco', kind: 'mat_nuoc', channel: 'facebook', priority: 'high', status: 'new', sentiment: 'neg', aiTag: true, aiConf: 93, name: 'Phạm Gia Khoa', maHb: '05-7741-08', phone: '0772 813 244', addr: '90 Hoà Bình', phuong: 'P. Hoà Bình', custType: 'sh', preview: 'Khu mình mất nước từ tối qua tới giờ…', messages: CONV_MAT_NUOC, agent: '—', openedAt: 7.5, ageH: 12.5, msgTime: '15 phút', unread: 2, slaLeftH: -4.5, slaTotalH: 8 },
  { id: 'tk-0005', code: 'YC24601', topic: 'gopy', kind: null, channel: 'web', priority: 'low', status: 'resolved', sentiment: 'neg', aiTag: true, aiConf: 84, name: 'Vũ Thanh Hương', maHb: '03-2204-55', phone: '0905 412 880', addr: '7 Bà Triệu', phuong: 'P. Quang Trung', custType: 'sh', preview: 'Thái độ nhân viên ghi chỉ số chưa lịch sự…', messages: CONV_GOPY, agent: 'Võ Quốc Bảo', openedAt: 16.3, ageH: 3.7, msgTime: '2 giờ', unread: 0, slaLeftH: null, slaTotalH: 72 },
  { id: 'tk-0006', code: 'YC24019', topic: 'daunoi', kind: null, channel: 'zalo', priority: 'normal', status: 'progress', sentiment: 'pos', aiTag: true, aiConf: 90, name: 'Cty TNHH Dệt may Phương Đông', maHb: '09-5512-00', phone: '0888 332 109', addr: 'Lô C7 KCN Trà Nóc', phuong: 'P. Phú Mỹ', custType: 'kddv', preview: 'Muốn lắp đồng hồ nước cho nhà mới xây…', messages: CONV_DAUNOI, agent: 'Lê Thị Hồng', openedAt: 11.0, ageH: 9.0, msgTime: '8 phút', unread: 1, slaLeftH: 15.0, slaTotalH: 24 },
]

// ─── Filler tickets 7–26 ─────────────────────────────────────────────────────
const FILL_TOPICS = ['suco', 'chatluong', 'hoadon', 'suco', 'gopy', 'daunoi']
const FILL_CONVS = [CONV_SUCO_VO, CONV_NUOC_DUC, CONV_HOADON, CONV_MAT_NUOC, CONV_GOPY, CONV_DAUNOI]
const FILL_KINDS: (string | null)[] = ['vo_ong', 'nuoc_duc', null, 'mat_nuoc', null, null]
const FILL_PREVIEWS = [
  'Đường ống trước nhà bị bể, nước phun lênh láng…',
  'Nước mấy hôm nay hơi đục, có cặn vàng…',
  'Hoá đơn tháng này sao cao gấp đôi vậy?',
  'Khu mình mất nước từ tối qua tới giờ…',
  'Thái độ nhân viên ghi chỉ số chưa lịch sự…',
  'Muốn lắp đồng hồ nước cho nhà mới xây…',
]
const FILLER_CHANNELS = ['hotline', 'zalo', 'app', 'web', 'facebook']
const FILLER_PRIORITIES = ['normal', 'normal', 'high', 'urgent', 'low']
const FILLER_STATUSES = ['new', 'progress', 'progress', 'waiting', 'resolved']
const FILLER_NAMES = ['Nguyễn Văn An', 'Trần Thị Bích', 'Phạm Đức Cường', 'Lê Hữu Dũng', 'Hoàng Thị Hà', 'Vũ Ngọc Hương']
const FILLER_AGENTS = ['Trần Thị Lan', 'Nguyễn Văn Hùng', 'Phạm Minh Đức', 'Võ Quốc Bảo', '—']
const SLA_MAP: Record<string, number> = { urgent: 2, high: 8, normal: 24, low: 72 }

function makeFiller(i: number): Ticket {
  const k = (i - 7) % 6
  const priority = FILLER_PRIORITIES[i % 5]!
  const status = FILLER_STATUSES[i % 5]!
  const ageH = (i % 10) + 0.5
  const slaH = SLA_MAP[priority]!
  const slaLeftH = status === 'resolved' || status === 'closed' ? null : Math.round((slaH - ageH) * 10) / 10
  return {
    id: `tk-${String(i).padStart(4, '0')}`,
    code: `YC${24000 + i * 37}`,
    topic: FILL_TOPICS[k]!,
    channel: FILLER_CHANNELS[i % 5]!,
    kind: FILL_KINDS[k]!,
    priority,
    status,
    sentiment: ['neu', 'neg', 'pos'][i % 3]!,
    aiTag: true,
    aiConf: 80 + (i % 18),
    name: FILLER_NAMES[k]!,
    maHb: `0${(i % 9) + 1}-${1000 + i * 13}-${String(i % 100).padStart(2, '0')}`,
    phone: `09${String(10 + i).padStart(2, '0')} ${300 + i} ${400 + i}`,
    addr: `${i * 3 + 1} Đường ${i + 10}`,
    phuong: ['P. Lê Lợi', 'P. Phú Mỹ', 'P. Hoà Bình', 'P. Quang Trung'][i % 4]!,
    custType: i % 4 === 0 ? 'kddv' : 'sh',
    preview: FILL_PREVIEWS[k]!,
    messages: FILL_CONVS[k]!,
    agent: FILLER_AGENTS[i % 5]!,
    openedAt: (i % 20) + 1,
    ageH,
    msgTime: ['2 phút', '8 phút', '15 phút', '32 phút', '1 giờ', '2 giờ'][i % 6]!,
    unread: i % 3 === 0 ? i % 3 : 0,
    slaLeftH,
    slaTotalH: slaH,
  }
}

const FILLER_TICKETS: Ticket[] = Array.from({ length: 20 }, (_, j) => makeFiller(j + 7))

/** Mutable: CskhController mutate in-memory (giống MSW). */
export let cskhTickets: Ticket[] = [...FIXED_TICKETS, ...FILLER_TICKETS]

// ─── Incidents ────────────────────────────────────────────────────────────────
export interface Incident {
  id: string; code: string; kind: string; aiConf: number; channel: string
  status: 'new' | 'triaged' | 'dispatched'; name: string; phone: string; addr: string
  phuong: string; gps: [number, number]; note: string; time: string; priority: string
  dma: string; aiAlt: { k: string; c: number }[]; aiNote: string
}

/** Mutable */
export let cskhIncidents: Incident[] = [
  { id: 'inc-01', code: 'SC-2041', kind: 'vo_ong', aiConf: 97, channel: 'zalo', status: 'new', name: 'Nguyễn Thị Hồng Vân', phone: '0908 215 770', addr: 'Đầu hẻm 128 Lê Lợi', phuong: 'P. Lê Lợi', gps: [10.236, 105.812], note: 'Ống cái trước nhà bể, nước phun cao cả mét, ngập hẻm.', time: '3 phút trước', priority: 'urgent', dma: 'DMA-07', aiAlt: [{ k: 'ro_ri', c: 71 }], aiNote: 'Phát hiện cột nước phun + vũng ngập lớn → khả năng vỡ ống cấp 1.' },
  { id: 'inc-02', code: 'SC-2042', kind: 'nuoc_duc', aiConf: 92, channel: 'app', status: 'new', name: 'Trần Văn Bình', phone: '0917 200 551', addr: '45 Phú Mỹ', phuong: 'P. Phú Mỹ', gps: [10.061, 105.742], note: 'Nước hứng ra vàng đục, có cặn lợn cợn.', time: '12 phút trước', priority: 'high', dma: 'DMA-11', aiAlt: [{ k: 'ro_ri', c: 24 }], aiNote: 'Mẫu nước đục độ cao, ngả vàng → nghi cặn sắt/súc xả tuyến.' },
  { id: 'inc-03', code: 'SC-2043', kind: 'ro_ri', aiConf: 88, channel: 'facebook', status: 'triaged', name: 'Phạm Gia Khoa', phone: '0772 813 244', addr: '90 Hoà Bình', phuong: 'P. Hoà Bình', gps: [10.21, 105.79], note: 'Mặt đường rỉ nước ướt cả tuần nay, nghi ống ngầm rò.', time: '26 phút trước', priority: 'normal', dma: 'DMA-04', aiAlt: [{ k: 'vo_ong', c: 41 }], aiNote: 'Vết ẩm loang trên mặt nhựa, không thấy cột nước → rò rỉ ngầm.' },
  { id: 'inc-04', code: 'SC-2044', kind: 'dong_ho', aiConf: 90, channel: 'zalo', status: 'triaged', name: 'Lê Thị Mai', phone: '0935 661 027', addr: '7 Bà Triệu', phuong: 'P. Quang Trung', gps: [10.18, 105.77], note: 'Đồng hồ nước mặt kính mờ, kim không quay dù đang xả.', time: '41 phút trước', priority: 'normal', dma: 'DMA-02', aiAlt: [], aiNote: 'Mặt số đồng hồ đọng hơi nước, kim đứng → nghi kẹt/hỏng cơ cấu đo.' },
  { id: 'inc-05', code: 'SC-2045', kind: 'vo_ong', aiConf: 95, channel: 'hotline', status: 'dispatched', name: 'Vũ Thanh Hương', phone: '0905 412 880', addr: 'Ngã 3 Bà Triệu – Lê Lợi', phuong: 'P. Quang Trung', gps: [10.19, 105.78], note: 'Xe tải cán bể trụ cứu hoả, nước tràn ra đường lớn.', time: '1 giờ trước', priority: 'urgent', dma: 'DMA-02', aiAlt: [], aiNote: 'Cột nước cao áp + hư hại trụ nổi → vỡ ống áp lực, cần đội khẩn.' },
  { id: 'inc-06', code: 'SC-2046', kind: 'yeu_ap', aiConf: 85, channel: 'app', status: 'new', name: 'Đặng Minh Sơn', phone: '0888 332 109', addr: '210 Hùng Vương', phuong: 'P. Tân Thành', gps: [10.07, 105.75], note: 'Tầng 3 gần như không có nước, tầng trệt thì yếu.', time: '1 giờ trước', priority: 'high', dma: 'DMA-09', aiAlt: [{ k: 'mat_nuoc', c: 33 }], aiNote: 'Ảnh vòi chảy nhỏ giọt → áp lực thấp cục bộ cuối tuyến.' },
]

// ─── CSAT ────────────────────────────────────────────────────────────────────
export const cskhCsat = {
  avg: 4.4,
  total: 1284,
  nps: 58,
  dist: [{ s: 5, n: 712 }, { s: 4, n: 358 }, { s: 3, n: 121 }, { s: 2, n: 56 }, { s: 1, n: 37 }],
  trend: [{ m: 'T1', v: 4.1 }, { m: 'T2', v: 4.2 }, { m: 'T3', v: 4.2 }, { m: 'T4', v: 4.3 }, { m: 'T5', v: 4.5 }, { m: 'T6', v: 4.4 }],
  byChannel: [
    { ch: 'hotline', v: 4.5, n: 486 }, { ch: 'zalo', v: 4.6, n: 392 },
    { ch: 'app', v: 4.3, n: 248 }, { ch: 'web', v: 4.0, n: 96 }, { ch: 'facebook', v: 3.9, n: 62 },
  ],
  recent: [
    { name: 'Nguyễn Thị Hồng Vân', score: 5, ch: 'zalo', agent: 'Trần Thị Lan', topic: 'suco', text: 'Đội tới rất nhanh, xử lý vỡ ống trong buổi sáng. Cảm ơn!', time: '20 phút trước' },
    { name: 'Lê Thị Mai', score: 4, ch: 'app', agent: 'Trần Thị Lan', topic: 'hoadon', text: 'Được giải thích rõ ràng, có hẹn kiểm tra. Khá hài lòng.', time: '1 giờ trước' },
    { name: 'Vũ Thanh Hương', score: 2, ch: 'web', agent: 'Võ Quốc Bảo', topic: 'gopy', text: 'Phản hồi hơi chậm, phải nhắc lại 2 lần.', time: '3 giờ trước' },
    { name: 'Phạm Gia Khoa', score: 5, ch: 'facebook', agent: 'Nguyễn Văn Hùng', topic: 'suco', text: 'Báo mất nước buổi sáng, trưa có nước lại. Tốt.', time: '5 giờ trước' },
    { name: 'Đặng Minh Sơn', score: 3, ch: 'app', agent: 'Lê Thị Hồng', topic: 'chatluong', text: 'Vẫn còn yếu nước, mong xử lý dứt điểm.', time: 'Hôm qua' },
  ],
}

// ─── Knowledge + canned ───────────────────────────────────────────────────────
export const cskhKnowledge = {
  kb: [
    { id: 'kb1', group: 'Sự cố & kỹ thuật', title: 'Quy trình tiếp nhận & điều phối sự cố vỡ/bể ống', views: 1240, updated: '2 ngày trước', tag: 'suco' },
    { id: 'kb2', group: 'Sự cố & kỹ thuật', title: 'Hướng dẫn xử lý phản ánh nước đục sau súc xả tuyến', views: 864, updated: '1 tuần trước', tag: 'chatluong' },
    { id: 'kb3', group: 'Hoá đơn', title: 'Giải thích hoá đơn tăng đột biến & quy trình kiểm tra rò rỉ', views: 2105, updated: '3 ngày trước', tag: 'hoadon' },
    { id: 'kb4', group: 'Hoá đơn', title: 'Các hình thức thanh toán & tra cứu công nợ', views: 1788, updated: '5 ngày trước', tag: 'hoadon' },
    { id: 'kb5', group: 'Dịch vụ', title: 'Thủ tục lắp đặt đồng hồ nước cho khách hàng mới', views: 932, updated: '1 tuần trước', tag: 'daunoi' },
    { id: 'kb6', group: 'Dịch vụ', title: 'Hướng dẫn đăng ký & liên kết Zalo OA nhận thông báo', views: 651, updated: '2 tuần trước', tag: 'thongtin' },
  ],
  canned: [
    { id: 'c1', title: 'Xác nhận tiếp nhận sự cố', topic: 'suco', text: 'Dạ em đã tiếp nhận thông tin và tạo phiếu sự cố ưu tiên cho mình. Đội hiện trường sẽ liên hệ trong thời gian sớm nhất ạ. Em xin số điện thoại để cập nhật tiến độ.' },
    { id: 'c2', title: 'Hướng dẫn nước đục sau súc xả', topic: 'chatluong', text: 'Dạ khu mình đang trong đợt súc rửa đường ống định kỳ. Anh/chị vui lòng xả vòi 3-5 phút cho nước trong trở lại. Nếu vẫn còn đục, em cử nhân viên tới lấy mẫu kiểm tra miễn phí ạ.' },
    { id: 'c3', title: 'Giải thích hoá đơn tăng', topic: 'hoadon', text: 'Dạ em đã tra cứu danh bộ của mình. Chỉ số kỳ này tăng so với kỳ trước, khả năng do rò rỉ sau đồng hồ. Em đặt lịch kiểm tra hiện trường miễn phí cho anh/chị nhé.' },
    { id: 'c4', title: 'Báo lịch cắt nước', topic: 'suco', text: 'Dạ khu vực mình có lịch tạm ngưng cấp nước để sửa chữa, dự kiến cấp lại trước [GIỜ]. Em đã bật thông báo Zalo để cập nhật ngay khi có nước lại ạ. Mong anh/chị thông cảm.' },
    { id: 'c5', title: 'Hướng dẫn lắp mới', topic: 'daunoi', text: 'Dạ để đăng ký lắp mới, anh/chị chuẩn bị: CCCD chủ hộ, giấy tờ nhà/đất, sơ đồ vị trí lắp. Em gửi link đăng ký online và tạo phiếu khảo sát hiện trường trong hôm nay ạ.' },
    { id: 'c6', title: 'Cảm ơn & khảo sát', topic: 'gopy', text: 'Cảm ơn anh/chị đã phản hồi. Yêu cầu của mình đã được xử lý. Anh/chị vui lòng đánh giá chất lượng phục vụ qua link khảo sát để chúng em cải thiện ạ.' },
  ],
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────
export interface BotData {
  enabled: boolean; autoRate: number; deflect: number; handoff: number
  intents: { id: string; name: string; hits: number; success: number; icon: string }[]
  sample: Msg[]
}

/** Mutable */
export let cskhBot: BotData = {
  enabled: true,
  autoRate: 68,
  deflect: 1840,
  handoff: 612,
  intents: [
    { id: 'b1', name: 'Tra cứu hoá đơn', hits: 4210, success: 94, icon: 'IcReceipt' },
    { id: 'b2', name: 'Báo sự cố mất nước', hits: 2860, success: 81, icon: 'IcWifiOff' },
    { id: 'b3', name: 'Lịch cắt nước khu vực', hits: 2240, success: 96, icon: 'IcCalendar' },
    { id: 'b4', name: 'Hướng dẫn lắp mới', hits: 1320, success: 72, icon: 'IcPipe' },
    { id: 'b5', name: 'Tự báo chỉ số nước', hits: 980, success: 88, icon: 'IcGauge' },
    { id: 'b6', name: 'Gặp tổng đài viên', hits: 612, success: 100, icon: 'IcHeadset' },
  ],
  sample: [
    m('bot', 'Dạ em là trợ lý ảo Cấp nước. Em có thể giúp gì cho mình? 💧', '—'),
    m('cust', 'Tra cứu hoá đơn tháng 6', '—'),
    m('bot', 'Anh/chị cho em xin mã danh bộ (in trên hoá đơn) hoặc số điện thoại đã đăng ký ạ.', '—'),
    m('cust', '04-1207-00', '—'),
    m('bot', 'Hoá đơn kỳ T6/2026 của danh bộ 04-1207-00:\n• Tiêu thụ: 18 m³\n• Thành tiền: 215.400đ\n• Hạn nộp: 25/06/2026\nAnh/chị muốn [Thanh toán ngay] hay [Gặp tổng đài viên]?', '—'),
    m('cust', 'Thanh toán ngay', '—'),
    m('bot', 'Em gửi link thanh toán 1 chạm qua Zalo Pay. Cảm ơn anh/chị! 🙏', '—'),
  ],
}

// ─── Broadcasts ────────────────────────────────────────────────────────────────
export interface Broadcast {
  id: string; title: string; status: string; channels: string[]
  audience: number; sent: number; opened: number; scheduled: string; area: string; window: string
}

/** Mutable */
export let cskhBroadcasts: Broadcast[] = [
  { id: 'bc1', title: 'Tạm ngưng cấp nước sửa van tuyến Φ400 — P. Hoà Bình', status: 'sent', channels: ['zalo', 'app'], audience: 4820, sent: 4820, opened: 3914, scheduled: 'Hôm nay 06:00', area: 'P. Hoà Bình, P. Tân Thành', window: '08:00 – 12:00 20/06' },
  { id: 'bc2', title: 'Súc xả tuyến ống định kỳ — KCN Trà Nóc', status: 'sending', channels: ['zalo', 'app', 'web'], audience: 1280, sent: 742, opened: 410, scheduled: 'Đang gửi', area: 'P. Phú Mỹ', window: '13:00 – 17:00 20/06' },
  { id: 'bc3', title: 'Bảo trì trạm bơm tăng áp — P. Quang Trung', status: 'scheduled', channels: ['zalo'], audience: 3140, sent: 0, opened: 0, scheduled: '21/06 05:30', area: 'P. Quang Trung', window: '22:00 21/06 – 02:00 22/06' },
  { id: 'bc4', title: 'Khôi phục cấp nước sau sự cố vỡ ống Lê Lợi', status: 'draft', channels: ['zalo', 'app'], audience: 1960, sent: 0, opened: 0, scheduled: '—', area: 'P. Lê Lợi', window: 'Ngay khi cấp lại' },
]

// ─── Dashboard ────────────────────────────────────────────────────────────────
const _openTickets = FIXED_TICKETS.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length
  + FILLER_TICKETS.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length
const _breach = FIXED_TICKETS.filter((t) => t.slaLeftH != null && t.slaLeftH < 0).length
  + FILLER_TICKETS.filter((t) => t.slaLeftH != null && t.slaLeftH < 0).length

export const cskhDash = {
  kpis: [
    { label: 'Yêu cầu hôm nay', value: 342, unit: 'phiếu', icon: 'IcInbox', tone: '#8250DF', sub: '+18% so với hôm qua', up: true },
    { label: 'Đang mở', value: _openTickets, unit: 'phiếu', icon: 'IcChat', tone: '#0969DA', sub: `${_breach} phiếu trễ SLA`, up: false },
    { label: 'Đúng hạn SLA', value: 94.2, unit: '%', icon: 'IcClock', tone: '#1A7F37', sub: 'Mục tiêu ≥ 92%', up: true },
    { label: 'Hài lòng (CSAT)', value: 4.4, unit: '/5', icon: 'IcStar', tone: '#9A6700', sub: 'NPS +58', up: true },
  ],
  volByChannel: [
    { ch: 'hotline', n: 128 }, { ch: 'zalo', n: 96 }, { ch: 'app', n: 64 }, { ch: 'web', n: 32 }, { ch: 'facebook', n: 22 },
  ],
  volByTopic: [
    { t: 'suco', n: 118 }, { t: 'hoadon', n: 86 }, { t: 'chatluong', n: 58 }, { t: 'daunoi', n: 36 }, { t: 'thongtin', n: 28 }, { t: 'gopy', n: 16 },
  ],
  hourly: [4, 3, 2, 2, 3, 8, 22, 38, 46, 41, 35, 30, 26, 33, 39, 34, 28, 24, 18, 14, 11, 9, 7, 5],
  slaTrend: [{ m: 'T1', v: 90.2 }, { m: 'T2', v: 91.5 }, { m: 'T3', v: 92.1 }, { m: 'T4', v: 93.4 }, { m: 'T5', v: 94.8 }, { m: 'T6', v: 94.2 }],
  agents: [
    { name: 'Trần Thị Lan', team: 'Tổng đài', online: true, handled: 86, sla: 96, csat: 4.6, open: 4 },
    { name: 'Nguyễn Văn Hùng', team: 'Tổng đài', online: true, handled: 74, sla: 93, csat: 4.4, open: 6 },
    { name: 'Phạm Minh Đức', team: 'Số hoá', online: true, handled: 51, sla: 91, csat: 4.3, open: 3 },
    { name: 'Lê Thị Hồng', team: 'Số hoá', online: false, handled: 0, sla: 0, csat: 0, open: 0 },
    { name: 'Võ Quốc Bảo', team: 'Điều hành', online: true, handled: 63, sla: 95, csat: 4.5, open: 2 },
  ],
}

// ─── Type aliases (cho port interfaces tham chiếu) ───────────────────────────
export type CsatAggregate = typeof cskhCsat;
export type KnowledgeBase = typeof cskhKnowledge;
export type DashboardData = typeof cskhDash;

// ─── Telephony (softphone — tổng đài 1900) ───────────────────────────────────
export interface CallSummary {
  id: string; name: string; phone: string; waitSec: number; ivr: string; topic: string;
}
export interface ActiveCall {
  callId: string; name: string; phone: string; durationSec: number; ivr: string;
  topic: string; status: 'connected';
}
export interface CallLogEntry {
  callId: string; name: string; phone: string; durationSec: number;
  direction: 'in' | 'out'; time: string; topic?: string;
}
export interface CallerProfile {
  phone: string; name: string; maHb?: string; custType?: string; addr?: string; status?: string;
}
export interface CallRecording {
  callId: string; url: string; consent: boolean; retentionDays: number;
}

/** Mutable */
export let cskhTelephony = {
  queue: [
    { id: 'c1', name: 'Dàng Minh Sơn', phone: '0888 332 109', waitSec: 38, ivr: 'Nhánh 2 - Sự cố', topic: 'suco' },
    { id: 'c2', name: 'Bùi Thị Ngọc', phone: '0917 200 551', waitSec: 72, ivr: 'Nhánh 1 - Hoá đơn', topic: 'hoadon' },
    { id: 'c3', name: 'Hồ Văn Tâm', phone: '0938 412 770', waitSec: 21, ivr: 'Nhánh 2 - Sự cố', topic: 'suco' },
  ] as CallSummary[],
  activeCall: {
    callId: 'call-active-01', name: 'Dàng Minh Sơn', phone: '0888 332 109', durationSec: 72,
    ivr: 'Nhánh 2 - Sự cố', topic: 'Sự cố', status: 'connected',
  } as ActiveCall,
  log: [
    { callId: 'cl1', name: 'Nguyễn Thị Hồng Vân', phone: '0908 215 770', durationSec: 252, direction: 'in', time: '09:42', topic: 'suco' },
    { callId: 'cl2', name: 'Lê Thị Mai', phone: '0917 882 314', durationSec: 390, direction: 'in', time: '10:05', topic: 'hoadon' },
    { callId: 'cl3', name: 'Trần Quốc Bảo', phone: '0938 412 770', durationSec: 168, direction: 'in', time: '11:20', topic: 'chatluong' },
    { callId: 'cl4', name: 'Phạm Gia Khoa', phone: '0772 813 244', durationSec: 115, direction: 'out', time: '14:00' },
  ] as CallLogEntry[],
  recordings: [
    { callId: 'cl1', url: '/rec/cl1.mp3', consent: true, retentionDays: 90 },
  ] as CallRecording[],
};
