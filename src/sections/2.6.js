/* Section 2.6 — OS Design Considerations for Multiprocessor and Multicore
   Original teaching material, built step by step.
   Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {
  /* ------------------------------------------------------------------ shared helpers */
  // a clickable SVG group that works with mouse, keyboard and scripted checks
  function hotGroup(ctx, onAct, label, ...kids) {
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);
    g.addEventListener('click', onAct);
    // SVG elements have no .click(); automated checks send synthetic pointer events, so accept those too
    g.addEventListener('pointerdown', (e) => { if (!e.isTrusted) onAct(); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });
    return g;
  }
  // multi-line SVG text: lines is a string or an array of strings (one tspan per line)
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {
    const t = s('text', Object.assign({ x, y }, attrs));
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));
    return t;
  }

  Guide.section({
    id: '2.6',
    title: 'OS Design Considerations for Multiprocessor and Multicore',
    short: 'Multiprocessor OS design',
    summary: 'What changes when one OS runs many processors or cores: SMP kernel design issues and multicore parallelism.',
    objectives: [
      'Explain what it means for an SMP kernel to run on any processor, with each processor scheduling itself from a shared pool, and why that risks two processors picking the same process or a process being lost.',
      'Name and explain the five key design issues of an SMP operating system: simultaneous concurrent processes or threads, scheduling, synchronization, memory management, and reliability and fault tolerance.',
      'Show how locks and reentrant kernel code prevent races, and how an SMP OS degrades gracefully when a processor fails.',
      'Describe the three levels of parallelism in a multicore system and who exploits each one, including how developers, languages and the OS (for example Grand Central Dispatch) share the work of parallelism within applications.',
      'Explain the virtual machine approach to multicore: dedicating cores to a process, the OS acting like a hypervisor, and why this cuts context-switch overhead.',
    ],
    terms: [
      ['Symmetric multiprocessor (SMP)', 'A computer with two or more similar processors that share main memory and I/O devices and are run by one operating system; any processor can do any job, including running the kernel.'],
      ['Self-scheduling', 'The usual SMP arrangement with no boss processor: whenever a processor needs work, it runs the kernel’s scheduler itself and takes its next process or thread from a shared pool.'],
      ['Ready queue', 'The OS list of processes or threads that are ready to run and are waiting only for a processor (the short-term queue of section 2.3). In a simple SMP design every processor takes work from one shared ready queue.'],
      ['Race condition', 'A bug in which the result depends on the exact timing of two or more processors or threads using shared data at the same time. Some orders work, others corrupt the data.'],
      ['Lock', 'A shared marker that at most one processor or thread can hold at a time. Code takes the lock before touching a shared structure and releases it afterwards, so two updates can never overlap.'],
      ['Spinlock', 'A lock where a processor that finds it taken keeps re-checking in a tight loop (it spins) until the holder releases it. The check-and-take is one atomic (indivisible) hardware instruction, such as test-and-set, so two processors can never both grab it. SMP kernels use spinlocks to guard short stretches of code.'],
      ['Reentrant code', 'Code that several processors or threads can be executing at the same moment without interfering, because it never modifies itself and keeps each caller’s working data separate, for example on that caller’s own stack.'],
      ['Kernel-level thread', 'A thread that the kernel itself knows about and schedules. Because the kernel sees each one, it can run several threads of the same process on different processors at the same moment.'],
      ['Synchronization', 'Coordinating processes or threads that run at the same time so they use shared memory and devices in a safe order: one at a time where needed, and in the right sequence when one depends on another.'],
      ['Page', 'A fixed-size block (commonly 4 KB) of a process’s memory. The OS can place each page in any free slot of main memory, or move it out to disk when memory runs short.'],
      ['Shared page', 'A page that belongs to the address spaces of two or more processes at once, so they all see the same data, for example shared library code or a shared buffer.'],
      ['Page replacement', 'The OS decision about which page to move out of main memory to disk when room is needed for another page.'],
      ['Graceful degradation', 'Losing capacity in proportion to what failed instead of crashing: when one of four processors dies, the system carries on at about three quarters of its former speed.'],
      ['Instruction-level parallelism (ILP)', 'Overlap among the instructions of one instruction stream inside a single core, for example a pipeline working on several instructions at different stages at once. The hardware finds and exploits it.'],
      ['Grand Central Dispatch (GCD)', 'Apple’s mechanism on macOS and iOS for parallelism within applications: a program packages work as small tasks placed on dispatch queues, and the system runs them on a pool of threads sized to the available cores.'],
      ['Thread pool', 'A set of worker threads created in advance that repeatedly take tasks from a queue and run them, so a program does not have to create a new thread for every piece of work.'],
      ['Context switch', 'Saving the registers and state of whatever is running on a processor and loading those of another process or thread. It costs time directly, and afterwards the newcomer runs slowly until the caches refill with its data.'],
      ['Time slicing', 'Sharing one processor among several processes or threads by letting each run for a short interval in turn, with a timer interrupt forcing each switch.'],
      ['Hypervisor', 'Software that creates and runs virtual machines. It hands each machine a share of the real hardware, such as processor cores and blocks of memory, and keeps the machines isolated from one another.'],
      ['Virtual machine approach', 'A multicore OS strategy: instead of time-slicing every core among many processes, dedicate one or more whole cores (plus memory) to a process for a long period and let the process use them as it likes, so the OS behaves more like a hypervisor handing out resources.'],
    ],

    css: `
      /* shell workaround: the long section title in the nowrap eyebrow would otherwise widen the page on phones */
      .sec-2-6 .step-eyebrow { contain: inline-size; }
      .sec-2-6 .hot { cursor: pointer; outline: none; }
      .sec-2-6 .hot .fr { transition: stroke-width .12s; }
      .sec-2-6 .hot:hover .fr, .sec-2-6 .hot:focus-visible .fr { stroke-width: 3.5; }
      .sec-2-6 .tx-cpu { fill: var(--cpu); } .sec-2-6 .tx-mem { fill: var(--mem); } .sec-2-6 .tx-io { fill: var(--io); }
      .sec-2-6 .tx-os { fill: var(--os); } .sec-2-6 .tx-proc { fill: var(--proc); } .sec-2-6 .tx-thread { fill: var(--thread); }
      .sec-2-6 .tx-ok { fill: var(--ok); } .sec-2-6 .tx-bad { fill: var(--bad); } .sec-2-6 .tx-warn { fill: var(--warn); }
      .sec-2-6 .tx-muted { fill: var(--muted); } .sec-2-6 .tx-accent { fill: var(--accent); }
      /* race lab: dispatcher code with one marker per CPU */
      .sec-2-6 .dcode { background: var(--panel-3); border: 1px solid var(--line); border-radius: 10px; padding: 5px 0; }
      .sec-2-6 .dl { display: grid; grid-template-columns: 84px 168px minmax(0, 1fr); align-items: center; gap: 6px; padding: 2px 10px 2px 6px; border-left: 4px solid transparent; min-height: 31px; }
      .sec-2-6 .dl.dim { opacity: .38; }
      .sec-2-6 .dl.cur { background: color-mix(in srgb, var(--cpu) 10%, transparent); border-left-color: var(--cpu); }
      .sec-2-6 .dl code { background: none; padding: 0; font-size: 13.5px; font-weight: 700; }
      .sec-2-6 .dl .cm { color: var(--muted); font-size: 13px; line-height: 1.25; }
      .sec-2-6 .mk { display: flex; gap: 3px; }
      .sec-2-6 .mk b { display: inline-grid; place-items: center; width: 19px; height: 19px; border-radius: 5px; font-size: 12.5px; background: var(--cpu); color: var(--panel); }
      .sec-2-6 .mk b.spin { background: var(--warn); }
      .sec-2-6 .log .ok { color: var(--ok); } .sec-2-6 .log .bad { color: var(--bad); font-weight: 700; } .sec-2-6 .log .warn { color: var(--warn); }
      /* design-issue explorer */
      .sec-2-6 .iss { display: grid; grid-template-columns: 28px minmax(0, 1fr) 16px; align-items: center; gap: 8px; text-align: left; padding: 7px 9px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; color: var(--ink); font: inherit; font-size: 14.5px; font-weight: 700; line-height: 1.2; min-height: 50px; }
      .sec-2-6 .iss:hover { border-color: var(--os); }
      .sec-2-6 .iss .n { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: var(--os-bg); color: var(--os); font-weight: 900; }
      .sec-2-6 .iss.on { border-color: var(--os); background: var(--os-bg); }
      .sec-2-6 .iss.on .n { background: var(--os); color: var(--panel); }
      .sec-2-6 .iss .ck { color: var(--ok); font-weight: 900; }
      .sec-2-6 .iss-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
      /* phone layout (the step body gets class "nar" in narrow mode) */
      .sec-2-6 .nar .iss-grid { grid-template-columns: 1fr 1fr; }
      .sec-2-6 .nar .dl { grid-template-columns: 70px minmax(0, 1fr); row-gap: 0; padding-top: 4px; padding-bottom: 4px; }
      .sec-2-6 .nar .dl .cm { grid-column: 2; }
      .sec-2-6 .nar .ctl-row { grid-template-columns: 1fr; gap: 4px; }
      .sec-2-6 .nar .role { grid-template-columns: 1fr; gap: 4px; }
      .sec-2-6 .nar .kpis .v { font-size: 20px; }
      .sec-2-6 .btn4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .sec-2-6 .nar .btn4 { grid-template-columns: 1fr 1fr; }
      .sec-2-6 .nar .log { max-height: 220px; }
      .sec-2-6 .chip.tool { background: var(--panel); color: var(--os); border: 1px solid color-mix(in srgb, var(--os) 45%, transparent); }
      .sec-2-6 .scen td { font-size: 14px; line-height: 1.35; }
      .sec-2-6 .scen td:first-child { font-weight: 800; color: var(--muted); width: 26px; text-align: center; }
      .sec-2-6 .scen td.st { font-family: var(--mono); font-size: 13.5px; }
      .sec-2-6 .scen td.bc { color: var(--bad); font-weight: 800; background: var(--bad-bg); }
      .sec-2-6 .scen td.oc { color: var(--ok); font-weight: 800; background: var(--ok-bg); }
      /* graceful degradation lab */
      .sec-2-6 .ptab td, .sec-2-6 .ptab th { font-size: 14px; }
      .sec-2-6 .ptab td.off { color: var(--bad); font-weight: 800; }
      .sec-2-6 .ptab td.on { color: var(--ok); font-weight: 800; }
      .sec-2-6 .ptab td.lie { color: var(--warn); font-weight: 800; background: var(--warn-bg); }
      .sec-2-6 .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .sec-2-6 .kpis > div { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; }
      .sec-2-6 .kpis .v { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.15; }
      .sec-2-6 .kpis.k4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .sec-2-6 .kpis.k4 > div { padding: 5px 8px; }
      .sec-2-6 .nar .kpis.k4 { grid-template-columns: 1fr 1fr; }
      .sec-2-6 .role { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px; align-items: center; padding: 6px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); font-size: 14.5px; line-height: 1.35; }
      .sec-2-6 .role .chip { justify-self: start; }
      .sec-2-6 .ctl-row { display: grid; grid-template-columns: 128px minmax(0, 1fr); align-items: center; gap: 8px; }
      /* three levels of parallelism */
      .sec-2-6 .lvl { transition: opacity .25s; }
      .sec-2-6 .lvl.dim { opacity: .3; }
      .sec-2-6 .wl { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 4px 4px 4px 10px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); font-size: 14px; line-height: 1.3; }
      .sec-2-6 .wl.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-2-6 .wl.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-2-6 .wl .bs { display: flex; gap: 3px; }
      .sec-2-6 .wl .bs .btn { width: 32px; padding: 0; }
      .sec-2-6 .wl .bs .btn.right { border-color: var(--ok); background: var(--ok); color: var(--panel); }
      .sec-2-6 .wl .bs .btn.wrong { border-color: var(--bad); background: var(--bad); color: var(--panel); }
    `,

    steps: [
      /* ---------------- 1. Big picture: the kernel stops being alone ---------------- */
      {
        title: 'One kernel, many processors',
        kind: 'story',
        render(el, ctx) {
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;
          const VIEW = {
            uni: {
              cpus: [{ n: 0, a: 'kernel code:', b: 'scheduler', k: 'os', grab: true }],
              cap: '<b>One processor.</b> Only this CPU can run the scheduler, so no other processor can touch the ready queue while it chooses. To stop an interrupt handler cutting in halfway, the kernel just switches interrupts off for a moment. Now switch to four processors.',
            },
            smp: {
              cpus: [
                { n: 0, a: 'user process', b: 'P1 running', k: 'proc' },
                { n: 1, a: 'kernel code:', b: 'scheduler', k: 'os', grab: true },
                { n: 2, a: 'kernel code:', b: 'scheduler', k: 'os', grab: true },
                { n: 3, a: 'kernel thread:', b: 'disk writer', k: 'os' },
              ],
              cap: '<b>Four processors, one kernel.</b> CPU 1 and CPU 2 run the scheduler <b>at the same instant</b> and both reach for P3. Disabling interrupts on CPU 1 does nothing to stop CPU 2, so shared kernel tables now need <b>locks</b>. With CPU 3 in a kernel thread, kernel code is running in three places at once.',
            },
          };
          let mode = 'uni';
          const NW = ctx.narrow;
          // geometry: wide canvas (one row of CPUs, tables beside the queue) or phone (compact CPUs, tables below)
          const G = NW ? { vb: '0 0 330 318', W: 76, gap: 6, cy: 6, ch: 90, x1: 127, x0: 4, mem: [4, 150, 322, 162], qx: 8, qy: 160, qw: 40, qs: 46, qh: 36,
              ql: [8, 214], tabs: [[8, 224], [114, 224], [220, 224]], tw: 100, tt: [[8, 286, 'Shared main memory:'], [8, 302, 'one copy of every kernel table']], lab: [232, 140, 'middle'] }
            : { vb: '0 0 640 296', W: 146, gap: 11, cy: 12, ch: 96, x1: 247, x0: 12, mem: [8, 186, 624, 104], qx: 22, qy: 198, qw: 50, qs: 58, qh: 40,
              ql: [22, 256], tabs: [[356, 198], [448, 198], [540, 198]], tw: 84, tt: [[22, 280, 'Shared main memory: one copy of every kernel table']], lab: [112, 180, 'start'] };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Processors sharing one ready queue in main memory' });
          const cap = h('p', { class: 'small m0', style: { minHeight: NW ? '0' : '88px' } });
          function draw() {
            const v = VIEW[mode];
            const kids = [];
            const n = v.cpus.length;
            const x0 = n === 1 ? G.x1 : G.x0, qTop = G.qy, headX = G.qx + G.qw / 2;
            // shared memory with the ready queue and kernel tables
            kids.push(s('rect', { x: G.mem[0], y: G.mem[1], width: G.mem[2], height: G.mem[3], rx: 14, class: 's-mem', 'stroke-width': 2 }));
            G.tt.forEach(([x, y, txt]) => kids.push(s('text', { x, y, 'font-size': NW ? 13 : 14, 'font-weight': 800, class: 'tx-mem' }, txt)));
            kids.push(s('text', { x: G.ql[0], y: G.ql[1], 'font-size': NW ? 12.5 : 13, 'font-weight': 700 }, 'Ready queue (front at left)'));
            ['P3', 'P4', 'P5', 'P6', 'P7'].forEach((p, i) => {
              const hot = i === 0 && mode === 'smp';
              kids.push(s('rect', { x: G.qx + i * G.qs, y: G.qy, width: G.qw, height: G.qh, rx: 8, class: hot ? 's-warn' : 's-proc', 'stroke-width': hot ? 3 : 2 }));
              kids.push(s('text', { x: G.qx + G.qw / 2 + i * G.qs, y: G.qy + G.qh / 2 + 5, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800 }, p));
            });
            ['Process list', 'Open-file table', 'Page tables'].forEach((txt, k) => {
              const [x, y] = G.tabs[k];
              kids.push(s('rect', { x, y, width: G.tw, height: 40, rx: 8, class: 's-os', 'stroke-width': 1.5 }));
              if (NW) kids.push(s('text', { x: x + G.tw / 2, y: y + 25, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, txt));
              else kids.push(mtext(s, x + G.tw / 2, y + 17, k === 1 ? ['Open-file', 'table'] : txt.split(' '), { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 14));
            });
            // processors
            v.cpus.forEach((c, i) => {
              const x = x0 + i * (G.W + G.gap), cx = x + G.W / 2, bot = G.cy + G.ch;
              kids.push(s('rect', { x, y: G.cy, width: G.W, height: G.ch, rx: 12, class: 's-cpu', 'stroke-width': 2 }));
              kids.push(s('text', { x: cx, y: G.cy + 22, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800, class: 'tx-cpu' }, 'CPU ' + c.n));
              const pad = NW ? 5 : 10;
              kids.push(s('rect', { x: x + pad, y: G.cy + 32, width: G.W - 2 * pad, height: G.ch - 44, rx: 9, class: c.k === 'os' ? 's-os' : 's-proc', 'stroke-width': 1.5 }));
              const lines = NW ? [c.k === 'os' ? 'kernel' : 'user', c.b.replace(' running', '')] : [c.a, c.b];
              kids.push(mtext(s, cx, G.cy + (NW ? 52 : 53), lines, { 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 13.5, 'font-weight': 700 }, NW ? 16 : 18));
              if (c.grab) {
                const cls = mode === 'smp' ? 'warn' : 'os';
                kids.push(s('path', { d: `M${cx} ${bot + 2} C ${cx} ${bot + 40}, ${headX} ${qTop - 40}, ${headX} ${qTop - 4}`, fill: 'none', style: `stroke:var(--${cls})`, 'stroke-width': 2.5, 'marker-end': `url(#arr-${cls})` }));
              } else {
                kids.push(s('line', { x1: cx, y1: bot + 2, x2: cx, y2: G.mem[1] - 4, class: 's-muted', 'stroke-dasharray': '5 5' }));
              }
            });
            if (mode === 'smp') kids.push(s('text', { x: G.lab[0], y: G.lab[1], 'text-anchor': G.lab[2], 'font-size': 13.5, 'font-weight': 800, class: 'tx-warn' }, 'both want P3!'));
            svg.replaceChildren(...kids);
            cap.innerHTML = v.cap;
          }
          const seg = ctx.ui.seg([{ value: 'uni', label: 'One processor' }, { value: 'smp', label: 'Four processors (SMP)' }], mode, (m) => { mode = m; draw(); });
          draw();
          const coming = h('div', { class: 'row gap-s' },
            h('span', { class: 'xs b muted' }, 'COMING UP'),
            ...[['Race lab', 'os'], ['Five design issues', 'os'], ['Fail a CPU', 'intr'], ['Three levels of parallelism', 'cpu'], ['Tasks with GCD', 'thread'], ['Dedicated cores', 'proc']]
              .map(([t, c]) => h('span', { class: 'chip ' + c }, t)));
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'With one processor, at most one piece of kernel code is executing at any instant. Add processors and that comfort is gone.' }),
              h('p', { class: 'm0', html: 'As section 2.4 showed, in a <span class="t">symmetric multiprocessor (SMP)</span>, kernel code can run on <b>any</b> processor. Usually no processor is the boss: each does <span class="t">self-scheduling</span>, running the scheduler itself to take its next process or thread from a shared pool. The <span class="t">kernel</span> can itself be built as several processes or threads, so parts of it run in parallel.' }),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'One order rail, four cooks, no manager: each free cook grabs the next ticket. Fast and fair, until two cooks grab the same ticket, or a ticket slips behind the grill and is never cooked.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The OS must ensure that two processors never choose the same process and that no process is ever lost from the queue, while users simply see a faster machine.' })),
            h('div', { class: 'card white stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Who runs the kernel?'), seg),
              svg, cap, coming)));
        },
      },

      /* ---------------- 2. Lab: self-scheduling race on the shared ready queue ---------------- */
      {
        title: 'Race lab: four CPUs, one shared ready queue',
        kind: 'lab',
        core: true, // on the shorter core path
        render(el, ctx) {
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;
          const P = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
          const LINES = [
            ['acquire(lock);', 'spin until free, then take it'],
            ['next = ready[front];', 'read the process at the front'],
            ['front = front + 1;', 'step past the entry just read'],
            ['release(lock);', 'let another CPU in'],
            ['run(next);', 'run the chosen process'],
          ];
          let lockOn = false, st = null, auto = null;
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 330 292' : '0 0 640 244', width: '100%', role: 'img', 'aria-label': 'Four CPUs and the shared ready queue' });
          const code = h('div', { class: 'dcode' });
          const logEl = h('div', { class: 'log grow', style: { minHeight: '120px' } });
          const verdict = h('div', { class: 'callout m0' });
          const bAuto = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (auto ? stopAuto() : startAuto()) });
          const bReset = h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset');
          const stepBtns = [0, 1, 2, 3].map((i) => h('button', { class: 'btn sm cpu', type: 'button', onclick: () => { stopAuto(); stepCPU(i); } }, 'Step CPU ' + i));
          const seg = ctx.ui.seg([{ value: false, label: 'Lock off' }, { value: true, label: 'Lock on' }], lockOn, (v) => { lockOn = v; reset(); });

          function reset() {
            stopAuto();
            st = { front: 0, owner: null, pair: -1, alt: 0, cpus: [0, 1, 2, 3].map(() => ({ pc: lockOn ? 0 : 1, next: null, spins: 0, spun: false })), log: [] };
            say(lockOn ? 'Lock on. Every CPU must take the lock before touching the queue.' : 'Lock off. Nothing stops two CPUs from being inside the queue code together.', 'muted');
            paint();
          }
          function say(html, cls) { st.log.push([html, cls || '']); }
          function stepCPU(i) {
            const c = st.cpus[i];
            if (c.pc > 4) return;
            c.spun = false;
            if (c.pc === 0) {
              if (st.owner === null) { st.owner = i; c.pc = 1; say(`CPU ${i} takes the lock.`, 'ok'); }
              else { c.spins++; c.spun = true; say(`CPU ${i} spins: CPU ${st.owner} holds the lock.`, 'warn'); }
            } else if (c.pc === 1) {
              c.next = st.front; c.pc = 2; say(`CPU ${i} reads ready[${st.front}] and sees ${P[st.front]}.`);
            } else if (c.pc === 2) {
              st.front += 1; c.pc = lockOn ? 3 : 4; say(`CPU ${i} sets front = ${st.front}.`);
            } else if (c.pc === 3) {
              st.owner = null; c.pc = 4; say(`CPU ${i} releases the lock.`, 'ok');
            } else {
              c.pc = 5;
              const twice = st.cpus.filter((o) => o.pc === 5 && o.next === c.next).length > 1;
              say(`CPU ${i} starts running ${P[c.next]}.` + (twice ? ` ${P[c.next]} is now running on two CPUs at once!` : ''), twice ? 'bad' : '');
            }
            paint();
          }
          // "unlucky" timing: CPUs 0 and 1 alternate line by line, then CPUs 2 and 3 do the same
          function nextAuto() {
            const pairs = [[0, 1], [2, 3]];
            for (let p = 0; p < 2; p++) {
              const live = pairs[p].filter((i) => st.cpus[i].pc <= 4);
              if (!live.length) continue;
              if (st.pair !== p) { st.pair = p; st.alt = 0; }
              return live[st.alt++ % live.length];
            }
            return -1;
          }
          function startAuto() {
            if (st.cpus.every((c) => c.pc > 4)) reset();
            auto = ctx.every(560, () => { const i = nextAuto(); if (i < 0) stopAuto(); else stepCPU(i); });
            paintButtons();
          }
          function stopAuto() { if (auto) { clearInterval(auto); auto = null; } paintButtons(); }
          function paintButtons() {
            bAuto.textContent = auto ? 'Pause' : 'Auto-play unlucky timing';
            if (st) stepBtns.forEach((b, i) => { b.disabled = st.cpus[i].pc > 4; });
          }
          /* ---- analysis of the current state ---- */
          function analyse() {
            const takers = P.map((_, j) => st.cpus.map((c, i) => (c.next === j ? i : -1)).filter((i) => i >= 0));
            const twice = takers.map((t, j) => (t.length > 1 ? j : -1)).filter((j) => j >= 0);
            const lost = P.map((_, j) => (j < st.front && !takers[j].length ? j : -1)).filter((j) => j >= 0);
            return { takers, twice, lost, done: st.cpus.every((c) => c.pc > 4) };
          }
          function paint() {
            const a = analyse();
            /* code panel: one badge per CPU on the line it will execute next */
            code.replaceChildren(...LINES.map(([src, cm], k) => {
              const here = st.cpus.map((c, i) => (c.pc === k ? i : -1)).filter((i) => i >= 0);
              const skip = !lockOn && (k === 0 || k === 3);
              return h('div', { class: 'dl' + (skip ? ' dim' : '') + (here.length ? ' cur' : '') },
                h('span', { class: 'mk' }, ...here.map((i) => h('b', { class: st.cpus[i].spun ? 'spin' : '', title: 'CPU ' + i }, String(i)))),
                h('code', {}, src), h('span', { class: 'cm' }, skip ? 'skipped: no lock' : cm));
            }));
            /* diagram (wide: one row of CPUs and one row of 8 slots; phone: compact CPUs and two rows of slots) */
            const kids = [];
            const NW = ctx.narrow;
            const cpuX = (i) => (NW ? 4 + i * 82 : 8 + i * 158), CW = NW ? 76 : 148;
            const slotX = (j) => (NW ? 4 + (j & 3) * 82 : 14 + j * 78), slotY = (j) => (NW ? 128 + (j >> 2) * 70 : 140), SW = NW ? 76 : 68, SH = NW ? 36 : 40;
            st.cpus.forEach((c, i) => {
              const x = cpuX(i), cx = x + CW / 2;
              const bad = c.next !== null && a.twice.includes(c.next);
              const cls = c.pc > 4 ? (bad ? 's-bad' : 's-proc') : c.spun ? 's-warn' : 's-cpu';
              kids.push(s('rect', { x, y: 6, width: CW, height: 86, rx: 12, class: cls, 'stroke-width': 2 }));
              kids.push(s('text', { x: cx, y: NW ? 26 : 28, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800, class: 'tx-cpu' }, 'CPU ' + i));
              const status = c.pc > 4 ? 'running ' + P[c.next] : c.spun ? (NW ? 'spinning' : 'spinning on lock') : (NW ? 'line ' : 'next: line ') + (c.pc + 1);
              kids.push(s('text', { x: cx, y: NW ? 50 : 52, 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 14, 'font-weight': 700, class: c.pc > 4 ? (bad ? 'tx-bad' : 'tx-proc') : c.spun ? 'tx-warn' : '' }, status));
              kids.push(s('text', { x: cx, y: NW ? 74 : 76, 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 13.5, class: 's-monot' }, (NW ? 'next=' : 'next = ') + (c.next === null ? '?' : P[c.next])));
              if (c.next !== null) {
                const sx = slotX(c.next) + SW / 2, sy = slotY(c.next) - 4, col = bad ? 'bad' : c.pc > 4 ? 'proc' : 'cpu';
                kids.push(s('path', { d: `M${cx} 94 C ${cx} ${sy - 18}, ${sx} ${sy - 24}, ${sx} ${sy}`, fill: 'none', style: `stroke:var(--${col})`, 'stroke-width': bad ? 3 : 2, 'marker-end': `url(#arr-${col})` }));
              }
            });
            P.forEach((p, j) => {
              const x = slotX(j), y = slotY(j), passed = j < st.front, lost = a.lost.includes(j), tw = a.twice.includes(j);
              kids.push(s('rect', { x, y, width: SW, height: SH, rx: 8, class: lost || tw ? 's-bad' : passed ? 's-panel' : 's-proc', 'stroke-width': lost || tw ? 3 : 2 }));
              if (NW && j === st.front) kids.push(s('rect', { x: x - 3, y: y - 3, width: SW + 6, height: SH + 6, rx: 10, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 2.5 }));
              kids.push(s('text', { x: x + SW / 2, y: y + SH / 2 + 5, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800, class: passed && !lost && !tw ? 'tx-muted' : '' }, p));
              const tk = a.takers[j];
              const lab = lost ? 'LOST' : tw ? 'TAKEN ×' + tk.length : tk.length ? 'CPU ' + tk[0] : '';
              if (lab) kids.push(s('text', { x: x + SW / 2, y: y + SH + (NW ? 16 : 18), 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 13, 'font-weight': 800, class: lost || tw ? 'tx-bad' : 'tx-proc' }, lab));
            });
            const lockTxt = lockOn ? (st.owner === null ? 'queue lock: free' : 'queue lock: held by CPU ' + st.owner) : 'queue lock: none';
            const lockCls = lockOn ? (st.owner === null ? 'tx-ok' : 'tx-warn') : 'tx-muted';
            if (NW) {
              kids.push(s('text', { x: 4, y: 282, 'font-size': 13, 'font-weight': 800 }, 'front = ' + st.front + ' (outlined)'));
              kids.push(s('text', { x: 326, y: 282, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: lockCls }, lockTxt));
            } else {
              const fx = slotX(Math.min(st.front, P.length - 1)) + 34;
              kids.push(s('path', { d: `M${fx} 206 l -7 12 h 14 z`, style: 'fill:var(--chc)' }));
              kids.push(s('text', { x: fx, y: 236, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'front = ' + st.front));
              kids.push(s('text', { x: 632, y: 236, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700, class: lockCls }, lockTxt));
            }
            svg.replaceChildren(...kids);
            /* log */
            logEl.replaceChildren(...st.log.map(([t, c]) => h('div', { class: c, html: t })));
            logEl.scrollTop = logEl.scrollHeight;
            /* verdict */
            let cls = '', lab = 'Your move', txt;
            if (a.twice.length || a.lost.length) {
              cls = 'bad'; lab = 'Race condition';
              const many = (xs) => xs.length > 1;
              txt = (a.twice.length ? `<b>${a.twice.map((j) => P[j]).join(' and ')}</b> ${many(a.twice) ? 'were each' : 'was'} taken by two CPUs, which both run it at once on its one stack, corrupting it. ` : '') +
                (a.lost.length ? `<b>${a.lost.map((j) => P[j]).join(' and ')}</b> ${many(a.lost) ? 'were' : 'was'} skipped: front moved past ${many(a.lost) ? 'them' : 'it'}, so ${many(a.lost) ? 'they are' : 'it is'} lost.` : '');
            } else if (a.done) {
              cls = 'tip'; lab = 'Every process taken once';
              txt = lockOn ? 'The lock made each read-then-advance pair indivisible: while one CPU was inside, the others spun. Correct no matter how the steps interleave.' : 'No damage this time, but only because of lucky timing. Nothing in the code stops two CPUs from reading the same front. Press Reset and try Auto-play.';
            } else txt = lockOn ? 'Try every order you like. A CPU that finds the lock taken just spins until it is released.' : 'Challenge: make two CPUs read the front before either one advances it. Then keep stepping.';
            verdict.className = 'callout m0 ' + cls; verdict.dataset.label = lab; verdict.innerHTML = txt;
            paintButtons();
          }
          reset();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0 small', html: 'Every CPU runs this same dispatcher code on the one shared <span class="t">ready queue</span>. Each click runs <b>one line</b> on one CPU, so <b>you</b> decide how the steps interleave, just as timing does in real hardware. If some orders break the queue, the code has a <span class="t">race condition</span>.' }),
              h('div', { class: 'row' }, h('span', { class: 'b small' }, 'Queue lock'), seg),
              code, verdict,
              h('p', { class: 'small muted m0', html: 'This lock is a <span class="t">spinlock</span>: a CPU that finds it taken loops until it is free, which is cheap when the protected code is short. <code>acquire</code> cannot race itself: checking and taking the lock is one indivisible hardware instruction (such as test-and-set).' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'card white tight' }, svg),
              h('div', { class: 'btn4' }, ...stepBtns),
              h('div', { class: 'row', style: { gap: '8px' } }, bAuto, bReset, h('span', { class: 'xs muted' }, 'Auto-play: CPUs 0 and 1 alternate line by line, then CPUs 2 and 3.')),
              logEl)));
        },
      },

      /* ---------------- 3. Explore: the five key SMP design issues ---------------- */
      {
        title: 'Five SMP design issues, each with a scenario and a fix',
        kind: 'explore',
        render(el, ctx) {
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h } = ctx;
          // cell prefixes: "!" marks a bad outcome, "+" a good one; the last column is shared state (monospace)
          const ISS = [
            { name: 'Simultaneous concurrent processes or threads', short: 'Concurrent kernel code',
              def: 'Several processors can be inside the <b>same kernel routine at the same moment</b>. Kernel routines must therefore be <span class="t">reentrant code</span>, and kernel tables must be managed so that simultaneous use cannot corrupt them or leave them in an invalid state.',
              scen: 'Process A on CPU 0 and process B on CPU 1 call the kernel’s open-file routine at the same instant.',
              isnew: 'With one processor, at most one kernel routine was executing at any instant, and briefly disabling interrupts protected a table. Now every CPU can be in the kernel at once, even in the same routine.',
              tools: ['Reentrant kernel routines', 'Locks on kernel tables'],
              cols: ['CPU 0 (process A)', 'CPU 1 (process B)', 'Shared kernel data'],
              bad: [[['1', 'put "notes.txt" in the global scratch buffer', '', 'scratch = notes.txt'], ['2', '', 'put "photo.png" in the same buffer', 'scratch = photo.png'], ['3', 'open the file named in scratch', 'open the file named in scratch', '!both open photo.png'], ['4', 'take free slot 5 of the open-file table', 'take free slot 5 too', '!slot 5 overwritten']],
                'A opens the wrong file and one open-file entry vanishes: the routine was not reentrant and the table had no protection.'],
              fix: [[['1', 'name = "notes.txt" on CPU 0’s own kernel stack', 'name = "photo.png" on CPU 1’s own kernel stack', 'nothing shared'], ['2', 'open notes.txt', 'open photo.png', '+each call sees its own data'], ['3', 'lock table, take slot 5, unlock', 'wait, then lock, take slot 6, unlock', '+slots 5 and 6']],
                'Reentrant code keeps each call’s working data private, and a lock serializes changes to the one table that really is shared.'] },
            { name: 'Scheduling', short: 'Scheduling',
              def: 'Any processor may run the scheduler, so their decisions must not conflict: no two processors may pick the same process (the race you just caused). With <span class="t">kernel-level thread</span>s the scheduler also gets a chance to run <b>several threads of one process at the same time</b> on different processors.',
              scen: 'A photo editor has three threads, T1 to T3, all ready to run. Three processors are free.',
              isnew: 'With one processor, one scheduling decision happened at a time. Now every processor makes its own decisions from the same shared queue.',
              tools: ['Locked ready queue', 'Kernel-level threads', 'Threads of one process run together'],
              cols: ['CPU 0', 'CPU 1', 'CPU 2'],
              bad: [[['1', 'T1', '!idle', '!idle'], ['2', 'T2', '!idle', '!idle'], ['3', 'T3', '!idle', '!idle']],
                'Scheduled as if the process were one unit, the editor needs 3 time slots while two processors sit idle.'],
              fix: [[['1', '+T1', '+T2', '+T3'], ['2', 'free for other work', 'free for other work', 'free for other work'], ['3', 'free for other work', 'free for other work', 'free for other work']],
                'The threads run side by side and finish in 1 slot. The queue lock still guarantees that no two CPUs take the same thread.'] },
            { name: 'Synchronization', short: 'Synchronization',
              def: 'Processes on different processors may share memory (a shared address space) or I/O devices at the same moment. The OS must provide <span class="t">synchronization</span>: <span class="t">mutual exclusion</span> so one user at a time touches a resource, and ordering so events happen in the right sequence. <span class="t">Lock</span>s are the most common tool.',
              scen: 'Two threads of a ticket app, on CPU 0 and CPU 1, each sell one seat. The shared counter says 10 seats are left.',
              isnew: 'With one processor, “simultaneous” threads only took turns. Now they truly run at the same instant, so their memory and I/O accesses can collide.',
              tools: ['Locks', 'Mutual exclusion', 'Waiting for events in order'],
              cols: ['CPU 0 (thread 1)', 'CPU 1 (thread 2)', 'seats_left'],
              bad: [[['1', 'read seats_left: 10', 'read seats_left: 10', '10'], ['2', 'compute 10 − 1 = 9', 'compute 10 − 1 = 9', '10'], ['3', 'write 9', 'write 9', '!9']],
                'Two seats were sold but the counter dropped by only one. One update was lost, so the app will oversell.'],
              fix: [[['1', 'lock; read 10', 'lock is taken: wait', '10'], ['2', 'write 9; unlock', 'still waiting', '9'], ['3', 'done', 'lock; read 9; write 8; unlock', '+8']],
                'The lock turns each read-change-write into one indivisible unit, so both sales count: 10 → 8.'] },
            { name: 'Memory management', short: 'Memory management',
              def: 'All the uniprocessor memory issues remain, plus two new jobs: <b>exploit the parallel hardware</b> (for example, memory with several ports that can serve several processors at once) and <b>coordinate paging across processors</b>, so a <span class="t">shared page</span> stays consistent and <span class="t">page replacement</span> never pulls a page out from under a processor still using it.',
              scen: 'Processes on CPU 0 and CPU 1 share page 7, held in frame 12. Each CPU keeps its own private cache of recent page locations. Memory is full and CPU 0 needs a free frame.',
              isnew: 'With one processor there was one view of memory. Now each processor makes paging decisions and remembers page locations on its own.',
              tools: ['Replacement that sees every CPU', 'Warn all CPUs before a shared page moves', 'Parallel page-fault handling'],
              cols: ['CPU 0', 'CPU 1', 'Frame 12 holds'],
              bad: [[['1', 'evicts page 7 (CPU 0 has not used it lately)', 'using page 7; remembers “frame 12”', 'page 7'], ['2', 'loads another process’s page into frame 12', 'still believes page 7 is in frame 12', 'other data'], ['3', '', 'reads frame 12', '!wrong data']],
                'CPU 1 reads another process’s data, because the two processors made paging decisions without coordinating.'],
              fix: [[['1', 'replacement sees CPU 1 using page 7, so it picks a different victim', 'using page 7', 'page 7'], ['2', 'if page 7 must go: tell every CPU to forget where it is, wait for replies', 'forgets “frame 12”, replies', 'page 7'], ['3', 'only now reuses frame 12', 'next use of page 7 faults and reloads it', '+consistent']],
                'Coordinated paging: replacement considers every processor, and a shared page leaves memory only after all of them agree.'] },
            { name: 'Reliability and fault tolerance', short: 'Reliability',
              def: 'Several processors should make the system <b>more</b> robust: able to keep working when one part fails. When one fails, the OS should offer <span class="t">graceful degradation</span>: the scheduler and the rest of the OS must <b>recognize the loss</b> and <b>restructure their management tables</b> so the remaining processors carry on.',
              scen: 'CPU 2 dies while it is running process P5. (You can try this yourself in the next step.)',
              isnew: 'With one processor, a processor failure stopped the whole machine. Now the failure can be survived, but only if the OS notices it.',
              tools: ['Detect the failure', 'Mark the CPU offline', 'Reschedule its work'],
              cols: ['OS tables', 'Process P5', 'Capacity'],
              bad: [[['1', 'CPU 2 still listed as online', 'still marked “running on CPU 2”', 'believed: 4 CPUs'], ['2', 'work and interrupts may still be sent to CPU 2', 'never runs again', 'real: 3 CPUs'], ['3', 'tables disagree with reality', '!hung forever', '!work silently lost']],
                'One hardware fault turns into lost work and a confused kernel, because the OS never noticed.'],
              fix: [[['1', 'missed heartbeat detected; CPU 2 marked offline', 'put back in the ready queue', '4 → 3 CPUs'], ['2', 'scheduling and interrupts skip CPU 2', 'restarted on a healthy CPU (from its last checkpoint, if it has one)', '75%'], ['3', 'system keeps running', '+finishes', '+slower, not dead']],
                'Graceful degradation: the system loses a quarter of its speed, but every process still finishes.'] },
          ];
          let cur = 0, view = 'bad';
          const seen = new Set([0]);
          const count = h('span', { class: 'chip ok' });
          const tiles = ISS.map((it, i) => h('button', { class: 'iss', type: 'button', onclick: () => { cur = i; view = 'bad'; seg.set('bad'); seen.add(i); paint(); } }));
          const seg = ctx.ui.seg([{ value: 'bad', label: 'Without care' }, { value: 'fix', label: 'With the fix' }], view, (v) => { view = v; paint(); });
          const left = h('div', { class: 'card os stack', style: { gap: '8px' } });
          const tableBox = h('div');
          const scen = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } });
          const res = h('div', { class: 'callout m0' });
          function paint() {
            const it = ISS[cur];
            tiles.forEach((t, i) => {
              t.classList.toggle('on', i === cur);
              t.replaceChildren(h('span', { class: 'n' }, String(i + 1)), h('span', {}, ISS[i].short), h('span', { class: 'ck' }, seen.has(i) ? '✓' : ''));
            });
            count.textContent = `Explored ${seen.size} / 5`;
            left.replaceChildren(
              h('h4', { class: 'm0' }, 'Design issue ' + (cur + 1)),
              h('h3', { class: 'm0' }, it.name),
              h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.5' }, html: it.def }),
              h('div', { class: 'callout why m0', 'data-label': 'Why it is new', html: it.isnew }),
              h('div', { class: 'row gap-s', style: { marginTop: 'auto' } }, h('span', { class: 'xs b muted' }, 'TOOLBOX'), ...it.tools.map((x) => h('span', { class: 'chip tool' }, x))));
            scen.innerHTML = '<b>Scenario.</b> ' + it.scen;
            const [rows, txt] = it[view];
            const cell = (v, last) => {
              const cls = v.startsWith('!') ? 'bc' : v.startsWith('+') ? 'oc' : '';
              return h('td', { class: (last ? 'st ' : '') + cls }, v.replace(/^[!+]/, ''));
            };
            tableBox.replaceChildren(h('table', { class: 'tbl compact scen' },
              h('thead', {}, h('tr', {}, h('th', {}, '#'), ...it.cols.map((c) => h('th', {}, c)))),
              h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((v, k) => cell(v, k === r.length - 1 && cur !== 1)))))));
            res.className = 'callout m0 ' + (view === 'bad' ? 'bad' : 'tip');
            res.dataset.label = view === 'bad' ? 'What goes wrong' : 'How the OS avoids it';
            res.innerHTML = txt;
          }
          paint();
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('div', { class: 'iss-grid' }, ...tiles),
            h('div', { class: 'split l grow' },
              left,
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, count),
                scen,
                tableBox, res))));
        },
      },

      /* ---------------- 4. Lab: fail a processor, watch graceful degradation ---------------- */
      {
        title: 'Fail a processor: graceful degradation',
        kind: 'lab',
        render(el, ctx) {
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;
          const NJOB = 12, NEED = 4;
          let fixMode = true, st = null, timer = null;
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 330 236' : '0 0 640 196', width: '100%', role: 'img', 'aria-label': 'Four processors working through a queue of jobs' });
          const tbody = h('tbody');
          const kTick = h('div', { class: 'v' }), kDone = h('div', { class: 'v' }), kCap = h('div', { class: 'v' });
          const capNote = h('div', { class: 'xs muted' });
          const verdict = h('div', { class: 'callout m0' });
          const logEl = h('div', { class: 'log grow', style: { minHeight: '90px' } });
          const bPlay = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (timer ? pause() : play()) });
          const bStep = h('button', { class: 'btn sm', type: 'button', onclick: () => { pause(); tick(); } }, 'One tick');
          const bReset = h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset');
          const failBtns = [0, 1, 2, 3].map((k) => h('button', { class: 'btn sm intr', type: 'button', onclick: () => fail(k) }, 'Fail CPU ' + k));
          const seg = ctx.ui.seg([{ value: true, label: 'Restructure tables' }, { value: false, label: 'Ignore the loss' }], fixMode, (v) => { fixMode = v; reset(); });

          function reset() {
            pause();
            st = { t: 0, over: false, jobs: Array.from({ length: NJOB }, (_, i) => ({ id: 'J' + (i + 1), done: 0, fin: false })),
              queue: Array.from({ length: NJOB }, (_, i) => i), cpus: [0, 1, 2, 3].map(() => ({ alive: true, table: 'online', job: null, failedAt: -1 })), log: [] };
            dispatch();
            say(`Tick 0. 12 jobs of ${NEED} work units each; every CPU has taken one from the ready queue.`, 'muted');
            paint();
          }
          function say(t, c) { st.log.push([t, c || '']); }
          function dispatch() {
            st.cpus.forEach((c) => { if (c.alive && c.job === null && st.queue.length) c.job = st.queue.shift(); });
          }
          function fail(k) {
            const c = st.cpus[k];
            if (!c.alive || st.over) return;
            if (st.cpus.filter((x) => x.alive).length <= 1) { ctx.toast('Keep at least one processor alive.'); return; }
            c.alive = false; c.failedAt = st.t;
            say(`CPU ${k} fails` + (c.job !== null ? ` while running ${st.jobs[c.job].id}` : '') + `. It stops instantly; the OS tables do not know yet.`, 'bad');
            paint();
          }
          function tick() {
            if (st.over) return;
            st.t += 1;
            // 1. detection and restructuring (only when the OS checks)
            if (fixMode) st.cpus.forEach((c, k) => {
              if (!c.alive && c.table === 'online') {
                c.table = 'offline';
                say(`CPU ${k} missed its heartbeat. The OS marks it OFFLINE and stops scheduling on it.`, 'warn');
                if (c.job !== null) {
                  const j = st.jobs[c.job];
                  st.queue.unshift(c.job);
                  say(`${j.id} goes back to the front of the ready queue, restarting from its last checkpoint (${j.done}/${NEED} units kept).`, 'ok');
                  c.job = null;
                }
              }
            });
            // 2. every live processor schedules itself, then does one unit of work
            dispatch();
            st.cpus.forEach((c) => {
              if (!c.alive || c.job === null) return;
              const j = st.jobs[c.job];
              j.done += 1;
              if (j.done >= NEED) { j.fin = true; c.job = null; }
            });
            dispatch(); // a processor that just finished immediately takes its next job
            const fin = st.jobs.filter((j) => j.fin).length;
            const busy = st.cpus.some((c) => c.alive && c.job !== null);
            if (fin === NJOB) { st.over = true; say(`All ${NJOB} jobs finished at tick ${st.t}. (With no failure: 12 ticks.)`, 'ok'); pause(); }
            else if (!busy && !st.queue.length) {
              const left = NJOB - fin;
              st.over = true; say(`Stalled at tick ${st.t}: ${fin}/${NJOB} done. ${left === 1 ? 'The last job is' : `The other ${left} jobs are`} still marked “running” on a dead CPU and will never finish.`, 'bad'); pause();
            }
            paint();
          }
          function play() { if (st.over) reset(); timer = ctx.every(700, tick); paintCtl(); }
          function pause() { if (timer) { clearInterval(timer); timer = null; } paintCtl(); }
          function paintCtl() {
            bPlay.textContent = timer ? 'Pause' : st && st.over ? 'Replay' : 'Play';
            if (!st) return;
            const alive = st.cpus.filter((c) => c.alive).length;
            failBtns.forEach((b, k) => { b.disabled = !st.cpus[k].alive || st.over || alive <= 1; });
            bStep.disabled = st.over;
          }
          function paint() {
            const alive = st.cpus.filter((c) => c.alive).length;
            const believed = st.cpus.filter((c) => c.table === 'online').length;
            const fin = st.jobs.filter((j) => j.fin).length;
            /* diagram */
            const kids = [];
            const NW = ctx.narrow, CW = NW ? 76 : 148;
            st.cpus.forEach((c, k) => {
              const x = NW ? 4 + k * 82 : 8 + k * 158, cx = x + CW / 2;
              kids.push(s('rect', { x, y: 6, width: CW, height: 100, rx: 12, class: c.alive ? 's-cpu' : 's-bad', 'stroke-width': 2, 'stroke-dasharray': c.alive ? null : '6 4' }));
              kids.push(s('text', { x: cx, y: 28, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800, class: c.alive ? 'tx-cpu' : 'tx-bad' }, (c.alive ? '' : '✗ ') + 'CPU ' + k));
              const j = c.job !== null ? st.jobs[c.job] : null;
              const line = !c.alive ? (j ? j.id + (NW ? ' frozen' : ' frozen here') : 'dead') : j ? (NW ? j.id : 'running ' + j.id) : 'idle';
              kids.push(s('text', { x: cx, y: 54, 'text-anchor': 'middle', 'font-size': NW ? 13 : 14, 'font-weight': 700, class: !c.alive ? 'tx-bad' : j ? 'tx-proc' : 'tx-muted' }, line));
              const uw = NW ? 14 : 24, us = NW ? 17 : 29, ux = cx - (NEED * us - (us - uw)) / 2;
              for (let u = 0; u < NEED; u++) kids.push(s('rect', { x: ux + u * us, y: 68, width: uw, height: 14, rx: 4, class: j && u < j.done ? (c.alive ? 's-proc' : 's-bad') : 's-panel', 'stroke-width': 1.5 }));
              kids.push(s('text', { x: cx, y: 100, 'text-anchor': 'middle', 'font-size': 12.5, class: 'tx-muted' }, j ? (NW ? `${j.done}/${NEED}` : `${j.done}/${NEED} units`) : ''));
            });
            kids.push(s('text', { x: NW ? 4 : 8, y: 134, 'font-size': 13.5, 'font-weight': 800 }, 'Ready queue (front at left)'));
            st.queue.forEach((q, i) => {
              const j = st.jobs[q], x = NW ? 4 + (i % 6) * 54 : 8 + i * 52, y = NW ? 144 + Math.floor(i / 6) * 46 : 144;
              kids.push(s('rect', { x, y, width: 46, height: 40, rx: 8, class: j.done ? 's-warn' : 's-proc', 'stroke-width': 2 }));
              kids.push(s('text', { x: x + 23, y: y + 25, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, j.id));
            });
            if (!st.queue.length) kids.push(s('text', { x: 8, y: 170, 'font-size': 14, class: 'tx-muted' }, 'empty'));
            svg.replaceChildren(...kids);
            /* the OS's own processor table */
            tbody.replaceChildren(...st.cpus.map((c, k) => {
              const lie = !c.alive && c.table === 'online';
              const j = c.job !== null ? st.jobs[c.job].id : '—';
              return h('tr', {}, h('td', { class: 'b' }, 'CPU ' + k),
                h('td', { class: lie ? 'lie' : c.table === 'online' ? 'on' : 'off' }, c.table + (lie ? ' (wrong!)' : '')),
                h('td', { class: lie && j !== '—' ? 'lie' : '' }, c.table === 'offline' ? 'removed from scheduling' : j));
            }));
            kTick.textContent = st.t; kDone.textContent = `${fin}/${NJOB}`; kCap.textContent = Math.round((alive / 4) * 100) + '%';
            capNote.textContent = believed !== alive ? `OS believes ${believed} CPUs are up; really ${alive}` : `${alive} of 4 processors working`;
            /* verdict */
            const anyDead = alive < 4;
            let cls = '', lab = 'Try it', txt = 'Press Play, then fail a CPU while it is running a job. Compare the two OS reactions.';
            if (st.over && fin === NJOB && anyDead && !fixMode) { cls = 'warn'; lab = 'Lucky, not safe'; txt = 'Every job finished only because the dead CPU was holding no job when it failed. The OS still believes all 4 processors are up, so its tables are wrong.'; }
            else if (st.over && fin === NJOB) { cls = 'tip'; lab = 'Graceful degradation'; txt = anyDead ? `Done at tick ${st.t} instead of 12. Capacity fell to ${Math.round((alive / 4) * 100)}%, but every job finished because the OS noticed the loss and rebuilt its tables.` : 'No failure this time: 48 units of work ÷ 4 CPUs = 12 ticks. Reset and fail a CPU mid-run.'; }
            else if (st.over) {
              const frozen = st.cpus.filter((c) => !c.alive && c.job !== null).length; // dead CPUs still holding a job
              cls = 'bad'; lab = 'Silent failure';
              txt = frozen === 1 ? 'The OS never noticed. Its tables still show a dead CPU as online and running a job, so that job never finishes and nobody is told.'
                : `The OS never noticed. Its tables still show ${frozen} dead CPUs as online and running jobs, so those jobs never finish and nobody is told.`;
            }
            else if (anyDead && fixMode) { cls = 'why'; lab = 'Restructuring'; txt = 'The OS detects the dead CPU, marks it offline, puts its job back in the ready queue and carries on with fewer processors.'; }
            else if (anyDead) { cls = 'warn'; lab = 'Nobody noticed'; txt = 'The tables still say every CPU is online. Keep playing and watch the job that was on the dead CPU.'; }
            verdict.className = 'callout m0 ' + cls; verdict.dataset.label = lab; verdict.innerHTML = txt;
            logEl.replaceChildren(...st.log.map(([t, c]) => h('div', { class: c, html: t })));
            logEl.scrollTop = logEl.scrollHeight;
            paintCtl();
          }
          reset();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0 small', html: 'An SMP should survive a dead processor. Twelve jobs need 4 units of work each, and each job saves a checkpoint (a copy of its progress) after every finished unit. Press Play, fail a CPU mid-run, and watch what the OS does with its <b>management tables</b>.' }),
              h('div', { class: 'row' }, h('span', { class: 'b small' }, 'OS reaction'), seg),
              h('div', {}, h('h4', { class: 'm0 mb', style: { marginBottom: '4px' } }, 'The OS’s processor table'),
                h('table', { class: 'tbl compact ptab' }, h('thead', {}, h('tr', {}, h('th', {}, 'CPU'), h('th', {}, 'Table says'), h('th', {}, 'Assigned job'))), tbody)),
              h('div', { class: 'kpis' }, h('div', {}, h('div', { class: 'xs muted b' }, 'TICK'), kTick), h('div', {}, h('div', { class: 'xs muted b' }, 'JOBS DONE'), kDone), h('div', {}, h('div', { class: 'xs muted b' }, 'CAPACITY'), kCap)),
              capNote, verdict),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'card white tight' }, svg),
              h('div', { class: 'btn4' }, ...failBtns),
              h('div', { class: 'row', style: { gap: '8px' } }, bPlay, bStep, bReset),
              logEl,
              h('div', { class: 'callout tip m0 small', 'data-label': 'How does the OS notice?', html: 'Each processor regularly checks in, for example by bumping a <b>heartbeat</b> counter in shared memory. If one falls silent, another processor declares it failed and starts the restructuring.' }))));
        },
      },

      /* ---------------- 5. Explore: multicore and the three levels of parallelism ---------------- */
      {
        title: 'Multicore: parallelism at three levels',
        kind: 'explore',
        render(el, ctx) {
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;
          const LV = [
            { t: 'Level 1 · Inside each core', what: 'Several instructions from <b>one</b> instruction stream are in progress at once: a pipeline overlaps their stages, and many cores can start more than one per clock cycle. This is <span class="t">instruction-level parallelism (ILP)</span>.',
              who: 'The <b>hardware</b> finds it automatically, helped by compilers that order instructions well. The OS does not manage it.' },
            { t: 'Level 2 · Within each core, over time', what: 'Each core is shared by several processes and threads: classic <span class="t">multiprogramming</span> and multithreaded execution. While one waits, another runs.',
              who: 'The <b>OS scheduler</b>, just as on a single processor, but now separately for every core.' },
            { t: 'Level 3 · One application across cores', what: 'A <b>single application</b> runs as several concurrent processes or threads spread over different cores, so that one application finishes sooner.',
              who: 'The <b>developer</b> splits the work, <b>compilers and languages</b> help, and the <b>OS</b> hands out cores and resources. This is the hardest level; the next two steps explore it.' },
          ];
          const QS = [
            ['While one instruction executes, the core is already decoding the next and fetching the one after.', 0],
            ['While one thread waits for the disk, the OS runs a different thread on the same core.', 1],
            ['A video encoder splits each frame into strips and encodes the strips on four cores at once.', 2],
            ['A core starts two independent additions from the same instruction stream in one clock cycle.', 0],
          ];
          let cur = 0;
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 340 640' : '0 0 660 336', width: '100%', role: 'img', 'aria-label': 'A four-core chip showing three levels of parallelism' });
          const det = h('div', { class: 'card os stack', style: { gap: '6px' } });
          const seg = ctx.ui.seg(LV.map((l, i) => ({ value: i, label: 'Level ' + (i + 1) })), cur, (v) => { cur = v; paint(); });
          const groups = [];
          function build() {
            const NW = ctx.narrow, W0 = NW ? 340 : 660, H0 = NW ? 640 : 336;
            const kids = [s('rect', { x: 4, y: 4, width: W0 - 8, height: H0 - 8, rx: 16, class: 's-panel', 'stroke-width': 2 }),
              s('text', { x: 18, y: 26, 'font-size': 14, 'font-weight': 800, class: 'tx-muted' }, 'One four-core chip, shared memory')];
            const g1 = [], g2 = [], g3 = [];
            // legend for the pipeline stages (level 1), so the letters are not a mystery
            g1.push(s('text', { x: NW ? 170 : 642, y: NW ? 624 : 26, 'text-anchor': NW ? 'middle' : 'end', 'font-size': 12.5, 'font-weight': 700, class: 'tx-accent' }, 'F fetch · D decode · E execute · W write result'));
            const TH = ['s-proc', 's-thread', 's-io'];
            for (let c = 0; c < 4; c++) {
              // wide: four cores in a row; phone: a 2 × 2 grid (dy shifts the second row down)
              const x = NW ? 16 + (c & 1) * 160 : 16 + c * 160, dy = NW ? (c >> 1) * 262 : 0;
              kids.push(s('rect', { x, y: 38 + dy, width: 148, height: 254, rx: 12, class: 's-cpu', 'stroke-width': 2 }));
              kids.push(s('text', { x: x + 74, y: 58 + dy, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800, class: 'tx-cpu' }, 'Core ' + c));
              // level 1: a tiny pipeline, three instructions overlapping by one stage each
              const p = [s('rect', { x: x + 8, y: 66 + dy, width: 132, height: 84, rx: 8, class: 's-panel', 'stroke-width': 1.5 }),
                s('text', { x: x + 132, y: 84 + dy, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, class: 'tx-muted' }, 'ILP')];
              ['F', 'D', 'E', 'W'].forEach((st, k) => [0, 1, 2].forEach((ins) => {
                const px = x + 16 + (k + ins) * 20, py = 76 + ins * 22 + dy;
                p.push(s('rect', { x: px, y: py, width: 18, height: 18, rx: 3, class: 's-accent', 'stroke-width': 1 }));
                p.push(s('text', { x: px + 9, y: py + 13.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, st));
              }));
              g1.push(...p);
              // level 2: the core's timeline switching among processes and threads
              const q = [s('rect', { x: x + 8, y: 160 + dy, width: 132, height: 64, rx: 8, class: 's-panel', 'stroke-width': 1.5 }),
                s('text', { x: x + 74, y: 178 + dy, 'text-anchor': 'middle', 'font-size': 12.5, class: 'tx-muted' }, 'time →')];
              // six turns on this core, rotating among three processes/threads A, B, C
              for (let k = 0; k < 6; k++) {
                const px = x + 14 + k * 20.5;
                q.push(s('rect', { x: px, y: 188 + dy, width: 19, height: 26, rx: 3, class: TH[(k + c) % 3], 'stroke-width': 1.5 }),
                  s('text', { x: px + 9.5, y: 205.5 + dy, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'ABC'[(k + c) % 3]));
              }
              g2.push(...q);
              // level 3: one thread of the same application on every core
              g3.push(s('rect', { x: x + 22, y: 238 + dy, width: 104, height: 40, rx: 9, class: 's-os', 'stroke-width': 2 }),
                s('text', { x: x + 74, y: 263 + dy, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'App X · T' + (c + 1)));
            }
            if (NW) g3.push(s('path', { d: 'M 38 560 v 9 h 264 v -9', fill: 'none', style: 'stroke:var(--os)', 'stroke-width': 2 }),
              mtext(s, 170, 588, ['one application, four threads,', 'running at the same moment'], { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 'tx-os' }, 16));
            else g3.push(s('path', { d: 'M 38 298 v 9 h 584 v -9', fill: 'none', style: 'stroke:var(--os)', 'stroke-width': 2 }),
              s('text', { x: 330, y: 326, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 'tx-os' }, 'one application, four threads, running at the same moment'));
            groups.length = 0;
            [g1, g2, g3].forEach((g, i) => { const grp = hotGroup(ctx, () => { cur = i; seg.set(i); paint(); }, LV[i].t, ...g); grp.classList.add('lvl'); groups.push(grp); kids.push(grp); });
            svg.replaceChildren(...kids);
          }
          const rows = QS.map(([q, ans]) => {
            const row = h('div', { class: 'wl' }, h('span', {}, q));
            const bs = [0, 1, 2].map((k) => h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Level ' + (k + 1), onclick: () => {
              bs.forEach((b) => b.classList.remove('right', 'wrong'));
              bs[ans].classList.add('right'); if (k !== ans) bs[k].classList.add('wrong');
              row.className = 'wl ' + (k === ans ? 'ok' : 'bad');
              fb.innerHTML = (k === ans ? '<b style="color:var(--ok)">Right:</b> ' : `<b style="color:var(--bad)">Not quite, it is level ${ans + 1}:</b> `) + ['one instruction stream, overlapped by the hardware.', 'one core taking turns among processes or threads.', 'one application spread over several cores at once.'][ans];
            } }, String(k + 1)));
            row.append(h('span', { class: 'bs' }, ...bs));
            return row;
          });
          const fb = h('p', { class: 'small m0', style: { minHeight: '21px' } }, 'Click 1, 2 or 3 for each situation.');
          function paint() {
            groups.forEach((g, i) => g.classList.toggle('dim', i !== cur));
            const l = LV[cur];
            det.replaceChildren(h('h3', { class: 'm0' }, l.t), h('p', { class: 'm0 small', html: '<b>What runs in parallel.</b> ' + l.what }), h('p', { class: 'm0 small', html: '<b>Who exploits it.</b> ' + l.who }));
          }
          build(); paint();
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'A multicore chip is an SMP on one piece of silicon, so everything so far still applies. The new challenge is to <b>put the parallelism to work</b>. It exists at three levels; pick one (or click the chip).' }),
              seg, h('div', { class: 'card white tight' }, svg)),
            h('div', { class: 'stack', style: { gap: '8px' } }, det, h('h4', { class: 'm0' }, 'Which level? Sort these'), ...rows, fb)));
        },
      },

      /* ---------------- 6. Explore: parallelism within applications (GCD) ---------------- */
      {
        title: 'Parallelism within applications: splitting the work',
        kind: 'explore',
        core: true, // on the shorter core path
        render(el, ctx) {
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;
          const WORK = 96; // 12 photos × 8 ms of filtering each
          const SPLITS = {
            one: { n: 1, len: 96, label: 'One big task', code: `
q = dispatch_get_global_queue(0, 0);   // a concurrent queue run by GCD
dispatch_async(q, ^{                   // hand GCD ONE block holding...
  for (int i = 0; i < 12; i++)         // ...a loop over all 12 photos,
    filter(photo[i]);                  // so it all runs on one thread
});                                    // end of the block` },
            photo: { n: 12, len: 8, label: 'A task per photo', code: `
q = dispatch_get_global_queue(0, 0);   // a concurrent queue run by GCD
for (int i = 0; i < 12; i++)           // for each of the 12 photos...
  dispatch_async(q, ^{                 // ...queue its own block
    filter(photo[i]);                  // (8 ms of work in each block)
  });                                  // the call returns at once` },
            tile: { n: 48, len: 2, label: 'A task per quarter photo', code: `
q = dispatch_get_global_queue(0, 0);   // a concurrent queue run by GCD
for (int i = 0; i < 12; i++)           // for each photo...
  for (int t = 0; t < 4; t++)          // ...and each quarter of it,
    dispatch_async(q, ^{               // queue a block: 48 in all,
      filter_tile(photo[i], t); });    // each doing 2 ms of work` },
          };
          let split = 'photo', cores = 4;
          const codeBox = h('div');
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 340 172' : '0 0 640 172', width: '100%', role: 'img', 'aria-label': 'Timeline of blocks running on the thread pool' });
          const kT = h('div', { class: 'v' }), kS = h('div', { class: 'v' }), kU = h('div', { class: 'v' });
          const say = h('p', { class: 'small m0', style: { minHeight: '40px' } });
          const segSplit = ctx.ui.seg(Object.entries(SPLITS).map(([k, v]) => ({ value: k, label: v.label })), split, (v) => { split = v; paint(); });
          const segCores = ctx.ui.seg([1, 2, 4, 8].map((c) => ({ value: c, label: c + (c === 1 ? ' core' : ' cores') })), cores, (v) => { cores = v; paint(); });
          function paint() {
            const sp = SPLITS[split];
            // on phones each comment moves onto its own line above the code it explains, so nothing scrolls sideways
            const src = !ctx.narrow ? sp.code : sp.code.split('\n').map((l) => {
              const i = l.indexOf('//');
              if (i < 0) return l;
              const c = l.slice(0, i).replace(/\s+$/, '');
              return c.match(/^\s*/)[0] + l.slice(i).trim() + '\n' + c;
            }).join('\n');
            codeBox.replaceChildren(ctx.ui.code(src, { lang: 'c', nums: false, fontSize: 13 }));
            // the pool has one worker thread per core; each block goes to the thread that frees up first
            const free = Array(cores).fill(0), placed = [];
            for (let k = 0; k < sp.n; k++) {
              let w = 0; for (let j = 1; j < cores; j++) if (free[j] < free[w]) w = j;
              placed.push({ k, w, t0: free[w] }); free[w] += sp.len;
            }
            const T = Math.max(...free), util = Math.round((WORK / (cores * T)) * 100);
            const X0 = ctx.narrow ? 60 : 68, SC = (ctx.narrow ? 272 : 564) / WORK, rowH = Math.min(34, 140 / cores);
            const kids = [];
            for (let r = 0; r < cores; r++) {
              const y = 6 + r * rowH;
              kids.push(s('rect', { x: X0, y, width: WORK * SC, height: rowH - 4, rx: 4, class: 's-panel', 'stroke-width': 1 }));
              kids.push(s('text', { x: X0 - 8, y: y + rowH / 2 + 3, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 'tx-thread' }, 'thread ' + r));
            }
            placed.forEach(({ k, w, t0 }) => {
              const photo = Math.floor((k * sp.len) / 8), y = 6 + w * rowH, wpx = sp.len * SC;
              kids.push(s('rect', { x: X0 + t0 * SC + 1, y: y + 1, width: wpx - 2, height: rowH - 6, rx: 3, class: photo % 2 ? 's-proc' : 's-thread', 'stroke-width': 1.5 }));
              if (wpx >= 30 && rowH >= 18) kids.push(s('text', { x: X0 + (t0 + sp.len / 2) * SC, y: y + rowH / 2 + 3, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, sp.n === 1 ? 'all 12 photos, one after another' : 'P' + (photo + 1)));
            });
            const axisY = 148;
            kids.push(s('line', { x1: X0, y1: axisY, x2: X0 + WORK * SC, y2: axisY, class: 's-line' }));
            [0, 24, 48, 72, 96].forEach((ms) => {
              kids.push(s('line', { x1: X0 + ms * SC, y1: axisY, x2: X0 + ms * SC, y2: axisY + 5, class: 's-line' }));
              kids.push(s('text', { x: X0 + ms * SC, y: axisY + 19, 'text-anchor': ms === WORK ? 'end' : ms ? 'middle' : 'start', 'font-size': 12.5, class: 'tx-muted' }, ms + ' ms'));
            });
            kids.push(s('line', { x1: X0 + T * SC, y1: 2, x2: X0 + T * SC, y2: axisY, style: 'stroke:var(--ok)', 'stroke-width': 2.5, 'stroke-dasharray': '5 4' }));
            svg.replaceChildren(...kids);
            kT.textContent = T + ' ms'; kS.textContent = ctx.util.fmt(WORK / T, 1) + '×'; kU.textContent = util + '%';
            let msg;
            if (cores === 1) msg = 'With one core every version takes 96 ms. Splitting only helps when there are cores to run the pieces.';
            else if (sp.n === 1) msg = `One big block can use only one thread, so ${cores - 1} of the ${cores} cores ${cores === 2 ? 'sits' : 'sit'} idle. The developer has not exposed any parallelism.`;
            else if (sp.n % cores) msg = `${sp.n} blocks on ${cores} threads: the last round is only partly full, so cores idle at the end (${util}% busy). Smaller tasks balance better.`;
            else msg = `${sp.n} blocks spread evenly over ${cores} threads: every core stays busy and the job is ${ctx.util.fmt(WORK / T, 0)}× faster than on one core. Same code, bigger machine, no changes.`;
            say.innerHTML = msg;
          }
          paint();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'Level 3, one program on many cores at once, needs work that can run in parallel. Three parties share that job:' }),
              h('div', { class: 'role' }, h('span', { class: 'chip thread' }, 'Developer'), h('span', {}, 'splits the application into tasks that can run independently.')),
              h('div', { class: 'role' }, h('span', { class: 'chip cpu' }, 'Compiler + language'), h('span', {}, 'make those tasks easy to express, e.g. blocks, closures, parallel loops.')),
              h('div', { class: 'role' }, h('span', { class: 'chip os' }, 'Operating system'), h('span', {}, 'allocates cores and other resources among the parallel tasks efficiently.')),
              h('div', { class: 'callout why m0', 'data-label': 'Real example: Grand Central Dispatch', html: 'On macOS and iOS, <span class="t">Grand Central Dispatch (GCD)</span> lets a developer wrap each independent piece of work in a <b>block</b> (code bundled with the values it uses) and put it on a dispatch queue. GCD feeds queued blocks to a <span class="t">thread pool</span> sized to the cores; the developer never creates or schedules a thread.' }),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'More cores cannot speed up one big task. The developer must expose the parallelism first.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'ctl-row' }, h('span', { class: 'b small' }, 'Developer’s split'), segSplit),
              h('div', { class: 'ctl-row' }, h('span', { class: 'b small' }, 'Machine'), segCores),
              codeBox,
              h('div', { class: 'card white tight' }, svg),
              h('div', { class: 'kpis' }, h('div', {}, h('div', { class: 'xs muted b' }, 'FINISHES AFTER'), kT), h('div', {}, h('div', { class: 'xs muted b' }, 'SPEEDUP VS 1 CORE'), kS), h('div', {}, h('div', { class: 'xs muted b' }, 'CORES BUSY'), kU)),
              say)));
        },
      },

      /* ---------------- 7. Compare: time slicing vs dedicated cores (virtual machine approach) ---------------- */
      {
        title: 'Time-slice every core, or dedicate cores?',
        kind: 'compare',
        render(el, ctx) {
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;
          const TICKS = 12, CORES = 8, PCLS = { A: 's-proc', B: 's-thread', C: 's-io', D: 's-cpu' };
          let mode = 'share';
          // grid[t][core] = the thread that core runs during time slice t.
          // Same workload in both modes: 12 runnable threads (A1..D3), each needing 8 slices = 96 core-slices,
          // which exactly fills 8 cores × 12 slices, so every thread finishes by slice 12 either way.
          function schedule(m) {
            const Q = [];
            for (let n = 1; n <= 3; n++) for (const P of 'ABCD') Q.push(P + n); // 12 runnable threads
            return Array.from({ length: TICKS }, (_, t) => Array.from({ length: CORES }, (_, k) => {
              if (m === 'share') return Q[(8 * t + k) % 12]; // one shared queue: each core takes the next thread in line
              // dedicated: process P owns cores 2j and 2j+1 and packs its three 8-slice threads onto them itself.
              // First core: P1 for slices 1-8, then P2's last 4. Second core: P2 for slices 1-4, then P3 for slices 5-12.
              const P = 'ABCD'[k >> 1];
              return P + ((k & 1) === 0 ? (t < 8 ? 1 : 2) : (t < 4 ? 2 : 3));
            }));
          }
          function stats(grid, upto) {
            let sw = 0, cold = 0;
            const last = {};
            for (let t = 0; t <= upto; t++) grid[t].forEach((th, k) => {
              if (t > 0 && grid[t - 1][k] !== th) sw++;
              if (last[th] !== k) cold++;
              last[th] = k;
            });
            return { sw, cold };
          }
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 340 250' : '0 0 640 250', width: '100%', role: 'img', 'aria-label': 'Eight cores over twelve time slices' });
          const kSw = h('div', { class: 'v' }), kCold = h('div', { class: 'v' }), kOS = h('div', { class: 'v' }), kWork = h('div', { class: 'v' });
          const X0 = ctx.narrow ? 50 : 62, CW = ctx.narrow ? 23.8 : 47, RH = 21;
          function draw(i) {
            const grid = schedule(mode), kids = [];
            for (let t = 0; t < TICKS; t++) kids.push(s('text', { x: X0 + t * CW + CW / 2, y: 13, 'text-anchor': 'middle', 'font-size': 12.5, class: t <= i ? '' : 'tx-muted', 'font-weight': t === i ? 800 : 400 }, 't' + (t + 1)));
            for (let k = 0; k < CORES; k++) {
              const y = 20 + k * RH;
              kids.push(s('text', { x: X0 - 8, y: y + 14.5, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 'tx-cpu' }, 'core ' + k));
              for (let t = 0; t < TICKS; t++) {
                const th = grid[t][k], x = X0 + t * CW;
                if (t > i) { kids.push(s('rect', { x: x + 1, y: y + 1, width: CW - 2, height: RH - 3, rx: 3, class: 's-panel', 'stroke-width': 1 })); continue; }
                kids.push(s('rect', { x: x + 1, y: y + 1, width: CW - 2, height: RH - 3, rx: 3, class: PCLS[th[0]], 'stroke-width': 1.5 }));
                kids.push(s('text', { x: x + CW / 2, y: y + 14.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, th));
                if (t > 0 && grid[t - 1][k] !== th) kids.push(s('line', { x1: x, y1: y, x2: x, y2: y + RH - 1, style: 'stroke:var(--bad)', 'stroke-width': 3 }));
              }
            }
            // memory: interleaved pages versus one block per process
            const my = 20 + CORES * RH + 16;
            kids.push(s('text', { x: X0 - 8, y: my + 17, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 'tx-mem' }, ctx.narrow ? 'RAM' : 'memory'));
            if (mode === 'share') {
              const pat = 'ABCADBCDBACDCABD';
              [...pat].forEach((p, j) => kids.push(s('rect', { x: X0 + j * (CW * TICKS / 16) + 1, y: my + 2, width: CW * TICKS / 16 - 2, height: 22, rx: 3, class: PCLS[p], 'stroke-width': 1 })));
              kids.push(s('text', { x: ctx.narrow ? 4 : X0, y: my + 44, 'font-size': 12.5, class: 'tx-muted' }, ctx.narrow ? 'pages of all processes mixed in one pool' : 'pages of every process mixed in one shared pool'));
            } else {
              'ABCD'.split('').forEach((p, j) => {
                kids.push(s('rect', { x: X0 + j * (CW * 3) + 1, y: my + 2, width: CW * 3 - 2, height: 22, rx: 4, class: PCLS[p], 'stroke-width': 1.5 }));
                kids.push(s('text', { x: X0 + j * CW * 3 + CW * 1.5, y: my + 17.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, 'process ' + p));
              });
              kids.push(s('text', { x: ctx.narrow ? 4 : X0, y: my + 44, 'font-size': 12.5, class: 'tx-muted' }, ctx.narrow ? 'each process gets its own block of memory' : 'the OS hands each process its own block of memory, like a hypervisor'));
            }
            svg.replaceChildren(...kids);
            const st = stats(grid, i), other = stats(schedule('share'), i);
            kSw.textContent = st.sw; kCold.textContent = st.cold;
            // time slicing runs the OS scheduler on every core at every slice; dedicated cores are loaded once,
            // and after that each process switches among its own threads on its own cores
            kOS.textContent = mode === 'share' ? String(CORES * (i + 1)) : String(CORES);
            kWork.textContent = `${CORES * (i + 1)} / ${CORES * TICKS}`; // identical in both modes: the same work gets done
            if (mode === 'share') {
              if (i === 0) return '<b>Slice 1.</b> Twelve threads (three each from processes A to D), each needing 8 slices of work, want eight cores. The OS loads eight; four wait in the shared ready queue.';
              if (i < TICKS - 1) return `<b>Slice ${i + 1}.</b> The timer fires on every core. Each saves its thread, runs the scheduler and loads another: 8 more context switches (red marks), and every thread starts on a core whose cache holds other threads’ data: a cold start.`;
              return `<b>After 12 slices:</b> every thread got its 8 slices (96 core-slices of work), at a cost of ${st.sw} context switches and ${st.cold} cold-cache starts. Every core lost part of every slice to switching.`;
            }
            if (i === 0) return '<b>Slice 1.</b> Like a hypervisor, the OS gives each process two whole cores and a block of memory, then steps back. Each process runs the same three threads on its own two cores: A1 and A2 start, A3 waits.';
            if (i === 4) return '<b>Slice 5.</b> Each process parks its second thread and starts its third (red marks), so all three can still finish by slice 12. The switch stays inside one process, with no change of address space, so it is cheaper.';
            if (i === 8) return '<b>Slice 9.</b> The first threads have had their 8 slices, so each process gives that core to its parked second thread for its last 4 slices. It changed cores, so it restarts with a cold cache.';
            if (i < TICKS - 1) return `<b>Slice ${i + 1}.</b> Nothing to decide. Every core keeps running the same thread of the same process: no context switch, and its caches stay warm.`;
            return `<b>After 12 slices:</b> the same 96 core-slices of work are done, with ${st.sw} context switches (all inside a process) and ${st.cold} cold starts instead of ${other.sw} and ${other.cold}. The OS itself scheduled only the first 8 loads.`;
          }
          const player = ctx.ui.player({ count: TICKS, render: draw, interval: 900, captionBelow: true });
          const seg = ctx.ui.seg([{ value: 'share', label: 'Time-slice every core' }, { value: 'dedicate', label: 'Dedicate cores (virtual machine approach)' }], mode, (v) => { mode = v; player.stop(); player.go(player.index === 0 ? TICKS - 1 : player.index); }); // same slice in both modes, so the numbers compare directly
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'With a few cores, the classic OS job is <span class="t">time slicing</span>: each core is shared among many threads, switching every few milliseconds.' }),
              h('p', { class: 'm0', html: 'With dozens of cores there are enough to go round. That suggests the <span class="t">virtual machine approach</span>: dedicate one or more cores to a process and <b>leave them alone</b>, so each core devotes itself to that process.' }),
              h('p', { class: 'm0', html: 'The OS then allocates <b>cores and memory</b> rather than slices of time, acting more like a <span class="t">hypervisor</span>. Each process decides how to use what it was given, as a virtual machine would.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why it helps', html: 'Each <span class="t">context switch</span> costs time to save and load registers, and the newcomer then runs slowly while the caches refill. Fewer switches, more real work.' }),
              h('div', { class: 'callout warn m0', 'data-label': 'Trade-off', html: 'A dedicated core that its process leaves idle, say while it waits for the disk, is wasted. It pays off when cores are plentiful.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              seg,
              h('div', { class: 'card white tight' }, svg),
              h('div', { class: 'kpis k4' }, h('div', {}, h('div', { class: 'xs muted b' }, 'CONTEXT SWITCHES'), kSw), h('div', {}, h('div', { class: 'xs muted b' }, 'COLD-CACHE STARTS'), kCold), h('div', {}, h('div', { class: 'xs muted b' }, 'OS SCHEDULER RUNS'), kOS), h('div', {}, h('div', { class: 'xs muted b' }, 'WORK DONE'), kWork)),
              player.el)));
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: eight ideas to carry with you',
        kind: 'recap',
        render(el, ctx) {
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Then flip it to check.'),
            ctx.ui.flipcards([
              ['What is self-scheduling in an SMP?', 'No boss processor: each processor runs the scheduler itself and takes its next process or thread from a shared pool.'],
              ['Two dangers of one shared ready queue?', '<span>Two processors pick the <b>same</b> process, or a process is <b>lost</b> from the queue. A lock around the queue code prevents both.</span>'],
              ['Why must kernel routines be reentrant?', 'Several processors can run the same routine at the same moment. Reentrant code keeps each caller’s data separate, so the calls cannot corrupt each other.'],
              ['The five SMP design issues?', 'Simultaneous concurrent processes or threads · Scheduling · Synchronization · Memory management · Reliability and fault tolerance.'],
              ['What must the OS do when a processor fails?', 'Recognize the loss and restructure its management tables, so it degrades gracefully instead of losing work or hanging.'],
              ['The three levels of multicore parallelism?', 'Inside each core (ILP) · within each core over time (multiprogramming and multithreading) · one application across several cores.'],
              ['Who makes parallelism within applications work?', 'The developer splits the work, compilers and languages help express it, and the OS allocates resources (for example GCD’s thread pool).'],
              ['What is the virtual machine approach?', 'Dedicate whole cores and memory to a process and leave them alone. The OS acts like a hypervisor, and context switches nearly vanish.'],
            ], { cols: 4, height: 184 }),
            h('div', { class: 'callout tip m0', 'data-label': 'One sentence to remember', html: 'An SMP or multicore OS is still one OS, but it can no longer assume it is alone: every shared table needs protection, every processor schedules itself, and the real prize is getting applications to use all those cores.' })));
        },
      },

      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In a typical symmetric multiprocessor (SMP), how does a processor that needs work get its next process or thread?',
            choices: ['A master processor assigns it one', 'It runs the kernel’s scheduler itself and takes one from a shared pool', 'The user chooses a processor for each program', 'Each processor has a fixed list of processes decided at boot time'], answer: 1,
            feedback: ['That is a master/worker design; in an SMP no processor is the boss.', null, 'The OS makes this choice every time; users normally never think about which processor runs their program.', 'A fixed list would leave some processors idle while others are overloaded.'],
            why: 'This is self-scheduling: the kernel can run on any processor, and each processor schedules itself from the pool of available processes or threads.' },
          { type: 'multi', q: 'Several processors of an SMP take work from one shared ready queue. Which statements are true?',
            choices: ['Without a lock, two processors can choose the same process', 'Without a lock, a process can be skipped and never run', 'Disabling interrupts on the processor running the scheduler is enough to protect the queue', 'Checking and taking a spinlock must be one atomic (indivisible) hardware instruction', 'The hardware automatically makes the read-the-front, then-advance sequence indivisible'], answer: [0, 1, 3],
            why: 'If two processors read the front before either advances it, both take the same process and the double advance skips the next one. Disabling interrupts only affects one processor, and the hardware does not bundle a multi-step sequence by itself; a lock built on an atomic instruction such as test-and-set does.' },
          { type: 'match', q: 'Match each SMP design issue to a situation it covers.',
            pairs: [['Simultaneous concurrent processes or threads', 'Two CPUs execute the same kernel routine at once'], ['Scheduling', 'Threads of one process run on different CPUs together'], ['Synchronization', 'Two threads on different CPUs update a shared counter'], ['Memory management', 'Page replacement for a page two CPUs share'], ['Reliability and fault tolerance', 'Carrying on after one processor fails']],
            why: 'Concurrent kernel code needs reentrancy and protected tables; scheduling must avoid conflicts and can run a process’s threads in parallel; synchronization protects shared memory and I/O; memory management coordinates paging; reliability means graceful degradation.' },
          { type: 'tf', q: 'A kernel routine that keeps its working data in one global variable is safe on an SMP, provided the routine is short.', answer: false,
            why: 'However short it is, two processors can be inside it at the same moment and overwrite each other’s data. It must be reentrant (data on each caller’s own stack) or guarded by a lock.' },
          { type: 'tf', q: 'With kernel-level threads, an SMP scheduler can run several threads of the same process on different processors at the same moment.', answer: true,
            why: 'The kernel sees and schedules each thread separately, so it can place threads of one process on several processors at once, which is how a multithreaded program gets faster.' },
          { q: 'CPU 0’s memory manager wants to evict a page that a process on CPU 1 is still using through a shared mapping. What should an SMP memory manager do?',
            choices: ['Evict it at once; CPU 1 will notice eventually', 'Coordinate with the other processors: avoid removing a page in use, and make every processor forget its saved location before the frame is reused', 'Copy the page into CPU 0’s registers', 'Shut CPU 1 down before evicting'], answer: 1,
            feedback: ['CPU 1 would go on reading the frame after it holds someone else’s data.', null, 'A page is thousands of bytes; registers hold a few values and this solves nothing.', 'Far too drastic; the processors only need to coordinate.'],
            why: 'Paging mechanisms on different processors must be coordinated so shared pages stay consistent and replacement never pulls a page out from under a processor that is using it.' },
          { type: 'num', q: 'An SMP has 8 equally fast processors. Two of them fail, and the OS recognizes the loss and restructures its tables. What percentage of the original processing capacity remains?', answer: 75, tol: 0.5, unit: '%',
            why: '6 working processors out of 8 is 6 ÷ 8 = 0.75, so 75% remains. That proportional loss, rather than a crash, is graceful degradation.' },
          { type: 'bucket', q: 'Which level of multicore parallelism does each situation show?', buckets: ['1: in a core', '2: over time', '3: across cores'],
            items: [['Pipeline overlaps fetch and execute', 0], ['OS swaps one core between two apps', 1], ['Game threads run on two cores at once', 2], ['Two independent adds in one clock cycle', 0], ['Another thread runs during a disk wait', 1], ['Encoder spreads a frame over four cores', 2]],
            why: 'ILP overlaps instructions of one stream inside a core; multiprogramming and multithreading share one core over time; the third level splits one application across cores.' },
          { q: 'With Grand Central Dispatch on macOS or iOS, what does the application developer do?',
            choices: ['Creates one thread per core and schedules them by hand', 'Wraps independent pieces of work in blocks and places them on dispatch queues', 'Writes a new scheduler for the kernel', 'Pins each block to a particular core number'], answer: 1,
            feedback: ['That is exactly the work GCD takes off the developer’s hands.', null, 'GCD is used by ordinary applications; nobody rewrites the kernel.', 'GCD decides where blocks run, using a pool sized to the available cores.'],
            why: 'The developer marks what can run in parallel; GCD keeps a thread pool sized to the cores and feeds it the queued blocks.' },
          { type: 'num', q: 'A program queues 12 independent tasks of 8 ms each. A thread pool of 8 threads runs on 8 cores, and each task goes to the next free thread. How many milliseconds until every task has finished?', answer: 16, tol: 0, unit: 'ms',
            why: 'The first round runs 8 tasks (8 ms); the remaining 4 need a second round (8 ms more). 8 + 8 = 16 ms, with half the cores idle in the second round.' },
          { q: 'In the virtual machine approach to multicore, what does the OS mainly hand out?',
            choices: ['Short time slices on each core', 'Whole cores and blocks of memory, like a hypervisor', 'Individual instructions to pipeline stages', 'Disk blocks to files'], answer: 1,
            feedback: ['That is the classic time-slicing approach this idea moves away from.', null, 'The hardware does that inside each core; the OS never sees it.', 'That is file management, not processor allocation.'],
            why: 'With plenty of cores, the OS dedicates cores (and memory) to a process and leaves them alone, acting more like a hypervisor than a time-slicer.' },
          { q: 'Why does dedicating cores to processes usually improve performance?',
            choices: ['It removes the need for main memory', 'It cuts context switches, so less time is spent switching and caches stay warm', 'It raises each core’s clock speed', 'It lets two processes share one set of registers'], answer: 1,
            feedback: ['Processes still need memory; the OS allocates it to them.', null, 'Clock speed is set by the hardware, not by the scheduling policy.', 'Sharing registers between processes would corrupt both of them.'],
            why: 'Each context switch costs time directly and leaves the caches cold. A core devoted to one process rarely switches, so more of its time goes to useful work.' },
        ],
      },

    ],

    notes: `
<h3>Why several processors change the operating system</h3>
<p>On a uniprocessor at most one piece of kernel code executes at any instant, and the kernel can guard a table just by briefly disabling interrupts. In a <b>symmetric multiprocessor (SMP)</b> the kernel can execute on <b>any</b> processor, and disabling interrupts on one processor does nothing to stop the others, so shared kernel data needs <b>locks</b>. Usually no processor is in charge: each does <b>self-scheduling</b>, running the scheduler itself to take its next process or thread from a shared pool. The kernel can also be built as several processes or threads that run in parallel.</p>
<p>The OS must ensure that no two processors choose the same process and that no process is lost from the queue.</p>

<h3>The race on a shared ready queue</h3>
<pre>acquire(lock);        // spin until free, then take it
next = ready[front];  // read the front entry
front = front + 1;    // step past that entry
release(lock);        // let another CPU in
run(next);            // run the chosen process</pre>
<p><b>Without the lock</b> the result depends on timing: a <b>race condition</b>. CPU 0 reads ready[0] = P1, CPU 1 also reads P1, then CPU 0 sets front = 1 and CPU 1 sets front = 2. P1 now runs on two processors at once, both using its one saved context and stack, and P2 is skipped (lost). A lucky order hides the bug; it does not fix it.</p>
<p><b>With the lock</b>, read-and-advance is indivisible: while one CPU is inside, the others wait, so every process is taken exactly once. It is a <b>spinlock</b> (a waiting CPU loops until the lock is free), cheap because the protected code is short. Checking and taking the lock is one <b>atomic</b> hardware instruction, such as test-and-set, so two CPUs can never both grab it.</p>

<h3>The five key design issues of an SMP OS</h3>
<table>
  <tr><th>Issue</th><th>What the OS must handle</th><th>Example and fix</th></tr>
  <tr><td>1. Simultaneous concurrent processes or threads</td><td>Several processors may run the same kernel routine at once. Kernel routines must be <b>reentrant</b>, and kernel tables must be managed so simultaneous use cannot corrupt them or cause invalid operations.</td><td>A global scratch buffer makes one call open the wrong file. Fix: per-call data on each caller's own kernel stack, plus a lock on the shared table.</td></tr>
  <tr><td>2. Scheduling</td><td>Any processor may schedule, so conflicts must be avoided (no two pick the same process). With kernel-level threads, several threads of one process can run on different processors at the same time.</td><td>Three ready threads on three free CPUs finish in 1 slot instead of 3.</td></tr>
  <tr><td>3. Synchronization</td><td>Processes may share address spaces or I/O resources, so the OS must provide mutual exclusion and event ordering. Locks are the most common tool.</td><td>Two threads each sell a seat: both read 10 and write 9, so one sale is lost. With a lock: 10, 9, 8.</td></tr>
  <tr><td>4. Memory management</td><td>All uniprocessor duties, plus exploiting hardware parallelism (e.g. multiported memory serving several processors at once) and coordinating paging across processors, so shared pages stay consistent and replacement is safe.</td><td>Each CPU caches recent page locations. CPU 0 evicts shared page 7 while CPU 1 still uses it, so CPU 1 reads another process's data. Fix: replacement considers all CPUs, and every CPU forgets the page's location before its frame is reused.</td></tr>
  <tr><td>5. Reliability and fault tolerance</td><td>Degrade gracefully when a processor fails: the scheduler and the rest of the OS must recognize the loss and restructure their management tables.</td><td>See the worked example below.</td></tr>
</table>

<h3>Graceful degradation: a worked example</h3>
<p>Twelve jobs each need 4 units of work (48 units), and each job saves a checkpoint after every finished unit. With 4 processors the batch takes 48 / 4 = <b>12 ticks</b>. Suppose CPU 2 dies after tick 3 while running J3 (3 units done). The OS notices the missed <b>heartbeat</b> (each processor regularly checks in; a silent one is declared failed), marks CPU 2 <b>offline</b>, stops scheduling on it and requeues J3, which resumes from its checkpoint (without one it would restart from the beginning). Three processors finish at tick 16. Capacity falls to 3 / 4 = 75%, but every job completes.</p>
<p>An OS that ignores the loss still lists CPU 2 as online and running J3, so J3 never finishes (11 of 12 done). <b>Rule of thumb:</b> remaining capacity = working processors ÷ total processors; 2 failures out of 8 leave 6 / 8 = 75%.</p>

<h3>Multicore: exploiting the parallelism</h3>
<p>A multicore chip is an SMP on one piece of silicon, so every SMP issue above still applies. The extra challenge is to <b>exploit the available parallelism effectively</b>. It exists at three levels:</p>
<ol>
  <li><b>Hardware parallelism within each core</b>: instruction-level parallelism (ILP). A pipeline overlaps several instructions from one stream, and many cores start more than one per cycle. The hardware exploits it (compilers help), not the OS.</li>
  <li><b>Multiprogramming and multithreaded execution within each core</b>: one core is shared over time among several processes and threads. The OS scheduler handles this, separately for every core.</li>
  <li><b>One application running as concurrent processes or threads across several cores</b>: the hardest level, needing the developer, language tools and the OS to cooperate.</li>
</ol>

<h3>Parallelism within applications</h3>
<ul>
  <li>The <b>developer</b> decides how to split the application into tasks that can run independently.</li>
  <li><b>Compilers and programming languages</b> make those tasks easy to express (blocks, closures, parallel loops).</li>
  <li>The <b>OS</b> allocates resources, such as cores, among the parallel tasks efficiently.</li>
</ul>
<p><b>Grand Central Dispatch (GCD)</b> on macOS and iOS is a real example. The developer wraps each independent piece of work in a block and adds it to a dispatch queue (e.g. with dispatch_async). GCD keeps a <b>thread pool</b> sized to the available cores and feeds it the queued blocks; the developer never creates or schedules a thread.</p>
<p><b>Worked example.</b> Filtering 12 photos takes 8 ms each, 96 ms of work. As one big task it takes 96 ms however many cores exist. As 12 tasks: time = (12 ÷ cores, rounded up) × 8 ms, so 48 ms on 2 cores, 24 ms on 4 and 16 ms on 8 (the second round is half empty: 75% busy). As 48 quarter-photo tasks of 2 ms, 8 cores finish in 48 ÷ 8 × 2 = 12 ms with every core busy. Smaller tasks balance better, though each task also carries a small scheduling cost.</p>

<h3>The virtual machine approach</h3>
<p>With few cores, the classic OS job is <b>time slicing</b>: a timer forces a <b>context switch</b> on each core every few milliseconds. Each switch costs time to save and load registers, and the newcomer runs slowly while the caches refill.</p>
<p>With many cores there are enough to go round. The <b>virtual machine approach</b> dedicates one or more whole cores to a process and leaves them alone. The OS allocates <b>cores and memory</b> instead of time slices, much like a <b>hypervisor</b> handing resources to virtual machines, and each process decides how to use what it got. Context-switch overhead almost disappears.</p>
<p><b>Example (the same work both ways).</b> Processes A to D have 3 runnable threads each (12 threads), and every thread needs 8 slices of work: 12 × 8 = 96 core-slices, which exactly fills 8 cores for 12 slices. <b>Time slicing</b> from one shared queue: every core switches at every slice boundary, 8 × 11 = <b>88 context switches</b>, and because each thread comes back on a different core, all 96 runs start with a cold cache. The OS scheduler runs 8 × 12 = 96 times. <b>Dedicated cores:</b> each process gets 2 cores and shares them among its own 3 threads. Three 8-slice threads fit on two 12-slice cores only if one thread is split, so the first core runs thread 1 for slices 1 to 8 and then thread 2's last 4 slices, while the second core runs thread 2 for slices 1 to 4 and then thread 3 for slices 5 to 12. Every thread still gets its 8 slices and all finish by slice 12, but there are only 2 switches per process, <b>8 in all</b>, each between threads of the same process (no change of address space, so cheaper), and 16 cold starts (the 8 first loads, the 4 third threads starting, and the 4 second threads that changed cores). The OS scheduler ran only for the 8 first loads. <b>Trade-off:</b> a dedicated core that its process leaves idle (say, waiting for I/O) is wasted, so the approach pays off when cores are plentiful.</p>
`,
  });
})();
