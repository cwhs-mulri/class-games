// ===== 3D 서식지 + 60초 준비 아레나 (Three.js r128) =====
const World3D = (function () {
  const T = window.THREE;
  let failed = !T, inited = false;
  let stage, canvas, renderer, scene, camera, sun, hemi, root, popGroup, arenaGroup;
  let biome = null, B = null, mode = 'diorama', autoRot = true;
  const cam = { theta: 0.95, phi: 0.92, r: 64, tx: 0, tz: -1 };
  let clock = 0, last = 0, lastReal = 0;
  const matCache = {};
  const mat = (c, o) => { const k = c + JSON.stringify(o || {}); return matCache[k] || (matCache[k] = new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}))); };
  const lerpC = (a, b, k) => new T.Color(a).lerp(new T.Color(b), Math.max(0, Math.min(1, k)));
  function srand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function mesh(geo, m, x, y, z) { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; }
  function sph(r, m, x, y, z, sx, sy, sz) { const o = mesh(new T.SphereGeometry(r, 14, 10), m, x, y, z); if (sx) o.scale.set(sx, sy, sz); return o; }

  const SKIES = {
    bear:    { sky: 0xC9E0EE, water: 0x1B4F72 },
    penguin: { sky: 0xD3E3F0, water: 0x1E4C74 },
    coral:   { sky: 0x9BD8EE, water: 0x1597B5 },
    pollock: { sky: 0xA9C6DE, water: 0x154A84 },
  };

  // ---------- 동물 모델 ----------
  function bearModel() {
    const g = new T.Group(), w = mat(0xF3EEE2), w2 = mat(0xE6DECB), k = mat(0x1B1B1B);
    g.add(sph(1, w, 0, 0.98, 0, 1.5, 0.95, 0.9));
    g.add(sph(0.56, w, 1.35, 1.3, 0));
    g.add(sph(0.3, w2, 1.82, 1.18, 0));
    g.add(sph(0.09, k, 2.1, 1.25, 0));
    g.add(sph(0.06, k, 1.62, 1.5, 0.22)); g.add(sph(0.06, k, 1.62, 1.5, -0.22));
    g.add(sph(0.15, w, 1.22, 1.78, 0.3)); g.add(sph(0.15, w, 1.22, 1.78, -0.3));
    for (const [x, z] of [[0.8, 0.42], [0.8, -0.42], [-0.8, 0.42], [-0.8, -0.42]]) g.add(mesh(new T.CylinderGeometry(0.24, 0.22, 0.75, 8), w, x, 0.38, z));
    return g;
  }
  function penguinModel() {
    const g = new T.Group(), b = mat(0x1E2430), w = mat(0xF7F7F2), o = mat(0xF29A2E), y = mat(0xF8C537);
    g.add(sph(1, b, 0, 0.95, 0, 0.55, 0.95, 0.5));
    g.add(sph(1, w, 0.2, 0.85, 0, 0.4, 0.78, 0.36));
    g.add(sph(0.36, b, 0.05, 1.85, 0));
    const beak = mesh(new T.ConeGeometry(0.07, 0.38, 8), o, 0.44, 1.8, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
    g.add(sph(0.1, y, 0.22, 1.72, 0.25)); g.add(sph(0.1, y, 0.22, 1.72, -0.25));
    g.add(mesh(new T.BoxGeometry(0.3, 0.06, 0.18), o, 0.12, 0.04, 0.16)); g.add(mesh(new T.BoxGeometry(0.3, 0.06, 0.18), o, 0.12, 0.04, -0.16));
    for (const s of [1, -1]) { const f = sph(1, b, -0.02, 1.05, 0.48 * s, 0.14, 0.55, 0.06); f.rotation.x = 0.25 * s; g.add(f); }
    return g;
  }
  function fishModel(col) {
    const g = new T.Group(), m = mat(col || 0x8C7A55), belly = mat(0xD9CFB4), k = mat(0x111111);
    g.add(sph(1, m, 0, 0, 0, 1.25, 0.38, 0.3));
    g.add(sph(1, belly, 0.1, -0.12, 0, 1.0, 0.22, 0.26));
    const tail = mesh(new T.ConeGeometry(0.38, 0.7, 4), m, -1.45, 0, 0); tail.rotation.z = Math.PI / 2; tail.scale.z = 0.25; g.add(tail);
    const fin = mesh(new T.ConeGeometry(0.2, 0.5, 4), m, -0.1, 0.38, 0); fin.scale.z = 0.2; g.add(fin);
    g.add(sph(0.07, k, 0.95, 0.08, 0.2)); g.add(sph(0.07, k, 0.95, 0.08, -0.2));
    g.userData.tail = tail;
    return g;
  }
  function larvaModel() {
    const g = new T.Group(), m = new T.MeshLambertMaterial({ color: 0xFF8CC0, emissive: 0xFF4F9A, emissiveIntensity: 0.6 });
    g.add(sph(0.5, m, 0, 0.5, 0, 1.3, 1, 1));
    for (let i = 1; i <= 3; i++) g.add(sph(0.28 - i * 0.05, m, -0.55 - i * 0.42, 0.5, 0));
    return g;
  }
  function starfishModel() {
    const g = new T.Group(), m = mat(0x7B3FA0), s = mat(0xC86BFA);
    g.add(sph(0.7, m, 0, 0.35, 0, 1, 0.45, 1));
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const c = mesh(new T.ConeGeometry(0.12, 0.6, 5), s, Math.cos(a) * 0.65, 0.4, Math.sin(a) * 0.65); c.rotation.z = -Math.cos(a) * 1.2; c.rotation.x = Math.sin(a) * 1.2; g.add(c); }
    return g;
  }
  function sealModel(dark) {
    const g = new T.Group(), m = mat(dark ? 0x3A4049 : 0x8D949C), k = mat(0x111111);
    g.add(sph(1, m, 0, 0.35, 0, 1.4, 0.45, 0.55));
    g.add(sph(0.38, m, 1.25, 0.5, 0));
    g.add(sph(0.06, k, 1.5, 0.6, 0.15)); g.add(sph(0.06, k, 1.5, 0.6, -0.15));
    return g;
  }
  function coralHead(r) {
    const g = new T.Group();
    const pal = [0xFF6F91, 0xFF9F43, 0xA66CFF, 0xFFD166, 0x3FD0C0, 0xF15BB5, 0x7BD389];
    const col = pal[Math.floor(r() * pal.length)];
    const m = new T.MeshLambertMaterial({ color: col });
    const type = Math.floor(r() * 3);
    if (type === 0) { // 가지형
      for (let i = 0; i < 5; i++) { const c = mesh(new T.CylinderGeometry(0.08, 0.16, 1.2 + r() * 0.8, 6), m, (r() - 0.5) * 0.8, 0.6, (r() - 0.5) * 0.8); c.rotation.z = (r() - 0.5) * 0.9; c.rotation.x = (r() - 0.5) * 0.9; g.add(c); }
    } else if (type === 1) { // 뇌산호
      g.add(sph(0.75, m, 0, 0.35, 0, 1, 0.65, 1));
    } else { // 탁자형
      g.add(mesh(new T.CylinderGeometry(0.15, 0.2, 0.7, 6), m, 0, 0.35, 0));
      g.add(mesh(new T.CylinderGeometry(1.0, 0.9, 0.18, 10), m, 0, 0.75, 0));
    }
    g.userData = { m, col };
    return g;
  }

  // ---------- 아이템 아이콘 ----------
  const iconCache = {};
  function iconMat(kind) {
    if (iconCache[kind]) return iconCache[kind];
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
    const special = ['den', 'colony', 'symb', 'spawn'].includes(kind);
    x.fillStyle = special ? '#22C55E' : '#FFC23D'; x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.fill();
    x.lineWidth = 7; x.strokeStyle = '#ffffff'; x.stroke();
    x.fillStyle = '#ffffff'; x.strokeStyle = '#ffffff'; x.lineCap = 'round'; x.lineJoin = 'round';
    if (kind === 'seal' || kind === 'fish') { x.beginPath(); x.ellipse(60, 66, 30, 15, -0.15, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(30, 66); x.lineTo(14, 50); x.lineTo(14, 82); x.closePath(); x.fill(); x.fillStyle = special ? '#22C55E' : '#FFC23D'; x.beginPath(); x.arc(78, 60, 4, 0, Math.PI * 2); x.fill(); }
    else if (kind === 'krill') { x.lineWidth = 11; x.beginPath(); x.arc(64, 60, 26, 0.3, Math.PI - 0.1); x.stroke(); x.lineWidth = 4; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(50 + i * 9, 84); x.lineTo(46 + i * 9, 96); x.stroke(); } }
    else if (kind === 'plankton') { for (const [px, py, r] of [[48, 50, 10], [76, 46, 8], [64, 72, 12], [44, 80, 7], [84, 76, 9]]) { x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); } }
    else if (kind === 'den') { x.beginPath(); x.arc(64, 82, 34, Math.PI, 0); x.closePath(); x.fill(); x.fillStyle = '#22C55E'; x.beginPath(); x.arc(64, 82, 13, Math.PI, 0); x.fill(); }
    else if (kind === 'colony') { x.beginPath(); x.ellipse(64, 70, 18, 30, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(64, 36, 13, 0, Math.PI * 2); x.fill(); }
    else if (kind === 'symb') { x.beginPath(); x.ellipse(64, 64, 16, 32, 0.7, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#22C55E'; x.lineWidth = 4; x.beginPath(); x.moveTo(50, 80); x.lineTo(78, 48); x.stroke(); }
    else if (kind === 'spawn') { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 15 : 34; x.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r); } x.closePath(); x.fill(); }
    return (iconCache[kind] = new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: true, depthWrite: false, alphaTest: 0.1 }));
  }

  // ---------- 바이옴 ----------
  function clearRoot() {
    if (root) { scene.remove(root); }
    root = new T.Group(); scene.add(root);
    popGroup = new T.Group(); root.add(popGroup);
    B = { pops: [] };
  }
  function waterPlane(color, opacity) {
    const m = new T.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    const w = new T.Mesh(new T.PlaneGeometry(240, 240), m); w.rotation.x = -Math.PI / 2; w.receiveShadow = true; root.add(w); B.waterMat = m; return w;
  }
  function buildBiome(key) {
    clearRoot(); biome = key;
    const r = srand(key.length * 97 + 7);
    const S = SKIES[key];
    if (key === 'bear') {
      waterPlane(S.water, 1);
      B.landMat = new T.MeshLambertMaterial({ color: 0xF2F6F8 });
      root.add(mesh(new T.BoxGeometry(90, 2, 16), B.landMat, 0, 0.5, -25));
      for (let i = 0; i < 7; i++) { const h = 3 + r() * 4; root.add(mesh(new T.ConeGeometry(4 + r() * 3, h, 7), B.landMat, -36 + i * 12 + r() * 4, 1.5 + h / 2, -27 - r() * 4)); }
      B.floes = [];
      let tries = 0;
      while (B.floes.length < 24 && tries < 900) {
        tries++; const rad = 1.8 + r() * 2.6, x = -25 + r() * 50, z = -14 + r() * 29;
        if (B.floes.some(f => Math.hypot(f.x - x, f.z - z) < f.r + rad + 0.6)) continue;
        const m = mesh(new T.CylinderGeometry(rad, rad * 1.08, 0.5, 7), mat(0xEAF4F8), x, 0.18, z); m.rotation.y = r() * 3;
        root.add(m); B.floes.push({ mesh: m, x, z, r: rad, k: 1, ph: r() * 6 });
      }
      B.floes.sort((a, b) => a.z - b.z); // 북쪽(음수 z) 먼저 남음
    } else if (key === 'penguin') {
      waterPlane(S.water, 1);
      root.add(mesh(new T.BoxGeometry(90, 5, 10), mat(0xDCEAF3), 0, 2.5, -26));
      B.slab = mesh(new T.BoxGeometry(70, 0.7, 1), mat(0xEEF5FA), 0, 0.3, -14);
      root.add(B.slab);
      B.bergs = [];
      for (let i = 0; i < 7; i++) { const b = mesh(new T.BoxGeometry(2 + r() * 3, 1.5 + r() * 2.5, 2 + r() * 3), mat(0xD6E9F5), -24 + r() * 48, 0.6, 2 + r() * 13); b.rotation.y = r() * 3; root.add(b); B.bergs.push(b); }
    } else if (key === 'coral') {
      { const sb = mesh(new T.PlaneGeometry(240, 240), mat(0xCDBB8C), 0, -2.6, 0); sb.rotation.x = -Math.PI / 2; root.add(sb); }
      waterPlane(S.water, 0.38);
      root.add(mesh(new T.CylinderGeometry(6, 8, 3, 18), mat(0xF0E0B5), 30, -1.2, -20));
      B.corals = [];
      for (let i = 0; i < 46; i++) {
        const h = coralHead(r); const x = -26 + r() * 52, z = -15 + r() * 30;
        h.position.set(x, -2.6, z); h.scale.setScalar(0.9 + r() * 0.8); h.rotation.y = r() * 6; root.add(h);
        B.corals.push({ g: h, rank: r() });
      }
      B.reefFish = [];
      for (let i = 0; i < 9; i++) { const f = fishModel([0xFFB703, 0x3A86FF, 0xFB5607][i % 3]); f.scale.setScalar(0.45); root.add(f); B.reefFish.push({ g: f, a: r() * 6, rad: 6 + r() * 14, y: -1.4 + r() * 0.8, sp: 0.3 + r() * 0.4, cx: (r() - 0.5) * 20, cz: (r() - 0.5) * 14 }); }
    } else if (key === 'pollock') {
      { const sb = mesh(new T.PlaneGeometry(240, 240), mat(0x0E2A45), 0, -4, 0); sb.rotation.x = -Math.PI / 2; root.add(sb); }
      waterPlane(S.water, 0.62);
      B.landMat = new T.MeshLambertMaterial({ color: 0x5E8A4E });
      root.add(mesh(new T.BoxGeometry(14, 3, 90), B.landMat, -33, 1, 0));
      for (let i = 0; i < 6; i++) { const h = 3 + r() * 4; root.add(mesh(new T.ConeGeometry(3 + r() * 2, h, 6), B.landMat, -35 + r() * 4, 2.5 + h / 2, -30 + i * 12)); }
      B.cold = new T.Mesh(new T.PlaneGeometry(52, 1), new T.MeshBasicMaterial({ color: 0x8FDBFF, transparent: true, opacity: 0.28, depthWrite: false }));
      B.cold.rotation.x = -Math.PI / 2; B.cold.position.set(0, 0.06, 0); root.add(B.cold);
      B.warm = new T.Mesh(new T.PlaneGeometry(52, 1), new T.MeshBasicMaterial({ color: 0xFF8A3D, transparent: true, opacity: 0.26, depthWrite: false }));
      B.warm.rotation.x = -Math.PI / 2; B.warm.position.set(0, 0.07, 0); root.add(B.warm);
      B.fishes = [];
    }
    scene.background = new T.Color(S.sky); scene.fog.color = new T.Color(S.sky);
  }
  function setEdge(edge) { // 명태: edge보다 북쪽(z 작음)은 찬물
    const zmin = -16, zmax = 16, e = Math.max(zmin, Math.min(zmax, edge));
    const ch = e - zmin, wh = zmax - e;
    B.cold.visible = ch > 0.05; B.warm.visible = wh > 0.05;
    if (B.cold.visible) { B.cold.scale.y = ch; B.cold.position.z = zmin + ch / 2; }
    if (B.warm.visible) { B.warm.scale.y = wh; B.warm.position.z = e + wh / 2; }
    B.edge = e;
  }
  function setSlab(depth) { B.slab.scale.z = depth; B.slab.position.z = -21 + depth / 2; B.iceEdge = -21 + depth; }

  // ---------- 상태 반영 (일지 단계) ----------
  function populate(n, maker, placer) {
    while (B.pops.length > n) { const p = B.pops.pop(); popGroup.remove(p.g); }
    while (B.pops.length < n) { const g = maker(); popGroup.add(g); B.pops.push({ g, i: B.pops.length, ph: Math.random() * 6 }); }
    B.pops.forEach((p, i) => placer(p, i));
  }
  function setState(o) {
    if (!inited || mode !== 'diorama') return;
    const hab = o.hab / 100, popF = o.pop / 100, Tk = (o.T - 1.2) / 3.8;
    const S = SKIES[biome];
    const sky = lerpC(S.sky, 0xE6B98E, Tk * 0.75);
    scene.background = sky; scene.fog.color = sky;
    sun.intensity = 0.85 + Tk * 0.2;
    if (biome === 'bear') {
      const n = Math.round(B.floes.length * hab);
      B.floes.forEach((f, i) => { f.mesh.visible = i < n; f.k = 0.55 + 0.45 * hab; f.mesh.scale.set(f.k, 1, f.k); });
      B.landMat.color = lerpC(0xF2F6F8, 0x8C8A6A, Tk * 1.2);
      const vis = B.floes.filter(f => f.mesh.visible).sort((a, b) => b.r - a.r);
      populate(Math.min(8, Math.ceil(o.pop / 12)), bearModel, (p, i) => {
        const f = vis[i % Math.max(1, vis.length)];
        if (f) p.g.position.set(f.x + (i >= vis.length ? 1 : 0), 0.43, f.z); else p.g.position.set(-14 + i * 4, 1.5, -19);
        p.g.rotation.y = i * 1.7; p.g.scale.setScalar(i % 3 === 2 ? 0.6 : 0.9);
      });
    } else if (biome === 'penguin') {
      setSlab(2 + 11 * hab);
      B.bergs.forEach((b, i) => b.visible = i < 3 + Math.round(4 * (1 - hab)));
      const n = Math.min(16, Math.ceil(o.pop / 6));
      populate(n, penguinModel, (p, i) => {
        const cols = 8, x = -12 + (i % cols) * 3.2 + (Math.floor(i / cols) % 2) * 1.6, z = -19 + Math.floor(i / cols) * 2.2;
        p.g.position.set(x, 0.65, Math.min(z, B.iceEdge - 0.8)); p.g.rotation.y = -Math.PI / 2 + (i % 3 - 1) * 0.3; p.g.scale.setScalar(i % 4 === 3 ? 0.55 : 0.85);
      });
    } else if (biome === 'coral') {
      const health = o.health / 100;
      const sorted = B.corals.slice().sort((a, b) => a.rank - b.rank);
      const alive = Math.round(sorted.length * Math.min(1, popF * 1.15));
      const healthyN = Math.round(alive * health);
      sorted.forEach((c, i) => {
        const m = c.g.userData.m;
        if (i < healthyN) { m.color.set(c.g.userData.col); c.g.visible = true; c.g.scale.y = c.g.scale.x; }
        else if (i < alive) { m.color.set(0xF6F3EC); c.g.visible = true; }
        else { m.color.set(0x7A6E62); c.g.visible = true; }
      });
      B.waterMat.color = lerpC(S.water, 0x5FA39A, Tk);
      B.reefFish.forEach((f, i) => f.g.visible = i < Math.round(9 * popF * health + 1));
    } else if (biome === 'pollock') {
      setEdge(-16 + 32 * hab);
      B.waterMat.color = lerpC(S.water, 0x2A6E8A, Tk);
      const n = Math.min(16, Math.ceil(o.pop / 6));
      populate(n, () => fishModel(), (p, i) => { p.cx = -6 + (i % 4) * 3; p.cz = Math.min(B.edge - 3, -12 + Math.floor(i / 4) * 2); p.g.scale.setScalar(0.7); });
    }
  }

  // ---------- 카메라 · 조작 ----------
  function placeCamera() {
    const { theta, phi, r, tx, tz } = cam;
    camera.position.set(tx + r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), tz + r * Math.sin(phi) * Math.sin(theta));
    camera.lookAt(tx, 0, tz);
  }
  function arenaCamera() {
    const asp = camera.aspect || 1.6, half = 27;
    const deep0 = A.key === 'bear' || A.key === 'penguin';
    if (asp < 0.9) { // 세로 화면: 아레나를 90° 돌려서 길게 보기
      const tanH = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      const dW = (deep0 ? 22 : 17) / tanH / asp, dV = 26 / tanH;
      const d = Math.max(dW, dV) * 1.02, cz = deep0 ? -2.5 : 0;
      camera.position.set(d * 0.4, d * 0.92, cz); camera.lookAt(-0.5, 0, cz);
      return;
    }
    const needH = half / Math.tan(T.MathUtils.degToRad(camera.fov / 2)) / asp;
    const deep = A.key === 'bear' || A.key === 'penguin';
    const needV = (deep ? 21 : 18) / Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(needH, needV) * 1.04, cz = deep ? -3 : 0;
    camera.position.set(0, d * 0.9, cz + d * 0.42); camera.lookAt(0, 0, cz - 1.2);
  }
  const ray = T ? new T.Raycaster() : null, ndc = T ? new T.Vector2() : null, plane = T ? new T.Plane(new T.Vector3(0, 1, 0), 0) : null;
  function groundPoint(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const p = new T.Vector3();
    return ray.ray.intersectPlane(plane, p) ? p : null;
  }
  function bindControls() {
    let drag = null;
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      if (mode === 'arena') { const p = groundPoint(e.clientX, e.clientY); if (p) A.target = p; A.pointer = true; return; }
      drag = { x: e.clientX, y: e.clientY }; autoRotPaused = true;
    });
    canvas.addEventListener('pointermove', e => {
      if (mode === 'arena') { if (A.pointer) { const p = groundPoint(e.clientX, e.clientY); if (p) A.target = p; } return; }
      if (!drag) return;
      cam.theta += (e.clientX - drag.x) * 0.008; cam.phi = Math.max(0.35, Math.min(1.3, cam.phi - (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY }; placeCamera();
    });
    const up = () => { drag = null; if (mode === 'arena') A.pointer = false; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { if (mode === 'arena') return; e.preventDefault(); cam.r = Math.max(30, Math.min(110, cam.r * (1 + Math.sign(e.deltaY) * 0.1))); placeCamera(); }, { passive: false });
    window.addEventListener('keydown', e => { if (mode !== 'arena') return; const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { A.keys[k] = true; A.target = null; e.preventDefault(); } });
    window.addEventListener('keyup', e => { if (A.keys) A.keys[e.key.toLowerCase()] = false; });
  }
  let autoRotPaused = false;

  // ---------- 60초 아레나 ----------
  let A = {};
  const BOUND = { x: 24, z: 15 };
  function startArena(key, cbs) {
    if (!init()) { cbs.onEnd({ food: 8, special: 1, damage: 15, skipped: true }); return; }
    buildBiome(key); mode = 'arena';
    arenaGroup = new T.Group(); root.add(arenaGroup);
    popGroup.clear && popGroup.clear(); B.pops = [];
    const r = srand(Date.now() & 0xffff);
    A = { key, r, cbs, t: 0, dur: 60, food: 0, special: 0, damage: 0, inv: 0, keys: {}, target: null, pointer: false, items: [], hazards: [], status: '', ended: false };
    // 플레이어
    let pm;
    if (key === 'bear') { pm = bearModel(); pm.scale.setScalar(1.15); const f = B.floes[Math.floor(B.floes.length / 2)]; A.pos = new T.Vector3(f.x, 0, f.z); }
    else if (key === 'penguin') { pm = penguinModel(); pm.scale.setScalar(1.2); A.pos = new T.Vector3(0, 0, -15); setSlab(13); }
    else if (key === 'coral') { pm = larvaModel(); pm.scale.setScalar(1.1); A.pos = new T.Vector3(0, 0, 8); }
    else { pm = fishModel(); pm.scale.setScalar(1.2); A.pos = new T.Vector3(0, 0, -6); setEdge(16); }
    A.player = pm; arenaGroup.add(pm);
    // 특별 아이템
    const sk = { bear: 'den', penguin: 'colony', coral: 'symb', pollock: 'spawn' }[key];
    const spots = { bear: [[-14, -19], [13, -19]], penguin: [[-17, -18.5], [16, -18.5]], coral: [[-20, -10], [18, -11], [-16, 11], [20, 9], [0, -12]], pollock: [[-21, -12], [-21, -2]] }[key];
    spots.forEach(([x, z]) => addItem(sk, x, z, true));
    for (let i = 0; i < 9; i++) spawnFood();
    // 위험 요소
    if (key === 'penguin') for (let i = 0; i < 2; i++) { const g = sealModel(true); g.scale.setScalar(1.1); arenaGroup.add(g); A.hazards.push({ g, x: -10 + i * 20, z: 8, vx: 0, vz: 0, kind: 'seal' }); }
    if (key === 'coral') {
      for (let i = 0; i < 3; i++) { const m = new T.Mesh(new T.CylinderGeometry(1, 1, 0.1, 28), new T.MeshBasicMaterial({ color: 0xFF4D2E, transparent: true, opacity: 0.32, depthWrite: false })); const x = [-10, 12, 2][i], z = [4, -4, 11][i]; m.position.set(x, 0.12, z); arenaGroup.add(m); A.hazards.push({ g: m, x, z, kind: 'heat', r0: 2.5 }); }
      for (let i = 0; i < 2; i++) { const g = starfishModel(); arenaGroup.add(g); A.hazards.push({ g, x: i ? 18 : -18, z: i ? 10 : -10, kind: 'star' }); }
    }
    if (key === 'pollock') for (let i = 0; i < 2; i++) {
      const g = new T.Group(); const m = new T.MeshBasicMaterial({ color: 0xDDE6EE, transparent: true, opacity: 0.55, wireframe: true });
      g.add(new T.Mesh(new T.BoxGeometry(10, 1.2, 1.4, 10, 2, 2), m));
      g.add(mesh(new T.BoxGeometry(10.4, 0.15, 0.15), mat(0xF4A261), 0, 0.65, 0));
      arenaGroup.add(g); A.hazards.push({ g, x: i ? 10 : -10, z: i ? 6 : -4, kind: 'net', dir: i ? -1 : 1 });
    }
    arenaCamera();
  }
  function addItem(kind, x, z, special) {
    const s = new T.Sprite(iconMat(kind)); s.scale.set(2.1, 2.1, 1); s.position.set(x, 1.2, z); s.renderOrder = 5; arenaGroup.add(s);
    A.items.push({ s, kind, x, z, special, ph: Math.random() * 6, floe: null });
  }
  function spawnFood() {
    const key = A.key, r = A.r;
    for (let tries = 0; tries < 40; tries++) {
      let x = -BOUND.x + r() * BOUND.x * 2, z = -BOUND.z + r() * BOUND.z * 2, floe = null;
      if (key === 'bear') { const live = B.floes.filter(f => f.r * f.k > 1.4); if (!live.length) return; floe = live[Math.floor(r() * live.length)]; const a = r() * 6.28; x = floe.x + Math.cos(a) * floe.r * floe.k * 0.55; z = floe.z + Math.sin(a) * floe.r * floe.k * 0.55; }
      else if (key === 'penguin') { if (z < (B.iceEdge || -8) + 1.5) continue; }
      else if (key === 'coral') { if (A.hazards.some(h => h.kind === 'heat' && Math.hypot(h.x - x, h.z - z) < h.g.scale.x + 1)) continue; }
      else if (key === 'pollock') { if (z > (B.edge ?? 16) - 1 && r() < 0.85) continue; if (x < -21) continue; }
      if (Math.hypot(x - A.pos.x, z - A.pos.z) < 4) continue;
      const kind = { bear: 'seal', penguin: 'krill', coral: 'plankton', pollock: 'plankton' }[key];
      addItem(kind, x, z, false); const it = A.items[A.items.length - 1]; if (floe) { it.floe = floe; it.ox = x - floe.x; it.oz = z - floe.z; }
      return;
    }
  }
  function onIceBear(x, z) {
    if (z < -17.2) return true;
    return B.floes.some(f => Math.hypot(f.x - x, f.z - z) < f.r * f.k * 0.98);
  }
  function arenaFrame(dt, realDt) {
    if (A.ended) return;
    A.t += realDt; const prog = Math.min(1, A.t / A.dur), key = A.key;
    // 환경 변화
    if (key === 'bear') B.floes.forEach(f => { f.k = 1 - 0.5 * prog; f.mesh.scale.set(f.k, 1, f.k); });
    if (key === 'penguin') setSlab(13 - 6 * prog);
    if (key === 'pollock') setEdge(16 - 19 * prog);
    // 이동
    let vx = 0, vz = 0;
    const k = A.keys;
    if (k.arrowleft || k.a) vx -= 1; if (k.arrowright || k.d) vx += 1; if (k.arrowup || k.w) vz -= 1; if (k.arrowdown || k.s) vz += 1;
    if (!vx && !vz && A.target) { const dx = A.target.x - A.pos.x, dz = A.target.z - A.pos.z, d = Math.hypot(dx, dz); if (d > 0.4) { vx = dx / d; vz = dz / d; } }
    const len = Math.hypot(vx, vz) || 1; vx /= len; vz /= len;
    let speed = 9, status = '';
    let inWater = false;
    if (key === 'bear') { inWater = !onIceBear(A.pos.x, A.pos.z); if (inWater) { speed = 4.5; A.damage += 2.4 * dt; status = '차가운 물속 · 체력이 줄어요'; } }
    if (key === 'penguin') { inWater = A.pos.z > B.iceEdge; speed = inWater ? 11 : 5; status = inWater ? '바다 · 빠르게 헤엄쳐요' : '얼음 위 · 뒤뚱뒤뚱 느려요'; }
    if (key === 'coral') { speed = 8; for (const h of A.hazards) if (h.kind === 'heat' && Math.hypot(h.x - A.pos.x, h.z - A.pos.z) < h.g.scale.x) { A.damage += 5 * dt; status = '뜨거운 물 · 백화 위험!'; } }
    if (key === 'pollock') { if (A.pos.z > B.edge) { A.damage += 3 * dt; status = '따뜻한 물 · 체력이 줄어요'; speed = 7; } }
    A.pos.x = Math.max(-BOUND.x, Math.min(BOUND.x, A.pos.x + vx * speed * dt));
    A.pos.z = Math.max(-BOUND.z - (key === 'bear' ? 5 : key === 'penguin' ? 5 : 0), Math.min(BOUND.z, A.pos.z + vz * speed * dt));
    if (key === 'pollock') A.pos.x = Math.max(-21.5, A.pos.x);
    // 플레이어 표시
    const p = A.player;
    let y = 0.3;
    if (key === 'bear') y = inWater ? -0.55 : (A.pos.z < -17.2 ? 1.5 : 0.43);
    if (key === 'penguin') { y = inWater ? 0.05 : 0.65; p.rotation.z = inWater ? -1.35 : 0; }
    if (key === 'coral') y = 0.2 + Math.sin(clock * 3) * 0.12;
    if (key === 'pollock') y = 0.25;
    p.position.set(A.pos.x, y, A.pos.z);
    if (vx || vz) p.rotation.y = Math.atan2(-vz, vx);
    p.visible = A.inv <= 0 || Math.floor(clock * 12) % 2 === 0;
    if (A.inv > 0) A.inv -= dt;
    // 아이템
    for (const it of A.items) {
      if (it.dead) continue;
      if (it.floe) { it.x = it.floe.x + it.ox * it.floe.k; it.z = it.floe.z + it.oz * it.floe.k; if (it.floe.r * it.floe.k < 1.2) { it.dead = true; arenaGroup.remove(it.s); continue; } }
      it.s.position.set(it.x, 1.25 + Math.sin(clock * 3 + it.ph) * 0.2, it.z);
      if (it.special) { const sc = 2.3 + Math.sin(clock * 4 + it.ph) * 0.2; it.s.scale.set(sc, sc, 1); }
      if (Math.hypot(it.x - A.pos.x, it.z - A.pos.z) < 1.7) {
        it.dead = true; arenaGroup.remove(it.s);
        if (it.special) A.special++; else A.food++;
        if (A.cbs.onPick) A.cbs.onPick(it.special);
      }
    }
    A.items = A.items.filter(i => !i.dead || i.special);
    const alive = A.items.filter(i => !i.dead && !i.special).length;
    if (alive < 8 && Math.random() < dt * 3) spawnFood();
    // 위험 요소
    for (const h of A.hazards) {
      if (h.kind === 'seal') {
        const pin = A.pos.z > B.iceEdge, d = Math.hypot(A.pos.x - h.x, A.pos.z - h.z);
        let tx, tz, sp;
        if (pin && d < 15) { tx = A.pos.x; tz = A.pos.z; sp = 6.3; } else { h.wa = (h.wa || Math.random() * 6) + dt * 0.5; tx = h.x + Math.cos(h.wa) * 5; tz = h.z + Math.sin(h.wa) * 5; sp = 3; }
        const dx = tx - h.x, dz = tz - h.z, dl = Math.hypot(dx, dz) || 1;
        h.x += dx / dl * sp * dt; h.z = Math.max(B.iceEdge + 1, h.z + dz / dl * sp * dt);
        h.x = Math.max(-BOUND.x, Math.min(BOUND.x, h.x)); h.z = Math.min(BOUND.z, h.z);
        h.g.position.set(h.x, -0.05, h.z); h.g.rotation.y = Math.atan2(-dz, dx);
        if (d < 1.8 && A.inv <= 0) hit(12, '표범물범에게 물렸어요!');
      } else if (h.kind === 'heat') {
        const rr = h.r0 + prog * 5.5; h.g.scale.set(rr, 1, rr);
      } else if (h.kind === 'star') {
        const dx = A.pos.x - h.x, dz = A.pos.z - h.z, d = Math.hypot(dx, dz) || 1;
        h.x += dx / d * 2.4 * dt; h.z += dz / d * 2.4 * dt; h.g.position.set(h.x, 0, h.z); h.g.rotation.y += dt;
        if (d < 1.6 && A.inv <= 0) hit(12, '왕관불가사리에게 뜯겼어요!');
      } else if (h.kind === 'net') {
        h.x += h.dir * 5 * dt; if (Math.abs(h.x) > 18) h.dir *= -1;
        h.g.position.set(h.x, 0.35, h.z);
        if (Math.abs(A.pos.x - h.x) < 5.3 && Math.abs(A.pos.z - h.z) < 1.2 && A.inv <= 0) hit(12, '그물에 걸렸어요!');
      }
    }
    A.status = A.flash && A.flash.t > clock ? A.flash.msg : status;
    if (A.cbs.onTick) A.cbs.onTick({ left: Math.max(0, A.dur - A.t), food: A.food, special: A.special, damage: Math.round(A.damage), status: A.status, hurt: !!(A.flash && A.flash.t > clock) || /줄어|위험/.test(status) });
    if (A.t >= A.dur) endArena();
  }
  function hit(n, msg) { A.damage += n; A.inv = 1.4; A.flash = { msg, t: clock + 1.2 }; if (A.cbs.onHit) A.cbs.onHit(msg); }
  function endArena() {
    if (A.ended) return; A.ended = true;
    const res = { food: A.food, special: A.special, damage: Math.round(A.damage) };
    stopArena();
    if (A.cbs.onEnd) A.cbs.onEnd(res);
  }
  function stopArena() {
    if (mode !== 'arena') return;
    mode = 'diorama'; if (arenaGroup) { root.remove(arenaGroup); arenaGroup = null; }
    buildBiome(A.key); placeCamera();
  }

  // ---------- 초기화 · 루프 ----------
  function init() {
    if (inited || failed) return !failed;
    stage = document.createElement('div'); stage.className = 'w3d';
    stage.innerHTML = '<canvas aria-label="3D 서식지 화면"></canvas>';
    canvas = stage.querySelector('canvas');
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true }); } catch (e) { failed = true; return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); scene.fog = new T.Fog(0xC9E0EE, 90, 200);
    camera = new T.PerspectiveCamera(40, 16 / 9, 0.5, 500);
    hemi = new T.HemisphereLight(0xFFFFFF, 0x445566, 0.6); scene.add(hemi);
    sun = new T.DirectionalLight(0xFFF2DD, 0.9); sun.position.set(25, 45, 20); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 140 }); scene.add(sun);
    buildBiome('bear'); placeCamera(); bindControls();
    new ResizeObserver(resize).observe(stage);
    requestAnimationFrame(frame);
    inited = true; return true;
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 560 ? 50 : 40; camera.updateProjectionMatrix();
    if (mode === 'arena') arenaCamera();
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!stage.isConnected || document.hidden) { last = now; lastReal = now; return; }
    const dt = Math.min(0.05, ((now - last) / 1000) || 0.016); last = now; clock += dt;
    const realDt = Math.min(0.5, ((now - lastReal) / 1000) || 0.016); lastReal = now;
    if (mode === 'arena') arenaFrame(dt, realDt);
    else {
      if (autoRot && !autoRotPaused) { cam.theta += dt * 0.08; placeCamera(); }
      // 대기 애니메이션
      if (biome === 'bear' && B.floes) B.floes.forEach(f => f.mesh.position.y = 0.18 + Math.sin(clock * 0.8 + f.ph) * 0.06);
      if (biome === 'penguin') B.pops.forEach(p => p.g.rotation.z = Math.sin(clock * 2 + p.ph) * 0.05);
      if (biome === 'pollock') B.pops.forEach(p => { const a = clock * 0.5 + p.i * 0.7; p.g.position.set(p.cx + Math.cos(a) * 3, -1.4, p.cz + Math.sin(a) * 1.4); p.g.rotation.y = -a - Math.PI / 2; });
      if (biome === 'coral') B.reefFish.forEach(f => { f.a += dt * f.sp; f.g.position.set(f.cx + Math.cos(f.a) * f.rad, f.y, f.cz + Math.sin(f.a) * f.rad * 0.5); f.g.rotation.y = -f.a - Math.PI / 2; });
      if (biome === 'bear') B.pops.forEach(p => p.g.position.y += Math.sin(clock * 1.5 + p.ph) * 0.002);
    }
    renderer.render(scene, camera);
  }

  return {
    available() { return init(); },
    element() { return stage; },
    setBiome(key) { if (init() && key !== biome && mode === 'diorama') buildBiome(key); },
    setState(o) { if (init()) setState(o); },
    setAutoRotate(on) { autoRot = !!on && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); autoRotPaused = false; },
    startArena, stopArena,
    get mode() { return mode; },
  };
})();
