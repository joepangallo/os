/* Section 1.8 Multiprocessor and Multicore Organization
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {
  /* ------------------------------------------------------------------ shared helpers */
  // multi-line SVG text: lines is a string or an array of strings (one tspan per line)
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {
    const t = s('text', Object.assign({ x, y }, attrs));
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));
    return t;
  }
  // a clickable SVG group that works with mouse, keyboard and scripted checks
  function hotGroup(ctx, onAct, label, ...kids) {
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);
    g.addEventListener('click', onAct);
    // SVG elements have no .click(); automated checks send synthetic pointer events, so accept those too
    g.addEventListener('pointerdown', (e) => { if (!e.isTrusted) onAct(); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });
    return g;
  }

  /* ------------------------------------------------------------------ step 5 data: the machine builder */
  const MODES = [
    { value: 'uni', label: 'Uniprocessor' }, { value: 'smp', label: 'SMP' },
    { value: 'multi', label: 'Multicore chip' }, { value: 'i7', label: 'Real chip: Core i7-5960X' },
  ];
  const MODE_TEXT = {
    uni: { name: 'Uniprocessor', chips: ['1 processor', '1 chip', 'private L1 + L2'],
      what: 'One processor with its own <span class="t">control unit</span>, ALU, registers and <span class="t">pipeline</span>, backed by private L1 and L2 caches. Main memory and the I/O devices hang off one system bus.' },
    smp: { name: 'Symmetric multiprocessor', chips: ['3 processors', '3 chips', 'shared bus + memory'],
      what: 'The same processor, three times over. Each is a <b>separate chip</b> with its own private caches. All three share <b>one bus, one main memory and one set of I/O devices</b>, and can pass data to each other through memory.' },
    multi: { name: 'Multicore chip', chips: ['4 cores', '1 chip (die)', 'private L1 + L2, shared L3'],
      what: 'The processors shrink into <b>cores on one <span class="t">die</span></b>. Each core keeps its own control unit, ALU, registers, pipeline and L1 caches. Here each core also has a private L2, and one big <b>L3 is shared</b> by all the cores.' },
    i7: { name: 'Intel Core i7-5960X (2014)', chips: ['8 x86 cores', '256 KB L2 each', '20 MB shared L3'],
      what: 'A real desktop chip: <b>eight x86 cores</b>, each with a <b>dedicated L2</b>, all sharing a <b>20 MB L3</b>. The DDR4 <span class="t" data-t="Integrated memory controller">memory controller</span> and the <span class="t">PCI Express</span> connections are built onto the same die.' },
  };
  const PART_INFO = {
    chip: ['Chip', 'A processor chip in its own socket on the motherboard.'],
    proc: ['Processor', 'A self-contained processor: control unit, ALU, registers and pipeline, plus its own L1 caches. It can run a program entirely by itself.'],
    cu: ['Control unit', 'Fetches each instruction, decodes it and directs the other parts to carry it out. Every processor, and every core, has its own.'],
    alu: ['ALU', 'The arithmetic logic unit does the adding, comparing and logic. With one per processor or core, they can all compute at the same moment.'],
    regs: ['Registers', 'The processor’s own tiny, fastest storage (program counter, instruction register, data registers). A separate set per processor or core lets each follow its own program.'],
    pipe: ['Pipeline', 'Assembly-line hardware that overlaps the fetch, decode and execute stages of several instructions. Each processor or core has a complete pipeline of its own.'],
    l1: ['L1 cache (private)', 'The smallest, fastest cache, used by one processor or core alone. It is often split into an instruction cache (L1-I) and a data cache (L1-D).'],
    l2: ['L2 cache (private)', 'A larger, slightly slower cache behind L1, private to its processor or core. Because it is private, another processor never sees what is in it: remember this for cache coherence.'],
    l3: ['L3 cache (shared)', 'One large cache on the chip that every core uses. A block one core brings in can be found by the others without a trip to main memory, and busy cores can use more of the space.'],
    bus: ['System bus (shared)', 'The one path every processor uses to reach memory and I/O. It is simple, but it carries one transfer at a time, so processors sometimes wait their turn.'],
    mem: ['Main memory (shared)', 'One memory holds every program and its data. Because all processors see the same memory, they can communicate through it: one writes a value, another reads it.'],
    io: ['I/O subsystem (shared)', 'Disks, network and other devices. Every processor reaches them over the same bus, and any processor can start a transfer.'],
  };
  const PART_MODE = {
    uni: { chip: ['Chip', 'The whole processor, with its L1 and L2 caches, sits on a single chip.'] },
    smp: { chip: ['Separate chips', 'In this SMP each processor is its own chip in its own socket. The chips meet only on the shared bus.'],
      proc: ['Processor (one of three)', 'Each processor is self-contained: control unit, ALU, registers, pipeline and L1 caches. Any of the three can run any program, including the OS.'] },
    multi: { chip: ['One chip (die)', 'All four cores and the shared L3 sit on one slab of silicon. Cores exchange data on the chip itself, which is much faster than going out over the system bus.'],
      proc: ['Core', 'A complete processor shrunk to fit beside its neighbours on one die. To the OS, every core looks like a separate processor.'],
      l2: ['L2 cache (dedicated)', 'On this chip each core has its own L2, private to that core. (Some chip designs share L2 between cores instead.)'],
      bus: ['System bus', 'Takes requests that miss in every cache out of the chip to main memory and the I/O devices.'] },
    i7: { chip: ['The die', 'One slab of silicon holding all eight cores, their caches, the shared L3, the memory controller and the PCI Express lanes.'],
      proc: ['x86 core', 'One of eight complete cores. Each has its own control unit, ALU, registers and pipeline, plus two 32 KB L1 caches (one for instructions, one for data).'],
      l2: ['L2 cache: 256 KB, dedicated', 'Each core has its own 256 KB L2 cache. Eight cores × 256 KB = 2 MB of L2 in total, but no core can use another core’s L2.'],
      l3: ['L3 cache: 20 MB, shared', 'All eight cores share one 20 MB L3 cache on the die. It catches the misses from every core’s L2 before they have to go to main memory.'],
      imc: ['Integrated memory controller (DDR4)', 'Circuitry on the chip that drives the DDR4 memory modules over four channels. Building it in saves a trip through a separate chip on every memory access.'],
      pcie: ['PCI Express (40 lanes)', 'Fast links built into the chip that connect devices such as graphics cards and SSDs straight to the processor.'],
      mem: ['DDR4 main memory', 'The memory modules plugged into the motherboard. The cores reach them through the on-chip memory controller.'],
      io: ['PCIe devices', 'Graphics cards, solid-state drives and other fast devices attached through the chip’s PCI Express lanes.'] },
  };

  Guide.section({
    id: '1.8',
    title: 'Multiprocessor and Multicore Organization',
    short: 'Multiprocessors',
    summary: 'Why and how computers use several processors: SMPs, multicore chips, their payoffs and cache coherence.',
    objectives: [
      'Distinguish three ways of building parallel hardware: symmetric multiprocessors (SMPs), multicore computers and clusters.',
      'List the defining characteristics of an SMP and explain what makes it “symmetric”.',
      'Explain the four advantages of an SMP over a uniprocessor (performance, availability, incremental growth, scaling) and how the OS keeps the extra processors transparent to users.',
      'Describe how an SMP and a multicore chip are organized (private caches, shared caches, shared memory and bus), and explain the cache coherence problem and how invalidation solves it.',
      'Explain why chip makers switched to multicore designs, using the Intel Core i7-5960X as a real example.',
    ],
    terms: [
      ['Parallel processing', 'Doing several pieces of work at the same moment on separate processors, instead of one after another on a single processor.'],
      ['Uniprocessor', 'A computer with exactly one processor, so it can carry out only one stream of instructions at any moment.'],
      ['Symmetric multiprocessor (SMP)', 'One computer with two or more similar processors of comparable capability that share main memory and the I/O devices, can each perform any function, and are all controlled by one integrated operating system.'],
      ['Multicore computer (chip multiprocessor)', 'A computer whose processor chip holds two or more complete processors, called cores, built on a single piece of silicon (one die).'],
      ['Die', 'The single small slab of silicon on which a chip’s circuits are built. A multicore chip puts all of its cores, and usually some shared cache, on one die.'],
      ['Cluster', 'A group of complete, separate computers, each with its own memory and operating system, linked by a fast network and working together as if they were one bigger machine.'],
      ['Availability', 'How much of the time a system is up and doing useful work. In an SMP, the failure of one processor does not stop the machine, because the others carry on.'],
      ['Incremental growth', 'Making a system more powerful one step at a time, for example by adding a processor to an existing SMP instead of replacing the whole machine.'],
      ['Scaling', 'Offering a family of products at different prices and performance levels by building them with different numbers of processors.'],
      ['Transparency (transparent)', 'A mechanism is transparent when users cannot see it and need not do anything about it. In an SMP the OS spreads the work across the processors, so users need not know how many there are.'],
      ['Private cache', 'A cache used by one processor or core alone, such as each core’s L1 cache. Its opposite is a shared cache, used by all the cores on a chip, such as the L3 on many multicore chips.'],
      ['Cache coherence', 'Keeping every cached copy of the same memory data consistent, so that no processor or core keeps working with an out-of-date (stale) value after another one has changed it.'],
      ['Invalidation', 'A cache coherence technique: when one processor writes a data item, the hardware marks every other cache’s copy of the block (cache line) holding that item invalid, so the next read of it misses and fetches the new value.'],
      ['Bus snooping (snooping)', 'A hardware technique in which every cache controller watches the shared bus for other processors’ writes, so it can invalidate its own copy of anything that changed.'],
      ['Control unit', 'The part of a processor that fetches and decodes instructions and sends the signals that make the ALU, the registers and memory carry them out.'],
      ['Pipeline', 'Hardware inside a processor that works on several instructions at once, each at a different stage (fetch, decode, execute, and so on), like an assembly line.'],
      ['Clock speed (clock rate)', 'How many clock cycles a processor completes per second, measured in hertz. 3 GHz means 3 billion cycles per second; the processor does its work in steps timed by these ticks.'],
      ['Power wall', 'The limit reached in the mid-2000s when raising the clock speed further made chips use too much power and produce more heat than normal cooling could remove, so designers began adding cores instead.'],
      ['Integrated memory controller', 'Circuitry built onto the processor chip itself that drives the main-memory (DRAM) chips, so memory requests do not have to pass through a separate chip.'],
      ['PCI Express (PCIe)', 'A fast point-to-point connection standard for attaching devices such as graphics cards and solid-state drives. On many modern chips, including the Core i7-5960X, some PCIe lanes come straight out of the processor chip itself.'],
    ],
    css: `
      .sec-1-8 .step-eyebrow { flex-wrap: wrap; row-gap: 2px; contain: inline-size; }   /* long section title: wrap on phones instead of widening the page */
      .sec-1-8 .hot { cursor: pointer; outline: none; }
      .sec-1-8 .hot .fr { transition: stroke-width .12s; }
      .sec-1-8 .hot:hover .fr, .sec-1-8 .hot:focus-visible .fr { stroke-width: 3.5; }
      .sec-1-8 .tx-cpu { fill: var(--cpu); } .sec-1-8 .tx-mem { fill: var(--mem); } .sec-1-8 .tx-io { fill: var(--io); }
      .sec-1-8 .tx-os { fill: var(--os); } .sec-1-8 .tx-ok { fill: var(--ok); } .sec-1-8 .tx-bad { fill: var(--bad); }
      .sec-1-8 .tx-intr { fill: var(--intr); } .sec-1-8 .tx-warn { fill: var(--warn); } .sec-1-8 .tx-acc { fill: var(--accent); }
      .sec-1-8 .tx-muted { fill: var(--muted); }
      .sec-1-8 .c-cpu { color: var(--cpu); } .sec-1-8 .c-mem { color: var(--mem); } .sec-1-8 .c-io { color: var(--io); }
      .sec-1-8 .c-os { color: var(--os); } .sec-1-8 .c-ok { color: var(--ok); } .sec-1-8 .c-bad { color: var(--bad); }
      .sec-1-8 .c-intr { color: var(--intr); } .sec-1-8 .c-warn { color: var(--warn); } .sec-1-8 .c-acc { color: var(--accent); }
      .sec-1-8 .s-cache { fill: var(--accent-bg); stroke: var(--accent); }
      .sec-1-8 .dim { opacity: .35; transition: opacity .2s; }
      /* step 1: route pictures */
      .sec-1-8 .route { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 8px 8px 6px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; color: var(--ink); font: inherit; }
      .sec-1-8 .route:hover { border-color: var(--chc); }
      .sec-1-8 .route.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); }
      .sec-1-8 .route .rname { font-weight: 800; font-size: 15px; text-align: center; }
      /* step 2: the five marks */
      .sec-1-8 .feat { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; align-items: center; text-align: left; padding: 12px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); cursor: pointer; font: inherit; font-size: 15px; line-height: 1.3; color: var(--ink); }
      .sec-1-8 .feat:hover { border-color: var(--chc); }
      .sec-1-8 .feat .n { width: 26px; height: 26px; border-radius: 8px; background: var(--panel-3); display: grid; place-items: center; font-weight: 800; font-size: 14px; }
      .sec-1-8 .feat.seen .n { background: var(--ok-bg); color: var(--ok); }
      .sec-1-8 .feat.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); }
      .sec-1-8 .feat.on .n { background: var(--chc); color: var(--panel); }
      /* step 3: advantages lab */
      .sec-1-8 .sock { display: grid; grid-template-columns: 78px minmax(0, 1fr) 138px; gap: 12px; align-items: center; padding: 6px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); }
      .sec-1-8 .sock .lab { font-weight: 800; font-size: 14.5px; text-align: center; border: 2px solid var(--cpu); background: var(--cpu-bg); color: var(--cpu); border-radius: 8px; padding: 3px 0; }
      .sec-1-8 .sock .st { font-size: 14.5px; margin-bottom: 4px; }
      .sec-1-8 .sock .meter > i { background: var(--proc); }
      .sec-1-8 .sock .btn { width: 100%; }
      .sec-1-8 .sock.empty { border-style: dashed; background: transparent; }
      .sec-1-8 .sock.empty .lab { border-style: dashed; border-color: var(--line-2); background: transparent; color: var(--muted); font-weight: 650; }
      .sec-1-8 .sock.failed { background: var(--intr-bg); border-color: color-mix(in srgb, var(--intr) 40%, transparent); }
      .sec-1-8 .sock.failed .lab { border-color: var(--intr); background: var(--panel); color: var(--intr); text-decoration: line-through; }
      .sec-1-8 .jq { display: flex; gap: 4px; flex-wrap: wrap; min-height: 26px; align-items: center; }
      .sec-1-8 .jchip { font-family: var(--mono); font-size: 12.5px; font-weight: 800; padding: 2px 6px; border-radius: 6px; background: var(--proc-bg); color: var(--proc); border: 1px solid color-mix(in srgb, var(--proc) 40%, transparent); }
      .sec-1-8 .disc { border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; background: var(--panel-2); }
      .sec-1-8 .disc .dh { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 16px; }
      .sec-1-8 .disc .lk { width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 13px; background: var(--panel-3); color: var(--muted); flex: none; }
      .sec-1-8 .disc .dt { font-size: 14px; line-height: 1.4; color: var(--ink-2); margin-top: 3px; }
      .sec-1-8 .disc.got { border-color: color-mix(in srgb, var(--ok) 50%, transparent); background: var(--ok-bg); }
      .sec-1-8 .disc.got .lk { background: var(--ok); color: var(--panel); }
      .sec-1-8 .log .c-ok { color: var(--ok); } .sec-1-8 .log .c-bad { color: var(--bad); }
      /* step 4: sorter */
      .sec-1-8 .story { border-left: 5px solid var(--chc); min-height: 150px; }
      .sec-1-8 .story-t { font-size: 18px; line-height: 1.5; }
      .sec-1-8 .bk { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 9px 14px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; color: var(--ink); font: inherit; }
      .sec-1-8 .bk:hover:not(:disabled) { border-color: var(--chc); }
      .sec-1-8 .bk b { font-size: 16.5px; }
      .sec-1-8 .bk span { font-size: 14px; color: var(--muted); }
      .sec-1-8 .bk:disabled { cursor: default; opacity: .55; }
      .sec-1-8 .bk.wrong { border-color: var(--bad); background: var(--bad-bg); }
      .sec-1-8 .bk.right { border-color: var(--ok); background: var(--ok-bg); opacity: 1; }
      .sec-1-8 .bin { border: 1.5px dashed var(--line-2); border-radius: 10px; padding: 7px 10px; min-height: 80px; background: var(--panel-2); }
      .sec-1-8 .bin .bn { font-weight: 800; font-size: 15px; }
      .sec-1-8 .bin .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
      /* step 5: machine builder */
      .sec-1-8 .s-cpuin { fill: var(--panel); stroke: var(--cpu); }
      .sec-1-8 .s-bus { fill: var(--panel-3); stroke: var(--ink-2); }
      .sec-1-8 .chipb { fill: none; stroke: var(--ink-2); stroke-dasharray: 7 5; }
      .sec-1-8 .mach .hot { transition: opacity .2s; }
      .sec-1-8 .mach.picked .hot:not(.sel) { opacity: .4; }
      .sec-1-8 .mach .hot.sel .fr { stroke-width: 3.5; }
      /* step 6: coherence */
      .sec-1-8 .ping { stroke-width: 4.5 !important; transition: stroke-width .15s; }
      /* step 7: power wall */
      .sec-1-8 .meterrow { display: grid; grid-template-columns: 84px minmax(0, 1fr) 150px; gap: 10px; align-items: center; }
      .sec-1-8 .meterrow .meter { height: 14px; }
      .sec-1-8 .meterrow .meter > i { background: var(--cpu); }
      .sec-1-8 .meter.lim { position: relative; }
      .sec-1-8 tr.pick { cursor: pointer; }
      .sec-1-8 tr.pick:hover td { background: var(--panel-2); }
      .sec-1-8 .meter.lim::after { content: ''; position: absolute; left: 50%; top: -3px; bottom: -3px; width: 3px; background: var(--bad); border-radius: 2px; }
      /* phones: kept LAST so these overrides beat the base rules above on source order */
      @media (max-width: 760px) {
        .sec-1-8 table.tbl th, .sec-1-8 table.tbl td { font-size: 12.5px; padding: 4px 5px; letter-spacing: 0; }
        .sec-1-8 table.tbl th { text-transform: none; }
        .sec-1-8 .step-eyebrow { white-space: normal; }
        .sec-1-8 .sock { grid-template-columns: 60px minmax(0, 1fr); gap: 6px 10px; }
        .sec-1-8 .sock .btn { grid-column: 2; }
        .sec-1-8 .meterrow { grid-template-columns: 70px minmax(0, 1fr) 118px; }
      }
    `,
    steps: [
      /* ---------------------------------------------------------------- 1. Big picture */
      {
        title: 'More than one processor: three ways to build it',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const pic = {
            smp: () => s('svg', { viewBox: '0 0 200 108', width: '100%' },
              ...[0, 1, 2].map((i) => s('g', {},
                s('rect', { x: 18 + i * 60, y: 6, width: 44, height: 30, rx: 5, class: 's-cpu', 'stroke-width': 2 }),
                s('text', { x: 40 + i * 60, y: 26, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, 'P' + (i + 1)),
                s('line', { x1: 40 + i * 60, y1: 36, x2: 40 + i * 60, y2: 52, class: 's-line' }))),
              s('line', { x1: 8, y1: 52, x2: 192, y2: 52, class: 's-line', 'stroke-width': 4 }),
              s('line', { x1: 65, y1: 52, x2: 65, y2: 66, class: 's-line' }), s('line', { x1: 152, y1: 52, x2: 152, y2: 66, class: 's-line' }),
              s('rect', { x: 18, y: 66, width: 94, height: 34, rx: 6, class: 's-mem', 'stroke-width': 2 }),
              s('text', { x: 65, y: 88, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Memory'),
              s('rect', { x: 124, y: 66, width: 58, height: 34, rx: 6, class: 's-io', 'stroke-width': 2 }),
              s('text', { x: 153, y: 88, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'I/O')),
            multi: () => s('svg', { viewBox: '0 0 200 108', width: '100%' },
              s('rect', { x: 8, y: 3, width: 184, height: 64, rx: 9, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }),
              ...[0, 1, 2, 3].map((i) => s('g', {},
                s('rect', { x: 16 + i * 43, y: 9, width: 38, height: 27, rx: 5, class: 's-cpu', 'stroke-width': 2 }),
                s('text', { x: 35 + i * 43, y: 27, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, 'C' + (i + 1)))),
              s('rect', { x: 16, y: 41, width: 167, height: 20, rx: 5, class: 's-cache', 'stroke-width': 1.5 }),
              s('text', { x: 100, y: 56, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-acc' }, 'shared cache'),
              s('line', { x1: 100, y1: 67, x2: 100, y2: 76, class: 's-line' }),
              s('rect', { x: 45, y: 76, width: 110, height: 28, rx: 6, class: 's-mem', 'stroke-width': 2 }),
              s('text', { x: 100, y: 95, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Memory')),
            cluster: () => s('svg', { viewBox: '0 0 200 108', width: '100%' },
              ...[0, 1, 2].map((i) => s('g', {},
                s('rect', { x: 10 + i * 64, y: 4, width: 52, height: 62, rx: 7, class: 's-panel', 'stroke-width': 2 }),
                s('rect', { x: 16 + i * 64, y: 10, width: 40, height: 20, rx: 4, class: 's-cpu', 'stroke-width': 1.5 }),
                s('text', { x: 36 + i * 64, y: 25, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, 'P'),
                s('rect', { x: 16 + i * 64, y: 38, width: 40, height: 20, rx: 4, class: 's-mem', 'stroke-width': 1.5 }),
                s('text', { x: 36 + i * 64, y: 53, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, 'M'),
                s('line', { x1: 36 + i * 64, y1: 66, x2: 36 + i * 64, y2: 84, stroke: 'var(--io)', 'stroke-width': 2 }))),
              s('line', { x1: 20, y1: 84, x2: 180, y2: 84, stroke: 'var(--io)', 'stroke-width': 3, 'stroke-dasharray': '6 4' }),
              s('text', { x: 100, y: 102, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-io' }, 'network')),
          };
          const ROUTES = [
            { id: 'smp', name: 'Symmetric multiprocessor', term: 'Symmetric multiprocessor', tag: 'taught in this section', tagc: 'ok',
              what: 'Two or more separate processors, each usually on its own chip in its own socket, share <b>one main memory</b> and <b>one set of I/O devices</b>. A single operating system runs the whole machine and may hand any job to any processor.',
              where: 'Servers and powerful workstations.' },
            { id: 'multi', name: 'Multicore computer', term: 'Multicore computer', tag: 'taught in this section', tagc: 'ok',
              what: 'Two or more complete processors, called <b>cores</b>, are built together on <b>one chip</b> (one slab of silicon, the <span class="t">die</span>). The OS sees every core as a processor, so a multicore chip is organized much like a tiny SMP. The two ideas combine: a server with two 8-core chips is an SMP with 16 cores.',
              where: 'Nearly every laptop, desktop and phone sold today.' },
            { id: 'cluster', name: 'Cluster', term: 'Cluster', tag: 'only mentioned here', tagc: 'warn',
              what: 'Several <b>complete computers</b>, each with its own processors, memory and copy of the OS, are linked by a fast network and cooperate on big jobs. They share <b>no</b> memory: they exchange data by sending messages over the network.',
              where: 'Search engines, cloud data centres, supercomputers.' },
          ];
          const info = h('div', { class: 'card tight', style: { minHeight: '128px' } });
          const rows = {};
          const tbl = h('table', { class: 'tbl compact' },
            h('tr', {}, h('th', {}, 'Design'), h('th', {}, 'Processors live …'), h('th', {}, 'Share main memory?'), h('th', {}, 'Operating system')),
            rows.smp = h('tr', {}, h('td', { class: 'b' }, 'SMP'), h('td', {}, 'on separate chips'), h('td', { html: '<span class="c-ok b">Yes</span>, one memory' }), h('td', {}, 'one OS for all')),
            rows.multi = h('tr', {}, h('td', { class: 'b' }, 'Multicore'), h('td', {}, 'as cores on one chip'), h('td', { html: '<span class="c-ok b">Yes</span>, one memory' }), h('td', {}, 'one OS for all')),
            rows.cluster = h('tr', {}, h('td', { class: 'b' }, 'Cluster'), h('td', {}, 'in separate computers'), h('td', { html: '<span class="c-bad b">No</span>, each has its own' }), h('td', {}, 'one copy per computer')));
          const btns = {};
          function pick(id) {
            const r = ROUTES.find((x) => x.id === id);
            Object.entries(btns).forEach(([k, b]) => b.classList.toggle('on', k === id));
            Object.entries(rows).forEach(([k, tr]) => tr.classList.toggle('on', k === id));
            info.innerHTML = `<div class="row" style="gap:8px;margin-bottom:4px"><span class="b t" data-t="${r.term}">${r.name}</span><span class="chip ${r.tagc}">${r.tag}</span></div>` +
              `<div class="small">${r.what}</div><div class="small muted" style="margin-top:4px"><b>Where you meet it:</b> ${r.where}</div>`;
          }
          const btnRow = h('div', { class: 'grid-3' }, ...ROUTES.map((r) => (btns[r.id] = h('button', { type: 'button', class: 'route', onclick: () => pick(r.id), 'aria-label': r.name },
            pic[r.id](), h('span', { class: 'rname' }, r.name)))));
          info.innerHTML = '<div class="b">Click a picture to meet each design.</div><div class="small muted">All three put several processors to work at once. They differ in <b>where</b> the processors sit and <b>what</b> they share.</div>';

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'A single processor follows one stream of instructions, one step after another. To get more done at the same moment, designers give a computer several processors that work side by side. This is <span class="t">parallel processing</span>.' }),
              h('p', { class: 'm0', html: 'A computer with just one processor is a <span class="t">uniprocessor</span>. There are three common ways to go beyond one, and this section explores the first two in depth.' }),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'One cook in one kitchen is a uniprocessor. Several cooks sharing one kitchen and one pantry is a symmetric multiprocessor (SMP). The same cooks squeezed onto one extra-large workstation, sharing a spice rack at arm’s reach, is a multicore chip. Separate restaurants splitting a giant catering order by phone form a cluster.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why an OS course cares', html: 'Hardware only supplies the processors. The operating system decides which program runs on which processor, and keeps them from tripping over each other.' })),
            h('div', { class: 'stack' }, btnRow, info, tbl,
              h('div', { class: 'row small', style: { gap: '6px' } }, h('span', { class: 'b', style: { marginRight: '2px' } }, 'Coming up:'),
                ...['the 5 marks of an SMP', 'fail a processor', 'build the machines', 'caches that disagree', 'why chips went multicore'].map((t) => h('span', { class: 'chip accent' }, t))))));
        },
      },
      /* ---------------------------------------------------------------- 2. SMP characteristics */
      {
        title: 'What makes a multiprocessor “symmetric”',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const FEATS = [
            { short: 'Two or more <b>similar processors</b> of comparable capability', hi: ['procs'],
              sub: () => 'same kind, same speed',
              text: 'An SMP has <b>two or more processors of the same kind and comparable capability</b>: the same instruction set and roughly the same speed. Because they are alike, the OS can treat them as interchangeable.' },
            { short: 'They <b>share main memory</b> and I/O facilities over one interconnection, so memory access time is about equal', hi: ['mem', 'bus', 'links', 'procs'], pill: '≈ same wait',
              text: 'All processors reach <b>one shared main memory</b> and the same I/O facilities through a shared bus or another interconnection scheme. No processor sits closer to memory than the others, so a memory access takes <b>about the same time</b> whichever processor makes it.' },
            { short: 'They <b>share access to the I/O devices</b>', hi: ['io', 'bus', 'links', 'procs'], pill: 'I/O ✓',
              text: 'The processors <b>share the I/O devices</b>. Any of them can start a disk transfer or talk to the network card, either over the same paths or over separate paths that lead to the same device.' },
            { short: 'All processors can <b>perform the same functions</b>', hi: ['procs'],
              sub: (i) => ['running app A', 'running the kernel', 'handling an interrupt', 'running app B'][i],
              text: 'Every processor can <b>perform the same functions</b>: run user programs, run operating-system code, handle interrupts. None is the boss and none is a helper. This equality is exactly what <b>symmetric</b> means.' },
            { short: 'One <b>integrated OS</b> controls them all', hi: ['os', 'procs'],
              os: 'One integrated OS  ·  coordinates jobs · tasks · files · data elements',
              text: 'A single <b>integrated operating system</b> controls every processor and its programs. It makes them cooperate at every size of work: whole <b>jobs</b>, the <b>tasks</b> inside a job, shared <b>files</b>, down to single shared <b>data elements</b> in memory.' },
          ];
          const svg = s('svg', { viewBox: '0 0 640 300', width: '100%' });
          const G = { os: s('g'), procs: s('g'), links: s('g'), bus: s('g'), mem: s('g'), io: s('g') };
          const overlay = s('g');
          const osText = s('text', { x: 320, y: 27, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 'tx-os' });
          G.os.append(s('rect', { x: 8, y: 4, width: 624, height: 36, rx: 10, class: 's-os', 'stroke-width': 2 }), osText);
          const subs = [];
          for (let i = 0; i < 4; i++) {
            const x = 16 + i * 156;
            subs[i] = s('text', { x: x + 70, y: 106, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' });
            G.procs.append(s('rect', { x, y: 54, width: 140, height: 72, rx: 10, class: 's-cpu', 'stroke-width': 2 }),
              s('text', { x: x + 70, y: 82, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Processor ' + (i + 1)), subs[i]);
            G.links.append(s('rect', { x: x + 20, y: 134, width: 100, height: 24, rx: 6, class: 's-cache', 'stroke-width': 1.5 }),
              s('text', { x: x + 70, y: 151, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-acc' }, 'private cache'),
              s('line', { x1: x + 70, y1: 126, x2: x + 70, y2: 134, class: 's-line' }),
              s('line', { x1: x + 70, y1: 158, x2: x + 70, y2: 186, class: 's-line' }));
          }
          G.bus.append(s('line', { x1: 8, y1: 189, x2: 632, y2: 189, class: 's-line', 'stroke-width': 6 }),
            s('line', { x1: 162, y1: 189, x2: 162, y2: 226, class: 's-line' }), s('line', { x1: 482, y1: 189, x2: 482, y2: 226, class: 's-line' }),
            s('text', { x: 320, y: 214, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'shared bus (interconnect)'));
          const memSub = s('text', { x: 162, y: 276, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' });
          G.mem.append(s('rect', { x: 8, y: 226, width: 308, height: 68, rx: 10, class: 's-mem', 'stroke-width': 2 }),
            s('text', { x: 162, y: 252, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Main memory (shared)'), memSub);
          G.io.append(s('rect', { x: 332, y: 226, width: 300, height: 68, rx: 10, class: 's-io', 'stroke-width': 2 }),
            s('text', { x: 482, y: 247, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'I/O devices (shared)'),
            ...['Disk', 'Network', 'Display'].map((d, k) => s('g', {},
              s('rect', { x: 346 + k * 94, y: 258, width: 84, height: 26, rx: 6, fill: 'var(--panel)', stroke: 'var(--io)', 'stroke-width': 1.5 }),
              s('text', { x: 388 + k * 94, y: 276, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, d))));
          svg.append(G.os, G.links, G.bus, G.mem, G.io, G.procs, overlay);

          const info = h('div', { class: 'card tight', style: { minHeight: '100px' } });
          const seenChip = h('span', { class: 'chip' });
          const seen = new Set();
          const rowsEl = FEATS.map((f, i) => h('button', { type: 'button', class: 'feat', onclick: () => pick(i) },
            h('span', { class: 'n' }, String(i + 1)), h('span', { html: f.short })));
          function paint(k) {
            const f = k == null ? null : FEATS[k];
            Object.entries(G).forEach(([name, g]) => g.classList.toggle('dim', !!f && !f.hi.includes(name)));
            osText.textContent = (f && f.os) || 'One integrated operating system';
            subs.forEach((t, i) => (t.textContent = f && f.sub ? f.sub(i) : 'registers · ALU'));
            memSub.textContent = k === 1 ? 'every processor reaches it the same way' : 'one copy of every program and its data';
            overlay.replaceChildren();
            if (f && f.pill) for (let i = 0; i < 4; i++) {
              const cx = 16 + i * 156 + 70;
              overlay.append(s('rect', { x: cx - 44, y: 162, width: 88, height: 20, rx: 10, class: k === 1 ? 's-mem' : 's-io', 'stroke-width': 1.5 }),
                s('text', { x: cx, y: 176.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, f.pill));
            }
          }
          function pick(i) {
            seen.add(i);
            rowsEl.forEach((r, j) => { r.classList.toggle('on', i === j); r.classList.toggle('seen', seen.has(j)); });
            paint(i);
            seenChip.className = 'chip ' + (seen.size === 5 ? 'ok' : '');
            seenChip.textContent = seen.size === 5 ? '✓ all five seen' : `seen ${seen.size} / 5`;
            info.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '2px' } }, h('span', { class: 'b' }, `Mark ${i + 1} of 5`), seenChip),
              h('div', { style: { fontSize: '15.5px', lineHeight: '1.45' }, html: FEATS[i].text }));
          }
          paint(null);
          info.innerHTML = '<div class="b">Click each mark on the left.</div><div class="small muted">The diagram lights up the part of the machine that the mark is about, and this box explains it.</div>';

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'A <span class="t">symmetric multiprocessor</span> (SMP) is one computer with <b>five marks</b>. Click each one:' }),
              ...rowsEl,
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '“Symmetric” does not mean the processors run the same program in lockstep. Each runs its own work. It means <b>no processor is special</b>: any of them can do any job.' })),
            h('div', { class: 'stack' }, h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), info,
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'Identical checkout clerks (processors) share one stockroom (memory). Any clerk can serve any customer, and one manager (the OS) sends each customer to a free clerk.' }))));
        },
      },
      /* ---------------------------------------------------------------- 3. Advantages lab */
      {
        title: 'Lab: four payoffs of having several processors',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const NJOBS = 12, WORK = 4, SOCKETS = 4, TICK = 170;
          let model = 1, procs, queue, done, t, running, failedEver, wasDown, maxWorking, finished, down, redone;
          const found = {};
          /* ---- discovery cards (right) */
          const DISC = {
            perf: { name: 'Performance', hint: 'Finish all 12 jobs with two or more processors.' },
            avail: { name: 'Availability', hint: 'On a machine with spare processors, fail one and let the run finish.' },
            grow: { name: 'Incremental growth', hint: 'Install a processor in an empty socket (a free processor slot on the motherboard).' },
            scale: { name: 'Scaling', hint: 'Pick a different model from the product line.' },
          };
          const discEl = {};
          const nm = (k) => (k === 'perf' ? DISC[k].name : `<span class="t">${DISC[k].name}</span>`);   // glossary link for the three defined terms
          const foundChip = h('span', { class: 'chip' }, 'found 0 / 4');
          Object.entries(DISC).forEach(([k, d]) => {
            discEl[k] = h('div', { class: 'disc' });
            discEl[k].innerHTML = `<div class="dh"><span class="lk">?</span>${nm(k)}</div><div class="dt"><b>To discover:</b> ${d.hint}</div>`;
          });
          function unlock(k, text) {
            if (found[k]) return;
            found[k] = true;
            discEl[k].className = 'disc got fade-in';
            discEl[k].innerHTML = `<div class="dh"><span class="lk">✓</span>${nm(k)}</div><div class="dt">${text}</div>`;
            const n = Object.keys(found).length;
            foundChip.className = 'chip ' + (n === 4 ? 'ok' : 'accent');
            foundChip.textContent = n === 4 ? '✓ all four found' : `found ${n} / 4`;
          }
          /* ---- simulator (left) */
          const logEl = h('div', { class: 'log', style: { height: '112px' } });
          function log(msg, cls) { logEl.append(h('div', { class: cls || '', html: msg })); while (logEl.children.length > 40) logEl.firstChild.remove(); logEl.scrollTop = logEl.scrollHeight; }
          const queueEl = h('div', { class: 'jq' });
          const clock = h('span', { class: 'chip mono' });
          const doneChip = h('span', { class: 'chip ok mono' });
          const status = h('div', { class: 'card tight small', style: { minHeight: '46px' } });
          const runBtn = h('button', { type: 'button', class: 'btn sm primary', onclick: () => toggleRun() });
          const socks = [];
          for (let i = 0; i < SOCKETS; i++) {
            const lab = h('div', { class: 'lab' });
            const st = h('div', { class: 'st' });
            const bar = h('i', { style: { width: '0%' } });
            const btn = h('button', { type: 'button', class: 'btn sm', onclick: () => sockAction(i) });
            const row = h('div', { class: 'sock' }, lab, h('div', {}, st, h('div', { class: 'meter' }, bar)), btn);
            socks.push({ row, lab, st, bar, btn });
          }
          const working = () => procs.filter((p) => p.inst && !p.failed);
          function reset() {
            procs = Array.from({ length: SOCKETS }, (_, i) => ({ inst: i < model, failed: false, job: null, left: 0 }));
            queue = Array.from({ length: NJOBS }, (_, i) => i + 1);
            done = 0; t = 0; running = false; failedEver = false; wasDown = false; finished = false; down = false; maxWorking = 0; redone = 0;
            logEl.replaceChildren();
            log(`Model with ${model} processor${model > 1 ? 's' : ''}: 12 jobs of 4 s each are waiting.`);
            paint();
          }
          function toggleRun() {
            if (finished || down) reset();
            running = !running;
            paint();
          }
          function sockAction(i) {
            const p = procs[i];
            if (!p.inst) {                     // empty socket → install a processor
              p.inst = true; p.failed = false; down = false;
              log(`t=${t}s  New processor installed in socket ${i + 1}. The OS starts using it at once.`, 'c-ok');
              unlock('grow', 'You <b>added a processor</b> to the machine you already had, instead of buying a whole new computer.');
            } else if (!p.failed) {            // working processor → fail it
              p.failed = true; failedEver = true;
              if (p.job != null) {   // the half-done job is lost and must start again from the beginning
                const lost = WORK - p.left; redone += lost;
                queue.unshift(p.job); log(`t=${t}s  P${i + 1} FAILS. The OS puts J${p.job} back at the front of the queue${lost ? ` (${lost} s of its work must be redone)` : ''}.`, 'c-bad'); p.job = null; p.left = 0; }
              else log(`t=${t}s  P${i + 1} FAILS.`, 'c-bad');
              if (!working().length) { down = true; wasDown = true; running = false; log('No working processor is left: the whole system is down.', 'c-bad'); }
            }
            paint();
          }
          function tick() {
            if (!running) return;
            // 1. the OS scheduler hands the next waiting job to every free, working processor
            procs.forEach((p, i) => { if (p.inst && !p.failed && p.job == null && queue.length) { p.job = queue.shift(); p.left = WORK; log(`t=${t}s  OS: J${p.job} → P${i + 1}`); } });
            maxWorking = Math.max(maxWorking, working().length);
            // 2. one second of simulated time passes; every busy processor does one second of work
            t++;
            procs.forEach((p) => { if (p.job != null) { p.left--; if (p.left === 0) { done++; p.job = null; } } });
            if (!queue.length && procs.every((p) => p.job == null)) finish();
            paint();
          }
          function finish() {
            finished = true; running = false;
            log(`t=${t}s  All 12 jobs are done.`, 'c-ok');
            if (maxWorking >= 2) unlock('perf', `Jobs ran <b>at the same moment</b>: 12 jobs in <b>${t} s</b> with up to ${maxWorking} processors, versus 48 s on one.`);
            // availability means the machine stayed up through the failure; a run that went down and was repaired does not count
            if (failedEver && !wasDown) unlock('avail', 'A processor died, yet every job finished on the survivors. A uniprocessor would have stopped dead.');
            else if (failedEver) log('The machine went down before the new processor arrived, so it did not stay available. Try failing just one of several processors.');
          }
          function paint() {
            procs.forEach((p, i) => {
              const k = socks[i];
              k.row.className = 'sock' + (!p.inst ? ' empty' : p.failed ? ' failed' : '');
              k.lab.textContent = p.inst ? 'P' + (i + 1) : 'socket ' + (i + 1);
              k.st.innerHTML = !p.inst ? '<span class="muted">empty socket</span>' : p.failed ? '<span class="c-intr">FAILED: out of service</span>'
                : p.job != null ? `running <b>J${p.job}</b> <span class="muted">(${WORK - p.left} of ${WORK} s)</span>` : '<span class="muted">idle</span>';
              k.bar.style.width = p.job != null ? ((WORK - p.left) / WORK) * 100 + '%' : '0%';
              k.btn.className = 'btn sm ' + (!p.inst ? 'mem' : 'intr');
              k.btn.textContent = !p.inst ? '+ Add processor' : p.failed ? 'Failed' : '✗ Fail it';
              k.btn.disabled = p.inst && p.failed;
            });
            queueEl.replaceChildren(...(queue.length ? queue.map((j) => h('span', { class: 'jchip' }, 'J' + j)) : [h('span', { class: 'muted small' }, 'empty')]));
            clock.textContent = `t = ${t} s`;
            doneChip.textContent = `done ${done}/${NJOBS}`;
            runBtn.textContent = finished || down ? 'Run again' : running ? 'Pause' : t ? 'Resume' : 'Run';
            const busy = procs.filter((p) => p.job != null).length;
            status.innerHTML = down ? (procs.filter((p) => p.inst).length === 1 ? '<b class="c-bad">System down.</b> The only processor failed, so no job can run. A uniprocessor has no spare: one failure halts the whole machine.'
                : '<b class="c-bad">System down.</b> Every processor has failed, so nothing can run. With even one survivor, the jobs would have carried on.')
              : finished ? `<b class="c-ok">Done:</b> 12 jobs in <b>${t} s</b>${maxWorking > 1 ? ` with up to ${maxWorking} processors` : ` on one processor at a time, one job after another (12 × 4 s = 48 s${redone ? `, plus ${redone} s redone after the failure` : ''})`}. ${maxWorking > 1 ? 'One processor alone needs 48 s.' : 'Now add a processor or pick a bigger model.'}`
              : running ? `<b>Running.</b> ${busy} processor${busy === 1 ? '' : 's'} busy, ${queue.length} job${queue.length === 1 ? '' : 's'} waiting, ${done} done.`
              : t ? '<b>Paused.</b> Fail a processor or add one, then resume.' : '<b>Press Run.</b> The OS hands each waiting job to a free processor. Try failing or adding processors while it runs.';
          }
          const seg = ctx.ui.seg([{ value: 1, label: '1 CPU' }, { value: 2, label: '2 CPUs' }, { value: 4, label: '4 CPUs' }], model, (v) => {
            if (v === model) return;
            model = v; reset();
            unlock('scale', 'One design sold as <b>1-, 2- and 4-processor models</b> at different prices, all running the same software.');
          });
          reset();
          ctx.every(TICK, tick);

          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'card white stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'b small' }, 'Product line:'), seg, h('span', { class: 'grow' }),
                runBtn, h('button', { type: 'button', class: 'btn sm', onclick: () => reset() }, 'Reset')),
              h('div', { class: 'row', style: { gap: '8px', alignItems: 'flex-start' } }, h('span', { class: 'b small', style: { whiteSpace: 'nowrap', paddingTop: '2px' } }, 'Waiting:'), h('div', { style: { flex: '1 1 220px', minWidth: 0 } }, queueEl),
                h('div', { class: 'row nw', style: { gap: '6px' } }, clock, doneChip)),
              ...socks.map((k) => k.row), status, logEl),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Four payoffs to discover'), foundChip),
              discEl.perf, discEl.avail, discEl.grow, discEl.scale,
              h('div', { class: 'callout why m0 small', 'data-label': 'Transparent to the user', html: 'No job chose its processor: the OS gave each one to whichever processor was free. Users just see work finish sooner, so the extra processors are <span class="t">transparent</span>.' }))));
        },
      },
      /* ---------------------------------------------------------------- 4. Advantage sorter */
      {
        title: 'Sort the stories: which payoff is each one?',
        kind: 'predict',
        render(el, ctx) {
          const { h } = ctx;
          const BK = [
            { id: 'perf', name: 'Performance', def: 'more work done at the same time' },
            { id: 'avail', name: 'Availability', def: 'one failure does not stop the machine' },
            { id: 'grow', name: 'Incremental growth', def: 'add processors to the machine you have' },
            { id: 'scale', name: 'Scaling', def: 'models with different processor counts' },
          ];
          const STORIES = [
            { a: 'perf', label: 'Movie export in parallel', text: 'A video editor exports a movie on a 4-processor workstation. Different chunks of the film are compressed at the same moment, so the export takes a fraction of the one-processor time.',
              why: 'The job was split up and the pieces ran <b>at the same time</b> on different processors. More work per second is performance.', hint: 'Nothing broke and nothing was bought. What got better?' },
            { a: 'grow', label: 'Filling empty sockets', text: 'A research lab’s server gets busier every month. The admin installs two more processors in its empty sockets instead of buying a new server.',
              why: 'The <b>same machine</b> was made stronger by adding processors to it. Growing a system step by step is incremental growth.', hint: 'Is this about a vendor’s range of models, or about upgrading one machine over time?' },
            { a: 'avail', label: 'Bank server loses a CPU', text: 'At 3 a.m. one processor in a bank’s 8-processor server burns out. Transactions keep flowing on the other seven, a little slower, until a technician replaces the part.',
              why: 'A processor failed but the machine <b>stayed up</b>. Surviving the loss of one part is availability.', hint: 'Focus on what happened when a part broke.' },
            { a: 'scale', label: 'Entry model vs top model', text: 'A small school buys the entry model of a server line. A large university buys the top model of the same family, which has many more processors.',
              why: 'One vendor offers <b>a range of models</b> that differ in processor count and price. That range is scaling. Neither buyer upgraded anything later.', hint: 'Two different customers, one product family. Did anyone upgrade a machine?' },
            { a: 'perf', label: 'Four requests at once', text: 'A web server handles four customers’ requests at the same moment, each on its own processor, so no customer waits for another customer’s page.',
              why: 'Four requests are served <b>in parallel</b> instead of in a line. Getting more done at once is performance.', hint: 'Is something broken, bought or upgraded here? Or is work just going faster?' },
            { a: 'grow', label: 'Buy one, add one later', text: 'A startup buys a 2-socket server with just one processor installed, planning to add the second when customers arrive.',
              why: 'The plan is to <b>add a processor to the same machine</b> later, as needs grow. That is incremental growth.', hint: 'The key word is “later”: the same machine will be upgraded.' },
            { a: 'scale', label: '2-, 4-, 8-way models', text: 'A computer maker sells one server family in 2-, 4- and 8-processor versions, priced from budget to premium, all running the same operating system.',
              why: 'Building <b>a range of products</b> by varying the number of processors is scaling.', hint: 'Look at it from the seller’s side: several models, one design.' },
            { a: 'avail', label: 'Faulty CPU switched off', text: 'A health check finds that processor 3 keeps producing errors. The OS stops scheduling work on it, and the users never notice an outage.',
              why: 'The machine kept serving users <b>without the faulty processor</b>. Staying up through a failure is availability.', hint: 'What would happen on a machine that had only that one processor?' },
          ];
          let cur = 0, wrongs = new Set(), firstTry = 0, solved = false;
          const placed = {};
          BK.forEach((b) => (placed[b.id] = h('div', { class: 'chips' })));
          const scoreChip = h('span', { class: 'chip' });
          const storyHead = h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '4px' } });
          const storyText = h('div', { class: 'story-t' });
          const fb = h('div', { class: 'card tight', style: { minHeight: '112px' } });
          const nextBtn = h('button', { type: 'button', class: 'btn sm primary', onclick: () => next() });
          const bkBtns = BK.map((b) => h('button', { type: 'button', class: 'bk', onclick: () => choose(b.id) }, h('b', {}, b.name), h('span', {}, b.def)));
          const nameOf = (id) => BK.find((b) => b.id === id).name;
          function show() {
            wrongs = new Set(); solved = false;
            if (cur >= STORIES.length) {
              storyHead.replaceChildren(h('span', { class: 'b' }, 'All 8 stories sorted'), h('span', { class: 'chip ok' }, '✓ done'));
              storyText.innerHTML = `You placed <b>${firstTry} of 8</b> on the first try. Performance and availability are about what happens while the machine runs; incremental growth and scaling are about buying and upgrading.`;
              bkBtns.forEach((b) => { b.disabled = true; b.className = 'bk'; });
              fb.replaceChildren(h('div', { class: 'small', html: 'The pairs students mix up most are <b>incremental growth</b> (one machine, upgraded later) and <b>scaling</b> (a vendor’s range of models).' }),
                h('div', { class: 'row mt' }, h('button', { type: 'button', class: 'btn sm', onclick: () => restart() }, 'Sort again')));
              return;
            }
            const st = STORIES[cur];
            storyHead.replaceChildren(h('span', { class: 'b' }, `Story ${cur + 1} of 8`), h('span', { class: 'chip accent' }, 'Which payoff?'));
            storyText.textContent = st.text;
            bkBtns.forEach((b) => { b.disabled = false; b.className = 'bk'; });
            fb.innerHTML = '<div class="small muted">Pick the payoff this story shows. A wrong pick gets a hint, and you can try again.</div>';
          }
          function choose(id) {
            if (solved || cur >= STORIES.length) return;
            const st = STORIES[cur], i = BK.findIndex((b) => b.id === id);
            if (id === st.a) {
              solved = true;
              if (!wrongs.size) firstTry++;
              bkBtns[i].className = 'bk right';
              bkBtns.forEach((b, j) => { if (j !== i) b.disabled = true; });
              placed[id].append(h('span', { class: 'chip ' + (wrongs.size ? 'warn' : 'ok') + ' fade-in' }, st.label));
              scoreChip.className = 'chip accent';
              scoreChip.textContent = `first try: ${firstTry} / ${cur + 1}`;
              nextBtn.textContent = cur === STORIES.length - 1 ? 'Finish' : 'Next story →';
              fb.replaceChildren(h('div', { class: 'small', html: `<b class="c-ok">Yes: ${nameOf(id)}.</b> ${st.why}` }), h('div', { class: 'row', style: { marginTop: '8px' } }, nextBtn));
            } else {
              wrongs.add(id);
              bkBtns[i].className = 'bk wrong';
              bkBtns[i].disabled = true;
              fb.innerHTML = `<div class="small"><b class="c-bad">Not ${nameOf(id)}.</b> ${nameOf(id)} means “${BK[i].def}”. <b>Hint:</b> ${st.hint}</div>`;
            }
          }
          function next() { cur++; show(); }
          function restart() { cur = 0; firstTry = 0; BK.forEach((b) => placed[b.id].replaceChildren()); scoreChip.className = 'chip'; scoreChip.textContent = 'first try: 0 / 0'; show(); }
          scoreChip.textContent = 'first try: 0 / 0';
          show();

          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'Each story below shows one of the four payoffs of an <span class="t">SMP</span>. Read it, then pick the payoff it shows.' }),
              h('div', { class: 'card white story' }, storyHead, storyText),
              h('div', { class: 'grid-2', style: { gap: '10px' } }, ...bkBtns),
              fb),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Your sorting board'), scoreChip),
              ...BK.map((b) => h('div', { class: 'bin' }, h('div', { class: 'bn' }, b.name), placed[b.id])),
              h('div', { class: 'callout why m0 small', 'data-label': 'Notice', html: 'In every story the users kept running the same programs. Deciding which processor runs what was the OS’s job, not theirs: the processors are <span class="t">transparent</span> to users.' }))));
        },
      },
      /* ---------------------------------------------------------------- 5. Machine builder */
      {
        title: 'Build the machine: one CPU, an SMP, a multicore chip',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const svg = s('svg', { viewBox: '0 0 660 416', width: '100%', class: 'mach' });
          const wrap = h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg);
          const modeCard = h('div', { class: 'card tight' });
          const info = h('div');
          const infoCard = h('div', { class: 'card tight grow', style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, info,
            h('div', { style: { flex: '1 1 0' } }),   // spacer: .m0 overrides margin-top:auto, so this pins the callout to the bottom
            h('div', { class: 'callout why small m0', 'data-label': 'Keep an eye on', html: 'The private caches: each holds copies the others cannot see. When two copies of the same data drift apart, that is the <span class="t">cache coherence</span> problem of the next step.' }));
          const nextBtn = h('button', { type: 'button', class: 'btn sm' });
          let mode = 'uni', groups = {};
          const UNIT = { uni: 'processor', smp: 'processor', multi: 'core', i7: 'core' };
          const COUNT = { uni: 1, smp: 3, multi: 4, i7: 8 };
          const PRIVATE = ['proc', 'cu', 'alu', 'regs', 'pipe', 'l1', 'l2'], SHARED = ['bus', 'mem', 'io', 'l3', 'imc', 'pcie'];
          // one clickable part: a rectangle with centred label lines (and an optional muted sub-label)
          function P(key, x, y, w, hh, cls, label, o = {}) {
            const lines = label == null ? [] : [].concat(label);
            const fs = o.fs || 13, lh = o.lh || fs + 3;
            const kids = [s('rect', { x, y, width: w, height: hh, rx: o.rx != null ? o.rx : 6, class: cls + ' fr', 'stroke-width': o.sw || 1.5 })];
            if (lines.length) kids.push(mtext(s, o.tx != null ? o.tx : x + w / 2, o.ty != null ? o.ty : y + hh / 2 + fs * 0.36 - ((lines.length - 1) * lh) / 2, lines,
              { 'text-anchor': o.anchor || 'middle', 'font-size': fs, 'font-weight': o.fw || 700, class: o.tc || null }, lh));
            if (o.sub) kids.push(s('text', { x: x + w / 2, y: o.suby, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, o.sub));
            const g = hotGroup(ctx, () => select(key), o.aria || lines.join(' ') || key, ...kids);
            (groups[key] = groups[key] || []).push(g);
            return g;
          }
          // a processor or core: outer box + control unit, ALU, registers, pipeline, L1-I, L1-D
          function proc(x, y, w, title, small) {
            const cw = (w - 18) / 2, fs = small ? 12 : 12.5, x2 = x + 12 + cw;
            return [P('proc', x, y, w, 108, 's-cpu', title, { ty: y + 17, fs: 14, fw: 800, sw: 2 }),
              P('cu', x + 6, y + 24, cw, 22, 's-cpuin', 'CU', { fs }), P('alu', x2, y + 24, cw, 22, 's-cpuin', 'ALU', { fs }),
              P('regs', x + 6, y + 50, cw, 22, 's-cpuin', small ? 'Regs' : 'Registers', { fs, aria: 'Registers' }), P('pipe', x2, y + 50, cw, 22, 's-cpuin', 'Pipeline', { fs }),
              P('l1', x + 6, y + 76, cw, 22, 's-cache', 'L1-I', { fs, tc: 'tx-acc' }), P('l1', x2, y + 76, cw, 22, 's-cache', 'L1-D', { fs, tc: 'tx-acc' })];
          }
          const line = (x1, y1, x2, y2) => s('line', { x1, y1, x2, y2, class: 's-line' });
          function bottom(k, sharedSlot) {
            const ty = sharedSlot ? 326 : 344, suby = sharedSlot ? 347 : 366;   // centre the labels unless the shared-data slot fills the lower half
            const out = [P('bus', 16, 246, 628, 12, 's-bus', null, { aria: 'System bus' }),
              s('text', { x: 330, y: 282, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'system bus (shared)'),
              line(175, 258, 175, 296), line(485, 258, 485, 296),
              P('mem', 40, 296, 270, 108, 's-mem', 'Main memory', { fs: 16, fw: 800, ty, sub: 'one copy, shared by all', suby }),
              P('io', 350, 296, 270, 108, 's-io', 'I/O subsystem', { fs: 16, fw: 800, ty, sub: 'disk · network · USB', suby })];
            if (sharedSlot) groups.mem[0].append(s('rect', { x: 58, y: 362, width: 234, height: 28, rx: 6, fill: 'var(--panel)', stroke: 'var(--mem)', 'stroke-dasharray': '4 3' }),
              s('text', { x: 175, y: 381, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-mem' }, 'shared data: P1 writes, P3 reads'));
            return out;
          }
          function chipBox(x, y, w, hh, label) {
            return P('chip', x, y, w, hh, 'chipb', label, { rx: 12, sw: 2, fs: 12.5, anchor: 'start', tx: x + 10, ty: y + 16, tc: 's-sub', aria: 'Chip boundary' });
          }
          function build(m) {
            mode = m; groups = {};
            svg.classList.remove('picked');
            const k = [];
            if (m === 'uni') {
              k.push(chipBox(213, 8, 234, 176, 'chip'), ...proc(225, 30, 210, 'Processor'),
                P('l2', 231, 148, 198, 24, 's-cache', 'L2 cache (private)', { tc: 'tx-acc' }), line(330, 172, 330, 246), ...bottom(m));
            } else if (m === 'smp') {
              [26, 238, 450].forEach((x, i) => k.push(chipBox(x - 10, 8, 204, 176, 'chip ' + (i + 1)), ...proc(x, 30, 184, 'Processor ' + (i + 1)),
                P('l2', x + 6, 148, 172, 24, 's-cache', 'L2 (private)', { tc: 'tx-acc' }), line(x + 92, 172, x + 92, 246)));
              k.push(...bottom(m, true));
            } else if (m === 'multi') {
              k.push(chipBox(10, 8, 640, 206, 'one chip (die)'));
              for (let i = 0; i < 4; i++) { const x = 22 + i * 157; k.push(...proc(x, 30, 145, 'Core ' + (i + 1), true), P('l2', x + 6, 144, 133, 24, 's-cache', 'L2 (private)', { fs: 12.5, tc: 'tx-acc' })); }
              k.push(P('l3', 22, 176, 606, 28, 's-cache', 'L3 cache: shared by all four cores', { fs: 14, fw: 800, tc: 'tx-acc', sw: 2 }), line(330, 214, 330, 246), ...bottom(m));
            } else {
              k.push(chipBox(10, 8, 640, 290, 'Core i7-5960X: one die'));
              [34, 152].forEach((y, row) => { for (let i = 0; i < 4; i++) { const x = 22 + i * 153, n = row * 4 + i + 1;
                k.push(P('proc', x, y, 98, 64, 's-cpu', ['Core ' + n, 'x86'], { fs: 14, fw: 800, lh: 18 }), P('l2', x + 102, y, 44, 64, 's-cache', ['L2', '256', 'KB'], { fs: 12, lh: 15, tc: 'tx-acc', aria: 'L2 cache, 256 KB' })); } });
              k.push(P('l3', 22, 106, 605, 38, 's-cache', 'Shared L3 cache: 20 MB, used by all 8 cores', { fs: 15, fw: 800, tc: 'tx-acc', sw: 2 }),
                P('imc', 22, 226, 298, 60, 's-mem', ['Integrated memory controller', 'DDR4 · 4 channels'], { fs: 13.5, lh: 19 }),
                P('pcie', 330, 226, 297, 60, 's-io', ['PCI Express 3.0', '40 lanes'], { fs: 13.5, lh: 19 }),
                line(171, 286, 171, 326), line(478, 286, 478, 326),
                P('mem', 40, 326, 262, 80, 's-mem', 'DDR4 main memory', { fs: 15, fw: 800, ty: 360, sub: 'memory modules, off the chip', suby: 382 }),
                P('io', 348, 326, 262, 80, 's-io', 'Graphics card, SSDs', { fs: 15, fw: 800, ty: 360, sub: 'fast devices, off the chip', suby: 382 }));
            }
            svg.replaceChildren(...k);
            if (wrap.animate) wrap.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });   // opacity only: a slide would poke past the canvas edge
            const mt = MODE_TEXT[m], idx = MODES.findIndex((x) => x.value === m);
            modeCard.replaceChildren(h('h3', {}, mt.name), h('p', { class: 'small m0', html: mt.what }),
              h('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, ...mt.chips.map((c) => h('span', { class: 'chip cpu' }, c))));
            // the "next machine" button lives in the top row so it never steals height from the explanation cards
            const nx = MODES[idx + 1];
            nextBtn.style.visibility = nx ? '' : 'hidden';
            nextBtn.textContent = nx ? 'Next: ' + nx.label.replace('Real chip: ', '') + ' →' : 'Next';
            nextBtn.onclick = nx ? () => { seg.set(nx.value); build(nx.value); } : null;
            const TRY = {
              uni: 'With one processor there is one of everything. Switch to <b>SMP</b> to see which parts get copied and which stay single.',
              smp: 'Try <b>L2</b>, then <b>Main memory</b>: three copies light up for one, a single box for the other. That is private versus shared.',
              multi: 'Try <b>L2</b>, then the <b>L3</b>: one is copied per core, the other is a single cache on the die that every core uses.',
              i7: 'Try an <b>L2</b>, the <b>L3</b> and the <b>memory controller</b>, and read which are per core and which the whole chip shares.',
            };
            info.innerHTML = '<div class="b">Click any part of the machine.</div><div class="small muted">Every copy of that part lights up, so you can see what each ' + UNIT[m] + ' owns and what they all share.</div>' +
              `<div class="small" style="margin-top:8px">${TRY[m]}</div>`;
          }
          function select(key) {
            svg.classList.add('picked');
            Object.entries(groups).forEach(([kk, arr]) => arr.forEach((g) => g.classList.toggle('sel', kk === key)));
            const [name, text] = (PART_MODE[mode] && PART_MODE[mode][key]) || PART_INFO[key];
            const n = COUNT[mode], u = UNIT[mode];
            const note = mode === 'uni' ? '' : key === 'l1' ? `<span class="chip warn">private</span> one pair (L1-I + L1-D) per ${u}: all ${n} pairs are lit.`
              : PRIVATE.includes(key) ? `<span class="chip warn">private</span> one per ${u}: all ${n} are lit.`
              : SHARED.includes(key) ? `<span class="chip ok">shared</span> just one, used by all ${n} ${u}s.` : '';
            info.innerHTML = `<div class="b" style="margin-bottom:2px">${name}</div><div class="small">${text}</div>` + (note ? `<div class="small" style="margin-top:8px">${note}</div>` : '');
          }
          const seg = ctx.ui.seg(MODES, 'uni', (v) => build(v));
          build('uni');

          el.append(h('div', { class: 'stack fill' },
            h('div', { class: 'row' }, h('span', { class: 'b' }, 'Build:'), seg, h('span', { class: 'grow' }), nextBtn),
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 4fr) minmax(0, 7fr)', gap: '18px' } },
              h('div', { class: 'stack' }, modeCard, infoCard), wrap)));
        },
      },
      /* ---------------------------------------------------------------- 6. Cache coherence simulator */
      {
        title: 'Cache coherence: when two copies disagree',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const X0 = 5;
          let proto = 'off', mem, caches, adds, used, token = 0;
          /* ---- the picture: two processors, their private caches, the bus and memory */
          const svg = s('svg', { viewBox: '0 0 640 310', width: '100%' });
          const V = [0, 1].map((i) => {
            const x = 30 + i * 340, cx = x + 120;
            const o = {
              box: s('rect', { x, y: 8, width: 240, height: 54, rx: 10, class: 's-cpu', 'stroke-width': 2 }),
              sub: s('text', { x: cx, y: 52, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }),
              cbox: s('rect', { x, y: 78, width: 240, height: 78, rx: 10, class: 's-cache', 'stroke-width': 2 }),
              lbox: s('rect', { x: x + 16, y: 106, width: 208, height: 38, rx: 8, fill: 'var(--panel)', stroke: 'var(--line-2)', 'stroke-width': 1.5 }),
              val: s('text', { x: x + 30, y: 131 }),
              strike: s('line', { x1: x + 26, y1: 125, x2: x + 86, y2: 125, stroke: 'var(--muted)', 'stroke-width': 2.5 }),
              tag: s('text', { x: x + 212, y: 130, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 800 }),
            };
            svg.append(o.box, s('text', { x: cx, y: 32, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Processor ' + (i + 1)), o.sub,
              s('line', { x1: cx, y1: 62, x2: cx, y2: 78, class: 's-line' }), o.cbox,
              s('text', { x: cx, y: 97, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 'tx-acc' }, `P${i + 1}’s private cache`),
              o.lbox, o.val, o.strike, o.tag, s('line', { x1: cx, y1: 156, x2: cx, y2: 190, class: 's-line' }));
            return o;
          });
          const pill = s('rect', { x: 205, y: 160, width: 230, height: 24, rx: 12, class: 's-panel', 'stroke-width': 1.5 });
          const pillT = s('text', { x: 320, y: 177, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 });
          const memBox = s('rect', { x: 200, y: 228, width: 240, height: 74, rx: 10, class: 's-mem', 'stroke-width': 2 });
          const memVal = s('text', { x: 320, y: 285, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, class: 's-monot' });
          svg.append(s('rect', { x: 16, y: 190, width: 608, height: 12, rx: 6, class: 's-bus' }), pill, pillT,
            s('line', { x1: 320, y1: 202, x2: 320, y2: 228, class: 's-line' }), memBox,
            s('text', { x: 320, y: 252, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Main memory'), memVal);
          function ping(node) { node.classList.add('ping'); ctx.after(650, () => node.classList.remove('ping')); }
          function bus(msg, cls) { pillT.textContent = 'bus: ' + msg; pill.setAttribute('class', cls || 's-panel'); ping(pill); }

          /* ---- side panels */
          const truth = h('div', { class: 'card tight small' });
          const narr = h('div', { style: { fontSize: '15px', lineHeight: '1.45' } });
          const narrCard = h('div', { class: 'card tight grow', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, narr,
            h('div', { style: { flex: '1 1 0' } }),   // spacer pins the callout to the card bottom so it does not jump as the narration changes
            h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Coherence does not make X&nbsp;=&nbsp;X&nbsp;+&nbsp;1 indivisible. Here each “+&nbsp;1” runs unbroken; if two ever interleave, an update can still be lost (a race: Chapter 5).' }));
          const logEl = h('div', { class: 'log', style: { height: '76px' } });
          const log = (m, cls) => { logEl.append(h('div', { class: cls || '', html: m })); logEl.scrollTop = logEl.scrollHeight; };
          const btns = [];
          function reset() {
            token++;
            mem = X0; adds = 0; used = [null, null];
            caches = [0, 1].map(() => ({ has: false, valid: false, val: null }));
            pillT.textContent = 'bus: idle'; pill.setAttribute('class', 's-panel');
            logEl.replaceChildren();
            log(`X = ${X0} in memory. Neither cache has a copy yet. Protocol: ${proto === 'inv' ? 'invalidation' : 'none'}.`);
            narr.innerHTML = proto === 'inv'
              ? '<b>Invalidation is on.</b> Every cache controller <b>snoops</b> on the bus: when one processor writes X, every other cached copy of X is marked invalid. Press <b>Play the story</b>, or click the actions yourself.'
              : '<b>No protocol.</b> The caches ignore each other, like a broken machine. A read that finds X in its own cache is a <b>hit</b>; otherwise it is a <b>miss</b> and X comes from memory. Try P1 reads, P2 reads, P1 adds 1, P2 reads, or press <b>Play the story</b>.';
            btns.forEach((b) => (b.disabled = false));
            paint();
          }
          // a read: hit in the processor’s own cache if it holds a valid copy, otherwise fetch X from memory
          function read(i) {
            const c = caches[i];
            if (c.has && c.valid) return { v: c.val, hit: true, stale: c.val !== mem };
            const wasInv = c.has && !c.valid;
            bus(`P${i + 1} reads X`); ping(memBox);
            Object.assign(c, { has: true, valid: true, val: mem });
            return { v: mem, hit: false, wasInv };
          }
          function act(i, op) {
            const P = 'P' + (i + 1), O = 'P' + (2 - i), other = caches[1 - i];
            ping(V[i].cbox);
            const r = read(i);
            const how = r.hit ? `a <b>hit</b> in its own cache` : r.wasInv ? `a <b>miss</b>, because its copy was invalidated, so it fetches the fresh value from memory` : `a <b>miss</b>, so it fetches X from memory`;
            if (op === 'r') {
              used[i] = r.v;
              if (r.stale) { narr.innerHTML = `<b class="c-bad">${P} reads X = ${r.v} from its own cache.</b> It is a hit, so ${P} never looks at memory, where X is really <b>${mem}</b>. ${P} is working with a <b>stale copy</b>.`; log(`${P} reads X → ${r.v} (hit, STALE: memory has ${mem})`, 'c-bad'); }
              else { narr.innerHTML = `<b>${P} reads X = ${r.v}</b>: ${how}.`; log(`${P} reads X → ${r.v} (${r.hit ? 'hit' : r.wasInv ? 'miss: its copy was invalid' : 'miss'})`); }
            } else {
              const nv = r.v + 1;
              adds++; used[i] = nv;
              Object.assign(caches[i], { has: true, valid: true, val: nv });
              mem = nv;                                   // write-through: memory is updated on every write
              ping(memBox);
              let then;
              if (proto === 'inv') {
                bus('invalidate X', 's-accent');
                if (other.has && other.valid) { other.valid = false; ping(V[1 - i].cbox); then = `The new value also goes to memory, and the write puts <b>“invalidate X”</b> on the bus. ${O}’s cache controller sees it and marks its copy <b>invalid</b>.`; }
                else then = `The new value also goes to memory, and the write puts “invalidate X” on the bus. No other cache holds a valid copy, so nothing else changes.`;
              } else {
                bus(`P${i + 1} writes X = ${nv}`);
                then = !(other.has && other.valid) ? 'The new value also goes to memory.' : other.val !== mem ? `The new value also goes to memory, but <b>nobody tells ${O}’s cache</b>. Its copy of X is now <b>stale</b>.`
                  : `The new value also goes to memory. Nobody tells ${O}’s cache either; its copy happens to hold ${other.val} too.`;
              }
              const should = X0 + adds, lost = mem !== should;
              narr.innerHTML = `<b>${P} adds 1 to X.</b> It reads ${r.v} (${how}), then writes <b>${nv}</b>. ${then}` +
                (lost ? ` <b class="c-bad">Lost update:</b> X should be ${should}, but it is ${mem}.` : '');
              log(`${P} adds 1: read ${r.v}${r.stale ? ' (STALE)' : ''}, wrote ${nv}${proto === 'inv' ? ', invalidate X' : ''}`, lost ? 'c-bad' : '');
            }
            paint();
          }
          function paint() {
            V.forEach((o, i) => {
              const c = caches[i];
              o.sub.textContent = used[i] == null ? 'has not used X yet' : `last used X = ${used[i]}`;
              o.strike.style.display = c.has && !c.valid ? '' : 'none';
              const stale = c.has && c.valid && c.val !== mem;
              o.lbox.style.stroke = stale ? 'var(--bad)' : c.has && c.valid ? 'var(--ok)' : '';
              o.val.setAttribute('font-size', c.has ? 17 : 14);
              o.val.setAttribute('font-weight', c.has ? 800 : 600);
              o.val.setAttribute('class', c.has ? 's-monot' + (c.valid ? '' : ' tx-muted') : 'tx-muted');
              o.val.textContent = c.has ? `X = ${c.val}` : 'no copy of X';
              o.tag.textContent = !c.has ? '' : !c.valid ? 'invalid' : stale ? 'STALE' : 'valid';
              o.tag.setAttribute('class', !c.valid ? 'tx-muted' : stale ? 'tx-bad' : 'tx-ok');
            });
            memVal.textContent = `X = ${mem}`;
            const should = X0 + adds, lost = mem !== should;
            const staleAt = caches.findIndex((c) => c.has && c.valid && c.val !== mem);
            const st = lost ? ['bad', '✗ lost update'] : staleAt >= 0 ? ['bad', `✗ P${staleAt + 1}’s copy is stale`] : ['ok', '✓ all copies agree'];
            truth.innerHTML = `<div class="row" style="justify-content:space-between"><span>Adds so far: <b>${adds}</b>, so X should be <b>${X0} + ${adds} = ${should}</b></span><span class="chip ${st[0]}">${st[1]}</span></div>`;
          }
          async function story() {
            reset();
            const my = token;
            btns.forEach((b) => (b.disabled = true));
            for (const [i, op] of [[0, 'r'], [1, 'r'], [0, 'a'], [1, 'r'], [1, 'a']]) {
              await ctx.sleep(1100);
              if (!ctx.alive || my !== token) return;
              act(i, op);
            }
            btns.forEach((b) => (b.disabled = false));
          }
          const seg = ctx.ui.seg([{ value: 'off', label: 'No protocol' }, { value: 'inv', label: 'Invalidation (hardware)' }], proto, (v) => { proto = v; reset(); });
          [[0, 'r', 'P1 reads X'], [1, 'r', 'P2 reads X'], [0, 'a', 'P1: X = X + 1'], [1, 'a', 'P2: X = X + 1']].forEach(([i, op, label]) =>
            btns.push(h('button', { type: 'button', class: 'btn cpu', onclick: () => act(i, op) }, label)));
          reset();

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'Two processors share a variable <b>X</b>, which starts at 5 in memory. Each keeps its own copy in a <span class="t">private cache</span>. What goes wrong when one of them changes X?' }),
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'b small' }, 'Coherence:'), seg),
              // one row per processor: its read, its add, then a story/reset control
              h('div', { class: 'grid-3', style: { gap: '8px' } }, btns[0], btns[2], h('button', { type: 'button', class: 'btn primary', onclick: () => story() }, '▶ Play the story'),
                btns[1], btns[3], h('button', { type: 'button', class: 'btn', onclick: () => reset() }, 'Reset')),
              truth, narrCard),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg), logEl,
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters · handled in hardware', html: 'Stale copies make correct programs compute wrong answers. Hardware prevents it, commonly by <span class="t">bus snooping</span> with <span class="t">invalidation</span>: one processor’s write makes every other copy invalid, unseen by programs and the OS.' }))));
        },
      },
      /* ---------------------------------------------------------------- 7. Why multicore */
      {
        title: 'Why chips went multicore: the power wall',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const LIMIT = 64, YMAX = 128, FMIN = 1, FMAX = 5, BEST1 = 4;   // 1 core at 4 GHz sits exactly on the cooling limit
          const X0 = 60, X1 = 620, Y0 = 18, Y1 = 232;
          const px = (f) => X0 + ((f - FMIN) / (FMAX - FMIN)) * (X1 - X0);
          const py = (p) => Y1 - (Math.min(p, YMAX) / YMAX) * (Y1 - Y0);
          const power = (n, f) => n * f ** 3, work = (n, f) => n * f;
          let n = 1, f = 3;
          const svg = s('svg', { viewBox: '0 0 640 274', width: '100%' });
          const clipId = 'sec18-plot-clip';
          const curve = s('path', { fill: 'none', stroke: 'var(--cpu)', 'stroke-width': 3, 'clip-path': `url(#${clipId})` });
          const ref = s('path', { fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'clip-path': `url(#${clipId})` });
          const refLab = s('text', { 'font-size': 13, class: 's-sub' }, '1 core');
          const dot = s('circle', { r: 8, 'stroke-width': 3 });
          const dotLab = s('text', { 'font-size': 14, 'font-weight': 800 });
          const pathFor = (k) => { let d = ''; for (let x = FMIN; x <= FMAX + 1e-9; x += 0.05) d += (d ? 'L' : 'M') + px(x).toFixed(1) + ',' + (Y1 - (power(k, x) / YMAX) * (Y1 - Y0)).toFixed(1); return d; };
          svg.append(
            s('defs', {}, s('clipPath', { id: clipId }, s('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 }))),
            s('rect', { x: X0, y: Y0, width: X1 - X0, height: py(LIMIT) - Y0, fill: 'var(--bad-bg)' }),
            s('text', { x: X0 + 10, y: Y0 + 20, 'font-size': 13.5, 'font-weight': 800, class: 'tx-bad' }, 'too hot to cool'),
            ...[0, 32, 64, 96, 128].map((v) => s('g', {}, s('line', { x1: X0 - 5, y1: py(v), x2: X1, y2: py(v), stroke: 'var(--line)', 'stroke-width': 1 }),
              s('text', { x: X0 - 9, y: py(v) + 4.5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(v)))),
            ...[1, 2, 3, 4, 5].map((v) => s('text', { x: px(v), y: Y1 + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, v + ' GHz')),
            s('line', { x1: X0, y1: py(LIMIT), x2: X1, y2: py(LIMIT), stroke: 'var(--bad)', 'stroke-width': 2.5, 'stroke-dasharray': '8 5' }),
            s('text', { x: X1 - 4, y: py(LIMIT) + 19, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 800, class: 'tx-bad' }, 'cooling limit (64)'),
            s('line', { x1: X0, y1: Y0, x2: X0, y2: Y1, class: 's-line' }), s('line', { x1: X0, y1: Y1, x2: X1, y2: Y1, class: 's-line' }),
            s('text', { x: 14, y: (Y0 + Y1) / 2, 'font-size': 13, 'font-weight': 700, class: 's-sub', transform: `rotate(-90 14 ${(Y0 + Y1) / 2})`, 'text-anchor': 'middle' }, 'total power'),
            s('text', { x: (X0 + X1) / 2, y: 270, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'clock speed of each core'),
            ref, refLab, curve, dot, dotLab);
          /* ---- readouts */
          const workBar = h('i'), powBar = h('i');
          const workVal = h('b', { class: 'mono' }), powVal = h('b', { class: 'mono' });
          const verdict = h('div', { class: 'card tight grow', style: { minHeight: '76px', fontSize: '15px', lineHeight: '1.45' } });
          function update() {
            const P = power(n, f), W = work(n, f), hot = P > LIMIT + 1e-9;
            curve.setAttribute('d', pathFor(n));
            curve.setAttribute('stroke', hot ? 'var(--bad)' : 'var(--cpu)');
            ref.style.display = refLab.style.display = n > 1 ? '' : 'none';
            ref.setAttribute('d', pathFor(1));
            refLab.setAttribute('x', px(4.6)); refLab.setAttribute('y', py(4.6 ** 3) + 18);
            const cx = px(f), cy = py(P);
            dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
            dot.setAttribute('fill', hot ? 'var(--bad-bg)' : 'var(--ok-bg)'); dot.setAttribute('stroke', hot ? 'var(--bad)' : 'var(--ok)');
            dotLab.textContent = `${n} core${n > 1 ? 's' : ''} @ ${f} GHz` + (P > YMAX ? ` (power ${ctx.util.fmt(P, 0)}, off the chart)` : '');
            // keep the label off the rising curve: upper-left on the right half, lower-right on the left half
            const right = cx > 400, off = P > YMAX, low = cy + 22 > Y1 - 8;
            dotLab.setAttribute('x', right ? cx - 14 : cx + 14); dotLab.setAttribute('text-anchor', right ? 'end' : 'start');
            dotLab.setAttribute('y', off ? cy + 26 : right || low ? cy - 12 : cy + 22);
            rows.forEach(([nn, ff], i) => rowEls[i].classList.toggle('on', nn === n && ff === f));
            dotLab.setAttribute('class', hot ? 'tx-bad' : 'tx-ok');
            workBar.style.width = Math.min(100, (W / 20) * 100) + '%';
            powBar.style.width = Math.min(100, (P / YMAX) * 100) + '%';
            powBar.style.background = hot ? 'var(--bad)' : 'var(--ok)';
            workVal.textContent = `${n} × ${f} = ${ctx.util.fmt(W, 2)}`;
            powVal.textContent = `${n} × ${f}³ = ${ctx.util.fmt(P, 1)}`;
            verdict.innerHTML = hot
              ? `<b class="c-bad">Too hot.</b> ${ctx.util.fmt(P, 1)} units of power is over the cooling limit of 64. A real chip like this would overheat, or need cooling far beyond a normal fan and heat sink.`
              : `<b class="c-ok">Fits the cooling budget</b> (${ctx.util.fmt(P, 1)} of 64).` + (n > 1 && W > BEST1
                ? ` Work rate ${ctx.util.fmt(W, 2)}: <b>${ctx.util.fmt(W / BEST1, 2)}×</b> the fastest single core that stays cool (1 core at 4 GHz, work rate 4).`
                : n === 1 ? ' One core can go no faster than 4 GHz before it crosses the limit. Now try several slower cores.' : ' Push the clock or add cores to use the rest of the budget.');
          }
          const sf = ctx.ui.slider({ label: 'Clock speed', min: 1, max: 5, step: 0.25, value: f, format: (v) => v.toFixed(2) + ' GHz', onInput: (v) => { f = v; update(); } });
          const sn = ctx.ui.slider({ label: 'Cores', min: 1, max: 8, step: 1, value: n, onInput: (v) => { n = v; update(); } });
          // four designs worth comparing; clicking a row loads it into the sliders
          const rows = [[1, 4], [1, 5], [4, 2.5], [8, 2]];
          const rowEls = rows.map(([nn, ff]) => { const P = power(nn, ff), ok = P <= LIMIT;
            return h('tr', { role: 'button', tabindex: 0, class: 'pick', onclick: () => { n = nn; f = ff; sn.set(nn); sf.set(ff); update(); },
              onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } } },
              h('td', { class: 'b' }, `${nn} core${nn > 1 ? 's' : ''} @ ${ff} GHz`), h('td', { class: 'mono' }, String(nn * ff)), h('td', { class: 'mono' }, String(P)),
              h('td', { html: ok ? '<span class="c-ok b">✓ cool</span>' : '<span class="c-bad b">✗ too hot</span>' })); });
          const tbl = h('table', { class: 'tbl compact' }, h('tr', {}, h('th', {}, 'Try a design (click)'), h('th', {}, 'Work'), h('th', {}, 'Power'), h('th', {}, 'Fits?')), ...rowEls);
          update();

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'For decades each new chip got faster largely by raising its <span class="t">clock speed</span>. In the mid-2000s that road hit the <span class="t">power wall</span> (met in 1.2): faster chips ran too hot to cool.' }),
              h('p', { class: 'm0 small', html: 'A faster clock needs a higher voltage too, so a core’s power grows roughly with the <b>cube</b> of its clock speed, but its work only in step with the clock. Simplified model: 1 core at 1 GHz = 1 unit of power and 1 unit of work (real chips cannot lower voltage forever, so very slow cores save less than this).' }),
              h('div', { class: 'card tight stack', style: { gap: '8px' } }, sf, sn), tbl, verdict),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg),
              h('div', { class: 'card tight stack', style: { gap: '6px' } },
                h('div', { class: 'meterrow' }, h('span', { class: 'b small' }, 'Work rate'), h('div', { class: 'meter' }, workBar), h('span', { class: 'small' }, workVal)),
                h('div', { class: 'meterrow' }, h('span', { class: 'b small' }, 'Power'), h('div', { class: 'meter lim' }, powBar), h('span', { class: 'small' }, powVal))),
              h('div', { class: 'grid-2', style: { gap: '10px' } },
                h('div', { class: 'callout why m0 small', 'data-label': 'Where the transistors went', html: 'Transistor counts kept growing after clock speeds stalled. Designers spent them on <b>more cores</b> and <b>bigger caches</b>, like the 8 cores and 20 MB L3 of the Core i7-5960X.' }),
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'More cores do not speed up one program by themselves. The work must be split into pieces that can run at once, and the OS must spread them over the cores (see 4.3).' })))));
        },
      },
      /* ---------------------------------------------------------------- 8. Recap */
      {
        title: 'Recap: eight ideas to carry away',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Click each card to flip it. Try to say the answer out loud before you look.'),
            ctx.ui.flipcards([
              ['Three ways to use many processors', '<b>SMP</b>: separate processor chips sharing memory. <b>Multicore</b>: several cores on one chip. <b>Cluster</b>: whole computers linked by a network.'],
              ['What makes an SMP symmetric?', 'Similar processors share one memory and the I/O devices, <b>any of them can do any job</b>, and one integrated OS controls them all.'],
              ['Four payoffs of an SMP', '<b>Performance</b>, <b>availability</b>, <b>incremental growth</b> and <b>scaling</b>. The OS keeps the extra processors transparent to users.'],
              ['How do the processors talk to each other?', 'Through <b>shared main memory</b>: one writes a value, another reads it. The shared bus carries all traffic between processors, memory and I/O.'],
              ['What does each processor or core own?', 'Its own control unit, ALU, registers and pipeline, plus <b>private caches</b> (L1, often L2). Memory, I/O and any L3 are <b>shared</b>.'],
              ['The cache coherence problem', 'A write by one processor can leave <b>stale copies</b> in other caches. Hardware fixes it, for example by snooping and <b>invalidating</b> other copies.'],
              ['Why did chips go multicore?', 'Higher clock speeds hit the <b>power wall</b>: power rises about with the cube of the clock. Spare transistors went into more cores and bigger caches.'],
              ['Core i7-5960X in one breath', '<b>8 x86 cores</b>, a dedicated 256 KB L2 each, a <b>shared 20 MB L3</b>, and an on-chip DDR4 memory controller and PCI Express.'],
            ].map(([f, b]) => [f, `<span style="font-size:15.5px">${b}</span>`]), { cols: 4, height: 182 }),   // one wrapper span: the card face is a flex box, so bare <b> tags would become separate columns
            h('div', { class: 'callout tip m0', 'data-label': 'Where this goes next', html: 'This section showed the hardware. Section 2.6 shows how an OS is designed to run on it, and 4.3 shows how much faster software really gets as cores are added.' })));
        },
      },
      /* ---------------------------------------------------------------- 9. Check yourself */
      {
        title: 'Check yourself: multiprocessors and multicore',
        kind: 'check',
        quiz: [
          { q: 'Which description fits a <b>symmetric multiprocessor (SMP)</b>?',
            choices: ['One processor runs the OS and hands out work; the other processors may only run user programs.',
              'Two or more similar processors share main memory and the I/O devices, any of them can perform any function, and one integrated OS controls them all.',
              'Several complete computers, each with its own memory and OS, cooperate over a network.',
              'One very fast processor with a large cache that many programs take turns using.'],
            answer: 1,
            feedback: ['That boss-and-helpers design is the opposite of symmetric. In an SMP no processor is special: any of them can run the OS.', null,
              'That is a cluster. An SMP is one computer whose processors share a single main memory.', 'That is a uniprocessor: only one processor, however fast.'],
            why: 'An SMP is one computer with similar processors that share memory and I/O, can all do the same jobs, and run under one integrated operating system.' },
          { type: 'tf', q: 'In an SMP, users must tell the system which processor each of their programs should run on.', answer: false,
            why: 'The OS schedules processes and threads across the processors by itself. The existence of several processors is transparent to users; they just see work finish sooner.' },
          { type: 'multi', q: 'On the Intel Core i7-5960X (8 cores on one die), which of these is there <b>just one of</b>, shared by all eight cores? Select all that apply.',
            choices: ['The 20 MB L3 cache', 'The integrated DDR4 memory controller', 'The PCI Express lanes that connect fast devices',
              'The 256 KB L2 cache', 'The L1 data cache', 'The control unit'],
            answer: [0, 1, 2],
            why: 'Each core owns its control unit, ALU, registers, pipeline, L1 caches and a dedicated 256 KB L2 (8 × 256 KB = 2 MB of L2 in all, but no core can use another’s). The 20 MB L3, the memory controller and the PCI Express lanes exist once on the die and serve every core.' },
          { type: 'bucket', q: 'Sort each situation by the SMP advantage it shows.', buckets: ['Performance', 'Availability', 'Incremental growth', 'Scaling'],
            items: [['Four customer requests are handled at the same moment on four processors', 0], ['A server keeps working after one of its processors burns out', 1],
              ['An admin installs a second processor in an empty socket instead of buying a new server', 2], ['A vendor sells one server design in 2-, 4- and 8-processor models', 3],
              ['A faulty processor is taken out of service and users notice no outage', 1]],
            why: 'Performance = more work at once. Availability = surviving a failure. Incremental growth = upgrading the machine you have. Scaling = a product range built from different processor counts.' },
          { q: 'In a classic SMP, why does a memory access take about the same time no matter which processor makes it?',
            choices: ['All processors reach one shared main memory over the same interconnection, so none sits closer to memory than the others.',
              'Each processor has its own private main memory of the same size.', 'The OS copies all of main memory into every processor’s cache.', 'Only one processor runs at a time, so they never compete for memory.'],
            answer: 0,
            feedback: [null, 'Private memories per processor describe a cluster, not an SMP. SMP processors share one memory.',
              'Caches hold only small, recently used pieces of memory, and the hardware, not the OS, fills them.', 'All the processors in an SMP run at the same time; that is the whole point.'],
            why: 'The processors share a single memory through a bus or other interconnection scheme, so every processor has roughly the same path to it and the same access time.' },
          { type: 'match', q: 'Match each part of a multicore chip with its description.',
            pairs: [['Core', 'A complete processor: control unit, ALU, registers, pipeline and L1 caches'], ['L1 cache', 'The smallest, fastest cache, private to one core'],
              ['Shared L3 cache', 'A large on-chip cache used by all the cores'], ['Die', 'The single piece of silicon that holds all the cores'],
              ['Integrated memory controller', 'On-chip circuitry that drives the main-memory modules']],
            why: 'Each core is a full processor with private L1 (and often L2) caches; a larger L3 on the same die is shared; the memory controller built onto the chip talks to main memory.' },
          { q: 'Processors P1 and P2 each hold a copy of X = 5 in their private caches. P1 changes X to 6, and the new value is also written to main memory. There is <b>no</b> cache coherence mechanism, and P2’s old copy is still in its cache. What does P2 get when it next reads X?',
            choices: ['6, because main memory now holds 6', '5, the stale copy in its own cache', 'An error, because two different copies of X exist', 'Nothing: P2 must wait until P1 releases X'],
            answer: 1,
            feedback: ['Memory does hold 6, but P2 finds X in its own cache (a hit) and never looks at memory.', null,
              'The hardware raises no error; that silence is what makes stale data so dangerous.', 'Caches do not lock data; without coherence nothing makes P2 wait or refetch.'],
            why: 'P2’s read hits in its own cache and returns the old value 5. Keeping every cached copy consistent is the cache coherence problem, and hardware usually solves it.' },
          { type: 'order', q: 'Put these events in order for a machine that keeps caches coherent by invalidation.',
            items: ['P1 and P2 both read X = 5 into their private caches', 'P1 executes a write of X = 6', 'That write sends an “invalidate X” message over the shared bus',
              'P2’s snooping cache controller marks its copy of X invalid', 'P2 reads X, misses, and fetches the new value 6'],
            why: 'Both caches load X; P1’s write puts an invalidate on the bus; P2’s snooping controller sees it and invalidates its copy; P2’s next read misses and gets the fresh value.' },
          { type: 'tf', q: 'In an SMP, only one designated processor may run operating-system code; the rest run application programs.', answer: false,
            why: 'That would be an asymmetric (master/slave) design. In an SMP every processor can perform the same functions, including running the kernel. That is what “symmetric” means.' },
          { q: 'In the simple power model (power grows with the cube of the clock speed, work in proportion to it), a chip with one 4 GHz core is replaced by a chip with eight 2 GHz cores; both use 64 units of power. An old program that is one single stream of instructions, never split into parts, runs on the new chip. What happens to its speed?',
            choices: ['It runs about half as fast: it can use only one core, and that core’s clock is half as fast.',
              'It runs 4 times as fast, because the new chip does 16 units of work instead of 4.', 'It runs at the same speed, because the OS automatically splits every program across the cores.', 'It cannot run at all until it is rewritten for a multicore chip.'],
            answer: 0,
            feedback: [null, 'That is the whole chip’s capacity. One stream of instructions runs on one core at a time, so the other seven cores do nothing for this program.', 'The OS can place separate programs or threads on separate cores, but it cannot cut one sequential stream of instructions into parallel pieces by itself.',
              'It runs fine on any one of the cores; it simply cannot use the other seven.'],
            why: 'One stream of instructions runs on one core at a time, and in this model a 2 GHz core does half the work per second of a 4 GHz core. The chip’s extra capacity (16 units of work instead of 4) pays off only when the work is split into pieces the OS can spread over the cores (see 4.3).' },
          { type: 'num', q: 'In a simple power model, a core’s power grows with the <b>cube</b> of its clock speed, while its work rate grows in proportion to its clock speed. One core running at 4 GHz uses 64 units of power. How many units of power does a chip with <b>4 cores at 2 GHz</b> use?', answer: 32, tol: 0, unit: 'units',
            why: '64 = 4³, so in this model 1 GHz costs 1 unit. Each 2 GHz core uses 2³ = 8 units, and 4 cores use 4 × 8 = 32: half the power of the single 4 GHz core, yet they do 4 × 2 = 8 units of work, twice as much, provided the software keeps all four cores busy.' },
          { type: 'num', q: 'An SMP’s OS spreads 12 independent jobs, each needing 4 seconds of processor time, over 3 identical processors. If every processor stays busy, how many seconds until all the jobs are done?', answer: 16, tol: 0, unit: 's',
            why: 'Total work = 12 × 4 = 48 seconds. Shared by 3 processors, that is 48 ÷ 3 = 16 seconds (each processor runs 4 jobs). One processor alone would need 48 seconds.' },
        ],
      },
    ],
    notes: `
<h3>1. Why use more than one processor?</h3>
<p>A <b>uniprocessor</b> has exactly one processor, so it follows one stream of instructions at a time. <b>Parallel processing</b> means doing several pieces of work at the same moment on separate processors. Three common designs:</p>
<table>
    <tr><th>Design</th><th>Where the processors are</th><th>Shared main memory?</th><th>Operating system</th></tr>
    <tr><td><b>Symmetric multiprocessor (SMP)</b></td><td>separate processor chips (one per socket) in one computer</td><td>yes, one memory</td><td>one integrated OS for all</td></tr>
    <tr><td><b>Multicore computer</b> (chip multiprocessor)</td><td>several cores on a single chip (one die)</td><td>yes, one memory</td><td>one integrated OS for all</td></tr>
    <tr><td><b>Cluster</b> (only mentioned here)</td><td>separate complete computers linked by a fast network</td><td>no, each has its own and they exchange messages</td><td>one copy per computer</td></tr>
</table>
<p>The ideas combine: a server with two 8-core chips is an SMP with 16 cores.</p>

<h3>2. The five marks of an SMP</h3>
<ol>
    <li><b>Two or more similar processors</b> of comparable capability (same kind, roughly the same speed), so the OS can treat them as interchangeable.</li>
    <li>They <b>share the same main memory</b> and I/O facilities, connected by a bus or other interconnection scheme, so a memory access takes <b>about the same time</b> whichever processor makes it.</li>
    <li>They <b>share access to the I/O devices</b>, either over the same paths or over different paths that lead to the same device.</li>
    <li><b>All processors can perform the same functions</b>: run user programs, run OS code, handle interrupts. This equality is why the design is called <b>symmetric</b>.</li>
    <li>The system is controlled by <b>one integrated operating system</b> that lets the processors and their programs cooperate at the level of jobs, tasks, files and individual data elements.</li>
</ol>
<p><b>Common mistake:</b> “symmetric” does not mean running one program in lockstep. It means no processor is special; a design where one boss processor alone runs the OS is asymmetric.</p>

<h3>3. Advantages of an SMP over a uniprocessor</h3>
<ul>
    <li><b>Performance</b>: if work can be split into parts, they run at the same moment on different processors, so more gets done per second.</li>
    <li><b>Availability</b>: since all processors can do the same jobs, one failure does not halt the machine; the others carry on, more slowly. A uniprocessor has no spare.</li>
    <li><b>Incremental growth</b>: the owner can make the system stronger by adding a processor to the existing machine instead of replacing it.</li>
    <li><b>Scaling</b>: a vendor can offer a range of products at different prices and performance levels by building them with different numbers of processors.</li>
</ul>
<p>The multiple processors are <b>transparent</b> to the user: nobody chooses a processor. The OS schedules processes and threads across all the processors and synchronizes them when they share data. A program only speeds up if its work can really be divided (see 4.3).</p>
<p><b>Worked example.</b> 12 independent jobs each need 4 s of processor time: total work 12 × 4 = 48 s. One processor needs 48 s. With 2 processors kept busy the jobs finish in 48 ÷ 2 = 24 s; with 3, in 16 s; with 4, in 12 s. If one of 2 processors fails, its unfinished job is requeued and the survivor finishes everything, just later.</p>
<h3>4. How an SMP is organized</h3>
<ul>
    <li>Each processor is <b>self-contained</b>: its own control unit, ALU, registers and pipeline, plus one or two levels of <b>private cache</b> (L1, often L2).</li>
    <li>The processors reach <b>one shared main memory</b> and the <b>I/O subsystem</b> over a <b>shared system bus</b>. The bus is simple but carries one transfer at a time, so processors sometimes wait for it.</li>
    <li>Because every processor sees the same memory, processors can <b>communicate through memory</b>: one writes a value into a shared location, another reads it.</li>
</ul>

<h3>5. The cache coherence problem</h3>
<p>Private caches create copies that other processors cannot see. Suppose X = 5 and both P1 and P2 have cached X. P1 writes X = 6 (also written through to memory), but P2’s cache still says 5, so P2’s next read <b>hits</b> in its own cache and returns the <b>stale</b> value 5. The table follows the story on.</p>
<p><b>Cache coherence</b> means keeping every cached copy of the same data consistent. It is solved <b>in hardware</b>, invisibly to programs and the OS. A common method is <b>bus snooping</b> with <b>invalidation</b>: every cache controller watches the shared bus; when one processor writes X, an “invalidate X” message makes every other cache mark its copy (the whole cache line) invalid, so the next read of X misses and fetches the fresh value.</p>
<p><b>Coherence is not mutual exclusion.</b> It keeps copies consistent but does not make X = X + 1 indivisible: if two processors interleave their read and write steps, an update can still be lost (a race condition, cured in Chapter 5).</p>
<table>
    <tr><th>Event</th><th>No protocol</th><th>With invalidation</th></tr>
    <tr><td>P1 reads X, P2 reads X</td><td>both caches hold 5</td><td>both caches hold 5</td></tr>
    <tr><td>P1 adds 1</td><td>P1 and memory hold 6; P2 still holds 5 (stale)</td><td>P1 and memory hold 6; P2’s copy is invalidated</td></tr>
    <tr><td>P2 reads X</td><td>hit: gets 5 (wrong)</td><td>miss: fetches 6</td></tr>
    <tr><td>P2 adds 1</td><td>writes 6: an update is lost</td><td>writes 7 (correct); P1’s copy is invalidated</td></tr>
</table>

<h3>6. Multicore computers</h3>
<p>A <b>multicore computer</b>, or <b>chip multiprocessor</b>, puts two or more processors, called <b>cores</b>, on a single piece of silicon, the <b>die</b>. Each core has its own registers, ALU, pipeline, control unit and L1 caches (the smallest, fastest level, often split into L1-I for instructions and L1-D for data). There is usually an L2 cache per core, and often an L3 cache that all the cores <b>share</b>. To the OS each core looks like a separate processor, so a multicore chip works much like a small SMP.</p>
<p><b>Why multicore?</b> For decades each new chip got faster largely by raising its <b>clock speed</b>. A faster clock also needs a higher voltage, so power, and therefore heat, rises far faster than speed: in a simple model a core’s power grows with the <b>cube</b> of its clock speed while its work grows only in proportion to it. In the mid-2000s this <b>power wall</b> stopped clock growth. Transistor counts kept rising, so designers spent the extra transistors on <b>more cores and bigger caches</b>.</p>
<p><b>Worked example (model: 1 core at 1 GHz = 1 unit of power and 1 of work; cooling limit 64).</b> 1 core at 4 GHz: power 4³ = 64 (at the limit), work 4. 1 core at 5 GHz: power 125, too hot. 4 cores at 2 GHz: power 4 × 8 = 32, work 8. 4 cores at 2.5 GHz: power 4 × 15.625 = 62.5, work 10 (2.5 times the best cool single core). 8 cores at 2 GHz: power 64, work 16. The gain needs software that keeps every core busy: a program that is one single stream of instructions runs on only one core, so on the 8 × 2 GHz chip it runs at half the speed it had on one 4 GHz core. Also, real voltages cannot drop forever, so slow cores save less than the model says.</p>

<h3>7. A real example: Intel Core i7-5960X (2014)</h3>
<ul>
    <li><b>Eight x86 cores</b> on one die; each core has its own L1 caches (32 KB instructions + 32 KB data).</li>
    <li>Each core has a <b>dedicated 256 KB L2 cache</b> (8 × 256 KB = 2 MB in all, but each core uses only its own).</li>
    <li>All eight cores <b>share a 20 MB L3 cache</b>.</li>
    <li>An <b>integrated memory controller</b> for DDR4 main memory (four channels) and <b>PCI Express</b> lanes for fast devices (graphics cards, SSDs) are built onto the chip.</li>
    <li>Private per core: control unit, ALU, registers, pipeline, L1s, L2. One per chip, shared by all cores: L3, memory controller, PCIe lanes.</li>
</ul>
`,
  });
})();
