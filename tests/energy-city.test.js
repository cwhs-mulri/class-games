// 에너지 도시 경영 엔진 테스트 — `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/energy-city/engine.js');

test('같은 게임 코드는 같은 사건·날씨를 만든다', () => {
  assert.deepEqual(E.makeScenario('1031'), E.makeScenario('1031'));
  const sc = E.makeScenario('1031');
  assert.equal(sc.events.length, E.ROUNDS);
  assert.equal(sc.events[0], 'start');
  assert.ok(sc.events.slice(2, 5).includes('carbontax'), '탄소세는 3~5년차에 반드시 등장');
});

test('올해 지은 발전소는 되돌리면 전액 환불된다', () => {
  const sc = E.makeScenario('1'), g = E.newGame('1', 'A');
  assert.equal(E.build(g, sc, 'coal', 'suburb'), null);
  assert.equal(g.budget, 100 - 30);
  E.removePlant(g, g.plants[0].id);
  assert.equal(g.budget, 100);
});

test('지을 수 없는 부지와 1곳 제한을 막는다', () => {
  const sc = E.makeScenario('1'), g = E.newGame('1', 'A');
  assert.match(E.build(g, sc, 'nuclear', 'city'), /지을 수 없어요/);
  g.budget = 500;
  assert.equal(E.build(g, sc, 'hydro', 'mountain'), null);
  assert.match(E.build(g, sc, 'hydro', 'mountain'), /1곳/);
});

test('초고압 송전망은 송전 손실을 1/4로 줄인다', () => {
  const sc = E.makeScenario('1'), g = E.newGame('1', 'A');
  E.build(g, sc, 'coal', 'coast');
  const before = E.simulate(g, sc).lost;
  E.buyUpgrade(g, 'hv');
  const after = E.simulate(g, sc).lost;
  assert.ok(Math.abs(after - before / 4) < 1e-9);
});

test('원자력은 지은 해에는 가동하지 않는다', () => {
  const sc = E.makeScenario('1'), g = E.newGame('1', 'A');
  g.budget = 200; E.build(g, sc, 'nuclear', 'coast');
  const r = E.simulate(g, sc).rows[0];
  assert.equal(r.status, '건설 중'); assert.equal(r.out, 0);
});

test('점수 확인 번호는 모둠 이름과 점수에 따라 달라진다', () => {
  const a = E.checkDigits('1031', '3모둠', 150);
  assert.equal(a, E.checkDigits('1031', '3모둠', 150));
  assert.ok(a >= 10 && a <= 99);
  const scores = [100, 120, 140, 160, 180];
  assert.ok(scores.some((s) => E.checkDigits('1031', '3모둠', s) !== E.checkDigits('1031', '4모둠', s)), '모둠이 다르면 확인 번호도 달라야 함');
});

test('6년을 끝까지 진행할 수 있다', () => {
  const sc = E.makeScenario('2024'), g = E.newGame('2024', 'A');
  for (let r = 0; r < E.ROUNDS; r++) {
    E.build(g, sc, 'solar', 'city'); E.build(g, sc, 'lng', 'suburb');
    E.runYear(g, sc); g.phase = 'quiz'; E.answerQuiz(g, E.QUIZ[g.round].c); E.nextYear(g);
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.history.length, E.ROUNDS);
  assert.ok(Number.isFinite(E.scoreBreakdown(g).total));
});
