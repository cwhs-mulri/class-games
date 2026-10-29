// 100년 생존기 엔진 테스트 — `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/century/engine.js');

test('동물마다 10세대 사건이 겹치지 않게 준비되어 있다', () => {
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

test('시나리오 기온·CO₂ 표는 10세대 길이다', () => {
  for (const k of E.SCEN_ORDER) {
    assert.equal(E.SCENARIOS[k].T.length, E.GENS);
    assert.equal(E.SCENARIOS[k].ppm.length, E.GENS);
  }
  // IPCC AR6 2081~2100 평균 근사(SSP1-2.6 1.8, SSP2-4.5 2.7, SSP5-8.5 4.4)
  assert.equal(E.SCENARIOS.low.T[6], 1.8);
  assert.equal(E.SCENARIOS.mid.T[6], 2.7);
  assert.equal(E.SCENARIOS.high.T[6], 4.4);
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
    else if (run.sub === 'quiz') { E.answerQuiz(run, 0); }
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
