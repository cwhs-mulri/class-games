'use strict';
(function(){
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const f1 = n => (Math.round(n*10)/10).toFixed(1);
const SCOL = { low:'#7FD3FF', mid:'#FFB547', high:'#FF4D4D' };
const IP = {
  therm:'<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', exit:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>',
  radio:'<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8 17 3M8 14h.01M15 14a2 2 0 1 0 0-.01"/>',
  book:'<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3"/>',
  play:'<path d="M7 4v16l13-8z"/>', check:'<path d="M5 12.5 10 17l9-10"/>',
};
const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IP[n]}</svg>`;
function tCol(T){ const st=[[1.5,[255,209,102]],[2.5,[255,138,61]],[4,[255,59,48]],[5.6,[193,18,31]]]; if(T<=st[0][0]) return 'rgb(255,209,102)'; for(let i=1;i<st.length;i++){ if(T<=st[i][0]){ const [a,ca]=st[i-1],[b,cb]=st[i],k=(T-a)/(b-a); return `rgb(${ca.map((c,j)=>Math.round(c+(cb[j]-c)*k)).join(',')})`; } } return 'rgb(193,18,31)'; }
function toast(m, k){ const t=document.createElement('div'); t.className='toast '+(k||''); t.textContent=m; $('#toasts').appendChild(t); setTimeout(()=>t.remove(),2400); }

// ---------- 상태 ----------
const SKEY='century-survival-v1';
let state = { view:'home', sel:{animal:'bear', scen:'mid'}, tcode:null };
let run = null;
let prepUI = { phase:'brief', res:null };
function save(){ try{ localStorage.setItem(SKEY, JSON.stringify({view:state.view==='prep'?'home':state.view, run: run && run.phase!=='prep' ? run : null, sel:state.sel, tcode:state.tcode})); }catch(e){} }
function load(){ try{ return JSON.parse(localStorage.getItem(SKEY)||'null'); }catch(e){ return null; } }

// ---------- 3D 장착 ----------
function mount3D(box, animal, st, rotate){
  if (!box) return;
  if (!World3D.available()){ box.innerHTML = '<div style="height:100%;display:grid;place-items:center;padding:20px;text-align:center" class="muted">이 기기에서는 3D 화면을 열 수 없어요.</div>'; return false; }
  box.appendChild(World3D.element());
  World3D.setBiome(animal);
  if (st) World3D.setState(st);
  World3D.setAutoRotate(rotate !== false);
  return true;
}

// ---------- 온실 효과 그림 ----------
function wavy(x, y1, y2, amp){ let d=`M${x} ${y1}`; const n=Math.abs(y2-y1)/8, dir=y2>y1?1:-1; for(let i=1;i<=n;i++){ d+=` Q${x+(i%2?amp:-amp)} ${y1+dir*(i-.5)*8} ${x} ${y1+dir*i*8}`; } return d; }
function ghSVG(ppm, T, big){
  const k = Math.max(1, Math.min(4, Math.round((ppm-300)/150)+1));
  const dots = Math.round(10 + (ppm-280)/18);
  const r = rng(hashStr('gh'+Math.round(ppm/10)));
  let s = `<svg viewBox="0 0 360 230" role="img" aria-label="온실 효과 그림: CO₂ ${ppm}ppm, 기온 +${f1(T)}°C">
  <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10z" fill="#FFD166"/></marker>
  <marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10z" fill="#FF6B4A"/></marker></defs>
  <rect x="0" y="0" width="360" height="230" fill="#0B1424"/>
  <circle cx="30" cy="26" r="16" fill="#FFD166"/>
  <rect x="0" y="70" width="360" height="56" fill="rgba(127,211,255,.10)"/>
  <text x="8" y="84" font-size="10" fill="#97A7BF">대기 · 온실 기체</text>`;
  for(let i=0;i<dots;i++) s+=`<circle cx="${(8+r()*344).toFixed(1)}" cy="${(76+r()*46).toFixed(1)}" r="2.2" fill="#9AE6B4" opacity=".75"/>`;
  s += `<rect x="0" y="190" width="360" height="40" fill="#2E5E4E"/><rect x="0" y="190" width="360" height="5" fill="#3E7A63"/>`;
  // 태양 복사
  [[60,195],[110,195],[160,195]].forEach(([x2,y2],i)=>{ s+=`<line x1="${42+i*6}" y1="${36+i*4}" x2="${x2}" y2="${y2-4}" stroke="#FFD166" stroke-width="2.4" marker-end="url(#ah)"/>`; });
  s += `<line x1="185" y1="190" x2="215" y2="20" stroke="#FFD166" stroke-width="1.8" stroke-dasharray="4 4" marker-end="url(#ah)"/>`;
  s += `<text x="70" y="62" font-size="10.5" fill="#FFD166">태양 복사(짧은 파장)</text>`;
  // 지구 복사
  const total = 5, esc = total - k;
  for (let i=0;i<total;i++){ const x = 235 + i*22; const escp = i < esc;
    s += `<path d="${wavy(x,188,escp?30:94,5)}" stroke="#FF6B4A" stroke-width="2.2" fill="none" marker-end="url(#ar)" opacity="${escp?1:.95}"/>`;
    if(!escp) s += `<path d="${wavy(x-9,100,184,4)}" stroke="#FF6B4A" stroke-width="1.8" fill="none" marker-end="url(#ar)" opacity=".75"/>`;
  }
  s += `<text x="350" y="15" text-anchor="end" font-size="10.5" fill="#FF8A6A">지구 복사(적외선) 5칸 중 ${esc}칸 탈출</text>`;
  s += `<text x="220" y="160" text-anchor="end" font-size="10.5" fill="#FF8A6A">${k}칸은 흡수 후 지표로 재방출 →</text>`;
  s += `<text x="12" y="214" font-size="${big?14:12}" font-weight="700" fill="#fff">지표 기온 +${f1(T)}°C</text><text x="12" y="226" font-size="9.5" fill="#CFE3D8">산업화 이전 대비</text>`;
  s += `<text x="12" y="150" font-size="10.5" fill="#9AE6B4">CO₂ ${ppm}ppm</text>`;
  return s + '</svg>';
}

// ---------- 홈 ----------
function renderHome(){
  const saved = load(), resume = saved && saved.run && saved.run.phase !== 'end' ? saved.run : null;
  const sel = state.sel, A = ANIMALS[sel.animal];
  app.innerHTML = `<div class="wrap">
    <div class="brand"><div class="lg"><a class="backlink" href="/" aria-label="수업 게임 모음으로">←</a><span class="therm">${icon('therm')}</span>통합과학2 · 환경과 에너지 · 온실 효과와 지구 온난화</div><button class="btn" id="toTeacher">교사 화면</button></div>
    <section class="hero">
      <div class="stageBox" id="heroStage"><div class="hero-title"><h1>100년<br>생존기</h1><p>${A.name}이 되어 ${A.place}에서 2030년부터 2120년까지, 10세대를 버텨라.</p></div><span class="yearchip">${A.place} · 2030년대</span></div>
      <div class="card setup">
        ${resume ? `<div class="resume"><span><b>${esc(resume.team)}</b> · ${ANIMALS[resume.animal].name} · ${resume.gen+1}세대 기록 중</span><button class="btn ice" id="resume">이어서 쓰기</button></div>`:''}
        <div><div class="step-h"><span class="n">1</span>어떤 동물로 살아남을까?</div></div>
        <div class="animals">${ANIMAL_ORDER.map(k=>{ const a=ANIMALS[k]; return `<button class="animal" data-animal="${k}" aria-pressed="${sel.animal===k}"><b>${a.name}</b><span class="pl">${a.place}</span><span class="th">${a.threat}</span></button>`; }).join('')}</div>
        <div><div class="step-h"><span class="n">2</span>인류는 온실 기체를 얼마나 배출할까?</div></div>
        <div class="scens">${SCEN_ORDER.map(k=>{ const s=SCENARIOS[k]; return `<button class="scen" style="--sc:${SCOL[k]}" data-scen="${k}" aria-pressed="${sel.scen===k}"><b>${s.name}</b><span class="t">+${f1(s.T[7])}°C</span><small>2100년 · ${s.code}<br>${s.desc}</small></button>`; }).join('')}</div>
        <form id="startForm" style="display:flex;flex-direction:column;gap:10px">
          <div class="step-h"><span class="n">3</span>모둠 정보</div>
          <div class="two"><div><label for="gcode">게임 코드</label><input type="text" id="gcode" inputmode="numeric" maxlength="8" value="1103"></div>
          <div><label for="gteam">모둠 이름</label><input type="text" id="gteam" maxlength="12" placeholder="예: 2모둠"></div></div>
          <div class="err" id="gerr"></div>
          <button class="btn hot lg" type="submit">${icon('play')} 60초 준비 시작</button>
        </form>
      </div>
    </section>
    <section class="card howto">
      <div><span class="k">60″</span><div><b>준비</b><p>3D 서식지에서 60초 동안 먹이와 특별 자원을 모은다. 서식지는 그 사이에도 변한다.</p></div></div>
      <div><span class="k">10×</span><div><b>생존 일지</b><p>10년마다 한 세대. 사건을 읽고 모둠이 토론해 선택한다. 과학 무전 퀴즈를 맞히면 보급품.</p></div></div>
      <div><span class="k">3↔</span><div><b>엔딩과 비교</b><p>같은 선택을 저배출·중간·고배출 세계에서 했다면? 원인 사슬로 정리한다.</p></div></div>
    </section></div>`;
  mount3D($('#heroStage'), sel.animal, { hab: 100 - (SCENARIOS[sel.scen].T[0]-1.2)*30, pop: 70, health: 90, T: SCENARIOS[sel.scen].T[0] }, true);
  app.querySelectorAll('[data-animal]').forEach(b=>b.onclick=()=>{ state.sel.animal=b.dataset.animal; save(); renderHome(); });
  app.querySelectorAll('[data-scen]').forEach(b=>b.onclick=()=>{ state.sel.scen=b.dataset.scen; save(); renderHome(); });
  $('#toTeacher').onclick = () => { state.view='teacher'; state.tcode = state.tcode || ($('#gcode').value.trim()||'1103'); save(); render(); window.scrollTo(0,0); };
  if (resume) $('#resume').onclick = () => { run = resume; state.view = 'play'; save(); render(); window.scrollTo(0,0); };
  $('#startForm').onsubmit = e => { e.preventDefault();
    const code=$('#gcode').value.trim(), team=$('#gteam').value.trim();
    if(!code) return $('#gerr').textContent='게임 코드를 입력하세요.';
    if(!team){ $('#gerr').textContent='모둠 이름을 입력하세요. 결과 코드가 모둠 이름으로 만들어져요.'; return $('#gteam').focus(); }
    run = newRun(code, team, sel.animal, sel.scen); prepUI = {phase:'brief', res:null}; state.view='prep'; render(); window.scrollTo(0,0); };
}

// ---------- 60초 준비 ----------
function renderPrep(){
  const A = ANIMALS[run.animal];
  app.innerHTML = `<div class="prep"><div class="stageBox" id="prepStage"></div><div class="vign" id="vign"></div><div id="prepUI"></div></div>`;
  const ok = mount3D($('#prepStage'), run.animal, { hab:100, pop:0, health:100, T:1.5 }, false);
  const ui = $('#prepUI');
  if (prepUI.phase === 'brief'){
    ui.innerHTML = `<div class="ov"><div class="brief">
      <div class="eyebrow">${A.name} · ${A.place} · 2020년대</div>
      <h2><em>60초</em> 안에 겨울을 준비하라</h2>
      <p>${A.prep.goal}</p>
      <div class="legend"><div><span class="dot f"></span>${A.prep.food}<br>에너지</div><div><span class="dot s"></span>${A.prep.special}<br>특별 보너스</div><div><span class="dot h"></span>${A.prep.hazard}<br>피하기</div></div>
      <p class="keys">조작: 방향키·WASD, 또는 가고 싶은 곳을 누르고 있기</p>
      ${ok===false?'<p class="muted">3D 화면을 열 수 없어 준비 단계는 기본값으로 진행돼요.</p>':''}
      <button class="btn hot lg" id="go">${icon('play')} 시작</button></div></div>`;
    $('#go').onclick = startArena;
  } else if (prepUI.phase === 'sum'){
    const r = prepUI.res, tmp = newRun(run.code, run.team, run.animal, run.scen); applyPrep(tmp, r);
    ui.innerHTML = `<div class="ov"><div class="brief">
      <div class="eyebrow">준비 결과</div><h2>준비 끝. 이제 <em>100년</em>이다</h2>
      <div class="sum">
        <div><div class="k">${A.prep.food}</div><div class="v">${r.food}</div><div class="d">${A.energyName} ${tmp.energy}</div></div>
        <div><div class="k">${A.prep.special}</div><div class="v">${r.special}</div><div class="d">${A.popName} ${tmp.pop}</div></div>
        <div><div class="k">입은 피해</div><div class="v">${r.damage}</div><div class="d">${A.healthName} ${tmp.health}</div></div>
      </div>
      ${r.special>0?`<p style="font-size:14px">★ ${A.prep.special}을(를) 찾았다. 일부 사건에서 운이 좋아진다.</p>`:''}
      <button class="btn hot lg" id="begin">생존 일지 펼치기 ${icon('arrow')}</button></div></div>`;
    $('#begin').onclick = () => { applyPrep(run, prepUI.res); state.view='play'; save(); render(); window.scrollTo(0,0); };
  }
}
function startArena(){
  const ui = $('#prepUI'), A = ANIMALS[run.animal];
  ui.innerHTML = `<div class="hud"><div class="timer" id="tm"><span class="t" id="tt">60</span><span class="tbar"><i id="tb" style="width:100%"></i></span></div>
    <div class="cnt"><span class="dot f"></span><div><div class="v" id="cf">0</div><small>${A.prep.food}</small></div></div>
    <div class="cnt"><span class="dot s"></span><div><div class="v" id="cs">0</div><small>${A.prep.special}</small></div></div>
    <div class="cnt"><span class="dot h"></span><div><div class="v" id="cd">0</div><small>피해</small></div></div></div>
    <div class="status" id="st" hidden></div>`;
  const tt=$('#tt'), tb=$('#tb'), tm=$('#tm'), cf=$('#cf'), cs=$('#cs'), cd=$('#cd'), st=$('#st'), vg=$('#vign');
  World3D.startArena(run.animal, {
    onTick(o){ tt.textContent = Math.ceil(o.left); tb.style.width = (o.left/60*100)+'%'; tm.classList.toggle('low', o.left<10);
      cf.textContent=o.food; cs.textContent=o.special; cd.textContent=o.damage;
      st.hidden = !o.status; st.textContent = o.status; st.classList.toggle('hurt', !!o.hurt); vg.classList.toggle('on', !!o.hurt); },
    onPick(sp){ if (sp) toast(ANIMALS[run.animal].prep.special+' 발견! ★','good'); },
    onEnd(res){ prepUI = { phase:'sum', res }; if (res.skipped) toast('기본값으로 준비했어요'); renderPrep(); },
  });
}

// ---------- 생존 일지 ----------
function climateHTML(){
  const S = SCENARIOS[run.scen], g = Math.min(run.gen, GENS-1), T = S.T[g];
  return `<div class="climate"><div class="temp"><span class="v" style="color:${tCol(T)}">+${f1(T)}°C</span><small>지구 평균<br>기온 상승</small></div>
    <div><div class="num" style="font-size:15px;font-weight:600">${S.ppm[g]} ppm</div><small class="muted">CO₂ · <span style="color:${SCOL[run.scen]}">${S.name}</span></small></div>
    <div class="gens" aria-label="세대 진행">${DECADES.map((d,i)=>{ let c=''; if (run.extinctAt!=null && i===run.extinctAt) c='dead'; else if (i<run.gen || (i===run.gen && run.sub!=='event')) c='done'; if (i===run.gen && run.phase==='play') c+=' cur'; return `<span class="${c}" title="${d}년대">${i+1}</span>`; }).join('')}</div></div>`;
}
function statHTML(k, v, col, d){
  return `<div class="stat"><div class="top"><span class="k">${k}</span><span><span class="v">${Math.round(v)}</span>${d?`<span class="d ${d>0?'up':'down'}">${d>0?'+':''}${d}</span>`:''}</span></div><div class="meter"><i style="width:${v}%;background:${col}"></i></div></div>`;
}
function statsHTML(){
  const A = ANIMALS[run.animal], hab = currentHab(run), L = run.sub!=='event' && run.last && run.last.gen===run.gen ? run.last : null;
  const d = k => L ? Math.round(run[k] - L.before[k]) : 0;
  return `<div class="stats">${statHTML(A.popName, run.pop, '#7FD3FF', d('pop'))}${statHTML(A.energyName, run.energy, '#FFC23D', d('energy'))}${statHTML(A.healthName, run.health, '#4ADE80', d('health'))}${statHTML(A.habName, hab, hab<30?'#FB7185':'#A78BFA', 0)}</div>`;
}
const KEYLBL = A => ({ pop:A.popName, energy:A.energyName, health:A.healthName, hab:A.habName, food:'먹이터' });
function hintChips(c){
  const A = ANIMALS[run.animal], L = KEYLBL(A);
  if (c.r){
    let p = c.r.p, bonus = false; if (c.r.flagP) for (const f in c.r.flagP) if (run.flags[f]){ p = c.r.flagP[f]; bonus = true; }
    return `<span class="chip luck">운에 맡김 · ${p>=.6?'가능성 높음':p>=.45?'반반':'가능성 낮음'}</span>${bonus?'<span class="chip bonus">★ 준비 보너스</span>':''}`;
  }
  const e = c.e || {}; const ks = Object.keys(e).filter(k=>e[k]);
  if (!ks.length) return '<span class="chip">변화 없음</span>';
  return ks.map(k=>`<span class="chip ${e[k]>0?'up':'down'}">${L[k]} ${e[k]>0?'↑':'↓'}${Math.abs(e[k])>=15?(e[k]>0?'↑':'↓'):''}</span>`).join('');
}
function journalHTML(){
  const A = ANIMALS[run.animal], g = run.gen, ev = findEvent(run.animal, run.order[g]);
  const head = `<div class="jhead"><span>${A.name}의 생존 일지</span><span class="yr">${g+1}세대 · ${DECADES[g]}년대</span></div>`;
  let body = '';
  if (run.sub === 'event'){
    body = `<div class="jt">${ev.title}</div><p class="jx">${ev.text}</p>
      <div class="choices">${ev.c.map((c,i)=>`<button class="choice" data-c="${i}"><b>${c.l}</b><span class="hints">${hintChips(c)}</span></button>`).join('')}</div>
      <p class="nat">모둠이 함께 토론해서 하나를 고르세요. 선택 뒤에는 ${A.habName}에 따라 자연스러운 변화가 이어져요.</p>`;
  } else if (run.sub === 'outcome'){
    const L = run.last, KL = KEYLBL(A), e = L.eff || {};
    const eff = Object.keys(e).filter(k=>e[k]).map(k=>`<span class="chip ${e[k]>0?'up':'down'}">${KL[k]} ${e[k]>0?'+':''}${e[k]}</span>`).join('');
    const nat = L.natural;
    const dead = run.extinctAt != null;
    body = `<div class="jt">${ev.title}</div>
      <div class="outcome"><p class="jx">→ ${L.text}${L.roll?` <span style="font-size:20px;color:var(--pink2)">(${L.roll.good?'운이 따랐다':'운이 없었다'})</span>`:''}</p>
      <div class="deltas">${eff||'<span class="chip">선택 효과 없음</span>'}</div>
      <p class="nat">이번 10년의 자연 변화 · ${A.habName} ${Math.round(L.hab)} → ${A.energyName} ${nat.food>0?'+':''}${nat.food}${nat.dh?`, ${A.healthName} ${nat.dh>0?'+':''}${nat.dh}`:''}, ${A.popName} ${nat.dp>0?'+':''}${nat.dp}</p>
      <div class="sci"><b>과학 노트</b> · ${ev.sci}</div>
      ${dead ? `<p class="jx" style="color:#B91C1C">… 더 이상 이어 쓸 ${A.name}가 남아 있지 않다.</p><button class="jbtn" id="next">기록 마치기 ${icon('arrow')}</button>`
             : `<button class="jbtn" id="next">${hasQuiz(run)?'무전이 들어온다…':g>=GENS-1?'마지막 기록 보기':(g+2)+'세대로 · '+DECADES[g+1]+'년대'} ${icon('arrow')}</button>`}</div>`;
  } else if (run.sub === 'quiz' || run.sub === 'quizdone'){
    const Q = quizFor(run), ans = run.quizAns[g], r = rng(hashStr('qo'+run.code+g)), order = [0,1,2,3].sort(()=>r()-.5);
    body = `<div class="jt">과학 무전</div><p class="jx">지직… 기후 연구팀 드론이 신호를 보낸다. 맞히면 보급품을 떨어뜨려 준다고 한다.</p>
      <div class="radio"><header><span class="led"></span><span class="eyebrow" style="color:#9AE6B4">수신 중 · 정답 시 ${A.energyName} +12 · ${A.healthName} +5</span></header>
        <h3>${Q.q}</h3>
        <div class="qopts">${order.map((i,k)=>{ let c=''; if(ans){ if(i===Q.c) c='right'; else if(i===ans.ai) c='wrong'; } return `<button class="qopt ${c}" data-q="${i}" ${ans?'disabled':''}><span class="l">${'ABCD'[k]}</span>${Q.a[i]}</button>`; }).join('')}</div>
        ${ans?`<p style="font-size:14px"><b style="color:${ans.ok?'var(--good)':'var(--bad)'}">${ans.ok?'정답! 보급품을 받았다.':'오답. 드론이 그냥 지나갔다.'}</b> ${Q.e}</p>`:''}
      </div>
      ${ans?`<button class="jbtn" id="next">${g>=GENS-1?'마지막 기록 보기':(g+2)+'세대로 · '+DECADES[g+1]+'년대'} ${icon('arrow')}</button>`:''}`;
  }
  const past = run.log.filter(l=>l.gen < g);
  const oldlog = past.length ? `<details class="oldlog"><summary>지난 기록 ${past.length}개</summary><ul style="padding-left:18px;margin:6px 0 0">${past.map(l=>`<li>${l.gen+1}세대 · ${findEvent(run.animal,l.id).title} — ${l.text}</li>`).join('')}</ul></details>` : '';
  return `<article class="journal" id="journal">${head}${body}${oldlog}</article>`;
}
function renderPlay(){
  const A = ANIMALS[run.animal], S = SCENARIOS[run.scen], g = Math.min(run.gen, GENS-1);
  app.innerHTML = `<div class="play">
    <div class="left">
      ${climateHTML()}
      <div class="stageBox" id="playStage"><div class="stagelbl"><b>${A.name}</b>${A.place} · ${DECADES[g]}년대</div></div>
      ${statsHTML()}
      <div class="gh"><header><b style="font-size:14px">온실 효과 계기판</b><span class="muted" style="font-size:12px">CO₂가 늘면 빠져나가지 못하는 적외선이 늘어요</span></header>${ghSVG(S.ppm[g], S.T[g])}</div>
      <div style="display:flex;gap:8px"><button class="btn" id="quit">${icon('exit')} 저장하고 나가기</button></div>
    </div>
    ${journalHTML()}
  </div>`;
  mount3D($('#playStage'), run.animal, { hab: currentHab(run), pop: run.pop, health: run.health, T: S.T[g] }, true);
  bindPlay();
}
function bindPlay(){
  app.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { choose(run, +b.dataset.c); save(); renderPlay(); scrollJournal(); });
  app.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const ok = answerQuiz(run, +b.dataset.q); toast(ok?'정답! 보급품 도착':'오답이에요', ok?'good':'bad'); save(); renderPlay(); });
  const nx = $('#next'); if (nx) nx.onclick = () => {
    if (run.sub === 'quizdone'){ run.sub = 'outcome'; run.gen < GENS-1 ? (run.gen++, run.sub='event') : (run.phase='end'); }
    else advance(run);
    if (run.phase === 'end'){ state.view='end'; save(); render(); window.scrollTo(0,0); return; }
    save(); renderPlay(); scrollJournal();
  };
  $('#quit').onclick = () => { state.view='home'; save(); render(); window.scrollTo(0,0); toast('기록을 저장했어요'); };
}
function scrollJournal(){ if (window.innerWidth <= 980){ const j = $('#journal'); if (j) j.scrollIntoView({behavior:RM?'auto':'smooth', block:'start'}); } }

// ---------- 엔딩 ----------
function popChart(hist, col, h){
  const W=300, H=h||110, pad=6, n=GENS;
  const x = i => pad + i*(W-2*pad)/(n-1), y = v => H-pad-(v/100)*(H-2*pad);
  let d=''; hist.forEach((v,i)=>{ d += (i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1); });
  let grid=''; for(let v=0; v<=100; v+=50) grid+=`<line x1="${pad}" x2="${W-pad}" y1="${y(v)}" y2="${y(v)}" stroke="#24344F"/>`;
  const lastI = hist.length-1;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="세대별 개체 수">${grid}<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5"/>${hist.length?`<circle cx="${x(lastI)}" cy="${y(hist[lastI])}" r="4" fill="${hist[lastI]>0?col:'#FB7185'}"/>`:''}</svg>`;
}
function renderEnd(){
  const A = ANIMALS[run.animal], S = SCENARIOS[run.scen], gs = gensSurvived(run), alive = run.extinctAt == null;
  const reps = {}; SCEN_ORDER.forEach(k => reps[k] = replay(run, k));
  const lastG = alive ? GENS-1 : run.extinctAt;
  const code = resultCode(run);
  app.innerHTML = `<div class="end">
    <div class="brand"><div class="lg"><span class="therm">${icon('therm')}</span>100년 생존기 · ${esc(run.team)}</div><button class="btn" id="home">${icon('exit')} 처음 화면</button></div>
    <section class="endhero">
      <div class="endpaper">
        <span class="stamp ${alive?'alive':'dead'}">${alive?'생존':'멸종'}</span>
        <p class="jx">${alive ? `${A.name}는 ${A.place}에서 10세대를 버텨 ${DECADES[GENS-1]}년대를 맞았다. 남은 ${A.popName}는 ${run.pop}.` : `${A.name}의 기록은 ${run.extinctAt+1}세대, ${DECADES[run.extinctAt]}년대에 멈췄다. 지구 기온은 +${f1(S.T[run.extinctAt])}°C였다.`}</p>
        <p style="font-size:14px;color:var(--pink2)">${S.name} 경로(${S.code}) · ${A.habName}는 ${Math.round(currentHab(run))}까지 줄었다.</p>
        <div class="codebox" style="border-color:rgba(60,45,20,.3)"><div><div class="eyebrow" style="color:var(--pink2)">결과 코드</div><div class="big" style="color:var(--pink)">${code}</div></div><p style="font-size:13px;color:var(--pink2)">선생님께 결과 코드를 알려 주세요.</p></div>
      </div>
      <div class="stageBox" id="endStage"></div>
    </section>
    <section class="card"><div class="eyebrow" style="margin-bottom:10px">무엇이 ${A.name}를 몰아붙였나 · 원인 사슬</div>
      <div class="chain">${A.chain.map((c,i)=>`${i?'<i>→</i>':''}<span>${c}</span>`).join('')}</div></section>
    <section class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px"><h2 style="font-size:24px">같은 선택, 다른 세계</h2><span class="muted" style="font-size:14px">여러분의 선택과 운을 그대로 두고 온실 기체 배출 경로만 바꿨어요</span></div>
      <div class="cmp">${SCEN_ORDER.map(k=>{ const s=SCENARIOS[k], r=reps[k], ok=r.survived>=GENS && r.pop>0; return `<div class="cmpc ${k===run.scen?'me':''}" style="--sc:${SCOL[k]}">
        <div style="display:flex;justify-content:space-between"><b>${s.name}</b><span class="t">2100년 +${f1(s.T[7])}°C</span></div>
        <div class="res" style="color:${ok?'var(--good)':'var(--bad)'}">${ok?`생존 · ${A.popName} ${r.pop}`:`${r.survived+1}세대에 멸종`}</div>
        ${popChart(r.popHist, SCOL[k])}
        <small class="muted">${k===run.scen?'우리 모둠이 겪은 세계':s.desc}</small></div>`; }).join('')}</div>
      <p style="margin-top:12px;font-size:14.5px">${reps.low.pop > reps.high.pop ? `같은 선택을 해도 저배출 세계에서는 ${A.popName} ${reps.low.pop}, 고배출 세계에서는 ${reps.high.survived>=GENS&&reps.high.pop>0?reps.high.pop:'멸종'}. 동물 혼자서는 온난화의 속도를 바꿀 수 없어요. 그 속도를 정하는 것은 인류의 배출량입니다.`:''}</p></section>
    <section class="card"><div class="eyebrow" style="margin-bottom:10px">모둠 성찰</div>
      <ol class="refl"><li>온실 효과는 원래 지구에 꼭 필요하다. 그런데 왜 문제가 되었는지 "적외선"과 "온실 기체"를 넣어 설명해 보자.</li>
      <li>${A.name}가 가장 큰 위기를 맞은 세대는 언제였고, 그때 지구 기온은 몇 °C 올라 있었나?</li>
      <li>배출 경로에 따라 결과가 어떻게 달랐나? ${A.name}를 지키려면 인류는 무엇을 해야 할까(완화)? 이미 일어난 변화에는 어떻게 적응할 수 있을까?</li></ol></section>
  </div>`;
  mount3D($('#endStage'), run.animal, { hab: currentHab(run), pop: run.pop, health: run.health, T: S.T[lastG] }, true);
  $('#home').onclick = () => { run = null; state.view='home'; save(); render(); window.scrollTo(0,0); };
}

// ---------- 교사 화면 ----------
function bLoad(c){ try{ return JSON.parse(localStorage.getItem('century-survival-board:'+c)||'null'); }catch(e){ return null; } }
function bSave(c,d){ try{ localStorage.setItem('century-survival-board:'+c, JSON.stringify(d)); }catch(e){} }
function tempChart(){
  const W=520,H=210,pl=34,pr=70,pt=12,pb=26, ymax=6;
  const x=i=>pl+i*(W-pl-pr)/(GENS-1), y=v=>pt+(1-v/ymax)*(H-pt-pb);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="배출 시나리오별 기온 상승">`;
  for(let v=0;v<=ymax;v++) s+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="#24344F"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#97A7BF">${v}°</text>`;
  s+=`<line x1="${pl}" x2="${W-pr}" y1="${y(1.5)}" y2="${y(1.5)}" stroke="#97A7BF" stroke-dasharray="4 4"/><text x="${W-pr+4}" y="${y(1.5)+4}" font-size="10.5" fill="#97A7BF">1.5°C</text>`;
  [0,2,4,7,9].forEach(i=>s+=`<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="11" fill="#97A7BF">${DECADES[i]}</text>`);
  SCEN_ORDER.forEach(k=>{ const S=SCENARIOS[k]; s+=`<path d="${S.T.map((t,i)=>(i?'L':'M')+x(i)+' '+y(t)).join('')}" fill="none" stroke="${SCOL[k]}" stroke-width="3"/><text x="${x(GENS-1)+6}" y="${y(S.T[GENS-1])+4}" font-size="11.5" font-weight="700" fill="${SCOL[k]}">${S.name}</text>`; });
  return s+'</svg>';
}
function renderTeacher(){
  const code = state.tcode || '1103';
  const st = bLoad(code) || { rows: Array.from({length:6},(_,i)=>({team:(i+1)+'모둠', code:''})) };
  const rows = st.rows.map(r=>({...r, p: r.code ? parseCode(r.code, r.team) : null}));
  const cell = (a,s) => rows.filter(r=>r.p && r.p.ok && r.p.animal===a && r.p.scen===s).map(r=>`<span class="r ${r.p.gens>=GENS&&r.p.pop>0?'alive':'dead'}">${esc(r.team)} · ${r.p.gens>=GENS&&r.p.pop>0?'생존 '+r.p.pop:r.p.gens+'세대'}</span>`).join('') || '<span class="muted">–</span>';
  app.innerHTML = `<div class="wrap">
    <div class="brand"><div><div class="eyebrow">교사 화면 · 게임 코드</div><div class="num" style="font-size:44px;font-weight:600;line-height:1.1">${esc(code)}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><input type="text" id="tc" value="${esc(code)}" style="width:110px" aria-label="게임 코드 바꾸기"><button class="btn" id="tcGo">코드 변경</button><button class="btn" id="home">${icon('exit')} 나가기</button></div></div>
    <div class="t-grid">
      <section class="card" style="display:flex;flex-direction:column;gap:12px">
        <h2 style="font-size:24px">모둠 결과판</h2>
        <p class="muted" style="font-size:13.5px">모둠 이름과 엔딩 화면의 결과 코드를 입력하세요. 코드는 모둠 이름으로 검증돼요. 이 기기에만 저장됩니다.</p>
        <div class="scroll"><table class="btable"><thead><tr><th>모둠</th><th>결과 코드</th><th>해석</th></tr></thead><tbody>${rows.map((r,i)=>`<tr>
          <td><input type="text" id="bt${i}" data-i="${i}" data-f="team" value="${esc(r.team)}" aria-label="모둠 이름" style="width:96px"></td>
          <td><input type="text" id="bc${i}" data-i="${i}" data-f="code" value="${esc(r.code)}" placeholder="B2-10-34-57" aria-label="결과 코드" style="width:140px"></td>
          <td>${r.p ? (r.p.ok ? `<span class="chip ${r.p.gens>=GENS&&r.p.pop>0?'up':'down'}">${ANIMALS[r.p.animal].name} · ${SCENARIOS[r.p.scen].name} · ${r.p.gens>=GENS&&r.p.pop>0?'생존 '+r.p.pop:r.p.gens+'세대 멸종'}</span>` : '<span class="chip down">코드 불일치</span>') : (r.code?'<span class="chip down">형식 오류</span>':'')}</td></tr>`).join('')}</tbody></table></div>
        <div style="display:flex;gap:8px"><button class="btn" id="add">모둠 추가</button></div>
        <div class="eyebrow" style="margin-top:6px">동물 × 배출 경로</div>
        <div class="scroll"><table class="matrix"><thead><tr><th></th>${SCEN_ORDER.map(s=>`<th style="color:${SCOL[s]}">${SCENARIOS[s].name}</th>`).join('')}</tr></thead>
          <tbody>${ANIMAL_ORDER.map(a=>`<tr><th>${ANIMALS[a].name}</th>${SCEN_ORDER.map(s=>`<td>${cell(a,s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="muted" style="font-size:13px">모둠마다 다른 동물·배출 경로를 배정하면 이 표로 반 전체의 결과를 비교하기 좋아요.</p>
      </section>
      <section class="card" style="display:flex;flex-direction:column;gap:14px">
        <h2 style="font-size:24px">개념 정리</h2>
        ${ghSVG(510, 2.0, true)}
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px;font-size:14.5px">
          <li>태양 복사(주로 짧은 파장)는 대기를 대부분 통과해 지표를 데운다.</li>
          <li>지표는 적외선(긴 파장)으로 에너지를 내보내고, 온실 기체(CO₂, CH₄, N₂O, 수증기 등)가 이를 흡수했다가 다시 방출한다.</li>
          <li>온실 기체가 늘면 빠져나가는 에너지가 줄어 더 높은 온도에서 새로운 복사 평형을 이룬다. 이것이 지구 온난화다.</li>
        </ul>
        <div class="eyebrow">배출 경로별 기온 상승 (IPCC AR6를 단순화한 근사값)</div>
        ${tempChart()}
        <div class="eyebrow">동물별 원인 사슬</div>
        <div class="chains">${ANIMAL_ORDER.map(a=>`<div><b>${ANIMALS[a].name}</b><div class="chain" style="margin-top:6px">${ANIMALS[a].chain.map((c,i)=>`${i?'<i>→</i>':''}<span>${c}</span>`).join('')}</div></div>`).join('')}</div>
        <div class="eyebrow">수업 흐름 (45분)</div>
        <p style="font-size:14px">도입 5분(온실 효과 원리) → 60초 준비 + 생존 일지 25분 → 결과 코드 입력·동물×경로 비교 10분 → 원인 사슬·완화와 적응 정리 5분</p>
      </section>
    </div></div>`;
  const persist = () => bSave(code, { rows: rows.map(r=>({team:r.team, code:r.code})) });
  app.querySelectorAll('.btable input').forEach(inp => inp.onchange = () => { rows[+inp.dataset.i][inp.dataset.f] = inp.value.trim(); persist();
    setTimeout(() => { const id = document.activeElement && document.activeElement.id; renderTeacher(); const el = id && document.getElementById(id); if (el) el.focus(); }, 0); });
  $('#add').onclick = () => { rows.push({team:'', code:''}); persist(); renderTeacher(); };
  $('#home').onclick = () => { state.view='home'; save(); render(); };
  $('#tcGo').onclick = () => { const v = $('#tc').value.trim(); if (v){ state.tcode = v; save(); renderTeacher(); } };
}

function render(){
  if (state.view==='prep' && run) renderPrep();
  else if (state.view==='play' && run) renderPlay();
  else if (state.view==='end' && run) renderEnd();
  else if (state.view==='teacher') renderTeacher();
  else { state.view='home'; renderHome(); }
}
function start(data){
  const s = (data && data.state) ? data : load();
  if (s){ if (s.sel) state.sel = s.sel; state.tcode = s.tcode || null;
    if (s.run && (s.view==='play' || s.view==='end')){ run = s.run; state.view = s.view; }
    else if (s.view==='teacher') state.view='teacher'; }
  render();
}
start(null);
})();
