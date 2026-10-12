/* =====================================================================
   Section 10.3 — Linux Scheduling
   Scheduling classes, real-time FIFO and RR, the O(1) scheduler of
   2.6.0-2.6.22, the Completely Fair Scheduler (2.6.23-6.5) and its
   successor EEVDF (6.6). Pure engines (no DOM) live at the top of the
   IIFE so every chart, caption and quiz number comes from the same code.
   ===================================================================== */
(() => {
  /* ---------- shared numbers ---------- */
  // CFS weight for each nice value from -20 to +19 (index = nice + 20)
  const WEIGHTS = [88761, 71755, 56483, 46273, 36291, 29154, 23254, 18705, 14949, 11916,
    9548, 7620, 6100, 4904, 3906, 3121, 2501, 1991, 1586, 1277,
    1024, 820, 655, 526, 423, 335, 272, 215, 172, 137,
    110, 87, 70, 56, 45, 36, 29, 23, 18, 15];
  const weightOf = (nice) => WEIGHTS[nice + 20];
  const IDLE_W = 3;                                 // CFS weight of a SCHED_IDLE thread (below nice +19's 15)
  const LAT = 6, GRAN = 0.75;                       // CFS targeted latency and minimum granularity (ms)
  const period = (n) => Math.max(LAT, n * GRAN);   // the window that n runnable tasks share
  const fmtN = (v) => (v > 0 ? '+' + v : String(v));                 // nice value with its sign
  const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
  const fmt2 = (v) => String(Math.round(v * 100) / 100);           // at most two decimals, for the notes
  // O(1) time slice in 2.6.0 (HZ = 1000): 10 ms + 190 ms x (139 - static)/39, integer arithmetic
  const o1Slice = (stat) => 10 + Math.floor((190 * (139 - stat)) / 39);
  // O(1) time slice from 2.6.9 (HZ = 1000): 400 or 100 ms x (140 - static)/20, at least 5 ms
  const o1Slice9 = (stat) => Math.max(5, Math.floor(((stat < 120 ? 400 : 100) * (140 - stat)) / 20));

  /* ---------- engine 1: real-time FIFO / RR (step 3) ----------
     Time unit = 50 ms; the RR slice is 2 units (100 ms, the Linux default).
     pol: policy of B and C ('fifo' | 'rr'); ev: 'none' | 'wake' (A sleeps at 2, wakes at 3)
     | 'sleep' (B blocks at 3, wakes at 4). Linux rules: a preempted thread goes back to the
     HEAD of its list; a woken or slice-expired thread goes to the TAIL; a slice is refilled
     only when it reaches zero. */
  const RT_SL = 2;
  function rtSim(pol, ev) {
    const T = [
      { n: 'A', pr: 90, pol: 'fifo', bursts: ev === 'wake' ? [2, 1] : [2], sleeps: ev === 'wake' ? [1] : [] },
      { n: 'B', pr: 50, pol, bursts: ev === 'sleep' ? [1, 2] : [3], sleeps: ev === 'sleep' ? [1] : [] },
      { n: 'C', pr: 50, pol, bursts: [3], sleeps: [] },
      { n: 'D', pr: 10, pol: 'fifo', bursts: [2], sleeps: [] },
      { n: 'N', pr: 0, pol: 'other', bursts: [2], sleeps: [] },
    ].map((t, i) => ({ ...t, i, b: 0, rem: t.bursts[0], slice: RT_SL, wake: null, fin: null }));
    const lists = {}; const L = (p) => (lists[p] = lists[p] || []);
    T.forEach((t) => L(t.pr).push(t));
    const prios = () => Object.keys(lists).map(Number).sort((a, b) => b - a);
    const top = () => { for (const p of prios()) if (lists[p].length) return lists[p][0]; return null; };
    let run = null, t = 0; const frames = [], segs = [];
    for (; t < 40; t++) {
      const e = [];
      if (run) {
        if (run.rem === 0) {
          if (run.b < run.bursts.length - 1) { run.wake = t + run.sleeps[run.b]; run.b++; run.rem = run.bursts[run.b]; e.push({ k: 'sleep', p: run.n, until: run.wake }); }
          else { run.fin = t; e.push({ k: 'fin', p: run.n }); }
          run = null;
        } else if (run.pol === 'rr' && run.slice === 0) {
          run.slice = RT_SL;
          if (lists[run.pr].length) { lists[run.pr].push(run); e.push({ k: 'slice', p: run.n, behind: lists[run.pr][0].n }); run = null; }
          else e.push({ k: 'alone', p: run.n });
        }
      }
      for (const x of T) if (x.wake === t) { x.wake = null; L(x.pr).push(x); e.push({ k: 'wake', p: x.n, pr: x.pr }); }
      if (run) { const h = top(); if (h && h.pr > run.pr) { lists[run.pr].unshift(run); e.push({ k: 'pre', p: run.n, by: h.n, left: run.slice }); run = null; } }
      if (!run) { const h = top(); if (h) { lists[h.pr].shift(); run = h; e.push({ k: 'go', p: h.n, slice: h.pol === 'rr' ? h.slice : null }); } }
      frames.push({ t, run: run ? run.n : null, e, q: prios().map((p) => [p, lists[p].map((x) => x.n)]), done: T.filter((x) => x.fin != null).map((x) => x.n) });
      if (!run && T.every((x) => x.fin != null)) break;
      if (run) {
        run.rem--; if (run.pol === 'rr') run.slice--;
        const last = segs[segs.length - 1];
        if (last && last.p === run.n && last.b === t) last.b++; else segs.push({ p: run.n, a: t, b: t + 1 });
      }
    }
    return { frames, segs, end: t, fin: Object.fromEntries(T.map((x) => [x.n, x.fin])), threads: T };
  }

  // one-line schedule in ms, e.g. "A 0–100, B 100–250, ..." (used by the notes)
  const schedText = (pol, ev) => rtSim(pol, ev).segs.map((g) => `${g.p} ${g.a * 50}–${g.b * 50}`).join(', ');

  /* ---------- engine 2: red-black tree keyed by (vruntime, insertion order) (step 7) ---------- */
  function makeRB() {
    const NIL = { red: false }; NIL.l = NIL.r = NIL.p = NIL;
    let root = NIL, rots = 0;
    const less = (a, b) => a.vr < b.vr - 1e-9 || (Math.abs(a.vr - b.vr) <= 1e-9 && a.seq < b.seq);
    function rot(x, dir) {
      rots++;
      const o = dir === 'l' ? 'r' : 'l', y = x[o];
      x[o] = y[dir]; if (y[dir] !== NIL) y[dir].p = x;
      y.p = x.p; if (x.p === NIL) root = y; else if (x === x.p.l) x.p.l = y; else x.p.r = y;
      y[dir] = x; x.p = y;
    }
    function insert(z) {
      let y = NIL, x = root;
      while (x !== NIL) { y = x; x = less(z, x) ? x.l : x.r; }
      z.p = y; z.l = z.r = NIL; z.red = true;
      if (y === NIL) root = z; else if (less(z, y)) y.l = z; else y.r = z;
      while (z.p.red) {
        const g = z.p.p, left = z.p === g.l, u = left ? g.r : g.l, a = left ? 'l' : 'r', b = left ? 'r' : 'l';
        if (u.red) { z.p.red = false; u.red = false; g.red = true; z = g; }
        else { if (z === z.p[b]) { z = z.p; rot(z, a); } z.p.red = false; g.red = true; rot(g, b); }
      }
      root.red = false;
    }
    function transplant(u, v) { if (u.p === NIL) root = v; else if (u === u.p.l) u.p.l = v; else u.p.r = v; v.p = u.p; }
    const minOf = (x) => { while (x.l !== NIL) x = x.l; return x; };
    function remove(z) {
      let y = z, yRed = y.red, x;
      if (z.l === NIL) { x = z.r; transplant(z, z.r); }
      else if (z.r === NIL) { x = z.l; transplant(z, z.l); }
      else { y = minOf(z.r); yRed = y.red; x = y.r; if (y.p === z) x.p = y; else { transplant(y, y.r); y.r = z.r; y.r.p = y; } transplant(z, y); y.l = z.l; y.l.p = y; y.red = z.red; }
      if (!yRed) {
        while (x !== root && !x.red) {
          const left = x === x.p.l, a = left ? 'l' : 'r', b = left ? 'r' : 'l';
          let w = x.p[b];
          if (w.red) { w.red = false; x.p.red = true; rot(x.p, a); w = x.p[b]; }
          if (!w.l.red && !w.r.red) { w.red = true; x = x.p; }
          else { if (!w[b].red) { w[a].red = false; w.red = true; rot(w, b); w = x.p[b]; } w.red = x.p.red; x.p.red = false; w[b].red = false; rot(x.p, a); x = root; }
        }
        x.red = false;
      }
      NIL.p = NIL;
    }
    // in-order list of {n, d} (node and depth): x position = index, y position = depth
    function inorder() { const out = []; (function go(n, d) { if (n === NIL) return; go(n.l, d + 1); out.push({ n, d }); go(n.r, d + 1); })(root, 0); return out; }
    return { insert, remove, inorder, NIL, first: () => (root === NIL ? null : minOf(root)), rotations: () => rots, root: () => root };
  }

  Guide.section({
    id: '10.3',
    title: 'Linux Scheduling',
    short: 'Linux scheduling',
    summary: 'Linux real-time classes, the O(1) scheduler, and the Completely Fair Scheduler with its virtual runtimes.',
    objectives: [
      'Name the Linux scheduling classes and policies, and explain why real-time threads always run before normal ones.',
      'Trace SCHED_FIFO and SCHED_RR threads, including what happens on preemption, sleep and the end of a slice.',
      'Explain how the O(1) scheduler of Linux 2.6 picked a task in constant time with active and expired arrays and a bitmap.',
      'Compute CFS weights, processor shares, slices and virtual runtimes from nice values.',
      'Place the Linux schedulers on a timeline, from O(1) through CFS to EEVDF.',
    ],
    terms: [
      ['Scheduling class', 'A family of scheduling rules inside the Linux kernel. Every thread belongs to one class; the kernel always serves the highest class that has a runnable thread, and each class orders its own threads.'],
      ['SCHED_FIFO', 'A Linux real-time policy with no time slice: the thread keeps the processor until it blocks, gives the processor up, or a higher-priority real-time thread becomes ready.'],
      ['SCHED_RR', 'A Linux real-time policy that works like SCHED_FIFO plus a time slice (100 ms by default): when the slice runs out, the thread goes to the back of the list for its priority.'],
      ['SCHED_OTHER (SCHED_NORMAL)', 'The default Linux policy for ordinary threads; the kernel source calls it SCHED_NORMAL. These threads share the processor through the fair class, guided by their nice values.'],
      ['SCHED_DEADLINE', 'A Linux policy (since kernel 3.14) for tasks that declare how much run time they need in every period and by when. The kernel serves the earliest deadline first, ahead of every other class.'],
      ['Real-time priority', 'A number from 1 (lowest) to 99 (highest) given to a SCHED_FIFO or SCHED_RR thread. A ready thread with a higher real-time priority always runs before one with a lower number.'],
      ['Run queue', 'The structure, one per processor, in which the Linux scheduler keeps the threads that are ready to run on that processor.'],
      ['O(1) scheduler', 'The Linux scheduler from 2.6.0 (2003) to 2.6.22. It chose the next task in constant time, however many tasks were waiting, using priority lists, an active and an expired array and a bitmap.'],
      ['Active and expired arrays', 'The two sets of 140 priority lists in each O(1) run queue. Tasks with slice left wait in the active array; a task that uses up its slice moves to the expired array; when the active array is empty, the two swap.'],
      ['Priority bitmap', 'A row of 140 bits, one per priority list, where a 1 means “this list is not empty”. Finding the first 1 bit names the best non-empty list in a few instructions.'],
      ['Sleep bonus', 'In the O(1) scheduler, a change of up to 5 priority levels either way: tasks that sleep a lot (usually interactive ones) move up, tasks that never sleep move down.'],
      ['Load balancing', 'Moving ready tasks from busier processors’ run queues to less busy ones, so that no processor sits idle while another has a backlog.'],
      ['Completely Fair Scheduler (CFS)', 'The Linux scheduler for normal threads from 2.6.23 (2007) to 6.5. It always runs the task that has received the least weighted processor time, so each task gets a share in proportion to its weight.'],
      ['Virtual runtime (vruntime)', 'A task’s processor time scaled by its weight. It grows at the real rate for a nice-0 task, more slowly for a heavier task and faster for a lighter one. CFS runs the task with the smallest value.'],
      ['Load weight', 'The number CFS derives from a nice value: 1024 at nice 0, about 1.25 times more for each step down and 1.25 times less for each step up. A task’s share is its weight divided by the total weight of the runnable tasks.'],
      ['Red-black tree', 'A self-balancing binary search tree. Its colouring rules keep the longest path from the root at most twice the shortest, so inserting or removing an item takes time proportional to log n.'],
      ['Targeted latency', 'The CFS window (6 ms by default from 2.6.36; 20 ms in 2.6.23) within which every runnable task should get one turn. Each task’s slice is its weight’s share of that window.'],
      ['Minimum granularity', 'The shortest turn CFS hands out (0.75 ms by default from 2.6.36), so that switching costs never swamp useful work. With many tasks, the window grows instead of the turns shrinking.'],
      ['Earliest Eligible Virtual Deadline First (EEVDF)', 'The fair-class algorithm that replaced CFS in Linux 6.6 (2023). Among the tasks that are owed processor time, it runs the one whose virtual deadline comes first.'],
    ],
    css: `
      .sec-10-3 svg { display: block; }
      .sec-10-3 svg .pc0 { fill: color-mix(in srgb, var(--cpu) 30%, var(--panel)); stroke: var(--cpu); }
      .sec-10-3 svg .pc1 { fill: color-mix(in srgb, var(--mem) 30%, var(--panel)); stroke: var(--mem); }
      .sec-10-3 svg .pc2 { fill: color-mix(in srgb, var(--io) 30%, var(--panel)); stroke: var(--io); }
      .sec-10-3 svg .pc3 { fill: color-mix(in srgb, var(--os) 30%, var(--panel)); stroke: var(--os); }
      .sec-10-3 svg .pc4 { fill: color-mix(in srgb, var(--proc) 30%, var(--panel)); stroke: var(--proc); }
      .sec-10-3 svg .gl { stroke: var(--line); stroke-width: 1; }
      .sec-10-3 svg .ax { font-size: 13px; fill: var(--muted); }
      .sec-10-3 svg .lbl { font-size: 14px; font-weight: 800; }
      .sec-10-3 svg .bl { font-size: 13px; font-weight: 800; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
      .sec-10-3 svg .cur { stroke: var(--accent); stroke-width: 2.5; }
      .sec-10-3 .tk { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 30px; height: 28px; padding: 0 7px;
        border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); font-weight: 800; font-size: 14.5px; flex: none; }
      .sec-10-3 .tk.pc0 { background: color-mix(in srgb, var(--cpu) 20%, var(--panel)); border-color: var(--cpu); }
      .sec-10-3 .tk.pc1 { background: color-mix(in srgb, var(--mem) 20%, var(--panel)); border-color: var(--mem); }
      .sec-10-3 .tk.pc2 { background: color-mix(in srgb, var(--io) 20%, var(--panel)); border-color: var(--io); }
      .sec-10-3 .tk.pc3 { background: color-mix(in srgb, var(--os) 20%, var(--panel)); border-color: var(--os); }
      .sec-10-3 .tk.pc4 { background: color-mix(in srgb, var(--proc) 20%, var(--panel)); border-color: var(--proc); }
      .sec-10-3 .tk.run { box-shadow: 0 0 0 3px var(--accent); }
      .sec-10-3 .tk small { font-weight: 600; font-size: 12.5px; color: var(--ink-2); }
      .sec-10-3 .msg { border-radius: 10px; padding: 8px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .sec-10-3 .msg.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-10-3 .msg.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-10-3 .msg.info { border-color: var(--accent); background: var(--accent-bg); }
      .sec-10-3 .eq { font-family: var(--mono); font-size: 14.5px; background: var(--panel-3); border-radius: 8px; padding: 6px 10px; }
      .sec-10-3 .num { font-variant-numeric: tabular-nums; }
      .sec-10-3 table.tbl td.r, .sec-10-3 table.tbl th.r { text-align: right; }
      .sec-10-3 table.tbl td.c, .sec-10-3 table.tbl th.c { text-align: center; }
    `,
    steps: [
      /* ---------------- 1. Big picture: classes stacked in a strict order ---------------- */
      {
        title: 'One kernel, three kinds of urgency',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">The same Linux kernel runs a music player that must never stutter, a robot arm that must react within a millisecond, and a simulation that grinds for a week. One policy cannot suit all three.</p>
              <p class="m0">So Linux keeps several <span class="t">scheduling classes</span> stacked in a strict order. It schedules threads (the kernel calls each one a <i>task</i>), and each thread belongs to one class. A lower class gets the processor only when every class above it has nothing ready.</p>
              <p class="m0">Inside a class, the class’s own rules decide. Real-time threads go strictly by <span class="t">real-time priority</span>. Ordinary threads <b>share</b> the processor, and how that sharing works has been redesigned three times: the O(1) scheduler (2003), the <span class="t">Completely Fair Scheduler</span> (2007) and EEVDF (2023).</p>
              <div class="callout analogy m0" data-label="Analogy">A hospital: patients booked for an operation at a fixed time are handled first, emergencies are seen strictly by severity, and everyone else shares the remaining doctors’ time fairly. A critical case never waits behind a routine check-up.</div>
              <div class="row gap-s small"><span class="chip os">compare FIFO and RR</span><span class="chip cpu">swap O(1) arrays</span><span class="chip mem">compute CFS shares</span><span class="chip proc">grow a red-black tree</span></div>
            </div>
            <div class="card stack" style="gap:8px">
              <h4 class="m0">The class ladder (top is served first): click a policy</h4>
              <div class="ladder stack" style="gap:6px"></div>
              <div class="card white grow pdet" style="display:flex;flex-direction:column;gap:6px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const bands = [
            ['Deadline class', 'intr', [
              ['SCHED_DEADLINE', 'Since Linux 3.14 (2014).', 'A task declares three numbers: how much processing it needs (runtime), how soon each piece must be done (deadline) and how often it repeats (period), for example 2 ms of work every 10 ms. The kernel admits the task only if the processors have enough spare capacity for it, then always runs the ready task whose deadline is earliest.', 'Outranks every other class, including real-time. Section 10.2 explains deadline scheduling itself.'],
            ]],
            ['Real-time class', 'cpu', [
              ['SCHED_FIFO', 'Defined by the POSIX real-time standard.', 'Real-time priority 1 (lowest) to 99 (highest). The thread has no time slice: it keeps the processor until it blocks, gives the processor up, or a ready thread with a higher real-time priority appears.', 'Typical use: a motor-control or audio thread that must react immediately.'],
              ['SCHED_RR', 'Also from the POSIX standard.', 'Exactly like SCHED_FIFO, plus a time slice (100 ms by default). When the slice runs out, the thread goes to the back of the list for its priority, so threads of equal priority take turns.', 'Typical use: several real-time threads of equal importance that must share fairly.'],
            ]],
            ['Fair class (normal threads)', 'mem', [
              ['SCHED_OTHER', 'The default policy.','Shells, browsers, editors and compilers live here (the kernel source calls this policy SCHED_NORMAL). They share the processor according to their nice values, −20 to +19. The rules for sharing were the O(1) scheduler until 2.6.22, CFS from 2.6.23 to 6.5, and EEVDF since 6.6.', 'Never runs while a real-time or deadline thread is ready on that processor.'],
              ['SCHED_BATCH', 'Since Linux 2.6.16 (2006).', 'For long processor-bound jobs that nobody is waiting on, such as a big compile. The scheduler assumes the thread is processor-bound and gives it a small disadvantage when it wakes up, so it does not interrupt interactive work.', 'Still shares by nice value, like SCHED_OTHER.'],
              ['SCHED_IDLE', 'Since Linux 2.6.23 (2007).', `For background jobs of the very lowest importance. It stays in the fair class with a tiny weight of ${IDLE_W} (nice +19 has ${weightOf(19)}, nice 0 has ${weightOf(0)}), so beside one busy nice-0 thread it still gets about ${pct(IDLE_W / (IDLE_W + weightOf(0)))} of the processor. Mostly it soaks up time that would otherwise go unused.`, 'Good for a file indexer or a volunteer-computing client.'],
            ]],
          ];
          const ladder = ctx.$('.ladder'), det = ctx.$('.pdet');
          const btns = [];
          bands.forEach(([name, cls, pols], bi) => {
            const row = h('div', { class: 'row gap-s', style: { flexWrap: 'nowrap' } },
              h('span', { class: 'chip ' + cls, style: { minWidth: '30px', justifyContent: 'center' } }, String(bi + 1)),
              h('b', { class: 'small', style: { width: '128px', flex: 'none', lineHeight: '1.2' } }, name),
              h('div', { class: 'row gap-s' }, ...pols.map((p) => { const b = h('button', { class: 'btn sm ' + cls, type: 'button', onclick: () => show(p, cls, b) }, p[0]); btns.push(b); return b; })));
            ladder.append(h('div', { class: 'card tight ' + cls }, row));
          });
          function show(p, cls, b) {
            btns.forEach((x) => x.classList.toggle('on', x === b));
            det.innerHTML = '';
            det.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'mono', style: { fontSize: '18px' }, html: /BATCH|IDLE/.test(p[0]) ? p[0] : `<span class="t">${p[0]}</span>` }), h('span', { class: 'chip ' + cls }, p[1])),
              h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.5' } }, p[2]),
              h('p', { class: 'small muted m0' }, p[3]));
          }
          show(bands[1][2][0], 'cpu', btns[1]);
        },
      },
      /* ---------------- 2. Two number scales, one internal line ---------------- */
      {
        title: 'Priority numbers: two scales, one line',
        kind: 'learn',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Two different numbers describe how urgent a Linux thread is, and they point in opposite directions.</p>
              <ul class="m0" style="display:flex;flex-direction:column;gap:4px">
                <li><b>Real-time threads:</b> a <span class="t">real-time priority</span> from 1 to 99. <b>Bigger is more urgent.</b></li>
                <li><b>Normal threads:</b> a <span class="t">nice value</span> from −20 to +19. A “nicer” thread asks for less, so <b>smaller is more favoured</b>.</li>
                <li><b>Inside the kernel:</b> one line of 140 levels where <b>smaller is more important</b>. 0–99 are real-time (99 − real-time priority); 100–139 are normal (120 + nice).</li>
              </ul>
              <div class="callout warn m0" data-label="Common mistake">“A higher number wins” holds only for real-time priorities. For nice values and kernel numbers, lower wins.</div>
              <div class="callout why m0" data-label="Safety valve">By default real-time threads may use at most 95% of each second. About 50 ms per second stays free for normal threads, so a runaway real-time loop cannot lock you out.</div>
            </div>
            <div class="card stack prio-card" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const card = ctx.$('.prio-card');
          const st = { X: { rt: true, v: 50 }, Y: { rt: false, v: 0 } };
          const kern = (t) => (t.rt ? 99 - t.v : 120 + t.v);
          const W = ctx.narrow ? 380 : 600, x0 = 18, x1 = W - 18, X = (k) => x0 + ((x1 - x0) * k) / 139;
          const svg = s('svg', { viewBox: `0 0 ${W} 112`, width: '100%' });
          const table = h('div'), verdict = h('div', { class: 'msg info' });
          function controls(name, cls) {
            const t = st[name];
            const sl = ctx.ui.slider({ label: '', min: 1, max: 99, value: t.v, onInput: (v) => { t.v = v; draw(); } });
            const setRange = () => {
              sl.input.min = t.rt ? 1 : -20; sl.input.max = t.rt ? 99 : 19;
              sl.querySelector('label').textContent = t.rt ? 'real-time priority' : 'nice value';
              sl.set(t.v, false);
            };
            const seg = ctx.ui.seg([{ value: 'rt', label: 'Real-time' }, { value: 'n', label: 'Normal' }], t.rt ? 'rt' : 'n', (v) => {
              t.rt = v === 'rt'; t.v = t.rt ? 50 : 0; setRange(); draw();
            });
            setRange();
            return h('div', { class: 'card tight white stack', style: { gap: '6px' } }, h('div', { class: 'row gap-s' }, h('span', { class: 'tk ' + cls }, name), seg), sl);
          }
          function draw() {
            const kx = kern(st.X), ky = kern(st.Y);
            const mk = (k, name, cls, up) => {
              const x = X(k), y = up ? 30 : 74;
              return s('g', {},
                s('path', { d: up ? `M${x - 8} ${y - 16} L${x + 8} ${y - 16} L${x} ${y - 2} Z` : `M${x - 8} ${y + 16} L${x + 8} ${y + 16} L${x} ${y + 2} Z`, class: cls, 'stroke-width': 2 }),
                s('text', { x: x > W - 90 ? x - 12 : x + 12, y: up ? y - 12 : y + 16, class: 'lbl', 'text-anchor': x > W - 90 ? 'end' : 'start' }, `${name} = ${k}`));
            };
            svg.replaceChildren(
              s('rect', { x: X(0), y: 34, width: X(99.5) - X(0), height: 36, rx: 6, class: 's-cpu', 'stroke-width': 1.5 }),
              s('rect', { x: X(99.5), y: 34, width: X(139) - X(99.5), height: 36, rx: 6, class: 's-mem', 'stroke-width': 1.5 }),
              s('text', { x: (X(0) + X(99.5)) / 2, y: 57, 'text-anchor': 'middle', class: 'lbl', style: 'fill:var(--cpu)' }, 'real-time 0–99'),
              s('text', { x: (X(99.5) + X(139)) / 2, y: 57, 'text-anchor': 'middle', class: 'lbl', style: 'fill:var(--mem)' }, ctx.narrow ? 'normal' : 'normal 100–139'),
              s('text', { x: x0, y: 108, class: 'ax' }, '← more important'),
              s('text', { x: x1, y: 108, class: 'ax', 'text-anchor': 'end' }, 'less important →'),
              mk(kx, 'X', 'pc0', true), mk(ky, 'Y', 'pc1', false));
            const row = (n, t, k) => `<tr><td><b>${n}</b></td><td>${t.rt ? 'real-time' : 'normal'}</td><td class="r num">${t.rt ? t.v : 'nice ' + fmtN(t.v)}</td><td class="r num">${t.rt ? '99 − ' + t.v : '120 + (' + t.v + ')'} = <b>${k}</b></td></tr>`;
            table.innerHTML = `<table class="tbl compact"><tr><th>Thread</th><th>Class</th><th class="r">Its own number</th><th class="r">Kernel number</th></tr>${row('X', st.X, kx)}${row('Y', st.Y, ky)}</table>`;
            let v;
            if (st.X.rt && st.Y.rt) {
              v = kx === ky ? `<b>Same level (${kx}).</b> X and Y wait in one list. Under SCHED_FIFO the one that got there first runs until it blocks; under SCHED_RR they take turns, one slice each.`
                : `<b>${kx < ky ? 'X' : 'Y'} always runs first</b> whenever it is ready: real-time priority ${Math.max(st.X.v, st.Y.v)} beats ${Math.min(st.X.v, st.Y.v)}, and a lower-priority real-time thread waits as long as it takes.`;
            } else if (st.X.rt !== st.Y.rt) {
              v = `<b>${st.X.rt ? 'X' : 'Y'} always runs first.</b> Any ready real-time thread beats every normal thread, whatever the nice value. The normal one runs only when the real-time one blocks (or in the small reserve kept for normal threads).`;
            } else {
              const wx = weightOf(st.X.v), wy = weightOf(st.Y.v);
              v = `<b>Neither shuts the other out.</b> For normal threads the number sets a <i>share</i>, not a winner. Today’s fair scheduler gives X ${pct(wx / (wx + wy))} and Y ${pct(wy / (wx + wy))} of the processor when both are busy (step 5 shows where these numbers come from).`;
            }
            verdict.innerHTML = v;
          }
          card.append(
            h('h4', { class: 'm0' }, 'Place two threads on the kernel’s line'),
            h('div', { class: 'grid-2', style: { gap: '8px' } }, controls('X', 'pc0'), controls('Y', 'pc1')),
            h('div', { class: 'card white tight' }, svg), table, verdict);
          draw();
        },
      },
      /* ---------------- 3. FIFO versus RR, step by step ---------------- */
      {
        title: 'SCHED_FIFO versus SCHED_RR, step by step',
        kind: 'explore',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0">Five threads are ready at time 0: four real-time and one normal (<b>N</b>). Choose the policy of B and C (RR slice: 100 ms, the Linux default) and an event, then step through.</p>
              <div class="rt-tbl"></div>
              <div class="rt-ctl stack" style="gap:6px"></div>
              <div class="card tight small" style="line-height:1.4">
                <b>The rules for one priority level</b>
                <ul class="m0" style="padding-left:18px">
                  <li>Run the head of the <b>highest non-empty</b> list.</li>
                  <li><span class="t">SCHED_FIFO</span>: no slice; run until you block or yield, or a higher priority wakes.</li>
                  <li>Preempted by a higher priority → <b>head</b> of your list.</li>
                  <li>Woken, yielded, or <span class="t">SCHED_RR</span> slice used up → <b>tail</b>.</li>
                </ul>
              </div>
            </div>
            <div class="stack rt-right" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const NAMES = ['A', 'B', 'C', 'D', 'N'], PR = { A: 90, B: 50, C: 50, D: 10, N: 0 };
          const cls = (n) => 'pc' + NAMES.indexOf(n);
          const ms = (u) => u * 50 + ' ms';
          let pol = 'fifo', ev = 'none', sim = rtSim(pol, ev);
          const tblBox = ctx.$('.rt-tbl'), ctl = ctx.$('.rt-ctl'), right = ctx.$('.rt-right');
          function drawTable() {
            const P = { fifo: 'SCHED_FIFO', rr: 'SCHED_RR' }[pol];
            const rows = [['A', 'SCHED_FIFO', '90', '100 ms'], ['B', P, '50', '150 ms'], ['C', P, '50', '150 ms'], ['D', 'SCHED_FIFO', '10', '100 ms'], ['N', 'SCHED_OTHER', 'normal', '100 ms']];
            tblBox.innerHTML = `<table class="tbl compact"><tr><th>Thread</th><th>Policy</th><th class="r">Priority</th><th class="r">Needs</th></tr>${rows.map((r) => `<tr><td><span class="tk ${cls(r[0])}" style="height:22px;min-width:24px">${r[0]}</span></td><td class="mono" style="font-size:13.5px">${r[1]}</td><td class="r">${r[2]}</td><td class="r num">${r[3]}</td></tr>`).join('')}</table>`;
          }
          ctl.append(
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b', style: { width: '74px' } }, 'B and C:'), ctx.ui.seg([{ value: 'fifo', label: 'SCHED_FIFO' }, { value: 'rr', label: 'SCHED_RR' }], pol, (v) => { pol = v; rerun(); })),
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b', style: { width: '74px' } }, 'Event:'), ctx.ui.seg([{ value: 'none', label: 'none' }, { value: 'wake', label: 'A wakes at 150' }, { value: 'sleep', label: 'B sleeps at 150' }], ev, (v) => { ev = v; rerun(); })));
          /* Gantt chart */
          const NU = 14, Wd = ctx.narrow ? 380 : 660, LX = 34, RX = Wd - 14, LH = 36, TOP = 6;
          const ux = (u) => LX + ((RX - LX) * u) / NU;
          const svg = s('svg', { viewBox: `0 0 ${Wd} ${TOP + 5 * LH + 22}`, width: '100%' });
          const qbox = h('div', { class: 'row gap-s', style: { flexWrap: 'wrap' } });
          function drawGantt(i) {
            const f = sim.frames[i], t = f.t, kids = [];
            for (let u = 0; u <= NU; u++) {
              kids.push(s('line', { x1: ux(u), y1: TOP, x2: ux(u), y2: TOP + 5 * LH, class: 'gl' }));
              if (u % 2 === 0) kids.push(s('text', { x: ux(u), y: TOP + 5 * LH + 16, 'text-anchor': 'middle', class: 'ax' }, String(u * 50)));
            }
            kids.push(s('text', { x: 4, y: TOP + 5 * LH + 16, class: 'ax' }, 'ms'));
            NAMES.forEach((n, k) => kids.push(s('text', { x: 6, y: TOP + k * LH + LH / 2 + 5, class: 'lbl' }, n)));
            // sleeping intervals (dashed) up to now
            sim.frames.forEach((g) => g.e.forEach((e) => {
              if (e.k === 'sleep' && g.t <= t) { const k = NAMES.indexOf(e.p), b = Math.min(e.until, t + 1); kids.push(s('rect', { x: ux(g.t) + 1, y: TOP + k * LH + 6, width: Math.max(0, ux(b) - ux(g.t) - 2), height: LH - 12, rx: 4, fill: 'none', stroke: 'var(--muted)', 'stroke-dasharray': '4 3', 'stroke-width': 1.5 })); }
            }));
            sim.segs.forEach((sg) => {
              if (sg.a > t) return;
              const k = NAMES.indexOf(sg.p), b = Math.min(sg.b, t + 1);
              kids.push(s('rect', { x: ux(sg.a) + 1, y: TOP + k * LH + 4, width: ux(b) - ux(sg.a) - 2, height: LH - 8, rx: 5, class: cls(sg.p), 'stroke-width': 2 }));
              if (ux(b) - ux(sg.a) > 22) kids.push(s('text', { x: (ux(sg.a) + ux(b)) / 2, y: TOP + k * LH + LH / 2, class: 'bl' }, sg.p));
            });
            if (f.run || i < sim.frames.length - 1) kids.push(s('line', { x1: ux(t), y1: TOP - 4, x2: ux(t), y2: TOP + 5 * LH + 4, class: 'cur' }));
            svg.replaceChildren(...kids);
            // queues
            const lane = (label, names, extra) => h('div', { class: 'card tight', style: { padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '6px', ...(extra || {}) } },
              h('span', { class: 'xs b muted', style: { whiteSpace: 'nowrap' } }, label),
              ...(names.length ? names.map((n) => h('span', { class: 'tk ' + cls(n), style: { height: '24px', minWidth: '24px' } }, n)) : [h('span', { class: 'xs muted' }, 'empty')]));
            qbox.replaceChildren(
              lane('CPU', f.run ? [f.run] : [], { background: 'var(--cpu-bg)', borderColor: 'var(--cpu)' }),
              ...f.q.map(([p, names]) => lane(p === 0 ? 'normal' : 'prio ' + p, names)));
          }
          function caption(i) {
            const f = sim.frames[i], parts = [];
            const last = i === sim.frames.length - 1;
            f.e.forEach((e) => {
              if (e.k === 'fin') parts.push(`${e.p} finishes.`);
              else if (e.k === 'sleep') parts.push(`${e.p} blocks to wait for I/O until ${ms(e.until)}.`);
              else if (e.k === 'slice') parts.push(`${e.p} has used its whole 100 ms slice, so it moves to the <b>tail</b> of the priority-50 list, behind ${e.behind}.`);
              else if (e.k === 'alone') parts.push(`${e.p}’s slice is used up, but nobody else waits at priority ${PR[e.p]}, so it just gets a fresh slice.`);
              else if (e.k === 'wake') parts.push(`${e.p} wakes up and joins the <b>tail</b> of the priority-${e.pr} list.`);
              else if (e.k === 'pre') parts.push(`${e.by} (priority ${PR[e.by]}) outranks the running ${e.p}, so ${e.p} is preempted and goes back to the <b>head</b> of its list${pol === 'rr' && PR[e.p] === 50 ? `, keeping the ${ms(e.left)} left of its slice` : ''}.`);
              else if (e.k === 'go') {
                if (e.p === 'N') parts.push('Every real-time list is empty at last, so <b>N</b>, the normal thread, finally runs.');
                else parts.push(`${e.p} is at the head of the highest non-empty list, so it runs${e.slice != null ? ` (slice left: ${ms(e.slice)})` : ''}.`);
              }
            });
            if (!f.e.some((e) => e.k === 'go') && f.run) {
              const th = sim.threads.find((x) => x.n === f.run);
              const same = f.q.find(([p]) => p === PR[f.run]);
              parts.push(th.pol === 'fifo' && same && same[1].length ? `${f.run} keeps running: a SCHED_FIFO thread is never cut off by threads of its own priority.` : `${f.run} keeps running; nothing of higher priority is ready.`);
            }
            if (last) parts.push(`<b>All done at ${ms(sim.end)}.</b> Finish times: ${NAMES.map((n) => `${n} ${ms(sim.fin[n])}`).join(', ')}.`);
            return `<b>t = ${ms(f.t)}.</b> ` + parts.join(' ');
          }
          let player;
          const rerun = () => { sim = rtSim(pol, ev); drawTable(); player.setCount(sim.frames.length); player.go(0); };
          drawTable();
          player = ctx.ui.player({ count: sim.frames.length, render: (i) => { drawGantt(i); return caption(i); }, interval: 1700 });
          right.append(h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), qbox, player.el,
            h('div', { class: 'callout tip m0 small', 'data-label': 'Try this' }, 'With no event, compare SCHED_FIFO and SCHED_RR: who finishes first, B or C, and when does D start? Then choose “A wakes at 150” and watch where B goes when A takes the processor, and compare it with “B sleeps at 150”.'));
        },
      },
      /* ---------------- 4. The O(1) scheduler (2.6.0 - 2.6.22) ---------------- */
      {
        title: 'Linux 2.6: the O(1) scheduler',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack small" style="gap:8px;line-height:1.45">
              <p class="lead m0">Linux 2.6.0 (December 2003) was the first stable release with the <span class="t">O(1) scheduler</span>: picking the next task took the same time whether 5 or 5,000 tasks were waiting.</p>
              <p class="m0">Its predecessor in Linux 2.4 examined every runnable task at each decision, so the work grew with the number of tasks.</p>
              <ul class="m0" style="display:flex;flex-direction:column;gap:3px">
                <li>Each processor has its own <span class="t">run queue</span> holding two arrays of 140 lists, one list per priority: the <span class="t">active and expired arrays</span>.</li>
                <li>A <span class="t">priority bitmap</span> marks the non-empty lists. A “find first set bit” search, a handful of instructions, names the best list; the task at its head runs.</li>
                <li>Higher priority means a longer slice: ${o1Slice(139)} ms (nice +19) to ${o1Slice(100)} ms (nice −20) in 2.6.0–2.6.8, about 100 ms at nice 0; from 2.6.9, ${o1Slice9(139)} ms to ${o1Slice9(100)} ms, exactly ${o1Slice9(120)} ms at nice 0.</li>
                <li>A task that uses up its slice gets a fresh one and moves to the <b>expired</b> array. When the active array is empty, the two array pointers simply swap.</li>
              </ul>
              <div class="callout why m0" data-label="Why it matters">Every task with slice left runs before any task gets a second turn, so nobody starves, and every operation (pick, expire, swap) costs the same no matter how many tasks there are.</div>
            </div>
            <div class="stack" style="gap:10px">
              <div class="o1-tabs" style="min-height:0"></div>
              <div class="callout tip m0 small" data-label="Many processors">Each processor has its own run queue, so they rarely fight over one lock. <span class="t">Load balancing</span> keeps the queues even: in 2.6.0–2.6.6 a processor pulled tasks from the busiest queue every 200 ms when busy, every 1 ms when idle, and whenever its own queue ran empty. Later kernels tune this to the hardware layout.</div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const TASKS = [
            { n: 'T1', nice: -5, cls: 'pc0', hog: true },
            { n: 'T2', nice: 0, cls: 'pc1', hog: true },
            { n: 'T3', nice: 0, cls: 'pc2', hog: true },
            { n: 'T4', nice: 10, cls: 'pc3', hog: true },
            { n: 'E', nice: 0, cls: 'pc4', hog: false },
          ].map((t) => ({ ...t, stat: 120 + t.nice, dyn: 120 + t.nice + (t.hog ? 5 : -5), slice: o1Slice(120 + t.nice) }));
          const ROWS = [...new Set(TASKS.map((t) => t.dyn))].sort((a, b) => a - b);
          const byName = (n) => TASKS.find((t) => t.n === n);
          let st;
          function reset() {
            st = { A: {}, X: {}, clock: 0, left: {}, asleep: true, swaps: 0, log: 'All four number crunchers are in the <b>active</b> array; E, the editor, is asleep waiting for a keystroke. Press <b>Run 50 ms</b>.' };
            ROWS.forEach((p) => { st.A[p] = []; st.X[p] = []; });
            TASKS.forEach((t) => { st.left[t.n] = t.slice; if (t.hog) st.A[t.dyn].push(t.n); });
          }
          const firstSet = (arr) => ROWS.find((p) => arr[p].length);
          const empty = (arr) => firstSet(arr) == null;
          function runOnce() {
            if (empty(st.A)) {
              if (empty(st.X)) { st.log = 'Nothing is runnable.'; return 'idle'; }
              const tmp = st.A; st.A = st.X; st.X = tmp; st.swaps++;
              st.log = '<b>The active array is empty</b>, so the scheduler swaps the two array pointers. Every task has a fresh slice again, and no task was moved one by one.';
              return 'swap';
            }
            const p = firstSet(st.A), n = st.A[p][0], t = byName(n);
            const dt = Math.min(50, st.left[n], t.hog ? Infinity : 4);
            st.clock += dt; st.left[n] -= dt;
            if (!t.hog && st.left[n] > 0) {
              st.A[p].shift(); st.asleep = true;
              st.log = `First set bit: <b>${p}</b>. E runs for ${dt} ms, handles the keystroke and goes back to sleep, leaving the run queue.`;
              return 'sleep';
            }
            if (st.left[n] === 0) {
              st.A[p].shift(); st.left[n] = t.slice; st.X[p].push(n);
              st.log = `First set bit: <b>${p}</b>. ${n} runs ${dt} ms and has now used its whole ${t.slice} ms slice: it gets a fresh slice and moves to list ${p} of the <b>expired</b> array.`;
              return 'expire';
            }
            st.log = `First set bit: <b>${p}</b>. ${n} runs ${dt} ms; ${st.left[n]} ms of its slice remain, so it stays at the head of active list ${p}.`;
            return 'run';
          }
          function wake() {
            const e = byName('E'); st.asleep = false; st.A[e.dyn].push('E');
            const p = firstSet(st.A);
            const best = p === e.dyn && st.A[p][0] === 'E';
            const others = ROWS.filter((r) => r !== e.dyn).find((r) => st.A[r].length);
            st.log = `E wakes and joins list ${e.dyn} of the active array. ${best ? `${e.dyn} is now the first set bit, so E runs next${others != null ? `, ahead of the task at the head of list ${others}, which keeps its place` : ''}.` : 'A better list is still non-empty, so E waits its turn.'}`;
          }
          reset();
          function strip(arr, W) {
            const g = s('svg', { viewBox: `0 0 ${W} 40`, width: '100%' });
            const x0 = 66, cw = (W - x0 - 4) / 40, fs = firstSet(arr);
            const kids = [s('rect', { x: 2, y: 18, width: x0 - 8, height: 18, rx: 4, class: 's-cpu', 'stroke-width': 1 }),
              s('text', { x: (x0 - 6) / 2, y: 31.5, 'text-anchor': 'middle', class: 'ax', style: 'fill:var(--cpu)' }, '0–99: 0')];
            for (let k = 0; k < 40; k++) {
              const p = 100 + k, on = arr[p] && arr[p].length;
              kids.push(s('rect', { x: x0 + k * cw, y: 18, width: cw - 1, height: 18, class: on ? 's-ok' : 's-panel', 'stroke-width': on ? 1.5 : 0.5, style: on ? (p === fs ? 'fill:var(--accent);stroke:var(--accent)' : 'fill:var(--ok)') : '' }));
            }
            ROWS.forEach((p) => { if (arr[p].length) kids.push(s('text', { x: x0 + (p - 100 + 0.5) * cw, y: 13, 'text-anchor': 'middle', class: 'ax', style: p === fs ? 'fill:var(--accent);font-weight:800' : '' }, String(p))); });
            g.append(...kids);
            return g;
          }
          function arrayCard(name, arr, active) {
            const fs = firstSet(arr);
            return h('div', { class: 'card tight ' + (active ? 'cpu' : ''), style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, name), h('span', { class: 'xs muted' }, fs == null ? 'no bit set' : 'first set bit: ' + fs)),
              strip(arr, 300),
              ...ROWS.map((p) => h('div', { class: 'row gap-s', style: { flexWrap: 'nowrap', minHeight: '28px' } },
                h('span', { class: 'xs b muted', style: { width: '30px' } }, String(p)),
                ...(arr[p].length ? arr[p].map((n, k) => h('span', { class: 'tk ' + byName(n).cls + (active && p === fs && k === 0 ? ' run' : ''), style: { height: '24px' } }, n, h('small', {}, st.left[n] + ' ms'))) : [h('span', { class: 'xs muted' }, '—')]))));
          }
          function arraysTab(panel) {
            const box = h('div', { class: 'grid-2', style: { gap: '8px' } });
            const log = h('div', { class: 'msg info', style: { minHeight: '68px' } });
            const clock = h('span', { class: 'chip accent num' });
            const bWake = h('button', { class: 'btn sm proc', type: 'button', onclick: () => { wake(); paint(); } }, 'Wake E (keystroke)');
            const paint = () => {
              box.replaceChildren(arrayCard('Active array', st.A, true), arrayCard('Expired array', st.X, false));
              log.innerHTML = st.log; clock.textContent = `clock ${st.clock} ms · swaps ${st.swaps}`;
              bWake.disabled = !st.asleep;
            };
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } },
              box,
              h('div', { class: 'row gap-s' },
                h('button', { class: 'btn sm primary', type: 'button', onclick: () => { runOnce(); paint(); } }, 'Run 50 ms'),
                h('button', { class: 'btn sm', type: 'button', onclick: () => { for (let k = 0; k < 200; k++) { if (runOnce() === 'swap') break; } paint(); } }, 'Run to the swap'),
                bWake,
                h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); paint(); } }, 'Reset'),
                clock),
              log));
            paint();
          }
          function bonusTab(panel) {
            let nice = 0, credit = 0;
            const out = h('div', { class: 'stack', style: { gap: '8px' } });
            const draw = () => {
              const stat = 120 + nice, bonus = Math.floor((credit * 10) / 1000), raw = stat - bonus + 5, dyn = Math.max(100, Math.min(139, raw));
              out.innerHTML = `
                <div class="row" style="gap:18px;align-items:flex-end">
                  <div><div class="xs muted b">STATIC</div><div class="big" style="font-size:32px">${stat}</div></div>
                  <div><div class="xs muted b">BONUS</div><div class="big" style="font-size:32px">${bonus}</div></div>
                  <div><div class="xs muted b">DYNAMIC</div><div class="big" style="font-size:32px;color:var(--chc)">${dyn}</div></div>
                  <div><div class="xs muted b">SLICE (2.6.0)</div><div class="big" style="font-size:32px">${o1Slice(stat)} ms</div></div>
                </div>
                <div class="eq">dynamic = static − bonus + 5 = ${stat} − ${bonus} + 5 = ${raw}${dyn !== raw ? ` → kept inside 100–139: ${dyn}` : ''}</div>
                <div class="msg ${dyn < stat ? 'ok' : dyn > stat ? 'bad' : ''}">${dyn < stat ? `Lots of sleep: the task looks interactive and climbs ${stat - dyn} level${stat - dyn === 1 ? '' : 's'} above its static priority.` : dyn > stat ? `Little sleep: the task looks processor-bound and drops ${dyn - stat} level${dyn - stat === 1 ? '' : 's'} below its static priority.` : 'Middling sleep: no change.'} The slice depends only on the static priority.</div>`;
            };
            panel.append(h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0 small' }, 'A task earns sleep credit while it is blocked and spends it while it runs (1 second’s worth at most). The credit becomes a bonus from 0 to 10, which moves the priority up to 5 levels either way: the sleep bonus.'),
              ctx.ui.slider({ label: 'nice value', min: -20, max: 19, value: nice, format: fmtN, onInput: (v) => { nice = v; draw(); } }),
              ctx.ui.slider({ label: 'sleep credit', min: 0, max: 1000, step: 50, value: credit, format: (v) => v + ' ms', onInput: (v) => { credit = v; draw(); } }),
              out,
              h('p', { class: 'xs muted m0' }, 'A very interactive task could even skip the expired array when its slice ran out. Such guesses grew complicated and could be fooled, one reason CFS replaced them.')));
            draw();
          }
          ctx.$('.o1-tabs').append(ctx.ui.tabs([{ label: 'Arrays and bitmap', render: arraysTab }, { label: 'Sleep bonus', render: bonusTab }]));
        },
      },
      /* ---------------- 5. CFS: virtual runtime and weights ---------------- */
      {
        title: 'CFS: run whoever has had the least',
        kind: 'learn',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">In Linux 2.6.23 (October 2007) the <span class="t">Completely Fair Scheduler</span> took over normal threads. It imitates an ideal processor that runs every ready task at once, each at its fair share.</p>
              <ol class="m0" style="display:flex;flex-direction:column;gap:4px">
                <li>Each task keeps a <span class="t">virtual runtime</span> (vruntime): the processor time it has received, scaled by its weight.</li>
                <li>The rule is one line: <b>run the task with the smallest vruntime</b>, the one that has been served least so far.</li>
                <li>The nice value sets a <span class="t">load weight</span>: 1024 at nice 0, about 1.25× more per step down, 1.25× less per step up. A busy task’s share = its weight ÷ the total weight.</li>
              </ol>
              <div class="eq">vruntime += time actually run × 1024 ÷ weight</div>
              <div class="callout why m0" data-label="Why it works">A heavy task’s vruntime creeps up slowly, so it is picked more often; a light one’s races ahead. No sleep guesswork: an editor that mostly sleeps keeps a small vruntime and runs promptly when a key arrives.</div>
            </div>
            <div class="card stack calc" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const card = ctx.$('.calc');
          let nx = 0, ny = 5;
          const out = h('div', { class: 'stack', style: { gap: '10px' } });
          const draw = () => {
            const wx = weightOf(nx), wy = weightOf(ny), sum = wx + wy, sx = wx / sum, sy = wy / sum;
            const vx = (10 * 1024) / wx, vy = (10 * 1024) / wy, vSec = (1000 * 1024) / sum;
            out.innerHTML = `
              <table class="tbl compact"><tr><th>Task</th><th class="r">nice</th><th class="r">weight</th><th class="r">share</th><th class="r">vruntime per 10 ms run</th></tr>
                <tr><td><span class="tk pc0" style="height:22px">X</span></td><td class="r num">${fmtN(nx)}</td><td class="r num">${wx}</td><td class="r num"><b>${pct(sx)}</b></td><td class="r num">${ctx.util.fmt(vx, 2)} ms</td></tr>
                <tr><td><span class="tk pc1" style="height:22px">Y</span></td><td class="r num">${fmtN(ny)}</td><td class="r num">${wy}</td><td class="r num"><b>${pct(sy)}</b></td><td class="r num">${ctx.util.fmt(vy, 2)} ms</td></tr></table>
              <div style="display:flex;height:34px;border-radius:9px;overflow:hidden;border:1px solid var(--line-2)">
                <div style="width:${sx * 100}%;background:color-mix(in srgb, var(--cpu) 30%, var(--panel));display:grid;place-items:center;font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden">${sx >= 0.12 ? 'X ' + pct(sx) : ''}</div>
                <div style="width:${sy * 100}%;background:color-mix(in srgb, var(--mem) 30%, var(--panel));display:grid;place-items:center;font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden">${sy >= 0.12 ? 'Y ' + pct(sy) : ''}</div>
              </div>
              <div class="eq">share of X = ${wx} ÷ (${wx} + ${wy}) = ${pct(sx)}</div>
              <div class="msg info">${wx === wy ? `Equal weights: over one busy second X and Y each run <b>${ctx.util.fmt(sx * 1000, 1)} ms</b>, and both vruntimes grow by ${ctx.util.fmt(vSec, 1)} ms. Move a slider to see the shares split.` : `Over one busy second, X runs <b>${ctx.util.fmt(sx * 1000, 1)} ms</b> and Y runs <b>${ctx.util.fmt(sy * 1000, 1)} ms</b>, yet <b>both vruntimes grow by the same ${ctx.util.fmt(vSec, 1)} ms</b>. Equal virtual time, unequal real time: that is what “fair” means to CFS.`}${nx === ny ? '' : ` One nice step changes the weight about 1.25×, so ${Math.abs(nx - ny)} step${Math.abs(nx - ny) === 1 ? '' : 's'} give a weight ratio of ${ctx.util.fmt(Math.max(wx, wy) / Math.min(wx, wy), 2)} (1.25<sup>${Math.abs(nx - ny)}</sup> ≈ ${ctx.util.fmt(1.25 ** Math.abs(nx - ny), 2)}).`}</div>`;
          };
          const wt = h('div');
          const drawW = () => {
            const ns = ctx.util.range(11).map((k) => k - 5);
            wt.innerHTML = `<table class="tbl compact" style="font-size:13.5px"><tr><th>nice</th>${ns.map((n) => `<th class="c">${fmtN(n)}</th>`).join('')}</tr><tr><td class="b">weight</td>${ns.map((n) => `<td class="c num" style="${n === nx || n === ny ? 'background:var(--accent-bg);font-weight:800' : ''}">${weightOf(n)}</td>`).join('')}</tr></table>`;
          };
          card.append(
            h('h4', { class: 'm0' }, 'Nice-to-weight calculator: two busy tasks, one processor'),
            ctx.ui.slider({ label: 'nice of X', min: -20, max: 19, value: nx, format: fmtN, onInput: (v) => { nx = v; draw(); drawW(); } }),
            ctx.ui.slider({ label: 'nice of Y', min: -20, max: 19, value: ny, format: fmtN, onInput: (v) => { ny = v; draw(); drawW(); } }),
            out, wt);
          drawW();
          draw();
        },
      },
      /* ---------------- 6. CFS lab: three busy tasks ---------------- */
      {
        title: 'CFS lab: watch virtual runtimes stay level',
        kind: 'lab',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack cfs-left" style="gap:8px"></div>
            <div class="stack cfs-right" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const NM = ['X', 'Y', 'Z'], nice = [0, 0, 5];
          let T, seq, clock, turns, last, gen = 0, timer = null;
          function reset() {
            gen++; stopPlay();
            T = NM.map((n, i) => ({ n, i, vr: 0, rt: 0, seq: i }));
            seq = 3; clock = 0; turns = 0; last = null;
          }
          const W = () => T.map((t) => weightOf(nice[t.i]));
          const order = () => T.slice().sort((a, b) => (Math.abs(a.vr - b.vr) > 1e-9 ? a.vr - b.vr : a.seq - b.seq));
          function turn() {
            const w = W(), sum = w.reduce((a, b) => a + b, 0), P = period(T.length);
            const pick = order()[0], wi = w[pick.i];
            const ideal = (P * wi) / sum, sl = Math.max(GRAN, ideal), dv = (sl * 1024) / wi;
            last = { n: pick.n, from: pick.vr, sl, ideal, wi, sum, dv, P };
            pick.rt += sl; pick.vr += dv; pick.seq = seq++; clock += sl; turns++;
          }
          const left = ctx.$('.cfs-left'), right = ctx.$('.cfs-right');
          const info = h('div'), shareTbl = h('div');
          const sliders = NM.map((n, i) => ctx.ui.slider({ label: `nice of ${n}`, min: -20, max: 19, value: nice[i], format: fmtN, onInput: (v) => { nice[i] = v; reset(); paint(); } }));
          const bPlay = h('button', { class: 'btn sm', type: 'button', onclick: () => (timer ? stopPlay() : startPlay()) }, 'Play');
          function startPlay() { const g = gen; bPlay.textContent = 'Pause'; timer = ctx.every(650, () => { if (g !== gen) return; turn(); paint(); }); }
          function stopPlay() { if (timer) clearInterval(timer); timer = null; bPlay.textContent = 'Play'; }
          left.append(
            h('p', { class: 'm0' }, 'Three processor-bound tasks share one processor under CFS. Set their nice values, then run turns and compare the two bar charts.'),
            ...sliders,
            h('div', { class: 'row gap-s' },
              h('button', { class: 'btn sm primary', type: 'button', onclick: () => { turn(); paint(); } }, 'Run one turn'),
              bPlay,
              h('button', { class: 'btn sm', type: 'button', onclick: () => { for (let k = 0; k < 400 && clock < 60 - 1e-9; k++) turn(); paint(); } }, 'Run to 60 ms'),
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); paint(); } }, 'Reset')),
            info, shareTbl,
            h('div', { class: 'callout tip m0 small', 'data-label': 'Try this' }, 'Run to 60 ms and compare the measured shares with the targets. Then give Z nice −5, or Y nice +19, predict the new shares, and run again.'));
          const BW = ctx.narrow ? 380 : 640, LX = 30, RX = BW - 90, BH = 32;
          const svg = s('svg', { viewBox: `0 0 ${BW} 304`, width: '100%' });
          const orderRow = h('div', { class: 'row gap-s' });
          const narr = h('div', { class: 'msg info', style: { minHeight: '72px' } });
          right.append(h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), orderRow, narr,
            h('div', { class: 'callout why m0 small', 'data-label': 'Read the charts' }, 'Top: vruntime, the key CFS sorts by. It always runs the smallest, so these bars stay level, never more than one turn apart. Bottom: real time, which splits in proportion to weight.'));
          function paint() {
            const w = W(), sum = w.reduce((a, b) => a + b, 0), P = period(T.length);
            const max = Math.max(1, ...T.map((t) => Math.max(t.vr, t.rt))) * 1.04;
            const bx = (v) => LX + ((RX - LX) * v) / max;
            const kids = [];
            const group = (y0, title, key) => {
              kids.push(s('text', { x: 0, y: y0, class: 'lbl' }, title));
              T.forEach((t, k) => {
                const y = y0 + 8 + k * (BH + 7), v = t[key];
                kids.push(s('text', { x: 4, y: y + BH / 2 + 5, class: 'lbl' }, t.n));
                kids.push(s('rect', { x: LX, y, width: RX - LX, height: BH, rx: 5, class: 's-panel', 'stroke-width': 0.5 }));
                if (v > 0) kids.push(s('rect', { x: LX, y, width: Math.max(2, bx(v) - LX), height: BH, rx: 5, class: 'pc' + t.i, 'stroke-width': 1.5 }));
                kids.push(s('text', { x: RX + 8, y: y + BH / 2 + 5, class: 'ax', style: 'fill:var(--ink)' }, ctx.util.fmt(v, 2) + ' ms'));
              });
            };
            group(16, 'Virtual runtime (vruntime)', 'vr');
            group(168, 'Real processor time received', 'rt');
            svg.replaceChildren(...kids);
            const sorted = order();
            orderRow.replaceChildren(h('span', { class: 'xs b muted' }, 'Tree order (smallest vruntime first):'),
              ...sorted.map((t, k) => h('span', { class: 'tk pc' + t.i, style: { height: '26px' } }, t.n, h('small', {}, ctx.util.fmt(t.vr, 2) + (k === 0 ? ' · next' : '')))));
            const slices = T.map((t) => Math.max(GRAN, (P * w[t.i]) / sum));
            info.innerHTML = `<div class="eq" style="font-size:13.5px">window = max(6 ms, 3 × 0.75 ms) = ${P} ms<br>slice = window × weight ÷ ${sum}: ${T.map((t) => `${t.n} ${ctx.util.fmt(slices[t.i], 2)}`).join(', ')} ms</div>`;
            shareTbl.innerHTML = `<table class="tbl compact"><tr><th>Task</th><th class="r">weight</th><th class="r">target share</th><th class="r">measured</th></tr>${T.map((t) => `<tr><td><b>${t.n}</b></td><td class="r num">${w[t.i]}</td><td class="r num">${pct(w[t.i] / sum)}</td><td class="r num">${clock > 0 ? pct(t.rt / clock) : '—'}</td></tr>`).join('')}</table>`;
            if (!last) narr.innerHTML = 'All three start with vruntime 0, so the first in line runs first. Press <b>Run one turn</b>.';
            else narr.innerHTML = `Turn ${turns}, clock ${ctx.util.fmt(clock, 2)} ms. <b>${last.n}</b> had the smallest vruntime (${ctx.util.fmt(last.from, 2)} ms), so it ran for ${ctx.util.fmt(last.sl, 2)} ms${last.ideal < GRAN - 1e-9 ? ` (its share of the window, ${ctx.util.fmt(last.ideal, 3)} ms, is below the 0.75 ms minimum granularity)` : ` (${last.P} ms × ${last.wi} ÷ ${last.sum})`}. Its vruntime rose by ${ctx.util.fmt(last.sl, 2)} × 1024 ÷ ${last.wi} = ${ctx.util.fmt(last.dv, 2)} ms.`;
          }
          reset(); paint();
          return () => { gen++; };
        },
      },
      /* ---------------- 7. Inside CFS: the tree, sleepers, slice lengths ---------------- */
      {
        title: 'Inside CFS: the tree, sleepers and slice lengths',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack small" style="gap:8px;line-height:1.45">
              <p class="lead m0">CFS keeps its runnable tasks in a <span class="t">red-black tree</span> sorted by vruntime.</p>
              <ul class="m0" style="display:flex;flex-direction:column;gap:3px">
                <li>The <b>leftmost</b> node has the smallest vruntime, so it runs next. The kernel keeps a pointer to it, so finding it takes constant time.</li>
                <li>The chosen task leaves the tree while it runs and goes back in, further right, when its turn ends. Each insert or removal takes about log₂ n steps.</li>
                <li><b>Waking sleepers.</b> A task that slept for a minute still has an old, tiny vruntime and could hog the processor to “catch up”. CFS instead sets its key to max(old key, smallest key − half the targeted latency): a small head start, never a hoard.</li>
                <li><b>Slice length.</b> Every runnable task should get a turn within the <span class="t">targeted latency</span>, but no turn is shorter than the <span class="t">minimum granularity</span>.</li>
              </ul>
              <div class="callout why m0" data-label="Then and now">Linux 6.6 (2023) replaced the CFS pick rule with <span class="t">EEVDF</span>: each task also gets a virtual deadline, and among the tasks still owed time the earliest deadline runs. Weights, nice values and vruntime carry over; the latency and granularity settings gave way to one base slice.</div>
            </div>
            <div class="in-tabs" style="min-height:0"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          let st;
          const NAMES = ['P', 'Q', 'R', 'S', 'T', 'U'], KEYS = [20.0, 20.4, 20.7, 21.1, 21.5, 21.8];
          function reset() {
            const tree = makeRB();
            const tasks = NAMES.map((n, i) => ({ name: n, vr: KEYS[i], seq: i }));
            tasks.forEach((t) => tree.insert(t));
            st = { tree, tasks, w: { name: 'W', vr: 4.0, seq: -1, asleep: true }, seq: 6, minV: KEYS[0], rule: true, last: null,
              msg: 'Six nice-0 tasks wait in the tree. The leftmost one, P, runs next. Press <b>Run the leftmost task</b>.' };
          }
          reset();
          const n = () => st.tree.inorder().length;
          const fmt1 = (v) => v.toFixed(2).replace(/0$/, '');   // keys in hundredths of a ms, trailing zero dropped (20.0, 20.86)
          function runLeft() {
            const t = st.tree.first(); if (!t) return;
            const before = st.tree.rotations(), old = t.vr, cnt = n(), sl = Math.round((period(cnt) / cnt) * 100) / 100;   // the model counts in hundredths of a ms, so shown keys add up exactly
            st.tree.remove(t); t.vr = Math.round((t.vr + sl) * 100) / 100; t.seq = st.seq++; st.tree.insert(t);
            const io = st.tree.inorder().map((x) => x.n), k = io.indexOf(t);
            st.minV = Math.max(st.minV, io[0].vr);
            const where = k === io.length - 1 ? 'at the far right' : k === 0 ? 'still leftmost' : `between ${io[k - 1].name} and ${io[k + 1].name}`;
            const r = st.tree.rotations() - before;
            st.msg = `${t.name} (key ${fmt1(old)}) was leftmost. It left the tree, ran ${ctx.util.fmt(sl, 2)} ms (${cnt} tasks share a ${period(cnt)} ms window) and went back in with key ${fmt1(t.vr)}, ${where}. ${r === 0 ? 'The tree stayed balanced without any rotation.' : `Rebalancing took ${r} rotation${r === 1 ? '' : 's'}.`}`;
            st.last = t.name;
          }
          function toggleW() {
            const w = st.w;
            if (w.asleep) {
              const minNow = Math.max(st.minV, st.tree.first() ? st.tree.first().vr : st.minV), floor = minNow - LAT / 2, old = w.vr;
              w.vr = st.rule ? Math.max(old, floor) : old; w.seq = st.seq++; w.asleep = false; st.tree.insert(w);
              st.msg = st.rule
                ? `W wakes with its old key ${fmt1(old)}. The rule moves it to max(${fmt1(old)}, ${fmt1(minNow)} − 3) = <b>${fmt1(w.vr)}</b>: it runs soon, but only ${fmt1(minNow - w.vr)} ms ahead of the others.`
                : `W wakes and keeps its old key <b>${fmt1(old)}</b>. With the rule off it stays leftmost until its key passes ${fmt1(minNow)}: about ${fmt1(minNow - old)} ms of processor time in a row while everyone else waits.`;
            } else {
              st.tree.remove(w); w.asleep = true;
              st.msg = `W blocks again and leaves the tree. Its key stays ${fmt1(w.vr)} while it sleeps.`;
            }
          }
          function treeTab(panel) {
            const Wd = ctx.narrow ? 380 : 640, svg = s('svg', { viewBox: `0 0 ${Wd} 250`, width: '100%' });
            const msg = h('div', { class: 'msg info', style: { minHeight: '72px' } });
            const bW = h('button', { class: 'btn sm proc', type: 'button', onclick: () => { toggleW(); paint(); } });
            const rule = ctx.ui.seg([{ value: true, label: 'rule on' }, { value: false, label: 'rule off' }], st.rule, (v) => { st.rule = v; });
            function paint() {
              const io = st.tree.inorder(), cnt = io.length, kids = [];
              const r = ctx.narrow ? 17 : 21, X = (i) => ((i + 0.5) * Wd) / Math.max(cnt, 1), Y = (d) => 30 + d * 56;
              const pos = new Map(io.map((x, i) => [x.n, [X(i), Y(x.d)]]));
              io.forEach(({ n: nd }) => {
                [nd.l, nd.r].forEach((c) => { if (c !== st.tree.NIL) { const a = pos.get(nd), b = pos.get(c); kids.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 's-line', 'stroke-width': 1.5 })); } });
              });
              io.forEach(({ n: nd }, i) => {
                const [x, y] = pos.get(nd);
                if (i === 0) kids.push(s('circle', { cx: x, cy: y, r: r + 6, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-dasharray': '5 3' }));
                kids.push(s('circle', { cx: x, cy: y, r, class: nd.red ? 's-bad' : 's-panel', 'stroke-width': nd.red ? 2.5 : 3, style: nd.red ? '' : 'stroke:var(--ink)' }));
                kids.push(s('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'lbl', style: nd.red ? 'fill:var(--bad)' : '' }, nd.name));
                kids.push(s('text', { x, y: y + r + (i === 0 ? 21 : 15), 'text-anchor': 'middle', class: 'ax', style: 'fill:var(--ink-2)' }, fmt1(nd.vr)));
              });
              if (cnt) { const [x0] = pos.get(io[0].n); kids.push(s('text', { x: Math.max(4, x0 - r - 2), y: 14, class: 'ax', style: 'fill:var(--accent);font-weight:800' }, 'leftmost = next')); }
              const maxD = Math.max(0, ...io.map((x) => x.d));
              svg.setAttribute('viewBox', `0 0 ${Wd} ${Math.max(200, Y(maxD) + r + 28)}`);
              svg.replaceChildren(...kids);
              msg.innerHTML = st.msg;
              bW.textContent = st.w.asleep ? 'Wake W (slept long)' : 'W blocks again';
            }
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),
              h('div', { class: 'row gap-s' },
                h('button', { class: 'btn sm primary', type: 'button', onclick: () => { runLeft(); paint(); } }, 'Run the leftmost task'),
                bW, h('span', { class: 'xs b muted' }, 'wake-up rule:'), rule,
                h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); rule.set(true); paint(); } }, 'Reset')),
              h('div', { class: 'row gap-s xs muted' }, h('span', { class: 'chip bad' }, 'red node'), h('span', { class: 'chip' }, 'black node'), 'No red node has a red child, and every path down has the same number of black nodes, so the tree stays shallow.'),
              msg));
            paint();
          }
          function sliceTab(panel) {
            let k = 3;
            const Wd = ctx.narrow ? 380 : 640, svg = s('svg', { viewBox: `0 0 ${Wd} 92`, width: '100%' });
            const out = h('div', { class: 'msg info' });
            const draw = () => {
              const P = period(k), sl = P / k, x0 = 26, x1 = Wd - 12, sx = (v) => x0 + ((x1 - x0) * v) / 13, kids = [];
              for (let j = 0; j < k; j++) kids.push(s('rect', { x: sx(j * sl), y: 20, width: Math.max(1, sx(sl) - x0 - 1), height: 34, rx: 3, class: 'pc' + (j % 5), 'stroke-width': 1.5 }));
              for (let m = 0; m <= 12; m += 2) kids.push(s('text', { x: sx(m), y: 72, 'text-anchor': 'middle', class: 'ax' }, m + ' ms'));
              kids.push(s('line', { x1: sx(6), y1: 12, x2: sx(6), y2: 60, class: 'cur', 'stroke-dasharray': '4 3' }));
              kids.push(s('text', { x: sx(6) + 4, y: 12, class: 'ax', style: 'fill:var(--accent)' }, '6 ms target'));
              svg.replaceChildren(...kids);
              out.innerHTML = `<b>${k} task${k === 1 ? '' : 's'}</b>: window = max(6, ${k} × 0.75) = <b>${ctx.util.fmt(P, 2)} ms</b>, so each nice-0 task gets <b>${ctx.util.fmt(sl, 3)} ms</b> per turn. ${k <= 8 ? 'Up to 8 tasks share the fixed 6 ms window, so turns shrink as tasks are added.' : 'Beyond 8 tasks the turn would drop below 0.75 ms, so the turn stays at the minimum and the window stretches instead.'}`;
            };
            panel.append(h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0 small' }, 'All tasks here are nice 0, so they split the window evenly. With mixed nice values each task’s slice is window × its weight ÷ the total weight.'),
              ctx.ui.slider({ label: 'runnable tasks', min: 1, max: 16, value: k, onInput: (v) => { k = v; draw(); } }),
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), out,
              h('div', { html: `<table class="tbl compact" style="font-size:13.5px"><tr><th>tasks</th>${[1, 2, 4, 8, 12, 16].map((m) => `<th class="c">${m}</th>`).join('')}</tr><tr><td class="b">window</td>${[1, 2, 4, 8, 12, 16].map((m) => `<td class="c num">${ctx.util.fmt(period(m), 2)} ms</td>`).join('')}</tr><tr><td class="b">each turn</td>${[1, 2, 4, 8, 12, 16].map((m) => `<td class="c num">${ctx.util.fmt(period(m) / m, 3)} ms</td>`).join('')}</tr></table>` }),
              h('p', { class: 'xs muted m0' }, 'These are the defaults from 2.6.36 (2010) to 6.5; CFS started in 2.6.23 with a 20 ms target. The kernel scales both by 1 + log₂ of the processor count, up to 8 processors: 24 ms and 3 ms on an 8-processor machine.')));
            draw();
          }
          ctx.$('.in-tabs').append(ctx.ui.tabs([{ label: 'Red-black tree', render: treeTab }, { label: 'Slice length', render: sliceTab }]));
        },
      },
      /* ---------------- 8. Recap: timeline + flip cards ---------------- */
      {
        title: 'Recap: twenty years of Linux scheduling',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const eras = [
            ['Up to 2.4', 'O(n) scan', 'Examined every runnable task at each decision.', ''],
            ['2.6.0 · Dec 2003', 'O(1) scheduler', 'Per-processor run queues, active and expired arrays, 140-bit bitmap, sleep bonus.', 'cpu'],
            ['2.6.23 · Oct 2007', 'CFS', 'Smallest vruntime runs; red-black tree; weights from nice values.', 'mem'],
            ['6.6 · Oct 2023', 'EEVDF', 'Earliest virtual deadline among tasks owed time; same weights.', 'proc'],
          ];
          const w0 = weightOf(0), w5 = weightOf(5);
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'grid-4', style: { gap: '8px' } }, ...eras.map(([when, name, what, cls]) => h('div', { class: 'card tight ' + cls, style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
              h('span', { class: 'xs b muted' }, when), h('b', {}, name), h('span', { class: 'small' }, what)))),
            h('p', { class: 'small muted m0' }, 'Throughout all four eras the real-time policies SCHED_FIFO and SCHED_RR sat above normal threads; SCHED_DEADLINE (3.14, 2014) sits above them. Click each card and try to answer before you flip.'),
            ctx.ui.flipcards([
              ['Which class runs first?', 'Deadline, then real-time (FIFO/RR, priority 1–99, higher wins), then the fair class. A lower class runs only when every class above it has nothing ready.'],
              ['SCHED_FIFO versus SCHED_RR?', 'Both run until they block, yield or meet a higher priority; preempted → head of the list, woken → tail. RR adds a slice (100 ms by default); when it ends → tail.'],
              ['The kernel’s 0–139 line?', 'Lower is more important. 0–99 real-time (99 − real-time priority); 100–139 normal (120 + nice).'],
              ['The O(1) scheduler in one breath?', 'Find the first set bit, run the head of that list; used slice → expired array; empty active array → swap pointers; sleep bonus of up to ±5.'],
              ['CFS in one breath?', 'Run the leftmost (smallest vruntime) task of a red-black tree; vruntime += run time × 1024 ÷ weight; share = weight ÷ total weight.'],
              ['Nice 0 against nice +5?', `Weights ${w0} and ${w5}: shares ${pct(w0 / (w0 + w5))} and ${pct(w5 / (w0 + w5))}. Each nice step changes the weight about 1.25×.`],
            ], { cols: 3, height: 150 })));
        },
      },
      /* ---------------- 9. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'On one Linux processor, a SCHED_FIFO thread with real-time priority 40 is running. A SCHED_RR thread, also at priority 40, becomes ready. What happens next?',
            choices: ['The SCHED_RR thread preempts it at once, because RR threads are favoured', 'The two threads start alternating, 100 ms each, immediately', 'The FIFO thread keeps running until it blocks, yields or is outranked', 'The kernel compares the two threads’ nice values to pick a winner'],
            answer: 2,
            feedback: ['Only a strictly higher real-time priority causes preemption; the two policies have equal standing at the same level.', 'The RR thread’s slice only matters while the RR thread itself runs; the FIFO thread has no slice and is not cut off by an equal priority.', null, 'Nice values belong to normal threads; real-time threads are ordered by real-time priority.'],
            why: 'Threads of the same real-time priority share one list. A running SCHED_FIFO thread is never preempted by an equal-priority thread, so the newcomer waits at the tail of the priority-40 list.' },
          { q: 'A SCHED_FIFO thread is preempted because a higher-priority real-time thread wakes up. Where does the preempted thread go?',
            choices: ['To the tail of the list for its priority', 'To the expired array, with a fresh slice', 'Down one priority level, as a penalty', 'Back to the head of the list for its priority'],
            answer: 3,
            feedback: ['The tail is where a thread goes when it wakes up or yields, not when it is preempted.', 'Active and expired arrays belong to the old O(1) scheduler’s handling of normal tasks, not to real-time preemption.', 'Real-time priorities are fixed by the program; the kernel does not lower them.', null],
            why: 'A preempted real-time thread did nothing wrong, so it keeps its place at the head of its list and resumes as soon as no higher-priority thread is ready.' },
          { q: 'How did the Linux 2.6 O(1) scheduler find the next task in constant time?',
            choices: ['It found the first set bit in a bitmap of non-empty priority lists','It sorted all runnable tasks by priority before every single decision', 'It kept every runnable task in a red-black tree ordered by priority', 'It always ran the task that had been waiting in the system the longest'],
            answer: 0,
            feedback: [null, 'Sorting takes time that grows with the number of tasks, the very cost O(1) avoided.', 'A tree costs about log n per operation; it is the CFS data structure, keyed by vruntime.', 'That is first-come-first-served, which ignores priorities altogether.'],
            why: 'With 140 bits, one find-first-set operation identifies the highest-priority non-empty list, and the task at its head runs. The cost does not depend on how many tasks are waiting.' },
          { q: 'A buggy SCHED_FIFO thread at priority 99 spins in an endless loop on a one-processor Linux system with default settings. What happens to normal threads?',
            choices: ['They never run again until the machine is restarted', 'They still get about 50 ms of each second', 'They get a fair half of the processor, as under CFS', 'The kernel ends the looping thread after 100 ms'],
            answer: 1,
            feedback: ['That would be true without the safety valve, which limits real-time threads by default.', null, 'Real-time threads always beat normal ones; there is no fair split between the classes.', 'By default Linux does not kill a thread for using processor time; 100 ms is the default SCHED_RR slice, which does not apply to FIFO.'],
            why: 'By default real-time threads may use at most 95% of each second, so about 50 ms per second remains for normal threads, enough to run a shell and stop the runaway.' },
          { type: 'num', q: 'Two processor-bound normal threads share one processor under CFS. One has nice 0 (weight 1024), the other nice +5 (weight 335). What percentage of the processor does the nice-0 thread receive?', answer: 75.3, tol: 0.3, unit: '%',
            why: 'Share = weight ÷ total weight = 1024 ÷ (1024 + 335) = 1024 ÷ 1359 ≈ 75.3%. The nice +5 thread gets the other 24.7%.' },
          { type: 'num', q: 'CFS has a targeted latency of 6 ms and a minimum granularity of 0.75 ms. Twelve nice-0 tasks are runnable. How long, in ms, is the window in which each of them gets one turn?', answer: 9, tol: 0.01, unit: 'ms',
            why: 'Twelve equal turns of 6 ÷ 12 = 0.5 ms would be shorter than the 0.75 ms minimum, so each turn is 0.75 ms and the window stretches to 12 × 0.75 = 9 ms.' },
          { type: 'tf', q: 'On a one-processor system running the O(1) scheduler, a processor-bound task that used up its time slice moved to the expired array and could not run again until the active and expired arrays swapped.', answer: true,
            why: 'Expired tasks wait until every task in the active array has used its slice (or left); then the array pointers swap and the expired tasks become active again, with fresh slices.' },
          { type: 'tf', q: 'Under CFS, a processor-bound task with nice +5 never runs while a processor-bound nice-0 task is runnable.', answer: false,
            why: 'For normal threads the nice value sets a weight, not a strict rank. The nice +5 task still gets about a quarter of the processor; only real-time and deadline threads beat normal ones outright.' },
          { type: 'order', q: 'Put the Linux schedulers for normal threads in the order they were introduced.', items: ['The scan of every runnable task (2.4 and earlier)', 'The O(1) scheduler (2.6.0)', 'The Completely Fair Scheduler (2.6.23)', 'EEVDF (6.6)'],
            why: 'The O(1) scheduler arrived with 2.6.0 in 2003, CFS replaced it in 2.6.23 in 2007, and EEVDF replaced the CFS pick rule in 6.6 in 2023.' },
          { type: 'match', q: 'Match each Linux policy to its behaviour.', pairs: [
            ['SCHED_FIFO', 'Real-time, no time slice'],
            ['SCHED_RR', 'Real-time, equal priorities take turns'],
            ['SCHED_OTHER', 'Default; shares by nice value'],
            ['SCHED_DEADLINE', 'Declares runtime, deadline and period'],
            ['SCHED_IDLE', 'Tiny weight; mostly uses otherwise idle time'],
          ], why: 'FIFO and RR are the real-time policies (RR adds a slice), SCHED_OTHER is the fair default, SCHED_DEADLINE (3.14) outranks everything, and SCHED_IDLE gives the least important background work a weight of only 3, below even nice +19.' },
          { type: 'bucket', q: 'Which scheduler does each feature belong to?', buckets: ['O(1) scheduler', 'CFS'], items: [
            ['Active and expired arrays', 0], ['Red-black tree sorted by vruntime', 1], ['Bitmap marking non-empty priority lists', 0],
            ['Weight 1024 at nice 0', 1], ['Sleep bonus of up to ±5 levels', 0], ['Targeted latency and minimum granularity', 1]],
            why: 'O(1) used arrays, a bitmap and a sleep-based bonus; CFS replaced all of them with vruntime, weights, a red-black tree and a latency-based slice.' },
          { type: 'multi', q: 'A CFS task wakes up after sleeping for a long time. Which statements are true?', choices: ['Its vruntime is raised to at least the smallest vruntime minus a small allowance', 'It keeps its old vruntime, however small, to catch up on missed time', 'It is inserted into the red-black tree according to its vruntime', 'It receives a fixed 100 ms slice regardless of its weight'], answer: [0, 2],
            why: 'CFS sets a woken task’s vruntime to max(old value, smallest vruntime − half the targeted latency) and inserts it into the tree by that key. Keeping a tiny old value would let it hog the processor; slices come from weights, not a fixed 100 ms.' },
        ],
      },
    ],
    notes: `
      <h3>Linux scheduling</h3>
      <h4>Scheduling classes and policies</h4>
      <p>Linux schedules threads (the kernel calls each one a task). Every thread belongs to one <b>scheduling class</b>, and the classes are served in a strict order: a lower class gets a processor only when every higher class has nothing ready on it.</p>
      <ol>
        <li><b>Deadline class</b>: <code>SCHED_DEADLINE</code> (since 3.14, 2014). A task declares a runtime, a deadline and a period; the kernel admits it only if there is enough spare processor capacity and runs the earliest deadline first.</li>
        <li><b>Real-time class</b>: <code>SCHED_FIFO</code> and <code>SCHED_RR</code>, real-time priority 1 (lowest) to 99 (highest).</li>
        <li><b>Fair class</b> for normal threads: <code>SCHED_OTHER</code> (called <code>SCHED_NORMAL</code> in the kernel source, the default), <code>SCHED_BATCH</code> (since 2.6.16: processor-bound jobs, mildly disfavoured when they wake) and <code>SCHED_IDLE</code> (since 2.6.23: weight ${IDLE_W}, below nice +19’s ${weightOf(19)}; beside one busy nice-0 thread it still gets about ${pct(IDLE_W / (IDLE_W + weightOf(0)))}, so it mostly uses time that would otherwise go idle). Normal threads share the processor according to their nice values, −20 to +19.</li>
      </ol>
      <p>Real-time threads always run before normal threads. As a safety valve, by default real-time threads may use at most 95% of each second, so about 50 ms per second remains for normal threads even if a real-time thread loops forever.</p>
      <h4>Priority numbers</h4>
      <ul>
        <li>Real-time priority: 1–99, <b>bigger is more urgent</b>.</li>
        <li>Nice value: −20 to +19, <b>smaller is more favoured</b> (a “nice” thread asks for less).</li>
        <li>Inside the kernel: one line of 140 levels, 0–139, <b>smaller is more important</b>. 0–99 are real-time (kernel number = 99 − real-time priority); 100–139 are normal (kernel number = 120 + nice). Example: real-time priority 30 → 69; nice +5 → 125; nice 0 → 120.</li>
      </ul>
      <p>For two real-time threads the higher priority always wins. For two normal threads the nice value sets a <i>share</i>, not a winner.</p>
      <h4>SCHED_FIFO and SCHED_RR</h4>
      <ul>
        <li>The scheduler runs the thread at the head of the highest-priority non-empty list.</li>
        <li><b>SCHED_FIFO</b> has no time slice: the thread runs until it blocks, yields (<code>sched_yield</code>) or a higher-priority real-time thread becomes ready. It is never cut off by a thread of equal priority.</li>
        <li>A thread preempted by a higher priority goes back to the <b>head</b> of its list; a thread that wakes up or yields goes to the <b>tail</b>.</li>
        <li><b>SCHED_RR</b> is the same plus a time slice (100 ms by default). When the slice runs out and another thread waits at the same priority, the thread goes to the tail of its list with a fresh slice. Linux refills a slice only when it reaches zero, so a preempted RR thread later finishes the rest of its slice.</li>
      </ul>
      <p>Worked example (time unit 50 ms; A: FIFO, priority 90, needs 100 ms; B and C: priority 50, need 150 ms each; D: FIFO, priority 10, needs 100 ms; N: a normal thread needing 100 ms):</p>
      <table>
        <tr><th>B and C use</th><th>Schedule (ms)</th></tr>
        <tr><td>SCHED_FIFO</td><td>${schedText('fifo', 'none')}</td></tr>
        <tr><td>SCHED_RR</td><td>${schedText('rr', 'none')}</td></tr>
        <tr><td>FIFO, A wakes at 150</td><td>${schedText('fifo', 'wake')} (B resumes from the head)</td></tr>
        <tr><td>FIFO, B sleeps at 150</td><td>${schedText('fifo', 'sleep')} (B rejoins at the tail)</td></tr>
      </table>
      <p>Under FIFO, B and C run one after the other; under RR they alternate every slice. Either way D waits for both, and the normal thread N runs only after every real-time thread is done.</p>
      <h4>The O(1) scheduler (Linux 2.6.0, December 2003, to 2.6.22)</h4>
      <p>Linux 2.4 examined every runnable task at each decision, so its cost grew with the number of tasks. The O(1) scheduler made every decision cost the same:</p>
      <ul>
        <li>Each processor has its own <b>run queue</b> with two <b>arrays</b> of 140 lists, one list per priority: the <b>active</b> array and the <b>expired</b> array.</li>
        <li>A 140-bit <b>priority bitmap</b> marks the non-empty lists; finding the first set bit names the best list, and the task at its head runs.</li>
        <li>Higher priority means a longer slice: in 2.6.0, 10 ms at the lowest priority to 200 ms at the highest, about 100 ms at nice 0 (static priority 115 → ${o1Slice(115)} ms, 120 → ${o1Slice(120)} ms, 130 → ${o1Slice(130)} ms). From 2.6.9 to 2.6.22 the range was ${o1Slice9(139)} ms (nice +19) to ${o1Slice9(100)} ms (nice −20), exactly ${o1Slice9(120)} ms at nice 0.</li>
        <li>A task that uses up its slice gets a fresh slice and moves to the <b>expired</b> array. When the active array is empty, the two array pointers swap. Every task with slice left runs before any task gets a second turn, so no normal task starves.</li>
        <li><b>Sleep bonus</b>: dynamic priority = static priority − bonus + 5, with a bonus from 0 to 10 based on recent sleep time, kept inside 100–139. A nice-0 task that never sleeps sits at 125; one that mostly sleeps rises to 115. The slice still depends only on the static priority. Very interactive tasks could even skip the expired array. These guessing rules grew complicated and could be fooled.</li>
        <li><b>Load balancing</b> (2.6.0–2.6.6): about every 200 ms on a busy processor, every 1 ms on an idle one, and whenever a queue runs empty, a processor pulls tasks from the busiest queue. From 2.6.7 the intervals depend on how closely the processors share hardware.</li>
      </ul>
      <h4>The Completely Fair Scheduler (2.6.23, October 2007, to 6.5)</h4>
      <p>CFS imitates an ideal processor that runs every ready task at once, each at its fair share.</p>
      <ul>
        <li>Each task keeps a <b>virtual runtime</b> (vruntime): <code>vruntime += time actually run × 1024 ÷ weight</code>.</li>
        <li>The rule: <b>run the task with the smallest vruntime</b>, the one that has been served least.</li>
        <li><b>Load weight</b> from the nice value: 1024 at nice 0, about 1.25× more per step down and 1.25× less per step up (nice −5: ${weightOf(-5)}, −1: ${weightOf(-1)}, +1: ${weightOf(1)}, +5: ${weightOf(5)}, +19: ${weightOf(19)}). A busy task’s share = its weight ÷ the total weight of the runnable tasks. One nice step between two busy tasks moves the split from 50/50 to about ${pct(1024 / (1024 + weightOf(1)), 0)}/${pct(weightOf(1) / (1024 + weightOf(1)), 0)}.</li>
      </ul>
      <p><b>Worked example.</b> Nice 0 (weight 1024) against nice +5 (weight ${weightOf(5)}): shares 1024 ÷ ${1024 + weightOf(5)} = ${pct(1024 / (1024 + weightOf(5)))} and ${pct(weightOf(5) / (1024 + weightOf(5)))}. Over one busy second the first runs ${fmt2((1000 * 1024) / (1024 + weightOf(5)))} ms and the second ${fmt2((1000 * weightOf(5)) / (1024 + weightOf(5)))} ms, yet both vruntimes grow by the same ${fmt2((1000 * 1024) / (1024 + weightOf(5)))} ms: equal virtual time, unequal real time. A task that mostly sleeps keeps a small vruntime, so interactive work runs promptly without any special heuristics.</p>
      <h4>Slice lengths</h4>
      <ul>
        <li><b>Targeted latency</b>: the window in which every runnable task should get one turn, 6 ms by default from 2.6.36 (2010) to 6.5 (CFS started in 2.6.23 with 20 ms).</li>
        <li><b>Minimum granularity</b>: the shortest turn, 0.75 ms by default from 2.6.36, so switching costs never swamp useful work.</li>
        <li>window = max(6 ms, n × 0.75 ms); slice of task i = window × w<sub>i</sub> ÷ Σw. Up to 8 nice-0 tasks share the 6 ms window (4 tasks: 1.5 ms each); beyond 8 each turn stays 0.75 ms and the window grows (12 tasks: 9 ms).</li>
        <li>Example: three tasks with nice 0, 0 and +5 (total weight ${2 * 1024 + weightOf(5)}): slices ${fmt2((6 * 1024) / (2048 + weightOf(5)))}, ${fmt2((6 * 1024) / (2048 + weightOf(5)))} and ${fmt2((6 * weightOf(5)) / (2048 + weightOf(5)))} ms. After every task has had one turn, all three vruntimes have grown by the same ${fmt2((6 * 1024) / (2048 + weightOf(5)))} ms.</li>
        <li>The kernel scales both base values by 1 + log₂ of the number of processors, up to 8 processors (24 ms and 3 ms on 8 processors).</li>
      </ul>
      <h4>The red-black tree and waking tasks</h4>
      <ul>
        <li>Runnable tasks sit in a <b>red-black tree</b> (a self-balancing binary search tree) keyed by vruntime. The leftmost node is the next task; the kernel caches a pointer to it. Inserting or removing a task costs about log₂ n steps.</li>
        <li>The running task leaves the tree and is reinserted with its larger vruntime when its turn ends.</li>
        <li>A task waking from a long sleep would otherwise return with a tiny vruntime and hog the processor. CFS sets its vruntime to max(old value, smallest vruntime − half the targeted latency): a small head start of at most ${LAT / 2} ms with the base ${LAT} ms latency, never a hoard. A new task likewise starts near the current smallest vruntime.</li>
      </ul>
      <h4>EEVDF (Linux 6.6, October 2023)</h4>
      <p>Earliest Eligible Virtual Deadline First replaced the CFS pick rule. Each task also gets a virtual deadline, and among the tasks that are still owed processor time (eligible), the one with the earliest virtual deadline runs. Weights, nice values and vruntime carry over. The targeted latency and minimum granularity settings gave way to a single base slice (0.75 ms by default).</p>
      <h4>O(1) versus CFS at a glance</h4>
      <table>
        <tr><th></th><th>O(1) (2.6.0–2.6.22)</th><th>CFS (2.6.23–6.5)</th></tr>
        <tr><td>Data structure</td><td>active + expired arrays of 140 lists, bitmap</td><td>red-black tree keyed by vruntime</td></tr>
        <tr><td>Pick</td><td>head of the first non-empty list</td><td>leftmost task (smallest vruntime)</td></tr>
        <tr><td>Nice value sets</td><td>priority level and slice length</td><td>weight, hence processor share</td></tr>
        <tr><td>Interactivity</td><td>sleep bonus of up to ±5 levels</td><td>falls out of a small vruntime</td></tr>
        <tr><td>Cost of a pick</td><td>constant</td><td>constant (cached leftmost); insert/remove log n</td></tr>
      </table>`,
  });
})();
