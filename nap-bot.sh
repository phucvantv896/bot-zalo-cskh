#!/usr/bin/env bash
# nap-bot.sh — Nạp (hoặc cập nhật) trợ lý vào BANIClaw: nhà cung cấp AI, agent theo MẪU, kho tri thức, kênh Zalo, khung chat web (nếu bật).
# Chạy lại bao nhiêu lần cũng được. Sửa kiến thức trong kien-thuc/ xong thì chạy lại file này.
#   sudo /opt/baniclaw/nap-bot.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Không thấy .env — hãy chạy cai.sh trước."; exit 1; }
set -a; . ./.env; set +a

URL="${GOCLAW_URL:-http://127.0.0.1:${GOCLAW_PORT:-18790}}"
AUTH=(-H "Authorization: Bearer ${GOCLAW_GATEWAY_TOKEN}" -H "X-GoClaw-User-Id: system")
api() { # api METHOD PATH [JSON]
  local m="$1" p="$2" body="${3:-}" out code
  if [ -n "$body" ]; then
    out=$(curl -sS -w '\n%{http_code}' -X "$m" "${AUTH[@]}" -H 'Content-Type: application/json' --data-binary "$body" "$URL$p")
  else
    out=$(curl -sS -w '\n%{http_code}' -X "$m" "${AUTH[@]}" "$URL$p")
  fi
  code=$(printf '%s' "$out" | tail -n1); API_BODY=$(printf '%s' "$out" | sed '$d'); API_CODE=$code
}
xong() { echo "  ✔ $*"; }
loi()  { echo "  ✘ $*" >&2; exit 1; }

echo "== Chờ BANIClaw sẵn sàng ($URL) =="
for i in $(seq 1 90); do curl -fsS "$URL/health" >/dev/null 2>&1 && break; sleep 2; [ "$i" = 90 ] && loi "BANIClaw không lên sau 3 phút. Xem: docker compose logs goclaw"; done
xong "BANIClaw đang chạy"

# ---------- 1. Nhà cung cấp AI ----------
echo "== Nhà cung cấp AI: ${PROVIDER_NAME} (${PROVIDER_TYPE}) =="
api GET /v1/providers
PID=$(printf '%s' "$API_BODY" | jq -r --arg n "$PROVIDER_NAME" '(.providers // .data // .)[]? | select(.name==$n) | .id' | head -n1)
PJSON=$(jq -n --arg n "$PROVIDER_NAME" --arg t "$PROVIDER_TYPE" --arg k "$AI_API_KEY" --arg b "${PROVIDER_API_BASE:-}" \
  '{name:$n, display_name:$n, provider_type:$t, api_key:$k, enabled:true} + (if $b=="" then {} else {api_base:$b} end)')
if [ -z "$PID" ]; then
  api POST /v1/providers "$PJSON"; [[ "$API_CODE" =~ ^20 ]] || loi "Tạo nhà cung cấp lỗi ($API_CODE): $API_BODY"
  PID=$(printf '%s' "$API_BODY" | jq -r '.id'); xong "Đã tạo nhà cung cấp"
else
  api PUT "/v1/providers/$PID" "$PJSON"; [[ "$API_CODE" =~ ^20 ]] || loi "Cập nhật nhà cung cấp lỗi ($API_CODE): $API_BODY"
  xong "Đã cập nhật khoá nhà cung cấp"
fi

# ---------- 2. Dựng hồ sơ bot từ khuôn ----------
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
MAU="${MAU:-ban-hang}"
[ -d "mau/$MAU" ] || loi "Không thấy mẫu trợ lý mau/$MAU (có: $(ls mau | grep -v '^_' | tr '\n' ' '))"
XUNG="${XUNG:-em}"; GOI_KHACH="${GOI_KHACH:-anh/chị}"; NGANH="${NGANH:-kinh doanh}"
GOI_CHU="${GOI_CHU:-${TEN_CHU:-chủ shop}}"
XUNG_HOA="$(printf '%s' "$XUNG" | perl -CSD -Mutf8 -pe '$_=ucfirst')"
export TEN_SHOP TEN_CHU TEN_BOT SDT_HOTRO AGENT_KEY PROVIDER="$PROVIDER_NAME" MODEL NGANH XUNG XUNG_HOA GOI_KHACH GOI_CHU
dien() { perl -MEncode -CSD -pe 's/\{\{(\w+)\}\}/exists $ENV{$1} ? decode_utf8($ENV{$1}) : $&/ge' "$1"; }
mkdir -p "$TMP/goi/context_files" "$TMP/kien-thuc"
dien "mau/$MAU/agent.json" > "$TMP/goi/agent.json"
# Phần chung trước, phần riêng của mẫu đè lên sau (cùng tên tệp thì mẫu thắng).
for f in mau/_chung/context_files/*.md "mau/$MAU"/context_files/*.md; do dien "$f" > "$TMP/goi/context_files/$(basename "$f")"; done
echo "== Mẫu trợ lý: $MAU =="
for f in kien-thuc/*.md; do dien "$f" > "$TMP/kien-thuc/$(basename "$f")"; done
jq -e . "$TMP/goi/agent.json" >/dev/null || loi "agent.json sau khi điền không hợp lệ"
COPYFILE_DISABLE=1 tar -czf "$TMP/goi.tar.gz" -C "$TMP/goi" agent.json context_files

# ---------- 3. Agent ----------
echo "== Agent: ${AGENT_KEY} =="
api GET "/v1/agents/${AGENT_KEY}"
if [ "$API_CODE" = 404 ] || [ "$API_CODE" = 400 ]; then
  RES=$(curl -sS -w '\n%{http_code}' "${AUTH[@]}" -F "file=@$TMP/goi.tar.gz" "$URL/v1/agents/import")
  [[ "$(printf '%s' "$RES" | tail -n1)" =~ ^20 ]] || loi "Nhập agent lỗi: $RES"
  xong "Đã tạo agent mới"
else
  [[ "$API_CODE" =~ ^20 ]] || loi "Đọc agent lỗi ($API_CODE): $API_BODY"
  RES=$(curl -sS -w '\n%{http_code}' "${AUTH[@]}" -F "file=@$TMP/goi.tar.gz" "$URL/v1/agents/${AGENT_KEY}/import?include=context_files")
  [[ "$(printf '%s' "$RES" | tail -n1)" =~ ^20 ]] || loi "Cập nhật hồ sơ agent lỗi: $RES"
  xong "Đã cập nhật hồ sơ agent"
fi
api GET "/v1/agents/${AGENT_KEY}"
AID=$(printf '%s' "$API_BODY" | jq -r '.id')
[ -n "$AID" ] && [ "$AID" != null ] || loi "Không lấy được id agent: $API_BODY"
api PUT "/v1/agents/$AID" "$(jq -n --arg p "$PROVIDER_NAME" --arg m "$MODEL" --arg d "$TEN_BOT" '{provider:$p, model:$m, display_name:$d}')"
[[ "$API_CODE" =~ ^20 ]] || loi "Gán model cho agent lỗi ($API_CODE): $API_BODY"
xong "Agent dùng ${PROVIDER_NAME} / ${MODEL}"

# ---------- 4. Kho tri thức ----------
echo "== Kho tri thức =="
for f in "$TMP"/kien-thuc/*.md; do
  ten=$(basename "$f"); tieude=$(grep -m1 '^# ' "$f" | sed 's/^# //'); [ -n "$tieude" ] || tieude="$ten"
  body=$(jq -n --arg p "kien-thuc/$ten" --arg t "$tieude" --rawfile c "$f" '{path:$p, title:$t, content:$c, doc_type:"note"}')
  api POST "/v1/agents/$AID/vault/documents" "$body"
  [[ "$API_CODE" =~ ^20 ]] || loi "Nạp $ten lỗi ($API_CODE): $API_BODY"
  xong "$ten"
done

# ---------- 5. Kênh Zalo cá nhân (bỏ qua khi KENH_ZALO='' — chỉ dùng chat web) ----------
if [ -n "${KENH_ZALO:-}" ]; then
echo "== Kênh Zalo =="
api GET /v1/channels/instances
CID=$(printf '%s' "$API_BODY" | jq -r --arg n "$KENH_ZALO" '(.instances // .data // .)[]? | select(.name==$n) | .id' | head -n1)
if [ -z "$CID" ]; then
  CJSON=$(jq -n --arg n "$KENH_ZALO" --arg d "Zalo ${TEN_SHOP}" --arg a "$AID" '{
    name:$n, display_name:$d, channel_type:"zalo_personal", agent_id:$a, enabled:true,
    config:{dm_policy:"open", dm_stream:true, group_policy:"open", group_stream:false,
            require_mention:true, mention_mode:"strict", history_limit:50,
            link_preview:true, media_max_mb:20, reaction_level:"off", reasoning_stream:false}}')
  api POST /v1/channels/instances "$CJSON"
  [[ "$API_CODE" =~ ^20 ]] || loi "Tạo kênh Zalo lỗi ($API_CODE): $API_BODY"
  xong "Đã tạo kênh ${KENH_ZALO} — cần quét QR đăng nhập Zalo trên bảng điều khiển"
else
  xong "Kênh ${KENH_ZALO} đã có sẵn (giữ nguyên đăng nhập Zalo)"
fi
fi

# ---------- 6. Khung chat web — TUỲ CHỌN (CHAT_WEB='1' trong .env) ----------
if [ "${CHAT_WEB:-0}" = 1 ]; then
echo "== Khung chat web =="
dat_env() { # dat_env KHOA GIA_TRI → ghi/thay một dòng trong .env (giá trị chỉ gồm chữ, số, _ -)
  local k="$1" v="$2"
  if grep -q "^$k=" .env; then
    perl -i -pe "s/^\Q$k\E=.*/$k='$v'/" .env
  else
    printf "%s='%s'\n" "$k" "$v" >> .env
  fi
}
[ -n "${CHAT_WEB_ADMIN_PASS:-}" ] || { CHAT_WEB_ADMIN_PASS=$(openssl rand -hex 9); dat_env CHAT_WEB_ADMIN_PASS "$CHAT_WEB_ADMIN_PASS"; }
TEN_WH="chat-web-${AGENT_KEY}"
api GET "/v1/webhooks?agent_id=$AID"
[[ "$API_CODE" =~ ^20 ]] || loi "Đọc danh sách webhook lỗi ($API_CODE): $API_BODY"
WID=$(printf '%s' "$API_BODY" | jq -r --arg n "$TEN_WH" '(if type=="array" then . else (.webhooks // .data // []) end)[]? | select(.name==$n and (.revoked|not)) | .id' | head -n1)
DOI_KHOA=0
if [ -z "$WID" ]; then
  api POST /v1/webhooks "$(jq -n --arg n "$TEN_WH" --arg a "$AID" '{name:$n, kind:"llm", agent_id:$a, rate_limit_per_min:120, require_hmac:false, localhost_only:false}')"
  [[ "$API_CODE" =~ ^20 ]] || loi "Tạo cổng chat web lỗi ($API_CODE): $API_BODY"
  dat_env CHAT_WEB_SECRET "$(printf '%s' "$API_BODY" | jq -r '.secret')"; DOI_KHOA=1
  xong "Đã tạo cổng chat web"
elif [ -z "${CHAT_WEB_SECRET:-}" ]; then
  api POST "/v1/webhooks/$WID/rotate"
  [[ "$API_CODE" =~ ^20 ]] || loi "Cấp lại khoá chat web lỗi ($API_CODE): $API_BODY"
  dat_env CHAT_WEB_SECRET "$(printf '%s' "$API_BODY" | jq -r '.secret')"; DOI_KHOA=1
  xong "Đã cấp lại khoá chat web"
else
  xong "Cổng chat web đã có sẵn"
fi
set -a; . ./.env; set +a
if command -v docker >/dev/null && [ -f docker-compose.yml ] && [ "${BO_QUA_DOCKER:-0}" != 1 ]; then
  # up -d tự tạo lại chat-web khi khoá/cấu hình trong .env đổi
  docker compose --profile chat-web up -d chat-web >/dev/null 2>&1 && xong "Khung chat web đang chạy" || echo "  ⚠ Chưa bật được chat-web: docker compose --profile chat-web up -d chat-web"
fi
[ "$DOI_KHOA" = 1 ] && echo "  (khoá cổng chat web đã lưu vào .env — không cần chép tay)"
[ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] && xong "Đơn + khách cần tư vấn báo về Telegram" || echo "  ⚠ Chưa điền TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID → đơn và khách cần tư vấn chỉ xem ở trang /web-chat/quan-ly"
fi

# ---------- 7. Thử hỏi bot ----------
if [ "${BO_QUA_THU:-0}" != 1 ]; then
  echo "== Thử hỏi bot một câu =="
  Q='{"model":"goclaw:'"$AGENT_KEY"'","messages":[{"role":"user","content":"Chào, bên mình có những sản phẩm/dịch vụ gì vậy?"}]}'
  RAW=$(curl -sS -m 120 "${AUTH[@]}" -H "X-GoClaw-Agent-Id: $AGENT_KEY" -H 'Content-Type: application/json' -d "$Q" "$URL/v1/chat/completions" 2>&1 || true)
  ANS=$(printf '%s' "$RAW" | jq -r '.choices[0].message.content // empty' 2>/dev/null || true)
  if [ -n "$ANS" ]; then
    echo "  Bot trả lời: $ANS"
  else
    echo "  ⚠ Bot chưa trả lời được: $(printf '%s' "$RAW" | tr '\n' ' ' | cut -c1-300)"
    case "$RAW" in
      *401*|*invalid_api_key*|*API_KEY_INVALID*) echo "  → Khoá AI sai hoặc chưa kích hoạt. Sửa AI_API_KEY trong .env rồi chạy lại nap-bot.sh." ;;
      *429*|*quota*|*RESOURCE_EXHAUSTED*) echo "  → Khoá AI hết hạn mức. Bật trả phí hoặc chờ hạn mức hồi lại." ;;
    esac
  fi
fi
echo; echo "XONG. Agent: ${AGENT_KEY} · Kênh: ${KENH_ZALO:-(không Zalo)}$([ "${CHAT_WEB:-0}" = 1 ] && echo " + chat web")"
