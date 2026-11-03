'use strict';
// ===== 자석 브레이크 놀이공원 · 수업 모드 =====
// #teacher        교사 화면 (Google 로그인, 영업일 진행·사건, 진행 계산은 이 화면만 한다)
// #board/코드     전자칠판 (모든 모둠 놀이공원 3D, 결과, 최종 순위)
// #join/코드      학생 휴대폰 (이름·모둠 → 내 담당 자리 설계·흔들어 충전·퀴즈). 모둠원이 공원 하나를 나눠 짓는다.
// 데이터: 교사만 씀 parks/코드/{meta, live, res/모둠, scores/uid}
//         학생 자기 uid만 parks/코드/{players/uid, design/uid, shake/날/uid, quiz/날/uid}
// 자리 담당: 설계 시작 때 live.own[모둠] = 모둠원 uid 목록(들어온 순서). i번 자리 = own[(i+1) % 인원], 계약 전력 = own[0](에너지 팀장)
const LIVE = (function () {
  const DEF = { designSec: 180, runSec: 9, resSec: 40, quizSec: 25, qresSec: 8 };
  const SUB = { lobby: '접속 대기', design: '설계 시간', run: '영업 중', result: '영업 결과', quiz: '과학 퀴즈', quizres: '퀴즈 정답', end: '영업 끝' };
  const TIMED = ['design', 'run', 'result', 'quiz', 'quizres'];
  const pp = code => 'parks/' + String(code).replace(/[.#$\[\]\/]/g, '_');
  const arr = v => Array.isArray(v) ? v.filter(x => x != null) : v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : [];
  const normRes = r => r ? Object.assign({}, r, { events: arr(r.events), notes: arr(r.notes), rides: arr(r.rides), missions: arr(r.missions) }) : null;
  const qrImg = (text, px) => `<img src="data:image/svg+xml,${encodeURIComponent(qrSVG(text))}" width="${px}" height="${px}" alt="모둠 기기 접속 QR 코드">`;
  const teamURL = code => `${location.origin}${location.pathname}${location.search.includes('local') ? '?local' : ''}#join/${code}`;
  let cur = null, R = blank();
  function blank() { return { meta: null, live: null, res: {}, players: {}, design: {}, shake: {}, quiz: {}, scores: {} }; }

  // ---------- 공통 ----------
  function claims() { return /^#(teacher|board|join)/.test(location.hash); }
  function parseHash() { const m = location.hash.match(/^#(teacher|board|join)(?:\/([0-9A-Za-z_-]+))?/); return m ? { view: m[1], code: m[2] || null } : null; }
  function stopAll() { if (!cur) return; cur.unsubs.forEach(f => { try { f(); } catch (e) {} }); clearInterval(cur.timer); clearInterval(cur.tick); clearTimeout(cur.draftT); cur = null; }
  function start() {
    stopAll();
    const p = parseHash(); if (!p) return false;
    cur = { view: p.view, code: p.code, unsubs: [], pending: false, sig: '' };
    document.body.classList.toggle('boardmode', p.view === 'board');
    R = blank();
    if (p.view === 'teacher') teacherStart();
    else { if (!p.code) { location.hash = ''; return true; } NET.ensureAnon().then(() => { if (cur) subscribe(cur.code); }).catch(e => toast('연결 실패: ' + (e.code || e.message), 'bad')); render(); }
    cur.tick = setInterval(tickClocks, 250);
    return true;
  }
  function subscribe(code) {
    const base = pp(code);
    const w = k => cur.unsubs.push(NET.watch(base + '/' + k, v => { R[k] = v == null ? (k === 'meta' || k === 'live' ? null : {}) : v; schedule(); }));
    w('meta'); w('live'); w('res'); w('players'); w('design'); w('shake'); w('quiz'); w('scores');
  }
  function schedule() { if (!cur || cur.pending) return; cur.pending = true; setTimeout(() => { if (!cur) return; cur.pending = false; render(); }, 30); }
  function render() {
    if (!cur) return;
    const ae = document.activeElement;
    const typing = ae && /^(SELECT|TEXTAREA)$/.test(ae.tagName) || (ae && ae.tagName === 'INPUT' && ae.type !== 'range');
    if ((dragging || typing) && ae && ae.closest && ae.closest('#app') && !ae.closest('.setup')) { clearTimeout(cur.deferT); cur.deferT = setTimeout(schedule, 700); return; }
    if (cur.view === 'teacher') renderTeacher(); else if (cur.view === 'board') renderBoard(); else renderTeam();
  }
  const M = () => R.meta || {};
  const L = () => R.live || {};
  const order = () => arr(M().order);
  const G = gid => (M().groups || {})[gid] || { name: gid };
  const resOf = gid => { const r = (R.res || {})[gid] || {}; return { money: r.money == null ? START_MONEY : r.money, rep: r.rep == null ? 1 : r.rep, battery: r.battery || 0, park: cleanPark(r.park), hist: r.hist || {} }; };
  let dragging = false;
  window.addEventListener('pointerdown', () => { dragging = true; }, true);
  window.addEventListener('pointerup', () => { dragging = false; }, true);
  window.addEventListener('pointercancel', () => { dragging = false; }, true);
  // 모둠원(들어온 순서)과 자리 담당
  const membersNow = gid => Object.keys(R.players || {}).filter(u => (R.players[u] || {}).g === gid).sort((a, b) => ((R.players[a].t || 0) - (R.players[b].t || 0)) || (a < b ? -1 : 1));
  const membersOf = gid => { const o = (L().own || {})[gid]; if (L().sub === 'lobby' || !L().own) return membersNow(gid); return arr(o).filter(u => R.players && R.players[u]); };
  const ownerOf = (gid, i, mem) => { mem = mem || membersOf(gid); return mem.length ? mem[(i + 1) % mem.length] : null; };
  const nameOf = uid => esc(((R.players || {})[uid] || {}).name || '?');
  const ownSlots = (gid, uid) => { const mem = membersOf(gid); return Array.from({ length: SLOTS }, (_, i) => i).filter(i => ownerOf(gid, i, mem) === uid); };
  const readyOf = (uid, day) => { const d = (R.design || {})[uid]; return !!(d && d.ready === day); };
  // 모둠원이 올린 설계를 합친 공원(아직 적용 전)
  function groupDraft(gid, day) {
    const base = resOf(gid).park, mem = membersOf(gid), out = { slots: base.slots.slice(), power: base.power };
    for (let i = 0; i < SLOTS; i++) { const d = (R.design || {})[ownerOf(gid, i, mem)]; if (!d || d.g !== gid || d.day !== day || !d.slots || d.slots[i] == null) continue; const v = d.slots[i]; out.slots[i] = v.kind === 'none' ? null : v; }
    const chief = (R.design || {})[mem[0]]; if (chief && chief.g === gid && chief.day === day && chief.power != null) out.power = chief.power;
    return cleanPark(out);
  }
  const shakeOf = (gid, day) => { const mem = membersOf(gid); if (!mem.length) return 0; const sh = (R.shake || {})[day] || {}; return Math.round(Math.min(15, mem.reduce((a, u) => a + (Number(sh[u]) || 0), 0) / mem.length) * 10) / 10; };
  const quizOf = (uid, day) => { const q = ((R.quiz || {})[day] || {})[uid]; return q ? q.a : null; };
  const histList = gid => { const h = resOf(gid).hist; return Object.keys(h).sort((a, b) => a - b).map(k => normRes(h[k])); };
  function leftMs() { const l = L(); return l.paused ? (l.left || 0) : Math.max(0, (l.deadline || 0) - NET.now()); }
  function tickClocks() {
    const l = R.live; if (!l) return;
    const left = leftMs(), on = TIMED.includes(l.sub);
    document.querySelectorAll('[data-clock]').forEach(e => { e.textContent = on ? `${Math.ceil(left / 1000)}초${l.paused ? ' ⏸' : ''}` : ''; });
    document.querySelectorAll('[data-bar]').forEach(e => { e.style.width = on && l.total ? `${Math.max(0, Math.min(100, left / l.total * 100))}%` : '0%'; });
  }
  const clockHTML = () => `<span class="clock" data-clock></span>`;

  // =====================================================================
  //  교사 화면 + 진행 계산
  // =====================================================================
  function teacherStart() {
    NET.ready.then(() => NET.onAuth(() => {
      if (!cur || cur.view !== 'teacher') return;
      if (NET.isTeacher() && !cur.opened) { let code = cur.code; try { code = code || localStorage.getItem('cg-park-teacher-code'); } catch (e) {} if (code) openRoom(code); }
      schedule();
    }));
    renderTeacher();
  }
  async function openRoom(code) {
    if (!cur) return;
    if (NET.mode === 'fb') {
      let meta = null; try { meta = await NET.get(pp(code) + '/meta'); } catch (e) {}
      if (!meta || (meta.owner && meta.owner !== NET.user.uid)) {
        try { if (localStorage.getItem('cg-park-teacher-code') === code) localStorage.removeItem('cg-park-teacher-code'); } catch (e) {}
        if (meta) toast(`수업 ${code}은(는) 다른 선생님(${meta.ownerEmail || '다른 계정'})의 수업이라 열 수 없어요`, 'bad');
        if (location.hash !== '#teacher') history.replaceState(null, '', '#teacher');
        schedule(); return;
      }
    }
    if (!cur) return;
    cur.unsubs.forEach(f => f()); cur.unsubs = [];
    cur.code = code; cur.opened = true; R = blank();
    try { localStorage.setItem('cg-park-teacher-code', code); } catch (e) {}
    if (location.hash !== '#teacher/' + code) history.replaceState(null, '', '#teacher/' + code);
    subscribe(code);
    clearInterval(cur.timer); cur.timer = setInterval(hostTick, 400);
  }
  const base = () => pp(cur.code);
  function liveUpdate(obj) { const c = {}; for (const k in obj) c[base() + '/live/' + k] = obj[k]; return NET.update(c); }
  function stageChanges(sub, sec, extra) {
    const l = L(), ch = {};
    const v = Object.assign({ sub, step: (l.step || 0) + 1, deadline: NET.now() + sec * 1000, total: sec * 1000, paused: false, left: null }, extra || {});
    for (const k in v) ch[base() + '/live/' + k] = v[k];
    return ch;
  }
  async function createRoom(form) {
    let code = '';
    for (let i = 0; i < 6; i++) { code = String(1000 + Math.floor(Math.random() * 9000)); const ex = await NET.get(pp(code) + '/meta').catch(() => null); if (!ex) break; }
    const groups = {}, ord = [];
    for (let i = 1; i <= form.n; i++) { groups['g' + i] = { name: `${i}모둠` }; ord.push('g' + i); }
    const u = NET.user || {};
    const meta = { title: '자석 브레이크 놀이공원', created: NET.now(), owner: u.uid, ownerEmail: (u.email || '').toLowerCase(), groups, order: ord, days: form.days, designSec: form.designSec, autoEv: form.autoEv };
    await NET.put(pp(code) + '/meta', meta);
    const ch = { [pp(code) + '/live']: { sub: 'lobby', day: 0, step: 1, deadline: 0, total: 1 }, [pp(code) + '/res']: null, [pp(code) + '/players']: null, [pp(code) + '/design']: null, [pp(code) + '/shake']: null, [pp(code) + '/quiz']: null, [pp(code) + '/scores']: null };
    await NET.update(ch);
    const ch2 = {}; for (const g of ord) ch2[`${pp(code)}/res/${g}`] = { money: START_MONEY, rep: 1, battery: 0, park: cleanPark({}) };
    await NET.update(ch2);
    openRoom(code);
  }
  function designStart(day) {
    const ev = M().autoEv ? soloEvent(cur.code, day) : null;
    const own = {}; for (const g of order()) { const m = membersNow(g); if (m.length) own[g] = m; }
    return stageChanges('design', M().designSec || DEF.designSec, { day, own: Object.keys(own).length ? own : null, events: ev ? [ev] : null, notice: ev ? { t: NET.now(), day } : null });
  }
  async function hostTick() {
    if (!cur || cur.view !== 'teacher' || !NET.isTeacher() || !R.meta || !R.live) return;
    const l = L(); if (l.paused || !TIMED.includes(l.sub)) return;
    const now = NET.now();
    // 모든 모둠이 설계를 저장하면 5초 뒤 시작
    if (l.sub === 'design' && cur.short !== l.step && l.deadline - now > 6000) {
      const all = order().flatMap(g => membersOf(g));
      if (all.length && all.every(u => readyOf(u, l.day))) { cur.short = l.step; liveUpdate({ deadline: now + 5000 }); toast('모든 학생이 설계를 마쳤어요. 5초 뒤 영업 시작', 'good'); }
    }
    if (now < l.deadline || cur.busy === l.step) return;
    cur.busy = l.step;
    try { await advance(); } catch (e) { console.warn(e); toast('진행 오류: ' + (e.code || e.message), 'bad'); cur.busy = null; }
  }
  async function advance() {
    const l = L(), day = l.day || 0, code = cur.code, b = base();
    if (l.sub === 'design') {
      const ch = stageChanges('run', DEF.runSec);
      const weather = dayWeather(code, day), events = arr(l.events);
      for (const g of order()) {
        const r0 = resOf(g), want = groupDraft(g, day), mem = membersOf(g), skipped = [];
        // 돈이 모자라면 그 자리 변경은 빼고 적용(앞 번호 자리부터)
        let park = { slots: r0.park.slots.slice(), power: want.power };
        if (changeCost(r0.park, park) > r0.money) park.power = r0.park.power;
        for (let i = 0; i < SLOTS; i++) {
          if (JSON.stringify(want.slots[i]) === JSON.stringify(r0.park.slots[i])) continue;
          const tryP = { slots: park.slots.slice(), power: park.power }; tryP.slots[i] = want.slots[i];
          if (changeCost(r0.park, tryP) <= r0.money) park = tryP; else skipped.push(i);
        }
        park = cleanPark(park);
        const cost = changeCost(r0.park, park), sk = shakeOf(g, day);
        const r = runDay(park, { money: r0.money - cost, rep: r0.rep, battery: r0.battery }, { weather, events, shakeKWh: sk, missions: dayMissions(code, day), day });
        r.day = day;
        if (skipped.length) r.notes.unshift({ tone: 'bad', t: `돈이 모자라 ${skipped.map(i => i + 1).join('·')}번 자리 설계를 적용하지 못했어요` });
        if (cost) r.notes.unshift({ tone: 'warn', t: `설계 비용 ${won(cost)}` });
        if (sk) r.notes.push({ tone: 'good', t: `모둠원 흔들어 충전 평균 ${f1(sk)} kWh` });
        // 개인 기여: 내 담당 놀이기구 손님
        for (const x of r.rides) { const u = ownerOf(g, x.i, mem); if (u) { x.owner = u; const sc = (R.scores || {})[u] || {}; ch[`${b}/scores/${u}/riders`] = (sc.riders || 0) + x.riders; } }
        r.cost = cost;
        ch[`${b}/res/${g}/money`] = r.money; ch[`${b}/res/${g}/rep`] = r.rep; ch[`${b}/res/${g}/battery`] = r.battery; ch[`${b}/res/${g}/park`] = park;
        ch[`${b}/res/${g}/hist/${day}`] = r;
      }
      ch[`${b}/live/weather`] = weather;
      await NET.update(ch);
    } else if (l.sub === 'run') await NET.update(stageChanges('result', DEF.resSec));
    else if (l.sub === 'result') await NET.update(stageChanges('quiz', DEF.quizSec));
    else if (l.sub === 'quiz') {
      const ch = stageChanges('quizres', DEF.qresSec), Q = quizFor(code, day);
      for (const g of order()) {
        const mem = membersOf(g); if (!mem.length) continue;
        const ok = mem.filter(u => quizOf(u, day) === Q.c);
        for (const u of ok) { const sc = (R.scores || {})[u] || {}; ch[`${b}/scores/${u}/quiz`] = (sc.quiz || 0) + 1; }
        const bonus = Math.round(150 * ok.length / mem.length);
        if (bonus) { const r0 = resOf(g); ch[`${b}/res/${g}/money`] = Math.round((r0.money + bonus) * 10) / 10; ch[`${b}/res/${g}/hist/${day}/quizBonus`] = bonus; }
      }
      await NET.update(ch);
    } else if (l.sub === 'quizres') {
      if (day + 1 >= (M().days || DAYS_DEFAULT)) await NET.update(stageChanges('end', 0, { deadline: 0, total: 1 }));
      else await NET.update(designStart(day + 1));
    }
  }
  function renderTeacher() {
    const root = $('#app'); if (!root) return;
    const u = NET.user, teacher = NET.isTeacher();
    const top = `<div class="top"><a class="back" href="#" aria-label="처음으로">←</a><h1>놀이공원 · 교사</h1><span class="muted">${NET.mode === 'local' ? '로컬 모드(이 기기 안에서만)' : NET.mode === 'fb' ? '실시간 연결됨' : '연결 중…'}</span><span class="sp"></span>
      ${u && !u.isAnonymous && !u.local ? `<span class="muted">${esc(u.email || '')}</span><button class="btn" id="tOut">로그아웃</button>` : ''}</div>`;
    if (NET.mode === 'init') { root.innerHTML = `<div class="wrap">${top}<div class="card">연결 중…</div></div>`; return; }
    if (!teacher) {
      root.innerHTML = `<div class="wrap">${top}<div class="card"><h2>교사 로그인</h2><p class="muted" style="margin:6px 0 12px">수업 만들기와 진행은 등록된 교사 Google 계정으로만 할 수 있어요. 교사 등록은 200년 생존기 교사 화면의 「교사 관리」에서 관리자가 해요.</p>
        ${u && !u.isAnonymous ? `<p class="err">${esc(u.email)} 계정은 교사로 등록되어 있지 않아요.</p>` : ''}<button class="btn hot lg" id="tIn">Google 계정으로 로그인</button></div></div>`;
      $('#tIn').onclick = () => NET.teacherLogin().then(() => schedule()).catch(e => toast('로그인 실패: ' + (e.code || e.message), 'bad'));
      const o = $('#tOut'); if (o) o.onclick = () => NET.logout();
      return;
    }
    if (!cur.code || !R.meta) return renderSetup(root, top);
    renderControl(root, top);
  }
  function renderSetup(root, top) {
    root.innerHTML = `<div class="wrap">${top}<div class="card setup"><h2>새 수업 만들기</h2>
      <div class="tgrid" style="margin-top:12px">
        <div><label for="sN">모둠 수(기기 수)</label><select id="sN">${[2, 3, 4, 5, 6, 7, 8].map(n => `<option ${n === 6 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label for="sD">영업일 수</label><select id="sD">${[3, 4, 5, 6, 7].map(n => `<option ${n === DAYS_DEFAULT ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label for="sT">설계 시간</label><select id="sT">${[[120, '2분'], [180, '3분'], [240, '4분'], [300, '5분']].map(([v, n]) => `<option value="${v}" ${v === DEF.designSec ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label><input type="checkbox" id="sE" checked> 3·5일째 자동 사건</label><p class="muted" style="font-size:13px">끄면 사건은 교사가 직접 일으켜요.</p></div>
      </div>
      <div class="foot" style="margin-top:14px"><span class="sp"></span><button class="btn hot lg" id="sGo">수업 만들기</button></div>
      <p class="muted" style="margin-top:10px">한 판 진행: 설계 ${'→'} 영업 ${'→'} 결과 ${'→'} 과학 퀴즈를 영업일마다 되풀이해요. 하루에 약 4~6분, 5일이면 25분 정도.</p></div></div>`;
    $('#sGo').onclick = async () => {
      $('#sGo').disabled = true;
      try { await createRoom({ n: +$('#sN').value, days: +$('#sD').value, designSec: +$('#sT').value, autoEv: $('#sE').checked }); }
      catch (e) { toast('만들기 실패: ' + (e.code || e.message), 'bad'); $('#sGo').disabled = false; }
    };
    const o = $('#tOut'); if (o) o.onclick = () => NET.logout();
  }
  function renderControl(root, top) {
    const l = L(), m = M(), day = l.day || 0, days = m.days || DAYS_DEFAULT, evs = arr(l.events), evEditable = l.sub === 'lobby' || l.sub === 'design';
    const Q = quizFor(cur.code, day), total = Object.keys(R.players || {}).length;
    const rows = order().map(g => {
      const r = resOf(g), mem = membersOf(g), h = r.hist[day] ? normRes(r.hist[day]) : null;
      const nReady = mem.filter(u => readyOf(u, day)).length, nQuiz = mem.filter(u => quizOf(u, day) != null).length, nOk = mem.filter(u => quizOf(u, day) === Q.c).length;
      const late = membersNow(g).filter(u => !mem.includes(u));
      return `<tr><td><b>${esc(G(g).name)}</b></td>
        <td><div class="members">${mem.concat(late).map(u => `<button class="chip ${readyOf(u, day) && l.sub === 'design' ? 'good' : ''}" data-kick="${esc(u)}" title="눌러서 내보내기">${nameOf(u)}${late.includes(u) ? ' (다음 날부터)' : ''}</button>`).join('') || '<span class="muted">아직 없음</span>'}</div></td>
        <td>${l.sub === 'design' ? `${nReady}/${mem.length} 완료` : r.park.slots.map(s => s ? KINDS[s.kind].icon : '').join('') || '—'}</td>
        <td class="num">${won(r.money)}</td><td class="num">${Math.round(r.rep * 100)}%</td>
        <td class="num ${h ? (h.profit >= 0 ? 'up' : 'down') : ''}">${h ? won(h.profit) : '—'}</td>
        <td>${l.sub === 'quiz' ? `${nQuiz}/${mem.length} 응답` : l.sub === 'quizres' || (h && h.quizBonus) ? `${nOk}/${mem.length} 정답` : '—'}</td></tr>`;
    }).join('');
    root.innerHTML = `<div class="wrap">${top}
      <div class="card"><div class="thead"><div><small class="muted">수업 코드</small><div class="code">${esc(cur.code)}</div></div>${qrImg(teamURL(cur.code), 96)}
        <div style="flex:1;min-width:220px"><p class="muted" style="font-size:14px">학생 휴대폰 주소: <b>${esc(teamURL(cur.code))}</b> · 접속 ${total}명</p>
          <div class="tbtns" style="margin-top:8px"><a class="btn" href="#board/${esc(cur.code)}" target="_blank" rel="noopener">📺 전자칠판 열기</a><button class="btn" id="cNew">새 수업</button></div></div></div></div>
      <div class="card"><div class="foot" style="flex-wrap:wrap"><div><div class="eyebrow">${SUB[l.sub] || ''}</div><h2>${l.sub === 'end' ? '영업이 끝났어요' : `${day + 1}일째 / ${days}일`} ${l.weather && l.sub !== 'design' && l.sub !== 'lobby' ? (WEATHER[l.weather] || {}).icon || '' : ''}</h2></div>
        ${clockHTML()}<span class="sp"></span>
        ${l.sub === 'lobby' ? `<button class="btn hot lg" id="cStart">▶ 1일째 설계 시작</button>` : l.sub === 'end' ? '' : `<button class="btn" id="cPause">${l.paused ? '▶ 계속' : '⏸ 멈춤'}</button><button class="btn" id="cMore">+30초</button><button class="btn hot" id="cNext">다음 단계 ▶</button>`}</div>
        <div class="tbar" style="margin-top:8px"><i data-bar></i></div>
        ${l.sub === 'lobby' ? '<p class="muted" style="margin-top:8px;font-size:14px">설계를 시작하는 순간의 모둠원으로 자리 담당이 정해져요(들어온 순서대로 1번 학생이 에너지 팀장). 늦게 들어온 학생은 다음 날부터 자리를 맡아요.</p>' : ''}</div>
      <div class="card"><h3>오늘의 사건 ${evEditable ? '<span class="muted">설계 시간까지 바꿀 수 있어요</span>' : '<span class="muted">다음 날 설계 때 고를 수 있어요</span>'}</h3>
        <div class="evs" style="margin-top:8px">${EVENT_ORDER.map(k => `<button data-ev="${k}" aria-pressed="${evs.includes(k)}" ${evEditable ? '' : 'disabled'}><span>${EVENTS[k].icon}</span><b>${EVENTS[k].name}</b><small>${esc(EVENTS[k].text)}</small></button>`).join('')}</div>
        <p style="margin-top:10px"><b>📋 오늘의 의뢰</b> ${dayMissions(cur.code, day).map(k => `${MISSIONS[k].icon} ${MISSIONS[k].name}(${esc(missionText(k, day))}, +${won(MISSIONS[k].reward)})`).join(' · ')}</p>
        <p class="muted" style="margin-top:8px;font-size:13px">오늘 날씨: ${WEATHER[dayWeather(cur.code, day)].icon} ${WEATHER[dayWeather(cur.code, day)].name} (수업 코드로 정해져요)</p></div>
      <div class="card scroll"><table class="ttable"><thead><tr><th>모둠</th><th>모둠원 (눌러서 내보내기)</th><th>${l.sub === 'design' ? '설계' : '시설'}</th><th>돈</th><th>평판</th><th>${day + 1}일째 이익</th><th>퀴즈</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${l.sub === 'quiz' || l.sub === 'quizres' ? `<div class="card"><div class="eyebrow">📡 오늘의 퀴즈 · 모둠 보너스 = 150만원 × 정답 비율</div><p><b>${Q.q}</b></p><p class="muted">정답: ${'ABCD'[Q.c]}. ${Q.a[Q.c]}</p></div>` : ''}
    </div>`;
    tickClocks();
    const on = (id, f) => { const e = $('#' + id); if (e) e.onclick = f; };
    on('tOut', () => NET.logout());
    on('cNew', () => { if (!confirm('새 수업을 만들까요? 지금 수업은 그대로 남아요.')) return; cur.unsubs.forEach(f => f()); cur.unsubs = []; cur.code = null; cur.opened = false; R = blank(); try { localStorage.removeItem('cg-park-teacher-code'); } catch (e) {} history.replaceState(null, '', '#teacher'); renderTeacher(); });
    on('cStart', () => NET.update(designStart(0)));
    on('cNext', () => { cur.busy = null; liveUpdate({ paused: false, deadline: NET.now() - 1 }); });
    on('cPause', () => l.paused ? liveUpdate({ paused: false, deadline: NET.now() + (l.left || 5000) }) : liveUpdate({ paused: true, left: leftMs() }));
    on('cMore', () => liveUpdate(l.paused ? { left: (l.left || 0) + 30000, total: (l.total || 0) + 30000 } : { deadline: (l.deadline || NET.now()) + 30000, total: (l.total || 0) + 30000 }));
    root.querySelectorAll('[data-ev]').forEach(bt => bt.onclick = () => {
      const k = bt.dataset.ev, now = arr(L().events), next = now.includes(k) ? now.filter(x => x !== k) : now.concat(k);
      liveUpdate({ events: next.length ? next : null, notice: next.length > now.length ? { t: NET.now(), day } : (L().notice || null) });
    });
    root.querySelectorAll('[data-kick]').forEach(bt => bt.onclick = () => {
      const u = bt.dataset.kick, p = (R.players || {})[u]; if (!p || !confirm(`${p.name} 학생을 내보낼까요? 맡은 자리는 남은 모둠원에게 넘어가요.`)) return;
      const ch = { [`${base()}/players/${u}`]: null, [`${base()}/design/${u}`]: null };
      const own = L().own || {}; for (const g in own) { const a = arr(own[g]); if (a.includes(u)) { const left = a.filter(x => x !== u); ch[`${base()}/live/own/${g}`] = left.length ? left : null; } }
      NET.update(ch).then(() => toast(`${p.name} 학생을 내보냈어요`, 'good'));
    });
  }

  // =====================================================================
  //  전자칠판
  // =====================================================================
  function renderBoard() {
    const root = $('#app'); if (!root) return;
    const l = L(), m = M(), day = l.day || 0, ord = order();
    if (!R.meta) { root.innerHTML = `<div class="bd"><div class="bd-band"><h2>수업 ${esc(cur.code)}을(를) 불러오는 중… 코드가 맞는지 확인하세요.</h2></div></div>`; return; }
    const sig = JSON.stringify([l.sub, l.step, day, arr(l.events), l.own, R.res, R.players, R.design, (R.quiz || {})[day], !!document.fullscreenElement]);
    if (sig === cur.sig) return; cur.sig = sig;
    const evs = arr(l.events), W = WEATHER[dayWeather(cur.code, day)];
    const head = `<div class="bd-head"><h1>🎢 자석 브레이크 놀이공원</h1>
      <div class="bd-join">${qrImg(teamURL(cur.code), 58)}<div><small>휴대폰으로 접속</small><b>${esc(cur.code)}</b></div></div>
      <div class="phase"><span>${l.sub === 'end' ? '영업 끝' : `${day + 1}일째 / ${m.days || DAYS_DEFAULT}일 · ${SUB[l.sub] || ''}`}</span><b data-clock></b><div class="tbar"><i data-bar></i></div></div>
      <button class="btn" id="bFull">${document.fullscreenElement ? '전체화면 끄기' : '⛶ 전체화면'}</button></div>`;
    let band = '';
    if (l.sub === 'lobby') band = `<div class="bd-band"><h2>휴대폰으로 QR을 찍고 이름과 모둠을 고르세요 · 접속 ${Object.keys(R.players || {}).length}명 · 모둠원이 공원 자리를 나눠 맡아요</h2></div>`;
    else if (l.sub === 'design') band = `<div class="bd-band ${evs.length ? 'ev' : ''}"><h2>${W.icon} ${W.name} · 내 담당 자리의 놀이기구와 자석 브레이크를 설계하세요 ${evs.map(k => `· ${EVENTS[k].icon} ${EVENTS[k].name}`).join(' ')}</h2>
      <p class="bd-mis">📋 오늘의 의뢰 ${dayMissions(cur.code, day).map(k => `<span>${MISSIONS[k].icon} <b>${MISSIONS[k].name}</b> ${esc(missionText(k, day))} <em>+${won(MISSIONS[k].reward)}</em></span>`).join('')}</p></div>`;
    else if (l.sub === 'run') band = `<div class="bd-band"><h2>🎟️ 영업 중… 탑승차가 자석 구간을 지날 때 구리판이 빨갛게 데워져요 (운동 에너지 → 열에너지)</h2></div>`;
    else if (l.sub === 'result') band = `<div class="bd-band"><h2>오늘의 결과 · 돈을 가장 많이 번 모둠과 전기를 가장 많이 되찾은 모둠은?</h2>${recordsHTML(day)}</div>`;
    else if (l.sub === 'quiz' || l.sub === 'quizres') { const Q = quizFor(cur.code, day); band = `<div class="bd-band"><h2>📡 ${Q.q}</h2><p style="font-size:18px;margin-top:4px">${Q.a.map((a, i) => `<span style="margin-right:14px;${l.sub === 'quizres' && i === Q.c ? 'color:var(--gold);font-weight:700' : ''}">${'ABCD'[i]}. ${a}</span>`).join('')}</p>${l.sub === 'quizres' ? `<p class="muted" style="margin-top:4px">${Q.e}</p>` : ''}</div>`; }
    const body = l.sub === 'end' ? endBoardHTML() : `<div class="bd-grid n${ord.length}">${ord.map(g => cardHTML(g, l, day)).join('')}</div>`;
    let ov = '';
    const n = l.notice;
    if (n && evs.length && l.sub === 'design' && NET.now() - (n.t || 0) < 9000 && cur.ovSeen !== n.t) ov = `<div class="bd-ov" id="bOv"><div class="box">${evs.map(k => `<div class="ic">${EVENTS[k].icon}</div><h2>${EVENTS[k].name}</h2><p>${esc(EVENTS[k].text)}</p>`).join('')}<p class="muted" style="margin-top:12px;font-size:16px">누르면 닫혀요</p></div></div>`;
    root.innerHTML = `<div class="bd"><div class="bd-gl" id="bGl"></div>${head}${band}${body}</div>${ov}`;
    tickClocks();
    const bf = $('#bFull'); if (bf) bf.onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} setTimeout(() => { cur.sig = ''; schedule(); }, 300); };
    const o = $('#bOv'); if (o) { const t = n.t; o.onclick = () => { cur.ovSeen = t; o.remove(); }; setTimeout(() => { if (cur) cur.ovSeen = t; const e = $('#bOv'); if (e) e.remove(); }, Math.max(1000, 9000 - (NET.now() - t))); }
    if (l.sub !== 'end' && ParkBoard.available() && ParkBoard.init($('#bGl'))) {
      ParkBoard.sync(ord.map(g => {
        const r = resOf(g), h = r.hist[day] ? normRes(r.hist[day]) : null;
        const park = l.sub === 'design' || l.sub === 'lobby' ? groupDraft(g, day) : r.park;
        const showDay = h && l.sub !== 'design' && l.sub !== 'lobby';
        return { id: g, el: root.querySelector(`[data-view="${g}"]`), park, day: { riders: showDay ? h.riders : 500, weather: showDay ? h.weather : dayWeather(cur.code, day), blackout: evs.includes('blackout'), battery: r.battery } };
      }));
      if (l.sub === 'run' && cur.played !== l.step) { cur.played = l.step; ParkBoard.playAll(); }
    }
  }
  function cardHTML(g, l, day) {
    const r = resOf(g), mem = membersOf(g), h = r.hist[day] ? normRes(r.hist[day]) : null, park = l.sub === 'design' || l.sub === 'lobby' ? groupDraft(g, day) : r.park;
    let live = '', row = '';
    const chips = f => `<div class="members">${mem.map(u => f(u)).join('') || '<span class="muted">모둠원 없음</span>'}</div>`;
    if (l.sub === 'lobby') row = chips(u => `<span>${nameOf(u)}</span>`);
    else if (l.sub === 'design') { const c = changeCost(r.park, park); row = chips(u => `<span class="${readyOf(u, day) ? 'ok' : ''}">${readyOf(u, day) ? '✅ ' : ''}${nameOf(u)}</span>`) + (c ? `<span class="muted">설계 비용 ${won(c)}${c > r.money ? ' · 돈 모자람!' : ''}</span>` : ''); }
    else if ((l.sub === 'result' || l.sub === 'quiz' || l.sub === 'quizres') && h) {
      const ratio = h.energy.lift ? Math.round(h.energy.regen / h.energy.lift * 100) : 0, crash = h.rides.filter(x => x.feel === 'crash').length;
      live = `<div class="bd-live"><span>👥 ${h.riders.toLocaleString('ko-KR')}명</span><span class="${h.profit >= 0 ? 'up' : 'down'}">${h.profit >= 0 ? '+' : ''}${won(h.profit)}</span><span>♻️ 되찾은 전기 ${ratio}%</span>${h.energy.f < 1 ? `<span class="down">⚡ 운행 ${Math.round(h.energy.f * 100)}%</span>` : ''}${crash ? `<span class="down">💥 충돌 ${crash}</span>` : ''}</div>`;
      const Q = quizFor(cur.code, day);
      row = l.sub === 'result' ? `${h.missions.map(x => MISSIONS[x.k] ? `<span class="chip ${x.ok ? 'good' : ''}">${MISSIONS[x.k].icon} ${x.ok ? '✅' : '❌'}</span>` : '').join('')}<span class="muted">이산화 탄소 ${f1(h.co2)} kg</span>` : chips(u => { const a = quizOf(u, day); return `<span class="${a == null ? '' : l.sub === 'quizres' ? (a === Q.c ? 'ok' : '') : 'ok'}">${a == null ? '…' : l.sub === 'quizres' ? (a === Q.c ? '⭕' : '❌') : '✔'} ${nameOf(u)}</span>`; });
    }
    return `<div class="bd-card"><header><b>${esc(G(g).name)}</b><span class="muted">${park.slots.map(s => s ? KINDS[s.kind].icon : '').join(' ')}</span><span class="m">${won(r.money)}</span></header>
      <div class="bd-view" data-view="${g}">${live}</div><div class="bd-row sub">${row}</div></div>`;
  }
  // 반 기록판: 지금까지 가장 빠른·높은·인기 있는 놀이기구(사고 난 것은 빼고)
  function records(upTo) {
    const all = [];
    for (const g of order()) histList(g).forEach((h, d) => { if (d > upTo) return; h.rides.forEach(x => { if (x.feel !== 'crash' && x.feel !== 'stall' && x.riders > 0) all.push(Object.assign({ g, d }, x)); }); });
    const top = f => all.length ? all.reduce((a, b) => f(b) > f(a) ? b : a) : null;
    const nm = x => `${esc(G(x.g).name)} ${x.name ? `「${esc(x.name)}」` : KINDS[x.kind].name}`;
    const out = [];
    const sp = top(x => x.vIn); if (sp) out.push(['⚡', '최고 속도', nm(sp), `${f1(sp.vIn)} m/s`]);
    const hi = top(x => x.kind === 'drop' ? x.H : -1); if (hi && hi.kind === 'drop') out.push(['🗼', '가장 높은 자이로드롭', nm(hi), `${hi.H} m`]);
    const th = top(x => x.thrill); if (th) out.push(['⭐', '인기 최고', nm(th), `${th.thrill} / ${THRILL_MAX}`]);
    const lp = top(x => x.loop || 0); if (lp && lp.loop) out.push(['🌀', '가장 큰 루프', nm(lp), `${lp.loop * 2} m`]);
    return out;
  }
  function recordsHTML(day) { const rc = records(day); return rc.length ? `<p class="bd-mis">🏅 반 기록 ${rc.map(([ic, n, who, v]) => `<span>${ic} ${n} <b>${who}</b> <em>${v}</em></span>`).join('')}</p>` : ''; }
  function teamStats(g) {
    const r = resOf(g), hs = histList(g);
    const sum = k => hs.reduce((a, h) => a + (k(h) || 0), 0);
    const lift = sum(h => h.energy.lift), regen = sum(h => h.energy.regen);
    return { g, name: G(g).name, score: finalScore(r.money, r.park), money: r.money, riders: sum(h => h.riders), co2: sum(h => h.co2), ratio: lift ? regen / lift : 0, crash: sum(h => h.rides.filter(x => x.feel === 'crash').length), strong: sum(h => h.rides.filter(x => x.feel === 'strong').length), sweet: sum(h => h.rides.filter(x => x.feel === 'sweet').length) };
  }
  function endBoardHTML() {
    const st = order().map(teamStats).sort((a, b) => b.score - a.score);
    const pick = (f, filt) => { const c = st.filter(filt || (() => true)); return c.length ? c.reduce((a, b) => f(b) > f(a) ? b : a) : null; };
    const aw = [
      ['♻️', '에너지 되찾기왕', pick(s => s.ratio, s => s.ratio > 0), s => `끌어올린 전기의 ${Math.round(s.ratio * 100)}% 되찾음`],
      ['🌱', '저탄소 놀이공원', pick(s => -s.co2, s => s.riders > 0), s => `이산화 탄소 ${Math.round(s.co2)} kg`],
      ['🛡️', '무사고 안전왕', pick(s => s.sweet * 1000 + s.riders / 1000, s => !s.crash && !s.strong && s.riders > 0), s => `딱 좋은 감속 ${s.sweet}번 · 사고 0`],
      ['🎢', '손님 최다', pick(s => s.riders, s => s.riders > 0), s => `${s.riders.toLocaleString('ko-KR')}명`],
    ].filter(a => a[2]);
    // 개인: 과학 퀴즈 정답이 가장 많은 학생, 담당 놀이기구 손님이 가장 많은 학생
    const ps = Object.keys(R.players || {}).map(u => ({ u, sc: (R.scores || {})[u] || {} }));
    const best = k => { const c = ps.filter(p => p.sc[k] > 0); return c.length ? c.reduce((a, b) => b.sc[k] > a.sc[k] ? b : a) : null; };
    const qz = best('quiz'), rd = best('riders');
    if (qz) aw.push(['📡', '과학 퀴즈왕', { name: `${nameOf(qz.u)} (${esc(G(R.players[qz.u].g).name)})` }, () => `정답 ${qz.sc.quiz}번`]);
    if (rd) aw.push(['🎡', '인기 설계사', { name: `${nameOf(rd.u)} (${esc(G(R.players[rd.u].g).name)})` }, () => `담당 놀이기구 손님 ${rd.sc.riders.toLocaleString('ko-KR')}명`]);
    return `<div class="bd-end"><div class="cols"><div><h2>🏆 최종 순위</h2><p class="muted">점수 = 돈 + 시설 값의 절반</p>
      <ol class="rank">${st.map((s, i) => `<li class="${i === 0 ? 'top' : ''}"><span>${i + 1}</span><span><b style="font-family:var(--display);font-weight:400;font-size:20px">${esc(s.name)}</b> <small class="muted">손님 ${s.riders.toLocaleString('ko-KR')} · 되찾기 ${Math.round(s.ratio * 100)}% · CO₂ ${Math.round(s.co2)} kg${s.crash ? ` · 💥${s.crash}` : ''}</small></span><b>${s.score.toLocaleString('ko-KR')}</b></li>`).join('')}</ol></div>
      <div><h2>🎖️ 특별상</h2>${records(99).length ? `<ul class="awards">${records(99).map(([ic, n, who, v]) => `<li><span>${ic}</span><div><b>반 기록 · ${n}</b><small>${who} · ${v}</small></div></li>`).join('')}</ul>` : ''}<ul class="awards">${aw.map(([ic, n, s, d]) => `<li><span>${ic}</span><div><b>${n} · ${s.name.includes('<') || s.name.includes('&') ? s.name : esc(s.name)}</b><small>${d(s)}</small></div></li>`).join('')}</ul>
        <div class="card" style="margin-top:14px"><div class="eyebrow">정리 질문</div><p>1. 자석 브레이크가 정전에도 작동하는 까닭을 유도 전류로 설명해 보자.</p><p>2. 브레이크 판을 플라스틱으로 바꾸면 왜 멈추지 않을까?</p><p>3. 끌어올리는 데 쓴 전기 에너지는 어떤 에너지로 바뀌어 사라졌을까? 발전 코일은 그중 무엇을 되찾았나?</p></div></div></div></div>`;
  }

  // =====================================================================
  //  학생 휴대폰
  // =====================================================================
  const rawName = uid => ((R.players || {})[uid] || {}).name || '모둠원';
  function renderTeam() {
    const root = $('#app'); if (!root) return;
    if (!R.meta || !R.live) { root.innerHTML = `<div class="wrap"><div class="top"><a class="back" href="#">←</a><h1>수업 ${esc(cur.code)}</h1></div><div class="card"><h2>수업을 찾는 중…</h2><p class="muted">계속 이 화면이면 수업 코드를 다시 확인하세요.</p></div></div>`; cur.sig = ''; return; }
    const uid = NET.user && NET.user.uid, me = (R.players || {})[uid];
    if (!me || cur.pickAgain) return renderJoin(root);
    const g = me.g, l = L(), day = l.day || 0, r = resOf(g), mem = membersOf(g), own = mem.includes(uid) ? ownSlots(g, uid) : [], chief = mem[0] === uid;
    const phase = { lobby: 'wait', design: 'design', run: 'run', result: 'result', quiz: 'quiz', quizres: 'quiz', end: 'end' }[l.sub] || 'wait';
    const qa = quizOf(uid, day), myShake = ((R.shake || {})[day] || {})[uid];
    const groupDesign = mem.map(u => (R.design || {})[u] || null);
    const sig = JSON.stringify([uid, g, l.sub, l.step, day, arr(l.events), l.own && l.own[g], R.res && R.res[g], mem.map(u => R.players[u]), groupDesign, qa, myShake, (R.scores || {})[uid]]);
    if (sig === cur.sig && $('#app .wrap')) return; cur.sig = sig;
    const sc = (R.scores || {})[uid] || {};
    const banner = `<div class="card" style="margin-bottom:12px"><div class="eyebrow">${esc(me.name)} · ${esc(G(g).name)} · ${own.length ? `내 담당 ${own.map(i => i + 1).join('·')}번 자리` : l.sub === 'lobby' ? '설계가 시작되면 담당 자리가 정해져요' : '오늘은 담당 자리 없음(다음 날부터)'}${chief ? ' · ⚡ 에너지 팀장(계약 전력)' : ''}</div>
      <div class="members">${(l.sub === 'lobby' ? membersNow(g) : mem).map(u => `<span class="${l.sub === 'design' && readyOf(u, day) ? 'ok' : ''} ${u === uid ? 'me' : ''}">${l.sub === 'design' && readyOf(u, day) ? '✅ ' : ''}${nameOf(u)}</span>`).join('')}</div>
      ${l.sub === 'end' ? `<p style="margin-top:8px">나의 기여: 과학 퀴즈 정답 <b>${sc.quiz || 0}</b>번 · 내 담당 놀이기구 손님 <b>${(sc.riders || 0).toLocaleString('ko-KR')}</b>명</p>` : ''}
      ${l.sub === 'lobby' ? `<button class="btn" id="jChange" style="margin-top:8px">이름·모둠 바꾸기</button>` : ''}</div>`;
    const write = (p, ready) => {
      const slots = {}; own.forEach(i => { slots[i] = p.slots[i] || { kind: 'none' }; });
      const rec = { g, day, slots, ready: ready ? day : null }; if (chief) rec.power = p.power;
      return NET.put(`${pp(cur.code)}/design/${uid}`, rec);
    };
    ParkUI.render(root, {
      mode: 'class', title: `${G(g).name} 놀이공원`, day, days: M().days || DAYS_DEFAULT, money: r.money, rep: r.rep, battery: r.battery,
      weather: dayWeather(cur.code, day), events: arr(l.events), park: r.park, draft: groupDraft(g, day), phase, editable: phase === 'design' && (own.length > 0 || chief),
      own, powerMine: chief, missions: dayMissions(cur.code, day), ownerName: i => { const u = ownerOf(g, i, mem); return u ? rawName(u) : ''; }, banner, saveLabel: readyOf(uid, day) ? '✅ 완료됨 · 다시 저장' : '내 설계 완료',
      lastRes: r.hist[day] ? normRes(r.hist[day]) : null, hist: histList(g), shake: myShake == null ? null : myShake, backHref: '#', clockHTML: clockHTML(),
      waitText: l.sub === 'lobby' ? `${G(g).name} 참여 완료! 선생님이 시작할 때까지 기다려요` : '',
      quiz: phase === 'quiz' ? { Q: quizFor(cur.code, day), mine: qa, reveal: l.sub === 'quizres' } : null,
      onDraft(p) { clearTimeout(cur.draftT); const code = cur.code; cur.draftT = setTimeout(() => { if (cur && cur.code === code && L().sub === 'design') write(p, false).catch(() => {}); }, 500); },
      onSave(p) { clearTimeout(cur.draftT); write(p, true).then(() => toast('내 설계를 올렸어요. 영업이 시작될 때 모둠 공원에 적용돼요', 'good')).catch(e => toast('저장 실패: ' + (e.code || e.message), 'bad')); },
      onShake(k) { if (L().sub !== 'design') return; NET.put(`${pp(cur.code)}/shake/${day}/${uid}`, k).then(() => toast(`⚡ ${f1(k)} kWh! 모둠원 평균이 우리 공원 전기가 돼요`, 'good')); },
      onQuiz(i) { if (L().sub !== 'quiz' || qa != null) return; NET.put(`${pp(cur.code)}/quiz/${day}/${uid}`, { a: i, g }); },
    });
    const jc = $('#jChange'); if (jc) jc.onclick = () => { cur.pickAgain = true; cur.sig = ''; render(); };
    tickClocks();
  }
  function renderJoin(root) {
    cur.sig = '';
    const uid = NET.user && NET.user.uid, me = (R.players || {})[uid], l = L();
    if (me && l.sub !== 'lobby') cur.pickAgain = false;
    let nm = (me && me.name) || ''; try { nm = nm || localStorage.getItem('cg-park-name') || ''; } catch (e) {}
    const cnt = g => membersNow(g).length;
    root.innerHTML = `<div class="wrap"><div class="top"><a class="back" href="#">←</a><h1>수업 ${esc(cur.code)} · 참여하기</h1></div>
      <div class="card setup"><div class="joinform"><div><label for="jName">이름</label><input type="text" id="jName" maxlength="20" value="${esc(nm)}" placeholder="예: 김하늘" autocomplete="off"></div>
        <div><label>우리 모둠</label><div class="groupsel">${order().map(g => `<button data-pick="${g}" ${me && me.g === g ? 'style="border-color:var(--gold)"' : ''}><b>${esc(G(g).name)}</b><small>${cnt(g)}명 참여 중</small></button>`).join('')}</div></div></div>
        <p class="muted" style="margin-top:10px">모둠원이 놀이공원 자리 6곳을 나눠 맡아요. 내 자리의 놀이기구를 설계하고, 모둠 돈은 함께 써요.${l.sub !== 'lobby' ? ' 이미 진행 중이라 담당 자리는 다음 날부터 생겨요.' : ''}</p></div></div>`;
    root.querySelectorAll('[data-pick]').forEach(b => b.onclick = async () => {
      const name = $('#jName').value.trim().slice(0, 20); if (!name) { toast('이름을 먼저 적어 주세요', 'bad'); $('#jName').focus(); return; }
      b.disabled = true;
      try {
        await NET.put(`${pp(cur.code)}/players/${uid}`, { name, g: b.dataset.pick, t: me && me.g === b.dataset.pick ? me.t || NET.now() : NET.now() });
        try { localStorage.setItem('cg-park-name', name); } catch (e) {}
        cur.pickAgain = false; toast(`${G(b.dataset.pick).name}에 들어왔어요`, 'good'); schedule();
      } catch (e) { toast('참여 실패: ' + (e.code || e.message), 'bad'); b.disabled = false; }
    });
  }
  return { claims, start, stop: stopAll };
})();
