'use strict';
// ===== 200년 생존기 · 수업 모드 =====
// #teacher        교사 진행 화면 (Google 로그인, 진행·기습 이벤트·특임대 편성, 진행 엔진이 이 화면에서 돈다)
// #board/코드     전자칠판 화면 (모둠별 3D 서식지, 공지)
// #join/코드      학생 휴대폰 (모둠 화면, 투표, 능력, 퀴즈)
const LIVE = (function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
  const SCOL = { low: '#7FD3FF', mid: '#FFB547', high: '#FF4D4D' };
  const DEF = { voteSec: 35, outSec: 10, quizSec: 25, qresSec: 7, prepSec: 90, rescueSec: 25, rresSec: 6, summitSec: 30, sresSec: 9, midSec: 45, auto: true };
  const SUB_NAME = { lobby: '접속 대기', prep: '60초 준비', event: '선택 투표', outcome: '결과', quiz: '과학 무전', quizres: '무전 결과', rescue: '긴급 구조 미션', rescueres: '구조 결과', summit: '기후 정상 회의', summitres: '회의 결과', prep2: '30초 미니게임', end: '기록 끝' };
  const SOS_POP = 25; // 개체 수가 이보다 적으면 구조 요청(다른 모둠이 지원할 수 있다)
  const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = null;
  let R = blank();
  function blank() { return { meta: null, live: null, groups: {}, players: {}, votes: {}, quiz: {}, abil: {}, prep: {}, pred: {}, aid: {}, rescue: {}, summit: {}, prep2: {}, scores: {} }; }

  // ---------- 공통 ----------
  function claims() { return /^#(teacher|board|join)/.test(location.hash); }
  function parseHash() { const m = location.hash.match(/^#(teacher|board|join)(?:\/([0-9A-Za-z_-]+))?/); return m ? { view: m[1], code: m[2] || null } : null; }
  function toast(msg, kind) { const box = $('#toasts'); if (!box) return; const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 3200); }
  function stopAll() {
    if (!cur) return;
    cur.unsubs.forEach(f => { try { f(); } catch (e) {} });
    if (cur.timer) clearInterval(cur.timer);
    if (cur.tick) clearInterval(cur.tick);
    if (cur.arena) { try { World3D.stopArena(); } catch (e) {} }
    cur = null;
  }
  function start() {
    stopAll();
    const p = parseHash(); if (!p) return false;
    cur = { view: p.view, code: p.code, unsubs: [], pending: false };
    document.body.classList.toggle('boardmode', p.view === 'board');
    R = blank();
    if (p.view === 'teacher') teacherStart();
    else if (p.view === 'board') boardStart();
    else joinStart();
    cur.tick = setInterval(tickClocks, 250);
    return true;
  }
  function subscribe(code) {
    const base = roomPath(code);
    const w = (k, path) => cur.unsubs.push(NET.watch(base + '/' + path, v => { R[k] = v == null ? (k === 'meta' || k === 'live' ? null : {}) : v; schedule(); }));
    w('meta', 'meta'); w('live', 'live'); w('groups', 'groups'); w('players', 'players'); w('prep', 'prep'); w('votes', 'votes'); w('quiz', 'quiz'); w('abil', 'abil');
    w('pred', 'pred'); w('aid', 'aid'); w('rescue', 'rescue'); w('summit', 'summit'); w('prep2', 'prep2'); w('scores', 'scores');
  }
  function schedule() { if (!cur || cur.pending) return; cur.pending = true; setTimeout(() => { if (!cur) return; cur.pending = false; render(); }, 30); }
  function render() {
    if (!cur) return;
    const ae = document.activeElement;
    if (cur.view === 'teacher' && ae && /^(SELECT|INPUT|TEXTAREA)$/.test(ae.tagName) && ae.closest('#app') && !ae.closest('.lv-setup')) { if (!cur.deferT) cur.deferT = setTimeout(() => { cur && (cur.deferT = null); schedule(); }, 700); return; }
    if (cur.view === 'teacher') renderTeacher();
    else if (cur.view === 'board') renderBoard();
    else renderJoin();
  }
  function tickClocks() {
    const L = R.live; if (!L) return;
    const left = L.paused ? (L.left || 0) : Math.max(0, (L.deadline || 0) - NET.now());
    document.querySelectorAll('[data-clock]').forEach(el => { el.textContent = L.paused ? '일시정지' : (['lobby', 'end'].includes(L.sub) ? '' : Math.ceil(left / 1000) + '초'); el.classList.toggle('low', !L.paused && left < 8000 && !['lobby', 'end'].includes(L.sub)); });
    document.querySelectorAll('[data-bar]').forEach(el => { const tot = (L.total || 1); el.style.width = (L.paused ? (L.left || 0) / tot : left / tot) * 100 + '%'; });
  }
  const order = () => (R.meta && R.meta.order) || [];
  const G = gid => (R.meta && R.meta.groups && R.meta.groups[gid]) || null;
  function norm(run) {
    if (!run) return null;
    run.flags = run.flags || {}; run.recs = run.recs || []; run.log = run.log || []; run.quizAns = run.quizAns || {}; run.init = run.init || { pop: run.pop, energy: run.energy, health: run.health, flags: {} };
    run.init.flags = run.init.flags || {};
    for (let i = 0; i < run.recs.length; i++) run.recs[i] = run.recs[i] || { c: 0 };
    return run;
  }
  const runOf = gid => norm(R.groups && R.groups[gid] && R.groups[gid].run ? R.groups[gid].run : null);
  const members = gid => Object.entries(R.players || {}).filter(([, p]) => p && p.g === gid).map(([uid, p]) => ({ uid, name: p.name }));
  const rolesOf = gid => (R.groups && R.groups[gid] && R.groups[gid].roles) || {};
  const usesOf = gid => (R.groups && R.groups[gid] && R.groups[gid].uses) || {};
  function groupState(gid) {
    const g = G(gid), run = runOf(gid), gen = R.live ? Math.min(R.live.gen || 0, GENS - 1) : 0;
    if (!run) { const T = SCENARIOS[g.scen].T[0]; return { hab: 100, pop: 60, health: 90, energy: 60, T, alive: true }; }
    return { hab: currentHab(run), pop: run.pop, health: run.health, energy: run.energy, T: currentT(run), alive: run.extinctAt == null, run };
  }
  function tCol(T) { const st = [[0.3, [127, 211, 255]], [1.5, [255, 209, 102]], [2.5, [255, 138, 61]], [4, [255, 59, 48]], [5.6, [193, 18, 31]]]; if (T <= st[0][0]) return 'rgb(127,211,255)'; for (let i = 1; i < st.length; i++) { if (T <= st[i][0]) { const [a, ca] = st[i - 1], [b, cb] = st[i], k = (T - a) / (b - a); return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(',')})`; } } return 'rgb(193,18,31)'; }
  const bar = (v, col) => `<span class="lv-meter"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></span>`;
  // ---- 연출: 이전 값 → 새 값으로 막대·숫자가 움직인다 ----
  const pct = v => Math.max(0, Math.min(100, Math.round(v)));
  const barK = (v, col, k, from) => `<span class="lv-meter"><i data-k="${k}" data-v="${pct(v)}"${from != null ? ` data-from="${from}"` : ''} style="width:${pct(v)}%;background:${col}"></i></span>`;
  function animateMeters(box) {
    if (!cur || !box) return; cur.mprev = cur.mprev || {};
    const go = [];
    box.querySelectorAll('i[data-k]').forEach(el => {
      const k = el.dataset.k, v = +el.dataset.v; let from = cur.mprev[k];
      if (from == null && el.dataset.from != null) from = +el.dataset.from;
      cur.mprev[k] = v;
      if (from != null && Math.abs(from - v) > 0.5 && !RM) { el.style.transition = 'none'; el.style.width = from + '%'; go.push([el, v]); }
    });
    if (!go.length) return;
    void box.offsetWidth;
    requestAnimationFrame(() => go.forEach(([el, v]) => { el.style.transition = ''; el.style.width = v + '%'; }));
  }
  function animateNums(box) {
    if (!cur || !box) return; cur.nprev = cur.nprev || {};
    box.querySelectorAll('[data-nk]').forEach(el => {
      const k = el.dataset.nk, v = +el.dataset.n, from = cur.nprev[k]; cur.nprev[k] = v;
      if (from == null || from === v || RM) return;
      const t0 = performance.now(), d = 900;
      el.classList.add(v > from ? 'nup' : 'ndown');
      const step = now => { const k2 = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k2, 3); if (!el.isConnected) return; el.textContent = Math.round(from + (v - from) * e); if (k2 < 1) requestAnimationFrame(step); else setTimeout(() => el.classList.remove('nup', 'ndown'), 600); };
      el.textContent = from; requestAnimationFrame(step);
    });
  }
  // 지금 단계가 시작된 뒤 흐른 시간(ms) — 다시 그려도 애니메이션이 이어지도록 음수 지연으로 쓴다
  function stageElapsed() { const L = R.live || {}; if (L.paused) return 1e9; return NET.now() - ((L.deadline || 0) - (L.total || 0)); }
  function decadeTag(gen) { return gen < 10 ? '실제 기록의 시대' : gen === 10 ? '바로 지금' : gen === 11 ? '여기부터는 미래 예측' : '미래 예측 · IPCC 시나리오'; }
  function decadeBanner(gen, cls) {
    const el = stageElapsed(); if (el > 3800 || el < -500) return '';
    return `<div class="lv-decade ${cls || ''}" style="animation-delay:-${Math.max(0, Math.round(el))}ms" aria-hidden="true"><small>${gen + 1}세대</small><b>${DECADES[gen]}년대</b><span>${decadeTag(gen)}</span></div>`;
  }
  const scoreOf = uid => { const o = (R.scores && R.scores[uid]) || {}; return { pred: o.pred || 0, quiz: o.quiz || 0, aid: o.aid || 0, abil: o.abil || 0, rs: o.rs || 0, total: (o.pred || 0) + (o.quiz || 0) + (o.aid || 0) + (o.abil || 0) + (o.rs || 0) }; };
  const gname = gid => (G(gid) ? G(gid).name : '');
  const sosGroups = () => order().filter(g => isSos(runOf(g)));
  function qOpts(Q, mine, reveal, attr) {
    return `<div class="lv-qopts">${Q.a.map((a, i) => { let c = ''; if (reveal) { if (i === Q.c) c = 'right'; else if (mine && mine.a === i) c = 'wrong'; } else if (mine && mine.a === i) c = 'on'; return `<button class="lv-qopt ${c}" ${attr}="${i}" ${reveal ? 'disabled' : ''}><span>${'ABCD'[i]}</span>${a}</button>`; }).join('')}</div>`;
  }
  // 같은 동물·같은 세계의 보통 모둠 점수와 비교한 순위
  function fairRank() {
    return order().map(gid => ({ gid, run: runOf(gid) })).filter(x => x.run).map(x => { const sv = gensSurvived(x.run); return Object.assign(x, { sv, diff: runScore(sv, x.run.pop) - baselineScore(x.run.animal, x.run.scen) }); })
      .sort((a, b) => (b.diff - a.diff) || (b.sv - a.sv) || (b.run.pop - a.run.pop));
  }
  function awards() {
    const out = [], ps = Object.entries(R.players || {});
    const best = (title, icon, f, unit) => { let mx = 0, who = []; for (const [uid, p] of ps) { const v = f(scoreOf(uid)); if (v > mx) { mx = v; who = [p.name]; } else if (v === mx && v > 0) who.push(p.name); } if (mx > 0) out.push({ title, icon, who: who.slice(0, 3).map(esc).join(' · ') + ` (${mx}${unit})` }); };
    best('예측왕', '🎯', s => s.pred, '번 적중');
    best('과학 무전왕', '📡', s => s.quiz + s.rs, '문제');
    best('특임대 활약', '★', s => s.abil, '번');
    best('나눔왕', '🤝', s => s.aid, '번 지원');
    let gm = 0, gw = [];
    for (const gid of order()) { const n = (R.groups[gid] && R.groups[gid].aidSent) || 0; if (n > gm) { gm = n; gw = [gid]; } else if (n === gm && n > 0) gw.push(gid); }
    if (gm > 0) out.push({ title: '가장 많이 도운 모둠', icon: '🫶', who: gw.map(g => esc(gname(g))).join(' · ') + ` (${gm}번)` });
    const pw = {}; for (const x of Object.values((R.live && R.live.summits) || {})) for (const [gid, pl] of Object.entries(x.pl || {})) pw[gid] = (pw[gid] || 0) + PLEDGES[pl].w;
    const pm = Math.max(0, ...Object.values(pw)); if (pm > 0) out.push({ title: '감축 앞장 모둠', icon: '🌍', who: Object.keys(pw).filter(g => pw[g] === pm).map(g => esc(gname(g))).join(' · ') + ` (기여 ${pm})` });
    return out;
  }
  // 이 모둠 장면에 띄울 날씨·재난 효과: 대기 중인 기습 이벤트 + 이번 결과에 반영된 것
  function fxFor(gid) {
    const L = R.live || {}, out = new Set(), themeOf = p => p && (p.key || (p.custom && p.custom.theme));
    for (const p of Object.values(L.pending || {})) if (p && (p.target === 'all' || p.target === gid)) { const k = themeOf(p); if (k) out.add(k); }
    const run = runOf(gid), gen = Math.min(L.gen || 0, GENS - 1);
    if (run && run.last && run.last.gen === gen && ['outcome', 'quiz', 'quizres'].includes(L.sub)) for (const n of run.last.notes || []) { const k = typeof n === 'string' ? n : n && n.theme; if (k) out.add(k); }
    return [...out];
  }
  const joinURL = code => location.origin + '/century/#join/' + code;
  function hintChips(animal, c, flags, luck) {
    const A = ANIMALS[animal], L = { pop: A.popName, energy: A.energyName, health: A.healthName, hab: A.habName, food: '먹이터' };
    if (c.r) { let p = c.r.p; if (c.r.flagP) for (const f in c.r.flagP) if (flags && flags[f]) p = c.r.flagP[f]; if (luck) p = Math.min(.95, p + .25); return `<span class="chip luck">운에 맡김 · ${p >= .6 ? '가능성 높음' : p >= .45 ? '반반' : '가능성 낮음'}</span>`; }
    const e = c.e || {}, ks = Object.keys(e).filter(k => e[k]);
    if (!ks.length) return '<span class="chip">변화 없음</span>';
    return ks.map(k => `<span class="chip ${e[k] > 0 ? 'up' : 'down'}">${L[k]} ${e[k] > 0 ? '↑' : '↓'}${Math.abs(e[k]) >= 15 ? (e[k] > 0 ? '↑' : '↓') : ''}</span>`).join('');
  }
  function effChips(animal, e) {
    const A = ANIMALS[animal], L = { pop: A.popName, energy: A.energyName, health: A.healthName, hab: A.habName, food: '먹이터' };
    return Object.keys(e || {}).filter(k => e[k]).map(k => `<span class="chip ${e[k] > 0 ? 'up' : 'down'}">${L[k]} ${e[k] > 0 ? '+' : ''}${e[k]}</span>`).join('');
  }
  function noticeHTML(n) {
    if (!n) return '';
    if (n.kind === 'surprise') {
      const S = surpriseDef(specOf(n)); if (!S) return '';
      const tg = n.target === 'all' ? '모든 모둠' : (G(n.target) ? G(n.target).name : '');
      return `<div class="lv-alert ${n.key === 'deal' ? 'good' : ''}"><div class="ic">${S.icon}</div><div><div class="eyebrow">기습 이벤트 · ${esc(tg)} · 다음 결과에 반영</div><h2>${S.name}</h2><p>${S.text}</p><p class="sci">${S.sci}</p></div></div>`;
    }
    return '';
  }
  const noticeFresh = n => n && NET.now() - (n.t || 0) < 14000;
  // 기습 이벤트가 어느 모둠에 무엇을 하는지 → 스플래시용
  function splashEffects(key, target, onlyGid) {
    const S = surpriseDef(key), out = []; if (!S) return out;
    for (const gid of order()) {
      if (target !== 'all' && target !== gid) continue;
      if (onlyGid && onlyGid !== gid) continue;
      const g = G(gid), A = ANIMALS[g.animal], e = S.effFor(g.animal) || {};
      const L = { pop: A.popName, energy: A.energyName, health: A.healthName, hab: A.habName };
      out.push({ label: (onlyGid ? '우리 ' : g.name + ' ') + A.name, chips: Object.keys(e).filter(k => e[k]).map(k => ({ t: `${L[k]} ${e[k] > 0 ? '+' : ''}${e[k]}`, v: e[k] })) });
    }
    return out;
  }
  const specOf = p => (p && (p.custom || p.key)) || null; // 대기열·공지 항목 → 기습 이벤트 정의 입력
  const noteInfo = k => typeof k === 'string' ? SURPRISES[k] : k;
  const targetName = t => t === 'all' ? '모든 모둠' : (G(t) ? G(t).name : '');

  // =====================================================================
  //  교사 화면 + 진행 엔진
  // =====================================================================
  function teacherStart() {
    NET.ready.then(() => {
      NET.onAuth(() => {
        if (!cur || cur.view !== 'teacher') return;
        if (NET.isTeacher() && !cur.opened) {
          let code = cur.code; try { code = code || localStorage.getItem('cg-century-teacher-code'); } catch (e) {}
          if (code) openRoom(code);
        }
        schedule();
      });
    });
    renderTeacher();
  }
  // 수업은 만든 교사만 진행할 수 있다(규칙: meta/owner). 주인 없는 예전 수업은 연 교사가 주인이 된다.
  async function openRoom(code) {
    if (!cur) return;
    if (NET.mode === 'fb') {
      let meta = null;
      try { meta = await NET.get(roomPath(code) + '/meta'); } catch (e) {}
      const uid = NET.user && NET.user.uid;
      if (meta && meta.owner && meta.owner !== uid) {
        try { if (localStorage.getItem('cg-century-teacher-code') === code) localStorage.removeItem('cg-century-teacher-code'); } catch (e) {}
        toast(`수업 ${code}은(는) 다른 선생님(${meta.ownerEmail || '다른 계정'})의 수업이라 열 수 없어요`, 'bad');
        if (location.hash !== '#teacher') history.replaceState(null, '', '#teacher');
        return;
      }
      if (meta && !meta.owner) { try { await NET.update({ [roomPath(code) + '/meta/owner']: uid, [roomPath(code) + '/meta/ownerEmail']: (NET.user.email || '').toLowerCase() }); } catch (e) { toast('수업을 열 권한이 없어요: ' + (e.code || e.message), 'bad'); return; } }
    }
    if (!cur) return;
    cur.unsubs.forEach(f => f()); cur.unsubs = [];
    cur.code = code; cur.opened = true; R = blank();
    try { localStorage.setItem('cg-century-teacher-code', code); } catch (e) {}
    if (location.hash !== '#teacher/' + code) history.replaceState(null, '', '#teacher/' + code);
    subscribe(code);
    if (cur.timer) clearInterval(cur.timer);
    cur.timer = setInterval(hostTick, 400);
  }
  const base = () => roomPath(cur.code);
  function liveUpdate(obj) { const c = {}; for (const k in obj) c[base() + '/live/' + k] = obj[k]; return NET.update(c); }
  function setStage(sub, sec, extra) {
    const L = R.live || {};
    const ch = { sub, step: (L.step || 0) + 1, deadline: NET.now() + sec * 1000, total: sec * 1000, paused: false, left: null };
    return liveUpdate(Object.assign(ch, extra || {}));
  }
  function aliveGroups() { return order().filter(g => { const r = runOf(g); return r && r.extinctAt == null; }); }
  function rescueGroups() { return order().filter(g => { const r = runOf(g); return r && r.extinctAt == null && r.rescue != null; }); }
  // 단계별로 학생이 낸 것이 들어 있는 곳
  function boxOf(sub, gen) {
    if (sub === 'quiz' || sub === 'quizres') return R.quiz && R.quiz[gen];
    if (sub === 'prep') return R.prep;
    if (sub === 'prep2') return R.prep2;
    if (sub === 'rescue' || sub === 'rescueres') return R.rescue && R.rescue[gen];
    if (sub === 'summit' || sub === 'summitres') return R.summit && R.summit[gen];
    return R.votes && R.votes[gen];
  }
  const secOf = (s, M) => ({ quiz: M.quizSec || DEF.quizSec, rescue: DEF.rescueSec, summit: DEF.summitSec, prep2: DEF.midSec }[s] || 10);
  const isSos = run => !!(run && run.extinctAt == null && run.pop > 0 && run.pop < SOS_POP);
  // 결과 뒤 순서: 긴급 구조 → 과학 무전 → 기후 정상 회의 → 30초 미니게임 → 다음 세대
  function goNext(from) {
    const L = R.live, M = R.meta, gen = L.gen || 0, alive = aliveGroups().length > 0;
    const ORDER = ['outcome', 'rescue', 'rescueres', 'quiz', 'quizres', 'summit', 'summitres', 'prep2'];
    const ok = { rescue: rescueGroups().length > 0, quiz: QUIZ_GENS.includes(gen) && alive, summit: SUMMIT_GENS.includes(gen) && alive, prep2: gen === MID_GEN && alive };
    for (let i = ORDER.indexOf(from) + 1; i < ORDER.length; i++) if (ok[ORDER[i]]) return setStage(ORDER[i], secOf(ORDER[i], M));
    return nextGen();
  }
  function everyoneDone() {
    const L = R.live; if (!L) return false;
    const gen = L.gen || 0;
    if (L.sub === 'prep') { const ps = Object.keys(R.players || {}); return ps.length > 0 && ps.every(u => R.prep && R.prep[u]); }
    if (['event', 'quiz', 'summit', 'prep2'].includes(L.sub)) {
      const box = boxOf(L.sub, gen);
      const ms = aliveGroups().flatMap(g => members(g));
      return ms.length > 0 && ms.every(m => box && box[m.uid]);
    }
    if (L.sub === 'rescue') {
      const box = boxOf('rescue', gen), ms = rescueGroups().flatMap(g => members(g));
      return ms.length > 0 && ms.every(m => box && box[m.uid]);
    }
    return false;
  }
  function hostTick() {
    if (!cur || cur.view !== 'teacher' || !NET.isTeacher()) return;
    const L = R.live, M = R.meta; if (!L || !M || L.paused) return;
    if (['lobby', 'end'].includes(L.sub)) return;
    const now = NET.now();
    if (cur.early !== L.step && everyoneDone() && L.deadline - now > 3000) { cur.early = L.step; liveUpdate({ deadline: now + 2500 }); return; }
    if (now >= L.deadline && cur.busy !== L.step && M.auto !== false) { cur.busy = L.step; advanceStage(); }
  }
  async function advanceStage() {
    const L = R.live, M = R.meta, code = cur.code; if (!L || !M) return;
    const gen = L.gen || 0, ch = {};
    if (L.sub === 'prep') {
      for (const gid of order()) {
        const g = G(gid), list = members(gid).map(m => R.prep && R.prep[m.uid]).filter(Boolean);
        const run = newRun(code, g.name, g.animal, g.scen);
        applyPrep(run, mergePrep(list));
        ch[`${base()}/groups/${gid}/run`] = run;
        ch[`${base()}/groups/${gid}/prepN`] = list.length;
      }
      await NET.update(ch);
      return setStage('event', M.voteSec || DEF.voteSec, { gen: 0 });
    }
    // 개인 점수: scores/{uid} = { pred, quiz, aid, abil, rs }
    const sc = JSON.parse(JSON.stringify(R.scores || {}));
    const addScore = (uid, k) => { const o = sc[uid] || (sc[uid] = {}); o[k] = (o[k] || 0) + 1; };
    if (L.sub === 'event') {
      const pend = Object.values(L.pending || {}), runs = {}, sos = {};
      for (const gid of order()) sos[gid] = isSos(runOf(gid));
      for (const gid of order()) {
        const run = runOf(gid); if (!run || run.extinctAt != null) continue;
        run.gen = gen; run.sub = 'event';
        const ev = findEvent(run.animal, run.order[gen]);
        const votes = {}; members(gid).forEach(m => { const v = R.votes && R.votes[gen] && R.votes[gen][m.uid]; if (v) votes[m.uid] = v; });
        const t = tally(votes, ev.c.length, code + '|' + gid + '|' + gen);
        const roles = rolesOf(gid), uses = Object.assign({}, usesOf(gid)), types = [], names = [];
        for (const uid in roles) {
          const a = R.abil && R.abil[gen] && R.abil[gen][uid];
          if (a && (uses[uid] || 0) < ROLE_USES) { const ro = roleOf(run.animal, roles[uid]); if (ro && !types.includes(ro.type)) { types.push(ro.type); names.push(ro.name + '·' + ro.ability); uses[uid] = (uses[uid] || 0) + 1; addScore(uid, 'abil'); } }
        }
        const sur = pend.filter(p => p.target === 'all' || p.target === gid).map(specOf).filter(Boolean);
        resolveRun(run, t.winner, { roles: types, surprises: sur, roleNames: names, rescue: true });
        runs[gid] = run;
        ch[`${base()}/groups/${gid}/uses`] = uses;
        ch[`${base()}/groups/${gid}/tally`] = { gen, counts: t.counts, winner: t.winner, tie: t.tie, total: t.total };
        // 결과 예측 채점
        const dp = run.pop - run.last.before.pop;
        members(gid).forEach(m => { const pr = R.pred && R.pred[gen] && R.pred[gen][m.uid]; if (pr && ((dp > 0 && pr.pr === 1) || (dp <= 0 && pr.pr === -1))) addScore(m.uid, 'pred'); });
      }
      // 지원: 구조 요청 중인 모둠에 먹이 보내기
      const aidIn = {}, aidOut = {};
      for (const [uid, a] of Object.entries((R.aid && R.aid[gen]) || {})) {
        const from = R.players && R.players[uid] && R.players[uid].g, to = a && a.to;
        if (!from || !to || from === to || !runs[from] || !runs[to] || !sos[to] || runs[from].rescue != null) continue;
        if (((sc[uid] && sc[uid].aid) || 0) >= AID.perStudent) continue;
        applyAid(runs[from], -AID.cost, 0); applyAid(runs[to], AID.gain, AID.health); addScore(uid, 'aid');
        (aidIn[to] = aidIn[to] || []).push(from); aidOut[from] = (aidOut[from] || 0) + 1;
      }
      for (const gid in runs) {
        ch[`${base()}/groups/${gid}/run`] = runs[gid];
        ch[`${base()}/groups/${gid}/aidIn`] = aidIn[gid] ? { gen, from: aidIn[gid] } : null;
        if (aidOut[gid]) ch[`${base()}/groups/${gid}/aidSent`] = ((R.groups[gid] && R.groups[gid].aidSent) || 0) + aidOut[gid];
      }
      ch[`${base()}/scores`] = sc;
      ch[`${base()}/live/pending`] = null;
      await NET.update(ch);
      return setStage('outcome', M.outSec || DEF.outSec);
    }
    if (L.sub === 'outcome') return goNext('outcome');
    if (L.sub === 'rescue') {
      for (const gid of rescueGroups()) {
        const run = runOf(gid); run.gen = gen;
        const Q = rescueQuizFor(run), ms = members(gid);
        let right = 0; ms.forEach(m => { const v = R.rescue && R.rescue[gen] && R.rescue[gen][m.uid]; if (v && v.a === Q.c) { right++; addScore(m.uid, 'rs'); } });
        const need = Math.max(1, Math.ceil(ms.length * 2 / 3)), ok = ms.length > 0 && right >= need;
        applyRescue(run, ok);
        ch[`${base()}/groups/${gid}/run`] = run;
        ch[`${base()}/groups/${gid}/rsr`] = { gen, ok, right, need, n: ms.length };
      }
      ch[`${base()}/scores`] = sc;
      await NET.update(ch);
      return setStage('rescueres', DEF.rresSec);
    }
    if (L.sub === 'rescueres') return goNext('rescueres');
    if (L.sub === 'quiz') {
      for (const gid of aliveGroups()) {
        const run = runOf(gid); run.gen = gen;
        const Q = quizFor(run);
        const ans = {}; let right = 0, active = 0;
        members(gid).forEach(m => {
          const v = R.quiz && R.quiz[gen] && R.quiz[gen][m.uid], voted = R.votes && R.votes[gen] && R.votes[gen][m.uid];
          if (v) ans[m.uid] = { c: v.a };
          if (v || voted) active++;
          if (v && v.a === Q.c) { right++; addScore(m.uid, 'quiz'); }
        });
        const t = tally(ans, 4, 'q|' + code + '|' + gid + '|' + gen);
        // 보급품은 모둠원 정답 비율만큼
        const f = active ? right / active : 0;
        applyQuiz(run, f);
        ch[`${base()}/groups/${gid}/run`] = run;
        ch[`${base()}/groups/${gid}/qt`] = { gen, counts: t.counts, winner: t.total ? t.winner : -1, ok: f >= 0.5, f, right, n: active };
      }
      ch[`${base()}/scores`] = sc;
      await NET.update(ch);
      return setStage('quizres', M.qresSec || DEF.qresSec);
    }
    if (L.sub === 'quizres') return goNext('quizres');
    if (L.sub === 'summit') {
      const ag = aliveGroups(), pl = {};
      for (const gid of ag) {
        const v = {}; members(gid).forEach(m => { const x = R.summit && R.summit[gen] && R.summit[gen][m.uid]; if (x) v[m.uid] = { c: x.p }; });
        const t = tally(v, 3, 's|' + code + '|' + gid + '|' + gen);
        pl[gid] = t.total ? t.winner : 0;
      }
      const avg = ag.length ? ag.reduce((a, g) => a + PLEDGES[pl[g]].w, 0) / ag.length : 0, dT = summitDT(avg);
      for (const gid of ag) { const run = runOf(gid); run.gen = gen; applySummit(run, pl[gid], dT); ch[`${base()}/groups/${gid}/run`] = run; }
      const prev = (L.summits || {});
      ch[`${base()}/live/summits`] = Object.assign({}, prev, { [gen]: { avg: Math.round(avg * 100) / 100, dT, pl } });
      await NET.update(ch);
      return setStage('summitres', DEF.sresSec);
    }
    if (L.sub === 'summitres') return goNext('summitres');
    if (L.sub === 'prep2') {
      for (const gid of aliveGroups()) {
        const run = runOf(gid); run.gen = gen;
        const list = members(gid).map(m => R.prep2 && R.prep2[m.uid]).filter(Boolean);
        if (!list.length) continue;
        const gain = applyMidGame(run, mergePrep(list));
        ch[`${base()}/groups/${gid}/run`] = run;
        ch[`${base()}/groups/${gid}/mg`] = { gen, gain, n: list.length };
      }
      if (Object.keys(ch).length) await NET.update(ch);
      return nextGen();
    }
  }
  async function nextGen() {
    const L = R.live, M = R.meta, gen = L.gen || 0;
    if (gen >= GENS - 1 || !aliveGroups().length) {
      const ch = {};
      for (const gid of order()) { const run = runOf(gid); if (run) { run.phase = 'end'; ch[`${base()}/groups/${gid}/run`] = run; } }
      await NET.update(ch);
      return setStage('end', 1);
    }
    return setStage('event', M.voteSec || DEF.voteSec, { gen: gen + 1 });
  }
  // ---- 교사 조작 ----
  async function createRoom(form) {
    const code = form.code;
    const groups = {}, ord = [];
    form.groups.forEach((g, i) => { const id = 'g' + (i + 1); ord.push(id); groups[id] = g; });
    const u = NET.user || {};
    const meta = { title: '200년 생존기', created: NET.now(), owner: u.uid, ownerEmail: (u.email || '').toLowerCase(), groups, order: ord, voteSec: form.voteSec, outSec: form.outSec, quizSec: form.quizSec, maxPer: form.maxPer || 0, qresSec: DEF.qresSec, prepSec: DEF.prepSec, auto: true };
    if (NET.mode === 'fb') {
      const old = await NET.get(roomPath(code) + '/meta').catch(() => null);
      if (old && old.owner && old.owner !== u.uid) { toast(`수업 코드 ${code}은(는) 다른 선생님이 쓰고 있어요. 코드를 바꿔 주세요`, 'bad'); return; }
    }
    try {
      // 주인(meta/owner)을 먼저 써야 규칙이 나머지 쓰기를 허용한다
      await NET.put(roomPath(code) + '/meta', meta);
      await NET.put(roomPath(code) + '/live', { sub: 'lobby', gen: 0, step: 1, deadline: 0, total: 1 });
      const clear = {}; ['groups', 'votes', 'quiz', 'abil', 'prep', 'pred', 'aid', 'rescue', 'summit', 'prep2', 'scores'].forEach(k => clear[roomPath(code) + '/' + k] = null);
      await NET.update(clear);
    } catch (e) { toast('수업을 만들지 못했어요: ' + (e.code || e.message), 'bad'); return; }
    await openRoom(code);
    toast('수업을 만들었어요. 학생들에게 QR을 보여 주세요', 'good');
  }
  async function makeRoles() {
    const ch = {}, code = cur.code;
    for (const gid of order()) {
      const g = G(gid), uids = members(gid).map(m => m.uid);
      ch[`${base()}/groups/${gid}/roles`] = assignRoles(g.animal, uids, code + '|' + gid + '|' + NET.now());
      ch[`${base()}/groups/${gid}/uses`] = null;
    }
    ch[`${base()}/live/notice`] = { kind: 'roles', t: NET.now() };
    await NET.update(ch);
    toast('특임대를 편성해 전자칠판에 공지했어요', 'good');
  }
  // ---- 직접 만든 재난 ----
  const CU_ICONS = ['⚡', '🌀', '🌪️', '🌧️', '🌊', '🔥', '🏜️', '❄️', '🧊', '🦠', '🐛', '🏭', '🚢', '🛡️', '🌱', '☀️', '🌡️', '💧'];
  const CU_THEMES = { elnino: '파도·바다', heatdome: '열기·폭염', wildfire: '불씨·산불', methane: '기포·가스', volcano: '재·화산', plastic: '부유물·쓰레기', oilspill: '검은 기름', deal: '초록·좋은 소식' };
  const CU_EXAMPLES = [
    { name: '초대형 태풍 상륙', icon: '🌀', theme: 'elnino', text: '따뜻해진 바다에서 힘을 키운 초대형 태풍이 서식지를 휩쓸었다.', sci: '바닷물 온도가 높을수록 태풍은 더 많은 수증기와 에너지를 얻어 강해질 수 있다.', tk: 'now', t: 0, pop: -6, energy: -8, health: -6, hab: 0 },
    { name: '기록적 가뭄', icon: '🏜️', theme: 'heatdome', text: '몇 달째 비가 오지 않아 강과 습지가 말라붙었다.', sci: '온난화로 증발이 늘면 어떤 지역은 가뭄이, 어떤 지역은 집중 호우가 더 심해진다.', tk: 'now', t: 0.1, pop: 0, energy: -10, health: -5, hab: 0 },
    { name: '보호 구역 지정', icon: '🛡️', theme: 'deal', text: '서식지 일부가 보호 구역으로 지정되어 사람의 간섭이 줄었다.', sci: '보호 구역은 생물이 기후 변화에 적응할 시간을 벌어 주는 대표적인 적응 대책이다.', tk: 'now', t: 0, pop: 4, energy: 0, health: 0, hab: 6 },
  ];
  const cuBlank = () => ({ name: '', icon: '⚡', text: '', sci: '', theme: 'heatdome', tk: 'now', t: 0, pop: 0, energy: -10, health: 0, hab: 0 });
  const cuSpec = d => ({ name: d.name, icon: d.icon, text: d.text, sci: d.sci, theme: d.theme, dT: d.tk === 'now' ? +d.t || 0 : 0, permT: d.tk === 'perm' ? +d.t || 0 : 0, e: { pop: +d.pop || 0, energy: +d.energy || 0, health: +d.health || 0, hab: +d.hab || 0 } });
  function cuLib() { try { return JSON.parse(localStorage.getItem('cg-century-customs') || '[]'); } catch (e) { return []; } }
  function cuSaveLib(list) { try { localStorage.setItem('cg-century-customs', JSON.stringify(list.slice(0, 30))); } catch (e) {} }
  function cuHTML() {
    const d = cur.cu || (cur.cu = cuBlank()), lib = cuLib();
    const num = (id, label, v, step, min, max) => `<div><label for="${id}">${label}</label><input type="number" id="${id}" value="${v}" step="${step}" min="${min}" max="${max}"></div>`;
    return `<details class="lv-custom" id="cuBox" ${cur.cuOpen ? 'open' : ''}><summary><b>＋ 직접 만든 재난</b> <span class="muted">이름·아이콘·설명·피해를 정해 같은 스플래시로 일으키기</span></summary>
      ${lib.length ? `<div class="eyebrow" style="margin:10px 0 6px">내 재난 보관함 (이 기기에 저장)</div><div class="lv-sur">${lib.map((c, i) => `<div class="lv-surwrap"><button class="lv-surbtn ${c.theme === 'deal' ? 'good' : ''}" data-cfire="${i}"><span>${esc(c.icon)}</span><b>${esc(c.name)}</b><small>${c.dT ? (c.dT > 0 ? '+' : '') + c.dT + '°C 이번 세대' : c.permT ? (c.permT > 0 ? '+' : '') + c.permT + '°C 계속' : '직접 만든 재난'}</small></button><button class="lv-peek" data-cpeek="${i}">미리보기</button><button class="lv-peek del" data-cdel="${i}" aria-label="${esc(c.name)} 삭제">✕</button></div>`).join('')}</div>` : ''}
      <div class="eyebrow" style="margin:12px 0 6px">새로 만들기 · 예시: ${CU_EXAMPLES.map((x, i) => `<button class="lv-kick" data-cuex="${i}">${x.icon} ${x.name}</button>`).join(' ')}</div>
      <div class="lv-cuform">
        <div class="wide"><label for="cuName">재난 이름</label><input type="text" id="cuName" maxlength="20" value="${esc(d.name)}" placeholder="예: 초대형 태풍 상륙"></div>
        <div><label for="cuIcon">아이콘</label><select id="cuIcon">${CU_ICONS.map(x => `<option ${x === d.icon ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div><label for="cuTheme">배경 효과</label><select id="cuTheme">${Object.entries(CU_THEMES).map(([k, v]) => `<option value="${k}" ${k === d.theme ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="wide"><label for="cuText">상황 설명 (학생 화면에 크게)</label><input type="text" id="cuText" maxlength="90" value="${esc(d.text)}" placeholder="예: 따뜻해진 바다에서 힘을 키운 태풍이 서식지를 휩쓸었다."></div>
        <div class="wide"><label for="cuSci">과학 해설 (전자칠판)</label><textarea id="cuSci" maxlength="200" rows="2" placeholder="이 재난이 온실 효과·지구 온난화와 어떻게 이어지는지">${esc(d.sci)}</textarea></div>
        <div><label for="cuTk">기온 변화</label><select id="cuTk"><option value="now" ${d.tk === 'now' ? 'selected' : ''}>이번 세대만</option><option value="perm" ${d.tk === 'perm' ? 'selected' : ''}>앞으로 계속</option></select></div>
        ${num('cuT', '°C (−0.5~0.5)', d.t, 0.05, -0.5, 0.5)}
        ${num('cuPop', '개체 수', d.pop, 1, -25, 25)}${num('cuEnergy', '에너지(먹이·지방)', d.energy, 1, -25, 25)}${num('cuHealth', '건강', d.health, 1, -25, 25)}${num('cuHab', '서식지(계속)', d.hab, 1, -25, 25)}
      </div>
      <p class="muted" style="font-size:12.5px">피해 수치는 −25~+25, 모든 동물에 같은 크기로 적용돼요(이름은 동물마다 바뀌어 보여요). 대상은 위쪽 '대상' 목록을 따라요.<br>강도 감각(중간 배출, 후반 한 번 기준): 세 칸 모두 −3이면 가벼운 시련, −5면 생존 모둠이 1개쯤 줄고, −10이면 절반 가까이 줄어요. 슈퍼 엘니뇨 한 번도 절반 가까이 줄여요.</p>
      <div class="lv-btns"><button class="btn" id="cuPeek">미리보기</button><button class="btn" id="cuSave">보관함에 저장</button><button class="btn hot" id="cuFire">저장하고 일으키기</button><button class="btn" id="cuReset">비우기</button></div>
    </details>`;
  }
  function cuBind(root) {
    const box = $('#cuBox'); if (!box) return;
    box.ontoggle = () => { cur.cuOpen = box.open; };
    const ids = { cuName: 'name', cuIcon: 'icon', cuTheme: 'theme', cuText: 'text', cuSci: 'sci', cuTk: 'tk', cuT: 't', cuPop: 'pop', cuEnergy: 'energy', cuHealth: 'health', cuHab: 'hab' };
    for (const id in ids) { const el = document.getElementById(id); if (el) el.oninput = el.onchange = () => { cur.cu[ids[id]] = el.value; }; }
    const tgt = () => $('#cTarget').value;
    const valid = () => { if (!String(cur.cu.name || '').trim()) { toast('재난 이름을 써 주세요', 'bad'); $('#cuName').focus(); return false; } return true; };
    const preview = spec => Splash.show({ def: surpriseDef(spec), mode: 'preview', target: targetName(tgt()), effects: splashEffects(spec, tgt()) });
    const store = () => { const lib = cuLib(), c = sanitizeCustom(cuSpec(cur.cu)); const i = lib.findIndex(x => x.name === c.name); if (i >= 0) lib[i] = c; else lib.unshift(c); cuSaveLib(lib); return c; };
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on('cuPeek', () => { if (valid()) preview(cuSpec(cur.cu)); });
    on('cuSave', () => { if (!valid()) return; store(); toast('보관함에 저장했어요', 'good'); renderTeacher(); });
    on('cuFire', () => { if (!valid()) return; const c = store(); fireSurprise(c, tgt()); renderTeacher(); });
    on('cuReset', () => { cur.cu = cuBlank(); renderTeacher(); });
    root.querySelectorAll('[data-cuex]').forEach(b => b.onclick = () => { cur.cu = Object.assign(cuBlank(), CU_EXAMPLES[+b.dataset.cuex]); renderTeacher(); });
    root.querySelectorAll('[data-cfire]').forEach(b => b.onclick = () => fireSurprise(cuLib()[+b.dataset.cfire], tgt()));
    root.querySelectorAll('[data-cpeek]').forEach(b => b.onclick = e => { e.stopPropagation(); preview(cuLib()[+b.dataset.cpeek]); });
    root.querySelectorAll('[data-cdel]').forEach(b => b.onclick = e => { e.stopPropagation(); const lib = cuLib(); lib.splice(+b.dataset.cdel, 1); cuSaveLib(lib); renderTeacher(); });
  }

  // ---- 모둠 조정 ----
  async function movePlayer(uid, to) {
    const p = R.players && R.players[uid]; if (!p || p.g === to) return;
    const ch = { [`${base()}/players/${uid}/g`]: to, [`${base()}/groups/${p.g}/roles/${uid}`]: null };
    await NET.update(ch);
    toast(`${p.name} → ${G(to).name}`, 'good');
  }
  async function kickPlayer(uid) {
    const p = R.players && R.players[uid]; if (!p) return;
    await NET.update({ [`${base()}/players/${uid}`]: null, [`${base()}/groups/${p.g}/roles/${uid}`]: null, [`${base()}/prep/${uid}`]: null });
    toast(`${p.name} 학생을 내보냈어요`);
  }
  // 많은 모둠에서 적은 모둠으로, 특임대가 아닌 학생부터 옮긴다
  async function balanceGroups() {
    const ids = order(), list = {}; ids.forEach(g => { list[g] = members(g); });
    const total = ids.reduce((s, g) => s + list[g].length, 0); if (!total) return toast('접속한 학생이 없어요', 'bad');
    const base_ = Math.floor(total / ids.length), extra = total % ids.length;
    const target = {}; ids.forEach((g, i) => { target[g] = base_ + (i < extra ? 1 : 0); });
    const ch = {}; let moved = 0;
    for (;;) {
      const over = ids.filter(g => list[g].length > target[g]).sort((a, b) => list[b].length - list[a].length)[0];
      const under = ids.filter(g => list[g].length < target[g]).sort((a, b) => list[a].length - list[b].length)[0];
      if (!over || !under) break;
      const roles = rolesOf(over); const pickIdx = list[over].findIndex(m => !roles[m.uid]); const m = list[over].splice(pickIdx >= 0 ? pickIdx : list[over].length - 1, 1)[0];
      list[under].push(m); ch[`${base()}/players/${m.uid}/g`] = under; ch[`${base()}/groups/${over}/roles/${m.uid}`] = null; moved++;
    }
    if (!moved) return toast('이미 고르게 나뉘어 있어요');
    await NET.update(ch); toast(`${moved}명을 옮겨 인원을 맞췄어요`, 'good');
  }
  async function fireSurprise(spec, target) {
    const id = 's' + NET.now().toString(36);
    const item = typeof spec === 'string' ? { key: spec } : { custom: sanitizeCustom(spec) };
    await NET.update({ [`${base()}/live/pending/${id}`]: Object.assign({ target }, item), [`${base()}/live/notice`]: Object.assign({ kind: 'surprise', target, t: NET.now() }, item) });
    toast(`${surpriseDef(specOf(item)).name} 발생! 이번 세대 결과에 반영돼요`, 'bad');
  }
  function renderTeacher() {
    const root = document.getElementById('app'); if (!root) return;
    const u = NET.user, teacher = NET.isTeacher();
    const top = `<div class="lv-top"><a class="backlink" href="#">←</a><b>200년 생존기 · 교사</b><span class="muted">${NET.mode === 'local' ? '로컬 모드(이 기기 안에서만)' : NET.mode === 'fb' ? '실시간 연결됨' : '연결 중…'}</span>
      <span class="sp"></span>${u && !u.isAnonymous && !u.local ? `<span class="muted">${esc(u.email || '')}</span><button class="btn" id="tOut">로그아웃</button>` : ''}</div>`;
    if (NET.mode === 'init') { root.innerHTML = `<div class="wrap">${top}<div class="card">연결 중…</div></div>`; return; }
    if (!teacher) {
      root.innerHTML = `<div class="wrap">${top}<div class="card lv-login"><h2>교사 로그인</h2><p class="muted">수업 진행·기습 이벤트·특임대 편성은 등록된 교사 Google 계정으로만 할 수 있어요.</p>
        ${u && !u.isAnonymous ? `<p class="err">${esc(u.email)} 계정은 교사로 등록되어 있지 않아요. 관리자 선생님께 이 주소를 등록해 달라고 요청한 뒤 다시 로그인하세요.</p>` : ''}
        <button class="btn hot lg" id="tIn">Google 계정으로 로그인</button></div></div>`;
      $('#tIn').onclick = () => NET.teacherLogin().then(() => schedule()).catch(e => toast('로그인 실패: ' + (e.code || e.message), 'bad'));
      const o = $('#tOut'); if (o) o.onclick = () => NET.logout();
      return;
    }
    if (!cur.code || !R.meta) { renderSetup(root, top); return; }
    renderControl(root, top);
  }
  // ---- 교사 관리(관리자만) ----
  // teachers/{이메일 키}: {email, name, at}. 관리자 주소는 firebase-config.js TEACHER_EMAILS와 database.rules.json에 있다.
  function adminHTML() {
    const list = Object.values(cur.teachers || {}).sort((a, b) => (a.at || 0) - (b.at || 0));
    const admins = (window.TEACHER_EMAILS || []).map(e => e.toLowerCase());
    return `<section class="card lv-admin"><h3>교사 관리 <span class="muted">관리자에게만 보여요</span></h3>
      <p class="muted">등록한 선생님은 이 주소로 로그인해 자기 수업을 만들고 진행할 수 있어요. 다른 선생님의 수업은 열거나 조작할 수 없어요.<br>Google 로그인이 되는 주소만 쓸 수 있어요(Gmail 또는 학교 Google Workspace 계정).</p>
      <div class="lv-row"><div><label for="adEm">이메일</label><input type="text" inputmode="email" id="adEm" placeholder="teacher@gmail.com" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
        <div><label for="adNm">이름(선택)</label><input type="text" id="adNm" maxlength="30" placeholder="예: 김OO 선생님"></div>
        <div style="align-self:end"><button class="btn hot" id="adAdd">교사 추가</button></div></div>
      <p class="err" id="adErr" role="alert"></p>
      <ul class="lv-tlist">${admins.map(e => `<li><b>${esc(e)}</b><span class="chip">관리자</span></li>`).join('')}
        ${list.map(t => `<li><b>${esc(t.email)}</b>${t.name ? `<span class="muted">${esc(t.name)}</span>` : ''}<span class="sp"></span><button class="btn" data-tdel="${esc(emailKey(t.email))}" aria-label="${esc(t.email)} 삭제">삭제</button></li>`).join('')}
        ${list.length ? '' : `<li class="muted">${cur.teachersLoaded ? '아직 등록한 선생님이 없어요.' : '불러오는 중…'}</li>`}</ul></section>`;
  }
  function adminBind() {
    if (!cur.teachersWatch) {
      cur.teachersWatch = NET.watch('teachers', v => { cur.teachers = v || {}; cur.teachersLoaded = true; if (!cur.code) schedule(); });
    }
    const err = $('#adErr');
    $('#adAdd').onclick = async () => {
      const em = $('#adEm').value.trim().toLowerCase(), nm = $('#adNm').value.trim().slice(0, 30);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) || em.length > 100) { err.textContent = '이메일 주소를 확인해 주세요.'; return; }
      if ((window.TEACHER_EMAILS || []).map(e => e.toLowerCase()).includes(em)) { err.textContent = '관리자 주소는 따로 등록하지 않아도 돼요.'; return; }
      const rec = { email: em, at: NET.now() }; if (nm) rec.name = nm;
      try { await NET.put('teachers/' + emailKey(em), rec); $('#adEm').value = ''; $('#adNm').value = ''; err.textContent = ''; if (document.activeElement) document.activeElement.blur(); toast(em + ' 선생님을 등록했어요', 'good'); schedule(); }
      catch (e) { err.textContent = '등록하지 못했어요: ' + (e.code || e.message); }
    };
    document.querySelectorAll('[data-tdel]').forEach(b => b.onclick = async () => {
      const t = (cur.teachers || {})[b.dataset.tdel];
      if (!confirmDel(b)) return;
      try { await NET.put('teachers/' + b.dataset.tdel, null); toast((t ? t.email : '') + ' 등록을 지웠어요', 'good'); }
      catch (e) { toast('지우지 못했어요: ' + (e.code || e.message), 'bad'); }
    });
  }
  // 브라우저 확인 창 대신 두 번 누르기
  function confirmDel(b) { if (b.dataset.armed) return true; b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 삭제'; b.classList.add('hot'); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '삭제'; b.classList.remove('hot'); } }, 3000); return false; }
  function renderSetup(root, top) {
    const saved = cur.setup || { n: 6, code: String(1000 + Math.floor(Math.random() * 9000)), scen: 'mid', mix: false, voteSec: 35, outSec: 10, quizSec: 25, animals: null };
    cur.setup = saved;
    const animals = saved.animals || Array.from({ length: 8 }, (_, i) => ANIMAL_ORDER[i % 4]);
    saved.animals = animals;
    const scens = Array.from({ length: 8 }, (_, i) => saved.mix ? SCEN_ORDER[i % 3] : saved.scen);
    const total = Math.round((GENS * ((+saved.voteSec) + (+saved.outSec)) + QUIZ_GENS.length * ((+saved.quizSec) + DEF.qresSec) + DEF.prepSec + SUMMIT_GENS.length * (DEF.summitSec + DEF.sresSec) + DEF.midSec) / 60);
    root.innerHTML = `<div class="wrap">${top}
      <section class="card lv-setup"><h2>새 수업 만들기</h2>
        <div class="lv-row"><div><label for="sCode">수업 코드</label><input type="text" id="sCode" value="${esc(saved.code)}" maxlength="8"></div>
          <div><label for="sN">모둠 수</label><input type="text" id="sN" value="${saved.n}" inputmode="numeric" maxlength="1"></div>
          <div><label for="sV">투표 시간(초)</label><input type="text" id="sV" value="${saved.voteSec}" inputmode="numeric"></div>
          <div><label for="sO">결과 보기(초)</label><input type="text" id="sO" value="${saved.outSec}" inputmode="numeric"></div>
          <div><label for="sQ">퀴즈(초)</label><input type="text" id="sQ" value="${saved.quizSec}" inputmode="numeric"></div>
          <div><label for="sM">모둠 최대 인원</label><select id="sM">${[0, 3, 4, 5, 6].map(n => `<option value="${n}" ${(saved.maxPer ?? 5) === n ? 'selected' : ''}>${n ? n + '명' : '제한 없음'}</option>`).join('')}</select></div></div>
        <div class="lv-row"><div><label>배출 시나리오</label><div class="lv-seg">${SCEN_ORDER.map(k => `<button data-sc="${k}" aria-pressed="${!saved.mix && saved.scen === k}" style="--sc:${SCOL[k]}">${SCENARIOS[k].name}</button>`).join('')}<button data-sc="mix" aria-pressed="${saved.mix}">모둠마다 다르게</button></div></div></div>
        <div class="lv-groups">${Array.from({ length: saved.n }, (_, i) => `<div class="lv-g"><b>${i + 1}모둠</b><select id="sA${i}" aria-label="${i + 1}모둠 동물">${ANIMAL_ORDER.map(a => `<option value="${a}" ${animals[i] === a ? 'selected' : ''}>${ANIMALS[a].name}</option>`).join('')}</select><span class="chip" style="color:${SCOL[scens[i]]}">${SCENARIOS[scens[i]].name}</span></div>`).join('')}</div>
        <p class="muted">예상 진행 시간 약 <b>${total}분</b> (20세대 · 과학 무전 10회 · 기후 정상 회의 3회 · 60초 준비 · 30초 미니게임 포함, 긴급 구조가 생기면 30초씩 늘고 모두 투표하면 빨라져요)</p>
        <button class="btn hot lg" id="sGo">수업 만들기</button>
      </section>
      <section class="card"><h3>이전 수업 이어서 열기</h3><div class="lv-row"><input type="text" id="sOld" placeholder="수업 코드" style="max-width:160px"><button class="btn" id="sOpen">열기</button></div><p class="muted">내가 만든 수업만 열 수 있어요.</p></section>
      ${NET.isAdmin() ? adminHTML() : ''}</div>`;
    const read = () => { saved.code = $('#sCode').value.trim() || saved.code; saved.n = Math.max(2, Math.min(8, +$('#sN').value || 6)); saved.voteSec = Math.max(15, +$('#sV').value || 40); saved.outSec = Math.max(5, +$('#sO').value || 10); saved.quizSec = Math.max(10, +$('#sQ').value || 25); saved.maxPer = +$('#sM').value; for (let i = 0; i < 8; i++) { const s = document.getElementById('sA' + i); if (s) animals[i] = s.value; } };
    root.querySelectorAll('.lv-setup input,.lv-setup select').forEach(el => el.onchange = () => { read(); setTimeout(renderTeacher, 0); });
    root.querySelectorAll('[data-sc]').forEach(b => b.onclick = () => { read(); if (b.dataset.sc === 'mix') saved.mix = true; else { saved.mix = false; saved.scen = b.dataset.sc; } renderTeacher(); });
    $('#sGo').onclick = () => { read(); createRoom({ code: saved.code.replace(/[^0-9A-Za-z_-]/g, ''), maxPer: saved.maxPer ?? 5, voteSec: saved.voteSec, outSec: saved.outSec, quizSec: saved.quizSec, groups: Array.from({ length: saved.n }, (_, i) => ({ name: (i + 1) + '모둠', animal: animals[i], scen: scens[i] })) }); };
    $('#sOpen').onclick = () => { const c = $('#sOld').value.trim(); if (c) openRoom(c); };
    if (NET.isAdmin()) adminBind();
    const o = $('#tOut'); if (o) o.onclick = () => NET.logout();
  }
  function renderControl(root, top) {
    const L = R.live || {}, M = R.meta, gen = L.gen || 0, sub = L.sub || 'lobby';
    const qr = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSVG(joinURL(cur.code)));
    const nPlayers = Object.keys(R.players || {}).length;
    const rows = order().map(gid => {
      const g = G(gid), st = groupState(gid), ms = members(gid), roles = rolesOf(gid), run = st.run;
      const box = boxOf(sub, gen), SUBMIT = ['event', 'quiz', 'prep', 'summit', 'rescue', 'prep2'];
      const done = ms.filter(m => box && box[m.uid]).length;
      return `<tr><td><b>${esc(g.name)}</b><br><small style="color:${SCOL[g.scen]}">${ANIMALS[g.animal].name} · ${SCENARIOS[g.scen].name}</small></td>
        <td><div class="lv-mems">${ms.map(m => { const voted = box && box[m.uid]; return `<span class="lv-mem ${SUBMIT.includes(sub) ? (voted ? 'done' : 'wait') : ''}"><b>${esc(m.name)}</b>${roles[m.uid] ? `<small>★${esc((roleOf(g.animal, roles[m.uid]) || {}).name || '')}</small>` : ''}
          <select data-move="${m.uid}" aria-label="${esc(m.name)} 모둠 옮기기">${order().map(o => `<option value="${o}" ${o === gid ? 'selected' : ''}>${esc(G(o).name)}</option>`).join('')}</select>
          ${cur.kickArm === m.uid ? `<button class="lv-kick sure" data-kick="${m.uid}">내보내기 확인</button><button class="lv-kick" data-kickx="1">취소</button>` : `<button class="lv-kick" data-kickarm="${m.uid}" aria-label="${esc(m.name)} 내보내기">✕</button>`}</span>`; }).join('') || '<span class="muted">아직 없음</span>'}</div>
          ${M.maxPer && ms.length > M.maxPer ? `<small class="err">최대 ${M.maxPer}명 초과</small>` : ''}</td>
        <td class="num">${run ? (st.alive ? Math.round(st.pop) : '멸종') : '–'}</td><td class="num">${run ? Math.round(st.energy) : '–'}</td><td class="num">${run ? Math.round(st.health) : '–'}</td><td class="num">${run ? Math.round(st.hab) : '–'}</td>
        <td class="num">${SUBMIT.includes(sub) ? `${done}/${ms.length}` : ''}</td><td class="num">${(() => { const t = ms.reduce((a, m) => a + scoreOf(m.uid).total, 0); return t || ''; })()}</td></tr>`;
    }).join('');
    const tgOpts = `<option value="all">모든 모둠</option>` + order().map(g => `<option value="${g}">${esc(G(g).name)}</option>`).join('');
    root.innerHTML = `<div class="wrap lv-teacher">${top}
      <section class="card lv-head">
        <div class="lv-codebox"><img src="${qr}" alt="학생 접속 QR" width="120" height="120"><div><div class="eyebrow">수업 코드</div><div class="lv-code">${esc(cur.code)}</div><small class="muted">${esc(joinURL(cur.code))}</small><br><small>접속 ${nPlayers}명</small></div></div>
        <div class="lv-stage"><div class="eyebrow">${sub === 'lobby' || sub === 'prep' ? '' : `${gen + 1}세대 · ${DECADES[Math.min(gen, GENS - 1)]}년대 · `}${SUB_NAME[sub] || ''}</div>
          <div class="lv-clock" data-clock></div><div class="lv-tbar"><i data-bar></i></div>
          <div class="lv-btns">
            <button class="btn" id="cBoard">전자칠판 화면 열기</button>
            <button class="btn" id="cRoles">특임대 편성·공지</button>
            ${sub === 'lobby' ? `<button class="btn hot" id="cPrep">60초 준비 시작</button><button class="btn" id="cSkip">준비 없이 시작</button>` : ''}
            ${!['lobby', 'end'].includes(sub) ? `<button class="btn hot" id="cNext">지금 마감 ▶</button><button class="btn" id="cPause">${L.paused ? '재개' : '일시정지'}</button><button class="btn" id="cMore">+15초</button>` : ''}
            <label class="lv-auto"><input type="checkbox" id="cAuto" ${M.auto !== false ? 'checked' : ''}> 시간 끝나면 자동 진행</label>
          </div></div>
      </section>
      <section class="card"><h3>기습 이벤트</h3><p class="muted">누르는 즉시 전자칠판과 대상 모둠 휴대폰 화면 전체에 재난 속보 스플래시가 뜨고, 이번 세대 결과에 반영돼요. "미리보기"는 이 화면에서만 보여 줘요.</p>
        <div class="lv-row"><label for="cTarget" style="margin:0">대상</label><select id="cTarget">${tgOpts}</select></div>
        <div class="lv-sur">${SURPRISE_ORDER.map(k => { const S = SURPRISES[k]; return `<div class="lv-surwrap"><button class="lv-surbtn ${k === 'deal' ? 'good' : ''}" data-sur="${k}"><span>${S.icon}</span><b>${S.name}</b><small>${S.dT ? (S.dT > 0 ? '+' : '') + S.dT + '°C 이번 세대' : S.permT ? (S.permT > 0 ? '+' : '') + S.permT + '°C 계속' : '환경 피해'}</small></button><button class="lv-peek" data-peek="${k}" title="내 화면에서만 스플래시 미리보기">미리보기</button></div>`; }).join('')}</div>
        ${cuHTML()}
        ${Object.keys(L.pending || {}).length ? `<p>대기 중: ${Object.values(L.pending).map(p => `<span class="chip down">${esc(surpriseDef(specOf(p)).name)} → ${p.target === 'all' ? '모두' : esc(G(p.target).name)}</span>`).join(' ')}</p>` : ''}
      </section>
      <section class="card"><div class="lv-row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">모둠 현황</h3>
        <div class="lv-btns"><label class="lv-auto" for="cMax">모둠 최대 인원</label><select id="cMax">${[0, 3, 4, 5, 6].map(n => `<option value="${n}" ${(M.maxPer || 0) === n ? 'selected' : ''}>${n ? n + '명' : '제한 없음'}</option>`).join('')}</select>
        <button class="btn" id="cBalance">인원 고르게 나누기</button></div></div>
        <p class="muted" style="font-size:13px">학생 옆 목록에서 모둠을 바꾸면 그 학생 휴대폰도 바로 새 모둠 화면으로 바뀝니다. ✕는 중복 접속이나 잘못 들어온 학생을 내보낼 때 쓰세요(그 휴대폰은 다시 참여 화면으로 돌아가요). 옮긴 학생의 특임대 역할은 사라져요.</p>
        <div class="scroll"><table class="lv-table"><thead><tr><th>모둠</th><th>모둠원 (★특임대)</th><th>개체군</th><th>에너지</th><th>건강</th><th>서식지</th><th>제출</th><th>개인 점수 합</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      <section class="card"><div class="lv-row"><button class="btn" id="cNew">새 수업 만들기</button>${sub === 'end' ? '' : ''}</div></section>
    </div>`;
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on('tOut', () => NET.logout());
    on('cBoard', () => { const w = window.open(location.origin + '/century/#board/' + cur.code, 'cg-board', 'popup,width=1366,height=800'); if (!w) toast('팝업이 막혔어요. 주소창 오른쪽에서 팝업을 허용하거나 전자칠판에서 ' + location.origin + '/century/#board/' + cur.code + ' 를 여세요', 'bad'); });
    on('cRoles', () => { if (!nPlayers) return toast('먼저 학생들이 접속해야 해요', 'bad'); makeRoles(); });
    on('cPrep', () => NET.update({ [`${base()}/prep`]: null }).then(() => setStage('prep', M.prepSec || DEF.prepSec, { gen: 0 })));
    on('cSkip', () => { liveUpdate({ sub: 'prep' }).then(() => { R.live.sub = 'prep'; cur.busy = null; advanceStage(); }); });
    on('cNext', () => { cur.busy = null; if (L.paused) liveUpdate({ paused: false }); liveUpdate({ deadline: NET.now() - 1 }).then(() => { if (M.auto === false) { cur.busy = L.step; advanceStage(); } }); });
    on('cPause', () => { if (L.paused) liveUpdate({ paused: false, deadline: NET.now() + (L.left || 5000) }); else liveUpdate({ paused: true, left: Math.max(0, L.deadline - NET.now()) }); });
    on('cMore', () => liveUpdate(L.paused ? { left: (L.left || 0) + 15000, total: (L.total || 0) + 15000 } : { deadline: (L.deadline || NET.now()) + 15000, total: (L.total || 0) + 15000 }));
    const au = $('#cAuto'); if (au) au.onchange = () => NET.put(`${base()}/meta/auto`, au.checked);
    root.querySelectorAll('[data-sur]').forEach(b => b.onclick = () => fireSurprise(b.dataset.sur, $('#cTarget').value));
    root.querySelectorAll('[data-peek]').forEach(b => b.onclick = e => { e.stopPropagation(); const t = $('#cTarget').value; Splash.show({ key: b.dataset.peek, mode: 'preview', target: targetName(t), effects: splashEffects(b.dataset.peek, t) }); });
    root.querySelectorAll('[data-move]').forEach(sel => sel.onchange = () => movePlayer(sel.dataset.move, sel.value));
    root.querySelectorAll('[data-kickarm]').forEach(b => b.onclick = () => { cur.kickArm = b.dataset.kickarm; renderTeacher(); });
    root.querySelectorAll('[data-kickx]').forEach(b => b.onclick = () => { cur.kickArm = null; renderTeacher(); });
    root.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { cur.kickArm = null; kickPlayer(b.dataset.kick); });
    cuBind(root);
    const mx = $('#cMax'); if (mx) mx.onchange = () => NET.put(`${base()}/meta/maxPer`, +mx.value);
    on('cBalance', balanceGroups);
    on('cNew', () => { cur.unsubs.forEach(f => f()); cur.unsubs = []; cur.code = null; cur.opened = false; R = blank(); cur.setup = null; try { localStorage.removeItem('cg-century-teacher-code'); } catch (e) {} history.replaceState(null, '', '#teacher'); renderTeacher(); });
    tickClocks();
  }

  // =====================================================================
  //  전자칠판
  // =====================================================================
  function boardStart() {
    if (!cur.code) { document.getElementById('app').innerHTML = '<div class="wrap"><div class="card">주소 끝에 수업 코드가 필요해요. 예: /century/#board/1234</div></div>'; return; }
    NET.ensureAnon().then(() => { subscribe(cur.code); });
    document.getElementById('app').innerHTML = `<div class="lv-board"><div class="lv-gl" id="bGL"></div><div id="bUI"></div><div id="bOver"></div></div>`;
    Board3D.init($('#bGL'));
  }
  function renderBoard() {
    const ui = $('#bUI'); if (!ui) return;
    const L = R.live, M = R.meta;
    if (!M || !L) { ui.innerHTML = `<div class="lv-bhead"><h1>200년 생존기</h1><span>수업 코드 ${esc(cur.code)} 를 기다리는 중…</span></div>`; return; }
    const gen = Math.min(L.gen || 0, GENS - 1), sub = L.sub;
    const qr = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSVG(joinURL(cur.code)));
    const firstRun = order().map(runOf).find(Boolean);
    const Q = sub === 'quiz' || sub === 'quizres' ? (firstRun ? quizFor(Object.assign({}, firstRun, { gen })) : null) : null;
    const head = `<header class="lv-bhead">
      <div class="lv-btitle"><h1>200년 생존기</h1><span>${['lobby', 'prep'].includes(sub) ? '1920년대에서 출발' : `${gen + 1}세대 / ${GENS} · <b>${DECADES[gen]}년대</b>`}</span></div>
      <div class="lv-bphase"><span>${SUB_NAME[sub] || ''}</span><b data-clock></b><span class="lv-tbar"><i data-bar></i></span></div>
      <button class="lv-sound" id="bSound">${Splash.soundOn ? '🔊 경보음 켜짐' : '🔈 경보음 켜기'}</button>
      <button class="lv-full" id="bFull">${document.fullscreenElement ? '전체화면 끄기' : '⛶ 전체화면'}</button>
      <div class="lv-bjoin"><img src="${qr}" alt="" width="64" height="64"><div><small>수업 코드</small><b>${esc(cur.code)}</b></div></div></header>
      ${Object.keys(L.pending || {}).length ? `<div class="lv-pend">${Object.values(L.pending).map(p => { const D = surpriseDef(specOf(p)); return `<span class="${(p.key === 'deal' || (p.custom && p.custom.theme === 'deal')) ? 'good' : ''}">${esc(D.icon)} ${esc(D.name)} → ${esc(targetName(p.target))} · 이번 세대 결과에 반영</span>`; }).join('')}</div>` : ''}`;
    const quizBand = Q ? `<div class="lv-qband"><div class="eyebrow">📡 과학 무전 · 모둠 다수결로 정답이면 보급품</div><h2>${Q.q}</h2><ol>${Q.a.map((a, i) => `<li class="${sub === 'quizres' && i === Q.c ? 'right' : ''}">${a}</li>`).join('')}</ol></div>` : '';
    let stageBand = '';
    if (sub === 'summit' || sub === 'summitres') {
      const res = L.summits && L.summits[gen], all = Object.values(L.summits || {}), tot = all.reduce((a, x) => a + (x.dT || 0), 0);
      stageBand = sub === 'summit'
        ? `<div class="lv-qband lv-sband"><div class="eyebrow">🌍 기후 정상 회의 · ${DECADES[gen]}년대 · 모둠 다수결</div><h2>우리 모둠은 온실 기체를 얼마나 줄일까?</h2><p>감축은 <b>우리 모둠 에너지</b>를 쓰지만, 반 전체 약속의 평균만큼 <b>모든 모둠 세계의 앞으로 기온</b>이 내려갑니다. ${PLEDGES.map(P => `<span class="chip">${P.name} · ${P.cost ? '에너지 −' + P.cost : '비용 없음'}</span>`).join(' ')}</p></div>`
        : res ? `<div class="lv-qband lv-sband"><div class="eyebrow">🌍 정상 회의 결과 · ${DECADES[gen]}년대</div><h2>반 전체 감축 달성률 <span class="up">${Math.round(res.avg / 2 * 100)}%</span> → 다음 세대부터 모든 세계 ${res.dT ? res.dT.toFixed(2) : '0'}°C</h2>
          <span class="lv-meter big"><i data-k="summit:${gen}" data-v="${Math.round(res.avg / 2 * 100)}" data-from="0" style="width:${Math.round(res.avg / 2 * 100)}%;background:#4ADE80"></i></span>
          <p>${Object.entries(res.pl || {}).map(([x, pl]) => `<span class="chip ${pl ? 'up' : ''}">${esc(gname(x))} ${PLEDGES[pl].name}</span>`).join(' ')} <span class="muted">· 지금까지 회의로 바뀐 기온 ${tot.toFixed(2)}°C</span></p></div>` : '';
    }
    if (sub === 'rescue' || sub === 'rescueres') {
      const rg = sub === 'rescue' ? rescueGroups() : order().filter(x => { const rr = R.groups[x] && R.groups[x].rsr; return rr && rr.gen === gen; });
      const first = rg.length ? runOf(rg[0]) : null, Q = first && sub === 'rescue' ? rescueQuizFor(Object.assign({}, first, { gen })) : null;
      stageBand = `<div class="lv-qband lv-rband"><div class="eyebrow">🚑 긴급 구조 미션 · 모둠원 3분의 2가 맞히면 살아남는다</div><h2>${rg.map(x => esc(gname(x)) + ' ' + ANIMALS[G(x).animal].name).join(' · ')}${sub === 'rescueres' ? ' · ' + rg.map(x => R.groups[x].rsr.ok ? '<span class="up">구조 성공!</span>' : '<span class="down">구조 실패</span>').join(' ') : ''}</h2>
        ${Q ? `<h3>${Q.q}</h3><ol>${Q.a.map(a => `<li>${a}</li>`).join('')}</ol>` : ''}</div>`;
    }
    if (sub === 'prep2') stageBand = `<div class="lv-qband"><div class="eyebrow">🎮 30초 미니게임 · 2020년대를 앞두고</div><h2>이미 따뜻해진 바다에서 먹이를 모아라! 모둠 평균만큼 보너스</h2></div>`;
    const lobbyBand = sub === 'lobby' ? `<div class="lv-lobby"><img src="${qr}" alt="학생 접속 QR" width="220" height="220"><div><h2>휴대폰으로 QR을 찍어 접속하세요</h2><p>이름을 쓰고 우리 모둠을 고르면 돼요. 수업 코드 <b class="num">${esc(cur.code)}</b></p><p class="muted">${esc(joinURL(cur.code))}</p></div></div>` : '';
    const cards = order().map(gid => {
      const g = G(gid), A = ANIMALS[g.animal], st = groupState(gid), run = st.run, ms = members(gid), roles = rolesOf(gid);
      let status = '';
      if (sub === 'lobby') status = `<span>${ms.length}명 접속</span>`;
      else if (sub === 'prep') { const n = ms.filter(m => R.prep && R.prep[m.uid]).length; status = `<span>60초 준비 ${n}/${ms.length}명 완료</span>`; }
      else if (run && run.extinctAt != null) status = `<span class="dead">멸종 · ${DECADES[run.extinctAt]}년대</span>`;
      else if (sub === 'event' && run) { const ev = findEvent(run.animal, run.order[gen]); const n = ms.filter(m => R.votes && R.votes[gen] && R.votes[gen][m.uid]).length; status = `<b>${esc(ev.title)}</b><span>투표 ${n}/${ms.length}</span>`; }
      else if (sub === 'outcome' && run && run.last && run.last.gen === gen) { const ev = findEvent(run.animal, run.order[gen]); const Ls = run.last; const dp = Math.round(run.pop - Ls.before.pop); status = `<b>→ ${esc(ev.c[Ls.idx].l)}</b><span class="${dp >= 0 ? 'up' : 'down'}">${A.popName} ${dp >= 0 ? '+' : ''}${dp}</span>${(Ls.roleNames || []).map(n => `<span class="role">★ ${esc(n)}</span>`).join('')}${(Ls.notes || []).map(k => { const N = noteInfo(k) || {}; return `<span class="down">${esc(N.icon)} ${esc(N.name)}</span>`; }).join('')}${Ls.chain ? `<span class="chainc" title="${esc(Ls.chain)}">⛓ 앞선 선택이 돌아옴</span>` : ''}${(() => { const ai = R.groups[gid] && R.groups[gid].aidIn; return ai && ai.gen === gen ? `<span class="up">🤝 ${ai.from.length}모둠 지원</span>` : ''; })()}${run.rescue != null ? '<b class="down">🚑 구조 미션 대기</b>' : ''}`; }
      else if (sub === 'summit' && run) { const box = (R.summit && R.summit[gen]) || {}; status = `<span>🌍 약속 투표 ${ms.filter(m => box[m.uid]).length}/${ms.length}</span>`; }
      else if (sub === 'summitres' && run) { const res = L.summits && L.summits[gen]; const pl = res && res.pl ? res.pl[gid] : null; status = pl != null ? `<span class="${pl ? 'up' : ''}">🌍 ${PLEDGES[pl].name}${PLEDGES[pl].cost ? ' · 에너지 −' + PLEDGES[pl].cost : ''}</span>` : ''; }
      else if (sub === 'rescue' && run) { const box = (R.rescue && R.rescue[gen]) || {}; status = run.rescue != null ? `<b class="down">🚑 구조 미션</b><span>답변 ${ms.filter(m => box[m.uid]).length}/${ms.length}</span>` : ''; }
      else if (sub === 'rescueres' && run) { const rr = R.groups[gid] && R.groups[gid].rsr; status = rr && rr.gen === gen ? `<b class="${rr.ok ? 'up' : 'down'}">🚑 ${rr.ok ? '구조 성공!' : '구조 실패'} (${rr.right}/${rr.n})</b>` : ''; }
      else if (sub === 'prep2' && run) { const n = ms.filter(m => R.prep2 && R.prep2[m.uid]).length; const mg = R.groups[gid] && R.groups[gid].mg; status = `<span>🎮 미니게임 ${n}/${ms.length}명 완료</span>`; }
      else if ((sub === 'quiz' || sub === 'quizres') && run) { const qt = R.groups[gid] && R.groups[gid].qt; const n = ms.filter(m => R.quiz && R.quiz[gen] && R.quiz[gen][m.uid]).length; status = sub === 'quiz' ? `<span>답변 ${n}/${ms.length}</span>` : (qt && qt.gen === gen ? `<span class="${qt.f >= 0.5 ? 'up' : 'down'}">${qt.right || 0}/${qt.n || 0}명 정답 · 보급품 ${Math.round((qt.f || 0) * 100)}%</span>` : ''); }
      else if (sub === 'end' && run) { status = run.extinctAt == null ? `<span class="up">생존 · ${A.popName} ${run.pop}</span>` : `<span class="dead">멸종 · ${DECADES[run.extinctAt]}년대</span>`; }
      const el = stageElapsed(), justExt = run && run.extinctAt === gen && sub === 'outcome', surv = sub === 'end' && run && run.extinctAt == null;
      let bub = '';
      if (sub === 'outcome' && run && run.last && run.last.gen === gen && el < 4500) { const dp = Math.round(run.pop - run.last.before.pop); bub = `<div class="lv-dbub ${dp >= 0 ? 'up' : 'down'}" style="animation-delay:-${Math.max(0, Math.round(el))}ms">${A.popName} ${dp >= 0 ? '+' : ''}${dp}</div>`; }
      return `<article class="lv-card ${run && run.extinctAt != null ? 'ext' : ''} ${justExt ? 'just-ext' : ''} ${surv ? 'surv' : ''}" data-g="${gid}" ${justExt ? `style="--ed:-${Math.max(0, Math.round(el))}ms"` : ''}>
        <header><b>${esc(g.name)}</b><span>${A.name}</span>${isSos(run) && sub !== 'end' ? '<span class="lv-sosb">🆘 구조 요청</span>' : ''}<span class="t" style="color:${tCol(st.T)}">+${f1(st.T)}°C</span><span class="sc" style="color:${SCOL[g.scen]}">${SCENARIOS[g.scen].name}</span></header>
        <div class="lv-view" id="v_${gid}">${run && run.extinctAt != null ? '<div class="lv-stamp">멸종</div>' : ''}${run && run.rescue != null ? '<div class="lv-stamp warn">구조 미션</div>' : ''}${surv ? '<div class="lv-sstamp">생존</div>' : ''}${bub}</div>
        <div class="lv-stats"><span>${A.popName}</span>${barK(st.pop, '#7FD3FF', gid + ':p')}<span>${A.energyName}</span>${barK(st.energy, '#FFC23D', gid + ':e')}<span>${A.healthName}</span>${barK(st.health, '#4ADE80', gid + ':h')}<span>${A.habName}</span>${barK(st.hab, st.hab < 30 ? '#FB7185' : '#A78BFA', gid + ':a')}</div>
        <div class="lv-status">${status}</div>
        <div class="lv-members">${ms.map(m => `<span class="${roles[m.uid] ? 'role' : ''}">${roles[m.uid] ? '★' : ''}${esc(m.name)}</span>`).join('')}</div>
      </article>`;
    }).join('');
    let endBand = '';
    if (sub === 'end') {
      const fr = fairRank(), aw = awards(), tot = Object.values(L.summits || {}).reduce((a, x) => a + (x.dT || 0), 0);
      endBand = `<div class="lv-endband"><div class="lv-endcols">
        <section><h2>🏆 공정 순위표</h2><p class="muted">같은 동물 · 같은 세계의 '보통 모둠'보다 얼마나 잘 버텼나</p>
          <ol class="lv-rank">${fr.map((r, i) => `<li class="${i === 0 ? 'top' : ''}"><b>${i + 1}</b><span>${esc(gname(r.gid))} ${ANIMALS[r.run.animal].name} <small style="color:${SCOL[r.run.scen]}">${SCENARIOS[r.run.scen].name}</small></span><span class="muted">${r.sv >= GENS ? '생존 ' + r.run.pop : DECADES[r.sv] + '년대 멸종'}</span><span class="${r.diff >= 0 ? 'up' : 'down'}">${r.diff >= 0 ? '+' : ''}${r.diff}점</span></li>`).join('')}</ol></section>
        <section><h2>🎖 상</h2><ul class="lv-awards">${aw.map(a => `<li><span>${a.icon}</span><div><b>${a.title}</b><small>${a.who}</small></div></li>`).join('') || '<li class="muted">점수를 모으는 중…</li>'}</ul></section>
        <section><h2>같은 선택, 다른 세계</h2><div class="lv-endgrid">${fr.map(({ gid, run }) => { const reps = SCEN_ORDER.map(k => [k, replay(run, k)]); return `<div><b>${esc(gname(gid))} · ${ANIMALS[run.animal].name}</b>${reps.map(([k, r]) => `<div class="lv-rep"><span style="color:${SCOL[k]}">${SCENARIOS[k].name}</span>${barK(r.pop, SCOL[k], 'end:' + gid + ':' + k, 0)}<span>${r.survived >= GENS && r.pop > 0 ? '생존 ' + r.pop : DECADES[Math.min(r.survived, GENS - 1)] + '년대 멸종'}</span></div>`).join('')}</div>`; }).join('')}</div></section>
        </div><p>온난화의 속도는 동물이 아니라 인류의 배출량이 정한다.${tot ? ` 우리 반의 정상 회의는 기온을 ${tot.toFixed(2)}°C 바꿨다.` : ''}</p></div>`;
    }
    ui.innerHTML = head + lobbyBand + quizBand + stageBand + `<main class="lv-grid n${order().length}">${cards}</main>` + endBand + (sub === 'event' ? decadeBanner(gen, 'big') : '');
    animateMeters(ui);
    const sb = $('#bSound'); if (sb) sb.onclick = () => { Splash.enableSound(); schedule(); };
    const bf = $('#bFull'); if (bf) bf.onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} setTimeout(schedule, 300); };
    const lb = ui.closest('.lv-board'); if (lb) lb.classList.toggle('isend', sub === 'end');
    Board3D.sync(order().map(gid => ({ id: gid, el: document.getElementById('v_' + gid), animal: G(gid).animal, state: Object.assign({}, groupState(gid), { fx: fxFor(gid) }) })));
    // 공지(특임대 · 기습 이벤트)
    const over = $('#bOver'), n = L.notice;
    if (noticeFresh(n) && cur.shownNotice !== n.t) {
      cur.shownNotice = n.t;
      if (n.kind === 'surprise') { over.innerHTML = ''; const sp = specOf(n); Splash.show({ def: surpriseDef(sp), mode: 'board', target: targetName(n.target), effects: splashEffects(sp, n.target) }); }
      else if (n.kind === 'roles') over.innerHTML = `<div class="lv-over" role="alert"><div class="lv-rolesbox"><div class="eyebrow">특임대 편성 공지</div><h2>모둠별 특임대가 정해졌습니다</h2><div class="lv-rgrid">${order().map(gid => { const g = G(gid), ro = rolesOf(gid); return `<div><b>${esc(g.name)} · ${ANIMALS[g.animal].name}</b>${Object.entries(ro).map(([uid, k]) => { const r = roleOf(g.animal, k); const p = R.players[uid]; return `<p>★ <b>${esc(p ? p.name : '')}</b> — ${r.name}<br><small>${r.ability}: ${abilityDesc(g.animal, r.type)} (${ROLE_USES}번)</small></p>`; }).join('') || '<p class="muted">모둠원 없음</p>'}</div>`; }).join('')}</div></div></div>`;
      clearTimeout(cur.overT); cur.overT = setTimeout(() => { if ($('#bOver')) $('#bOver').innerHTML = ''; }, n.kind === 'roles' ? 16000 : 11000);
      over.onclick = () => { over.innerHTML = ''; };
    }
    tickClocks();
  }

  // =====================================================================
  //  학생 휴대폰
  // =====================================================================
  function joinStart() {
    const root = document.getElementById('app');
    let me = null; try { me = JSON.parse(localStorage.getItem('cg-century-me') || 'null'); } catch (e) {}
    if (cur.code && me && me.code !== cur.code) me = null;
    cur.me = me;
    if (!cur.code && me) { cur.code = me.code; history.replaceState(null, '', '#join/' + me.code); }
    if (cur.code) NET.ensureAnon().then(() => { subscribe(cur.code); });
    root.innerHTML = `<div class="lv-phone"><div id="pUI"></div><div class="lv-alertbox" id="pAlert"></div></div>`;
    renderJoin();
  }
  function myUid() { return NET.user && NET.user.uid; }
  function renderJoin() {
    const ui = $('#pUI'); if (!ui || cur.arena) return;
    const L = R.live, M = R.meta, uid = myUid();
    if (!cur.code) {
      ui.innerHTML = `<div class="card lv-joinbox"><h2>수업 참여</h2><label for="jc">수업 코드</label><input type="text" id="jc" inputmode="numeric" maxlength="8"><button class="btn hot lg" id="jgo">들어가기</button></div>`;
      $('#jgo').onclick = () => { const c = $('#jc').value.trim(); if (c) location.hash = '#join/' + c; };
      return;
    }
    if (!M || !L) { ui.innerHTML = `<div class="card">수업 ${esc(cur.code)} 에 연결하는 중… <br><small class="muted">코드가 맞는지 확인하세요.</small></div>`; return; }
    const meP = uid && R.players && R.players[uid];
    if (!meP) {
      ui.innerHTML = `<div class="card lv-joinbox"><div class="eyebrow">수업 코드 ${esc(cur.code)}</div><h2>200년 생존기</h2>
        <label for="jn">이름(또는 번호)</label><input type="text" id="jn" maxlength="12" value="${esc((cur.me && cur.me.name) || '')}">
        <div class="eyebrow" style="margin-top:6px">우리 모둠 고르기</div>
        <div class="lv-pick">${order().map(gid => { const g = G(gid), n = members(gid).length, full = M.maxPer && n >= M.maxPer; return `<button data-g="${gid}" ${full ? 'disabled' : ''}><b>${esc(g.name)}</b><span>${ANIMALS[g.animal].name}</span><small>${n}명${M.maxPer ? ' / ' + M.maxPer + '명' : ''}${full ? ' · 가득 참' : ''}</small></button>`; }).join('')}</div>
        <p class="err" id="jerr"></p></div>`;
      ui.querySelectorAll('[data-g]').forEach(b => b.onclick = async () => {
        const name = $('#jn').value.trim(); if (!name) { $('#jerr').textContent = '이름을 먼저 쓰세요.'; return; }
        await NET.ensureAnon();
        if (M.maxPer && members(b.dataset.g).length >= M.maxPer) { $('#jerr').textContent = '그 모둠은 가득 찼어요. 다른 모둠을 고르세요.'; return; }
        await NET.put(`${roomPath(cur.code)}/players/${myUid()}`, { name, g: b.dataset.g, t: NET.now() });
        cur.me = { code: cur.code, name }; try { localStorage.setItem('cg-century-me', JSON.stringify(cur.me)); } catch (e) {}
      });
      return;
    }
    const gid = meP.g, g = G(gid); if (!g) { ui.innerHTML = '<div class="card">모둠 정보를 찾을 수 없어요.</div>'; return; }
    if (cur.lastG && cur.lastG !== gid) toast(`선생님이 ${g.name}(${ANIMALS[g.animal].name})으로 옮겼어요`, 'good');
    cur.lastG = gid;
    const A = ANIMALS[g.animal], st = groupState(gid), run = st.run, gen = Math.min(L.gen || 0, GENS - 1), sub = L.sub;
    const myRoleKey = rolesOf(gid)[uid], myRole = myRoleKey ? roleOf(g.animal, myRoleKey) : null, usedN = (usesOf(gid)[uid] || 0);
    const my = scoreOf(uid);
    const head = `<header class="lv-phead"><div><b>${esc(g.name)}</b> · ${A.name} <span class="muted">· ${esc(meP.name)}</span> <span class="lv-myscore" title="개인 점수">⭐ ${my.total}</span></div><div class="lv-pclock"><span>${sub === 'lobby' || sub === 'prep' ? SUB_NAME[sub] : `${DECADES[gen]}년대 · ${SUB_NAME[sub]}`}</span><b data-clock></b></div></header>
      ${myRole ? `<div class="lv-role">★ 나는 <b>${myRole.name}</b> · ${myRole.ability}: ${abilityDesc(g.animal, myRole.type)} <span class="muted">(남은 ${Math.max(0, ROLE_USES - usedN)}번)</span></div>` : ''}`;
    const nb = (k, v) => `<b data-nk="me:${k}" data-n="${Math.round(v)}">${Math.round(v)}</b>`;
    const stats = run ? `<div class="lv-pstats"><span>${A.popName} ${nb('p', st.pop)}</span><span>${A.energyName} ${nb('e', st.energy)}</span><span>${A.healthName} ${nb('h', st.health)}</span><span>${A.habName} ${nb('a', st.hab)}</span><span style="color:${tCol(st.T)}">+${f1(st.T)}°C</span></div>` : '';
    let body = '';
    if (sub === 'lobby') body = `<div class="card"><h3>선생님이 시작할 때까지 기다려요</h3><p>우리 모둠: ${members(gid).map(m => esc(m.name)).join(', ')}</p><p class="muted">1920년대 ${A.place}에서 출발해 2110년대까지, 200년을 버텨야 해요. 선택지는 모둠원 다수결로 정해져요.</p></div>`;
    else if (sub === 'prep') {
      const sent = R.prep && R.prep[uid];
      body = sent ? `<div class="card"><h3>준비 결과를 보냈어요</h3><p>${A.prep.food} ${sent.food} · ${A.prep.special} ${sent.special} · 피해 ${sent.damage}</p><p class="muted">모둠원 결과의 평균으로 우리 모둠이 출발해요.</p></div>`
        : `<div class="card"><h3>60초 준비</h3><p>${A.prep.goal}</p><button class="btn hot lg" id="pArena">▶ 60초 시작</button></div>`;
    }
    else if (!run) body = '<div class="card">기록을 준비하는 중…</div>';
    else if (run.extinctAt != null && sub !== 'end') body = `<div class="card lv-dead"><h3>${A.name}의 기록이 ${DECADES[run.extinctAt]}년대에 멈췄어요</h3><p>다른 모둠의 결과를 전자칠판에서 지켜보세요. 무엇이 원인이었는지 생각해 보세요.</p><div class="chain">${A.chain.map((c, i) => `${i ? '<i>→</i>' : ''}<span>${c}</span>`).join('')}</div></div>`;
    else if (sub === 'event') {
      const ev = findEvent(run.animal, run.order[gen]);
      const vbox = (R.votes && R.votes[gen]) || {}, ms = members(gid), myV = vbox[uid];
      const counts = ev.c.map((_, i) => ms.filter(m => vbox[m.uid] && vbox[m.uid].c === i));
      const luckOn = myRole && myRole.type === 'luck' && R.abil && R.abil[gen] && R.abil[gen][uid];
      const abilOn = R.abil && R.abil[gen] && R.abil[gen][uid];
      body = `<div class="card lv-ev"><div class="eyebrow">${gen + 1}세대 · ${DECADES[gen]}년대</div><h2>${ev.title}</h2><p>${ev.text}</p>
        <div class="lv-choices">${ev.c.map((c, i) => `<button class="lv-choice ${myV && myV.c === i ? 'on' : ''}" data-v="${i}"><b>${c.l}</b><span class="hints">${hintChips(run.animal, c, run.flags, luckOn)}</span>
          <span class="lv-vbar"><i style="width:${ms.length ? counts[i].length / ms.length * 100 : 0}%"></i></span><span class="lv-who">${counts[i].map(m => esc(m.name)).join(' · ') || '&nbsp;'}</span></button>`).join('')}</div>
        <p class="muted">눌러서 투표 · 시간 안에는 바꿀 수 있어요 · 모둠 다수결로 확정</p>
        ${myRole ? `<button class="btn ${abilOn ? 'ice' : ''} lg" id="pAbil" ${usedN >= ROLE_USES ? 'disabled' : ''}>${abilOn ? '★ 능력 사용 예약됨 (누르면 취소)' : usedN >= ROLE_USES ? '능력을 모두 썼어요' : `★ ${myRole.ability} 사용하기`}</button>` : ''}</div>`;
      const myPr = R.pred && R.pred[gen] && R.pred[gen][uid];
      body += `<div class="card lv-pred"><div class="eyebrow">🎯 나의 예측 · 맞히면 개인 점수 +1</div><p>이번 10년이 지나면 우리 ${A.popName}는?</p>
        <div class="lv-prbtns"><button data-pr="1" class="${myPr && myPr.pr === 1 ? 'on' : ''}">▲ 늘어난다</button><button data-pr="-1" class="${myPr && myPr.pr === -1 ? 'on' : ''}">▼ 줄거나 그대로</button></div></div>`;
      const sosOthers = sosGroups().filter(x => x !== gid), myAid = R.aid && R.aid[gen] && R.aid[gen][uid], aidLeft = AID.perStudent - my.aid;
      if (isSos(run)) body += `<div class="card lv-sos"><b>🆘 우리 모둠이 위기예요!</b> 전자칠판에 구조 요청이 떴어요. 다른 모둠이 먹이를 보내 줄 수 있어요.</div>`;
      if (sosOthers.length) body += `<div class="card lv-aid"><div class="eyebrow">🤝 구조 요청 · 우리 ${A.energyName} −${AID.cost} → 그 모둠 에너지 +${AID.gain} · 건강 +${AID.health} · 한 판에 ${AID.perStudent}번 (남은 ${Math.max(0, aidLeft)}번) · 개인 점수 +1</div>
        <div class="lv-aidbtns">${sosOthers.map(x => { const on = myAid && myAid.to === x; return `<button data-aid="${x}" class="${on ? 'on' : ''}" ${!on && aidLeft <= 0 ? 'disabled' : ''}>${on ? '✓ 보내기 예약됨' : '먹이 보내기'} → <b>${esc(gname(x))}</b> ${ANIMALS[G(x).animal].name} <small>(${ANIMALS[G(x).animal].popName} ${Math.round(runOf(x).pop)})</small></button>`; }).join('')}</div></div>`;
    }
    else if (sub === 'outcome' || ((sub === 'quiz' || sub === 'quizres') && run.last)) {
      const ev = findEvent(run.animal, run.order[gen]), Ls = run.last;
      const tl = R.groups[gid] && R.groups[gid].tally;
      const outcome = Ls && Ls.gen === gen ? `<div class="card lv-out"><div class="eyebrow">${DECADES[gen]}년대 결과</div><h2>${ev.title}</h2>
        <p class="lv-pick1">모둠 선택: <b>${esc(ev.c[Ls.idx].l)}</b>${tl && tl.gen === gen ? ` <small class="muted">(${tl.counts.join(' : ')}${tl.tie ? ', 동점 → 무작위' : ''})</small>` : ''}</p>
        <p class="lv-otext">→ ${esc(Ls.text)}${Ls.roll ? ` <small>(${Ls.roll.good ? '운이 따랐다' : '운이 없었다'})</small>` : ''}</p>
        <div class="deltas">${effChips(run.animal, Ls.eff) || ''}${(Ls.roleNames || []).map(n => `<span class="chip bonus">★ ${esc(n)}</span>`).join('')}${(Ls.notes || []).map(k => { const N = noteInfo(k) || {}; return `<span class="chip down">${esc(N.icon)} ${esc(N.name)}</span>`; }).join('')}</div>
        ${Ls.chain ? `<p class="lv-chain">⛓ <b>앞선 선택이 돌아왔다</b> · ${esc(Ls.chain)} ${effChips(run.animal, Ls.chainE)}</p>` : ''}
        ${(() => { const ai = R.groups[gid] && R.groups[gid].aidIn; return ai && ai.gen === gen ? `<p class="lv-aidin">🤝 ${ai.from.map(x => esc(gname(x))).join(' · ')}에서 먹이를 보냈어요 (${A.energyName} +${AID.gain * ai.from.length})</p>` : ''; })()}
        ${(() => { const pr = R.pred && R.pred[gen] && R.pred[gen][uid]; if (!pr) return ''; const dp = run.pop - Ls.before.pop, hit = (dp > 0 && pr.pr === 1) || (dp <= 0 && pr.pr === -1); return `<p class="lv-prres ${hit ? 'up' : 'down'}">🎯 ${hit ? '예측 적중! 개인 점수 +1' : '예측이 빗나갔어요'}</p>`; })()}
        ${run.rescue != null ? `<p class="lv-prres down">🚑 ${A.popName}가 0이 되었어요! 곧 긴급 구조 미션이 시작돼요. 모둠원 3분의 2가 맞히면 살아남아요.</p>` : ''}
        <p class="muted">10년의 자연 변화 · ${A.habName} ${Math.round(Ls.hab)} → ${A.popName} ${Ls.natural.dp > 0 ? '+' : ''}${Ls.natural.dp}</p>
        <div class="sci"><b>과학 노트</b> · ${ev.sci}</div></div>` : '';
      let quiz = '';
      if (sub === 'quiz' || sub === 'quizres') {
        const Q = quizFor(Object.assign({}, run, { gen })), my = R.quiz && R.quiz[gen] && R.quiz[gen][uid], qt = R.groups[gid] && R.groups[gid].qt;
        const qms = members(gid), qbox = (R.quiz && R.quiz[gen]) || {};
        quiz = `<div class="card lv-quiz"><div class="eyebrow">📡 과학 무전 · 맞힌 모둠원 비율만큼 ${A.energyName} 최대 +12 · ${A.healthName} 최대 +5 · 맞히면 개인 점수 +1</div><h3>${Q.q}</h3>
          <div class="lv-qopts">${Q.a.map((a, i) => { let c = ''; if (sub === 'quizres') { if (i === Q.c) c = 'right'; else if (my && my.a === i) c = 'wrong'; } else if (my && my.a === i) c = 'on'; return `<button class="lv-qopt ${c}" data-q="${i}" ${sub === 'quizres' ? 'disabled' : ''}><span>${'ABCD'[i]}</span>${a}</button>`; }).join('')}</div>
          <p class="muted">${sub === 'quiz' ? `모둠 답변 ${qms.filter(m => qbox[m.uid]).length}/${qms.length} · 맞힌 사람 비율만큼 보급품` : (qt && qt.gen === gen ? `<b class="${qt.f >= 0.5 ? 'up' : 'down'}">모둠 ${qt.right || 0}/${qt.n || 0}명 정답 · 보급품 ${A.energyName} +${quizGain(qt.f || 0).energy} · ${A.healthName} +${quizGain(qt.f || 0).health}</b>` : '')}</p>
          ${sub === 'quizres' ? `<p class="sci">${Q.e}</p>` : ''}</div>`;
      }
      body = (sub === 'quiz' || sub === 'quizres') ? quiz + outcome : outcome;
    }
    else if (sub === 'rescue' || sub === 'rescueres') {
      const rr = R.groups[gid] && R.groups[gid].rsr;
      if (sub === 'rescue' && run.rescue != null) {
        const Q = rescueQuizFor(Object.assign({}, run, { gen })), mine = R.rescue && R.rescue[gen] && R.rescue[gen][uid], ms = members(gid), box = (R.rescue && R.rescue[gen]) || {};
        body = `<div class="card lv-rescue"><div class="eyebrow">🚑 긴급 구조 미션 · 한 판에 한 번</div><h2>${A.name}를 살려라!</h2><p>모둠원 ${Math.max(1, Math.ceil(ms.length * 2 / 3))}명 이상이 맞히면 ${A.popName} ${TUNE.rp}로 다시 일어서요. 맞히면 개인 점수 +1</p><h3>${Q.q}</h3>${qOpts(Q, mine, false, 'data-rq')}<p class="muted">답변 ${ms.filter(m => box[m.uid]).length}/${ms.length}</p></div>`;
      } else if (sub === 'rescueres' && rr && rr.gen === gen) {
        body = `<div class="card lv-rescue ${rr.ok ? 'ok' : 'fail'}"><h2>${rr.ok ? '🚑 구조 성공!' : '구조 실패'}</h2><p>${rr.right}/${rr.n}명 정답 (필요 ${rr.need}명). ${rr.ok ? `${A.name}가 다시 일어섰어요. 이제 기회는 없어요.` : `${A.name}의 기록이 ${DECADES[gen]}년대에 멈췄어요.`}</p></div>`;
      } else body = `<div class="card"><h3>🚑 ${rescueGroups().map(gname).join(' · ') || '다른 모둠'} 긴급 구조 미션 중</h3><p class="muted">전자칠판에서 함께 응원해요.</p></div>`;
    }
    else if (sub === 'summit' || sub === 'summitres') {
      const mine = R.summit && R.summit[gen] && R.summit[gen][uid], box = (R.summit && R.summit[gen]) || {}, ms = members(gid), res = L.summits && L.summits[gen];
      if (sub === 'summit') body = `<div class="card lv-summit"><div class="eyebrow">🌍 기후 정상 회의 · ${DECADES[gen]}년대</div><h2>우리 모둠은 온실 기체를 얼마나 줄일까?</h2>
        <p>감축을 약속하면 <b>우리 ${A.energyName}</b>를 쓰지만, 반 전체 약속의 평균만큼 <b>모든 모둠 세계의 앞으로 기온</b>이 내려가요. 모둠 다수결로 정해요.</p>
        <div class="lv-pledges">${PLEDGES.map((P, i) => { const n = ms.filter(m => box[m.uid] && box[m.uid].p === i).length; return `<button data-pl="${i}" class="${mine && mine.p === i ? 'on' : ''}"><b>${P.name}</b><small>${P.cost ? `우리 ${A.energyName} −${P.cost}` : '비용 없음'} · 기여 ${P.w}</small><span class="lv-vbar"><i style="width:${ms.length ? n / ms.length * 100 : 0}%"></i></span></button>`; }).join('')}</div>
        <p class="muted">반 평균 기여 1당 앞으로 −${TUNE.sk}°C · 모두 '지금처럼'이면 아무 변화가 없어요.</p></div>`;
      else body = res ? `<div class="card lv-summit"><div class="eyebrow">🌍 정상 회의 결과 · ${DECADES[gen]}년대</div><h2>반 전체 감축 달성률 ${Math.round(res.avg / 2 * 100)}%</h2>
        <p>우리 모둠: <b>${PLEDGES[(res.pl || {})[gid] || 0].name}</b> · 다음 세대부터 모든 세계 기온 <b>${res.dT ? res.dT.toFixed(2) : '0'}°C</b></p>
        <div class="lv-pledgegrid">${Object.entries(res.pl || {}).map(([x, p]) => `<span class="chip ${p ? 'up' : ''}">${esc(gname(x))} ${PLEDGES[p].name}</span>`).join('')}</div></div>` : '';
    }
    else if (sub === 'prep2') {
      const sent = R.prep2 && R.prep2[uid];
      body = sent ? `<div class="card"><h3>미니게임 결과를 보냈어요</h3><p>${A.prep.food} ${sent.food} · ${A.prep.special} ${sent.special} · 피해 ${sent.damage}</p><p class="muted">모둠원 평균만큼 ${A.energyName}·${A.popName}가 늘고, 피해만큼 ${A.healthName}가 줄어요.</p></div>`
        : `<div class="card"><div class="eyebrow">🎮 30초 미니게임 · 2020년대를 앞두고</div><h3>지금은 1920년대보다 훨씬 따뜻해요</h3><p>${A.prep.goal}</p><button class="btn hot lg" id="pArena2">▶ 30초 시작</button></div>`;
    }
    else if (sub === 'end') {
      const alive = run.extinctAt == null, reps = SCEN_ORDER.map(k => [k, replay(run, k)]);
      body = `<div class="card lv-end"><span class="stamp ${alive ? 'alive' : 'dead'}">${alive ? '생존' : '멸종'}</span>
        <p>${alive ? `${A.name}는 200년을 버텨 2110년대를 맞았다. 남은 ${A.popName} ${run.pop}.` : `${A.name}의 기록은 ${DECADES[run.extinctAt]}년대에 멈췄다.`}</p>
        <div class="chain">${A.chain.map((c, i) => `${i ? '<i>→</i>' : ''}<span>${c}</span>`).join('')}</div>
        <h3>같은 선택, 다른 세계</h3>${reps.map(([k, r]) => `<div class="lv-rep"><span style="color:${SCOL[k]}">${SCENARIOS[k].name}</span>${bar(r.pop, SCOL[k])}<span>${r.survived >= GENS && r.pop > 0 ? '생존 ' + r.pop : DECADES[Math.min(r.survived, GENS - 1)] + '년대 멸종'}</span></div>`).join('')}
        <p class="muted">결과 코드 <b class="num">${resultCode(run)}</b></p></div>`;
      const fr = fairRank(), rk = fr.findIndex(x => x.gid === gid), me2 = scoreOf(uid);
      body += `<div class="card lv-myend"><h3>⭐ 내 점수 ${me2.total}점</h3><p>🎯 예측 ${me2.pred} · 📡 무전 ${me2.quiz} · 🚑 구조 ${me2.rs} · 🤝 지원 ${me2.aid} · ★ 특임대 ${me2.abil}</p>
        ${rk >= 0 ? `<p>우리 모둠 공정 순위 <b>${rk + 1}위</b> / ${fr.length}모둠 <span class="${fr[rk].diff >= 0 ? 'up' : 'down'}">(보통 모둠보다 ${fr[rk].diff >= 0 ? '+' : ''}${fr[rk].diff}점)</span></p>` : ''}
        <ul class="lv-awards">${awards().map(a => `<li><span>${a.icon}</span><div><b>${a.title}</b><small>${a.who}</small></div></li>`).join('')}</ul></div>`;
    }
    let fxo = '';
    if (sub === 'event') fxo = decadeBanner(gen, 'small');
    if (run && run.extinctAt === gen && sub === 'outcome' && stageElapsed() < 5000) fxo = `<div class="lv-extov" style="animation-delay:-${Math.max(0, Math.round(stageElapsed()))}ms" aria-hidden="true"><b>멸종</b><span>${A.name}의 기록이 ${DECADES[gen]}년대에 멈췄어요</span></div>`;
    if (sub === 'end' && run && run.extinctAt == null) body = `<div class="lv-confetti" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.18}s;--c:${['#FFD166', '#7FD3FF', '#4ADE80', '#FB7185', '#A78BFA'][i % 5]}"></i>`).join('')}</div>` + body;
    ui.innerHTML = head + `<div class="lv-pstage" id="pStage">${fxo}</div>` + stats + body;
    animateNums(ui);
    // 3D
    const box = $('#pStage');
    if (box && World3D.available()) { box.appendChild(World3D.element()); World3D.setBiome(g.animal); World3D.setState({ hab: st.hab, pop: run ? st.pop : 60, health: st.health, T: st.T, fx: fxFor(gid) }); World3D.setAutoRotate(true); }
    // 동작
    ui.querySelectorAll('[data-v]').forEach(b => b.onclick = () => NET.put(`${roomPath(cur.code)}/votes/${gen}/${uid}`, { g: gid, c: +b.dataset.v, t: NET.now() }));
    ui.querySelectorAll('[data-q]').forEach(b => b.onclick = () => NET.put(`${roomPath(cur.code)}/quiz/${gen}/${uid}`, { g: gid, a: +b.dataset.q, t: NET.now() }));
    const ab = $('#pAbil'); if (ab) ab.onclick = () => { const on = R.abil && R.abil[gen] && R.abil[gen][uid]; NET.put(`${roomPath(cur.code)}/abil/${gen}/${uid}`, on ? null : { g: gid, t: NET.now() }); };
    const pa = $('#pArena'); if (pa) pa.onclick = () => startArena(g.animal, gid);
    const pa2 = $('#pArena2'); if (pa2) pa2.onclick = () => startArena(g.animal, gid, true);
    ui.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { const v = +b.dataset.pr, c0 = R.pred && R.pred[gen] && R.pred[gen][uid]; NET.put(`${roomPath(cur.code)}/pred/${gen}/${uid}`, c0 && c0.pr === v ? null : { pr: v, g: gid, t: NET.now() }); });
    ui.querySelectorAll('[data-aid]').forEach(b => b.onclick = () => { const to = b.dataset.aid, c0 = R.aid && R.aid[gen] && R.aid[gen][uid]; NET.put(`${roomPath(cur.code)}/aid/${gen}/${uid}`, c0 && c0.to === to ? null : { to, g: gid, t: NET.now() }); });
    ui.querySelectorAll('[data-rq]').forEach(b => b.onclick = () => NET.put(`${roomPath(cur.code)}/rescue/${gen}/${uid}`, { g: gid, a: +b.dataset.rq, t: NET.now() }));
    ui.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => NET.put(`${roomPath(cur.code)}/summit/${gen}/${uid}`, { g: gid, p: +b.dataset.pl, t: NET.now() }));
    // 경보
    const n = L.notice, al = $('#pAlert');
    if (al && noticeFresh(n) && cur.shownNotice !== n.t) {
      cur.shownNotice = n.t;
      if (n.kind === 'surprise' && (n.target === 'all' || n.target === gid)) { const sp = specOf(n); Splash.show({ def: surpriseDef(sp), mode: 'phone', target: n.target === 'all' ? '모든 모둠' : '우리 모둠', effects: splashEffects(sp, n.target, gid) }); }
      if (n.kind === 'roles' && myRole) al.innerHTML = `<div class="lv-over" role="alert"><div class="lv-rolesbox"><div class="eyebrow">특임대 임명</div><h2>당신은 ${myRole.name}!</h2><p><b>${myRole.ability}</b>: ${abilityDesc(g.animal, myRole.type)}</p><p class="muted">투표 시간에 능력 버튼을 눌러 쓰세요. 한 판에 ${ROLE_USES}번까지.</p></div></div>`;
      clearTimeout(cur.alT); cur.alT = setTimeout(() => { al.innerHTML = ''; }, 9000);
      al.onclick = () => { al.innerHTML = ''; };
    }
    tickClocks();
  }
  function startArena(animal, gid, mid) {
    const ui = $('#pUI'), A = ANIMALS[animal], dur = mid ? 30 : 60;
    cur.arena = true;
    ui.innerHTML = `<div class="lv-arena"><div class="stageBox" id="aStage"></div><div class="vign" id="vign"></div>
      <div class="hud"><div class="timer" id="tm"><span class="t" id="tt">${dur}</span><span class="tbar"><i id="tb" style="width:100%"></i></span></div>
      <div class="cnt"><span class="dot f"></span><div><div class="v" id="cf">0</div><small>${A.prep.food}</small></div></div>
      <div class="cnt"><span class="dot s"></span><div><div class="v" id="cs">0</div><small>${A.prep.special}</small></div></div>
      <div class="cnt"><span class="dot h"></span><div><div class="v" id="cd">0</div><small>피해</small></div></div></div><div class="status" id="st" hidden></div></div>`;
    const box = $('#aStage'); if (World3D.available()) { box.appendChild(World3D.element()); World3D.setBiome(animal); World3D.setAutoRotate(false); }
    World3D.startArena(animal, {
      onTick(o) { const q = s => document.getElementById(s); if (!q('tt')) return; q('tt').textContent = Math.ceil(o.left); q('tb').style.width = (o.left / dur * 100) + '%'; q('tm').classList.toggle('low', o.left < 10); q('cf').textContent = o.food; q('cs').textContent = o.special; q('cd').textContent = o.damage; q('st').hidden = !o.status; q('st').textContent = o.status; q('st').classList.toggle('hurt', !!o.hurt); q('vign').classList.toggle('on', !!o.hurt); },
      onPick(sp) { if (sp) toast(A.prep.special + ' 발견! ★', 'good'); },
      async onEnd(res) { cur.arena = false; await NET.put(`${roomPath(cur.code)}/${mid ? 'prep2' : 'prep'}/${myUid()}`, { g: gid, food: res.food, special: res.special, damage: res.damage, t: NET.now() }); renderJoin(); },
    }, mid ? { dur: 30, hard: true } : null);
  }

  return { claims, start, stop: stopAll };
})();
