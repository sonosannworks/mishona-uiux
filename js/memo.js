/* プレゼン用ツールバーと提案メモ。各ページで window.PAGE を用意してから読み込む
   PAGE = { id, title, points:[{t,b,ref,for}], extra:[{title, points}], before:'images/..', tools:[{label,id,onclick}] } */
(function () {
  const P = window.PAGE;
  const pages = [
    { id: 'calendar', href: 'calendar.html', label: '画面1 カレンダー' },
    { id: 'add', href: 'add.html', label: '画面2 予約追加' },
    { id: 'confirm', href: 'add.html?demo=confirm', label: '画面3 確認' },
    { id: 'settings', href: 'settings.html', label: '画面4 予約設定' },
    { id: 'today', href: 'today.html', label: '画面5 今朝の確認' }
  ];
  const nAll = P.points.length + (P.extra || []).reduce((n, x) => n + x.points.length, 0);
  const bar = document.createElement('div');
  bar.className = 'pbar';
  bar.innerHTML = `
    <div class="ttl"><b>L Message 予約管理 改善提案</b>薗田信広_ミショナUIUX課題</div>
    <div class="grp">${pages.map(p => `<a class="pbtn ${(p.id === P.id && !(P.id === 'add' && qs('demo') === 'confirm')) || (p.id === 'confirm' && qs('demo') === 'confirm') ? 'on' : ''}" href="${p.href}">${p.label}</a>`).join('')}
      <a class="pbtn" href="index.html">一覧</a></div>
    <div class="grp">
      <button class="pbtn" id="pMarks" aria-pressed="false">注釈を表示</button>
      <button class="pbtn" id="pMemo" aria-pressed="false">提案メモ <span class="n">${nAll}</span></button>
      ${(P.tools || []).map(t => `<button class="pbtn" id="${t.id}">${t.label}</button>`).join('')}
    </div>
    <button class="pbtn sp" id="pReset" title="このプロトタイプで登録・変更した内容を消して、最初の状態に戻します">最初から</button>`;
  document.body.prepend(bar);

  const listHTML = (pts, start) => '<ol>' + pts.map((p, i) => `<li><span class="num">${start + i}</span><div><b>${p.t}</b>：${p.b}${p.ref ? `<span class="ref">${p.ref}</span>` : ''}</div></li>`).join('') + '</ol>';
  let n = 1, body = `<h3 class="t-head">${P.title}</h3>` + listHTML(P.points, n); n += P.points.length;
  const beforeHTML = (src, title) => `<h3 class="t-head">${title}</h3><div class="before"><a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="改善前の画面" onerror="this.closest('a').remove()"></a><div class="ph">改善前のスクリーンショットを <b>${src}</b> に置くと、ここに表示されます。</div></div><p class="zoom">画像を押すと、別のタブで大きく表示されます</p>`;
  if (P.extra && P.extra.some(x => x.before)) body += beforeHTML(P.before, '改善前（現在のUI）');
  (P.extra || []).forEach(x => { body += `<h3 class="t-head">${x.title}</h3>` + listHTML(x.points, n); n += x.points.length; if (x.before) body += beforeHTML(x.before, '改善前（現在のUI）'); });
  if (!(P.extra && P.extra.some(x => x.before))) body += `<h3 class="t-head">改善前（現在のUI）</h3><div class="before"><a href="${P.before}" target="_blank" rel="noopener"><img src="${P.before}" alt="改善前の画面" onerror="this.closest('a').remove()"></a><div class="ph">改善前のスクリーンショットを <b>${P.before}</b> に置くと、ここに表示されます。</div></div><p class="zoom">画像を押すと、別のタブで大きく表示されます</p>`;
  const memo = document.createElement('aside');
  memo.className = 'memo';
  memo.innerHTML = `<div class="memo-head"><div><b>提案メモ</b><small>赤い数字は画面の上の注釈と対応しています</small></div><button class="x" aria-label="閉じる">×</button></div><div class="memo-body t-body">${body}</div>`;
  document.body.appendChild(memo);

  const app = document.querySelector('.app');
  const rt = document.createElement('div');
  rt.className = 'railtools';
  rt.innerHTML = '<span class="lbl">提案</span><button class="rtbtn" id="rMarks" aria-pressed="false" title="注釈の表示・非表示">注釈</button><button class="rtbtn" id="rMemo" aria-pressed="false" title="提案メモの表示・非表示">メモ</button>';
  app.appendChild(rt);
  const allPts = P.points.concat(...(P.extra || []).map(x => x.points));
  window.placeMarks = function () {
    app.querySelectorAll('.mk').forEach(m => m.remove());
    const a = app.getBoundingClientRect();
    allPts.forEach((p, i) => {
      if (P.showMark && !P.showMark(i)) return;
      const el = p.for && document.querySelector(p.for);
      if (!el || !el.getClientRects().length) return;
      const r = el.getBoundingClientRect();
      const m = document.createElement('span');
      m.className = 'mk'; m.textContent = i + 1;
      m.style.left = (r.left - a.left - 10) + 'px'; m.style.top = (r.top - a.top - 10) + 'px';
      app.appendChild(m);
    });
  };
  const setMarks = on => { document.body.classList.toggle('marks-on', on); document.getElementById('pMarks').setAttribute('aria-pressed', on); document.getElementById('rMarks').setAttribute('aria-pressed', on); if (on) placeMarks(); };
  const setMemo = on => { memo.classList.toggle('open', on); document.getElementById('pMemo').setAttribute('aria-pressed', on); document.getElementById('rMemo').setAttribute('aria-pressed', on); if (on) setMarks(true); };
  document.getElementById('pMarks').onclick = () => setMarks(!document.body.classList.contains('marks-on'));
  document.getElementById('pMemo').onclick = () => setMemo(!memo.classList.contains('open'));
  memo.querySelector('.x').onclick = () => setMemo(false);
  document.getElementById('rMarks').onclick = () => setMarks(!document.body.classList.contains('marks-on'));
  document.getElementById('rMemo').onclick = () => setMemo(!memo.classList.contains('open'));
  document.getElementById('pReset').onclick = () => { Store.reset(); location.href = P.id === 'add' ? 'add.html' : P.id === 'settings' ? 'settings.html' : P.id === 'today' ? 'today.html' : 'calendar.html'; };
  (P.tools || []).forEach(t => document.getElementById(t.id).onclick = t.onclick);
  window.refreshMarks = () => { if (document.body.classList.contains('marks-on')) placeMarks(); };
  window.addEventListener('resize', window.refreshMarks);
  if (qs('memo') === '1') setMemo(true);
})();
