/* =====================================================================
   Section 10.2 — Real-Time Scheduling
   What makes a system real-time, the five requirements of a real-time OS,
   preemption latency, the four classes of real-time schedulers, deadline
   scheduling (periodic and aperiodic), rate monotonic scheduling and its
   utilization bound, and priority inversion with its two cures.
   Every timeline, verdict and caption comes from the engine below, so the
   words on screen always match the simulation.
   ===================================================================== */
(() => {
  /* ENGINE-BEGIN ------------------------------------------------------
     Pure scheduling code (no DOM). dev/qa-10.2/engine.test.cjs extracts
     this block and checks the worked examples against it.             */
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const hyperperiod = (ts) => ts.reduce((m, t) => lcm(m, t.T), 1);
  const utilization = (ts) => ts.reduce((u, t) => u + t.C / t.T, 0);
  const rmsBound = (n) => n * (2 ** (1 / n) - 1);
  const lessKey = (a, b) => { for (let k = 0; k < a.length; k++) { if (a[k] < b[k]) return true; if (a[k] > b[k]) return false; } return false; };

  /* periodic(ts, pol, H): one processor, preemptive, unit time steps over [0, H).
     ts: [{C, T}]; task i releases a job at 0, T, 2T, ... and each job's deadline is the next release.
     pol: {kind:'fixed', order:[task indexes, highest priority first]} or {kind:'edf'}.
     EDF ties go to the job already running, then to the lower task index.
     A job still unfinished at its deadline is counted as missed and dropped (its result would be too late). */
  function periodic(ts, pol, H) {
    const jobs = [], segs = [], live = [];
    let run = null;
    const key = (j) => (pol.kind === 'edf' ? [j.dl, j === run ? 0 : 1, j.i] : [pol.order.indexOf(j.i), j.rel]);
    for (let t = 0; t <= H; t++) {
      for (const j of live.slice()) if (j.dl === t) { j.missed = true; j.end = t; live.splice(live.indexOf(j), 1); if (run === j) run = null; }
      if (t === H) break;
      ts.forEach((tk, i) => { if (t % tk.T === 0) { const j = { i, k: t / tk.T + 1, rel: t, dl: t + tk.T, C: tk.C, left: tk.C, fin: null, missed: false }; jobs.push(j); live.push(j); } });
      let pick = null;
      for (const j of live) if (!pick || lessKey(key(j), key(pick))) pick = j;
      run = pick;
      if (!run) continue;
      run.left--;
      const last = segs[segs.length - 1];
      if (last && last.i === run.i && last.k === run.k && last.b === t) last.b = t + 1; else segs.push({ i: run.i, k: run.k, a: t, b: t + 1 });
      if (run.left === 0) { run.fin = t + 1; live.splice(live.indexOf(run), 1); run = null; }
    }
    for (const j of jobs) j.status = j.fin != null ? 'met' : j.missed ? 'missed' : 'open';
    return { jobs, segs, H, missed: jobs.filter((j) => j.missed).sort((a, b) => a.dl - b.dl || a.i - b.i) };
  }

  /* aperiodic(ts, pol): one processor, nonpreemptive (a started task runs to completion).
     ts: [{arr, sd, C}] with arrival, starting deadline and processing time.
     pol: 'ed'   = earliest starting deadline among the tasks that have arrived;
          'edui' = earliest starting deadline among ALL tasks not yet run, even one that has not
                   arrived yet (the processor idles until it arrives: an unforced idle time);
          'fcfs' = earliest arrival among the tasks that have arrived.
     A task that has not started by its starting deadline is missed and never runs. */
  function aperiodic(ts, pol) {
    const st = ts.map(() => ({ start: null, fin: null, missed: false }));
    const ev = [], segs = [];
    let t = 0;
    const open = () => ts.map((_, i) => i).filter((i) => st[i].start == null && !st[i].missed);
    const best = (list, f) => list.reduce((b, i) => (b == null || lessKey(f(i), f(b)) ? i : b), null);
    for (let guard = 0; guard < 4 * ts.length + 4; guard++) {
      for (const i of open()) if (ts[i].sd < t) { st[i].missed = true; ev.push({ t: ts[i].sd, k: 'miss', i }); }
      const cand = open();
      if (!cand.length) break;
      const ready = cand.filter((i) => ts[i].arr <= t);
      /* nothing has arrived: a forced idle under every policy (only idling while a task waits is unforced) */
      if (!ready.length) { const nt = Math.min(...cand.map((i) => ts[i].arr)); ev.push({ t, k: 'idle', until: nt }); t = nt; continue; }
      let pick;
      if (pol === 'edui') pick = best(cand, (i) => [ts[i].sd, ts[i].arr, i]);
      else pick = pol === 'ed' ? best(ready, (i) => [ts[i].sd, ts[i].arr, i]) : best(ready, (i) => [ts[i].arr, i]);
      if (ts[pick].arr > t) { ev.push({ t, k: 'hold', i: pick, until: ts[pick].arr, ready: ready.slice() }); t = ts[pick].arr; }
      const pool = cand.filter((i) => ts[i].arr <= t);
      st[pick].start = t; st[pick].fin = t + ts[pick].C;
      ev.push({ t, k: 'start', i: pick, pool });
      segs.push({ i: pick, a: t, b: t + ts[pick].C });
      t += ts[pick].C;
      ev.push({ t, k: 'done', i: pick });
    }
    ev.sort((a, b) => a.t - b.t);
    return { st, ev, segs, T: t, missed: ts.map((_, i) => i).filter((i) => st[i].missed) };
  }

  /* latency(r): when a real-time request that arrives at time r (ms) first gets the processor
     under four kinds of scheduler. Background: round robin over 9 ordinary processes with a 100 ms
     quantum; the three priority kernels run two long low-priority bursts (0-750 and 750-1950). */
  const LAT = { q: 100, nRR: 9, bursts: [[0, 750], [750, 1950]], pp: 10, imm: 0.1, need: 30 };
  function latency(r) {
    const rr = (Math.floor(r / LAT.q) + 1) * LAT.q + (LAT.nRR - 1) * LAT.q;
    const burst = LAT.bursts.find(([a, b]) => r >= a && r < b) || LAT.bursts[LAT.bursts.length - 1];
    const np = Math.max(r, burst[1]);
    const pp = (Math.floor(r / LAT.pp) + 1) * LAT.pp;
    const im = r + LAT.imm;
    return [rr, np, pp, im].map((s) => ({ start: s, wait: s - r }));
  }

  /* inversion(proto, M): three tasks on one processor share lock R.
     T1 high (priority 3), T2 medium (2), T3 low (1); a larger number means a higher priority.
     T2 never touches R and needs M units. proto: 'none' | 'inherit' | 'ceiling'.
     With the ceiling protocol R's ceiling is 4, one level above its highest user T1.
     Returns one frame per time unit: who runs during [t, t+1), at what priority, who holds R. */
  const INV = [
    { name: 'T1', prio: 3, arr: 2, script: [['run', 1], ['lock'], ['run', 2], ['unlock'], ['run', 1]] },
    { name: 'T2', prio: 2, arr: 3, script: [['run', 0]] },
    { name: 'T3', prio: 1, arr: 0, script: [['run', 1], ['lock'], ['run', 4], ['unlock'], ['run', 1]] },
  ];
  const CEIL = 4;
  function inversion(proto, M) {
    const P = INV.map((d) => ({ ...d, script: d.script.map((op) => (op[0] === 'run' && op[1] === 0 ? ['run', M] : op.slice())), pc: 0, left: null, eff: d.prio, blocked: false, fin: null, cs: false }));
    P.forEach((p) => { p.left = p.script[0][1]; });
    let holder = null;
    const frames = [], segs = [];
    const limit = P.reduce((a, p) => a + p.script.reduce((x, op) => x + (op[0] === 'run' ? op[1] : 0), 0), 0) + 10;
    for (let t = 0; t < limit; t++) {
      const ev = [];
      P.forEach((p, i) => { if (p.arr === t) ev.push({ k: 'arr', i }); });
      let run = null;
      for (let guard = 0; guard < 20; guard++) {
        const ready = P.filter((p) => p.arr <= t && p.fin == null && !p.blocked);
        if (!ready.length) { run = null; break; }
        run = ready.reduce((b, p) => (p.eff > b.eff ? p : b), ready[0]);
        const op = run.script[run.pc];
        if (op[0] === 'lock') {
          if (holder == null) {
            holder = run; run.cs = true; run.pc++; run.left = run.script[run.pc][1];
            if (proto === 'ceiling') { run.eff = Math.max(run.eff, CEIL); ev.push({ k: 'lockc', i: P.indexOf(run) }); } else ev.push({ k: 'lock', i: P.indexOf(run) });
            continue;
          }
          run.blocked = true;
          ev.push({ k: 'block', i: P.indexOf(run), by: P.indexOf(holder) });
          if (proto === 'inherit' && run.eff > holder.eff) { holder.eff = run.eff; ev.push({ k: 'inherit', i: P.indexOf(holder), to: run.eff }); }
          continue;
        }
        if (op[0] === 'unlock') {
          const was = run.eff;
          holder = null; run.cs = false; run.eff = run.prio; run.pc++; run.left = run.script[run.pc][1];
          ev.push({ k: 'unlock', i: P.indexOf(run), drop: was !== run.prio ? was : null });
          P.forEach((p) => { if (p.blocked) { p.blocked = false; ev.push({ k: 'wake', i: P.indexOf(p) }); } });
          continue;
        }
        break;
      }
      const done = P.every((p) => p.fin != null);
      frames.push({ t, run: run ? P.indexOf(run) : -1, eff: run ? run.eff : null, holder: holder ? P.indexOf(holder) : -1, blocked: P.map((p) => p.blocked), ev, effs: P.map((p) => p.eff) });
      if (done) break;
      if (!run) continue;
      run.left--;
      const i = P.indexOf(run), last = segs[segs.length - 1];
      if (last && last.i === i && last.b === t && last.eff === run.eff && last.cs === run.cs) last.b = t + 1; else segs.push({ i, a: t, b: t + 1, eff: run.eff, cs: run.cs });
      if (run.left === 0) {
        run.pc++;
        if (run.pc >= run.script.length) { run.fin = t + 1; frames[frames.length - 1].fin = i; } else if (run.script[run.pc][0] === 'run') run.left = run.script[run.pc][1];
      }
    }
    const blockedSpans = [];
    frames.forEach((f) => f.blocked.forEach((b, i) => { if (!b) return; const last = blockedSpans[blockedSpans.length - 1]; if (last && last.i === i && last.b === f.t) last.b = f.t + 1; else blockedSpans.push({ i, a: f.t, b: f.t + 1 }); }));
    return { frames, segs, fin: P.map((p) => p.fin), T: frames[frames.length - 1].t, blockedSpans, resp: P.map((p) => p.fin - p.arr) };
  }
  /* ENGINE-END -------------------------------------------------------- */

  const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
  const f3 = (x) => (Math.round(x * 1000) / 1000).toFixed(3);
  const f4 = (x) => (Math.round(x * 10000) / 10000).toFixed(4);
  const TN = 'ABCDEFGH';

  /* periodicSvg(ctx, ts, res, o): one lane per periodic task over [0, o.T]: arrival triangles,
     run bars labelled with the job (A1, A2 ...), and at every deadline a green ✓ or a red ✗,
     all read from res, the result of periodic(). */
  function periodicSvg(ctx, ts, res, o) {
    const { s } = ctx;
    const W = o.W, T = o.T, LW = o.labelW || 26, rh = o.rowH || 20, pitch = rh + 16, top = 10, ax = o.axis !== false;
    const name = o.name || ((i) => TN[i]);
    const H = top + ts.length * pitch + (ax ? 12 : 0);
    const x0 = LW, x1 = W - 10, X = (t) => x0 + (Math.min(Math.max(t, 0), T) / T) * (x1 - x0);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': o.aria || 'Timeline of periodic tasks' });
    const per = (x1 - x0) / T, step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((k) => k * per >= (o.minTick || 34)) || 1000;
    for (let t = 0; t <= T + 1e-9; t += step) { svg.append(s('line', { x1: X(t), x2: X(t), y1: 2, y2: H - (ax ? 14 : 2), class: 'gl' })); if (ax) svg.append(s('text', { x: X(t), y: H - 2, class: 'ax', 'text-anchor': t === 0 ? 'start' : 'middle' }, String(t))); }
    ts.forEach((tk, i) => {
      const y = top + i * pitch;
      svg.append(s('text', { x: 0, y: y + rh / 2 + 5, class: 'lbl' }, name(i)));
      for (let t = 0; t < T; t += tk.T) svg.append(s('path', { d: `M${X(t) - 4},${y - 7} L${X(t) + 4},${y - 7} L${X(t)},${y - 1} Z`, class: 'arrm' }));
      res.segs.filter((g) => g.i === i && g.a < T).forEach((g) => {
        const xa = X(g.a), xb = X(Math.min(g.b, T));
        svg.append(s('rect', { x: xa, y, width: Math.max(1, xb - xa), height: rh, rx: 3, class: (o.cls ? o.cls(i) : 'pc' + (i % 6)), 'stroke-width': 1.3 }));
        const lab = name(i) + g.k;
        if (xb - xa >= lab.length * 8 + 2) svg.append(s('text', { x: (xa + xb) / 2, y: y + rh / 2 + 1, class: 'bl' }, lab));
      });
      res.jobs.filter((j) => j.i === i && j.dl <= T && j.dl > 0).forEach((j) => {
        if (j.status === 'missed') svg.append(s('line', { x1: X(j.dl), x2: X(j.dl), y1: y - 2, y2: y + rh + 3, class: 'dl' }), s('text', { x: X(j.dl), y: y + rh + 15, class: 'mx' }, '✗'));
        else svg.append(s('text', { x: X(j.dl) - (j.dl === T ? 5 : 0), y: y + rh + 14, class: 'mv' }, '✓'));
      });
    });
    return svg;
  }

  Guide.section({
    id: '10.2',
    title: 'Real-Time Scheduling',
    short: 'Real-time scheduling',
    summary: 'Hard and soft deadlines, what a real-time OS must promise, deadline and rate monotonic scheduling.',
    objectives: [
      'Explain what makes computing real-time and classify tasks as hard or soft, periodic or aperiodic.',
      'Describe the five requirements of a real-time OS and why immediate preemption cuts the wait for the processor.',
      'Name the four classes of real-time scheduling algorithms and schedule periodic and aperiodic tasks by earliest deadline.',
      'Apply rate monotonic scheduling and its utilization bound to decide whether a set of periodic tasks is safe.',
      'Explain priority inversion and how priority inheritance and priority ceilings keep it bounded.',
    ],
    terms: [
      ['Real-time computing', 'Computing in which a result counts as correct only if it is both logically right and produced in time. A right answer delivered too late can be a failure.'],
      ['Hard real-time task', 'A task that must meet its deadline: finishing late can cause unacceptable damage or a fatal error in the system, so a late result is worthless or harmful.'],
      ['Soft real-time task', 'A task with a deadline that is desirable but not essential: a late result is worth less, yet it still makes sense to finish it.'],
      ['Periodic task', 'A real-time task that repeats at a regular interval, its period T: once in every period, or exactly T time units apart.'],
      ['Aperiodic task', 'A real-time task that arrives at unpredictable times but still has a deadline to start, to finish, or both.'],
      ['Deadline', 'The time by which a real-time task must start (a starting deadline) or must finish (a completion deadline).'],
      ['Determinism', 'How predictably an OS performs its operations at fixed, known times or within known intervals. For interrupts: the worst-case delay before the OS acknowledges one.'],
      ['Responsiveness', 'How long an OS takes, once it has acknowledged an interrupt, to service it: starting the handler, running it, and any delay from nested interrupts.'],
      ['Fail-soft operation', 'Failing in a way that keeps as much capability and data as possible instead of crashing outright. Its timing side is stability: if not every deadline can be met, the most critical tasks still meet theirs.'],
      ['Preemption point', 'A place in the kernel, reached at regular intervals, where it checks whether a higher-priority task is waiting and, if one is, switches to it.'],
      ['Static table-driven scheduling', 'Real-time scheduling in which analysis done before the system runs produces a fixed timetable saying when each periodic task starts. Predictable but inflexible: any change means rebuilding the table.'],
      ['Static priority-driven preemptive scheduling', 'Real-time scheduling in which analysis done before the system runs gives each task a fixed priority, and an ordinary preemptive priority scheduler then runs the tasks. Rate monotonic scheduling is the standard example.'],
      ['Dynamic planning-based scheduling', 'Real-time scheduling that checks feasibility at run time: an arriving task is accepted only if a plan exists that meets its deadline and the deadlines of every task already accepted.'],
      ['Dynamic best effort scheduling', 'Real-time scheduling with no feasibility check: the system tries to meet every deadline, often with deadline-based priorities, and aborts a task whose deadline has passed. Common for aperiodic tasks.'],
      ['Earliest deadline first (EDF)', 'A deadline scheduling policy that always runs the ready task whose deadline is nearest. For independent tasks that can be preempted on one processor, it meets every deadline whenever any schedule could.'],
      ['Rate monotonic scheduling (RMS)', 'A fixed-priority policy for periodic tasks: the shorter a task’s period (the higher its rate), the higher its priority.'],
      ['Utilization bound', 'For rate monotonic scheduling of n periodic tasks, the value n(2^(1/n) − 1). If the total utilization ΣC/T is at or below it, every deadline is guaranteed. It falls from 1 toward ln 2 ≈ 0.693 as n grows.'],
      ['Priority inversion', 'A higher-priority task is forced to wait for a lower-priority one, usually because the lower task holds a lock it needs. It becomes unbounded when medium-priority tasks keep preempting the lock holder.'],
      ['Priority inheritance', 'A cure for priority inversion: while a task holds a lock that a higher-priority task is waiting for, it runs at that waiting task’s priority, and it drops back when it releases the lock.'],
      ['Priority ceiling', 'A cure for priority inversion: each shared resource gets a priority one level above its highest-priority user, and any task that takes the resource runs at that ceiling until it releases it.'],
    ],

    css: `
      .sec-10-2 svg { display: block; }
      .sec-10-2 svg .pc0 { fill: color-mix(in srgb, var(--cpu) 30%, var(--panel)); stroke: var(--cpu); }
      .sec-10-2 svg .pc1 { fill: color-mix(in srgb, var(--mem) 30%, var(--panel)); stroke: var(--mem); }
      .sec-10-2 svg .pc2 { fill: color-mix(in srgb, var(--io) 30%, var(--panel)); stroke: var(--io); }
      .sec-10-2 svg .pc3 { fill: color-mix(in srgb, var(--os) 30%, var(--panel)); stroke: var(--os); }
      .sec-10-2 svg .pc4 { fill: color-mix(in srgb, var(--thread) 30%, var(--panel)); stroke: var(--thread); }
      .sec-10-2 svg .pc5 { fill: color-mix(in srgb, var(--proc) 30%, var(--panel)); stroke: var(--proc); }
      .sec-10-2 svg .pcg { fill: var(--panel-3); stroke: var(--line-2); }
      .sec-10-2 svg .pcrt { fill: var(--intr); stroke: var(--intr); }
      .sec-10-2 svg .wait { fill: none; stroke: var(--line-2); stroke-width: 1.5; stroke-dasharray: 3 3; }
      .sec-10-2 svg .blk { fill: color-mix(in srgb, var(--bad) 12%, transparent); stroke: var(--bad); stroke-width: 1.5; stroke-dasharray: 4 3; }
      .sec-10-2 svg .gl { stroke: var(--line); stroke-width: 1; }
      .sec-10-2 svg .ax { font-size: 12.5px; fill: var(--muted); }
      .sec-10-2 svg .lbl { font-size: 14px; font-weight: 800; }
      .sec-10-2 svg .bl { font-size: 13px; font-weight: 800; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
      .sec-10-2 svg .cur { stroke: var(--accent); stroke-width: 2.5; }
      .sec-10-2 svg .arrm { fill: var(--ink-2); }
      .sec-10-2 svg .mx { font-size: 15px; font-weight: 800; text-anchor: middle; fill: var(--bad); }
      .sec-10-2 svg .mv { font-size: 13px; font-weight: 800; text-anchor: middle; fill: var(--ok); }
      .sec-10-2 svg .dl { stroke: var(--bad); stroke-width: 2; }
      .sec-10-2 svg .dlok { stroke: var(--ok); stroke-width: 2; }
      .sec-10-2 .msg { border-radius: 10px; padding: 8px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .sec-10-2 .msg.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-10-2 .msg.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-10-2 .msg.warn { border-color: var(--warn); background: var(--warn-bg); }
      .sec-10-2 .msg.info { border-color: var(--accent); background: var(--accent-bg); }
      .sec-10-2 .num { font-variant-numeric: tabular-nums; }
      .sec-10-2 .eq { font-family: var(--mono); font-size: 14.5px; background: var(--panel-3); border-radius: 8px; padding: 6px 10px; }
      .sec-10-2 table.tbl td.c, .sec-10-2 table.tbl th.c { text-align: center; }
      .sec-10-2 table.tbl td.r, .sec-10-2 table.tbl th.r { text-align: right; }
      .sec-10-2 table.tbl.bt th, .sec-10-2 table.tbl.bt td { padding: 4px 5px; font-size: 13.5px; }
      .sec-10-2 input.nin { width: 58px; height: 28px; font: inherit; font-size: 14.5px; text-align: center; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel); color: var(--ink); padding: 0 2px; }
    `,

    steps: [
      /* ---------------- 1. Big picture: when the answer arrives is part of the answer ---------------- */
      {
        title: 'Right answer, wrong time: what real-time means',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const W = ctx.narrow ? 360 : 560, LW = ctx.narrow ? 0 : 150, PH = 62, GAP = ctx.narrow ? 30 : 16;
          const rows = [
            { lab: 'Hard', ex: 'airbag inflates', cls: 'pc0', v: (f) => (f <= 1 ? 1 : -0.6) },
            { lab: 'Soft', ex: 'next video frame', cls: 'pc2', v: (f) => (f <= 1 ? 1 : 1 - 0.8 * (f - 1)) },
            { lab: 'No deadline', ex: 'nightly backup', cls: 'pc1', v: () => 1 },
          ];
          const top0 = ctx.narrow ? 20 : 6, H = top0 + rows.length * (PH + GAP) + 6;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Value of a result against the time it finishes, for a hard, a soft and a non-real-time task' });
          const x0 = LW + 8, x1 = W - 86, X = (f) => x0 + (f / 2) * (x1 - x0);
          const status = h('div', { class: 'msg info', style: { minHeight: '72px' } });
          let f = 0.8;
          function draw() {
            svg.replaceChildren();
            rows.forEach((r, k) => {
              const top = top0 + k * (PH + GAP), Y = (v) => top + 8 + (1 - v) * ((PH - 16) / 1.6);
              const y0 = Y(0);
              if (ctx.narrow) svg.append(s('text', { x: 0, y: top - 5, class: 'lbl' }, `${r.lab}: ${r.ex}`));
              else svg.append(s('text', { x: 0, y: top + 24, class: 'lbl' }, r.lab), s('text', { x: 0, y: top + 42, class: 'ax' }, r.ex));
              svg.append(s('line', { x1: x0, x2: x1, y1: y0, y2: y0, class: 'gl' }));
              svg.append(s('line', { x1: X(1), x2: X(1), y1: top, y2: top + PH, class: 'dl', 'stroke-dasharray': '4 3' }));
              const pts = [];
              for (let q = 0; q <= 200; q++) { const ff = q / 100; pts.push(`${X(ff).toFixed(1)},${Y(r.v(ff)).toFixed(1)}`); }
              svg.append(s('polyline', { points: pts.join(' '), style: 'fill:none', class: r.cls, 'stroke-width': 3 }));
              const v = r.v(f), cx = X(f), cy = Y(v);
              svg.append(s('circle', { cx, cy, r: 6, class: v >= 0.999 ? 's-ok' : v < 0 ? 's-bad' : 's-warn', 'stroke-width': 2.5 }));
              const word = v >= 0.999 ? 'full value' : v < 0 ? 'harmful' : `worth ${Math.round(v * 100)}%`;
              svg.append(s('text', { x: x1 + 8, y: cy + 5, style: `font-size:13px;font-weight:800;fill:var(${v >= 0.999 ? '--ok' : v < 0 ? '--bad' : '--warn'})` }, word));
              if (k === 0) svg.append(s('text', { x: X(1) + 4, y: top + 11, class: 'ax' }, 'deadline'));
            });
            const late = Math.round((f - 1) * 100);
            if (f <= 1) say('ok', 'In time', `The results finish at ${Math.round(f * 100)}% of the time allowed. All three are worth their full value: being early earns no bonus, it only has to be in time.`);
            else say('bad', `${late}% late`, 'The airbag result is now <b>harmful</b>: a bag that inflates after the head has hit the wheel does no good and may do harm (hard). The late video frame is a <b>stutter</b>: annoying, but the film plays on (soft). The backup has no deadline, so nothing changes.');
          }
          function say(kind, head, html) { status.className = 'msg ' + kind; status.innerHTML = `<b>${head}.</b> ${html}`; }
          const slider = ctx.ui.slider({ label: 'Result finishes at', min: 0.2, max: 2, step: 0.05, value: f, format: (v) => `${Math.round(v * 100)}% of the deadline`, onInput: (v) => { f = v; draw(); } });
          draw();
          const strip = s('svg', { viewBox: '0 0 440 76', width: '100%', role: 'img', 'aria-label': 'Periodic arrivals evenly spaced, aperiodic arrivals at irregular times' });
          strip.append(s('text', { x: 0, y: 22, class: 'ax', style: 'font-weight:800;fill:var(--ink-2)' }, 'periodic'), s('text', { x: 0, y: 60, class: 'ax', style: 'font-weight:800;fill:var(--ink-2)' }, 'aperiodic'));
          [0, 1, 2, 3, 4, 5].forEach((k) => strip.append(s('path', { d: `M${100 + k * 60 - 6},6 L${100 + k * 60 + 6},6 L${100 + k * 60},16 Z`, class: 'arrm' }), s('rect', { x: 100 + k * 60, y: 18, width: 24, height: 10, rx: 3, class: 'pc0', 'stroke-width': 1.2 })));
          strip.append(s('text', { x: 160, y: 40, class: 'ax', 'text-anchor': 'middle' }, '← T →'));
          [118, 252, 291, 404].forEach((x) => strip.append(s('path', { d: `M${x - 6},46 L${x + 6},46 L${x},56 Z`, class: 'arrm' }), s('rect', { x, y: 58, width: 14, height: 10, rx: 3, class: 'pc2', 'stroke-width': 1.2 })));
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'In most programs a slow answer is merely annoying. In <span class="t">real-time computing</span>, <b>when</b> the answer arrives is part of whether it is correct.' }),
              h('div', { class: 'card tight small' },
                h('p', { class: 'm0', html: '<b>How bad is late?</b> A <span class="t">hard real-time task</span> must meet its <span class="t">deadline</span>: lateness causes damage or a fatal error. A <span class="t">soft real-time task</span> should meet it, but a late result still has some value.' }),
                h('p', { class: 'm0', style: { marginTop: '6px' }, html: '<b>How does it arrive?</b> A <span class="t">periodic task</span> comes back every T time units (read a sensor every 10 ms). An <span class="t">aperiodic task</span> arrives unpredictably (the driver brakes) and has a deadline to start, to finish, or both.' }),
                strip),
              h('div', { class: 'callout analogy small m0', 'data-label': 'Analogy', html: 'A goalkeeper who dives the right way half a second late has saved nothing: hard. A pizza that arrives ten minutes late is still dinner, just a worse one: soft.' })),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'card white stack grow', style: { gap: '8px' } },
                h('h4', { class: 'm0' }, 'Drag the finish time past the deadline'),
                slider, svg, status),
              h('div', { class: 'card tight small', html: '<b>In this section</b> you will see what a real-time OS must promise, schedule tasks by their deadlines, test task sets with rate monotonic scheduling, and fix priority inversion.' }))));
        },
      },

      /* ---------------- 2. The five requirements of a real-time OS ---------------- */
      {
        title: 'Five things a real-time OS must promise',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const REQ = [
            ['Determinism', 'demo', 'Does the OS act at fixed, known times, or within known limits? For interrupts it is measured as the <b>worst-case delay before the OS even acknowledges one</b>. The main enemy is kernel code that runs with interrupts disabled: an RTOS keeps those stretches short and bounded.'],
            ['Responsiveness', 'demo', 'Once the interrupt is acknowledged, how long until it is serviced? Three parts: <b>starting the handler</b> (saving the context, perhaps a process switch), <b>running the handler</b> (set mostly by the hardware and the work), and delays from <b>nested interrupts</b> that cut in. Determinism + responsiveness = the response time to an outside event.'],
            ['User control', null, 'A desktop OS lets you nudge priorities at best. An RTOS hands the designer the fine controls: exact task priorities, which tasks are hard and which soft, whether a task may be paged or swapped out, which processes must always stay in main memory, which disk transfer algorithms to use, and what each priority band may do.'],
            ['Reliability', null, 'Here a failure is not a reboot and an apology. Real-time systems steer brakes, pumps and aircraft, so lost or degraded performance can cost money, damage equipment or endanger lives. The bar for reliability is far higher.'],
            ['Fail-soft operation', 'load', 'When something does go wrong, fail in a way that keeps as much capability and data as possible: contain or correct the fault and keep running instead of crashing. Its timing side is <b>stability</b>: if not every deadline can be met, the most critical tasks still meet theirs.'],
          ];
          let sel = 0, mode = 'demo';
          const list = h('div', { class: 'stack', style: { gap: '6px' } });
          function paintList() {
            list.replaceChildren(...REQ.map(([name, , txt], i) => h('div', { class: 'card tight' + (i === sel ? ' white' : ''), style: { borderColor: i === sel ? 'var(--accent)' : null, padding: '6px 10px' } },
              h('button', { class: 'btn ghost sm', type: 'button', 'aria-pressed': String(i === sel), style: { padding: '0 4px', fontSize: '15px', width: '100%', justifyContent: 'flex-start' }, onclick: () => choose(i), html: `<span class="chip ${i === sel ? 'accent' : ''}">${i + 1}</span> ${name}` }),
              i === sel ? h('p', { class: 'small m0 fade-in', style: { marginTop: '4px' }, html: (i < 2 || i === 4 ? `<span class="t">${name}</span>: ` : '') + txt }) : null)));
          }
          function choose(i) { sel = i; paintList(); if (REQ[i][1] && REQ[i][1] !== mode) { mode = REQ[i][1]; tabs.set(mode); paintRight(); } else paintRight(); }

          /* interrupt timing model (µs): masked stretch d, start-up st, handler work w, nested interrupts n x 12 */
          let d = 40, st = 6, w = 30, n = 0;
          const NEST = 10, SCALE = 250;
          const W = ctx.narrow ? 360 : 600, H = 160, x0 = 4, x1 = W - 6, X = (t) => x0 + (t / SCALE) * (x1 - x0);
          const tsvg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Interrupt response timeline' });
          const tout = h('div', { class: 'msg info', style: { minHeight: '48px' } });
          function drawTiming() {
            const ack = d + 2, start = ack + st, end = start + w + n * NEST;
            tsvg.replaceChildren();
            for (let t = 0; t <= SCALE; t += 50) tsvg.append(s('line', { x1: X(t), x2: X(t), y1: 26, y2: 82, class: 'gl' }), s('text', { x: X(t), y: 96, class: 'ax', 'text-anchor': t === 0 ? 'start' : t === SCALE ? 'end' : 'middle' }, t + (t === SCALE ? ' µs' : '')));
            const seg = (a, b, cls, label) => { tsvg.append(s('rect', { x: X(a), y: 40, width: Math.max(1, X(b) - X(a)), height: 30, rx: 4, class: cls, 'stroke-width': 1.5 })); if (label && X(b) - X(a) > label.length * 7.2) tsvg.append(s('text', { x: (X(a) + X(b)) / 2, y: 55, class: 'bl' }, label)); };
            seg(0, ack, 's-warn', 'not noticed yet');
            seg(ack, start, 's-os', 'start');
            const half = w / 2;
            seg(start, start + half, 's-cpu', 'handler');
            if (n) seg(start + half, start + half + n * NEST, 's-intr', 'nested');
            seg(start + half + n * NEST, end, 's-cpu', n ? '' : '');
            tsvg.append(s('path', { d: `M${X(0) - 1},22 l12,0 l-6,10 Z`, class: 'arrm' }), s('text', { x: X(0), y: 16, class: 'ax', style: 'font-weight:700' }, 'device signals'));
            tsvg.append(s('line', { x1: X(end), x2: X(end), y1: 30, y2: 80, class: 'cur' }), s('text', { x: Math.min(X(end) + 4, W - 70), y: 22, class: 'ax', style: 'font-weight:700;fill:var(--accent)' }, 'serviced'));
            const brace = (a, b, y, ly, label, on) => { tsvg.append(s('path', { d: `M${X(a)},${y - 6} L${X(a)},${y} L${X(b)},${y} L${X(b)},${y - 6}`, style: `fill:none;stroke:var(${on ? '--accent' : '--ink-2'});stroke-width:${on ? 3 : 1.5}` })); tsvg.append(s('text', { x: Math.min(X(a), W - 110), y: ly, style: `font-size:13px;font-weight:800;fill:var(${on ? '--accent' : '--ink-2'})` }, (on ? '▸ ' : '') + label)); };
            brace(0, ack, 110, 126, 'determinism', sel === 0);
            brace(ack, end, 110, 144, 'responsiveness', sel === 1);
            tout.innerHTML = `Response time = <b>${ack}</b> (acknowledge) + <b>${end - ack}</b> (service) = <b>${end} µs</b>. ` + (d > 80 ? 'The long interrupts-off stretch dominates: this is what a real-time kernel works hardest to keep short.' : n ? `Each nested interrupt adds ${NEST} µs that this handler cannot control.` : 'Shrink any piece and the worst case shrinks with it.');
          }
          const sl = [
            ctx.ui.slider({ label: 'Longest interrupts-off stretch', min: 0, max: 130, step: 5, value: d, format: (v) => v + ' µs', onInput: (v) => { d = v; drawTiming(); } }),
            ctx.ui.slider({ label: 'Handler start-up', min: 1, max: 20, value: st, format: (v) => v + ' µs', onInput: (v) => { st = v; drawTiming(); } }),
            ctx.ui.slider({ label: 'Handler work', min: 5, max: 60, step: 5, value: w, format: (v) => v + ' µs', onInput: (v) => { w = v; drawTiming(); } }),
            ctx.ui.slider({ label: 'Nested interrupts', min: 0, max: 3, value: n, format: (v) => v + ' × ' + NEST + ' µs', onInput: (v) => { n = v; drawTiming(); } }),
          ];
          const timingPanel = h('div', { class: 'stack', style: { gap: '6px' } }, h('p', { class: 'small m0 muted', html: 'One interrupt from a device. Which pieces does the OS control? Drag them.' }), ...sl, tsvg, tout);

          /* overload: five car tasks by criticality; capacity c (% of the processor still working) */
          const CAR = [['Brake control', 30], ['Engine control', 25], ['Lane-keeping camera', 20], ['Navigation map', 15], ['Music streaming', 10]];
          let cap = 70, shed = true;
          const lbody = h('div', { class: 'stack', style: { gap: '5px' } });
          const lout = h('div', { class: 'msg', style: { minHeight: '48px' } });
          function drawLoad() {
            const need = CAR.reduce((a, [, x]) => a + x, 0);
            let used = 0;
            /* by criticality: each task in turn takes what it needs from what is left; the first that does not fit gets the remainder (late), the rest get nothing */
            const res = CAR.map(([name, x]) => { if (shed) { const got = Math.min(x, cap - used); used += got; return { name, x, got, ok: got >= x }; } const got = Math.min(x, (x * cap) / need); return { name, x, got, ok: got >= x - 1e-9 }; });
            lbody.replaceChildren(...res.map((r, i) => h('div', { class: 'row nw', style: { gap: '8px' } },
              h('span', { class: 'small b', style: { width: ctx.narrow ? '120px' : '190px', flex: 'none' } }, `${i + 1}. ${r.name}`),
              h('div', { class: 'meter grow', style: { height: '14px' } }, h('i', { style: { width: (r.got / 30) * 100 + '%', background: r.ok ? 'var(--ok)' : r.got > 0 ? 'var(--warn)' : 'var(--line-2)' } })),
              h('span', { class: 'chip ' + (r.ok ? 'ok' : 'bad'), style: { width: '92px', justifyContent: 'center' } }, r.ok ? '✓ in time' : r.got > 0 ? '✗ late' : '✗ paused'))));
            const kept = res.filter((r) => r.ok).length;
            lout.className = 'msg ' + (kept === CAR.length ? 'ok' : shed ? 'warn' : 'bad');
            lout.innerHTML = cap >= need ? 'Everything fits: all five tasks meet their deadlines.'
              : shed ? `Only ${cap}% of the processor is left. Served strictly in order of criticality, the ${kept} most critical tasks still meet every deadline: <b>stable</b>, and the car keeps braking. Only the less critical ones run late or pause.`
              : `Every task gets ${Math.round((cap / need) * 100)}% of what it needs, so <b>all five miss their deadlines</b>, brakes included. Fair, and a disaster.`;
          }
          const loadPanel = h('div', { class: 'stack', style: { gap: '8px' } },
            h('p', { class: 'small m0 muted', html: 'A fault leaves only part of the processor working. The five tasks need 100% in total, listed from most to least critical.' }),
            ctx.ui.slider({ label: 'Processor still working', min: 30, max: 100, step: 5, value: cap, format: (v) => v + '%', onInput: (v) => { cap = v; drawLoad(); } }),
            ctx.ui.seg([{ value: 1, label: 'Keep the critical ones' }, { value: 0, label: 'Share the shortfall equally' }], 1, (v) => { shed = !!v; drawLoad(); }),
            lbody, lout);

          const right = h('div', { class: 'card white stack', style: { gap: '8px' } });
          const tabs = ctx.ui.seg([{ value: 'demo', label: 'Interrupt timing' }, { value: 'load', label: 'Overload' }], mode, (v) => { mode = v; paintRight(); });
          function paintRight() {
            right.replaceChildren(tabs, mode === 'demo' ? timingPanel : loadPanel);
            if (mode === 'demo') drawTiming(); else drawLoad();
          }
          paintList(); paintRight();
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'A real-time OS is judged less by its average speed than by what it can <b>promise in the worst case</b>. Click each requirement.' }),
              list,
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: '“Real-time” does not mean “fast”. A fast system that is usually quick but sometimes stalls is not real-time; a slower one with a guaranteed bound can be.' })),
            right));
        },
      },

      /* ---------------- 3. Typical RTOS features and preemption latency ---------------- */
      {
        title: 'How long until the urgent task gets the processor?',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const KERN = [
            ['Round robin', 'joins the back of the queue'],
            ['Priority, no preemption', 'waits until the running task blocks or ends'],
            ['Priority + preemption points', 'waits for the next point (every 10 ms)'],
            ['Immediate preemption', 'the kernel switches almost at once'],
          ];
          const WIN = 2200, need = LAT.need;
          let r = 400, seed = 7;
          const W = ctx.narrow ? 360 : 640, x0 = 4, x1 = W - 6, X = (t) => x0 + (Math.min(t, WIN) / WIN) * (x1 - x0);
          const lanesSvg = s('svg', { viewBox: `0 0 ${W} 232`, width: '100%', role: 'img', 'aria-label': 'Four timelines showing when the real-time task first runs' });
          const logSvg = s('svg', { viewBox: `0 0 ${W} 112`, width: '100%', role: 'img', 'aria-label': 'Waiting time of the real-time task under each kernel, on a logarithmic scale' });
          const out = h('div', { class: 'msg info small', style: { minHeight: '44px' } });
          /* background work of each lane: [label, class, start, end] before the real-time task is inserted */
          const rrBg = () => Array.from({ length: Math.ceil(WIN / LAT.q) + 2 }, (_, k) => [String((k % LAT.nRR) + 1), 'pc' + (k % 3 === 0 ? 0 : k % 3 === 1 ? 1 : 5), k * LAT.q, (k + 1) * LAT.q]);
          const prBg = () => [['low job 1', 'pcg', 0, 750], ['low job 2', 'pcg', 750, 1950], ['job 3', 'pcg', 1950, 3000]];
          const insert = (bg, st) => { const outSegs = []; bg.forEach(([lab, cls, a, b]) => { if (b <= st) outSegs.push([lab, cls, a, b]); else if (a >= st) outSegs.push([lab, cls, a + need, b + need]); else { outSegs.push([lab, cls, a, st]); outSegs.push([lab, cls, st + need, b + need]); } }); outSegs.push(['RT', 'pcrt', st, st + need]); return outSegs; };
          const fmtMs = (v) => (v < 1 ? `${Math.round(v * 1000)} µs` : v >= 1000 ? `${f2(v / 1000)} s` : `${Math.round(v)} ms`);
          function draw() {
            const L = latency(r);
            lanesSvg.replaceChildren();
            for (let t = 0; t <= WIN; t += 200) { lanesSvg.append(s('line', { x1: X(t), x2: X(t), y1: 8, y2: 212, class: 'gl' })); if (t % 400 === 0) lanesSvg.append(s('text', { x: X(t), y: 226, class: 'ax', 'text-anchor': t === 0 ? 'start' : 'middle' }, t === 2000 ? '2000 ms' : String(t))); }
            L.forEach((lt, k) => {
              const y = 8 + k * 52;
              lanesSvg.append(s('text', { x: x0, y: y + 11, style: 'font-size:13.5px;font-weight:800' }, ctx.narrow ? KERN[k][0] : `${KERN[k][0]}: `, ctx.narrow ? null : s('tspan', { class: 's-sub', style: 'font-weight:600' }, KERN[k][1])));
              lanesSvg.append(s('text', { x: x1, y: y + 11, 'text-anchor': 'end', style: 'font-size:13.5px;font-weight:800;fill:var(--bad)' }, 'waits ' + fmtMs(lt.wait)));
              const segs = insert(k === 0 ? rrBg() : prBg(), lt.start);
              segs.forEach(([lab, cls, a, b]) => {
                if (a >= WIN) return;
                const xa = X(a), xb = X(Math.min(b, WIN));
                lanesSvg.append(s('rect', { x: xa, y: y + 21, width: Math.max(1.5, xb - xa), height: 21, rx: 3, class: cls, 'stroke-width': cls === 'pcrt' ? 0 : 1 }));
                const txt = cls === 'pcrt' ? '' : lab;
                if (txt && xb - xa >= txt.length * 7.5 + 4) lanesSvg.append(s('text', { x: (xa + xb) / 2, y: y + 32, class: 'bl', style: 'font-size:12.5px' }, txt));
              });
              lanesSvg.append(s('line', { x1: X(r), x2: X(lt.start), y1: y + 46, y2: y + 46, style: 'stroke:var(--bad);stroke-width:2.5' }));
              lanesSvg.append(s('path', { d: `M${X(r) - 5},${y + 14} L${X(r) + 5},${y + 14} L${X(r)},${y + 20} Z`, style: 'fill:var(--bad)' }));
            });
            /* log-scale bars: 0.05 ms .. 5000 ms */
            logSvg.replaceChildren();
            const LW = ctx.narrow ? 96 : 190, lx0 = LW, lx1 = W - 70, lo = Math.log10(0.05), hi = Math.log10(5000), LX = (v) => lx0 + ((Math.log10(Math.max(v, 0.05)) - lo) / (hi - lo)) * (lx1 - lx0);
            [[0.1, '0.1 ms'], [1, ctx.narrow ? '1' : '1 ms'], [10, ctx.narrow ? '10' : '10 ms'], [100, ctx.narrow ? '100' : '100 ms'], [1000, '1 s']].forEach(([v, lab]) => logSvg.append(s('line', { x1: LX(v), x2: LX(v), y1: 2, y2: 92, class: 'gl' }), s('text', { x: LX(v), y: 106, class: 'ax', 'text-anchor': 'middle' }, lab)));
            const short = ['Round robin', 'No preempt.', 'Points', 'Immediate'];
            L.forEach((lt, k) => {
              const y = 4 + k * 22;
              logSvg.append(s('text', { x: 0, y: y + 13, style: 'font-size:13px;font-weight:700' }, ctx.narrow ? short[k] : KERN[k][0]));
              logSvg.append(s('rect', { x: lx0, y: y + 2, width: Math.max(2, LX(lt.wait) - lx0), height: 15, rx: 3, class: 'pcrt', style: 'opacity:.75' }));
              logSvg.append(s('text', { x: LX(lt.wait) + 5, y: y + 14, class: 'ax', style: 'font-weight:800;fill:var(--ink)' }, fmtMs(lt.wait)));
            });
            const worst = L[0].wait > L[1].wait ? 0 : 1;
            out.innerHTML = `Request at <b>${r} ms</b>. The slowest kernel here (${KERN[worst][0].toLowerCase()}) made it wait <b>${fmtMs(L[worst].wait)}</b>; immediate preemption, <b>${fmtMs(L[3].wait)}</b>. ` + (L[1].wait > 1000 ? 'Bad luck: a long low-priority job had just started.' : L[1].wait < 50 ? 'Good luck: the low-priority job was just about to finish.' : 'Move the arrival: the nonpreemptive wait depends on luck.');
          }
          const slider = ctx.ui.slider({ label: 'Request arrives at', min: 0, max: 1200, step: 1, value: r, format: (v) => v + ' ms', onInput: (v) => { r = v; draw(); } });
          const rnd = h('button', { class: 'btn sm intr', type: 'button', onclick: () => { const g = ctx.util.seeded(seed++); r = Math.floor(g() * 1201); slider.set(r); draw(); } }, 'A real-time request arrives!');
          draw();
          el.append(h('div', { class: 'split l3 fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'An urgent task is useless if it cannot get the processor. Real-time kernels are built for that, with:' }),
              h('ul', { class: 'small m0', style: { paddingLeft: '18px' }, html: '<li>a fast process or thread switch</li><li>a small size (only what is needed)</li><li>quick response to external <span class="t">interrupt</span>s</li><li>multitasking with IPC tools: <span class="t">semaphore</span>s, signals, events</li><li>special sequential files that collect data at high speed</li><li>preemptive scheduling by priority</li><li>interrupts disabled for the shortest possible stretches</li><li>calls to delay a task for a fixed time, and to pause or resume it</li><li>special alarms and timeouts</li>' }),
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'The kernels on the right differ in one thing: how soon a newly ready high-priority task can take the processor. That wait ranges over about four powers of ten.' })),
            h('div', { class: 'card white stack', style: { gap: '6px' } },
              h('div', { class: 'row', style: { gap: '10px' } }, rnd, h('div', { class: 'grow', style: { minWidth: '240px' } }, slider)),
              lanesSvg,
              h('h4', { class: 'm0' }, 'The same waits on a log scale (each step is ×10)'),
              logSvg, out)));
        },
      },

      /* ---------------- 4. Four classes of real-time scheduling algorithms ---------------- */
      {
        title: 'Four families of real-time schedulers',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          const CLS = [
            ['Static table-driven', 'Static table-driven scheduling', 'Before the system runs, analysis builds a <b>timetable</b> of when each task starts. At run time the dispatcher just follows it.', 'Periodic tasks. Predictable, but inflexible: any change means a new table.'],
            ['Static priority-driven preemptive', 'Static priority-driven preemptive scheduling', 'Before the system runs, analysis gives each task a <b>fixed priority</b>. At run time an ordinary preemptive priority scheduler does the rest.', 'Example: rate monotonic scheduling.'],
            ['Dynamic planning-based', 'Dynamic planning-based scheduling', 'At run time, when a task arrives, the OS <b>checks feasibility</b>: it accepts the task only if it and every task already accepted can still meet their deadlines.', 'The check also yields the plan for dispatching.'],
            ['Dynamic best effort', 'Dynamic best effort scheduling', '<b>No feasibility check.</b> The OS tries to meet every deadline (for example, nearest deadline first) and aborts a task whose deadline has passed.', 'Common for aperiodic tasks. Simple, but a miss is only known when it happens.'],
          ];
          const SC = [
            ['Before launch, engineers work out exactly when each of a drone’s twelve periodic jobs starts in every 100 ms cycle, and the kernel follows that list.', 0],
            ['Each periodic task gets a fixed priority from its period before the system ships; at run time the highest-priority ready task always runs.', 1],
            ['A warehouse robot accepts a new pick-up job only after checking that it, and every job already promised, can still finish on time. Otherwise it refuses the job.', 2],
            ['Alarms arrive at random times. The system runs the one with the nearest deadline, checks nothing in advance, and drops an alarm whose deadline has passed.', 3],
            ['Adding one new sensor task forces the whole schedule to be recomputed offline before the system can run again.', 0],
            ['The system can find out that a deadline was missed only when that deadline arrives or the task completes.', 3],
          ];
          const WHY = [
            'A timetable computed before run time and simply followed is the static table-driven approach.',
            'Fixed priorities assigned before run time, then an ordinary preemptive priority scheduler: static priority-driven preemptive (rate monotonic works this way).',
            'Checking at run time whether a newcomer can be fitted in, and refusing it otherwise, is dynamic planning-based scheduling.',
            'No feasibility check, just trying for the nearest deadline and aborting late work: dynamic best effort.',
          ];
          let hi = -1;
          const cards = h('div', { class: 'grid-2', style: { gap: '10px' } });
          function paintCards() {
            cards.replaceChildren(...CLS.map(([name, term, what, use], i) => h('div', { class: 'card tight' + (i === hi ? ' white' : ''), style: { borderColor: i === hi ? 'var(--accent)' : null, borderWidth: i === hi ? '2px' : null } },
              h('div', { class: 'row', style: { gap: '6px', marginBottom: '4px' } }, h('span', { class: 'chip ' + (i < 2 ? 'os' : 'proc') }, i < 2 ? 'static' : 'dynamic'), h('b', { class: 'small', html: `<span class="t" data-t="${term}">${name}</span>` })),
              h('p', { class: 'small m0', html: what }),
              h('p', { class: 'xs muted m0', style: { marginTop: '4px', fontSize: '13px' }, html: use }))));
          }
          paintCards();
          const game = (p) => {
            let k = 0, score = 0, answered = false;
            const q = h('p', { class: 'm0', style: { minHeight: '78px' } });
            const btns = h('div', { class: 'grid-2', style: { gap: '6px' } });
            const fb = h('div', { class: 'msg', style: { minHeight: '70px' } });
            const prog = h('span', { class: 'chip accent' });
            const nextB = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (k < SC.length - 1) { k++; show(); } else { k = 0; score = 0; show(); } } });
            function show() {
              answered = false; hi = -1; paintCards();
              prog.textContent = `Scenario ${k + 1} of ${SC.length} · score ${score}`;
              q.innerHTML = SC[k][0];
              btns.replaceChildren(...CLS.map(([name], i) => h('button', { class: 'btn sm', type: 'button', style: { whiteSpace: 'normal', height: 'auto', minHeight: '34px', lineHeight: '1.2', padding: '4px 8px' }, onclick: () => answer(i) }, name)));
              fb.className = 'msg'; fb.innerHTML = '<span class="muted">Which family is this? Pick one.</span>';
              nextB.disabled = true; nextB.textContent = k < SC.length - 1 ? 'Next scenario' : 'Start again';
            }
            function answer(i) {
              if (answered) return;
              answered = true;
              const right = SC[k][1], ok = i === right;
              if (ok) score++;
              hi = right; paintCards();
              [...btns.children].forEach((b, j) => { b.disabled = true; if (j === right) b.classList.add('on'); });
              fb.className = 'msg ' + (ok ? 'ok' : 'bad');
              fb.innerHTML = (ok ? '<b>Right.</b> ' : `<b>Not quite: it is ${CLS[right][0].toLowerCase()}.</b> `) + WHY[right];
              prog.textContent = `Scenario ${k + 1} of ${SC.length} · score ${score}`;
              nextB.disabled = false;
            }
            p.append(h('div', { class: 'stack', style: { gap: '8px', paddingTop: '6px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, prog, nextB), q, btns, fb,
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: '“Dynamic” is not simply better. A planning-based system may refuse new work, and a best-effort one can promise nothing in advance. Static designs trade flexibility for guarantees.' })));
            show();
          };
          const INFO = [
            ['Ready time', 'When the task becomes ready to run. For a periodic task this is a known series of times.'],
            ['Starting deadline', 'The latest time it may start.'],
            ['Completion deadline', 'The latest time it may finish. A typical task has one kind of deadline, not both.'],
            ['Processing time', 'How long it needs the processor to finish: given, measured, or a worst-case estimate.'],
            ['Resource requirements', 'Other resources it will hold while it runs.'],
            ['Priority', 'How important it is. A hard task may get an absolute priority: missing it means the system has failed.'],
            ['Subtask structure', 'A mandatory part with a hard deadline, plus an optional part that runs only if time is left.'],
          ];
          const info = (p) => p.append(h('div', { class: 'stack', style: { gap: '6px', paddingTop: '6px' } },
            h('p', { class: 'small m0', html: 'A deadline scheduler can only be as smart as what it knows. A real-time task may come with:' }),
            h('table', { class: 'tbl compact' }, h('tbody', {}, ...INFO.map(([a, b]) => h('tr', {}, h('td', { class: 'b', style: { whiteSpace: 'nowrap' } }, a), h('td', {}, b))))),
            h('p', { class: 'xs muted m0', style: { fontSize: '13px' }, html: 'Two design questions follow: which task runs next, and may a running task be preempted?' })));
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'Real-time schedulers split on two questions: is feasibility analysed <b>before</b> the system runs (static) or <b>while</b> it runs (dynamic), and does the analysis yield a timetable, priorities or a plan?' }),
              cards),
            h('div', { class: 'card white', style: { display: 'flex', flexDirection: 'column', minHeight: 0 } }, ctx.ui.tabs([{ label: 'Which family fits?', render: game }, { label: 'What a task can tell the scheduler', render: info }]))));
        },
      },

      /* ---------------- 5. Deadline scheduling of periodic tasks ---------------- */
      {
        title: 'Periodic tasks: fixed priority or earliest deadline?',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const DEF = [{ C: 10, T: 20 }, { C: 25, T: 50 }];
          const ts = DEF.map((t) => ({ ...t }));
          const POL = [
            ['Fixed priority: A above B', { kind: 'fixed', order: [0, 1] }],
            ['Fixed priority: B above A', { kind: 'fixed', order: [1, 0] }],
            ['Earliest deadline first', { kind: 'edf' }],
          ];
          const W = ctx.narrow ? 360 : 690;
          const charts = h('div', { class: 'stack', style: { gap: '2px' } });
          const uLine = h('div', { class: 'eq', style: { padding: '4px 10px', whiteSpace: ctx.narrow ? null : 'nowrap' } });
          const out = h('div', { class: 'msg', style: { minHeight: '46px' } });
          const live = (j, t) => j.rel <= t && t < (j.fin != null ? j.fin : j.missed ? j.end : 100);
          const jn = (j) => TN[j.i] + j.k;
          function draw() {
            const U = utilization(ts);
            const exact = ts.every((t) => Math.abs((t.C / t.T) * 100 - Math.round((t.C / t.T) * 100)) < 1e-9), eq = exact ? '=' : '≈';
            uLine.innerHTML = `U = ${ts[0].C}/${ts[0].T} + ${ts[1].C}/${ts[1].T} ${eq} ${f2(ts[0].C / ts[0].T)} + ${f2(ts[1].C / ts[1].T)} ${eq} <b>${f2(U)}</b>` + (U > 1 + 1e-9 ? ' <span class="chip bad">above 1: too much work</span>' : ' <span class="chip ok">≤ 1</span>');
            const R = POL.map(([, pol]) => periodic(ts, pol, 100));
            charts.replaceChildren(...POL.map(([lab], p) => {
              const m = R[p].missed, judged = R[p].jobs.filter((j) => j.dl <= 100).length;
              return h('div', {},
                h('div', { class: 'row' + (ctx.narrow ? '' : ' nw'), style: { justifyContent: 'space-between', gap: ctx.narrow ? '2px 6px' : '6px' } },
                  h('b', { class: 'small', style: { whiteSpace: 'nowrap' }, html: p === 2 ? '<span class="t" data-t="Earliest deadline first (EDF)">Earliest deadline first</span>' + (ctx.narrow ? '' : ' (preemptive)') : lab }),
                  h('span', { class: 'chip ' + (m.length ? 'bad' : U > 1 + 1e-9 ? 'warn' : 'ok') }, m.length > 2 ? `✗ ${m.length} missed, first ${jn(m[0])} at ${m[0].dl}` : m.length ? `✗ ${m.map((j) => `${jn(j)} at ${j.dl}`).join(', ')}` : U > 1 + 1e-9 ? `no miss before 100 ms` : `✓ all ${judged} deadlines met`)),
                periodicSvg(ctx, ts, R[p], { W, T: 100, aria: lab, rowH: 18, axis: p === 2 }));
            }));
            const edf = R[2];
            /* firstAhead(i): the first moment EDF runs a job of task i while a job of the other task, with a later deadline, waits */
            const firstAhead = (i) => {
              for (const g of edf.segs) {
                if (g.i !== i) continue;
                const mine = edf.jobs.find((j) => j.i === g.i && j.k === g.k);
                for (let t = g.a; t < g.b; t++) { const other = edf.jobs.find((j) => j.i !== i && live(j, t) && j.dl > mine.dl); if (other) return { t, run: mine, wait: other }; }
              }
              return null;
            };
            const sA = firstAhead(0), sB = firstAhead(1);
            const msgs = [];
            const mA = R[0].missed[0], mB = R[1].missed[0];
            if (mA) msgs.push(`With A on top, ${jn(mA)} has had ${mA.C - mA.left ? 'only ' + (mA.C - mA.left) : 'none'} of its ${mA.C} ms when its deadline arrives at ${mA.dl}.`);
            if (mB) msgs.push(`With B on top, ${jn(mB)} gets ${mB.C - mB.left ? 'only ' + (mB.C - mB.left) : 'none'} of its ${mB.C} ms by ${mB.dl}.`);
            if (U > 1 + 1e-9 && R.some((x) => !x.missed.length)) msgs.unshift('U is above 1, so a miss must come eventually; this 100 ms window just ends first.');
            if (sA && sB) msgs.push(`EDF changes its mind: at t = ${sA.t} it puts ${jn(sA.run)} (deadline ${sA.run.dl}) before ${jn(sA.wait)} (${sA.wait.dl}), at t = ${sB.t} ${jn(sB.run)} (${sB.run.dl}) before ${jn(sB.wait)} (${sB.wait.dl}). No fixed priority order does both.`);
            if (!msgs.length) msgs.push(edf.missed.length ? 'Every policy misses something: the load is simply too high.' : 'This load is light enough that every policy copes.');
            out.className = 'msg ' + (edf.missed.length ? 'bad' : U > 1 + 1e-9 ? 'warn' : 'info');
            out.innerHTML = msgs.slice(0, 3).join(' ');
          }
          const fix = (i) => { if (ts[i].C > ts[i].T) { ts[i].C = ts[i].T; sl[i * 2].set(ts[i].C); } };
          const sl = [
            ctx.ui.slider({ label: 'A needs', min: 1, max: 30, value: ts[0].C, format: (v) => v + ' ms', onInput: (v) => { ts[0].C = Math.min(v, ts[0].T); if (v > ts[0].T) sl[0].set(ts[0].C); draw(); } }),
            ctx.ui.slider({ label: 'A period', min: 10, max: 50, step: 5, value: ts[0].T, format: (v) => v + ' ms', onInput: (v) => { ts[0].T = v; fix(0); draw(); } }),
            ctx.ui.slider({ label: 'B needs', min: 1, max: 60, value: ts[1].C, format: (v) => v + ' ms', onInput: (v) => { ts[1].C = Math.min(v, ts[1].T); if (v > ts[1].T) sl[2].set(ts[1].C); draw(); } }),
            ctx.ui.slider({ label: 'B period', min: 20, max: 100, step: 5, value: ts[1].T, format: (v) => v + ' ms', onInput: (v) => { ts[1].T = v; fix(1); draw(); } }),
          ];
          const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => { DEF.forEach((d, i) => { ts[i].C = d.C; ts[i].T = d.T; sl[i * 2].set(d.C); sl[i * 2 + 1].set(d.T); }); draw(); } }, 'Back to the example');
          draw();
          el.append(h('div', { class: 'split l3 fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'Two <span class="t">periodic task</span>s share one processor. Each job must finish before the next job of the same task arrives: its <span class="t">deadline</span> is the next arrival.' }),
              h('div', { class: 'card tight small', html: '<b>A</b>: every 20 ms, needs 10 ms.<br><b>B</b>: every 50 ms, needs 25 ms.<br>A job still unfinished at its deadline is <b>missed</b> and dropped: its answer would come too late.' }),
              h('p', { class: 'small m0', html: '<b>Earliest deadline first</b> looks at the clock instead of a fixed ranking: at every moment it runs the job whose deadline is nearest, preempting if needed.' }),
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'For independent tasks that can be preempted on one processor, EDF is optimal: if any schedule meets every deadline, EDF does. For periodic tasks whose deadlines equal their periods, that is exactly when U ≤ 1.' }),
              h('div', { class: 'callout tip small m0', 'data-label': 'Try', html: 'Give A 12 ms (U above 1). Then shorten B’s period to 45 ms.' })),
            h('div', { class: 'card white stack', style: { gap: '6px', padding: '10px 14px' } },
              h('div', { class: 'grid-2', style: { gap: '4px 16px' } }, ...sl),
              h('div', { class: 'row' + (ctx.narrow ? '' : ' nw'), style: { justifyContent: 'space-between', gap: '8px' } }, uLine, reset),
              charts, out)));
        },
      },

      /* ---------------- 6. Deadline scheduling of aperiodic tasks with starting deadlines ---------------- */
      {
        title: 'Aperiodic tasks: is it ever smart to sit idle?',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const TS = [{ arr: 10, sd: 110, C: 20 }, { arr: 20, sd: 20, C: 20 }, { arr: 40, sd: 50, C: 20 }, { arr: 50, sd: 90, C: 20 }, { arr: 60, sd: 70, C: 20 }];
          const POLS = [['ed', 'Earliest deadline'], ['edui', 'Earliest deadline, unforced idle'], ['fcfs', 'First come, first served']];
          const RES = Object.fromEntries(POLS.map(([k]) => [k, aperiodic(TS, k)]));
          const N = (i) => `<b>${TN[i]}</b>`;
          const list = (ids) => ids.map((i) => `${TN[i]} (by ${TS[i].sd})`).join(', ');
          let pol = ctx.keep.apol || 'ed';
          const W = ctx.narrow ? 360 : 690, T = 130, LW = 44, rh = 20, pitch = 32, top = 8;
          const x0 = LW, x1 = W - 10, X = (t) => x0 + (Math.min(Math.max(t, 0), T) / T) * (x1 - x0);
          const svg = s('svg', { viewBox: `0 0 ${W} ${top + 6 * pitch + 22}`, width: '100%', role: 'img', 'aria-label': 'Start windows of the five tasks and the schedule' });
          const chips = h('div', { class: 'row', style: { gap: '6px' } });
          function drawChart(r, cur) {
            svg.replaceChildren();
            const yAx = top + 6 * pitch + 4;
            for (let t = 0; t <= T; t += 10) { svg.append(s('line', { x1: X(t), x2: X(t), y1: 2, y2: yAx - 4, class: 'gl' })); if (t % 20 === 0 || !ctx.narrow) svg.append(s('text', { x: X(t), y: yAx + 12, class: 'ax', 'text-anchor': 'middle' }, String(t))); }
            TS.forEach((tk, i) => {
              const y = top + i * pitch;
              svg.append(s('text', { x: 0, y: y + rh / 2 + 5, class: 'lbl' }, TN[i]));
              const g = s('g', { style: tk.arr <= cur ? null : 'opacity:.4' });
              g.append(s('rect', { x: X(tk.arr) - 1.5, y: y + 1, width: Math.max(3, X(tk.sd) - X(tk.arr) + 3), height: rh - 2, rx: 4, class: 'wait' }));
              g.append(s('path', { d: `M${X(tk.arr) - 4},${y - 5} L${X(tk.arr) + 4},${y - 5} L${X(tk.arr)},${y + 1} Z`, class: 'arrm' }));
              g.append(s('line', { x1: X(tk.sd), x2: X(tk.sd), y1: y - 2, y2: y + rh + 2, class: 'dl', style: 'opacity:.55' }));
              svg.append(g);
              const st = r.st[i];
              if (st.start != null && st.start <= cur) {
                const b = Math.min(st.fin, cur);
                if (b > st.start) svg.append(s('rect', { x: X(st.start), y, width: X(b) - X(st.start), height: rh, rx: 3, class: 'pc' + i, 'stroke-width': 1.3 }));
                svg.append(s('text', { x: X(st.start) - 7, y: y + rh / 2 + 5, class: 'mv', style: 'font-size:12px' }, '✓'));
              }
              if (st.missed && tk.sd <= cur) svg.append(s('text', { x: X(tk.sd) + 9, y: y + rh / 2 + 6, class: 'mx' }, '✗'));
            });
            const yc = top + 5 * pitch + 2;
            svg.append(s('text', { x: 0, y: yc + rh / 2 + 5, class: 'lbl' }, 'CPU'));
            svg.append(s('rect', { x: X(0), y: yc, width: X(Math.min(cur, T)) - X(0), height: rh, rx: 3, class: 'pcg', 'stroke-width': 1 }));
            r.ev.filter((e) => e.k === 'hold' && e.t < cur).forEach((e) => svg.append(s('text', { x: (X(e.t) + X(Math.min(e.until, cur))) / 2, y: yc + rh / 2 + 1, class: 'bl', style: 'font-size:12px;fill:var(--bad)' }, 'idle')));
            r.segs.forEach((g) => { if (g.a >= cur) return; const b = Math.min(g.b, cur); svg.append(s('rect', { x: X(g.a), y: yc, width: X(b) - X(g.a), height: rh, rx: 3, class: 'pc' + g.i, 'stroke-width': 1.3 })); if (X(b) - X(g.a) > 14) svg.append(s('text', { x: (X(g.a) + X(b)) / 2, y: yc + rh / 2 + 1, class: 'bl' }, TN[g.i])); });
            if (cur > 0 && cur < T) svg.append(s('line', { x1: X(cur), x2: X(cur), y1: 0, y2: yAx - 4, class: 'cur' }));
          }
          function caption(r, e) {
            const runningAt = (t) => { const g = r.segs.find((x) => x.a <= t && t < x.b); return g ? N(g.i) : 'nothing'; };
            if (e.k === 'idle') return `Nothing ${e.t === 0 ? 'has arrived' : 'is waiting'}, so the processor idles until ${e.until}.`;
            if (e.k === 'hold') return `The earliest starting deadline of all the tasks not yet run is ${N(e.i)}’s (${TS[e.i].sd}), and ${N(e.i)} arrives at ${e.until}. The processor waits for it${e.ready.length ? `, even though ${e.ready.map(N).join(', ')} ${e.ready.length > 1 ? 'are' : 'is'} ready` : ''}: an <b>unforced idle time</b>.`;
            if (e.k === 'start') {
              const why = e.pool.length < 2 ? `${N(e.i)} is the only task ready.` : pol === 'fcfs' ? `Ready: ${e.pool.map((i) => `${TN[i]} (arrived ${TS[i].arr})`).join(', ')}. ${N(e.i)} arrived first.` : `Ready: ${list(e.pool)}. ${N(e.i)} has the earliest starting deadline.`;
              return `${why} It starts at ${e.t} (deadline ${TS[e.i].sd} ✓) and runs to completion.`;
            }
            if (e.k === 'done') return `${N(e.i)} finishes.`;
            if (e.k === 'miss') return `${N(e.i)}’s starting deadline (${TS[e.i].sd}) passes while ${runningAt(e.t)} runs: ${N(e.i)} is <b>missed</b> and will never run.`;
            return '';
          }
          const host = h('div', { class: 'stack', style: { gap: '6px' } });
          let player = null;
          function build() {
            if (player) player.stop();
            ctx.keep.apol = pol;
            const r = RES[pol], frames = [{ t: 0, k: 'begin' }, ...r.ev];
            chips.replaceChildren(...POLS.map(([k, lab]) => { const m = RES[k].missed; return h('span', { class: 'chip ' + (m.length ? 'bad' : 'ok'), style: { outline: k === pol ? '2px solid var(--accent)' : null } }, `${lab}: ${m.length ? '✗ ' + m.map((i) => TN[i]).join(', ') + ' missed' : '✓ all met'}`); }));
            player = ctx.ui.player({ count: frames.length, interval: 1700, captionBelow: true, render: (i) => {
              const e = frames[i], last = i === frames.length - 1;
              drawChart(r, last ? T : e.t);
              if (e.k === 'begin') return `<b>t = 0.</b> Five tasks will arrive, each needing 20 ms. Each must <b>start</b> inside its dashed window (faded until the task arrives). Step forward to watch.`;
              const tail = last ? ` <b>Result: ${r.missed.length ? r.missed.map((x) => TN[x]).join(' and ') + ' missed.' : 'every task started in time.'}</b>` : '';
              return `<b>t = ${e.t}.</b> ${caption(r, e)}${tail}`;
            } });
            host.replaceChildren(svg, player.el);
          }
          const seg = ctx.ui.seg(POLS.map(([value, label]) => ({ value, label })), pol, (v) => { pol = v; build(); });
          build();
          el.append(h('div', { class: 'split l3 fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'Five <span class="t">aperiodic task</span>s, each needing 20 ms. Each has a <b>starting</b> <span class="t">deadline</span>, so once a task starts it simply runs to the end.' }),
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Task'), h('th', { class: 'r' }, 'Arrives'), h('th', { class: 'r' }, 'Start by'))),
                h('tbody', {}, ...TS.map((tk, i) => h('tr', {}, h('td', { class: 'b' }, TN[i]), h('td', { class: 'r num' }, String(tk.arr)), h('td', { class: 'r num' }, String(tk.sd)))))),
              h('p', { class: 'small m0', html: '<b>Unforced idle</b>: always pick the task with the earliest deadline, even one that has not arrived yet, and leave the processor idle until it does.' }),
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: '“Never idle while work is waiting” sounds efficient, but here idling at 10 instead of starting A is what saves B. The price: the scheduler must know arrival times in advance.' })),
            h('div', { class: 'card white stack', style: { gap: '6px', padding: '10px 14px' } }, seg, chips,
              h('p', { class: 'xs muted m0', html: '▼ arrival · dashed box = the window in which the task may start · red line = starting deadline · ✓ started in time · ✗ missed' }), host)));
        },
      },

      /* ---------------- 7. Rate monotonic scheduling and its utilization bound ---------------- */
      {
        title: 'Rate monotonic scheduling: a quick safety test',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const PRE = [
            ['classic', 'Three tasks', [[20, 100], [40, 150], [100, 350]]],
            ['harm', 'Harmonic, U = 1', [[10, 20], [10, 40], [20, 80]]],
            ['above', 'Above the bound', [[10, 40], [20, 60], [30, 120]]],
            ['ab', 'U = 1, not harmonic', [[10, 20], [25, 50]]],
          ];
          const load = (k) => PRE.find((p) => p[0] === k)[2].map(([C, T]) => ({ C, T }));
          let ts = (ctx.keep.rms || load('classic')).map((t) => ({ ...t })), preset = ctx.keep.rmsPre || 'classic';
          const CAP = 20000, W = ctx.narrow ? 360 : 700;
          const editor = h('div', { class: 'stack', style: { gap: '4px' } });
          const meter = s('svg', { viewBox: '0 0 330 54', width: '100%', role: 'img', 'aria-label': 'Total utilization compared with the RMS bound and with 1' });
          const verdict = h('div', { class: 'msg small', style: { minHeight: '84px' } });
          const chartBox = h('div');
          const winNote = h('p', { class: 'xs muted m0' });
          const seg = ctx.ui.seg(PRE.map(([value, label]) => ({ value, label })), preset, (v) => { preset = v; ts = load(v); update(); });
          function rankOf() { const order = ts.map((_, i) => i).sort((a, b) => ts[a].T - ts[b].T || a - b); return { order, rank: ts.map((_, i) => order.indexOf(i) + 1) }; }
          function update() {
            ctx.keep.rms = ts.map((t) => ({ ...t })); ctx.keep.rmsPre = preset;
            const { order, rank } = rankOf();
            editor.replaceChildren(
              h('div', { class: 'row nw xs muted b', style: { gap: '8px' } }, h('span', { style: { width: '22px' } }, ''), h('span', { style: { width: '58px' } }, 'C (ms)'), h('span', { style: { width: '58px' } }, 'T (ms)'), h('span', { style: { width: '52px' } }, 'C/T'), h('span', {}, 'priority')),
              ...ts.map((t, i) => {
                const inC = h('input', { type: 'number', class: 'nin', min: 1, max: 400, step: 1, value: t.C, 'data-keys': '', 'aria-label': `Execution time C of task ${TN[i]}` });
                const inT = h('input', { type: 'number', class: 'nin', min: 5, max: 400, step: 1, value: t.T, 'data-keys': '', 'aria-label': `Period T of task ${TN[i]}` });
                const commit = () => { const T = Math.max(5, Math.min(400, parseInt(inT.value, 10) || t.T)); const C = Math.max(1, Math.min(T, parseInt(inC.value, 10) || t.C)); ts[i] = { C, T }; preset = null; seg.set(null); update(); };
                inC.addEventListener('change', commit); inT.addEventListener('change', commit);
                return h('div', { class: 'row nw', style: { gap: '8px' } }, h('b', { style: { width: '22px' } }, TN[i]), inC, inT, h('span', { class: 'num small', style: { width: '52px' } }, f4(t.C / t.T)),
                  h('span', { class: 'chip ' + (rank[i] === 1 ? 'accent' : '') }, ['1st', '2nd', '3rd', '4th', '5th'][rank[i] - 1]),
                  ts.length > 1 ? h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': `Remove task ${TN[i]}`, style: { padding: '0 6px' }, onclick: () => { ts.splice(i, 1); preset = null; seg.set(null); update(); } }, '×') : null);
              }),
              ts.length < 5 ? h('button', { class: 'btn sm', type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => { ts.push({ C: 10, T: 100 }); preset = null; seg.set(null); update(); } }, '+ Add a task') : null);
            const n = ts.length, U = utilization(ts), B = rmsBound(n), H = hyperperiod(ts), Hs = Math.min(H, CAP);
            const res = periodic(ts, { kind: 'fixed', order }, Hs), miss = res.missed[0];
            /* meter: 0 .. 1.2 */
            const mx = (v) => 10 + (Math.min(v, 1.2) / 1.2) * 310;
            meter.replaceChildren(
              s('rect', { x: mx(0), y: 14, width: mx(B) - mx(0), height: 14, class: 's-ok' }), s('rect', { x: mx(B), y: 14, width: mx(1) - mx(B), height: 14, class: 's-warn' }), s('rect', { x: mx(1), y: 14, width: mx(1.2) - mx(1), height: 14, class: 's-bad' }),
              s('text', { x: mx(B), y: 44, class: 'ax', 'text-anchor': 'middle' }, `bound ${f3(B)}`), s('text', { x: mx(1), y: 44, class: 'ax', 'text-anchor': 'start' }, '1.0'),
              s('path', { d: `M${mx(U) - 6},2 L${mx(U) + 6},2 L${mx(U)},12 Z`, style: 'fill:var(--ink)' }), s('line', { x1: mx(U), x2: mx(U), y1: 12, y2: 30, style: 'stroke:var(--ink);stroke-width:2.5' }),
              s('text', { x: mx(U) > 200 ? mx(U) - 9 : mx(U) + 9, y: 11, 'text-anchor': mx(U) > 200 ? 'end' : 'start', style: 'font-size:13px;font-weight:800' }, `U = ${f3(U)}`));
            const sim = miss ? `Simulation: <b>${TN[miss.i]}${miss.k} misses its deadline at ${miss.dl}</b>.` : `Simulation of ${H <= CAP ? `the whole ${H} ms hyperperiod` : `the first ${CAP} ms`}: <b>no deadline missed</b>.`;
            if (U > 1 + 1e-9) { verdict.className = 'msg small bad'; verdict.innerHTML = `U = ${f3(U)} is above 1: the tasks need more than the whole processor, so <b>no scheduler</b> can meet every deadline. ${sim}`; }
            else if (U <= B + 1e-9) { verdict.className = 'msg small ok'; verdict.innerHTML = `U = ${f3(U)} ≤ ${f3(B)}, the bound for n = ${n}: RMS is <b>guaranteed</b> to meet every deadline, no simulation needed. ${sim}`; }
            else { verdict.className = 'msg small warn'; verdict.innerHTML = `U = ${f3(U)} is above the bound ${f3(B)} but not above 1, so the quick test <b>cannot decide</b>. ${sim} ${miss ? 'EDF would manage, since U ≤ 1.' : 'Schedulable anyway: the bound is sufficient, not necessary.'}`; }
            const maxT = Math.max(...ts.map((t) => t.T)), win = Math.min(Hs, 2 * maxT);
            chartBox.replaceChildren(periodicSvg(ctx, ts, res, { W, T: win, rowH: 18, aria: 'Rate monotonic schedule' }));
            winNote.innerHTML = `Timeline 0–${win} ms` + (win < H ? ` of the ${H > CAP ? 'very long' : H + ' ms'} hyperperiod (the time after which the whole pattern repeats).` : ': one full hyperperiod, after which the pattern repeats.') + ' Priority 1st = shortest period.' + (miss ? ' A job unfinished at its deadline is dropped.' : '');
          }
          update();
          el.append(h('div', { class: 'split l3 fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0 small', html: '<span class="t">Rate monotonic scheduling (RMS)</span> fixes each periodic task’s priority by its period: the <b>shorter</b> the period T (the higher the rate 1/T), the <b>higher</b> the priority.' }),
              h('div', { class: 'eq' }, 'U = C₁/T₁ + C₂/T₂ + … + Cₙ/Tₙ'),
              h('p', { class: 'm0 small', html: 'Every scheduler needs U ≤ 1. RMS is guaranteed when U is at most the <span class="t">utilization bound</span> n(2<sup>1/n</sup> − 1):' }),
              h('table', { class: 'tbl compact bt' }, h('tbody', {},
                h('tr', {}, h('th', {}, 'n'), ...[1, 2, 3, 4, 5, 6].map((k) => h('td', { class: 'c' }, String(k))), h('td', { class: 'c' }, '∞')),
                h('tr', {}, h('th', {}, 'bound'), ...[1, 2, 3, 4, 5, 6].map((k) => h('td', { class: 'c num' }, f3(rmsBound(k)))), h('td', { class: 'c num' }, f3(Math.log(2)))))),
              h('div', { class: 'callout why small m0', 'data-label': 'Why RMS, if EDF reaches U = 1?', html: 'Fixed priorities are simple and predictable. Under overload the short-period tasks on top still meet their deadlines, so you know in advance who suffers. With EDF it is hard to say which task will miss.' }),
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Above the bound does <b>not</b> mean “will fail”. The test is sufficient, not necessary: between the bound and 1, only a closer look (like the simulation) can tell.' })),
            h('div', { class: 'card white stack', style: { gap: '8px', padding: '10px 14px' } },
              seg,
              h('div', { class: 'split', style: { gap: '14px', height: 'auto' } }, editor, h('div', { class: 'stack', style: { gap: '6px' } }, meter, verdict)),
              chartBox, winNote)));
        },
      },

      /* ---------------- 8. Priority inversion, inheritance and ceilings ---------------- */
      {
        title: 'Priority inversion: when the urgent task waits',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const PROTO = [['none', 'No protocol'], ['inherit', 'Priority inheritance'], ['ceiling', 'Priority ceiling']];
          const LV = ['high', 'medium', 'low'];
          let proto = ctx.keep.inv || 'none', M = ctx.keep.invM || 6;
          const W = ctx.narrow ? 360 : 700, T = 22, LW = ctx.narrow ? 34 : 108, rh = 24, pitch = 44, top = 16;
          const x0 = LW, x1 = W - 10, X = (t) => x0 + (Math.min(Math.max(t, 0), T) / T) * (x1 - x0);
          const svg = s('svg', { viewBox: `0 0 ${W} ${top + 4 * pitch + 14}`, width: '100%', role: 'img', 'aria-label': 'Timeline of the three tasks and of who holds lock R' });
          const chips = h('div', { class: 'row', style: { gap: '6px' } });
          const P = (k) => `<b>${INV[k].name}</b>`;
          function draw(r, upTo) {
            svg.replaceChildren();
            const yAx = top + 4 * pitch - 6;
            for (let t = 0; t <= T; t += 2) svg.append(s('line', { x1: X(t), x2: X(t), y1: 2, y2: yAx, class: 'gl' }), s('text', { x: X(t), y: yAx + 14, class: 'ax', 'text-anchor': 'middle' }, String(t)));
            INV.forEach((d, i) => {
              const y = top + i * pitch;
              svg.append(s('text', { x: 0, y: y + rh / 2 + 5, class: 'lbl' }, ctx.narrow ? d.name : `${d.name} · ${LV[i]}`));
              if (d.arr <= upTo) {
                svg.append(s('rect', { x: X(d.arr), y: y + 2, width: X(Math.min(r.fin[i], upTo)) - X(d.arr), height: rh - 4, rx: 4, class: 'wait' }));
                svg.append(s('path', { d: `M${X(d.arr) - 5},${y - 7} L${X(d.arr) + 5},${y - 7} L${X(d.arr)},${y - 1} Z`, class: 'arrm' }));
              }
              r.blockedSpans.filter((b) => b.i === i && b.a < upTo).forEach((b) => {
                const xb = X(Math.min(b.b, upTo));
                svg.append(s('rect', { x: X(b.a), y: y + 1, width: xb - X(b.a), height: rh - 2, rx: 4, class: 'blk' }));
                if (xb - X(b.a) > 70) svg.append(s('text', { x: (X(b.a) + xb) / 2, y: y + rh / 2 + 1, class: 'bl', style: 'fill:var(--bad);font-size:12.5px' }, 'blocked on R'));
              });
              r.segs.filter((g) => g.i === i && g.a < upTo).forEach((g) => {
                const xa = X(g.a), xb = X(Math.min(g.b, upTo)), boosted = g.eff !== d.prio;
                svg.append(s('rect', { x: xa, y, width: xb - xa, height: rh, rx: 3, class: 'pc' + [0, 2, 1][i], 'stroke-width': g.cs ? 3 : 1.3 }));
                if (xb - xa > 18) svg.append(s('text', { x: (xa + xb) / 2, y: y + rh / 2 + 1, class: 'bl' }, g.cs ? 'R' : ''));
                if (boosted) svg.append(s('text', { x: (xa + xb) / 2, y: y - 3, 'text-anchor': 'middle', style: 'font-size:12.5px;font-weight:800;fill:var(--accent)' }, `@${g.eff}`));
              });
            });
            const y = top + 3 * pitch;
            svg.append(s('text', { x: 0, y: y + rh / 2 + 5, class: 'lbl' }, ctx.narrow ? 'R' : 'lock R'));
            let a = null, who = -1;
            const flush = (b) => { if (who >= 0 && b > a) { svg.append(s('rect', { x: X(a), y: y + 3, width: X(b) - X(a), height: rh - 6, rx: 3, class: 'pc' + [0, 2, 1][who], style: 'opacity:.6' })); if (X(b) - X(a) > 30) svg.append(s('text', { x: (X(a) + X(b)) / 2, y: y + rh / 2 + 1, class: 'bl', style: 'font-size:12px' }, INV[who].name)); } };
            r.frames.forEach((f) => { if (f.t >= upTo) return; if (f.holder !== who) { flush(f.t); who = f.holder; a = f.t; } });
            flush(Math.min(upTo, r.T));
            if (upTo < r.T) svg.append(s('line', { x1: X(upTo), x2: X(upTo), y1: 0, y2: yAx, class: 'cur' }));
          }
          function caption(r, i) {
            const f = r.frames[i], out = [];
            if (f.run < 0 && f.ev.length === 0) return `<b>t = ${f.t}.</b> All done. ${P(0)} arrived at ${INV[0].arr} and finished at ${r.fin[0]}: response time <b>${r.resp[0]}</b>.` + (proto === 'none' ? ` Make T2 longer and this keeps growing.` : ` However long T2 is, it stays ${r.resp[0]}.`);
            for (const e of f.ev) {
              if (e.k === 'arr') out.push(`${P(e.i)} (${LV[e.i]} priority, ${INV[e.i].prio}) arrives.`);
              else if (e.k === 'lock') out.push(`${P(e.i)} locks R.`);
              else if (e.k === 'lockc') out.push(`${P(e.i)} locks R and rises to R’s ceiling, priority ${CEIL}.`);
              else if (e.k === 'block') out.push(`${P(e.i)} tries to lock R, but ${P(e.by)} holds it: ${P(e.i)} is <b>blocked</b>.`);
              else if (e.k === 'inherit') out.push(`${P(e.i)} <b>inherits</b> priority ${e.to} from the task it is blocking.`);
              else if (e.k === 'unlock') out.push(`${P(e.i)} releases R${e.drop ? ` and drops back from ${e.drop} to its own priority ${INV[e.i].prio}` : ''}.`);
              else if (e.k === 'wake') out.push(`${P(e.i)} can take R now.`);
            }
            if (f.run >= 0) {
              out.push(`${P(f.run)} runs at priority ${f.eff}.`);
              if (f.run === 2 && f.blocked[0] && !f.ev.some((e) => e.k === 'block')) out.push(`${P(0)} stays blocked until ${P(2)} releases R.`);
              if (proto === 'none' && f.run === 1 && f.blocked[0]) out.push(`${P(0)}, the most urgent task, now waits for ${P(1)}, which never even uses R: <b>unbounded priority inversion</b>.`);
              if (proto === 'inherit' && f.run === 2 && f.ev.some((e) => e.k === 'arr' && e.i === 1)) out.push(`${P(1)} cannot preempt it: ${P(2)} is borrowing ${P(0)}’s priority.`);
              if (proto === 'ceiling' && f.run === 2 && f.ev.some((e) => e.k === 'arr' && e.i === 0)) out.push(`${P(0)} cannot preempt: ${P(2)} holds R and runs at the ceiling ${CEIL}, above ${P(0)}’s 3.`);
            }
            return `<b>t = ${f.t}.</b> ` + out.join(' ');
          }
          const host = h('div', { class: 'stack', style: { gap: '6px' } });
          let player = null;
          function build() {
            if (player) player.stop();
            ctx.keep.inv = proto; ctx.keep.invM = M;
            const all = Object.fromEntries(PROTO.map(([k]) => [k, inversion(k, M)])), r = all[proto];
            const bestResp = Math.min(...PROTO.map(([k]) => all[k].resp[0]));
            chips.replaceChildren(...PROTO.map(([k, lab]) => h('span', { class: 'chip ' + (all[k].resp[0] > bestResp ? 'bad' : 'ok'), style: { outline: k === proto ? '2px solid var(--accent)' : null } }, `${lab}: T1 waits ${all[k].resp[0] - INV[0].script.reduce((a, op) => a + (op[0] === 'run' ? op[1] : 0), 0)}, done at ${all[k].fin[0]}`)));
            player = ctx.ui.player({ count: r.frames.length, interval: 1400, captionBelow: true, render: (i) => { const last = i === r.frames.length - 1; draw(r, last ? r.T : r.frames[i].t + 1); return caption(r, i); } });
            host.replaceChildren(svg, player.el);
          }
          const seg = ctx.ui.seg(PROTO.map(([value, label]) => ({ value, label })), proto, (v) => { proto = v; build(); });
          const slider = ctx.ui.slider({ label: 'T2 (medium) needs', min: 2, max: 12, value: M, format: (v) => v + ' units', onInput: (v) => { M = v; build(); } });
          build();
          el.append(h('div', { class: 'split l3 fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0 small', html: '<span class="t">Priority inversion</span>: a high-priority task waits for a lower one. With a shared lock some of it is unavoidable: if low <b>T3</b> holds lock R, high <b>T1</b> must wait until T3 releases it.' }),
              h('p', { class: 'm0 small', html: 'The danger is a <b>medium</b> task T2 that preempts T3 meanwhile. Now T1 waits for T2 as well, for as long as medium work keeps coming: <b>unbounded</b> inversion.' }),
              h('p', { class: 'm0 small', html: '<span class="t">Priority inheritance</span>: the lock holder runs at the priority of the highest task waiting for it. <span class="t">Priority ceiling</span>: taking R lifts a task to R’s ceiling, one level above R’s highest user, at once.' }),
              h('div', { class: 'callout bad small m0', 'data-label': 'Mars, 1997', html: 'Days after landing, the Pathfinder lander kept resetting itself. A low-priority weather task held a lock that a high-priority bus task needed, and medium tasks kept the weather task off the processor. A watchdog saw the bus task fall behind and reset the computer. Engineers on Earth switched on priority inheritance for that lock.' }),
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Neither cure removes the wait for the lock holder itself; they stop <b>other</b> tasks from stretching it.' })),
            h('div', { class: 'card white stack', style: { gap: '6px', padding: '10px 14px' } },
              h('div', { class: 'row', style: { gap: '10px' } }, seg, h('div', { class: 'grow', style: { minWidth: '220px' } }, slider)),
              chips, h('p', { class: 'xs muted m0', html: '▼ arrival · dashed = waiting · red dashed = blocked on R · thick outline, “R” = inside the critical section · @4 = running at a raised priority' }), host)));
        },
      },

      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: eight things to remember',
        kind: 'recap',
        render(el, ctx) {
          const B = rmsBound(3);
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['What makes a task <b>hard</b> or <b>soft</b> real-time?', 'Hard: missing the deadline causes damage or a fatal error. Soft: a late result is worth less, but still worth finishing.'],
              ['<b>Periodic</b> or <b>aperiodic</b>?', 'Periodic: comes back every T time units. Aperiodic: arrives unpredictably, with a deadline to start, to finish, or both.'],
              ['The five requirements of a real-time OS?', 'Determinism, responsiveness, user control, reliability, fail-soft operation (with stability: critical deadlines first).'],
              ['How long until a newly ready urgent task runs?', 'Round robin or no preemption: up to seconds. Preemption points: a few ms. Immediate preemption: about 100 µs or less.'],
              ['The four classes of real-time scheduler?', 'Static table-driven, static priority-driven preemptive, dynamic planning-based, dynamic best effort.'],
              ['What does <b>earliest deadline first</b> promise?', 'For independent tasks with preemption on one processor it meets every deadline whenever any schedule can; for periodic tasks with deadline = period, whenever U ≤ 1.'],
              ['The rate monotonic test?', `Shorter period = higher priority. U = ΣC/T. U ≤ n(2<sup>1/n</sup> − 1) (${f3(B)} for 3 tasks) guarantees success; U > 1 is impossible; in between, check.`],
              ['Unbounded priority inversion and its cures?', 'Medium tasks preempt a low lock holder while a high task waits. Inheritance: the holder borrows the waiter’s priority. Ceiling: the holder runs at the lock’s ceiling.'],
            ], { cols: ctx.narrow ? 2 : 4, height: 226 })));
        },
      },

      /* ---------------- 10. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A car’s anti-lock braking controller must adjust brake pressure within a few milliseconds of a wheel starting to lock, or the car may skid. What kind of task is this?',
            choices: ['A soft real-time task, since a slightly late adjustment still helps the driver', 'A hard real-time task, since missing the deadline can cause damage or injury', 'An aperiodic soft task, since wheel lock-ups happen at unpredictable moments', 'Not a real-time task, since the brakes still work without the controller'],
            answer: 1,
            feedback: ['A skid can cause a crash: lateness here is not just “worth less”, it is dangerous. That is the mark of a hard task.', null, 'When a task arrives (aperiodic or not) is a separate question from how bad lateness is. Here lateness is dangerous, so it is hard.', 'The controller’s whole job is timing-critical: a correct adjustment that comes too late is a failure.'],
            why: 'A hard real-time task is one whose missed deadline causes unacceptable damage or a fatal error. A soft task’s late result still has some value.' },
          { type: 'bucket', q: 'Sort each task: hard or soft real-time?', buckets: ['Hard real-time', 'Soft real-time'],
            items: [['Firing a car’s airbag after a crash is detected', 0], ['Showing the next frame of a streamed video', 1], ['A pacemaker delivering its next pulse', 0], ['Updating a stock-price ticker on a screen', 1], ['Closing a valve during a chemical plant’s emergency shutdown', 0], ['Refreshing the weather widget on a phone', 1]],
            why: 'If lateness can hurt people or equipment, the task is hard. If a late result is merely less pleasant (a stutter, a stale number), it is soft.' },
          { type: 'match', q: 'Match each requirement of a real-time OS to what it is about.',
            pairs: [['Determinism', 'Worst-case delay before an interrupt is acknowledged'], ['Responsiveness', 'Time to service an interrupt once it has been acknowledged'], ['User control', 'Designer sets priorities, paging and which tasks stay in memory'], ['Reliability', 'Failures may cost money, equipment or lives, so must be very rare'], ['Fail-soft operation', 'Keep as much capability and data as possible when a fault occurs']],
            why: 'Determinism and responsiveness together make up the response time to an outside event; user control, reliability and fail-soft operation complete the five.' },
          { type: 'order', q: 'Five aperiodic tasks each need 20 ms and must <b>start</b> by a deadline. A arrives at 10 (start by 110), B at 20 (by 20), C at 40 (by 50), D at 50 (by 90), E at 60 (by 70). A started task runs to completion. Under <b>earliest deadline with unforced idle times</b>, in what order do they run?',
            items: ['B', 'C', 'E', 'D', 'A'],
            why: 'The scheduler always picks the earliest starting deadline among all unfinished tasks, even ones not yet arrived: it idles from 10 to 20 for B (by 20), then runs C (by 50), E (by 70), D (by 90) and A (by 110), and every task starts in time.' },
          { q: 'A kernel checks for a waiting higher-priority task only at preemption points that come every 10 ms. A real-time task becomes ready just after one of those points. About how long until it gets the processor?',
            choices: ['About 100 µs, because the kernel switches as soon as the task is ready', 'Until the running task blocks or finishes, which could take seconds', 'One full round of time slices, one slice for every ready process', 'Close to 10 ms, the time remaining until the next preemption point'],
            answer: 3,
            feedback: ['That is immediate preemption, which this kernel does not have.', 'That is a priority scheduler with no preemption at all; this one preempts at its points.', 'That is plain round robin, which ignores priority.', null],
            why: 'With preemption points the urgent task waits for the next point, so the delay is bounded by the point interval: here at most 10 ms, and close to that because the task became ready just after a point.' },
          { type: 'num', q: 'Three periodic tasks: C = 20 ms, T = 100 ms; C = 40 ms, T = 150 ms; C = 100 ms, T = 350 ms. What is their total processor utilization U = ΣC/T? (three decimals)',
            answer: 0.7524, tol: 0.001,
            why: '20/100 + 40/150 + 100/350 = 0.2000 + 0.2667 + 0.2857 = 0.7524, so 0.752 to three decimals (adding terms already rounded to 0.200 + 0.267 + 0.286 gives 0.753, which is also accepted). That is below the rate monotonic bound for three tasks, 0.780, so RMS will meet every deadline.' },
          { q: 'Three periodic tasks scheduled by rate monotonic scheduling have total utilization U = 0.85. The utilization bound for three tasks is 0.780. What can you conclude?',
            choices: ['Some deadline will be missed, because U is above the bound', 'Every deadline will be met, because U is still below 1.0', 'Nothing yet: between the bound and 1, the quick test cannot decide', 'Switching to EDF would not help, since EDF has the same 0.780 limit'],
            answer: 2,
            feedback: ['The bound is sufficient, not necessary: many sets above it are still schedulable.', 'U ≤ 1 is necessary for any scheduler, but it does not guarantee that fixed RMS priorities will work.', null, 'For independent periodic tasks whose deadlines equal their periods, EDF works up to U = 1, so it would meet every deadline here; 0.780 is the RMS bound, not an EDF limit.'],
            why: 'U ≤ the bound guarantees success; U > 1 guarantees failure; in between you must analyse or simulate the actual task set.' },
          { type: 'tf', q: 'On one processor, preemptive earliest deadline first meets every deadline of a set of independent periodic tasks (each deadline equal to the period) whenever their total utilization is at most 1.',
            answer: true,
            why: 'For such task sets EDF is optimal: U ≤ 1 is both necessary and sufficient. Rate monotonic scheduling only guarantees success up to its lower bound.' },
          { type: 'num', q: 'Periodic task A (C = 10 ms, T = 20 ms) and task B (C = 25 ms, T = 50 ms) are released together at 0 and scheduled preemptively with fixed priority, A above B. How many ms of processing has B’s first job received when its deadline arrives at 50?',
            answer: 20, tol: 0, unit: 'ms',
            why: 'A takes 0–10, 20–30 and 40–50; B gets only 10–20 and 30–40, so 20 of its 25 ms. B misses its deadline, although earliest deadline first meets every deadline for the same two tasks.' },
          { type: 'multi', q: 'Which are typical features of a real-time operating system?',
            choices: ['A fast process or thread switch', 'Preemptive scheduling based on priority', 'Long stretches with interrupts disabled to protect kernel data', 'Primitives to delay a task for a fixed amount of time', 'Round robin time slicing as the main scheduling policy', 'Special alarms and timeouts'],
            answer: [0, 1, 3, 5],
            why: 'An RTOS keeps interrupts disabled for the shortest possible stretches and schedules by priority with preemption, not plain round robin, so that urgent tasks get the processor at once.' },
          { q: 'Low-priority T3 holds lock R. High-priority T1 blocks on R. Then medium-priority T2, which never uses R, becomes ready. With <b>priority inheritance</b>, what happens next?',
            choices: ['T3 runs at T1’s priority until it releases R, so T2 cannot preempt it', 'T2 runs first, because it is ready and outranks T3’s own priority', 'T1 preempts T3 and takes R, because T1 has the highest priority', 'T3 is aborted and R is freed, so that T1 can continue right away'],
            answer: 0,
            feedback: [null, 'That is what happens with no protocol, and it is exactly the unbounded inversion that inheritance prevents.', 'A lock cannot be taken from its holder; T1 must wait until T3 releases R.', 'Inheritance never aborts the holder; it speeds it up so it releases R sooner.'],
            why: 'Under inheritance the lock holder temporarily runs at the priority of the highest task waiting for the lock, finishes its critical section, releases R and drops back.' },
          { type: 'match', q: 'Match each class of real-time scheduling algorithm to its description.',
            pairs: [['Static table-driven', 'Offline analysis yields a timetable of start times'], ['Static priority-driven preemptive', 'Offline analysis yields fixed priorities, as in RMS'], ['Dynamic planning-based', 'A new task is accepted only if all deadlines can still be met'], ['Dynamic best effort', 'No feasibility check; a task past its deadline is aborted']],
            why: 'Static approaches analyse before the system runs (producing a table or priorities); dynamic ones decide at run time, either with a feasibility check (planning) or without one (best effort).' },
        ],
      },
    ],

    notes: `
<h3>What real-time means</h3>
<p>In <b>real-time computing</b> a result is correct only if it is logically right <b>and</b> produced in time. Each real-time task has a <b>deadline</b>: a time by which it must start (starting deadline) or finish (completion deadline).</p>
<ul>
<li><b>Hard real-time task</b>: missing the deadline causes unacceptable damage or a fatal error (an airbag, a pacemaker pulse, an emergency valve).</li>
<li><b>Soft real-time task</b>: the deadline is desirable; a late result still has some value, so it is still worth finishing (a video frame, a ticker display).</li>
<li><b>Periodic task</b>: comes back once per period T, or exactly T time units apart. <b>Aperiodic task</b>: arrives at unpredictable times, with a deadline to start, to finish, or both.</li>
</ul>
<p>Real-time does not mean fast: it means a guaranteed worst case.</p>

<h3>Five requirements of a real-time OS</h3>
<ol>
<li><b>Determinism</b>: operations happen at fixed, known times or within known intervals. For interrupts it is the worst-case delay before the OS acknowledges one; long stretches with interrupts disabled are the main enemy.</li>
<li><b>Responsiveness</b>: once acknowledged, how long until the interrupt is serviced: starting the handler, running it, plus delays from nested interrupts. Determinism + responsiveness = response time to an outside event.</li>
<li><b>User control</b>: the designer sets fine-grained priorities, hard or soft, paging and swapping, which processes stay in main memory, disk transfer algorithms, and the rights of each priority band.</li>
<li><b>Reliability</b>: failures may cost money, equipment or lives, so the bar is far higher than for a desktop system.</li>
<li><b>Fail-soft operation</b>: fail in a way that keeps as much capability and data as possible instead of crashing. Its timing side is <b>stability</b>: if not every deadline can be met, the most critical tasks still meet theirs. Example: braking stays on time while the music pauses.</li>
</ol>

<h3>Typical RTOS features and preemption latency</h3>
<p>Fast process or thread switch; small size; quick response to external interrupts; multitasking with IPC tools (semaphores, signals, events); special sequential files that collect data at high speed; preemptive scheduling by priority; interrupts disabled only briefly; primitives to delay a task for a fixed time and to pause or resume tasks; special alarms and timeouts.</p>
<p>How long a newly ready real-time task waits:</p>
<ul><li><b>Round robin</b>: its turn at the back of the queue (up to seconds).</li><li><b>Priority, nonpreemptive</b>: until the running task blocks or finishes (up to seconds).</li><li><b>Priority + preemption points</b>: until the next clock-based point (several ms).</li><li><b>Immediate preemption</b>: about 100 µs or less.</li></ul>

<h3>Four classes of real-time scheduling algorithms</h3>
<ul>
<li><b>Static table-driven</b>: analysis before run time builds a timetable of start times. For periodic tasks; inflexible (any change needs a new table).</li>
<li><b>Static priority-driven preemptive</b>: analysis before run time assigns fixed priorities; an ordinary preemptive priority scheduler runs the tasks. Example: rate monotonic scheduling.</li>
<li><b>Dynamic planning-based</b>: feasibility checked at run time; an arriving task is accepted only if all accepted deadlines can still be met.</li>
<li><b>Dynamic best effort</b>: no feasibility check; tries to meet deadlines and aborts a task whose deadline has passed. Common for aperiodic tasks.</li>
</ul>
<p>A task may tell the scheduler its <b>ready time</b>, <b>starting deadline</b>, <b>completion deadline</b>, <b>processing time</b>, <b>resource requirements</b>, <b>priority</b> (a hard task may have an absolute priority) and <b>subtask structure</b> (a mandatory subtask with a hard deadline plus an optional one).</p>

<h3>Deadline scheduling: periodic tasks</h3>
<p><b>Earliest deadline first (EDF)</b> runs, at every moment, the ready task whose deadline is nearest, preempting if needed. For independent preemptible tasks on one processor it is optimal: if any schedule meets every deadline, EDF does. For periodic tasks with deadline = next arrival, that means exactly U ≤ 1.</p>
<p>Example: A every 20 ms needing 10 ms, B every 50 ms needing 25 ms (U = 0.5 + 0.5 = 1.0). A job unfinished at its deadline is missed and dropped.</p>
<ul>
<li><b>Fixed priority, A above B</b>: A runs 0–10, 20–30, 40–50, so B’s first job gets only 20 of its 25 ms by 50 and misses.</li>
<li><b>Fixed priority, B above A</b>: B runs 0–25, so A’s first job misses at 20; later B runs 50–75 and A’s fourth job misses at 80.</li>
<li><b>EDF</b>: A 0–10, B 10–20, A 20–30, B 30–45 (at 40, B’s deadline 50 beats A’s 60), A 45–55, B 55–60, A 60–70, B 70–90, A 90–100: all seven deadlines met.</li>
</ul>

<h3>Deadline scheduling: aperiodic tasks with starting deadlines</h3>
<p>Each task needs 20 ms and, once started, runs to completion. A (arrives 10, start by 110), B (20, by 20), C (40, by 50), D (50, by 90), E (60, by 70).</p>
<ul>
<li><b>Earliest deadline</b> (among tasks that have arrived): A 10–30, B’s deadline passes at 20, idle 30–40, C 40–60, E 60–80, D 80–100. <b>B missed.</b></li>
<li><b>Earliest deadline with unforced idle times</b> (earliest deadline, even if not yet arrived): unforced idle 10–20 while A waits, B 20–40, C 40–60, E 60–80, D 80–100, A 100–120. <b>All met.</b> Order: B, C, E, D, A. It needs arrival times in advance.</li>
<li><b>FCFS</b>: A 10–30, B missed, C 40–60, D 60–80, E’s deadline passes at 70. <b>B and E missed.</b></li>
</ul>

<h3>Rate monotonic scheduling (RMS)</h3>
<p>RMS gives each periodic task a fixed priority by its period: shorter period (higher rate 1/T) = higher priority. Utilization U = C₁/T₁ + … + Cₙ/Tₙ. Any scheduler needs U ≤ 1. RMS is guaranteed to meet every deadline if U ≤ n(2<sup>1/n</sup> − 1):</p>
<p>Bound for n = 1 to 6: 1.000, 0.828, 0.780, 0.757, 0.743, 0.735; as n grows it falls to ln 2 ≈ 0.693.</p>
<p>Worked example: C = 20, T = 100; C = 40, T = 150; C = 100, T = 350. U = 0.2000 + 0.2667 + 0.2857 = 0.7524 ≈ 0.752 ≤ 0.780 (pre-rounded terms add to 0.753: same verdict), so RMS meets every deadline.</p>
<p>The bound is <b>sufficient, not necessary</b>: between it and 1 you must check. Harmonic (10, 20), (10, 40), (20, 80) has U = 1.0 yet meets every deadline; (10, 20), (25, 50), also U = 1.0, misses under RMS but not under EDF. RMS stays popular: fixed priorities are simple and predictable, and under overload the short-period tasks keep their deadlines (stability); under EDF the task that misses is hard to predict.</p>

<h3>Priority inversion</h3>
<p><b>Priority inversion</b>: a higher-priority task waits for a lower-priority one, usually because the lower task holds a lock. Some waiting is unavoidable, but it becomes <b>unbounded</b> when medium-priority tasks preempt the lock holder: the high task then also waits for them. The Mars Pathfinder lander (1997) kept resetting this way until engineers enabled priority inheritance on the lock.</p>
<ul>
<li><b>Priority inheritance</b>: a lock holder runs at the priority of the highest task waiting for the lock, then drops back when it releases it.</li>
<li><b>Priority ceiling</b>: each resource gets a priority one level above its highest-priority user; a task that takes it runs at that ceiling at once and drops back on release. POSIX PTHREAD_PRIO_PROTECT mutexes work this way (often with the ceiling equal to the top user’s priority: same effect).</li>
</ul>
<p>Example: T3 (low) locks R at 1 for 4 units; T1 (high) arrives at 2 and needs R; T2 (medium, 6 units, no R) comes at 3. No protocol: T1 is blocked 3–12 and finishes at 15 (later if T2 is longer). Inheritance: T3 inherits priority 3 at 3, releases R at 6, T1 finishes at 9. Ceiling: T3 runs at 4 from time 1, so T1 cannot even preempt it; R is free at 5 and T1 again finishes at 9. Either cure limits T1’s wait to one critical section.</p>`,
  });
})();
