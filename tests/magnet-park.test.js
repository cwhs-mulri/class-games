// 자석 브레이크 놀이공원 엔진 테스트 — `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/magnet-park/engine.js');

test('자유 낙하 속도는 √(2gh)', () => {
  const s = E.simRide({ kind: 'drop', H: 60, seats: 16, grade: 1, rows: 7, mat: 'cu', L: 30 });
  assert.ok(Math.abs(s.vIn - Math.sqrt(2 * 9.8 * (60 - 35))) < 1e-9);
  // 시뮬레이션의 자유 낙하 구간 끝 속도도 이론과 거의 같다
  const lastFree = s.samples.filter(x => x.g === 0 && x.y > 35).pop();
  assert.ok(Math.abs(lastFree.v - s.vIn) < 0.6);
});

test('제동: 구리 > 알루미늄 > 플라스틱(제동 없음), 자석이 많을수록 세다', () => {
  const base = { kind: 'drop', H: 60, seats: 16, grade: 1, rows: 7, L: 30 };
  const cu = E.simRide({ ...base, mat: 'cu' }), al = E.simRide({ ...base, mat: 'al' }), pl = E.simRide({ ...base, mat: 'pl' });
  assert.ok(cu.vEnd < al.vEnd && al.vEnd < pl.vEnd);
  assert.equal(pl.peakG, 0); assert.ok(pl.crash);
  assert.ok(E.simRide({ ...base, mat: 'cu', rows: 10 }).peakG > cu.peakG);
  assert.ok(E.simRide({ ...base, mat: 'cu', grade: 2 }).peakG > cu.peakG);
});

test('자석만으로는 끝 속도가 g/c 아래로 내려가지 않는다(완전 정지는 유압 완충기)', () => {
  for (const rows of [6, 8, 12]) {
    const s = E.simRide({ kind: 'drop', H: 80, seats: 16, grade: 2, rows, mat: 'cu', L: 35 });
    assert.ok(s.vEnd >= s.vMin - 0.05, `rows ${rows}: ${s.vEnd} vs ${s.vMin}`);
  }
});

test('에너지: 브레이크 열 + 되찾은 전기 + 완충기 ≈ 처음 퍼텐셜 에너지(낙하)', () => {
  const s = E.simRide({ kind: 'drop', H: 70, seats: 20, grade: 1, rows: 8, mat: 'cu', L: 30, regen: true });
  const sum = s.energy.brakeHeat + s.energy.regen + s.energy.absorb;
  assert.ok(Math.abs(sum - s.energy.pe) / s.energy.pe < 0.03, `${sum} vs ${s.energy.pe}`);
  assert.ok(s.kwh.regen > 0 && s.kwh.regen < s.kwh.lift);
});

test('기본 설계는 안전하고 짜릿하다', () => {
  for (const k of ['drop', 'coaster']) { const s = E.simRide(E.newRide(k)); assert.equal(s.crash, false, k); assert.equal(s.feel, 'sweet', k); }
});

test('하루 영업: 전기가 모자라면 운행이 줄고, 정전 날엔 태양광·배터리만 쓴다', () => {
  const two = { slots: [E.newRide('drop'), E.newRide('coaster'), null, null, null, null], power: 0 };
  const a = E.runDay(two, { money: 1000, rep: 1.2 }, { weather: 'sun' });
  assert.ok(a.energy.need > E.BASE_POWER); assert.ok(a.energy.f < 1);
  const withSolar = { slots: [E.newRide('drop'), { kind: 'solar' }, null, null, null, null], power: 0 };
  const b = E.runDay(withSolar, { money: 1000 }, { weather: 'sun', events: ['blackout'] });
  assert.equal(b.energy.grid, 0); assert.ok(b.riders > 0);
  const c = E.runDay({ slots: [E.newRide('drop'), null, null, null, null, null] }, { money: 1000 }, { events: ['blackout'] });
  assert.equal(c.riders, 0);
});

test('회생 코일은 전력망 전기를 줄인다 · 고치는 값은 차이만', () => {
  const p1 = { slots: [E.newRide('drop'), null, null, null, null, null] };
  const p2 = JSON.parse(JSON.stringify(p1)); p2.slots[0].regen = true;
  assert.equal(E.changeCost(p1, p2), E.REGEN_COST);
  const d1 = E.runDay(p1, { money: 0 }, {}), d2 = E.runDay(p2, { money: 0 }, {});
  assert.ok(d2.energy.grid < d1.energy.grid && d2.co2 < d1.co2);
});

test('충돌·안전 점검·퀴즈 보너스', () => {
  const bad = { slots: [{ kind: 'drop', H: 60, seats: 16, grade: 1, rows: 3, mat: 'cu', L: 15 }, null, null, null, null, null] };
  const r = E.runDay(bad, { money: 1000, rep: 1 }, {});
  assert.equal(r.riders, 0); assert.ok(r.rep < 1 && r.repair > 0);
  const strong = { slots: [{ kind: 'drop', H: 100, seats: 16, grade: 2, rows: 12, mat: 'cu', L: 15 }, null, null, null, null, null] };
  assert.equal(E.simRide(strong.slots[0]).feel, 'strong');
  assert.ok(E.runDay(strong, { money: 1000 }, { events: ['inspect'] }).fines > 0);
  assert.equal(E.runDay(strong, { money: 1000 }, { quizOk: true }).quizBonus, 150);
});

test('퀴즈: 정답 위치가 섞이고 문항이 맞다', () => {
  const pos = [0, 0, 0, 0];
  for (let k = 0; k < 30; k++) for (let d = 0; d < 6; d++) { const Q = E.quizFor('C' + k, d); pos[Q.c]++; assert.equal(Q.a.length, 4); }
  for (const n of pos) assert.ok(n > 20, String(pos));
});
