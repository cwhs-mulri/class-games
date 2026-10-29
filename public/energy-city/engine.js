// ===== 에너지 도시 게임 엔진 (순수 함수) =====
const ROUNDS = 6;
const START_BUDGET = 100;
const START_SAT = 60;
const BASE_DEMAND = [40, 50, 60, 72, 85, 100];

const SITES = {
  city:     { name: '도심 근교', slots: 3, loss: 0.05, desc: '도시와 가까워 손실이 적지만 주민이 많아 화력·원자력은 지을 수 없어요.' },
  suburb:   { name: '교외',     slots: 4, loss: 0.10, desc: '부지가 넉넉하고 송전 거리가 중간이에요.' },
  coast:    { name: '해안',     slots: 3, loss: 0.20, desc: '냉각수와 바닷바람·조수 간만의 차가 있지만 도시에서 멀어요.' },
  mountain: { name: '산간',     slots: 2, loss: 0.20, desc: '댐과 바람이 좋지만 도시에서 멀어요.' },
};

const PLANTS = {
  coal:    { name: '석탄 화력', short: '석탄', cost: 30, out: 20, co2: 12, fuel: 4, sites: ['suburb','coast'], kind: 'fossil',
             conv: '화학 에너지 → 열에너지 → 운동 에너지 → 전기 에너지', note: '싸고 출력이 크지만 이산화 탄소와 미세먼지가 많아요.' },
  lng:     { name: 'LNG 화력', short: 'LNG', cost: 35, out: 15, co2: 6, fuel: 6, sites: ['city','suburb','coast'], kind: 'fossil',
             conv: '화학 에너지 → 열에너지 → 운동 에너지 → 전기 에너지', note: '석탄보다 깨끗하지만 연료비가 비싸요.' },
  nuclear: { name: '원자력', short: '원자력', cost: 90, out: 45, co2: 0, fuel: 3, sites: ['coast'], kind: 'nuclear', delay: 1, sat: -6,
             conv: '핵에너지 → 열에너지 → 운동 에너지 → 전기 에너지', note: '탄소 배출이 거의 없고 출력이 크지만 건설에 1년이 걸리고 주민 반대가 있어요.' },
  solar:   { name: '태양광', short: '태양광', cost: 20, out: 8, co2: 0, fuel: 0, sites: ['city','suburb','mountain'], kind: 'solar',
             conv: '빛에너지 → 전기 에너지 (광전 효과, 터빈 없음)', note: '연료비가 없지만 날씨에 따라 발전량이 크게 달라져요.' },
  wind:    { name: '풍력', short: '풍력', cost: 30, out: 12, co2: 0, fuel: 0, sites: ['coast','mountain'], kind: 'wind',
             conv: '바람의 운동 에너지 → 전기 에너지 (전자기 유도)', note: '바람이 셀수록 발전량이 늘지만 바람이 약하면 멈춰요.' },
  hydro:   { name: '수력', short: '수력', cost: 45, out: 18, co2: 0, fuel: 0, sites: ['mountain'], kind: 'hydro', max: 1,
             conv: '물의 위치 에너지 → 운동 에너지 → 전기 에너지', note: '안정적이지만 가뭄에 약하고 한 곳에만 지을 수 있어요.' },
  tidal:   { name: '조력', short: '조력', cost: 50, out: 14, co2: 0, fuel: 0, sites: ['coast'], kind: 'tidal', max: 1,
             conv: '조수 간만의 차(위치 에너지) → 전기 에너지', note: '날씨와 상관없이 일정하지만 비싸고 한 곳에만 지을 수 있어요.' },
};

const UPGRADES = {
  hv:  { name: '초고압 송전망', cost: 35, desc: '전압을 2배로 높이면 같은 전력을 보낼 때 전류가 1/2이 되어 손실(P=I²R)이 1/4로 줄어요.' },
  ess: { name: '에너지 저장 장치(ESS)', cost: 25, max: 3, cap: 6, desc: '날씨 때문에 줄어든 태양광·풍력 발전량을 1대당 최대 6까지 채워 줘요.' },
};

const WEATHERS = {
  sunny:   { name: '맑음',     icon: '☀', solar: 1.0, wind: 0.7, hydro: 1.0 },
  cloudy:  { name: '흐림·비',   icon: '☁', solar: 0.4, wind: 1.0, hydro: 1.1 },
  windy:   { name: '강풍',     icon: '≋', solar: 0.8, wind: 1.5, hydro: 1.0 },
  calm:    { name: '무풍',     icon: '◌', solar: 1.0, wind: 0.3, hydro: 1.0 },
  drought: { name: '가뭄·폭염', icon: '♨', solar: 1.1, wind: 0.6, hydro: 0.5 },
};

const EVENTS = {
  start:     { name: '도시 개발 원년', text: '새 도시가 문을 열었어요. 시민들에게 전기를 공급할 발전소를 지어 보세요.' },
  heatwave:  { name: '폭염 경보', text: '에어컨 사용이 늘어 올해 전력 수요가 15 늘어나요.', demand: 15 },
  ev:        { name: '전기차 보급 확대', text: '전기차 충전 수요로 올해부터 계속 전력 수요가 10 늘어나요.', demandPerm: 10 },
  carbontax: { name: '탄소세 도입', text: '올해부터 계속 배출한 이산화 탄소 1당 1코인을 세금으로 내요.', carbonTax: true },
  dust:      { name: '미세먼지 비상 저감 조치', text: '올해 석탄 화력의 가동이 50%로 제한돼요.', coalFactor: 0.5 },
  subsidy:   { name: '신재생 보조금', text: '올해 태양광·풍력 건설비가 40% 할인돼요.', subsidy: 0.6 },
  fuelshock: { name: '국제 연료 가격 폭등', text: '올해 석탄·LNG·우라늄 연료비가 2배가 돼요.', fuelMult: 2 },
  quake:     { name: '지진 발생', text: '안전 점검을 위해 올해 원자력 발전소가 가동을 멈춰요. 시민 불안으로 원전이 있으면 만족도 -5.', nuclearOff: true },
  typhoon:   { name: '태풍 상륙', text: '올해 해안의 풍력·조력 발전소 출력이 50%로 줄어요.', coastRenewFactor: 0.5 },
  tech:      { name: '태양전지 기술 혁신', text: '올해부터 계속 태양광 발전량이 25% 늘어나요.', solarPerm: 1.25 },
  saving:    { name: '에너지 절약 캠페인', text: '시민들이 전기를 아껴 써서 올해 전력 수요가 10 줄어요.', demand: -10 },
};

const QUIZ = [
  { q: '화력·원자력·수력·풍력 발전소에서 전기를 만드는 공통 원리는?', a: ['전자기 유도', '광전 효과', '핵분열', '마찰 전기'], c: 0,
    e: '터빈이 발전기 속 자석(또는 코일)을 회전시키면 코일을 지나는 자기 선속이 변해 유도 전류가 흘러요.' },
  { q: '발전소에서 전기를 보낼 때 전압을 높이는 가장 큰 이유는?', a: ['송전선에서 손실되는 전력을 줄이려고', '전기 요금을 올리려고', '전류를 크게 하려고', '감전을 막으려고'], c: 0,
    e: '같은 전력(P=VI)에서 전압을 높이면 전류가 줄고, 손실 전력 P=I²R이 크게 줄어들어요.' },
  { q: '송전 전압을 10배 높이면 송전선의 손실 전력은 몇 배가 될까?', a: ['1/100배', '1/10배', '10배', '변화 없음'], c: 0,
    e: '전류가 1/10이 되므로 손실 전력은 (1/10)² = 1/100배가 돼요.' },
  { q: '태양광 발전의 에너지 전환 과정으로 옳은 것은?', a: ['빛에너지 → 전기 에너지', '빛에너지 → 열 → 운동 → 전기', '화학 에너지 → 전기 에너지', '핵에너지 → 전기 에너지'], c: 0,
    e: '태양 전지는 터빈 없이 반도체에서 빛에너지를 바로 전기 에너지로 바꿔요.' },
  { q: '태양광·풍력 같은 신재생 에너지의 가장 큰 단점을 보완하는 장치는?', a: ['에너지 저장 장치(ESS)', '변압기', '냉각탑', '터빈'], c: 0,
    e: '날씨에 따라 출력이 들쭉날쭉하므로 남는 전기를 저장했다가 부족할 때 쓰는 ESS가 필요해요.' },
  { q: '태양의 에너지원이며 미래 발전 기술로 연구 중인 반응은?', a: ['수소 핵융합', '우라늄 핵분열', '연소 반응', '중화 반응'], c: 0,
    e: '태양 중심부에서는 수소 원자핵 4개가 헬륨 원자핵 1개로 융합하며 질량 결손만큼 에너지가 나와요(E=mc²).' },
];

// ---- 시드 난수 ----
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 게임 코드 → 6년치 이벤트·날씨 (모든 모둠이 같은 코드를 쓰면 같은 시나리오)
function makeScenario(code) {
  const r = rng(hashStr('energy-city:' + String(code).trim()));
  const pool = ['heatwave', 'ev', 'dust', 'subsidy', 'fuelshock', 'quake', 'typhoon', 'tech', 'saving'];
  // 섞기
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const events = ['start'].concat(pool.slice(0, 5));
  // 탄소세는 3~5년차 중 한 해에 반드시 등장
  const taxAt = 2 + Math.floor(r() * 3);
  events[taxAt] = 'carbontax';
  const wkeys = Object.keys(WEATHERS);
  const weathers = [];
  for (let i = 0; i < ROUNDS; i++) weathers.push(i === 0 ? 'sunny' : wkeys[Math.floor(r() * wkeys.length)]);
  return { events, weathers };
}

function newGame(code, team) {
  return {
    code: String(code).trim(), team: String(team).trim(),
    round: 0, phase: 'build', // build | result | quiz | over
    budget: START_BUDGET, sat: START_SAT,
    plants: [], // {id, type, site, built}
    hv: false, hvBuilt: -1, ess: 0, essBuiltThisRound: 0,
    demandPerm: 0, solarPerm: 1, carbonTax: false,
    totalCO2: 0, supplyScore: 0, quizCorrect: 0,
    history: [], nextId: 1,
  };
}

function siteCount(g, site) { return g.plants.filter(p => p.site === site).length; }
function typeCount(g, type) { return g.plants.filter(p => p.type === type).length; }

function buildCost(g, sc, type) {
  const P = PLANTS[type];
  const ev = EVENTS[sc.events[g.round]];
  if (ev.subsidy && (type === 'solar' || type === 'wind')) return Math.round(P.cost * ev.subsidy);
  return P.cost;
}

function canBuild(g, sc, type, site) {
  const P = PLANTS[type];
  if (g.phase !== 'build') return '건설 단계가 아니에요.';
  if (!P.sites.includes(site)) return P.name + '은(는) ' + SITES[site].name + '에 지을 수 없어요.';
  if (siteCount(g, site) >= SITES[site].slots) return SITES[site].name + ' 부지가 가득 찼어요.';
  if (P.max && typeCount(g, type) >= P.max) return P.name + '은(는) ' + P.max + '곳에만 지을 수 있어요.';
  if (g.budget < buildCost(g, sc, type)) return '예산이 부족해요.';
  return null;
}

function build(g, sc, type, site) {
  const err = canBuild(g, sc, type, site);
  if (err) return err;
  const cost = buildCost(g, sc, type);
  g.budget -= cost;
  g.plants.push({ id: g.nextId++, type, site, built: g.round, paid: cost });
  if (PLANTS[type].sat) g.sat += PLANTS[type].sat;
  return null;
}

// 올해 지은 것은 전액 환불(되돌리기), 예전에 지은 것은 철거(환불 없음)
function removePlant(g, id) {
  if (g.phase !== 'build') return '건설 단계가 아니에요.';
  const i = g.plants.findIndex(p => p.id === id);
  if (i < 0) return '없는 발전소예요.';
  const p = g.plants[i];
  if (p.built === g.round) { g.budget += p.paid; if (PLANTS[p.type].sat) g.sat -= PLANTS[p.type].sat; }
  g.plants.splice(i, 1);
  return null;
}

function buyUpgrade(g, key) {
  if (g.phase !== 'build') return '건설 단계가 아니에요.';
  const U = UPGRADES[key];
  if (key === 'hv' && g.hv) return '이미 설치했어요.';
  if (key === 'ess' && g.ess >= U.max) return 'ESS는 최대 ' + U.max + '대까지예요.';
  if (g.budget < U.cost) return '예산이 부족해요.';
  g.budget -= U.cost;
  if (key === 'hv') { g.hv = true; g.hvBuilt = g.round; } else { g.ess++; g.essBuiltThisRound++; }
  return null;
}
function sellUpgrade(g, key) {
  if (g.phase !== 'build') return '건설 단계가 아니에요.';
  if (key === 'hv' && g.hv && g.hvBuilt === g.round) { g.hv = false; g.hvBuilt = -1; g.budget += UPGRADES.hv.cost; return null; }
  if (key === 'ess' && g.essBuiltThisRound > 0) { g.ess--; g.essBuiltThisRound--; g.budget += UPGRADES.ess.cost; return null; }
  return '올해 설치한 것만 되돌릴 수 있어요.';
}

function demandOf(g, sc) {
  const ev = EVENTS[sc.events[g.round]];
  return BASE_DEMAND[g.round] + g.demandPerm + (ev.demandPerm || 0) + (ev.demand || 0);
}

// 1년 가동 시뮬레이션 (상태를 바꾸지 않고 결과만 계산)
function simulate(g, sc) {
  const ev = EVENTS[sc.events[g.round]];
  const W = WEATHERS[sc.weathers[g.round]];
  const solarPerm = g.solarPerm * (ev.solarPerm || 1);
  const carbonTax = g.carbonTax || !!ev.carbonTax;
  const fuelMult = ev.fuelMult || 1;
  const demand = demandOf(g, sc);
  const lossMult = g.hv ? 0.25 : 1;
  const rows = [];
  let produced = 0, lost = 0, co2 = 0, fuel = 0, renewShort = 0;
  for (const p of g.plants) {
    const P = PLANTS[p.type];
    let f = 1, status = '가동';
    if (P.delay && g.round - p.built < P.delay) { f = 0; status = '건설 중'; }
    else {
      if (P.kind === 'solar') f = W.solar * solarPerm;
      if (P.kind === 'wind') f = W.wind;
      if (P.kind === 'hydro') f = W.hydro;
      if (p.type === 'coal' && ev.coalFactor) { f *= ev.coalFactor; status = '가동 제한'; }
      if (P.kind === 'nuclear' && ev.nuclearOff) { f = 0; status = '안전 점검'; }
      if (ev.coastRenewFactor && p.site === 'coast' && (P.kind === 'wind' || P.kind === 'tidal')) { f *= ev.coastRenewFactor; status = '태풍 피해'; }
    }
    const nominal = (P.delay && g.round - p.built < P.delay) ? 0 : P.out * ((P.kind === 'solar') ? solarPerm : 1);
    const out = P.out * f;
    if ((P.kind === 'solar' || P.kind === 'wind') && out < nominal) renewShort += (nominal - out);
    const loss = out * SITES[p.site].loss * lossMult;
    const running = f > 0;
    const pc = running ? P.co2 * f : 0;
    const pf = running ? P.fuel * fuelMult : 0;
    produced += out; lost += loss; co2 += pc; fuel += pf;
    rows.push({ id: p.id, type: p.type, site: p.site, status, out, loss, delivered: out - loss, co2: pc, fuel: pf });
  }
  const essCover = Math.min(g.ess * UPGRADES.ess.cap, renewShort);
  const supply = produced - lost + essCover;
  const served = Math.min(supply, demand);
  const coverage = demand > 0 ? served / demand : 1;
  const revenue = Math.round(served);
  const tax = carbonTax ? Math.round(co2) : 0;
  const fuelCost = Math.round(fuel);
  let satDelta = 0;
  const satNotes = [];
  if (coverage < 0.999) { const d = Math.round((1 - coverage) * 30); satDelta -= d; satNotes.push('정전 -' + d); }
  else { satDelta += 3; satNotes.push('안정 공급 +3'); }
  if (co2 > 30) { satDelta -= 5; satNotes.push('대기 오염 -5'); }
  if (ev.nuclearOff && g.plants.some(p => p.type === 'nuclear')) { satDelta -= 5; satNotes.push('원전 불안 -5'); }
  const roundScore = Math.round(coverage * 20);
  return { demand, produced, lost, essCover, supply, served, coverage, revenue, tax, fuelCost, co2, satDelta, satNotes, roundScore, rows, weather: sc.weathers[g.round], event: sc.events[g.round] };
}

function runYear(g, sc) {
  if (g.phase !== 'build') return null;
  const res = simulate(g, sc);
  const ev = EVENTS[sc.events[g.round]];
  if (ev.demandPerm) g.demandPerm += ev.demandPerm;
  if (ev.solarPerm) g.solarPerm *= ev.solarPerm;
  if (ev.carbonTax) g.carbonTax = true;
  g.budget += res.revenue - res.fuelCost - res.tax;
  g.sat = Math.max(0, Math.min(100, g.sat + res.satDelta));
  g.totalCO2 += res.co2;
  g.supplyScore += res.roundScore;
  g.history.push({ round: g.round, demand: res.demand, supply: res.supply, coverage: res.coverage, co2: res.co2, budget: g.budget, sat: g.sat, revenue: res.revenue, fuelCost: res.fuelCost, tax: res.tax });
  g.lastResult = res;
  g.phase = 'result';
  return res;
}

function answerQuiz(g, idx) {
  if (g.phase !== 'quiz') return null;
  const ok = idx === QUIZ[g.round].c;
  if (ok) { g.budget += 10; g.quizCorrect++; }
  g.quizAnswer = idx;
  return ok;
}

function nextYear(g) {
  if (g.round >= ROUNDS - 1) { g.phase = 'over'; return; }
  g.round++; g.phase = 'build'; g.essBuiltThisRound = 0; g.quizAnswer = undefined;
}

function scoreBreakdown(g) {
  const supply = g.supplyScore;
  const sat = Math.round(g.sat);
  const money = Math.floor(Math.max(0, g.budget) / 10);
  const carbon = Math.floor(g.totalCO2 / 10);
  return { supply, sat, money, carbon, total: supply + sat + money - carbon };
}

function checkDigits(code, team, score) {
  return (hashStr('chk|' + String(code).trim() + '|' + String(team).trim() + '|' + score) % 90) + 10;
}

// 소수 첫째 자리 표시 (예: 12 → "12", 7.25 → "7.3")
const f1 = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');

if (typeof module !== 'undefined') module.exports = { f1, ROUNDS, BASE_DEMAND, SITES, PLANTS, UPGRADES, WEATHERS, EVENTS, QUIZ, makeScenario, newGame, canBuild, build, buildCost, removePlant, buyUpgrade, sellUpgrade, demandOf, simulate, runYear, answerQuiz, nextYear, scoreBreakdown, checkDigits, hashStr };
