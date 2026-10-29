// ===== 3D 도시 뷰 (Three.js r128) =====
const City3D = (function () {
  const T = window.THREE;
  let inited = false, failed = !T;
  let stage, canvas, renderer, scene, camera, sun, hemi, labelsEl, tipEl, hudEl;
  let groundMat, cloudMat;
  const cbs = { onPad() {}, onPlant() {} };
  const cam = { theta: 0.85, phi: 0.92, r: 88, tx: -3, tz: -1 };
  const PADS = {
    city:     [[15, -6], [15, 0], [15, 6]],
    suburb:   [[-10.5, 21], [-3.5, 21], [3.5, 21], [10.5, 21]],
    coast:    [[-24, -9], [-24, 0], [-24, 9]],
    mountain: [[-6, -23], [6, -23]],
  };
  const HUB = { city: [8.5, 0], suburb: [0, 8.5], coast: [-8.5, 0], mountain: [0, -8.5] };
  const ZONE_LABEL = { city: [15, 10.6], suburb: [0, 25.6], coast: [-24, 13.6], mountain: [0, -23] };
  const SKY = {
    sunny:   { sky: 0x9ED2F2, sun: 0.85, hemi: 0.55, clouds: 4,  cloudCol: 0xFFFFFF, drift: 1.2 },
    cloudy:  { sky: 0xA9B4BF, sun: 0.3, hemi: 0.62, clouds: 16, cloudCol: 0x9AA4AE, drift: 1.5 },
    windy:   { sky: 0xA3CDEB, sun: 0.8, hemi: 0.55, clouds: 9,  cloudCol: 0xF2F5F8, drift: 7 },
    calm:    { sky: 0xC3DFEC, sun: 0.82, hemi: 0.55, clouds: 3, cloudCol: 0xFFFFFF, drift: 0.3 },
    drought: { sky: 0xE8CC96, sun: 0.95, hemi: 0.55, clouds: 1, cloudCol: 0xFFF6E6, drift: 0.8 },
  };

  const world = { pads: [], plants: new Map(), lineGroup: null, buildings: [], clouds: [], rain: null, essGroup: null, labels: [], pulses: [] };
  let state = { weather: 'sunny', windF: 1, coverage: 1, buildCount: 0, sig: '' };
  let firstSync = true, clock = 0, last = 0;
  const matCache = {};
  function mat(c) { return matCache[c] || (matCache[c] = new T.MeshLambertMaterial({ color: c })); }
  let ghostMat;

  // ---- 시드 난수 ----
  function srand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function box(w, h, d, m, x, y, z) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; }
  function cyl(rt, rb, h, m, x, y, z, seg) { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 14), m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; return o; }

  // ---- 창문 텍스처 ----
  function winCanvas(mode) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = mode === 'em' ? '#000' : '#fff'; x.fillRect(0, 0, 64, 64);
    const r = srand(mode === 'dark' ? 7 : 3);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) {
      const on = r() < 0.82;
      if (mode === 'lit') x.fillStyle = on ? '#FFE7A3' : '#56687A';
      else if (mode === 'em') x.fillStyle = on ? '#FFC94D' : '#000';
      else x.fillStyle = '#3B4857';
      x.fillRect(3 + k * 16, 3 + i * 16, 10, 10);
    }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  let bMats;
  function buildingMats() {
    const lit = winCanvas('lit'), em = winCanvas('em'), dark = winCanvas('dark');
    const tones = [0xE6EBF0, 0xD3DCE6, 0xEBE2D6];
    const roof = mat(0x7D8A97);
    bMats = tones.map(c => ({
      lit: new T.MeshLambertMaterial({ color: c, map: lit, emissive: 0xFFFFFF, emissiveMap: em, emissiveIntensity: 0.85 }),
      dark: new T.MeshLambertMaterial({ color: c, map: dark }),
      roof,
    }));
  }
  function scaleBoxUV(geo, w, h, d) {
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      if (f === 2 || f === 3) continue;
      const span = (f < 2) ? d : w;
      for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * span / 2, uv.getY(i) * h / 2); }
    }
    uv.needsUpdate = true;
  }

  // ---- 지형 ----
  function terrain() {
    groundMat = new T.MeshLambertMaterial({ color: 0x6E9E58 });
    const g = new T.Mesh(new T.PlaneGeometry(220, 220), groundMat); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
    const sea = new T.Mesh(new T.PlaneGeometry(80, 220), new T.MeshLambertMaterial({ color: 0x2F78B5 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-70, 0.06, 0); scene.add(sea);
    const beach = new T.Mesh(new T.PlaneGeometry(4, 220), mat(0xE2D3A6)); beach.rotation.x = -Math.PI / 2; beach.position.set(-29, 0.04, 0); scene.add(beach);
    // 도심 바닥과 도로
    const plaza = new T.Mesh(new T.PlaneGeometry(16, 16), mat(0x5E6873)); plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; plaza.receiveShadow = true; scene.add(plaza);
    const blockM = mat(0xB9C1C9);
    for (const bx of [-5, 0, 5]) for (const bz of [-5, 0, 5]) { const b = new T.Mesh(new T.PlaneGeometry(4.2, 4.2), blockM); b.rotation.x = -Math.PI / 2; b.position.set(bx, 0.05, bz); b.receiveShadow = true; scene.add(b); }
    // 산
    const r = srand(11);
    for (let i = 0; i < 9; i++) {
      const h = 9 + r() * 10, rad = 7 + r() * 5, x = -40 + i * 10 + r() * 4, z = -38 - r() * 10;
      const m = new T.Mesh(new T.ConeGeometry(rad, h, 7), mat(i % 2 ? 0x6C8A5F : 0x5F7D56)); m.position.set(x, h / 2, z); m.castShadow = true; scene.add(m);
      const cap = new T.Mesh(new T.ConeGeometry(rad * 0.28, h * 0.28, 7), mat(0xF4F6F7)); cap.position.set(x, h - h * 0.14 + 0.02, z); scene.add(cap);
    }
    // 나무
    const trunk = mat(0x7A5A3C), leafA = mat(0x3F7F4A), leafB = mat(0x4E9455);
    const coneG = new T.ConeGeometry(0.9, 2.2, 7), trunkG = new T.CylinderGeometry(0.12, 0.15, 0.7, 6);
    let placed = 0, tries = 0;
    while (placed < 90 && tries < 2000) {
      tries++;
      const x = -27 + r() * 62, z = -30 + r() * 60;
      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
      if (nearPadOrLine(x, z)) continue;
      const t1 = new T.Mesh(trunkG, trunk); t1.position.set(x, 0.35, z);
      const t2 = new T.Mesh(coneG, r() < 0.5 ? leafA : leafB); t2.position.set(x, 1.6, z); t2.castShadow = true;
      const s = 0.7 + r() * 0.6; t2.scale.set(s, s, s);
      scene.add(t1, t2); placed++;
    }
    // 교외 주택
    const wallM = [mat(0xF1E7D8), mat(0xE3EDF2), mat(0xF4DCCB)], roofM = [mat(0xB0563F), mat(0x546A82)];
    const pyr = new T.ConeGeometry(0.95, 0.8, 4);
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1, x = side * (13 + r() * 9), z = 9 + r() * 9;
      if (nearPadOrLine(x, z)) continue;
      const h = box(1.3, 0.9, 1.3, wallM[i % 3], x, 0.45, z); scene.add(h);
      const rf = new T.Mesh(pyr, roofM[i % 2]); rf.position.set(x, 1.3, z); rf.rotation.y = Math.PI / 4; rf.castShadow = true; scene.add(rf);
    }
  }
  function nearPadOrLine(x, z) {
    for (const s in PADS) for (const [px, pz] of PADS[s]) {
      if (Math.abs(x - px) < 4.2 && Math.abs(z - pz) < 4.2) return true;
      const [hx, hz] = HUB[s];
      // 송전선 경로 근처
      const dx = hx - px, dz = hz - pz, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - px) * dx + (z - pz) * dz) / L2));
      const qx = px + t * dx - x, qz = pz + t * dz - z;
      if (qx * qx + qz * qz < 2.2) return true;
    }
    if (x < -27.5) return true;
    return false;
  }

  // ---- 부지 패드 ----
  function padTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#D9DEE3'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#8D99A6'; x.lineWidth = 5; x.setLineDash([12, 9]); x.strokeRect(8, 8, 112, 112);
    return new T.CanvasTexture(c);
  }
  function plusSpriteMat(col) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = col || '#2F6BFF'; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 6; x.stroke();
    x.lineWidth = 13; x.lineCap = 'round'; x.beginPath(); x.moveTo(64, 36); x.lineTo(64, 92); x.moveTo(36, 64); x.lineTo(92, 64); x.stroke();
    return new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: true });
  }
  let padTex, padUsedMat, smBlue, smGreen, toolSet = null, canBuildFlag = false, autoRot = false;
  function makePads() {
    padTex = padTexture(); padUsedMat = mat(0xA9B2BB); smBlue = plusSpriteMat('#2F6BFF'); smGreen = plusSpriteMat('#16A36A'); const sm = smBlue;
    for (const site in PADS) PADS[site].forEach(([x, z], i) => {
      const m = new T.MeshLambertMaterial({ color: 0xFFFFFF, map: padTex, emissive: 0x000000 });
      const p = new T.Mesh(new T.BoxGeometry(4.8, 0.16, 4.8), [padUsedMat, padUsedMat, m, padUsedMat, padUsedMat, padUsedMat]);
      p.position.set(x, 0.08, z); p.receiveShadow = true;
      const sp = new T.Sprite(sm); sp.scale.set(2, 2, 1); sp.position.set(0, 1.7, 0); p.add(sp);
      p.userData = { kind: 'pad', site, idx: i, topMat: m, empty: true, sprite: sp, phase: i * 0.7 + x * 0.1 };
      scene.add(p); world.pads.push(p);
    });
  }

  // ---- 발전소 모델 ----
  function plantModel(type, ghost) {
    const g = new T.Group(); const M = c => ghost ? ghostMat : mat(c);
    const em = []; const rotors = [];
    if (type === 'coal') {
      g.add(box(3.2, 2, 2.2, M(0x8C7B6B), 0, 1, 0.5));
      g.add(box(1.4, 1.2, 1.2, M(0x6E6155), -1.2, 0.6, -1.2));
      for (const cx of [-0.2, 1.1]) { g.add(cyl(0.3, 0.42, 5.4, M(0xDCD5CB), cx, 2.7, -1.2)); g.add(cyl(0.31, 0.31, 0.5, M(0xC23A33), cx, 5.1, -1.2)); em.push([cx, 5.6, -1.2]); }
      const pile = new T.Mesh(new T.ConeGeometry(1, 0.9, 8), M(0x26262A)); pile.position.set(1.3, 0.45, 1.7); g.add(pile);
    } else if (type === 'lng') {
      for (const tx of [-1.1, 1.0]) { g.add(cyl(0.95, 0.95, 1.7, M(0xEDF1F4), tx, 0.85, -0.9)); const cap = new T.Mesh(new T.SphereGeometry(0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xEDF1F4)); cap.scale.y = 0.45; cap.position.set(tx, 1.7, -0.9); g.add(cap); }
      g.add(box(2.8, 1.4, 1.4, M(0x93A3B3), -0.2, 0.7, 1.2));
      g.add(cyl(0.18, 0.24, 3.6, M(0xCFD6DD), 1.5, 1.8, 1.3)); em.push([1.5, 3.7, 1.3]);
    } else if (type === 'nuclear') {
      const prof = [[1.8, 0], [1.35, 1.6], [1.08, 3.1], [1.22, 4.8]].map(p => new T.Vector2(p[0], p[1]));
      const tw = new T.Mesh(new T.LatheGeometry(prof, 28), ghost ? ghostMat : new T.MeshLambertMaterial({ color: 0xDCDCD6, side: T.DoubleSide }));
      tw.position.set(-0.8, 0, -0.7); tw.castShadow = true; g.add(tw); em.push([-0.8, 5.0, -0.7]);
      g.add(cyl(0.9, 0.9, 1.3, M(0xE7EAED), 1.2, 0.65, 1.0));
      const dome = new T.Mesh(new T.SphereGeometry(0.9, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), M(0xF2F4F6)); dome.position.set(1.2, 1.3, 1.0); dome.castShadow = true; g.add(dome);
      g.add(box(1.4, 0.9, 1.0, M(0x8E99A6), 1.3, 0.45, -1.2));
    } else if (type === 'solar') {
      const panel = M(0x1D3C72), post = M(0x9AA4AE);
      for (const px of [-1.4, 0, 1.4]) for (const pz of [-1.4, 0, 1.4]) {
        const p = box(1.25, 0.06, 0.95, panel, px, 0.6, pz); p.rotation.x = 0.5; g.add(p);
        g.add(box(0.08, 0.55, 0.08, post, px, 0.28, pz));
      }
      g.userData.panel = panel;
    } else if (type === 'wind') {
      for (const [x, z, h] of [[-0.9, -0.8, 6.4], [1.2, 1.0, 5.2]]) {
        g.add(cyl(0.1, 0.2, h, M(0xF4F6F8), x, h / 2, z, 10));
        g.add(box(0.36, 0.32, 0.8, M(0xE8ECEF), x, h, z));
        const rot = new T.Group(); rot.position.set(x, h, z + 0.45);
        const hub = new T.Mesh(new T.SphereGeometry(0.17, 10, 8), M(0xFFFFFF)); rot.add(hub);
        for (let i = 0; i < 3; i++) { const b = box(0.16, 2.5, 0.05, M(0xFAFBFC), 0, 1.25, 0); const arm = new T.Group(); arm.add(b); arm.rotation.z = i * Math.PI * 2 / 3; rot.add(arm); }
        g.add(rot); rotors.push(rot);
      }
    } else if (type === 'hydro') {
      g.add(box(4.6, 3.3, 0.9, M(0xCAC6BD), 0, 1.65, 0.6));
      g.add(box(4.6, 0.25, 3.0, M(0x3B7FC6), 0, 2.85, -1.4));
      g.add(box(1.0, 2.9, 0.08, M(0xE4F2FB), 0, 1.5, 1.1));
      g.add(box(1.6, 0.9, 1.0, M(0x8F9CAA), 1.4, 0.45, 1.8));
      g.add(box(0.9, 4.0, 4.2, M(0x6C8A5F), -2.75, 2.0, -0.7));
      g.add(box(0.9, 4.0, 4.2, M(0x6C8A5F), 2.75, 2.0, -0.7));
    } else if (type === 'tidal') {
      g.add(box(8.5, 0.9, 1.1, M(0xBEC3C8), -4.6, 0.45, 0));
      for (let i = 0; i < 5; i++) g.add(box(0.55, 1.15, 1.2, M(0x56677A), -2 - i * 1.5, 0.58, 0));
      g.add(box(1.8, 1.4, 1.6, M(0x8FA0B0), 0.6, 0.7, 0));
    }
    if (ghost) {
      const y = mat(0xF2B705);
      g.add(box(0.18, 7, 0.18, y, 1.9, 3.5, 1.9));
      g.add(box(4, 0.14, 0.14, y, 0.7, 7, 1.9));
      g.add(box(0.06, 2.5, 0.06, mat(0x333333), -0.9, 5.75, 1.9));
    }
    g.userData.emitters = em; g.userData.rotors = rotors;
    return g;
  }

  // ---- 연기 ----
  const puffGeo = () => (puffGeo.g || (puffGeo.g = new T.SphereGeometry(0.5, 10, 8)));
  function addSmoke(group, color) {
    group.userData.puffs = [];
    for (const e of group.userData.emitters) for (let i = 0; i < 7; i++) {
      const m = new T.Mesh(puffGeo(), new T.MeshLambertMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
      m.userData = { base: e, age: i / 7 };
      group.add(m); group.userData.puffs.push(m);
    }
  }

  // ---- 송전선 ----
  function towerAt(parent, x, z, ang, hv) {
    const c = hv ? 0x5A6470 : 0x7C8792, h = hv ? 3.0 : 2.3;
    const tw = new T.Group(); tw.position.set(x, 0, z); tw.rotation.y = ang;
    tw.add(box(0.14, h, 0.14, mat(c), 0, h / 2, 0));
    tw.add(box(hv ? 1.5 : 1.0, 0.09, 0.09, mat(c), 0, h - 0.15, 0));
    parent.add(tw); return h - 0.15;
  }
  function rebuildLines(plants, hv) {
    if (world.lineGroup) { scene.remove(world.lineGroup); world.lineGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const lg = new T.Group(); world.lineGroup = lg; scene.add(lg);
    world.pulses = [];
    const wireMat = new T.MeshBasicMaterial({ color: hv ? 0xF2B705 : 0x4A535C });
    const pulseGeo = new T.SphereGeometry(hv ? 0.3 : 0.26, 10, 8);
    // 변전소
    for (const s in HUB) {
      const [hx, hz] = HUB[s];
      lg.add(box(1.5, 0.9, 1.5, mat(0x8B98A5), hx, 0.45, hz));
      lg.add(cyl(0.22, 0.22, 0.6, mat(0x5D6875), hx - 0.35, 1.2, hz)); lg.add(cyl(0.22, 0.22, 0.6, mat(0x5D6875), hx + 0.35, 1.2, hz));
    }
    for (const p of plants) {
      const [px, pz] = PADS[p.site][p.slot], [hx, hz] = HUB[p.site];
      const sx = px + (hx - px) * (2.6 / Math.hypot(hx - px, hz - pz)), sz = pz + (hz - pz) * (2.6 / Math.hypot(hx - px, hz - pz));
      const L = Math.hypot(hx - sx, hz - sz), n = Math.max(1, Math.round(L / 6.5)), ang = Math.atan2(hx - sx, hz - sz) + Math.PI / 2;
      const tops = [];
      for (let i = 0; i <= n; i++) { const t = i / n, x = sx + (hx - sx) * t, z = sz + (hz - sz) * t; const h = i === n ? 1.0 : towerAt(lg, x, z, ang, hv); tops.push(new T.Vector3(x, h, z)); }
      const pts = [];
      for (let i = 0; i < tops.length - 1; i++) for (let k = 0; k < 8; k++) { const t = k / 8; const a = tops[i], b = tops[i + 1]; pts.push(new T.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * 0.45, a.z + (b.z - a.z) * t)); }
      pts.push(tops[tops.length - 1]);
      const curve = new T.CatmullRomCurve3(pts);
      const tube = new T.Mesh(new T.TubeGeometry(curve, pts.length * 2, hv ? 0.07 : 0.04, 5, false), wireMat); lg.add(tube);
      const lossF = SITES[p.site].loss * (hv ? 0.25 : 1);
      for (let i = 0; i < 4; i++) {
        const m = new T.Mesh(pulseGeo, new T.MeshBasicMaterial({ color: 0xFFD54A, transparent: true, opacity: 0.95 }));
        m.userData = { curve, t: i / 4, lossF, pid: p.id };
        lg.add(m); world.pulses.push(m);
      }
    }
  }

  // ---- 도심 빌딩 ----
  let lots = null;
  function makeLots() {
    const r = srand(23); lots = [];
    for (const bx of [-5, 0, 5]) for (const bz of [-5, 0, 5]) for (const ox of [-1.05, 1.05]) for (const oz of [-1.05, 1.05]) {
      const x = bx + ox, z = bz + oz, d = Math.hypot(x, z);
      lots.push({ x, z, d: d + r() * 2.5, w: 1.55 + r() * 0.35, dd: 1.55 + r() * 0.35, hr: r(), tone: Math.floor(r() * 3), litOrder: r() });
    }
    lots.sort((a, b) => a.d - b.d);
    const byLit = lots.slice().sort((a, b) => a.litOrder - b.litOrder);
    byLit.forEach((l, i) => l.litRank = i);
  }
  function rebuildBuildings(count, round) {
    for (const b of world.buildings) { scene.remove(b); b.geometry.dispose(); }
    world.buildings = [];
    for (let i = 0; i < count; i++) {
      const l = lots[i];
      const h = 1.4 + (8.5 * Math.exp(-Math.hypot(l.x, l.z) / 6) + 1.5) * (0.45 + l.hr * 0.75) * (0.8 + round * 0.06);
      const geo = new T.BoxGeometry(l.w, h, l.dd); scaleBoxUV(geo, l.w, h, l.dd);
      const m = new T.Mesh(geo, [bMats[l.tone].lit, bMats[l.tone].lit, bMats[l.tone].roof, bMats[l.tone].roof, bMats[l.tone].lit, bMats[l.tone].lit]);
      m.position.set(l.x, h / 2 + 0.05, l.z); m.castShadow = true; m.receiveShadow = true; m.userData.lot = l;
      scene.add(m); world.buildings.push(m);
    }
  }
  function applyLights(coverage) {
    const n = world.buildings.length, litN = Math.round(n * Math.min(1, coverage));
    const ranks = world.buildings.map(b => b.userData.lot.litRank).sort((a, b) => a - b);
    const cutoff = litN > 0 ? ranks[litN - 1] : -1;
    for (const b of world.buildings) {
      const l = b.userData.lot, on = l.litRank <= cutoff, M = bMats[l.tone], side = on ? M.lit : M.dark;
      b.material = [side, side, M.roof, M.roof, side, side];
    }
  }

  // ---- ESS ----
  function rebuildESS(n, active) {
    if (world.essGroup) scene.remove(world.essGroup);
    const g = new T.Group(); world.essGroup = g; scene.add(g);
    for (let i = 0; i < n; i++) {
      g.add(box(2.2, 1.1, 1.0, mat(0xF3F5F7), 9.5, 0.55, 9 + i * 1.4));
      const s = new T.Mesh(new T.BoxGeometry(2.22, 0.18, 1.02), new T.MeshBasicMaterial({ color: active ? 0x3BD16F : 0x2C8A57 }));
      s.position.set(9.5, 0.8, 9 + i * 1.4); g.add(s);
    }
  }

  // ---- 날씨 ----
  function setWeather(key, haze) {
    const S = SKY[key];
    const sky = new T.Color(S.sky); if (haze > 0) sky.lerp(new T.Color(0xA89C86), Math.min(0.6, haze * 0.6));
    scene.background = sky; scene.fog.color = sky;
    sun.intensity = S.sun; hemi.intensity = S.hemi;
    groundMat.color.set(key === 'drought' ? 0xA39A5E : 0x6E9E58);
    cloudMat.color.set(S.cloudCol);
    world.clouds.forEach((c, i) => { c.visible = i < S.clouds; });
    world.rain.visible = key === 'cloudy';
    state.drift = S.drift;
  }
  function makeClouds() {
    cloudMat = new T.MeshLambertMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.92 });
    const r = srand(5), sg = new T.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 16; i++) {
      const c = new T.Group();
      for (let k = 0; k < 4; k++) { const s = new T.Mesh(sg, cloudMat); s.position.set(k * 1.6 - 2.4, r() * 0.6, r() * 1.2); const sc = 1.3 + r() * 1.1; s.scale.set(sc * 1.2, sc * 0.7, sc); c.add(s); }
      c.position.set(-60 + r() * 120, 18 + r() * 5, -45 + r() * 90);
      scene.add(c); world.clouds.push(c);
    }
    const N = 1400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = -45 + r() * 90; pos[i * 3 + 1] = r() * 26; pos[i * 3 + 2] = -45 + r() * 90; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    world.rain = new T.Points(g, new T.PointsMaterial({ color: 0xD5E3EE, size: 0.22, transparent: true, opacity: 0.8 }));
    scene.add(world.rain);
  }

  // ---- 라벨 ----
  function addLabel(html, pos, cls) {
    const el = document.createElement('div'); el.className = 'lbl ' + (cls || ''); el.innerHTML = html; labelsEl.appendChild(el);
    const L = { el, pos: new T.Vector3(...pos), center: cls === 'zone' }; world.labels.push(L); return L;
  }
  const v3 = () => new T.Vector3();
  function updateLabels() {
    const w = canvas.clientWidth, h = canvas.clientHeight, p = v3();
    for (const L of world.labels) {
      if (L.hidden) { L.el.style.display = 'none'; continue; }
      p.copy(L.pos).project(camera);
      if (p.z > 1) { L.el.style.display = 'none'; continue; }
      L.el.style.display = '';
      L.el.style.transform = `translate(-50%,${L.center ? '-50%' : '-100%'}) translate(${(p.x * 0.5 + 0.5) * w}px,${(-p.y * 0.5 + 0.5) * h}px)`;
    }
  }

  // ---- 카메라 ----
  function placeCamera() {
    const { theta, phi, r, tx, tz } = cam;
    camera.position.set(tx + r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), tz + r * Math.sin(phi) * Math.sin(theta));
    camera.lookAt(tx, 0, tz);
  }

  // ---- 선택 ----
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function pick(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = world.pads.slice(); world.plants.forEach(v => objs.push(v.group));
    const hit = ray.intersectObjects(objs, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.kind) o = o.parent;
    if (!o) return null;
    if (o.userData.kind === 'pad' && !o.userData.empty) return { kind: 'plant', pid: o.userData.pid };
    return o.userData;
  }
  let hoverPad = null;
  function setHover(info, cx, cy) {
    if (hoverPad) { hoverPad.userData.topMat.emissive.set(0x000000); hoverPad = null; }
    if (!info) { tipEl.hidden = true; canvas.style.cursor = 'grab'; return; }
    canvas.style.cursor = 'pointer';
    let text = '';
    if (info.kind === 'pad') {
      const valid = !toolSet || toolSet.has(info.site + ':' + info.idx);
      hoverPad = world.pads.find(p => p.userData === info); if (hoverPad && !valid) hoverPad = null;
      if (hoverPad) hoverPad.userData.topMat.emissive.set(0x24507F);
      text = `${SITES[info.site].name} · 빈 부지 — 눌러서 건설`;
    } else {
      const P = world.plants.get(info.pid); if (P) text = `${PLANTS[P.type].name} (${SITES[P.site].name}) — 눌러서 정보 보기`;
    }
    if (cbs.tip) { const t2 = cbs.tip(info); if (t2) text = t2; }
    if (!text) { tipEl.hidden = true; return; }
    const rect = stage.getBoundingClientRect();
    tipEl.textContent = text; tipEl.hidden = false;
    tipEl.style.left = (cx - rect.left + 14) + 'px'; tipEl.style.top = (cy - rect.top + 14) + 'px';
  }

  function bindControls() {
    const ptrs = new Map(); let down = null, pinch0 = 0;
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, moved: 0 };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); down = null; }
    });
    canvas.addEventListener('pointermove', e => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) { if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY), e.clientX, e.clientY); return; }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0) { cam.r = Math.max(36, Math.min(140, cam.r * pinch0 / d)); placeCamera(); }
        pinch0 = d; return;
      }
      if (down) {
        down.moved += Math.abs(dx) + Math.abs(dy);
        if (down.moved > 6) {
          canvas.style.cursor = 'grabbing'; tipEl.hidden = true;
          cam.theta += dx * 0.008; cam.phi = Math.max(0.35, Math.min(1.3, cam.phi - dy * 0.006)); placeCamera();
        }
      }
    });
    const end = e => {
      if (down && down.moved <= 6 && ptrs.size === 1) {
        const info = pick(e.clientX, e.clientY);
        if (info && info.kind === 'pad') cbs.onPad(info.site, info.idx);
        else if (info && info.kind === 'plant') cbs.onPlant(info.pid);
      }
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; if (!ptrs.size) down = null;
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); down = null; });
    canvas.addEventListener('pointerleave', () => setHover(null));
    canvas.addEventListener('wheel', e => { e.preventDefault(); cam.r = Math.max(36, Math.min(140, cam.r * (1 + Math.sign(e.deltaY) * 0.1))); placeCamera(); }, { passive: false });
    stage.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => {
      const k = b.dataset.cam;
      if (k === 'l') cam.theta -= 0.5; if (k === 'r') cam.theta += 0.5;
      if (k === 'in') cam.r = Math.max(36, cam.r * 0.82); if (k === 'out') cam.r = Math.min(140, cam.r * 1.2);
      if (k === 'reset') Object.assign(cam, { theta: 0.85, phi: 0.92, r: 88 });
      placeCamera();
    });
  }

  function init() {
    if (inited || failed) return !failed;
    stage = document.createElement('div'); stage.className = 'stage';
    stage.innerHTML = `<canvas aria-label="3D 도시 화면. 빈 부지를 누르면 발전소를 지을 수 있어요."></canvas><div class="labels"></div><div class="tip" hidden></div>
      <div class="camctl" role="group" aria-label="시점 조절"><button data-cam="l" aria-label="왼쪽으로 회전">↺</button><button data-cam="r" aria-label="오른쪽으로 회전">↻</button><button data-cam="in" aria-label="확대">+</button><button data-cam="out" aria-label="축소">−</button><button data-cam="reset" aria-label="시점 초기화">⌂</button></div>
      <div class="hint">드래그로 회전 · 휠/두 손가락으로 확대</div>`;
    canvas = stage.querySelector('canvas'); labelsEl = stage.querySelector('.labels'); tipEl = stage.querySelector('.tip'); 
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true });
    } catch (e) { failed = true; return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); scene.fog = new T.Fog(0x9ED2F2, 110, 230);
    camera = new T.PerspectiveCamera(38, 16 / 9, 1, 500);
    hemi = new T.HemisphereLight(0xFFFFFF, 0x6B7F5A, 0.75); scene.add(hemi);
    sun = new T.DirectionalLight(0xFFF4E0, 1); sun.position.set(30, 50, 25); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.far = 150;
    scene.add(sun);
    ghostMat = new T.MeshLambertMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.38 });
    buildingMats(); terrain(); makePads(); makeLots(); makeClouds();
    for (const s in ZONE_LABEL) { const [x, z] = ZONE_LABEL[s]; world.zoneLbl = world.zoneLbl || {}; world.zoneLbl[s] = addLabel('', [x, 0.3, z], 'zone'); }
    world.cityLbl = addLabel('', [0, 14.5, 0], 'city');
    placeCamera(); bindControls();
    new ResizeObserver(resize).observe(stage);
    requestAnimationFrame(frame);
    inited = true; return true;
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < 520 ? 50 : 38; camera.updateProjectionMatrix();
  }

  // ---- 상태 동기화 ----
  function sync(o) {
    // o: {plants:[{id,type,site,slot}], hv, ess, weather, rows, coverage, demand, supply, essCover, buildCount, round, co2, hvLoss}
    const statusOf = {}; for (const r of o.rows) statusOf[r.id] = r;
    // 발전소
    const seen = new Set();
    for (const p of o.plants) {
      seen.add(p.id);
      const st = statusOf[p.id] || { status: '가동', out: PLANTS[p.type].out };
      const ghost = st.status === '건설 중';
      const key = p.type + p.site + p.slot + (ghost ? 'g' : '');
      let W = world.plants.get(p.id);
      if (W && W.key !== key) { scene.remove(W.group); world.plants.delete(p.id); W = null; }
      if (!W) {
        const g = plantModel(p.type, ghost); const [x, z] = PADS[p.site][p.slot];
        g.position.set(x, 0.16, z); g.userData.kind = 'plant'; g.userData.pid = p.id;
        g.traverse(m => { if (m.isMesh) m.castShadow = true; });
        if (!ghost) { if (p.type === 'coal') addSmoke(g, 0x6E6E6E); else if (p.type === 'lng') addSmoke(g, 0xA5A5A5); else if (p.type === 'nuclear') addSmoke(g, 0xFFFFFF); }
        g.userData.born = firstSync ? -10 : clock;
        scene.add(g);
        W = { group: g, key, type: p.type, site: p.site };
        world.plants.set(p.id, W);
        if (!W.label) W.label = addLabel('', [x, 7.5, z], 'st');
      }
      W.status = st.status; W.factor = PLANTS[p.type].out ? st.out / PLANTS[p.type].out : 0;
      W.label.pos.set(PADS[p.site][p.slot][0], 7.2, PADS[p.site][p.slot][1]);
      W.label.hidden = st.status === '가동';
      W.label.el.textContent = st.status;
    }
    for (const [id, W] of world.plants) if (!seen.has(id)) { scene.remove(W.group); W.label.el.remove(); world.labels.splice(world.labels.indexOf(W.label), 1); world.plants.delete(id); }
    // 부지
    const used = {}; for (const p of o.plants) used[p.site + p.slot] = p.id;
    for (const pad of world.pads) {
      const u = used[pad.userData.site + pad.userData.idx];
      pad.userData.empty = !u; pad.userData.pid = u;
    }
    // 송전선
    const sig = o.plants.map(p => p.id + p.site + p.slot).join(',') + (o.hv ? 'H' : '');
    if (sig !== state.sig) { rebuildLines(o.plants, o.hv); state.sig = sig; }
    for (const pu of world.pulses) { const W = world.plants.get(pu.userData.pid); pu.userData.on = W && W.factor > 0.01; pu.visible = pu.userData.on; }
    // 빌딩
    if (o.buildCount !== state.buildCount || o.round !== state.round) { rebuildBuildings(o.buildCount, o.round); state.buildCount = o.buildCount; state.round = o.round; }
    applyLights(o.coverage);
    rebuildESS(o.ess, o.essCover > 0);
    // 날씨
    const haze = Math.max(0, (o.co2 - 20) / 30);
    setWeather(o.weather, haze); state.windF = WEATHERS[o.weather].wind; state.weather = o.weather;
    // 라벨
    for (const s in world.zoneLbl) world.zoneLbl[s].el.innerHTML = `<b>${SITES[s].name}</b><span>손실 ${f1(SITES[s].loss * (o.hv ? 0.25 : 1) * 100)}%</span>`;
    const short = o.supply < o.demand - 1e-9;
    world.cityLbl.el.className = 'lbl city' + (short ? ' short' : '');
    world.cityLbl.el.innerHTML = `<b>${short ? '⚠ 정전 ' + Math.round((1 - o.coverage) * 100) + '%' : '전력 정상'}</b><span>수요 ${o.demand} · 공급 ${f1(o.supply)}</span>`;
    const W2 = WEATHERS[o.weather];
    canBuildFlag = !!o.canBuild; applyPads();
    firstSync = false;
  }

  // ---- 애니메이션 ----
  function frame(now) {
    requestAnimationFrame(frame);
    if (!stage.isConnected || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, ((now - last) / 1000) || 0.016); last = now; clock += dt;
    for (const [, W] of world.plants) {
      const g = W.group, age = clock - g.userData.born;
      if (age < 0.7) { const t = age / 0.7, s = 1 + 1.7 * Math.pow(t - 1, 3) + 0.7 * Math.pow(t - 1, 2); g.scale.set(1, Math.max(0.01, t < 1 ? s : 1), 1); } else g.scale.set(1, 1, 1);
      for (const r of g.userData.rotors) r.rotation.z -= dt * 3.2 * state.windF * (W.factor > 0 ? 1 : 0);
      if (g.userData.puffs) for (const pf of g.userData.puffs) {
        pf.userData.age += dt * 0.32; if (pf.userData.age > 1) pf.userData.age -= 1;
        const a = pf.userData.age, b = pf.userData.base, on = W.factor > 0.01;
        pf.position.set(b[0] + a * 2.2 * (0.4 + state.windF * 0.6), b[1] + a * 3.2, b[2] - a * 0.6);
        const s = 0.35 + a * 1.4 * (W.type === 'nuclear' ? 1.3 : 1); pf.scale.set(s, s, s);
        pf.material.opacity = on ? (1 - a) * 0.75 * Math.min(1, W.factor + 0.2) : 0;
      }
    }
    for (const pu of world.pulses) {
      if (!pu.userData.on) continue;
      pu.userData.t = (pu.userData.t + dt * 0.28) % 1;
      const t = pu.userData.t; pu.position.copy(pu.userData.curve.getPointAt(t));
      const s = Math.max(0.2, 1 - pu.userData.lossF * 3.2 * t); pu.scale.set(s, s, s);
      pu.material.opacity = 0.35 + 0.6 * s;
    }
    for (const c of world.clouds) { c.position.x += dt * state.drift; if (c.position.x > 65) c.position.x = -65; }
    if (world.rain.visible) { const a = world.rain.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 22; if (y < 0) y += 26; a.setY(i, y); } a.needsUpdate = true; }
    for (const pd of world.pads) if (pd.userData.sprite.visible) { const k = pd === hoverPad ? 1.25 : 1; pd.userData.sprite.position.y = 1.7 + Math.sin(clock * 2.4 + pd.userData.phase) * 0.25; pd.userData.sprite.scale.set(2 * k, 2 * k, 1); }
    if (hoverPad) hoverPad.userData.topMat.emissive.setHSL(0.58, 0.6, 0.18 + 0.08 * Math.sin(clock * 6));
    if (autoRot) { cam.theta += dt * 0.1; placeCamera(); }
    renderer.render(scene, camera);
    updateLabels();
  }
  function applyPads() {
    for (const pad of world.pads) {
      const u = pad.userData, valid = u.empty && canBuildFlag && (!toolSet || toolSet.has(u.site + ':' + u.idx));
      u.sprite.visible = valid; u.sprite.material = toolSet ? smGreen : smBlue;
      u.topMat.map = u.empty ? padTex : null;
      u.topMat.color.set(!u.empty ? 0xA9B2BB : (toolSet ? (valid ? 0xC9F2DA : 0x8C959E) : 0xFFFFFF));
      u.topMat.needsUpdate = true;
    }
  }

  return {
    available() { return init(); },
    element() { return stage; },
    on(o) { Object.assign(cbs, o); },
    sync(o) { if (init()) { sync(o); resize(); } },
    setTool(set) { toolSet = set; if (inited) applyPads(); },
    setAutoRotate(on) { autoRot = !!on && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); },
  };
})();
