/* Khung chat bán hàng của shop — nhúng vào website bằng MỘT dòng:
 *   <script src="https://TEN-MIEN-BOT/web-chat/chat.js" async></script>
 * Tuỳ chọn: data-mau="#D10201" (màu)  data-vi-tri="trai" (góc trái)  data-mo="1" (mở sẵn)
 * Khung nằm trong Shadow DOM nên không bị CSS của website làm lệch, và không làm lệch website.
 */
(function () {
  'use strict';
  if (window.__chatShopDaNap) return; window.__chatShopDaNap = true;
  var the = document.currentScript || (function () { var s = document.getElementsByTagName('script'); for (var i = s.length - 1; i >= 0; i--) if (/\/web-chat\/chat\.js/.test(s[i].src)) return s[i]; })();
  if (!the) return;
  var GOC = the.src.replace(/\/web-chat\/chat\.js.*$/, '/web-chat');
  var KHOA_ID = 'chatShop_phien', KHOA_LS = 'chatShop_lichsu', KHOA_MO = 'chatShop_mo';
  var HET_HAN = 7 * 864e5; // 7 ngày không nhắn thì mở phiên mới

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function taoId() { var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(36)).slice(-2); }).join('').replace(/[^a-z0-9]/g, '0').slice(0, 24); }
  function docLS() { try { var o = JSON.parse(ls(KHOA_LS) || 'null'); if (o && Date.now() - o.t < HET_HAN && Array.isArray(o.ds)) return o.ds; } catch (e) {} return null; }
  var phien = ls(KHOA_ID); var lichSu = docLS();
  if (!phien || !lichSu) { phien = taoId(); lichSu = []; ls(KHOA_ID, phien); }
  function luu() { ls(KHOA_LS, JSON.stringify({ t: Date.now(), ds: lichSu.slice(-80) })); }

  var CH = { ten_shop: 'Shop', ten_bot: 'Trợ lý', mau: the.getAttribute('data-mau') || '#D10201', loi_chao: 'Chào bạn 👋 Mình có thể giúp gì cho bạn?', xung: 'em', khach: 'chị', goi_y: [], sdt: '', zalo: '' };

  function H(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function T(mau) { return mau.replace(/\{K\}/g, CH.khach).replace(/\{B\}/g, CH.xung).replace(/\{HK\}/g, H(CH.khach)); } // câu theo xưng hô
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dinhDang(s) { // markdown tối giản, an toàn: escape trước rồi mới tô
    var h = esc(s);
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener nofollow">$2</a>');
    h = h.replace(/^\s*[-•*] /gm, '• ');
    return h.replace(/\n/g, '<br>');
  }
  function sang(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; function f(x) { return Math.round(x + (255 - x) * k); } return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }

  var host = document.createElement('div'); host.id = 'chat-shop-khung';
  host.style.cssText = 'position:fixed;z-index:2147483000;bottom:0;' + (the.getAttribute('data-vi-tri') === 'trai' ? 'left:0' : 'right:0');
  var goc = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var trai = the.getAttribute('data-vi-tri') === 'trai';

  function ve() {
    var m = CH.mau;
    goc.innerHTML = '<style>' +
      ':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}' +
      '.nut{position:fixed;bottom:20px;' + (trai ? 'left' : 'right') + ':20px;width:60px;height:60px;border-radius:50%;border:0;background:' + m + ';color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;transition:transform .15s}' +
      '.nut:hover{transform:scale(1.06)}.nut svg{width:28px;height:28px}' +
      '.cham{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#2fb344;border:2px solid #fff}' +
      '.moi{position:fixed;bottom:90px;' + (trai ? 'left' : 'right') + ':20px;max-width:250px;background:#fff;color:#222;padding:10px 14px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.15);font-size:14px;line-height:1.45;cursor:pointer}' +
      '.moi .x{float:right;margin:-4px -6px 0 8px;color:#999;cursor:pointer;font-size:16px}' +
      '.hop{position:fixed;bottom:20px;' + (trai ? 'left' : 'right') + ':20px;width:370px;height:min(600px,calc(100vh - 40px));background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;color:#222}' +
      '.dau{background:' + m + ';color:#fff;padding:14px 14px 14px 16px;display:flex;align-items:center;gap:10px}' +
      '.av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}' +
      '.ten{font-weight:600;font-size:15px;line-height:1.2}.tt{font-size:12px;opacity:.9}' +
      '.dau .nx{margin-left:auto;display:flex;gap:2px}.dau button{background:none;border:0;color:#fff;cursor:pointer;padding:6px;border-radius:8px;opacity:.9;font-size:13px}.dau button:hover{background:rgba(255,255,255,.18)}' +
      '.ds{flex:1;overflow-y:auto;padding:14px 12px;background:#f7f5f6;display:flex;flex-direction:column;gap:8px}' +
      '.tn{max-width:84%;padding:9px 12px;border-radius:14px;font-size:14.5px;line-height:1.5;word-wrap:break-word;overflow-wrap:anywhere}' +
      '.tn a{color:inherit;text-decoration:underline}' +
      '.bot{background:#fff;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06)}' +
      '.khach{background:' + m + ';color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
      '.loi{background:#fff4e5;color:#7a4b00;align-self:flex-start;font-size:13.5px}' +
      '.go{align-self:flex-start;background:#fff;padding:12px 14px;border-radius:14px;display:flex;gap:4px}.go i{width:7px;height:7px;border-radius:50%;background:#bbb;animation:n 1.2s infinite}.go i:nth-child(2){animation-delay:.15s}.go i:nth-child(3){animation-delay:.3s}' +
      '@keyframes n{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}' +
      '.gy{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px;background:#f7f5f6}.gy button{border:1px solid ' + sang(m, .55) + ';background:#fff;color:' + m + ';border-radius:99px;padding:6px 11px;font-size:13px;cursor:pointer}.gy button:hover{background:' + sang(m, .9) + '}' +
      '.nhap{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff;align-items:flex-end}' +
      '.nhap textarea{flex:1;resize:none;border:1px solid #ddd;border-radius:12px;padding:9px 12px;font-size:15px;line-height:1.4;max-height:110px;outline:none;color:#222;background:#fff}.nhap textarea:focus{border-color:' + m + '}' +
      '.nhap button{width:40px;height:40px;border-radius:50%;border:0;background:' + m + ';color:#fff;cursor:pointer;flex:none;display:flex;align-items:center;justify-content:center}.nhap button:disabled{opacity:.45;cursor:default}' +
      '.chan{font-size:11.5px;color:#888;text-align:center;padding:0 10px 8px;background:#fff}.chan a{color:#666}' +
      '.goi{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 10px 8px;padding:8px;border:1px dashed ' + sang(m, .4) + ';border-radius:10px;background:#fff;color:' + m + ';font-size:13.5px;cursor:pointer;width:calc(100% - 20px)}.goi:hover{background:' + sang(m, .92) + '}' +
      '.form{padding:12px;border-top:1px solid #eee;background:#fff;display:flex;flex-direction:column;gap:8px}' +
      '.form b{font-size:14px}.form .mu{font-size:12.5px;color:#777;margin-top:-4px}' +
      '.form input,.form textarea{border:1px solid #ddd;border-radius:10px;padding:9px 11px;font-size:15px;outline:none;color:#222;background:#fff;width:100%}.form input:focus,.form textarea:focus{border-color:' + m + '}' +
      '.form .hang{display:flex;gap:8px}.form button{flex:1;border:0;border-radius:10px;padding:10px;font-size:14px;cursor:pointer}.form .ok{background:' + m + ';color:#fff}.form .huy{background:#f1eef0;color:#444}.form .bao{font-size:13px;color:#b42318;min-height:0}' +
      '.tt{align-self:stretch;background:#fff;border:1px solid ' + sang(m, .6) + ';border-radius:14px;padding:12px;font-size:14px;line-height:1.45;color:#222}' +
      '.tt .tde{font-weight:700;margin-bottom:6px}.tt img{display:block;width:200px;max-width:100%;margin:6px auto;border-radius:8px;background:#f3f3f3;min-height:200px}' +
      '.tt .d{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed #eee}.tt .d span{color:#777}.tt .d b{text-align:right;word-break:break-all}' +
      '.tt .cp{border:0;background:' + sang(m, .9) + ';color:' + m + ';border-radius:6px;padding:1px 7px;margin-left:6px;cursor:pointer;font-size:12px}' +
      '.tt .tth{margin-top:8px;padding:7px 9px;border-radius:9px;background:#fff7e6;color:#7a4b00;font-size:13.5px}.tt .tth.ok{background:#e8f7ee;color:#11643a;font-weight:600}' +
      '.an{display:none!important}' +
      '@media (max-width:480px){.hop{left:0;right:0;bottom:0;width:100%;height:100%;border-radius:0}}' +
      '</style>' +
      '<div class="moi an"><span class="x" title="Đóng">×</span><span class="moi-chu"></span></div>' +
      '<button class="nut" aria-label="Mở khung chat với shop"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.5 6.1L4.8 21l4-2.2c1 .3 2.1.4 3.2.4 5.5 0 10-3.6 10-8.1S17.5 3 12 3z"/></svg><span class="cham"></span></button>' +
      '<div class="hop an" role="dialog" aria-label="Chat với shop">' +
      '<div class="dau"><div class="av">' + esc(CH.avatar || '💬') + '</div><div><div class="ten"></div><div class="tt">Đang trực tuyến · trả lời ngay</div></div>' +
      '<div class="nx"><button class="moi-lai" title="Bắt đầu cuộc trò chuyện mới">Mới</button><button class="dong" title="Thu nhỏ" aria-label="Thu nhỏ">✕</button></div></div>' +
      '<div class="ds" aria-live="polite"></div><div class="gy"></div>' +
      '<button class="goi an" type="button">📞 Nhờ shop gọi lại tư vấn</button>' +
      '<div class="form an"><b>Để lại số, shop gọi lại tư vấn</b><div class="mu">Chỉ dùng để tư vấn đơn của mình, không gửi quảng cáo.</div>' +
      '<input class="f-ten" placeholder="' + T('Tên của {K}') + '" maxlength="80" autocomplete="name">' +
      '<input class="f-sdt" placeholder="Số điện thoại hoặc Zalo" inputmode="tel" maxlength="20" autocomplete="tel">' +
      '<textarea class="f-can" rows="2" placeholder="' + T('{HK} cần tư vấn gì? (không bắt buộc)') + '" maxlength="500"></textarea>' +
      '<div class="bao"></div><div class="hang"><button class="huy" type="button">Để sau</button><button class="ok" type="button">Gửi cho shop</button></div></div>' +
      '<div class="nhap"><textarea rows="1" placeholder="Nhập tin nhắn…" aria-label="Tin nhắn"></textarea><button class="gui" aria-label="Gửi"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12.6 2-12.6 2z"/></svg></button></div>' +
      '<div class="chan"></div></div>';
  }
  ve();
  var $ = function (s) { return goc.querySelector(s); };
  var dangGui = false;

  // ---------- phiếu thanh toán SePay (QR VietQR) ----------
  var dangHoi = {};
  function nhanTT(p) {
    if (p.trang_thai === 'da_thanh_toan') return '<div class="tth ok">✅ Đã nhận đủ tiền. Cảm ơn ' + esc(CH.khach) + '!</div>';
    if (p.trang_thai === 'thieu') return '<div class="tth">Đã nhận ' + vnd(p.da_nhan) + ', còn thiếu ' + vnd(p.so_tien - p.da_nhan) + '. Chuyển thêm với đúng nội dung <b>' + esc(p.ma) + '</b> nhé.</div>';
    return '<div class="tth">⏳ Đang chờ tiền về… (tự cập nhật sau khi chuyển khoản)</div>';
  }
  function vnd(n) { return Number(n).toLocaleString('vi-VN') + 'đ'; }
  function vePhieu(p) {
    var d = document.createElement('div'); d.className = 'tt'; d.setAttribute('data-ma', p.ma);
    d.innerHTML = '<div class="tde">💳 Quét mã để chuyển khoản</div><img alt="Mã QR chuyển khoản" src="' + esc(p.qr) + '">' +
      '<div class="d"><span>Ngân hàng</span><b>' + esc(p.ngan_hang) + '</b></div>' +
      '<div class="d"><span>Số tài khoản</span><b>' + esc(p.stk) + '<button class="cp" data-c="' + esc(p.stk) + '">Chép</button></b></div>' +
      (p.ten_tk ? '<div class="d"><span>Chủ tài khoản</span><b>' + esc(p.ten_tk) + '</b></div>' : '') +
      '<div class="d"><span>Số tiền</span><b>' + vnd(p.so_tien) + '</b></div>' +
      '<div class="d"><span>Nội dung</span><b>' + esc(p.ma) + '<button class="cp" data-c="' + esc(p.ma) + '">Chép</button></b></div>' +
      '<div class="ttt">' + nhanTT(p) + '</div>';
    Array.prototype.forEach.call(d.querySelectorAll('.cp'), function (b) {
      b.onclick = function () { var c = b.getAttribute('data-c'); try { navigator.clipboard.writeText(c); b.textContent = 'Đã chép'; } catch (e) { window.prompt('Chép:', c); } };
    });
    return d;
  }
  function capNhatPhieu(p) {
    lichSu.forEach(function (m) { if (m.a === 'tt' && m.c.ma === p.ma) m.c = p; }); luu();
    var el = goc.querySelector('.tt[data-ma="' + p.ma + '"] .ttt'); if (el) el.innerHTML = nhanTT(p);
  }
  function theoDoi(p) {
    if (p.trang_thai === 'da_thanh_toan' || dangHoi[p.ma]) return;
    var bd = Date.now(); dangHoi[p.ma] = true;
    (function hoi() {
      if (Date.now() - bd > 30 * 60e3) { dangHoi[p.ma] = false; return; } // hỏi tối đa 30 phút
      fetch(GOC + '/api/don/' + encodeURIComponent(p.ma)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ma) { capNhatPhieu(j); if (j.trang_thai === 'da_thanh_toan') { dangHoi[p.ma] = false; return; } }
        setTimeout(hoi, 4000);
      }).catch(function () { setTimeout(hoi, 8000); });
    })();
  }

  function themTN(loai, chu, khongLuu) {
    if (loai === 'tt') {
      $('.ds').appendChild(vePhieu(chu)); $('.ds').scrollTop = $('.ds').scrollHeight;
      if (!khongLuu) { lichSu.push({ a: 'tt', c: chu }); luu(); }
      theoDoi(chu); return;
    }
    var d = document.createElement('div'); d.className = 'tn ' + loai;
    d.innerHTML = loai === 'khach' ? esc(chu).replace(/\n/g, '<br>') : dinhDang(chu);
    $('.ds').appendChild(d); $('.ds').scrollTop = $('.ds').scrollHeight;
    if (!khongLuu && loai !== 'loi') { lichSu.push({ a: loai, c: chu }); luu(); }
  }
  function veLai() {
    $('.ds').innerHTML = ''; themTN('bot', CH.loi_chao, true);
    lichSu.forEach(function (m) { themTN(m.a, m.c, true); });
    var gy = $('.gy'); gy.innerHTML = '';
    if (!lichSu.length) CH.goi_y.forEach(function (g) { var b = document.createElement('button'); b.textContent = g; b.onclick = function () { gui(g); }; gy.appendChild(b); });
    $('.ten').textContent = CH.ten_bot || CH.ten_shop;
    hienNutGoi();
    var chan = [];
    if (CH.sdt) chan.push('Gọi shop: <a href="tel:' + esc(CH.sdt.replace(/[^\d+]/g, '')) + '">' + esc(CH.sdt) + '</a>');
    if (CH.zalo) chan.push('<a href="' + esc(CH.zalo) + '" target="_blank" rel="noopener">Nhắn Zalo</a>');
    chan.push('Trợ lý tự động của ' + esc(CH.ten_shop));
    $('.chan').innerHTML = chan.join(' · ');
  }
  function soTinKhach() { return lichSu.filter(function (m) { return m.a === 'khach'; }).length; }
  function hienNutGoi() { $('.goi').classList.toggle('an', soTinKhach() < 2 || !$('.form').classList.contains('an') || ls('chatShop_daGoi') === phien); }
  function moForm(bat) {
    $('.form').classList.toggle('an', !bat); $('.nhap').classList.toggle('an', bat); $('.gy').classList.toggle('an', bat);
    $('.bao').textContent = ''; hienNutGoi(); if (bat) $('.f-ten').focus();
  }
  function guiLienHe() {
    var sdt = $('.f-sdt').value.trim(), nut = $('.form .ok');
    if (!/^(\+?84|0)\d{8,10}$/.test(sdt.replace(/[\s.\-()]/g, ''))) { $('.bao').textContent = T('Số điện thoại chưa đúng, {K} kiểm tra lại giúp {B} nhé.'); return; }
    nut.disabled = true; nut.textContent = 'Đang gửi…';
    fetch(GOC + '/api/lien-he', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phien: phien, ten: $('.f-ten').value, sdt: sdt, can: $('.f-can').value, trang: location.href.slice(0, 300) }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.tra_loi) { ls('chatShop_daGoi', phien); moForm(false); themTN('bot', j.tra_loi); }
        else $('.bao').textContent = j.loi || T('Chưa gửi được, {K} thử lại giúp {B} nhé.');
      })
      .catch(function () { $('.bao').textContent = T('Mạng chập chờn, {K} thử lại giúp {B} nhé.'); })
      .then(function () { nut.disabled = false; nut.textContent = 'Gửi cho shop'; });
  }
  function dangGo(bat) {
    var g = $('.ds .go'); if (bat && !g) { g = document.createElement('div'); g.className = 'go'; g.innerHTML = '<i></i><i></i><i></i>'; $('.ds').appendChild(g); $('.ds').scrollTop = $('.ds').scrollHeight; }
    if (!bat && g) g.remove();
  }
  function gui(chu) {
    chu = (chu || '').trim(); if (!chu || dangGui) return;
    dangGui = true; $('.gui').disabled = true; $('.gy').innerHTML = '';
    themTN('khach', chu); var o = $('.nhap textarea'); o.value = ''; o.style.height = '';
    dangGo(true);
    fetch(GOC + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phien: phien, cau: chu, trang: location.href.slice(0, 300) }) })
      .then(function (r) { return r.json().catch(function () { return { loi: T('Mạng chập chờn, {K} nhắn lại giúp {B} nhé.') }; }); })
      .then(function (j) { dangGo(false); if (j.tra_loi) { themTN('bot', j.tra_loi); if (j.thanh_toan) themTN('tt', j.thanh_toan); if (/CẦN TƯ VẤN|ĐƠN MỚI/i.test(j.tra_loi)) ls('chatShop_daGoi', phien); } else themTN('loi', j.loi || T('Có lỗi nhỏ, {K} nhắn lại giúp {B} nhé.')); hienNutGoi(); })
      .catch(function () { dangGo(false); themTN('loi', T('Mạng chập chờn, {K} nhắn lại giúp {B} nhé.')); })
      .then(function () { dangGui = false; $('.gui').disabled = false; if (window.innerWidth > 480) $('.nhap textarea').focus(); });
  }
  function mo(bat) {
    $('.hop').classList.toggle('an', !bat); $('.nut').classList.toggle('an', bat); $('.moi').classList.add('an');
    ls(KHOA_MO, bat ? '1' : null);
    if (bat) { $('.ds').scrollTop = $('.ds').scrollHeight; if (window.innerWidth > 480) $('.nhap textarea').focus(); }
  }

  function batDau() {
    (document.body || document.documentElement).appendChild(host);
    veLai();
    if (ls(KHOA_MO) === '1' || the.getAttribute('data-mo') === '1') mo(true);
    else if (!lichSu.length && !ls('chatShop_tatMoi')) setTimeout(function () { if ($('.hop').classList.contains('an')) { $('.moi-chu').textContent = CH.loi_chao; $('.moi').classList.remove('an'); } }, 6000);
  }
  fetch(GOC + '/api/cau-hinh').then(function (r) { return r.json(); }).then(function (c) {
    for (var k in c) if (c[k] !== undefined && c[k] !== '') CH[k] = c[k];
    if (the.getAttribute('data-mau')) CH.mau = the.getAttribute('data-mau');
    ve(); bindLai(); batDau();
  }).catch(function () { bindLai(); batDau(); });

  function bindLai() { // gắn sự kiện sau mỗi lần ve() vẽ khung
    $('.nut').onclick = function () { mo(true); };
    $('.dong').onclick = function () { mo(false); };
    $('.moi').onclick = function (e) { if (e.target.classList.contains('x')) { $('.moi').classList.add('an'); ls('chatShop_tatMoi', '1'); return; } mo(true); };
    $('.moi-lai').onclick = function () { if (!lichSu.length) return; if (!confirm('Bắt đầu cuộc trò chuyện mới? Tin nhắn cũ trong khung sẽ được xoá.')) return; phien = taoId(); ls(KHOA_ID, phien); lichSu = []; luu(); veLai(); };
    $('.gui').onclick = function () { gui($('.nhap textarea').value); };
    $('.goi').onclick = function () { moForm(true); };
    $('.form .huy').onclick = function () { moForm(false); };
    $('.form .ok').onclick = guiLienHe;
    $('.f-sdt').addEventListener('keydown', function (e) { if (e.key === 'Enter') guiLienHe(); });
    $('.nhap textarea').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); gui(this.value); } });
    $('.nhap textarea').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 110) + 'px'; });
  }
})();
