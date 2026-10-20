/* KL-based fine-tuning vs WTF, in one spatial dimension and on one clock.
   Top row: the pretrained flow is converted into a diffusion with the same marginals (Brownian-bridge noise on
   each path), fine-tuned toward the exact reward tilt, and converted back to a flow.
   Bottom row: the same pretrained flow is steered directly. Each sample moves to the endpoint that best trades
   reward against a quadratic steering cost from its pretrained endpoint (a schematic of the per-sample WTF
   optimum), so mass moves toward nearby reward instead of being reweighted.
   Both rows share the base flow, the reward and lambda; the two optima differ, as they should. */
(function () {
  'use strict';
  const fig = document.querySelector('figure.cvfig');
  if (!fig) return;
  const ns = 'http://www.w3.org/2000/svg';
  const W = 1000, H = 300, TX0 = 170, TX1 = 830, YC = 150, SY = 40;
  const PURPLE = [91, 63, 176], AMBER = [217, 130, 43], GREEN = 'rgb(80,130,80)';
  const ty = x => YC - SY * x, tx = t => TX0 + (TX1 - TX0) * t;

  // base flow: rho_0 = N(0,1) -> rho_1 = equal mixture at -1.5 and +1.5
  const g = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  const MS = 0.42, M = 1.5;
  const base1 = x => 0.5 * g(x, -M, MS) + 0.5 * g(x, M, MS);
  // reward: a large bump just inside the upper mode, a smaller one just inside the lower mode
  const reward = x => Math.exp(-((x - 0.9) ** 2) / 0.8) + 0.5 * Math.exp(-((x + 0.9) ** 2) / 0.8);
  const LAM = 3, COST = 2.5;                         // steering cost COST * (y - x)^2
  const tiltU = x => base1(x) * Math.exp(LAM * reward(x));

  const XS = Array.from({ length: 1601 }, (_, i) => -4 + i * 8 / 1600), DX = 8 / 1600;
  const integ = f => { let s = 0; for (let i = 1; i < XS.length; i++) s += 0.5 * (f(XS[i]) + f(XS[i - 1])) * DX; return s; };
  const ZT = integ(tiltU), tilt1 = x => tiltU(x) / ZT;
  const cdfTable = f => { const c = [0]; for (let i = 1; i < XS.length; i++) c.push(c[i - 1] + 0.5 * (f(XS[i]) + f(XS[i - 1])) * DX); const z = c[c.length - 1]; return c.map(v => v / z); };
  const quant = (c, u) => { let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; c[m] < u ? lo = m : hi = m; } const f = (u - c[lo]) / Math.max(1e-12, c[hi] - c[lo]); return XS[lo] + f * (XS[hi] - XS[lo]); };
  const C0 = cdfTable(x => g(x, 0, 1)), CB = cdfTable(base1), CT = cdfTable(tilt1);
  // per-sample transport optimum from a pretrained endpoint x
  const YG = Array.from({ length: 801 }, (_, i) => -4 + i * 0.01);
  const steer = x => { let best = x, bv = -1e9; for (const y of YG) { const v = LAM * reward(y) - COST * (y - x) ** 2; if (v > bv) { bv = v; best = y; } } return best; };

  const N = 15, NT = 90;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const paths = Array.from({ length: N }, (_, i) => {
    const u = (i + 0.5) / N, xb = quant(CB, u);
    const w = [0]; for (let k = 1; k <= NT; k++) w.push(w[k - 1] + gauss() * Math.sqrt(1 / NT));
    return { x0: quant(C0, u), xb, kl: quant(CT, u), wtf: steer(xb), bridge: w.map((v, k) => v - (k / NT) * w[NT]) };
  });
  // dense sample of pretrained endpoints and their steered endpoints, for the WTF terminal density
  const DENSE = Array.from({ length: 600 }, (_, i) => { const xb = quant(CB, (i + 0.5) / 600); return [xb, steer(xb)]; });
  const kde = (pts, bw) => x => { let s = 0; for (const p of pts) s += Math.exp(-0.5 * ((x - p) / bw) ** 2); return s / (pts.length * bw * Math.sqrt(2 * Math.PI)); };
  const sm = t => t * t * (3 - 2 * t);

  function makeRow(root, mode) {
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'cv-svg');
    svg.setAttribute('aria-hidden', 'true');
    root.insertBefore(svg, root.firstChild);
    const el = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
    const sideways = (f, x0, sc, dir) => { let d = ''; for (let i = 0; i <= 200; i++) { const x = -3.4 + 6.8 * i / 200; d += (i ? 'L' : 'M') + (x0 + dir * sc * f(x)).toFixed(2) + ',' + ty(x).toFixed(2); } return d; };
    const closed = (f, x0, sc, dir) => sideways(f, x0, sc, dir) + `L${x0},${ty(3.4)}L${x0},${ty(-3.4)}Z`;
    el('path', { d: closed(x => g(x, 0, 1), TX0, 100, -1), fill: 'rgb(232,228,245)', 'fill-opacity': .9 });
    el('path', { d: sideways(x => g(x, 0, 1), TX0, 100, -1), fill: 'none', stroke: 'rgb(155,150,180)', 'stroke-width': 1.2 });
    el('line', { x1: TX0, y1: ty(3.4), x2: TX0, y2: ty(-3.4), stroke: 'rgb(155,150,180)', 'stroke-width': 1 });
    let rp = ''; for (let i = 0; i <= 160; i++) { const x = -3 + 6 * i / 160; rp += (i ? 'L' : 'M') + (TX1 + 6 + 60 * reward(x)).toFixed(2) + ',' + ty(x).toFixed(2); }
    const rew = el('path', { d: rp, fill: 'none', stroke: GREEN, 'stroke-width': 1.8, 'stroke-dasharray': '5 4', opacity: 0 });
    const r1f = el('path', { fill: 'rgb(232,228,245)', 'fill-opacity': .9 });
    const r1l = el('path', { fill: 'none', stroke: 'rgb(155,150,180)', 'stroke-width': 1.2 });
    el('line', { x1: TX1, y1: ty(3.4), x2: TX1, y2: ty(-3.4), stroke: 'rgb(155,150,180)', 'stroke-width': 1 });
    const lines = paths.map(() => el('path', { fill: 'none', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-opacity': .85 }));
    const dots = paths.map(() => el('circle', { r: 3.4 }));
    const lbl = (cls, text) => { const d = document.createElement('div'); d.className = 'cv-l ' + cls; d.innerHTML = text; root.appendChild(d); return d; };
    lbl('cv-rho0', '$\\rho_0$');
    const rho1 = lbl('cv-rho1', '$\\rho_1$');
    const rlab = lbl('cv-r', '$r(x)$');
    const typeset = e => { const go = () => window.MathJax.typesetPromise([e]).catch(() => {}); if (window.MathJax && MathJax.typesetPromise) go(); else window.addEventListener('load', () => setTimeout(() => window.MathJax && MathJax.typesetPromise && go(), 300)); };
    root.querySelectorAll('.cv-l').forEach(typeset);
    let lastB = -1;

    return function draw(a, b, prog) {
      const col = PURPLE.map((c, i) => Math.round(c + (AMBER[i] - c) * a));
      const css = `rgb(${col.join(',')})`;
      paths.forEach((p, i) => {
        const xe = p.xb + ((mode === 'kl' ? p.kl : p.wtf) - p.xb) * b;
        let d = '';
        for (let k = 0; k <= NT; k++) {
          const t = k / NT, x = (1 - sm(t)) * p.x0 + sm(t) * xe + 0.55 * a * p.bridge[k];
          d += (k ? 'L' : 'M') + tx(t).toFixed(2) + ',' + ty(x).toFixed(2);
        }
        lines[i].setAttribute('d', d); lines[i].setAttribute('stroke', css);
        const k = Math.min(NT, Math.round(((prog + i * 0.037) % 1) * NT)), t = k / NT;
        const x = (1 - sm(t)) * p.x0 + sm(t) * xe + 0.55 * a * p.bridge[k];
        dots[i].setAttribute('cx', tx(t)); dots[i].setAttribute('cy', ty(x)); dots[i].setAttribute('fill', css);
      });
      const bq = Math.round(b * 40) / 40;
      if (bq !== lastB) {
        lastB = bq;
        const f = mode === 'kl'
          ? (x => (1 - bq) * base1(x) + bq * tilt1(x))
          : kde(DENSE.map(([xb, y]) => xb + (y - xb) * bq), 0.12);
        r1f.setAttribute('d', closed(f, TX1, 100, 1));
        r1l.setAttribute('d', sideways(f, TX1, 100, 1));
      }
      const tl = b > 0.5;
      if (rho1.dataset.v !== String(tl)) { rho1.dataset.v = String(tl); rho1.innerHTML = tl ? '$\\tilde\\rho_1$' : '$\\rho_1$'; typeset(rho1); }
      const show = Math.min(1, b * 2.5);
      rew.setAttribute('opacity', show); rlab.style.opacity = show;
    };
  }

  const rows = [...fig.querySelectorAll('.convertfig')].map(r => ({ mode: r.dataset.mode, draw: makeRow(r, r.dataset.mode), steps: r.parentElement.querySelectorAll('.cv-step') }));

  // KL row: pretrained -> diffusion -> fine-tuned diffusion -> fine-tuned flow. The WTF row aligns while KL fine-tunes.
  const HOLD = 1500, MOVE = 1700;
  const keys = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const T = 4 * (HOLD + MOVE);
  function stateAt(t) {
    t %= T;
    const seg = Math.floor(t / (HOLD + MOVE)), r = t - seg * (HOLD + MOVE);
    const from = keys[seg], to = keys[(seg + 1) % 4];
    if (seg === 3 && r >= HOLD) return { a: 0, b: 1 - sm((r - HOLD) / MOVE), phase: 0 };
    const s = r < HOLD ? 0 : sm((r - HOLD) / MOVE);
    return { a: from[0] + (to[0] - from[0]) * s, b: from[1] + (to[1] - from[1]) * s, phase: r < HOLD ? seg : (seg + 1) % 4 };
  }
  function render(s, prog) {
    rows.forEach(row => {
      if (row.mode === 'kl') { row.draw(s.a, s.b, prog); row.steps.forEach((e, i) => e.classList.toggle('on', i === s.phase)); }
      else { row.draw(0, s.b, prog); row.steps.forEach((e, i) => e.classList.toggle('on', i === (s.phase >= 2 ? 1 : 0))); }
    });
  }
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, t0 = 0, acc = 0;
  function frame(now) { if (!t0) t0 = now; const t = acc + now - t0; render(stateAt(t), (t % 2600) / 2600); raf = requestAnimationFrame(frame); }
  const start = () => { if (raf || still) return; t0 = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { if (!raf) return; cancelAnimationFrame(raf); raf = 0; acc += performance.now() - t0; };
  render(still ? { a: 0, b: 1, phase: 3 } : { a: 0, b: 0, phase: 0 }, 0.5);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : stop()), { threshold: 0.25 }).observe(fig);
  else start();
})();
