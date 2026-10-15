/* Wasserstein tilt vs reward tilt as lambda sweeps 0 -> 3 (WTF Figure 1), drawn as vector SVG.
   Formulas, palette and geometry follow make_fig1_anim.py, which renders the paper figure as TikZ;
   the paper figure is the lambda = 3 frame. */
(function () {
  'use strict';
  const root = document.getElementById('tiltfig');
  if (!root) return;

  const LAM_MAX = 3;
  const MODES = [[1.0, 0.83, 36], [-1.0, -0.80, 36], [0.30, 0.48, 18], [-0.30, -0.52, 18]];
  const basep = x => MODES.reduce((s, [m0, , k]) => s + 0.25 * Math.exp(-k * (x - m0) ** 2), 0);
  const reward = x => 0.2 + 0.3 * Math.exp(-8 * (x - 0.7) ** 2) + 0.4 * Math.exp(-6 * (x + 0.75) ** 2);
  const centres = lam => MODES.map(([m0, m1, k]) => [m0, m0 + (lam / LAM_MAX) * (m1 - m0), k]);
  const wt = (x, lam) => centres(lam).reduce((s, [, m, k]) => s + 0.25 * Math.exp(-k * (x - m) ** 2), 0);

  // normalisation C(lam) so that int C p e^{lam r} = int p over [-2, 2] (trapezoid, as in the script)
  const XG = Array.from({ length: 4001 }, (_, i) => -2 + i * 0.001);
  const trap = f => { let s = 0; for (let i = 1; i < XG.length; i++) s += 0.5 * (f(XG[i]) + f(XG[i - 1])) * 0.001; return s; };
  const NUM = trap(basep);
  const CT = Array.from({ length: 301 }, (_, i) => { const lam = i / 100; return NUM / trap(x => basep(x) * Math.exp(lam * reward(x))); });
  const tiltC = lam => { const u = Math.min(300, Math.max(0, lam * 100)), i = Math.floor(u), f = u - i; return i >= 300 ? CT[300] : CT[i] * (1 - f) + CT[i + 1] * f; };

  // TikZ coordinates in cm: frame bbox (-3.30,-0.55)-(10.40,2.25); panels shifted by 0 and 7, xscale 2.
  const X0 = -3.30, W = 13.70, Y1 = 2.25, H = 2.80;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `${X0} ${-Y1} ${W} ${H}`);
  svg.setAttribute('class', 'tf-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs><marker id="tf-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 L3,5 z" fill="rgb(75,50,115)"/></marker></defs>`;
  root.insertBefore(svg, root.firstChild);

  const el = (tag, attrs) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e; };
  const pathOf = (f, sx, ys, n) => {
    let d = '';
    for (let i = 0; i <= n; i++) { const x = -1.5 + 3 * i / n; d += (i ? 'L' : 'M') + (sx + 2 * x).toFixed(4) + ',' + (-ys * f(x)).toFixed(4); }
    return d;
  };
  const fillOf = (f, sx, ys, n) => pathOf(f, sx, ys, n) + `L${(sx + 3).toFixed(3)},0L${(sx - 3).toFixed(3)},0Z`;

  const panels = [0, 7].map((sx, idx) => {
    el('path', { d: fillOf(reward, sx, 1.4, 160), fill: 'rgb(80,130,80)', 'fill-opacity': 0.12 });
    el('path', { d: pathOf(reward, sx, 1.4, 160), fill: 'none', stroke: 'rgb(80,130,80)', 'stroke-width': 0.028 });
    el('path', { d: fillOf(basep, sx, 2, 220), fill: 'rgb(232,228,245)', 'fill-opacity': 0.85 });
    el('path', { d: pathOf(basep, sx, 2, 220), fill: 'none', stroke: 'rgb(155,150,180)', 'stroke-width': 0.0176 });
    const tf = el('path', { fill: 'rgb(170,145,195)', 'fill-opacity': 0.55 });
    const tl = el('path', { fill: 'none', stroke: 'rgb(75,50,115)', 'stroke-width': 0.0247 });
    el('line', { x1: sx - 3, y1: 0, x2: sx + 3.1, y2: 0, stroke: '#111', 'stroke-width': 0.028 });
    el('path', { d: `M${sx + 3.1},0 l-0.13,-0.055 l0.03,0.055 l-0.03,0.055z`, fill: '#111' });
    const arrows = MODES.map(() => el('line', { stroke: 'rgb(75,50,115)', 'stroke-width': idx ? 0.028 : 0.03, 'marker-end': 'url(#tf-head)' }));
    return { sx, idx, tf, tl, arrows };
  });

  function draw(lam) {
    const C = tiltC(lam);
    panels.forEach(p => {
      const f = p.idx === 0 ? (x => wt(x, lam)) : (x => C * basep(x) * Math.exp(lam * reward(x)));
      p.tf.setAttribute('d', fillOf(f, p.sx, 2, 240));
      p.tl.setAttribute('d', pathOf(f, p.sx, 2, 240));
      p.arrows.forEach((a, i) => {
        const [m0] = MODES[i];
        let show = false, x1 = 0, y1 = 0, x2 = 0, y2 = 0;
        if (p.idx === 0) {
          const m = centres(lam)[i][1];
          if (Math.abs(m - m0) >= 1e-3) { show = true; x1 = p.sx + 2 * m0; x2 = p.sx + 2 * m; y1 = y2 = -2 * 0.34; }
        } else {
          const p0 = basep(m0), t0 = C * p0 * Math.exp(lam * reward(m0));
          if (Math.abs(t0 - p0) >= 0.004) { show = true; x1 = x2 = p.sx + 2 * m0; y1 = -2 * p0; y2 = -2 * t0; }
        }
        a.setAttribute('visibility', show ? 'visible' : 'hidden');
        if (show) { a.setAttribute('x1', x1); a.setAttribute('y1', y1); a.setAttribute('x2', x2); a.setAttribute('y2', y2); }
      });
    });
    const out = root.querySelector('.tf-lam b');
    if (out) out.textContent = lam.toFixed(2);
  }

  // timeline: hold at 0, rise, hold at 3, fall (cosine easing, as in the script)
  const HOLD0 = 600, UP = 1800, HOLD3 = 1200, DOWN = 1800, T = HOLD0 + UP + HOLD3 + DOWN;
  const ease = s => LAM_MAX * (0.5 - 0.5 * Math.cos(Math.PI * s));
  const lamAt = t => {
    t %= T;
    if (t < HOLD0) return 0;
    if ((t -= HOLD0) < UP) return ease(t / UP);
    if ((t -= UP) < HOLD3) return LAM_MAX;
    return ease(1 - (t - HOLD3) / DOWN);
  };

  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, t0 = 0, acc = 0, visible = false;
  function frame(now) { if (!t0) t0 = now; draw(lamAt(acc + now - t0)); raf = requestAnimationFrame(frame); }
  function start() { if (raf || still) return; t0 = 0; raf = requestAnimationFrame(frame); }
  function stop(now) { if (!raf) return; cancelAnimationFrame(raf); raf = 0; acc += performance.now() - t0; }
  draw(still ? LAM_MAX : 0);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; visible ? start() : stop(); }), { threshold: 0.3 }).observe(root);
  } else start();
})();
