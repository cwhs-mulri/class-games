// 실시간 연결: Firebase Realtime Database. 설정이 없거나 주소에 ?local 이 있으면
// 같은 기기 안에서만 동작하는 로컬 모드(localStorage + BroadcastChannel)로 바뀐다 — 여러 탭으로 시험할 때 쓴다.
const FBV = '10.12.2';
const NET = (() => {
  const subs = new Set();
  let mode = 'init', user = null, offset = 0, api = null, role = 'none'; // role: none | teacher | admin
  const authCbs = [];
  const fireAuth = () => authCbs.forEach(f => { try { f(user); } catch (e) { console.warn(e); } });

  const LK = 'cg-net-tree';
  const bc = (() => { try { return new BroadcastChannel('cg-net'); } catch (e) { return null; } })();
  const readTree = () => { try { return JSON.parse(localStorage.getItem(LK)) || {}; } catch (e) { return {}; } };
  const at = (tree, path) => path.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), tree);
  function setIn(tree, path, val) {
    const ks = path.split('/').filter(Boolean); let o = tree;
    ks.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
    const last = ks[ks.length - 1];
    if (val === null || val === undefined) delete o[last]; else o[last] = JSON.parse(JSON.stringify(val));
  }
  function localWrite(changes) {
    const tree = readTree();
    for (const p in changes) setIn(tree, p, changes[p]);
    try { localStorage.setItem(LK, JSON.stringify(tree)); } catch (e) {}
    if (bc) bc.postMessage(1);
    localFire();
  }
  function localFire() { const tree = readTree(); subs.forEach(s => { if (s.local) s.cb(at(tree, s.path) ?? null); }); }
  if (bc) bc.onmessage = localFire;
  window.addEventListener('storage', e => { if (e.key === LK) localFire(); });

  const cfg = window.FB_CONFIG;
  const hasCfg = !!(cfg && cfg.apiKey && cfg.databaseURL);
  const forceLocal = /[?&]local\b/.test(location.search);

  const ready = (async () => {
    if (!hasCfg || forceLocal) {
      mode = 'local';
      let u; try { u = sessionStorage.getItem('cg-local-uid'); if (!u) { u = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('cg-local-uid', u); } } catch (e) { u = 'x' + Math.random().toString(36).slice(2, 8); }
      user = { uid: 'local-' + u, local: true }; role = 'admin'; fireAuth(); return;
    }
    const base = `https://www.gstatic.com/firebasejs/${FBV}/`;
    const [A, U, D] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-database.js')]);
    const app = A.initializeApp(cfg), auth = U.getAuth(app), db = D.getDatabase(app);
    api = { U, D, auth, db };
    mode = 'fb';
    D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
    await new Promise(res => { let first = true; U.onAuthStateChanged(auth, async u => { user = u; role = await checkRole(u); fireAuth(); if (first) { first = false; res(); } }); });
  })().catch(e => { console.warn('Firebase 연결 실패 → 로컬 모드', e); mode = 'local'; user = { uid: 'local-x', local: true }; role = 'admin'; fireAuth(); });

  // 관리자: firebase-config.js의 TEACHER_EMAILS(규칙에도 같은 주소). 교사: 관리자가 teachers/에 등록한 Google 계정
  async function checkRole(u) {
    if (!u || u.isAnonymous || !u.email) return 'none';
    const em = u.email.toLowerCase();
    if ((window.TEACHER_EMAILS || []).map(s => s.toLowerCase()).includes(em)) return 'admin';
    try { const s = await api.D.get(api.D.ref(api.db, 'teachers/' + emailKey(em))); return s.exists() ? 'teacher' : 'none'; } catch (e) { return 'none'; }
  }

  return {
    get mode() { return mode; }, get user() { return user; }, ready, hasCfg,
    now: () => Date.now() + offset,
    onAuth(cb) { authCbs.push(cb); cb(user); },
    isTeacher() { return mode !== 'init' && (role === 'teacher' || role === 'admin'); },
    isAdmin() { return mode !== 'init' && role === 'admin'; },
    async ensureAnon() { await ready; if (mode !== 'fb' || user) return user; await api.U.signInAnonymously(api.auth); return api.auth.currentUser; },
    async teacherLogin() {
      await ready; if (mode !== 'fb') return user;
      if (user && user.isAnonymous) await api.U.signOut(api.auth);
      const r = await api.U.signInWithPopup(api.auth, new api.U.GoogleAuthProvider());
      return r.user;
    },
    async logout() { await ready; if (mode === 'fb') await api.U.signOut(api.auth); },
    watch(path, cb) {
      const s = { path, cb, local: true, off: null };
      subs.add(s);
      ready.then(() => {
        if (!subs.has(s)) return;
        if (mode === 'fb') { s.local = false; s.off = api.D.onValue(api.D.ref(api.db, path), snap => cb(snap.val()), err => { console.warn('watch', path, err && err.code); cb(null, err); }); }
        else cb(at(readTree(), path) ?? null);
      });
      return () => { subs.delete(s); if (s.off) s.off(); };
    },
    async get(path) { await ready; if (mode === 'fb') { const s = await api.D.get(api.D.ref(api.db, path)); return s.val(); } return at(readTree(), path) ?? null; },
    async put(path, val) { await ready; if (mode === 'fb') return api.D.set(api.D.ref(api.db, path), val === undefined ? null : val); localWrite({ [path]: val }); },
    // 여러 경로를 한 번에 (경로: 값)
    async update(changes) {
      await ready;
      if (mode === 'fb') { const c = {}; for (const k in changes) c[k] = changes[k] === undefined ? null : changes[k]; return api.D.update(api.D.ref(api.db), c); }
      localWrite(changes);
    },
  };
})();
// Realtime Database 키에는 . 을 쓸 수 없어 , 로 바꾼다(규칙도 같은 방식)
const emailKey = em => String(em || '').trim().toLowerCase().replace(/\./g, ',');
const roomPath = code => `rooms/${String(code).replace(/[.#$\[\]\/]/g, '_')}`;
function qrSVG(text) {
  const q = new QRLIB.QRCode(-1, QRLIB.ECL.M); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
