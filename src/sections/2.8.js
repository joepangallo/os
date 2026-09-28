/* Section 2.8 Traditional Unix Systems
   Original teaching material. Built step by step.
   Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {
  /* ------------------------------------------------------------------ shared helper
     The traditional UNIX kernel as a block diagram (viewBox 600 x 502), used by the
     "inside the kernel" step and the read() trace. draw(state) repaints from scratch:
       state.sel      id of the clicked block (thick outline)
       state.active   id of the block the trace is at (highlighted)
       state.visited  Set of ids already passed (kept normal; others dimmed while tracing)
       state.flash    { id: 'ok' | 'bad' | 'warn' } colouring for the games and the prediction
       state.token    id where the moving dot sits, or null
       state.noPick   true: blocks are not clickable in this drawing               */
  const KB = {
    user: { r: [70, 20, 180, 44], cls: 's-proc', t: ['User programs'] },
    lib: { r: [370, 20, 180, 44], cls: 's-panel', t: ['Libraries'] },
    sci: { r: [46, 124, 534, 36], cls: 's-accent', t: ['System call interface'] },
    fs: { r: [46, 194, 224, 44], cls: 's-io', t: ['File subsystem'] },
    bc: { r: [120, 268, 150, 36], cls: 's-mem', t: ['Buffer cache'] },
    chr: { r: [46, 334, 94, 48], cls: 's-io', t: ['Character', 'drivers'] },
    blk: { r: [152, 334, 118, 48], cls: 's-io', t: ['Block', 'drivers'] },
    pcs: { r: [316, 178, 264, 188], cls: 's-proc', t: ['Process control subsystem'], box: true },
    ipc: { r: [332, 212, 232, 38], cls: 's-panel', t: ['IPC and synchronization'], inner: true },
    sch: { r: [332, 262, 232, 38], cls: 's-panel', t: ['Scheduler'], inner: true },
    mm: { r: [332, 312, 232, 38], cls: 's-panel', t: ['Memory management'], inner: true },
    hwc: { r: [46, 402, 534, 34], cls: 's-os', t: ['Hardware control'] },
    hw: { r: [46, 458, 534, 36], cls: 's-cpu', t: ['Hardware'], sub: 'processor · memory · disks · terminals' },
  };
  const KB_ORDER = ['user', 'lib', 'sci', 'fs', 'bc', 'chr', 'blk', 'pcs', 'ipc', 'sch', 'mm', 'hwc', 'hw'];
  const KB_ARROWS = [ // x1, y1, x2, y2
    [250, 42, 366, 42], [160, 64, 160, 120], [460, 64, 460, 120],
    [158, 160, 158, 190], [448, 160, 448, 174],
    [270, 209, 312, 209], [316, 224, 274, 224],
    [195, 238, 195, 264], [211, 304, 211, 330], [80, 238, 80, 330],
    [93, 382, 93, 398], [211, 382, 211, 398], [448, 366, 448, 398],
    [305, 436, 305, 454], [321, 458, 321, 440],
  ];
  /* the same diagram re-laid for phones (viewBox 360 x 540): same blocks and arrows, a narrower grid,
     so labels stay about 13 px on a 390 px screen instead of shrinking to 8 px */
  const KBN = {
    user: { r: [30, 14, 150, 42], cls: 's-proc', t: ['User programs'] },
    lib: { r: [198, 14, 150, 42], cls: 's-panel', t: ['Libraries'] },
    sci: { r: [30, 104, 318, 36], cls: 's-accent', t: ['System call interface'] },
    fs: { r: [30, 172, 136, 40], cls: 's-io', t: ['File subsystem'] },
    bc: { r: [60, 234, 106, 36], cls: 's-mem', t: ['Buffer cache'] },
    chr: { r: [30, 296, 78, 48], cls: 's-io', t: ['Character', 'drivers'] },
    blk: { r: [114, 296, 66, 48], cls: 's-io', t: ['Block', 'drivers'] },
    pcs: { r: [192, 166, 156, 208], cls: 's-proc', t: ['Process control', 'subsystem'], box: true },
    ipc: { r: [201, 212, 138, 46], cls: 's-panel', t: ['IPC and', 'synchronization'], inner: true },
    sch: { r: [201, 266, 138, 40], cls: 's-panel', t: ['Scheduler'], inner: true },
    mm: { r: [201, 314, 138, 46], cls: 's-panel', t: ['Memory', 'management'], inner: true },
    hwc: { r: [30, 404, 318, 34], cls: 's-os', t: ['Hardware control'] },
    hw: { r: [30, 474, 318, 56], cls: 's-cpu', t: ['Hardware'], sub: 'processor · memory · disks · terminals' },
  };
  const KBN_ARROWS = [
    [180, 35, 194, 35], [105, 56, 105, 100], [273, 56, 273, 100],
    [98, 140, 98, 168], [270, 140, 270, 162],
    [166, 184, 188, 184], [192, 200, 170, 200],
    [120, 212, 120, 230], [147, 270, 147, 292], [44, 212, 44, 292],
    [69, 344, 69, 400], [147, 344, 147, 400], [270, 374, 270, 400],
    [180, 438, 180, 470], [196, 474, 196, 442],
  ];
  function kernelDiagram(ctx, onPick) {
    const { s } = ctx;
    const NW = ctx.narrow, G = NW ? KBN : KB;
    const kbSpot = (id) => { const [x, y, w] = G[id].r; return [x + w - 8, y + 6]; };   // the token rides on the block's top-right corner
    const svg = s('svg', { viewBox: NW ? '0 0 360 540' : '0 0 600 502', width: '100%', role: 'img', 'aria-label': 'Traditional UNIX kernel block diagram' });
    const base = s('g', {});
    const tok = s('circle', { class: 'tok', cx: 0, cy: 0, r: 10, style: 'fill:var(--accent);stroke:var(--panel);stroke-width:3;opacity:0' });
    svg.append(base, tok);
    const region = (x, y, w, hh, col) => s('rect', { x, y, width: w, height: hh, rx: 12, fill: 'none', style: `stroke:var(--${col})`, 'stroke-width': 1.5, 'stroke-dasharray': '6 5' });
    const side = (x, y, t) => s('text', { x, y, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.1em', transform: `rotate(-90 ${x} ${y})` }, t);
    const trap = (x, y) => s('text', { x, y, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, 'trap');
    function draw(st = {}) {
      const tracing = !!st.visited;
      const k = NW
        ? [region(22, 4, 334, 62, 'line-2'), region(22, 74, 334, 372, 'os'), side(11, 35, 'USER'), side(11, 260, 'KERNEL'), trap(111, 88), trap(279, 88)]
        : [region(30, 4, 566, 76, 'line-2'), region(30, 88, 566, 358, 'os'), side(16, 42, 'USER'), side(16, 267, 'KERNEL'),
          s('text', { x: 310, y: 36, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'calls'), trap(170, 98), trap(470, 98)];
      (NW ? KBN_ARROWS : KB_ARROWS).forEach(([x1, y1, x2, y2]) => k.push(s('line', { x1, y1, x2, y2, class: 's-line', 'stroke-width': 2, 'marker-end': 'url(#arr)', opacity: tracing ? 0.5 : 1 })));
      KB_ORDER.forEach((id) => {
        const c = G[id], [x, y, w, hh] = c.r;
        const act = st.active === id, fl = st.flash && st.flash[id];
        const dim = tracing && !act && !st.visited.has(id) && !(id === 'pcs' && ['ipc', 'sch', 'mm'].some((q) => st.visited.has(q) || st.active === q));
        let style = c.inner ? 'fill:var(--panel)' : '';
        if (fl) style = `fill:var(--${fl}-bg);stroke:var(--${fl})`;
        else if (act) style = 'fill:var(--hl);stroke:var(--chc)';
        const kids = [s('rect', { class: 'fr ' + c.cls, x, y, width: w, height: hh, rx: c.box ? 12 : 9, 'stroke-width': act ? 4 : fl ? 3 : 2, style })];
        const cx = x + w / 2;
        if (c.box) c.t.forEach((line, j) => kids.push(s('text', { x: cx, y: y + (NW ? 22 : 26) + j * 17, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, line)));
        else if (c.sub) kids.push(s('text', { x: x + 16, y: y + 24, 'font-size': 15, 'font-weight': 800 }, c.t[0]), s('text', { x: NW ? x + 16 : x + 102, y: NW ? y + 44 : y + 24, 'font-size': 13.5, class: 's-sub' }, c.sub));
        else if (c.t.length === 2) kids.push(s('text', { x: cx, y: y + 21, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, c.t[0]), s('text', { x: cx, y: y + 38, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, c.t[1]));
        else kids.push(s('text', { x: cx, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': id === 'sci' ? 15.5 : 14.5, 'font-weight': id === 'sci' || id === 'fs' ? 800 : 700 }, c.t[0]));
        const tg = st.tag && st.tag[id];     // st.tag[id] = [symbol, colour]: a round badge on the block's top-right corner, clear of every arrow
        if (tg) {
          kids.push(s('circle', { cx: x + w - 6, cy: y + 2, r: 10.5, style: `fill:var(--${tg[1]});stroke:var(--panel);stroke-width:2` }),
            s('text', { x: x + w - 6, y: y + 7, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--panel)' }, tg[0]));
        }
        const live = onPick && !st.noPick;   // st.noPick: draw a normally clickable diagram as a plain picture
        const g = s('g', { class: (live ? 'hot' : '') + (st.sel === id ? ' sel' : '') + (dim ? ' dimg' : ''), 'data-id': id });
        if (live) {
          g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', c.t.join(' '));
          g.addEventListener('click', () => onPick(id));
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id); } });
        }
        g.append(...kids);
        k.push(g);
      });
      base.replaceChildren(...k);
      if (st.token) {
        const [tx, ty] = kbSpot(st.token);
        tok.style.transform = `translate(${tx}px, ${ty}px)`; tok.style.opacity = '1';
      } else tok.style.opacity = '0';
    }
    return { svg, draw };
  }

  Guide.section({
    id: '2.8',
    title: 'Traditional Unix Systems',
    short: 'Traditional UNIX',
    summary: 'UNIX from Bell Labs to System V and BSD: its layers, its system call interface and its two-part kernel.',
    objectives: [
      'Trace UNIX from its 1970 start at Bell Labs through the PDP-11, the rewrite in C, Versions 6 and 7, and the System V and BSD branches.',
      'Explain why rewriting UNIX in C was a milestone, and say what still had to be rewritten when it moved to a new machine.',
      'Name the layers of a UNIX system and explain why the system call interface is the boundary between user programs and the kernel.',
      'Describe the two main parts of the traditional kernel, the process control subsystem and the file subsystem, plus hardware control.',
      'Trace a read() call through the kernel and explain why the traditional UNIX kernel is called monolithic.',
    ],
    terms: [
      ['UNIX', 'A multiuser, time-sharing operating system created at Bell Labs by Ken Thompson and Dennis Ritchie; it was running on a PDP-7 minicomputer by 1970. The name now covers a large family of descendants.'],
      ['Assembly language', 'A low-level language in which each line stands for one machine instruction of one particular processor family, so assembly code written for one processor cannot run on a different kind.'],
      ['High-level language', 'A language such as C whose statements (variables, loops, function calls) do not depend on any one processor. A compiler translates them into the instructions of whichever processor you target.'],
      ['C programming language', 'The high-level language Dennis Ritchie designed at Bell Labs in the early 1970s; UNIX was rewritten in it in 1973. It is close enough to the hardware for system code, yet it can be compiled for many processors.'],
      ['Compiler', 'A program that translates source code written in a high-level language into the machine instructions of one particular processor. Moving C code to a new machine means compiling it again with a compiler for that machine.'],
      ['Machine-dependent code', 'Code tied to one kind of hardware (its instruction set, its registers or its devices). It must be rewritten when the system moves to a different machine.'],
      ['System V', 'AT&T\'s main commercial UNIX line, released in 1983 after System III and licensed widely to computer makers. Its fourth release (SVR4) later absorbed many BSD features.'],
      ['Berkeley Software Distribution (BSD)', 'The UNIX versions produced at the University of California, Berkeley, from 1978. 3BSD added virtual memory, the 4.xBSD series carried it on and added TCP/IP networking, and these ideas shaped nearly every later UNIX.'],
      ['Library', 'A collection of ready-made routines, such as the C library\'s printf and fopen, that programs call instead of writing that code themselves. Many library routines make system calls on the program\'s behalf.'],
      ['Shell', 'The command interpreter: an ordinary user-mode program that reads the commands you type (such as ls or cc) and asks the kernel to run them. It is not part of the kernel.'],
      ['System call', 'A request from a running program to the kernel for a service, such as reading a file or creating a process. The program enters the kernel through a controlled gate that switches the processor into kernel mode.'],
      ['System call interface', 'The boundary between user programs and the UNIX kernel: a fixed set of entry points, such as open, read, write and fork, through which higher-level software asks for specific kernel services.'],
      ['Trap instruction', 'A special machine instruction that a program executes on purpose to enter the kernel. It switches the processor to kernel mode and jumps to a fixed kernel entry point, so user code cannot choose where in the kernel it lands.'],
      ['Process control subsystem', 'The part of the traditional UNIX kernel that manages processes: memory management, scheduling and dispatching, and synchronization and interprocess communication.'],
      ['File subsystem', 'The part of the traditional UNIX kernel that manages files and moves data between main memory and external devices, either in blocks (through the buffer cache) or as a stream of characters.'],
      ['Buffer cache', 'An area of main memory where the UNIX kernel keeps copies of recently used disk blocks, so a request for a block that is already there needs no disk access.'],
      ['Block device', 'A device, such as a disk or a tape, that stores data in fixed-size numbered blocks. In traditional UNIX its data passes through the buffer cache.'],
      ['Character device', 'A device, such as a terminal or a printer, that sends or receives a stream of bytes one after another, with no block structure. Its driver is reached without going through the buffer cache.'],
      ['Hardware control', 'The lowest layer of the traditional UNIX kernel: machine-dependent code that handles interrupts and communicates directly with the machine\'s devices and registers.'],
      ['Monolithic kernel', 'A kernel built as one large program whose parts (scheduling, memory management, file system, device drivers and more) all run in kernel mode in one shared address space and call each other directly.'],
    ],

    css: `
      /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
      .sec-2-8 .step-eyebrow { contain: inline-size; }
      .sec-2-8 .hot { cursor: pointer; outline: none; }
      .sec-2-8 .hot .fr { transition: stroke-width .15s, opacity .2s; }
      .sec-2-8 .hot:hover .fr, .sec-2-8 .hot:focus-visible .fr { stroke-width: 3.5; }
      .sec-2-8 .hot.sel .fr { stroke-width: 4.5; }
      .sec-2-8 .dimg { opacity: .28; transition: opacity .25s; }
      .sec-2-8 .info { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
      .sec-2-8 .info h3 { margin: 0; }
      .sec-2-8 .info p { font-size: 15.5px; line-height: 1.45; margin: 0; }
      .sec-2-8 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); }
      .sec-2-8 .eg b { color: var(--chc); }
      .sec-2-8 .dot { width: 22px; height: 8px; border-radius: 9px; background: var(--panel-3); display: inline-block; }
      .sec-2-8 .dot.cur { background: var(--chc); }
      .sec-2-8 .dot.ok { background: var(--ok); }
      .sec-2-8 .dot.warn { background: var(--warn); }
      .sec-2-8 .tok { transition: transform .45s ease; pointer-events: none; }
      .sec-2-8 .u8-story { gap: 11px; }
      .sec-2-8 .u8-diff { display: grid; grid-template-columns: 138px minmax(0, 1fr); gap: 10px 12px; align-items: start; }
      .sec-2-8 .u8-diff .chip { justify-content: center; margin-top: 2px; }
      .sec-2-8 .u8-diff .small { line-height: 1.42; }
      .sec-2-8 .u8-route li { margin: 4px 0; line-height: 1.4; }
      .sec-2-8 .u8-dates { display: grid; grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr); gap: 3px 10px; }
      .sec-2-8 .u8-dates b { color: var(--chc); font-variant-numeric: tabular-nums; }
      .sec-2-8 .u8-tree-bot { display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 14px; min-height: 0; }
      .sec-2-8 .u8-one { grid-template-columns: minmax(0, 1fr) !important; }
      .sec-2-8 .u8-world { padding: 10px 12px; }
      .sec-2-8 .u8-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      .sec-2-8 .u8-tile { display: flex; flex-direction: column; gap: 1px; padding: 5px 9px; border-radius: 9px; border: 1.5px solid var(--line); background: var(--panel-2); transition: background .25s, border-color .25s; min-width: 0; }
      .sec-2-8 .u8-tile b { font-size: 13.5px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sec-2-8 .u8-tile .u8-st { color: var(--ink-2); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sec-2-8 .u8-tile.dep { border-style: dashed; border-color: var(--warn); }
      .sec-2-8 .u8-tile.rw { background: var(--bad-bg); border-color: var(--bad); }
      .sec-2-8 .u8-tile.rw .u8-st { color: var(--bad); font-weight: 700; }
      .sec-2-8 .u8-tile.rc { background: var(--ok-bg); border-color: var(--ok); }
      .sec-2-8 .u8-tile.rc .u8-st { color: var(--ok); font-weight: 700; }
      .sec-2-8 .u8-tally { padding-top: 6px; border-top: 1px dashed var(--line-2); line-height: 1.35; }
      .sec-2-8 .u8-comp { padding: 6px 11px; border-radius: 10px; background: var(--warn-bg); border-left: 4px solid var(--warn); line-height: 1.4; font-size: 13.5px; }
      .sec-2-8 .u8-barrow { display: grid; grid-template-columns: 118px minmax(0, 1fr) 62px; gap: 10px; align-items: center; }
      .sec-2-8 .u8-barrow .mono { text-align: right; }
      .sec-2-8 .u8-cap { line-height: 1.45; }
      .sec-2-8 .u8-item { font-size: 19px; font-weight: 700; line-height: 1.35; }
      .sec-2-8 .u8-route2 { display: flex; flex-wrap: wrap; gap: 4px 5px; align-items: center; }
      .sec-2-8 .u8-route2 .chip { font-size: 12.5px; padding: 0 7px; }
    `,

    steps: [
      /* ---------------- 1. Big picture ---------------- */
      {
        title: 'Why a 1970 operating system still matters',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">Your phone, most web servers and every Mac run operating systems that descend from UNIX or were built to behave just like it.</p>
              <p class="m0"><span class="t">UNIX</span> began around 1970 as a small project by two researchers at Bell Labs, <b>Ken Thompson</b> and <b>Dennis Ritchie</b>. It was compact, from 1973 most of it was written in a <span class="t">high-level language</span>, and its source code travelled to universities, where students read it, learned from it and improved it.</p>
              <div class="callout analogy m0" data-label="Analogy">Classic UNIX is to today's systems what Latin is to Spanish, French and Italian. Hardly anyone runs the original now, yet its structure and vocabulary (processes, files, the shell, calls such as <code>read</code> and <code>fork</code>) live on in every descendant.</div>
              <div class="card tight m0">
                <h4>The first four years</h4>
                <div class="u8-dates small"><b>1969</b><span>work starts on a PDP-7</span><b>1970</b><span>it runs, named UNIX</span><b>1971</b><span>it moves to the PDP-11</span><b>1973</b><span>kernel rewritten in C</span></div>
              </div>
            </div>
            <div class="card white stack u8-story">
              <h4 class="m0">Three things that made UNIX different</h4>
              <div class="u8-diff">
                <span class="chip cpu">Written in C</span><span class="small">Most of the system was written in the <span class="t" data-t="C programming language">C language</span> instead of one machine's instructions, so it could move to new computers.</span>
                <span class="chip os">Small and simple</span><span class="small">A compact kernel plus many small programs (<code>ls</code>, <code>sort</code>, the <span class="t">shell</span>) that users combine to do bigger jobs.</span>
                <span class="chip proc">Shared</span><span class="small">Licensed cheaply to universities <b>with its source code</b>, so a whole generation of programmers learned how an OS works from it.</span>
              </div>
              <h4 class="m0">Descendants and look-alikes today</h4>
              <div class="row gap-s">
                <span class="box small">macOS and iOS</span><span class="box small">FreeBSD</span><span class="box small">Solaris · AIX</span><span class="box small">Linux · Android <span class="muted">(look-alike)</span></span>
              </div>
              <h4 class="m0">Your route through this section</h4>
              <ol class="u8-route small m0">
                <li><b>History:</b> the family tree, and why the rewrite in C was a milestone</li>
                <li><b>Layers:</b> from the hardware up to your own applications</li>
                <li><b>The kernel:</b> its two subsystems, and a <code>read()</code> traced end to end</li>
              </ol>
              <div class="callout why m0" data-label="Why it matters">A small set of <span class="t">system calls</span> as the only door into the kernel, and a kernel split into a process half and a file half: these choices still shape Linux, macOS and Android. Learn them once, recognise them everywhere.</div>
            </div>
          </div>`,
      },
      /* ---------------- 2. Family tree: clickable nodes, branch highlighting ---------------- */
      {
        title: 'The UNIX family tree: click any release',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const LANES = [
            { n: ['Bell Labs', 'research'], y: 58, cls: 's-accent', chip: 'accent', name: 'Bell Labs research' },
            { n: ['AT&T', 'commercial'], y: 134, cls: 's-io', chip: 'io', name: 'AT&T commercial' },
            { n: ['UC Berkeley', '(BSD)'], y: 210, cls: 's-proc', chip: 'proc', name: 'UC Berkeley' },
          ];
          const N = {
            pdp7: { n: 'PDP-7', yr: '1970', lane: 0, x: 175,
              what: 'In 1969 Bell Labs left Multics, a huge project to build a <span class="t" data-t="Time sharing">time-sharing</span> system (many users sharing one computer at once). Ken Thompson, soon joined by Dennis Ritchie, wrote a much smaller system for a little-used DEC PDP-7 minicomputer. By 1970 it ran and was named UNIX. Every line was PDP-7 assembly language.',
              why: 'It began as a practical tool that programmers built for themselves, which kept it small and simple.' },
            pdp11: { n: 'PDP-11', yr: '1971', lane: 0, x: 245,
              what: 'UNIX moved to the newer and far more popular DEC PDP-11. It earned its keep inside Bell Labs by preparing patent documents, and its first manual appeared in 1971. It was still written in assembly language.',
              why: 'Moving from the PDP-7 meant rewriting the whole system for a different instruction set: exactly the pain that C would soon remove.' },
            c: { n: 'C rewrite', yr: '1973', lane: 0, x: 320,
              what: 'Dennis Ritchie created the C language, and in 1973 the UNIX kernel was rewritten in it, leaving only a small machine-dependent part in <span class="t">assembly language</span>. At the time, almost every operating system was written in assembly.',
              why: 'It showed that a high-level language is good enough for most system code, which made UNIX easier to read, change and carry to new machines.' },
            v6: { n: 'Version 6', yr: '1975', lane: 0, x: 395,
              what: 'The first release used widely outside Bell Labs. Legal limits kept AT&T, which owned Bell Labs, out of the computer business, so it licensed UNIX to universities for a small fee, source code included.',
              why: 'Students could read an entire working kernel. A generation learned operating systems from it, and Berkeley started its own work from it.' },
            v7: { n: 'Version 7', yr: '1979', lane: 0, x: 500,
              what: 'The last research edition that spread widely. Lessons from carrying UNIX to a non-DEC machine, the Interdata 8/32, made it far more portable, and a Bell Labs port called UNIX/32V took it to DEC\'s new 32-bit VAX.',
              why: 'Almost every later UNIX, on both the AT&T side and the Berkeley side, traces its family line back to Version 7.' },
            bsd1: { n: '1BSD', yr: '1978', lane: 2, x: 445,
              what: 'At the University of California, Berkeley, a group that included graduate student Bill Joy began shipping add-ons for Version 6, such as a Pascal system and the ex text editor, as the <span class="t">Berkeley Software Distribution</span>.',
              why: 'A university became a second centre of UNIX development, alongside Bell Labs.' },
            bsd3: { n: '3BSD', yr: '1979', lane: 2, x: 560,
              what: 'A complete UNIX for the VAX, built on UNIX/32V (Version 7 for the VAX), that added <b>virtual memory</b> with <b>paging</b>: memory is handled in small fixed-size pieces (pages), and only the pages in use need to be in main memory, so a program could be larger than physical memory.',
              why: 'Virtual memory became a standard UNIX feature through the Berkeley line.' },
            bsd42: { n: '4.2BSD', yr: '1983', lane: 2, x: 725,
              what: 'Built TCP/IP networking (TCP/IP is the family of communication rules, or protocols, that Internet computers use to reach each other and deliver data) directly into the kernel, together with sockets (the programming interface for network connections), and added a faster file system.',
              why: 'Networked BSD machines became a backbone of the early Internet, and sockets are still how programs on nearly every OS talk over a network.' },
            bsd43: { n: '4.3BSD', yr: '1986', lane: 2, x: 805,
              what: 'A refined, faster 4.2BSD that became the standard UNIX in universities and research labs. Workstation makers such as Sun built their own systems on Berkeley code.',
              why: 'BSD features became so popular that AT&T\'s own line later adopted them.' },
            bsd44: { n: '4.4BSD', yr: '1993', lane: 2, x: 905,
              what: 'The final Berkeley release. A version with all AT&T-owned code removed (4.4BSD-Lite) followed, so the system could be shared freely.',
              why: 'It became the foundation of FreeBSD, NetBSD and OpenBSD, and parts of it live on inside macOS.' },
            s3: { n: 'System III', yr: '1982', lane: 1, x: 620,
              what: 'AT&T\'s own UNIX support group turned the research versions into a supported product. System III, based mainly on Version 7, was the first version AT&T sold widely to outside customers: its first public commercial release.',
              why: 'UNIX was no longer only a research and university system: companies could now buy it with support.' },
            s5: { n: 'System V', yr: '1983', lane: 1, x: 700,
              what: 'AT&T\'s main commercial line, later followed by Releases 2, 3 and 4. With the 1984 break-up of the Bell System lifting its old legal limits, AT&T sold <span class="t">System V</span> hard and licensed it to many computer makers, who built their own UNIX versions from it.',
              why: 'It gave businesses a standard, supported UNIX. IBM\'s AIX and HP\'s HP-UX grew from this branch.' },
            svr4: { n: 'SVR4', yr: '1989', lane: 1, x: 840,
              what: 'System V Release 4, built by AT&T together with Sun, merged System V with the most popular BSD features (sockets, the faster file system) and Sun\'s additions into one unified UNIX.',
              why: 'The two branches came back together. Section 2.9 covers SVR4 and the other modern UNIX systems.' },
            comm: { n: 'Solaris · AIX · HP-UX', yr: '1990s on', lane: 1, x: 1027, later: true,
              what: 'Commercial UNIX systems from Sun (Solaris, built on SVR4), IBM (AIX) and HP (HP-UX), all rooted in AT&T\'s System V, running large servers and workstations.',
              why: 'These modern UNIX systems are the subject of section 2.9.' },
            fbsd: { n: 'FreeBSD · macOS', yr: '1990s on', lane: 2, x: 1027, later: true,
              what: 'FreeBSD, NetBSD and OpenBSD continue the Berkeley line as free, open-source systems, and Apple\'s macOS and iOS contain a large BSD-derived layer.',
              why: 'The Berkeley branch is still alive; section 2.9 looks at modern BSD systems.' },
            linux: { n: 'Linux', yr: '1991', lane: 0, x: 1027, later: true, look: true,
              what: 'Linus Torvalds wrote a brand-new kernel that behaves like UNIX (the same kinds of system calls, files and commands) but contains no UNIX code. It is a look-alike, not a descendant, which is why no line connects it.',
              why: 'Linux, and Android on top of it, are covered in sections 2.10 and 2.11.' },
          };
          const ORDER = ['pdp7', 'pdp11', 'c', 'v6', 'bsd1', 'v7', 'bsd3', 's3', 's5', 'bsd42', 'bsd43', 'svr4', 'linux', 'bsd44', 'comm', 'fbsd'];
          const E = [['pdp7', 'pdp11'], ['pdp11', 'c'], ['c', 'v6'], ['v6', 'v7'], ['v6', 'bsd1'], ['v7', 'bsd3'], ['v7', 's3'], ['bsd1', 'bsd3'], ['bsd3', 'bsd42'],
            ['bsd42', 'bsd43'], ['bsd43', 'bsd44'], ['s3', 's5'], ['s5', 'svr4'], ['bsd43', 'svr4', 'dash'], ['svr4', 'comm'], ['bsd44', 'fbsd']];
          const BR = {
            all: null,
            sysv: new Set(['pdp7', 'pdp11', 'c', 'v6', 'v7', 's3', 's5', 'svr4', 'comm']),
            bsd: new Set(['pdp7', 'pdp11', 'c', 'v6', 'v7', 'bsd1', 'bsd3', 'bsd42', 'bsd43', 'bsd44', 'fbsd']),
          };
          const BRTXT = {
            all: 'Both branches grow from the Bell Labs research versions. <b>Solid lines</b> pass code down; the <b>dashed line</b> shows BSD features merged into SVR4; the <b>dashed circle</b> marks a look-alike with no shared code.',
            sysv: '<b>AT&amp;T line:</b> research versions → System III (1982) → System V (1983) → SVR4 (1989) → Solaris, AIX, HP-UX. The commercial, supported UNIX.',
            bsd: '<b>Berkeley line:</b> Versions 6 and 7 → 1BSD (1978) → 3BSD with virtual memory (1979) → 4.2BSD with TCP/IP (1983) → 4.4BSD → FreeBSD, macOS.',
          };
          let cur = 'pdp7', br = 'all';
          const Y = (id) => LANES[N[id].lane].y;
          const HALO = 'paint-order:stroke;stroke:var(--panel-2);stroke-width:4px;stroke-linejoin:round';   // lines passing behind a label stop short of the letters
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 380 744' : '0 0 1104 248', width: '100%', role: 'img', 'aria-label': 'UNIX family tree' });
          // phones: time runs downward, one column per lane, labels to the right of each circle
          const NROW = { pdp7: 0, pdp11: 1, c: 2, v6: 3, bsd1: 4, v7: 5, bsd3: 6, s3: 7, s5: 8, bsd42: 9, bsd43: 10, svr4: 11, linux: 12, bsd44: 13, comm: 14, fbsd: 15 };
          const NCOL = [24, 124, 236], NNAME = { comm: 'Solaris, AIX' };
          const npos = (id) => [NCOL[N[id].lane], 60 + NROW[id] * 43];
          const head = h('h3', {});
          const what = h('p', {});
          const why = h('div', { class: 'eg' });
          const brNote = h('p', { class: 'small m0', html: BRTXT.all });
          const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => step(-1) }, '◀ Earlier');
          const next = h('button', { class: 'btn sm', type: 'button', onclick: () => step(1) }, 'Later ▶');
          const inBr = (id) => !BR[br] || BR[br].has(id);
          function nodeG(id, x, y, kids) {
            return s('g', { class: 'hot' + (id === cur ? ' sel' : '') + (inBr(id) ? '' : ' dimg'), role: 'button', tabindex: 0, 'aria-label': N[id].n + ', ' + N[id].yr,
              onclick: () => show(id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(id); } } }, ...kids);
          }
          function drawNarrow() {
            const k = [];
            ['Bell Labs', 'AT&T', 'Berkeley'].forEach((t, i) => k.push(s('text', { x: NCOL[i] - 10, y: 22, 'font-size': 14, 'font-weight': 800, class: 's-sub' }, t)));
            [[6, '1980s'], [11, '1990s'], [13, 'later']].forEach(([r, t]) => {
              const y = 60 + r * 43 + 21;
              k.push(s('line', { x1: 0, y1: y, x2: 380, y2: y, class: 's-muted', 'stroke-dasharray': '4 5', 'stroke-width': 1.5 }), s('text', { x: 378, y: y - 5, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, class: 's-sub' }, t));
            });
            E.forEach(([a, b, dash]) => {
              const [ax, ay] = npos(a), [bx, by] = npos(b);
              const on = br !== 'all' && inBr(a) && inBr(b), dim = br !== 'all' && !on;
              const r = 10, dir = bx > ax ? 1 : -1;
              const d = ax === bx ? `M${ax},${ay} V${by}` : dash
                ? `M${ax},${ay} H${bx - dir * r} Q${bx},${ay} ${bx},${ay + r} V${by}`
                : `M${ax},${ay} V${by - r} Q${ax},${by} ${ax + dir * r},${by} H${bx}`;
              k.push(s('path', { d, fill: 'none', style: `stroke:${on ? 'var(--chc)' : 'var(--line-2)'}`, 'stroke-width': on ? 4 : 3, 'stroke-dasharray': dash ? '7 6' : null, class: dim ? 'dimg' : null }));
            });
            ORDER.forEach((id) => {
              const d = N[id], [x, y] = npos(id), sel = id === cur;
              k.push(nodeG(id, x, y, [
                s('rect', { x: x - 16, y: y - 20, width: 130, height: 40, fill: 'transparent' }),
                sel ? s('circle', { cx: x, cy: y, r: 15, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 2.5, opacity: 0.55 }) : null,
                s('circle', { class: 'fr ' + (d.later ? 's-panel' : LANES[d.lane].cls), cx: x, cy: y, r: sel ? 10 : 8, 'stroke-width': 2.5, 'stroke-dasharray': d.look ? '3 3' : null }),
                s('text', { x: x + 19, y: y + 1, 'font-size': 14, 'font-weight': sel ? 800 : 700, style: sel ? 'fill:var(--chc)' : '' }, NNAME[id] || d.n),
                s('text', { x: x + 19, y: y + 17, 'font-size': 12.5, class: 's-sub' }, d.yr)]));
            });
            svg.replaceChildren(...k);
          }
          function draw() {
            if (ctx.narrow) { drawNarrow(); return; }
            const k = [];
            LANES.forEach((L) => {
              k.push(s('rect', { x: 0, y: L.y - 35, width: 1104, height: 70, rx: 10, style: 'fill:var(--panel-2);stroke:none' }));
              k.push(s('text', { x: 14, y: L.y - 3, 'font-size': 13.5, 'font-weight': 800, class: 's-sub' }, L.n[0]));
              k.push(s('text', { x: 14, y: L.y + 14, 'font-size': 13, class: 's-sub' }, L.n[1]));
            });
            [[590, '1980s'], [870, '1990s'], [952, 'Later']].forEach(([x]) => k.push(s('line', { x1: x, y1: 20, x2: x, y2: 246, class: 's-muted', 'stroke-dasharray': '4 5', 'stroke-width': 1.5 })));
            [[360, '1970s'], [730, '1980s'], [911, '1990s'], [1027, 'Later']].forEach(([x, t]) => k.push(s('text', { x, y: 14, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, t)));
            E.forEach(([a, b, dash]) => {
              const ax = N[a].x, ay = Y(a), bx = N[b].x, by = Y(b), mx = (ax + bx) / 2;
              const on = br !== 'all' && inBr(a) && inBr(b);
              const dim = br !== 'all' && !on;
              // long drops first run 16 units along the lane (clear of the parent's year label), fall, then run
              // along the child's lane, so they never cut through a label
              const d = ay === by ? `M${ax},${ay} L${bx},${by}` : bx - ax > 45 ? `M${ax},${ay} H${ax + 16} C${ax + 32},${ay} ${ax + 22},${by} ${ax + 40},${by} L${bx},${by}` : `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
              k.push(s('path', { d, fill: 'none',
                style: `stroke:${on ? 'var(--chc)' : 'var(--line-2)'}`, 'stroke-width': on ? 4 : 3, 'stroke-dasharray': dash ? '7 6' : null, class: dim ? 'dimg' : null }));
            });
            ORDER.forEach((id) => {
              const d = N[id], y = Y(id), sel = id === cur;
              const cls = d.later ? 's-panel' : LANES[d.lane].cls;
              const g = s('g', { class: 'hot' + (sel ? ' sel' : '') + (inBr(id) ? '' : ' dimg'), role: 'button', tabindex: 0, 'aria-label': d.n + ', ' + d.yr,
                onclick: () => show(id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(id); } } },
                s('rect', { x: d.x - 38, y: y - 34, width: 76, height: 68, fill: 'transparent' }),
                sel ? s('circle', { cx: d.x, cy: y, r: 17, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 2.5, opacity: 0.55 }) : null,
                s('circle', { class: 'fr ' + cls, cx: d.x, cy: y, r: sel ? 11 : 8, 'stroke-width': 2.5, 'stroke-dasharray': d.look ? '3 3' : null }),
                s('text', { x: d.x, y: y - 16, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': sel ? 800 : 700, style: HALO + (sel ? ';fill:var(--chc)' : '') }, d.n),
                s('text', { x: d.x, y: y + 25, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', style: HALO }, d.yr));
              k.push(g);
            });
            svg.replaceChildren(...k);
          }
          function show(id) {
            cur = id;
            const d = N[id], L = LANES[d.lane];
            head.innerHTML = `${d.n} <span class="chip ${d.later ? '' : L.chip}" style="vertical-align:3px">${d.yr}</span> <span class="chip" style="vertical-align:3px">${d.later ? 'later system' : L.name}</span>`;
            what.innerHTML = d.what;
            why.innerHTML = '<b>Why it mattered: </b>' + d.why;
            const i = ORDER.indexOf(id);
            prev.disabled = i === 0; next.disabled = i === ORDER.length - 1;
            draw();
          }
          function step(dir) { const i = ORDER.indexOf(cur) + dir; if (i >= 0 && i < ORDER.length) show(ORDER[i]); }
          const seg = ctx.ui.seg([{ value: 'all', label: 'Whole tree' }, { value: 'sysv', label: 'System V line' }, { value: 'bsd', label: 'BSD line' }], 'all', (v) => { br = v; brNote.innerHTML = BRTXT[v]; draw(); });
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('div', { class: 'card white tight', style: { padding: '8px 10px' } }, svg),
            h('div', { class: 'u8-tree-bot grow' + (ctx.narrow ? ' u8-one' : '') },
              h('div', { class: 'card info' }, head, what, why),
              h('div', { class: 'card white stack', style: { gap: '9px' } },
                h('h4', { class: 'm0' }, 'Follow a branch'), seg, brNote,
                h('div', { class: 'row gap-s', style: { marginTop: 'auto' } }, prev, next, h('span', { class: 'xs muted' }, 'or click any circle'))))));
          show('pdp7');
        },
      },
      /* ---------------- 3. Why C mattered: a porting lab ---------------- */
      {
        title: 'Why C mattered: carry the kernel to a new machine',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const fmtN = (n) => n.toLocaleString('en-US');
          // an illustrative 10,000-line kernel: 9,000 portable lines, 1,000 machine-dependent lines
          const MODS = [
            { n: 'File system', l: 2600 }, { n: 'System calls', l: 1800 },
            { n: 'Memory manager', l: 1400 }, { n: 'Scheduler', l: 1200 },
            { n: 'Buffer cache', l: 1000 }, { n: 'Terminal handling', l: 1000 },
            { n: 'Traps and interrupts', l: 450, dep: true }, { n: 'Device drivers', l: 550, dep: true },
          ];
          const TOTAL = MODS.reduce((a, m) => a + m.l, 0);                 // 10,000
          const DEP = MODS.filter((m) => m.dep).reduce((a, m) => a + m.l, 0); // 1,000
          const MACH = ['Interdata 8/32', 'VAX-11/780', 'Motorola 68000', 'Intel 386'];
          let ports = 0, busy = false, gen = 0;
          const worlds = ['asm', 'c'].map((w) => {
            const tiles = MODS.map((m) => {
              const st = h('span', { class: 'xs u8-st' }, fmtN(m.l) + ' lines');
              const t = h('div', { class: 'u8-tile' + (w === 'c' && m.dep ? ' dep' : '') }, h('b', {}, m.n), st);
              return { t, st, m };
            });
            const tally = h('div', { class: 'u8-tally small' });
            return { w, tiles, tally };
          });
          const compiler = h('div', { class: 'u8-comp xs' });
          const bars = h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } });
          const cap = h('div', { class: 'u8-cap small', style: { marginTop: '2px', paddingTop: '5px', borderTop: '1px dashed var(--line-2)' } });
          const btn = h('button', { class: 'btn primary', type: 'button', onclick: port });
          const reset = h('button', { class: 'btn', type: 'button', onclick: () => { gen++; busy = false; ports = 0; paint(); } }, 'Reset');
          const machRow = h('div', { class: 'row', style: { gap: '4px' } });
          function tileState(wd, i, state) {
            const { t, st, m } = wd.tiles[i];
            t.classList.remove('rw', 'rc');
            if (state === 'rw') { t.classList.add('rw'); st.textContent = '✗ rewrite by hand'; }
            else if (state === 'rc') { t.classList.add('rc'); st.textContent = '✓ recompile unchanged'; }
            else st.textContent = fmtN(m.l) + ' lines';
          }
          function paintBars() {
            const a = ports * TOTAL, c = ports * DEP, max = MACH.length * TOTAL;
            const bar = (label, v, col) => h('div', { class: 'u8-barrow' },
              h('span', { class: 'xs b' }, label),
              h('div', { class: 'meter', style: { height: '14px' } }, h('i', { style: { width: (v / max) * 100 + '%', background: `var(--${col})` } })),
              h('span', { class: 'mono small b' }, fmtN(v)));
            // header and machine chips on separate rows, so the layout does not jump when the chips gain ticks
            bars.replaceChildren(h('span', { class: 'xs muted b' }, `TOTAL LINES REWRITTEN BY HAND AFTER ${ports} PORT${ports === 1 ? '' : 'S'}`), machRow,
              bar('Assembly world', a, 'bad'), bar('C world', c, 'ok'));
          }
          function paint() {
            worlds.forEach((wd) => {
              wd.tiles.forEach((_, i) => tileState(wd, i, ports ? (wd.w === 'asm' || wd.tiles[i].m.dep ? 'rw' : 'rc') : null));
              const rw = ports ? (wd.w === 'asm' ? TOTAL : DEP) : 0;
              wd.tally.innerHTML = ports ? `This port: <b>${fmtN(rw)}</b> lines rewritten, <b>${fmtN(TOTAL - rw)}</b> recompiled` : 'Running on the PDP-11. Nothing to rewrite yet.';
            });
            compiler.innerHTML = ports ? `<b>Also needed once per processor:</b> a C compiler for the ${MACH[ports - 1]} (${ports} built so far); every C program can then move too.` : '<b>Also needed once per processor:</b> a C compiler that produces that processor\'s instructions.';
            machRow.replaceChildren(h('span', { class: 'chip ok' }, 'PDP-11'), ...MACH.map((m, i) => h('span', { class: 'chip ' + (i < ports ? 'ok' : '') }, (i < ports ? '✓ ' : '') + m)));
            btn.disabled = busy || ports >= MACH.length;
            btn.textContent = ports >= MACH.length ? 'All four ports done' : 'Port to the ' + MACH[ports] + ' ▶';
            paintBars();
            cap.innerHTML = ports === 0
              ? 'Press the button to carry UNIX from the PDP-11 to its first new machine. Watch which parts of the kernel must be <b>rewritten by hand</b> in each world.'
              : ports < MACH.length
                ? `<b>Ported to the ${MACH[ports - 1]}.</b> Assembly world: all ${fmtN(TOTAL)} lines rewritten, plus every command (shell, editor, tools). C world: only the ${fmtN(DEP)} machine-dependent lines; the other ${fmtN(TOTAL - DEP)} just recompile.`
                : `<b>After four ports:</b> ${fmtN(MACH.length * TOTAL)} lines rewritten in the assembly world against ${fmtN(MACH.length * DEP)} in the C world. That ten-to-one saving on every new machine is a big reason UNIX spread to so many kinds of computer.`;
          }
          function port() {
            if (busy || ports >= MACH.length) return;
            busy = true; const my = ++gen; btn.disabled = true;
            cap.innerHTML = `<b>Porting to the ${MACH[ports]}…</b> each part of the kernel is checked: can it simply be recompiled, or must it be rewritten?`;
            MODS.forEach((m, i) => ctx.after(110 * (i + 1), () => {
              if (my !== gen) return;
              worlds.forEach((wd) => tileState(wd, i, wd.w === 'asm' || m.dep ? 'rw' : 'rc'));
            }));
            ctx.after(110 * (MODS.length + 1), () => { if (my !== gen) return; busy = false; ports++; paint(); });
          }
          const worldCard = (wd, title, sub, cls) => h('div', { class: 'card white stack u8-world ' + cls, style: { gap: '8px' } },
            h('div', {}, h('div', { class: 'b', style: { fontSize: '16px', lineHeight: '1.25' } }, title), h('div', { class: 'xs muted' }, sub)),
            h('div', { class: 'u8-tiles' }, ...wd.tiles.map((x) => x.t)), wd.tally);
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0 small', html: 'In 1973 almost every operating system was written in <span class="t">assembly language</span>, the instructions of one processor family. Moving it to a different processor, called <b>porting</b> it, meant rewriting <b>every line</b>.' }),
            h('p', { class: 'm0 small', html: 'UNIX was rewritten in C, a <span class="t">high-level language</span>. A <span class="t">compiler</span> turns the same C source into instructions for any processor it supports, so only the <span class="t">machine-dependent code</span> had to be written again.' }),
            h('div', { class: 'row gap-s' }, btn, reset),
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'C did not make UNIX run anywhere for free. Each new machine still needed its own C compiler and a rewrite of the small machine-dependent part.' }),
            h('p', { class: 'xs muted m0', style: { lineHeight: '1.4' } }, 'The price: the C kernel came out somewhat larger and slower than hand-tuned assembly, a cost its designers judged well worth paying. Line counts here are illustrative round numbers.'));
          const right = h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'grid-2', style: { gap: '12px' } },
              worldCard(worlds[0], 'If UNIX had stayed in assembly', 'imagined: every line is PDP-11 instructions', 'asm'),
              worldCard(worlds[1], 'UNIX in C (what really happened)', '90% portable C · dashed = machine-dependent', 'cw')),
            compiler,
            h('div', { class: 'card stack grow', style: { gap: '6px', padding: '9px 14px' } }, bars, cap));
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : '296px minmax(0, 1fr)', gap: '18px' } }, left, right));
          paint();
        },
      },
      /* ---------------- 4. The layers of a UNIX system ---------------- */
      {
        title: 'The layers of a UNIX system',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const L = {
            apps: { y: 8, hh: 84, cls: 's-proc', t: 'User-written applications', sub: 'programs people write: games, payroll, web servers',
              job: 'The outermost layer: programs people write to get their own work done. They run in <span class="t">user mode</span> with no special privileges. To use any OS service they must reach the kernel, either <b>directly</b> with a system call or <b>through a library routine</b> that makes the call for them.',
              eg: 'A web server you wrote calls <code>read()</code> to fetch a page from the disk.' },
            cmds: { y: 100, hh: 84, cls: 's-panel', t: 'Commands and libraries', sub: 'shell · cc compiler · editors · ls, cp, sort · C library',
              job: 'Software that ships with UNIX but is <b>not</b> the kernel: the <span class="t">shell</span>, compilers such as <code>cc</code>, editors, and <span class="t">utilities</span> such as <code>ls</code>, <code>cp</code> and <code>sort</code>, plus <span class="t">libraries</span> of ready-made routines like the C library. All are ordinary user-mode programs.',
              eg: 'The shell has no more privilege than a program you write. When you type <code>ls</code>, it asks the kernel to start the ls program for you.' },
            sci: { y: 198, hh: 42, cls: 's-accent', t: 'System call interface', sub: 'open · read · write · fork · exec · wait',
              job: 'The <b>boundary</b> between user programs and the kernel: a fixed, documented set of entry points, and the only way higher-level software can reach specific kernel functions. A program enters through a <span class="t">trap instruction</span>, which switches the processor into <span class="t">kernel mode</span>.',
              eg: 'Early UNIX needed only a few dozen system calls, and every command and library was built on top of them.' },
            kern: { y: 254, hh: 128, cls: 's-os', t: 'Kernel', sub: '',
              job: 'The core of UNIX. It runs in kernel mode with full access to the hardware. It manages processes (the <b>process control subsystem</b>), files and devices (the <b>file subsystem</b>), and drives the hardware directly (<b>hardware control</b>). Every request that crosses the system call interface ends up here.',
              eg: 'The next two steps open the kernel up and follow one request through it.' },
            hw: { y: 396, hh: 80, cls: 's-cpu', t: 'Hardware', sub: 'processor · main memory · disks · terminals and other devices',
              job: 'The processor, main memory, disks, terminals and other devices. Only the kernel talks to the hardware directly; user programs never touch device registers themselves.',
              eg: 'Even a simple <code>printf</code> ends with the kernel telling a terminal device which characters to show.' },
          };
          const IDS = ['apps', 'cmds', 'sci', 'kern', 'hw'];
          const ITEMS = [
            ['<code>sh</code>, the shell that reads your commands', 'cmds', 'The shell is an ordinary program in the commands layer. It is not part of the kernel and has no special privilege.'],
            ['A budgeting program you wrote yourself', 'apps', 'Programs people write for their own work form the outermost layer, user-written applications.'],
            ['<code>printf()</code>, a routine in the C library', 'cmds', 'Library routines live in the commands-and-libraries layer. printf formats your text, then makes the write system call for you.'],
            ['<code>read</code>, <code>write</code>, <code>fork</code> and <code>exec</code>: the official ways into the kernel', 'sci', 'These entry points are the system call interface, the boundary every request must cross.'],
            ['The code that decides which process runs next', 'kern', 'Scheduling is a kernel job (the process control subsystem), because only the kernel may hand out the processor.'],
            ['<code>cc</code>, the C compiler', 'cmds', 'A compiler is a system program supplied with UNIX, but it runs in user mode like any other command.'],
            ['A disk drive and its controller', 'hw', 'Physical devices are hardware. Only the kernel\'s drivers and hardware control talk to them.'],
            ['The buffer cache of recently used disk blocks', 'kern', 'The buffer cache belongs to the kernel\'s file subsystem; no user program can reach it directly.'],
          ];
          let mode = 'learn', cur = 'sci', qi = 0, tries = 0, results = [];
          const NW = ctx.narrow;
          // geometry: wide (viewBox 600 x 484) or phone (360 x 520, taller layers so labels stay ~13 px)
          const G = NW
            ? { vb: '0 0 360 520', x0: 30, w: 324, tx: 42, bound: 218, lab: [14, 110, 333],
              y: { apps: [8, 100], cmds: [116, 96], sci: [224, 58], kern: [292, 150], hw: [452, 62] },
              sub: { apps: 'games, payroll, web servers', cmds: 'shell · cc · editors · ls, cp, sort', sci: 'open · read · write · fork · exec', hw: 'processor · memory · disks · terminals' } }
            : { vb: '0 0 600 484', x0: 36, w: 558, tx: 52, bound: 191, lab: [18, 96, 318],
              y: { apps: [8, 84], cmds: [100, 84], sci: [198, 42], kern: [254, 128], hw: [396, 80] }, sub: {} };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Layers of a UNIX system' });
          const panel = h('div', { class: 'stack grow', style: { gap: '10px' } });
          const flashes = {};
          const box = (cls, x, y, w, hh, extra) => s('rect', Object.assign({ class: cls, x, y, width: w, height: hh, rx: 8, 'stroke-width': 1.5 }, extra || {}));
          const txt = (x, y, t, o) => s('text', Object.assign({ x, y, 'font-size': 14.5, 'font-weight': 700 }, o || {}), t);
          const arrow = (x1, y1, x2, y2, col) => s('line', { x1, y1, x2, y2, style: `stroke:var(--${col})`, 'stroke-width': 2.5, 'marker-end': col === 'accent' ? 'url(#arr-accent)' : 'url(#arr)', 'pointer-events': 'none' });
          function draw() {
            const [lx, ly1, ly2] = G.lab;
            const k = [
              s('text', { x: lx, y: ly1, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.1em', transform: `rotate(-90 ${lx} ${ly1})` }, 'USER MODE'),
              s('text', { x: lx, y: ly2, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.1em', transform: `rotate(-90 ${lx} ${ly2})` }, 'KERNEL MODE'),
              s('line', { x1: 6, y1: G.bound, x2: NW ? 356 : 596, y2: G.bound, style: 'stroke:var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '6 5' }),
            ];
            IDS.forEach((id) => {
              const b = L[id], [by, bh] = G.y[id], sel = mode === 'learn' && id === cur, fl = flashes[id], sub = G.sub[id] || b.sub, tx = G.tx;
              const kids = [s('rect', { class: 'fr ' + b.cls, x: G.x0, y: by, width: G.w, height: bh, rx: 12, 'stroke-width': 2,
                style: fl ? `stroke:var(--${fl});fill:var(--${fl}-bg)` : null })];
              kids.push(s('text', { x: tx, y: by + (id === 'sci' && !NW ? 27 : 26), 'font-size': 16, 'font-weight': 800 }, b.t));
              if (id === 'sci') kids.push(s('text', { x: NW ? tx : 236, y: NW ? by + 47 : by + 27, 'font-size': 13, class: 's-sub s-monot' }, sub));
              else if (sub) kids.push(s('text', { x: tx, y: by + (NW ? 47 : 53), 'font-size': 13.5, class: 's-sub' }, sub));
              if (id === 'apps') kids.push(...(NW ? [box('s-proc', 216, by + 58, 128, 34, { rx: 9, 'stroke-width': 2, style: 'fill:var(--panel)' }), txt(280, by + 80, 'your program', { 'text-anchor': 'middle' })]
                : [box('s-proc', 452, by + 20, 132, 40, { rx: 9, 'stroke-width': 2, style: 'fill:var(--panel)' }), txt(518, by + 45, 'your program', { 'text-anchor': 'middle' })]));
              if (id === 'cmds') kids.push(...(NW ? [box('s-panel', 272, by + 56, 72, 32, { rx: 9, 'stroke-width': 2, style: 'fill:var(--panel)' }), txt(308, by + 77, 'printf()', { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 400, class: 's-monot' })]
                : [box('s-panel', 508, by + 22, 78, 40, { rx: 9, 'stroke-width': 2, style: 'fill:var(--panel)' }), txt(547, by + 47, 'printf()', { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 400, class: 's-monot' })]));
              if (id === 'kern') {
                kids.push(...(NW
                  ? [box('s-proc', 42, by + 40, 150, 50), txt(117, by + 61, 'Process control', { 'text-anchor': 'middle' }), txt(117, by + 79, 'subsystem', { 'text-anchor': 'middle' }),
                    box('s-io', 200, by + 40, 142, 50), txt(271, by + 70, 'File subsystem', { 'text-anchor': 'middle' }),
                    box('s-panel', 42, by + 100, 300, 36), txt(192, by + 123, 'Hardware control', { 'text-anchor': 'middle', 'font-size': 14 })]
                  : [box('s-proc', 52, by + 42, 266, 38), txt(185, by + 66, 'Process control subsystem', { 'text-anchor': 'middle' }),
                    box('s-io', 330, by + 42, 248, 38), txt(454, by + 66, 'File subsystem', { 'text-anchor': 'middle' }),
                    box('s-panel', 52, by + 90, 526, 28), txt(315, by + 109, 'Hardware control', { 'text-anchor': 'middle', 'font-size': 14 })]));
              }
              k.push(s('g', { class: 'hot' + (sel ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': b.t, onclick: () => pick(id),
                onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } } }, ...kids));
            });
            // the two routes into the kernel: a direct system call, and a call through a library routine
            if (NW) k.push(arrow(236, 100, 236, 220, 'accent'), txt(229, 198, 'write()', { 'text-anchor': 'end', 'font-size': 13.5, class: 's-monot', style: 'fill:var(--accent)', 'pointer-events': 'none' }),
              arrow(308, 100, 308, 168, 'ink-2'), arrow(308, 204, 308, 220, 'accent'));
            else k.push(arrow(474, 68, 474, 194, 'accent'), txt(467, 150, 'write()', { 'text-anchor': 'end', 'font-size': 13.5, class: 's-monot', style: 'fill:var(--accent)', 'pointer-events': 'none' }),
              arrow(547, 68, 547, 118, 'ink-2'), arrow(547, 162, 547, 194, 'accent'));
            svg.replaceChildren(...k);
          }
          function learnPanel() {
            const b = L[cur];
            panel.replaceChildren(
              h('div', { class: 'card info fade-in', style: { gap: '8px' } }, h('h3', {}, b.t), h('p', { html: b.job }), h('div', { class: 'eg', html: b.eg })),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Two routes into the kernel', html: 'A program can make a system call <b>directly</b> (<code>write()</code> on the diagram) or call a <b>library routine</b> such as <code>printf()</code> that makes the call for it. Either way the request crosses the system call interface.' }));
          }
          function sortPanel(fb) {
            const done = qi >= ITEMS.length;
            const right = results.filter((r) => r === 'ok').length;
            const dots = h('div', { class: 'row', style: { gap: '4px' } }, ...ITEMS.map((_, i) => h('span', { class: 'dot ' + (results[i] || (i === qi ? 'cur' : '')) })));
            if (done) {
              panel.replaceChildren(dots, h('div', { class: 'card info fade-in' }, h('h3', {}, `Sorted all ${ITEMS.length}: ${right} right first time`),
                h('p', { html: 'The pattern to remember: <b>everything above the system call interface is ordinary user-mode software</b>, even the shell and the compiler. Only the kernel runs in kernel mode and touches the hardware.' }),
                h('button', { class: 'btn sm', type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => { qi = 0; tries = 0; results = []; sortPanel(); } }, 'Sort them again')));
              return;
            }
            panel.replaceChildren(dots,
              h('div', { class: 'card white stack', style: { gap: '6px' } }, h('div', { class: 'xs muted b' }, `ITEM ${qi + 1} OF ${ITEMS.length} · CLICK THE LAYER WHERE IT LIVES`), h('div', { class: 'u8-item', html: ITEMS[qi][0] })),
              fb || h('p', { class: 'small muted m0' }, 'Click a layer in the diagram.'),
              h('div', { class: 'card tight', style: { marginTop: 'auto' } }, h('h4', {}, 'Questions that decide the layer'),
                h('ul', { class: 'small m0', style: { lineHeight: '1.45' } },
                  h('li', { html: 'Is it a physical device? <b>Hardware</b>.' }),
                  h('li', { html: 'Does it need full privilege, or manage processes, memory or files? <b>Kernel</b>.' }),
                  h('li', { html: 'Is it one of the official ways in? <b>System call interface</b>.' }),
                  h('li', { html: 'Does it ship with UNIX but run as a normal program? <b>Commands and libraries</b>.' }),
                  h('li', { html: 'Did someone write it for their own work? <b>Applications</b>.' }))));
          }
          function pick(id) {
            if (mode === 'learn') { cur = id; draw(); learnPanel(); return; }
            if (qi >= ITEMS.length) return;
            const [, ans, why] = ITEMS[qi];
            if (id === ans) {
              results[qi] = tries ? 'warn' : 'ok';
              flashes[id] = 'ok'; draw();
              const fb = h('div', { class: 'callout tip m0 small fade-in', 'data-label': 'Right: ' + L[id].t, html: why });
              qi++; tries = 0; sortPanel(fb);
              ctx.after(700, () => { delete flashes[id]; draw(); });
            } else {
              tries++; flashes[id] = 'bad'; draw();
              sortPanel(h('div', { class: 'callout warn m0 small fade-in', 'data-label': 'Not ' + L[id].t, html: 'Think about who wrote it and whether it needs kernel privilege. Try another layer.' }));
              ctx.after(700, () => { delete flashes[id]; draw(); });
            }
          }
          const seg = ctx.ui.seg([{ value: 'learn', label: 'Explore the layers' }, { value: 'sort', label: 'Sort the software' }], 'learn', (v) => { mode = v; draw(); if (v === 'learn') learnPanel(); else sortPanel(); });
          const intro = h('p', { class: 'm0', html: 'A UNIX system is built in <b>layers</b>. Each layer relies on the one below it, and only the <span class="t">kernel</span> touches the hardware.' });
          const pic = h('div', { class: 'card white', style: { padding: '10px 10px', alignSelf: 'start' } }, svg);
          if (NW) el.append(h('div', { class: 'stack', style: { gap: '10px' } }, intro, seg, pic, panel));   // phones: diagram right under the selector, answers below it
          else el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) 624px', gap: '20px' } },
            h('div', { class: 'stack', style: { gap: '10px' } }, intro, seg, panel), pic));
          draw(); learnPanel();
        },
      },
      /* ---------------- 5. Inside the traditional kernel: explore + route requests ---------------- */
      {
        title: 'Inside the traditional UNIX kernel: click every block',
        kind: 'explore',
        core: true, // on the shorter core path
        render(el, ctx) {
          const { h } = ctx;
          const INFO = {
            user: { half: 'user level', does: 'is ordinary user code, outside the kernel',
              job: 'Ordinary programs running in user mode. They reach the kernel in exactly one way: by executing a <span class="t">trap instruction</span>, either in their own code or, far more often, inside a library routine they call.',
              eg: 'Your program calls <code>read(fd, buf, 512)</code> to get the next 512 bytes of a file.' },
            lib: { half: 'user level', does: 'holds ready-made user-mode routines',
              job: 'Ready-made routines, such as the C library, that programs link with. Many are thin wrappers that put the system call number and arguments where the kernel expects them and execute the trap. Others, like <code>printf</code>, do real work first and then make a system call.',
              eg: 'The library\'s <code>read</code> wrapper is only a handful of instructions long.' },
            sci: { half: 'kernel entry', does: 'only receives calls and passes them on',
              job: 'Where every trap lands. It works out which call was requested (by its number), checks and copies the arguments, and hands the work to the file subsystem or the process control subsystem. On the way out it hands back the result and returns the processor to user mode.',
              eg: '<code>open</code>, <code>read</code> and <code>write</code> go mainly to the file subsystem; <code>fork</code>, <code>exit</code> and <code>wait</code> mainly to process control.' },
            fs: { half: 'file subsystem', does: 'manages files and moves data to and from devices',
              job: 'Manages files: names and directories, permissions, which disk blocks belong to which file, and free space. It moves data between main memory and external devices in two ways: <b>in blocks</b>, through the buffer cache, or <b>as a stream of characters</b>, straight to a character driver.',
              eg: 'Opening <code>/home/ana/notes.txt</code> means walking the directories to find the file, then checking that you may read it.' },
            bc: { half: 'file subsystem', does: 'keeps recently used disk blocks in memory',
              job: 'A pool of buffers in main memory holding copies of recently used disk blocks. Every block request looks here first; only a miss goes to the disk. Writes can also wait here and reach the disk later, in larger batches.',
              eg: 'Compile the same program twice: the second time, most of the source file\'s blocks come straight from the cache.' },
            chr: { half: 'file subsystem', does: 'drives byte-stream devices such as terminals',
              job: 'Drivers for <span class="t">character devices</span>: terminals, printers and modems, which move an unstructured stream of bytes. Their data flows between the file subsystem and the driver without passing through the buffer cache. (A disk can also be opened this way, as a "raw" device.)',
              eg: 'Each key you press on a terminal arrives as one character.' },
            blk: { half: 'file subsystem', does: 'drives block devices such as disks',
              job: 'Drivers for <span class="t">block devices</span>: devices that store data in fixed-size numbered blocks, mainly disks (tapes were handled this way too). They move whole blocks between the device and buffers in the buffer cache.',
              eg: '"Read block 7,412 into buffer 19" is a typical request to a disk driver.' },
            pcs: { half: 'process control', does: 'is the whole process half; pick the specific part',
              job: 'The half of the kernel that manages <span class="t">processes</span>: creating and ending them, sharing the processor among them, giving them memory, and letting them coordinate. Its three parts are memory management, the scheduler (scheduling and dispatching), and synchronization and interprocess communication.',
              eg: '<code>fork</code> (make a new process), <code>exit</code> and <code>wait</code> land here.' },
            ipc: { half: 'process control', does: 'lets processes coordinate and communicate',
              job: 'Synchronization and interprocess communication: <b>signals</b> that tell a process an event happened and <b>pipes</b> that carry data from one process to the next (System V later added messages, shared memory and semaphores). Inside the kernel it also puts a process to <b>sleep</b> until an event it needs (such as a disk transfer finishing) and <b>wakes</b> it afterwards.',
              eg: 'Pressing Ctrl-C sends a signal that asks the running program to stop.' },
            sch: { half: 'process control', does: 'picks which process runs next',
              job: 'Scheduling and dispatching: chooses which ready process runs next, <span class="t">dispatches</span> it by switching the processor to it, and takes the processor back when its time slice ends or it has to wait.',
              eg: 'While one process waits for the disk, the scheduler lets another one run.' },
            mm: { half: 'process control', does: 'hands out memory and swaps processes out',
              job: 'Gives each process its own region of main memory, stops processes from touching each other\'s memory, and moves processes out to disk and back when memory runs short (<span class="t">swapping</span>, and in later versions paging).',
              eg: 'Too many programs at once? Memory management swaps an idle one out to disk.' },
            hwc: { half: 'machine-dependent layer', does: 'handles interrupts and talks to the machine directly',
              job: 'The lowest layer of the kernel. It fields <span class="t">interrupts</span> from the clock, disks and terminals, and communicates with the machine directly: device registers, the timer and the memory-management hardware. Most machine-dependent code lives here.',
              eg: 'The clock interrupts many times a second. Hardware control fields each tick, and the scheduler uses the ticks to tell when a process has used up its time slice.' },
            hw: { half: 'hardware level', does: 'is the physical machine, not kernel code',
              job: 'The physical machine: processor, main memory, disks and terminals. It signals the kernel with interrupts and obeys commands written to its device registers.',
              eg: 'A disk needs milliseconds to fetch a block; a main-memory access takes well under a microsecond, tens of thousands of times faster.' },
          };
          const REQ = [
            ['Decide which ready process gets the processor next, and switch to it', 'sch', 'Scheduling and dispatching belong to the scheduler, inside the process control subsystem.'],
            ['Work out which disk blocks hold the file <code>/home/ana/notes.txt</code>', 'fs', 'Names, directories and the map from a file to its disk blocks are the file subsystem\'s job.'],
            ['A block read a moment ago is needed again: hand it over without touching the disk', 'bc', 'The buffer cache keeps recent blocks in main memory, so a repeat read needs no disk access.'],
            ['Receive the trap, look up which call was requested and check its arguments', 'sci', 'Every trap lands at the system call interface, which identifies the call and passes it to the right subsystem.'],
            ['Find room in memory for a new process, or swap one out when memory is full', 'mm', 'Allocating memory and swapping are memory management, part of the process control subsystem.'],
            ['Send the characters of an error message to a terminal, one byte after another', 'chr', 'A terminal is a character device: bytes flow as a stream to its driver, with no buffer cache.'],
            ['Let one process wait asleep until another sends it a message', 'ipc', 'Sleeping, waking and messages are synchronization and interprocess communication, part of process control.'],
            ['Command the disk controller to read block 7,412 into a buffer', 'blk', 'Disks are block devices; their drivers move whole blocks between the disk and the buffer cache.'],
            ['Field the disk\'s "transfer finished" interrupt', 'hwc', 'Interrupts arrive at hardware control, the kernel\'s lowest, machine-dependent layer, which runs the right handler.'],
          ];
          let mode = 'learn', sel = 'sci', qi = 0, tries = 0, results = [];
          const flash = {};
          const kd = kernelDiagram(ctx, pick);
          const panel = h('div', { class: 'stack grow', style: { gap: '10px' } });
          const paint = () => kd.draw({ sel: mode === 'learn' ? sel : null, flash });
          function learnPanel() {
            const c = KB[sel], I = INFO[sel];
            panel.replaceChildren(
              h('div', { class: 'card info fade-in' },
                h('div', { class: 'row gap-s' }, h('h3', {}, ({ chr: 'Character device drivers', blk: 'Block device drivers' })[sel] || c.t.join(' ')), h('span', { class: 'chip ' + (({ 'file subsystem': 'io', 'process control': 'proc', 'kernel entry': 'accent', 'machine-dependent layer': 'os', 'hardware level': 'cpu' })[I.half] || '') }, I.half)),
                h('p', { html: I.job }), h('div', { class: 'eg', html: I.eg })),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why two halves?', html: 'Nearly every kernel service is about one of two things: <b>running programs</b> (processes, the processor, memory) or <b>storing and moving data</b> (files and devices). The traditional kernel is split the same way.' }));
          }
          function routePanel(fb) {
            const dots = h('div', { class: 'row', style: { gap: '4px' } }, ...REQ.map((_, i) => h('span', { class: 'dot ' + (results[i] || (i === qi ? 'cur' : '')) })));
            if (qi >= REQ.length) {
              const right = results.filter((r) => r === 'ok').length;
              panel.replaceChildren(dots, h('div', { class: 'card info fade-in' }, h('h3', {}, `All ${REQ.length} requests routed: ${right} right first time`),
                h('p', { html: 'Notice the split: anything about <b>files and devices</b> lands on the left (file subsystem, buffer cache, drivers); anything about <b>processes</b> lands on the right (memory, scheduler, IPC); interrupts arrive at <b>hardware control</b>.' }),
                h('button', { class: 'btn sm', type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => { qi = 0; tries = 0; results = []; routePanel(); } }, 'Route them again')));
              return;
            }
            panel.replaceChildren(dots,
              h('div', { class: 'card white stack', style: { gap: '6px' } }, h('div', { class: 'xs muted b' }, `REQUEST ${qi + 1} OF ${REQ.length} · CLICK THE BLOCK THAT HANDLES IT`), h('div', { class: 'u8-item', html: REQ[qi][0] })),
              fb || h('p', { class: 'small muted m0' }, 'Click the most specific block in the diagram.'),
              h('div', { class: 'row gap-s', style: { marginTop: 'auto' } },
                h('span', { class: 'chip ok' }, 'right first time: ' + results.filter((r) => r === 'ok').length),
                h('span', { class: 'chip warn' }, 'needed another try: ' + results.filter((r) => r === 'warn').length),
                h('span', { class: 'xs muted' }, 'Left side of the kernel: files and devices. Right side: processes.')));
          }
          function pick(id) {
            if (mode === 'learn') { sel = id; paint(); learnPanel(); return; }
            if (qi >= REQ.length) return;
            const [, ans, why] = REQ[qi];
            if (id === ans) {
              results[qi] = tries ? 'warn' : 'ok'; flash[id] = 'ok'; paint();
              const fb = h('div', { class: 'callout tip m0 small fade-in', 'data-label': 'Right: ' + KB[id].t.join(' '), html: why });
              qi++; tries = 0; routePanel(fb);
            } else {
              tries++; flash[id] = 'bad'; paint();
              routePanel(h('div', { class: 'callout warn m0 small fade-in', 'data-label': 'Not the ' + KB[id].t.join(' ').toLowerCase(), html: `That block ${INFO[id].does}. Try again.` }));
            }
            ctx.after(650, () => { delete flash[id]; paint(); });
          }
          const seg = ctx.ui.seg([{ value: 'learn', label: 'Explore the blocks' }, { value: 'route', label: 'Route the requests' }], 'learn', (v) => { mode = v; paint(); if (v === 'learn') learnPanel(); else routePanel(); });
          const right = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'The traditional kernel has two main parts, the <span class="t">process control subsystem</span> and the <span class="t">file subsystem</span>, sitting on <span class="t">hardware control</span>. Click any block.' }),
            seg, panel);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : '616px minmax(0, 1fr)', gap: '20px' } },
            h('div', { class: 'card white', style: { padding: '6px 8px', alignSelf: 'start' } }, kd.svg), right));
          paint(); learnPanel();
        },
      },
      /* ---------------- 6. Trace a read() through the kernel ---------------- */
      {
        title: 'Trace a read() from your program to the disk and back',
        kind: 'lab',
        core: true, // on the shorter core path
        render(el, ctx) {
          const { h } = ctx;
          let kd;   // the kernel diagram; built below, once the prediction handler exists
          // one frame = [block the request is at, processor mode, process state, where block 7,412 is, narration]
          const START = [
            ['user', 'user', 'Running', 'on disk only', 'Your program calls <code>read(fd, buf, 512)</code>: "give me the next 512 bytes of the file I opened as <code>fd</code>, and put them in <code>buf</code>". It is running in <b>user mode</b>.'],
            ['lib', 'user', 'Running', 'on disk only', 'The call goes to the C library\'s <b>read wrapper</b>, which puts the number of the read system call and its three arguments where the kernel expects to find them.'],
            ['sci', 'kernel', 'Running', 'on disk only', 'The wrapper executes the <b>trap instruction</b>: the processor switches to <b>kernel mode</b> and enters the <b>system call interface</b>, which sees "read", checks that <code>fd</code> is an open file and that <code>buf</code> lies in the program\'s own memory.'],
            ['fs', 'kernel', 'Running', 'on disk only', 'The <b>file subsystem</b> takes over. From <code>fd</code> it finds the open file and the current position in it, and works out which disk block holds the next 512 bytes: block 7,412.'],
          ];
          const MISS = [
            ['bc', 'kernel', 'Running', 'on disk only', 'It asks the <b>buffer cache</b> for block 7,412. <b>Miss:</b> that block is not in memory, so the cache sets aside a free buffer to receive it.'],
            ['blk', 'kernel', 'Running', 'being read from disk', 'The <b>block device driver</b> tells the disk controller to read block 7,412 into that buffer. The disk must now move and spin into position, which takes milliseconds.'],
            ['ipc', 'kernel', 'Asleep (Blocked)', 'being read from disk', 'Nothing more can happen for this process until the block arrives, so the kernel puts it to <b>sleep</b>, waiting on that buffer. It is now Blocked.'],
            ['sch', 'kernel', 'Asleep (Blocked)', 'being read from disk', 'The <b>scheduler</b> dispatches a different ready process, so the processor does useful work during the long disk transfer instead of sitting idle.'],
            ['hw', 'other', 'Asleep (Blocked)', 'in the buffer cache', 'Milliseconds later, while the other process is still running, the <b>disk</b> finishes copying the block into the buffer and raises an <b>interrupt</b> to say the transfer is done.'],
            ['hwc', 'kernel', 'Asleep (Blocked)', 'in the buffer cache', 'The interrupt briefly stops the other process and puts the processor back in kernel mode. <b>Hardware control</b> fields it and runs the disk driver\'s interrupt handler, which marks the buffer as full and valid.'],
            ['ipc', 'kernel', 'Ready', 'in the buffer cache', 'The kernel <b>wakes up</b> the processes sleeping on that buffer. Ours becomes Ready; when the scheduler picks it again, it carries on inside the kernel where it stopped.'],
            ['fs', 'kernel', 'Running', 'copied into buf', 'Running again, the <b>file subsystem</b> copies the 512 bytes from the buffer into <code>buf</code> in the program\'s memory and moves the file position on by 512.'],
            ['sci', 'kernel', 'Running', 'copied into buf', 'The <b>system call interface</b> puts the result, 512 bytes read, where the program will look for it, and returns from the trap, which switches the processor back to user mode.'],
            ['user', 'user', 'Running', 'copied into buf', '<b>Done.</b> The wrapper returns and <code>n</code> is 512. It took several milliseconds, nearly all of it waiting for the disk, and 14 stops. Block 7,412 now stays in the cache. <b>Next:</b> choose <b>2 · Predict a hit</b>.'],
          ];
          const HIT = [
            ['bc', 'kernel', 'Running', 'in the buffer cache', 'It asks the <b>buffer cache</b> for block 7,412. <b>Hit:</b> the block was used recently and is still in memory. No driver, no disk, no sleeping.'],
            ['fs', 'kernel', 'Running', 'copied into buf', 'The <b>file subsystem</b> copies the 512 bytes from the cached buffer straight into <code>buf</code> and moves the file position on by 512.'],
            ['sci', 'kernel', 'Running', 'copied into buf', 'The <b>system call interface</b> hands back the result, 512 bytes read, and returns from the trap to user mode.'],
            ['user', 'user', 'Running', 'copied into buf', '<b>Done</b> in 8 stops and a few microseconds instead of milliseconds. Everything below the buffer cache was skipped, which is exactly why the kernel keeps one.'],
          ];
          const build = (p) => p === 'miss' ? START.concat(MISS) : START.map((f) => [f[0], f[1], f[2], 'in the buffer cache', f[4]]).concat(HIT);
          let frames = build('miss');
          // prediction game: of the blocks the miss visits, which does a hit skip?
          const ONMISS = new Set(START.concat(MISS).map((f) => f[0]));
          const SKIP = new Set(ONMISS);
          START.concat(HIT).forEach((f) => SKIP.delete(f[0]));          // → blk, ipc, sch, hw, hwc
          const nm = (id) => ({ chr: 'Character drivers', blk: 'Block drivers' })[id] || KB[id].t.join(' ');
          let mode = 'miss', marks = new Set(), checked = false, note = '';
          kd = kernelDiagram(ctx, (id) => { if (mode === 'predict') mark(id); });
          const route = h('div', { class: 'u8-route2' });
          const cMode = h('span', { class: 'chip' }), cProc = h('span', { class: 'chip' }), cBlk = h('span', { class: 'chip mem' });
          // phones: each comment on its own line above the code, so nothing is cut off at the right edge
          const code = ctx.ui.code(ctx.narrow ? `// room for the data
char buf[512];
// get next 512 bytes; n = count
n = read(fd, buf, 512);` : `char buf[512];          // space for the data
n = read(fd, buf, 512); // ask for the next 512 bytes`, { lang: 'c', fontSize: ctx.narrow ? 13.5 : 14 });
          code.mark(ctx.narrow ? 4 : 2);
          const player = ctx.ui.player({ count: frames.length, interval: 2300, speed: false, render: (i) => {
            const f = frames[i];
            kd.draw({ active: f[0], token: f[0], visited: new Set(frames.slice(0, i).map((x) => x[0])), noPick: true });
            // f[1]: 'user' / 'kernel' = the processor is running OUR process in that mode; 'other' = it is running someone else
            cMode.className = 'chip ' + ({ user: 'proc', kernel: 'os', other: '' })[f[1]];
            cMode.textContent = f[1] === 'other' ? 'another process runs' : f[1] + ' mode';
            cProc.className = 'chip ' + (f[2] === 'Running' ? 'ok' : f[2] === 'Ready' ? 'accent' : 'warn'); cProc.textContent = 'process: ' + f[2];
            cBlk.textContent = 'block 7,412: ' + f[3];
            route.replaceChildren(...frames.map((x, j) => j <= i ? h('span', { class: 'chip' + (j === i ? ' accent' : '') }, KB[x[0]].t.join(' ')) : null).filter(Boolean),
              i < frames.length - 1 ? h('span', { class: 'xs muted' }, `… ${frames.length - 1 - i} more`) : h('span', { class: 'chip ok' }, '✓ ' + frames.length + ' stops'));
            return f[4];
          } });
          /* ---- mode 2: predict which blocks a cache hit skips, by clicking them on the diagram ---- */
          const pBody = h('div', { class: 'stack', style: { gap: '9px' } });
          const flashFor = () => {   // before checking: marked = accent; after: right = ok, still needed = bad, missed = warn
            const fl = {};
            ONMISS.forEach((id) => {
              if (!checked) { if (marks.has(id)) fl[id] = 'accent'; }
              else if (marks.has(id)) fl[id] = SKIP.has(id) ? 'ok' : 'bad';
              else if (SKIP.has(id)) fl[id] = 'warn';
            });
            return fl;
          };
          function mark(id) {
            if (!ONMISS.has(id)) { note = `The miss never visited <b>${nm(id)}</b>, so there is nothing for a hit to skip there. Pick blocks from the miss route.`; }
            else { note = ''; checked = false; if (marks.has(id)) marks.delete(id); else marks.add(id); }
            predictPanel();
          }
          function predictPanel() {
            const fl = flashFor(), TAG = { accent: '?', ok: '✓', bad: '✗', warn: '!' }, tag = {};
            Object.keys(fl).forEach((id) => { tag[id] = [TAG[fl[id]], fl[id]]; });
            kd.draw({ flash: fl, tag });
            const picked = [...ONMISS].filter((id) => marks.has(id));
            const chips = picked.length ? picked.map((id) => h('span', { class: 'chip ' + (checked ? (SKIP.has(id) ? 'ok' : 'bad') : 'accent') }, nm(id))) : [h('span', { class: 'xs muted' }, 'nothing marked yet')];
            const ask = h('div', { class: 'card white stack', style: { gap: '6px' } },
              h('div', { class: 'xs muted b' }, 'PREDICT BEFORE YOU WATCH THE HIT'),
              h('div', { class: 'u8-item', style: { fontSize: '17px' }, html: 'Block 7,412 is <b>already in the buffer cache</b>. Which blocks that the miss visited will this read <b>skip</b>?' }),
              h('p', { class: 'small muted m0' }, 'Click each one on the diagram (click again to unmark), then check.'));
            if (!checked) {
              const parts = [ask, h('div', { class: 'u8-route2' }, h('span', { class: 'xs b' }, 'YOU MARKED:'), ...chips)];
              if (note) parts.push(h('p', { class: 'small m0', html: note }));
              parts.push(h('div', { class: 'row gap-s' },
                h('button', { class: 'btn primary sm', type: 'button', disabled: !picked.length, onclick: () => { checked = true; note = ''; predictPanel(); } }, 'Check my prediction'),
                h('button', { class: 'btn sm', type: 'button', disabled: !picked.length, onclick: () => { marks.clear(); note = ''; predictPanel(); } }, 'Clear')));
              pBody.replaceChildren(...parts);
              return;
            }
            const right = picked.filter((id) => SKIP.has(id)).length, wrong = picked.filter((id) => !SKIP.has(id));
            const missed = [...SKIP].filter((id) => !marks.has(id));
            const perfect = right === SKIP.size && !wrong.length;
            pBody.replaceChildren(ask,
              h('div', { class: 'callout m0 small fade-in ' + (perfect ? 'tip' : 'warn'), 'data-label': perfect ? 'Exactly right' : `You found ${right} of the ${SKIP.size}`,
                html: (wrong.length ? `<b>✗ Still needed</b> (red): ${wrong.map(nm).join(', ')}. ` : '') + (missed.length ? `<b>! Also skipped</b> (amber): ${missed.map(nm).join(', ')}. ` : '')
                  + 'A hit still needs the way in and out (your program, the library, the system call interface), the <b>file subsystem</b> to find and copy the data, and the <b>buffer cache</b> where it is found. It skips everything that exists only to fetch a block from the disk and wait for it: the block driver, the disk, hardware control, sleeping and waking, and the scheduler.' }),
              h('div', { class: 'row gap-s' },
                h('button', { class: 'btn primary sm', type: 'button', onclick: () => { seg.set('hit'); setMode('hit'); } }, 'Watch the hit ▶'),
                h('button', { class: 'btn sm', type: 'button', onclick: () => { marks.clear(); checked = false; predictPanel(); } }, 'Try again')));
          }
          const trace = h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'row gap-s' }, cMode, cProc, cBlk),
            player.el,
            h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('div', { class: 'xs muted b' }, 'ROUTE SO FAR'), route),
            h('p', { class: 'small muted m0', html: '<b>Reading the diagram:</b> the dot and the yellow block show where the request is now; faded blocks have not been reached yet. The chips above track the processor mode, our process\'s state and where block 7,412 is.' }));
          function setMode(v) {
            mode = v; player.stop();
            trace.style.display = v === 'predict' ? 'none' : '';
            pBody.style.display = v === 'predict' ? '' : 'none';
            if (v === 'predict') predictPanel();
            else { frames = build(v); player.setCount(frames.length); }
            ctx.refit();
          }
          const seg = ctx.ui.seg([{ value: 'miss', label: '1 · Watch a miss' }, { value: 'predict', label: '2 · Predict a hit' }, { value: 'hit', label: '3 · Watch the hit' }], 'miss', setMode);
          pBody.style.display = 'none';
          const right = h('div', { class: 'stack', style: { gap: '10px' } }, seg, code, trace, pBody);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : '616px minmax(0, 1fr)', gap: '20px' } },
            h('div', { class: 'card white', style: { padding: '6px 8px', alignSelf: 'start' } }, kd.svg), right));
        },
      },
      /* ---------------- 7. One big program: the monolithic kernel ---------------- */
      {
        title: 'One big program: why the kernel is called monolithic',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const SEGS = [['Scheduler'], ['Memory', 'mgmt'], ['IPC'], ['File', 'subsystem'], ['Buffer', 'cache'], ['Terminal', 'driver'], ['Disk', 'driver']];
          const SEGC = ['s-proc', 's-proc', 's-proc', 's-io', 's-mem', 's-io', 's-io'];
          const SEGW = [76, 66, 46, 82, 64, 70, 56];   // relative widths on wide screens, sized to each label (tape driver: 56)
          const A = [
            { st: 'running', users: 12, cap: '<b>A new tape drive arrives.</b> The running kernel has no code for it, and a traditional UNIX kernel cannot take on new code while it runs: drivers are part of the kernel program itself.' },
            { st: 'running', users: 12, src: true, cap: 'A programmer writes the <b>tape driver</b> in C: routines to open, read, write and close the device, plus a handler for its interrupts.' },
            { st: 'running', users: 12, src: true, tbl: true, cap: 'The driver\'s routines are entered in the kernel\'s <b>device switch table</b>, which maps each kind of device (by its major device number) to that driver\'s routines. The table is compiled into the kernel, so this is an edit to kernel source.' },
            { st: 'old image still running', users: 12, tbl: true, built: true, busy: true, cap: 'The <b>entire kernel</b> is recompiled and relinked into a new image file, although only one part changed. All the parts are one program, so they are rebuilt together. Meanwhile the old kernel keeps running.' },
            { st: 'rebooting', users: 0, tbl: true, built: true, cap: 'To run the new image the machine must be <b>rebooted</b>. Every logged-in user is thrown off and every running program stops.' },
            { st: 'running', users: 12, tbl: true, built: true, done: true, cap: 'The new kernel runs with the tape driver <b>inside</b> it, in kernel mode and in the same address space as everything else. Had the driver been badly broken, the machine might not even boot.' },
          ];
          const B = [
            { st: 'running', users: 12, built: true, cap: 'The system runs normally with the tape driver built in. Twelve users are logged in and working.' },
            { st: 'running', users: 12, built: true, bug: true, cap: 'The tape driver has a small bug: its counter runs one step past the end of its buffer, so it writes a byte into memory that is not its own.' },
            { st: 'running', users: 12, built: true, bug: true, hit: true, cap: 'That memory holds the <b>scheduler\'s</b> process table. Nothing stops the write: every part of the kernel runs in kernel mode with access to all kernel memory.' },
            { st: 'PANIC', users: 0, built: true, bug: true, hit: true, panic: true, cap: 'The scheduler soon reads the damaged entry, finds nonsense, and the kernel halts itself with a <b>panic</b>. The whole machine is down and all 12 users lose their unsaved work.' },
            { st: 'PANIC', users: 0, built: true, bug: true, hit: true, panic: true, cap: 'Compare a bug in a <b>user program</b>: memory protection keeps the damage inside that one process, and only it is killed. Inside a monolithic kernel there is no wall between the parts.' },
          ];
          let frames = A, scen = 'add';
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 390' : '0 0 580 264', width: '100%', role: 'img', 'aria-label': 'The kernel image as one program' });
          const cState = h('span', { class: 'chip' }), cUsers = h('span', { class: 'chip proc' }), cParts = h('span', { class: 'chip os' });
          function draw(f) {
            const NW = ctx.narrow;   // phones: segments in two rows of four, panels stacked
            const segs = SEGS.slice(), cls = SEGC.slice(), wts = SEGW.slice();
            if (f.built) { segs.push(['Tape', 'driver']); cls.push('s-io'); wts.push(56); }
            const x0 = 8, y0 = NW ? 40 : 44;
            const W = NW ? 344 : (f.src && !f.built ? 474 : 564), sh = NW ? 62 : 84;
            const unit = W / wts.reduce((a, b) => a + b, 0);
            const segW = (i) => NW ? 86 : wts[i] * unit;
            const pos = (i) => NW ? [x0 + (i % 4) * 86, y0 + Math.floor(i / 4) * sh] : [x0 + wts.slice(0, i).reduce((a, b) => a + b, 0) * unit, y0];
            const barH = NW ? 2 * sh : sh, LY = NW ? 216 : 180;
            const k = [s('rect', { x: x0 - 4, y: y0 - 4, width: W + 8, height: barH + 8, rx: 12, class: f.panic ? 's-bad' : 's-os', 'stroke-width': 2.5 })];
            segs.forEach((sg, i) => {
              const tape = sg[0] === 'Tape', sched = i === 0, [sx, sy] = pos(i);
              let c = cls[i];
              if (f.panic) c = 's-bad';
              else if (sched && f.hit) c = 's-bad';
              else if (tape && f.bug) c = 's-warn';
              else if (tape && !f.done && scen === 'add') c = 's-warn';
              const sw = segW(i);
              const g = s('g', { class: f.busy ? 'pulse' : '' },
                s('rect', { x: sx + 2, y: sy + 2, width: sw - 4, height: sh - 4, rx: 8, class: c, 'stroke-width': 1.5 }),
                s('text', { x: sx + sw / 2, y: sy + (sg[1] ? sh / 2 - 4 : sh / 2 + 5), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, 'letter-spacing': '-.01em' }, sg[0]),
                sg[1] ? s('text', { x: sx + sw / 2, y: sy + sh / 2 + 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, 'letter-spacing': '-.01em' }, sg[1]) : null);
              k.push(g);
            });
            if (f.src && !f.built) {
              const [bx, by, bw, bh] = NW ? [268, LY + 8, 84, 60] : [494, y0, 76, sh];
              k.push(s('rect', { x: bx, y: by, width: bw, height: bh, rx: 10, class: 's-warn', 'stroke-width': 2, 'stroke-dasharray': '5 4' }),
                s('text', { x: bx + bw / 2, y: by + bh / 2 - 3, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'tape.c'),
                s('text', { x: bx + bw / 2, y: by + bh / 2 + 15, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, '(new)'));
            }
            if (f.hit) {
              if (NW) {
                const [tx, ty] = pos(7), [qx, qy] = pos(0);
                k.push(s('line', { x1: tx + 20, y1: ty + 14, x2: qx + segW(0) - 10, y2: qy + sh - 10, style: 'stroke:var(--intr)', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', 'marker-end': 'url(#arr-intr)' }),
                  s('text', { x: 180, y: 24, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--intr)' }, 'stray write into the scheduler\'s table'));
              } else {
                const xt = pos(7)[0] + segW(7) / 2, xs = x0 + segW(0) / 2;   // from the tape driver to the scheduler
                k.push(s('path', { d: `M${xt},${y0 - 4} C${xt},2 ${xs},2 ${xs},${y0 - 6}`, fill: 'none', style: 'stroke:var(--intr)', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', 'marker-end': 'url(#arr-intr)' }),
                  s('text', { x: (xt + xs) / 2, y: 33, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--intr)' }, 'stray write into the scheduler\'s table'));
              }
            }
            if (f.panic) {
              const cx = NW ? 180 : 290, cy = NW ? y0 + sh - 18 : y0 + 24;
              k.push(s('rect', { x: cx - 120, y: cy, width: 240, height: 36, rx: 8, style: 'fill:var(--intr);stroke:none' }),
                s('text', { x: cx, y: cy + 24, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: 'fill:var(--panel)' }, 'panic: kernel halted'));
            }
            k.push(s('text', { x: 12, y: y0 + barH + 24, 'font-size': 13.5, 'font-weight': 700 }, f.busy ? 'recompiling and relinking every part…' : NW ? 'one file, one program, one address space' : 'the kernel image: one file, one program, one address space'));
            // lower left: the device switch table, or the bug
            if (scen === 'add') {
              k.push(s('text', { x: 12, y: LY, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, 'DEVICE SWITCH TABLE'));
              const rows = NW ? [['0', 'terminal', 'terminal routines'], ['1', 'disk', 'disk routines'], ['2', 'tape', f.tbl ? 'tape routines (new)' : '(no driver)']]
                : [['0', 'terminal', 'terminal driver routines'], ['1', 'disk', 'disk driver routines'], ['2', 'tape', f.tbl ? 'tape driver routines (new)' : '(no driver)']];
              rows.forEach((r, i) => {
                const y = LY + 22 + i * 22, isNew = i === 2 && f.tbl;
                if (isNew) k.push(s('rect', { x: 8, y: y - 16, width: NW ? 246 : 284, height: 21, rx: 5, style: 'fill:var(--hl);stroke:none' }));
                k.push(s('text', { x: 14, y, 'font-size': 13.5, class: 's-monot' }, r[0]), s('text', { x: 32, y, 'font-size': 13.5 }, r[1] + ' →'), s('text', { x: NW ? 106 : 112, y, 'font-size': 13.5, class: i === 2 && !f.tbl ? 's-sub' : '' }, r[2]));
              });
            } else {
              k.push(s('text', { x: 12, y: LY, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, 'THE BUG, INSIDE THE TAPE DRIVER'),
                s('rect', { x: 8, y: LY + 10, width: 280, height: 56, rx: 8, class: f.bug ? 's-warn' : 's-panel', 'stroke-width': 1.5 }),
                s('text', { x: 18, y: LY + 32, 'font-size': 13, class: 's-monot' }, 'buf[n] = b;  // store next byte'),
                s('text', { x: 18, y: LY + 54, 'font-size': 13, class: 's-monot' }, 'n = n + 1;   // never checks size!'));
            }
            // the users' processes (right of the table on wide screens, below it on phones)
            const UX = NW ? 12 : 306, UY = NW ? LY + 100 : 180, UG = NW ? 56 : 44, UW = NW ? 48 : 38;
            k.push(s('text', { x: UX, y: UY, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, 'USERS\' PROCESSES'));
            for (let i = 0; i < 12; i++) {
              const x = UX + (i % 6) * UG, y = UY + 12 + Math.floor(i / 6) * 32, on = f.users > 0;
              k.push(s('rect', { x, y, width: UW, height: 24, rx: 6, class: on ? 's-proc' : 's-panel', 'stroke-width': 1.5, opacity: on ? 1 : 0.6 }),
                s('text', { x: x + UW / 2, y: y + 17, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: on ? '' : 's-sub' }, on ? 'P' + (i + 1) : '✗'));
            }
            svg.replaceChildren(...k);
            cState.className = 'chip ' + (f.st === 'running' ? 'ok' : f.st === 'PANIC' ? 'bad' : 'warn'); cState.textContent = 'kernel: ' + f.st;
            cUsers.className = 'chip ' + (f.users ? 'proc' : 'bad'); cUsers.textContent = f.users + ' users logged in';
            cParts.textContent = f.busy ? 'new image: 8 parts' : (f.built ? 8 : 7) + ' parts in one image';
          }
          const player = ctx.ui.player({ count: frames.length, interval: 2600, render: (i) => { draw(frames[i]); return frames[i].cap; } });
          const seg = ctx.ui.seg([{ value: 'add', label: 'Add a device driver' }, { value: 'bug', label: 'A bug in one driver' }], 'add', (v) => { scen = v; frames = v === 'add' ? A : B; player.setCount(frames.length); });
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'Every kernel block from the last two steps is compiled and linked into <b>one program</b>, the kernel image, loaded when the machine starts. It runs in kernel mode in one shared <span class="t">address space</span>, and any part can call any other directly. That is a <span class="t">monolithic kernel</span> (the opposite of the microkernel in section 2.4), and it is <b>not very modular</b>.' }),
            h('div', { class: 'grid-2', style: { gap: '10px' } },
              h('div', { class: 'card tight', style: { borderLeft: '4px solid var(--ok)' } }, h('div', { class: 'b small', style: { color: 'var(--ok)' } }, 'The upside'), h('p', { class: 'small m0' }, 'Fast and simple: a call from the file subsystem to a driver is an ordinary function call, with no messages or copying.')),
              h('div', { class: 'card tight', style: { borderLeft: '4px solid var(--bad)' } }, h('div', { class: 'b small', style: { color: 'var(--bad)' } }, 'The cost'), h('p', { class: 'small m0' }, 'Any change means rebuilding the whole program, and a bug anywhere can bring down everything.'))),
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"Monolithic" does not mean disorganised: the kernel has clear parts, as you saw. It means nothing <b>separates</b> those parts while they run: one program, one address space, full privilege everywhere.' }),
            h('p', { class: 'small muted m0', html: 'Where it goes next: modern UNIX systems (2.9) and Linux (2.10) keep a fast single-program core but add modular pieces that can be loaded while the system runs.' }));
          const right = h('div', { class: 'stack', style: { gap: '8px' } },
            seg,
            h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),
            h('div', { class: 'row gap-s' }, cState, cUsers, cParts),
            player.el);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1fr) 612px', gap: '20px' } }, left, right));
        },
      },
      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: traditional UNIX in six cards',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '14px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If you hesitate, go back to that step.'),
            ctx.ui.flipcards([
              ['Where and when did UNIX begin?', '<div>At <b>Bell Labs</b>, built by Ken Thompson and Dennis Ritchie. It was running on a <b>PDP-7 by 1970</b> and soon moved to the <b>PDP-11</b>.</div>'],
              ['Why was the 1973 rewrite in C a milestone?', '<div>Operating systems were almost all written in <b>assembly</b>. C showed a <b>high-level language</b> works for most system code: easier to read, change and port. Only a small machine-dependent part is rewritten per machine.</div>'],
              ['What are the two big branches of the family?', '<div><b>AT&amp;T</b>: System III, System V, SVR4. <b>Berkeley (BSD)</b>: 3BSD brought virtual memory, 4.2BSD built in TCP/IP networking. Both grew from Versions 6 and 7.</div>'],
              ['Name the layers of a UNIX system, bottom to top.', '<div>Hardware → kernel → <b>system call interface</b> (the boundary) → commands and libraries (shells, compilers, utilities) → user-written applications.</div>'],
              ['What are the two main parts of the traditional kernel?', '<div><b>Process control</b>: memory management, scheduling and dispatching, synchronization and IPC. <b>File subsystem</b>: buffer cache, character and block drivers. Both sit on <b>hardware control</b>.</div>'],
              ['Why is the traditional kernel called monolithic?', '<div>It is <b>one big program</b> in one address space, all in kernel mode. Fast, but <b>not very modular</b>: changes mean rebuilding it, and a bug anywhere can crash everything.</div>'],
            ], { cols: 3, height: 222 })));
        },
      },

      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself: traditional UNIX',
        kind: 'check',
        quiz: [
          { q: 'Where was UNIX first developed, and on which machine was it running by 1970?',
            choices: ['At UC Berkeley, on a DEC VAX', 'At IBM, on a System/360 mainframe', 'At Bell Labs, on a DEC PDP-7', 'At MIT, on the Multics computer'], answer: 2,
            feedback: ['Berkeley\'s BSD work began only in 1978, building on Version 6, and DEC did not ship the VAX until 1977.', 'IBM mainframes ran IBM\'s own operating systems. UNIX came from Bell Labs and started on a small DEC minicomputer.', null, 'Bell Labs had worked on the large Multics project, but UNIX was a separate, much smaller system written after Bell Labs left it.'],
            why: 'Ken Thompson and Dennis Ritchie built UNIX at Bell Labs. It was running on a little-used PDP-7 by 1970 and then moved to the PDP-11.' },
          { q: 'Why is the 1973 rewrite of UNIX in C seen as a milestone?',
            choices: ['C code runs faster than hand-written assembly, so UNIX became the fastest operating system of its day',
              'It showed that a high-level language, not assembly, works for most of an OS, making it easier to understand, change and port',
              'Writing it in C removed every piece of machine-dependent code from the kernel',
              'C let UNIX run programs that had been written for any other operating system'], answer: 1,
            feedback: ['The C version was in fact somewhat larger and slower than tuned assembly. The gain was readability and portability, not speed.', null, 'A small machine-dependent part (trap and interrupt entry, device registers, drivers) still had to be written for each new machine.', 'Running another system\'s programs is a matter of compatible interfaces, not of the language the kernel is written in.'],
            why: 'Before UNIX, almost every OS was written in the assembly language of one machine. The C rewrite proved a high-level language was good enough for most of an OS, so moving UNIX to a new machine meant recompiling most of it rather than rewriting it.' },
          { type: 'order', q: 'Put these events in the order they happened.',
            items: ['UNIX runs on a PDP-7 at Bell Labs', 'UNIX moves to the PDP-11', 'The kernel is rewritten in C', 'Version 6 is licensed widely to universities', 'AT&T releases System V', 'SVR4 merges System V with popular BSD features'],
            why: 'PDP-7 (1970), PDP-11 (1971), C rewrite (1973), Version 6 (1975), System V (1983), SVR4 (1989).' },
          { type: 'bucket', q: 'Which branch of the UNIX family does each item belong to?', buckets: ['AT&T line (System III / V)', 'Berkeley line (BSD)'],
            items: [['System III, the first commercial release', 0], ['TCP/IP networking built into the kernel', 1], ['Virtual memory with paging on the VAX', 1], ['Licensed to computer makers, leading to AIX and HP-UX', 0], ['Developed at the University of California', 1], ['SVR4, which later absorbed BSD features', 0], ['Lives on in FreeBSD and inside macOS', 1]],
            why: 'AT&T sold System III, System V and later SVR4 to companies. Berkeley\'s releases added virtual memory (3BSD) and TCP/IP (4.2BSD), and continue today in FreeBSD and macOS.' },
          { type: 'order', q: 'Order the layers of a UNIX system from the hardware up to the user.',
            items: ['Hardware', 'Kernel', 'System call interface', 'Commands and libraries', 'User-written applications'],
            why: 'The kernel sits directly on the hardware. The system call interface is its boundary with everything above: commands and libraries (shells, compilers, utilities, the C library) and then the applications people write.' },
          { type: 'tf', q: 'The shell is part of the UNIX kernel, because it runs every command you type.', answer: false,
            why: 'The shell is an ordinary user-mode program in the commands-and-libraries layer. It asks the kernel to start commands through system calls, as any program could.' },
          { type: 'tf', q: 'A user program can reach UNIX kernel services only by calling a library routine.', answer: false,
            why: 'A program may make a system call directly, or call a library routine that makes the call for it. Either way the request enters the kernel through the system call interface.' },
          { type: 'bucket', q: 'Which part of the traditional UNIX kernel contains each component?', buckets: ['Process control subsystem', 'File subsystem'],
            items: [['Memory management', 0], ['Scheduling and dispatching', 0], ['Synchronization and interprocess communication', 0], ['Buffer cache', 1], ['Character device drivers', 1], ['Block device drivers', 1]],
            why: 'Process control manages processes: their memory, their turns on the processor and their coordination. The file subsystem moves data between memory and devices, in blocks through the buffer cache or as character streams.' },
          { type: 'match', q: 'Match each part of the traditional kernel with its job.',
            pairs: [['System call interface', 'Receives each trap and passes the call to the right subsystem'], ['Buffer cache', 'Keeps copies of recently used disk blocks in main memory'], ['Scheduler', 'Chooses which ready process runs next'], ['Hardware control', 'Handles interrupts and talks to the machine directly'], ['Block device driver', 'Moves whole blocks between a disk and memory']],
            why: 'The system call interface is the way in; the buffer cache and block drivers serve the file subsystem; the scheduler belongs to process control; hardware control is the machine-dependent bottom layer.' },
          { q: 'A program reads a disk block that is already in the buffer cache. Which part is <b>not</b> needed for this read?',
            choices: ['The system call interface', 'The file subsystem', 'The buffer cache', 'The block device driver'], answer: 3,
            feedback: ['Every system call, hit or miss, enters the kernel through the system call interface.', 'The file subsystem still finds the block number and copies the data into the program\'s buffer.', 'The buffer cache is where the block is found; it is the reason the disk can be skipped.', null],
            why: 'On a cache hit the data is already in memory, so the kernel never needs the disk driver, the disk or an interrupt, and the process never has to sleep.' },
          { type: 'multi', q: 'Which statements describe the traditional UNIX kernel?',
            choices: ['It is monolithic: one large program in one address space', 'It is not very modular', 'Each device driver runs as a separate user-mode server process', 'Adding a new device driver usually meant rebuilding the kernel and rebooting', 'A bug in any part of it can crash the whole system'], answer: [0, 1, 3, 4],
            why: 'All the parts are compiled into one program that runs in kernel mode. Drivers live inside it, not in separate servers (that is the microkernel idea), so a change means a rebuild and a bug anywhere can bring everything down.' },
          { type: 'num', q: 'A kernel has 10,000 lines of code, of which 1,000 are machine-dependent. It is written in C. How many lines must be rewritten by hand to port it to 3 new machines?', answer: 3000, tol: 0, unit: 'lines',
            why: 'Only the machine-dependent part is rewritten for each machine: 3 × 1,000 = 3,000 lines; the other 9,000 lines are simply recompiled. Written in assembly, the port would need 3 × 10,000 = 30,000 lines.' },
        ],
      },
    ],

    notes: `
<h3>What traditional UNIX is</h3>
<p><b>UNIX</b> is a multiuser, time-sharing operating system built at <b>Bell Labs</b> by <b>Ken Thompson</b> and <b>Dennis Ritchie</b>. Work began in 1969 on a spare DEC PDP-7 minicomputer; by <b>1970</b> it was running and had its name. It stood out because most of it was written in a high-level language (C), it was small and simple (a compact kernel plus many small programs users combine), and its source code was licensed cheaply to universities. Its descendants (FreeBSD, macOS, Solaris, AIX) and look-alikes (Linux, Android) still run much of today's computing.</p>
<h3>History and the family tree</h3>
<table>
<tr><th>When</th><th>What happened</th><th>Why it mattered</th></tr>
<tr><td>1970</td><td>Running on a PDP-7 at Bell Labs, in assembly</td><td>A small, practical system built by programmers for themselves</td></tr>
<tr><td>1971</td><td>Moved to the DEC PDP-11</td><td>Still assembly: the move meant rewriting everything</td></tr>
<tr><td>1973</td><td>Kernel rewritten in C</td><td>A milestone: almost every OS had been written in assembly</td></tr>
<tr><td>1975</td><td>Version 6</td><td>First widely used outside Bell Labs; licensed to universities with source code</td></tr>
<tr><td>1978 on</td><td>BSD releases, UC Berkeley</td><td>3BSD (1979): virtual memory on the VAX. 4.2BSD (1983): TCP/IP networking and sockets. Then 4.3BSD and 4.4BSD</td></tr>
<tr><td>1979</td><td>Version 7</td><td>Made portable (lessons from the Interdata 8/32 port; UNIX/32V ran it on the VAX); ancestor of nearly every later UNIX</td></tr>
<tr><td>1982, 1983</td><td>AT&amp;T System III (first commercial release), then System V</td><td>Supported UNIX licensed to computer makers (AIX, HP-UX)</td></tr>
<tr><td>1989</td><td>SVR4</td><td>Merged System V with popular BSD features (section 2.9)</td></tr>
</table>
<p>Two branches grew from the research versions: the <b>AT&amp;T line</b> (System III → System V → SVR4 → Solaris, AIX, HP-UX) and the <b>Berkeley (BSD) line</b> (1BSD → 3BSD → 4.xBSD → FreeBSD, NetBSD, OpenBSD, parts of macOS). The Berkeley line was especially influential because it brought <b>virtual memory</b> (paging, from 3BSD on the VAX) and <b>TCP/IP networking</b>, the Internet's protocols, plus sockets (4.2BSD). Linux (1991) is a look-alike that shares no UNIX code (section 2.10).</p>
<h3>Why the rewrite in C mattered</h3>
<p><b>Assembly language</b> is tied to one processor family, so an OS written in it must be rewritten line by line for a different processor. <b>C</b> is a <b>high-level language</b>: a <b>compiler</b> translates the same source into instructions for any processor it supports. After the rewrite, only the <b>machine-dependent code</b> (trap and interrupt entry, context switching, device drivers) had to be rewritten for a new machine; the rest was recompiled. Each new processor also needed a C compiler, once, after which every C program could move across.</p>
<p><b>Worked example.</b> An illustrative 10,000-line kernel has 1,000 machine-dependent lines (90% portable). Porting it to four new machines means rewriting 4 × 10,000 = <b>40,000</b> lines in assembly but only 4 × 1,000 = <b>4,000</b> lines in C: a ten-to-one saving on every machine. The price was a kernel somewhat larger and slower than hand-tuned assembly. <b>Common mistake:</b> C did not make UNIX portable for free; each machine still needed a compiler and a rewritten machine-dependent part.</p>
<h3>The layers of a UNIX system</h3>
<ol>
<li><b>Hardware</b>: processor, memory, disks, terminals.</li>
<li><b>Kernel</b>: runs in kernel mode; the only software that talks to the hardware directly.</li>
<li><b>System call interface</b>: the <b>boundary with the user</b>, a fixed set of entry points (open, read, write, fork, exec, wait...) that lets higher-level software reach specific kernel functions. A program enters it with a <b>trap instruction</b>, which switches to kernel mode.</li>
<li><b>Commands and libraries</b>: shells, compilers, editors, utilities (ls, sort) and libraries such as the C library. All are ordinary user-mode programs; the shell is <b>not</b> part of the kernel.</li>
<li><b>User-written applications</b>.</li>
</ol>
<p>User programs invoke OS services <b>directly</b> (a system call such as write) or <b>through a library routine</b> (such as printf, which makes the system call for them). Either way the request crosses the system call interface.</p>
<h3>Inside the traditional UNIX kernel</h3>
<p>User programs and libraries <b>trap</b> into the <b>system call interface</b>, which identifies the call, checks its arguments and passes it to one of two main parts. Both sit on <b>hardware control</b>.</p>
<table>
<tr><th>Part</th><th>Contains</th><th>Job</th></tr>
<tr><td rowspan="3"><b>Process control subsystem</b></td><td>Memory management</td><td>Gives processes memory, protects them, swaps them out when memory is short</td></tr>
<tr><td>Scheduler</td><td>Scheduling and dispatching: picks the next ready process and switches to it</td></tr>
<tr><td>Synchronization and IPC</td><td>Signals and pipes (System V later added messages, shared memory, semaphores); sleep until an event, then wake up</td></tr>
<tr><td rowspan="3"><b>File subsystem</b></td><td>File management</td><td>Names, directories, permissions, which blocks belong to which file</td></tr>
<tr><td>Buffer cache</td><td>Recently used disk blocks kept in main memory; checked first</td></tr>
<tr><td>Character and block device drivers</td><td>Move data <b>as a stream of characters</b> (terminals; no cache) or <b>in blocks</b> (disks; through the buffer cache)</td></tr>
<tr><td><b>Hardware control</b></td><td>Interrupt handling</td><td>Lowest, machine-dependent layer: fields interrupts, talks to the machine</td></tr>
</table>
<h3>Following one read() call</h3>
<p><b>Miss (14 stops):</b> the program calls read(fd, buf, 512) in user mode → the library wrapper sets up the call → trap to kernel mode; the system call interface checks it → the file subsystem finds the disk block → the buffer cache misses and picks a free buffer → the block driver starts the disk → the process sleeps (Blocked) → the scheduler runs another process → the disk interrupts when done → hardware control runs the driver's handler, the buffer is valid → the process is woken (Ready) → the file subsystem copies 512 bytes into buf → return from the trap to user mode → read returns 512. It takes milliseconds, nearly all waiting for the disk.</p>
<p><b>Hit (8 stops):</b> the same first four stops, a cache hit, the copy, the return: microseconds. A hit still needs the system call interface, the file subsystem and the buffer cache, but it <b>skips</b> the block driver, the disk, hardware control, sleeping and waking (IPC) and the scheduler. That is why the kernel keeps a buffer cache.</p>
<h3>A monolithic kernel</h3>
<p>All the parts are linked into <b>one program</b>, the kernel image, running in kernel mode in <b>one address space</b>, where any part can call any other directly. This <b>monolithic</b> design is fast and simple but <b>not very modular</b>. Adding a driver meant writing it, entering it in the kernel's device switch table, rebuilding the whole kernel and rebooting (logging every user off). A bug in any part, such as a driver writing past its buffer into the scheduler's tables, can crash the whole system with a panic, while a bug in a user program kills only that process. The opposite design, a <b>microkernel</b>, keeps drivers and other services outside the kernel as separate user-mode server processes. Modern UNIX (2.9) and Linux (2.10) keep a monolithic core but add modules that can be loaded while the system runs.</p>
`,
  });
})();
