/* Flow -> diffusion -> fine-tune -> flow: how KL-based fine-tuning of a flow proceeds.
   Schematic in one spatial dimension. The diffusion keeps the flow's marginals (Brownian-bridge noise
   added to each deterministic path); fine-tuning tilts the terminal distribution toward the reward;
   the result is converted back to a deterministic flow. */
(function () {
  'use strict';
  const root = document.getElementById('convertfig');
  if (!root) return;
  const ns = 'http://www.w3.org/2000/svg';
  const W = 1000, H = 400, TX0 = 170, TX1 = 830, YC = 200, SY = 52;
  const PURPLE = [91, 63, 176], AMBER = [217, 130, 43], GREEN = 'rgb(80,130,80)';
  const ty = x => YC - SY * x, tx = t => TX0 + (TX1 - TX0) * t;

  // densities: rho_0 = N(0,1); rho_1 = mixture at -1.5 and +1.5; tilted mixture favours +1.5
  const g = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  const MS = 0.42, M = 1.5;
  const mix = (x, w) => (1 - w) * g(x, -M, MS) + w * g(x, M, MS);
  const W0 = 0.5, W1 = 0.88;
  const reward = x => Math.exp(-((x - M) ** 2) / 0.9);
  const XS = Array.from({ length: 1201 }, (_, i) => -4 + i * 8 / 1200);
  const cdfTable = f => { const c = [0]; for (let i = 1; i < XS.length; i++) c.push(c[i - 1] + 0.5 * (f(XS[i]) + f(XS[i - 1])) * (8 / 1200)); const z = c[c.length - 1]; return c.map(v => v / z); };
  const quant = (c, u) => { let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; c[m] < u ? lo = m : hi = m; } const f = (u - c[lo]) / Math.max(1e-12, c[hi] - c[lo]); return XS[lo] + f * (XS[hi] - XS[lo]); };
  const C0 = cdfTable(x => g(x, 0, 1)), CB = cdfTable(x => mix(x, W0)), CT = cdfTable(x => mix(x, W1));

  // paths: N quantiles of rho_0, monotone maps to the base and tilted terminal laws
  const N = 15, NT = 90;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const paths = Array.from({ length: N }, (_, i) => {
    const u = (i + 0.5) / N, x0 = quant(C0, u);
    const w = [0]; for (let k = 1; k <= NT; k++) w.push(w[k - 1] + gauss() * Math.sqrt(1 / NT));
    const bridge = w.map((v, k) => v - (k / NT) * w[NT]);
    return { x0, xb: quant(CB, u), xt: quant(CT, u), bridge };
  });
  const sm = t => t * t * (3 - 2 * t);

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'cv-svg');
  svg.setAttribute('aria-hidden', 'true');
  root.insertBefore(svg, root.firstChild);
  const el = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };

  // axes and densities
  el('line', { x1: TX0 - 10, y1: H - 26, x2: TX1 + 12, y2: H - 26, stroke: '#1d1a2e', 'stroke-width': 1.3, 'marker-end': 'url(#cv-head)' });
  svg.insertAdjacentHTML('afterbegin', '<defs><marker id="cv-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 L3,5z" fill="#1d1a2e"/></marker></defs>');
  const sideways = (f, x0, sc, dir) => { let d = ''; for (let i = 0; i <= 200; i++) { const x = -3.6 + 7.2 * i / 200; d += (i ? 'L' : 'M') + (x0 + dir * sc * f(x)).toFixed(2) + ',' + ty(x).toFixed(2); } return d; };
  const closed = (f, x0, sc, dir) => sideways(f, x0, sc, dir) + `L${x0},${ty(3.6)}L${x0},${ty(-3.6)}Z`;
  el('path', { d: closed(x => g(x, 0, 1), TX0, 120, -1), fill: 'rgb(232,228,245)', 'fill-opacity': .9 });
  el('path', { d: sideways(x => g(x, 0, 1), TX0, 120, -1), fill: 'none', stroke: 'rgb(155,150,180)', 'stroke-width': 1.2 });
  el('line', { x1: TX0, y1: ty(3.6), x2: TX0, y2: ty(-3.6), stroke: 'rgb(155,150,180)', 'stroke-width': 1 });
  const rewPath = () => { let d = ''; for (let i = 0; i <= 120; i++) { const x = 0.2 + 2.8 * i / 120; d += (i ? 'L' : 'M') + (TX1 + 6 + 70 * reward(x)).toFixed(2) + ',' + ty(x).toFixed(2); } return d; };
  const rew = el('path', { d: rewPath(), fill: 'none', stroke: GREEN, 'stroke-width': 1.8, 'stroke-dasharray': '5 4', opacity: 0 });
  const r1f = el('path', { fill: 'rgb(232,228,245)', 'fill-opacity': .9 });
  const r1l = el('path', { fill: 'none', stroke: 'rgb(155,150,180)', 'stroke-width': 1.2 });
  el('line', { x1: TX1, y1: ty(3.6), x2: TX1, y2: ty(-3.6), stroke: 'rgb(155,150,180)', 'stroke-width': 1 });
  const lines = paths.map(() => el('path', { fill: 'none', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-opacity': .85 }));
  const dots = paths.map(() => el('circle', { r: 3.6 }));

  const lbl = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = text; root.appendChild(d); return d; };
  lbl('cv-l cv-rho0', '$\\rho_0$');
  const rho1 = lbl('cv-l cv-rho1', '$\\rho_1$');
  const rlab = lbl('cv-l cv-r', '$r(x)$');
  lbl('cv-l cv-time', 'time $t$');
  const steps = root.parentElement.querySelectorAll('.cv-step');
  const typeset = e => { const go = () => window.MathJax.typesetPromise([e]).catch(() => {}); if (window.MathJax && MathJax.typesetPromise) go(); else window.addEventListener('load', () => setTimeout(() => window.MathJax && MathJax.typesetPromise && go(), 300)); };
  root.querySelectorAll('.cv-l').forEach(typeset);

  // state: a = noise amplitude (0 flow, 1 diffusion), b = tilt (0 base, 1 fine-tuned)
  function draw(a, b, phase, prog) {
    const col = PURPLE.map((c, i) => Math.round(c + (AMBER[i] - c) * a));
    const css = `rgb(${col.join(',')})`;
    paths.forEach((p, i) => {
      const xe = p.xb + (p.xt - p.xb) * b;
      let d = '';
      for (let k = 0; k <= NT; k++) {
        const t = k / NT, x = (1 - sm(t)) * p.x0 + sm(t) * xe + 0.62 * a * p.bridge[k];
        d += (k ? 'L' : 'M') + tx(t).toFixed(2) + ',' + ty(x).toFixed(2);
      }
      lines[i].setAttribute('d', d);
      lines[i].setAttribute('stroke', css);
      const k = Math.min(NT, Math.round(((prog + i * 0.037) % 1) * NT)), t = k / NT;
      const x = (1 - sm(t)) * p.x0 + sm(t) * xe + 0.62 * a * p.bridge[k];
      dots[i].setAttribute('cx', tx(t)); dots[i].setAttribute('cy', ty(x)); dots[i].setAttribute('fill', css);
    });
    const w = W0 + (W1 - W0) * b;
    r1f.setAttribute('d', closed(x => mix(x, w), TX1, 120, 1));
    r1l.setAttribute('d', sideways(x => mix(x, w), TX1, 120, 1));
    const tl = b > 0.5;
    if (rho1.dataset.v !== String(tl)) {
      rho1.dataset.v = String(tl);
      rho1.innerHTML = tl ? '$\\tilde\\rho_1$' : '$\\rho_1$';
      typeset(rho1);
    }
    const show = Math.min(1, b * 2 + (phase >= 2 ? 1 : 0));
    rew.setAttribute('opacity', show); rlab.style.opacity = show;
    steps.forEach((s, i) => s.classList.toggle('on', i === phase));
  }

  // timeline: hold, transition, hold, ... (ms)
  const HOLD = 1500, MOVE = 1700;
  const keys = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const T = 4 * (HOLD + MOVE);
  function stateAt(t) {
    t %= T;
    const seg = Math.floor(t / (HOLD + MOVE)), r = t - seg * (HOLD + MOVE);
    const from = keys[seg], to = keys[(seg + 1) % 4];
    if (seg === 3 && r >= HOLD) return { a: 0, b: 1 - sm((r - HOLD) / MOVE), phase: 0, fade: true };
    const s = r < HOLD ? 0 : sm((r - HOLD) / MOVE);
    return { a: from[0] + (to[0] - from[0]) * s, b: from[1] + (to[1] - from[1]) * s, phase: r < HOLD ? seg : (seg + 1) % 4 };
  }

  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, t0 = 0, acc = 0;
  function frame(now) {
    if (!t0) t0 = now;
    const t = acc + now - t0, s = stateAt(t);
    draw(s.a, s.b, s.phase, (t % 2600) / 2600);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (raf || still) return; t0 = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { if (!raf) return; cancelAnimationFrame(raf); raf = 0; acc += performance.now() - t0; };
  draw(still ? 0 : 0, still ? 1 : 0, still ? 3 : 0, 0.5);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : stop()), { threshold: 0.3 }).observe(root);
  else start();
})();
