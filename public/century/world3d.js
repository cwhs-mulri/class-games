// ===== 3D 서식지 + 60초 준비 아레나 (Three.js r128) =====
// 낮은 다각형(로우폴리) 화풍: 면마다 평평한 음영(flatShading), 물결은 정점 셰이더로 움직인다.
// makeHabitat(scene, sun, hemi)는 장면 하나에 서식지 하나를 그린다 — 휴대폰(World3D)과 전자칠판(Board3D)이 함께 쓴다.
const World3D = (function () {
  const T = window.THREE;
  let failed = !T, inited = false;
  let stage, canvas, fxLayer, renderer, scene, camera, sun, hemi, root, popGroup, arenaGroup;
  let biome = null, B = null, mode = 'diorama', autoRot = true;
  const cam = { theta: 0.95, phi: 0.92, r: 64, tx: 0, tz: -1 };
  let clock = 0, last = 0, lastReal = 0;
  const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---------- 재질 · 도형 ----------
  const matCache = {};
  const mat = (c, o) => { const k = c + JSON.stringify(o || {}); return matCache[k] || (matCache[k] = T && new T.MeshPhongMaterial(Object.assign({ color: c, flatShading: true, shininess: 6, specular: 0x101010 }, o || {}))); };
  const lerpC = (a, b, k) => new T.Color(a).lerp(new T.Color(b), clamp01(k));
  function srand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const GEO = {};
  const geo = (k, f) => GEO[k] || (GEO[k] = f());
  function mesh(g, m, x, y, z) { const o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; }
  // 단위 이십면체(로우폴리 구)를 늘려서 몸통·머리를 만든다
  function blob(m, x, y, z, sx, sy, sz, low) { const o = mesh(low ? geo('ico0', () => new T.IcosahedronGeometry(1, 0)) : geo('ico1', () => new T.IcosahedronGeometry(1, 1)), m, x, y, z); o.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); return o; }
  const cyl = (rt, rb, h, seg, m, x, y, z) => mesh(geo(`c${rt}|${rb}|${h}|${seg}`, () => new T.CylinderGeometry(rt, rb, h, seg)), m, x, y, z);
  const cone = (r, h, seg, m, x, y, z) => mesh(geo(`k${r}|${h}|${seg}`, () => new T.ConeGeometry(r, h, seg)), m, x, y, z);
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); return t; }
  let TEX = null;
  function tex() {
    if (TEX) return TEX;
    const radial = (stops) => canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    TEX = {
      dot: radial([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,0)']]),
      soft: radial([[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]),
      shadow: radial([[0, 'rgba(0,0,0,.55)'], [0.6, 'rgba(0,0,0,.25)'], [1, 'rgba(0,0,0,0)']]),
      streak: canvasTex(16, 64, (x) => { const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.95)'); x.fillStyle = g; x.fillRect(6, 0, 4, 64); }),
      ray: canvasTex(32, 128, (x) => { const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,240,.55)'); g.addColorStop(1, 'rgba(255,255,240,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 128); const h = x.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 32, 128); }),
      edge: canvasTex(4, 64, (x) => { const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.25, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(0, 0, 4, 64); }),
    };
    return TEX;
  }

  // 출렁이는 물: 퐁 재질에 정점 변위를 끼워 넣는다(면 음영이 반짝이며 바뀐다)
  function waterMat(color, opacity) {
    const m = new T.MeshPhongMaterial({ color, flatShading: true, shininess: 40, specular: 0x2A3A48, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    const u = { uTime: { value: 0 }, uAmp: { value: 0.16 } };
    m.userData.u = u;
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = u.uTime; sh.uniforms.uAmp = u.uAmp;
      sh.vertexShader = 'uniform float uTime;\nuniform float uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float wv = sin(position.x * 0.21 + uTime * 1.1) * 0.55 + sin(position.y * 0.27 - uTime * 0.9) * 0.4 + sin((position.x + position.y) * 0.13 + uTime * 0.55) * 0.6;
        transformed.z += wv * uAmp;`);
    };
    m.customProgramCacheKey = () => 'cg-water';
    return m;
  }

  // ---------- 동물 모델 (모두 +x 쪽을 본다) ----------
  function shadowDisc(r) { const m = new T.Mesh(geo('disc', () => new T.CircleGeometry(1, 20)), geo('shadowMat', () => new T.MeshBasicMaterial({ map: tex().shadow, transparent: true, depthWrite: false }))); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.scale.setScalar(r); m.renderOrder = 1; return m; }
  function bearModel() {
    const g = new T.Group(), fur = mat(0xF1EBDC), fur2 = mat(0xE0D5BC), dark = mat(0x1A1A1A), paw = mat(0xD6C9AC);
    g.add(blob(fur, 0, 1.05, 0, 1.5, 0.9, 0.86));
    g.add(blob(fur, -0.78, 1.0, 0, 0.82, 0.8, 0.78));
    g.add(blob(fur, 0.62, 1.2, 0, 0.78, 0.76, 0.76));
    const head = new T.Group(); head.position.set(1.15, 1.35, 0); g.add(head);
    head.add(blob(fur, 0.15, 0.0, 0, 0.5, 0.42, 0.42));
    head.add(blob(fur, 0.55, 0.1, 0, 0.45, 0.38, 0.37));
    head.add(blob(fur2, 0.9, 0.02, 0, 0.26, 0.19, 0.2));
    head.add(blob(dark, 1.13, 0.07, 0, 0.08, 0.07, 0.09, true));
    head.add(blob(dark, 0.72, 0.24, 0.17, 0.05, 0.05, 0.05, true)); head.add(blob(dark, 0.72, 0.24, -0.17, 0.05, 0.05, 0.05, true));
    head.add(blob(fur2, 0.42, 0.42, 0.22, 0.12, 0.12, 0.07)); head.add(blob(fur2, 0.42, 0.42, -0.22, 0.12, 0.12, 0.07));
    const legs = [];
    for (const [x, z] of [[0.72, 0.4], [0.72, -0.4], [-0.78, 0.4], [-0.78, -0.4]]) {
      const p = new T.Group(); p.position.set(x, 0.85, z);
      p.add(cyl(0.25, 0.21, 0.8, 7, fur, 0, -0.4, 0)); p.add(blob(paw, 0.06, -0.8, 0, 0.26, 0.12, 0.24));
      g.add(p); legs.push(p);
    }
    g.add(blob(fur, -1.52, 1.15, 0, 0.14));
    g.add(shadowDisc(1.9));
    g.userData = { head, legs };
    return g;
  }
  function penguinModel() {
    const g = new T.Group(), b = mat(0x1C2330), w = mat(0xF5F4EE), y = mat(0xF6C744), o = mat(0xF39A2B), f = mat(0x3A3F47);
    g.add(blob(b, 0, 1.0, 0, 0.56, 1.0, 0.52));
    g.add(blob(w, 0.2, 0.92, 0, 0.42, 0.82, 0.4));
    g.add(blob(y, 0.33, 1.47, 0, 0.17, 0.24, 0.32));
    const head = new T.Group(); head.position.set(0.05, 1.88, 0); g.add(head);
    head.add(blob(b, 0, 0, 0, 0.34, 0.33, 0.32));
    head.add(blob(o, 0.06, -0.1, 0.24, 0.1, 0.17, 0.06)); head.add(blob(o, 0.06, -0.1, -0.24, 0.1, 0.17, 0.06));
    const beak = cone(0.075, 0.42, 6, b, 0.42, -0.05, 0); beak.rotation.z = -Math.PI / 2 - 0.15; head.add(beak);
    head.add(blob(o, 0.36, -0.12, 0, 0.12, 0.03, 0.05));
    head.add(blob(mat(0x0B0B0B), 0.22, 0.07, 0.18, 0.04, 0.04, 0.04, true)); head.add(blob(mat(0x0B0B0B), 0.22, 0.07, -0.18, 0.04, 0.04, 0.04, true));
    const fl = [];
    for (const s of [1, -1]) { const p = new T.Group(); p.position.set(0, 1.38, 0.46 * s); p.add(blob(b, 0, -0.38, 0, 0.13, 0.5, 0.05)); p.rotation.x = 0.2 * s; g.add(p); fl.push(p); }
    g.add(blob(f, 0.18, 0.05, 0.16, 0.2, 0.05, 0.12)); g.add(blob(f, 0.18, 0.05, -0.16, 0.2, 0.05, 0.12));
    g.add(shadowDisc(0.85));
    g.userData = { head, flippers: fl };
    return g;
  }
  // 명태: 등지느러미 3개 · 뒷지느러미 2개 · 튀어나온 아래턱
  function pollockModel() {
    const g = new T.Group(), back = mat(0x6B6748), side = mat(0xA9A58C), belly = mat(0xE4E1D6), fin = mat(0x58543B), k = mat(0x101010), eye = mat(0xE8E6DA);
    g.add(blob(back, 0, 0.05, 0, 1.45, 0.3, 0.26));
    g.add(blob(side, 0.05, -0.02, 0, 1.38, 0.27, 0.27));
    g.add(blob(belly, 0.12, -0.1, 0, 1.18, 0.18, 0.24));
    const fg = geo('pfin', () => new T.ConeGeometry(0.16, 0.34, 4));
    for (const x of [0.55, 0.0, -0.55]) { const d = mesh(fg, fin, x, 0.36, 0); d.scale.z = 0.15; d.rotation.z = 0.35; g.add(d); }
    for (const x of [-0.05, -0.55]) { const a = mesh(fg, fin, x, -0.27, 0); a.scale.z = 0.15; a.rotation.z = Math.PI - 0.35; g.add(a); }
    const tail = new T.Group(); tail.position.set(-1.38, 0.03, 0); g.add(tail);
    for (const s of [1, -1]) { const t = mesh(geo('ptail', () => new T.ConeGeometry(0.16, 0.5, 4)), fin, -0.2, 0.14 * s, 0); t.rotation.z = s > 0 ? Math.PI / 2 - 0.5 : Math.PI / 2 + 0.5; t.scale.z = 0.2; tail.add(t); }
    g.add(blob(eye, 1.05, 0.1, 0.17, 0.09, 0.09, 0.09, true)); g.add(blob(eye, 1.05, 0.1, -0.17, 0.09, 0.09, 0.09, true));
    g.add(blob(k, 1.1, 0.1, 0.21, 0.05, 0.05, 0.05, true)); g.add(blob(k, 1.1, 0.1, -0.21, 0.05, 0.05, 0.05, true));
    g.add(blob(side, 1.3, -0.08, 0, 0.18, 0.06, 0.12));
    g.userData = { tail };
    return g;
  }
  function fishModel(col) { // 산호초 열대어(작은 물고기)
    const g = new T.Group(), m = mat(col || 0xFFB703), w = mat(0xF4F1E8), k = mat(0x111111);
    g.add(blob(m, 0, 0, 0, 1.0, 0.55, 0.28));
    g.add(blob(w, 0.15, -0.05, 0, 0.12, 0.5, 0.29));
    const tail = new T.Group(); tail.position.set(-0.95, 0, 0); g.add(tail);
    const t = cone(0.4, 0.6, 4, m, -0.2, 0, 0); t.rotation.z = Math.PI / 2; t.scale.z = 0.2; tail.add(t);
    g.add(blob(k, 0.62, 0.12, 0.2, 0.07, 0.07, 0.07, true)); g.add(blob(k, 0.62, 0.12, -0.2, 0.07, 0.07, 0.07, true));
    g.userData = { tail };
    return g;
  }
  function larvaModel() {
    const g = new T.Group(), m = new T.MeshPhongMaterial({ color: 0xFF8CC0, emissive: 0xFF4F9A, emissiveIntensity: 0.55, flatShading: true });
    g.add(blob(m, 0, 0.5, 0, 0.65, 0.5, 0.5));
    for (let i = 1; i <= 3; i++) g.add(blob(m, -0.55 - i * 0.42, 0.5, 0, 0.28 - i * 0.05));
    const glow = new T.Sprite(new T.SpriteMaterial({ map: tex().soft, color: 0xFF7EB6, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending })); glow.scale.set(3.4, 3.4, 1); glow.position.y = 0.5; g.add(glow);
    return g;
  }
  function starfishModel() {
    const g = new T.Group(), m = mat(0x7B3FA0), s = mat(0xC86BFA);
    g.add(blob(m, 0, 0.35, 0, 0.7, 0.32, 0.7));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const c = cone(0.12, 0.7, 5, s, Math.cos(a) * 0.7, 0.4, Math.sin(a) * 0.7); c.rotation.z = -Math.cos(a) * 1.2; c.rotation.x = Math.sin(a) * 1.2; g.add(c); }
    return g;
  }
  function sealModel(dark) {
    const g = new T.Group(), m = mat(dark ? 0x3A4049 : 0x8D949C), m2 = mat(dark ? 0x9AA0A8 : 0xB9BFC6), k = mat(0x111111);
    g.add(blob(m, 0, 0.35, 0, 1.4, 0.42, 0.52));
    g.add(blob(m2, 0.1, 0.22, 0, 1.2, 0.26, 0.45));
    g.add(blob(m, 1.25, 0.52, 0, 0.4, 0.34, 0.34));
    g.add(blob(k, 1.5, 0.62, 0.15, 0.06, 0.06, 0.06, true)); g.add(blob(k, 1.5, 0.62, -0.15, 0.06, 0.06, 0.06, true));
    const t = cone(0.3, 0.5, 4, m, -1.5, 0.3, 0); t.rotation.z = Math.PI / 2; t.scale.z = 0.3; g.add(t);
    g.add(shadowDisc(1.5));
    return g;
  }
  function coralHead(r) {
    const g = new T.Group();
    const pal = [0xFF6F91, 0xFF9F43, 0xA66CFF, 0xFFD166, 0x3FD0C0, 0xF15BB5, 0x7BD389, 0xFF7A5C];
    const col = pal[Math.floor(r() * pal.length)];
    const type = Math.floor(r() * 5);
    const m = new T.MeshPhongMaterial({ color: col, flatShading: true, shininess: 10, side: type === 3 ? T.DoubleSide : T.FrontSide });
    let sway = null;
    if (type === 0) { // 사슴뿔 모양 가지산호
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2 + r(), tilt = 0.25 + r() * 0.5, len = 1.1 + r() * 0.7;
        const br = new T.Group(); br.rotation.set(Math.sin(a) * tilt, 0, Math.cos(a) * tilt); g.add(br);
        br.add(cyl(0.09, 0.15, len, 5, m, 0, len / 2, 0));
        const tip = cyl(0.06, 0.09, 0.6, 5, m, 0.12, len + 0.2, 0); tip.rotation.z = -0.6; br.add(tip);
      }
    } else if (type === 1) { // 뇌산호
      g.add(mesh(geo('brain', () => { const gg = new T.IcosahedronGeometry(0.8, 2); const p = gg.attributes.position, v = new T.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + Math.sin(v.x * 9) * Math.sin(v.z * 9) * 0.06 + Math.sin(v.y * 13) * 0.04; v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); } gg.computeVertexNormals(); return gg; }), m, 0, 0.3, 0));
      g.children[0].scale.y = 0.62;
    } else if (type === 2) { // 탁자산호
      g.add(cyl(0.15, 0.22, 0.7, 6, m, 0, 0.35, 0));
      g.add(cyl(1.0, 0.75, 0.16, 9, m, 0, 0.75, 0));
    } else if (type === 3) { // 부채뿔산호
      const sh = geo('fan', () => { const s = new T.Shape(); s.moveTo(0, 0); for (let i = 0; i <= 12; i++) { const a = Math.PI * (0.15 + 0.7 * i / 12); const rr = 1.5 + (i % 2) * 0.15; s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } s.lineTo(0, 0); return new T.ShapeGeometry(s); });
      const fan = mesh(sh, m, 0, 0, 0); g.add(fan); sway = fan;
    } else { // 말미잘
      const base = cyl(0.35, 0.45, 0.4, 7, m, 0, 0.2, 0); g.add(base);
      const ten = new T.Group(); ten.position.y = 0.4; g.add(ten);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const c = cone(0.06, 0.6, 4, m, Math.cos(a) * 0.25, 0.28, Math.sin(a) * 0.25); c.rotation.z = -Math.cos(a) * 0.5; c.rotation.x = Math.sin(a) * 0.5; ten.add(c); }
      sway = ten;
    }
    g.userData = { m, col, sway, ph: r() * 6 };
    return g;
  }
  function boatModel() {
    const g = new T.Group(), hull = mat(0x2F5D8A), deck = mat(0xEDE6D6), red = mat(0xC8553D);
    const h = mesh(geo('hull', () => { const s = new T.Shape(); s.moveTo(-2.2, 0); s.lineTo(1.6, 0); s.lineTo(2.6, 0.6); s.lineTo(-2.4, 0.6); s.lineTo(-2.2, 0); return new T.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false }); }), hull, 0, -0.1, -0.8);
    g.add(h); g.add(mesh(geo('bdeck', () => new T.BoxGeometry(4.6, 0.1, 1.6)), deck, 0.1, 0.55, 0));
    g.add(mesh(geo('bcab', () => new T.BoxGeometry(1.2, 0.9, 1.1)), deck, -0.8, 1.05, 0));
    g.add(mesh(geo('broof', () => new T.BoxGeometry(1.35, 0.12, 1.25)), red, -0.8, 1.55, 0));
    g.add(cyl(0.05, 0.05, 2.2, 5, mat(0x7A6A55), 0.8, 1.6, 0));
    return g;
  }

  // ---------- 입자(눈·비·연기·거품) ----------
  function makePoints(n, map, color, size, opacity, additive) {
    const g = new T.BufferGeometry(), pos = new Float32Array(n * 3);
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const m = new T.PointsMaterial({ map, color, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true, blending: additive ? T.AdditiveBlending : T.NormalBlending });
    const p = new T.Points(g, m); p.frustumCulled = false; p.renderOrder = 6;
    return { p, pos, n, m, base: opacity, sp: new Float32Array(n), ph: new Float32Array(n), level: 0, target: 0 };
  }
  // kind별 움직임: 새 입자 놓기(spawn)와 한 걸음(step)
  const PK = {
    snow:   { n: 260, tex: 'dot', color: 0xFFFFFF, size: 0.42, op: 0.9, area: [46, 0, 26, 34], vy: [-2.4, -1.4], drift: 0.9 },
    rain:   { n: 240, tex: 'streak', color: 0xA9CDE8, size: 1.1, op: 0.6, area: [46, 0, 26, 34], vy: [-30, -22], drift: 0 },
    smoke:  { n: 70, tex: 'soft', color: 0x4E4640, size: 9, op: 0.42, area: [46, 0, 18, 32], vy: [0.8, 1.6], drift: 2.2 },
    ember:  { n: 90, tex: 'dot', color: 0xFF8A3D, size: 0.38, op: 0.95, area: [40, 0, 12, 30], vy: [1.5, 3.2], drift: 1.2, add: true },
    ash:    { n: 220, tex: 'dot', color: 0x8E8A86, size: 0.36, op: 0.85, area: [46, 0, 22, 34], vy: [-1.6, -0.8], drift: 1.4 },
    puff:   { n: 70, tex: 'soft', color: 0xC9DDBF, size: 2.8, op: 0.5, area: [34, 0.2, 7, 26], vy: [1.2, 2.4], drift: 0.4 },
    bubble: { n: 110, tex: 'dot', color: 0xE9FFF9, size: 0.32, op: 0.8, area: [34, -2.4, 0.2, 26], vy: [1.0, 2.0], drift: 0.3 },
    sparkle:{ n: 140, tex: 'dot', color: 0x7CF0B4, size: 0.9, op: 0.9, area: [40, 0.5, 14, 30], vy: [0.4, 1.0], drift: 0.6, add: true },
    msnow:  { n: 140, tex: 'dot', color: 0xF0F6F0, size: 0.18, op: 0.7, area: [40, -2.5, 0, 30], vy: [-0.25, -0.1], drift: 0.25 },
  };
  function particleSystem(kind) {
    const K = PK[kind], s = makePoints(K.n, tex()[K.tex], K.color, K.size, K.op, K.add);
    const [ax, y0, y1, az] = K.area, rnd = Math.random;
    const spawn = (i, anyY) => { s.pos[i * 3] = (rnd() - 0.5) * ax * 2; s.pos[i * 3 + 1] = anyY ? y0 + rnd() * (y1 - y0) : (K.vy[0] < 0 ? y1 : y0); s.pos[i * 3 + 2] = (rnd() - 0.5) * az * 2 - 2; s.sp[i] = K.vy[0] + rnd() * (K.vy[1] - K.vy[0]); s.ph[i] = rnd() * 6.28; };
    for (let i = 0; i < K.n; i++) spawn(i, true);
    s.step = (dt, t) => {
      for (let i = 0; i < K.n; i++) {
        const j = i * 3; s.pos[j + 1] += s.sp[i] * dt;
        if (K.drift) { s.pos[j] += Math.sin(t * 0.7 + s.ph[i]) * K.drift * dt + (kind === 'smoke' ? K.drift * 0.5 * dt : 0); s.pos[j + 2] += Math.cos(t * 0.5 + s.ph[i]) * K.drift * 0.5 * dt; }
        if ((K.vy[0] < 0 && s.pos[j + 1] < y0) || (K.vy[0] > 0 && s.pos[j + 1] > y1)) spawn(i, false);
      }
      s.p.geometry.attributes.position.needsUpdate = true;
    };
    s.kind = kind;
    return s;
  }

  // 날씨·재난 테마별 장면 변화 (하늘 · 해 · 물 · 입자)
  const FX = {
    elnino:   { sky: [0xF2B88A, 0xFCE3C2], skyK: 0.45, water: 0x2C8C9C, amp: 0.42, sun: 0.12 },
    heatdome: { sky: [0xE8743B, 0xFFD08A], skyK: 0.8, sun: 0.35, haze: 1, sunCol: 0xFFC27A },
    wildfire: { sky: [0x6E5446, 0xC88A55], skyK: 0.85, sun: -0.2, haze: 1, parts: ['smoke', 'ember'], sunCol: 0xFFA060 },
    methane:  { sky: [0xB7C2A2, 0xDDE3C8], skyK: 0.35, parts: ['puff'], under: ['bubble'] },
    volcano:  { sky: [0x55575E, 0x9C978E], skyK: 0.85, sun: -0.35, haze: 1, parts: ['ash'] },
    plastic:  { debris: 'plastic' },
    oilspill: { debris: 'oil', water: 0x1E2E38 },
    deal:     { sky: [0x86C9F0, 0xDDF3FF], skyK: 0.5, sun: 0.1, parts: ['sparkle'] },
  };

  // ---------- 서식지 하나(장면 하나에 그리는 단위) ----------
  function makeHabitat(scene, sun, hemi) {
    let root, popGroup, B = { pops: [] }, biome = null;
    const st = { Tk: 0, hab: 1, pop: 0.5, health: 1, dead: 0, deadT: 0 };
    const fx = {}; // key → { level, target, objs }
    let skyCan = null, skyTex = null, skyKey = '';
    const amb = {}; // 기본 입자
    function clearRoot() {
      if (root) scene.remove(root);
      root = new T.Group(); scene.add(root);
      popGroup = new T.Group(); root.add(popGroup);
      B = { pops: [] };
      for (const k in fx) delete fx[k];
      for (const k in amb) delete amb[k];
    }
    function waterPlane(color, opacity, y) {
      const m = waterMat(color, opacity);
      const w = new T.Mesh(geo('waterGeo', () => new T.PlaneGeometry(200, 200, 56, 56)), m); w.rotation.x = -Math.PI / 2; w.position.y = y || 0; w.receiveShadow = true; root.add(w); B.waterMat = m; B.waterBase = color; return w;
    }
    function seabed(color, y, bump) {
      const g = geo('bed' + bump, () => { const gg = new T.PlaneGeometry(160, 160, 36, 36); const p = gg.attributes.position, r = srand(11); for (let i = 0; i < p.count; i++) p.setZ(i, (Math.sin(p.getX(i) * 0.15) * Math.cos(p.getY(i) * 0.12) + r() * 0.6) * bump); gg.computeVertexNormals(); return gg; });
      const m = mesh(g, mat(color), 0, y, 0); m.rotation.x = -Math.PI / 2; root.add(m); return m;
    }
    function addAmb(kind) { const s = particleSystem(kind); root.add(s.p); amb[kind] = s; return s; }
    function mountain(m, x, z, h, w, snow, r) {
      const g = new T.Group(); g.position.set(x, 0, z); root.add(g);
      const body = blob(m, 0, h * 0.45, 0, w, h, w * 0.85, true); body.rotation.y = r() * 3; g.add(body);
      if (snow) { const cap = blob(snow, 0, h * 1.05, 0, w * 0.45, h * 0.35, w * 0.42, true); cap.rotation.y = body.rotation.y; cap.userData.h0 = cap.scale.y; g.add(cap); g.userData.cap = cap; }
      return g;
    }
    // 불규칙한 다각형 얼음 조각
    function floeGeo(rad, r) {
      const s = new T.Shape(), n = 6 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = rad * (0.82 + r() * 0.3); if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      const g = new T.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.18, bevelSegments: 1 });
      g.rotateX(-Math.PI / 2); return g;
    }

    function buildBiome(key) {
      clearRoot(); biome = key;
      const r = srand(key.length * 97 + 7);
      const S = SKIES[key];
      if (key === 'bear') {
        waterPlane(S.water, 1);
        B.landMat = new T.MeshPhongMaterial({ color: 0xF2F6F8, flatShading: true, shininess: 4 });
        B.rockMat = new T.MeshPhongMaterial({ color: 0xC9D3DC, flatShading: true, shininess: 4 }); B.snowMat = new T.MeshPhongMaterial({ color: 0xFAFCFD, flatShading: true, shininess: 4 });
        root.add(mesh(geo('land', () => new T.BoxGeometry(92, 2.4, 16)), B.landMat, 0, 0.6, -26));
        B.peaks = [];
        for (let i = 0; i < 8; i++) B.peaks.push(mountain(B.rockMat, -40 + i * 11.5 + r() * 4, -28 - r() * 4, 3.5 + r() * 4.5, 4 + r() * 3, B.snowMat, r));
        B.floes = [];
        const iceTop = mat(0xEEF6FA), pond = new T.MeshPhongMaterial({ color: 0x6FC3E0, shininess: 60, specular: 0x88AACC, flatShading: true });
        let tries = 0;
        while (B.floes.length < 24 && tries < 900) {
          tries++; const rad = 1.8 + r() * 2.6, x = -25 + r() * 50, z = -14 + r() * 29;
          if (B.floes.some(f => Math.hypot(f.x - x, f.z - z) < f.r + rad + 0.6)) continue;
          const m = mesh(floeGeo(rad, r), iceTop, x, 0.0, z); m.rotation.y = r() * 3;
          const ponds = [];
          for (let k = 0; k < 2; k++) { const pd = mesh(geo('disc', () => new T.CircleGeometry(1, 20)), pond, (r() - 0.5) * rad * 0.8, 0.49, (r() - 0.5) * rad * 0.8); pd.rotation.x = -Math.PI / 2; pd.scale.set(0.3 + r() * rad * 0.22, 0.25 + r() * rad * 0.18, 1); pd.castShadow = false; pd.visible = false; m.add(pd); ponds.push({ m: pd, th: r() }); }
          root.add(m); B.floes.push({ mesh: m, x, z, r: rad, k: 1, ph: r() * 6, ponds });
        }
        B.floes.sort((a, b) => a.z - b.z); // 북쪽(음수 z) 먼저 남음
        B.seals = [0, 1, 2].map(i => { const s = sealModel(false); s.scale.setScalar(0.55); s.visible = false; root.add(s); return s; });
        addAmb('snow'); addAmb('rain');
      } else if (key === 'penguin') {
        waterPlane(S.water, 1);
        const shelf = mat(0xDCEAF3), shelf2 = mat(0xC5DCEB);
        root.add(mesh(geo('shelf', () => new T.BoxGeometry(92, 5, 10)), shelf, 0, 2.5, -26));
        for (let i = 0; i < 14; i++) root.add(blob(i % 3 ? shelf : shelf2, -44 + i * 6.8 + r() * 2, 4.6 + r() * 1.2, -26 - r() * 3, 3 + r() * 2, 1.2 + r() * 1.4, 3, true));
        B.slab = mesh(geo('slab', () => new T.BoxGeometry(70, 0.7, 1)), mat(0xEEF5FA), 0, 0.3, -14);
        root.add(B.slab);
        B.cracks = [];
        const crk = mat(0x2F5F86);
        for (let i = 0; i < 5; i++) { const c = mesh(geo('crack', () => new T.BoxGeometry(1, 0.06, 0.04)), crk, -24 + i * 12 + r() * 4, 0.37, 0); c.scale.x = 6 + r() * 7; c.rotation.y = (r() - 0.5) * 0.6; c.visible = false; c.castShadow = false; B.slab.add(c); B.cracks.push(c); }
        B.bergs = [];
        for (let i = 0; i < 7; i++) { const b = blob(mat(0xD6E9F5), -24 + r() * 48, 0.4, 2 + r() * 13, 1.4 + r() * 1.8, 1.2 + r() * 1.6, 1.4 + r() * 1.6, true); b.rotation.y = r() * 3; root.add(b); B.bergs.push(b); }
        addAmb('snow'); addAmb('rain');
      } else if (key === 'coral') {
        seabed(0xBFAE7E, -2.7, 0.35);
        waterPlane(S.water, 0.3);
        root.add(cyl(6, 8, 3, 14, mat(0xF0E0B5), 30, -1.2, -20));
        root.add(cone(0.25, 6, 5, mat(0x7A5C3E), 30, 2.6, -20)); // 작은 섬의 야자수
        for (let i = 0; i < 5; i++) { const l = blob(mat(0x3E8E4E), 30 + Math.cos(i * 1.26) * 1.4, 5.6, -20 + Math.sin(i * 1.26) * 1.4, 1.8, 0.18, 0.6, true); l.rotation.y = i * 1.26; root.add(l); }
        for (let i = 0; i < 8; i++) { const rk = blob(mat(0x8A8378), -26 + r() * 52, -2.6, -15 + r() * 30, 0.8 + r() * 1.2, 0.5 + r() * 0.6, 0.8 + r(), true); root.add(rk); }
        B.corals = [];
        for (let i = 0; i < 38; i++) {
          const h = coralHead(r); const x = -24 + r() * 48, z = -13 + r() * 26;
          h.position.set(x, -2.6, z); h.scale.setScalar(1.6 + r() * 1.4); h.rotation.y = r() * 6; root.add(h);
          B.corals.push({ g: h, rank: r() });
        }
        B.reefFish = [];
        for (let i = 0; i < 12; i++) { const f = fishModel([0xFFB703, 0x3A86FF, 0xFB5607, 0xF15BB5][i % 4]); f.scale.setScalar(0.42); root.add(f); B.reefFish.push({ g: f, a: r() * 6, rad: 6 + r() * 14, y: -1.5 + r() * 0.9, sp: 0.3 + r() * 0.4, cx: (r() - 0.5) * 20, cz: (r() - 0.5) * 14 }); }
        B.rays = [];
        const rayMat = new T.MeshBasicMaterial({ map: tex().ray, transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
        for (let i = 0; i < 6; i++) { const ray = new T.Mesh(geo('rayG', () => new T.PlaneGeometry(3, 9)), rayMat); ray.position.set(-20 + i * 8 + r() * 3, 1.2, -6 + r() * 12); ray.rotation.set(0, r() * 3, 0.35); root.add(ray); B.rays.push({ m: ray, ph: r() * 6 }); }
        B.rayMat = rayMat;
        addAmb('msnow');
      } else if (key === 'pollock') {
        seabed(0x173452, -4, 0.6);
        waterPlane(S.water, 0.62);
        B.landMat = new T.MeshPhongMaterial({ color: 0x5E8A4E, flatShading: true, shininess: 4 });
        root.add(mesh(geo('coast', () => new T.BoxGeometry(14, 3, 92)), B.landMat, -33, 1, 0));
        root.add(mesh(geo('beach', () => new T.BoxGeometry(2.4, 1.2, 92)), mat(0xD8C79A), -25.6, 0.1, 0));
        B.peaks = [];
        for (let i = 0; i < 7; i++) B.peaks.push(mountain(B.landMat, -35 + r() * 4, -36 + i * 12, 3 + r() * 4, 3 + r() * 2, null, r));
        for (let i = 0; i < 16; i++) { const k = cone(0.12, 1.6 + r() * 1.4, 4, mat(0x2F6B45), -23 + r() * 2.5, -3.2, -40 + i * 5.3 + r() * 2); k.rotation.z = (r() - 0.5) * 0.4; root.add(k); }
        const zone = (col, op, add) => { const mm = new T.MeshBasicMaterial({ color: col, map: tex().edge, transparent: true, opacity: op, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending }); const p = new T.Mesh(geo('zoneG', () => new T.PlaneGeometry(110, 1)), mm); p.rotation.x = -Math.PI / 2; p.position.x = 28; root.add(p); return p; };
        B.cold = zone(0x0E2C46, 1, true); B.cold.position.y = 0.22;
        B.warm = zone(0xF07C3C, 0.45, false); B.warm.position.y = 0.23;
        B.boat = boatModel(); B.boat.position.set(12, 0.2, 10); B.boat.rotation.y = 0.6; root.add(B.boat);
        B.fishes = [];
        addAmb('bubble');
      }
      // 하늘
      skyCan = document.createElement('canvas'); skyCan.width = 4; skyCan.height = 128; skyTex = new T.CanvasTexture(skyCan); skyKey = '';
      scene.background = skyTex;
      if (!scene.fog) scene.fog = new T.Fog(S.sky, 90, 200);
      applyLook(true);
    }
    function setEdge(edge) { // 명태: edge보다 북쪽(z 작음)은 찬물
      const zmin = -16, zmax = 16, e = Math.max(zmin, Math.min(zmax, edge));
      const ch = e - zmin, wh = zmax - e;
      B.cold.visible = ch > 0.05; B.warm.visible = wh > 0.05;
      // 두 면 모두 경계(e) 쪽 가장자리가 흐리게 사라진다(텍스처 위쪽이 투명)
      if (B.cold.visible) { B.cold.scale.y = ch + 2; B.cold.position.z = zmin + ch / 2 - 1; B.cold.rotation.set(-Math.PI / 2, 0, Math.PI); }
      if (B.warm.visible) { B.warm.scale.y = wh + 2; B.warm.position.z = e + wh / 2 + 1; B.warm.rotation.set(-Math.PI / 2, 0, 0); }
      B.edge = e;
    }
    function setSlab(depth) { B.slab.scale.z = depth; B.slab.position.z = -21 + depth / 2; B.iceEdge = -21 + depth; B.cracks && B.cracks.forEach(c => c.scale.z = 1 / Math.max(0.2, depth)); }

    // ---------- 상태 반영 ----------
    function populate(n, maker, placer) {
      while (B.pops.length > n) { const p = B.pops.pop(); popGroup.remove(p.g); }
      while (B.pops.length < n) { const g = maker(); popGroup.add(g); B.pops.push({ g, i: B.pops.length, ph: Math.random() * 6, a: Math.random() * 6 }); }
      B.pops.forEach((p, i) => placer(p, i));
    }
    // 하늘 · 해 · 안개 · 물 색: 기온 + 재난 효과 + 멸종
    function applyLook(force) {
      const S = SKIES[biome]; if (!S) return;
      const Tk = st.Tk;
      let top = lerpC(S.top, 0xE0A57E, Tk * 0.7), bot = lerpC(S.sky, 0xF2D2AE, Tk * 0.75);
      let sunI = 0.82 + Tk * 0.22, sunC = lerpC(0xFFF2DD, 0xFFD2A0, Tk), haze = Tk * 0.3, amp = 0.16 + Tk * 0.06;
      let water = new T.Color(B.waterBase || S.water);
      if (biome === 'coral') water = lerpC(S.water, 0x4F9C8C, Tk);
      if (biome === 'pollock') water = lerpC(S.water, 0x2A6E8A, Tk);
      for (const k in fx) {
        const F = FX[k], l = fx[k].level; if (!F || l <= 0.001) continue;
        if (F.sky) { top.lerp(new T.Color(F.sky[0]), l * F.skyK); bot.lerp(new T.Color(F.sky[1]), l * F.skyK); }
        if (F.sun) sunI += F.sun * l;
        if (F.sunCol) sunC.lerp(new T.Color(F.sunCol), l * 0.6);
        if (F.haze) haze = Math.max(haze, F.haze * l);
        if (F.water) water.lerp(new T.Color(F.water), l * (k === 'oilspill' ? 0.25 : 0.55));
        if (F.amp) amp = Math.max(amp, F.amp * l + amp * (1 - l));
      }
      if (st.deadT > 0.001) { const g = new T.Color(0x6B7280); top.lerp(g, st.deadT * 0.75); bot.lerp(new T.Color(0x9AA1AB), st.deadT * 0.75); sunI -= 0.3 * st.deadT; water.lerp(new T.Color(0x3B4A57), st.deadT * 0.5); }
      const key = top.getHexString() + bot.getHexString();
      if (force || key !== skyKey) {
        skyKey = key;
        const x = skyCan.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
        g.addColorStop(0, '#' + top.getHexString()); g.addColorStop(1, '#' + bot.getHexString());
        x.fillStyle = g; x.fillRect(0, 0, 4, 128); skyTex.needsUpdate = true;
        scene.fog.color.copy(bot);
      }
      scene.fog.near = 90 - haze * 55; scene.fog.far = 200 - haze * 70;
      sun.intensity = Math.max(0.35, sunI); sun.color.copy(sunC);
      if (hemi) hemi.intensity = 0.62 - st.deadT * 0.15;
      if (B.waterMat) { B.waterMat.color.copy(water); B.waterMat.userData.u.uAmp.value = RM ? 0.05 : amp; }
    }
    function setFx(list) {
      const want = new Set((list || []).filter(k => FX[k]));
      for (const k of want) if (!fx[k]) fx[k] = { level: 0, target: 1, objs: buildFx(k) };
      for (const k in fx) fx[k].target = want.has(k) ? 1 : 0;
    }
    function buildFx(k) {
      const F = FX[k], objs = [], under = biome === 'coral' || biome === 'pollock';
      const kinds = (under && F.under) ? F.under : (F.parts || []);
      for (const kind of kinds) { const s = particleSystem(kind); s.p.material.opacity = 0; root.add(s.p); objs.push(s); }
      if (F.debris === 'plastic') {
        const g = new T.Group(), r = srand(77), cols = [0x3FA7D6, 0xF5F5F0, 0xF26B5B, 0x7BD389, 0xF6C744];
        for (let i = 0; i < 30; i++) { const m = mat(cols[i % cols.length], { transparent: true, opacity: 0.9 }); const o = i % 3 ? cyl(0.18, 0.18, 0.9, 6, m, 0, 0, 0) : blob(m, 0, 0, 0, 0.6, 0.08, 0.45, true); o.position.set(-24 + r() * 48, 0.15, -12 + r() * 26); o.rotation.set(Math.PI / 2, r() * 3, r()); o.userData.ph = r() * 6; g.add(o); }
        g.userData.debris = true; root.add(g); objs.push({ g });
      }
      if (F.debris === 'oil') {
        const g = new T.Group(), r = srand(33), m = new T.MeshPhongMaterial({ color: 0x0B0D10, shininess: 120, specular: 0x8899AA, transparent: true, opacity: 0, depthWrite: false });
        for (let i = 0; i < 7; i++) { const s = new T.Shape(), n = 9; for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, rr = 3 + r() * 3.5; j ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } const o = new T.Mesh(new T.ShapeGeometry(s), m); o.rotation.x = -Math.PI / 2; o.position.set(-20 + r() * 40, 0.3, -10 + r() * 24); o.renderOrder = 2; g.add(o); }
        g.userData.oil = m; root.add(g); objs.push({ g, oil: m });
      }
      return objs;
    }
    function setState(o) {
      const hab = clamp01(o.hab / 100), popF = clamp01(o.pop / 100), Tk = clamp01((o.T - 1.2) / 3.8);
      st.Tk = Tk; st.hab = hab; st.pop = popF; st.health = clamp01(o.health / 100); st.dead = o.pop <= 0 && !o.noPop ? 1 : 0;
      if (o.fx) setFx(o.fx);
      const T0 = o.T;
      // 기본 강수: 기온이 오르면 눈 → 비
      if (amb.snow) amb.snow.target = 1 - smooth(1.5, 2.6, T0);
      if (amb.rain) amb.rain.target = smooth(2.0, 3.2, T0) * 0.9;
      if (amb.msnow) amb.msnow.target = 0.8;
      if (amb.bubble) amb.bubble.target = 0.55;
      if (biome === 'bear') {
        const n = Math.round(B.floes.length * hab);
        B.floes.forEach((f, i) => { f.mesh.visible = i < n; f.k = 0.55 + 0.45 * hab; f.mesh.scale.set(f.k, 1, f.k); f.ponds.forEach(p => p.m.visible = p.th < Tk * 1.6 - 0.1); });
        B.landMat.color = lerpC(0xF2F6F8, 0x8C8A6A, Tk * 1.2);
        B.rockMat.color = lerpC(0xC9D3DC, 0x6B6F73, Tk * 1.4);
        B.peaks.forEach((p, i) => { if (p.userData.cap) { const k = 1 - smooth(0.15 + (i % 3) * 0.1, 0.85, Tk); p.userData.cap.visible = k > 0.05; p.userData.cap.scale.y = Math.max(0.05, k) * p.userData.cap.userData.h0; } });
        const vis = B.floes.filter(f => f.mesh.visible).sort((a, b) => b.r - a.r);
        const nSeal = hab > 0.55 ? 3 : hab > 0.3 ? 2 : hab > 0.12 ? 1 : 0;
        B.seals.forEach((s, i) => { const f = vis[vis.length - 1 - i]; s.visible = !!f && i < nSeal && vis.length > 3; if (s.visible) { s.position.set(f.x, 0.42, f.z); s.rotation.y = i * 2.1; } });
        if (o.noPop) return;
        populate(Math.min(8, Math.ceil(o.pop / 12)), bearModel, (p, i) => {
          const f = vis[i % Math.max(1, vis.length)];
          if (f) { p.cx = f.x + (i >= vis.length ? 1 : 0); p.cz = f.z; p.cy = 0.47; p.wr = Math.max(0, f.r * f.k * 0.45 - 0.6); } else { p.cx = -14 + i * 4; p.cz = -20; p.cy = 1.8; p.wr = 1.2; }
          p.g.scale.setScalar(i % 3 === 2 ? 0.6 : 0.9);
        });
      } else if (biome === 'penguin') {
        setSlab(2 + 11 * hab);
        B.cracks.forEach((c, i) => c.visible = hab < 0.85 - i * 0.14);
        B.bergs.forEach((b, i) => b.visible = i < 3 + Math.round(4 * (1 - hab)));
        if (o.noPop) return;
        const n = Math.min(16, Math.ceil(o.pop / 6));
        populate(n, penguinModel, (p, i) => {
          const cols = 8, x = -12 + (i % cols) * 3.2 + (Math.floor(i / cols) % 2) * 1.6, z = -19 + Math.floor(i / cols) * 2.2;
          p.cx = x; p.cz = Math.min(z, B.iceEdge - 0.8); p.cy = 0.65; p.g.rotation.y = -Math.PI / 2 + (i % 3 - 1) * 0.3; p.g.scale.setScalar(i % 4 === 3 ? 0.55 : 0.85);
        });
      } else if (biome === 'coral') {
        const health = st.health;
        const sorted = B.corals.slice().sort((a, b) => a.rank - b.rank);
        const alive = Math.round(sorted.length * Math.min(1, popF * 1.15));
        const healthyN = Math.round(alive * health);
        sorted.forEach((c, i) => {
          const m = c.g.userData.m;
          if (i < healthyN) { m.color.set(c.g.userData.col); m.emissive && m.emissive.set(0x000000); }
          else if (i < alive) { m.color.set(0xF6F3EC); }
          else { m.color.set(i % 2 ? 0x7C8461 : 0x8A7F6A); }
          c.state = i < healthyN ? 0 : i < alive ? 1 : 2;
        });
        B.reefFish.forEach((f, i) => f.g.visible = !o.noPop && i < Math.round(12 * popF * health + 1));
        B.rayMat.opacity = 0.35 - Tk * 0.15;
      } else if (biome === 'pollock') {
        setEdge(-16 + 32 * hab);
        if (o.noPop) return;
        const n = Math.min(16, Math.ceil(o.pop / 6));
        populate(n, pollockModel, (p, i) => { p.cx = -6 + (i % 4) * 3; p.cz = Math.min(B.edge - 3, -12 + Math.floor(i / 4) * 2); p.g.scale.setScalar(0.72); });
      }
      applyLook();
    }

    function tick(dt, clock) {
      const t = clock;
      if (B.waterMat) B.waterMat.userData.u.uTime.value = RM ? 0 : t;
      // 효과 서서히 켜고 끄기
      let changed = false;
      const fade = (o, sp) => { const d = o.target - o.level; if (Math.abs(d) > 0.002) { o.level += Math.sign(d) * Math.min(Math.abs(d), dt * sp); changed = true; } };
      for (const k in fx) {
        const f = fx[k]; fade(f, 0.8);
        for (const ob of f.objs) {
          if (ob.p) { ob.p.material.opacity = ob.base * f.level; ob.p.visible = f.level > 0.01; if (ob.p.visible && !RM) ob.step(dt, t); }
          if (ob.g) { ob.g.visible = f.level > 0.01; if (ob.oil) ob.oil.opacity = 0.85 * f.level; else ob.g.children.forEach(c => { c.position.y = 0.15 + Math.sin(t * 1.3 + c.userData.ph) * 0.12; c.rotation.z += dt * 0.2; }); }
        }
      }
      const deadTarget = st.dead; if (Math.abs(st.deadT - deadTarget) > 0.002) { st.deadT += Math.sign(deadTarget - st.deadT) * Math.min(Math.abs(deadTarget - st.deadT), dt * 0.6); changed = true; }
      if (changed) applyLook();
      for (const k in amb) { const s = amb[k]; s.level += (s.target - s.level) * Math.min(1, dt * 1.5); s.p.material.opacity = s.base * s.level * (1 - st.deadT * 0.5); s.p.visible = s.level > 0.02; if (s.p.visible && !RM) s.step(dt, t); }
      if (RM) return;
      if (biome === 'bear' && B.floes) {
        B.floes.forEach(f => { f.mesh.position.y = Math.sin(t * 0.8 + f.ph) * 0.06; f.mesh.rotation.z = Math.sin(t * 0.6 + f.ph) * 0.012; });
        B.pops.forEach(p => { // 얼음 위를 천천히 걷는다
          const sp = p.g.scale.x < 0.7 ? 0.5 : 0.3; p.a += dt * sp;
          const x = p.cx + Math.cos(p.a) * p.wr, z = p.cz + Math.sin(p.a) * p.wr;
          p.g.position.set(x, p.cy + Math.sin(t * 0.8) * 0.04, z);
          p.g.rotation.y = -p.a - Math.PI / 2;
          const sw = p.wr > 0.2 ? Math.sin(t * 5 + p.ph) * 0.35 : 0;
          const L = p.g.userData.legs; if (L) { L[0].rotation.z = sw; L[3].rotation.z = sw; L[1].rotation.z = -sw; L[2].rotation.z = -sw; }
          if (p.g.userData.head) p.g.userData.head.rotation.z = Math.sin(t * 0.9 + p.ph) * 0.12 - 0.05;
        });
        B.seals && B.seals.forEach((s, i) => { if (s.visible) s.rotation.z = Math.sin(t * 0.7 + i) * 0.04; });
      }
      if (biome === 'penguin') B.pops.forEach(p => {
        const wob = Math.sin(t * 5 + p.ph);
        p.g.rotation.z = wob * 0.09; p.g.position.set(p.cx + Math.sin(t * 0.4 + p.ph) * 0.6, p.cy + Math.abs(wob) * 0.04, p.cz);
        const F = p.g.userData.flippers; if (F) { F[0].rotation.x = 0.2 + Math.max(0, Math.sin(t * 2.2 + p.ph)) * 0.5; F[1].rotation.x = -0.2 - Math.max(0, Math.sin(t * 2.2 + p.ph)) * 0.5; }
        if (p.g.userData.head) p.g.userData.head.rotation.y = Math.sin(t * 0.6 + p.ph * 2) * 0.4;
      });
      if (biome === 'pollock') {
        B.pops.forEach(p => { const a = t * 0.5 + p.i * 0.7; p.g.position.set(p.cx + Math.cos(a) * 3, -1.4 + Math.sin(t * 1.3 + p.i) * 0.15, p.cz + Math.sin(a) * 1.4); p.g.rotation.y = -a - Math.PI / 2; if (p.g.userData.tail) p.g.userData.tail.rotation.y = Math.sin(t * 9 + p.i) * 0.45; });
        if (B.boat) { B.boat.position.y = 0.15 + Math.sin(t * 1.1) * 0.12; B.boat.rotation.z = Math.sin(t * 0.9) * 0.05; B.boat.position.x = 12 + Math.sin(t * 0.05) * 6; }
      }
      if (biome === 'coral') {
        B.reefFish.forEach(f => { f.a += dt * f.sp; f.g.position.set(f.cx + Math.cos(f.a) * f.rad, f.y, f.cz + Math.sin(f.a) * f.rad * 0.5); f.g.rotation.y = -f.a - Math.PI / 2; if (f.g.userData.tail) f.g.userData.tail.rotation.y = Math.sin(t * 10 + f.a) * 0.5; });
        B.corals.forEach(c => { const s = c.g.userData.sway; if (s && c.state !== 2) s.rotation.z = Math.sin(t * 1.2 + c.g.userData.ph) * 0.12; });
        B.rays.forEach(r => { r.m.rotation.z = 0.35 + Math.sin(t * 0.3 + r.ph) * 0.08; });
      }
    }

    return { build: buildBiome, setState, setFx, setEdge, setSlab, tick, get B() { return B; }, get root() { return root; }, get popGroup() { return popGroup; }, get biome() { return biome; } };
  }
  const SKIES = {
    bear:    { sky: 0xD5E6F0, top: 0x7FB2D9, water: 0x1B4F72 },
    penguin: { sky: 0xDCE8F2, top: 0x8DB5DB, water: 0x1E4C74 },
    coral:   { sky: 0xBDE6F2, top: 0x4BA8DA, water: 0x0B86BC },
    pollock: { sky: 0xC3D7E8, top: 0x6B97C2, water: 0x154A84 },
  };

  let H = null;
  function buildBiome(key) {
    H.build(key); B = H.B; root = H.root; popGroup = H.popGroup; biome = key;
  }
  function setEdge(e) { H.setEdge(e); }
  function setSlab(d) { H.setSlab(d); }
  function setState(o) { if (!inited || mode !== 'diorama') return; H.setState(o); }

  // ---------- 효과음 (WebAudio, 작게) ----------
  let actx = null, muted = false;
  try { muted = localStorage.getItem('cg-sfx-off') === '1'; } catch (e) {}
  function sfxInit() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; } }
  function sfx(kind) {
    if (!actx || muted) return;
    const t0 = actx.currentTime;
    const tone = (f, s, d, vol, type, f2) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0 + s); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + s + d); g.gain.setValueAtTime(0, t0 + s); g.gain.linearRampToValueAtTime(vol, t0 + s + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + s + d); o.connect(g).connect(actx.destination); o.start(t0 + s); o.stop(t0 + s + d + 0.05); };
    if (kind === 'pick') { tone(660, 0, 0.09, 0.06); tone(990, 0.06, 0.12, 0.05); }
    else if (kind === 'special') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.18, 0.06, 'triangle'));
    else if (kind === 'hit') { tone(180, 0, 0.25, 0.09, 'sawtooth', 70); }
    else if (kind === 'count') tone(440, 0, 0.12, 0.06, 'square');
    else if (kind === 'go') tone(880, 0, 0.3, 0.07, 'square');
    else if (kind === 'tick') tone(1200, 0, 0.04, 0.03, 'square');
    else if (kind === 'end') [784, 659, 523].forEach((f, i) => tone(f, i * 0.12, 0.2, 0.06, 'triangle'));
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
    } else {
      const needH = half / Math.tan(T.MathUtils.degToRad(camera.fov / 2)) / asp;
      const needV = (deep0 ? 21 : 18) / Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      const d = Math.max(needH, needV) * 1.04, cz = deep0 ? -3 : 0;
      camera.position.set(0, d * 0.9, cz + d * 0.42); camera.lookAt(0, 0, cz - 1.2);
    }
    A.camBase = camera.position.clone();
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

  // ---------- 화면 위 글자 효과(카운트다운 · +1) ----------
  function fxText(html, cls, life) { if (!fxLayer) return null; const d = document.createElement('div'); d.className = cls; d.innerHTML = html; fxLayer.appendChild(d); setTimeout(() => d.remove(), life || 900); return d; }
  function fxAt(v3, html, cls) {
    if (!fxLayer) return; const p = v3.clone().project(camera), r = canvas.getBoundingClientRect();
    const d = fxText(html, 'w3d-pop ' + (cls || ''), 950); if (!d) return;
    d.style.left = ((p.x + 1) / 2 * r.width) + 'px'; d.style.top = ((1 - p.y) / 2 * r.height) + 'px';
  }
  function muteBtn() {
    if (!fxLayer) return;
    const b = document.createElement('button'); b.className = 'w3d-mute'; b.type = 'button';
    const lab = () => { b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-label', muted ? '효과음 켜기' : '효과음 끄기'); };
    lab(); b.onclick = e => { e.stopPropagation(); muted = !muted; try { localStorage.setItem('cg-sfx-off', muted ? '1' : '0'); } catch (er) {} lab(); };
    b.addEventListener('pointerdown', e => e.stopPropagation());
    fxLayer.appendChild(b);
  }

  // ---------- 60초 아레나 ----------
  let A = {};
  const BOUND = { x: 24, z: 15 };
  function startArena(key, cbs) {
    if (!init()) { cbs.onEnd({ food: 8, special: 1, damage: 15, skipped: true }); return; }
    sfxInit();
    buildBiome(key); mode = 'arena';
    H.setState({ hab: 100, pop: 50, health: 100, T: 1.35, noPop: true });
    (B.seals || []).forEach(s => s.visible = false);
    arenaGroup = new T.Group(); root.add(arenaGroup);
    popGroup.clear && popGroup.clear(); B.pops = [];
    const r = srand(Date.now() & 0xffff);
    A = { key, r, cbs, t: 0, pre: RM ? 0.6 : 3.4, dur: 60, food: 0, special: 0, damage: 0, inv: 0, keys: {}, target: null, pointer: false, items: [], hazards: [], bursts: [], status: '', ended: false, shake: 0, lastSec: 61, lastCount: 4 };
    let pm;
    if (key === 'bear') { pm = bearModel(); pm.scale.setScalar(1.15); const f = B.floes[Math.floor(B.floes.length / 2)]; A.pos = new T.Vector3(f.x, 0, f.z); }
    else if (key === 'penguin') { pm = penguinModel(); pm.scale.setScalar(1.2); A.pos = new T.Vector3(0, 0, -15); setSlab(13); }
    else if (key === 'coral') { pm = larvaModel(); pm.scale.setScalar(1.1); A.pos = new T.Vector3(0, 0, 8); }
    else { pm = pollockModel(); pm.scale.setScalar(1.25); A.pos = new T.Vector3(0, 0, -6); setEdge(16); }
    A.player = pm; arenaGroup.add(pm);
    // 내 위치 표시 고리
    A.ring = new T.Mesh(geo('ringG', () => new T.RingGeometry(1.5, 1.85, 32)), new T.MeshBasicMaterial({ color: 0xFFD166, transparent: true, opacity: 0.85, depthWrite: false })); A.ring.rotation.x = -Math.PI / 2; A.ring.renderOrder = 4; arenaGroup.add(A.ring);
    const sk = { bear: 'den', penguin: 'colony', coral: 'symb', pollock: 'spawn' }[key];
    const spots = { bear: [[-14, -19], [13, -19]], penguin: [[-17, -18.5], [16, -18.5]], coral: [[-20, -10], [18, -11], [-16, 11], [20, 9], [0, -12]], pollock: [[-21, -12], [-21, -2]] }[key];
    spots.forEach(([x, z]) => addItem(sk, x, z, true));
    for (let i = 0; i < 9; i++) spawnFood();
    if (key === 'penguin') for (let i = 0; i < 2; i++) { const g = sealModel(true); g.scale.setScalar(1.1); arenaGroup.add(g); A.hazards.push({ g, x: -10 + i * 20, z: 8, vx: 0, vz: 0, kind: 'seal' }); }
    if (key === 'coral') {
      for (let i = 0; i < 3; i++) { const m = new T.Mesh(geo('heatG', () => new T.CircleGeometry(1, 32)), new T.MeshBasicMaterial({ color: 0xFF4D2E, transparent: true, opacity: 0.32, depthWrite: false })); m.rotation.x = -Math.PI / 2; const x = [-10, 12, 2][i], z = [4, -4, 11][i]; m.position.set(x, 0.12, z); arenaGroup.add(m); A.hazards.push({ g: m, x, z, kind: 'heat', r0: 2.5 }); }
      for (let i = 0; i < 2; i++) { const g = starfishModel(); arenaGroup.add(g); A.hazards.push({ g, x: i ? 18 : -18, z: i ? 10 : -10, kind: 'star' }); }
    }
    if (key === 'pollock') for (let i = 0; i < 2; i++) {
      const g = new T.Group(); const m = new T.MeshBasicMaterial({ color: 0xDDE6EE, transparent: true, opacity: 0.55, wireframe: true });
      g.add(new T.Mesh(new T.BoxGeometry(10, 1.2, 1.4, 10, 2, 2), m));
      g.add(mesh(new T.BoxGeometry(10.4, 0.15, 0.15), mat(0xF4A261), 0, 0.65, 0));
      for (let k = 0; k < 5; k++) g.add(blob(mat(0xF4A261), -4 + k * 2, 0.75, 0, 0.18, 0.18, 0.18, true));
      arenaGroup.add(g); A.hazards.push({ g, x: i ? 10 : -10, z: i ? 6 : -4, kind: 'net', dir: i ? -1 : 1 });
    }
    if (fxLayer) { fxLayer.innerHTML = ''; muteBtn(); A.countEl = fxText('', 'w3d-count', 99999); }
    arenaCamera();
  }
  function addItem(kind, x, z, special) {
    const s = new T.Sprite(iconMat(kind)); s.scale.set(2.1, 2.1, 1); s.position.set(x, 1.2, z); s.renderOrder = 5; arenaGroup.add(s);
    let halo = null;
    if (special) { halo = new T.Sprite(new T.SpriteMaterial({ map: tex().soft, color: 0x5CF29A, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending })); halo.scale.set(4.5, 4.5, 1); halo.position.set(x, 1.2, z); arenaGroup.add(halo); }
    A.items.push({ s, halo, kind, x, z, special, ph: Math.random() * 6, floe: null });
  }
  function burst(x, z, col) { // 주웠을 때 퍼지는 고리
    const m = new T.Mesh(geo('ringB', () => new T.RingGeometry(0.6, 0.9, 28)), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.6, z); arenaGroup.add(m); A.bursts.push({ m, t: 0 });
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
    // 3·2·1 시작 신호
    if (A.pre > 0) {
      A.pre -= realDt; const n = Math.ceil(A.pre - 0.4);
      if (n !== A.lastCount) { A.lastCount = n; if (A.countEl) { A.countEl.textContent = n > 0 ? n : '시작!'; A.countEl.classList.remove('go'); void A.countEl.offsetWidth; A.countEl.classList.add('go'); } sfx(n > 0 ? 'count' : 'go'); }
      if (A.pre <= 0 && A.countEl) setTimeout(() => A.countEl && A.countEl.remove(), 500);
      A.player.position.set(A.pos.x, A.key === 'bear' ? 0.47 : A.key === 'penguin' ? 0.65 : 0.3, A.pos.z);
      A.ring.position.set(A.pos.x, 0.5, A.pos.z); A.ring.scale.setScalar(1 + Math.sin(clock * 6) * 0.1);
      if (A.cbs.onTick) A.cbs.onTick({ left: A.dur, food: 0, special: 0, damage: 0, status: '준비…', hurt: false });
      return;
    }
    A.t += realDt; const prog = Math.min(1, A.t / A.dur), key = A.key;
    if (key === 'bear') B.floes.forEach(f => { f.k = 1 - 0.5 * prog; f.mesh.scale.set(f.k, 1, f.k); });
    if (key === 'penguin') setSlab(13 - 6 * prog);
    if (key === 'pollock') setEdge(16 - 19 * prog);
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
    const p = A.player, moving = !!(vx || vz);
    let y = 0.3;
    if (key === 'bear') y = inWater ? -0.55 : (A.pos.z < -17.2 ? 1.8 : 0.47);
    if (key === 'penguin') { y = inWater ? 0.05 : 0.65; p.rotation.z = inWater ? -1.35 : (moving ? Math.sin(clock * 12) * 0.12 : 0); }
    if (key === 'coral') y = 0.2 + Math.sin(clock * 3) * 0.12;
    if (key === 'pollock') { y = 0.25; if (p.userData.tail) p.userData.tail.rotation.y = Math.sin(clock * (moving ? 16 : 6)) * 0.5; }
    if (key === 'bear' && p.userData.legs) { const sw = moving ? Math.sin(clock * 10) * 0.45 : 0, L = p.userData.legs; L[0].rotation.z = sw; L[3].rotation.z = sw; L[1].rotation.z = -sw; L[2].rotation.z = -sw; }
    p.position.set(A.pos.x, y, A.pos.z);
    if (moving) p.rotation.y = Math.atan2(-vz, vx);
    p.visible = A.inv <= 0 || Math.floor(clock * 12) % 2 === 0;
    A.ring.position.set(A.pos.x, Math.max(0.2, y + 0.05), A.pos.z); A.ring.material.color.set(A.inv > 0 ? 0xFF4D4D : status && /줄어|위험/.test(status) ? 0xFF9F43 : 0xFFD166);
    if (A.inv > 0) A.inv -= dt;
    for (const it of A.items) {
      if (it.dead) continue;
      if (it.floe) { it.x = it.floe.x + it.ox * it.floe.k; it.z = it.floe.z + it.oz * it.floe.k; if (it.floe.r * it.floe.k < 1.2) { it.dead = true; arenaGroup.remove(it.s); continue; } }
      it.s.position.set(it.x, 1.25 + Math.sin(clock * 3 + it.ph) * 0.2, it.z);
      if (it.special) { const sc = 2.3 + Math.sin(clock * 4 + it.ph) * 0.2; it.s.scale.set(sc, sc, 1); if (it.halo) { it.halo.material.opacity = 0.45 + Math.sin(clock * 4 + it.ph) * 0.2; } }
      if (Math.hypot(it.x - A.pos.x, it.z - A.pos.z) < 1.7) {
        it.dead = true; arenaGroup.remove(it.s); if (it.halo) arenaGroup.remove(it.halo);
        if (it.special) A.special++; else A.food++;
        burst(it.x, it.z, it.special ? 0x5CF29A : 0xFFC23D);
        fxAt(new T.Vector3(it.x, 2.2, it.z), it.special ? '★ +1' : '+1', it.special ? 'sp' : '');
        sfx(it.special ? 'special' : 'pick');
        if (A.cbs.onPick) A.cbs.onPick(it.special);
      }
    }
    A.items = A.items.filter(i => !i.dead || i.special);
    const alive = A.items.filter(i => !i.dead && !i.special).length;
    if (alive < 8 && Math.random() < dt * 3) spawnFood();
    for (const b of A.bursts) { b.t += dt; b.m.scale.setScalar(1 + b.t * 7); b.m.material.opacity = Math.max(0, 0.9 - b.t * 2.2); }
    A.bursts = A.bursts.filter(b => { if (b.t > 0.45) { arenaGroup.remove(b.m); b.m.material.dispose(); return false; } return true; });
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
        const rr = h.r0 + prog * 5.5; h.g.scale.set(rr, rr, 1); h.g.material.opacity = 0.26 + Math.sin(clock * 4) * 0.06;
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
    // 화면 흔들림
    if (A.camBase) { if (A.shake > 0) { A.shake -= dt; const s = A.shake * 1.6; camera.position.set(A.camBase.x + (Math.random() - 0.5) * s, A.camBase.y + (Math.random() - 0.5) * s, A.camBase.z + (Math.random() - 0.5) * s); } else camera.position.copy(A.camBase); }
    const left = Math.max(0, A.dur - A.t), sec = Math.ceil(left);
    if (sec !== A.lastSec) { A.lastSec = sec; if (sec <= 10 && sec > 0) sfx('tick'); }
    A.status = A.flash && A.flash.t > clock ? A.flash.msg : status;
    if (A.cbs.onTick) A.cbs.onTick({ left, food: A.food, special: A.special, damage: Math.round(A.damage), status: A.status, hurt: !!(A.flash && A.flash.t > clock) || /줄어|위험/.test(status) });
    if (A.t >= A.dur) endArena();
  }
  function hit(n, msg) { A.damage += n; A.inv = 1.4; A.shake = 0.35; A.flash = { msg, t: clock + 1.2 }; sfx('hit'); try { navigator.vibrate && navigator.vibrate(70); } catch (e) {} fxAt(new T.Vector3(A.pos.x, 2.4, A.pos.z), '−' + n, 'hurt'); if (A.cbs.onHit) A.cbs.onHit(msg); }
  function endArena() {
    if (A.ended) return; A.ended = true;
    const res = { food: A.food, special: A.special, damage: Math.round(A.damage) };
    sfx('end');
    stopArena();
    if (A.cbs.onEnd) A.cbs.onEnd(res);
  }
  function stopArena() {
    if (mode !== 'arena') return;
    mode = 'diorama'; if (arenaGroup) { root.remove(arenaGroup); arenaGroup = null; }
    if (fxLayer) fxLayer.innerHTML = '';
    buildBiome(A.key); placeCamera();
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

  // ---------- 초기화 · 루프 ----------
  function init() {
    if (inited || failed) return !failed;
    stage = document.createElement('div'); stage.className = 'w3d';
    stage.innerHTML = '<canvas aria-label="3D 서식지 화면"></canvas><div class="w3d-fx" aria-live="polite"></div>';
    canvas = stage.querySelector('canvas'); fxLayer = stage.querySelector('.w3d-fx');
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true }); } catch (e) { failed = true; return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); scene.fog = new T.Fog(0xC9E0EE, 90, 200);
    camera = new T.PerspectiveCamera(40, 16 / 9, 0.5, 500);
    hemi = new T.HemisphereLight(0xFFFFFF, 0x445566, 0.62); scene.add(hemi);
    sun = new T.DirectionalLight(0xFFF2DD, 0.9); sun.position.set(25, 45, 20); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 140 }); sun.shadow.bias = -0.0008; scene.add(sun);
    H = makeHabitat(scene, sun, hemi);
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
    if (mode === 'arena') { arenaFrame(dt, realDt); H.tick(dt, clock); }
    else {
      if (autoRot && !autoRotPaused) { cam.theta += dt * 0.08; placeCamera(); }
      H.tick(dt, clock);
    }
    renderer.render(scene, camera);
  }

  return {
    available() { return init(); },
    element() { return stage; },
    setBiome(key) { if (init() && key !== biome && mode === 'diorama') buildBiome(key); },
    setState(o) { if (init()) setState(o); },
    setAutoRotate(on) { autoRot = !!on && !RM; autoRotPaused = false; },
    startArena, stopArena,
    makeHabitat, SKIES, srand,
    get mode() { return mode; },
  };
})();
