/* =====================================================================
   Section 4.5  Solaris Thread and SMP Management
   Process, user-level threads, lightweight processes (LWPs) and kernel
   threads; the Solaris process structure and LWP fields; kernel-thread
   states; and interrupts handled by interrupt threads.
   ===================================================================== */
(() => {
  /* ---------- shared helpers (scoped to this file) ---------- */
  /* ---- Step 3 model: ULTs → LWPs → kernel threads → 2 processors ----
     5 ULTs, 1 to 4 LWPs (each LWP always has exactly one kernel thread), 2 processors.
     Every tick: the kernel dispatches up to two awake LWPs that have work (round robin,
     keeping an LWP on the processor it already had when it can); the thread library
     then runs the next ULT (round robin) of each dispatched LWP. A blocking call puts
     that LWP's kernel thread to sleep for SLEEP_TICKS ticks; the ULT is stuck inside the call. */
  const NU = 5, NCPU = 2, SLEEP_TICKS = 3, MAXL = 4;
  function makeMapSim() {
    const st = {};
    const ultsOf = (l) => st.map.map((m, u) => (m === l ? u : -1)).filter((u) => u >= 0);
    const runnable = () => { const r = []; for (let l = 0; l < st.nL; l++) if (!st.sleep[l] && ultsOf(l).length) r.push(l); return r; };
    const U = (u) => 'U' + (u + 1), L = (l) => 'LWP ' + (l + 1), K = (l) => 'K' + (l + 1);
    const list = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
    function reset() {
      Object.assign(st, { nL: 1, map: [0, 0, 0, 0, 0], sleep: [0, 0, 0, 0], blocker: [-1, -1, -1, -1], last: [-1, -1, -1, -1],
        rr: 0, tick: 0, cpu: [-1, -1], run: [-1, -1], work: [0, 0, 0, 0, 0], used: 0, waiting: [],
        goals: { both: false, more: false, survive: false, stall: false } });
    }
    function tick() {
      const R = runnable();
      const dist = (l) => (l - st.rr + st.nL) % st.nL;
      const chosen = R.slice().sort((a, b) => dist(a) - dist(b)).slice(0, NCPU);
      const cpu = [-1, -1];
      chosen.forEach((l) => { const c = st.cpu.indexOf(l); if (c >= 0) cpu[c] = l; });
      chosen.forEach((l) => { if (!cpu.includes(l)) cpu[cpu.indexOf(-1)] = l; });
      const run = cpu.map((l) => {
        if (l < 0) return -1;
        const us = ultsOf(l); const nxt = us.find((u) => u > st.last[l]);
        const u = nxt != null ? nxt : us[0];
        st.last[l] = u; st.work[u]++; return u;
      });
      if (chosen.length) st.rr = (chosen[chosen.length - 1] + 1) % st.nL;
      st.cpu = cpu; st.run = run; st.waiting = R.filter((l) => !chosen.includes(l));
      const asleep = []; for (let l = 0; l < st.nL; l++) if (st.sleep[l]) asleep.push(l);
      const busy = run.filter((u) => u >= 0).length;
      st.tick++; st.used += busy;
      const parts = [];
      cpu.forEach((l, c) => parts.push(l < 0 ? `Processor ${c} is <b>idle</b>` : `Processor ${c} runs ${K(l)} → ${L(l)} → <b>${U(run[c])}</b>`));
      let msg = `<b>Tick ${st.tick}.</b> ${parts.join('; ')}.`;
      if (st.waiting.length) msg += ` ${list(st.waiting.map(L))} ${st.waiting.length > 1 ? 'are' : 'is'} ready but both processors are taken, so ${st.waiting.length > 1 ? 'they wait' : 'it waits'} (RUN).`;
      if (asleep.length) msg += ` ${list(asleep.map(L))} ${asleep.length > 1 ? 'are' : 'is'} asleep in read().`;
      if (busy === 2) st.goals.both = true;
      if (st.waiting.length) st.goals.more = true;
      if (asleep.length && busy) st.goals.survive = true;
      if (asleep.length && !busy) st.goals.stall = true;
      const wakes = [];
      asleep.forEach((l) => { st.sleep[l]--; if (!st.sleep[l]) { wakes.push(`${U(st.blocker[l])}'s read() is done: the kernel wakes ${K(l)} (SLEEP → RUN).`); st.blocker[l] = -1; } });
      if (wakes.length) msg += ' ' + wakes.join(' ');
      return msg;
    }
    function block(l) {
      if (l >= st.nL) return null;
      if (st.sleep[l]) return { err: `${L(l)} is already asleep in a system call.` };
      const us = ultsOf(l);
      if (!us.length) return { err: `${L(l)} has no ULT on it, so nothing can make a system call there.` };
      const c = st.cpu.indexOf(l);
      // only code that is executing can make a system call: the LWP must be ONPROC right now
      if (c < 0 || st.run[c] < 0) return { err: `${L(l)} is not on a processor right now, so none of its ULTs is executing and none can call read(). Press Next tick until ${K(l)} is ONPROC.` };
      const u = st.run[c];
      st.sleep[l] = SLEEP_TICKS; st.blocker[l] = u;
      st.cpu[c] = -1; st.run[c] = -1;
      const stuck = us.filter((x) => x !== u).map(U);
      return { msg: `<b>${U(u)} calls read()</b> on ${L(l)} and the data is not ready. The kernel puts ${K(l)} to sleep (ONPROC → SLEEP) for ${SLEEP_TICKS} ticks, and processor ${c} is free for other work.` + (stuck.length ? ` ${list(stuck)} ${stuck.length > 1 ? 'are' : 'is'} also on ${L(l)}, so ${stuck.length > 1 ? 'they wait' : 'it waits'} too.` : '') + (st.nL > 1 ? ' Other LWPs are not affected.' : ' It is the only LWP, so the whole process now waits.') };
    }
    function move(u) {
      const from = st.map[u];
      if (st.blocker[from] === u) return { err: `${U(u)} is inside a read() call on ${L(from)}. It cannot leave until the call returns.` };
      if (st.nL === 1) return { err: `There is only one LWP. Add an LWP first, then move ${U(u)} onto it.` };
      const to = (from + 1) % st.nL;
      st.map[u] = to;
      const c = st.run.indexOf(u);
      if (c >= 0) { st.run[c] = -1; st.cpu[c] = -1; }
      return { msg: `The library now runs ${U(u)} on ${L(to)} instead of ${L(from)}.` };
    }
    function addL() {
      if (st.nL >= MAXL) return { err: `This lab stops at ${MAXL} LWPs.` };
      const l = st.nL++; st.sleep[l] = 0; st.blocker[l] = -1; st.last[l] = -1;
      return { msg: `${L(l)} is created, and with it exactly one kernel thread, ${K(l)}. Click ULTs to move work onto it.` };
    }
    function remL() {
      if (st.nL <= 1) return { err: 'A running process keeps at least one LWP.' };
      const l = st.nL - 1;
      if (st.sleep[l]) return { err: `${L(l)} is asleep inside a system call. Wait for it to wake before removing it.` };
      const moved = ultsOf(l); moved.forEach((u) => { st.map[u] = 0; });
      const c = st.cpu.indexOf(l); if (c >= 0) { st.cpu[c] = -1; st.run[c] = -1; }
      st.nL--; st.rr %= st.nL;
      return { msg: `${L(l)} and its kernel thread ${K(l)} are destroyed together.` + (moved.length ? ` ${list(moved.map(U))} ${moved.length > 1 ? 'move' : 'moves'} to LWP 1.` : '') };
    }
    reset();
    return { st, reset, tick, block, move, addL, remL, ultsOf, runnable };
  }

  /* ---- Steps 4 and 5: the process structure and the LWP data structure ---- */
  const SHARED = [
    { k: 'pid', n: 'Process ID', v: '812', what: 'The number that names this process in system calls and tools such as ps and kill.', why: 'A process has one identity, however many LWPs it contains.' },
    { k: 'uid', n: 'User IDs', v: 'uid 1001, gid 20', what: 'Which user (and group) the process works for. The kernel checks them before it allows file access and other actions.', why: 'Permissions belong to the program as a whole, not to one flow of execution.' },
    { k: 'sdt', n: 'Signal dispatch table', v: 'INT→on_quit', what: 'For each kind of signal, what to do when it arrives: ignore it, take the default action, or call a handler function.', why: 'A handler is installed once for the process, and every LWP shares that choice.' },
    { k: 'mm', n: 'Memory map', v: 'code, heap, stacks', what: 'Which regions of the address space are in use (code, data, heap, stacks, libraries) and what backs each one.', why: 'All threads share one address space, so there is only one map.' },
    { k: 'fd', n: 'File descriptors', v: '0, 1, 2, 3', what: 'The table of open files, pipes and network connections, each named by a small number (here 3 is data.csv).', why: 'A file opened by one thread can be used by all of them.' },
  ];
  const PERLWP = [
    { k: 'lwpid', n: 'LWP identifier', v: ['1', '2'], what: 'Names this LWP inside its process.', why: 'The process has several LWPs and must tell them apart.' },
    { k: 'pri', n: 'Priority', v: ['59', '30'], old: '59', oldWhat: 'The scheduling priority of the process, which the kernel uses to decide when it runs.', what: 'The scheduling priority of this LWP, and so of the kernel thread that supports it.', why: 'The kernel schedules each LWP on its own, so each needs its own priority.' },
    { k: 'mask', n: 'Signal mask', v: ['INT blocked', 'none'], old: 'INT blocked', oldWhat: 'Tells the kernel which signals the process will accept right now; a blocked (masked) signal waits.', what: 'Tells the kernel which signals this LWP will accept right now.', why: 'One LWP may accept Ctrl+C (SIGINT) while the others block it, so each needs its own mask.' },
    { k: 'regs', n: 'Saved user registers', short: 'Saved registers', v: ['PC=4012a0', 'PC=401f88'], old: 'PC=4012a0', oldWhat: 'The register values (program counter, stack pointer and the rest) of the process\'s single flow of execution, saved while it is not running.', what: 'The user-level register values (program counter, stack pointer and the rest), saved while this LWP is not running.', why: 'Each LWP is at its own place in the program.' },
    { k: 'kstack', n: 'Kernel stack', v: ['read(3,…)', 'empty'], old: 'read(3,…)', oldWhat: 'The stack the process uses while it runs inside the kernel, holding each system call\'s arguments, results and error code.', what: 'The stack this LWP uses inside the kernel. For each call level it holds the system call\'s arguments, results and error code.', why: 'Two LWPs can be inside two different system calls at the same time.' },
    { k: 'usage', n: 'Resource usage and profiling data', short: 'Usage + profiling', v: ['CPU 1.20 s', 'CPU 0.35 s'], what: 'How much processor time and other resources this LWP has used, plus data for profiling tools.', why: 'Accounting per LWP shows which flow of execution used what.' },
    { k: 'kptr', n: 'Pointer to kernel thread', short: '→ kernel thread', v: ['K1', 'K2'], what: 'Links the LWP to the one kernel thread that supports it.', why: 'Exactly one kernel thread backs each LWP, and the kernel schedules that thread.' },
    { k: 'pptr', n: 'Pointer to process structure', short: '→ process', v: ['process 812', 'process 812'], what: 'Links the LWP back to its process.', why: 'The LWP keeps only per-execution state; it reaches the shared memory map, files and signal table through this pointer.' },
  ];

  /* ---- Step 6: Solaris kernel-thread states (simplified) ---- */
  const TSTATE = {
    RUN: { x: 120, y: 200, col: 'warn', d: 'Runnable: ready to execute and waiting for the dispatcher to give it a processor.' },
    ONPROC: { x: 400, y: 200, col: 'ok', d: 'Executing on a processor right now.' },
    SLEEP: { x: 260, y: 342, col: 'accent', d: 'Blocked: waiting for an event, such as the data a system call asked for.' },
    STOP: { x: 260, y: 58, col: 'bad', d: 'Stopped: its process has been stopped (for example by a debugger). It does nothing until continued.' },
    ZOMBIE: { x: 600, y: 200, col: 'muted', d: 'Terminated: the thread has exited, but its leftovers have not been collected yet.' },
    FREE: { x: 600, y: 342, col: 'muted', d: 'Resources released. The thread only waits to be removed from the kernel\'s thread data structure.' },
    PINNED: { x: 580, y: 58, col: 'intr', d: 'Not one of the six states: a running thread held in place on its processor while an interrupt thread borrows it. Its context is saved and it cannot move to another processor.' },
  };
  const TEVENTS = [
    { k: 'dispatch', label: 'dispatch', from: 'RUN', to: 'ONPROC', ok: 'The dispatcher picks this thread and gives it a processor.', bad: 'Only a RUN (ready) thread can be dispatched.' },
    { k: 'preempt', label: 'preempt', from: 'ONPROC', to: 'RUN', ok: 'A higher-priority thread became runnable, so this one loses the processor. It is still ready, so it goes back to RUN.', bad: 'Only a running (ONPROC) thread can be preempted.' },
    { k: 'quantum', label: 'quantum ends', from: 'ONPROC', to: 'RUN', ok: 'Its <span class="t">quantum</span> (time slice) is used up. Time slicing sends it back to RUN so other threads get a turn.', bad: 'Only a running (ONPROC) thread is using up a quantum.' },
    { k: 'yield', label: 'yield', from: 'ONPROC', to: 'RUN', ok: 'The thread gives up the processor voluntarily but stays ready (RUN).', bad: 'Only a running (ONPROC) thread can yield the processor.' },
    { k: 'sleep', label: 'blocking call', from: 'ONPROC', to: 'SLEEP', ok: 'It calls read() and the data is not there yet. It must wait for the service, so it blocks: SLEEP.', bad: 'Only a running (ONPROC) thread can make a system call.' },
    { k: 'wakeup', label: 'wakeup', from: 'SLEEP', to: 'RUN', ok: 'The event it waited for happened. It is runnable again, but it must wait for a processor: RUN, not ONPROC.', bad: 'Wakeup only applies to a sleeping (SLEEP) thread.' },
    { k: 'stop', label: 'stop', from: 'ONPROC', to: 'STOP', ok: 'Its process is stopped (say, by a debugger). The thread notices the stop request while it runs and stops itself.', bad: 'In Solaris a thread stops itself: a stop request is only noted until the thread next runs (a sleeping thread may be woken so it can do this). Get it to ONPROC first, then press stop.' },
    { k: 'cont', label: 'continue', from: 'STOP', to: 'RUN', ok: 'The process is continued. The thread becomes runnable and waits for a processor.', bad: 'Only a stopped (STOP) thread can be continued.' },
    { k: 'exit', label: 'exit', from: 'ONPROC', to: 'ZOMBIE', ok: 'The thread executes exit and terminates. Its records stay behind for now: it is a <span class="t">zombie thread</span> (ZOMBIE).', bad: 'A thread ends by executing exit, so it must be running (ONPROC).' },
    { k: 'reap', label: 'reap', from: 'ZOMBIE', to: 'FREE', ok: 'The kernel <span class="t" data-t="reap">reaps</span> the zombie: its resources are released. It is FREE, waiting only to be removed from the thread data structure.', bad: 'Only a ZOMBIE thread can be reaped.' },
    { k: 'intr', label: 'interrupt arrives', from: 'ONPROC', to: 'PINNED', ok: 'An interrupt is delivered to this processor. The thread is <span class="t" data-t="pinned thread">pinned</span>: context saved, held on this processor while an interrupt thread runs.', bad: 'An interrupt pins whatever thread is running on that processor, and this thread is not running.' },
    { k: 'intrdone', label: 'interrupt done', from: 'PINNED', to: 'ONPROC', ok: 'The interrupt thread finished. The pinned thread is unpinned and resumes exactly where it stopped.', bad: 'Nothing is pinned, so there is no interrupt to finish.' },
  ];


  Guide.section({
    id: '4.5',
    title: 'Solaris Thread and SMP Management',
    short: 'Solaris threads',
    summary: 'Solaris maps user threads to lightweight processes and kernel threads, tracks states, runs interrupt threads.',
    objectives: [
      'Describe the four thread-related entities in Solaris (process, user-level threads, lightweight processes and kernel threads) and trace how work flows from one to the next and onto a processor.',
      'Explain why Solaris uses three levels of thread and what that gives both the application and the operating system.',
      'Compare the traditional UNIX process structure with the Solaris one, and list what each LWP data structure holds.',
      'Trace a kernel thread through the RUN, ONPROC, SLEEP, STOP, ZOMBIE and FREE states, naming the event behind each move.',
      'Explain how Solaris turns interrupts into interrupt threads, what pinning means, and why this costs less than blocking interrupts.',
    ],
    terms: [
      ['User-level thread (ULT)', 'A thread that is created, scheduled and switched entirely by a thread library inside the application. The kernel does not know it exists; it sees only the process that contains it (in Solaris, the LWPs the thread runs on).'],
      ['Solaris lightweight process (LWP)', 'In Solaris, a kernel-supported carrier between user-level threads and the kernel. The thread library treats each LWP like a virtual processor that runs one ULT at a time; every LWP is backed by exactly one kernel thread, and the kernel schedules each LWP independently, so several can run in parallel on different processors.'],
      ['Kernel thread', 'The basic unit the Solaris kernel schedules and dispatches onto a processor. Every LWP has exactly one; other kernel threads work only inside the kernel, for example to handle interrupts.'],
      ['Blocking system call', 'A system call that cannot finish right away (for example, a read whose data is still on the disk), so the caller is put to sleep until the event it needs happens.'],
      ['Process identifier (PID)', 'A unique number the OS gives each process so it can tell it apart from every other process, even ones running the same program.'],
      ['User ID', 'A number that says which user a process is working for. The kernel checks it (and related group IDs) to decide which files and actions the process is allowed.'],
      ['Signal dispatch table', 'A per-process table that records, for each kind of signal (a short notice such as Ctrl+C), what should happen when it arrives: ignore it, take the default action, or run a handler function the program installed.'],
      ['Signal mask', 'A set of bits telling the kernel which signals will be accepted right now. A signal that is masked (blocked) waits until the mask changes. A traditional process has one mask; in Solaris each LWP has its own.'],
      ['File descriptor', 'A small whole number a process uses to name one of its open files, pipes or network connections. By convention 0, 1 and 2 are standard input, output and error.'],
      ['Memory map', 'The kernel\'s record of which regions of a process\'s address space are in use (code, data, heap, stacks, shared libraries) and what memory backs each one.'],
      ['Quantum', 'The slice of processor time a thread may use before the scheduler may hand the processor to another ready thread. Also called a time slice.'],
      ['ONPROC', 'The Solaris kernel-thread state meaning "on a processor": the thread is executing right now.'],
      ['Zombie thread', 'A thread that has called exit and finished, but whose leftover records have not been collected yet. Solaris calls this state ZOMBIE.'],
      ['Reaping (reap)', 'Collecting a finished (zombie) thread\'s leftovers so its resources can be released. The thread is then FREE: it only waits to be removed from the kernel\'s thread data structure.'],
      ['Pinned thread (pinning)', 'A thread that was running when an interrupt arrived on its processor. It is held on that processor, suspended with its context saved, until the interrupt has been handled; it cannot move to another processor meanwhile.'],
      ['Interrupt thread', 'A Solaris kernel thread that handles an interrupt. It has its own ID, priority, context and stack, runs at a higher priority than every other kernel thread, and waits in a pool of deactivated threads until an interrupt needs it.'],
      ['Critical section', 'A stretch of code that uses shared data (or another shared resource) and must not run at the same time as other code that uses the same data.'],
      ['Mutex (mutex lock)', 'A lock that only one thread can hold at a time. A thread that wants it while it is held must wait, and only the thread that locked it may unlock it.'],
      ['Interrupt priority level (IPL)', 'A processor setting that decides which interrupts may be delivered right now. Raising it holds back lower-level interrupts; lowering it lets them through again.'],
      ['Symmetric multiprocessor (SMP)', 'One computer with two or more similar processors that share main memory and the I/O devices, where any processor can run any work, including the kernel itself.'],
    ],

    css: `
      .sec-4-5 .step-eyebrow { flex-wrap: wrap; white-space: normal; row-gap: 2px; min-width: 0; }
      .sec-4-5 .say { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 15px; line-height: 1.45; }
      .sec-4-5 .say b { color: var(--chc); }
      .sec-4-5 .hot { cursor: pointer; outline: none; }
      .sec-4-5 .hot:hover .fr, .sec-4-5 .hot:focus-visible .fr { stroke-width: 3.5; }
      .sec-4-5 svg.picked .hot:not(.sel) { opacity: .35; }
      .sec-4-5 .hot.sel .fr { stroke-width: 4; }
      .sec-4-5 .fld { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; text-align: left; border: 1px solid var(--line); background: var(--panel); border-radius: 8px; padding: 3px 9px; font-size: 14px; font-weight: 600; cursor: pointer; color: var(--ink); line-height: 1.35; min-height: 29px; }
      .sec-4-5 .fld:hover { border-color: var(--chc); }
      .sec-4-5 .fld .v { font-family: var(--mono); font-size: 12.5px; font-weight: 500; color: var(--ink-2); white-space: nowrap; }
      .sec-4-5 .fld.on { box-shadow: 0 0 0 2px var(--chc); border-color: var(--chc); }
      .sec-4-5 .fld.moved { border-left: 4px solid var(--thread); }
      .sec-4-5 .pbox { border: 2px solid var(--proc); background: var(--proc-bg); border-radius: 12px; padding: 8px 10px; }
      .sec-4-5 .lbox { border: 2px solid var(--proc); background: var(--panel-2); border-radius: 10px; padding: 6px 8px; display: flex; flex-direction: column; gap: 4px; }
      .sec-4-5 .lbox.old { border-color: var(--line-2); border-style: dashed; }
      .sec-4-5 .flip-face.back { font-size: 15.5px; line-height: 1.45; padding: 12px 16px; }
      .sec-4-5 .bh { font-size: 12.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--proc); margin-bottom: 4px; }
    `,

    steps: [
      /* ---------------- 1. Big picture: four layers, click each ---------------- */
      {
        title: 'Four layers between your code and a processor',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const LAYERS = {
            proc: { name: 'Process', col: 'proc', what: 'The ordinary UNIX process: an address space with the program\'s code and data, a user stack, and a <span class="t">process control block</span> kept by the kernel. It is the container: its memory, open files and signal settings are shared by all its threads.', who: 'The kernel', sees: 'Kernel and program' },
            ult: { name: 'User-level threads (ULTs)', col: 'thread', what: 'Threads made by a <b>thread library</b> inside the process\'s own address space. They are how the program expresses parallel work, but the kernel cannot see them. In the classic design drawn here, several ULTs share an LWP, so creating or switching ULTs needs no kernel call and is cheap.', who: 'The thread library', sees: 'Only the program' },
            lwp: { name: 'Lightweight processes (LWPs)', col: 'proc', what: 'The bridge. An LWP runs one ULT at a time and is backed by <b>exactly one</b> kernel thread. The kernel schedules each LWP on its own, so two LWPs can run at the same moment on two processors. (In Solaris the name means this one structure; section 4.1 used it loosely for any thread.)', who: 'Library (which ULT) and kernel (when)', sees: 'Program and kernel' },
            kt: { name: 'Kernel threads', col: 'os', what: 'What the kernel actually schedules and dispatches onto a processor: one behind every LWP. Some, like K4, have no LWP at all and do the kernel\'s own work, such as handling interrupts.', who: 'The kernel', sees: 'Only the kernel' },
          };
          const svg = s('svg', { viewBox: '0 0 620 336', width: '100%', style: { flex: 'none' }, role: 'img', 'aria-label': 'Solaris layers: process with user-level threads, LWPs, kernel threads and two processors' });
          const info = h('div', { class: 'card white', style: { minHeight: '150px' } });
          let pick = null;
          const groups = {};
          const hot = (key, kids) => {
            const g = s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': LAYERS[key].name, onclick: () => choose(key), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(key); } } }, kids);
            groups[key] = g; return g;
          };
          const LX = [150, 330, 470];
          const UX = [[110, 0], [190, 0], [330, 1], [470, 2]];
          const lbl = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, o), t);
          svg.append(
            s('text', { x: 4, y: 14, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'USER SPACE'),
            s('text', { x: 4, y: 202, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'KERNEL'),
            s('line', { x1: 0, y1: 184, x2: 620, y2: 184, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.2 }),
            hot('proc', [
              s('rect', { x: 70, y: 22, width: 470, height: 162, rx: 14, class: 's-proc fr', 'stroke-width': 2, 'fill-opacity': 0.45 }),
              s('text', { x: 84, y: 42, 'font-size': 13.5, 'font-weight': 800 }, 'Process: address space, stack, PCB'),
            ]),
            // ULT → LWP mapping lines (drawn under the shapes)
            ...UX.map(([x, l]) => s('line', { x1: x, y1: 100, x2: LX[l], y2: 158, stroke: 'var(--thread)', 'stroke-width': 2 })),
            hot('ult', [
              s('rect', { x: 84, y: 108, width: 442, height: 22, rx: 7, class: 's-thread fr', 'stroke-width': 1.5 }),
              lbl(305, 124, 'thread library', { 'font-size': 12.5, style: 'fill:var(--thread)' }),
              ...UX.map(([x], i) => s('g', {}, s('circle', { cx: x, cy: 78, r: 19, class: 's-thread fr', 'stroke-width': 2 }), lbl(x, 83, 'U' + (i + 1)))),
            ]),
            hot('lwp', LX.map((x, i) => s('g', {}, s('rect', { x: x - 42, y: 158, width: 84, height: 44, rx: 10, class: 's-proc fr', 'stroke-width': 2.5 }), lbl(x, 185, 'LWP ' + (i + 1))))),
            ...LX.map((x) => s('line', { x1: x, y1: 202, x2: x, y2: 226, stroke: 'var(--os)', 'stroke-width': 3 })),
            hot('kt', [
              ...LX.map((x, i) => s('g', {}, s('rect', { x: x - 42, y: 226, width: 84, height: 36, rx: 9, class: 's-os fr', 'stroke-width': 2 }), lbl(x, 249, 'K' + (i + 1)))),
              s('rect', { x: 548, y: 214, width: 68, height: 48, rx: 9, class: 's-os fr', 'stroke-width': 2, 'stroke-dasharray': '5 3' }),
              lbl(582, 234, 'K4', { 'font-size': 13.5 }), lbl(582, 252, 'no LWP', { 'font-size': 11.5, class: 's-sub' }),
            ]),
            s('line', { x1: 150, y1: 262, x2: 200, y2: 290, class: 's-line', 'marker-end': 'url(#arr-cpu)' }),
            s('line', { x1: 330, y1: 262, x2: 400, y2: 290, class: 's-line', 'marker-end': 'url(#arr-cpu)' }),
            lbl(470, 282, 'K3 waits its turn', { 'font-size': 12, class: 's-sub', 'font-weight': 600 }),
            s('rect', { x: 130, y: 294, width: 140, height: 38, rx: 9, class: 's-cpu', 'stroke-width': 2 }), lbl(200, 318, 'Processor 0'),
            s('rect', { x: 330, y: 294, width: 140, height: 38, rx: 9, class: 's-cpu', 'stroke-width': 2 }), lbl(400, 318, 'Processor 1'),
          );
          function paintInfo() {
            if (!pick) {
              info.innerHTML = '<h4>Click any layer of the diagram</h4><p class="small m0">Follow the lines from top to bottom: <b style="color:var(--thread)">ULTs</b> map onto <b style="color:var(--proc)">LWPs</b>, each LWP has exactly one <b style="color:var(--os)">kernel thread</b>, and the kernel puts kernel threads on <b style="color:var(--cpu)">processors</b>. K4 has no LWP at all.</p>';
              return;
            }
            const L = LAYERS[pick];
            info.innerHTML = `<h3 style="color:var(--${L.col})">${L.name}</h3><p class="small" style="margin-bottom:6px">${L.what}</p>
              <div class="row xs" style="gap:6px"><span class="chip">Managed by: ${L.who}</span><span class="chip">Visible to: ${L.sees}</span></div>`;
          }
          function choose(key) {
            pick = pick === key ? null : key;
            svg.classList.toggle('picked', !!pick);
            Object.entries(groups).forEach(([k, g]) => g.classList.toggle('sel', k === pick));
            paintInfo();
          }
          paintInfo();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'A program may want hundreds of threads, but the machine has only a few processors. Solaris links them through <b>four layers</b>, each with one job.' }),
              h('p', { class: 'm0', html: 'Your program creates <span class="t">user-level threads</span>. To execute, a ULT runs on a <span class="t" data-t="Solaris lightweight process">lightweight process</span> (LWP), and every LWP is backed by exactly one <span class="t">kernel thread</span>, the thing the kernel really places on a processor.' }),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A theatre. The characters in the script are ULTs: the company can invent as many as it likes. Each costume (an LWP) is worn by exactly one actor (a kernel thread), who plays one character at a time. Only actors go on stage (a processor). Stagehands are actors without a costume: kernel threads doing backstage work.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The program gets cheap, flexible threads, while the kernel keeps full control of what runs on each processor of a <span class="t" data-t="Symmetric multiprocessor">symmetric multiprocessor</span> (SMP).' })),
            h('div', { class: 'card stack', style: { gap: '10px' } }, svg, info)));
        },
      },

      /* ---------------- 2. Motivation: who decides what? ---------------- */
      {
        title: 'Why three levels of thread? Who decides what',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const BEN = [
            { key: 'flex', col: 'thread', name: 'A clean, flexible interface for the program', txt: 'The program just calls a standard thread library. Its ULTs are cheap to create and switch, and the library picks which ULT each LWP runs.' },
            { key: 'ctrl', col: 'os', name: 'Control for the OS', txt: 'Each LWP is tied to one kernel thread with defined states, so the kernel manages execution: it blocks one LWP without stalling the rest and spreads a process across processors.' },
            { key: 'lean', col: 'intr', name: 'Cheaper kernel work', txt: 'The kernel\'s own jobs, such as interrupt handling, run as kernel threads with no LWP instead of as separate kernel processes, so switching among them is a thread switch, not a process switch.' },
          ];
          const ITEMS = [
            { q: 'Create 400 threads, one for each open network connection.', a: 0, ben: 'flex', why: 'In this many-ULTs-per-LWP design, creating a ULT is a library call inside the process: no system call and no kernel record. That is why a program can afford hundreds of them.' },
            { q: 'Switch from one ULT to another ULT on the same LWP.', a: 0, ben: 'flex', why: 'The library saves one ULT\'s registers and loads another\'s, all in user mode. The kernel never notices the switch.' },
            { q: 'Pick which ULT an idle LWP should run next.', a: 0, ben: 'flex', why: 'The kernel sees only the LWP, never the ULTs on it, so choosing the ULT is the library\'s job.' },
            { q: 'Pick which kernel thread runs on processor 1 right now.', a: 1, ben: 'ctrl', why: 'Only the kernel dispatches kernel threads onto processors, weighing every process on the machine.' },
            { q: 'Put an LWP to sleep because its ULT called read() and the data is not ready.', a: 1, ben: 'ctrl', why: 'The system call enters the kernel, which blocks that LWP\'s kernel thread. The process\'s other LWPs keep running.' },
            { q: 'Run two threads of one program at the same instant on two processors.', a: 1, ben: 'ctrl', why: 'Real parallelism needs two kernel threads (so two LWPs) that the kernel places on two processors.' },
            { q: 'Handle a disk interrupt on a thread that has no LWP.', a: 1, ben: 'lean', why: 'The kernel runs its own work on kernel threads without LWPs. Switching to such a thread is a cheap thread switch inside the kernel, far lighter than switching to a separate kernel process.' },
          ];
          const WHO = ['Thread library (in the process)', 'Kernel'];
          let i = 0, res = [];
          const counter = h('h4', { class: 'm0' });
          const qEl = h('div', { style: { fontSize: '19px', fontWeight: 650, lineHeight: 1.4, minHeight: '54px' } });
          const btns = WHO.map((w, k) => h('button', { class: 'btn ' + (k ? 'os' : 'thread'), type: 'button', onclick: () => answer(k) }, w));
          const fb = h('div', { class: 'say', style: { minHeight: '76px' } });
          const next = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (i < ITEMS.length - 1) { i++; paint(); } else { i = 0; res = []; paint(); } } });
          const pills = h('div', { class: 'row', style: { gap: '6px' } });
          const benEls = BEN.map((b) => {
            const list = h('div', { class: 'xs muted', style: { minHeight: '18px' } });
            const card = h('div', { class: 'card tight', style: { borderLeft: `5px solid var(--${b.col})`, transition: 'background .3s' } },
              h('div', { class: 'b', style: { color: `var(--${b.col})` } }, b.name), h('div', { class: 'small', style: { lineHeight: 1.4 } }, b.txt), list);
            return { b, card, list };
          });
          function answer(k) {
            if (res[i] != null) return;
            res[i] = k === ITEMS[i].a;
            paint();
          }
          function paint() {
            const it = ITEMS[i];
            counter.textContent = `Decision ${i + 1} of ${ITEMS.length}: who makes this call?`;
            qEl.textContent = it.q;
            const done = res[i] != null;
            btns.forEach((b, k) => { b.disabled = done; b.classList.toggle('on', done && k === it.a); });
            if (!done) fb.innerHTML = '<span class="muted">Choose the thread library or the kernel. The explanation appears here.</span>';
            else fb.innerHTML = `<b style="color:var(--${res[i] ? 'ok' : 'bad'})">${res[i] ? 'Right.' : 'Not quite.'}</b> ${WHO[it.a]} makes this call. ${it.why}`;
            next.textContent = i < ITEMS.length - 1 ? 'Next decision →' : 'Start again';
            next.disabled = !done;
            pills.replaceChildren(...ITEMS.map((_, k) => h('span', { class: 'chip ' + (res[k] == null ? '' : res[k] ? 'ok' : 'bad'), style: k === i ? { boxShadow: '0 0 0 2px var(--chc)' } : null }, String(k + 1))));
            benEls.forEach(({ b, card, list }) => {
              const all = ITEMS.map((x, k) => k).filter((k) => ITEMS[k].ben === b.key);
              const got = all.filter((k) => res[k] != null);
              card.style.background = got.length ? `var(--${b.col}-bg)` : '';
              list.textContent = got.length ? `Shown by decision${got.length > 1 ? 's' : ''} ${got.map((k) => k + 1).join(', ')}` + (got.length === all.length ? ' ✓' : ` (${all.length - got.length} more to find)`) : 'Answer the decisions to light this up.';
            });
          }
          paint();
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Section 4.2 weighed pure user-level threads against pure kernel-level threads. Solaris keeps <b>both</b>, joined by LWPs, so each decision is made by whoever is best placed to make it.' }),
              h('div', { class: 'card white stack', style: { gap: '10px' } }, counter, qEl, h('div', { class: 'row' }, ...btns), fb, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, pills, next)),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"The kernel schedules the ULTs." It never sees them. The kernel schedules kernel threads, and so the LWPs they back; which ULT runs on an LWP is up to the library.' })),
            h('div', { class: 'stack' },
              h('h4', { class: 'm0' }, 'What the three-level design buys'),
              ...benEls.map((x) => x.card),
              h('div', { class: 'callout tip m0 small', 'data-label': 'The design in one line', html: 'The library does thread bookkeeping cheaply in user space; the kernel does scheduling, blocking and processors.' }))));
        },
      },

      /* ---------------- 3. Lab: build the ULT → LWP → kernel thread → processor mapping ---------------- */
      {
        title: 'Lab: map threads onto LWPs and run them on 2 CPUs',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const sim = makeMapSim(), st = sim.st;
          const svg = s('svg', { viewBox: '0 0 620 358', width: '100%', role: 'img', 'aria-label': 'Five ULTs mapped onto LWPs, each LWP backed by one kernel thread, dispatched onto two processors' });
          const UXs = [70, 190, 310, 430, 550];
          const lx = (l) => 20 + (512 / st.nL) * (l + 0.5); // LWPs share x 20..532; the kernel-only thread sits to their right
          const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, o), t);
          const log = h('div', { class: 'log grow', style: { fontFamily: 'var(--font)', fontSize: '14px', maxHeight: '220px', minHeight: '96px' } });
          const stat = h('span', { class: 'chip accent' });
          const GOALS = [
            ['both', 'Keep <b>both processors</b> busy with this one process'],
            ['survive', 'Block one LWP while a processor keeps running another'],
            ['stall', 'Stall the <b>whole process</b> with one blocking call'],
            ['more', 'Give it <b>more LWPs than processors</b>, so they take turns'],
          ];
          const goalEls = GOALS.map(([k, t]) => h('div', { class: 'row nw small', style: { gap: '8px' } }, h('span', { class: 'chip' }, '·'), h('span', { html: t })));
          const say = (html, bad) => { log.prepend(h('div', { class: 'fade-in', html: bad ? `<span style="color:var(--bad)">✗</span> ${html}` : html })); while (log.children.length > 40) log.lastChild.remove(); };
          const act = (r) => { if (!r) return; if (r.err) { say(r.err, true); ctx.toast(r.err.replace(/<[^>]+>/g, '')); } else say(r.msg); draw(); };
          function draw() {
            const PX = [150, 400]; // processor centres
            const kids = [
              s('text', { x: 0, y: 13, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'USER SPACE'),
              s('rect', { x: 6, y: 20, width: 608, height: 160, rx: 14, class: 's-proc', 'stroke-width': 1.5, 'fill-opacity': 0.35 }),
              s('text', { x: 606, y: 13, 'text-anchor': 'end', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'Process P · click a ULT to move it'),
              s('line', { x1: 0, y1: 180, x2: 620, y2: 180, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.2 }),
              s('text', { x: 618, y: 198, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'KERNEL'),
            ];
            // ULT → LWP lines (the library band is drawn over them: the library routes each ULT to its LWP)
            st.map.forEach((l, u) => kids.push(s('line', { x1: UXs[u], y1: 116, x2: lx(l), y2: 160, stroke: 'var(--thread)', 'stroke-width': st.run.includes(u) ? 4.5 : 2, 'stroke-dasharray': st.blocker[l] === u ? '5 4' : null })));
            kids.push(s('rect', { x: 18, y: 120, width: 584, height: 19, rx: 6, class: 's-thread', 'stroke-width': 1 }),
              T(310, 134, 'thread library: runs each LWP\'s ULTs in turn', { 'font-size': 13, style: 'fill:var(--thread)' }));
            // ULTs
            st.map.forEach((l, u) => {
              const running = st.run.includes(u), blocked = st.blocker[l] === u;
              kids.push(s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': `Move U${u + 1} to the next LWP`, onclick: () => act(sim.move(u)), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(sim.move(u)); } } },
                s('circle', { cx: UXs[u], cy: 54, r: 23, class: blocked ? 's-intr fr' : 's-thread fr', 'stroke-width': running ? 4.5 : 2, 'stroke-dasharray': blocked ? '5 3' : null }),
                T(UXs[u], 59, 'U' + (u + 1), { 'font-size': 15.5 }),
                T(UXs[u], 95, running ? 'running' : blocked ? 'in read()' : `ran ${st.work[u]}`, { 'font-size': 13, 'font-weight': running || blocked ? 800 : 600, style: `fill:var(--${running ? 'thread' : blocked ? 'intr' : 'muted'})` }),
                T(UXs[u], 111, `on LWP ${l + 1}`, { 'font-size': 12.5, 'font-weight': 600, class: 's-sub' })));
            });
            // LWPs + their kernel threads
            for (let l = 0; l < st.nL; l++) {
              const x = lx(l), c = st.cpu.indexOf(l), sleeping = st.sleep[l] > 0, idle = !sim.ultsOf(l).length;
              const ls = sleeping ? `asleep (${st.sleep[l]})` : c >= 0 ? 'on a CPU' : idle ? 'no ULTs' : 'ready';
              const ks = c >= 0 ? 'ONPROC' : sleeping || idle ? 'SLEEP' : 'RUN';
              kids.push(
                s('rect', { x: x - 50, y: 158, width: 100, height: 46, rx: 10, class: sleeping ? 's-panel' : 's-proc', 'stroke-width': c >= 0 ? 3.5 : 2, 'stroke-dasharray': sleeping ? '6 4' : null }),
                T(x, 177, 'LWP ' + (l + 1)), T(x, 195, ls, { 'font-size': 12.5, 'font-weight': 600, class: 's-sub' }),
                s('line', { x1: x, y1: 204, x2: x, y2: 216, stroke: 'var(--os)', 'stroke-width': 3 }),
                s('rect', { x: x - 50, y: 216, width: 100, height: 44, rx: 9, class: 's-os', 'stroke-width': c >= 0 ? 3 : 1.8 }),
                T(x, 234, 'K' + (l + 1)), T(x, 252, ks, { 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${ks === 'ONPROC' ? 'ok' : ks === 'RUN' ? 'warn' : 'muted'})` }));
              if (c >= 0) kids.push(s('line', { x1: x, y1: 260, x2: PX[c], y2: 290, stroke: 'var(--cpu)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-cpu)' }));
            }
            // a kernel thread that has no LWP
            kids.push(s('rect', { x: 540, y: 210, width: 76, height: 60, rx: 9, class: 's-os', 'stroke-width': 1.8, 'stroke-dasharray': '5 3' }),
              T(578, 230, 'kernel', { 'font-size': 13 }), T(578, 245, 'only', { 'font-size': 13 }), T(578, 262, 'no LWP', { 'font-size': 12.5, class: 's-sub', 'font-weight': 600 }));
            // processors
            [0, 1].forEach((c) => {
              const l = st.cpu[c], x = PX[c];
              kids.push(s('rect', { x: x - 110, y: 294, width: 220, height: 60, rx: 11, class: l >= 0 ? 's-cpu' : 's-panel', 'stroke-width': 2 }),
                T(x, 318, 'Processor ' + c), T(x, 341, l >= 0 ? `K${l + 1} · LWP ${l + 1} · U${st.run[c] + 1}` : 'idle', { 'font-size': 14, 'font-weight': l >= 0 ? 700 : 600, style: l >= 0 ? 'fill:var(--cpu)' : null, class: l >= 0 ? null : 's-sub' }));
            });
            svg.replaceChildren(...kids);
            stat.textContent = `Tick ${st.tick} · processor time used ${st.tick ? Math.round((100 * st.used) / (2 * st.tick)) : 0}%`;
            GOALS.forEach(([k], i) => { const chip = goalEls[i].firstChild; const ok = st.goals[k]; chip.className = 'chip ' + (ok ? 'ok' : ''); chip.textContent = ok ? '✓' : String(i + 1); });
            // only an LWP that is ONPROC has a ULT executing, so only it can make a system call; the others are dimmed but explain why when clicked
            blockRow.replaceChildren(h('span', { class: 'small b' }, 'Running ULT calls read() on:'), ...Array.from({ length: st.nL }, (_, l) => {
              const onCpu = st.cpu.indexOf(l) >= 0;
              return h('button', { class: 'btn sm intr', type: 'button', disabled: st.sleep[l] > 0, style: onCpu ? null : { opacity: 0.5 }, title: onCpu ? null : 'Not on a processor, so none of its ULTs is executing', onclick: () => act(sim.block(l)) }, 'LWP ' + (l + 1));
            }));
            bAdd.disabled = st.nL >= MAXL; bRem.disabled = st.nL <= 1;
          }
          let timer = null;
          const bPlay = h('button', { class: 'btn sm', type: 'button', onclick: () => { if (timer) stopPlay(); else { timer = ctx.every(1100, () => { say(sim.tick()); draw(); }); bPlay.textContent = 'Pause'; } } }, 'Auto-run');
          function stopPlay() { if (timer) clearInterval(timer); timer = null; bPlay.textContent = 'Auto-run'; }
          const bAdd = h('button', { class: 'btn sm proc', type: 'button', onclick: () => act(sim.addL()) }, '+ LWP');
          const bRem = h('button', { class: 'btn sm', type: 'button', onclick: () => act(sim.remL()) }, '− LWP');
          const bTick = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { say(sim.tick()); draw(); } }, 'Next tick ▸');
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { stopPlay(); sim.reset(); log.replaceChildren(); say('Reset: one LWP carries all five ULTs.'); draw(); } }, 'Reset');
          const blockRow = h('div', { class: 'row', style: { gap: '6px' } });
          say('Start: one LWP carries all five ULTs, so this process can use only one processor at a time. Press <b>Next tick</b>.');
          draw();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Add <span class="t" data-t="Solaris lightweight process">LWPs</span>, click a ULT to move it, and press <b>Next tick</b> (one slice of time). Each LWP comes with <b>exactly one</b> <span class="t">kernel thread</span>; the kernel puts at most two on the processors. Then make a running ULT do a <span class="t">blocking system call</span>.' }),
              h('div', { class: 'card tight stack', style: { gap: '5px' } }, h('h4', { class: 'm0' }, 'Goals'), ...goalEls),
              log,
              h('div', { class: 'callout tip m0 small', 'data-label': 'Two versions of Solaris', html: 'Solaris 2 to 8 let many ULTs share fewer LWPs, as in this lab. From Solaris 9 on, every ULT gets its own LWP (one-to-one). The layers and the one-kernel-thread-per-LWP rule are the same in both.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              svg,
              h('div', { class: 'row', style: { gap: '6px' } }, bAdd, bRem, bTick, bPlay, bReset, h('span', { class: 'grow' }), stat),
              blockRow,
              h('div', { class: 'row xs muted', style: { gap: '6px 14px' } },
                h('span', { html: '<b style="color:var(--ok)"><span class="t">ONPROC</span></b> on a processor' }),
                h('span', { html: '<b style="color:var(--warn)">RUN</b> ready, waiting for a processor' }),
                h('span', { html: '<b>SLEEP</b> blocked (or nothing to do)' }),
                h('span', { html: 'Thick line = the ULT running right now' })))));
        },
      },

      /* ---------------- 4. Compare: traditional UNIX process vs Solaris process ---------------- */
      {
        title: 'Process structure: traditional UNIX vs Solaris',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const OLDNAME = { pri: 'Priority', mask: 'Signal mask', regs: 'Registers', kstack: 'Stack' };
          let mode = 'trad', sel = null;
          const left = h('div', { class: 'stack fill', style: { gap: '8px' } });
          const insp = h('div', { class: 'card white stack grow', style: { gap: '6px' } });
          const seg = ctx.ui.seg([{ value: 'trad', label: 'Traditional UNIX' }, { value: 'sol', label: 'Solaris' }], mode, (v) => { mode = v; draw(true); });
          const WHERE = {
            shared: ['proc', 'Process structure: one copy, shared by every LWP'],
            trad: ['cpu', 'Traditional: processor state, one set per process'],
            lwp: ['thread', 'Solaris: one copy inside each LWP structure'],
          };
          function inspect(f, where, val) {
            sel = f.k;
            left.querySelectorAll('.fld').forEach((b) => b.classList.toggle('on', b.dataset.k === sel));
            const [col, txt0] = WHERE[where];
            const txt = where === 'shared' && mode === 'trad' ? 'Process structure: one copy for the whole process' : txt0;
            const why = where === 'trad' ? `A traditional process has one flow of execution, so one copy was enough. In Solaris it moves into each LWP: ${f.why.charAt(0).toLowerCase() + f.why.slice(1)}`
              : where === 'shared' && mode === 'trad' ? `${f.why} Solaris keeps it in the process structure too.` : f.why;
            insp.innerHTML = `<h3 class="m0">${where === 'trad' ? OLDNAME[f.k] : f.n}</h3><div><span class="chip ${col}">${txt}</span></div>
              <p class="small m0"><b>Holds:</b> ${where === 'trad' ? f.oldWhat : f.what}</p><p class="small m0"><b>Example value:</b> <code>${ctx.util.esc(val)}</code></p><p class="small m0"><b>Why here:</b> ${why}</p>`;
          }
          const fld = (f, val, where, moved) => h('button', { class: 'fld' + (moved ? ' moved' : '') + (f.k === sel ? ' on' : ''), type: 'button', 'data-k': f.k, onclick: () => inspect(f, where, val) },
            h('span', {}, where === 'trad' ? OLDNAME[f.k] : f.short || f.n), h('span', { class: 'v' }, val));
          function draw(flash) {
            const shared = h('div', { class: 'grid-2', style: { gap: '5px' } }, ...SHARED.map((f) => fld(f, f.v, 'shared')));
            let lower;
            if (mode === 'trad') {
              lower = [h('div', { class: 'lbox', style: { borderColor: 'var(--cpu)' } },
                h('div', { class: 'bh', style: { color: 'var(--cpu)' } }, 'Processor state: one set for the whole process'),
                h('div', { class: 'grid-2', style: { gap: '5px' } }, ...PERLWP.filter((f) => f.old).map((f) => fld(f, f.old, 'trad', true)))),
              h('div', { class: 'lbox old grow', style: { justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '14px 24px' } },
                h('div', { class: 'b', style: { fontSize: '17px' } }, 'No room for a second flow of execution'),
                h('div', { class: 'small muted', html: 'A second thread would need its own priority, signal mask, registers and stack, but this structure holds only one set. Switch to <b>Solaris</b> to see where they go.' }))];
            } else {
              lower = h('div', { class: 'grid-2', style: { gap: '8px' } }, ...[0, 1].map((i) => h('div', { class: 'lbox' },
                h('div', { class: 'bh' }, `LWP ${i + 1} structure`),
                ...PERLWP.map((f) => fld(f, f.v[i], 'lwp', !!f.old)))));
            }
            left.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'xs muted', html: '<b style="color:var(--thread)">▌</b> fields that describe one flow of execution' })),
              h('div', { class: 'pbox stack grow', style: { gap: '6px' } },
                h('div', { class: 'bh m0' }, mode === 'trad' ? 'UNIX process structure' : 'Solaris process structure'),
                shared,
                mode === 'sol' ? h('div', { class: 'bh m0', style: { marginTop: '2px' } }, 'List of LWP structures, one per LWP') : null,
                lower));
            if (flash) left.querySelectorAll('.fld.moved').forEach((b) => b.classList.add('flash'));
            if (!sel || !left.querySelector(`.fld[data-k="${sel}"]`)) {
              sel = null;
              insp.innerHTML = mode === 'trad'
                ? '<h4>Traditional UNIX</h4><p class="small m0">A process is exactly one flow of execution, so its structure holds one <b>processor state</b>: one priority, one signal mask, one set of saved registers and one kernel stack. Click any field to inspect it, then switch to <b>Solaris</b>.</p>'
                : '<h4>Solaris</h4><p class="small m0">The process keeps only what all its threads share: <span class="t" data-t="PID">process ID</span>, <span class="t">user IDs</span>, <span class="t">signal dispatch table</span>, <span class="t">memory map</span> and <span class="t">file descriptors</span>. Every field that describes one flow of execution now lives in an <b>LWP structure</b>, and the process holds a list of them. Two new fields link each LWP to its kernel thread and back to its process. Click a field to inspect it.</p>';
            } else {
              const b = left.querySelector(`.fld[data-k="${sel}"]`); b.click();
            }
          }
          draw(false);
          el.append(h('div', { class: 'split r fill' }, left,
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'A thread needs its own registers, stack, priority and <span class="t">signal mask</span>. Where does Solaris keep them?' }),
              insp,
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Moving per-execution state out of the process and into each LWP is what lets one process run in several places at once, each LWP with its own priority, mask and position in the program.' }))));
        },
      },

      /* ---------------- 5. Lab: sort every field into the process or the LWP ---------------- */
      {
        title: 'Sort the fields: process structure or LWP structure?',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const ALL = [...SHARED.map((f) => ({ f, home: 0 })), ...PERLWP.map((f) => ({ f, home: 1 }))];
          const rng = ctx.util.seeded(45);
          let deck, i, res;
          const BIN = ['Process (shared)', 'Each LWP'];
          const counter = h('h4', { class: 'm0' });
          const name = h('div', { style: { fontSize: '24px', fontWeight: 800, lineHeight: 1.2 } });
          const hint = h('div', { class: 'small', style: { minHeight: '64px' } });
          const btns = BIN.map((b, k) => h('button', { class: 'btn lg ' + (k ? 'thread' : 'proc'), type: 'button', style: { flex: 1 }, onclick: () => place(k) }, b));
          const fb = h('div', { class: 'say', style: { minHeight: '96px' } });
          const score = h('span', { class: 'chip accent' });
          const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { start(); } }, 'Shuffle and restart');
          const bins = [0, 1].map((k) => h('div', { class: 'stack', style: { gap: '5px' } }));
          const binBoxes = [0, 1].map((k) => h('div', { class: k ? 'lbox' : 'pbox', style: { minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', borderColor: k ? 'var(--thread)' : null } },
            h('div', { class: 'bh', style: { color: k ? 'var(--thread)' : null } }, k ? 'Each LWP structure' : 'Process structure'), bins[k],
            h('div', { class: 'small muted center', style: { marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed var(--line-2)' }, html: k ? 'One copy <b>per LWP</b>.<br>Ask: does it describe <b>one flow of execution</b>?' : 'One copy for the <b>whole process</b>.<br>Ask: is it shared by <b>every thread</b>?' })));
          function start() {
            deck = ALL.slice();
            for (let j = deck.length - 1; j > 0; j--) { const r = Math.floor(rng() * (j + 1)); [deck[j], deck[r]] = [deck[r], deck[j]]; }
            i = 0; res = [];
            bins.forEach((b) => b.replaceChildren(h('div', { class: 'small muted ph', style: { padding: '18px 6px', textAlign: 'center', border: '2px dashed var(--line-2)', borderRadius: '10px' } }, 'Fields you place here appear in this list.')));
            fb.innerHTML = '<span class="muted">Decide where Solaris keeps this field. Ask: does it describe the <b>whole program</b>, or <b>one flow of execution</b>?</span>';
            paint();
          }
          function place(k) {
            if (i >= deck.length) return;
            const { f, home } = deck[i];
            const ok = k === home;
            res.push(ok);
            const ph = bins[home].querySelector('.ph'); if (ph) ph.remove();
            bins[home].append(h('div', { class: 'fld fade-in', style: { cursor: 'default', minHeight: '33px', fontSize: '15px', borderColor: `var(--${ok ? 'ok' : 'bad'})`, background: `var(--${ok ? 'ok' : 'bad'}-bg)` } },
              h('span', {}, f.short || f.n), h('span', { class: 'v', style: { fontFamily: 'var(--font)', fontWeight: 800, color: `var(--${ok ? 'ok' : 'bad'})` } }, ok ? '✓' : '✗ moved here')));
            fb.innerHTML = `<b style="color:var(--${ok ? 'ok' : 'bad'})">${ok ? 'Right.' : 'Not quite.'}</b> <b>${f.n}</b> lives in the ${home ? 'LWP structure, one copy per LWP' : 'process structure, shared by every LWP'}. ${f.why}`;
            i++;
            paint();
          }
          function paint() {
            const done = i >= deck.length;
            const right = res.filter(Boolean).length;
            score.textContent = `${right} of ${res.length} right`;
            counter.textContent = done ? 'All 13 fields placed' : `Field ${i + 1} of ${deck.length}`;
            if (done) {
              name.textContent = right === deck.length ? 'Perfect sort: 13 of 13!' : `${right} of ${deck.length} right`;
              hint.innerHTML = 'The rule: the <b>process</b> keeps what the whole program shares (identity, permissions, signal actions, memory, open files). Each <b>LWP</b> keeps what one flow of execution needs, plus links to its kernel thread and its process.';
            } else {
              name.textContent = deck[i].f.n;
              hint.innerHTML = `<b>Holds:</b> ${deck[i].f.what}`;
            }
            btns.forEach((b) => { b.disabled = done; });
          }
          start();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'Solaris split the old process structure in two. Sort each of the 13 fields into the half where it now lives.' }),
              h('div', { class: 'card white stack', style: { gap: '10px' } }, counter, name, hint, h('div', { class: 'row nw' }, ...btns)),
              fb,
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, score, again)),
            h('div', { class: 'grid-2', style: { alignItems: 'stretch' } }, ...binBoxes)));
        },
      },

      /* ---------------- 6. Lab: drive a kernel thread through its states ---------------- */
      {
        title: 'Lab: drive a kernel thread through its states',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const SUB = { RUN: 'ready', ONPROC: 'running', SLEEP: 'blocked', STOP: 'stopped', ZOMBIE: 'terminated', FREE: 'awaiting removal', PINNED: 'held for interrupt' };
          const ARROWS = [
            { ev: ['dispatch'], d: 'M187 188 L331 188', lab: [[259, 179, 'dispatch']] },
            { ev: ['preempt', 'quantum', 'yield'], d: 'M333 212 L189 212', lab: [[261, 234, 'preempt, quantum'], [261, 249, 'end or yield']] },
            { ev: ['sleep'], d: 'M372 230 L302 310', lab: [[346, 284, 'blocking call', 'start']] },
            { ev: ['wakeup'], d: 'M218 312 L150 232', lab: [[174, 284, 'wakeup', 'end']] },
            { ev: ['stop'], d: 'M372 170 L302 90', lab: [[346, 124, 'stop', 'start']] },
            { ev: ['cont'], d: 'M218 88 L150 168', lab: [[174, 124, 'continue', 'end']] },
            { ev: ['intr'], d: 'M445 170 L528 90', lab: [[478, 118, 'interrupt', 'end']] },
            { ev: ['intrdone'], d: 'M560 90 L472 170', lab: [[528, 146, 'done', 'start']] },
            { ev: ['exit'], d: 'M467 200 L531 200', lab: [[499, 191, 'exit']] },
            { ev: ['reap'], d: 'M600 230 L600 310', lab: [[610, 276, 'reap', 'start']] },
          ];
          let cur, last, path, visited;
          const svg = s('svg', { viewBox: '0 0 700 392', width: '100%', role: 'img', 'aria-label': 'Solaris kernel thread state diagram' });
          const nameEl = h('div', { style: { fontSize: '28px', fontWeight: 850, letterSpacing: '-.01em' } });
          const descEl = h('div', { class: 'small', style: { minHeight: '44px', lineHeight: 1.4 } });
          const fb = h('div', { class: 'say', style: { minHeight: '84px' } });
          const trail = h('div', { class: 'row', style: { gap: '4px 5px', fontSize: '13px' } });
          const chips = h('div', { class: 'row', style: { gap: '5px' } });
          const evBtns = TEVENTS.map((e) => h('button', { class: 'btn sm', type: 'button', onclick: () => fire(e) }, e.label));
          const bNew = h('button', { class: 'btn sm primary', type: 'button', onclick: () => reset() }, 'New thread');
          function reset() { cur = 'RUN'; last = null; path = ['RUN']; visited = new Set(['RUN']); fb.innerHTML = 'A new thread starts in <b>RUN</b>: ready, waiting for a processor. Press an event. Events that cannot happen now are dimmed, but you may try them to see why.'; draw(); }
          function fire(e) {
            if (cur === 'FREE') { fb.innerHTML = '<b style="color:var(--bad)">Not possible.</b> This thread is gone: it is FREE and about to be removed. Press <b>New thread</b>.'; return; }
            if (cur === 'PINNED' && e.k !== 'intrdone') { fb.innerHTML = '<b style="color:var(--bad)">Not possible.</b> A pinned thread just waits on its processor. The interrupt thread must finish first (<b>interrupt done</b>).'; return; }
            if (e.from !== cur) { fb.innerHTML = `<b style="color:var(--bad)">Not from ${cur}.</b> ${e.bad}`; return; }
            cur = e.to; last = e.k; path.push(e.label + '|' + cur); visited.add(cur);
            fb.innerHTML = `<b style="color:var(--ok)">${e.from} → ${e.to}.</b> ${e.ok}`;
            draw();
          }
          function draw() {
            const kids = [s('path', { d: 'M8 200 L51 200', class: 's-line', 'marker-end': 'url(#arr)' }), s('text', { x: 28, y: 190, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub', 'font-weight': 700 }, 'new')];
            ARROWS.forEach((a) => {
              const live = TEVENTS.some((e) => a.ev.includes(e.k) && e.from === cur), used = a.ev.includes(last);
              kids.push(s('path', { d: a.d, fill: 'none', stroke: used ? 'var(--accent)' : live ? 'var(--ink-2)' : 'var(--line-2)', 'stroke-width': used ? 3.5 : live ? 2.2 : 1.6, 'marker-end': `url(#arr${used ? '-accent' : live ? '' : '-muted'})`, 'stroke-dasharray': a.ev[0].startsWith('intr') ? '6 4' : null }));
              a.lab.forEach(([x, y, t, anc]) => kids.push(s('text', { x, y, 'text-anchor': anc || 'middle', 'font-size': 13.5, 'font-weight': used || live ? 750 : 600, style: `fill:var(--${used ? 'accent' : live ? 'ink' : 'muted'})` }, t)));
            });
            Object.entries(TSTATE).forEach(([k, v]) => {
              const on = k === cur, pin = k === 'PINNED';
              kids.push(s('rect', { x: v.x - 65, y: v.y - 28, width: 130, height: 56, rx: 12, class: on ? `s-${v.col === 'muted' ? 'panel' : v.col}` : 's-panel', 'stroke-width': on ? 4 : 1.5, 'stroke-dasharray': pin ? '6 4' : null, style: on && v.col !== 'muted' ? null : on ? 'stroke:var(--ink)' : null }),
                s('text', { x: v.x, y: v.y - 1, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: on ? null : 'fill:var(--ink-2)' }, k),
                s('text', { x: v.x, y: v.y + 17, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub', 'font-weight': 600 }, SUB[k]));
            });
            svg.replaceChildren(...kids);
            nameEl.textContent = cur; nameEl.style.color = `var(--${TSTATE[cur].col === 'muted' ? 'ink' : TSTATE[cur].col})`;
            descEl.textContent = TSTATE[cur].d;
            evBtns.forEach((b, i) => { const e = TEVENTS[i]; const ok = e.from === cur; b.style.opacity = ok ? '' : '.45'; b.classList.toggle('on', ok); });
            const shown = path.slice(-11);
            trail.replaceChildren(...(path.length > 11 ? [h('span', { class: 'muted' }, '…')] : []), ...shown.flatMap((p, i) => {
              const [lab, st] = p.includes('|') ? p.split('|') : [null, p];
              return [lab ? h('span', { class: 'muted xs' }, `→ ${lab} →`) : null, h('span', { class: 'chip ' + (i === shown.length - 1 ? 'accent' : '') }, st)].filter(Boolean);
            }));
            chips.replaceChildren(h('span', { class: 'small b' }, `States visited ${[...visited].filter((x) => x !== 'PINNED').length}/6:`),
              ...['RUN', 'ONPROC', 'SLEEP', 'STOP', 'ZOMBIE', 'FREE', 'PINNED'].map((k) => h('span', { class: 'chip ' + (visited.has(k) ? 'ok' : ''), style: k === 'PINNED' ? { border: '1.5px dashed var(--line-2)' } : null }, (visited.has(k) ? '✓ ' : '') + k)));
          }
          reset();
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack', style: { gap: '8px' } }, svg,
              h('div', { class: 'card tight' }, h('h4', { class: 'm0', style: { marginBottom: '4px' } }, 'Path so far'), trail),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"After wakeup the thread runs again." Not yet: wakeup moves it from SLEEP to <b>RUN</b>. It still has to wait for the dispatcher to give it a processor (ONPROC).' })),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'card white', style: { padding: '10px 14px' } }, h('h4', { class: 'm0' }, 'Current state of kernel thread K1'), nameEl, descEl),
              h('div', { class: 'grid-3', style: { gap: '6px' } }, ...evBtns),
              fb, chips, h('div', { class: 'row' }, bNew, h('span', { class: 'xs muted', html: 'Goal: visit all six states. Bonus: get pinned and unpinned.' })))));
        },
      },

      /* ---------------- 7. Interrupts as threads: animation + cost comparison ---------------- */
      {
        title: 'Interrupts become threads: pin, run, unpin',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          function watch(panel) {
            const svg = s('svg', { viewBox: '0 0 620 430', width: '100%', role: 'img', 'aria-label': 'An interrupt arrives at processor 0, the running thread is pinned and an interrupt thread from the pool handles it' });
            const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, o), t);
            const thr = (x, y, name, sub, cls, o = {}) => { const w = o.w || 124; return s('g', {}, s('rect', { x, y, width: w, height: 44, rx: 9, class: cls, 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash || null }),
              T(x + w / 2, y + 19, name, { 'font-size': 14.5 }), T(x + w / 2, y + 36, sub, { 'font-size': 12.5, 'font-weight': 600, class: 's-sub' })); };
            // frame table: what is where in each frame
            const F = [
              { c0: 'T1', pin: false, it: 'pool', lock: 'T2', w: 'SLEEP', irq: false, cap: '<b>Normal work.</b> Processor 0 runs T1. Processor 1 runs T2, which is adding a request to the disk queue, so T2 holds the queue\'s <span class="t" data-t="mutex">mutex</span> (a lock only one thread can hold). Three interrupt threads wait in a pool, deactivated. Each already has its own ID, priority, context and stack.' },
              { c0: 'T1', pin: false, it: 'pool', lock: 'T2', w: 'SLEEP', irq: true, cap: '<b>An interrupt.</b> The disk finishes a transfer and raises an interrupt. The hardware delivers it to one particular processor: processor 0.' },
              { c0: null, pin: true, it: 'pool', lock: 'T2', w: 'SLEEP', irq: true, cap: '<b>T1 is pinned.</b> Its context (registers and all) is preserved and it is suspended right where it is. A <span class="t">pinned thread</span> cannot move to processor 1, even if that one became free: it just waits until the interrupt has been handled.' },
              { c0: 'IT-a', pin: true, it: 'out', lock: 'T2', w: 'SLEEP', irq: false, cap: '<b>An interrupt thread takes over.</b> Processor 0 activates <span class="t">interrupt thread</span> IT-a from the pool, so no thread has to be created. IT-a has a higher priority than every other kernel thread; only a higher-priority interrupt thread could preempt it.' },
              { c0: 'IT-a', pin: true, it: 'out', lock: 'T2', w: 'SLEEP', irq: false, wait: true, cap: '<b>It must wait for the lock.</b> IT-a needs the disk queue, but T2 on processor 1 holds its mutex. Top priority does not let IT-a skip the lock: like any other thread, it waits until the lock is free. Interrupt threads and ordinary threads share data safely through the same <span class="t">mutual exclusion</span> locks.' },
              { c0: 'IT-a', pin: true, it: 'out', lock: 'IT-a', w: 'RUN', irq: false, cap: '<b>Handle the interrupt.</b> T2 releases the mutex. IT-a acquires it, marks the finished request done, and wakes thread W, which was sleeping until its data arrived (SLEEP → RUN).' },
              { c0: null, pin: true, it: 'pool', lock: 'free', w: 'RUN', irq: false, cap: '<b>Back to the pool.</b> IT-a releases the mutex and finishes. It returns to the pool, deactivated, ready for the next interrupt.' },
              { c0: 'T1', pin: false, it: 'pool', lock: 'free', w: 'RUN', irq: false, back: true, cap: '<b>T1 is unpinned.</b> Its saved context is restored and it continues on processor 0 exactly where it stopped. W is runnable and will be dispatched in the normal way.' },
            ];
            function draw(i) {
              const f = F[i];
              const sub = { 'font-size': 13, class: 's-sub', 'font-weight': 700, 'text-anchor': 'start' };
              const kids = [
                s('rect', { x: 4, y: 4, width: 300, height: 158, rx: 14, class: 's-cpu', 'stroke-width': 2, 'fill-opacity': 0.5 }), T(18, 28, 'Processor 0', { 'text-anchor': 'start', 'font-size': 15 }),
                s('rect', { x: 316, y: 4, width: 300, height: 158, rx: 14, class: 's-cpu', 'stroke-width': 2, 'fill-opacity': 0.5 }), T(330, 28, 'Processor 1', { 'text-anchor': 'start', 'font-size': 15 }),
                T(18, 74, 'running', sub), T(18, 132, 'pinned', sub), T(330, 74, 'running', sub),
                thr(424, 44, 'T2', f.lock === 'T2' ? 'holds queue mutex' : 'ONPROC', 's-os', { w: 170 }),
              ];
              if (f.c0 === 'T1') kids.push(thr(96, 44, 'T1', f.back ? 'ONPROC again' : 'ONPROC', 's-os', { sw: f.back ? 3.5 : 2, w: 150 }));
              else if (f.c0 === 'IT-a') kids.push(thr(96, 44, 'IT-a', f.wait ? 'waits for mutex' : 'interrupt handler', 's-intr', { sw: 3.5, w: 150 }));
              else kids.push(s('rect', { x: 96, y: 44, width: 150, height: 44, rx: 9, class: 's-muted', 'stroke-dasharray': '5 4' }), T(171, 71, 'switching…', { 'font-size': 12.5, class: 's-sub', 'font-weight': 600 }));
              if (f.pin) kids.push(thr(96, 102, 'T1', 'context saved', 's-panel', { dash: '6 4', w: 150 }),
                s('circle', { cx: 112, cy: 114, r: 6, class: 's-intr', 'stroke-width': 2 }), s('line', { x1: 112, y1: 120, x2: 112, y2: 130, stroke: 'var(--intr)', 'stroke-width': 3 }));
              else kids.push(s('rect', { x: 96, y: 102, width: 150, height: 44, rx: 9, class: 's-muted', 'stroke-dasharray': '3 5', 'stroke-width': 1.2 }), T(171, 129, 'nothing pinned', { 'font-size': 12, class: 's-sub', 'font-weight': 600 }));
              // disk + interrupt path
              kids.push(s('rect', { x: 4, y: 206, width: 140, height: 84, rx: 12, class: 's-io', 'stroke-width': 2 }), T(74, 240, 'Disk', { 'font-size': 15 }), T(74, 264, f.irq ? 'transfer done!' : 'working', { 'font-size': 13, 'font-weight': 600, class: 's-sub' }));
              if (f.irq) kids.push(s('path', { d: 'M50 204 L50 166', fill: 'none', stroke: 'var(--intr)', 'stroke-width': 4, 'marker-end': 'url(#arr-intr)', class: i === 1 ? 'pulse' : null }), T(60, 190, 'interrupt → CPU 0', { 'text-anchor': 'start', style: 'fill:var(--intr)', 'font-size': 13 }));
              // shared disk queue guarded by a mutex
              const lockCol = f.lock === 'free' ? 'ok' : f.lock === 'T2' ? 'os' : 'intr';
              kids.push(s('rect', { x: 164, y: 206, width: 262, height: 84, rx: 12, class: 's-panel', 'stroke-width': 2 }),
                T(295, 278, 'Disk request queue (shared)'),
                s('rect', { x: 180, y: 216, width: 230, height: 38, rx: 8, class: `s-${lockCol}`, 'stroke-width': 2 }),
                T(295, 241, f.lock === 'free' ? 'mutex: free' : `mutex held by ${f.lock}`, { 'font-size': 14, style: `fill:var(--${lockCol})` }));
              if (f.wait || f.lock === 'IT-a') kids.push(s('path', { d: 'M246 66 L268 66 L268 212', fill: 'none', stroke: 'var(--intr)', 'stroke-width': f.wait ? 2.5 : 3.5, 'stroke-dasharray': f.wait ? '5 4' : null, 'marker-end': 'url(#arr-intr)' }),
                T(276, 190, f.wait ? 'wants the mutex' : 'has the mutex', { 'text-anchor': 'start', 'font-size': 13, style: 'fill:var(--intr)' }));
              // thread W waiting for the disk
              kids.push(thr(442, 222, 'Thread W', f.w === 'SLEEP' ? 'SLEEP: waits for disk' : 'RUN: woken up', f.w === 'SLEEP' ? 's-panel' : 's-ok', { sw: f.w === 'RUN' ? 3 : 1.5, w: 174 }));
              // priority ladder
              kids.push(T(4, 326, 'Priority', { 'text-anchor': 'start', 'font-size': 13, class: 's-sub', 'font-weight': 800 }),
                s('rect', { x: 4, y: 336, width: 140, height: 34, rx: 7, class: 's-intr', 'stroke-width': 1.5 }), T(74, 358, 'interrupt threads', { 'font-size': 12.5 }),
                s('rect', { x: 4, y: 380, width: 140, height: 34, rx: 7, class: 's-os', 'stroke-width': 1.5 }), T(74, 402, 'other kernel threads', { 'font-size': 12.5 }),
                s('path', { d: 'M152 408 L152 342', fill: 'none', class: 's-line', 'marker-end': 'url(#arr)' }), T(158, 380, 'higher', { 'text-anchor': 'start', 'font-size': 12, class: 's-sub', 'font-weight': 700 }));
              // pool of deactivated interrupt threads
              kids.push(s('rect', { x: 216, y: 316, width: 400, height: 110, rx: 12, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }),
                T(416, 338, 'Pool of deactivated interrupt threads', { 'font-size': 13.5, class: 's-sub' }));
              ['IT-a', 'IT-b', 'IT-c'].forEach((n, k) => {
                const here = k > 0 || f.it === 'pool';
                const x = 236 + k * 126;
                kids.push(s('rect', { x, y: 352, width: 110, height: 58, rx: 9, class: here ? 's-intr' : 's-muted', 'stroke-width': 1.8, 'stroke-dasharray': here ? null : '4 3' }),
                  T(x + 55, 376, here ? n : 'IT-a', { 'font-size': 14.5, class: here ? null : 's-sub' }),
                  T(x + 55, 397, here ? 'own ID + stack' : 'out working', { 'font-size': 12.5, class: 's-sub', 'font-weight': 600 }));
              });
              svg.replaceChildren(...kids);
              return f.cap;
            }
            const player = ctx.ui.player({ count: F.length, render: draw, interval: 3600 });
            player.caption.style.minHeight = '150px';
            panel.append(h('div', { class: 'split r fill' },
              h('div', { class: 'card white', style: { padding: '10px 12px', display: 'grid', placeItems: 'center' } }, svg),
              h('div', { class: 'stack', style: { gap: '10px' } }, player.el,
                h('div', { class: 'card tight small stack', style: { gap: '6px' } },
                  h('h4', { class: 'm0' }, 'Every interrupt thread'),
                  h('div', { html: '• has its own <b>ID, priority, context</b> (saved registers) <b>and stack</b>' }),
                  h('div', { html: '• outranks <b>every other kernel thread</b>' }),
                  h('div', { html: '• waits <b>deactivated in a pool</b>, so none is created on the spot' }),
                  h('div', { html: '• uses the same <b>mutex locks</b> as other threads' })))));
          }
          function why(panel) {
            let cs = 40, irq = 2, cpus = 4;
            const COST_IPL = 1, COST_IT = 6;
            const bars = h('div', { class: 'stack', style: { gap: '8px' } });
            const verdict = h('div', { class: 'say' });
            const bar = (label, val, max, col, formula) => h('div', { class: 'stack', style: { gap: '3px' } },
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, label), h('span', { class: 'mono small b', style: { color: `var(--${col})` } }, `${val} units/ms`)),
              h('div', { class: 'meter', style: { height: '16px' } }, h('i', { style: { width: (max ? (100 * val) / max : 0) + '%', background: `var(--${col})` } })),
              h('div', { class: 'xs muted mono' }, formula));
            function upd() {
              const a = cs * cpus * COST_IPL, b = irq * COST_IT, m = Math.max(a, b, 1);
              bars.replaceChildren(
                bar('Block interrupts around every critical section', a, m, 'bad', `${cs} sections × ${cpus} processor${cpus > 1 ? 's' : ''} × ${COST_IPL} unit`),
                bar('Interrupt threads (pay only when an interrupt happens)', b, m, 'ok', `${irq} interrupts × ${COST_IT} units`));
              if (b === 0) verdict.innerHTML = '<b>No interrupts, no extra cost</b> for interrupt threads, while blocking still pays on every single critical section.';
              else if (a > b) verdict.innerHTML = `<b>Interrupt threads cost ${ctx.util.fmt(a / b, 1)}× less here.</b> Shared data is entered far more often than interrupts arrive, so paying per interrupt beats paying per critical section.`;
              else if (a === b) verdict.innerHTML = '<b>A tie.</b> Both approaches pay the same here.';
              else verdict.innerHTML = '<b>Here blocking would be cheaper.</b> Interrupt threads pay off when critical sections are much more frequent than interrupts, which is the normal situation in a busy kernel.';
            }
            const sl = [
              ctx.ui.slider({ label: 'Critical sections / ms', min: 5, max: 100, step: 5, value: cs, onInput: (v) => { cs = v; upd(); } }),
              ctx.ui.slider({ label: 'Interrupts / ms', min: 0, max: 20, value: irq, onInput: (v) => { irq = v; upd(); } }),
              ctx.ui.slider({ label: 'Processors', min: 1, max: 8, value: cpus, onInput: (v) => { cpus = v; upd(); } }),
            ];
            upd();
            panel.append(h('div', { class: 'split fill' },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0', html: 'Interrupt handlers and ordinary kernel code often touch the same data. A traditional kernel protects each <span class="t">critical section</span> (code that uses that data) by raising the <span class="t">interrupt priority level</span> before it and lowering it afterwards, even though most interrupts never touch that data. Every raise and lower costs time.' }),
                h('p', { class: 'm0', html: 'On an <span class="t" data-t="Symmetric multiprocessor">SMP</span> it gets worse: blocking interrupts on one processor does nothing about a handler running on another, so the kernel may have to block them on <b>all</b> processors, and it needs locks anyway.' }),
                h('div', { class: 'callout tip m0', 'data-label': 'The Solaris answer', html: 'Make handlers threads. They use the same mutex locks as everything else, so the extra cost appears <b>only when an interrupt actually happens</b>.' }),
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"Solaris creates a thread for each interrupt." No: creating a thread would be far too slow. It takes an already-built interrupt thread from the pool and puts it back afterwards.' })),
              h('div', { class: 'card stack', style: { gap: '10px' } }, ...sl, bars, verdict,
                h('div', { class: 'small', html: '<b>Try:</b> drag <b>Interrupts / ms</b> to 0, then to 20 with <b>Critical sections / ms</b> at 5. Which approach wins in a busy kernel, where shared data is touched constantly?' }),
                h('div', { class: 'xs muted', html: 'Illustrative costs, not measurements: raising and lowering the IPL = 1 unit per processor affected; handling one interrupt with an interrupt thread (pin, switch, unpin) = 6 units.' }))));
          }
          el.append(ctx.ui.tabs([{ label: 'Watch an interrupt arrive', render: watch }, { label: 'Why not just block interrupts?', render: why }]));
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: six things to remember about Solaris threads',
        kind: 'recap',
        render(el, ctx) {
          const cards = ctx.ui.flipcards([
              ['The four thread-related concepts', '<div><b>Process</b>: the container (address space, stack, PCB). <b>ULTs</b>: library threads the kernel cannot see. <b>LWPs</b>: the bridge, each mapped to one kernel thread. <b>Kernel threads</b>: what is dispatched onto processors.</div>'],
              ['How many kernel threads per LWP?', '<div>Always <b>exactly one</b>. The reverse is not true: some kernel threads have <b>no LWP</b> and do the kernel\'s own work, such as handling interrupts.</div>'],
              ['Why three levels of thread?', '<div>The <b>program</b> gets a clean, cheap threads interface; the <b>OS</b> controls what really runs (and runs LWPs in parallel on several processors); and the kernel\'s own jobs run as LWP-less kernel threads, so switching among them is a <b>thread switch, not a process switch</b>.</div>'],
              ['What does each LWP structure hold?', '<div>What a traditional process held only once: <b>priority, signal mask, saved user registers, kernel stack</b>. Plus an <b>LWP ID</b>, <b>usage and profiling data</b>, and pointers to its <b>kernel thread</b> and its <b>process</b>.</div>'],
              ['The six kernel-thread states', '<div><b>RUN</b> ready · <b>ONPROC</b> running · <b>SLEEP</b> blocked · <b>STOP</b> stopped · <b>ZOMBIE</b> terminated · <b>FREE</b> released, awaiting removal. Preempt, quantum end or yield: ONPROC → RUN.</div>'],
              ['When an interrupt arrives…', '<div>It goes to one processor. The running thread is <b>pinned</b> (context saved, cannot migrate). A pooled <b>interrupt thread</b> runs at top priority using ordinary mutex locks, then the thread is unpinned.</div>'],
            ], { cols: 3, height: 228 });
          cards.style.padding = '0 8px'; // room for the 3D flip so a turning card never pokes past the edge
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'), cards));
        },
      },

      /* ---------------- 9. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In Solaris, which entity does the kernel actually schedule and dispatch onto a processor?', choices: ['A user-level thread', 'A kernel thread', 'The thread library', 'The process structure'], answer: 1,
            feedback: ['User-level threads are invisible to the kernel, so it cannot schedule them. It schedules the kernel thread behind the LWP a ULT runs on.', null, 'The thread library is ordinary user-mode code inside the process; it chooses which ULT runs on an LWP, not what runs on a processor.', 'The process structure is a record of shared resources. It is not a unit of execution.'],
            why: 'Kernel threads are the fundamental entities that can be scheduled and dispatched onto a processor. Each LWP is backed by one, and some exist with no LWP at all.' },
          { q: 'What is the main reason Solaris uses three levels of thread (user-level threads, LWPs and kernel threads)?', choices: ['Let the OS manage what really runs, while programs keep a simple, flexible threads interface', 'Let the kernel schedule every ULT directly, so no thread library is needed', 'Give every thread its own private address space, so threads cannot corrupt each other', 'Make kernel threads unnecessary on machines with a single processor'], answer: 0,
            feedback: [null, 'The kernel never sees ULTs. The library schedules ULTs onto LWPs; the kernel schedules the kernel threads behind the LWPs.', 'Threads of one process share one address space. That sharing is what makes them cheap and lets them cooperate.', 'Kernel threads are what the kernel dispatches on every machine, including one with a single processor.'],
            why: 'The levels split the work: a thread library gives the application a clean, cheap interface (ULTs), and each LWP is tied to one kernel thread so the OS controls scheduling, blocking and parallel execution. Kernel threads with no LWP let the kernel run its own jobs with cheap thread switches instead of process switches.' },
          { type: 'tf', q: 'Every LWP is supported by exactly one kernel thread, and every kernel thread belongs to exactly one LWP.', answer: false,
            why: 'The first half is true, the second is not. Some kernel threads have no LWP: they run kernel functions such as interrupt handling.' },
          { type: 'num', q: 'A Solaris process has 6 user-level threads mapped onto 3 LWPs. How many kernel threads support this process\'s LWPs?', answer: 3, tol: 0, unit: 'kernel threads',
            why: 'There is always exactly one kernel thread per LWP, so 3 LWPs means 3 kernel threads. The number of ULTs does not matter; the kernel never sees them.' },
          { type: 'num', q: 'A process spreads 5 ULTs over 4 LWPs. The machine has 2 processors and no LWP is blocked. At most how many of the process\'s ULTs can execute at the same instant?', answer: 2, tol: 0, unit: 'ULTs',
            why: 'Each LWP runs one ULT at a time, and each LWP runs only when the kernel puts its kernel thread on a processor. With 2 processors, at most 2 kernel threads, so 2 ULTs, run at once.' },
          { q: 'A process has 3 LWPs, each carrying ULTs. A ULT on LWP 2 calls read() and must wait for the disk. What happens?', choices: ['The whole process blocks until the read finishes', 'LWP 2 and its kernel thread sleep; LWPs 1 and 3 keep running', 'The kernel moves the waiting ULT onto another LWP', 'The library runs another ULT on LWP 2 while the read waits'], answer: 1,
            feedback: ['That is what happens with pure user-level threads. Here the kernel blocks only the kernel thread that made the call.', null, 'The kernel cannot see ULTs, and the calling ULT is stuck inside the system call on LWP 2 until it returns.', 'LWP 2 itself is asleep inside the kernel, so nothing can run on it until the call returns. Other ULTs can run only on the other LWPs.'],
            why: 'The kernel schedules each LWP independently. A blocking system call puts that one LWP\'s kernel thread to SLEEP; the process\'s other LWPs are unaffected.' },
          { type: 'bucket', q: 'Where does Solaris keep each item?', buckets: ['Process structure', 'Each LWP structure'],
            items: [['Signal dispatch table', 0], ['Signal mask', 1], ['Memory map', 0], ['Kernel stack', 1], ['File descriptors', 0], ['Saved user-level registers', 1]],
            why: 'The process keeps what every thread shares (identity, permissions, signal actions, memory map, open files). Each LWP keeps what one flow of execution needs, plus links to its kernel thread and process. A traditional UNIX process held that per-execution part only once, as a single processor state.' },
          { type: 'match', q: 'Match each kernel-thread state to its meaning.', pairs: [['RUN', 'Runnable, waiting for a processor'], ['ONPROC', 'Executing on a processor'], ['SLEEP', 'Blocked, waiting for an event'], ['STOP', 'Stopped, for example by a debugger'], ['ZOMBIE', 'Terminated, leftovers not yet collected'], ['FREE', 'Resources released, awaiting removal']],
            why: 'These six states describe a Solaris kernel thread from ready to fully gone. FREE comes after ZOMBIE, once the thread has been reaped.' },
          { q: 'A thread in the ONPROC state uses up its quantum. Which state does it move to?', choices: ['SLEEP', 'RUN', 'STOP', 'ZOMBIE'], answer: 1,
            feedback: ['SLEEP is for a thread that must wait for an event, such as a blocking system call. This thread could keep going.', null, 'STOP happens when the thread\'s process is stopped, for example by a debugger.', 'ZOMBIE is for a thread that has exited.'],
            why: 'Time slicing takes the processor away, but the thread is still ready to run, so it goes back to RUN. Preemption and yield lead there too.' },
          { type: 'order', q: 'Put the handling of an interrupt in Solaris in order.', items: ['The interrupt is delivered to one particular processor', 'The thread running there is pinned and its context saved', 'An interrupt thread is taken from the pool of deactivated threads', 'The interrupt thread runs the handler, taking mutex locks as needed', 'The interrupt thread goes back to the pool', 'The pinned thread is unpinned and resumes'],
            why: 'Deliver, pin, activate a pooled interrupt thread, handle (with ordinary locking), return it to the pool, and resume the pinned thread where it stopped.' },
          { type: 'multi', q: 'Which statements about Solaris interrupt threads are true?', choices: ['Each has its own identifier, priority, context and stack', 'They run at a higher priority than all other kernel threads', 'A new thread is created each time an interrupt arrives', 'They synchronize with other kernel threads using mutual exclusion primitives', 'A pinned thread may move to another processor while it waits'], answer: [0, 1, 3],
            why: 'Interrupt threads are full kernel threads with top priority, kept deactivated in a pool so none is created on demand, and they use ordinary locks. A pinned thread stays on its processor until the interrupt is handled.' },
          { q: 'Why does Solaris handle interrupts with interrupt threads instead of blocking interrupts around shared kernel data?', choices: ['Blocking interrupts is impossible on a single processor', 'The extra cost is paid only when an interrupt occurs, not on every entry to shared kernel data', 'Interrupt threads never need locks, because they run at the highest priority', 'User-level threads can then handle hardware interrupts directly, without entering the kernel'], answer: 1,
            feedback: ['A single processor can easily block interrupts by raising its interrupt priority level; the problem is the cost of doing it on every access to shared data.', null, 'Top priority does not remove the need for locks: interrupt threads use the same mutual exclusion primitives as other kernel threads and wait when the data they need is locked.', 'Interrupt threads are kernel threads; user-level threads never handle hardware interrupts.'],
            why: 'Critical sections are entered far more often than interrupts arrive, so paying per interrupt is cheaper than raising and lowering the interrupt level on every access. On a multiprocessor the old way is even worse, since interrupts may have to be blocked on every processor.' },
        ],
      },

    ],

    notes: `
      <h3>1. Four thread-related concepts in Solaris</h3>
      <p>Solaris, a UNIX system built for multiprocessors, splits running a thread across four layers:</p>
      <ul>
        <li><b>Process</b>: the ordinary UNIX process, with the user's address space, a stack and a process control block (PCB). It is the container whose memory, files and signal settings every thread shares.</li>
        <li><b>User-level threads (ULTs)</b>: made by a thread library in the process's address space; invisible to the OS. They are the program's interface for parallelism, and creating or switching them needs no kernel call.</li>
        <li><b>Lightweight processes (LWPs)</b>: a mapping between ULTs and kernel threads. (In Solaris the name means this specific structure; section 4.1 used "lightweight process" loosely for any thread.) Each LWP supports one or more ULTs (running one at a time) and maps to exactly one kernel thread. The kernel schedules LWPs independently, so they may execute in parallel on a multiprocessor.</li>
        <li><b>Kernel threads</b>: the fundamental entities that are scheduled and dispatched onto one of the system's processors.</li>
      </ul>
      <p>Rule to remember: there is <b>always exactly one kernel thread per LWP</b>. The reverse does not hold: some kernel threads have no LWP. The kernel creates, runs and destroys them to carry out its own system functions, such as handling interrupts.</p>
      <pre>ULTs (in the library)  →  LWPs  ─ exactly one each ─  kernel threads  →  processors
                                    (+ kernel threads with no LWP, e.g. interrupts)</pre>
      <p>The simplest case is one ULT on one LWP: a single flow of execution, which behaves like a traditional UNIX process. A program that wants concurrency uses several ULTs and LWPs. <b>Two versions:</b> Solaris 2 to 8 let many ULTs share a smaller set of LWPs (many-to-many, as in the lab); from Solaris 9 on, the library gives every ULT its own LWP (one-to-one). The layers and the one-kernel-thread-per-LWP rule are the same in both.</p>
      <h3>2. Why three levels of thread?</h3>
      <ul>
        <li><b>A clean interface for the application:</b> the program uses a standard thread library. In the many-to-many design, the library does cheap user-space bookkeeping: creating and switching ULTs and choosing which ULT runs on an LWP, with no kernel call.</li>
        <li><b>Control for the OS:</b> each LWP is bound to one kernel thread with matching execution states, so concurrency and execution are managed at the kernel-thread level. The kernel picks which kernel thread runs on which processor, blocks one LWP without stalling the rest, and runs a process's LWPs in parallel.</li>
        <li><b>Cheaper kernel work:</b> running system functions as kernel threads (with no LWP) rather than as kernel processes means switching among them inside the kernel is a thread switch, not a more expensive process switch.</li>
      </ul>
      <h3>3. How the mapping behaves</h3>
      <ul>
        <li>An LWP runs one ULT at a time; ULTs sharing an LWP take turns under the library's control. (In the many-to-many design a ULT could be bound to its own LWP; unbound ULTs could run on any free LWP of their process.)</li>
        <li>At most one ULT per LWP, and at most one kernel thread per processor, can run at once. Example: 5 ULTs on 4 LWPs with 2 processors → at most <b>2</b> ULTs execute at the same instant. 6 ULTs on 3 LWPs → exactly <b>3</b> kernel threads support them.</li>
        <li>Only a ULT that is actually executing (its LWP's kernel thread is ONPROC) can make a system call. A blocking call puts only that LWP's kernel thread to sleep (ONPROC → SLEEP); other LWPs keep running. ULTs waiting on the same LWP are stuck too. If a process has a single LWP, one blocking call stalls the whole process, just like pure ULTs.</li>
        <li>With more LWPs than processors, runnable LWPs take turns: the extras wait in RUN.</li>
      </ul>
      <h3>4. Process structure: traditional UNIX vs Solaris</h3>
      <table>
        <tr><th>Traditional UNIX process</th><th>Solaris process</th></tr>
        <tr><td>Process ID, user IDs, signal dispatch table, memory map, file descriptors</td><td>The same five shared items</td></tr>
        <tr><td>One <b>processor state</b>: priority, signal mask, registers, stack</td><td>A <b>list of LWP structures</b>, one per LWP, each holding its own per-execution state</td></tr>
      </table>
      <p>Each <b>LWP data structure</b> holds: (1) an LWP identifier; (2) the priority of this LWP, and hence of the kernel thread that supports it; (3) a signal mask telling the kernel which signals will be accepted; (4) saved values of user-level registers while the LWP is not running; (5) the kernel stack for this LWP, with system call arguments, results and error codes for each call level; (6) resource usage and profiling data; (7) a pointer to the corresponding kernel thread; (8) a pointer to the process structure.</p>
      <p>The principle: the process keeps what the whole program shares; each LWP keeps what one flow of execution needs. That is what lets one process run in several places at once.</p>
      <h3>5. Kernel-thread states (simplified)</h3>
      <table>
        <tr><th>State</th><th>Meaning</th></tr>
        <tr><td>RUN</td><td>Runnable: ready to execute, waiting for a processor.</td></tr>
        <tr><td>ONPROC</td><td>Executing on a processor.</td></tr>
        <tr><td>SLEEP</td><td>Blocked, waiting for an event.</td></tr>
        <tr><td>STOP</td><td>Stopped (its process was stopped, e.g. by a debugger).</td></tr>
        <tr><td>ZOMBIE</td><td>Terminated; leftovers not yet collected.</td></tr>
        <tr><td>FREE</td><td>Resources released; awaiting removal from the OS thread data structure.</td></tr>
      </table>
      <p>Transitions: RUN → ONPROC on <b>dispatch</b>. ONPROC → RUN on <b>preemption</b> by a higher-priority thread, <b>end of quantum</b> (time slicing) or <b>yield</b>. ONPROC → SLEEP on a <b>blocking system call</b>; SLEEP → RUN on <b>wakeup</b> (it must still wait for a processor). ONPROC → STOP on <b>stop</b> (a thread stops itself, so a stop request takes effect when it next runs); STOP → RUN on <b>continue</b>. ONPROC → ZOMBIE on <b>exit</b>; ZOMBIE → FREE when the thread is <b>reaped</b>. When an interrupt arrives, the running thread (and its LWP) may be <b>pinned</b> until the interrupt is handled; this is a temporary hold, not one of the six states.</p>
      <h3>6. Interrupts as threads</h3>
      <ul>
        <li>Solaris handles interrupts with a set of <b>interrupt threads</b>, kernel threads that each have their own identifier, priority, context and stack.</li>
        <li>Interrupt threads get higher priorities than all other kernel threads; only a higher-priority interrupt thread can preempt one.</li>
        <li>The kernel controls access to shared data and synchronizes interrupt threads with mutual exclusion primitives (mutex locks), just as for other threads. An interrupt thread that needs a locked structure waits for it; its top priority does not let it skip the lock.</li>
      </ul>
      <p>Sequence: (1) the interrupt is delivered to a particular processor; (2) the thread running there is <b>pinned</b>: its context is saved, it is suspended and it cannot move to another processor; (3) the processor starts an interrupt thread taken from a <b>pool of deactivated interrupt threads</b>, so no thread is created; (4) the interrupt thread handles the interrupt, locking shared data as needed; (5) it returns to the pool; (6) the pinned thread is unpinned and resumes exactly where it stopped.</p>
      <p><i>Going deeper:</i> in the real kernel, if an interrupt thread has to go to sleep (not just wait briefly for a lock), Solaris turns it into a full kernel thread and releases the pinned thread early, so the interrupted work is not held up.</p>
      <p><b>Why:</b> a traditional kernel protects data shared with interrupt handlers by raising the interrupt priority level before each access and lowering it after, although most interrupts never touch that data. That costs time on every critical section, and on a multiprocessor the kernel may have to block interrupts on all processors (and needs locks anyway). With interrupt threads the cost appears only when an interrupt happens, and interrupts are far rarer than critical sections (stretches of code that use shared data). Illustration with made-up unit costs: blocking costs 40 critical sections/ms × 4 processors × 1 unit = 160 units/ms; interrupt threads cost 2 interrupts/ms × 6 units = 12 units/ms, about 13.3 times less. Common mistake: Solaris does not create a thread per interrupt; it reuses pooled ones.</p>
    `,
  });
})();
