/* =====================================================================
   Section 10.1 — Multiprocessor and Multicore Scheduling
   Kinds of multiprocessor, granularity, the three design issues
   (assignment, multiprogramming each processor, dispatching), the four
   ways to schedule threads (load sharing, gang, dedicated, dynamic) and
   cache-aware placement on multicore chips.
   One deterministic engine (below) drives every chart, table and caption,
   so the numbers on screen always come from the same code.
   ===================================================================== */
(() => {
  /* ENGINE-BEGIN ------------------------------------------------------
     Pure simulation code (no DOM). dev/qa-10.1/engine.test.mjs extracts
     this block and checks the numbers the slides and notes quote.     */
  const LET = 'ABCDEFGHIJKLMNOP';
  const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  /* rng(seed): a small repeatable random generator (mulberry32); the same seed always gives the same numbers */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---- Assignment lab: four processors, three ways to hand out processes ---- */
  const ASSIGN_SEED = 79;
  /* assignWorkload(seed): twelve processes A-L; arrivals 0-5, about 30% long (5-8 units), the rest short (1-3) */
  function assignWorkload(seed) {
    const r = rng(seed), out = [];
    for (let i = 0; i < 12; i++) out.push({ arr: Math.floor(r() * 6), svc: r() < 0.3 ? 5 + Math.floor(r() * 4) : 1 + Math.floor(r() * 3) });
    return out.sort((a, b) => a.arr - b.arr);
  }
  /* simAssign(procs, mode, m): mode 'static' (each process is tied for life to the processor that had the fewest
     processes when it arrived), 'global' (one shared queue, any free processor takes the front) or 'balance'
     (per-processor queues, but a processor with nothing to do pulls the newest process from the longest queue).
     Order at each instant t: finishes, arrivals, dispatch. frames[t] = state during [t, t+1). */
  function simAssign(procs, mode, m = 4) {
    const P = procs.map((p, i) => ({ i, arr: p.arr, svc: p.svc, rem: p.svc, fin: null, home: null }));
    const qs = Array.from({ length: m }, () => []), gq = [], run = Array(m).fill(null);
    const frames = [], segs = [];
    let t = 0, done = 0, idleWait = 0, moves = 0;
    const load = (c) => qs[c].length + (run[c] ? 1 : 0);
    while (done < P.length && t < 500) {
      const ev = [];
      for (let c = 0; c < m; c++) if (run[c] && run[c].rem === 0) { run[c].fin = t; done++; ev.push({ k: 'fin', p: run[c].i, c }); run[c] = null; }
      for (const p of P) if (p.arr === t) {
        if (mode === 'global') { gq.push(p); ev.push({ k: 'arr', p: p.i, c: -1 }); }
        else { let c = 0; for (let k = 1; k < m; k++) if (load(k) < load(c)) c = k; p.home = c; qs[c].push(p); ev.push({ k: 'arr', p: p.i, c }); }
      }
      for (let c = 0; c < m; c++) {
        if (run[c]) continue;
        if (mode === 'global') { if (gq.length) { run[c] = gq.shift(); ev.push({ k: 'go', p: run[c].i, c }); } continue; }
        if (qs[c].length) { run[c] = qs[c].shift(); ev.push({ k: 'go', p: run[c].i, c }); continue; }
        if (mode === 'balance') {
          let v = -1; for (let k = 0; k < m; k++) if (k !== c && qs[k].length && (v < 0 || qs[k].length > qs[v].length)) v = k;
          if (v >= 0) { const p = qs[v].pop(); p.home = c; run[c] = p; moves++; ev.push({ k: 'pull', p: p.i, c, from: v }); }
        }
      }
      if (done === P.length) { frames.push({ t, run: run.map(() => null), qs: qs.map(() => []), gq: [], ev, idle: [] }); break; }
      const waiting = gq.length + qs.reduce((a, q) => a + q.length, 0);
      const idle = []; for (let c = 0; c < m; c++) if (!run[c] && waiting) idle.push(c);
      idleWait += idle.length;
      frames.push({ t, run: run.map((p) => (p ? { i: p.i, rem: p.rem } : null)), qs: qs.map((q) => q.map((p) => p.i)), gq: gq.map((p) => p.i), ev, idle });
      for (let c = 0; c < m; c++) if (run[c]) { segs.push({ c, p: run[c].i, a: t, b: t + 1 }); run[c].rem--; }
        else segs.push({ c, p: idle.includes(c) ? -2 : -1, a: t, b: t + 1 });
      t++;
    }
    const tr = P.map((p) => p.fin - p.arr);
    return { frames, segs, T: t, fin: P.map((p) => p.fin), tr, meanTr: avg(tr), makespan: Math.max(...P.map((p) => p.fin)), idleWait, moves };
  }

  /* ---- Dispatching: FCFS versus round robin on m processors that share one queue ---- */
  /* dispWorkload: n processes whose random arrivals keep each of the m processors about rho busy.
     'low' variability: service 8-12 (mean 10). 'high': 80% need 1-5 units, 20% need 20-56 (mean 10). */
  function dispWorkload(m, vari, seed, n = 4000, rho = 0.8) {
    const r = rng(seed * 7919 + m * 31 + (vari === 'high' ? 1 : 0)), rate = (rho * m) / 10, out = [];
    let t = 0;
    for (let i = 0; i < n; i++) {
      t += -Math.log(1 - r()) / rate;
      const svc = vari === 'low' ? 8 + Math.floor(r() * 5) : r() < 0.8 ? 1 + Math.floor(r() * 5) : 20 + Math.floor(r() * 37);
      out.push({ arr: Math.floor(t), svc });
    }
    return out;
  }
  /* dispRun(jobs, m, pol): one global queue; 'fcfs' runs each process to the end, 'rr' uses a quantum of 1 unit
     (no switching cost). Returns the mean turnaround and the mean normalized turnaround (Tr/Ts). */
  function dispRun(jobs, m, pol) {
    const P = jobs.map((j) => ({ arr: j.arr, svc: j.svc, rem: j.svc, fin: 0 }));
    const q = [], cpu = Array(m).fill(null);
    let k = 0, done = 0, t = 0, head = 0;
    while (done < P.length) {
      for (let c = 0; c < m; c++) if (cpu[c] && cpu[c].rem === 0) { cpu[c].fin = t; done++; cpu[c] = null; }
      while (k < P.length && P[k].arr === t) q.push(P[k++]);
      if (pol === 'rr') for (let c = 0; c < m; c++) if (cpu[c] && q.length > head) { q.push(cpu[c]); cpu[c] = null; }
      for (let c = 0; c < m; c++) if (!cpu[c] && q.length > head) cpu[c] = q[head++];
      for (let c = 0; c < m; c++) if (cpu[c]) cpu[c].rem--;
      if (head > 4096) { q.splice(0, head); head = 0; }
      t++;
    }
    return { tr: avg(P.map((p) => p.fin - p.arr)), ntr: avg(P.map((p) => (p.fin - p.arr) / p.svc)) };
  }
  function dispTable(vari, seed) {
    return [1, 2, 4, 8].map((m) => { const w = dispWorkload(m, vari, seed); return { m, fcfs: dispRun(w, m, 'fcfs'), rr: dispRun(w, m, 'rr') }; });
  }

  /* ---- Load sharing: one global queue of threads, three ways to order it ---- */
  const LS_JOBS = [{ arr: 0, len: [3, 3, 3, 3, 3, 3] }, { arr: 1, len: [1] }, { arr: 2, len: [2, 2] }];
  /* simLS(jobs, pol, m): pol 'fcfs' (threads in arrival order), 'sntf' (the job with the fewest unscheduled
     threads first, ties by arrival; nonpreemptive), 'psntf' (same, and an arriving job with fewer threads than a
     running job preempts that job's threads). A thread that restarts on a different processor is a migration.
     lockWaits counts the extra processors that wanted the shared queue at the same instant as another one. */
  function simLS(jobs, pol, m = 3) {
    const J = jobs.map((j, ji) => ({ ji, arr: j.arr, n: j.len.length, fin: null, th: j.len.map((L, k) => ({ ji, k, rem: L, last: null, done: false })) }));
    const q = [], run = Array(m).fill(null), frames = [], segs = [];
    let t = 0, moves = 0, lockWaits = 0, pre = 0;
    const unsched = (ji) => q.filter((x) => x.ji === ji).length;
    const allDone = () => J.every((j) => j.fin != null);
    while (!allDone() && t < 200) {
      const ev = [], users = new Set();
      for (let c = 0; c < m; c++) if (run[c] && run[c].rem === 0) {
        const th = run[c]; th.done = true; run[c] = null; ev.push({ k: 'fin', j: th.ji, th: th.k, c });
        const jb = J[th.ji]; if (jb.th.every((x) => x.done)) { jb.fin = t; ev.push({ k: 'jfin', j: th.ji }); }
      }
      for (const jb of J) if (jb.arr === t) { jb.th.forEach((x) => q.push(x)); ev.push({ k: 'arr', j: jb.ji }); }
      if (pol === 'psntf') for (const jb of J) if (jb.arr === t) {
        const free = run.filter((x) => !x).length;
        let need = unsched(jb.ji) - free;
        while (need > 0) {
          let v = -1;
          for (let c = 0; c < m; c++) if (run[c] && J[run[c].ji].n > jb.n && (v < 0 || J[run[c].ji].n > J[run[v].ji].n || (J[run[c].ji].n === J[run[v].ji].n && run[c].rem > run[v].rem))) v = c;
          if (v < 0) break;
          const th = run[v]; run[v] = null; q.push(th); pre++; users.add(v); need--; ev.push({ k: 'pre', j: th.ji, th: th.k, c: v, by: jb.ji });
        }
      }
      if (pol !== 'fcfs' && run.some((x) => !x)) {
        const inQ = [...new Set(q.map((x) => x.ji))];
        if (inQ.length > 1) ev.push({ k: 'pick', cnt: inQ.map((ji) => [ji, unsched(ji)]) });
      }
      for (let c = 0; c < m; c++) {
        if (run[c] || !q.length) continue;
        let bi = 0;
        if (pol !== 'fcfs') for (let x = 1; x < q.length; x++) {
          const a = q[x], b = q[bi], ua = unsched(a.ji), ub = unsched(b.ji);
          if (ua < ub || (ua === ub && J[a.ji].arr < J[b.ji].arr)) bi = x;
        }
        const th = q.splice(bi, 1)[0]; run[c] = th; users.add(c);
        const mig = th.last != null && th.last !== c; if (mig) moves++;
        ev.push({ k: 'go', j: th.ji, th: th.k, c, mig });
      }
      lockWaits += Math.max(0, users.size - 1);
      if (allDone()) { frames.push({ t, run: run.map(() => null), q: [], ev, users: users.size }); break; }
      frames.push({ t, run: run.map((x) => (x ? { j: x.ji, k: x.k, rem: x.rem } : null)), q: q.map((x) => ({ j: x.ji, k: x.k })), ev, users: users.size });
      for (let c = 0; c < m; c++) if (run[c]) {
        const th = run[c], last = segs.find((g) => g.c === c && g.b === t && g.j === th.ji && g.k === th.k);
        if (last) last.b = t + 1; else segs.push({ c, j: th.ji, k: th.k, a: t, b: t + 1, mig: th.last != null && th.last !== c });
        th.last = c; th.rem--;
      }
      t++;
    }
    const tr = J.map((j) => j.fin - j.arr);
    return { frames, segs, T: t, fin: J.map((j) => j.fin), tr, meanTr: avg(tr), moves, lockWaits, pre };
  }

  /* ---- Gang scheduling: share of processor time wasted when two gangs take turns ---- */
  /* gangWaste(P, a, b, weighted): gang A has a threads, gang B has b (each at most P). Uniform: each gang gets
     half of the time; weighted: time in proportion to thread count. Idle processors while a gang runs are waste. */
  function gangWaste(P, a, b, weighted) {
    const fa = weighted ? a / (a + b) : 0.5, fb = 1 - fa;
    const idle = (P - a) * fa + (P - b) * fb;
    return { fa, fb, idle, waste: idle / P };
  }

  /* ---- Dedicated processors: an illustrative speedup model (not measured data) ---- */
  /* speedupModel(n, P): up to P threads each get their own processor (a small coordination cost per extra thread);
     beyond P, threads must take turns, and switching, cache reloads and waiting for partners that are not
     running cost a growing share of the time. */
  function speedupModel(n, P) {
    const own = (k) => k / (1 + 0.012 * (k - 1));
    return n <= P ? own(n) : own(P) / (1 + (0.75 * (n - P)) / P);
  }

  /* ---- Dynamic scheduling: the processor allocation rules for jobs that change size ---- */
  const DYN_EVENTS = [
    { k: 'arr', j: 0, want: 2 }, { k: 'arr', j: 1, want: 3 }, { k: 'arr', j: 2, want: 1 }, { k: 'arr', j: 3, want: 2 },
    { k: 'arr', j: 4, want: 1 }, { k: 'end', j: 2 }, { k: 'end', j: 0 },
  ];
  /* simDyn(events, m): rule 1, a request takes idle processors first; rule 2, a NEW job that still has none takes
     one processor from the job holding the most (only from a job with more than one); rule 3, whatever is still
     missing waits in a first-come list (a job that loses a processor adds one to its wish); rule 4, freed processors
     go first to waiting jobs that hold none, one each, then to the waiting list in first-come order. */
  function simDyn(events, m = 4) {
    const own = Array(m).fill(null), jobs = {}, wait = [], frames = [];
    const held = (j) => own.filter((x) => x === j).length;
    const addWait = (j, n) => { const w = wait.find((x) => x.j === j); if (w) w.n += n; else wait.push({ j, n }); };
    const idleList = () => own.map((x, c) => (x == null ? c : -1)).filter((c) => c >= 0);
    frames.push({ own: own.slice(), wait: [], ev: null, notes: [] });
    for (const e of events) {
      const notes = [];
      if (e.k === 'arr' || e.k === 'more') {
        if (e.k === 'arr') jobs[e.j] = { want: e.want };
        let need = e.want; const idle = idleList();
        const take = Math.min(need, idle.length);
        for (let x = 0; x < take; x++) own[idle[x]] = e.j;
        if (take) notes.push({ r: 1, n: take });
        need -= take;
        if (need > 0 && e.k === 'arr' && held(e.j) === 0) {
          let v = null, vh = 1;
          for (const j of Object.keys(jobs).map(Number)) if (j !== e.j && held(j) > vh) { v = j; vh = held(j); }
          if (v != null) { const c = own.lastIndexOf(v); own[c] = e.j; need--; addWait(v, 1); notes.push({ r: 2, from: v }); }
        }
        if (need > 0) { addWait(e.j, need); notes.push({ r: 3, n: need }); }
      } else {
        const freed = [];
        own.forEach((x, c) => { if (x === e.j) { own[c] = null; freed.push(c); } });
        const wi = wait.findIndex((x) => x.j === e.j); if (wi >= 0) wait.splice(wi, 1);
        delete jobs[e.j];
        notes.push({ r: 0, n: freed.length });
        for (const w of wait.slice()) if (freed.length && held(w.j) === 0) { own[freed.shift()] = w.j; w.n--; notes.push({ r: 4, j: w.j, first: true }); }
        for (const w of wait) while (freed.length && w.n > 0) { own[freed.shift()] = w.j; w.n--; notes.push({ r: 4, j: w.j, first: false }); }
        for (let x = wait.length - 1; x >= 0; x--) if (wait[x].n <= 0) wait.splice(x, 1);
      }
      frames.push({ own: own.slice(), wait: wait.map((w) => ({ ...w })), ev: e, notes });
    }
    return frames;
  }

  /* ---- Multicore placement: two dual-core clusters, each with one shared cache ---- */
  /* Working sets in MB. Sharers P and C each have 1 MB of their own plus a 2 MB buffer they share. */
  const CACHE_MB = 6, BUF_MB = 2;
  const MC_THREADS = { P: { own: 1, share: true }, C: { own: 1, share: true }, H1: { own: 5 }, H2: { own: 5 }, L1: { own: 1 }, L2: { own: 1 } };
  const MC_SCEN = { share: ['P', 'C', 'L1', 'L2'], hungry: ['H1', 'H2', 'L1', 'L2'], mixed: ['P', 'C', 'H1', 'H2'] };
  /* mcCost(slots): slots = four thread names, cores 0-1 form cluster X and cores 2-3 cluster Y. Each round every
     thread sweeps its data once. Data that does not fit in its cluster's cache comes from main memory again
     (overflow), and a shared buffer split across the clusters is copied over and back each round (2 × buffer). */
  function mcCost(slots) {
    const cl = [slots.slice(0, 2), slots.slice(2, 4)].map((ts) => {
      const sh = ts.some((x) => MC_THREADS[x].share);
      const demand = ts.reduce((a, x) => a + MC_THREADS[x].own, 0) + (sh ? BUF_MB : 0);
      return { ts, demand, sh, over: Math.max(0, demand - CACHE_MB) };
    });
    const split = cl[0].sh && cl[1].sh;
    const cross = split ? 2 * BUF_MB : 0;
    return { cl, split, cross, total: cl[0].over + cl[1].over + cross };
  }
  function mcBest(names) {
    let best = Infinity;
    for (let a = 1; a < 4; a++) { const X = [names[0], names[a]], Y = names.filter((x) => !X.includes(x)); best = Math.min(best, mcCost([...X, ...Y]).total); }
    return best;
  }
  /* ENGINE-END */
  /* ------------------------------------------------------------------
     Shared display helpers
     ------------------------------------------------------------------ */
  const f1 = (x) => (x == null || !isFinite(x) ? '—' : (Math.round(x * 10) / 10).toFixed(1));
  const f2 = (x) => (x == null || !isFinite(x) ? '—' : x.toFixed(2));
  const pct = (x, d = 1) => (Math.round(x * 100 * 10 ** d) / 10 ** d).toFixed(d).replace(/\.0+$/, '') + '%';
  const andList = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  /* tok(): a small coloured badge with a name and an optional small number */
  const tok = (ctx, name, ci, small, extra) => ctx.h('span', { class: 'tk pc' + (ci % 6) + (extra ? ' ' + extra : '') }, name, small != null ? ctx.h('small', {}, String(small)) : null);
  function say(box, kind, head, html) { box.className = 'msg ' + (kind || ''); box.innerHTML = (head ? `<b class="h">${head}</b>` : '') + html; }
  function lane(ctx, label, sub, items, cls) {
    const { h } = ctx;
    return h('div', { class: 'lane' + (cls ? ' ' + cls : '') }, h('div', { class: 'ln' }, label, sub ? h('small', {}, sub) : null),
      h('div', { class: 'toks' }, ...(items.length ? items : [h('span', { class: 'empty' }, 'empty')])));
  }
  /* timeline(ctx, o): one lane per processor, time left to right. o.rows = labels, o.T = time span,
     o.segs = [{ r, a, b, cls, text }], o.upTo hides everything after that time, o.cursor draws the "now" line. */
  function timeline(ctx, o) {
    const { s } = ctx;
    const W = o.W || 640, LW = o.labelW || 34, rh = o.rowH || 20, gap = o.gap ?? 4, T = Math.max(1, o.T);
    const top = 4, yb = top + o.rows.length * (rh + gap) - gap + 3, H = yb + 16;
    const x0 = LW, x1 = W - 8, X = (t) => x0 + (Math.max(0, Math.min(t, T)) / T) * (x1 - x0);
    const up = o.upTo == null ? Infinity : o.upTo;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': o.aria || 'Timeline: time runs from left to right' });
    const per = (x1 - x0) / T, step = [1, 2, 5, 10, 20].find((k) => k * per >= 22) || 20;
    for (let t = 0; t <= T + 1e-9; t += step) svg.append(s('line', { x1: X(t), x2: X(t), y1: top - 2, y2: yb, class: 'gl' }), s('text', { x: X(t), y: yb + 13, 'text-anchor': 'middle', class: 'ax' }, String(t)));
    o.rows.forEach((lab, r) => svg.append(s('text', { x: 2, y: top + r * (rh + gap) + rh / 2 + 5, class: 'lbl' }, lab)));
    for (const g of o.segs) {
      if (g.a >= up) continue;
      const y = top + g.r * (rh + gap), w = X(Math.min(g.b, up)) - X(g.a);
      svg.append(s('rect', { x: X(g.a) + 0.5, y, width: Math.max(w - 1, 1), height: rh, rx: 3, class: g.cls, 'stroke-width': 1.5 }));
      if (g.text && w >= 14) svg.append(s('text', { x: X(g.a) + w / 2, y: y + rh / 2 + 1, class: 'bl' }, g.text));
    }
    if (o.cursor != null) svg.append(s('line', { x1: X(o.cursor), x2: X(o.cursor), y1: 0, y2: yb + 3, class: 'cur' }));
    return svg;
  }

  Guide.section({
    id: '10.1',
    title: 'Multiprocessor and Multicore Scheduling',
    short: 'Multiprocessor scheduling',
    summary: 'Many processors, one OS: who runs where, why a program’s threads run together, and why caches matter.',
    objectives: [
      'Tell loosely coupled, functionally specialized and tightly coupled multiprocessors apart, and classify parallelism by its granularity.',
      'Explain the three design issues of multiprocessor scheduling: assigning processes to processors (static or dynamic, master/slave or peer), multiprogramming each processor, and the dispatching policy.',
      'Compare load sharing, gang scheduling, dedicated processor assignment and dynamic scheduling of threads, and compute the processor time a gang schedule wastes.',
      'Explain how shared caches on a multicore chip change where threads should run: cooperative sharing, contention and affinity.',
    ],
    terms: [
      ['Loosely coupled multiprocessor', 'A group of fairly independent computers, each with its own main memory and I/O channels, that work together over a network or fast link. Clusters and distributed systems are built this way.'],
      ['Functionally specialized processors', 'A design in which one general-purpose main processor is helped by special-purpose processors, such as an I/O processor or a graphics processor, that work under its direction.'],
      ['Tightly coupled multiprocessor', 'Several processors that share one main memory and are controlled by a single operating system. Symmetric multiprocessors and multicore chips are tightly coupled.'],
      ['Granularity (synchronization granularity)', 'How often the parallel parts of an application must synchronize with each other, measured as the number of instructions executed between synchronization points. Fine grain means very often; coarse grain means rarely.'],
      ['Static assignment', 'Tying each process to one processor for its whole life, with a separate ready queue for each processor.'],
      ['Dynamic assignment', 'Letting a process run on whichever processor is free, usually by keeping one global ready queue that every processor takes work from.'],
      ['Load balancing', 'Moving waiting processes or threads from a busy processor’s queue to an idle processor, so that no processor sits idle while another has a backlog.'],
      ['Master/slave architecture', 'A multiprocessor OS design in which key kernel functions, scheduling included, always run on one master processor; the other (slave) processors run user programs and must ask the master for kernel services.'],
      ['Peer architecture', 'A multiprocessor OS design in which the kernel can run on any processor and each processor schedules itself from the pool of ready processes.'],
      ['Load sharing', 'Thread scheduling with one global queue of ready threads: whenever a processor is idle it takes the next thread from that queue. No thread is tied to a processor.'],
      ['Gang scheduling', 'Scheduling a set of related threads, usually the threads of one process, to run at the same moment on a set of processors, one thread per processor. The older name coscheduling covers the same idea; gang scheduling usually means the strict form, where the whole group runs together or not at all.'],
      ['Dedicated processor assignment', 'Giving an application as many processors as it has threads, for the whole of its run, so each thread has a processor to itself. A processor whose thread blocks simply sits idle.'],
      ['Dynamic scheduling', 'Thread scheduling in which the number of threads in a process can change while it runs: the OS divides the processors among the jobs, and each job decides which of its threads use its processors.'],
      ['Computer cluster', 'A group of complete, separate computers, each with its own memory and operating system, linked by a fast network and working together as if they were one bigger machine.'],
      ['Last-level cache (LLC)', 'The cache level closest to main memory, often shared by all the cores of a chip or of a cluster of cores. A miss there means a slow trip off the chip to main memory.'],
      ['Cooperative resource sharing', 'Threads that use the same data helping each other through a shared cache: on cores that share a cache, data one thread brings in is already there for the other.'],
      ['Resource contention', 'Threads competing for the same limited resource, here the space in a shared cache: each pushes the other’s data out, so both miss more often.'],
      ['Contention-aware scheduling', 'Placing threads on cores so that threads that would fight over cache space use different caches, which cuts slow trips to main memory.'],
      ['Soft affinity', 'A scheduler’s preference, not a strict rule, to run a thread again on the processor where it last ran, because that processor’s cache probably still holds its data. The scheduler may still move it to balance the load.'],
    ],
    css: `
      .sec-10-1 svg { display: block; }
      .sec-10-1 svg .pc0 { fill: color-mix(in srgb, var(--cpu) 30%, var(--panel)); stroke: var(--cpu); }
      .sec-10-1 svg .pc1 { fill: color-mix(in srgb, var(--mem) 30%, var(--panel)); stroke: var(--mem); }
      .sec-10-1 svg .pc2 { fill: color-mix(in srgb, var(--io) 30%, var(--panel)); stroke: var(--io); }
      .sec-10-1 svg .pc3 { fill: color-mix(in srgb, var(--os) 30%, var(--panel)); stroke: var(--os); }
      .sec-10-1 svg .pc4 { fill: color-mix(in srgb, var(--thread) 30%, var(--panel)); stroke: var(--thread); }
      .sec-10-1 svg .pc5 { fill: color-mix(in srgb, var(--proc) 30%, var(--panel)); stroke: var(--proc); }
      .sec-10-1 svg .idx { fill: var(--bad-bg); stroke: var(--bad); stroke-dasharray: 3 2; }
      .sec-10-1 svg .mig { stroke: var(--bad); stroke-dasharray: 4 2; stroke-width: 2.5px; }
      .sec-10-1 svg .gl { stroke: var(--line); stroke-width: 1; }
      .sec-10-1 svg .ax { font-size: 13px; fill: var(--muted); }
      .sec-10-1 svg .lbl { font-size: 14px; font-weight: 800; }
      .sec-10-1 svg .bl { font-size: 13px; font-weight: 800; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
      .sec-10-1 svg .cur { stroke: var(--accent); stroke-width: 2.5; }
      .sec-10-1 .tk { display: inline-flex; align-items: center; justify-content: center; gap: 3px; min-width: 30px; height: 28px; padding: 0 6px;
        border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); font-weight: 800; font-size: 14.5px; flex: none; }
      .sec-10-1 .tk.pc0 { background: color-mix(in srgb, var(--cpu) 20%, var(--panel)); border-color: var(--cpu); }
      .sec-10-1 .tk.pc1 { background: color-mix(in srgb, var(--mem) 20%, var(--panel)); border-color: var(--mem); }
      .sec-10-1 .tk.pc2 { background: color-mix(in srgb, var(--io) 20%, var(--panel)); border-color: var(--io); }
      .sec-10-1 .tk.pc3 { background: color-mix(in srgb, var(--os) 20%, var(--panel)); border-color: var(--os); }
      .sec-10-1 .tk.pc4 { background: color-mix(in srgb, var(--thread) 20%, var(--panel)); border-color: var(--thread); }
      .sec-10-1 .tk.pc5 { background: color-mix(in srgb, var(--proc) 20%, var(--panel)); border-color: var(--proc); }
      .sec-10-1 .tk small { font-weight: 600; font-size: 12.5px; color: var(--ink-2); }
      .sec-10-1 .lane { display: grid; grid-template-columns: 64px minmax(0, 1fr); align-items: center; gap: 8px; border: 1px solid var(--line);
        border-radius: 9px; padding: 3px 8px; background: var(--panel-2); min-height: 36px; }
      .sec-10-1 .lane .ln { font-weight: 800; font-size: 13.5px; line-height: 1.15; }
      .sec-10-1 .lane .ln small { display: block; font-weight: 600; font-size: 12.5px; color: var(--muted); }
      .sec-10-1 .lane .toks { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; min-height: 28px; }
      .sec-10-1 .lane .empty { font-size: 13px; color: var(--muted); font-style: italic; }
      .sec-10-1 .lane.warn { border-color: var(--bad); background: var(--bad-bg); }
      .sec-10-1 .msg { border-radius: 10px; padding: 8px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .sec-10-1 .msg.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-10-1 .msg.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-10-1 .msg.info { border-color: var(--accent); background: var(--accent-bg); }
      .sec-10-1 .msg b.h { display: block; font-size: 12.5px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2px; color: var(--accent); }
      .sec-10-1 .msg.ok b.h { color: var(--ok); } .sec-10-1 .msg.bad b.h { color: var(--bad); }
      .sec-10-1 .num { font-variant-numeric: tabular-nums; }
      .sec-10-1 .eq { font-family: var(--mono); font-size: 14.5px; background: var(--panel-3); border-radius: 8px; padding: 6px 10px; }
      .sec-10-1 table.tbl td.c, .sec-10-1 table.tbl th.c { text-align: center; }
      .sec-10-1 table.tbl td.r, .sec-10-1 table.tbl th.r { text-align: right; }
      .sec-10-1 .mw0 > * { min-width: 0; }
      .sec-10-1 .g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      .sec-10-1 .g4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .sec-10-1 .alane { display: grid; grid-template-columns: 34px 70px minmax(0, 1fr); align-items: center; gap: 6px; border: 1px solid var(--line);
        border-radius: 9px; padding: 2px 8px; background: var(--panel-2); min-height: 34px; }
      .sec-10-1 .alane.wide { grid-template-columns: 104px minmax(0, 1fr); }
      .sec-10-1 .alane.warn { border-color: var(--bad); background: var(--bad-bg); }
      .sec-10-1 .alane .nm { font-weight: 800; font-size: 14px; line-height: 1.1; }
      .sec-10-1 .alane .nm small { display: block; font-weight: 600; font-size: 12.5px; color: var(--muted); }
      .sec-10-1 .alane .rs { font-size: 13px; color: var(--muted); font-style: italic; }
      .sec-10-1 .alane .rs.bad { color: var(--bad); font-style: normal; font-weight: 800; }
      .sec-10-1 .alane .toks { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; min-height: 28px; }
      .sec-10-1 .alane .toks .empty { font-size: 13px; color: var(--muted); font-style: italic; }
      .sec-10-1 .player-cap { font-size: 14.5px; line-height: 1.4; }
      .sec-10-1 table.tbl.cmp td, .sec-10-1 table.tbl.cmp th { padding: 4px 7px; font-size: 13.5px; }
    `,
    steps: [
      /* ---------------- 1. Big picture: three kinds of multiprocessor ---------------- */
      {
        title: 'One operating system, many processors',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const W = ctx.narrow ? 360 : 560, H = 236;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img' });
          const desc = h('div', { class: 'msg info', style: { minHeight: '122px' } });
          const box = (x, y, w, hh, cls, lines, o = {}) => {
            const g = s('g', {}, s('rect', { x, y, width: w, height: hh, rx: 8, class: cls, 'stroke-width': 2 }));
            lines.forEach((ln, k) => g.append(s('text', { x: x + w / 2, y: y + hh / 2 + 5 + (k - (lines.length - 1) / 2) * 16, 'text-anchor': 'middle', 'font-size': o.fs || 14, 'font-weight': o.fw || 700 }, ln)));
            return g;
          };
          const KINDS = {
            loose: {
              label: 'Loosely coupled',
              draw() {
                const n = 3, gw = (W - 20) / n, bw = gw - 14;
                for (let k = 0; k < n; k++) {
                  const x = 10 + k * gw + 7;
                  svg.append(s('rect', { x, y: 8, width: bw, height: 168, rx: 12, class: 's-panel', 'stroke-width': 2 }),
                    s('text', { x: x + bw / 2, y: 28, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'Computer ' + (k + 1)),
                    box(x + 8, 38, bw - 16, 36, 's-cpu', ['CPU']), box(x + 8, 82, bw - 16, 36, 's-mem', ['Memory']), box(x + 8, 126, bw - 16, 36, 's-io', ['I/O']),
                    s('line', { x1: x + bw / 2, y1: 176, x2: x + bw / 2, y2: 204, class: 's-line' }));
                }
                svg.append(s('line', { x1: 20, y1: 204, x2: W - 20, y2: 204, class: 's-line', 'stroke-width': 3 }),
                  s('text', { x: W / 2, y: 226, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'network or fast link (messages only)'));
              },
              html: '<b>Each computer has its own memory and I/O</b> and its own copy of an OS. They cooperate only by sending messages. Examples: a <span class="t" data-t="Computer cluster">cluster</span>, a distributed system. Scheduling here is mostly about placing whole jobs on machines.',
            },
            func: {
              label: 'Functionally specialized',
              draw() {
                const mw = Math.min(300, W - 40);
                svg.append(box((W - mw) / 2, 10, mw, 50, 's-cpu', ['Main processor', '(general purpose, runs the OS)'], { fs: 14 }),
                  s('line', { x1: W / 2, y1: 60, x2: W / 2, y2: 96, class: 's-line' }),
                  s('line', { x1: 20, y1: 96, x2: W - 20, y2: 96, class: 's-line', 'stroke-width': 3 }),
                  s('text', { x: W - 22, y: 88, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'bus'));
                const items = [['s-mem', ['Memory']], ['s-io', ['I/O', 'processor']], ['s-thread', ['Graphics', 'processor']]];
                const gw = (W - 20) / 3, bw = gw - 16;
                items.forEach(([cls, lines], k) => {
                  const x = 10 + k * gw + 8;
                  svg.append(s('line', { x1: x + bw / 2, y1: 96, x2: x + bw / 2, y2: 122, class: 's-line' }), box(x, 122, bw, 56, cls, lines));
                });
                svg.append(s('text', { x: W / 2, y: 214, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'helpers do one kind of work for the main processor'));
              },
              html: '<b>One general-purpose processor is in charge.</b> Helper processors, such as an I/O processor or a graphics processor, each do one kind of work under its direction. The helpers are not scheduled as equals; they serve the main processor.',
            },
            tight: {
              label: 'Tightly coupled',
              draw() {
                svg.append(box(10, 6, W - 20, 30, 's-os', ['One operating system controls every processor']));
                const n = 4, gw = (W - 20) / n, bw = gw - 14;
                for (let k = 0; k < n; k++) {
                  const x = 10 + k * gw + 7;
                  svg.append(box(x, 48, bw, 38, 's-cpu', ['CPU ' + k]), box(x + 8, 92, bw - 16, 26, 's-panel', ['cache'], { fs: 13, fw: 600 }),
                    s('line', { x1: x + bw / 2, y1: 118, x2: x + bw / 2, y2: 140, class: 's-line' }));
                }
                svg.append(s('line', { x1: 20, y1: 140, x2: W - 20, y2: 140, class: 's-line', 'stroke-width': 3 }));
                const mw = (W - 50) * 0.62, iw = W - 50 - mw;
                svg.append(s('line', { x1: 20 + mw / 2, y1: 140, x2: 20 + mw / 2, y2: 162, class: 's-line' }), s('line', { x1: 30 + mw + iw / 2, y1: 140, x2: 30 + mw + iw / 2, y2: 162, class: 's-line' }),
                  box(20, 162, mw, 44, 's-mem', ['Shared main memory']), box(30 + mw, 162, iw, 44, 's-io', ['I/O']),
                  s('text', { x: W / 2, y: 228, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'any processor can run any process'));
              },
              html: '<b>Several processors share one main memory and one OS.</b> Any processor can run any process, so the OS must decide who runs where. Examples: a <span class="t" data-t="Symmetric multiprocessor (SMP)">symmetric multiprocessor</span> server and every multicore chip. <b>The rest of this section is about this kind.</b>',
            },
          };
          function show(k) {
            ctx.keep.kind = k;
            svg.replaceChildren();
            svg.setAttribute('aria-label', KINDS[k].label + ' multiprocessor diagram');
            KINDS[k].draw();
            say(desc, 'info', KINDS[k].label, KINDS[k].html);
          }
          const seg = ctx.ui.seg(Object.entries(KINDS).map(([value, v]) => ({ value, label: v.label })), ctx.keep.kind || 'tight', show);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'Chapter 9 scheduled <b>one</b> processor. Most computers now have several: a phone has about eight cores, and a server may have dozens.' }),
              h('p', { class: 'm0', html: 'With many processors the scheduler meets new questions. <b>Which</b> processor should run each process? Should the threads of one program run <b>at the same moment</b>? Which <span class="t" data-t="Cache memory (cache)">cache</span> already holds a thread’s data?' }),
              h('div', { class: 'callout analogy small m0', 'data-label': 'Analogy', html: 'A kitchen with several cooks. Does each cook get a private ticket rail, or do all pull from one shared rail? Should the cooks working on one table’s order cook at the same time, so the plates arrive together? And should a dish stay with the cook whose station already holds its ingredients?' }),
              h('div', { class: 'card tight small', html: '<b>In this section you will</b> sort workloads by how often their parts talk, hand out processes to processors, measure the waste of a gang schedule, and place threads on cores that share caches.' }),
              h('div', { class: 'row gap-s small' }, h('span', { class: 'chip proc' }, 'granularity'), h('span', { class: 'chip os' }, 'assignment'), h('span', { class: 'chip thread' }, 'thread scheduling'), h('span', { class: 'chip mem' }, 'shared caches'))),
            h('div', { class: 'card white stack', style: { gap: '10px' } },
              h('h4', { class: 'm0' }, 'Three ways to build a multiprocessor'),
              h('div', {}, seg), svg, desc)));
          show(ctx.keep.kind || 'tight');
        },
      },
      /* ---------------- 2. Granularity: ruler plus a sorting game ---------------- */
      {
        title: 'Granularity: how often must the parts synchronize?',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const G = [
            { name: 'Fine', range: 'fewer than 20 instructions', lo: 1, hi: 20, what: 'Parallelism <b>inside one instruction stream</b>: neighbouring instructions of one program overlap or run side by side.', sched: 'Far too frequent for the OS to schedule. Hardware and compilers exploit it (pipelines, several execution units, vector instructions).' },
            { name: 'Medium', range: '20 to 200 instructions', lo: 20, hi: 200, what: 'Parallel <b>threads of one application</b> that work on shared data and synchronize often.', sched: 'It <b>matters a lot</b>: if one thread is not running, its partners soon stall waiting for it. Most thread scheduling in this section targets this grain.' },
            { name: 'Coarse', range: '200 to 2,000 instructions', lo: 200, hi: 2000, what: '<b>Concurrent processes</b> in a multiprogrammed system that cooperate now and then.', sched: 'Runs much as on one processor, with little or no change to the software; simply more processes run at once.' },
            { name: 'Very coarse', range: '2,000 to about 1 million instructions', lo: 2000, hi: 1e6, what: '<b>Distributed processing</b>: parts of one computation spread over network nodes.', sched: 'Synchronization is rare and travels over the network, so it is handled like coarse grain.' },
            { name: 'Independent', range: 'no synchronization at all', lo: null, hi: null, what: '<b>Separate, unrelated processes</b>, such as the users of a time-sharing system.', sched: 'No special care: more processors simply run more of the ready processes at once, so average response time improves, much as on a multiprogrammed uniprocessor.' },
          ];
          const W = ctx.narrow ? 340 : 440, H = 92, x0 = 10, xn = 10 + (W - 20) * 0.74, xi0 = xn + 10, xi1 = W - 10;
          const X = (v) => x0 + (Math.log10(v) / 6) * (xn - x0);
          const ruler = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', style: { flex: 'none' }, 'aria-label': 'Grain sizes on a log scale of instructions between synchronizations' });
          const detail = h('div', { class: 'card white tight small', style: { minHeight: '128px' } });
          let sel = ctx.keep.sel ?? 1;
          function drawRuler() {
            ruler.replaceChildren();
            G.forEach((g, k) => {
              const a = g.lo ? X(g.lo) : xi0, b = g.hi ? X(g.hi) : xi1;
              ruler.append(s('rect', { x: a, y: 22, width: b - a, height: 30, rx: 4, class: 'pc' + k, 'stroke-width': k === sel ? 3.5 : 1.2, opacity: k === sel ? 1 : 0.55 }));
              if (g.name.length * 7.3 <= b - a - 4) ruler.append(s('text', { x: (a + b) / 2, y: 42, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, g.name));
            });
            [[1, '1'], [20, '20'], [200, '200'], [2000, '2,000'], [1e6, '1M']].forEach(([v, t]) => ruler.append(s('line', { x1: X(v), x2: X(v), y1: 52, y2: 58, class: 's-line', 'stroke-width': 1.5 }), s('text', { x: X(v), y: 72, 'text-anchor': 'middle', class: 'ax' }, t)));
            ruler.append(s('text', { x: (xi0 + xi1) / 2, y: 72, 'text-anchor': 'middle', class: 'ax' }, 'never'),
              s('text', { x: 10, y: 14, 'font-size': 13, class: 's-sub' }, 'instructions between synchronizations (log scale)'),
              s('text', { x: W / 2, y: 88, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, '← talk often · talk rarely →'));
            const g = G[sel];
            detail.innerHTML = `<div class="row" style="justify-content:space-between"><b style="font-size:16px">${g.name} grain</b><span class="chip accent">${g.range}</span></div><p class="m0" style="margin-top:4px">${g.what}</p><p class="m0" style="margin-top:4px"><b>Scheduling:</b> ${g.sched}</p>`;
          }
          const seg = ctx.ui.seg(G.map((g, k) => ({ value: k, label: g.name })), sel, (v) => { sel = +v; ctx.keep.sel = sel; drawRuler(); });

          /* the sorting game */
          const ITEMS = [
            { t: 'Four threads of one photo filter each process a strip of the picture and swap the pixels along their shared edges about every 100 instructions.', g: 1, why: 'Threads of one application that synchronize every 20–200 instructions: <b>medium</b> grain. If one strip’s thread is not running, its neighbours stall at the edge swap.' },
            { t: 'Forty students are logged in to one time-sharing server. Each runs an editor or compiler of their own, and the programs never exchange data.', g: 4, why: 'Unrelated processes that never synchronize: <b>independent</b> parallelism. The extra processors simply serve more users at once.' },
            { t: 'Inside one loop body, four additions that do not depend on each other run side by side in a core’s execution units; their results are combined a few instructions later.', g: 0, why: 'Parallelism inside a single instruction stream, synchronizing every few instructions (well under 20): <b>fine</b> grain, exploited by hardware and the compiler.' },
            { t: 'Sixty computers in a cluster each search one slice of a huge data set and report partial results over the network roughly every 500,000 instructions.', g: 3, why: 'Parts of one computation on network nodes, synchronizing every 2,000 to 1 million instructions: <b>very coarse</b> grain.' },
            { t: 'In a multiprogrammed system, a producer process hands buffers of data to a consumer process through a pipe about once every 1,000 instructions.', g: 2, why: 'Concurrent processes that cooperate every 200–2,000 instructions: <b>coarse</b> grain. They run well on a multiprocessor without special scheduling.' },
            { t: 'The threads of one spreadsheet recalculation share running totals and must agree on them roughly every 50 instructions.', g: 1, why: 'Threads of one application synchronizing every 20–200 instructions: <b>medium</b> grain.' },
            { t: 'A climate model is split across machines in different buildings; neighbouring machines trade boundary values over the network about every 50,000 instructions.', g: 3, why: 'Parts of one computation on network nodes, between 2,000 and 1 million instructions apart: <b>very coarse</b> grain.' },
            { t: 'Three cooperating processes of one batch job update a shared table, each checking in with the others about every 1,500 instructions.', g: 2, why: 'Separate processes cooperating every 200–2,000 instructions: <b>coarse</b> grain.' },
          ];
          const st = ctx.keep.game || (ctx.keep.game = { i: 0, picks: [] });
          const prog = h('span', { class: 'small b' }), score = h('span', { class: 'chip ok' });
          const card = h('div', { class: 'card tight', style: { minHeight: '84px', fontSize: '17px', lineHeight: '1.45' } });
          const dots = h('div', { class: 'row gap-s' });
          const btnRow = h('div', { class: 'row gap-s' });
          const fb = h('div', { class: 'msg', style: { minHeight: '96px' } });
          const nextBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (st.picks.length > st.i) { st.i++; draw(); } } }, 'Next workload');
          const resetBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { st.i = 0; st.picks = []; draw(); } }, 'Start over');
          const gBtns = G.map((g, k) => h('button', { class: 'btn sm', type: 'button', onclick: () => answer(k) }, g.name));
          btnRow.append(...gBtns);
          function answer(k) {
            if (st.picks.length > st.i || st.i >= ITEMS.length) return;
            st.picks.push(k);
            sel = ITEMS[st.i].g; seg.set(sel); ctx.keep.sel = sel; drawRuler();
            draw();
          }
          function draw() {
            const right = st.picks.filter((p, k) => p === ITEMS[k].g).length;
            score.textContent = `${right} / ${st.picks.length} right`;
            dots.replaceChildren(h('span', { class: 'xs muted b' }, 'YOUR SORTS'), ...ITEMS.map((it, k) => k < st.picks.length ? h('span', { class: 'chip ' + (st.picks[k] === it.g ? 'ok' : 'bad'), title: 'Workload ' + (k + 1) }, `${k + 1} ${st.picks[k] === it.g ? '✓' : '✗'}`) : h('span', { class: 'chip' }, String(k + 1))));
            if (st.i >= ITEMS.length) {
              prog.textContent = 'All eight sorted';
              card.innerHTML = right === ITEMS.length ? '<b>Perfect sort.</b> You can read a workload’s grain from two clues: <i>who</i> is synchronizing (instructions, threads, processes, network nodes, nobody) and <i>how often</i>.' : `<b>${right} of 8 right.</b> The two clues are <i>who</i> synchronizes (instructions, threads, processes, network nodes, nobody) and <i>how often</i>. Start over to try again.`;
              gBtns.forEach((b) => { b.disabled = true; b.classList.remove('on'); });
              say(fb, right === ITEMS.length ? 'ok' : 'info', 'Done', 'Medium-grained threads are the ones whose scheduling needs the most care, and the rest of this section is largely about them.');
              nextBtn.disabled = true;
              return;
            }
            const it = ITEMS[st.i], done = st.picks.length > st.i, pick = st.picks[st.i];
            prog.textContent = `Workload ${st.i + 1} of ${ITEMS.length}`;
            card.textContent = it.t;
            gBtns.forEach((b, k) => { b.disabled = done; b.classList.toggle('on', done && k === it.g); });
            if (!done) say(fb, '', 'Your call', 'Which grain is this? Look at who synchronizes and how often. The ruler shows the ranges.');
            else if (pick === it.g) say(fb, 'ok', 'Right', it.why);
            else say(fb, 'bad', `Not ${G[pick].name.toLowerCase()} grain`, it.why);
            nextBtn.disabled = !done;
            nextBtn.textContent = st.i === ITEMS.length - 1 ? 'See result' : 'Next workload';
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'Parallel pieces of work differ in <b>how often they must stop and coordinate</b>.' }),
              h('p', { class: 'm0 small', html: 'That rate is the <span class="t" data-t="Granularity (synchronization granularity)">granularity</span>: the number of instructions run between two synchronization points. Five grain sizes are usually named. Pick one to see what it looks like and what it asks of the scheduler.' }),
              h('div', {}, seg), ruler, detail),
            h('div', { class: 'card white stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Sort the workloads'), score),
              prog, card, btnRow, fb, h('div', { class: 'row gap-s' }, nextBtn, resetBtn), dots,
              h('div', { class: 'callout tip small m0', 'data-label': 'Two clues', html: '<b>Who</b> synchronizes (instructions of one stream, threads of one program, separate processes, network nodes, or nobody) and <b>how often</b>.' }))));
          drawRuler();
          draw();
        },
      },
      /* ---------------- 3. Design issue 1: assignment (two tabs) ---------------- */
      {
        title: 'Design issue 1: which processor runs which process?',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const K = ctx.keep;
          const MODES = {
            static: { label: 'Static queues', short: 'Static' },
            global: { label: 'One global queue', short: 'Global queue' },
            balance: { label: 'Load balancing', short: 'Balancing' },
          };
          /* Tab 1: the same twelve processes handed out three ways */
          function tabAssign(panel) {
            let mode = K.amode || 'static', seed = K.aseed || ASSIGN_SEED, procs, sims, sim;
            const W = ctx.narrow ? 360 : 700;
            const lanes = h('div', { class: 'stack', style: { gap: '4px' } }), chart = h('div'), tbl = h('div'), wl = h('p', { class: 'xs muted m0' });
            const name = (i) => LET[i];
            function load() {
              procs = assignWorkload(seed);
              sims = { static: simAssign(procs, 'static'), global: simAssign(procs, 'global'), balance: simAssign(procs, 'balance') };
              sim = sims[mode];
              wl.innerHTML = '<b>Workload</b> (arrival, service): ' + procs.map((p, i) => `${name(i)} (${p.arr}, ${p.svc})`).join(' · ');
              tbl.replaceChildren(h('table', { class: 'tbl cmp' },
                h('tr', {}, h('th', {}, 'This workload'), h('th', { class: 'r' }, 'Done at'), h('th', { class: 'r' }, 'Mean Tr'), h('th', { class: 'r', title: 'processor-time units spent idle while a process waited in some queue' }, 'Idle·wait')),
                ...Object.keys(MODES).map((m) => h('tr', { class: m === mode ? 'on' : '' }, h('td', {}, MODES[m].short), h('td', { class: 'r num' }, String(sims[m].makespan)),
                  h('td', { class: 'r num' }, f2(sims[m].meanTr)), h('td', { class: 'r num', style: { color: sims[m].idleWait ? 'var(--bad)' : null, fontWeight: 700 } }, String(sims[m].idleWait))))),
                h('p', { class: 'xs muted m0', style: { marginTop: '4px' } }, 'Idle·wait: processor-time units a processor sat idle while a process waited in some queue (red dashed cells on the timeline).'));
            }
            function draw(i) {
              const f = sim.frames[i], t = f.t, last = i === sim.frames.length - 1;
              const rows = [];
              rows.push(h('div', { class: 'alane wide' }, h('div', { class: 'nm' }, 'Global queue'),
                h('div', { class: 'toks' }, ...(mode !== 'global' ? [h('span', { class: 'empty' }, 'not used: each processor has its own queue')] : f.gq.length ? f.gq.map((p) => tok(ctx, name(p), p, procs[p].svc)) : [h('span', { class: 'empty' }, 'empty')]))));
              for (let c = 0; c < 4; c++) {
                const r = f.run[c], idle = f.idle.includes(c);
                rows.push(h('div', { class: 'alane' + (idle ? ' warn' : '') }, h('div', { class: 'nm' }, 'P' + (c + 1)),
                  r ? tok(ctx, name(r.i), r.i, r.rem) : h('span', { class: 'rs' + (idle ? ' bad' : '') }, idle ? 'idle!' : 'idle'),
                  h('div', { class: 'toks' }, ...(mode === 'global' ? [h('span', { class: 'empty' }, '—')] : f.qs[c].length ? f.qs[c].map((p) => tok(ctx, name(p), p, procs[p].svc)) : [h('span', { class: 'empty' }, 'queue empty')]))));
              }
              lanes.replaceChildren(...rows);
              chart.replaceChildren(timeline(ctx, { W, T: Math.max(sims.static.T, sims.global.T, sims.balance.T), rows: ['P1', 'P2', 'P3', 'P4'], rowH: 16, gap: 3, upTo: last ? sim.T : t + 1, cursor: last ? null : t,
                segs: sim.segs.filter((g) => g.p !== -1).reduce((acc, g) => { const l = acc.filter((x) => x.c === g.c).pop(); if (l && l.p === g.p && l.b === g.a) l.b = g.b; else acc.push({ ...g }); return acc; }, [])
                  .map((g) => ({ r: g.c, a: g.a, b: g.b, cls: g.p === -2 ? 'idx' : 'pc' + (g.p % 6), text: g.p >= 0 ? name(g.p) : '' })), aria: 'Which process each processor ran, unit by unit' }));
              /* caption, built from the simulation's own events */
              const ev = f.ev, out = [];
              const fins = ev.filter((e) => e.k === 'fin').map((e) => `<b>${name(e.p)}</b>`);
              if (fins.length) out.push(`${andList(fins)} finish${fins.length === 1 ? 'es' : ''}.`);
              const arr = ev.filter((e) => e.k === 'arr');
              if (arr.length) out.push(mode === 'global' ? `${andList(arr.map((e) => `<b>${name(e.p)}</b>`))} arrive${arr.length === 1 ? 's' : ''} and join${arr.length === 1 ? 's' : ''} the global queue.`
                : `Arrivals are tied to the processor holding the fewest processes: ${arr.map((e) => `<b>${name(e.p)}</b> → P${e.c + 1}`).join(', ')}.`);
              ev.filter((e) => e.k === 'pull').forEach((e) => out.push(`P${e.c + 1} has nothing to do, so it <b>pulls ${name(e.p)}</b> from P${e.from + 1}’s queue (a migration).`));
              if (last) out.push(`<b>All done at t = ${sim.T}.</b> Mean turnaround ${f2(sim.meanTr)}; processors sat idle while work waited for <b>${sim.idleWait}</b> processor-time unit${sim.idleWait === 1 ? '' : 's'}.` + (mode === 'static' ? ' Now switch to a global queue.' : ''));
              else if (f.idle.length) {
                const busy = []; f.qs.forEach((q, c) => { if (q.length) busy.push(`P${c + 1}’s queue holds ${andList(q.map((p) => `<b>${name(p)}</b>`))}`); });
                out.push(`<span style="color:var(--bad);font-weight:700">${andList(f.idle.map((c) => 'P' + (c + 1)))} ${f.idle.length === 1 ? 'is' : 'are'} idle</span> while ${andList(busy)}. Static assignment forbids helping.`);
              } else if (!out.length) out.push('Every processor is busy; nothing changes this unit.');
              return `<b>t = ${t}.</b> ` + out.join(' ');
            }
            load();
            const player = ctx.ui.player({ count: sim.frames.length, render: (i) => draw(i), interval: 1300, speed: false });
            const segM = ctx.ui.seg(Object.entries(MODES).map(([value, v]) => ({ value, label: v.label })), mode, (v) => { mode = v; K.amode = v; sim = sims[mode]; load(); player.setCount(sim.frames.length); });
            const newBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { seed++; K.aseed = seed; load(); player.setCount(sim.frames.length); } }, 'New arrivals');
            const stdBtn = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { seed = ASSIGN_SEED; K.aseed = seed; load(); player.setCount(sim.frames.length); } }, 'Standard');
            panel.append(h('div', { class: 'split l3 fill' },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0 small', html: '<b><span class="t">Static assignment</span></b>: a new process is tied to one processor for life, and each processor has its <b>own ready queue</b>. Cheap (the choice of processor is made once, and no shared queue must be locked) and it makes gang scheduling easy, but a processor can sit <b>idle while another has a backlog</b>.' }),
                h('p', { class: 'm0 small', html: '<b><span class="t">Dynamic assignment</span></b>: one <b>global queue</b>; any free processor takes the next process. Or keep per-processor queues and let an idle processor pull work from a busy one: <span class="t">load balancing</span>. The price: a shared queue must be locked, and a moved process finds a cold cache (one that holds none of its data yet).' }),
                tbl),
              h('div', { class: 'stack', style: { gap: '6px' } },
                h('div', { class: 'row gap-s' }, segM, newBtn, stdBtn), wl, lanes, chart, player.el)));
            return () => player.stop();
          }
          /* Tab 2: where does the kernel run? Model: each process needs 1 unit of kernel work for every 4 units of its own work. */
          function tabArch(panel) {
            const { s } = ctx;
            const KER = 0.25;
            let arch = K.arch || 'ms', n = K.n || 4, failed = !!K.failed, race = K.race || null;
            const W = ctx.narrow ? 360 : 700, perRow = ctx.narrow ? 4 : 8;
            const svg = s('svg', { width: '100%', role: 'img', 'aria-label': 'Processors and where the kernel runs' });
            const bars = h('div', { class: 'stack', style: { gap: '4px' } }), msg = h('div', { class: 'msg', style: { minHeight: '66px' } }), raceOut = h('div', { class: 'small', style: { minHeight: '88px' } });
            const model = (a, nn, fail) => {
              if (a === 'ms') { if (fail) return { work: 0, load: 0 }; const work = Math.min(nn - 1, 1 / KER); return { work, load: work * KER, sat: (nn - 1) * KER > 1 }; }
              const alive = fail ? nn - 1 : nn; return { work: alive / (1 + KER), load: null };
            };
            function drawSvg() {
              const rows = Math.ceil(n / perRow), bw = Math.min(110, (W - 20) / Math.min(n, perRow) - 8), bh = 44, gx = 8;
              const H = rows * (bh + 10) + 54;
              svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.replaceChildren();
              const pos = [], boxes = s('g');
              for (let c = 0; c < n; c++) {
                const r = Math.floor(c / perRow), k = c % perRow, inRow = Math.min(perRow, n - r * perRow);
                const x = (W - inRow * (bw + gx) + gx) / 2 + k * (bw + gx), y = 6 + r * (bh + 10);
                pos.push([x + bw / 2, y + bh]);
                const dead = failed && c === 0, master = arch === 'ms' && c === 0;
                boxes.append(s('rect', { x, y, width: bw, height: bh, rx: 8, class: dead ? 's-bad' : master ? 's-os' : 's-cpu', 'stroke-width': 2 }),
                  s('text', { x: x + bw / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'CPU ' + c),
                  s('text', { x: x + bw / 2, y: y + 36, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, dead ? '✗ failed' : arch === 'peer' ? (bw >= 100 ? 'kernel + user' : 'peer') : master ? 'master' : 'slave'));
              }
              const ky = rows * (bh + 10) + 16;
              if (arch === 'ms') {
                const [mx, my] = pos[0];
                svg.append(s('rect', { x: 10, y: ky, width: W - 20, height: 32, rx: 8, class: failed ? 's-bad' : 's-os', 'stroke-width': 2 }),
                  s('text', { x: W / 2, y: ky + 21, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, failed ? 'Kernel unreachable: the master is down' : 'Kernel + scheduler: run only on CPU 0'),
                  s('line', { x1: mx, y1: my, x2: mx, y2: ky, class: 's-line' }));
                pos.slice(1).forEach(([x, y]) => svg.append(s('line', { x1: x, y1: y, x2: x, y2: ky, class: 's-muted', 'stroke-dasharray': '4 3' })));
              } else {
                svg.append(s('rect', { x: 10, y: ky, width: W - 20, height: 32, rx: 8, class: 's-os', 'stroke-width': 2 }),
                  s('text', { x: W / 2, y: ky + 21, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, ctx.narrow ? 'Shared kernel + locked ready queue' : 'Shared kernel code + one ready queue (guarded by a lock)'));
                pos.forEach(([x, y], c) => svg.append(s('line', { x1: x, y1: y, x2: x, y2: ky, class: failed && c === 0 ? 's-muted' : 's-line' })));
              }
              svg.append(boxes);
            }
            function bar(label, v, on, note) {
              return h('div', { class: 'row nw gap-s small', style: { fontWeight: on ? 800 : 500 }, title: note || null },
                h('span', { style: { width: ctx.narrow ? '92px' : '108px', flex: 'none' } }, label),
                h('div', { class: 'meter grow' }, h('i', { style: { width: (v / 8) * 100 + '%', background: on ? 'var(--chc)' : 'var(--line-2)' } })),
                h('span', { class: 'num', style: { width: ctx.narrow ? '76px' : '220px', flex: 'none' } }, f1(v) + ' units' + (note && !ctx.narrow ? ' · ' + note : '')));
            }
            function update() {
              K.arch = arch; K.n = n; K.failed = failed;
              drawSvg();
              const ms = model('ms', n, failed), pe = model('peer', n, failed);
              bars.replaceChildren(h('div', { class: 'xs muted' }, 'Useful (user) work finished per time unit, same processors:'),
                bar('Master/slave', ms.work, arch === 'ms', failed ? 'stopped' : `master ${pct(ms.load, 0)} busy`), bar('Peer', pe.work, arch === 'peer', failed ? 'CPU 0 lost' : 'no master'));
              if (arch === 'ms') {
                if (failed) say(msg, 'bad', 'Single point of failure', 'The master has failed. Slaves cannot get any kernel service, not even scheduling, so the <b>whole system stops</b>.');
                else if (ms.sat) say(msg, 'bad', 'Bottleneck', `${n - 1} slaves need ${f1((n - 1) * KER)} units of kernel work per time unit; the master can do only 1. Slaves queue for it, so useful work is stuck at ${f1(ms.work)} however many processors you add.`);
                else say(msg, 'info', 'Master/slave', `The master spends ${pct(ms.load, 0)} of its time serving ${n - 1} slave${n === 2 ? '' : 's'} and runs no user work of its own. Add processors and watch its load climb.`);
              } else {
                if (failed) say(msg, 'ok', 'Peer survives', `CPU 0 has failed, but any processor can run the kernel, so the other ${n - 1} keep working: the system slows down instead of stopping.`);
                else say(msg, 'ok', 'Peer', `Every processor runs kernel code for itself, so no single processor limits the others. The new danger is the <b>shared ready queue</b>: two processors must never take the same process. Try the race below.`);
              }
              drawRace();
            }
            /* the race on the shared ready queue: two processors look for work at the same instant */
            function runRace(lock) {
              const q = ['X', 'Y', 'Z'], steps = [];
              if (!lock) {
                const a = q[0]; steps.push(`CPU 1 reads the head of the ready queue: <b>${a}</b>.`);
                const b = q[0]; steps.push(`CPU 2 reads the head too, before CPU 1 has removed it: <b>${b}</b>.`);
                q.shift(); steps.push(`CPU 1 removes the head and runs <b>${a}</b>.`);
                const lost = q.shift(); steps.push(`CPU 2 removes the head, which is now <b>${lost}</b>, but runs <b>${b}</b>.`);
                return { steps, ok: false, end: `<b>${a}</b> runs on two processors at once and <b>${lost}</b> has vanished: it is in no queue and will never run.` };
              }
              steps.push('CPU 1 acquires the queue lock.', 'CPU 2 tries the lock, finds it held and spins.');
              const a = q.shift(); steps.push(`CPU 1 removes <b>${a}</b>, releases the lock and runs ${a}.`);
              const b = q.shift(); steps.push(`CPU 2 gets the lock, removes <b>${b}</b>, releases it and runs ${b}.`);
              return { steps, ok: true, end: `Each process was taken exactly once; ${q.join(', ')} still waits. The lock serializes access to the queue.` };
            }
            function drawRace() {
              K.race = race;
              if (arch === 'ms') { raceOut.innerHTML = '<span class="muted">In master/slave only the master’s scheduler touches the ready queue, so two processors can never race for it.</span>'; return; }
              if (!race) { raceOut.innerHTML = '<span class="muted">Ready queue: X, Y, Z. CPU 1 and CPU 2 both fall idle at the same instant. Pick a version.</span>'; return; }
              const r = runRace(race === 'lock');
              raceOut.innerHTML = '<ol class="m0" style="padding-left:20px">' + r.steps.map((x) => `<li>${x}</li>`).join('') + `</ol><div style="color:var(--${r.ok ? 'ok' : 'bad'});font-weight:700">${r.ok ? '✓' : '✗'} ${r.end}</div>`;
            }
            const segA = ctx.ui.seg([{ value: 'ms', label: 'Master/slave' }, { value: 'peer', label: 'Peer' }], arch, (v) => { arch = v; update(); });
            const sl = ctx.ui.slider({ label: 'Processors', min: 2, max: 8, value: n, onInput: (v) => { n = v; update(); } });
            const failBtn = h('button', { class: 'btn sm danger', type: 'button', 'aria-pressed': String(failed), onclick: () => { failed = !failed; failBtn.setAttribute('aria-pressed', String(failed)); failBtn.textContent = failed ? 'Repair CPU 0' : 'Fail CPU 0'; update(); } }, failed ? 'Repair CPU 0' : 'Fail CPU 0');
            const rb = (lock, label) => h('button', { class: 'btn sm', type: 'button', onclick: () => { if (arch === 'ms') { arch = 'peer'; segA.set('peer'); } race = lock ? 'lock' : 'nolock'; update(); } }, label);
            panel.append(h('div', { class: 'split l3 fill' },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0 small', html: '<b><span class="t">Master/slave architecture</span></b>: key kernel functions, scheduling included, always run on one <b>master</b>. The <b>slaves</b> run user programs and must ask the master for every kernel service. Simple (barely changed from a one-processor OS, and one processor controls memory and I/O, so conflicts are easy to settle), but the master is a <b>bottleneck</b> and a <b>single point of failure</b>.' }),
                h('p', { class: 'm0 small', html: '<b><span class="t">Peer architecture</span></b>: the kernel can run on <b>any</b> processor, and each processor schedules itself from the pool of ready processes. Harder to build: two processors must never choose the same process, and no process may be lost from a queue.' }),
                h('div', { class: 'callout tip small m0', 'data-label': 'Today', html: 'General-purpose kernels such as Linux, Windows and macOS take the peer approach.' }),
                h('p', { class: 'xs muted m0' }, 'Model used in the diagram: every process needs 1 unit of kernel work for each 4 units of its own work, and the master runs no user work.')),
              h('div', { class: 'stack', style: { gap: '6px' } },
                h('div', { class: 'row gap-s' }, segA, h('div', { style: { minWidth: '230px', flex: '1' } }, sl), failBtn),
                svg, bars, msg,
                h('div', { class: 'card tight', style: { padding: '6px 10px' } }, h('div', { class: 'row gap-s', style: { marginBottom: '4px' } }, h('b', { class: 'small' }, 'Race for the ready queue:'), rb(false, 'Without a lock'), rb(true, 'With a lock')), raceOut))));
            update();
          }
          el.append(ctx.ui.tabs([
            { label: 'Static or dynamic assignment', render: (p) => tabAssign(p) },
            { label: 'Master/slave or peer kernel', render: (p) => tabArch(p) },
          ], { initial: K.tab || 0, onChange: (i) => { K.tab = i; } }));
        },
      },
      /* ---------------- 4. Design issues 2 and 3: multiprogramming and the dispatching policy ---------------- */
      {
        title: 'Design issues 2 and 3: does the policy still matter?',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const K = ctx.keep;
          let vari = K.vari || 'high', seed = K.dseed || 1, rows = [];
          const W = ctx.narrow ? 360 : 600, H = 230;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', style: { flex: 'none' }, 'aria-label': 'Mean turnaround time of FCFS and round robin for 1, 2, 4 and 8 processors' });
          const msg = h('div', { class: 'msg', style: { minHeight: '92px' } });
          /* gap(r): the losing policy and how much longer its mean turnaround is than the winner's (as a fraction) */
          const gap = (r) => { const a = r.fcfs.tr, b = r.rr.tr; return { win: a <= b ? 'FCFS' : 'RR', lose: a <= b ? 'RR' : 'FCFS', g: Math.abs(a - b) / Math.min(a, b) }; };
          function draw() {
            K.vari = vari; K.dseed = seed;
            rows = dispTable(vari, seed);
            const max = Math.max(...rows.map((r) => Math.max(r.fcfs.tr, r.rr.tr)));
            const top = Math.ceil(max / 10) * 10, x0 = 40, x1 = W - 8, y0 = 14, y1 = H - 40, Y = (v) => y1 - (v / top) * (y1 - y0);
            svg.replaceChildren();
            for (let v = 0; v <= top; v += top / 5) svg.append(s('line', { x1: x0, x2: x1, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: x0 - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'ax' }, String(Math.round(v))));
            const gw = (x1 - x0) / rows.length, bw = Math.min(52, gw / 2.6);
            rows.forEach((r, k) => {
              const cx = x0 + gw * (k + 0.5);
              [[r.fcfs.tr, 'pc0', -1], [r.rr.tr, 'pc4', 1]].forEach(([v, cls, side]) => {
                const x = cx + (side < 0 ? -bw - 2 : 2);
                svg.append(s('rect', { x, y: Y(v), width: bw, height: y1 - Y(v), rx: 3, class: cls, 'stroke-width': 1.5 }),
                  s('text', { x: x + bw / 2, y: Y(v) - 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, f1(v)));
              });
              svg.append(s('text', { x: cx, y: y1 + 17, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, r.m + (ctx.narrow ? ' CPU' : r.m === 1 ? ' processor' : ' processors')),
                s('text', { x: cx, y: y1 + 33, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, gap(r).lose + (ctx.narrow ? ' +' : ' ') + pct(gap(r).g, 0) + (ctx.narrow ? '' : ' longer')));
            });
            svg.append(s('line', { x1: x0, x2: x1, y1, y2: y1, class: 's-line', 'stroke-width': 1.5 }));
            const a = gap(rows[0]), b = gap(rows[rows.length - 1]);
            say(msg, 'info', vari === 'high' ? 'Very mixed sizes' : 'Similar sizes',
              (vari === 'high' ? 'On one processor, short processes get stuck behind long ones under FCFS, so round robin wins clearly. '
                : 'When every process needs about the same time, FCFS wins: round robin’s interleaving delays everyone’s finish. ')
              + `${a.lose}’s mean turnaround is <b>${pct(a.g, 0)}</b> longer with 1 processor but only <b>${pct(b.g, 0)}</b> longer with 8: with more processors, a short process rarely waits long for <i>some</i> processor to free up, whatever the policy.`);
          }
          const segV = ctx.ui.seg([{ value: 'low', label: 'Similar sizes' }, { value: 'high', label: 'Very mixed sizes' }], vari, (v) => { vari = v; draw(); });
          /* the runs cycle through seeds 1-60, each checked to show the same pattern (winner unchanged, gap shrinking 1 → 2 → 4 → 8) */
          seed = ((seed - 1) % 60 + 60) % 60 + 1;
          const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { seed = (seed % 60) + 1; draw(); } }, 'New random run');
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('h3', { class: 'm0' }, 'Issue 2: multiprogram each processor?'),
              h('p', { class: 'm0 small', html: 'For coarse-grained or independent work, <b>yes</b>: each processor switches among many processes to stay busy, just as in chapter 9. For a medium-grained application spread over many processors, keeping <i>every</i> processor busy matters less than letting the application’s threads run <b>together</b>, so a briefly idle processor can be the better deal.' }),
              h('h3', { class: 'm0' }, 'Issue 3: which dispatching policy?'),
              h('p', { class: 'm0 small', html: 'Classic process scheduling uses <b>one global queue</b> (or one queue per priority level) that feeds <b>every</b> processor, like one line in front of many bank tellers. The clever policies of chapter 9 pay off far less here: with several processors, plain <span class="t" data-t="First-come-first-served (FCFS)">FCFS</span> is often good enough, and a simpler policy also costs less overhead. (Linux and FreeBSD keep a queue per processor and balance the load instead; see 10.3 and 10.5.)' }),
              h('div', { class: 'callout why small m0', 'data-label': 'Why', html: 'On one processor a short job stuck behind a long one must wait for the whole long job. With several processors, <i>another</i> processor soon frees up and takes it.' }),
              h('p', { class: 'xs muted m0' }, 'A classic simulation study found the same pattern: the difference between FCFS and round robin is smaller with two processors than with one, and the experiment here shows it keeps shrinking.')),
            h('div', { class: 'card white stack', style: { gap: '7px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Experiment: FCFS vs round robin'), h('div', { class: 'row gap-s' }, h('span', { class: 'tk pc0' }, 'FCFS'), h('span', { class: 'tk pc4' }, 'RR'))),
              h('div', { class: 'row gap-s' }, segV, again),
              h('p', { class: 'xs muted m0' }, 'Mean turnaround time (Tr) of 4,000 processes, simulated live. Random arrivals keep each processor about 80% busy; one global queue; RR quantum 1, no switching cost. Under each pair: how much longer the losing policy’s mean Tr is.'),
              svg, msg)));
          draw();
        },
      },
      /* ---------------- 5. Thread scheduling 1: load sharing ---------------- */
      {
        title: 'Thread scheduling 1: load sharing from one global queue',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const K = ctx.keep;
          const POLS = { fcfs: 'FCFS', sntf: 'Smallest number first', psntf: 'Preemptive smallest first' };
          const JN = 'ABC', TN = (j, k) => JN[j] + (k + 1);
          let pol = K.lpol || 'fcfs';
          const all = { fcfs: simLS(LS_JOBS, 'fcfs'), sntf: simLS(LS_JOBS, 'sntf'), psntf: simLS(LS_JOBS, 'psntf') };
          const TT = Math.max(...Object.values(all).map((r) => r.T));
          let sim = all[pol];
          const W = ctx.narrow ? 360 : 700;
          const qLane = h('div'), runLane = h('div'), chart = h('div'), stats = h('div', { class: 'row gap-s small' });
          function draw(i) {
            const f = sim.frames[i], t = f.t, last = i === sim.frames.length - 1;
            qLane.replaceChildren(h('div', { class: 'alane wide' }, h('div', { class: 'nm' }, 'Global queue'),
              h('div', { class: 'toks' }, ...(f.q.length ? f.q.map((x) => tok(ctx, TN(x.j, x.k), x.j)) : [h('span', { class: 'empty' }, 'empty')]))));
            runLane.replaceChildren(h('div', { class: 'alane wide' }, h('div', { class: 'nm' }, 'Running'),
              h('div', { class: 'toks' }, ...f.run.map((x, c) => h('span', { class: 'row', style: { gap: '3px', marginRight: '8px' } }, h('b', { class: 'small' }, 'P' + (c + 1) + ':'), x ? tok(ctx, TN(x.j, x.k), x.j, x.rem) : h('span', { class: 'empty' }, 'idle'))))));
            chart.replaceChildren(timeline(ctx, { W, T: TT, rows: ['P1', 'P2', 'P3'], rowH: 34, gap: 8, upTo: last ? TT : t + 1, cursor: last ? null : t,
              segs: sim.segs.map((g) => ({ r: g.c, a: g.a, b: g.b, cls: g.mig ? 'pc' + g.j + ' mig' : 'pc' + g.j, text: TN(g.j, g.k) + (g.mig ? '↻' : '') })), aria: 'Which thread each processor ran' }));
            const out = [];
            const fins = f.ev.filter((e) => e.k === 'fin').map((e) => '<b>' + TN(e.j, e.th) + '</b>');
            if (fins.length) out.push(`${andList(fins)} finish${fins.length === 1 ? 'es' : ''}.`);
            f.ev.filter((e) => e.k === 'jfin').forEach((e) => out.push(`Job ${JN[e.j]} is complete (turnaround ${sim.tr[e.j]}).`));
            f.ev.filter((e) => e.k === 'arr').forEach((e) => { const n = LS_JOBS[e.j].len.length; out.push(`Job <b>${JN[e.j]}</b> arrives with ${n} thread${n === 1 ? '' : 's'}; ${n === 1 ? 'it joins' : 'they join'} the queue.`); });
            f.ev.filter((e) => e.k === 'pre').forEach((e) => out.push(`<b>Preemption:</b> job ${JN[e.by]} has fewer threads than job ${JN[e.j]} (${LS_JOBS[e.by].len.length} < ${LS_JOBS[e.j].len.length}), so <b>${TN(e.j, e.th)}</b> is pulled off P${e.c + 1} and sent back to the queue.`));
            f.ev.filter((e) => e.k === 'pick').forEach((e) => out.push('Priority to the job with the fewest unscheduled threads: ' + e.cnt.slice().sort((a, b) => a[1] - b[1] || LS_JOBS[a[0]].arr - LS_JOBS[b[0]].arr).map(([j, n]) => `${JN[j]} (${n})`).join(' before ') + '.'));
            const gos = f.ev.filter((e) => e.k === 'go');
            if (gos.length) out.push('Idle processors take threads: ' + gos.map((e) => `P${e.c + 1} → ${TN(e.j, e.th)}`).join(', ') + '.');
            gos.filter((e) => e.mig).forEach((e) => out.push(`<span style="color:var(--bad);font-weight:700">${TN(e.j, e.th)} last ran on another processor</span>, so it restarts on P${e.c + 1} with a cold cache.`));
            if (f.users > 1) out.push(`${f.users} processors used the queue at this instant, so ${f.users - 1} waited for its lock.`);
            if (last) out.push(`<b>All done.</b> Mean job turnaround <b>${f2(sim.meanTr)}</b>.` + (pol === 'fcfs' ? ' Small jobs B and C waited behind all six of A’s threads.' : pol === 'sntf' ? ' Small jobs went first and finished sooner; A paid for it.' : ' Small jobs barely waited, but two of A’s threads were bounced to other processors.'));
            if (!out.length) out.push('Nothing changes this unit: every processor keeps running its thread.');
            return `<b>t = ${t}.</b> ` + out.join(' ');
          }
          function showStats() {
            stats.replaceChildren(...sim.tr.map((x, j) => h('span', { class: 'tk pc' + j }, `${JN[j]}: Tr ${x}`)),
              h('span', { class: 'chip accent' }, 'mean ' + f2(sim.meanTr)), h('span', { class: 'chip ' + (sim.moves ? 'bad' : 'ok') }, sim.moves + ' migration' + (sim.moves === 1 ? '' : 's')),
              h('span', { class: 'chip warn' }, sim.lockWaits + ' lock waits'));
          }
          const player = ctx.ui.player({ count: sim.frames.length, render: draw, interval: 1500, speed: false });
          const segP = ctx.ui.seg(Object.entries(POLS).map(([value, label]) => ({ value, label })), pol, (v) => { pol = v; K.lpol = v; sim = all[pol]; showStats(); player.setCount(sim.frames.length); });
          showStats();
          el.append(h('div', { class: 'split l3 fill' },
            h('div', { class: 'stack', style: { gap: '7px' } },
              h('p', { class: 'm0 small', html: '<b><span class="t">Load sharing</span></b>: one global queue of ready <b>threads</b>; an idle processor takes the next one. Three ways to order the queue:' }),
              h('ul', { class: 'm0 small', style: { paddingLeft: '18px' }, html: '<li><b>FCFS</b>: a new job’s threads join the end of the queue together.</li><li><b>Smallest number first</b>: the job with the fewest unscheduled threads goes first (ties: the earlier job). A thread runs until it ends or blocks.</li><li><b>Preemptive</b> version: an arriving job with fewer threads than a running job preempts that job’s threads.</li>' }),
              h('div', { class: 'card tight small', html: '<b style="color:var(--ok)">✓</b> Load is spread evenly. No central scheduler: an idle processor runs the scheduling code itself. Any chapter 9 policy can order the queue.<br><b style="color:var(--bad)">✗</b> The one queue needs mutual exclusion: a bottleneck with many processors. <b style="color:var(--bad)">✗</b> A preempted thread rarely resumes on the same processor (cold cache). <b style="color:var(--bad)">✗</b> A program’s threads rarely all run at once, which hurts threads that coordinate closely.' })),
            h('div', { class: 'stack', style: { gap: '6px' } },
              h('div', { class: 'row gap-s' }, segP),
              h('p', { class: 'xs muted m0' }, 'Three processors. Job A arrives at t = 0 with 6 threads of 3 units, B at t = 1 with 1 thread of 1 unit, C at t = 2 with 2 threads of 2 units. ↻ = restarted on a different processor.'),
              qLane, runLane, chart, player.el, stats)));
          return () => player.stop();
        },
      },
      /* ---------------- 6. Thread scheduling 2: gang scheduling and its waste ---------------- */
      {
        title: 'Thread scheduling 2: gang scheduling and wasted processors',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const K = ctx.keep;
          let P = K.gP || 4, a = K.gA || 4, b = K.gB || 1, weighted = !!K.gW;
          const W = ctx.narrow ? 360 : 620;
          const svg = s('svg', { width: '100%', role: 'img', style: { flex: 'none' }, 'aria-label': 'Processor-by-time grid of the gang schedule' });
          const big = h('div', { class: 'big num' }), formula = h('div', { class: 'eq' }), note = h('div', { class: 'msg', style: { minHeight: '64px' } });
          const frac = (x, y) => (x === y ? '1' : `${x}/${y}`);
          function draw() {
            K.gP = P; K.gA = a; K.gB = b; K.gW = weighted;
            const r = gangWaste(P, a, b, weighted);
            const rh = P > 6 ? 22 : P > 4 ? 28 : 34, gap = 3, top = 24, LW = 40, x0 = LW, x1 = W - 8, H = top + P * (rh + gap) + 20;
            svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.replaceChildren();
            const xa = x0 + (x1 - x0) * r.fa;
            [[x0, xa, 'A', a, 'pc0', r.fa], [xa, x1, 'B', b, 'pc2', r.fb]].forEach(([u, v, nm, n, cls, share]) => {
              /* header: shortened for a slim slice and kept inside the drawing (anchored to an edge when it would poke out) */
              const lab = v - u >= 130 ? `${nm}’s slice: ${pct(share, 1)}` : `${nm}: ${pct(share, 1)}`, half = lab.length * 4.1, mid = (u + v) / 2;
              const hx = mid + half > W - 2 ? W - 2 : mid - half < x0 ? x0 : mid, anc = hx === mid ? 'middle' : hx === x0 ? 'start' : 'end';
              svg.append(s('text', { x: hx, y: 16, 'text-anchor': anc, 'font-size': 14, 'font-weight': 800 }, lab));
              for (let p = 0; p < P; p++) {
                const y = top + p * (rh + gap), busy = p < n;
                svg.append(s('rect', { x: u + 1, y, width: Math.max(1, v - u - 2), height: rh, rx: 4, class: busy ? cls : 'idx', 'stroke-width': 1.5 }));
                if (v - u > 40) svg.append(s('text', { x: (u + v) / 2, y: y + rh / 2 + 1, class: 'bl', style: busy ? null : 'fill:var(--bad)' }, busy ? nm + (p + 1) : 'idle'));
              }
            });
            for (let p = 0; p < P; p++) svg.append(s('text', { x: 2, y: top + p * (rh + gap) + rh / 2 + 5, class: 'lbl' }, 'P' + (p + 1)));
            svg.append(s('text', { x: x0, y: H - 4, class: 'ax' }, 'one round of the schedule →'));
            big.textContent = pct(r.waste, 1);
            big.style.color = r.waste > 0 ? 'var(--bad)' : 'var(--ok)';
            const fa = weighted ? frac(a, a + b) : '1/2', fb = weighted ? frac(b, a + b) : '1/2';
            formula.innerHTML = `idle = (P − a)·share<sub>A</sub> + (P − b)·share<sub>B</sub><br>&nbsp;&nbsp;&nbsp;&nbsp; = (${P} − ${a})·${fa} + (${P} − ${b})·${fb} = ${f2(r.idle)}<br>waste = idle / P = ${f2(r.idle)} / ${P} = <b>${pct(r.waste, 1)}</b>`;
            if (r.waste === 0) say(note, 'ok', 'No waste', 'Both gangs fill every processor, so no processor ever idles.');
            else if (!weighted) say(note, 'bad', 'Uniform split', `Each gang gets half the time. While A runs, ${P - a} of ${P} processors idle; while B runs, ${P - b} idle. ` + (a === b ? 'Equal gangs: weighting cannot help here.' : 'Try <b>weighting the time by thread count</b>.'));
            else say(note, 'ok', 'Weighted split', `Time now follows thread count (A ${fa}, B ${fb}), so the gang that leaves more processors idle runs for less of each round: waste ${pct(r.waste, 1)}, against ${pct(gangWaste(P, a, b, false).waste, 1)} for a uniform split.`);
          }
          const slP = ctx.ui.slider({ label: 'Processors', min: 2, max: 8, value: P, onInput: (v) => { P = v; fit(); draw(); } });
          const slA = ctx.ui.slider({ label: 'Threads in A', min: 1, max: P, value: a, onInput: (v) => { a = v; draw(); } });
          const slB = ctx.ui.slider({ label: 'Threads in B', min: 1, max: P, value: b, onInput: (v) => { b = v; draw(); } });
          function fit() {
            [slA, slB].forEach((x) => { x.querySelector('input').max = P; });
            if (a > P) { a = P; slA.set(a); } if (b > P) { b = P; slB.set(b); }
          }
          const segW = ctx.ui.seg([{ value: false, label: 'Uniform split' }, { value: true, label: 'Weighted split' }], weighted, (v) => { weighted = v; draw(); });
          const classic = h('button', { class: 'btn sm', type: 'button', onclick: () => { P = 4; a = 4; b = 1; slP.set(4); fit(); slA.set(4); slB.set(1); draw(); } }, 'Load the example: 4 processors, A = 4, B = 1');
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: '<span class="t">Gang scheduling</span> runs the related threads of one process <b>at the same moment</b> on a set of processors, one thread per processor.' }),
              h('ul', { class: 'm0 small', style: { paddingLeft: '18px' }, html: '<li><b>Less blocking</b>: threads that synchronize closely find their partners running, not waiting in a queue.</li><li><b>Fewer process switches</b> while the threads work together.</li><li><b>Less scheduling overhead</b>: one decision places a whole group of threads on many processors at once.</li>' }),
              h('div', { class: 'callout warn small m0', 'data-label': 'The catch', html: 'Each time slice belongs to one gang. If that gang has fewer threads than there are processors, the extra processors sit <b>idle</b> for the whole slice.' }),
              h('p', { class: 'm0 small b' }, 'Predict first: 4 processors; application A has 4 threads, B has 1; each gets half the time. What share of processor time is wasted?'),
              h('div', {}, classic),
              ctx.ui.reveal('Show the answer', '<p class="small m0">While B runs, 3 of the 4 processors idle, and B runs half the time: 3/4 × 1/2 = <b>37.5%</b> of all processor time is wasted. Giving each gang time in proportion to its threads (A 4/5, B 1/5) cuts it to 3/4 × 1/5 = <b>15%</b>.</p>')),
            h('div', { class: 'card white stack', style: { gap: '7px' } },
              h('div', { class: 'grid-2', style: { gap: '4px 16px' } }, slP, h('div', {}, segW), slA, slB),
              svg,
              h('div', { class: ctx.narrow ? 'stack' : 'row nw', style: { gap: ctx.narrow ? '6px' : '14px', alignItems: ctx.narrow ? 'stretch' : 'center' } }, h('div', { class: 'stack', style: { gap: '0', flex: 'none' } }, h('span', { class: 'xs muted b' }, 'PROCESSOR TIME WASTED'), big), h('div', { class: 'grow' }, formula)),
              note)));
          draw();
        },
      },
      /* ---------------- 7. Thread scheduling 3 and 4: dedicated processors, dynamic scheduling ---------------- */
      {
        title: 'Thread scheduling 3 and 4: dedicated and dynamic',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const K = ctx.keep;
          /* Tab 1: an illustrative speedup curve for dedicated processor assignment */
          function tabDedicated(panel) {
            let P = K.sP || 8, n = Math.min(K.sN || 8, 3 * P);
            const W = ctx.narrow ? 360 : 640, H = 250;
            const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', style: { flex: 'none' }, 'aria-label': 'Illustrative speedup as the number of threads grows' });
            const msg = h('div', { class: 'msg', style: { minHeight: '70px' } });
            let sl;
            function draw() {
              K.sP = P; K.sN = n;
              const N = 3 * P, top = Math.ceil(speedupModel(P, P) / 4) * 4 + (P > 8 ? 4 : 2), x0 = 40, x1 = W - 12, y0 = 12, y1 = H - 36;
              const X = (v) => x0 + ((v - 1) / (N - 1)) * (x1 - x0), Y = (v) => y1 - (v / top) * (y1 - y0);
              svg.replaceChildren();
              for (let v = 0; v <= top; v += top > 12 ? 4 : 2) svg.append(s('line', { x1: x0, x2: x1, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: x0 - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'ax' }, String(v)));
              [1, P, 2 * P, 3 * P].forEach((v) => svg.append(s('text', { x: X(v), y: y1 + 16, 'text-anchor': 'middle', class: 'ax' }, String(v))));
              svg.append(s('text', { x: (x0 + x1) / 2, y: H - 4, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'threads in the application →'),
                s('text', { x: x0 + 4, y: y0 + 10, 'font-size': 13, class: 's-sub' }, 'speedup'),
                s('line', { x1: X(P), x2: X(P), y1: y0, y2: y1, class: 's-muted', 'stroke-dasharray': '5 4' }),
                s('text', { x: X(P) + 5, y: y1 - 8, 'font-size': 13, class: 's-sub' }, 'threads = processors'));
              let d = '';
              for (let k = 1; k <= N; k++) d += (k === 1 ? 'M' : 'L') + X(k).toFixed(1) + ',' + Y(speedupModel(k, P)).toFixed(1);
              svg.append(s('path', { d, fill: 'none', stroke: 'var(--chc)', 'stroke-width': 3 }),
                s('circle', { cx: X(n), cy: Y(speedupModel(n, P)), r: 7, fill: 'var(--accent)', stroke: 'var(--panel)', 'stroke-width': 2 }));
              const sp = speedupModel(n, P);
              if (n < P) say(msg, 'info', `${n} threads on ${P} processors`, `Speedup ${f2(sp)}. Each thread has its own processor, but <b>${P - n} of the ${P} processor${P - n === 1 ? ' has' : 's have'} no thread to run</b>: the application could use more threads.`);
              else if (n === P) say(msg, 'ok', `${n} threads on ${P} processors`, `Speedup ${f2(sp)}, the peak: one thread per processor, no thread switches, warm caches. Only coordination among the threads keeps it below ${P}.`);
              else say(msg, 'bad', `${n} threads on ${P} processors`, `Speedup ${f2(sp)}, down from ${f2(speedupModel(P, P))}. ${n - P} thread${n - P === 1 ? '' : 's'} must take turns: switching, cache reloads, and threads waiting for partners that are not running eat the gain.`);
            }
            const segP = ctx.ui.seg([4, 8, 16].map((v) => ({ value: v, label: v + ' processors' })), P, (v) => { P = v; n = Math.min(n, 3 * P); sl.querySelector('input').max = 3 * P; sl.set(n); draw(); });
            sl = ctx.ui.slider({ label: 'Threads', min: 1, max: 3 * P, value: n, onInput: (v) => { n = v; draw(); } });
            panel.append(h('div', { class: 'split l3 fill' },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0 small', html: '<b><span class="t">Dedicated processor assignment</span></b> is gang scheduling taken to the extreme: an application gets as many processors as it has threads, for its <b>whole run</b>. If a thread blocks, its processor just idles: no multiprogramming.' }),
                h('p', { class: 'm0 small', html: 'Wasteful? Two arguments say no. With tens or hundreds of processors, each is a small part of the machine’s cost, so <b>utilization matters less</b> than finishing applications fast. And with <b>no process switches</b> at all, the program itself runs faster.' }),
                h('p', { class: 'm0 small', html: 'Experiments on real multiprocessors found that an application’s <span class="t">speedup</span> is best when its threads do <b>not outnumber</b> its processors, and falls off once they do.' }),
                h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: '“More threads is always faster.” Past the number of processors, extra threads only add switching and waiting.' })),
              h('div', { class: 'card white stack', style: { gap: '7px' } },
                h('div', { class: 'row gap-s' }, segP, h('div', { class: 'grow', style: { minWidth: '200px' } }, sl)),
                h('p', { class: 'xs muted m0' }, 'Illustrative model, not measured data: a small coordination cost per extra thread up to the number of processors, then a growing cost for every thread that must take turns.'),
                svg, msg)));
            draw();
          }
          /* Tab 2: the processor allocation rules of dynamic scheduling, step by step */
          function tabDynamic(panel) {
            const frames = simDyn(DYN_EVENTS), JN = (j) => 'J' + (j + 1);
            const log = h('div', { class: 'log', style: { height: '128px', fontSize: '13px' } }), procs = h('div', { class: 'g4', style: ctx.narrow ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : null }), jobsBox = h('div', { class: 'row gap-s' }), waitBox = h('div'), rules = h('ol', { class: 'm0 small', style: { paddingLeft: '20px' } });
            const RULES = [
              'If processors are <b>idle</b>, use them to satisfy the request.',
              'Otherwise, if the job is a <b>new arrival</b>, give it <b>one</b> processor taken from a job that holds more than one.',
              'Whatever is still missing <b>waits</b> until a processor frees up (or the job withdraws the request).',
              'When processors are released, first give <b>one to each waiting job that has none</b>, then hand out the rest <b>first-come-first-served</b>.',
            ];
            function draw(i) {
              const f = frames[i], used = new Set(f.notes.map((x) => x.r));
              rules.replaceChildren(...RULES.map((r, k) => h('li', { html: r, style: { background: used.has(k + 1) ? 'var(--hl)' : null, borderRadius: '6px', padding: '1px 4px', margin: '2px 0' } })));
              procs.replaceChildren(...f.own.map((j, c) => h('div', { class: 'box ' + (j == null ? '' : ''), style: j == null ? { borderStyle: 'dashed' } : { borderColor: `var(--${['cpu', 'mem', 'io', 'os', 'thread'][j]})`, background: `color-mix(in srgb, var(--${['cpu', 'mem', 'io', 'os', 'thread'][j]}) 22%, var(--panel))` } },
                h('div', { class: 'xs muted' }, 'CPU ' + c), h('div', { style: { fontSize: '22px', fontWeight: 800, padding: '4px 0' } }, j == null ? 'idle' : JN(j)))));
              log.replaceChildren(...frames.slice(1, i + 1).map((g, k) => h('div', { style: { fontWeight: k === i - 1 ? 800 : 400 } }, `${k + 1}. ${g.ev.k === 'arr' ? JN(g.ev.j) + ' arrives, asks for ' + g.ev.want : JN(g.ev.j) + ' finishes'} → ` + (g.notes.filter((x) => x.r).map((x) => 'rule ' + x.r).filter((x, q, arr) => arr.indexOf(x) === q).join(', ') || 'no rule'))));
              if (i === 0) log.replaceChildren(h('div', { class: 'muted' }, 'Events will be listed here.'));
              log.scrollTop = log.scrollHeight;
              const live = [...new Set([...f.own.filter((x) => x != null), ...f.wait.map((w) => w.j)])].sort((x, y) => x - y);
              jobsBox.replaceChildren(h('span', { class: 'small b' }, 'Holding:'), ...(live.length ? live.map((j) => tok(ctx, JN(j), j, f.own.filter((x) => x === j).length)) : [h('span', { class: 'small muted' }, 'no jobs yet')]));
              waitBox.replaceChildren(h('div', { class: 'alane wide' }, h('div', { class: 'nm' }, 'Waiting list', h('small', {}, 'first come, first served')),
                h('div', { class: 'toks' }, ...(f.wait.length ? f.wait.map((w) => h('span', { class: 'tk pc' + w.j }, `${JN(w.j)} needs ${w.n}`)) : [h('span', { class: 'empty' }, 'empty')]))));
              if (!f.ev) return '<b>Start.</b> Four idle processors. Jobs will arrive, ask for processors, and leave; watch which rule decides each time.';
              const e = f.ev, out = [];
              if (e.k === 'arr') out.push(`<b>${JN(e.j)} arrives</b> and asks for ${e.want} processor${e.want === 1 ? '' : 's'}.`);
              else out.push(`<b>${JN(e.j)} finishes</b> and releases ${f.notes[0].n} processor${f.notes[0].n === 1 ? '' : 's'}.`);
              f.notes.forEach((x) => {
                if (x.r === 1) out.push(`Rule 1: ${x.n} idle processor${x.n === 1 ? ' is' : 's are'} free, so it gets ${x.n === 1 ? 'it' : 'them'}.`);
                if (x.r === 2) out.push(`Rule 2: nothing is idle and ${JN(e.j)} is new, so it takes one processor from ${JN(x.from)}, which held more than one. ${JN(x.from)} still wants it back, so it joins the waiting list.`);
                if (x.r === 3) out.push(e.k === 'arr' && !f.own.includes(e.j) ? `Rule 3: no processor is idle and no job holds more than one, so ${JN(e.j)} gets nothing yet and waits.` : `Rule 3: the remaining ${x.n} waits.`);
                if (x.r === 4) out.push(x.first ? `Rule 4: ${JN(x.j)} holds no processor at all, so it is served first, even though other jobs asked earlier.` : `Rule 4: no waiting job is empty-handed, so the processor goes first-come-first-served to ${JN(x.j)}.`);
              });
              return out.join(' ');
            }
            const player = ctx.ui.player({ count: frames.length, render: draw, interval: 2600, speed: false });
            panel.append(h('div', { class: 'split l fill' },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0 small', html: 'Some applications can change how many threads they use while they run. With <b><span class="t">dynamic scheduling</span></b> the OS divides the processors among the jobs, and each job decides which of its tasks run on the processors it holds (often through a run-time library). When a job asks for processors, the OS applies four rules:' }),
                rules,
                h('p', { class: 'xs muted m0' }, 'Rule 2 here takes from the job holding the most processors (the earlier job on a tie). In simulation studies this beat gang and dedicated assignment for applications that can adapt, but its bookkeeping overhead can cancel the gain.')),
              h('div', { class: 'card white stack', style: { gap: '8px' } }, procs, jobsBox, waitBox, player.el, h('div', { class: 'xs muted b' }, 'EVENT LOG'), log)));
            return () => player.stop();
          }
          el.append(ctx.ui.tabs([
            { label: 'Dedicated processor assignment', render: (p) => tabDedicated(p) },
            { label: 'Dynamic scheduling', render: (p) => tabDynamic(p) },
          ], { initial: K.tab || 0, onChange: (i) => { K.tab = i; } }));
        },
      },
      /* ---------------- 8. Multicore: placing threads on cores that share caches ---------------- */
      {
        title: 'Multicore: put threads where their data lives',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const K = ctx.keep;
          const COL = { P: 0, C: 1, H1: 2, H2: 3, L1: 5, L2: 4 };
          const DESC = { P: 'producer', C: 'consumer', H1: 'cache-hungry', H2: 'cache-hungry', L1: 'light', L2: 'light' };
          const SC = { share: 'Two threads share data', hungry: 'Two cache-hungry threads', mixed: 'Both at once' };
          const START = { share: ['P', 'L1', 'C', 'L2'], hungry: ['H1', 'H2', 'L1', 'L2'], mixed: ['P', 'H1', 'C', 'H2'] };
          K.slots = K.slots || {};
          let sc = K.sc || 'share', pick = null;
          const slots = () => K.slots[sc] || (K.slots[sc] = START[sc].slice());
          const board = h('div', { class: 'grid-2', style: { gap: '10px' } }), result = h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { gap: '14px', alignItems: 'center' } }), verdict = h('div', { class: 'msg', style: { minHeight: '86px' } });
          const sizeTxt = (x) => (MC_THREADS[x].share ? `${MC_THREADS[x].own} MB + shared ${BUF_MB} MB` : `${MC_THREADS[x].own} MB`);
          function cacheBar(cl) {
            const BW = 240, MAXMB = 12, sx = BW / MAXMB, svg = s('svg', { viewBox: `0 0 ${BW + 20} 50`, width: '100%', role: 'img', style: { flex: 'none' }, 'aria-label': `Cache demand ${cl.demand} MB of ${CACHE_MB} MB` });
            let x = 10;
            const segs = cl.ts.map((t) => [MC_THREADS[t].own, 'pc' + COL[t], t]);
            if (cl.sh) segs.push([BUF_MB, 's-accent', 'buf']);
            segs.forEach(([mb, cls, lab]) => { const w = Math.min(mb * sx, BW + 10 - x); if (w > 0) { svg.append(s('rect', { x, y: 6, width: w, height: 20, class: cls, 'stroke-width': 1.5 })); if (w > 22) svg.append(s('text', { x: x + w / 2, y: 17, class: 'bl', style: 'font-size:13px' }, lab)); } x += mb * sx; });
            const cx = 10 + CACHE_MB * sx;
            if (cl.over > 0) svg.append(s('rect', { x: cx, y: 3, width: Math.min(cl.over * sx, BW + 10 - cx), height: 26, class: 'idx', 'fill-opacity': 0.5 }));
            svg.append(s('line', { x1: cx, x2: cx, y1: 0, y2: 32, stroke: 'var(--ink)', 'stroke-width': 2.5 }),
              s('text', { x: 10, y: 46, class: 'ax' }, `${cl.demand} MB wanted`), s('text', { x: cx + 4, y: 46, class: 'ax', style: cl.over ? 'fill:var(--bad)' : '' }, cl.over ? `${cl.over} MB spills` : 'fits in 6 MB'));
            return svg;
          }
          function draw() {
            K.sc = sc;
            const sl = slots(), c = mcCost(sl), best = mcBest(START[sc]);
            board.replaceChildren(...[0, 1].map((k) => h('div', { class: 'card tight stack', style: { gap: '6px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'small' }, `Cluster ${k ? 'Y' : 'X'}`), h('span', { class: 'xs muted' }, 'two cores, one 6 MB cache')),
              h('div', { class: 'g2' }, ...[0, 1].map((q) => {
                const i = k * 2 + q, t = sl[i];
                return h('button', { class: 'btn' + (pick === i ? ' on' : ''), type: 'button', 'aria-pressed': String(pick === i), style: { height: 'auto', flexDirection: 'column', padding: '6px', gap: '2px' }, onclick: () => tap(i) },
                  h('span', { class: 'xs muted' }, 'Core ' + i), h('span', { class: 'tk pc' + COL[t] }, t), h('span', { class: 'xs' }, DESC[t]));
              })),
              cacheBar(c.cl[k]))));
            result.replaceChildren(h('div', { class: 'stack', style: { gap: 0, flex: 'none' } }, h('span', { class: 'xs muted b' }, 'SLOW TRAFFIC PER ROUND'), h('span', { class: 'big num', style: { color: c.total === best ? 'var(--ok)' : 'var(--bad)' } }, c.total + ' MB')),
              h('div', { class: 'small grow', style: { minWidth: '230px' }, html: `Spilled from the caches: <b>${c.cl[0].over + c.cl[1].over} MB</b> (X ${c.cl[0].over}, Y ${c.cl[1].over})<br>` + (c.split ? `Shared buffer crossing between clusters: <b>${c.cross} MB</b>` : 'Shared data stays inside one cluster: <b>0 MB</b> crossing') + `<br>Best possible in this scenario: <b>${best} MB</b>` }));
            const other = (names) => { const X = [names[0], names[1]], Y = names.slice(2); return mcCost([...X, ...Y]).total; };
            if (c.total > best) say(verdict, 'bad', 'Not the best yet', sc === 'share' ? 'P and C sit under different caches, so their buffer is copied across and back every round. Swap cores to put them together.' : sc === 'hungry' ? 'H1 and H2 share one cache and push each other’s data out. Spread them over the two clusters.' : 'Try the other pairings. You cannot keep P with C <i>and</i> keep H1 away from H2 on two dual-core clusters; which cost is bigger?');
            else if (sc === 'share') say(verdict, 'ok', 'Cooperative sharing', 'P and C share one cache: the buffer is stored there once, and what P writes is already in the cache when C reads it.');
            else if (sc === 'hungry') say(verdict, 'ok', 'Contention avoided', 'Each hungry thread has a cache to itself (plus a light thread), so neither evicts the other. This is contention-aware placement.');
            else say(verdict, 'ok', 'Best trade-off', `Keeping the sharers together costs ${other(['P', 'C', 'H1', 'H2'])} MB (the hungry pair spills); splitting them costs ${other(['P', 'H1', 'C', 'H2'])} MB (two smaller spills plus the buffer crossing). With these sizes, togetherness wins. A real scheduler weighs measured costs the same way.`);
          }
          function tap(i) {
            if (pick == null) pick = i;
            else if (pick === i) pick = null;
            else { const sl = slots(); [sl[pick], sl[i]] = [sl[i], sl[pick]]; pick = null; }
            draw();
          }
          const segS = ctx.ui.seg(Object.entries(SC).map(([value, label]) => ({ value, label })), sc, (v) => { sc = v; pick = null; draw(); });
          const reset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { K.slots[sc] = START[sc].slice(); pick = null; draw(); } }, 'Reset');
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0 small', html: 'Cores on one chip often share a <span class="t" data-t="Last-level cache (LLC)">last-level cache</span>, so <b>where</b> a thread runs decides whose data it shares the cache with.' }),
              h('p', { class: 'm0 small', html: '<b><span class="t">Cooperative resource sharing</span></b>: threads that use the same data, such as a producer and its consumer, gain from cores that share a cache.' }),
              h('p', { class: 'm0 small', html: '<b><span class="t">Resource contention</span></b>: threads that each need lots of cache space push each other’s data out. <span class="t">Contention-aware scheduling</span> spreads them over different caches.' }),
              h('p', { class: 'm0 small', html: 'Classic schedulers place threads mainly to balance load. As core counts grow, avoiding slow trips to off-chip memory matters as much as keeping every core busy, so modern kernels such as Linux also track which cores share a cache and prefer to keep a thread inside its cache group.' }),
              h('div', { class: 'callout why small m0', 'data-label': 'Affinity', html: 'Moving a thread throws away its warm cache. Schedulers prefer to run a thread again where it last ran (<span class="t">soft affinity</span>) and move it only when the load is badly unbalanced. A strict limit on where it may run is <span class="t" data-t="Processor affinity">processor affinity</span> in chapter 4’s sense (hard affinity).' })),
            h('div', { class: 'card white stack', style: { gap: '7px' } },
              h('div', { class: 'row gap-s' }, segS, reset),
              h('p', { class: 'xs muted m0' }, 'Click a core, then another, to swap their threads. Simple model: each round every thread sweeps its data once; data that does not fit comes from memory again, and a buffer split across clusters is copied over and back (2 × 2 MB).'),
              board, result, verdict)));
          draw();
        },
      },
      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: scheduling many processors',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['Three kinds of multiprocessor', '<b>Loosely coupled</b>: own memory and I/O, talk over a network. <b>Functionally specialized</b>: a main processor plus helpers. <b>Tightly coupled</b>: shared memory, one OS. Scheduling here means tightly coupled.'],
              ['Five grain sizes', 'Instructions between synchronizations: <b>fine</b> &lt; 20, <b>medium</b> 20–200, <b>coarse</b> 200–2,000, <b>very coarse</b> 2,000–1M, <b>independent</b>: never. Medium-grained threads need the most scheduling care.'],
              ['Three design issues', '<b>Assignment</b> (static per-processor queues vs a global queue or load balancing; master/slave vs peer kernel), <b>multiprogramming</b> each processor or not, and the <b>dispatching policy</b>: with many processors, simple FCFS is often enough.'],
              ['Four ways to schedule threads', '<b>Load sharing</b>: one global thread queue. <b>Gang</b>: a process’s threads run together. <b>Dedicated</b>: one processor per thread for the whole run. <b>Dynamic</b>: the OS splits processors among jobs; each job picks its threads.'],
              ['Gang waste: 4 processors, A has 4 threads, B has 1', 'Half the time each: while B runs, 3 of 4 processors idle: 3/4 × 1/2 = <b>37.5%</b>. Time weighted by threads (4/5 and 1/5): 3/4 × 1/5 = <b>15%</b>.'],
              ['Placing threads on a multicore chip', 'Put threads that <b>share data</b> on cores that share a cache; spread <b>cache-hungry</b> threads over different caches; keep a thread where its cache is warm (<b>soft affinity</b>).'],
            ], { cols: ctx.narrow ? 1 : 3, height: 222 })));
        },
      },

      /* ---------------- 10. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In which kind of multiprocessor do the processors share one main memory and run under a single operating system?',
            choices: ['A loosely coupled system such as a cluster', 'A functionally specialized system with an I/O processor', 'A tightly coupled system such as a multicore chip', 'A distributed system linked by a fast network'], answer: 2,
            feedback: ['In a loosely coupled system each computer has its own memory and I/O, and usually its own OS.', 'Here a main processor directs special-purpose helpers; the helpers are not equal partners sharing the scheduling.', null, 'A distributed system is loosely coupled: separate memories, cooperation by messages.'],
            why: 'Tightly coupled processors share main memory under one OS, so any processor can run any process and the OS must decide who runs where.' },
          { type: 'match', q: 'Match each grain size with how many instructions typically run between synchronizations.',
            pairs: [['Fine', 'Fewer than 20'], ['Medium', '20 to 200'], ['Coarse', '200 to 2,000'], ['Very coarse', '2,000 to about 1 million'], ['Independent', 'No synchronization at all']],
            why: 'Fine grain is parallelism inside one instruction stream, medium is threads of one application, coarse is cooperating processes, very coarse is distributed processing over a network, and independent processes never synchronize.' },
          { q: 'What is the main drawback of static assignment, where each process is tied to one processor with its own queue?',
            choices: ['Every processor must lock one shared queue before it can dispatch anything', 'A processor can sit idle while another processor still has a backlog of work', 'Processes keep migrating between processors and lose their cached data', 'It makes gang scheduling impossible because no process has fixed processors'], answer: 1,
            feedback: ['That is the cost of a single global queue, which static assignment avoids.', null, 'Static assignment never migrates; migration is a cost of dynamic assignment and load balancing.', 'The opposite: fixed assignment makes group or gang scheduling easier.'],
            why: 'With per-processor queues, work cannot flow to an idle processor, so one processor may idle while another has several processes waiting.' },
          { type: 'tf', q: 'In a master/slave multiprocessor, a failure of the master processor brings down the whole system.', answer: true,
            why: 'Only the master runs the key kernel functions, scheduling included, so the slaves cannot get any kernel service once it fails: it is a single point of failure.' },
          { q: 'In a peer multiprocessor architecture, what extra problem must the operating system solve?',
            choices: ['Sending every system call to one master processor and waiting for its reply', 'Moving each process to the processor with the most free cache before it runs', 'Making sure two processors never choose the same process and no process is lost', 'Running a separate copy of the OS, with its own memory, on every processor'], answer: 2,
            feedback: ['That describes master/slave, where only the master runs the kernel.', 'Cache-aware placement is a refinement, not the core problem that peers introduce.', null, 'That describes a loosely coupled system; peers share one kernel and one memory.'],
            why: 'Because every processor runs the kernel and schedules itself from a shared pool, the shared queues must be protected (for example with a lock) so that a process is neither taken twice nor lost.' },
          { type: 'multi', q: 'Which are disadvantages of load sharing (one global queue of ready threads)? Select all that apply.',
            choices: ['The shared queue needs mutual exclusion and can become a bottleneck with many processors', 'A preempted thread is unlikely to resume on the processor whose cache holds its data', 'The threads of one program are unlikely to all be running at the same moment', 'A dedicated scheduler processor must run all the time to hand out the threads'], answer: [0, 1, 2],
            why: 'Load sharing spreads work evenly and needs no central scheduler (an idle processor runs the scheduling code itself), but the one queue is a contention point, threads lose cache warmth when they move, and related threads rarely run together.' },
          { type: 'num', q: 'Gang scheduling on 6 processors: application A has 6 threads and application B has 2. Each application gets half of the time. What percentage of the total processor time is wasted (idle)?', answer: 33.3, tol: 0.2, unit: '%',
            why: 'While A runs, all 6 processors are busy. While B runs, 4 of 6 idle, for half the time: 4/6 × 1/2 = 1/3 ≈ 33.3%.' },
          { type: 'num', q: 'Same machine and applications (6 processors, A has 6 threads, B has 2), but now time is weighted by thread count: A gets 6/8 of the time and B gets 2/8. What percentage of processor time is wasted?', answer: 16.7, tol: 0.2, unit: '%',
            why: 'Only B’s slice wastes processors: 4 of 6 idle for 2/8 of the time, 4/6 × 2/8 = 1/6 ≈ 16.7%, half the waste of the uniform split.' },
          { q: 'Dedicated processor assignment leaves a processor idle whenever its thread blocks. Why can it still be a good choice?',
            choices: ['It keeps every processor busy, because blocked threads give their processor to another job', 'It lets an application run many more threads than it has processors without any slowdown', 'It removes the need for the threads of an application to synchronize with each other', 'With very many processors, utilization matters less than avoiding process switches'], answer: 3,
            feedback: ['No: a dedicated processor is not multiprogrammed, so it simply idles while its thread is blocked.', 'The opposite: speedup falls once threads outnumber the processors given to the application.', 'The threads still synchronize; they just never wait for a partner that has been switched out.', null],
            why: 'When processors are plentiful, each is a small share of the cost, so finishing applications fast (no process switching, warm caches) beats keeping every processor busy.' },
          { type: 'order', q: 'Under the dynamic scheduling policy, put the rules in the order the OS applies them, from a new request to a later release of processors.',
            items: ['Satisfy the request with idle processors first', 'If the job is new and nothing is idle, take one processor from a job that holds more than one', 'Leave whatever is still missing on a waiting list', 'On a release, give one processor to each waiting job that has none, then serve the rest first-come-first-served'],
            why: 'Idle processors are used first; a brand-new job is guaranteed one processor if any job holds more than one; unmet demand waits; and freed processors go first to empty-handed jobs, then in arrival order.' },
          { q: 'On a multicore chip, two threads constantly pass a large buffer between them (a producer and its consumer). Where should a cache-aware scheduler place them?',
            choices: ['On two cores that share the same last-level cache', 'On cores in different clusters, so each gets a whole cache', 'On whichever cores have the shortest queues at that moment', 'On cores as far apart as possible, to spread out the heat'], answer: 0,
            feedback: [null, 'Then every handoff of the buffer must travel from one cache to the other, a far slower path than a hit in one shared cache.', 'Pure load balancing ignores the shared data; the buffer would likely bounce between caches.', 'Heat is not the concern here; sharing the cache is what avoids off-chip traffic.'],
            why: 'This is cooperative resource sharing: on cores that share a cache, the buffer is stored once and data one thread writes is already there for the other.' },
          { type: 'bucket', q: 'Sort each statement: does it describe static assignment or dynamic assignment with one global queue?', buckets: ['Static assignment', 'Dynamic (global queue)'],
            items: [['A process stays on one processor for its whole life', 0], ['Each processor has its own ready queue', 0], ['Group (gang) scheduling is easy to arrange', 0], ['Any free processor takes the next waiting process', 1], ['No processor idles while a process waits', 1], ['The shared queue must be locked before each dispatch', 1]],
            why: 'Static assignment means per-processor queues, low overhead and easy gang scheduling, at the risk of imbalance. A global queue keeps every processor busy but every processor must lock the shared queue, and processes move between caches.' },
          { type: 'tf', q: 'With several processors sharing one ready queue, the advantage of a clever dispatching policy over plain FCFS is usually larger than it is on a single processor.', answer: false,
            why: 'The opposite: with more processors a short process rarely waits long for some processor, so the gap between policies such as FCFS and round robin shrinks, and simple FCFS is often good enough.' },
        ],
      },
    ],
    notes: `
      <h3>Multiprocessor and multicore scheduling</h3>
      <p>With several processors the scheduler must also decide <b>which</b> processor runs each process, whether a program's threads should run <b>at the same moment</b>, and which <b>cache</b> holds a thread's data.</p>

      <h4>Three kinds of multiprocessor</h4>
      <ul>
        <li><b>Loosely coupled (distributed) multiprocessor</b>: a group of fairly independent computers, each with its own main memory and I/O channels (for example a cluster). They cooperate by messages.</li>
        <li><b>Functionally specialized processors</b>: one general-purpose main processor in charge, helped by special-purpose processors such as an I/O processor or a graphics processor that work under its direction.</li>
        <li><b>Tightly coupled multiprocessor</b>: several processors share one main memory under one operating system (symmetric multiprocessors, multicore chips). Any processor can run any process. This section is about this kind.</li>
      </ul>

      <h4>Granularity</h4>
      <p><b>Granularity</b> is how often the parallel parts of an application must synchronize, measured as the number of instructions run between synchronization points.</p>
      <table>
        <tr><th>Grain</th><th>Instructions between syncs</th><th>What it is</th><th>What it asks of the scheduler</th></tr>
        <tr><td>Fine</td><td>fewer than 20</td><td>parallelism inside one instruction stream</td><td>handled by hardware and compilers, not OS scheduling</td></tr>
        <tr><td>Medium</td><td>20 to 200</td><td>threads of one application</td><td>scheduling matters a lot: a thread that is not running stalls its partners</td></tr>
        <tr><td>Coarse</td><td>200 to 2,000</td><td>concurrent processes in a multiprogrammed system</td><td>runs almost as on one processor, little or no software change</td></tr>
        <tr><td>Very coarse</td><td>2,000 to about 1 million</td><td>distributed processing over network nodes</td><td>treated like coarse grain</td></tr>
        <tr><td>Independent</td><td>no synchronization</td><td>unrelated processes, e.g. a time-sharing system</td><td>more run at once; average response time improves</td></tr>
      </table>

      <h4>Design issue 1: assigning processes to processors</h4>
      <ul>
        <li><b>Static assignment</b>: a process is tied to one processor for life; each processor has its own ready queue. Low scheduling overhead and easy group (gang) scheduling, but one processor may sit idle while another has a backlog.</li>
        <li><b>Dynamic assignment</b>: one global queue; any free processor takes the next process. A variant keeps per-processor queues and moves waiting work to idle processors (<b>load balancing</b>). Costs: the shared queue must be locked, and a moved process finds a cold cache.</li>
      </ul>
      <p>In the guide's lab (12 processes on 4 processors) the standard workload finishes at t = 16 with static assignment, with processors idle while work waited for 13 processor-time units; with one global queue or load balancing it finishes at t = 12 with no such idle time.</p>
      <ul>
        <li><b>Master/slave architecture</b>: key kernel functions, scheduling included, always run on one master processor; slaves run user programs and ask the master for kernel services. Simple (little change from a uniprocessor OS; one processor controls memory and I/O, so conflicts are easy to resolve), but the master is a performance <b>bottleneck</b> and a <b>single point of failure</b>.</li>
        <li><b>Peer architecture</b>: the kernel can run on any processor and each processor schedules itself from the pool of ready processes. The OS must make sure two processors never choose the same process and that no process is lost from a queue, usually with a lock on the shared queue. General-purpose kernels such as Linux, Windows and macOS take this approach.</li>
      </ul>

      <h4>Design issues 2 and 3: multiprogramming and dispatching</h4>
      <p>For coarse-grained or independent work, each processor should be multiprogrammed so it stays busy. For a medium-grained application on many processors, keeping every processor busy matters less than letting the application's threads run together.</p>
      <p>Classic process scheduling uses one global queue (or one per priority level) feeding all processors, like one line served by many tellers; Linux and FreeBSD instead keep a queue per processor and balance the load. The more processors there are, the less the choice of policy matters: a short process rarely waits long for <i>some</i> processor to free up. A classic simulation study found the difference between FCFS and round robin smaller with two processors than with one. The guide's experiment (4,000 processes, about 80% load per processor) shows the gap in mean turnaround keeps shrinking: in its first run with very mixed service times, FCFS's mean turnaround is about 54% longer than round robin's on 1 processor, 42% on 2, 31% on 4 and only 12% on 8. With similar service times FCFS wins, and that gap shrinks too (53% to 8%). So simple FCFS is often good enough on a multiprocessor.</p>

      <h4>Thread scheduling: four approaches</h4>
      <ol>
        <li><b>Load sharing</b>: one global queue of ready threads; an idle processor takes the next one. Versions: <b>FCFS</b> (a new job's threads join the end of the queue), <b>smallest number of threads first</b> (the job with the fewest unscheduled threads goes first, ties by arrival; nonpreemptive), and <b>preemptive smallest number first</b> (an arriving job with fewer threads than a running job preempts that job's threads). Advantages: even load, no central scheduler (an idle processor runs the scheduling code itself), any uniprocessor policy can order the queue. Disadvantages: the queue needs mutual exclusion and becomes a bottleneck with many processors; preempted threads rarely resume on the same processor, so caches go cold; threads of one program rarely all run at once, which hurts closely coordinating threads. In the guide's example (3 processors; A with 6 threads, B with 1, C with 2) mean job turnaround is 6.00 with FCFS, 4.67 with smallest-number-first and 3.67 with the preemptive version, which also causes 2 migrations.</li>
        <li><b>Gang scheduling</b>: a set of related threads runs simultaneously on a set of processors, one thread per processor. It reduces blocking on synchronization and process switching, and one decision schedules many threads. Each time slice belongs to one gang, so a gang with fewer threads than processors leaves processors idle.
          <br><b>Waste</b> = [(P − a)·share<sub>A</sub> + (P − b)·share<sub>B</sub>] / P. Example: 4 processors, A has 4 threads, B has 1. Uniform (half each): 3/4 × 1/2 = <b>37.5%</b>. Weighted by threads (A 4/5, B 1/5): 3/4 × 1/5 = <b>15%</b>. With 6 processors, A = 6, B = 2: uniform 4/6 × 1/2 ≈ 33.3%, weighted 4/6 × 2/8 ≈ 16.7%.</li>
        <li><b>Dedicated processor assignment</b>: each application gets one processor per thread for its whole run; a processor whose thread blocks just idles. Justified because with very many processors utilization matters less than speed, and avoiding all process switches speeds the program. Experiments found speedup is best when an application's threads do not outnumber its processors and falls off beyond that.</li>
        <li><b>Dynamic scheduling</b>: the number of threads can change at run time; the OS partitions processors among jobs and each job maps its tasks to its processors. Allocation rules: (1) use idle processors first; (2) otherwise a <b>new arrival</b> gets one processor taken from a job holding more than one; (3) any unmet part of the request waits until a processor frees or the job withdraws it; (4) when processors are released, first give one to each waiting job that has none, then serve the rest first-come-first-served. In simulation studies it beat gang and dedicated assignment for applications that can adapt, but its overhead can cancel the gain.</li>
      </ol>

      <h4>Multicore thread scheduling</h4>
      <p>Cores on one chip often share a <b>last-level cache</b>. Classic schedulers place threads mainly to balance load; as core counts grow, avoiding off-chip memory trips matters as much, so kernels such as Linux also track which cores share a cache.</p>
      <ul>
        <li><b>Cooperative resource sharing</b>: threads that share data (a producer and its consumer) should run on cores that share a cache.</li>
        <li><b>Resource contention</b>: threads that each need lots of cache push each other's data out; a <b>contention-aware</b> scheduler spreads them over different caches.</li>
        <li><b>Soft affinity</b>: prefer to run a thread again where it last ran, because its cache is warm; move it only to fix a bad imbalance. A strict limit on where a thread may run is hard affinity.</li>
      </ul>
      <p>With two dual-core clusters you cannot always satisfy both rules: placing a sharing pair together may force two hungry threads together. In the guide's model (cache spills plus 2 × 2 MB when the shared buffer is split), together costs 4 MB of slow traffic per round and split costs 8 MB, so a scheduler must weigh the measured costs.</p>
    `,
  });
})();
