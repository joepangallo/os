/* =====================================================================
   Section 10.6 — Windows Scheduling
   Priority levels, priority classes and relative thread priorities,
   boosts and decay, the starvation rescue, quanta, and multiprocessor
   placement. One small engine (pure functions, no DOM) computes every
   number that a chart, caption, quiz or note relies on.
   Helpers live inside the IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {
  /* ENGINE-BEGIN */
  /* Priority classes [name, class base] and relative thread priorities [name, offset].
     'idle' and 'tc' are the two special cases that jump to the bottom or top of the band. */
  const CLASSES = [['Idle', 4], ['Below normal', 6], ['Normal', 8], ['Above normal', 10], ['High', 13], ['Realtime', 24]];
  const RELS = [['Idle', 'idle'], ['Lowest', -2], ['Below normal', -1], ['Normal', 0], ['Above normal', 1], ['Highest', 2], ['Time critical', 'tc']];
  const isRT = (ci) => CLASSES[ci][0] === 'Realtime';
  function basePri(ci, ri) {
    const off = RELS[ri][1], rt = isRT(ci);
    if (off === 'idle') return rt ? 16 : 1;
    if (off === 'tc') return rt ? 31 : 15;
    return CLASSES[ci][1] + off;
  }
  const MAX_VAR = 15;                 // top of the variable band: boosts stop here
  const CLOCK_MS = 15.625;            // a common clock interval on modern PCs (64 ticks per second)

  /* Boost sources with their classic increments (drivers and the system choose them). */
  const BOOSTS = [
    { key: 'kbd', label: 'Keyboard or mouse', inc: 6, wait: 'a key press', done: 'A key press arrives' },
    { key: 'snd', label: 'Sound card', inc: 8, wait: 'the sound card', done: 'The sound card finishes its transfer' },
    { key: 'net', label: 'Network', inc: 2, wait: 'a network packet', done: 'A network packet arrives' },
    { key: 'disk', label: 'Disk', inc: 1, wait: 'a disk read', done: 'The disk read completes' },
    { key: 'evt', label: 'Event or semaphore', inc: 1, wait: 'an event', done: 'The event is signalled' },
    { key: 'gui', label: 'Window message', inc: 2, wait: 'a window message', done: 'A window message arrives' },
  ];

  /* boostSim(inc, work, n): editor thread E (base 8) and CPU-bound thread C (base 8), one slot = one quantum.
     Slot 0: C runs, E is blocked. At the start of slot 1 E's wait ends and it gets base + inc (capped at 15).
     A thread that uses a full quantum above its base decays by 1. A preempted thread goes to the FRONT of
     its level's queue; a thread whose quantum ends goes to the BACK. E blocks again after `work` quanta. */
  function boostSim(inc, work, n = 12) {
    const E = { name: 'E', base: 8, cur: 8, left: work, state: 'wait' };
    const C = { name: 'C', base: 8, cur: 8, state: 'run' };
    const q = new Map();
    const push = (t, front) => { const a = q.get(t.cur) || []; if (front) a.unshift(t); else a.push(t); q.set(t.cur, a); t.state = 'ready'; };
    const pick = () => { const lv = [...q.keys()].filter((k) => q.get(k).length).sort((a, b) => b - a)[0]; if (lv == null) return null; const t = q.get(lv).shift(); t.state = 'run'; return t; };
    let run = C; const frames = [];
    for (let s = 0; s < n; s++) {
      const start = [];
      if (s === 1) {
        const want = E.base + inc; E.cur = Math.min(MAX_VAR, want);
        start.push({ k: 'wake', want, cur: E.cur, capped: want > MAX_VAR });
        if (E.cur > run.cur) { start.push({ k: 'preempt', victim: run.name, vp: run.cur }); push(run, true); run = E; E.state = 'run'; }
        else { push(E); start.push({ k: 'queue' }); }
      }
      const f = { s, run: run ? run.name : null, e: E.cur, eState: E.state, c: C.cur, cState: C.state, start, end: [] };
      if (run === E) {
        E.left--;
        if (E.left === 0) { E.state = 'done'; f.end.push({ k: 'block' }); }
        else { const was = E.cur; if (E.cur > E.base) { E.cur--; f.end.push({ k: 'decay', from: was, to: E.cur }); } else f.end.push({ k: 'turn' }); push(E); }
      } else if (run === C) push(C);
      run = pick();
      f.next = run ? run.name : null;
      frames.push(f);
    }
    return frames;
  }

  /* starveSim: H is CPU-bound at priority hiPri and never blocks; L (priority 4) is ready from readyAt seconds.
     The balance set manager scans at 1, 2, 3 ... s. A ready thread that has waited >= 4 s is raised to 15 and
     given the classic doubled quantum; if 15 beats H, L runs for that long and then drops straight back to 4.
     With lock = true, thread T (priority 12) is blocked from time 0 on a lock that L holds; L needs 5 ms to
     release it. T is then ready, but L at 15 keeps the processor until its quantum ends: T runs at tRun. */
  function starveSim(readyAt, hiPri, lock, horizon = 12) {
    const qms = 2 * 2 * CLOCK_MS;                 // a doubled client quantum: 2 x (2 clock intervals)
    const scans = [], runs = []; let since = readyAt, freed = null, stuck = false;
    for (let t = 1; t <= horizon; t++) {
      const waited = t - since;
      if (stuck) { scans.push({ t, waited, act: 'still' }); continue; }
      if (waited >= 4 - 1e-9) {
        if (MAX_VAR > hiPri) {
          runs.push({ from: t, to: t + qms / 1000 }); scans.push({ t, waited, act: 'run' });
          if (lock && freed == null) freed = t + 0.005;
          since = t + qms / 1000;
        } else { stuck = true; scans.push({ t, waited, act: 'stuck' }); }
      } else scans.push({ t, waited, act: 'none' });
    }
    const share = runs.length * qms / 1000 / (horizon - readyAt);
    return { scans, runs, qms, freed, tRun: freed == null ? null : runs[0].to, share, readyAt, hiPri, lock, horizon };
  }

  /* quantumInfo: quantum lengths and a one-second strip of three equal-priority CPU-bound threads
     (foreground F, background B1 and B2) taking turns in that order. */
  function quantumInfo(edition, stretch, clockMs) {
    const intervals = edition === 'server' ? 12 : 2, s = edition === 'server' ? 1 : stretch;
    const bgMs = intervals * clockMs, fgMs = bgMs * s, turns = [];
    let t = 0, k = 0;
    while (t < 1000 - 1e-9) { const who = ['F', 'B1', 'B2'][k % 3], len = who === 'F' ? fgMs : bgMs; turns.push({ who, from: t, to: Math.min(1000, t + len) }); t += len; k++; }
    return { intervals, s, bgMs, fgMs, turns, share: fgMs / (fgMs + 2 * bgMs) };
  }

  /* Multiprocessor placement (a simplified model of the rules):
     a newly ready thread takes an idle allowed processor (its ideal one if idle, then the one it last
     used, then the lowest-numbered); otherwise it preempts the lowest-priority thread running on an
     allowed processor if it is strictly higher (that thread returns to the FRONT of the ready list);
     otherwise it waits. A processor that frees up takes the highest-priority waiting thread allowed on it. */
  const MP_THREADS = {
    A: { pri: 8, mask: [0, 1, 2, 3], ideal: 0 },
    B: { pri: 8, mask: [0, 1, 2, 3], ideal: 1 },
    C: { pri: 10, mask: [2], ideal: 2 },
    D: { pri: 6, mask: [0, 1, 2, 3], ideal: 0 },
    E: { pri: 12, mask: [2, 3], ideal: 3 },
    F: { pri: 9, mask: [1], ideal: 1 },
    G: { pri: 14, mask: [2], ideal: 2 },
  };
  const MP_EVENTS = [['ready', 'A'], ['ready', 'B'], ['ready', 'C'], ['ready', 'D'], ['ready', 'E'], ['ready', 'F'], ['block', 'E'], ['ready', 'G'], ['block', 'A'], ['block', 'G']];
  function mpApply(st, ev) {
    const run = st.run.slice(), ready = st.ready.slice(), last = Object.assign({}, st.last);
    const [kind, name] = ev, T = MP_THREADS[name];
    let res;
    if (kind === 'ready') {
      const idle = T.mask.filter((c) => !run[c]);
      if (idle.length) {
        const cpu = idle.includes(T.ideal) ? T.ideal : idle.includes(last[name]) ? last[name] : idle[0];
        run[cpu] = name; last[name] = cpu;
        res = { answer: cpu, how: cpu === T.ideal ? 'ideal' : 'idle' };
      } else {
        const cand = T.mask.filter((c) => MP_THREADS[run[c]].pri < T.pri)
          .sort((a, b) => MP_THREADS[run[a]].pri - MP_THREADS[run[b]].pri || (b === T.ideal) - (a === T.ideal) || a - b);
        if (cand.length) {
          const cpu = cand[0], victim = run[cpu];
          ready.unshift(victim); run[cpu] = name; last[name] = cpu;
          res = { answer: cpu, how: 'preempt', victim };
        } else { ready.push(name); res = { answer: 'wait', how: 'wait' }; }
      }
    } else {
      const cpu = run.indexOf(name); run[cpu] = null;
      let best = null;
      for (const w of ready) if (MP_THREADS[w].mask.includes(cpu) && (best == null || MP_THREADS[w].pri > MP_THREADS[best].pri)) best = w;
      if (best) { ready.splice(ready.indexOf(best), 1); run[cpu] = best; last[best] = cpu; }
      res = { answer: best || 'idle', cpu, how: best ? 'take' : 'idle' };
    }
    return { st: { run, ready, last }, res };
  }
  function mpRun() {
    let st = { run: [null, null, null, null], ready: [], last: {} };
    return MP_EVENTS.map((ev) => { const before = st; const r = mpApply(st, ev); st = r.st; return { ev, before, after: st, res: r.res }; });
  }
  /* ENGINE-END */
  const nf = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);   // fixed-digit number for the notes

  Guide.section({
    id: '10.6',
    title: 'Windows Scheduling',
    short: 'Windows scheduling',
    summary: 'Windows runs the highest-priority ready thread, boosts threads that wake up, and rescues starving ones.',
    objectives: [
      'Explain how Windows uses 32 priority levels split into a real-time band and a variable band.',
      'Compute a thread’s base priority from its process priority class and its relative thread priority.',
      'Trace how a priority boost raises a thread’s current priority and how it decays back to the base.',
      'Describe how the balance set manager rescues starving threads and how quanta differ between client and server Windows.',
      'Predict where a ready thread runs on a multiprocessor, given its priority, hard affinity and ideal processor.',
    ],
    terms: [
      ['Priority class', 'A label on a Windows process (Idle, Below normal, Normal, Above normal, High or Realtime) that sets the starting priority for all of its threads.'],
      ['Relative thread priority', 'A per-thread setting (Idle, Lowest, Below normal, Normal, Above normal, Highest, Time critical) that moves a thread up or down from its process’s class priority.'],
      ['Base priority', 'In Windows, the priority a thread starts from, fixed by its process’s priority class plus its relative thread priority. A variable-level thread never drops below it.'],
      ['Current priority', 'The priority the Windows scheduler actually uses right now. For a variable-level thread it can sit above the base priority after a boost and then slides back down.'],
      ['Real-time levels', 'Windows priority levels 16 to 31. Threads here keep a fixed priority: the system never boosts or lowers them, and equal-priority threads take turns.'],
      ['Variable levels', 'Windows priority levels 1 to 15, used by ordinary threads. The system raises and lowers a thread’s current priority here, but never above 15.'],
      ['Zero-page thread', 'A Windows system thread that runs at priority 0, the lowest level, and fills free memory pages with zeros in spare moments so they are ready to hand out.'],
      ['Ready summary', 'A 32-bit mask with one bit per priority level; a bit is 1 when that level’s ready queue is not empty, so the dispatcher finds the highest ready level in one quick scan.'],
      ['Priority boost', 'A temporary rise in a variable-level thread’s current priority, given when it stops waiting (for example when its I/O completes), so it gets the processor quickly.'],
      ['Priority decay', 'The step-by-step return of a boosted thread to its base priority: one level lower after each full quantum it uses.'],
      ['Balance set manager', 'A Windows system thread that wakes about once a second. One of its jobs is to find ready threads that have waited about 4 seconds and give them a one-time boost to priority 15.'],
      ['Clock interval', 'The time between two clock interrupts, about 15.6 ms on most modern PCs. Windows measures a thread’s quantum in clock intervals.'],
      ['Foreground process', 'The process that owns the window the user is working in right now.'],
      ['Quantum stretching', 'Giving the threads of the foreground process longer quanta (up to three times as long) on client Windows, without raising their priority.'],
      ['Hard affinity (affinity mask)', 'The set of processors a thread is allowed to run on. The scheduler never places the thread on a processor outside this set.'],
      ['Ideal processor (soft affinity)', 'The processor Windows prefers for a thread, so it keeps finding its data in that processor’s cache. It is a preference, not a rule.'],
    ],
    css: `
      .sec-10-6 .m0 { margin: 0; }
      .sec-10-6 .w6-anim .w6-pill { transition: transform .5s ease; }
      .sec-10-6 .w6-anim .w6-box, .sec-10-6 .w6-anim .w6-arrow, .sec-10-6 .w6-anim .w6-from { transition: opacity .4s ease; }
      .sec-10-6 .w6-tbl { table-layout: fixed; }
      .sec-10-6 .w6-tbl th { font-size: 12.5px; line-height: 1.25; text-transform: none; letter-spacing: 0; vertical-align: middle; }
      .sec-10-6 .w6-tbl td { padding: 3px 4px; vertical-align: middle; }
      .sec-10-6 .w6-tbl tr > th:first-child { width: 26%; }
      .sec-10-6 .w6-off { font-weight: 800; color: var(--accent); white-space: nowrap; }
      .sec-10-6 .w6-gc { width: 100%; height: 36px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--panel); color: var(--ink); font: inherit; font-weight: 800; font-size: 17px; cursor: pointer; }
      .sec-10-6 .w6-gc:hover { border-color: var(--accent); }
      .sec-10-6 .w6-gc.rt { background: var(--accent-bg); }
      .sec-10-6 .w6-gc.sp { border-style: dashed; border-color: var(--thread); }
      .sec-10-6 .w6-gc.sel { outline: 3px solid var(--warn); outline-offset: -1px; }
      .sec-10-6 .flip-face.front { font-size: 19px; }
      .sec-10-6 .flip-face.back { font-size: 17px; line-height: 1.45; }
      .sec-10-6 .w6-ros { table-layout: fixed; }
      .sec-10-6 .w6-ros th, .sec-10-6 .w6-ros td { text-align: center; padding: 2px 4px; font-size: 13.5px; }
      .sec-10-6 .w6-ros tr > :first-child { text-align: left; width: 28%; }
    `,
    steps: [
      {
        title: 'Windows schedules threads, by priority, for the user',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack gap-s">
              <p class="lead m0">Windows has one main scheduling goal: the person at the keyboard should never feel the computer hesitate.</p>
              <p class="m0">To get there it uses a <span class="t" data-t="Preemptive scheduling">preemptive</span>, priority-driven scheduler. Every <span class="t">thread</span> carries a priority number. The <span class="t">dispatcher</span> always runs the highest-priority thread that is ready, and when a more important thread becomes ready it takes the processor at once, even in the middle of another thread’s turn.</p>
              <p class="m0">The unit of scheduling is the <b>thread</b>, not the process. A process is a container; its threads compete one by one. Flip the switch on the right to see the difference.</p>
              <div class="callout analogy m0" data-label="Analogy">A busy kitchen: every order ticket has an urgency number and the chef always cooks the most urgent one. A ticket for a guest who just sat down gets a temporary bump, and a ticket ignored for too long is pushed to the top once, so nobody waits forever.</div>
              <div class="row gap-s small"><span class="chip os">read the 32 levels</span><span class="chip proc">compute base priorities</span><span class="chip thread">watch a boost decay</span><span class="chip warn">rescue a starving thread</span><span class="chip cpu">place threads on 4 processors</span></div>
            </div>
            <div class="card stack gap-s">
              <h4 class="m0">What the scheduler sees</h4>
              <div class="w6-view"></div>
              <div class="w6-svg grow" style="display:grid;place-items:center;min-height:0"></div>
              <p class="small m0 w6-cap"></p>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const sm = ctx.narrow;
          const W = sm ? 360 : 600, H = 300, gap = 8;
          const procs = [
            { name: 'Browser', ci: 2, th: [['UI', 4], ['Download', 3], ['Prefetch', 1]] },
            { name: 'Media player', ci: 3, th: [['Audio', 6], ['Decoder', 3]] },
            { name: 'Backup', ci: 1, th: [['Copier', 3]] },
          ];
          const boxW = (W - 2 * gap - 2 * 4) / 3, pillW = boxW - 12, fs = sm ? 14 : 15;
          const threads = [];
          procs.forEach((p, pi) => p.th.forEach(([n, ri], k) => threads.push({ n, pri: basePri(p.ci, ri), rel: RELS[ri][0], pi, k })));
          const ranked = threads.slice().sort((a, b) => b.pri - a.pri);
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: { maxHeight: '100%' } });
          const boxes = procs.map((p, pi) => {
            const x = 4 + pi * (boxW + gap);
            return s('g', { class: 'w6-box' },
              s('rect', { x, y: 4, width: boxW, height: 214, rx: 12, class: 's-proc', 'stroke-width': 2 }),
              s('text', { x: x + boxW / 2, y: 26, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': fs }, p.name),
              s('text', { x: x + boxW / 2, y: 45, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, CLASSES[p.ci][0] + ' class · ' + CLASSES[p.ci][1]));
          });
          const pills = threads.map((t) => {
            const g = s('g', { class: 'w6-pill' },
              s('rect', { x: 0, y: 0, width: pillW, height: 38, rx: 10, class: 's-thread', 'stroke-width': 2 }),
              s('text', { x: 9, y: 25, 'font-weight': 700, 'font-size': fs }, t.n),
              s('text', { x: pillW - 9, y: 25, 'text-anchor': 'end', 'font-weight': 900, 'font-size': fs + 2 }, String(t.pri)),
              s('text', { class: 's-sub w6-from', x: pillW + 10, y: 24, 'font-size': 13 }, 'from ' + procs[t.pi].name));
            t.g = g; return g;
          });
          const ax = sm ? 40 : 120;
          const arrow = s('g', { class: 'w6-arrow' },
            s('line', { x1: ax, y1: H - 24, x2: ax, y2: 22, class: 's-line', 'marker-end': 'url(#arr)' }),
            s('text', { x: ax - 12, y: H / 2, transform: `rotate(-90 ${ax - 12} ${H / 2})`, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, 'higher priority runs first'));
          svg.append(...boxes, arrow, ...pills);
          ctx.$('.w6-svg').append(svg);
          const cap = ctx.$('.w6-cap');
          function layout(v) {
            const byThread = v === 'threads';
            boxes.forEach((b) => { b.style.opacity = byThread ? 0 : 1; });
            arrow.style.opacity = byThread ? 1 : 0;
            threads.forEach((t) => {
              let x, y;
              if (byThread) { const r = ranked.indexOf(t); x = sm ? 60 : (W - pillW) / 2 - 60; y = 14 + r * 46; }
              else { x = 4 + t.pi * (boxW + gap) + 6; y = 62 + t.k * 48; }
              t.g.style.transform = `translate(${x}px, ${y}px)`;
              t.g.querySelector('.w6-from').style.opacity = byThread ? 1 : 0;
            });
            cap.innerHTML = byThread
              ? 'The dispatcher sees one list of <b>threads</b>, ordered by priority. The Media player’s Audio thread (15) runs first; the Browser’s Prefetch thread and the Backup’s Copier share level 6 and take turns.'
              : 'People think in <b>processes</b>. Each process has a priority class, and each of its threads sits a little above or below that class (computed later in this section).';
          }
          const seg = ctx.ui.seg([{ value: 'procs', label: 'Grouped by process' }, { value: 'threads', label: 'As the dispatcher sees it' }], 'procs', layout);
          ctx.$('.w6-view').append(seg);
          layout('procs');
          ctx.after(60, () => svg.classList.add('w6-anim'));
        },
      },
      {
        title: '32 priority levels, two bands, one dispatcher rule',
        kind: 'explore',
        html: `
          <div class="stack fill">
            <div class="card white tight w6-strip" style="padding:6px 8px"></div>
            <div class="split l grow">
              <div class="card stack gap-s">
                <div class="row nw" style="justify-content:space-between"><h4 class="m0">Processor</h4><span class="xs muted">click a level in the strip to choose it</span></div>
                <div class="box cpu w6-cpu" style="font-size:18px"></div>
                <div class="grid-2 w6-btns" style="gap:8px"></div>
                <ol class="small m0" style="padding-left:20px">
                  <li>The highest non-empty level wins: the dispatcher reads the highest 1 bit of the <span class="t">ready summary</span>.</li>
                  <li>Equal levels take turns (<span class="t">round robin</span>): a thread whose quantum ends goes to the back of its queue.</li>
                  <li>A higher thread that becomes ready preempts at once; the preempted thread goes to the front of its queue.</li>
                </ol>
                <p class="xs muted m0">Priorities stay fixed in this lab. Boosts come later.</p>
              </div>
              <div class="card white stack gap-s">
                <div class="w6-level"></div>
                <div class="w6-narr"></div>
                <div class="callout warn m0 small" data-label="Common mistake">“Real-time” here does not mean deadlines are guaranteed. Windows makes no timing promise; a real-time level simply runs ahead of every variable-level thread and is never boosted or lowered by the system.</div>
              </div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const sm = ctx.narrow;
          const perRow = sm ? 16 : 32, cw = sm ? 22 : 34, pw = sm ? 20 : 30, ph = 20, stackH = 3 * (ph + 3);
          const head = 18, rowH = head + stackH + 4 + 44 + 22, W = perRow * cw + 16, H = (sm ? 2 : 1) * rowH;
          const NAMES = { Zp: 'the zero-page thread', Ed: 'an editor thread', Dl: 'a download thread', Ix: 'a file-indexing thread' };
          let st, sel = 8, next = 1, narr = '';
          function reset() {
            st = { q: Array.from({ length: 32 }, () => []), run: null };
            st.q[0].push({ n: 'Zp', p: 0 }); st.q[8].push({ n: 'Ed', p: 8 }, { n: 'Dl', p: 8 }); st.q[4].push({ n: 'Ix', p: 4 });
            next = 1; sel = 8;
            narr = 'Four threads are ready and the processor is idle. Press <b>Run next quantum</b> to let the dispatcher choose.';
          }
          const who = (t) => (NAMES[t.n] ? `${t.n} (${NAMES[t.n]})` : t.n);
          const top = () => { for (let L = 31; L >= 0; L--) if (st.q[L].length) return L; return -1; };
          function dispatch(prefix) {
            const L = top(); const t = st.q[L].shift(); st.run = t;
            const rest = st.q[L].length ? ` ${st.q[L].map((x) => x.n).join(', ')} ${st.q[L].length > 1 ? 'wait' : 'waits'} behind it at the same level (round robin).` : '';
            narr = `${prefix}The highest 1 in the ready summary is <b>bit ${L}</b>, so the dispatcher takes the first thread of level ${L}: <b>${who(t)}</b> runs.${rest}`;
          }
          function act(kind) {
            if (kind === 'add') {
              if (sel === 0) return;
              if (next > 9) { narr = 'That is enough threads for one lab. Press Reset to start again.'; return draw(); }
              const t = { n: 'T' + next++, p: sel };
              if (st.run && sel > st.run.p) {
                const v = st.run; st.q[v.p].unshift(v); st.run = t;
                narr = `<b>${t.n}</b> becomes ready at level ${sel}, higher than the running ${v.n} (level ${v.p}). Windows does not wait for the quantum to end: ${t.n} <b>preempts</b> ${v.n} at once, and ${v.n} goes back to the <b>front</b> of the level-${v.p} queue.`;
              } else {
                st.q[sel].push(t);
                narr = st.run ? `<b>${t.n}</b> becomes ready at level ${sel}. That is not higher than the running ${st.run.n} (level ${st.run.p}), so it joins the back of the level-${sel} queue and bit ${sel} of the ready summary is 1.` : `<b>${t.n}</b> joins the back of the level-${sel} queue; bit ${sel} of the ready summary is now 1.`;
              }
            } else if (kind === 'run') {
              let pre = '';
              if (st.run) { const v = st.run; st.q[v.p].push(v); pre = `${v.n} used its whole quantum and goes to the <b>back</b> of the level-${v.p} queue. `; st.run = null; }
              dispatch(pre);
            } else if (kind === 'block') {
              const v = st.run; st.run = null;
              dispatch(`${v.n} starts waiting for I/O, so it leaves the processor and is in no ready queue at all. `);
            } else { reset(); }
            draw();
          }
          const LEVEL_NOTE = {
            0: ['Reserved', 'Only the <span class="t">zero-page thread</span> runs here. It fills free memory pages with zeros when nothing better is ready. (When no thread at all is ready, a processor runs its idle thread, which sits outside the 32 queues.)'],
            1: ['Bottom of the variable band', 'Any thread whose relative priority is Idle lands here, whatever its non-real-time class.'],
            4: ['Idle class', 'The base of the Idle priority class, for work that should run only when the machine has nothing else to do.'],
            6: ['Below normal class', 'The base of the Below normal class.'],
            8: ['Normal class', 'The base of the Normal class. Most programs, and most of their threads, live here.'],
            10: ['Above normal class', 'The base of the Above normal class.'],
            13: ['High class', 'The base of the High class, for programs that must react even when the machine is busy.'],
            15: ['Top of the variable band', 'Time critical threads of every non-real-time class sit here. It is also the ceiling for boosts and the level the starvation rescue lifts a thread to.'],
            16: ['Bottom of the real-time band', 'A Realtime-class thread whose relative priority is Idle sits here, still above every variable-level thread.'],
            24: ['Realtime class', 'The base of the Realtime class. Only privileged programs may use this class.'],
            31: ['Top level', 'A Time critical thread in a Realtime-class process. Nothing outranks it.'],
          };
          function combos(L) {
            const out = [];
            CLASSES.forEach((c, ci) => RELS.forEach((r, ri) => { if (basePri(ci, ri) === L) out.push(`${c[0]} + ${r[0]}`); }));
            return out;
          }
          const strip = ctx.$('.w6-strip'), cpuEl = ctx.$('.w6-cpu'), lvlEl = ctx.$('.w6-level'), narrEl = ctx.$('.w6-narr');
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', 'data-keys': '' });
          strip.append(svg);
          const pos = (L) => { const r = sm ? (L >= 16 ? 0 : 1) : 0, c = sm ? L % 16 : L; return { x: 8 + c * cw, y: r * rowH }; };
          function draw() {
            svg.replaceChildren();
            const bandOf = (L) => (L >= 16 ? 'rt' : L >= 1 ? 'var' : 'zero');
            for (let L = 0; L < 32; L++) {
              const { x, y } = pos(L), cy = y + head + stackH + 4, b = bandOf(L);
              const items = st.q[L];
              items.slice(0, 3).forEach((t, k) => {
                const py = cy - (k + 1) * (ph + 3);
                svg.append(s('rect', { x: x + (cw - pw) / 2, y: py, width: pw, height: ph, rx: 6, class: t.n === 'Zp' ? 's-os' : 's-thread', 'stroke-width': 1.5 }),
                  s('text', { x: x + cw / 2, y: py + 15, 'text-anchor': 'middle', 'font-size': sm ? 12 : 13, 'font-weight': 700 }, items.length > 3 && k === 2 ? '+' + (items.length - 2) : t.n));
              });
              const on = L === sel;
              const g = s('g', { class: 'w6-cell', role: 'button', tabindex: 0, 'aria-label': 'Priority level ' + L, onclick: () => { sel = L; draw(); } });
              g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel = L; draw(); } });
              g.append(s('rect', { x: x + 1, y: cy, width: cw - 2, height: 44, rx: 6, class: b === 'rt' ? 's-accent' : b === 'var' ? 's-panel' : 's-os', 'stroke-width': on ? 3.5 : 1, style: on ? 'stroke:var(--warn)' : '' }),
                s('text', { x: x + cw / 2, y: cy + 17, 'text-anchor': 'middle', 'font-size': sm ? 12 : 13, 'font-weight': on ? 800 : 600 }, String(L)),
                s('text', { x: x + cw / 2, y: cy + 37, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-monot' + (items.length ? '' : ' s-sub'), style: items.length ? 'fill:var(--accent)' : '' }, items.length ? '1' : '0'));
              svg.append(g);
            }
            const lab = (from, to, y, text, style) => { const a = pos(from).x, z = pos(to).x + cw; svg.append(s('text', { x: (a + z) / 2, y, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style }, text)); };
            if (sm) {
              lab(16, 31, head + stackH + 64, 'Real-time levels 16–31 (fixed)', 'fill:var(--accent)');
              lab(1, 15, rowH + head + stackH + 64, 'Variable levels 1–15', '');
            } else {
              lab(16, 31, head + stackH + 64, 'Real-time levels 16–31: fixed priorities', 'fill:var(--accent)');
              lab(1, 15, head + stackH + 64, 'Variable levels 1–15: current priority can move', '');
            }
            svg.append(s('text', { x: 4, y: 14, 'font-size': 13, class: 's-sub' }, sm ? 'ready queues · bit = ready summary' : 'ready queues (front at the bottom) · bottom row of each cell = its ready-summary bit'));
            cpuEl.innerHTML = st.run ? `Running: <b>${st.run.n}</b> <span class="small muted">at level ${st.run.p}</span>` : '<span class="muted">Processor idle</span>';
            const note = LEVEL_NOTE[sel] || (sel >= 16 ? ['Real-time level', 'A fixed level: the system never boosts or lowers a thread here. Threads at the same level take turns.'] : ['Variable level', 'A thread’s current priority can pass through here while it is boosted or decaying back to its base.']);
            const cs = combos(sel);
            lvlEl.innerHTML = `<div class="row nw" style="justify-content:space-between"><b style="font-size:18px">Level ${sel}: ${note[0]}</b><span class="chip ${sel >= 16 ? 'accent' : sel ? '' : 'os'}">${sel >= 16 ? 'real-time band' : sel ? 'variable band' : 'reserved'}</span></div>
              <p class="small m0">${note[1]}</p>
              <p class="xs muted m0">${cs.length ? 'Base priority of: ' + (cs.length > 3 ? cs.slice(0, 3).join(', ') + ` and ${cs.length - 3} more` : cs.join(', ')) : 'No class and relative-priority pair gives this as a base priority.'}</p>`;
            narrEl.innerHTML = `<div class="callout m0 small" style="min-height:72px">${narr}</div>`;
            btns.block.disabled = !st.run || st.run.n === 'Zp';
            btns.add.disabled = sel === 0;   // level 0 belongs to the zero-page thread alone
            btns.add.innerHTML = sel === 0 ? 'Level 0: zero-page thread only' : `+ Ready thread at level ${sel}`;
          }
          const btns = {
            add: h('button', { class: 'btn sm thread', type: 'button', onclick: () => act('add') }),
            run: h('button', { class: 'btn sm primary', type: 'button', onclick: () => act('run') }, 'Run next quantum'),
            block: h('button', { class: 'btn sm', type: 'button', onclick: () => act('block') }, 'Running thread blocks'),
            reset: h('button', { class: 'btn sm', type: 'button', onclick: () => act('reset') }, 'Reset'),
          };
          ctx.$('.w6-btns').append(btns.add, btns.run, btns.block, btns.reset);
          reset(); draw();
        },
      },
      {
        title: 'Base priority = class + relative thread priority',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack gap-s">
              <p class="lead m0">A thread’s starting priority comes from two settings.</p>
              <p class="m0">Each process has a <span class="t">priority class</span>, which fixes a starting number for all of its threads. Each thread then has a <span class="t">relative thread priority</span> that nudges it up or down from there. The result is the thread’s <span class="t">base priority</span>.</p>
              <div class="card tight cpu m0"><div class="mono b" style="font-size:16px">base = class value + offset (−2 … +2)</div></div>
              <p class="m0"><b>Two special cases</b> ignore the offset and jump to the edge of the band: <b>Idle</b> gives 1 (16 in the Realtime class) and <b>Time critical</b> gives 15 (31 in the Realtime class).</p>
              <div class="callout why m0 small" data-label="Why it matters">The bands are sealed. No combination lifts a non-real-time thread above 15, and no Realtime thread falls below 16. A misbehaving ordinary program cannot crowd out real-time work this way.</div>
              <p class="small muted m0">Task Manager’s “Set priority” changes a process’s class; a program sets its own threads’ relative priorities through a system call.</p>
            </div>
            <div class="card white stack gap-s">
              <div class="row" style="justify-content:space-between"><h4 class="m0">Base priority of every combination</h4><div class="w6-mode"></div></div>
              <div class="w6-grid"></div>
              <div class="w6-gdet"></div>
              <div class="row gap-s xs muted"><span class="chip accent">shaded = real-time band (16–31)</span><span class="chip thread">dashed = special case (Idle, Time critical)</span></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const sm = ctx.narrow;
          let mode = 'show', sel = [2, 4], seen = new Set();
          const grid = ctx.$('.w6-grid'), det = ctx.$('.w6-gdet');
          const offTxt = (o) => (o === 'idle' ? 'bottom' : o === 'tc' ? 'top' : (o > 0 ? '+' + o : o < 0 ? '−' + -o : '0'));
          const shortRel = (n) => (sm ? n.replace('Below normal', 'Below').replace('Above normal', 'Above').replace('Time critical', 'Time crit.') : n);
          function cellText(ci, ri) { return mode === 'hide' && !seen.has(ci + ':' + ri) ? '?' : String(basePri(ci, ri)); }
          function draw() {
            const tbl = h('table', { class: 'tbl compact w6-tbl' });
            tbl.append(h('tr', {}, h('th', {}, 'Class ↓ / thread →'), ...RELS.map((r) => h('th', { html: `${shortRel(r[0])}<br><span class="w6-off">${offTxt(r[1])}</span>` }))));
            CLASSES.forEach((c, ci) => {
              tbl.append(h('tr', {}, h('th', { html: `${c[0]} <span class="w6-off">${c[1]}</span>` }),
                ...RELS.map((r, ri) => {
                  const v = basePri(ci, ri), on = sel[0] === ci && sel[1] === ri, sp = typeof r[1] === 'string';
                  return h('td', {}, h('button', { type: 'button', class: 'w6-gc' + (v >= 16 ? ' rt' : '') + (sp ? ' sp' : '') + (on ? ' sel' : ''), 'aria-label': `${c[0]} class, ${r[0]} thread`, onclick: () => { sel = [ci, ri]; seen.add(ci + ':' + ri); draw(); } }, cellText(ci, ri)));
                })));
            });
            grid.replaceChildren(tbl);
            const [ci, ri] = sel, c = CLASSES[ci], r = RELS[ri], v = basePri(ci, ri), rt = isRT(ci);
            let why;
            if (mode === 'hide' && !seen.has(ci + ':' + ri)) why = 'Click a <b>?</b> cell, say its value out loud, and the click will reveal whether you were right.';
            else if (r[1] === 'idle') why = `Idle is a special case: it drops the thread to the bottom of its band, so the class value ${c[1]} does not matter: <b>${v}</b>.`;
            else if (r[1] === 'tc') why = `Time critical is a special case: it lifts the thread to the top of its band, whatever the class value ${c[1]}: <b>${v}</b>.`;
            else why = `${c[0]} class starts at ${c[1]}; ${r[0]} adds ${offTxt(r[1])}: ${c[1]} ${r[1] < 0 ? '−' : '+'} ${Math.abs(r[1])} = <b>${v}</b>.` + (v === 15 && !rt ? ' That equals Time critical: the top of the variable band.' : '');
            det.innerHTML = `<div class="callout m0 small"><div class="row nw" style="justify-content:space-between"><b>${c[0]} class + ${r[0]} thread</b><span class="chip ${v >= 16 ? 'accent' : ''}">${v >= 16 ? 'real-time band' : 'variable band'}</span></div>${why}${mode === 'hide' ? `<div class="xs muted">${seen.size} of 42 revealed</div>` : ''}</div>`;
          }
          const seg = ctx.ui.seg([{ value: 'show', label: 'Show all' }, { value: 'hide', label: 'Test yourself' }], mode, (v) => { mode = v; seen = new Set(); draw(); });
          ctx.$('.w6-mode').append(seg);
          draw();
        },
      },
      {
        title: 'Boost and decay: current priority on the move',
        kind: 'explore',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack gap-s">
              <p class="m0">The base priority is where a thread <b>starts</b>; its <span class="t">current priority</span> is where it <b>is now</b>. When a variable-level thread stops waiting, it gets a <span class="t">priority boost</span>, then <span class="t">priority decay</span> takes it back down: one level after each full quantum it uses, never below its base.</p>
              <h4 class="m0">What was thread E waiting for?</h4>
              <div class="grid-2 w6-src" style="gap:6px"></div>
              <div class="row" style="justify-content:space-between"><h4 class="m0">E’s work after it wakes</h4><div class="w6-work"></div></div>
              <ul class="small m0">
                <li>Current priority = <b>base + increment</b>, capped at <b>15</b>.</li>
                <li>Drivers choose I/O increments (classic values above). A thread of the foreground process also gets a small boost when its wait ends.</li>
                <li>Real-time threads are never boosted.</li>
              </ul>
              <div class="callout why m0 small" data-label="Why it matters">I/O-bound and interactive threads get the processor as soon as their data arrives, then wait again: devices stay busy and replies feel instant. The boost fades within a few quanta.</div>
            </div>
            <div class="card white stack gap-s">
              <div class="w6-bchart" style="min-height:0"></div>
              <div class="row gap-s xs"><span class="chip thread">E: editor thread, base 8</span><span class="chip cpu">C: CPU-bound thread, base 8</span><span class="muted">solid = running · dashed = ready, waiting · 1 column = 1 quantum</span></div>
              <div class="w6-bplayer"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const sm = ctx.narrow;
          let src = BOOSTS[0], work = 8, frames = boostSim(src.inc, work);
          const N = frames.length, W = sm ? 380 : 640, H = 292, x0 = sm ? 34 : 46, sw = (W - x0 - 8) / N;
          const yL = (L) => 14 + (16 - L) * 21, gy = yL(6) + 14;
          const X = (k) => x0 + k * sw;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });
          ctx.$('.w6-bchart').append(svg);
          function drawChart(i) {
            svg.replaceChildren();
            for (let L = 6; L <= 16; L++) {
              svg.append(s('line', { x1: x0, x2: W - 8, y1: yL(L), y2: yL(L), class: 's-muted', 'stroke-width': 1, opacity: 0.6 }));
              if (L % 2 === 0 || L === 15) svg.append(s('text', { x: x0 - 6, y: yL(L) + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(L)));
            }
            svg.append(s('line', { x1: x0, x2: W - 8, y1: yL(15), y2: yL(15), stroke: 'var(--bad)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),
              s('text', { x: W - 10, y: yL(15) - 4, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--bad)' }, 'boost ceiling 15'),
              s('text', { x: W - 10, y: yL(8) + 16, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'base 8'));
            svg.append(s('rect', { x: X(i), y: 6, width: sw, height: gy + 30 - 6, rx: 4, class: 's-accent', opacity: 0.35, 'stroke-width': 0 }));
            for (let k = 0; k <= i; k++) {
              const f = frames[k];
              if (f.eState === 'run' || f.eState === 'ready') svg.append(s('line', { x1: X(k) + 2, x2: X(k + 1) - 2, y1: yL(f.e) - 3, y2: yL(f.e) - 3, stroke: 'var(--thread)', 'stroke-width': f.eState === 'run' ? 6 : 3, 'stroke-dasharray': f.eState === 'run' ? null : '5 4', 'stroke-linecap': 'round' }));
              svg.append(s('line', { x1: X(k) + 2, x2: X(k + 1) - 2, y1: yL(f.c) + 4, y2: yL(f.c) + 4, stroke: 'var(--cpu)', 'stroke-width': f.cState === 'run' ? 6 : 3, 'stroke-dasharray': f.cState === 'run' ? null : '5 4', 'stroke-linecap': 'round' }));
              svg.append(s('rect', { x: X(k) + 1.5, y: gy, width: sw - 3, height: 26, rx: 5, class: f.run === 'E' ? 's-thread' : 's-cpu', 'stroke-width': 1.5 }),
                s('text', { x: X(k) + sw / 2, y: gy + 18, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, f.run));
            }
            for (let k = 0; k < N; k++) svg.append(s('text', { x: X(k) + sw / 2, y: gy + 44, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(k)));
            svg.append(s('text', { x: x0 - 6, y: gy + 18, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'runs'),
              s('text', { x: x0 - 6, y: gy + 44, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'q'));
          }
          function caption(i) {
            const f = frames[i], out = [`<b>Quantum ${i}.</b>`];
            if (i === 0) out.push(`C, a CPU-bound thread at base 8, runs. E, an editor thread also at base 8, is blocked waiting for ${src.wait}.`);
            for (const e of f.start) {
              if (e.k === 'wake') out.push(`${src.done}, so E’s wait is over and it is boosted: 8 + ${src.inc} = ${e.want}` + (e.capped ? `, but boosts stop at 15, so E’s current priority is <b>15</b>.` : `, so E’s current priority is <b>${e.cur}</b>.`));
              if (e.k === 'preempt') out.push(`That beats C’s ${e.vp}, so E <b>preempts</b> C at once; C goes to the front of the level-8 queue.`);
            }
            if (i > 0 && f.run === 'E' && !f.start.length) out.push(f.e > f.c ? `E is the highest ready thread, so it runs at ${f.e}.` : `It is E’s turn at level ${f.e} (round robin with C), so E runs.`);
            if (i > 0 && f.run === 'C') out.push(f.eState === 'ready' ? `C runs; E waits its turn at ${f.e}.` : 'C runs alone; E is blocked again.');
            for (const e of f.end) {
              if (e.k === 'decay') out.push(`E used a full quantum, so it decays ${e.from} → <b>${e.to}</b>.` + (e.to === 8 ? ' It is back at its base, level with C: now they take turns.' : ''));
              if (e.k === 'turn') out.push('E used its quantum at its base, so there is nothing to decay; it goes behind C.');
              if (e.k === 'block') out.push(`E has finished its burst of work and blocks, waiting for ${src.wait} again. Its next boost will again start from its base 8.`);
            }
            return out.join(' ');
          }
          const player = ctx.ui.player({ count: N, render: (i) => { drawChart(i); return caption(i); }, interval: 1800 });
          ctx.$('.w6-bplayer').append(player.el);
          const srcBtns = BOOSTS.map((b) => h('button', { type: 'button', class: 'btn sm io', style: { justifyContent: 'flex-start' }, onclick: () => { src = b; rerun(); } }, h('b', { class: 'mono' }, '+' + b.inc), ' ' + b.label));
          ctx.$('.w6-src').append(...srcBtns);
          const ws = ctx.ui.seg([{ value: 2, label: '2 q' }, { value: 4, label: '4 q' }, { value: 8, label: '8 q' }], work, (v) => { work = v; rerun(); });
          ctx.$('.w6-work').append(ws);
          function rerun() {
            frames = boostSim(src.inc, work);
            srcBtns.forEach((b, k) => { b.classList.toggle('on', BOOSTS[k] === src); b.setAttribute('aria-pressed', BOOSTS[k] === src); });
            player.reset();
          }
          rerun();
        },
      },
      {
        title: 'Starvation rescue: the balance set manager',
        kind: 'explore',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack gap-s">
              <p class="m0">Strict priority has a dark side: a low-priority ready thread can wait forever behind a busy higher one (<span class="t">starvation</span>). Windows’ safety net is the <span class="t">balance set manager</span>:</p>
              <ol class="small m0">
                <li>It wakes about <b>once a second</b>.</li>
                <li>It looks for ready threads that have waited about <b>4 seconds</b> or more.</li>
                <li>It raises each one to <b>15</b> for one quantum: classically a doubled one (Windows 2000/XP; this lab uses it); later versions give a short fixed amount instead.</li>
                <li>When that quantum ends the thread drops <b>straight back</b> to its base: no step-by-step decay.</li>
              </ol>
              <div class="stack gap-s w6-sctl"></div>
              <div class="callout why m0 small" data-label="Why it matters">If the starving thread holds a lock that a high-priority thread needs, that thread is stuck too (a <span class="t">priority inversion</span>, see 10.2). A brief rescue lets the holder release the lock.</div>
            </div>
            <div class="card white stack gap-s">
              <div class="w6-schart" style="min-height:0"></div>
              <div class="row gap-s xs muted"><span class="chip os">◇ scan: nothing to do</span><span class="chip ok">◇ scan: rescue runs</span><span class="chip bad">◇ scan: rescue cannot win</span><span>dashed lane = ready or blocked, waiting</span></div>
              <div class="w6-splayer"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { s } = ctx;
          const sm = ctx.narrow;
          let readyAt = 0.3, hiPri = 10, lock = false, R = starveSim(readyAt, hiPri, lock);
          const HZ = 12, W = sm ? 380 : 640, x0 = sm ? 62 : 92, xs = (W - x0 - 14) / HZ, X = (t) => x0 + t * xs;
          const svg = s('svg', { viewBox: `0 0 ${W} 300`, width: '100%' });
          ctx.$('.w6-schart').append(svg);
          const fmt = (v, d = 2) => ctx.util.fmt(v, d);
          function lanes() { return lock ? [['H', 46], ['L', 96], ['T', 140]] : [['H', 56], ['L', 112]]; }
          function draw(i) {
            svg.replaceChildren();
            const L = lanes(), y = Object.fromEntries(L), gTop = 182, gBot = 270, gy = (w) => gBot - Math.min(w, 6) / 6 * (gBot - gTop);
            svg.append(s('text', { x: 4, y: 22, 'font-size': 12.5, class: 's-sub' }, sm ? 'scans' : 'manager scans'));
            for (let t = 1; t <= HZ; t++) {
              const sc = R.scans[t - 1], done = t <= i, hit = sc.act === 'run', bad = sc.act === 'stuck' || sc.act === 'still';
              svg.append(s('path', { d: `M${X(t)},12 l6,6 l-6,6 l-6,-6 z`, class: !done ? 's-panel' : hit ? 's-ok' : bad ? 's-bad' : 's-os', 'stroke-width': 1.5 }));
            }
            svg.append(s('rect', { x: X(i) - 1, y: 30, width: 2, height: gBot - 30, class: 's-accent', 'stroke-width': 0 }));
            const label = { H: `H (${hiPri})`, L: 'L (4)', T: 'T (12)' };
            for (const [n, yy] of L) {
              svg.append(s('text', { x: 4, y: yy + 18, 'font-size': 13, 'font-weight': 700 }, label[n]));
              svg.append(s('rect', { x: X(0), y: yy, width: X(HZ) - X(0), height: 26, rx: 5, class: 's-panel', 'stroke-width': 1, opacity: 0.5 }));
            }
            const runsNow = R.runs.filter((r) => r.from <= i);
            const gaps = runsNow.map((r) => [r.from, r.to + (lock && r === R.runs[0] ? 0.05 : 0)]);
            let t0 = 0;
            for (const [a, b] of gaps.concat([[i, i]])) { if (a > t0) svg.append(s('rect', { x: X(t0), y: y.H, width: X(Math.min(a, i)) - X(t0), height: 26, rx: 4, class: hiPri >= 16 ? 's-accent' : 's-cpu', 'stroke-width': 1.5 })); t0 = b; }
            if (i > readyAt) svg.append(s('rect', { x: X(readyAt), y: y.L + 6, width: X(i) - X(readyAt), height: 14, rx: 4, fill: 'none', stroke: 'var(--thread)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
            for (const r of runsNow) {
              svg.append(s('rect', { x: X(r.from), y: y.L - 4, width: Math.max(5, X(r.to) - X(r.from)), height: 34, rx: 2, class: 's-thread', 'stroke-width': 2 }),
                s('text', { x: X(r.from) + 8, y: y.L - 8, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, '15'));
            }
            const stuck = R.scans.find((x) => x.act === 'stuck');
            if (stuck && stuck.t <= i) svg.append(s('text', { x: X(stuck.t) + 4, y: y.L - 6, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--bad)' }, 'raised to 15, still below H'));
            if (lock) {
              const tEnd = R.freed == null ? i : Math.min(i, R.runs[0].to);
              if (tEnd > 0) svg.append(s('rect', { x: X(0), y: y.T + 6, width: X(tEnd) - X(0), height: 14, rx: 4, fill: 'none', stroke: 'var(--bad)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }));
              if (R.freed != null && i >= R.runs[0].from) svg.append(s('rect', { x: X(R.runs[0].to), y: y.T, width: Math.max(5, X(R.runs[0].to + 0.05) - X(R.runs[0].to)), height: 26, rx: 2, class: 's-ok', 'stroke-width': 2 }));
            }
            svg.append(s('text', { x: 4, y: gTop + 6, 'font-size': 12.5, class: 's-sub' }, 'L waited'),
              s('line', { x1: X(0), x2: X(HZ), y1: gy(4), y2: gy(4), stroke: 'var(--warn)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),
              s('text', { x: X(HZ), y: gy(4) - 5, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, style: 'fill:var(--warn)' }, '4 s'),
              s('line', { x1: X(0), x2: X(HZ), y1: gBot, y2: gBot, class: 's-muted', 'stroke-width': 1 }));
            const pts = [[X(readyAt), gy(0)]]; let since = readyAt;
            for (const r of runsNow) { pts.push([X(r.from), gy(r.from - since)], [X(r.from), gy(0)], [X(r.to), gy(0)]); since = r.to; }
            if (i - since > 6) { pts.push([X(since + 6), gy(6)], [X(i), gy(6)]); svg.append(s('text', { x: X(since + 6) + 4, y: gy(6) - 5, 'font-size': 12.5, 'font-weight': 700, style: 'fill:var(--thread)' }, 'off the scale, still growing')); }
            else if (i > since) pts.push([X(i), gy(i - since)]);
            if (pts.length > 1) svg.append(s('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: 'var(--thread)', 'stroke-width': 2.5 }));
            for (let t = 0; t <= HZ; t += sm ? 2 : 1) svg.append(s('text', { x: X(t), y: gBot + 18, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, t + (t === HZ ? ' s' : '')));
          }
          function caption(i) {
            if (i === 0) return `<b>Time 0.</b> H, a CPU-bound thread at priority ${hiPri}, owns the processor. L (priority 4) ${readyAt === 0 ? 'is ready too' : `becomes ready at ${fmt(readyAt, 1)} s`}, but every dispatch picks H.` + (lock ? ' T (priority 12) is blocked: it needs a lock that L holds.' : '');
            const sc = R.scans[i - 1], w = fmt(sc.waited);
            let out = `<b>Scan at ${i} s.</b> `;
            if (sc.act === 'none') out += `L has waited ${w} s, less than 4 s, so the balance set manager does nothing.`;
            else if (sc.act === 'run') {
              out += `L has waited ${w} s (4 s or more). It is raised to <b>15</b> with the classic doubled quantum (${fmt(R.qms, 1)} ms). 15 beats H’s ${hiPri}, so L runs, then drops straight back to 4.`;
              if (lock && R.runs[0].from === i) out += ` Within 5 ms L releases the lock and T is ready, but L at 15 keeps the processor until its quantum ends. Then T (priority 12) outranks H’s ${hiPri} and finally runs at <b>${fmt(R.tRun, 4)} s</b>.`;
            } else if (sc.act === 'stuck') out += `L has waited ${w} s and is raised to 15, but H sits at ${hiPri}, a real-time level. 15 cannot beat it, so L keeps waiting: the rescue only helps against variable-level threads.`;
            else out += `L is still stuck at 15 below H (${w} s and counting).`;
            if (i === HZ) out += R.runs.length ? ` Over these ${fmt(HZ - readyAt, 1)} s L got ${R.runs.length} × ${fmt(R.qms, 1)} ms, about ${fmt(R.share * 100, 1)}% of the processor: enough to make progress, not a fair share.` : ' In all this time L has not run at all.';
            return out;
          }
          const player = ctx.ui.player({ count: HZ + 1, render: (i) => { draw(i); return caption(i); }, interval: 1500 });
          ctx.$('.w6-splayer').append(player.el);
          const rerun = () => { R = starveSim(readyAt, hiPri, lock); player.reset(); };
          const ctl = ctx.$('.w6-sctl');
          ctl.append(
            ctx.h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, ctx.h('span', { class: 'small b' }, 'H’s priority'), ctx.ui.seg([{ value: 10, label: '10 (variable)' }, { value: 16, label: '16 (real-time)' }], hiPri, (v) => { hiPri = v; rerun(); })),
            ctx.h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, ctx.h('span', { class: 'small b' }, 'Scenario'), ctx.ui.seg([{ value: false, label: 'Plain' }, { value: true, label: 'L holds T’s lock' }], lock, (v) => { lock = v; rerun(); })),
            ctx.ui.slider({ label: 'L becomes ready at', min: 0, max: 0.9, step: 0.1, value: readyAt, format: (v) => fmt(v, 1) + ' s', onInput: (v) => { readyAt = v; rerun(); } }));
        },
      },
      {
        title: 'Quantum length: client, server and the foreground',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack gap-s">
              <p class="m0">Windows counts a <span class="t">time quantum</span> in <span class="t">clock intervals</span>, the gaps between two clock interrupts: about 15.6 ms on most modern PCs, 10 ms on some older single-processor machines.</p>
              <table class="tbl compact m0">
                <tr><th>Edition</th><th>Default quantum</th><th>Foreground process</th></tr>
                <tr><td><b>Client</b> (desktop)</td><td>short: 2 clock intervals</td><td>stretched, up to 3×</td></tr>
                <tr><td><b>Server</b></td><td>long: 12 clock intervals</td><td>no stretching</td></tr>
              </table>
              <p class="m0"><span class="t">Quantum stretching</span> gives the threads of the <span class="t">foreground process</span> longer turns. It changes how <b>much</b> processor time they get, not their priority: they still wait for any higher-priority thread.</p>
              <div class="callout why m0 small" data-label="Why it matters">Short quanta keep a desktop snappy. Long quanta let a server finish a request in one turn with fewer <span class="t" data-t="Context switch">context switches</span>. Both are defaults: the “Adjust for best performance of: Programs / Background services” setting switches between them.</div>
            </div>
            <div class="card white stack gap-s">
              <div class="grid-3 w6-qctl" style="gap:8px"></div>
              <div class="grid-2 w6-qnum" style="gap:10px"></div>
              <h4 class="m0">One second of processor time: three equal-priority CPU-bound threads</h4>
              <div class="w6-qstrip"></div>
              <p class="xs muted m0">F = foreground thread · B1, B2 = background threads · they take turns F, B1, B2, F, …</p>
              <p class="small m0 w6-qres"></p>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const sm = ctx.narrow;
          let ed = 'client', st = 3, ck = CLOCK_MS;
          const fmt = (v, d) => ctx.util.fmt(v, d);
          const ms = (v) => String(+v.toFixed(3)) + ' ms';
          const W = sm ? 380 : 640, svg = s('svg', { viewBox: `0 0 ${W} 116`, width: '100%' });
          ctx.$('.w6-qstrip').append(svg);
          const numEl = ctx.$('.w6-qnum'), resEl = ctx.$('.w6-qres');
          const stretchSeg = ctx.ui.seg([{ value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 3, label: '3×' }], st, (v) => { st = v; draw(); });
          const lab = (t, el2) => h('div', { class: 'stack gap-s' }, h('span', { class: 'xs muted b' }, t), el2);
          ctx.$('.w6-qctl').append(
            lab('Edition', ctx.ui.seg([{ value: 'client', label: 'Client' }, { value: 'server', label: 'Server' }], ed, (v) => { ed = v; draw(); })),
            lab('Foreground stretch', stretchSeg),
            lab('Clock interval', ctx.ui.seg([{ value: CLOCK_MS, label: '15.6 ms' }, { value: 10, label: '10 ms' }], ck, (v) => { ck = v; draw(); })));
          function draw() {
            const Q = quantumInfo(ed, st, ck);
            stretchSeg.querySelectorAll('button').forEach((b) => { b.disabled = ed === 'server'; });
            numEl.replaceChildren(
              h('div', { class: 'card tight cpu' }, h('div', { class: 'xs muted b' }, 'Background quantum'), h('div', { class: 'big', style: { fontSize: '32px' } }, ms(Q.bgMs)), h('div', { class: 'xs muted' }, `${Q.intervals} × ${ms(ck)}`)),
              h('div', { class: 'card tight thread' }, h('div', { class: 'xs muted b' }, 'Foreground quantum'), h('div', { class: 'big', style: { fontSize: '32px' } }, ms(Q.fgMs)), h('div', { class: 'xs muted' }, ed === 'server' ? 'servers do not stretch' : `${Q.s} × ${ms(Q.bgMs)}`)));
            const x0 = 6, sx = (W - 12) / 1000;
            svg.replaceChildren();
            for (const tr of Q.turns) {
              const x = x0 + tr.from * sx, w = (tr.to - tr.from) * sx;
              svg.append(s('rect', { x: x + 0.5, y: 10, width: Math.max(1, w - 1), height: 70, rx: 3, class: tr.who === 'F' ? 's-thread' : 's-cpu', 'stroke-width': 1.2 }));
              if (w >= 22) svg.append(s('text', { x: x + w / 2, y: 51, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, tr.who));
            }
            for (let t = 0; t <= 1000; t += 250) svg.append(s('line', { x1: x0 + t * sx, x2: x0 + t * sx, y1: 82, y2: 90, class: 's-line', 'stroke-width': 1.5 }), s('text', { x: Math.min(W - 24, Math.max(14, x0 + t * sx)), y: 108, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, t + ' ms'));
            resEl.innerHTML = (Q.s > 1 ? `F gets <b>${fmt(Q.share * 100, 1)}%</b> of the processor (an equal split would be 33.3%)` : 'F gets <b>33.3%</b> of the processor, the same as each background thread') + `, and <b>${Q.turns.length}</b> turns begin in this one second. ` +
              (ed === 'server' ? 'With long server quanta only a handful of switches happen, and each thread does a big chunk of work per turn.' : Q.s > 1 ? 'Stretching changed the share, not the priority: all three threads are still at the same level.' : 'With no stretching the three threads share the processor equally.');
          }
          draw();
        },
      },
      {
        title: 'You place the threads: four processors and affinity',
        kind: 'lab',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack gap-s">
              <p class="m0">On a multiprocessor any processor may run any thread, unless the thread’s <span class="t" data-t="Hard affinity">hard affinity</span> forbids it. Windows tries to keep the highest-priority ready threads running across all processors.</p>
              <div class="card tight m0 small"><b>Hard affinity</b> (affinity mask): the processors a thread is <b>allowed</b> to use. A rule.<br><b><span class="t" data-t="Ideal processor">Ideal processor</span></b> (soft affinity): the processor Windows <b>prefers</b> for it, because its <span class="t">cache memory</span> may still hold the thread’s data. A preference.</div>
              <h4 class="m0">The rules used in this lab (simplified)</h4>
              <ol class="small m0">
                <li>A newly ready thread takes an idle allowed processor: its ideal one if idle, else the one it last used, else the lowest-numbered.</li>
                <li>No idle allowed processor? It preempts the lowest-priority thread running on an allowed processor, if its own priority is strictly higher.</li>
                <li>Otherwise it waits in the ready list.</li>
                <li>A processor that frees up takes the highest-priority waiting thread allowed on it.</li>
              </ol>
              <p class="xs muted m0">Real Windows is less thorough: with no idle allowed processor it compares the newcomer only with the thread on its ideal processor, so the highest-priority threads usually, not always, run. Machines with more than 64 logical processors also split them into processor groups.</p>
            </div>
            <div class="card white stack gap-s">
              <div class="grid-4 w6-cpus" style="gap:8px"></div>
              <div class="row gap-s w6-ready"></div>
              <div class="card tight stack gap-s w6-ev"></div>
              <div class="w6-fb grow" style="min-height:0"></div>
              <div class="w6-roster"></div>
              <div class="row w6-mctl" style="justify-content:space-between"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const RUN = mpRun();
          let k = 0, answered = false, score = 0, pickedCpu = null;
          const cpusEl = ctx.$('.w6-cpus'), readyEl = ctx.$('.w6-ready'), evEl = ctx.$('.w6-ev'), fbEl = ctx.$('.w6-fb'), ctlEl = ctx.$('.w6-mctl');
          const T = MP_THREADS;
          const maskTxt = (n) => (T[n].mask.length === 4 ? 'any CPU' : 'CPU ' + T[n].mask.join(', ') + ' only');
          const tTxt = (n) => `${n} (${T[n].pri})`;
          const state = () => (answered ? RUN[k].after : RUN[k] ? RUN[k].before : RUN[RUN.length - 1].after);
          function explain(r) {
            const [kind, n] = r.ev, res = r.res, b = r.before, a = r.after, th = T[n];
            if (kind === 'ready') {
              if (res.how === 'ideal') return `${n} goes to <b>CPU ${res.answer}</b>: it is idle, ${n} may use it, and it is ${n}’s ideal processor.`;
              if (res.how === 'idle') return `${n}’s ideal processor, CPU ${th.ideal}, is busy, but <b>CPU ${res.answer}</b> is idle and allowed. Taking an idle processor beats waiting for the ideal one: soft affinity is only a preference.`;
              if (res.how === 'wait') return `Every processor ${n} may use runs a thread of priority ${th.pri} or more, so ${n} <b>waits</b> in the ready list.`;
              const allowed = th.mask.map((c) => `CPU ${c}: ${tTxt(b.run[c])}`).join(', ');
              let out = th.mask.length === 1
                ? `${n} may use only <b>CPU ${res.answer}</b>, which runs ${tTxt(res.victim)}. ${th.pri} is higher, so ${n} <b>preempts</b> ${res.victim}, which goes back to the front of the ready list.`
                : `No processor ${n} may use is idle (${allowed}). The lowest is ${tTxt(res.victim)} on <b>CPU ${res.answer}</b>, and ${th.pri} is higher, so ${n} <b>preempts</b> ${res.victim}, which goes back to the front of the ready list.`;
              const lower = a.run.map((x, c) => [x, c]).filter(([x, c]) => x && T[x].pri < T[res.victim].pri && !T[res.victim].mask.includes(c));
              if (lower.length) { const items = lower.map(([x, c]) => `${tTxt(x)} on CPU ${c}`); out += ` <b>Hard affinity has a price:</b> ${tTxt(res.victim)} now waits while lower-priority threads run (${items.length > 1 ? items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1] : items[0]}), because ${res.victim} may use ${maskTxt(res.victim)}.`; }
              return out;
            }
            const cands = b.ready.filter((w) => T[w].mask.includes(res.cpu));
            const shut = b.ready.filter((w) => !T[w].mask.includes(res.cpu) && (res.answer === 'idle' || T[w].pri > T[res.answer].pri));
            let out = `${n} blocks, so CPU ${res.cpu} is free. ` + (cands.length ? (cands.length === 1 ? `The only waiting thread allowed there is ${tTxt(res.answer)}, so <b>${res.answer}</b> runs` : `Waiting threads allowed there: ${cands.map(tTxt).join(', ')}. The highest, <b>${res.answer}</b>, runs`) + (T[res.answer].ideal !== res.cpu ? ` even though its ideal processor is CPU ${T[res.answer].ideal}.` : '.') : 'No waiting thread may use it, so it <b>stays idle</b>.');
            if (shut.length) out += ` ${shut.map(tTxt).join(', ')} ${shut.length > 1 ? 'are' : 'is'} higher but may use ${maskTxt(shut[0])}, so ${shut.length > 1 ? 'they cannot' : 'it cannot'} take CPU ${res.cpu}.`;
            return out;
          }
          function answer(v) {
            if (answered || k >= RUN.length) return;
            const r = RUN[k], ok = v === r.res.answer;
            if (ok) score++;
            answered = true; pickedCpu = r.res.cpu != null ? r.res.cpu : (typeof r.res.answer === 'number' ? r.res.answer : null);
            fbEl.innerHTML = `<div class="callout ${ok ? 'tip' : v == null ? '' : 'bad'} m0 small" data-label="${ok ? 'Correct' : v == null ? 'Answer' : 'Not quite'}">${explain(r)}</div>`;
            draw();
          }
          function next() { if (!answered) return; k++; answered = false; pickedCpu = null; fbEl.innerHTML = ''; draw(); }
          function restart() { k = 0; answered = false; score = 0; pickedCpu = null; fbEl.innerHTML = ''; draw(); }
          const names = Object.keys(T);
          ctx.$('.w6-roster').append(h('table', { class: 'tbl compact w6-ros' },
            h('tr', {}, h('th', {}, 'Thread'), ...names.map((n) => h('th', {}, n))),
            h('tr', {}, h('td', { class: 'b' }, 'Priority'), ...names.map((n) => h('td', {}, String(T[n].pri)))),
            h('tr', {}, h('td', { class: 'b' }, 'Allowed CPUs'), ...names.map((n) => h('td', {}, T[n].mask.length === 4 ? 'any' : T[n].mask.join(', ')))),
            h('tr', {}, h('td', { class: 'b' }, 'Ideal CPU'), ...names.map((n) => h('td', {}, String(T[n].ideal))))));
          function draw() {
            const st = state();
            cpusEl.replaceChildren(...[0, 1, 2, 3].map((c) => {
              const n = st.run[c];
              return h('div', { class: 'card tight ' + (n ? 'cpu' : '') + (answered && pickedCpu === c ? ' flash' : ''), style: { padding: '6px 10px' } },
                h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('b', { class: 'small' }, 'CPU ' + c), n && T[n].ideal === c ? h('span', { class: 'chip ok', title: 'this is its ideal processor' }, 'ideal') : null),
                n ? h('div', { html: `<span style="font-size:22px;font-weight:900">${n}</span> <span class="chip thread">pri ${T[n].pri}</span>` }) : h('div', { class: 'muted', style: { fontSize: '18px', fontWeight: 700 } }, 'idle'),
                h('div', { class: 'xs muted' }, n ? maskTxt(n) : ' '));
            }));
            readyEl.replaceChildren(h('span', { class: 'small b' }, 'Ready list:'), ...(st.ready.length ? st.ready.map((w) => h('span', { class: 'chip thread' }, `${w} · ${T[w].pri} · ${maskTxt(w)}`)) : [h('span', { class: 'small muted' }, 'empty')]));
            if (k >= RUN.length) {
              evEl.innerHTML = `<b>All ${RUN.length} events done.</b> You placed <b>${score} of ${RUN.length}</b> correctly on the first try. Final state: every processor is busy and the ready list is empty.`;
            } else {
              const [kind, n] = RUN[k].ev, th = T[n];
              const prompt = kind === 'ready'
                ? `<b>Event ${k + 1} of ${RUN.length}:</b> thread <b>${n}</b> becomes ready: priority <b>${th.pri}</b>, hard affinity <b>${maskTxt(n)}</b>, ideal processor <b>CPU ${th.ideal}</b>. Where does it go?`
                : `<b>Event ${k + 1} of ${RUN.length}:</b> thread <b>${n}</b> (on CPU ${RUN[k].before.run.indexOf(n)}) blocks to wait for I/O. Which thread does the freed processor run?`;
              const opts = kind === 'ready'
                ? [0, 1, 2, 3].map((c) => [c, 'CPU ' + c]).concat([['wait', 'Wait in ready list']])
                : RUN[k].before.ready.map((w) => [w, `${w} (${T[w].pri})`]).concat([['idle', 'Nobody: it idles']]);
              evEl.replaceChildren(h('div', { class: 'small', html: prompt }),
                h('div', { class: 'row gap-s' }, ...opts.map(([v, lab]) => {
                  const right = answered && v === RUN[k].res.answer;
                  return h('button', { type: 'button', class: 'btn sm' + (right ? ' on' : ''), disabled: answered && !right, onclick: () => answer(v) }, lab);
                })));
            }
            ctlEl.replaceChildren(h('span', { class: 'small muted', style: { whiteSpace: 'nowrap' } }, `Score ${score} / ${Math.min(RUN.length, k + (answered ? 1 : 0))}`),
              h('div', { class: 'row gap-s' },
                h('button', { type: 'button', class: 'btn sm', disabled: answered || k >= RUN.length, onclick: () => answer(null) }, 'Show me'),
                h('button', { type: 'button', class: 'btn sm primary', disabled: !answered, onclick: next }, k >= RUN.length - 1 && answered ? 'Finish' : 'Next event'),
                h('button', { type: 'button', class: 'btn sm', onclick: restart }, 'Restart')));
          }
          draw();
        },
      },
      {
        title: 'Recap: Windows scheduling in six cards',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Click each card to check yourself. Try to say the answer before you flip.'),
            ctx.ui.flipcards([
              ['How many priority levels are there, and which are real-time?', '32 levels (0–31). <b>16–31</b>: real-time, fixed. <b>1–15</b>: variable, the current priority moves. <b>0</b>: reserved for the zero-page thread.'],
              ['How is a thread’s base priority computed?', 'Class value (Idle 4, Below normal 6, Normal 8, Above normal 10, High 13, Realtime 24) plus an offset of −2 … +2. Idle gives 1 (16), Time critical gives 15 (31).'],
              ['What happens when a thread’s I/O completes?', 'Current priority = base + increment (keyboard or mouse +6, sound +8, network +2, disk +1), never above 15. Then it drops one level per full quantum back to the base.'],
              ['How does Windows rescue a starving thread?', 'About once a second the balance set manager lifts ready threads that waited about 4 s to <b>15</b> for one quantum (classically doubled). Then they drop straight back to their base.'],
              ['How long is a quantum?', 'Client: 2 clock intervals (31.25 ms at 15.625 ms), foreground stretched up to 3×. Server: 12 clock intervals (187.5 ms), no stretching.'],
              ['Hard affinity or ideal processor?', '<b>Hard affinity</b>: the processors a thread may use, a rule. <b>Ideal processor</b> (soft affinity): the one Windows prefers for a warm cache, only a preference.'],
            ], { cols: 3, height: 222 })));
        },
      },
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { type: 'tf', q: 'The Windows scheduler chooses among threads, not processes, so two threads of the same process can have different priorities.', answer: true,
            why: 'Threads are the unit of scheduling. A process’s class sets a starting point, and each thread’s relative priority moves it up or down, so threads of one process can sit at different levels.' },
          { q: 'Which statement about the Windows real-time priority levels (16–31) is true?',
            choices: ['Their priority is fixed: the system never boosts or lowers it', 'Windows guarantees that their threads always meet deadlines', 'Any program reaches them by putting its process in the High class', 'A large enough I/O boost can lift a Normal thread into this band'], answer: 0,
            feedback: [null, 'Windows makes no deadline promise. These levels simply run ahead of every variable-level thread.', 'The High class tops out at 15. Only the Realtime class, which needs special privilege, reaches 16–31.', 'Boosts stop at 15, so a variable-level thread never enters the real-time band.'],
            why: 'Real-time levels are fixed-priority levels: no boosts, no decay, and equal threads take turns. “Real-time” describes the band, not a timing guarantee.' },
          { q: 'A process in the High priority class creates a thread whose relative priority is Above normal. What is the thread’s base priority?',
            choices: ['13', '15', '14', '24'], answer: 2,
            feedback: ['13 is the High class value itself; Above normal adds 1 to it.', '15 is what High + Highest or a Time critical thread gets, not Above normal.', null, '24 is the base of the Realtime class. A High-class thread never enters the real-time band.'],
            why: 'Base priority = class value + offset: High is 13 and Above normal adds +1, giving 14.' },
          { type: 'bucket', q: 'Sort each combination of process class and relative thread priority by the band its base priority falls in.', buckets: ['Real-time band (16–31)', 'Variable band (1–15)'],
            items: [['Realtime class, Idle thread', 0], ['High class, Time critical thread', 1], ['Normal class, Highest thread', 1], ['Realtime class, Lowest thread', 0], ['Idle class, Time critical thread', 1], ['High class, Highest thread', 1]],
            why: 'Only the Realtime class reaches 16–31 (Idle gives 16, Lowest gives 22). Every other class stays at or below 15: Time critical gives exactly 15, and High + Highest is 13 + 2 = 15.' },
          { type: 'match', q: 'Match each completed I/O with the classic priority increment its driver gives the waiting thread.', pairs: [['Disk', '+1'], ['Network', '+2'], ['Keyboard or mouse', '+6'], ['Sound card', '+8']],
            why: 'The bigger the increment, the more a human is waiting on the result: input devices and sound get the largest boosts, a disk read the smallest. Drivers choose these values.' },
          { type: 'num', q: 'A thread with base priority 8 has been waiting for keyboard input. The key press arrives (+6), and the thread then uses three full quanta in a row without waiting again. What is its current priority now?', answer: 11,
            why: 'The boost gives 8 + 6 = 14. Each full quantum it uses lowers it by one: 14 → 13 → 12 → 11. It would keep falling until it reached its base of 8.' },
          { type: 'tf', q: 'A thread with base priority 13 that receives a +6 keyboard boost runs at priority 19.', answer: false,
            why: 'Boosts never lift a thread above 15, the top of the variable band, so it runs at 15. A variable-level thread can never reach the real-time levels.' },
          { type: 'order', q: 'Put the life of a boosted editor thread in order.',
            items: ['The thread blocks, waiting for a key press', 'The key press completes and its current priority becomes base + 6', 'It preempts a lower-priority thread that is running', 'After each full quantum it uses, its current priority drops by one', 'Its current priority is back at its base and stays there'],
            why: 'Wait, boost on wake-up, preempt, then decay one level per full quantum until the base priority is reached; decay never goes below the base.' },
          { q: 'A ready thread at priority 4 has not run for 4 seconds, because a CPU-bound thread at priority 10 never blocks. What does the balance set manager do about it?',
            choices: ['It raises the waiting thread one level per second until it passes 10', 'It lowers the busy thread to priority 4 so that the two take turns', 'It moves the waiting thread up to 16 until all of its work is done', 'It raises the waiting thread to 15 for one quantum, then back to 4'], answer: 3,
            feedback: ['There is no gradual climb: the rescue jumps straight to 15 in a single step.', 'The rescue never touches the busy thread; it only lifts the starving one.', 'A variable-level thread can never enter the real-time band; 15 is as high as it goes.', null],
            why: 'About once a second the balance set manager looks for threads that have been ready for about 4 s, lifts them to 15 for one quantum (classically a doubled one; later versions use a short fixed amount), and lets them drop straight back to their base afterwards.' },
          { type: 'num', q: 'A client edition of Windows gives threads a quantum of 2 clock intervals, and the clock interval is 15.625 ms. The foreground process’s threads get quanta stretched to 3 times that. How many milliseconds is one foreground quantum?', answer: 93.75, tol: 0.01, unit: 'ms',
            why: '2 × 15.625 ms = 31.25 ms for a normal quantum; 3 × 31.25 ms = 93.75 ms for a stretched foreground quantum.' },
          { type: 'multi', q: 'Which statements about Windows quanta are true?',
            choices: ['Server editions use longer quanta than client editions by default', 'Quantum stretching raises the priority of the foreground process’s threads', 'A quantum is measured in clock intervals', 'A stretched foreground thread can run ahead of a higher-priority background thread', 'Among CPU-bound threads, longer quanta mean fewer context switches per second'], answer: [0, 2, 4],
            why: 'Servers default to 12 clock intervals, clients to 2. Stretching only lengthens the foreground threads’ turns; it never changes their priority, so a higher-priority thread still runs first. Among CPU-bound threads, which use their whole turn, longer turns mean fewer switches.' },
          { q: 'Thread X (priority 12) has a hard affinity that allows only CPU 2. It becomes ready while CPU 2 runs a priority-14 thread and CPU 0 is idle. What happens?',
            choices: ['X runs on CPU 0, because an idle processor always beats affinity', 'X waits in the ready list until CPU 2 can take it', 'X preempts the priority-14 thread, since CPU 2 is its only processor', 'X runs on CPU 0 for now and moves back to CPU 2 once it is free'], answer: 1,
            feedback: ['Hard affinity is a rule, not a preference: X may never run on CPU 0, idle or not.', null, 'Preemption needs a strictly higher priority, and 12 is lower than 14.', 'X may not run on CPU 0 at all. Only a soft preference, such as an ideal processor, can be set aside like that.'],
            why: 'A thread runs only on processors inside its affinity mask. The only allowed processor runs a higher-priority thread, so X waits, even though another processor sits idle. That is the price of hard affinity.' },
        ],
      },
    ],
    notes: `
      <h3>Windows scheduling</h3>
      <p>The Windows scheduler is built for <b>responsiveness</b>: the person using the machine should never feel it hesitate. It is <b>priority-driven and preemptive</b>: the dispatcher always runs the highest-priority ready thread, and a thread that becomes ready with a higher priority than a running one takes the processor at once, without waiting for the running thread’s quantum to end. The unit of scheduling is the <b>thread</b>, not the process; a process is only a container, and its threads can sit at different priorities.</p>

      <h4>32 priority levels in two bands</h4>
      <table>
        <tr><th>Levels</th><th>Band</th><th>Behaviour</th></tr>
        <tr><td>16–31</td><td>Real-time</td><td>Fixed priority, never boosted or lowered by the system; equal threads take turns. No deadline guarantee.</td></tr>
        <tr><td>1–15</td><td>Variable</td><td>The current priority moves (boosts, decay) but never above 15.</td></tr>
        <tr><td>0</td><td>Reserved</td><td>The zero-page thread, which zeroes free pages in spare time. (An idle processor runs its idle thread, outside the 32 queues.)</td></tr>
      </table>
      <p>There is one ready queue per level and a 32-bit <b>ready summary</b> with a bit set for every non-empty queue. The dispatcher rules:</p>
      <ol>
        <li>Run the first thread of the highest non-empty level (the highest set bit).</li>
        <li>Threads at the same level take turns: a thread whose quantum ends goes to the <b>back</b> of its queue.</li>
        <li>A higher-priority thread that becomes ready preempts the running thread immediately; the preempted thread goes to the <b>front</b> of its queue, since it had not used up its turn.</li>
      </ol>

      <h4>Base priority: priority class + relative thread priority</h4>
      <p>Each process has a <b>priority class</b> that sets a starting value: Idle 4, Below normal 6, Normal 8, Above normal 10, High 13, Realtime 24. Each thread has a <b>relative thread priority</b>: Lowest −2, Below normal −1, Normal 0, Above normal +1, Highest +2, plus two special cases. <b>Idle</b> drops the thread to the bottom of its band (1, or 16 in the Realtime class) and <b>Time critical</b> lifts it to the top (15, or 31 in the Realtime class). The result is the thread’s <b>base priority</b>. Example: High (13) + Above normal (+1) = 14. Only privileged programs may use the Realtime class.</p>
      <table>
        <tr><th>Class</th>${RELS.map((r) => `<th>${r[0]}</th>`).join('')}</tr>
        ${CLASSES.map((c, ci) => `<tr><td><b>${c[0]}</b> (${c[1]})</td>${RELS.map((r, ri) => `<td>${basePri(ci, ri)}</td>`).join('')}</tr>`).join('')}
      </table>
      <p>The bands are sealed: no combination lifts a non-real-time thread above 15, and no Realtime thread falls below 16.</p>

      <h4>Current priority: boosts and decay</h4>
      <p>A variable-level thread has a <b>base priority</b> (where it starts) and a <b>current priority</b> (what the scheduler uses now). When it stops waiting it receives a <b>priority boost</b>: its current priority becomes <b>base + increment</b>, never above 15. The increment is added to the base, not stacked on an earlier boost. Classic increments, chosen by the device drivers and the system:</p>
      <ul>
        <li>I/O completion: disk +1, network +2, keyboard or mouse +6, sound card +8.</li>
        <li>Wait on an event or semaphore ends: +1.</li>
        <li>A thread of the foreground process ending a wait: a small boost.</li>
        <li>A GUI thread woken by a window message: +2.</li>
      </ul>
      <p><b>Priority decay:</b> each time a boosted thread uses a full quantum, its current priority drops by one, until it is back at its base; it never goes lower. Threads at real-time levels are never boosted and never decay.</p>
      <p><b>Worked example.</b> An editor thread with base 8 waits for a key. The key press gives 8 + 6 = 14, so it preempts a CPU-bound thread at 8. After three full quanta it is at 14 → 13 → 12 → <b>11</b>; once it reaches 8 it simply takes turns with the other thread. A sound-card wake-up would give 8 + 8 = 16, which is capped at <b>15</b>.</p>

      ${(() => {
        const r = starveSim(0.3, 10, false), a = r.runs[0], b = r.runs[1];
        return `<h4>Starvation rescue: the balance set manager</h4>
      <p>Strict priority can starve a low-priority ready thread behind a busy higher one. The <b>balance set manager</b>, a system thread, wakes about once a second and looks for ready threads that have waited about <b>4 seconds</b> or more. Each one is raised to priority <b>15</b> for one quantum: classically a doubled one (Windows 2000/XP); later versions give a short fixed amount instead. When that quantum ends the thread drops <b>straight back to its base</b>, with no step-by-step decay.</p>
      <p><b>Worked example.</b> L (priority 4) becomes ready at 0.3 s behind a CPU-bound thread at 10. The scans at 1–4 s find it has waited only 0.7–3.7 s. The scan at ${a.from} s finds ${nf(a.from - 0.3)} s, so L runs at 15 for the classic doubled client quantum of ${r.qms} ms. The next rescue comes at ${b.from} s. L ends up with about ${nf(r.share * 100, 1)}% of the processor: enough to make progress (for example, to release a lock a high-priority thread needs, ending a priority inversion), not a fair share. The rescue cannot help against a thread at a real-time level: 15 still loses to 16 or more.</p>`;
      })()}

      ${(() => {
        const c = quantumInfo('client', 1, CLOCK_MS), f = quantumInfo('client', 3, CLOCK_MS), sv = quantumInfo('server', 1, CLOCK_MS);
        return `<h4>Quantum length</h4>
      <p>Windows measures a quantum in <b>clock intervals</b>, the time between two clock interrupts (about 15.6 ms, precisely ${CLOCK_MS} ms, on most modern PCs; 10 ms on some older single-processor machines). Typical defaults, both configurable:</p>
      <table>
        <tr><th>Edition</th><th>Quantum</th><th>At ${CLOCK_MS} ms</th></tr>
        <tr><td>Client</td><td>2 clock intervals</td><td>${c.bgMs} ms</td></tr>
        <tr><td>Client, foreground stretched 3×</td><td>6 clock intervals</td><td>${f.fgMs} ms</td></tr>
        <tr><td>Server</td><td>12 clock intervals, no stretching</td><td>${sv.bgMs} ms</td></tr>
      </table>
      <p><b>Quantum stretching</b> gives the threads of the <b>foreground process</b> (the one that owns the window in use) longer turns on client Windows. It changes how much processor time they get, not their priority. Example: one foreground and two background CPU-bound threads at the same level, taking turns, give the foreground thread ${f.fgMs} / (${f.fgMs} + 2 × ${f.bgMs}) = <b>${nf(f.share * 100, 0)}%</b> of the processor instead of 33.3%. Short quanta keep a desktop responsive; long quanta let a server finish a request in one turn with fewer context switches. The “Adjust for best performance of: Programs / Background services” setting switches between the two styles.</p>`;
      })()}

      <h4>Multiprocessor scheduling</h4>
      <ul>
        <li>Any processor may run any thread unless the thread’s <b>hard affinity</b> (affinity mask, the set of processors it may use) forbids it. Hard affinity is a rule.</li>
        <li>Each thread also has an <b>ideal processor</b> (soft affinity): the one Windows prefers, so the thread finds its data still in that processor’s cache. It is only a preference.</li>
        <li>Windows tries to keep the highest-priority ready threads running across all processors. A newly ready thread takes an idle processor it may use (its ideal one if possible); if none is idle it may preempt a lower-priority thread on an allowed processor. (The lab uses the lowest-priority allowed one; real Windows checks only the thread on the newcomer’s ideal processor, so this is a goal, not a guarantee.)</li>
        <li>A freed processor runs the highest-priority waiting thread allowed on it.</li>
        <li>Price of hard affinity: a thread allowed only on one busy processor waits, even while lower-priority threads run elsewhere or another processor is idle.</li>
        <li>Machines with more than 64 logical processors divide them into processor groups.</li>
      </ul>`,
  });
})();
