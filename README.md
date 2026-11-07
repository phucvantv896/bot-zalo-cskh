# Bot chăm sóc khách hàng qua Zalo cho shop mỹ phẩm

Bot tự trả lời tin nhắn Zalo của shop: tư vấn sản phẩm theo loại da, báo giá theo bảng giá của shop, nhận thông tin đặt hàng, giải đáp giao hàng và đổi trả. Bot chạy trên VPS của chị, dữ liệu nằm trên máy của chị.

Bot dựa trên khuôn trợ lý Zalo "Phúc Bani" của BANI, đổi sang nghề mỹ phẩm.

---

## 1. Chuẩn bị (làm trước khi cài)

| Cần gì | Ghi chú |
|---|---|
| **VPS Ubuntu 22.04 hoặc 24.04** | Tối thiểu 2 GB RAM, 2 nhân, 20 GB ổ đĩa. Có quyền root. |
| **Một số Zalo RIÊNG cho shop** | Không dùng Zalo cá nhân của chị, vì bot sẽ trả lời MỌI người nhắn riêng vào số đó, kể cả người nhà. |
| **Khoá API của AI** | Gemini: vào aistudio.google.com → Get API key. Hoặc OpenAI: platform.openai.com → API keys. Nên **bật trả phí**: bản miễn phí hay quá tải, bot sẽ im lặng đúng lúc khách hỏi. |
| **Danh sách sản phẩm + chính sách** | Tên, giá, hợp loại da nào, cách dùng; phí ship, đổi trả, thanh toán. |
| Tên miền (không bắt buộc) | Có tên miền thì bảng điều khiển chạy HTTPS an toàn hơn. Trỏ bản ghi A của tên miền về IP VPS trước khi cài. |

## 2. Cài đặt — một lệnh

Đăng nhập VPS (qua SSH), dán lệnh này rồi Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/phucvantv896/bot-zalo-cskh/main/cai.sh | sudo bash
```

Script sẽ hỏi lần lượt: tên shop, tên chủ shop, số hỗ trợ, chọn AI, dán khoá API, tên miền. Chờ 3–10 phút. Cuối cùng màn hình in ra **địa chỉ bảng điều khiển** và **mã đăng nhập**. Lưu kỹ mã này.

## 3. Đăng nhập Zalo cho bot

1. Mở địa chỉ bảng điều khiển trên máy tính, dán mã đăng nhập.
2. Bấm mục **Channel** ở thanh bên trái. Thẻ **Zalo <tên shop>** đang báo "Thất bại · Missing credentials" là bình thường vì chưa đăng nhập.
3. Bấm **biểu tượng mã QR nhỏ ở góc phải trên của thẻ** → hiện "Đăng nhập bằng QR".
4. Mở Zalo của **số shop** trên điện thoại → biểu tượng quét QR → quét. Mã hết hạn sau khoảng 100 giây, hết thì bấm lại biểu tượng.
5. Dùng một số Zalo khác nhắn thử: "Da mình hơi dầu, shop có gì hợp không?"

## 4. Điền sản phẩm (BẮT BUỘC, nếu không bot sẽ không báo giá)

Các file kiến thức nằm ở `/opt/bot-zalo/kien-thuc/`:

| File | Nội dung |
|---|---|
| `01-san-pham.md` | Sản phẩm, giá, hợp da nào, cách dùng. Có khung mẫu sẵn trong file. |
| `02-chinh-sach.md` | Giao hàng, phí ship, thanh toán, đổi trả. |
| `03-cau-hoi-thuong-gap.md` | Câu khách hay hỏi + câu trả lời chị muốn bot nói. |
| `04-luat-noi-ve-my-pham.md` | Từ cấm khi nói về mỹ phẩm. Nên giữ nguyên. |

Điền xong thì **xoá dòng `TRẠNG THÁI: CHƯA ĐIỀN`** ở đầu file, rồi chạy:

```bash
sudo /opt/bot-zalo/nap-bot.sh
```

Sửa bằng lệnh `sudo nano /opt/bot-zalo/kien-thuc/01-san-pham.md` (Ctrl+O lưu, Ctrl+X thoát), hoặc nhờ người hỗ trợ kỹ thuật.

## 5. Bot làm gì và không làm gì

**Làm:** tư vấn theo loại da (hỏi 1–2 câu trước), gợi ý tối đa 2–3 sản phẩm có trong kho, báo giá theo file, hướng dẫn cách dùng, nhận tên + số điện thoại + địa chỉ đặt hàng rồi gửi tin tóm tắt bắt đầu bằng **"📦 ĐƠN MỚI"** để chị dễ tìm trong Zalo.

**Không làm:** không tự xác nhận đơn đã gửi, không hứa hoàn tiền, không bịa giá hay khuyến mãi, không nói "trị mụn / trị nám / trắng sau 7 ngày", không chẩn đoán bệnh da. Khách bị kích ứng, mụn viêm nặng, đang mang thai → bot khuyên hỏi bác sĩ da liễu và chuyển chị xử lý.

Trong **nhóm Zalo**, bot chỉ trả lời khi được nhắc tên (@).

## 6. Cập nhật, sao lưu, sự cố

- **Cập nhật bot**: chạy lại lệnh cài ở mục 2. Kiến thức chị đã sửa, khoá AI và đăng nhập Zalo được giữ nguyên.
- **Sao lưu**: `cd /opt/bot-zalo && sudo docker compose exec postgres pg_dump -U goclaw goclaw > saoluu-$(date +%F).sql`
- **Bot im lặng**: thường do khoá AI hết hạn mức. Xem lỗi: `cd /opt/bot-zalo && sudo docker compose logs --tail 100 goclaw`
- **Zalo bị đăng xuất**: vào bảng điều khiển → Channel → biểu tượng QR trên thẻ Zalo, quét lại.

## 7. Lưu ý quan trọng

- **Zalo cá nhân tự động là cách không chính thức.** Zalo có thể hạn chế hoặc khoá số nếu thấy bất thường. Dùng số riêng cho shop, không dùng bot để nhắn hàng loạt, không spam nhóm. Muốn chính thức thì dùng Zalo OA (cần làm thêm).
- **Giấy phép phần mềm**: bot chạy trên **GoClaw** của nhóm nextlevelbuilder (https://github.com/nextlevelbuilder/goclaw), giấy phép **CC BY-NC 4.0 — không cho phép dùng vào mục đích thương mại**. Dùng cho shop bán hàng là thương mại, nên cần liên hệ tác giả GoClaw xin phép hoặc mua giấy phép trước khi chạy chính thức.
- **Bảo mật**: file `/opt/bot-zalo/.env` chứa khoá AI và mã quản trị. Không gửi file này cho ai.
- Bot có thể trả lời sai. Thỉnh thoảng đọc lại tin bot đã trả lời trong Zalo để sửa kiến thức cho đúng.

---
Phần mềm nền: GoClaw © GoClaw Contributors, CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/). Gói này không sửa mã GoClaw, chỉ thêm cấu hình, hồ sơ bot và script cài.
