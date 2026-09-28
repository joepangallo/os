// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.6 — OS Design Considerations for Multiprocessor and Multicore
   Original teaching material, built step by step.
   Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // an IIFE (a function that is defined and run at once) wraps the whole file so its helper names stay private
  /* ------------------------------------------------------------------ shared helpers */
  // a clickable SVG group that works with mouse, keyboard and scripted checks
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(...): wraps SVG shapes in one clickable group; onAct runs on a click, and label is read aloud by screen readers
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // builds the group: class hot gives the pointer cursor, tabindex 0 lets the Tab key reach it, role button names it as one
    g.addEventListener('click', onAct);  // a mouse click (or tap) runs the action
    // SVG elements have no .click(); automated checks send synthetic pointer events, so accept those too
    g.addEventListener('pointerdown', (e) => { if (!e.isTrusted) onAct(); });  // pointerdown events sent by a script rather than a person (isTrusted is false) also run the action, so automated checks can click it
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // pressing Enter or Space while the group has keyboard focus runs the action too, like a real button
    return g;  // hands the finished group back to the caller
  }  // ends hotGroup()
  // multi-line SVG text: lines is a string or an array of strings (one tspan per line)
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {  // mtext(...): SVG text over several lines at x, y; lines is one string or a list, attrs holds extra settings, lh is the line spacing
    const t = s('text', Object.assign({ x, y }, attrs));  // creates the text element at the given position with any extra attributes
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // adds one tspan (a line piece of SVG text) per line, each moved down by lh after the first
    return t;  // hands the finished text back to the caller
  }  // ends mtext()

  Guide.section({  // registers section 2.6 with the guide; this object holds its title, glossary, styles, steps, quiz and notes
    id: '2.6',  // id: the section number, used in links, saved progress and labels
    title: 'OS Design Considerations for Multiprocessor and Multicore',  // title: the full section name shown at the top of every step
    short: 'Multiprocessor OS design',  // short: the shorter name used in the table of contents
    summary: 'What changes when one OS runs many processors or cores: SMP kernel design issues and multicore parallelism.',  // summary: one-sentence preview shown on the chapter's section list
    objectives: [  // objectives: the learning goals listed on the section's opening screen
      'Explain what it means for an SMP kernel to run on any processor, with each processor scheduling itself from a shared pool, and why that risks two processors picking the same process or a process being lost.',  // goal 1: explain SMP self-scheduling and its two risks, a process picked twice or lost
      'Name and explain the five key design issues of an SMP operating system: simultaneous concurrent processes or threads, scheduling, synchronization, memory management, and reliability and fault tolerance.',  // goal 2: name and explain the five key design issues of an SMP operating system
      'Show how locks and reentrant kernel code prevent races, and how an SMP OS degrades gracefully when a processor fails.',  // goal 3: show how locks and reentrant code prevent races, and how the OS survives a dead processor
      'Describe the three levels of parallelism in a multicore system and who exploits each one, including how developers, languages and the OS (for example Grand Central Dispatch) share the work of parallelism within applications.',  // goal 4: describe the three levels of multicore parallelism and who exploits each
      'Explain the virtual machine approach to multicore: dedicating cores to a process, the OS acting like a hypervisor, and why this cuts context-switch overhead.',  // goal 5: explain the virtual machine approach of dedicating cores to a process
    ],  // closes the objectives list
    terms: [  // terms: the glossary for this section; each pair is [term, definition] and powers the dotted-word pop-ups
      ['Symmetric multiprocessor (SMP)', 'A computer with two or more similar processors that share main memory and I/O devices and are run by one operating system; any processor can do any job, including running the kernel.'],  // glossary entry: defines a symmetric multiprocessor (SMP)
      ['Self-scheduling', 'The usual SMP arrangement with no boss processor: whenever a processor needs work, it runs the kernel’s scheduler itself and takes its next process or thread from a shared pool.'],  // glossary entry: defines self-scheduling, each processor choosing its own next job
      ['Ready queue', 'The OS list of processes or threads that are ready to run and are waiting only for a processor (the short-term queue of section 2.3). In a simple SMP design every processor takes work from one shared ready queue.'],  // glossary entry: defines the ready queue
      ['Race condition', 'A bug in which the result depends on the exact timing of two or more processors or threads using shared data at the same time. Some orders work, others corrupt the data.'],  // glossary entry: defines a race condition
      ['Lock', 'A shared marker that at most one processor or thread can hold at a time. Code takes the lock before touching a shared structure and releases it afterwards, so two updates can never overlap.'],  // glossary entry: defines a lock
      ['Spinlock', 'A lock where a processor that finds it taken keeps re-checking in a tight loop (it spins) until the holder releases it. The check-and-take is one atomic (indivisible) hardware instruction, such as test-and-set, so two processors can never both grab it. SMP kernels use spinlocks to guard short stretches of code.'],  // glossary entry: defines a spinlock and the atomic instruction behind it
      ['Reentrant code', 'Code that several processors or threads can be executing at the same moment without interfering, because it never modifies itself and keeps each caller’s working data separate, for example on that caller’s own stack.'],  // glossary entry: defines reentrant code
      ['Kernel-level thread', 'A thread that the kernel itself knows about and schedules. Because the kernel sees each one, it can run several threads of the same process on different processors at the same moment.'],  // glossary entry: defines a kernel-level thread
      ['Synchronization', 'Coordinating processes or threads that run at the same time so they use shared memory and devices in a safe order: one at a time where needed, and in the right sequence when one depends on another.'],  // glossary entry: defines synchronization
      ['Page', 'A fixed-size block (commonly 4 KB) of a process’s memory. The OS can place each page in any free slot of main memory, or move it out to disk when memory runs short.'],  // glossary entry: defines a page of memory
      ['Shared page', 'A page that belongs to the address spaces of two or more processes at once, so they all see the same data, for example shared library code or a shared buffer.'],  // glossary entry: defines a shared page
      ['Page replacement', 'The OS decision about which page to move out of main memory to disk when room is needed for another page.'],  // glossary entry: defines page replacement
      ['Graceful degradation', 'Losing capacity in proportion to what failed instead of crashing: when one of four processors dies, the system carries on at about three quarters of its former speed.'],  // glossary entry: defines graceful degradation
      ['Instruction-level parallelism (ILP)', 'Overlap among the instructions of one instruction stream inside a single core, for example a pipeline working on several instructions at different stages at once. The hardware finds and exploits it.'],  // glossary entry: defines instruction-level parallelism (ILP)
      ['Grand Central Dispatch (GCD)', 'Apple’s mechanism on macOS and iOS for parallelism within applications: a program packages work as small tasks placed on dispatch queues, and the system runs them on a pool of threads sized to the available cores.'],  // glossary entry: defines Grand Central Dispatch (GCD)
      ['Thread pool', 'A set of worker threads created in advance that repeatedly take tasks from a queue and run them, so a program does not have to create a new thread for every piece of work.'],  // glossary entry: defines a thread pool
      ['Context switch', 'Saving the registers and state of whatever is running on a processor and loading those of another process or thread. It costs time directly, and afterwards the newcomer runs slowly until the caches refill with its data.'],  // glossary entry: defines a context switch and its hidden cache cost
      ['Time slicing', 'Sharing one processor among several processes or threads by letting each run for a short interval in turn, with a timer interrupt forcing each switch.'],  // glossary entry: defines time slicing
      ['Hypervisor', 'Software that creates and runs virtual machines. It hands each machine a share of the real hardware, such as processor cores and blocks of memory, and keeps the machines isolated from one another.'],  // glossary entry: defines a hypervisor
      ['Virtual machine approach', 'A multicore OS strategy: instead of time-slicing every core among many processes, dedicate one or more whole cores (plus memory) to a process for a long period and let the process use them as it likes, so the OS behaves more like a hypervisor handing out resources.'],  // glossary entry: defines the virtual machine approach to multicore
    ],  // closes the glossary list

    css: ` /* css: style rules added only for this section; every rule starts with .sec-2-6 so it cannot affect other sections */
      /* shell workaround: the long section title in the nowrap eyebrow would otherwise widen the page on phones */
      .sec-2-6 .step-eyebrow { contain: inline-size; } /* stops the long section title in the step's heading line from making the page wider than a phone-width screen */
      .sec-2-6 .hot { cursor: pointer; outline: none; } /* .hot: the clickable level groups in the step 5 chip drawing get a pointer cursor; the browser's default focus box is turned off */
      .sec-2-6 .hot .fr { transition: stroke-width .12s; } /* makes the outline of a .fr frame inside a clickable group thicken smoothly (no drawing here uses .fr at present) */
      .sec-2-6 .hot:hover .fr, .sec-2-6 .hot:focus-visible .fr { stroke-width: 3.5; } /* thickens that frame while the mouse is over the group or it has keyboard focus */
      .sec-2-6 .tx-cpu { fill: var(--cpu); } .sec-2-6 .tx-mem { fill: var(--mem); } .sec-2-6 .tx-io { fill: var(--io); } /* tx- classes color SVG text: processor, memory and I/O colors */
      .sec-2-6 .tx-os { fill: var(--os); } .sec-2-6 .tx-proc { fill: var(--proc); } .sec-2-6 .tx-thread { fill: var(--thread); } /* more text colors: OS, process and thread colors */
      .sec-2-6 .tx-ok { fill: var(--ok); } .sec-2-6 .tx-bad { fill: var(--bad); } .sec-2-6 .tx-warn { fill: var(--warn); } /* more text colors: green for good, red for bad, yellow for warning */
      .sec-2-6 .tx-muted { fill: var(--muted); } .sec-2-6 .tx-accent { fill: var(--accent); } /* more text colors: grey for secondary text and the accent color */
      /* race lab: dispatcher code with one marker per CPU */
      .sec-2-6 .dcode { background: var(--panel-3); border: 1px solid var(--line); border-radius: 10px; padding: 5px 0; } /* .dcode: the grey box holding the dispatcher code in the race lab (step 2) */
      .sec-2-6 .dl { display: grid; grid-template-columns: 84px 168px minmax(0, 1fr); align-items: center; gap: 6px; padding: 2px 10px 2px 6px; border-left: 4px solid transparent; min-height: 31px; } /* .dl: one code line in that box, three columns: CPU markers, the code, and its explanation */
      .sec-2-6 .dl.dim { opacity: .38; } /* .dim: the lock lines fade out when the lock is switched off, since they are skipped */
      .sec-2-6 .dl.cur { background: color-mix(in srgb, var(--cpu) 10%, transparent); border-left-color: var(--cpu); } /* .cur: a line that some CPU will run next gets a tint and a colored left edge */
      .sec-2-6 .dl code { background: none; padding: 0; font-size: 13.5px; font-weight: 700; } /* the code text in a line, plain and bold, without the usual code background */
      .sec-2-6 .dl .cm { color: var(--muted); font-size: 13px; line-height: 1.25; } /* .cm: the explanation beside each code line, smaller and grey */
      .sec-2-6 .mk { display: flex; gap: 3px; } /* .mk: the row of CPU number badges at the start of a line */
      .sec-2-6 .mk b { display: inline-grid; place-items: center; width: 19px; height: 19px; border-radius: 5px; font-size: 12.5px; background: var(--cpu); color: var(--panel); } /* one CPU badge: a small colored square holding the CPU's number */
      .sec-2-6 .mk b.spin { background: var(--warn); } /* a badge turns yellow when that CPU just spun because the lock was taken */
      .sec-2-6 .log .ok { color: var(--ok); } .sec-2-6 .log .bad { color: var(--bad); font-weight: 700; } .sec-2-6 .log .warn { color: var(--warn); } /* log lines: green for good news, bold red for damage, yellow for warnings */
      /* design-issue explorer */
      .sec-2-6 .iss { display: grid; grid-template-columns: 28px minmax(0, 1fr) 16px; align-items: center; gap: 8px; text-align: left; padding: 7px 9px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; color: var(--ink); font: inherit; font-size: 14.5px; font-weight: 700; line-height: 1.2; min-height: 50px; } /* .iss: one of the five design-issue tiles in step 3: number, name and a tick once visited */
      .sec-2-6 .iss:hover { border-color: var(--os); } /* a tile's border takes the OS color while the mouse is over it */
      .sec-2-6 .iss .n { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: var(--os-bg); color: var(--os); font-weight: 900; } /* the rounded number square at the start of a tile */
      .sec-2-6 .iss.on { border-color: var(--os); background: var(--os-bg); } /* the selected tile is outlined and tinted in the OS color */
      .sec-2-6 .iss.on .n { background: var(--os); color: var(--panel); } /* the selected tile's number square turns solid */
      .sec-2-6 .iss .ck { color: var(--ok); font-weight: 900; } /* the green tick marking a tile the student has already opened */
      .sec-2-6 .iss-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; } /* .iss-grid: the five tiles in one row */
      /* phone layout (the step body gets class "nar" in narrow mode) */
      .sec-2-6 .nar .iss-grid { grid-template-columns: 1fr 1fr; } /* on phone-width screens (.nar) the tiles sit two per row */
      .sec-2-6 .nar .dl { grid-template-columns: 70px minmax(0, 1fr); row-gap: 0; padding-top: 4px; padding-bottom: 4px; } /* on phone-width screens a code line has two columns; its explanation drops under the code */
      .sec-2-6 .nar .dl .cm { grid-column: 2; } /* puts the explanation in the second column, under the code */
      .sec-2-6 .nar .ctl-row { grid-template-columns: 1fr; gap: 4px; } /* on phone-width screens a control row stacks its label above its buttons */
      .sec-2-6 .nar .role { grid-template-columns: 1fr; gap: 4px; } /* on phone-width screens a role card in step 6 stacks its chip above its text */
      .sec-2-6 .nar .kpis .v { font-size: 20px; } /* on phone-width screens the big numbers in the result boxes get smaller */
      .sec-2-6 .btn4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } /* .btn4: four equal buttons in a row (Step CPU 0-3, Fail CPU 0-3) */
      .sec-2-6 .nar .btn4 { grid-template-columns: 1fr 1fr; } /* on phone-width screens those buttons sit two per row */
      .sec-2-6 .nar .log { max-height: 220px; } /* on phone-width screens the log box stops growing past 220 pixels */
      .sec-2-6 .chip.tool { background: var(--panel); color: var(--os); border: 1px solid color-mix(in srgb, var(--os) 45%, transparent); } /* .tool: the toolbox chips in step 3, outlined in the OS color on a plain background */
      .sec-2-6 .scen td { font-size: 14px; line-height: 1.35; } /* .scen: the scenario table in step 3; smaller text in every cell */
      .sec-2-6 .scen td:first-child { font-weight: 800; color: var(--muted); width: 26px; text-align: center; } /* the first column (the step number) is bold, grey, thin and centered */
      .sec-2-6 .scen td.st { font-family: var(--mono); font-size: 13.5px; } /* .st: the last column (the shared state) uses the code font */
      .sec-2-6 .scen td.bc { color: var(--bad); font-weight: 800; background: var(--bad-bg); } /* .bc: a bad-outcome cell is shown in bold red on a pink background */
      .sec-2-6 .scen td.oc { color: var(--ok); font-weight: 800; background: var(--ok-bg); } /* .oc: a good-outcome cell is shown in bold green on a pale green background */
      /* graceful degradation lab */
      .sec-2-6 .ptab td, .sec-2-6 .ptab th { font-size: 14px; } /* .ptab: the OS's processor table in the step 4 lab, with slightly smaller text */
      .sec-2-6 .ptab td.off { color: var(--bad); font-weight: 800; } /* .off: "offline" in that table is bold red */
      .sec-2-6 .ptab td.on { color: var(--ok); font-weight: 800; } /* .on: "online" in that table is bold green */
      .sec-2-6 .ptab td.lie { color: var(--warn); font-weight: 800; background: var(--warn-bg); } /* .lie: a table entry that no longer matches reality (a dead CPU still listed online) is bold on yellow */
      .sec-2-6 .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } /* .kpis: a row of three result boxes (tick, jobs done, capacity, and similar) */
      .sec-2-6 .kpis > div { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; } /* each result box gets a light background, a thin border and rounded corners */
      .sec-2-6 .kpis .v { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.15; } /* .v: the big number in a result box; tabular-nums keeps every digit the same width so numbers do not jiggle */
      .sec-2-6 .kpis.k4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } /* .k4: a version of the result row with four boxes */
      .sec-2-6 .kpis.k4 > div { padding: 5px 8px; } /* slightly tighter padding when there are four boxes */
      .sec-2-6 .nar .kpis.k4 { grid-template-columns: 1fr 1fr; } /* on phone-width screens the four boxes sit two per row */
      .sec-2-6 .role { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px; align-items: center; padding: 6px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); font-size: 14.5px; line-height: 1.35; } /* .role: a card in step 6 pairing a colored chip (who) with a sentence (what they do) */
      .sec-2-6 .role .chip { justify-self: start; } /* keeps the chip at its natural width instead of stretching it across its column */
      .sec-2-6 .ctl-row { display: grid; grid-template-columns: 128px minmax(0, 1fr); align-items: center; gap: 8px; } /* .ctl-row: a control row in step 6, a fixed-width label on the left and buttons on the right */
      /* three levels of parallelism */
      .sec-2-6 .lvl { transition: opacity .25s; } /* .lvl: each level group in the step 5 chip drawing fades smoothly when it is dimmed or restored */
      .sec-2-6 .lvl.dim { opacity: .3; } /* .dim: the levels not being studied fade to 30% so the chosen one stands out */
      .sec-2-6 .wl { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 4px 4px 4px 10px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); font-size: 14px; line-height: 1.3; } /* .wl: one "which level?" question row: the situation on the left and the 1/2/3 buttons on the right */
      .sec-2-6 .wl.ok { border-color: var(--ok); background: var(--ok-bg); } /* a row answered correctly turns green */
      .sec-2-6 .wl.bad { border-color: var(--bad); background: var(--bad-bg); } /* a row answered wrongly turns red */
      .sec-2-6 .wl .bs { display: flex; gap: 3px; } /* .bs: the group of three small level buttons in a row */
      .sec-2-6 .wl .bs .btn { width: 32px; padding: 0; } /* each level button is a small square of fixed width with no side padding */
      .sec-2-6 .wl .bs .btn.right { border-color: var(--ok); background: var(--ok); color: var(--panel); } /* .right: the correct level's button is filled green after any answer */
      .sec-2-6 .wl .bs .btn.wrong { border-color: var(--bad); background: var(--bad); color: var(--panel); } /* .wrong: a wrongly chosen button is filled red */
    `,  // end of the css text for this section

    steps: [  // steps: the list of screens in this section, shown one at a time as the student clicks Next
      /* ---------------- 1. Big picture: the kernel stops being alone ---------------- */
      {  // step 1 begins: the big picture, one kernel shared by many processors
        title: 'One kernel, many processors',  // title shown at the top of step 1
        kind: 'story',  // kind 'story' marks this as the section's opening big-picture screen
        render(el, ctx) {  // render(el, ctx) runs each time step 1 is shown; el is the empty step area and ctx holds the guide's helpers
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;  // h builds an HTML element and s builds an SVG element (SVG is the browser's drawing format)
          const VIEW = {  // VIEW: the two pictures the student can switch between, one processor or four
            uni: {  // the one-processor picture
              cpus: [{ n: 0, a: 'kernel code:', b: 'scheduler', k: 'os', grab: true }],  // its only CPU is running the scheduler (kernel code) and reaches for the ready queue (grab)
              cap: '<b>One processor.</b> Only this CPU can run the scheduler, so no other processor can touch the ready queue while it chooses. To stop an interrupt handler cutting in halfway, the kernel just switches interrupts off for a moment. Now switch to four processors.',  // caption: with one CPU nothing else can touch the queue, and switching interrupts off is enough protection
            },  // ends the one-processor picture
            smp: {  // the four-processor (SMP) picture
              cpus: [  // the four CPUs and what each is running
                { n: 0, a: 'user process', b: 'P1 running', k: 'proc' },  // CPU 0 runs an ordinary user process
                { n: 1, a: 'kernel code:', b: 'scheduler', k: 'os', grab: true },  // CPU 1 runs the scheduler and reaches for the queue
                { n: 2, a: 'kernel code:', b: 'scheduler', k: 'os', grab: true },  // CPU 2 also runs the scheduler at the same moment and reaches for the same queue
                { n: 3, a: 'kernel thread:', b: 'disk writer', k: 'os' },  // CPU 3 runs a kernel thread, so kernel code is active on three CPUs at once
              ],  // closes the list of CPUs
              cap: '<b>Four processors, one kernel.</b> CPU 1 and CPU 2 run the scheduler <b>at the same instant</b> and both reach for P3. Disabling interrupts on CPU 1 does nothing to stop CPU 2, so shared kernel tables now need <b>locks</b>. With CPU 3 in a kernel thread, kernel code is running in three places at once.',  // caption: two schedulers reach for P3 at once, disabling interrupts cannot stop the other CPU, so tables need locks
            },  // ends the four-processor picture
          };  // closes VIEW
          let mode = 'uni';  // mode: which picture is showing, starting with one processor
          const NW = ctx.narrow;  // NW is true on phone-width screens
          // geometry: wide canvas (one row of CPUs, tables beside the queue) or phone (compact CPUs, tables below)
          const G = NW ? { vb: '0 0 330 318', W: 76, gap: 6, cy: 6, ch: 90, x1: 127, x0: 4, mem: [4, 150, 322, 162], qx: 8, qy: 160, qw: 40, qs: 46, qh: 36,  // G: every position used in the drawing; phones get a compact layout with the kernel tables below the queue
              ql: [8, 214], tabs: [[8, 224], [114, 224], [220, 224]], tw: 100, tt: [[8, 286, 'Shared main memory:'], [8, 302, 'one copy of every kernel table']], lab: [232, 140, 'middle'] }  // more phone positions: queue label, table boxes, memory captions and where the warning label goes
            : { vb: '0 0 640 296', W: 146, gap: 11, cy: 12, ch: 96, x1: 247, x0: 12, mem: [8, 186, 624, 104], qx: 22, qy: 198, qw: 50, qs: 58, qh: 40,  // wide-screen positions: one row of CPUs with the tables beside the queue
              ql: [22, 256], tabs: [[356, 198], [448, 198], [540, 198]], tw: 84, tt: [[22, 280, 'Shared main memory: one copy of every kernel table']], lab: [112, 180, 'start'] };  // more wide-screen positions for the same things
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Processors sharing one ready queue in main memory' });  // the drawing; the aria-label describes it for screen readers
          const cap = h('p', { class: 'small m0', style: { minHeight: NW ? '0' : '88px' } });  // cap: the caption under the drawing, kept tall enough on wide screens that the layout does not jump
          function draw() {  // draw() rebuilds the picture and caption for the chosen mode; it runs when the student switches
            const v = VIEW[mode];  // v: the chosen picture's description
            const kids = [];  // kids collects the shapes of the new drawing
            const n = v.cpus.length;  // n: how many CPUs this picture has
            const x0 = n === 1 ? G.x1 : G.x0, qTop = G.qy, headX = G.qx + G.qw / 2;  // x0: where the first CPU goes (a lone CPU is centered); qTop and headX: the top and center of the queue's front box
            // shared memory with the ready queue and kernel tables
            kids.push(s('rect', { x: G.mem[0], y: G.mem[1], width: G.mem[2], height: G.mem[3], rx: 14, class: 's-mem', 'stroke-width': 2 }));  // the large shared main memory box
            G.tt.forEach(([x, y, txt]) => kids.push(s('text', { x, y, 'font-size': NW ? 13 : 14, 'font-weight': 800, class: 'tx-mem' }, txt)));  // its caption: one copy of every kernel table lives in shared memory
            kids.push(s('text', { x: G.ql[0], y: G.ql[1], 'font-size': NW ? 12.5 : 13, 'font-weight': 700 }, 'Ready queue (front at left)'));  // the label over the ready queue
            ['P3', 'P4', 'P5', 'P6', 'P7'].forEach((p, i) => {  // draws the five queued processes P3 to P7
              const hot = i === 0 && mode === 'smp';  // hot: the front entry is highlighted in the SMP picture, where two CPUs want it
              kids.push(s('rect', { x: G.qx + i * G.qs, y: G.qy, width: G.qw, height: G.qh, rx: 8, class: hot ? 's-warn' : 's-proc', 'stroke-width': hot ? 3 : 2 }));  // the process box, yellow with a thicker edge when two CPUs are reaching for it
              kids.push(s('text', { x: G.qx + G.qw / 2 + i * G.qs, y: G.qy + G.qh / 2 + 5, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800 }, p));  // the process name in the middle of its box
            });  // ends the loop over queued processes
            ['Process list', 'Open-file table', 'Page tables'].forEach((txt, k) => {  // draws the three kernel tables that also live in shared memory
              const [x, y] = G.tabs[k];  // where this table's box goes
              kids.push(s('rect', { x, y, width: G.tw, height: 40, rx: 8, class: 's-os', 'stroke-width': 1.5 }));  // the table's box in the OS color
              if (NW) kids.push(s('text', { x: x + G.tw / 2, y: y + 25, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, txt));  // on phones the table name fits on one line
              else kids.push(mtext(s, x + G.tw / 2, y + 17, k === 1 ? ['Open-file', 'table'] : txt.split(' '), { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 14));  // on wide screens the name is split over two lines inside the smaller box
            });  // ends the loop over tables
            // processors
            v.cpus.forEach((c, i) => {  // draws each CPU of the chosen picture
              const x = x0 + i * (G.W + G.gap), cx = x + G.W / 2, bot = G.cy + G.ch;  // x: this CPU's left edge; cx: its center; bot: its bottom edge
              kids.push(s('rect', { x, y: G.cy, width: G.W, height: G.ch, rx: 12, class: 's-cpu', 'stroke-width': 2 }));  // the CPU's outer box
              kids.push(s('text', { x: cx, y: G.cy + 22, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800, class: 'tx-cpu' }, 'CPU ' + c.n));  // its name, e.g. "CPU 1"
              const pad = NW ? 5 : 10;  // pad: the inner margin, smaller on phones
              kids.push(s('rect', { x: x + pad, y: G.cy + 32, width: G.W - 2 * pad, height: G.ch - 44, rx: 9, class: c.k === 'os' ? 's-os' : 's-proc', 'stroke-width': 1.5 }));  // an inner box showing what the CPU runs, in the OS color for kernel code or the process color for a user process
              const lines = NW ? [c.k === 'os' ? 'kernel' : 'user', c.b.replace(' running', '')] : [c.a, c.b];  // the inner box's two lines of text, shortened on phones (e.g. "kernel" / "scheduler")
              kids.push(mtext(s, cx, G.cy + (NW ? 52 : 53), lines, { 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 13.5, 'font-weight': 700 }, NW ? 16 : 18));  // writes those lines inside the inner box
              if (c.grab) {  // a CPU running the scheduler gets an arrow down to the front of the queue
                const cls = mode === 'smp' ? 'warn' : 'os';  // the arrow is yellow in the SMP picture (a conflict) and OS-colored with one CPU
                kids.push(s('path', { d: `M${cx} ${bot + 2} C ${cx} ${bot + 40}, ${headX} ${qTop - 40}, ${headX} ${qTop - 4}`, fill: 'none', style: `stroke:var(--${cls})`, 'stroke-width': 2.5, 'marker-end': `url(#arr-${cls})` }));  // a curved arrow from the CPU's bottom to the front process, ending in an arrowhead of the same color
              } else {  // any other CPU just gets a dashed line down to memory
                kids.push(s('line', { x1: cx, y1: bot + 2, x2: cx, y2: G.mem[1] - 4, class: 's-muted', 'stroke-dasharray': '5 5' }));  // the dashed line
              }  // ends the choice of connection
            });  // ends the loop over CPUs
            if (mode === 'smp') kids.push(s('text', { x: G.lab[0], y: G.lab[1], 'text-anchor': G.lab[2], 'font-size': 13.5, 'font-weight': 800, class: 'tx-warn' }, 'both want P3!'));  // in the SMP picture, a warning label: "both want P3!"
            svg.replaceChildren(...kids);  // swaps the finished shapes into the drawing
            cap.innerHTML = v.cap;  // shows the caption for the chosen picture
          }  // ends draw()
          const seg = ctx.ui.seg([{ value: 'uni', label: 'One processor' }, { value: 'smp', label: 'Four processors (SMP)' }], mode, (m) => { mode = m; draw(); });  // seg: two buttons to switch between one processor and four; a change redraws
          draw();  // draws the one-processor picture as soon as the step opens
          const coming = h('div', { class: 'row gap-s' },  // coming: a row of chips previewing the rest of the section
            h('span', { class: 'xs b muted' }, 'COMING UP'),  // the small "COMING UP" label at the start of the row
            ...[['Race lab', 'os'], ['Five design issues', 'os'], ['Fail a CPU', 'intr'], ['Three levels of parallelism', 'cpu'], ['Tasks with GCD', 'thread'], ['Dedicated cores', 'proc']]  // the six upcoming activities, each [name, color]
              .map(([t, c]) => h('span', { class: 'chip ' + c }, t)));  // turns each one into a colored chip
          el.append(h('div', { class: 'split l fill' },  // places the explanation and the demo side by side on the step
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation text
              h('p', { class: 'lead m0', html: 'With one processor, at most one piece of kernel code is executing at any instant. Add processors and that comfort is gone.' }),  // lead: with one processor only one piece of kernel code runs at a time, and that comfort ends with more
              h('p', { class: 'm0', html: 'As section 2.4 showed, in a <span class="t">symmetric multiprocessor (SMP)</span>, kernel code can run on <b>any</b> processor. Usually no processor is the boss: each does <span class="t">self-scheduling</span>, running the scheduler itself to take its next process or thread from a shared pool. The <span class="t">kernel</span> can itself be built as several processes or threads, so parts of it run in parallel.' }),  // paragraph: in an SMP the kernel runs on any processor, each processor schedules itself, and the kernel may itself be threads
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'One order rail, four cooks, no manager: each free cook grabs the next ticket. Fast and fair, until two cooks grab the same ticket, or a ticket slips behind the grill and is never cooked.' }),  // analogy callout: four cooks and one order rail with no manager, fast until two grab the same ticket
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The OS must ensure that two processors never choose the same process and that no process is ever lost from the queue, while users simply see a faster machine.' })),  // why-it-matters callout: no process may be picked twice or lost, while users just see a faster machine
            h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column: the demo in a white card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Who runs the kernel?'), seg),  // card header: the question "Who runs the kernel?" plus the one/four processor switch
              svg, cap, coming)));  // the drawing, its caption and the coming-up chips
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Lab: self-scheduling race on the shared ready queue ---------------- */
      {  // step 2 begins: the race lab, four CPUs taking work from one shared ready queue
        title: 'Race lab: four CPUs, one shared ready queue',  // title shown at the top of step 2
        kind: 'lab',  // kind 'lab': a screen built around an experiment
        core: true, // on the shorter core path
        render(el, ctx) {  // render(el, ctx) runs when step 2 is shown
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the guide's helpers
          const P = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];  // P: the eight processes waiting in the ready queue, front first
          const LINES = [  // LINES: the dispatcher code every CPU runs, each [code, explanation]
            ['acquire(lock);', 'spin until free, then take it'],  // code line 1: take the queue lock, spinning while another CPU holds it
            ['next = ready[front];', 'read the process at the front'],  // code line 2: read which process is at the front of the queue
            ['front = front + 1;', 'step past the entry just read'],  // code line 3: move the front past the entry just read
            ['release(lock);', 'let another CPU in'],  // code line 4: give the lock back
            ['run(next);', 'run the chosen process'],  // code line 5: run the process that was read
          ];  // closes LINES
          let lockOn = false, st = null, auto = null;  // lockOn: whether the lock lines are used; st: the lab's state; auto: the timer of the automatic run, or null
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 330 292' : '0 0 640 244', width: '100%', role: 'img', 'aria-label': 'Four CPUs and the shared ready queue' });  // the drawing of the four CPUs and the queue (a taller, thinner layout on phones)
          const code = h('div', { class: 'dcode' });  // code: the box showing the dispatcher code with the CPU markers
          const logEl = h('div', { class: 'log grow', style: { minHeight: '120px' } });  // logEl: the running log of what each CPU did, stretching to fill the space
          const verdict = h('div', { class: 'callout m0' });  // verdict: the callout that judges the current state (race or no race)
          const bAuto = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (auto ? stopAuto() : startAuto()) });  // Auto-play button: starts or pauses the unlucky automatic timing
          const bReset = h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset');  // Reset: starts the lab again
          const stepBtns = [0, 1, 2, 3].map((i) => h('button', { class: 'btn sm cpu', type: 'button', onclick: () => { stopAuto(); stepCPU(i); } }, 'Step CPU ' + i));  // four Step CPU buttons; each stops any automatic run and runs one line on that CPU
          const seg = ctx.ui.seg([{ value: false, label: 'Lock off' }, { value: true, label: 'Lock on' }], lockOn, (v) => { lockOn = v; reset(); });  // seg: Lock off / Lock on; a change starts the lab again with the new code

          function reset() {  // reset(): puts the queue and all four CPUs back at the start
            stopAuto();  // stops the automatic run if it is going
            st = { front: 0, owner: null, pair: -1, alt: 0, cpus: [0, 1, 2, 3].map(() => ({ pc: lockOn ? 0 : 1, next: null, spins: 0, spun: false })), log: [] };  // fresh state: front at 0, lock free, every CPU at its first line (line 2 when there is no lock), empty log
            say(lockOn ? 'Lock on. Every CPU must take the lock before touching the queue.' : 'Lock off. Nothing stops two CPUs from being inside the queue code together.', 'muted');  // first log entry: says whether the lock is on or off
            paint();  // draws everything
          }  // ends reset()
          function say(html, cls) { st.log.push([html, cls || '']); }  // say(html, cls): adds a line to the log; cls colors it (ok, warn, bad or muted)
          function stepCPU(i) {  // stepCPU(i): runs one line of the dispatcher on CPU i; pc is the number of the line it will run next
            const c = st.cpus[i];  // c: this CPU's state
            if (c.pc > 4) return;  // a CPU past line 5 has finished and does nothing more
            c.spun = false;  // clears the "just spun" mark from its last step
            if (c.pc === 0) {  // line 1, acquire(lock)
              if (st.owner === null) { st.owner = i; c.pc = 1; say(`CPU ${i} takes the lock.`, 'ok'); }  // a free lock is taken: this CPU becomes the owner and moves to line 2
              else { c.spins++; c.spun = true; say(`CPU ${i} spins: CPU ${st.owner} holds the lock.`, 'warn'); }  // a held lock makes this CPU spin: it stays on line 1 and is marked yellow
            } else if (c.pc === 1) {  // line 2, read the front
              c.next = st.front; c.pc = 2; say(`CPU ${i} reads ready[${st.front}] and sees ${P[st.front]}.`);  // remembers which queue position it read (next), moves to line 3, and logs the process it saw
            } else if (c.pc === 2) {  // line 3, advance the front
              st.front += 1; c.pc = lockOn ? 3 : 4; say(`CPU ${i} sets front = ${st.front}.`);  // moves the shared front on by one, then goes to line 4 (or straight to line 5 when there is no lock)
            } else if (c.pc === 3) {  // line 4, release(lock)
              st.owner = null; c.pc = 4; say(`CPU ${i} releases the lock.`, 'ok');  // frees the lock and moves to line 5
            } else {  // line 5, run(next)
              c.pc = 5;  // marks this CPU as finished and running its process
              const twice = st.cpus.filter((o) => o.pc === 5 && o.next === c.next).length > 1;  // twice: is another finished CPU running the very same process?
              say(`CPU ${i} starts running ${P[c.next]}.` + (twice ? ` ${P[c.next]} is now running on two CPUs at once!` : ''), twice ? 'bad' : '');  // logs the start, and in red if the same process is now running on two CPUs at once
            }  // ends the choice of line
            paint();  // redraws everything
          }  // ends stepCPU()
          // "unlucky" timing: CPUs 0 and 1 alternate line by line, then CPUs 2 and 3 do the same
          function nextAuto() {  // nextAuto(): picks which CPU the automatic run steps next, or -1 when all are done
            const pairs = [[0, 1], [2, 3]];  // the two pairs that take turns
            for (let p = 0; p < 2; p++) {  // tries the first pair, then the second
              const live = pairs[p].filter((i) => st.cpus[i].pc <= 4);  // live: the CPUs of this pair that have not finished
              if (!live.length) continue;  // a finished pair is skipped
              if (st.pair !== p) { st.pair = p; st.alt = 0; }  // when moving on to a new pair, restart the alternation
              return live[st.alt++ % live.length];  // alternates between the live CPUs of the pair, one line each
            }  // ends the loop over pairs
            return -1;  // nothing left to run
          }  // ends nextAuto()
          function startAuto() {  // startAuto(): starts the automatic unlucky run
            if (st.cpus.every((c) => c.pc > 4)) reset();  // if every CPU had already finished, start over first
            auto = ctx.every(560, () => { const i = nextAuto(); if (i < 0) stopAuto(); else stepCPU(i); });  // every 560 milliseconds, step the next CPU; stop when nextAuto says everything is done
            paintButtons();  // updates the button labels
          }  // ends startAuto()
          function stopAuto() { if (auto) { clearInterval(auto); auto = null; } paintButtons(); }  // stopAuto(): stops the automatic run's timer, if one is running, and updates the buttons
          function paintButtons() {  // paintButtons(): updates the Auto-play label and the Step buttons
            bAuto.textContent = auto ? 'Pause' : 'Auto-play unlucky timing';  // the Auto-play button reads "Pause" while running
            if (st) stepBtns.forEach((b, i) => { b.disabled = st.cpus[i].pc > 4; });  // disables the Step button of any CPU that has finished
          }  // ends paintButtons()
          /* ---- analysis of the current state ---- */
          function analyse() {  // analyse(): works out what has gone wrong in the current state
            const takers = P.map((_, j) => st.cpus.map((c, i) => (c.next === j ? i : -1)).filter((i) => i >= 0));  // takers: for each queue position, the CPUs that read it
            const twice = takers.map((t, j) => (t.length > 1 ? j : -1)).filter((j) => j >= 0);  // twice: the positions read by more than one CPU, so that process would run twice
            const lost = P.map((_, j) => (j < st.front && !takers[j].length ? j : -1)).filter((j) => j >= 0);  // lost: positions the front has moved past that no CPU read, so that process will never run
            return { takers, twice, lost, done: st.cpus.every((c) => c.pc > 4) };  // returns those lists and whether every CPU has finished
          }  // ends analyse()
          function paint() {  // paint() redraws the code, the drawing, the log and the verdict; it runs after every step
            const a = analyse();  // a: the current analysis
            /* code panel: one badge per CPU on the line it will execute next */
            code.replaceChildren(...LINES.map(([src, cm], k) => {  // rebuilds the code box: one row per dispatcher line
              const here = st.cpus.map((c, i) => (c.pc === k ? i : -1)).filter((i) => i >= 0);  // here: the CPUs whose next line is this one
              const skip = !lockOn && (k === 0 || k === 3);  // skip: with the lock off, lines 1 and 4 (acquire and release) are not run at all
              return h('div', { class: 'dl' + (skip ? ' dim' : '') + (here.length ? ' cur' : '') },  // the line's row: faded if skipped, highlighted if some CPU is about to run it
                h('span', { class: 'mk' }, ...here.map((i) => h('b', { class: st.cpus[i].spun ? 'spin' : '', title: 'CPU ' + i }, String(i)))),  // a numbered badge for each CPU waiting at this line, yellow if it just spun
                h('code', {}, src), h('span', { class: 'cm' }, skip ? 'skipped: no lock' : cm));  // the code text and its explanation (or "skipped: no lock")
            }));  // ends the code rows
            /* diagram (wide: one row of CPUs and one row of 8 slots; phone: compact CPUs and two rows of slots) */
            const kids = [];  // kids collects the shapes of the drawing
            const NW = ctx.narrow;  // NW is true on phone-width screens
            const cpuX = (i) => (NW ? 4 + i * 82 : 8 + i * 158), CW = NW ? 76 : 148;  // cpuX(i): the left edge of CPU i's box; CW: the box width
            const slotX = (j) => (NW ? 4 + (j & 3) * 82 : 14 + j * 78), slotY = (j) => (NW ? 128 + (j >> 2) * 70 : 140), SW = NW ? 76 : 68, SH = NW ? 36 : 40;  // slotX, slotY: where queue slot j goes; on phones j & 3 is its column and j >> 2 its row; SW, SH: slot size
            st.cpus.forEach((c, i) => {  // draws each CPU
              const x = cpuX(i), cx = x + CW / 2;  // x: its left edge; cx: its center
              const bad = c.next !== null && a.twice.includes(c.next);  // bad: this CPU read a process that another CPU also read
              const cls = c.pc > 4 ? (bad ? 's-bad' : 's-proc') : c.spun ? 's-warn' : 's-cpu';  // box color: red if finished on a doubly-taken process, process color if finished safely, yellow if spinning, CPU color otherwise
              kids.push(s('rect', { x, y: 6, width: CW, height: 86, rx: 12, class: cls, 'stroke-width': 2 }));  // the CPU's box
              kids.push(s('text', { x: cx, y: NW ? 26 : 28, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800, class: 'tx-cpu' }, 'CPU ' + i));  // its name, e.g. "CPU 2"
              const status = c.pc > 4 ? 'running ' + P[c.next] : c.spun ? (NW ? 'spinning' : 'spinning on lock') : (NW ? 'line ' : 'next: line ') + (c.pc + 1);  // status text: "running P3", "spinning on lock", or "next: line 2" (shorter words on phones)
              kids.push(s('text', { x: cx, y: NW ? 50 : 52, 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 14, 'font-weight': 700, class: c.pc > 4 ? (bad ? 'tx-bad' : 'tx-proc') : c.spun ? 'tx-warn' : '' }, status));  // writes the status in red, process, yellow or plain text to match the box
              kids.push(s('text', { x: cx, y: NW ? 74 : 76, 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 13.5, class: 's-monot' }, (NW ? 'next=' : 'next = ') + (c.next === null ? '?' : P[c.next])));  // the CPU's private variable next, shown in the code font ("?" until it reads the queue)
              if (c.next !== null) {  // once the CPU has read a queue slot, draw an arrow to it
                const sx = slotX(c.next) + SW / 2, sy = slotY(c.next) - 4, col = bad ? 'bad' : c.pc > 4 ? 'proc' : 'cpu';  // sx, sy: the top center of that slot; col: arrow color (red for a clash, process color when running, CPU color before)
                kids.push(s('path', { d: `M${cx} 94 C ${cx} ${sy - 18}, ${sx} ${sy - 24}, ${sx} ${sy}`, fill: 'none', style: `stroke:var(--${col})`, 'stroke-width': bad ? 3 : 2, 'marker-end': `url(#arr-${col})` }));  // a curved arrow from the CPU down to the slot it read
              }  // ends the arrow
            });  // ends the loop over CPUs
            P.forEach((p, j) => {  // draws the eight queue slots
              const x = slotX(j), y = slotY(j), passed = j < st.front, lost = a.lost.includes(j), tw = a.twice.includes(j);  // passed: the front has moved beyond it; lost: nobody took it; tw: two CPUs took it
              kids.push(s('rect', { x, y, width: SW, height: SH, rx: 8, class: lost || tw ? 's-bad' : passed ? 's-panel' : 's-proc', 'stroke-width': lost || tw ? 3 : 2 }));  // slot box: red if lost or taken twice, grey if already passed, process color while still waiting
              if (NW && j === st.front) kids.push(s('rect', { x: x - 3, y: y - 3, width: SW + 6, height: SH + 6, rx: 10, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 2.5 }));  // on phones the slot at the front gets an outline in the chapter color, standing in for the arrow used on wide screens
              kids.push(s('text', { x: x + SW / 2, y: y + SH / 2 + 5, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800, class: passed && !lost && !tw ? 'tx-muted' : '' }, p));  // the process name, greyed once it has been taken safely
              const tk = a.takers[j];  // tk: the CPUs that took this slot
              const lab = lost ? 'LOST' : tw ? 'TAKEN ×' + tk.length : tk.length ? 'CPU ' + tk[0] : '';  // label under the slot: LOST, TAKEN ×2, or the CPU that took it
              if (lab) kids.push(s('text', { x: x + SW / 2, y: y + SH + (NW ? 16 : 18), 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 13, 'font-weight': 800, class: lost || tw ? 'tx-bad' : 'tx-proc' }, lab));  // writes that label, red for trouble
            });  // ends the loop over slots
            const lockTxt = lockOn ? (st.owner === null ? 'queue lock: free' : 'queue lock: held by CPU ' + st.owner) : 'queue lock: none';  // lockTxt: the lock's state in words: free, held by CPU n, or none
            const lockCls = lockOn ? (st.owner === null ? 'tx-ok' : 'tx-warn') : 'tx-muted';  // lockCls: green when free, yellow when held, grey when there is no lock
            if (NW) {  // on phones the front and lock state are written along the bottom
              kids.push(s('text', { x: 4, y: 282, 'font-size': 13, 'font-weight': 800 }, 'front = ' + st.front + ' (outlined)'));  // "front = n (outlined)" at the bottom left
              kids.push(s('text', { x: 326, y: 282, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: lockCls }, lockTxt));  // the lock state at the bottom right
            } else {  // on wide screens the front gets a pointer
              const fx = slotX(Math.min(st.front, P.length - 1)) + 34;  // fx: the center of the front slot (kept on the last slot once the queue is used up)
              kids.push(s('path', { d: `M${fx} 206 l -7 12 h 14 z`, style: 'fill:var(--chc)' }));  // a small triangle under the front slot pointing up at it
              kids.push(s('text', { x: fx, y: 236, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'front = ' + st.front));  // "front = n" under the triangle
              kids.push(s('text', { x: 632, y: 236, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700, class: lockCls }, lockTxt));  // the lock state at the bottom right
            }  // ends the choice of layout
            svg.replaceChildren(...kids);  // swaps the finished shapes into the drawing
            /* log */
            logEl.replaceChildren(...st.log.map(([t, c]) => h('div', { class: c, html: t })));  // rebuilds the log, one colored line per entry
            logEl.scrollTop = logEl.scrollHeight;  // scrolls the log to its newest line
            /* verdict */
            let cls = '', lab = 'Your move', txt;  // cls, lab, txt: the verdict's color, heading and message
            if (a.twice.length || a.lost.length) {  // any process taken twice or lost means a race
              cls = 'bad'; lab = 'Race condition';  // red callout headed "Race condition"
              const many = (xs) => xs.length > 1;  // many(xs): true when a list has more than one entry, to choose "was" or "were"
              txt = (a.twice.length ? `<b>${a.twice.map((j) => P[j]).join(' and ')}</b> ${many(a.twice) ? 'were each' : 'was'} taken by two CPUs, which both run it at once on its one stack, corrupting it. ` : '') +  // names each process taken by two CPUs: both run it at once on its one stack, which corrupts it
                (a.lost.length ? `<b>${a.lost.map((j) => P[j]).join(' and ')}</b> ${many(a.lost) ? 'were' : 'was'} skipped: front moved past ${many(a.lost) ? 'them' : 'it'}, so ${many(a.lost) ? 'they are' : 'it is'} lost.` : '');  // names each lost process: the front moved past it, so it will never run
            } else if (a.done) {  // no damage and every CPU finished
              cls = 'tip'; lab = 'Every process taken once';  // green callout headed "Every process taken once"
              txt = lockOn ? 'The lock made each read-then-advance pair indivisible: while one CPU was inside, the others spun. Correct no matter how the steps interleave.' : 'No damage this time, but only because of lucky timing. Nothing in the code stops two CPUs from reading the same front. Press Reset and try Auto-play.';  // with the lock this is guaranteed; without it, the timing was just lucky
            } else txt = lockOn ? 'Try every order you like. A CPU that finds the lock taken just spins until it is released.' : 'Challenge: make two CPUs read the front before either one advances it. Then keep stepping.';  // still running: a hint for the lock-on case, or a challenge to break the queue when the lock is off
            verdict.className = 'callout m0 ' + cls; verdict.dataset.label = lab; verdict.innerHTML = txt;  // paints the verdict callout with its color, heading and message
            paintButtons();  // updates the buttons
          }  // ends paint()
          reset();  // sets up the lab and draws it when the step opens
          el.append(h('div', { class: 'split l fill' },  // places the code side and the drawing side next to each other on the step
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: the code and the verdict
              h('p', { class: 'm0 small', html: 'Every CPU runs this same dispatcher code on the one shared <span class="t">ready queue</span>. Each click runs <b>one line</b> on one CPU, so <b>you</b> decide how the steps interleave, just as timing does in real hardware. If some orders break the queue, the code has a <span class="t">race condition</span>.' }),  // intro: every CPU runs this dispatcher on one shared queue, and each click runs one line, so you control the timing
              h('div', { class: 'row' }, h('span', { class: 'b small' }, 'Queue lock'), seg),  // the "Queue lock" label with the Lock off / Lock on switch
              code, verdict,  // the code box and the verdict callout
              h('p', { class: 'small muted m0', html: 'This lock is a <span class="t">spinlock</span>: a CPU that finds it taken loops until it is free, which is cheap when the protected code is short. <code>acquire</code> cannot race itself: checking and taking the lock is one indivisible hardware instruction (such as test-and-set).' })),  // note: this is a spinlock, and acquire cannot race itself because it uses one atomic instruction such as test-and-set
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the drawing and the controls
              h('div', { class: 'card white tight' }, svg),  // the drawing in a tight white card
              h('div', { class: 'btn4' }, ...stepBtns),  // the four Step CPU buttons
              h('div', { class: 'row', style: { gap: '8px' } }, bAuto, bReset, h('span', { class: 'xs muted' }, 'Auto-play: CPUs 0 and 1 alternate line by line, then CPUs 2 and 3.')),  // Auto-play and Reset, with a note on the order Auto-play uses
              logEl)));  // the log fills the rest of the column
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Explore: the five key SMP design issues ---------------- */
      {  // step 3 begins: the five SMP design issues, each with a scenario, what goes wrong, and the fix
        title: 'Five SMP design issues, each with a scenario and a fix',  // title shown at the top of step 3
        kind: 'explore',  // kind 'explore': a screen for looking around at one's own pace
        render(el, ctx) {  // render(el, ctx) runs when step 3 is shown
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h } = ctx;  // takes the HTML builder h from the guide's helpers
          // cell prefixes: "!" marks a bad outcome, "+" a good one; the last column is shared state (monospace)
          const ISS = [  // ISS: the five design issues; each has a definition, a scenario, why it is new, tools, and a bad and a fixed timeline
            { name: 'Simultaneous concurrent processes or threads', short: 'Concurrent kernel code',  // issue 1: simultaneous concurrent processes or threads (short name for its tile)
              def: 'Several processors can be inside the <b>same kernel routine at the same moment</b>. Kernel routines must therefore be <span class="t">reentrant code</span>, and kernel tables must be managed so that simultaneous use cannot corrupt them or leave them in an invalid state.',  // definition: several CPUs can be in the same kernel routine at once, so routines must be reentrant and tables protected
              scen: 'Process A on CPU 0 and process B on CPU 1 call the kernel’s open-file routine at the same instant.',  // scenario: two processes on two CPUs call the open-file routine at the same instant
              isnew: 'With one processor, at most one kernel routine was executing at any instant, and briefly disabling interrupts protected a table. Now every CPU can be in the kernel at once, even in the same routine.',  // why it is new: one processor never had two kernel routines running at once
              tools: ['Reentrant kernel routines', 'Locks on kernel tables'],  // toolbox: reentrant kernel routines and locks on kernel tables
              cols: ['CPU 0 (process A)', 'CPU 1 (process B)', 'Shared kernel data'],  // table column headings: the two CPUs and the shared kernel data
              bad: [[['1', 'put "notes.txt" in the global scratch buffer', '', 'scratch = notes.txt'], ['2', '', 'put "photo.png" in the same buffer', 'scratch = photo.png'], ['3', 'open the file named in scratch', 'open the file named in scratch', '!both open photo.png'], ['4', 'take free slot 5 of the open-file table', 'take free slot 5 too', '!slot 5 overwritten']],  // bad timeline: a shared scratch buffer is overwritten, both open the same file, and one table slot is lost
                'A opens the wrong file and one open-file entry vanishes: the routine was not reentrant and the table had no protection.'],  // what goes wrong: the routine was not reentrant and the table had no protection
              fix: [[['1', 'name = "notes.txt" on CPU 0’s own kernel stack', 'name = "photo.png" on CPU 1’s own kernel stack', 'nothing shared'], ['2', 'open notes.txt', 'open photo.png', '+each call sees its own data'], ['3', 'lock table, take slot 5, unlock', 'wait, then lock, take slot 6, unlock', '+slots 5 and 6']],  // fixed timeline: each call keeps its name on its own kernel stack, and a lock hands out table slots one at a time
                'Reentrant code keeps each call’s working data private, and a lock serializes changes to the one table that really is shared.'] },  // how the fix works: private working data plus a lock on the one truly shared table
            { name: 'Scheduling', short: 'Scheduling',  // issue 2: scheduling
              def: 'Any processor may run the scheduler, so their decisions must not conflict: no two processors may pick the same process (the race you just caused). With <span class="t">kernel-level thread</span>s the scheduler also gets a chance to run <b>several threads of one process at the same time</b> on different processors.',  // definition: schedulers on different CPUs must not clash, and kernel-level threads let one process run on several CPUs at once
              scen: 'A photo editor has three threads, T1 to T3, all ready to run. Three processors are free.',  // scenario: a photo editor with three ready threads and three free processors
              isnew: 'With one processor, one scheduling decision happened at a time. Now every processor makes its own decisions from the same shared queue.',  // why it is new: every processor now makes its own scheduling decisions from the same queue
              tools: ['Locked ready queue', 'Kernel-level threads', 'Threads of one process run together'],  // toolbox: a locked ready queue, kernel-level threads, and running a process's threads together
              cols: ['CPU 0', 'CPU 1', 'CPU 2'],  // table column headings: three CPUs
              bad: [[['1', 'T1', '!idle', '!idle'], ['2', 'T2', '!idle', '!idle'], ['3', 'T3', '!idle', '!idle']],  // bad timeline: all three threads take turns on CPU 0 while the other two CPUs idle ("!" marks the bad cells)
                'Scheduled as if the process were one unit, the editor needs 3 time slots while two processors sit idle.'],  // what goes wrong: treated as one unit, the process needs three slots with two CPUs wasted
              fix: [[['1', '+T1', '+T2', '+T3'], ['2', 'free for other work', 'free for other work', 'free for other work'], ['3', 'free for other work', 'free for other work', 'free for other work']],  // fixed timeline: T1, T2 and T3 run on three CPUs in the same slot ("+" marks the good cells)
                'The threads run side by side and finish in 1 slot. The queue lock still guarantees that no two CPUs take the same thread.'] },  // how the fix works: the threads finish in one slot, and the queue lock still stops double picks
            { name: 'Synchronization', short: 'Synchronization',  // issue 3: synchronization
              def: 'Processes on different processors may share memory (a shared address space) or I/O devices at the same moment. The OS must provide <span class="t">synchronization</span>: <span class="t">mutual exclusion</span> so one user at a time touches a resource, and ordering so events happen in the right sequence. <span class="t">Lock</span>s are the most common tool.',  // definition: shared memory and devices need mutual exclusion and correct ordering, usually provided by locks
              scen: 'Two threads of a ticket app, on CPU 0 and CPU 1, each sell one seat. The shared counter says 10 seats are left.',  // scenario: two threads of a ticket app each sell one seat, starting from 10 left
              isnew: 'With one processor, “simultaneous” threads only took turns. Now they truly run at the same instant, so their memory and I/O accesses can collide.',  // why it is new: threads that once took turns now truly run at the same instant
              tools: ['Locks', 'Mutual exclusion', 'Waiting for events in order'],  // toolbox: locks, mutual exclusion, and waiting for events in order
              cols: ['CPU 0 (thread 1)', 'CPU 1 (thread 2)', 'seats_left'],  // table column headings: the two threads' CPUs and the shared seats_left counter
              bad: [[['1', 'read seats_left: 10', 'read seats_left: 10', '10'], ['2', 'compute 10 − 1 = 9', 'compute 10 − 1 = 9', '10'], ['3', 'write 9', 'write 9', '!9']],  // bad timeline: both read 10, both compute 9, both write 9
                'Two seats were sold but the counter dropped by only one. One update was lost, so the app will oversell.'],  // what goes wrong: two seats sold but the counter dropped by one, so the app will oversell
              fix: [[['1', 'lock; read 10', 'lock is taken: wait', '10'], ['2', 'write 9; unlock', 'still waiting', '9'], ['3', 'done', 'lock; read 9; write 8; unlock', '+8']],  // fixed timeline: one thread holds the lock while it reads and writes; the other waits, then goes from 9 to 8
                'The lock turns each read-change-write into one indivisible unit, so both sales count: 10 → 8.'] },  // how the fix works: the lock makes each read-change-write indivisible, so 10 becomes 8
            { name: 'Memory management', short: 'Memory management',  // issue 4: memory management
              def: 'All the uniprocessor memory issues remain, plus two new jobs: <b>exploit the parallel hardware</b> (for example, memory with several ports that can serve several processors at once) and <b>coordinate paging across processors</b>, so a <span class="t">shared page</span> stays consistent and <span class="t">page replacement</span> never pulls a page out from under a processor still using it.',  // definition: the old memory duties plus using parallel hardware and coordinating paging so shared pages stay safe
              scen: 'Processes on CPU 0 and CPU 1 share page 7, held in frame 12. Each CPU keeps its own private cache of recent page locations. Memory is full and CPU 0 needs a free frame.',  // scenario: two CPUs share page 7 in frame 12, each remembers page locations privately, and CPU 0 needs a free frame
              isnew: 'With one processor there was one view of memory. Now each processor makes paging decisions and remembers page locations on its own.',  // why it is new: each processor now makes paging decisions and remembers locations on its own
              tools: ['Replacement that sees every CPU', 'Warn all CPUs before a shared page moves', 'Parallel page-fault handling'],  // toolbox: replacement that sees every CPU, warning all CPUs before a shared page moves, parallel page-fault handling
              cols: ['CPU 0', 'CPU 1', 'Frame 12 holds'],  // table column headings: the two CPUs and what frame 12 holds
              bad: [[['1', 'evicts page 7 (CPU 0 has not used it lately)', 'using page 7; remembers “frame 12”', 'page 7'], ['2', 'loads another process’s page into frame 12', 'still believes page 7 is in frame 12', 'other data'], ['3', '', 'reads frame 12', '!wrong data']],  // bad timeline: CPU 0 evicts page 7 and reuses frame 12, while CPU 1 still reads frame 12 and gets wrong data
                'CPU 1 reads another process’s data, because the two processors made paging decisions without coordinating.'],  // what goes wrong: the two processors made paging decisions without coordinating
              fix: [[['1', 'replacement sees CPU 1 using page 7, so it picks a different victim', 'using page 7', 'page 7'], ['2', 'if page 7 must go: tell every CPU to forget where it is, wait for replies', 'forgets “frame 12”, replies', 'page 7'], ['3', 'only now reuses frame 12', 'next use of page 7 faults and reloads it', '+consistent']],  // fixed timeline: replacement avoids page 7, or first has every CPU forget its location, and only then reuses the frame
                'Coordinated paging: replacement considers every processor, and a shared page leaves memory only after all of them agree.'] },  // how the fix works: replacement considers every processor, and a shared page moves only once all agree
            { name: 'Reliability and fault tolerance', short: 'Reliability',  // issue 5: reliability and fault tolerance
              def: 'Several processors should make the system <b>more</b> robust: able to keep working when one part fails. When one fails, the OS should offer <span class="t">graceful degradation</span>: the scheduler and the rest of the OS must <b>recognize the loss</b> and <b>restructure their management tables</b> so the remaining processors carry on.',  // definition: several CPUs should make the system more robust, so the OS must notice a loss and rebuild its tables
              scen: 'CPU 2 dies while it is running process P5. (You can try this yourself in the next step.)',  // scenario: CPU 2 dies while running P5 (the next step lets the student try it)
              isnew: 'With one processor, a processor failure stopped the whole machine. Now the failure can be survived, but only if the OS notices it.',  // why it is new: a processor failure no longer has to stop the whole machine, if the OS notices
              tools: ['Detect the failure', 'Mark the CPU offline', 'Reschedule its work'],  // toolbox: detect the failure, mark the CPU offline, reschedule its work
              cols: ['OS tables', 'Process P5', 'Capacity'],  // table column headings: the OS tables, process P5, and capacity
              bad: [[['1', 'CPU 2 still listed as online', 'still marked “running on CPU 2”', 'believed: 4 CPUs'], ['2', 'work and interrupts may still be sent to CPU 2', 'never runs again', 'real: 3 CPUs'], ['3', 'tables disagree with reality', '!hung forever', '!work silently lost']],  // bad timeline: the OS still lists CPU 2 as online, so P5 hangs and work is silently lost
                'One hardware fault turns into lost work and a confused kernel, because the OS never noticed.'],  // what goes wrong: one hardware fault becomes lost work and a confused kernel
              fix: [[['1', 'missed heartbeat detected; CPU 2 marked offline', 'put back in the ready queue', '4 → 3 CPUs'], ['2', 'scheduling and interrupts skip CPU 2', 'restarted on a healthy CPU (from its last checkpoint, if it has one)', '75%'], ['3', 'system keeps running', '+finishes', '+slower, not dead']],  // fixed timeline: a missed heartbeat is detected, CPU 2 is taken offline, and P5 restarts elsewhere at 75% capacity
                'Graceful degradation: the system loses a quarter of its speed, but every process still finishes.'] },  // how the fix works: graceful degradation, a quarter slower but every process finishes
          ];  // closes the ISS table
          let cur = 0, view = 'bad';  // cur: the issue being shown; view: which timeline, 'bad' (without care) or 'fix'
          const seen = new Set([0]);  // seen: the issues the student has opened so far (a Set holds each one only once), starting with issue 1
          const count = h('span', { class: 'chip ok' });  // count: the green chip showing how many of the five have been explored
          const tiles = ISS.map((it, i) => h('button', { class: 'iss', type: 'button', onclick: () => { cur = i; view = 'bad'; seg.set('bad'); seen.add(i); paint(); } }));  // tiles: one button per issue; a click shows that issue, resets the view to "without care", and marks it seen
          const seg = ctx.ui.seg([{ value: 'bad', label: 'Without care' }, { value: 'fix', label: 'With the fix' }], view, (v) => { view = v; paint(); });  // seg: switches between the "Without care" and "With the fix" timelines
          const left = h('div', { class: 'card os stack', style: { gap: '8px' } });  // left: the card describing the current issue
          const tableBox = h('div');  // tableBox: holds the scenario table
          const scen = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } });  // scen: the scenario sentence above the table
          const res = h('div', { class: 'callout m0' });  // res: the callout under the table explaining the outcome
          function paint() {  // paint() refreshes the tiles, the description, the table and the callout; it runs after every click
            const it = ISS[cur];  // it: the current issue
            tiles.forEach((t, i) => {  // refreshes each tile
              t.classList.toggle('on', i === cur);  // highlights the tile of the current issue
              t.replaceChildren(h('span', { class: 'n' }, String(i + 1)), h('span', {}, ISS[i].short), h('span', { class: 'ck' }, seen.has(i) ? '✓' : ''));  // fills the tile: its number, its short name, and a tick once it has been seen
            });  // ends the loop over tiles
            count.textContent = `Explored ${seen.size} / 5`;  // updates the "Explored n / 5" chip
            left.replaceChildren(  // rebuilds the description card
              h('h4', { class: 'm0' }, 'Design issue ' + (cur + 1)),  // small heading: "Design issue n"
              h('h3', { class: 'm0' }, it.name),  // the issue's full name
              h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.5' }, html: it.def }),  // the issue's definition
              h('div', { class: 'callout why m0', 'data-label': 'Why it is new', html: it.isnew }),  // "Why it is new" callout: what changed from one processor to many
              h('div', { class: 'row gap-s', style: { marginTop: 'auto' } }, h('span', { class: 'xs b muted' }, 'TOOLBOX'), ...it.tools.map((x) => h('span', { class: 'chip tool' }, x))));  // the toolbox row, pushed to the bottom of the card: a label and one chip per tool
            scen.innerHTML = '<b>Scenario.</b> ' + it.scen;  // the scenario sentence, with a bold lead-in
            const [rows, txt] = it[view];  // rows and txt: the chosen timeline's table rows and its explanation
            const cell = (v, last) => {  // cell(v, last): builds one table cell from its text
              const cls = v.startsWith('!') ? 'bc' : v.startsWith('+') ? 'oc' : '';  // a leading "!" colors the cell as bad and a leading "+" as good
              return h('td', { class: (last ? 'st ' : '') + cls }, v.replace(/^[!+]/, ''));  // the last column gets the code font; the marker character is removed from the text shown
            };  // ends cell()
            tableBox.replaceChildren(h('table', { class: 'tbl compact scen' },  // rebuilds the scenario table
              h('thead', {}, h('tr', {}, h('th', {}, '#'), ...it.cols.map((c) => h('th', {}, c)))),  // heading row: "#" then the issue's column names
              h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((v, k) => cell(v, k === r.length - 1 && cur !== 1)))))));  // one row per step; the last column uses the code font except for issue 2, whose last column is a CPU, not shared data
            res.className = 'callout m0 ' + (view === 'bad' ? 'bad' : 'tip');  // the callout is red for the bad timeline and green for the fixed one
            res.dataset.label = view === 'bad' ? 'What goes wrong' : 'How the OS avoids it';  // callout heading: "What goes wrong" or "How the OS avoids it"
            res.innerHTML = txt;  // the explanation text
          }  // ends paint()
          paint();  // shows issue 1 when the step opens
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // step 3 layout: tiles on top, details below
            h('div', { class: 'iss-grid' }, ...tiles),  // the five issue tiles
            h('div', { class: 'split l grow' },  // the details area, split into two columns that fill the remaining height
              left,  // left: the description card
              h('div', { class: 'stack', style: { gap: '10px' } },  // right: the scenario and its timeline
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, count),  // the timeline switch and the explored count
                scen,  // the scenario sentence
                tableBox, res))));  // the table and the outcome callout
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Lab: fail a processor, watch graceful degradation ---------------- */
      {  // step 4 begins: fail a processor and watch graceful degradation
        title: 'Fail a processor: graceful degradation',  // title shown at the top of step 4
        kind: 'lab',  // kind 'lab': a screen built around an experiment
        render(el, ctx) {  // render(el, ctx) runs when step 4 is shown
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the guide's helpers
          const NJOB = 12, NEED = 4;  // NJOB: twelve jobs to run; NEED: each needs four units of work
          let fixMode = true, st = null, timer = null;  // fixMode: whether the OS restructures its tables after a failure; st: the lab state; timer: the playback timer
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 330 236' : '0 0 640 196', width: '100%', role: 'img', 'aria-label': 'Four processors working through a queue of jobs' });  // the drawing of the four CPUs and the ready queue (a taller layout on phones)
          const tbody = h('tbody');  // tbody: the body of the OS's processor table, rebuilt each time
          const kTick = h('div', { class: 'v' }), kDone = h('div', { class: 'v' }), kCap = h('div', { class: 'v' });  // three big numbers: the tick count, jobs done, and capacity
          const capNote = h('div', { class: 'xs muted' });  // capNote: a small line under the numbers comparing what the OS believes with reality
          const verdict = h('div', { class: 'callout m0' });  // verdict: the callout that judges how the OS handled the failure
          const logEl = h('div', { class: 'log grow', style: { minHeight: '90px' } });  // logEl: the running log of events, stretching to fill the space
          const bPlay = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (timer ? pause() : play()) });  // Play button: starts or pauses the simulation
          const bStep = h('button', { class: 'btn sm', type: 'button', onclick: () => { pause(); tick(); } }, 'One tick');  // One tick: pauses and advances the simulation by exactly one tick
          const bReset = h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset');  // Reset: starts the batch again
          const failBtns = [0, 1, 2, 3].map((k) => h('button', { class: 'btn sm intr', type: 'button', onclick: () => fail(k) }, 'Fail CPU ' + k));  // four Fail CPU buttons, drawn in the fault color; each kills that processor
          const seg = ctx.ui.seg([{ value: true, label: 'Restructure tables' }, { value: false, label: 'Ignore the loss' }], fixMode, (v) => { fixMode = v; reset(); });  // seg: chooses the OS's reaction, restructure its tables or ignore the loss; a change restarts the lab

          function reset() {  // reset(): starts the batch of jobs from the beginning
            pause();  // stops playback if it is running
            st = { t: 0, over: false, jobs: Array.from({ length: NJOB }, (_, i) => ({ id: 'J' + (i + 1), done: 0, fin: false })),  // fresh state: tick 0, not over, twelve jobs J1 to J12 with no work done
              queue: Array.from({ length: NJOB }, (_, i) => i), cpus: [0, 1, 2, 3].map(() => ({ alive: true, table: 'online', job: null, failedAt: -1 })), log: [] };  // all twelve jobs waiting in the queue, four live CPUs listed online with no job yet, and an empty log
            dispatch();  // each CPU takes its first job from the queue
            say(`Tick 0. 12 jobs of ${NEED} work units each; every CPU has taken one from the ready queue.`, 'muted');  // first log entry: the batch and the first four jobs taken
            paint();  // draws everything
          }  // ends reset()
          function say(t, c) { st.log.push([t, c || '']); }  // say(t, c): adds a line to the log; c colors it (ok, warn, bad or muted)
          function dispatch() {  // dispatch(): self-scheduling; every live, idle CPU takes the job at the front of the queue
            st.cpus.forEach((c) => { if (c.alive && c.job === null && st.queue.length) c.job = st.queue.shift(); });  // shift() removes and returns the first entry of the queue
          }  // ends dispatch()
          function fail(k) {  // fail(k): kills CPU k when its Fail button is pressed
            const c = st.cpus[k];  // c: that CPU's state
            if (!c.alive || st.over) return;  // does nothing if it is already dead or the batch has ended
            if (st.cpus.filter((x) => x.alive).length <= 1) { ctx.toast('Keep at least one processor alive.'); return; }  // refuses to kill the last live CPU and shows a brief pop-up message (a toast) explaining why
            c.alive = false; c.failedAt = st.t;  // marks the CPU dead and remembers the tick it died at; its OS table entry still says "online"
            say(`CPU ${k} fails` + (c.job !== null ? ` while running ${st.jobs[c.job].id}` : '') + `. It stops instantly; the OS tables do not know yet.`, 'bad');  // logs the failure and the job it was holding; the OS has not noticed yet
            paint();  // redraws everything
          }  // ends fail()
          function tick() {  // tick(): advances the simulation by one unit of time
            if (st.over) return;  // nothing happens once the batch is over
            st.t += 1;  // moves the clock forward
            // 1. detection and restructuring (only when the OS checks)
            if (fixMode) st.cpus.forEach((c, k) => {  // only when the OS restructures its tables does it look for dead processors
              if (!c.alive && c.table === 'online') {  // a CPU that is dead but still listed as online has just been noticed
                c.table = 'offline';  // the OS marks it offline in its table
                say(`CPU ${k} missed its heartbeat. The OS marks it OFFLINE and stops scheduling on it.`, 'warn');  // logs the missed heartbeat and that scheduling on this CPU stops
                if (c.job !== null) {  // if the dead CPU was holding a job, rescue it
                  const j = st.jobs[c.job];  // j: the job that was frozen on the dead CPU
                  st.queue.unshift(c.job);  // unshift() puts the job back at the front of the ready queue
                  say(`${j.id} goes back to the front of the ready queue, restarting from its last checkpoint (${j.done}/${NEED} units kept).`, 'ok');  // logs that it restarts from its last checkpoint, keeping the units already done
                  c.job = null;  // the dead CPU no longer holds a job
                }  // ends the rescue
              }  // ends the check of this CPU
            });  // ends the loop over CPUs
            // 2. every live processor schedules itself, then does one unit of work
            dispatch();  // idle live CPUs take work from the queue
            st.cpus.forEach((c) => {  // each CPU does one unit of work
              if (!c.alive || c.job === null) return;  // dead or idle CPUs do nothing
              const j = st.jobs[c.job];  // j: the job this CPU is running
              j.done += 1;  // one more unit of that job is done
              if (j.done >= NEED) { j.fin = true; c.job = null; }  // a job with all four units done is finished and frees its CPU
            });  // ends the work loop
            dispatch(); // a processor that just finished immediately takes its next job
            const fin = st.jobs.filter((j) => j.fin).length;  // fin: how many jobs have finished
            const busy = st.cpus.some((c) => c.alive && c.job !== null);  // busy: is any live CPU still running a job?
            if (fin === NJOB) { st.over = true; say(`All ${NJOB} jobs finished at tick ${st.t}. (With no failure: 12 ticks.)`, 'ok'); pause(); }  // all twelve finished: the batch is over, log the finishing tick (12 with no failure), and pause
            else if (!busy && !st.queue.length) {  // otherwise, if no live CPU has work and the queue is empty, the batch has stalled
              const left = NJOB - fin;  // left: jobs that will never finish
              st.over = true; say(`Stalled at tick ${st.t}: ${fin}/${NJOB} done. ${left === 1 ? 'The last job is' : `The other ${left} jobs are`} still marked “running” on a dead CPU and will never finish.`, 'bad'); pause();  // logs the stall: those jobs are still marked running on a dead CPU; then pauses
            }  // ends the end-of-batch checks
            paint();  // redraws everything
          }  // ends tick()
          function play() { if (st.over) reset(); timer = ctx.every(700, tick); paintCtl(); }  // play(): restarts first if the batch is over, then ticks every 700 milliseconds
          function pause() { if (timer) { clearInterval(timer); timer = null; } paintCtl(); }  // pause(): stops the playback timer if it is running and updates the controls
          function paintCtl() {  // paintCtl(): updates the Play button label and which buttons can be pressed
            bPlay.textContent = timer ? 'Pause' : st && st.over ? 'Replay' : 'Play';  // the Play button reads Pause while running, Replay after the batch ends, otherwise Play
            if (!st) return;  // nothing more to update before the lab state exists
            const alive = st.cpus.filter((c) => c.alive).length;  // alive: how many CPUs still work
            failBtns.forEach((b, k) => { b.disabled = !st.cpus[k].alive || st.over || alive <= 1; });  // a Fail button is disabled for a dead CPU, after the batch ends, or when only one CPU is left
            bStep.disabled = st.over;  // One tick is disabled once the batch is over
          }  // ends paintCtl()
          function paint() {  // paint() redraws the diagram, the OS table, the numbers, the verdict and the log
            const alive = st.cpus.filter((c) => c.alive).length;  // alive: CPUs that really work
            const believed = st.cpus.filter((c) => c.table === 'online').length;  // believed: CPUs the OS table lists as online, which can be more than alive
            const fin = st.jobs.filter((j) => j.fin).length;  // fin: jobs finished so far
            /* diagram */
            const kids = [];  // kids collects the shapes of the diagram
            const NW = ctx.narrow, CW = NW ? 76 : 148;  // NW is true on phone-width screens; CW: the width of each CPU box
            st.cpus.forEach((c, k) => {  // draws each CPU
              const x = NW ? 4 + k * 82 : 8 + k * 158, cx = x + CW / 2;  // x: its left edge; cx: its center
              kids.push(s('rect', { x, y: 6, width: CW, height: 100, rx: 12, class: c.alive ? 's-cpu' : 's-bad', 'stroke-width': 2, 'stroke-dasharray': c.alive ? null : '6 4' }));  // the CPU's box: CPU color while alive, red with a dashed edge once dead
              kids.push(s('text', { x: cx, y: 28, 'text-anchor': 'middle', 'font-size': NW ? 14 : 15, 'font-weight': 800, class: c.alive ? 'tx-cpu' : 'tx-bad' }, (c.alive ? '' : '✗ ') + 'CPU ' + k));  // its name, with a cross in front once dead
              const j = c.job !== null ? st.jobs[c.job] : null;  // j: the job this CPU holds, or null
              const line = !c.alive ? (j ? j.id + (NW ? ' frozen' : ' frozen here') : 'dead') : j ? (NW ? j.id : 'running ' + j.id) : 'idle';  // status line: "running J3", "idle", "J3 frozen here" on a dead CPU, or "dead"
              kids.push(s('text', { x: cx, y: 54, 'text-anchor': 'middle', 'font-size': NW ? 13 : 14, 'font-weight': 700, class: !c.alive ? 'tx-bad' : j ? 'tx-proc' : 'tx-muted' }, line));  // writes the status in red, process color or grey to match
              const uw = NW ? 14 : 24, us = NW ? 17 : 29, ux = cx - (NEED * us - (us - uw)) / 2;  // sizes and start position for a row of four small progress squares, centered in the box
              for (let u = 0; u < NEED; u++) kids.push(s('rect', { x: ux + u * us, y: 68, width: uw, height: 14, rx: 4, class: j && u < j.done ? (c.alive ? 's-proc' : 's-bad') : 's-panel', 'stroke-width': 1.5 }));  // one square per unit of work, filled for each unit done (red if the CPU is dead)
              kids.push(s('text', { x: cx, y: 100, 'text-anchor': 'middle', 'font-size': 12.5, class: 'tx-muted' }, j ? (NW ? `${j.done}/${NEED}` : `${j.done}/${NEED} units`) : ''));  // "n/4 units" under the squares while a job is held
            });  // ends the loop over CPUs
            kids.push(s('text', { x: NW ? 4 : 8, y: 134, 'font-size': 13.5, 'font-weight': 800 }, 'Ready queue (front at left)'));  // the label over the ready queue
            st.queue.forEach((q, i) => {  // draws each job still waiting in the queue
              const j = st.jobs[q], x = NW ? 4 + (i % 6) * 54 : 8 + i * 52, y = NW ? 144 + Math.floor(i / 6) * 46 : 144;  // j: the job; x, y: its box position (two rows of six on phones)
              kids.push(s('rect', { x, y, width: 46, height: 40, rx: 8, class: j.done ? 's-warn' : 's-proc', 'stroke-width': 2 }));  // the job's box, yellow if it was partly done before (a rescued job)
              kids.push(s('text', { x: x + 23, y: y + 25, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, j.id));  // the job's name in its box
            });  // ends the loop over queued jobs
            if (!st.queue.length) kids.push(s('text', { x: 8, y: 170, 'font-size': 14, class: 'tx-muted' }, 'empty'));  // writes "empty" when the queue has no jobs left
            svg.replaceChildren(...kids);  // swaps the finished shapes into the diagram
            /* the OS's own processor table */
            tbody.replaceChildren(...st.cpus.map((c, k) => {  // rebuilds the OS's processor table, one row per CPU
              const lie = !c.alive && c.table === 'online';  // lie: the CPU is dead but the table still says online
              const j = c.job !== null ? st.jobs[c.job].id : '—';  // j: the name of the job the table says this CPU holds, or a dash
              return h('tr', {}, h('td', { class: 'b' }, 'CPU ' + k),  // the row starts with the CPU's name in bold
                h('td', { class: lie ? 'lie' : c.table === 'online' ? 'on' : 'off' }, c.table + (lie ? ' (wrong!)' : '')),  // "Table says" cell: green online, red offline, or yellow "online (wrong!)" when the CPU is actually dead
                h('td', { class: lie && j !== '—' ? 'lie' : '' }, c.table === 'offline' ? 'removed from scheduling' : j));  // "Assigned job" cell: "removed from scheduling" once offline; a job frozen on a dead CPU is shown in yellow
            }));  // ends the table rows
            kTick.textContent = st.t; kDone.textContent = `${fin}/${NJOB}`; kCap.textContent = Math.round((alive / 4) * 100) + '%';  // big numbers: the current tick, jobs done out of 12, and capacity as the share of live CPUs
            capNote.textContent = believed !== alive ? `OS believes ${believed} CPUs are up; really ${alive}` : `${alive} of 4 processors working`;  // note: points out when the OS believes more CPUs are up than really are
            /* verdict */
            const anyDead = alive < 4;  // anyDead: has any CPU failed?
            let cls = '', lab = 'Try it', txt = 'Press Play, then fail a CPU while it is running a job. Compare the two OS reactions.';  // the default verdict: an invitation to play and fail a CPU mid-job
            if (st.over && fin === NJOB && anyDead && !fixMode) { cls = 'warn'; lab = 'Lucky, not safe'; txt = 'Every job finished only because the dead CPU was holding no job when it failed. The OS still believes all 4 processors are up, so its tables are wrong.'; }  // batch done despite a dead CPU while ignoring the loss: lucky, since the dead CPU held no job, but the tables are wrong
            else if (st.over && fin === NJOB) { cls = 'tip'; lab = 'Graceful degradation'; txt = anyDead ? `Done at tick ${st.t} instead of 12. Capacity fell to ${Math.round((alive / 4) * 100)}%, but every job finished because the OS noticed the loss and rebuilt its tables.` : 'No failure this time: 48 units of work ÷ 4 CPUs = 12 ticks. Reset and fail a CPU mid-run.'; }  // batch done: graceful degradation (slower but complete), or a note that nothing failed this time
            else if (st.over) {  // batch ended without finishing
              const frozen = st.cpus.filter((c) => !c.alive && c.job !== null).length; // dead CPUs still holding a job
              cls = 'bad'; lab = 'Silent failure';  // red callout headed "Silent failure"
              txt = frozen === 1 ? 'The OS never noticed. Its tables still show a dead CPU as online and running a job, so that job never finishes and nobody is told.'  // message for one frozen job: the OS never noticed, so that job never finishes and nobody is told
                : `The OS never noticed. Its tables still show ${frozen} dead CPUs as online and running jobs, so those jobs never finish and nobody is told.`;  // the same message for several frozen jobs
            }  // ends the stalled case
            else if (anyDead && fixMode) { cls = 'why'; lab = 'Restructuring'; txt = 'The OS detects the dead CPU, marks it offline, puts its job back in the ready queue and carries on with fewer processors.'; }  // still running with the OS restructuring: it has detected the loss and is carrying on with fewer CPUs
            else if (anyDead) { cls = 'warn'; lab = 'Nobody noticed'; txt = 'The tables still say every CPU is online. Keep playing and watch the job that was on the dead CPU.'; }  // still running while ignoring the loss: the tables still say every CPU is online
            verdict.className = 'callout m0 ' + cls; verdict.dataset.label = lab; verdict.innerHTML = txt;  // paints the verdict callout with its color, heading and message
            logEl.replaceChildren(...st.log.map(([t, c]) => h('div', { class: c, html: t })));  // rebuilds the log, one colored line per entry
            logEl.scrollTop = logEl.scrollHeight;  // scrolls the log to its newest line
            paintCtl();  // updates the buttons
          }  // ends paint()
          reset();  // sets up the batch and draws it when the step opens
          el.append(h('div', { class: 'split l fill' },  // places the table side and the diagram side next to each other on the step
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: the explanation, the OS's table and the results
              h('p', { class: 'm0 small', html: 'An SMP should survive a dead processor. Twelve jobs need 4 units of work each, and each job saves a checkpoint (a copy of its progress) after every finished unit. Press Play, fail a CPU mid-run, and watch what the OS does with its <b>management tables</b>.' }),  // intro: twelve jobs of four units, each saving a checkpoint after every unit; fail a CPU and watch the tables
              h('div', { class: 'row' }, h('span', { class: 'b small' }, 'OS reaction'), seg),  // the "OS reaction" label with the restructure / ignore switch
              h('div', {}, h('h4', { class: 'm0 mb', style: { marginBottom: '4px' } }, 'The OS’s processor table'),  // the heading over the OS's processor table
                h('table', { class: 'tbl compact ptab' }, h('thead', {}, h('tr', {}, h('th', {}, 'CPU'), h('th', {}, 'Table says'), h('th', {}, 'Assigned job'))), tbody)),  // the table itself, with columns CPU, Table says and Assigned job; its body is rebuilt by paint()
              h('div', { class: 'kpis' }, h('div', {}, h('div', { class: 'xs muted b' }, 'TICK'), kTick), h('div', {}, h('div', { class: 'xs muted b' }, 'JOBS DONE'), kDone), h('div', {}, h('div', { class: 'xs muted b' }, 'CAPACITY'), kCap)),  // three result boxes: tick, jobs done and capacity
              capNote, verdict),  // the believed-versus-real note and the verdict callout
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the diagram and the controls
              h('div', { class: 'card white tight' }, svg),  // the diagram in a tight white card
              h('div', { class: 'btn4' }, ...failBtns),  // the four Fail CPU buttons
              h('div', { class: 'row', style: { gap: '8px' } }, bPlay, bStep, bReset),  // Play, One tick and Reset
              logEl,  // the event log
              h('div', { class: 'callout tip m0 small', 'data-label': 'How does the OS notice?', html: 'Each processor regularly checks in, for example by bumping a <b>heartbeat</b> counter in shared memory. If one falls silent, another processor declares it failed and starts the restructuring.' }))));  // tip callout: the OS notices a dead CPU when it stops bumping its heartbeat counter in shared memory
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. Explore: multicore and the three levels of parallelism ---------------- */
      {  // step 5 begins: multicore and its three levels of parallelism
        title: 'Multicore: parallelism at three levels',  // title shown at the top of step 5
        kind: 'explore',  // kind 'explore': a screen for looking around at one's own pace
        render(el, ctx) {  // render(el, ctx) runs when step 5 is shown
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the guide's helpers
          const LV = [  // LV: the three levels, each with a title, what runs in parallel, and who exploits it
            { t: 'Level 1 · Inside each core', what: 'Several instructions from <b>one</b> instruction stream are in progress at once: a pipeline overlaps their stages, and many cores can start more than one per clock cycle. This is <span class="t">instruction-level parallelism (ILP)</span>.',  // level 1: instruction-level parallelism inside one core
              who: 'The <b>hardware</b> finds it automatically, helped by compilers that order instructions well. The OS does not manage it.' },  // who: the hardware, helped by compilers; not the OS
            { t: 'Level 2 · Within each core, over time', what: 'Each core is shared by several processes and threads: classic <span class="t">multiprogramming</span> and multithreaded execution. While one waits, another runs.',  // level 2: one core shared over time by several processes and threads
              who: 'The <b>OS scheduler</b>, just as on a single processor, but now separately for every core.' },  // who: the OS scheduler, separately for every core
            { t: 'Level 3 · One application across cores', what: 'A <b>single application</b> runs as several concurrent processes or threads spread over different cores, so that one application finishes sooner.',  // level 3: one application spread across several cores at once
              who: 'The <b>developer</b> splits the work, <b>compilers and languages</b> help, and the <b>OS</b> hands out cores and resources. This is the hardest level; the next two steps explore it.' },  // who: the developer, compilers and languages, and the OS together; the hardest level
          ];  // closes LV
          const QS = [  // QS: the four "which level?" questions, each [situation, correct level 0-2]
            ['While one instruction executes, the core is already decoding the next and fetching the one after.', 0],  // question: fetching, decoding and executing overlap in one core (level 1)
            ['While one thread waits for the disk, the OS runs a different thread on the same core.', 1],  // question: another thread runs during a disk wait (level 2)
            ['A video encoder splits each frame into strips and encodes the strips on four cores at once.', 2],  // question: an encoder spreads one frame over four cores (level 3)
            ['A core starts two independent additions from the same instruction stream in one clock cycle.', 0],  // question: two independent additions start in one clock cycle (level 1)
          ];  // closes QS
          let cur = 0;  // cur: which level is selected
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 340 640' : '0 0 660 336', width: '100%', role: 'img', 'aria-label': 'A four-core chip showing three levels of parallelism' });  // the chip drawing; phones get a tall layout with the four cores in a 2 by 2 grid
          const det = h('div', { class: 'card os stack', style: { gap: '6px' } });  // det: the card describing the selected level
          const seg = ctx.ui.seg(LV.map((l, i) => ({ value: i, label: 'Level ' + (i + 1) })), cur, (v) => { cur = v; paint(); });  // seg: one button per level; a change highlights that level
          const groups = [];  // groups: the three clickable level groups of the drawing, kept so paint() can dim them
          function build() {  // build(): draws the chip once, splitting its shapes into the three level groups
            const NW = ctx.narrow, W0 = NW ? 340 : 660, H0 = NW ? 640 : 336;  // NW is true on phone-width screens; W0 and H0: the drawing's width and height
            const kids = [s('rect', { x: 4, y: 4, width: W0 - 8, height: H0 - 8, rx: 16, class: 's-panel', 'stroke-width': 2 }),  // kids starts with the chip's outline
              s('text', { x: 18, y: 26, 'font-size': 14, 'font-weight': 800, class: 'tx-muted' }, 'One four-core chip, shared memory')];  // and the chip's title: one four-core chip with shared memory
            const g1 = [], g2 = [], g3 = [];  // g1, g2, g3 collect the shapes that belong to levels 1, 2 and 3
            // legend for the pipeline stages (level 1), so the letters are not a mystery
            g1.push(s('text', { x: NW ? 170 : 642, y: NW ? 624 : 26, 'text-anchor': NW ? 'middle' : 'end', 'font-size': 12.5, 'font-weight': 700, class: 'tx-accent' }, 'F fetch · D decode · E execute · W write result'));  // the pipeline legend (F fetch, D decode, E execute, W write result), part of level 1
            const TH = ['s-proc', 's-thread', 's-io'];  // TH: the colors of the three processes or threads A, B and C
            for (let c = 0; c < 4; c++) {  // draws each of the four cores
              // wide: four cores in a row; phone: a 2 × 2 grid (dy shifts the second row down)
              const x = NW ? 16 + (c & 1) * 160 : 16 + c * 160, dy = NW ? (c >> 1) * 262 : 0;  // x: the core's left edge; dy moves the second row down on phones (c & 1 is the column, c >> 1 the row)
              kids.push(s('rect', { x, y: 38 + dy, width: 148, height: 254, rx: 12, class: 's-cpu', 'stroke-width': 2 }));  // the core's box
              kids.push(s('text', { x: x + 74, y: 58 + dy, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800, class: 'tx-cpu' }, 'Core ' + c));  // the core's name, e.g. "Core 2"
              // level 1: a tiny pipeline, three instructions overlapping by one stage each
              const p = [s('rect', { x: x + 8, y: 66 + dy, width: 132, height: 84, rx: 8, class: 's-panel', 'stroke-width': 1.5 }),  // p: the level 1 shapes for this core, starting with a panel and the label ILP
                s('text', { x: x + 132, y: 84 + dy, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, class: 'tx-muted' }, 'ILP')];  // the label "ILP" in the panel's corner
              ['F', 'D', 'E', 'W'].forEach((st, k) => [0, 1, 2].forEach((ins) => {  // for each of the four stages and three instructions, one lettered square
                const px = x + 16 + (k + ins) * 20, py = 76 + ins * 22 + dy;  // each instruction starts one column later than the one before, so the stages overlap diagonally
                p.push(s('rect', { x: px, y: py, width: 18, height: 18, rx: 3, class: 's-accent', 'stroke-width': 1 }));  // the stage square
                p.push(s('text', { x: px + 9, y: py + 13.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, st));  // the stage letter inside it
              }));  // ends the pipeline squares
              g1.push(...p);  // adds this core's pipeline to level 1
              // level 2: the core's timeline switching among processes and threads
              const q = [s('rect', { x: x + 8, y: 160 + dy, width: 132, height: 64, rx: 8, class: 's-panel', 'stroke-width': 1.5 }),  // q: the level 2 shapes for this core, starting with a panel
                s('text', { x: x + 74, y: 178 + dy, 'text-anchor': 'middle', 'font-size': 12.5, class: 'tx-muted' }, 'time →')];  // the label "time →" over the timeline
              // six turns on this core, rotating among three processes/threads A, B, C
              for (let k = 0; k < 6; k++) {  // six turns in a row on this core's timeline
                const px = x + 14 + k * 20.5;  // px: where this turn's box starts
                q.push(s('rect', { x: px, y: 188 + dy, width: 19, height: 26, rx: 3, class: TH[(k + c) % 3], 'stroke-width': 1.5 }),  // a colored box for whichever of A, B or C runs this turn; each core starts the rotation at a different point
                  s('text', { x: px + 9.5, y: 205.5 + dy, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'ABC'[(k + c) % 3]));  // the letter A, B or C inside the box
              }  // ends the loop over turns
              g2.push(...q);  // adds this core's timeline to level 2
              // level 3: one thread of the same application on every core
              g3.push(s('rect', { x: x + 22, y: 238 + dy, width: 104, height: 40, rx: 9, class: 's-os', 'stroke-width': 2 }),  // a box for one thread of application X on this core, part of level 3
                s('text', { x: x + 74, y: 263 + dy, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'App X · T' + (c + 1)));  // its label, e.g. "App X · T1"
            }  // ends the loop over cores
            if (NW) g3.push(s('path', { d: 'M 38 560 v 9 h 264 v -9', fill: 'none', style: 'stroke:var(--os)', 'stroke-width': 2 }),  // on phones, a bracket under the bottom row of cores gathers the four threads together
              mtext(s, 170, 588, ['one application, four threads,', 'running at the same moment'], { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 'tx-os' }, 16));  // with a two-line caption: one application, four threads, running at the same moment
            else g3.push(s('path', { d: 'M 38 298 v 9 h 584 v -9', fill: 'none', style: 'stroke:var(--os)', 'stroke-width': 2 }),  // on wide screens, one long bracket under all four cores
              s('text', { x: 330, y: 326, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 'tx-os' }, 'one application, four threads, running at the same moment'));  // with a one-line caption saying the same
            groups.length = 0;  // empties the list of groups before filling it again
            [g1, g2, g3].forEach((g, i) => { const grp = hotGroup(ctx, () => { cur = i; seg.set(i); paint(); }, LV[i].t, ...g); grp.classList.add('lvl'); groups.push(grp); kids.push(grp); });  // wraps each level's shapes in a clickable group (a click selects that level), marks it lvl, and adds it to the drawing
            svg.replaceChildren(...kids);  // swaps the finished shapes into the drawing
          }  // ends build()
          const rows = QS.map(([q, ans]) => {  // rows: one question row per situation
            const row = h('div', { class: 'wl' }, h('span', {}, q));  // the row starts with the situation text
            const bs = [0, 1, 2].map((k) => h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Level ' + (k + 1), onclick: () => {  // three buttons labelled 1, 2 and 3; a click checks that choice
              bs.forEach((b) => b.classList.remove('right', 'wrong'));  // clears any earlier marks on this row's buttons
              bs[ans].classList.add('right'); if (k !== ans) bs[k].classList.add('wrong');  // fills the correct level's button green, and the chosen one red if it was wrong
              row.className = 'wl ' + (k === ans ? 'ok' : 'bad');  // colors the whole row green or red
              fb.innerHTML = (k === ans ? '<b style="color:var(--ok)">Right:</b> ' : `<b style="color:var(--bad)">Not quite, it is level ${ans + 1}:</b> `) + ['one instruction stream, overlapped by the hardware.', 'one core taking turns among processes or threads.', 'one application spread over several cores at once.'][ans];  // feedback line: right or wrong, then a one-phrase reminder of what the correct level means
            } }, String(k + 1)));  // ends the click handler; each button shows its level number
            row.append(h('span', { class: 'bs' }, ...bs));  // adds the three buttons to the end of the row
            return row;  // hands the finished row back
          });  // ends the question rows
          const fb = h('p', { class: 'small m0', style: { minHeight: '21px' } }, 'Click 1, 2 or 3 for each situation.');  // fb: the feedback line under the questions, starting with an instruction
          function paint() {  // paint() highlights the chosen level and describes it
            groups.forEach((g, i) => g.classList.toggle('dim', i !== cur));  // dims every level group except the chosen one
            const l = LV[cur];  // l: the chosen level's description
            det.replaceChildren(h('h3', { class: 'm0' }, l.t), h('p', { class: 'm0 small', html: '<b>What runs in parallel.</b> ' + l.what }), h('p', { class: 'm0 small', html: '<b>Who exploits it.</b> ' + l.who }));  // rebuilds the description card: title, what runs in parallel, and who exploits it
          }  // ends paint()
          build(); paint();  // draws the chip and highlights level 1 when the step opens
          el.append(h('div', { class: 'split r fill' },  // step 5 layout: drawing on the left (wider), description and questions on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: intro, level picker and drawing
              h('p', { class: 'm0', html: 'A multicore chip is an SMP on one piece of silicon, so everything so far still applies. The new challenge is to <b>put the parallelism to work</b>. It exists at three levels; pick one (or click the chip).' }),  // intro: a multicore chip is an SMP on one chip, and its parallelism exists at three levels
              seg, h('div', { class: 'card white tight' }, svg)),  // the level picker and the chip drawing
            h('div', { class: 'stack', style: { gap: '8px' } }, det, h('h4', { class: 'm0' }, 'Which level? Sort these'), ...rows, fb)));  // right column: the level description, the "Which level?" heading, the four question rows and the feedback
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. Explore: parallelism within applications (GCD) ---------------- */
      {  // step 6 begins: parallelism within one application, using Grand Central Dispatch as the example
        title: 'Parallelism within applications: splitting the work',  // title shown at the top of step 6
        kind: 'explore',  // kind 'explore': a screen for trying settings
        core: true, // on the shorter core path
        render(el, ctx) {  // render(el, ctx) runs when step 6 is shown
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the guide's helpers
          const WORK = 96; // 12 photos × 8 ms of filtering each
          const SPLITS = {  // SPLITS: three ways the developer can split the work, each with its task count n, task length, label and code
            one: { n: 1, len: 96, label: 'One big task', code: `${/* split 1, "One big task": one 96 ms task; its shown code follows */''}
q = dispatch_get_global_queue(0, 0);   // a concurrent queue run by GCD${/* shown code, line 1: get one of GCD's concurrent queues */''}
dispatch_async(q, ^{                   // hand GCD ONE block holding...${/* shown code, line 2: dispatch_async hands GCD one block (^{ ... }, a piece of code to run later) */''}
  for (int i = 0; i < 12; i++)         // ...a loop over all 12 photos,${/* shown code, line 3: the loop over the 12 photos sits inside that single block */''}
    filter(photo[i]);                  // so it all runs on one thread${/* shown code, line 4: filter each photo, all on the one thread that runs the block */''}
});                                    // end of the block` },  // shown code, line 5: closes the block; end of split 1's code
            photo: { n: 12, len: 8, label: 'A task per photo', code: `${/* split 2, "A task per photo": twelve 8 ms tasks */''}
q = dispatch_get_global_queue(0, 0);   // a concurrent queue run by GCD${/* shown code, line 1: get a concurrent queue */''}
for (int i = 0; i < 12; i++)           // for each of the 12 photos...${/* shown code, line 2: loop over the 12 photos */''}
  dispatch_async(q, ^{                 // ...queue its own block${/* shown code, line 3: queue a separate block for each photo */''}
    filter(photo[i]);                  // (8 ms of work in each block)${/* shown code, line 4: each block filters one photo */''}
  });                                  // the call returns at once` },  // shown code, line 5: closes each block; dispatch_async returns at once; end of split 2's code
            tile: { n: 48, len: 2, label: 'A task per quarter photo', code: `${/* split 3, "A task per quarter photo": forty-eight 2 ms tasks */''}
q = dispatch_get_global_queue(0, 0);   // a concurrent queue run by GCD${/* shown code, line 1: get a concurrent queue */''}
for (int i = 0; i < 12; i++)           // for each photo...${/* shown code, line 2: loop over the photos */''}
  for (int t = 0; t < 4; t++)          // ...and each quarter of it,${/* shown code, line 3: and over the four quarters of each photo */''}
    dispatch_async(q, ^{               // queue a block: 48 in all,${/* shown code, line 4: queue one block per quarter, 48 in all */''}
      filter_tile(photo[i], t); });    // each doing 2 ms of work` },  // shown code, line 5: each block filters one quarter; end of split 3's code
          };  // closes SPLITS
          let split = 'photo', cores = 4;  // split: the chosen split (a task per photo to begin with); cores: the machine size (4 to begin with)
          const codeBox = h('div');  // codeBox: holds the code listing for the chosen split
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 340 172' : '0 0 640 172', width: '100%', role: 'img', 'aria-label': 'Timeline of blocks running on the thread pool' });  // the timeline drawing of blocks running on the thread pool
          const kT = h('div', { class: 'v' }), kS = h('div', { class: 'v' }), kU = h('div', { class: 'v' });  // three big numbers: finish time, speedup over one core, and how busy the cores are
          const say = h('p', { class: 'small m0', style: { minHeight: '40px' } });  // say: the sentence explaining the result
          const segSplit = ctx.ui.seg(Object.entries(SPLITS).map(([k, v]) => ({ value: k, label: v.label })), split, (v) => { split = v; paint(); });  // segSplit: picks the developer's split; a change redraws
          const segCores = ctx.ui.seg([1, 2, 4, 8].map((c) => ({ value: c, label: c + (c === 1 ? ' core' : ' cores') })), cores, (v) => { cores = v; paint(); });  // segCores: picks 1, 2, 4 or 8 cores; a change redraws
          function paint() {  // paint() redraws the code, the timeline and the numbers for the chosen split and machine
            const sp = SPLITS[split];  // sp: the chosen split
            // on phones each comment moves onto its own line above the code it explains, so nothing scrolls sideways
            const src = !ctx.narrow ? sp.code : sp.code.split('\n').map((l) => {  // on wide screens the code is used as is; on phones each line is rewritten as follows
              const i = l.indexOf('//');  // i: where the line's // comment starts, if it has one
              if (i < 0) return l;  // lines without a comment stay as they are
              const c = l.slice(0, i).replace(/\s+$/, '');  // c: the code part of the line with trailing spaces removed
              return c.match(/^\s*/)[0] + l.slice(i).trim() + '\n' + c;  // puts the comment on its own line, at the code's indentation, above the code
            }).join('\n');  // joins the rewritten lines back into one text
            codeBox.replaceChildren(ctx.ui.code(src, { lang: 'c', nums: false, fontSize: 13 }));  // shows the listing with the guide's code viewer: C highlighting, no line numbers, 13-pixel text
            // the pool has one worker thread per core; each block goes to the thread that frees up first
            const free = Array(cores).fill(0), placed = [];  // free: when each worker thread (one per core) next becomes free; placed: where each block ended up
            for (let k = 0; k < sp.n; k++) {  // hands out the blocks one by one, in order
              let w = 0; for (let j = 1; j < cores; j++) if (free[j] < free[w]) w = j;  // w: the worker thread that frees up first
              placed.push({ k, w, t0: free[w] }); free[w] += sp.len;  // records the block's thread and start time, then pushes that thread's free time later by the block's length
            }  // ends the hand-out loop
            const T = Math.max(...free), util = Math.round((WORK / (cores * T)) * 100);  // T: when the last thread finishes; util: the share of core time spent working, as a percentage
            const X0 = ctx.narrow ? 60 : 68, SC = (ctx.narrow ? 272 : 564) / WORK, rowH = Math.min(34, 140 / cores);  // X0: where the timeline starts; SC: pixels per millisecond; rowH: the height of each thread's row
            const kids = [];  // kids collects the shapes of the timeline
            for (let r = 0; r < cores; r++) {  // one row per worker thread
              const y = 6 + r * rowH;  // y: the top of this row
              kids.push(s('rect', { x: X0, y, width: WORK * SC, height: rowH - 4, rx: 4, class: 's-panel', 'stroke-width': 1 }));  // the row's empty grey track, 96 ms long
              kids.push(s('text', { x: X0 - 8, y: y + rowH / 2 + 3, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 'tx-thread' }, 'thread ' + r));  // the row's label on the left, e.g. "thread 2"
            }  // ends the loop over rows
            placed.forEach(({ k, w, t0 }) => {  // draws each block in its place
              const photo = Math.floor((k * sp.len) / 8), y = 6 + w * rowH, wpx = sp.len * SC;  // photo: which photo this block belongs to; y: the top of its thread's row; wpx: its width in pixels
              kids.push(s('rect', { x: X0 + t0 * SC + 1, y: y + 1, width: wpx - 2, height: rowH - 6, rx: 3, class: photo % 2 ? 's-proc' : 's-thread', 'stroke-width': 1.5 }));  // the block's box, placed at its start time; neighboring photos alternate colors so they can be told apart
              if (wpx >= 30 && rowH >= 18) kids.push(s('text', { x: X0 + (t0 + sp.len / 2) * SC, y: y + rowH / 2 + 3, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, sp.n === 1 ? 'all 12 photos, one after another' : 'P' + (photo + 1)));  // a label inside the block when there is room: "P5", or for the one big task a description of the whole loop
            });  // ends the loop over blocks
            const axisY = 148;  // axisY: the height of the time axis
            kids.push(s('line', { x1: X0, y1: axisY, x2: X0 + WORK * SC, y2: axisY, class: 's-line' }));  // the time axis under the rows
            [0, 24, 48, 72, 96].forEach((ms) => {  // tick marks every 24 ms, from 0 to 96
              kids.push(s('line', { x1: X0 + ms * SC, y1: axisY, x2: X0 + ms * SC, y2: axisY + 5, class: 's-line' }));  // a short tick line
              kids.push(s('text', { x: X0 + ms * SC, y: axisY + 19, 'text-anchor': ms === WORK ? 'end' : ms ? 'middle' : 'start', 'font-size': 12.5, class: 'tx-muted' }, ms + ' ms'));  // its label, e.g. "48 ms", aligned so the first and last labels stay inside the drawing
            });  // ends the tick marks
            kids.push(s('line', { x1: X0 + T * SC, y1: 2, x2: X0 + T * SC, y2: axisY, style: 'stroke:var(--ok)', 'stroke-width': 2.5, 'stroke-dasharray': '5 4' }));  // a dashed green line at the moment the last block finishes
            svg.replaceChildren(...kids);  // swaps the finished shapes into the drawing
            kT.textContent = T + ' ms'; kS.textContent = ctx.util.fmt(WORK / T, 1) + '×'; kU.textContent = util + '%';  // big numbers: finish time, speedup compared with one core (96 ms divided by T), and cores busy
            let msg;  // msg: the explanation, chosen below
            if (cores === 1) msg = 'With one core every version takes 96 ms. Splitting only helps when there are cores to run the pieces.';  // one core: every split takes 96 ms, since there is nothing to run the pieces on
            else if (sp.n === 1) msg = `One big block can use only one thread, so ${cores - 1} of the ${cores} cores ${cores === 2 ? 'sits' : 'sit'} idle. The developer has not exposed any parallelism.`;  // one big task: it can use only one thread, so the other cores sit idle
            else if (sp.n % cores) msg = `${sp.n} blocks on ${cores} threads: the last round is only partly full, so cores idle at the end (${util}% busy). Smaller tasks balance better.`;  // tasks that do not divide evenly by the cores: the last round is part empty, so smaller tasks balance better
            else msg = `${sp.n} blocks spread evenly over ${cores} threads: every core stays busy and the job is ${ctx.util.fmt(WORK / T, 0)}× faster than on one core. Same code, bigger machine, no changes.`;  // tasks that divide evenly: every core stays busy, and the same code runs faster on a bigger machine
            say.innerHTML = msg;  // shows the explanation
          }  // ends paint()
          paint();  // draws the first result when the step opens
          el.append(h('div', { class: 'split l fill' },  // places the explanation and the demo side by side on the step
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: who does what
              h('p', { class: 'm0', html: 'Level 3, one program on many cores at once, needs work that can run in parallel. Three parties share that job:' }),  // intro: level 3 needs work that can run in parallel, and three parties share that job
              h('div', { class: 'role' }, h('span', { class: 'chip thread' }, 'Developer'), h('span', {}, 'splits the application into tasks that can run independently.')),  // role card: the developer splits the application into independent tasks
              h('div', { class: 'role' }, h('span', { class: 'chip cpu' }, 'Compiler + language'), h('span', {}, 'make those tasks easy to express, e.g. blocks, closures, parallel loops.')),  // role card: compilers and languages make those tasks easy to express
              h('div', { class: 'role' }, h('span', { class: 'chip os' }, 'Operating system'), h('span', {}, 'allocates cores and other resources among the parallel tasks efficiently.')),  // role card: the OS allocates cores and other resources among the tasks
              h('div', { class: 'callout why m0', 'data-label': 'Real example: Grand Central Dispatch', html: 'On macOS and iOS, <span class="t">Grand Central Dispatch (GCD)</span> lets a developer wrap each independent piece of work in a <b>block</b> (code bundled with the values it uses) and put it on a dispatch queue. GCD feeds queued blocks to a <span class="t">thread pool</span> sized to the cores; the developer never creates or schedules a thread.' }),  // callout: GCD as a real example, blocks on dispatch queues fed to a thread pool sized to the cores
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'More cores cannot speed up one big task. The developer must expose the parallelism first.' })),  // common-mistake callout: more cores cannot speed up one big task
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the controls, code, timeline and results
              h('div', { class: 'ctl-row' }, h('span', { class: 'b small' }, 'Developer’s split'), segSplit),  // control row: the developer's split
              h('div', { class: 'ctl-row' }, h('span', { class: 'b small' }, 'Machine'), segCores),  // control row: the machine size
              codeBox,  // the code listing for the chosen split
              h('div', { class: 'card white tight' }, svg),  // the timeline drawing in a tight white card
              h('div', { class: 'kpis' }, h('div', {}, h('div', { class: 'xs muted b' }, 'FINISHES AFTER'), kT), h('div', {}, h('div', { class: 'xs muted b' }, 'SPEEDUP VS 1 CORE'), kS), h('div', {}, h('div', { class: 'xs muted b' }, 'CORES BUSY'), kU)),  // three result boxes: finishes after, speedup vs 1 core, cores busy
              say)));  // the explanation sentence closes the column
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Compare: time slicing vs dedicated cores (virtual machine approach) ---------------- */
      {  // step 7 begins: comparing time slicing with dedicated cores (the virtual machine approach)
        title: 'Time-slice every core, or dedicate cores?',  // title shown at the top of step 7
        kind: 'compare',  // kind 'compare': a screen that sets two approaches side by side
        render(el, ctx) {  // render(el, ctx) runs when step 7 is shown
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the guide's helpers
          const TICKS = 12, CORES = 8, PCLS = { A: 's-proc', B: 's-thread', C: 's-io', D: 's-cpu' };  // TICKS: twelve time slices; CORES: eight cores; PCLS: the color of each process A to D
          let mode = 'share';  // mode: 'share' (time-slice every core) or 'dedicate' (dedicated cores)
          // grid[t][core] = the thread that core runs during time slice t.
          // Same workload in both modes: 12 runnable threads (A1..D3), each needing 8 slices = 96 core-slices,
          // which exactly fills 8 cores × 12 slices, so every thread finishes by slice 12 either way.
          function schedule(m) {  // schedule(m): builds the whole timetable for one mode as grid[slice][core]
            const Q = [];  // Q will hold the twelve runnable threads
            for (let n = 1; n <= 3; n++) for (const P of 'ABCD') Q.push(P + n); // 12 runnable threads
            return Array.from({ length: TICKS }, (_, t) => Array.from({ length: CORES }, (_, k) => {  // builds twelve rows (slices), each a list of eight entries (cores)
              if (m === 'share') return Q[(8 * t + k) % 12]; // one shared queue: each core takes the next thread in line
              // dedicated: process P owns cores 2j and 2j+1 and packs its three 8-slice threads onto them itself.
              // First core: P1 for slices 1-8, then P2's last 4. Second core: P2 for slices 1-4, then P3 for slices 5-12.
              const P = 'ABCD'[k >> 1];  // dedicated mode: cores 0-1 belong to process A, 2-3 to B, 4-5 to C, 6-7 to D (k >> 1 halves the core number)
              return P + ((k & 1) === 0 ? (t < 8 ? 1 : 2) : (t < 4 ? 2 : 3));  // the first core of each pair runs thread 1 then thread 2; the second runs thread 2 then thread 3
            }));  // ends the timetable
          }  // ends schedule()
          function stats(grid, upto) {  // stats(grid, upto): counts context switches and cold-cache starts from slice 1 up to slice upto
            let sw = 0, cold = 0;  // sw: context switches; cold: runs that start on a core whose cache does not hold that thread's data
            const last = {};  // last: the core each thread ran on most recently
            for (let t = 0; t <= upto; t++) grid[t].forEach((th, k) => {  // walks every slice up to upto, and every core in it
              if (t > 0 && grid[t - 1][k] !== th) sw++;  // a core running a different thread from the slice before has made a context switch
              if (last[th] !== k) cold++;  // a thread on a different core from last time (or running for the first time) starts cold
              last[th] = k;  // remembers where this thread just ran
            });  // ends the walk
            return { sw, cold };  // returns both counts
          }  // ends stats()
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 340 250' : '0 0 640 250', width: '100%', role: 'img', 'aria-label': 'Eight cores over twelve time slices' });  // the drawing of eight cores over twelve slices, with memory underneath
          const kSw = h('div', { class: 'v' }), kCold = h('div', { class: 'v' }), kOS = h('div', { class: 'v' }), kWork = h('div', { class: 'v' });  // four big numbers: context switches, cold-cache starts, OS scheduler runs, and work done
          const X0 = ctx.narrow ? 50 : 62, CW = ctx.narrow ? 23.8 : 47, RH = 21;  // X0: where the grid starts; CW: the width of one slice column; RH: the height of one core row
          function draw(i) {  // draw(i): the player calls this to show the timetable up to slice i; it returns the caption
            const grid = schedule(mode), kids = [];  // grid: the timetable for the current mode; kids collects the shapes
            for (let t = 0; t < TICKS; t++) kids.push(s('text', { x: X0 + t * CW + CW / 2, y: 13, 'text-anchor': 'middle', 'font-size': 12.5, class: t <= i ? '' : 'tx-muted', 'font-weight': t === i ? 800 : 400 }, 't' + (t + 1)));  // slice labels t1 to t12 across the top; future slices are grey and the current one bold
            for (let k = 0; k < CORES; k++) {  // one row per core
              const y = 20 + k * RH;  // y: the top of this core's row
              kids.push(s('text', { x: X0 - 8, y: y + 14.5, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 'tx-cpu' }, 'core ' + k));  // the row's label on the left, e.g. "core 3"
              for (let t = 0; t < TICKS; t++) {  // one cell per slice
                const th = grid[t][k], x = X0 + t * CW;  // th: the thread this core runs in slice t; x: the cell's left edge
                if (t > i) { kids.push(s('rect', { x: x + 1, y: y + 1, width: CW - 2, height: RH - 3, rx: 3, class: 's-panel', 'stroke-width': 1 })); continue; }  // a slice not reached yet is an empty grey cell
                kids.push(s('rect', { x: x + 1, y: y + 1, width: CW - 2, height: RH - 3, rx: 3, class: PCLS[th[0]], 'stroke-width': 1.5 }));  // a reached slice is colored by its process (th[0] is the process letter)
                kids.push(s('text', { x: x + CW / 2, y: y + 14.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, th));  // the thread's name inside the cell, e.g. "B2"
                if (t > 0 && grid[t - 1][k] !== th) kids.push(s('line', { x1: x, y1: y, x2: x, y2: y + RH - 1, style: 'stroke:var(--bad)', 'stroke-width': 3 }));  // a red bar at the left edge of any cell where the core switched to a different thread
              }  // ends the loop over slices
            }  // ends the loop over cores
            // memory: interleaved pages versus one block per process
            const my = 20 + CORES * RH + 16;  // my: the top of the memory strip under the grid
            kids.push(s('text', { x: X0 - 8, y: my + 17, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 'tx-mem' }, ctx.narrow ? 'RAM' : 'memory'));  // the strip's label: "memory", or "RAM" on phones
            if (mode === 'share') {  // time-sliced mode: every process's pages are mixed together
              const pat = 'ABCADBCDBACDCABD';  // pat: a fixed jumbled order of page owners
              [...pat].forEach((p, j) => kids.push(s('rect', { x: X0 + j * (CW * TICKS / 16) + 1, y: my + 2, width: CW * TICKS / 16 - 2, height: 22, rx: 3, class: PCLS[p], 'stroke-width': 1 })));  // sixteen small page boxes in that jumbled order, each colored by its owner
              kids.push(s('text', { x: ctx.narrow ? 4 : X0, y: my + 44, 'font-size': 12.5, class: 'tx-muted' }, ctx.narrow ? 'pages of all processes mixed in one pool' : 'pages of every process mixed in one shared pool'));  // caption: pages of every process mixed in one shared pool
            } else {  // dedicated mode: one block of memory per process
              'ABCD'.split('').forEach((p, j) => {  // four blocks, one for each of A, B, C and D
                kids.push(s('rect', { x: X0 + j * (CW * 3) + 1, y: my + 2, width: CW * 3 - 2, height: 22, rx: 4, class: PCLS[p], 'stroke-width': 1.5 }));  // the block, colored by its process
                kids.push(s('text', { x: X0 + j * CW * 3 + CW * 1.5, y: my + 17.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, 'process ' + p));  // its label, e.g. "process A"
              });  // ends the loop over memory blocks
              kids.push(s('text', { x: ctx.narrow ? 4 : X0, y: my + 44, 'font-size': 12.5, class: 'tx-muted' }, ctx.narrow ? 'each process gets its own block of memory' : 'the OS hands each process its own block of memory, like a hypervisor'));  // caption: the OS hands each process its own block of memory, like a hypervisor
            }  // ends the choice of memory picture
            svg.replaceChildren(...kids);  // swaps the finished shapes into the drawing
            const st = stats(grid, i), other = stats(schedule('share'), i);  // st: the counts for this mode so far; other: the time-sliced counts, used for comparison in the final caption
            kSw.textContent = st.sw; kCold.textContent = st.cold;  // big numbers: context switches and cold-cache starts so far
            // time slicing runs the OS scheduler on every core at every slice; dedicated cores are loaded once,
            // and after that each process switches among its own threads on its own cores
            kOS.textContent = mode === 'share' ? String(CORES * (i + 1)) : String(CORES);  // big number: OS scheduler runs, eight per slice when time slicing, only the first eight loads when cores are dedicated
            kWork.textContent = `${CORES * (i + 1)} / ${CORES * TICKS}`; // identical in both modes: the same work gets done
            if (mode === 'share') {  // captions for the time-sliced mode
              if (i === 0) return '<b>Slice 1.</b> Twelve threads (three each from processes A to D), each needing 8 slices of work, want eight cores. The OS loads eight; four wait in the shared ready queue.';  // slice 1: twelve threads want eight cores, so eight are loaded and four wait
              if (i < TICKS - 1) return `<b>Slice ${i + 1}.</b> The timer fires on every core. Each saves its thread, runs the scheduler and loads another: 8 more context switches (red marks), and every thread starts on a core whose cache holds other threads’ data: a cold start.`;  // middle slices: the timer fires on every core, giving eight more switches and cold caches each slice
              return `<b>After 12 slices:</b> every thread got its 8 slices (96 core-slices of work), at a cost of ${st.sw} context switches and ${st.cold} cold-cache starts. Every core lost part of every slice to switching.`;  // after slice 12: all the work is done, at the cost of the switches and cold starts counted so far
            }  // ends the time-sliced captions
            if (i === 0) return '<b>Slice 1.</b> Like a hypervisor, the OS gives each process two whole cores and a block of memory, then steps back. Each process runs the same three threads on its own two cores: A1 and A2 start, A3 waits.';  // dedicated slice 1: the OS gives each process two cores and a memory block, then steps back
            if (i === 4) return '<b>Slice 5.</b> Each process parks its second thread and starts its third (red marks), so all three can still finish by slice 12. The switch stays inside one process, with no change of address space, so it is cheaper.';  // dedicated slice 5: each process parks its second thread and starts its third, a cheaper switch inside one process
            if (i === 8) return '<b>Slice 9.</b> The first threads have had their 8 slices, so each process gives that core to its parked second thread for its last 4 slices. It changed cores, so it restarts with a cold cache.';  // dedicated slice 9: the parked second threads resume on the freed cores, starting cold because they moved
            if (i < TICKS - 1) return `<b>Slice ${i + 1}.</b> Nothing to decide. Every core keeps running the same thread of the same process: no context switch, and its caches stay warm.`;  // other dedicated slices: nothing to decide, no switches, warm caches
            return `<b>After 12 slices:</b> the same 96 core-slices of work are done, with ${st.sw} context switches (all inside a process) and ${st.cold} cold starts instead of ${other.sw} and ${other.cold}. The OS itself scheduled only the first 8 loads.`;  // dedicated after slice 12: the same work with far fewer switches and cold starts than time slicing
          }  // ends draw()
          const player = ctx.ui.player({ count: TICKS, render: draw, interval: 900, captionBelow: true });  // player: the guide's step-through player for the twelve slices (0.9 seconds each), with the caption under the controls
          const seg = ctx.ui.seg([{ value: 'share', label: 'Time-slice every core' }, { value: 'dedicate', label: 'Dedicate cores (virtual machine approach)' }], mode, (v) => { mode = v; player.stop(); player.go(player.index === 0 ? TICKS - 1 : player.index); }); // same slice in both modes, so the numbers compare directly
          el.append(h('div', { class: 'split l fill' },  // places the explanation and the demo side by side on the step
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: the explanation text
              h('p', { class: 'm0', html: 'With a few cores, the classic OS job is <span class="t">time slicing</span>: each core is shared among many threads, switching every few milliseconds.' }),  // paragraph: with few cores, the classic job is time slicing each core among many threads
              h('p', { class: 'm0', html: 'With dozens of cores there are enough to go round. That suggests the <span class="t">virtual machine approach</span>: dedicate one or more cores to a process and <b>leave them alone</b>, so each core devotes itself to that process.' }),  // paragraph: with dozens of cores, the virtual machine approach dedicates cores to a process and leaves them alone
              h('p', { class: 'm0', html: 'The OS then allocates <b>cores and memory</b> rather than slices of time, acting more like a <span class="t">hypervisor</span>. Each process decides how to use what it was given, as a virtual machine would.' }),  // paragraph: the OS then hands out cores and memory, acting more like a hypervisor
              h('div', { class: 'callout why m0', 'data-label': 'Why it helps', html: 'Each <span class="t">context switch</span> costs time to save and load registers, and the newcomer then runs slowly while the caches refill. Fewer switches, more real work.' }),  // why-it-helps callout: every context switch costs time and leaves the caches cold
              h('div', { class: 'callout warn m0', 'data-label': 'Trade-off', html: 'A dedicated core that its process leaves idle, say while it waits for the disk, is wasted. It pays off when cores are plentiful.' })),  // trade-off callout: a dedicated core its process leaves idle is wasted
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the mode switch, drawing, numbers and player
              seg,  // the mode switch
              h('div', { class: 'card white tight' }, svg),  // the drawing in a tight white card
              h('div', { class: 'kpis k4' }, h('div', {}, h('div', { class: 'xs muted b' }, 'CONTEXT SWITCHES'), kSw), h('div', {}, h('div', { class: 'xs muted b' }, 'COLD-CACHE STARTS'), kCold), h('div', {}, h('div', { class: 'xs muted b' }, 'OS SCHEDULER RUNS'), kOS), h('div', {}, h('div', { class: 'xs muted b' }, 'WORK DONE'), kWork)),  // four result boxes: context switches, cold-cache starts, OS scheduler runs, work done
              player.el)));  // the player controls and caption close the column
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. Recap ---------------- */
      {  // step 8 begins: the recap
        title: 'Recap: eight ideas to carry with you',  // title shown at the top of the recap
        kind: 'recap',  // kind 'recap': a summary screen (it stays on the shorter core path)
        render(el, ctx) {  // render(el, ctx) runs when the recap is shown
          if (ctx.narrow) el.classList.add('nar'); // phone layout tweaks (see css)
          const { h } = ctx;  // takes the HTML builder h from the guide's helpers
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // recap layout: instruction, flip cards, then a closing sentence
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Then flip it to check.'),  // instruction: say each answer aloud before flipping the card
            ctx.ui.flipcards([  // flipcards: the guide's cards that turn over on a click to show the answer
              ['What is self-scheduling in an SMP?', 'No boss processor: each processor runs the scheduler itself and takes its next process or thread from a shared pool.'],  // flip card: what self-scheduling means
              ['Two dangers of one shared ready queue?', '<span>Two processors pick the <b>same</b> process, or a process is <b>lost</b> from the queue. A lock around the queue code prevents both.</span>'],  // flip card: the two dangers of one shared ready queue
              ['Why must kernel routines be reentrant?', 'Several processors can run the same routine at the same moment. Reentrant code keeps each caller’s data separate, so the calls cannot corrupt each other.'],  // flip card: why kernel routines must be reentrant
              ['The five SMP design issues?', 'Simultaneous concurrent processes or threads · Scheduling · Synchronization · Memory management · Reliability and fault tolerance.'],  // flip card: the five SMP design issues
              ['What must the OS do when a processor fails?', 'Recognize the loss and restructure its management tables, so it degrades gracefully instead of losing work or hanging.'],  // flip card: what the OS must do when a processor fails
              ['The three levels of multicore parallelism?', 'Inside each core (ILP) · within each core over time (multiprogramming and multithreading) · one application across several cores.'],  // flip card: the three levels of multicore parallelism
              ['Who makes parallelism within applications work?', 'The developer splits the work, compilers and languages help express it, and the OS allocates resources (for example GCD’s thread pool).'],  // flip card: who makes parallelism within applications work
              ['What is the virtual machine approach?', 'Dedicate whole cores and memory to a process and leave them alone. The OS acts like a hypervisor, and context switches nearly vanish.'],  // flip card: what the virtual machine approach is
            ], { cols: 4, height: 184 }),  // the cards sit four per row, each 184 pixels tall
            h('div', { class: 'callout tip m0', 'data-label': 'One sentence to remember', html: 'An SMP or multicore OS is still one OS, but it can no longer assume it is alone: every shared table needs protection, every processor schedules itself, and the real prize is getting applications to use all those cores.' })));  // closing callout: the one sentence to remember about SMP and multicore operating systems
        },  // ends render() for the recap
      },  // ends the recap step

      /* ---------------- 9. Check yourself ---------------- */
      {  // step 9 begins: the section quiz
        title: 'Check yourself',  // title shown at the top of the quiz step
        kind: 'check',  // kind 'check': the quiz screen, whose best first-try score is saved as this section's mastery
        quiz: [  // quiz: the list of questions; the guide's quiz engine draws and grades them
          { q: 'In a typical symmetric multiprocessor (SMP), how does a processor that needs work get its next process or thread?',  // question 1 (multiple choice): how an SMP processor gets its next process or thread
            choices: ['A master processor assigns it one', 'It runs the kernel’s scheduler itself and takes one from a shared pool', 'The user chooses a processor for each program', 'Each processor has a fixed list of processes decided at boot time'], answer: 1,  // the four choices; answer 1 (the second choice, counting from 0) is self-scheduling
            feedback: ['That is a master/worker design; in an SMP no processor is the boss.', null, 'The OS makes this choice every time; users normally never think about which processor runs their program.', 'A fixed list would leave some processors idle while others are overloaded.'],  // feedback: why each wrong choice is wrong (null for the right one)
            why: 'This is self-scheduling: the kernel can run on any processor, and each processor schedules itself from the pool of available processes or threads.' },  // explanation shown after answering: this is self-scheduling
          { type: 'multi', q: 'Several processors of an SMP take work from one shared ready queue. Which statements are true?',  // question 2 (select all that apply): facts about a shared ready queue
            choices: ['Without a lock, two processors can choose the same process', 'Without a lock, a process can be skipped and never run', 'Disabling interrupts on the processor running the scheduler is enough to protect the queue', 'Checking and taking a spinlock must be one atomic (indivisible) hardware instruction', 'The hardware automatically makes the read-the-front, then-advance sequence indivisible'], answer: [0, 1, 3],  // five choices; answers 0, 1 and 3 are true (double picks, lost processes, and the atomic spinlock)
            why: 'If two processors read the front before either advances it, both take the same process and the double advance skips the next one. Disabling interrupts only affects one processor, and the hardware does not bundle a multi-step sequence by itself; a lock built on an atomic instruction such as test-and-set does.' },  // explanation: why disabling interrupts is not enough and the hardware does not bundle steps by itself
          { type: 'match', q: 'Match each SMP design issue to a situation it covers.',  // question 3 (match the pairs): each design issue to a situation it covers
            pairs: [['Simultaneous concurrent processes or threads', 'Two CPUs execute the same kernel routine at once'], ['Scheduling', 'Threads of one process run on different CPUs together'], ['Synchronization', 'Two threads on different CPUs update a shared counter'], ['Memory management', 'Page replacement for a page two CPUs share'], ['Reliability and fault tolerance', 'Carrying on after one processor fails']],  // the five issue and situation pairs
            why: 'Concurrent kernel code needs reentrancy and protected tables; scheduling must avoid conflicts and can run a process’s threads in parallel; synchronization protects shared memory and I/O; memory management coordinates paging; reliability means graceful degradation.' },  // explanation of each match
          { type: 'tf', q: 'A kernel routine that keeps its working data in one global variable is safe on an SMP, provided the routine is short.', answer: false,  // question 4 (true or false): a short routine with global data is safe (false)
            why: 'However short it is, two processors can be inside it at the same moment and overwrite each other’s data. It must be reentrant (data on each caller’s own stack) or guarded by a lock.' },  // explanation: two processors can be inside it at once however short it is
          { type: 'tf', q: 'With kernel-level threads, an SMP scheduler can run several threads of the same process on different processors at the same moment.', answer: true,  // question 5 (true or false): kernel-level threads let one process run on several CPUs at once (true)
            why: 'The kernel sees and schedules each thread separately, so it can place threads of one process on several processors at once, which is how a multithreaded program gets faster.' },  // explanation: the kernel schedules each thread separately
          { q: 'CPU 0’s memory manager wants to evict a page that a process on CPU 1 is still using through a shared mapping. What should an SMP memory manager do?',  // question 6 (multiple choice): what to do about evicting a page another CPU still uses
            choices: ['Evict it at once; CPU 1 will notice eventually', 'Coordinate with the other processors: avoid removing a page in use, and make every processor forget its saved location before the frame is reused', 'Copy the page into CPU 0’s registers', 'Shut CPU 1 down before evicting'], answer: 1,  // the four choices; answer 1 is to coordinate with the other processors
            feedback: ['CPU 1 would go on reading the frame after it holds someone else’s data.', null, 'A page is thousands of bytes; registers hold a few values and this solves nothing.', 'Far too drastic; the processors only need to coordinate.'],  // feedback: why evicting at once, copying to registers, or shutting CPU 1 down are wrong
            why: 'Paging mechanisms on different processors must be coordinated so shared pages stay consistent and replacement never pulls a page out from under a processor that is using it.' },  // explanation: paging on different processors must be coordinated
          { type: 'num', q: 'An SMP has 8 equally fast processors. Two of them fail, and the OS recognizes the loss and restructures its tables. What percentage of the original processing capacity remains?', answer: 75, tol: 0.5, unit: '%',  // question 7 (calculate): capacity left after 2 of 8 processors fail, accepted within 0.5 of 75%
            why: '6 working processors out of 8 is 6 ÷ 8 = 0.75, so 75% remains. That proportional loss, rather than a crash, is graceful degradation.' },  // explanation: 6 of 8 is 75%, a proportional loss rather than a crash
          { type: 'bucket', q: 'Which level of multicore parallelism does each situation show?', buckets: ['1: in a core', '2: over time', '3: across cores'],  // question 8 (sort into groups): the level of parallelism in each situation
            items: [['Pipeline overlaps fetch and execute', 0], ['OS swaps one core between two apps', 1], ['Game threads run on two cores at once', 2], ['Two independent adds in one clock cycle', 0], ['Another thread runs during a disk wait', 1], ['Encoder spreads a frame over four cores', 2]],  // six situations, two for each level
            why: 'ILP overlaps instructions of one stream inside a core; multiprogramming and multithreading share one core over time; the third level splits one application across cores.' },  // explanation of the three levels
          { q: 'With Grand Central Dispatch on macOS or iOS, what does the application developer do?',  // question 9 (multiple choice): what the developer does with GCD
            choices: ['Creates one thread per core and schedules them by hand', 'Wraps independent pieces of work in blocks and places them on dispatch queues', 'Writes a new scheduler for the kernel', 'Pins each block to a particular core number'], answer: 1,  // the four choices; answer 1 is wrapping work in blocks on dispatch queues
            feedback: ['That is exactly the work GCD takes off the developer’s hands.', null, 'GCD is used by ordinary applications; nobody rewrites the kernel.', 'GCD decides where blocks run, using a pool sized to the available cores.'],  // feedback: why the other choices describe work GCD or the kernel does instead
            why: 'The developer marks what can run in parallel; GCD keeps a thread pool sized to the cores and feeds it the queued blocks.' },  // explanation: the developer marks what can run in parallel and GCD runs it on a pool
          { type: 'num', q: 'A program queues 12 independent tasks of 8 ms each. A thread pool of 8 threads runs on 8 cores, and each task goes to the next free thread. How many milliseconds until every task has finished?', answer: 16, tol: 0, unit: 'ms',  // question 10 (calculate): 12 tasks of 8 ms on 8 threads finish after 16 ms
            why: 'The first round runs 8 tasks (8 ms); the remaining 4 need a second round (8 ms more). 8 + 8 = 16 ms, with half the cores idle in the second round.' },  // explanation: two rounds of 8 ms, with half the cores idle in the second
          { q: 'In the virtual machine approach to multicore, what does the OS mainly hand out?',  // question 11 (multiple choice): what the OS hands out in the virtual machine approach
            choices: ['Short time slices on each core', 'Whole cores and blocks of memory, like a hypervisor', 'Individual instructions to pipeline stages', 'Disk blocks to files'], answer: 1,  // the four choices; answer 1 is whole cores and memory blocks
            feedback: ['That is the classic time-slicing approach this idea moves away from.', null, 'The hardware does that inside each core; the OS never sees it.', 'That is file management, not processor allocation.'],  // feedback: why time slices, pipeline stages or disk blocks are wrong
            why: 'With plenty of cores, the OS dedicates cores (and memory) to a process and leaves them alone, acting more like a hypervisor than a time-slicer.' },  // explanation: the OS dedicates cores and memory, like a hypervisor
          { q: 'Why does dedicating cores to processes usually improve performance?',  // question 12 (multiple choice): why dedicating cores usually improves performance
            choices: ['It removes the need for main memory', 'It cuts context switches, so less time is spent switching and caches stay warm', 'It raises each core’s clock speed', 'It lets two processes share one set of registers'], answer: 1,  // the four choices; answer 1 is fewer context switches and warm caches
            feedback: ['Processes still need memory; the OS allocates it to them.', null, 'Clock speed is set by the hardware, not by the scheduling policy.', 'Sharing registers between processes would corrupt both of them.'],  // feedback: why memory, clock speed or shared registers are wrong
            why: 'Each context switch costs time directly and leaves the caches cold. A core devoted to one process rarely switches, so more of its time goes to useful work.' },  // explanation: a core devoted to one process rarely switches, so more of its time is useful work
        ],  // closes the quiz list
      },  // ends the quiz step

    ],  // closes the steps list

    notes: `${/* notes: the section's reference notes, opened from the notes button; written as HTML text */''}
<h3>Why several processors change the operating system</h3>${/* notes heading: why several processors change the operating system */''}
<p>On a uniprocessor at most one piece of kernel code executes at any instant, and the kernel can guard a table just by briefly disabling interrupts. In a <b>symmetric multiprocessor (SMP)</b> the kernel can execute on <b>any</b> processor, and disabling interrupts on one processor does nothing to stop the others, so shared kernel data needs <b>locks</b>. Usually no processor is in charge: each does <b>self-scheduling</b>, running the scheduler itself to take its next process or thread from a shared pool. The kernel can also be built as several processes or threads that run in parallel.</p>${/* notes paragraph: one CPU could guard tables by disabling interrupts; an SMP needs locks and uses self-scheduling */''}
<p>The OS must ensure that no two processors choose the same process and that no process is lost from the queue.</p>${/* notes paragraph: no process may be chosen twice or lost from the queue */''}

<h3>The race on a shared ready queue</h3>${/* notes heading: the race on a shared ready queue */''}
<pre>acquire(lock);        // spin until free, then take it${/* notes code, line 1: acquire the lock, spinning until it is free */''}
next = ready[front];  // read the front entry${/* notes code, line 2: read the entry at the front of the queue */''}
front = front + 1;    // step past that entry${/* notes code, line 3: move the front past that entry */''}
release(lock);        // let another CPU in${/* notes code, line 4: release the lock for another CPU */''}
run(next);            // run the chosen process</pre>${/* notes code, line 5: run the chosen process; end of the code block */''}
<p><b>Without the lock</b> the result depends on timing: a <b>race condition</b>. CPU 0 reads ready[0] = P1, CPU 1 also reads P1, then CPU 0 sets front = 1 and CPU 1 sets front = 2. P1 now runs on two processors at once, both using its one saved context and stack, and P2 is skipped (lost). A lucky order hides the bug; it does not fix it.</p>${/* notes paragraph: without the lock, P1 runs on two CPUs and P2 is skipped, and a lucky order only hides the bug */''}
<p><b>With the lock</b>, read-and-advance is indivisible: while one CPU is inside, the others wait, so every process is taken exactly once. It is a <b>spinlock</b> (a waiting CPU loops until the lock is free), cheap because the protected code is short. Checking and taking the lock is one <b>atomic</b> hardware instruction, such as test-and-set, so two CPUs can never both grab it.</p>${/* notes paragraph: with the lock, read-and-advance is indivisible; it is a spinlock built on an atomic instruction */''}

<h3>The five key design issues of an SMP OS</h3>${/* notes heading: the five key design issues of an SMP OS */''}
<table>${/* start of the design-issues table */''}
  <tr><th>Issue</th><th>What the OS must handle</th><th>Example and fix</th></tr>${/* table header row: issue, what the OS must handle, example and fix */''}
  <tr><td>1. Simultaneous concurrent processes or threads</td><td>Several processors may run the same kernel routine at once. Kernel routines must be <b>reentrant</b>, and kernel tables must be managed so simultaneous use cannot corrupt them or cause invalid operations.</td><td>A global scratch buffer makes one call open the wrong file. Fix: per-call data on each caller's own kernel stack, plus a lock on the shared table.</td></tr>${/* table row: simultaneous concurrent processes or threads */''}
  <tr><td>2. Scheduling</td><td>Any processor may schedule, so conflicts must be avoided (no two pick the same process). With kernel-level threads, several threads of one process can run on different processors at the same time.</td><td>Three ready threads on three free CPUs finish in 1 slot instead of 3.</td></tr>${/* table row: scheduling */''}
  <tr><td>3. Synchronization</td><td>Processes may share address spaces or I/O resources, so the OS must provide mutual exclusion and event ordering. Locks are the most common tool.</td><td>Two threads each sell a seat: both read 10 and write 9, so one sale is lost. With a lock: 10, 9, 8.</td></tr>${/* table row: synchronization */''}
  <tr><td>4. Memory management</td><td>All uniprocessor duties, plus exploiting hardware parallelism (e.g. multiported memory serving several processors at once) and coordinating paging across processors, so shared pages stay consistent and replacement is safe.</td><td>Each CPU caches recent page locations. CPU 0 evicts shared page 7 while CPU 1 still uses it, so CPU 1 reads another process's data. Fix: replacement considers all CPUs, and every CPU forgets the page's location before its frame is reused.</td></tr>${/* table row: memory management */''}
  <tr><td>5. Reliability and fault tolerance</td><td>Degrade gracefully when a processor fails: the scheduler and the rest of the OS must recognize the loss and restructure their management tables.</td><td>See the worked example below.</td></tr>${/* table row: reliability and fault tolerance */''}
</table>${/* end of the design-issues table */''}

<h3>Graceful degradation: a worked example</h3>${/* notes heading: graceful degradation, a worked example */''}
<p>Twelve jobs each need 4 units of work (48 units), and each job saves a checkpoint after every finished unit. With 4 processors the batch takes 48 / 4 = <b>12 ticks</b>. Suppose CPU 2 dies after tick 3 while running J3 (3 units done). The OS notices the missed <b>heartbeat</b> (each processor regularly checks in; a silent one is declared failed), marks CPU 2 <b>offline</b>, stops scheduling on it and requeues J3, which resumes from its checkpoint (without one it would restart from the beginning). Three processors finish at tick 16. Capacity falls to 3 / 4 = 75%, but every job completes.</p>${/* notes paragraph: CPU 2 dies at tick 3, the OS requeues J3 from its checkpoint, and three CPUs finish at tick 16 */''}
<p>An OS that ignores the loss still lists CPU 2 as online and running J3, so J3 never finishes (11 of 12 done). <b>Rule of thumb:</b> remaining capacity = working processors ÷ total processors; 2 failures out of 8 leave 6 / 8 = 75%.</p>${/* notes paragraph: an OS that ignores the loss leaves J3 unfinished; capacity left equals working over total processors */''}

<h3>Multicore: exploiting the parallelism</h3>${/* notes heading: multicore, exploiting the parallelism */''}
<p>A multicore chip is an SMP on one piece of silicon, so every SMP issue above still applies. The extra challenge is to <b>exploit the available parallelism effectively</b>. It exists at three levels:</p>${/* notes paragraph: a multicore chip is an SMP on one chip, and its parallelism exists at three levels */''}
<ol>${/* start of the list of levels */''}
  <li><b>Hardware parallelism within each core</b>: instruction-level parallelism (ILP). A pipeline overlaps several instructions from one stream, and many cores start more than one per cycle. The hardware exploits it (compilers help), not the OS.</li>${/* notes item: level 1, instruction-level parallelism inside a core, exploited by the hardware */''}
  <li><b>Multiprogramming and multithreaded execution within each core</b>: one core is shared over time among several processes and threads. The OS scheduler handles this, separately for every core.</li>${/* notes item: level 2, one core shared over time, handled by the OS scheduler */''}
  <li><b>One application running as concurrent processes or threads across several cores</b>: the hardest level, needing the developer, language tools and the OS to cooperate.</li>${/* notes item: level 3, one application across several cores, the hardest level */''}
</ol>${/* end of the list of levels */''}

<h3>Parallelism within applications</h3>${/* notes heading: parallelism within applications */''}
<ul>${/* start of the list of roles */''}
  <li>The <b>developer</b> decides how to split the application into tasks that can run independently.</li>${/* notes item: the developer splits the work into independent tasks */''}
  <li><b>Compilers and programming languages</b> make those tasks easy to express (blocks, closures, parallel loops).</li>${/* notes item: compilers and languages make those tasks easy to express */''}
  <li>The <b>OS</b> allocates resources, such as cores, among the parallel tasks efficiently.</li>${/* notes item: the OS allocates cores among the tasks */''}
</ul>${/* end of the list of roles */''}
<p><b>Grand Central Dispatch (GCD)</b> on macOS and iOS is a real example. The developer wraps each independent piece of work in a block and adds it to a dispatch queue (e.g. with dispatch_async). GCD keeps a <b>thread pool</b> sized to the available cores and feeds it the queued blocks; the developer never creates or schedules a thread.</p>${/* notes paragraph: Grand Central Dispatch, blocks on dispatch queues fed to a thread pool sized to the cores */''}
<p><b>Worked example.</b> Filtering 12 photos takes 8 ms each, 96 ms of work. As one big task it takes 96 ms however many cores exist. As 12 tasks: time = (12 ÷ cores, rounded up) × 8 ms, so 48 ms on 2 cores, 24 ms on 4 and 16 ms on 8 (the second round is half empty: 75% busy). As 48 quarter-photo tasks of 2 ms, 8 cores finish in 48 ÷ 8 × 2 = 12 ms with every core busy. Smaller tasks balance better, though each task also carries a small scheduling cost.</p>${/* notes paragraph: the photo-filter worked example, with finish times for each split and core count */''}

<h3>The virtual machine approach</h3>${/* notes heading: the virtual machine approach */''}
<p>With few cores, the classic OS job is <b>time slicing</b>: a timer forces a <b>context switch</b> on each core every few milliseconds. Each switch costs time to save and load registers, and the newcomer runs slowly while the caches refill.</p>${/* notes paragraph: time slicing forces a context switch on every core every few milliseconds, at a cost */''}
<p>With many cores there are enough to go round. The <b>virtual machine approach</b> dedicates one or more whole cores to a process and leaves them alone. The OS allocates <b>cores and memory</b> instead of time slices, much like a <b>hypervisor</b> handing resources to virtual machines, and each process decides how to use what it got. Context-switch overhead almost disappears.</p>${/* notes paragraph: with many cores, dedicate whole cores and memory to a process, like a hypervisor */''}
<p><b>Example (the same work both ways).</b> Processes A to D have 3 runnable threads each (12 threads), and every thread needs 8 slices of work: 12 × 8 = 96 core-slices, which exactly fills 8 cores for 12 slices. <b>Time slicing</b> from one shared queue: every core switches at every slice boundary, 8 × 11 = <b>88 context switches</b>, and because each thread comes back on a different core, all 96 runs start with a cold cache. The OS scheduler runs 8 × 12 = 96 times. <b>Dedicated cores:</b> each process gets 2 cores and shares them among its own 3 threads. Three 8-slice threads fit on two 12-slice cores only if one thread is split, so the first core runs thread 1 for slices 1 to 8 and then thread 2's last 4 slices, while the second core runs thread 2 for slices 1 to 4 and then thread 3 for slices 5 to 12. Every thread still gets its 8 slices and all finish by slice 12, but there are only 2 switches per process, <b>8 in all</b>, each between threads of the same process (no change of address space, so cheaper), and 16 cold starts (the 8 first loads, the 4 third threads starting, and the 4 second threads that changed cores). The OS scheduler ran only for the 8 first loads. <b>Trade-off:</b> a dedicated core that its process leaves idle (say, waiting for I/O) is wasted, so the approach pays off when cores are plentiful.</p>${/* notes paragraph: the worked comparison, 88 switches with time slicing versus 8 with dedicated cores, and the trade-off */''}
`,  // end of the notes text
  });  // closes the section object and the call that registers it
})();  // ends the IIFE and runs it at once
