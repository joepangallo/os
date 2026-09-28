// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.8 Traditional Unix Systems
   Original teaching material. Built step by step.
   Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  /* ------------------------------------------------------------------ shared helper
     The traditional UNIX kernel as a block diagram (viewBox 600 x 502), used by the
     "inside the kernel" step and the read() trace. draw(state) repaints from scratch:
       state.sel      id of the clicked block (thick outline)
       state.active   id of the block the trace is at (highlighted)
       state.visited  Set of ids already passed (kept normal; others dimmed while tracing)
       state.flash    { id: 'ok' | 'bad' | 'warn' } colouring for the games and the prediction
       state.token    id where the moving dot sits, or null
       state.noPick   true: blocks are not clickable in this drawing               */
  const KB = {  // KB: every block of the kernel diagram for wide screens, keyed by a short id; r = [x, y, width, height]
    user: { r: [70, 20, 180, 44], cls: 's-proc', t: ['User programs'] },  // block "user": user programs at top left; cls picks the colour class, t holds the label lines
    lib: { r: [370, 20, 180, 44], cls: 's-panel', t: ['Libraries'] },  // block "lib": the libraries box at top right, also outside the kernel
    sci: { r: [46, 124, 534, 36], cls: 's-accent', t: ['System call interface'] },  // block "sci": the wide system call interface bar that every trap lands on
    fs: { r: [46, 194, 224, 44], cls: 's-io', t: ['File subsystem'] },  // block "fs": the file subsystem, on the left half of the kernel
    bc: { r: [120, 268, 150, 36], cls: 's-mem', t: ['Buffer cache'] },  // block "bc": the buffer cache, drawn under the file subsystem
    chr: { r: [46, 334, 94, 48], cls: 's-io', t: ['Character', 'drivers'] },  // block "chr": character device drivers, label split over two lines
    blk: { r: [152, 334, 118, 48], cls: 's-io', t: ['Block', 'drivers'] },  // block "blk": block device drivers, next to the character drivers
    pcs: { r: [316, 178, 264, 188], cls: 's-proc', t: ['Process control subsystem'], box: true },  // block "pcs": the big process control box; box: true means its label sits at the top and parts go inside
    ipc: { r: [332, 212, 232, 38], cls: 's-panel', t: ['IPC and synchronization'], inner: true },  // block "ipc": synchronization and interprocess communication, first part inside the process box (inner: true)
    sch: { r: [332, 262, 232, 38], cls: 's-panel', t: ['Scheduler'], inner: true },  // block "sch": the scheduler, middle part inside the process box
    mm: { r: [332, 312, 232, 38], cls: 's-panel', t: ['Memory management'], inner: true },  // block "mm": memory management, bottom part inside the process box
    hwc: { r: [46, 402, 534, 34], cls: 's-os', t: ['Hardware control'] },  // block "hwc": hardware control, the wide bar at the bottom of the kernel
    hw: { r: [46, 458, 534, 36], cls: 's-cpu', t: ['Hardware'], sub: 'processor · memory · disks · terminals' },  // block "hw": the physical hardware under the kernel; sub is the smaller second line of text
  };  // closes the KB block table for wide screens
  const KB_ORDER = ['user', 'lib', 'sci', 'fs', 'bc', 'chr', 'blk', 'pcs', 'ipc', 'sch', 'mm', 'hwc', 'hw'];  // KB_ORDER: the order the blocks are drawn in, so the big process box is painted before the parts inside it
  const KB_ARROWS = [ // x1, y1, x2, y2
    [250, 42, 366, 42], [160, 64, 160, 120], [460, 64, 460, 120],  // arrows from user programs to libraries and from both down to the system call interface
    [158, 160, 158, 190], [448, 160, 448, 174],  // arrows from the system call interface down into the file subsystem and the process box
    [270, 209, 312, 209], [316, 224, 274, 224],  // the pair of arrows between the file subsystem and process control, one each way
    [195, 238, 195, 264], [211, 304, 211, 330], [80, 238, 80, 330],  // arrows from the file subsystem to the buffer cache, the cache to block drivers, and straight down to character drivers
    [93, 382, 93, 398], [211, 382, 211, 398], [448, 366, 448, 398],  // arrows from the drivers and the process box down into hardware control
    [305, 436, 305, 454], [321, 458, 321, 440],  // arrows between hardware control and the hardware, one down and one back up (interrupts)
  ];  // closes the KB_ARROWS list
  /* the same diagram re-laid for phones (viewBox 360 x 540): same blocks and arrows, a narrower grid,
     so labels stay about 13 px on a 390 px screen instead of shrinking to 8 px */
  const KBN = {  // KBN: the same blocks re-laid for phone-width screens, so the labels stay readable
    user: { r: [30, 14, 150, 42], cls: 's-proc', t: ['User programs'] },  // phone block "user": user programs at top left
    lib: { r: [198, 14, 150, 42], cls: 's-panel', t: ['Libraries'] },  // phone block "lib": libraries at top right
    sci: { r: [30, 104, 318, 36], cls: 's-accent', t: ['System call interface'] },  // phone block "sci": the system call interface bar
    fs: { r: [30, 172, 136, 40], cls: 's-io', t: ['File subsystem'] },  // phone block "fs": the file subsystem, a slimmer box on the left
    bc: { r: [60, 234, 106, 36], cls: 's-mem', t: ['Buffer cache'] },  // phone block "bc": the buffer cache under the file subsystem
    chr: { r: [30, 296, 78, 48], cls: 's-io', t: ['Character', 'drivers'] },  // phone block "chr": character drivers
    blk: { r: [114, 296, 66, 48], cls: 's-io', t: ['Block', 'drivers'] },  // phone block "blk": block drivers
    pcs: { r: [192, 166, 156, 208], cls: 's-proc', t: ['Process control', 'subsystem'], box: true },  // phone block "pcs": the process control box, its label split over two lines to fit
    ipc: { r: [201, 212, 138, 46], cls: 's-panel', t: ['IPC and', 'synchronization'], inner: true },  // phone block "ipc": IPC and synchronization inside the process box, on two lines
    sch: { r: [201, 266, 138, 40], cls: 's-panel', t: ['Scheduler'], inner: true },  // phone block "sch": the scheduler inside the process box
    mm: { r: [201, 314, 138, 46], cls: 's-panel', t: ['Memory', 'management'], inner: true },  // phone block "mm": memory management inside the process box, on two lines
    hwc: { r: [30, 404, 318, 34], cls: 's-os', t: ['Hardware control'] },  // phone block "hwc": hardware control bar
    hw: { r: [30, 474, 318, 56], cls: 's-cpu', t: ['Hardware'], sub: 'processor · memory · disks · terminals' },  // phone block "hw": the hardware bar, taller so its second line fits below the name
  };  // closes the KBN phone block table
  const KBN_ARROWS = [  // KBN_ARROWS: the same fifteen arrows as KB_ARROWS, moved to fit the phone layout (x1, y1, x2, y2)
    [180, 35, 194, 35], [105, 56, 105, 100], [273, 56, 273, 100],  // phone arrows: user programs to libraries, and both down to the system call interface
    [98, 140, 98, 168], [270, 140, 270, 162],  // phone arrows: into the file subsystem and into the process box
    [166, 184, 188, 184], [192, 200, 170, 200],  // phone arrows: the two-way link between the file subsystem and process control
    [120, 212, 120, 230], [147, 270, 147, 292], [44, 212, 44, 292],  // phone arrows: file subsystem to buffer cache, cache to block drivers, and down to character drivers
    [69, 344, 69, 400], [147, 344, 147, 400], [270, 374, 270, 400],  // phone arrows: drivers and process box down into hardware control
    [180, 438, 180, 470], [196, 474, 196, 442],  // phone arrows: hardware control down to the hardware and back up for interrupts
  ];  // closes the KBN_ARROWS list
  function kernelDiagram(ctx, onPick) {  // kernelDiagram(ctx, onPick): builds the clickable kernel picture used by steps 5 and 6; onPick runs when a block is clicked
    const { s } = ctx;  // s is the guide's helper that creates SVG (the browser's drawing format) elements with their attributes and children
    const NW = ctx.narrow, G = NW ? KBN : KB;  // NW is true on phone-width screens; G is whichever block table fits the screen
    const kbSpot = (id) => { const [x, y, w] = G[id].r; return [x + w - 8, y + 6]; };   // the token rides on the block's top-right corner
    const svg = s('svg', { viewBox: NW ? '0 0 360 540' : '0 0 600 502', width: '100%', role: 'img', 'aria-label': 'Traditional UNIX kernel block diagram' });  // creates the SVG drawing; its viewBox (internal coordinate system) matches the chosen layout and it scales to full width
    const base = s('g', {});  // base is a group that holds every block and arrow; draw() refills it each time
    const tok = s('circle', { class: 'tok', cx: 0, cy: 0, r: 10, style: 'fill:var(--accent);stroke:var(--panel);stroke-width:3;opacity:0' });  // tok is the round dot that shows where a traced request is; it starts invisible (opacity 0)
    svg.append(base, tok);  // puts the blocks group into the drawing, with the dot added last so it sits on top of the blocks
    const region = (x, y, w, hh, col) => s('rect', { x, y, width: w, height: hh, rx: 12, fill: 'none', style: `stroke:var(--${col})`, 'stroke-width': 1.5, 'stroke-dasharray': '6 5' });  // region(): a dashed rounded rectangle used to outline the user area and the kernel area
    const side = (x, y, t) => s('text', { x, y, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.1em', transform: `rotate(-90 ${x} ${y})` }, t);  // side(): a rotated label written up the left edge ("USER" or "KERNEL")
    const trap = (x, y) => s('text', { x, y, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, 'trap');  // trap(): the small word "trap" printed where calls cross into the kernel
    function draw(st = {}) {  // draw(st): repaints the whole diagram from the state object described in the comment above
      const tracing = !!st.visited;  // tracing is true while the read() trace runs, because only then is a visited set supplied
      const k = NW  // k collects everything to draw, starting with the two dashed regions, their side labels and the trap marks
        ? [region(22, 4, 334, 62, 'line-2'), region(22, 74, 334, 372, 'os'), side(11, 35, 'USER'), side(11, 260, 'KERNEL'), trap(111, 88), trap(279, 88)]  // phone layout: user and kernel regions, their labels, and two "trap" marks
        : [region(30, 4, 566, 76, 'line-2'), region(30, 88, 566, 358, 'os'), side(16, 42, 'USER'), side(16, 267, 'KERNEL'),  // wide layout: the same regions and side labels at wide-screen positions
          s('text', { x: 310, y: 36, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'calls'), trap(170, 98), trap(470, 98)];  // wide layout only: a "calls" label between user programs and libraries, then the two "trap" marks
      (NW ? KBN_ARROWS : KB_ARROWS).forEach(([x1, y1, x2, y2]) => k.push(s('line', { x1, y1, x2, y2, class: 's-line', 'stroke-width': 2, 'marker-end': 'url(#arr)', opacity: tracing ? 0.5 : 1 })));  // adds every arrow with an arrowhead; arrows fade to half strength during a trace so the path stands out
      KB_ORDER.forEach((id) => {  // draws each block in KB_ORDER
        const c = G[id], [x, y, w, hh] = c.r;  // c is the block's entry in the table; x, y, w and hh are its position and size
        const act = st.active === id, fl = st.flash && st.flash[id];  // act is true for the block the trace is at now; fl is its colour name from the games (ok, bad, warn), if any
        const dim = tracing && !act && !st.visited.has(id) && !(id === 'pcs' && ['ipc', 'sch', 'mm'].some((q) => st.visited.has(q) || st.active === q));  // dim fades blocks the trace has not reached yet, but keeps the process box bright once one of its parts is reached
        let style = c.inner ? 'fill:var(--panel)' : '';  // style starts empty, except parts inside the process box get a plain panel fill so they stand out from it
        if (fl) style = `fill:var(--${fl}-bg);stroke:var(--${fl})`;  // a game colour wins: fill and outline in that colour (green right, red wrong, amber missed)
        else if (act) style = 'fill:var(--hl);stroke:var(--chc)';  // otherwise the active block of a trace is filled yellow and outlined in the chapter colour
        const kids = [s('rect', { class: 'fr ' + c.cls, x, y, width: w, height: hh, rx: c.box ? 12 : 9, 'stroke-width': act ? 4 : fl ? 3 : 2, style })];  // kids starts with the block's rounded rectangle; the outline is thicker when it is active or coloured
        const cx = x + w / 2;  // cx is the block's horizontal centre, used to centre its label
        if (c.box) c.t.forEach((line, j) => kids.push(s('text', { x: cx, y: y + (NW ? 22 : 26) + j * 17, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, line)));  // the process box: its label lines go near the top so the three parts fit underneath
        else if (c.sub) kids.push(s('text', { x: x + 16, y: y + 24, 'font-size': 15, 'font-weight': 800 }, c.t[0]), s('text', { x: NW ? x + 16 : x + 102, y: NW ? y + 44 : y + 24, 'font-size': 13.5, class: 's-sub' }, c.sub));  // a block with a sub line (the hardware): name on the left, the smaller device list beside it or under it on phones
        else if (c.t.length === 2) kids.push(s('text', { x: cx, y: y + 21, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, c.t[0]), s('text', { x: cx, y: y + 38, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, c.t[1]));  // a two-line label (the driver blocks): both lines centred, one above the other
        else kids.push(s('text', { x: cx, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': id === 'sci' ? 15.5 : 14.5, 'font-weight': id === 'sci' || id === 'fs' ? 800 : 700 }, c.t[0]));  // any other block: one centred label, a little larger and bolder for the system call interface and file subsystem
        const tg = st.tag && st.tag[id];     // st.tag[id] = [symbol, colour]: a round badge on the block's top-right corner, clear of every arrow
        if (tg) {  // if this block has a badge (used by the prediction game in step 6)
          kids.push(s('circle', { cx: x + w - 6, cy: y + 2, r: 10.5, style: `fill:var(--${tg[1]});stroke:var(--panel);stroke-width:2` }),  // draws the badge's round disc in the badge colour at the block's top-right corner
            s('text', { x: x + w - 6, y: y + 7, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--panel)' }, tg[0]));  // writes the badge symbol (?, a tick, a cross or !) in the middle of the disc
        }  // ends the badge drawing
        const live = onPick && !st.noPick;   // st.noPick: draw a normally clickable diagram as a plain picture
        const g = s('g', { class: (live ? 'hot' : '') + (st.sel === id ? ' sel' : '') + (dim ? ' dimg' : ''), 'data-id': id });  // g groups the block's shapes and carries classes: hot (clickable), sel (selected) and dimg (faded)
        if (live) {  // only clickable diagrams get the button behaviour below
          g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', c.t.join(' '));  // tells screen readers the block is a button, lets the Tab key reach it, and reads out its label
          g.addEventListener('click', () => onPick(id));  // a mouse click on the block reports its id to the step that owns the diagram
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id); } });  // pressing Enter or Space on a focused block does the same as a click, for keyboard users
        }  // ends the clickable-block setup
        g.append(...kids);  // puts the rectangle, labels and any badge inside the block's group
        k.push(g);  // adds the finished block to the list of things to draw
      });  // ends the loop over blocks
      base.replaceChildren(...k);  // swaps the old drawing for the new one in a single step
      if (st.token) {  // if the state names a block for the moving dot
        const [tx, ty] = kbSpot(st.token);  // looks up the spot on that block's top-right corner where the dot should sit
        tok.style.transform = `translate(${tx}px, ${ty}px)`; tok.style.opacity = '1';  // slides the dot there (the CSS transition animates the move) and makes it visible
      } else tok.style.opacity = '0';  // with no token the dot is hidden
    }  // ends draw()
    return { svg, draw };  // hands the caller the SVG element to place on the page and the draw function to repaint it
  }  // ends kernelDiagram()

  Guide.section({  // registers section 2.8 with the guide; everything inside this object describes its steps, notes and styles
    id: '2.8',  // id: the section number the guide uses to order the section and to build its links
    title: 'Traditional Unix Systems',  // title: the full heading shown at the top of the section's screens
    short: 'Traditional UNIX',  // short: the brief name used in tight lists, such as the list of sections on the home page
    summary: 'UNIX from Bell Labs to System V and BSD: its layers, its system call interface and its two-part kernel.',  // summary: the one-sentence description shown next to the section in the chapter overview and contents
    objectives: [  // objectives: the learning goals for this section
      'Trace UNIX from its 1970 start at Bell Labs through the PDP-11, the rewrite in C, Versions 6 and 7, and the System V and BSD branches.',  // goal 1: follow the history from Bell Labs to the System V and BSD branches
      'Explain why rewriting UNIX in C was a milestone, and say what still had to be rewritten when it moved to a new machine.',  // goal 2: explain why the rewrite in C mattered and what still had to be rewritten per machine
      'Name the layers of a UNIX system and explain why the system call interface is the boundary between user programs and the kernel.',  // goal 3: name the layers and explain why the system call interface is the boundary
      'Describe the two main parts of the traditional kernel, the process control subsystem and the file subsystem, plus hardware control.',  // goal 4: describe the two halves of the kernel and hardware control
      'Trace a read() call through the kernel and explain why the traditional UNIX kernel is called monolithic.',  // goal 5: follow a read() call and explain the word monolithic
    ],  // ends the objectives list
    terms: [  // terms: glossary entries as [term, definition] pairs; the guide adds them to the searchable glossary
      ['UNIX', 'A multiuser, time-sharing operating system created at Bell Labs by Ken Thompson and Dennis Ritchie; it was running on a PDP-7 minicomputer by 1970. The name now covers a large family of descendants.'],  // glossary entry: defines UNIX, the Bell Labs time-sharing system from 1970
      ['Assembly language', 'A low-level language in which each line stands for one machine instruction of one particular processor family, so assembly code written for one processor cannot run on a different kind.'],  // glossary entry: defines assembly language, tied to one processor family
      ['High-level language', 'A language such as C whose statements (variables, loops, function calls) do not depend on any one processor. A compiler translates them into the instructions of whichever processor you target.'],  // glossary entry: defines a high-level language, which a compiler can target at any processor
      ['C programming language', 'The high-level language Dennis Ritchie designed at Bell Labs in the early 1970s; UNIX was rewritten in it in 1973. It is close enough to the hardware for system code, yet it can be compiled for many processors.'],  // glossary entry: defines the C programming language and when UNIX was rewritten in it
      ['Compiler', 'A program that translates source code written in a high-level language into the machine instructions of one particular processor. Moving C code to a new machine means compiling it again with a compiler for that machine.'],  // glossary entry: defines a compiler, the translator from source code to one processor's instructions
      ['Machine-dependent code', 'Code tied to one kind of hardware (its instruction set, its registers or its devices). It must be rewritten when the system moves to a different machine.'],  // glossary entry: defines machine-dependent code, the part that must be rewritten for new hardware
      ['System V', 'AT&T\'s main commercial UNIX line, released in 1983 after System III and licensed widely to computer makers. Its fourth release (SVR4) later absorbed many BSD features.'],  // glossary entry: defines System V, the main commercial line from AT&T
      ['Berkeley Software Distribution (BSD)', 'The UNIX versions produced at the University of California, Berkeley, from 1978. 3BSD added virtual memory, the 4.xBSD series carried it on and added TCP/IP networking, and these ideas shaped nearly every later UNIX.'],  // glossary entry: defines BSD, the Berkeley releases that added virtual memory and networking
      ['Library', 'A collection of ready-made routines, such as the C library\'s printf and fopen, that programs call instead of writing that code themselves. Many library routines make system calls on the program\'s behalf.'],  // glossary entry: defines a library of ready-made routines such as printf
      ['Shell', 'The command interpreter: an ordinary user-mode program that reads the commands you type (such as ls or cc) and asks the kernel to run them. It is not part of the kernel.'],  // glossary entry: defines the shell, an ordinary user-mode command interpreter
      ['System call', 'A request from a running program to the kernel for a service, such as reading a file or creating a process. The program enters the kernel through a controlled gate that switches the processor into kernel mode.'],  // glossary entry: defines a system call, a program's request for a kernel service
      ['System call interface', 'The boundary between user programs and the UNIX kernel: a fixed set of entry points, such as open, read, write and fork, through which higher-level software asks for specific kernel services.'],  // glossary entry: defines the system call interface, the fixed set of entry points into the kernel
      ['Trap instruction', 'A special machine instruction that a program executes on purpose to enter the kernel. It switches the processor to kernel mode and jumps to a fixed kernel entry point, so user code cannot choose where in the kernel it lands.'],  // glossary entry: defines the trap instruction that switches into kernel mode at a fixed entry point
      ['Process control subsystem', 'The part of the traditional UNIX kernel that manages processes: memory management, scheduling and dispatching, and synchronization and interprocess communication.'],  // glossary entry: defines the process control subsystem and its three parts
      ['File subsystem', 'The part of the traditional UNIX kernel that manages files and moves data between main memory and external devices, either in blocks (through the buffer cache) or as a stream of characters.'],  // glossary entry: defines the file subsystem and its two ways of moving data
      ['Buffer cache', 'An area of main memory where the UNIX kernel keeps copies of recently used disk blocks, so a request for a block that is already there needs no disk access.'],  // glossary entry: defines the buffer cache of recently used disk blocks
      ['Block device', 'A device, such as a disk or a tape, that stores data in fixed-size numbered blocks. In traditional UNIX its data passes through the buffer cache.'],  // glossary entry: defines a block device, such as a disk, whose data goes through the buffer cache
      ['Character device', 'A device, such as a terminal or a printer, that sends or receives a stream of bytes one after another, with no block structure. Its driver is reached without going through the buffer cache.'],  // glossary entry: defines a character device, such as a terminal, that moves a stream of bytes
      ['Hardware control', 'The lowest layer of the traditional UNIX kernel: machine-dependent code that handles interrupts and communicates directly with the machine\'s devices and registers.'],  // glossary entry: defines hardware control, the lowest, machine-dependent kernel layer
      ['Monolithic kernel', 'A kernel built as one large program whose parts (scheduling, memory management, file system, device drivers and more) all run in kernel mode in one shared address space and call each other directly.'],  // glossary entry: defines a monolithic kernel, one big program in one address space
    ],  // ends the glossary terms

    css: ` /* css: the style rules for this section only, written as one long text; the guide adds them to the page when it loads */
      /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
      .sec-2-8 .step-eyebrow { contain: inline-size; } /* stops the step's heading line from forcing the page wider than a phone screen, which would cause sideways scrolling */
      .sec-2-8 .hot { cursor: pointer; outline: none; } /* clickable diagram parts show a hand pointer and hide the browser's default focus box */
      .sec-2-8 .hot .fr { transition: stroke-width .15s, opacity .2s; } /* the outlines of clickable parts thicken and fade smoothly instead of jumping */
      .sec-2-8 .hot:hover .fr, .sec-2-8 .hot:focus-visible .fr { stroke-width: 3.5; } /* hovering or tabbing onto a clickable part thickens its outline, so the student sees what they are about to pick */
      .sec-2-8 .hot.sel .fr { stroke-width: 4.5; } /* the currently selected part gets the thickest outline */
      .sec-2-8 .dimg { opacity: .28; transition: opacity .25s; } /* faded diagram parts (not reached yet, or outside the chosen branch) drop to low opacity with a short fade */
      .sec-2-8 .info { display: flex; flex-direction: column; gap: 8px; min-height: 0; } /* info cards stack their heading, text and example vertically with even spacing */
      .sec-2-8 .info h3 { margin: 0; } /* removes the default space above info card headings */
      .sec-2-8 .info p { font-size: 15.5px; line-height: 1.45; margin: 0; } /* sets a comfortable reading size and line spacing for info card paragraphs */
      .sec-2-8 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); } /* the example box: smaller text on a tinted background with a coloured bar on its left edge */
      .sec-2-8 .eg b { color: var(--chc); } /* bold words inside an example box take the chapter colour */
      .sec-2-8 .dot { width: 22px; height: 8px; border-radius: 9px; background: var(--panel-3); display: inline-block; } /* progress dots for the games: small grey pills, one per question */
      .sec-2-8 .dot.cur { background: var(--chc); } /* the dot for the current question is filled with the chapter colour */
      .sec-2-8 .dot.ok { background: var(--ok); } /* a dot for a question answered right first time turns green */
      .sec-2-8 .dot.warn { background: var(--warn); } /* a dot for a question that needed another try turns amber */
      .sec-2-8 .tok { transition: transform .45s ease; pointer-events: none; } /* the moving dot in the kernel diagram glides between blocks and never blocks clicks underneath it */
      .sec-2-8 .u8-story { gap: 11px; } /* spacing between the parts of the step 1 story card */
      .sec-2-8 .u8-diff { display: grid; grid-template-columns: 138px minmax(0, 1fr); gap: 10px 12px; align-items: start; } /* two-column grid in step 1: a coloured chip on the left, its explanation on the right */
      .sec-2-8 .u8-diff .chip { justify-content: center; margin-top: 2px; } /* centres the text inside those chips and lines them up with the first line of text */
      .sec-2-8 .u8-diff .small { line-height: 1.42; } /* slightly looser line spacing for the explanations in that grid */
      .sec-2-8 .u8-route li { margin: 4px 0; line-height: 1.4; } /* spacing between the items of the "your route" list in step 1 */
      .sec-2-8 .u8-dates { display: grid; grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr); gap: 3px 10px; } /* the four-column date grid in step 1: year, event, year, event */
      .sec-2-8 .u8-dates b { color: var(--chc); font-variant-numeric: tabular-nums; } /* years in the date grid use the chapter colour and digits of equal width so they line up */
      .sec-2-8 .u8-tree-bot { display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 14px; min-height: 0; } /* step 2: the release details card and the branch controls sit side by side below the tree */
      .sec-2-8 .u8-one { grid-template-columns: minmax(0, 1fr) !important; } /* on phone-width screens that pair becomes a single column */
      .sec-2-8 .u8-world { padding: 10px 12px; } /* inner spacing of the two "world" cards in the step 3 porting lab */
      .sec-2-8 .u8-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; } /* the kernel parts inside each world card are laid out as two equal columns */
      .sec-2-8 .u8-tile { display: flex; flex-direction: column; gap: 1px; padding: 5px 9px; border-radius: 9px; border: 1.5px solid var(--line); background: var(--panel-2); transition: background .25s, border-color .25s; min-width: 0; } /* one kernel part tile: name above line count, rounded border, colours fade when its state changes */
      .sec-2-8 .u8-tile b { font-size: 13.5px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } /* a tile's name stays on one line and ends with "..." if it does not fit */
      .sec-2-8 .u8-tile .u8-st { color: var(--ink-2); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } /* the tile's status line (line count, rewrite or recompile) also stays on one line */
      .sec-2-8 .u8-tile.dep { border-style: dashed; border-color: var(--warn); } /* machine-dependent tiles get a dashed amber border so they stand out */
      .sec-2-8 .u8-tile.rw { background: var(--bad-bg); border-color: var(--bad); } /* a tile that must be rewritten by hand turns red */
      .sec-2-8 .u8-tile.rw .u8-st { color: var(--bad); font-weight: 700; } /* its status text turns red and bold */
      .sec-2-8 .u8-tile.rc { background: var(--ok-bg); border-color: var(--ok); } /* a tile that can simply be recompiled turns green */
      .sec-2-8 .u8-tile.rc .u8-st { color: var(--ok); font-weight: 700; } /* its status text turns green and bold */
      .sec-2-8 .u8-tally { padding-top: 6px; border-top: 1px dashed var(--line-2); line-height: 1.35; } /* the tally line under each world card, separated by a dashed rule */
      .sec-2-8 .u8-comp { padding: 6px 11px; border-radius: 10px; background: var(--warn-bg); border-left: 4px solid var(--warn); line-height: 1.4; font-size: 13.5px; } /* the amber note about needing a C compiler for each new processor */
      .sec-2-8 .u8-barrow { display: grid; grid-template-columns: 118px minmax(0, 1fr) 62px; gap: 10px; align-items: center; } /* each bar row in the totals: a label, the bar, then the number */
      .sec-2-8 .u8-barrow .mono { text-align: right; } /* right-aligns the number at the end of each bar row so the digits line up */
      .sec-2-8 .u8-cap { line-height: 1.45; } /* line spacing for the porting lab's caption */
      .sec-2-8 .u8-item { font-size: 19px; font-weight: 700; line-height: 1.35; } /* large bold text for the item or request being sorted in the step 4 and step 5 games */
      .sec-2-8 .u8-route2 { display: flex; flex-wrap: wrap; gap: 4px 5px; align-items: center; } /* the "route so far" chips in the step 6 trace wrap onto new lines as needed */
      .sec-2-8 .u8-route2 .chip { font-size: 12.5px; padding: 0 7px; } /* makes those route chips smaller so a long route still fits */
    `,  // end of the section's style text

    steps: [  // steps: the list of screens in this section, shown one after another as the student presses Next
      /* ---------------- 1. Big picture ---------------- */
      {  // step 1 starts here: a fixed page of text and cards with no moving parts
        title: 'Why a 1970 operating system still matters',  // step title shown at the top of the screen
        kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
        html: `${/* html: the step's content, written as page markup inside a backtick string that the guide inserts as-is */''}
          <div class="split l fill">${/* two-column layout: a slimmer left column and a wider right one, filling the step's height */''}
            <div class="stack">${/* left column: the opening story, stacked top to bottom */''}
              <p class="lead m0">Your phone, most web servers and every Mac run operating systems that descend from UNIX or were built to behave just like it.</p>${/* opening line: UNIX descendants and look-alikes run phones, servers and Macs */''}
              <p class="m0"><span class="t">UNIX</span> began around 1970 as a small project by two researchers at Bell Labs, <b>Ken Thompson</b> and <b>Dennis Ritchie</b>. It was compact, from 1973 most of it was written in a <span class="t">high-level language</span>, and its source code travelled to universities, where students read it, learned from it and improved it.</p>${/* intro paragraph: who started UNIX, when, and why it spread (dotted words open a glossary definition) */''}
              <div class="callout analogy m0" data-label="Analogy">Classic UNIX is to today's systems what Latin is to Spanish, French and Italian. Hardly anyone runs the original now, yet its structure and vocabulary (processes, files, the shell, calls such as <code>read</code> and <code>fork</code>) live on in every descendant.</div>${/* analogy box: classic UNIX compared with Latin and the languages that grew from it */''}
              <div class="card tight m0">${/* small card holding the four-year timeline */''}
                <h4>The first four years</h4>${/* heading for the timeline card */''}
                <div class="u8-dates small"><b>1969</b><span>work starts on a PDP-7</span><b>1970</b><span>it runs, named UNIX</span><b>1971</b><span>it moves to the PDP-11</span><b>1973</b><span>kernel rewritten in C</span></div>${/* the timeline itself: 1969 to 1973, from the PDP-7 start to the rewrite in C */''}
              </div>${/* closes the timeline card */''}
            </div>${/* closes the left column */''}
            <div class="card white stack u8-story">${/* right column: a white card with what made UNIX different, where it lives on, and the route ahead */''}
              <h4 class="m0">Three things that made UNIX different</h4>${/* heading for the three differences */''}
              <div class="u8-diff">${/* grid that pairs each difference with its explanation */''}
                <span class="chip cpu">Written in C</span><span class="small">Most of the system was written in the <span class="t" data-t="C programming language">C language</span> instead of one machine's instructions, so it could move to new computers.</span>${/* difference 1: written in C, so it could move to new computers (data-t points at the glossary term) */''}
                <span class="chip os">Small and simple</span><span class="small">A compact kernel plus many small programs (<code>ls</code>, <code>sort</code>, the <span class="t">shell</span>) that users combine to do bigger jobs.</span>${/* difference 2: small and simple, a compact kernel plus small programs users combine */''}
                <span class="chip proc">Shared</span><span class="small">Licensed cheaply to universities <b>with its source code</b>, so a whole generation of programmers learned how an OS works from it.</span>${/* difference 3: shared with universities along with its source code */''}
              </div>${/* closes the differences grid */''}
              <h4 class="m0">Descendants and look-alikes today</h4>${/* heading for the list of descendants and look-alikes */''}
              <div class="row gap-s">${/* row of small boxes, one per modern system */''}
                <span class="box small">macOS and iOS</span><span class="box small">FreeBSD</span><span class="box small">Solaris · AIX</span><span class="box small">Linux · Android <span class="muted">(look-alike)</span></span>${/* the modern systems: macOS and iOS, FreeBSD, Solaris and AIX, and Linux and Android marked as a look-alike */''}
              </div>${/* closes the row of modern systems */''}
              <h4 class="m0">Your route through this section</h4>${/* heading for the plan of this section */''}
              <ol class="u8-route small m0">${/* numbered list of the three parts of the section */''}
                <li><b>History:</b> the family tree, and why the rewrite in C was a milestone</li>${/* part 1 of the route: history and the rewrite in C */''}
                <li><b>Layers:</b> from the hardware up to your own applications</li>${/* part 2 of the route: the layers of a UNIX system */''}
                <li><b>The kernel:</b> its two subsystems, and a <code>read()</code> traced end to end</li>${/* part 3 of the route: inside the kernel and a traced read() */''}
              </ol>${/* closes the route list */''}
              <div class="callout why m0" data-label="Why it matters">A small set of <span class="t">system calls</span> as the only door into the kernel, and a kernel split into a process half and a file half: these choices still shape Linux, macOS and Android. Learn them once, recognise them everywhere.</div>${/* "why it matters" box: the system call door and the two-part kernel still shape today's systems */''}
            </div>${/* closes the right column */''}
          </div>`,  // closes the two-column layout and ends the step 1 markup
      },  // ends step 1
      /* ---------------- 2. Family tree: clickable nodes, branch highlighting ---------------- */
      {  // step 2 starts here: an interactive family tree of UNIX releases
        title: 'The UNIX family tree: click any release',  // step title shown at the top of the screen
        kind: 'explore',  // kind "explore" labels the step as an Explore screen
        render(el, ctx) {  // render(el, ctx): runs when the student arrives on this step; el is the empty step body, ctx the guide's toolkit
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements, both taken from the toolkit
          const LANES = [  // LANES: the three horizontal bands of the tree, one per organisation, with their y position and colours
            { n: ['Bell Labs', 'research'], y: 58, cls: 's-accent', chip: 'accent', name: 'Bell Labs research' },  // lane 0: Bell Labs research versions, drawn in the accent colour
            { n: ['AT&T', 'commercial'], y: 134, cls: 's-io', chip: 'io', name: 'AT&T commercial' },  // lane 1: AT&T's commercial releases
            { n: ['UC Berkeley', '(BSD)'], y: 210, cls: 's-proc', chip: 'proc', name: 'UC Berkeley' },  // lane 2: the Berkeley (BSD) releases
          ];  // closes the LANES list
          const N = {  // N: every release in the tree, keyed by id, with its name, year, lane, x position and two texts for the info card
            pdp7: { n: 'PDP-7', yr: '1970', lane: 0, x: 175,  // release PDP-7 (1970): the first running UNIX
              what: 'In 1969 Bell Labs left Multics, a huge project to build a <span class="t" data-t="Time sharing">time-sharing</span> system (many users sharing one computer at once). Ken Thompson, soon joined by Dennis Ritchie, wrote a much smaller system for a little-used DEC PDP-7 minicomputer. By 1970 it ran and was named UNIX. Every line was PDP-7 assembly language.',  // what text: leaving Multics, the first system on the PDP-7, all in assembly language
              why: 'It began as a practical tool that programmers built for themselves, which kept it small and simple.' },  // why text: a tool programmers built for themselves, so it stayed small
            pdp11: { n: 'PDP-11', yr: '1971', lane: 0, x: 245,  // release PDP-11 (1971): the move to a more popular machine
              what: 'UNIX moved to the newer and far more popular DEC PDP-11. It earned its keep inside Bell Labs by preparing patent documents, and its first manual appeared in 1971. It was still written in assembly language.',  // what text: the PDP-11 move, patent work inside Bell Labs, the first manual
              why: 'Moving from the PDP-7 meant rewriting the whole system for a different instruction set: exactly the pain that C would soon remove.' },  // why text: the move meant a full rewrite, the problem C would fix
            c: { n: 'C rewrite', yr: '1973', lane: 0, x: 320,  // release "C rewrite" (1973)
              what: 'Dennis Ritchie created the C language, and in 1973 the UNIX kernel was rewritten in it, leaving only a small machine-dependent part in <span class="t">assembly language</span>. At the time, almost every operating system was written in assembly.',  // what text: the kernel rewritten in C, leaving only a small machine-dependent part in assembly
              why: 'It showed that a high-level language is good enough for most system code, which made UNIX easier to read, change and carry to new machines.' },  // why text: a high-level language proved good enough for system code
            v6: { n: 'Version 6', yr: '1975', lane: 0, x: 395,  // release Version 6 (1975): the first widely used outside Bell Labs
              what: 'The first release used widely outside Bell Labs. Legal limits kept AT&T, which owned Bell Labs, out of the computer business, so it licensed UNIX to universities for a small fee, source code included.',  // what text: licensed cheaply to universities with source code because of AT&T's legal limits
              why: 'Students could read an entire working kernel. A generation learned operating systems from it, and Berkeley started its own work from it.' },  // why text: students could read a whole working kernel; Berkeley started from it
            v7: { n: 'Version 7', yr: '1979', lane: 0, x: 500,  // release Version 7 (1979): the last widely spread research edition
              what: 'The last research edition that spread widely. Lessons from carrying UNIX to a non-DEC machine, the Interdata 8/32, made it far more portable, and a Bell Labs port called UNIX/32V took it to DEC\'s new 32-bit VAX.',  // what text: made portable after the Interdata port, and carried to the VAX as UNIX/32V
              why: 'Almost every later UNIX, on both the AT&T side and the Berkeley side, traces its family line back to Version 7.' },  // why text: nearly every later UNIX descends from Version 7
            bsd1: { n: '1BSD', yr: '1978', lane: 2, x: 445,  // release 1BSD (1978): the first Berkeley distribution, on the Berkeley lane
              what: 'At the University of California, Berkeley, a group that included graduate student Bill Joy began shipping add-ons for Version 6, such as a Pascal system and the ex text editor, as the <span class="t">Berkeley Software Distribution</span>.',  // what text: Berkeley add-ons for Version 6, such as a Pascal system and the ex editor
              why: 'A university became a second centre of UNIX development, alongside Bell Labs.' },  // why text: a university became a second centre of UNIX work
            bsd3: { n: '3BSD', yr: '1979', lane: 2, x: 560,  // release 3BSD (1979)
              what: 'A complete UNIX for the VAX, built on UNIX/32V (Version 7 for the VAX), that added <b>virtual memory</b> with <b>paging</b>: memory is handled in small fixed-size pieces (pages), and only the pages in use need to be in main memory, so a program could be larger than physical memory.',  // what text: a full UNIX for the VAX that added virtual memory with paging, explained in plain words
              why: 'Virtual memory became a standard UNIX feature through the Berkeley line.' },  // why text: virtual memory reached UNIX through the Berkeley line
            bsd42: { n: '4.2BSD', yr: '1983', lane: 2, x: 725,  // release 4.2BSD (1983)
              what: 'Built TCP/IP networking (TCP/IP is the family of communication rules, or protocols, that Internet computers use to reach each other and deliver data) directly into the kernel, together with sockets (the programming interface for network connections), and added a faster file system.',  // what text: TCP/IP networking and sockets built into the kernel, plus a faster file system
              why: 'Networked BSD machines became a backbone of the early Internet, and sockets are still how programs on nearly every OS talk over a network.' },  // why text: BSD machines helped build the early Internet; sockets are still used everywhere
            bsd43: { n: '4.3BSD', yr: '1986', lane: 2, x: 805,  // release 4.3BSD (1986)
              what: 'A refined, faster 4.2BSD that became the standard UNIX in universities and research labs. Workstation makers such as Sun built their own systems on Berkeley code.',  // what text: a refined 4.2BSD that became the standard in universities; Sun built on it
              why: 'BSD features became so popular that AT&T\'s own line later adopted them.' },  // why text: BSD features were popular enough that AT&T later adopted them
            bsd44: { n: '4.4BSD', yr: '1993', lane: 2, x: 905,  // release 4.4BSD (1993): the last Berkeley release
              what: 'The final Berkeley release. A version with all AT&T-owned code removed (4.4BSD-Lite) followed, so the system could be shared freely.',  // what text: the final release and the Lite version with all AT&T code removed
              why: 'It became the foundation of FreeBSD, NetBSD and OpenBSD, and parts of it live on inside macOS.' },  // why text: the base of FreeBSD, NetBSD, OpenBSD and parts of macOS
            s3: { n: 'System III', yr: '1982', lane: 1, x: 620,  // release System III (1982): the first on the AT&T commercial lane
              what: 'AT&T\'s own UNIX support group turned the research versions into a supported product. System III, based mainly on Version 7, was the first version AT&T sold widely to outside customers: its first public commercial release.',  // what text: AT&T's first widely sold, supported UNIX, based on Version 7
              why: 'UNIX was no longer only a research and university system: companies could now buy it with support.' },  // why text: companies could now buy UNIX with support
            s5: { n: 'System V', yr: '1983', lane: 1, x: 700,  // release System V (1983)
              what: 'AT&T\'s main commercial line, later followed by Releases 2, 3 and 4. With the 1984 break-up of the Bell System lifting its old legal limits, AT&T sold <span class="t">System V</span> hard and licensed it to many computer makers, who built their own UNIX versions from it.',  // what text: AT&T's main commercial line, sold hard after the 1984 break-up and licensed to computer makers
              why: 'It gave businesses a standard, supported UNIX. IBM\'s AIX and HP\'s HP-UX grew from this branch.' },  // why text: a standard business UNIX; AIX and HP-UX grew from it
            svr4: { n: 'SVR4', yr: '1989', lane: 1, x: 840,  // release SVR4 (1989)
              what: 'System V Release 4, built by AT&T together with Sun, merged System V with the most popular BSD features (sockets, the faster file system) and Sun\'s additions into one unified UNIX.',  // what text: AT&T and Sun merged System V with the most popular BSD features
              why: 'The two branches came back together. Section 2.9 covers SVR4 and the other modern UNIX systems.' },  // why text: the two branches rejoined; points ahead to section 2.9
            comm: { n: 'Solaris · AIX · HP-UX', yr: '1990s on', lane: 1, x: 1027, later: true,  // later systems on the AT&T lane: Solaris, AIX and HP-UX (later: true draws them in a neutral colour)
              what: 'Commercial UNIX systems from Sun (Solaris, built on SVR4), IBM (AIX) and HP (HP-UX), all rooted in AT&T\'s System V, running large servers and workstations.',  // what text: the commercial UNIX systems from Sun, IBM and HP, all rooted in System V
              why: 'These modern UNIX systems are the subject of section 2.9.' },  // why text: points ahead to section 2.9
            fbsd: { n: 'FreeBSD · macOS', yr: '1990s on', lane: 2, x: 1027, later: true,  // later systems on the Berkeley lane: FreeBSD and macOS
              what: 'FreeBSD, NetBSD and OpenBSD continue the Berkeley line as free, open-source systems, and Apple\'s macOS and iOS contain a large BSD-derived layer.',  // what text: the free BSDs and the BSD layer inside Apple's systems
              why: 'The Berkeley branch is still alive; section 2.9 looks at modern BSD systems.' },  // why text: the Berkeley branch is still alive
            linux: { n: 'Linux', yr: '1991', lane: 0, x: 1027, later: true, look: true,  // Linux (1991): look: true marks it as a look-alike, drawn with a dashed circle and no connecting line
              what: 'Linus Torvalds wrote a brand-new kernel that behaves like UNIX (the same kinds of system calls, files and commands) but contains no UNIX code. It is a look-alike, not a descendant, which is why no line connects it.',  // what text: a new kernel that behaves like UNIX but contains no UNIX code
              why: 'Linux, and Android on top of it, are covered in sections 2.10 and 2.11.' },  // why text: points ahead to sections 2.10 and 2.11
          };  // closes the N release table
          const ORDER = ['pdp7', 'pdp11', 'c', 'v6', 'bsd1', 'v7', 'bsd3', 's3', 's5', 'bsd42', 'bsd43', 'svr4', 'linux', 'bsd44', 'comm', 'fbsd'];  // ORDER: the releases in time order, used by the Earlier and Later buttons and for drawing
          const E = [['pdp7', 'pdp11'], ['pdp11', 'c'], ['c', 'v6'], ['v6', 'v7'], ['v6', 'bsd1'], ['v7', 'bsd3'], ['v7', 's3'], ['bsd1', 'bsd3'], ['bsd3', 'bsd42'],  // E: the lines of the tree as [parent, child] pairs; this row covers the research versions and early BSD
            ['bsd42', 'bsd43'], ['bsd43', 'bsd44'], ['s3', 's5'], ['s5', 'svr4'], ['bsd43', 'svr4', 'dash'], ['svr4', 'comm'], ['bsd44', 'fbsd']];  // more lines: later BSD, the AT&T line, and a dashed line showing BSD features merged into SVR4
          const BR = {  // BR: which releases belong to each branch view, used to dim the rest when a branch is chosen
            all: null,  // "Whole tree" view: null means no release is dimmed
            sysv: new Set(['pdp7', 'pdp11', 'c', 'v6', 'v7', 's3', 's5', 'svr4', 'comm']),  // "System V line": the research versions plus the AT&T releases and the later commercial systems
            bsd: new Set(['pdp7', 'pdp11', 'c', 'v6', 'v7', 'bsd1', 'bsd3', 'bsd42', 'bsd43', 'bsd44', 'fbsd']),  // "BSD line": the research versions plus every Berkeley release and the modern BSDs
          };  // closes the BR table
          const BRTXT = {  // BRTXT: the note shown under the branch buttons for each view
            all: 'Both branches grow from the Bell Labs research versions. <b>Solid lines</b> pass code down; the <b>dashed line</b> shows BSD features merged into SVR4; the <b>dashed circle</b> marks a look-alike with no shared code.',  // note for the whole tree: explains solid lines, the dashed merge line and the dashed look-alike circle
            sysv: '<b>AT&amp;T line:</b> research versions → System III (1982) → System V (1983) → SVR4 (1989) → Solaris, AIX, HP-UX. The commercial, supported UNIX.',  // note for the AT&T line: its releases in order, from System III to Solaris, AIX and HP-UX
            bsd: '<b>Berkeley line:</b> Versions 6 and 7 → 1BSD (1978) → 3BSD with virtual memory (1979) → 4.2BSD with TCP/IP (1983) → 4.4BSD → FreeBSD, macOS.',  // note for the Berkeley line: its releases in order, with what 3BSD and 4.2BSD added
          };  // closes the BRTXT table
          let cur = 'pdp7', br = 'all';  // cur is the release shown in the info card (the tree starts at the PDP-7); br is the chosen branch view
          const Y = (id) => LANES[N[id].lane].y;  // Y(id): the height of a release's lane on the wide tree
          const HALO = 'paint-order:stroke;stroke:var(--panel-2);stroke-width:4px;stroke-linejoin:round';   // lines passing behind a label stop short of the letters
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 380 744' : '0 0 1104 248', width: '100%', role: 'img', 'aria-label': 'UNIX family tree' });  // creates the tree drawing: a tall layout on phone-width screens (time runs down), a wide one otherwise
          // phones: time runs downward, one column per lane, labels to the right of each circle
          const NROW = { pdp7: 0, pdp11: 1, c: 2, v6: 3, bsd1: 4, v7: 5, bsd3: 6, s3: 7, s5: 8, bsd42: 9, bsd43: 10, svr4: 11, linux: 12, bsd44: 13, comm: 14, fbsd: 15 };  // NROW: on phones, which row (time step) each release sits on, in the same order as ORDER
          const NCOL = [24, 124, 236], NNAME = { comm: 'Solaris, AIX' };  // NCOL: the x position of each lane's column on phones; NNAME: a shorter label where the full one would not fit
          const npos = (id) => [NCOL[N[id].lane], 60 + NROW[id] * 43];  // npos(id): a release's [x, y] position on the phone tree, rows 43 units apart
          const head = h('h3', {});  // head: the info card heading (release name plus chips), filled in by show()
          const what = h('p', {});  // what: the info card paragraph that says what happened
          const why = h('div', { class: 'eg' });  // why: the example-style box that says why the release mattered
          const brNote = h('p', { class: 'small m0', html: BRTXT.all });  // brNote: the note under the branch buttons, starting with the whole-tree text
          const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => step(-1) }, '◀ Earlier');  // the Earlier button steps back one release in time order
          const next = h('button', { class: 'btn sm', type: 'button', onclick: () => step(1) }, 'Later ▶');  // the Later button steps forward one release in time order
          const inBr = (id) => !BR[br] || BR[br].has(id);  // inBr(id): true when a release is part of the chosen branch (always true for the whole tree)
          function nodeG(id, x, y, kids) {  // nodeG(): wraps a release's shapes in a clickable group for the phone tree
            return s('g', { class: 'hot' + (id === cur ? ' sel' : '') + (inBr(id) ? '' : ' dimg'), role: 'button', tabindex: 0, 'aria-label': N[id].n + ', ' + N[id].yr,  // the group is highlighted if selected, dimmed if outside the branch, and announced to screen readers as a button
              onclick: () => show(id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(id); } } }, ...kids);  // clicking it, or pressing Enter or Space on it, shows that release in the info card
          }  // ends nodeG()
          function drawNarrow() {  // draws the tree for phone-width screens: time runs downward and each lane is a column
            const k = [];  // k collects every shape to draw
            ['Bell Labs', 'AT&T', 'Berkeley'].forEach((t, i) => k.push(s('text', { x: NCOL[i] - 10, y: 22, 'font-size': 14, 'font-weight': 800, class: 's-sub' }, t)));  // column headings at the top: Bell Labs, AT&T and Berkeley
            [[6, '1980s'], [11, '1990s'], [13, 'later']].forEach(([r, t]) => {  // dashed divider lines that mark where the 1980s, the 1990s and later systems begin
              const y = 60 + r * 43 + 21;  // y is the height of the divider, placed halfway between two rows
              k.push(s('line', { x1: 0, y1: y, x2: 380, y2: y, class: 's-muted', 'stroke-dasharray': '4 5', 'stroke-width': 1.5 }), s('text', { x: 378, y: y - 5, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, class: 's-sub' }, t));  // draws the dashed divider across the tree and writes its label at the right edge
            });  // ends the dividers loop
            E.forEach(([a, b, dash]) => {  // draws every line of the tree
              const [ax, ay] = npos(a), [bx, by] = npos(b);  // looks up the phone positions of the parent (a) and the child (b)
              const on = br !== 'all' && inBr(a) && inBr(b), dim = br !== 'all' && !on;  // on: the line is inside the chosen branch and gets highlighted; dim: a branch is chosen and this line is not in it
              const r = 10, dir = bx > ax ? 1 : -1;  // r is the radius of the rounded corner; dir says whether the child's column is to the right (1) or left (-1)
              const d = ax === bx ? `M${ax},${ay} V${by}` : dash  // SVG path text: a straight drop when both are in one column; M means move to, V means draw down to a height
                ? `M${ax},${ay} H${bx - dir * r} Q${bx},${ay} ${bx},${ay + r} V${by}`  // the dashed merge line goes across first (H), rounds the corner with a curve (Q), then drops down
                : `M${ax},${ay} V${by - r} Q${ax},${by} ${ax + dir * r},${by} H${bx}`;  // any other line drops first, rounds the corner, then runs across to the child's column
              k.push(s('path', { d, fill: 'none', style: `stroke:${on ? 'var(--chc)' : 'var(--line-2)'}`, 'stroke-width': on ? 4 : 3, 'stroke-dasharray': dash ? '7 6' : null, class: dim ? 'dimg' : null }));  // adds the line: chapter colour and thicker when highlighted, grey otherwise, dashed for the merge
            });  // ends the lines loop
            ORDER.forEach((id) => {  // draws every release in time order
              const d = N[id], [x, y] = npos(id), sel = id === cur;  // d is the release, x and y its position, and sel is true if it is the one being shown
              k.push(nodeG(id, x, y, [  // adds a clickable group for the release made of the shapes below
                s('rect', { x: x - 16, y: y - 20, width: 130, height: 40, fill: 'transparent' }),  // an invisible rectangle behind the circle and label gives a bigger area to tap
                sel ? s('circle', { cx: x, cy: y, r: 15, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 2.5, opacity: 0.55 }) : null,  // the selected release gets an extra faint ring around its circle
                s('circle', { class: 'fr ' + (d.later ? 's-panel' : LANES[d.lane].cls), cx: x, cy: y, r: sel ? 10 : 8, 'stroke-width': 2.5, 'stroke-dasharray': d.look ? '3 3' : null }),  // the release circle in its lane's colour (neutral for later systems), bigger when selected, dashed for Linux
                s('text', { x: x + 19, y: y + 1, 'font-size': 14, 'font-weight': sel ? 800 : 700, style: sel ? 'fill:var(--chc)' : '' }, NNAME[id] || d.n),  // the release name to the right of the circle, in the chapter colour when selected
                s('text', { x: x + 19, y: y + 17, 'font-size': 12.5, class: 's-sub' }, d.yr)]));  // the year in smaller grey text under the name
            });  // ends the releases loop
            svg.replaceChildren(...k);  // replaces the old drawing with the new one
          }  // ends the phone tree drawing
          function draw() {  // draw(): repaints the tree after any click or branch change
            if (ctx.narrow) { drawNarrow(); return; }  // on phone-width screens it hands over to the phone drawing and stops here
            const k = [];  // k collects every shape to draw for the wide tree
            LANES.forEach((L) => {  // for each lane:
              k.push(s('rect', { x: 0, y: L.y - 35, width: 1104, height: 70, rx: 10, style: 'fill:var(--panel-2);stroke:none' }));  // a shaded band across the tree
              k.push(s('text', { x: 14, y: L.y - 3, 'font-size': 13.5, 'font-weight': 800, class: 's-sub' }, L.n[0]));  // the first line of the lane's label at the left edge
              k.push(s('text', { x: 14, y: L.y + 14, 'font-size': 13, class: 's-sub' }, L.n[1]));  // the second line of the lane's label, just below
            });  // ends the lanes loop
            [[590, '1980s'], [870, '1990s'], [952, 'Later']].forEach(([x]) => k.push(s('line', { x1: x, y1: 20, x2: x, y2: 246, class: 's-muted', 'stroke-dasharray': '4 5', 'stroke-width': 1.5 })));  // dashed vertical lines that separate the decades
            [[360, '1970s'], [730, '1980s'], [911, '1990s'], [1027, 'Later']].forEach(([x, t]) => k.push(s('text', { x, y: 14, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, t)));  // decade labels along the top: 1970s, 1980s, 1990s and Later
            E.forEach(([a, b, dash]) => {  // draws every line of the wide tree
              const ax = N[a].x, ay = Y(a), bx = N[b].x, by = Y(b), mx = (ax + bx) / 2;  // positions of the parent (a) and the child (b); mx is the point halfway between them
              const on = br !== 'all' && inBr(a) && inBr(b);  // on: this line is part of the chosen branch
              const dim = br !== 'all' && !on;  // dim: a branch is chosen and this line is not in it
              // long drops first run 16 units along the lane (clear of the parent's year label), fall, then run
              // along the child's lane, so they never cut through a label
              const d = ay === by ? `M${ax},${ay} L${bx},${by}` : bx - ax > 45 ? `M${ax},${ay} H${ax + 16} C${ax + 32},${ay} ${ax + 22},${by} ${ax + 40},${by} L${bx},${by}` : `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;  // SVG path: straight within a lane; for long jumps a short run, a curve down, then straight on; otherwise an S-shaped curve
              k.push(s('path', { d, fill: 'none',  // adds the line with no fill
                style: `stroke:${on ? 'var(--chc)' : 'var(--line-2)'}`, 'stroke-width': on ? 4 : 3, 'stroke-dasharray': dash ? '7 6' : null, class: dim ? 'dimg' : null }));  // chapter colour and thicker when highlighted, grey otherwise; dashed for the merge; faded when outside the branch
            });  // ends the lines loop
            ORDER.forEach((id) => {  // draws every release on the wide tree
              const d = N[id], y = Y(id), sel = id === cur;  // d is the release, y its lane's height, and sel is true if it is the one being shown
              const cls = d.later ? 's-panel' : LANES[d.lane].cls;  // the circle colour comes from the lane, or neutral grey for later systems
              const g = s('g', { class: 'hot' + (sel ? ' sel' : '') + (inBr(id) ? '' : ' dimg'), role: 'button', tabindex: 0, 'aria-label': d.n + ', ' + d.yr,  // a clickable group: highlighted when selected, dimmed outside the branch, announced as a button
                onclick: () => show(id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(id); } } },  // clicking it, or pressing Enter or Space on it, shows that release in the info card
                s('rect', { x: d.x - 38, y: y - 34, width: 76, height: 68, fill: 'transparent' }),  // an invisible rectangle around the circle gives a bigger area to click
                sel ? s('circle', { cx: d.x, cy: y, r: 17, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 2.5, opacity: 0.55 }) : null,  // the selected release gets an extra faint ring around its circle
                s('circle', { class: 'fr ' + cls, cx: d.x, cy: y, r: sel ? 11 : 8, 'stroke-width': 2.5, 'stroke-dasharray': d.look ? '3 3' : null }),  // the release circle, bigger when selected, dashed for the look-alike Linux
                s('text', { x: d.x, y: y - 16, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': sel ? 800 : 700, style: HALO + (sel ? ';fill:var(--chc)' : '') }, d.n),  // the release name above the circle; HALO paints a background edge so lines behind it do not cross the letters
                s('text', { x: d.x, y: y + 25, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', style: HALO }, d.yr));  // the year below the circle, with the same halo
              k.push(g);  // adds the finished release to the drawing list
            });  // ends the releases loop
            svg.replaceChildren(...k);  // replaces the old drawing with the new one
          }  // ends draw()
          function show(id) {  // show(id): fills the info card for one release and repaints the tree; runs on every click and button press
            cur = id;  // remembers which release is shown
            const d = N[id], L = LANES[d.lane];  // d is the release and L its lane
            head.innerHTML = `${d.n} <span class="chip ${d.later ? '' : L.chip}" style="vertical-align:3px">${d.yr}</span> <span class="chip" style="vertical-align:3px">${d.later ? 'later system' : L.name}</span>`;  // heading: the release name, a chip with its year, and a chip naming its lane (or "later system")
            what.innerHTML = d.what;  // the "what happened" paragraph
            why.innerHTML = '<b>Why it mattered: </b>' + d.why;  // the "why it mattered" box, with a bold lead-in
            const i = ORDER.indexOf(id);  // i is the release's position in time order
            prev.disabled = i === 0; next.disabled = i === ORDER.length - 1;  // disables Earlier on the first release and Later on the last
            draw();  // repaints the tree so the new selection is highlighted
          }  // ends show()
          function step(dir) { const i = ORDER.indexOf(cur) + dir; if (i >= 0 && i < ORDER.length) show(ORDER[i]); }  // step(dir): moves one release earlier (-1) or later (+1) in time order, stopping at either end
          const seg = ctx.ui.seg([{ value: 'all', label: 'Whole tree' }, { value: 'sysv', label: 'System V line' }, { value: 'bsd', label: 'BSD line' }], 'all', (v) => { br = v; brNote.innerHTML = BRTXT[v]; draw(); });  // the branch selector: a row of toggle buttons; choosing one sets br, swaps the note and repaints the tree
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // builds the step's layout: a vertical stack that fills the step body
            h('div', { class: 'card white tight', style: { padding: '8px 10px' } }, svg),  // top: the tree drawing inside a white card
            h('div', { class: 'u8-tree-bot grow' + (ctx.narrow ? ' u8-one' : '') },  // bottom: two cards side by side on wide screens, one column on phones (u8-one)
              h('div', { class: 'card info' }, head, what, why),  // left card: the release details (heading, what happened, why it mattered)
              h('div', { class: 'card white stack', style: { gap: '9px' } },  // right card: the branch controls
                h('h4', { class: 'm0' }, 'Follow a branch'), seg, brNote,  // heading, the branch selector and the note that explains the chosen branch
                h('div', { class: 'row gap-s', style: { marginTop: 'auto' } }, prev, next, h('span', { class: 'xs muted' }, 'or click any circle'))))));  // pushed to the bottom of the card: the Earlier and Later buttons and a hint that circles are clickable
          show('pdp7');  // starts the step on the first release, the PDP-7, which also draws the tree
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------- 3. Why C mattered: a porting lab ---------------- */
      {  // step 3 starts here: a lab comparing how much must be rewritten to port UNIX in assembly versus in C
        title: 'Why C mattered: carry the kernel to a new machine',  // step title shown at the top of the screen
        kind: 'lab',  // kind "lab" labels the step as a Hands-on Lab
        render(el, ctx) {  // render(el, ctx): builds the lab when the student arrives on this step
          const { h } = ctx;  // h builds page elements, taken from the guide's toolkit
          const fmtN = (n) => n.toLocaleString('en-US');  // fmtN(n): writes a number with thousands separators, e.g. 10000 becomes 10,000
          // an illustrative 10,000-line kernel: 9,000 portable lines, 1,000 machine-dependent lines
          const MODS = [  // MODS: the parts of the imagined kernel with their line counts (l); dep marks machine-dependent parts
            { n: 'File system', l: 2600 }, { n: 'System calls', l: 1800 },  // parts 1-2: the file system and the system call code
            { n: 'Memory manager', l: 1400 }, { n: 'Scheduler', l: 1200 },  // parts 3-4: the memory manager and the scheduler
            { n: 'Buffer cache', l: 1000 }, { n: 'Terminal handling', l: 1000 },  // parts 5-6: the buffer cache and terminal handling
            { n: 'Traps and interrupts', l: 450, dep: true }, { n: 'Device drivers', l: 550, dep: true },  // parts 7-8: trap and interrupt entry and the device drivers, the only machine-dependent parts
          ];  // closes the MODS list
          const TOTAL = MODS.reduce((a, m) => a + m.l, 0);                 // 10,000
          const DEP = MODS.filter((m) => m.dep).reduce((a, m) => a + m.l, 0); // 1,000
          const MACH = ['Interdata 8/32', 'VAX-11/780', 'Motorola 68000', 'Intel 386'];  // MACH: the four new machines the student ports UNIX to, one per button press
          let ports = 0, busy = false, gen = 0;  // ports counts finished ports; busy blocks clicks while one runs; gen is a run number that lets Reset cancel a port in progress
          const worlds = ['asm', 'c'].map((w) => {  // worlds: two copies of the kernel, one imagined in assembly ("asm") and one in C ("c")
            const tiles = MODS.map((m) => {  // for each kernel part, a tile is built:
              const st = h('span', { class: 'xs u8-st' }, fmtN(m.l) + ' lines');  // st is the tile's status line, starting as the part's line count
              const t = h('div', { class: 'u8-tile' + (w === 'c' && m.dep ? ' dep' : '') }, h('b', {}, m.n), st);  // t is the tile itself; in the C world the machine-dependent parts get the dashed "dep" border
              return { t, st, m };  // keeps the tile, its status line and its part together so they can be updated later
            });  // ends the tile loop
            const tally = h('div', { class: 'u8-tally small' });  // tally: the summary line under each world card
            return { w, tiles, tally };  // hands back the world's name, tiles and tally
          });  // ends building the two worlds
          const compiler = h('div', { class: 'u8-comp xs' });  // compiler: the amber note that each new processor also needs a C compiler
          const bars = h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } });  // bars: the box holding the running totals as bars
          const cap = h('div', { class: 'u8-cap small', style: { marginTop: '2px', paddingTop: '5px', borderTop: '1px dashed var(--line-2)' } });  // cap: the caption under the bars that explains what just happened, separated by a dashed line
          const btn = h('button', { class: 'btn primary', type: 'button', onclick: port });  // btn: the main button that starts the next port; its label is set in paint()
          const reset = h('button', { class: 'btn', type: 'button', onclick: () => { gen++; busy = false; ports = 0; paint(); } }, 'Reset');  // the Reset button: bumps gen so running timers stop, clears the counters and repaints the starting state
          const machRow = h('div', { class: 'row', style: { gap: '4px' } });  // machRow: the row of machine chips above the bars, ticked as each port is done
          function tileState(wd, i, state) {  // tileState(wd, i, state): paints one tile of one world as "rw" (rewrite), "rc" (recompile) or back to its line count
            const { t, st, m } = wd.tiles[i];  // picks out the tile, its status line and its part
            t.classList.remove('rw', 'rc');  // clears any earlier red or green state
            if (state === 'rw') { t.classList.add('rw'); st.textContent = '✗ rewrite by hand'; }  // rewrite: the tile turns red and says it must be rewritten by hand
            else if (state === 'rc') { t.classList.add('rc'); st.textContent = '✓ recompile unchanged'; }  // recompile: the tile turns green and says it compiles unchanged
            else st.textContent = fmtN(m.l) + ' lines';  // no state: the tile shows its line count again
          }  // ends tileState()
          function paintBars() {  // paintBars(): redraws the running totals after each port
            const a = ports * TOTAL, c = ports * DEP, max = MACH.length * TOTAL;  // a = lines rewritten so far in assembly, c = in C; max = the assembly total after all four ports, the full bar length
            const bar = (label, v, col) => h('div', { class: 'u8-barrow' },  // bar(): one row with a label, a coloured bar sized to the value, and the number
              h('span', { class: 'xs b' }, label),  // the row's label
              h('div', { class: 'meter', style: { height: '14px' } }, h('i', { style: { width: (v / max) * 100 + '%', background: `var(--${col})` } })),  // the bar: its width is the value as a share of max
              h('span', { class: 'mono small b' }, fmtN(v)));  // the number at the right end of the row
            // header and machine chips on separate rows, so the layout does not jump when the chips gain ticks
            bars.replaceChildren(h('span', { class: 'xs muted b' }, `TOTAL LINES REWRITTEN BY HAND AFTER ${ports} PORT${ports === 1 ? '' : 'S'}`), machRow,  // fills the totals box: a heading that counts the ports so far, then the machine chips
              bar('Assembly world', a, 'bad'), bar('C world', c, 'ok'));  // then the red assembly bar and the green C bar
          }  // ends paintBars()
          function paint() {  // paint(): redraws the whole lab from the counters; runs at the start, after each port and after Reset
            worlds.forEach((wd) => {  // for each world:
              wd.tiles.forEach((_, i) => tileState(wd, i, ports ? (wd.w === 'asm' || wd.tiles[i].m.dep ? 'rw' : 'rc') : null));  // before any port every tile shows its line count; after one, assembly tiles and dependent tiles are red, the rest green
              const rw = ports ? (wd.w === 'asm' ? TOTAL : DEP) : 0;  // rw is how many lines this port had to rewrite in this world: everything in assembly, only the dependent part in C
              wd.tally.innerHTML = ports ? `This port: <b>${fmtN(rw)}</b> lines rewritten, <b>${fmtN(TOTAL - rw)}</b> recompiled` : 'Running on the PDP-11. Nothing to rewrite yet.';  // the tally line: rewritten versus recompiled for this port, or a note that nothing has moved yet
            });  // ends the worlds loop
            compiler.innerHTML = ports ? `<b>Also needed once per processor:</b> a C compiler for the ${MACH[ports - 1]} (${ports} built so far); every C program can then move too.` : '<b>Also needed once per processor:</b> a C compiler that produces that processor\'s instructions.';  // the compiler note, naming the machine that just got a C compiler once a port has happened
            machRow.replaceChildren(h('span', { class: 'chip ok' }, 'PDP-11'), ...MACH.map((m, i) => h('span', { class: 'chip ' + (i < ports ? 'ok' : '') }, (i < ports ? '✓ ' : '') + m)));  // the machine chips: the PDP-11 is always green; each finished port adds a ticked green chip
            btn.disabled = busy || ports >= MACH.length;  // the port button is off while a port runs or after all four
            btn.textContent = ports >= MACH.length ? 'All four ports done' : 'Port to the ' + MACH[ports] + ' ▶';  // the button's label names the next machine, or says all four ports are done
            paintBars();  // redraws the totals
            cap.innerHTML = ports === 0  // the caption depends on progress:
              ? 'Press the button to carry UNIX from the PDP-11 to its first new machine. Watch which parts of the kernel must be <b>rewritten by hand</b> in each world.'  // before any port: an invitation to press the button and watch the tiles
              : ports < MACH.length  // after one to three ports:
                ? `<b>Ported to the ${MACH[ports - 1]}.</b> Assembly world: all ${fmtN(TOTAL)} lines rewritten, plus every command (shell, editor, tools). C world: only the ${fmtN(DEP)} machine-dependent lines; the other ${fmtN(TOTAL - DEP)} just recompile.`  // names the machine just reached and compares 10,000 lines rewritten with 1,000 in the C world
                : `<b>After four ports:</b> ${fmtN(MACH.length * TOTAL)} lines rewritten in the assembly world against ${fmtN(MACH.length * DEP)} in the C world. That ten-to-one saving on every new machine is a big reason UNIX spread to so many kinds of computer.`;  // after all four: the final totals and the ten-to-one saving that helped UNIX spread
          }  // ends paint()
          function port() {  // port(): runs when the port button is pressed and animates one port, tile by tile
            if (busy || ports >= MACH.length) return;  // ignores the click if a port is already running or all four are done
            busy = true; const my = ++gen; btn.disabled = true;  // marks the lab busy, takes a new run number (my) and disables the button
            cap.innerHTML = `<b>Porting to the ${MACH[ports]}…</b> each part of the kernel is checked: can it simply be recompiled, or must it be rewritten?`;  // caption while the port runs: each part is being checked
            MODS.forEach((m, i) => ctx.after(110 * (i + 1), () => {  // every 110 milliseconds the next tile turns red or green, one after another
              if (my !== gen) return;  // stops if Reset was pressed since this port started (the run number changed)
              worlds.forEach((wd) => tileState(wd, i, wd.w === 'asm' || m.dep ? 'rw' : 'rc'));  // paints this part's tile in both worlds: red in assembly or if machine-dependent, green otherwise
            }));  // ends the tile timer loop
            ctx.after(110 * (MODS.length + 1), () => { if (my !== gen) return; busy = false; ports++; paint(); });  // after the last tile: unless Reset intervened, the port counts as done and the whole lab is repainted
          }  // ends port()
          const worldCard = (wd, title, sub, cls) => h('div', { class: 'card white stack u8-world ' + cls, style: { gap: '8px' } },  // worldCard(): builds one world's card with a title, a subtitle, the tiles and the tally
            h('div', {}, h('div', { class: 'b', style: { fontSize: '16px', lineHeight: '1.25' } }, title), h('div', { class: 'xs muted' }, sub)),  // the card's title and a smaller grey subtitle
            h('div', { class: 'u8-tiles' }, ...wd.tiles.map((x) => x.t)), wd.tally);  // the two-column grid of tiles, then the tally line
          const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation and the controls
            h('p', { class: 'm0 small', html: 'In 1973 almost every operating system was written in <span class="t">assembly language</span>, the instructions of one processor family. Moving it to a different processor, called <b>porting</b> it, meant rewriting <b>every line</b>.' }),  // paragraph: porting from assembly meant rewriting every line
            h('p', { class: 'm0 small', html: 'UNIX was rewritten in C, a <span class="t">high-level language</span>. A <span class="t">compiler</span> turns the same C source into instructions for any processor it supports, so only the <span class="t">machine-dependent code</span> had to be written again.' }),  // paragraph: in C only the machine-dependent code has to be written again
            h('div', { class: 'row gap-s' }, btn, reset),  // the port button and the Reset button side by side
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'C did not make UNIX run anywhere for free. Each new machine still needed its own C compiler and a rewrite of the small machine-dependent part.' }),  // common-mistake box: C did not make UNIX portable for free
            h('p', { class: 'xs muted m0', style: { lineHeight: '1.4' } }, 'The price: the C kernel came out somewhat larger and slower than hand-tuned assembly, a cost its designers judged well worth paying. Line counts here are illustrative round numbers.'));  // small print: the C kernel was larger and slower, and the line counts are illustrative
          const right = h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the two world cards, the compiler note and the totals
            h('div', { class: 'grid-2', style: { gap: '12px' } },  // a two-column grid holding the two world cards
              worldCard(worlds[0], 'If UNIX had stayed in assembly', 'imagined: every line is PDP-11 instructions', 'asm'),  // the assembly world card, labelled as imagined: every line would be PDP-11 instructions
              worldCard(worlds[1], 'UNIX in C (what really happened)', '90% portable C · dashed = machine-dependent', 'cw')),  // the C world card, what really happened: 90% portable, with dashed tiles for the machine-dependent part; closes the grid
            compiler,  // the compiler note sits under the two world cards
            h('div', { class: 'card stack grow', style: { gap: '6px', padding: '9px 14px' } }, bars, cap));  // a card that grows to fill the rest of the column, holding the bars and the caption; closes the right column
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : '296px minmax(0, 1fr)', gap: '18px' } }, left, right));  // puts both columns on the page: a fixed 296-pixel left column on wide screens, stacked on phones
          paint();  // draws the starting state, before any port
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------- 4. The layers of a UNIX system ---------------- */
      {  // step 4 starts here: the layers of a UNIX system, to explore or to sort software into
        title: 'The layers of a UNIX system',  // step title shown at the top of the screen
        kind: 'explore',  // kind "explore" labels the step as an Explore screen
        render(el, ctx) {  // render(el, ctx): builds the layer diagram and its panel when the student arrives on this step
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const L = {  // L: the five layers keyed by id, each with a colour class, a name (t), a small subtitle (sub), a job text and an example
            apps: { y: 8, hh: 84, cls: 's-proc', t: 'User-written applications', sub: 'programs people write: games, payroll, web servers',  // layer "apps": user-written applications, the outermost layer
              job: 'The outermost layer: programs people write to get their own work done. They run in <span class="t">user mode</span> with no special privileges. To use any OS service they must reach the kernel, either <b>directly</b> with a system call or <b>through a library routine</b> that makes the call for them.',  // job text: ordinary user-mode programs that reach the kernel directly or through a library
              eg: 'A web server you wrote calls <code>read()</code> to fetch a page from the disk.' },  // example: a web server you wrote calls read()
            cmds: { y: 100, hh: 84, cls: 's-panel', t: 'Commands and libraries', sub: 'shell · cc compiler · editors · ls, cp, sort · C library',  // layer "cmds": commands and libraries that ship with UNIX
              job: 'Software that ships with UNIX but is <b>not</b> the kernel: the <span class="t">shell</span>, compilers such as <code>cc</code>, editors, and <span class="t">utilities</span> such as <code>ls</code>, <code>cp</code> and <code>sort</code>, plus <span class="t">libraries</span> of ready-made routines like the C library. All are ordinary user-mode programs.',  // job text: the shell, compilers, editors, utilities and libraries are all ordinary user-mode programs
              eg: 'The shell has no more privilege than a program you write. When you type <code>ls</code>, it asks the kernel to start the ls program for you.' },  // example: the shell has no special privilege; typing ls asks the kernel to start ls
            sci: { y: 198, hh: 42, cls: 's-accent', t: 'System call interface', sub: 'open · read · write · fork · exec · wait',  // layer "sci": the system call interface; its subtitle lists common calls
              job: 'The <b>boundary</b> between user programs and the kernel: a fixed, documented set of entry points, and the only way higher-level software can reach specific kernel functions. A program enters through a <span class="t">trap instruction</span>, which switches the processor into <span class="t">kernel mode</span>.',  // job text: the boundary into the kernel, entered with a trap instruction that switches to kernel mode
              eg: 'Early UNIX needed only a few dozen system calls, and every command and library was built on top of them.' },  // example: early UNIX needed only a few dozen system calls
            kern: { y: 254, hh: 128, cls: 's-os', t: 'Kernel', sub: '',  // layer "kern": the kernel, drawn tall so its three parts fit inside
              job: 'The core of UNIX. It runs in kernel mode with full access to the hardware. It manages processes (the <b>process control subsystem</b>), files and devices (the <b>file subsystem</b>), and drives the hardware directly (<b>hardware control</b>). Every request that crosses the system call interface ends up here.',  // job text: the core that runs in kernel mode and manages processes, files and devices
              eg: 'The next two steps open the kernel up and follow one request through it.' },  // example: points ahead to the next two steps
            hw: { y: 396, hh: 80, cls: 's-cpu', t: 'Hardware', sub: 'processor · main memory · disks · terminals and other devices',  // layer "hw": the hardware at the bottom
              job: 'The processor, main memory, disks, terminals and other devices. Only the kernel talks to the hardware directly; user programs never touch device registers themselves.',  // job text: the physical machine, which only the kernel talks to directly
              eg: 'Even a simple <code>printf</code> ends with the kernel telling a terminal device which characters to show.' },  // example: even printf ends with the kernel telling a terminal what to show
          };  // closes the L layer table
          const IDS = ['apps', 'cmds', 'sci', 'kern', 'hw'];  // IDS: the layers from top to bottom, the order they are drawn in
          const ITEMS = [  // ITEMS: the sorting game, each as [item shown, correct layer id, explanation shown when answered]
            ['<code>sh</code>, the shell that reads your commands', 'cmds', 'The shell is an ordinary program in the commands layer. It is not part of the kernel and has no special privilege.'],  // item 1: the shell belongs to commands and libraries, not the kernel
            ['A budgeting program you wrote yourself', 'apps', 'Programs people write for their own work form the outermost layer, user-written applications.'],  // item 2: a program you wrote belongs to user-written applications
            ['<code>printf()</code>, a routine in the C library', 'cmds', 'Library routines live in the commands-and-libraries layer. printf formats your text, then makes the write system call for you.'],  // item 3: printf in the C library belongs to commands and libraries
            ['<code>read</code>, <code>write</code>, <code>fork</code> and <code>exec</code>: the official ways into the kernel', 'sci', 'These entry points are the system call interface, the boundary every request must cross.'],  // item 4: read, write, fork and exec are the system call interface
            ['The code that decides which process runs next', 'kern', 'Scheduling is a kernel job (the process control subsystem), because only the kernel may hand out the processor.'],  // item 5: the code that picks the next process belongs to the kernel
            ['<code>cc</code>, the C compiler', 'cmds', 'A compiler is a system program supplied with UNIX, but it runs in user mode like any other command.'],  // item 6: the C compiler belongs to commands and libraries
            ['A disk drive and its controller', 'hw', 'Physical devices are hardware. Only the kernel\'s drivers and hardware control talk to them.'],  // item 7: a disk drive is hardware
            ['The buffer cache of recently used disk blocks', 'kern', 'The buffer cache belongs to the kernel\'s file subsystem; no user program can reach it directly.'],  // item 8: the buffer cache belongs to the kernel
          ];  // closes the ITEMS list
          let mode = 'learn', cur = 'sci', qi = 0, tries = 0, results = [];  // mode is "learn" or "sort"; cur is the chosen layer; qi is the current item; tries counts wrong clicks; results records each item
          const NW = ctx.narrow;  // NW is true on phone-width screens
          // geometry: wide (viewBox 600 x 484) or phone (360 x 520, taller layers so labels stay ~13 px)
          const G = NW  // G: the drawing's geometry, picked once for the screen size
            ? { vb: '0 0 360 520', x0: 30, w: 324, tx: 42, bound: 218, lab: [14, 110, 333],  // phone geometry: viewBox, left edge and width of the layers, label x, the dashed boundary height and the side label spots
              y: { apps: [8, 100], cmds: [116, 96], sci: [224, 58], kern: [292, 150], hw: [452, 62] },  // phone heights: [top, height] of each layer, taller than on wide screens so the text fits
              sub: { apps: 'games, payroll, web servers', cmds: 'shell · cc · editors · ls, cp, sort', sci: 'open · read · write · fork · exec', hw: 'processor · memory · disks · terminals' } }  // shorter subtitles for phones so they fit on one line
            : { vb: '0 0 600 484', x0: 36, w: 558, tx: 52, bound: 191, lab: [18, 96, 318],  // wide geometry: the same settings for the 600-wide drawing
              y: { apps: [8, 84], cmds: [100, 84], sci: [198, 42], kern: [254, 128], hw: [396, 80] }, sub: {} };  // wide heights of each layer; sub is empty so the full subtitles from L are used
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Layers of a UNIX system' });  // creates the layer drawing, scaled to the full width of its card
          const panel = h('div', { class: 'stack grow', style: { gap: '10px' } });  // panel: the area beside or below the diagram that shows the layer details or the sorting game
          const flashes = {};  // flashes: layers briefly coloured green or red after a sorting click, keyed by layer id
          const box = (cls, x, y, w, hh, extra) => s('rect', Object.assign({ class: cls, x, y, width: w, height: hh, rx: 8, 'stroke-width': 1.5 }, extra || {}));  // box(): draws a small rounded rectangle, with optional extra attributes
          const txt = (x, y, t, o) => s('text', Object.assign({ x, y, 'font-size': 14.5, 'font-weight': 700 }, o || {}), t);  // txt(): draws a line of bold text, with optional extra attributes
          const arrow = (x1, y1, x2, y2, col) => s('line', { x1, y1, x2, y2, style: `stroke:var(--${col})`, 'stroke-width': 2.5, 'marker-end': col === 'accent' ? 'url(#arr-accent)' : 'url(#arr)', 'pointer-events': 'none' });  // arrow(): draws a line with an arrowhead in the given colour; it ignores clicks so the layers underneath stay clickable
          function draw() {  // draw(): repaints the whole diagram; runs at the start and after every click
            const [lx, ly1, ly2] = G.lab;  // lx is the x of the side labels; ly1 and ly2 are where "USER MODE" and "KERNEL MODE" sit
            const k = [  // k starts with the two side labels and the boundary line
              s('text', { x: lx, y: ly1, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.1em', transform: `rotate(-90 ${lx} ${ly1})` }, 'USER MODE'),  // "USER MODE" written up the left side next to the upper layers
              s('text', { x: lx, y: ly2, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.1em', transform: `rotate(-90 ${lx} ${ly2})` }, 'KERNEL MODE'),  // "KERNEL MODE" written up the left side next to the kernel and hardware
              s('line', { x1: 6, y1: G.bound, x2: NW ? 356 : 596, y2: G.bound, style: 'stroke:var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '6 5' }),  // a dashed accent line marks the boundary between user mode and kernel mode
            ];  // ends the starting list
            IDS.forEach((id) => {  // draws each layer from top to bottom
              const b = L[id], [by, bh] = G.y[id], sel = mode === 'learn' && id === cur, fl = flashes[id], sub = G.sub[id] || b.sub, tx = G.tx;  // b is the layer, by and bh its top and height; sel is true for the chosen layer in learn mode; fl is its flash colour
              const kids = [s('rect', { class: 'fr ' + b.cls, x: G.x0, y: by, width: G.w, height: bh, rx: 12, 'stroke-width': 2,  // kids starts with the layer's big rounded rectangle
                style: fl ? `stroke:var(--${fl});fill:var(--${fl}-bg)` : null })];  // a flashing layer takes the flash colour for its outline and fill
              kids.push(s('text', { x: tx, y: by + (id === 'sci' && !NW ? 27 : 26), 'font-size': 16, 'font-weight': 800 }, b.t));  // the layer's name near its top-left corner
              if (id === 'sci') kids.push(s('text', { x: NW ? tx : 236, y: NW ? by + 47 : by + 27, 'font-size': 13, class: 's-sub s-monot' }, sub));  // for the system call interface, its list of calls in a code font beside the name (below it on phones)
              else if (sub) kids.push(s('text', { x: tx, y: by + (NW ? 47 : 53), 'font-size': 13.5, class: 's-sub' }, sub));  // other layers show their subtitle under the name
              if (id === 'apps') kids.push(...(NW ? [box('s-proc', 216, by + 58, 128, 34, { rx: 9, 'stroke-width': 2, style: 'fill:var(--panel)' }), txt(280, by + 80, 'your program', { 'text-anchor': 'middle' })]  // the applications layer also gets a small "your program" box (phone position first)
                : [box('s-proc', 452, by + 20, 132, 40, { rx: 9, 'stroke-width': 2, style: 'fill:var(--panel)' }), txt(518, by + 45, 'your program', { 'text-anchor': 'middle' })]));  // the wide-screen position of the "your program" box
              if (id === 'cmds') kids.push(...(NW ? [box('s-panel', 272, by + 56, 72, 32, { rx: 9, 'stroke-width': 2, style: 'fill:var(--panel)' }), txt(308, by + 77, 'printf()', { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 400, class: 's-monot' })]  // the commands layer also gets a small printf() box (phone position first)
                : [box('s-panel', 508, by + 22, 78, 40, { rx: 9, 'stroke-width': 2, style: 'fill:var(--panel)' }), txt(547, by + 47, 'printf()', { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 400, class: 's-monot' })]));  // the wide-screen position of the printf() box
              if (id === 'kern') {  // the kernel layer shows its three parts inside it:
                kids.push(...(NW  // chooses the layout for the screen size
                  ? [box('s-proc', 42, by + 40, 150, 50), txt(117, by + 61, 'Process control', { 'text-anchor': 'middle' }), txt(117, by + 79, 'subsystem', { 'text-anchor': 'middle' }),  // phones: the process control box, its label on two lines
                    box('s-io', 200, by + 40, 142, 50), txt(271, by + 70, 'File subsystem', { 'text-anchor': 'middle' }),  // phones: the file subsystem box beside it
                    box('s-panel', 42, by + 100, 300, 36), txt(192, by + 123, 'Hardware control', { 'text-anchor': 'middle', 'font-size': 14 })]  // phones: the hardware control bar underneath both
                  : [box('s-proc', 52, by + 42, 266, 38), txt(185, by + 66, 'Process control subsystem', { 'text-anchor': 'middle' }),  // wide: the process control subsystem box
                    box('s-io', 330, by + 42, 248, 38), txt(454, by + 66, 'File subsystem', { 'text-anchor': 'middle' }),  // wide: the file subsystem box beside it
                    box('s-panel', 52, by + 90, 526, 28), txt(315, by + 109, 'Hardware control', { 'text-anchor': 'middle', 'font-size': 14 })]));  // wide: the hardware control bar underneath; closes the kernel parts
              }  // ends the kernel's extra parts
              k.push(s('g', { class: 'hot' + (sel ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': b.t, onclick: () => pick(id),  // wraps the layer in a clickable group; clicking it calls pick() with the layer id
                onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } } }, ...kids));  // pressing Enter or Space on a focused layer does the same, for keyboard users
            });  // ends the layers loop
            // the two routes into the kernel: a direct system call, and a call through a library routine
            if (NW) k.push(arrow(236, 100, 236, 220, 'accent'), txt(229, 198, 'write()', { 'text-anchor': 'end', 'font-size': 13.5, class: 's-monot', style: 'fill:var(--accent)', 'pointer-events': 'none' }),  // phones: an accent arrow for a direct write() call from your program down to the system call interface
              arrow(308, 100, 308, 168, 'ink-2'), arrow(308, 204, 308, 220, 'accent'));  // phones: a grey arrow from your program to printf(), then an accent arrow from printf() down to the interface
            else k.push(arrow(474, 68, 474, 194, 'accent'), txt(467, 150, 'write()', { 'text-anchor': 'end', 'font-size': 13.5, class: 's-monot', style: 'fill:var(--accent)', 'pointer-events': 'none' }),  // wide screens: the same direct write() arrow and its label
              arrow(547, 68, 547, 118, 'ink-2'), arrow(547, 162, 547, 194, 'accent'));  // wide screens: the same two-part route through printf()
            svg.replaceChildren(...k);  // replaces the old drawing with the new one
          }  // ends draw()
          function learnPanel() {  // learnPanel(): fills the panel with the chosen layer's details in learn mode
            const b = L[cur];  // b is the chosen layer
            panel.replaceChildren(  // replaces the panel contents with:
              h('div', { class: 'card info fade-in', style: { gap: '8px' } }, h('h3', {}, b.t), h('p', { html: b.job }), h('div', { class: 'eg', html: b.eg })),  // an info card with the layer's name, its job and an example (fades in)
              h('div', { class: 'callout tip m0 small', 'data-label': 'Two routes into the kernel', html: 'A program can make a system call <b>directly</b> (<code>write()</code> on the diagram) or call a <b>library routine</b> such as <code>printf()</code> that makes the call for it. Either way the request crosses the system call interface.' }));  // a tip box explaining the two routes into the kernel: a direct system call or a library routine
          }  // ends learnPanel()
          function sortPanel(fb) {  // sortPanel(fb): fills the panel for the sorting game; fb is an optional feedback box from the last click
            const done = qi >= ITEMS.length;  // done is true once every item has been sorted
            const right = results.filter((r) => r === 'ok').length;  // right counts the items answered right on the first try
            const dots = h('div', { class: 'row', style: { gap: '4px' } }, ...ITEMS.map((_, i) => h('span', { class: 'dot ' + (results[i] || (i === qi ? 'cur' : '')) })));  // a row of progress dots: green or amber for answered items, chapter colour for the current one
            if (done) {  // when the game is finished:
              panel.replaceChildren(dots, h('div', { class: 'card info fade-in' }, h('h3', {}, `Sorted all ${ITEMS.length}: ${right} right first time`),  // shows the dots and a summary card with the first-try score
                h('p', { html: 'The pattern to remember: <b>everything above the system call interface is ordinary user-mode software</b>, even the shell and the compiler. Only the kernel runs in kernel mode and touches the hardware.' }),  // the lesson to remember: everything above the system call interface is ordinary user-mode software
                h('button', { class: 'btn sm', type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => { qi = 0; tries = 0; results = []; sortPanel(); } }, 'Sort them again')));  // a "Sort them again" button that clears the progress and restarts the game
              return;  // stops here so the question screen below is not drawn
            }  // ends the finished case
            panel.replaceChildren(dots,  // otherwise the panel shows, in order:
              h('div', { class: 'card white stack', style: { gap: '6px' } }, h('div', { class: 'xs muted b' }, `ITEM ${qi + 1} OF ${ITEMS.length} · CLICK THE LAYER WHERE IT LIVES`), h('div', { class: 'u8-item', html: ITEMS[qi][0] })),  // a card with "item N of 8" and the item to sort in large text
              fb || h('p', { class: 'small muted m0' }, 'Click a layer in the diagram.'),  // the feedback from the last click, or a hint to click a layer
              h('div', { class: 'card tight', style: { marginTop: 'auto' } }, h('h4', {}, 'Questions that decide the layer'),  // pushed to the bottom: a card of questions that help decide the layer
                h('ul', { class: 'small m0', style: { lineHeight: '1.45' } },  // the list of those questions
                  h('li', { html: 'Is it a physical device? <b>Hardware</b>.' }),  // question for hardware: is it a physical device?
                  h('li', { html: 'Does it need full privilege, or manage processes, memory or files? <b>Kernel</b>.' }),  // question for the kernel: does it need full privilege or manage processes, memory or files?
                  h('li', { html: 'Is it one of the official ways in? <b>System call interface</b>.' }),  // question for the system call interface: is it an official way in?
                  h('li', { html: 'Does it ship with UNIX but run as a normal program? <b>Commands and libraries</b>.' }),  // question for commands and libraries: does it ship with UNIX but run as a normal program?
                  h('li', { html: 'Did someone write it for their own work? <b>Applications</b>.' }))));  // question for applications: did someone write it for their own work? Closes the list and the card
          }  // ends sortPanel()
          function pick(id) {  // pick(id): runs when a layer is clicked; what happens depends on the mode
            if (mode === 'learn') { cur = id; draw(); learnPanel(); return; }  // learn mode: select that layer, repaint the diagram and show its details, then stop
            if (qi >= ITEMS.length) return;  // sorting mode: ignore clicks once every item is done
            const [, ans, why] = ITEMS[qi];  // ans is the correct layer for the current item and why its explanation
            if (id === ans) {  // a right answer:
              results[qi] = tries ? 'warn' : 'ok';  // records "ok" if it was the first try, or "warn" if it took more than one
              flashes[id] = 'ok'; draw();  // flashes the clicked layer green and repaints
              const fb = h('div', { class: 'callout tip m0 small fade-in', 'data-label': 'Right: ' + L[id].t, html: why });  // builds a green feedback box naming the layer and giving the explanation
              qi++; tries = 0; sortPanel(fb);  // moves to the next item, resets the try counter and redraws the panel with the feedback
              ctx.after(700, () => { delete flashes[id]; draw(); });  // after 0.7 seconds the green flash is removed (ctx.after is a timer that is cancelled if the student leaves the step)
            } else {  // a wrong answer:
              tries++; flashes[id] = 'bad'; draw();  // counts the try, flashes the clicked layer red and repaints
              sortPanel(h('div', { class: 'callout warn m0 small fade-in', 'data-label': 'Not ' + L[id].t, html: 'Think about who wrote it and whether it needs kernel privilege. Try another layer.' }));  // shows an amber box naming the wrong layer and a hint to think about who wrote it and what privilege it needs
              ctx.after(700, () => { delete flashes[id]; draw(); });  // after 0.7 seconds the red flash is removed
            }  // ends the right-or-wrong branches
          }  // ends pick()
          const seg = ctx.ui.seg([{ value: 'learn', label: 'Explore the layers' }, { value: 'sort', label: 'Sort the software' }], 'learn', (v) => { mode = v; draw(); if (v === 'learn') learnPanel(); else sortPanel(); });  // the mode selector: switching repaints the diagram and shows either the layer details or the sorting game
          const intro = h('p', { class: 'm0', html: 'A UNIX system is built in <b>layers</b>. Each layer relies on the one below it, and only the <span class="t">kernel</span> touches the hardware.' });  // the introduction line above the selector: UNIX is built in layers and only the kernel touches the hardware
          const pic = h('div', { class: 'card white', style: { padding: '10px 10px', alignSelf: 'start' } }, svg);  // pic: the white card holding the layer drawing
          if (NW) el.append(h('div', { class: 'stack', style: { gap: '10px' } }, intro, seg, pic, panel));   // phones: diagram right under the selector, answers below it
          else el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) 624px', gap: '20px' } },  // wide screens: text, selector and panel on the left, the diagram in a fixed 624-pixel column on the right
            h('div', { class: 'stack', style: { gap: '10px' } }, intro, seg, panel), pic));  // the left column's contents, then the diagram card; closes the layout
          draw(); learnPanel();  // draws the diagram and shows the starting layer (the system call interface)
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------- 5. Inside the traditional kernel: explore + route requests ---------------- */
      {  // step 5 starts here: the kernel block diagram, to explore or to route requests to the right block
        title: 'Inside the traditional UNIX kernel: click every block',  // step title shown at the top of the screen
        kind: 'explore',  // kind "explore" labels the step as an Explore screen
        core: true, // on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds the kernel diagram and its panel when the student arrives on this step
          const { h } = ctx;  // h builds page elements, taken from the guide's toolkit
          const INFO = {  // INFO: what each kernel block is, keyed by block id: its half of the kernel, a short "does" phrase, a job text and an example
            user: { half: 'user level', does: 'is ordinary user code, outside the kernel',  // block "user": user level; the "does" phrase is used in the wrong-answer message of the routing game
              job: 'Ordinary programs running in user mode. They reach the kernel in exactly one way: by executing a <span class="t">trap instruction</span>, either in their own code or, far more often, inside a library routine they call.',  // job text: user programs reach the kernel only by a trap, usually inside a library routine
              eg: 'Your program calls <code>read(fd, buf, 512)</code> to get the next 512 bytes of a file.' },  // example: your program calls read() for the next 512 bytes
            lib: { half: 'user level', does: 'holds ready-made user-mode routines',  // block "lib": user level
              job: 'Ready-made routines, such as the C library, that programs link with. Many are thin wrappers that put the system call number and arguments where the kernel expects them and execute the trap. Others, like <code>printf</code>, do real work first and then make a system call.',  // job text: library routines, many of them thin wrappers that set up and make a system call
              eg: 'The library\'s <code>read</code> wrapper is only a handful of instructions long.' },  // example: the read wrapper is only a few instructions long
            sci: { half: 'kernel entry', does: 'only receives calls and passes them on',  // block "sci": the kernel entry
              job: 'Where every trap lands. It works out which call was requested (by its number), checks and copies the arguments, and hands the work to the file subsystem or the process control subsystem. On the way out it hands back the result and returns the processor to user mode.',  // job text: where every trap lands; it identifies the call, checks the arguments and passes the work on
              eg: '<code>open</code>, <code>read</code> and <code>write</code> go mainly to the file subsystem; <code>fork</code>, <code>exit</code> and <code>wait</code> mainly to process control.' },  // example: which calls go mainly to the file subsystem and which to process control
            fs: { half: 'file subsystem', does: 'manages files and moves data to and from devices',  // block "fs": the file subsystem
              job: 'Manages files: names and directories, permissions, which disk blocks belong to which file, and free space. It moves data between main memory and external devices in two ways: <b>in blocks</b>, through the buffer cache, or <b>as a stream of characters</b>, straight to a character driver.',  // job text: names, permissions, block maps and free space, and the two ways data moves (blocks or characters)
              eg: 'Opening <code>/home/ana/notes.txt</code> means walking the directories to find the file, then checking that you may read it.' },  // example: opening a named file means walking the directories and checking permission
            bc: { half: 'file subsystem', does: 'keeps recently used disk blocks in memory',  // block "bc": the buffer cache, part of the file subsystem
              job: 'A pool of buffers in main memory holding copies of recently used disk blocks. Every block request looks here first; only a miss goes to the disk. Writes can also wait here and reach the disk later, in larger batches.',  // job text: recently used disk blocks kept in memory; checked first, and writes can wait here too
              eg: 'Compile the same program twice: the second time, most of the source file\'s blocks come straight from the cache.' },  // example: compiling a program twice finds most blocks in the cache the second time
            chr: { half: 'file subsystem', does: 'drives byte-stream devices such as terminals',  // block "chr": character device drivers
              job: 'Drivers for <span class="t">character devices</span>: terminals, printers and modems, which move an unstructured stream of bytes. Their data flows between the file subsystem and the driver without passing through the buffer cache. (A disk can also be opened this way, as a "raw" device.)',  // job text: drivers for byte-stream devices, which skip the buffer cache
              eg: 'Each key you press on a terminal arrives as one character.' },  // example: each key press on a terminal arrives as one character
            blk: { half: 'file subsystem', does: 'drives block devices such as disks',  // block "blk": block device drivers
              job: 'Drivers for <span class="t">block devices</span>: devices that store data in fixed-size numbered blocks, mainly disks (tapes were handled this way too). They move whole blocks between the device and buffers in the buffer cache.',  // job text: drivers for disks and other block devices, moving whole blocks to and from the cache
              eg: '"Read block 7,412 into buffer 19" is a typical request to a disk driver.' },  // example: a typical request to a disk driver, reading block 7,412 into a buffer
            pcs: { half: 'process control', does: 'is the whole process half; pick the specific part',  // block "pcs": the whole process control box; clicking it in the game asks for a more specific part
              job: 'The half of the kernel that manages <span class="t">processes</span>: creating and ending them, sharing the processor among them, giving them memory, and letting them coordinate. Its three parts are memory management, the scheduler (scheduling and dispatching), and synchronization and interprocess communication.',  // job text: the process half of the kernel and its three parts
              eg: '<code>fork</code> (make a new process), <code>exit</code> and <code>wait</code> land here.' },  // example: fork, exit and wait land here
            ipc: { half: 'process control', does: 'lets processes coordinate and communicate',  // block "ipc": synchronization and interprocess communication
              job: 'Synchronization and interprocess communication: <b>signals</b> that tell a process an event happened and <b>pipes</b> that carry data from one process to the next (System V later added messages, shared memory and semaphores). Inside the kernel it also puts a process to <b>sleep</b> until an event it needs (such as a disk transfer finishing) and <b>wakes</b> it afterwards.',  // job text: signals, pipes, and putting processes to sleep until an event and waking them
              eg: 'Pressing Ctrl-C sends a signal that asks the running program to stop.' },  // example: Ctrl-C sends a signal to stop the running program
            sch: { half: 'process control', does: 'picks which process runs next',  // block "sch": the scheduler
              job: 'Scheduling and dispatching: chooses which ready process runs next, <span class="t">dispatches</span> it by switching the processor to it, and takes the processor back when its time slice ends or it has to wait.',  // job text: chooses the next ready process, dispatches it and takes the processor back later
              eg: 'While one process waits for the disk, the scheduler lets another one run.' },  // example: while one process waits for the disk, another runs
            mm: { half: 'process control', does: 'hands out memory and swaps processes out',  // block "mm": memory management
              job: 'Gives each process its own region of main memory, stops processes from touching each other\'s memory, and moves processes out to disk and back when memory runs short (<span class="t">swapping</span>, and in later versions paging).',  // job text: gives each process protected memory and swaps processes to disk when memory is short
              eg: 'Too many programs at once? Memory management swaps an idle one out to disk.' },  // example: with too many programs, an idle one is swapped out
            hwc: { half: 'machine-dependent layer', does: 'handles interrupts and talks to the machine directly',  // block "hwc": hardware control, the machine-dependent layer
              job: 'The lowest layer of the kernel. It fields <span class="t">interrupts</span> from the clock, disks and terminals, and communicates with the machine directly: device registers, the timer and the memory-management hardware. Most machine-dependent code lives here.',  // job text: fields interrupts and talks to device registers, the timer and memory hardware
              eg: 'The clock interrupts many times a second. Hardware control fields each tick, and the scheduler uses the ticks to tell when a process has used up its time slice.' },  // example: clock ticks arrive here and the scheduler uses them to measure time slices
            hw: { half: 'hardware level', does: 'is the physical machine, not kernel code',  // block "hw": the hardware itself, not kernel code
              job: 'The physical machine: processor, main memory, disks and terminals. It signals the kernel with interrupts and obeys commands written to its device registers.',  // job text: the physical machine, which signals with interrupts and obeys its device registers
              eg: 'A disk needs milliseconds to fetch a block; a main-memory access takes well under a microsecond, tens of thousands of times faster.' },  // example: a disk block takes milliseconds, a memory access well under a microsecond
          };  // closes the INFO table
          const REQ = [  // REQ: the routing game, each as [request shown, correct block id, explanation shown when answered]
            ['Decide which ready process gets the processor next, and switch to it', 'sch', 'Scheduling and dispatching belong to the scheduler, inside the process control subsystem.'],  // request 1: pick and switch to the next process belongs to the scheduler
            ['Work out which disk blocks hold the file <code>/home/ana/notes.txt</code>', 'fs', 'Names, directories and the map from a file to its disk blocks are the file subsystem\'s job.'],  // request 2: finding which blocks hold a file belongs to the file subsystem
            ['A block read a moment ago is needed again: hand it over without touching the disk', 'bc', 'The buffer cache keeps recent blocks in main memory, so a repeat read needs no disk access.'],  // request 3: handing over a recently read block belongs to the buffer cache
            ['Receive the trap, look up which call was requested and check its arguments', 'sci', 'Every trap lands at the system call interface, which identifies the call and passes it to the right subsystem.'],  // request 4: receiving the trap and checking arguments belongs to the system call interface
            ['Find room in memory for a new process, or swap one out when memory is full', 'mm', 'Allocating memory and swapping are memory management, part of the process control subsystem.'],  // request 5: finding memory or swapping belongs to memory management
            ['Send the characters of an error message to a terminal, one byte after another', 'chr', 'A terminal is a character device: bytes flow as a stream to its driver, with no buffer cache.'],  // request 6: sending an error message byte by byte to a terminal belongs to the character drivers
            ['Let one process wait asleep until another sends it a message', 'ipc', 'Sleeping, waking and messages are synchronization and interprocess communication, part of process control.'],  // request 7: sleeping until a message arrives belongs to synchronization and IPC
            ['Command the disk controller to read block 7,412 into a buffer', 'blk', 'Disks are block devices; their drivers move whole blocks between the disk and the buffer cache.'],  // request 8: telling the disk controller to read a block belongs to the block drivers
            ['Field the disk\'s "transfer finished" interrupt', 'hwc', 'Interrupts arrive at hardware control, the kernel\'s lowest, machine-dependent layer, which runs the right handler.'],  // request 9: fielding the disk's "transfer finished" interrupt belongs to hardware control
          ];  // closes the REQ list
          let mode = 'learn', sel = 'sci', qi = 0, tries = 0, results = [];  // mode is "learn" or "route"; sel is the chosen block; qi is the current request; tries counts wrong clicks; results records each request
          const flash = {};  // flash: blocks briefly coloured green or red after a routing click, keyed by block id
          const kd = kernelDiagram(ctx, pick);  // kd is the shared kernel diagram; every block click calls pick() below
          const panel = h('div', { class: 'stack grow', style: { gap: '10px' } });  // panel: the area beside the diagram that shows block details or the routing game
          const paint = () => kd.draw({ sel: mode === 'learn' ? sel : null, flash });  // paint(): redraws the diagram with the selected block outlined (learn mode only) and any flashes
          function learnPanel() {  // learnPanel(): fills the panel with the chosen block's details
            const c = KB[sel], I = INFO[sel];  // c is the block's drawing entry (for its label) and I its INFO entry
            panel.replaceChildren(  // replaces the panel contents with:
              h('div', { class: 'card info fade-in' },  // an info card that fades in, holding:
                h('div', { class: 'row gap-s' }, h('h3', {}, ({ chr: 'Character device drivers', blk: 'Block device drivers' })[sel] || c.t.join(' ')), h('span', { class: 'chip ' + (({ 'file subsystem': 'io', 'process control': 'proc', 'kernel entry': 'accent', 'machine-dependent layer': 'os', 'hardware level': 'cpu' })[I.half] || '') }, I.half)),  // a heading (a fuller name for the two driver blocks) and a coloured chip naming which half of the kernel it belongs to
                h('p', { html: I.job }), h('div', { class: 'eg', html: I.eg })),  // the block's job and an example box; closes the info card
              h('div', { class: 'callout why m0 small', 'data-label': 'Why two halves?', html: 'Nearly every kernel service is about one of two things: <b>running programs</b> (processes, the processor, memory) or <b>storing and moving data</b> (files and devices). The traditional kernel is split the same way.' }));  // a "why two halves?" box: kernel services are about running programs or about storing and moving data
          }  // ends learnPanel()
          function routePanel(fb) {  // routePanel(fb): fills the panel for the routing game; fb is an optional feedback box from the last click
            const dots = h('div', { class: 'row', style: { gap: '4px' } }, ...REQ.map((_, i) => h('span', { class: 'dot ' + (results[i] || (i === qi ? 'cur' : '')) })));  // a row of progress dots, one per request, coloured by result, with the current one in the chapter colour
            if (qi >= REQ.length) {  // when every request has been routed:
              const right = results.filter((r) => r === 'ok').length;  // right counts the requests answered right on the first try
              panel.replaceChildren(dots, h('div', { class: 'card info fade-in' }, h('h3', {}, `All ${REQ.length} requests routed: ${right} right first time`),  // shows the dots and a summary card with the first-try score
                h('p', { html: 'Notice the split: anything about <b>files and devices</b> lands on the left (file subsystem, buffer cache, drivers); anything about <b>processes</b> lands on the right (memory, scheduler, IPC); interrupts arrive at <b>hardware control</b>.' }),  // the lesson: files and devices land on the left of the kernel, processes on the right, interrupts at hardware control
                h('button', { class: 'btn sm', type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => { qi = 0; tries = 0; results = []; routePanel(); } }, 'Route them again')));  // a "Route them again" button that clears the progress and restarts the game
              return;  // stops here so the question screen below is not drawn
            }  // ends the finished case
            panel.replaceChildren(dots,  // otherwise the panel shows, in order:
              h('div', { class: 'card white stack', style: { gap: '6px' } }, h('div', { class: 'xs muted b' }, `REQUEST ${qi + 1} OF ${REQ.length} · CLICK THE BLOCK THAT HANDLES IT`), h('div', { class: 'u8-item', html: REQ[qi][0] })),  // a card with "request N of 9" and the request in large text
              fb || h('p', { class: 'small muted m0' }, 'Click the most specific block in the diagram.'),  // the feedback from the last click, or a hint to click the most specific block
              h('div', { class: 'row gap-s', style: { marginTop: 'auto' } },  // pushed to the bottom: a row of running counts
                h('span', { class: 'chip ok' }, 'right first time: ' + results.filter((r) => r === 'ok').length),  // green chip: how many were right first time
                h('span', { class: 'chip warn' }, 'needed another try: ' + results.filter((r) => r === 'warn').length),  // amber chip: how many needed another try
                h('span', { class: 'xs muted' }, 'Left side of the kernel: files and devices. Right side: processes.')));  // a reminder that the left side of the kernel is files and devices and the right side is processes
          }  // ends routePanel()
          function pick(id) {  // pick(id): runs when a block is clicked; what happens depends on the mode
            if (mode === 'learn') { sel = id; paint(); learnPanel(); return; }  // learn mode: select that block, repaint and show its details, then stop
            if (qi >= REQ.length) return;  // routing mode: ignore clicks once every request is done
            const [, ans, why] = REQ[qi];  // ans is the correct block for the current request and why its explanation
            if (id === ans) {  // a right answer:
              results[qi] = tries ? 'warn' : 'ok'; flash[id] = 'ok'; paint();  // records "ok" for a first try or "warn" otherwise, flashes the block green and repaints
              const fb = h('div', { class: 'callout tip m0 small fade-in', 'data-label': 'Right: ' + KB[id].t.join(' '), html: why });  // builds a green feedback box naming the block and giving the explanation
              qi++; tries = 0; routePanel(fb);  // moves to the next request, resets the try counter and redraws the panel with the feedback
            } else {  // a wrong answer:
              tries++; flash[id] = 'bad'; paint();  // counts the try, flashes the clicked block red and repaints
              routePanel(h('div', { class: 'callout warn m0 small fade-in', 'data-label': 'Not the ' + KB[id].t.join(' ').toLowerCase(), html: `That block ${INFO[id].does}. Try again.` }));  // shows an amber box that says what the clicked block actually does, using its INFO "does" phrase
            }  // ends the right-or-wrong branches
            ctx.after(650, () => { delete flash[id]; paint(); });  // after 0.65 seconds either flash is removed and the diagram repainted
          }  // ends pick()
          const seg = ctx.ui.seg([{ value: 'learn', label: 'Explore the blocks' }, { value: 'route', label: 'Route the requests' }], 'learn', (v) => { mode = v; paint(); if (v === 'learn') learnPanel(); else routePanel(); });  // the mode selector: switching repaints the diagram and shows the block details or the routing game
          const right = h('div', { class: 'stack', style: { gap: '10px' } },  // right column: an introduction, the mode selector and the panel
            h('p', { class: 'm0', html: 'The traditional kernel has two main parts, the <span class="t">process control subsystem</span> and the <span class="t">file subsystem</span>, sitting on <span class="t">hardware control</span>. Click any block.' }),  // introduction: the two main parts of the kernel sitting on hardware control
            seg, panel);  // the selector and the panel; closes the right column
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : '616px minmax(0, 1fr)', gap: '20px' } },  // page layout: the diagram in a fixed 616-pixel column on wide screens, stacked above the panel on phones
            h('div', { class: 'card white', style: { padding: '6px 8px', alignSelf: 'start' } }, kd.svg), right));  // the diagram inside a white card, then the right column; closes the layout
          paint(); learnPanel();  // draws the diagram and shows the starting block (the system call interface)
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------- 6. Trace a read() through the kernel ---------------- */
      {  // step 6 starts here: an animated trace of one read() call, a prediction game, then the faster cache-hit case
        title: 'Trace a read() from your program to the disk and back',  // step title shown at the top of the screen
        kind: 'lab',  // kind "lab" labels the step as a Hands-on Lab
        core: true, // on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds the trace, the code box and the prediction game when the student arrives on this step
          const { h } = ctx;  // h builds page elements, taken from the guide's toolkit
          let kd;   // the kernel diagram; built below, once the prediction handler exists
          // one frame = [block the request is at, processor mode, process state, where block 7,412 is, narration]
          const START = [  // START: the first four frames, shared by a miss and a hit
            ['user', 'user', 'Running', 'on disk only', 'Your program calls <code>read(fd, buf, 512)</code>: "give me the next 512 bytes of the file I opened as <code>fd</code>, and put them in <code>buf</code>". It is running in <b>user mode</b>.'],  // frame 1: your program calls read() in user mode (the narration explains fd, buf and 512)
            ['lib', 'user', 'Running', 'on disk only', 'The call goes to the C library\'s <b>read wrapper</b>, which puts the number of the read system call and its three arguments where the kernel expects to find them.'],  // frame 2: the C library's read wrapper sets up the call number and arguments
            ['sci', 'kernel', 'Running', 'on disk only', 'The wrapper executes the <b>trap instruction</b>: the processor switches to <b>kernel mode</b> and enters the <b>system call interface</b>, which sees "read", checks that <code>fd</code> is an open file and that <code>buf</code> lies in the program\'s own memory.'],  // frame 3: the trap switches to kernel mode and the system call interface checks the arguments
            ['fs', 'kernel', 'Running', 'on disk only', 'The <b>file subsystem</b> takes over. From <code>fd</code> it finds the open file and the current position in it, and works out which disk block holds the next 512 bytes: block 7,412.'],  // frame 4: the file subsystem finds which disk block holds the next bytes, block 7,412
          ];  // closes START
          const MISS = [  // MISS: the ten frames that follow when the block is not in memory
            ['bc', 'kernel', 'Running', 'on disk only', 'It asks the <b>buffer cache</b> for block 7,412. <b>Miss:</b> that block is not in memory, so the cache sets aside a free buffer to receive it.'],  // miss frame 5: the buffer cache misses and sets aside a free buffer
            ['blk', 'kernel', 'Running', 'being read from disk', 'The <b>block device driver</b> tells the disk controller to read block 7,412 into that buffer. The disk must now move and spin into position, which takes milliseconds.'],  // miss frame 6: the block driver tells the disk to read the block
            ['ipc', 'kernel', 'Asleep (Blocked)', 'being read from disk', 'Nothing more can happen for this process until the block arrives, so the kernel puts it to <b>sleep</b>, waiting on that buffer. It is now Blocked.'],  // miss frame 7: the process is put to sleep (Blocked) while it waits
            ['sch', 'kernel', 'Asleep (Blocked)', 'being read from disk', 'The <b>scheduler</b> dispatches a different ready process, so the processor does useful work during the long disk transfer instead of sitting idle.'],  // miss frame 8: the scheduler runs a different process during the wait
            ['hw', 'other', 'Asleep (Blocked)', 'in the buffer cache', 'Milliseconds later, while the other process is still running, the <b>disk</b> finishes copying the block into the buffer and raises an <b>interrupt</b> to say the transfer is done.'],  // miss frame 9: the disk finishes and raises an interrupt; "other" means another process was running
            ['hwc', 'kernel', 'Asleep (Blocked)', 'in the buffer cache', 'The interrupt briefly stops the other process and puts the processor back in kernel mode. <b>Hardware control</b> fields it and runs the disk driver\'s interrupt handler, which marks the buffer as full and valid.'],  // miss frame 10: hardware control fields the interrupt and marks the buffer full
            ['ipc', 'kernel', 'Ready', 'in the buffer cache', 'The kernel <b>wakes up</b> the processes sleeping on that buffer. Ours becomes Ready; when the scheduler picks it again, it carries on inside the kernel where it stopped.'],  // miss frame 11: the sleeping process is woken and becomes Ready
            ['fs', 'kernel', 'Running', 'copied into buf', 'Running again, the <b>file subsystem</b> copies the 512 bytes from the buffer into <code>buf</code> in the program\'s memory and moves the file position on by 512.'],  // miss frame 12: the file subsystem copies the 512 bytes into buf
            ['sci', 'kernel', 'Running', 'copied into buf', 'The <b>system call interface</b> puts the result, 512 bytes read, where the program will look for it, and returns from the trap, which switches the processor back to user mode.'],  // miss frame 13: the system call interface returns the result and switches back to user mode
            ['user', 'user', 'Running', 'copied into buf', '<b>Done.</b> The wrapper returns and <code>n</code> is 512. It took several milliseconds, nearly all of it waiting for the disk, and 14 stops. Block 7,412 now stays in the cache. <b>Next:</b> choose <b>2 · Predict a hit</b>.'],  // miss frame 14: read returns 512; the narration points the student to the prediction game
          ];  // closes MISS
          const HIT = [  // HIT: the four frames that follow when the block is already in the buffer cache
            ['bc', 'kernel', 'Running', 'in the buffer cache', 'It asks the <b>buffer cache</b> for block 7,412. <b>Hit:</b> the block was used recently and is still in memory. No driver, no disk, no sleeping.'],  // hit frame 5: the buffer cache has the block, so no driver, disk or sleep is needed
            ['fs', 'kernel', 'Running', 'copied into buf', 'The <b>file subsystem</b> copies the 512 bytes from the cached buffer straight into <code>buf</code> and moves the file position on by 512.'],  // hit frame 6: the file subsystem copies the bytes straight into buf
            ['sci', 'kernel', 'Running', 'copied into buf', 'The <b>system call interface</b> hands back the result, 512 bytes read, and returns from the trap to user mode.'],  // hit frame 7: the system call interface returns to user mode
            ['user', 'user', 'Running', 'copied into buf', '<b>Done</b> in 8 stops and a few microseconds instead of milliseconds. Everything below the buffer cache was skipped, which is exactly why the kernel keeps one.'],  // hit frame 8: done in 8 stops and microseconds, the reason the kernel keeps a cache
          ];  // closes HIT
          const build = (p) => p === 'miss' ? START.concat(MISS) : START.map((f) => [f[0], f[1], f[2], 'in the buffer cache', f[4]]).concat(HIT);  // build(p): joins the frames for a miss, or for a hit (with the block shown as already cached in the first four)
          let frames = build('miss');  // frames holds the frames the player is showing now; it starts with the miss
          // prediction game: of the blocks the miss visits, which does a hit skip?
          const ONMISS = new Set(START.concat(MISS).map((f) => f[0]));  // ONMISS: every block the miss route visits
          const SKIP = new Set(ONMISS);  // SKIP starts as a copy of those blocks
          START.concat(HIT).forEach((f) => SKIP.delete(f[0]));          // → blk, ipc, sch, hw, hwc
          const nm = (id) => ({ chr: 'Character drivers', blk: 'Block drivers' })[id] || KB[id].t.join(' ');  // nm(id): the block's readable name, with fuller names for the two driver blocks
          let mode = 'miss', marks = new Set(), checked = false, note = '';  // mode is "miss", "predict" or "hit"; marks holds the blocks the student marked; checked is true after Check; note is a message
          kd = kernelDiagram(ctx, (id) => { if (mode === 'predict') mark(id); });  // builds the kernel diagram; clicks only count in predict mode, where they mark or unmark a block
          const route = h('div', { class: 'u8-route2' });  // route: the row of chips that lists every block the trace has passed so far
          const cMode = h('span', { class: 'chip' }), cProc = h('span', { class: 'chip' }), cBlk = h('span', { class: 'chip mem' });  // three status chips above the player: processor mode, our process's state, and where block 7,412 is
          // phones: each comment on its own line above the code, so nothing is cut off at the right edge
          const code = ctx.ui.code(ctx.narrow ? `// room for the data${/* code: a small code box showing the read() call; on phones this first line is a comment on its own line */''}
char buf[512];${/* shown code, phone version line 2: declares a 512-byte buffer named buf */''}
// get next 512 bytes; n = count${/* shown code, phone version line 3: comment explaining what the call asks for */''}
n = read(fd, buf, 512);` : `char buf[512];          // space for the data${/* shown code, phone version line 4 (the read call); then the wide version starts: the buffer with a comment beside it */''}
n = read(fd, buf, 512); // ask for the next 512 bytes`, { lang: 'c', fontSize: ctx.narrow ? 13.5 : 14 });  // shown code, wide version line 2: the read call with its comment; then options: C colouring and a font size per screen
          code.mark(ctx.narrow ? 4 : 2);  // highlights the read() line in the code box (line 4 on phones, line 2 on wide screens)
          const player = ctx.ui.player({ count: frames.length, interval: 2300, speed: false, render: (i) => {  // player: the step-by-step animation control (Play, Previous, Next); every 2.3 seconds it shows the next frame
            const f = frames[i];  // f is the frame being shown
            kd.draw({ active: f[0], token: f[0], visited: new Set(frames.slice(0, i).map((x) => x[0])), noPick: true });  // repaints the diagram: highlights the current block, moves the dot to it, fades blocks not yet reached, and turns off clicking
            // f[1]: 'user' / 'kernel' = the processor is running OUR process in that mode; 'other' = it is running someone else
            cMode.className = 'chip ' + ({ user: 'proc', kernel: 'os', other: '' })[f[1]];  // colours the mode chip: user mode, kernel mode, or neutral when another process holds the processor
            cMode.textContent = f[1] === 'other' ? 'another process runs' : f[1] + ' mode';  // writes the mode chip's text, e.g. "kernel mode" or "another process runs"
            cProc.className = 'chip ' + (f[2] === 'Running' ? 'ok' : f[2] === 'Ready' ? 'accent' : 'warn'); cProc.textContent = 'process: ' + f[2];  // colours the process chip green for Running, accent for Ready and amber for Asleep, and writes the state
            cBlk.textContent = 'block 7,412: ' + f[3];  // writes where block 7,412 is at this moment
            route.replaceChildren(...frames.map((x, j) => j <= i ? h('span', { class: 'chip' + (j === i ? ' accent' : '') }, KB[x[0]].t.join(' ')) : null).filter(Boolean),  // rebuilds the route chips: one per block passed so far, the current one highlighted
              i < frames.length - 1 ? h('span', { class: 'xs muted' }, `… ${frames.length - 1 - i} more`) : h('span', { class: 'chip ok' }, '✓ ' + frames.length + ' stops'));  // ends the route with a count of stops still to come, or a green chip with the total once finished
            return f[4];  // returns the frame's narration, which the player shows as its caption
          } });  // ends the frame-drawing function and the player setup
          /* ---- mode 2: predict which blocks a cache hit skips, by clicking them on the diagram ---- */
          const pBody = h('div', { class: 'stack', style: { gap: '9px' } });  // pBody: the panel for the prediction game, shown only in mode 2
          const flashFor = () => {   // before checking: marked = accent; after: right = ok, still needed = bad, missed = warn
            const fl = {};  // fl collects a colour for each block the miss visited
            ONMISS.forEach((id) => {  // looks at every block on the miss route:
              if (!checked) { if (marks.has(id)) fl[id] = 'accent'; }  // before checking, marked blocks are shown in the accent colour
              else if (marks.has(id)) fl[id] = SKIP.has(id) ? 'ok' : 'bad';  // after checking, a marked block is green if a hit really skips it, red if a hit still needs it
              else if (SKIP.has(id)) fl[id] = 'warn';  // after checking, a skipped block the student did not mark is amber (missed)
            });  // ends the loop over miss blocks
            return fl;  // hands back the colour map
          };  // ends flashFor()
          function mark(id) {  // mark(id): runs when a block is clicked in predict mode
            if (!ONMISS.has(id)) { note = `The miss never visited <b>${nm(id)}</b>, so there is nothing for a hit to skip there. Pick blocks from the miss route.`; }  // a block the miss never visited cannot be skipped, so a note explains that and nothing is marked
            else { note = ''; checked = false; if (marks.has(id)) marks.delete(id); else marks.add(id); }  // otherwise clears the note, un-checks the game and toggles the block's mark
            predictPanel();  // redraws the prediction panel and diagram
          }  // ends mark()
          function predictPanel() {  // predictPanel(): redraws the diagram colours and badges and the game panel from the current marks
            const fl = flashFor(), TAG = { accent: '?', ok: '✓', bad: '✗', warn: '!' }, tag = {};  // fl gets the colours; TAG maps each colour to a badge symbol (question mark, tick, cross, exclamation mark)
            Object.keys(fl).forEach((id) => { tag[id] = [TAG[fl[id]], fl[id]]; });  // builds the badge list: for each coloured block, its symbol and colour
            kd.draw({ flash: fl, tag });  // repaints the diagram with those colours and badges
            const picked = [...ONMISS].filter((id) => marks.has(id));  // picked lists the marked blocks in route order
            const chips = picked.length ? picked.map((id) => h('span', { class: 'chip ' + (checked ? (SKIP.has(id) ? 'ok' : 'bad') : 'accent') }, nm(id))) : [h('span', { class: 'xs muted' }, 'nothing marked yet')];  // chips: one chip per marked block (accent before checking, green or red after), or "nothing marked yet"
            const ask = h('div', { class: 'card white stack', style: { gap: '6px' } },  // ask: the card that poses the question
              h('div', { class: 'xs muted b' }, 'PREDICT BEFORE YOU WATCH THE HIT'),  // small heading: predict before watching the hit
              h('div', { class: 'u8-item', style: { fontSize: '17px' }, html: 'Block 7,412 is <b>already in the buffer cache</b>. Which blocks that the miss visited will this read <b>skip</b>?' }),  // the question: block 7,412 is already cached; which miss blocks will this read skip?
              h('p', { class: 'small muted m0' }, 'Click each one on the diagram (click again to unmark), then check.'));  // instructions: click to mark, click again to unmark, then check; closes the card
            if (!checked) {  // before checking:
              const parts = [ask, h('div', { class: 'u8-route2' }, h('span', { class: 'xs b' }, 'YOU MARKED:'), ...chips)];  // shows the question and a "YOU MARKED:" row of chips
              if (note) parts.push(h('p', { class: 'small m0', html: note }));  // adds the note about a block outside the miss route, if there is one
              parts.push(h('div', { class: 'row gap-s' },  // adds a row of two buttons:
                h('button', { class: 'btn primary sm', type: 'button', disabled: !picked.length, onclick: () => { checked = true; note = ''; predictPanel(); } }, 'Check my prediction'),  // "Check my prediction": turns on checking and redraws; disabled until something is marked
                h('button', { class: 'btn sm', type: 'button', disabled: !picked.length, onclick: () => { marks.clear(); note = ''; predictPanel(); } }, 'Clear')));  // "Clear": removes every mark and redraws; also disabled until something is marked
              pBody.replaceChildren(...parts);  // puts those parts into the panel
              return;  // stops here; the result view below is only for after checking
            }  // ends the before-checking case
            const right = picked.filter((id) => SKIP.has(id)).length, wrong = picked.filter((id) => !SKIP.has(id));  // right counts correctly marked blocks; wrong lists marked blocks that a hit still needs
            const missed = [...SKIP].filter((id) => !marks.has(id));  // missed lists skipped blocks the student did not mark
            const perfect = right === SKIP.size && !wrong.length;  // perfect is true when every skipped block was found and nothing wrong was marked
            pBody.replaceChildren(ask,  // after checking, the panel shows the question again and then:
              h('div', { class: 'callout m0 small fade-in ' + (perfect ? 'tip' : 'warn'), 'data-label': perfect ? 'Exactly right' : `You found ${right} of the ${SKIP.size}`,  // a result box: green "Exactly right", or amber with how many of the skipped blocks were found
                html: (wrong.length ? `<b>✗ Still needed</b> (red): ${wrong.map(nm).join(', ')}. ` : '') + (missed.length ? `<b>! Also skipped</b> (amber): ${missed.map(nm).join(', ')}. ` : '')  // lists any wrongly marked blocks (red) and any missed ones (amber)
                  + 'A hit still needs the way in and out (your program, the library, the system call interface), the <b>file subsystem</b> to find and copy the data, and the <b>buffer cache</b> where it is found. It skips everything that exists only to fetch a block from the disk and wait for it: the block driver, the disk, hardware control, sleeping and waking, and the scheduler.' }),  // then explains which blocks a hit still needs and which it skips, and why
              h('div', { class: 'row gap-s' },  // a row of two buttons:
                h('button', { class: 'btn primary sm', type: 'button', onclick: () => { seg.set('hit'); setMode('hit'); } }, 'Watch the hit ▶'),  // "Watch the hit": switches the selector and the player to mode 3
                h('button', { class: 'btn sm', type: 'button', onclick: () => { marks.clear(); checked = false; predictPanel(); } }, 'Try again')));  // "Try again": clears the marks and the result so the student can predict again; closes the panel
          }  // ends predictPanel()
          const trace = h('div', { class: 'stack', style: { gap: '10px' } },  // trace: the panel for modes 1 and 3, holding:
            h('div', { class: 'row gap-s' }, cMode, cProc, cBlk),  // the three status chips in a row
            player.el,  // the player with its caption and buttons
            h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('div', { class: 'xs muted b' }, 'ROUTE SO FAR'), route),  // a card listing the route so far
            h('p', { class: 'small muted m0', html: '<b>Reading the diagram:</b> the dot and the yellow block show where the request is now; faded blocks have not been reached yet. The chips above track the processor mode, our process\'s state and where block 7,412 is.' }));  // a note explaining how to read the diagram during the trace; closes the trace panel
          function setMode(v) {  // setMode(v): switches between the three modes; runs when the selector changes or "Watch the hit" is pressed
            mode = v; player.stop();  // remembers the mode and stops any running animation
            trace.style.display = v === 'predict' ? 'none' : '';  // hides the trace panel in predict mode
            pBody.style.display = v === 'predict' ? '' : 'none';  // shows the prediction panel only in predict mode
            if (v === 'predict') predictPanel();  // predict mode draws the game
            else { frames = build(v); player.setCount(frames.length); }  // the miss and hit modes load their frames and restart the player at frame 1
            ctx.refit();  // asks the guide to re-check whether the step still fits on screen, since panels changed size
          }  // ends setMode()
          const seg = ctx.ui.seg([{ value: 'miss', label: '1 · Watch a miss' }, { value: 'predict', label: '2 · Predict a hit' }, { value: 'hit', label: '3 · Watch the hit' }], 'miss', setMode);  // the mode selector: 1 watch a miss, 2 predict a hit, 3 watch the hit; starts on the miss
          pBody.style.display = 'none';  // the prediction panel starts hidden
          const right = h('div', { class: 'stack', style: { gap: '10px' } }, seg, code, trace, pBody);  // right column: the selector, the code box, the trace panel and the prediction panel
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : '616px minmax(0, 1fr)', gap: '20px' } },  // page layout: the diagram in a fixed 616-pixel column on wide screens, stacked on phones
            h('div', { class: 'card white', style: { padding: '6px 8px', alignSelf: 'start' } }, kd.svg), right));  // the diagram inside a white card, then the right column; closes the layout
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------- 7. One big program: the monolithic kernel ---------------- */
      {  // step 7 starts here: two short animations showing why the kernel is called monolithic
        title: 'One big program: why the kernel is called monolithic',  // step title shown at the top of the screen
        kind: 'compare',  // kind "compare" labels the step as a Compare screen
        render(el, ctx) {  // render(el, ctx): builds the kernel-image picture and its player when the student arrives on this step
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const SEGS = [['Scheduler'], ['Memory', 'mgmt'], ['IPC'], ['File', 'subsystem'], ['Buffer', 'cache'], ['Terminal', 'driver'], ['Disk', 'driver']];  // SEGS: the labels of the kernel parts drawn side by side in the kernel image (one or two lines each)
          const SEGC = ['s-proc', 's-proc', 's-proc', 's-io', 's-mem', 's-io', 's-io'];  // SEGC: the colour class of each part: process parts, file parts, memory for the cache
          const SEGW = [76, 66, 46, 82, 64, 70, 56];   // relative widths on wide screens, sized to each label (tape driver: 56)
          const A = [  // A: the frames of the "add a device driver" animation; st is the kernel state, users the logged-in count, cap the caption
            { st: 'running', users: 12, cap: '<b>A new tape drive arrives.</b> The running kernel has no code for it, and a traditional UNIX kernel cannot take on new code while it runs: drivers are part of the kernel program itself.' },  // frame 1: a new tape drive arrives and the running kernel cannot take on new code
            { st: 'running', users: 12, src: true, cap: 'A programmer writes the <b>tape driver</b> in C: routines to open, read, write and close the device, plus a handler for its interrupts.' },  // frame 2: a programmer writes the tape driver in C (src shows the new source file beside the kernel)
            { st: 'running', users: 12, src: true, tbl: true, cap: 'The driver\'s routines are entered in the kernel\'s <b>device switch table</b>, which maps each kind of device (by its major device number) to that driver\'s routines. The table is compiled into the kernel, so this is an edit to kernel source.' },  // frame 3: the driver is entered in the device switch table, which is part of the kernel source (tbl)
            { st: 'old image still running', users: 12, tbl: true, built: true, busy: true, cap: 'The <b>entire kernel</b> is recompiled and relinked into a new image file, although only one part changed. All the parts are one program, so they are rebuilt together. Meanwhile the old kernel keeps running.' },  // frame 4: the whole kernel is recompiled and relinked into a new image while the old one keeps running (busy makes the parts pulse)
            { st: 'rebooting', users: 0, tbl: true, built: true, cap: 'To run the new image the machine must be <b>rebooted</b>. Every logged-in user is thrown off and every running program stops.' },  // frame 5: the machine reboots to load the new image, so all users are logged off
            { st: 'running', users: 12, tbl: true, built: true, done: true, cap: 'The new kernel runs with the tape driver <b>inside</b> it, in kernel mode and in the same address space as everything else. Had the driver been badly broken, the machine might not even boot.' },  // frame 6: the new kernel runs with the tape driver inside it (done), sharing one address space with everything else
          ];  // closes the A frames
          const B = [  // B: the frames of the "bug in one driver" animation
            { st: 'running', users: 12, built: true, cap: 'The system runs normally with the tape driver built in. Twelve users are logged in and working.' },  // frame 1: the system runs normally with the tape driver built in and twelve users working
            { st: 'running', users: 12, built: true, bug: true, cap: 'The tape driver has a small bug: its counter runs one step past the end of its buffer, so it writes a byte into memory that is not its own.' },  // frame 2: the tape driver's counter runs past the end of its buffer (bug colours the driver amber)
            { st: 'running', users: 12, built: true, bug: true, hit: true, cap: 'That memory holds the <b>scheduler\'s</b> process table. Nothing stops the write: every part of the kernel runs in kernel mode with access to all kernel memory.' },  // frame 3: the stray byte lands in the scheduler's process table (hit draws the arrow and turns the scheduler red)
            { st: 'PANIC', users: 0, built: true, bug: true, hit: true, panic: true, cap: 'The scheduler soon reads the damaged entry, finds nonsense, and the kernel halts itself with a <b>panic</b>. The whole machine is down and all 12 users lose their unsaved work.' },  // frame 4: the scheduler reads nonsense and the kernel halts with a panic, logging everyone off
            { st: 'PANIC', users: 0, built: true, bug: true, hit: true, panic: true, cap: 'Compare a bug in a <b>user program</b>: memory protection keeps the damage inside that one process, and only it is killed. Inside a monolithic kernel there is no wall between the parts.' },  // frame 5: compared with a user program, where memory protection would contain the damage to one process
          ];  // closes the B frames
          let frames = A, scen = 'add';  // frames is the scenario the player shows now; scen names it ("add" or "bug")
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 390' : '0 0 580 264', width: '100%', role: 'img', 'aria-label': 'The kernel image as one program' });  // creates the kernel-image drawing, taller on phone-width screens where the parts wrap onto two rows
          const cState = h('span', { class: 'chip' }), cUsers = h('span', { class: 'chip proc' }), cParts = h('span', { class: 'chip os' });  // three status chips under the drawing: the kernel's state, the number of users, and how many parts the image holds
          function draw(f) {  // draw(f): repaints the drawing and the chips for one frame; runs every time the player changes frame
            const NW = ctx.narrow;   // phones: segments in two rows of four, panels stacked
            const segs = SEGS.slice(), cls = SEGC.slice(), wts = SEGW.slice();  // copies of the part labels, colours and widths, so adding the tape driver does not change the originals
            if (f.built) { segs.push(['Tape', 'driver']); cls.push('s-io'); wts.push(56); }  // once the driver is built into the kernel, an eighth part "Tape driver" is added
            const x0 = 8, y0 = NW ? 40 : 44;  // x0 and y0 are the top-left corner of the kernel image
            const W = NW ? 344 : (f.src && !f.built ? 474 : 564), sh = NW ? 62 : 84;  // W is the image width (slimmer on wide screens while the new source file sits beside it); sh is each part's height
            const unit = W / wts.reduce((a, b) => a + b, 0);  // unit converts the relative widths into drawing units so the parts exactly fill W
            const segW = (i) => NW ? 86 : wts[i] * unit;  // segW(i): the width of part i (a fixed width on phones)
            const pos = (i) => NW ? [x0 + (i % 4) * 86, y0 + Math.floor(i / 4) * sh] : [x0 + wts.slice(0, i).reduce((a, b) => a + b, 0) * unit, y0];  // pos(i): the top-left corner of part i: four per row on phones, one long row on wide screens
            const barH = NW ? 2 * sh : sh, LY = NW ? 216 : 180;  // barH is the image height (two rows on phones); LY is where the lower panels start
            const k = [s('rect', { x: x0 - 4, y: y0 - 4, width: W + 8, height: barH + 8, rx: 12, class: f.panic ? 's-bad' : 's-os', 'stroke-width': 2.5 })];  // k starts with the big frame around the kernel image, red after a panic
            segs.forEach((sg, i) => {  // draws each kernel part:
              const tape = sg[0] === 'Tape', sched = i === 0, [sx, sy] = pos(i);  // tape and sched mark the tape driver and the scheduler (always first); sx and sy are the part's corner
              let c = cls[i];  // c starts as the part's normal colour
              if (f.panic) c = 's-bad';  // after a panic every part turns red
              else if (sched && f.hit) c = 's-bad';  // the scheduler turns red once the stray write hits it
              else if (tape && f.bug) c = 's-warn';  // the buggy tape driver turns amber
              else if (tape && !f.done && scen === 'add') c = 's-warn';  // in the "add" scenario the new driver stays amber until it is running in the new kernel
              const sw = segW(i);  // sw is this part's width
              const g = s('g', { class: f.busy ? 'pulse' : '' },  // groups the part's shapes; while the kernel is being rebuilt every part pulses
                s('rect', { x: sx + 2, y: sy + 2, width: sw - 4, height: sh - 4, rx: 8, class: c, 'stroke-width': 1.5 }),  // the part's rounded box, inset slightly so neighbours have a gap
                s('text', { x: sx + sw / 2, y: sy + (sg[1] ? sh / 2 - 4 : sh / 2 + 5), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, 'letter-spacing': '-.01em' }, sg[0]),  // the part's first label line, centred (moved up when there is a second line)
                sg[1] ? s('text', { x: sx + sw / 2, y: sy + sh / 2 + 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, 'letter-spacing': '-.01em' }, sg[1]) : null);  // the second label line, if any; closes the group
              k.push(g);  // adds the part to the drawing
            });  // ends the parts loop
            if (f.src && !f.built) {  // while the driver exists only as source code, a separate dashed box shows the new file
              const [bx, by, bw, bh] = NW ? [268, LY + 8, 84, 60] : [494, y0, 76, sh];  // where that box goes: below the image on phones, to the right of it on wide screens
              k.push(s('rect', { x: bx, y: by, width: bw, height: bh, rx: 10, class: 's-warn', 'stroke-width': 2, 'stroke-dasharray': '5 4' }),  // the dashed amber box for the new source file
                s('text', { x: bx + bw / 2, y: by + bh / 2 - 3, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'tape.c'),  // its file name
                s('text', { x: bx + bw / 2, y: by + bh / 2 + 15, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, '(new)'));  // a small "(new)" label under the name
            }  // ends the source-file box
            if (f.hit) {  // when the stray write has happened, an arrow shows it:
              if (NW) {  // on phones:
                const [tx, ty] = pos(7), [qx, qy] = pos(0);  // finds the tape driver's corner and the scheduler's corner
                k.push(s('line', { x1: tx + 20, y1: ty + 14, x2: qx + segW(0) - 10, y2: qy + sh - 10, style: 'stroke:var(--intr)', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', 'marker-end': 'url(#arr-intr)' }),  // a dashed line in the alert colour from the tape driver to the scheduler
                  s('text', { x: 180, y: 24, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--intr)' }, 'stray write into the scheduler\'s table'));  // the label "stray write into the scheduler's table" above the image
              } else {  // on wide screens:
                const xt = pos(7)[0] + segW(7) / 2, xs = x0 + segW(0) / 2;   // from the tape driver to the scheduler
                k.push(s('path', { d: `M${xt},${y0 - 4} C${xt},2 ${xs},2 ${xs},${y0 - 6}`, fill: 'none', style: 'stroke:var(--intr)', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', 'marker-end': 'url(#arr-intr)' }),  // a dashed curved arrow that arcs over the image from the tape driver to the scheduler
                  s('text', { x: (xt + xs) / 2, y: 33, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--intr)' }, 'stray write into the scheduler\'s table'));  // the same label, centred between the two parts
              }  // ends the wide-screen case
            }  // ends the stray-write arrow
            if (f.panic) {  // after a panic:
              const cx = NW ? 180 : 290, cy = NW ? y0 + sh - 18 : y0 + 24;  // cx and cy place the banner over the middle of the image
              k.push(s('rect', { x: cx - 120, y: cy, width: 240, height: 36, rx: 8, style: 'fill:var(--intr);stroke:none' }),  // a solid banner in the alert colour
                s('text', { x: cx, y: cy + 24, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: 'fill:var(--panel)' }, 'panic: kernel halted'));  // the words "panic: kernel halted" in the banner
            }  // ends the panic banner
            k.push(s('text', { x: 12, y: y0 + barH + 24, 'font-size': 13.5, 'font-weight': 700 }, f.busy ? 'recompiling and relinking every part…' : NW ? 'one file, one program, one address space' : 'the kernel image: one file, one program, one address space'));  // a caption under the image: "recompiling..." while rebuilding, otherwise that the kernel is one file, one program, one address space
            // lower left: the device switch table, or the bug
            if (scen === 'add') {  // in the "add" scenario the lower-left panel is the device switch table:
              k.push(s('text', { x: 12, y: LY, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, 'DEVICE SWITCH TABLE'));  // its small heading
              const rows = NW ? [['0', 'terminal', 'terminal routines'], ['1', 'disk', 'disk routines'], ['2', 'tape', f.tbl ? 'tape routines (new)' : '(no driver)']]  // the table rows as [major number, device, routines]; the tape row says "(no driver)" until the table is edited
                : [['0', 'terminal', 'terminal driver routines'], ['1', 'disk', 'disk driver routines'], ['2', 'tape', f.tbl ? 'tape driver routines (new)' : '(no driver)']];  // the same rows with longer wording for wide screens
              rows.forEach((r, i) => {  // draws each row:
                const y = LY + 22 + i * 22, isNew = i === 2 && f.tbl;  // y is the row's height; isNew is true for the tape row once it has been filled in
                if (isNew) k.push(s('rect', { x: 8, y: y - 16, width: NW ? 246 : 284, height: 21, rx: 5, style: 'fill:var(--hl);stroke:none' }));  // the new row gets a yellow highlight behind it
                k.push(s('text', { x: 14, y, 'font-size': 13.5, class: 's-monot' }, r[0]), s('text', { x: 32, y, 'font-size': 13.5 }, r[1] + ' →'), s('text', { x: NW ? 106 : 112, y, 'font-size': 13.5, class: i === 2 && !f.tbl ? 's-sub' : '' }, r[2]));  // the row's number, the device name with an arrow, and its routines (grey while there is no driver)
              });  // ends the rows loop
            } else {  // in the "bug" scenario the lower-left panel shows the buggy code instead:
              k.push(s('text', { x: 12, y: LY, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, 'THE BUG, INSIDE THE TAPE DRIVER'),  // its small heading
                s('rect', { x: 8, y: LY + 10, width: 280, height: 56, rx: 8, class: f.bug ? 's-warn' : 's-panel', 'stroke-width': 1.5 }),  // a box around the code, amber once the bug is active
                s('text', { x: 18, y: LY + 32, 'font-size': 13, class: 's-monot' }, 'buf[n] = b;  // store next byte'),  // shown code, line 1: stores the next byte at position n of the buffer
                s('text', { x: 18, y: LY + 54, 'font-size': 13, class: 's-monot' }, 'n = n + 1;   // never checks size!'));  // shown code, line 2: moves n on without ever checking the buffer size; closes the panel
            }  // ends the lower-left panel
            // the users' processes (right of the table on wide screens, below it on phones)
            const UX = NW ? 12 : 306, UY = NW ? LY + 100 : 180, UG = NW ? 56 : 44, UW = NW ? 48 : 38;  // UX and UY place the users' processes; UG is the spacing between boxes and UW their width
            k.push(s('text', { x: UX, y: UY, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.06em' }, 'USERS\' PROCESSES'));  // the small heading over the users' processes
            for (let i = 0; i < 12; i++) {  // draws twelve user process boxes, six per row
              const x = UX + (i % 6) * UG, y = UY + 12 + Math.floor(i / 6) * 32, on = f.users > 0;  // x and y are this box's position; on is true while users are logged in
              k.push(s('rect', { x, y, width: UW, height: 24, rx: 6, class: on ? 's-proc' : 's-panel', 'stroke-width': 1.5, opacity: on ? 1 : 0.6 }),  // a process-coloured box while running, a faded grey one once users are logged off
                s('text', { x: x + UW / 2, y: y + 17, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: on ? '' : 's-sub' }, on ? 'P' + (i + 1) : '✗'));  // writes P1 to P12 inside running boxes, or a cross inside faded ones
            }  // ends the process boxes loop
            svg.replaceChildren(...k);  // replaces the old drawing with the new one
            cState.className = 'chip ' + (f.st === 'running' ? 'ok' : f.st === 'PANIC' ? 'bad' : 'warn'); cState.textContent = 'kernel: ' + f.st;  // state chip: green while running, red on a panic, amber otherwise, with the state written in it
            cUsers.className = 'chip ' + (f.users ? 'proc' : 'bad'); cUsers.textContent = f.users + ' users logged in';  // users chip: how many users are logged in, red when none are
            cParts.textContent = f.busy ? 'new image: 8 parts' : (f.built ? 8 : 7) + ' parts in one image';  // parts chip: how many parts the kernel image holds (7 before the tape driver, 8 after)
          }  // ends draw()
          const player = ctx.ui.player({ count: frames.length, interval: 2600, render: (i) => { draw(frames[i]); return frames[i].cap; } });  // the player steps through the frames every 2.6 seconds, drawing each one and showing its caption
          const seg = ctx.ui.seg([{ value: 'add', label: 'Add a device driver' }, { value: 'bug', label: 'A bug in one driver' }], 'add', (v) => { scen = v; frames = v === 'add' ? A : B; player.setCount(frames.length); });  // the scenario selector: switching loads the other frame list and restarts the player at frame 1
          const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation of a monolithic kernel
            h('p', { class: 'm0', html: 'Every kernel block from the last two steps is compiled and linked into <b>one program</b>, the kernel image, loaded when the machine starts. It runs in kernel mode in one shared <span class="t">address space</span>, and any part can call any other directly. That is a <span class="t">monolithic kernel</span> (the opposite of the microkernel in section 2.4), and it is <b>not very modular</b>.' }),  // paragraph: every kernel block is linked into one program in one address space, and it is not very modular
            h('div', { class: 'grid-2', style: { gap: '10px' } },  // a two-column grid comparing the upside and the cost
              h('div', { class: 'card tight', style: { borderLeft: '4px solid var(--ok)' } }, h('div', { class: 'b small', style: { color: 'var(--ok)' } }, 'The upside'), h('p', { class: 'small m0' }, 'Fast and simple: a call from the file subsystem to a driver is an ordinary function call, with no messages or copying.')),  // the upside card: fast and simple, since calls between parts are ordinary function calls
              h('div', { class: 'card tight', style: { borderLeft: '4px solid var(--bad)' } }, h('div', { class: 'b small', style: { color: 'var(--bad)' } }, 'The cost'), h('p', { class: 'small m0' }, 'Any change means rebuilding the whole program, and a bug anywhere can bring down everything.'))),  // the cost card: any change means a full rebuild, and a bug anywhere can bring everything down; closes the grid
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"Monolithic" does not mean disorganised: the kernel has clear parts, as you saw. It means nothing <b>separates</b> those parts while they run: one program, one address space, full privilege everywhere.' }),  // common-mistake box: monolithic does not mean disorganised; it means nothing separates the parts while they run
            h('p', { class: 'small muted m0', html: 'Where it goes next: modern UNIX systems (2.9) and Linux (2.10) keep a fast single-program core but add modular pieces that can be loaded while the system runs.' }));  // small print: modern UNIX and Linux keep the single-program core but add loadable modules
          const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the scenario selector, the drawing, the status chips and the player
            seg,  // the scenario selector at the top
            h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // the kernel-image drawing inside a white card
            h('div', { class: 'row gap-s' }, cState, cUsers, cParts),  // the three status chips in a row
            player.el);  // the player with its caption and buttons; closes the right column
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1fr) 612px', gap: '20px' } }, left, right));  // page layout: text on the left and a fixed 612-pixel right column on wide screens, stacked on phones
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------- 8. Recap ---------------- */
      {  // step 8 starts here: six flip cards that recap the section
        title: 'Recap: traditional UNIX in six cards',  // step title shown at the top of the screen
        kind: 'recap',  // kind "recap" labels the step as a Recap and keeps it on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds the flip cards when the student arrives on this step
          const { h } = ctx;  // h builds page elements, taken from the guide's toolkit
          el.append(h('div', { class: 'stack fill', style: { gap: '14px' } },  // a vertical stack that fills the step body
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If you hesitate, go back to that step.'),  // instruction line: answer out loud before flipping each card
            ctx.ui.flipcards([  // flipcards(): the guide's grid of cards that turn over when clicked, each given as [front question, back answer]
              ['Where and when did UNIX begin?', '<div>At <b>Bell Labs</b>, built by Ken Thompson and Dennis Ritchie. It was running on a <b>PDP-7 by 1970</b> and soon moved to the <b>PDP-11</b>.</div>'],  // card 1: where and when UNIX began
              ['Why was the 1973 rewrite in C a milestone?', '<div>Operating systems were almost all written in <b>assembly</b>. C showed a <b>high-level language</b> works for most system code: easier to read, change and port. Only a small machine-dependent part is rewritten per machine.</div>'],  // card 2: why the 1973 rewrite in C was a milestone
              ['What are the two big branches of the family?', '<div><b>AT&amp;T</b>: System III, System V, SVR4. <b>Berkeley (BSD)</b>: 3BSD brought virtual memory, 4.2BSD built in TCP/IP networking. Both grew from Versions 6 and 7.</div>'],  // card 3: the AT&T and Berkeley branches and what each added
              ['Name the layers of a UNIX system, bottom to top.', '<div>Hardware → kernel → <b>system call interface</b> (the boundary) → commands and libraries (shells, compilers, utilities) → user-written applications.</div>'],  // card 4: the layers of a UNIX system from the bottom up
              ['What are the two main parts of the traditional kernel?', '<div><b>Process control</b>: memory management, scheduling and dispatching, synchronization and IPC. <b>File subsystem</b>: buffer cache, character and block drivers. Both sit on <b>hardware control</b>.</div>'],  // card 5: the two main parts of the kernel and what each contains
              ['Why is the traditional kernel called monolithic?', '<div>It is <b>one big program</b> in one address space, all in kernel mode. Fast, but <b>not very modular</b>: changes mean rebuilding it, and a bug anywhere can crash everything.</div>'],  // card 6: why the traditional kernel is called monolithic
            ], { cols: 3, height: 222 })));  // closes the card list: three columns, each card 222 pixels tall; closes the layout
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Check yourself ---------------- */
      {  // step 9 starts here: the section quiz, checked by the guide's quiz engine
        title: 'Check yourself: traditional UNIX',  // step title shown at the top of the screen
        kind: 'check',  // kind "check" labels the step "Check Yourself"
        quiz: [  // quiz: the list of questions; each type is multiple choice unless it says otherwise
          { q: 'Where was UNIX first developed, and on which machine was it running by 1970?',  // question 1 (multiple choice): where UNIX was first developed and on which machine
            choices: ['At UC Berkeley, on a DEC VAX', 'At IBM, on a System/360 mainframe', 'At Bell Labs, on a DEC PDP-7', 'At MIT, on the Multics computer'], answer: 2,  // the four choices; answer 2 (counting from 0) is Bell Labs on a PDP-7
            feedback: ['Berkeley\'s BSD work began only in 1978, building on Version 6, and DEC did not ship the VAX until 1977.', 'IBM mainframes ran IBM\'s own operating systems. UNIX came from Bell Labs and started on a small DEC minicomputer.', null, 'Bell Labs had worked on the large Multics project, but UNIX was a separate, much smaller system written after Bell Labs left it.'],  // feedback for each wrong choice: Berkeley came later, IBM ran its own systems, Multics was a different project
            why: 'Ken Thompson and Dennis Ritchie built UNIX at Bell Labs. It was running on a little-used PDP-7 by 1970 and then moved to the PDP-11.' },  // explanation shown after answering: Thompson and Ritchie at Bell Labs, PDP-7 then PDP-11
          { q: 'Why is the 1973 rewrite of UNIX in C seen as a milestone?',  // question 2 (multiple choice): why the rewrite in C was a milestone
            choices: ['C code runs faster than hand-written assembly, so UNIX became the fastest operating system of its day',  // wrong choice: claims C made UNIX faster than assembly
              'It showed that a high-level language, not assembly, works for most of an OS, making it easier to understand, change and port',  // right choice: a high-level language worked for most of an OS, easing understanding, change and porting
              'Writing it in C removed every piece of machine-dependent code from the kernel',  // wrong choice: claims every machine-dependent line disappeared
              'C let UNIX run programs that had been written for any other operating system'], answer: 1,  // wrong choice: claims C let UNIX run other systems' programs; answer 1 is the right choice
            feedback: ['The C version was in fact somewhat larger and slower than tuned assembly. The gain was readability and portability, not speed.', null, 'A small machine-dependent part (trap and interrupt entry, device registers, drivers) still had to be written for each new machine.', 'Running another system\'s programs is a matter of compatible interfaces, not of the language the kernel is written in.'],  // feedback for each wrong choice: C was slower, a machine-dependent part remained, compatibility is about interfaces
            why: 'Before UNIX, almost every OS was written in the assembly language of one machine. The C rewrite proved a high-level language was good enough for most of an OS, so moving UNIX to a new machine meant recompiling most of it rather than rewriting it.' },  // explanation: the rewrite meant most of UNIX could be recompiled rather than rewritten for a new machine
          { type: 'order', q: 'Put these events in the order they happened.',  // question 3 (put in order): six events in UNIX history
            items: ['UNIX runs on a PDP-7 at Bell Labs', 'UNIX moves to the PDP-11', 'The kernel is rewritten in C', 'Version 6 is licensed widely to universities', 'AT&T releases System V', 'SVR4 merges System V with popular BSD features'],  // the events, listed here in the correct order; the quiz shuffles them for the student
            why: 'PDP-7 (1970), PDP-11 (1971), C rewrite (1973), Version 6 (1975), System V (1983), SVR4 (1989).' },  // explanation: the years of each event
          { type: 'bucket', q: 'Which branch of the UNIX family does each item belong to?', buckets: ['AT&T line (System III / V)', 'Berkeley line (BSD)'],  // question 4 (sort into groups): which branch each item belongs to, AT&T or Berkeley
            items: [['System III, the first commercial release', 0], ['TCP/IP networking built into the kernel', 1], ['Virtual memory with paging on the VAX', 1], ['Licensed to computer makers, leading to AIX and HP-UX', 0], ['Developed at the University of California', 1], ['SVR4, which later absorbed BSD features', 0], ['Lives on in FreeBSD and inside macOS', 1]],  // the items with their correct group (0 = AT&T, 1 = Berkeley)
            why: 'AT&T sold System III, System V and later SVR4 to companies. Berkeley\'s releases added virtual memory (3BSD) and TCP/IP (4.2BSD), and continue today in FreeBSD and macOS.' },  // explanation: what AT&T sold and what Berkeley added
          { type: 'order', q: 'Order the layers of a UNIX system from the hardware up to the user.',  // question 5 (put in order): the layers from the hardware up to the user
            items: ['Hardware', 'Kernel', 'System call interface', 'Commands and libraries', 'User-written applications'],  // the layers, listed here in the correct order
            why: 'The kernel sits directly on the hardware. The system call interface is its boundary with everything above: commands and libraries (shells, compilers, utilities, the C library) and then the applications people write.' },  // explanation: the kernel on the hardware, the system call interface as its boundary, then everything above
          { type: 'tf', q: 'The shell is part of the UNIX kernel, because it runs every command you type.', answer: false,  // question 6 (true or false): the shell is part of the kernel; the answer is false
            why: 'The shell is an ordinary user-mode program in the commands-and-libraries layer. It asks the kernel to start commands through system calls, as any program could.' },  // explanation: the shell is an ordinary user-mode program that uses system calls
          { type: 'tf', q: 'A user program can reach UNIX kernel services only by calling a library routine.', answer: false,  // question 7 (true or false): programs can reach the kernel only through a library; the answer is false
            why: 'A program may make a system call directly, or call a library routine that makes the call for it. Either way the request enters the kernel through the system call interface.' },  // explanation: a program can make a system call directly or through a library routine
          { type: 'bucket', q: 'Which part of the traditional UNIX kernel contains each component?', buckets: ['Process control subsystem', 'File subsystem'],  // question 8 (sort into groups): which half of the kernel contains each component
            items: [['Memory management', 0], ['Scheduling and dispatching', 0], ['Synchronization and interprocess communication', 0], ['Buffer cache', 1], ['Character device drivers', 1], ['Block device drivers', 1]],  // the components with their correct group (0 = process control, 1 = file subsystem)
            why: 'Process control manages processes: their memory, their turns on the processor and their coordination. The file subsystem moves data between memory and devices, in blocks through the buffer cache or as character streams.' },  // explanation: process control manages processes; the file subsystem moves data between memory and devices
          { type: 'match', q: 'Match each part of the traditional kernel with its job.',  // question 9 (match the pairs): each kernel part with its job
            pairs: [['System call interface', 'Receives each trap and passes the call to the right subsystem'], ['Buffer cache', 'Keeps copies of recently used disk blocks in main memory'], ['Scheduler', 'Chooses which ready process runs next'], ['Hardware control', 'Handles interrupts and talks to the machine directly'], ['Block device driver', 'Moves whole blocks between a disk and memory']],  // the five correct pairs; the quiz shuffles the right-hand side
            why: 'The system call interface is the way in; the buffer cache and block drivers serve the file subsystem; the scheduler belongs to process control; hardware control is the machine-dependent bottom layer.' },  // explanation: which part is the way in, which serve files, which belongs to process control
          { q: 'A program reads a disk block that is already in the buffer cache. Which part is <b>not</b> needed for this read?',  // question 10 (multiple choice): which part a cache hit does not need
            choices: ['The system call interface', 'The file subsystem', 'The buffer cache', 'The block device driver'], answer: 3,  // the four choices; answer 3 is the block device driver
            feedback: ['Every system call, hit or miss, enters the kernel through the system call interface.', 'The file subsystem still finds the block number and copies the data into the program\'s buffer.', 'The buffer cache is where the block is found; it is the reason the disk can be skipped.', null],  // feedback for each wrong choice: every call needs the interface, the file subsystem still copies, the cache is where the block is found
            why: 'On a cache hit the data is already in memory, so the kernel never needs the disk driver, the disk or an interrupt, and the process never has to sleep.' },  // explanation: a hit needs no driver, disk or interrupt, and the process never sleeps
          { type: 'multi', q: 'Which statements describe the traditional UNIX kernel?',  // question 11 (select all that apply): statements that describe the traditional kernel
            choices: ['It is monolithic: one large program in one address space', 'It is not very modular', 'Each device driver runs as a separate user-mode server process', 'Adding a new device driver usually meant rebuilding the kernel and rebooting', 'A bug in any part of it can crash the whole system'], answer: [0, 1, 3, 4],  // the five statements; choices 0, 1, 3 and 4 are true, while drivers as separate user-mode servers is false
            why: 'All the parts are compiled into one program that runs in kernel mode. Drivers live inside it, not in separate servers (that is the microkernel idea), so a change means a rebuild and a bug anywhere can bring everything down.' },  // explanation: one program in kernel mode, drivers inside it, so changes mean a rebuild and bugs can crash everything
          { type: 'num', q: 'A kernel has 10,000 lines of code, of which 1,000 are machine-dependent. It is written in C. How many lines must be rewritten by hand to port it to 3 new machines?', answer: 3000, tol: 0, unit: 'lines',  // question 12 (calculate): lines rewritten to port a 10,000-line C kernel with 1,000 dependent lines to 3 machines; answer 3,000
            why: 'Only the machine-dependent part is rewritten for each machine: 3 × 1,000 = 3,000 lines; the other 9,000 lines are simply recompiled. Written in assembly, the port would need 3 × 10,000 = 30,000 lines.' },  // explanation: 3 times 1,000 lines in C, against 30,000 lines if it were written in assembly
        ],  // closes the quiz list
      },  // ends step 9
    ],  // closes the steps list

    notes: `${/* notes: the section summary opened with the Notes button, written as page markup in one backtick string */''}
<h3>What traditional UNIX is</h3>${/* notes heading: what traditional UNIX is */''}
<p><b>UNIX</b> is a multiuser, time-sharing operating system built at <b>Bell Labs</b> by <b>Ken Thompson</b> and <b>Dennis Ritchie</b>. Work began in 1969 on a spare DEC PDP-7 minicomputer; by <b>1970</b> it was running and had its name. It stood out because most of it was written in a high-level language (C), it was small and simple (a compact kernel plus many small programs users combine), and its source code was licensed cheaply to universities. Its descendants (FreeBSD, macOS, Solaris, AIX) and look-alikes (Linux, Android) still run much of today's computing.</p>${/* notes paragraph: who built UNIX, when, what made it different, and where it lives on */''}
<h3>History and the family tree</h3>${/* notes heading: history and the family tree */''}
<table>${/* start of the history table */''}
<tr><th>When</th><th>What happened</th><th>Why it mattered</th></tr>${/* table header row: when, what happened, why it mattered */''}
<tr><td>1970</td><td>Running on a PDP-7 at Bell Labs, in assembly</td><td>A small, practical system built by programmers for themselves</td></tr>${/* table row: 1970, running on the PDP-7 */''}
<tr><td>1971</td><td>Moved to the DEC PDP-11</td><td>Still assembly: the move meant rewriting everything</td></tr>${/* table row: 1971, the move to the PDP-11 */''}
<tr><td>1973</td><td>Kernel rewritten in C</td><td>A milestone: almost every OS had been written in assembly</td></tr>${/* table row: 1973, the rewrite in C */''}
<tr><td>1975</td><td>Version 6</td><td>First widely used outside Bell Labs; licensed to universities with source code</td></tr>${/* table row: 1975, Version 6 licensed to universities */''}
<tr><td>1978 on</td><td>BSD releases, UC Berkeley</td><td>3BSD (1979): virtual memory on the VAX. 4.2BSD (1983): TCP/IP networking and sockets. Then 4.3BSD and 4.4BSD</td></tr>${/* table row: from 1978, the BSD releases and what 3BSD and 4.2BSD added */''}
<tr><td>1979</td><td>Version 7</td><td>Made portable (lessons from the Interdata 8/32 port; UNIX/32V ran it on the VAX); ancestor of nearly every later UNIX</td></tr>${/* table row: 1979, Version 7, the portable ancestor of later UNIX */''}
<tr><td>1982, 1983</td><td>AT&amp;T System III (first commercial release), then System V</td><td>Supported UNIX licensed to computer makers (AIX, HP-UX)</td></tr>${/* table row: 1982 and 1983, System III and System V */''}
<tr><td>1989</td><td>SVR4</td><td>Merged System V with popular BSD features (section 2.9)</td></tr>${/* table row: 1989, SVR4 merges the branches */''}
</table>${/* end of the history table */''}
<p>Two branches grew from the research versions: the <b>AT&amp;T line</b> (System III → System V → SVR4 → Solaris, AIX, HP-UX) and the <b>Berkeley (BSD) line</b> (1BSD → 3BSD → 4.xBSD → FreeBSD, NetBSD, OpenBSD, parts of macOS). The Berkeley line was especially influential because it brought <b>virtual memory</b> (paging, from 3BSD on the VAX) and <b>TCP/IP networking</b>, the Internet's protocols, plus sockets (4.2BSD). Linux (1991) is a look-alike that shares no UNIX code (section 2.10).</p>${/* notes paragraph: the two branches, what Berkeley contributed, and Linux as a look-alike */''}
<h3>Why the rewrite in C mattered</h3>${/* notes heading: why the rewrite in C mattered */''}
<p><b>Assembly language</b> is tied to one processor family, so an OS written in it must be rewritten line by line for a different processor. <b>C</b> is a <b>high-level language</b>: a <b>compiler</b> translates the same source into instructions for any processor it supports. After the rewrite, only the <b>machine-dependent code</b> (trap and interrupt entry, context switching, device drivers) had to be rewritten for a new machine; the rest was recompiled. Each new processor also needed a C compiler, once, after which every C program could move across.</p>${/* notes paragraph: assembly versus a high-level language, and what still had to be rewritten */''}
<p><b>Worked example.</b> An illustrative 10,000-line kernel has 1,000 machine-dependent lines (90% portable). Porting it to four new machines means rewriting 4 × 10,000 = <b>40,000</b> lines in assembly but only 4 × 1,000 = <b>4,000</b> lines in C: a ten-to-one saving on every machine. The price was a kernel somewhat larger and slower than hand-tuned assembly. <b>Common mistake:</b> C did not make UNIX portable for free; each machine still needed a compiler and a rewritten machine-dependent part.</p>${/* notes paragraph: the worked porting example and the common mistake */''}
<h3>The layers of a UNIX system</h3>${/* notes heading: the layers of a UNIX system */''}
<ol>${/* start of the numbered list of layers */''}
<li><b>Hardware</b>: processor, memory, disks, terminals.</li>${/* layer list: the hardware */''}
<li><b>Kernel</b>: runs in kernel mode; the only software that talks to the hardware directly.</li>${/* layer list: the kernel */''}
<li><b>System call interface</b>: the <b>boundary with the user</b>, a fixed set of entry points (open, read, write, fork, exec, wait...) that lets higher-level software reach specific kernel functions. A program enters it with a <b>trap instruction</b>, which switches to kernel mode.</li>${/* layer list: the system call interface and the trap instruction */''}
<li><b>Commands and libraries</b>: shells, compilers, editors, utilities (ls, sort) and libraries such as the C library. All are ordinary user-mode programs; the shell is <b>not</b> part of the kernel.</li>${/* layer list: commands and libraries, all user-mode programs */''}
<li><b>User-written applications</b>.</li>${/* layer list: user-written applications */''}
</ol>${/* end of the layer list */''}
<p>User programs invoke OS services <b>directly</b> (a system call such as write) or <b>through a library routine</b> (such as printf, which makes the system call for them). Either way the request crosses the system call interface.</p>${/* notes paragraph: the two routes into the kernel, directly or through a library routine */''}
<h3>Inside the traditional UNIX kernel</h3>${/* notes heading: inside the traditional UNIX kernel */''}
<p>User programs and libraries <b>trap</b> into the <b>system call interface</b>, which identifies the call, checks its arguments and passes it to one of two main parts. Both sit on <b>hardware control</b>.</p>${/* notes paragraph: calls trap into the system call interface, which passes them to one of two parts */''}
<table>${/* start of the kernel parts table */''}
<tr><th>Part</th><th>Contains</th><th>Job</th></tr>${/* table header row: part, contains, job */''}
<tr><td rowspan="3"><b>Process control subsystem</b></td><td>Memory management</td><td>Gives processes memory, protects them, swaps them out when memory is short</td></tr>${/* table row: process control subsystem, first part: memory management */''}
<tr><td>Scheduler</td><td>Scheduling and dispatching: picks the next ready process and switches to it</td></tr>${/* table row: the scheduler, which does scheduling and dispatching */''}
<tr><td>Synchronization and IPC</td><td>Signals and pipes (System V later added messages, shared memory, semaphores); sleep until an event, then wake up</td></tr>${/* table row: synchronization and IPC, with signals, pipes, sleeping and waking */''}
<tr><td rowspan="3"><b>File subsystem</b></td><td>File management</td><td>Names, directories, permissions, which blocks belong to which file</td></tr>${/* table row: file subsystem, first part: file management */''}
<tr><td>Buffer cache</td><td>Recently used disk blocks kept in main memory; checked first</td></tr>${/* table row: the buffer cache, checked first */''}
<tr><td>Character and block device drivers</td><td>Move data <b>as a stream of characters</b> (terminals; no cache) or <b>in blocks</b> (disks; through the buffer cache)</td></tr>${/* table row: character and block drivers and how each moves data */''}
<tr><td><b>Hardware control</b></td><td>Interrupt handling</td><td>Lowest, machine-dependent layer: fields interrupts, talks to the machine</td></tr>${/* table row: hardware control, the machine-dependent layer that fields interrupts */''}
</table>${/* end of the kernel parts table */''}
<h3>Following one read() call</h3>${/* notes heading: following one read() call */''}
<p><b>Miss (14 stops):</b> the program calls read(fd, buf, 512) in user mode → the library wrapper sets up the call → trap to kernel mode; the system call interface checks it → the file subsystem finds the disk block → the buffer cache misses and picks a free buffer → the block driver starts the disk → the process sleeps (Blocked) → the scheduler runs another process → the disk interrupts when done → hardware control runs the driver's handler, the buffer is valid → the process is woken (Ready) → the file subsystem copies 512 bytes into buf → return from the trap to user mode → read returns 512. It takes milliseconds, nearly all waiting for the disk.</p>${/* notes paragraph: the 14 stops of a cache miss, in order */''}
<p><b>Hit (8 stops):</b> the same first four stops, a cache hit, the copy, the return: microseconds. A hit still needs the system call interface, the file subsystem and the buffer cache, but it <b>skips</b> the block driver, the disk, hardware control, sleeping and waking (IPC) and the scheduler. That is why the kernel keeps a buffer cache.</p>${/* notes paragraph: the 8 stops of a cache hit and which blocks it skips */''}
<h3>A monolithic kernel</h3>${/* notes heading: a monolithic kernel */''}
<p>All the parts are linked into <b>one program</b>, the kernel image, running in kernel mode in <b>one address space</b>, where any part can call any other directly. This <b>monolithic</b> design is fast and simple but <b>not very modular</b>. Adding a driver meant writing it, entering it in the kernel's device switch table, rebuilding the whole kernel and rebooting (logging every user off). A bug in any part, such as a driver writing past its buffer into the scheduler's tables, can crash the whole system with a panic, while a bug in a user program kills only that process. The opposite design, a <b>microkernel</b>, keeps drivers and other services outside the kernel as separate user-mode server processes. Modern UNIX (2.9) and Linux (2.10) keep a monolithic core but add modules that can be loaded while the system runs.</p>${/* notes paragraph: one program in one address space, the cost of adding a driver, bugs, and the microkernel contrast */''}
`,  // end of the notes text
  });  // closes the section object passed to Guide.section
})();  // closes and immediately runs the wrapping function from the top of the file
