/* =====================================================================
   Section 4.1 — Processes and Threads
   A process bundles two separable ideas: owning resources and being
   scheduled. Threads split them apart. Original teaching material.
   ===================================================================== */
Guide.section({
  id: '4.1',
  title: 'Processes and Threads',
  short: 'Processes & threads',
  summary: 'A process owns the resources; its threads do the running. Why splitting the two pays off.',
  objectives: [
    'Explain the two characteristics of a process (resource ownership and scheduling/execution) and why separating them gives us threads.',
    'Match the four process/thread models to example systems, and say what a process owns versus what each thread owns.',
    'State the four performance benefits of threads and recognise the four ways threads are used in a single-user system.',
    'Trace thread states and the Spawn, Block, Unblock and Finish operations, including interleaving on one processor and an RPC example.',
    'Explain why threads that share one address space must synchronize their work.',
  ],
  terms: [
    ['Resource ownership', 'The side of a process that holds things: a virtual address space containing the process image, plus open files, I/O devices and other resources, all protected by the OS from other processes.'],
    ['Scheduling and execution', 'The side of a process that runs: a path through program code, with its own execution state (Running, Ready, Blocked...) and a dispatching priority the scheduler uses.'],
    ['Unit of dispatching', 'Whatever the scheduler picks to run on a processor. In a multithreaded operating system this is the thread, not the whole process.'],
    ['Task', 'Another name for a process when we mean the unit that owns resources (address space, files, devices) rather than the thing that runs.'],
    ['Lightweight process', 'Another name for a thread, the unit that gets dispatched. It is “lightweight” because it carries only execution state, not a whole set of resources. (Some systems, such as Solaris, also use the name for one specific kernel structure.)'],
    ['Multithreading', 'The ability of an operating system to support several concurrent paths of execution (threads) inside a single process.'],
    ['Virtual address space', 'The range of memory addresses a process may use, which the OS maps onto real memory. It holds the process image, and every thread of the process works inside this one space.'],
    ['Thread context', 'The register values, above all the program counter and stack pointer, that a thread needs to resume exactly where it stopped. It is saved in the thread control block whenever the thread is not running.'],
    ['User stack', 'The stack a thread uses while running ordinary program code in user mode: the return addresses, parameters and local variables of its function calls.'],
    ['Kernel stack', 'A separate stack used while the kernel runs on behalf of a thread (during a system call or an interrupt), so kernel work never mixes with the thread’s user stack.'],
    ['Thread-local storage (TLS)', 'A small amount of static storage that belongs to one thread only, such as its own copy of an error code or a counter. Every thread has its own copy.'],
    ['Interprocess communication (IPC)', 'Any mechanism that lets separate processes exchange data or signals, such as pipes, messages or shared memory. It normally needs the kernel’s help, because processes are protected from each other.'],
    ['Dispatching priority', 'A number the scheduler uses to decide which ready unit of execution gets the processor first. A higher-priority thread is served before a lower-priority one.'],
    ['Spawn', 'The thread operation that creates a new thread: it gets its own register context and stack and is placed on the ready list. Creating a process also spawns its first thread.'],
    ['Remote procedure call (RPC)', 'A call to a procedure that runs on another computer. The caller sends a request over the network and waits (is blocked) until the reply comes back.'],
    ['Time quantum', 'The longest stretch a thread may run before the scheduler can take the processor away and give another ready thread a turn. Also called a time slice.'],
    ['Preemption', 'Taking the processor away from a running thread before it chooses to stop, for example because its time quantum expired or a higher-priority thread became ready.'],
    ['Uniprocessor', 'A computer with a single processor (one core). Only one thread can execute at any instant, so threads take turns.'],
    ['Thread synchronization', 'Coordinating threads that share data so their actions happen in a safe order and cannot corrupt shared data structures.'],
    ['Lost update', 'A race-condition outcome: two threads read the same old value, each writes back its own result, and the second write silently wipes out the first.'],
  ],

  css: `
    .sec-4-1 .info { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 15px; line-height: 1.45; }
    .sec-4-1 .info b { color: var(--chc); }
    .sec-4-1 .hot { cursor: pointer; outline: none; }
    .sec-4-1 .hot .fr { transition: stroke-width .15s; }
    .sec-4-1 .hot:hover .fr, .sec-4-1 .hot:focus-visible .fr { stroke-width: 3; }
    .sec-4-1 .hot.sel .fr { stroke-width: 3.5; stroke: var(--chc); }
    .sec-4-1 .s1-info { min-height: 92px; }
    .sec-4-1 .road { font-size: 14.5px; color: var(--ink-2); }
    .sec-4-1 .m-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .sec-4-1 .m-cell { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; text-align: left; color: var(--ink); font: inherit; min-height: 0; }
    .sec-4-1 .m-cell:hover { border-color: var(--chc); }
    .sec-4-1 .m-cell.armed { border-style: dashed; border-color: var(--chc); }
    .sec-4-1 .m-cell.bad { border-color: var(--bad); background: var(--bad-bg); }
    .sec-4-1 .m-cell .m-name { font-weight: 800; font-size: 15px; }
    .sec-4-1 .m-cell .m-got { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; }
    .sec-4-1 .m-tray { display: flex; flex-wrap: wrap; gap: 6px; min-height: 36px; align-items: center; }
    .sec-4-1 .m-tray .btn.on { background: var(--chc); border-color: var(--chc); color: var(--panel); }
    .sec-4-1 .own ul { margin: 4px 0 0; padding-left: 20px; font-size: 15px; line-height: 1.4; }
    .sec-4-1 .own li { margin: 1px 0; }
    .sec-4-1 .own h4 { margin: 0; }
    .sec-4-1 .card.proc h4 { color: var(--proc); }
    .sec-4-1 .card.thread h4 { color: var(--thread); }
    .sec-4-1 .s3-say { min-height: 96px; }
    .sec-4-1 .trace { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; }
    .sec-4-1 .dim { opacity: .38; }
    .sec-4-1 .sflash { animation: sec-4-1-blink .8s ease 2; }
    @keyframes sec-4-1-blink { 50% { opacity: .2; } }
    .sec-4-1 .ben { margin: 0; padding-left: 22px; }
    .sec-4-1 .ben li { margin: 0 0 6px; }
    .sec-4-1 .cost td.n, .sec-4-1 .cost th.n { text-align: center; width: 84px; font-variant-numeric: tabular-nums; }
    .sec-4-1 .cost td.n.no, .sec-4-1 .cost th.n.w { width: 128px; }
    .sec-4-1 .cost td.no { color: var(--muted); font-size: 13px; }
    .sec-4-1 .cost td.pr { color: var(--proc); font-weight: 800; }
    .sec-4-1 .cost td.th { color: var(--thread); font-weight: 800; }
    .sec-4-1 .bar { display: grid; grid-template-columns: 150px minmax(0, 1fr) 70px; align-items: center; gap: 10px; font-size: 14.5px; font-weight: 700; }
    .sec-4-1 .bar .trk { height: 18px; border-radius: 6px; background: var(--panel-3); overflow: hidden; }
    .sec-4-1 .bar .trk i { display: block; height: 100%; border-radius: 6px; transition: width .45s ease; }
    .sec-4-1 .bar .trk i.pb { background: var(--proc); }
    .sec-4-1 .bar .trk i.tb { background: var(--thread); }
    .sec-4-1 .bar .v { text-align: right; font-variant-numeric: tabular-nums; }
    .sec-4-1 .use { padding: 7px 11px; }
    .sec-4-1 .use b { display: block; font-size: 15px; color: var(--thread); }
    .sec-4-1 .use span { display: block; font-size: 14.5px; line-height: 1.38; color: var(--ink-2); }
    .sec-4-1 .scn { font-size: 17px; line-height: 1.45; min-height: 104px; display: flex; align-items: center; }
    .sec-4-1 .bins { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .sec-4-1 .bin { border: 1.5px dashed var(--line-2); border-radius: 10px; padding: 6px 8px; min-height: 150px; }
    .sec-4-1 .bin h4 { font-size: 11.5px; margin: 0 0 4px; }
    .sec-4-1 .bin .chip { display: flex; white-space: normal; line-height: 1.3; margin: 3px 0; padding: 2px 8px; font-size: 12.5px; border-radius: 8px; }
    .sec-4-1 .pick4 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .sec-4-1 .ops { margin: 0; padding-left: 20px; font-size: 14.5px; line-height: 1.4; }
    .sec-4-1 .ops li { margin: 0 0 3px; }
    .sec-4-1 .callout.sm { font-size: 14.5px; padding: 8px 12px; line-height: 1.4; }
    .sec-4-1 .arc { fill: none; stroke: var(--line-2); stroke-width: 2; }
    .sec-4-1 .arc.on { stroke: var(--thread); stroke-width: 2.8; }
    .sec-4-1 .arcl { font-size: 12.5px; fill: var(--muted); }
    .sec-4-1 .arcl.on { fill: var(--thread); font-weight: 800; }
    .sec-4-1 svg.nw .arcl { font-size: 16.5px; }
    .sec-4-1 .thtbl td, .sec-4-1 .thtbl th { padding: 3px 8px; font-size: 14px; vertical-align: middle; }
    .sec-4-1 .thtbl .btn.sm { height: 24px; padding: 0 8px; font-size: 12.5px; }
    .sec-4-1 .s7-cap { min-height: 88px; }
    .sec-4-1 .rpc-ctl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 18px; align-items: center; }
    .sec-4-1 .tot { display: flex; gap: 8px; }
    .sec-4-1 .tot .chip { font-size: 14px; padding: 3px 11px; }
    .sec-4-1 .s8-guess { width: 46px; height: 22px; margin: 0 3px; padding: 0 4px; font: inherit; font-size: 13.5px; text-align: center; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel); color: var(--ink); }
    .sec-4-1 .s8-cap { min-height: 72px; }
    .sec-4-1 .s9-mem { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; padding: 6px 14px; }
    .sec-4-1 .s9-mem .xs { white-space: nowrap; }
    .sec-4-1 .s9-mem .big { font-size: 34px; line-height: 1; color: var(--mem); font-variant-numeric: tabular-nums; }
    .sec-4-1 .s9-th { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; }
    .sec-4-1 .s9-th h4 { margin: 0 0 2px; display: flex; justify-content: space-between; align-items: center; color: var(--thread); }
    .sec-4-1 .s9-ln { font-family: var(--mono); font-size: 13.5px; padding: 1px 8px; border-radius: 6px; color: var(--ink-2); border: 1px solid transparent; }
    .sec-4-1 .s9-ln.cur { border-color: var(--thread); background: var(--panel); color: var(--ink); font-weight: 700; }
    .sec-4-1 .s9-ln.did { color: var(--muted); }
    .sec-4-1 .s9-reg { font-size: 14px; }
    .sec-4-1 .s9-reg code { font-weight: 700; }
    .sec-4-1 .s9-trace { display: flex; flex-wrap: wrap; gap: 4px; min-height: 50px; align-content: flex-start; align-items: center; }
    .sec-4-1 .s9-th h4 .chip { text-transform: none; letter-spacing: 0; font-size: 12.5px; }
    .sec-4-1 .s9-trace .chip { font-size: 12.5px; padding: 1px 8px; }
    .sec-4-1 .s9-say { min-height: 88px; }
    @media (max-width: 760px) {
      .sec-4-1 .rpc-ctl { grid-template-columns: minmax(0, 1fr); }
      .sec-4-1 .tot { flex-wrap: wrap; }
      .sec-4-1 .cost td.n, .sec-4-1 .cost th.n { width: 54px; }
      .sec-4-1 .cost td.n.no, .sec-4-1 .cost th.n.w { width: 72px; }
      .sec-4-1 .bar { grid-template-columns: 104px minmax(0, 1fr) 62px; }
      .sec-4-1 .bins { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sec-4-1 .pick4 { grid-template-columns: 1fr; }
      .sec-4-1 .thtbl .wide { display: none; }
    }
  `,

  steps: [
    /* ---------------- 1. Big picture: a process is two ideas glued together ---------------- */
    {
      title: 'A process is really two ideas glued together',
      kind: 'story',
      html: `
        <div class="split l fill">
          <div class="stack">
            <p class="lead m0">So far a process has meant two things at once: a <b>bundle of resources</b> that the OS protects, and a <b>path of execution</b> that the processor runs.</p>
            <p class="m0">The first is <span class="t">resource ownership</span>: a <span class="t">virtual address space</span> holding the <span class="t">process image</span>, plus files and I/O devices. The second is <span class="t">scheduling and execution</span>: where in the code it is, its state, and its <span class="t">dispatching priority</span>. The two are independent, so an OS can split them. The <span class="t">unit of dispatching</span> becomes the <span class="t">thread</span> (or <span class="t">lightweight process</span>); the unit of resource ownership stays the process (or <span class="t">task</span>).</p>
            <div class="callout analogy m0" data-label="Analogy">A restaurant kitchen is the process: it owns the pantry, the stoves and the recipes. The cooks are the threads. Each works through a different recipe, yet all share one pantry and one set of stoves. Hiring a cook is far cheaper than building a kitchen.</div>
            <p class="small m0"><b>Why split them?</b> A program often has several jobs to do at once. Giving each job its own thread, instead of its own process, lets all the jobs share one set of resources cheaply.</p>
          </div>
          <div class="card white stack s1-host"></div>
        </div>`,
      render(el, ctx) {
        const { h, s } = ctx;
        const host = ctx.$('.s1-host');
        const INFO = {
          vas: '<b>Virtual address space.</b> The range of addresses the process may use. It holds the process image: program code, data, heap and stacks, plus the attributes the OS keeps in the process control block. The OS maps it to real memory and keeps other processes out.',
          files: '<b>Open files.</b> A file opened by the process belongs to the process as a whole. When the process ends, the OS closes it.',
          io: '<b>I/O devices and other resources.</b> A printer channel, a network connection, extra memory: the OS grants these to the process, and the process owns them until it gives them back or ends.',
          prot: '<b>Protection.</b> The OS guards everything the process owns, so other processes cannot read or damage it by accident or on purpose. Crossing that wall needs interprocess communication through the kernel.',
          path: '<b>Execution path.</b> A trace through the program’s instructions, jumping between functions and even into library code. This is the part the processor actually executes.',
          state: '<b>Execution state.</b> Running, Ready, Blocked and so on. A state describes something that <i>runs</i>, not the memory it owns.',
          prio: '<b>Dispatching priority.</b> The scheduler compares priorities to decide who gets the processor next.',
        };
        const THREADS = [['T1', 'Running', 8], ['T2', 'Ready', 5], ['T3', 'Blocked', 5]];
        const DEF = {
          classic: '<b>Classic view.</b> One process = one bundle of resources + one path of execution. The OS schedules the process and protects what it owns. Click any part, then press <b>Split into threads</b>.',
          split: '<b>Split view.</b> The resource half stays with the process. The execution half is now repeated once per thread: three paths, three states, three priorities, one shared set of resources. Click a thread.',
        };
        let mode = 'classic', sel = null;
        const NW = ctx.narrow;
        const svg = s('svg', { viewBox: NW ? '0 0 310 544' : '0 0 620 300', width: '100%', role: 'img', 'aria-label': 'A process split into resource ownership and execution' });
        const info = h('div', { class: 'info s1-info' });
        const wave = (x1, x2, y, amp) => { let d = `M${x1},${y}`; const n = 6, w = (x2 - x1) / n; for (let k = 0; k < n; k++) d += ` q${w / 2},${k % 2 ? amp : -amp} ${w},0`; return d; };
        function hot(id, x, y, w, hh, cls, label, extra) {
          const g = s('g', { class: 'hot' + (sel === id ? ' sel' : ''), tabindex: 0, role: 'button', 'aria-label': label, onclick: () => pick(id) },
            s('rect', { class: 'fr ' + cls, x, y, width: w, height: hh, rx: 8, 'stroke-width': 1.5 }),
            s('text', { x: x + 12, y: extra && hh > 50 ? y + 22 : y + hh / 2 + 5, 'font-size': 14, 'font-weight': 700 }, label), extra || null);
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } });
          return g;
        }
        function draw() {
          const kids = [
            s('text', { x: 10, y: 18, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, mode === 'classic' ? 'Process P (classic: one bundle)' : 'Process P (split: resources + threads)'),
            s('rect', { x: 6, y: 26, width: NW ? 298 : 608, height: NW ? 426 : 220, rx: 14, class: 's-proc', 'stroke-width': 2 }),
            s('rect', { x: 20, y: 40, width: 282, height: 194, rx: 10, class: 's-panel', 'stroke-width': 1 }),
            s('text', { x: 32, y: 60, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'RESOURCE OWNERSHIP'),
            hot('vas', 32, 70, 258, 34, 's-mem', 'Address space + process image'),
            hot('files', 32, 110, 258, 34, 's-io', 'Open files'),
            hot('io', 32, 150, 258, 34, 's-io', 'I/O devices, other resources'),
            hot('prot', 32, 190, 258, 34, 's-os', 'Protection from other processes'),
          ];
          const R = [s('rect', { x: 318, y: 40, width: 282, height: 194, rx: 10, class: 's-panel', 'stroke-width': 1 }),
            s('text', { x: 330, y: 60, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, 'SCHEDULING / EXECUTION')];
          if (mode === 'classic') {
            R.push(
              hot('path', 330, 70, 258, 62, 's-thread', 'One execution path', s('path', { d: wave(346, 572, 110, 7), class: 's-line', style: 'stroke:var(--thread)', 'marker-end': 'url(#arr-thread)' })),
              hot('state', 330, 140, 258, 34, 's-thread', 'State: Running'),
              hot('prio', 330, 180, 258, 34, 's-thread', 'Priority: 8'));
          } else {
            kids.push(NW ? s('line', { x1: 10, y1: 240, x2: 300, y2: 240, class: 's-line', 'stroke-dasharray': '5 5', 'stroke-width': 1.5 })
              : s('line', { x1: 310, y1: 30, x2: 310, y2: 242, class: 's-line', 'stroke-dasharray': '5 5', 'stroke-width': 1.5 }));
            THREADS.forEach(([n, st, p], i) => {
              const y = 70 + i * 54;
              R.push(hot('t' + i, 330, y, 258, 46, 's-thread', n, s('g', {},
                s('path', { d: wave(372, 470, y + 23, 6), class: 's-line', style: 'stroke:var(--thread)', 'marker-end': 'url(#arr-thread)' }),
                s('text', { x: 580, y: y + 28, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, st + ' \u00b7 prio ' + p))));
            });
          }
          kids.push(s('g', { transform: NW ? 'translate(-298,206)' : null }, ...R));
          const [ax, ay, bx, by] = NW ? [10, 476, 10, 516] : [20, 270, 318, 270];
          kids.push(
            s('text', { x: ax, y: ay, 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Unit of resource ownership'),
            s('text', { x: ax, y: ay + 20, 'font-size': 13.5 }, 'the process (also called a task)'),
            s('text', { x: bx, y: by, 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--thread)' }, 'Unit of dispatching'),
            s('text', { x: bx, y: by + 20, 'font-size': 13.5 }, mode === 'classic' ? 'the same process (one path only)' : 'each thread (a lightweight process)'));
          svg.replaceChildren(...kids);
          if (!sel) info.innerHTML = DEF[mode];
        }
        function pick(id) {
          sel = id;
          if (id[0] === 't' && id.length === 2) {
            const [n, st, p] = THREADS[+id[1]];
            info.innerHTML = `<b>Thread ${n}.</b> Its own path through the code, its own state (${st}) and its own priority (${p}). It owns nothing: it uses the process’s address space, files and devices, exactly like its sibling threads.`;
          } else info.innerHTML = INFO[id];
          draw();
        }
        const seg = ctx.ui.seg([{ value: 'classic', label: 'Classic process' }, { value: 'split', label: 'Split into threads' }], 'classic', (v) => { mode = v; sel = null; draw(); });
        host.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'One process, two jobs'), seg), svg, info,
          h('div', { class: 'road', style: { marginTop: 'auto' }, html: '<b>Coming up:</b> four process/thread models → who owns what → why threads are cheap → what they are used for → thread states → a network example → why sharing needs synchronization.' }));
        draw();
      },
    },
    /* ---------------- 2. The four process/thread models ---------------- */
    {
      title: 'Four ways to combine processes and threads',
      kind: 'explore',
      html: `
        <div class="split l fill">
          <div class="stack">
            <p class="lead m0"><span class="t">Multithreading</span> is the ability of an OS to support several concurrent paths of execution inside <b>one</b> process.</p>
            <p class="m0">Ask two questions about any OS. Can more than one process exist at a time? Can a process contain more than one thread? The answers give four models.</p>
            <div class="card tight small m0"><b>How to play:</b> click an example system in the tray, then click the model it belongs to. A wrong guess tells you why.</div>
            <div class="callout why m0" data-label="Why it matters">The boxes trace how systems grew up. Early personal computers ran one program with one path. Classic multiuser systems ran many processes, each single-threaded. A Java virtual machine is one process hosting many threads. Today’s general-purpose systems let every process have as many threads as it needs.</div>
            <div class="info s2-say">Pick an example system to start.</div>
          </div>
          <div class="stack s2-host"></div>
        </div>`,
      render(el, ctx) {
        const { h, s } = ctx;
        const host = ctx.$('.s2-host');
        const say = ctx.$('.s2-say');
        const MODELS = [
          { name: 'One process, one thread', procs: 1, th: 1 },
          { name: 'One process, many threads', procs: 1, th: 3 },
          { name: 'Many processes, one thread each', procs: 3, th: 1 },
          { name: 'Many processes, many threads each', procs: 3, th: 3 },
        ];
        const EX = [
          { id: 'dos', label: 'MS-DOS', cell: 0, why: 'MS-DOS runs a single user program at a time, and that program has a single path of execution.' },
          { id: 'java', label: 'Java runtime environment', cell: 1, why: 'A Java runtime environment is one process (the virtual machine) inside which the program can start many threads.' },
          { id: 'unix', label: 'Traditional UNIX', cell: 2, why: 'Traditional UNIX lets many users run many processes, but each process has exactly one thread.' },
          { id: 'win', label: 'Windows', cell: 3, why: 'Windows runs many processes, and each process may create as many threads as it needs.' },
          { id: 'sol', label: 'Solaris', cell: 3, why: 'Solaris supports many processes, each with many threads.' },
          { id: 'mod', label: 'Modern UNIX versions', cell: 3, why: 'Most modern UNIX-family systems support many processes, each with many threads.' },
        ];
        const WRONG = [
          'That model has room for only one program with one path. ',
          'That model allows threads, but only inside a single process. ',
          'That model allows many processes, but each one has only a single thread. ',
          'That model gives many processes many threads each. ',
        ];
        const placed = {}; let armed = null, tries = 0;
        const wave = (x1, x2, y, amp) => { let d = `M${x1},${y}`; const n = 4, w = (x2 - x1) / n; for (let k = 0; k < n; k++) d += ` q${w / 2},${k % 2 ? amp : -amp} ${w},0`; return d; };
        function mini(m) {
          const svg = s('svg', { viewBox: '0 0 300 112', width: '100%', 'aria-hidden': 'true', style: 'flex:1;min-height:0' });
          const pw = m.procs === 1 ? 170 : 86, gap = 10, total = m.procs * pw + (m.procs - 1) * gap, x0 = (300 - total) / 2;
          for (let p = 0; p < m.procs; p++) {
            const x = x0 + p * (pw + gap);
            svg.append(s('rect', { x, y: 4, width: pw, height: 104, rx: 10, class: 's-proc', 'stroke-width': 2 }));
            const ys = m.th === 1 ? [56] : [28, 56, 84];
            ys.forEach((y) => svg.append(s('path', { d: wave(x + 12, x + pw - 16, y, 5), class: 's-line', style: 'stroke:var(--thread)', 'marker-end': 'url(#arr-thread)' })));
          }
          return svg;
        }
        const cells = MODELS.map((m, i) => {
          const got = h('div', { class: 'm-got' });
          const b = h('button', { type: 'button', class: 'm-cell', onclick: () => drop(i) }, h('div', { class: 'm-name' }, m.name), mini(m), got);
          b.got = got; return b;
        });
        const tray = h('div', { class: 'm-tray' });
        const score = h('span', { class: 'chip accent' });
        function paintTray() {
          const left = EX.filter((e) => !placed[e.id]);
          tray.replaceChildren(...left.map((e) => h('button', { type: 'button', class: 'btn sm' + (armed === e.id ? ' on' : ''), onclick: () => arm(e.id) }, e.label)));
          if (!left.length) tray.append(h('span', { class: 'chip ok' }, '✓ All six placed'));
          score.textContent = `${Object.keys(placed).length} / ${EX.length} placed · ${tries} wrong`;
          cells.forEach((c) => c.classList.toggle('armed', !!armed));
        }
        function arm(id) { armed = armed === id ? null : id; const e = EX.find((x) => x.id === id); say.innerHTML = armed ? `Where does <b>${e.label}</b> belong? Click one of the four models.` : 'Pick an example system.'; paintTray(); }
        function drop(i) {
          cells.forEach((c) => c.classList.remove('bad'));
          if (!armed) { say.innerHTML = `<b>${MODELS[i].name}.</b> ${['Exactly one process exists, and it has one path of execution.', 'A single process whose work is split among several threads.', 'Many processes can exist, but every one of them has exactly one thread. This is the classic process from Chapter 3.', 'Many processes, and each may have many threads. The unit of dispatching is the thread.'][i]} Pick an example from the tray to place.`; return; }
          const e = EX.find((x) => x.id === armed);
          if (e.cell === i) {
            placed[e.id] = true; armed = null;
            cells[i].got.append(h('span', { class: 'chip ok fade-in' }, '✓ ' + e.label));
            say.innerHTML = `<b style="color:var(--ok)">Correct.</b> ${e.why}` + (Object.keys(placed).length === EX.length ? ' <b>All placed!</b> Notice the bottom-right box holds every mainstream desktop OS today.' : '');
          } else {
            tries++; cells[i].classList.add('bad');
            say.innerHTML = `<b style="color:var(--bad)">Not quite.</b> ${WRONG[i]}${e.label}? Think again: how many processes, and how many threads in each?`;
          }
          paintTray();
        }
        function reset() { Object.keys(placed).forEach((k) => delete placed[k]); armed = null; tries = 0; cells.forEach((c) => { c.got.replaceChildren(); c.classList.remove('bad'); }); say.innerHTML = 'Pick an example system to start.'; paintTray(); }
        const grid = h('div', { class: 'm-grid grow' }, ...cells);
        host.append(
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Example systems'), h('div', { class: 'row' }, score, h('button', { type: 'button', class: 'btn sm ghost', onclick: reset }, 'Reset'))),
          tray, grid);
        if (ctx.narrow) host.append(say); // keep feedback next to the game on phones
        paintTray();
      },
    },
    /* ---------------- 3. What the process keeps, what each thread gets ---------------- */
    {
      title: 'What the process keeps, what each thread gets',
      kind: 'explore',
      core: true,
      html: `
        <div class="split l fill">
          <div class="stack">
            <p class="lead m0">One copy for everyone, or one copy each?</p>
            <div class="card proc tight own m0"><h4>The process has (one copy)</h4><ul>
              <li>a <span class="t">virtual address space</span> holding the process image</li>
              <li>protected access to processors, other processes (<span class="t" data-t="Interprocess communication (IPC)">IPC</span>), files and I/O resources</li></ul></div>
            <div class="card thread tight own m0"><h4>Each thread has (its own copy)</h4><ul>
              <li>an execution state (Running, Ready, Blocked...)</li>
              <li>a saved <span class="t">thread context</span> when not running: in effect, its own <span class="t">program counter</span> inside the process</li>
              <li>an execution <span class="t">stack</span></li>
              <li>per-thread static storage for local variables (<span class="t">thread-local storage</span>, TLS)</li>
              <li>access to the process\u2019s memory and resources, <b>shared</b> with its siblings</li></ul></div>
            <div class="callout warn m0" data-label="Common mistake">“Its own stack” is not a protected stack. It sits in the shared address space, so a stray pointer in one thread can overwrite a sibling’s data.</div>
          </div>
          <div class="card white stack s3-host"></div>
        </div>`,
      render(el, ctx) {
        const { h, s } = ctx;
        const host = ctx.$('.s3-host');
        const ST = ['Running', 'Ready', 'Blocked', 'Ready'], PC = [14, 31, 22, 9], ERR = [0, 0, 2, 0];
        const SH = [
          ['code', 'Code', () => ['instructions'], 's-cpu', '<b>Code.</b> One copy of the program’s instructions. Every thread executes from it, each at its own place, because each has its own program counter.'],
          ['data', 'Global data', () => ['count = ' + st.count], 's-mem', '<b>Global data.</b> One copy, in the address space every thread shares, so any thread can read what another wrote, with no copying. But a write is only <b>reliably</b> seen by the others, and in the right order, when threads synchronize (a lock or an atomic operation; section 5.1 explains memory order).'],
          ['heap', 'Heap', () => ['list: 3 items'], 's-mem', '<b>Heap.</b> Memory allocated while the program runs belongs to the process. Any thread holding a pointer to a heap object can use it.'],
          ['files', 'Open files', () => st.files, 's-io', '<b>Open files.</b> Files belong to the process, so a file opened by one thread can be read or written by all of them.'],
        ];
        let st;
        const svg = s('svg', { viewBox: '0 0 640 250', width: '100%', role: 'img', 'aria-label': 'Shared process resources above, private thread state below' });
        const say = h('div', { class: 'info s3-say' });
        const nOut = h('b', { class: 'num' });
        function fresh(n) { st = { n: n || 3, count: 5, files: ['log.txt'], loc: [0, 0, 0, 0], sel: null, flash: null }; }
        function hot(id, g) { g.setAttribute('class', 'hot' + (st.sel === id ? ' sel' : '')); g.setAttribute('tabindex', 0); g.setAttribute('role', 'button'); g.addEventListener('click', () => pick(id)); return g; }
        const NW = ctx.narrow;
        const shPos = (i) => (NW ? [14 + (i % 2) * 150, 36 + Math.floor(i / 2) * 74] : [18 + i * 153, 36]), IW = NW ? 140 : 145;
        function draw() {
          const n = st.n, w = NW ? 140 : (608 - (n - 1) * 10) / n;
          const thPos = (k) => (NW ? [14 + (k % 2) * 150, 196 + Math.floor(k / 2) * 112] : [16 + k * (w + 10), 136]);
          const H = NW ? 196 + Math.ceil(n / 2) * 112 : 242;
          svg.setAttribute('viewBox', NW ? `0 0 318 ${H + 8}` : '0 0 640 250');
          const kids = [
            s('rect', { x: 4, y: 4, width: NW ? 310 : 632, height: H, rx: 14, class: 's-proc', 'stroke-width': 2 }),
            s('text', { x: NW ? 14 : 18, y: 26, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, NW ? 'Process P \u00b7 shared by all threads' : 'Process P \u00b7 shared by every thread (one copy each)'),
          ];
          SH.forEach(([id, t, val, cls], i) => {
            const [x, y0] = shPos(i), v = val();
            kids.push(hot(id, s('g', {},
              s('rect', { class: 'fr ' + cls + (st.flash === id ? ' sflash' : ''), x, y: y0, width: IW, height: 66, rx: 9, 'stroke-width': 1.5 }),
              s('text', { x: x + 10, y: y0 + 21, 'font-size': 14, 'font-weight': 800 }, t),
              ...v.map((line, j) => s('text', { x: x + 10, y: y0 + 41 + j * 17, 'font-size': 13, class: 's-monot' }, line)))));
          });
          const sx = st.sel && SH.findIndex((x) => x[0] === st.sel);
          for (let k = 0; k < n; k++) {
            const [x, y] = thPos(k), mine = st.sel === 'th' + k, other = st.sel && st.sel.startsWith('th') && !mine, shared = sx != null && sx >= 0;
            if (shared && !NW) kids.push(s('line', { x1: 18 + sx * 153 + 72, y1: 104, x2: x + w / 2, y2: 134, class: 's-line', style: 'stroke:var(--thread)', 'stroke-width': 1.8, 'marker-end': 'url(#arr-thread)' }));
            const g = s('g', { class: other ? 'dim' : '' },
              s('rect', { class: 'fr s-thread', x, y, width: w, height: 102, rx: 9, 'stroke-width': shared && NW ? 3 : 1.5 }),
              s('text', { x: x + 10, y: y + 19, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, 'T' + (k + 1)),
              s('text', { x: x + w - 8, y: y + 19, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, ST[k]),
              s('text', { x: x + 10, y: y + 38, 'font-size': 13, class: 's-monot' }, 'PC \u2192 line ' + PC[k]),
              s('text', { x: x + 10, y: y + 56, 'font-size': 13, class: 's-monot' + (st.flash === 'loc' + k ? ' sflash' : '') }, 'stack: i = ' + st.loc[k]),
              s('text', { x: x + 10, y: y + 74, 'font-size': 13, class: 's-monot' }, 'TLS: err = ' + ERR[k]),
              s('text', { x: x + 10, y: y + 92, 'font-size': 13, class: 's-monot' }, 'sees count = ' + st.count));
            kids.push(hot('th' + k, g));
          }
          svg.replaceChildren(...kids);
          nOut.textContent = n;
        }
        function pick(id) {
          st.sel = id; st.flash = null;
          if (id.startsWith('th')) { const k = +id.slice(2); say.innerHTML = `<b>T${k + 1}, private parts.</b> Its state (${ST[k]}), its saved context with its own program counter (line ${PC[k]}), its own stack (its local <code>i</code> = ${st.loc[k]}) and its thread-local storage (here a private error code, <code>err</code> = ${ERR[k]}: when a sibling records an error, it sets its own <code>err</code>, not this one). Everything in the teal area it shares with its ${st.n - 1} sibling${st.n > 2 ? 's' : ''}.`; }
          else say.innerHTML = SH.find((x) => x[0] === id)[4];
          draw();
        }
        const ACT = {
          write() { st.count = 7; st.sel = 'data'; st.flash = 'data'; say.innerHTML = '<b>T1 sets count = 7.</b> There is only one <code>count</code>, so the others read that same variable, not a copy: no message, no system call. Another thread is <b>guaranteed</b> to read 7 only with <span class="t">thread synchronization</span>, such as a lock (section 5.1 shows why).'; },
          open() { if (!st.files.includes('report.txt')) st.files.push('report.txt'); st.sel = 'files'; st.flash = 'files'; say.innerHTML = '<b>T2 opens report.txt.</b> The open file belongs to the process, not to T2. Every thread can now read or write it through the same handle, and it stays open even if T2 finishes.'; },
          local() { const k = st.n - 1; st.loc[k] = 42; st.sel = 'th' + k; st.flash = 'loc' + k; say.innerHTML = `<b>T${k + 1} sets its local i = 42.</b> Local variables live on each thread’s own stack, so only T${k + 1}’s <code>i</code> changed. The other threads each still have their own <code>i</code>.`; },
          race() {
            const a = st.count; st.count = a + 1; st.sel = 'data'; st.flash = 'data';
            say.innerHTML = `<b style="color:var(--bad)">Both T1 and T2 run count = count + 1.</b><div class="trace"><span class="chip thread">T1 reads ${a}</span><span class="chip thread">T2 reads ${a}</span><span class="chip thread">T1 writes ${a + 1}</span><span class="chip thread">T2 writes ${a + 1}</span></div>Two increments ran, but count only went from ${a} to ${a + 1}: one update was lost (a <span class="t">race condition</span>). Sharing needs <span class="t">thread synchronization</span>; later in this section you play the scheduler for exactly this race.`;
          },
        };
        const act = (k) => () => { ACT[k](); draw(); };
        const setN = (d) => { const n = Math.max(2, Math.min(4, st.n + d)); if (n === st.n) return; st.n = n; if (st.sel && st.sel.startsWith('th') && +st.sel.slice(2) >= n) st.sel = null; draw(); };
        host.append(
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Try it: who sees a change?'),
            h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Threads:'), h('button', { type: 'button', class: 'btn sm', 'aria-label': 'Remove a thread', onclick: () => setN(-1) }, '−'), nOut, h('button', { type: 'button', class: 'btn sm', 'aria-label': 'Add a thread', onclick: () => setN(1) }, '+'))),
          svg,
          h('div', { class: 'row', style: { gap: '6px' } },
            h('button', { type: 'button', class: 'btn sm thread', onclick: act('write') }, 'T1: count = 7'),
            h('button', { type: 'button', class: 'btn sm thread', onclick: act('open') }, 'T2: open a file'),
            h('button', { type: 'button', class: 'btn sm thread', onclick: act('local') }, 'Last thread: local i = 42'),
            h('button', { type: 'button', class: 'btn sm intr', onclick: act('race') }, 'T1 + T2: count++'),
            h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { fresh(st.n); say.innerHTML = DEF; draw(); } }, 'Reset')),
          say,
          h('p', { class: 'small muted m0', style: { marginTop: 'auto' }, html: '<b style="color:var(--proc)">Teal</b> = exists once for the whole process \u00b7 <b style="color:var(--thread)">pink</b> = exists once per thread.' }));
        const DEF = 'Click a shared box or a thread to see who can use it, or press an action button. Add or remove threads with + and −.';
        fresh(3); say.innerHTML = DEF; draw();
      },
    },
    /* ---------------- 4. Single-threaded vs multithreaded process models ---------------- */
    {
      title: 'The OS’s bookkeeping: one thread vs many',
      kind: 'compare',
      html: `
        <div class="split l fill">
          <div class="stack">
            <p class="lead m0">For every process the OS keeps a record and some memory. Adding threads changes what that bookkeeping looks like.</p>
            <p class="m0"><b>Single-threaded:</b> a <span class="t">process control block</span> (PCB) and a user address space, plus one <span class="t">user stack</span> and one <span class="t">kernel stack</span>. The PCB also stores the registers and state of the single path.</p>
            <p class="m0"><b>Multithreaded:</b> still one PCB and one user address space, but <b>each thread</b> gets its own <span class="t" data-t="Thread control block (TCB)">thread control block</span> (TCB), user stack and kernel stack.</p>
            <div class="callout why m0" data-label="Why a kernel stack per thread?">When a thread makes a system call, the kernel works on its behalf and needs a place for its own function calls. Two threads can both be inside the kernel at once (one waiting for the disk, one for the network), so each needs its own.</div>
            <div class="callout warn sm m0" data-label="Common mistake">A TCB is not a second PCB. It holds only per-thread facts (registers, priority, state); everything else stays in the one PCB.</div>
          </div>
          <div class="card white stack s4-host"></div>
        </div>`,
      render(el, ctx) {
        const { h, s } = ctx;
        const host = ctx.$('.s4-host');
        let mode = 'multi', status = 'ok', sel = null;
        const NW = ctx.narrow;
        const svg = s('svg', { viewBox: '0 0 640 262', width: '100%', role: 'img', 'aria-label': 'Process control structures' });
        const info = h('div', { class: 'info', style: { minHeight: '98px' } });
        const INFO = {
          pcb: () => mode === 'single'
            ? '<b>Process control block (PCB).</b> The OS’s record of the process: identity, owned resources, memory map, access rights. With only one path of execution, it also holds the saved registers and the execution state.'
            : '<b>Process control block (PCB).</b> Still one per process, but now it holds only process-wide facts: identity, resources, memory map and access rights. The per-path details have moved into the TCBs.',
          uas: () => '<b>User address space.</b> The program’s code, global data and heap: one copy, used by every thread of the process.',
          tcb: () => '<b>Thread control block (TCB).</b> One per thread: its register values (saved while it is not running), its priority, its state and other thread-related facts.',
          ustack: () => '<b>User stack.</b> Holds the function calls, parameters and local variables of ordinary program code. Each thread calls functions independently, so each needs its own.',
          kstack: () => '<b>Kernel stack.</b> Used while the kernel works on behalf of this path of execution, for example during a system call or an interrupt.',
        };
        const DEF = {
          single: 'One PCB, one address space, one pair of stacks. Click any box to see what it holds.',
          multi: 'Three threads: the PCB and address space appear once, the TCB and both stacks appear once <b>per thread</b>. Click any box.',
        };
        function blk(id, x, y, w, hh, cls, title, sub) {
          const g = s('g', { class: 'hot' + (sel === id ? ' sel' : ''), tabindex: 0, role: 'button', 'aria-label': title, onclick: () => { sel = id; info.innerHTML = INFO[id](); draw(); } },
            s('rect', { class: 'fr ' + cls, x, y, width: w, height: hh, rx: 8, 'stroke-width': 1.5 }),
            s('text', { x: x + w / 2, y: y + hh / 2 + (sub ? -3 : 5), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, title),
            sub ? s('text', { x: x + w / 2, y: y + hh / 2 + 15, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, sub) : null);
          return g;
        }
        function draw() {
          const kids = [];
          const gone = status === 'dead', susp = status === 'susp';
          svg.setAttribute('viewBox', !NW ? '0 0 640 262' : mode === 'single' ? '0 0 330 262' : '0 0 330 312');
          if (mode === 'single' && NW) {
            kids.push(s('rect', { x: 4, y: 6, width: 322, height: 246, rx: 14, class: 's-proc', 'stroke-width': 2 }),
              s('text', { x: 16, y: 28, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Single-threaded process'),
              blk('pcb', 14, 40, 150, 70, 's-os', 'Process control', 'block + registers'),
              blk('uas', 14, 122, 150, 118, susp ? 's-io' : 's-mem', 'User address', susp ? 'swapped out' : 'space'),
              blk('ustack', 172, 40, 144, 94, 's-panel', 'User stack', susp ? 'frozen' : 'the only one'),
              blk('kstack', 172, 146, 144, 94, 's-panel', 'Kernel stack', susp ? 'frozen' : 'the only one'));
          } else if (NW) {
            kids.push(s('rect', { x: 4, y: 6, width: 322, height: 300, rx: 14, class: 's-proc', 'stroke-width': 2 }),
              s('text', { x: 16, y: 26, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'The process'),
              blk('pcb', 14, 34, 148, 62, 's-os', 'Process control', 'block (one)'),
              blk('uas', 168, 34, 148, 62, susp ? 's-io' : 's-mem', 'User address', susp ? 'swapped out' : 'space (one)'));
            for (let k = 0; k < 3; k++) {
              const x = 14 + k * 102;
              kids.push(s('rect', { x, y: 106, width: 98, height: 192, rx: 10, class: 's-thread', 'stroke-width': 1.5, 'fill-opacity': 0.5 }),
                s('text', { x: x + 49, y: 124, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, 'T' + (k + 1) + (susp ? ' frozen' : '')),
                blk('tcb', x + 6, 132, 86, 50, 's-os', 'TCB'),
                blk('ustack', x + 6, 188, 86, 50, 's-panel', 'User', 'stack'),
                blk('kstack', x + 6, 244, 86, 50, 's-panel', 'Kernel', 'stack'));
            }
          } else if (mode === 'single') {
            kids.push(s('rect', { x: 120, y: 6, width: 400, height: 246, rx: 14, class: 's-proc', 'stroke-width': 2 }),
              s('text', { x: 136, y: 28, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'Single-threaded process'),
              blk('pcb', 136, 40, 180, 70, 's-os', 'Process control block', 'incl. registers + state'),
              blk('uas', 136, 122, 180, 118, susp ? 's-io' : 's-mem', 'User address space', susp ? 'swapped out to disk' : 'code, data, heap'),
              blk('ustack', 328, 40, 176, 94, 's-panel', 'User stack', susp ? 'frozen: cannot run' : 'the only one'),
              blk('kstack', 328, 146, 176, 94, 's-panel', 'Kernel stack', susp ? 'frozen: cannot run' : 'the only one'));
          } else {
            kids.push(s('rect', { x: 4, y: 6, width: 632, height: 246, rx: 14, class: 's-proc', 'stroke-width': 2 }),
              s('text', { x: 18, y: 28, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'The process'),
              blk('pcb', 16, 40, 150, 70, 's-os', 'Process control', 'block (one)'),
              blk('uas', 16, 122, 150, 118, susp ? 's-io' : 's-mem', 'User address', susp ? 'swapped out' : 'space (one)'));
            for (let k = 0; k < 3; k++) {
              const x = 180 + k * 152;
              kids.push(s('rect', { x, y: 14, width: 142, height: 232, rx: 11, class: 's-thread', 'stroke-width': 1.5, 'fill-opacity': 0.5 }),
                s('text', { x: x + 71, y: 32, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, 'Thread ' + (k + 1) + (susp ? ' · frozen' : '')),
                blk('tcb', x + 8, 42, 126, 60, 's-os', 'Thread control', 'block (TCB)'),
                blk('ustack', x + 8, 110, 126, 60, 's-panel', 'User stack'),
                blk('kstack', x + 8, 178, 126, 60, 's-panel', 'Kernel stack'));
            }
          }
          const g = s('g', { class: gone ? 'dim' : '' }, ...kids);
          const ox = NW ? 20 : 150, cx = NW ? 165 : 320;
          const over = gone ? [s('rect', { x: ox, y: 104, width: NW ? 290 : 340, height: 50, rx: 12, class: 's-bad', 'stroke-width': 2 }),
            s('text', { x: cx, y: 135, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: 'fill:var(--bad)' }, 'Terminated: everything freed')] : [];
          svg.replaceChildren(g, ...over);
          bS.textContent = susp ? 'Resume process' : 'Suspend process';
          bS.disabled = gone; bT.textContent = gone ? 'Recreate process' : 'Terminate process';
          if (!sel && status === 'ok') info.innerHTML = DEF[mode];
        }
        const bS = h('button', { type: 'button', class: 'btn sm io', onclick: () => {
          status = status === 'susp' ? 'ok' : 'susp'; sel = null;
          info.innerHTML = status === 'susp'
            ? (mode === 'multi' ? '<b>Suspended.</b> Suspension belongs to the process: its one address space is swapped out to disk to free main memory. Every thread needs that address space, so <b>all three</b> threads are frozen together, even one that was ready to run.' : '<b>Suspended.</b> The address space is swapped out to disk, so the single path cannot run until the process is brought back.')
            : '<b>Resumed.</b> The address space is back in memory, so the threads can be scheduled again.';
          draw(); } });
        const bT = h('button', { type: 'button', class: 'btn sm intr', onclick: () => {
          status = status === 'dead' ? 'ok' : 'dead'; sel = null;
          info.innerHTML = status === 'dead'
            ? (mode === 'multi' ? '<b>Terminated.</b> Ending a process ends <b>every</b> thread inside it, and the OS frees the address space, the PCB, every TCB and stack, and closes the open files.' : '<b>Terminated.</b> The OS frees the address space, the PCB and both stacks, and closes the process’s open files.')
            : DEF[mode];
          draw(); } });
        const seg = ctx.ui.seg([{ value: 'single', label: 'Single-threaded' }, { value: 'multi', label: 'Multithreaded' }], mode, (v) => { mode = v; sel = null; status = 'ok'; draw(); });
        host.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Process models'), seg),
          svg, h('div', { class: 'row', style: { gap: '8px' } }, bS, bT, h('span', { class: 'small muted' }, 'These act on the whole process: watch every thread.')), info);
        draw();
      },
    },
    /* ---------------- 5. Why threads are cheap ---------------- */
    {
      title: 'Why threads are cheap: four savings',
      kind: 'explore',
      html: `
        <div class="split l fill">
          <div class="stack">
            <p class="lead m0">The main reason to use threads is speed. Compared with separate processes, threads save time in four ways.</p>
            <ol class="ben">
              <li><b>Create:</b> a new thread takes far less time to set up than a new process.</li>
              <li><b>Terminate:</b> ending a thread takes less time than ending a process.</li>
              <li><b>Switch:</b> switching between two threads of the same process is quicker than switching between processes.</li>
              <li><b>Communicate:</b> threads share memory, so they can pass data without calling the kernel. Separate processes need the kernel’s protection and help (<span class="t" data-t="Interprocess communication (IPC)">IPC</span>).</li>
            </ol>
            <div class="callout why m0" data-label="Why it matters">A file server gets a stream of small requests. A new thread per request is cheap; a new process per request is not. The second tab measures the difference.</div>          </div>
          <div class="card white s5-host" style="min-height:0"></div>
        </div>`,
      render(el, ctx) {
        const { h } = ctx;
        const host = ctx.$('.s5-host');
        const OPS = {
          create: { label: 'Create', rows: [
            ['Allocate and fill a process control block', 2, 0, 'reuses the PCB'],
            ['Build a new address space (memory map)', 8, 0, 'already exists'],
            ['Load or copy the program image into it', 10, 0, 'already loaded'],
            ['Set up the open-file table and I/O access', 3, 0, 'shared'],
            ['Set up protection and IPC rights', 2, 0, 'shared'],
            ['Allocate a TCB and stacks, set registers, mark Ready', 3, 3, ''],
          ], say: 'Creating a process builds a whole new world (address space, image, files, protection) and then spawns its first thread. Creating a thread does only that last row.' },
          term: { label: 'Terminate', rows: [
            ['Free a TCB and its stacks', 2, 2, ''],
            ['Close open files, release I/O devices', 4, 0, 'siblings use them'],
            ['Tear down the address space, free its memory', 8, 0, 'siblings use it'],
            ['Free the PCB and notify the parent', 2, 0, 'process lives on'],
          ], say: 'Ending a thread only frees its own small pieces. Ending a process must also tear down everything it owns (and every one of its threads).' },
          sw: { label: 'Switch', rows: [
            ['Save the old thread’s registers', 1, 1, ''],
            ['Load the new thread’s registers', 1, 1, ''],
            ['Switch to the other process’s memory map', 3, 0, 'same map'],
            ['Refill caches that held the old process’s data', 5, 0, 'still useful'],
          ], say: 'Two threads of one process live in the same address space, so a switch only swaps register sets. A process switch also changes the memory map, and the cached data of the old process becomes useless.' },
          comm: { label: 'Communicate', rows: [
            ['Sender makes a system call (enter the kernel)', 2, 0, 'not needed'],
            ['Kernel copies the data into its own buffer', 3, 0, 'no copy'],
            ['Receiver makes a system call', 2, 0, 'not needed'],
            ['Kernel copies the data out to the receiver', 3, 0, 'no copy'],
            ['Store to / load from shared memory', 0, 1, ''],
          ], say: 'Processes are walled off from each other, so the kernel must get involved: with message passing (shown here) it carries every byte across. Threads just write and read the same memory, although they must still coordinate.' },
        };
        const table = h('table', { class: 'tbl compact cost' });
        const bars = h('div', { class: 'stack', style: { gap: '6px' } });
        const say = h('div', { class: 'info' });
        function showOp(k) {
          const o = OPS[k];
          const P = o.rows.reduce((a, r) => a + r[1], 0), T = o.rows.reduce((a, r) => a + r[2], 0);
          table.innerHTML = `<thead><tr><th>Work the OS must do <span class="xs" style="text-transform:none;letter-spacing:0">(illustrative units)</span></th><th class="n">Process</th><th class="n w">Thread</th></tr></thead><tbody>` +
            o.rows.map((r) => `<tr><td>${r[0]}</td>${r[1] ? `<td class="n pr">${r[1]}</td>` : '<td class="n no">—</td>'}${r[2] ? `<td class="n th">${r[2]}</td>` : `<td class="n no">${r[3] || '—'}</td>`}</tr>`).join('') + '</tbody>';
          bars.replaceChildren(
            h('div', { class: 'bar' }, h('span', { style: { color: 'var(--proc)' } }, 'Separate process'), h('div', { class: 'trk' }, h('i', { class: 'pb', style: { width: '100%' } })), h('span', { class: 'v' }, P + ' units')),
            h('div', { class: 'bar' }, h('span', { style: { color: 'var(--thread)' } }, 'Thread'), h('div', { class: 'trk' }, h('i', { class: 'tb', style: { width: (T / P * 100) + '%' } })), h('span', { class: 'v' }, T + (T === 1 ? ' unit' : ' units'))));
          say.innerHTML = `<b>${o.label}: about ${Math.round(P / T)}× less work for a thread.</b> ${o.say}`;
        }
        function costTab(p) {
          const seg = ctx.ui.seg(Object.entries(OPS).map(([value, o]) => ({ value, label: o.label })), 'create', showOp);
          p.append(h('div', { class: 'stack', style: { gap: '10px' } }, seg, table, bars, say,
            h('p', { class: 'small muted m0', html: '<b>The common thread:</b> every saving comes from reusing what the process already owns.' })));
          showOp('create');
        }
        function serverTab(p) {
          const PC = 500, TC = 50; // microseconds for create + terminate, illustrative
          const big1 = h('div', { class: 'big', style: { color: 'var(--proc)' } }), big2 = h('div', { class: 'big', style: { color: 'var(--thread)' } });
          const m1 = h('i', { class: 'pb' }), m2 = h('i', { class: 'tb' });
          const out = h('div', { class: 'info' });
          function upd(r) {
            const p1 = r * PC / 10000, p2 = r * TC / 10000; // percent of one processor
            big1.textContent = Math.min(100, p1).toFixed(0) + '%'; big2.textContent = p2.toFixed(0) + '%';
            m1.style.width = Math.min(100, p1) + '%'; m2.style.width = Math.min(100, p2) + '%';
            out.innerHTML = `${r} requests/s × ${PC} µs = <b>${ctx.util.fmt(r * PC / 1000, 1)} ms</b> of creating and ending processes per second, versus ${r} × ${TC} µs = <b>${ctx.util.fmt(r * TC / 1000, 1)} ms</b> with threads. ` +
              (p1 > 100 ? '<b style="color:var(--bad)">That is more than one second of overhead every second: the process version cannot keep up at all, and no real work gets done.</b>'
                : p1 === 100 ? '<b style="color:var(--bad)">That is the whole processor: the process version is saturated, with nothing left for real work.</b>'
                  : `That leaves ${(100 - p1).toFixed(0)}% versus ${(100 - p2).toFixed(0)}% of the processor for actual file serving.`);
          }
          const sl = ctx.ui.slider({ label: 'Requests per second', min: 100, max: 2400, step: 100, value: 800, onInput: upd });
          p.append(h('div', { class: 'stack' },
            h('p', { class: 'small m0', html: 'A server spawns a helper for each request and ends it when the reply is sent. Illustrative costs: <b>500 µs</b> to create and end a process, <b>50 µs</b> for a thread (measured systems often show a gap of ten times or more).' }),
            sl,
            h('div', { class: 'grid-2' },
              h('div', { class: 'card proc tight' }, h('h4', {}, 'Process per request'), big1, h('div', { class: 'bar', style: { gridTemplateColumns: '1fr' } }, h('div', { class: 'trk' }, m1)), h('div', { class: 'xs muted' }, 'of one processor lost to overhead')),
              h('div', { class: 'card thread tight' }, h('h4', {}, 'Thread per request'), big2, h('div', { class: 'bar', style: { gridTemplateColumns: '1fr' } }, h('div', { class: 'trk' }, m2)), h('div', { class: 'xs muted' }, 'of one processor lost to overhead'))),
            out,
            h('div', { class: 'callout tip sm m0', 'data-label': 'Going further', html: 'Busy real servers often skip even the thread cost: they create a <b>pool</b> of threads once at start-up and hand each new request to an idle one, so nothing is created or ended per request.' })));
          upd(800);
        }
        host.append(ctx.ui.tabs([{ label: 'Where the time goes', render: costTab }, { label: 'A busy file server', render: serverTab }]));
      },
    },
    /* ---------------- 6. Four uses of threads ---------------- */
    {
      title: 'What threads are used for: sort the scenarios',
      kind: 'lab',
      html: `
        <div class="split l fill">
          <div class="stack" style="gap:8px">
            <p class="m0">Even on a single-user computer, threads earn their keep in four ways:</p>
            <div class="card thread use m0"><b>1 · Foreground and background work</b><span>One thread serves the user while another does the heavy work. In a spreadsheet, one thread shows menus and reads input while another runs commands and updates the sheet, so the program feels faster.</span></div>
            <div class="card thread use m0"><b>2 · Asynchronous processing</b><span>Work that happens independently of the main flow, set off by a timer or an outside event. A word processor can give one thread the job of saving the buffer to disk every minute, in case the power fails.</span></div>
            <div class="card thread use m0"><b>3 · Speed of execution</b><span>One thread computes on a batch of data while another reads the next batch from a device. On a multiprocessor, several threads of one process can even run at the same instant.</span></div>
            <div class="card thread use m0"><b>4 · Modular program structure</b><span>A program with many separate activities, or many sources and destinations of I/O, is easier to design and build as one thread per activity.</span></div>
          </div>
          <div class="card white stack s6-host"></div>
        </div>`,
      render(el, ctx) {
        const { h } = ctx;
        const host = ctx.$('.s6-host');
        const CAT = ['Foreground / background', 'Asynchronous', 'Speed of execution', 'Modular structure'];
        const TEST = [
          'Foreground/background means one thread keeps serving the user while another does heavy work.',
          'Asynchronous processing means work set off by a timer or an outside event, independent of the program’s main flow.',
          'Speed of execution means overlapping computation with I/O, or running on several processors at once, so the job finishes sooner.',
          'Modular structure means organising a program with many different activities into simple, separate pieces.',
        ];
        const SC = [
          ['A photo editor keeps its menus and brushes responsive while a second thread applies a slow blur to the whole image.', 0, 'photo editor blur', 'The user-facing thread stays responsive while the heavy blur runs behind it.'],
          ['A video converter decodes chunk 7 of a film while a second thread is already reading chunk 8 from the disk.', 2, 'decode while reading', 'Computing and reading overlap, so the processor never sits idle waiting for the disk.'],
          ['A note-taking app writes a recovery copy of your document to disk every 60 seconds, whatever you are doing.', 1, 'recovery copy every 60 s', 'The save runs on its own timer. Without a thread, the main code would need to keep checking the clock.'],
          ['A robot controller is written as separate threads for the camera, the motors and the network link, each a short loop with one job.', 3, 'robot: camera/motors/net', 'Three independent activities with their own I/O become three simple threads instead of one tangled loop.'],
          ['On a four-core laptop, a rendering program splits one image into four strips and gives each strip to its own thread.', 2, 'four strips, four cores', 'On a multiprocessor, the four threads truly run at the same moment, so the image can finish up to about four times sooner (Section 4.3 shows why the gain is rarely a full 4×).'],
          ['In a tax-return program, one thread reads what you type into the form while another recalculates all the totals.', 0, 'tax form + totals', 'Typing stays smooth (foreground) while the recalculation runs behind it (background).'],
          ['A game is organised as separate threads for sound, controller input and networking, so each part can be written and tested on its own.', 3, 'game: sound/input/net', 'The point is program structure: each activity becomes its own easy-to-understand thread.'],
          ['A chat program has a thread that wakes every 30 seconds to tell the server “I am still online”.', 1, 'heartbeat every 30 s', 'A periodic job on its own schedule, unrelated to what the user is doing: asynchronous processing.'],
        ];
        let i = 0, wrong = 0, done = [], missed = false;
        const scn = h('div', { class: 'card thread scn' });
        const fb = h('div', { class: 'info', style: { minHeight: '66px' } });
        const score = h('span', { class: 'chip accent' });
        const bins = CAT.map((c) => h('div', { class: 'bin' }, h('h4', {}, c)));
        const btns = CAT.map((c, k) => h('button', { type: 'button', class: 'btn', onclick: () => answer(k) }, (k + 1) + ' · ' + c));
        const next = h('button', { type: 'button', class: 'btn sm primary', onclick: () => { i++; fb.innerHTML = i < SC.length ? 'Pick the <b>main</b> reason this program uses threads.' : fb.innerHTML; show(); } }, 'Next scenario →');
        function show() {
          score.textContent = `${done.length} / ${SC.length} sorted · ${wrong} wrong`;
          next.style.display = 'none';
          if (i >= SC.length) {
            scn.innerHTML = `<div><b>All eight sorted${wrong ? '' : ' with no mistakes'}!</b> The four uses often overlap in real programs, but each scenario has one main reason for its threads. Orange chips needed a second try.</div>`;
            btns.forEach((b) => (b.disabled = true));
            return;
          }
          missed = false;
          scn.innerHTML = `<div><span class="xs muted b">SCENARIO ${i + 1} OF ${SC.length}</span><br>${SC[i][0]}</div>`;
          btns.forEach((b) => { b.disabled = false; b.classList.remove('on'); });
        }
        function answer(k) {
          const s = SC[i];
          if (!s) return;
          if (k === s[1]) {
            done.push(i);
            bins[k].append(h('span', { class: 'chip ' + (missed ? 'warn' : 'ok') + ' fade-in' }, s[2]));
            fb.innerHTML = `<b style="color:var(--ok)">Yes: ${CAT[k]}.</b> ${s[3]}`;
            btns.forEach((b) => (b.disabled = true));
            score.textContent = `${done.length} / ${SC.length} sorted · ${wrong} wrong`;
            next.style.display = '';
            if (i === SC.length - 1) { next.textContent = 'Finish'; }
          } else {
            wrong++; missed = true; btns[k].disabled = true;
            fb.innerHTML = `<b style="color:var(--bad)">Not the main point here.</b> ${TEST[k]} Is that what this scenario is about? Try another.`;
            score.textContent = `${done.length} / ${SC.length} sorted · ${wrong} wrong`;
          }
        }
        function reset() { i = 0; wrong = 0; done = []; bins.forEach((b, k) => b.replaceChildren(h('h4', {}, CAT[k]))); next.textContent = 'Next scenario →'; fb.innerHTML = 'Read the scenario, then pick the <b>main</b> reason it uses threads.'; show(); }
        host.append(
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Which use is this?'), h('div', { class: 'row' }, score, h('button', { type: 'button', class: 'btn sm ghost', onclick: reset }, 'Restart'))),
          scn, h('div', { class: 'pick4' }, ...btns), h('div', { class: 'row', style: { gap: '10px', alignItems: 'flex-start', flexWrap: 'nowrap' } }, h('div', { class: 'grow' }, fb), next), h('div', { class: 'bins' }, ...bins));
        reset();
      },
    },
    /* ---------------- 7. Thread states and operations on one processor ---------------- */
    {
      title: 'Thread states, four operations, one processor',
      kind: 'explore',
      core: true,
      html: `
        <div class="split l fill">
          <div class="stack" style="gap:10px">
            <div class="card white tight s7-diag"></div>
            <ul class="ops">
              <li><b><span class="t">Spawn</span>:</b> a thread creates a sibling in its own process (start address + arguments) with its own context and stacks → Ready.</li>
              <li><b>Block:</b> it must wait for an event; its registers are saved → Blocked.</li>
              <li><b>Unblock:</b> the event has happened → Ready.</li>
              <li><b>Finish:</b> it ends; its register context and stacks are freed.</li>
            </ul>
            <div class="callout tip sm m0" data-label="No Suspended state for threads">Suspending swaps out the address space that all the threads share, so in this model it is a process-level state, not a thread-level one.</div>
            <div class="callout why sm m0" data-label="Open question">When one thread blocks, is its whole process blocked? That depends on how the threads are built. Section 4.2 answers it.</div>
          </div>
          <div class="card white stack s7-host" style="gap:10px"></div>
        </div>`,
      render(el, ctx) {
        const { h, s } = ctx;
        const host = ctx.$('.s7-host'), diag = ctx.$('.s7-diag');
        const T = (S, id) => S.th.find((t) => t.id === id);
        const init = () => ({ th: [{ id: 'A', p: 'P1', pr: 2, st: 'Running' }, { id: 'C', p: 'P2', pr: 1, st: 'Ready' }], q: ['C'], run: 'A', last: 'A', hist: [], arcs: [], say: '' });
        function dispatch(S) {
          if (!S.q.length) { S.run = null; return ' The ready list is empty, so the processor sits <b>idle</b>.'; }
          let b = 0; S.q.forEach((id, k) => { if (T(S, id).pr > T(S, S.q[b]).pr) b = k; });
          const id = S.q.splice(b, 1)[0], t = T(S, id), prev = S.last ? T(S, S.last) : null;
          t.st = 'Running'; S.run = id; S.last = id; S.arcs.push('dispatch');
          if (prev && prev.id === id) return ` ${id} is the only ready thread, so it runs again.`;
          return ` The dispatcher runs <b>${id}</b> (${t.p}): ` + (prev && prev.p === t.p ? 'a cheap <b>thread switch</b> inside one process.' : 'a <b>process switch</b>, so the memory map changes too.');
        }
        function apply(S, ev) {
          S.arcs = [];
          const cur = S.run ? T(S, S.run) : null;
          S.hist.push(cur ? { id: cur.id, p: cur.p } : { id: null });
          let m = '';
          if (ev.type === 'spawn') {
            S.th.push({ id: ev.id, p: ev.p, pr: 1, st: 'Ready' }); S.q.push(ev.id); S.arcs.push('spawn');
            m = `<b>Spawn:</b> the running thread ${cur.id} creates ${ev.id} in its own process ${ev.p}. ${ev.id} gets its own TCB, register context and stacks and joins the ready list; ${cur.id} keeps running.`;
          } else if (ev.type === 'block') {
            cur.st = 'Blocked'; S.run = null; S.arcs.push('block');
            m = `<b>Block:</b> ${cur.id} must wait for I/O, so it becomes Blocked and its registers are saved in its TCB.` + dispatch(S);
          } else if (ev.type === 'quantum') {
            cur.st = 'Ready'; S.q.push(cur.id); S.run = null; S.arcs.push('timeout');
            m = `<b>Quantum expired:</b> ${cur.id} goes to the back of the ready list.` + dispatch(S);
          } else if (ev.type === 'unblock') {
            const t = T(S, ev.id); t.st = 'Ready'; S.arcs.push('unblock');
            m = `<b>Unblock:</b> the event ${t.id} was waiting for has happened, so ${t.id} is Ready.`;
            if (!S.run) { S.q.push(t.id); m += dispatch(S); }
            else if (t.pr > cur.pr) { cur.st = 'Ready'; S.q.push(cur.id, t.id); S.run = null; S.arcs.push('timeout'); m += ` It outranks the running ${cur.id}, so ${cur.id} is <b>preempted</b>.` + dispatch(S); }
            else { S.q.push(t.id); m += ' It waits its turn on the ready list.'; }
          } else if (ev.type === 'finish') {
            cur.st = 'Done'; S.run = null; S.arcs.push('finish');
            m = `<b>Finish:</b> ${cur.id} is done; its register context and stacks are freed.` + dispatch(S);
          }
          S.say = m;
          return S;
        }
        const replay = (evs) => evs.reduce(apply, init());

        /* ---- state diagram ---- */
        const FS = ctx.narrow ? 18 : 14; // bigger labels on phones, where the diagram is drawn smaller
        const dsvg = s('svg', { viewBox: '0 0 460 196', width: '100%', class: ctx.narrow ? 'nw' : '', role: 'img', 'aria-label': 'Thread state diagram' });
        diag.append(dsvg);
        const ARCS = {
          spawn: ['M80,2 L80,34', 'Spawn', 90, 18, 'start'],
          dispatch: ['M140,50 C180,20 220,20 260,50', 'dispatch', 200, 22, 'middle'],
          timeout: ['M260,76 C220,104 180,104 140,76', 'quantum over / preempted', 200, 116, 'middle'],
          block: ['M322,88 C320,124 296,152 264,162', 'Block', 326, 140, 'start'],
          unblock: ['M140,162 C106,152 82,124 80,90', 'Unblock', 14, 136, 'start'],
          finish: ['M382,62 L436,62', 'Finish', 408, 52, 'middle'],
        };
        function drawDiag(S) {
          const kids = [];
          Object.entries(ARCS).forEach(([k, [d, lab, lx, ly, anc]]) => {
            const on = S.arcs.includes(k);
            kids.push(s('path', { d, class: 'arc' + (on ? ' on' : ''), 'marker-end': on ? 'url(#arr-thread)' : 'url(#arr-muted)' }),
              s('text', { x: lx, y: ly, 'text-anchor': anc, class: 'arcl' + (on ? ' on' : '') }, lab));
          });
          kids.push(s('circle', { cx: 446, cy: 62, r: 7, class: 's-panel', 'stroke-width': 2 }));
          [['Ready', 20, 36, 'Ready', 's-accent'], ['Running', 262, 36, 'Running', 's-ok'], ['Blocked', 142, 138, 'Blocked', 's-intr']].forEach(([st, x, y, lab, cls]) => {
            const ids = (st === 'Ready' ? S.q.slice() : S.th.filter((t) => t.st === st).map((t) => t.id)).join(', ') || '—';
            kids.push(s('rect', { x, y, width: 120, height: 52, rx: 14, class: cls, 'stroke-width': 2 }),
              s('text', { x: x + 60, y: y + 22, 'text-anchor': 'middle', 'font-size': FS, 'font-weight': 800 }, lab),
              s('text', { x: x + 60, y: y + 43, 'text-anchor': 'middle', 'font-size': FS, class: 's-monot', style: 'fill:var(--thread);font-weight:700' }, ids));
          });
          dsvg.replaceChildren(...kids);
        }

        /* ---- thread table + CPU strip ---- */
        const table = h('table', { class: 'tbl compact thtbl' });
        const NS = ctx.narrow ? 5 : 10;
        const strip = s('svg', { viewBox: `0 0 ${NS * 63 + 10} 68`, width: '100%', role: 'img', 'aria-label': 'Which thread held the processor after each event' });
        const CH = { Running: 'ok', Ready: 'accent', Blocked: 'intr', Done: '' };
        const CTX = { Running: 'in the CPU registers', Ready: 'saved in its TCB', Blocked: 'saved in its TCB', Done: 'freed' };
        let manual = false, mevs = [];
        function drawTable(S) {
          table.replaceChildren(h('thead', {}, h('tr', {}, ...['Thread', 'Process', 'Priority', 'State', 'Register context'].map((x, k) => h('th', { class: k === 2 || k === 4 ? 'wide' : '' }, x)))),
            h('tbody', {}, ...S.th.map((t) => h('tr', { class: t.st === 'Running' ? 'on' : '' },
              h('td', { class: 'b', style: { color: 'var(--thread)' } }, t.id), h('td', {}, t.p), h('td', { class: 'wide' }, t.pr > 1 ? 'high' : 'normal'),
              h('td', {}, h('span', { class: 'chip ' + CH[t.st] }, t.st), manual && t.st === 'Blocked' ? h('button', { type: 'button', class: 'btn sm', style: { marginLeft: '6px' }, onclick: () => act({ type: 'unblock', id: t.id }) }, 'Unblock') : null),
              h('td', { class: 'wide small' + (t.st === 'Done' ? ' muted' : '') }, CTX[t.st])))));
        }
        function drawStrip(S) {
          const slots = S.hist.concat([{ id: S.run, p: S.run ? T(S, S.run).p : null, now: true }]).slice(-NS);
          const kids = [];
          slots.forEach((sl, k) => {
            const x = 4 + k * 63;
            kids.push(s('rect', { x, y: 12, width: 60, height: 50, rx: 8, class: sl.id ? 's-thread' : 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': sl.now ? '5 3' : null }),
              s('text', { x: x + 30, y: 36, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, sl.id || 'idle'),
              s('text', { x: x + 30, y: 54, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, sl.now ? 'now' : sl.p || ''));
            const pv = slots.slice(0, k).reverse().find((q) => q.id);
            if (pv && sl.id && pv.id !== sl.id) {
              const same = pv.p === sl.p;
              kids.push(s('circle', { cx: x - 1.5, cy: 12, r: 9, class: same ? 's-ok' : 's-warn', 'stroke-width': 1.5 }),
                s('text', { x: x - 1.5, y: 16.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${same ? 'ok' : 'warn'})` }, same ? 'T' : 'P'));
            }
          });
          strip.replaceChildren(...kids);
        }
        function paint(S) { drawDiag(S); drawTable(S); drawStrip(S); }

        /* ---- guided tour ---- */
        const SCRIPT = [
          [null, '<b>Start.</b> One processor. Process P1 has thread A (high priority); process P2 has thread C. A is Running; C is Ready and waiting its turn.'],
          [{ type: 'spawn', id: 'B', p: 'P1' }, '<b>Spawn.</b> A creates a new thread B inside P1. The OS gives B its own TCB, register context and stacks and puts it on the ready list. A keeps running.'],
          [{ type: 'block' }, '<b>Block.</b> A asks to read from the disk and must wait, so it becomes Blocked with its registers saved. The <span class="t">dispatcher</span> picks C, which has waited longest. C is in P2, so this is a <b>process switch</b> (orange P).'],
          [{ type: 'quantum' }, '<b>Time quantum expires.</b> C has used its <span class="t">time quantum</span>, so it goes back to Ready and B runs: another process switch, back to P1.'],
          [{ type: 'unblock', id: 'A' }, '<b>Unblock + preemption.</b> The disk read is done, so A is Ready. A has higher priority than the running B, so B is preempted (<span class="t">preemption</span>) and A runs. A and B share P1: a cheap <b>thread switch</b> (green T).'],
          [{ type: 'finish' }, '<b>Finish.</b> A completes and its context and stacks are freed. C has waited longest, so C runs: a process switch to P2.'],
          [{ type: 'block' }, '<b>Block.</b> C sends a network request and waits for the reply. B runs, back in P1.'],
          [{ type: 'finish' }, '<b>Finish.</b> B completes. The only thread left, C, is Blocked, so the processor is <b>idle</b>.'],
          [{ type: 'unblock', id: 'C' }, '<b>Unblock.</b> The network reply arrives. C becomes Ready and, with the processor idle, is dispatched at once.'],
          [{ type: 'finish' }, '<b>Finish.</b> C completes and the processor goes idle. Now read the CPU strip: threads of two processes were <span class="t" data-t="Interleaving">interleaved</span> on one processor. Switches happened because a thread blocked, a quantum expired, a higher-priority thread became ready, or a thread finished.'],
        ];
        const cap = h('div', { class: 'player-cap s7-cap' });
        const player = ctx.ui.player({ count: SCRIPT.length, interval: 2600, caption: false, render(i) {
          const S = replay(SCRIPT.slice(1, i + 1).map((x) => x[0]));
          if (!manual) { paint(S); cap.innerHTML = SCRIPT[i][1]; }
          return null;
        } });

        /* ---- you drive ---- */
        const say = h('div', { class: 'player-cap s7-cap' });
        const bar = h('div', { class: 'row', style: { gap: '6px' } });
        function act(ev) {
          if (ev.type === 'spawn') { const S0 = replay(mevs), used = S0.th.map((t) => t.id); ev.id = 'BDEFG'.split('').find((n) => !used.includes(n)); ev.p = T(S0, S0.run).p; }
          mevs.push(ev); drive();
        }
        function drive() {
          const S = replay(mevs); paint(S);
          say.innerHTML = mevs.length ? S.say : 'You are the event source. The dispatcher follows two rules: <b>higher priority first</b>, then <b>longest-waiting first</b>. Only the running thread can spawn, and its new sibling lands in its own process. Try blocking A, then unblocking it.';
          const run = !!S.run, full = S.th.length >= 6;
          const B = (label, cls, ev, ok) => h('button', { type: 'button', class: 'btn sm ' + cls, disabled: !ok, onclick: () => act(Object.assign({}, ev)) }, label);
          bar.replaceChildren(B(run ? `${S.run} spawns a thread` : 'Spawn (needs a running thread)', 'thread', { type: 'spawn' }, run && !full),
            B('Block (I/O)', 'intr', { type: 'block' }, run), B('Quantum expires', '', { type: 'quantum' }, run), B('Finish', '', { type: 'finish' }, run),
            h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { mevs = []; drive(); } }, 'Reset'));
        }
        const guided = h('div', { class: 'stack', style: { gap: '8px' } }, cap, player.el,
          h('p', { class: 'small muted m0', html: '<b>Then try it yourself:</b> switch to <b>You drive</b>, block A, let the running thread spawn a sibling, then unblock A. Watch which switches are cheap (T) and which are costly (P).' }));
        const driving = h('div', { class: 'stack', style: { gap: '8px', display: 'none' } }, say, bar);
        const seg = ctx.ui.seg([{ value: 'tour', label: 'Guided tour' }, { value: 'drive', label: 'You drive' }], 'tour', (v) => {
          manual = v === 'drive'; guided.style.display = manual ? 'none' : ''; driving.style.display = manual ? '' : 'none';
          if (manual) drive(); else { player.stop(); player.refresh(); }
        });
        host.append(
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', html: 'One <span class="t">uniprocessor</span>, two processes' }), seg),
          table,
          h('div', {}, h('div', { class: 'xs muted b', html: 'WHO HELD THE PROCESSOR AFTER EACH EVENT · <span style="white-space:nowrap"><span style="color:var(--ok)">T</span> = thread switch in one process (cheap)</span> · <span style="white-space:nowrap"><span style="color:var(--warn)">P</span> = process switch (costly)</span>' }), strip),
          guided, driving);
        player.refresh();
      },
    },
    /* ---------------- 8. RPC: one thread vs two threads ---------------- */
    {
      title: 'Waiting on two servers: one thread or two?',
      kind: 'compare',
      render(el, ctx) {
        const { h, s } = ctx;
        let a = 5, b = 5, P;
        const lead = h('p', { class: 'm0', html: 'A <span class="t">remote procedure call</span> (RPC) runs a procedure on another computer; the caller is <b>blocked</b> until the reply arrives. Each send or reply-handling here takes 1 ms of processor time on a <span class="t">uniprocessor</span>. <b>Predict:</b> type the two-thread finish time in the box, then press Play.' });
        function build() {
          const S = [[0, 1, 'run', 'send A'], [1, 1 + a, 'wait', 'A'], [1 + a, 2 + a, 'run', 'handle A'], [2 + a, 3 + a, 'run', 'send B'], [3 + a, 3 + a + b, 'wait', 'B'], [3 + a + b, 4 + a + b, 'run', 'handle B']];
          const rA = 1 + a, rB = 2 + b;
          const M1 = [[0, 1, 'run', 'send A'], [1, rA, 'wait', 'A']], M2 = [[0, 1, 'ready', ''], [1, 2, 'run', 'send B'], [2, rB, 'wait', 'B']];
          let s1, s2;
          if (rA <= rB) { s1 = rA; s2 = Math.max(rB, s1 + 1); } else { s2 = rB; s1 = Math.max(rA, s2 + 1); }
          if (s1 > rA) M1.push([rA, s1, 'ready', '']);
          if (s2 > rB) M2.push([rB, s2, 'ready', '']);
          M1.push([s1, s1 + 1, 'run', 'handle A']); M2.push([s2, s2 + 1, 'run', 'handle B']);
          return { S, M1, M2, sT: 4 + a + b, mT: Math.max(s1, s2) + 1, e1: s1 + 1, e2: s2 + 1 };
        }
        const NW = ctx.narrow, W = NW ? 400 : 1110;
        const svg = s('svg', { viewBox: `0 0 ${W} 222`, width: '100%', role: 'img', 'aria-label': 'Timeline of one thread versus two threads making two remote calls' });
        const X0 = NW ? 34 : 120, XW = W - X0 - (NW ? 6 : 30);
        function row(y, segs, t, u, end, label) {
          const out = [s('text', { x: NW ? 2 : 8, y: y + 25, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--thread)' }, label),
            s('rect', { x: X0, y, width: XW, height: 40, rx: 6, class: 's-panel', 'stroke-width': 1, 'fill-opacity': 0.5 })];
          segs.forEach(([t0, t1, kind, lab]) => {
            if (t0 >= t) return;
            const x = X0 + t0 * u, w = (Math.min(t1, t) - t0) * u;
            const cls = kind === 'run' ? 's-thread' : kind === 'wait' ? 's-panel' : 's-warn';
            out.push(s('rect', { x: x + 1, y: y + 2, width: Math.max(0, w - 2), height: 36, rx: 5, class: cls, 'stroke-width': 1.5, 'stroke-dasharray': kind === 'wait' ? '5 3' : null }));
            const txt = kind === 'wait' ? 'blocked: waiting for ' + lab : kind === 'ready' ? 'ready' : lab;
            if (w > txt.length * 6.6 + 6) out.push(s('text', { x: x + w / 2, y: y + 25, 'text-anchor': 'middle', 'font-size': 13, class: kind === 'wait' ? 's-sub' : '' }, txt));
          });
          if (t >= end) out.push(s('text', { x: X0 + end * u + 8, y: y + 25, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--ok)' }, '✓ ' + end + ' ms'));
          return out;
        }
        function draw(t) {
          const u = XW / (P.sT + (NW ? 2.8 : 1.6));
          const kids = [
            s('text', { x: 2, y: 14, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, NW ? 'ONE THREAD' : 'ONE THREAD: CALLS ONE AFTER THE OTHER'),
            ...row(22, P.S, t, u, P.sT, 'T1'),
            s('text', { x: 2, y: 88, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.07em', class: 's-sub' }, NW ? 'TWO THREADS, ONE PROCESSOR' : 'TWO THREADS: ONE PER SERVER (SAME ONE PROCESSOR)'),
            ...row(96, P.M1, t, u, P.e1, 'T1'), ...row(142, P.M2, t, u, P.e2, 'T2'),
          ];
          for (let k = 0; k <= P.sT; k += NW ? (P.sT > 12 ? 4 : 2) : (P.sT > 14 ? 2 : 1)) kids.push(s('line', { x1: X0 + k * u, y1: 188, x2: X0 + k * u, y2: 194, class: 's-line', 'stroke-width': 1 }), s('text', { x: X0 + k * u, y: 212, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(k)));
          if (!NW) kids.push(s('text', { x: 8, y: 212, 'font-size': 12.5, class: 's-sub' }, 'time (ms)'));
          [[18, 66], [92, 186]].forEach(([y1, y2]) => kids.push(s('line', { x1: X0 + t * u, y1, x2: X0 + t * u, y2, style: 'stroke:var(--chc)', 'stroke-width': 2.5 })));
          svg.replaceChildren(...kids);
        }
        const where = (segs, t, end) => {
          if (t >= end) return '<b>done</b>';
          const g = segs.find((x) => t >= x[0] && t < x[1]);
          return g[2] === 'run' ? `<b>running</b> (${g[3]})` : g[2] === 'wait' ? `<b>blocked</b>, waiting for Server ${g[3]}` : '<b>ready</b>, waiting for the processor';
        };
        function caption(t) {
          if (t === 0) return '<b>t = 0.</b> One thread: T1 sends its request to Server A. Two threads: T1 sends to A while T2 is ready but waits, because one processor runs one thread at a time.';
          if (t >= P.sT) return `<b>Done.</b> One thread: <b>${P.sT} ms</b> (4 ms of processing + ${a} + ${b}: the waits come in series). Two threads: <b>${P.mT} ms</b>, because the waits overlap: ${ctx.util.fmt(P.sT / P.mT, 2)}× faster on one processor.` + (gVal() == null ? '' : gVal() === P.mT ? ' Your prediction was spot on.' : ` You said ${gVal()} ms. Trace: sends at 0–1 and 1–2, replies at ${1 + a} and ${2 + b} ms, each handled for 1 ms one at a time → done at ${P.mT} ms.`);
          const bothWait = P.M1.concat(P.M2).filter((g) => g[2] === 'wait' && t >= g[0] && t < g[1]).length === 2;
          return `<b>t = ${t} ms.</b> One thread: T1 ${where(P.S, t, P.sT)}. Two threads: T1 ${where(P.M1, t, P.e1)}; T2 ${where(P.M2, t, P.e2)}.` + (bothWait ? ' <b>Both waits overlap:</b> this is where the time is saved.' : '') + (t === P.mT ? ' <b>The two-thread version has finished.</b>' : '');
        }
        const c1 = h('span', { class: 'chip thread' });
        // the student types a prediction for the two-thread time; it is checked when that run finishes
        const guess = h('input', { type: 'number', min: 1, max: 30, step: 1, placeholder: '?', class: 's8-guess', 'aria-label': 'Your prediction for the two-thread finish time, in ms' });
        const gRes = h('span');
        const c2 = h('span', { class: 'chip thread' }, 'Two threads: ', guess, gRes);
        const gVal = () => { const g = parseInt(guess.value, 10); return Number.isFinite(g) ? g : null; };
        function totals(t) {
          const end = t >= P.sT, done2 = t >= P.mT, g = gVal();
          c1.textContent = 'One thread: ' + (end ? P.sT + ' ms' : '? ms');
          guess.style.display = done2 ? 'none' : '';
          gRes.textContent = !done2 ? ' ms' : P.mT + ' ms' + (g == null ? '' : g === P.mT ? ' ✓ your guess' : ` (you said ${g})`);
          c1.className = 'chip ' + (end ? 'warn' : 'thread'); c2.className = 'chip ' + (done2 ? (g == null || g === P.mT ? 'ok' : 'warn') : 'thread');
        }
        let player;
        function rebuild() { P = build(); if (player) { player.stop(); player.setCount(P.sT + 1); } }
        const sa = ctx.ui.slider({ label: 'Server A reply', min: 2, max: 8, value: a, format: (v) => v + ' ms', onInput: (v) => { a = v; rebuild(); } });
        const sb = ctx.ui.slider({ label: 'Server B reply', min: 2, max: 8, value: b, format: (v) => v + ' ms', onInput: (v) => { b = v; rebuild(); } });
        P = build();
        player = ctx.ui.player({ count: P.sT + 1, interval: 700, render(i) { draw(i); totals(i); return caption(i); } });
        player.caption.classList.add('s8-cap');
        guess.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); player.reset(); player.play(); } }); // Enter = lock in the guess and play
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } }, lead,
          h('div', { class: 'rpc-ctl' }, sa, sb, h('div', { class: 'tot' }, c1, c2)),
          h('div', { class: 'card white tight' }, svg, h('div', { class: 'row xs muted', style: { gap: '14px', marginTop: '2px' }, html: '<span><span class="chip thread">\u00a0</span> running on the processor</span><span><span class="chip" style="border:1.5px dashed var(--line-2)">\u00a0</span> blocked, waiting for a reply</span><span><span class="chip warn">\u00a0</span> ready, waiting for the processor</span>' })), player.el));
      },
    },
    /* ---------------- 9. Why threads must synchronize ---------------- */
    {
      title: 'Why threads must synchronize: you pick the order',
      kind: 'lab',
      html: `
        <div class="split l fill">
          <div class="stack">
            <p class="lead m0">Threads share global data with no wall between them. That makes sharing fast, and it also makes it dangerous.</p>
            <p class="m0">The line <code>count = count + 1</code> looks like one action, but the processor carries it out as three machine steps. The scheduler may switch threads between <b>any</b> two of them.</p>
            <div class="s9-code"></div>
            <div class="callout why sm m0" data-label="Why it matters">Each thread’s register <code>r</code> is part of its own saved context. A thread switched out between LOAD and STORE carries a stale private copy. Bigger shared structures suffer the same way: two threads adding to one list at once can lose an item or break its links.</div>
            <div class="callout warn sm m0" data-label="Common mistake">“It is one line of code, so it cannot be interrupted.” A single source line can be several machine steps, and a switch can fall between them.</div>
          </div>
          <div class="card white stack s9-host" style="gap:9px"></div>
        </div>`,
      render(el, ctx) {
        const { h } = ctx;
        const host = ctx.$('.s9-host');
        const code = ctx.ui.code(ctx.narrow // phones: too narrow for side comments, so shorten them
          ? 'r = count;   // LOAD\nr = r + 1;   // ADD (private)\ncount = r;   // STORE'
          : `r = count;     // LOAD: copy shared count into r
r = r + 1;     // ADD: change only the copy in r
count = r;     // STORE: write r back to count`, { lang: 'c', nums: true, fontSize: 14 });
        ctx.$('.s9-code').append(code);
        const OPS = ['LOAD', 'ADD', 'STORE'], LINES = ['r = count', 'r = r + 1', 'count = r'];
        let st, mode = 'free', tok = 0;
        const fresh = () => { st = { pc: [0, 0], r: [null, null], base: [null, null], count: 10, lock: null, blocked: [false, false], trace: [], last: null }; };
        const big = h('div', { class: 'big' }), lockChip = h('span', { class: 'chip' });
        const say = h('div', { class: 'info s9-say' }), trace = h('div', { class: 's9-trace' });
        const cards = [0, 1].map((t) => {
          const tag = h('span', { class: 'chip' }), lines = LINES.map((x) => h('div', { class: 's9-ln' }, x)), reg = h('div', { class: 's9-reg' });
          const btn = h('button', { type: 'button', class: 'btn sm thread', onclick: () => { tok++; step(t); paint(); } }, `Run T${t + 1}’s next step`);
          return { el: h('div', { class: 'card thread tight s9-th' }, h('h4', {}, 'Thread T' + (t + 1), tag), ...lines, reg, btn), tag, lines, reg, btn };
        });
        function step(t) {
          const o = 1 - t, T = `T${t + 1}`, O = `T${o + 1}`;
          if (st.pc[t] >= 3) return;
          if (mode === 'lock' && st.pc[t] === 0 && st.lock === o) {
            if (!st.blocked[t]) st.trace.push([`${T} waits`, 'warn']);
            st.blocked[t] = true;
            say.innerHTML = `<b>${T} tries to start, but ${O} holds the lock.</b> ${T} is Blocked until ${O} finishes its STORE and releases it. Run ${O}.`;
            return;
          }
          const pc = st.pc[t]; st.blocked[t] = false; st.last = pc + 1;
          if (pc === 0) {
            if (mode === 'lock') st.lock = t;
            st.r[t] = st.count; st.base[t] = st.count; st.trace.push([`${T} LOAD r=${st.count}`, 'thread']);
            say.innerHTML = (st.pc[o] === 1 || st.pc[o] === 2)
              ? `<b>${T} loads count (${st.count}) into its register.</b> But ${O} already holds a copy of that same value and has not stored its result yet. Both threads are now working from the same old number: trouble ahead.`
              : `<b>${T} loads the shared count (${st.count}) into its own register r.</b> The shared count itself does not change.` + (mode === 'lock' ? ` ${T} took the lock first, so ${O} cannot start until ${T} is finished.` : '');
          } else if (pc === 1) {
            st.r[t] += 1; st.trace.push([`${T} ADD r=${st.r[t]}`, 'thread']);
            say.innerHTML = `<b>${T} adds 1 inside its register: r = ${st.r[t]}.</b> The shared count is still ${st.count}; the new value exists only in ${T}’s private context.`;
          } else {
            const old = st.count, lost = old !== st.base[t];
            st.count = st.r[t]; st.trace.push([`${T} STORE count=${st.r[t]}`, lost ? 'bad' : 'ok']);
            if (mode === 'lock') { st.lock = null; st.blocked[o] = false; }
            say.innerHTML = lost
              ? `<b style="color:var(--bad)">${T} stores ${st.r[t]}.</b> Count already held ${old} from ${O}, but ${T}’s ${st.r[t]} was computed from the old ${st.base[t]}. ${O}’s increment has just been wiped out: a <span class="t">lost update</span>.`
              : `<b>${T} stores ${st.r[t]} back into count.</b>` + (mode === 'lock' ? ` It releases the lock, so ${O} is no longer blocked and may start.` : '');
          }
          st.pc[t]++;
          if (st.pc[0] === 3 && st.pc[1] === 3) {
            say.innerHTML = st.count === 12
              ? (mode === 'lock'
                ? '<b style="color:var(--ok)">count = 12, whatever order you pick.</b> The lock let only one thread at a time inside its LOAD-ADD-STORE sequence, so no interleaving can lose an update. Building such tools correctly is the subject of Chapter 5.'
                : '<b style="color:var(--ok)">count = 12: both increments counted.</b> This order was safe because one thread stored its result before the other loaded. Nothing in the code forces that order, though: it was luck.')
              : `<b style="color:var(--bad)">count = ${st.count}: a lost update.</b> Two increments ran, yet count rose by only 1. The result depended on the order the scheduler happened to choose: a <span class="t">race condition</span>. On one processor it happens when a quantum expires between LOAD and STORE; on several processors the threads can even collide at the same instant.`;
          }
        }
        function paint() {
          const fin = st.pc[0] === 3 && st.pc[1] === 3;
          big.textContent = st.count; big.style.color = !fin ? '' : st.count === 12 ? 'var(--ok)' : 'var(--bad)';
          lockChip.className = 'chip ' + (mode !== 'lock' ? '' : st.lock === null ? 'ok' : 'warn');
          lockChip.textContent = mode !== 'lock' ? 'no lock: anyone may start' : st.lock === null ? 'lock: free' : `lock: held by T${st.lock + 1}`;
          cards.forEach((c, t) => {
            const pc = st.pc[t];
            c.tag.className = 'chip ' + (pc === 3 ? 'ok' : st.blocked[t] ? 'warn' : pc ? 'thread' : '');
            c.tag.textContent = pc === 3 ? 'done' : st.blocked[t] ? 'Blocked' : pc ? 'mid-update' : 'not started';
            c.lines.forEach((ln, k) => { ln.classList.toggle('cur', k === pc); ln.classList.toggle('did', k < pc); ln.textContent = (k < pc ? '✓ ' : '') + LINES[k]; });
            c.reg.innerHTML = `register r = <code>${st.r[t] == null ? '—' : st.r[t]}</code> <span class="muted small">(private)</span>`;
            c.btn.disabled = pc === 3;
          });
          trace.replaceChildren(h('span', { class: 'xs muted b' }, 'ORDER RUN:'), ...(st.trace.length ? st.trace.map(([x, c]) => h('span', { class: 'chip ' + c }, x)) : [h('span', { class: 'xs muted' }, 'nothing yet')]));
          code.clear(); if (st.last) code.mark([st.last]);
        }
        async function auto(pattern) {
          const my = ++tok; fresh(); say.innerHTML = 'Watching the scheduler run one order…'; paint();
          let k = 0, guard = 0;
          while (!(st.pc[0] === 3 && st.pc[1] === 3) && guard++ < 14) {
            await ctx.sleep(560); if (!ctx.alive || my !== tok) return;
            let t = pattern[k++ % pattern.length]; if (st.pc[t] === 3 || st.blocked[t]) t = 1 - t; // a finished or Blocked thread is never dispatched
            step(t); paint();
          }
        }
        const START = 'You are the scheduler. Both threads will run <code>count = count + 1</code> once, starting from 10, so the right answer is 12. Click the threads in any order you like, or try a preset.';
        const reset = () => { tok++; fresh(); say.innerHTML = START; paint(); };
        const seg = ctx.ui.seg([{ value: 'free', label: 'No coordination' }, { value: 'lock', label: 'With a lock' }], mode, (v) => { mode = v; reset(); if (v === 'lock') say.innerHTML = 'Now a thread must take a <b>lock</b> before its LOAD and gives it back after its STORE. While one thread holds it, the other cannot start. Try the unlucky order again.'; });
        host.append(
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'You are the scheduler'), seg),
          h('div', { class: 'card mem tight s9-mem' }, h('div', {}, h('div', { class: 'b' }, 'count'), h('div', { class: 'xs muted' }, 'shared global data, one copy')), big, h('div', { class: 'grow' }), lockChip),
          h('div', { class: 'grid-2' }, cards[0].el, cards[1].el),
          trace, say,
          h('div', { class: 'row', style: { gap: '6px' } },
            h('button', { type: 'button', class: 'btn sm intr', onclick: () => auto([0, 1]) }, 'Unlucky order'),
            h('button', { type: 'button', class: 'btn sm', style: { borderColor: 'var(--ok)', color: 'var(--ok)' }, onclick: () => auto([0, 0, 0, 1, 1, 1]) }, 'Safe order'),
            h('button', { type: 'button', class: 'btn sm', onclick: () => auto(Array.from({ length: 8 }, () => (Math.random() < 0.5 ? 0 : 1))) }, 'Random order'),
            h('button', { type: 'button', class: 'btn sm ghost', onclick: reset }, 'Reset')));
        reset();
      },
    },
    /* ---------------- 10. Recap ---------------- */
    {
      title: 'Recap: the six things to remember',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        el.append(h('div', { class: 'stack fill' },
          h('div', { class: 'grid-2' },
            h('div', { class: 'card proc tight', html: '<h4 style="color:var(--proc)">Process (task) · unit of resource ownership</h4><div class="small">Owns the <b>virtual address space</b> with the process image, open files, I/O devices, and protected access to other processes (IPC). Suspending or terminating it affects <b>every</b> thread inside.</div>' }),
            h('div', { class: 'card thread tight', html: '<h4 style="color:var(--thread)">Thread (lightweight process) · unit of dispatching</h4><div class="small">Has its own <b>execution state</b>, saved context (its own program counter), user and kernel stacks, and thread-local storage. Shares everything its process owns.</div>' })),
          h('p', { class: 'small muted m0' }, 'Say each answer out loud before you flip the card.'),
          ctx.ui.flipcards([
            ['Two characteristics of a process?', 'Resource ownership (address space with the process image, files, devices) and scheduling/execution (path, state, priority). They are independent, so threads can split them.'],
            ['The four process/thread models?', '1 process, 1 thread (MS-DOS) · 1 process, many threads (Java runtime) · many processes, 1 thread each (traditional UNIX) · many, many (Windows, Solaris, modern UNIX).'],
            ['Four performance benefits of threads?', 'Quicker to create, quicker to terminate, quicker to switch between (same process), and they communicate through shared memory without calling the kernel.'],
            ['Four uses in a single-user system?', 'Foreground and background work · asynchronous processing · speed of execution · modular program structure.'],
            ['Thread states and operations?', 'States: Running, Ready, Blocked (no Suspended: that is process-level). Operations: Spawn, Block, Unblock, Finish.'],
            ['Why must threads synchronize?', 'They share one address space. count = count + 1 is really LOAD, ADD, STORE; a switch between those steps can lose an update (a race condition). Coordination such as a lock prevents it (Chapter 5).'],
          ], { cols: 3, height: 172 })));
      },
    },
    /* ---------------- 10. Check yourself ---------------- */
    {
      title: 'Check yourself',
      kind: 'check',
      quiz: [
        { q: 'In an operating system that supports threads, what is the <b>unit of dispatching</b>, the thing the scheduler picks to run?',
          choices: ['The process', 'The thread', 'The process control block', 'The virtual address space'], answer: 1,
          feedback: ['In a multithreaded OS the process is the unit of resource ownership, not the unit that gets dispatched.', null, 'The PCB is a record the OS keeps about a process; it is data, not something that runs.', 'The address space is memory the process owns; it cannot be scheduled.'],
          why: 'Threads separate the two characteristics of a process: the thread (lightweight process) is dispatched, while the process (task) owns the resources.' },
        { q: 'Which is the standard example of the model with <b>a single process that contains multiple threads</b> (rather than many processes)?',
          choices: ['MS-DOS', 'A Java runtime environment', 'Traditional UNIX', 'Windows'], answer: 1,
          feedback: ['MS-DOS supports a single user process with a single thread.', null, 'Traditional UNIX supports many processes, but each has only one thread.', 'Windows runs many processes at once, each with many threads: that is the many-processes, many-threads model.'],
          why: 'A Java runtime environment is a single process (the virtual machine) in which the program can run many threads.' },
        { type: 'bucket', q: 'In a multithreaded process, does the OS keep one of these <b>per process</b> or <b>per thread</b>?',
          buckets: ['One per process', 'One per thread'],
          items: [['Virtual address space holding the process image', 0], ['Open files', 0], ['Process control block', 0], ['Thread control block', 1], ['Execution state (Running, Ready, Blocked)', 1], ['Saved register context', 1], ['User stack and kernel stack', 1]],
          why: 'Resources (address space, files, the PCB) exist once for the whole process. Everything that describes a path of execution (TCB, state, registers, stacks) exists once per thread.' },
        { type: 'multi', q: 'Which of these are performance benefits of threads compared with separate processes?',
          choices: ['A thread takes less time to create than a process', 'A thread takes less time to terminate than a process', 'Switching between two threads of the same process is quicker than switching between processes', 'The OS protects threads of one process from each other', 'Threads of one process can exchange data without involving the kernel'],
          answer: [0, 1, 2, 4],
          why: 'The four classic benefits are faster create, faster terminate, faster switch, and kernel-free communication through shared memory. Threads of one process are <b>not</b> protected from each other; they share one address space.' },
        { type: 'match', q: 'Match each situation to the use of threads it illustrates.',
          pairs: [['A word processor saves a backup copy of its buffer every minute', 'Asynchronous processing'], ['A spreadsheet keeps reading input while another thread recalculates the sheet', 'Foreground and background work'], ['One thread computes on a batch of data while another reads the next batch', 'Speed of execution'], ['A program with many I/O sources is written as one thread per source', 'Modular program structure']],
          why: 'Timed or periodic jobs are asynchronous; keeping the user side responsive is foreground/background; overlapping computing with I/O is speed; organising many activities is modularity.' },
        { type: 'tf', q: 'In the general thread model, one thread of a process can be swapped out to disk (the Suspended state) while its sibling threads keep running.', answer: false,
          why: 'Suspension swaps the address space out of main memory, and every thread shares that address space. It is therefore a process-level state: suspending a process suspends all of its threads. (Windows can also "suspend" one thread, as section 4.4 shows, but that only stops it being scheduled; nothing is swapped out.)' },
        { type: 'tf', q: 'Terminating a process terminates every thread in that process.', answer: true,
          why: 'Threads live inside the process and use its resources. When the process ends, its address space and resources are released, so all of its threads end too.' },
        { type: 'order', q: 'Put the life of a thread that makes one remote procedure call in order.',
          items: ['Spawn: the thread is created and placed on the ready list', 'It is dispatched and runs, sending its request', 'Block: it waits for the reply', 'Unblock: the reply arrives and the thread becomes Ready', 'It runs again and handles the reply', 'Finish: its register context and stacks are freed'],
          why: 'Spawn puts a new thread in Ready; running leads to Block while it waits; Unblock returns it to Ready; after running again it Finishes and its resources are freed.' },
        { type: 'num', q: 'One thread makes two remote procedure calls, one after the other, to two different servers. Sending a request takes 1 ms of processor time, handling a reply takes 1 ms, and each server’s reply arrives 6 ms after the request was sent. How many ms does the whole job take?',
          answer: 16, tol: 0, unit: 'ms',
          why: 'Four pieces of processing (send A, handle A, send B, handle B) take 4 ms, and the two 6 ms waits happen one after the other: 4 + 6 + 6 = 16 ms.' },
        { type: 'num', q: 'Now two threads share one processor, one thread per server. T1 sends its request from 0 to 1 ms; T2 sends its request from 1 to 2 ms. Each reply arrives 6 ms after its send finishes, and handling a reply takes 1 ms of processor time. At what time (ms) is all the work finished?',
          answer: 9, tol: 0, unit: 'ms',
          why: 'Reply A arrives at 1 + 6 = 7 ms and is handled from 7 to 8. Reply B arrives at 2 + 6 = 8 ms and is handled from 8 to 9. The waits overlap, so the job ends at 9 ms instead of 16.' },
        { type: 'num', q: 'A file server creates a helper for every request and ends it afterwards. Creating plus ending a <b>process</b> costs 500 µs. At 1,200 requests per second, what percentage of one processor is spent on that overhead?',
          answer: 60, tol: 0.5, unit: '%',
          why: '1,200 × 500 µs = 600,000 µs = 0.6 s of every second, which is 60%. With threads at 50 µs each it would be only 6%.' },
        { type: 'multi', q: 'Two threads of one process both run <code>count = count + 1</code> on a shared variable that starts at 10, with no synchronization. Which final values are possible?',
          choices: ['10', '11', '12', '13'], answer: [1, 2],
          why: 'If the increments do not overlap, count ends at 12. If both threads read 10 before either writes, both write 11 and one update is lost. It can never stay 10 or reach 13. Preventing the lost update is the job of thread synchronization.' },
      ],
    },
  ],

  notes: `
<h3>1. Two characteristics of a process</h3>
<ul>
<li><b>Resource ownership.</b> A virtual address space holding the process image (code, data, stacks and the attributes kept in the PCB), plus control of resources such as main memory, files and I/O devices. The OS protects these from other processes.</li>
<li><b>Scheduling and execution.</b> An execution path (trace) through one or more programs, with an execution state (Running, Ready, Blocked...) and a dispatching priority. This is the part the OS schedules and dispatches.</li>
</ul>
<p>The two are independent, so an OS can separate them. The unit of dispatching is the <b>thread</b> (or <b>lightweight process</b>); the unit of resource ownership is the <b>process</b> (or <b>task</b>). <b>Multithreading</b> is the ability of an OS to support several concurrent paths of execution within one process.</p>

<h3>2. Four process/thread models</h3>
<table>
<tr><th>Model</th><th>Example</th></tr>
<tr><td>One process, one thread</td><td>MS-DOS</td></tr>
<tr><td>One process, many threads</td><td>A Java runtime environment (one virtual machine process)</td></tr>
<tr><td>Many processes, one thread each</td><td>Traditional UNIX</td></tr>
<tr><td>Many processes, many threads each</td><td>Windows, Solaris, modern UNIX versions</td></tr>
</table>

<h3>3. What the process has, what each thread has</h3>
<p><b>The process:</b> a virtual address space holding the process image, and protected access to processors, other processes (IPC), files and I/O resources.</p>
<p><b>Each thread:</b> an execution state; a saved thread context when not running (in effect, its own program counter); an execution stack; per-thread static storage for local variables (thread-local storage); and access to the memory and resources of its process, shared with its siblings.</p>
<p>Threads share one address space, so each can see the data the others write, and a file opened by one thread can be used by all. Seeing another thread's update <b>reliably and in the right order</b> is not automatic: it takes synchronization (a lock or an atomic operation), because processors and compilers may delay or reorder memory writes (section 5.1 covers memory order). A thread's stack is its own but lives in the shared address space: the OS does not protect threads of one process from each other.</p>

<h3>4. Single-threaded vs multithreaded process models</h3>
<table>
<tr><th>Structure</th><th>Single-threaded</th><th>Multithreaded</th></tr>
<tr><td>Process control block (PCB)</td><td>1, also holds the registers and state</td><td>1, process-wide facts only</td></tr>
<tr><td>User address space</td><td>1</td><td>1, shared by all threads</td></tr>
<tr><td>Thread control block (TCB): registers, priority, state</td><td>none</td><td>1 per thread</td></tr>
<tr><td>User stack and kernel stack</td><td>1 each</td><td>1 each per thread</td></tr>
</table>
<p>Each thread needs its own kernel stack because the kernel may be working for several threads at once. <b>Process-wide actions affect every thread:</b> suspending a process swaps its one address space out of main memory, so all its threads are suspended together; terminating a process terminates all of its threads.</p>

<h3>5. Four performance benefits of threads</h3>
<ol>
<li><b>Create:</b> far quicker than creating a process (no new address space, image, file table or protection).</li>
<li><b>Terminate:</b> quicker than ending a process (the address space and files remain).</li>
<li><b>Switch:</b> switching between threads of one process is quicker than a process switch (the memory map and cached data stay).</li>
<li><b>Communicate:</b> threads share memory, so they exchange data without invoking the kernel; separate processes need kernel-mediated IPC.</li>
</ol>
<p><b>Worked example</b> (illustrative costs): a file server creates and ends a helper for every request, 500 µs for a process or 50 µs for a thread. Overhead = requests per second × cost. At 800 requests/s: 800 × 500 µs = 0.4 s of every second, 40% of one processor, versus 4% with threads. At 1,200/s: 60% versus 6%. At 2,000/s the process version uses 100%. Busy servers often go further and reuse a pool of threads.</p>

<h3>6. Uses of threads in a single-user system</h3>
<ul>
<li><b>Foreground and background work:</b> one spreadsheet thread shows menus and reads input while another runs commands and updates the sheet.</li>
<li><b>Asynchronous processing:</b> work set off by a timer or outside event, e.g. saving a word processor's buffer to disk once a minute.</li>
<li><b>Speed of execution:</b> compute one batch while another thread reads the next; on a multiprocessor, threads of one process run at the same time.</li>
<li><b>Modular program structure:</b> programs with many activities or many I/O sources and destinations are easier to design as threads.</li>
</ul>

<h3>7. Thread states and operations</h3>
<p>States: <b>Running</b>, <b>Ready</b>, <b>Blocked</b>. There is no thread-level Suspended state: suspension swaps out the shared address space, a process-level act.</p>
<ul>
<li><b>Spawn:</b> creating a process spawns its first thread; a thread may spawn another in the same process, supplying a start address and arguments. The new thread gets its own register context and stacks and joins the ready list.</li>
<li><b>Block:</b> the thread waits for an event; its registers, program counter and stack pointer are saved and the processor runs another ready thread.</li>
<li><b>Unblock:</b> the event occurs and the thread returns to the ready list.</li>
<li><b>Finish:</b> its register context and stacks are deallocated.</li>
</ul>
<p>Whether one blocked thread blocks its whole process depends on how threads are implemented (Section 4.2). On a <b>uniprocessor</b> only one thread runs at a time, so threads of several processes are interleaved. The processor passes on when the running thread blocks, finishes, uses up its time quantum, or is preempted by a higher-priority thread. A switch between threads of one process keeps the memory map; a switch to another process changes it.</p>

<h3>8. Example: remote procedure calls</h3>
<p>An RPC runs a procedure on another computer; the caller is blocked until the reply arrives. Suppose sending a request and handling a reply each take 1 ms of processor time, and the replies arrive a and b ms after their sends.</p>
<ul>
<li><b>One thread:</b> the waits happen one after the other: total = 4 + a + b (a = b = 5 gives 14 ms; a = b = 6 gives 16 ms).</li>
<li><b>One thread per server, one processor:</b> T1 sends at 0–1, T2 at 1–2, and then both wait together. Replies arrive at 1 + a and 2 + b and are handled one at a time. With a = b = 5 they are handled at 6–7 and 7–8, so the job ends at 8 ms (1.75× faster); with a = b = 6 it ends at 9 ms.</li>
</ul>
<p>The gain comes from overlapping the waits, not from running at the same instant.</p>

<h3>9. Why threads must synchronize</h3>
<p>Threads of a process share its address space and resources, so their activities must be coordinated or they can interfere and corrupt shared data. <code>count = count + 1</code> is three machine steps: LOAD (copy count into a private register), ADD, STORE (write it back). If T1 and T2 both LOAD 10 before either STOREs, both store 11 and one increment is lost: a <b>lost update</b>, a kind of race condition. If one thread stores before the other loads, count ends at 12. It can never end at 10 or 13. A lock that lets only one thread at a time run the three steps always gives 12; Chapter 5 builds such tools.</p>`,
});
