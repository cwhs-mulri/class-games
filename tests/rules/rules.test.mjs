// Realtime Database 보안 규칙 테스트 — Firebase 에뮬레이터가 필요해서 GitHub Actions에서만 돈다.
// 로컬에서 돌리려면(Java 필요):
//   npm i --no-save @firebase/rules-unit-testing firebase
//   npx firebase-tools emulators:exec --only database --project demo-class-games "node --test tests/rules/"
import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const ADMIN = 'kjm140@gw1.kr';
const key = em => em.toLowerCase().replace(/\./g, ',');
let env;
const as = (uid, email) => env.authenticatedContext(uid, email ? { email, email_verified: true } : { firebase: { sign_in_provider: 'anonymous' } }).database();
const admin = () => as('admin-uid', ADMIN);
const tA = () => as('a-uid', 'teacher.a@gmail.com');   // 등록한 교사
const tB = () => as('b-uid', 'teacher.b@school.kr');   // 등록한 교사
const stranger = () => as('x-uid', 'nobody@gmail.com'); // 등록 안 한 구글 계정
const student = () => as('s-uid');                     // 익명 학생
const meta = owner => ({ title: '200년 생존기', owner, ownerEmail: 'x', created: 1, order: ['g1'], groups: { g1: { name: '1모둠', animal: 'bear', scen: 'mid' } } });

before(async () => {
  const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000').split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-class-games', database: { rules: readFileSync('database.rules.json', 'utf8'), host, port: +port } });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.database();
    await db.ref('teachers/' + key('teacher.a@gmail.com')).set({ email: 'teacher.a@gmail.com', at: 1 });
    await db.ref('teachers/' + key('teacher.b@school.kr')).set({ email: 'teacher.b@school.kr', at: 1 });
    await db.ref('rooms/1111/meta').set(meta('a-uid'));
    await db.ref('rooms/1111/live').set({ sub: 'lobby', gen: 0 });
    await db.ref('rooms/1111/players/s-uid').set({ name: '하늘', g: 'g1' });
    await db.ref('rooms/9999/meta').set({ title: '예전 수업', order: ['g1'] }); // 주인 없는 예전 수업
  });
});

test('교사 명단: 관리자만 추가·삭제, 교사는 자기 등록만 확인', async () => {
  await assertSucceeds(admin().ref('teachers/' + key('new.t@gmail.com')).set({ email: 'new.t@gmail.com', name: '새 선생님', at: 2 }));
  await assertSucceeds(admin().ref('teachers').once('value'));
  await assertSucceeds(admin().ref('teachers/' + key('teacher.b@school.kr')).remove());
  await assertFails(tA().ref('teachers/' + key('evil@gmail.com')).set({ email: 'evil@gmail.com', at: 2 }));
  await assertFails(stranger().ref('teachers/' + key('nobody@gmail.com')).set({ email: 'nobody@gmail.com', at: 2 }));
  await assertSucceeds(tA().ref('teachers/' + key('teacher.a@gmail.com')).once('value'));
  await assertFails(tA().ref('teachers').once('value'));
  await assertFails(student().ref('teachers').once('value'));
  // 키와 이메일이 다르면 거절
  await assertFails(admin().ref('teachers/' + key('a@gmail.com')).set({ email: 'b@gmail.com', at: 2 }));
});

test('등록한 교사는 자기 수업을 만들고 진행한다', async () => {
  await assertSucceeds(tB().ref('rooms/2222/meta').set(meta('b-uid')));
  await assertSucceeds(tB().ref('rooms/2222/live').set({ sub: 'lobby', gen: 0 }));
  await assertSucceeds(tA().ref('rooms/1111/live/sub').set('event'));
  await assertSucceeds(tA().ref('rooms/1111/groups/g1/run').set({ pop: 50 }));
  await assertSucceeds(tA().ref('rooms/1111/players/s-uid').remove()); // 내보내기
  await assertSucceeds(tA().ref('rooms/1111/meta/auto').set(false));
  await assertSucceeds(tA().ref('rooms/1111/meta').set(meta('a-uid'))); // 같은 코드로 다시 만들기
});

test('관리자도 교사처럼 자기 수업을 만든다', async () => {
  await assertSucceeds(admin().ref('rooms/3333/meta').set(meta('admin-uid')));
  await assertSucceeds(admin().ref('rooms/3333/live').set({ sub: 'lobby' }));
});

test('다른 교사의 수업은 조작할 수 없다', async () => {
  await assertFails(tB().ref('rooms/1111/live/sub').set('end'));
  await assertFails(tB().ref('rooms/1111/live/pending/x').set({ key: 'elnino', target: 'all' }));
  await assertFails(tB().ref('rooms/1111/groups/g1/run').set({ pop: 0 }));
  await assertFails(tB().ref('rooms/1111/players/s-uid').remove());
  await assertFails(tB().ref('rooms/1111/meta').set(meta('b-uid')));      // 주인 바꿔치기
  await assertFails(tB().ref('rooms/1111/meta/owner').set('b-uid'));
  await assertFails(admin().ref('rooms/1111/live/sub').set('end'));        // 관리자도 남의 수업은 못 건드림
  await assertFails(tA().ref('rooms/4444/meta').set(meta('b-uid')));      // 남을 주인으로 만들기
});

test('주인 없는 예전 수업은 연 교사가 주인이 된다', async () => {
  await assertFails(tA().ref('rooms/9999/live/sub').set('event'));         // 주인 되기 전엔 진행 불가
  await assertSucceeds(tA().ref('rooms/9999/meta').update({ owner: 'a-uid', ownerEmail: 'teacher.a@gmail.com' }));
  await assertSucceeds(tA().ref('rooms/9999/live/sub').set('event'));
  await assertFails(tB().ref('rooms/9999/meta/owner').set('b-uid'));
});

test('등록 안 한 계정과 학생은 수업을 만들거나 진행할 수 없다', async () => {
  await assertFails(stranger().ref('rooms/5555/meta').set(meta('x-uid')));
  await assertFails(student().ref('rooms/5555/meta').set(meta('s-uid')));
  await assertFails(student().ref('rooms/1111/live/sub').set('end'));
  await assertFails(stranger().ref('rooms/1111/live/sub').set('end'));
});

test('학생은 자기 자리만 쓴다', async () => {
  await assertSucceeds(student().ref('rooms/1111/players/s-uid').set({ name: '하늘', g: 'g1' }));
  await assertSucceeds(student().ref('rooms/1111/votes/0/s-uid').set({ c: 1, g: 'g1' }));
  await assertSucceeds(student().ref('rooms/1111/quiz/1/s-uid').set({ a: 2, g: 'g1' }));
  await assertSucceeds(student().ref('rooms/1111/abil/0/s-uid').set({ g: 'g1' }));
  await assertSucceeds(student().ref('rooms/1111/prep/s-uid').set({ food: 8, special: 1, damage: 10, g: 'g1' }));
  await assertSucceeds(student().ref('rooms/1111/live').once('value'));
  await assertFails(student().ref('rooms/1111/players/other').set({ name: '남', g: 'g1' }));
  await assertFails(student().ref('rooms/1111/votes/0/s-uid').set({ c: 7, g: 'g1' }));
});
