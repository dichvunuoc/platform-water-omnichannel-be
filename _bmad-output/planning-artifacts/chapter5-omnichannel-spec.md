---
title: "Chapter 5 — Omnichannel Customer Service (Business Specification)"
document_type: "Authoritative Business Spec — Source of Truth"
source: "Enterprise business specification document, Chapter 5 (Nhóm 5)"
status: "Source of Truth — referenced by PRD & Execution Plan"
date_captured: "2026-06-20"
language: "Vietnamese (original) — preserved verbatim as authoritative source"
related:
  - "product-brief-omnicare-2026-06-20.md"
  - "execution-plan-omnicare.md"
  - "prd.md"

# Sibling modules referenced (integration surface)
integrates_with:
  - "1.1 Customer 360"
  - "7.1 My Công ty App"
  - "9.1 Business Dashboard"
  - "10.1 AI Chatbot"
  - "10.6 AI forecasting"
  - "Field-team Mobile App (Work Orders)"

open_items:
  - "Hotline number discrepancy: dashboard UI shows '1900 1090' while §5.1 states '1900.545.520' — confirm canonical number."
---

# NHÓM 5 — CHĂM SÓC KHÁCH HÀNG ĐA KÊNH (OMNICHANNEL CUSTOMER SERVICE)

**Ưu tiên triển khai:** Ưu tiên 1–2 — Trải nghiệm khách hàng

Khách hàng có thể tiếp xúc với Công ty qua nhiều kênh (Hotline, App, Zalo OA, Email, Web, đến quầy, gửi đơn giấy). Mọi tương tác đều phải được ghi nhận vào một hồ sơ duy nhất, có SLA rõ ràng, có người chịu trách nhiệm rõ ràng, và có thước đo hài lòng để cải tiến.

---

## Tính năng 5.1: Tổng đài tích hợp & Call Center (Hotline 1900.545.520)

### Mục đích
Vận hành Hotline 1900.545.520 chuyên nghiệp 24/7, tích hợp sâu vào CRM và hệ thống vận hành IOC — mỗi cuộc gọi không chỉ được trả lời mà còn được biến thành Work Order, ticket khiếu nại, hoặc bản ghi tương tác trong hồ sơ KH.

### Lợi ích chính
- Mỗi cuộc gọi đến đều có ngữ cảnh đầy đủ KH ngay khi tổng đài viên nhấc máy.
- Định tuyến thông minh — sự cố kỹ thuật về kỹ thuật, hóa đơn về kinh doanh, không qua nhiều cấp.
- Quản lý chất lượng dịch vụ bằng số liệu thực tế thay vì cảm tính.

### Các chức năng con
- **IVR thông minh đa nhánh:** Nhấn 1 báo sự cố; Nhấn 2 tra cứu hóa đơn; Nhấn 3 đăng ký lắp đặt mới; Nhấn 4 khiếu nại; Nhấn 0 gặp tổng đài viên.
- **Định tuyến theo địa bàn KH:** KH ở Cẩm Phả → tổng đài viên thông thạo địa bàn Cẩm Phả (nếu có thể).
- **Pop-up CRM tự động:** khi cuộc gọi đến, màn hình tổng đài viên tự bật hồ sơ KH 360° (theo SĐT gọi đến).
- **Click-to-call ngược lại** từ My Công ty App (KH bấm trong app, hệ thống gọi lại trong < 60 giây — không tốn phí KH).
- **Ghi âm 100% cuộc gọi**, lưu 90 ngày, tổng đài viên không thể tắt ghi âm.
- **KPI Dashboard thời gian thực:** cuộc đang xử lý, cuộc đang chờ, ASA (Average Speed to Answer), AHT (Average Handling Time), tỷ lệ cuộc nhỡ (Abandon Rate), CSAT cuộc gọi.
- **Phân ca tổng đài viên dựa trên AI dự báo lưu lượng** (xem 10.6) — đảm bảo Abandon Rate < 5% kể cả giờ cao điểm.
- **Tự động khảo sát hài lòng cuộc gọi (CSAT)** qua SMS sau cuộc gọi.

### Cải thiện hiệu suất kinh doanh và sự hài lòng khách hàng
Giảm Abandon Rate từ 15–20% xuống < 5%; giảm AHT 30% (nhờ pop-up CRM); tăng First-Call Resolution từ 50% lên 75%.

### Liên kết với các module / phân hệ khác
Đồng bộ với Customer 360 (1.1); tạo ticket vào Quản lý yêu cầu dịch vụ (5.2); tạo Work Order về Mobile App đội hiện trường; đẩy số liệu lên Dashboard kinh doanh (9.1).

---

## Tính năng 5.2: Quản lý yêu cầu dịch vụ và khiếu nại (Service Ticketing & SLA)

### Mục đích
Mỗi yêu cầu của KH (báo sự cố, đăng ký mới, khiếu nại hóa đơn, đề nghị tách hộ, đổi tên chủ hợp đồng…) được mở 1 ticket có ID duy nhất, có SLA cam kết, có người chịu trách nhiệm, có đầy đủ tracking, đến khi đóng ticket bằng xác nhận hài lòng từ KH.

### Lợi ích chính
- Không yêu cầu nào bị "rơi" — mọi ticket đều có chủ và SLA.
- KH luôn biết yêu cầu của mình đang ở giai đoạn nào (giống tracking Grab/Shopee).
- Cung cấp số liệu để tối ưu quy trình: yêu cầu loại nào hay quá hạn, phòng nào hay chậm.

### Các chức năng con
- **Phân loại ticket** theo loại (báo rò rỉ, khiếu nại hóa đơn, đăng ký mới…) và **mức độ ưu tiên** (P0 khẩn cấp, P1 cao, P2 thường, P3 thấp).
- **SLA cấu hình theo loại ticket:** vd P0 báo rò rỉ ngập đường < 1 giờ tiếp nhận + 4 giờ xử lý; P2 đăng ký lắp đặt mới < 24 giờ tiếp nhận + 7 ngày khảo sát.
- **Workflow tự động** chuyển ticket qua các bước: tiếp nhận → phân tích → giao đội → xử lý → xác nhận với KH → đóng ticket.
- Mỗi bước có **cảnh báo gần hết SLA** (vd: còn 30 phút) và **quá SLA** (escalate lên cấp trên).
- Cho phép **KH theo dõi tiến độ ticket** qua My Công ty (mã tra cứu) — không cần gọi hỏi.
- **Lịch sử tương tác đầy đủ** trong ticket: ai làm gì lúc nào, ảnh hiện trường, ghi chú nội bộ vs ghi chú gửi KH.
- **Khảo sát hài lòng tự động khi đóng ticket;** nếu < 3/5 sao thì tự reopen và escalate.

### Cải thiện hiệu suất kinh doanh và sự hài lòng khách hàng
Tăng tỷ lệ tuân thủ SLA từ 60% lên 90%+; giảm 50% tỷ lệ ticket bị KH "gọi nhắc đi nhắc lại"; tăng CSAT chung 1,0–1,5 điểm.

### Liên kết với các module / phân hệ khác
Đầu vào từ Hotline (5.1), My Công ty (7.1), Zalo OA; đầu ra Work Order về Mobile App đội hiện trường; báo cáo lên Dashboard kinh doanh (9.1).

---

## Tính năng 5.3: Đo lường mức hài lòng khách hàng (CSAT, NPS, CES)

### Mục đích
Đo lường có hệ thống trải nghiệm của KH với Công ty — không chỉ ở cấp tổng thể mà ở từng "điểm chạm" (touchpoint): mỗi cuộc gọi, mỗi ticket, mỗi lần sửa chữa, mỗi hóa đơn — để biết chính xác chỗ nào cần cải thiện.

### Lợi ích chính
- Định lượng hóa cảm xúc khách hàng — biến cảm tính thành dữ liệu.
- Phát hiện sớm các vấn đề tiềm ẩn (CSAT giảm theo tuần ở 1 xí nghiệp) trước khi thành khiếu nại đông đảo.
- Cung cấp đầu vào khách quan để đánh giá KPI nhân viên/đội/xí nghiệp.

### Các chức năng con
- **CSAT** gửi sau mỗi tương tác cụ thể: cuộc gọi, ticket đóng, đội hiện trường rời đi.
- **NPS** khảo sát định kỳ 6 tháng/lần với toàn bộ KH: "Anh/chị có sẵn sàng giới thiệu Công ty cho bạn bè không (0–10)?".
- **CES** cho các quy trình quan trọng: "Việc đăng ký lắp đặt mới có dễ dàng không?".
- **Khảo sát đa kênh:** SMS link, Zalo, in-app, email — cho phép KH chọn kênh thuận tiện.
- **Dashboard** hiển thị CSAT/NPS theo thời gian, theo touchpoint, theo địa bàn, theo nhân viên xử lý.
- **Phát hiện "điểm yếu"** trong hành trình KH (Customer Journey) — vd: CSAT khâu thanh toán cao nhưng CSAT khâu lắp đặt mới thấp.
- **Closing the loop:** KH cho điểm < 3/5 được nhân viên CSKH gọi lại tìm hiểu trong 24 giờ — biến phản hồi tiêu cực thành cơ hội khôi phục.

### Cải thiện hiệu suất kinh doanh và sự hài lòng khách hàng
Tăng CSAT toàn công ty 1,0–1,5 điểm trong 12 tháng; nâng NPS từ trung bình (10–30) lên tốt (40+); giảm 40% khiếu nại lặp lại nhờ closing-the-loop.

### Liên kết với các module / phân hệ khác
Thu thập từ tất cả các touchpoint (Hotline 5.1, Ticketing 5.2, My Công ty 7.1); kết quả về Dashboard kinh doanh (9.1) và báo cáo cho Ban Điều hành cấp cao.

---

## Tính năng 5.4: Knowledge Base & FAQ tự phục vụ

### Mục đích
Xây dựng kho tri thức chuẩn về dịch vụ cấp nước Công ty — KH tự tra cứu trên Web/My Công ty trước khi cần gọi tổng đài, tổng đài viên tra cứu nhanh khi KH hỏi câu phức tạp.

### Lợi ích chính
- Giảm khối lượng cuộc gọi hỏi câu cơ bản (cách đọc đồng hồ, cách thanh toán, biểu giá nước) tới 30–40%.
- Câu trả lời chuẩn hóa giữa các tổng đài viên — không có chuyện hỏi 10 lần được 10 câu trả lời khác nhau.
- Đào tạo nhân viên mới nhanh hơn.

### Các chức năng con
- **Bài viết FAQ theo chủ đề:** hóa đơn, ghi chỉ số, sự cố, thanh toán, lắp đặt mới, di dời đồng hồ.
- **Tìm kiếm tiếng Việt thông minh** (xử lý dấu thanh, từ đồng nghĩa).
- **Quy trình quản lý nội dung:** tác giả → biên tập → phê duyệt → xuất bản, có versioning.
- **Đánh giá hữu ích** của bài viết (KH bấm "có ích"/"không ích") — cải tiến liên tục.
- **Liên kết với AI Chatbot (10.1):** Chatbot trả lời từ kho tri thức, đảm bảo nhất quán.

### Cải thiện hiệu suất kinh doanh và sự hài lòng khách hàng
Giảm 30–40% cuộc gọi hỏi câu cơ bản, tăng năng lực tổng đài viên xử lý cuộc gọi phức tạp; rút ngắn thời gian đào tạo nhân viên mới 50%.

### Liên kết với các module / phân hệ khác
Nguồn nội dung cho AI Chatbot (10.1) và Voice Bot; hiển thị trên My Công ty App (7.1) và website Công ty.

---

> **Note (analyst):** This Chapter is the **authoritative business source of truth**. It directly feeds the PRD Functional Requirements (Step 9) and resolves several open items (concrete SLA policies P0–P3, call-recording retention, NPS/CES, closing-the-loop). Per locked `ai_strategy`, AI capabilities (Chatbot 10.1, forecasting 10.6) are **external integrations**, not built in scope; the Knowledge Base CMS + Vietnamese search (§5.4) **is** in build scope and feeds the external chatbot.
