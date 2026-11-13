#!/usr/bin/env bash
# cai.sh — Cài BANIClaw (trợ lý AI cho doanh nghiệp: Zalo + khung chat tư vấn trên website + thanh toán SePay)
# lên VPS Ubuntu/Debian bằng MỘT lệnh:
#   curl -fsSL https://raw.githubusercontent.com/phucvantv896/bot-zalo-cskh/main/cai.sh | sudo bash
# Hoặc cài từ FILE ZIP (không cần GitHub): chép zip lên VPS, giải nén, rồi trong thư mục đó chạy:
#   sudo bash cai.sh
# Chạy lại lệnh này để CẬP NHẬT (giữ nguyên dữ liệu, đăng nhập Zalo, khoá AI và kien-thuc/ đã sửa).
set -euo pipefail

REPO="${REPO:-phucvantv896/bot-zalo-cskh}"
BAN="${BAN:-v0.1.1}"   # bản phát hành chứa ảnh BANIClaw (mục Releases của repo)
NHANH="${NHANH:-main}"
THU_MUC="${THU_MUC:-/opt/baniclaw}"

hoi() { # hoi "câu hỏi" "mặc định" → in câu trả lời
  local cau="$1" md="${2:-}" tl=""
  if [ -r /dev/tty ] && (: < /dev/tty) 2>/dev/null; then
    if [ -n "$md" ]; then printf '%s [%s]: ' "$cau" "$md" > /dev/tty; else printf '%s: ' "$cau" > /dev/tty; fi
    IFS= read -r tl < /dev/tty || true
  fi
  printf '%s' "${tl:-$md}"
}
sach() { case "$1" in *"'"*|*'"'*|*'$'*|*'`'*|*'\'*) echo "Không dùng ký tự ' \" \$ \` \\ trong câu trả lời." >&2; exit 1;; esac; }
co() { case "$1" in c|C|co|có|Có|1|y|Y) return 0;; *) return 1;; esac; }
khong_dau() { # "Phúc BANI" → "phucbani"
  printf '%s' "$1" | perl -CSD -MUnicode::Normalize -pe '$_=NFD($_); s/\p{Mn}//g; tr/đĐ/dD/; $_=lc; s/[^a-z0-9._-]//g'
}
buoc() { echo; echo "==== $* ===="; }

echo "============================================================"
echo " BỘ CÀI BANIClaw"
echo "============================================================"

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

# Chạy từ thư mục đã giải nén (có mau/ bên cạnh) → cài từ chính thư mục đó.
DAY="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -z "${NGUON:-}" ] && [ -n "$DAY" ] && [ -f "$DAY/mau/_chung/context_files/AGENTS.md" ] && [ "$DAY" != "$THU_MUC" ]; then NGUON="$DAY"; fi
ANH_GOI=""; [ -n "${NGUON:-}" ] && ANH_GOI=$(ls "$NGUON"/baniclaw-anh-*.tar.gz 2>/dev/null | head -n1 || true)

buoc "2/5 Tải gói BANIClaw vào $THU_MUC"
mkdir -p "$THU_MUC"
TAM=$(mktemp -d)
if [ -n "${NGUON:-}" ]; then cp -R "$NGUON"/. "$TAM"/   # cài từ thư mục có sẵn (dùng khi thử)
else curl -fsSL "https://github.com/$REPO/archive/refs/heads/$NHANH.tar.gz" | tar -xz -C "$TAM" --strip-components=1; fi
# Lần đầu: chép hết. Lần sau: chỉ thay mã + mẫu trợ lý, GIỮ kien-thuc/ đã sửa và .env.
for f in docker-compose.yml Caddyfile nap-bot.sh cai.sh bat-chat-web.sh README.md GIAY-PHEP.txt logo-baniclaw.png; do [ -f "$TAM/$f" ] && cp "$TAM/$f" "$THU_MUC/$f"; done
rm -rf "$THU_MUC/mau"; cp -R "$TAM/mau" "$THU_MUC/mau"
rm -rf "$THU_MUC/chat-web"; cp -R "$TAM/chat-web" "$THU_MUC/chat-web"
rm -rf "$TAM"; chmod +x "$THU_MUC/nap-bot.sh" "$THU_MUC/cai.sh" "$THU_MUC/bat-chat-web.sh"
cd "$THU_MUC"

buoc "3/5 Thông tin doanh nghiệp"
if [ -f .env ]; then
  echo "Đã có cấu hình (.env) — dùng lại, không hỏi lại."
else
  TEN_SHOP=${TEN_SHOP:-$(hoi "Tên doanh nghiệp / cửa hàng" "Cửa hàng của tôi")}; sach "$TEN_SHOP"
  NGANH=${NGANH:-$(hoi "Ngành hàng (vd mỹ phẩm, spa, nội thất, khoá học)" "kinh doanh")}; sach "$NGANH"
  TEN_CHU=${TEN_CHU:-$(hoi "Tên chủ (trợ lý sẽ nhắc tên này khi chuyển khách, vd chị Lan)" "chủ cửa hàng")}; sach "$TEN_CHU"
  GOI_Y_ID=$(khong_dau "$TEN_CHU"); [ -n "$GOI_Y_ID" ] || GOI_Y_ID=chu
  CHU_ID=${CHU_ID:-$(hoi "Tên đăng nhập của chủ — KHÔNG DẤU, không cách (vd phucbani)" "$GOI_Y_ID")}
  CHU_ID=$(khong_dau "$CHU_ID"); [ -n "$CHU_ID" ] || CHU_ID=chu
  TEN_BOT=${TEN_BOT:-$(hoi "Tên trợ lý" "Trợ lý $TEN_SHOP")}; sach "$TEN_BOT"
  SDT_HOTRO=${SDT_HOTRO:-$(hoi "Số điện thoại hỗ trợ" "")}; sach "$SDT_HOTRO"
  echo "Chọn mẫu trợ lý:  1) Bán hàng (tư vấn, báo giá, chốt đơn)   2) Chăm sóc khách hàng   3) Đặt lịch (spa, phòng khám, salon…)"
  case "${MAU:-$(hoi "Chọn 1, 2 hoặc 3" "1")}" in 2|cskh) MAU=cskh;; 3|dat-lich) MAU=dat-lich;; *) MAU=ban-hang;; esac
  XUNG=${XUNG:-$(hoi "Trợ lý xưng là" "em")}; sach "$XUNG"
  GOI_KHACH=${GOI_KHACH:-$(hoi "Trợ lý gọi khách là" "anh/chị")}; sach "$GOI_KHACH"
  echo "Chọn AI:  1) Google Gemini (khoá ở aistudio.google.com)   2) OpenAI (khoá ở platform.openai.com)"
  CHON_AI=${CHON_AI:-$(hoi "Chọn 1 hoặc 2" "1")}
  if [ "$CHON_AI" = 2 ]; then
    PROVIDER_NAME=openai; PROVIDER_TYPE=openai_compat; PROVIDER_API_BASE=https://api.openai.com/v1
    MODEL=${MODEL:-$(hoi "Model" "gpt-4.1-mini")}
  else
    PROVIDER_NAME=gemini; PROVIDER_TYPE=gemini_native; PROVIDER_API_BASE=
    MODEL=${MODEL:-$(hoi "Model" "gemini-2.5-flash")}
  fi
  AI_API_KEY=${AI_API_KEY:-$(hoi "Dán khoá API của AI" "")}; sach "$AI_API_KEY"
  [ -n "$AI_API_KEY" ] || { echo "Cần khoá API để trợ lý trả lời được."; exit 1; }
  DOMAIN=${DOMAIN:-$(hoi "Tên miền cho BANIClaw (vd ai.cuahang.vn — trỏ bản ghi A về IP máy này trước; bỏ trống nếu chưa có)" "")}; sach "$DOMAIN"

  KENH_ZALO=""
  if co "${ZALO:-$(hoi "Gắn trợ lý vào một số Zalo cá nhân? (c/k)" "c")}"; then KENH_ZALO=zalo-chinh; fi

  echo "Khung chat tư vấn trên website: khách chat với trợ lý ngay trên web, để lại số khi cần, đơn báo về Telegram."
  CHAT_WEB=0; co "${CHAT_WEB_BAT:-$(hoi "Bật khung chat website? (c/k)" "c")}" && CHAT_WEB=1
  CHAT_WEB_ZALO=""; TELEGRAM_BOT_TOKEN=""; TELEGRAM_CHAT_ID=""
  SEPAY_NGAN_HANG=""; SEPAY_STK=""; SEPAY_TEN_TK=""; SEPAY_WEBHOOK_APIKEY=""
  if [ "$CHAT_WEB" = 1 ]; then
    [ -n "$DOMAIN" ] || echo "  Lưu ý: website https chỉ gắn được khung chat khi BANIClaw có tên miền. Chưa có thì tạm dùng trang thử."
    CHAT_WEB_ZALO=$(hoi "Link Zalo hiện dưới khung chat (vd https://zalo.me/09xxxxxxxx, bỏ trống được)" ""); sach "$CHAT_WEB_ZALO"
    echo "TUỲ CHỌN thanh toán SePay: khách chốt đơn chuyển khoản → khung chat hiện mã QR, tiền về tự xác nhận (cần tài khoản sepay.vn)."
    if co "$(hoi "Bật thanh toán SePay? (c/k)" "k")"; then
      SEPAY_NGAN_HANG=$(hoi "Tên ngân hàng theo SePay (vd MBBank, Vietcombank, ACB, TPBank)" "MBBank"); sach "$SEPAY_NGAN_HANG"
      SEPAY_STK=$(hoi "Số tài khoản nhận tiền" ""); sach "$SEPAY_STK"
      SEPAY_TEN_TK=$(hoi "Tên chủ tài khoản (in hoa không dấu)" ""); sach "$SEPAY_TEN_TK"
      SEPAY_WEBHOOK_APIKEY=$(openssl rand -hex 20)
    fi
    . ./chat-web/telegram.sh; cai_telegram   # chỉ cần mã bot, mã chat tự dò
  fi
  if [ -n "$DOMAIN" ]; then GOCLAW_BIND=127.0.0.1; else GOCLAW_BIND=0.0.0.0; fi
  umask 077
  cat > .env <<ENV
# Cấu hình BANIClaw — GIỮ BÍ MẬT file này (có khoá AI và mật khẩu quản trị).
TEN_SHOP='$TEN_SHOP'
NGANH='$NGANH'
TEN_CHU='$TEN_CHU'
GOI_CHU='$TEN_CHU'
CHU_ID='$CHU_ID'
TEN_BOT='$TEN_BOT'
SDT_HOTRO='$SDT_HOTRO'
MAU='$MAU'
XUNG='$XUNG'
GOI_KHACH='$GOI_KHACH'
AGENT_KEY='tro-ly'
# Để trống = không dùng Zalo (chỉ chat web)
KENH_ZALO='$KENH_ZALO'
PROVIDER_NAME='$PROVIDER_NAME'
PROVIDER_TYPE='$PROVIDER_TYPE'
PROVIDER_API_BASE='$PROVIDER_API_BASE'
MODEL='$MODEL'
AI_API_KEY='$AI_API_KEY'
DOMAIN='$DOMAIN'
GOCLAW_BIND='$GOCLAW_BIND'
GOCLAW_PORT='18790'
BANICLAW_IMAGE='ghcr.io/phucvantv896/baniclaw:latest'
# --- Khung chat tư vấn website: CHAT_WEB='1' là bật. Đổi xong chạy lại nap-bot.sh.
# CHAT_WEB_SECRET do nap-bot.sh tự điền. Chỉ cho website của mình dùng khung chat:
# CHAT_WEB_ORIGINS='https://cuahang.vn,https://www.cuahang.vn'
CHAT_WEB='$CHAT_WEB'
CHAT_WEB_ORIGINS='*'
CHAT_WEB_MAU='#D10201'
CHAT_WEB_XUNG='$XUNG'
CHAT_WEB_GOI_KHACH='$GOI_KHACH'
CHAT_WEB_ZALO='$CHAT_WEB_ZALO'
CHAT_WEB_ADMIN_PASS='$(openssl rand -hex 9)'
CHAT_WEB_PORT='18791'
# --- Thanh toán SePay trong khung chat (SEPAY_STK trống = tắt)
SEPAY_NGAN_HANG='$SEPAY_NGAN_HANG'
SEPAY_STK='$SEPAY_STK'
SEPAY_TEN_TK='$SEPAY_TEN_TK'
SEPAY_MA='DH'
SEPAY_WEBHOOK_APIKEY='$SEPAY_WEBHOOK_APIKEY'
# Báo đơn + khách cần tư vấn + tiền về từ chat web về Telegram
TELEGRAM_BOT_TOKEN='$TELEGRAM_BOT_TOKEN'
TELEGRAM_CHAT_ID='$TELEGRAM_CHAT_ID'
GOCLAW_GATEWAY_TOKEN='$(openssl rand -hex 24)'
GOCLAW_ENCRYPTION_KEY='$(openssl rand -hex 32)'
POSTGRES_PASSWORD='$(openssl rand -hex 16)'
ENV
  umask 022
  echo "Đã lưu cấu hình vào $THU_MUC/.env"
fi
set -a; . ./.env; set +a
# kho tri thức lấy từ mẫu đã chọn — chỉ chép lần đầu, lần sau giữ bản đã sửa
if [ ! -d kien-thuc ]; then cp -R "mau/${MAU:-ban-hang}/kien-thuc" kien-thuc; else echo "Giữ nguyên kien-thuc/ đang có."; fi

buoc "4/5 Khởi động BANIClaw (lần đầu tải khoảng 1 GB, chờ vài phút)"
HO_SO=(); [ -n "${DOMAIN:-}" ] && HO_SO+=(--profile https); [ "${CHAT_WEB:-0}" = 1 ] && HO_SO+=(--profile chat-web)
ANH_BAN="ghcr.io/phucvantv896/baniclaw:${BAN#v}"
if [ -z "$ANH_GOI" ] && docker image inspect "$ANH_BAN" >/dev/null 2>&1; then
  echo "Ảnh BANIClaw $BAN đã có sẵn trên máy — bỏ qua tải."
  DA_CO_ANH=1
  if grep -q '^BANICLAW_IMAGE=' .env; then sed -i "s#^BANICLAW_IMAGE=.*#BANICLAW_IMAGE='$ANH_BAN'#" .env; else echo "BANICLAW_IMAGE='$ANH_BAN'" >> .env; fi
  export BANICLAW_IMAGE="$ANH_BAN"
  [ "${BO_QUA_PULL:-0}" = 1 ] || docker compose "${HO_SO[@]}" pull -q postgres $([ "${CHAT_WEB:-0}" = 1 ] && echo chat-web) $([ -n "${DOMAIN:-}" ] && echo caddy)
elif [ -z "$ANH_GOI" ] && [ "${BO_QUA_PULL:-0}" != 1 ]; then
  # Cài qua mạng: tải ảnh BANIClaw từ mục Releases của repo (~90 MB)
  ANH_GOI=/tmp/baniclaw-anh-amd64.tar.gz
  echo "Tải ảnh BANIClaw ($BAN, ~90 MB)..."
  curl -fL --retry 3 -o "$ANH_GOI" "https://github.com/$REPO/releases/download/$BAN/baniclaw-anh-amd64.tar.gz" || { echo "Không tải được ảnh BANIClaw. Kiểm tra mạng rồi chạy lại."; exit 1; }
fi
if [ -n "$ANH_GOI" ]; then
  [ "$(uname -m)" = x86_64 ] || echo "  ⚠ Ảnh trong gói dành cho máy x86_64 (Intel/AMD); VPS này là $(uname -m), có thể không chạy."
  echo "Nạp ảnh BANIClaw có sẵn trong gói: $(basename "$ANH_GOI")"
  TEN_ANH=$(gunzip -c "$ANH_GOI" | docker load | sed -n 's/^Loaded image: //p' | tail -n1)
  [ -n "$TEN_ANH" ] || { echo "Không nạp được ảnh từ $ANH_GOI"; exit 1; }
  if grep -q '^BANICLAW_IMAGE=' .env; then sed -i "s#^BANICLAW_IMAGE=.*#BANICLAW_IMAGE='$TEN_ANH'#" .env; else echo "BANICLAW_IMAGE='$TEN_ANH'" >> .env; fi
  export BANICLAW_IMAGE="$TEN_ANH"
  # các ảnh phụ (postgres, node, caddy) vẫn tải từ mạng
  [ "${BO_QUA_PULL:-0}" = 1 ] || docker compose "${HO_SO[@]}" pull -q postgres $([ "${CHAT_WEB:-0}" = 1 ] && echo chat-web) $([ -n "${DOMAIN:-}" ] && echo caddy)
elif [ -z "${DA_CO_ANH:-}" ]; then
  [ "${BO_QUA_PULL:-0}" = 1 ] || docker compose "${HO_SO[@]}" pull -q
fi
docker compose "${HO_SO[@]}" up -d
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  if [ -n "${DOMAIN:-}" ]; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; else ufw allow 18790/tcp >/dev/null; [ "${CHAT_WEB:-0}" = 1 ] && ufw allow 18791/tcp >/dev/null; fi
fi

buoc "5/5 Nạp trợ lý, kho tri thức$([ -n "${KENH_ZALO:-}" ] && echo ", kênh Zalo")$([ "${CHAT_WEB:-0}" = 1 ] && echo ", khung chat web")"
./nap-bot.sh
set -a; . ./.env; set +a   # nạp lại: nap-bot.sh vừa ghi khoá chat web

IP=$(curl -fsS -4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
if [ -n "${DOMAIN:-}" ]; then BANG="https://$DOMAIN"; CHAT="https://$DOMAIN/web-chat"; else BANG="http://$IP:18790"; CHAT="http://$IP:18791/web-chat"; fi
cat <<XONG

============================================================
 CÀI XONG BANIClaw.
 Bảng điều khiển  : $BANG
 Tên đăng nhập    : $CHU_ID
 Mã đăng nhập     : $GOCLAW_GATEWAY_TOKEN
   (lưu kỹ mã này — ai có mã là vào quản trị được toàn bộ)

 Sửa sản phẩm, giá, chính sách: sửa file trong $THU_MUC/kien-thuc/
 (xoá dòng "TRẠNG THÁI: CHƯA ĐIỀN" khi điền xong) rồi chạy:
     sudo $THU_MUC/nap-bot.sh
============================================================
XONG
if [ -n "${KENH_ZALO:-}" ]; then cat <<ZALO
 ĐĂNG NHẬP ZALO CHO TRỢ LÝ:
  1. Mở bảng điều khiển, đăng nhập bằng tên + mã ở trên.
  2. Mục "Kênh" bên trái → thẻ Zalo → bấm biểu tượng mã QR nhỏ góc phải.
  3. Mở Zalo trên điện thoại của SỐ ZALO DÙNG CHO TRỢ LÝ, quét mã (hết hạn sau ~100 giây).
  4. Nhắn thử từ một số khác.
  ⚠ Zalo cá nhân chạy tự động có thể bị Zalo hạn chế — nên dùng số riêng cho cửa hàng.
============================================================
ZALO
fi
if [ "${CHAT_WEB:-0}" = 1 ]; then cat <<CHATWEB
 KHUNG CHAT TƯ VẤN TRÊN WEBSITE (đã bật):
  Trang thử + mã nhúng : $CHAT/
  Đơn + khách cần tư vấn + hội thoại: $CHAT/quan-ly
     (tên: chu · mật khẩu: $CHAT_WEB_ADMIN_PASS)
  Gắn lên website: dán một dòng này vào cuối trang (trước </body>):
    <script src="$CHAT/chat.js" async></script>
============================================================
CHATWEB
fi
if [ -n "${SEPAY_STK:-}" ]; then cat <<SEPAY
 THANH TOÁN SePay (đã bật) — việc cần làm MỘT LẦN trên my.sepay.vn:
  Tích hợp → Webhooks → Thêm webhook:
    Sự kiện       : Có tiền vào
    URL           : $CHAT/sepay/webhook
    Kiểu xác thực : API Key
    API Key       : $SEPAY_WEBHOOK_APIKEY
  Lưu ý: số tiền trên mã QR do trợ lý tính theo bảng giá — kiểm lại đơn trước khi giao hàng.
============================================================
SEPAY
fi
