/* GenEval accuracy against NFE (FMRG Figure 13), drawn in the page's chart style.
   Points were read off the paper's figure (arxiv/figures/pareto_lin.png) by marker detection with
   tick-calibrated axes; they agree with the paper's table to within 0.001 (FMRG-J 0.800 at 100,
   FMRG-E 0.766 at 100, Best-of-N 0.758 at 128). Reference lines use the table values. */
(function () {
  const fig = document.getElementById('genevalfig');
  if (!fig) return;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const S = [
    { key: 'j', name: 'FMRG-J (ours)', color: 'var(--accent)', ours: true,
      pts: [[6, .695], [11, .730], [21, .770], [29, .781], [41, .786], [61, .789], [81, .797], [100, .800]] },
    { key: 'e', name: 'FMRG-E (ours)', color: '#9b88d8', ours: true,
      pts: [[5, .682], [9, .722], [18, .729], [30, .744], [59, .760], [99, .766]] },
    { key: 'bon', name: 'Best-of-N', color: '#8f8c99',
      pts: [[4, .649], [8, .693], [16, .716], [32, .740], [64, .747], [128, .759]] },
    { key: 'reno', name: 'ReNO', color: '#c9a46a',
      pts: [[9, .677], [18, .698], [33, .713], [58, .717], [108, .718]] },
  ];
  const W = 780, H = 420, L = 62, R = 186, T = 22, B = 50;
  const xmax = 135, ymin = .64, ymax = .81;
  const X = v => L + (v / xmax) * (W - L - R), Y = v => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cf-svg', role: 'img',
    'aria-label': 'GenEval accuracy against network function evaluations. FMRG-J rises fastest, reaching 0.77, the accuracy of flow map trajectory tilting at 1400 NFEs, at about 20 NFEs, and 0.80 at 100 NFEs.' });
  fig.querySelector('.cf-stage').appendChild(svg);

  for (const v of [.65, .70, .75, .80]) {
    el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'cf-grid' }, svg);
    el('text', { x: L - 10, y: Y(v) + 4, class: 'cf-tick', 'text-anchor': 'end' }, svg).textContent = v.toFixed(2);
  }
  el('line', { x1: L, x2: W - R, y1: Y(ymin), y2: Y(ymin), class: 'cf-axis' }, svg);
  for (const v of [0, 20, 40, 60, 80, 100, 120]) {
    el('text', { x: X(v), y: Y(ymin) + 20, class: 'cf-tick', 'text-anchor': 'middle' }, svg).textContent = v;
  }
  el('text', { x: (L + W - R) / 2, y: H - 8, class: 'cf-axlabel', 'text-anchor': 'middle' }, svg).textContent = 'network function evaluations (NFE)';
  el('text', { x: 16, y: (T + Y(ymin)) / 2, class: 'cf-axlabel', 'text-anchor': 'middle',
    transform: `rotate(-90 16 ${(T + Y(ymin)) / 2})` }, svg).textContent = 'GenEval accuracy';

  // reference lines: FLUX.1-dev at 50 NFE, and flow map trajectory tilting (reward tilt) at 1400 NFE
  const ref = (y, cls, label, color) => {
    el('line', { x1: L, x2: W - R, y1: Y(y), y2: Y(y), class: 'gv-ref ' + cls, style: `stroke:${color}` }, svg);
    el('text', { x: W - R + 8, y: Y(y) + 4, class: 'gv-ref-text', style: `fill:${color}` }, svg).textContent = label;
  };
  ref(.662, 'dot', 'FLUX.1-dev, 50 NFE', 'var(--ink-faint)');
  ref(.771, 'dash', 'Trajectory tilting, 1400 NFE', 'var(--c-kl)');

  // series, drawn back to front
  for (const s of S.slice().reverse()) {
    const g = el('g', { class: 'gv-series' + (s.ours ? ' ours' : '') }, svg);
    el('polyline', { points: s.pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' '),
      class: 'cf-line' + (s.key === 'j' ? ' ours' : ''), style: `stroke:${s.color}` }, g);
    for (const [x, y] of s.pts) {
      const c = el('circle', { cx: X(x), cy: Y(y), r: s.key === 'j' ? 4.2 : 3.4, class: 'gv-dot', style: `fill:${s.color}` }, g);
      el('title', {}, c).textContent = `${s.name}: ${y.toFixed(3)} at ${x} NFE`;
    }
    const [lx, ly] = s.pts[s.pts.length - 1];
    const dy = { j: -2, e: 4, bon: 4, reno: 12 }[s.key];
    el('text', { x: X(lx) + 9, y: Y(ly) + dy, class: 'cf-label' + (s.key === 'j' ? ' ours' : ''), style: `fill:${s.color}` }, g).textContent = s.name;
  }

  // the 70x span: where FMRG-J reaches the tilting accuracy, out to the right edge (1400 NFE is off the axis)
  const sy = Y(.771) - 8;
  const sg = el('g', { class: 'gv-span' }, svg);
  el('line', { x1: X(21), x2: W - R - 4, y1: sy, y2: sy, class: 'cf-span-line', style: 'stroke:var(--accent)' }, sg);
  el('line', { x1: X(21), x2: X(21), y1: sy - 6, y2: sy + 6, class: 'cf-span-end', style: 'stroke:var(--accent)' }, sg);
  el('path', { d: `M${W - R - 4},${sy - 5} l7,5 l-7,5`, class: 'gv-arrow', style: 'stroke:var(--accent)' }, sg);
  const t = el('text', { x: X(77), y: sy - 6, class: 'cf-span-text', 'text-anchor': 'middle' }, sg);
  const n = el('tspan', { class: 'cf-span-num' }, t); n.textContent = '70×';
  t.appendChild(document.createTextNode(' fewer NFEs at matched accuracy'));
})();
