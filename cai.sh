#!/usr/bin/env bash
# cai.sh — Cài bot chăm sóc khách hàng Zalo lên VPS Ubuntu/Debian bằng MỘT lệnh:
#   curl -fsSL https://raw.githubusercontent.com/phucvantv896/bot-zalo-cskh/main/cai.sh | sudo bash
# Chạy lại lệnh này để CẬP NHẬT (giữ nguyên dữ liệu, đăng nhập Zalo và khoá AI).
set -euo pipefail

REPO="${REPO:-phucvantv896/bot-zalo-cskh}"
NHANH="${NHANH:-main}"
THU_MUC="${THU_MUC:-/opt/bot-zalo}"

hoi() { # hoi "câu hỏi" "mặc định" → in câu trả lời
  local cau="$1" md="${2:-}" tl=""
  if [ -r /dev/tty ]; then
    if [ -n "$md" ]; then printf '%s [%s]: ' "$cau" "$md" > /dev/tty; else printf '%s: ' "$cau" > /dev/tty; fi
    IFS= read -r tl < /dev/tty || true
  fi
  printf '%s' "${tl:-$md}"
}
sach() { case "$1" in *"'"*|*'"'*|*'$'*|*'`'*|*'\'*) echo "Không dùng ký tự ' \" \$ \` \\ trong câu trả lời." >&2; exit 1;; esac; }
buoc() { echo; echo "==== $* ===="; }

[ "$(id -u)" = 0 ] || { echo "Hãy chạy bằng quyền root: thêm 'sudo' trước lệnh."; exit 1; }
command -v apt-get >/dev/null || { echo "Script này dành cho Ubuntu hoặc Debian."; exit 1; }

buoc "1/5 Cài công cụ cần thiết"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl jq perl openssl ca-certificates tar >/dev/null
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  echo "Cài Docker (mất vài phút)..."
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
echo "Docker: $(docker --version)"

buoc "2/5 Tải gói bot vào $THU_MUC"
mkdir -p "$THU_MUC"
TAM=$(mktemp -d)
if [ -n "${NGUON:-}" ]; then cp -R "$NGUON"/. "$TAM"/   # cài từ thư mục có sẵn (dùng khi thử)
else curl -fsSL "https://github.com/$REPO/archive/refs/heads/$NHANH.tar.gz" | tar -xz -C "$TAM" --strip-components=1; fi
# Lần đầu: chép hết. Lần sau: chỉ thay mã + hồ sơ bot, GIỮ kien-thuc/ chị đã sửa và .env.
for f in docker-compose.yml nap-bot.sh cai.sh README.md; do cp "$TAM/$f" "$THU_MUC/$f"; done
rm -rf "$THU_MUC/bot"; cp -R "$TAM/bot" "$THU_MUC/bot"
if [ ! -d "$THU_MUC/kien-thuc" ]; then cp -R "$TAM/kien-thuc" "$THU_MUC/kien-thuc"; else echo "Giữ nguyên kien-thuc/ đang có."; fi
rm -rf "$TAM"; chmod +x "$THU_MUC/nap-bot.sh" "$THU_MUC/cai.sh"
cd "$THU_MUC"

buoc "3/5 Thông tin shop"
if [ -f .env ]; then
  echo "Đã có cấu hình (.env) — dùng lại, không hỏi lại."
else
  TEN_SHOP=${TEN_SHOP:-$(hoi "Tên shop" "Giang Beauty")}; sach "$TEN_SHOP"
  TEN_CHU=${TEN_CHU:-$(hoi "Tên chủ shop (bot gọi là chị ...)" "Giang")}; sach "$TEN_CHU"
  TEN_BOT=${TEN_BOT:-$(hoi "Tên trợ lý" "Trợ lý $TEN_SHOP")}; sach "$TEN_BOT"
  SDT_HOTRO=${SDT_HOTRO:-$(hoi "Số điện thoại hỗ trợ" "")}; sach "$SDT_HOTRO"
  echo "Chọn AI cho bot:  1) Google Gemini (khoá ở aistudio.google.com)   2) OpenAI (khoá ở platform.openai.com)"
  CHON_AI=${CHON_AI:-$(hoi "Chọn 1 hoặc 2" "1")}
  if [ "$CHON_AI" = 2 ]; then
    PROVIDER_NAME=openai; PROVIDER_TYPE=openai_compat; PROVIDER_API_BASE=https://api.openai.com/v1
    MODEL=${MODEL:-$(hoi "Model" "gpt-4.1-mini")}
  else
    PROVIDER_NAME=gemini; PROVIDER_TYPE=gemini_native; PROVIDER_API_BASE=
    MODEL=${MODEL:-$(hoi "Model" "gemini-2.5-flash")}
  fi
  AI_API_KEY=${AI_API_KEY:-$(hoi "Dán khoá API của AI" "")}; sach "$AI_API_KEY"
  [ -n "$AI_API_KEY" ] || { echo "Cần khoá API để bot trả lời được."; exit 1; }
  DOMAIN=${DOMAIN:-$(hoi "Tên miền cho bảng điều khiển (vd bot.shopcuachi.vn, bỏ trống nếu chưa có)" "")}; sach "$DOMAIN"
  if [ -n "$DOMAIN" ]; then GOCLAW_BIND=127.0.0.1; else GOCLAW_BIND=0.0.0.0; fi
  umask 077
  cat > .env <<ENV
# Cấu hình bot — GIỮ BÍ MẬT file này (có khoá AI và mật khẩu quản trị).
TEN_SHOP='$TEN_SHOP'
TEN_CHU='$TEN_CHU'
TEN_BOT='$TEN_BOT'
SDT_HOTRO='$SDT_HOTRO'
AGENT_KEY='cskh-shop'
KENH_ZALO='zalo-shop'
PROVIDER_NAME='$PROVIDER_NAME'
PROVIDER_TYPE='$PROVIDER_TYPE'
PROVIDER_API_BASE='$PROVIDER_API_BASE'
MODEL='$MODEL'
AI_API_KEY='$AI_API_KEY'
DOMAIN='$DOMAIN'
GOCLAW_BIND='$GOCLAW_BIND'
GOCLAW_PORT='18790'
GOCLAW_IMAGE_TAG='v3.14.0'
GOCLAW_GATEWAY_TOKEN='$(openssl rand -hex 24)'
GOCLAW_ENCRYPTION_KEY='$(openssl rand -hex 32)'
POSTGRES_PASSWORD='$(openssl rand -hex 16)'
ENV
  umask 022
  echo "Đã lưu cấu hình vào $THU_MUC/.env"
fi
set -a; . ./.env; set +a

buoc "4/5 Khởi động bot (lần đầu tải khoảng 1 GB, chờ vài phút)"
HO_SO=(); [ -n "${DOMAIN:-}" ] && HO_SO=(--profile https)
docker compose "${HO_SO[@]}" pull -q
docker compose "${HO_SO[@]}" up -d
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  if [ -n "${DOMAIN:-}" ]; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; else ufw allow 18790/tcp >/dev/null; fi
fi

buoc "5/5 Nạp hồ sơ bot, kho tri thức, kênh Zalo"
./nap-bot.sh

IP=$(curl -fsS -4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
if [ -n "${DOMAIN:-}" ]; then BANG="https://$DOMAIN"; else BANG="http://$IP:18790"; fi
cat <<XONG

============================================================
 CÀI XONG.
 Bảng điều khiển : $BANG
 Mã đăng nhập    : $GOCLAW_GATEWAY_TOKEN
   (lưu kỹ mã này, ai có mã là vào quản trị được bot)

 VIỆC CÒN LẠI — đăng nhập Zalo cho bot:
  1. Mở bảng điều khiển, dán mã đăng nhập ở trên.
  2. Bấm mục "Channel" bên trái, trên thẻ Zalo của shop bấm
     biểu tượng mã QR nhỏ ở góc phải.
  3. Mở Zalo trên điện thoại của SỐ ZALO SHOP, quét mã QR (hết hạn sau ~100 giây).
  4. Nhắn thử vào số Zalo đó từ một số khác để xem bot trả lời.

 Sửa sản phẩm, giá, chính sách: sửa file trong $THU_MUC/kien-thuc/
 rồi chạy:   sudo $THU_MUC/nap-bot.sh
============================================================
XONG
