#!/usr/bin/env bash
# bat-chat-web.sh — BẬT khung chat tư vấn trên website (+ SePay tuỳ chọn) cho BANIClaw ĐÃ CÀI, bằng MỘT lệnh:
#   curl -fsSL https://raw.githubusercontent.com/phucvantv896/bot-zalo-cskh/main/bat-chat-web.sh | sudo bash
# Giữ nguyên trợ lý, kho kiến thức, đăng nhập Zalo. Chạy lại để đổi Zalo/Telegram cũng được.
# Tắt lại: sửa CHAT_WEB='0' trong /opt/baniclaw/.env rồi chạy: cd /opt/baniclaw && docker compose --profile chat-web stop chat-web
set -euo pipefail

REPO="${REPO:-phucvantv896/bot-zalo-cskh}"
NHANH="${NHANH:-main}"
THU_MUC="${THU_MUC:-/opt/baniclaw}"

hoi() {
  local cau="$1" md="${2:-}" tl=""
  if [ -r /dev/tty ] && (: < /dev/tty) 2>/dev/null; then
    if [ -n "$md" ]; then printf '%s [%s]: ' "$cau" "$md" > /dev/tty; else printf '%s: ' "$cau" > /dev/tty; fi
    IFS= read -r tl < /dev/tty || true
  fi
  printf '%s' "${tl:-$md}"
}
sach() { case "$1" in *"'"*|*'"'*|*'$'*|*'`'*|*'\'*) echo "Không dùng ký tự ' \" \$ \` \\ trong câu trả lời." >&2; exit 1;; esac; }
dat_env() { # ghi/thay một dòng KHOA='giá trị' trong .env
  local k="$1" v="$2"
  if grep -q "^$k=" .env; then K="$k" V="$v" perl -i -pe 's/^\Q$ENV{K}\E=.*/$ENV{K}=\x27$ENV{V}\x27/' .env
  else printf "%s='%s'\n" "$k" "$v" >> .env; fi
}

[ "$(id -u)" = 0 ] || { echo "Hãy chạy bằng quyền root: thêm 'sudo' trước lệnh."; exit 1; }
[ -f "$THU_MUC/.env" ] || { echo "Chưa thấy bot ở $THU_MUC. Cài bot trước bằng lệnh cai.sh (lúc cài trả lời 'c' ở câu khung chat website là xong)."; exit 1; }
command -v jq >/dev/null || apt-get install -y -qq jq >/dev/null
cd "$THU_MUC"
set -a; . ./.env; set +a

echo "==== BẬT KHUNG CHAT TƯ VẤN TRÊN WEBSITE cho ${TEN_SHOP:-cửa hàng} ===="
TAM=$(mktemp -d); trap 'rm -rf "$TAM"' EXIT
if [ -n "${NGUON:-}" ]; then cp -R "$NGUON"/. "$TAM"/
else curl -fsSL "https://github.com/$REPO/archive/refs/heads/$NHANH.tar.gz" | tar -xz -C "$TAM" --strip-components=1; fi
if [ -z "${DOMAIN:-}" ]; then
  echo "Bot chưa có tên miền. Website https chỉ gắn được khung chat khi bot có tên miền https."
  D=$(hoi "Tên miền cho bot (vd bot.shopcuachi.vn — trỏ bản ghi A về IP máy chủ này trước; bỏ trống để dùng tạm trang thử)" ""); sach "$D"
  if [ -n "$D" ]; then dat_env DOMAIN "$D"; dat_env GOCLAW_BIND 127.0.0.1; fi
fi
Z=$(hoi "Link Zalo của shop hiện dưới khung chat (vd https://zalo.me/09xxxxxxxx, bỏ trống được)" "${CHAT_WEB_ZALO:-}"); sach "$Z"
dat_env CHAT_WEB_ZALO "$Z"

# SePay (tuỳ chọn): QR chuyển khoản trong khung chat, tiền về tự xác nhận.
case "$(hoi "Bật thanh toán SePay? (c/k)" "$([ -n "${SEPAY_STK:-}" ] && echo c || echo k)")" in
  c|C|co|có|1|y|Y)
    N=$(hoi "Tên ngân hàng theo SePay (vd MBBank, Vietcombank, ACB)" "${SEPAY_NGAN_HANG:-MBBank}"); sach "$N"
    STK=$(hoi "Số tài khoản nhận tiền" "${SEPAY_STK:-}"); sach "$STK"
    TK=$(hoi "Tên chủ tài khoản (in hoa không dấu)" "${SEPAY_TEN_TK:-}"); sach "$TK"
    dat_env SEPAY_NGAN_HANG "$N"; dat_env SEPAY_STK "$STK"; dat_env SEPAY_TEN_TK "$TK"
    [ -n "${SEPAY_WEBHOOK_APIKEY:-}" ] || dat_env SEPAY_WEBHOOK_APIKEY "$(openssl rand -hex 20)"
    grep -q '^SEPAY_MA=' .env || dat_env SEPAY_MA DH ;;
  *) dat_env SEPAY_STK "" ;;
esac

# Telegram: chỉ cần mã bot, mã chat tự dò.
. "$TAM/chat-web/telegram.sh"
cai_telegram
dat_env TELEGRAM_BOT_TOKEN "${TELEGRAM_BOT_TOKEN:-}"; dat_env TELEGRAM_CHAT_ID "${TELEGRAM_CHAT_ID:-}"
dat_env CHAT_WEB 1

echo; echo "Đang cập nhật gói và bật khung chat…"
NGUON="$TAM" bash "$TAM/cai.sh"
