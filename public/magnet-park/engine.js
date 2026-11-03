// ===== 자석 브레이크 놀이공원 · 규칙 파일 (DOM 없음, Node 테스트 가능) =====
// 자이로드롭·롤러코스터의 자석(맴돌이 전류) 브레이크와 놀이공원의 에너지 장부를 계산한다.
// 물리 모형(단순화): 탑승차의 영구 자석이 구리판을 지나면 유도 전류가 생겨 운동을 방해한다.
//   제동력 F = k·v,  k = K0 × (자석 줄 수) × B² × (판의 전기 전도 비율)
//   → 빠를수록 세게, 느릴수록 약하게 걸린다. 그래서 자석만으로는 완전히 멈추지 못하고 마지막은 유압 완충기가 받는다.
// 공기 저항은 무시한다(코스터는 언덕을 내려오는 동안 마찰·공기 저항으로 에너지 15%를 잃는다고 둔다).

const G = 9.8;
const K0 = 860;               // 제동 계수 눈금(게임용)
const MOTOR_EFF = 0.85;       // 끌어올리는 전동기 효율
const REGEN_EFF = 0.35;       // 발전 코일로 되찾는 제동 에너지 비율
const J_PER_KWH = 3.6e6;
const RIDER_KG = 75;          // 손님 1명 + 좌석
const DAYS_DEFAULT = 5;
const SLOTS = 6;
const START_MONEY = 4500;     // 만원
const TICKET = 0.5;           // 탑승 1회 5천 원(만원 단위)
const GRID_PRICE = 0.3;       // 전기 1 kWh 3천 원(게임 요금)
const GRID_CO2 = 0.45;        // kg CO₂ / kWh (우리나라 전력 배출 계수 근사)
const BASE_POWER = 100;       // 하루 계약 전력(kWh)
const EXTRA_POWER = { step: 40, cost: 30 }; // 계약 전력 늘리기: 40 kWh마다 하루 30만원

const GRADES = [
  { name: '보통 자석', B: 0.6, cost: 20 },
  { name: '센 자석', B: 0.9, cost: 40 },
  { name: '네오디뮴 자석', B: 1.2, cost: 70 },
];
const MATERIALS = {
  cu: { name: '구리판', s: 1.0, cost: 6, note: '전기가 아주 잘 통해 유도 전류가 크다' },
  al: { name: '알루미늄판', s: 0.63, cost: 4, note: '구리보다 전기가 덜 통해 제동이 약하다' },
  pl: { name: '플라스틱판', s: 0, cost: 1, note: '전기가 통하지 않아 유도 전류가 흐르지 않는다' },
};
const MAT_ORDER = ['cu', 'al', 'pl'];
// 탑승차 차체: 가벼우면 같은 자석으로도 더 크게 감속(a = F/m)하고 끌어올리는 전기도 덜 든다
const BODIES = {
  steel: { name: '강철 차체', drop: 1500, car: 600, note: '튼튼하지만 무겁다' },
  light: { name: '알루미늄 합금 차체', drop: 900, car: 380, note: '가벼워서 끌어올리는 전기가 덜 들고, 같은 자석으로도 더 세게 감속된다' },
};
const BODY_ORDER = ['steel', 'light'];
// 롤러코스터 수직 루프(물방울 모양): 크기 = 루프 높이의 절반(m). 꼭대기는 더 좁게(0.6배), 바닥은 더 넓게(1.8배) 휜다
const LOOPS = [0, 8, 11, 14];
const LOOP_TOP = 0.6, LOOP_BOTTOM = 1.8, LOOP_MAXG = 5;
// 전자기 발사(선형 유도 전동기): 끌어올리는 대신 전자기력으로 쏘아 올린다. 짜릿하지만 효율이 낮다
const LAUNCH_EFF = 0.65, LAUNCH_COST = 300;

// 놀이 시설 종류와 설계 범위
const KINDS = {
  drop: {
    name: '자이로드롭', icon: '🗼', base: 700, cyclesDay: 150, safeEnd: 7,
    range: { H: [30, 110, 5], seats: [8, 24, 4], rows: [1, 12, 1], L: [10, 35, 1], thick: [4, 20, 1], gap: [4, 20, 1] },
    def: { H: 60, seats: 16, grade: 1, rows: 7, mat: 'cu', L: 30, thick: 10, gap: 10, body: 'steel', launch: false, regen: false },
    // 감속 g: 너무 약하면 심심, 짜릿한 구간, 너무 세면 불만·안전 점검 위반
    comfort: { dull: 2, sweet: [2.5, 4.2], strong: 5 },
  },
  coaster: {
    name: '롤러코스터', icon: '🎢', base: 900, cyclesDay: 120, safeEnd: 4,
    range: { H: [20, 80, 5], cars: [2, 6, 1], rows: [1, 12, 1], L: [10, 60, 1], thick: [4, 20, 1], gap: [4, 20, 1] },
    def: { H: 45, cars: 4, grade: 0, rows: 7, mat: 'cu', L: 40, thick: 10, gap: 10, body: 'steel', launch: false, loop: 0, regen: false },
    comfort: { dull: 0.6, sweet: [0.8, 2.0], strong: 3 },
  },
  solar: { name: '태양광 발전', icon: '☀️', base: 260, kwh: 30 },
  battery: { name: '배터리', icon: '🔋', base: 200, cap: 60 },
};
const KIND_ORDER = ['drop', 'coaster', 'solar', 'battery'];
const REGEN_COST = 250;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- 설계값 정리(범위 밖 값 막기) ----
function cleanRide(r) {
  const K = KINDS[r && r.kind]; if (!K || !K.range) return null;
  const o = { kind: r.kind };
  for (const k in K.range) { const [a, b, st] = K.range[k]; const v = Number(r[k]); o[k] = clamp(Math.round((Number.isFinite(v) ? v : K.def[k]) / st) * st, a, b); }
  o.grade = clamp(Math.round(Number(r.grade) || 0), 0, GRADES.length - 1);
  o.mat = MATERIALS[r.mat] ? r.mat : 'cu';
  o.regen = !!r.regen;
  o.body = BODIES[r.body] ? r.body : 'steel';
  o.launch = !!r.launch;
  if (r.kind === 'coaster') { const lp = Number(r.loop) || 0; o.loop = LOOPS.includes(lp) ? lp : 0; }
  const nm = typeof r.name === 'string' ? r.name.replace(/[<>&"'`\\]/g, '').trim().slice(0, 12) : '';
  if (nm) o.name = nm;
  return o;
}
function newRide(kind) { return cleanRide(Object.assign({ kind }, KINDS[kind].def)); }
function cleanPark(p) {
  const slots = Array.from({ length: SLOTS }, (_, i) => {
    const s = p && p.slots && p.slots[i];
    if (!s || !KINDS[s.kind]) return null;
    if (s.kind === 'solar' || s.kind === 'battery') return { kind: s.kind };
    return cleanRide(s);
  });
  return { slots, power: clamp(Math.round(Number(p && p.power) || 0), 0, 5) };
}

// ---- 질량과 제동 계수 ----
function rideMass(r) { const B = BODIES[r.body] || BODIES.steel; return r.kind === 'drop' ? B.drop + r.seats * RIDER_KG : r.cars * (B.car + 4 * RIDER_KG); }
function riderSeats(r) { return r.kind === 'drop' ? r.seats : r.cars * 4; }
// 제동 계수 k ∝ (자석 수)·B²·(판의 전기 전도도)·(판 두께). 간격이 벌어지면 판에 닿는 자기장이 약해진다(B가 12.5 mm×2마다 약 1/e)
function gapFactor(gap) { return Math.exp(-((gap == null ? 10 : gap) - 10) / 12.5); }
function brakeK(r) { return K0 * r.rows * GRADES[r.grade].B ** 2 * MATERIALS[r.mat].s * ((r.thick == null ? 10 : r.thick) / 10) * gapFactor(r.gap); }

// ---- 시운전 시뮬레이션 ----
// 반환: 진입 속도, 끝 속도, 최대 감속(g), 판정, 에너지(J), 그림용 표본
function simRide(r) {
  r = cleanRide(r); if (!r) return null;
  const K = KINDS[r.kind], m = rideMass(r), k = brakeK(r), c = k / m;
  const samples = [];
  let vIn, vEnd, peakG, tFall, brakeHeat, pe, distStop = null, loop = null;
  if (r.kind === 'drop') {
    // 꼭대기 H에서 자유 낙하 → 높이 (5 + L)부터 L 동안 자석 구간 → 아래 5 m 유압 완충기
    const yBrake = 5 + r.L, hFree = r.H - yBrake;
    vIn = Math.sqrt(2 * G * hFree); tFall = Math.sqrt(2 * hFree / G);
    pe = m * G * r.H;
    const dt = 0.004; let t = 0, y = r.H, v = 0, a = 0; peakG = 0;
    // 자유 낙하
    while (y > yBrake) { v += G * dt; y -= v * dt; t += dt; if (samples.length === 0 || t - samples[samples.length - 1].t >= 0.04) samples.push({ t: r1(t * 100) / 100, y, v, g: 0 }); }
    y = yBrake; v = vIn;
    // 자석 구간: dv/dt = g − c·v (아래 방향 +)
    while (y > 5 && t < 60) {
      a = G - c * v; v = Math.max(0, v + a * dt); y -= v * dt; t += dt;
      const dec = (c * v - G) / G; if (dec > peakG) peakG = dec;
      if (samples.length === 0 || t - samples[samples.length - 1].t >= 0.04) samples.push({ t: Math.round(t * 100) / 100, y, v, g: Math.max(0, dec) });
      if (v < 0.05) break; // 이론상 끝 속도(g/c)보다 느려질 수 없지만 수치 안전장치
    }
    peakG = Math.max(0, (c * vIn - G) / G);
    vEnd = v;
    brakeHeat = 0.5 * m * vIn ** 2 + m * G * r.L - 0.5 * m * vEnd ** 2;
    // 유압 완충기로 멈추는 모습
    const tStop = t; while (y > 0 && v > 0) { v = Math.max(0, v - 3 * G * dt); y = Math.max(0, y - v * dt); t += dt; if (t - samples[samples.length - 1].t >= 0.04) samples.push({ t: Math.round(t * 100) / 100, y, v, g: v > 0 ? 3 : 0 }); }
    samples.push({ t: Math.round((t + 0.3) * 100) / 100, y: Math.max(0, y), v: 0, g: 0, end: true });
    void tStop;
  } else {
    // 언덕 H에서 내려와(마찰·공기 저항 15% 손실) 수평 자석 구간 L에서 감속: dv/dt = −c·v → v는 거리에 따라 일정하게 준다
    pe = m * G * r.H;
    if (r.loop) {
      // 루프: 바닥 속도 v₀² = 2gH×0.85, 꼭대기 v² = v₀² − 2g×(2R). 떨어지지 않으려면 꼭대기에서 v² ≥ g·r(꼭대기 곡률 반지름)
      const v0sq = 2 * G * r.H * 0.85, R = r.loop, vtSq = v0sq - 4 * G * R, need = G * R * LOOP_TOP;
      loop = { R, vTop: Math.sqrt(Math.max(0, vtSq)), vNeed: Math.sqrt(need), gBottom: 1 + v0sq / (G * R * LOOP_BOTTOM), stall: vtSq < need };
    }
    vIn = Math.sqrt(2 * G * r.H * (r.loop ? 0.8 : 0.85)); // 루프를 돌면 마찰로 조금 더 잃는다
    tFall = 0;
    vEnd = Math.max(0, vIn - c * r.L);
    distStop = c > 0 ? vIn / c : Infinity;
    peakG = c * vIn / G;
    brakeHeat = 0.5 * m * (vIn ** 2 - vEnd ** 2);
    // 그림용: 언덕 내려오기(2.5초) + 감속 구간
    const steps = 60;
    for (let i = 0; i <= steps; i++) { const f = i / steps; samples.push({ t: Math.round(f * 2.5 * 100) / 100, x: f, v: vIn * Math.sqrt(f), g: 0, phase: 'hill' }); }
    let x = 0, v = vIn, t = 2.5; const dt = 0.01;
    while (x < r.L && v > 0.05 && t < 60) { const a = c * v; v = Math.max(0, v - a * dt); x += v * dt; t += dt; if (t - samples[samples.length - 1].t >= 0.04) samples.push({ t: Math.round(t * 100) / 100, x: 1 + x / r.L, v, g: a / G, phase: 'brake' }); }
    samples.push({ t: Math.round((t + 0.4) * 100) / 100, x: 2, v: 0, g: 0, end: true, phase: 'station' });
  }
  const stall = !!(loop && loop.stall);
  const crash = stall || vEnd > K.safeEnd + 1e-9;
  if (stall) { vEnd = 0; brakeHeat = 0; }
  const regenJ = r.regen ? brakeHeat * REGEN_EFF : 0;
  const liftJ = pe / (r.launch ? LAUNCH_EFF : MOTOR_EFF);
  const C = K.comfort;
  let feel;
  if (stall) feel = 'stall';
  else if (crash) feel = 'crash';
  else if (peakG > C.strong || (loop && loop.gBottom > LOOP_MAXG)) feel = 'strong';
  else if (peakG >= C.sweet[0] && peakG <= C.sweet[1]) feel = 'sweet';
  else if (peakG < C.dull) feel = 'dull';
  else feel = peakG > C.sweet[1] ? 'scary' : 'mild';
  return {
    ride: r, m, k, c, vIn, vEnd, peakG, tFall, distStop, loop, vMin: c > 0 && r.kind === 'drop' ? G / c : 0,
    crash, feel, thrill: thrill(r, peakG, feel), samples,
    energy: { pe, brakeHeat: brakeHeat * (1 - (r.regen ? REGEN_EFF : 0)), regen: regenJ, lift: liftJ, absorb: Math.max(0, pe - brakeHeat - (r.kind === 'coaster' ? pe * 0.15 : 0)) },
    kwh: { lift: liftJ / J_PER_KWH, regen: regenJ / J_PER_KWH },
  };
}
const FEEL = {
  stall: { label: '루프에서 떨어짐!', tone: 'bad', tip: '루프 꼭대기에서 속도가 모자라요. 언덕을 높이거나 루프를 작게 하세요.' },
  crash: { label: '완충기 충돌!', tone: 'bad', tip: '끝 속도가 너무 빨라요. 자석을 더 세게·더 많이, 또는 브레이크 구간을 길게.' },
  strong: { label: '너무 세다', tone: 'bad', tip: '감속(또는 루프 바닥에서 몸을 누르는 힘)이 너무 커서 손님이 아파요. 안전 점검에서 벌금을 받아요.' },
  scary: { label: '무섭다', tone: 'warn', tip: '조금 세요. 자석을 줄이거나 자유 낙하 높이를 낮춰 보세요.' },
  sweet: { label: '짜릿하다!', tone: 'good', tip: '딱 좋은 감속이에요.' },
  mild: { label: '살짝 약하다', tone: 'warn', tip: '조금 더 짜릿해도 돼요.' },
  dull: { label: '심심하다', tone: 'warn', tip: '감속이 너무 약해요. 손님이 덜 와요.' },
};
// 인기(0~10): 높이·속도 + 감속 느낌
// 인기(0~12): 높이·속도 + 감속 느낌 + 루프·전자기 발사
const THRILL_MAX = 12;
function thrill(r, peakG, feel) {
  if (feel === 'crash' || feel === 'stall') return 0;
  let t = r.kind === 'drop' ? r.H / 12 : r.H / 9;
  t += { sweet: 3, mild: 1.5, scary: 1, dull: 0, strong: -2 }[feel] || 0;
  if (r.launch) t += 1.5;
  if (r.loop) t += 1.5 + r.loop / 10;
  return clamp(r1(t), 0, THRILL_MAX);
}

// ---- 시설 값 ----
function itemCost(s) {
  if (!s) return 0;
  const K = KINDS[s.kind];
  if (s.kind === 'solar' || s.kind === 'battery') return K.base;
  const size = s.kind === 'drop' ? s.H * 10 + s.seats * 15 : s.H * 14 + s.cars * 60;
  let c = K.base + size + s.rows * GRADES[s.grade].cost + s.L * MATERIALS[s.mat].cost * (s.thick == null ? 10 : s.thick) / 10 + (s.regen ? REGEN_COST : 0);
  c += Math.max(0, 10 - (s.gap == null ? 10 : s.gap)) * 30; // 간격을 좁히려면 정밀 시공
  if (s.body === 'light') c += s.kind === 'drop' ? 350 : s.cars * 70;
  if (s.launch) c += LAUNCH_COST;
  if (s.loop) c += 150 + s.loop * 25;
  return Math.round(c);
}
function parkValue(p) { return cleanPark(p).slots.reduce((a, s) => a + itemCost(s), 0); }
// 바꾸는 데 드는 돈: 새로 지은 값 − 되판 값(절반)
function changeCost(prev, next) {
  const a = cleanPark(prev).slots, b = cleanPark(next).slots; let cost = 0;
  for (let i = 0; i < SLOTS; i++) {
    const x = a[i], y = b[i];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    // 같은 놀이기구를 고치면 값 차이만(낮추면 차이의 절반을 돌려받음), 바꾸거나 새로 지으면 새 값 − 옛 값의 절반
    if (x && y && x.kind === y.kind) { const d = itemCost(y) - itemCost(x); cost += d >= 0 ? d : Math.round(d * 0.5); }
    else cost += itemCost(y) - Math.round(itemCost(x) * 0.5);
  }
  return cost;
}

// ---- 날씨·사건 ----
const WEATHER = {
  sun: { name: '맑음', icon: '☀️', visit: 1, solar: 1 },
  cloud: { name: '흐림', icon: '⛅', visit: 0.95, solar: 0.45 },
  rain: { name: '비', icon: '🌧️', visit: 0.7, solar: 0.2 },
};
const EVENTS = {
  heat: { name: '폭염', icon: '🔥', text: '손님이 몰리고 햇빛이 강하다. 태양광 발전이 늘어난다.', visit: 1.25, solar: 1.3 },
  school: { name: '단체 손님', icon: '🚌', text: '수학여행 단체 손님이 왔다!', visit: 1.5 },
  blackout: { name: '정전', icon: '⚡', text: '하루 종일 전력망 전기가 끊겼다. 태양광·배터리·되찾은 전기로만 움직인다. 자석 브레이크는 전기 없이도 작동한다.', grid: 0 },
  price: { name: '전기 요금 인상', icon: '💸', text: '전력망 전기 요금이 오늘 세 배다.', priceMul: 3 },
  inspect: { name: '안전 점검', icon: '🦺', text: '감속이 너무 센 놀이기구는 벌금 300만원을 낸다.', fine: 300 },
};
const EVENT_ORDER = ['heat', 'school', 'blackout', 'price', 'inspect'];
function dayWeather(code, day) { const r = rng(hashStr('w|' + code + '|' + day))(); return r < 0.55 ? 'sun' : r < 0.82 ? 'cloud' : 'rain'; }
// 혼자 하기: 3·5일째에 무작위 사건
function soloEvent(code, day) { if (day !== 2 && day !== 4) return null; const r = rng(hashStr('e|' + code + '|' + day)); return EVENT_ORDER[Math.floor(r() * EVENT_ORDER.length)]; }

// ---- 하루 영업 ----
// st: { money, rep(평판 0.6~1.3), battery(kWh), day }   opts: { weather, events:[키], shakeKWh, quizOk }
function runDay(park, st, opts) {
  park = cleanPark(park); opts = opts || {};
  const W = WEATHER[opts.weather] || WEATHER.sun, evs = (opts.events || []).map(k => EVENTS[k]).filter(Boolean);
  let visitMul = W.visit, solarMul = W.solar, gridOn = true, priceMul = 1, fine = 0;
  for (const E of evs) { if (E.visit) visitMul *= E.visit; if (E.solar) solarMul *= E.solar; if (E.grid === 0) gridOn = false; if (E.priceMul) priceMul *= E.priceMul; if (E.fine) fine = E.fine; }
  const rides = [], notes = [];
  let solarKWh = 0, batCap = 0;
  park.slots.forEach((s, i) => {
    if (!s) return;
    if (s.kind === 'solar') solarKWh += KINDS.solar.kwh * solarMul;
    else if (s.kind === 'battery') batCap += KINDS.battery.cap;
    else rides.push({ i, s, sim: simRide(s) });
  });
  const rep = clamp(st.rep == null ? 1 : st.rep, 0.6, 1.3);
  // 운행 계획: 인기(수요)와 수용(좌석×운행 횟수) 중 작은 쪽
  for (const R of rides) {
    const K = KINDS[R.s.kind], seats = riderSeats(R.s);
    R.capacity = seats * K.cyclesDay;
    R.demand = R.sim.crash ? 0 : Math.round(R.sim.thrill ** 2 * 30 * visitMul * rep);
    R.cyclesWanted = R.sim.crash ? 0 : Math.ceil(Math.min(R.capacity, R.demand) / seats);
  }
  // 전기: 필요한 양(끌어올리기) − 되찾은 전기, 공급 = 계약 전력 + 태양광 + 배터리 + 흔들기
  const gridMax = gridOn ? BASE_POWER + park.power * EXTRA_POWER.step : 0;
  const batteryIn = Math.min(st.battery || 0, batCap);
  const shake = clamp(Number(opts.shakeKWh) || 0, 0, 15);
  const free = solarKWh + batteryIn + shake;
  const netPerDay = rides.reduce((a, R) => a + R.cyclesWanted * (R.sim.kwh.lift - R.sim.kwh.regen), 0);
  const supply = gridMax + free;
  const f = netPerDay > 0 ? Math.min(1, supply / netPerDay) : 1; // 전기가 모자라면 모든 놀이기구 운행을 같은 비율로 줄인다
  let riders = 0, liftKWh = 0, regenKWh = 0, heatKWh = 0;
  for (const R of rides) {
    R.cycles = Math.floor(R.cyclesWanted * f);
    R.riders = Math.min(R.demand, R.cycles * riderSeats(R.s));
    riders += R.riders; liftKWh += R.cycles * R.sim.kwh.lift; regenKWh += R.cycles * R.sim.kwh.regen; heatKWh += R.cycles * R.sim.energy.brakeHeat / J_PER_KWH;
    const nm = R.s.name ? `「${R.s.name}」` : KINDS[R.s.kind].name;
    if (R.sim.feel === 'stall') notes.push({ tone: 'bad', t: `${nm}(${R.i + 1}번): 루프 꼭대기 속도 ${r1(R.sim.loop.vTop)} m/s < 필요 ${r1(R.sim.loop.vNeed)} m/s → 하루 운행 중지` });
    else if (R.sim.crash) notes.push({ tone: 'bad', t: `${nm}(${R.i + 1}번): 끝 속도 ${r1(R.sim.vEnd)} m/s로 완충기에 부딪혀 하루 운행 중지` });
    if (fine && R.sim.feel === 'strong') notes.push({ tone: 'bad', t: `안전 점검: ${KINDS[R.s.kind].name}(${R.i + 1}번) 감속 ${r1(R.sim.peakG)}g → 벌금 ${fine}만원` });
  }
  const need = liftKWh - regenKWh;
  const useFree = Math.min(free, need), useGrid = Math.max(0, Math.min(gridMax, need - useFree));
  const leftover = free + gridMax - (useFree + useGrid);
  const batteryOut = Math.min(batCap, Math.max(0, Math.min(leftover, solarKWh + batteryIn + shake - useFree)));
  if (f < 1) notes.push({ tone: 'warn', t: `전기가 모자라 운행을 ${Math.round(f * 100)}%만 했어요 (필요 ${Math.round(netPerDay)} kWh · 공급 ${Math.round(supply)} kWh)` });
  const income = r1(riders * TICKET);
  const powerCost = r1(useGrid * GRID_PRICE * priceMul + park.power * EXTRA_POWER.cost);
  const fines = fine ? rides.filter(R => R.sim.feel === 'strong').length * fine : 0;
  const repair = rides.filter(R => R.sim.crash).length * 200;
  const quizBonus = opts.quizOk ? 150 : 0;
  const mctx = { rides, riders, lift: liftKWh, regen: regenKWh, grid: useGrid, day: opts.day || 0 };
  const missions = (opts.missions || []).filter(k => MISSIONS[k]).map(k => { const ok = !!MISSIONS[k].ok(mctx); return { k, ok, reward: ok ? MISSIONS[k].reward : 0 }; });
  const missionBonus = missions.reduce((a, x) => a + x.reward, 0);
  const profit = r1(income - powerCost - fines - repair + quizBonus + missionBonus);
  // 평판: 사고 −0.15, 너무 센 감속 −0.05, 짜릿한 놀이기구 +0.03
  let dRep = 0; for (const R of rides) { if (R.sim.crash) dRep -= 0.15; else if (R.sim.feel === 'strong') dRep -= 0.05; else if (R.sim.feel === 'sweet') dRep += 0.03; }
  const co2 = r1(useGrid * GRID_CO2);
  return {
    weather: opts.weather || 'sun', events: opts.events || [], riders, income, powerCost, fines, repair, quizBonus, missions, missionBonus, profit,
    money: r1((st.money == null ? START_MONEY : st.money) + profit), rep: clamp(r1((rep + dRep) * 100) / 100, 0.6, 1.3), battery: r1(batteryOut),
    energy: { lift: r1(liftKWh), regen: r1(regenKWh), grid: r1(useGrid), solar: r1(Math.min(solarKWh, need)), solarMade: r1(solarKWh), battery: r1(batteryIn), shake: r1(shake), heat: r1(heatKWh), need: r1(netPerDay), supply: r1(supply), f: Math.round(f * 100) / 100 },
    co2, notes, rides: rides.map(R => ({ i: R.i, kind: R.s.kind, riders: R.riders, cycles: R.cycles, demand: R.demand, capacity: R.capacity, feel: R.sim.feel, peakG: r1(R.sim.peakG), vIn: r1(R.sim.vIn), vEnd: r1(R.sim.vEnd), thrill: R.sim.thrill, H: R.s.H, name: R.s.name || '', loop: R.s.loop || 0, launch: !!R.s.launch, review: reviewFor(R.s, R.sim, R.i + '|' + riders) })),
  };
}
// ---- 오늘의 의뢰(미션) ----
const MISSIONS = {
  sweet2: { name: '짜릿 2연타', icon: '😆', reward: 200, text: () => '「짜릿하다!」 판정 놀이기구 2개 이상 운행', ok: c => c.rides.filter(R => R.sim.feel === 'sweet' && R.cycles > 0).length >= 2 },
  safe: { name: '무사고 운행', icon: '🛡️', reward: 200, text: () => '놀이기구 2개 이상을 충돌·「너무 세다」 없이 운행', ok: c => c.rides.length >= 2 && c.rides.every(R => !R.sim.crash && R.sim.feel !== 'strong') && c.riders > 0 },
  crowd: { name: '손님 몰이', icon: '👥', reward: 200, text: d => `하루 손님 ${crowdGoal(d).toLocaleString('ko-KR')}명 이상`, ok: c => c.riders >= crowdGoal(c.day) },
  loop: { name: '루프 도전', icon: '🌀', reward: 250, text: () => '루프가 있는 롤러코스터를 사고 없이 운행', ok: c => c.rides.some(R => R.s.loop && !R.sim.crash && R.cycles > 0) },
  launch: { name: '전자기 발사', icon: '🚀', reward: 200, text: () => '전자기 발사 놀이기구를 사고 없이 운행', ok: c => c.rides.some(R => R.s.launch && !R.sim.crash && R.cycles > 0) },
  regen: { name: '되찾기 25%', icon: '♻️', reward: 250, text: () => '끌어올린 전기의 25% 이상을 발전 코일로 되찾기', ok: c => c.lift > 0 && c.regen / c.lift >= 0.25 },
  tall: { name: '하늘 끝까지', icon: '🗼', reward: 250, text: () => '높이 90 m 이상 자이로드롭을 사고 없이 운행', ok: c => c.rides.some(R => R.s.kind === 'drop' && R.s.H >= 90 && !R.sim.crash && R.cycles > 0) },
  green: { name: '저탄소 영업', icon: '🌱', reward: 250, text: () => '전력망 전기 60 kWh 이하로 손님 1,500명 이상', ok: c => c.grid <= 60 && c.riders >= 1500 },
  light: { name: '가볍게!', icon: '🪶', reward: 150, text: () => '알루미늄 합금 차체 놀이기구를 사고 없이 운행', ok: c => c.rides.some(R => R.s.body === 'light' && !R.sim.crash && R.cycles > 0) },
};
const MISSION_ORDER = Object.keys(MISSIONS);
function crowdGoal(day) { return 2500 + (day || 0) * 900; }
function missionText(k, day) { return MISSIONS[k] ? MISSIONS[k].text(day) : ''; }
// 날마다 의뢰 2개(수업 코드로 정해져서 같은 반은 같은 의뢰). 첫날은 쉬운 것만
function dayMissions(code, day) {
  const pool = day === 0 ? ['sweet2', 'safe', 'crowd'] : MISSION_ORDER.slice();
  const r = rng(hashStr('m|' + code + '|' + day)), out = [];
  while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

// ---- 손님 한마디 ----
const REVIEWS = {
  sweet: ['심장이 쿵! 또 탈래요 😆', '몸이 붕 떴다가 부드럽게 멈춰요 👍', '줄 서서 탈 만해요!', '친구랑 세 번 탔어요 🎉'],
  mild: ['괜찮은데 조금 더 짜릿했으면…', '무난해요 🙂'],
  dull: ['멈추는 게 너무 밋밋해요 😐', '엘리베이터 같아요…'],
  scary: ['멈출 때 좀 무서웠어요 😱', '목이 살짝 뻐근해요'],
  strong: ['몸이 확 눌려서 아파요 🤕', '다신 안 탈래요…'],
  crash: ['운행 중지래요… 😢'],
  stall: ['루프에서 멈췄다고요?! 😨'],
};
function reviewFor(s, sim, seed) {
  const r = rng(hashStr('rv|' + seed)), list = (REVIEWS[sim.feel] || REVIEWS.mild).slice();
  if (sim.feel === 'sweet' || sim.feel === 'mild' || sim.feel === 'scary') {
    if (s.loop) list.push('루프에서 거꾸로 매달렸어요 🌀');
    if (s.launch) list.push('출발하자마자 슝! 🚀');
    if (s.kind === 'drop' && s.H >= 90) list.push('꼭대기에서 바다까지 보여요!');
  }
  return list[Math.floor(r() * list.length)];
}

// 최종 점수: 현금 + 시설 값의 절반(되팔 수 있는 값)
function finalScore(money, park) { return Math.round(money + parkValue(park) * 0.5); }

// ---- 흔들어 충전(게임 보너스) ----
// 손으로 흔드는 발전은 실제로 몇 W 수준이다. 게임에서는 흔든 횟수를 크게 키워 하루 보너스 전기로 준다.
function shakeKWh(count) { return clamp(Math.round(count / 6 * 10) / 10, 0, 15); }

// ---- 과학 퀴즈 ----
const QUIZ = [
  { q: '자석을 코일 속으로 넣을 때 검류계 바늘이 움직이는 까닭은?', a: ['코일을 지나는 자기장이 변해 유도 전류가 흐르기 때문', '자석에서 전자가 코일로 옮겨 가기 때문', '코일이 자석에 끌려가기 때문', '자석이 열을 내기 때문'], c: 0, e: '코일을 지나는 자기장이 변하면 코일에 전류가 흐른다. 이것이 전자기 유도이고, 이때 흐르는 전류가 유도 전류다.' },
  { q: '유도 전류를 크게 하는 방법이 아닌 것은?', a: ['자석을 코일 속에 가만히 둔다', '자석을 더 빨리 움직인다', '코일을 더 많이 감는다', '더 센 자석을 쓴다'], c: 0, e: '자기장이 변하지 않으면 유도 전류가 흐르지 않는다. 빠르게, 센 자석으로, 많이 감은 코일일수록 유도 전류가 커진다.' },
  { q: '자이로드롭의 자석 브레이크가 정전 때에도 작동하는 까닭은?', a: ['영구 자석과 구리판이 서로 움직이기만 하면 유도 전류가 생기기 때문', '비상 배터리로 전자석을 켜기 때문', '구리판이 자석을 끌어당기기 때문', '탑승차가 스스로 속도를 줄이기 때문'], c: 0, e: '떨어지는 탑승차의 영구 자석이 구리판을 지나기만 하면 유도 전류가 생겨 제동이 걸린다. 그래서 전기를 꽂지 않아도 된다.' },
  { q: '자석 브레이크에서 탑승차의 운동 에너지는 주로 무엇으로 바뀔까?', a: ['구리판에 흐르는 유도 전류에 의한 열에너지', '빛에너지', '화학 에너지', '소리 에너지만'], c: 0, e: '구리판에 흐르는 유도 전류(맴돌이 전류)가 판을 데운다. 운동 에너지가 전기 에너지를 거쳐 열에너지로 바뀐다.' },
  { q: '자석 브레이크만으로는 탑승차를 완전히 멈추기 어려운 까닭은?', a: ['느려질수록 자기장 변화가 작아져 유도 전류와 제동력이 약해지기 때문', '구리판이 녹기 때문', '자석의 힘이 시간이 지나면 사라지기 때문', '중력이 점점 커지기 때문'], c: 0, e: '제동력은 속도에 비례한다. 그래서 마지막에는 유압 완충기 같은 다른 장치가 탑승차를 멈춘다.' },
  { q: '발전기에서 일어나는 에너지 전환으로 옳은 것은?', a: ['운동 에너지 → 전기 에너지', '전기 에너지 → 운동 에너지', '빛에너지 → 전기 에너지', '화학 에너지 → 빛에너지'], c: 0, e: '발전기는 코일과 자석을 서로 움직여(회전시켜) 유도 전류를 만든다. 전동기는 반대로 전기 에너지를 운동 에너지로 바꾼다.' },
  { q: '전기차나 지하철의 회생 제동에 대한 설명으로 옳은 것은?', a: ['바퀴가 발전기를 돌려 운동 에너지를 전기 에너지로 되찾는다', '브레이크 패드의 열로 배터리를 데운다', '태양광으로 브레이크를 작동한다', '전기를 더 써서 빨리 멈춘다'], c: 0, e: '멈출 때 전동기를 발전기처럼 돌려 전기를 만들고 배터리에 저장한다. 놀이공원의 발전 코일 브레이크도 같은 원리다.' },
  { q: '에너지 효율의 뜻으로 옳은 것은?', a: ['공급한 에너지 중 유용하게 쓰인 에너지의 비율', '에너지를 만드는 데 든 돈', '한 시간 동안 쓴 전기의 양', '에너지가 사라지는 속도'], c: 0, e: '효율(%) = 유용하게 쓰인 에너지 ÷ 공급한 에너지 × 100. 나머지는 주로 열로 흩어진다.' },
  { q: '공기 저항을 무시할 때, 자이로드롭이 자유 낙하하는 동안 옳은 것은?', a: ['퍼텐셜 에너지가 줄어든 만큼 운동 에너지가 늘어난다', '운동 에너지가 일정하다', '퍼텐셜 에너지가 늘어난다', '역학적 에너지가 점점 줄어든다'], c: 0, e: '역학적 에너지 보존: 높이가 낮아지며 줄어든 퍼텐셜 에너지가 그대로 운동 에너지가 된다.' },
  { q: '다음 중 전자기 유도를 이용하지 않는 것은?', a: ['태양 전지', '교통카드', '인덕션 레인지', '발전소의 발전기'], c: 0, e: '태양 전지는 빛에너지를 바로 전기 에너지로 바꾼다. 교통카드·인덕션·발전기는 변하는 자기장으로 전류를 만든다.' },
  { q: '자석 브레이크의 판을 플라스틱으로 바꾸면 어떻게 될까?', a: ['전기가 통하지 않아 유도 전류가 흐르지 않으므로 제동이 거의 안 된다', '더 세게 제동된다', '자석이 판에 달라붙는다', '판이 뜨거워진다'], c: 0, e: '유도 전류가 흐르려면 전기가 잘 통하는 도체가 필요하다. 구리 > 알루미늄 순으로 제동이 세다.' },
  { q: '같은 높이에서 떨어질 때, 손님이 더 많이 탄 무거운 탑승차는?', a: ['운동 에너지가 커서 브레이크가 더 많은 에너지를 열로 바꿔야 한다', '더 천천히 떨어진다', '브레이크가 필요 없다', '운동 에너지가 작다'], c: 0, e: '같은 속도라면 운동 에너지(½mv²)는 질량에 비례한다. 무거우면 더 센 브레이크나 더 긴 제동 구간이 필요하다.' },
];
function quizFor(code, day) {
  const order = []; const r = rng(hashStr('q|' + code)); const idx = QUIZ.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const qi = idx[day % idx.length], Q = QUIZ[qi];
  const ord = Q.a.map((_, i) => i), r2 = rng(hashStr('qo|' + code + '|' + qi));
  for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(r2() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  void order;
  return { q: Q.q, a: ord.map(i => Q.a[i]), c: ord.indexOf(Q.c), e: Q.e };
}

if (typeof module !== 'undefined') module.exports = {
  G, K0, MOTOR_EFF, REGEN_EFF, J_PER_KWH, DAYS_DEFAULT, SLOTS, START_MONEY, TICKET, GRID_PRICE, GRID_CO2, BASE_POWER, EXTRA_POWER, REGEN_COST,
  GRADES, MATERIALS, MAT_ORDER, BODIES, BODY_ORDER, LOOPS, LOOP_TOP, LOOP_BOTTOM, LOOP_MAXG, LAUNCH_EFF, LAUNCH_COST, THRILL_MAX,
  KINDS, KIND_ORDER, FEEL, WEATHER, EVENTS, EVENT_ORDER, QUIZ, MISSIONS, MISSION_ORDER, REVIEWS,
  cleanRide, newRide, cleanPark, rideMass, riderSeats, gapFactor, brakeK, simRide, thrill, itemCost, parkValue, changeCost,
  dayWeather, soloEvent, runDay, finalScore, shakeKWh, quizFor, hashStr, rng, clamp, crowdGoal, missionText, dayMissions, reviewFor,
};
