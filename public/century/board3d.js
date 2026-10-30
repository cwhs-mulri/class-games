// ===== 전자칠판: 모둠마다 3D 서식지를 한 캔버스에 나눠 그린다 (WebGL 하나로 여러 장면) =====
const Board3D = (function () {
  const T = window.THREE;
  let renderer = null, canvas = null, host = null, failed = !T, last = 0, clock = 0, raf = 0;
  const views = new Map(); // id → { el, scene, hab, cam, theta, animal }

  function init(container) {
    if (failed) return false;
    if (renderer && canvas.isConnected && host === container) return true;
    host = container;
    canvas = document.createElement('canvas'); canvas.className = 'board-gl'; canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { failed = true; return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    views.clear();
    if (!raf) raf = requestAnimationFrame(frame);
    return true;
  }
  function makeView(el, animal) {
    const scene = new T.Scene(); scene.fog = new T.Fog(0xC9E0EE, 90, 200);
    const hemi = new T.HemisphereLight(0xFFFFFF, 0x445566, 0.62); scene.add(hemi);
    const sun = new T.DirectionalLight(0xFFF2DD, 0.9); sun.position.set(25, 45, 20); scene.add(sun);
    const hab = World3D.makeHabitat(scene, sun, hemi); hab.build(animal);
    const cam = new T.PerspectiveCamera(42, 1.4, 0.5, 400);
    return { el, scene, hab, cam, theta: Math.random() * 6, animal };
  }
  // list: [{ id, el, animal, state: {hab, pop, health, T} }]
  function sync(list) {
    if (!renderer) return;
    const seen = new Set();
    for (const g of list) {
      seen.add(g.id);
      let v = views.get(g.id);
      if (!v || v.animal !== g.animal) { v = makeView(g.el, g.animal); views.set(g.id, v); }
      v.el = g.el;
      if (g.state) v.hab.setState(g.state);
    }
    for (const id of [...views.keys()]) if (!seen.has(id)) views.delete(id);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!renderer || !canvas.isConnected || document.hidden) { last = now; return; }
    // 전자칠판 PC가 느려도 버티도록 초당 30장까지만 그린다
    if (now - last < 31) return;
    const dt = Math.min(0.08, ((now - last) / 1000) || 0.033); last = now; clock += dt;
    const cr = canvas.getBoundingClientRect();
    const w = Math.round(cr.width), h = Math.round(cr.height);
    if (!w || !h) return;
    const pr = renderer.getPixelRatio();
    if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) renderer.setSize(w, h, false);
    renderer.setScissorTest(false); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.setScissorTest(true);
    for (const v of views.values()) {
      if (!v.el || !v.el.isConnected) continue;
      const r = v.el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < cr.top || r.top > cr.bottom) continue;
      const x = r.left - cr.left, y = cr.bottom - r.bottom;
      renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(x, y, r.width, r.height);
      v.theta += dt * 0.12;
      v.cam.aspect = r.width / r.height; v.cam.updateProjectionMatrix();
      const R = 66, phi = 0.95;
      v.cam.position.set(R * Math.sin(phi) * Math.cos(v.theta), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(v.theta) - 1);
      v.cam.lookAt(0, 0, -1);
      v.hab.tick(dt, clock);
      renderer.render(v.scene, v.cam);
    }
  }
  return { available: () => !failed && !!T, init, sync };
})();
