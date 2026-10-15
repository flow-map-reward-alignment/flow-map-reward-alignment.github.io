/* WTF project page: reward vs. cumulative training compute, drawn from the paper's curves
   (assets/data/compute_curves.json). */
(function () {
  const fig = document.getElementById('computefig');
  if (!fig) return;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const W = 760, H = 400, L = 64, R = 24, T = 26, B = 52, SWEEP = 4200;
  const COLOR = { wtf: 'var(--accent)', am: 'var(--c-kl)', grpo: 'var(--cf-grpo)' };
  const NAME = { am: 'Adjoint Matching', grpo: 'Flow-GRPO' };

  fetch(fig.dataset.src).then(r => r.json()).then(D => {
    const xmax = D.xmax, ymin = D.ymin, ymax = D.ymax;
    const X = v => L + (v / xmax) * (W - L - R), Y = v => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cf-svg', role: 'img',
      'aria-label': 'HPSv2 reward against cumulative GPU-hours. WTF rises almost immediately; it reaches the peak reward of Adjoint Matching with 46.8 times less compute and that of Flow-GRPO with 280.4 times less.' });
    fig.querySelector('.cf-stage').appendChild(svg);
    const defs = el('defs', {}, svg);
    const clip = el('clipPath', { id: 'cf-clip' }, defs);
    const clipRect = el('rect', { x: 0, y: 0, width: L, height: H }, clip);

    // grid + axes
    for (const v of [0.28, 0.32, 0.36, 0.40]) {
      el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'cf-grid' }, svg);
      el('text', { x: L - 10, y: Y(v) + 4, class: 'cf-tick', 'text-anchor': 'end' }, svg).textContent = v.toFixed(2);
    }
    el('line', { x1: L, x2: W - R, y1: Y(ymin), y2: Y(ymin), class: 'cf-axis' }, svg);
    for (const v of [0, 50, 100, 150, 200]) {
      el('text', { x: X(v), y: Y(ymin) + 20, class: 'cf-tick', 'text-anchor': 'middle' }, svg).textContent = v;
    }
    el('text', { x: (L + W - R) / 2, y: H - 8, class: 'cf-axlabel', 'text-anchor': 'middle' }, svg).textContent = 'cumulative training compute (GPU-hours)';
    el('text', { x: 16, y: (T + Y(ymin)) / 2, class: 'cf-axlabel', 'text-anchor': 'middle',
      transform: `rotate(-90 16 ${(T + Y(ymin)) / 2})` }, svg).textContent = 'HPSv2 reward';

    // curves (bands under lines), revealed through the sweeping clip
    const g = el('g', { 'clip-path': 'url(#cf-clip)' }, svg);
    const order = ['grpo', 'am', 'wtf'];
    const S = Object.fromEntries(D.series.map(s => [s.key, s]));
    for (const k of order) {
      const p = S[k].pts;
      const up = p.map(([x, h, e]) => `${X(x).toFixed(1)},${Y(h + e).toFixed(1)}`).join(' ');
      const dn = p.slice().reverse().map(([x, h, e]) => `${X(x).toFixed(1)},${Y(h - e).toFixed(1)}`).join(' ');
      el('polygon', { points: `${up} ${dn}`, class: 'cf-band', style: `fill:${COLOR[k]}` }, g);
    }
    for (const k of order) {
      el('polyline', { points: S[k].pts.map(([x, h]) => `${X(x).toFixed(1)},${Y(h).toFixed(1)}`).join(' '),
        class: 'cf-line' + (k === 'wtf' ? ' ours' : ''), style: `stroke:${COLOR[k]}` }, g);
    }
    // end labels
    const lab = (k, x, y, anchor) => el('text', { x, y, class: 'cf-label' + (k === 'wtf' ? ' ours' : ''), 'text-anchor': anchor, style: `fill:${COLOR[k]}` }, g);
    const wEnd = S.wtf.pts[S.wtf.pts.length - 1], aEnd = S.am.pts[S.am.pts.length - 1], gEnd = S.grpo.pts[S.grpo.pts.length - 1];
    lab('wtf', X(wEnd[0]) + 8, Y(wEnd[1]) + 4, 'start').textContent = 'WTF (ours)';
    lab('am', X(aEnd[0]) - 4, Y(aEnd[1]) + 22, 'end').textContent = 'Adjoint Matching';
    lab('grpo', X(gEnd[0]) - 4, Y(gEnd[1]) + 22, 'end').textContent = 'Flow-GRPO';

    // compute spans: from where WTF first reaches a baseline's peak to where the baseline does
    const spans = D.spans.map(s => {
      const sg = el('g', { class: 'cf-span' }, svg);
      const y = Y(s.y);
      el('line', { x1: X(s.x0), x2: X(s.x1), y1: y, y2: y, class: 'cf-span-line', style: `stroke:${COLOR[s.key]}` }, sg);
      for (const xe of [s.x0, s.x1]) el('line', { x1: X(xe), x2: X(xe), y1: y - 6, y2: y + 6, class: 'cf-span-end', style: `stroke:${COLOR[s.key]}` }, sg);
      // label sits right of the WTF curve (which occupies the left of the plot), centred on the rest of the span
      const lx = (Math.max(X(s.x0), X(wEnd[0]) + 150) + X(s.x1)) / 2;
      const t = el('text', { x: lx, y: y - 9, class: 'cf-span-text', 'text-anchor': 'middle' }, sg);
      const n = el('tspan', { class: 'cf-span-num' }, t); n.textContent = `${Math.round(s.ratio)}×`;
      t.appendChild(document.createTextNode(` less compute to reach ${NAME[s.key]}'s peak`));
      return { g: sg, x1: s.x1 };
    });

    // cursor
    const cur = el('g', { class: 'cf-cursor' }, svg);
    const cl = el('line', { y1: T, y2: Y(ymin), class: 'cf-cursor-line' }, cur);
    const ct = el('text', { y: T - 8, class: 'cf-cursor-text', 'text-anchor': 'middle' }, cur);

    const render = (f) => {                       // f in [0,1]: fraction of the sweep
      const u = Math.pow(f, 1.9);                      // ease-in: linger on the first GPU-hours, where WTF climbs
      const xv = u * xmax, xp = X(xv);
      clipRect.setAttribute('width', xp + 10);
      cur.style.opacity = f > 0 && f < 1 ? 1 : 0;
      cl.setAttribute('x1', xp); cl.setAttribute('x2', xp);
      ct.setAttribute('x', Math.min(xp, W - R - 30)); ct.textContent = `${Math.round(xv)} GPU-h`;
      spans.forEach(s => s.g.classList.toggle('on', xv >= s.x1));
    };

    render(1);                                    // static
  });
})();
