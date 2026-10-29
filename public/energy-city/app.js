'use strict';
(function(){
const $ = s => document.querySelector(s);
const app = $('#app'), layer = $('#layer');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const KIND_VAR = {fossil:'--k-fossil',nuclear:'--k-nuclear',solar:'--k-solar',wind:'--k-wind',hydro:'--k-hydro',tidal:'--k-tidal'};
const KIND_NAME = {fossil:'화력',nuclear:'원자력',solar:'태양광',wind:'풍력',hydro:'수력',tidal:'조력'};
const SITE_ORDER = ['city','suburb','coast','mountain'];
const PLANT_ORDER = ['coal','lng','nuclear','solar','wind','hydro','tidal'];

// ---------- 아이콘 ----------
const IP = {
  coal:'<path d="M2 20h20M4 20V10l5 3v-3l5 3V4h4v16"/><path d="M15 4c0-1.5 1-2 2-2"/>',
  lng:'<path d="M12 3c.8 3.5 5 5.2 5 10a5 5 0 0 1-10 0c0-2.6 1.6-3.8 2.2-5.6 1.5 1.1 2.6 2.6 2.8 4.6"/>',
  nuclear:'<circle cx="12" cy="12" r="1.7"/><ellipse cx="12" cy="12" rx="9.5" ry="3.7"/><ellipse cx="12" cy="12" rx="9.5" ry="3.7" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.7" transform="rotate(120 12 12)"/>',
  solar:'<path d="M3.5 15 5.5 6h13l2 9z"/><path d="M4.5 10.5h15M10 6l-.8 9M14 6l.8 9M12 15v5M8 20h8"/>',
  wind:'<path d="M12 11.5V21M9 21h6"/><circle cx="12" cy="10" r="1.4"/><path d="M12.4 8.7 13 2.5l-2.4.6z"/><path d="M13.3 10.6 19 13l-1.4 2z"/><path d="M10.7 10.6 5 13l1.4 2z"/>',
  hydro:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  tidal:'<path d="M2 8.5c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/><path d="M2 14c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/><path d="M2 19.5c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/>',
  coin:'<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  smile:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14.3c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01"/>',
  cloud:'<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 11.4 3.3 3.3 0 0 0 7 18z"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  exit:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  tower:'<path d="M12 2 8 22M12 2l4 20M5.5 7h13M7 12h10M9.3 17h5.4"/>',
  battery:'<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3M7 10v4M11 10v4"/>',
  check:'<path d="M5 12.5 10 17l9-10"/>',
  alert:'<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>',
  chevron:'<path d="M9 6l6 6-6 6"/>',
  min:'<path d="M6 12h12"/>', plus:'<path d="M12 6v12M6 12h12"/>',
  sunny:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloudy:'<path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 8.4 3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  windy:'<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  calm:'<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><path d="M8 12h8"/>',
  drought:'<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
};
const icon = (n, cls) => `<svg class="ic ${cls||''}" viewBox="0 0 24 24" aria-hidden="true">${IP[n]||''}</svg>`;
const kicon = (t) => `<span class="kicon" style="--kc:var(${KIND_VAR[PLANTS[t].kind]})">${icon(t)}</span>`;

// ---------- 상태 ----------
let state = { view:'home', homeTab:'team' };
let G = null, SC = null;
const ui = { tool:null, drawer:null, eventMin:false, animate:false };
const SKEY = 'energy-city-v1';
function save(){ try{ localStorage.setItem(SKEY, JSON.stringify({view:state.view, G, tcode:state.tcode})); }catch(e){} }
function loadSaved(){ try{ return JSON.parse(localStorage.getItem(SKEY)||'null'); }catch(e){ return null; } }
function lbLoad(code){ try{ return JSON.parse(localStorage.getItem('energy-city-lb:'+code)||'null'); }catch(e){ return null; } }
function lbSave(code, d){ try{ localStorage.setItem('energy-city-lb:'+code, JSON.stringify(d)); }catch(e){} }

function toast(msg, kind){
  const t = document.createElement('div'); t.className = 'toast ' + (kind||''); t.innerHTML = `<span class="dot"></span>${esc(msg)}`;
  $('#toasts').appendChild(t); setTimeout(()=>t.remove(), 2400);
}

// ---------- 부지 칸 ----------
function slotMap(){
  G.slotOf = G.slotOf || {};
  const res = {};
  for (const site of SITE_ORDER){
    const n = SITES[site].slots, arr = new Array(n).fill(null), rest = [];
    for (const p of G.plants.filter(p=>p.site===site)){
      const s = G.slotOf[p.id];
      if (s != null && s < n && !arr[s]) arr[s] = p; else rest.push(p);
    }
    for (const p of rest){ const s = arr.indexOf(null); arr[s] = p; G.slotOf[p.id] = s; }
    res[site] = arr;
  }
  return res;
}
function validPads(t){
  const P = PLANTS[t], out = new Set();
  if (G.phase !== 'build') return out;
  if (P.max && typeCount(G, t) >= P.max) return out;
  if (G.budget < buildCost(G, SC, t)) return out;
  const sm = slotMap();
  for (const s of P.sites) sm[s].forEach((p,i)=>{ if (!p) out.add(s+':'+i); });
  return out;
}
function toolBlock(t){
  const P = PLANTS[t];
  if (P.max && typeCount(G, t) >= P.max) return '1곳만 가능';
  if (G.budget < buildCost(G, SC, t)) return '예산 부족';
  if (!validPads(t).size) return '빈 부지 없음';
  return '';
}
const lossOf = site => SITES[site].loss * (G && G.hv ? 0.25 : 1);
const siteNames = t => PLANTS[t].sites.map(s=>SITES[s].name).join(', ');

// ---------- 3D 연결 ----------
function plantsFor3D(){
  const sm = slotMap(), out = [];
  for (const site of SITE_ORDER) sm[site].forEach((p,i)=>{ if (p) out.push({id:p.id, type:p.type, site, slot:i}); });
  return out;
}
function mountStage(slotEl, sim){
  if (!slotEl) return false;
  if (!City3D.available()){ slotEl.innerHTML = '<div class="card" style="height:100%;display:grid;place-items:center;text-align:center"><p class="muted">이 기기에서는 3D 화면을 열 수 없어요.<br>위쪽 목록 버튼으로 부지를 보며 건설하세요.</p></div>'; return false; }
  slotEl.appendChild(City3D.element());
  if (sim) City3D.sync({
    plants: plantsFor3D(), hv:G.hv, ess:G.ess, weather:SC.weathers[G.round], rows:sim.rows,
    coverage:sim.coverage, demand:sim.demand, supply:sim.supply, essCover:sim.essCover,
    buildCount: Math.max(10, Math.min(36, Math.round(sim.demand/100*34))), round:G.round, co2:sim.co2,
    canBuild: G.phase==='build',
  });
  return true;
}
City3D.on({
  onPad(site, idx){ if (G && state.view==='team' && G.phase==='build') padTap(site, idx); },
  onPlant(id){ if (G && state.view==='team' && G.phase==='build') openDrawer({kind:'plant', id}); },
  tip(info){
    if (!G || state.view!=='team') return '';
    if (G.phase!=='build') return info.kind==='plant' ? '' : '';
    if (info.kind==='pad'){
      const S = SITES[info.site];
      if (ui.tool){
        const P = PLANTS[ui.tool];
        if (!P.sites.includes(info.site)) return `${P.name}은(는) ${siteNames(ui.tool)}에만 지을 수 있어요`;
        const vs = validPads(ui.tool);
        if (!vs.has(info.site+':'+info.idx)) return toolBlock(ui.tool) || '여기에는 지을 수 없어요';
        return `${S.name}에 ${P.name} 건설 · 도착 ${f1(P.out*(1-lossOf(info.site)))} (손실 ${f1(lossOf(info.site)*100)}%) · ${buildCost(G,SC,ui.tool)}코인`;
      }
      return `${S.name} 빈 부지 · 손실 ${f1(lossOf(info.site)*100)}% — 눌러서 건설`;
    }
    const p = G.plants.find(x=>x.id===info.pid);
    return p ? `${PLANTS[p.type].name} · ${SITES[p.site].name} — 눌러서 정보 보기` : '';
  },
});

// ---------- 건설 동작 ----------
function doBuild(t, site, idx){
  const err = build(G, SC, t, site);
  if (err){ toast(err, 'bad'); return false; }
  const np = G.plants[G.plants.length-1];
  G.slotOf = G.slotOf || {}; G.slotOf[np.id] = idx;
  G.undo = G.undo || []; G.undo.push({k:'build', id:np.id});
  toast(`${PLANTS[t].name} 건설 · −${np.paid} 코인`, 'good');
  return true;
}
function padTap(site, idx){
  if (ui.tool){
    const t = ui.tool, P = PLANTS[t];
    if (!P.sites.includes(site)) return toast(`${P.name}은(는) ${siteNames(t)}에만 지을 수 있어요`, 'bad');
    if (!validPads(t).has(site+':'+idx)) return toast(toolBlock(t) || '여기에는 지을 수 없어요', 'bad');
    if (doBuild(t, site, idx)){ if (!validPads(t).size) ui.tool = null; save(); render(); }
    return;
  }
  openDrawer({kind:'picker', site, idx});
}
function setTool(t){
  ui.tool = (ui.tool === t) ? null : t;
  if (ui.tool && toolBlock(ui.tool)){ toast(PLANTS[ui.tool].name + ': ' + toolBlock(ui.tool), 'bad'); ui.tool = null; }
  if (ui.drawer && ui.drawer.kind !== 'list') ui.drawer = null;
  render();
}
function undo(){
  const st = G.undo || [];
  const a = st.pop(); if (!a) return;
  if (a.k==='build'){ const p = G.plants.find(x=>x.id===a.id); removePlant(G, a.id); if (p) toast(`${PLANTS[p.type].name} 건설 취소 · +${p.paid} 코인`); }
  else { sellUpgrade(G, a.key); toast(`${UPGRADES[a.key].name} 취소 · +${UPGRADES[a.key].cost} 코인`); }
  save(); render();
}
function upgrade(key){
  const err = buyUpgrade(G, key);
  if (err) return toast(err, 'bad');
  G.undo = G.undo || []; G.undo.push({k:'upg', key});
  toast(`${UPGRADES[key].name} 설치 · −${UPGRADES[key].cost} 코인`, 'good');
  save(); render();
}
function openDrawer(d){ ui.drawer = d; render(); const el = $('.drawer'); if (el){ const f = el.querySelector('button:not(:disabled)'); if (f) f.focus({preventScroll:true}); if (d.kind && window.innerWidth<=900 && el.classList.contains('panel')) el.scrollIntoView({behavior:RM?'auto':'smooth', block:'start'}); } }
function closeDrawer(){ ui.drawer = null; render(); }

// ---------- 홈 ----------
const DEMO = (() => {
  const types = [['coal','suburb',0],['solar','city',0],['wind','mountain',1],['hydro','mountain',0],['lng','coast',0],['nuclear','coast',2],['tidal','coast',1],['solar','suburb',2],['wind','coast',0]];
  return { plants: types.filter((x,i)=>i!==8).map(([type,site,slot],i)=>({id:9000+i,type,site,slot})) };
})();
function renderHome(){
  const saved = loadSaved();
  const resume = saved && saved.G && saved.G.phase !== 'over' ? saved.G : null;
  const tab = state.homeTab;
  app.innerHTML = `<div class="home">
  <section class="hero">
    <div class="hero-copy">
      <div class="brandmark"><a class="backlink" href="/" aria-label="수업 게임 모음으로">←</a><span class="logo">${icon('bolt')}</span>통합과학2 · 환경과 에너지</div>
      <h1>에너지 도시 경영</h1>
      <p class="lead">모둠이 한 도시의 전력 회사가 되어 6년 동안 발전소를 짓고 운영합니다. 정전 없이, 예산을 지키며, 탄소는 적게.</p>
      ${resume ? `<div class="resume"><span><b>${esc(resume.team)}</b> · 코드 ${esc(resume.code)} · ${resume.round+1}년차 진행 중</span><button class="btn blue" id="resume">이어서 하기</button></div>`:''}
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="${tab==='team'}" data-tab="team">모둠으로 참여</button>
        <button role="tab" aria-selected="${tab==='teacher'}" data-tab="teacher">교사 화면</button>
      </div>
      ${tab==='team' ? `<form class="join" id="teamForm">
        <div class="two">
          <div><label for="tcode">게임 코드</label><input type="text" id="tcode" inputmode="numeric" maxlength="8" value="1031"></div>
          <div><label for="tname">모둠 이름</label><input type="text" id="tname" maxlength="12" placeholder="예: 3모둠"></div>
        </div>
        <div class="err" id="terr"></div>
        <button class="btn primary lg" type="submit">${icon('bolt')} 도시 운영 시작</button>
        <p class="muted" style="font-size:13px">같은 코드를 쓰는 모둠은 모두 같은 날씨와 사건을 겪어요.</p>
      </form>` : `<form class="join" id="teachForm">
        <div><label for="kcode">게임 코드</label><input type="text" id="kcode" inputmode="numeric" maxlength="8" value="1031"></div>
        <div class="err" id="kerr"></div>
        <button class="btn blue lg" type="submit">교사 화면 열기</button>
        <p class="muted" style="font-size:13px">프로젝터에 띄워 해마다 사건을 공개하고, 모둠 점수로 순위를 보여 줘요.</p>
      </form>`}
    </div>
    <div class="hero-stage"><span class="badge">미리 보기 · 드래그해서 돌려 보세요</span><div class="stageSlot" style="position:absolute;inset:0"></div></div>
  </section>
  <section class="card steps">
    <div class="step"><span class="n">1</span><div><b>건설</b><p>아래 도크에서 발전소를 고르고, 초록색으로 빛나는 부지를 눌러 지어요.</p></div></div>
    <div class="step"><span class="n">2</span><div><b>가동</b><p>1년 동안 발전소를 돌려 공급, 송전 손실, 수입과 탄소 배출을 계산해요.</p></div></div>
    <div class="step"><span class="n">3</span><div><b>퀴즈 · 보고</b><p>개념 퀴즈를 맞히면 10코인. 점수 코드를 선생님께 알리고 다음 해로!</p></div></div>
  </section>
  <section>
    <div class="sec-h"><h2>발전소 카드</h2><span class="muted" style="font-size:14px">송전 손실 · 도심 근교 5% · 교외 10% · 해안·산간 20%</span></div>
    <div class="plants">${PLANT_ORDER.map(t=>{ const P = PLANTS[t]; return `<article class="pcard" style="--kc:var(${KIND_VAR[P.kind]})">
      <header>${kicon(t)}<div><h3>${P.name}</h3><div class="sites">${siteNames(t)}${P.max?' · 1곳':''}${P.delay?' · 건설 1년':''}</div></div></header>
      <div class="bars">
        <span>건설비</span><span class="bar"><i style="width:${P.cost/90*100}%"></i></span><span class="num">${P.cost}</span>
        <span>발전량</span><span class="bar"><i style="width:${P.out/45*100}%"></i></span><span class="num">${P.out}</span>
        <span>연료비</span><span class="bar co2"><i style="width:${P.fuel/6*100}%"></i></span><span class="num">${P.fuel}</span>
        <span>CO₂</span><span class="bar co2"><i style="width:${P.co2/12*100}%"></i></span><span class="num">${P.co2}</span>
      </div>
      <p class="muted" style="font-size:13px">${P.note}</p></article>`; }).join('')}</div>
  </section>
  <section class="card">
    <div class="sec-h"><h2>최종 점수</h2></div>
    <div class="formula"><span class="pill good">공급 점수 (해마다 최대 20)</span>+<span class="pill good">시민 만족도</span>+<span class="pill blue">남은 예산 ÷ 10</span>−<span class="pill bad">누적 CO₂ ÷ 10</span></div>
  </section></div>`;
  // 3D 미리보기
  const slot = app.querySelector('.hero-stage .stageSlot');
  if (City3D.available()){
    slot.appendChild(City3D.element());
    City3D.setTool(null);
    City3D.sync({ plants:DEMO.plants, hv:true, ess:2, weather:'sunny', rows:DEMO.plants.map(p=>({id:p.id,status:'가동',out:PLANTS[p.type].out})),
      coverage:1, demand:72, supply:81, essCover:0, buildCount:28, round:3, co2:14, canBuild:false });
    City3D.setAutoRotate(true);
  } else slot.parentElement.style.display='none';
  if (resume) $('#resume').onclick = () => { G = resume; SC = makeScenario(G.code); state.view='team'; ui.tool=null; ui.drawer=null; save(); render(); window.scrollTo(0,0); };
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { state.homeTab = b.dataset.tab; render(); });
  const tf = $('#teamForm'); if (tf) tf.onsubmit = e => {
    e.preventDefault();
    const code = $('#tcode').value.trim(), name = $('#tname').value.trim();
    if (!code) return $('#terr').textContent = '게임 코드를 입력하세요.';
    if (!name) { $('#terr').textContent = '모둠 이름을 입력하세요. 선생님 순위표에 이 이름으로 올라가요.'; return $('#tname').focus(); }
    G = newGame(code, name); G.undo = []; SC = makeScenario(code); state.view='team'; ui.tool=null; ui.drawer={kind:'intro'}; save(); render(); window.scrollTo(0,0);
  };
  const kf = $('#teachForm'); if (kf) kf.onsubmit = e => {
    e.preventDefault();
    const code = $('#kcode').value.trim();
    if (!code) return $('#kerr').textContent = '게임 코드를 입력하세요.';
    state.view='teacher'; state.tcode=code; save(); render(); window.scrollTo(0,0);
  };
}

// ---------- 게임 화면 ----------
function topbarHTML(){
  const sb = scoreBreakdown(G), low = G.sat < 30;
  const yearN = Math.min(G.round + 1, ROUNDS);
  return `<header class="hud topbar">
    <div class="team"><span class="logo">${icon('bolt')}</span><div><b>${esc(G.team)}</b><small>코드 ${esc(G.code)} · ${yearN}/${ROUNDS}년차</small></div></div>
    <ol class="years" aria-label="진행 연도">${Array.from({length:ROUNDS},(_,i)=>`<li class="${i<G.round||(i===G.round&&G.phase!=='build'&&G.phase!=='over')?'done':''} ${i===G.round&&G.phase!=='over'?'cur':''} ${G.phase==='over'?'done':''}">${i+1}</li>`).join('')}</ol>
    <div class="stats">
      <div class="stat">${icon('coin')}<div><div class="k">예산</div><div class="v">${G.budget}<small> 코인</small></div></div></div>
      <div class="stat ${low?'low':''}">${icon('smile')}<div><div class="k">만족도</div><div class="v">${Math.round(G.sat)}</div><div class="satbar"><i style="width:${G.sat}%"></i></div></div></div>
      <div class="stat">${icon('cloud')}<div><div class="k">누적 CO₂</div><div class="v">${Math.round(G.totalCO2)}</div></div></div>
      <div class="stat">${icon('trophy')}<div><div class="k">현재 점수</div><div class="v">${sb.total}</div></div></div>
    </div>
    <div class="tbtns">
      <button class="btn ghost icon" id="bList" title="부지 목록" aria-label="부지 목록으로 보기">${icon('list')}</button>
      <button class="btn ghost icon" id="bFull" title="전체 화면" aria-label="전체 화면">${icon('expand')}</button>
      <button class="btn ghost icon" id="bExit" title="나가기 (진행 저장됨)" aria-label="처음 화면으로 나가기">${icon('exit')}</button>
    </div>
  </header>`;
}
function weatherEffects(W){
  const e = [];
  if (W.solar !== 1) e.push('태양광 ' + Math.round(W.solar*100) + '%');
  if (W.wind !== 1) e.push('풍력 ' + Math.round(W.wind*100) + '%');
  if (W.hydro !== 1) e.push('수력 ' + Math.round(W.hydro*100) + '%');
  return e.join(' · ') || '발전 영향 없음';
}
function eventHTML(){
  const r = Math.min(G.round, ROUNDS-1), ev = EVENTS[SC.events[r]], wk = SC.weathers[r], W = WEATHERS[wk];
  const next = r < ROUNDS-1 ? BASE_DEMAND[r+1] : null;
  return `<section class="hud event ${ui.eventMin?'min':''}">
    <header><span class="eyebrow">${r+1}년차 사건</span><button class="btn ghost icon" id="bEvMin" style="width:30px;height:30px;padding:5px" aria-label="${ui.eventMin?'펼치기':'접기'}">${icon(ui.eventMin?'plus':'min')}</button></header>
    <h3>${ev.name}</h3>
    <p>${ev.text}</p>
    <div class="wx">${icon(wk)}<div><b>${W.name}</b>${weatherEffects(W)}</div></div>
    ${next ? `<div class="fc">내년 기본 수요 <b class="num">${next}</b> (+${next-BASE_DEMAND[r]}) · 미리 대비하세요</div>`:''}
  </section>`;
}
function supplyHTML(sim){
  const by = {}; for (const r of sim.rows){ const k = PLANTS[r.type].kind; by[k] = (by[k]||0) + r.delivered; }
  const max = Math.max(sim.demand, sim.supply, 1) * 1.12;
  const segs = Object.keys(KIND_VAR).filter(k=>by[k]>0).map(k=>`<span class="seg" style="width:${by[k]/max*100}%;background:var(${KIND_VAR[k]})" title="${KIND_NAME[k]} ${f1(by[k])}"></span>`).join('')
    + (sim.essCover>0 ? `<span class="seg" style="width:${sim.essCover/max*100}%;background:var(--blue)" title="ESS ${f1(sim.essCover)}"></span>` : '');
  const gap = sim.supply - sim.demand;
  const H = UPGRADES.hv, S = UPGRADES.ess;
  return `<section class="hud supply" aria-label="전력 수급">
    <header><h3>전력 수급</h3><span class="pill ${gap>=0?'good':'bad'}">${gap>=0?'여유 '+f1(gap):'부족 '+f1(-gap)}</span></header>
    <div class="big2"><span class="v">${f1(sim.supply)}</span><span class="d">/ 수요 ${sim.demand}</span></div>
    <div class="sbar" role="img" aria-label="공급 ${f1(sim.supply)}, 수요 ${sim.demand}">${segs}<span class="dem" style="left:calc(${sim.demand/max*100}% - 1.5px)"></span></div>
    <div class="legend">${Object.keys(KIND_VAR).filter(k=>by[k]>0).map(k=>`<span><i style="background:var(${KIND_VAR[k]})"></i>${KIND_NAME[k]} ${f1(by[k])}</span>`).join('') || '<span>아직 발전소가 없어요</span>'}${sim.essCover>0?`<span><i style="background:var(--blue)"></i>ESS ${f1(sim.essCover)}</span>`:''}</div>
    <div class="kv"><span>송전 손실</span><b>−${f1(sim.lost)}${sim.produced>0?` (${f1(sim.lost/sim.produced*100)}%)`:''}</b></div>
    <div class="kv"><span>올해 예상 수입 · 지출</span><b>+${Math.round(Math.min(sim.supply,sim.demand))} · −${sim.fuelCost + sim.tax}</b></div>
    <div class="kv"><span>올해 예상 CO₂</span><b>${f1(sim.co2)}${sim.co2>30?' ⚠':''}</b></div>
    <div class="hr"></div>
    <div class="eyebrow">설비 투자</div>
    <div class="upgrade"><span class="kicon">${icon('tower')}</span><div><b>${H.name}</b><small>손실 1/4 (P = I²R)</small></div>
      ${G.hv ? `<span class="pill good">${icon('check')} 설치됨</span>` : `<button class="btn" id="bHV" ${G.budget<H.cost?'disabled':''}>${H.cost} 코인</button>`}</div>
    <div class="upgrade"><span class="kicon">${icon('battery')}</span><div><b>ESS <span class="pips">${[0,1,2].map(i=>`<i class="${i<G.ess?'on':''}"></i>`).join('')}</span></b><small>날씨로 준 태양광·풍력을 대당 6 보충</small></div>
      <button class="btn" id="bESS" ${G.ess>=S.max||G.budget<S.cost?'disabled':''}>${G.ess>=S.max?'최대':'+1 · '+S.cost}</button></div>
  </section>`;
}
function dockHTML(sim){
  const gap = sim.supply - sim.demand;
  return `<nav class="hud dock" aria-label="건설 도크">
    <div class="tools" role="toolbar" aria-label="발전소 선택">${PLANT_ORDER.map((t,i)=>{
      const P = PLANTS[t], cost = buildCost(G,SC,t), why = toolBlock(t);
      return `<button class="tool" style="--kc:var(${KIND_VAR[P.kind]})" data-tool="${t}" aria-pressed="${ui.tool===t}" ${why?'disabled':''} title="${esc(P.name+' · '+siteNames(t))}">
        <span class="top">${kicon(t)}<b>${P.name}</b><span class="cost">${cost!==P.cost?`<s>${P.cost}</s>`:''}${cost}</span></span>
        <span class="meta"><span>⚡${P.out}</span><span>CO₂ ${P.co2}</span><span>연료 ${P.fuel}</span></span>
        ${why?`<span class="why">${why}</span>`:`<span class="meta">${siteNames(t)}</span>`}
        <span class="key">${i+1}</span></button>`;
    }).join('')}</div>
    <div class="dock-actions">
      <button class="btn" id="bUndo" ${(G.undo||[]).length?'':'disabled'} title="되돌리기 (Ctrl+Z)">${icon('undo')} 되돌리기</button>
      <button class="run ${gap<0?'warn':''}" id="bRun">${icon('bolt')} ${G.round+1}년차 가동<small>${gap<0?'전력 '+f1(-gap)+' 부족':'정전 걱정 없음'}</small></button>
    </div>
  </nav>`;
}
function toolHintHTML(){
  if (!ui.tool) return '';
  const P = PLANTS[ui.tool];
  return `<div class="toolbar-hint"><span class="dot"></span><span><b>${P.name}</b> · 초록 + 부지를 눌러 건설 (${siteNames(ui.tool)})</span><button id="bToolX">취소 Esc</button></div>`;
}

// 드로어
function drawerHTML(sim){
  const d = ui.drawer; if (!d) return '';
  const sheetKinds = ['picker','plant','list','confirm','intro'];
  const cls = sheetKinds.includes(d.kind) ? 'sheet' : 'panel';
  let body = '';
  if (d.kind==='intro') body = introBody();
  else if (d.kind==='picker') body = pickerBody(d);
  else if (d.kind==='plant') body = plantBody(d);
  else if (d.kind==='list') body = listBody();
  else if (d.kind==='confirm') body = confirmBody(sim);
  else if (d.kind==='result') body = resultBody();
  else if (d.kind==='quiz') body = quizBody();
  else if (d.kind==='over') body = overBody();
  return `${cls==='sheet'?'<div class="scrim" id="scrim"></div>':''}<aside class="hud drawer ${cls}" role="dialog" aria-modal="${cls==='sheet'}">${body}</aside>`;
}
const closeBtn = `<button class="btn ghost icon" data-close aria-label="닫기">${icon('close')}</button>`;
function introBody(){
  return `<header><div><div class="eyebrow">시작 안내</div><h2>${esc(G.team)}, 도시를 맡았어요</h2></div>${closeBtn}</header>
    <div class="opts">
      <div class="opt" style="cursor:default"><span class="letter">1</span><span><b>발전소 고르기</b><span class="meta">아래 도크에서 카드를 누르거나 숫자키 1~7</span></span><span></span></div>
      <div class="opt" style="cursor:default"><span class="letter">2</span><span><b>초록 부지 누르기</b><span class="meta">지을 수 있는 곳만 초록 + 로 빛나요. 도시에서 멀수록 손실이 커요</span></span><span></span></div>
      <div class="opt" style="cursor:default"><span class="letter">3</span><span><b>공급이 수요를 넘으면 가동</b><span class="meta">오른쪽 전력 수급 막대의 검은 선이 수요예요</span></span><span></span></div>
    </div>
    <p class="muted" style="font-size:13px">실수했다면 되돌리기(Ctrl+Z). 화면은 드래그로 돌리고 휠로 확대해요.</p>
    <button class="btn primary lg" data-close>시작하기</button>`;
}
function optHTML(t, site){
  const P = PLANTS[t], cost = buildCost(G,SC,t), S = SITES[site];
  const why = !P.sites.includes(site) ? siteNames(t)+'만 가능' : (P.max && typeCount(G,t)>=P.max) ? '1곳만 지을 수 있어요' : G.budget<cost ? '예산이 부족해요' : '';
  return `<button class="opt" style="--kc:var(${KIND_VAR[P.kind]})" data-build="${t}" ${why?'disabled':''}>
    ${kicon(t)}<span><b>${P.name}</b><span class="meta">발전 ${P.out} → 도착 ${f1(P.out*(1-lossOf(site)))} · 연료 ${P.fuel} · CO₂ ${P.co2}</span><span class="meta" ${why?'style="color:var(--bad)"':''}>${why||P.note}</span></span>
    <span class="price">${cost!==P.cost?`<s>${P.cost}</s>`:''}${cost}</span></button>`;
}
function pickerBody(d){
  const S = SITES[d.site];
  const ok = PLANT_ORDER.filter(t=>PLANTS[t].sites.includes(d.site));
  return `<header><div><div class="eyebrow">${S.name} · ${d.idx+1}번 부지 · 손실 ${f1(lossOf(d.site)*100)}%</div><h2>무엇을 지을까요?</h2></div>${closeBtn}</header>
    <p class="muted" style="font-size:13px">${S.desc} 예산 <b class="num">${G.budget}</b> 코인</p>
    <div class="opts">${ok.map(t=>optHTML(t, d.site)).join('')}</div>`;
}
function plantBody(d){
  const p = G.plants.find(x=>x.id===d.id); if (!p) return '';
  const P = PLANTS[p.type], S = SITES[p.site], thisYear = p.built === G.round;
  const sim = simulate(G, SC), r = sim.rows.find(x=>x.id===p.id) || {out:0,loss:0,delivered:0,status:'-'};
  const steps = P.conv.split(/\s*→\s*/);
  return `<header><div style="display:flex;gap:12px;align-items:center">${kicon(p.type)}<div><div class="eyebrow">${S.name} · ${p.built+1}년차 건설</div><h2>${P.name}</h2></div></div>${closeBtn}</header>
    <div class="conv">${steps.map((s,i)=>`${i?'<i>→</i>':''}<span>${s}</span>`).join('')}</div>
    <p class="muted" style="font-size:14px">${P.note}</p>
    <div class="tiles">
      <div class="tile"><div class="k">올해 발전</div><div class="v">${f1(r.out)}</div><div class="d">${r.status}</div></div>
      <div class="tile"><div class="k">도시 도착</div><div class="v">${f1(r.delivered)}</div><div class="d">손실 −${f1(r.loss)}</div></div>
      <div class="tile"><div class="k">연료비 / 년</div><div class="v">${P.fuel}</div></div>
      <div class="tile"><div class="k">CO₂ / 년</div><div class="v">${P.co2}</div></div>
    </div>
    ${thisYear ? `<button class="btn primary lg" id="bRm">${icon('undo')} 건설 취소 (+${p.paid} 코인)</button>`
      : d.confirm ? `<div class="confirm"><p>철거하면 <b>환불 없이</b> 부지만 비워져요. 정말 철거할까요?</p><div style="display:flex;gap:8px"><button class="btn danger" id="bRm2">철거 확정</button><button class="btn" id="bRmC">취소</button></div></div>`
      : `<button class="btn" id="bRm1">철거하기</button>`}`;
}
function listBody(){
  const sm = slotMap();
  return `<header><div><div class="eyebrow">부지 목록</div><h2>도시 부지 한눈에</h2></div>${closeBtn}</header>
    <div class="zones">${SITE_ORDER.map(site=>{ const S = SITES[site];
      return `<div class="zone"><h4>${S.name}<span class="pill">손실 ${f1(lossOf(site)*100)}%</span></h4><div class="slots">${
        [0,1,2,3].map(i=>{ if (i>=S.slots) return `<span class="slot off"></span>`;
          const p = sm[site][i];
          if (p) return `<button class="slot full" style="--kc:var(${KIND_VAR[PLANTS[p.type].kind]})" data-pid="${p.id}">${icon(p.type)}<span>${PLANTS[p.type].short}</span></button>`;
          return `<button class="slot" data-site="${site}" data-idx="${i}" ${G.phase!=='build'?'disabled':''}>${icon('plus')}<span>건설</span></button>`;
        }).join('')}</div></div>`; }).join('')}</div>`;
}
function confirmBody(sim){
  const gap = sim.demand - sim.supply, d = Math.round(gap/sim.demand*30);
  return `<header><div><div class="eyebrow">가동 전 확인</div><h2>전력이 ${f1(gap)} 부족해요</h2></div>${closeBtn}</header>
    <div class="banner bad">${icon('alert')}<div><b>정전 예상 ${Math.round(gap/sim.demand*100)}%</b><span>만족도 약 −${d}, 공급 점수 감소</span></div></div>
    <p class="muted" style="font-size:14px">예산 ${G.budget} 코인이 남아 있어요. 발전소를 더 짓거나 초고압 송전망·ESS를 검토해 보세요.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-close>계속 건설하기</button><button class="btn danger" id="bRunAnyway">그래도 가동</button></div>`;
}
function scoreCode(label){
  const sb = scoreBreakdown(G);
  return `<div class="codebox"><div><div class="eyebrow">${label}</div><div class="big">${sb.total} · ${checkDigits(G.code, G.team, sb.total)}</div></div>
    <p>선생님께 <b>점수 · 확인 번호</b>를 알려 주세요.</p></div>`;
}
const cnt = (v, dec) => `<span data-count="${v}" data-dec="${dec?1:0}">${dec?f1(v):v}</span>`;
function resultBody(){
  const R = G.lastResult, net = R.revenue - R.fuelCost - R.tax, cov = Math.round(R.coverage*100);
  const lossPct = R.produced>0 ? R.lost/R.produced*100 : 0;
  const rows = R.rows.map(r=>{ const P = PLANTS[r.type];
    return `<tr><td>${P.short}${r.status!=='가동'?` <span class="pill warn">${r.status}</span>`:''}</td><td>${SITES[r.site].name}</td><td class="num">${f1(r.out)}</td><td class="num">−${f1(r.loss)}</td><td class="num">${f1(r.delivered)}</td><td class="num">${r.co2?f1(r.co2):'–'}</td></tr>`; }).join('');
  return `<header><div><div class="eyebrow">${G.round+1}년차 운영 보고서</div><h2>${cov>=100?'정전 없이 1년 운영':'정전이 일어났어요'}</h2></div></header>
    <div class="banner ${cov>=100?'good':'bad'}">${icon(cov>=100?'check':'alert')}<div><b>공급률 ${cnt(cov)}%</b><span>공급 ${f1(R.supply)} / 수요 ${R.demand} → 공급 점수 +${R.roundScore}</span></div></div>
    <div class="tiles">
      <div class="tile ${net>=0?'good':'bad'}"><div class="k">순이익</div><div class="v">${net>=0?'+':''}${cnt(net)}</div><div class="d">판매 ${R.revenue} − 연료 ${R.fuelCost}${R.tax?' − 탄소세 '+R.tax:''}</div></div>
      <div class="tile ${R.satDelta>=0?'good':'bad'}"><div class="k">만족도</div><div class="v">${R.satDelta>=0?'+':''}${cnt(R.satDelta)}</div><div class="d">${R.satNotes.join(' · ')}</div></div>
      <div class="tile ${R.co2>30?'bad':R.co2>0?'warn':'good'}"><div class="k">올해 CO₂</div><div class="v">${cnt(R.co2,1)}</div><div class="d">${R.co2>30?'30 초과 · 대기 오염 불만':'대기질 양호'}</div></div>
      <div class="tile"><div class="k">송전 손실</div><div class="v">${cnt(lossPct,1)}%</div><div class="d">−${f1(R.lost)} 가 열로 사라짐</div></div>
    </div>
    <div class="note"><b>생각해 보기</b> · ${G.hv?'초고압 송전망 덕분에 손실이 1/4로 줄었어요. 전압이 2배면 전류는 1/2, 손실 I²R은 1/4이 돼요.':'송전 전압을 높이면 같은 전력을 더 작은 전류로 보낼 수 있어 손실(P = I²R)이 크게 줄어요.'}</div>
    <details class="more"><summary>발전소별 상세</summary><div class="scroll"><table class="rtable"><thead><tr><th>발전소</th><th>부지</th><th>발전</th><th>손실</th><th>도착</th><th>CO₂</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="muted">발전소가 없어요.</td></tr>'}</tbody>
      <tfoot><tr><td>합계</td><td>${R.essCover>0?'ESS +'+f1(R.essCover):''}</td><td class="num">${f1(R.produced)}</td><td class="num">−${f1(R.lost)}</td><td class="num">${f1(R.supply)}</td><td class="num">${f1(R.co2)}</td></tr></tfoot></table></div></details>
    ${scoreCode(G.round+1+'년차 점수 코드')}
    <button class="btn primary lg" id="bQuiz">개념 퀴즈 풀기 · +10 코인 ${icon('chevron')}</button>`;
}
function quizOrder(){ const r = rng(hashStr('quiz:'+G.code+':'+G.round)), idx=[0,1,2,3]; for (let i=3;i>0;i--){ const j=Math.floor(r()*(i+1)); [idx[i],idx[j]]=[idx[j],idx[i]]; } return idx; }
function quizBody(){
  const Q = QUIZ[G.round], order = quizOrder(), answered = G.quizAnswer !== undefined, last = G.round >= ROUNDS-1;
  return `<header><div><div class="eyebrow">${G.round+1}년차 개념 퀴즈 · 정답 +10 코인</div><h2>${Q.q}</h2></div></header>
    <div class="opts">${order.map((i,k)=>{ let c=''; if (answered){ if (i===Q.c) c='right'; else if (i===G.quizAnswer) c='wrong'; }
      return `<button class="opt ${c}" data-ans="${i}" ${answered?'disabled':''} style="${answered?'opacity:1':''}"><span class="letter">${'ABCD'[k]}</span><span><b>${Q.a[i]}</b></span><span>${c==='right'?icon('check'):''}</span></button>`; }).join('')}</div>
    ${answered ? `<div class="banner ${G.quizAnswer===Q.c?'good':'bad'}">${icon(G.quizAnswer===Q.c?'check':'alert')}<div><b>${G.quizAnswer===Q.c?'정답! +10 코인':'아쉬워요'}</b><span style="color:var(--ink)">${Q.e}</span></div></div>
      <button class="btn primary lg" id="bNext">${last?'최종 결과 보기':(G.round+2)+'년차 시작'} ${icon('chevron')}</button>`:''}`;
}
function historySVG(){
  const H = G.history, W = 400, Hh = 180, pad = {l:30,r:6,t:10,b:26};
  const max = Math.ceil(Math.max(...H.map(h=>Math.max(h.demand,h.supply)),10)/20)*20;
  const iw = W-pad.l-pad.r, ih = Hh-pad.t-pad.b, bw = iw/H.length, y = v => pad.t + ih - v/max*ih;
  let g = '';
  for (let v=0; v<=max; v+=20) g += `<line x1="${pad.l}" x2="${W-pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pad.l-5}" y="${y(v)+4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`;
  H.forEach((h,i)=>{ const x = pad.l + i*bw + bw*.22, w = bw*.56;
    g += `<rect x="${x}" y="${y(h.supply)}" width="${w}" height="${pad.t+ih-y(h.supply)}" rx="4" fill="${h.supply>=h.demand?'var(--good)':'var(--bad)'}" opacity=".85"/>`;
    g += `<line x1="${x-3}" x2="${x+w+3}" y1="${y(h.demand)}" y2="${y(h.demand)}" stroke="var(--ink)" stroke-width="2.5"/>`;
    g += `<text x="${x+w/2}" y="${Hh-8}" text-anchor="middle" font-size="11" fill="var(--muted)">${i+1}년</text>`; });
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="연도별 공급과 수요">${g}</svg>`;
}
function overBody(){
  const sb = scoreBreakdown(G);
  return `<header><div><div class="eyebrow">${esc(G.team)} · 6년 운영 종료</div><h2>최종 점수 ${cnt(sb.total)}</h2></div></header>
    ${scoreCode('최종 점수 코드')}
    <div class="tiles">
      <div class="tile good"><div class="k">공급 점수</div><div class="v">+${sb.supply}</div><div class="d">최대 120</div></div>
      <div class="tile ${sb.sat>=50?'good':'warn'}"><div class="k">시민 만족도</div><div class="v">+${sb.sat}</div><div class="d">최대 100</div></div>
      <div class="tile"><div class="k">예산 ÷ 10</div><div class="v">+${sb.money}</div><div class="d">남은 예산 ${G.budget}</div></div>
      <div class="tile ${sb.carbon>15?'bad':'good'}"><div class="k">CO₂ ÷ 10</div><div class="v">−${sb.carbon}</div><div class="d">누적 ${Math.round(G.totalCO2)} · 퀴즈 ${G.quizCorrect}/6</div></div>
    </div>
    <div class="chart"><div class="eyebrow" style="margin-bottom:6px">연도별 공급(막대) · 수요(선)</div>${historySVG()}</div>
    <div class="note"><b>모둠 성찰</b><ol style="margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
      <li>우리 도시의 발전원 구성을 한 문장으로 설명하고, 그렇게 고른 이유는?</li>
      <li>가장 곤란했던 해는 언제였고, 무엇으로 대비할 수 있었을까?</li>
      <li>우리나라가 탄소 중립을 이루려면 어떤 발전원을 늘리고 무엇을 해결해야 할까?</li></ol></div>
    <button class="btn lg" id="bHome">처음 화면으로</button>`;
}

function renderTeam(){
  const building = G.phase === 'build';
  if (!building && (!ui.drawer || !['result','quiz','over','list'].includes(ui.drawer.kind))) ui.drawer = {kind: G.phase==='result'?'result':G.phase==='quiz'?'quiz':'over'};
  if (!building) ui.tool = null;
  const sim = building ? simulate(G, SC) : (G.lastResult || simulate(G, SC));
  const dockScroll = $('.tools') ? $('.tools').scrollLeft : 0;
  const drawerScroll = $('.drawer') ? $('.drawer').scrollTop : 0;
  const sameDrawer = ui._lastDrawer === JSON.stringify(ui.drawer);
  app.innerHTML = `<div class="game ${building?'':'result'}">
    <div class="stageSlot"></div>
    ${topbarHTML()}
    ${eventHTML()}
    ${building ? supplyHTML(sim) + toolHintHTML() + dockHTML(sim) : ''}
    ${drawerHTML(sim)}
  </div>`;
  ui._lastDrawer = JSON.stringify(ui.drawer);
  mountStage(app.querySelector('.stageSlot'), sim);
  City3D.setTool(ui.tool ? validPads(ui.tool) : null);
  City3D.setAutoRotate(!building);
  if ($('.tools')) $('.tools').scrollLeft = dockScroll;
  if ($('.drawer') && sameDrawer) $('.drawer').scrollTop = drawerScroll;
  bindTeam(sim);
  if (ui.animate){ ui.animate = false; countUp(); }
}
function countUp(){
  if (RM) return;
  app.querySelectorAll('[data-count]').forEach(el=>{
    const to = +el.dataset.count, dec = el.dataset.dec==='1', t0 = performance.now(), dur = 700;
    const step = now => { const k = Math.min(1,(now-t0)/dur), e = 1-Math.pow(1-k,3), v = to*e; el.textContent = dec ? f1(v) : Math.round(v); if (k<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function on(id, fn){ const el = document.getElementById(id); if (el) el.onclick = fn; }
function bindTeam(sim){
  on('bList', () => ui.drawer && ui.drawer.kind==='list' ? closeDrawer() : openDrawer({kind:'list'}));
  on('bFull', () => { const g = $('.game'); if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); else if (g.requestFullscreen) g.requestFullscreen().catch(()=>toast('이 화면에서는 전체 화면을 쓸 수 없어요','bad')); else toast('이 화면에서는 전체 화면을 쓸 수 없어요','bad'); });
  on('bExit', () => { if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); state.view='home'; ui.drawer=null; ui.tool=null; save(); render(); window.scrollTo(0,0); toast('진행 상황을 저장했어요'); });
  on('bEvMin', () => { ui.eventMin = !ui.eventMin; render(); });
  on('bHV', () => upgrade('hv'));
  on('bESS', () => upgrade('ess'));
  on('bUndo', undo);
  on('bToolX', () => setTool(ui.tool));
  on('bRun', () => { if (sim.supply < sim.demand - 1e-9) openDrawer({kind:'confirm'}); else runNow(); });
  on('bRunAnyway', runNow);
  app.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  app.querySelectorAll('[data-close]').forEach(b => b.onclick = closeDrawer);
  on('scrim', closeDrawer);
  // 드로어 안 동작
  const d = ui.drawer;
  if (d && d.kind==='picker') app.querySelectorAll('[data-build]').forEach(b => b.onclick = () => { if (doBuild(b.dataset.build, d.site, d.idx)){ ui.drawer=null; save(); render(); } });
  if (d && d.kind==='plant'){
    on('bRm', () => { G.undo = (G.undo||[]).filter(a=>a.id!==d.id); const p=G.plants.find(x=>x.id===d.id); removePlant(G, d.id); toast(`${PLANTS[p.type].name} 건설 취소 · +${p.paid} 코인`); ui.drawer=null; save(); render(); });
    on('bRm1', () => { ui.drawer = {...d, confirm:true}; render(); });
    on('bRmC', () => { ui.drawer = {...d, confirm:false}; render(); });
    on('bRm2', () => { const p=G.plants.find(x=>x.id===d.id); removePlant(G, d.id); toast(`${PLANTS[p.type].name} 철거`); ui.drawer=null; save(); render(); });
  }
  if (d && d.kind==='list'){
    app.querySelectorAll('.slot[data-site]').forEach(b => b.onclick = () => { if (ui.tool) padTap(b.dataset.site, +b.dataset.idx); else openDrawer({kind:'picker', site:b.dataset.site, idx:+b.dataset.idx}); });
    app.querySelectorAll('.slot[data-pid]').forEach(b => b.onclick = () => { if (G.phase==='build') openDrawer({kind:'plant', id:+b.dataset.pid}); });
  }
  on('bQuiz', () => { G.phase='quiz'; ui.drawer={kind:'quiz'}; save(); render(); });
  app.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => { const ok = answerQuiz(G, +b.dataset.ans); if (ok) toast('정답! +10 코인','good'); save(); render(); });
  on('bNext', () => { nextYear(G); G.undo = []; ui.drawer = G.phase==='over' ? {kind:'over'} : null; if (G.phase==='over') ui.animate = true; save(); render(); });
  on('bHome', () => { state.view='home'; G=null; ui.drawer=null; save(); render(); window.scrollTo(0,0); });
}
function runNow(){
  ui.tool = null; G.undo = [];
  runYear(G, SC); ui.drawer = {kind:'result'}; ui.animate = true;
  save(); render();
  const el = $('.drawer'); if (el && window.innerWidth<=900) el.scrollIntoView({behavior:RM?'auto':'smooth', block:'start'});
}

document.addEventListener('keydown', e => {
  if (state.view!=='team' || !G) return;
  const tag = (e.target.tagName||'').toLowerCase(); if (tag==='input'||tag==='textarea') return;
  if (e.key==='Escape'){ if (ui.drawer && ['picker','plant','list','confirm','intro'].includes(ui.drawer.kind)) closeDrawer(); else if (ui.tool) setTool(ui.tool); return; }
  if (G.phase!=='build') return;
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); return; }
  if (/^[1-7]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey){ const t = PLANT_ORDER[+e.key-1]; if (!toolBlock(t) || ui.tool===t) setTool(t); else toast(PLANTS[t].name+': '+toolBlock(t),'bad'); }
});

// ---------- 교사 화면 ----------
function renderTeacher(){
  const code = state.tcode, sc = makeScenario(code);
  const stored = lbLoad(code) || {};
  let rows = stored.rows || Array.from({length:6},(_,i)=>({team:(i+1)+'모둠',score:'',chk:''}));
  let reveal = stored.reveal ?? 0;
  const persist = () => lbSave(code, {rows, reveal});
  if (!stored.rows) persist();
  const cur = reveal - 1;
  const ev = cur>=0 ? EVENTS[sc.events[cur]] : null, wk = cur>=0 ? sc.weathers[cur] : null;
  const verified = rows.map((r,i)=>{ const has = r.team && r.score!=='' && r.chk!==''; return {...r, i, has, ok: has && checkDigits(code, r.team, +r.score)===+r.chk}; });
  const ranked = verified.filter(r=>r.has).sort((a,b)=>(+b.score)-(+a.score));
  const top = ranked.length ? Math.max(...ranked.map(r=>+r.score), 1) : 1;
  app.innerHTML = `<div class="teacher">
    <div class="t-head">
      <div><div class="eyebrow">교사 화면 · 게임 코드</div><div class="code">${esc(code)}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="tHide" ${reveal<=0?'disabled':''}>이전 해</button><button class="btn primary" id="tReveal" ${reveal>=ROUNDS?'disabled':''}>${reveal>=ROUNDS?'모두 공개됨':(reveal+1)+'년차 사건 공개'}</button><button class="btn ghost" id="tHome">${icon('exit')} 나가기</button></div>
    </div>
    <div class="t-grid">
      <section class="card spot">
        ${ev ? `<div class="yr">${cur+1}년차 / ${ROUNDS} · 기본 수요 ${BASE_DEMAND[cur]}</div><h2>${ev.name}</h2><p class="t">${ev.text}</p>
          <div class="wx">${icon(wk)}<div><b>${WEATHERS[wk].name}</b>${weatherEffects(WEATHERS[wk])}</div></div>
          <p class="muted" style="font-size:14px">모둠별 건설 시간 약 8분 → 가동 → 퀴즈 → 점수 코드 입력</p>`
          : `<div class="yr">준비</div><h2>모둠이 게임 코드 <span class="num">${esc(code)}</span>로 접속하면 시작해요</h2><p class="t muted">준비되면 오른쪽 위 "1년차 사건 공개"를 누르세요.</p>`}
        <div class="timeline">${sc.events.map((k,i)=>`<div class="tl ${i===cur?'cur':''} ${i>=reveal?'hid':''}"><b>${i+1}년차</b><span>${i<reveal?EVENTS[k].name:'비공개'}</span></div>`).join('')}</div>
      </section>
      <section class="card" style="display:flex;flex-direction:column;gap:14px">
        <div class="sec-h" style="margin:0"><h2>모둠 순위</h2><span class="muted" style="font-size:13px">이 기기에만 저장돼요</span></div>
        <div class="lbrd">${ranked.length ? ranked.map((r,k)=>`<div class="lrow ${k===0?'r1':''}"><span class="rk">${k+1}</span><div><div class="nm">${esc(r.team)} ${r.ok?'':'<span class="pill bad">확인 번호 불일치</span>'}</div><div class="lb"><i style="width:${Math.max(0,+r.score)/top*100}%"></i></div></div><span class="sc">${esc(r.score)}</span></div>`).join('') : '<p class="muted">모둠이 알려 주는 점수와 확인 번호를 아래 표에 입력하면 순위가 나타나요.</p>'}</div>
        <details class="more" ${ranked.length?'':'open'}><summary>점수 입력</summary>
          <div class="scroll"><table class="etable"><thead><tr><th>모둠</th><th>점수</th><th>확인</th><th></th></tr></thead><tbody>${verified.map(r=>`<tr>
            <td><input type="text" id="lt${r.i}" data-i="${r.i}" data-f="team" value="${esc(r.team)}" aria-label="모둠 이름"></td>
            <td><input type="text" id="ls${r.i}" data-i="${r.i}" data-f="score" value="${esc(r.score)}" inputmode="numeric" aria-label="점수" style="width:76px"></td>
            <td><input type="text" id="lc${r.i}" data-i="${r.i}" data-f="chk" value="${esc(r.chk)}" inputmode="numeric" aria-label="확인 번호" style="width:60px"></td>
            <td>${r.has?(r.ok?`<span class="pill good">${icon('check')}</span>`:'<span class="pill bad">!</span>'):''}</td></tr>`).join('')}</tbody></table></div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" id="tAdd">모둠 추가</button><button class="btn" id="tClear">점수 비우기</button></div>
          <div id="tClearC"></div>
        </details>
      </section>
    </div></div>`;
  on('tHome', () => { state.view='home'; save(); render(); });
  on('tReveal', () => { reveal = Math.min(ROUNDS, reveal+1); persist(); render(); });
  on('tHide', () => { reveal = Math.max(0, reveal-1); persist(); render(); });
  on('tAdd', () => { rows.push({team:'',score:'',chk:''}); persist(); render(); });
  on('tClear', () => { $('#tClearC').innerHTML = `<div class="confirm" style="margin-top:10px"><p>모둠 이름은 두고 점수만 지울까요?</p><div style="display:flex;gap:8px"><button class="btn danger" id="tCY">지우기</button><button class="btn" id="tCN">취소</button></div></div>`;
    on('tCY', () => { rows = rows.map(r=>({team:r.team,score:'',chk:''})); persist(); render(); }); on('tCN', () => { $('#tClearC').innerHTML=''; }); });
  app.querySelectorAll('.etable input').forEach(inp => inp.onchange = () => { rows[+inp.dataset.i][inp.dataset.f] = inp.value.trim(); persist(); render(); });
}

function render(){
  if (state.view==='team' && G) renderTeam();
  else if (state.view==='teacher' && state.tcode) renderTeacher();
  else { state.view='home'; renderHome(); }
}
function start(data){
  if (data && data.G){ G = data.G; SC = makeScenario(G.code); state.view = data.view || 'team'; state.tcode = data.tcode; }
  else { const s = loadSaved(); if (s && s.view==='teacher' && s.tcode){ state.view='teacher'; state.tcode=s.tcode; } }
  render();
}
start(null);
})();
