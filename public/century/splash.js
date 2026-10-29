// ===== 재난 스플래시: 교사가 일으킨 기습 이벤트를 화면 전체 "긴급 속보"로 띄운다 =====
// Splash.show({ key, mode: 'board'|'phone'|'preview', target, effects:[{label, chips:[]}], onClose })
const Splash = (function () {
  const THEME = {
    elnino:   { kicker: '해양 이상 고온 경보', bg1: '#03213D', bg2: '#0B5C8C', accent: '#4FC3F7', fx: 'waves' },
    heatdome: { kicker: '폭염 특보', bg1: '#3A0A00', bg2: '#A63A00', accent: '#FFB13B', fx: 'heat' },
    wildfire: { kicker: '대형 산불 재난 문자', bg1: '#1E0700', bg2: '#6E1A00', accent: '#FF6A1A', fx: 'embers' },
    methane:  { kicker: '영구 동토층 붕괴 경보', bg1: '#0E1B12', bg2: '#33503A', accent: '#B6F09C', fx: 'bubbles' },
    volcano:  { kicker: '화산 분화 속보', bg1: '#140F10', bg2: '#4A3532', accent: '#FF7A45', fx: 'ash' },
    plastic:  { kicker: '해양 오염 경보', bg1: '#06262B', bg2: '#0F5560', accent: '#7FE3E0', fx: 'debris' },
    oilspill: { kicker: '해양 사고 긴급 속보', bg1: '#050608', bg2: '#1C2230', accent: '#F4C542', fx: 'oil' },
    deal:     { kicker: '국제 뉴스 속보', bg1: '#062012', bg2: '#0F5A33', accent: '#5CF29A', fx: 'leaves', good: true },
  };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active = null, audioOn = false, actx = null;

  function enableSound() {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); audioOn = true; } catch (e) { audioOn = false; }
    return audioOn;
  }
  // 경보음: 재난은 낮고 높은 두 음 반복, 좋은 소식은 올라가는 세 음
  function alarm(good) {
    if (!audioOn || !actx) return;
    const t0 = actx.currentTime;
    const tone = (f, s, d, vol) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = good ? 'sine' : 'square'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + s); g.gain.linearRampToValueAtTime(vol, t0 + s + 0.02); g.gain.linearRampToValueAtTime(0, t0 + s + d); o.connect(g).connect(actx.destination); o.start(t0 + s); o.stop(t0 + s + d + 0.05); };
    if (good) [523, 659, 784].forEach((f, i) => tone(f, i * 0.16, 0.22, 0.18));
    else for (let i = 0; i < 3; i++) { tone(880, i * 0.5, 0.22, 0.12); tone(660, i * 0.5 + 0.25, 0.22, 0.12); }
  }

  // ---- 배경 입자 효과 (2D 캔버스) ----
  function makeFX(canvas, kind, accent) {
    const ctx = canvas.getContext('2d'); let W = 0, H = 0, t = 0;
    const R = Math.random, parts = [];
    function size() { const r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; canvas.width = W * d; canvas.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
    size();
    const N = { embers: 140, bubbles: 70, ash: 220, debris: 60, oil: 14, leaves: 90 }[kind] || 0;
    for (let i = 0; i < N; i++) parts.push({ x: R() * W, y: R() * H, v: 0.3 + R(), s: 1 + R() * 3, a: R() * 6.28, r: R() });
    function step(dt) {
      t += dt; ctx.clearRect(0, 0, W, H);
      if (kind === 'waves') {
        for (let k = 0; k < 5; k++) {
          ctx.beginPath(); const yb = H * (0.55 + k * 0.09), amp = 14 + k * 6, sp = 1 + k * 0.4;
          ctx.moveTo(0, H);
          for (let x = 0; x <= W; x += 12) ctx.lineTo(x, yb + Math.sin(x / (90 + k * 30) + t * sp) * amp + Math.sin(x / 37 - t * 2) * 4);
          ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = `rgba(79,195,247,${0.08 + k * 0.05})`; ctx.fill();
        }
      } else if (kind === 'heat') {
        for (let k = 0; k < 14; k++) {
          ctx.beginPath(); const x0 = (k / 14) * W + Math.sin(t + k) * 10;
          for (let y = H; y >= 0; y -= 10) ctx.lineTo(x0 + Math.sin(y / 40 + t * 3 + k) * 12, y);
          ctx.strokeStyle = 'rgba(255,177,59,0.10)'; ctx.lineWidth = 18; ctx.stroke();
        }
        const g = ctx.createRadialGradient(W / 2, H * 1.1, 10, W / 2, H * 1.1, H * (0.9 + Math.sin(t * 2) * 0.05));
        g.addColorStop(0, 'rgba(255,120,0,0.55)'); g.addColorStop(1, 'rgba(255,120,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } else if (kind === 'embers' || kind === 'bubbles' || kind === 'leaves') {
        for (const p of parts) {
          p.y -= p.v * dt * (kind === 'bubbles' ? 70 : 110); p.x += Math.sin(t * 2 + p.a) * dt * 30;
          if (p.y < -10) { p.y = H + 10; p.x = R() * W; }
          ctx.beginPath();
          if (kind === 'embers') { ctx.fillStyle = `rgba(255,${120 + p.r * 100 | 0},40,${0.4 + 0.6 * Math.abs(Math.sin(t * 4 + p.a))})`; ctx.arc(p.x, p.y, p.s, 0, 6.28); ctx.fill(); }
          else if (kind === 'bubbles') { ctx.strokeStyle = 'rgba(182,240,156,0.55)'; ctx.lineWidth = 1.5; ctx.arc(p.x, p.y, p.s * 4, 0, 6.28); ctx.stroke(); }
          else { ctx.fillStyle = `rgba(92,242,154,${0.35 + p.r * 0.4})`; ctx.ellipse(p.x, p.y, p.s * 2.2, p.s, t + p.a, 0, 6.28); ctx.fill(); }
        }
      } else if (kind === 'ash') {
        for (const p of parts) { p.y += p.v * dt * 60; p.x += (0.5 + Math.sin(t + p.a)) * dt * 25; if (p.y > H + 5) { p.y = -5; p.x = R() * W; } ctx.fillStyle = `rgba(190,180,175,${0.25 + p.r * 0.5})`; ctx.fillRect(p.x, p.y, p.s, p.s); }
      } else if (kind === 'debris') {
        const cols = ['#7FE3E0', '#F4F1EA', '#F49AC2', '#9AD0FF', '#F6D365'];
        for (const p of parts) { p.x += (p.v - 0.6) * dt * 40; p.y += Math.sin(t + p.a) * dt * 12; if (p.x > W + 20) p.x = -20; if (p.x < -20) p.x = W + 20; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * (p.r - 0.5) + p.a); ctx.fillStyle = cols[i0(p.r * 5)]; ctx.globalAlpha = 0.7; ctx.fillRect(-p.s * 3, -p.s, p.s * 6, p.s * 2); ctx.restore(); }
      } else if (kind === 'oil') {
        for (const p of parts) { const r = (40 + p.r * 120) * Math.min(1, t / 3 + 0.2); const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.7, 'rgba(20,20,40,0.55)'); g.addColorStop(1, 'rgba(120,80,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.28); ctx.fill(); }
      }
    }
    const i0 = v => Math.floor(v);
    return { step, size };
  }

  function close() {
    if (!active) return;
    const a = active; active = null;
    cancelAnimationFrame(a.raf); clearTimeout(a.timer); window.removeEventListener('resize', a.onResize);
    a.el.classList.add('out');
    setTimeout(() => a.el.remove(), 450);
    if (a.onClose) a.onClose();
  }

  function show(o) {
    const S = o.def || surpriseDef(o.key); if (!S) return;
    const base = THEME[S.custom ? S.theme : S.key] || THEME.heatdome;
    const th = S.custom ? Object.assign({}, base, { kicker: base.good ? '특별 속보' : '긴급 재난 속보' }) : base;
    if (active) close();
    const dur = o.mode === 'phone' ? 9000 : o.mode === 'preview' ? 7000 : 12000;
    const el = document.createElement('div');
    el.className = `splash-x ${o.mode} ${th.good ? 'good' : ''}`;
    el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-label', S.name || '');
    el.style.setProperty('--tl', String(Math.max(4, S.name.length))); el.style.setProperty('--sx1', th.bg1); el.style.setProperty('--sx2', th.bg2); el.style.setProperty('--sxa', th.accent);
    const temp = S.dT ? `이번 세대 기온 ${S.dT > 0 ? '+' : ''}${S.dT}°C` : S.permT ? `앞으로 계속 기온 ${S.permT > 0 ? '+' : ''}${S.permT}°C` : '';
    const ticker = Array(6).fill(`${th.good ? '◆' : '⚠'} ${th.kicker} · ${esc(S.name)} · ${esc(o.target || '')}`).join('　　');
    el.innerHTML = `<canvas class="sx-fx" aria-hidden="true"></canvas><div class="sx-flash" aria-hidden="true"></div>
      <div class="sx-tick top" aria-hidden="true"><span>${ticker}</span></div>
      <div class="sx-body">
        <div class="sx-kicker">${th.good ? '◆' : '⚠'} ${th.kicker}${o.mode === 'preview' ? ' · 미리보기' : ''}</div>
        <div class="sx-icon">${esc(S.icon)}</div>
        <h1 class="sx-title">${esc(S.name)}</h1>
        ${S.text ? `<p class="sx-text">${esc(S.text)}</p>` : ''}
        <div class="sx-meta">${o.target ? `<span class="sx-chip">대상: ${esc(o.target)}</span>` : ''}${temp ? `<span class="sx-chip">${temp}</span>` : ''}<span class="sx-chip">다음 결과에 반영</span></div>
        ${(o.effects || []).length ? `<div class="sx-eff">${o.effects.map(e => `<div class="sx-row"><b>${esc(e.label)}</b>${e.chips.map(c => `<span class="sx-chip ${c.v > 0 ? 'up' : 'down'}">${esc(c.t)}</span>`).join('')}</div>`).join('')}</div>` : ''}
        ${S.sci ? `<p class="sx-sci">${esc(S.sci)}</p>` : ''}
        <div class="sx-bar"><i></i></div>
        <div class="sx-close">화면을 누르면 닫혀요</div>
      </div>
      <div class="sx-tick bottom" aria-hidden="true"><span>${ticker}</span></div>`;
    document.body.appendChild(el);
    el.querySelector('.sx-bar i').style.animationDuration = dur + 'ms';
    const canvas = el.querySelector('.sx-fx'), fx = makeFX(canvas, th.fx, th.accent);
    const st = { el, raf: 0, timer: 0, onClose: o.onClose, onResize: () => fx.size() };
    window.addEventListener('resize', st.onResize);
    let last = performance.now();
    const loop = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; fx.step(dt); st.raf = requestAnimationFrame(loop); };
    if (!RM) st.raf = requestAnimationFrame(loop); else fx.step(0.5);
    st.timer = setTimeout(close, dur);
    setTimeout(() => el.addEventListener('click', close), 600);
    active = st;
    if (o.mode !== 'phone') alarm(th.good);
    if (o.mode === 'phone' && navigator.vibrate) try { navigator.vibrate(th.good ? [80, 60, 80] : [300, 120, 300, 120, 300]); } catch (e) {}
  }
  return { show, close, enableSound, get soundOn() { return audioOn; }, THEME };
})();
