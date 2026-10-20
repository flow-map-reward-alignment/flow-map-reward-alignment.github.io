/* Policy iteration in WTF, schematic. One deterministic timeline drives two panels:
   left, a trajectory view (base flow dashed, controlled trajectory in the accent colour, control arrows from the
   base to the controlled path, reward at the endpoint); right, the (s, t) square of the flow map, whose diagonal is
   the velocity and whose off-diagonal holds the finite-time transitions.
   Each iteration: evaluate the frozen reference with two flow-map jumps (cost at x_tau, reward at x_1), improve the
   control along the value gradient, then self-distill the flow map outward from the diagonal. */
(function () {
  'use strict';
  const fig = document.getElementById('pifig');
  if (!fig) return;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, a, parent) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; };
  const clamp = v => Math.max(0, Math.min(1, v));
  const ease = u => { u = clamp(u); return u * u * (3 - 2 * u); };
  const win = (u, a, b) => ease((u - a) / (b - a));
  const mathText = (parent, x, y, base, sub, cls, anchor, sup) => {
    const t = el('text', { x, y, class: 'pi-math ' + (cls || ''), 'text-anchor': anchor || 'middle' }, parent);
    t.appendChild(document.createTextNode(base));
    if (sub) { const s = el('tspan', { 'baseline-shift': 'sub', 'font-size': '70%' }, t); s.textContent = sub; }
    if (sup) { const s = el('tspan', { 'baseline-shift': 'super', 'font-size': '70%' }, t); s.textContent = sup; }
    return t;
  };

  /* ---------------- left: trajectory panel ---------------- */
  const L = fig.querySelector('.pi-left');
  const svg = el('svg', { viewBox: '0 0 680 360', class: 'pi-svg', 'aria-hidden': 'true' });
  L.appendChild(svg);
  const defs = el('defs', {}, svg);
  const marker = (id, cls) => { const m = el('marker', { id, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' }, defs); el('path', { d: 'M0,0 L10,5 L0,10 L3,5 z', class: cls }, m); };
  marker('pi-h-acc', 'pi-fill-acc'); marker('pi-h-cost', 'pi-fill-cost'); marker('pi-h-grad', 'pi-fill-acc');
  const glow = el('radialGradient', { id: 'pi-glow' }, defs);
  el('stop', { offset: '0%', 'stop-color': 'rgb(80,130,80)', 'stop-opacity': .38 }, glow);
  el('stop', { offset: '100%', 'stop-color': 'rgb(80,130,80)', 'stop-opacity': 0 }, glow);

  const X = t => 70 + 520 * t;
  const yb = t => 244 + 26 * t - 20 * Math.sin(Math.PI * t);          // pretrained (base) flow
  const S = t => Math.pow(t, 1.45);
  const yc = (t, e) => yb(t) + (e - yb(1)) * S(t);                      // controlled path with endpoint e
  const E = [200, 162, 138, 126];                                       // reference endpoints (first one already steered)                                     // endpoint after k improvements
  const TAU = [0.74, 0.66, 0.8], TT = 0.3;
  const pathD = (f, a = 0, b = 1, n = 70) => { let d = ''; for (let i = 0; i <= n; i++) { const t = a + (b - a) * i / n; d += (i ? 'L' : 'M') + X(t).toFixed(1) + ',' + f(t).toFixed(1); } return d; };

  // axis
  el('line', { x1: 60, y1: 318, x2: 616, y2: 318, class: 'pi-axis', 'marker-end': 'url(#pi-h-acc)' }, svg).classList.add('dark');
  [[0, '0'], [1, '1']].forEach(([t, s]) => { el('line', { x1: X(t), y1: 313, x2: X(t), y2: 323, class: 'pi-axis' }, svg); el('text', { x: X(t), y: 342, class: 'pi-tick', 'text-anchor': 'middle' }, svg).textContent = s; });
  el('text', { x: 628, y: 322, class: 'pi-tick' }, svg).textContent = 'time';
  // reward
  el('circle', { cx: X(1), cy: 118, r: 46, fill: 'url(#pi-glow)' }, svg);
  [30, 19, 9].forEach((r, i) => el('circle', { cx: X(1), cy: 118, r, class: 'pi-rew-ring', style: `opacity:${0.28 + 0.2 * i}` }, svg));
  // base flow
  el('path', { d: pathD(yb), class: 'pi-base' }, svg);
  el('circle', { cx: X(1), cy: yb(1), r: 4, class: 'pi-dot-base' }, svg);
  el('text', { x: X(1) - 6, y: yb(1) + 22, class: 'pi-note', 'text-anchor': 'end' }, svg).textContent = 'pretrained flow';
  el('circle', { cx: X(0), cy: yb(0), r: 4.5, class: 'pi-dot' }, svg);
  mathText(svg, X(0) - 10, yb(0) + 5, 'x', '0', '', 'end');

  const ghosts = [0, 1, 2].map(() => el('path', { class: 'pi-ghost' }, svg));
  const ctrlArrows = Array.from({ length: 7 }, () => el('line', { class: 'pi-ctrl', 'marker-end': 'url(#pi-h-cost)' }, svg));
  const traj = el('path', { class: 'pi-traj' }, svg);
  const endDot = el('circle', { r: 5, class: 'pi-dot-acc' }, svg);
  const xtDot = el('circle', { r: 5, class: 'pi-dot' }, svg);
  const xtLab = mathText(svg, 0, 0, 'x', 't');
  const j1 = el('path', { class: 'pi-jump', 'marker-end': 'url(#pi-h-acc)' }, svg);
  const j2 = el('path', { class: 'pi-jump', 'marker-end': 'url(#pi-h-acc)' }, svg);
  const tauDot = el('circle', { r: 4.6, class: 'pi-dot-cost' }, svg);
  const tauLab = mathText(svg, 0, 0, 'x', 'τ', 'pi-cost-txt');
  const costArr = el('line', { class: 'pi-cost', 'marker-end': 'url(#pi-h-cost)' }, svg);
  const costLab = mathText(svg, 0, 0, '‖ū', 'τ', 'pi-cost-txt', 'start', '');
  costLab.appendChild(document.createTextNode('‖²'));
  const rewLab = mathText(svg, 0, 0, 'λ r(x', '1', 'pi-rew-txt', 'start'); rewLab.appendChild(document.createTextNode(')'));
  const grad = el('line', { class: 'pi-grad', 'marker-end': 'url(#pi-h-grad)' }, svg);
  const gradLab = mathText(svg, 0, 0, '∇V̂', '', 'pi-grad-txt', 'end');
  const endLab = mathText(svg, 0, 0, 'x', '1', '', 'start');

  /* ---------------- right: (s, t) square ---------------- */
  const R = fig.querySelector('.pi-right');
  const sq = el('svg', { viewBox: '0 0 330 320', class: 'pi-svg', 'aria-hidden': 'true' });
  R.appendChild(sq);
  const A = { x0: 62, y0: 262, x1: 292, y1: 32 };                       // s right, t up
  const P = (s, t) => [A.x0 + (A.x1 - A.x0) * s, A.y0 + (A.y1 - A.y0) * t];
  const poly = pts => pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  el('rect', { x: A.x0, y: A.y1, width: A.x1 - A.x0, height: A.y0 - A.y1, class: 'pi-sq' }, sq);
  el('polygon', { points: poly([P(0, 0), P(1, 1), P(0, 1)]), class: 'pi-tri' }, sq);
  const band = el('polygon', { class: 'pi-band' }, sq);
  const sweep = el('line', { class: 'pi-sweep' }, sq);
  const diagGlow = el('line', { x1: P(0, 0)[0], y1: P(0, 0)[1], x2: P(1, 1)[0], y2: P(1, 1)[1], class: 'pi-diag-glow' }, sq);
  el('line', { x1: P(0, 0)[0], y1: P(0, 0)[1], x2: P(1, 1)[0], y2: P(1, 1)[1], class: 'pi-diag' }, sq);
  const outArrows = [0.25, 0.5, 0.75].map(c => { const a = P(c, c), d = 0.17; const b = P(c - d, c + d); return el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'pi-out', 'marker-end': 'url(#pi-h-sq)' }, sq); });
  const sqDefs = el('defs', {}, sq);
  const m2 = el('marker', { id: 'pi-h-sq', viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, sqDefs); el('path', { d: 'M0,0 L10,5 L0,10 L3,5 z', class: 'pi-fill-acc' }, m2);
  mathText(sq, (A.x0 + A.x1) / 2, A.y0 + 30, 's', '', 'pi-axlab');
  mathText(sq, A.x0 - 22, (A.y0 + A.y1) / 2 + 5, 't', '', 'pi-axlab');
  const cDot = el('circle', { cx: A.x0, cy: A.y1, r: 4.5, class: 'pi-dot-acc' }, sq);
  mathText(sq, A.x0 + 10, A.y1 + 22, 'X', '0,1', 'pi-acc-txt', 'start');
  const dLab = el('text', { x: P(0.62, 0.48)[0] + 10, y: P(0.62, 0.48)[1] + 22, class: 'pi-sqnote', 'text-anchor': 'start' }, sq);
  dLab.textContent = 'velocity';
  const oLab = el('text', { x: P(0.2, 0.62)[0] - 6, y: P(0.2, 0.62)[1] - 14, class: 'pi-sqnote acc', 'text-anchor': 'middle' }, sq);
  oLab.textContent = 'flow map';

  /* ---------------- timeline ---------------- */
  const IT = 6900, HOLD = 2400, RESET = 1100, NK = 3, TOTAL = NK * IT + HOLD + RESET;
  const steps = fig.querySelectorAll('.cv-step'), iterB = fig.querySelector('.pi-iter b'), eq = fig.querySelector('.pi-eq');
  const arc = (ax, ay, bx, by) => `M${ax},${ay} Q${(ax + bx) / 2},${Math.min(ay, by) - 44} ${bx},${by}`;
  const setLine = (l, x1, y1, x2, y2) => { l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); };
  const draw = (p, f) => { const n = p.getTotalLength(); p.style.strokeDasharray = `${n} ${n}`; p.style.strokeDashoffset = n * (1 - f); };

  function render(T) {
    T %= TOTAL;
    let k, u, phase;
    if (T < NK * IT) { k = Math.floor(T / IT); u = T - k * IT; phase = 'iter'; }
    else if (T < NK * IT + HOLD) { k = NK - 1; u = IT; phase = 'hold'; }
    else { k = NK - 1; u = IT; phase = 'reset'; }
    const rr = phase === 'reset' ? ease((T - NK * IT - HOLD) / RESET) : 0;
    const eRef = E[k];
    const morph = phase === 'iter' ? win(u, 3500, 4750) : 1;
    let e = eRef + (E[k + 1] - eRef) * morph;
    if (phase === 'reset') e = E[NK] + (E[0] - E[NK]) * rr;

    // stage + labels
    const stage = phase !== 'iter' ? -1 : u < 2950 ? 0 : u < 4750 ? 1 : 2;
    steps.forEach((s, i) => s.classList.toggle('on', i === stage));
    iterB.textContent = phase === 'reset' && rr > 0.5 ? 1 : k + 1;
    eq.classList.toggle('on', stage === 0 && u > 2350 || stage === 1 && u < 3500);

    // ghosts of previous iterates
    ghosts.forEach((g, j) => {
      const show = phase === 'iter' ? (j < k ? 1 : j === k ? morph : 0) : 1;
      g.setAttribute('d', pathD(t => yc(t, E[j])));
      g.style.opacity = (show * (1 - rr)) * 0.55;
    });
    traj.setAttribute('d', pathD(t => yc(t, e)));
    endDot.setAttribute('cx', X(1)); endDot.setAttribute('cy', e);
    endLab.setAttribute('x', X(1) + 12); endLab.setAttribute('y', e + 18);
    const evalOn = phase === 'iter' && u < 3900;
    ctrlArrows.forEach((a, i) => {
      const t = 0.18 + i * 0.125, y0 = yb(t), y1 = yc(t, e);
      setLine(a, X(t), y0, X(t), y1 + (y1 < y0 - 8 ? 6 : 0));
      const nearTau = evalOn && Math.abs(t - TAU[k]) < 0.07;
      a.style.opacity = Math.abs(y0 - y1) > 9 && !nearTau ? 0.45 : 0;
    });

    // evaluate: x_t, two jumps, cost at x_tau, reward at x_1
    const ev = phase === 'iter' ? 1 - win(u, 3500, 3900) : 0;
    const tau = TAU[k], xt = [X(TT), yc(TT, eRef)], xtau = [X(tau), yc(tau, eRef)], x1 = [X(1), eRef];
    const xtNow = [X(TT), yc(TT, e)];
    xtDot.setAttribute('cx', xtNow[0]); xtDot.setAttribute('cy', xtNow[1]);
    xtDot.style.opacity = phase === 'iter' ? win(u, 0, 400) : 1 - rr;
    xtLab.setAttribute('x', xtNow[0] - 12); xtLab.setAttribute('y', xtNow[1] - 12); xtLab.setAttribute('text-anchor', 'end'); xtLab.style.opacity = xtDot.style.opacity;
    j1.setAttribute('d', arc(xt[0], xt[1], xtau[0], xtau[1])); j2.setAttribute('d', arc(xtau[0], xtau[1], x1[0], x1[1] + 6));
    const f1 = phase === 'iter' ? win(u, 550, 1250) : 0, f2 = phase === 'iter' ? win(u, 1750, 2400) : 0;
    draw(j1, f1); draw(j2, f2);
    j1.style.opacity = f1 > 0.03 ? ev : 0; j2.style.opacity = f2 > 0.03 ? ev : 0;
    const cA = phase === 'iter' ? win(u, 1250, 1550) * ev : 0;
    tauDot.setAttribute('cx', xtau[0]); tauDot.setAttribute('cy', xtau[1]); tauDot.style.opacity = cA;
    tauLab.setAttribute('x', xtau[0] + 12); tauLab.setAttribute('y', xtau[1] + 20); tauLab.setAttribute('text-anchor', 'start'); tauLab.style.opacity = cA;
    setLine(costArr, xtau[0], yb(tau), xtau[0], xtau[1] + 7); costArr.style.opacity = cA;
    costLab.setAttribute('x', xtau[0]); costLab.setAttribute('y', yb(tau) + 24); costLab.setAttribute('text-anchor', 'middle'); costLab.style.opacity = cA;
    const rA = phase === 'iter' ? win(u, 2350, 2650) * ev : 0;
    rewLab.setAttribute('x', X(1) + 12); rewLab.setAttribute('y', eRef - 10); rewLab.setAttribute('text-anchor', 'start'); rewLab.style.opacity = rA;
    endLab.style.opacity = 1 - rA;

    // improve: value-gradient arrow at x_t, then the trajectory bends
    const gA = phase === 'iter' ? win(u, 2950, 3400) * (1 - win(u, 4500, 4800)) : 0;
    const gLen = (E[k] - E[k + 1]) * 0.5 * win(u, 2950, 3400);
    setLine(grad, xt[0], xt[1] - 5, xt[0], xt[1] - 5 - Math.max(gLen, 0.1)); grad.style.opacity = gA;
    gradLab.setAttribute('x', xt[0] + 10); gradLab.setAttribute('y', xt[1] - 4 - gLen / 2); gradLab.setAttribute('text-anchor', 'start'); gradLab.style.opacity = gA;

    // right panel: fit the diagonal (improve), then distill outward (distill)
    const fit = phase === 'iter' ? win(u, 2950, 3300) * (1 - win(u, 4600, 5000)) : 0;
    diagGlow.style.opacity = fit;
    dLab.style.opacity = 0.55 + 0.45 * fit;
    const dd = phase === 'iter' ? win(u, 4750, 6400) : 1;
    const bandOn = phase === 'iter' ? (u >= 4750 ? 1 : 0) : 1 - rr;
    const d = dd;
    band.setAttribute('points', poly([P(0, 0), P(1, 1), P(1 - d, 1), P(0, d)]));
    band.style.opacity = bandOn;
    const s0 = P(0, d), s1 = P(Math.max(0, 1 - d), 1);
    setLine(sweep, s0[0], s0[1], s1[0], s1[1]); sweep.style.opacity = phase === 'iter' && u > 4750 && u < 6500 ? 1 : 0;
    outArrows.forEach((a, i) => { a.style.opacity = phase === 'iter' ? win(u, 4750 + i * 180, 5150 + i * 180) * (1 - win(u, 6300, 6800)) : 0; });
    oLab.style.opacity = 0.55 + 0.45 * (phase === 'iter' ? win(u, 4750, 5200) * (1 - win(u, 6300, 6800)) : 0);
    cDot.style.opacity = phase === 'iter' ? 0.4 + 0.6 * win(u, 6000, 6400) : 1;
  }

  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, t0 = 0, acc = 0;
  const frame = now => { if (!t0) t0 = now; render(acc + now - t0); raf = requestAnimationFrame(frame); };
  const start = () => { if (raf || still) return; t0 = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { if (!raf) return; cancelAnimationFrame(raf); raf = 0; acc += performance.now() - t0; };
  render(still ? NK * IT + 10 : 0);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : stop()), { threshold: 0.3 }).observe(fig);
  else start();
})();
