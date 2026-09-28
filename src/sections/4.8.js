/* =====================================================================
   Section 4.8  Mac OS X Grand Central Dispatch
   GCD as an OS-managed thread pool, blocks (closures in C), dispatch
   queues (serial, concurrent, main, global), dispatch sources, and the
   "slow work on a global queue, UI update on the main queue" pattern.
   Original teaching material, built step by step (see AUTHORING.txt).
   ===================================================================== */
(() => {
  /* ---------- shared helpers (scoped to this file) ---------- */
  // six tile colours for blocks, cycled by position (letters A, B, C ... keep them apart)
  const TILE = ['proc', 'cpu', 'mem', 'io', 'os', 'accent'];
  const LETTERS = 'ABCDEFGHIJKL';
  /* Schedule a list of blocks (in submission order) on a serial or a concurrent queue served by `cores`
     pool threads. Both kinds take blocks from the front (FIFO). A serial queue starts a block only when
     the previous one has finished; a concurrent queue starts the next block on whichever thread frees up
     first (lowest-numbered thread on a tie). Returns each block's thread and times, plus overlapping pairs
     of blocks that touch shared data (possible races). */
  function gcdSchedule(blocks, mode, cores) {
    const free = Array(Math.max(1, cores)).fill(0);
    let prevEnd = 0;
    const out = blocks.map((b, i) => {
      let lane = 0, start;
      if (mode === 'serial') start = prevEnd;
      else { for (let j = 1; j < free.length; j++) if (free[j] < free[lane]) lane = j; start = free[lane]; }
      const end = start + b.dur;
      free[lane] = end; prevEnd = end;
      return { i, b, lane, start, end };
    });
    const total = blocks.reduce((a, b) => a + b.dur, 0);
    const makespan = out.reduce((m, o) => Math.max(m, o.end), 0);
    const races = [];
    for (let a = 0; a < out.length; a++) for (let c = a + 1; c < out.length; c++) {
      const A = out[a], B = out[c];
      if (A.b.sh && B.b.sh && A.start < B.end && B.start < A.end) races.push([a, c]);
    }
    const finishOrder = out.slice().sort((x, y) => x.end - y.end || x.i - y.i).map((o) => o.i);
    const events = [...new Set(out.flatMap((o) => [o.start, o.end]))].sort((x, y) => x - y);
    return { out, total, makespan, races, finishOrder, events };
  }

  Guide.section({
    id: '4.8',
    title: 'Mac OS X Grand Central Dispatch',
    short: 'Grand Central Dispatch',
    summary: 'Programs hand GCD blocks of work on dispatch queues; the OS runs them on a thread pool sized to the cores.',
    objectives: [
      'Explain what problem Grand Central Dispatch solves and how its OS-managed thread pool differs from creating threads by hand.',
      'Read and write simple blocks, and predict which values a block captures.',
      'Tell serial, concurrent, main and global dispatch queues apart and predict the orders in which their blocks can run and finish.',
      'Use the dispatch_async pattern to move slow work off the main thread and hand the result back to the main queue.',
      'Describe what a dispatch source does and name events it can watch.',
    ],
    terms: [
      ['Grand Central Dispatch (GCD)', 'Apple’s system for running work in parallel, first shipped in Mac OS X 10.6 (Snow Leopard). A program describes units of work as blocks placed on dispatch queues, and the system runs them on a pool of threads it manages.'],
      ['Thread pool', 'A group of worker threads that are created once and reused. Work is handed to the pool and an idle worker runs it, so no thread has to be created and destroyed for each piece of work.'],
      ['Degree of concurrency', 'How many pieces of work the hardware can truly run at the same moment. On an ordinary machine it is about the number of cores.'],
      ['Task (GCD)', 'In GCD, a unit of work: a self-contained piece of a job that can be done on its own, such as analysing one document. (Not the same meaning as the process-as-task of section 4.1 or the Linux task of section 4.6.)'],
      ['Block (GCD)', 'An extension to C, Objective-C and C++ for writing an unnamed piece of code inline, marked by a caret, as in ^{ ... }. A block can use variables from the code around it and can be stored or passed around like a value. GCD uses blocks to describe tasks.'],
      ['Anonymous function', 'A function written inline without a name, usually so it can be handed straight to another function.'],
      ['Closure', 'A piece of code packaged together with the variables it uses from the surrounding code, so it can run later, somewhere else, and still see those values.'],
      ['Capture', 'What a block does with an outside variable it uses: it keeps its own copy of the value (or, for a variable marked __block, a shared link to it) for when the block runs later.'],
      ['Dispatch queue', 'A first-in, first-out waiting line of blocks, kept as a lightweight data structure in the app’s own memory, so adding a block is far cheaper than creating a thread. GCD takes blocks from the front and runs them on threads from its pool.'],
      ['FIFO (first in, first out)', 'An ordering rule: items leave a line in the same order in which they joined it.'],
      ['Serial queue', 'A dispatch queue that runs one block at a time: the next block starts only after the previous one has finished. It is often used instead of a lock to protect shared data.'],
      ['Concurrent queue', 'A dispatch queue that starts its blocks in first-in, first-out order but lets several of them run at the same time on different threads, so they may finish in any order.'],
      ['Main queue', 'The serial dispatch queue whose blocks run on the application’s main thread. Work that updates the user interface is sent here.'],
      ['Main thread', 'The first thread of an application (also called the UI thread): it runs the event loop that handles clicks, key presses and drawing, and it is the thread that updates the window. While it is busy, the app looks frozen.'],
      ['Global queue', 'One of the concurrent dispatch queues that the system provides to every application, at several priority levels: high, default and low (plus background, added in Mac OS X 10.7). Newer code usually picks one by quality-of-service class instead.'],
      ['dispatch_async', 'The GCD function that adds a block to a queue and returns immediately, without waiting for the block to run.'],
      ['Dispatch source', 'A GCD object that watches for a system event, such as a timer firing, a signal arriving or a file descriptor becoming readable, and submits a handler block to a queue when the event happens. Events that arrive before the handler has run are merged into one run.'],
      ['Oversubscription', 'Having more runnable threads than cores, so the threads must take turns; the extra switching adds cost without adding speed.'],
    ],

    /* Scoped CSS: every selector starts with .sec-4-8 */
    css: `
      /* shell workaround: the header eyebrow is white-space:nowrap, and with this long section title its min-content
         width exceeded a phone screen, which widened the whole page in narrow mode. Letting the title wrap fixes it. */
      .sec-4-8 .step-eyebrow > span:nth-child(2) { white-space:normal; min-width:0; line-height:1.3; }
      .sec-4-8 .tile { display:inline-grid; place-items:center; min-width:34px; height:30px; padding:0 6px; border-radius:8px; border:2px solid var(--line-2); font-weight:800; font-size:14px; background:var(--panel-2); }
      .sec-4-8 .tile.proc { border-color:var(--proc); background:var(--proc-bg); } .sec-4-8 .tile.cpu { border-color:var(--cpu); background:var(--cpu-bg); }
      .sec-4-8 .tile.mem { border-color:var(--mem); background:var(--mem-bg); } .sec-4-8 .tile.io { border-color:var(--io); background:var(--io-bg); }
      .sec-4-8 .tile.os { border-color:var(--os); background:var(--os-bg); } .sec-4-8 .tile.accent { border-color:var(--accent); background:var(--accent-bg); }
      .sec-4-8 .ctl { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .sec-4-8 .ctl > .lbl { font-size:14px; font-weight:700; color:var(--ink-2); }
      .sec-4-8 .cap { background:var(--panel-2); border:1px solid var(--line); border-radius:10px; padding:9px 12px; font-size:15px; line-height:1.45; }
      .sec-4-8 .pipe { display:flex; flex-direction:column; }
      .sec-4-8 .pipe-btn { display:block; width:100%; text-align:left; border:2px solid var(--c); border-radius:12px; padding:7px 11px; background:var(--panel); cursor:pointer; color:var(--ink); font:inherit; }
      .sec-4-8 .pipe-btn:hover { background:var(--cb); }
      .sec-4-8 .pipe-btn.on { background:var(--cb); box-shadow:0 0 0 3px color-mix(in srgb, var(--c) 30%, transparent); }
      .sec-4-8 .pipe-btn .nm { font-weight:800; font-size:16px; }
      .sec-4-8 .pipe-btn .sb { font-size:13.5px; color:var(--ink-2); line-height:1.3; margin-top:2px; }
      .sec-4-8 .strat { padding:10px 11px; } .sec-4-8 .strat > .meter { flex:none; }
      .sec-4-8 .strat.best { border-color:var(--ok); box-shadow:0 0 0 2px color-mix(in srgb, var(--ok) 30%, transparent); }
      .sec-4-8 pre.mini { flex:none; margin:0; font-family:var(--mono); font-size:12.5px; line-height:1.4; background:var(--panel-3); border-radius:8px; padding:5px 7px; white-space:pre-wrap; min-height:3.6em; }
      .sec-4-8 .dots { flex:none; display:flex; flex-wrap:wrap; gap:2px 3px; align-content:flex-start; align-items:center; height:34px; overflow:hidden; }
      .sec-4-8 .dots > i { width:8px; height:8px; border-radius:50%; background:var(--thread); display:block; }
      .sec-4-8 .coresrow { display:flex; gap:4px; }
      .sec-4-8 .coresrow > i { flex:1; height:16px; border-radius:4px; border:1.5px solid var(--line-2); background:var(--panel-3); display:block; }
      .sec-4-8 .coresrow > i.on { background:var(--cpu-bg); border-color:var(--cpu); }
      .sec-4-8 .kps { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
      .sec-4-8 .kp { background:var(--panel-2); border:1px solid var(--line); border-radius:8px; padding:2px 8px; }
      .sec-4-8 .kp b { font-size:16px; }
      .sec-4-8 .corebar { display:grid; grid-template-columns:118px minmax(0,1fr); align-items:center; gap:8px; }
      .sec-4-8 .toks { display:flex; flex-wrap:wrap; gap:6px; align-items:center; font-family:var(--mono); }
      .sec-4-8 .tok { font:inherit; font-family:var(--mono); font-size:16px; font-weight:700; padding:6px 9px; border-radius:8px; border:2px dashed var(--line-2); background:var(--panel); color:var(--ink); cursor:pointer; }
      .sec-4-8 .tok:hover { border-color:var(--chc); }
      .sec-4-8 .tok.on { border-style:solid; border-color:var(--thread); background:var(--thread-bg); }
      .sec-4-8 .tok.plain { border:0; background:none; cursor:default; padding:6px 0; }
      .sec-4-8 .capbox { text-align:left; min-height:82px; padding:6px 10px; }
      .sec-4-8 .capbox .big { font-size:28px; }
      .sec-4-8 .tile.sm { min-width:26px; height:24px; font-size:12.5px; border-radius:6px; padding:0 4px; }
      .sec-4-8 .qrow2 { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto minmax(0,.9fr); align-items:center; gap:10px; width:100%; text-align:left; padding:5px 10px; border:2px solid var(--line); border-radius:12px; background:var(--panel); cursor:pointer; color:var(--ink); font:inherit; }
      .sec-4-8 .qrow2:hover { border-color:var(--chc); }
      .sec-4-8 .qrow2.on { border-color:var(--chc); background:color-mix(in srgb, var(--chc) 8%, var(--panel)); }
      .sec-4-8 .qname { display:flex; flex-direction:column; align-items:flex-start; gap:2px; font-size:15px; }
      .sec-4-8 .qline { display:flex; flex-direction:row-reverse; justify-content:flex-start; gap:4px; padding:4px 6px; border:1.5px dashed var(--line-2); border-radius:8px; min-height:34px; align-items:center; }
      .sec-4-8 .qarr { font-weight:900; color:var(--muted); }
      .sec-4-8 .qto { font-size:13.5px; padding:4px 8px; }
      .sec-4-8 .srcq { flex:1; display:flex; gap:5px; align-items:center; min-height:40px; padding:4px 8px; border:1.5px dashed var(--line-2); border-radius:10px; }
      .sec-4-8 .labgrid { display:grid; grid-template-columns:minmax(0, 2.05fr) minmax(0, 1fr); gap:18px; }
      .sec-4-8 .labgrid > * { min-width:0; min-height:0; }
      .sec-4-8 ol.goals { list-style:none; padding:0 !important; margin:0; display:flex; flex-direction:column; gap:6px; }
      .sec-4-8 ol.goals li { display:grid; grid-template-columns:22px minmax(0,1fr); gap:6px; font-size:14px; line-height:1.35; margin:0; }
      .sec-4-8 .gck { width:18px; height:18px; margin-top:1px; border-radius:50%; border:2px solid var(--line-2); display:grid; place-items:center; font-size:12px; font-weight:900; color:var(--panel); }
      .sec-4-8 ol.goals li.ok .gck { background:var(--ok); border-color:var(--ok); }
      .sec-4-8 ol.goals li.ok .gck::after { content:'✓'; }
      .sec-4-8 ol.goals li.ok > span:last-child { color:var(--ok); }
      .sec-4-8 .row.ord { gap:3px; min-height:26px; flex-wrap:wrap; }
      .sec-4-8 .cand { border:2px solid var(--line); border-radius:12px; padding:7px 10px; background:var(--panel); }
      .sec-4-8 .cand.right { border-color:var(--ok); background:var(--ok-bg); }
      .sec-4-8 .cand.wrong { border-color:var(--bad); background:var(--bad-bg); }
      .sec-4-8 .ordtxt { font-family:var(--mono); font-size:20px; font-weight:800; letter-spacing:.06em; }
      .sec-4-8 .qpics { display:flex; flex-direction:column; gap:5px; padding:6px 10px; }
      .sec-4-8 .qp { display:grid; grid-template-columns:132px 88px 14px minmax(0,1fr); align-items:center; gap:8px; font-size:14px; line-height:1.3; }
      .sec-4-8 .qp .qline { min-height:30px; padding:2px 5px; }
      .sec-4-8 .qp .nmq { display:flex; align-items:center; gap:5px; font-family:var(--mono); font-weight:800; }
      .sec-4-8 .win { position:relative; border:1px solid var(--line-2); border-radius:12px; overflow:hidden; background:var(--panel); box-shadow:var(--shadow); }
      .sec-4-8 .win-bar { display:flex; align-items:center; gap:6px; padding:6px 10px; background:var(--panel-3); border-bottom:1px solid var(--line); }
      .sec-4-8 .win-bar > i { width:10px; height:10px; border-radius:50%; background:var(--line-2); display:block; }
      .sec-4-8 .win-bar > span { margin-left:8px; color:var(--ink-2); }
      .sec-4-8 .win-body { padding:10px 12px; display:flex; flex-direction:column; gap:7px; }
      .sec-4-8 .doclines { display:flex; flex-direction:column; gap:6px; }
      .sec-4-8 .doclines .dl { height:8px; border-radius:4px; background:var(--panel-3); transition:width .3s; }
      .sec-4-8 .freeze { position:absolute; inset:31px 0 0 0; display:none; flex-direction:column; align-items:center; justify-content:center; gap:8px; background:color-mix(in srgb, var(--panel) 84%, transparent); color:var(--bad); pointer-events:none; }
      .sec-4-8 .spin { width:34px; height:34px; border-radius:50%; background:conic-gradient(var(--intr), var(--warn), var(--ok), var(--cpu), var(--os), var(--intr)); animation:sec-4-8-spin 1s linear infinite; }
      @keyframes sec-4-8-spin { to { transform:rotate(360deg); } }
      .sec-4-8 .lane { display:grid; grid-template-columns:110px minmax(0,1fr); align-items:center; gap:8px; font-size:14.5px; }
      .sec-4-8 .lane > .chip { justify-self:start; }
      .sec-4-8 .pipe-arrow { text-align:center; color:var(--muted); font-weight:900; font-size:15px; line-height:1; padding:3px 0; }
    `,

    steps: [
      /* ---------------- 1. Big Picture: describe the work, not the threads ---------------- */
      {
        title: 'Describe the work, let the system run it',
        kind: 'story',
        render(el, ctx) {
          const { h } = ctx;
          const LAYERS = [
            { key: 'code', nm: 'Your code', sb: 'writes each task as a block: ^{ … }', who: 'you', c: 'proc',
              head: 'You: find the work and wrap it up',
              body: '<p>You look for pieces of work that could happen at the same time (resize each photo, analyse a document, save a file) and wrap each piece in a <span class="t" data-t="Block (GCD)">block</span>. Then you choose a queue and hand the block over.</p>',
              eg: 'In code: <code>dispatch_async(queue, ^{ resize(photo); });</code> hands one block to a queue.' },
            { key: 'queue', nm: 'Dispatch queues', sb: 'hold blocks in first-in, first-out order', who: 'handoff', c: 'os',
              head: 'Queues: the waiting lines',
              body: '<p>A <span class="t">dispatch queue</span> is a waiting line of blocks; they leave it in the order they arrived. Some queues let one block run at a time, others let several run at once. You pick the queue; GCD empties it.</p>',
              eg: 'Examples: the main queue (for the user interface) and the global queues (shared by the whole app).' },
            { key: 'pool', nm: 'Thread pool', sb: 'worker threads that GCD creates and reuses', who: 'gcd', c: 'thread',
              head: 'GCD: the pool of workers',
              body: '<p>GCD keeps a small set of worker threads, about one per core, and reuses them for block after block. If some are stuck waiting for I/O, GCD adds a few more so the cores stay busy, and it retires idle ones. You never create, count or destroy these threads.</p>',
              eg: 'Example: on a 4-core Mac, about 4 workers take turns emptying all of the app’s queues.' },
            { key: 'cores', nm: 'Cores', sb: 'the hardware that actually runs threads', who: 'gcd', c: 'cpu',
              head: 'Hardware: as many cores as the machine has',
              body: '<p>The kernel runs the pool’s threads on the cores. The same program uses 2 cores on a 2-core laptop and 10 on a 10-core desktop without any change, because the pool follows the hardware, not a number the programmer guessed.</p>',
              eg: 'The kernel schedules the pool’s threads like any other threads, as earlier in this chapter.' },
          ];
          let cur = 0;
          const detail = h('div', { class: 'card white stack gap-s', style: { minHeight: '220px' } });
          const btns = LAYERS.map((L, i) => h('button', { type: 'button', class: 'pipe-btn', style: { '--c': `var(--${L.c})`, '--cb': `var(--${L.c}-bg)` }, onclick: () => { cur = i; paint(); } },
            h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: '6px' } },
              h('span', { class: 'nm' }, L.nm),
              h('span', { class: 'chip ' + (L.who === 'you' ? 'proc' : L.who === 'gcd' ? 'os' : 'accent') }, L.who === 'you' ? 'you' : L.who === 'gcd' ? 'GCD + OS' : 'you + GCD')),
            h('div', { class: 'sb' }, L.sb)));
          const pipe = h('div', { class: 'pipe' });
          btns.forEach((b, i) => { if (i) pipe.append(h('div', { class: 'pipe-arrow', 'aria-hidden': 'true' }, '↓')); pipe.append(b); });
          function paint() {
            btns.forEach((b, i) => b.classList.toggle('on', i === cur));
            const L = LAYERS[cur];
            detail.replaceChildren(
              h('h4', { class: 'm0' }, `Layer ${cur + 1} of 4 · click the layers`),
              h('h3', { class: 'm0' }, L.head),
              ctx.frag(L.body),
              h('div', { class: 'small muted', html: L.eg }));
          }
          paint();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'A modern Mac has several cores. To use them, a program must split its work into pieces that can run at the same time, and <i>someone</i> has to create threads, hand them work and clean up afterwards.' }),
              h('p', { class: 'm0', html: '<span class="t">Grand Central Dispatch (GCD)</span>, introduced in Mac OS X 10.6 (Snow Leopard), moves that job into the operating system. You describe <span class="t" data-t="Task (GCD)">tasks</span>, not threads, and GCD maps them onto a <span class="t">thread pool</span> sized to the <span class="t">degree of concurrency</span> the hardware offers.' }),
              h('div', { class: 'callout why m0', 'data-label': 'What GCD adds to an old idea', html: 'Thread pools are not new: server programs have used them for decades, and Windows has one too. GCD adds a language feature, <b>blocks</b>, for writing a task right where it belongs, plus <b>queues</b> that keep tasks in order. A whole unit of work can be split off without scrambling the order and dependencies between its parts.' }),
              h('p', { class: 'small muted m0', html: 'Bridge: section 4.3 showed that extra cores help only when work is split into parallel pieces. GCD is the Mac OS X answer to the question “who manages the threads that run those pieces?”' })),
            h('div', { class: 'stack' },
              h('div', { class: 'card', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 5fr) minmax(0, 6fr)', gap: '14px', alignItems: 'start' } }, pipe, detail),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy: a restaurant kitchen', html: 'Waiters (your code) do not hire a cook for every dish. They clip tickets (blocks) onto a rail (a queue); the kitchen manager (GCD) keeps about one cook (thread) per stove (core), and each free cook takes the next ticket. A ticket carries all it needs, just as a block carries its data.' }))));
        },
      },

      /* ---------------- 2. Compare: threads by hand vs tasks for GCD ---------------- */
      {
        title: 'Why not just create the threads yourself?',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const W = 0.1, C = 0.04, STACK = 0.5; // ms of work per task, ms to create + destroy a thread, MB of stack per thread
          const STRATS = [
            { key: 'each', nm: 'One thread per task', code: 'pthread_create × N   // N new threads\npthread_join × N     // wait, destroy', threads: (T) => T },
            { key: 'pool', nm: 'Hand-made pool of 4', code: 'make 4 threads       // guessed once\n+ queue, locks, exit // all your code', threads: (T) => Math.min(4, T) },
            { key: 'gcd', nm: 'GCD', code: 'dispatch_async(q,    // per task: a cheap\n  ^{ work(i); });    // enqueue, no thread', threads: (T, cores) => Math.min(cores, T) },
          ];
          let T = 32, cores = 8;
          const model = (st) => {
            const n = st.threads(T, cores), P = Math.min(n, cores);
            const cpu = T * W + n * C;
            return { n, P, finish: cpu / P, over: (n * C) / cpu, mem: n * STACK, perCore: n / cores };
          };
          const cards = STRATS.map((st) => {
            const kp = (lbl) => { const v = h('b', { class: 'num' }); return [v, h('div', { class: 'kp' }, h('div', { class: 'xs muted b' }, lbl), v)]; };
            const [tN, kN] = kp('THREADS'), [tMem, kMem] = kp('STACK MEMORY'), [tPer, kPer] = kp('THREADS PER CORE'), [tFin, kFin] = kp('FINISHES AFTER');
            const c = { st, dots: h('div', { class: 'dots' }), coresRow: h('div', { class: 'coresrow' }), coresLbl: h('div', { class: 'xs muted b' }),
              tN, tMem, tPer, tFin, meter: h('div', { class: 'meter' }, h('i')), tOver: h('span', { class: 'xs b' }), badge: h('span') };
            c.el = h('div', { class: 'card white stack gap-s strat' },
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'b' }, st.nm), c.badge),
              h('pre', { class: 'mini' }, st.code),
              h('div', { class: 'xs muted b' }, 'THREADS THAT EXIST (ONE DOT EACH)'), c.dots,
              h('div', { class: 'corebar' }, c.coresLbl, c.coresRow),
              h('div', { class: 'kps' }, kN, kMem, kPer, kFin),
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'CPU TIME SPENT ON THREAD BOOKKEEPING'), c.tOver),
              c.meter);
            return c;
          });
          const verdict = h('div', { class: 'cap' });
          const fmtMem = (mb) => (mb >= 1 ? ctx.util.fmt(mb, 1) + ' MB' : Math.round(mb * 1024) + ' KB');
          function paint() {
            const ms = cards.map((c) => model(c.st));
            const best = Math.min(...ms.map((m) => m.finish));
            cards.forEach((c, k) => {
              const m = ms[k];
              const shown = m.n > 90 ? 72 : m.n; // leave room on the last row for the "+N more" label
              const dots = ctx.util.range(shown).map(() => h('i'));
              if (m.n > shown) dots.push(h('span', { class: 'xs b', style: { lineHeight: '1', marginLeft: '3px' } }, '+' + (m.n - shown) + ' more'));
              c.dots.replaceChildren(...dots);
              c.coresRow.replaceChildren(...ctx.util.range(cores).map((j) => h('i', { class: j < m.P ? 'on' : '' })));
              c.coresLbl.textContent = `CORES BUSY: ${m.P} / ${cores}`;
              c.tN.textContent = m.n;
              c.tMem.textContent = fmtMem(m.mem);
              c.tPer.textContent = ctx.util.fmt(m.perCore, 2);
              c.tPer.style.color = m.perCore > 1 ? 'var(--bad)' : '';
              c.tFin.textContent = ctx.util.fmt(m.finish, 2) + ' ms';
              c.meter.firstChild.style.width = Math.max(1, m.over * 100) + '%';
              c.meter.firstChild.style.background = m.over > 0.15 ? 'var(--bad)' : m.over > 0.05 ? 'var(--warn)' : 'var(--ok)';
              c.tOver.textContent = ctx.util.fmt(m.over * 100, 1) + '%';
              const fastest = Math.abs(m.finish - best) < 1e-9;
              c.badge.className = 'chip ' + (fastest ? 'ok' : 'warn');
              const pct = (m.finish / best - 1) * 100;
              c.badge.textContent = fastest ? 'fastest' : pct < 1 ? '≈ same time' : '+' + Math.round(pct) + '% time';
              c.el.classList.toggle('best', fastest);
            });
            const [a, b] = ms;
            // with no more tasks than cores (and than the pool's 4 threads) all three make the same threads and tie
            if (T <= Math.min(4, cores)) {
              verdict.innerHTML = `With only <b>${T}</b> tasks, all three strategies make <b>${T}</b> threads, so they tie. The differences appear once tasks outnumber cores (<span class="t">oversubscription</span>) or the pool’s guess: slide <b>Tasks</b> up.`;
              return;
            }
            const sA = a.n > cores
              ? `One thread per task makes <b>${a.n}</b> threads (${fmtMem(a.mem)} of stack) and spends <b>${ctx.util.fmt(a.over * 100, 0)}%</b> of its CPU time creating and destroying them; ${ctx.util.fmt(a.perCore, 1)} threads share each core (<span class="t">oversubscription</span>).`
              : `One thread per task makes ${a.n} threads, no more than the ${cores} cores, so here it matches GCD. Add tasks and it falls behind.`;
            let sB;
            if (cores === 4) sB = 'The hand-made pool ties GCD only because its author guessed 4 cores and this Mac has exactly 4. Try another machine.';
            else if (cores > 4) sB = `The hand-made pool leaves <b>${cores - b.P} of ${cores}</b> cores idle: it was written for a smaller machine. GCD sized its pool to this one.`;
            else sB = `The hand-made pool runs 4 threads on ${cores} core${cores > 1 ? 's' : ''}: they take turns, adding memory but no speed. GCD made only ${cores}.`;
            verdict.innerHTML = sA + ' ' + sB;
          }
          const sl = ctx.ui.slider({ label: 'Tasks', min: 2, max: 10, value: 5, format: (v) => String(2 ** v), onInput: (v) => { T = 2 ** v; paint(); } });
          sl.style.width = ctx.narrow ? '100%' : '290px';
          const seg = ctx.ui.seg([1, 2, 4, 8].map((c) => ({ value: c, label: c + (c === 1 ? ' core' : ' cores') })), cores, (v) => { cores = v; paint(); });
          paint();
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'A program has a pile of small, independent tasks, each needing <b>0.1 ms</b> of computing (one thumbnail, say). Compare three ways to run them.' }),
            h('div', { class: 'ctl', style: { gap: '18px' } }, sl, h('div', { class: 'ctl' }, h('span', { class: 'lbl' }, 'This Mac has'), seg),
              h('span', { class: 'xs muted', style: { flex: '1', minWidth: '220px' }, html: 'Cost model: creating + destroying a thread ≈ 0.04 ms of CPU; each thread reserves 0.5 MB of stack; queueing a block is almost free.' })),
            h('div', { class: 'grid-3 grow' }, ...cards.map((c) => c.el)),
            h('div', { class: 'split', style: { height: 'auto', gap: '14px', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 3fr) minmax(0, 2fr)' } }, verdict,
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'More threads is not more speed. Once every core is busy, extra threads only take turns; they add memory and switching and finish no sooner.' }))));
        },
      },

      /* ---------------- 3. Learn: blocks, a unit of work you can hold ---------------- */
      {
        title: 'Blocks: a piece of work you can pass around',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          /* --- tab 1: clickable anatomy of a block --- */
          const PARTS = [
            ['int', 'Return type', 'The block hands back an int when it finishes.'],
            ['(^twice)', 'A block variable', 'In a declaration the caret plays the role that * plays for pointers: twice is a variable that <i>holds</i> a block.'],
            ['(int)', 'Parameter types', 'The block takes one int.'],
            ['=', 'Store it', 'The block written on the right is stored in twice. Nothing runs yet.'],
            ['^(int n)', 'Block literal starts', 'The caret says “a block starts here”; (int n) names its parameter. A block that takes nothing can be written just ^{ … }.'],
            ['{ return n * 2; }', 'The body', 'The actual work. It runs only when someone calls the block, not when the block is created.'],
          ];
          function anatomy(panel) {
            let pick = 4;
            const info = h('div', { class: 'card white', style: { minHeight: '92px' } });
            const toks = PARTS.map((p, i) => h('button', { type: 'button', class: 'tok', onclick: () => { pick = i; paint(); } }, p[0]));
            function paint() {
              toks.forEach((t, i) => t.classList.toggle('on', i === pick));
              info.innerHTML = `<h3 class="m0">${PARTS[pick][1]}</h3><p class="m0">${PARTS[pick][2]}</p>`;
            }
            paint();
            panel.append(h('div', { class: 'stack' },
              h('p', { class: 'm0 small', html: 'Click each part of this declaration. It makes a block that doubles a number and keeps it in a variable called <code>twice</code>.' }),
              h('div', { class: 'toks' }, ...toks, h('span', { class: 'tok plain' }, ';')),
              info,
              h('div', { class: 'grid-2' },
                h('div', { class: 'card tight' }, h('h4', {}, 'Call it like a function'), h('code', {}, 'int r = twice(21);'), h('p', { class: 'small m0 mt' }, 'r is now 42. The body ran only at this moment.')),
                h('div', { class: 'card tight' }, h('h4', {}, 'The simplest block'), h('code', {}, '^{ printf("hello world\\n"); }'), h('p', { class: 'small m0 mt' }, 'No parameters and no result, so only the caret and the braces are left.'))),
              h('div', { class: 'card tight' }, h('h4', {}, 'Where blocks go in GCD'), h('code', {}, 'dispatch_async(queue, ^{ resize(photo); });'),
                h('p', { class: 'small m0 mt', html: 'The block is simply the last argument. <code>dispatch_async</code> stores it in the queue and returns; a pool thread calls it later. Note that <code>photo</code> is captured, so the block brings the data along.' }))));
          }
          /* --- tab 2: predict what a block captures, then step through --- */
          function capture(panel) {
            let shared = false, guess = null;
            const SRC = (sh) => `
${sh ? '__block int x = 5;          // __block: share x, do not copy it' : 'int x = 5;                  // an ordinary local variable'}
void (^greet)(void) = ^{    // make a block, keep it in greet
    printf("x is %d\\n", x); // the body uses x ...
};                          // ... so the block captures x here
x = 9;                      // change x AFTER the block exists
greet();                    // now run the block`;
            const codeBox = h('div');
            let code = null;
            const vVar = h('div', { class: 'box mem capbox' }), vBlk = h('div', { class: 'box thread capbox' }), out = h('div', { class: 'log', style: { minHeight: '34px' } });
            const gBtns = [5, 9].map((v) => h('button', { type: 'button', class: 'btn sm', onclick: () => { guess = v; gBtns.forEach((b, i) => b.classList.toggle('on', [5, 9][i] === v)); player.refresh(); } }, `x is ${v}`));
            const LINES = [[1], [2, 3, 4], [5], [6]];
            function draw(i) {
              code.clear(); code.mark(LINES[i]);
              const x = i >= 2 ? 9 : 5;
              vVar.innerHTML = `<div class="xs muted b">VARIABLE x (in the function)</div><div class="big">${x}</div>`;
              if (i === 0) vBlk.innerHTML = '<div class="xs muted b">BLOCK greet</div><div class="small muted" style="padding:10px 0">not created yet</div>';
              else vBlk.innerHTML = shared
                ? `<div class="xs muted b">BLOCK greet</div><div class="small">captured: <b>a link to x</b></div><div class="big">→ ${x}</div>`
                : '<div class="xs muted b">BLOCK greet</div><div class="small">captured: <b>its own copy</b></div><div class="big">5</div>';
              out.textContent = i === 3 ? `x is ${shared ? 9 : 5}` : '(nothing printed yet)';
              const ans = shared ? 9 : 5;
              const caps = [
                '<b>Line 1.</b> An ordinary variable x is created with the value 5.' + (shared ? ' The <code>__block</code> marker asks for it to be shared with any block that uses it.' : ''),
                shared ? '<b>Lines 2 to 4.</b> The block is created. Because x is marked __block, the block keeps a <b>link</b> to x itself, not a copy.' : '<b>Lines 2 to 4.</b> The block is created. It uses x, so it <b>captures</b> x: it copies the value 5 into itself, right now.',
                shared ? '<b>Line 5.</b> x becomes 9. The block’s link sees the change, because both refer to the same x.' : '<b>Line 5.</b> x becomes 9, but the block’s copy was made earlier and still says 5.',
                `<b>Line 6.</b> Running the block prints <b>x is ${ans}</b>. ` + (guess == null ? 'Make a prediction next time before you step.' : guess === ans ? 'Your prediction was right.' : `You predicted ${guess}: the block ${shared ? 'shares x, so it sees the new value' : 'took its copy before x changed'}.`),
              ];
              return caps[i];
            }
            function build() {
              code = ctx.ui.code(SRC(shared), { lang: 'c', fontSize: 13.5 });
              codeBox.replaceChildren(code);
            }
            const seg = ctx.ui.seg([{ value: false, label: 'int x = 5;' }, { value: true, label: '__block int x = 5;' }], false, (v) => { shared = v; guess = null; gBtns.forEach((b) => b.classList.remove('on')); build(); player.reset(); });
            build();
            const player = ctx.ui.player({ count: 4, render: draw, interval: 2200, speed: false });
            panel.append(h('div', { class: 'stack', style: { gap: '9px' } },
              h('div', { class: 'ctl' }, h('span', { class: 'lbl' }, 'First line:'), seg, h('span', { class: 'lbl', style: { marginLeft: '10px' } }, 'Predict:'), ...gBtns),
              codeBox,
              h('div', { class: 'grid-3', style: { alignItems: 'stretch' } }, vVar, vBlk, h('div', { class: 'stack gap-s' }, h('div', { class: 'xs muted b' }, 'OUTPUT'), out)),
              player.el,
              h('div', { class: 'callout tip m0 small', 'data-label': 'Why copying is the default', html: 'By the time a block runs on some pool thread, the function that created it may already have returned and its local variables may be gone. A copy travels safely with the block.' })));
          }
          const tabs = ctx.ui.tabs([{ label: 'Predict: what does a block capture?', render: capture }, { label: 'Anatomy of a block', render: anatomy }]);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'A <span class="t" data-t="Block (GCD)">block</span> is a piece of code you can hold in your hand and pass to someone else.' }),
              h('p', { class: 'm0', html: 'Blocks are a small extension to C, Objective-C and C++. A caret and a pair of braces make one: <code style="white-space:nowrap">^{ printf("hello world\\n"); }</code>' }),
              h('p', { class: 'm0', html: 'A block has no name: it is an <span class="t">anonymous function</span>. You can store it, pass it to <code>dispatch_async</code>, and run it later, even on another thread.' }),
              h('p', { class: 'm0', html: 'A block also remembers the outside variables it uses: it <span class="t" data-t="Capture">captures</span> them. Code bundled with captured values is called a <span class="t">closure</span>.' }),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why GCD needs blocks', html: 'A task’s code stays where it belongs in your function, in the order you think about it, yet runs elsewhere, later, carrying its data.' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Writing a block does not run it. It runs when it is called, or when GCD takes it off a queue.' })),
            tabs));
        },
      },

      /* ---------------- 4. Learn: dispatch queues and dispatch sources ---------------- */
      {
        title: 'Dispatch queues: where blocks wait their turn',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          /* --- tab 1: the queues every app can use --- */
          const QS = [
            { nm: 'Main queue', kind: 'serial', to: 'main thread', tcls: 'thread', n: 2,
              get: 'dispatch_get_main_queue()',
              what: 'The <span class="t">main queue</span> is serial: its blocks run one at a time on the application’s <span class="t">main thread</span>, the thread that handles clicks, keys and drawing.',
              use: 'Anything that touches the window: showing results, changing labels, enabling buttons.',
              care: 'Never put slow work here. While a block runs on the main queue, the app cannot react to the user.' },
            { nm: 'Global queues', kind: 'concurrent', to: 'thread pool', tcls: 'os', n: 4,
              get: 'dispatch_get_global_queue(\n  DISPATCH_QUEUE_PRIORITY_DEFAULT, 0)',
              what: 'The <span class="t" data-t="Global queue">global queues</span> are concurrent, shared by the whole app and supplied by the system at priorities <b>high, default and low</b> (plus <b>background</b> since 10.7); higher-priority blocks go first when cores are scarce. Newer code usually picks a <b>quality-of-service class</b> instead: user-interactive, user-initiated, utility or background.',
              use: 'Independent background work: analysing, resizing, compressing, searching.',
              care: 'Blocks may run at the same time, so shared data needs protection.' },
            { nm: 'Your own serial queue', kind: 'serial', to: 'thread pool', tcls: 'os', n: 3,
              get: 'dispatch_queue_create("com.example.bank",\n  DISPATCH_QUEUE_SERIAL)',
              what: 'A private queue you create and name. Its blocks run on pool threads, one at a time, in order. (In 10.6 every app-made queue was serial; private concurrent queues, DISPATCH_QUEUE_CONCURRENT, came in 10.7.)',
              use: 'Guarding shared data instead of a lock: if every use of a balance goes through this queue, two updates can never overlap.',
              care: 'A serial queue is not a thread. Its blocks may run on different pool threads, just never two at once.' },
          ];
          function queueMap(panel) {
            let pick = 0;
            const rows = QS.map((q, i) => h('button', { type: 'button', class: 'qrow2', onclick: () => { pick = i; paint(); } },
              h('div', { class: 'qname' }, h('b', {}, q.nm), h('span', { class: 'chip ' + (q.kind === 'serial' ? 'proc' : 'cpu') }, q.kind)),
              h('div', { class: 'qline' }, ...ctx.util.range(q.n).map((k) => h('span', { class: 'tile sm ' + TILE[(i * 2 + k) % TILE.length] }, LETTERS[k]))),
              h('span', { class: 'qarr' }, '→'),
              h('span', { class: 'box ' + q.tcls + ' qto' }, q.to)));
            const info = h('div', { class: 'card white stack gap-s' });
            function paint() {
              rows.forEach((r, i) => r.classList.toggle('on', i === pick));
              const q = QS[pick];
              info.replaceChildren(
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, q.nm), h('span', { class: 'chip ' + (q.kind === 'serial' ? 'proc' : 'cpu') }, q.kind + ' queue')),
                h('pre', { class: 'mini' }, q.get),
                h('p', { class: 'm0 small', html: q.what }),
                h('p', { class: 'm0 small', html: '<b>Use it for:</b> ' + q.use }),
                h('p', { class: 'm0 small', html: '<b>Careful:</b> ' + q.care }));
            }
            paint();
            panel.append(h('div', { class: 'stack gap-s' }, h('p', { class: 'small muted m0' }, 'Click a queue. Front of each line is on the right, next to the arrow.'), ...rows, info));
          }
          /* --- tab 2: dispatch sources turn events into queued blocks --- */
          const SRCS = [
            { key: 'T', nm: 'Timer fires', type: 'TIMER', job: 'autosave()', c: 'warn' },
            { key: 'R', nm: 'Socket has data', type: 'READ', job: 'readMessage()', c: 'io' },
            { key: 'S', nm: 'Signal arrives', type: 'SIGNAL', job: 'reloadSettings()', c: 'intr' },
            { key: 'P', nm: 'Child process exits', type: 'PROC', job: 'collectResult()', c: 'proc' },
          ];
          function sources(panel) {
            /* Model of real dispatch-source behaviour: a source has at most ONE handler run waiting in the queue
               (events that arrive before it starts are merged into it, count n), and never runs its own handler
               twice at once (an event that arrives while the handler runs is held by the source, then queued). */
            const q = [], run = [null, null], held = {};
            let serial = 0;
            const qBox = h('div', { class: 'srcq' }), runBox = h('div', { class: 'grid-2', style: { gap: '6px' } }), log = h('div', { class: 'log', style: { height: '70px' } });
            const glow = {}, heldEl = {};
            const btns = SRCS.map((sd) => {
              held[sd.key] = 0;
              heldEl[sd.key] = h('span', { class: 'xs b', style: { marginLeft: '4px' } });
              const b = h('button', { type: 'button', class: 'btn sm ' + (sd.c === 'warn' ? '' : sd.c), onclick: () => fire(sd) }, h('b', {}, sd.key), ' ' + sd.nm, heldEl[sd.key]);
              glow[sd.key] = b; return b;
            });
            function fire(sd) {
              glow[sd.key].classList.remove('flash'); void glow[sd.key].offsetWidth; glow[sd.key].classList.add('flash');
              const waiting = q.find((it) => it.sd === sd);
              if (waiting) { waiting.n++; addLog(`${sd.type} event merged into the waiting ${sd.key}${waiting.id} (${waiting.n} events, still one run)`); }
              else if (run.some((r) => r && r.sd === sd)) { held[sd.key]++; addLog(`${sd.type} event held: this source's handler is still running`); }
              else { q.push({ id: ++serial, sd, n: 1, age: 0 }); addLog(`${sd.type} source saw its event → queued ^{ ${sd.job}; }`); }
              paint();
            }
            function addLog(t) { log.append(h('div', {}, t)); while (log.childNodes.length > 30) log.firstChild.remove(); log.scrollTop = log.scrollHeight; }
            const tileOf = (it) => h('span', { class: 'tile ' + (it.sd.c === 'warn' ? 'accent' : it.sd.c === 'intr' ? 'os' : it.sd.c) }, it.sd.key + it.id + (it.n > 1 ? ' ×' + it.n : ''));
            function paint() {
              qBox.replaceChildren(...(q.length ? q.map(tileOf) : [h('span', { class: 'xs muted' }, 'empty: no thread is waiting for events')]));
              runBox.replaceChildren(...run.map((r, i) => h('div', { class: 'box thread small', style: { textAlign: 'left', padding: '4px 8px' } },
                h('div', { class: 'xs muted b' }, 'POOL THREAD ' + (i + 1)), r ? h('span', {}, tileOf(r), ' ' + r.sd.job) : h('span', { class: 'muted' }, 'idle'))));
              SRCS.forEach((sd) => { heldEl[sd.key].textContent = held[sd.key] ? '· holds ' + held[sd.key] : ''; });
            }
            log.append(h('div', { class: 'muted' }, 'Fire a few events, then fire the same one twice quickly and watch the queue.'));
            ctx.every(450, () => {
              let changed = false;
              run.forEach((r, i) => {
                if (!r || ++r.age < 3) return;
                addLog(`pool thread ${i + 1} finished ${r.sd.key}${r.id}: ${r.sd.job}` + (r.n > 1 ? ` (handled ${r.n} events)` : ''));
                run[i] = null; changed = true;
                const k = r.sd.key;
                if (held[k]) { q.push({ id: ++serial, sd: r.sd, n: held[k], age: 0 }); addLog(`${r.sd.type} source now queues its held event${held[k] > 1 ? 's' : ''}`); held[k] = 0; }
              });
              run.forEach((r, i) => { if (!r && q.length) { run[i] = q.shift(); run[i].age = 0; changed = true; } });
              if (changed) paint();
            });
            paint();
            panel.append(h('div', { class: 'stack gap-s' },
              h('p', { class: 'small m0', html: 'A <span class="t">dispatch source</span> watches for a system event. When it happens, the source puts a handler block on a queue you chose, and a pool thread runs it: no thread of yours sits waiting. Events that arrive before the handler starts are <b>merged</b> into one run, and one source never runs its handler twice at once.' }),
              ctx.ui.code(`
s = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,   // watch a timer...
                           0, 0, q);                     // ...handlers go to q
dispatch_source_set_timer(s, start, 30*NSEC_PER_SEC, 0); // from start, every 30 s
dispatch_source_set_event_handler(s, ^{ autosave(); });  // the handler block
dispatch_resume(s);                                      // start watching`, { lang: 'c', nums: false, fontSize: 12.5 }),
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'xs muted b' }, 'FIRE AN EVENT:'), ...btns),
              h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'xs muted b', style: { flex: 'none' } }, 'QUEUE q (GLOBAL)'), qBox),
              runBox, log));
          }
          const tabs = ctx.ui.tabs([{ label: 'The queues an app gets', render: queueMap }, { label: 'Dispatch sources', render: sources }]);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Blocks wait in a <span class="t">dispatch queue</span> until GCD hands them to a thread. Every queue is <span class="t" data-t="FIFO (first in, first out)">FIFO</span>: first in, first out.' }),
              h('div', { class: 'card tight proc' }, h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'chip proc' }, 'serial'), h('b', {}, 'One at a time')),
                h('p', { class: 'small m0 mt', html: 'A <span class="t">serial queue</span> takes the next block only after the current one finishes. Strictly in order, never together.' })),
              h('div', { class: 'card tight cpu' }, h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'chip cpu' }, 'concurrent'), h('b', {}, 'Start in order, run together')),
                h('p', { class: 'small m0 mt', html: 'A <span class="t">concurrent queue</span> hands out the next block as soon as a pool thread is free, without waiting for earlier ones to finish. Blocks <b>start</b> in FIFO order but may overlap and <b>finish</b> in any order.' })),
              h('div', { class: 'callout why m0 small', 'data-label': 'A queue instead of a lock', html: 'Send every read and update of some shared data through one serial queue, and two updates can never overlap. The queue itself does the job a lock would do.' }),
              h('div', { class: 'card tight small' }, h('h4', {}, 'Two ways to hand over a block'),
                h('div', { html: '<code>dispatch_async(q, blk)</code> adds the block and returns at once; your code keeps going. <code>dispatch_sync(q, blk)</code> waits until the block has run. GCD code mostly uses <span class="t">dispatch_async</span>.' }))),
            tabs));
        },
      },

      /* ---------------- 5. Lab: a dispatch queue simulator ---------------- */
      {
        title: 'Lab: run blocks through a serial or a concurrent queue',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const NAR = ctx.narrow;
          const VW = NAR ? 420 : 760, LX = NAR ? 54 : 70, GX0 = LX + 6, GX1 = VW - 12;
          const QY = 22, TW = NAR ? 30 : 56, TH = 32, LT = 80, LH = 264, AX = LT + LH + 4, VH = AX + 24;
          const RATE = 300; // simulated ms per real second
          const EXAMPLE = () => [{ dur: 300, sh: true }, { dur: 100 }, { dur: 200 }, { dur: 100, sh: true }, { dur: 300 }, { dur: 200 }];
          let blocks = EXAMPLE(), mode = 'serial', cores = 4, t = 0, playing = false, stopRaf = null, nextSh = false;
          let S = gcdSchedule(blocks, mode, cores);
          const done = [false, false, false, false];
          let raceSeen = false; // goal 4 has two parts: first see a race, then prevent it
          const GOALS = ['<b>Serial</b> queue on <b>4+ cores</b>: run to the end and watch the other cores', 'Make blocks <b>finish</b> in a different order than they <b>started</b>', 'Finish <b>6+ blocks</b> at least <b>3× faster</b> than one at a time', 'Let two <b>◆</b> blocks <b>race</b>, then prevent the race on <b>2+ cores</b> by changing only the queue type'];
          const svg = s('svg', { viewBox: `0 0 ${VW} ${VH}`, width: '100%', role: 'img', 'aria-label': 'Queue contents and a timeline of which core ran which block' });
          const TS = () => Math.max(S.total, 400);
          const X = (tm) => GX0 + (tm / TS()) * (GX1 - GX0);
          const nm = (o) => LETTERS[o.i] + (o.b.sh ? '◆' : '');
          const started = (o) => t > 0 && o.start <= t;
          function draw() {
            const k = [];
            const lh = Math.min(62, LH / cores), labels = [];
            k.push(s('text', { x: 0, y: 14, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, (mode === 'serial' ? 'SERIAL' : 'CONCURRENT') + ' QUEUE · FIFO · the front is on the left'));
            k.push(s('rect', { x: 1, y: QY, width: VW - 2, height: TH + 12, rx: 10, class: 's-panel', 'stroke-dasharray': '5 4' }));
            const waiting = S.out.filter((o) => !started(o));
            if (!waiting.length) k.push(s('text', { x: 14, y: QY + TH / 2 + 11, 'font-size': 13.5, class: 's-sub' }, blocks.length ? 'empty: every block has been handed to a thread' : 'empty: add blocks with the buttons above'));
            waiting.forEach((o, j) => {
              const x = 7 + j * (TW + 5), y = QY + 6;
              k.push(s('rect', { x, y, width: TW, height: TH, rx: 7, class: 's-' + TILE[o.i % TILE.length], 'stroke-width': 2 }));
              k.push(s('text', { x: x + TW / 2, y: y + TH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, NAR ? LETTERS[o.i] : nm(o) + ' ' + o.b.dur));
            });
            for (let c = 0; c < cores; c++) {
              const y = LT + c * lh;
              k.push(s('rect', { x: GX0, y: y + 2, width: GX1 - GX0, height: lh - 4, rx: 6, class: 's-panel', 'stroke-width': 1 }));
              k.push(s('text', { x: LX - 2, y: y + lh / 2 + (lh >= 40 ? -3 : 5), 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'core ' + (c + 1)));
              if (lh >= 40) k.push(s('text', { x: LX - 2, y: y + lh / 2 + 13, 'text-anchor': 'end', 'font-size': 13, style: 'fill:var(--thread)' }, 'thread ' + (c + 1)));
              if (blocks.length && !S.out.some((o) => o.lane === c)) k.push(s('text', { x: GX0 + 10, y: y + lh / 2 + 5, 'font-size': 13, class: 's-sub' }, mode === 'serial' ? 'idle: a serial queue runs only one block at a time' : 'idle: no block left for this thread'));
            }
            S.out.forEach((o) => {
              if (!started(o)) return;
              const y = LT + o.lane * lh, x0 = X(o.start), x1 = X(Math.min(t, o.end)), run = t < o.end;
              k.push(s('rect', { x: x0 + 1, y: y + 5, width: Math.max(3, x1 - x0 - 2), height: lh - 10, rx: 5, class: 's-' + TILE[o.i % TILE.length] + (run ? ' pulse' : ''), 'stroke-width': run ? 3 : 1.5 }));
              if (x1 - x0 > 26 && lh >= 22) labels.push(s('text', { x: (x0 + x1) / 2, y: y + lh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, nm(o)));
            });
            S.races.forEach(([a, c]) => {
              const A = S.out[a], B = S.out[c], r0 = Math.max(A.start, B.start), r1 = Math.min(A.end, B.end, t);
              if (t <= 0 || r1 <= r0) return;
              [A, B].forEach((o) => k.push(s('rect', { x: X(r0), y: LT + o.lane * lh + 3, width: X(r1) - X(r0), height: lh - 6, rx: 4, class: 's-intr', 'fill-opacity': 0.3, 'stroke-width': 2.5, 'stroke-dasharray': '5 3' })));
            });
            k.push(...labels);
            const stp = TS() <= 1200 ? 100 : TS() <= 2400 ? 200 : 300, px = ((GX1 - GX0) * stp) / TS(), every = Math.ceil(40 / px);
            k.push(s('line', { x1: GX0, y1: AX, x2: GX1, y2: AX, class: 's-line', 'stroke-width': 1.5 }));
            k.push(s('text', { x: LX - 2, y: AX + 18, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'ms'));
            for (let m = 0, j = 0; m <= TS() + 1e-9; m += stp, j++) {
              k.push(s('line', { x1: X(m), y1: AX, x2: X(m), y2: AX + 5, class: 's-line', 'stroke-width': 1.5 }));
              if (j % every === 0) k.push(s('text', { x: X(m), y: AX + 19, 'text-anchor': X(m) > GX1 - 16 ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, String(m)));
            }
            if (t > 0 && blocks.length) {
              const fin = t >= S.makespan;
              k.push(s('line', { x1: X(t), y1: LT - 4, x2: X(t), y2: AX, style: `stroke:var(${fin ? '--ok' : '--accent'})`, 'stroke-width': 2.5, 'stroke-dasharray': fin ? '6 4' : '' }));
              k.push(s('text', { x: Math.min(X(t), GX1 - 4), y: LT - 8, 'text-anchor': X(t) > GX1 - 80 ? 'end' : 'middle', 'font-size': 13, 'font-weight': 800, style: `fill:var(${fin ? '--ok' : '--accent'})` }, fin ? `all done at ${S.makespan} ms` : Math.round(t) + ' ms'));
            }
            svg.replaceChildren(...k);
          }
          /* side panel */
          const goalEls = GOALS.map((g) => h('li', {}, h('span', { class: 'gck' }), h('span', { html: g })));
          const tNow = h('span', { class: 'big num', style: { fontSize: '26px' } });
          const stRow = h('div', { class: 'row ord' }), fnRow = h('div', { class: 'row ord' });
          const cap = h('div', { class: 'cap grow', style: { overflow: 'hidden' } });
          const tileOf = (i) => h('span', { class: 'tile sm ' + TILE[i % TILE.length] }, LETTERS[i]);
          function narrate() {
            if (!blocks.length) return 'The queue is empty. Add blocks with the buttons above the timeline.';
            if (t <= 0) return mode === 'serial'
              ? `<b>Ready.</b> Each tile is a <span class="t" data-t="Block (GCD)">block</span>, a piece of work waiting in a <span class="t">dispatch queue</span>. A serial queue hands the pool <b>one block at a time</b>: ${blocks.length > 1 ? 'B cannot start until A has finished' : 'the next block would wait for A'}, even with ${cores} core${cores > 1 ? 's' : ''} free. (Any free pool thread may run each block; this lab draws them all on thread 1.) Press <b>Run</b> or <b>Next event</b>.`
              : `<b>Ready.</b> Each tile is a <span class="t" data-t="Block (GCD)">block</span>, a piece of work waiting in a <span class="t">dispatch queue</span>. A concurrent queue hands the front block to <b>any free thread</b>, so up to ${Math.min(cores, blocks.length)} block${Math.min(cores, blocks.length) > 1 ? 's' : ''} can run at once. Press <b>Run</b> or <b>Next event</b>.`;
            const races = S.races.filter(([a, c]) => Math.max(S.out[a].start, S.out[c].start) < Math.min(S.out[a].end, S.out[c].end, t));
            const raceTxt = races.length ? ` <span style="color:var(--bad)"><b>Race:</b> ${races.map(([a, c]) => nm(S.out[a]) + ' and ' + nm(S.out[c])).join(', ')} overlapped on shared data (a <span class="t">race condition</span>).</span>` : '';
            if (t >= S.makespan) {
              const sp = S.total / S.makespan, nSh = blocks.filter((b) => b.sh).length;
              if (mode === 'serial') return `<b>All ${blocks.length} blocks done at ${S.makespan} ms</b>: the sum of their times, since only one ran at a time.` +
                (cores > 1 ? ` The other ${cores - 1} core${cores === 2 ? '' : 's'} did nothing for this queue.` : '') +
                (nSh >= 2 ? ' But the ◆ blocks could never overlap, so the shared data was safe: the queue did the job of a lock.' : '');
              return `<b>All ${blocks.length} blocks done at ${S.makespan} ms</b>: ${ctx.util.fmt(sp, 1)}× faster than one at a time (${S.total} ms). ` +
                (S.finishOrder.some((v, j) => v !== j) ? 'They started in FIFO order but finished in a different order.' : 'This time they finished in the order they started.') + raceTxt +
                (races.length && !done[3] ? ' Now prevent it without removing cores.' : '');
            }
            const e = S.events.filter((x) => x <= t + 1e-9).pop();
            const fin = S.out.filter((o) => o.end === e).map((o) => `<b>${nm(o)}</b> finished on core ${o.lane + 1}`);
            const st = S.out.filter((o) => o.start === e).map((o) => `<b>${nm(o)}</b> started on core ${o.lane + 1}`);
            return `<b>At ${e} ms:</b> ` + [...fin, ...st].join('; ') + '.' + (st.length && e > 0 ? ' Each came from the front of the queue (FIFO).' : '') + raceTxt;
          }
          function paint() {
            draw();
            tNow.textContent = Math.round(t) + ' ms';
            stRow.replaceChildren(...S.out.filter(started).map((o) => tileOf(o.i)));
            fnRow.replaceChildren(...S.finishOrder.filter((i) => t > 0 && S.out[i].end <= t).map(tileOf));
            goalEls.forEach((g, i) => g.classList.toggle('ok', done[i]));
            goalEls[3].lastChild.innerHTML = GOALS[3] + (raceSeen && !done[3] ? ' <b style="color:var(--bad)">(race seen)</b>' : '');
            cap.innerHTML = narrate();
            bRun.textContent = playing ? 'Pause' : t > 0 && t >= S.makespan ? 'Run again' : t > 0 ? 'Resume' : 'Run';
          }
          function arrive() {
            const n = blocks.length;
            if (!n) return;
            if (S.races.length) raceSeen = true;
            const ok = [mode === 'serial' && cores >= 4 && n >= 3, S.finishOrder.some((v, j) => v !== j), n >= 6 && S.total / S.makespan >= 3 - 1e-9,
              raceSeen && mode === 'serial' && cores >= 2 && blocks.filter((b) => b.sh).length >= 2 && !S.races.length];
            const fresh = [];
            ok.forEach((v, i) => { if (v && !done[i]) { done[i] = true; fresh.push(i + 1); } });
            if (fresh.length) ctx.toast((fresh.length > 1 ? 'Goals ' : 'Goal ') + fresh.join(' and ') + ' complete' + (done.every(Boolean) ? '. All four done!' : ''));
          }
          function stop() { playing = false; if (stopRaf) { stopRaf(); stopRaf = null; } }
          function play() {
            if (!blocks.length) return;
            if (t >= S.makespan) t = 0;
            playing = true;
            let last = null;
            stopRaf = ctx.raf((now) => {
              if (last == null) last = now;
              t = Math.min(S.makespan, Math.max(t, 1e-3) + ((now - last) / 1000) * RATE);
              last = now;
              if (t >= S.makespan) { playing = false; stopRaf = null; arrive(); paint(); return false; }
              paint();
            });
            paint();
          }
          function nextEvent() {
            stop();
            if (!blocks.length) return;
            if (t >= S.makespan) t = 0;
            else if (t === 0) t = 1e-3;
            else t = S.events.find((x) => x > t + 1e-9);
            if (t >= S.makespan) arrive();
            paint();
          }
          function reconfig() { stop(); t = 0; S = gcdSchedule(blocks, mode, cores); paint(); }
          function add(d) { if (blocks.length >= 12) { ctx.toast('Twelve blocks is the limit in this lab.'); return; } blocks.push({ dur: d, sh: nextSh }); reconfig(); }
          const bRun = h('button', { type: 'button', class: 'btn sm primary', onclick: () => (playing ? (stop(), paint()) : play()) });
          const shBtn = h('button', { type: 'button', class: 'btn sm', title: 'The next block you add will change shared data', onclick: () => { nextSh = !nextSh; shBtn.classList.toggle('on', nextSh); } }, '◆ shared data');
          const segMode = ctx.ui.seg([{ value: 'serial', label: 'Serial queue' }, { value: 'concurrent', label: 'Concurrent queue' }], mode, (v) => { mode = v; reconfig(); });
          const slCores = ctx.ui.slider({ label: 'Cores', min: 1, max: 8, value: cores, onInput: (v) => { cores = v; reconfig(); } });
          slCores.style.minWidth = NAR ? '100%' : '250px';
          paint();
          el.append(h('div', { class: 'labgrid fill', style: NAR ? { gridTemplateColumns: '1fr' } : null },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('div', { class: 'ctl', style: { gap: '14px' } }, segMode, slCores),
              h('div', { class: 'ctl', style: { gap: '6px' } }, h('span', { class: 'lbl' }, 'Add a block:'), ...[100, 200, 300].map((d) => h('button', { type: 'button', class: 'btn sm', onclick: () => add(d) }, `+ ${d} ms`)), shBtn,
                h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { blocks = []; reconfig(); } }, 'Clear'),
                h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { blocks = EXAMPLE(); reconfig(); } }, 'Example set')),
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),
              h('div', { class: 'ctl', style: { gap: '6px' } }, bRun,
                h('button', { type: 'button', class: 'btn sm', onclick: nextEvent }, 'Next event ▸'),
                h('button', { type: 'button', class: 'btn sm', onclick: () => { stop(); if (blocks.length) { t = S.makespan; arrive(); } paint(); } }, 'Skip to end'),
                h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { stop(); t = 0; paint(); } }, 'Reset'),
                h('span', { class: 'xs muted', style: { marginLeft: '6px' } }, '◆ = changes shared data · thick outline = running now'))),
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('div', { class: 'card tight' }, h('h4', {}, 'Goals'), h('ol', { class: 'goals' }, ...goalEls)),
              h('div', { class: 'card tight stack gap-s' },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'CLOCK'), tNow),
                h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'xs muted b', style: { width: '62px', flex: 'none' } }, 'STARTED'), stRow),
                h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'xs muted b', style: { width: '62px', flex: 'none' } }, 'FINISHED'), fnRow)),
              cap)));
        },
      },

      /* ---------------- 6. Predict: which output orders are possible? ---------------- */
      {
        title: 'Predict: which print orders can really happen?',
        kind: 'predict',
        render(el, ctx) {
          const { h } = ctx;
          const PUZ = [
            { nm: 'Serial', setup: 'Three blocks go into one <b>serial</b> queue. Each prints a letter when it finishes its work.',
              code: `
// q is a SERIAL queue
dispatch_async(q, ^{ work(300); print("A"); }); // 300 ms, then A
dispatch_async(q, ^{ print("B"); });            // B at once
dispatch_async(q, ^{ work(50); print("C"); });  // 50 ms, then C`,
              cands: [['A B C', true, 'Each block finishes before the next one starts, so this is the only possible order.'],
                ['B C A', false, 'B is behind A, and a serial queue will not start B until A has finished, however slow A is.'],
                ['A C B', false, 'B was queued before C, so B runs (and prints) before C even starts.'],
                ['C B A', false, 'C is last in line; it cannot start until A and B are both done.']],
              pic: [['q', 'serial', 'ABC', 'one pool thread at a time']],
              hint: 'Ask yourself: can this queue start B while A is still running?',
              sum: 'A serial queue is first in, first out <b>and</b> one at a time, so the print order always equals the order of submission. The durations do not matter at all.' },
            { nm: 'Concurrent', setup: 'The same three blocks go into a <b>global concurrent</b> queue on a 4-core Mac.',
              code: `
// g is a global (concurrent) queue
dispatch_async(g, ^{ work(300); print("A"); }); // 300 ms, then A
dispatch_async(g, ^{ print("B"); });            // B at once
dispatch_async(g, ^{ work(50); print("C"); });  // 50 ms, then C`,
              cands: [['B C A', true, 'The most likely order: B has no work, C a little, A the most.'],
                ['C B A', true, 'B and C run at the same time on different threads, so either may print first.'],
                ['B A C', true, 'Unlikely but allowed: if C’s thread is paused by the kernel, A can overtake it.'],
                ['A B C', true, 'Unlikely but allowed: a busy machine can delay the threads running B and C.']],
              pic: [['g', 'concurrent', 'ABC', 'any free pool threads, side by side']],
              hint: 'Once a block has left a concurrent queue, does GCD wait for it to finish before handing out the next one?',
              sum: 'A concurrent queue only promises that A, B and C are <b>taken off</b> the queue in that order. After that they run side by side and may finish in any order; durations make some orders likelier, never certain.' },
            { nm: 'Two queues', setup: 'Blocks go into two different queues: a <b>serial</b> queue s and a <b>concurrent</b> queue g.',
              code: `
// s is a SERIAL queue; g is a global queue
dispatch_async(s, ^{ print("A"); }); // A goes into s
dispatch_async(g, ^{ print("C"); }); // C goes into g
dispatch_async(s, ^{ print("B"); }); // B waits behind A in s`,
              cands: [['A C B', true, 'A runs, C runs on another thread, then B follows A.'],
                ['C A B', true, 'C is on a different queue, so nothing stops it from printing first.'],
                ['B A C', false, 'B is behind A in the same serial queue, so A must print before B.'],
                ['C B A', false, 'Again B before A: impossible while they share a serial queue.']],
              pic: [['s', 'serial', 'AB', 'one pool thread at a time'], ['g', 'concurrent', 'C', 'any free pool thread']],
              hint: 'Which blocks share a queue? Only blocks in the same serial queue are ordered with respect to each other.',
              sum: 'Order is promised only <b>within</b> one serial queue: A must come before B. C, on another queue, may land anywhere, so A B C, A C B and C A B are all possible.' },
            { nm: 'Round trip', setup: 'This code runs <b>on the main thread</b>, inside a button handler. <code>main</code> stands for the main queue.',
              code: `
print("1");                 // prints immediately
dispatch_async(g, ^{        // queue a block on a global queue
    print("2");             // runs later, on a pool thread
    dispatch_async(main, ^{ // queue a block on the main queue
        print("3");         // needs the main thread
    });                     // end of the main-queue block
});                         // end of the global-queue block
print("4");                 // the handler carries on at once`,
              cands: [['1 4 2 3', true, 'The handler reaches 4 before the pool thread gets going; 3 runs once the main thread is free.'],
                ['1 2 4 3', true, 'The pool thread can print 2 before the handler reaches line 8. 3 still waits for the handler to return.'],
                ['1 2 3 4', false, '3 must run on the main thread, which is still busy with this handler. It can only run after 4.'],
                ['4 1 2 3', false, 'Lines 1 and 8 run on the same thread in program order, so 1 always comes before 4.']],
              pic: [['g', 'concurrent', '2', 'any free pool thread'], ['main', 'serial', '3', 'only the main thread']],
              hint: 'Which thread runs blocks from the main queue, and what is that thread busy doing when line 8 runs?',
              sum: '<code>dispatch_async</code> never waits, so line 8 is not held up. But the main queue is serial and served only by the main thread, so 3 cannot start until the handler (which prints 4) has returned.' },
          ];
          let p = 0;
          const ans = PUZ.map((pz) => pz.cands.map(() => null)), checked = PUZ.map(() => false);
          const setup = h('p', { class: 'm0' }), codeBox = h('div'), sumBox = h('div'), candBox = h('div', { class: 'stack gap-s', style: { flex: 'none' } }), score = h('span', { class: 'b' });
          const hintBox = h('div');
          // shown only before checking: the only three guarantees that can rule an order out
          const rules = h('div', { class: 'card tight stack gap-s' }, h('h4', {}, 'How to decide: only these guarantees make an order impossible'),
            h('ol', { class: 'small m0', style: { paddingLeft: '20px' }, html: '<li>Blocks in the <b>same serial queue</b> run one at a time, in queued order.</li><li>Lines on <b>one thread</b> run in program order.</li><li>A <b>main-queue</b> block waits until the main thread is free.</li>' }),
            hintBox);
          const picBox = h('div', { class: 'card tight qpics' });
          // one row per queue in the puzzle: name + kind, its blocks (front on the right), and who serves it
          const qpRow = ([nm, kind, tiles, to]) => h('div', { class: 'qp', style: ctx.narrow ? { gridTemplateColumns: 'max-content max-content 14px minmax(0,1fr)' } : null },
            h('span', { class: 'nmq' }, nm, h('span', { class: 'chip ' + (kind === 'serial' ? 'proc' : 'cpu') }, kind)),
            h('div', { class: 'qline' }, ...[...tiles].map((c) => h('span', { class: 'tile sm ' + TILE[('ABC123'.indexOf(c) + 3) % TILE.length] }, c))),
            h('span', { class: 'qarr' }, '→'),
            h('span', { class: 'small' }, to));
          const bCheck = h('button', { type: 'button', class: 'btn primary', onclick: () => { checked[p] = true; paint(); } }, 'Check my answers');
          const bAgain = h('button', { type: 'button', class: 'btn', onclick: () => { checked[p] = false; ans[p] = ans[p].map(() => null); paint(); } }, 'Try again');
          const seg = ctx.ui.seg(PUZ.map((pz, i) => ({ value: i, label: `${i + 1} · ${pz.nm}` })), 0, (v) => { p = v; paint(); });
          const pick = (i, v) => { if (checked[p]) return; ans[p][i] = v; paint(); };
          function paint() {
            const pz = PUZ[p], ck = checked[p];
            setup.innerHTML = pz.setup;
            picBox.replaceChildren(h('div', { class: 'xs muted b' }, 'WHO RUNS WHAT · front of each queue on the right'), ...pz.pic.map(qpRow));
            codeBox.replaceChildren(ctx.ui.code(pz.code, { lang: 'c', fontSize: 13 }));
            candBox.replaceChildren(...pz.cands.map((c, i) => {
              const mine = ans[p][i], right = ck ? mine === c[1] : null;
              return h('div', { class: 'cand' + (right === true ? ' right' : right === false ? ' wrong' : '') },
                h('div', { class: 'row nw', style: { justifyContent: 'space-between' } },
                  h('span', { class: 'ordtxt' }, c[0]),
                  h('div', { class: 'row nw', style: { gap: '4px' } },
                    h('button', { type: 'button', class: 'btn sm' + (mine === true ? ' on' : ''), disabled: ck, onclick: () => pick(i, true) }, 'Possible'),
                    h('button', { type: 'button', class: 'btn sm' + (mine === false ? ' on' : ''), disabled: ck, onclick: () => pick(i, false) }, 'Impossible'))),
                ck ? h('div', { class: 'small', style: { marginTop: '4px' }, html: `<b style="color:var(--${right ? 'ok' : 'bad'})">${right ? '✓' : '✗'} ${c[1] ? 'Possible.' : 'Impossible.'}</b> ${c[2]}` }) : null);
            }));
            const all = ans[p].every((v) => v !== null);
            bCheck.disabled = !all || ck;
            bCheck.style.display = ck ? 'none' : '';
            bAgain.style.display = ck ? '' : 'none';
            const nRight = pz.cands.filter((c, i) => ans[p][i] === c[1]).length;
            score.textContent = ck ? `${nRight} of ${pz.cands.length} right` : all ? 'Ready to check' : `${ans[p].filter((v) => v !== null).length} of ${pz.cands.length} decided`;
            hintBox.replaceChildren(...(ck ? [] : [ctx.ui.reveal('Show a hint', `<p class="small m0">${pz.hint}</p>`)]));
            hintBox.style.display = ck ? 'none' : '';
            rules.style.display = ck ? 'none' : '';
            // solved puzzles get a tick on their tab instead of a separate panel (keeps the checked view inside the canvas)
            [...seg.children].forEach((b, j) => {
              const ok = checked[j] && PUZ[j].cands.every((c, i) => ans[j][i] === c[1]);
              b.innerHTML = (ok ? '<span style="color:var(--ok)">✓</span> ' : '') + `${j + 1} · ${PUZ[j].nm}`;
            });
            sumBox.replaceChildren(ck ? h('div', { class: 'callout tip m0 small', 'data-label': 'The rule behind it', html: pz.sum }) : h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Assuming the shortest block always prints first. Durations make an order <b>likely</b>, never guaranteed: a thread can be paused at any moment. Only a queue’s rules or program order can rule an order out.' }));
          }
          paint();
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack' }, seg, setup, codeBox, picBox, sumBox),
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Can each order <b>ever</b> happen, even rarely?' }),
              candBox,
              h('div', { class: 'row' }, bCheck, bAgain, score),
              rules)));
        },
      },

      /* ---------------- 7. Explore: slow work off the main thread, result back to the main queue ---------------- */
      {
        title: 'The classic pattern: analyse a document, keep the app alive',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const CODE = {
            gcd: `
void onAnalyze(Doc *doc) {                 // main thread: user clicked
  dispatch_queue_t q =                     // choose a queue:
    dispatch_get_global_queue(             //   a shared concurrent one
      DISPATCH_QUEUE_PRIORITY_DEFAULT, 0); //   at default priority
  dispatch_async(q, ^{                     // queue the work, do not wait
    Stats st = analyze(doc);               // pool thread: the slow part
    dispatch_async(                        // send the result back...
      dispatch_get_main_queue(), ^{        // ...to the main queue
        showStats(st);                     // main thread: update window
      });                                  // end of the UI block
  });                                      // end of the work block
}                                          // handler returns at once`,
            naive: `
void onAnalyze(Doc *doc) {                 // main thread: user clicked
  Stats st = analyze(doc);                 // slow work ON the main thread
  showStats(st);                           // update the window
}                                          // only now can events run`,
          };
          // m = main thread, p = pool thread, gq / mq = contents of global / main queue, prog = analysis %, ui = can the app react?
          const F = {
            gcd: [
              { ln: [1], m: 'running onAnalyze()', p: 'idle', gq: '', mq: '', prog: 0, ui: true, cap: 'The user clicks <b>Analyze</b>. Clicks are events, and events are handled on the <b>main thread</b>, so it starts running the handler.' },
              { ln: [2, 3, 4], m: 'running onAnalyze()', p: 'idle', gq: '', mq: '', prog: 0, ui: true, cap: 'The handler picks a <b>global queue</b> at default priority: a concurrent queue that the whole app shares.' },
              { ln: [5], m: 'running onAnalyze()', p: 'idle', gq: 'analyze block', mq: '', prog: 0, ui: true, cap: '<b>dispatch_async</b> puts the analysis block on that queue and <b>returns immediately</b>. It does not wait for the block to run.' },
              { ln: [12], m: 'idle: waiting for events', p: 'took the analyze block', gq: '', mq: '', prog: 0, ui: true, cap: 'The handler returns at once, so the main thread is back in its event loop. A pool thread has taken the block off the global queue.' },
              { ln: [6], m: 'free: handles your scrolls', p: 'analyze(doc) …', gq: '', mq: '', prog: 40, ui: true, cap: 'The pool thread runs <b>analyze(doc)</b>, the slow part (it could take seconds). Press <b>Scroll</b> in the window: the main thread is free, so it reacts.' },
              { ln: [6], m: 'free: handles your scrolls', p: 'analyze(doc) …', gq: '', mq: '', prog: 80, ui: true, cap: 'Still analysing on the pool thread. The user can keep scrolling, typing or even press Cancel.' },
              { ln: [7, 8], m: 'free: handles your scrolls', p: 'dispatch_async(main queue)', gq: '', mq: 'showStats block', prog: 100, ui: true, cap: 'Analysis done. Window code must run on the main thread, so the block sends a <b>second block</b>, showStats, to the <b>main queue</b>. It does not wait for it.' },
              { ln: [10, 11], m: 'free: handles your scrolls', p: 'idle: back in the pool', gq: '', mq: 'showStats block', prog: 100, ui: true, cap: 'The analysis block ends and its thread goes back to the pool, ready for other work. The captured <code>st</code> travels inside the UI block.' },
              { ln: [9], m: 'running showStats()', p: 'idle', gq: '', mq: '', prog: 100, ui: true, stats: true, cap: 'Between two events, the main thread takes the UI block from the main queue and runs <b>showStats</b>: the results appear.' },
              { ln: [], m: 'idle: waiting for events', p: 'idle', gq: '', mq: '', prog: 100, ui: true, stats: true, cap: '<b>Done.</b> The main thread was never busy for more than a moment, so the app never froze. This two-hop pattern is how GCD code keeps apps responsive.' },
            ],
            naive: [
              { ln: [1], m: 'running onAnalyze()', p: 'idle (unused)', gq: '', mq: '', prog: 0, ui: true, cap: 'The user clicks <b>Analyze</b>, and the main thread starts running the handler.' },
              { ln: [2], m: 'stuck in analyze(doc)', p: 'idle (unused)', gq: '', mq: '', prog: 35, ui: false, cap: 'This version calls <b>analyze(doc)</b> directly, <b>on the main thread</b>. Until it returns, no event can be handled. Press <b>Scroll</b> and see.' },
              { ln: [2], m: 'stuck in analyze(doc)', p: 'idle (unused)', gq: '', mq: '', prog: 75, ui: false, cap: 'Still analysing. The system notices the app has stopped answering events and shows the <b>spinning wait cursor</b>. Every click just piles up.' },
              { ln: [3], m: 'running showStats()', p: 'idle (unused)', gq: '', mq: '', prog: 100, ui: false, stats: true, cap: 'Finally the analysis returns and showStats updates the window, still inside the same handler.' },
              { ln: [4], m: 'idle: catching up', p: 'idle (unused)', gq: '', mq: '', prog: 100, ui: true, stats: true, cap: 'Only now does the handler return. Any scrolls that piled up are handled all at once. The app was frozen for the whole analysis, and the other cores did nothing.' },
            ],
          };
          /* per-thread timeline (time 0..10) and where each frame sits on it */
          const TL = {
            gcd: { main: [[0, 1.25, 'handler', 's-thread'], [1.25, 7.8, 'free: answers every event', 's-ok'], [7.8, 9.6, 'showStats', 's-thread'], [9.6, 10, '', 's-ok']], pool: [[1.25, 7.4, 'analyze(doc)', 's-os']],
              at: [0.25, 0.6, 0.95, 1.4, 3.2, 6, 7.3, 7.6, 8.7, 10] },
            naive: { main: [[0, 0.5, '', 's-thread'], [0.5, 7.8, 'analyze(doc): app frozen', 's-bad'], [7.8, 9.6, 'showStats', 's-thread'], [9.6, 10, '', 's-ok']], pool: [],
              at: [0.3, 3, 6, 8.7, 9.8] },
          };
          // phones get a narrower drawing (so 13px text stays readable) with shorter row names and segment labels
          const NW = ctx.narrow, TVW = NW ? 360 : 600, TX0 = NW ? 46 : 104, TU = NW ? 31 : 48.5;
          const SHORT = { handler: '', 'free: answers every event': 'free', showStats: 'show', 'analyze(doc): app frozen': 'app frozen' };
          const fitLabel = (t, w) => (t.length * 7.6 <= w - 6 ? t : SHORT[t] != null && SHORT[t].length * 7.6 <= w - 6 ? SHORT[t] : '');
          const tl = ctx.s('svg', { viewBox: `0 0 ${TVW} 70`, width: '100%', role: 'img', 'aria-label': 'What the main thread and a pool thread do over time' });
          function drawTL(i) {
            const T = TL[mode], X = (v) => TX0 + v * TU, k = [];
            [['main thread', T.main, 2], ['pool thread', T.pool, 38]].forEach(([nm, segs, y]) => {
              k.push(ctx.s('text', { x: TX0 - 8, y: y + 21, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700, style: `fill:var(${nm === 'main thread' ? '--thread' : '--os'})` }, NW ? nm.split(' ')[0] : nm));
              k.push(ctx.s('rect', { x: X(0), y, width: X(10) - X(0), height: 30, rx: 6, class: 's-panel', 'stroke-width': 1 }));
              if (!segs.length) k.push(ctx.s('text', { x: X(0) + 10, y: y + 20, 'font-size': 13, class: 's-sub' }, 'never used'));
              segs.forEach(([a, b, t, c]) => {
                k.push(ctx.s('rect', { x: X(a) + 1, y: y + 3, width: X(b) - X(a) - 2, height: 24, rx: 5, class: c, 'stroke-width': 1.5 }));
                const lab = t && fitLabel(t, X(b) - X(a));
                if (lab) k.push(ctx.s('text', { x: (X(a) + X(b)) / 2, y: y + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, lab));
              });
            });
            const x = X(T.at[i]);
            k.push(ctx.s('line', { x1: x, y1: 0, x2: x, y2: 70, style: 'stroke:var(--accent)', 'stroke-width': 2.5 }));
            tl.replaceChildren(...k);
          }
          const mistake = h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Doing slow work (reading big files, waiting for the network, long calculations) straight inside an event handler. The app freezes, and the other cores sit idle.' });
          let mode = 'gcd', handled = 0, waiting = 0, cur = F.gcd[0];
          const codeBox = h('div');
          let code = null;
          const docLines = h('div', { class: 'doclines' });
          const statusEl = h('div', { class: 'small' }), bar = h('div', { class: 'meter' }, h('i'));
          const freeze = h('div', { class: 'freeze' }, h('span', { class: 'spin' }), h('b', {}, 'Not responding'));
          const mEl = h('span', { class: 'b' }), pEl = h('span', { class: 'b' }), gqEl = h('span'), mqEl = h('span'), scrollInfo = h('div', { class: 'small' });
          function paintDoc() {
            docLines.replaceChildren(...ctx.util.range(5).map((k) => h('div', { class: 'dl', style: { width: (55 + ((k + handled) * 37) % 40) + '%' } })));
            scrollInfo.innerHTML = `Scrolls handled: <b>${handled}</b> · waiting in line: <b style="color:var(${waiting ? '--bad' : '--ink'})">${waiting}</b>`;
          }
          function draw(i) {
            const f = F[mode][i];
            cur = f;
            code.clear(); if (f.ln.length) code.mark(f.ln);
            if (f.ui && waiting) { handled += waiting; waiting = 0; }
            paintDoc();
            statusEl.innerHTML = f.stats ? '<b>Words 12,408 · Sentences 731 · Reading level: grade 9</b>' : f.prog ? `Analysing… ${f.prog}%` : 'Press Analyze to count words and sentences.';
            bar.firstChild.style.width = f.prog + '%';
            freeze.style.display = f.ui ? 'none' : 'flex';
            mEl.textContent = f.m; mEl.style.color = f.ui ? 'var(--ok)' : 'var(--bad)';
            pEl.textContent = f.p;
            const chip = (t, c) => (t ? h('span', { class: 'chip ' + c }, t) : h('span', { class: 'xs muted' }, 'empty'));
            gqEl.replaceChildren(chip(f.gq, 'os')); mqEl.replaceChildren(chip(f.mq, 'thread'));
            drawTL(i);
            mistake.style.display = mode === 'naive' ? '' : 'none';
            return f.cap;
          }
          function build() { code = ctx.ui.code(CODE[mode], { lang: 'c', fontSize: 12.5 }); codeBox.replaceChildren(code); }
          const scroll = () => {
            if (cur.ui) { handled++; paintDoc(); ctx.toast('Scrolled: the main thread handled it at once.'); }
            else { waiting++; paintDoc(); ctx.toast('Nothing moves: the main thread is stuck inside analyze().'); }
          };
          const seg = ctx.ui.seg([{ value: 'gcd', label: 'With GCD (two hops)' }, { value: 'naive', label: 'All on the main thread' }], mode, (v) => { mode = v; handled = 0; waiting = 0; build(); player.setCount(F[mode].length); });
          build();
          const player = ctx.ui.player({ count: F.gcd.length, render: draw, interval: 2000, speed: false });
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('div', { class: 'ctl' }, h('span', { class: 'lbl' }, 'Version:'), seg),
              codeBox, player.el,
              h('div', { class: 'card white tight' }, h('h4', {}, 'What each thread does over time →'), tl), mistake),
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('div', { class: 'win' },
                h('div', { class: 'win-bar' }, h('i'), h('i'), h('i'), h('span', { class: 'xs b' }, 'Essay.txt · Analyzer')),
                h('div', { class: 'win-body' }, docLines, statusEl, bar,
                  h('div', { class: 'row', style: { gap: '8px' } }, h('button', { type: 'button', class: 'btn sm', onclick: scroll }, 'Scroll ↓'), scrollInfo)),
                freeze),
              h('div', { class: 'card tight stack gap-s' },
                h('div', { class: 'lane' }, h('span', { class: 'chip thread' }, 'main thread'), mEl),
                h('div', { class: 'lane' }, h('span', { class: 'chip os' }, 'pool thread'), pEl),
                h('div', { class: 'lane' }, h('span', { class: 'xs muted b' }, 'GLOBAL QUEUE'), gqEl),
                h('div', { class: 'lane' }, h('span', { class: 'xs muted b' }, 'MAIN QUEUE'), mqEl)),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why two hops?', html: 'Slow work must leave the main thread so the app stays responsive, but window code must run on the main thread (the same rule as on Android, section 4.7). So the work goes out to a global queue, and the result comes back on the main queue. (Each <code>^{ … }</code> is a <span class="t" data-t="Block (GCD)">block</span>: a piece of work that <span class="t">dispatch_async</span> puts on a queue for a pool thread to run.)' }))));
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: six things to remember about GCD',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const code = ctx.ui.code(`
dispatch_async(global_queue, ^{    // leave the main thread
    Result r = slow_work();        // runs on a pool thread
    dispatch_async(main_queue, ^{  // come back to the main thread
        update_ui(r);              // main thread; r came along
    });                            // end of the UI block
});                                // end of the work block`, { lang: 'c', fontSize: 13 });
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Say each answer out loud, then click the card to check yourself.'),
            ctx.ui.flipcards([
              ['What does a programmer hand to GCD?', 'Tasks, written as blocks and put on dispatch queues. Never threads: GCD creates, reuses and schedules those.'],
              ['What is a block?', 'An unnamed function written with a caret, ^{ … }: an extension to C, Objective-C and C++ that captures the variables it uses (a closure).'],
              ['Serial queue or concurrent queue?', 'Both hand blocks out in FIFO order. Serial: one at a time, each finishes before the next starts. Concurrent: several at once, finishing in any order.'],
              ['What is special about the main queue?', 'It is serial and its blocks run on the main thread, which handles events and the window. Never put slow work there.'],
              ['How big is GCD’s thread pool?', 'About one worker per core (the degree of concurrency), plus extra workers while some are blocked waiting for I/O.'],
              ['What does a dispatch source do?', 'Watches for an event (a timer, a signal, a readable file descriptor, a process exiting) and queues a handler block when it happens; events that pile up first are merged into one run.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 118 }),
            h('div', { class: 'split', style: { height: 'auto', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 7fr) minmax(0, 5fr)' } },
              h('div', { class: 'card white stack gap-s' }, h('h4', {}, 'The pattern to remember'), code),
              h('div', { class: 'card stack gap-s' }, h('h4', {}, 'Where GCD fits'),
                h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'chip accent' }, 'Mac OS X 10.6 Snow Leopard'), h('span', { class: 'chip os' }, 'OS-managed thread pool'), h('span', { class: 'chip thread' }, 'blocks + queues')),
                h('p', { class: 'small m0', html: 'Thread pools are old news in servers and Windows. GCD’s contribution is the language support: blocks make a whole unit of work easy to split off, and queues keep the order and dependencies between its parts.' })))));
        },
      },

      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself: Grand Central Dispatch',
        kind: 'check',
        quiz: [
          { q: 'When a program uses Grand Central Dispatch, what does the programmer hand to the system?',
            choices: ['A number of threads to create, one for each core', 'Units of work written as blocks, placed on dispatch queues', 'A list of cores on which each thread must run', 'Finished threads that GCD only has to start'],
            answer: 1,
            feedback: ['Choosing a thread count is exactly the job GCD takes away: it sizes its own pool to the machine.', null, 'The programmer never pins work to cores; the kernel schedules GCD’s pool threads onto cores.', 'With GCD the programmer does not create threads at all; GCD creates, reuses and retires them.'],
            why: 'With GCD you name the work, not the threads. Each task is written as a block and put on a queue; GCD maps those blocks onto a pool of threads it manages, about one per core.' },
          { type: 'tf', q: 'A serial dispatch queue always runs all of its blocks on the same thread.', answer: false,
            why: 'A serial queue promises only that its blocks run one at a time, in order. Each block can be run by whichever pool thread is free, so different blocks may use different threads; they just never overlap.' },
          { q: 'Blocks A, B and C are added, in that order, to a <b>concurrent</b> dispatch queue on a 4-core machine. What does the queue guarantee?',
            choices: ['They finish in the order A, B, C', 'They run one at a time, A then B then C', 'They are started (taken off the queue) in the order A, B, C, but may run at the same time and finish in any order', 'Nothing at all: they may even be started in any order'],
            answer: 2,
            feedback: ['Finish order is not promised: a short block that started later can finish first.', 'That describes a serial queue. A concurrent queue lets several blocks run at once.', null, 'Every dispatch queue is FIFO, so the start order is guaranteed; only the finish order is open.'],
            why: 'Every dispatch queue hands blocks out first in, first out. A concurrent queue does not wait for one block to finish before handing out the next, so blocks overlap and can finish in any order.' },
          { type: 'multi', q: 'Which statements about the <b>main queue</b> are true? Select all that apply.',
            choices: ['It is a serial queue', 'Its blocks run on the application’s main thread', 'It is the right place to update the user interface', 'It is the best place for slow work, because it is always available', 'It is one of the concurrent global queues'],
            answer: [0, 1, 2],
            why: 'The main queue is serial and served by the main thread, the thread that handles events and draws the window. UI updates belong there; slow work does not, because while a block runs on it the app cannot respond. The global queues are a separate, concurrent set.' },
          { type: 'match', q: 'Match each GCD object to what it does.',
            pairs: [['Main queue', 'Serial; runs on the main thread'], ['Global queue', 'Concurrent; shared, by priority'], ['Private serial queue', 'App-made; can stand in for a lock'], ['Dispatch source', 'Turns events into queued blocks']],
            why: 'The main queue serves the user interface, the global queues run independent background work at a chosen priority (high, default, low, and background since 10.7), a private serial queue can replace a lock, and a dispatch source turns events such as timers or signals into queued blocks.' },
          { type: 'order', q: 'A button handler on the main thread uses GCD to analyse a document without freezing the app. Put the events in order.',
            items: ['The user clicks Analyze and the main thread starts running the handler', 'The handler calls dispatch_async to put an analysis block on a global queue', 'A pool thread takes the block off the queue and runs the slow analysis', 'The analysis block calls dispatch_async to put a UI block on the main queue', 'The main thread runs the UI block and shows the results'],
            why: 'Each event causes the next. dispatch_async returns at once, so the handler finishes right away and the main thread stays free while a pool thread does the slow part. The result travels back as a second block on the main queue, because window code must run on the main thread.' },
          { type: 'num', q: 'Three blocks that take 300 ms, 100 ms and 200 ms are added, in that order, to a <b>serial</b> queue on an otherwise idle 4-core machine. How many milliseconds after the first block starts does the last block finish?',
            answer: 600, tol: 0, unit: 'ms',
            why: 'A serial queue runs one block at a time no matter how many cores are free: 300 + 100 + 200 = 600 ms. The other three cores do nothing for this queue.' },
          { type: 'num', q: 'Four blocks that take 300, 100, 200 and 100 ms are added, in that order, to a <b>concurrent</b> queue served by <b>2</b> pool threads. Each time a thread becomes free it takes the block at the front of the queue. When does the last block finish (in ms)?',
            answer: 400, tol: 0, unit: 'ms',
            hint: 'At time 0 both threads take a block. Track when each thread becomes free.',
            why: 'At 0, thread 1 takes the 300 ms block and thread 2 the 100 ms block. At 100 thread 2 is free and takes the 200 ms block (busy until 300). At 300 both are free; one takes the last 100 ms block, finishing at 400 ms.' },
          { q: 'What does this code print?',
            code: 'int x = 5;               // ordinary local variable\nvoid (^show)(void) = ^{  // create a block\n    printf("%d\\n", x);   // the block uses x\n};                       // end of the block\nx = 9;                   // change x after the block exists\nshow();                  // run the block',
            choices: ['5', '9', '14', 'Nothing: the block was never queued'],
            answer: 0,
            feedback: [null, 'It would print 9 only if x were declared __block, which makes the block share x instead of copying it.', 'The block does not add anything; it prints the value of x it holds.', 'A block can be called directly, like a function; show() runs it right here.'],
            why: 'An ordinary variable used inside a block is captured by value at the moment the block is created. The block’s copy is 5; changing x afterwards does not affect it.' },
          { type: 'bucket', q: 'With GCD, who is responsible for each job?',
            buckets: ['The programmer', 'GCD and the OS'],
            items: [['Finding pieces of work that can run at the same time', 0], ['Writing each piece of work as a block', 0], ['Choosing which queue receives each block', 0], ['Deciding how many worker threads exist', 1], ['Assigning a waiting block to a free thread', 1], ['Adding workers when some are blocked on I/O', 1]],
            why: 'The programmer identifies and describes the work and chooses queues. GCD owns the thread pool: how many threads, which thread runs which block, and when to grow or shrink the pool.' },
          { q: 'This code runs on the main thread inside a button handler. <code>g</code> is a global queue and <code>main</code> is the main queue. Which output is <b>impossible</b>?',
            code: 'print("1");                                  // right away, on the main thread\ndispatch_async(g, ^{                         // queue a block on g; do not wait\n    print("2");                              // later, on a pool thread\n    dispatch_async(main, ^{ print("3"); });  // queue a block for the main thread\n});                                          // end of the g block\nprint("4");                                  // the handler carries on at once',
            choices: ['1 4 2 3', '1 2 4 3', '1 2 3 4', 'All three are possible'],
            answer: 2,
            feedback: ['Possible: the handler reaches print("4") before the pool thread prints 2.', 'Possible: the pool thread can print 2 before the handler reaches print("4"); 3 still comes last.', null, 'One of them is ruled out by where the block that prints 3 must run.'],
            why: 'The block that prints 3 sits on the main queue, which only the main thread serves. The main thread is busy running this handler, so 3 cannot print until the handler has printed 4 and returned.' },
          { type: 'tf', q: 'To react to a timer or a signal with a dispatch source, the program must dedicate one of its own threads to waiting for the event.', answer: false,
            why: 'The point of a dispatch source is that nobody waits: the system watches for the event and, when it happens, puts the handler block on the queue you chose, where a pool thread runs it. Events that arrive before the handler runs are merged into one run.' },
        ],
      },
    ],

    notes: `
<h3>1. The problem GCD solves</h3>
<p>Extra cores help only when a program splits its work into pieces that can run at the same time, and something must create threads, hand them the pieces and clean up. <b>Grand Central Dispatch (GCD)</b>, first shipped in <b>Mac OS X 10.6 (Snow Leopard)</b>, moves that job into the OS. The programmer describes <b>tasks</b> (units of work, such as analysing one document) and GCD maps them onto a <b>thread pool</b> it manages: worker threads created once and reused. The pool is sized to the <b>degree of concurrency</b> of the hardware (roughly the number of cores), plus a few extra workers while some are blocked on I/O.</p>
<ul>
<li><b>Your job:</b> find work that can run in parallel, write each piece as a <b>block</b>, and put it on a <b>dispatch queue</b>.</li>
<li><b>GCD's job:</b> decide how many threads exist, give each waiting block to a free thread, reuse threads, grow the pool when workers are blocked.</li>
<li><b>The kernel's job:</b> schedule the pool's threads onto the cores like any other threads.</li>
</ul>
<p>Layers: your code (blocks) → dispatch queues → thread pool → cores. Because the pool follows the hardware, the same program uses 2 cores on a 2-core laptop and 10 on a 10-core desktop.</p>
<p><b>What is new?</b> Thread pools are old: servers and Windows (whose thread pool appears in section 4.4) have had them for years. GCD adds a <b>language extension (blocks)</b> for writing a task right where it belongs in the code, plus <b>queues</b> that keep tasks in order, so a unit of work can be split off without losing the order and dependencies between its parts.</p>

<h3>2. Threads by hand versus tasks for GCD</h3>
<p>Three ways to run many small, independent tasks:</p>
<table>
<tr><th>Strategy</th><th>Threads</th><th>Weakness</th></tr>
<tr><td>One thread per task</td><td>as many as tasks</td><td>Creating and destroying threads costs CPU; each thread reserves stack memory; more threads than cores must take turns (<b>oversubscription</b>): extra switching, no speed.</td></tr>
<tr><td>Hand-made pool</td><td>a number the author guessed</td><td>Too few leaves cores idle on a big machine; too many oversubscribes a small one. The author also writes the queue, locking and shutdown code.</td></tr>
<tr><td>GCD</td><td>about one per core, chosen by the system</td><td>None: the OS sizes the pool to the machine. Queueing a block is almost free: a dispatch queue is a lightweight data structure in the app's own memory.</td></tr>
</table>
<p><b>Worked example (toy cost model):</b> 32 tasks of 0.1 ms each on 8 cores; creating plus destroying a thread costs 0.04 ms; each thread reserves 0.5 MB of stack.</p>
<ul>
<li>One thread per task: 32 threads, 32 × 0.5 = 16 MB of stack, 4 threads per core. CPU time = 32 × 0.1 + 32 × 0.04 = 4.48 ms, of which 1.28 ms (about 29%) is bookkeeping. Over 8 cores: 0.56 ms.</li>
<li>Hand-made pool of 4: 4 threads, 2 MB. CPU time = 3.2 + 0.16 = 3.36 ms, but only 4 of the 8 cores work: 0.84 ms.</li>
<li>GCD: 8 threads, 4 MB. CPU time = 3.2 + 0.32 = 3.52 ms over 8 cores: <b>0.44 ms</b>, the fastest.</li>
</ul>
<p><b>Common mistake:</b> more threads is not more speed; once every core is busy, extra threads only take turns.</p>

<h3>3. Blocks</h3>
<p>A <b>block</b> is an extension to C, Objective-C and C++ for writing an unnamed piece of code inline (an <b>anonymous function</b>). A caret and braces make one: <code>^{ printf("hello world\\n"); }</code>. A block can be stored in a variable, passed to a function such as <code>dispatch_async</code>, and run later, even on another thread.</p>
<pre>int (^twice)(int) = ^(int n) { return n * 2; };  // a block variable holding a doubling block
int r = twice(21);                                // call it like a function: r is 42</pre>
<ul>
<li><code>int</code> is the return type; <code>(^twice)</code> declares a variable that holds a block (the caret plays the role * plays for pointers); <code>(int)</code> lists parameter types.</li>
<li><code>^(int n) { ... }</code> is the block literal: the caret starts it, <code>(int n)</code> names the parameter, the braces hold the body.</li>
<li>Writing a block does <b>not</b> run it. The body runs only when the block is called, or when GCD takes it off a queue.</li>
</ul>
<p><b>Capture:</b> a block remembers the outside variables it uses. Code packaged with the values it uses is a <b>closure</b>. By default an ordinary local variable is captured <b>by value</b> at the moment the block is created:</p>
<pre>int x = 5;                          // ordinary local variable
void (^greet)(void) = ^{ printf("x is %d\\n", x); };  // block copies x (5) now
x = 9;                              // change x after the block exists
greet();                            // prints "x is 5"</pre>
<p>If the variable is declared <code>__block int x = 5;</code> the block keeps a shared link to x instead of a copy, so the same code prints "x is 9". Copying is the safe default: by the time a pool thread runs the block, the function that made it may have returned and its locals be gone.</p>
<h3>4. Dispatch queues and dispatch sources</h3>
<p>A <b>dispatch queue</b> is a FIFO line of blocks; GCD takes blocks from the front and runs them on pool threads.</p>
<ul>
<li><b>Serial queue:</b> one block at a time; the next starts only after the previous finishes. It may use different pool threads, never two at once. Routing every use of some shared data through one serial queue replaces a lock.</li>
<li><b>Concurrent queue:</b> blocks <b>start</b> in FIFO order but the next is handed out as soon as a thread is free, so blocks overlap and may <b>finish</b> in any order.</li>
<li><b>Main queue</b> (<code>dispatch_get_main_queue()</code>): serial, runs on the <b>main thread</b>, which handles events and drawing. UI updates go here; slow work never does.</li>
<li><b>Global queues</b> (<code>dispatch_get_global_queue(priority, 0)</code>): concurrent, system-provided, at <b>high, default and low</b> priority (plus <b>background</b> since 10.7). Newer GCD code usually asks for a <b>quality-of-service (QoS) class</b> instead of one of these priorities: user-interactive, user-initiated, utility or background, from most to least urgent.</li>
<li><b>Private queues:</b> <code>dispatch_queue_create(name, DISPATCH_QUEUE_SERIAL)</code>. In 10.6 every app-made queue was serial; private concurrent queues (<code>DISPATCH_QUEUE_CONCURRENT</code>) came in 10.7.</li>
</ul>
<p><code>dispatch_async(q, block)</code> adds the block and returns at once; <code>dispatch_sync</code> waits until it has run.</p>
<p>A <b>dispatch source</b> watches for a system event (a timer, a signal, a readable file descriptor or socket, a process exiting) and, when it happens, submits a handler block to a chosen queue. No thread of yours sits waiting. Events that arrive before the handler starts are <b>merged</b> into one run, and a source never runs its handler twice at once.</p>

<h3>5. Timing on serial and concurrent queues</h3>
<p><b>Serial:</b> blocks of 300, 100 and 200 ms take 300 + 100 + 200 = <b>600 ms</b>, even with 4 cores free.</p>
<p><b>Concurrent, 2 threads:</b> blocks of 300, 100, 200, 100 ms. At 0: thread 1 takes 300 (to 300), thread 2 takes 100 (to 100). At 100: thread 2 takes 200 (to 300). At 300: the last 100 ms block runs to <b>400 ms</b>. Speed-up = total work ÷ finish time = 700 ÷ 400 = 1.75×. The 100 ms block finished before the 300 ms block that started earlier. If two overlapping blocks change the same data, the result is a race condition; putting them on one serial queue removes the overlap.</p>

<h3>6. Which output orders are possible?</h3>
<p>An order is impossible only if it breaks a guarantee: (1) blocks in the same serial queue run one at a time in queued order; (2) lines on one thread run in program order; (3) a main-queue block waits until the main thread is free. Durations make an order likely, never certain.</p>
<ul>
<li>Same <b>serial</b> queue: output order = submission order, whatever the durations.</li>
<li><b>Concurrent</b> queue: any finish order is possible.</li>
<li><b>Two queues:</b> A then B on serial s, C on global g: A precedes B and C may land anywhere (A B C, A C B, C A B).</li>
<li><b>Round trip from the main thread:</b> print 1, dispatch_async to g (print 2, then dispatch_async to main to print 3), print 4. Possible: 1 4 2 3 and 1 2 4 3. Impossible: 1 2 3 4, because 3 needs the main thread, busy with the handler until after 4.</li>
</ul>

<h3>7. The classic pattern</h3>
<pre>dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    Stats st = analyze(doc);                     // slow work on a pool thread
    dispatch_async(dispatch_get_main_queue(), ^{
        showStats(st);                           // UI update on the main thread
    });
});</pre>
<ol>
<li>The handler (main thread) puts the work block on a global queue and returns at once, so the main thread keeps handling events.</li>
<li>A pool thread runs the slow analysis.</li>
<li>That block queues a second block, carrying the captured result, on the main queue.</li>
<li>The main thread runs it and updates the window.</li>
</ol>
<p><b>Common mistake:</b> doing slow work directly in an event handler freezes the app (spinning wait cursor) and leaves the other cores idle.</p>`,
  });
})();
