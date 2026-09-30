/* 架空のサロンのデータと、プロトタイプ内で登録した内容の保存（ブラウザのsessionStorage） */
const SALON = {
  name: 'Hair Salon Komorebi',
  staff: [
    { id: 'mori', name: '森 ひより', short: '森', fee: 1000 },
    { id: 'kino', name: '木下 あおい', short: '木下', fee: 500 }
  ],
  courses: [
    { id: 'cut', name: 'カット', min: 60, price: 4500 },
    { id: 'color', name: 'カラー', min: 90, price: 7500 },
    { id: 'perm', name: 'パーマ', min: 120, price: 9000 },
    { id: 'tr', name: 'トリートメント', min: 60, price: 4000 }
  ],
  recent: [
    { name: '高橋 美穂', phone: '' },
    { name: '佐藤 和子', phone: '' },
    { name: '鈴木 恵', phone: '' },
    { name: '山田 花子', phone: '' }
  ],
  // 分（0時からの経過分）で持つ。表示は 9:00〜19:00
  days: {
    '2026-10-01': {
      label: '10月1日（木）', short: '10/1（木）',
      shifts: { mori: [[540, 780], [900, 1140]], kino: null },
      offNote: { kino: '毎週木曜' },
      events: [
        { id: 'e1', staff: 'mori', s: 600, e: 660, name: '佐藤 和子', course: 'カット' },
        { id: 'g1', staff: 'mori', s: 660, e: 720, type: 'gcal' },
        { id: 'e2', staff: 'mori', s: 900, e: 960, name: '山田 花子', course: 'カット' },
        { id: 'e3', staff: 'mori', s: 960, e: 1020, name: '山田 花子', course: 'カラー' },
        { id: 'e4', staff: 'mori', s: 1020, e: 1080, name: '鈴木 恵', course: 'パーマ' },
        { id: 'e5', staff: 'none', s: 1080, e: 1140, name: '伊藤 直美', course: 'カット' }
      ]
    },
    '2026-10-02': {
      label: '10月2日（金）', short: '10/2（金）',
      shifts: { mori: null, kino: [[600, 720], [780, 1140]] },
      offNote: { mori: '毎週金曜' },
      events: [
        { id: 'e6', staff: 'kino', s: 600, e: 690, name: '高橋 美穂', course: 'カラー' },
        { id: 'e7', staff: 'kino', s: 840, e: 900, name: '小林 亮', course: 'カット' },
        { id: 'e8', staff: 'kino', s: 960, e: 1020, name: '松本 愛', course: 'トリートメント' }
      ]
    }
  },
  gcal: { mori: true, kino: false },
  autoAssign: false
};
const DAY_KEYS = Object.keys(SALON.days);
const T0 = 540, T1 = 1140; // 9:00〜19:00

/* ===== 保存（このタブを閉じるまで残る） ===== */
const Store = {
  key: 'mishona-proto-v1',
  load() {
    try { return JSON.parse(sessionStorage.getItem(this.key)) || {}; } catch (e) { return {}; }
  },
  save(st) { try { sessionStorage.setItem(this.key, JSON.stringify(st)); } catch (e) {} },
  get() {
    const st = this.load();
    st.added = st.added || []; st.removed = st.removed || []; st.assigned = st.assigned || {};
    st.gcal = Object.assign({}, SALON.gcal, st.gcal || {});
    st.multi = st.multi || 'none';      // 同時予約：none / ask / limit
    st.multiLimit = st.multiLimit || 1;
    st.msgFixed = !!st.msgFixed;
    st.morning = st.morning || {};        // 今朝の確認で済ませた項目        // 完了メッセージに担当名・内訳を入れたか
    return st;
  },
  update(fn) { const st = this.get(); fn(st); this.save(st); return st; },
  reset() { try { sessionStorage.removeItem(this.key); } catch (e) {} }
};

/* その日の予約（元データ＋登録・割り当て・取り消しを反映） */
function eventsOf(dk) {
  const st = Store.get();
  const base = SALON.days[dk].events.filter(ev => !st.removed.includes(ev.id)).map(ev => Object.assign({}, ev));
  st.added.filter(a => a.day === dk && !st.removed.includes(a.id)).forEach(a => base.push(Object.assign({}, a)));
  base.forEach(ev => { if (st.assigned[ev.id]) ev.staff = st.assigned[ev.id]; });
  return base;
}
function allEvents() { return DAY_KEYS.flatMap(dk => eventsOf(dk).map(ev => Object.assign({ day: dk }, ev))); }
function staffById(id) { return SALON.staff.find(s => s.id === id); }
function courseByName(n) { return SALON.courses.find(c => c.name === n); }
function gcalOn(id) { return Store.get().gcal[id]; }

/* 時間のユーティリティ */
function hhmm(m) { return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
function yen(n) { return n.toLocaleString('ja-JP') + '円'; }
function overlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }
function pct(m) { return ((m - T0) / (T1 - T0) * 100) + '%'; }

/* その日のスタッフの「予約できない時間」 */
function blocksOf(dk, sid) {
  const day = SALON.days[dk], sh = day.shifts[sid], out = [];
  if (!sh) return [{ type: 'off', s: T0, e: T1 }];
  if (sh[0][0] > T0) out.push({ type: 'outside', s: T0, e: sh[0][0] });
  for (let i = 0; i < sh.length - 1; i++) out.push({ type: 'break', s: sh[i][1], e: sh[i + 1][0] });
  if (sh[sh.length - 1][1] < T1) out.push({ type: 'outside', s: sh[sh.length - 1][1], e: T1 });
  return out;
}
/* 担当未定の予約を、対応できる人の枠で「確保中」にする */
function candidateFor(dk, ev) {
  return SALON.staff.find(sf => {
    const sh = SALON.days[dk].shifts[sf.id];
    if (!sh || !sh.some(([a, b]) => ev.s >= a && ev.e <= b)) return false;
    return !eventsOf(dk).some(o => o.id !== ev.id && o.staff === sf.id && overlap(o.s, o.e, ev.s, ev.e));
  });
}
/* ある時間にスタッフがふさがっている理由（なければ null） */
function busyReason(dk, sid, s, e, ignoreId) {
  for (const b of blocksOf(dk, sid)) if (overlap(b.s, b.e, s, e)) return { kind: b.type, s: b.s, e: b.e };
  for (const ev of eventsOf(dk)) {
    if (ev.id === ignoreId) continue;
    if (ev.staff === sid && overlap(ev.s, ev.e, s, e)) return { kind: ev.type === 'gcal' ? 'gcal' : 'rsv', ev };
    if (ev.staff === 'none') {
      const c = candidateFor(dk, ev);
      if (c && c.id === sid && overlap(ev.s, ev.e, s, e)) return { kind: 'hold', ev };
    }
  }
  return null;
}

/* ===== 共通の見た目（ヘッダーと左メニュー） ===== */
const ICON = {
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>',
  warn: '<svg class="warn-ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 17.5v.5" stroke="#fff" stroke-width="2"/></svg>',
  person: (c) => '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + c + '"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>',
  phone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  chat: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  gcal: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16"/></svg>'
};
function shellHTML() {
  return `
  <div class="app-header">
    <div class="logo"><span>L</span></div>
    <div class="store-select"><span class="ico"></span><span>${SALON.name}</span><span class="caret">▾</span></div>
    <div class="header-right">
      <div class="hicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg><span class="t-opt">配信数</span></div>
      <div class="hicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5M12 17h.01"/></svg><span class="t-opt">サポート</span></div>
      <div class="hicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><span class="t-opt">お知らせ</span></div>
      <div class="user"><span class="avatar"></span><span>薗田 信広</span><span style="color:var(--gray)">▾</span></div>
    </div>
  </div>
  <nav class="rail" aria-label="メインメニュー">
    <a title="お気に入り"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg></a>
    <a title="1:1チャット"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16v11H9l-5 4z"/></svg></a>
    <a title="テンプレート"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></a>
    <a title="メッセージ配信"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12l16-8-6 16-3-6z"/></svg></a>
    <a title="ステップ配信"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 18h5v-5h5V8h6"/></svg></a>
    <span class="sep"></span>
    <a class="active" title="予約管理" href="calendar.html">${ICON.cal}</a>
    <a title="フォーム"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h4"/></svg></a>
    <a title="リッチメニュー"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/></svg></a>
    <a title="分析"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 20V10M10 20V4M15 20v-7M20 20v-4"/></svg></a>
    <span class="sep"></span>
    <a title="設定"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg></a>
  </nav>`;
}
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.querySelector('.app').appendChild(t); }
  t.innerHTML = ICON.check.replace('<svg ', '<svg width="18" height="18" ') + '<span>' + msg + '</span>';
  t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 3200);
}
function qs(name) { return new URLSearchParams(location.search).get(name); }
