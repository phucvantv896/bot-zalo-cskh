# BANIClaw — trợ lý AI cho doanh nghiệp, cài bằng một lệnh

BANIClaw là bộ cài trợ lý AI do BANI đóng gói **tặng học viên**: trả lời khách trên **Zalo** và **khung chat
tư vấn ngay trên website**, có sẵn **thanh toán SePay** (khách chốt đơn chuyển khoản → hiện mã QR → tiền về tự xác nhận),
báo đơn về **Telegram**. Kiến thức của trợ lý nằm trong vài file chữ, sửa là trợ lý trả lời theo.

## Cần chuẩn bị
- Một **VPS Ubuntu 22.04/24.04** (2 GB RAM trở lên).
- **Khoá API AI**: Google Gemini (aistudio.google.com) hoặc OpenAI. Nên bật trả phí — khoá miễn phí hay hết hạn mức làm trợ lý im lặng.
- Tuỳ chọn: **tên miền** trỏ về IP VPS (bắt buộc nếu gắn khung chat lên website https), **bot Telegram** để nhận báo đơn,
  **tài khoản SePay** (sepay.vn) nếu muốn thu tiền trong khung chat, **một số Zalo riêng** cho cửa hàng.

## Cài từ file zip (cách đang dùng)
1. Chép file `baniclaw-0.1.1.zip` lên VPS (vd bằng lệnh dưới, chạy trên máy tính của bạn — thay IP VPS):
   ```bash
   scp baniclaw-0.1.1.zip root@IP-VPS:/root/
   ```
2. Đăng nhập VPS rồi chạy:
   ```bash
   cd /root && apt-get install -y unzip && unzip -o baniclaw-0.1.1.zip && cd baniclaw-0.1.1 && sudo bash cai.sh
   ```
Gói đã có sẵn ảnh BANIClaw cho VPS Intel/AMD (x86_64 — gần như mọi VPS ở Việt Nam).

## Cài qua mạng (một lệnh)
Đăng nhập VPS, chạy:
```bash
curl -fsSL https://raw.githubusercontent.com/phucvantv896/bot-zalo-cskh/main/cai.sh | sudo bash
```
Máy hỏi lần lượt: tên doanh nghiệp, ngành, tên chủ, **tên đăng nhập của chủ (không dấu, vd `phucbani`)**, mẫu trợ lý,
cách xưng hô, khoá AI, tên miền, Zalo, khung chat website, SePay, Telegram. Cuối cùng in ra địa chỉ bảng điều khiển,
tên đăng nhập và **mã đăng nhập** — lưu kỹ mã này.

## Ba mẫu trợ lý
| Mẫu | Hợp với |
|---|---|
| Bán hàng | shop online, cửa hàng: tư vấn, báo giá, chốt đơn |
| Chăm sóc khách hàng | giải đáp, hướng dẫn dùng, nhận khiếu nại |
| Đặt lịch | spa, salon, phòng khám, lớp học: ghi nhận lịch hẹn để chủ xác nhận |

## Dạy trợ lý
Sửa các file trong `/opt/baniclaw/kien-thuc/` (sản phẩm, chính sách, câu hỏi thường gặp), **xoá dòng
`TRẠNG THÁI: CHƯA ĐIỀN`** khi điền xong, rồi chạy:
```bash
sudo /opt/baniclaw/nap-bot.sh
```
Trợ lý **không tự bịa** giá hay chính sách: thứ gì chưa có trong kho thì nó hẹn "hỏi lại chủ".

## Việc khác
- Bật khung chat website / SePay sau khi đã cài: `curl -fsSL https://raw.githubusercontent.com/phucvantv896/bot-zalo-cskh/main/bat-chat-web.sh | sudo bash`
- Cập nhật bản mới: chạy lại lệnh cài (giữ nguyên dữ liệu, Zalo, kiến thức đã sửa).
- Xem đơn, khách cần tư vấn, hội thoại web, phiếu thanh toán: `https://<tên miền>/web-chat/quan-ly`.

## Lưu ý trung thực
- Số tiền trên mã QR do trợ lý tính theo bảng giá bạn nhập — **kiểm lại đơn trước khi giao hàng**.
- Zalo cá nhân chạy tự động có thể bị Zalo hạn chế. Dùng số riêng cho cửa hàng, đừng dùng số chính.
- Trợ lý là AI, có thể trả lời sai. Ngành liên quan sức khoẻ, tiền bạc, pháp lý: ghi rõ giới hạn trong kho kiến thức và để người thật chốt.

