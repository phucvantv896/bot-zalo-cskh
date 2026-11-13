// chat-web — MÔ-ĐUN TUỲ CHỌN của BANIClaw: khung chat tư vấn nhúng vào website, dùng bất kỳ trợ lý nào của BANIClaw.
// TUỲ CHỌN thanh toán SePay: bot chèn [[THANH_TOAN: số tiền]] → máy chủ tạo mã đơn + QR VietQR trong khung chat
//   → SePay gọi /web-chat/sepay/webhook khi tiền về → đơn chuyển "đã thanh toán" + báo Telegram.
// Không cần thư viện ngoài (Node 20+). Không sửa hồ sơ agent: luật riêng của kênh web được chèn
// ở đây (DAN_KENH_WEB), nên bot Zalo vẫn nguyên như cũ.
//
//   Khách chat TRƯỚC, thông tin xin SAU (chỉ khi cần):
//   Trình duyệt ──► /web-chat/api/chat ──► BANIClaw POST /v1/webhooks/llm (session_key giữ mạch)
//                                    ├──► bot gửi "📦 ĐƠN MỚI"   → don-hang.jsonl  + Telegram
//                                    └──► bot gửi "🙋 CẦN TƯ VẤN" → can-tu-van.jsonl + Telegram (kèm đoạn chat)
//   Nút "Nhờ shop gọi lại" ──► /web-chat/api/lien-he ──► can-tu-van.jsonl + Telegram
//
// Khoá webhook (CHAT_WEB_SECRET) chỉ nằm ở máy chủ, trình duyệt không bao giờ thấy.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const E = process.env;
const CFG = {
  port: Number(E.PORT || 8080),
  goclaw: (E.GOCLAW_URL || 'http://goclaw:18790').replace(/\/$/, ''),
  secret: E.CHAT_WEB_SECRET || '',
  agentKey: E.AGENT_KEY || 'tro-ly',
  tenShop: E.TEN_SHOP || 'Shop',
  tenBot: E.TEN_BOT || 'Trợ lý',
  tenChu: E.TEN_CHU || 'chủ shop',
  // Xưng hô: mặc định bot "em", khách "anh/chị". Đổi bằng CHAT_WEB_XUNG / CHAT_WEB_GOI_KHACH (cai.sh tự điền).
  xung: E.CHAT_WEB_XUNG || 'em',
  khach: E.CHAT_WEB_GOI_KHACH || 'anh/chị',
  goiChu: E.CHAT_WEB_GOI_CHU || E.TEN_CHU || 'chủ shop',
  sdt: E.SDT_HOTRO || '',
  zalo: E.CHAT_WEB_ZALO || '',
  mau: /^#[0-9a-fA-F]{6}$/.test(E.CHAT_WEB_MAU || '') ? E.CHAT_WEB_MAU : '#D10201',
  loiChao: E.CHAT_WEB_LOI_CHAO || '',
  origins: (E.CHAT_WEB_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean),
  adminPass: E.CHAT_WEB_ADMIN_PASS || '',
  tgToken: E.TELEGRAM_BOT_TOKEN || '',
  tgChat: E.TELEGRAM_CHAT_ID || '',
  tgApi: (E.TELEGRAM_API_URL || 'https://api.telegram.org').replace(/\/$/, ''), // chỉ đổi khi chạy thử
  data: E.DATA_DIR || '/data',
  perMin: Number(E.CHAT_WEB_GIOI_HAN_PHUT || 12),
  perDay: Number(E.CHAT_WEB_GIOI_HAN_NGAY || 300),
  // SePay (tuỳ chọn): SEPAY_STK + SEPAY_NGAN_HANG có giá trị là bật.
  spNh: (E.SEPAY_NGAN_HANG || '').trim(),
  spStk: (E.SEPAY_STK || '').replace(/\s/g, ''),
  spTen: (E.SEPAY_TEN_TK || '').trim(),
  spMa: ((E.SEPAY_MA || 'DH').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'DH').slice(0, 6),
  spKey: E.SEPAY_WEBHOOK_APIKEY || '',
};
const SEPAY = Boolean(CFG.spNh && CFG.spStk);
const PUB = path.join(__dirname, 'public');
const HOA = t => t.charAt(0).toUpperCase() + t.slice(1);
const B = CFG.xung, K = CFG.khach;
const PREFIX = '/web-chat';
fs.mkdirSync(CFG.data, { recursive: true });

// Dặn thêm cho bot khi khách nhắn từ web (chèn vào lời dặn hệ thống, khách không thấy).
const DAN_KENH_WEB = `Kênh hiện tại: KHUNG CHAT TRÊN WEBSITE của ${CFG.tenShop} (không phải Zalo). Khách trên web là người lạ: shop CHƯA có số điện thoại hay Zalo của khách.

CHAT TRƯỚC, XIN THÔNG TIN SAU:
- KHÔNG hỏi tên hay số điện thoại ngay từ đầu. Cứ tư vấn bình thường trước.
- Chỉ xin thông tin liên hệ ở HAI lúc dưới đây.

1) KHÁCH MUỐN MUA: xin tên, SỐ ĐIỆN THOẠI, địa chỉ giao hàng; đọc lại số điện thoại để khách kiểm tra. Khách xác nhận xong thì gửi tin tóm tắt mở đầu bằng dòng "📦 ĐƠN MỚI" (sản phẩm + số lượng, người nhận, SĐT, địa chỉ, cách thanh toán).

2) KHÁCH CẦN NGƯỜI TƯ VẤN THÊM — khi có một trong các dấu hiệu:
   - đã tư vấn mà khách vẫn phân vân, không chọn được sản phẩm;
   - khách hỏi điều kho tri thức không có (giá riêng, hàng chưa có, mua sỉ, hợp tác…);
   - trường hợp của khách cần người hiểu nghề xem kỹ, hoặc khách phàn nàn, muốn đổi trả, hoàn tiền;
   - khách muốn nói chuyện với người thật.
   Khi đó mời khách: "Để ${CFG.goiChu} tư vấn kỹ hơn, ${K} cho ${B} xin tên và số điện thoại (hoặc Zalo) nhé?".
   Khách cho rồi thì gửi tin mở đầu bằng dòng "🙋 CẦN TƯ VẤN" gồm: tên, SĐT/Zalo, giờ tiện gọi (nếu khách nói), tình trạng/nhu cầu của khách, các sản phẩm hoặc gói khách đang phân vân, câu khách còn vướng. Rồi báo khách ${CFG.goiChu} sẽ liên hệ sớm.
   Khách không muốn để lại số thì thôi, không ép; đưa số điện thoại${CFG.zalo ? ' và Zalo' : ''} của shop để khách tự liên hệ.

- Mỗi cuộc chat chỉ gửi "🙋 CẦN TƯ VẤN" một lần (trừ khi khách đổi số). Đã có "📦 ĐƠN MỚI" thì không cần gửi "🙋 CẦN TƯ VẤN".
${SEPAY ? `- THANH TOÁN CHUYỂN KHOẢN: khi khách đã xác nhận đơn và chọn chuyển khoản, ở CUỐI tin "📦 ĐƠN MỚI" thêm một dòng riêng đúng dạng [[THANH_TOAN: <tổng tiền, chỉ chữ số, đơn vị đồng>]], ví dụ [[THANH_TOAN: 350000]]. Hệ thống tự hiện mã QR, số tài khoản và nội dung chuyển khoản cho khách, ${B} KHÔNG tự gõ số tài khoản. Tổng tiền phải tính đúng theo bảng giá trong kho tri thức; chưa chắc tổng (vd phí ship chưa rõ, giá "liên hệ") thì KHÔNG thêm dòng này mà hẹn ${CFG.goiChu} báo tổng.
- Không xin số thẻ, mật khẩu hay mã OTP trong khung chat.` : '- Không xin khách chuyển khoản, số thẻ, mật khẩu hay mã OTP trong khung chat.'}
- Khung chat hiển thị được **chữ đậm**, gạch đầu dòng, đường link; không dùng bảng, không dùng tiêu đề #.`;

// ---------- tiện ích ----------
const now = () => new Date();
const ngay = d => d.toISOString().slice(0, 10);
const SDT_HOP_LE = s => /^(\+?84|0)\d{8,10}$/.test(String(s).replace(/[\s.\-()]/g, ''));
function guiJSON(res, code, obj, extra = {}) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(b);
}
function docBody(req, max = 16 * 1024) {
  return new Promise((ok, fail) => {
    let n = 0; const parts = [];
    req.on('data', c => { n += c.length; if (n > max) { fail(new Error('quá lớn')); req.destroy(); } else parts.push(c); });
    req.on('end', () => ok(Buffer.concat(parts).toString('utf8')));
    req.on('error', fail);
  });
}
function ipKhach(req) {
  const sock = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  // Chỉ tin X-Forwarded-For khi yêu cầu đi qua Caddy trong mạng docker (địa chỉ nội bộ).
  const noiBo = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$)/.test(sock);
  return noiBo && xff ? xff : sock;
}
function cors(req, res) {
  const o = req.headers.origin;
  if (!o) return true;
  const ok = CFG.origins.includes('*') || CFG.origins.some(a => a.replace(/\/$/, '') === o);
  if (!ok) return false;
  res.setHeader('Access-Control-Allow-Origin', CFG.origins.includes('*') ? '*' : o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  return true;
}
function ghiDong(file, obj) {
  fs.appendFile(path.join(CFG.data, file), JSON.stringify(obj) + '\n', () => {});
}
function docDong(file) {
  try {
    return fs.readFileSync(path.join(CFG.data, file), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- giới hạn tần suất theo IP (chống phá, chống tốn tiền AI) ----------
const dem = new Map(); // ip -> {phut, nPhut, ngay, nNgay}
function choPhep(ip) {
  const t = now(); const phut = Math.floor(t.getTime() / 60000); const d = ngay(t);
  let r = dem.get(ip);
  if (!r) { r = { phut, nPhut: 0, ngay: d, nNgay: 0 }; dem.set(ip, r); }
  if (r.phut !== phut) { r.phut = phut; r.nPhut = 0; }
  if (r.ngay !== d) { r.ngay = d; r.nNgay = 0; }
  if (r.nPhut >= CFG.perMin || r.nNgay >= CFG.perDay) return false;
  r.nPhut++; r.nNgay++; return true;
}
setInterval(() => { const p = Math.floor(Date.now() / 60000); for (const [k, v] of dem) if (p - v.phut > 1440) dem.delete(k); }, 3600e3).unref();

// Mỗi phiên chỉ chạy 1 câu một lúc (khách bấm gửi liên tục thì câu sau chờ câu trước).
const dangChay = new Map();
function noiTiep(phien, fn) {
  const truoc = dangChay.get(phien) || Promise.resolve();
  const p = truoc.catch(() => {}).then(fn);
  dangChay.set(phien, p);
  p.finally(() => { if (dangChay.get(phien) === p) dangChay.delete(phien); }).catch(() => {}); // lỗi đã trả cho khách ở nơi gọi; chặn để máy chủ không sập
  return p;
}

// ---------- thanh toán SePay (tuỳ chọn) ----------
const TEP_TT = path.join(CFG.data, 'thanh-toan.json');
let TT = { don: {}, gd: {} }; // don: mã → đơn; gd: id giao dịch SePay đã xử lý (chống trùng)
try { TT = Object.assign(TT, JSON.parse(fs.readFileSync(TEP_TT, 'utf8'))); } catch {}
function luuTT() { const tam = TEP_TT + '.tmp'; fs.writeFileSync(tam, JSON.stringify(TT)); fs.renameSync(tam, TEP_TT); }
const CHU_MA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function taoMa() { let m; do { m = CFG.spMa + Array.from(crypto.randomBytes(8), b => CHU_MA[b % CHU_MA.length]).join(''); } while (TT.don[m]); return m; }
const RE_TT = /\[\[\s*THANH[_ ]TOAN\s*:\s*([\d.,\s]+?)\s*(?:đ|d|vnd|VNĐ|VND)?\s*\]\]/gi;
function tachThanhToan(text) { // → { sach: chữ đã gỡ dấu, soTien | 0 }
  let soTien = 0;
  const sach = text.replace(RE_TT, (_, so) => { soTien = Number(String(so).replace(/[^\d]/g, '')) || 0; return ''; }).replace(/\n{3,}/g, '\n\n').trim();
  return { sach, soTien };
}
function qrUrl(d) {
  return `https://qr.sepay.vn/img?acc=${encodeURIComponent(CFG.spStk)}&bank=${encodeURIComponent(CFG.spNh)}&amount=${d.so_tien}&des=${d.ma}&template=compact`;
}
function phieuTT(d) {
  return { ma: d.ma, so_tien: d.so_tien, da_nhan: d.da_nhan, trang_thai: d.trang_thai, qr: qrUrl(d), ngan_hang: CFG.spNh, stk: CFG.spStk, ten_tk: CFG.spTen };
}
function taoDonTT(phien, soTien, noiDung, trang) {
  // Cùng phiên, cùng số tiền, chưa trả, trong 24h → dùng lại mã cũ (khách hỏi lại không đẻ đơn mới).
  const cu = Object.values(TT.don).find(d => d.phien === phien && d.so_tien === soTien && d.trang_thai !== 'da_thanh_toan' && Date.now() - Date.parse(d.t) < 864e5);
  if (cu) return cu;
  const d = { ma: taoMa(), phien, so_tien: soTien, da_nhan: 0, trang_thai: 'cho', t: now().toISOString(), trang, noi_dung: noiDung };
  TT.don[d.ma] = d; luuTT();
  return d;
}
const vnd = n => Number(n).toLocaleString('vi-VN') + 'đ';

async function xuLySepay(req, res) {
  const h = String(req.headers.authorization || '');
  const nhan = h.replace(/^Apikey\s+/i, '');
  const a = Buffer.from(nhan), b = Buffer.from(CFG.spKey);
  if (!CFG.spKey || !/^Apikey\s+/i.test(h) || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return guiJSON(res, 401, { success: false });
  let j; try { j = JSON.parse(await docBody(req, 64 * 1024)); } catch { return guiJSON(res, 400, { success: false }); }
  const id = String(j.id ?? '');
  if (j.transferType !== 'in' || !id) return guiJSON(res, 200, { success: true }); // chỉ xét tiền VÀO
  if (TT.gd[id]) return guiJSON(res, 200, { success: true });                      // giao dịch đã xử lý
  const nd = String(j.content || j.description || '').toUpperCase().replace(/[^A-Z0-9]/g, ' ');
  const m = nd.match(new RegExp(`${CFG.spMa}[${CHU_MA}]{8}`));
  TT.gd[id] = { t: now().toISOString(), ma: m ? m[0] : null, so: Number(j.transferAmount) || 0 };
  const d = m && TT.don[m[0]];
  if (!d) { luuTT(); console.log('SePay: tiền vào không khớp mã đơn nào, id', id); return guiJSON(res, 200, { success: true }); }
  d.da_nhan += Number(j.transferAmount) || 0;
  d.trang_thai = d.da_nhan >= d.so_tien ? 'da_thanh_toan' : 'thieu';
  if (d.trang_thai === 'da_thanh_toan') d.t_tra = now().toISOString();
  luuTT();
  ghiDong('don-hang.jsonl', { t: now().toISOString(), phien: d.phien, ma: d.ma, noi_dung: `💳 ${d.trang_thai === 'da_thanh_toan' ? 'ĐÃ THANH TOÁN' : 'CHUYỂN THIẾU'} ${d.ma}: đã nhận ${vnd(d.da_nhan)} / ${vnd(d.so_tien)}` });
  baoTelegram(`${d.trang_thai === 'da_thanh_toan' ? '✅ ĐÃ NHẬN TIỀN' : '⚠️ KHÁCH CHUYỂN THIẾU'} · CHAT WEB · ${CFG.tenShop}\n${gioVN()}\nMã đơn: ${d.ma}\nĐã nhận: ${vnd(d.da_nhan)} / ${vnd(d.so_tien)}\n\n${d.noi_dung || ''}`);
  return guiJSON(res, 200, { success: true });
}

// ---------- gọi bot ----------
async function hoiBot(phien, cau) {
  const body = JSON.stringify({
    input: [{ role: 'system', content: DAN_KENH_WEB }, { role: 'user', content: cau }],
    session_key: `web:${CFG.agentKey}:${phien}`,
    user_id: `web-${phien}`,
    mode: 'sync',
  });
  const ctl = new AbortController(); const hen = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(`${CFG.goclaw}/v1/webhooks/llm`, {
      method: 'POST', signal: ctl.signal, body,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CFG.secret}` },
    });
    const txt = await r.text();
    let j = {}; try { j = JSON.parse(txt); } catch {}
    if (!r.ok) throw Object.assign(new Error(`BANIClaw ${r.status}: ${txt.slice(0, 300)}`), { code: r.status });
    return String(j.output || '').trim();
  } finally { clearTimeout(hen); }
}

async function baoTelegram(text) {
  if (!CFG.tgToken || !CFG.tgChat) return;
  try {
    await fetch(`${CFG.tgApi}/bot${CFG.tgToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CFG.tgChat, text: text.slice(0, 3900), disable_web_page_preview: true }),
    });
  } catch (e) { console.error('Telegram lỗi:', e.message); }
}

function doanChat(phien, soTin = 12) { // đoạn chat gần nhất của một phiên (hôm qua + hôm nay)
  const ms = [...docDong(`hoi-thoai-${ngay(new Date(Date.now() - 864e5))}.jsonl`), ...docDong(`hoi-thoai-${ngay(now())}.jsonl`)]
    .filter(m => m.phien === phien).slice(-soTin);
  return ms.map(m => `${m.ai === 'khach' ? '👤' : '🤖'} ${String(m.noi).slice(0, 400)}`).join('\n');
}
const gioVN = () => new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

async function xuLyChat(req, res) {
  if (!CFG.secret) return guiJSON(res, 503, { loi: 'Khung chat chưa được nạp khoá. Chủ shop chạy lại nap-bot.sh.' });
  let j; try { j = JSON.parse(await docBody(req)); } catch { return guiJSON(res, 400, { loi: 'Dữ liệu gửi lên không hợp lệ.' }); }
  const phien = String(j.phien || '');
  const cau = String(j.cau || '').replace(/\u0000/g, '').trim();
  const trang = String(j.trang || '').slice(0, 300);
  if (!/^[a-z0-9]{16,48}$/.test(phien)) return guiJSON(res, 400, { loi: 'Phiên không hợp lệ.' });
  if (!cau) return guiJSON(res, 400, { loi: `${HOA(K)} chưa nhập tin nhắn.` });
  if (cau.length > 1500) return guiJSON(res, 400, { loi: `Tin nhắn dài quá, ${K} chia nhỏ giúp ${B} nhé.` });
  const ip = ipKhach(req);
  if (!choPhep(ip)) return guiJSON(res, 429, { loi: `${HOA(K)} nhắn hơi nhanh, đợi ${B} một phút rồi nhắn tiếp nhé.` });

  ghiDong(`hoi-thoai-${ngay(now())}.jsonl`, { t: now().toISOString(), phien, ai: 'khach', noi: cau, ip, trang });
  try {
    const tra = await noiTiep(phien, () => hoiBot(phien, cau));
    const { sach: traLoi, soTien } = tachThanhToan(tra === 'NO_REPLY' ? '' : tra);
    let tt = null;
    if (SEPAY && soTien >= 1000 && soTien <= 500e6) tt = taoDonTT(phien, soTien, traLoi, trang);
    ghiDong(`hoi-thoai-${ngay(now())}.jsonl`, { t: now().toISOString(), phien, ai: 'bot', noi: traLoi + (tt ? `\n[Phiếu thanh toán ${tt.ma} · ${vnd(tt.so_tien)}]` : '') });
    if (/ĐƠN MỚI/i.test(traLoi)) {
      ghiDong('don-hang.jsonl', { t: now().toISOString(), phien, ip, trang, noi_dung: traLoi });
      baoTelegram(`📦 ĐƠN MỚI · CHAT WEB · ${CFG.tenShop}\n${gioVN()}\n\n${traLoi}${tt ? `\n\n💳 Đã gửi QR chuyển khoản: ${tt.ma} · ${vnd(tt.so_tien)} (chờ tiền về)` : ''}\n\nTrang: ${trang || '(không rõ)'}`);
      console.log('Đơn mới từ chat web, phiên', phien);
    } else if (/CẦN TƯ VẤN/i.test(traLoi)) {
      ghiDong('can-tu-van.jsonl', { t: now().toISOString(), phien, ip, trang, nguon: 'bot', noi_dung: traLoi });
      baoTelegram(`🙋 KHÁCH CẦN TƯ VẤN · CHAT WEB · ${CFG.tenShop}\n${gioVN()}\n\n${traLoi}\n\n— Đoạn chat gần nhất —\n${doanChat(phien)}\n\nTrang: ${trang || '(không rõ)'}`);
      console.log('Khách cần tư vấn, phiên', phien);
    }
    return guiJSON(res, 200, { tra_loi: traLoi || `${HOA(B)} đây, ${K} cần ${B} tư vấn gì thêm không?`, ...(tt ? { thanh_toan: phieuTT(tt) } : {}) });
  } catch (e) {
    console.error('Lỗi hỏi bot:', e.message);
    const ban = e.name === 'AbortError' || e.code === 504 || e.code === 503;
    return guiJSON(res, 502, {
      loi: ban ? `${HOA(B)} đang hơi đông khách, ${K} nhắn lại giúp ${B} sau ít giây nhé.`
        : `${HOA(B)} đang gặp trục trặc nhỏ${CFG.sdt ? `, ${K} gọi giúp ${B} số ${CFG.sdt} nhé` : `, ${K} nhắn lại sau ít phút nhé`}.`,
    });
  }
}

// Nút "Nhờ shop gọi lại": khách tự để lại số bất cứ lúc nào, không cần qua bot.
async function xuLyLienHe(req, res) {
  let j; try { j = JSON.parse(await docBody(req, 4096)); } catch { return guiJSON(res, 400, { loi: 'Dữ liệu không hợp lệ.' }); }
  const phien = String(j.phien || ''); const ten = String(j.ten || '').trim().slice(0, 80);
  const sdt = String(j.sdt || '').trim().slice(0, 20); const can = String(j.can || '').trim().slice(0, 500);
  if (!/^[a-z0-9]{16,48}$/.test(phien)) return guiJSON(res, 400, { loi: 'Phiên không hợp lệ.' });
  if (!SDT_HOP_LE(sdt)) return guiJSON(res, 400, { loi: `Số điện thoại chưa đúng, ${K} kiểm tra lại giúp ${B} nhé.` });
  if (!choPhep(ipKhach(req))) return guiJSON(res, 429, { loi: `${HOA(K)} gửi hơi nhanh, đợi một phút giúp ${B} nhé.` });
  const trang = String(j.trang || '').slice(0, 300);
  const noi = `Tên: ${ten || '(không ghi)'}\nSĐT/Zalo: ${sdt}\nCần: ${can || '(không ghi)'}`;
  const doan = doanChat(phien);
  ghiDong('can-tu-van.jsonl', { t: now().toISOString(), phien, ip: ipKhach(req), trang, nguon: 'nut', noi_dung: noi });
  ghiDong(`hoi-thoai-${ngay(now())}.jsonl`, { t: now().toISOString(), phien, ai: 'khach', noi: `[Để lại số nhờ gọi lại] ${noi.replace(/\n/g, ' · ')}` });
  baoTelegram(`🙋 KHÁCH NHỜ GỌI LẠI · CHAT WEB · ${CFG.tenShop}\n${gioVN()}\n\n${noi}${doan ? `\n\n— Đoạn chat gần nhất —\n${doan}` : ''}\n\nTrang: ${trang || '(không rõ)'}`);
  return guiJSON(res, 200, { tra_loi: `${HOA(B)} đã gửi cho ${CFG.goiChu}, sẽ có người liên hệ số ${sdt} sớm nhé.` });
}

// ---------- trang quản lý cho chủ shop (đơn + khách cần tư vấn + hội thoại) ----------
function xacThucChu(req) {
  if (!CFG.adminPass) return false;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [, pass] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(/:(.*)/s);
  const a = Buffer.from(pass || ''); const b = Buffer.from(CFG.adminPass);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function trangQuanLy(req, res, url) {
  if (!xacThucChu(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Quan ly chat web", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(CFG.adminPass ? 'Cần đăng nhập. Tên: chu · Mật khẩu: CHAT_WEB_ADMIN_PASS trong file .env' : 'Chưa đặt CHAT_WEB_ADMIN_PASS trong .env');
  }
  const soNgay = Math.min(Number(url.searchParams.get('ngay') || 7), 60);
  const don = docDong('don-hang.jsonl').reverse();
  const tuVan = docDong('can-tu-van.jsonl').reverse();
  const hoiThoai = [];
  for (let i = 0; i < soNgay; i++) hoiThoai.push(...docDong(`hoi-thoai-${ngay(new Date(Date.now() - i * 864e5))}.jsonl`));
  const theoPhien = new Map();
  for (const m of hoiThoai) { if (!theoPhien.has(m.phien)) theoPhien.set(m.phien, []); theoPhien.get(m.phien).push(m); }
  const phienList = [...theoPhien.entries()].map(([p, ms]) => ({ p, ms: ms.sort((a, b) => a.t.localeCompare(b.t)) }))
    .sort((a, b) => b.ms[b.ms.length - 1].t.localeCompare(a.ms[a.ms.length - 1].t));
  const gio = t => new Date(t).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chat web · ${esc(CFG.tenShop)}</title><style>
:root{--m:${CFG.mau};--bg:#f6f4f5;--card:#fff;--ink:#222;--mu:#6b6b6b;--ln:#e7e2e4}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:20px 16px 60px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px}
.mu{color:var(--mu);font-size:13px}.card{background:var(--card);border:1px solid var(--ln);border-radius:12px;padding:14px 16px;margin:10px 0}
.don{border-left:4px solid var(--m)}pre{white-space:pre-wrap;font:inherit;margin:6px 0 0}
details summary{cursor:pointer;list-style:none}details summary::-webkit-details-marker{display:none}
.m{margin:6px 0;padding:8px 11px;border-radius:10px;max-width:85%;white-space:pre-wrap}.k{background:#eef1f6}.b{background:#fdeef3;margin-left:auto}
.row{display:flex;flex-direction:column}.tag{display:inline-block;background:var(--m);color:#fff;border-radius:99px;padding:0 8px;font-size:12px;margin-left:6px}
a{color:var(--m)}</style></head><body><main>
<h1>Chat web · ${esc(CFG.tenShop)}</h1>
<div class="mu">Đơn và hội thoại khách nhắn qua khung chat trên website. Xem ${soNgay} ngày gần nhất · <a href="?ngay=30">30 ngày</a></div>
<h2>📦 Đơn mới (${don.length})</h2>
${don.length ? don.slice(0, 100).map(d => `<div class="card don"><div class="mu">${gio(d.t)} · phiên ${esc(d.phien.slice(0, 8))}${d.trang ? ` · ${esc(d.trang)}` : ''}</div><pre>${esc(d.noi_dung)}</pre></div>`).join('') : '<div class="card mu">Chưa có đơn nào qua chat web.</div>'}
${SEPAY ? (() => { const ds = Object.values(TT.don).sort((a, b) => b.t.localeCompare(a.t)); const nhan = { cho: 'chờ tiền', thieu: 'chuyển thiếu', da_thanh_toan: 'ĐÃ THANH TOÁN' };
  return `<h2>💳 Thanh toán SePay (${ds.length})</h2>` + (ds.length ? ds.slice(0, 100).map(d => `<div class="card don"><div class="mu">${gio(d.t)} · <b>${esc(d.ma)}</b> · ${vnd(d.so_tien)} · đã nhận ${vnd(d.da_nhan)} <span class="tag">${nhan[d.trang_thai] || esc(d.trang_thai)}</span></div><pre>${esc(d.noi_dung || '')}</pre></div>`).join('') : '<div class="card mu">Chưa có phiếu thanh toán nào.</div>'); })() : ''}
<h2>🙋 Khách cần tư vấn thêm (${tuVan.length})</h2>
${tuVan.length ? tuVan.slice(0, 100).map(d => `<div class="card don"><div class="mu">${gio(d.t)} · ${d.nguon === 'nut' ? 'khách bấm nút gọi lại' : 'bot chuyển'} · phiên ${esc(d.phien.slice(0, 8))}</div><pre>${esc(d.noi_dung)}</pre></div>`).join('') : '<div class="card mu">Chưa có.</div>'}
<h2>💬 Hội thoại (${phienList.length})</h2>
${phienList.length ? phienList.slice(0, 200).map(({ p, ms }) => {
    const dau = ms.find(m => m.ai === 'khach'); const coDon = ms.some(m => m.ai === 'bot' && /ĐƠN MỚI/i.test(m.noi));
    const canTV = ms.some(m => /CẦN TƯ VẤN|Để lại số nhờ gọi lại/i.test(m.noi));
    return `<details class="card"><summary><b>${esc((dau?.noi || '').slice(0, 80))}</b>${coDon ? '<span class="tag">có đơn</span>' : ''}${canTV ? '<span class="tag">cần tư vấn</span>' : ''}<div class="mu">${gio(ms[ms.length - 1].t)} · ${ms.length} tin · phiên ${esc(p.slice(0, 8))}</div></summary>
<div class="row">${ms.map(m => `<div class="m ${m.ai === 'khach' ? 'k' : 'b'}">${esc(m.noi)}</div>`).join('')}</div></details>`;
  }).join('') : '<div class="card mu">Chưa có ai nhắn.</div>'}
</main></body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  res.end(html);
}

// ---------- tệp tĩnh ----------
const LOAI = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
function guiTep(res, ten) {
  const f = path.join(PUB, ten);
  if (!f.startsWith(PUB + path.sep)) { res.writeHead(404); return res.end(); }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Không thấy'); }
    res.writeHead(200, { 'Content-Type': LOAI[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = url.pathname;
  if (p === '/' || p === PREFIX) { res.writeHead(302, { Location: PREFIX + '/' }); return res.end(); }
  if (!p.startsWith(PREFIX + '/')) { res.writeHead(404); return res.end(); }
  p = p.slice(PREFIX.length);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (p === '/sepay/webhook' && req.method === 'POST') {
    if (!SEPAY) return guiJSON(res, 404, { success: false });
    try { return await xuLySepay(req, res); } catch (e) { console.error('SePay lỗi:', e); return guiJSON(res, 500, { success: false }); }
  }
  if (p.startsWith('/api/')) {
    if (!cors(req, res)) return guiJSON(res, 403, { loi: 'Website này chưa được phép dùng khung chat.' });
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  try {
    if (p === '/api/cau-hinh' && req.method === 'GET') {
      return guiJSON(res, 200, {
        ten_shop: CFG.tenShop, ten_bot: CFG.tenBot, mau: CFG.mau, sdt: CFG.sdt, zalo: CFG.zalo,
        loi_chao: CFG.loiChao || `Chào ${K} 👋 ${HOA(B)} là ${CFG.tenBot}. ${HOA(K)} cần tư vấn gì, ${B} trả lời ngay nhé?`,
        xung: B, khach: K, avatar: (E.CHAT_WEB_AVATAR || '💬').slice(0, 4),
        goi_y: (E.CHAT_WEB_GOI_Y || 'Xem sản phẩm, dịch vụ|Báo giá|Cách đặt hàng|Thanh toán, giao hàng').split('|').map(s => s.trim()).filter(Boolean).slice(0, 6),
        ten_chu: CFG.tenChu,
        san_sang: Boolean(CFG.secret),
        sepay: SEPAY,
      }, { 'Cache-Control': 'public, max-age=60' });
    }
    if (p === '/api/chat' && req.method === 'POST') return await xuLyChat(req, res);
    if (p === '/api/lien-he' && req.method === 'POST') return await xuLyLienHe(req, res);
    const mDon = p.match(/^\/api\/don\/([A-Z0-9]{6,14})$/);
    if (mDon && req.method === 'GET') {
      const d = SEPAY && TT.don[mDon[1]];
      return d ? guiJSON(res, 200, phieuTT(d)) : guiJSON(res, 404, { loi: 'Không thấy đơn.' });
    }
    if (p === '/api/suc-khoe') return guiJSON(res, 200, { ok: true, co_khoa: Boolean(CFG.secret) });
    if (p === '/quan-ly' || p === '/quan-ly/') return trangQuanLy(req, res, url);
    if (p === '/' || p === '/index.html') return guiTep(res, 'index.html');
    if (p === '/chat.js') return guiTep(res, 'chat.js');
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Không thấy');
  } catch (e) {
    console.error(e); if (!res.headersSent) guiJSON(res, 500, { loi: 'Lỗi máy chủ.' });
  }
});
server.listen(CFG.port, () => console.log(`chat-web chạy cổng ${CFG.port} · bot ${CFG.agentKey} · ${CFG.secret ? 'đã có khoá' : 'CHƯA có khoá (chạy nap-bot.sh)'} · SePay ${SEPAY ? (CFG.spKey ? 'BẬT' : 'BẬT nhưng THIẾU SEPAY_WEBHOOK_APIKEY (tiền về sẽ không tự xác nhận)') : 'tắt'}`));
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => server.close(() => process.exit(0)));
