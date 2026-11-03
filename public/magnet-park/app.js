'use strict';
// ===== 자석 브레이크 놀이공원 · 화면 =====
// ParkUI: 모둠 기기 화면(혼자 하기와 수업 모드가 함께 쓴다)
// 첫 화면과 혼자 하기는 이 파일, 수업 모드(#teacher · #board · #join)는 live.js
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = v => `${Math.round(v).toLocaleString('ko-KR')}만원`;
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
function toast(msg, kind) { const box = $('#toasts'); if (!box) return; const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 3200); }
const RIDE_KINDS = ['drop', 'coaster'];

// ---------- 흔들어 충전 ----------
// 휴대폰·태블릿은 흔들기(가속도 센서), 노트북은 단추를 빠르게 누르기
const ShakeCharge = (function () {
  function open(onDone) {
    const ov = document.createElement('div'); ov.className = 'shake'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '흔들어 충전');
    ov.innerHTML = `<div class="box"><div class="eyebrow">⚡ 흔들어 충전 · 15초</div><h2>코일 속 자석을 움직여라!</h2>
      <svg viewBox="0 0 220 220" aria-hidden="true"><defs><radialGradient id="bulb"><stop offset="0" stop-color="#FFF6C8"/><stop offset="1" stop-color="#FFD166" stop-opacity="0"/></radialGradient></defs>
        <circle id="glow" cx="170" cy="50" r="40" fill="url(#bulb)" opacity="0"/><circle cx="170" cy="50" r="14" fill="#FFE9A0" stroke="#999" stroke-width="2"/>
        <path d="M170 64 v30 h-60" stroke="#E08A4B" stroke-width="3" fill="none"/>
        ${Array.from({ length: 9 }, (_, i) => `<ellipse cx="80" cy="${70 + i * 12}" rx="34" ry="7" fill="none" stroke="#E08A4B" stroke-width="3"/>`).join('')}
        <g id="mag"><rect x="66" y="70" width="28" height="30" fill="#E5484D"/><rect x="66" y="100" width="28" height="30" fill="#3D7BFF"/><text x="80" y="91" fill="#fff" font-size="16" text-anchor="middle" font-weight="700">N</text><text x="80" y="121" fill="#fff" font-size="16" text-anchor="middle" font-weight="700">S</text></g>
        <rect x="20" y="188" width="180" height="10" rx="5" fill="#24204A"/><rect id="meter" x="20" y="188" width="0" height="10" rx="5" fill="#5CC8FF"/></svg>
      <div class="big" id="sk">0.0 kWh</div><p class="muted" id="st">기기를 위아래로 흔들거나, 아래 단추를 빠르게 누르세요.</p>
      <button class="tap" id="tap">⚡ 눌러서 자석 움직이기</button>
      <p class="muted" style="font-size:13px">실제로 손으로 흔들어 만드는 전기는 몇 와트 정도로 아주 적어요. 게임에서는 크게 키워 보너스 전기로 줘요.</p></div>`;
    document.body.appendChild(ov);
    let count = 0, lastMag = null, pos = 0, vel = 0, t0 = performance.now(), done = false;
    const add = (n) => { count += n; vel += n * 18; };
    const onMotion = e => { const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return; const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0); if (lastMag != null && Math.abs(m - lastMag) > 6) add(Math.min(2, Math.abs(m - lastMag) / 8)); lastMag = m; };
    const start = () => { try { if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) DeviceMotionEvent.requestPermission().then(r => { if (r === 'granted') window.addEventListener('devicemotion', onMotion); }).catch(() => {}); else window.addEventListener('devicemotion', onMotion); } catch (e) {} };
    start();
    ov.querySelector('#tap').addEventListener('pointerdown', e => { e.preventDefault(); add(1); });
    const mag = ov.querySelector('#mag'), glow = ov.querySelector('#glow'), meter = ov.querySelector('#meter'), sk = ov.querySelector('#sk');
    function frame(now) {
      if (done) return;
      const left = 15 - (now - t0) / 1000;
      vel += -pos * 0.08; vel *= 0.9; pos += vel * 0.05; pos = Math.max(-30, Math.min(30, pos));
      mag.setAttribute('transform', `translate(0 ${pos})`);
      glow.setAttribute('opacity', Math.min(1, Math.abs(vel) / 30).toFixed(2));
      const kwh = shakeKWh(count); sk.textContent = `${kwh.toFixed(1)} kWh`; meter.setAttribute('width', (kwh / 15 * 180).toFixed(0));
      ov.querySelector('#st').textContent = `남은 시간 ${Math.max(0, left).toFixed(0)}초 · 자석이 빨리 움직일수록 전구가 밝아져요`;
      if (left <= 0) { done = true; window.removeEventListener('devicemotion', onMotion); setTimeout(() => { ov.remove(); onDone(shakeKWh(count)); }, 600); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  return { open };
})();

// ---------- 모둠 기기 화면 ----------
const ParkUI = (function () {
  let ctx = null, draft = null, sel = 0, viewer = null, chartT = 0;
  const FEEL_TONE = k => (FEEL[k] || {}).tone || 'warn';
  function slotName(s) { if (!s) return '빈자리'; return KINDS[s.kind].name; }
  function slotIcon(s) { return s ? KINDS[s.kind].icon : '＋'; }
  function stateFor() { return { money: ctx.money, rep: ctx.rep, battery: ctx.battery }; }
  function pendingCost() { return changeCost(ctx.park, draft); }
  // ctx: { mode, title, day, days, money, rep, battery, weather, events[], park, phase, editable, lastRes, shake, quiz:{Q, mine, reveal}, waitText, clockHTML,
  //        onSave(park), onShake(kwh), onQuiz(i), onStart(), onNext(), onRestart(), backHref }
  function render(root, c) {
    const first = !ctx || ctx.mode !== c.mode;
    const parkChanged = !ctx || JSON.stringify(ctx.park) !== JSON.stringify(c.park);
    ctx = c;
    const baseDraft = JSON.parse(JSON.stringify(cleanPark(c.draft || c.park)));
    if (first || parkChanged || !draft || !c.editable) draft = baseDraft;
    else if (c.own) { // 모둠 공원: 내 자리는 내가 고친 값, 나머지 자리와 전력은 모둠원이 올린 값
      draft = { slots: baseDraft.slots.map((s, i) => c.own.includes(i) ? draft.slots[i] : s), power: c.powerMine ? draft.power : baseDraft.power };
    }
    const W = WEATHER[c.weather] || WEATHER.sun;
    const evs = (c.events || []).map(k => EVENTS[k]).filter(Boolean);
    root.innerHTML = `<div class="wrap">
      <div class="top"><a class="back" href="${c.backHref || '#'}" aria-label="처음으로">←</a><h1>${esc(c.title || '자석 브레이크 놀이공원')}</h1>
        <span class="chip">${Math.min(c.day + 1, c.days)}일째 / ${c.days}일</span><span class="chip">${W.icon} ${W.name}</span>${evs.map(E => `<span class="chip warn" title="${esc(E.text)}">${E.icon} ${E.name}</span>`).join('')}
        <span class="sp"></span>${c.clockHTML || ''}
        <div class="stat money"><small>돈</small><b id="uMoney">${won(c.money)}</b></div><div class="stat"><small>평판</small><b>${Math.round((c.rep || 1) * 100)}%</b></div><div class="stat"><small>배터리</small><b>${Math.round(c.battery || 0)} kWh</b></div></div>
      ${c.banner || ''}${evs.length ? `<div class="card" style="margin-bottom:12px;border-color:var(--pink)">${evs.map(E => `<p><b>${E.icon} 오늘의 사건: ${E.name}</b> · ${esc(E.text)}</p>`).join('')}</div>` : ''}
      <div class="team"><div><div class="stage" id="uStage"><div class="stagebar" id="uBar"></div></div>
        <div class="slots" role="tablist" aria-label="공원 자리">${draft.slots.map((s, i) => `<button role="tab" aria-selected="${i === sel}" class="${i === sel ? 'on' : ''}" data-slot="${i}"><span>${slotIcon(s)}</span><b>${i + 1}</b><small>${slotName(s)}</small>${c.own ? `<em class="${c.own.includes(i) ? 'mine' : ''}">${c.own.includes(i) ? '내 담당' : esc(c.ownerName && c.ownerName(i) ? c.ownerName(i) + ' 담당' : '')}</em>` : ''}</button>`).join('')}</div></div>
        <div class="panel" id="uPanel"></div></div></div>`;
    // 3D
    viewer = viewer || Park3D.viewer();
    const stage = $('#uStage');
    if (viewer) { stage.prepend(viewer.el); viewer.park.build(draft); viewer.park.highlight(c.editable ? sel : -1); viewer.onPick(i => { sel = i; rerender(); }); viewer.park.setDay(c.lastRes && c.phase !== 'design' ? { riders: c.lastRes.riders, weather: c.lastRes.weather, blackout: (c.lastRes.events || []).includes('blackout'), battery: c.battery } : { riders: 600, weather: c.weather, blackout: (c.events || []).includes('blackout'), battery: c.battery }); }
    else stage.innerHTML = '<div style="height:100%;display:grid;place-items:center;padding:20px" class="muted">이 기기에서는 3D 화면을 열 수 없어요. 아래 번호로 자리를 고르세요.</div>';
    root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { sel = +b.dataset.slot; rerender(); });
    renderPanel();
  }
  function rerender() { const root = document.getElementById('app'); if (ctx && root) render(root, Object.assign({}, ctx, { park: ctx.park })); }
  function renderPanel() {
    const P = $('#uPanel'); if (!P) return;
    const c = ctx;
    if (c.phase === 'run') { P.innerHTML = `<div class="card"><h2>🎢 영업 중…</h2><p class="muted">모든 놀이기구가 한 번씩 시운전한 뒤 하루 영업을 해요. 구리판이 빨갛게 빛나는 곳이 유도 전류로 데워지는 곳이에요.</p></div>`; if (viewer && !c.played) { c.played = true; viewer.park.playTest(); } return; }
    if (c.phase === 'result' && c.lastRes) { P.innerHTML = resultHTML(c.lastRes) + (c.onNext ? `<div class="foot"><span class="sp"></span><button class="btn hot lg" id="uNext">${c.quiz ? '📡 과학 퀴즈' : c.day + 1 >= c.days ? '최종 결과 보기' : '다음 날 준비'}</button></div>` : waitHTML()); bindNext(); return; }
    if (c.phase === 'quiz' && c.quiz) { P.innerHTML = quizHTML(c.quiz) + (c.quiz.reveal && c.onNext ? `<div class="foot"><span class="sp"></span><button class="btn hot lg" id="uNext">${c.day + 1 >= c.days ? '최종 결과 보기' : '다음 날 준비'}</button></div>` : c.quiz.reveal ? waitHTML() : ''); P.querySelectorAll('[data-qa]').forEach(b => b.onclick = () => c.onQuiz && c.onQuiz(+b.dataset.qa)); bindNext(); return; }
    if (c.phase === 'end') { P.innerHTML = endHTML(); const r = $('#uRestart'); if (r) r.onclick = () => c.onRestart && c.onRestart(); return; }
    if (c.phase === 'wait') { P.innerHTML = `<div class="card"><h2>${esc(c.waitText || '선생님이 시작할 때까지 기다려요')}</h2><p class="muted">놀이공원 자리를 미리 살펴보세요. 자리를 누르면 무엇을 지을 수 있는지 보여요.</p></div>`; return; }
    // 설계
    const s = draft.slots[sel];
    let html = '';
    if (!c.editable) html += `<div class="card"><p class="muted">지금은 설계 시간이 아니에요.</p></div>`;
    else if (c.own && !c.own.includes(sel)) html += viewHTML(s);
    else if (!s) html += buildHTML();
    else if (RIDE_KINDS.includes(s.kind)) html += rideHTML(s);
    else html += `<div class="card"><h2>${KINDS[s.kind].icon} ${KINDS[s.kind].name}</h2><p>${s.kind === 'solar' ? `맑은 날 하루 ${KINDS.solar.kwh} kWh를 만들어요(흐림·비에는 줄어요). 빛에너지 → 전기 에너지. 전자기 유도가 아닌 광전 효과를 써요.` : `남은 전기를 다음 날로 최대 ${KINDS.battery.cap} kWh까지 넘겨요. 정전 날에 특히 든든해요. 전기 에너지 ↔ 화학 에너지.`}</p>
      <div class="foot" style="margin-top:10px"><button class="btn" id="uRemove">철거 (${won(itemCost(s) * 0.5)} 돌려받기)</button></div></div>`;
    html += energyHTML();
    html += `<div class="foot">${c.shake == null && c.onShake ? `<button class="btn" id="uShake">⚡ 흔들어 충전</button>` : c.shake != null ? `<span class="chip">⚡ 흔들어 충전 ${f1(c.shake)} kWh</span>` : ''}<span class="sp"></span>
      ${c.editable ? `<span class="muted" id="uCost"></span>${c.onStart ? `<button class="btn hot lg" id="uStart">🎟️ 영업 시작</button>` : `<button class="btn hot lg" id="uSave">${c.saveLabel || '설계 저장'}</button>`}` : ''}</div>`;
    P.innerHTML = html;
    bindDesign();
    updateLive();
  }
  function viewHTML(s) {
    const who = esc(ctx.ownerName ? ctx.ownerName(sel) : '다른 모둠원');
    if (!s) return `<div class="card"><h2>${sel + 1}번 빈자리</h2><p class="muted">${who} 담당 자리예요. 무엇을 지을지 함께 의논해 보세요.</p></div>`;
    if (!RIDE_KINDS.includes(s.kind)) return `<div class="card"><h2>${KINDS[s.kind].icon} ${sel + 1}번 ${KINDS[s.kind].name}</h2><p class="muted">${who} 담당</p></div>`;
    const R = simRide(s), K = KINDS[s.kind], F = FEEL[R.feel];
    return `<div class="card"><h2>${K.icon} ${sel + 1}번 ${K.name}</h2><p class="muted" style="margin-bottom:8px">${who} 담당 · 높이 ${s.H} m · ${GRADES[s.grade].name} 자석 ${s.rows}줄 · ${MATERIALS[s.mat].name} · 브레이크 ${s.L} m${s.regen ? ' · 발전 코일' : ''}</p>
      <div class="readout"><div><small>진입 속도</small><b>${f1(R.vIn)} <small>m/s</small></b></div><div><small>최대 감속</small><b class="${R.peakG > K.comfort.strong ? 'down' : ''}">${f1(R.peakG)} <small>g</small></b></div><div><small>끝 속도 / 기준</small><b class="${R.crash ? 'down' : 'up'}">${f1(R.vEnd)} / ${K.safeEnd}</b></div></div>
      <div class="feel ${F.tone}" style="margin-top:8px"><b>${F.label}</b><span>${F.tip}</span></div></div>`;
  }
  function waitHTML() { return `<p class="muted" style="text-align:right">선생님이 다음 단계로 넘길 때까지 기다려요.</p>`; }
  function bindNext() { const n = $('#uNext'); if (n) n.onclick = () => ctx.onNext && ctx.onNext(); }
  function buildHTML() {
    const left = ctx.money - pendingCost();
    return `<div class="card"><h2>${sel + 1}번 자리 · 무엇을 지을까?</h2><p class="muted" style="margin:4px 0 10px">놀이기구는 모두 자석 브레이크로 멈춰요. 전기가 모자라면 태양광·배터리도 필요해요.</p>
      <div class="build">${KIND_ORDER.map(k => { const item = k === 'solar' || k === 'battery' ? { kind: k } : newRide(k); const cst = itemCost(item); return `<button data-build="${k}" ${cst > left ? 'disabled' : ''}><b>${KINDS[k].icon} ${KINDS[k].name}</b><small>${won(cst)}${k === 'solar' ? ` · 맑은 날 ${KINDS.solar.kwh} kWh` : k === 'battery' ? ` · ${KINDS.battery.cap} kWh 저장` : ''}</small></button>`; }).join('')}</div></div>`;
  }
  function rideHTML(s) {
    const K = KINDS[s.kind], rg = K.range;
    const slider = (key, label, unit) => `<label for="r_${key}">${label}</label><input type="range" id="r_${key}" data-k="${key}" min="${rg[key][0]}" max="${rg[key][1]}" step="${rg[key][2]}" value="${s[key]}"><output id="o_${key}">${s[key]}${unit}</output>`;
    return `<div class="card"><h2>${K.icon} ${sel + 1}번 ${K.name}</h2>
      <div class="ctl" style="margin-top:10px">
        ${slider('H', s.kind === 'drop' ? '탑 높이' : '첫 언덕 높이', ' m')}
        ${s.kind === 'drop' ? slider('seats', '좌석 수', '석') : slider('cars', '열차 칸 수', '칸')}
        ${slider('rows', '자석 줄 수', '줄')}
        ${slider('L', '브레이크 구간', ' m')}
      </div>
      <div style="margin-top:10px"><label>자석 세기</label><div class="seg">${GRADES.map((G_, i) => `<button data-grade="${i}" aria-pressed="${s.grade === i}">${G_.name} ${G_.B} T</button>`).join('')}</div></div>
      <div style="margin-top:8px"><label>브레이크 판</label><div class="seg">${MAT_ORDER.map(k => `<button data-mat="${k}" aria-pressed="${s.mat === k}" title="${esc(MATERIALS[k].note)}">${MATERIALS[k].name}</button>`).join('')}</div></div>
      <div style="margin-top:8px"><label>발전 코일(회생 제동)</label><div class="seg"><button data-regen="0" aria-pressed="${!s.regen}">없음</button><button data-regen="1" aria-pressed="${!!s.regen}">달기 +${won(REGEN_COST)} · 제동 에너지 ${Math.round(REGEN_EFF * 100)}% 되찾기</button></div></div>
    </div>
    <div class="card"><div class="readout"><div><small>${s.kind === 'drop' ? '자석 구간 진입 속도' : '브레이크 진입 속도'}</small><b id="vIn"></b></div><div><small>최대 감속</small><b id="pg"></b></div><div><small>끝 속도 / 안전 기준</small><b id="vEnd"></b></div></div>
      <div class="feel" id="feel" style="margin-top:8px"></div>
      <canvas class="chart" id="chart" width="600" height="220" aria-label="속도와 감속 그래프"></canvas>
      <div class="legend"><span><i style="background:#5CC8FF"></i>속도(m/s)</span><span><i style="background:#E08A4B"></i>감속(g)</span><span id="vmin"></span></div>
      <p class="sci" id="sci" style="margin-top:8px"></p>
      <div class="foot" style="margin-top:10px"><button class="btn" id="uTest">▶ 시운전</button><button class="btn" id="uRemove">철거</button><span class="sp"></span><span class="muted" id="perRide"></span></div></div>`;
  }
  function energyHTML() {
    const st = stateFor();
    const r = runDay(draft, st, { weather: ctx.weather, events: ctx.events, shakeKWh: ctx.shake || 0 });
    const E = r.energy, tot = Math.max(E.need, E.supply, 1);
    const seg = (v, col) => v > 0 ? `<i style="width:${Math.min(100, v / tot * 100)}%;background:${col}"></i>` : '';
    const grid = Math.max(0, E.supply - E.solarMade - E.battery - E.shake);
    return `<div class="card"><div class="eyebrow">⚡ 오늘 전기 예상 (끌어올리기 − 되찾은 전기)</div>
      <p style="margin:6px 0">필요 <b class="num">${Math.round(E.need)} kWh</b> · 공급 <b class="num">${Math.round(E.supply)} kWh</b> ${E.f < 1 ? `<span class="chip bad">운행 ${Math.round(E.f * 100)}%로 줄어듦</span>` : '<span class="chip good">충분</span>'}</p>
      <div class="energybar" aria-hidden="true">${seg(grid, '#8B85C1')}${seg(E.solarMade, '#FFD166')}${seg(E.battery, '#4ADE80')}${seg(E.shake, '#5CC8FF')}</div>
      <div class="ekeys"><span style="--c:#8B85C1">계약 전력 ${Math.round(grid)}</span><span style="--c:#FFD166">태양광 ${Math.round(E.solarMade)}</span><span style="--c:#4ADE80">배터리 ${Math.round(E.battery)}</span><span style="--c:#5CC8FF">흔들기 ${f1(E.shake)}</span><span>되찾은 전기 ${Math.round(E.regen)} (빼고 계산)</span></div>
      <div class="foot" style="margin-top:8px">${ctx.editable && ctx.powerMine !== false ? `<span class="muted">계약 전력 +${EXTRA_POWER.step} kWh (하루 ${won(EXTRA_POWER.cost)})</span><button class="btn" id="pMinus" ${draft.power <= 0 ? 'disabled' : ''}>−</button><b class="num">${draft.power}</b><button class="btn" id="pPlus" ${draft.power >= 5 ? 'disabled' : ''}>+</button>` : ''}<span class="sp"></span><span class="muted">예상 손님 ${r.riders.toLocaleString('ko-KR')}명 · 예상 이익 <b class="${r.profit >= 0 ? 'up' : 'down'}">${won(r.profit)}</b></span></div></div>`;
  }
  function bindDesign() {
    const P = $('#uPanel');
    P.querySelectorAll('[data-build]').forEach(b => b.onclick = () => { const k = b.dataset.build; draft.slots[sel] = k === 'solar' || k === 'battery' ? { kind: k } : newRide(k); afterEdit(true); });
    const rm = $('#uRemove'); if (rm) rm.onclick = () => { draft.slots[sel] = null; afterEdit(true); };
    P.querySelectorAll('input[type=range]').forEach(inp => inp.oninput = () => { draft.slots[sel][inp.dataset.k] = +inp.value; const o = $('#o_' + inp.dataset.k); if (o) o.textContent = inp.value + ({ H: ' m', L: ' m', seats: '석', cars: '칸', rows: '줄' }[inp.dataset.k] || ''); afterEdit(false); });
    P.querySelectorAll('input[type=range]').forEach(inp => inp.onchange = () => afterEdit(true, true));
    P.querySelectorAll('[data-grade]').forEach(b => b.onclick = () => { draft.slots[sel].grade = +b.dataset.grade; afterEdit(true); });
    P.querySelectorAll('[data-mat]').forEach(b => b.onclick = () => { draft.slots[sel].mat = b.dataset.mat; afterEdit(true); });
    P.querySelectorAll('[data-regen]').forEach(b => b.onclick = () => { draft.slots[sel].regen = b.dataset.regen === '1'; afterEdit(true); });
    const t = $('#uTest'); if (t && viewer) t.onclick = () => { viewer.park.build(draft); viewer.park.playTest(sel); };
    const pm = $('#pMinus'), pp = $('#pPlus'); if (pm) pm.onclick = () => { draft.power = Math.max(0, draft.power - 1); afterEdit(true); }; if (pp) pp.onclick = () => { draft.power = Math.min(5, draft.power + 1); afterEdit(true); };
    const sk = $('#uShake'); if (sk) sk.onclick = () => ShakeCharge.open(kwh => ctx.onShake && ctx.onShake(kwh));
    const sv = $('#uSave'), stt = $('#uStart');
    const commit = fn => () => { const cost = pendingCost(); if (cost > ctx.money) { toast('돈이 모자라요. 설계를 줄이거나 시설을 철거하세요', 'bad'); return; } fn(cleanPark(draft), cost); };
    if (sv) sv.onclick = commit((p, cost) => ctx.onSave(p, cost));
    if (stt) stt.onclick = commit((p, cost) => ctx.onStart(p, cost));
  }
  function afterEdit(full, keepFocus) {
    draft = cleanPark(draft);
    if (ctx.onDraft) ctx.onDraft(draft, pendingCost());
    if (viewer) { viewer.park.build(draft); viewer.park.highlight(sel); }
    if (full && !keepFocus) { rerender(); return; }
    if (full && keepFocus) { const e = $('#uPanel .card:nth-last-of-type(2)'); void e; refreshEnergy(); }
    updateLive();
  }
  function refreshEnergy() { const P = $('#uPanel'); if (!P) return; const cards = P.querySelectorAll('.card'); const ec = [...cards].find(c => c.querySelector('.energybar')); if (ec) { const tmp = document.createElement('div'); tmp.innerHTML = energyHTML(); ec.replaceWith(tmp.firstElementChild); const pm = $('#pMinus'), pp = $('#pPlus'); if (pm) pm.onclick = () => { draft.power = Math.max(0, draft.power - 1); afterEdit(true); }; if (pp) pp.onclick = () => { draft.power = Math.min(5, draft.power + 1); afterEdit(true); }; } }
  function updateLive() {
    const cost = pendingCost(), um = $('#uMoney'), uc = $('#uCost');
    if (um) um.textContent = won(ctx.money - (ctx.editable ? cost : 0));
    if (uc) uc.innerHTML = cost > 0 ? `설계 비용 <b class="${cost > ctx.money ? 'down' : ''}">${won(cost)}</b>${cost > ctx.money ? ' · 돈 모자람' : ''}` : cost < 0 ? `돌려받는 돈 <b class="up">+${won(-cost)}</b>` : '';
    const s = draft.slots[sel]; if (!s || !RIDE_KINDS.includes(s.kind)) return;
    const R = simRide(s), K = KINDS[s.kind], F = FEEL[R.feel];
    const set = (id, h) => { const e = document.getElementById(id); if (e) e.innerHTML = h; };
    set('vIn', `${f1(R.vIn)} <small>m/s</small>`);
    set('pg', `<span class="${R.peakG > K.comfort.strong ? 'down' : ''}">${f1(R.peakG)}</span> <small>g</small>`);
    set('vEnd', `<span class="${R.crash ? 'down' : 'up'}">${f1(R.vEnd)}</span> / ${K.safeEnd} <small>m/s</small>`);
    const fe = $('#feel'); if (fe) { fe.className = 'feel ' + F.tone; fe.innerHTML = `<b>${F.label}</b><span>${F.tip} · 인기 ${R.thrill}/10</span>`; }
    set('vmin', s.kind === 'drop' && R.c > 0 ? `자석만으로 낼 수 있는 가장 느린 속도 g÷c = ${f1(R.vMin)} m/s` : s.kind === 'coaster' && R.c > 0 ? `자석만으로 멈추는 데 필요한 거리 ${f1(R.distStop)} m` : '');
    set('sci', s.mat === 'pl' ? '플라스틱은 전기가 통하지 않아 유도 전류가 흐르지 못해요. 그래서 자석이 지나가도 제동이 걸리지 않아요.'
      : `탑승차의 자석이 ${MATERIALS[s.mat].name}을 지나면 판을 지나는 자기장이 변해 유도 전류가 흘러요. 이 전류가 만든 자기장이 운동을 방해해 제동이 걸리고, 운동 에너지는 판의 열에너지로 바뀌어요. 빠를수록 세게, 느릴수록 약하게 걸려서 마지막은 ${s.kind === 'drop' ? '유압 완충기' : '승강장 브레이크'}가 받아요.`);
    set('perRide', `한 번 운행: 끌어올리기 ${f1(R.kwh.lift)} kWh${s.regen ? ` · 되찾기 ${f1(R.kwh.regen)} kWh` : ''}`);
    drawChart(R);
    clearTimeout(chartT); chartT = setTimeout(refreshEnergy, 250);
  }
  function drawChart(R) {
    const cv = $('#chart'); if (!cv) return; const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H);
    const sm = R.samples, tMax = sm[sm.length - 1].t || 1, vMax = Math.max(5, ...sm.map(s => s.v)), gMax = Math.max(1, ...sm.map(s => s.g), KINDS[R.ride.kind].comfort.strong);
    const px = t => 40 + (W - 60) * t / tMax, pv = v => H - 26 - (H - 46) * v / vMax, pg = g => H - 26 - (H - 46) * g / gMax;
    x.strokeStyle = '#35306A'; x.lineWidth = 1; x.beginPath(); x.moveTo(40, H - 26); x.lineTo(W - 20, H - 26); x.stroke();
    // 안전 끝 속도·너무 센 감속 기준선
    x.setLineDash([5, 5]); x.strokeStyle = 'rgba(92,200,255,.5)'; x.beginPath(); x.moveTo(40, pv(KINDS[R.ride.kind].safeEnd)); x.lineTo(W - 20, pv(KINDS[R.ride.kind].safeEnd)); x.stroke();
    x.strokeStyle = 'rgba(251,113,133,.6)'; x.beginPath(); x.moveTo(40, pg(KINDS[R.ride.kind].comfort.strong)); x.lineTo(W - 20, pg(KINDS[R.ride.kind].comfort.strong)); x.stroke(); x.setLineDash([]);
    const line = (f, col) => { x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); sm.forEach((s, i) => { const X = px(s.t), Y = f(s); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); };
    line(s => pv(s.v), '#5CC8FF'); line(s => pg(s.g), '#E08A4B');
    x.fillStyle = '#A9A3C9'; x.font = '18px sans-serif'; x.fillText('0', 24, H - 20); x.fillText(`${f1(tMax)} s`, W - 70, H - 6); x.fillText(`${Math.round(vMax)} m/s`, 2, 16);
  }
  function resultHTML(r) {
    const E = r.energy;
    const W = WEATHER[r.weather] || WEATHER.sun;
    const left = [['전력망', E.grid, '#8B85C1'], ['태양광', E.solar, '#FFD166'], ['배터리', E.battery, '#4ADE80'], ['흔들기', E.shake, '#5CC8FF'], ['되찾은 전기', E.regen, '#8CE7FF']].filter(x => x[1] > 0.05);
    const right = [['끌어올린 위치 에너지 → 브레이크 열', E.heat, '#E08A4B'], ['되찾아 다시 씀', E.regen, '#8CE7FF']].filter(x => x[1] > 0.05);
    return `<div class="card result"><div class="eyebrow">${W.icon} ${W.name} ${(r.events || []).map(k => EVENTS[k] ? EVENTS[k].icon + ' ' + EVENTS[k].name : '').join(' ')}</div><h2>오늘의 영업 결과</h2>
      <div class="kpis"><div><small>손님</small><b>${r.riders.toLocaleString('ko-KR')}</b></div><div><small>수입</small><b>${won(r.income)}</b></div><div><small>전기·벌금·수리</small><b>${won(r.powerCost + r.fines + r.repair)}</b></div><div><small>이익</small><b class="${r.profit >= 0 ? 'up' : 'down'}">${won(r.profit)}</b></div></div>
      <div class="eyebrow">에너지 흐름 (kWh)</div>
      <div class="flow"><div class="col">${left.map(([n, v, c]) => `<div class="bar" style="background:${c}"><span>${n}</span><span>${f1(v)}</span></div>`).join('') || '<span class="muted">없음</span>'}</div>
        <div class="mid">→ 끌어올리기 ${f1(E.lift)} →</div>
        <div class="col">${right.map(([n, v, c]) => `<div class="bar" style="background:${c}"><span>${n}</span><span>${f1(v)}</span></div>`).join('')}</div></div>
      <p class="muted" style="font-size:13px">전력망 전기 ${f1(E.grid)} kWh → 이산화 탄소 약 ${f1(r.co2)} kg · 되찾은 전기 비율 ${E.lift ? Math.round(E.regen / E.lift * 100) : 0}%</p>
      ${r.notes.length ? `<ul class="notes">${r.notes.map(n => `<li class="${n.tone}">${esc(n.t)}</li>`).join('')}</ul>` : ''}
      <div class="ridelist">${r.rides.map(x => `<div><span>${KINDS[x.kind].icon} ${x.i + 1}번</span><span>${FEEL[x.feel].label} · 감속 ${f1(x.peakG)}g · 끝 속도 ${f1(x.vEnd)} m/s</span><b class="num">${x.riders.toLocaleString('ko-KR')}명</b></div>`).join('')}</div>
      ${r.quizBonus ? `<p class="up" style="margin-top:6px">📡 과학 퀴즈 보너스 +${won(r.quizBonus)}</p>` : ''}</div>`;
  }
  function quizHTML(q) {
    const Q = q.Q;
    return `<div class="card quiz"><div class="eyebrow">📡 과학 퀴즈 · 맞히면 안전 교육 지원금 +150만원</div><h2 style="font-size:21px;font-family:var(--body);font-weight:700">${Q.q}</h2>
      <div class="opts">${Q.a.map((a, i) => { let c = ''; if (q.reveal) { if (i === Q.c) c = 'right'; else if (q.mine === i) c = 'wrong'; } else if (q.mine === i) c = 'on'; return `<button class="${c}" data-qa="${i}" ${q.reveal ? 'disabled' : ''}><span>${'ABCD'[i]}</span>${a}</button>`; }).join('')}</div>
      ${q.reveal ? `<p class="sci">${Q.e}</p>` : ''}</div>`;
  }
  function endHTML() {
    const c = ctx, score = finalScore(c.money, c.park);
    const hist = c.hist || [];
    const regen = hist.reduce((a, r) => a + (r.energy ? r.energy.regen : 0), 0), lift = hist.reduce((a, r) => a + (r.energy ? r.energy.lift : 0), 0), co2 = hist.reduce((a, r) => a + (r.co2 || 0), 0), riders = hist.reduce((a, r) => a + (r.riders || 0), 0), crashes = hist.reduce((a, r) => a + r.rides.filter(x => x.feel === 'crash').length, 0);
    return `<div class="card final"><div class="eyebrow">${c.days}일 영업 끝</div><div class="score">${score.toLocaleString('ko-KR')}</div><p class="muted">최종 점수 = 돈 ${won(c.money)} + 시설 값의 절반 ${won(parkValue(c.park) * 0.5)}</p>
      <div class="kpis" style="text-align:left"><div><small>총 손님</small><b>${riders.toLocaleString('ko-KR')}</b></div><div><small>되찾은 전기</small><b>${Math.round(regen)} kWh</b><small>${lift ? Math.round(regen / lift * 100) : 0}%</small></div><div><small>이산화 탄소</small><b>${Math.round(co2)} kg</b></div><div><small>충돌 사고</small><b class="${crashes ? 'down' : 'up'}">${crashes}번</b></div></div>
      <p class="sci" style="text-align:left">돌아보기: 자석 브레이크는 운동 에너지를 열로 바꾸고, 발전 코일은 그중 일부를 전기로 되찾았어요. 끌어올리는 데 쓴 전기 중 몇 %를 되찾았나요? 정전 날 자석 브레이크가 멈추지 않은 까닭을 전자기 유도로 설명해 보세요.</p>
      ${c.onRestart ? `<div class="foot" style="justify-content:center;margin-top:10px"><button class="btn hot lg" id="uRestart">새 놀이공원 만들기</button></div>` : ''}</div>`;
  }
  return { render, get draft() { return draft; } };
})();

// ---------- 첫 화면 ----------
function renderHome() {
  document.body.classList.remove('boardmode');
  let saved = null; try { saved = JSON.parse(localStorage.getItem('cg-park-solo') || 'null'); } catch (e) {}
  $('#app').innerHTML = `<div class="wrap home">
    <div class="top"><a class="back" href="/" aria-label="게임 목록으로">←</a><span class="chip">통합과학2 · 02 발전과 신재생 에너지 · 전자기 유도와 에너지 전환</span></div>
    <h1>자석 브레이크 놀이공원</h1>
    <p class="lead">자이로드롭과 롤러코스터를 <b>자석 브레이크</b>로 안전하고 짜릿하게 멈춰라! 전자기 유도로 생긴 유도 전류가 운동을 방해하는 원리로, 놀이기구를 설계하고 전기를 아끼며 놀이공원을 키워요.</p>
    <div class="modes">
      <div class="card mode"><div class="eyebrow">혼자 또는 짝 · 기기 1대</div><h2>혼자 하기</h2><p class="muted">선생님 화면 없이 ${DAYS_DEFAULT}일 동안 놀이공원을 운영해요. 날씨와 사건은 무작위.</p>
        <div class="row"><button class="btn hot" id="hNew">새 놀이공원</button>${saved && saved.phase !== 'end' ? `<button class="btn" id="hCont">이어서 (${saved.day + 1}일째)</button>` : ''}</div></div>
      <div class="card mode"><div class="eyebrow">반 전체 · 학생마다 휴대폰</div><h2>수업 참여</h2><p class="muted">선생님이 알려 준 수업 코드를 넣고 이름과 모둠을 고르세요. 모둠원이 공원 자리를 나눠 맡아 함께 지어요. 전자칠판에 모든 모둠의 공원이 함께 떠요.</p>
        <div class="row"><input type="text" id="hCode" inputmode="numeric" maxlength="8" placeholder="수업 코드" style="max-width:150px"><button class="btn hot" id="hJoin">참여</button></div></div>
      <div class="card mode"><div class="eyebrow">교사</div><h2>교사 화면</h2><p class="muted">수업을 만들고 영업일을 진행해요. 정전·폭염·안전 점검 같은 사건을 일으킬 수 있어요.</p>
        <div class="row"><a class="btn" href="#teacher">교사 화면 열기</a></div></div>
    </div>
    <div class="how"><div><b>1. 설계</b>높이·좌석, 자석 세기·줄 수, 브레이크 판(구리·알루미늄·플라스틱), 브레이크 구간 길이를 정해요.</div>
      <div><b>2. 시운전</b>속도와 감속(g)을 그래프로 확인. 끝 속도가 너무 빠르면 충돌, 감속이 너무 크면 손님이 아파요.</div>
      <div><b>3. 전기</b>탑승차를 끌어올리는 데 전기가 들어요. 발전 코일로 제동 에너지를 되찾고, 태양광·배터리·흔들어 충전으로 버텨요.</div>
      <div><b>4. 영업</b>날씨와 사건 속에서 손님을 받고 돈을 벌어요. 마지막 날 점수를 비교해요.</div></div></div>`;
  $('#hNew').onclick = () => { localStorage.removeItem('cg-park-solo'); Solo.start(true); };
  const hc = $('#hCont'); if (hc) hc.onclick = () => Solo.start(false);
  $('#hJoin').onclick = () => { const c = $('#hCode').value.trim(); if (c) location.hash = "#join/" + c; };
}

// ---------- 혼자 하기 ----------
const Solo = (function () {
  let S = null;
  const save = () => { try { localStorage.setItem('cg-park-solo', JSON.stringify(S)); } catch (e) {} };
  function start(fresh) {
    try { S = fresh ? null : JSON.parse(localStorage.getItem('cg-park-solo') || 'null'); } catch (e) { S = null; }
    if (!S) S = { code: String(1000 + Math.floor(Math.random() * 9000)), day: 0, days: DAYS_DEFAULT, park: cleanPark({ slots: [] }), money: START_MONEY, rep: 1, battery: 0, phase: 'design', hist: [], shake: {}, quiz: {} };
    if (location.hash !== '#solo') history.replaceState(null, '', '#solo');
    draw();
  }
  function evToday() { const e = soloEvent(S.code, S.day); return e ? [e] : []; }
  function draw() {
    const root = $('#app'); document.body.classList.remove('boardmode');
    const Q = quizFor(S.code, S.day), qa = S.quiz[S.day];
    ParkUI.render(root, {
      mode: 'solo', title: '자석 브레이크 놀이공원', day: S.day, days: S.days, money: S.money, rep: S.rep, battery: S.battery,
      weather: dayWeather(S.code, S.day), events: evToday(), park: S.park, phase: S.phase, editable: S.phase === 'design',
      lastRes: S.hist[S.day], shake: S.shake[S.day] == null ? null : S.shake[S.day], hist: S.hist, backHref: '#',
      quiz: S.phase === 'quiz' ? { Q, mine: qa, reveal: qa != null } : (S.phase === 'result' ? true : null),
      onShake(k) { S.shake[S.day] = k; save(); toast(`⚡ ${f1(k)} kWh 충전!`, 'good'); draw(); },
      onStart(p, cost) {
        S.money -= cost; S.park = p; S.phase = 'run'; save(); draw();
        setTimeout(() => {
          const r = runDay(S.park, S, { weather: dayWeather(S.code, S.day), events: evToday(), shakeKWh: S.shake[S.day] || 0 });
          S.hist[S.day] = r; S.money = r.money; S.rep = r.rep; S.battery = r.battery; S.phase = 'result'; save(); draw();
        }, 6500);
      },
      onQuiz(i) { if (S.quiz[S.day] != null) return; S.quiz[S.day] = i; if (i === Q.c) { S.money += 150; toast('정답! +150만원', 'good'); } save(); draw(); },
      onNext() {
        if (S.phase === 'result') { S.phase = 'quiz'; save(); draw(); return; }
        if (S.day + 1 >= S.days) { S.phase = 'end'; save(); draw(); return; }
        S.day++; S.phase = 'design'; save(); draw();
      },
      onRestart() { localStorage.removeItem('cg-park-solo'); start(true); },
    });
  }
  return { start };
})();

// ---------- 길 찾기 ----------
function route() {
  if (typeof LIVE !== 'undefined' && LIVE.claims()) { LIVE.start(); return; }
  if (typeof LIVE !== 'undefined') LIVE.stop();
  if (location.hash === '#solo') Solo.start(false); else renderHome();
}
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
if (document.readyState !== 'loading') setTimeout(route, 0);
