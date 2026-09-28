// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 1.8 Multiprocessor and Multicore Organization
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its helper names stay private to this file
  /* ------------------------------------------------------------------ shared helpers */
  // multi-line SVG text: lines is a string or an array of strings (one tspan per line)
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {  // mtext(s, x, y, lines, attrs, lh): builds one SVG (the browser's drawing format) text element with one or more lines, lh pixels apart
    const t = s('text', Object.assign({ x, y }, attrs));  // t is the text element at (x, y), with any extra attributes such as a class merged in
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // each line becomes a tspan (a piece of SVG text); the first stays in place and each later one moves down lh pixels
    return t;  // hands the finished text element to the caller
  }  // ends mtext()
  // a clickable SVG group that works with mouse, keyboard and scripted checks
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(ctx, onAct, label, ...kids): wraps drawing parts in a group the student can click, tap or activate from the keyboard
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // the group: class "hot" for its hover style, tabindex 0 so Tab can reach it, and a role and label for screen readers
    g.addEventListener('click', onAct);  // a mouse click or tap runs onAct
    // SVG elements have no .click(); automated checks send synthetic pointer events, so accept those too
    g.addEventListener('pointerdown', (e) => { if (!e.isTrusted) onAct(); });  // a scripted pointer press (not a real user one, so isTrusted is false) also runs onAct, so the guide's own checks can press it
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // pressing Enter or Space while the group has keyboard focus runs onAct, as it would on a normal button
    return g;  // hands the group to the caller
  }  // ends hotGroup()

  /* ------------------------------------------------------------------ step 5 data: the machine builder */
  const MODES = [  // MODES: the four machines the step 5 builder can show, as options for its switch
    { value: 'uni', label: 'Uniprocessor' }, { value: 'smp', label: 'SMP' },  // options: a single-processor machine and a symmetric multiprocessor
    { value: 'multi', label: 'Multicore chip' }, { value: 'i7', label: 'Real chip: Core i7-5960X' },  // options: a generic multicore chip and a real chip, the Core i7-5960X
  ];  // closes the MODES list
  const MODE_TEXT = {  // MODE_TEXT: for each machine, its full name, three short fact chips, and a paragraph describing it
    uni: { name: 'Uniprocessor', chips: ['1 processor', '1 chip', 'private L1 + L2'],  // uniprocessor: one processor, one chip, private L1 and L2 caches
      what: 'One processor with its own <span class="t">control unit</span>, ALU, registers and <span class="t">pipeline</span>, backed by private L1 and L2 caches. Main memory and the I/O devices hang off one system bus.' },  // uniprocessor description: one processor with its own parts and caches, with memory and I/O on one bus
    smp: { name: 'Symmetric multiprocessor', chips: ['3 processors', '3 chips', 'shared bus + memory'],  // SMP: three processors, three chips, a shared bus and memory
      what: 'The same processor, three times over. Each is a <b>separate chip</b> with its own private caches. All three share <b>one bus, one main memory and one set of I/O devices</b>, and can pass data to each other through memory.' },  // SMP description: the same processor three times over, as separate chips sharing one bus, memory and I/O
    multi: { name: 'Multicore chip', chips: ['4 cores', '1 chip (die)', 'private L1 + L2, shared L3'],  // multicore: four cores on one chip, private L1 and L2, one shared L3
      what: 'The processors shrink into <b>cores on one <span class="t">die</span></b>. Each core keeps its own control unit, ALU, registers, pipeline and L1 caches. Here each core also has a private L2, and one big <b>L3 is shared</b> by all the cores.' },  // multicore description: processors shrink into cores on one die, each keeping its own parts, sharing one L3
    i7: { name: 'Intel Core i7-5960X (2014)', chips: ['8 x86 cores', '256 KB L2 each', '20 MB shared L3'],  // real chip: eight x86 cores, 256 KB of L2 each, 20 MB of shared L3
      what: 'A real desktop chip: <b>eight x86 cores</b>, each with a <b>dedicated L2</b>, all sharing a <b>20 MB L3</b>. The DDR4 <span class="t" data-t="Integrated memory controller">memory controller</span> and the <span class="t">PCI Express</span> connections are built onto the same die.' },  // real chip description: eight cores, dedicated L2s, a shared L3, with the memory controller and PCI Express on the die
  };  // closes the MODE_TEXT table
  const PART_INFO = {  // PART_INFO: the heading and explanation shown when the student clicks a part of the machine drawing
    chip: ['Chip', 'A processor chip in its own socket on the motherboard.'],  // part "chip": a processor chip in its own socket
    proc: ['Processor', 'A self-contained processor: control unit, ALU, registers and pipeline, plus its own L1 caches. It can run a program entirely by itself.'],  // part "proc": a self-contained processor that can run a program by itself
    cu: ['Control unit', 'Fetches each instruction, decodes it and directs the other parts to carry it out. Every processor, and every core, has its own.'],  // part "cu": the control unit, which fetches, decodes and directs
    alu: ['ALU', 'The arithmetic logic unit does the adding, comparing and logic. With one per processor or core, they can all compute at the same moment.'],  // part "alu": the arithmetic logic unit, one per processor or core
    regs: ['Registers', 'The processor’s own tiny, fastest storage (program counter, instruction register, data registers). A separate set per processor or core lets each follow its own program.'],  // part "regs": the registers, a separate set per processor or core
    pipe: ['Pipeline', 'Assembly-line hardware that overlaps the fetch, decode and execute stages of several instructions. Each processor or core has a complete pipeline of its own.'],  // part "pipe": the pipeline that overlaps instruction stages
    l1: ['L1 cache (private)', 'The smallest, fastest cache, used by one processor or core alone. It is often split into an instruction cache (L1-I) and a data cache (L1-D).'],  // part "l1": the private L1 cache, often split into instruction and data halves
    l2: ['L2 cache (private)', 'A larger, slightly slower cache behind L1, private to its processor or core. Because it is private, another processor never sees what is in it: remember this for cache coherence.'],  // part "l2": the private L2 cache, which other processors never see (a hint for cache coherence later)
    l3: ['L3 cache (shared)', 'One large cache on the chip that every core uses. A block one core brings in can be found by the others without a trip to main memory, and busy cores can use more of the space.'],  // part "l3": the shared L3 cache used by every core
    bus: ['System bus (shared)', 'The one path every processor uses to reach memory and I/O. It is simple, but it carries one transfer at a time, so processors sometimes wait their turn.'],  // part "bus": the shared system bus, one transfer at a time
    mem: ['Main memory (shared)', 'One memory holds every program and its data. Because all processors see the same memory, they can communicate through it: one writes a value, another reads it.'],  // part "mem": the shared main memory, through which processors can communicate
    io: ['I/O subsystem (shared)', 'Disks, network and other devices. Every processor reaches them over the same bus, and any processor can start a transfer.'],  // part "io": the shared I/O devices, reachable by any processor
  };  // closes the PART_INFO table
  const PART_MODE = {  // PART_MODE: explanations that replace the general ones in PART_INFO for a particular machine
    uni: { chip: ['Chip', 'The whole processor, with its L1 and L2 caches, sits on a single chip.'] },  // uniprocessor: the chip holds the whole processor with its caches
    smp: { chip: ['Separate chips', 'In this SMP each processor is its own chip in its own socket. The chips meet only on the shared bus.'],  // SMP: each processor is its own chip, meeting the others only on the shared bus
      proc: ['Processor (one of three)', 'Each processor is self-contained: control unit, ALU, registers, pipeline and L1 caches. Any of the three can run any program, including the OS.'] },  // SMP: each processor is self-contained and any of the three can run any program, including the operating system
    multi: { chip: ['One chip (die)', 'All four cores and the shared L3 sit on one slab of silicon. Cores exchange data on the chip itself, which is much faster than going out over the system bus.'],  // multicore: one die holds all four cores and the shared L3, so cores exchange data on the chip
      proc: ['Core', 'A complete processor shrunk to fit beside its neighbours on one die. To the OS, every core looks like a separate processor.'],  // multicore: a core is a complete processor, and each core looks like a separate processor to the operating system
      l2: ['L2 cache (dedicated)', 'On this chip each core has its own L2, private to that core. (Some chip designs share L2 between cores instead.)'],  // multicore: each core has its own dedicated L2 here (other designs may share L2)
      bus: ['System bus', 'Takes requests that miss in every cache out of the chip to main memory and the I/O devices.'] },  // multicore: the system bus carries requests that miss every cache out to memory and I/O
    i7: { chip: ['The die', 'One slab of silicon holding all eight cores, their caches, the shared L3, the memory controller and the PCI Express lanes.'],  // real chip: the die holds the eight cores, their caches, the L3, the memory controller and the PCI Express lanes
      proc: ['x86 core', 'One of eight complete cores. Each has its own control unit, ALU, registers and pipeline, plus two 32 KB L1 caches (one for instructions, one for data).'],  // real chip: each x86 core has its own parts plus two 32 KB L1 caches
      l2: ['L2 cache: 256 KB, dedicated', 'Each core has its own 256 KB L2 cache. Eight cores × 256 KB = 2 MB of L2 in total, but no core can use another core’s L2.'],  // real chip: each core's 256 KB L2 is dedicated, 2 MB in total, and no core can use another's
      l3: ['L3 cache: 20 MB, shared', 'All eight cores share one 20 MB L3 cache on the die. It catches the misses from every core’s L2 before they have to go to main memory.'],  // real chip: all eight cores share the 20 MB L3
      imc: ['Integrated memory controller (DDR4)', 'Circuitry on the chip that drives the DDR4 memory modules over four channels. Building it in saves a trip through a separate chip on every memory access.'],  // real chip: the integrated memory controller drives DDR4 memory over four channels
      pcie: ['PCI Express (40 lanes)', 'Fast links built into the chip that connect devices such as graphics cards and SSDs straight to the processor.'],  // real chip: 40 PCI Express lanes built into the chip
      mem: ['DDR4 main memory', 'The memory modules plugged into the motherboard. The cores reach them through the on-chip memory controller.'],  // real chip: the DDR4 memory modules, reached through the on-chip controller
      io: ['PCIe devices', 'Graphics cards, solid-state drives and other fast devices attached through the chip’s PCI Express lanes.'] },  // real chip: fast devices such as graphics cards and SSDs attached through PCI Express, then closes the i7 entry
  };  // closes the PART_MODE table

  Guide.section({  // registers section 1.8 with the guide; everything below is the section's data, steps and styles
    id: '1.8',  // section number, used in links, the page address and saved progress
    title: 'Multiprocessor and Multicore Organization',  // the section's full title
    short: 'Multiprocessors',  // short name shown where space is tight
    summary: 'Why and how computers use several processors: SMPs, multicore chips, their payoffs and cache coherence.',  // one-sentence summary shown on the chapter page
    objectives: [  // learning objectives: what a student should be able to do after this section
      'Distinguish three ways of building parallel hardware: symmetric multiprocessors (SMPs), multicore computers and clusters.',  // objective 1: tell apart SMPs, multicore computers and clusters
      'List the defining characteristics of an SMP and explain what makes it “symmetric”.',  // objective 2: the defining features of an SMP and why it is called symmetric
      'Explain the four advantages of an SMP over a uniprocessor (performance, availability, incremental growth, scaling) and how the OS keeps the extra processors transparent to users.',  // objective 3: the four advantages of an SMP and how the operating system keeps extra processors invisible to users
      'Describe how an SMP and a multicore chip are organized (private caches, shared caches, shared memory and bus), and explain the cache coherence problem and how invalidation solves it.',  // objective 4: how SMPs and multicore chips are organised, the cache coherence problem, and invalidation
      'Explain why chip makers switched to multicore designs, using the Intel Core i7-5960X as a real example.',  // objective 5: why chip makers switched to multicore, with the Core i7-5960X as an example
    ],  // closes the objectives list
    terms: [  // key terms for this section: each entry is a term and its definition, used in the glossary and flip cards
      ['Parallel processing', 'Doing several pieces of work at the same moment on separate processors, instead of one after another on a single processor.'],  // glossary entry: defines parallel processing
      ['Uniprocessor', 'A computer with exactly one processor, so it can carry out only one stream of instructions at any moment.'],  // glossary entry: defines a uniprocessor
      ['Symmetric multiprocessor (SMP)', 'One computer with two or more similar processors of comparable capability that share main memory and the I/O devices, can each perform any function, and are all controlled by one integrated operating system.'],  // glossary entry: defines a symmetric multiprocessor (SMP)
      ['Multicore computer (chip multiprocessor)', 'A computer whose processor chip holds two or more complete processors, called cores, built on a single piece of silicon (one die).'],  // glossary entry: defines a multicore computer
      ['Die', 'The single small slab of silicon on which a chip’s circuits are built. A multicore chip puts all of its cores, and usually some shared cache, on one die.'],  // glossary entry: defines a die
      ['Cluster', 'A group of complete, separate computers, each with its own memory and operating system, linked by a fast network and working together as if they were one bigger machine.'],  // glossary entry: defines a cluster
      ['Availability', 'How much of the time a system is up and doing useful work. In an SMP, the failure of one processor does not stop the machine, because the others carry on.'],  // glossary entry: defines availability
      ['Incremental growth', 'Making a system more powerful one step at a time, for example by adding a processor to an existing SMP instead of replacing the whole machine.'],  // glossary entry: defines incremental growth
      ['Scaling', 'Offering a family of products at different prices and performance levels by building them with different numbers of processors.'],  // glossary entry: defines scaling
      ['Transparency (transparent)', 'A mechanism is transparent when users cannot see it and need not do anything about it. In an SMP the OS spreads the work across the processors, so users need not know how many there are.'],  // glossary entry: defines transparency
      ['Private cache', 'A cache used by one processor or core alone, such as each core’s L1 cache. Its opposite is a shared cache, used by all the cores on a chip, such as the L3 on many multicore chips.'],  // glossary entry: defines a private cache and contrasts it with a shared cache
      ['Cache coherence', 'Keeping every cached copy of the same memory data consistent, so that no processor or core keeps working with an out-of-date (stale) value after another one has changed it.'],  // glossary entry: defines cache coherence
      ['Invalidation', 'A cache coherence technique: when one processor writes a data item, the hardware marks every other cache’s copy of the block (cache line) holding that item invalid, so the next read of it misses and fetches the new value.'],  // glossary entry: defines invalidation
      ['Bus snooping (snooping)', 'A hardware technique in which every cache controller watches the shared bus for other processors’ writes, so it can invalidate its own copy of anything that changed.'],  // glossary entry: defines bus snooping
      ['Control unit', 'The part of a processor that fetches and decodes instructions and sends the signals that make the ALU, the registers and memory carry them out.'],  // glossary entry: defines the control unit
      ['Pipeline', 'Hardware inside a processor that works on several instructions at once, each at a different stage (fetch, decode, execute, and so on), like an assembly line.'],  // glossary entry: defines a pipeline
      ['Clock speed (clock rate)', 'How many clock cycles a processor completes per second, measured in hertz. 3 GHz means 3 billion cycles per second; the processor does its work in steps timed by these ticks.'],  // glossary entry: defines clock speed
      ['Power wall', 'The limit reached in the mid-2000s when raising the clock speed further made chips use too much power and produce more heat than normal cooling could remove, so designers began adding cores instead.'],  // glossary entry: defines the power wall
      ['Integrated memory controller', 'Circuitry built onto the processor chip itself that drives the main-memory (DRAM) chips, so memory requests do not have to pass through a separate chip.'],  // glossary entry: defines an integrated memory controller
      ['PCI Express (PCIe)', 'A fast point-to-point connection standard for attaching devices such as graphics cards and solid-state drives. On many modern chips, including the Core i7-5960X, some PCIe lanes come straight out of the processor chip itself.'],  // glossary entry: defines PCI Express (PCIe)
    ],  // closes the key terms list
    css: ` /* start of the section's own styles, added to the page once when the section registers; every rule starts with .sec-1-8 so it only affects this section */
      .sec-1-8 .step-eyebrow { flex-wrap: wrap; row-gap: 2px; contain: inline-size; }   /* long section title: wrap on phones instead of widening the page */
      .sec-1-8 .hot { cursor: pointer; outline: none; } /* clickable drawing parts show a pointing-hand cursor; the browser's focus outline is replaced by the thicker frame below */
      .sec-1-8 .hot .fr { transition: stroke-width .12s; } /* the frame of a clickable part changes thickness smoothly instead of jumping */
      .sec-1-8 .hot:hover .fr, .sec-1-8 .hot:focus-visible .fr { stroke-width: 3.5; } /* when the mouse is over a clickable part, or the keyboard has focused it, its frame gets thicker so the student sees what is active */
      .sec-1-8 .tx-cpu { fill: var(--cpu); } .sec-1-8 .tx-mem { fill: var(--mem); } .sec-1-8 .tx-io { fill: var(--io); } /* SVG text colour classes: processor, memory and I/O colours */
      .sec-1-8 .tx-os { fill: var(--os); } .sec-1-8 .tx-ok { fill: var(--ok); } .sec-1-8 .tx-bad { fill: var(--bad); } /* SVG text colour classes: operating-system, success and error colours */
      .sec-1-8 .tx-intr { fill: var(--intr); } .sec-1-8 .tx-warn { fill: var(--warn); } .sec-1-8 .tx-acc { fill: var(--accent); } /* SVG text colour classes: interrupt, warning and accent colours */
      .sec-1-8 .tx-muted { fill: var(--muted); } /* SVG text colour class: muted grey */
      .sec-1-8 .c-cpu { color: var(--cpu); } .sec-1-8 .c-mem { color: var(--mem); } .sec-1-8 .c-io { color: var(--io); } /* ordinary text colour classes: processor, memory and I/O colours */
      .sec-1-8 .c-os { color: var(--os); } .sec-1-8 .c-ok { color: var(--ok); } .sec-1-8 .c-bad { color: var(--bad); } /* ordinary text colour classes: operating-system, success and error colours */
      .sec-1-8 .c-intr { color: var(--intr); } .sec-1-8 .c-warn { color: var(--warn); } .sec-1-8 .c-acc { color: var(--accent); } /* ordinary text colour classes: interrupt, warning and accent colours */
      .sec-1-8 .s-cache { fill: var(--accent-bg); stroke: var(--accent); } /* cache boxes in the drawings: accent-tinted fill with an accent outline */
      .sec-1-8 .dim { opacity: .35; transition: opacity .2s; } /* faded parts of a drawing, with a gentle fade-in and fade-out */
      /* step 1: route pictures */
      .sec-1-8 .route { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 8px 8px 6px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; color: var(--ink); font: inherit; } /* step 1's picture buttons: a picture stacked above its name inside a rounded, clickable card */
      .sec-1-8 .route:hover { border-color: var(--chc); } /* on hover, the card's border takes the chapter colour */
      .sec-1-8 .route.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); } /* the chosen card: chapter-coloured border, a light tint of the chapter colour and a thin glow */
      .sec-1-8 .route .rname { font-weight: 800; font-size: 15px; text-align: center; } /* the design name under each picture: bold, centred */
      /* step 2: the five marks */
      .sec-1-8 .feat { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; align-items: center; text-align: left; padding: 12px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); cursor: pointer; font: inherit; font-size: 15px; line-height: 1.3; color: var(--ink); } /* step 2's feature buttons: a number badge column and a text column in a rounded, clickable box */
      .sec-1-8 .feat:hover { border-color: var(--chc); } /* on hover, the feature box's border takes the chapter colour */
      .sec-1-8 .feat .n { width: 26px; height: 26px; border-radius: 8px; background: var(--panel-3); display: grid; place-items: center; font-weight: 800; font-size: 14px; } /* the number badge on each feature: a small rounded square with a bold number */
      .sec-1-8 .feat.seen .n { background: var(--ok-bg); color: var(--ok); } /* once a feature has been opened, its badge turns green so the student can see which ones are done */
      .sec-1-8 .feat.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); } /* the feature currently open: chapter-coloured border, light tint and glow */
      .sec-1-8 .feat.on .n { background: var(--chc); color: var(--panel); } /* the open feature's badge is filled with the chapter colour */
      /* step 3: advantages lab */
      .sec-1-8 .sock { display: grid; grid-template-columns: 78px minmax(0, 1fr) 138px; gap: 12px; align-items: center; padding: 6px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); } /* step 3's processor rows (sockets): name, status with a meter, and a button, in three columns */
      .sec-1-8 .sock .lab { font-weight: 800; font-size: 14.5px; text-align: center; border: 2px solid var(--cpu); background: var(--cpu-bg); color: var(--cpu); border-radius: 8px; padding: 3px 0; } /* the processor's name tag: bold, centred, in processor colours */
      .sec-1-8 .sock .st { font-size: 14.5px; margin-bottom: 4px; } /* the status text above each socket's meter */
      .sec-1-8 .sock .meter > i { background: var(--proc); } /* the socket's load meter fills in the process colour */
      .sec-1-8 .sock .btn { width: 100%; } /* each socket's button fills its column */
      .sec-1-8 .sock.empty { border-style: dashed; background: transparent; } /* an empty socket: dashed border and no background */
      .sec-1-8 .sock.empty .lab { border-style: dashed; border-color: var(--line-2); background: transparent; color: var(--muted); font-weight: 650; } /* an empty socket's name tag: dashed and muted */
      .sec-1-8 .sock.failed { background: var(--intr-bg); border-color: color-mix(in srgb, var(--intr) 40%, transparent); } /* a failed processor: its row is tinted in the interrupt colour */
      .sec-1-8 .sock.failed .lab { border-color: var(--intr); background: var(--panel); color: var(--intr); text-decoration: line-through; } /* a failed processor's name tag: interrupt colour, and crossed out */
      .sec-1-8 .jq { display: flex; gap: 4px; flex-wrap: wrap; min-height: 26px; align-items: center; } /* a socket's queue of jobs: a wrapping row of small chips with a fixed minimum height so rows line up */
      .sec-1-8 .jchip { font-family: var(--mono); font-size: 12.5px; font-weight: 800; padding: 2px 6px; border-radius: 6px; background: var(--proc-bg); color: var(--proc); border: 1px solid color-mix(in srgb, var(--proc) 40%, transparent); } /* one job chip: small bold fixed-width text in process colours */
      .sec-1-8 .disc { border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; background: var(--panel-2); } /* a discovery card, one per advantage the student has found */
      .sec-1-8 .disc .dh { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 16px; } /* the discovery card's heading: a lock badge and a bold title on one line */
      .sec-1-8 .disc .lk { width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 13px; background: var(--panel-3); color: var(--muted); flex: none; } /* the small square lock badge before each discovery title, muted until found */
      .sec-1-8 .disc .dt { font-size: 14px; line-height: 1.4; color: var(--ink-2); margin-top: 3px; } /* the discovery card's explanation text */
      .sec-1-8 .disc.got { border-color: color-mix(in srgb, var(--ok) 50%, transparent); background: var(--ok-bg); } /* a discovery the student has found: green border and background */
      .sec-1-8 .disc.got .lk { background: var(--ok); color: var(--panel); } /* a found discovery's badge turns solid green */
      .sec-1-8 .log .c-ok { color: var(--ok); } .sec-1-8 .log .c-bad { color: var(--bad); } /* green and red text inside the event log */
      /* step 4: sorter */
      .sec-1-8 .story { border-left: 5px solid var(--chc); min-height: 150px; } /* step 4's story card: a chapter-coloured bar on its left and a fixed minimum height so the page does not jump */
      .sec-1-8 .story-t { font-size: 18px; line-height: 1.5; } /* the story text: large and easy to read */
      .sec-1-8 .bk { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 9px 14px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; color: var(--ink); font: inherit; } /* step 4's answer buttons (the bins to sort into): a bold title over a short hint, in a rounded box */
      .sec-1-8 .bk:hover:not(:disabled) { border-color: var(--chc); } /* on hover, an answer button that is still active takes the chapter colour */
      .sec-1-8 .bk b { font-size: 16.5px; } /* the answer's bold title size */
      .sec-1-8 .bk span { font-size: 14px; color: var(--muted); } /* the answer's small muted hint text */
      .sec-1-8 .bk:disabled { cursor: default; opacity: .55; } /* used-up answer buttons are faded and no longer show a pointer */
      .sec-1-8 .bk.wrong { border-color: var(--bad); background: var(--bad-bg); } /* a wrong answer turns red */
      .sec-1-8 .bk.right { border-color: var(--ok); background: var(--ok-bg); opacity: 1; } /* the right answer turns green and stays fully visible */
      .sec-1-8 .bin { border: 1.5px dashed var(--line-2); border-radius: 10px; padding: 7px 10px; min-height: 80px; background: var(--panel-2); } /* a bin that collects sorted stories: dashed border and a minimum height */
      .sec-1-8 .bin .bn { font-weight: 800; font-size: 15px; } /* the bin's bold name */
      .sec-1-8 .bin .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; } /* the chips inside a bin wrap onto new lines with small gaps */
      /* step 5: machine builder */
      .sec-1-8 .s-cpuin { fill: var(--panel); stroke: var(--cpu); } /* step 5's drawing: the inner boxes of a processor are plain with a processor-coloured outline */
      .sec-1-8 .s-bus { fill: var(--panel-3); stroke: var(--ink-2); } /* step 5's drawing: the bus as a grey bar with a dark outline */
      .sec-1-8 .chipb { fill: none; stroke: var(--ink-2); stroke-dasharray: 7 5; } /* step 5's drawing: the dashed outline that shows where a chip's edge is */
      .sec-1-8 .mach .hot { transition: opacity .2s; } /* clickable parts of the machine drawing fade smoothly */
      .sec-1-8 .mach.picked .hot:not(.sel) { opacity: .4; } /* once a part is picked, every other clickable part fades so the chosen one stands out */
      .sec-1-8 .mach .hot.sel .fr { stroke-width: 3.5; } /* the picked part's frame is drawn thicker */
      /* step 6: coherence */
      .sec-1-8 .ping { stroke-width: 4.5 !important; transition: stroke-width .15s; } /* step 6: a thick outline that flashes on a cache when it is involved in the current event */
      /* step 7: power wall */
      .sec-1-8 .meterrow { display: grid; grid-template-columns: 84px minmax(0, 1fr) 150px; gap: 10px; align-items: center; } /* step 7's meter rows: a label, a meter and a value in three columns */
      .sec-1-8 .meterrow .meter { height: 14px; } /* step 7's meters are a little taller than normal */
      .sec-1-8 .meterrow .meter > i { background: var(--cpu); } /* step 7's meters fill in the processor colour */
      .sec-1-8 .meter.lim { position: relative; } /* a meter with a limit line needs relative positioning so the line can be placed inside it */
      .sec-1-8 tr.pick { cursor: pointer; } /* table rows the student can click to pick a year show a pointer */
      .sec-1-8 tr.pick:hover td { background: var(--panel-2); } /* a clickable row is shaded while the mouse is over it */
      .sec-1-8 .meter.lim::after { content: ''; position: absolute; left: 50%; top: -3px; bottom: -3px; width: 3px; background: var(--bad); border-radius: 2px; } /* the limit line: a thin red bar at the middle of the meter that marks the power limit */
      /* phones: kept LAST so these overrides beat the base rules above on source order */
      @media (max-width: 760px) { /* phone-width screens (760 pixels or less) get these adjustments */
        .sec-1-8 table.tbl th, .sec-1-8 table.tbl td { font-size: 12.5px; padding: 4px 5px; letter-spacing: 0; } /* tables use smaller text and tighter cells so they fit on a phone */
        .sec-1-8 table.tbl th { text-transform: none; } /* table headings are not forced to capitals, which would make them wider */
        .sec-1-8 .step-eyebrow { white-space: normal; } /* the step header may wrap onto more lines */
        .sec-1-8 .sock { grid-template-columns: 60px minmax(0, 1fr); gap: 6px 10px; } /* socket rows drop to two columns: name and status */
        .sec-1-8 .sock .btn { grid-column: 2; } /* the socket's button moves under the status, in the second column */
        .sec-1-8 .meterrow { grid-template-columns: 70px minmax(0, 1fr) 118px; } /* step 7's meter rows use slimmer label and value columns */
      } /* end of the phone-width adjustments */
    `,  // end of the section's styles
    steps: [  // the steps of this section, in the order the student sees them
      /* ---------------------------------------------------------------- 1. Big picture */
      {  // step 1: the big picture, three ways to build a machine with more than one processor
        title: 'More than one processor: three ways to build it',  // step 1 title
        kind: 'story',  // step kind "story": a narrative step
        render(el, ctx) {  // render(el, ctx): builds step 1 when it opens
          const { h, s } = ctx;  // h builds ordinary page elements and s builds SVG shapes
          const pic = {  // pic: a small picture-drawing function for each design
            smp: () => s('svg', { viewBox: '0 0 200 108', width: '100%' },  // SMP picture: a 200 by 108 drawing
              ...[0, 1, 2].map((i) => s('g', {},  // three processors, P1 to P3
                s('rect', { x: 18 + i * 60, y: 6, width: 44, height: 30, rx: 5, class: 's-cpu', 'stroke-width': 2 }),  // a processor box
                s('text', { x: 40 + i * 60, y: 26, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, 'P' + (i + 1)),  // the processor's label, P1, P2 or P3
                s('line', { x1: 40 + i * 60, y1: 36, x2: 40 + i * 60, y2: 52, class: 's-line' }))),  // a short line from the processor down to the bus
              s('line', { x1: 8, y1: 52, x2: 192, y2: 52, class: 's-line', 'stroke-width': 4 }),  // the shared bus: one thick horizontal line
              s('line', { x1: 65, y1: 52, x2: 65, y2: 66, class: 's-line' }), s('line', { x1: 152, y1: 52, x2: 152, y2: 66, class: 's-line' }),  // two short lines from the bus down to memory and to I/O
              s('rect', { x: 18, y: 66, width: 94, height: 34, rx: 6, class: 's-mem', 'stroke-width': 2 }),  // the shared memory box, in the memory colour
              s('text', { x: 65, y: 88, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Memory'),  // the "Memory" label
              s('rect', { x: 124, y: 66, width: 58, height: 34, rx: 6, class: 's-io', 'stroke-width': 2 }),  // the shared I/O box, in the I/O colour
              s('text', { x: 153, y: 88, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'I/O')),  // the "I/O" label, which ends the SMP picture
            multi: () => s('svg', { viewBox: '0 0 200 108', width: '100%' },  // multicore picture: a 200 by 108 drawing
              s('rect', { x: 8, y: 3, width: 184, height: 64, rx: 9, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }),  // a dashed outline that shows the edge of the single chip
              ...[0, 1, 2, 3].map((i) => s('g', {},  // four cores, C1 to C4, side by side on the chip
                s('rect', { x: 16 + i * 43, y: 9, width: 38, height: 27, rx: 5, class: 's-cpu', 'stroke-width': 2 }),  // a core box
                s('text', { x: 35 + i * 43, y: 27, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, 'C' + (i + 1)))),  // the core's label, C1 to C4
              s('rect', { x: 16, y: 41, width: 167, height: 20, rx: 5, class: 's-cache', 'stroke-width': 1.5 }),  // one shared cache bar under all four cores, still inside the chip
              s('text', { x: 100, y: 56, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-acc' }, 'shared cache'),  // the "shared cache" label in the accent colour
              s('line', { x1: 100, y1: 67, x2: 100, y2: 76, class: 's-line' }),  // a short line from the chip down to memory
              s('rect', { x: 45, y: 76, width: 110, height: 28, rx: 6, class: 's-mem', 'stroke-width': 2 }),  // the memory box outside the chip
              s('text', { x: 100, y: 95, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Memory')),  // the "Memory" label, which ends the multicore picture
            cluster: () => s('svg', { viewBox: '0 0 200 108', width: '100%' },  // cluster picture: a 200 by 108 drawing
              ...[0, 1, 2].map((i) => s('g', {},  // three complete computers side by side
                s('rect', { x: 10 + i * 64, y: 4, width: 52, height: 62, rx: 7, class: 's-panel', 'stroke-width': 2 }),  // each computer's outer box
                s('rect', { x: 16 + i * 64, y: 10, width: 40, height: 20, rx: 4, class: 's-cpu', 'stroke-width': 1.5 }),  // its own processor
                s('text', { x: 36 + i * 64, y: 25, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, 'P'),  // the "P" label for that processor
                s('rect', { x: 16 + i * 64, y: 38, width: 40, height: 20, rx: 4, class: 's-mem', 'stroke-width': 1.5 }),  // its own memory
                s('text', { x: 36 + i * 64, y: 53, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, 'M'),  // the "M" label for that memory
                s('line', { x1: 36 + i * 64, y1: 66, x2: 36 + i * 64, y2: 84, stroke: 'var(--io)', 'stroke-width': 2 }))),  // a line from the computer down to the network
              s('line', { x1: 20, y1: 84, x2: 180, y2: 84, stroke: 'var(--io)', 'stroke-width': 3, 'stroke-dasharray': '6 4' }),  // the network: a dashed line in the I/O colour joining the three computers
              s('text', { x: 100, y: 102, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-io' }, 'network')),  // the "network" label, which ends the cluster picture
          };  // closes the pic table
          const ROUTES = [  // ROUTES: the three designs with their name, glossary term, a status tag, a description and where it is found
            { id: 'smp', name: 'Symmetric multiprocessor', term: 'Symmetric multiprocessor', tag: 'taught in this section', tagc: 'ok',  // SMP: taught in this section
              what: 'Two or more separate processors, each usually on its own chip in its own socket, share <b>one main memory</b> and <b>one set of I/O devices</b>. A single operating system runs the whole machine and may hand any job to any processor.',  // SMP description: separate processors sharing one memory and one set of I/O devices, run by one operating system
              where: 'Servers and powerful workstations.' },  // SMP: where it is found
            { id: 'multi', name: 'Multicore computer', term: 'Multicore computer', tag: 'taught in this section', tagc: 'ok',  // multicore: taught in this section
              what: 'Two or more complete processors, called <b>cores</b>, are built together on <b>one chip</b> (one slab of silicon, the <span class="t">die</span>). The OS sees every core as a processor, so a multicore chip is organized much like a tiny SMP. The two ideas combine: a server with two 8-core chips is an SMP with 16 cores.',  // multicore description: cores on one die, seen by the OS as processors, and how it combines with SMP
              where: 'Nearly every laptop, desktop and phone sold today.' },  // multicore: where it is found
            { id: 'cluster', name: 'Cluster', term: 'Cluster', tag: 'only mentioned here', tagc: 'warn',  // cluster: only mentioned in this section
              what: 'Several <b>complete computers</b>, each with its own processors, memory and copy of the OS, are linked by a fast network and cooperate on big jobs. They share <b>no</b> memory: they exchange data by sending messages over the network.',  // cluster description: complete computers linked by a network, sharing no memory and exchanging messages
              where: 'Search engines, cloud data centres, supercomputers.' },  // cluster: where it is found
          ];  // closes the ROUTES list
          const info = h('div', { class: 'card tight', style: { minHeight: '128px' } });  // info is the card under the pictures that describes the chosen design; its minimum height keeps the page steady
          const rows = {};  // rows will hold the comparison table's row for each design, so the chosen one can be highlighted
          const tbl = h('table', { class: 'tbl compact' },  // tbl: a compact comparison table of the three designs
            h('tr', {}, h('th', {}, 'Design'), h('th', {}, 'Processors live …'), h('th', {}, 'Share main memory?'), h('th', {}, 'Operating system')),  // table header: design, where processors live, whether they share memory, and the operating system
            rows.smp = h('tr', {}, h('td', { class: 'b' }, 'SMP'), h('td', {}, 'on separate chips'), h('td', { html: '<span class="c-ok b">Yes</span>, one memory' }), h('td', {}, 'one OS for all')),  // table row for SMP: separate chips, one shared memory, one OS
            rows.multi = h('tr', {}, h('td', { class: 'b' }, 'Multicore'), h('td', {}, 'as cores on one chip'), h('td', { html: '<span class="c-ok b">Yes</span>, one memory' }), h('td', {}, 'one OS for all')),  // table row for multicore: cores on one chip, one shared memory, one OS
            rows.cluster = h('tr', {}, h('td', { class: 'b' }, 'Cluster'), h('td', {}, 'in separate computers'), h('td', { html: '<span class="c-bad b">No</span>, each has its own' }), h('td', {}, 'one copy per computer')));  // table row for cluster: separate computers, no shared memory, one OS copy per computer
          const btns = {};  // btns will hold the three picture buttons, keyed by design
          function pick(id) {  // pick(id): runs when a picture is clicked; highlights that design everywhere and describes it
            const r = ROUTES.find((x) => x.id === id);  // r is the chosen design's entry in ROUTES
            Object.entries(btns).forEach(([k, b]) => b.classList.toggle('on', k === id));  // marks the chosen picture button as on and the others as off
            Object.entries(rows).forEach(([k, tr]) => tr.classList.toggle('on', k === id));  // highlights the chosen design's table row
            info.innerHTML = `<div class="row" style="gap:8px;margin-bottom:4px"><span class="b t" data-t="${r.term}">${r.name}</span><span class="chip ${r.tagc}">${r.tag}</span></div>` +  // the info card's first line: the design's name (linked to the glossary) and its status tag
              `<div class="small">${r.what}</div><div class="small muted" style="margin-top:4px"><b>Where you meet it:</b> ${r.where}</div>`;  // then its description and where you meet it
          }  // ends pick()
          const btnRow = h('div', { class: 'grid-3' }, ...ROUTES.map((r) => (btns[r.id] = h('button', { type: 'button', class: 'route', onclick: () => pick(r.id), 'aria-label': r.name },  // btnRow: three picture buttons in a row, each calling pick() when clicked
            pic[r.id](), h('span', { class: 'rname' }, r.name)))));  // inside each button: its picture and its name
          info.innerHTML = '<div class="b">Click a picture to meet each design.</div><div class="small muted">All three put several processors to work at once. They differ in <b>where</b> the processors sit and <b>what</b> they share.</div>';  // the info card's starting text, before anything is clicked

          el.append(h('div', { class: 'split l fill' },  // page layout: two columns
            h('div', { class: 'stack' },  // left column: a vertical stack of text
              h('p', { class: 'lead m0', html: 'A single processor follows one stream of instructions, one step after another. To get more done at the same moment, designers give a computer several processors that work side by side. This is <span class="t">parallel processing</span>.' }),  // opening paragraph: one processor follows one instruction stream, so designers add processors; this is parallel processing
              h('p', { class: 'm0', html: 'A computer with just one processor is a <span class="t">uniprocessor</span>. There are three common ways to go beyond one, and this section explores the first two in depth.' }),  // paragraph: a one-processor computer is a uniprocessor, and there are three ways to go beyond one
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'One cook in one kitchen is a uniprocessor. Several cooks sharing one kitchen and one pantry is a symmetric multiprocessor (SMP). The same cooks squeezed onto one extra-large workstation, sharing a spice rack at arm’s reach, is a multicore chip. Separate restaurants splitting a giant catering order by phone form a cluster.' }),  // analogy callout: cooks sharing a kitchen, cooks on one big workstation, and restaurants splitting an order
              h('div', { class: 'callout why m0', 'data-label': 'Why an OS course cares', html: 'Hardware only supplies the processors. The operating system decides which program runs on which processor, and keeps them from tripping over each other.' })),  // why callout: the operating system decides which program runs on which processor
            h('div', { class: 'stack' }, btnRow, info, tbl,  // right column: the picture buttons, the info card and the table
              h('div', { class: 'row small', style: { gap: '6px' } }, h('span', { class: 'b', style: { marginRight: '2px' } }, 'Coming up:'),  // a row of chips previewing what comes later in the section
                ...['the 5 marks of an SMP', 'fail a processor', 'build the machines', 'caches that disagree', 'why chips went multicore'].map((t) => h('span', { class: 'chip accent' }, t))))));  // the five preview topics, each shown as a small accent chip
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------------------------------------------------------- 2. SMP characteristics */
      {  // step 2: the five characteristics that define an SMP
        title: 'What makes a multiprocessor “symmetric”',  // step 2 title
        kind: 'learn',  // step kind "learn"
        render(el, ctx) {  // render(el, ctx): builds step 2 when it opens
          const { h, s } = ctx;  // h builds page elements and s builds SVG shapes
          const FEATS = [  // FEATS: the five features; each has a short label, the drawing parts to highlight, optional labels, and a full explanation
            { short: 'Two or more <b>similar processors</b> of comparable capability', hi: ['procs'],  // feature 1: two or more similar processors of comparable capability; highlights the processors
              sub: () => 'same kind, same speed',  // the label shown inside each processor for feature 1
              text: 'An SMP has <b>two or more processors of the same kind and comparable capability</b>: the same instruction set and roughly the same speed. Because they are alike, the OS can treat them as interchangeable.' },  // feature 1 explanation: same instruction set and speed, so the OS can treat them as interchangeable
            { short: 'They <b>share main memory</b> and I/O facilities over one interconnection, so memory access time is about equal', hi: ['mem', 'bus', 'links', 'procs'], pill: '≈ same wait',  // feature 2: shared memory and I/O over one interconnection, with about equal access time; shows a "same wait" tag on each link
              text: 'All processors reach <b>one shared main memory</b> and the same I/O facilities through a shared bus or another interconnection scheme. No processor sits closer to memory than the others, so a memory access takes <b>about the same time</b> whichever processor makes it.' },  // feature 2 explanation: no processor sits closer to memory, so an access takes about the same time from any of them
            { short: 'They <b>share access to the I/O devices</b>', hi: ['io', 'bus', 'links', 'procs'], pill: 'I/O ✓',  // feature 3: shared access to the I/O devices; shows an I/O tag on each link
              text: 'The processors <b>share the I/O devices</b>. Any of them can start a disk transfer or talk to the network card, either over the same paths or over separate paths that lead to the same device.' },  // feature 3 explanation: any processor can start a disk transfer or use the network card
            { short: 'All processors can <b>perform the same functions</b>', hi: ['procs'],  // feature 4: all processors can perform the same functions; highlights the processors
              sub: (i) => ['running app A', 'running the kernel', 'handling an interrupt', 'running app B'][i],  // the different job shown in each processor for feature 4
              text: 'Every processor can <b>perform the same functions</b>: run user programs, run operating-system code, handle interrupts. None is the boss and none is a helper. This equality is exactly what <b>symmetric</b> means.' },  // feature 4 explanation: every processor can do any job, and this equality is what "symmetric" means
            { short: 'One <b>integrated OS</b> controls them all', hi: ['os', 'procs'],  // feature 5: one integrated OS controls them all; highlights the OS bar and the processors
              os: 'One integrated OS  ·  coordinates jobs · tasks · files · data elements',  // the text shown in the OS bar for feature 5
              text: 'A single <b>integrated operating system</b> controls every processor and its programs. It makes them cooperate at every size of work: whole <b>jobs</b>, the <b>tasks</b> inside a job, shared <b>files</b>, down to single shared <b>data elements</b> in memory.' },  // feature 5 explanation: one OS makes them cooperate on jobs, tasks, files and single data elements
          ];  // closes the FEATS list
          const svg = s('svg', { viewBox: '0 0 640 300', width: '100%' });  // svg is the 640 by 300 drawing of the SMP
          const G = { os: s('g'), procs: s('g'), links: s('g'), bus: s('g'), mem: s('g'), io: s('g') };  // G holds one group per kind of part, so a whole kind can be highlighted or faded at once
          const overlay = s('g');  // overlay is a group on top of the drawing for the extra tags of features 2 and 3
          const osText = s('text', { x: 320, y: 27, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 'tx-os' });  // osText is the text inside the operating-system bar, filled in for feature 5
          G.os.append(s('rect', { x: 8, y: 4, width: 624, height: 36, rx: 10, class: 's-os', 'stroke-width': 2 }), osText);  // the operating-system bar across the top of the drawing, with its text
          const subs = [];  // subs will hold the small label inside each processor
          for (let i = 0; i < 4; i++) {  // draws four processors
            const x = 16 + i * 156;  // x is this processor's left edge
            subs[i] = s('text', { x: x + 70, y: 106, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' });  // the processor's small label line, empty until a feature fills it
            G.procs.append(s('rect', { x, y: 54, width: 140, height: 72, rx: 10, class: 's-cpu', 'stroke-width': 2 }),  // the processor box
              s('text', { x: x + 70, y: 82, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Processor ' + (i + 1)), subs[i]);  // the processor's name and its small label line
            G.links.append(s('rect', { x: x + 20, y: 134, width: 100, height: 24, rx: 6, class: 's-cache', 'stroke-width': 1.5 }),  // under each processor, its private cache box, which counts among the "links" parts
              s('text', { x: x + 70, y: 151, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-acc' }, 'private cache'),  // the "private cache" label inside that box
              s('line', { x1: x + 70, y1: 126, x2: x + 70, y2: 134, class: 's-line' }),  // a short line from the processor down to its cache
              s('line', { x1: x + 70, y1: 158, x2: x + 70, y2: 186, class: 's-line' }));  // a line from the cache down to the shared bus
          }  // ends the loop over processors
          G.bus.append(s('line', { x1: 8, y1: 189, x2: 632, y2: 189, class: 's-line', 'stroke-width': 6 }),  // the shared bus: one thick line across the drawing
            s('line', { x1: 162, y1: 189, x2: 162, y2: 226, class: 's-line' }), s('line', { x1: 482, y1: 189, x2: 482, y2: 226, class: 's-line' }),  // two short lines from the bus down to memory and to the I/O devices
            s('text', { x: 320, y: 214, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'shared bus (interconnect)'));  // the "shared bus (interconnect)" label under the bus
          const memSub = s('text', { x: 162, y: 276, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' });  // memSub is the small line inside the memory box, changed for feature 2
          G.mem.append(s('rect', { x: 8, y: 226, width: 308, height: 68, rx: 10, class: 's-mem', 'stroke-width': 2 }),  // the shared main memory box on the lower left
            s('text', { x: 162, y: 252, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Main memory (shared)'), memSub);  // its heading and its small line
          G.io.append(s('rect', { x: 332, y: 226, width: 300, height: 68, rx: 10, class: 's-io', 'stroke-width': 2 }),  // the shared I/O box on the lower right
            s('text', { x: 482, y: 247, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'I/O devices (shared)'),  // its heading
            ...['Disk', 'Network', 'Display'].map((d, k) => s('g', {},  // three device boxes inside it: disk, network and display
              s('rect', { x: 346 + k * 94, y: 258, width: 84, height: 26, rx: 6, fill: 'var(--panel)', stroke: 'var(--io)', 'stroke-width': 1.5 }),  // each device box
              s('text', { x: 388 + k * 94, y: 276, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, d))));  // each device name, which ends the I/O group
          svg.append(G.os, G.links, G.bus, G.mem, G.io, G.procs, overlay);  // adds the groups to the drawing in layer order, processors and the overlay last so they sit on top

          const info = h('div', { class: 'card tight', style: { minHeight: '100px' } });  // info is the explanation card under the drawing
          const seenChip = h('span', { class: 'chip' });  // seenChip is the small "seen n / 5" counter shown in the explanation card
          const seen = new Set();  // seen remembers which features the student has already opened
          const rowsEl = FEATS.map((f, i) => h('button', { type: 'button', class: 'feat', onclick: () => pick(i) },  // rowsEl: one button per feature, which calls pick() when clicked
            h('span', { class: 'n' }, String(i + 1)), h('span', { html: f.short })));  // each button shows its number badge and its short label
          function paint(k) {  // paint(k): updates the drawing for feature k, or shows everything plainly when k is null
            const f = k == null ? null : FEATS[k];  // f is the chosen feature, or null
            Object.entries(G).forEach(([name, g]) => g.classList.toggle('dim', !!f && !f.hi.includes(name)));  // fades every group of parts that this feature does not talk about
            osText.textContent = (f && f.os) || 'One integrated operating system';  // the OS bar text: the feature's own text, or a plain title
            subs.forEach((t, i) => (t.textContent = f && f.sub ? f.sub(i) : 'registers · ALU'));  // each processor's small line: the feature's label for it, or "registers · ALU"
            memSub.textContent = k === 1 ? 'every processor reaches it the same way' : 'one copy of every program and its data';  // the memory box's small line: equal access for feature 2, otherwise what memory holds
            overlay.replaceChildren();  // removes any tags left over from the previous feature
            if (f && f.pill) for (let i = 0; i < 4; i++) {  // for features 2 and 3, a tag goes on each processor's link to the bus
              const cx = 16 + i * 156 + 70;  // cx is the centre of processor i
              overlay.append(s('rect', { x: cx - 44, y: 162, width: 88, height: 20, rx: 10, class: k === 1 ? 's-mem' : 's-io', 'stroke-width': 1.5 }),  // a rounded tag in memory colours for feature 2 or I/O colours for feature 3
                s('text', { x: cx, y: 176.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, f.pill));  // the tag's text, "same wait" or "I/O"
            }  // ends the tag loop
          }  // ends paint()
          function pick(i) {  // pick(i): runs when the student clicks feature i
            seen.add(i);  // remembers that this feature has been seen
            rowsEl.forEach((r, j) => { r.classList.toggle('on', i === j); r.classList.toggle('seen', seen.has(j)); });  // marks the chosen button as open and every seen button with a green badge
            paint(i);  // updates the drawing for this feature
            seenChip.className = 'chip ' + (seen.size === 5 ? 'ok' : '');  // the counter turns green once all five have been seen
            seenChip.textContent = seen.size === 5 ? '✓ all five seen' : `seen ${seen.size} / 5`;  // the counter's text: "seen n / 5" or "all five seen"
            info.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '2px' } }, h('span', { class: 'b' }, `Mark ${i + 1} of 5`), seenChip),  // the explanation card: "Mark i of 5" with the counter on the right
              h('div', { style: { fontSize: '15.5px', lineHeight: '1.45' }, html: FEATS[i].text }));  // followed by the feature's full explanation
          }  // ends pick()
          paint(null);  // draws the plain starting picture
          info.innerHTML = '<div class="b">Click each mark on the left.</div><div class="small muted">The diagram lights up the part of the machine that the mark is about, and this box explains it.</div>';  // the explanation card's starting text, before anything is clicked

          el.append(h('div', { class: 'split l fill' },  // page layout: two columns
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: intro, the five feature buttons and a warning
              h('p', { class: 'm0', html: 'A <span class="t">symmetric multiprocessor</span> (SMP) is one computer with <b>five marks</b>. Click each one:' }),  // intro paragraph: an SMP is one computer with five marks
              ...rowsEl,  // the five feature buttons
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '“Symmetric” does not mean the processors run the same program in lockstep. Each runs its own work. It means <b>no processor is special</b>: any of them can do any job.' })),  // common-mistake callout: symmetric means no processor is special, not that they run the same program in lockstep
            h('div', { class: 'stack' }, h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), info,  // right column: the drawing in a white card, then the explanation card
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'Identical checkout clerks (processors) share one stockroom (memory). Any clerk can serve any customer, and one manager (the OS) sends each customer to a free clerk.' }))));  // analogy callout: identical checkout clerks sharing one stockroom, with one manager sending customers to free clerks
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------------------------------------------------------- 3. Advantages lab */
      {  // step 3: a lab where the student discovers the four advantages of an SMP
        title: 'Lab: four payoffs of having several processors',  // step 3 title
        kind: 'lab',  // step kind "lab"
        core: true,  // core: true keeps this step on the shorter core route
        render(el, ctx) {  // render(el, ctx): builds the lab when the step opens
          const { h } = ctx;  // h builds page elements
          const NJOBS = 12, WORK = 4, SOCKETS = 4, TICK = 170;  // 12 jobs of 4 ticks of work each, 4 processor sockets, and 170 milliseconds per simulated tick
          let model = 1, procs, queue, done, t, running, failedEver, wasDown, maxWorking, finished, down, redone;  // lab state: product model, processors, job queue, jobs done, time, running flag, and flags used to spot the discoveries
          const found = {};  // found remembers which of the four advantages the student has discovered
          /* ---- discovery cards (right) */
          const DISC = {  // DISC: the four advantages, each with its name and a hint on how to discover it
            perf: { name: 'Performance', hint: 'Finish all 12 jobs with two or more processors.' },  // performance: finish all 12 jobs with two or more processors
            avail: { name: 'Availability', hint: 'On a machine with spare processors, fail one and let the run finish.' },  // availability: fail one processor on a machine with spares and let the run finish
            grow: { name: 'Incremental growth', hint: 'Install a processor in an empty socket (a free processor slot on the motherboard).' },  // incremental growth: install a processor in an empty socket
            scale: { name: 'Scaling', hint: 'Pick a different model from the product line.' },  // scaling: pick a different model from the product line
          };  // closes the DISC table
          const discEl = {};  // discEl will hold each advantage's card
          const nm = (k) => (k === 'perf' ? DISC[k].name : `<span class="t">${DISC[k].name}</span>`);   // glossary link for the three defined terms
          const foundChip = h('span', { class: 'chip' }, 'found 0 / 4');  // foundChip is the "found n / 4" counter above the cards
          Object.entries(DISC).forEach(([k, d]) => {  // builds one card per advantage
            discEl[k] = h('div', { class: 'disc' });  // the card starts in its locked style
            discEl[k].innerHTML = `<div class="dh"><span class="lk">?</span>${nm(k)}</div><div class="dt"><b>To discover:</b> ${d.hint}</div>`;  // a locked card shows a question mark, the name and the hint for discovering it
          });  // ends the card builder
          function unlock(k, text) {  // unlock(k, text): marks advantage k as discovered and shows what it means
            if (found[k]) return;  // does nothing if it was already found
            found[k] = true;  // remembers it as found
            discEl[k].className = 'disc got fade-in';  // switches the card to its found style, with a fade-in
            discEl[k].innerHTML = `<div class="dh"><span class="lk">✓</span>${nm(k)}</div><div class="dt">${text}</div>`;  // the found card shows a tick, the name and the explanation text
            const n = Object.keys(found).length;  // n is how many advantages have been found so far
            foundChip.className = 'chip ' + (n === 4 ? 'ok' : 'accent');  // the counter turns green once all four are found
            foundChip.textContent = n === 4 ? '✓ all four found' : `found ${n} / 4`;  // the counter's text: "found n / 4" or "all four found"
          }  // ends unlock()
          /* ---- simulator (left) */
          const logEl = h('div', { class: 'log', style: { height: '112px' } });  // logEl is the scrolling event log, 112 pixels tall
          function log(msg, cls) { logEl.append(h('div', { class: cls || '', html: msg })); while (logEl.children.length > 40) logEl.firstChild.remove(); logEl.scrollTop = logEl.scrollHeight; }  // log(msg, cls): adds a line to the log, keeps only the last 40 lines, and scrolls to the newest
          const queueEl = h('div', { class: 'jq' });  // queueEl shows the jobs still waiting to run
          const clock = h('span', { class: 'chip mono' });  // clock shows the simulated time
          const doneChip = h('span', { class: 'chip ok mono' });  // doneChip shows how many jobs are finished
          const status = h('div', { class: 'card tight small', style: { minHeight: '46px' } });  // status is a small card that says what the machine is doing
          const runBtn = h('button', { type: 'button', class: 'btn sm primary', onclick: () => toggleRun() });  // runBtn starts or pauses the simulation
          const socks = [];  // socks will hold the parts of each processor socket row
          for (let i = 0; i < SOCKETS; i++) {  // builds one row per socket
            const lab = h('div', { class: 'lab' });  // lab is the processor's name tag
            const st = h('div', { class: 'st' });  // st is the status text above the socket's meter
            const bar = h('i', { style: { width: '0%' } });  // bar is the coloured fill inside the meter, starting empty
            const btn = h('button', { type: 'button', class: 'btn sm', onclick: () => sockAction(i) });  // btn is the socket's button (add, or fail, a processor); it calls sockAction() for this socket
            const row = h('div', { class: 'sock' }, lab, h('div', {}, st, h('div', { class: 'meter' }, bar)), btn);  // the socket row: name tag, status and meter in the middle, button on the right
            socks.push({ row, lab, st, bar, btn });  // keeps the row's parts so paint() can update them
          }  // ends the loop over sockets
          const working = () => procs.filter((p) => p.inst && !p.failed);  // working(): the processors that are installed and have not failed
          function reset() {  // reset(): starts the lab over for the current model
            procs = Array.from({ length: SOCKETS }, (_, i) => ({ inst: i < model, failed: false, job: null, left: 0 }));  // the processors: the first "model" sockets hold a working processor, the rest are empty
            queue = Array.from({ length: NJOBS }, (_, i) => i + 1);  // the queue of waiting jobs, numbered 1 to 12
            done = 0; t = 0; running = false; failedEver = false; wasDown = false; finished = false; down = false; maxWorking = 0; redone = 0;  // clears the job count, the clock and all the flags used to detect discoveries
            logEl.replaceChildren();  // empties the log
            log(`Model with ${model} processor${model > 1 ? 's' : ''}: 12 jobs of 4 s each are waiting.`);  // first log line: how many processors this model has and that 12 jobs of 4 seconds are waiting
            paint();  // draws the fresh state
          }  // ends reset()
          function toggleRun() {  // toggleRun(): runs when Run, Pause, Resume or Run again is pressed
            if (finished || down) reset();  // after a finished run or a crashed machine, pressing the button starts over first
            running = !running;  // switches between running and paused
            paint();  // redraws so the button label and status update
          }  // ends toggleRun()
          function sockAction(i) {  // sockAction(i): runs when socket i's button is pressed
            const p = procs[i];  // p is the processor in that socket
            if (!p.inst) {                     // empty socket → install a processor
              p.inst = true; p.failed = false; down = false;  // installs a working processor; the machine is no longer down
              log(`t=${t}s  New processor installed in socket ${i + 1}. The OS starts using it at once.`, 'c-ok');  // logs the installation; the OS starts using the processor at once
              unlock('grow', 'You <b>added a processor</b> to the machine you already had, instead of buying a whole new computer.');  // unlocks "incremental growth": a processor was added to the existing machine
            } else if (!p.failed) {            // working processor → fail it
              p.failed = true; failedEver = true;  // marks the processor failed and remembers that a failure happened
              if (p.job != null) {   // the half-done job is lost and must start again from the beginning
                const lost = WORK - p.left; redone += lost;  // lost is the work already done on the job, which must be redone; it is added to the redone total
                queue.unshift(p.job); log(`t=${t}s  P${i + 1} FAILS. The OS puts J${p.job} back at the front of the queue${lost ? ` (${lost} s of its work must be redone)` : ''}.`, 'c-bad'); p.job = null; p.left = 0; }  // puts the job back at the front of the queue and logs the failure and the lost work; the processor now holds no job
              else log(`t=${t}s  P${i + 1} FAILS.`, 'c-bad');  // if the processor was idle, only the failure is logged
              if (!working().length) { down = true; wasDown = true; running = false; log('No working processor is left: the whole system is down.', 'c-bad'); }  // with no working processor left, the whole machine is down: the run stops and the log says so
            }  // ends the add / fail choice
            paint();  // redraws the sockets and status
          }  // ends sockAction()
          function tick() {  // tick(): one simulated second, called every 170 milliseconds while the step is open
            if (!running) return;  // does nothing while paused
            // 1. the OS scheduler hands the next waiting job to every free, working processor
            procs.forEach((p, i) => { if (p.inst && !p.failed && p.job == null && queue.length) { p.job = queue.shift(); p.left = WORK; log(`t=${t}s  OS: J${p.job} → P${i + 1}`); } });  // gives the next waiting job to every free working processor, 4 seconds of work each, and logs each hand-out
            maxWorking = Math.max(maxWorking, working().length);  // remembers the most processors that were ever working at once
            // 2. one second of simulated time passes; every busy processor does one second of work
            t++;  // the clock moves on one second
            procs.forEach((p) => { if (p.job != null) { p.left--; if (p.left === 0) { done++; p.job = null; } } });  // every busy processor does one second of work; a job that reaches zero counts as done and frees its processor
            if (!queue.length && procs.every((p) => p.job == null)) finish();  // when no job is waiting and none is running, the run is over
            paint();  // redraws after the tick
          }  // ends tick()
          function finish() {  // finish(): wraps up a completed run and checks for discoveries
            finished = true; running = false;  // marks the run finished and stops the clock
            log(`t=${t}s  All 12 jobs are done.`, 'c-ok');  // logs that all 12 jobs are done
            if (maxWorking >= 2) unlock('perf', `Jobs ran <b>at the same moment</b>: 12 jobs in <b>${t} s</b> with up to ${maxWorking} processors, versus 48 s on one.`);  // with two or more processors working, unlocks "performance": jobs ran at the same moment, faster than 48 s on one
            // availability means the machine stayed up through the failure; a run that went down and was repaired does not count
            if (failedEver && !wasDown) unlock('avail', 'A processor died, yet every job finished on the survivors. A uniprocessor would have stopped dead.');  // if a processor failed but the machine never went down, unlocks "availability"
            else if (failedEver) log('The machine went down before the new processor arrived, so it did not stay available. Try failing just one of several processors.');  // if the machine went down during the run, explains why that does not count as staying available
          }  // ends finish()
          function paint() {  // paint(): redraws every socket, the queue, the clock and the status card
            procs.forEach((p, i) => {  // for each socket
              const k = socks[i];  // k is that socket's row parts
              k.row.className = 'sock' + (!p.inst ? ' empty' : p.failed ? ' failed' : '');  // the row style: empty, failed, or normal
              k.lab.textContent = p.inst ? 'P' + (i + 1) : 'socket ' + (i + 1);  // the name tag: P1 to P4 when installed, "socket n" when empty
              k.st.innerHTML = !p.inst ? '<span class="muted">empty socket</span>' : p.failed ? '<span class="c-intr">FAILED: out of service</span>'  // status text: empty socket, or failed and out of service
                : p.job != null ? `running <b>J${p.job}</b> <span class="muted">(${WORK - p.left} of ${WORK} s)</span>` : '<span class="muted">idle</span>';  // or the job it is running with its progress, or idle
              k.bar.style.width = p.job != null ? ((WORK - p.left) / WORK) * 100 + '%' : '0%';  // the meter shows how much of the current job is done
              k.btn.className = 'btn sm ' + (!p.inst ? 'mem' : 'intr');  // the button's colour: memory colour to add, interrupt colour to fail
              k.btn.textContent = !p.inst ? '+ Add processor' : p.failed ? 'Failed' : '✗ Fail it';  // the button's label: add a processor, failed, or fail it
              k.btn.disabled = p.inst && p.failed;  // a failed processor's button is disabled
            });  // ends the loop over sockets
            queueEl.replaceChildren(...(queue.length ? queue.map((j) => h('span', { class: 'jchip' }, 'J' + j)) : [h('span', { class: 'muted small' }, 'empty')]));  // the waiting queue as a row of job chips, or "empty"
            clock.textContent = `t = ${t} s`;  // the clock, e.g. "t = 7 s"
            doneChip.textContent = `done ${done}/${NJOBS}`;  // the done counter, e.g. "done 5/12"
            runBtn.textContent = finished || down ? 'Run again' : running ? 'Pause' : t ? 'Resume' : 'Run';  // the main button's label changes with the state: Run again, Pause, Resume or Run
            const busy = procs.filter((p) => p.job != null).length;  // busy counts processors that are running a job right now
            status.innerHTML = down ? (procs.filter((p) => p.inst).length === 1 ? '<b class="c-bad">System down.</b> The only processor failed, so no job can run. A uniprocessor has no spare: one failure halts the whole machine.'  // status when down with a single processor: a uniprocessor has no spare, so one failure halts the machine
                : '<b class="c-bad">System down.</b> Every processor has failed, so nothing can run. With even one survivor, the jobs would have carried on.')  // status when down with every processor failed: even one survivor would have kept the jobs going
              : finished ? `<b class="c-ok">Done:</b> 12 jobs in <b>${t} s</b>${maxWorking > 1 ? ` with up to ${maxWorking} processors` : ` on one processor at a time, one job after another (12 × 4 s = 48 s${redone ? `, plus ${redone} s redone after the failure` : ''})`}. ${maxWorking > 1 ? 'One processor alone needs 48 s.' : 'Now add a processor or pick a bigger model.'}`  // status when finished: the total time, how many processors helped, and the 48-second single-processor comparison
              : running ? `<b>Running.</b> ${busy} processor${busy === 1 ? '' : 's'} busy, ${queue.length} job${queue.length === 1 ? '' : 's'} waiting, ${done} done.`  // status while running: processors busy, jobs waiting and jobs done
              : t ? '<b>Paused.</b> Fail a processor or add one, then resume.' : '<b>Press Run.</b> The OS hands each waiting job to a free processor. Try failing or adding processors while it runs.';  // status when paused, or before the first run: what to try
          }  // ends paint()
          const seg = ctx.ui.seg([{ value: 1, label: '1 CPU' }, { value: 2, label: '2 CPUs' }, { value: 4, label: '4 CPUs' }], model, (v) => {  // the product-line switch: models with 1, 2 or 4 processors
            if (v === model) return;  // picking the model already shown does nothing
            model = v; reset();  // otherwise switch model and start over
            unlock('scale', 'One design sold as <b>1-, 2- and 4-processor models</b> at different prices, all running the same software.');  // unlocks "scaling": one design sold as models of different size and price
          });  // ends the switch's handler
          reset();  // sets up the starting state
          ctx.every(TICK, tick);  // runs tick() every 170 milliseconds for as long as the step is open

          el.append(h('div', { class: 'split r fill' },  // page layout: two columns, the left one wider (7 parts to 5) because it holds the simulator
            h('div', { class: 'card white stack', style: { gap: '8px' } },  // left column: the simulator in a white card
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'b small' }, 'Product line:'), seg, h('span', { class: 'grow' }),  // top row: the product-line switch, a spacer, then Run and Reset on the right
                runBtn, h('button', { type: 'button', class: 'btn sm', onclick: () => reset() }, 'Reset')),  // the Run button and a Reset button
              h('div', { class: 'row', style: { gap: '8px', alignItems: 'flex-start' } }, h('span', { class: 'b small', style: { whiteSpace: 'nowrap', paddingTop: '2px' } }, 'Waiting:'), h('div', { style: { flex: '1 1 220px', minWidth: 0 } }, queueEl),  // second row: the waiting queue, which can wrap
                h('div', { class: 'row nw', style: { gap: '6px' } }, clock, doneChip)),  // the clock and done counter kept together on one line
              ...socks.map((k) => k.row), status, logEl),  // then the four socket rows, the status card and the log
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the discovery cards
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Four payoffs to discover'), foundChip),  // heading "Four payoffs to discover" with the found counter
              discEl.perf, discEl.avail, discEl.grow, discEl.scale,  // the four discovery cards
              h('div', { class: 'callout why m0 small', 'data-label': 'Transparent to the user', html: 'No job chose its processor: the OS gave each one to whichever processor was free. Users just see work finish sooner, so the extra processors are <span class="t">transparent</span>.' }))));  // callout: the OS chose each job's processor, so the extra processors are transparent to users
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------------------------------------------------------- 4. Advantage sorter */
      {  // step 4: a sorting game where each short story is matched to one SMP payoff
        title: 'Sort the stories: which payoff is each one?',  // step 4 title
        kind: 'predict',  // step kind "predict": the student decides before being told
        render(el, ctx) {  // render(el, ctx): builds the game when the step opens
          const { h } = ctx;  // h builds page elements
          const BK = [  // BK: the four payoffs the student sorts into, each with a short definition shown on its button
            { id: 'perf', name: 'Performance', def: 'more work done at the same time' },  // payoff: performance, more work done at the same time
            { id: 'avail', name: 'Availability', def: 'one failure does not stop the machine' },  // payoff: availability, one failure does not stop the machine
            { id: 'grow', name: 'Incremental growth', def: 'add processors to the machine you have' },  // payoff: incremental growth, adding processors to the same machine
            { id: 'scale', name: 'Scaling', def: 'models with different processor counts' },  // payoff: scaling, a range of models with different processor counts
          ];  // closes the BK list
          const STORIES = [  // STORIES: eight short stories, each with its correct payoff (a), a chip label, the story, an explanation and a hint
            { a: 'perf', label: 'Movie export in parallel', text: 'A video editor exports a movie on a 4-processor workstation. Different chunks of the film are compressed at the same moment, so the export takes a fraction of the one-processor time.',  // story 1 (performance): a movie export split across 4 processors
              why: 'The job was split up and the pieces ran <b>at the same time</b> on different processors. More work per second is performance.', hint: 'Nothing broke and nothing was bought. What got better?' },  // explanation and hint for story 1
            { a: 'grow', label: 'Filling empty sockets', text: 'A research lab’s server gets busier every month. The admin installs two more processors in its empty sockets instead of buying a new server.',  // story 2 (incremental growth): a lab adds processors to its server's empty sockets
              why: 'The <b>same machine</b> was made stronger by adding processors to it. Growing a system step by step is incremental growth.', hint: 'Is this about a vendor’s range of models, or about upgrading one machine over time?' },  // explanation and hint for story 2
            { a: 'avail', label: 'Bank server loses a CPU', text: 'At 3 a.m. one processor in a bank’s 8-processor server burns out. Transactions keep flowing on the other seven, a little slower, until a technician replaces the part.',  // story 3 (availability): a bank server keeps running after one processor burns out
              why: 'A processor failed but the machine <b>stayed up</b>. Surviving the loss of one part is availability.', hint: 'Focus on what happened when a part broke.' },  // explanation and hint for story 3
            { a: 'scale', label: 'Entry model vs top model', text: 'A small school buys the entry model of a server line. A large university buys the top model of the same family, which has many more processors.',  // story 4 (scaling): a school buys the entry model and a university the top model of one family
              why: 'One vendor offers <b>a range of models</b> that differ in processor count and price. That range is scaling. Neither buyer upgraded anything later.', hint: 'Two different customers, one product family. Did anyone upgrade a machine?' },  // explanation and hint for story 4
            { a: 'perf', label: 'Four requests at once', text: 'A web server handles four customers’ requests at the same moment, each on its own processor, so no customer waits for another customer’s page.',  // story 5 (performance): a web server handles four requests at once
              why: 'Four requests are served <b>in parallel</b> instead of in a line. Getting more done at once is performance.', hint: 'Is something broken, bought or upgraded here? Or is work just going faster?' },  // explanation and hint for story 5
            { a: 'grow', label: 'Buy one, add one later', text: 'A startup buys a 2-socket server with just one processor installed, planning to add the second when customers arrive.',  // story 6 (incremental growth): a startup plans to add a second processor later
              why: 'The plan is to <b>add a processor to the same machine</b> later, as needs grow. That is incremental growth.', hint: 'The key word is “later”: the same machine will be upgraded.' },  // explanation and hint for story 6
            { a: 'scale', label: '2-, 4-, 8-way models', text: 'A computer maker sells one server family in 2-, 4- and 8-processor versions, priced from budget to premium, all running the same operating system.',  // story 7 (scaling): one server family sold in 2-, 4- and 8-processor versions
              why: 'Building <b>a range of products</b> by varying the number of processors is scaling.', hint: 'Look at it from the seller’s side: several models, one design.' },  // explanation and hint for story 7
            { a: 'avail', label: 'Faulty CPU switched off', text: 'A health check finds that processor 3 keeps producing errors. The OS stops scheduling work on it, and the users never notice an outage.',  // story 8 (availability): the OS stops using a faulty processor and users see no outage
              why: 'The machine kept serving users <b>without the faulty processor</b>. Staying up through a failure is availability.', hint: 'What would happen on a machine that had only that one processor?' },  // explanation and hint for story 8
          ];  // closes the STORIES list
          let cur = 0, wrongs = new Set(), firstTry = 0, solved = false;  // cur is the current story; wrongs holds wrong picks for it; firstTry counts stories solved first time; solved says this story is done
          const placed = {};  // placed will hold each payoff's row of chips on the sorting board
          BK.forEach((b) => (placed[b.id] = h('div', { class: 'chips' })));  // creates an empty chip row for each payoff
          const scoreChip = h('span', { class: 'chip' });  // scoreChip is the "first try: n / m" counter
          const storyHead = h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '4px' } });  // storyHead is the line above the story: its number and a tag
          const storyText = h('div', { class: 'story-t' });  // storyText is where the story itself appears
          const fb = h('div', { class: 'card tight', style: { minHeight: '112px' } });  // fb is the feedback card under the answer buttons; its minimum height keeps the page steady
          const nextBtn = h('button', { type: 'button', class: 'btn sm primary', onclick: () => next() });  // nextBtn moves on to the next story
          const bkBtns = BK.map((b) => h('button', { type: 'button', class: 'bk', onclick: () => choose(b.id) }, h('b', {}, b.name), h('span', {}, b.def)));  // bkBtns: one answer button per payoff, showing its name and definition, calling choose() when clicked
          const nameOf = (id) => BK.find((b) => b.id === id).name;  // nameOf(id): looks up a payoff's display name
          function show() {  // show(): displays the current story, or the final summary after the last one
            wrongs = new Set(); solved = false;  // starts the story fresh: no wrong picks, not solved
            if (cur >= STORIES.length) {  // after all eight stories
              storyHead.replaceChildren(h('span', { class: 'b' }, 'All 8 stories sorted'), h('span', { class: 'chip ok' }, '✓ done'));  // the heading says all 8 are sorted, with a done tag
              storyText.innerHTML = `You placed <b>${firstTry} of 8</b> on the first try. Performance and availability are about what happens while the machine runs; incremental growth and scaling are about buying and upgrading.`;  // summary: how many were placed first time, and how the four payoffs split into running versus buying and upgrading
              bkBtns.forEach((b) => { b.disabled = true; b.className = 'bk'; });  // disables every answer button and clears its colour
              fb.replaceChildren(h('div', { class: 'small', html: 'The pairs students mix up most are <b>incremental growth</b> (one machine, upgraded later) and <b>scaling</b> (a vendor’s range of models).' }),  // a note on the two payoffs most often mixed up, incremental growth and scaling
                h('div', { class: 'row mt' }, h('button', { type: 'button', class: 'btn sm', onclick: () => restart() }, 'Sort again')));  // and a "Sort again" button
              return;  // stops here; there is no story to show
            }  // ends the finished case
            const st = STORIES[cur];  // st is the current story
            storyHead.replaceChildren(h('span', { class: 'b' }, `Story ${cur + 1} of 8`), h('span', { class: 'chip accent' }, 'Which payoff?'));  // heading: "Story n of 8" and a "Which payoff?" tag
            storyText.textContent = st.text;  // shows the story text
            bkBtns.forEach((b) => { b.disabled = false; b.className = 'bk'; });  // re-enables every answer button and clears its colour
            fb.innerHTML = '<div class="small muted">Pick the payoff this story shows. A wrong pick gets a hint, and you can try again.</div>';  // first hint: pick a payoff, and a wrong pick gets a hint
          }  // ends show()
          function choose(id) {  // choose(id): runs when the student clicks a payoff button
            if (solved || cur >= STORIES.length) return;  // ignores clicks once the story is solved or the game is over
            const st = STORIES[cur], i = BK.findIndex((b) => b.id === id);  // st is the current story; i is the clicked button's position
            if (id === st.a) {  // the right answer
              solved = true;  // marks this story as solved
              if (!wrongs.size) firstTry++;  // if there were no wrong picks first, counts it as a first-try success
              bkBtns[i].className = 'bk right';  // the right button turns green
              bkBtns.forEach((b, j) => { if (j !== i) b.disabled = true; });  // every other button is disabled
              placed[id].append(h('span', { class: 'chip ' + (wrongs.size ? 'warn' : 'ok') + ' fade-in' }, st.label));  // adds the story's chip to that payoff's bin on the board: green if first try, amber otherwise
              scoreChip.className = 'chip accent';  // the score counter takes the accent colour
              scoreChip.textContent = `first try: ${firstTry} / ${cur + 1}`;  // updates the score, e.g. "first try: 3 / 4"
              nextBtn.textContent = cur === STORIES.length - 1 ? 'Finish' : 'Next story →';  // the Next button says "Finish" on the last story
              fb.replaceChildren(h('div', { class: 'small', html: `<b class="c-ok">Yes: ${nameOf(id)}.</b> ${st.why}` }), h('div', { class: 'row', style: { marginTop: '8px' } }, nextBtn));  // feedback: confirms the payoff, explains why, and offers the Next button
            } else {  // a wrong answer
              wrongs.add(id);  // remembers the wrong pick
              bkBtns[i].className = 'bk wrong';  // the wrong button turns red
              bkBtns[i].disabled = true;  // and is disabled so it cannot be picked again
              fb.innerHTML = `<div class="small"><b class="c-bad">Not ${nameOf(id)}.</b> ${nameOf(id)} means “${BK[i].def}”. <b>Hint:</b> ${st.hint}</div>`;  // feedback: what that payoff actually means, plus the story's hint
            }  // ends the right / wrong choice
          }  // ends choose()
          function next() { cur++; show(); }  // next(): moves on to the next story
          function restart() { cur = 0; firstTry = 0; BK.forEach((b) => placed[b.id].replaceChildren()); scoreChip.className = 'chip'; scoreChip.textContent = 'first try: 0 / 0'; show(); }  // restart(): clears the score and the board and starts again from story 1
          scoreChip.textContent = 'first try: 0 / 0';  // the counter's starting text
          show();  // shows the first story

          el.append(h('div', { class: 'split r fill' },  // page layout: two columns, the left one wider for the story and answers
            h('div', { class: 'stack' },  // left column: a vertical stack
              h('p', { class: 'm0', html: 'Each story below shows one of the four payoffs of an <span class="t">SMP</span>. Read it, then pick the payoff it shows.' }),  // instructions: each story shows one of the four payoffs of an SMP
              h('div', { class: 'card white story' }, storyHead, storyText),  // the story card: its heading and its text
              h('div', { class: 'grid-2', style: { gap: '10px' } }, ...bkBtns),  // the four answer buttons in a 2 by 2 grid
              fb),  // the feedback card
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the sorting board
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Your sorting board'), scoreChip),  // heading "Your sorting board" with the score counter
              ...BK.map((b) => h('div', { class: 'bin' }, h('div', { class: 'bn' }, b.name), placed[b.id])),  // one bin per payoff, each with its name and its row of placed chips
              h('div', { class: 'callout why m0 small', 'data-label': 'Notice', html: 'In every story the users kept running the same programs. Deciding which processor runs what was the OS’s job, not theirs: the processors are <span class="t">transparent</span> to users.' }))));  // callout: users kept running the same programs, because the OS decided which processor ran what
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------------------------------------------------------- 5. Machine builder */
      {  // step 5: build and compare machines, from one processor to a real multicore chip
        title: 'Build the machine: one CPU, an SMP, a multicore chip',  // step 5 title
        kind: 'explore',  // step kind "explore"
        render(el, ctx) {  // render(el, ctx): builds step 5 when it opens
          const { h, s } = ctx;  // h builds page elements and s builds SVG shapes
          const svg = s('svg', { viewBox: '0 0 660 416', width: '100%', class: 'mach' });  // svg is the 660 by 416 machine drawing; class "mach" enables the fade-others style when a part is picked
          const wrap = h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg);  // wrap is the white card around the drawing
          const modeCard = h('div', { class: 'card tight' });  // modeCard describes the machine currently shown: its name, a paragraph and fact chips
          const info = h('div');  // info is where the explanation of a clicked part appears
          const infoCard = h('div', { class: 'card tight grow', style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, info,  // infoCard stacks the explanation, a spacer and a callout, and grows to fill the column
            h('div', { style: { flex: '1 1 0' } }),   // spacer: .m0 overrides margin-top:auto, so this pins the callout to the bottom
            h('div', { class: 'callout why small m0', 'data-label': 'Keep an eye on', html: 'The private caches: each holds copies the others cannot see. When two copies of the same data drift apart, that is the <span class="t">cache coherence</span> problem of the next step.' }));  // callout at the bottom: watch the private caches, because copies that drift apart cause the coherence problem next
          const nextBtn = h('button', { type: 'button', class: 'btn sm' });  // nextBtn jumps to the next machine in the list
          let mode = 'uni', groups = {};  // mode is the machine currently drawn; groups collects every drawn copy of each part, keyed by part name
          const UNIT = { uni: 'processor', smp: 'processor', multi: 'core', i7: 'core' };  // UNIT: whether this machine's processing units are called processors or cores
          const COUNT = { uni: 1, smp: 3, multi: 4, i7: 8 };  // COUNT: how many processors or cores each machine has
          const PRIVATE = ['proc', 'cu', 'alu', 'regs', 'pipe', 'l1', 'l2'], SHARED = ['bus', 'mem', 'io', 'l3', 'imc', 'pcie'];  // PRIVATE lists parts each processor or core has its own copy of; SHARED lists parts there is only one of
          // one clickable part: a rectangle with centred label lines (and an optional muted sub-label)
          function P(key, x, y, w, hh, cls, label, o = {}) {  // P(key, x, y, w, hh, cls, label, o): draws one clickable part with its label; o holds optional size, font and position settings
            const lines = label == null ? [] : [].concat(label);  // lines is the label as a list of lines (none if there is no label)
            const fs = o.fs || 13, lh = o.lh || fs + 3;  // fs is the font size (13 unless given) and lh the line spacing
            const kids = [s('rect', { x, y, width: w, height: hh, rx: o.rx != null ? o.rx : 6, class: cls + ' fr', 'stroke-width': o.sw || 1.5 })];  // the part's rectangle, with class "fr" so hover and selection can thicken its frame
            if (lines.length) kids.push(mtext(s, o.tx != null ? o.tx : x + w / 2, o.ty != null ? o.ty : y + hh / 2 + fs * 0.36 - ((lines.length - 1) * lh) / 2, lines,  // if there is a label, centres its lines in the box (unless o gives an exact position)
              { 'text-anchor': o.anchor || 'middle', 'font-size': fs, 'font-weight': o.fw || 700, class: o.tc || null }, lh));  // the label's alignment, size, weight and colour class
            if (o.sub) kids.push(s('text', { x: x + w / 2, y: o.suby, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, o.sub));  // an optional small muted line under the label
            const g = hotGroup(ctx, () => select(key), o.aria || lines.join(' ') || key, ...kids);  // wraps it all in a clickable group that calls select(key); its screen-reader label is o.aria, the label text, or the key
            (groups[key] = groups[key] || []).push(g);  // records this copy of the part so every copy can light up together
            return g;  // hands the group to the caller
          }  // ends P()
          // a processor or core: outer box + control unit, ALU, registers, pipeline, L1-I, L1-D
          function proc(x, y, w, title, small) {  // proc(x, y, w, title, small): draws one processor or core with its six inner parts; small uses slightly smaller text
            const cw = (w - 18) / 2, fs = small ? 12 : 12.5, x2 = x + 12 + cw;  // cw is the width of each of the two inner columns; x2 is where the right column starts
            return [P('proc', x, y, w, 108, 's-cpu', title, { ty: y + 17, fs: 14, fw: 800, sw: 2 }),  // the outer processor box with its title near the top
              P('cu', x + 6, y + 24, cw, 22, 's-cpuin', 'CU', { fs }), P('alu', x2, y + 24, cw, 22, 's-cpuin', 'ALU', { fs }),  // first inner row: the control unit and the ALU
              P('regs', x + 6, y + 50, cw, 22, 's-cpuin', small ? 'Regs' : 'Registers', { fs, aria: 'Registers' }), P('pipe', x2, y + 50, cw, 22, 's-cpuin', 'Pipeline', { fs }),  // second row: the registers (shortened to "Regs" when small) and the pipeline
              P('l1', x + 6, y + 76, cw, 22, 's-cache', 'L1-I', { fs, tc: 'tx-acc' }), P('l1', x2, y + 76, cw, 22, 's-cache', 'L1-D', { fs, tc: 'tx-acc' })];  // third row: the instruction cache L1-I and the data cache L1-D, both counted as the "l1" part
          }  // ends proc()
          const line = (x1, y1, x2, y2) => s('line', { x1, y1, x2, y2, class: 's-line' });  // line(): helper for a plain connecting line
          function bottom(k, sharedSlot) {  // bottom(k, sharedSlot): draws the shared lower half: the bus, main memory and I/O; sharedSlot adds a shared-data box in memory
            const ty = sharedSlot ? 326 : 344, suby = sharedSlot ? 347 : 366;   // centre the labels unless the shared-data slot fills the lower half
            const out = [P('bus', 16, 246, 628, 12, 's-bus', null, { aria: 'System bus' }),  // the system bus as a clickable bar across the drawing
              s('text', { x: 330, y: 282, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'system bus (shared)'),  // the "system bus (shared)" label under it
              line(175, 258, 175, 296), line(485, 258, 485, 296),  // two lines down from the bus to memory and to I/O
              P('mem', 40, 296, 270, 108, 's-mem', 'Main memory', { fs: 16, fw: 800, ty, sub: 'one copy, shared by all', suby }),  // main memory, with its note "one copy, shared by all"
              P('io', 350, 296, 270, 108, 's-io', 'I/O subsystem', { fs: 16, fw: 800, ty, sub: 'disk · network · USB', suby })];  // the I/O subsystem, with its note listing disk, network and USB
            if (sharedSlot) groups.mem[0].append(s('rect', { x: 58, y: 362, width: 234, height: 28, rx: 6, fill: 'var(--panel)', stroke: 'var(--mem)', 'stroke-dasharray': '4 3' }),  // for the SMP only: adds a dashed "shared data" box inside the memory part
              s('text', { x: 175, y: 381, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-mem' }, 'shared data: P1 writes, P3 reads'));  // its label says P1 writes the data and P3 reads it, a lead-in to cache coherence
            return out;  // hands back the lower-half parts
          }  // ends bottom()
          function chipBox(x, y, w, hh, label) {  // chipBox(x, y, w, hh, label): draws a dashed, clickable outline marking a chip's edge, with a small label at its top left
            return P('chip', x, y, w, hh, 'chipb', label, { rx: 12, sw: 2, fs: 12.5, anchor: 'start', tx: x + 10, ty: y + 16, tc: 's-sub', aria: 'Chip boundary' });  // it is a normal part keyed "chip", with rounded corners and a muted left-aligned label
          }  // ends chipBox()
          function build(m) {  // build(m): draws machine m from scratch and refreshes the text around it; runs when the switch changes
            mode = m; groups = {};  // remembers the machine and forgets the parts of the previous one
            svg.classList.remove('picked');  // no part is picked yet, so nothing is faded
            const k = [];  // k collects every shape for the new drawing
            if (m === 'uni') {  // uniprocessor: one chip holding one processor
              k.push(chipBox(213, 8, 234, 176, 'chip'), ...proc(225, 30, 210, 'Processor'),  // the chip outline and a full processor
                P('l2', 231, 148, 198, 24, 's-cache', 'L2 cache (private)', { tc: 'tx-acc' }), line(330, 172, 330, 246), ...bottom(m));  // a private L2 under the processor, a line down to the bus, and the shared lower half
            } else if (m === 'smp') {  // SMP: three separate chips side by side
              [26, 238, 450].forEach((x, i) => k.push(chipBox(x - 10, 8, 204, 176, 'chip ' + (i + 1)), ...proc(x, 30, 184, 'Processor ' + (i + 1)),  // each chip: its outline and a full processor
                P('l2', x + 6, 148, 172, 24, 's-cache', 'L2 (private)', { tc: 'tx-acc' }), line(x + 92, 172, x + 92, 246)));  // each with its own private L2 and a line down to the bus
              k.push(...bottom(m, true));  // the shared lower half, including the shared-data box in memory
            } else if (m === 'multi') {  // multicore: one chip holding four cores
              k.push(chipBox(10, 8, 640, 206, 'one chip (die)'));  // one large chip outline labelled as a single die
              for (let i = 0; i < 4; i++) { const x = 22 + i * 157; k.push(...proc(x, 30, 145, 'Core ' + (i + 1), true), P('l2', x + 6, 144, 133, 24, 's-cache', 'L2 (private)', { fs: 12.5, tc: 'tx-acc' })); }  // four cores, each with its own private L2
              k.push(P('l3', 22, 176, 606, 28, 's-cache', 'L3 cache: shared by all four cores', { fs: 14, fw: 800, tc: 'tx-acc', sw: 2 }), line(330, 214, 330, 246), ...bottom(m));  // one shared L3 across all four cores, a line down to the bus, and the shared lower half
            } else {  // otherwise the real chip, the Core i7-5960X
              k.push(chipBox(10, 8, 640, 290, 'Core i7-5960X: one die'));  // one die outline, taller because it holds more
              [34, 152].forEach((y, row) => { for (let i = 0; i < 4; i++) { const x = 22 + i * 153, n = row * 4 + i + 1;  // two rows of four cores, numbered 1 to 8
                k.push(P('proc', x, y, 98, 64, 's-cpu', ['Core ' + n, 'x86'], { fs: 14, fw: 800, lh: 18 }), P('l2', x + 102, y, 44, 64, 's-cache', ['L2', '256', 'KB'], { fs: 12, lh: 15, tc: 'tx-acc', aria: 'L2 cache, 256 KB' })); } });  // each core is a compact box labelled "Core n, x86" with its own 256 KB L2 beside it
              k.push(P('l3', 22, 106, 605, 38, 's-cache', 'Shared L3 cache: 20 MB, used by all 8 cores', { fs: 15, fw: 800, tc: 'tx-acc', sw: 2 }),  // the shared 20 MB L3 between the two rows of cores
                P('imc', 22, 226, 298, 60, 's-mem', ['Integrated memory controller', 'DDR4 · 4 channels'], { fs: 13.5, lh: 19 }),  // the integrated memory controller on the die, for DDR4 over 4 channels
                P('pcie', 330, 226, 297, 60, 's-io', ['PCI Express 3.0', '40 lanes'], { fs: 13.5, lh: 19 }),  // the PCI Express 3.0 connections on the die, 40 lanes
                line(171, 286, 171, 326), line(478, 286, 478, 326),  // lines from the controller down to memory and from PCI Express down to the devices
                P('mem', 40, 326, 262, 80, 's-mem', 'DDR4 main memory', { fs: 15, fw: 800, ty: 360, sub: 'memory modules, off the chip', suby: 382 }),  // DDR4 main memory modules, off the chip
                P('io', 348, 326, 262, 80, 's-io', 'Graphics card, SSDs', { fs: 15, fw: 800, ty: 360, sub: 'fast devices, off the chip', suby: 382 }));  // graphics card and SSDs, off the chip
            }  // ends the choice of machine
            svg.replaceChildren(...k);  // replaces the drawing with the new machine
            if (wrap.animate) wrap.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });   // opacity only: a slide would poke past the canvas edge
            const mt = MODE_TEXT[m], idx = MODES.findIndex((x) => x.value === m);  // mt is this machine's text; idx is its place in the list of machines
            modeCard.replaceChildren(h('h3', {}, mt.name), h('p', { class: 'small m0', html: mt.what }),  // the machine card: its name and description
              h('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, ...mt.chips.map((c) => h('span', { class: 'chip cpu' }, c))));  // followed by its three fact chips
            // the "next machine" button lives in the top row so it never steals height from the explanation cards
            const nx = MODES[idx + 1];  // nx is the next machine in the list, if there is one
            nextBtn.style.visibility = nx ? '' : 'hidden';  // hides the Next button on the last machine
            nextBtn.textContent = nx ? 'Next: ' + nx.label.replace('Real chip: ', '') + ' →' : 'Next';  // the Next button's label names the next machine
            nextBtn.onclick = nx ? () => { seg.set(nx.value); build(nx.value); } : null;  // clicking it moves the switch and draws that machine
            const TRY = {  // TRY: a suggestion for what to click on each machine
              uni: 'With one processor there is one of everything. Switch to <b>SMP</b> to see which parts get copied and which stay single.',  // uniprocessor: there is one of everything, so switch to SMP
              smp: 'Try <b>L2</b>, then <b>Main memory</b>: three copies light up for one, a single box for the other. That is private versus shared.',  // SMP: compare L2 (three copies) with main memory (one box)
              multi: 'Try <b>L2</b>, then the <b>L3</b>: one is copied per core, the other is a single cache on the die that every core uses.',  // multicore: compare L2 (one per core) with L3 (one for the chip)
              i7: 'Try an <b>L2</b>, the <b>L3</b> and the <b>memory controller</b>, and read which are per core and which the whole chip shares.',  // real chip: compare an L2, the L3 and the memory controller
            };  // closes the TRY table
            info.innerHTML = '<div class="b">Click any part of the machine.</div><div class="small muted">Every copy of that part lights up, so you can see what each ' + UNIT[m] + ' owns and what they all share.</div>' +  // the explanation's starting text: click any part and every copy of it lights up
              `<div class="small" style="margin-top:8px">${TRY[m]}</div>`;  // followed by this machine's suggestion
          }  // ends build()
          function select(key) {  // select(key): runs when a part is clicked; highlights every copy of it and explains it
            svg.classList.add('picked');  // marks the drawing as picked, so the other parts fade
            Object.entries(groups).forEach(([kk, arr]) => arr.forEach((g) => g.classList.toggle('sel', kk === key)));  // gives every copy of the clicked part the "sel" style and removes it from all others
            const [name, text] = (PART_MODE[mode] && PART_MODE[mode][key]) || PART_INFO[key];  // the part's heading and text: this machine's own version if there is one, otherwise the general one
            const n = COUNT[mode], u = UNIT[mode];  // n is how many processors or cores this machine has; u is what they are called
            const note = mode === 'uni' ? '' : key === 'l1' ? `<span class="chip warn">private</span> one pair (L1-I + L1-D) per ${u}: all ${n} pairs are lit.`  // note: nothing extra on the uniprocessor; for L1, one pair per processor or core
              : PRIVATE.includes(key) ? `<span class="chip warn">private</span> one per ${u}: all ${n} are lit.`  // for other private parts: one per processor or core, all lit
              : SHARED.includes(key) ? `<span class="chip ok">shared</span> just one, used by all ${n} ${u}s.` : '';  // for shared parts: just one, used by all
            info.innerHTML = `<div class="b" style="margin-bottom:2px">${name}</div><div class="small">${text}</div>` + (note ? `<div class="small" style="margin-top:8px">${note}</div>` : '');  // shows the heading, the explanation, and the private/shared note if there is one
          }  // ends select()
          const seg = ctx.ui.seg(MODES, 'uni', (v) => build(v));  // seg: the switch listing the four machines; choosing one calls build() to draw it
          build('uni');  // draws the uniprocessor first

          el.append(h('div', { class: 'stack fill' },  // page layout: a vertical stack filling the step
            h('div', { class: 'row' }, h('span', { class: 'b' }, 'Build:'), seg, h('span', { class: 'grow' }), nextBtn),  // top row: the "Build:" switch, a spacer, and the Next button on the right
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 4fr) minmax(0, 7fr)', gap: '18px' } },  // below: two columns, the drawing column wider (4 parts to 7)
              h('div', { class: 'stack' }, modeCard, infoCard), wrap)));  // left: the machine card above the part explanation; right: the drawing
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------------------------------------------------------- 6. Cache coherence simulator */
      {  // step 6: a cache coherence simulator with two processors and one shared value X
        title: 'Cache coherence: when two copies disagree',  // step 6 title
        kind: 'explore',  // step kind "explore"
        core: true,  // core: true keeps this step on the shorter core route
        render(el, ctx) {  // render(el, ctx): builds the simulator when the step opens
          const { h, s } = ctx;  // h builds page elements and s builds SVG shapes
          const X0 = 5;  // X0 is the starting value of X in main memory
          let proto = 'off', mem, caches, adds, used, token = 0;  // proto is the coherence protocol ('off' or 'inv' for invalidation); then memory, the caches, adds, values used, and a story token
          /* ---- the picture: two processors, their private caches, the bus and memory */
          const svg = s('svg', { viewBox: '0 0 640 310', width: '100%' });  // svg is the 640 by 310 drawing of two processors, their caches, the bus and memory
          const V = [0, 1].map((i) => {  // V: the changing parts of the drawing for processor 1 and processor 2
            const x = 30 + i * 340, cx = x + 120;  // x is this side's left edge and cx its centre
            const o = {  // o collects the parts for this side
              box: s('rect', { x, y: 8, width: 240, height: 54, rx: 10, class: 's-cpu', 'stroke-width': 2 }),  // the processor box
              sub: s('text', { x: cx, y: 52, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }),  // the small line inside the processor box that shows the value it last used
              cbox: s('rect', { x, y: 78, width: 240, height: 78, rx: 10, class: 's-cache', 'stroke-width': 2 }),  // the private cache box under the processor
              lbox: s('rect', { x: x + 16, y: 106, width: 208, height: 38, rx: 8, fill: 'var(--panel)', stroke: 'var(--line-2)', 'stroke-width': 1.5 }),  // the line box inside the cache that holds the copy of X
              val: s('text', { x: x + 30, y: 131 }),  // the text of the cached copy, e.g. "X = 6"
              strike: s('line', { x1: x + 26, y1: 125, x2: x + 86, y2: 125, stroke: 'var(--muted)', 'stroke-width': 2.5 }),  // a strike-through line drawn over the value when the copy is invalid
              tag: s('text', { x: x + 212, y: 130, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 800 }),  // the tag at the right of the line box: valid, stale, invalid, or empty
            };  // closes the parts list for this side
            svg.append(o.box, s('text', { x: cx, y: 32, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Processor ' + (i + 1)), o.sub,  // adds the processor box, its name, and its small line
              s('line', { x1: cx, y1: 62, x2: cx, y2: 78, class: 's-line' }), o.cbox,  // a line from the processor down to its cache, then the cache box
              s('text', { x: cx, y: 97, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 'tx-acc' }, `P${i + 1}’s private cache`),  // the cache's heading, e.g. "P1's private cache"
              o.lbox, o.val, o.strike, o.tag, s('line', { x1: cx, y1: 156, x2: cx, y2: 190, class: 's-line' }));  // the line box, value, strike line and tag, then a line from the cache down to the bus
            return o;  // hands this side's parts back
          });  // ends the two-sided builder
          const pill = s('rect', { x: 205, y: 160, width: 230, height: 24, rx: 12, class: 's-panel', 'stroke-width': 1.5 });  // pill: the rounded box on the bus that shows the current bus message
          const pillT = s('text', { x: 320, y: 177, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 });  // pillT: the text inside it
          const memBox = s('rect', { x: 200, y: 228, width: 240, height: 74, rx: 10, class: 's-mem', 'stroke-width': 2 });  // memBox: the main memory box
          const memVal = s('text', { x: 320, y: 285, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, class: 's-monot' });  // memVal: the value of X in memory, large and bold
          svg.append(s('rect', { x: 16, y: 190, width: 608, height: 12, rx: 6, class: 's-bus' }), pill, pillT,  // draws the bus bar, and the message pill on it
            s('line', { x1: 320, y1: 202, x2: 320, y2: 228, class: 's-line' }), memBox,  // a line from the bus down to memory, then the memory box
            s('text', { x: 320, y: 252, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Main memory'), memVal);  // the "Main memory" heading and the memory value
          function ping(node) { node.classList.add('ping'); ctx.after(650, () => node.classList.remove('ping')); }  // ping(node): briefly thickens a part's outline for 0.65 seconds to show it was involved
          function bus(msg, cls) { pillT.textContent = 'bus: ' + msg; pill.setAttribute('class', cls || 's-panel'); ping(pill); }  // bus(msg, cls): shows a message on the bus pill, colours the pill, and pings it

          /* ---- side panels */
          const truth = h('div', { class: 'card tight small' });  // truth is the small card that states the real value of X and whether each copy is fresh
          const narr = h('div', { style: { fontSize: '15px', lineHeight: '1.45' } });  // narr holds the narration text that explains the last action
          const narrCard = h('div', { class: 'card tight grow', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, narr,  // narrCard stacks the narration, a spacer and a callout, and grows to fill its column
            h('div', { style: { flex: '1 1 0' } }),   // spacer pins the callout to the card bottom so it does not jump as the narration changes
            h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Coherence does not make X&nbsp;=&nbsp;X&nbsp;+&nbsp;1 indivisible. Here each “+&nbsp;1” runs unbroken; if two ever interleave, an update can still be lost (a race: Chapter 5).' }));  // common-mistake callout: coherence keeps copies consistent, but does not make X = X + 1 indivisible
          const logEl = h('div', { class: 'log', style: { height: '76px' } });  // logEl is the scrolling event log, 76 pixels tall
          const log = (m, cls) => { logEl.append(h('div', { class: cls || '', html: m })); logEl.scrollTop = logEl.scrollHeight; };  // log(m, cls): adds a line to the log and scrolls to the newest
          const btns = [];  // btns will hold the action buttons so they can be disabled while a story plays
          function reset() {  // reset(): starts the simulation over with the current protocol
            token++;  // bumps the token so any story still playing notices and stops
            mem = X0; adds = 0; used = [null, null];  // X back to its starting value, no adds, and no values used yet
            caches = [0, 1].map(() => ({ has: false, valid: false, val: null }));  // both caches empty: no copy, not valid, no value
            pillT.textContent = 'bus: idle'; pill.setAttribute('class', 's-panel');  // the bus pill goes back to "idle"
            logEl.replaceChildren();  // empties the log
            log(`X = ${X0} in memory. Neither cache has a copy yet. Protocol: ${proto === 'inv' ? 'invalidation' : 'none'}.`);  // first log line: the value of X in memory, empty caches, and which protocol is on
            narr.innerHTML = proto === 'inv'  // narration for the current protocol
              ? '<b>Invalidation is on.</b> Every cache controller <b>snoops</b> on the bus: when one processor writes X, every other cached copy of X is marked invalid. Press <b>Play the story</b>, or click the actions yourself.'  // with invalidation: every cache controller snoops on the bus and invalidates its copy when another processor writes X
              : '<b>No protocol.</b> The caches ignore each other, like a broken machine. A read that finds X in its own cache is a <b>hit</b>; otherwise it is a <b>miss</b> and X comes from memory. Try P1 reads, P2 reads, P1 adds 1, P2 reads, or press <b>Play the story</b>.';  // with no protocol: the caches ignore each other; explains hit and miss and suggests a sequence to try
            btns.forEach((b) => (b.disabled = false));  // re-enables every action button
            paint();  // redraws the picture
          }  // ends reset()
          // a read: hit in the processor’s own cache if it holds a valid copy, otherwise fetch X from memory
          function read(i) {  // read(i): processor i reads X and reports the value, whether it was a hit, and whether it was stale
            const c = caches[i];  // c is processor i's cache
            if (c.has && c.valid) return { v: c.val, hit: true, stale: c.val !== mem };  // a valid copy in its own cache is a hit; stale is true if that copy no longer matches memory
            const wasInv = c.has && !c.valid;  // wasInv notes that the cache had a copy but it was invalid
            bus(`P${i + 1} reads X`); ping(memBox);  // a miss: the read goes over the bus, and memory is pinged
            Object.assign(c, { has: true, valid: true, val: mem });  // the cache now holds a valid copy of the value from memory
            return { v: mem, hit: false, wasInv };  // returns the value, a miss, and whether the old copy had been invalidated
          }  // ends read()
          function act(i, op) {  // act(i, op): processor i reads X (op 'r') or adds 1 to X; updates the picture, narration and log
            const P = 'P' + (i + 1), O = 'P' + (2 - i), other = caches[1 - i];  // P names this processor, O the other one; other is the other processor's cache
            ping(V[i].cbox);  // pings this processor's cache
            const r = read(i);  // every action starts by reading X
            const how = r.hit ? `a <b>hit</b> in its own cache` : r.wasInv ? `a <b>miss</b>, because its copy was invalidated, so it fetches the fresh value from memory` : `a <b>miss</b>, so it fetches X from memory`;  // how describes the read: a hit, a miss after invalidation, or an ordinary miss
            if (op === 'r') {  // a plain read
              used[i] = r.v;  // remembers the value this processor used
              if (r.stale) { narr.innerHTML = `<b class="c-bad">${P} reads X = ${r.v} from its own cache.</b> It is a hit, so ${P} never looks at memory, where X is really <b>${mem}</b>. ${P} is working with a <b>stale copy</b>.`; log(`${P} reads X → ${r.v} (hit, STALE: memory has ${mem})`, 'c-bad'); }  // a stale hit: the processor uses its old copy without looking at memory; the narration and log flag it in red
              else { narr.innerHTML = `<b>${P} reads X = ${r.v}</b>: ${how}.`; log(`${P} reads X → ${r.v} (${r.hit ? 'hit' : r.wasInv ? 'miss: its copy was invalid' : 'miss'})`); }  // a normal read: the narration and log say what was read and how
            } else {  // an add
              const nv = r.v + 1;  // nv is the new value: the value just read plus 1
              adds++; used[i] = nv;  // counts the add and remembers the value this processor used
              Object.assign(caches[i], { has: true, valid: true, val: nv });  // this processor's cache now holds the new value
              mem = nv;                                   // write-through: memory is updated on every write
              ping(memBox);  // memory is pinged to show the write
              let then;  // then will hold the narration about what the write did to the other cache
              if (proto === 'inv') {  // with invalidation on
                bus('invalidate X', 's-accent');  // the bus shows "invalidate X" in the accent colour
                if (other.has && other.valid) { other.valid = false; ping(V[1 - i].cbox); then = `The new value also goes to memory, and the write puts <b>“invalidate X”</b> on the bus. ${O}’s cache controller sees it and marks its copy <b>invalid</b>.`; }  // if the other cache holds a valid copy, it is marked invalid and pinged, and the narration explains why
                else then = `The new value also goes to memory, and the write puts “invalidate X” on the bus. No other cache holds a valid copy, so nothing else changes.`;  // if not, the narration says nothing else changes
              } else {  // with no protocol
                bus(`P${i + 1} writes X = ${nv}`);  // the bus only shows the write going to memory
                then = !(other.has && other.valid) ? 'The new value also goes to memory.' : other.val !== mem ? `The new value also goes to memory, but <b>nobody tells ${O}’s cache</b>. Its copy of X is now <b>stale</b>.`  // without a protocol: if the other cache now holds an old value, the narration warns that its copy is stale
                  : `The new value also goes to memory. Nobody tells ${O}’s cache either; its copy happens to hold ${other.val} too.`;  // or, if the other copy happens to match, it says nobody told that cache but its value is still right
              }  // ends the protocol choice
              const should = X0 + adds, lost = mem !== should;  // should is what X ought to be after all the adds; lost is true when memory disagrees, meaning an add was wiped out
              narr.innerHTML = `<b>${P} adds 1 to X.</b> It reads ${r.v} (${how}), then writes <b>${nv}</b>. ${then}` +  // narration: what the add read, how, and what it wrote, plus what happened to the other cache
                (lost ? ` <b class="c-bad">Lost update:</b> X should be ${should}, but it is ${mem}.` : '');  // a red "Lost update" warning when X no longer equals its starting value plus the number of adds
              log(`${P} adds 1: read ${r.v}${r.stale ? ' (STALE)' : ''}, wrote ${nv}${proto === 'inv' ? ', invalidate X' : ''}`, lost ? 'c-bad' : '');  // logs the add, marks a stale read, notes the invalidate message, and turns red for a lost update
            }  // ends the add branch
            paint();  // redraws the picture
          }  // ends act()
          function paint() {  // paint(): redraws both caches, memory and the truth card from the current state
            V.forEach((o, i) => {  // for each processor
              const c = caches[i];  // c is its cache
              o.sub.textContent = used[i] == null ? 'has not used X yet' : `last used X = ${used[i]}`;  // the processor's small line: the value it last used, or that it has not used X yet
              o.strike.style.display = c.has && !c.valid ? '' : 'none';  // the strike-through line shows only on an invalid copy
              const stale = c.has && c.valid && c.val !== mem;  // stale is true for a copy that the cache thinks is valid but no longer matches memory
              o.lbox.style.stroke = stale ? 'var(--bad)' : c.has && c.valid ? 'var(--ok)' : '';  // the line box outline: red for stale, green for valid, plain otherwise
              o.val.setAttribute('font-size', c.has ? 17 : 14);  // the value text is larger when there is a copy
              o.val.setAttribute('font-weight', c.has ? 800 : 600);  // and bolder when there is a copy
              o.val.setAttribute('class', c.has ? 's-monot' + (c.valid ? '' : ' tx-muted') : 'tx-muted');  // a valid copy is shown in fixed-width text; an invalid copy or no copy is muted
              o.val.textContent = c.has ? `X = ${c.val}` : 'no copy of X';  // the text: "X = value", or "no copy of X"
              o.tag.textContent = !c.has ? '' : !c.valid ? 'invalid' : stale ? 'STALE' : 'valid';  // the tag: empty, invalid, STALE or valid
              o.tag.setAttribute('class', !c.valid ? 'tx-muted' : stale ? 'tx-bad' : 'tx-ok');  // the tag's colour: muted for invalid, red for stale, green for valid
            });  // ends the loop over processors
            memVal.textContent = `X = ${mem}`;  // the value of X in memory
            const should = X0 + adds, lost = mem !== should;  // recomputes what X should be and whether an update was lost
            const staleAt = caches.findIndex((c) => c.has && c.valid && c.val !== mem);  // staleAt is the first processor whose copy is stale, or -1 if none
            const st = lost ? ['bad', '✗ lost update'] : staleAt >= 0 ? ['bad', `✗ P${staleAt + 1}’s copy is stale`] : ['ok', '✓ all copies agree'];  // the verdict: a lost update, a stale copy, or all copies agree
            truth.innerHTML = `<div class="row" style="justify-content:space-between"><span>Adds so far: <b>${adds}</b>, so X should be <b>${X0} + ${adds} = ${should}</b></span><span class="chip ${st[0]}">${st[1]}</span></div>`;  // the truth card: adds so far, what X should be, and the verdict chip
          }  // ends paint()
          async function story() {  // story(): plays a fixed five-action story automatically, 1.1 seconds apart
            reset();  // starts from a clean state
            const my = token;  // my remembers this story's token; a reset or a new story changes the token and stops this one
            btns.forEach((b) => (b.disabled = true));  // disables the action buttons while the story plays
            for (const [i, op] of [[0, 'r'], [1, 'r'], [0, 'a'], [1, 'r'], [1, 'a']]) {  // the story: P1 reads, P2 reads, P1 adds 1, P2 reads, P2 adds 1
              await ctx.sleep(1100);  // waits 1.1 seconds between actions
              if (!ctx.alive || my !== token) return;  // stops if the student left the step or pressed Reset
              act(i, op);  // performs the next action
            }  // ends the story loop
            btns.forEach((b) => (b.disabled = false));  // re-enables the action buttons
          }  // ends story()
          const seg = ctx.ui.seg([{ value: 'off', label: 'No protocol' }, { value: 'inv', label: 'Invalidation (hardware)' }], proto, (v) => { proto = v; reset(); });  // seg: the protocol switch, no protocol or hardware invalidation; changing it resets the simulation
          [[0, 'r', 'P1 reads X'], [1, 'r', 'P2 reads X'], [0, 'a', 'P1: X = X + 1'], [1, 'a', 'P2: X = X + 1']].forEach(([i, op, label]) =>  // the four action buttons: each processor's read and add
            btns.push(h('button', { type: 'button', class: 'btn cpu', onclick: () => act(i, op) }, label)));  // each button calls act() with its processor and operation; they are kept in btns
          reset();  // sets up the starting state

          el.append(h('div', { class: 'split l fill' },  // page layout: two columns, the right one wider for the drawing
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: controls, truth card and narration
              h('p', { class: 'm0', html: 'Two processors share a variable <b>X</b>, which starts at 5 in memory. Each keeps its own copy in a <span class="t">private cache</span>. What goes wrong when one of them changes X?' }),  // intro: two processors share X, which starts at 5, each with a copy in its private cache
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'b small' }, 'Coherence:'), seg),  // the protocol switch with its label
              // one row per processor: its read, its add, then a story/reset control
              h('div', { class: 'grid-3', style: { gap: '8px' } }, btns[0], btns[2], h('button', { type: 'button', class: 'btn primary', onclick: () => story() }, '▶ Play the story'),  // a 3-column grid: P1's read and add with Play the story on the first row
                btns[1], btns[3], h('button', { type: 'button', class: 'btn', onclick: () => reset() }, 'Reset')),  // P2's read and add with Reset on the second row
              truth, narrCard),  // then the truth card and the narration card
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the drawing, the log and a callout
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg), logEl,  // the drawing in a white card, then the log
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters · handled in hardware', html: 'Stale copies make correct programs compute wrong answers. Hardware prevents it, commonly by <span class="t">bus snooping</span> with <span class="t">invalidation</span>: one processor’s write makes every other copy invalid, unseen by programs and the OS.' }))));  // callout: stale copies give wrong answers, and hardware prevents this with bus snooping and invalidation
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------------------------------------------------------- 7. Why multicore */
      {  // step 7: why chip makers switched to multicore
        title: 'Why chips went multicore: the power wall',  // step 7 title
        kind: 'explore',  // step kind "explore"
        render(el, ctx) {  // render(el, ctx): builds step 7 when it opens
          const { h, s } = ctx;  // h builds page elements and s builds SVG shapes
          const LIMIT = 64, YMAX = 128, FMIN = 1, FMAX = 5, BEST1 = 4;   // 1 core at 4 GHz sits exactly on the cooling limit
          const X0 = 60, X1 = 620, Y0 = 18, Y1 = 232;  // the plot area's edges inside the drawing: left, right, top and bottom
          const px = (f) => X0 + ((f - FMIN) / (FMAX - FMIN)) * (X1 - X0);  // px(f): converts a clock speed in GHz to an x position in the plot
          const py = (p) => Y1 - (Math.min(p, YMAX) / YMAX) * (Y1 - Y0);  // py(p): converts a power value to a y position, capping it at the top of the plot
          const power = (n, f) => n * f ** 3, work = (n, f) => n * f;  // the model: power grows with the cube of the clock speed for each core, while work grows only in step with it
          let n = 1, f = 3;  // n is the number of cores and f the clock speed in GHz chosen by the student
          const svg = s('svg', { viewBox: '0 0 640 274', width: '100%' });  // svg is the 640 by 274 power chart
          const clipId = 'sec18-plot-clip';  // clipId names the clipping region that keeps curves inside the plot
          const curve = s('path', { fill: 'none', stroke: 'var(--cpu)', 'stroke-width': 3, 'clip-path': `url(#${clipId})` });  // curve: the power curve for the current number of cores, clipped to the plot
          const ref = s('path', { fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'clip-path': `url(#${clipId})` });  // ref: a dashed grey curve for a single core, for comparison
          const refLab = s('text', { 'font-size': 13, class: 's-sub' }, '1 core');  // refLab: the "1 core" label on that curve
          const dot = s('circle', { r: 8, 'stroke-width': 3 });  // dot: a circle marking the chosen setting on the curve
          const dotLab = s('text', { 'font-size': 14, 'font-weight': 800 });  // dotLab: the label next to that dot
          const pathFor = (k) => { let d = ''; for (let x = FMIN; x <= FMAX + 1e-9; x += 0.05) d += (d ? 'L' : 'M') + px(x).toFixed(1) + ',' + (Y1 - (power(k, x) / YMAX) * (Y1 - Y0)).toFixed(1); return d; };  // pathFor(k): builds the curve's path for k cores by sampling power every 0.05 GHz from 1 to 5 GHz
          svg.append(  // fills the chart
            s('defs', {}, s('clipPath', { id: clipId }, s('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 }))),  // defines the clipping rectangle equal to the plot area
            s('rect', { x: X0, y: Y0, width: X1 - X0, height: py(LIMIT) - Y0, fill: 'var(--bad-bg)' }),  // a red-tinted band above the cooling limit
            s('text', { x: X0 + 10, y: Y0 + 20, 'font-size': 13.5, 'font-weight': 800, class: 'tx-bad' }, 'too hot to cool'),  // the "too hot to cool" label inside that band
            ...[0, 32, 64, 96, 128].map((v) => s('g', {}, s('line', { x1: X0 - 5, y1: py(v), x2: X1, y2: py(v), stroke: 'var(--line)', 'stroke-width': 1 }),  // horizontal grid lines at power 0, 32, 64, 96 and 128
              s('text', { x: X0 - 9, y: py(v) + 4.5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(v)))),  // their value labels on the left
            ...[1, 2, 3, 4, 5].map((v) => s('text', { x: px(v), y: Y1 + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, v + ' GHz')),  // clock speed labels under the plot, 1 to 5 GHz
            s('line', { x1: X0, y1: py(LIMIT), x2: X1, y2: py(LIMIT), stroke: 'var(--bad)', 'stroke-width': 2.5, 'stroke-dasharray': '8 5' }),  // the cooling limit: a dashed red line at power 64
            s('text', { x: X1 - 4, y: py(LIMIT) + 19, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 800, class: 'tx-bad' }, 'cooling limit (64)'),  // its label, "cooling limit (64)"
            s('line', { x1: X0, y1: Y0, x2: X0, y2: Y1, class: 's-line' }), s('line', { x1: X0, y1: Y1, x2: X1, y2: Y1, class: 's-line' }),  // the two axes
            s('text', { x: 14, y: (Y0 + Y1) / 2, 'font-size': 13, 'font-weight': 700, class: 's-sub', transform: `rotate(-90 14 ${(Y0 + Y1) / 2})`, 'text-anchor': 'middle' }, 'total power'),  // the vertical axis title "total power", turned on its side
            s('text', { x: (X0 + X1) / 2, y: 270, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'clock speed of each core'),  // the horizontal axis title "clock speed of each core"
            ref, refLab, curve, dot, dotLab);  // the curves, the dot and its label, added last so they sit on top
          /* ---- readouts */
          const workBar = h('i'), powBar = h('i');  // workBar and powBar are the fills of the two meters under the chart
          const workVal = h('b', { class: 'mono' }), powVal = h('b', { class: 'mono' });  // workVal and powVal show the two meters' numbers
          const verdict = h('div', { class: 'card tight grow', style: { minHeight: '76px', fontSize: '15px', lineHeight: '1.45' } });  // verdict is the card that explains whether the chosen design works
          function update() {  // update(): redraws the chart and meters for the current cores and speed; runs whenever a control changes
            const P = power(n, f), W = work(n, f), hot = P > LIMIT + 1e-9;  // P is total power, W total work, and hot is true when the power is over the cooling limit
            curve.setAttribute('d', pathFor(n));  // redraws the power curve for the current number of cores
            curve.setAttribute('stroke', hot ? 'var(--bad)' : 'var(--cpu)');  // the curve turns red when this design is too hot
            ref.style.display = refLab.style.display = n > 1 ? '' : 'none';  // the dashed single-core curve and its label appear only when more than one core is chosen
            ref.setAttribute('d', pathFor(1));  // draws the single-core power curve
            refLab.setAttribute('x', px(4.6)); refLab.setAttribute('y', py(4.6 ** 3) + 18);  // places the "1 core" label near that curve, at 4.6 GHz
            const cx = px(f), cy = py(P);  // cx, cy is where the chosen setting sits on the chart
            dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);  // moves the dot there
            dot.setAttribute('fill', hot ? 'var(--bad-bg)' : 'var(--ok-bg)'); dot.setAttribute('stroke', hot ? 'var(--bad)' : 'var(--ok)');  // the dot is green when the design is cool enough, red when too hot
            dotLab.textContent = `${n} core${n > 1 ? 's' : ''} @ ${f} GHz` + (P > YMAX ? ` (power ${ctx.util.fmt(P, 0)}, off the chart)` : '');  // the dot's label: cores and speed, plus the true power value if it is too high to fit on the chart
            // keep the label off the rising curve: upper-left on the right half, lower-right on the left half
            const right = cx > 400, off = P > YMAX, low = cy + 22 > Y1 - 8;  // right, off and low describe where the dot is, to decide where its label goes
            dotLab.setAttribute('x', right ? cx - 14 : cx + 14); dotLab.setAttribute('text-anchor', right ? 'end' : 'start');  // on the right half the label sits to the left of the dot; on the left half, to the right
            dotLab.setAttribute('y', off ? cy + 26 : right || low ? cy - 12 : cy + 22);  // the label goes below the dot when it is off the chart, above it on the right or near the bottom, otherwise below
            rows.forEach(([nn, ff], i) => rowEls[i].classList.toggle('on', nn === n && ff === f));  // highlights the table row that matches the chosen cores and speed, if any
            dotLab.setAttribute('class', hot ? 'tx-bad' : 'tx-ok');  // the label is red when too hot, green when cool
            workBar.style.width = Math.min(100, (W / 20) * 100) + '%';  // the work meter fills in proportion to work, where 20 fills it completely
            powBar.style.width = Math.min(100, (P / YMAX) * 100) + '%';  // the power meter fills in proportion to power, where 128 fills it completely
            powBar.style.background = hot ? 'var(--bad)' : 'var(--ok)';  // the power meter is red when over the limit, green otherwise
            workVal.textContent = `${n} × ${f} = ${ctx.util.fmt(W, 2)}`;  // work written as a sum, e.g. "4 × 2.5 = 10"
            powVal.textContent = `${n} × ${f}³ = ${ctx.util.fmt(P, 1)}`;  // power written as a sum, e.g. "4 × 2.5³ = 62.5"
            verdict.innerHTML = hot  // the verdict card's text
              ? `<b class="c-bad">Too hot.</b> ${ctx.util.fmt(P, 1)} units of power is over the cooling limit of 64. A real chip like this would overheat, or need cooling far beyond a normal fan and heat sink.`  // too hot: the power is over the cooling limit and a real chip would overheat
              : `<b class="c-ok">Fits the cooling budget</b> (${ctx.util.fmt(P, 1)} of 64).` + (n > 1 && W > BEST1  // cool enough: the power used out of 64
                ? ` Work rate ${ctx.util.fmt(W, 2)}: <b>${ctx.util.fmt(W / BEST1, 2)}×</b> the fastest single core that stays cool (1 core at 4 GHz, work rate 4).`  // with several cores doing more work than the best single core: how many times faster it is
                : n === 1 ? ' One core can go no faster than 4 GHz before it crosses the limit. Now try several slower cores.' : ' Push the clock or add cores to use the rest of the budget.');  // with one core: it cannot pass 4 GHz, so try several slower cores; otherwise suggest using the rest of the budget
          }  // ends update()
          const sf = ctx.ui.slider({ label: 'Clock speed', min: 1, max: 5, step: 0.25, value: f, format: (v) => v.toFixed(2) + ' GHz', onInput: (v) => { f = v; update(); } });  // slider for the clock speed, 1 to 5 GHz in quarter steps; moving it redraws
          const sn = ctx.ui.slider({ label: 'Cores', min: 1, max: 8, step: 1, value: n, onInput: (v) => { n = v; update(); } });  // slider for the number of cores, 1 to 8; moving it redraws
          // four designs worth comparing; clicking a row loads it into the sliders
          const rows = [[1, 4], [1, 5], [4, 2.5], [8, 2]];  // rows: four designs to compare, as cores and clock speed
          const rowEls = rows.map(([nn, ff]) => { const P = power(nn, ff), ok = P <= LIMIT;  // builds one table row per design; P is its power and ok says whether it fits under the limit
            return h('tr', { role: 'button', tabindex: 0, class: 'pick', onclick: () => { n = nn; f = ff; sn.set(nn); sf.set(ff); update(); },  // a clickable row: clicking loads its cores and speed into the sliders and redraws
              onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } } },  // pressing Enter or Space on a focused row acts like a click
              h('td', { class: 'b' }, `${nn} core${nn > 1 ? 's' : ''} @ ${ff} GHz`), h('td', { class: 'mono' }, String(nn * ff)), h('td', { class: 'mono' }, String(P)),  // the row's cells: the design, its work and its power
              h('td', { html: ok ? '<span class="c-ok b">✓ cool</span>' : '<span class="c-bad b">✗ too hot</span>' })); });  // and whether it fits: cool or too hot
          const tbl = h('table', { class: 'tbl compact' }, h('tr', {}, h('th', {}, 'Try a design (click)'), h('th', {}, 'Work'), h('th', {}, 'Power'), h('th', {}, 'Fits?')), ...rowEls);  // the table: a header row and the four design rows
          update();  // draws everything for the starting setting

          el.append(h('div', { class: 'split l fill' },  // page layout: two columns, the right one wider for the chart
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation and the controls
              h('p', { class: 'm0', html: 'For decades each new chip got faster largely by raising its <span class="t">clock speed</span>. In the mid-2000s that road hit the <span class="t">power wall</span> (met in 1.2): faster chips ran too hot to cool.' }),  // paragraph: chips used to get faster by raising the clock, until they hit the power wall
              h('p', { class: 'm0 small', html: 'A faster clock needs a higher voltage too, so a core’s power grows roughly with the <b>cube</b> of its clock speed, but its work only in step with the clock. Simplified model: 1 core at 1 GHz = 1 unit of power and 1 unit of work (real chips cannot lower voltage forever, so very slow cores save less than this).' }),  // paragraph: power grows about with the cube of the clock speed, while work grows only in step, with the model's units
              h('div', { class: 'card tight stack', style: { gap: '8px' } }, sf, sn), tbl, verdict),  // a card with the two sliders, then the design table and the verdict
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the chart, meters and callouts
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg),  // the chart in a white card
              h('div', { class: 'card tight stack', style: { gap: '6px' } },  // a card holding the two meters
                h('div', { class: 'meterrow' }, h('span', { class: 'b small' }, 'Work rate'), h('div', { class: 'meter' }, workBar), h('span', { class: 'small' }, workVal)),  // meter row: work rate
                h('div', { class: 'meterrow' }, h('span', { class: 'b small' }, 'Power'), h('div', { class: 'meter lim' }, powBar), h('span', { class: 'small' }, powVal))),  // meter row: power, with the red limit line at its middle
              h('div', { class: 'grid-2', style: { gap: '10px' } },  // two callouts side by side
                h('div', { class: 'callout why m0 small', 'data-label': 'Where the transistors went', html: 'Transistor counts kept growing after clock speeds stalled. Designers spent them on <b>more cores</b> and <b>bigger caches</b>, like the 8 cores and 20 MB L3 of the Core i7-5960X.' }),  // callout: spare transistors went into more cores and bigger caches, as on the Core i7-5960X
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'More cores do not speed up one program by themselves. The work must be split into pieces that can run at once, and the OS must spread them over the cores (see 4.3).' })))));  // common-mistake callout: more cores do not speed up one program unless its work is split and spread over them
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------------------------------------------------------- 8. Recap */
      {  // step 8: recap flip cards
        title: 'Recap: eight ideas to carry away',  // step 8 title
        kind: 'recap',  // step kind "recap": a summary step
        render(el, ctx) {  // render(el, ctx): builds the recap when the step opens
          const { h } = ctx;  // h builds page elements
          el.append(h('div', { class: 'stack fill' },  // a vertical stack filling the step
            h('p', { class: 'lead m0' }, 'Click each card to flip it. Try to say the answer out loud before you look.'),  // instruction: flip each card, and try to say the answer out loud first
            ctx.ui.flipcards([  // the flip cards: the front shows a prompt, the back its answer
              ['Three ways to use many processors', '<b>SMP</b>: separate processor chips sharing memory. <b>Multicore</b>: several cores on one chip. <b>Cluster</b>: whole computers linked by a network.'],  // flip card: the three ways to use many processors
              ['What makes an SMP symmetric?', 'Similar processors share one memory and the I/O devices, <b>any of them can do any job</b>, and one integrated OS controls them all.'],  // flip card: what makes an SMP symmetric
              ['Four payoffs of an SMP', '<b>Performance</b>, <b>availability</b>, <b>incremental growth</b> and <b>scaling</b>. The OS keeps the extra processors transparent to users.'],  // flip card: the four payoffs of an SMP
              ['How do the processors talk to each other?', 'Through <b>shared main memory</b>: one writes a value, another reads it. The shared bus carries all traffic between processors, memory and I/O.'],  // flip card: how processors talk to each other, through shared memory
              ['What does each processor or core own?', 'Its own control unit, ALU, registers and pipeline, plus <b>private caches</b> (L1, often L2). Memory, I/O and any L3 are <b>shared</b>.'],  // flip card: what each processor or core owns and what is shared
              ['The cache coherence problem', 'A write by one processor can leave <b>stale copies</b> in other caches. Hardware fixes it, for example by snooping and <b>invalidating</b> other copies.'],  // flip card: the cache coherence problem and its hardware fix
              ['Why did chips go multicore?', 'Higher clock speeds hit the <b>power wall</b>: power rises about with the cube of the clock. Spare transistors went into more cores and bigger caches.'],  // flip card: why chips went multicore
              ['Core i7-5960X in one breath', '<b>8 x86 cores</b>, a dedicated 256 KB L2 each, a <b>shared 20 MB L3</b>, and an on-chip DDR4 memory controller and PCI Express.'],  // flip card: the Core i7-5960X in one breath
            ].map(([f, b]) => [f, `<span style="font-size:15.5px">${b}</span>`]), { cols: 4, height: 182 }),   // one wrapper span: the card face is a flex box, so bare <b> tags would become separate columns
            h('div', { class: 'callout tip m0', 'data-label': 'Where this goes next', html: 'This section showed the hardware. Section 2.6 shows how an OS is designed to run on it, and 4.3 shows how much faster software really gets as cores are added.' })));  // callout: where this goes next, later sections on OS design for multiprocessors and on real speed-ups
        },  // ends render() for step 8
      },  // ends step 8
      /* ---------------------------------------------------------------- 9. Check yourself */
      {  // step 9: the end-of-section quiz
        title: 'Check yourself: multiprocessors and multicore',  // step 9 title
        kind: 'check',  // step kind "check": a self-test step
        quiz: [  // the quiz questions; the guide's quiz engine draws them, checks answers and shows explanations
          { q: 'Which description fits a <b>symmetric multiprocessor (SMP)</b>?',  // question 1 (multiple choice): which description fits an SMP
            choices: ['One processor runs the OS and hands out work; the other processors may only run user programs.',  // wrong choice: a boss processor with helpers, the opposite of symmetric
              'Two or more similar processors share main memory and the I/O devices, any of them can perform any function, and one integrated OS controls them all.',  // right choice: similar processors sharing memory and I/O, all able to do any job, under one OS
              'Several complete computers, each with its own memory and OS, cooperate over a network.',  // wrong choice: describes a cluster
              'One very fast processor with a large cache that many programs take turns using.'],  // wrong choice: describes a uniprocessor
            answer: 1,  // the correct choice is the second one (counting from 0)
            feedback: ['That boss-and-helpers design is the opposite of symmetric. In an SMP no processor is special: any of them can run the OS.', null,  // feedback for the wrong choices: boss-and-helpers is not symmetric
              'That is a cluster. An SMP is one computer whose processors share a single main memory.', 'That is a uniprocessor: only one processor, however fast.'],  // more feedback: that is a cluster, and that is a uniprocessor
            why: 'An SMP is one computer with similar processors that share memory and I/O, can all do the same jobs, and run under one integrated operating system.' },  // explanation: the defining features of an SMP
          { type: 'tf', q: 'In an SMP, users must tell the system which processor each of their programs should run on.', answer: false,  // question 2 (true or false): users must choose each program's processor; the answer is false
            why: 'The OS schedules processes and threads across the processors by itself. The existence of several processors is transparent to users; they just see work finish sooner.' },  // explanation: the OS schedules the work, so the processors are transparent to users
          { type: 'multi', q: 'On the Intel Core i7-5960X (8 cores on one die), which of these is there <b>just one of</b>, shared by all eight cores? Select all that apply.',  // question 3 (select all): which parts of the Core i7-5960X exist only once, shared by all eight cores
            choices: ['The 20 MB L3 cache', 'The integrated DDR4 memory controller', 'The PCI Express lanes that connect fast devices',  // choices: the L3, the memory controller and the PCI Express lanes
              'The 256 KB L2 cache', 'The L1 data cache', 'The control unit'],  // more choices: the L2, the L1 data cache and the control unit, which each core has its own of
            answer: [0, 1, 2],  // the correct choices are the first three
            why: 'Each core owns its control unit, ALU, registers, pipeline, L1 caches and a dedicated 256 KB L2 (8 × 256 KB = 2 MB of L2 in all, but no core can use another’s). The 20 MB L3, the memory controller and the PCI Express lanes exist once on the die and serve every core.' },  // explanation: what each core owns, and the three parts shared across the die
          { type: 'bucket', q: 'Sort each situation by the SMP advantage it shows.', buckets: ['Performance', 'Availability', 'Incremental growth', 'Scaling'],  // question 4 (sort into groups): sort situations by the SMP advantage they show
            items: [['Four customer requests are handled at the same moment on four processors', 0], ['A server keeps working after one of its processors burns out', 1],  // situations: four requests at once (performance), and a server surviving a burnt-out processor (availability)
              ['An admin installs a second processor in an empty socket instead of buying a new server', 2], ['A vendor sells one server design in 2-, 4- and 8-processor models', 3],  // situations: adding a processor to an empty socket (growth), and one design sold in several sizes (scaling)
              ['A faulty processor is taken out of service and users notice no outage', 1]],  // situation: a faulty processor removed with no outage (availability)
            why: 'Performance = more work at once. Availability = surviving a failure. Incremental growth = upgrading the machine you have. Scaling = a product range built from different processor counts.' },  // explanation: one-line meaning of each advantage
          { q: 'In a classic SMP, why does a memory access take about the same time no matter which processor makes it?',  // question 5 (multiple choice): why a memory access takes about the same time from any processor in an SMP
            choices: ['All processors reach one shared main memory over the same interconnection, so none sits closer to memory than the others.',  // right choice: all processors reach one shared memory over the same interconnection
              'Each processor has its own private main memory of the same size.', 'The OS copies all of main memory into every processor’s cache.', 'Only one processor runs at a time, so they never compete for memory.'],  // wrong choices: a private memory per processor, the OS copying memory into caches, and only one processor running at a time
            answer: 0,  // the correct choice is the first one
            feedback: [null, 'Private memories per processor describe a cluster, not an SMP. SMP processors share one memory.',  // feedback for the wrong choices: private memories describe a cluster
              'Caches hold only small, recently used pieces of memory, and the hardware, not the OS, fills them.', 'All the processors in an SMP run at the same time; that is the whole point.'],  // more feedback: caches hold small pieces filled by hardware, and all SMP processors run at once
            why: 'The processors share a single memory through a bus or other interconnection scheme, so every processor has roughly the same path to it and the same access time.' },  // explanation: one shared memory through one interconnection gives every processor the same path and access time
          { type: 'match', q: 'Match each part of a multicore chip with its description.',  // question 6 (match the pairs): parts of a multicore chip and their descriptions
            pairs: [['Core', 'A complete processor: control unit, ALU, registers, pipeline and L1 caches'], ['L1 cache', 'The smallest, fastest cache, private to one core'],  // pairs: core with a complete processor, and L1 cache with the smallest private cache
              ['Shared L3 cache', 'A large on-chip cache used by all the cores'], ['Die', 'The single piece of silicon that holds all the cores'],  // pairs: shared L3 with the large on-chip cache, and die with the single piece of silicon
              ['Integrated memory controller', 'On-chip circuitry that drives the main-memory modules']],  // pair: the integrated memory controller with the circuitry that drives memory
            why: 'Each core is a full processor with private L1 (and often L2) caches; a larger L3 on the same die is shared; the memory controller built onto the chip talks to main memory.' },  // explanation: how the core, its caches, the shared L3 and the memory controller fit together
          { q: 'Processors P1 and P2 each hold a copy of X = 5 in their private caches. P1 changes X to 6, and the new value is also written to main memory. There is <b>no</b> cache coherence mechanism, and P2’s old copy is still in its cache. What does P2 get when it next reads X?',  // question 7 (multiple choice): with no coherence, what P2 reads after P1 changes X from 5 to 6
            choices: ['6, because main memory now holds 6', '5, the stale copy in its own cache', 'An error, because two different copies of X exist', 'Nothing: P2 must wait until P1 releases X'],  // choices: 6 from memory, the stale 5 from its own cache (correct), an error, or waiting for P1
            answer: 1,  // the correct choice is the second one
            feedback: ['Memory does hold 6, but P2 finds X in its own cache (a hit) and never looks at memory.', null,  // feedback: P2 hits in its own cache and never looks at memory
              'The hardware raises no error; that silence is what makes stale data so dangerous.', 'Caches do not lock data; without coherence nothing makes P2 wait or refetch.'],  // more feedback: the hardware raises no error and caches do not lock data
            why: 'P2’s read hits in its own cache and returns the old value 5. Keeping every cached copy consistent is the cache coherence problem, and hardware usually solves it.' },  // explanation: the read hits and returns the old value, which is the cache coherence problem
          { type: 'order', q: 'Put these events in order for a machine that keeps caches coherent by invalidation.',  // question 8 (put in order): the events when caches stay coherent by invalidation
            items: ['P1 and P2 both read X = 5 into their private caches', 'P1 executes a write of X = 6', 'That write sends an “invalidate X” message over the shared bus',  // steps 1-3: both caches read X, P1 writes X, and the write sends "invalidate X" on the bus
              'P2’s snooping cache controller marks its copy of X invalid', 'P2 reads X, misses, and fetches the new value 6'],  // steps 4-5: P2's snooping controller invalidates its copy, then P2's next read misses and gets 6
            why: 'Both caches load X; P1’s write puts an invalidate on the bus; P2’s snooping controller sees it and invalidates its copy; P2’s next read misses and gets the fresh value.' },  // explanation: the same five events in one sentence
          { type: 'tf', q: 'In an SMP, only one designated processor may run operating-system code; the rest run application programs.', answer: false,  // question 9 (true or false): only one processor may run operating-system code in an SMP; the answer is false
            why: 'That would be an asymmetric (master/slave) design. In an SMP every processor can perform the same functions, including running the kernel. That is what “symmetric” means.' },  // explanation: that is an asymmetric design; in an SMP every processor can run the kernel
          { q: 'In the simple power model (power grows with the cube of the clock speed, work in proportion to it), a chip with one 4 GHz core is replaced by a chip with eight 2 GHz cores; both use 64 units of power. An old program that is one single stream of instructions, never split into parts, runs on the new chip. What happens to its speed?',  // question 10 (multiple choice): what happens to an unsplit single-stream program moved from one 4 GHz core to eight 2 GHz cores
            choices: ['It runs about half as fast: it can use only one core, and that core’s clock is half as fast.',  // right choice: it runs about half as fast, using one core at half the clock
              'It runs 4 times as fast, because the new chip does 16 units of work instead of 4.', 'It runs at the same speed, because the OS automatically splits every program across the cores.', 'It cannot run at all until it is rewritten for a multicore chip.'],  // wrong choices: 4 times as fast, the same speed through automatic splitting, or not able to run at all
            answer: 0,  // the correct choice is the first one
            feedback: [null, 'That is the whole chip’s capacity. One stream of instructions runs on one core at a time, so the other seven cores do nothing for this program.', 'The OS can place separate programs or threads on separate cores, but it cannot cut one sequential stream of instructions into parallel pieces by itself.',  // feedback: 16 units is the whole chip's capacity, and the OS cannot split one sequential stream by itself
              'It runs fine on any one of the cores; it simply cannot use the other seven.'],  // more feedback: it runs fine on any one core but cannot use the other seven
            why: 'One stream of instructions runs on one core at a time, and in this model a 2 GHz core does half the work per second of a 4 GHz core. The chip’s extra capacity (16 units of work instead of 4) pays off only when the work is split into pieces the OS can spread over the cores (see 4.3).' },  // explanation: one stream uses one core, so the extra capacity helps only when the work is split up
          { type: 'num', q: 'In a simple power model, a core’s power grows with the <b>cube</b> of its clock speed, while its work rate grows in proportion to its clock speed. One core running at 4 GHz uses 64 units of power. How many units of power does a chip with <b>4 cores at 2 GHz</b> use?', answer: 32, tol: 0, unit: 'units',  // question 11 (calculate): power used by 4 cores at 2 GHz when 1 core at 4 GHz uses 64; answer 32
            why: '64 = 4³, so in this model 1 GHz costs 1 unit. Each 2 GHz core uses 2³ = 8 units, and 4 cores use 4 × 8 = 32: half the power of the single 4 GHz core, yet they do 4 × 2 = 8 units of work, twice as much, provided the software keeps all four cores busy.' },  // explanation: each 2 GHz core uses 8 units, so 4 of them use 32, half the power for twice the work
          { type: 'num', q: 'An SMP’s OS spreads 12 independent jobs, each needing 4 seconds of processor time, over 3 identical processors. If every processor stays busy, how many seconds until all the jobs are done?', answer: 16, tol: 0, unit: 's',  // question 12 (calculate): time for 12 jobs of 4 seconds on 3 busy processors; answer 16 seconds
            why: 'Total work = 12 × 4 = 48 seconds. Shared by 3 processors, that is 48 ÷ 3 = 16 seconds (each processor runs 4 jobs). One processor alone would need 48 seconds.' },  // explanation: 48 seconds of total work divided among 3 processors
        ],  // closes the quiz question list
      },  // ends step 9
    ],  // closes the list of steps
    notes: `${/* start of the section notes: a full written summary the student opens with the Notes button (or the N key) */''}
<h3>1. Why use more than one processor?</h3>${/* notes heading for part 1: why use more than one processor */''}
<p>A <b>uniprocessor</b> has exactly one processor, so it follows one stream of instructions at a time. <b>Parallel processing</b> means doing several pieces of work at the same moment on separate processors. Three common designs:</p>${/* notes paragraph: uniprocessor versus parallel processing, leading into the three designs */''}
<table>${/* start of the table comparing the three designs */''}
    <tr><th>Design</th><th>Where the processors are</th><th>Shared main memory?</th><th>Operating system</th></tr>${/* table header: design, where the processors are, shared memory, and operating system */''}
    <tr><td><b>Symmetric multiprocessor (SMP)</b></td><td>separate processor chips (one per socket) in one computer</td><td>yes, one memory</td><td>one integrated OS for all</td></tr>${/* table row: SMP */''}
    <tr><td><b>Multicore computer</b> (chip multiprocessor)</td><td>several cores on a single chip (one die)</td><td>yes, one memory</td><td>one integrated OS for all</td></tr>${/* table row: multicore computer */''}
    <tr><td><b>Cluster</b> (only mentioned here)</td><td>separate complete computers linked by a fast network</td><td>no, each has its own and they exchange messages</td><td>one copy per computer</td></tr>${/* table row: cluster */''}
</table>${/* end of the designs table */''}
<p>The ideas combine: a server with two 8-core chips is an SMP with 16 cores.</p>${/* notes paragraph: the designs combine, e.g. two 8-core chips make a 16-core SMP */''}

<h3>2. The five marks of an SMP</h3>${/* notes heading for part 2: the five marks of an SMP */''}
<ol>${/* start of the numbered list of marks */''}
    <li><b>Two or more similar processors</b> of comparable capability (same kind, roughly the same speed), so the OS can treat them as interchangeable.</li>${/* mark 1: two or more similar processors */''}
    <li>They <b>share the same main memory</b> and I/O facilities, connected by a bus or other interconnection scheme, so a memory access takes <b>about the same time</b> whichever processor makes it.</li>${/* mark 2: shared main memory and I/O facilities, with about equal access time */''}
    <li>They <b>share access to the I/O devices</b>, either over the same paths or over different paths that lead to the same device.</li>${/* mark 3: shared access to the I/O devices */''}
    <li><b>All processors can perform the same functions</b>: run user programs, run OS code, handle interrupts. This equality is why the design is called <b>symmetric</b>.</li>${/* mark 4: all processors can perform the same functions, which is why it is called symmetric */''}
    <li>The system is controlled by <b>one integrated operating system</b> that lets the processors and their programs cooperate at the level of jobs, tasks, files and individual data elements.</li>${/* mark 5: one integrated operating system coordinating jobs, tasks, files and data elements */''}
</ol>${/* end of the marks list */''}
<p><b>Common mistake:</b> “symmetric” does not mean running one program in lockstep. It means no processor is special; a design where one boss processor alone runs the OS is asymmetric.</p>${/* notes paragraph: the common mistake about the word "symmetric" */''}

<h3>3. Advantages of an SMP over a uniprocessor</h3>${/* notes heading for part 3: advantages of an SMP */''}
<ul>${/* start of the list of advantages */''}
    <li><b>Performance</b>: if work can be split into parts, they run at the same moment on different processors, so more gets done per second.</li>${/* advantage: performance */''}
    <li><b>Availability</b>: since all processors can do the same jobs, one failure does not halt the machine; the others carry on, more slowly. A uniprocessor has no spare.</li>${/* advantage: availability */''}
    <li><b>Incremental growth</b>: the owner can make the system stronger by adding a processor to the existing machine instead of replacing it.</li>${/* advantage: incremental growth */''}
    <li><b>Scaling</b>: a vendor can offer a range of products at different prices and performance levels by building them with different numbers of processors.</li>${/* advantage: scaling */''}
</ul>${/* end of the advantages list */''}
<p>The multiple processors are <b>transparent</b> to the user: nobody chooses a processor. The OS schedules processes and threads across all the processors and synchronizes them when they share data. A program only speeds up if its work can really be divided (see 4.3).</p>${/* notes paragraph: the processors are transparent to users because the OS schedules and synchronises them */''}
<p><b>Worked example.</b> 12 independent jobs each need 4 s of processor time: total work 12 × 4 = 48 s. One processor needs 48 s. With 2 processors kept busy the jobs finish in 48 ÷ 2 = 24 s; with 3, in 16 s; with 4, in 12 s. If one of 2 processors fails, its unfinished job is requeued and the survivor finishes everything, just later.</p>${/* notes paragraph: the worked example of 12 jobs on 1 to 4 processors, and what happens after a failure */''}
<h3>4. How an SMP is organized</h3>${/* notes heading for part 4: how an SMP is organised */''}
<ul>${/* start of the list about SMP organisation */''}
    <li>Each processor is <b>self-contained</b>: its own control unit, ALU, registers and pipeline, plus one or two levels of <b>private cache</b> (L1, often L2).</li>${/* organisation point: each processor is self-contained with private caches */''}
    <li>The processors reach <b>one shared main memory</b> and the <b>I/O subsystem</b> over a <b>shared system bus</b>. The bus is simple but carries one transfer at a time, so processors sometimes wait for it.</li>${/* organisation point: one shared memory and I/O over a shared bus that carries one transfer at a time */''}
    <li>Because every processor sees the same memory, processors can <b>communicate through memory</b>: one writes a value into a shared location, another reads it.</li>${/* organisation point: processors communicate through shared memory */''}
</ul>${/* end of the organisation list */''}

<h3>5. The cache coherence problem</h3>${/* notes heading for part 5: the cache coherence problem */''}
<p>Private caches create copies that other processors cannot see. Suppose X = 5 and both P1 and P2 have cached X. P1 writes X = 6 (also written through to memory), but P2’s cache still says 5, so P2’s next read <b>hits</b> in its own cache and returns the <b>stale</b> value 5. The table follows the story on.</p>${/* notes paragraph: how private caches lead to a stale read of X */''}
<p><b>Cache coherence</b> means keeping every cached copy of the same data consistent. It is solved <b>in hardware</b>, invisibly to programs and the OS. A common method is <b>bus snooping</b> with <b>invalidation</b>: every cache controller watches the shared bus; when one processor writes X, an “invalidate X” message makes every other cache mark its copy (the whole cache line) invalid, so the next read of X misses and fetches the fresh value.</p>${/* notes paragraph: what cache coherence means, and how bus snooping with invalidation solves it in hardware */''}
<p><b>Coherence is not mutual exclusion.</b> It keeps copies consistent but does not make X = X + 1 indivisible: if two processors interleave their read and write steps, an update can still be lost (a race condition, cured in Chapter 5).</p>${/* notes paragraph: coherence is not mutual exclusion, so an update can still be lost in a race */''}
<table>${/* start of the table that follows the X story with and without invalidation */''}
    <tr><th>Event</th><th>No protocol</th><th>With invalidation</th></tr>${/* table header: event, no protocol, with invalidation */''}
    <tr><td>P1 reads X, P2 reads X</td><td>both caches hold 5</td><td>both caches hold 5</td></tr>${/* table row: both processors read X */''}
    <tr><td>P1 adds 1</td><td>P1 and memory hold 6; P2 still holds 5 (stale)</td><td>P1 and memory hold 6; P2’s copy is invalidated</td></tr>${/* table row: P1 adds 1 */''}
    <tr><td>P2 reads X</td><td>hit: gets 5 (wrong)</td><td>miss: fetches 6</td></tr>${/* table row: P2 reads X */''}
    <tr><td>P2 adds 1</td><td>writes 6: an update is lost</td><td>writes 7 (correct); P1’s copy is invalidated</td></tr>${/* table row: P2 adds 1, with the lost update on the left */''}
</table>${/* end of the coherence table */''}

<h3>6. Multicore computers</h3>${/* notes heading for part 6: multicore computers */''}
<p>A <b>multicore computer</b>, or <b>chip multiprocessor</b>, puts two or more processors, called <b>cores</b>, on a single piece of silicon, the <b>die</b>. Each core has its own registers, ALU, pipeline, control unit and L1 caches (the smallest, fastest level, often split into L1-I for instructions and L1-D for data). There is usually an L2 cache per core, and often an L3 cache that all the cores <b>share</b>. To the OS each core looks like a separate processor, so a multicore chip works much like a small SMP.</p>${/* notes paragraph: what a multicore chip is, what each core owns, and which caches are shared */''}
<p><b>Why multicore?</b> For decades each new chip got faster largely by raising its <b>clock speed</b>. A faster clock also needs a higher voltage, so power, and therefore heat, rises far faster than speed: in a simple model a core’s power grows with the <b>cube</b> of its clock speed while its work grows only in proportion to it. In the mid-2000s this <b>power wall</b> stopped clock growth. Transistor counts kept rising, so designers spent the extra transistors on <b>more cores and bigger caches</b>.</p>${/* notes paragraph: why multicore, the power wall and the cube rule */''}
<p><b>Worked example (model: 1 core at 1 GHz = 1 unit of power and 1 of work; cooling limit 64).</b> 1 core at 4 GHz: power 4³ = 64 (at the limit), work 4. 1 core at 5 GHz: power 125, too hot. 4 cores at 2 GHz: power 4 × 8 = 32, work 8. 4 cores at 2.5 GHz: power 4 × 15.625 = 62.5, work 10 (2.5 times the best cool single core). 8 cores at 2 GHz: power 64, work 16. The gain needs software that keeps every core busy: a program that is one single stream of instructions runs on only one core, so on the 8 × 2 GHz chip it runs at half the speed it had on one 4 GHz core. Also, real voltages cannot drop forever, so slow cores save less than the model says.</p>${/* notes paragraph: the power model's worked example and its limits */''}

<h3>7. A real example: Intel Core i7-5960X (2014)</h3>${/* notes heading for part 7: the Intel Core i7-5960X */''}
<ul>${/* start of the list of chip facts */''}
    <li><b>Eight x86 cores</b> on one die; each core has its own L1 caches (32 KB instructions + 32 KB data).</li>${/* chip fact: eight x86 cores, each with its own two 32 KB L1 caches */''}
    <li>Each core has a <b>dedicated 256 KB L2 cache</b> (8 × 256 KB = 2 MB in all, but each core uses only its own).</li>${/* chip fact: a dedicated 256 KB L2 per core */''}
    <li>All eight cores <b>share a 20 MB L3 cache</b>.</li>${/* chip fact: a shared 20 MB L3 */''}
    <li>An <b>integrated memory controller</b> for DDR4 main memory (four channels) and <b>PCI Express</b> lanes for fast devices (graphics cards, SSDs) are built onto the chip.</li>${/* chip fact: the on-chip memory controller and PCI Express lanes */''}
    <li>Private per core: control unit, ALU, registers, pipeline, L1s, L2. One per chip, shared by all cores: L3, memory controller, PCIe lanes.</li>${/* chip fact: summary of what is private per core and what is shared */''}
</ul>${/* end of the chip facts list */''}
`,  // end of the notes text
  });  // closes the section definition passed to Guide.section()
})();  // closes and immediately runs the wrapper function that holds this whole file
