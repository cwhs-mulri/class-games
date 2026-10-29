// 100년 생존기 엔진 테스트 — `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/century/engine.js');

test('동물마다 20세대 사건이 겹치지 않게 준비되어 있다', () => {
  for (const a of E.ANIMAL_ORDER) {
    const order = E.eventOrder('1103', a);
    assert.equal(order.length, E.GENS, a);
    assert.equal(new Set(order).size, E.GENS, a + ' 중복 사건');
    for (const id of order) {
      const ev = E.findEvent(a, id);
      assert.ok(ev && ev.title && ev.text && ev.sci, id);
      assert.ok(ev.c.length >= 2 && ev.c.length <= 3, id + ' 선택지 수');
      for (const c of ev.c) assert.ok(c.l && (c.t !== undefined || c.r), id + ' 선택지 결과');
    }
  }
});

test('시나리오 기온·CO₂ 표는 20세대 길이다', () => {
  for (const k of E.SCEN_ORDER) {
    assert.equal(E.SCENARIOS[k].T.length, E.GENS);
    assert.equal(E.SCENARIOS[k].ppm.length, E.GENS);
  }
  // IPCC AR6 2081~2100 평균 근사(SSP1-2.6 1.8, SSP2-4.5 2.7, SSP5-8.5 4.4)
  // 2090년대 = 인덱스 17
  assert.equal(E.DECADES[17], 2090);
  assert.equal(E.SCENARIOS.low.T[17], 1.8);
  assert.equal(E.SCENARIOS.mid.T[17], 2.7);
  assert.equal(E.SCENARIOS.high.T[17], 4.4);
  // 1920~2010년대는 모든 시나리오가 같은 관측값
  for (let g = 0; g < E.HIST_GENS; g++) assert.equal(E.SCENARIOS.low.T[g], E.SCENARIOS.high.T[g]);
});

test('퀴즈 정답 표시는 보기 범위 안에 있다', () => {
  for (const q of E.QUIZ) { assert.equal(q.a.length, 4); assert.ok(q.c >= 0 && q.c < 4); }
});

function playAll(animal, scen, code, pick) {
  const run = E.newRun(code, 'T' + code, animal, scen);
  E.applyPrep(run, { food: 9, special: 1, damage: 15 });
  let guard = 0;
  while (run.phase === 'play' && guard++ < 100) {
    if (run.sub === 'event') E.choose(run, pick(run));
    else if (run.sub === 'quiz') { E.answerQuiz(run, E.quizFor(run).c); }
    else if (run.sub === 'quizdone') { run.sub = 'outcome'; if (run.gen < E.GENS - 1) { run.gen++; run.sub = 'event'; } else run.phase = 'end'; }
    else E.advance(run);
  }
  return run;
}

test('결과 코드는 모둠 이름으로 검증되고 위조를 잡아낸다', () => {
  const run = playAll('bear', 'mid', '1103', () => 0);
  const code = E.resultCode(run);
  const p = E.parseCode(code, run.team);
  assert.equal(p.ok, true); assert.equal(p.animal, 'bear'); assert.equal(p.scen, 'mid');
  assert.equal(E.parseCode(code, '다른모둠').ok, false);
  const forged = code.replace(/-(\d+)-(\d+)-/, (m, g, pop) => `-${g}-${Math.min(100, +pop + 7)}-`);
  if (forged !== code) assert.equal(E.parseCode(forged, run.team).ok, false);
  assert.equal(E.parseCode('엉뚱한 값', run.team), null);
});

test('같은 선택을 다시 돌리면(리플레이) 실제 결과와 같다', () => {
  for (const a of E.ANIMAL_ORDER) {
    const run = playAll(a, 'mid', '77', (r) => r.gen % 2);
    const rep = E.replay(run, 'mid');
    assert.equal(rep.pop, run.pop, a);
  }
});

test('밸런스: 저배출은 대부분 생존, 고배출은 대부분 멸종', () => {
  for (const a of E.ANIMAL_ORDER) {
    let low = 0, high = 0; const N = 60;
    for (let i = 0; i < N; i++) {
      const pick = (r) => (i + r.gen) % 2;
      if (playAll(a, 'low', 'B' + i, pick).extinctAt == null) low++;
      if (playAll(a, 'high', 'B' + i, pick).extinctAt == null) high++;
    }
    assert.ok(low / N >= 0.9, `${a} 저배출 생존율 ${low}/${N}`);
    assert.ok(high / N <= 0.15, `${a} 고배출 생존율 ${high}/${N}`);
  }
});

test('다수결: 가장 많은 표, 동점은 같은 시드면 같은 결과', () => {
  assert.equal(E.tally({ a: { c: 1 }, b: { c: 1 }, c: { c: 0 } }, 2, 's').winner, 1);
  const t1 = E.tally({ a: { c: 0 }, b: { c: 1 } }, 2, 'seed'), t2 = E.tally({ a: { c: 0 }, b: { c: 1 } }, 2, 'seed');
  assert.equal(t1.tie, true); assert.equal(t1.winner, t2.winner);
  assert.ok([0, 1].includes(E.tally({}, 2, 'x').winner));
});

test('특임대: 모둠원 중 최대 3명에게 서로 다른 역할', () => {
  const r = E.assignRoles('bear', ['u1', 'u2', 'u3', 'u4', 'u5'], 'k');
  const keys = Object.values(r);
  assert.equal(keys.length, 3); assert.equal(new Set(keys).size, 3);
  assert.equal(Object.keys(E.assignRoles('coral', ['u1'], 'k')).length, 1);
  for (const a of E.ANIMAL_ORDER) for (const ro of E.ROLES[a]) assert.ok(E.abilityDesc(a, ro.type).length > 3);
});

test('능력과 기습 이벤트가 효과를 내고 리플레이에도 반영된다', () => {
  const base = E.newRun('9', 'A', 'coral', 'mid'); E.applyPrep(base, { food: 9, special: 1, damage: 15 });
  const a = JSON.parse(JSON.stringify(base)), b = JSON.parse(JSON.stringify(base));
  E.resolveRun(a, 0, {}); E.resolveRun(b, 0, { surprises: ['elnino'] });
  assert.ok(b.health < a.health, '슈퍼 엘니뇨는 산호 건강을 떨어뜨린다');
  const c = JSON.parse(JSON.stringify(base)); E.resolveRun(c, 0, { roles: ['energy'] });
  assert.ok(c.energy >= a.energy);
  const d = JSON.parse(JSON.stringify(base)); E.resolveRun(d, 0, { surprises: ['methane'] });
  assert.ok(d.tAdd > 0, '메테인 분출은 이후 기온을 계속 올린다');
  assert.deepEqual(d.recs[0].sur, ['methane']);
});

test('여러 학생 60초 결과는 평균으로 합친다', () => {
  const m = E.mergePrep([{ food: 10, special: 1, damage: 10 }, { food: 6, special: 0, damage: 20 }]);
  assert.equal(m.food, 8); assert.equal(m.damage, 15); assert.ok(m.special >= 0 && m.special <= 1);
});
