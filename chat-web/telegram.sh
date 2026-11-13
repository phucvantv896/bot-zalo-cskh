# telegram.sh — hàm dùng chung cho cai.sh và bat-chat-web.sh (được "source", không chạy riêng).
# cai_telegram: hỏi mã bot Telegram, rồi TỰ DÒ mã chat (chủ shop chỉ cần nhắn bot một câu).
# Kết quả: đặt biến TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID (để trống nếu bỏ qua).
cai_telegram() {
  local tl ma id i ten
  echo
  echo "BÁO VỀ TELEGRAM — mỗi đơn mới và mỗi khách cần tư vấn sẽ báo ngay về điện thoại của chị."
  echo "  1. Mở Telegram, tìm @BotFather, gõ /newbot, đặt tên (vd: Đơn ${TEN_SHOP:-shop}) → nhận MÃ BOT dạng 123456:ABC…"
  ma=$(hoi "  Dán mã bot (bỏ trống để làm sau)" "${TELEGRAM_BOT_TOKEN:-}")
  case "$ma" in *"'"*|*'"'*|*'$'*|*'`'*|*'\'*|*' '*) echo "  Mã bot không hợp lệ, bỏ qua Telegram."; ma="";; esac
  TELEGRAM_BOT_TOKEN="$ma"; TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
  [ -n "$ma" ] || { TELEGRAM_CHAT_ID=""; echo "  → Bỏ qua. Đơn vẫn xem được ở trang quản lý."; return 0; }
  ten=$(curl -fsS -m 15 "https://api.telegram.org/bot$ma/getMe" 2>/dev/null | jq -r '.result.username // empty' || true)
  [ -n "$ten" ] || { echo "  Mã bot sai hoặc máy chủ không vào được Telegram. Bỏ qua, làm lại sau bằng bat-chat-web.sh."; TELEGRAM_BOT_TOKEN=""; TELEGRAM_CHAT_ID=""; return 0; }
  echo "  2. Mở Telegram, vào bot @$ten (https://t.me/$ten), bấm BẮT ĐẦU / gõ chào một câu."
  for i in 1 2 3 4 5 6; do
    hoi "     Nhắn xong thì bấm Enter" "" >/dev/null
    id=$(curl -fsS -m 15 "https://api.telegram.org/bot$ma/getUpdates" 2>/dev/null | jq -r '[.result[]? | (.message // .my_chat_member // .channel_post).chat.id] | last // empty' || true)
    if [ -n "$id" ]; then
      TELEGRAM_CHAT_ID="$id"
      curl -fsS -m 15 -X POST "https://api.telegram.org/bot$ma/sendMessage" -H 'Content-Type: application/json' \
        -d "$(jq -n --arg c "$id" --arg t "✅ Đã nối khung chat website của ${TEN_SHOP:-shop}. Đơn mới và khách cần tư vấn sẽ báo vào đây." '{chat_id:$c, text:$t}')" >/dev/null 2>&1 || true
      echo "  ✔ Đã nối Telegram (mã chat $id) — kiểm tra Telegram có tin \"✅ Đã nối…\""
      return 0
    fi
    echo "     Chưa thấy tin nhắn. Nhắn bot @$ten một câu nữa rồi Enter."
  done
  echo "  Chưa dò được mã chat. Bỏ qua — chạy lại bat-chat-web.sh để thử lại."; TELEGRAM_CHAT_ID=""
}
