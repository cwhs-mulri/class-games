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

test('새 변인: 판 두께·간격·차체 무게가 제동 세기를 바꾼다', () => {
  const d = E.newRide('drop'), sim = o => E.simRide({ ...d, ...o });
  assert.ok(sim({ thick: 16 }).peakG > sim({ thick: 10 }).peakG && sim({ thick: 10 }).peakG > sim({ thick: 6 }).peakG);
  assert.ok(sim({ gap: 6 }).peakG > sim({ gap: 10 }).peakG && sim({ gap: 10 }).peakG > sim({ gap: 16 }).peakG);
  // 가벼운 차체: 같은 자석이라도 감속이 크고(a = F/m) 끌어올리는 전기가 적다
  const light = sim({ body: 'light' }), steel = sim({});
  assert.ok(light.peakG > steel.peakG && light.kwh.lift < steel.kwh.lift);
  // 기본값은 예전과 같은 결과
  assert.equal(E.brakeK(E.cleanRide(d)), E.K0 * 7 * 0.9 ** 2);
});

test('루프: 꼭대기 속도가 모자라면 떨어지고, 너무 작으면 바닥에서 너무 세다', () => {
  const c = E.newRide('coaster'), sim = o => E.simRide({ ...c, ...o });
  const stall = sim({ H: 30, loop: 14 });
  assert.equal(stall.feel, 'stall'); assert.ok(stall.crash); assert.equal(stall.thrill, 0);
  assert.equal(sim({ H: 45, loop: 8 }).feel, 'strong');
  const ok = sim({ H: 45, loop: 11 });
  assert.equal(ok.feel, 'sweet'); assert.ok(ok.loop.vTop >= ok.loop.vNeed);
  // 역학적 에너지 보존: v꼭대기² = v바닥² − 2g(2R)
  const v0sq = 2 * 9.8 * 45 * 0.85;
  assert.ok(Math.abs(ok.loop.vTop ** 2 - (v0sq - 4 * 9.8 * 11)) < 1e-6);
  assert.ok(ok.thrill > sim({ H: 45 }).thrill);
});

test('전자기 발사: 인기는 오르고 전기는 더 든다', () => {
  const a = E.simRide(E.newRide('drop')), b = E.simRide({ ...E.newRide('drop'), launch: true });
  assert.ok(b.thrill > a.thrill && b.kwh.lift > a.kwh.lift);
  assert.equal(E.itemCost({ ...E.newRide('drop'), launch: true }) - E.itemCost(E.newRide('drop')), E.LAUNCH_COST);
});

test('이름은 12자 이하, 위험한 문자는 지운다', () => {
  assert.equal(E.cleanRide({ ...E.newRide('drop'), name: '<script>번개' }).name, 'script번개');
  assert.equal(E.cleanRide({ ...E.newRide('drop'), name: '가나다라마바사아자차카타파하' }).name.length, 12);
});

test('오늘의 의뢰: 하루 2개, 달성하면 보너스가 이익에 들어간다', () => {
  for (let d = 0; d < 5; d++) { const m = E.dayMissions('1234', d); assert.equal(m.length, 2); assert.notEqual(m[0], m[1]); }
  assert.ok(E.dayMissions('1234', 0).every(k => ['sweet2', 'safe', 'crowd'].includes(k)));
  const park = { slots: [E.newRide('drop'), E.newRide('coaster'), null, null, null, null], power: 1 };
  const a = E.runDay(park, { money: 0 }, { missions: ['sweet2', 'tall'] }), b = E.runDay(park, { money: 0 }, {});
  assert.deepEqual(a.missions.map(x => x.ok), [true, false]);
  assert.equal(a.missionBonus, 200); assert.ok(Math.abs(a.profit - b.profit - 200) < 1e-6);
  assert.ok(a.rides.every(x => typeof x.review === 'string' && x.review.length > 0));
});
