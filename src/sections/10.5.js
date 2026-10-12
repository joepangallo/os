/* =====================================================================
   Section 10.5 — UNIX FreeBSD Scheduling
   FreeBSD's priority classes, the ULE scheduler's per-processor run
   queues (current, next, idle), the interactivity score, cache affinity
   and topology, and pull/push load balancing across cores.
   One pure engine (score, history, curNext, balance) drives every chart,
   table and caption, so the numbers on screen come from the same code.
   ===================================================================== */
(() => {
  /* ENGINE-BEGIN ------------------------------------------------------
     Pure scheduling code (no DOM). dev/qa-10.5/engine.test.js extracts
     this exact block and checks the numbers quoted in the text.        */
  const M = 50, THRESH = 30;   // M: the scaling factor (half the maximum score of 100); THRESH: the default interactivity threshold

  /* Interactivity score from voluntary sleep time s and run time r, as the ULE source computes it
     (here without integer rounding): mostly sleeping → 0..50, mostly running → 50..100. */
  const score = (s, r) => (s > r ? M / (s / r) : r > s ? M + (M - M / (r / s)) : r > 0 ? M : 0);

  /* FreeBSD priority layouts (lower number = more urgent), read from sys/sys/priority.h of each release line.
     Band keys: ithd = bottom-half kernel (interrupt threads), kern = top-half kernel, rt = real-time user,
     ts = time-sharing user, idle = idle user. 14.x (time-sharing from 88) and 15.x (from 56) keep the 9.x order
     and only shrink the interrupt and kernel bands further, so the step shows them in a note, not as layouts. */
  const LAYOUTS = {
    classic: { label: 'Classic (5–8)', bands: [['ithd', 0, 63], ['kern', 64, 127], ['rt', 128, 159], ['ts', 160, 223], ['idle', 224, 255]] },
    v9: { label: 'FreeBSD 9–13', bands: [['ithd', 0, 47], ['rt', 48, 79], ['kern', 80, 119], ['ts', 120, 223], ['idle', 224, 255]] },
  };
  const bandOf = (lay, p) => LAYOUTS[lay].bands.find((b) => p >= b[1] && p <= b[2]);

  /* history(runA, runB): a thread that uses the fraction runA of each 100 ms for the first 5 s and runB for the
     next 5 s (the rest of the time it sleeps voluntarily). Like ULE, the two totals are scaled down whenever their
     sum passes a 5-second window (by 4/5, or by 1/2 if far over), so old behaviour fades. One point per 100 ms. */
  const WIN = 5000;
  function history(runA, runB) {
    let r = 0, s = 0;
    const pts = [];
    for (let k = 1; k <= 100; k++) {
      const run = k <= 50 ? runA : runB;
      r += 100 * run; s += 100 * (1 - run);
      const sum = r + s;
      if (sum > WIN) { if (sum > (WIN / 5) * 6) { r /= 2; s /= 2; } else { r = (r / 5) * 4; s = (s / 5) * 4; } }
      pts.push({ t: k / 10, r, s, sc: score(s, r) });
    }
    return pts;
  }
  /* crossings(pts): the moments (in seconds) when the score crosses the threshold, with the new verdict */
  const crossings = (pts) => pts.reduce((out, p, i) => { const a = i ? pts[i - 1].sc < THRESH : null, b = p.sc < THRESH; if (i && a !== b) out.push({ t: p.t, inter: b }); return out; }, []);

  /* curNext(eBatch): one processor, classic ULE queues. Batch threads B1-B3 need 30 ms each; editor E wakes on a
     keystroke every 20 ms and needs 2 ms; D is an idle-class thread. Slices are 10 ms. The dispatcher decides when
     the running thread's slice ends or it blocks: if the current queue is empty it swaps current and next, then
     runs the best (lowest-numbered) thread in current, or else the idle queue. Time-sharing threads are not
     preempted (a model simplification), but idle-class D gives way the moment a keystroke wakes E, as in FreeBSD.
     eBatch = true scores E as batch,
     so a woken E joins the next queue instead of the current one; it then gets a batch-range priority (196), still
     the best of the batch threads because it uses so little CPU. */
  const SLICE = 10;
  const CN = [
    { id: 'B1', kind: 'batch', pri: 200, work: 30 },
    { id: 'B2', kind: 'batch', pri: 204, work: 30 },
    { id: 'B3', kind: 'batch', pri: 208, work: 30 },
    { id: 'E', kind: 'inter', pri: 170, burst: 2, wakes: [3, 23, 43, 63, 83, 103] },
    { id: 'D', kind: 'idle', pri: 240, work: 1e9 },
  ];
  function curNext(eBatch, END = 120) {
    const T = CN.map((x) => ({ ...x, left: x.work || 0, pri: x.id === 'E' && eBatch ? 196 : x.pri }));
    const by = (id) => T.find((x) => x.id === id);
    const E = by('E');
    let cur = ['B1', 'B2', 'B3'], nxt = [];
    const idle = ['D'], frames = [], segs = [], waits = [], pend = [];
    let t = 0, wi = 0;
    const best = (q) => { let b = 0; q.forEach((id, i) => { if (by(id).pri < by(q[b]).pri) b = i; }); return q.splice(b, 1)[0]; };
    while (t < END) {
      const ev = [];
      while (wi < E.wakes.length && E.wakes[wi] <= t) {
        const at = E.wakes[wi++], queued = cur.includes('E') || nxt.includes('E');
        pend.push(at);
        if (!queued) (eBatch ? nxt : cur).push('E');
        ev.push({ k: 'wake', at, queued });
      }
      const before = { cur: [...cur], nxt: [...nxt] };
      let swapped = false;
      if (!cur.length && nxt.length) { [cur, nxt] = [nxt, cur]; swapped = true; }
      const from = cur.length ? 'current' : 'idle';
      const pick = cur.length ? best(cur) : idle.shift();
      const th = by(pick);
      const nextWake = wi < E.wakes.length ? E.wakes[wi] : Infinity;
      const cut = th.kind === 'idle' && nextWake < t + SLICE;
      const len = th.kind === 'inter' ? th.burst : cut ? nextWake - t : Math.min(SLICE, th.left);
      let wait = null;
      if (pick === 'E') { wait = pend.map((a) => ({ at: a, w: t - a })); waits.push(...wait.map((x) => x.w)); pend.length = 0; }
      let after;
      if (th.kind === 'batch') { th.left -= len; after = th.left > 0 ? 'next' : 'done'; } else after = th.kind === 'inter' ? 'sleep' : cut ? 'yield' : 'idle';
      frames.push({ t, end: t + len, pick, from, swapped, wait, ev, before, cur: [...cur], nxt: [...nxt], idle: [...idle], after, left: th.left });
      segs.push({ id: pick, a: t, b: t + len });
      if (after === 'next') nxt.push(pick); else if (after === 'idle' || after === 'yield') idle.push(pick);
      t += len;
    }
    return { frames, segs, waits, pri: Object.fromEntries(T.map((x) => [x.id, x.pri])), avg: waits.reduce((a, b) => a + b, 0) / waits.length, worst: Math.max(...waits) };
  }

  /* balance(sc, pull, push): four cores; cores 0+1 share one L2 cache, cores 2+3 another. Each core runs its own
     queue round robin with a 2-tick slice. Pull: a core with nothing to run steals the last waiting thread from the
     busiest core (load ≥ 2), looking at its cache sibling first. Push: every 5 ticks the balancer pairs the busiest
     core with the least busy one (each core used once per run) and moves one waiting thread if the loads differ
     by 2 or more. A migrated thread pays a cache-refill penalty: +1 tick from its sibling, +2 from the other pair.
     load = running thread + waiting threads. */
  const PAIR = [0, 0, 1, 1], PUSH_EVERY = 5, BSLICE = 2;
  const SCEN = {
    busy: { label: 'Others busy', start: [[3, 2, 3, 2, 3, 2, 3, 2], [12], [12], [12]], arrive: [] },
    empty: { label: 'Core 3 empty', start: [[3, 2, 3, 2, 3, 2, 3], [10], [10], []], arrive: [{ t: 8, core: 2, work: [2, 2, 3] }] },
  };
  function balance(key, pull, push) {
    const sc = SCEN[key];
    let id = 0, t = 0, done = 0, migr = 0, pen = 0, waste = 0;
    const mk = (w) => ({ n: 'T' + ++id, left: w, used: 0, moved: 0, born: t });
    const cores = sc.start.map((ws) => ({ run: null, q: ws.map(mk) }));
    const total = sc.start.flat().length + sc.arrive.reduce((a, x) => a + x.work.length, 0);
    const load = (c) => (cores[c].run ? 1 : 0) + cores[c].q.length;
    const frames = [], tr = [];
    const move = (from, to, k, ev) => {
      const th = cores[from].q.pop(), cost = PAIR[from] === PAIR[to] ? 1 : 2;
      th.left += cost; th.moved++; th.used = 0; migr++; pen += cost;
      ev.push({ k, n: th.n, from, to, cost });
      return th;
    };
    while (done < total && t < 80) {
      const ev = [];
      for (const a of sc.arrive) if (a.t === t) { a.work.forEach((w) => cores[a.core].q.push(mk(w))); ev.push({ k: 'arrive', core: a.core, count: a.work.length }); }
      if (push && t > 0 && t % PUSH_EVERY === 0) {
        const used = new Set();
        let moved = 0;
        for (;;) {
          const free = [0, 1, 2, 3].filter((c) => !used.has(c));
          if (free.length < 2) break;
          const hi = free.reduce((b, c) => (load(c) > load(b) ? c : b));
          const lo = free.filter((c) => c !== hi).reduce((b, c) => (load(c) < load(b) ? c : b));
          if (load(hi) - load(lo) < 2 || !cores[hi].q.length) break;
          cores[lo].q.push(move(hi, lo, 'push', ev)); used.add(hi); used.add(lo); moved++;
        }
        if (!moved) ev.push({ k: 'pushnone' });
      }
      for (let c = 0; c < 4; c++) {
        const C = cores[c];
        if (!C.run && C.q.length) C.run = C.q.shift();
        if (!C.run && pull) {
          const ok = (x) => x !== c && load(x) >= 2 && cores[x].q.length > 0;
          const pick = (list) => list.filter(ok).sort((a, b) => load(b) - load(a) || a - b)[0];
          const v = pick([0, 1, 2, 3].filter((x) => PAIR[x] === PAIR[c])) ?? pick([0, 1, 2, 3].filter((x) => PAIR[x] !== PAIR[c]));
          if (v != null) C.run = move(v, c, 'pull', ev);
        }
      }
      const waiting = cores.some((C) => C.q.length);
      const idleNow = waiting ? cores.filter((C) => !C.run).length : 0;
      waste += idleNow;
      const snap = cores.map((C) => ({ run: C.run ? { n: C.run.n, left: C.run.left, moved: C.run.moved } : null, q: C.q.map((x) => ({ n: x.n, left: x.left, moved: x.moved })) }));
      const fins = [];
      for (const C of cores) {
        if (!C.run) continue;
        C.run.left--; C.run.used++;
        if (C.run.left === 0) { done++; tr.push(t + 1 - C.run.born); fins.push(C.run.n); C.run = null; }
        else if (C.run.used >= BSLICE && C.q.length) { C.run.used = 0; C.q.push(C.run); C.run = null; }
      }
      frames.push({ t, snap, ev, fins, idleNow, loads: snap.map((x) => (x.run ? 1 : 0) + x.q.length), done, migr, pen, waste });
      t++;
    }
    return { T: t, total, frames, migr, pen, waste, meanTr: tr.reduce((a, b) => a + b, 0) / tr.length };
  }
  /* ENGINE-END -------------------------------------------------------- */

  /* numbers quoted in the notes, from the same engine as the steps */
  const n1 = (x) => x.toFixed(1);
  const CN_I = curNext(false), CN_B = curNext(true);
  const H_EC = crossings(history(0.05, 1))[0].t, H_CE = crossings(history(1, 0.05))[0].t;
  const BAL = Object.fromEntries([['none', false, false], ['pull', true, false], ['push', false, true], ['both', true, true]].map(([k, a, b]) => [k, balance('busy', a, b)]));

  Guide.section({
    id: '10.5',
    title: 'UNIX FreeBSD Scheduling',
    short: 'FreeBSD scheduling',
    summary: 'FreeBSD’s ULE scheduler: priority classes, per-core run queues, interactivity scores and load balancing.',
    objectives: [
      'Name FreeBSD’s five priority classes in order and explain why a lower priority number means a more urgent thread.',
      'Compute a thread’s interactivity score from its sleep and run times and decide whether ULE treats it as interactive.',
      'Trace how the current, next and idle run queues give interactive threads quick service without starving batch threads.',
      'Explain processor affinity, topology awareness, and pull versus push migration on a multicore machine.',
    ],
    terms: [
      ['ULE scheduler', 'FreeBSD’s default thread scheduler since version 7.1 (2009). It keeps separate run queues for each processor, balances load between them, and spots interactive threads with an interactivity score.'],
      ['4BSD scheduler', 'The older FreeBSD scheduler inherited from Berkeley UNIX: one global run queue shared by every processor, with priorities computed from decaying CPU usage. ULE replaced it as the default, but it can still be chosen when the kernel is built.'],
      ['Bottom-half kernel (interrupt threads)', 'Kernel work started by hardware, not by a thread’s request: the handling of device interrupts. FreeBSD runs it in interrupt threads that hold the best priority numbers of all.'],
      ['Top-half kernel', 'Kernel code that runs on behalf of a thread that entered the kernel itself, through a system call or a trap such as a page fault. Its priority band holds kernel threads and, in classic FreeBSD, any thread asleep inside the kernel.'],
      ['Real-time user thread', 'A user thread given a fixed priority (with the rtprio command or the POSIX SCHED_FIFO and SCHED_RR policies). The scheduler never changes that priority.'],
      ['Time-sharing thread', 'An ordinary user thread. The scheduler keeps recalculating its priority from its interactivity score, its recent CPU use and its nice value.'],
      ['Idle-class thread', 'A user thread that may run only when no other thread wants the processor. In FreeBSD it is started with the idprio command.'],
      ['Run queue', 'The scheduler’s list of threads that are ready to run, kept in priority order. Under ULE every processor has its own run queues.'],
      ['Current queue', 'In the classic ULE design, the time-sharing run queue a processor is serving right now. Interactive (and real-time and kernel) threads are always placed here.'],
      ['Next queue', 'In the classic ULE design, the run queue where batch threads wait for the next round. When the current queue becomes empty, the two queues swap roles.'],
      ['Interactivity score', 'A number from 0 to 100 that ULE computes from a thread’s recent voluntary sleep time and run time. Low means mostly sleeping (interactive); high means mostly computing (batch).'],
      ['Interactivity threshold', 'The score below which ULE treats a thread as interactive: 30 by default, and adjustable by the administrator.'],
      ['Voluntary sleep time', 'Time a thread spends blocked because it chose to wait for something, such as a keystroke or a disk read. Time spent waiting in a run queue does not count.'],
      ['Batch thread', 'A time-sharing thread whose interactivity score is at or above the threshold. It mostly computes, so a short extra wait goes unnoticed.'],
      ['Processor affinity', 'The preference for running a thread on the processor that ran it last, or on one that shares a cache with it, because that cache may still hold the thread’s data.'],
      ['Thread migration', 'Moving a ready thread from one processor’s run queue to another’s. It evens out the load, but the thread must refill the new processor’s caches.'],
      ['Pull migration (work stealing)', 'Load balancing started by a processor that is about to go idle: it takes a waiting thread from a busier processor.'],
      ['Push migration', 'Load balancing started by a periodic balancer, which moves waiting threads from the most loaded processor to the least loaded one.'],
      ['Topology-aware scheduling', 'Scheduling that knows which cores share caches (and which are hardware-thread siblings on one core) and prefers to keep or move threads among close neighbours.'],
    ],
    css: `
      .sec-10-5 svg { display: block; }
      .sec-10-5 .btn.wn { border-color: var(--warn); color: var(--warn); }
      .sec-10-5 .btn.wn.on { background: var(--warn-bg); }
    `,
    steps: [
      /* ---------------- 1. Big picture ---------------- */
      {
        title: 'Many cores, heavy jobs, and a person typing',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">FreeBSD is a free, open-source descendant of Berkeley UNIX. Its scheduler has two jobs that pull in different directions.</p>
              <p class="m0"><b>Scale:</b> keep every core busy without fighting over one shared queue or throwing away warm caches. <b>Respond:</b> answer a person at the keyboard at once, even while big compiles grind in the background.</p>
              <p class="m0">The <span class="t">ULE scheduler</span> does both. It first shipped as an option in FreeBSD 5.1 (2003) and became the default in 7.1 (2009). It replaced the <span class="t">4BSD scheduler</span>, which kept one run queue for all processors and computed priorities much like the traditional UNIX scheduler of section 9.3.</p>
              <div class="callout analogy m0" data-label="Analogy">An airport check-in hall. Every desk has its own line. A traveller with one quick question is waved to the front. A floor manager moves people from long lines to short ones. And you would rather return to the desk that already has your papers out.</div>
            </div>
            <div class="card stack" style="gap:10px">
              <h4 class="m0">ULE in four ideas</h4>
              <p class="small muted m0">Click an idea to preview it. Each one gets its own step.</p>
              <div class="idea-grid"></div>
              <div class="card white idea-detail" style="display:flex;flex-direction:column;gap:8px;min-height:150px"></div>
              <div class="grid-4 tl" style="gap:8px">
                <div class="card tight white"><b>Before 2003</b><p class="xs muted m0">4BSD scheduler: one run queue shared by all processors.</p></div>
                <div class="card tight white"><b>2003</b><p class="xs muted m0">ULE ships as an option in FreeBSD 5.1.</p></div>
                <div class="card tight white"><b>2009</b><p class="xs muted m0">ULE becomes the default in FreeBSD 7.1.</p></div>
                <div class="card tight white"><b>2012 on</b><p class="xs muted m0">FreeBSD 9 and later reshuffle the priority bands.</p></div>
              </div>
              <div class="row gap-s small"><span class="chip os">read the 0–255 ruler</span><span class="chip proc">score a thread</span><span class="chip cpu">run the current/next queues</span><span class="chip io">balance four cores</span></div>
              <p class="xs muted m0">Why “ULE”? It is simply the last three letters of “schedULE”.</p>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const ideas = [
            ['Priority classes', 'os', 'Every thread has a priority number from 0 to 255, and a <b>lower number is more urgent</b>. The range is cut into five classes: interrupt work, kernel work, real-time, time-sharing and idle.', 'Step 2', 'The analogy: staff and emergencies are served before any traveller.'],
            ['Per-core run queues', 'cpu', 'Each processor keeps its own <span class="t">run queue</span>s, so cores rarely wait for each other, and a thread tends to return to the core whose cache already holds its data.', 'Step 3', 'The analogy: one line per desk, and you go back to the desk that has your papers.'],
            ['Interactivity score', 'proc', 'ULE watches how much each thread <b>sleeps</b> versus <b>runs</b>. Mostly-sleeping threads (editors, shells) score low and are treated as interactive; heavy computers score high and are treated as batch.', 'Steps 4 and 5', 'The analogy: the quick-question traveller is waved forward.'],
            ['Load balancing', 'io', 'An idle core <b>pulls</b> work from a busy one, and a periodic balancer <b>pushes</b> work from the busiest core to the least busy one, preferring cores that share a cache.', 'Step 6', 'The analogy: the floor manager evening out the lines.'],
          ];
          const grid = ctx.$('.idea-grid'), detail = ctx.$('.idea-detail');
          grid.style.cssText = `display:grid;grid-template-columns:${ctx.narrow ? '1fr' : '1fr 1fr'};gap:8px`;
          const btns = ideas.map((x, i) => h('button', { class: 'btn ' + x[1], type: 'button', onclick: () => show(i) }, x[0]));
          grid.append(...btns);
          function show(i) {
            const [name, cls, desc, where, ana] = ideas[i];
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            detail.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '19px' } }, name), h('span', { class: 'chip ' + cls }, where)),
              h('p', { class: 'm0', style: { fontSize: '16px' }, html: desc }),
              h('p', { class: 'small muted m0', style: { marginTop: 'auto' } }, ana));
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
          }
          show(0);
        },
      },
      /* ---------------- 2. Priority classes ---------------- */
      {
        title: 'Five priority classes on one ruler from 0 to 255',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const CLASS = {
            ithd: { name: 'Bottom-half kernel: interrupt threads', short: 'Interrupt', abbr: 'Int', sv: 's-intr', btn: 'intr', term: 'Bottom-half kernel',
              who: 'Kernel threads that finish the work of hardware interrupts: a network card that has received packets, a disk controller that has finished a transfer, the clock.',
              how: 'Fixed by the kernel for each kind of device.',
              why: 'Hardware cannot wait. A network card whose buffer overflows simply drops packets.' },
            kern: { name: 'Top-half kernel', short: 'Kernel', abbr: 'K', sv: 's-os', btn: 'os', term: 'Top-half kernel',
              who: 'Kernel threads doing top-half work (such as the page daemon) and, in the classic design, any thread asleep in the kernel waiting for, say, a disk block.',
              how: 'Set by the kernel: fixed for each kernel thread, or chosen from the reason for sleeping (disk, network, lock, ...).',
              why: 'A thread asleep in the kernel may hold kernel resources, so when it wakes it should finish quickly and let them go.' },
            rt: { name: 'Real-time user threads', short: 'Real-time', abbr: 'RT', sv: 's-warn', btn: 'wn', term: 'Real-time user thread',
              who: 'Threads an administrator marked as real-time, such as audio or machine-control software (rtprio, or the POSIX SCHED_FIFO and SCHED_RR policies).',
              how: 'Fixed: 32 levels that the scheduler never adjusts.',
              why: 'Predictable timing: nothing below this class can delay them.' },
            ts: { name: 'Time-sharing user threads', short: 'Time-sharing', abbr: 'TS', sv: 's-proc', btn: 'proc', term: 'Time-sharing thread',
              who: 'Almost every ordinary thread: shells, editors, browsers, compilers, servers.',
              how: 'Recomputed all the time. Interactive threads get the better (lower) part of the band from their interactivity score; batch threads are placed by recent CPU use plus the nice value.',
              why: 'Fair sharing with quick response for people (steps 4 and 5).' },
            idle: { name: 'Idle user threads', short: 'Idle', abbr: 'Idle', sv: 's-panel', btn: '', term: 'Idle-class thread',
              who: 'Background work that should use only spare time, started with idprio, such as a long indexing or number-crunching job.',
              how: 'Fixed: 32 levels.',
              why: 'Runs only when no other thread wants the processor.' },
          };
          const VNOTE = {
            classic: 'The <b>classic</b> layout, used from FreeBSD 5 to 8 and the one usually taught.',
            v9: 'FreeBSD 9 put <b>real-time above top-half kernel</b>; 14 and 15 keep this order, with slimmer kernel bands.',
          };
          const verNote = h('p', { class: 'xs muted m0', style: { minHeight: '17px' } });
          const W = ctx.narrow ? 360 : 640, H = 100, X0 = 10, X1 = W - 10;
          const X = (p) => X0 + (p / 256) * (X1 - X0);
          let lay = 'classic', sel = 'ts', pri = 190;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'FreeBSD priority ruler from 0 to 255' });
          const legend = h('div', { class: 'row gap-s' });
          const readout = h('p', { class: 'small m0', style: { minHeight: '42px' } });
          const detail = h('div', { class: 'card white stack grow', style: { gap: '6px' } });
          const slider = ctx.ui.slider({ label: 'A thread with priority', min: 0, max: 255, value: pri, onInput: (v) => { pri = v; sel = bandOf(lay, pri)[0]; draw(); } });
          function pick(k) { sel = k; const b = LAYOUTS[lay].bands.find((x) => x[0] === k); pri = Math.round((b[1] + b[2]) / 2); slider.set(pri); draw(); }
          function draw() {
            const L = LAYOUTS[lay];
            const kids = [
              s('text', { x: X0, y: 16, 'font-size': 13, class: 's-sub' }, '← lower number: more urgent'),
              s('text', { x: X1, y: 16, 'font-size': 13, class: 's-sub', 'text-anchor': 'end' }, 'less urgent →'),
            ];
            L.bands.forEach(([k, a, b]) => {
              const c = CLASS[k], x = X(a), w = X(b + 1) - X(a);
              const lab = w > c.short.length * 8.2 + 8 ? c.short : w > c.abbr.length * 9 + 6 ? c.abbr : '';
              kids.push(s('g', { role: 'button', tabindex: 0, 'aria-label': `${c.short}: ${a} to ${b}`, style: { cursor: 'pointer' }, onclick: () => pick(k), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); } } },
                s('rect', { x, y: 26, width: w, height: 46, rx: 3, class: c.sv, 'stroke-width': k === sel ? 4 : 1.5 }),
                lab ? s('text', { x: x + w / 2, y: 54, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': k === sel ? 800 : 600, style: { pointerEvents: 'none' } }, lab) : null));
              kids.push(s('line', { x1: x, y1: 72, x2: x, y2: 80, class: 's-line', 'stroke-width': 1.5 }), s('text', { x, y: 95, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(a)));
            });
            kids.push(s('line', { x1: X1, y1: 72, x2: X1, y2: 80, class: 's-line', 'stroke-width': 1.5 }), s('text', { x: X1, y: 95, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, '255'));
            const mx = X(pri + 0.5);
            kids.push(s('path', { d: `M${mx} 26 l-7 -9 h14 z`, class: 's-accent', 'stroke-width': 2 }), s('line', { x1: mx, y1: 26, x2: mx, y2: 36, stroke: 'var(--accent)', 'stroke-width': 3 }), s('line', { x1: mx, y1: 62, x2: mx, y2: 72, stroke: 'var(--accent)', 'stroke-width': 3 }));
            svg.replaceChildren(...kids);
            verNote.innerHTML = VNOTE[lay];
            legend.replaceChildren(...L.bands.map(([k, a, b]) => h('button', { class: 'btn sm ' + CLASS[k].btn + (k === sel ? ' on' : ''), type: 'button', onclick: () => pick(k) }, `${CLASS[k].short} ${a}–${b}`)));
            const band = bandOf(lay, pri), c = CLASS[band[0]], bi = L.bands.indexOf(band);
            const rank = bi === 0 ? 'No class outranks it; every other class waits for it.'
              : bi === L.bands.length - 1 ? 'Every other class outranks it, so it runs only when nothing else wants the processor.'
              : 'The classes to its left outrank it; the classes to its right wait for it.';
            readout.innerHTML = `Priority <b>${pri}</b> is in the <b>${c.short.toLowerCase()}</b> class (${band[1]}–${band[2]}) here. ${rank}`;
            const sb = L.bands.find((x) => x[0] === sel), sc = CLASS[sel];
            detail.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '17px' }, html: `<span class="t" data-t="${sc.term}">${sc.name}</span>` }), h('span', { class: 'chip accent' }, `${sb[1]}–${sb[2]} · ${sb[2] - sb[1] + 1} levels`)),
              h('p', { class: 'm0 small', html: `<b>Who:</b> ${sc.who}` }),
              h('p', { class: 'm0 small', html: `<b>Priority set:</b> ${sc.how}` }),
              h('p', { class: 'm0 small', html: `<b>Why here:</b> ${sc.why}` }));
          }
          const laySeg = ctx.ui.seg(Object.keys(LAYOUTS).map((k) => ({ value: k, label: LAYOUTS[k].label })), lay, (v) => { lay = v; sel = bandOf(lay, pri)[0]; draw(); });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'Every FreeBSD thread has a priority number from 0 to 255. <b>Lower numbers are more urgent</b>: each processor runs its most urgent ready thread first (step 5 adds one twist for time-sharing threads).' }),
              h('p', { class: 'm0', html: 'That is the same direction as the <span class="t">priority number</span> of traditional UNIX (section 9.3). The range is cut into five classes, from hardware work at the top down to idle work at the bottom. Click a class or drag the slider.' }),
              h('div', { class: 'callout why m0 small', 'data-label': 'A thread can change band', html: 'In the classic design, an editor thread that calls <code>read()</code> and sleeps in the kernel waiting for the disk takes a <span class="t">top-half kernel</span> priority, so it runs soon after the data arrives; back in user mode it drops to its time-sharing priority. (Since FreeBSD 8, ULE by default lifts such a sleeper only within the time-sharing band.)' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Reading “priority 200” as more important than “priority 20”. In FreeBSD it is the reverse. UNIX SVR4 (section 10.4) and Windows (section 10.6) count the other way, so always check the direction.' })),
            h('div', { class: 'card stack', style: { gap: '8px' } },
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'FreeBSD version'), laySeg), verNote,
              svg, legend, slider, readout, detail)));
          draw();
        },
      },
      /* ---------------- 3. Per-core run queues, affinity, topology ---------------- */
      {
        title: 'A run queue per core, and threads that go home',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          let warm = 'warm', busy0 = true, busy1 = false, choice = null, shown = false;
          const cores = () => [{ run: busy0 ? 'A' : null, wait: busy0 ? 2 : 0 }, { run: busy1 ? 'B' : null, wait: busy1 ? 1 : 0 }, { run: 'C', wait: 0 }, { run: null, wait: 0 }];
          const load = (c) => (c.run ? 1 : 0) + c.wait;
          /* a simplified version of ULE's placement rule for a waking thread that last ran on core 0 */
          function ule() {
            const C = cores();
            if (warm === 'warm' && !load(C[0])) return { k: 0, why: 'Core 0 ran T a moment ago and is idle, so T goes home: its data is still in core 0’s L1 and L2 caches.' };
            if (warm === 'warm' && !load(C[1])) return { k: 1, why: 'Core 0 is busy, but its L2 partner, core 1, is idle. ULE searches the closest cache group first: T runs at once and still finds its data in the shared L2.' };
            let b = 0;
            C.forEach((c, i) => { if (load(c) < load(C[b])) b = i; });
            const ties = C.map((c, i) => i).filter((i) => i !== b && load(C[i]) === load(C[b]));
            const tie = b !== 0 && ties.length ? ` (core ${ties.join(' or ')} would do just as well)` : '';
            if (warm === 'warm') return { k: b, why: `Both cores that share T’s L2 are busy, so ULE widens the search to the whole chip and takes the least loaded core, core ${b}${tie}. Only the L3 may still hold T’s data, but T runs at once instead of waiting.` };
            return { k: b, why: `T last ran long ago, so other threads have pushed its data out of every cache. Affinity no longer matters, and ULE simply takes the least loaded core${b === 0 ? ' (on a tie it still prefers core 0, where T last ran)' : ''}: core ${b}${tie}.` };
          }
          const cacheText = (k) => (warm === 'cold' ? 'cold: T ran long ago, so its data is gone from every cache'
            : k === 0 ? 'hot: L1 and L2 still hold T’s data' : k === 1 ? 'warm: the shared L2 still holds T’s data; only L1 must refill' : 'cool: only the shared L3 may still hold T’s data');
          const waitText = (c) => (load(c) ? `T waits behind ${load(c)} thread${load(c) > 1 ? 's' : ''} (of similar priority)` : 'T runs at once (the core is idle)');
          const N = ctx.narrow;
          const W = N ? 360 : 600, H = N ? 400 : 250;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'A four-core chip: cores 0 and 1 share one L2 cache, cores 2 and 3 another, and all four share the L3 cache' });
          const verdict = h('div', { class: 'card white stack', style: { gap: '6px', minHeight: N ? '0' : '128px' } });
          function coreBox(k, x, y, w, hh) {
            const c = cores()[k], picked = choice === k, u = shown && ule().k === k;
            const kids = [
              s('rect', { x, y, width: w, height: hh, rx: 10, class: picked ? 's-accent' : 's-cpu', 'stroke-width': picked || u ? 3.5 : 2 }),
              s('text', { x: x + 10, y: y + 22, 'font-size': 15, 'font-weight': 800 }, 'Core ' + k),
            ];
            if (k === 0) kids.push(s('text', { x: x + 10, y: y + 40, 'font-size': 13, 'font-weight': 700, style: { fill: 'var(--accent)' } }, 'T ran here'));
            if (u) kids.push(s('text', { x: x + w - 8, y: y + hh - 10, 'font-size': 13, 'text-anchor': 'end', 'font-weight': 800, style: { fill: 'var(--ok)' } }, 'ULE ✓'));
            const tok = (tx, ty, lab, cls) => [s('rect', { x: tx, y: ty, width: 30, height: 28, rx: 6, class: cls, 'stroke-width': 2 }), s('text', { x: tx + 15, y: ty + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, lab)];
            const ry = N ? 46 : 50, qy = N ? 80 : 86;
            if (c.run) kids.push(...tok(x + 10, y + ry, c.run, 's-proc'), s('text', { x: x + 46, y: y + ry + 19, 'font-size': 13, class: 's-sub' }, 'running'));
            else kids.push(s('text', { x: x + 10, y: y + ry + 19, 'font-size': 13, class: 's-sub' }, 'idle'));
            for (let i = 0; i < c.wait; i++) kids.push(...tok(x + 10 + i * 36, y + qy, '·', 's-panel'));
            if (picked) kids.push(...tok(x + 10 + c.wait * 36, y + qy, 'T', 's-accent'));
            return s('g', { role: 'button', tabindex: 0, 'aria-label': `Run T on core ${k}`, style: { cursor: 'pointer' }, onclick: () => choose(k), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(k); } } }, ...kids);
          }
          function draw() {
            const kids = [s('rect', { x: 4, y: 4, width: W - 8, height: H - 8, rx: 14, class: 's-mem', 'stroke-width': 2 }),
              s('text', { x: 16, y: 25, 'font-size': 14, 'font-weight': 800 }, 'Shared L3 cache (whole chip)')];
            const pairs = N ? [[14, 36], [14, 218]] : [[14, 36], [306, 36]];
            const pw = N ? W - 28 : 280, ph = N ? 172 : 200, cw = (pw - 30) / 2, ch = N ? 126 : 150;
            pairs.forEach(([px, py], p) => {
              kids.push(s('rect', { x: px, y: py, width: pw, height: ph, rx: 12, class: 's-panel', 'stroke-width': 1.5 }),
                s('text', { x: px + 10, y: py + 20, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, `L2 cache shared by cores ${2 * p} and ${2 * p + 1}`));
              for (let j = 0; j < 2; j++) kids.push(coreBox(2 * p + j, px + 10 + j * (cw + 10), py + 32, cw, ch));
            });
            svg.replaceChildren(...kids);
            const C = cores();
            const parts = [];
            if (choice != null) parts.push(h('p', { class: 'm0 small', html: `<b>You chose core ${choice}.</b> Cache ${cacheText(choice)}. ${waitText(C[choice])}.` }));
            if (shown) {
              const u = ule(), same = choice === u.k;
              parts.push(h('p', { class: 'm0 small', html: `<span class="chip ${choice == null ? 'accent' : same ? 'ok' : 'warn'}">${choice == null ? 'ULE’s choice' : same ? 'Same as ULE' : 'ULE would pick core ' + u.k}</span> ${u.why}` }));
            } else parts.push(h('p', { class: 'm0 small muted' }, 'Thread T just woke up (its disk read finished). It last ran on core 0. Click the core where it should run, or ask what ULE would do.'));
            verdict.replaceChildren(...parts);
          }
          function choose(k) { choice = k; shown = true; draw(); }
          const reset = () => { choice = null; shown = false; draw(); };
          const tog = (label, get, set) => { const b = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': String(get()), onclick: () => { set(!get()); b.setAttribute('aria-pressed', String(get())); b.textContent = label + (get() ? ': busy' : ': idle'); reset(); } }, label + (get() ? ': busy' : ': idle')); return b; };
          const controls = h('div', { class: 'row gap-s' },
            h('span', { class: 'small b' }, 'T last ran'), ctx.ui.seg([{ value: 'warm', label: 'a moment ago' }, { value: 'cold', label: 'long ago' }], warm, (v) => { warm = v; reset(); }),
            tog('Core 0', () => busy0, (v) => { busy0 = v; }), tog('Core 1', () => busy1, (v) => { busy1 = v; }),
            h('button', { class: 'btn sm primary', type: 'button', onclick: () => { shown = true; draw(); } }, 'What would ULE do?'));
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'lead m0', html: 'The old <span class="t">4BSD scheduler</span> kept one <span class="t">run queue</span> for the whole machine. With many cores that hurts twice.' }),
              h('ul', { class: 'm0', style: { paddingLeft: '20px', fontSize: '16px', lineHeight: 1.42 } },
                h('li', { html: '<b>Lock traffic.</b> Every core must lock the single queue to pick a thread, so cores wait for the lock (the load-sharing bottleneck of section 10.1).' }),
                h('li', { html: '<b>Cold caches.</b> Any core may pick any thread, so a thread often lands on a core whose caches hold none of its data.' })),
              h('p', { class: 'm0', html: 'ULE gives <b>each processor its own run queues</b> and normally queues a waking thread on the processor that ran it last: <span class="t">processor affinity</span>. It is also <span class="t" data-t="Topology-aware scheduling">topology-aware</span>: it knows which cores share which caches, so when a thread must move, a close neighbour is tried first.' }),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Each <span class="t">cache miss</span> is a slow trip to main memory. Restarting where the data is still cached avoids thousands of them.' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'The catch', html: 'Separate queues can drift out of balance: one core swamped, another idle. Step 6 shows how ULE moves threads between cores to fix that.' })),
            h('div', { class: 'card stack', style: { gap: '8px' } }, controls, svg, verdict)));
          draw();
        },
      },
      /* ---------------- 4. Interactivity score ---------------- */
      {
        title: 'The interactivity score: does this thread mostly sleep?',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const f1 = (x) => ctx.util.fmt(x, 1);
          const N = ctx.narrow;
          const W = N ? 340 : 600, H = N ? 190 : 240, L = 44, R = W - 12, T = 14, B = H - 34;
          const XP = (p) => L + p * (R - L), Y = (v) => B - (v / 100) * (B - T);
          const axes = (xlab, xt, labLeft) => {
            const k = [s('rect', { x: L, y: Y(THRESH), width: R - L, height: Y(0) - Y(THRESH), style: { fill: 'var(--ok-bg)' } })];
            [0, 30, 50, 100].forEach((v) => k.push(s('line', { x1: L, y1: Y(v), x2: R, y2: Y(v), class: 's-muted', 'stroke-width': v === THRESH ? 0 : 1 }), s('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(v))));
            k.push(s('line', { x1: L, y1: Y(THRESH), x2: R, y2: Y(THRESH), stroke: 'var(--ok)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),
              s('text', { x: labLeft ? L + 6 : R - 4, y: Y(THRESH) + 16, 'text-anchor': labLeft ? 'start' : 'end', 'font-size': 13, 'font-weight': 700, style: { fill: 'var(--ok)' } }, 'interactive (below 30)'));
            xt.forEach(([p, lab]) => k.push(s('text', { x: XP(p), y: B + 17, 'text-anchor': p === 0 ? 'start' : p === 1 ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, lab)));
            k.push(s('text', { x: (L + R) / 2, y: H - 2, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, xlab));
            return k;
          };
          /* ---- tab 1: calculator ---- */
          let sv = 90, rv = 10;
          const big = h('div', { class: 'big', style: { lineHeight: 1 } });
          const verdict = h('div');
          const work = h('p', { class: 'm0 small mono', style: { minHeight: '40px' } });
          const csvg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Interactivity score against the share of time spent sleeping' });
          const curve = [];
          for (let i = 0; i <= 100; i++) curve.push(`${i ? 'L' : 'M'}${XP(i / 100).toFixed(1)} ${Y(score(i, 100 - i)).toFixed(1)}`);
          function drawCalc() {
            const sc = score(sv, rv), share = sv + rv ? sv / (sv + rv) : 0, inter = sc < THRESH;
            big.textContent = f1(sc);
            verdict.innerHTML = `<span class="chip ${inter ? 'ok' : 'cpu'}">${inter ? 'interactive → current queue' : 'batch → next queue'}</span>`;
            work.innerHTML = sv > rv ? `s &gt; r: 50 / (${sv} / ${rv}) = <b>${f1(sc)}</b>`
              : rv > sv ? (sv ? `r &gt; s: 50 + (50 − 50 / (${rv} / ${sv})) = <b>${f1(sc)}</b>` : `r &gt; s = 0: 50 + (50 − 0) = <b>100</b>`)
              : sv ? `s = r: score = m = <b>50</b>` : 'No history yet (s = r = 0): score 0';
            csvg.replaceChildren(...axes(N ? 'share of time asleep, s / (s + r)' : 'share of the window spent sleeping, s / (s + r)', N ? [[0, '0%'], [0.625, '62.5%'], [1, '100%']] : [[0, '0%'], [0.5, '50%'], [0.625, '62.5%'], [1, '100%']], true),
              s('path', { d: curve.join(' '), fill: 'none', stroke: 'var(--proc)', 'stroke-width': 3 }),
              s('circle', { cx: XP(share), cy: Y(sc), r: 7, class: inter ? 's-ok' : 's-cpu', 'stroke-width': 3 }));
          }
          const sS = ctx.ui.slider({ label: 'Sleep s', min: 0, max: 100, step: 0.5, value: sv, onInput: (v) => { sv = v; drawCalc(); } });
          const sR = ctx.ui.slider({ label: 'Run r', min: 0, max: 100, step: 0.5, value: rv, onInput: (v) => { rv = v; drawCalc(); } });
          const preset = (lab, a, b) => h('button', { class: 'btn sm', type: 'button', onclick: () => { sv = a; rv = b; sS.set(a); sR.set(b); drawCalc(); } }, lab);
          const calcTab = (p) => {
            p.append(h('div', { class: 'stack', style: { gap: '6px' } },
              h('div', { class: 'grid-2', style: { gap: '4px 16px' } }, sS, sR),
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Try'), preset('s 90, r 10', 90, 10), preset('s = r', 50, 50), preset('s 10, r 90', 10, 90), preset('the threshold', 62.5, 37.5)),
              h('div', { class: 'row', style: { alignItems: 'center', gap: '14px' } }, h('div', { class: 'stack', style: { gap: '2px', minWidth: '110px' } }, h('span', { class: 'xs muted b' }, 'SCORE'), big), h('div', { class: 'stack grow', style: { gap: '4px' } }, verdict, work)),
              csvg));
            drawCalc();
          };
          /* ---- tab 2: history over ten seconds ---- */
          let ra = 5, rb = 100;
          const hsvg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Interactivity score over ten seconds' });
          const hcap = h('p', { class: 'm0 small', style: { minHeight: '62px' } });
          function drawHist() {
            const pts = history(ra / 100, rb / 100), cr = crossings(pts);
            const XT = (t) => L + (t / 10) * (R - L);
            const d = pts.map((p, i) => `${i ? 'L' : 'M'}${XT(p.t).toFixed(1)} ${Y(p.sc).toFixed(1)}`).join(' ');
            const kids = axes('time (seconds)', [[0, '0 s'], [0.5, '5 s'], [1, '10 s']]);
            kids.push(s('line', { x1: XT(5), y1: T, x2: XT(5), y2: B, stroke: 'var(--ink-2)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' }),
              s('text', { x: XT(5) + 6, y: T + 12, 'font-size': 13, class: 's-sub' }, 'behaviour changes'),
              s('path', { d, fill: 'none', stroke: 'var(--proc)', 'stroke-width': 3 }));
            cr.forEach((c) => kids.push(s('circle', { cx: XT(c.t), cy: Y(THRESH), r: 6, class: c.inter ? 's-ok' : 's-cpu', 'stroke-width': 3 })));
            hsvg.replaceChildren(...kids);
            const at5 = pts[49].sc, at10 = pts[99].sc;
            const crText = cr.length ? cr.map((c) => `crosses the threshold at <b>${f1(c.t)} s</b> and becomes <b>${c.inter ? 'interactive' : 'batch'}</b>`).join('; then it ') : `never crosses the threshold: it stays <b>${at10 < THRESH ? 'interactive' : 'batch'}</b>`;
            hcap.innerHTML = `Score <b>${f1(at5)}</b> at 5 s and <b>${f1(at10)}</b> at 10 s. The thread ${crText}. History fades gradually, so a change of behaviour shows up within a few seconds, not at once.`;
          }
          const hA = ctx.ui.slider({ label: 'CPU use, 0–5 s', min: 0, max: 100, value: ra, format: (v) => v + '%', onInput: (v) => { ra = v; drawHist(); } });
          const hB = ctx.ui.slider({ label: 'CPU use, 5–10 s', min: 0, max: 100, value: rb, format: (v) => v + '%', onInput: (v) => { rb = v; drawHist(); } });
          const hp = (lab, a, b) => h('button', { class: 'btn sm', type: 'button', onclick: () => { ra = a; rb = b; hA.set(a); hB.set(b); drawHist(); } }, lab);
          const histTab = (p) => {
            p.append(h('div', { class: 'stack', style: { gap: '6px' } },
              h('div', { class: 'grid-2', style: { gap: '4px 16px' } }, hA, hB),
              h('div', { class: 'row gap-s' }, hp('Editor → compiler', 5, 100), hp('Compiler → editor', 100, 5), hp('Hog that naps 40%', 60, 60)),
              hsvg, hcap));
            drawHist();
          };
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: N ? '1fr' : 'minmax(0, 470px) minmax(0, 1fr)' } },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', style: { fontSize: '17.5px' }, html: 'ULE never asks a program whether it is interactive; it watches. Over a recent window it adds up the thread’s <span class="t">voluntary sleep time</span> <b>s</b> and its run time <b>r</b>, and turns them into an <span class="t">interactivity score</span> from 0 to 100 (m = 50):' }),
              h('div', { class: 'card white stack', style: { gap: '4px', fontSize: '16px' } },
                h('div', { html: 'Mostly sleeps (s &gt; r): &nbsp;<b>score = m / (s / r)</b> &nbsp;<span class="muted small">0 to 50</span>' }),
                h('div', { html: 'Mostly runs (r &gt; s): &nbsp;<b>score = m + (m − m / (r / s))</b> &nbsp;<span class="muted small">50 to 100</span>' }),
                h('div', { html: 'Equal (s = r): &nbsp;<b>score = m = 50</b>' }),
                h('div', { class: 'small', html: 'Below the <span class="t">interactivity threshold</span> of <b>30</b>: interactive. Otherwise: a <span class="t">batch thread</span>.' })),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Where 30 sits', html: 'Score 30 means 50 / (s/r) = 30, so s/r = 5/3: the thread sleeps <b>62.5%</b> of the time. Sleep more than that and it counts as interactive.' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Seen another form?', html: 'A simplified form sometimes quoted for the r &gt; s line is m / (r / s) + m. It also stays between 50 and 100, so the verdict (batch) is the same, but it runs backwards: a pure CPU hog (s = 0) would get only 50. ULE’s code subtracts, 100 − 50·s/r, so more running means a higher score.' })),
            ctx.ui.tabs([{ label: 'Score calculator', render: calcTab }, { label: 'History keeps hogs honest', render: histTab }])));
        },
      },
      /* ---------------- 5. Current / next / idle queues ---------------- */
      {
        title: 'Current and next: quick service without starvation',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const N = ctx.narrow;
          let eBatch = false;
          const sims = { false: curNext(false), true: curNext(true) };
          let sim = sims[eBatch];
          const info = Object.fromEntries(CN.map((x) => [x.id, x]));
          const cls = (id) => (info[id].kind === 'batch' ? 's-cpu' : info[id].kind === 'inter' ? 's-io' : 's-panel');
          const W = N ? 360 : 660, H = 322, LX = N ? 100 : 110, TW = N ? 34 : 40, TG = N ? 40 : 48;
          const GX0 = N ? 10 : 20, GX1 = W - 12, TMAX = 130, GT = (t) => GX0 + (t / TMAX) * (GX1 - GX0);
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'One processor with its current, next and idle run queues, and a timeline' });
          const tok = (x, y, id, hi) => [s('rect', { x, y, width: TW, height: 30, rx: 7, class: cls(id), 'stroke-width': hi ? 3.5 : 2 }), s('text', { x: x + TW / 2, y: y + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, id)];
          function draw(i) {
            const f = sim.frames[i];
            const kids = [s('rect', { x: 4, y: 4, width: W - 8, height: 50, rx: 10, class: 's-accent', 'stroke-width': 2 }),
              s('text', { x: 14, y: 34, 'font-size': 15, 'font-weight': 800 }, 'Processor'),
              ...tok(LX, 14, f.pick, true),
              s('text', { x: LX + TW + 10, y: 34, 'font-size': 14 }, `runs ${f.t}–${f.end} ms`, N ? null : s('tspan', { class: 's-sub' }, f.from === 'idle' ? '  (from idle queue)' : '  (from current)'))];
            [['current', f.cur, 'served now'], ['next', f.nxt, 'next round'], ['idle', f.idle, 'spare time']].forEach(([name, q, sub], k) => {
              const y = 66 + k * 56;
              kids.push(s('rect', { x: 4, y, width: W - 8, height: 48, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),
                s('text', { x: 14, y: y + 21, 'font-size': 15, 'font-weight': 800 }, name),
                s('text', { x: 14, y: y + 39, 'font-size': 13, class: 's-sub' }, sub));
              q.forEach((id, j) => kids.push(...tok(LX + j * TG, y + 9, id, false)));
              if (!q.length) kids.push(s('text', { x: LX, y: y + 29, 'font-size': 13, class: 's-sub' }, 'empty'));
            });
            if (f.swapped) kids.push(s('text', { x: W - 16, y: 124, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800, style: { fill: 'var(--accent)' } }, '⇅ swapped'));
            const gy = 266;
            kids.push(s('text', { x: GX0, y: gy - 16, 'font-size': 13, 'font-weight': 700 }, 'Timeline (ms)'), s('text', { x: GX1, y: gy - 16, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, N ? '▼ keystroke · orange = E' : '▼ keystroke for E · orange bar = E running'));
            sim.segs.forEach((g, j) => {
              if (j > i) return;
              kids.push(s('rect', { x: GT(g.a), y: gy, width: GT(g.b) - GT(g.a), height: 28, class: cls(g.id), 'stroke-width': j === i ? 3 : 1.2 }));
              if (GT(g.b) - GT(g.a) > 24) kids.push(s('text', { x: (GT(g.a) + GT(g.b)) / 2, y: gy + 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, g.id));
            });
            info.E.wakes.forEach((w) => kids.push(s('path', { d: `M${GT(w)} ${gy - 1} l-5 -8 h10 z`, style: { fill: w <= f.end ? 'var(--io)' : 'var(--line-2)' } })));
            for (let t = 0; t <= 120; t += 20) kids.push(s('line', { x1: GT(t), y1: gy + 30, x2: GT(t), y2: gy + 36, class: 's-line', 'stroke-width': 1.2 }), s('text', { x: GT(t), y: gy + 51, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t)));
            svg.replaceChildren(...kids);
            return narrate(i);
          }
          function narrate(i) {
            const f = sim.frames[i], p = i ? sim.frames[i - 1] : null, out = [];
            if (!p) out.push('<b>Start.</b> B1, B2 and B3 (batch) wait in current; E, the editor, sleeps until a keystroke; D (idle class) sits in the idle queue.');
            else if (p.after === 'next') out.push(`${p.pick} used its whole slice: as a batch thread it goes to the back of <b>next</b>.`);
            else if (p.after === 'done') out.push(`${p.pick} finished its work.`);
            else if (p.after === 'sleep') out.push(`E handled ${p.wait.length > 1 ? 'both keystrokes' : 'its keystroke'} in ${p.end - p.t} ms and went back to sleep.`);
            else if (p.after === 'yield') out.push('D gave up the processor at once: an idle-class thread runs only while no other thread is ready.');
            else out.push('D’s slice ended; it returns to the idle queue.');
            f.ev.forEach((e) => out.push(e.queued ? `Another keystroke at ${e.at} ms; E is already queued.` : `A keystroke at ${e.at} ms woke E, which joined <b>${eBatch ? 'next' : 'current'}</b>${eBatch ? ' (scored as batch)' : ''}.`));
            if (f.swapped) out.push('Current was empty, so <b>current and next swapped</b>: every waiting batch thread gets another turn.');
            out.push(f.from === 'idle' ? 'Current and next are both empty, so idle-class D runs.' : `The processor runs <b>${f.pick}</b>, the lowest-numbered thread in current (priority ${sim.pri[f.pick]}${f.pick === 'E' && eBatch ? ', the best batch priority, since E uses so little CPU' + (f.wait.some((x) => x.w > 0) ? '; it still had to wait for the swap' : '') : ''}).`);
            if (f.wait) out.push(`E waited <b>${f.wait.map((x) => x.w).join(' and ')} ms</b> since ${f.wait.length > 1 ? 'those keystrokes' : 'its keystroke'}.`);
            return out.join(' ');
          }
          const player = ctx.ui.player({ count: sim.frames.length, render: draw, interval: 1900 });
          const statRow = (b) => { const x = sims[b]; return h('tr', { class: b === eBatch ? 'on' : '' }, h('td', {}, b ? 'batch' : 'interactive'), h('td', { class: 'num' }, x.waits.join(', ')), h('td', { class: 'num b' }, ctx.util.fmt(x.avg, 1)), h('td', { class: 'num b' }, String(x.worst))); };
          const tbody = h('tbody');
          const paintStats = () => tbody.replaceChildren(statRow(false), statRow(true));
          const seg = ctx.ui.seg([{ value: 'i', label: 'interactive' }, { value: 'b', label: 'batch' }], 'i', (v) => { eBatch = v === 'b'; sim = sims[eBatch]; player.setCount(sim.frames.length); paintStats(); });
          paintStats();
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'card white', style: { padding: '8px' } }, svg), player.el),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', style: { fontSize: '16px' }, html: 'In the classic ULE design each processor keeps its time-sharing threads in two <span class="t">run queue</span>s, plus an idle queue:' }),
              h('ol', { class: 'm0', style: { paddingLeft: '20px', fontSize: '14.5px', lineHeight: 1.4 } },
                h('li', { html: 'The processor always runs the best thread in the <span class="t">current queue</span>.' }),
                h('li', { html: 'Interactive threads (and real-time and kernel ones) go into current when they wake.' }),
                h('li', { html: 'A batch thread whose slice ends goes to the <span class="t">next queue</span>.' }),
                h('li', { html: 'When current is empty, current and next swap. If both are empty, the idle queue runs.' })),
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Score E as'), seg),
              h('table', { class: 'tbl compact', style: { fontSize: '13.5px' } },
                h('thead', {}, h('tr', {}, h('th', {}, 'E scored as'), h('th', {}, 'waits (ms)'), h('th', {}, 'avg'), h('th', {}, 'worst'))), tbody),
              h('div', { class: 'callout why m0 small', 'data-label': 'No starvation', html: 'A batch thread in next is sure to run at the next swap, once per round. Interactive threads cannot hog current: a thread that stops sleeping loses its low score.' }),
              h('p', { class: 'xs muted m0', html: '<b>Model:</b> 10 ms slices, and a running thread keeps its slice. Real ULE makes it step aside almost at once when a better thread joins current (not next), so a real interactive E waits even less. <b>Since FreeBSD 7</b>, one circular batch queue with a rotating start replaces current/next.' }))));
        },
      },
      /* ---------------- 6. Load balancing: pull and push ---------------- */
      {
        title: 'Four cores out of balance: pull and push',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const N = ctx.narrow;
          let key = 'busy', pull = true, push = true;
          const run = () => balance(key, pull, push);
          let sim = run();
          const W = N ? 360 : 660, LX = N ? 70 : 84, TW = N ? 30 : 40, TG = N ? 33 : 46, LH = 44, LG = 6;
          const LY = (c) => 8 + c * (LH + LG) + (c >= 2 ? 14 : 0);
          const SY = LY(3) + LH + 34, CH = 16, H = SY + 4 * (CH + 2) + 26;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Four cores with their run queues, and a strip showing each core’s load over time' });
          const tok = (x, y, t, running) => [s('rect', { x, y, width: TW, height: 30, rx: 7, class: t.moved ? 's-warn' : running ? 's-proc' : 's-panel', 'stroke-width': running ? 3 : 1.8 }), s('text', { x: x + TW / 2, y: y + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, t.n)];
          function draw(i) {
            const f = sim.frames[i], kids = [];
            for (let c = 0; c < 4; c++) {
              const y = LY(c), cs = f.snap[c];
              kids.push(s('rect', { x: 4, y, width: W - 8, height: LH, rx: 9, class: 's-cpu', 'stroke-width': 1.5 }),
                s('text', { x: 12, y: y + 19, 'font-size': 14, 'font-weight': 800 }, 'Core ' + c),
                s('text', { x: 12, y: y + 36, 'font-size': 13, class: 's-sub' }, 'load ' + f.loads[c]));
              let x = LX;
              if (cs.run) { kids.push(...tok(x, y + 7, cs.run, true)); x += TG + (N ? 3 : 6); }
              else kids.push(s('text', { x, y: y + 27, 'font-size': 13, 'font-weight': 700, style: { fill: f.idleNow ? 'var(--bad)' : 'var(--muted)' } }, f.idleNow ? 'idle while work waits!' : 'idle'));
              cs.q.forEach((t) => { kids.push(...tok(x, y + 7, t, false)); x += TG; });
            }
            kids.push(s('text', { x: W - 10, y: LY(2) - 3, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'cores 0–1 share an L2 · cores 2–3 share an L2'));
            const moves = f.ev.filter((e) => e.k === 'pull' || e.k === 'push');
            moves.forEach((e, j) => {
              const ax = W - 26 - j * 22, y1 = LY(e.from) + LH / 2, y2 = LY(e.to) + LH / 2;
              kids.push(s('path', { d: `M${ax + 12} ${y1} C${ax - 6} ${y1} ${ax - 6} ${y2} ${ax + 10} ${y2}`, fill: 'none', stroke: e.k === 'pull' ? 'var(--warn)' : 'var(--os)', 'stroke-width': 3, 'marker-end': e.k === 'pull' ? 'url(#arr-warn)' : 'url(#arr-os)' }));
            });
            /* load strip: one column per tick up to now */
            const T = sim.frames.length, cw = (W - 50) / T;
            kids.push(s('text', { x: 8, y: SY - 9, 'font-size': 13, 'font-weight': 700 }, 'Load per tick'), s('text', { x: W - 8, y: SY - 9, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, N ? 'red = idle, work waiting' : 'green 1 · amber 2+ · red = idle while work waits'));
            for (let c = 0; c < 4; c++) kids.push(s('text', { x: 8, y: SY + c * (CH + 2) + 13, 'font-size': 12.5, class: 's-sub' }, 'C' + c));
            sim.frames.forEach((g, k) => {
              if (k > i) return;
              for (let c = 0; c < 4; c++) {
                const l = g.loads[c], waste = !l && g.idleNow;
                kids.push(s('rect', { x: 40 + k * cw, y: SY + c * (CH + 2), width: Math.max(1, cw - 1.5), height: CH, rx: 2, class: waste ? 's-bad' : !l ? 's-panel' : l === 1 ? 's-ok' : 's-warn', 'stroke-width': k === i ? 2 : 0.8 }));
              }
            });
            kids.push(s('text', { x: 40, y: H - 6, 'font-size': 12.5, class: 's-sub' }, 'tick 0'), s('text', { x: W - 8, y: H - 6, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'tick ' + (T - 1)));
            svg.replaceChildren(...kids);
            return narrate(i);
          }
          function narrate(i) {
            const f = sim.frames[i], out = [`<b>Tick ${f.t}.</b>`];
            f.ev.forEach((e) => {
              if (e.k === 'arrive') out.push(`${e.count} threads wake up on core ${e.core}, the core they last ran on.`);
              else if (e.k === 'pushnone') out.push('The balancer runs, but no core is 2 or more threads busier than another (with a thread waiting), so nothing moves.');
              else if (e.k === 'push') out.push(`<b>Push:</b> the balancer moves ${e.n} from core ${e.from} to core ${e.to} (+${e.cost} tick${e.cost > 1 ? 's' : ''} of cache refill, ${e.cost > 1 ? 'other L2' : 'same L2'}).`);
              else out.push(`<b>Pull:</b> core ${e.to} has nothing to run, so it steals ${e.n} from core ${e.from} (+${e.cost} tick${e.cost > 1 ? 's' : ''}, ${e.cost > 1 ? 'other L2' : 'same L2'}).`);
            });
            if (f.idleNow) out.push(`<span style="color:var(--bad)"><b>${f.idleNow} core${f.idleNow > 1 ? 's' : ''} idle</b> while threads wait elsewhere.</span>`);
            if (f.fins.length) out.push(`${f.fins.join(', ')} finished.`);
            if (i === sim.frames.length - 1) out.push(`<b>All ${sim.total} threads done after ${sim.T} ticks</b>, with ${sim.migr} migration${sim.migr === 1 ? '' : 's'}.`);
            else if (out.length === 1) out.push('Every core runs its own queue, two ticks per turn.');
            return out.join(' ');
          }
          const player = ctx.ui.player({ count: sim.frames.length, render: draw, interval: 1500 });
          const tbody = h('tbody');
          const MODES = [['none', false, false], ['pull only', true, false], ['push only', false, true], ['pull + push', true, true]];
          function paint() {
            tbody.replaceChildren(...MODES.map(([lab, a, b]) => { const r = balance(key, a, b); return h('tr', { class: a === pull && b === push ? 'on' : '' }, h('td', {}, lab), h('td', { class: 'num' }, String(r.T)), h('td', { class: 'num' }, ctx.util.fmt(r.meanTr, 1)), h('td', { class: 'num' }, String(r.waste)), h('td', { class: 'num' }, String(r.migr))); }));
          }
          const reload = () => { sim = run(); player.setCount(sim.frames.length); paint(); };
          const tog = (label, get, set) => { const b = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': String(get()), onclick: () => { set(!get()); b.setAttribute('aria-pressed', String(get())); b.textContent = label + (get() ? ' on' : ' off'); reload(); } }, label + (get() ? ' on' : ' off')); return b; };
          const scen = ctx.ui.seg(Object.keys(SCEN).map((k) => ({ value: k, label: SCEN[k].label })), key, (v) => { key = v; reload(); });
          paint();
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: N ? '1fr' : 'minmax(0, 590px) minmax(0, 1fr)' } },
            h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'card white', style: { padding: '8px' } }, svg), player.el),
            h('div', { class: 'stack', style: { gap: '7px' } },
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: 'Per-core queues drift apart: threads finish at different times, and a waking thread returns to the core it last ran on. ULE evens them out two ways:' }),
              h('div', { class: 'small', style: { lineHeight: 1.38 }, html: '<b style="color:var(--warn)">Pull</b> (<span class="t" data-t="Pull migration">work stealing</span>): a core with nothing to run takes a waiting thread from a busier core, trying its cache neighbour first.' }),
              h('div', { class: 'small', style: { lineHeight: 1.38 }, html: '<b style="color:var(--os)">Push</b> (<span class="t">push migration</span>): a periodic balancer moves a waiting thread from the busiest core to the least busy one. FreeBSD runs it at a randomized interval of about a second; here, every 5 ticks.' }),
              h('div', { class: 'row gap-s' }, tog('Pull', () => pull, (v) => { pull = v; }), tog('Push', () => push, (v) => { push = v; }), scen),
              h('table', { class: 'tbl compact', style: { fontSize: '13.5px' } },
                h('thead', {}, h('tr', {}, ...['mode', 'done', 'avg Tr', 'idle', 'moves'].map((x) => h('th', { style: { textTransform: 'none', fontSize: '13px' } }, x)))), tbody),
              h('p', { class: 'xs muted m0' }, 'done: tick when the last thread finished · avg Tr: mean turnaround (ticks) · idle: core-ticks spent idle while work waited. A small model, not a real kernel.'),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Moving is not free', html: 'Each <span class="t">thread migration</span> refills caches (amber tokens: +1 tick inside an L2 pair, +2 across), so ULE moves threads only for real gaps and prefers near neighbours.' }))));
        },
      },
      /* ---------------- 7. Recap ---------------- */
      {
        title: 'Recap: six things to remember about ULE',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['Which is more urgent in FreeBSD: priority 20 or priority 200?', '<b>20.</b> Lower numbers win. Classic bands: interrupt 0–63, top-half kernel 64–127, real-time 128–159, time-sharing 160–223, idle 224–255.'],
              ['Why does ULE keep run queues per processor?', 'Cores do not fight over one shared lock, and a thread can return to the core whose cache still holds its data (<b>processor affinity</b>).'],
              ['How is the interactivity score computed?', 'From voluntary sleep s and run time r (m = 50). s &gt; r: m / (s/r). r &gt; s: m + (m − m / (r/s)). s = r: 50. <b>Below 30 = interactive.</b>'],
              ['Where does each kind of thread wait?', 'Interactive, real-time and kernel threads: <b>current</b>. Batch threads after their slice: <b>next</b>. Current empty → swap. Both empty → <b>idle</b> queue.'],
              ['Why can’t batch threads starve?', 'Each batch thread in next runs once per swap, and a thread that stops sleeping loses its low score, so it cannot keep current full.'],
              ['Pull versus push migration?', '<b>Pull:</b> a core with nothing to run steals a waiting thread. <b>Push:</b> a periodic balancer moves threads from the busiest to the least busy core. Each move costs a cache refill.'],
            ], { cols: 3, height: 226 })));
        },
      },

      /* ---------------- 8. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In the classic FreeBSD priority layout, which range holds time-sharing user threads?', choices: ['128–159', '64–127', '224–255', '160–223'], answer: 3,
            feedback: ['128–159 is the real-time user band, which sits just above time-sharing.', '64–127 belongs to the top-half kernel: threads running or sleeping inside the kernel.', '224–255 is the idle class, used only when nothing else wants the processor.', null],
            why: 'Classic layout: interrupt threads 0–63, top-half kernel 64–127, real-time user 128–159, time-sharing user 160–223, idle user 224–255. Lower numbers are more urgent.' },
          { type: 'order', q: 'Put FreeBSD’s priority classes in order from most urgent (lowest numbers) to least urgent.', items: ['Bottom-half kernel (interrupt threads)', 'Top-half kernel', 'Real-time user threads', 'Time-sharing user threads', 'Idle user threads'],
            why: 'Hardware work comes first, then kernel work done for threads, then real-time, then ordinary time-sharing threads, and idle work last. (Since FreeBSD 9, real-time user threads sit above the top-half kernel band; the classic order is the one shown here.)' },
          { type: 'num', q: 'Over ULE’s recent window a thread slept voluntarily for 90 ms and ran for 10 ms. With m = 50, what is its interactivity score?', answer: 5.56, tol: 0.1,
            why: 'Sleep exceeds run, so score = m / (s / r) = 50 / (90 / 10) = 50 / 9 ≈ 5.6. That is far below 30, so the thread is interactive.' },
          { type: 'num', q: 'A thread slept voluntarily for 10 ms and ran for 90 ms. Using ULE’s interactivity formula with m = 50, what is its score?', answer: 94.44, tol: 0.2,
            hint: 'Run exceeds sleep, so use the r &gt; s form, whose result lies between 50 and 100 and grows as the thread runs more.',
            why: 'Run exceeds sleep, so score = m + (m − m / (r / s)) = 50 + (50 − 50 / 9) ≈ 94.4. That is a batch thread. (The simplified form m / (r / s) + m would give 55.6, also batch, but it runs backwards.)' },
          { type: 'num', q: 'ULE’s default interactivity threshold is 30 (m = 50). What percentage of its time must a thread spend sleeping for its score to equal exactly 30?', answer: 62.5, tol: 0.5, unit: '%',
            why: '50 / (s/r) = 30 gives s/r = 5/3, so sleep is 5 parts out of 8: 5/8 = 62.5%. Sleeping more than that makes the thread interactive.' },
          { type: 'bucket', q: 'In the classic ULE design, which run queue does each thread join?', buckets: ['Current queue', 'Next queue', 'Idle queue'],
            items: [['A text editor waking up after a keystroke', 0], ['A real-time audio thread that just became ready', 0], ['A compiler thread whose time slice just ran out', 1], ['A video encoder with an interactivity score of 80', 1], ['A file indexer started with idprio to use spare time', 2]],
            why: 'Interactive, real-time and kernel threads go to current for quick service; batch threads go to next after their slice; idle-class threads wait in the idle queue and run only when current and next are both empty.' },
          { q: 'What does a ULE processor do when its current queue becomes empty but its next queue is not?', choices: ['It swaps the current and next queues and carries on', 'It runs a thread from the idle queue straight away', 'It takes over the current queue of another processor', 'It raises every batch thread to interactive status'], answer: 0,
            feedback: [null, 'The idle queue runs only when current and next are both empty.', 'Processors share work by migrating single threads (pull or push), not by taking whole queues.', 'Scores come only from each thread’s own sleep and run history, not from the state of the queues.'],
            why: 'The swap turns the waiting batch threads into the new current queue, so each batch thread gets one turn per round and none can starve.' },
          { type: 'match', q: 'Match each multiprocessor idea in ULE with what it means.',
            pairs: [['Pull migration', 'A core with nothing to run takes a waiting thread from a busier core'], ['Push migration', 'A periodic balancer moves threads from the busiest core to the least busy one'], ['Processor affinity', 'Preferring the core whose cache still holds the thread’s data'], ['Topology awareness', 'Knowing which cores share caches and trying close neighbours first']],
            why: 'Pull reacts at once when a core would go idle; push fixes slower drifts; affinity and topology keep moves rare and short so caches stay useful.' },
          { type: 'multi', q: 'Which are reasons ULE keeps separate run queues for each processor instead of one shared queue?', choices: ['Cores no longer wait for one lock on a shared queue', 'A thread can return to the core whose cache holds its data', 'The cores can never become unevenly loaded', 'Interactive threads no longer need a score'], answer: [0, 1],
            why: 'Per-processor queues remove lock contention and keep caches warm. They can drift out of balance, which is why ULE needs pull and push migration, and the interactivity score is still needed to order threads within each processor.' },
          { q: 'A CPU-bound thread sleeps for 1 ms after every 9 ms it runs, hoping to look interactive. What does ULE decide?', choices: ['It is interactive, because it sleeps regularly', 'It is real-time, because its pattern is periodic', 'It is batch, because its score is about 94', 'It is interactive for one slice, then batch'], answer: 2,
            feedback: ['Regular sleeping is not enough; what counts is the ratio of sleep to run, and here it runs nine times as much as it sleeps.', 'Only an explicit, privileged request (rtprio or a POSIX real-time policy) puts a thread in the real-time class; the scheduler never promotes it there.', null, 'The score reflects the whole recent window, so this thread never dips below 30 at all.'],
            why: 'r/s = 9, so score = 50 + (50 − 50/9) ≈ 94.4, far above 30. Because the window remembers recent history, short naps cannot disguise a CPU hog.' },
          { q: 'Which statement about FreeBSD’s ULE scheduler is accurate?', choices: ['It uses one global run queue shared by all processors', 'It became the default in FreeBSD 7.1, replacing 4BSD', 'It was designed for single-processor machines only', 'It treats a higher priority number as more urgent'], answer: 1,
            feedback: ['That describes the older 4BSD scheduler; ULE keeps run queues per processor.', null, 'ULE was designed for multiprocessor and multicore machines (though it also works well on one processor).', 'FreeBSD counts the other way: a lower priority number is more urgent.'],
            why: 'ULE appeared as an option in FreeBSD 5.1 (2003) and became the default in 7.1 (2009), replacing the single-queue 4BSD scheduler.' },
          { type: 'tf', q: 'When ULE computes a thread’s interactivity score, the time the thread spends waiting in a run queue for its turn counts as sleep time.', answer: false,
            why: 'Only voluntary sleep counts: time blocked waiting for something such as a keystroke or a disk read. Waiting in a run queue is not sleeping; if it counted, a CPU hog stuck behind other threads would look interactive.' },
        ],
      },
    ],
    notes: `
      <h3>FreeBSD scheduling: the big picture</h3>
      <p>FreeBSD is an open-source descendant of Berkeley UNIX. Its scheduler has two goals that pull against each other: <b>scale</b> (keep every core of a multicore machine busy without fighting over shared data or wasting warm caches) and <b>respond</b> (serve a person at the keyboard at once, even while heavy jobs run). The <b>ULE scheduler</b> was built for both. It shipped as an option in FreeBSD 5.1 (2003) and became the default in 7.1 (2009). It replaced the <b>4BSD scheduler</b>, which used one global run queue for all processors and decay-usage priorities like traditional UNIX; 4BSD can still be selected when the kernel is built.</p>

      <h3>Priority classes</h3>
      <p>Every thread has a priority number from 0 to 255, and a <b>lower number is more urgent</b> (the same direction as traditional UNIX; SVR4 and Windows count the other way). The range is split into five classes. The classic layout (FreeBSD 5 to 8, the one usually taught):</p>
      <table>
        <tr><th>Class</th><th>Range</th><th>Who lives there</th><th>How the priority is set</th></tr>
        <tr><td>Bottom-half kernel (interrupt threads)</td><td>0–63</td><td>Kernel threads finishing hardware interrupt work (network, disk, clock)</td><td>Fixed per device type</td></tr>
        <tr><td>Top-half kernel</td><td>64–127</td><td>Kernel threads doing top-half work (such as the page daemon) and, in the classic design, threads asleep in the kernel</td><td>Fixed per kernel thread, or chosen from the reason for sleeping</td></tr>
        <tr><td>Real-time user</td><td>128–159</td><td>Threads marked real-time (rtprio, POSIX SCHED_FIFO / SCHED_RR)</td><td>Fixed, 32 levels</td></tr>
        <tr><td>Time-sharing user</td><td>160–223</td><td>Ordinary threads: shells, editors, compilers</td><td>Recomputed from interactivity score, recent CPU use and nice value</td></tr>
        <tr><td>Idle user</td><td>224–255</td><td>Spare-time work started with idprio</td><td>Fixed, 32 levels</td></tr>
      </table>
      <p>In the classic design a thread could change band: a time-sharing thread asleep in the kernel (say, waiting for a disk read) took a top-half kernel priority, so it ran soon after the event and released kernel resources quickly; back in user mode it returned to its time-sharing priority. Since FreeBSD 8, ULE by default lifts such a sleeper only within the time-sharing band.</p>
      <p><b>Later releases reordered the bands.</b> FreeBSD 9 moved real-time user threads <i>above</i> top-half kernel threads (9 to 13: interrupt 0–47, real-time 48–79, kernel 80–119, time-sharing 120–223, idle 224–255). FreeBSD 14 and 15 keep that order and shrink the interrupt and kernel bands further, so time-sharing starts at 88 (14) or 56 (15). The 0–255 range, the lower-is-better rule and the idle band 224–255 never changed.</p>

      <h3>Per-processor run queues, affinity and topology</h3>
      <p>A single shared run queue hurts on many cores in two ways: every core must lock it to pick a thread (lock contention, the load-sharing bottleneck), and any core may pick any thread, so threads often restart on a core whose caches hold none of their data. ULE gives <b>each processor its own run queues</b>. A waking thread is normally queued on the processor that ran it last (<b>processor affinity</b>), because that cache may still hold its data. ULE is also <b>topology-aware</b>: it knows which cores are hardware-thread siblings, which share an L2 cache and which share only the L3.</p>
      <p>Placing a waking thread (simplified): if it ran on its last core recently and that core is free, go home; else try a free core sharing a cache with it; else take the least loaded core. If it ran long ago its cache is cold, so ULE just takes the least loaded core.</p>

      <h3>The interactivity score</h3>
      <p>ULE watches each thread over a recent window (about the last 5 seconds) and adds up its <b>voluntary sleep time s</b> (blocked waiting for a keystroke, a disk read, a timer...; time spent waiting in a run queue does not count) and its <b>run time r</b>. With scaling factor <b>m = 50</b> (half the maximum score of 100):</p>
      <ul>
        <li>s &gt; r (mostly sleeps): score = m / (s / r), between 0 and 50</li>
        <li>r &gt; s (mostly runs): score = m + (m − m / (r / s)) = 100 − 50·s/r, between 50 and 100</li>
        <li>s = r: score = m = 50</li>
      </ul>
      <p>A thread whose score is below the <b>interactivity threshold</b> (30 by default, adjustable) is <b>interactive</b>; otherwise it is a <b>batch</b> thread.</p>
      <p><b>Worked examples.</b> s = 90, r = 10: 50 / 9 ≈ 5.6, interactive. s = r: 50, batch. s = 10, r = 90: 50 + (50 − 50/9) ≈ 94.4, batch. A hog that runs 9 ms and naps 1 ms also scores about 94.4. <b>The threshold:</b> 50 / (s/r) = 30 gives s/r = 5/3, so the thread sleeps 5/8 = <b>62.5%</b> of the time; it must sleep more than that to count as interactive.</p>
      <p><b>If you have seen another form.</b> A simplified form sometimes quoted for the r &gt; s line is m / (r / s) + m. It also stays between 50 and 100, so the verdict (batch) never changes, but it runs backwards: it would rate a pure CPU hog (s = 0) at only 50, and s = 10, r = 90 at 55.6 instead of 94.4. ULE’s code subtracts, as above, so more running always means a higher score.</p>
      <p><b>History keeps hogs honest.</b> When the two totals pass the window, both are scaled down (by 4/5), so old behaviour fades gradually. In the step’s model, an editor that starts compiling at 5 s crosses into batch at about ${n1(H_EC)} s, while a compiler that turns into an editor at 5 s only becomes interactive at about ${n1(H_CE)} s. Short naps cannot disguise a CPU hog, and a real change of behaviour is noticed within seconds.</p>

      <h3>Current, next and idle queues</h3>
      <p>In ULE’s original design each processor keeps three queues for time-sharing and idle work:</p>
      <ol>
        <li>The processor always runs the best (lowest-numbered) thread in the <b>current queue</b>.</li>
        <li>Interactive threads (and real-time and kernel ones) go into current when they wake.</li>
        <li>A batch thread whose slice ends goes to the <b>next queue</b>.</li>
        <li>When current is empty, current and next <b>swap</b>. If both are empty, the <b>idle queue</b> runs.</li>
      </ol>
      <p>An interactive thread therefore never waits for the batch threads parked in next, while each batch thread runs exactly once per swap, so none starves. A thread that stops sleeping loses its low score, so interactive threads cannot hog current. An idle-class thread gives up the processor the moment any other thread is ready.</p>
      <p>In the step’s trace (one processor, three batch threads, an editor woken every 20 ms, 10 ms slices, and a running time-sharing thread always finishing its slice) the editor waited ${n1(CN_I.avg)} ms on average (worst ${CN_I.worst} ms) when scored interactive, but ${n1(CN_B.avg)} ms on average (worst ${CN_B.worst} ms) when treated as batch. Real ULE does even better for interactive threads: when a better thread joins current, the running thread is made to step aside almost at once (at its next return to user mode), while a thread that joins next gets no such help. In recent FreeBSD a slice is about 94 ms, shrinking toward 16 ms as more threads wait. Since FreeBSD 7 the current/next pair has been replaced by one circular batch queue whose starting point rotates (interactive threads use a separate queue), with the same no-starvation guarantee.</p>

      <h3>Load balancing: pull and push</h3>
      <p>Per-processor queues drift out of balance: threads finish at different times, and waking threads return to their old core. ULE corrects this by <b>thread migration</b>, in two ways:</p>
      <ul>
        <li><b>Pull migration (work stealing):</b> a processor about to go idle takes a waiting thread from a busier one (a running thread plus at least one waiting), searching its cache neighbours first. It reacts at once.</li>
        <li><b>Push migration:</b> a periodic balancer pairs the most loaded processor with the least loaded one and moves a waiting thread. It catches imbalances among cores that are all busy. FreeBSD runs it about once a second, at a randomized interval so the cores do not all rebalance in lockstep (you may see “twice a second” quoted; the code has used an average of about one second since its early versions).</li>
      </ul>
      <p>Migration is not free: the moved thread must refill caches on its new core (less if the two cores share a cache), so ULE moves threads only for real gaps and prefers near neighbours. In the step’s model (one core with eight short threads, three cores each busy with one long thread), no balancing finished at tick ${BAL.none.T} with average turnaround ${n1(BAL.none.meanTr)} ticks; pull alone finished at ${BAL.pull.T} (${n1(BAL.pull.meanTr)}); push alone at ${BAL.push.T} (${n1(BAL.push.meanTr)}); pull and push together at ${BAL.both.T} with the best average, ${n1(BAL.both.meanTr)}.</p>`,
  });
})();
