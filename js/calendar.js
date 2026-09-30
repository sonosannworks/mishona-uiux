/* 画面1：予約カレンダー（日表示）の描画。calendar.html と、add.html の背景で使う */
function calendarHTML(dk) {
  const day = SALON.days[dk], st = Store.get();
  const ng = SALON.staff.filter(s => !st.gcal[s.id]);
  const idx = DAY_KEYS.indexOf(dk);
  const gItems = SALON.staff.map(s => st.gcal[s.id]
    ? `<span class="item"><span class="dot ok"></span>${s.name}：連携中</span>`
    : `<span class="item"><span class="dot ng"></span><b style="font-weight:600">${s.name}：連携が外れています</b>（この間の予約はGoogleに入りません）</span>`).join('<span class="div"></span>');
  return `
  <div class="crumb t-opt"><a>カレンダー一覧</a>　›　予約管理</div>
  <div class="title-row">
    <h1 class="t-title">${SALON.name}</h1>
    <div class="actions">
      <button class="btn btn-outline" data-act="shift"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M12 10v6M9 13h6"/></svg>シフト追加</button>
      <a class="btn btn-primary" id="addBtn" href="add.html?d=${dk}">${ICON.plus}予約を追加</a>
    </div>
  </div>
  <nav class="tabs">
    <a href="today.html">本日／新着の予約</a><a class="active" href="calendar.html?d=${dk}">予約カレンダー</a><a>コース・スタッフ</a><a href="settings.html" id="tabSettings">予約設定</a><a>決済連携<span class="pill">利用なし</span></a>
  </nav>
  <div class="status-row">
    <div class="status grow ${ng.length ? 'warn' : 'ok'}" id="gStatus">
      ${ng.length ? ICON.warn : '<span class="dot ok"></span>'}
      <span class="lbl">Googleカレンダー</span>${gItems}
      ${ng.length ? `<button class="link" data-act="reconnect" data-id="${ng[0].id}" style="margin-left:auto">つなぎ直す</button>` : ''}
    </div>
    <div class="status" id="multiStatus"><span class="lbl">同時予約</span><span>${{none:'制限なし',ask:'重なったら確かめる',limit:'1人'+st.multiLimit+'件まで'}[st.multi]}</span><a class="link" href="settings.html?open=multi">設定を見る</a></div>
  </div>
  <div class="toolbar">
    <button class="btn" data-go="${DAY_KEYS[0]}">今日</button>
    <button class="iconbtn" aria-label="前の日" data-go="${DAY_KEYS[Math.max(0, idx - 1)]}" ${idx === 0 ? 'disabled style="opacity:.4"' : ''}>‹</button>
    <div class="datebox">${ICON.cal.replace('<svg ', '<svg width="16" height="16" ')}${day.label}</div>
    <button class="iconbtn" aria-label="次の日" data-go="${DAY_KEYS[Math.min(DAY_KEYS.length - 1, idx + 1)]}" ${idx === DAY_KEYS.length - 1 ? 'disabled style="opacity:.4"' : ''}>›</button>
    <div class="seg" style="margin-left:8px"><button class="on">日</button><button>週</button><button>月</button><button>一覧</button></div>
    <div class="select">スタッフ：すべて<span style="color:var(--gray)">▾</span></div>
    <div class="search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#b4b4b4" stroke-width="2"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>お客様名・電話番号で検索</div>
  </div>
  <div class="tl" id="tl">
    <div class="tl-head"><div class="staff-h">スタッフ</div><div class="hours">${[...Array(10)].map((_, i) => `<span style="left:${i * 10}%">${9 + i}:00</span>`).join('')}</div></div>
    ${SALON.staff.map(sf => rowHTML(dk, sf)).join('')}
    ${noneRowHTML(dk)}
  </div>
  <div class="legend" id="legend">
    <span class="lg"><span class="sw rsv"></span>予約</span>
    <span class="lg"><span class="sw gcal"></span>予定あり（Google）</span>
    <span class="lg"><span class="sw break"></span>休憩</span>
    <span class="lg"><span class="sw off"></span>お休み</span>
    <span class="lg"><span class="sw outside"></span>シフト外</span>
    <span class="lg"><span class="sw pending"></span>担当未定</span>
    <span class="toggles"><span class="t-opt" style="color:var(--gray)">表示</span>
      <span class="chip on">${ICON.check}予約</span><span class="chip on">${ICON.check}Googleの予定</span><span class="chip">前後の空き時間</span></span>
  </div>`;
}

function rowHTML(dk, sf) {
  const day = SALON.days[dk], sh = day.shifts[sf.id], on = gcalOn(sf.id);
  const meta = sh ? sh.map(([a, b]) => hhmm(a) + '–' + hhmm(b)).join('・') : `お休み（${day.offNote[sf.id]}）`;
  let lane = '';
  if (!sh) {
    lane = `<div class="blk off" data-why="off" data-staff="${sf.id}"><span class="t">お休み（${day.offNote[sf.id]}）</span><span>この日は予約を受け付けていません</span><button class="link" data-act="workday">この日だけ出勤にする</button></div>`;
  } else {
    blocksOf(dk, sf.id).forEach(b => {
      lane += `<div class="blk ${b.type}" style="left:${pct(b.s)};width:calc(${pct(b.e)} - ${pct(b.s)})" data-why="${b.type}" data-staff="${sf.id}" data-s="${b.s}" data-e="${b.e}">${b.type === 'break' ? '休憩' : 'シフト外'}</div>`;
    });
    const evs = eventsOf(dk).filter(ev => ev.staff === sf.id).sort((a, b) => a.s - b.s);
    evs.forEach((ev, i) => {
      // 重ねて登録された予約は上下に分けて、どちらも見えるようにする
      const ov = evs.some((o, j) => j !== i && o.type !== 'gcal' && ev.type !== 'gcal' && overlap(o.s, o.e, ev.s, ev.e));
      const half = ov ? (evs.findIndex(o => overlap(o.s, o.e, ev.s, ev.e) && o.type !== 'gcal') === i ? 'top:8px;bottom:58px;' : 'top:58px;bottom:8px;') : '';
      const pos = `${half}left:${pct(ev.s)};width:calc(${pct(ev.e)} - ${pct(ev.s)})`;
      if (ev.type === 'gcal') lane += `<div class="blk gcal" style="${pos}" data-why="gcal" data-staff="${sf.id}" data-s="${ev.s}" data-e="${ev.e}"><span class="gtag">${ICON.gcal}予定あり</span><span class="cs">Google</span></div>`;
      else lane += `<div class="blk rsv${ov ? ' ov' : ''}" id="ev-${ev.id}" style="${pos}" title="${hhmm(ev.s)}〜${hhmm(ev.e)}"><div class="nm">${ev.name}様</div>${ov ? '' : `<div class="cs">${ev.course}</div>`}</div>`;
    });
    // 担当未定の予約を確保中として表示
    eventsOf(dk).filter(ev => ev.staff === 'none').forEach(ev => {
      const c = candidateFor(dk, ev);
      if (c && c.id === sf.id) lane += `<div class="blk hold" style="left:${pct(ev.s)};width:calc(${pct(ev.e)} - ${pct(ev.s)})" data-why="hold" data-staff="${sf.id}" data-name="${ev.name}"><span class="badge warn">確保中</span><div class="cs" style="margin-top:2px">${ev.name.split(' ')[0]}様</div></div>`;
    });
    // 同じお客様のしるし
    for (let i = 0; i < evs.length - 1; i++) {
      const a = evs[i], b = evs[i + 1];
      if (a.name && a.name === b.name) {
        const m1 = (a.s + a.e) / 2, m2 = (b.s + b.e) / 2;
        lane += `<div class="same" style="left:${pct(m1)};width:calc(${pct(m2)} - ${pct(m1)})"><span>同じお客様</span></div>`;
      }
    }
    // 空き枠（1時間単位）
    for (let t = T0; t < T1; t += 60) {
      if (!busyReason(dk, sf.id, t, t + 60)) lane += `<a class="free" style="left:${pct(t)};width:calc(${pct(t + 60)} - ${pct(t)})" href="add.html?d=${dk}&staff=${sf.id}&t=${t}">＋ 予約を追加</a>`;
    }
  }
  return `<div class="tl-row">
    <div class="staff">
      <div class="name">${ICON.person('var(--main)')}${sf.name}</div>
      <div class="meta">${meta}</div>
      <div class="g ${on ? '' : 'ng'}"><span class="dot ${on ? 'ok' : 'ng'}"></span>Google ${on ? '連携中' : '連携切れ'}</div>
    </div>
    <div class="lane" data-lane="${sf.id}">${lane}</div>
  </div>`;
}

function noneRowHTML(dk) {
  const working = SALON.staff.filter(s => SALON.days[dk].shifts[s.id]).map(s => s.name).join('・') || 'なし';
  let lane = '';
  eventsOf(dk).filter(ev => ev.staff === 'none').forEach(ev => {
    const c = candidateFor(dk, ev);
    lane += `<div class="blk pending" id="ev-${ev.id}" style="left:${pct(ev.s)};width:calc(${pct(ev.e)} - ${pct(ev.s)})">
      <span class="badge warn">担当未定</span><div class="nm" style="margin-top:2px">${ev.name}様</div>
      ${c ? `<button class="assign" data-act="assign" data-id="${ev.id}" data-to="${c.id}">${c.short}に割り当てる</button>` : '<span class="cs">対応できる人がいません</span>'}</div>`;
  });
  return `<div class="tl-row">
    <div class="staff">
      <div class="name">${ICON.person('#b4b4b4')}指定なし</div>
      <div class="meta">対応できる人：${working}</div>
      <div class="meta">自動割り当て：なし　<a class="link" style="font-size:12px">設定</a></div>
    </div>
    <div class="lane" data-lane="none">${lane}</div>
  </div>`;
}

/* 予約できない枠を押したときの理由 */
function reasonPop(el, dk) {
  const sid = el.dataset.staff, sf = staffById(sid), why = el.dataset.why;
  const s = +el.dataset.s, e = +el.dataset.e, time = s ? `${hhmm(s)}〜${hhmm(e)}` : '';
  const t = {
    gcal: [ICON.gcal + '予定あり（Googleカレンダー）', `${sf.name} のGoogleカレンダーに予定があるため、<b style="font-weight:600">${time}</b> は予約を受け付けていません。`, 'スタッフの予定の内容は表示しません。', 'それでも予約を追加'],
    break: ['休憩時間', `${sf.name} の休憩時間（${time}）です。`, 'シフトの時間は「シフト追加」で変えられます。', 'それでも予約を追加'],
    outside: ['シフト外', `${sf.name} のこの日のシフトは ${SALON.days[dk].shifts[sid].map(([a, b]) => hhmm(a) + '〜' + hhmm(b)).join('・')} です。`, '', 'それでも予約を追加'],
    hold: ['担当未定の予約で確保中', `指定なしで入った ${el.dataset.name} 様の予約を、この時間に対応できる ${sf.name} の枠で確保しています。`, '「指定なし」の行で担当を決めると、確定します。', '']
  }[why];
  if (!t) return null;
  const p = document.createElement('div');
  p.className = 'pop';
  p.innerHTML = `<h4>${t[0]}</h4><p>${t[1]}</p>${t[2] ? `<p class="note">${t[2]}</p>` : ''}
    <div class="row"><button class="btn" data-close>閉じる</button>${t[3] ? `<a class="btn btn-outline" href="add.html?d=${dk}&staff=${sid}&t=${s}">${t[3]}</a>` : ''}</div>`;
  return p;
}

function placePop(pop, el, app) {
  const a = app.getBoundingClientRect(), r = el.getBoundingClientRect();
  let left = r.left - a.left - 20, top = r.bottom - a.top + 10;
  left = Math.max(70, Math.min(left, 1280 - 340));
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  pop.style.setProperty('--arrow', Math.max(16, Math.min(290, r.left - a.left + r.width / 2 - left - 6)) + 'px');
}
