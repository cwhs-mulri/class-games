// ===== 3D 놀이공원 (Three.js r128) =====
// Park3D.makeScene(scene, sun, hemi): 장면 하나에 공원 하나. 모둠 기기(Park3D.viewer)와 전자칠판(ParkBoard)이 함께 쓴다.
// 높이 눈금: 1 m = 0.2 단위
const Park3D = (function () {
  const T = window.THREE;
  const S = 0.2;
  const SLOT_POS = [[-18, -8], [0, -8], [18, -8], [-18, 9], [0, 9], [18, 9]];
  const matCache = {};
  const mat = (c, o) => { const k = c + JSON.stringify(o || {}); return matCache[k] || (matCache[k] = new T.MeshPhongMaterial(Object.assign({ color: c, flatShading: true, shininess: 8, specular: 0x111111 }, o || {}))); };
  const GEO = {}; const geo = (k, f) => GEO[k] || (GEO[k] = f());
  function mesh(g, m, x, y, z) { const o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); return o; }
  const box = (w, h, d, m, x, y, z) => mesh(geo(`b${w}|${h}|${d}`, () => new T.BoxGeometry(w, h, d)), m, x, y, z);
  const cyl = (rt, rb, h, seg, m, x, y, z) => mesh(geo(`c${rt}|${rb}|${h}|${seg}`, () => new T.CylinderGeometry(rt, rb, h, seg)), m, x, y, z);
  function label(text, color) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = color || '#FFD166'; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#14213D'; x.font = 'bold 72px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 68);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthWrite: false })); s.scale.set(2.4, 2.4, 1); return s;
  }
  // 놀이기구 이름 표지판
  function nameSign(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 112; const x = c.getContext('2d');
    x.font = 'bold 60px sans-serif'; const w = Math.min(500, x.measureText(text).width + 56);
    x.fillStyle = 'rgba(20,16,44,.88)'; x.beginPath(); x.moveTo((512 - w) / 2 + 24, 8); x.arcTo((512 + w) / 2, 8, (512 + w) / 2, 104, 24); x.arcTo((512 + w) / 2, 104, (512 - w) / 2, 104, 24); x.arcTo((512 - w) / 2, 104, (512 - w) / 2, 8, 24); x.arcTo((512 - w) / 2, 8, (512 + w) / 2, 8, 24); x.fill();
    x.fillStyle = '#FFD166'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 60);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthWrite: false, depthTest: false })); sp.scale.set(9, 2, 1); sp.renderOrder = 5; return sp;
  }
  const SKY = { sun: [0x7FB8E8, 0xD9ECF7], cloud: [0x8E9BA8, 0xCBD3DA], rain: [0x5E6B78, 0x9AA6B1], night: [0x101826, 0x2A3550] };

  // ---------- 놀이기구 모델 ----------
  // 주의: Object3D.add()는 부모를 돌려준다. 회전은 꼭 자식 객체에 따로 준 뒤 add 한다.
  const copperNew = () => new T.MeshPhongMaterial({ color: 0xC47A3C, emissive: 0x000000, flatShading: true, shininess: 70, specular: 0x7A5030 });
  const SKIN = [0xF1C7A0, 0xD9A47A, 0xB57E57, 0xF5D3B5], SHIRT = [0xF26B5B, 0x3FA7D6, 0xF6C744, 0x7BD389, 0xC86BFA, 0xFFFFFF, 0x2E3A59, 0xFF9F43];
  function shadowDisc(r) { const m = mesh(geo('sh' + r, () => new T.CircleGeometry(r, 28)), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }), 0, 0.04, 0); m.rotation.x = -Math.PI / 2; return m; }
  function ringMesh(R, tube, m, y, seg) { const o = mesh(geo(`t${R}|${tube}|${seg || 32}`, () => new T.TorusGeometry(R, tube, 6, seg || 32)), m, 0, y, 0); o.rotation.x = Math.PI / 2; return o; }
  // 탑승객 1명(앉은 자세, +z가 앞)
  function rider(k, legs) {
    const p = new T.Group();
    p.add(box(0.26, 0.34, 0.18, mat(SHIRT[k % SHIRT.length]), 0, 0.2, -0.02));
    p.add(mesh(geo('head', () => new T.SphereGeometry(0.11, 8, 6)), mat(SKIN[k % SKIN.length]), 0, 0.48, 0));
    if (legs) { p.add(box(0.09, 0.42, 0.1, mat(0x2E3A59), -0.07, -0.22, 0.12)); p.add(box(0.09, 0.42, 0.1, mat(0x2E3A59), 0.07, -0.22, 0.12)); }
    return p;
  }
  function dropModel(r) {
    const g = new T.Group(), h = r.H * S, light = r.body === 'light';
    const white = mat(0xF4F4F0), red = mat(0xE5484D), steel = mat(0x8A939C), dark = mat(0x2E333A), concrete = mat(0xC9CED4);
    const copperMat = copperNew(), ledMat = new T.MeshPhongMaterial({ color: 0xFFF1B8, emissive: 0x806A2A, flatShading: true }), beacon = new T.MeshPhongMaterial({ color: 0xFF3B3B, emissive: 0xAA0000 });
    const yOf = m => m * S + 0.4; // 시뮬레이션 높이(m) → 장면 높이
    g.add(shadowDisc(4.6));
    // 승강장·안전선·울타리
    g.add(cyl(4.1, 4.3, 0.35, 32, concrete, 0, 0.175, 0));
    g.add(cyl(3.0, 3.0, 0.02, 32, mat(0xFFD166), 0, 0.36, 0)); g.add(cyl(2.9, 2.9, 0.03, 32, concrete, 0, 0.365, 0));
    for (let i = 0; i < 24; i++) { if (i === 18 || i === 19) continue; const a = i / 24 * Math.PI * 2; g.add(box(0.05, 0.5, 0.05, steel, Math.cos(a) * 4.0, 0.6, Math.sin(a) * 4.0)); }
    g.add(ringMesh(4.0, 0.025, steel, 0.84, 40));
    // 탑: 흰 기둥 + 안내 레일 3개 + 빨간 띠 + LED 줄
    g.add(cyl(0.62, 0.82, h, 14, white, 0, h / 2 + 0.35, 0));
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const rl = box(0.12, h, 0.14, steel, Math.cos(a) * 0.74, h / 2 + 0.35, Math.sin(a) * 0.74); rl.rotation.y = -a; g.add(rl); const ld = box(0.05, h * 0.92, 0.05, ledMat, Math.cos(a + 1.05) * 0.7, h * 0.48 + 0.35, Math.sin(a + 1.05) * 0.7); g.add(ld); }
    for (let k = 1; k < 8; k++) g.add(cyl(0.76, 0.76, 0.16, 14, red, 0, 0.35 + h * k / 8, 0));
    // 꼭대기 기계실 + 항공 장애등
    g.add(cyl(1.25, 1.15, 1.2, 14, white, 0, h + 0.95, 0));
    g.add(cyl(1.3, 1.3, 0.14, 14, red, 0, h + 1.5, 0));
    g.add(mesh(geo('roof', () => new T.ConeGeometry(1.25, 0.8, 14)), red, 0, h + 1.97, 0));
    g.add(cyl(0.04, 0.04, 1.2, 4, steel, 0, h + 2.9, 0));
    g.add(mesh(geo('beacon', () => new T.SphereGeometry(0.14, 8, 6)), beacon, 0, h + 3.55, 0));
    // 자석 브레이크 구간: 탑에 세로로 붙은 구리 날개 8장(높이 5 m ~ 5+L m)
    const b0 = yOf(5), b1 = yOf(5 + r.L), bh = b1 - b0;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2; const fin = box(0.05, bh, 0.42, copperMat, Math.cos(a) * 1.0, (b0 + b1) / 2, Math.sin(a) * 1.0); fin.rotation.y = -a; g.add(fin); }
    // 바닥 유압 완충기 4개
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; g.add(cyl(0.18, 0.2, b0 - 0.35, 8, steel, Math.cos(a) * 1.05, (b0 + 0.35) / 2, Math.sin(a) * 1.05)); g.add(cyl(0.1, 0.1, 0.25, 8, mat(0xE8ECEF, { shininess: 80 }), Math.cos(a) * 1.05, b0 + 0.1, Math.sin(a) * 1.05)); }
    // 전자기 발사 코일(탑 아래쪽을 감싼 파란 고리)
    if (r.launch) for (let k = 0; k < 6; k++) g.add(ringMesh(0.95, 0.09, mat(0x5CC8FF, { emissive: 0x1B4D66 }), b1 + 0.4 + k * Math.max(0.25, (h * 0.45 - bh) / 6), 18));
    // 탑승차(곤돌라): 고리 틀 + 영구 자석 + 바깥을 보는 좌석
    const car = new T.Group(), frame = mat(light ? 0xC7D0DA : 0x2B6CB0, { shininess: light ? 60 : 8 });
    car.add(ringMesh(1.95, 0.13, frame, 0.05, 40));
    car.add(ringMesh(1.28, 0.16, frame, 0.0, 24));
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const sp = box(0.7, 0.1, 0.12, frame, Math.cos(a) * 1.62, 0.02, Math.sin(a) * 1.62); sp.rotation.y = -a; car.add(sp); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2 + Math.PI / 8; const m = box(0.22, 0.55, 0.26, dark, Math.cos(a) * 1.18, -0.05, Math.sin(a) * 1.18); m.rotation.y = -a; car.add(m); const n = box(0.23, 0.12, 0.27, k % 2 ? mat(0x3D7BFF) : red, Math.cos(a) * 1.18, 0.26, Math.sin(a) * 1.18); n.rotation.y = -a; car.add(n); }
    const n = r.seats, R = 2.15;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, seat = new T.Group();
      seat.add(box(0.36, 0.62, 0.08, mat(0x30343A), 0, 0.28, -0.16));     // 등받이
      seat.add(box(0.36, 0.07, 0.3, mat(0x30343A), 0, -0.02, 0));         // 방석
      seat.add(rider(k, true));
      seat.add(box(0.32, 0.42, 0.06, mat(0xF6C744), 0, 0.28, 0.13));      // 어깨 안전바
      seat.position.set(Math.cos(a) * R, 0.0, Math.sin(a) * R); seat.rotation.y = Math.PI / 2 - a;
      car.add(seat);
    }
    car.position.y = yOf(0); g.add(car);
    g.userData = { car, copperMat, ledMat, beacon, h, kind: 'drop', yOf, cyc: Math.random() * 20, Hm: r.H };
    return g;
  }
  // 롤러코스터: 트랙 중심선 → 평행 이동 틀(위·옆 방향) → 레일 두 줄·침목·기둥·열차
  function coasterModel(r) {
    const g = new T.Group(), h = Math.max(2.5, r.H * S), light = r.body === 'light';
    g.add(shadowDisc(7.4));
    const pts = [[-6, 0.6, 5], [-6, 0.6, 1], [-5, h * 0.7, -2.5], [-3.5, h, -4.5], [-1.5, h * 0.95, -5], [1, h * 0.4, -4], [3.5, 0.7, -2], [5.5, 0.7, 0.5], [6, 0.7, 3], [5, 0.7, 5.5], [2, 0.6, 6], [-2, 0.6, 6], [-5, 0.6, 5.8]];
    if (r.loop) {
      const a = new T.Vector3(3.5, 0.7, -2), b = new T.Vector3(5.5, 0.7, 0.5), d = b.clone().sub(a).normalize(), side = new T.Vector3(-d.z, 0, d.x);
      const mid = a.clone().add(b).multiplyScalar(0.5), R = Math.min(2.6, r.loop * S * 0.9), loopPts = [];
      for (let k = 1; k <= 7; k++) { const ph = k / 8 * Math.PI * 2; const p = mid.clone().addScaledVector(d, R * Math.sin(ph) * 0.8).addScaledVector(side, (k / 8 - 0.5) * 1.4); p.y = 0.7 + R * (1 - Math.cos(ph)); loopPts.push([p.x, p.y, p.z]); }
      pts.splice(7, 0, ...loopPts);
    }
    const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])), true, 'catmullrom', 0.2);
    const N = 360, fr = curve.computeFrenetFrames(N, true);
    const key = Math.abs(fr.normals[0].y) >= Math.abs(fr.binormals[0].y) ? 'normals' : 'binormals', sgn = fr[key][0].y >= 0 ? 1 : -1;
    const F = []; for (let i = 0; i <= N; i++) { const t = fr.tangents[i].clone(), up = fr[key][i].clone().multiplyScalar(sgn), sd = new T.Vector3().crossVectors(up, t).normalize(); F.push({ p: curve.getPointAt(i / N), t, up, sd }); }
    const uOf = (x, y, z) => { const v = new T.Vector3(x, y, z); let best = 0, bd = 1e9; F.forEach((f, i) => { const dd = f.p.distanceToSquared(v); if (dd < bd) { bd = dd; best = i / N; } }); return best; };
    const rail = mat(0xE5484D, { shininess: 50 }), spineM = mat(0xF2F2EE), steel = mat(0x8A939C);
    const tube = (fn, rad, m) => { const c = new T.CatmullRomCurve3(F.filter((_, i) => i % 3 === 0 && i < N).map(fn), true); g.add(new T.Mesh(new T.TubeGeometry(c, 260, rad, 6, true), m)); };
    tube(f => f.p.clone().addScaledVector(f.sd, 0.3), 0.07, rail);
    tube(f => f.p.clone().addScaledVector(f.sd, -0.3), 0.07, rail);
    tube(f => f.p.clone().addScaledVector(f.up, -0.22), 0.11, spineM);
    const basis = (f) => new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f.sd, f.up, f.t));
    for (let i = 0; i < N; i += 4) { const f = F[i], tie = box(0.72, 0.05, 0.1, steel, 0, 0, 0); tie.position.copy(f.p).addScaledVector(f.up, -0.12); tie.quaternion.copy(basis(f)); g.add(tie); }
    // 기둥(위를 보는 구간만, 루프 안쪽 제외)
    for (let i = 2; i < N; i += 6) { const f = F[i]; if (f.up.y < 0.35 || f.p.y < 0.9) continue; const y = f.p.y - 0.3; g.add(cyl(0.07, 0.11, y, 6, spineM, f.p.x, y / 2, f.p.z)); if (y > 2.5) { const br = box(0.05, 0.05, 0.9, steel, f.p.x, y * 0.5, f.p.z); br.quaternion.copy(basis(f)); br.position.y = y * 0.55; g.add(br); } }
    // 자석 브레이크: 트랙 가운데 구리 날개
    const copperMat = copperNew(), b0 = uOf(5.5, 0.7, 0.5) + 0.01, b1 = uOf(-2, 0.6, 6);
    for (let u = b0; u <= b1; u += 0.006) { const f = F[Math.round(u * N) % N], fin = box(0.05, 0.3, 0.32, copperMat, 0, 0, 0); fin.position.copy(f.p).addScaledVector(f.up, -0.42); fin.quaternion.copy(basis(f)); g.add(fin); }
    // 승강장(지붕 있는 플랫폼)
    const st = uOf(-6, 0.6, 3), sf = F[Math.round(st * N)];
    const plat = box(1.5, 0.35, 3.4, mat(0xC9CED4), 0, 0, 0); plat.position.copy(sf.p).addScaledVector(sf.sd, -1.15); plat.position.y = 0.2; plat.quaternion.copy(basis(sf)); g.add(plat);
    for (const dz of [-1.5, 1.5]) for (const dx of [-0.65, 1.2]) { const post = cyl(0.06, 0.06, 2.1, 6, steel, 0, 0, 0); post.position.copy(sf.p).addScaledVector(sf.sd, -1.15 + dx).addScaledVector(sf.t, dz); post.position.y = 1.15; g.add(post); }
    const roof = box(2.3, 0.12, 3.6, mat(0x3FA7D6), 0, 0, 0); roof.position.copy(sf.p).addScaledVector(sf.sd, -0.75); roof.position.y = 2.25; roof.quaternion.copy(basis(sf)); g.add(roof);
    // 체인 리프트(첫 언덕 오르막의 검은 띠)
    const uTop = uOf(-3.5, h, -4.5), uLift0 = uOf(-6, 0.6, 1);
    for (let u = uLift0 + 0.01; u < uTop - 0.01; u += 0.008) { const f = F[Math.round(u * N) % N], ch = box(0.1, 0.04, 0.14, mat(0x1F2328), 0, 0, 0); ch.position.copy(f.p).addScaledVector(f.up, -0.06); ch.quaternion.copy(basis(f)); g.add(ch); }
    if (r.launch) for (let u = st + 0.02; u < st + 0.09; u += 0.012) { const f = F[Math.round(u * N) % N], lp = box(0.5, 0.06, 0.4, mat(0x5CC8FF, { emissive: 0x1B4D66 }), 0, 0, 0); lp.position.copy(f.p).addScaledVector(f.up, -0.3); lp.quaternion.copy(basis(f)); g.add(lp); }
    // 열차
    const train = new T.Group(), cars = [], body = mat(light ? 0xC7D0DA : 0x2B6CB0, { shininess: light ? 60 : 10 });
    for (let i = 0; i < r.cars; i++) {
      const c = new T.Group();
      c.add(box(0.78, 0.28, 0.95, body, 0, 0.22, 0));
      if (i === 0) { const nose = box(0.78, 0.24, 0.3, mat(0xF6C744), 0, 0.24, 0.55); c.add(nose); }
      for (const z of [-0.2, 0.22]) { for (const x of [-0.18, 0.18]) { const pr = rider(i * 4 + (z > 0 ? 2 : 0) + (x > 0 ? 1 : 0), false); pr.scale.setScalar(0.8); pr.position.set(x, 0.3, z); c.add(pr); } c.add(box(0.7, 0.05, 0.05, mat(0xF6C744), 0, 0.5, z + 0.14)); }
      for (const x of [-0.32, 0.32]) for (const z of [-0.32, 0.32]) c.add(box(0.1, 0.14, 0.14, mat(0x1F2328), x, 0.02, z));
      train.add(c); cars.push(c);
    }
    g.add(train);
    const L = curve.getLength();
    g.userData = { curve, F, N, train, cars, copperMat, h, kind: 'coaster', b0, b1, uTop, uSt: st, uLift0, L, uu: st, dwell: Math.random() * 3, carGap: 1.05 / L };
    placeTrain(g, st);
    return g;
  }
  function placeTrain(g, u) {
    const U = g.userData;
    U.cars.forEach((c, i) => { const uu = ((u - i * U.carGap) % 1 + 1) % 1, f = U.F[Math.round(uu * U.N) % U.N]; c.position.copy(f.p).addScaledVector(f.up, 0.05); c.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(f.sd, f.up, f.t)); });
  }
  function solarModel() {
    const g = new T.Group();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const p = box(3.2, 0.12, 2, mat(0x1C3D6E, { shininess: 80, specular: 0x6688AA }), -3.6 + i * 3.6, 1.3, -1.3 + j * 2.8); p.rotation.x = -0.45; g.add(p);
      g.add(cyl(0.08, 0.08, 1.2, 4, mat(0x9AA3AD), -3.6 + i * 3.6, 0.6, -1.3 + j * 2.8));
    }
    g.userData = { kind: 'solar' };
    return g;
  }
  function batteryModel() {
    const g = new T.Group();
    g.add(box(4, 3, 2.4, mat(0xE8ECEF), 0, 1.5, 0));
    const bars = [];
    for (let i = 0; i < 4; i++) { const b = box(0.7, 0.4, 0.05, mat(0x4ADE80, { emissive: 0x1A5E33 }), -1.2 + i * 0.8, 2, 1.23); g.add(b); bars.push(b); }
    g.add(box(0.6, 0.4, 0.6, mat(0x30343A), 0, 3.2, 0));
    g.userData = { kind: 'battery', bars };
    return g;
  }

  function makeScene(scene, sun, hemi) {
    let root = null, park = null, items = [], crowd = null, crowdN = 0, rain = null, play = null;
    const ground = new T.Group(); scene.add(ground);
    const grass = mesh(geo('grass', () => new T.PlaneGeometry(80, 56)), mat(0x5FA45B)); grass.rotation.x = -Math.PI / 2; ground.add(grass);
    const path = mesh(geo('path', () => new T.PlaneGeometry(62, 3.5)), mat(0xE6D3A8)); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.02, 0.5); ground.add(path);
    for (let i = 0; i < 3; i++) { const p = mesh(geo('pathv', () => new T.PlaneGeometry(3, 34)), mat(0xE6D3A8)); p.rotation.x = -Math.PI / 2; p.position.set(-9 + i * 18, 0.021, 0.5); ground.add(p); }
    // 정문과 나무
    ground.add(box(8, 3.5, 0.6, mat(0xE5484D), 0, 1.75, 24)); ground.add(box(5, 2.6, 0.7, mat(0x5FA45B), 0, 1.3, 24));
    for (let i = 0; i < 14; i++) { const x = -36 + (i % 7) * 12 + (i > 6 ? 6 : 0), z = i > 6 ? 22 : -22; const t = mesh(geo('tree', () => new T.ConeGeometry(1.4, 3.6, 6)), mat(0x2F7D4A), x, 2.2, z); ground.add(t); ground.add(cyl(0.25, 0.3, 0.8, 5, mat(0x7A5C3E), x, 0.4, z)); }
    const slotPads = SLOT_POS.map(([x, z], i) => { const p = mesh(geo('pad', () => new T.CylinderGeometry(7, 7, 0.2, 24)), mat(0xBFC8B0), x, 0.1, z); ground.add(p); const l = label(String(i + 1)); l.position.set(x - 6, 2, z + 5); ground.add(l); return p; });
    // 손님(인스턴스)
    const MAXC = 160;
    crowd = new T.InstancedMesh(geo('person', () => new T.CylinderGeometry(0.22, 0.3, 1.1, 6)), new T.MeshPhongMaterial({ flatShading: true }), MAXC);
    const cr = []; const col = new T.Color(); const pal = [0xF26B5B, 0x3FA7D6, 0xF6C744, 0x7BD389, 0xC86BFA, 0xF5F5F0];
    for (let i = 0; i < MAXC; i++) { cr.push({ a: Math.random() * 6.28, lane: i % 4, sp: 0.3 + Math.random() * 0.5, off: Math.random() * 2 - 1 }); col.setHex(pal[i % pal.length]); crowd.setColorAt(i, col); }
    crowd.count = 0; scene.add(crowd);
    const dummy = new T.Object3D();
    // 하늘
    const skyCan = document.createElement('canvas'); skyCan.width = 4; skyCan.height = 64; const skyTex = new T.CanvasTexture(skyCan);
    function setSky(k) { const [a, b] = SKY[k] || SKY.sun; const x = skyCan.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#' + new T.Color(a).getHexString()); gr.addColorStop(1, '#' + new T.Color(b).getHexString()); x.fillStyle = gr; x.fillRect(0, 0, 4, 64); skyTex.needsUpdate = true; scene.background = skyTex; if (scene.fog) scene.fog.color.setHex(b); }
    setSky('sun');

    function build(p) {
      const key = JSON.stringify(p && p.slots);
      if (park && key === park.key) return;
      if (root) scene.remove(root);
      root = new T.Group(); scene.add(root); items = [];
      park = { key, slots: (p && p.slots) || [] };
      park.slots.forEach((s, i) => {
        if (!s) { slotPads[i].material = mat(0xBFC8B0); items.push(null); return; }
        slotPads[i].material = mat(0xD8DEE4);
        const m = s.kind === 'drop' ? dropModel(s) : s.kind === 'coaster' ? coasterModel(s) : s.kind === 'solar' ? solarModel() : batteryModel();
        const [x, z] = SLOT_POS[i]; m.position.set(x, 0.2, z); root.add(m);
        if (s.name) { const sg = nameSign(s.name); sg.position.set(x, (s.kind === 'drop' ? s.H * S + 4 : Math.max(2.5, s.H * S) + 3), z); root.add(sg); }
        items.push({ g: m, s, sim: (s.kind === 'drop' || s.kind === 'coaster') && typeof simRide === 'function' ? simRide(s) : null });
      });
    }
    // 하루 결과 반영: 손님 수, 날씨, 정전, 배터리
    function setDay(o) {
      o = o || {};
      crowdN = Math.min(MAXC, Math.round((o.riders || 0) / 25));
      crowd.count = crowdN;
      const night = o.blackout; setSky(night ? 'night' : (o.weather || 'sun'));
      sun.intensity = night ? 0.25 : o.weather === 'rain' ? 0.5 : o.weather === 'cloud' ? 0.65 : 0.9;
      if (hemi) hemi.intensity = night ? 0.25 : 0.6;
      if (!rain && o.weather === 'rain') { const n = 300, gg = new T.BufferGeometry(), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 80; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 56; } gg.setAttribute('position', new T.BufferAttribute(pos, 3)); rain = new T.Points(gg, new T.PointsMaterial({ color: 0xBFD8EE, size: 0.25, transparent: true, opacity: 0.7 })); scene.add(rain); }
      if (rain) rain.visible = o.weather === 'rain';
      items.forEach(it => { if (it && it.s.kind === 'battery') { const lv = Math.round((o.battery || 0) / 15); it.g.userData.bars.forEach((b, i) => b.visible = i < lv); } });
    }
    // 시운전: 슬롯 i(없으면 모든 놀이기구)를 시뮬레이션 표본대로 움직인다
    function playTest(only) {
      const list = items.map((it, i) => ({ it, i })).filter(x => x.it && x.it.sim && (only == null || x.i === only));
      if (!list.length) return 0;
      play = { t: 0, list };
      return Math.max(...list.map(x => x.it.sim.samples[x.it.sim.samples.length - 1].t)) + 0.5;
    }
    function sampleAt(samples, t) { let a = samples[0]; for (const s of samples) { if (s.t > t) break; a = s; } return a; }
    function tick(dt, t) {
      // 손님
      for (let i = 0; i < crowdN; i++) {
        const c = cr[i]; c.a += dt * c.sp * 0.08;
        let x, z;
        if (c.lane === 0) { x = ((c.a * 10) % 62) - 31; z = 0.5 + c.off; }
        else { x = -9 + (c.lane - 1) * 18 + c.off; z = ((c.a * 10) % 34) - 16.5; }
        dummy.position.set(x, 0.6, z); dummy.rotation.y = c.a; dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix);
      }
      crowd.instanceMatrix.needsUpdate = true;
      if (rain && rain.visible) { const p = rain.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * 25; if (y < 0) y = 30; p.setY(i, y); } p.needsUpdate = true; }
      // 놀이기구
      const blink = Math.sin(t * 3.2) > 0.2;
      items.forEach((it, i) => {
        if (!it || !it.sim) return;
        const U = it.g.userData, active = play && play.list.some(x => x.i === i);
        if (U.kind === 'drop') {
          U.beacon.emissive.setHex(blink ? 0xFF2020 : 0x330000);
          U.ledMat.emissive.setRGB(0.5 + 0.3 * Math.sin(t * 2 + i), 0.42 + 0.25 * Math.sin(t * 2 + i), 0.15);
          const sm = it.sim.samples, dropT = sm[sm.length - 1].t;
          let y, gHeat = 0, spin = 0;
          if (active) { const s = sampleAt(sm, play.t); y = s.y; gHeat = s.g; }
          else {
            // 평소 운행: 탑승 3초 → 천천히 회전하며 올라감 7초 → 꼭대기에서 2초 → 떨어짐(시운전과 같은 그래프)
            U.cyc = (U.cyc + dt) % (12 + dropT);
            const c = U.cyc;
            if (c < 3) y = 0;
            else if (c < 10) { const f = (c - 3) / 7; y = U.Hm * (f * f * (3 - 2 * f)); spin = 0.35; }
            else if (c < 12) y = U.Hm;
            else { const s = sampleAt(sm, c - 12); y = s.y; gHeat = s.g; }
          }
          U.car.position.y = U.yOf(Math.max(0, y));
          U.car.rotation.y += dt * spin;
          if (gHeat > 0) { const heat = Math.min(1, gHeat / 4); U.copperMat.emissive.setRGB(heat * 0.9, heat * 0.35, 0); } else U.copperMat.emissive.multiplyScalar(0.95);
        } else if (U.kind === 'coaster') {
          if (active) {
            const s = sampleAt(it.sim.samples, play.t);
            let u;
            if (s.phase === 'hill') u = U.uTop + (U.b0 - U.uTop) * s.x; else if (s.phase === 'brake') u = U.b0 + (U.b1 - U.b0) * Math.min(1, s.x - 1); else u = U.b1 + 0.01;
            U.uu = u; placeTrain(it.g, u);
            const heat = Math.min(1, (s.g || 0) / 2); U.copperMat.emissive.setRGB(heat * 0.9, heat * 0.35, 0);
          } else {
            // 평소 운행: 승강장 정차 → 체인으로 천천히 오르기 → 높이에 따라 빨라지고(역학적 에너지) → 자석 구간에서 감속
            const u = U.uu, rel = x => ((x - U.uSt) % 1 + 1) % 1, ru = rel(u);
            let v;
            if (U.dwell > 0) { U.dwell -= dt; v = 0; }
            else if (ru < rel(U.uTop)) v = ru < rel(U.uLift0) ? 0.8 : 0.9;
            else if (ru < rel(U.b0)) { const y = U.F[Math.round(u * U.N) % U.N].p.y; v = Math.sqrt(Math.max(0.4, 2 * 9.8 * S * 1.6 * (U.h - y) + 0.6)); }
            else if (ru < rel(U.b1)) { const f = (ru - rel(U.b0)) / Math.max(0.001, rel(U.b1) - rel(U.b0)); v = 5 * (1 - f) + 0.7 * f; const heat = Math.min(1, (1 - f) * 0.8); U.copperMat.emissive.setRGB(heat * 0.9, heat * 0.35, 0); }
            else v = 0.7;
            if (!(ru >= rel(U.b0) && ru < rel(U.b1))) U.copperMat.emissive.multiplyScalar(0.95);
            const nu = (u + v * dt / U.L) % 1;
            if (rel(nu) < ru) { U.uu = U.uSt; U.dwell = 3; } else U.uu = nu;
            placeTrain(it.g, U.uu);
          }
        }
      });
      if (play) { play.t += dt; const end = Math.max(...play.list.map(x => x.it.sim.samples[x.it.sim.samples.length - 1].t)) + 1.2; if (play.t > end) play = null; }
    }
    function playState() { if (!play) return null; return play.list.map(x => { const s = sampleAt(x.it.sim.samples, play.t); return { i: x.i, kind: x.it.s.kind, v: s.v, g: s.g, y: s.y }; }); }
    function slotAt(point) { let best = -1, bd = 1e9; SLOT_POS.forEach(([x, z], i) => { const d = Math.hypot(point.x - x, point.z - z); if (d < 8 && d < bd) { bd = d; best = i; } }); return best; }
    function highlight(i) { slotPads.forEach((p, k) => { if (k === i) p.material = mat(0xFFD166); else p.material = park && park.slots[k] ? mat(0xD8DEE4) : mat(0xBFC8B0); }); }
    return { build, setDay, playTest, playState, tick, slotAt, highlight, SLOT_POS };
  }

  // ---------- 모둠 기기용 한 화면 ----------
  let V = null;
  function viewer() {
    if (V) return V;
    if (!T) return null;
    const el = document.createElement('div'); el.className = 'p3d';
    el.innerHTML = '<canvas aria-label="3D 놀이공원. 번호가 적힌 자리를 눌러 놀이기구를 고르세요"></canvas><div class="p3d-hud"></div>';
    const canvas = el.querySelector('canvas');
    let renderer; try { renderer = new T.WebGLRenderer({ canvas, antialias: true }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new T.Scene(); scene.fog = new T.Fog(0xD9ECF7, 90, 200);
    const hemi = new T.HemisphereLight(0xFFFFFF, 0x445544, 0.6); scene.add(hemi);
    const sun = new T.DirectionalLight(0xFFF2DD, 0.9); sun.position.set(25, 45, 20); scene.add(sun);
    const cam = new T.PerspectiveCamera(42, 1.5, 0.5, 400);
    const P = makeScene(scene, sun, hemi);
    const o = { theta: 0.6, phi: 0.95, r: 62 }, ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    const place = () => { cam.position.set(o.r * Math.sin(o.phi) * Math.sin(o.theta), o.r * Math.cos(o.phi), o.r * Math.sin(o.phi) * Math.cos(o.theta)); cam.lookAt(0, 3, 0); };
    let drag = null, moved = 0, onPick = null, last = 0, clock = 0, auto = true;
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); o.theta -= dx * 0.008; o.phi = Math.max(0.35, Math.min(1.3, o.phi - dy * 0.006)); drag = { x: e.clientX, y: e.clientY }; auto = false; place(); });
    canvas.addEventListener('pointerup', e => {
      if (drag && moved < 8 && onPick) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const p = new T.Vector3(); if (ray.ray.intersectPlane(plane, p)) { const i = P.slotAt(p); if (i >= 0) onPick(i); } }
      drag = null;
    });
    canvas.addEventListener('wheel', e => { e.preventDefault(); o.r = Math.max(30, Math.min(100, o.r * (1 + Math.sign(e.deltaY) * 0.1))); place(); }, { passive: false });
    function resize() { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < 560 ? 52 : 42; cam.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(el);
    const hud = el.querySelector('.p3d-hud');
    function frame(now) {
      requestAnimationFrame(frame);
      if (!el.isConnected || document.hidden) { last = now; return; }
      const dt = Math.min(0.05, ((now - last) / 1000) || 0.016); last = now; clock += dt;
      if (auto) { o.theta += dt * 0.05; place(); }
      P.tick(dt, clock); renderer.render(scene, cam);
      const ps = P.playState();
      hud.innerHTML = ps ? ps.map(x => `<div><b>${x.i + 1}번</b> 속도 ${x.v.toFixed(1)} m/s · 감속 ${x.g.toFixed(1)}g</div>`).join('') : '';
    }
    place(); requestAnimationFrame(frame);
    V = { el, park: P, onPick(f) { onPick = f; }, setAuto(a) { auto = a; } };
    return V;
  }
  return { makeScene, viewer, S, SLOT_POS };
})();

// ===== 전자칠판: 여러 모둠 공원을 한 캔버스에 나눠 그린다 =====
const ParkBoard = (function () {
  const T = window.THREE;
  let renderer = null, canvas = null, last = 0, clock = 0, raf = 0;
  const views = new Map();
  function init(container) {
    if (!T) return false;
    if (renderer && canvas.isConnected) return true;
    canvas = document.createElement('canvas'); canvas.className = 'board-gl'; canvas.setAttribute('aria-hidden', 'true'); container.appendChild(canvas);
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor(0, 0);
    views.clear(); if (!raf) raf = requestAnimationFrame(frame);
    return true;
  }
  function makeView(el) {
    const scene = new T.Scene(); scene.fog = new T.Fog(0xD9ECF7, 90, 200);
    const hemi = new T.HemisphereLight(0xFFFFFF, 0x445544, 0.6); scene.add(hemi);
    const sun = new T.DirectionalLight(0xFFF2DD, 0.9); sun.position.set(25, 45, 20); scene.add(sun);
    return { el, scene, P: Park3D.makeScene(scene, sun, hemi), cam: new T.PerspectiveCamera(42, 1.4, 0.5, 400), theta: Math.random() * 6 };
  }
  // list: [{ id, el, park, day:{riders, weather, blackout, battery} }]
  function sync(list) {
    if (!renderer) return;
    const seen = new Set();
    for (const g of list) { seen.add(g.id); let v = views.get(g.id); if (!v) { v = makeView(g.el); views.set(g.id, v); } v.el = g.el; v.P.build(g.park); v.P.setDay(g.day); }
    for (const id of [...views.keys()]) if (!seen.has(id)) views.delete(id);
  }
  function playAll() { let d = 0; for (const v of views.values()) d = Math.max(d, v.P.playTest()); return d; }
  function playState(id) { const v = views.get(id); return v ? v.P.playState() : null; }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!renderer || !canvas.isConnected || document.hidden) { last = now; return; }
    if (now - last < 31) return;
    const dt = Math.min(0.08, ((now - last) / 1000) || 0.033); last = now; clock += dt;
    const cr = canvas.getBoundingClientRect(), w = Math.round(cr.width), h = Math.round(cr.height); if (!w || !h) return;
    const pr = renderer.getPixelRatio(); if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) renderer.setSize(w, h, false);
    renderer.setScissorTest(false); renderer.setClearColor(0, 0); renderer.clear(); renderer.setScissorTest(true);
    for (const v of views.values()) {
      if (!v.el || !v.el.isConnected) continue;
      const r = v.el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < cr.top || r.top > cr.bottom) continue;
      const x = r.left - cr.left, y = cr.bottom - r.bottom;
      renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(x, y, r.width, r.height);
      v.theta += dt * 0.06; v.cam.aspect = r.width / r.height; v.cam.updateProjectionMatrix();
      const R = 66, phi = 0.9; v.cam.position.set(R * Math.sin(phi) * Math.sin(v.theta), R * Math.cos(phi), R * Math.sin(phi) * Math.cos(v.theta)); v.cam.lookAt(0, 3, 0);
      v.P.tick(dt, clock); renderer.render(v.scene, v.cam);
    }
  }
  return { init, sync, playAll, playState, available: () => !!T };
})();
