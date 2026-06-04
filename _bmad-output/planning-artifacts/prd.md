---
stepsCompleted: [v3-rewrite]
inputDocuments:
  - product-brief-IOC-Customer-2026-06-02.md
  - docs/Mota_Tinh_Nang_KinhDoanh_KhachHang (AutoRecovered).docx
workflowType: 'prd'
version: '4.0'
classification:
  projectType: bff_customer_portal
  domain: utility
  subDomain: govtech
  complexity: high
  projectContext: brownfield
  authScope: customer_only
  ticketOwner: ticketing_service
---

# Product Requirements Document — Module CSKH (BFF - Customer Portal)

**Author:** Pc
**Date:** 2026-06-03
**Version:** 4.0 (Cập nhật toàn diện theo Mô tả Tính năng Kinh doanh & Khách hàng)

---

## Executive Summary

### Tuyên ngôn Sản phẩm

Module CSKH được định vị là một **Backend For Frontend (BFF) / API Gateway** chuyên biệt phục vụ cho **điểm chạm của Khách hàng cuối (End-users)** thông qua ứng dụng **My Công ty** (Mobile App, Web Portal, Zalo OA).

**Triết lý cốt lõi: "0% Nghiệp vụ - 100% Trải nghiệm"**

- Mọi nhu cầu của Khách hàng (Mobile App, Web Portal, Zalo) đều đi qua cổng này.
- Không xử lý bất kỳ logic nghiệp vụ cụ thể nào. Module đóng vai trò là **"Lớp vỏ" (Shell)**, tiếp nhận yêu cầu và gọi (route) sang các Microservices nghiệp vụ tương ứng.
- SaaS White-labeling: Thiết kế Hexagonal Architecture cho phép đem bán giải pháp App CSKH cho nhà máy nước khác — chỉ cần viết ExternalAdapter mới, không đập code core.

### Vision

Module CSKH là **BFF Shell** — cổng duy nhất giữa Khách hàng và hệ sinh thái Microservices nội bộ. Mỗi request KH → BFF → Microservice phù hợp → response chuẩn hóa → trả về App/Web/Zalo.

BFF không sở hữu data nghiệp vụ. BFF không tính cước, không gán người sửa ống, không quản lý đồng hồ. BFF đảm bảo:
- KH nhận được trải nghiệm mượt mà trên mọi kênh
- Data từ nhiều Microservices được aggregate và chuẩn hóa trước khi gửi lên frontend
- Khi một Microservice down → KH vẫn nhận được phản hồi (cached hoặc graceful message)

### Differentiators

1. **"Lớp vỏ" thuần trải nghiệm** — Không ôm data nghiệp vụ, chỉ aggregate + transform. Thêm/xóa kênh = thêm/xóa Adapter, không sửa core.

2. **Hexagonal Ports & Adapters** — Mỗi Microservice giao tiếp qua Port interface. Đổi downstream service = đổi Adapter implementation, Port không đổi. Đây là nền tảng cho SaaS white-labeling.

3. **Auth tập trung cho KH** — Centralized customer auth cho mọi kênh. Đăng nhập 1 lần (SĐT/OTP, Zalo, Social) → truy cập mọi dịch vụ. Internal staff auth → do Identity Service riêng, không phải việc BFF.

4. **Context Preservation xuyên kênh** — KH chat Zalo buổi sáng → mở Web chiều → toàn bộ lịch sử còn nguyên. CRM phổ biến không hỗ trợ cross-channel context native.

5. **SaaS White-labeling** — Khi đem bán cho nhà máy nước khác (đã có phần mềm kế toán bên thứ 3), chỉ cần viết ExternalAdapter cắm vào hệ thống cũ. Toàn bộ App/Web vẫn hoạt động bình thường.

---

## Downstream Services Catalog (Tổng hợp từ Mô tả Tính năng)

> **Nguồn:** Phân tích từ "Mô tả chi tiết tính năng — Phân hệ Quản lý Kinh doanh và Khách hàng" (10 nhóm, 29 tính năng).
> Mỗi service được định nghĩa domain, responsibility, và interface mà BFF cần gọi/mock.

### Tổng quan 10 nhóm tính năng → Downstream Services

Phân hệ Kinh doanh & Khách hàng gồm 10 nhóm tính năng (29 tính năng). BFF không triển khai logic nghiệp vụ của nhóm nào — chỉ gọi sang services tương ứng qua Ports. Bảng dưới đây ánh xạ **mỗi nhóm tính năng → các downstream services cần mock**:

| Nhóm (Mota_Tinh_Nang) | Tên nhóm | Số tính năng | Downstream Services cần Mock | Ghi chú |
|---|---|---|---|---|
| **N1** | QUẢN LÝ THÔNG TIN KHÁCH HÀNG (Customer Master & 360°) | 3 | Customer Profile Service, Contract Service, Customer Segmentation Service | Nền tảng dữ liệu cốt lõi |
| **N2** | QUẢN LÝ ĐỒNG HỒ VÀ GHI CHỈ SỐ | 4 | Meter Service, Meter Reading Service, Smart Meter Service (AMR/AMI), Meter Anomaly Service | Mạch máu doanh thu |
| **N3** | LẬP HÓA ĐƠN VÀ QUẢN LÝ DOANH THU | 3 | Billing/Tariff Service, Invoice Service, Revenue Service | Trục dòng tiền |
| **N4** | THU CƯỚC VÀ QUẢN LÝ CÔNG NỢ | 3 | Payment Service, Debt Management Service, Water Cut-off Service | Đảm bảo dòng tiền vào |
| **N5** | CHĂM SÓC KHÁCH HÀNG ĐA KÊNH | 4 | Call Center Service, Ticketing/SLA Service, Feedback/Survey Service, Knowledge Base Service | Trải nghiệm khách hàng |
| **N6** | PHÁT TRIỂN KHÁCH HÀNG MỚI | 2 | Onboarding Service, Site Survey Service | Mở rộng tệp KH |
| **N7** | ỨNG DỤNG TỰ PHỤC VỤ KHÁCH HÀNG (My Công ty) | 1 | _Không có downstream riêng — BFF chính là backend của nhóm này_ | BFF aggregate từ mọi service khác |
| **N8** | MARKETING VÀ TRUYỀN THÔNG | 2 | Campaign Service, Proactive Communication Service | Truyền thông KH |
| **N9** | BÁO CÁO VÀ PHÂN TÍCH | 1 | Reporting Service (cho customer-facing views) | Insight cho KH |
| **N10** | AI NÂNG CAO | 6 | AI Chatbot Service, AI Leakage Alert Service, AI Fraud Detection Service, AI Forecast Service, AI Churn Service, AI Agent Assist Service | Tăng trưởng & tự động hóa |
| **Cross-cutting** | Phân hệ khác | — | GIS Service, SCADA Service, Water Quality Service, Field Team Service, eContract Service, Document/Storage Service | Liên kết liên phân hệ |

### Chi tiết từng Downstream Service cần Mock

#### S1: Customer Identity & Auth Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N1 (Customer 360°, liên kết KH), N7 (Đăng ký tài khoản) |
| **Domain** | Xác thực & định danh khách hàng |
| **Responsibility** | Đăng ký/đăng nhập KH qua SĐT/OTP, Zalo ID, Social login (Google, Facebook, Apple). Liên kết 1 KH với nhiều Provider (SĐT, Zalo, Email). Issue & verify JWT/Access token, refresh token. Quản lý Customer Auth DB. |
| **BFF gọi khi nào** | Mỗi request cần xác thực KH. Login flow. Token refresh. Provider linking. |
| **Protocol** | REST + JWT |
| **Mock priority** | **P0 — Bắt buộc MVP** — Không thể test bất kỳ flow nào không có auth |
| **Mock data cần thiết** | Customer profiles (5+ personas), provider links, tokens |

#### S2: Customer Profile Service (Customer 360°)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N1 - Tính năng 1.1 (Hồ sơ KH 360°) |
| **Domain** | Thông tin định danh khách hàng |
| **Responsibility** | Quản lý hồ sơ KH: mã KH duy nhất, họ tên/đơn vị, CCCD/MST, SĐT, email, Zalo, địa chỉ tiêu thụ + liên hệ. Phân loại sử dụng (sinh hoạt/sản xuất/hành chính/dịch vụ/KCN). Timeline tương tác 360°. Cây quan hệ KH (KCN → nhà máy thành viên). Người liên hệ phụ trợ. Tags thông minh. |
| **BFF gọi khi nào** | Hiển thị hồ sơ KH trên My Công ty. Tra cứu KH. Hiển thị context cho tổng đài viên. |
| **Protocol** | REST |
| **Mock priority** | **P0 — Bắt buộc MVP** |
| **Port Interface** | `ICustomerProfilePort` |

**Port Methods:**
- `getProfile(customerId)` → Customer 360° data
- `getProfileByPhone(phone)` → Customer lookup by phone
- `getTimeline(customerId, filters)` → Interaction timeline
- `getRelatedAccounts(customerId)` → Related accounts (KCN members)
- `updateProfile(customerId, data)` → Profile update
- `getTags(customerId)` → Customer tags

#### S3: Customer Segmentation Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N1 - Tính năng 1.2 (Phân khúc KH) |
| **Domain** | Phân loại & phân nhóm khách hàng |
| **Responsibility** | Phân khúc tĩnh (loại sử dụng), theo giá trị (VIP/Lớn/Vừa/Nhỏ), theo địa bàn (4 Xí nghiệp × DMA), theo hành vi (thanh toán, tiêu thụ), phân khúc động công thức tùy chỉnh. Lưu vết lịch sử thay đổi phân khúc. |
| **BFF gọi khi nào** | Hiển thị phân khúc KH trên profile. Xác định eligibility cho chiến dịch/ưu đãi. Hiển thị badge KH VIP. |
| **Protocol** | REST |
| **Mock priority** | **P2 — Phase 2** (MVP chỉ cần loại sử dụng cơ bản, lấy từ Contract Service) |
| **Port Interface** | `ISegmentationPort` |

**Port Methods:**
- `getSegments(customerId)` → Phân khúc hiện tại
- `getSegmentHistory(customerId)` → Lịch sử thay đổi
- `checkEligibility(customerId, campaignId)` → Kiểm tra điều kiện tham gia

#### S4: Contract Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N1 - Tính năng 1.3 (Quản lý hợp đồng) |
| **Domain** | Quản lý hợp đồng dịch vụ cấp nước |
| **Responsibility** | Vòng đời hợp đồng: tạo, gia hạn, sửa đổi, chấm dứt. Template hợp đồng theo nhóm KH. Ký số (eContract). Lưu trữ với hash chống sửa đổi. Cảnh báo gia hạn. Versioning. Gắn kết Tariff Engine (điều khoản giá đặc thù). Workflow phê duyệt nhiều cấp. |
| **BFF gọi khi nào** | KH xem hợp đồng. KH ký hợp đồng điện tử. Cảnh báo gia hạn. Tra cứu điều khoản giá. |
| **Protocol** | REST + Webhook (trạng thái hợp đồng) |
| **Mock priority** | **P1 — MVP** |
| **Port Interface** | `IContractPort` |

**Port Methods:**
- `getContracts(customerId)` → Danh sách hợp đồng
- `getContractDetail(contractId)` → Chi tiết hợp đồng
- `getContractVersions(contractId)` → Lịch sử phiên bản
- `getContractPDF(contractId)` → Tải PDF hợp đồng
- `signContract(contractId, signatureData)` → Ký số
- `checkRenewalAlerts(customerId)` → Cảnh báo gia hạn

#### S5: Meter Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N2 - Tính năng 2.1 (Vòng đời đồng hồ) |
| **Domain** | Quản lý tài sản đồng hồ |
| **Responsibility** | Sổ kho đồng hồ (serial, nhà sản xuất, DN, cấp chính xác). Lịch sử di chuyển (kho → KH → kiểm định → KH khác). Lịch kiểm định/hiệu chuẩn. Quản lý phiếu kiểm định. Cảnh báo hết hạn. Quản lý chì niêm phong. Báo cáo hao mòn. |
| **BFF gọi khi nào** | KH xem thông tin đồng hồ của mình. Xem lịch sử kiểm định. Xem trạng thái đồng hồ. |
| **Protocol** | REST |
| **Mock priority** | **P1 — MVP** (thông tin cơ bản đồng hồ) |
| **Port Interface** | `IMeterPort` |

**Port Methods:**
- `getMeterByCustomer(customerId)` → Thông tin đồng hồ gắn tại KH
- `getMeterDetail(meterId)` → Chi tiết đồng hồ (serial, loại, DN, cấp chính xác)
- `getMeterHistory(meterId)` → Lịch sử di chuyển
- `getCalibrationStatus(meterId)` → Trạng thái kiểm định

#### S6: Meter Reading Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N2 - Tính năng 2.2 (Ghi chỉ số Mobile App + AI OCR) |
| **Domain** | Ghi chỉ số & lịch sử tiêu thụ |
| **Responsibility** | Lưu trữ chỉ số đồng hồ theo kỳ (tháng). Lịch sử 12+ tháng. Ảnh bằng chứng kèm timestamp + GPS. Cảnh báo bất thường (chỉ số giảm, tăng > 200%). Offline sync. Báo cáo tiến độ ghi chỉ số. |
| **BFF gọi khi nào** | KH xem biểu đồ tiêu thụ. So sánh kỳ trước/sau. Xem chi tiết chỉ số tháng. |
| **Protocol** | REST |
| **Mock priority** | **P0 — Bắt buộc MVP** |
| **Port Interface** | `IMeterReadingPort` |

**Port Methods:**
- `getReadings(customerId, months)` → Lịch sử chỉ số N tháng
- `getReadingDetail(customerId, period)` → Chi tiết 1 kỳ (chỉ số trước, chỉ số sau, sản lượng, ảnh)
- `getConsumptionChart(customerId, period)` → Dữ liệu biểu đồ
- `getComparison(customerId, periodA, periodB)` → So sánh kỳ

#### S7: Smart Meter Service (AMR/AMI)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N2 - Tính năng 2.3 (Tích hợp đồng hồ thông minh) |
| **Domain** | Dữ liệu đồng hồ thông minh thời gian thực |
| **Responsibility** | Kết nối LoRaWAN/NB-IoT/Sigfox. Chuỗi dữ liệu theo giờ. Dashboard giám sát kết nối. Cảnh báo tiêu thụ ban đêm bất thường. Quản lý pin. Đối soát chỉ số tự động. |
| **BFF gọi khi nào** | KH có smart meter → xem tiêu thụ theo giờ/ngày/tuần. Nhận cảnh báo tiêu thụ bất thường. Xem trạng thái kết nối. |
| **Protocol** | REST + WebSocket (real-time data) |
| **Mock priority** | **P2 — Phase 2** (chỉ khi có KH có smart meter) |
| **Port Interface** | `ISmartMeterPort` |

**Port Methods:**
- `getRealtimeData(meterId)` → Dữ liệu tức thời
- `getHourlyData(meterId, date)` → Dữ liệu theo giờ
- `getDailyData(meterId, range)` → Dữ liệu theo ngày
- `getConnectionStatus(meterId)` → Trạng thái kết nối
- `getBatteryStatus(meterId)` → Trạng thái pin

#### S8: Meter Anomaly Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N2 - Tính năng 2.4 (Phát hiện bất thường & gian lận) |
| **Domain** | Phát hiện bất thường đồng hồ |
| **Responsibility** | AI học mô hình tiêu thụ riêng từng KH. Phát hiện đồng hồ dừng. Đối soát chéo DMA. Danh sách KH nghi ngờ. Quy trình xử lý vi phạm. |
| **BFF gọi khi nào** | KH nhận cảnh báo bất thường. Xem trạng thái kiểm tra. (Chủ yếu là inbound notification từ service, không phải KH chủ động gọi) |
| **Protocol** | REST + Webhook (cảnh báo) |
| **Mock priority** | **P3 — Phase 3** |
| **Port Interface** | `IMeterAnomalyPort` |

**Port Methods:**
- `getAnomalyAlerts(customerId)` → Cảnh báo bất thường của KH
- `getAnomalyDetail(alertId)` → Chi tiết cảnh báo
- `reportAnomalyStatus(alertId, status)` → Cập nhật trạng thái

#### S9: Billing / Tariff Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N3 - Tính năng 3.1 (Tariff Engine) |
| **Domain** | Tính cước & biểu giá |
| **Responsibility** | Định nghĩa biểu giá bậc thang (sinh hoạt). Áp dụng phí môi trường, phí thoát nước, VAT. Chính sách giá đặc thù (KCN take-or-pay, khách sạn mùa). Tính hóa đơn batch. Recalculation khi điều chỉnh. Preview hóa đơn. Rule engine UI. |
| **BFF gọi khi nào** | KH xem chi tiết bậc thang giá trong hóa đơn. Mô phỏng hóa đơn. Xem biểu giá áp dụng. |
| **Protocol** | REST |
| **Mock priority** | **P1 — MVP** (bảng giá tĩnh, không cần rule engine UI) |
| **Port Interface** | `ITariffPort` |

**Port Methods:**
- `getTariffPlan(contractId)` → Biểu giá áp dụng cho hợp đồng
- `getTariffBreakdown(invoiceId)` → Chi tiết bậc thang giá trong hóa đơn
- `previewBill(contractId, estimatedUsage)` → Mô phỏng hóa đơn
- `getApplicableFees(contractId)` → Các loại phí kèm theo

#### S10: Invoice Service (Hóa đơn điện tử)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N3 - Tính năng 3.2 (Phát hành HĐĐT đa kênh) |
| **Domain** | Phát hành & phân phối hóa đơn |
| **Responsibility** | Phát hành HĐĐT đúng Nghị định 123/2020 (mã CQT, mã tra cứu, chữ ký số). Tích hợp nhà cung cấp HĐĐT (VNPT/Viettel/FPT/Misa). Đa kênh gửi: App → Zalo → Email → SMS → in giấy. Log trạng thái gửi theo kênh. Gửi nhắc nếu KH chưa mở. Hỗ trợ API/EDI cho KH lớn. |
| **BFF gọi khi nào** | KH xem danh sách hóa đơn, chi tiết hóa đơn, tải PDF. Kiểm tra trạng thái gửi. |
| **Protocol** | REST |
| **Mock priority** | **P0 — Bắt buộc MVP** |
| **Port Interface** | `IInvoicePort` |

**Port Methods:**
- `getList(customerId, filters)` → Danh sách hóa đơn + phân trang
- `getById(invoiceId)` → Chi tiết hóa đơn (khoản mục, bậc thang, tổng tiền)
- `getPDF(invoiceId)` → Tải PDF hóa đơn điện tử (có mã CQT)
- `getInvoiceDeliveryStatus(invoiceId)` → Trạng thái gửi đa kênh
- `getBatchInvoices(customerIds, period)` → Hóa đơn hàng loạt (KH doanh nghiệp)

#### S11: Revenue Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N3 - Tính năng 3.3 (Đối soát doanh thu) |
| **Domain** | Đối soát doanh thu thời gian thực |
| **Responsibility** | Dashboard doanh thu thời gian thực. Đối soát 3 chiều (hóa đơn → doanh thu → tiền thu → công nợ). Phân tích cơ cấu doanh thu. So sánh thực tế vs kế hoạch. Xuất báo cáo. Tích hợp hệ thống kế toán. |
| **BFF gọi khi nào** | ❌ KH không gọi service này — đây là internal dashboard cho nhân viên. BFF không cần mock. |
| **Mock priority** | **Không cần mock** — Internal only |

#### S12: Payment Service (Cổng thanh toán đa kênh)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N4 - Tính năng 4.1 (Cổng thanh toán đa kênh) |
| **Domain** | Thanh toán & giao dịch |
| **Responsibility** | Tích hợp NAPAS (~40 ngân hàng + ví điện tử). VietQR cá nhân hóa. Ủy nhiệm chi tự động (Direct Debit). Thanh toán tại bưu cục VNPost, Payoo/Vimo. POS tại quầy. Mobile App thu hộ tại nhà. Mã hóa đơn duy nhất + IPN realtime. Thanh toán nhiều hóa đơn / một phần. |
| **BFF gọi khi nào** | KH chọn thanh toán → tạo QR/link → chờ webhook xác nhận. Xem lịch sử thanh toán. |
| **Protocol** | REST + Webhook (IPN) |
| **Mock priority** | **P0 — Bắt buộc MVP** |
| **Port Interface** | `IPaymentPort` |

**Port Methods:**
- `createPayment(invoiceId, method)` → Tạo giao dịch, trả về QR/link
- `createBatchPayment(invoiceIds, method)` → Thanh toán nhiều hóa đơn
- `getPaymentStatus(paymentId)` → Trạng thái giao dịch
- `getPaymentHistory(customerId, filters)` → Lịch sử thanh toán
- `setupAutoDebit(customerId, bankAccount)` → Đăng ký ủy nhiệm chi
- `handleWebhook(payload)` → Nhận IPN từ cổng thanh toán
- `getReceipt(paymentId)` → Biên lai điện tử

#### S13: Debt Management Service (Quản lý công nợ)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N4 - Tính năng 4.2 (Công nợ & nhắc nợ) |
| **Domain** | Công nợ & nhắc nợ |
| **Responsibility** | Dashboard công nợ aging (0-30, 31-60, 61-90, >90 ngày). Workflow nhắc nợ nhiều bước (D-3 → D+3 → D+7 → D+15 → D+30). Cá nhân hóa nội dung theo phân khúc. Chọn kênh nhắc theo nhóm KH. Mobile App cho nhân viên đôn đốc. Phân tích KH khó đòi. Tích hợp pháp chế. |
| **BFF gọi khi nào** | KH xem công nợ đang có. Xem lịch sử nhắc nợ. (Nhắc nợ gửi qua Notification Service, KH không gọi trực tiếp) |
| **Protocol** | REST |
| **Mock priority** | **P1 — MVP** (hiển thị công nợ cơ bản) |
| **Port Interface** | `IDebtPort` |

**Port Methods:**
- `getOutstandingDebt(customerId)` → Công nợ hiện tại (số tiền, kỳ, aging)
- `getDebtHistory(customerId)` → Lịch sử công nợ
- `getDebtSchedule(customerId)` → Lịch nhắc nợ

#### S14: Water Cut-off Service (Cắt nước & mở lại)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N4 - Tính năng 4.3 (Cắt nước tự động) |
| **Domain** | Quy trình cắt nước |
| **Responsibility** | Danh sách đề xuất cắt nước tự động. Phê duyệt nhiều cấp. Tạo Work Order cắt nước. Loại trừ pháp lý (bệnh viện, trường học, hộ nghèo). Cảnh báo 24h trước khi cắt. Tự sinh Work Order mở nước sau thanh toán. Log đầy đủ. |
| **BFF gọi khi nào** | KH xem trạng thái cắt nước. Nhận cảnh báo sắp cắt. Nhận thông báo mở lại nước. Xem lịch sử cắt nước. |
| **Protocol** | REST + Webhook |
| **Mock priority** | **P2 — Phase 2** |
| **Port Interface** | `IWaterCutoffPort` |

**Port Methods:**
- `getCutoffStatus(customerId)` → Trạng thái cắt nước
- `getCutoffHistory(customerId)` → Lịch sử cắt nước
- `getCutoffSchedule(customerId)` → Lịch cắt nước dự kiến

#### S15: Call Center Service (Tổng đài 1900.545.520)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N5 - Tính năng 5.1 (Tổng đài tích hợp) |
| **Domain** | Tổng đài & Call Center |
| **Responsibility** | IVR thông minh đa nhánh. Định tuyến theo địa bàn. Pop-up CRM tự động. Click-to-call ngược lại. Ghi âm 100%. KPI Dashboard. Phân ca dựa trên AI. CSAT SMS sau cuộc gọi. |
| **BFF gọi khi nào** | KH bấm "Gọi tổng đài viên" trong App → BFF gọi Click-to-call. KH không gọi trực tiếp API tổng đài. |
| **Protocol** | REST (click-to-call API) |
| **Mock priority** | **P2 — Phase 2** |
| **Port Interface** | `ICallCenterPort` |

**Port Methods:**
- `requestCallback(customerId, phone)` → Yêu cầu gọi lại (click-to-call)
- `getCallbackStatus(requestId)` → Trạng thái yêu cầu gọi lại

#### S16: Ticketing / SLA Service (Quản lý yêu cầu dịch vụ)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N5 - Tính năng 5.2 (Quản lý yêu cầu dịch vụ & khiếu nại) |
| **Domain** | Ticketing & SLA |
| **Responsibility** | Phân loại ticket (báo rò rỉ, khiếu nại HĐ, đăng ký mới…). Mức ưu tiên (P0-P3). SLA cấu hình theo loại. Workflow tự động (tiếp nhận → phân tích → giao đội → xử lý → xác nhận → đóng). Cảnh báo SLA. Tracking tiến độ (như Grab/Shopee). Khảo sát hài lòng khi đóng. Auto-reopen nếu < 3/5 sao. |
| **BFF gọi khi nào** | KH báo sự cố. KH tra cứu tiến độ ticket. KH gửi feedback khi đóng ticket. **Đây là một trong những service quan trọng nhất cho customer portal.** |
| **Protocol** | REST + Webhook (trạng thái ticket) |
| **Mock priority** | **P0 — Bắt buộc MVP** |
| **Port Interface** | `ITicketPort` |

**Port Methods:**
- `createTicket(type, description, images, customerId, priority)` → Tạo ticket, trả về tracking ID
- `getTicketStatus(ticketId)` → Trạng thái + timeline + ETA
- `getTicketHistory(customerId, filters)` → Lịch sử ticket
- `addComment(ticketId, comment, isCustomer)` → Thêm bình luận
- `submitFeedback(ticketId, score, comment)` → Gửi CSAT khi đóng ticket
- `handleWebhook(payload)` → Nhận cập nhật trạng thái từ Ticketing Service
- `getServiceTypes()` → Danh sách loại dịch vụ có thể yêu cầu

#### S17: Feedback / Survey Service (CSAT, NPS, CES)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N5 - Tính năng 5.3 (Đo lường hài lòng KH) |
| **Domain** | Khảo sát & đo lường hài lòng |
| **Responsibility** | CSAT sau mỗi tương tác (cuộc gọi, ticket, sửa chữa). NPS định kỳ 6 tháng. CES cho quy trình quan trọng. Đa kênh gửi khảo sát. Dashboard theo thời gian/touchpoint/địa bàn/nhân viên. Closing the loop (gọi lại nếu < 3/5). |
| **BFF gọi khi nào** | KH nhận khảo sát CSAT/NPS/CES. KH gửi đánh giá. Xem lịch sử đánh giá. |
| **Protocol** | REST |
| **Mock priority** | **P2 — Phase 2** |
| **Port Interface** | `IFeedbackPort` |

**Port Methods:**
- `getSurvey(surveyType, referenceId)` → Lấy form khảo sát
- `submitSurvey(surveyId, responses)` → Gửi đánh giá
- `getSurveyHistory(customerId)` → Lịch sử đánh giá

#### S18: Knowledge Base Service (FAQ & Hướng dẫn)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N5 - Tính năng 5.4 (Knowledge Base & FAQ) |
| **Domain** | Kho tri thức & tự phục vụ |
| **Responsibility** | Bài viết FAQ theo chủ đề. Tìm kiếm tiếng Việt thông minh (dấu thanh, từ đồng nghĩa). Quy trình quản lý nội dung (tác giả → biên tập → phê duyệt → xuất bản). Versioning. Đánh giá hữu ích. Nguồn nội dung cho Chatbot. |
| **BFF gọi khi nào** | KH tìm kiếm FAQ. KH xem bài viết hướng dẫn. KH đánh giá hữu ích/không hữu ích. |
| **Protocol** | REST |
| **Mock priority** | **P1 — MVP** (danh sách bài viết tĩnh) |
| **Port Interface** | `IKnowledgeBasePort` |

**Port Methods:**
- `searchArticles(query)` → Tìm kiếm bài viết
- `getArticle(articleId)` → Chi tiết bài viết
- `getArticlesByCategory(category)` → Bài viết theo chủ đề
- `rateArticle(articleId, helpful)` → Đánh giá hữu ích
- `getCategories()` → Danh mục chủ đề

#### S19: Onboarding Service (Đăng ký lắp đặt mới)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N6 - Tính năng 6.1 (Đăng ký lắp đặt mới online) |
| **Domain** | Phát triển khách hàng mới |
| **Responsibility** | Form đăng ký online thông minh. Upload giấy tờ (CCCD, giấy nhà đất) + AI OCR. Kiểm tra vùng phủ (GIS). Báo giá tự động. Workflow phê duyệt liên phòng. Đặt lịch khảo sát. Thanh toán phí lắp đặt. Ký hợp đồng điện tử. |
| **BFF gọi khi nào** | KH điền form đăng ký. KH upload giấy tờ. KH xem tiến độ đăng ký. KH nhận báo giá. |
| **Protocol** | REST + Webhook (trạng thái đăng ký) |
| **Mock priority** | **P2 — Phase 2** |
| **Port Interface** | `IOnboardingPort` |

**Port Methods:**
- `submitApplication(applicationData)` → Nộp đơn đăng ký
- `uploadDocument(applicationId, docType, file)` → Upload giấy tờ
- `getApplicationStatus(applicationId)` → Trạng thái đơn + workflow progress
- `getQuote(applicationId)` → Báo giá lắp đặt
- `scheduleSurvey(applicationId, timeSlot)` → Đặt lịch khảo sát
- `payInstallationFee(applicationId, paymentMethod)` → Thanh toán phí

#### S20: Site Survey Service (Khảo sát & nghiệm thu số)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N6 - Tính năng 6.2 (Khảo sát hiện trường & nghiệm thu) |
| **Domain** | Khảo sát & nghiệm thu |
| **Responsibility** | Checklist khảo sát chuẩn theo loại. Chụp ảnh bắt buộc. Đo đạc AR/thước số. Quét barcode/QR serial đồng hồ. Ký số tại chỗ. Đồng bộ tự động. Lưu trữ immutable. |
| **BFF gọi khi nào** | KH xem kết quả khảo sát. KH ký biên bản nghiệm thu. Xem ảnh khảo sát. |
| **Protocol** | REST |
| **Mock priority** | **P2 — Phase 2** |
| **Port Interface** | `ISiteSurveyPort` |

**Port Methods:**
- `getSurveyResult(applicationId)` → Kết quả khảo sát
- `getSurveyPhotos(applicationId)` → Ảnh khảo sát
- `signAcceptance(applicationId, signatureData)` → Ký biên bản nghiệm thu

#### S21: Campaign / Marketing Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N8 - Tính năng 8.1 (Quản lý chiến dịch truyền thông) |
| **Domain** | Marketing & chiến dịch |
| **Responsibility** | Campaign builder (chọn phân khúc, kênh, nội dung). A/B testing. Lịch chiến dịch. Đa kênh (push, Zalo, SMS, email, in trên hóa đơn). Báo cáo hiệu quả (delivery, open, click, conversion). Anti-spam (max N tin/tháng). |
| **BFF gọi khi nào** | KH xem ưu đãi/chương trình. KH opt-in/out nhận marketing. KH xem thông điệp marketing trong inbox. |
| **Protocol** | REST |
| **Mock priority** | **P3 — Phase 3** |
| **Port Interface** | `ICampaignPort` |

**Port Methods:**
- `getActiveCampaigns(customerId)` → Chiến dịch đang hoạt động cho KH
- `getCampaignDetail(campaignId)` → Chi tiết chiến dịch
- `updateMarketingPreference(customerId, preferences)` → Opt-in/out
- `getMarketingMessages(customerId)` → Thông điệp đã nhận

#### S22: Proactive Communication Service (Thông báo chủ động)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N8 - Tính năng 8.2 (Thông báo chủ động đa kênh) |
| **Domain** | Thông báo sự cố & bảo dưỡng |
| **Responsibility** | Khoanh vùng KH ảnh hưởng trên GIS (chọn đoạn ống → tự tính KH). Thông điệp cá nhân hóa với biến. Gửi đa kênh đồng thời (push, SMS, Zalo, voice broadcast). Cập nhật khi tình hình thay đổi. Báo "đã có nước trở lại". Lưu vào Customer 360. Tích hợp MXH (Fanpage). |
| **BFF gọi khi nào** | KH xem thông báo sự cố khu vực mình. KH xem lịch sử thông báo. Nhận push notification. |
| **Protocol** | REST + WebSocket/SSE (real-time) |
| **Mock priority** | **P1 — MVP** (thông báo cơ bản), **P2** (GIS area-based) |
| **Port Interface** | `IProactiveNotificationPort` |

**Port Methods:**
- `getActiveAlerts(customerId)` → Thông báo đang hoạt động ảnh hưởng KH
- `getAlertHistory(customerId, filters)` → Lịch sử thông báo
- `getMaintenanceSchedule(customerId)` → Lịch bảo dưỡng sắp tới
- `acknowledgeAlert(alertId, customerId)` → Xác nhận đã xem

#### S23: Reporting Service (Báo cáo cho customer-facing)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N9 - Tính năng 9.1 (Dashboard kinh doanh) — phần customer-facing |
| **Domain** | Báo cáo & phân tích |
| **Responsibility** | Tầng KH: báo cáo tiêu thụ cá nhân, so sánh cùng kỳ, so sánh khu vực, gợi ý tiết kiệm nước. Xuất PDF/Excel. Báo cáo định kỳ. |
| **BFF gọi khi nào** | KH xem báo cáo tiêu thụ. KH tải báo cáo. Xem so sánh. |
| **Protocol** | REST |
| **Mock priority** | **P2 — Phase 2** |
| **Port Interface** | `IReportingPort` |

**Port Methods:**
- `getConsumptionReport(customerId, period)` → Báo cáo tiêu thụ
- `getComparisonReport(customerId, type)` → So sánh (kỳ trước, cùng kỳ, khu vực)
- `getSavingsTips(customerId)` → Gợi ý tiết kiệm nước
- `downloadReport(customerId, period, format)` → Tải báo cáo (PDF/Excel)

#### S24: AI Chatbot Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N10 - Tính năng 10.1 (AI Chatbot & Voicebot) |
| **Domain** | AI giao tiếp KH |
| **Responsibility** | Intent classification (tra cứu HĐ, báo sự cố, hỏi biểu giá, hẹn lắp đặt). Chatbot tiếng Việt (có dấu/không dấu, viết tắt, slang địa phương). Voicebot trên Hotline. Truy vấn data thực sau khi xác thực KH. Handoff sang tổng đài viên kèm context. Học từ phản hồi. |
| **BFF gọi khi nào** | KH chat trong App/Web/Zalo → BFF proxy sang Chatbot Service. KH hỏi FAQ → Chatbot trả lời. KH yêu cầu service → Chatbot tạo ticket. |
| **Protocol** | REST + WebSocket (chat streaming) |
| **Mock priority** | **P2 — Phase 2** (chat cơ bản), **P3** (voicebot) |
| **Port Interface** | `IChatbotPort` |

**Port Methods:**
- `sendMessage(sessionId, message, customerId)` → Gửi tin nhắn, nhận response
- `createSession(customerId, channel)` → Tạo phiên chat
- `getSessionHistory(sessionId)` → Lịch sử chat
- `submitFeedback(messageId, helpful)` → Đánh giá câu trả lời
- `handoffToAgent(sessionId)` → Chuyển sang tổng đài viên

#### S25: AI Leakage Alert Service (Cảnh báo rò rỉ nội bộ)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N10 - Tính năng 10.4 (AI cảnh báo rò rỉ) |
| **Domain** | AI phát hiện rò rỉ |
| **Responsibility** | AI học mô hình tiêu thụ riêng từng KH (6-12 tháng). Phát hiện rò rỉ ngầm, rò chậm, vòi rò. Yêu cầu Smart Meter cho độ chính xác cao. Thông báo cho KH. Gợi ý dịch vụ kiểm tra. Theo dõi kết quả. |
| **BFF gọi khi nào** | KH nhận cảnh báo rò rỉ. Xem chi tiết cảnh báo. Đặt lịch kiểm tra. Xem kết quả kiểm tra. |
| **Protocol** | REST + Webhook (cảnh báo) |
| **Mock priority** | **P3 — Phase 3** |
| **Port Interface** | `ILeakageAlertPort` |

**Port Methods:**
- `getLeakageAlerts(customerId)` → Cảnh báo rò rỉ
- `getLeakageDetail(alertId)` → Chi tiết cảnh báo + phân tích AI
- `scheduleInspection(alertId, timeSlot)` → Đặt lịch kiểm tra
- `getInspectionResult(alertId)` → Kết quả kiểm tra

#### S26: AI Fraud Detection Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N10 - Tính năng 10.5 (AI phát hiện gian lận) |
| **Domain** | AI chống gian lận |
| **Responsibility** | Đối soát 3 lớp DMA. Phát hiện pattern bất thường. Phân tích ảnh đồng hồ AI. So sánh cụm KH. Tự động lập đề xuất kiểm tra. Quy trình xử lý vi phạm. |
| **BFF gọi khi nào** | ❌ KH không gọi service này — đây là internal. KH chỉ nhận kết quả (truy thu) qua Invoice Service. BFF không cần mock riêng. |
| **Mock priority** | **Không cần mock riêng** — Kết quả đi qua Invoice/Ticketing Service |

#### S27: AI Forecast Service (Dự báo doanh thu)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N10 - Tính năng 10.2 (Dự báo doanh thu/dòng tiền) |
| **Domain** | AI dự báo |
| **Responsibility** | Mô hình time-series (LSTM/Prophet). Dự báo theo phân khúc. Yếu tố mùa vụ, lễ, thời tiết. Dự báo công nợ. MAPE < 5%. Báo cáo ngôn ngữ tự nhiên. |
| **BFF gọi khi nào** | ❌ Internal only — KH không thấy dự báo. BFF không cần mock. |
| **Mock priority** | **Không cần mock** |

#### S28: AI Churn Prediction Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N10 - Tính năng 10.3 (Dự báo KH rời bỏ) |
| **Domain** | AI dự báo churn |
| **Responsibility** | ML model phát hiện tín hiệu churn. Churn score 0-100. Đề xuất hành động. Theo dõi hiệu quả. Phân tích nguyên nhân. |
| **BFF gọi khi nào** | ❌ Internal only — KH không thấy churn score. BFF không cần mock. |
| **Mock priority** | **Không cần mock** |

#### S29: AI Agent Assist Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N10 - Tính năng 10.6 (AI tổng đài viên ảo) |
| **Domain** | AI hỗ trợ tổng đài viên |
| **Responsibility** | Speech-to-text realtime. AI gợi ý trả lời. Tự tra cứu hồ sơ KH. Tóm tắt cuộc gọi. Phát hiện cảm xúc. Dự báo lưu lượng cuộc gọi. Phân tích cuộc gọi. |
| **BFF gọi khi nào** | ❌ Internal only — Hỗ trợ tổng đài viên, KH không tương tác. BFF không cần mock. |
| **Mock priority** | **Không cần mock** |

#### S30: GIS Service (Phòng Tuyến mạng)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | Cross-cutting — Liên kết phân hệ |
| **Domain** | Bản đồ GIS & địa lý |
| **Responsibility** | Mỗi đồng hồ KH là điểm trên bản đồ. Khoanh vùng KH ảnh hưởng sự cố. Chỉ số DMA đối soát. Kiểm tra vùng phủ đường ống. |
| **BFF gọi khi nào** | KH kiểm tra vùng phủ (onboarding). KH xem vị trí sự cố khu vực. KH xem bản đồ điểm đấu nối. |
| **Protocol** | REST |
| **Mock priority** | **P2 — Phase 2** (vùng phủ cơ bản MVP) |
| **Port Interface** | `IGISPort` |

**Port Methods:**
- `checkCoverage(address)` → Kiểm tra vùng phủ
- `getNearbyIncidents(location)` → Sự cố gần KH
- `getCustomerLocation(customerId)` → Vị trí đấu nối KH

#### S31: Field Team Tracking Service (Mobile App đội hiện trường)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | Cross-cutting — Liên kết phân hệ |
| **Domain** | Theo dõi đội hiện trường |
| **Responsibility** | Nhận Work Order. Cập nhật trạng thái (đang di chuyển → đến nơi → đang xử lý → xong). GPS tracking. ETA cho KH. |
| **BFF gọi khi nào** | KH xem tiến độ ticket (ETA đội đang đến). Xem vị trí đội trên bản đồ (như Grab). |
| **Protocol** | REST + WebSocket (real-time tracking) |
| **Mock priority** | **P2 — Phase 2** |
| **Port Interface** | `IFieldTeamPort` |

**Port Methods:**
- `getTeamETA(ticketId)` → ETA đội đang đến
- `getTeamLocation(ticketId)` → Vị trí hiện tại của đội
- `getWorkOrderStatus(ticketId)` → Trạng thái Work Order

#### S32: Notification Service (Đa kênh)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | Cross-cutting — Hạ tầng truyền thông |
| **Domain** | Thông báo đa kênh |
| **Responsibility** | Push notification (FCM/APNs). Zalo OA message. SMS. Email. Voice broadcast. Rate limiting (max 2 msg ZNS/KH/ticket/ngày). Batching. Priority queue. Channel routing. Template management. |
| **BFF gọi khi nào** | Mọi notification gửi KH. Dispatch qua `DispatchNotificationCommand`. Rate limiting. Kiểm tra preference KH. |
| **Protocol** | REST + Webhook (delivery status) |
| **Mock priority** | **P0 — Bắt buộc MVP** (push + Zalo cơ bản) |
| **Port Interface** | `INotificationPort` |

**Port Methods:**
- `dispatchNotification(command)` → Gửi thông báo (channel, template, recipient, data)
- `getNotificationHistory(customerId)` → Lịch sử thông báo
- `getNotificationPreferences(customerId)` → Preference kênh
- `updateNotificationPreferences(customerId, preferences)` → Cập nhật preference
- `getDeliveryStatus(notificationId)` → Trạng thái gửi

#### S33: eContract Service (Ký số)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | N1 - Tính năng 1.3 (phần ký số), N6 - Tính năng 6.2 (nghiệm thu) |
| **Domain** | Chữ ký số & eContract |
| **Responsibility** | Tích hợp VNPT CA/Viettel CA/FPT CA. KH ký từ xa qua My Công ty App. Xác thực OTP hoặc sinh trắc học. Lưu trữ hash chống sửa đổi. |
| **BFF gọi khi nào** | KH ký hợp đồng. KH ký biên bản nghiệm thu. Xác thực chữ ký. |
| **Protocol** | REST |
| **Mock priority** | **P2 — Phase 2** |
| **Port Interface** | `IeContractPort` |

**Port Methods:**
- `initiateSigning(contractId, signerInfo)` → Khởi tạo phiên ký
- `verifySignature(contractId)` → Xác thực chữ ký
- `getSigningStatus(contractId)` → Trạng thái ký

#### S34: Document / Storage Service

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | Cross-cutting — Hạ tầng |
| **Domain** | Quản lý tài liệu & file |
| **Responsibility** | Upload ảnh (sự cố, giấy tờ, bằng chứng). Tạo URL presigned. Thumbnail generation. Immutable storage cho pháp lý. TTL cho file tạm. |
| **BFF gọi khi nào** | KH upload ảnh sự cố. KH upload giấy tờ (onboarding). KH xem/tải tài liệu. |
| **Protocol** | REST + S3-compatible |
| **Mock priority** | **P0 — Bắt buộc MVP** (upload ảnh sự cố) |
| **Port Interface** | `IDocumentPort` |

**Port Methods:**
- `getUploadUrl(fileType, metadata)` → Lấy presigned URL để upload
- `getDownloadUrl(fileId)` → Lấy URL download
- `deleteFile(fileId)` → Xóa file
- `getFileInfo(fileId)` → Thông tin file

#### S35: Water Quality Service (Phòng Môi trường)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | Cross-cutting — Liên kết phân hệ |
| **Domain** | Chất lượng nước |
| **Responsibility** | Dữ liệu chất lượng tại điểm gần nhất. Cảnh báo chất lượng. Liên kết khiếu nại KH với dữ liệu chất lượng. |
| **BFF gọi khi nào** | KH xem chất lượng nước khu vực. KH khiếu nại chất lượng → auto-link. |
| **Protocol** | REST |
| **Mock priority** | **P3 — Phase 3** |
| **Port Interface** | `IWaterQualityPort` |

**Port Methods:**
- `getQualityAtLocation(location)` → Chất lượng nước tại vị trí
- `getQualityAlerts(customerId)` → Cảnh báo chất lượng

#### S36: SCADA Service (Phòng Kỹ thuật)

| Thuộc tính | Chi tiết |
|---|---|
| **Nhóm Mota_Tinh_Nang** | Cross-cutting — Liên kết phân hệ |
| **Domain** | Giám sát vận hành |
| **Responsibility** | Dữ liệu sản lượng + chất lượng từ nhà máy + trạm bơm. Cảnh báo sự cố real-time. Tín hiệu nhu cầu phụ tải. |
| **BFF gọi khi nào** | KH xem thông tin mất nước khu vực. KH xem trạng thái hệ thống. (Chủ yếu data đi qua Proactive Communication Service) |
| **Protocol** | REST (thường data đi qua Proactive Communication Service, KH không gọi trực tiếp SCADA) |
| **Mock priority** | **Không cần mock riêng** — Data đi qua Proactive Communication Service |

---

## Tổng hợp: Bảng All Downstream Services cần Mock

### Services cần Mock theo Priority

#### P0 — Bắt buộc MVP (8 services)

| # | Service ID | Service Name | Port Interface | Phase |
|---|---|---|---|---|
| 1 | S1 | Customer Identity & Auth Service | `IAuthPort` | MVP |
| 2 | S2 | Customer Profile Service | `ICustomerProfilePort` | MVP |
| 3 | S6 | Meter Reading Service | `IMeterReadingPort` | MVP |
| 4 | S10 | Invoice Service (HĐĐT) | `IInvoicePort` | MVP |
| 5 | S12 | Payment Service (Cổng thanh toán) | `IPaymentPort` | MVP |
| 6 | S16 | Ticketing / SLA Service | `ITicketPort` | MVP |
| 7 | S32 | Notification Service (Đa kênh) | `INotificationPort` | MVP |
| 8 | S34 | Document / Storage Service | `IDocumentPort` | MVP |

#### P1 — MVP mở rộng (5 services)

| # | Service ID | Service Name | Port Interface | Phase |
|---|---|---|---|---|
| 9 | S4 | Contract Service | `IContractPort` | MVP |
| 10 | S5 | Meter Service | `IMeterPort` | MVP |
| 11 | S9 | Billing / Tariff Service | `ITariffPort` | MVP |
| 12 | S13 | Debt Management Service | `IDebtPort` | MVP |
| 13 | S18 | Knowledge Base Service | `IKnowledgeBasePort` | MVP |
| 14 | S22 | Proactive Communication Service | `IProactiveNotificationPort` | MVP |

#### P2 — Phase 2 (9 services)

| # | Service ID | Service Name | Port Interface | Phase |
|---|---|---|---|---|
| 15 | S3 | Customer Segmentation Service | `ISegmentationPort` | Phase 2 |
| 16 | S7 | Smart Meter Service (AMR/AMI) | `ISmartMeterPort` | Phase 2 |
| 17 | S14 | Water Cut-off Service | `IWaterCutoffPort` | Phase 2 |
| 18 | S15 | Call Center Service | `ICallCenterPort` | Phase 2 |
| 19 | S17 | Feedback / Survey Service | `IFeedbackPort` | Phase 2 |
| 20 | S19 | Onboarding Service | `IOnboardingPort` | Phase 2 |
| 21 | S20 | Site Survey Service | `ISiteSurveyPort` | Phase 2 |
| 22 | S23 | Reporting Service | `IReportingPort` | Phase 2 |
| 23 | S24 | AI Chatbot Service | `IChatbotPort` | Phase 2 |
| 24 | S30 | GIS Service | `IGISPort` | Phase 2 |
| 25 | S31 | Field Team Tracking Service | `IFieldTeamPort` | Phase 2 |
| 26 | S33 | eContract Service | `IeContractPort` | Phase 2 |

#### P3 — Phase 3 (3 services)

| # | Service ID | Service Name | Port Interface | Phase |
|---|---|---|---|---|
| 27 | S8 | Meter Anomaly Service | `IMeterAnomalyPort` | Phase 3 |
| 28 | S21 | Campaign / Marketing Service | `ICampaignPort` | Phase 3 |
| 29 | S25 | AI Leakage Alert Service | `ILeakageAlertPort` | Phase 3 |
| 30 | S35 | Water Quality Service | `IWaterQualityPort` | Phase 3 |

#### Không cần Mock (6 services — Internal only)

| # | Service ID | Service Name | Lý do không mock |
|---|---|---|---|
| — | S11 | Revenue Service | Internal dashboard — KH không gọi |
| — | S26 | AI Fraud Detection Service | Internal — kết quả đi qua Invoice/Ticketing |
| — | S27 | AI Forecast Service | Internal — KH không thấy dự báo |
| — | S28 | AI Churn Prediction Service | Internal — KH không thấy churn score |
| — | S29 | AI Agent Assist Service | Internal — hỗ trợ tổng đài viên |
| — | S36 | SCADA Service | Data đi qua Proactive Communication Service |

### Tổng kết Mock Strategy

| Phase | Số services cần mock | Tổng Port Interfaces |
|---|---|---|
| **MVP (P0 + P1)** | **14 services** | **14 Port Interfaces** |
| **Phase 2 (P2)** | **+12 services** | **+12 Port Interfaces** |
| **Phase 3 (P3)** | **+4 services** | **+4 Port Interfaces** |
| **Không mock** | 6 services | — |
| **Tổng cộng** | **30 services** | **30 Port Interfaces** |

---

## Target Users

### Primary Users (End-user Customers)

#### Persona 1: Khách hàng sinh hoạt — "Cô Nguyễn"

- **Vai trò:** Người dân sử dụng dịch vụ cấp nước sinh hoạt
- **Công cụ:** Mobile App, Zalo OA
- **Hành vi:** Tra cứu hóa đơn hàng tháng, thanh toán online, báo sự cố (mất nước, rò rỉ), xem tiêu thụ. Không rành công nghệ.
- **Vấn đề hiện tại:** Phải đến trực tiếp quầy giao dịch hoặc gọi Hotline chờ đợi lâu, không biết tiến độ xử lý sự cố.
- **Trải nghiệm mới:** Mở App → xem hóa đơn → thanh toán QR → nhận thông báo kết quả. Báo sự cố qua Zalo → nhận tracking ID → nhận notification khi xử lý xong.
- **"Aha!" moment:** Thanh toán hóa đơn trong 30 giây thay vì phải đến quầy xếp hàng.

#### Persona 2: Khách hàng công nghệ — "Anh Tuấn"

- **Vai trò:** Người dân 35 tuổi, sử dụng thành thạo smartphone
- **Công cụ:** Mobile App (chính), Web Portal, Zalo OA
- **Hành vi:** Theo dõi biểu đồ tiêu thụ nước hàng tháng, so sánh kỳ trước, nhận thông báo hóa đơn mới, thanh toán online, báo sự cố kèm ảnh.
- **Vấn đề hiện tại:** Không có kênh digital chính thức, phải gọi điện hoặc đến quầy.
- **Trải nghiệm mới:** Push notification hóa đơn mới → mở App xem chi tiết → thanh toán → nhận biên lai điện tử. Xem biểu đồ tiêu thụ + so sánh.
- **"Aha!" moment:** Nhận push notification "Hóa đơn tháng 6: 150.000đ" và thanh toán luôn trong 2 thao tác.

#### Persona 3: Khách hàng doanh nghiệp — "KCN Cẩm Phả"

- **Vai trò:** Tổ chức có hợp đồng đặc thù, sản lượng lớn
- **Công cụ:** Web Portal (chính), Mobile App
- **Hành vi:** Tra cứu hóa đơn hàng loạt, xem chi tiết chỉ số đồng hồ, báo sự cố ưu tiên, liên hệ qua kênh riêng.
- **Đặc thù:** Cần tra cứu nhiều hợp đồng, xem báo cáo tiêu thụ tổng hợp, thanh toán tập trung.

#### Persona 4: Khách hàng cao tuổi — "Bà Lan"

- **Vai trò:** Người dân > 65 tuổi, hạn chế sử dụng smartphone
- **Công cụ:** Mobile App (phiên bản senior), Zalo OA, gọi Hotline
- **Hành vi:** Xem hóa đơn (font lớn), gọi tổng đài viên từ App (click-to-call), nhận SMS thông báo.
- **Đặc thụ:** Giao diện đơn giản, font lớn, nút "Gọi tổng đài viên" lớn rõ ràng. Phiên bản App dành riêng cho người cao tuổi.

---

## Success Criteria

### Customer Success

| # | Criteria | Cách đo | 6 tháng | 12 tháng | 24 tháng |
|---|----------|---------|---------|----------|----------|
| CS-1 | Thời gian KH thanh toán hóa đơn (từ mở App → hoàn tất) | End-to-end measurement | < 60 giây | < 30 giây | < 20 giây |
| CS-2 | KH không phải kể lại thông tin khi đổi kênh | KH survey "không phải nhắc lại" | 70% | 90% | 95% |
| CS-3 | Tỷ lệ KH sử dụng kênh digital (App/Web/Zalo) thay vì đến quầy | Digital adoption rate | 20% | 40% | 60% |
| CS-4 | KH hài lòng ≥ 4/5 sao sau tương tác | CSAT score | 60% | 75% | 80% |
| CS-5 | Tỷ lệ sự cố KH tự tra cứu được tiến độ (không cần gọi) | Self-service rate | 30% | 50% | 70% |
| CS-6 | Tỷ lệ KH dùng My Công ty App | App adoption rate | 20% | 40% | 70% |
| CS-7 | Tỷ lệ onboarding KH mới hoàn toàn online | Online onboarding rate | 20% | 50% | 70% |

### Business Success

| # | Metric | 6 tháng | 12 tháng | 24 tháng |
|---|--------|---------|----------|----------|
| BS-1 | Giảm traffic quầy giao dịch | -15% | -30% | -50% |
| BS-2 | Giảm gọi nhỡ Hotline (KH tự giải quyết qua App) | -10% | -25% | -40% |
| BS-3 | Tỷ lệ thanh toán online | 15% | 30% | 50% |
| BS-4 | Giảm thời gian xử lý sự cố (do KH báo nhanh hơn qua App) | -10% | -20% | -30% |
| BS-5 | Tỷ lệ thu cước đúng hạn | +5% | +15% | +25% |
| BS-6 | Giảm chi phí phát hành hóa đơn (in + phát) | -30% | -70% | -100% |
| BS-7 | Rút ngắn thời gian onboarding KH mới (15-30 ngày → ) | 10 ngày | 7 ngày | 3 ngày |

### Technical Success

| # | Metric | Mục tiêu |
|---|--------|----------|
| TS-1 | BFF response time (không tính downstream latency) | < 200ms |
| TS-2 | Customer Auth latency (login → token ready) | < 500ms |
| TS-3 | Multi-channel uptime (App + Web + Zalo) | 99.5%+ |
| TS-4 | Adapter swappability — đổi downstream service | < 1 ngày, chỉ đổi Adapter |
| TS-5 | Cross-channel context preservation rate | 95%+ |
| TS-6 | Graceful degradation — KH luôn nhận response | 0% total outage |

---

## Product Scope

### MVP Definition (Phase 1)

**Mục tiêu MVP:** Chứng minh kiến trúc BFF hoạt động — KH tra cứu hóa đơn, thanh toán, báo sự cố qua App/Web/Zalo. Đặc biệt **Context Preservation** (KH chuyển kênh giữa chừng không mất ngữ cảnh).

**MVP phải có ít nhất 2 kênh** để demo Context Preservation.

### MVP Core Features

| # | Feature | Chi tiết | Downstream Services (ID) |
|---|---------|----------|------------------------|
| M1 | **Customer Auth** | Đăng nhập KH qua SĐT/OTP, Zalo ID, Social. Liên kết tài khoản với Mã KH. BFF owns User/Token DB. | S1: Identity & Auth Service |
| M2 | **Customer Profile** | Xem hồ sơ KH 360°, thông tin định danh, timeline tương tác. | S2: Customer Profile Service |
| M3 | **Contract Lookup** | Xem thông tin hợp đồng, điều khoản, trạng thái, lịch sử phiên bản. | S4: Contract Service |
| M4 | **Meter Info** | Xem thông tin đồng hồ, trạng thái kiểm định. | S5: Meter Service |
| M5 | **Consumption History** | Xem biểu đồ tiêu thụ, so sánh kỳ, chi tiết chỉ số. | S6: Meter Reading Service |
| M6 | **Tariff Display** | Xem biểu giá áp dụng, bậc thang giá, chi tiết tính cước. | S9: Billing/Tariff Service |
| M7 | **Invoice Lookup** | Xem danh sách hóa đơn, chi tiết, tải PDF HĐĐT. | S10: Invoice Service |
| M8 | **Payment** | Thanh toán QR/link, lịch sử, nhận webhook xác nhận. | S12: Payment Service |
| M9 | **Debt Overview** | Xem công nợ, kỳ nợ, aging. | S13: Debt Management Service |
| M10 | **Incident Submission** | Form KH điền + gửi ảnh → push data sang Ticketing → nhận tracking ID. | S16: Ticketing/SLA Service, S34: Document Service |
| M11 | **Ticket Tracking** | Tra cứu tiến độ ticket, timeline, ETA. | S16: Ticketing/SLA Service |
| M12 | **FAQ & Knowledge Base** | Tìm kiếm FAQ, xem bài hướng dẫn. | S18: Knowledge Base Service |
| M13 | **Proactive Alerts** | Nhận thông báo sự cố khu vực, bảo dưỡng, mất nước. | S22: Proactive Communication Service |
| M14 | **Notifications** | Push/Zalo notification: hóa đơn mới, thanh toán thành công, sự cố cập nhật. Rate limiting. | S32: Notification Service |
| M15 | **Context Preservation** | Redis session store. KH chat Zalo sáng → mở Web chiều → history intact. | Internal (Redis) |
| M16 | **File Upload** | Upload ảnh sự cố, giấy tờ. Presigned URL. | S34: Document Service |
| M17 | **Hexagonal Adapter Layer** | 14 Port interfaces + Mock Adapters cho MVP services. | Infrastructure |

### Ports & Adapters (MVP — 14 Port Interfaces)

| # | Port Interface | Purpose | Service ID | Mock Adapter (MVP) |
|---|---|---|---|---|
| 1 | `IAuthPort` | Xác thực KH, OTP, token | S1 | `MockAuthAdapter` |
| 2 | `ICustomerProfilePort` | Hồ sơ KH 360°, timeline | S2 | `MockCustomerProfileAdapter` |
| 3 | `IContractPort` | Hợp đồng, điều khoản, eContract | S4 | `MockContractAdapter` |
| 4 | `IMeterPort` | Thông tin đồng hồ | S5 | `MockMeterAdapter` |
| 5 | `IMeterReadingPort` | Chỉ số, biểu đồ tiêu thụ | S6 | `MockMeterReadingAdapter` |
| 6 | `ITariffPort` | Biểu giá, bậc thang | S9 | `MockTariffAdapter` |
| 7 | `IInvoicePort` | Hóa đơn, PDF, HĐĐT | S10 | `MockInvoiceAdapter` |
| 8 | `IPaymentPort` | Thanh toán, QR, webhook | S12 | `MockPaymentAdapter` |
| 9 | `IDebtPort` | Công nợ, aging | S13 | `MockDebtAdapter` |
| 10 | `ITicketPort` | Sự cố, ticket, SLA | S16 | `MockTicketAdapter` |
| 11 | `IKnowledgeBasePort` | FAQ, bài viết | S18 | `MockKnowledgeBaseAdapter` |
| 12 | `IProactiveNotificationPort` | Thông báo sự cố khu vực | S22 | `MockProactiveNotificationAdapter` |
| 13 | `INotificationPort` | Push, Zalo, SMS, email | S32 | `MockNotificationAdapter` |
| 14 | `IDocumentPort` | Upload, download file | S34 | `MockDocumentAdapter` |

### Ports & Adapters (Phase 2 — thêm 12 Port Interfaces)

| # | Port Interface | Purpose | Service ID | Adapter (Phase 2) |
|---|---|---|---|---|
| 15 | `ISegmentationPort` | Phân khúc KH, eligibility | S3 | `MockSegmentationAdapter` |
| 16 | `ISmartMeterPort` | Dữ liệu real-time smart meter | S7 | `MockSmartMeterAdapter` |
| 17 | `IWaterCutoffPort` | Trạng thái cắt nước | S14 | `MockWaterCutoffAdapter` |
| 18 | `ICallCenterPort` | Click-to-call, callback | S15 | `MockCallCenterAdapter` |
| 19 | `IFeedbackPort` | CSAT, NPS, CES | S17 | `MockFeedbackAdapter` |
| 20 | `IOnboardingPort` | Đăng ký lắp đặt mới | S19 | `MockOnboardingAdapter` |
| 21 | `ISiteSurveyPort` | Khảo sát, nghiệm thu | S20 | `MockSiteSurveyAdapter` |
| 22 | `IReportingPort` | Báo cáo tiêu thụ | S23 | `MockReportingAdapter` |
| 23 | `IChatbotPort` | AI chatbot | S24 | `MockChatbotAdapter` |
| 24 | `IGISPort` | Bản đồ, vùng phủ | S30 | `MockGISAdapter` |
| 25 | `IFieldTeamPort` | ETA đội hiện trường | S31 | `MockFieldTeamAdapter` |
| 26 | `IeContractPort` | Ký số eContract | S33 | `MockEContractAdapter` |

### Ports & Adapters (Phase 3 — thêm 4 Port Interfaces)

| # | Port Interface | Purpose | Service ID | Adapter (Phase 3) |
|---|---|---|---|---|
| 27 | `IMeterAnomalyPort` | Cảnh báo bất thường đồng hồ | S8 | `MockMeterAnomalyAdapter` |
| 28 | `ICampaignPort` | Chiến dịch marketing | S21 | `MockCampaignAdapter` |
| 29 | `ILeakageAlertPort` | Cảnh báo rò rỉ AI | S25 | `MockLeakageAlertAdapter` |
| 30 | `IWaterQualityPort` | Chất lượng nước | S35 | `MockWaterQualityAdapter` |

### Out of Scope for MVP

| ❌ Tính năng | Lý do loại bỏ | Khi nào làm? |
|-------------|---------------|-------------|
| **SaaS External Adapters** | MVP tập hợp internal integration. | Khi có khách hàng SaaS đầu tiên |
| **Internal Staff Portal** | BFF chỉ phục vụ KH. Internal staff → portal riêng. | Phase 3 |
| **Smart Meter real-time** | Chỉ khi có KH có smart meter. | Phase 2 |
| **AI Chatbot/Voicebot** | Cần data nền tảng ổn định trước. | Phase 2-3 |
| **Onboarding online** | Phức tạp workflow liên phòng. | Phase 2 |
| **Campaign/Marketing** | Không ưu tiên cho customer portal MVP. | Phase 3 |
| **AI Leakage/Fraud/Churn** | Cần 6-12 tháng dữ liệu sạch. | Phase 3 |
| **Call Center integration** | Click-to-call cần hạ tầng tổng đài. | Phase 2 |
| **CSAT/NPS surveys** | Cần có tương tác trước. | Phase 2 |
| **Water Quality display** | Cần tích hợp phân hệ Môi trường. | Phase 3 |

### MVP Success Criteria

| # | Criteria | Cách đo |
|---|----------|---------|
| MC-1 | 2 kênh hoạt động: App + Zalo (hoặc Web + Zalo) | Demo end-to-end |
| MC-2 | Context Preservation: KH chat Zalo → mở Web → history intact | Test case |
| MC-3 | Customer Auth: KH đăng nhập SĐT/OTP → xem data mình | Auth test |
| MC-4 | 14 Ports hoạt động với Mock Adapters | API integration test |
| MC-5 | Graceful Degradation: tắt downstream mock → cached response → KH vẫn nhận | Kill service test |
| MC-6 | Adapter Swappability: đổi MockAdapter → không sửa Port interface | Code review |

### Growth Features (Phase 2)

| # | Feature | Downstream Services |
|---|---------|---------------------|
| G1 | Smart Meter real-time data display | S7: Smart Meter Service |
| G2 | Water cut-off status & alerts | S14: Water Cut-off Service |
| G3 | Click-to-call (gọi tổng đài từ App) | S15: Call Center Service |
| G4 | CSAT/NPS/CES feedback | S17: Feedback Service |
| G5 | New customer onboarding online | S19: Onboarding Service |
| G6 | Digital site survey & acceptance | S20: Site Survey Service |
| G7 | Consumption reports & comparison | S23: Reporting Service |
| G8 | AI Chatbot (basic) | S24: AI Chatbot Service |
| G9 | GIS coverage check | S30: GIS Service |
| G10 | Field team ETA tracking | S31: Field Team Service |
| G11 | eContract digital signing | S33: eContract Service |
| G12 | Full Graceful Degradation (3 tầng) | Infrastructure |
| G13 | DLQ + Queue retry | Infrastructure |
| G14 | Rich push notification + deeplink | S32: Notification Service |

### Vision (Phase 3)

| # | Feature | Downstream Services |
|---|---------|---------------------|
| V1 | SaaS External Adapters | External API adapters |
| V2 | Internal Staff Portal (reuse Ports) | All services |
| V3 | Meter anomaly alerts to customer | S8: Meter Anomaly Service |
| V4 | Campaign & marketing messages | S21: Campaign Service |
| V5 | AI Leakage alert (WOW factor) | S25: AI Leakage Alert Service |
| V6 | Water quality at customer location | S35: Water Quality Service |
| V7 | AI Voicebot on Hotline | S24: AI Chatbot Service |
| V8 | Multi-tenant config | Infrastructure |
| V9 | Senior mode (font lớn, ít menu) | Frontend |

---

## User Journeys

### Journey 1: KH tra cứu hóa đơn và thanh toán qua App (Primary — Success Path)

**Persona:** Anh Tuấn, 35 tuổi, dùng Mobile App.
**Services gọi:** S1 (Auth), S2 (Profile), S10 (Invoice), S9 (Tariff), S12 (Payment), S32 (Notification)

1. Anh mở App → Auth layer nhận diện (SĐT đã đăng ký trước đó) → tự động login
2. Home screen hiện: "Hóa đơn tháng 6: 150.000đ — Chưa thanh toán"
3. Anh nhấn "Xem chi tiết" → BFF gọi `IInvoicePort.getById()` → Invoice Service trả về chi tiết hóa đơn + bậc thang giá
4. Anh nhấn "Thanh toán" → BFF gọi `IPaymentPort.createPayment()` → Payment Service trả về QR code
5. Anh quét QR → thanh toán thành công → Payment Service gửi webhook → BFF cập nhật trạng thái
6. Push notification qua `INotificationPort`: "Thanh toán thành công! Biên lai điện tử đã sẵn sàng."
7. Session event: `{ type: "payment_completed", invoiceId: "INV-2026-06", amount: 150000 }`

### Journey 2: KH báo sự cố qua Zalo OA (Alternative Channel)

**Persona:** Anh Tuấn (tiếp tục).
**Services gọi:** S1 (Auth), S16 (Ticketing), S34 (Document), S32 (Notification)

1. Anh nhắn "Nhà tôi mất nước" qua Zalo OA
2. Zalo Adapter tiếp nhận → Auth layer xác thực Zalo ID → UserID `USR-12345`
3. BFF nhận dạng intent "báo sự cố" → hiển thị form chọn loại sự cố + upload ảnh
4. Anh gửi ảnh rò rỉ + mô tả → BFF gọi `IDocumentPort.getUploadUrl()` → upload ảnh → `ITicketPort.createTicket()` → push data sang Ticketing Service
5. Ticketing Service trả về tracking ID `TK-2026-002` → BFF trả về cho KH qua Zalo
6. Session event: `{ type: "incident_submitted", ticketId: "TK-2026-002", channel: "zalo" }`

### Journey 3: Cross-Channel Context Preservation (Key Differentiator)

**Persona:** Anh Tuấn (tiếp tục từ Journey 2).
**Services gọi:** S1 (Auth), S16 (Ticketing), S2 (Profile)

1. Anh đã chat Zalo lúc 9h sáng báo mất nước → nhận tracking ID `TK-2026-002`
2. 2 giờ chiều → anh mở Web Portal → login cùng SĐT → cùng UserID `USR-12345`
3. BFF query session `session:USR-12345` → tìm session còn active
4. Web Portal hiện đầy đủ: Zalo chat lúc 9h + tracking ID `TK-2026-002` + trạng thái "Đang xử lý"
5. Anh nhấn "Xem chi tiết" → BFF gọi `ITicketPort.getTicketStatus("TK-2026-002")` → hiện tiến độ
6. Anh không phải nhập lại **bất kỳ thông tin nào**

### Journey 4: KH tra cứu tiêu thụ và xem biểu giá (Data Visualization)

**Persona:** Anh Tuấn.
**Services gọi:** S6 (Meter Reading), S9 (Tariff), S5 (Meter)

1. Mở App → chọn "Tiêu thụ nước" → BFF gọi `IMeterReadingPort.getReadings()` + `IMeterReadingPort.getComparison()`
2. Meter Reading Service trả về 12 tháng chỉ số → App render biểu đồ
3. Anh thấy: "Tháng 6: 18m³ (↓ 12% so với tháng 5)" → hiển thị so sánh
4. Anh nhấn "Xem biểu giá" → `ITariffPort.getTariffPlan()` → hiển thị bậc thang giá áp dụng
5. Push notification proactive: "Tiêu thụ tháng này tăng 20% so với trung bình — kiểm tra rò rỉ?"

### Journey 5: Downstream Service Down — Graceful Degradation (Resilience)

**Services gọi:** S10 (Invoice), fallback cache

1. KH mở App → xem hóa đơn → BFF gọi `IInvoicePort.getList()` → Circuit Breaker detect: timeout
2. CB mở circuit cho Invoice endpoint → fallback sang cached data
3. KH thấy: "Hóa đơn tháng 6: 150.000đ (cập nhật lúc 14:30)"
4. BFF log cảnh báo → Admin nhận notification
5. Invoice Service phục hồi → CB Half-Open → probe → OK → Close lại

### Journey 6: KH xem công nợ và nhắc nợ (Debt Management)

**Persona:** Cô Nguyễn.
**Services gọi:** S13 (Debt), S10 (Invoice), S32 (Notification)

1. Cô mở App → home screen hiện badge "Có 2 hóa đơn chưa thanh toán"
2. Cô nhấn → BFF gọi `IDebtPort.getOutstandingDebt()` → hiển thị: Hóa đơn tháng 5: 120.000đ (quá hạn 15 ngày), tháng 6: 150.000đ (chưa đến hạn)
3. Cô nhấn "Thanh toán ngay" → Journey 1 tiếp tục
4. Push notification nhắc nợ (qua `INotificationPort`): "Hóa đơn tháng 5 còn nợ 120.000đ — thanh toán ngay để tránh phí phạt"

### Journey 7: KH đăng ký lắp đặt mới online (Onboarding — Phase 2)

**Persona:** Người dân mới xây nhà.
**Services gọi:** S19 (Onboarding), S30 (GIS), S34 (Document), S4 (Contract), S33 (eContract)

1. Mở App → "Đăng ký lắp đặt nước" → BFF gọi `IOnboardingPort.submitApplication()`
2. KH nhập địa chỉ → BFF gọi `IGISPort.checkCoverage()` → kiểm tra vùng phủ
3. Upload CCCD + giấy nhà đất → `IDocumentPort.getUploadUrl()` → AI OCR đọc dữ liệu
4. Nhận báo giá tự động → `IOnboardingPort.getQuote()`
5. Đặt lịch khảo sát → `IOnboardingPort.scheduleSurvey()`
6. Sau khảo sát → ký hợp đồng điện tử → `IeContractPort.initiateSigning()`
7. Thanh toán phí lắp đặt → `IPaymentPort.createPayment()`

### Journey 8: KH nhận cảnh báo rò rỉ AI (WOW Moment — Phase 3)

**Persona:** Anh Tuấn.
**Services gọi:** S25 (AI Leakage Alert), S16 (Ticketing), S32 (Notification)

1. Push notification: "Công ty phát hiện khả năng cao có rò rỉ trong nhà bạn"
2. Anh mở App → `ILeakageAlertPort.getLeakageAlerts()` → xem chi tiết phân tích AI
3. Biểu đồ tiêu thụ ban đêm cho thấy dòng chảy liên tục 0.2 m³/h từ 00:00-04:00
4. Anh nhấn "Đặt lịch kiểm tra" → `ILeakageAlertPort.scheduleInspection()` → tạo ticket
5. Đội đến kiểm tra → xác nhận rò rilet → sửa → tiết kiệm 50m³/tháng cho anh

### Journey 9: KH chat với AI Chatbot (Phase 2)

**Persona:** Anh Tuấn.
**Services gọi:** S24 (AI Chatbot), S10 (Invoice), S16 (Ticketing)

1. Anh mở App → chat "Hóa đơn tháng 6 bao nhiêu?" → `IChatbotPort.sendMessage()`
2. Chatbot xác thực KH → truy vấn Invoice Service → "Hóa đơn tháng 6: 150.000đ, chưa thanh toán"
3. Anh chat "Thanh toán luôn" → Chatbot tạo payment link → thanh toán ngay trong chat
4. Anh chat "Nhà tôi mất nước" → Chatbot tự tạo ticket → "Đã tiếp nhận. Mã sự cố: TK-2026-010"
5. Nếu Chatbot không xử lý được → `IChatbotPort.handoffToAgent()` → chuyển tổng đài viên với context đầy đủ

### Journey 10: KH nhận thông báo sự cố khu vực (Proactive Communication)

**Persona:** Cô Nguyễn.
**Services gọi:** S22 (Proactive Communication), S32 (Notification)

1. Sự cố vỡ ống tại khu vực Cô Nguyễn → Proactive Communication Service khoanh vùng KH ảnh hưởng
2. Push notification: "Dự kiến mất nước từ 14:00-18:00 do sửa chữa đường ống Nguyễn Văn Cừ"
3. Cô mở App → `IProactiveNotificationPort.getActiveAlerts()` → xem chi tiết + thời gian dự kiến
4. 17:30 → notification: "Đã có nước trở lại. Xin lỗi vì sự bất tiện!"
5. Lịch sử thông báo lưu vào Customer 360

### Journey Requirements Summary

| Journey | Downstream Services (ID) | Key Ports |
|---------|--------------------------|-----------|
| J1: Thanh toán hóa đơn | S1, S2, S9, S10, S12, S32 | IAuthPort, IInvoicePort, ITariffPort, IPaymentPort, INotificationPort |
| J2: Báo sự cố qua Zalo | S1, S16, S34, S32 | IAuthPort, ITicketPort, IDocumentPort, INotificationPort |
| J3: Cross-channel context | S1, S2, S16 | IAuthPort, ICustomerProfilePort, ITicketPort |
| J4: Tra cứu tiêu thụ | S5, S6, S9 | IMeterPort, IMeterReadingPort, ITariffPort |
| J5: Downstream down | S10 | IInvoicePort (fallback cache) |
| J6: Công nợ & nhắc nợ | S10, S13, S32 | IInvoicePort, IDebtPort, INotificationPort |
| J7: Onboarding online | S4, S19, S30, S33, S34 | IOnboardingPort, IGISPort, IeContractPort, IDocumentPort, IContractPort |
| J8: Cảnh báo rò rỉ AI | S16, S25, S32 | ILeakageAlertPort, ITicketPort, INotificationPort |
| J9: AI Chatbot | S10, S16, S24 | IChatbotPort, IInvoicePort, ITicketPort |
| J10: Thông báo sự cố | S22, S32 | IProactiveNotificationPort, INotificationPort |

---

## Domain-Specific Requirements

### Domain: Utility (Cấp nước)

**Complexity:** High — dịch vụ công độc quyền, chịu sự điều chỉnh của cơ quan quản lý nhà nước.

### Compliance & Regulatory

| # | Requirement | Chi tiết |
|---|-------------|---------|
| DR-1 | **Bảo mật dữ liệu KH** | Thông tin cá nhân (tên, SĐT, địa chỉ, mã KH) phải được mã hóa at rest và in transit. Tuân thủ Nghị định 13/2023/NĐ-CP. |
| DR-2 | **Audit logging** | Mọi hành động truy cập/chỉnh sửa dữ liệu KH phải được ghi log với timestamp, user ID, action, resource. Log lưu tối thiểu 12 tháng. |
| DR-3 | **PII masking** | 100% PII fields (SĐT, tên, địa chỉ, CCCD) được redact trước khi ghi log. Sử dụng `pino-redact` với mandatory paths. |
| DR-4 | **SLA tuân thủ quy định** | Tiêu chuẩn dịch vụ công: phản hồi khiếu nại trong 24h, sự cố cấp nước theo SLA theo địa bàn (2-6h tùy khu vực). |
| DR-5 | **Hóa đơn điện tử** | Tuân thủ Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC. Mỗi HĐĐT có mã CQT, mã tra cứu, chữ ký số. |
| DR-6 | **Kiểm định đồng hồ** | Tuân thủ Nghị định 86/2012/NĐ-CP: kiểm định 5 năm (đồng hồ < DN40), 2 năm (> DN40). Không xuất hóa đơn từ đồng hồ hết hạn. |
| DR-7 | **eContract** | Tuân thủ Nghị định 130/2018/NĐ-CP về ký số. |

### Technical Constraints

| # | Requirement | Chi tiết |
|---|-------------|---------|
| DR-8 | **API Contract First** | Mỗi downstream Microservice cung cấp OpenAPI/Swagger. BFF dùng spec để validate response. |
| DR-9 | **Hexagonal Port isolation** | Mỗi Port định nghĩa interface thuần. Adapter implementation injectable. Đổi downstream = đổi Adapter class, Port không đổi. |
| DR-10 | **Secret management** | Signing keys, API keys → lưu env var, không hardcode. Rotation strategy cho shared secrets. |
| DR-11 | **Never die because downstream died** | BFF luôn trả response cho KH. 3 tầng: Live → Cached → Queued message. 0% total outage. |

### Microservices Integration Requirements

| # | System | Direction | Protocol | Port Interface | Phase |
|---|--------|-----------|----------|---------------|-------|
| IR-1 | Customer Identity & Auth Service | Inbound/Outbound | REST + JWT | `IAuthPort` | MVP |
| IR-2 | Customer Profile Service | Outbound | REST | `ICustomerProfilePort` | MVP |
| IR-3 | Contract Service | Outbound | REST | `IContractPort` | MVP |
| IR-4 | Meter Service | Outbound | REST | `IMeterPort` | MVP |
| IR-5 | Meter Reading Service | Outbound | REST | `IMeterReadingPort` | MVP |
| IR-6 | Billing / Tariff Service | Outbound | REST | `ITariffPort` | MVP |
| IR-7 | Invoice Service | Outbound | REST | `IInvoicePort` | MVP |
| IR-8 | Payment Service | Outbound + Webhook Inbound | REST + Webhook | `IPaymentPort` | MVP |
| IR-9 | Debt Management Service | Outbound | REST | `IDebtPort` | MVP |
| IR-10 | Ticketing / SLA Service | Outbound + Webhook Inbound | REST + Webhook | `ITicketPort` | MVP |
| IR-11 | Knowledge Base Service | Outbound | REST | `IKnowledgeBasePort` | MVP |
| IR-12 | Proactive Communication Service | Outbound + SSE | REST + SSE | `IProactiveNotificationPort` | MVP |
| IR-13 | Notification Service | Outbound + Webhook Inbound | REST + Webhook | `INotificationPort` | MVP |
| IR-14 | Document / Storage Service | Outbound | REST + S3 | `IDocumentPort` | MVP |
| IR-15 | Customer Segmentation Service | Outbound | REST | `ISegmentationPort` | Phase 2 |
| IR-16 | Smart Meter Service | Outbound + WebSocket | REST + WS | `ISmartMeterPort` | Phase 2 |
| IR-17 | Water Cut-off Service | Outbound + Webhook | REST + Webhook | `IWaterCutoffPort` | Phase 2 |
| IR-18 | Call Center Service | Outbound | REST | `ICallCenterPort` | Phase 2 |
| IR-19 | Feedback / Survey Service | Outbound | REST | `IFeedbackPort` | Phase 2 |
| IR-20 | Onboarding Service | Outbound + Webhook | REST + Webhook | `IOnboardingPort` | Phase 2 |
| IR-21 | Site Survey Service | Outbound | REST | `ISiteSurveyPort` | Phase 2 |
| IR-22 | Reporting Service | Outbound | REST | `IReportingPort` | Phase 2 |
| IR-23 | AI Chatbot Service | Outbound + WebSocket | REST + WS | `IChatbotPort` | Phase 2 |
| IR-24 | GIS Service | Outbound | REST | `IGISPort` | Phase 2 |
| IR-25 | Field Team Tracking Service | Outbound + WebSocket | REST + WS | `IFieldTeamPort` | Phase 2 |
| IR-26 | eContract Service | Outbound | REST | `IeContractPort` | Phase 2 |
| IR-27 | Meter Anomaly Service | Outbound + Webhook | REST + Webhook | `IMeterAnomalyPort` | Phase 3 |
| IR-28 | Campaign / Marketing Service | Outbound | REST | `ICampaignPort` | Phase 3 |
| IR-29 | AI Leakage Alert Service | Outbound + Webhook | REST + Webhook | `ILeakageAlertPort` | Phase 3 |
| IR-30 | Water Quality Service | Outbound | REST | `IWaterQualityPort` | Phase 3 |
| IR-31 | Redis (Session store) | Internal | Redis protocol | Internal | MVP |
| IR-32 | PostgreSQL (Customer Auth DB) | Internal | PostgreSQL | Internal | MVP |

### Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Downstream chưa sẵn sàng → luồng bị block | **14 Mock Adapters sẵn sàng** cho MVP. Adapter fallback: Live → Mock → cached → graceful message |
| Downstream down đột ngột | Circuit Breaker per-service + Cache fallback + Queue retry (Phase 2) |
| Schemas khác nhau giữa services | Port interface chuẩn hóa response format. Adapter transform upstream schema → Port schema. |
| Zalo rate limit (2 tin ZNS/KH/ngày) | Notification Module funnel: rate limiting + batching |
| 30 services quá nhiều để quản lý | Hexagonal Architecture: mỗi Port độc lập. Thêm service = thêm Port + Adapter, không ảnh hưởng BFF core. |
| Mock data không phản ánh thực tế | Tạo mock data từ 5+ personas (Cô Nguyễn, Anh Tuấn, KCN Cẩm Phả, Bà Lan, KH DN vừa). Mỗi persona có full data chain: profile → contract → meter → readings → invoices → payments → tickets. |

---

## Innovation & Novel Patterns

### Detected Innovation Areas

| # | Innovation | Chi tiết |
|---|-----------|---------|
| IN-1 | **BFF + Hexagonal Ports (30 Ports) for Utility SaaS** | Khác CRM phổ biến (sở hữu data), BFF chỉ aggregate + transform. 30 Port Interfaces cho 30 downstream services. Hexagonal Ports cho phép swap downstream service khi bán SaaS cho nhà máy nước khác. |
| IN-2 | **Context Preservation cross-channel cho KH** | Session store + event sourcing cho phép KH chuyển kênh (Zalo → Web → App) mà không mất ngữ cảnh. CRM phổ biến không hỗ trợ native. |
| IN-3 | **Circuit Breaker per-service với Graceful Degradation 3 tầng** | Live → Cached → Queue+Notify. KH luôn nhận response kể cả khi tất cả downstream down. Resilience-first cho hệ thống mission-critical. |
| IN-4 | **Adapter Swappability (SaaS White-labeling)** | Khi bán cho nhà máy nước khác → chỉ cần viết ExternalAdapter (implements cùng Port interface) → App/Web hoạt động bình thường. |
| IN-5 | **AI Leakage Alert — WOW Moment** | AI phát hiện rò rỉ trong nhà KH chỉ qua phân tích tiêu thụ → chủ động báo cho KH → tiết kiệm hàng trăm m³ nước. Tạo ấn tượng vượt kỳ vọng. |

### Validation Approach

| Innovation | Cách validate |
|-----------|---------------|
| BFF + Hexagonal Ports | MVP demo: 14 Ports hoạt động với MockAdapters |
| Context Preservation | Test case: chat Zalo → mở Web → verify context intact |
| Graceful Degradation | Kill downstream service → verify Circuit Breaker fallback |
| Adapter Swappability | Code review: Port interface không reference downstream specifics |
| AI Leakage Alert | Phase 3: A/B test notification với KH có/nhận cảnh báo |

---

## BFF-Specific Requirements

### API Contract First

| # | Requirement | Chi tiết |
|---|-------------|---------|
| PT-1 | OpenAPI/Swagger spec **bắt buộc** | Mỗi downstream service cung cấp Swagger. BFF dùng spec để validate response. |
| PT-2 | Port interface chuẩn hóa | Mỗi Port định nghĩa TypeScript interface. Adapter transform upstream → Port schema. Frontend chỉ biết Port schema. |
| PT-3 | Versioning | Port versioning qua URL path. Breaking change = major version bump. |

### Customer Authentication

| # | Requirement | Chi tiết |
|---|-------------|---------|
| PT-4 | Customer-only auth | BFF chỉ quản lý auth cho KH cuối. SĐT/OTP, Zalo ID, Social login. Internal staff → Identity Service riêng. |
| PT-5 | Token payload | Access token chứa: customer identity, linked providers, session reference. Không chứa internal roles. |
| PT-6 | Multi-provider linking | 1 KH liên kết nhiều Provider (SĐT, Zalo ID, Email) để cross-channel identification. |
| PT-7 | Token lifecycle | Access token: 15 phút. Refresh token: 7 ngày. Auto-refresh khi downstream trả 401. |

### Resilience Capability Requirements

| # | Capability | Requirement |
|---|-----------|-------------|
| PT-8 | Circuit Breaker per-service | opossum: per downstream service. Failure > 50% in 10s → open → fallback. |
| PT-9 | Cache TTL phân tầng | Static (hợp đồng): 12-24h. Dynamic (hóa đơn): 5-15 min. Transaction (thanh toán): NO CACHE |
| PT-10 | Retry Queue (Phase 2) | BullMQ exponential backoff. Dead Letter Queue. |
| PT-11 | Webhook security | HMAC signature verification (Zalo). Static API key (internal webhooks from Payment/Ticketing). |
| PT-12 | Structured logging | Correlation ID on every request. PII redaction mandatory. |
| PT-13 | Environment-based config | Secrets, connection strings, downstream URLs → env var. |
| PT-14 | Mock Adapter toggle | `MOCK_MODE=true` → tất cả Port calls đi qua MockAdapter. `MOCK_MODE=false` → đi qua InternalAdapter. Cho phép develop BFF mà không cần downstream sẵn sàng. |

---

## Functional Requirements

### Customer Authentication & Identity (S1)

- **FR1:** Khách hàng xác thực danh tính qua SĐT/OTP, Zalo ID, hoặc Social login (Google, Facebook, Apple) — không cần username/password
- **FR2:** Hệ thống liên kết 1 Customer với nhiều Provider (SĐT, Zalo ID, Email) để cross-channel identification
- **FR3:** Hệ thống issue authenticated token chứa customer identity, linked providers, session reference cho mọi authenticated KH
- **FR4:** Hệ thống tự động refresh access token khi nhận 401 từ downstream — KH không thấy gián đoạn
- **FR5:** BFF owns Customer Auth DB (PostgreSQL) — lưu customer profiles, provider links, tokens

### Customer Profile 360° (S2)

- **FR6:** KH xem hồ sơ 360°: mã KH, thông tin định danh, phân loại sử dụng, địa chỉ, thông tin liên hệ
- **FR7:** KH xem timeline tương tác 360°: hợp đồng → đồng hồ → chỉ số → hóa đơn → thanh toán → khiếu nại → tương tác đa kênh, sắp xếp theo trục thời gian
- **FR8:** KH cập nhật thông tin liên hệ (SĐT, email, địa chỉ liên hệ)
- **FR9:** KH xem cây quan hệ (KCN → nhà máy thành viên), người liên hệ phụ trợ

### Hexagonal Adapter Layer (30 Ports)

- **FR10:** Mỗi downstream Microservice giao tiếp qua Port interface (30 Port Interfaces tổng cộng: 14 MVP + 12 Phase 2 + 4 Phase 3)
- **FR11:** Adapter implementation injectable — MockAdapter cho development, InternalAdapter cho production, ExternalAdapter cho SaaS
- **FR12:** Frontend chỉ biết Port schema — không bao giờ tiếp xúc với downstream raw schema
- **FR13:** Thêm downstream service mới = thêm Port + Adapter — không sửa BFF core
- **FR14:** Mỗi Adapter chuẩn hóa response về Port schema trước khi trả về frontend
- **FR15:** Mock Adapter toggle: `MOCK_MODE=true` → mock responses, `MOCK_MODE=false` → live calls. Cho phép develop BFF song song với downstream.

### Contract Management (S4)

- **FR16:** KH xem thông tin hợp đồng: địa chỉ, mã đồng hồ, định mức nước, loại thuê bao, điều khoản giá, trạng thái
- **FR17:** KH xem lịch sử phiên bản hợp đồng (versioning)
- **FR18:** KH tải PDF hợp đồng
- **FR19:** Hệ thống cache contract data với TTL 12-24h (static data)

### Meter Information (S5)

- **FR20:** KH xem thông tin đồng hồ: serial, loại, đường kính (DN), cấp chính xác, năm sản xuất
- **FR21:** KH xem trạng thái kiểm định đồng hồ (còn hạn / sắp hết hạn / hết hạn)
- **FR22:** KH xem lịch sử thay thế đồng hồ

### Meter Reading & Consumption (S6)

- **FR23:** KH xem biểu đồ lượng nước tiêu thụ hàng tháng (12 tháng gần nhất)
- **FR24:** KH xem so sánh tiêu thụ kỳ này vs kỳ trước (tăng/giảm %)
- **FR25:** KH xem chi tiết chỉ số 1 kỳ: chỉ số trước, chỉ số sau, sản lượng, ảnh bằng chứng

### Tariff Display (S9)

- **FR26:** KH xem biểu giá áp dụng cho hợp đồng của mình (bậc thang giá sinh hoạt / giá đặc thù)
- **FR27:** KH xem chi tiết bậc thang giá trong hóa đơn (m³ × giá = thành tiền)
- **FR28:** KH xem các loại phí kèm theo (môi trường, thoát nước, VAT)

### Invoice & E-Invoice (S10)

- **FR29:** KH xem danh sách hóa đơn với phân trang và filter (theo tháng, trạng thái)
- **FR30:** KH xem chi tiết hóa đơn: khoản mục, bậc thang giá, tổng tiền, trạng thái thanh toán
- **FR31:** KH tải PDF hóa đơn điện tử (có mã CQT, mã tra cứu, chữ ký số)
- **FR32:** Hệ thống cache invoice list với TTL 5-15 phút (dynamic data)

### Payment (S12)

- **FR33:** KH chọn hóa đơn → khởi tạo giao dịch thanh toán → nhận QR code hoặc payment link
- **FR34:** BFF nhận webhook từ Payment Service khi thanh toán thành công → cập nhật trạng thái hóa đơn (cached) → gửi notification
- **FR35:** **TUYỆT ĐỐI KHÔNG CACHE** giao dịch thanh toán — mọi payment request phải gọi Payment Service live
- **FR36:** KH xem lịch sử thanh toán
- **FR37:** KH thanh toán nhiều hóa đơn cùng lúc
- **FR38:** KH đăng ký ủy nhiệm chi tự động (Direct Debit)

### Debt Management (S13)

- **FR39:** KH xem công nợ hiện tại: số tiền, kỳ nợ, aging (0-30, 31-60, 61-90, >90 ngày)
- **FR40:** KH xem lịch sử công nợ

### Ticketing & SLA (S16)

- **FR41:** KH điền form báo sự cố: loại sự cố, mô tả, upload ảnh, vị trí → BFF push data sang Ticketing Service
- **FR42:** Ticketing Service trả về tracking ID → BFF hiển thị cho KH
- **FR43:** KH tra cứu trạng thái sự cố theo tracking ID (timeline + ETA như Grab)
- **FR44:** BFF nhận webhook từ Ticketing Service khi trạng thái sự cố thay đổi → gửi notification cho KH
- **FR45:** KH gửi feedback khi ticket đóng (CSAT)
- **FR46:** KH xem lịch sử ticket (đã đóng, đang xử lý)

### Knowledge Base & FAQ (S18)

- **FR47:** KH tìm kiếm FAQ bằng tiếng Việt (có dấu/không dấu, từ đồng nghĩa)
- **FR48:** KH xem bài viết hướng dẫn theo chủ đề: hóa đơn, ghi chỉ số, sự cố, thanh toán, lắp đặt mới
- **FR49:** KH đánh giá bài viết hữu ích/không hữu ích

### Proactive Communication (S22)

- **FR50:** KH nhận thông báo sự cố khu vực (mất nước, sửa chữa, thay đổi chất lượng)
- **FR51:** KH xem thông báo đang hoạt động ảnh hưởng mình
- **FR52:** KH xem lịch sử thông báo sự cố
- **FR53:** KH xác nhận đã xem thông báo

### Notification (S32)

- **FR54:** Hệ thống gửi thông báo cho KH qua kênh phù hợp (Push, Zalo, SMS, Email) khi: hóa đơn mới, thanh toán thành công, sự cố cập nhật trạng thái, nhắc nợ, cảnh báo sắp cắt nước
- **FR55:** Mọi notification dispatch MUST route qua `DispatchNotificationCommand` → rate limiter (max 2 msg ZNS/KH/ticket/ngày) → channel dispatcher
- **FR56:** KH quản lý notification preferences (chọn kênh, bật/tắt loại thông báo)
- **FR57:** KH xem lịch sử notification đã nhận

### Document / File Upload (S34)

- **FR58:** KH upload ảnh sự cố (chụp camera + chọn từ gallery)
- **FR59:** KH upload giấy tờ (onboarding — Phase 2)
- **FR60:** Hệ thống tạo presigned URL cho upload → không expose storage credentials cho frontend

### Context Preservation (Cross-Channel)

- **FR61:** Hệ thống lưu mọi tương tác KH vào session store với event type, timestamp, content — 100% tương tác ghi nhận < 1 giây
- **FR62:** Hệ thống tự động nối tiếp session khi KH chuyển kênh — dựa trên Customer ID, không dựa kênh
- **FR63:** Session có TTL 24-48h. Redis AOF persistence bắt buộc — session survive restart.
- **FR64:** Session writes MUST be atomic — sử dụng Redis Lua script

### Resilience & Graceful Degradation

- **FR65:** Hệ thống phát hiện downstream service down qua Circuit Breaker (per-service, per-Port) → tự động fallback sang cached data
- **FR66:** Hệ thống luôn trả response cho KH — kể cả khi downstream down (cached hoặc queued message)
- **FR67:** Hệ thống cache dữ liệu với TTL phân tầng: static 12-24h, dynamic 5-15 phút, transaction không cache
- **FR68:** Hệ thống ghi log cảnh báo khi Circuit Breaker mở hoặc fallback kích hoạt

### Idempotency

- **FR69:** Inbound idempotency: Mọi NormalizedRequest phải mang `idempotencyKey`. Check Redis trước khi xử lý. Trùng key → trả cached result.
- **FR70:** Outbound idempotency: Mọi BFF → downstream POST/PUT call phải đính kèm `x-idempotency-key` header.

### Webhook Security

- **FR71:** Zalo inbound webhook: HMAC SHA-256 body verification
- **FR72:** Internal webhooks (Payment/Ticketing): Static API key verification. Không dùng JWT cho inter-service webhooks.

---

## Non-Functional Requirements

### Performance

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-P1 | BFF response time (không tính downstream latency) | < 200ms | APM monitoring (p95) |
| NFR-P2 | Customer Auth latency (login → token ready) | < 500ms | APM monitoring (p95) |
| NFR-P3 | Page load (KH mở App → data hiện) | < 3 giây | End-to-end measurement |
| NFR-P4 | Downstream timeout | 3 giây | Configurable per Port |
| NFR-P5 | Concurrent customer sessions | 500 active sessions | Load testing |
| NFR-P6 | Aggregation latency (multi-service calls) | < 500ms additional | APM monitoring |

### Security

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-S1 | Dữ liệu cá nhân KH mã hóa at rest | AES-256 | Database encryption audit |
| NFR-S2 | Dữ liệu truyền tải mã hóa in transit | TLS 1.3 | SSL Labs scan |
| NFR-S3 | API keys/secrets lưu env var | Zero hardcoded secrets | Code scan (SAST) |
| NFR-S4 | Access token TTL | 15 phút | Token inspection |
| NFR-S5 | Refresh token TTL | 7 ngày | Token inspection |
| NFR-S6 | Audit log mọi truy cập data KH | 100% actions logged | Log completeness check |
| NFR-S7 | Audit log retention | ≥ 12 tháng | Log storage audit |
| NFR-S8 | PII masking via pino-redact | 100% PII paths redacted | Log sampling audit |

### Reliability

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-R1 | Multi-channel uptime (App + Web + Zalo) | ≥ 99.5% | Uptime monitoring |
| NFR-R2 | Total outage | 0% — KH luôn nhận response | Incident tracking |
| NFR-R3 | Circuit Breaker detection latency | < 10 giây | Failover testing |
| NFR-R4 | Session survive Redis restart | 100% session preserved | Restart test (AOF enabled) |

### Scalability

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-SC1 | Horizontal scaling | ≥ 0.8x throughput per additional pod | Load testing |
| NFR-SC2 | Thêm Port/Adapter không sửa core | 0 code change in core | Code review |
| NFR-SC3 | Adapter swap không ảnh hưởng throughput | < 5% performance delta | Performance test |

### Integration

| ID | Requirement | Metric | Measurement |
|----|-------------|--------|-------------|
| NFR-I1 | Port response schema validation | 100% match OpenAPI spec | CI/CD contract testing |
| NFR-I2 | Downstream API change notification | Before deployment | Process enforcement |
| NFR-I3 | Zalo OA API compliance | Compliant with Zalo OA API | Integration testing |
| NFR-I4 | Webhook verification (HMAC + API key) | 100% inbound webhooks verified | Security audit |
| NFR-I5 | Mock Adapter coverage | 100% Port Interfaces có MockAdapter | Code coverage |

---

## Traceability Matrix

### Mota_Tinh_Nang → Downstream Services → BFF Ports

| Nhóm Mota_Tinh_Nang | Tính năng | Service ID | Port Interface | Phase | FRs |
|---|---|---|---|---|---|
| N1-1.1 | Hồ sơ KH 360° | S2 | `ICustomerProfilePort` | MVP | FR6-FR9 |
| N1-1.2 | Phân khúc KH | S3 | `ISegmentationPort` | Phase 2 | — |
| N1-1.3 | Quản lý hợp đồng | S4 | `IContractPort` | MVP | FR16-FR19 |
| N2-2.1 | Vòng đời đồng hồ | S5 | `IMeterPort` | MVP | FR20-FR22 |
| N2-2.2 | Ghi chỉ số + AI OCR | S6 | `IMeterReadingPort` | MVP | FR23-FR25 |
| N2-2.3 | Smart Meter AMR/AMI | S7 | `ISmartMeterPort` | Phase 2 | — |
| N2-2.4 | Bất thường & gian lận | S8 | `IMeterAnomalyPort` | Phase 3 | — |
| N3-3.1 | Tariff Engine | S9 | `ITariffPort` | MVP | FR26-FR28 |
| N3-3.2 | Hóa đơn điện tử | S10 | `IInvoicePort` | MVP | FR29-FR32 |
| N3-3.3 | Đối soát doanh thu | S11 | _Không mock_ | — | — |
| N4-4.1 | Cổng thanh toán | S12 | `IPaymentPort` | MVP | FR33-FR38 |
| N4-4.2 | Công nợ & nhắc nợ | S13 | `IDebtPort` | MVP | FR39-FR40 |
| N4-4.3 | Cắt nước | S14 | `IWaterCutoffPort` | Phase 2 | — |
| N5-5.1 | Tổng đài Call Center | S15 | `ICallCenterPort` | Phase 2 | — |
| N5-5.2 | Ticketing & SLA | S16 | `ITicketPort` | MVP | FR41-FR46 |
| N5-5.3 | CSAT/NPS/CES | S17 | `IFeedbackPort` | Phase 2 | — |
| N5-5.4 | Knowledge Base | S18 | `IKnowledgeBasePort` | MVP | FR47-FR49 |
| N6-6.1 | Đăng ký lắp đặt mới | S19 | `IOnboardingPort` | Phase 2 | — |
| N6-6.2 | Khảo sát nghiệm thu | S20 | `ISiteSurveyPort` | Phase 2 | — |
| N7-7.1 | My Công ty App | — | _BFF chính là backend_ | — | — |
| N8-8.1 | Chiến dịch marketing | S21 | `ICampaignPort` | Phase 3 | — |
| N8-8.2 | Thông báo chủ động | S22 | `IProactiveNotificationPort` | MVP | FR50-FR53 |
| N9-9.1 | Dashboard & Báo cáo | S23 | `IReportingPort` | Phase 2 | — |
| N10-10.1 | AI Chatbot/Voicebot | S24 | `IChatbotPort` | Phase 2 | — |
| N10-10.2 | AI Dự báo doanh thu | S27 | _Không mock_ | — | — |
| N10-10.3 | AI Churn Prediction | S28 | _Không mock_ | — | — |
| N10-10.4 | AI Cảnh báo rò rỉ | S25 | `ILeakageAlertPort` | Phase 3 | — |
| N10-10.5 | AI Fraud Detection | S26 | _Không mock riêng_ | — | — |
| N10-10.6 | AI Agent Assist | S29 | _Không mock_ | — | — |
| Cross | GIS Service | S30 | `IGISPort` | Phase 2 | — |
| Cross | Field Team Tracking | S31 | `IFieldTeamPort` | Phase 2 | — |
| Cross | Notification Service | S32 | `INotificationPort` | MVP | FR54-FR57 |
| Cross | eContract Service | S33 | `IeContractPort` | Phase 2 | — |
| Cross | Document/Storage | S34 | `IDocumentPort` | MVP | FR58-FR60 |
| Cross | Water Quality | S35 | `IWaterQualityPort` | Phase 3 | — |
| Cross | SCADA | S36 | _Không mock riêng_ | — | — |

### Vision → Success Criteria → FRs

| Vision Pillar | Success Criteria | Functional Requirements |
|---|---|---|
| Customer Auth tập trung | CS-1, TS-2 | FR1-FR5 |
| Customer Profile 360° | CS-2, CS-5 | FR6-FR9 |
| Hexagonal Ports & Adapters (30 Ports) | TS-4, NFR-SC2 | FR10-FR15 |
| Contract & Invoice Lookup | CS-5, TS-1 | FR16-FR32 |
| Meter & Consumption | CS-5 | FR20-FR25 |
| Tariff Display | CS-5 | FR26-FR28 |
| Payment Initiation | CS-1, BS-3, BS-5 | FR33-FR38 |
| Debt Management | BS-5 | FR39-FR40 |
| Incident Submission & Tracking | CS-5, BS-4 | FR41-FR46 |
| Knowledge Base & Self-service | CS-5 | FR47-FR49 |
| Proactive Communication | CS-4 | FR50-FR53 |
| Notification | BS-4 | FR54-FR57 |
| Document Upload | — | FR58-FR60 |
| Context Preservation | CS-2, TS-5 | FR61-FR64 |
| Resilience & Graceful Degradation | TS-6, NFR-R2 | FR65-FR68 |
| Idempotency | NFR-R2 | FR69-FR70 |
| Webhook Security | NFR-S3, NFR-I4 | FR71-FR72 |

### User Journeys → Services → FRs

| Journey | Services (ID) | Key FRs |
|---|---|---|
| J1: Thanh toán hóa đơn | S1, S2, S9, S10, S12, S32 | FR1, FR3-FR4, FR26-FR28, FR29-FR31, FR33-FR34, FR54 |
| J2: Báo sự cố qua Zalo | S1, S16, S34, S32 | FR1, FR10-FR12, FR14, FR41-FR42, FR58, FR69, FR71 |
| J3: Cross-channel context | S1, S2, S16 | FR2, FR3, FR6-FR7, FR41-FR43, FR61-FR64 |
| J4: Tra cứu tiêu thụ | S5, S6, S9 | FR20, FR23-FR28 |
| J5: Downstream down | S10 | FR65-FR68 |
| J6: Công nợ & nhắc nợ | S10, S13, S32 | FR29, FR39-FR40, FR54 |
| J7: Onboarding online | S4, S19, S30, S33, S34 | FR16-FR19, FR58-FR60 |
| J8: Cảnh báo rò rỉ AI | S16, S25, S32 | FR41, FR54 |
| J9: AI Chatbot | S10, S16, S24 | FR29, FR41, FR47 |
| J10: Thông báo sự cố | S22, S32 | FR50-FR53, FR54-FR57 |
