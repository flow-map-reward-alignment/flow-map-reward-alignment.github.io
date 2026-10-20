/* WTF project page: "Simulation-free value estimation" figure, rebuilt natively from the paper's figure.
   Three panels share one clock: a forward pass (actor-critic: 1 call through a learned critic; rollout: T steps;
   WTF: two flow-map jumps), then the backward pass (one arc each; the rollout's is slow because it spans T steps).
   Loops while in view, pauses when scrolled away, static final frame under prefers-reduced-motion. */
(function () {
  const root = document.getElementById('valuefig');
  if (!root) return;
  const NS = 'http://www.w3.org/2000/svg';
  const T_CALLS = 50, T_DOTS = 14, CYCLE = 7200;
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  // math-ish label: base + optional subscript, set in the page serif
  const label = (svg, x, y, base, sub, cls, anchor) => {
    const t = el('text', { x, y, class: 'vf-math ' + (cls || ''), 'text-anchor': anchor || 'middle' }, svg);
    t.appendChild(document.createTextNode(base));
    if (sub) { const s = el('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, t); s.textContent = sub; }
    return t;
  };
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const seg = (f, a, b) => ease((f - a) / (b - a));

  const XT = [30, 106], X1 = [290, 106];
  const BASE = 'M30,106 C86,52 128,152 170,114 S250,78 290,106';
  const BACK = 'M286,92 Q160,8 34,92';

  function common(svg, kind) {
    el('circle', { cx: XT[0], cy: XT[1], r: 5, class: 'vf-node' }, svg);
    label(svg, XT[0], XT[1] + 24, 'x', 't');
    const back = el('path', { d: BACK, class: 'vf-back ' + kind }, svg); back.dataset.head = `url(#vf-head-${kind})`;
    const bl = back.getTotalLength(); back.style.strokeDasharray = `5 5`; back.dataset.len = bl;
    const mask = el('path', { d: BACK, class: 'vf-back-mask' }, svg);
    const backLabel = el('text', { x: 160, y: 42, class: 'vf-note ' + kind, 'text-anchor': 'middle' }, svg);
    return { back, mask, backLabel };
  }
  function defs(svg, kind) {
    const d = el('defs', {}, svg);
    const m = el('marker', { id: `vf-head-${kind}`, viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, d);
    el('path', { d: 'M0,0 L10,5 L0,10 z', class: 'vf-headfill ' + kind }, m);
    const f = el('marker', { id: `vf-fwd-${kind}`, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, d);
    el('path', { d: 'M0,0 L10,5 L0,10 z', class: 'vf-fwdfill ' + kind }, f);
  }
  function reward(svg, x, y, base) {
    el('circle', { cx: x, cy: y, r: 5, class: 'vf-node' }, svg);
    const t = el('text', { x, y: y + 24, class: 'vf-math', 'text-anchor': 'middle' }, svg);
    t.textContent = base;
    const r = el('text', { x: x + 4, y: y - 14, class: 'vf-reward', 'text-anchor': 'middle' }, svg);
    r.textContent = '';
    return r;
  }

  /* ---------- panel builders: each returns draw(f) for f in [0,1) ---------- */
  function actorCritic(svg) {
    defs(svg, 'base');
    const c = common(svg, 'base'); c.backLabel.textContent = 'differentiate through the critic';
    el('line', { x1: 36, y1: 106, x2: 112, y2: 106, class: 'vf-wire', 'marker-end': 'url(#vf-fwd-base)' }, svg);
    el('line', { x1: 208, y1: 106, x2: 282, y2: 106, class: 'vf-wire', 'marker-end': 'url(#vf-fwd-base)' }, svg);
    const box = el('rect', { x: 114, y: 86, width: 92, height: 40, rx: 8, class: 'vf-critic' }, svg);
    const bt = el('text', { x: 160, y: 111, class: 'vf-math', 'text-anchor': 'middle' }, svg);
    bt.appendChild(document.createTextNode('V'));
    const s = el('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, bt); s.textContent = 'φ';
    bt.appendChild(document.createTextNode('(t, x)'));
    el('text', { x: 160, y: 142, class: 'vf-small', 'text-anchor': 'middle' }, svg).textContent = 'learned critic';
    el('circle', { cx: 290, cy: 106, r: 5, class: 'vf-node' }, svg);
    label(svg, 290, 130, 'V̂', 't');
    const dot = el('circle', { r: 6, class: 'vf-pulse base' }, svg);
    return (f) => {
      const a = seg(f, 0.0, 0.07), b = seg(f, 0.07, 0.14);
      const x = f < 0.07 ? 30 + (114 - 30) * a : f < 0.14 ? 206 + (290 - 206) * b : 290;
      dot.setAttribute('cx', x); dot.setAttribute('cy', 106);
      dot.style.opacity = f < 0.155 ? 1 : 0;
      box.classList.toggle('on', f > 0.06 && f < 0.1);
      const k = seg(f, 0.58, 0.64);
      c.mask.style.strokeDashoffset = -c.back.dataset.len * k;
      c.mask.style.strokeDasharray = `${c.back.dataset.len} ${c.back.dataset.len}`;
      c.backLabel.style.opacity = k; c.back.setAttribute('marker-end', k > 0.97 ? c.back.dataset.head : '');
      return f < 0.07 ? 0 : 1;
    };
  }

  function rollout(svg) {
    defs(svg, 'base');
    const c = common(svg, 'base'); c.backLabel.textContent = `differentiate through the rollout`;
    const path = el('path', { d: BASE, class: 'vf-base' }, svg);
    const L = path.getTotalLength();
    const trail = el('path', { d: BASE, class: 'vf-trail' }, svg);
    trail.style.strokeDasharray = `${L} ${L}`;
    const dots = [];
    for (let i = 1; i < T_DOTS; i++) {
      const p = path.getPointAtLength(L * i / T_DOTS);
      dots.push(el('circle', { cx: p.x, cy: p.y, r: 3, class: 'vf-step' }, svg));
    }
    const r = reward(svg, X1[0], X1[1], 'x₁');
    const dot = el('circle', { r: 6, class: 'vf-pulse base' }, svg);
    return (f) => {
      const u = Math.min(1, f / 0.55);
      const k = Math.floor(u * T_DOTS);                       // hop dot to dot
      const pt = path.getPointAtLength(L * Math.min(T_DOTS, k + seg(u * T_DOTS - k, 0, 0.6)) / T_DOTS);
      dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
      dot.style.opacity = f < 0.565 ? 1 : 0;
      trail.style.strokeDashoffset = L * (1 - u);
      dots.forEach((d, i) => d.classList.toggle('done', i < k));
      r.textContent = f >= 0.55 ? 'r(x₁)' : '';
      const b = seg(f, 0.58, 0.86);
      c.mask.style.strokeDasharray = `${c.back.dataset.len} ${c.back.dataset.len}`;
      c.mask.style.strokeDashoffset = -c.back.dataset.len * b;
      c.backLabel.style.opacity = Math.min(1, b * 3); c.back.setAttribute('marker-end', b > 0.97 ? c.back.dataset.head : '');
      return Math.round(T_CALLS * u);
    };
  }

  function wtf(svg) {
    defs(svg, 'ours');
    const c = common(svg, 'ours'); c.backLabel.textContent = 'differentiate the value estimate';
    const path = el('path', { d: BASE, class: 'vf-base faint' }, svg);
    const L = path.getTotalLength(), pt = path.getPointAtLength(L * 0.5);
    const J1 = `M30,106 Q${(30 + pt.x) / 2},${Math.max(106, pt.y) + 52} ${pt.x},${pt.y}`;
    const J2 = `M${pt.x},${pt.y} Q${(pt.x + 290) / 2},${Math.max(106, pt.y) + 52} 290,106`;
    const j1 = el('path', { d: J1, class: 'vf-jump', 'marker-end': 'url(#vf-fwd-ours)' }, svg);
    const j2 = el('path', { d: J2, class: 'vf-jump', 'marker-end': 'url(#vf-fwd-ours)' }, svg);
    const l1 = j1.getTotalLength(), l2 = j2.getTotalLength();
    [j1, j2].forEach((j, i) => { const l = i ? l2 : l1; j.style.strokeDasharray = `${l} ${l}`; });
    el('circle', { cx: pt.x, cy: pt.y, r: 4.5, class: 'vf-node mid' }, svg);
    label(svg, pt.x + 2, pt.y - 13, 'x̄', 'τ');
    label(svg, (30 + pt.x) / 2 - 4, Math.max(106, pt.y) + 44, 'X', 't,τ', 'ours');
    label(svg, (pt.x + 290) / 2 + 4, Math.max(106, pt.y) + 44, 'X', 'τ,1', 'ours');
    const r = reward(svg, X1[0], X1[1], 'x̄₁');
    const dot = el('circle', { r: 6, class: 'vf-pulse ours' }, svg);
    const cost = el('text', { x: pt.x, y: pt.y - 30, class: 'vf-cost', 'text-anchor': 'middle' }, svg);
    cost.textContent = 'control cost';
    return (f) => {
      // jump to the intermediate state, pause there to read the control cost, then jump to the endpoint
      const a = seg(f, 0.0, 0.07), b = seg(f, 0.22, 0.29);
      j1.style.strokeDashoffset = l1 * (1 - a); j2.style.strokeDashoffset = l2 * (1 - b);
      const p = f < 0.22 ? j1.getPointAtLength(l1 * a) : j2.getPointAtLength(l2 * b);
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      dot.style.opacity = f < 0.305 ? 1 : 0;
      cost.style.opacity = seg(f, 0.08, 0.12);
      r.textContent = f >= 0.29 ? 'r(x̄₁)' : '';
      const k = seg(f, 0.58, 0.64);
      c.mask.style.strokeDasharray = `${c.back.dataset.len} ${c.back.dataset.len}`;
      c.mask.style.strokeDashoffset = -c.back.dataset.len * k;
      c.backLabel.style.opacity = k; c.back.setAttribute('marker-end', k > 0.97 ? c.back.dataset.head : '');
      return f < 0.07 ? (a > 0.02 ? 1 : 0) : f < 0.22 ? 1 : 2;
    };
  }

  const panels = [...root.querySelectorAll('.vf-panel')].map((p) => {
    const svg = el('svg', { viewBox: '0 30 320 140', class: 'vf-svg', role: 'img', 'aria-label': p.dataset.aria }, null);
    p.querySelector('.vf-stage').appendChild(svg);
    const draw = { ac: actorCritic, rollout: rollout, wtf: wtf }[p.dataset.kind](svg);
    return { draw, counter: p.querySelector('.vf-calls b'), bar: p.querySelector('.vf-bar i') };
  });
  const render = (f) => panels.forEach((p) => {
    const n = p.draw(f);
    p.counter.textContent = n;
    p.bar.style.width = (100 * n / T_CALLS) + '%';
  });

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { render(0.99); return; }
  let raf = 0, t0 = 0;
  const frame = (now) => { if (!t0) t0 = now; render(((now - t0) % CYCLE) / CYCLE); raf = requestAnimationFrame(frame); };
  render(0.99);
  new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { if (!raf) { t0 = 0; raf = requestAnimationFrame(frame); } }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }), { threshold: 0.3 }).observe(root);
})();
