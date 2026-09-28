// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 3.5 — Execution of the Operating System
   The OS is software the processor runs like any other program, so
   where does it run? Three answers: a nonprocess kernel outside every
   process, OS routines executed inside each user process, and an OS
   built from system processes. Each is simulated, then weighed on
   switch overhead, modularity and protection.
   Helpers live in the IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ------------------------------------------------------------------
     Shared helpers
     ------------------------------------------------------------------ */
  /* Write a titled message into a feedback box (kinds: ok, bad, info, warn). */
  const say = (box, kind, title, html) => {  // say(): fills one feedback box with a bold title and a message; every step uses it to talk to the student
    box.className = 'msg ' + (kind || '');  // the box's CSS class becomes "msg" plus the kind (ok, bad, info, warn, os), which picks its border and background colour
    box.innerHTML = (title ? `<b>${title}</b>` : '') + (html || '');  // writes the bold title (if there is one) followed by the message HTML into the box
  };  // ends say()

  /* The three designs, used by several steps. */
  const DESIGNS = [  // DESIGNS: the three answers to "where does the OS run?", reused by the calculator, the lab, the sorter and the recap
    { key: 'np', n: 1, name: 'Nonprocess kernel', short: 'Separate kernel' },  // design 1: the kernel runs on its own, outside every process (key "np" = nonprocess)
    { key: 'wp', n: 2, name: 'Execution within user processes', short: 'Inside user processes' },  // design 2: OS routines run inside whichever user process called them (key "wp" = within processes)
    { key: 'pb', n: 3, name: 'Process-based OS', short: 'OS as processes' },  // design 3: the OS is built from system processes (key "pb" = process-based); short is the label used on buttons
  ];  // closes the DESIGNS list

  /* Tiny sketch of each design, used on the Big Picture step (viewBox 180 x 92). */
  const sketch = (ctx, n) => {  // sketch(ctx, n): draws a thumbnail picture of design n for the option buttons on step 1 and the strip on the recap step
    const { s } = ctx;  // pulls out ctx.s, the guide helper that creates one SVG element (SVG is the browser's drawing format) with its attributes
    const svg = s('svg', { viewBox: '0 0 180 92', width: '100%', role: 'img', 'aria-label': 'Sketch of design ' + n });  // the empty drawing: 180 by 92 drawing units, stretched to the full width of its box; the label is read aloud by screen readers
    const box = (x, y, w, hh, cls, label, fs) => [  // box(): a small helper that returns a rounded rectangle plus a centred bold label, ready to add to the drawing
      s('rect', { x, y, width: w, height: hh, rx: 6, class: cls, 'stroke-width': 1.6 }),  // the rectangle itself; cls picks its colour (teal for a user process, violet for OS code)
      s('text', { x: x + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': fs || 15, 'font-weight': 700 }, label),  // the label, centred inside the rectangle; fs lets a caller shrink long labels (default size 15)
    ];  // ends box()
    if (n === 1) {  // design 1 picture: user processes on top, the kernel alone underneath
      [0, 1, 2].forEach((i) => svg.append(...box(6 + i * 59, 4, 50, 36, 's-proc', 'P' + (i + 1))));  // three teal boxes labelled P1, P2, P3 side by side along the top
      svg.append(s('line', { x1: 4, y1: 48, x2: 176, y2: 48, class: 's-muted', 'stroke-dasharray': '5 4' }));  // a dashed line under them: the border between user programs and the kernel
      svg.append(...box(6, 56, 168, 32, 's-os', 'kernel, on its own', 14));  // one wide violet box under the line: the kernel, which belongs to no process
    } else if (n === 2) {  // design 2 picture: the OS sits inside every process
      [0, 1, 2].forEach((i) => {  // repeats the same drawing three times, once per process
        svg.append(s('rect', { x: 6 + i * 59, y: 4, width: 50, height: 84, rx: 6, class: 's-proc', 'stroke-width': 1.6 }));  // a tall teal box for one whole process
        svg.append(s('text', { x: 31 + i * 59, y: 30, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, 'P' + (i + 1)));  // the process name (P1, P2, P3) near the top of that box
        svg.append(...box(10 + i * 59, 56, 42, 28, 's-os', 'OS', 14));  // a small violet "OS" box inside the bottom of each process: the OS lives inside each one
      });  // ends the loop over the three processes
    } else {  // design 3 picture: the OS split into processes of its own
      [['P1', 's-proc'], ['P2', 's-proc'], ['FS', 's-os'], ['MM', 's-os']].forEach(([t, c], i) => svg.append(...box(6 + i * 43.5, 4, 37, 52, c, t)));  // four boxes in a row: two teal user processes and two violet system processes (FS = file system, MM = memory manager)
      svg.append(...box(6, 62, 168, 26, 's-os', 'switching code', 14));  // a wide violet strip underneath: the small switching code, the only part outside all processes
    }  // ends the three-way choice of picture
    return svg;  // hands the finished drawing back to the caller, who places it inside a button or card
  };  // ends sketch()

  /* A small labelled value box for SVG panels: cls picks the colour. */
  const vbox = (ctx, x, y, w, hh, cls, label, fs) => ctx.s('g', {},  // vbox(): draws one labelled value box inside an SVG panel; the CPU panel on step 2 uses it to show mode, program and stack
    ctx.s('rect', { x, y, width: w, height: hh, rx: 6, class: cls, 'stroke-width': 1.6 }),  // the rounded rectangle; cls picks its colour so kernel values look violet and user values look teal
    ctx.s('text', { x: x + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': fs || 13.5, 'font-weight': 700 }, label));  // the value text, centred and bold; fs can shrink long values so they fit
  const MODE_V = { user: ['s-proc', 'user'], kernel: ['s-os', 'kernel'] };  // MODE_V: for each processor mode, the colour class and the word shown in the CPU panel's Mode box
  const RUN_V = { P1: ['s-proc', 'P1'], P2: ['s-proc', 'P2'], K: ['s-os', 'kernel (no process)'] };  // RUN_V: what the CPU panel's Executing box shows; K means the kernel, which is deliberately "no process"
  const STK_V = { P1: ['s-proc', 'P1’s stack'], P2: ['s-proc', 'P2’s stack'], SYS: ['s-os', 'system stack'] };  // STK_V: what the Stack in use box shows: P1's stack, P2's stack or the kernel's own system stack

  /* ------------------------------------------------------------------
     Step 2 scene: three user processes above the mode line, the kernel
     (its own memory region, process table and system stack) below it,
     and a CPU panel. set(st) redraws everything from one state object:
       mode 'user'|'kernel', run 'P1'|'P2'|'K', stack 'P1'|'P2'|'SYS',
       status {P1,P2,P3}, saved {P1: text|null, P2: text|null},
       frames [system stack frames, bottom first], arrow null|'call'|'P1'|'P2',
       ms, ps (mode / process switch counts)
     ------------------------------------------------------------------ */
  function npScene(ctx) {  // npScene(): builds the step 2 picture of design 1 and returns it with a set() function that redraws it from a state object
    const { s } = ctx;  // pulls out ctx.s, the SVG element maker
    const NW = ctx.narrow;  // NW is true on a phone-width screen, where the picture uses a tall layout instead of a wide one
    const G = NW  // G holds every position and size for the chosen layout, so the drawing code below works for both
      ? { W: 330, H: 494, PX: [4, 113, 222], PW: 104, K: [4, 170, 322, 150], tblW: 186, stk: [206, 198, 112, 112], cpu: [4, 332, 322, 158] }  // phone-width layout: 330 wide and 494 tall; PX = left edges of P1-P3, K = kernel box, stk = system stack, cpu = CPU panel
      : { W: 660, H: 300, PX: [16, 176, 336], PW: 148, K: [16, 170, 468, 124], tblW: 240, stk: [300, 198, 170, 88], cpu: [498, 28, 156, 266] };  // wide layout: 660 by 300, with the CPU panel on the right instead of underneath
    const PY = 28, PH = 96;  // PY and PH: the top edge and the height of the three process boxes, the same in both layouts
    const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Three user processes above the mode line, the kernel with its own memory and system stack below it, and the CPU state' });  // the empty SVG sized to the layout; the aria-label describes the whole scene for screen readers
    function set(st) {  // set(st): redraws the whole scene from one state object each time the walkthrough moves to a new frame
      const kids = [s('text', { x: G.PX[0], y: 18, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'User processes (user mode)')];  // kids collects every shape for this frame; it starts with the heading over the process row
      ['P1', 'P2', 'P3'].forEach((p, i) => {  // draws each of the three user processes in turn
        const x = G.PX[i], run = st.run === p, stat = st.status[p];  // x is this process's left edge; run is true if it is the one executing; stat is its state word (Running, Ready, Blocked)
        kids.push(s('rect', { x, y: PY, width: G.PW, height: PH, rx: 10, class: 's-proc', 'stroke-width': run ? 3.2 : 1.6, opacity: stat === 'Blocked' ? 0.6 : 1 }));  // the process box; a thick border marks the running process and a Blocked process is drawn faded
        kids.push(s('text', { x: x + 12, y: PY + 24, 'font-size': 17, 'font-weight': 800 }, p));  // the process name in large bold type at the top left of its box
        kids.push(s('text', { x: x + 12, y: PY + 44, 'font-size': 13.5, 'font-weight': run ? 800 : 600, style: run ? 'fill:var(--proc)' : '', class: run ? '' : 's-sub' }, stat));  // the state word under the name, coloured and bolder when this process is the one running
        const sx = x + G.PW - 58, inUse = st.stack === p;  // sx is where this process's small stack box goes; inUse is true when the processor is using this process's stack right now
        kids.push(s('rect', { x: sx, y: PY + PH - 38, width: 48, height: 30, rx: 5, class: inUse ? 's-accent' : 's-proc', 'stroke-width': inUse ? 3 : 1.2 }));  // the stack box, highlighted in the accent colour while the processor is using it
        kids.push(s('text', { x: sx + 24, y: PY + PH - 18, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'stack'));  // the word "stack" centred inside that box
        kids.push(s('text', { x: x + 12, y: PY + PH - 18, 'font-size': 12.5, class: 's-sub' }, NW ? 'code' : 'code, data'));  // a grey label for the rest of the process image (shortened to "code" on a phone-width screen)
      });  // ends the loop over the three processes
      const ly = 148, right = G.K[0] + G.K[2];  // ly is the height of the mode line; right is the right edge of the kernel box, where the line's labels line up
      kids.push(s('line', { x1: G.K[0], y1: ly, x2: right, y2: ly, class: 's-muted', 'stroke-dasharray': '6 5' }));  // the dashed mode line that separates user mode (above) from kernel mode (below)
      kids.push(s('text', { x: right, y: ly - 6, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, NW ? 'user ↑' : 'user mode ↑'));  // label just above the line, pointing up to user mode
      kids.push(s('text', { x: right, y: ly + 16, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, NW ? 'kernel ↓' : 'kernel mode ↓'));  // label just below the line, pointing down to kernel mode
      const [kx, ky, kw, kh] = G.K;  // unpacks the kernel box's left edge, top edge, width and height
      kids.push(s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 12, class: 's-os', 'stroke-width': st.run === 'K' ? 3.2 : 1.8 }));  // the big violet kernel box; its border thickens while the kernel is the code running
      kids.push(s('text', { x: kx + 12, y: ky + 20, 'font-size': 14.5, 'font-weight': 800, style: 'fill:var(--os)' }, NW ? 'Kernel · own memory' : 'Kernel · its own memory'));  // kernel heading: stresses that the kernel has its own memory, separate from every process
      kids.push(s('text', { x: kx + 12, y: ky + 40, 'font-size': 12.5, class: 's-sub' }, 'Process table (kernel data)'));  // sub-heading for the process table, which is kernel data kept in that memory
      ['P1', 'P2', 'P3'].forEach((p, i) => {  // draws one process-table row for each of P1, P2 and P3
        const y = ky + 48 + i * 24, v = st.saved[p], on = (st.hl || []).includes(p);  // y is this row's height; v is the note saved for this process; on is true if this frame highlights its row
        kids.push(s('rect', { x: kx + 12, y, width: G.tblW - 12, height: 21, rx: 4, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 2.2 : 1 }));  // the row's background, highlighted when the kernel is reading or writing this entry
        kids.push(s('text', { x: kx + 20, y: y + 15, 'font-size': 12.5, 'font-weight': on ? 700 : 400 }, p + (NW ? '' : ' entry') + (v ? ' · ' + v : '')));  // the row text: the process name, the word "entry" on wide screens, and what is saved there (for example "context saved")
      });  // ends the loop that draws the three process-table rows
      const [sx, sy, sw, sh] = G.stk, sysOn = st.stack === 'SYS';  // unpacks the system stack's box (left, top, width, height); sysOn is true while the kernel is working on that stack
      kids.push(s('text', { x: sx, y: sy - 8, 'font-size': 13.5, 'font-weight': 800 }, 'System stack'));  // heading over the system stack, the kernel's own stack that belongs to no process
      kids.push(s('rect', { x: sx, y: sy, width: sw, height: sh, rx: 6, class: sysOn ? 's-accent' : 's-panel', 'stroke-width': sysOn ? 3 : 1.2 }));  // the system stack's outline, highlighted in the accent colour while it is the stack in use
      if (!st.frames.length) kids.push(s('text', { x: sx + sw / 2, y: sy + sh / 2 + 5, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, '(empty)'));  // when the stack holds nothing, the word "(empty)" is written in the middle so the box does not look broken
      st.frames.forEach((f, i) => {  // draws one small box per stack frame (a frame is the record one procedure call leaves on a stack)
        const y = sy + sh - 23 - i * 21;  // frames stack upward: the first call sits at the bottom and each newer call 21 units above the one before
        kids.push(s('rect', { x: sx + 6, y, width: sw - 12, height: 19, rx: 4, class: 's-os', 'stroke-width': 1.2 }));  // the frame's violet box, since everything on this stack is kernel work
        kids.push(s('text', { x: sx + 12, y: y + 14, 'font-size': 12.5, class: 's-monot' }, f));  // the procedure's name, such as entry() or save_ctx(), in the code font
      });  // ends the loop over the stack frames
      /* arrows between a process and the kernel */
      if (st.arrow) {  // draws an arrow only in frames that show control moving between a process and the kernel
        const up = st.arrow !== 'call', i = st.arrow === 'P2' ? 1 : 0, ax = G.PX[i] + 44;  // up is true for arrows that go back up to a process; i picks which process column (P2 or P1); ax is the arrow's x position
        const lbl = st.arrow === 'call' ? 'supervisor call' : st.arrow === 'P1' ? 'resume P1' : 'dispatch P2';  // the label beside the arrow: the call going down, or the kernel resuming P1 or dispatching P2
        kids.push(s('line', { x1: ax, y1: up ? ky - 2 : PY + PH + 2, x2: ax, y2: up ? PY + PH + 4 : ky - 4, class: 's-line', stroke: 'var(--accent)', style: 'stroke:var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#arr-accent)' }));  // the arrow itself, a thick accent-coloured line with an arrowhead, running between the process box and the kernel box
        kids.push(s('text', { x: ax + 8, y: ly + 16, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, lbl));  // the arrow's label, written just under the mode line so it sits between the two boxes
      }  // ends the arrow drawing
      /* CPU panel */
      const [cx, cy, cw, ch] = G.cpu, bw = NW ? 200 : cw - 24;  // unpacks the CPU panel's box; bw is the width of each value box inside it
      kids.push(s('rect', { x: cx, y: cy, width: cw, height: ch, rx: 12, class: 's-cpu', 'stroke-width': 1.8 }));  // the CPU panel's background rectangle
      kids.push(s('text', { x: cx + 12, y: cy + 22, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'CPU'));  // the panel heading "CPU"
      const rows = [['Mode', MODE_V[st.mode]], ['Executing', RUN_V[st.run]], ['Stack in use', STK_V[st.stack]]];  // the three rows of the panel: processor mode, what is executing and which stack is in use, each looked up from the state
      rows.forEach(([lab, [cls, val]], i) => {  // draws each row; the lookup tables give a colour class and the text to show
        const [lx, lyy] = NW ? [cx + 12, cy + 36 + i * 30] : [cx + 12, cy + 48 + i * 54];  // lx, lyy: where this row's label goes (rows sit closer together on a phone-width screen)
        if (NW) {  // phone-width layout: label on the left, value box on the right of the same row
          kids.push(s('text', { x: lx, y: lyy + 16, 'font-size': 13, class: 's-sub' }, lab));  // the row label in grey
          kids.push(vbox(ctx, cx + cw - 12 - bw, lyy, bw, 24, cls, val, 13.5));  // the value box, lined up against the panel's right edge
        } else {  // wide layout: label above its value
          kids.push(s('text', { x: lx, y: lyy, 'font-size': 12.5, class: 's-sub' }, lab));  // the row label in grey
          kids.push(vbox(ctx, lx, lyy + 6, bw, 26, cls, val, val.length > 14 ? 12.5 : 13.5));  // the value box under the label; long values such as "kernel (no process)" get a slightly smaller font
        }  // ends the choice of layout for this row
      });  // ends the loop over the three CPU rows
      /* [label x, y, value x (right edge)] for the two counters */
      const cnt = NW ? [[cx + 12, cy + 144, cx + 130], [cx + 150, cy + 144, cx + cw - 12]] : [[cx + 12, cy + 222, cx + cw - 12], [cx + 12, cy + 248, cx + cw - 12]];  // cnt: where to draw the two counters in each layout (side by side on a phone, stacked on a wide screen)
      [['Mode switches', st.ms], ['Process switches', st.ps]].forEach(([lab, v], i) => {  // draws the two running totals: how many mode switches and how many process switches so far
        const [x, y, vx] = cnt[i];  // picks this counter's label position and the right edge where its number ends
        kids.push(s('text', { x, y, 'font-size': 13, 'font-weight': 600 }, lab));  // the counter's label
        kids.push(s('text', { x: vx, y, 'font-size': 16, 'font-weight': 800, 'text-anchor': 'end', style: 'fill:var(--chc)' }, String(v)));  // the count itself, large and coloured, right-aligned so the digits line up
      });  // ends the loop over the two counters
      svg.replaceChildren(...kids);  // swaps the old drawing for the new one in a single step, so the picture never flickers half-drawn
    }  // ends set()
    return { svg, set };  // hands back the drawing and its set() function to the step that uses them
  }  // ends npScene()

  /* ------------------------------------------------------------------
     Step 3 scene: the process images of P1 (running) and P2 (ready) when
     the OS executes within user processes, plus physical memory holding
     one shared copy of the OS. set(mode, pick) redraws; onPick(key) is
     called when a hot region is clicked.
     ------------------------------------------------------------------ */
  const REGIONS = [  // REGIONS: the five parts of a process image in design 2, from top to bottom; k is each part's key
    { k: 'pcb', y: 40, hh: 84, cls: 's-os', lines: ['Process control block'], sub: ['identification', 'processor state', 'control information'], locked: true },  // the process control block (PCB), the OS's record of the process; locked means user mode cannot touch it
    { k: 'ustack', y: 130, hh: 40, cls: 's-proc', lines: ['User stack'] },  // the user stack, used while the process runs its own program
    { k: 'priv', y: 176, hh: 70, cls: 's-proc', lines: ['Private user', 'address space'], sub: ['program, data'] },  // the private user address space: the process's own program and data
    { k: 'kstack', y: 252, hh: 40, cls: 's-os', lines: ['Kernel stack'], locked: true },  // the kernel stack, used while this process runs OS code; locked outside kernel mode
    { k: 'shared', y: 298, hh: 60, cls: 's-os', lines: ['Shared address', 'space'], sub: ['OS code, data'], locked: true },  // the shared address space holding the OS code and data; also locked outside kernel mode
  ];  // closes the REGIONS list
  function wpScene(ctx, onPick) {  // wpScene(): builds the step 3 picture of design 2; onPick is called with a region's key when the student clicks it
    const { s } = ctx;  // pulls out ctx.s, the SVG element maker
    const NW = ctx.narrow;  // NW is true on a phone-width screen, where the picture is taller and the memory box moves underneath
    const G = NW ? { W: 330, H: 456, P1: 30, P2: 182, PW: 144, os: [30, 396, 296, 50] } : { W: 640, H: 392, P1: 44, P2: 250, PW: 180, os: [468, 250, 164, 90] };  // G holds the layout: drawing size, the left edges of P1's and P2's images, their width, and the physical-memory box
    const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Process images of P1 and P2 when the OS runs inside user processes' });  // the empty SVG sized to the layout, with a spoken description for screen readers
    const byY = Object.fromEntries(REGIONS.map((r) => [r.k, r.y + r.hh / 2]));  // byY: the vertical middle of each region, so the PC and SP arrows can point straight at it
    function image(x, who, mode, pick, live) {  // image(): draws one process image; live is true for P1 (the running process) and false for the idle P2
      const kids = [s('text', { x, y: 28, 'font-size': 15, 'font-weight': 800 }, who === 'P1' ? 'P1 · Running' : 'P2 · Ready (idle)')];  // the heading over the image: P1 is running, P2 is ready but idle
      REGIONS.forEach((r) => {  // draws each of the five regions of this image
        const locked = live && r.locked && mode === 'user';  // locked is true for kernel-only regions while P1 runs in user mode; they are drawn dashed and faded
        const inUse = live && ((mode === 'user' && r.k === 'ustack') || (mode === 'kernel' && r.k === 'kstack'));  // inUse is true for the stack the processor is using now: the user stack in user mode, the kernel stack in kernel mode
        const running = live && ((mode === 'user' && r.k === 'priv') || (mode === 'kernel' && r.k === 'shared'));  // running is true for the region holding the code running now: P1's program in user mode, the OS code in kernel mode
        const g = s('g', { class: live ? 'hot' + (pick === r.k ? ' on' : '') : '', tabindex: live ? 0 : null, role: live ? 'button' : null, 'aria-label': live ? r.lines.join(' ') : null });  // a group for the region; in P1 it is clickable and reachable with the Tab key, and "on" marks the one picked
        g.append(s('rect', { class: (inUse ? 's-accent' : r.cls) + ' fr', x, y: r.y, width: G.PW, height: r.hh, rx: 7, 'stroke-width': inUse || running ? 3 : 1.6,  // the region's rectangle ("fr" lets the CSS thicken it on hover); thick border for the stack and code in use right now
          'stroke-dasharray': locked ? '5 4' : null, opacity: locked ? (pick === r.k ? 0.9 : 0.45) : live ? 1 : 0.5 }));  // locked regions get a dashed faded border (less faded when picked); P2's whole image is faded because it is idle
        const lines = NW && r.k === 'pcb' ? ['PCB'] : r.lines;   /* the full name does not fit a phone-width column */
        lines.forEach((ln, i) => g.append(s('text', { x: x + 10, y: r.y + 18 + i * 16, 'font-size': 13, 'font-weight': 750, opacity: locked ? 0.6 : live ? 1 : 0.7 }, ln)));  // writes the region's name inside its rectangle, one line of text per piece
        (r.sub || []).forEach((ln, i) => g.append(s('text', { x: x + 10, y: r.y + 18 + (lines.length + i) * 16 + 1, 'font-size': 12.5, class: 's-sub', opacity: locked ? 0.7 : 1 }, ln)));  // writes the smaller grey detail lines, if any, under the name
        if (live) {  // only P1's regions respond to clicks
          g.addEventListener('click', () => onPick(r.k));  // a mouse click on the region reports its key to the step
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r.k); } });  // pressing Enter or Space on a focused region does the same, so the picture works from the keyboard
        }  // ends the click handling
        kids.push(g);  // adds this region to the drawing
      });  // ends the loop over the regions
      return kids;  // hands back this image's shapes
    }  // ends image()
    function set(mode, pick) {  // set(mode, pick): redraws the scene whenever the student flips the mode or clicks a region
      const kids = [...image(G.P1, 'P1', mode, pick, true), ...image(G.P2, 'P2', mode, pick, false)];  // draws both images: P1 live and clickable, P2 faded
      /* PC and SP pointers beside P1 */
      [['PC', mode === 'user' ? 'priv' : 'shared', 'var(--cpu)'], ['SP', mode === 'user' ? 'ustack' : 'kstack', 'var(--accent)']].forEach(([lab, k, col]) => {  // two pointers: PC (program counter) points at the code running, SP (stack pointer) at the stack in use; both move with the mode
        const y = byY[k];  // y is the middle of the region this pointer aims at
        kids.push(s('line', { x1: 4, y1: y, x2: G.P1 - 3, y2: y, 'stroke-width': 2.5, style: `stroke:${col}`, 'marker-end': lab === 'PC' ? 'url(#arr-cpu)' : 'url(#arr-accent)' }));  // the pointer's arrow, from the left margin to the edge of P1's image
        kids.push(s('text', { x: 6, y: y - 6, 'font-size': 12.5, 'font-weight': 800, style: `fill:${col}` }, lab));  // the pointer's name written just above its arrow
      });  // ends the loop over the two pointers
      /* physical memory: one copy of the OS */
      const [ox, oy, ow, oh] = G.os, osOn = pick === 'phys';  // unpacks the physical-memory box; osOn is true when the student has clicked it
      const og = s('g', { class: 'hot' + (osOn ? ' on' : ''), tabindex: 0, role: 'button', 'aria-label': 'Physical memory copy of the OS' });  // a clickable group for the single physical copy of the OS
      og.append(s('rect', { class: 's-os fr', x: ox, y: oy, width: ow, height: oh, rx: 8, 'stroke-width': 2 }));  // its violet rectangle
      og.append(s('text', { x: ox + 10, y: oy + 20, 'font-size': 13, 'font-weight': 800 }, NW ? 'Physical memory: OS code and data' : 'OS code and data'));  // first line: on a phone the full name, on a wide screen just "OS code and data" (the heading sits above)
      og.append(s('text', { x: ox + 10, y: oy + 38, 'font-size': 12.5, class: 's-sub' }, NW ? 'one copy, shared by every process' : 'one copy, shared'));  // second line: there is only one copy, shared by every process
      if (!NW) og.append(s('text', { x: ox + 10, y: oy + 55, 'font-size': 12.5, class: 's-sub' }, 'by every process'));  // on a wide screen the sentence continues on a third line
      og.addEventListener('click', () => onPick('phys'));  // clicking the memory box shows its explanation
      og.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick('phys'); } });  // Enter or Space does the same from the keyboard
      const sh = REGIONS[4], sb = sh.y + sh.hh;  // sh is the shared-address-space region; sb is its bottom edge, where the dashed links to physical memory start
      const link = (d) => s('path', { d, fill: 'none', 'stroke-width': 2, 'stroke-dasharray': '4 3', style: 'stroke:var(--os)' });  // link(): draws one dashed violet line from a shared region to the single physical copy of the OS
      if (NW) {  // phone-width layout: the memory box sits under both images
        kids.push(link(`M${G.P1 + G.PW / 2},${sb} V${oy}`), link(`M${G.P2 + G.PW / 2},${sb} V${oy}`));  // two straight dashed lines drop from the bottom of P1's and P2's shared regions down to the one OS copy
      } else {  // wide layout: a full physical-memory column on the right
        kids.push(s('text', { x: ox, y: 28, 'font-size': 15, 'font-weight': 800 }, 'Physical memory'));  // heading over the physical-memory column
        [['P1’s program, data', 40], ['P2’s program, data', 100]].forEach(([t, y]) => {  // two teal boxes, one for each process's own program and data
          kids.push(s('rect', { x: ox, y, width: ow, height: 50, rx: 8, class: 's-proc', 'stroke-width': 1.4, opacity: 0.85 }));  // the box for one process's private pages, slightly faded
          kids.push(s('text', { x: ox + 10, y: y + 20, 'font-size': 13, 'font-weight': 700 }, t));  // its label: whose program and data these are
          kids.push(s('text', { x: ox + 10, y: y + 38, 'font-size': 12.5, class: 's-sub' }, 'private copy'));  // the note "private copy": unlike the OS, these pages exist once per process
        });  // ends the loop over the two private boxes
        kids.push(s('text', { x: ox, y: 180, 'font-size': 12.5, class: 's-sub' }, '⋮  other processes'));  // a vertical ellipsis: more processes would add more private boxes here
        kids.push(link(`M${G.P2 + G.PW},${sh.y + 30} H${ox}`), link(`M${G.P1 + G.PW / 2},${sb} V${G.H - 10} H${ox + ow / 2} V${oy + oh}`));  // dashed links from P2's shared region and from P1's shared region, both ending at the same OS box
      }  // ends the choice of layout
      kids.push(og);  // adds the clickable OS box last so it is drawn on top of the links
      svg.replaceChildren(...kids);  // swaps the new drawing into the SVG in one step
    }  // ends set()
    return { svg, set };  // hands back the drawing and its set() function
  }  // ends wpScene()

  /* ------------------------------------------------------------------
     Step 5 scene: user processes and system processes side by side above
     the process-switching code, then one or four processors with a
     12-slot timeline of who used each one. set(cpus, pick) redraws.
     ------------------------------------------------------------------ */
  const PB_TILES = [  // PB_TILES: the boxes along the top of the step 5 picture; k is the key used by clicks and the timeline
    { k: 'P1', l: ['P1'], user: true }, { k: 'P2', l: ['P2'], user: true }, { k: 'P3', l: ['P3'], user: true },  // the three user processes; user: true colours them teal
    { k: 'FS', l: ['File', 'system'] }, { k: 'MM', l: ['Memory', 'manager'] }, { k: 'IO', l: ['I/O', 'manager'] }, { k: 'Mon', l: ['Usage', 'monitor'] },  // the four system processes (file system, memory manager, I/O manager, usage monitor), coloured violet
  ];  // closes the PB_TILES list
  /* '.' = idle slot */
  const PB_TIME = {  // PB_TIME: who owns the processor in each of 12 time slots, for one processor or for four
    1: [['CPU 0', 'P1 P1 FS FS P2 P2 MM P1 Mon P3 FS P1']],  // one processor: user programs and OS services take turns on the same processor
    4: [['CPU 0', 'P1 P1 P1 P1 P3 P3 P1 P1 P1 P1 P3 P3'], ['CPU 1', 'P2 P2 P2 P2 P2 P2 P3 P3 P2 P2 P2 P2'],  // four processors: CPU 0 and CPU 1 run only user programs
      ['CPU 2', 'FS FS . IO FS . . FS IO . FS .'], ['CPU 3', 'MM . Mon . MM . . Mon . MM . .']],  // CPU 2 and CPU 3 are given to OS services, idle (".") when no service is needed
  };  // closes PB_TIME
  function pbScene(ctx, onPick) {  // pbScene(): builds the step 5 picture of design 3; onPick is called with a key when the student clicks a box
    const { s } = ctx;  // pulls out ctx.s, the SVG element maker
    const NW = ctx.narrow;  // NW is true on a phone-width screen, which gets a tall layout
    /* Wide: one row per processor, time runs left to right. Narrow: one column per processor, time runs downward. */
    const G = NW  // G holds the layout for the chosen screen size
      ? { W: 330, H: 490, tile: (i) => (i < 3 ? [4 + i * 82, 24] : [4 + (i - 3) * 82, 102]), tw: 76, th: 50, band: 164, x0: 40, top: 234, rp: 21, rh: 18, fs: 13 }  // phone-width layout: tile(i) gives each box's corner (user processes on one row, system processes on the next); time runs down
      : { W: 620, H: 332, tile: (i) => [6 + i * 87, 26], tw: 80, th: 64, band: 146, cx0: 62, pitch: 45, cw: 42, ry: 204, rh: 28, rp: 32, fs: 13 };  // wide layout: all seven boxes in one row; the timeline has one row per processor with 12 cells across
    const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'User and system processes above the process-switching code, and a timeline of processor use' });  // the empty SVG sized to the layout, with a spoken description
    const hot = (k, label, kids) => {  // hot(): wraps shapes in a group that can be clicked or chosen with the keyboard
      const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // the group: class "hot" gives the pointer cursor and hover effect; tabindex 0 lets Tab reach it
      g.addEventListener('click', () => onPick(k));  // a click reports this box's key to the step
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(k); } });  // Enter or Space does the same from the keyboard
      return g;  // hands back the clickable group
    };  // ends hot()
    /* true at slot c when the owner differs from slot c-1: a process switch */
    const switchesIn = (seq) => seq.map((w, c) => c > 0 && w !== '.' && seq[c - 1] !== '.' && w !== seq[c - 1]);  // switchesIn(): for a row of owners, marks each slot where a different owner takes over from the one before (idle slots never count)
    function set(cpus, pick) {  // set(cpus, pick): redraws the picture for one or four processors, highlighting the box the student picked
      const kids = [];  // kids collects every shape for this redraw
      const [ux] = G.tile(0), [sx, sy] = G.tile(3);  // the corner of the first user box and of the first system box, so the headings line up with them
      kids.push(s('text', { x: ux, y: NW ? 16 : 17, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--proc)' }, 'User processes (user mode)'));  // heading over the user processes, in teal
      kids.push(s('text', { x: sx, y: NW ? sy - 8 : 17, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'System processes (kernel mode)'));  // heading over the system processes, in violet
      PB_TILES.forEach((tl, i) => {  // draws the seven process boxes
        const [x, y] = G.tile(i);  // this box's corner from the layout
        const g = hot(tl.k, tl.l.join(' '), [  // a clickable group for this process
          s('rect', { class: (tl.user ? 's-proc' : 's-os') + ' fr', x, y, width: G.tw, height: G.th, rx: 9, 'stroke-width': 1.8 }),  // the box, teal for a user process and violet for a system process
          ...tl.l.map((ln, j) => s('text', { x: x + G.tw / 2, y: y + G.th / 2 + (tl.l.length === 1 ? 6 : j * 17 - 3), 'text-anchor': 'middle', 'font-size': tl.l.length === 1 ? 17 : 13.5, 'font-weight': 750 }, ln))]);  // its name, centred; one-word names are bigger, two-line names are stacked
        if (pick === tl.k) g.classList.add('on');  // marks the box as picked if the student clicked it
        kids.push(g);  // adds the box to the drawing
      });  // ends the loop over the process boxes
      /* a request from P1 to the file-system process, and back */
      const [p1x, p1y] = G.tile(0), [fx] = G.tile(3);  // positions of P1's box and the file-system box, for the request arrow
      if (!NW) {  // the curved arrow is drawn only on wide screens, where there is room under the boxes
        const y0 = p1y + G.th + 3, a = p1x + G.tw / 2, b = fx + G.tw / 2;  // y0 is just below the boxes; a and b are the middles of P1 and the file-system box
        kids.push(s('path', { d: `M${a},${y0} C${a},${y0 + 40} ${b},${y0 + 40} ${b},${y0 + 3}`, fill: 'none', class: 's-line', 'stroke-dasharray': '5 4', 'marker-end': 'url(#arr)' }));  // a dashed curve from P1 down and across to the file-system process, with an arrowhead: a request
        kids.push(s('text', { x: (a + b) / 2, y: y0 + 43, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'P1 sends a request; the reply comes back the same way'));  // its caption: the reply comes back along the same path
      }  // ends the request arrow
      /* the process-switching code: the only part outside all processes */
      const bh = 28, bandOn = pick === 'SW';  // bh is the height of the switching-code band; bandOn is true when the student has clicked it
      const bandG = hot('SW', 'Process-switching code', [  // a clickable group for the process-switching code
        s('rect', { class: 's-os fr', x: 4, y: G.band, width: G.W - 8, height: bh, rx: 8, 'stroke-width': 1.8, 'stroke-dasharray': '6 3' }),  // a long dashed violet band across the whole picture
        s('text', { x: G.W / 2, y: G.band + bh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 750 }, NW ? 'Switching code · outside all processes' : 'Process-switching code · the only part outside all processes')]);  // its label: the only code that runs outside all processes (a shorter wording on a phone)
      if (bandOn) bandG.classList.add('on');  // marks the band as picked when clicked
      kids.push(bandG);  // adds the band to the drawing
      /* one time slot, and one process-switch badge */
      const cell = (x, y, w, hh, who) => {  // cell(): draws one time slot of the timeline, filled in the colour of whoever used it
        const idle = who === '.', on = pick && who === pick;  // idle is true for an empty slot; on is true when this slot belongs to the process the student picked
        kids.push(s('rect', { x, y, width: w, height: hh, rx: 4, class: on ? 's-accent' : idle ? 's-panel' : /^P/.test(who) ? 's-proc' : 's-os', 'stroke-width': on ? 2.6 : 1.1, opacity: idle ? 0.6 : 1 }));  // the slot's box: accent if picked, grey if idle, teal for user processes (names start with P), violet for OS services
        kids.push(s('text', { x: x + w / 2, y: y + hh / 2 + 4.5, 'text-anchor': 'middle', 'font-size': G.fs, 'font-weight': 700, class: idle ? 's-sub' : '' }, idle ? '·' : who));  // the owner's name in the slot, or a small dot for an idle slot
      };  // ends cell()
      const badge = (x, y) => {  // badge(): draws a small "P" tag that marks a process switch between two slots
        const col = bandOn ? 'var(--accent)' : 'var(--intr)';  // the badge is red normally and turns to the accent colour when the switching code is picked, to show where it runs
        kids.push(s('rect', { x: x - 9, y: y - 8, width: 18, height: 16, rx: 4, 'stroke-width': bandOn ? 2.4 : 1.4, style: `fill:var(--panel);stroke:${col}` }));  // the badge's small box
        kids.push(s('text', { x, y: y + 4.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:${col}` }, 'P'));  // the letter P inside it
      };  // ends badge()
      const rows = PB_TIME[cpus].map(([name, seq]) => [name, seq.split(' ')]);  // rows: the timeline for the chosen processor count, each owner string split into a list of 12 names
      const nSw = switchesIn(rows[0][1]).filter(Boolean).length;  // nSw counts the process switches on the first processor, for the sentence under the timeline
      if (!NW) {  // wide layout: one row per processor, time running left to right
        rows.forEach(([name, seq], r) => {  // draws each processor's row
          const y = G.ry + r * G.rp;  // y is the top of this row
          kids.push(s('text', { x: 6, y: y + G.rh / 2 + 5, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }, name));  // the processor's name at the start of the row, in blue
          seq.forEach((who, c) => cell(G.cx0 + c * G.pitch, y, G.cw, G.rh, who));  // the 12 slots of this row
          if (cpus === 1) switchesIn(seq).forEach((sw, c) => sw && badge(G.cx0 + c * G.pitch - (G.pitch - G.cw) / 2, y + G.rh + 14));  // with one processor, a P badge goes between every pair of slots where the owner changes
        });  // ends the loop over the rows
        kids.push(s('text', { x: G.cx0, y: G.ry - 7, 'font-size': 12.5, class: 's-sub' }, cpus === 1 ? 'One processor: time slots, left to right' : 'Four processors: CPU 2 and CPU 3 are dedicated to OS services'));  // caption over the timeline: one processor taking turns, or four with CPU 2 and 3 given to OS services
        if (cpus === 1) {  // extra explanation appears only with one processor
          kids.push(s('text', { x: G.cx0, y: G.ry + G.rh + 46, 'font-size': 13 }, `Each P marks a process switch: the owner changes ${nSw} times in 12 slots.`));  // sentence under the timeline, with the live count of process switches filled in
          kids.push(s('text', { x: G.cx0, y: G.ry + G.rh + 68, 'font-size': 12.5, class: 's-sub' }, 'Teal: user process · violet: system process. Click the switching code to see where it runs.'));  // colour key and a hint that clicking the switching-code band highlights the P badges
        }  // ends the one-processor extras
      } else {  // phone-width layout: one column per processor, time running downward
        const one = cpus === 1, cw = one ? 76 : 64, pitch = 71.5;  // one is true for a single processor; cw is the slot width (wider when there is only one column); pitch is the column spacing
        kids.push(s('text', { x: 4, y: G.top - 24, 'font-size': 12.5, class: 's-sub' }, one ? 'One processor · time runs downward' : 'Four processors · CPU 2, 3 run OS services'));  // caption over the columns
        for (let r = 0; r < 12; r++) kids.push(s('text', { x: G.x0 - 8, y: G.top + r * G.rp + G.rh / 2 + 4.5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, String(r + 1)));  // numbers 1 to 12 down the left side, one per time slot
        rows.forEach(([name, seq], col) => {  // draws each processor's column
          const x = G.x0 + col * pitch;  // x is the left edge of this column
          kids.push(s('text', { x: x + cw / 2, y: G.top - 6, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }, name));  // the processor's name over its column, in blue
          seq.forEach((who, r) => cell(x, G.top + r * G.rp, cw, G.rh, who));  // the 12 slots of this column, top to bottom
          if (one) switchesIn(seq).forEach((sw, r) => sw && badge(x + cw + 16, G.top + r * G.rp - (G.rp - G.rh) / 2));  // with one processor, a P badge sits to the right of the column wherever the owner changes
        });  // ends the loop over the columns
        if (one) ['Each P marks a', 'process switch:', 'the owner changes', `${nSw} times in 12 slots.`, '', 'Teal: user process', 'Violet: system process']  // with one processor there is room beside the column for the explanation, one short line at a time
          .forEach((t, i) => kids.push(s('text', { x: 152, y: G.top + 14 + i * 20, 'font-size': 13, class: i > 4 ? 's-sub' : '' }, t)));  // writes those lines under each other; the last two (the colour key) are grey
      }  // ends the choice of layout
      svg.replaceChildren(...kids);  // swaps the new drawing into the SVG in one step
    }  // ends set()
    return { svg, set };  // hands back the drawing and its set() function
  }  // ends pbScene()

  /* ------------------------------------------------------------------
     Step 6 data: the same request under each design. Every frame adds one
     timeline segment [lane, mode, label lines, switches at its start].
     Lanes: P1, P2, SP (a system process, design 3 only), OUT (code that
     runs outside every process). A final frame with seg null is the tally.
     ------------------------------------------------------------------ */
  const RUN1 = ['P1', 'user', ['P1 runs', 'its program'], []];  // RUN1: the opening segment shared by every run: P1 running its own program in user mode, with no switch before it
  const LAB = {  // LAB: the step 6 walkthroughs, one list of frames per design and request; each frame is [segment, caption]
    np: {  // design 1 (nonprocess kernel)
      quick: [  // design 1, quick request: asking for the time of day
        [RUN1, '<b>Design 1, quick answer.</b> P1 runs its program in user mode. It is about to ask the OS for the time of day.'],  // frame 1: P1 is running and about to make the request
        [['OUT', 'kernel', ['save P1’s', 'context'], ['M']], '<b>Supervisor call: a mode switch.</b> The processor enters kernel mode, P1’s context is saved, and control passes to the kernel, which runs <b>outside every process</b> on its own system stack.'],  // frame 2: the call enters the kernel lane outside every process; the M mark counts one mode switch
        [['OUT', 'kernel', ['kernel:', 'get time'], []], 'The kernel reads the clock and leaves the answer where P1 will find it. At this moment no process is running at all: only the kernel.'],  // frame 3: the kernel does the work while no process at all is running
        [['P1', 'user', ['P1', 'continues'], ['M']], '<b>Mode switch back.</b> The kernel restores P1’s context and returns to user mode. P1 carries on right after its call.'],  // frame 4: back in P1's lane in user mode, with a second mode switch
        [null, '<b>Tally: 2 mode switches, 0 process switches.</b> The OS ran as a separate entity outside every process, yet P1 never lost its turn.'],  // final frame: no new segment, just the tally of 2 mode switches and 0 process switches
      ],  // ends design 1's quick run
      wait: [  // design 1, request that must wait: reading data from disk
        [RUN1, '<b>Design 1, disk read.</b> P1 runs in user mode and P2 is Ready. P1 is about to read data that is still on the disk.'],  // frame 1: P1 runs while P2 waits in the Ready state
        [['OUT', 'kernel', ['save P1’s', 'context'], ['M']], '<b>Supervisor call: a mode switch.</b> The processor enters kernel mode, P1’s context is saved, and the kernel takes over on its own system stack.'],  // frame 2: supervisor call, one mode switch into the kernel
        [['OUT', 'kernel', ['start disk,', 'P1 Blocked'], []], 'The kernel starts the disk and marks P1 Blocked. P1 cannot continue until the data arrives.'],  // frame 3: the kernel starts the disk and marks P1 Blocked
        [['OUT', 'kernel', ['dispatcher', 'picks P2'], []], 'The kernel’s dispatcher picks P2 from the Ready queue and loads P2’s saved context.'],  // frame 4: the dispatcher chooses P2
        [['P2', 'user', ['P2 runs', 'its program'], ['P', 'M']], '<b>A process switch and a mode switch.</b> The processor returns to user mode, now running P2 instead of P1.'],  // frame 5: P2 runs; the P and M marks count a process switch and a mode switch at the same moment
        [null, '<b>Tally: 2 mode switches, 1 process switch.</b> The process switch was unavoidable: P1 must wait, and the processor should not sit idle.'],  // final frame: tally of 2 mode switches and 1 process switch, caused by the waiting
      ],  // ends design 1's disk run
    },  // ends design 1
    wp: {  // design 2 (execution within user processes)
      quick: [  // design 2, quick request
        [RUN1, '<b>Design 2, quick answer.</b> P1 runs its program in user mode, on its user stack.'],  // frame 1: P1 running on its user stack
        [['P1', 'kernel', ['OS routine:', 'get time'], ['M']], '<b>System call: a mode switch.</b> The processor enters kernel mode and runs the OS routine <b>inside P1</b>, on P1’s kernel stack. P1 is still the running process.'],  // frame 2: the OS routine runs in P1's own lane, in kernel mode: a mode switch but still P1
        [['P1', 'user', ['P1', 'continues'], ['M']], '<b>Mode switch back.</b> The routine returns, the processor drops back to user mode, and P1 carries on.'],  // frame 3: back to P1's program with a second mode switch
        [null, '<b>Tally: 2 mode switches, 0 process switches.</b> P1 borrowed the OS for a moment, much like calling a library routine that happens to have extra privileges.'],  // final frame: tally of 2 mode switches and 0 process switches
      ],  // ends design 2's quick run
      wait: [  // design 2, request that must wait
        [RUN1, '<b>Design 2, disk read.</b> P1 runs in user mode and P2 is Ready.'],  // frame 1: P1 runs while P2 is Ready
        [['P1', 'kernel', ['OS routine:', 'start disk'], ['M']], '<b>System call: a mode switch.</b> Inside P1, in kernel mode, the OS routine starts the disk read on P1’s kernel stack.'],  // frame 2: the OS routine starts the disk read inside P1, on P1's kernel stack
        [['P1', 'kernel', ['P1 waits:', 'Blocked'], []], 'The data is not there yet, so the routine marks P1 Blocked. P1’s unfinished kernel work simply stays on P1’s kernel stack.'],  // frame 3: P1 is marked Blocked and its unfinished kernel work stays on its kernel stack
        [['OUT', 'kernel', ['switch', 'P1 → P2'], []], 'A process switch is needed, so control passes to the small process-switching routine. It may begin inside P1, but while it hands the processor over it belongs to neither process, so it is drawn <b>outside all processes</b>. It saves P1’s context and picks P2.'],  // frame 4: the switching routine runs outside both processes while it hands the processor over
        [['P2', 'user', ['P2 runs', 'its program'], ['P', 'M']], '<b>A process switch and a mode switch.</b> P2’s context is loaded and P2 runs in user mode.'],  // frame 5: P2 runs, with a process switch and a mode switch
        [null, '<b>Tally: 2 mode switches, 1 process switch.</b> The same count as design 1: this process switch is caused by the waiting, not by the design.'],  // final frame: the same tally as design 1, because the switch comes from the waiting
      ],  // ends design 2's disk run
    },  // ends design 2
    pb: {  // design 3 (process-based OS)
      quick: [  // design 3, quick request: the time comes from a clock-service process
        [RUN1, '<b>Design 3, quick answer.</b> P1 runs in user mode. The time of day is provided by a clock-service system process.'],  // frame 1: P1 runs and is about to ask
        [['OUT', 'kernel', ['switch to', 'service'], ['M']], '<b>System call: a mode switch.</b> P1’s request enters the kernel. The switching code, outside all processes, saves P1’s context; P1 now waits for the reply.'],  // frame 2: the request enters the kernel and the switching code saves P1's context (one mode switch)
        [['SP', 'kernel', ['read clock,', 'reply'], ['P']], '<b>A process switch.</b> The clock-service process runs, in kernel mode on its own stack. It reads the clock and sends the reply.'],  // frame 3: a process switch to the clock-service process, which answers
        [['OUT', 'kernel', ['switch', 'back to P1'], []], 'The service is finished, so the switching code runs again to hand the processor back to P1.'],  // frame 4: the switching code runs again to go back to P1
        [['P1', 'user', ['P1', 'continues'], ['P', 'M']], '<b>A process switch and a mode switch.</b> P1’s context is restored and P1 carries on in user mode.'],  // frame 5: P1 continues, with a second process switch and a mode switch
        [null, '<b>Tally: 2 mode switches, 2 process switches.</b> Even a quick answer cost two process switches: the price of building the OS out of processes.'],  // final frame: tally of 2 mode switches and 2 process switches even for a quick answer
      ],  // ends design 3's quick run
      wait: [  // design 3, request that must wait: files belong to a file-system process
        [RUN1, '<b>Design 3, disk read.</b> P1 runs in user mode and P2 is Ready. File handling belongs to a file-system process.'],  // frame 1: P1 runs while P2 is Ready
        [['OUT', 'kernel', ['switch to', 'service'], ['M']], '<b>System call: a mode switch.</b> P1’s request enters the kernel. The switching code saves P1’s context, and P1 waits for the reply.'],  // frame 2: the request enters the kernel with a mode switch
        [['SP', 'kernel', ['start', 'disk read'], ['P']], '<b>A process switch.</b> The file-system process runs and starts the disk read.'],  // frame 3: a process switch to the file-system process, which starts the disk
        [['OUT', 'kernel', ['FS waits,', 'pick P2'], []], 'The file-system process must now wait for the disk as well, so the switching code picks P2.'],  // frame 4: the file system must wait too, so the switching code picks P2
        [['P2', 'user', ['P2 runs', 'its program'], ['P', 'M']], '<b>A process switch and a mode switch.</b> P2 runs in user mode.'],  // frame 5: P2 runs, with a process switch and a mode switch
        [null, '<b>Tally: 2 mode switches, 2 process switches.</b> One more than designs 1 and 2, and when the disk finishes, more switches follow: first to the file system, then back to P1.'],  // final frame: tally of 2 and 2, with more switches still to come when the disk finishes
      ],  // ends design 3's disk run
    },  // ends design 3
  };  // closes the LAB table
  const SVC_NAME = { quick: 'Clock service', wait: 'File system' };  // SVC_NAME: the name of the system process that serves each request in design 3
  /* What the CPU is doing during one segment. */
  function cpuOf(design, scen, seg) {  // cpuOf(): works out what the "processor right now" panel should say for one timeline segment
    const [lane, mode] = seg;  // takes the lane (whose code runs) and the mode from the segment
    if (lane === 'OUT') return design === 'np'  // code outside every process: in design 1 it is the kernel itself
      ? { mode, run: 'no process: the kernel', stack: 'the kernel’s system stack' }  // design 1: no process is running, and the kernel uses its own system stack
      : { mode, run: 'no process: switching code', stack: 'a kernel-mode stack' };  // designs 2 and 3: it is the small switching code, running on a kernel-mode stack
    if (lane === 'SP') return { mode, run: SVC_NAME[scen] + ' process', stack: 'the service’s own stack' };  // a system process (design 3): the service named for this request, on its own stack
    return { mode, run: lane, stack: lane + '’s ' + (mode === 'user' ? 'user' : 'kernel') + ' stack' };  // otherwise a user process: its name, and its user or kernel stack depending on the mode
  }  // ends cpuOf()

  function labScene(ctx) {  // labScene(): builds the step 6 timeline that shows which code runs where while one request is served
    const { s } = ctx;  // pulls out ctx.s, the SVG element maker
    const NW = ctx.narrow;  // NW is true on a phone-width screen, where the timeline is turned on its side
    const G = { W: 620, lab: 150, fs: 13.5 };   /* wide layout; phones use setNarrow below */
    const LANES = ['P1', 'P2', 'SP', 'OUT'], LY = (i) => 32 + i * 58, LH = 50, SLOT = (G.W - G.lab - 4) / 5;  // the four lanes (P1, P2, a system process, code outside every process); LY gives each lane's top, LH its height, SLOT one frame's width
    const svg = s('svg', { viewBox: NW ? '0 0 340 298' : `0 0 ${G.W} 262`, width: '100%', role: 'img', 'aria-label': 'Timeline of which code runs where while one request is served' });  // the empty SVG: 340 by 298 on a phone, 620 by 262 on a wide screen
    /* Phone layout: one column per lane and time running downward, so the labels stay readable. */
    function setNarrow(design, scen, upto) {  // the phone-width drawing: one column per lane and one row per frame; upto is the last frame to show
      const list = LAB[design][scen], kids = [], LX = 26, LW = 78.5, TOP = 44, RP = 50;  // list is the chosen walkthrough; LX is where lane columns start, LW each column's width, TOP the first row, RP each row's height
      const head = { P1: ['P1', 'user'], P2: ['P2', 'user'], SP: design === 'pb' ? SVC_NAME[scen].split(' ') : ['System', 'process'], OUT: design === 'np' ? ['Kernel', 'on its own'] : ['Switching', 'code'] };  // head: the two-line heading over each column; the system-process and outside-code columns are named to fit the design
      LANES.forEach((ln, i) => {  // draws the four lane columns
        const x = LX + i * LW, col = ln === 'P1' || ln === 'P2' ? 'var(--proc)' : 'var(--os)';  // x is this column's left edge; user lanes are headed in teal, OS lanes in violet
        head[ln].forEach((t, j) => kids.push(s('text', { x: x + LW / 2, y: 15 + j * 17, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: `fill:${col}` }, t)));  // writes the column heading, one word per line
        kids.push(s('rect', { x: x + 2, y: TOP - 2, width: LW - 4, height: 5 * RP + 2, rx: 6, class: 's-panel', 'stroke-width': 1, opacity: 0.55 }));  // a pale background strip for the whole column, tall enough for five frames
        if (ln === 'SP' && design !== 'pb') ['not used', 'in this', 'design'].forEach((t, j) => kids.push(s('text', { x: x + LW / 2, y: TOP + 110 + j * 17, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, t)));  // in designs 1 and 2 the system-process column stays empty, so it says "not used in this design"
      });  // ends the loop over the columns
      let row = 0;  // row counts how many segments have been drawn so far (the tally frame adds none)
      for (let f = 0; f <= upto; f++) {  // walks through every frame up to the one being shown
        const seg = list[f][0];  // seg is this frame's timeline segment
        if (!seg) continue;  // the tally frame has no segment, so it is skipped
        const [lane, mode, lines, marks] = seg, x = LX + LANES.indexOf(lane) * LW, y = TOP + row * RP;  // unpacks the segment (lane, mode, text, switch marks) and works out its column and row
        kids.push(s('rect', { x: x + 4, y: y + 3, width: LW - 8, height: RP - 6, rx: 5, class: mode === 'user' ? 's-proc' : 's-os', 'stroke-width': f === upto ? 3 : 1.3 }));  // the segment's box, teal for user mode and violet for kernel mode; the newest one gets a thick border
        lines.forEach((t, j) => kids.push(s('text', { x: x + LW / 2, y: y + 21 + j * 16, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': j ? 500 : 700 }, t)));  // the segment's two lines of text, the first in bold
        if (marks.length && row > 0) {  // if the segment starts with a switch (and is not the first row), mark the moment it happened
          kids.push(s('line', { x1: LX, y1: y, x2: 340, y2: y, 'stroke-width': 1.5, 'stroke-dasharray': '3 3', style: 'stroke:var(--line-2)' }));  // a dotted line across all columns at the top of this row: the instant of the switch
          marks.forEach((m, k) => {  // draws one badge per switch in the left margin
            const my = y + (marks.length === 2 ? (k ? 9 : -9) : 0), col = m === 'P' ? 'var(--intr)' : 'var(--os)';  // my places the badge (two badges are spread above and below the line); P badges are red, M badges violet
            kids.push(s('rect', { x: 2, y: my - 8, width: 22, height: 16, rx: 4, 'stroke-width': 1.6, style: `fill:var(--panel);stroke:${col}` }));  // the badge's small box
            kids.push(s('text', { x: 13, y: my + 4.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:${col}` }, m));  // the letter M (mode switch) or P (process switch) inside it
          });  // ends the loop over the badges
        }  // ends the switch marks
        row++;  // moves down to the next row
      }  // ends the loop over the frames
      svg.replaceChildren(...kids);  // swaps the new drawing into the SVG in one step
    }  // ends the phone-width drawing function
    function set(design, scen, upto) {  // set(design, scen, upto): redraws the timeline showing frames 0 to upto; the player calls it on every frame
      if (NW) return setNarrow(design, scen, upto);  // on a phone-width screen it hands the job to the tall layout above and stops here
      const list = LAB[design][scen], kids = [];  // wide layout: list is the chosen walkthrough and kids collects the shapes
      kids.push(s('text', { x: 0, y: 14, 'font-size': 12.5, class: 's-sub' }, 'switches here →'));  // a small note in the top-left corner pointing at the row of switch badges
      LANES.forEach((ln, i) => {  // draws the four lanes as horizontal rows
        const y = LY(i);  // y is the top of this lane
        let name = ln, sub = ln === 'P1' || ln === 'P2' ? 'user process' : '';  // name is the lane's label; user lanes get the sub-label "user process"
        if (ln === 'SP') { name = design === 'pb' ? SVC_NAME[scen] : 'System process'; sub = design === 'pb' ? 'system process' : 'design 3 only'; }  // the system-process lane is named after the service in design 3 and marked "design 3 only" otherwise
        if (ln === 'OUT') { name = design === 'np' ? 'Kernel' : 'Switching code'; sub = 'outside every process'; }  // the outside-code lane is the kernel itself in design 1 and the switching code in designs 2 and 3
        kids.push(s('text', { x: 0, y: y + (sub ? 21 : 30), 'font-size': 14.5, 'font-weight': 800, style: `fill:var(--${ln === 'P1' || ln === 'P2' ? 'proc' : 'os'})` }, name));  // the lane's name in bold, teal for user lanes and violet for OS lanes
        if (sub) kids.push(s('text', { x: 0, y: y + 39, 'font-size': 12.5, class: 's-sub' }, sub));  // the grey sub-label under the name
        kids.push(s('rect', { x: G.lab, y, width: G.W - G.lab - 2, height: LH, rx: 6, class: 's-panel', 'stroke-width': 1, opacity: 0.55 }));  // the pale background strip for the lane, where the segments will appear
        if (ln === 'SP' && design !== 'pb') kids.push(s('text', { x: G.lab + 12, y: y + 30, 'font-size': 13, class: 's-sub' }, 'not used: this design has no system processes'));  // in designs 1 and 2 the system-process lane explains that it is not used
      });  // ends the loop over the lanes
      let slot = 0;  // slot counts the segments drawn so far, one column each
      for (let f = 0; f <= upto; f++) {  // walks through every frame up to the one being shown
        const seg = list[f][0];  // seg is this frame's timeline segment
        if (!seg) continue;  // the tally frame has no segment, so it is skipped
        const [lane, mode, lines, marks] = seg, x = G.lab + 2 + slot * SLOT, y = LY(LANES.indexOf(lane)), now = f === upto;  // unpacks the segment; x is its column, y its lane's row; now is true for the frame being shown
        kids.push(s('rect', { x: x + 2, y: y + 3, width: SLOT - 4, height: LH - 6, rx: 5, class: mode === 'user' ? 's-proc' : 's-os', 'stroke-width': now ? 3 : 1.3 }));  // the segment's box, teal for user mode and violet for kernel mode; the current one has a thick border
        lines.forEach((t, j) => kids.push(s('text', { x: x + SLOT / 2, y: y + 22 + j * 16, 'text-anchor': 'middle', 'font-size': G.fs, 'font-weight': j ? 500 : 700 }, t)));  // its two lines of text, centred, the first in bold
        if (marks.length && slot > 0) {  // if the segment starts with a switch (and is not the first), mark the moment it happened
          kids.push(s('line', { x1: x, y1: 20, x2: x, y2: LY(3) + LH, 'stroke-width': 1.5, 'stroke-dasharray': '3 3', style: 'stroke:var(--line-2)' }));  // a dotted vertical line through all lanes at the left edge of this segment
          marks.forEach((m, k) => {  // draws one badge per switch across the top of the timeline
            const mx = x + (marks.length === 2 ? (k ? 13 : -13) : 0), col = m === 'P' ? 'var(--intr)' : 'var(--os)';  // mx places the badge (two badges sit side by side); P badges are red, M badges violet
            kids.push(s('rect', { x: mx - 11, y: 3, width: 22, height: 18, rx: 5, 'stroke-width': 1.6, style: `fill:var(--panel);stroke:${col}` }));  // the badge's small box
            kids.push(s('text', { x: mx, y: 16.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:${col}` }, m));  // the letter M or P inside it
          });  // ends the loop over the badges
        }  // ends the switch marks
        slot++;  // moves right to the next column
      }  // ends the loop over the frames
      svg.replaceChildren(...kids);  // swaps the new drawing into the SVG in one step
    }  // ends set()
    return { svg, set };  // hands back the drawing and its set() function
  }  // ends labScene()


  Guide.section({  // registers this section with the guide: its title, glossary terms, styles, the nine steps and the notes
    id: '3.5',  // the section number; the guide uses it for the address, the menu and the CSS class sec-3-5
    title: 'Execution of the Operating System',  // the full title shown at the top of the section
    short: 'Executing the OS',  // the short title used where space is tight, such as the table of contents
    summary: 'Where does OS code run: outside every process, inside each user process, or as processes of its own?',  // a one-sentence summary of the section's question
    objectives: [  // learning objectives: what the student should be able to do after this section
      'Explain why “is the operating system a process?” is a real design question, and name the three standard answers.',  // objective 1: see why "is the OS a process?" is a real question, and name the three answers
      'Describe how a nonprocess kernel handles an interrupt or supervisor call, and which memory and stack it uses.',  // objective 2: how a nonprocess kernel takes over, and which memory and stack it uses
      'Identify every part of a process image when the OS executes within user processes, including the kernel stack and the shared address space.',  // objective 3: name every part of a process image in design 2
      'Explain why a system call in that design costs a mode switch rather than a process switch, and estimate the switching overhead of each design.',  // objective 4: why a system call there is a mode switch, and how to estimate each design's switching cost
      'Weigh the modularity and multiprocessor benefits of a process-based OS against its extra switching cost.',  // objective 5: weigh the benefits of a process-based OS against its extra switching
    ],  // ends the objectives list
    terms: [  // glossary terms for this section: each is [term, definition]; dotted words in the steps show these definitions
      ['Nonprocess kernel', 'A design in which the kernel runs outside every process. It has its own region of memory and its own system stack, and the idea of a process applies only to user programs.'],  // glossary entry: defines the nonprocess kernel
      ['Execution within user processes', 'A design in which almost all OS code runs inside whichever user process was interrupted or asked for a service, in kernel mode, on that process’s kernel stack.'],  // glossary entry: defines execution within user processes
      ['Process-based operating system', 'A design in which the major OS functions are themselves separate system processes, scheduled like other processes, with only a small amount of switching code running outside all processes.'],  // glossary entry: defines the process-based operating system
      ['System process', 'A process that carries out an operating-system function, such as file handling or memory management, rather than a user’s program. It runs in kernel mode.'],  // glossary entry: defines a system process
      ['System stack of a nonprocess kernel', 'The stack a nonprocess kernel keeps in its own memory region for its procedure calls and returns while it works outside every process. Unlike the stacks in a process image (section 3.3), it belongs to no process; compare the kernel stack that each process has when the OS runs inside user processes.'],  // glossary entry: defines the system stack a nonprocess kernel keeps for itself
      ['Kernel stack', 'A second stack inside each process image, used only while that process is running OS code in kernel mode. It holds the return addresses, parameters and local variables of kernel procedure calls, out of reach of the user program.'],  // glossary entry: defines the kernel stack inside each process image
      ['User stack', 'The stack a process uses for the procedure calls of its own program while it runs in user mode.'],  // glossary entry: defines the user stack
      ['Private user address space', 'The part of a process’s address space that holds its own program and data. No other process can reach it.'],  // glossary entry: defines the private user address space
      ['Shared address space', 'The part of every process’s address space that holds the OS code and data. It leads to the same physical memory in every process and can be used only in kernel mode.'],  // glossary entry: defines the shared address space
      ['Mode switch', 'A change of the processor between user mode and kernel mode, for example on an interrupt or system call and again on the return. No process changes state and the memory map stays the same, so it is far cheaper than a process switch.'],  // glossary entry: defines a mode switch and why it is cheap
      ['System call (supervisor call)', 'A deliberate request from a running program for an OS service, such as reading a file. A special instruction switches the processor to kernel mode and enters the OS at a fixed, pre-arranged address.'],  // glossary entry: defines a system call, also called a supervisor call
      ['Trap', 'An entry into the OS caused by an error or exception in the instruction just executed, such as dividing by zero or trying a privileged instruction in user mode.'],  // glossary entry: defines a trap
      ['Context (processor state)', 'Everything the processor needs to resume a program exactly where it stopped: the program counter, the status word, the stack pointer and the other registers.'],  // glossary entry: defines a program's context (its processor state)
      ['Dispatcher', 'A small piece of OS code that takes the processor away from one process and hands it to the next process chosen to run.'],  // glossary entry: defines the dispatcher
      ['Modularity', 'Building a system from separate parts that each do one job and talk to each other only through small, well-defined interfaces, so each part can be understood, tested and replaced on its own.'],  // glossary entry: defines modularity
      ['Multiprocessor', 'A computer with two or more processors (or cores) that can execute instructions at the same moment.'],  // glossary entry: defines a multiprocessor
      ['Multicomputer', 'A system made of several complete computers, each with its own processor and memory, linked by a network and working together on one job.'],  // glossary entry: defines a multicomputer
    ],  // ends the glossary terms
    css: ` /* the section's own style rules start here; the guide adds them to the page when the section is registered */
      /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
      .sec-3-5 .step-eyebrow { contain: inline-size; } /* stops the step's small heading line from forcing the page wider than a phone screen */
      .sec-3-5 .msg { border-radius: 10px; padding: 9px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; } /* feedback boxes: rounded, padded, light background and a thin border, in slightly smaller text */
      .sec-3-5 .msg > b:first-child { display: block; margin-bottom: 2px; } /* the bold title inside a feedback box sits on its own line above the message */
      .sec-3-5 .msg.ok { border-color: var(--ok); background: var(--ok-bg); } /* a feedback box of kind "ok" gets a green border and background: a right answer */
      .sec-3-5 .msg.bad { border-color: var(--bad); background: var(--bad-bg); } /* kind "bad" gets a red border and background: a wrong answer */
      .sec-3-5 .msg.info { border-color: var(--accent); background: var(--accent-bg); } /* kind "info" uses the accent colour: hints and explanations */
      .sec-3-5 .msg.warn { border-color: var(--warn); background: var(--warn-bg); } /* kind "warn" uses the warning colour */
      .sec-3-5 .msg.os { border-color: var(--os); background: var(--os-bg); } /* kind "os" uses the violet OS colour, for messages about OS code */
      .sec-3-5 svg .hot { cursor: pointer; } /* clickable parts of the drawings show a pointing-hand cursor */
      .sec-3-5 svg .hot .fr { transition: stroke-width .15s, opacity .2s; } /* their outlines ("fr" frames) thicken and fade smoothly instead of jumping */
      .sec-3-5 svg .hot:hover .fr { stroke-width: 3.5; } /* hovering over a clickable part thickens its outline so the student can see it responds */
      .sec-3-5 svg .hot.on .fr { stroke: var(--accent); stroke-width: 3.5; } /* the part the student picked keeps a thick accent-coloured outline */
      .sec-3-5 svg .hot:focus { outline: none; } /* hides the browser's default focus box, which looks wrong around SVG shapes */
      .sec-3-5 svg .hot:focus-visible .fr { stroke: var(--accent); stroke-width: 4; } /* instead, a keyboard user who tabs to a part sees an even thicker accent outline */
      /* step 1: the three-option preview */
      .sec-3-5 .opt { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px 10px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; text-align: left; color: var(--ink); font: inherit; transition: border-color .15s, background .15s; } /* the three option buttons on step 1: picture, tag and title stacked in a rounded card */
      .sec-3-5 .opt:hover { border-color: var(--accent); } /* hovering over an option card turns its border to the accent colour */
      .sec-3-5 .opt.on { border-color: var(--accent); background: var(--accent-bg); } /* the option being previewed gets an accent border and a tinted background */
      .sec-3-5 .opt .ot { font-size: 14.5px; font-weight: 750; line-height: 1.3; } /* the option's title text, bold and slightly smaller */
      .sec-3-5 .opt .on-tag { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); } /* the small "Option n" tag in grey capital letters */
      .sec-3-5 .opt.seen .on-tag { color: var(--ok); } /* once an option has been previewed its tag turns green (it also gains a tick) */
      .sec-3-5 .preview { min-height: 142px; } /* gives the preview box a fixed minimum height so the card does not jump as the text changes */
      /* step 4: predict buttons and the cost bars */
      .sec-3-5 .pick3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; } /* the three answer buttons on step 4, side by side in equal columns */
      .sec-3-5 .pick3 .btn { height: 46px; font-size: 18px; font-weight: 800; } /* large bold numbers on those buttons */
      .sec-3-5 .pick3 .btn.right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* the right answer turns green */
      .sec-3-5 .pick3 .btn.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* a wrong answer turns red */
      .sec-3-5 .cost { display: grid; grid-template-columns: 178px minmax(0, 1fr) 118px; align-items: center; gap: 10px; font-size: 14.5px; } /* one row of the cost calculator: design name, bar, and the percentage on the right */
      .sec-3-5 .cost .nm { font-weight: 700; line-height: 1.25; } /* the design name in bold */
      .sec-3-5 .cost .nm small { display: block; font-weight: 500; color: var(--muted); font-size: 12.5px; } /* the small grey line under the name that says how many switches each call costs */
      .sec-3-5 .cost .trk { height: 18px; border-radius: 99px; background: var(--panel-3); overflow: hidden; } /* the grey track the cost bar grows along, with rounded ends */
      .sec-3-5 .cost .trk > i { display: block; height: 100%; border-radius: 99px; background: var(--os); transition: width .25s; } /* the bar itself, violet, with its width sliding smoothly when a slider moves */
      .sec-3-5 .cost .trk > i.hot3 { background: var(--warn); } /* design 3's bar is drawn in the warning colour to stand out */
      .sec-3-5 .cost .trk > i.over { background: var(--bad); } /* a bar that would pass 100% of the processor turns red */
      .sec-3-5 .cost .val { text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; } /* the percentage on the right, bold with digits of equal width so they do not wobble */
      .sec-3-5 .cost .val small { display: block; font-weight: 500; color: var(--muted); font-size: 12.5px; } /* the small grey "ms per second" line under the percentage */
      .sec-3-5 .calc .ui-slider label { width: 164px; } /* gives the calculator's slider labels a fixed width so the three sliders line up */
      .sec-3-5 .formula { font-family: var(--mono); font-size: 13.5px; background: var(--panel-3); border-radius: 10px; padding: 8px 10px; line-height: 1.5; } /* the worked formula box: code font on a light grey background */
      @media (max-width: 760px) { .sec-3-5 .cost { grid-template-columns: minmax(0, 1fr) 100px; } .sec-3-5 .cost .trk { grid-column: 1 / -1; grid-row: 2; } } /* on screens 760 pixels wide or less, the bar moves onto its own line under the name and the value */
      /* step 6: the lab's status panel and tally table */
      .sec-3-5 .kv { display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 6px 10px; align-items: center; font-size: 14.5px; } /* the "processor right now" panel on step 6: labels in one column, values in the other */
      .sec-3-5 .kv > span:nth-child(odd) { color: var(--muted); font-size: 13px; font-weight: 700; } /* the labels (every odd item) are small, bold and grey */
      .sec-3-5 .ctr { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } /* the two counters (mode switches and process switches) side by side */
      .sec-3-5 .ctr > div { border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; background: var(--panel); } /* each counter sits in its own bordered box */
      .sec-3-5 .ctr .big { font-size: 32px; } /* the counter's number is large so the change is easy to see */
      .sec-3-5 .mk { display: inline-grid; place-items: center; width: 20px; height: 18px; border-radius: 5px; border: 1.6px solid; font-size: 12px; font-weight: 800; margin-right: 6px; vertical-align: 1px; } /* the small M or P badges used in the step 6 legend and counters */
      .sec-3-5 .mk.m { color: var(--os); border-color: var(--os); } .sec-3-5 .mk.p { color: var(--intr); border-color: var(--intr); } /* M badges are violet like the OS; P badges are red like the timeline's process-switch marks */
      .sec-3-5 .tally td, .sec-3-5 .tally th { text-align: center; } /* the tally table's cells are centred */
      .sec-3-5 .tally td:first-child, .sec-3-5 .tally th:first-child { text-align: left; } /* except the first column, the design names, which stays left-aligned */
      .sec-3-5 .tally td.cur { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 6px; } /* the tally cell for the run now playing gets an accent outline */
      .sec-3-5 .tally td.p2 { color: var(--intr); font-weight: 800; } /* results with two process switches are shown in red and bold */
      /* step 7: sorter and trade-off table */
      .sec-3-5 .stmt { font-size: 19px; font-weight: 650; line-height: 1.4; padding: 14px 16px; border-radius: 12px; background: var(--panel); border: 2px solid var(--line); min-height: 96px; display: flex; align-items: center; } /* the big statement card on step 7 that the student must sort */
      .sec-3-5 .bins { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } /* the three design buttons below it, in equal columns */
      .sec-3-5 .bins .btn { height: auto; min-height: 44px; white-space: normal; line-height: 1.25; padding: 6px 10px; } /* lets long button labels wrap onto two lines instead of being cut off */
      .sec-3-5 .bins .btn.right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* the right design turns green */
      .sec-3-5 .bins .btn.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* a wrong design turns red */
      .sec-3-5 .dots { display: flex; gap: 5px; flex-wrap: wrap; } /* the row of progress squares, one per statement */
      .sec-3-5 .dots i { width: 16px; height: 16px; border-radius: 5px; background: var(--panel-3); border: 2px solid var(--line-2); } /* each square: small, rounded, grey until answered */
      .sec-3-5 .dots i.cur { border-color: var(--accent); } /* the square for the current statement has an accent border */
      .sec-3-5 .dots i.ok { background: var(--ok); border-color: var(--ok); } /* a statement right on the first try fills its square green */
      .sec-3-5 .dots i.late { background: var(--warn); border-color: var(--warn); } /* a statement right only after a miss fills it in the warning colour */
      .sec-3-5 .tradeoff { position: relative; } /* the summary table's box is the anchor for the veil laid over it */
      .sec-3-5 .tradeoff table { font-size: 13.5px; } /* the summary table uses slightly smaller text */
      .sec-3-5 .tradeoff td, .sec-3-5 .tradeoff th { padding: 5px 7px; line-height: 1.3; } /* tight padding in the summary table's cells */
      .sec-3-5 .tradeoff td:first-child { font-weight: 700; color: var(--ink-2); } /* the row names in the first column are bold */
      .sec-3-5 .tradeoff .good { color: var(--ok); font-weight: 700; } .sec-3-5 .tradeoff .cost3 { color: var(--intr); font-weight: 700; } /* "good" words are green and design 3's cost is red, so strengths and prices stand out */
      .sec-3-5 .tradeoff.veiled tbody { filter: blur(5px); opacity: .45; user-select: none; } /* while the table is still locked, its body is blurred and faded and cannot be selected */
      .sec-3-5 .tradeoff .veil { position: absolute; inset: 40px 0 0 0; display: grid; place-items: center; text-align: center; } /* the veil covers the table below its header and centres its message */
      .sec-3-5 .tradeoff .veil > div { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow); max-width: 320px; } /* the veil's message card: panel background, border, shadow, limited width */
    `,  // end of the section's style rules
    steps: [  // the nine steps of the section, in order
      /* ---------------- 1. Big Picture: is the OS a process? ---------------- */
      {  // step 1 (Big Picture): the question and a preview of the three answers
        title: 'Is the operating system a process?',  // the title shown at the top of step 1
        kind: 'story',  // kind "story" labels the step as the Big Picture and keeps it in the short course path
        render(el, ctx) {  // render(): builds step 1 inside el each time the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the guide helper that creates one page element with its attributes and children
          const INFO = [  // INFO: for each design, its heading, a plain description, and the apartment-building picture
            ['Design 1 · Nonprocess kernel',  // heading for design 1
              'The kernel is a separate program with its own memory and its own stack. Only user programs count as processes. When one of them needs the OS, its state is saved and the kernel takes over, outside every process.',  // description of design 1: a separate kernel with its own memory and stack
              'The caretaker works from an office in the basement. Tenants phone down, and the job is done down there.'],  // building picture for design 1: the caretaker's basement office
            ['Design 2 · Execution within user processes',  // heading for design 2
              'The OS is a set of routines that every process can call. They run inside the caller’s own process, just with the processor switched to kernel mode.',  // description of design 2: OS routines run inside the caller, in kernel mode
              'Every apartment has a locked service closet holding the same tools. When you need help, a technician unlocks it and works right there in your apartment.'],  // building picture for design 2: a locked service closet in every apartment
            ['Design 3 · Process-based OS',  // heading for design 3
              'The OS itself is split into several processes (a file system, a memory manager and so on) that are scheduled like everyone else.',  // description of design 3: the OS split into scheduled processes
              'The building has a team of specialists, each in an office of their own. You send your request to the right one and wait for the answer.'],  // building picture for design 3: specialists in their own offices
          ];  // ends INFO
          const seen = new Set();  // seen remembers which options the student has previewed (a Set keeps each number only once)
          const box = h('div', { class: 'msg preview' });  // the preview box where the chosen design's description appears
          const done = h('p', { class: 'small muted m0' }, 'Previewed 0 of 3.');  // the progress line under the preview
          say(box, 'info', 'Pick an option to preview it.', 'There is no trick here: all three answers have been used in real operating systems. The rest of this section takes each one apart.');  // the preview box's opening message before anything is picked
          const opts = [1, 2, 3].map((n) => {  // builds the three option buttons
            const tag = h('span', { class: 'on-tag' }, 'Option ' + n);  // the small "Option n" tag, kept so its text can change later
            const b = h('button', { class: 'opt', type: 'button', onclick: () => pick(n) },  // the option button; clicking it previews that design
              sketch(ctx, n), tag,  // inside it: the design's sketch and the tag
              h('span', { class: 'ot' }, ['Outside every process', 'Inside each user process', 'As processes of its own'][n - 1]));  // and the one-line answer the design gives: outside every process, inside each user process, or as processes
            b.tag = tag;  // stores the tag on the button so pick() can update it
            return b;  // hands back the finished button
          });  // ends the loop that builds the option buttons
          function pick(n) {  // pick(n): runs when the student clicks option n
            seen.add(n);  // records that option n has been seen
            opts.forEach((b, i) => {  // updates all three option buttons after a click
              b.classList.toggle('on', i === n - 1);  // only the clicked option is marked "on" (highlighted)
              b.classList.toggle('seen', seen.has(i + 1));  // every option already seen gets the "seen" class, which turns its tag green
              b.tag.textContent = 'Option ' + (i + 1) + (seen.has(i + 1) ? ' ✓' : '');  // the tag reads "Option n" and gains a tick once that option has been seen
            });  // ends the loop over the buttons
            const [t, what, pic] = INFO[n - 1];  // looks up the chosen design's heading, description and building picture
            say(box, 'os', t, `<div>${what}</div><div class="mt small"><i>In the building:</i> ${pic}</div>`);  // shows them in the preview box in the violet OS style, with the building picture on its own line
            done.innerHTML = seen.size < 3 ? `Previewed ${seen.size} of 3.`  // progress line: counts the options seen so far
              : '<b style="color:var(--ok)">All three previewed.</b> Next, each design in detail, then all three side by side on the same request.';  // after all three, it congratulates the student and says what comes next
          }  // ends pick()
          el.append(h('div', { class: 'split l fill' },  // lays out step 1 in two columns, the left one smaller (on a phone they stack)
            h('div', { class: 'stack' },  // left column: the question explained in words
              h('p', { class: 'lead m0', html: 'The operating system is software. The <span class="t">processor</span> runs its instructions the same way it runs yours: fetch the next one, carry it out, repeat.' }),  // opening paragraph: the OS is software that the processor runs like any other program
              h('p', { class: 'm0', html: 'Yet we have been treating the OS as the <i>manager</i> of <span class="t">processes</span>: it creates them, switches between them and puts them to sleep. So here is the puzzle. <b>Is the OS itself a process?</b> If it is, who schedules the scheduler? If it is not, where does its code run, and whose stack holds its procedure calls?' }),  // paragraph that sets the puzzle: if the OS manages processes, is it one itself?
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'An apartment building. The tenants are processes, each in an apartment of their own. The building also has staff who fix things. <b>Where do the staff work?</b>' }),  // analogy box: an apartment building whose staff must work somewhere
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The answer decides how much every request to the OS costs, how memory is laid out, and how easily the OS can be split into parts or spread over several processors.' })),  // "why it matters" box: the answer sets the cost of OS requests, the memory layout and how the OS can be split up
            h('div', { class: 'card white stack' },  // right column: a white card holding the three options
              h('h3', { class: 'm0' }, 'Where should the OS’s own code run?'),  // the card's heading question
              h('div', { class: 'grid-3' }, ...opts),  // the three option buttons in a row of equal columns
              box, done,  // the preview box and the progress line under them
              h('div', { class: 'road', style: { marginTop: 'auto' } },  // a "coming up" strip pinned to the bottom of the card
                h('h4', { class: 'm0' }, 'Coming up'),  // its small heading
                h('div', { class: 'row gap-s' },  // a row of chips listing the parts of the section still to come
                  ...['Each design up close', 'What a switch costs', 'One request, three designs', 'Sort the trade-offs']  // the four upcoming parts, in order
                    .map((t, i) => h('span', { class: 'chip accent' }, (i + 1) + ' · ' + t)))))));  // turns each into a numbered chip; the brackets close the whole layout
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Design 1: the nonprocess kernel ---------------- */
      {  // step 2 (Explore): an animated walkthrough of design 1, the nonprocess kernel
        title: 'Design 1: a kernel outside every process',  // the title shown at the top of step 2
        kind: 'explore',  // kind "explore" labels the step as an Explore step
        render(el, ctx) {  // render(): builds step 2 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          const scene = npScene(ctx);  // builds the design 1 scene (processes, kernel, CPU panel) defined near the top of this file
          const base = { mode: 'user', run: 'P1', stack: 'P1', status: { P1: 'Running', P2: 'Ready', P3: 'Blocked' },  // base: the starting state: P1 running in user mode on its own stack, P2 Ready, P3 Blocked
            saved: { P1: 'running', P2: 'context saved', P3: 'context saved' }, hl: [], frames: [], arrow: null, ms: 0, ps: 0 };  // the process table's starting notes, no highlighted rows, an empty system stack, no arrow and both counters at 0
          const K = { mode: 'kernel', run: 'K', stack: 'SYS' };  // K: the three settings that mean "the kernel is running": kernel mode, no process, the system stack
          const savedP1 = { P1: 'context saved', P2: 'context saved', P3: 'context saved' };  // savedP1: the process-table notes once P1's context has also been saved
          const common = [  // common: the first four frames, the same whichever outcome the student picks; each is [changes to base, caption]
            [{}, '<b>Before.</b> P1 runs its own program in user mode, on its own stack. Below the line sits the kernel, in a separate region of memory. Notice what the kernel is <i>not</i>: it has no PCB, no state and no place in any queue. It is not a process.'],  // frame 1: the starting picture, stressing that the kernel is not a process
            [{ ...K, frames: ['entry()'], arrow: 'call', ms: 1 }, '<b>P1 makes a supervisor call</b> to read part of a file. The hardware switches the processor to kernel mode and jumps to the kernel’s fixed entry point: a <span class="t">mode switch</span>. The kernel now works on its <b>own</b> <span class="t" data-t="System stack of a nonprocess kernel">system stack</span>, not on P1’s. P1’s state is still Running: a mode switch changes no process’s state.'],  // frame 2: P1's supervisor call switches to kernel mode; the kernel's first frame goes on its own system stack
            [{ ...K, frames: ['entry()', 'save_ctx()'], saved: savedP1, hl: ['P1'], ms: 1 }, '<b>Save P1’s context.</b> P1’s program counter, status word and registers are copied into P1’s entry in the process table, which lives in the kernel’s memory. Now P1 can later continue exactly where it stopped.'],  // frame 3: P1's context is copied into its process-table entry, which is highlighted
            [{ ...K, frames: ['entry()', 'do_read()', 'find_block()'], saved: savedP1, ms: 1 }, '<b>The kernel does the work.</b> Each kernel procedure call pushes a frame onto the system stack and each return pops one, all inside the kernel’s own memory. P1’s stack is untouched.'],  // frame 4: the kernel works, pushing frames onto its system stack while P1's stack is untouched
          ];  // ends the common frames
          const tails = {  // tails: the frames that finish the story, one list per outcome
            quick: [  // outcome "quick": the data is already in memory
              [{ saved: base.saved, hl: ['P1'], arrow: 'P1', ms: 2 }, '<b>The block was already in memory.</b> The kernel copies it into P1’s buffer, restores P1’s context and switches back to user mode. P1 carries on right after its call. Total: <b>2 mode switches, 0 process switches</b>.'],  // last frame: the kernel resumes P1 in user mode; 2 mode switches and no process switch
            ],  // ends the quick tail
            wait: [  // outcome "wait": the data must come from disk
              [{ ...K, status: { P1: 'Blocked', P2: 'Ready', P3: 'Blocked' }, frames: ['entry()', 'do_read()', 'start_disk()'], saved: { ...savedP1, P1: 'saved · Blocked' }, hl: ['P1'], ms: 1 },  // frame 5 state: P1 becomes Blocked and the kernel's stack shows start_disk()
                '<b>The block must come from disk.</b> The kernel tells the disk to start reading and records in P1’s entry that P1 is now Blocked. P1 cannot continue, so the processor should go to someone else.'],  // frame 5 caption: the disk is started and P1 is marked Blocked
              [{ ...K, status: { P1: 'Blocked', P2: 'Ready', P3: 'Blocked' }, frames: ['entry()', 'dispatcher()'], saved: { ...savedP1, P1: 'saved · Blocked' }, hl: ['P2'], ms: 1 },  // frame 6 state: the dispatcher runs and P2's row is highlighted
                '<b>Choose the next process.</b> The kernel’s <span class="t">dispatcher</span> looks at the Ready queue and picks P2. The kernel is still not a process: it is simply code running between processes.'],  // frame 6 caption: the dispatcher picks P2, and the kernel is still not a process
              [{ status: { P1: 'Blocked', P2: 'Running', P3: 'Blocked' }, run: 'P2', stack: 'P2', saved: { P1: 'saved · Blocked', P2: 'running', P3: 'context saved' }, hl: ['P2'], arrow: 'P2', ms: 2, ps: 1 },  // frame 7 state: P2 runs in user mode on its own stack, the system stack is empty, one process switch counted
                '<b>Dispatch P2.</b> The kernel loads P2’s saved context and returns to user mode, so P2 runs. The system stack is empty again: P1’s unfinished read is recorded in kernel tables (P1’s entry and the disk’s request list), not on any stack. Total: <b>2 mode switches, 1 process switch</b>.'],  // frame 7 caption: P2 is dispatched and P1's unfinished read lives in kernel tables, not on a stack
            ],  // ends the wait tail
          };  // ends tails
          let outcome = 'quick';  // outcome remembers which ending the student chose; it starts with the quick one
          const frames = () => common.concat(tails[outcome]);  // frames(): the full list of frames for the current outcome, the common ones followed by the chosen tail
          const player = ctx.ui.player({ count: frames().length, interval: 2600, render: (i) => {  // the guide's step player (play, pause, back, next); on every frame it calls render with the frame number, 2.6 seconds apart
            const [patch, cap] = frames()[i];  // looks up that frame's state changes and caption
            scene.set({ ...base, ...patch });  // redraws the scene: the base state with this frame's changes laid over it
            return cap;  // returns the caption, which the player shows above its controls
          } });  // ends the player setup
          const seg = ctx.ui.seg([{ value: 'quick', label: 'Data already in memory' }, { value: 'wait', label: 'Data must come from disk' }], outcome, (v) => {  // a two-button switch (a "segmented control") for the outcome: data in memory, or data on disk
            outcome = v; player.stop(); player.setCount(frames().length);  // when the student changes it, the player stops and restarts from frame 1 with the right number of frames
          });  // ends the outcome switch
          el.append(h('div', { class: 'split r fill' },  // lays out step 2 in two columns, the left one wider
            h('div', { class: 'stack' }, h('div', { class: 'card white' }, scene.svg), player.el,  // left column: the scene on a white card, then the player
              h('p', { class: 'small muted m0', html: '<b>Watch the CPU panel:</b> while the kernel works, <b>Executing</b> names no process.' })),  // a hint under the player: while the kernel works, the Executing box names no process
            h('div', { class: 'stack' },  // right column: the explanation
              h('p', { class: 'm0', html: 'The <b>traditional</b> <span class="t">nonprocess kernel</span>, used by many older operating systems, is a separate entity that runs in privileged <span class="t">kernel mode</span>.' }),  // paragraph: the nonprocess kernel is the traditional design and runs in kernel mode
              h('ul', { class: 'm0 small', html: '<li>Only user programs are processes. The kernel has no <span class="t">PCB</span> and is never scheduled.</li>'  // bullet list, point 1: only user programs are processes; the kernel has no PCB (process control block)
                + '<li>The kernel has its own region of memory and its own <span class="t" data-t="System stack of a nonprocess kernel">system stack</span> for its procedure calls and returns.</li>'  // point 2: the kernel has its own memory and its own system stack
                + '<li>On an <span class="t">interrupt</span>, a <span class="t">trap</span> or a <span class="t">supervisor call</span>, the running process’s <span class="t">context</span> is saved and control passes to the kernel.</li>'  // point 3: on an interrupt, trap or supervisor call, the running process's context is saved and the kernel takes over
                + '<li>When it is done, the kernel either restores that same process or dispatches a different one.</li>' }),  // point 4: afterwards the kernel resumes the same process or dispatches another
              h('div', { class: 'card tight stack gap-s' },  // a small card with the outcome question
                h('h4', { class: 'm0' }, 'P1 asks to read a file block. Where is the data?'), seg,  // its heading and the outcome switch
                h('p', { class: 'xs muted m0' }, 'Switching the outcome restarts the walkthrough.')),  // a note that changing the outcome restarts the walkthrough
              h('div', { class: 'callout why m0 small', 'data-label': 'One stack for every request', html: 'The kernel cannot leave half-done work on its single system stack for a process that must wait. So it records that work in its tables and empties the stack before it dispatches anyone else.' }))));  // "why" box: with only one system stack, a waiting request's work must be recorded in tables, not left on the stack
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Design 2: the process image when the OS runs inside processes ---------------- */
      {  // step 3 (Explore): the process image when the OS runs inside each user process (design 2)
        title: 'Design 2: the OS runs inside each user process',  // the title shown at the top of step 3
        kind: 'explore',  // kind "explore" labels it as an Explore step
        render(el, ctx) {  // render(): builds step 3 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          const INFO = {  // INFO: the explanation shown when the student clicks each part of the picture, as [heading, text]
            pcb: ['Process control block', 'The OS’s record of this process: <b>identification</b> (its PID, its parent), <b>processor state</b> (the saved registers, used while the process is not running) and <b>process control information</b> (state, priority, scheduling and memory details). Only OS code, in kernel mode, may read or change it.'],  // explanation of the PCB and its three kinds of information
            ustack: ['User stack', 'Holds the frames of the program’s <i>own</i> procedure calls: return addresses, parameters and local variables. It is the stack in use while P1 runs its program in user mode.'],  // explanation of the user stack
            priv: ['Private user address space', 'P1’s program code and data. It belongs to P1 alone: no other process can reach it. In user mode the program counter points in here.'],  // explanation of the private user address space
            kstack: ['Kernel stack', 'A second, separate stack, used only while P1 runs OS code in kernel mode. Kernel calls push their frames here, never on the user stack, which the program controls and could have left in any state. Because every process has its own kernel stack, a system call that must wait halfway through can leave its unfinished work here while another process runs.'],  // explanation of the kernel stack and why it is separate from the user stack
            shared: ['Shared address space', 'The OS code and data. It appears in <b>every</b> process’s address space and leads to the same physical memory each time, so the OS exists once yet can run inside any process. The hardware allows it to be used only in kernel mode.'],  // explanation of the shared address space that holds the OS
            phys: ['One copy in physical memory', 'Each process has its own private pages, but the shared address space of every process is mapped onto this <b>same</b> physical memory. The OS code is never copied: the only OS-related pieces that exist once per process are its PCB and its kernel stack.'],  // explanation of the single physical copy of the OS
          };  // ends INFO
          let mode = 'user', pick = null;  // mode is what P1 is doing (running its program, or in a system call); pick is the part clicked, none at first
          const info = h('div', { class: 'msg info', style: { minHeight: '146px' } });  // the info box that shows the explanation of the clicked part; a minimum height stops the layout jumping
          const status = h('div', { class: 'msg', style: { padding: '7px 12px' } });  // the status strip above the picture that says what P1 is running right now
          const scene = wpScene(ctx, (k) => { pick = k; paint(); });  // builds the design 2 scene; clicking a part stores its key in pick and repaints
          function paint() {  // paint(): brings the picture and both text boxes up to date after any click or mode change
            scene.set(mode, pick);  // redraws the picture for the current mode, highlighting the picked part
            status.innerHTML = mode === 'user'  // status text depends on the mode
              ? '<b>Running: P1</b>Code: P1’s program · Stack: P1’s user stack · Mode: user'  // user mode: P1 runs its own program on its user stack
              : '<b>Running: still P1</b>Code: the OS routine <code>read()</code> · Stack: P1’s kernel stack · Mode: kernel';  // kernel mode: still P1, but now running the OS routine read() on P1's kernel stack
            status.className = 'msg ' + (mode === 'user' ? 'ok' : 'os');  // the status strip is green in user mode and violet in kernel mode
            if (pick) say(info, 'info', INFO[pick][0], INFO[pick][1]);  // if a part has been clicked, its heading and explanation go in the info box
            else say(info, 'info', 'Click any part of P1’s image', 'or the physical-memory box. Then flip the mode and watch which parts P1 is allowed to use, where the program counter (PC) points and which stack the stack pointer (SP) uses.');  // otherwise the info box tells the student what to click and what to watch
          }  // ends paint()
          const seg = ctx.ui.seg([{ value: 'user', label: 'P1 runs its program' }, { value: 'kernel', label: 'P1 makes a system call' }], mode, (v) => { mode = v; paint(); });  // the mode switch: P1 runs its program, or P1 makes a system call; changing it repaints
          paint();  // draws everything once when the step opens
          el.append(h('div', { class: 'split l fill' },  // lays out step 3 in two columns, the left one smaller
            h('div', { class: 'stack' },  // left column: the explanation
              h('p', { class: 'lead m0', html: 'Common on PCs and workstations, <span class="t">execution within user processes</span> runs almost all OS software <b>in the context of a user process</b>.' }),  // opening paragraph: design 2 is common on PCs and workstations and runs OS code in the context of a user process
              h('p', { class: 'm0', html: 'The OS becomes a set of routines that programs call. On a <span class="t">system call</span> (or an interrupt or trap) the OS routine runs <i>inside P1</i>, the process that was running, in kernel mode: P1 is still the running process, just executing OS code for a while. So each <span class="t">process image</span> gains a <span class="t">kernel stack</span> and the <span class="t">shared address space</span>.' }),  // paragraph: on a system call the OS routine runs inside P1, so each image gains a kernel stack and the shared space
              info,  // the info box that explains whatever the student clicks
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '“The OS is in my address space, so my program can change it.” No: that region is usable only in kernel mode, and in user mode the hardware blocks any access.' })),  // "common mistake" box: the OS is in the address space but user mode cannot touch it
            h('div', { class: 'card white stack gap-s' },  // right column: a white card with the controls and the picture
              h('div', { class: 'row' }, h('span', { class: 'small b' }, 'What is P1 doing?'), seg),  // the question "What is P1 doing?" next to the mode switch
              status, scene.svg,  // the status strip and the drawing
              h('div', { class: (ctx.narrow ? 'row' : 'row nw') + ' xs muted', style: { marginTop: 'auto', gap: '16px' } },  // a small legend pinned to the bottom of the card; it may wrap on a phone but stays on one line on a wide screen
                h('span', {}, 'Dashed, faded: locked outside kernel mode'),  // legend: dashed, faded parts are locked outside kernel mode
                h('span', {}, 'PC → code running now'),  // legend: the PC arrow points at the code running now
                h('span', {}, 'SP → stack in use')))));  // legend: the SP arrow points at the stack in use; the brackets close the whole layout
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Predict, then price: mode switch vs process switch ---------------- */
      {  // step 4 (Predict): guess the number of process switches, then price the switching with a calculator
        title: 'A mode switch, not a process switch: count the cost',  // the title shown at the top of step 4
        kind: 'predict',  // kind "predict" labels it as a Predict step
        core: true,  // core: true keeps this step in the short course path
        render(el, ctx) {  // render(): builds step 4 when the student arrives on it
          const { h, util } = ctx;  // pulls out ctx.h (element maker) and ctx.util (number formatting helpers)
          /* ---- left: predict ---- */
          const FB = [  // FB: the feedback for each answer button, as [box kind, title, explanation]
            ['ok', 'Right: zero.', 'Each request is one mode switch into the kernel and one back, so 2,000 mode switches. But P1 never stops being the running process: the OS code runs <i>inside</i> P1, so no process switch ever happens.'],  // feedback for 0, the right answer: 2,000 mode switches but no process switch
            ['bad', 'Not quite.', 'A process switch means the processor is taken away from P1 and given to another process. Does that ever need to happen here? The OS routine runs inside P1 and every answer is ready at once.'],  // feedback for 1,000: asks whether the processor ever needs to leave P1
            ['bad', 'That is the count for a different design.', 'If the time service were a separate process (design 3), every request would need a switch to it and a switch back: 2,000 process switches. Here the OS runs inside P1, so the answer is 0.'],  // feedback for 2,000: that would be design 3, where the service is a separate process
          ];  // ends FB
          const fb = h('div', { class: 'msg', style: { minHeight: '118px' } });  // the feedback box under the buttons, with a minimum height so the card does not jump
          say(fb, '', 'Commit to a number first.', 'Then compare your answer with the explanation here, and put a price on it with the calculator.');  // its opening message: pick a number before reading any explanation
          let tries = 0, solved = false;  // tries counts the guesses; solved turns true once the right answer is picked
          const btns = ['0', '1,000', '2,000'].map((t, i) => h('button', { class: 'btn', type: 'button', onclick: () => {  // builds the three answer buttons: 0, 1,000 and 2,000
            if (solved) return;  // once solved, further clicks are ignored
            tries++;  // counts this guess
            btns.forEach((b, j) => b.classList.toggle(j === 0 ? 'right' : 'wrong', j === i || (i === 0 && j === 0)));  // colours only the clicked button: green if it is 0, red otherwise; an earlier wrong guess loses its red
            if (i === 0) solved = true;  // picking 0 solves the question
            const [k, title, body] = FB[i];  // looks up the feedback for the clicked button
            say(fb, k, title, body + (i === 0 && tries > 1 ? ' <i>(second try)</i>' : ''));  // shows it, noting "(second try)" when the right answer came after a miss
          } }, t));  // ends the click handler and the button list
          const left = h('div', { class: 'stack' },  // left column of step 4
            h('div', { class: 'card stack gap-s' },  // a card holding the prediction question
              h('h4', { class: 'm0' }, 'Predict'),  // its heading
              h('p', { class: 'm0', html: 'A program asks the OS for the time of day <b>1,000 times</b>. The OS executes within user processes (design 2), and every answer is ready at once. How many <b>process switches</b> does that take?' }),  // the question: 1,000 quick time-of-day requests in design 2; how many process switches?
              h('div', { class: 'pick3' }, ...btns), fb),  // the three answer buttons and the feedback box
            h('div', { class: 'callout why m0', 'data-label': 'Why the difference is so large', html: 'A <span class="t">mode switch</span> flips the mode bit, saves a few registers and switches to the OS’s stack. A <span class="t">process switch</span> saves a whole context, updates two PCBs and a queue, and changes the memory map. The new process then starts with caches full of the old one’s data, so it runs slowly at first.' }),  // "why" box: what a mode switch does compared with the much heavier process switch
            h('p', { class: 'small muted m0', html: 'Section 3.4 walked through the seven steps of a process switch. Here we only need their price, compared with the price of a mode switch.' }));  // a note that the steps of a process switch were covered in section 3.4; here only the price matters
          /* ---- right: the cost calculator ---- */
          let calls = 50000, mode = 0.2, proc = 3;  // the calculator's starting values: 50,000 requests per second, 0.2 µs per mode switch, 3 µs per process switch (µs = millionths of a second)
          const rows = DESIGNS.map((d) => {  // builds one cost row per design
            const bar = h('i'), val = h('div', { class: 'val' });  // bar is the coloured bar that grows; val is the text on the right
            const row = h('div', { class: 'cost' },  // the row itself
              h('div', { class: 'nm', html: `${d.n} · ${d.short}<small>${d.n === 3 ? '2 mode + 2 process switches per call' : '2 mode switches per call'}</small>` }),  // the design's number and name, with a note of how many switches each call costs
              h('div', { class: 'trk' }, bar), val);  // the grey track holding the bar, then the value
            return { d, bar, val, row };  // keeps the pieces so update() can change them
          });  // ends the cost rows
          const formula = h('div', { class: 'formula' });  // the formula box that shows the arithmetic
          const fmtN = (n) => Math.round(n).toLocaleString('en-US');  // fmtN(): rounds a number and writes it with thousands commas, such as 50,000
          function update() {  // update(): recomputes every bar and the formula; runs whenever a slider or preset changes a price
            rows.forEach(({ d, bar, val }) => {  // updates each design's row
              const per = 2 * mode + (d.n === 3 ? 2 * proc : 0);          /* µs of switching per call */
              const ms = (calls * per) / 1000;                              /* ms of switching per second */
              const pct = ms / 10;                                          /* % of one processor (1000 ms) */
              bar.style.width = Math.min(100, pct) + '%';  // the bar's width is its share of the processor, capped at the full track
              bar.className = pct > 100 ? 'over' : d.n === 3 ? 'hot3' : '';  // the bar turns red past 100%; design 3's bar uses the warning colour
              val.innerHTML = pct > 100 ? `over 100%<small>cannot keep up</small>` : `${util.fmt(pct, pct < 10 ? 1 : 0)}%<small>${util.fmt(ms, ms < 10 ? 1 : 0)} ms per second</small>`;  // the value text: over 100% means the processor cannot keep up; otherwise the percentage and the milliseconds per second
            });  // ends the loop over the rows
            const p3 = 2 * mode + 2 * proc, us3 = calls * p3, us12 = calls * 2 * mode;  // p3 is design 3's cost per call; us3 and us12 are the total microseconds per second for design 3 and for designs 1 and 2
            const fmtMs = (us) => util.fmt(us / 1000, us < 10000 ? 1 : 0);  // fmtMs(): turns microseconds into milliseconds, keeping one decimal for small values
            formula.innerHTML = `Design 3: ${fmtN(calls)} × (2 × ${util.fmt(mode, 1)} + 2 × ${util.fmt(proc, 1)}) µs<br>= ${fmtN(us3)} µs = ${fmtMs(us3)} ms of every second`  // the formula for design 3, with the student's current numbers filled in
              + `<br>Designs 1, 2: ${fmtN(calls)} × (2 × ${util.fmt(mode, 1)}) µs = ${fmtMs(us12)} ms`;  // and the shorter formula for designs 1 and 2
          }  // ends update()
          const sCalls = ctx.ui.slider({ label: 'Service requests / s', min: 1000, max: 200000, step: 1000, value: calls, format: fmtN, onInput: (v) => { calls = v; update(); } });  // slider for requests per second, from 1,000 to 200,000
          const sMode = ctx.ui.slider({ label: 'Mode switch', min: 0.1, max: 1, step: 0.1, value: mode, format: (v) => util.fmt(v, 1) + ' µs', onInput: (v) => { mode = v; update(); } });  // slider for the price of one mode switch, from 0.1 to 1 µs
          const sProc = ctx.ui.slider({ label: 'Process switch', min: 1, max: 10, step: 0.5, value: proc, format: (v) => util.fmt(v, 1) + ' µs', onInput: (v) => { proc = v; update(); } });  // slider for the price of one process switch, from 1 to 10 µs
          update();  // fills in the bars and formula once when the step opens
          const preset = (label, c, m, p, note) => h('button', { class: 'btn sm', type: 'button', title: note, onclick: () => {  // preset(): makes a button that jumps all three sliders to a set of example values
            calls = c; mode = m; proc = p; sCalls.set(c); sMode.set(m); sProc.set(p); update();  // sets the three values, moves the sliders to match and redraws
            ctx.toast(note);  // shows a short pop-up message (a "toast") explaining the example
          } }, label);  // ends preset()
          const right = h('div', { class: 'card white stack calc', style: { gap: '10px' } },  // right column: the calculator card
            h('h3', { class: 'm0' }, 'Price it: processor time spent switching'),  // its heading
            sCalls, sMode, sProc,  // the three sliders
            h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b' }, 'TRY'),  // a row of example buttons labelled TRY
              preset('Busy server', 150000, 0.2, 3, 'A busy server: design 3 now spends almost the whole processor on switching.'),  // example: a busy server, where design 3 spends nearly the whole processor switching
              preset('Cheaper process switch', 50000, 0.2, 1, 'Even at 1 µs, design 3 pays six times as much as designs 1 and 2.'),  // example: even a cheaper process switch leaves design 3 paying six times as much
              preset('Reset', 50000, 0.2, 3, 'Back to the starting prices.')),  // example: back to the starting prices
            h('div', { class: 'stack gap-s' }, ...rows.map((r) => r.row)),  // the three cost rows stacked together
            formula,  // the formula box under them
            h('p', { class: 'xs muted m0' }, 'Illustrative prices; real ones depend on the hardware. Designs 1 and 2 tie on switch count. They differ in where a waiting request’s progress is kept (kernel tables versus the caller’s own kernel stack), not in how often they switch.'));  // a small note: the prices are examples, and designs 1 and 2 differ in where waiting work is kept, not in switch count
          el.append(h('div', { class: 'split fill' }, left, right));  // lays out step 4 in two equal columns: prediction on the left, calculator on the right
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. Design 3: the OS as a set of system processes ---------------- */
      {  // step 5 (Explore): design 3, the OS built as a team of system processes
        title: 'Design 3: the OS as a team of system processes',  // the title shown at the top of step 5
        kind: 'explore',  // kind "explore" labels it as an Explore step
        render(el, ctx) {  // render(): builds step 5 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          const INFO = {  // INFO: the explanation shown for each clickable box, as [heading, text]
            P1: ['A user process', 'P1 runs in user mode. To get a service it sends a request to the right system process and waits for the reply, instead of calling an OS routine directly.'],  // explanation of a user process: it asks a system process for service and waits
            FS: ['File-system process', 'Turns requests such as open and read into disk operations. Others reach it only through its request interface, so its insides can change without breaking anyone: <b>modular design with small, clean interfaces</b>.'],  // explanation of the file-system process and its small request interface
            MM: ['Memory-manager process', 'Hands out and reclaims memory. Like every system process it runs in kernel mode, yet the dispatcher schedules it like any other process.'],  // explanation of the memory-manager process: kernel mode, yet scheduled like any process
            IO: ['I/O-manager process', 'Drives the devices. On a <span class="t">multiprocessor</span> it can live on a processor of its own, so device work goes on in parallel with the user programs.'],  // explanation of the I/O-manager process, which can have its own processor
            Mon: ['Usage monitor: a noncritical job', 'Records how busy the processor, memory and I/O channels are and how fast user processes progress. No process asks it for a service, so it fits naturally as a process: it gets its own low priority and runs whenever the dispatcher gives it a turn.'],  // explanation of the usage monitor, a noncritical job that runs at its own low priority
            SW: ['Process-switching code', 'The one part that cannot be a process: something must take the processor from one process and give it to the next. It is small, it runs outside all processes, and on the one-processor timeline it runs at every P mark.'],  // explanation of the process-switching code, the one part that cannot be a process
          };  // ends INFO
          INFO.P2 = INFO.P3 = INFO.P1;  // P2 and P3 share P1's explanation, since all three are ordinary user processes
          let cpus = 1, pick = null;  // cpus is the number of processors shown (1 or 4); pick is the box the student clicked
          const info = h('div', { class: 'msg info', style: { minHeight: '92px' } });  // the info box for the clicked box's explanation
          const stat = h('p', { class: 'small m0' });  // the line under the picture that sums up the timeline
          const scene = pbScene(ctx, (k) => { pick = k; paint(); });  // builds the design 3 scene; a click stores the key in pick and repaints
          function paint() {  // paint(): brings the picture and text up to date after any click or change of processor count
            scene.set(cpus, pick);  // redraws the picture, highlighting the picked process and its time slots
            if (pick) say(info, 'info', INFO[pick][0], INFO[pick][1]);  // if something was clicked, its explanation goes in the info box
            else say(info, 'info', 'Click any process, or the switching code.', 'Clicking a process also highlights its time slots in the processor timeline.');  // otherwise the info box invites the student to click
            stat.innerHTML = cpus === 1  // the summary line depends on the processor count
              ? '<b>One processor:</b> user programs get only 7 of 12 slots. The other 5 go to OS services, and every change of owner is a process switch.'  // one processor: user programs get only 7 of the 12 slots
              : '<b>Four processors:</b> CPU 0 and 1 give all 24 slots to user programs; OS services run alongside on CPU 2 and 3.';  // four processors: two processors run user programs full time while OS services run on the other two
          }  // ends paint()
          const seg = ctx.ui.seg([{ value: 1, label: 'One processor' }, { value: 4, label: 'Four processors' }], cpus, (v) => { cpus = v; paint(); });  // the switch between one processor and four; changing it repaints
          paint();  // draws everything once when the step opens
          el.append(h('div', { class: 'split l fill' },  // lays out step 5 in two columns, the left one smaller
            h('div', { class: 'stack' },  // left column: the explanation
              h('p', { class: 'lead m0', html: 'Take the idea all the way: a <span class="t" data-t="Process-based operating system">process-based OS</span> is a collection of <span class="t">system processes</span>.' }),  // opening paragraph: a process-based OS is a collection of system processes
              h('p', { class: 'm0 small', html: 'The major kernel functions become separate processes. They run in kernel mode, but the <span class="t">dispatcher</span> schedules them like any other process. Only a small amount of process-switching code runs outside all processes.' }),  // paragraph: kernel functions become processes the dispatcher schedules; only the switching code sits outside
              h('h4', { class: 'm0' }, 'Three advantages'),  // heading for the list of advantages
              h('ol', { class: 'm0 small', html: '<li><b>Modular by design.</b> Each function hides inside its own process and is reached only through a small, clean interface (<span class="t">modularity</span>).</li>'  // advantage 1: modular by design, each function behind a small interface
                + '<li><b>Noncritical jobs fit neatly.</b> A usage monitor can run at its own low priority, interleaved with other work.</li>'  // advantage 2: noncritical jobs such as a usage monitor fit neatly
                + '<li><b>Ready for many processors.</b> Services can be shipped to dedicated processors, or to other machines of a <span class="t">multicomputer</span>, improving performance.</li>' }),  // advantage 3: services can move to dedicated processors or other machines
              h('div', { class: 'callout warn m0', 'data-label': 'The price', html: 'Every service request now travels from one process to another: a process switch to the service and another away from it. That is the overhead you priced in the previous step.' })),  // "the price" box: every service request now costs process switches
            h('div', { class: 'card white stack gap-s' },  // right column: a white card with the controls and the picture
              h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Processors:'), seg),  // the processor-count switch with its label
              scene.svg, stat, info)));  // the drawing, the summary line and the info box; the brackets close the layout
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. Lab: one request, three designs (head to head) ---------------- */
      {  // step 6 (Hands-on Lab): play the same request under each design and compare the switch counts
        title: 'Head to head: one request, three designs',  // the title shown at the top of step 6
        kind: 'lab',  // kind "lab" labels it as a Hands-on Lab
        core: true,  // core: true keeps this step in the short course path
        render(el, ctx) {  // render(): builds step 6 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          let design = 'np', scen = 'quick';  // design and scen are the chosen design and request; they start at design 1 with the quick request
          const results = {};  // results stores the final switch counts of every run the student has played to the end
          const scene = labScene(ctx);  // builds the lab timeline scene
          const modeV = h('span', { class: 'chip' }), runV = h('span', { class: 'b' }), stackV = h('span');  // the three values of the "processor right now" panel: mode chip, what is executing, which stack
          const msV = h('div', { class: 'big' }), psV = h('div', { class: 'big' });  // the two big counters: mode switches and process switches so far
          const tbody = h('tbody');  // the body of the tally table, refilled after every frame
          const insight = h('div', { class: 'msg', style: { minHeight: '64px' } });  // the message box under the table that reports progress and, at the end, the pattern
          const SCEN = { quick: 'Quick answer', wait: 'Must wait' };  // SCEN: the column headings for the two kinds of request
          function paintTable() {  // paintTable(): rebuilds the tally table from results
            tbody.replaceChildren(...DESIGNS.map((d) => h('tr', { class: d.key === design ? 'on' : '' },  // one row per design; the row for the chosen design is marked "on"
              h('td', { class: 'b' }, d.n + ' · ' + d.short),  // first cell: the design's number and short name
              ...['quick', 'wait'].map((sc) => {  // then one cell for each kind of request
                const r = results[d.key + sc];  // r is that run's saved result, if the student has finished it
                return h('td', { class: (d.key === design && sc === scen ? 'cur ' : '') + (r && r[1] === 2 ? 'p2' : ''), html: r ? `${r[0]} M · ${r[1]} P` : '<span class="muted">run it</span>' });  // the cell shows "M" and "P" counts or "run it"; the run now playing is outlined and 2 process switches show in red
              }))));  // ends the cells and the rows
            const n = Object.keys(results).length;  // n counts how many of the 6 runs are done
            if (n < 6) say(insight, 'info', `Tally: ${n} of 6 runs complete.`, 'Play each design with each request to the end. The last frame of every run records its switches here.');  // before all 6 are done, the message shows progress
            else say(insight, 'ok', 'Pattern found.', 'Designs 1 and 2 answer a quick request with <b>no</b> process switch. Design 3 pays <b>two process switches</b> per request, whether or not anyone has to wait.');  // after all 6, it states the pattern: design 3 always pays two process switches
          }  // ends paintTable()
          const player = ctx.ui.player({ count: LAB[design][scen].length, interval: 2300, render: (i) => {  // the step player; on each frame it calls render with the frame number, 2.3 seconds apart when playing
            const list = LAB[design][scen];  // list is the walkthrough for the chosen design and request
            scene.set(design, scen, i);  // redraws the timeline up to this frame
            let ms = 0, ps = 0, cur = null;  // ms and ps will hold the switch counts so far; cur will be the latest segment
            for (let f = 0; f <= i; f++) { const sg = list[f][0]; if (sg) { cur = sg; sg[3].forEach((m) => (m === 'M' ? ms++ : ps++)); } }  // walks the frames so far, remembering the latest segment and counting each M and P mark
            const c = cpuOf(design, scen, cur);  // asks cpuOf() what the processor is doing during that segment
            modeV.className = 'chip ' + (c.mode === 'user' ? 'proc' : 'os'); modeV.textContent = c.mode + ' mode';  // the mode chip turns teal for user mode or violet for kernel mode, with the mode in words
            runV.textContent = c.run; stackV.textContent = c.stack;  // fills in what is executing and which stack is in use
            msV.textContent = ms; psV.textContent = ps;  // updates the two counters
            if (i === list.length - 1) results[design + scen] = [ms, ps];  // on the last frame, records this run's totals in results
            paintTable();  // refreshes the tally table
            return list[i][1];  // returns this frame's caption for the player to show
          } });  // ends the player setup
          const restart = () => { player.stop(); player.setCount(LAB[design][scen].length); };  // restart(): stops the player and starts over from frame 1 with the new run's number of frames
          const segD = ctx.ui.seg(DESIGNS.map((d) => ({ value: d.key, label: d.n + ' · ' + d.short })), design, (v) => { design = v; restart(); });  // the design switch; choosing a design restarts the walkthrough
          const segS = ctx.ui.seg([{ value: 'quick', label: 'Quick answer: time of day' }, { value: 'wait', label: 'Must wait: disk read' }], scen, (v) => { scen = v; restart(); });  // the request switch (quick answer or must wait); changing it also restarts
          el.append(h('div', { class: 'stack fill' },  // lays out step 6: controls on top, then two columns
            h('div', { class: 'row', style: { gap: '8px 18px' } },  // the control row
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Design'), segD),  // the design switch with its label
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Request'), segS)),  // the request switch with its label
            h('div', { class: 'split r grow' },  // two columns below, the left one wider, filling the rest of the step
              h('div', { class: 'stack' },  // left column
                h('div', { class: 'card white stack gap-s', style: { padding: '10px 12px' } }, scene.svg,  // a white card holding the timeline
                  h('div', { class: 'row xs muted', style: { gap: '6px 16px' }, html: '<span><span class="chip proc">user mode</span></span><span><span class="chip os">kernel mode</span></span>'  // a legend under the timeline: the teal chip means user mode, the violet chip kernel mode
                    + '<span><span class="mk m">M</span>mode switch</span><span><span class="mk p">P</span>process switch</span>' })),  // and the M and P badges mean a mode switch and a process switch
                player.el),  // the step player under the card
              h('div', { class: 'stack' },  // right column
                h('div', { class: 'card tight stack gap-s' },  // a compact card for the processor's current state
                  h('h4', { class: 'm0' }, 'The processor right now'),  // its heading
                  h('div', { class: 'kv' }, h('span', {}, 'Mode'), h('span', {}, modeV), h('span', {}, 'Executing'), runV, h('span', {}, 'Stack in use'), stackV),  // a two-column grid of labels and values: Mode, Executing and Stack in use, filled in by the player on every frame
                  h('div', { class: 'ctr' },  // the two counters side by side
                    h('div', {}, h('div', { class: 'xs b', html: '<span class="mk m">M</span>Mode switches' }), msV),  // the mode-switch counter with its M badge
                    h('div', {}, h('div', { class: 'xs b', html: '<span class="mk p">P</span>Process switches' }), psV))),  // the process-switch counter with its P badge
                h('table', { class: 'tbl compact tally' },  // the tally table of finished runs
                  h('thead', {}, h('tr', {}, h('th', {}, 'Design'), h('th', {}, SCEN.quick), h('th', {}, SCEN.wait))), tbody),  // its header row (Design, Quick answer, Must wait) and the body that paintTable() fills
                insight))));  // the message box under the table; the brackets close the whole layout
          paintTable();  // fills the tally table once when the step opens, so every cell says "run it"
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Trade-offs: sort the statements, unlock the summary ---------------- */
      {  // step 7 (Compare): sort twelve statements into the three designs to unlock a summary table
        title: 'Trade-offs: which design is it?',  // the title shown at the top of step 7
        kind: 'compare',  // kind "compare" labels it as a Compare step
        render(el, ctx) {  // render(): builds step 7 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          /* [statement, design index, why] in a mixed order */
          const ITEMS = [  // ITEMS: the twelve statements; the number is the design they fit (0, 1 or 2) and the last text explains why
            ['The idea of a process applies only to user programs.', 0, 'In a nonprocess kernel the OS runs as a separate entity in kernel mode. It is never a process.'],  // statement for design 1: only user programs are processes
            ['Every process image contains a kernel stack as well as a user stack.', 1, 'OS routines run inside the process, so each process needs its own stack for kernel-mode calls.'],  // statement for design 2: each image has a kernel stack as well as a user stack
            ['Every request for an OS service means a switch to a service process and a switch away from it.', 2, 'Services live in system processes, so reaching one takes process switches. That is design 3’s overhead.'],  // statement for design 3: every service request means two process switches
            ['The kernel keeps a single system stack in its own region of memory.', 0, 'The nonprocess kernel has its own memory and its own stack, separate from every process.'],  // statement for design 1: one system stack in the kernel's own memory
            ['OS code and data sit in a region that appears in every process’s address space.', 1, 'That region is the shared address space. It leads to one physical copy and is usable only in kernel mode.'],  // statement for design 2: OS code appears in every process's address space
            ['The OS is forced into modules with small, clean interfaces.', 2, 'Each function is a separate process that others can reach only through requests, so modularity is built in.'],  // statement for design 3: modules with small interfaces are forced by the design
            ['A system call runs OS code inside the caller’s own process: a mode switch, no process switch.', 1, 'The caller stays the running process; only the processor mode changes.'],  // statement for design 2: a system call is a mode switch, not a process switch
            ['The traditional approach, found in many older operating systems.', 0, 'Running the kernel outside every process is the classic design.'],  // statement for design 1: the traditional, older approach
            ['A usage monitor can run at its own low priority, interleaved with other work by the dispatcher.', 2, 'As a process, a noncritical job gets its own priority and runs when the dispatcher allows.'],  // statement for design 3: a usage monitor at its own low priority
            ['Common on smaller machines such as PCs and workstations.', 1, 'Running the OS inside user processes is the usual choice there, because it avoids process switches.'],  // statement for design 2: common on PCs and workstations
            ['Some OS services can be moved onto processors dedicated to them.', 2, 'Separate processes can be placed on separate processors, or other machines of a multicomputer.'],  // statement for design 3: services can move onto dedicated processors
            ['Apart from a little switching code, OS functions are scheduled just like user programs.', 2, 'System processes are dispatched like any other process; only the switching code sits outside them.'],  // statement for design 3: OS functions are scheduled like user programs
          ];  // ends ITEMS
          let k = 0, tries = 0;  // k is the number of the statement being sorted; tries counts the guesses on it
          const marks = [];  // marks records each statement's result: "ok" if right first time, "late" if right after a miss
          const stmt = h('div', { class: 'stmt' });  // the card that shows the current statement
          const counter = h('h4', { class: 'm0' });  // the heading that says "Statement n of 12"
          const fb = h('div', { class: 'msg', style: { minHeight: '84px' } });  // the feedback box under the design buttons
          const dots = h('div', { class: 'dots' }, ...ITEMS.map(() => h('i')));  // one small progress square per statement
          const nextBtn = h('button', { class: 'btn primary sm', type: 'button', style: { visibility: 'hidden' }, onclick: () => {  // the Next button, hidden until the current statement is sorted
            if (k >= ITEMS.length) { k = 0; marks.length = 0; } else k++;  // after the last statement it starts a new round from the beginning; otherwise it moves to the next statement
            show();  // shows the new statement (or the finish screen)
          } }, 'Next statement →');  // ends the Next button
          const bins = DESIGNS.map((d, i) => h('button', { class: 'btn', type: 'button', onclick: () => choose(i) }, d.n + ' · ' + d.short));  // the three design buttons the student sorts with; each calls choose() with its design number
          const table = h('div', { class: 'tradeoff veiled' });  // the box that will hold the summary table, blurred ("veiled") at first
          function show() {  // show(): sets the card up for the current statement, or for the finish screen after the last one
            tries = 0;  // resets the guess count for this statement
            nextBtn.style.visibility = 'hidden';  // hides the Next button until the statement is sorted
            nextBtn.textContent = 'Next statement →';  // puts back its usual label
            bins.forEach((b) => { b.classList.remove('right', 'wrong'); b.disabled = false; });  // clears the green and red colours from the design buttons and enables them all again
            [...dots.children].forEach((d, i) => { d.className = marks[i] || (i === k ? 'cur' : ''); });  // repaints the progress squares: finished ones keep their colour and the current one is outlined
            if (k >= ITEMS.length) {  // after the last statement: the finish screen
              const first = marks.filter((m) => m === 'ok').length;  // first counts how many statements were right on the first try
              counter.textContent = 'All 12 sorted';  // heading: all 12 sorted
              stmt.innerHTML = `<span>${first} of 12 right on the first try. The summary on the right is unlocked.</span>`;  // the statement card shows the first-try score and says the summary is unlocked
              say(fb, 'ok', 'Done.', 'Read across each row of the summary: no design wins every row. That is why it is called a trade-off.');  // feedback: no design wins every row, which is what a trade-off means
              bins.forEach((b) => (b.disabled = true));  // disables the design buttons, since there is nothing left to sort
              nextBtn.textContent = 'Sort again';  // the Next button becomes "Sort again"
              nextBtn.style.visibility = 'visible';  // and it is shown
              unveil();  // removes the blur from the summary table
              return;  // stops here so the code below does not run
            }  // ends the finish screen
            counter.textContent = `Statement ${k + 1} of ${ITEMS.length}`;  // heading for the current statement, such as "Statement 3 of 12"
            stmt.textContent = ITEMS[k][0];  // shows the statement's text
            say(fb, '', 'Pick a design.', 'Every statement fits exactly one of the three.');  // the feedback box's prompt: every statement fits exactly one design
          }  // ends show()
          function choose(i) {  // choose(i): runs when the student clicks design button i
            if (k >= ITEMS.length || nextBtn.style.visibility === 'visible') return;  /* finished, or waiting for Next */
            const [, ans, why] = ITEMS[k];  // looks up the right design and the explanation for this statement
            tries++;  // counts this guess
            if (i === ans) {  // a right answer
              bins[i].classList.add('right');  // turns the clicked button green
              marks[k] = tries === 1 ? 'ok' : 'late';  // records "ok" if it was the first guess, "late" otherwise
              dots.children[k].className = marks[k];  // colours this statement's progress square to match
              say(fb, 'ok', 'Yes: ' + DESIGNS[ans].name + '.', why);  // says which design it is and why
              nextBtn.style.visibility = 'visible';  // shows the Next button
            } else {  // a wrong answer
              bins[i].classList.add('wrong');  // turns the clicked button red
              bins[i].disabled = true;  // and disables it, so the student tries one of the others
              say(fb, 'bad', 'Not that one.', 'Think about where the OS code runs in design ' + (i + 1) + ', and whether this statement really describes it. Try another.');  // a hint: think about where the OS code runs in that design
            }  // ends the right-or-wrong choice
          }  // ends choose()
          const ROWS = [  // ROWS: the summary table, one row per property, with a cell for each design
            ['Where OS code runs', 'Outside every process', 'Inside the calling process', 'In system processes'],  // row: where the OS code runs in each design
            ['Switch overhead', '<span class="good">Low:</span> 2 mode switches per request', '<span class="good">Low:</span> 2 mode switches per request', '<span class="cost3">Higher:</span> plus 2 process switches'],  // row: switch overhead, low for designs 1 and 2 and higher for design 3
            ['Waiting request’s progress', 'Recorded in kernel tables', 'Left on the caller’s kernel stack', 'Held by the service process'],  // row: where a waiting request's progress is kept
            ['Modularity', 'Up to the designers', 'Up to the designers', '<span class="good">Enforced</span> by process boundaries'],  // row: modularity, which only design 3 enforces
            ['Protecting OS code', 'Separate kernel memory, kernel mode only', 'Shared region, locked outside kernel mode', 'Kernel mode; parts in separate address spaces'],  // row: how each design protects the OS code
            ['Many processors', 'Runs on whichever processor entered it', 'Runs on the caller’s processor', '<span class="good">Services can get</span> dedicated processors'],  // row: how each design uses many processors
          ];  // ends ROWS
          function unveil() { table.classList.remove('veiled'); const v = table.querySelector('.veil'); if (v) v.remove(); }  // unveil(): removes the blur from the summary table and deletes the message laid over it
          table.append(  // fills the summary box
            h('table', { class: 'tbl compact' },  // the summary table itself
              h('thead', {}, h('tr', {}, h('th', {}, ''), ...DESIGNS.map((d) => h('th', {}, d.n + ' · ' + d.short)))),  // header row: an empty corner cell, then one heading per design
              h('tbody', {}, ...ROWS.map((r) => h('tr', {}, ...r.map((c) => h('td', { html: c })))))),  // body: one table row per entry in ROWS, each cell filled from its HTML text
            h('div', { class: 'veil' }, h('div', { class: 'stack gap-s' },  // the veil laid over the blurred table until the student finishes sorting
              h('span', { class: 'small b' }, 'Sort all 12 statements to unlock this summary.'),  // its message: sort all 12 statements to unlock the summary
              h('button', { class: 'btn sm', type: 'button', onclick: unveil }, 'Show it now'))));  // a "Show it now" button for students who want to see the table early; it calls unveil()
          show();  // shows the first statement when the step opens
          el.append(h('div', { class: 'split l fill' },  // lays out step 7 in two columns, the left one smaller
            h('div', { class: 'card stack' }, counter, stmt, h('div', { class: 'bins' }, ...bins), fb,  // left column: a card with the counter, the statement, the three design buttons and the feedback
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, dots, nextBtn),  // a row with the progress squares on the left and the Next button on the right
              h('div', { class: 'callout tip', 'data-label': 'Two questions settle most of them', style: { margin: 'auto 0 0' }, html: 'Where does the OS code run: outside every process, inside the caller, or in a process of its own? And does asking for a service switch processes?' })),  // tip box pinned to the bottom of the card: two questions (where the code runs, whether a request switches processes) settle most statements
            h('div', { class: 'stack' },  // right column: the summary
              h('h3', { class: 'm0' }, 'The trade-off at a glance'),  // its heading
              table,  // the blurred summary table
              h('div', { class: 'callout why m0 small', 'data-label': 'In real systems', html: 'Designs are often mixed. UNIX, the subject of the next section, runs most OS code inside user processes and also keeps a few system processes for background jobs.' }))));  // "in real systems" box: designs are often mixed, as the next section's UNIX shows; the brackets close the layout
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. Recap ---------------- */
      {  // step 8 (Recap): flip cards for the six main ideas and a strip of the three design sketches
        title: 'Recap: six ideas to carry with you',  // the title shown at the top of step 8
        kind: 'recap',  // kind "recap" labels it as the Recap and keeps it in the short course path
        render(el, ctx) {  // render(): builds step 8 when the student arrives on it
          const { h } = ctx;  // pulls out ctx.h, the page element maker
          const cards = ctx.ui.flipcards([  // the guide's flip cards: each card shows a prompt on the front and the answer on the back when clicked
            ['Is the OS a process?', 'It depends on the design. The three standard answers: a nonprocess kernel, execution within user processes, and a process-based OS.'],  // card 1: is the OS a process? It depends on the design
            ['Nonprocess kernel', 'The kernel runs outside every process, with its own memory and system stack; only user programs are processes. On a supervisor call the caller’s context is saved, then the kernel resumes it or dispatches another.'],  // card 2: the nonprocess kernel in two sentences
            ['Execution within user processes', 'OS routines run inside the calling process in kernel mode. Each image adds a kernel stack and the shared address space: one physical copy of the OS.'],  // card 3: execution within user processes and what each image gains
            ['Mode switch, not process switch', 'In design 2 a system call only changes the mode; the same process keeps running. If a switch is needed, a small routine may run outside all processes.'],  // card 4: in design 2 a system call is a mode switch, not a process switch
            ['Process-based OS', 'OS functions are system processes. Gains: modularity, noncritical jobs at their own priority, services on dedicated processors. Price: process switches.'],  // card 5: the process-based OS, its gains and its price
            ['So which design wins?', 'None outright. Designs 1 and 2 serve a request without a process switch; design 3 pays process switches for modularity and flexibility on many processors. Real systems mix them.'],  // card 6: no design wins outright; real systems mix them
          ], { cols: ctx.narrow ? 1 : 3, height: ctx.narrow ? 130 : 172 });  // one column of shorter cards on a phone-width screen, three columns of taller cards otherwise
          el.append(h('div', { class: 'stack fill' },  // lays out step 8 as one column filling the step
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. The strip below is the whole section in one picture.'),  // opening line: say each answer before flipping, and the strip below sums up the section
            cards,  // the flip cards
            h('div', { class: 'grid-3', style: { marginTop: 'auto' } }, ...DESIGNS.map((d, i) => h('div', { class: 'card tight row nw', style: { gap: '12px' } },  // a row of three small cards pinned to the bottom, one per design
              h('div', { style: { width: '150px', flex: 'none' } }, sketch(ctx, d.n)),  // the design's sketch, kept at a fixed width
              h('div', { class: 'small', html: `<b>${d.n} · ${d.name}</b><br><span class="muted">${['OS outside every process', 'OS inside the caller, in kernel mode', 'OS functions as processes'][i]}</span>` }))))));  // the design's number and name, with a one-line reminder of where its OS code runs; the brackets close the layout
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Check yourself ---------------- */
      {  // step 9 (Check Yourself): the section quiz, drawn by the guide from the questions below
        title: 'Check yourself',  // the title shown at the top of step 9
        kind: 'check',  // kind "check" labels it as the quiz step
        quiz: [  // the quiz questions; the guide builds the question screens, checks answers and saves progress
          { q: 'In a <b>nonprocess kernel</b>, what happens when the running process issues a supervisor call?',  // quiz question 1 (multiple choice): what happens on a supervisor call in a nonprocess kernel
            choices: ['The OS creates a new process to handle the call, and the dispatcher schedules that process.',  // wrong choice: describes a process-based OS, where a new process would handle the call
              'The kernel’s code runs inside the calling process, on that process’s own kernel stack.',  // wrong choice: describes design 2, where OS code runs inside the caller
              'The process’s context is saved and the kernel takes over, outside any process, on its system stack.',  // right choice: the context is saved and the kernel takes over outside any process, on its system stack
              'The call waits in the Ready queue until the kernel’s turn on the processor comes round.'],  // wrong choice: treats the kernel as if it waited in the Ready queue
            answer: 2,  // the right answer is choice 2 (counting from 0)
            feedback: ['That describes a process-based OS, where services are processes. A nonprocess kernel is not a process at all.',  // feedback for wrong choice 0: that design turns services into processes
              'That is the “execution within user processes” design, where OS routines run inside the caller.',  // feedback for wrong choice 1: that is execution within user processes
              null,  // no feedback needed for the right choice
              'The kernel is never scheduled like a process. It takes control at once, through the mode switch.'],  // feedback for wrong choice 3: the kernel is never scheduled, it takes over through the mode switch
            why: 'In the nonprocess design the OS is a separate entity running in kernel mode, with its own memory region and system stack. The idea of a process applies only to user programs.' },  // explanation shown after answering: the nonprocess kernel's own memory and stack, and processes only for user programs
          { q: 'When the OS executes within user processes, why does each process image contain its own <b>kernel stack</b>, separate from its user stack?',  // quiz question 2 (multiple choice): why each process image has its own kernel stack in design 2
            choices: ['It holds that process’s private copy of the OS code, so that processes cannot interfere with each other’s OS.',  // wrong choice: claims the kernel stack holds a private copy of the OS code
              'It gives kernel-mode calls a stack the user program cannot touch, and a system call that must wait can leave its half-finished kernel work there while other processes run.',  // right choice: a stack the user program cannot touch, where a waiting system call can leave its work
              'It stores the process control block while the process is running, and the user stack stores it while the process is waiting.',  // wrong choice: mixes up the kernel stack with where the PCB is kept
              'It lets a system call run without any mode switch, because the kernel stack is already in kernel mode.'],  // wrong choice: claims a kernel stack removes the need for a mode switch
            answer: 1,  // the right answer is choice 1
            feedback: ['There is only one copy of the OS code, in the shared address space that every process maps. A kernel stack holds call frames, not code.',  // feedback for choice 0: there is only one copy of the OS code; stacks hold call frames
              null,  // no feedback needed for the right choice
              'The PCB is a separate part of the image, kept by the OS whether or not the process is running. Neither stack stores it.',  // feedback for choice 2: the PCB is a separate part of the image
              'Every entry into the OS still needs a mode switch into kernel mode; the kernel stack is simply where the OS routine’s calls are recorded once it is there.'],  // feedback for choice 3: every entry into the OS still needs a mode switch
            why: 'OS routines run inside the process, so their calls need a stack. Keeping it apart from the user stack protects the kernel’s frames, and because every process has one, the OS can pause a system call halfway (the process is Blocked) and resume it later from exactly that point.' },  // explanation shown after answering: protection, and pausing a system call halfway
          { type: 'multi', q: 'When the OS executes within user processes, which of these belong to each process image? Select all that apply.',  // quiz question 3 (select all): which parts belong to each process image in design 2
            choices: ['Process control block', 'User stack', 'Private user address space (program and data)', 'Kernel stack', 'Shared address space holding OS code and data', 'A private copy of all the OS code, stored separately for that process'],  // the choices: five real parts and one trap, a private copy of all the OS code
            answer: [0, 1, 2, 3, 4],  // the right answers are the first five
            why: 'Each image has a PCB, a user stack, its private program and data, a kernel stack for kernel-mode calls, and the shared address space. That shared region leads to one physical copy of the OS, so the OS code is never duplicated.' },  // explanation: one physical copy of the OS is shared, so the code is never duplicated
          { type: 'bucket', q: 'Sort each feature into the design it describes.', buckets: ['Separate kernel', 'Inside user processes', 'OS as processes'],  // quiz question 4 (sort into buckets): match each feature to one of the three designs
            items: [['Only user programs are processes', 0], ['A kernel stack in every process', 1],  // items: processes only for user programs (design 1); a kernel stack in every process (design 2)
              ['OS code mapped into every process’s address space', 1], ['Kernel functions are processes', 2],  // items: OS code mapped into every address space (design 2); kernel functions as processes (design 3)
              ['A usage monitor as a process', 2]],  // item: a usage monitor as a process (design 3)
            why: 'Design 1 keeps the kernel outside every process. Design 2 runs OS routines inside each process, so each image carries a kernel stack and the shared region. Design 3 turns OS functions into processes, which also suits noncritical jobs like monitoring.' },  // explanation: where each design puts the OS
          { type: 'num', q: 'A process-based OS handles 40,000 service requests per second. Each request costs 2 mode switches and 2 process switches. A mode switch takes 0.5 µs and a process switch takes 4 µs. How many <b>milliseconds</b> of processor time per second go to switching?',  // quiz question 5 (number): switching time per second for a process-based OS at 40,000 requests per second
            answer: 360, tol: 1, unit: 'ms',  // the answer is 360 ms, accepted within 1 ms
            why: 'Per request: 2 × 0.5 + 2 × 4 = 9 µs. Then 40,000 × 9 µs = 360,000 µs = 360 ms, over a third of one processor.' },  // worked explanation: 9 µs per request times 40,000 requests
          { type: 'num', q: 'An OS that executes within user processes handles 40,000 quick service requests per second. Each costs 2 mode switches of 0.5 µs and no process switch. How many <b>milliseconds</b> of processor time per second go to switching?',  // quiz question 6 (number): the same load in design 2, with only mode switches
            answer: 40, tol: 0.5, unit: 'ms',  // the answer is 40 ms, accepted within 0.5 ms
            why: 'Per request: 2 × 0.5 = 1 µs. Then 40,000 × 1 µs = 40,000 µs = 40 ms, about 4% of one processor.' },  // worked explanation: 1 µs per request times 40,000 requests
          { q: 'Which of these is <b>not</b> an advantage of building the OS as a collection of system processes?',  // quiz question 7 (multiple choice): which is not an advantage of a process-based OS
            choices: ['It encourages a modular design with small, clean interfaces between parts.',  // a real advantage: modular design with small interfaces
              'Noncritical functions, such as a resource-usage monitor, can run as processes at their own priority.',  // a real advantage: noncritical functions at their own priority
              'Some OS services can be moved onto dedicated processors of a multiprocessor.',  // a real advantage: services on dedicated processors
              'Each request for an OS service becomes cheaper, because no process switch is needed to reach it.'],  // the false one and so the right answer: requests do not get cheaper, they cost process switches
            answer: 3,  // the right answer is choice 3
            feedback: ['This is a genuine advantage: separate processes can only talk through defined interfaces.',  // feedback for choice 0: modularity is a genuine advantage
              'This is a genuine advantage: as a process, the monitor is scheduled and interleaved like any other.',  // feedback for choice 1: the monitor is scheduled like any other process; choice 2 gets its own line below
              'This is a genuine advantage: a service process can live on its own processor, which improves performance.', null],  // feedback for choice 2: a service process can have its own processor; no feedback for the right choice
            why: 'The opposite is true. Reaching a service that lives in another process costs process switches, which is the main overhead of this design.' },  // explanation: reaching a service in another process costs process switches
          { type: 'order', q: 'Put these events in order for a quick system call when the OS executes within user processes.',  // quiz question 8 (put in order): the steps of a quick system call in design 2
            items: ['P1 runs its program in user mode', 'P1 executes the system-call instruction', 'The processor switches to kernel mode (a mode switch)', 'The OS routine runs inside P1, using P1’s kernel stack', 'The processor returns to user mode and P1 continues'],  // the five steps, listed here in the right order; the quiz shuffles them
            why: 'The call enters kernel mode, the OS routine runs in the context of P1 on its kernel stack, and a second mode switch returns to P1’s program. No process switch occurs.' },  // explanation: two mode switches and no process switch
          { type: 'match', q: 'Match each stack to the moment it is in use.',  // quiz question 9 (match pairs): which stack is in use at which moment
            pairs: [['User stack', 'A process is running its own program in user mode'], ['Kernel stack', 'A process is running an OS routine in kernel mode'],  // pairs: user stack with running the program; kernel stack with running an OS routine
              ['The kernel’s own system stack', 'A nonprocess kernel is working outside every process'], ['A system process’s stack', 'An OS function packaged as its own process is running']],  // pairs: the kernel's system stack with a nonprocess kernel at work; a system process's stack with an OS function running as a process
            why: 'Design 1 keeps one system stack for the kernel. Design 2 gives every process a user stack and a kernel stack. In design 3 each system process has a stack of its own, like any process.' },  // explanation: the stacks each design uses
          { type: 'tf', q: 'When the OS executes within user processes, a user program can change the OS code, because that code is mapped into its address space.', answer: false,  // quiz question 10 (true or false): can a user program change OS code mapped into its address space? False
            why: 'The shared address space can be used only in kernel mode. In user mode the hardware blocks every access, so the OS is protected even though it appears in every address space.' },  // explanation: the shared region is usable only in kernel mode
          { type: 'tf', q: 'When the OS executes within user processes and a process switch turns out to be necessary, the small routine that performs the switch may run outside all processes.', answer: true,  // quiz question 11 (true or false): the switching routine may run outside all processes in design 2
            why: 'Depending on the system, the switching routine may or may not start in the current process. But while it takes the processor from one process and gives it to another it belongs to neither, so it is most natural to view it as running outside all processes.' },  // explanation: while it hands the processor over, the switching routine belongs to neither process; the answer is true
          { type: 'multi', q: 'Which statements about a mode switch are true? Select all that apply.',  // quiz question 12 (select all): which statements about a mode switch are true
            choices: ['It changes the processor between user mode and kernel mode.', 'The same process remains the running process.', 'It requires switching the memory map to another process’s memory.', 'It costs much less than a process switch.'],  // the choices: it changes the mode, the same process keeps running, it changes the memory map (false), it is cheap
            answer: [0, 1, 3],  // the right answers are choices 0, 1 and 3
            why: 'A mode switch flips the processor’s mode and saves a little state. Changing the memory map belongs to a process switch, which is why a process switch costs so much more.' },  // explanation: changing the memory map belongs to a process switch, which is why that costs more
        ],  // ends the quiz questions
      },  // ends step 9

    ],  // ends the list of steps
    notes: `${/* the section notes start here: a plain summary the student can open from the Notes button at any time */''}
<h3>The puzzle: is the operating system a process?</h3>${/* notes heading: the puzzle of whether the OS is a process */''}
<p>The OS is software: the processor fetches and executes its instructions just as it does a user program’s. Yet the OS also manages processes: it creates, schedules and switches them. So where does OS code run, and is the OS itself a process? Three standard designs give different answers:</p>${/* notes paragraph: the OS is run like any program yet manages processes; three designs answer where it runs */''}
<ol>${/* start of the numbered list of the three designs */''}
<li><b>Nonprocess kernel</b>: the kernel runs outside every process.</li>${/* list item: design 1, the nonprocess kernel */''}
<li><b>Execution within user processes</b>: OS routines run inside whichever user process needs them.</li>${/* list item: design 2, execution within user processes */''}
<li><b>Process-based OS</b>: the OS itself is built from system processes.</li>${/* list item: design 3, the process-based OS */''}
</ol>${/* end of the numbered list */''}
<p>Analogy (an apartment building): the staff work from a basement office (1), work inside your apartment from a locked service closet that every apartment has (2), or are specialists in offices of their own that you send requests to (3).</p>${/* notes paragraph: the apartment-building analogy for all three designs */''}

<h3>Design 1: the nonprocess kernel</h3>${/* notes heading for design 1, the nonprocess kernel */''}
<p>The traditional approach, used by many older operating systems. The kernel runs <b>outside of any process</b>, as a separate entity in privileged (kernel) mode, with its <b>own region of memory</b> and its <b>own system stack</b> for procedure calls and returns. The idea of a process applies <b>only to user programs</b>: the kernel has no PCB, no state and is never scheduled.</p>${/* notes paragraph: the kernel runs outside every process with its own memory and system stack */''}
<p>On an interrupt, a trap or a supervisor call, the processor switches to kernel mode (a mode switch), the running process’s context is saved, and control passes to the kernel. The process is still in the Running state: a mode switch changes no process’s state. Then:</p>${/* notes paragraph: what happens on an interrupt, trap or supervisor call; the process stays Running */''}
<ul>${/* start of the list of the two outcomes */''}
<li><b>Service finishes at once</b> (data already in memory): the kernel does the work and restores the same process. Cost: 2 mode switches, 0 process switches.</li>${/* list item: the service finishes at once, costing 2 mode switches and no process switch */''}
<li><b>Process must wait</b> (data must come from disk): the kernel starts the I/O, marks the process Blocked, and its dispatcher loads the context of a Ready process. Cost: 2 mode switches, 1 process switch.</li>${/* list item: the process must wait, costing 2 mode switches and 1 process switch */''}
</ul>${/* end of the outcomes list */''}
<p>Because one system stack serves every request, the kernel cannot leave a waiting request’s half-done work on it. That progress is recorded in kernel tables instead (the process table, the device’s request list).</p>${/* notes paragraph: one shared system stack means waiting work is recorded in kernel tables */''}

<h3>Design 2: execution within user processes</h3>${/* notes heading for design 2, execution within user processes */''}
<p>Common on smaller machines such as PCs and workstations. Virtually all OS software runs <b>in the context of a user process</b>: the OS is a collection of routines that programs call, and each routine runs within the calling process, in kernel mode. Each process image therefore contains:</p>${/* notes paragraph: OS routines run in the context of the calling process; the table below lists each image's parts */''}
<table>${/* start of the table of process-image parts */''}
<tr><th>Part</th><th>What it holds, and when it is used</th></tr>${/* table header row: the part, and what it holds and when it is used */''}
<tr><td>Process control block</td><td>Identification, processor state, process control information. Touched only by OS code in kernel mode.</td></tr>${/* table row: the process control block */''}
<tr><td>User stack</td><td>Frames of the program’s own calls, in user mode.</td></tr>${/* table row: the user stack */''}
<tr><td>Private user address space</td><td>The process’s own program and data; no other process can reach it.</td></tr>${/* table row: the private user address space */''}
<tr><td>Kernel stack</td><td>Frames of OS calls made in kernel mode, kept apart from the user stack so the program cannot touch them. A system call that must wait leaves its unfinished work here.</td></tr>${/* table row: the kernel stack and the unfinished work it can hold */''}
<tr><td>Shared address space</td><td>OS code and data, present in every address space but mapped to <b>one</b> physical copy. Usable only in kernel mode, so user programs cannot tamper with it.</td></tr>${/* table row: the shared address space, one physical copy of the OS */''}
</table>${/* end of the parts table */''}
<p>An interrupt, trap or supervisor call causes a <b>mode switch, not a process switch</b>: the same process stays Running, now executing OS code. If the OS then lets the process continue, another mode switch resumes it (quick request: 2 mode, 0 process switches). If a process switch is needed, control passes to a small process-switching routine. It may or may not start in the current process, but while it hands the processor over it is best viewed as running <b>outside all processes</b> (request that must wait: 2 mode, 1 process switch).</p>${/* notes paragraph: a mode switch, not a process switch, and where the switching routine runs when a switch is needed */''}
<h3>Why a mode switch is cheap</h3>${/* notes heading: why a mode switch is cheap */''}
<p>A mode switch flips the mode bit, saves a few registers and changes stacks; no process changes state. A process switch saves a whole context, updates PCBs and queues and changes the memory map, and the new process starts with caches full of the old one’s data.</p>${/* notes paragraph: what a mode switch does compared with a process switch */''}
<p><b>Cost model:</b> switching time per second = requests per second × (switches per request × time per switch).</p>${/* notes paragraph: the cost model, requests per second times the cost of each request's switches */''}
<p><i>Worked example</i> (illustrative prices): 50,000 requests/s, mode switch 0.2 µs, process switch 3 µs.</p>${/* notes paragraph: the numbers used in the worked example */''}
<ul>${/* start of the worked example's list */''}
<li>Designs 1 and 2: 50,000 × (2 × 0.2) µs = 20,000 µs = <b>20 ms per second</b> (2% of one processor).</li>${/* list item: designs 1 and 2 spend 20 ms of every second switching */''}
<li>Design 3: 50,000 × (2 × 0.2 + 2 × 3) µs = 320,000 µs = <b>320 ms per second</b> (32%).</li>${/* list item: design 3 spends 320 ms of every second switching */''}
</ul>${/* end of the worked example's list */''}
<p>Designs 1 and 2 tie on switch count; they differ in where a waiting request’s progress lives (kernel tables versus the caller’s kernel stack).</p>${/* notes paragraph: designs 1 and 2 differ in where waiting work lives, not in switch count */''}

<h3>Design 3: the process-based operating system</h3>${/* notes heading for design 3, the process-based OS */''}
<p>The OS is a <b>collection of system processes</b>. Major kernel functions (file system, memory manager, I/O manager and so on) are separate processes that run in kernel mode and are scheduled by the dispatcher like any other process. Only a <b>small amount of process-switching code</b> runs outside all processes. Advantages:</p>${/* notes paragraph: OS functions become system processes; only the switching code runs outside them */''}
<ol>${/* start of the numbered list of advantages */''}
<li><b>Modular design</b>: each function lives in its own process, with minimal, clean interfaces to the rest.</li>${/* list item: modular design with clean interfaces */''}
<li><b>Noncritical functions</b> fit neatly as processes, e.g. a monitor that records how busy the processor, memory and I/O channels are and how fast user processes progress. No process requests a service from it, so as a process it runs at its own priority, interleaved with other work by the dispatcher.</li>${/* list item: noncritical jobs such as a usage monitor fit as processes */''}
<li><b>Multiprocessor and multicomputer fit</b>: some OS services can be moved to dedicated processors (or machines), improving performance.</li>${/* list item: services can run on dedicated processors or machines */''}
</ol>${/* end of the advantages list */''}
<p>The price: reaching a service in another process costs process switches. A quick request costs 2 mode + 2 process switches; a request that must wait also costs 2 before another user process runs, and more when the I/O completes.</p>${/* notes paragraph: the price, process switches on every service request */''}

<h3>Side by side</h3>${/* notes heading for the side-by-side comparison */''}
<table>${/* start of the comparison table */''}
<tr><th></th><th>Nonprocess kernel</th><th>Within user processes</th><th>Process-based OS</th></tr>${/* table header row: one column per design */''}
<tr><td>Where OS code runs</td><td>Outside every process</td><td>Inside the calling process</td><td>In system processes</td></tr>${/* table row: where the OS code runs */''}
<tr><td>Stacks the OS uses</td><td>One system stack</td><td>A kernel stack per process</td><td>Each system process’s own stack</td></tr>${/* table row: which stacks the OS uses */''}
<tr><td>Quick request</td><td>2 mode, 0 process</td><td>2 mode, 0 process</td><td>2 mode, 2 process</td></tr>${/* table row: switch counts for a quick request */''}
<tr><td>Request that must wait</td><td>2 mode, 1 process</td><td>2 mode, 1 process</td><td>2 mode, 2 process</td></tr>${/* table row: switch counts for a request that must wait */''}
<tr><td>Waiting request’s progress</td><td>Kernel tables</td><td>Caller’s kernel stack</td><td>Inside the service process</td></tr>${/* table row: where a waiting request's progress is kept */''}
<tr><td>Modularity</td><td>Up to the designers</td><td>Up to the designers</td><td>Enforced by process boundaries</td></tr>${/* table row: modularity */''}
<tr><td>Protecting OS code</td><td>Separate kernel memory, kernel mode only</td><td>Shared region, locked outside kernel mode</td><td>Kernel mode; parts in separate address spaces</td></tr>${/* table row: how the OS code is protected */''}
<tr><td>Many processors</td><td>Runs on whichever processor entered it</td><td>Runs on the caller’s processor</td><td>Services can get dedicated processors</td></tr>${/* table row: how each design uses many processors */''}
</table>${/* end of the comparison table */''}
<p>No design wins every row: switch overhead trades against modularity and flexibility. Real systems mix designs; UNIX (next section) runs most OS code inside user processes and also keeps a few system processes for background work.</p>${/* notes paragraph: no design wins every row, and real systems mix them */''}
    `,  // end of the notes text
  });  // closes the object passed to Guide.section
})();  // ends the wrapper function and runs it straight away
