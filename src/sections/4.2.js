/* =====================================================================
   Section 4.2  Types of Threads
   User-level threads (ULTs), kernel-level threads (KLTs), the combined
   approach, and the thread : process arrangements.
   ===================================================================== */
(() => {
  /* ---------- shared helpers (scoped to this file) ---------- */
  // Thread colours: all threads are "thread" pink; we tell them apart with
  // different tints so a Gantt chart stays readable in light and dark mode.
  const TINT = { T1: 'var(--thread)', T2: 'color-mix(in srgb, var(--thread) 62%, var(--os))', T3: 'color-mix(in srgb, var(--thread) 55%, var(--io))' };
  const TBG = { T1: 'var(--thread-bg)', T2: 'color-mix(in srgb, var(--thread-bg) 70%, var(--os-bg))', T3: 'color-mix(in srgb, var(--thread-bg) 65%, var(--io-bg))' };
  /* Tick-by-tick simulation of one 3-thread program under ULTs or KLTs.
     Each thread needs 4 ticks of CPU. With `block`, T2 computes 1 tick, then does a
     blocking read that keeps the disk busy for 4 ticks, then computes 3 more ticks.
     Scheduling is round robin with a 1-tick slice in both designs:
       ULT: the kernel sees one process P and gives it ONE core; the library picks the thread.
            A blocking call blocks P, so no thread runs until the read finishes.
       KLT: the kernel keeps a ready queue of threads and fills up to `cores` cores per tick.
            Threads whose I/O finishes join the queue before threads that were just preempted. */
  const NAMES = ['T1', 'T2', 'T3'];
  const IO_TICKS = 4;
  function simulate(kind, cores, block) {
    const st = {};
    NAMES.forEach((n) => { st[n] = { segs: n === 'T2' && block ? [1, -IO_TICKS, 3] : [4], done: false }; });
    const ticks = [];
    const left = () => NAMES.some((n) => !st[n].done);
    if (kind === 'ult') {
      let last = -1, resume = null, blockedUntil = -1, ioThr = null;
      for (let t = 0; left() && t < 40; t++) {
        const rec = { t, cores: [], io: null, ev: [], lib: {}, kern: 'Running' };
        const second = cores === 2 ? 'unusable' : 'absent';
        if (t < blockedUntil) {
          rec.cores = ['blocked', second]; rec.io = ioThr; rec.kern = 'Blocked';
          const others = NAMES.filter((n) => n !== ioThr && !st[n].done);
          rec.ev.push(`P is blocked. ${others.join(' and ')} ${others.length > 1 ? 'are' : 'is'} ready, but the kernel cannot see ${others.length > 1 ? 'them' : 'it'}.`);
          NAMES.forEach((n) => { rec.lib[n] = st[n].done ? 'Done' : n === ioThr ? 'Running' : 'Ready'; });
          ticks.push(rec); continue;
        }
        let pick = resume;
        if (pick) rec.ev.push(`The read is done; P runs again and resumes inside ${pick}.`);
        resume = null;
        if (!pick) for (let k = 1; k <= 3; k++) { const n = NAMES[(last + k + 3) % 3]; if (!st[n].done) { pick = n; break; } }
        last = NAMES.indexOf(pick);
        rec.cores = [pick, second];
        const seg = st[pick].segs;
        seg[0]--;
        if (!rec.ev.length) rec.ev.push(`The library runs ${pick} on core 1.`);
        if (seg[0] === 0) {
          seg.shift();
          if (seg.length && seg[0] < 0) {
            const d = -seg.shift(); blockedUntil = t + 1 + d; ioThr = pick; resume = pick;
            rec.ev.push(`${pick} calls read(): the kernel blocks the whole process.`);
          } else if (!seg.length) { st[pick].done = true; rec.ev.push(`${pick} finishes.`); }
        }
        NAMES.forEach((n) => { rec.lib[n] = n === pick ? 'Running' : st[n].done ? 'Done' : 'Ready'; });
        ticks.push(rec);
      }
    } else {
      const q = NAMES.slice(); const io = [];
      for (let t = 0; left() && t < 40; t++) {
        const rec = { t, cores: [], io: null, ev: [], kst: {} };
        const run = q.splice(0, cores);
        for (let c = 0; c < cores; c++) rec.cores.push(run[c] || 'idle');
        if (cores === 1) rec.cores.push('absent');
        const busy = io.find((x) => x.start <= t && t < x.until);
        rec.io = busy ? busy.n : null;
        rec.ev.push(run.length ? run.map((n, c) => `core ${c + 1}: ${n}`).join(', ') + (run.length < cores ? '; core 2 idles, nothing is ready' : '') + '.' : 'Every core idles: nothing is ready.');
        const back = [];
        for (const n of run) {
          const seg = st[n].segs;
          seg[0]--;
          if (seg[0] > 0) { back.push(n); continue; }
          seg.shift();
          if (seg.length && seg[0] < 0) { const d = -seg.shift(); io.push({ n, start: t + 1, until: t + 1 + d }); rec.ev.push(`${n} calls read() and blocks; the kernel keeps running the others.`); }
          else if (!seg.length) { st[n].done = true; rec.ev.push(`${n} finishes.`); }
          else back.push(n);
        }
        for (const x of io) if (x.until === t + 1) { q.push(x.n); rec.ev.push(`${x.n}’s read completes, so ${x.n} is ready again.`); }
        q.push(...back);
        NAMES.forEach((n) => { rec.kst[n] = run.includes(n) ? 'Running' : st[n].done ? 'Done' : io.some((x) => x.n === n && x.start <= t && t < x.until) ? 'Blocked' : 'Ready'; });
        ticks.push(rec);
      }
    }
    return { ticks, end: ticks.length };
  }

  Guide.section({
    id: '4.2',
    title: 'Types of Threads',
    short: 'Types of threads',
    summary: 'User-level vs kernel-level threads: who manages them, what blocks, what it costs, and hybrid designs.',
    objectives: [
      'Explain who manages threads in the user-level (ULT) and kernel-level (KLT) approaches, and what the kernel can and cannot see in each.',
      'Trace how ULT states relate to process states when a thread blocks, when the time slice ends, and when one thread waits for another.',
      'Weigh the advantages and disadvantages of ULTs and KLTs, including the workarounds, using measured latency numbers.',
      'Describe the combined approach and the 1:1, M:1, 1:M and M:N thread-to-process arrangements, with an example of each.',
    ],
    terms: [
      ['User-level thread (ULT)', 'A thread that is created, scheduled and switched entirely by a thread library inside the application. The kernel does not know it exists; it only sees the process that contains it.'],
      ['Kernel-level thread (KLT)', 'A thread that the kernel itself creates, keeps records for and schedules. Also called a kernel-supported thread or a lightweight process.'],
      ['Lightweight process (LWP)', 'Another name for a thread (section 4.1), the unit that gets dispatched; when threads are sorted into user-level and kernel-level, the name usually means a kernel-level thread. Solaris uses it for one specific kernel-side carrier that user-level threads run on (section 4.5).'],
      ['Thread library', 'A package of ordinary user-mode routines, linked into a program, that creates and destroys threads, passes data between them, schedules them, and saves and restores their contexts.'],
      ['Thread context', 'Everything a thread needs to resume exactly where it stopped: its program counter, stack pointer and other register values.'],
      ['Kernel mode', 'The privileged processor mode in which operating-system code runs; it may execute any instruction and touch any memory. Ordinary programs run in the restricted user mode.'],
      ['Mode switch', 'A change of the processor between user mode and kernel mode: user → kernel when a program makes a system call or an interrupt arrives, and kernel → user when the kernel returns. Each one costs time.'],
      ['System call', 'A request from a program to the kernel for a service, such as reading a file. It enters the kernel through a controlled gate, which means a mode switch.'],
      ['Blocking system call', 'A system call that cannot finish right away (for example, a read whose data is still on the disk), so the caller is put to sleep until the event it needs happens.'],
      ['Time slice', 'The longest stretch of processor time the scheduler hands out in one go before it may switch to someone else. Also called a quantum.'],
      ['Clock interrupt', 'A regular signal from a hardware timer that hands control to the kernel, so it can check whether the running process has used up its time slice.'],
      ['Jacketing', 'A thread-library trick that wraps a possibly blocking system call in code that first asks, without blocking, whether the call would block. If it would, the library runs another thread and tries again later.'],
      ['Multiprocessor', 'A computer with two or more processors (or cores) that can execute instructions at the same moment.'],
      ['Latency', 'How long one operation takes from start to finish. Here it is measured in microseconds (µs): millionths of a second.'],
      ['Null fork', 'A benchmark that measures the pure overhead of creating, scheduling, running and finishing a thread or process whose body does nothing at all.'],
      ['Signal-wait', 'A benchmark that measures the overhead of one thread or process signalling a waiting partner and then waiting itself: the basic cost of synchronizing two of them.'],
      ['Combined approach (hybrid threading)', 'A design in which threads are created and mostly managed by a user-level library, and the many user-level threads of an application are mapped onto a smaller or equal number of kernel-level threads.'],
      ['Thread migration', 'Moving an executing thread out of one process environment (address space and resources) into another, possibly on a different machine.'],
      ['Address space', 'The range of memory addresses a process is allowed to use. All threads of one process share the same address space.'],
    ],

    css: `
      .sec-4-2 .kv { display:flex; justify-content:space-between; gap:10px; }
      .sec-4-2 .say { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 15px; line-height: 1.45; }
      .sec-4-2 .say b { color: var(--chc); }
      .sec-4-2 .job { padding: 8px 11px; }
      .sec-4-2 .job b { display: block; font-size: 15.5px; color: var(--thread); }
      .sec-4-2 .job > span { font-size: 14px; color: var(--ink-2); line-height: 1.35; display: block; }
      .sec-4-2 .grid-1 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
      .sec-4-2 .btn.okay { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
      .sec-4-2 .btn.nope { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); text-decoration: line-through; }
      .sec-4-2 .seg.tp { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
      .sec-4-2 .seg.tp button { white-space: normal; line-height: 1.25; }
      .sec-4-2 .tp-ans { display: grid; grid-template-columns: repeat(2, max-content); gap: 6px; }
      .sec-4-2 .tp-note { font-size: 13px; color: var(--ink-2); font-weight: 650; }
    `,

    steps: [
      /* ---------------- 1. Big picture: who knows the threads exist? ---------------- */
      {
        title: 'Who knows your threads exist?',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">Every thread needs a manager: someone must create it, decide when it runs, and save its place when it pauses. This section asks one question: <b>who does that job?</b></p>
              <p class="m0">There are two broad answers. With <span class="t">user-level threads</span> (ULTs), a <span class="t">thread library</span> inside the application does all the managing and the kernel never hears about the threads. With <span class="t">kernel-level threads</span> (KLTs, also called kernel-supported threads or <span class="t" data-t="lightweight process">lightweight processes</span>), the kernel manages every thread itself.</p>
              <div class="callout analogy m0" data-label="Analogy">An office tower hands out door badges. Company A registers only its own name, gets one badge, and its staff pass it around themselves (ULTs). Company B registers every employee, so the tower can let several of them in at once (KLTs). If A's badge-holder gets stuck in the lobby, nobody else from A gets in.</div>
              <div class="sec-4-2-road small"><b>Coming up:</b> inside a thread library → three state puzzles → kernel-level switching → a side-by-side simulator → jacketing → real timing numbers → hybrid designs → threads per process.</div>
            </div>
            <div class="card white stack sec-4-2-s1"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const host = ctx.$('.sec-4-2-s1');
          const svg = s('svg', { viewBox: '0 0 620 292', width: '100%', role: 'img', 'aria-label': 'User space and kernel space, showing what the kernel can see' });
          const cap = h('p', { class: 'small m0 sec-4-2-cap' });
          const X = [120, 310, 500]; // centres of the three thread boxes
          const CAPS = {
            ult: '<b>The kernel sees 1 schedulable unit.</b> It schedules process P as a whole and has no idea there are three threads inside. The library decides which thread gets to use P’s turn on the CPU.',
            klt: '<b>The kernel sees 3 schedulable units.</b> It keeps a record for P and for each thread, and schedules threads directly, so two threads of P could run on two processors at the same moment.',
            mix: '<b>The kernel sees 2 schedulable units.</b> The library creates and schedules the three threads but runs them on two kernel-level threads. This hybrid comes back near the end of the section.',
          };
          function box(x, y, w, hh, cls, label, sub) {
            return s('g', {},
              s('rect', { x, y, width: w, height: hh, rx: 9, class: cls, 'stroke-width': 2 }),
              s('text', { x: x + w / 2, y: y + (sub ? 19 : hh / 2 + 5), 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, label),
              sub ? s('text', { x: x + w / 2, y: y + 35, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, sub) : null);
          }
          function draw(mode) {
            const kids = [
              s('text', { x: 8, y: 16, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'USER SPACE'),
              s('rect', { x: 20, y: 24, width: 580, height: 116, rx: 12, class: 's-proc', 'stroke-width': 2 }),
              s('text', { x: 34, y: 44, 'font-size': 14, 'font-weight': 700, style: 'fill:var(--proc)' }, 'Process P  (one address space, shared files)'),
              ...X.map((cx, i) => box(cx - 60, 54, 120, 42, 's-thread', 'Thread ' + (i + 1), null)),
              s('line', { x1: 0, y1: 156, x2: 620, y2: 156, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.5 }),
              s('text', { x: 612, y: 151, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'user mode ↑'),
              s('text', { x: 612, y: 170, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'kernel mode ↓'),
              s('text', { x: 8, y: 184, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'KERNEL SPACE'),
              s('rect', { x: 20, y: 192, width: 580, height: 96, rx: 12, class: 's-os', 'stroke-width': 2 }),
            ];
            const halo = (bg) => `paint-order:stroke;stroke:var(${bg});stroke-width:6px;stroke-linejoin:round;`;
            const late = [s('text', { x: 34, y: 212, 'font-size': 14, 'font-weight': 700, style: halo('--os-bg') + 'fill:var(--os)' }, 'What the kernel’s scheduler can see')];
            if (mode === 'ult' || mode === 'mix') {
              kids.push(s('rect', { x: 60, y: 104, width: 500, height: 28, rx: 8, class: 's-accent', 'stroke-width': 1.5 }),
                s('text', { x: 310, y: 123, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'thread library (ordinary user-mode code)'));
            } else {
              late.push(s('text', { x: 310, y: 124, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub', style: halo('--proc-bg') }, 'no library: threads are created through kernel system calls'));
            }
            if (mode === 'ult') {
              kids.push(s('line', { x1: 310, y1: 132, x2: 310, y2: 222, class: 's-line', 'marker-end': 'url(#arr)' }),
                box(230, 226, 160, 50, 's-proc', 'Process P', '1 unit to schedule'));
            } else if (mode === 'klt') {
              X.forEach((cx, i) => kids.push(s('line', { x1: cx, y1: 96, x2: cx, y2: 222, class: 's-line', 'marker-end': 'url(#arr)' }), box(cx - 70, 226, 140, 50, 's-thread', 'KLT ' + (i + 1), 'runs Thread ' + (i + 1))));
            } else {
              [[215, 'KLT 1', 'carries Threads 1, 2'], [405, 'KLT 2', 'carries Thread 3']].forEach(([cx, l, sub]) => kids.push(
                s('line', { x1: cx, y1: 132, x2: cx, y2: 222, class: 's-line', 'marker-end': 'url(#arr)' }), box(cx - 80, 226, 160, 50, 's-thread', l, sub)));
            }
            svg.replaceChildren(...kids, ...late);
            cap.innerHTML = CAPS[mode];
            const st = STATS[mode];
            stats.replaceChildren(...[['Units the kernel schedules', st[0]], ['Threads of P running at once on 2 cores', st[1]], ['Who switches between threads', st[2]]].map(([k, v]) =>
              h('div', { class: 'card tight', style: { textAlign: 'center' } }, h('div', { class: 'xs muted b' }, k), h('div', { class: 'b', style: { fontSize: '19px', color: 'var(--chc)' } }, v))));
          }
          const STATS = { ult: ['1', 'at most 1', 'the library'], klt: ['3', 'up to 2', 'the kernel'], mix: ['2', 'up to 2', 'library + kernel'] };
          const stats = h('div', { class: 'grid-3', style: { gap: '8px', marginTop: 'auto' } });
          const seg = ctx.ui.seg([{ value: 'ult', label: 'User-level' }, { value: 'klt', label: 'Kernel-level' }, { value: 'mix', label: 'Combined' }], 'ult', draw);
          host.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'What does the kernel see?'), seg), svg, cap, stats);
          draw('ult');
        },
      },
      /* ---------------- 2. ULTs: the library runs the show ---------------- */
      {
        title: 'User-level threads: a library runs the show',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="m0">With <span class="t">ULTs</span>, all thread management happens inside the application, in a <span class="t">thread library</span>: plain code linked into the program that runs in user mode. The kernel sees only the process, which it schedules as one unit with one state (Running, Ready or Blocked).</p>
              <h4 class="m0">The library’s four jobs</h4>
              <div class="grid-2" style="gap:8px">
                <div class="card tight job"><b>Create &amp; destroy threads</b><span>Give each thread a stack and a context slot.</span></div>
                <div class="card tight job"><b>Pass messages &amp; data</b><span>Move values between threads in shared memory.</span></div>
                <div class="card tight job"><b>Schedule threads</b><span>Pick the next thread with the app’s own policy.</span></div>
                <div class="card tight job"><b>Save &amp; restore <span class="t" data-t="thread context">contexts</span></b><span>Store one thread’s registers, load the next one’s.</span></div>
              </div>
              <div class="card tight stack" style="gap:4px;flex:none">
                <div class="xs b muted">WHY BOTHER? THREE ADVANTAGES OF ULTS</div>
                <div class="small"><span class="chip ok">1</span> <b>Cheap switches:</b> thread records live in the process, so no <span class="t">mode switch</span>.</div>
                <div class="small"><span class="chip ok">2</span> <b>Custom scheduling:</b> each app picks its own policy.</div>
                <div class="small"><span class="chip ok">3</span> <b>Runs on any OS:</b> the kernel needs no thread support.</div>
              </div>
            </div>
            <div class="card white stack sec-4-2-s2" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const host = ctx.$('.sec-4-2-s2');
          const hex = (n) => '0x' + n.toString(16).toUpperCase().padStart(4, '0');
          const ROLES = ['UI', 'network', 'disk', 'worker'];
          let th, run, switches, policy = 'rr', lastWorker, nextId;
          const svg = s('svg', { viewBox: '0 0 640 300', width: '100%', role: 'img', 'aria-label': 'Threads, thread library and the kernel record for the process' });
          const say = h('div', { class: 'say' });
          // thread IDs are never reused or renumbered (as in a real library); a new thread takes a free role
          const mk = () => { const n = nextId++, sp0 = 0x7F00 - ((n - 1) % 6) * 0x1000;
            return { id: 'T' + n, role: ROLES.find((r) => !th.some((t) => t.role === r)) || 'worker', pc: 0x1040 + ((n - 1) % 8) * 0x1000, sp0, sp: sp0, runs: 0 }; };
          function reset() { th = []; nextId = 1; th.push(mk()); th.push(mk()); th.push(mk()); run = 0; switches = 0; lastWorker = 0;
            say.innerHTML = '<b>Start.</b> Three threads live in process P. T1 is running; T2 and T3 wait in the library’s ready list. Press <b>yield()</b> a few times, create a thread, then try <b>UI first</b>. Watch the violet kernel row: it never changes.'; draw(); }
          function pickNext() {
            const n = th.length;
            if (n === 1) return 0;
            if (policy === 'rr') return (run + 1) % n;
            const ui = th.findIndex((t) => t.role === 'UI');
            if (ui < 0) return (run + 1) % n;
            if (run !== ui) return ui;                         // UI first: always go back to the UI thread
            const others = th.map((t, i) => i).filter((i) => i !== ui);
            const k = others.findIndex((i) => i > lastWorker); // then the next worker in turn
            return others[k < 0 ? 0 : k];
          }
          function doYield() {
            if (th.length < 2) { say.innerHTML = 'Only one thread is left, so yield() simply returns to it. Create another thread first.'; return; }
            const cur = th[run];
            cur.runs++; cur.pc += 0x28 + 0x08 * (cur.runs % 3); cur.sp = cur.sp0 - ((cur.runs * 0x10) % 0x40);
            const nx = pickNext();
            if (th[nx].role !== 'UI') lastWorker = nx;
            switches++;
            say.innerHTML = `<b>${cur.id} called yield()</b>, an ordinary function call into the library. The library saved ${cur.id}’s registers (PC ${hex(cur.pc)}, SP ${hex(cur.sp)}) in ${cur.id}’s slot, picked <b>${th[nx].id}</b> (${policy === 'rr' ? 'round robin: next in line' : 'UI first: the UI thread gets every other turn'}), loaded ${th[nx].id}’s saved registers and jumped into it. No system call was made, so the kernel was never entered: still <b>0 mode switches</b>.`;
            run = nx; draw();
          }
          function doCreate() {
            if (th.length >= 4) { say.innerHTML = 'This demo stops at four threads so everything fits on screen. A real library can create many more.'; return; }
            const t = mk(); th.push(t);
            say.innerHTML = `<b>${th[run].id} called thread_create()</b>, a library call. The library carved out a stack for the new thread ${t.id} (${t.role}) inside P’s memory, filled in a context slot (PC ${hex(t.pc)}) and put ${t.id} on its ready list. The kernel’s record for P did not change at all.`;
            draw();
          }
          function doExit() {
            if (th.length < 2) { say.innerHTML = 'The last thread cannot exit in this demo; if it did, the whole process would end.'; return; }
            const gone = th[run];
            th.splice(run, 1); run = run % th.length; lastWorker = 0; switches++;
            if (policy === 'ui') { const ui = th.findIndex((t) => t.role === 'UI'); if (ui >= 0) run = ui; } // UI first: the UI thread gets the freed turn
            say.innerHTML = `<b>${gone.id} (${gone.role}) called thread_exit().</b> The library freed ${gone.id}’s stack and context slot, picked ${th[run].id} and loaded its saved registers. Again, only library code ran: <b>0 mode switches</b>.`;
            draw();
          }
          // geometry: one wide row of threads on desktop; a 2 x 2 grid and stacked library/kernel boxes on phones
          const NW = ctx.narrow;
          const L = NW
            ? { W: 360, H: 486, P: [4, 20, 352, 356], T: (i) => [14 + (i % 2) * 170, 50 + Math.floor(i / 2) * 68, 162], LIB: [14, 190, 332, 176], LX: 26, LY: [212, 232, 250, 268], CX: 26, CY: 294, B: 390, K: [4, 416, 352, 64] }
            : { W: 640, H: 300, P: [8, 20, 624, 196], T: (i) => [22 + i * 152, 48, 140], LIB: [22, 118, 596, 90], LX: 34, LY: [139, 160, 178, 196], CX: 250, CY: 139, B: 228, K: [8, 252, 624, 44] };
          svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
          function draw() {
            const [px, py, pw, ph] = L.P, [lx, ly, lw, lh] = L.LIB, [kx, ky, kw, kh] = L.K;
            const kids = [
              s('text', { x: px, y: 13, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'USER SPACE · USER MODE'),
              s('rect', { x: px, y: py, width: pw, height: ph, rx: 12, class: 's-proc', 'stroke-width': 2 }),
              s('text', { x: px + 14, y: py + 20, 'font-size': 14, 'font-weight': 700, style: 'fill:var(--proc)' }, 'Process P'),
            ];
            th.forEach((t, i) => {
              const [x, y, w] = L.T(i), on = i === run;
              kids.push(s('g', {},
                s('rect', { x, y, width: w, height: 60, rx: 9, class: 's-thread', 'stroke-width': on ? 4 : 1.5, opacity: on ? 1 : 0.8 }),
                s('text', { x: x + 10, y: y + 19, 'font-size': 14.5, 'font-weight': 800 }, `${t.id} · ${t.role}`),
                s('text', { x: x + 10, y: y + 37, 'font-size': 13.5, 'font-weight': on ? 800 : 500, style: on ? 'fill:var(--thread)' : '', class: on ? '' : 's-sub' }, on ? '▶ Running' : 'Ready'),
                s('text', { x: x + 10, y: y + 53, 'font-size': 13, class: 's-sub s-monot' }, on ? 'on the CPU now' : 'PC ' + hex(t.pc))));
            });
            kids.push(s('rect', { x: lx, y: ly, width: lw, height: lh, rx: 9, class: 's-accent', 'stroke-width': 1.5 }),
              s('text', { x: L.LX, y: L.LY[0], 'font-size': 14.5, 'font-weight': 800 }, 'Thread library'),
              s('text', { x: L.LX, y: L.LY[1], 'font-size': 13.5 }, 'policy: ' + (policy === 'rr' ? 'round robin' : 'UI first')),
              s('text', { x: L.LX, y: L.LY[2], 'font-size': 13.5 }, 'thread switches: ' + switches),
              s('text', { x: L.LX, y: L.LY[3], 'font-size': 13.5 }, 'next pick: ' + (th.length > 1 ? th[pickNext()].id : '(none)')),
              s('text', { x: L.CX, y: L.CY, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'SAVED CONTEXTS (in P’s own memory)'));
            th.forEach((t, i) => kids.push(s('text', { x: L.CX, y: L.CY + 18 + i * 15, 'font-size': 13, class: 's-monot', style: i === run ? 'fill:var(--thread)' : '' },
              i === run ? `${t.id}  live in the CPU’s registers` : `${t.id}  PC ${hex(t.pc)}  SP ${hex(t.sp)}`)));
            kids.push(s('line', { x1: 0, y1: L.B, x2: L.W, y2: L.B, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.5 }),
              s('text', { x: kx, y: L.B + 18, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.08em' }, 'KERNEL SPACE'),
              s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 10, class: 's-os', 'stroke-width': 2 }),
              s('text', { x: kx + 14, y: ky + 27, 'font-size': 14.5 }, NW ? 'Kernel’s record: P = Running' : 'Kernel’s record: process P = Running · threads it knows of: 0'),
              NW ? s('text', { x: kx + 14, y: ky + 51, 'font-size': 14.5 }, 'threads it knows of: 0') : null,
              s('text', { x: kx + kw - 12, y: NW ? ky + 51 : ky + 28, 'text-anchor': 'end', 'font-size': 16, 'font-weight': 800, style: 'fill:var(--ok)' }, 'mode switches: 0'));
            svg.replaceChildren(...kids.filter(Boolean));
          }
          const pol = ctx.ui.seg([{ value: 'rr', label: 'Round robin' }, { value: 'ui', label: 'UI first' }], 'rr', (v) => {
            policy = v; lastWorker = 0; draw();
            say.innerHTML = v === 'rr' ? '<b>Round robin:</b> every thread gets a turn in a fixed circle.' : '<b>UI first:</b> this application wants its screen to feel snappy, so its library hands the UI thread every other turn. The kernel did not have to change, or even know.';
          });
          host.append(
            h('div', { class: 'row', style: { gap: '8px' } },
              h('span', { class: 'small b' }, 'Running thread calls:'),
              h('button', { class: 'btn primary sm', onclick: doYield }, 'yield()'),
              h('button', { class: 'btn sm thread', onclick: doCreate }, 'thread_create()'),
              h('button', { class: 'btn sm', onclick: doExit }, 'thread_exit()'),
              h('span', { class: 'grow' }),
              h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),
            svg,
            h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b' }, 'The library’s scheduling policy:'), pol, h('span', { class: 'xs muted' }, 'chosen by the app, not the kernel')),
            say);
          reset();
        },
      },
      /* ---------------- 3. ULT states vs process states ---------------- */
      {
        title: 'Thread states vs process states: three scenarios',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const svg = s('svg', { viewBox: '0 0 1120 316', width: '100%', role: 'img', 'aria-label': 'State diagrams for thread 1, thread 2 and process B' });
          const NODE = { Running: [165, 32], Ready: [72, 128], Blocked: [258, 128] };
          const ARC = { // transition paths, relative to a diagram's origin
            'Ready>Running': ['M 60 109 Q 64 40 108 30', 'dispatch', 40, 62],
            'Running>Ready': ['M 146 51 Q 128 96 96 109', 'time-out', 136, 98],
            'Running>Blocked': ['M 190 51 Q 230 70 250 109', 'wait', 236, 72],
            'Blocked>Ready': ['M 200 128 L 132 128', 'event', 166, 150],
          };
          function diagram(ox, oy, title, cur, cls, hot, warn) {
            const g = s('g', { transform: `translate(${ox},${oy})` });
            g.append(s('text', { x: 0, y: -6, 'font-size': 15, 'font-weight': 800 }, title));
            for (const [k, [d, lab, lx, ly]] of Object.entries(ARC)) {
              const on = hot === k;
              g.append(s('path', { d, class: on ? '' : 's-muted', fill: 'none', style: on ? 'stroke:var(--accent);stroke-width:3.5' : 'stroke-width:1.6', 'marker-end': on ? 'url(#arr-accent)' : 'url(#arr-muted)' }),
                s('text', { x: lx, y: ly, 'text-anchor': 'middle', 'font-size': 12.5, class: on ? '' : 's-sub', style: on ? 'fill:var(--accent);font-weight:800' : '' }, lab));
            }
            for (const [st, [cx, cy]] of Object.entries(NODE)) {
              const on = st === cur;
              g.append(s('rect', { x: cx - 56, y: cy - 19, width: 112, height: 38, rx: 19, class: on ? cls : 's-panel', 'stroke-width': on ? 3 : 1.2 }),
                s('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': on ? 800 : 500, class: on ? '' : 's-sub' }, st));
            }
            if (warn) g.append(s('text', { x: 165, y: 184, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--warn)' }, warn));
            return g;
          }
          const W2 = '“Running” only on paper: B is not on the CPU';
          const START = { t1: 'Ready', t2: 'Running', pb: 'Running', cpu: ['B · Thread 2', 'proc'], cap: '<b>Starting point.</b> Process B has two user-level threads, run by a thread library inside B that the kernel knows nothing about. The library’s records say Thread 2 is Running and Thread 1 is Ready. The kernel’s record says B is Running, and the CPU really is executing Thread 2’s code.' };
          const SC = {
            a: [START,
              { t1: 'Ready', t2: 'Running', pb: 'Running', cpu: ['kernel code (B’s system call)', 'os'], cap: '<b>Thread 2 calls read() on a file.</b> That is a <span class="t">system call</span>: the CPU switches to <span class="t">kernel mode</span> and kernel code takes over on B’s behalf.' },
              { t1: 'Ready', t2: 'Running', pb: 'Blocked', hot: { pb: 'Running>Blocked' }, w2: W2, cpu: ['Process A (someone else)', 'panel'], cap: '<b>The kernel starts the disk transfer</b> and, because B must wait for it, moves B to Blocked and runs another process. The library’s table still says Thread 2 is Running: no library code ran, so nothing updated it.' },
              { t1: 'Ready', t2: 'Running', pb: 'Blocked', w2: W2, w1: 'Ready and able to work, but stuck', cpu: ['Process A (someone else)', 'panel'], cap: '<b>Thread 1 could do useful work right now</b>, but the kernel has never heard of it. One thread’s <span class="t">blocking system call</span> has frozen the whole process. This is the best-known weakness of ULTs.' },
              { t1: 'Ready', t2: 'Running', pb: 'Ready', hot: { pb: 'Blocked>Ready' }, w2: W2, cpu: ['Process A (someone else)', 'panel'], cap: '<b>The disk finishes</b> and interrupts. The kernel moves B from Blocked to Ready. B still has to wait for its turn on the CPU.' },
              { t1: 'Ready', t2: 'Running', pb: 'Running', hot: { pb: 'Ready>Running' }, cpu: ['B · Thread 2', 'proc'], cap: '<b>The kernel dispatches B.</b> Execution resumes exactly where it stopped: inside Thread 2, just after its read() call. The library’s “Running” matches reality again.' }],
            b: [START,
              { t1: 'Ready', t2: 'Running', pb: 'Running', cpu: ['kernel code (clock interrupt)', 'intr'], cap: '<b>A <span class="t">clock interrupt</span> fires.</b> Control jumps to the kernel, which finds that B has used up its <span class="t">time slice</span>.' },
              { t1: 'Ready', t2: 'Running', pb: 'Ready', hot: { pb: 'Running>Ready' }, w2: W2, cpu: ['Process A (someone else)', 'panel'], cap: '<b>The kernel moves B to Ready</b> and dispatches another process. The library’s table still shows Thread 2 Running. Nothing inside B can react, because none of B’s code (library included) is executing.' },
              { t1: 'Ready', t2: 'Running', pb: 'Running', hot: { pb: 'Ready>Running' }, cpu: ['B · Thread 2', 'proc'], cap: '<b>Later the kernel dispatches B again</b>, and it picks up inside Thread 2 exactly where the clock interrupted it. As far as the library knows, Thread 2 never stopped running.' }],
            c: [START,
              { t1: 'Ready', t2: 'Running', pb: 'Running', cpu: ['B · library code', 'proc'], cap: '<b>Thread 2 needs Thread 1 to finish something first</b> (say, fill a buffer). It calls a library routine to wait. That is a plain function call, not a system call.' },
              { t1: 'Ready', t2: 'Blocked', pb: 'Running', hot: { t2: 'Running>Blocked' }, cpu: ['B · library code', 'proc'], cap: '<b>The library marks Thread 2 Blocked</b> and saves Thread 2’s context in its slot, all in user mode.' },
              { t1: 'Running', t2: 'Blocked', pb: 'Running', hot: { t1: 'Ready>Running' }, cpu: ['B · Thread 1', 'proc'], cap: '<b>The library loads Thread 1’s context</b>, so Thread 1 is now Running. Process B stayed Running the whole time: the kernel only saw B executing instructions.' },
              { t1: 'Running', t2: 'Ready', pb: 'Running', hot: { t2: 'Blocked>Ready' }, cpu: ['B · Thread 1', 'proc'], cap: '<b>Thread 1 produces what Thread 2 was waiting for</b> and tells the library, which moves Thread 2 back to Ready. Every change here happened inside the process; B never left Running.' }],
          };
          let sc = 'a';
          const NW = ctx.narrow;
          if (NW) svg.setAttribute('viewBox', '0 0 380 806');
          function drawNarrow(f, hot) { // phones: stack the three diagrams vertically so the text stays readable
            svg.replaceChildren(
              s('rect', { x: 0, y: 0, width: 380, height: 476, rx: 12, class: 's-accent', 'stroke-width': 1.5 }),
              s('text', { x: 14, y: 22, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'THREAD LIBRARY’S RECORDS'),
              diagram(25, 62, 'Thread 1', f.t1, 's-thread', hot.t1, f.w1),
              diagram(25, 282, 'Thread 2', f.t2, 's-thread', hot.t2, f.w2),
              s('rect', { x: 0, y: 492, width: 380, height: 222, rx: 12, class: 's-os', 'stroke-width': 1.5 }),
              s('text', { x: 14, y: 514, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'KERNEL’S RECORD'),
              diagram(25, 552, 'Process B', f.pb, 's-proc', hot.pb, null),
              s('rect', { x: 0, y: 730, width: 380, height: 72, rx: 10, class: 's-panel', 'stroke-width': 1.2 }),
              s('text', { x: 14, y: 752, 'font-size': 14, 'font-weight': 700 }, 'The CPU is executing:'),
              s('rect', { x: 14, y: 762, width: 352, height: 30, rx: 15, class: 's-' + f.cpu[1], 'stroke-width': 2 }),
              s('text', { x: 190, y: 782, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800 }, f.cpu[0]));
          }
          function draw(f) {
            const hot = f.hot || {};
            if (NW) return drawNarrow(f, hot);
            svg.replaceChildren(
              s('rect', { x: 0, y: 0, width: 716, height: 254, rx: 12, class: 's-accent', 'stroke-width': 1.5 }),
              s('text', { x: 14, y: 22, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'THREAD LIBRARY’S RECORDS · USER SPACE'),
              diagram(30, 56, 'Thread 1', f.t1, 's-thread', hot.t1, f.w1),
              diagram(380, 56, 'Thread 2', f.t2, 's-thread', hot.t2, f.w2),
              s('rect', { x: 736, y: 0, width: 384, height: 254, rx: 12, class: 's-os', 'stroke-width': 1.5 }),
              s('text', { x: 750, y: 22, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'KERNEL’S RECORD · KERNEL SPACE'),
              diagram(768, 56, 'Process B', f.pb, 's-proc', hot.pb, null),
              s('rect', { x: 0, y: 268, width: 1120, height: 46, rx: 10, class: 's-panel', 'stroke-width': 1.2 }),
              s('text', { x: 18, y: 297, 'font-size': 15, 'font-weight': 700 }, 'The CPU is executing:'),
              s('rect', { x: 196, y: 277, width: 380, height: 28, rx: 14, class: 's-' + f.cpu[1], 'stroke-width': 2 }),
              s('text', { x: 386, y: 296, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800 }, f.cpu[0]),
              s('text', { x: 1104, y: 297, 'text-anchor': 'end', 'font-size': 13.5, class: 's-sub' }, sc === 'c' ? 'no mode switch needed for any of this' : 'the kernel acts; the library cannot'));
          }
          const player = ctx.ui.player({ count: SC.a.length, interval: 2600, render: (i) => { const f = SC[sc][i]; draw(f); return f.cap; } });
          const seg = ctx.ui.seg([{ value: 'a', label: 'a) Thread 2 makes a blocking call' }, { value: 'b', label: 'b) B’s time slice runs out' }, { value: 'c', label: 'c) Thread 2 waits for Thread 1' }], 'a', (v) => { sc = v; player.setCount(SC[v].length); });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'small muted' }, 'Pick a scenario, then step through it.')),
            h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center', padding: '12px' } }, svg),
            player.el));
        },
      },
      /* ---------------- 4. KLTs and the cost of a thread switch ---------------- */
      {
        title: 'Kernel-level threads: the kernel knows every thread',
        kind: 'compare',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">With <span class="t">KLTs</span>, the application contains no thread-management code at all. It asks the kernel for threads through system calls, and the kernel does the rest.</p>
              <p class="m0">The kernel keeps one record for the process <b>and</b> a separate saved context for each of its threads, and its scheduler chooses among <b>threads</b>, not whole processes. Windows and Linux both work this way.</p>
              <div class="card tight stack" style="gap:6px">
                <div class="small"><span class="chip ok">✓</span> Threads of one process can run at the same moment on different processors of a <span class="t">multiprocessor</span>.</div>
                <div class="small"><span class="chip ok">✓</span> If one thread blocks, the kernel can run another thread of the same process.</div>
                <div class="small"><span class="chip ok">✓</span> The kernel’s own routines can themselves be multithreaded.</div>
                <div class="small"><span class="chip bad">✗</span> Passing control between two threads of the <b>same</b> process needs a <span class="t">mode switch</span> into the kernel and another one back out.</div>
              </div>
              <div class="callout warn m0 small" data-label="Common mistake">“The kernel runs them, so KLT switches must be faster.” No: the kernel does the same save-pick-load work plus two mode switches. KLTs win on blocking and parallelism, not on switch speed.</div>
            </div>
            <div class="card white stack sec-4-2-s4" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const host = ctx.$('.sec-4-2-s4');
          const svg = s('svg', { viewBox: '0 0 640 318', width: '100%', role: 'img', 'aria-label': 'Path of a thread switch for user-level and kernel-level threads' });
          const FR = [
            { u: 0, k: 0, cap: '<b>Same job, two designs.</b> In both programs Thread 1 is running and is about to hand the CPU to Thread 2. Watch where the switching work happens.' },
            { u: 1, k: 1, cap: '<b>Going in.</b> The ULT program calls its library: an ordinary function call, still in user mode. In the KLT program only the kernel can switch threads, so control must enter kernel mode (here through a system call such as yield; a blocking call or a clock interrupt gets there the same way): <b>mode switch 1</b>.' },
            { u: 2, k: 2, cap: '<b>Same bookkeeping on both sides:</b> save Thread 1’s registers, choose Thread 2, load Thread 2’s registers. The library keeps its records in the process’s memory; the kernel keeps one record for the process and one for each thread.' },
            { u: 3, k: 3, cap: '<b>Coming out.</b> The library simply jumps into Thread 2. The kernel must first return to user mode (<b>mode switch 2</b>) before Thread 2 can run.' },
            { u: 3, k: 3, fin: true, cap: '<b>Result:</b> the KLT switch paid for two trips across the user/kernel boundary that the ULT switch never made. That is the price of the kernel knowing, scheduling and spreading every thread.' },
          ];
          // geometry: wide lanes on desktop; tighter lanes with two-line middle boxes on phones
          const NW = ctx.narrow;
          const G = NW ? { W: 360, H: 332, t1: 4, t2: 276, sw: 80, mx: 116, mw: 128, uY: 22, uH: 58, bY: 85, kY: 90, kH: 58, uc: 51, kc: 119, sh: 36, mh: 44, fs: 14, lane2: 182 }
            : { W: 640, H: 318, t1: 70, t2: 520, sw: 90, mx: 230, mw: 220, uY: 24, uH: 52, bY: 81, kY: 86, kH: 52, uc: 50, kc: 112, sh: 34, mh: 34, fs: 15, lane2: 170 };
          svg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);
          function lane(y0, title, klt, stage) {
            const ms = klt ? (stage >= 3 ? 2 : stage >= 1 ? 1 : 0) : 0;
            const on = (n) => stage >= n;
            const yu = y0 + G.uc, yk = y0 + G.kc, yb = y0 + G.bY;
            const g = [
              s('text', { x: 0, y: y0 + 14, 'font-size': G.fs, 'font-weight': 800 }, title),
              s('text', { x: G.W, y: y0 + 14, 'text-anchor': 'end', 'font-size': G.fs, 'font-weight': 800, style: ms ? 'fill:var(--bad)' : 'fill:var(--ok)' }, 'mode switches: ' + ms),
              s('rect', { x: 0, y: y0 + G.uY, width: G.W, height: G.uH, rx: 8, class: 's-panel', 'stroke-width': 1 }),
              s('line', { x1: 0, y1: yb, x2: G.W, y2: yb, class: 's-line', 'stroke-dasharray': '5 5', 'stroke-width': 1.2 }),
              s('rect', { x: 0, y: y0 + G.kY, width: G.W, height: G.kH, rx: 8, class: 's-os', 'stroke-width': 1 }),
            ];
            if (!NW) g.push(s('text', { x: 10, y: yu + 4, 'font-size': 12.5, 'font-weight': 800, class: 's-sub' }, 'USER'),
              s('text', { x: 10, y: yk + 4, 'font-size': 12.5, 'font-weight': 800, class: 's-sub' }, 'KERNEL'),
              s('text', { x: G.W - 8, y: y0 + G.kY + G.kH - 7, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, klt ? 'records kept: P, T1, T2, T3' : 'records kept: P only (not involved)'));
            const box = (x, cy, w, hh, lines, cls, lit) => {
              g.push(s('rect', { x, y: cy - hh / 2, width: w, height: hh, rx: 8, class: cls, 'stroke-width': lit ? 3 : 1.4 }));
              lines.forEach((ln, j) => g.push(s('text', { x: x + w / 2, y: cy + 5 + (j - (lines.length - 1) / 2) * 17, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, ln)));
            };
            const who = klt ? 'kernel' : 'library';
            box(G.t1, yu, G.sw, G.sh, ['Thread 1'], 's-thread', stage === 0);
            box(G.t2, yu, G.sw, G.sh, ['Thread 2'], 's-thread', stage >= 3);
            box(G.mx, klt ? yk : yu, G.mw, G.mh, NW ? [who + ':', 'save · pick · load'] : [who + ': save · pick · load'], klt ? 's-os' : 's-accent', stage === 2);
            const arrow = (d, lit) => g.push(s('path', { d, fill: 'none', class: lit ? '' : 's-muted', style: lit ? 'stroke:var(--accent);stroke-width:3' : 'stroke-width:1.5', 'marker-end': lit ? 'url(#arr-accent)' : 'url(#arr-muted)' }));
            const x1 = G.t1 + G.sw, x2 = G.mx - 2, x3 = G.mx + G.mw, x4 = G.t2 - 2;
            if (klt) {
              const d = (x2 - x1) / 2;
              arrow(`M ${x1} ${yu} C ${x1 + d} ${yu}, ${x2 - d} ${yk}, ${x2} ${yk}`, on(1));
              arrow(`M ${x3} ${yk} C ${x3 + d} ${yk}, ${x4 - d} ${yu}, ${x4} ${yu}`, on(3));
              [[(x1 + x2) / 2, 1], [(x3 + x4) / 2, 3]].forEach(([x, n]) => {
                if (!on(n)) return;
                const lab = 'mode switch ' + (n === 1 ? 1 : 2), st = 'fill:var(--intr)';
                g.push(s('rect', { x: x - 7, y: yb - 7, width: 14, height: 14, rx: 2, transform: `rotate(45 ${x} ${yb})`, class: 's-intr', 'stroke-width': 2 }),
                  NW ? s('text', { x: n === 1 ? 8 : G.W - 8, y: y0 + G.kY + G.kH - 8, 'text-anchor': n === 1 ? 'start' : 'end', 'font-size': 12.5, 'font-weight': 800, style: st }, lab)
                    : s('text', { x: n === 1 ? x + 10 : x - 10, y: yb - 12, 'text-anchor': n === 1 ? 'start' : 'end', 'font-size': 12.5, 'font-weight': 800, style: st }, lab));
              });
            } else {
              arrow(`M ${x1} ${yu} L ${x2} ${yu}`, on(1));
              arrow(`M ${x3} ${yu} L ${x4} ${yu}`, on(3));
            }
            return g;
          }
          function draw(i) {
            const f = FR[i];
            const kids = [...lane(0, NW ? 'ULT: Thread 1 → Thread 2' : 'ULT: switch from Thread 1 to Thread 2', false, f.u), ...lane(G.lane2, NW ? 'KLT: Thread 1 → Thread 2' : 'KLT: switch from Thread 1 to Thread 2', true, f.k)];
            if (f.fin) {
              const px = NW ? 20 : 150, pw = NW ? 320 : 340, py = NW ? 155 : 146;
              kids.push(s('rect', { x: px, y: py, width: pw, height: 22, rx: 11, class: 's-warn', 'stroke-width': 1.5 }), s('text', { x: px + pw / 2, y: py + 16, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'difference: 2 mode switches per thread switch'));
            }
            svg.replaceChildren(...kids.filter(Boolean));
          }
          const player = ctx.ui.player({ count: FR.length, interval: 2400, captionBelow: true, render: (i) => { draw(i); return FR[i].cap; } });
          host.append(svg, player.el, h('div', { class: 'xs muted' }, '◆ marks a mode switch: the CPU crossing the dashed line between user mode and kernel mode. Each crossing costs time.'));
        },
      },
      /* ---------------- 5. Side-by-side simulator: blocking and a second core ---------------- */
      {
        title: 'Side by side: one blocking call, one extra core',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          let cores = 1, block = true, U, K, N;
          const mkPanel = (title, sub) => {
            const chip = h('span', { class: 'chip' });
            const svg = s('svg', { viewBox: '0 0 540 206', width: '100%', role: 'img', 'aria-label': title + ' timeline' });
            const card = h('div', { class: 'card white stack', style: { gap: '6px', padding: '10px 14px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', {}, h('b', {}, title), h('span', { class: 'xs muted' }, '  ' + sub)), chip), svg);
            return { chip, svg, card };
          };
          const PU = mkPanel('User-level threads', 'kernel schedules process P'), PK = mkPanel('Kernel-level threads', 'kernel schedules T1, T2, T3');
          const FS = ctx.narrow ? 1.4 : 1, X0 = ctx.narrow ? 84 : 64, ROWY = [22, 60, 98], RH = 32;
          if (ctx.narrow) { PU.svg.setAttribute('viewBox', '0 0 540 216'); PK.svg.setAttribute('viewBox', '0 0 540 216'); }
          const COL = { Running: 'var(--thread)', Blocked: 'var(--intr)', Ready: 'var(--ink-2)', Done: 'var(--muted)' };
          function statusLine(y, label, items) {
            const t = s('text', { x: 0, y: ctx.narrow ? y + (y > 170 ? 16 : 8) : y, 'font-size': 13.5 * FS }, s('tspan', { 'font-weight': 800 }, label + '  '));
            items.forEach(([name, state], i) => t.append(s('tspan', { style: `fill:${COL[state] || 'var(--ink)'}`, 'font-weight': state === 'Running' || state === 'Blocked' ? 800 : 500 }, (i ? '  ·  ' : '') + name + ' ' + state)));
            return t;
          }
          function gantt(P, sim, kind, k) {
            const cw = (540 - X0 - 2) / N;
            const kids = [s('text', { x: 0, y: 14, 'font-size': 12.5 * FS, class: 's-sub' }, 'tick')];
            const every = ctx.narrow ? (N > 8 ? 4 : 2) : N > 12 ? 2 : 1;
            for (let i = 0; i < N; i++) if (i % every === 0) kids.push(s('text', { x: X0 + i * cw + cw / 2, y: 14, 'text-anchor': 'middle', 'font-size': 12.5 * FS, class: 's-sub' }, String(i)));
            ['Core 1', 'Core 2', 'Disk'].forEach((lab, r) => kids.push(
              s('rect', { x: X0, y: ROWY[r], width: N * cw, height: RH, rx: 6, class: 's-panel', 'stroke-width': 0.8 }),
              s('text', { x: 0, y: ROWY[r] + 22, 'font-size': 14 * FS, 'font-weight': 700, class: r === 1 && cores === 1 ? 's-sub' : '' }, lab)));
            if (cores === 1) kids.push(s('text', { x: X0 + N * cw / 2, y: ROWY[1] + 22, 'text-anchor': 'middle', 'font-size': 13.5 * FS, class: 's-sub' }, '(only one core)'));
            if (k > 0 && k <= sim.end) kids.push(s('rect', { x: X0 + (k - 1) * cw, y: 16, width: cw, height: 118, rx: 4, class: 's-accent', 'stroke-width': 1.5, opacity: 0.55 }));
            const shown = sim.ticks.slice(0, Math.min(k, sim.end));
            const rowVal = (r, rec) => (r === 2 ? rec.io : rec.cores[r]);
            for (let r = 0; r < 3; r++) {
              let i = 0;
              while (i < shown.length) {
                const v = rowVal(r, shown[i]);
                let j = i + 1;
                while (j < shown.length && rowVal(r, shown[j]) === v && !(r < 2 && /^T\d$/.test(v || ''))) j++;
                const x = X0 + i * cw + 1.5, w = (j - i) * cw - 3, y = ROWY[r] + 2, hh = RH - 4;
                const lab = (txt, min) => (w >= min * FS ? s('text', { x: x + w / 2, y: y + 19 + (FS - 1) * 8, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, txt) : null);
                if (v && /^T\d$/.test(v) && r < 2) kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, style: `fill:${TBG[v]};stroke:${TINT[v]};stroke-width:2` }), lab(v, 18));
                else if (v === 'blocked') kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, class: 's-bad', 'stroke-width': 2 }), lab('P blocked', 74) || lab('×', 10));
                else if (v === 'unusable') kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, class: 's-muted', 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }), w >= 200 ? s('text', { x: x + w / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'unused: P gets one core at a time') : null);
                else if (v === 'idle') kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, class: 's-muted', 'stroke-width': 1.5 }), w >= 36 ? s('text', { x: x + w / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'idle') : null);
                else if (r === 2 && v) kids.push(s('rect', { x, y, width: w, height: hh, rx: 5, class: 's-io', 'stroke-width': 2 }), lab(v + ' read', 60) || lab(v, 18));
                i = j;
              }
            }
            const done = k >= sim.end, rec = k > 0 && !done ? sim.ticks[k - 1] : null;
            const stOf = (fn) => (done ? 'Done' : rec ? fn(rec) : 'Ready');
            if (kind === 'ult') {
              kids.push(statusLine(160, 'Kernel sees:', [['P', stOf((r) => r.kern)]]),
                statusLine(186, 'Library says:', NAMES.map((n) => [n, stOf((r) => r.lib[n])])));
            } else {
              kids.push(statusLine(160, 'Kernel sees:', NAMES.map((n) => [n, stOf((r) => r.kst[n])])),
                s('text', { x: 0, y: ctx.narrow ? 202 : 186, 'font-size': 13.5 * FS, class: 's-sub' }, ctx.narrow ? 'No library: the kernel tracks each thread.' : 'No library table: the kernel tracks every thread itself.'));
            }
            P.svg.replaceChildren(...kids.filter(Boolean));
            const fin = k >= sim.end;
            P.chip.className = 'chip ' + (fin ? (sim.end <= Math.min(U.end, K.end) ? 'ok' : 'warn') : '');
            P.chip.textContent = fin ? `done after ${sim.end} ticks` : k ? `tick ${k - 1}` : 'not started';
          }
          function summary() {
            const parts = [`<b>Finished.</b> ULT: ${U.end} ticks. KLT: ${K.end} ticks.`];
            if (block) parts.push(`On the ULT side, process P sat blocked for ${IO_TICKS} ticks while T1 and T3 were ready: one thread’s read stopped them all.`);
            if (cores === 2) parts.push('The ULT side never touched core 2, because the kernel gives a process one processor at a time; the KLT side ran two threads at once.');
            if (!block && cores === 1) parts.push('A tie: with one core and no blocking, both designs keep the core busy. (In reality the ULT version would edge ahead, since its switches never enter the kernel.)');
            return parts.join(' ');
          }
          U = simulate('ult', cores, block); K = simulate('klt', cores, block); N = Math.max(U.end, K.end);
          const player = ctx.ui.player({ count: N + 1, interval: 900, render: (k) => {
            gantt(PU, U, 'ult', k); gantt(PK, K, 'klt', k);
            if (k === 0) return `<b>Ready.</b> Both sides run the same three threads, which take turns one tick at a time (on the ULT side each thread calls yield() after every tick); each needs 4 ticks of CPU. ${block ? `T2 computes for 1 tick, then reads from the disk for ${IO_TICKS} ticks, then computes 3 more.` : 'No thread blocks.'} <b>Predict:</b> which side finishes first, and by how much?`;
            const t = k - 1;
            const say = (sim) => (t < sim.end ? sim.ticks[t].ev.join(' ') : `Already finished after ${sim.end} ticks.`);
            const line = `<b>Tick ${t}.</b> ULT: ${say(U)}<br>KLT: ${say(K)}`;
            if (k === N) { seen[cores + '-' + block] = [U.end, K.end]; board(); return summary(); }
            return line;
          } });
          const seen = {};
          const boardEl = h('div', { class: 'grid-4', style: { gap: '8px' } });
          function board() {
            boardEl.replaceChildren(...[[1, true], [1, false], [2, true], [2, false]].map(([c, b]) => {
              const r = seen[c + '-' + b], on = c === cores && b === block;
              return h('div', { class: 'card tight', style: { padding: '6px 10px', borderColor: on ? 'var(--chc)' : '' } },
                h('div', { class: 'xs muted b' }, `${c} core${c > 1 ? 's' : ''} · ${b ? 'T2 reads' : 'no blocking'}`),
                h('div', { class: 'small', html: r ? `ULT <b>${r[0]}</b> ticks · KLT <b>${r[1]}</b> ticks` : '<span class="muted">run it to the end to record</span>' }));
            }));
          }
          function rerun() { U = simulate('ult', cores, block); K = simulate('klt', cores, block); N = Math.max(U.end, K.end); board(); player.setCount(N + 1); }
          const segC = ctx.ui.seg([{ value: 1, label: '1 core' }, { value: 2, label: '2 cores' }], 1, (v) => { cores = v; rerun(); });
          const segB = ctx.ui.seg([{ value: true, label: 'T2 reads from disk' }, { value: false, label: 'No blocking' }], true, (v) => { block = v; rerun(); });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { gap: '14px' } }, h('span', { class: 'small b' }, 'Machine:'), segC, h('span', { class: 'small b' }, 'Thread 2:'), segB, h('span', { class: 'grow' }), h('span', { class: 'small muted' }, 'Predict, then press Play or step.')),
            h('div', { class: 'grid-2', style: { gap: '12px' } }, PU.card, PK.card),
            player.el,
            h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'xs muted b' }, 'YOUR RESULTS: try all four set-ups'), boardEl)));
          rerun();
        },
      },
      /* ---------------- 6. Workarounds: many processes, or jacketing ---------------- */
      {
        title: 'Working around the limits: jacketing',
        kind: 'explore',
        html: `
          <div class="split r fill">
            <div class="stack sec-4-2-s6l" style="gap:10px">
              <p class="m0"><b>ULTs have two big limits:</b> one blocking call stops every thread, and the process cannot use extra processors. Two classic workarounds:</p>
              <div class="grid-2" style="gap:10px">
                <div class="card tight"><b>1 · Use processes, not threads.</b> <span class="small">Fixes <b>both</b> limits: the kernel sees each part, so it can block them separately and spread them over processors. The catch: every switch is now a full process switch, so the cheap switching that made ULTs attractive is gone.</span></div>
                <div class="card tight thread"><b>2 · <span class="t">Jacketing</span>.</b> <span class="small">Fixes <b>blocking only</b>. Wrap each blocking system call in a “jacket”: library code that first checks, without waiting, whether the call would block. If it would, run another thread and try again later.</span></div>
              </div>
            </div>
            <div class="card white stack sec-4-2-s6r" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const L = ctx.$('.sec-4-2-s6l'), R = ctx.$('.sec-4-2-s6r');
          const CODE = {
            jack: `int jacket_read(int fd, char *buf, int n) { // replaces read()
  while (!io_ready(fd)) {    // would read block? (never waits)
    mark_waiting(me, fd);    // yes: this thread waits on fd
    thread_yield();          // run another thread meanwhile
  }                          // resumed later: check again
  return read(fd, buf, n);   // data is there: cannot block
}                            // caller never knew it was wrapped`,
            plain: `void thread2_body(void) {          // Thread 2's code, no jacket
  int n = read(fd, buf, sizeof buf); // system call: can block all of P
  use(buf, n);                       // runs only once P is unblocked
}                                    // T1 and T3 were frozen meanwhile`,
          };
          const F = {
            jack: [
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · Thread 2', 'proc'], ln: null, cap: '<b>Start.</b> Thread 2 is about to read from a device (say, a network connection) whose data has not arrived yet. The program links a thread library that jackets its I/O calls.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · jacket code (user mode)', 'proc'], ln: 1, cap: '<b>T2 calls read.</b> The call lands in the library’s jacket_read(): an ordinary function, so the CPU is still in user mode.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['kernel: quick check', 'os'], ln: 2, cap: '<b>The jacket asks the kernel whether a read would block right now</b> (a nonblocking check, like select() or poll() on UNIX). The kernel answers at once: yes, no data yet. It does not block P.' },
              { T1: 'Ready', T2: 'Waiting', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · library code', 'proc'], ln: 3, cap: '<b>The library notes that T2 waits for this device</b> and marks T2 blocked in its own table. The kernel’s record for P still says Running.' },
              { T1: 'Running', T2: 'Waiting', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · Thread 1', 'proc'], ln: 4, cap: '<b>thread_yield() switches to T1.</b> P keeps its turn on the CPU and spends it on useful work instead of sleeping.' },
              { T1: 'Ready', T2: 'Waiting', T3: 'Running', P: 'Running', dev: 'ready', cpu: ['P · Thread 3', 'proc'], ln: null, cap: '<b>T1 and T3 keep taking turns</b> while T2’s data is on its way. Here the data has just arrived.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'ready', cpu: ['kernel: quick check', 'os'], ln: 2, cap: '<b>When the library gives T2 another turn, the loop repeats the check.</b> This time io_ready() says the data is there, so the loop ends.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'idle', cpu: ['kernel: read() copies data', 'os'], ln: 6, cap: '<b>Now the real read() runs.</b> Because the data is already waiting, it returns immediately. Process P never blocked.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'idle', cpu: ['P · Thread 2', 'proc'], ln: 7, cap: '<b>Net effect:</b> T2 waited, but T1 and T3 kept working the whole time. The price: extra checking calls and a more complicated library.' },
            ],
            plain: [
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['P · Thread 2', 'proc'], ln: null, cap: '<b>Start.</b> Thread 2 is about to read from the same device, whose data has not arrived yet. This time there is no jacket.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'fetching', cpu: ['kernel: read()', 'os'], ln: 2, cap: '<b>T2 calls read() directly.</b> It is a real system call, so the CPU enters kernel mode, and the kernel finds no data waiting.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Blocked', dev: 'fetching', cpu: ['another process', 'panel'], ln: 2, cap: '<b>So the kernel blocks the caller.</b> To the kernel the caller is process P, so all of P is now Blocked, and the kernel runs some other process.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Blocked', dev: 'fetching', cpu: ['another process', 'panel'], ln: 2, cap: '<b>T1 and T3 are ready but frozen.</b> The library cannot switch to them, because none of P’s code is running at all. Its table still says T2 is Running.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Ready', dev: 'ready', cpu: ['another process', 'panel'], ln: 2, cap: '<b>The data arrives</b> and the device interrupts. The kernel moves P from Blocked to Ready; P still has to wait for its turn on the CPU.' },
              { T1: 'Ready', T2: 'Running', T3: 'Ready', P: 'Running', dev: 'idle', cpu: ['P · Thread 2', 'proc'], ln: 3, cap: '<b>The kernel dispatches P.</b> read() copies the data and returns inside T2, which carries on. Compare with the jacketed version, where P never stopped.' },
            ],
          };
          let mode = 'jack', code;
          const codeBox = h('div', {});
          const svg = s('svg', { viewBox: '0 0 440 248', width: '100%', role: 'img', 'aria-label': 'Thread, process, device and CPU state during a read' });
          const SC = { Running: 'var(--thread)', Waiting: 'var(--warn)', Ready: 'var(--ink-2)', Blocked: 'var(--intr)' };
          const why = h('div', { class: 'callout why m0 small' });
          const WHY = {
            jack: ['Why it works', 'The kernel only ever sees quick, nonblocking questions from P, so it never has a reason to block the whole process. All the waiting is bookkeeping inside the library.'],
            plain: ['What goes wrong', 'The kernel blocks whoever made the call. With ULTs, “whoever” is the entire process, so one thread’s read puts every thread to sleep.'],
          };
          // phones: each comment moves onto its own line just above its statement, so nothing is cut off
          const stacked = (src) => src.split('\n').flatMap((ln) => { const i = ln.indexOf('//'), ind = ln.match(/^\s*/)[0]; return [ind + ln.slice(i).trim(), ln.slice(0, i).trimEnd()]; }).join('\n');
          const markLn = (n) => (ctx.narrow ? [2 * n - 1, 2 * n] : n); // original line n → both of its lines when stacked
          function setCode() {
            code = ctx.ui.code(ctx.narrow ? stacked(CODE[mode]) : CODE[mode], { lang: 'c', fontSize: 13, nums: !ctx.narrow }); codeBox.replaceChildren(code);
            why.className = 'callout m0 small ' + (mode === 'jack' ? 'why' : 'bad'); why.dataset.label = WHY[mode][0]; why.textContent = WHY[mode][1];
          }
          function draw(f) {
            const kids = [
              s('text', { x: 0, y: 13, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'THREAD LIBRARY’S TABLE · USER SPACE'),
              s('rect', { x: 0, y: 22, width: 440, height: 76, rx: 10, class: 's-accent', 'stroke-width': 1.2 })];
            ['T1', 'T2', 'T3'].forEach((n, i) => {
              const x = 10 + i * 142, on = f[n] === 'Running';
              kids.push(s('rect', { x, y: 31, width: 132, height: 58, rx: 9, class: 's-thread', 'stroke-width': on ? 3.5 : 1.2 }),
                s('text', { x: x + 66, y: 55, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, 'Thread ' + n.slice(1)),
                s('text', { x: x + 66, y: 77, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, style: `fill:${SC[f[n]]}` }, f[n] === 'Waiting' ? 'Blocked' : f[n]));
            });
            kids.push(s('text', { x: 0, y: 120, 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'KERNEL SPACE'),
              s('rect', { x: 0, y: 128, width: 440, height: 52, rx: 10, class: 's-os', 'stroke-width': 1.2 }),
              s('text', { x: 14, y: 160, 'font-size': 15.5, 'font-weight': 700 }, 'P ='),
              s('text', { x: 46, y: 160, 'font-size': 15.5, 'font-weight': 800, style: `fill:${{ Blocked: 'var(--intr)', Ready: 'var(--ink-2)', Running: 'var(--ok)' }[f.P]}` }, f.P),
              s('rect', { x: 196, y: 136, width: 234, height: 36, rx: 9, class: 's-io', 'stroke-width': f.dev === 'idle' ? 1 : 2.5 }),
              s('text', { x: 313, y: 159, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700 }, { idle: 'device: idle', fetching: 'device: data on its way…', ready: 'device: data ready' }[f.dev]),
              s('rect', { x: 0, y: 194, width: 440, height: 50, rx: 10, class: 's-panel', 'stroke-width': 1 }),
              s('text', { x: 14, y: 224, 'font-size': 15.5, 'font-weight': 700 }, 'CPU runs:'),
              s('rect', { x: 100, y: 203, width: 330, height: 32, rx: 16, class: 's-' + f.cpu[1], 'stroke-width': 2 }),
              s('text', { x: 265, y: 224, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, f.cpu[0]));
            svg.replaceChildren(...kids.filter(Boolean));
            code.clear();
            if (f.ln) code.mark(markLn(f.ln));
          }
          setCode();
          const player = ctx.ui.player({ count: F.jack.length, interval: 2600, speed: false, render: (i) => { const f = F[mode][i]; draw(f); return f.cap; } });
          const seg = ctx.ui.seg([{ value: 'jack', label: 'Jacketed read' }, { value: 'plain', label: 'Plain read()' }], 'jack', (v) => { mode = v; setCode(); player.setCount(F[v].length); });
          L.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'The code being traced'), h('span', { class: 'xs muted' }, 'io_ready, mark_waiting: library helpers')), codeBox, why);
          R.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Trace it'), seg), svg, player.el,
            h('div', { class: 'callout tip m0 small', 'data-label': 'Watch', style: { marginTop: 'auto' } }, 'Keep an eye on the violet kernel row. With the jacket, does P ever turn Blocked? Then switch to Plain read() and compare.'));
        },
      },
      /* ---------------- 7. What each design costs: latency numbers ---------------- */
      {
        title: 'What it costs: ULT vs KLT vs process',
        kind: 'explore',
        html: `
          <div class="split r fill">
            <div class="card white stack sec-4-2-s7c" style="gap:8px"></div>
            <div class="stack sec-4-2-s7r" style="gap:10px">
              <p class="m0">Two classic micro-benchmarks, both run on the same older single-processor machine. The <span class="t">latency</span> of each operation is in microseconds (µs).</p>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const C = ctx.$('.sec-4-2-s7c'), R = ctx.$('.sec-4-2-s7r');
          const DATA = { fork: { name: 'Null fork', ult: 34, klt: 948, proc: 11300 }, sig: { name: 'Signal-wait', ult: 37, klt: 441, proc: 1840 } };
          const KINDS = [['ult', 'ULT', 's-thread'], ['klt', 'KLT', 's-os'], ['proc', 'Process', 's-proc']];
          // chart geometry: a narrower drawing on phones so the labels stay readable after scaling
          const G = ctx.narrow ? { W: 400, X0: 78, BW: 214, FS: 1.2, G2: 128, RG: 34, BH: 26, AX: 248, TL: 268, H: 274 }
                               : { W: 620, X0: 100, BW: 430, FS: 1, G2: 110, RG: 30, BH: 24, AX: 218, TL: 234, H: 240 };
          const { X0, BW, FS } = G;
          let scale = 'lin', shown = null, stopTween = null;
          const nf = (v) => Math.round(v).toLocaleString('en-US');
          const pos = (v, sc) => (sc === 'lin' ? (v / 12000) * BW : Math.max(0, Math.log10(v / 10) / Math.log10(2000)) * BW);
          const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Bar chart of null fork and signal-wait latency' });
          function draw(f) { // f: 0..1 blend from the old scale to the new one
            const kids = [];
            const ticks = scale === 'lin' ? [0, 2000, 4000, 6000, 8000, 10000, 12000] : [10, 100, 1000, 10000];
            ticks.forEach((tv) => { const x = X0 + pos(tv, scale); kids.push(s('line', { x1: x, y1: 18, x2: x, y2: G.AX, class: 's-muted', 'stroke-width': 1 }), s('text', { x, y: G.TL, 'text-anchor': 'middle', 'font-size': 12.5 * FS, class: 's-sub' }, tv >= 1000 ? tv / 1000 + (scale === 'lin' ? 'k' : ',000') : String(tv))); });
            kids.push(s('text', { x: G.W - 8, y: G.TL, 'text-anchor': 'end', 'font-size': 12.5 * FS, class: 's-sub' }, 'µs'));
            [['fork', 0], ['sig', G.G2]].forEach(([key, y0]) => {
              const d = DATA[key];
              kids.push(s('text', { x: 0, y: y0 + 15, 'font-size': 14.5 * FS, 'font-weight': 800 }, d.name));
              KINDS.forEach(([k, lab, cls], i) => {
                const y = y0 + 21 + i * G.RG, v = d[k], ty = y + G.BH / 2 + 5 * FS;
                const w = Math.max(3, (shown ? pos(v, shown) * (1 - f) : 0) + pos(v, scale) * (shown ? f : 1));
                kids.push(s('text', { x: X0 - 8, y: ty, 'text-anchor': 'end', 'font-size': 14 * FS, 'font-weight': 700 }, lab),
                  s('rect', { x: X0, y, width: w, height: G.BH, rx: 5, class: cls, 'stroke-width': 2 }),
                  s('text', { x: X0 + w + 7, y: ty, 'font-size': 14 * FS, 'font-weight': 800 }, nf(v) + ' µs'));
              });
            });
            svg.replaceChildren(...kids.filter(Boolean));
          }
          function setScale(v) {
            if (stopTween) stopTween();
            shown = scale; scale = v;
            const t0 = performance.now();
            stopTween = ctx.raf((now) => { const f = Math.min(1, (now - t0) / 450); draw(1 - Math.pow(1 - f, 3)); if (f >= 1) { shown = null; return false; } });
          }
          const segS = ctx.ui.seg([{ value: 'lin', label: 'Linear scale' }, { value: 'log', label: 'Log scale' }], 'lin', setScale);
          C.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Measured latency'), segS), svg,
            h('div', { class: 'small' }, h('b', {}, h('span', { class: 't', 'data-t': 'Null fork' }, 'Null fork'), ': '), 'create, schedule, run and finish a thread or process whose body is empty. ', h('b', {}, h('span', { class: 't', 'data-t': 'Signal-wait' }, 'Signal-wait'), ': '), 'one signals a waiting partner, then waits itself (the cost of synchronizing two).'),
            h('div', { class: 'xs muted' }, 'On a linear scale the ULT bars are almost invisible: that is the point. Switch to the log scale, where each grid line is 10× the one before, to compare all six.'),
            h('div', { class: 'callout warn m0 small', 'data-label': 'Keep it in proportion', style: { marginTop: 'auto' } }, 'Today’s absolute numbers are far smaller, but the pattern holds. And if most of an application’s thread switches need kernel services anyway, the ULT speed advantage shrinks.'));
          draw(1);
          // ---- calculator
          let op = 'fork', n = 1000;
          const ratios = h('div', { class: 'stack', style: { gap: '4px' } });
          const totals = h('div', { class: 'grid-3', style: { gap: '6px' } });
          const fmtT = (us) => (us < 1000 ? ctx.util.fmt(us, 0) + ' µs' : us < 1e6 ? ctx.util.fmt(us / 1000, 1) + ' ms' : ctx.util.fmt(us / 1e6, 2) + ' s');
          function calc() {
            const d = DATA[op];
            const what = op === 'fork' ? 'null fork' : 'signal-wait';
            ratios.replaceChildren(...[[d.proc / d.ult, 'process', 'ULT'], [d.klt / d.ult, 'KLT', 'ULT'], [d.proc / d.klt, 'process', 'KLT']].map(([r, a, b]) =>
              h('div', { class: 'kv small' }, h('span', {}, `1 ${a} ${what} lasts as long as`), h('span', { class: 'mono b', style: { whiteSpace: 'nowrap' } }, `≈ ${ctx.util.fmt(r, r >= 100 ? 0 : 1)} ${b} ones`))));
            totals.replaceChildren(...KINDS.map(([k, lab]) => {
              const pct = (d[k] * n) / 1e4; // share of one second, in %: (µs per op × N) ÷ 1,000,000 µs × 100
              const load = pct > 100 ? 'cannot keep up' : (pct < 0.1 ? '< 0.1' : ctx.util.fmt(pct, 1)) + '% of the CPU';
              return h('div', { class: 'card tight', style: { textAlign: 'center', padding: '6px 8px' } }, h('div', { class: 'xs muted b' }, lab),
                h('div', { class: 'b mono', style: { fontSize: '16px', color: 'var(--chc)' } }, fmtT(d[k] * n)),
                h('div', { class: 'xs', style: { color: pct > 100 ? 'var(--bad)' : pct > 25 ? 'var(--warn)' : 'var(--ok)', fontWeight: 700 } }, load));
            }));
          }
          const segO = ctx.ui.seg([{ value: 'fork', label: 'Null fork' }, { value: 'sig', label: 'Signal-wait' }], 'fork', (v) => { op = v; calc(); });
          const sl = ctx.ui.slider({ label: 'Do it N times', min: 0, max: 4, step: 0.5, value: 3, format: (v) => 'N = ' + nf(Math.round(Math.pow(10, v))), onInput: (v) => { n = Math.round(Math.pow(10, v)); calc(); } });
          R.append(h('div', { class: 'card stack', style: { gap: '8px', flex: 'none' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Calculator'), segO), ratios, sl, totals,
            h('div', { class: 'xs muted' }, 'Top: total time for N operations. Bottom: the share of one processor they would use if a program needed N of them every second.')),
            h('div', { class: 'callout why m0 small', 'data-label': 'Why the gaps' }, 'A ULT operation is just a library call. A KLT operation must enter the kernel: two mode switches plus kernel bookkeeping. A process operation must also build or switch a whole address space and its resources.'));
          calc();
        },
      },
      /* ---------------- 8. Combined approach: M ULTs on N KLTs ---------------- */
      {
        title: 'Best of both: the combined approach',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:10px">
              <p class="m0">A <span class="t" data-t="combined approach">combined approach</span> mixes the two designs; older versions of Solaris are the classic example. The application creates its threads with library calls, and the library also does most of their scheduling and synchronization, all in user space.</p>
              <p class="m0">Underneath, the library runs the application’s <b>M</b> user-level threads on a <b>smaller or equal number N</b> of kernel-level threads. The programmer can tune N to suit the application and the machine.</p>
              <div class="callout tip m0 small" data-label="Done well, you get both">Most thread operations stay cheap library calls, yet threads of one application can run in parallel on several processors, and one blocking system call no longer stops the whole process.</div>
              <div class="card tight small"><b>Names you may meet.</b> Running M ULTs on N KLTs is often called the <b>many-to-many</b> model. With N = 1 it shrinks to <b>many-to-one</b> (pure ULTs); with one KLT per ULT it becomes <b>one-to-one</b> (pure KLTs). These names describe how <b>user-level threads map onto kernel-level threads</b>, nothing else.</div>
              <p class="xs muted m0">Section 4.5 shows how Solaris built this with <span class="t" data-t="Solaris lightweight process">lightweight processes</span>: kernel-scheduled carriers for user-level threads.</p>
            </div>
            <div class="card white stack sec-4-2-s8" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          {
            let N = 2, cores = 2, blk = false;
            const M = 6;
            // geometry: 600 wide on desktop; a 360-wide drawing on phones so labels stay readable after scaling
            const NW = ctx.narrow, W = NW ? 360 : 600, UX = (W - 24) / M, UW = UX - (NW ? 8 : 16), KG = NW ? 8 : 12, CG = NW ? 10 : 16;
            const ux = (i) => 12 + i * UX, uc = (i) => ux(i) + UW / 2;
            const svg = s('svg', { viewBox: `0 0 ${W} 292`, width: '100%', role: 'img', 'aria-label': 'Six user-level threads mapped onto kernel-level threads and cores' });
            const out = h('div', { class: 'stack', style: { gap: '6px' } });
            function draw() {
              let map = Array.from({ length: M }, (_, i) => Math.floor((i * N) / M)); // contiguous groups, no crossing lines
              const kb = map[1];                                                       // the KLT under U2
              const movedNames = map.map((k, i) => (i !== 1 && k === kb ? 'U' + (i + 1) : null)).filter(Boolean); // U2's neighbours on that KLT
              const moved = movedNames.length;
              if (blk && N > 1) map = map.map((k, i) => (i !== 1 && k === kb ? (kb + 1) % N : k)); // library moves U2's neighbours away
              const alive = Array.from({ length: N }, (_, k) => k).filter((k) => !(blk && k === kb));
              const running = alive.slice(0, cores);
              const kw = Math.min(90, (W - 24 - (N - 1) * KG) / N), kx = (k) => W / 2 - (N * kw + (N - 1) * KG) / 2 + k * (kw + KG);
              const cw = cores === 2 ? 130 : NW ? 76 : 110, cx = (c) => W / 2 - (cores * cw + (cores - 1) * CG) / 2 + c * (cw + CG);
              const kids = [
                s('text', { x: 0, y: 12, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, NW ? 'USER SPACE: 6 ULTs' : 'USER SPACE: 6 ULTs, created and scheduled by the library'),
                s('line', { x1: 0, y1: 104, x2: W, y2: 104, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.2 }),
              ];
              map.forEach((k, i) => kids.push(s('line', { x1: uc(i), y1: 56, x2: kx(k) + kw / 2, y2: 132, style: `stroke:${blk && i === 1 ? 'var(--intr)' : 'var(--thread)'};stroke-width:2`, opacity: 0.85 })));
              kids.push(s('text', { x: 0, y: 122, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em', style: 'paint-order:stroke;stroke:var(--panel);stroke-width:6px;stroke-linejoin:round' }, `KERNEL SPACE: ${N} KLT${N > 1 ? 's' : ''}`));
              kids.push(s('rect', { x: 12, y: 66, width: W - 24, height: 26, rx: 7, class: 's-accent', 'stroke-width': 1.2 }),
                s('text', { x: W / 2, y: 84, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'thread library: maps ULTs onto KLTs'));
              for (let i = 0; i < M; i++) {
                const frozen = blk && (N === 1 || i === 1);
                kids.push(s('rect', { x: ux(i), y: 22, width: UW, height: 34, rx: 8, class: frozen ? 's-bad' : 's-thread', 'stroke-width': 2 }),
                  s('text', { x: uc(i), y: 44, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'U' + (i + 1)));
              }
              for (let k = 0; k < N; k++) {
                const isB = blk && k === kb, run = running.indexOf(k), tight = kw < 60;
                kids.push(s('rect', { x: kx(k), y: 132, width: kw, height: 42, rx: 8, class: isB ? 's-bad' : 's-os', 'stroke-width': run >= 0 ? 3 : 1.4 }),
                  s('text', { x: kx(k) + kw / 2, y: 150, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, (tight ? 'K' : 'KLT ') + (k + 1)),
                  s('text', { x: kx(k) + kw / 2, y: 167, 'text-anchor': 'middle', 'font-size': 12.5, style: isB ? 'fill:var(--intr)' : '', class: isB ? '' : 's-sub' }, isB ? (tight ? 'block' : 'blocked') : run >= 0 ? (tight ? 'run' : 'running') : 'ready'));
                if (run >= 0) kids.push(s('line', { x1: kx(k) + kw / 2, y1: 174, x2: cx(run) + cw / 2, y2: 236, class: 's-line', 'marker-end': 'url(#arr-cpu)', style: 'stroke:var(--cpu)' }));
              }
              for (let c = 0; c < cores; c++) {
                const idle = c >= running.length;
                kids.push(s('rect', { x: cx(c), y: 240, width: cw, height: 40, rx: 8, class: 's-cpu', 'stroke-width': 2, opacity: idle ? 0.6 : 1 }),
                  s('text', { x: cx(c) + cw / 2, y: idle ? 257 : 265, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, `Core ${c + 1}`),
                  ...(idle ? [s('text', { x: cx(c) + cw / 2, y: 274, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'idle')] : []));
              }
              svg.replaceChildren(...kids.filter(Boolean));
              const par = running.length;
              const like = N === 1 ? 'pure ULTs (many-to-one)' : N === M ? 'pure KLTs (one-to-one)' : 'a true hybrid (many-to-many)';
              out.replaceChildren(
                h('div', { class: 'kv small' }, h('span', {}, 'ULT threads of this app running at the same moment'), h('b', { class: 'mono' }, String(par))),
                h('div', { class: 'kv small' }, h('span', {}, 'With N = ' + N + ' this behaves like'), h('b', {}, like)),
                h('div', { class: 'small', html: !blk ? 'Press <b>U2 makes a blocking call</b> to see what happens to the others.' : N === 1 ? '<b style="color:var(--intr)">Everything stops.</b> The only KLT is blocked, so, exactly as with pure ULTs, all six threads wait.' : `<b style="color:var(--ok)">Only U2 waits.</b> KLT ${kb + 1} is blocked with U2 on it; ` + (moved ? `the library moved ${movedNames.join(' and ')}, which shared it, to KLT ${(kb + 1) % N + 1}, so the process keeps running.` : 'every other ULT has its own KLT, so they all carry on.') }));
            }
            const slN = ctx.ui.slider({ label: 'Kernel-level threads N', min: 1, max: 6, value: 2, onInput: (v) => { N = v; draw(); } });
            const segC = ctx.ui.seg([{ value: 2, label: '2 cores' }, { value: 4, label: '4 cores' }], 2, (v) => { cores = v; draw(); });
            const bB = h('button', { class: 'btn sm intr', onclick: () => { blk = !blk; bB.classList.toggle('on', blk); bB.textContent = blk ? 'U2’s call finishes' : 'U2 makes a blocking call'; draw(); } }, 'U2 makes a blocking call');
            ctx.$('.sec-4-2-s8').append(h('div', { class: 'row', style: { gap: '10px' } }, h('div', { class: 'grow' }, slN), segC), svg,
              h('div', { class: 'row', style: { gap: '10px' } }, bB, h('span', { class: 'xs muted' }, 'Drag N from 1 to 6, with and without the blocking call.')), out);
            draw();
          }
        },
      },
      /* ---------------- 9. Thread : process arrangements ---------------- */
      {
        title: 'How many threads per process? Four arrangements',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack sec-4-2-s9l" style="gap:10px">
              <p class="m0 small">A different question from ULT vs KLT: how many <b>threads</b> live in how many <b>processes</b> (an <span class="t">address space</span> plus resources)? The answer is written as a ratio, <b>threads : processes</b>, and it describes one process, not a whole system as in section 4.1’s models.</p>
            </div>
            <div class="card white stack sec-4-2-s9r" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          {
            const R = {
              // lab = button label (spells out "threads : processes" so it cannot be mistaken for the ULT→KLT mapping names)
              '1:1': { lab: '1 thread : 1 process', t: 'One thread per process', d: 'Every path of execution is its own process, with a private address space and its own resources. Making or switching a “thread” means making or switching a whole process.', ex: ['Traditional UNIX'] },
              'M:1': { lab: 'M threads : 1 process', t: 'Many threads in one process', d: 'One process owns the address space and the resources, and any number of threads run inside it, sharing all of them. This is the everyday case, and the one the rest of this chapter assumes.', ex: ['Windows NT', 'Solaris', 'Linux', 'OS X', 'iOS'] },
              '1:M': { lab: '1 thread : M processes', t: 'One thread, several process environments', d: 'A thread can <span class="t" data-t="thread migration">migrate</span> out of one process environment (address space plus resources) into another, even on a different computer, to follow the data it works on. An idea from distributed-systems research.', ex: ['Ra (Clouds)', 'Emerald'] },
              'M:N': { lab: 'M threads : N processes', t: 'Many threads, many environments', d: 'Both ideas at once: a process holds many threads, and those threads can also migrate from one process environment to another. Also from distributed-systems research.', ex: ['TRIX'] },
            };
            const nm = (k) => `${R[k].lab} (${k.replace(':', ' : ')})`;
            // geometry: 600 x 238 on desktop; a narrower 360 x 250 drawing on phones (resource chips stack there)
            const NW = ctx.narrow, W = NW ? 360 : 600, H = NW ? 250 : 238;
            const CWID = (W - 16) / 2, SHIFT = CWID + 4; // computer width; how far a migrating thread travels, A to B
            let mode = 'M:1', away = false, mover = null;
            const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Threads and processes arrangement' });
            const info = h('div', { class: 'card stack', style: { gap: '8px', flex: 'none' } });
            const wave = (x, y) => s('g', {}, s('path', { d: `M ${x} ${y} q 10 7 0 14` + ' t 0 14'.repeat(3), fill: 'none', style: 'stroke:var(--thread);stroke-width:3.5;stroke-linecap:round' }),
              s('path', { d: `M ${x - 7} ${y + 54} L ${x + 7} ${y + 54} L ${x} ${y + 65} Z`, style: 'fill:var(--thread)' }));
            const proc = (x, y, w, hh, lab, sub, stackChips) => [s('rect', { x, y, width: w, height: hh, rx: 12, class: 's-proc', 'stroke-width': 2 }),
              s('text', { x: x + 10, y: y + 24, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, lab),
              ...[['memory', 's-mem', 68], ['files', 's-io', 50]].flatMap(([l, c, cw], j) => {
                const cx = x + 10 + (stackChips ? 0 : j * 74), cy = y + hh - (stackChips ? 80 - j * 28 : 58);
                return [s('rect', { x: cx, y: cy, width: cw, height: 22, rx: 11, class: c, 'stroke-width': 1.5 }), s('text', { x: cx + cw / 2, y: cy + 16, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, l)];
              }),
              s('text', { x: x + 10, y: y + hh - 12, 'font-size': 13, class: 's-sub' }, sub)];
            const title = (txt) => s('text', { x: W / 2, y: 17, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, txt);
            function draw() {
              const kids = [];
              mover = null;
              const top = 30, ph = H - 34;
              if (mode === '1:1') {
                const bw = (W - 16 - 2 * 8) / 3;
                kids.push(title('3 threads → 3 processes'));
                [0, 1, 2].forEach((i) => { const x = 8 + i * (bw + 8); kids.push(...proc(x, top, bw, ph, NW ? 'Proc. ' + (i + 1) : 'Process ' + (i + 1), NW ? 'own space' : 'own address space', NW), wave(x + bw / 2, top + 40)); });
              } else if (mode === 'M:1') {
                const x = NW ? 10 : 40, w = W - 2 * x;
                kids.push(title('3 threads → 1 process'), ...proc(x, top, w, ph, 'Process', NW ? 'one shared space + resources' : 'one shared address space + resources', false));
                [0, 1, 2].forEach((i) => kids.push(wave(W / 2 + (i - 1) * (NW ? 80 : 110), top + 40)));
              } else {
                const mn = mode === 'M:N';
                kids.push(title(mn ? (NW ? 'many threads; threads can move' : 'many threads per process, and threads can move') : (NW ? '1 thread that moves' : '1 thread that moves between process environments')));
                [0, 1].forEach((m) => kids.push(s('rect', { x: 6 + m * SHIFT, y: 28, width: CWID, height: H - 30, rx: 14, class: 's-muted', 'stroke-dasharray': '6 5', 'stroke-width': 1.5 }),
                  s('text', { x: 18 + m * SHIFT, y: 46, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'Computer ' + 'AB'[m]),
                  ...proc(16 + m * SHIFT, 54, CWID - 20, H - 64, (NW ? 'Env. ' : 'Process env. ') + 'AB'[m], NW ? 'space + resources' : 'address space + resources', NW)));
                const sx = NW ? [36, 66] : [70, 125], mx = NW ? 128 : 210;
                if (mn) [...sx, ...sx.map((x) => x + SHIFT)].forEach((x) => kids.push(wave(x, 90)));
                kids.push(s('rect', { x: W / 2 - 44, y: 106, width: 88, height: 24, rx: 12, class: 's-panel', 'stroke-width': 1.2 }),
                  s('text', { x: W / 2, y: 123, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'migrates ⇄'));
                mover = s('g', { style: `transform: translate(${away ? SHIFT : 0}px, 0px); transition: transform .9s ease` }, wave(mx, 90),
                  s('text', { x: mx, y: 82, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, NW ? 'this one' : 'this thread'));
                kids.push(mover);
              }
              svg.replaceChildren(...kids.filter(Boolean));
              const r = R[mode];
              info.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } }, h('h3', { class: 'm0' }, r.t), h('span', { class: 'tp-note' }, 'threads : processes = ' + mode.replace(':', ' : '))), h('p', { class: 'm0 small', html: r.d }),
                h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'xs muted b' }, 'EXAMPLES'), ...r.ex.map((x) => h('span', { class: 'chip proc' }, x))));
            }
            ctx.every(2200, () => { away = !away; if (mover) mover.style.transform = `translate(${away ? SHIFT : 0}px, 0px)`; });
            const seg = ctx.ui.seg(Object.keys(R).map((k) => ({ value: k, label: R[k].lab })), mode, (v) => { mode = v; draw(); });
            seg.classList.add('tp');
            ctx.$('.sec-4-2-s9l').append(seg, info,
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake: M : 1 is not many-to-one', html: 'These ratios count <b>threads per process</b>. They are a different idea from the <b>many-to-one mapping</b> of the previous step, where many user-level threads share one kernel-level thread. A Linux process with 50 threads is “M threads : 1 process”, yet each of its threads has its own KLT (a one-to-one mapping).' }));
            /* ---- sorting game: which arrangement does each description show? ---- */
            const ITEMS = [
              ['Classic UNIX: every running program is a process with exactly one thread of control.', '1:1', 'one path of execution per process.'],
              ['A Linux web server process runs 50 threads that share its memory and open files.', 'M:1', 'many threads live inside one process and share it.'],
              ['Emerald: a thread follows the object it works on to another computer and carries on there.', '1:M', 'a single thread migrates between process environments.'],
              ['TRIX: a process holds many threads, and a thread can also move to another process environment.', 'M:N', 'many threads per process, plus migration.'],
              ['A Windows browser process starts a new thread for each file it downloads.', 'M:1', 'all those threads belong to the one browser process.'],
              ['Starting a new “thread” means creating a whole new process with its own address space.', '1:1', 'each thread needs a process of its own.'],
              ['Ra, the kernel of the Clouds system: one thread can travel from one address space to another.', '1:M', 'one thread visits several process environments.'],
            ];
            const MEANS = { '1:1': 'That would mean each thread is a separate process of its own.', 'M:1': 'That would mean many threads that share one process and never leave it.', '1:M': 'That would mean one thread that migrates between process environments.', 'M:N': 'That would mean many threads per process that can also migrate.' };
            let order = ITEMS.map((_, i) => i), at = 0, tries = 0, right = 0, solved = false, res = [];
            const dots = h('div', { class: 'row', style: { gap: '6px', marginTop: 'auto' } });
            const paintDots = () => dots.replaceChildren(h('span', { class: 'xs muted b' }, 'PROGRESS'), ...ITEMS.map((_, i) => h('span', { class: 'chip ' + (res[i] || (i === at ? 'accent' : '')), title: res[i] === 'ok' ? 'right first try' : res[i] === 'warn' ? 'needed another try' : '' }, String(i + 1))),
              h('span', { class: 'xs muted' }, 'green = right first try, amber = needed another go'));
            const scoreEl = h('span', { class: 'small b' });
            const prompt = h('div', { class: 'card tight b', style: { minHeight: '50px', display: 'flex', alignItems: 'center', fontSize: '15.5px' } });
            const fb = h('div', { class: 'small', style: { minHeight: '42px' } });
            const nextB = h('button', { class: 'btn sm primary', onclick: () => { if (at < ITEMS.length - 1) { at++; show(); } else restart(); } }, 'Next →');
            const opts = Object.keys(R).map((k) => h('button', { class: 'btn sm', onclick: () => pick(k) }, R[k].lab));
            function show() {
              const [txt] = ITEMS[order[at]];
              tries = 0; solved = false; nextB.style.visibility = 'hidden'; opts.forEach((b) => { b.disabled = false; b.className = 'btn sm'; });
              prompt.textContent = `${at + 1}/${ITEMS.length} · ${txt}`;
              fb.innerHTML = '<span class="muted">Which arrangement is this? Press your answer above.</span>';
              scoreEl.textContent = `${right} right first try`; paintDots();
            }
            function pick(k) {
              if (solved) return;
              const [, ans, why] = ITEMS[order[at]];
              tries++;
              const b = opts[Object.keys(R).indexOf(k)];
              if (k !== ans) { b.className = 'btn sm nope'; b.disabled = true; fb.innerHTML = `<b style="color:var(--bad)">Not ${R[k].lab}.</b> ${MEANS[k]} Try another.`; return; }
              solved = true; if (tries === 1) right++; res[at] = tries === 1 ? 'ok' : 'warn'; paintDots();
              b.className = 'btn sm okay';
              mode = ans; seg.set(ans); draw();
              const last = at === ITEMS.length - 1;
              fb.innerHTML = `<b style="color:var(--ok)">Yes, ${nm(ans)}:</b> ${why}` + (last ? ` <b>All sorted: ${right} of ${ITEMS.length} right first try.</b>` : ' The diagram now shows it.');
              scoreEl.textContent = `${right} right first try`;
              nextB.textContent = last ? 'Play again' : 'Next →'; nextB.style.visibility = 'visible';
            }
            function restart() { order = ctx.util.shuffle(ITEMS.map((_, i) => i)); at = 0; right = 0; res = []; show(); }
            ctx.$('.sec-4-2-s9r').append(svg,
              h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '2px' } }, h('b', {}, 'Sort it: which threads : processes ratio?'), scoreEl),
              prompt, h('div', { class: 'row sec-4-2-ans', style: { gap: '8px', flexWrap: 'nowrap' } }, h('span', { class: 'small b' }, 'Answer:'), h('div', { class: 'tp-ans', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : null }, ...opts), h('span', { class: 'grow' }), nextB), fb, dots);
            draw(); show();
          }
        },
      },
      /* ---------------- 10. Recap ---------------- */
      {
        title: 'Recap: ULT vs KLT at a glance',
        kind: 'recap',
        html: `
          <div class="split r fill">
            <div class="stack" style="gap:8px">
              <table class="tbl compact">
                <tr><th style="width:27%"></th><th style="width:36%">User-level threads</th><th>Kernel-level threads</th></tr>
                <tr><td class="b">Who manages threads</td><td>A thread library in user space</td><td>The kernel</td></tr>
                <tr><td class="b">What the kernel schedules</td><td>The whole process</td><td>Each individual thread</td></tr>
                <tr><td class="b">Thread switch</td><td>A library call: no mode switch</td><td>A mode switch into the kernel and back</td></tr>
                <tr><td class="b">One thread’s blocking call</td><td>Blocks every thread (unless jacketed)</td><td>Blocks only that thread</td></tr>
                <tr><td class="b">Several processors</td><td>One thread of the process at a time</td><td>Threads run truly in parallel</td></tr>
                <tr><td class="b">Scheduling policy</td><td>Chosen by the application</td><td>The kernel’s policy</td></tr>
                <tr><td class="b">Needs OS support?</td><td>No: runs on any OS</td><td>Yes: kernel thread support</td></tr>
                <tr><td class="b">Null fork / signal-wait</td><td class="mono">34 / 37 µs</td><td class="mono">948 / 441 µs <span class="muted">(process: 11,300 / 1,840)</span></td></tr>
              </table>
              <div class="callout tip m0 small" data-label="The middle road">The combined approach creates and schedules threads in user space but maps M ULTs onto N ≤ M KLTs, keeping most of the speed of ULTs and the parallelism and independent blocking of KLTs.</div>
            </div>
            <div class="stack sec-4-2-s9" style="gap:8px"><p class="m0 b">Say the answer out loud, then flip.</p></div>
          </div>`,
        render(el, ctx) {
          ctx.$('.sec-4-2-s9').append(ctx.ui.flipcards([
            ['What is jacketing?', 'Library code that turns a blocking system call into a quick nonblocking check. If the call would block, the library runs another thread and retries later.'],
            ['Library says Running, kernel says Blocked. Bug?', 'No. With ULTs, when a system call blocks the process (or its time slice ends), no library code runs, so its table is not updated. The thread resumes when the process runs again.'],
            ['Threads : processes ratios 1:1, M:1, 1:M, M:N: examples?', '1:1 traditional UNIX · M:1 Windows NT, Solaris, Linux, OS X, iOS · 1:M Ra (Clouds), Emerald · M:N TRIX. (Not the ULT-to-KLT mapping names.)'],
            ['Why is a KLT operation slower than a ULT one?', 'It must enter the kernel: a mode switch in and out plus kernel bookkeeping. A process operation also sets up or switches a whole address space.'],
          ], { cols: 1, height: 104 }));
        },
      },
      /* ---------------- 11. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A program uses pure user-level threads. Thread 2 calls read() on a file whose data is not in memory yet. What happens?',
            choices: ['Only Thread 2 blocks; the library immediately runs Thread 1', 'The whole process blocks, and the library’s table still shows Thread 2 as Running', 'The kernel blocks Thread 2 and schedules Thread 1 of the same process', 'The call fails, because user-level threads may not make system calls'],
            answer: 1,
            feedback: ['That is what jacketing or kernel-level threads achieve. A plain read() is a real system call, and the kernel blocks the caller it knows about: the whole process.', null, 'The kernel cannot schedule Thread 1: with ULTs it does not even know Thread 1 exists.', 'ULTs can make system calls. The trouble is what the kernel does when one of those calls blocks.'],
            why: 'With ULTs the kernel sees only the process, so a blocking system call blocks the process as a whole. No library code runs while the process is blocked, so the library still records Thread 2 as Running; when the I/O completes and the process runs again, Thread 2 simply continues.' },
          { type: 'tf', q: 'Switching between two user-level threads of the same process requires a mode switch into the kernel.', answer: false,
            why: 'A ULT switch is done by library code in user mode, so it avoids the two mode switches (into the kernel and back out) that a KLT switch needs.' },
          { type: 'multi', q: 'Which of these are advantages of kernel-level threads over pure user-level threads? Select all that apply.',
            choices: ['Threads of the same process can run at the same moment on different processors', 'If one thread blocks, another thread of the same process can still run', 'Kernel routines themselves can be multithreaded', 'Switching between threads of the same process needs no mode switch', 'Each application can pick its own thread-scheduling policy without kernel changes'],
            answer: [0, 1, 2],
            why: 'The first three are the classic KLT advantages. The last two describe ULTs: their switches stay in user mode, and their library can use any scheduling policy the application likes.' },
          { type: 'num', q: 'Creating an empty ULT (null fork) took 34 µs; creating an empty process took 11,300 µs. How many ULT creations fit in the time of one process creation? Round to the nearest whole number.',
            answer: 332, tol: 1, unit: 'ULT creations',
            why: '11,300 ÷ 34 ≈ 332.4, so about 332 ULT creations cost as much as creating one process.' },
          { type: 'num', q: 'Signal-wait took 37 µs with user-level threads and 441 µs with kernel-level threads. How many times slower is the KLT version? Give one decimal place.',
            answer: 11.9, tol: 0.1, unit: '×',
            why: '441 ÷ 37 ≈ 11.9. Most of the extra cost is the trip into the kernel and back that every KLT synchronization needs.' },
          { type: 'bucket', q: 'Does each statement describe user-level threads or kernel-level threads?', buckets: ['User-level threads', 'Kernel-level threads'],
            items: [['The kernel keeps a context record for every thread', 1], ['Can run on an operating system that knows nothing about threads', 0], ['A thread switch needs a mode switch into the kernel', 1], ['One blocking system call stops every thread of the process', 0], ['The scheduling policy can be tailored to the application', 0], ['Two threads of one process can use two cores at the same moment', 1]],
            why: 'ULTs live entirely in a user-space library: portable, cheap and customizable, but invisible to the kernel. KLTs are known to the kernel: parallel and independently blockable, but every switch goes through the kernel.' },
          { type: 'order', q: 'A process uses ULTs, and Thread 2 makes a blocking system call. Put the events in order.',
            items: ['Thread 2 makes the system call and the CPU enters the kernel', 'The kernel starts the I/O and moves the process to Blocked', 'The kernel runs another process; the library still lists Thread 2 as Running', 'The I/O completes and the kernel moves the process to Ready', 'The process is dispatched and execution resumes inside Thread 2'],
            why: 'Every state change here happens in the kernel, at the level of the whole process. The library is frozen along with the process, so Thread 2’s entry in the library’s table never changes.' },
          { type: 'match', q: 'Match each threads : processes ratio (threads per process, not the ULT-to-KLT mapping) with its meaning and an example system.',
            pairs: [['1 : 1', 'Each thread is its own process (UNIX)'], ['M : 1', 'Threads share one process (Windows NT)'], ['1 : M', 'One thread migrates (Emerald, Ra)'], ['M : N', 'Many threads that migrate (TRIX)']],
            why: 'The ratio is threads : processes. 1 : 1 gives every thread its own process (traditional UNIX); M : 1 packs many threads into one process (Windows NT, Solaris, Linux, OS X, iOS); 1 : M lets a single thread move between process environments (Emerald, Ra on Clouds); M : N combines the last two (TRIX). This is a different idea from the many-to-one ULT-to-KLT mapping: a Linux process is M : 1 here, yet each of its threads has its own kernel-level thread.' },
          { q: 'What does jacketing do?',
            choices: ['Converts a blocking system call into a nonblocking check, so the thread library can run another thread instead of letting the process block', 'Wraps each ULT in its own process so the kernel can see it', 'Lets the kernel read the thread library’s table so it can schedule individual ULTs', 'Lengthens the process’s time slice so a blocked thread has time to finish'],
            answer: 0,
            feedback: [null, 'That would turn threads into processes (the other workaround), which gives up cheap thread switching.', 'The kernel still never sees the ULTs; jacketing works entirely inside the library.', 'Time slices have nothing to do with it; the problem being solved is blocking system calls.'],
            why: 'The jacket first asks the kernel, without waiting, whether the call would block. If it would, the library parks the thread and runs another one, retrying later, so the process as a whole never blocks.' },
          { q: 'Which statement best describes the combined (hybrid) approach, as used by older versions of Solaris?',
            choices: ['Threads are created and mostly scheduled in user space, and M user-level threads are mapped onto N ≤ M kernel-level threads', 'Every kernel-level thread is split into several processes so the kernel can schedule them', 'The kernel creates every thread and the library only gives them names', 'Each ULT always gets exactly one KLT, and the programmer cannot change the number'],
            answer: 0,
            feedback: [null, 'This mixes up threads and processes; the hybrid is about mapping ULTs onto KLTs.', 'In the hybrid, creation happens in user space, which is what keeps it cheap.', 'N may be smaller than M, and the programmer can tune it for the application and the machine.'],
            why: 'The library does most thread work cheaply in user space, while the N kernel-level threads let the process use several processors and keep one blocking call from stopping everything.' },
          { type: 'tf', q: 'When a clock interrupt ends the time slice of a process that uses ULTs, the thread library changes the running thread’s state to Ready.', answer: false,
            why: 'The kernel moves the process to Ready. The library does not run at all during this, so its table still shows the thread as Running, and that thread simply continues when the process is dispatched again.' },
          { q: 'Process B uses user-level threads. Thread 2 is running and must wait until Thread 1 fills a buffer, so it calls the library’s wait routine. Which states result?',
            choices: ['Library: Thread 2 Blocked, Thread 1 Running. Kernel: B stays Running', 'Library: Thread 2 Blocked, Thread 1 Running. Kernel: B becomes Blocked', 'Library: Thread 2 still Running. Kernel: B becomes Blocked', 'Library: Thread 2 Blocked, Thread 1 Ready. Kernel: B becomes Ready'],
            answer: 0,
            feedback: [null, 'The kernel was never asked to do anything: the wait was a plain library call, not a system call, so the kernel has no reason to block B.', 'That is what happens when Thread 2 makes a blocking system call. Waiting for another thread of the same process is handled by the library alone.', 'Nothing stops B from running: the library switches straight to Thread 1, which can do useful work. B only becomes Ready when the kernel takes the processor away, for example at the end of its time slice.'],
            why: 'Waiting for another thread is a library matter. The library blocks Thread 2 and switches to Thread 1 in user mode, while the kernel keeps seeing process B executing instructions, so B stays Running.' },
        ],
      },
    ],

    notes: `
<h3>Two ways to manage threads</h3>
<p>Every thread needs a manager: something must create it, decide when it runs, and save and restore its place when it pauses. With <b>user-level threads (ULTs)</b> a thread library inside the application does that job and the kernel never learns the threads exist. With <b>kernel-level threads (KLTs)</b>, also called kernel-supported threads or lightweight processes (the general name for a thread from section 4.1; Solaris gives it a narrower meaning, see 4.5), the kernel manages every thread itself. A <b>combined approach</b> mixes the two.</p>

<h3>User-level threads</h3>
<p>The application manages its own threads through a <b>thread library</b>: ordinary routines linked into the program that run in user mode. Its four jobs: <b>create and destroy threads</b>, <b>pass messages and data between threads</b>, <b>schedule</b> which thread runs next, and <b>save and restore thread contexts</b> (program counter, stack pointer and other registers). The kernel knows none of this: it schedules the <b>process as a single unit</b> with one execution state (Running, Ready or Blocked).</p>

<h4>How ULT states relate to the process state</h4>
<p>Start: process B has two ULTs; the library says Thread 2 Running, Thread 1 Ready; the kernel says B Running.</p>
<table>
<tr><th>Scenario</th><th>Kernel’s record for B</th><th>Library’s table</th></tr>
<tr><td>a) Thread 2 makes a blocking system call (e.g. read)</td><td>B → Blocked while the I/O runs; then Ready, later Running.</td><td>Unchanged: Thread 2 still “Running”, Thread 1 Ready but unable to run. B resumes inside Thread 2.</td></tr>
<tr><td>b) Clock interrupt: B’s time slice is used up</td><td>B → Ready; later Running.</td><td>Unchanged: Thread 2 still “Running”.</td></tr>
<tr><td>c) Thread 2 needs some action by Thread 1</td><td>B stays Running the whole time.</td><td>Thread 2 → Blocked, Thread 1 → Running (a library thread switch). Later Thread 2 → Ready.</td></tr>
</table>
<p>In a) and b) the library’s “Running” is only a belief: none of B’s code runs, so nothing updates the table.</p>

<h4>Advantages of ULTs</h4>
<ol>
<li><b>Cheap switches.</b> Every thread record lives in the process’s own memory, so switching threads never needs kernel-mode privileges and skips the two mode switches (user → kernel and kernel → user).</li>
<li><b>Custom scheduling.</b> Each application can use the policy that suits it (say, favour its UI thread) without touching the kernel’s scheduler.</li>
<li><b>Runs on any OS.</b> The library is ordinary application code, so the kernel needs no changes and no thread support.</li>
</ol>
<h4>Disadvantages of ULTs</h4>
<ol>
<li><b>A blocking system call blocks every thread of the process</b>, because the kernel blocks the only thing it knows: the process.</li>
<li><b>No true multiprocessing.</b> The kernel assigns a process to one processor at a time, so only one thread of the process can execute at any moment.</li>
</ol>
<p>Example: 3 threads × 4 ticks of CPU, and Thread 2 reads the disk for 4 ticks. On one core ULTs take 16 ticks (the process sits blocked for 4) and KLTs 12; on two cores KLTs take 8 (6 with no read), while ULTs still take 16 and never use core 2.</p>

<h4>Working around the limits</h4>
<ul>
<li><b>Write the application as multiple processes</b> instead of threads. This fixes both limits, but every switch becomes a costly process switch.</li>
<li><b>Jacketing</b> (fixes blocking only): turn a blocking system call into a nonblocking one. The “jacket” first asks the kernel, without waiting, whether the call would block. If so, the library marks the thread waiting, runs another thread and checks again later; the real call is made only when it will return at once.</li>
</ul>
<pre>int jacket_read(int fd, char *buf, int n) { // replaces read()
  while (!io_ready(fd)) {  // would read block? (quick check)
    mark_waiting(me, fd);  // yes: this thread waits
    thread_yield();        // run another thread meanwhile
  }                        // resumed later: check again
  return read(fd, buf, n); // data ready: cannot block
}                          // caller never knew</pre>

<h3>Kernel-level threads</h3>
<p>With KLTs the application contains no thread-management code; it asks the kernel for threads through system calls. The kernel keeps one record for the process <b>and</b> a saved context for each of its threads, and its scheduler chooses among <b>threads</b>, not whole processes. Windows and Linux work this way.</p>
<h4>Advantages</h4>
<ol>
<li>Several threads of one process can run on several processors at the same time.</li>
<li>If one thread of a process blocks, the kernel can schedule another thread of the same process.</li>
<li>Kernel routines themselves can be multithreaded.</li>
</ol>
<h4>Disadvantage</h4>
<p>Handing the processor from one thread to another <b>of the same process</b> has to go through the kernel: a mode switch in, and another back out. KLTs win on blocking and parallelism, not on switch speed.</p>

<h3>What it costs: measured latency</h3>
<p>Two classic benchmarks, both measured on the same older single-processor machine. <b>Null fork</b> measures pure creation overhead: make a thread or process whose body is empty, schedule it, let it run and finish. <b>Signal-wait</b> measures synchronization overhead: one thread or process wakes a waiting partner and then waits itself.</p>
<table>
<tr><th>Operation (µs)</th><th>ULT</th><th>KLT</th><th>Process</th></tr>
<tr><td>Null fork</td><td>34</td><td>948</td><td>11,300</td></tr>
<tr><td>Signal-wait</td><td>37</td><td>441</td><td>1,840</td></tr>
</table>
<p>Worked examples: 11,300 ÷ 34 ≈ 332, so one process creation costs about 332 ULT creations; 948 ÷ 34 ≈ 27.9 and 11,300 ÷ 948 ≈ 11.9. For signal-wait, 441 ÷ 37 ≈ 11.9 and 1,840 ÷ 441 ≈ 4.2. Creating 1,000 threads takes 1,000 × 34 µs = 34 ms with ULTs, 948 ms with KLTs and 11.3 s with processes; at 1,000 creations every second that is 3.4% of a processor, 94.8%, or more than the machine has.</p>
<p>Why the gaps: a ULT operation is a library call; a KLT operation must enter the kernel (mode switches plus bookkeeping); a process operation also builds or switches a whole address space. Today’s numbers are smaller but the pattern holds, and if most thread switches need kernel services anyway, the ULT advantage shrinks.</p>

<h3>Combined approach</h3>
<p>Some systems mix both designs; older Solaris is the classic example (see 4.5). The application creates its threads with library calls, and the library also does most of their <b>scheduling and synchronization</b>, all in user space. Underneath, the library runs the application’s M user-level threads on a <b>smaller or equal number N</b> of kernel-level threads, and the programmer can tune N for the application and the machine. Done well, most thread operations stay cheap, threads can run in parallel on several processors, and one blocking call need not stop the whole process. With N = 1 it behaves like pure ULTs (often called <b>many-to-one</b>); with one KLT per ULT it behaves like pure KLTs (<b>one-to-one</b>); in between it is <b>many-to-many</b>.</p>

<h3>Other arrangements: threads per process</h3>
<table>
<tr><th>Threads : processes</th><th>Meaning</th><th>Examples</th></tr>
<tr><td>1 : 1 (1 thread : 1 process)</td><td>Every path of execution is its own process, with a private address space and resources.</td><td>Traditional UNIX</td></tr>
<tr><td>M : 1 (M threads : 1 process)</td><td>One process owns the address space and resources; many threads run inside it and share them.</td><td>Windows NT, Solaris, Linux, OS X, iOS</td></tr>
<tr><td>1 : M (1 thread : M processes)</td><td>A thread can migrate out of one process environment into another, even on another computer.</td><td>Ra (Clouds), Emerald</td></tr>
<tr><td>M : N (M threads : N processes)</td><td>Both at once: many threads per process, and threads can migrate.</td><td>TRIX</td></tr>
</table>
<p>M : 1 (many threads in one process) is the everyday case; 1 : M and M : N come from distributed-systems research. Do not confuse these threads : processes ratios with the one-to-one / many-to-one / many-to-many names for mapping ULTs onto KLTs; they answer different questions. A Linux process running 50 threads is “M threads : 1 process”, yet each of those threads has its own kernel-level thread, so its ULT-to-KLT mapping is one-to-one, not many-to-one. Each ratio describes one process, whereas the four models of section 4.1 describe a whole system: Windows, for example, runs many processes, and each of them is M : 1.</p>`,
  });
})();
