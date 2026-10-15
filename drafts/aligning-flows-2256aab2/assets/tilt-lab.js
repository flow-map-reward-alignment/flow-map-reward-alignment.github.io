/* ============================================================
   Tilt Lab: Wasserstein tilt vs. KL reward tilt in 1-D.
   A direct port of the paper's synthetic experiment:
     base       rho_0 = rho_1 = N(0, 1)
     reward     r_K(y) = exp(-(y-K)^2 / (2 w^2)),  w = 2.25
     KL tilt    rho_1(y) e^{lam r(y)} / Z           (exact quadrature)
     WTF        y*(x) = argmax_y { lam r(y) - (y-x)^2 / (2 tau) },  tau = pi/2
                pushed forward in closed form: rho(y) = phi(x(y)) |dx/dy|
   Every curve is exact, not sampled.
   ============================================================ */
(function () {
  'use strict';
  const W = 2.25, TAU = Math.PI / 2;
  const phi = x => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const bump = (y, a) => Math.exp(-0.5 * ((y - a) / W) ** 2);

  function trapz(y, x) {
    let s = 0;
    for (let i = 1; i < x.length; i++) s += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1]);
    return s;
  }
  function linspace(a, b, n) {
    const out = new Float64Array(n), h = (b - a) / (n - 1);
    for (let i = 0; i < n; i++) out[i] = a + i * h;
    return out;
  }
  // linear interpolation of yv(xv) at q, xv strictly increasing
  function interp(q, xv, yv) {
    let lo = 0, hi = xv.length - 1;
    if (q <= xv[lo]) return yv[lo];
    if (q >= xv[hi]) return yv[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xv[m] <= q) lo = m; else hi = m; }
    const t = (q - xv[lo]) / (xv[hi] - xv[lo]);
    return yv[lo] + t * (yv[hi] - yv[lo]);
  }

  /* KL tilt density on grid g, and its expected reward */
  function klTilt(a, lam, g) {
    const n = g.length, d = new Float64Array(n);
    let mx = -Infinity;
    const lw = new Float64Array(n);
    for (let i = 0; i < n; i++) { lw[i] = lam * bump(g[i], a) + Math.log(phi(g[i]) + 1e-300); if (lw[i] > mx) mx = lw[i]; }
    for (let i = 0; i < n; i++) d[i] = Math.exp(lw[i] - mx);
    const z = trapz(d, g);
    const rr = new Float64Array(n);
    for (let i = 0; i < n; i++) { d[i] /= z; rr[i] = d[i] * bump(g[i], a); }
    return { dens: d, er: trapz(rr, g) };
  }

  /* WTF optimum: exact pushforward of N(0,1) through x -> y*(x) */
  function wtf(a, lam, g, xq) {
    const n = g.length, k = TAU * lam / (W * W);
    const xo = new Float64Array(n), dx = new Float64Array(n), J = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const r = bump(g[i], a), u = (g[i] - a) / W;
      xo[i] = g[i] + k * (g[i] - a) * r;            // source x whose stationary point is y = g[i]
      dx[i] = 1 + k * (1 - u * u) * r;              // dx/dy
      J[i] = lam * r - (g[i] - xo[i]) ** 2 / (2 * TAU);
    }
    // monotone branches (dx > 0) of the inverse map y -> x
    const segs = [];
    let s0 = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || Math.sign(dx[i]) !== Math.sign(dx[i - 1])) {
        if (i - s0 >= 3 && dx[(s0 + i) >> 1] > 0) segs.push([s0, i]);
        s0 = i;
      }
    }
    // for each source x, keep the branch with the highest objective
    const m = xq.length, best = new Float64Array(m).fill(-Infinity), ys = new Float64Array(m);
    for (const [lo, hi] of segs) {
      const xs = xo.subarray(lo, hi), yy = g.subarray(lo, hi);
      const x0 = xs[0], x1 = xs[xs.length - 1];
      for (let j = 0; j < m; j++) {
        const x = xq[j];
        if (x < x0 || x > x1) continue;
        const yb = interp(x, xs, yy);
        const jb = lam * bump(yb, a) - (yb - x) ** 2 / (2 * TAU);
        if (jb > best[j]) { best[j] = jb; ys[j] = yb; }
      }
    }
    // density: on each branch, keep points that are the global optimum for their source
    const tol = 1e-6 * Math.max(1, lam), rho = new Float64Array(n).fill(NaN);
    for (const [lo, hi] of segs) {
      for (let i = lo; i < hi; i++) {
        const ok = segs.length === 1 || J[i] >= interp(xo[i], xq, best) - tol;
        if (ok) rho[i] = phi(xo[i]) * Math.abs(dx[i]);
      }
    }
    const pr = new Float64Array(m);
    for (let j = 0; j < m; j++) pr[j] = phi(xq[j]) * bump(ys[j], a);
    return { dens: rho, er: trapz(pr, xq) };
  }

  function baseReward(a, g) {
    const v = new Float64Array(g.length);
    for (let i = 0; i < g.length; i++) v[i] = phi(g[i]) * bump(g[i], a);
    return trapz(v, g);
  }

  function solve(K, lam) {
    const g = linspace(-9, K + 11, 9000);
    const xq = linspace(-8, 8, 3000);
    const kl = klTilt(K, lam, g), wt = wtf(K, lam, g, xq);
    return { g, kl, wt, base: baseReward(K, g) };
  }

  // exposed for verification against the paper's synthetic experiment
  window.WTFTiltLab = { solve };

  /* ---------------- drawing ---------------- */
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; }

  function mount(root) {
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const kIn = root.querySelector('#lab-k'), lIn = root.querySelector('#lab-lam');
    const kOut = root.querySelector('#lab-k-out'), lOut = root.querySelector('#lab-lam-out');
    const outBase = root.querySelector('#er-base'), outKl = root.querySelector('#er-kl'), outWtf = root.querySelector('#er-wtf');
    const gainKl = root.querySelector('#gain-kl'), gainWtf = root.querySelector('#gain-wtf');
    const XL = -3.6, XR = 9.6;
    let raf = 0, envTimer = 0;
    const yEnvelope = new Map();
    function peak(g, kl, wt) {
      let m = 0.45;
      for (let i = 0; i < g.length; i++) {
        if (g[i] < XL || g[i] > XR) continue;
        if (kl.dens[i] > m) m = kl.dens[i];
        if (wt.dens[i] > m) m = wt.dens[i];
      }
      return m;
    }
    function computeEnvelope(lam) {
      if (yEnvelope.has(lam)) return;
      const kMin = +kIn.min, kMax = +kIn.max;
      let m = 0;
      for (let j = 0; j <= 26; j++) {
        const { g, kl, wt } = solve(kMin + (kMax - kMin) * j / 26, lam);
        m = Math.max(m, peak(g, kl, wt));
      }
      yEnvelope.set(lam, Math.min(Math.ceil(m * 1.04 * 10) / 10, 3.2));   // round up to 0.1
    }

    function draw() {
      raf = 0;
      const K = +kIn.value, lam = +lIn.value;
      kOut.textContent = K.toFixed(2);
      lOut.textContent = lam.toFixed(1);
      const { g, kl, wt, base } = solve(K, lam);

      const dpr = window.devicePixelRatio || 1;
      const Wd = canvas.clientWidth, Hd = canvas.clientHeight;
      canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(Hd * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, Wd, Hd);

      const padL = 46, padR = 16, padT = 14, padB = 34;
      const pw = Wd - padL - padR, ph = Hd - padT - padB;

      // y-range: fixed per lambda (the envelope over every K on the slider), so the axis and grid
      // stay still while K moves; until that envelope is computed, fall back to this frame's peak.
      let ymax = yEnvelope.get(lam);
      if (ymax === undefined) {
        ymax = Math.min(peak(g, kl, wt) * 1.08, 3.2);
        clearTimeout(envTimer);
        envTimer = setTimeout(() => { computeEnvelope(lam); schedule(); }, 180);
      }
      const X = x => padL + (x - XL) / (XR - XL) * pw;
      const Y = y => padT + ph - (y / ymax) * ph;

      // grid + axes
      const ink = css('--ink-faint'), line = css('--line');
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.font = '12px Inter, system-ui, sans-serif'; ctx.fillStyle = ink;
      for (let x = Math.ceil(XL); x <= XR; x++) {
        if (x % 2) continue;
        ctx.beginPath(); ctx.moveTo(X(x), padT); ctx.lineTo(X(x), padT + ph); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillText(String(x), X(x), padT + ph + 18);
      }
      const ystep = ymax > 1.6 ? 0.5 : (ymax > 0.8 ? 0.25 : 0.1);
      for (let y = 0; y <= ymax + 1e-9; y += ystep) {
        ctx.beginPath(); ctx.moveTo(padL, Y(y)); ctx.lineTo(padL + pw, Y(y)); ctx.stroke();
        ctx.textAlign = 'right'; ctx.fillText(y.toFixed(ystep < 0.25 ? 1 : 2), padL - 8, Y(y) + 4);
      }
      ctx.textAlign = 'center'; ctx.fillText('x', padL + pw / 2, Hd - 2);

      function curve(fn, color, width, dash, fill) {
        ctx.save();
        ctx.beginPath(); let on = false;
        for (let px = 0; px <= pw; px++) {
          const x = XL + px / pw * (XR - XL);
          const y = fn(x);
          if (!isFinite(y)) { on = false; continue; }
          const cx = padL + px, cy = Y(Math.min(y, ymax));
          if (!on) { ctx.moveTo(cx, cy); on = true; } else ctx.lineTo(cx, cy);
        }
        if (fill) {
          ctx.lineTo(padL + pw, Y(0)); ctx.lineTo(padL, Y(0)); ctx.closePath();
          ctx.fillStyle = fill; ctx.fill();
        } else {
          ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
          if (dash) ctx.setLineDash(dash);
          ctx.stroke();
        }
        ctx.restore();
      }
      const at = (arr) => (x) => {
        const i = Math.round((x - g[0]) / (g[g.length - 1] - g[0]) * (g.length - 1));
        return arr[Math.max(0, Math.min(g.length - 1, i))];
      };
      const rScale = 0.32 * Math.max(1, ymax / 0.7);
      const rew = x => bump(x, K) * rScale;
      curve(rew, null, 0, null, css('--c-rew') + '22');
      curve(rew, css('--c-rew'), 1.6, [6, 4]);
      curve(phi, css('--c-base'), 2.2);
      curve(at(kl.dens), css('--c-kl'), 2.6);
      curve(at(wt.dens), css('--c-wtf'), 2.8);

      outBase.textContent = base.toFixed(3);
      outKl.textContent = kl.er.toFixed(3);
      outWtf.textContent = wt.er.toFixed(3);
      gainKl.textContent = `+${(kl.er - base).toFixed(3)} over base`;
      gainWtf.textContent = `+${(wt.er - base).toFixed(3)} over base · ${(wt.er / Math.max(kl.er, 1e-9)).toFixed(2)}× KL`;
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
    kIn.addEventListener('input', schedule);
    lIn.addEventListener('input', schedule);
    window.addEventListener('resize', schedule);
    root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      const [k, l] = b.dataset.preset.split(',').map(Number);
      kIn.value = k; lIn.value = l; schedule();
    }));
    document.addEventListener('themechange', schedule);
    schedule();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('tilt-lab');
    if (root) mount(root);
  });
})();
