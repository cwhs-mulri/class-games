// 수업 모드 밸런스 시뮬레이션 — 실제 수업처럼 다수결·특임대·과학 무전·60초 준비를 넣어 모둠 생존율을 잰다.
// node tests/sim.js [모둠 수]  (기습 이벤트는 교사 재량이라 넣지 않는다)
const E = require('../public/century/engine.js');

// 선택지의 기대 효과 점수(모둠이 상식적으로 판단하는 정도)
function score(ch) {
  const v = e => (e.pop || 0) * 2 + (e.energy || 0) * 0.5 + (e.health || 0) * 0.5 + (e.hab || 0) * 1.5 + (e.food || 0) * 2;
  if (ch.r) return ch.r.p * v(ch.r.good.e || {}) + (1 - ch.r.p) * v(ch.r.bad.e || {});
  return v(ch.e || {});
}

// 한 모둠을 끝까지 진행. i = 모둠 번호(시드)
// o: { skill, quizOk, sur: {세대: [기습 이벤트…]} } — 생략하면 모둠마다 무작위
function playClassGroup(animal, scen, i, o) {
  o = o || {};
  const r = E.rng(E.hashStr('sim|' + animal + scen + i));
  const skill = o.skill != null ? (r(), o.skill) : 0.3 + r() * 0.5;          // 다수결이 좋은 선택지를 고를 확률 30~80%
  const quizOk = o.quizOk != null ? (r(), o.quizOk) : 0.55 + r() * 0.35;    // 과학 무전 정답률 55~90%
  const run = E.newRun('S' + i, 'G' + i, animal, scen);
  E.applyPrep(run, { food: 5 + Math.floor(r() * 6), special: Math.floor(r() * 3), damage: 5 + Math.floor(r() * 26) });
  const types = E.ROLES[animal].map(x => x.type), uses = types.map(() => 0);
  while (run.phase === 'play') {
    if (run.sub === 'event') {
      const ev = E.findEvent(animal, run.order[run.gen]);
      let c;
      if (r() < skill) { const s = ev.c.map(score); c = s.indexOf(Math.max(...s)); } else c = Math.floor(r() * ev.c.length);
      // 특임대: 위태로울 때 또는 가끔 능력 사용
      const roles = [];
      types.forEach((t, k) => { if (uses[k] < E.ROLE_USES && !roles.includes(t) && (run.pop < 35 || run.energy < 30 || r() < 0.15)) { roles.push(t); uses[k]++; } });
      E.resolveRun(run, c, { roles, surprises: (o.sur && o.sur[run.gen]) || [] });
    } else if (run.sub === 'quiz') { E.applyQuiz(run, r() < quizOk); run.sub = 'quizdone'; }
    E.advance(run);
  }
  return run;
}

function rates(N, o) {
  const out = {};
  for (const s of E.SCEN_ORDER) {
    out[s] = {};
    for (const a of E.ANIMAL_ORDER) { let ok = 0; for (let i = 0; i < N; i++) if (playClassGroup(a, s, i, o).extinctAt == null) ok++; out[s][a] = ok / N; }
  }
  return out;
}
module.exports = { playClassGroup, rates };

if (require.main === module) {
  const N = +process.argv[2] || 300, R = rates(N);
  for (const s of E.SCEN_ORDER) {
    const vals = E.ANIMAL_ORDER.map(a => R[s][a]), avg = vals.reduce((x, y) => x + y) / vals.length;
    console.log(s.padEnd(5), E.ANIMAL_ORDER.map((a, k) => `${a} ${(vals[k] * 100).toFixed(0)}%`).join('  '), `| 평균 ${(avg * 100).toFixed(0)}% → 6모둠 중 ${(avg * 6).toFixed(1)}`);
  }
}
