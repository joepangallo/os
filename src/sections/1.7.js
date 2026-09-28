// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 1.7  Direct Memory Access
   The three I/O techniques (programmed I/O, interrupt-driven I/O, DMA),
   the two drawbacks shared by the first two, what the processor hands a
   DMA module, how the block moves without the processor, and cycle
   stealing on the system bus.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ------------------------------------------------------------------
     Shared timing model used by the interrupt timeline, the drawbacks
     explorer and the race. One tick = one instruction time = one bus cycle.
       Programmed I/O, per word: 1 command + D status checks + 2 (read, store)
       Interrupt-driven, per word: save 4 + move 2 + next command 1 + restore 4
       DMA, per block: 4 setup + one stolen cycle per word + completion
                       interrupt (save 4 + 2 bookkeeping + restore 4)
     D = how many ticks the device needs to produce one word.
     ------------------------------------------------------------------ */
  const KIND = {  // KIND: the on-screen name for each kind of processor time; the timeline colours and legends use these labels
    free: 'Other program (useful)',  // "free": the processor runs some other program, which is the useful time every technique tries to maximise
    poll: 'Busy waiting',  // "poll": the processor keeps asking the device "are you ready yet?" and gets nothing else done
    cmd: 'Commands / setup',  // "cmd": the processor issues an I/O command or sets up the DMA module
    move: 'Moving a word',  // "move": the processor itself copies one word from the I/O module into memory
    ctx: 'Save / restore context',  // "ctx": saving or restoring the interrupted program's registers (its context) around an interrupt
    stolen: 'Paused: stolen cycle',  // "stolen": the processor is paused for one bus cycle while the DMA module uses the bus
  };  // closes the KIND labels table
  function simulate(tech, N, D) {  // simulate(tech, N, D): builds a tick-by-tick record of what the processor does while N words move, D ticks per word
    const acts = [], stores = [], ints = [];  // acts gets one kind name per tick; stores records the tick each word lands in memory; ints records each interrupt tick
    const put = (k, n) => { for (let j = 0; j < n; j++) acts.push(k); };  // put(k, n): small helper that appends n ticks of kind k to the record
    if (tech === 'pio') {  // programmed I/O ("pio"): the processor handles every word itself and never does anything else
      for (let w = 0; w < N; w++) { put('cmd', 1); put('poll', D); put('move', 2); stores.push(acts.length); }  // per word: 1 tick for the command, D ticks of busy waiting, 2 ticks to read and store; then note when it landed
    } else if (tech === 'int') {  // interrupt-driven I/O ("int"): the processor works on something else until the module interrupts
      put('cmd', 1);  // the processor issues the first read command (1 tick) and then leaves
      let ready = 1 + D;  // ready is the tick when the device will have the first word: after the command plus D ticks of device time
      for (let w = 0; w < N; w++) {  // one pass per word, each ending with an interrupt handled by the processor
        if (acts.length < ready) put('free', ready - acts.length);  // until the device is ready, the processor runs the other program (free ticks)
        ints.push(acts.length);  // the module interrupts at this tick; the tick number is saved so the timeline can draw a marker there
        put('ctx', 4); put('move', 2); stores.push(acts.length);  // 4 ticks to save the context, 2 ticks to move the word through the processor, then the word counts as stored
        if (w < N - 1) { put('cmd', 1); ready = acts.length + D; }  // for every word but the last: issue the next command (1 tick) and work out when that word will be ready
        put('ctx', 4);  // 4 ticks to restore the context so the interrupted program can carry on
      }  // ends the per-word interrupt loop
    } else {  // otherwise the technique is DMA: the processor only sets up the transfer and handles one interrupt at the end
      put('cmd', 4);  // 4 ticks for the processor to hand the DMA module its instructions (the setup)
      const t0 = acts.length;  // t0 remembers the tick when setup ended, which is when the device starts producing words
      for (let w = 0; w < N; w++) {  // walks through the block one word at a time
        const r = t0 + (w + 1) * D;  // r is the tick when word w is ready: the device produces one word every D ticks after setup
        if (acts.length < r) put('free', r - acts.length);  // while that word is not ready yet, the processor keeps running the other program
        put('stolen', 1); stores.push(acts.length);  // the DMA module steals 1 bus cycle to write the word to memory; the processor pauses for that single tick
      }  // ends the per-word DMA loop
      ints.push(acts.length);  // once the whole block is in memory, the DMA module sends its single completion interrupt
      put('ctx', 4); put('cmd', 2); put('ctx', 4);  // the processor saves context (4 ticks), does 2 ticks of bookkeeping, and restores context (4 ticks)
    }  // ends the three-way choice of technique
    const cnt = (k) => acts.reduce((n, a) => n + (a === k ? 1 : 0), 0);  // cnt(k): counts how many ticks in the record are of kind k
    const free = cnt('free'), stolen = cnt('stolen');  // free = useful ticks spent on the other program; stolen = ticks lost to DMA bus cycles
    return { tech, N, D, acts, stores, ints, end: acts.length, free, stolen, io: acts.length - free - stolen, through: tech === 'dma' ? 0 : N };  // returns the record plus totals: end = last tick, io = ticks spent on I/O work, through = words that pass through the processor
  }  // ends simulate()
  /* merge consecutive ticks of the same kind into segments, up to tick `cut` */
  function segsOf(acts, cut) {  // segsOf(acts, cut): turns runs of identical ticks into bars (start a, end b, kind k) so each run is drawn as one rectangle
    const out = []; const n = Math.min(cut == null ? acts.length : cut, acts.length);  // out collects the bars; n is how many ticks to use, stopping at cut when an animation has only reached part of the way
    for (let t = 0; t < n; t++) {  // looks at every tick in turn
      const last = out[out.length - 1];  // last is the bar currently being built, if there is one
      if (last && last.k === acts[t] && last.b === t) last.b = t + 1; else out.push({ a: t, b: t + 1, k: acts[t] });  // if this tick continues the same kind, stretch the current bar by one tick; otherwise start a new one-tick bar
    }  // ends the loop over ticks
    return out;  // hands back the list of bars
  }  // ends segsOf()
  function timelineNodes(ctx, acts, o) {  // timelineNodes(ctx, acts, o): makes the SVG (the browser's drawing format) shapes for one timeline strip; o holds position, size and options
    const { s } = ctx, sc = o.w / o.tMax, nodes = [];  // s builds SVG elements; sc converts ticks to drawing units (strip width divided by the longest run); nodes collects the shapes
    nodes.push(s('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: 5, class: 's-panel', 'stroke-width': 1 }));  // background rectangle for the whole strip, with slightly rounded corners
    segsOf(acts, o.cut).forEach((g) => nodes.push(s('rect', { x: o.x + g.a * sc, y: o.y, width: Math.max(1, (g.b - g.a) * sc), height: o.h, class: 'k-' + g.k, 'stroke-width': 1 })));  // one coloured rectangle per bar; the class k-kind picks its colour, and each bar is at least 1 unit wide so it never vanishes
    (o.marks || []).filter((t) => o.cut == null || t <= o.cut).forEach((t) => nodes.push(s('path', { d: `M${o.x + t * sc - 5},${o.y - 9} l10,0 l-5,8 z`, style: 'fill:var(--intr)' })));  // a small downward triangle above the strip at each interrupt tick, in the interrupt colour, hidden until the animation reaches it
    if (o.cursor != null) nodes.push(s('line', { x1: o.x + o.cursor * sc, y1: o.y - 3, x2: o.x + o.cursor * sc, y2: o.y + o.h + 3, style: 'stroke:var(--ink);stroke-width:2' }));  // when a cursor tick is given, a dark vertical line shows how far the animation has run
    return nodes;  // hands the shapes back to the caller, which places them in its drawing
  }  // ends timelineNodes()
  function keyRow(ctx, kinds) {  // keyRow(ctx, kinds): builds the colour legend under a timeline, one swatch plus label for each kind listed
    return ctx.h('div', { class: 'row', style: { gap: '4px 14px' } }, ...kinds.map((k) => ctx.h('span', { class: 'key', html: `<i class="k-${k}"></i>${KIND[k]}` })));  // a flexible row of legend entries: a small box coloured by class k-kind, followed by that kind's KIND label
  }  // ends keyRow()

  /* ------------------------------------------------------------------
     The bus diagram shared by several steps. Wide screens: viewBox 620 x 276,
     processor and memory above the system bus, the device, its I/O or DMA
     module and a small note box below it. Phones: viewBox 360 x 372, memory
     on top, processor + note in the middle, so labels stay readable.
     ------------------------------------------------------------------ */
  function geo(narrow) {  // geo(): returns every position and size in the bus diagram; its argument is true on phone-width screens
    if (!narrow) return { W: 620, H: 276, busY: 142, busX2: 608, lbl: [606, 132],  // wide-screen layout: a 620 by 276 drawing with the system bus running across at height 142
      cpu: { x: 12, y: 10, w: 200, h: 104 }, mem: { x: 232, y: 10, w: 376, h: 104, cy: 32, ch: 34, ly: [84, 98] },  // processor box at top left and memory box to its right; cy, ch and ly place the memory cells and their address labels
      dev: { x: 12, y: 168, w: 108, h: 100 }, mod: { x: 164, y: 168, w: 312, h: 100 }, note: { x: 488, y: 168, w: 120, h: 100 },  // device box, its I/O or DMA module, and the small note box, side by side in the bottom row below the bus
      cX: 112, mX: 420, dX: 320, iX: 196, intLbl: [204, 162], devY: 218,  // where the processor (cX), memory (mX) and module (dX) join the bus, the interrupt line (iX) and the device wire height
      dma: { l1: 12, b1: 86, w1: 74, l2: 172, b2: 228, w2: 74 }, io: { lamp: 154, bx: 146 } };  // where the DMA module draws its labels and register boxes, and where the I/O module draws its lamp and data box
    return { W: 360, H: 372, busY: 240, busX2: 352, lbl: [352, 232],  // phone-width layout: a taller 360 by 372 drawing with the bus lower down, at height 240
      cpu: { x: 8, y: 116, w: 200, h: 104 }, mem: { x: 8, y: 8, w: 344, h: 96, cy: 28, ch: 30, ly: [74, 88] },  // on small screens memory spans the top and the processor sits underneath it, so neither label gets squeezed
      dev: { x: 8, y: 264, w: 84, h: 100 }, mod: { x: 118, y: 264, w: 234, h: 100 }, note: { x: 218, y: 116, w: 134, h: 104 },  // device, module and note boxes for small screens; the note shares the processor's row instead of the bottom row
      cX: 108, mX: 213, dX: 300, iX: 180, intLbl: [186, 258], devY: 314,  // bus join points, interrupt line, label position and device wire height for the small-screen drawing
      dma: { l1: 10, b1: 76, w1: 58, l2: 140, b2: 186, w2: 44 }, io: { lamp: 128, bx: 126 } };  // DMA register and I/O lamp and data box positions, tightened for the small-screen drawing
  }  // ends geo()
  function pathsOf(G) {  // pathsOf(G): works out the routes that highlighted paths and moving tokens follow along the wires, using geo()'s numbers
    const cpuB = G.cpu.y + G.cpu.h, memB = G.mem.y + G.mem.h, modT = G.mod.y, by = G.busY;  // handy numbers: bottom edge of the processor, bottom edge of memory, top edge of the module, and the bus height
    const P = {  // P holds each route as a list of corner points, from where it starts to where it ends
      cmd: [[G.cX, cpuB], [G.cX, by], [G.dX, by], [G.dX, modT]],          // processor → module
      toMem: [[G.cX, cpuB], [G.cX, by], [G.mX, by], [G.mX, memB]],        // processor → memory
      ctlToMem: [[G.dX, modT], [G.dX, by], [G.mX, by], [G.mX, memB]],     // module → memory (DMA read)
      dev: [[G.dev.x + G.dev.w, G.devY], [G.mod.x, G.devY]],              // device → module
    };  // closes the table of basic routes
    P.toCpu = P.cmd.slice().reverse();          // module → processor
    P.memToCtl = P.ctlToMem.slice().reverse();  // memory → module (DMA write)
    P.toDev = P.dev.slice().reverse();          // module → device
    return P;  // hands the finished set of routes to the caller
  }  // ends pathsOf()
  function along(pts, f) {  // along(pts, f): finds the point a fraction f (0 = start, 1 = end) of the way along a route, so a token can slide along it
    const segs = []; let total = 0;  // segs will hold the length of each straight piece of the route; total is the length of the whole route
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(L); total += L; }  // measures each straight piece with Math.hypot (the straight-line distance) and adds it to the total
    let d = Math.max(0, Math.min(1, f)) * total;  // d is how far along the route to go, in drawing units; f is clamped to 0-1 first so the token never leaves the wire
    for (let i = 0; i < segs.length; i++) {  // walks through the straight pieces in order
      if (d <= segs[i] || i === segs.length - 1) { const r = segs[i] ? Math.min(1, d / segs[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r]; }  // if the target distance falls inside this piece (or it is the last one), return the matching point on it
      d -= segs[i];  // otherwise skip past this piece and keep the leftover distance for the next one
    }  // ends the loop over pieces
    return pts[pts.length - 1];  // fallback: the end of the route
  }  // ends along()
  function arrowHead(ctx, p, q, col) {  // arrowHead(ctx, p, q, col): draws a filled triangle at point q pointing in the direction from p to q, in colour col
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]), L = 12, W = 7;  // a is the direction angle of the last piece; L is the arrow's length and W its half-width, in drawing units
    const bx = q[0] - Math.cos(a) * L, by = q[1] - Math.sin(a) * L;  // (bx, by) is the middle of the arrow's back edge, L units back from the tip
    const pts = [q, [bx - Math.sin(a) * W, by + Math.cos(a) * W], [bx + Math.sin(a) * W, by - Math.cos(a) * W]];  // the three corners: the tip, and two points either side of the back edge, at right angles to the direction
    return ctx.s('polygon', { points: pts.map((x) => x.join(',')).join(' '), style: 'fill:var(--' + col + ')' });  // returns an SVG polygon through those corners, filled with the named colour from the page's colour variables
  }  // ends arrowHead()
  function busNodes(ctx, st) {  // busNodes(ctx, st): draws the whole bus diagram for one moment; st describes what to show (values, highlights, arrows)
    const { s } = ctx, G = geo(ctx.narrow), PATHS = pathsOf(G);  // s builds SVG shapes; G is the layout from geo() for this screen width; PATHS are the wire routes from pathsOf()
    const { cpu, mem: M, dev, mod, note } = G, by = G.busY, cpuB = cpu.y + cpu.h, memB = M.y + M.h;  // unpacks the boxes from the layout and notes the bus height and the bottom edges of the processor and memory
    const g = [];  // g collects every shape; the caller puts them into the drawing
    const txt = (x, y, str, cls, style) => s('text', { x, y, class: cls || '', style: style || null }, String(str));  // txt(): helper that makes one SVG text label at (x, y) with optional classes and inline style
    const tone = (t) => 'fill:var(--' + (t || 'ink') + ')';  // tone(): builds a fill style from a colour name such as "intr" or "ok", defaulting to the normal ink colour
    /* bus, connectors, interrupt line */
    g.push(s('line', { x1: 12, y1: by, x2: G.busX2, y2: by, class: 'bus' }));  // the system bus: one thick horizontal line across the drawing
    g.push(txt(G.lbl[0], G.lbl[1], 'system bus', 't13 end s-sub'));  // the "system bus" label at the right-hand end, just above the line
    [[G.cX, cpuB], [G.dX, mod.y], [G.mX, memB]].forEach(([x, y]) => g.push(s('line', { x1: x, y1: y, x2: x, y2: by, class: 'conn' })));  // short vertical connectors from the processor, the module and memory down or up to the bus
    g.push(s('line', { x1: dev.x + dev.w, y1: G.devY, x2: mod.x, y2: G.devY, class: 'conn' }));  // the wire between the device and its module
    g.push(s('line', { x1: G.iX, y1: mod.y, x2: G.iX, y2: cpuB + 4, class: 'intl' + (st.intr ? ' on' : '') }));  // the interrupt line from the module up to the processor; it lights up (class "on") when st.intr is set
    if (st.intr) { g.push(arrowHead(ctx, [G.iX, by - 2], [G.iX, cpuB + 1], 'intr')); g.push(txt(G.intLbl[0], G.intLbl[1], 'INTERRUPT', 't13 b', tone('intr'))); }  // when an interrupt is signalled: an arrowhead pointing into the processor and a bold INTERRUPT label
    /* processor */
    g.push(s('rect', { x: cpu.x, y: cpu.y, width: cpu.w, height: cpu.h, rx: 12, class: 's-cpu blk' }));  // the processor box, coloured with the processor colour
    g.push(txt(cpu.x + 12, cpu.y + 22, 'Processor', 't15 b'));  // "Processor" heading inside the box
    g.push(txt(cpu.x + 12, cpu.y + 51, 'Register R', 't13 s-sub'));  // label for the processor register that data passes through in programmed and interrupt-driven I/O
    g.push(s('rect', { x: cpu.x + 100, y: cpu.y + 33, width: 56, height: 26, rx: 6, class: 'reg' + (st.hotR ? ' hot' : '') }));  // the box that shows register R's value; it glows (class "hot") when st.hotR says the value just changed
    g.push(txt(cpu.x + 128, cpu.y + 51, st.R || '–', 't15 b mid mono'));  // the value in register R, or a dash when it is empty
    g.push(txt(cpu.x + 12, cpu.y + 80, st.cpuLine || '', 't14 b', tone(st.cpuTone || 'cpu')));  // a bold status line saying what the processor is doing right now, in the colour st.cpuTone names
    if (st.cpuSub) g.push(txt(cpu.x + 12, cpu.y + 97, st.cpuSub, 't13 s-sub'));  // an optional smaller line under it with extra detail
    /* memory: one cell per word, addresses underneath (staggered when there are many) */
    const mem = st.mem || [];  // mem is the list of memory cell values to show (empty text means an empty cell)
    g.push(s('rect', { x: M.x, y: M.y, width: M.w, height: M.h, rx: 12, class: 's-mem blk' }));  // the main memory box, coloured with the memory colour
    g.push(txt(M.x + 12, M.y + 22, 'Main memory', 't15 b'));  // "Main memory" heading inside the box
    const pitch = (M.w - 24) / Math.max(1, mem.length), cw = pitch - 4;  // pitch is the space each cell gets so they all fit across the box; cw is the cell width with a small gap
    mem.forEach((v, i) => {  // draws one cell for each memory word
      const x = M.x + 12 + i * pitch;  // x is this cell's left edge
      const sel = st.sel && i >= st.sel[0] && i < st.sel[1];  // sel is true when this cell lies in the target block st.sel (start included, end excluded)
      g.push(s('rect', { x, y: M.y + M.cy, width: cw, height: M.ch, rx: 5, class: 'cell' + (v ? ' full' : '') + (sel ? ' sel' : '') + (st.hot === i ? ' hot' : '') }));  // the cell's rectangle: classes mark it as full, inside the target block, or just written (hot)
      g.push(txt(x + cw / 2, M.y + M.cy + M.ch - 11, v || '', 't16 b mid mono'));  // the value stored in the cell, centred inside it
      g.push(txt(x + cw / 2, M.y + (mem.length > 8 && i % 2 ? M.ly[1] : M.ly[0]), (st.base || 200) + i, 't13 mid ' + (sel ? 'b' : 's-sub'), sel ? 'fill:var(--accent)' : null));  // the cell's address (from st.base, default 200) under it; with more than 8 cells every other label drops lower so they do not overlap
    });  // ends the loop over memory cells
    /* device */
    const dcx = dev.x + dev.w / 2, dy = dev.y;  // dcx is the horizontal centre of the device box; dy is its top edge
    g.push(s('rect', { x: dev.x, y: dy, width: dev.w, height: dev.h, rx: 12, class: 's-io blk' }));  // the device box, in the I/O colour
    g.push(txt(dcx, dy + 20, st.devName || 'Disk', 't15 b mid'));  // the device's name at the top, "Disk" unless the step names another device
    if (st.devIcon === 'net') {  // a network card gets its own icon instead of a disk
      g.push(s('rect', { x: dcx - 30, y: dy + 32, width: 60, height: 34, rx: 5, class: 's-panel' }));  // the card: a small rounded panel
      [-22, -6, 10].forEach((o) => g.push(s('rect', { x: dcx + o, y: dy + 44, width: 12, height: 10, rx: 2, class: 'conn', style: 'stroke-width:1.5' })));  // three little port squares along the card
    } else {  // otherwise draw a disk: a short cylinder made of two ellipses and a filled middle
      g.push(s('ellipse', { cx: dcx, cy: dy + 63, rx: 26, ry: 7, class: 's-panel' }));  // bottom ellipse of the cylinder
      g.push(s('rect', { x: dcx - 26, y: dy + 37, width: 52, height: 26, class: 's-panel', style: 'stroke:none' }));  // filled middle of the cylinder, with no outline so it joins the two ellipses cleanly
      g.push(s('line', { x1: dcx - 26, y1: dy + 37, x2: dcx - 26, y2: dy + 63, class: 'conn', style: 'stroke-width:1.5' }));  // left side line of the cylinder
      g.push(s('line', { x1: dcx + 26, y1: dy + 37, x2: dcx + 26, y2: dy + 63, class: 'conn', style: 'stroke-width:1.5' }));  // right side line of the cylinder
      g.push(s('ellipse', { cx: dcx, cy: dy + 37, rx: 26, ry: 7, class: 's-panel' }));  // top ellipse of the cylinder, drawn last so it sits on top
    }  // ends the device icon choice
    g.push(txt(dcx, dy + 90, st.devLine || 'idle', 't13 mid b', tone(st.devTone || 'muted')));  // a status line under the icon ("idle" by default), coloured by st.devTone
    /* the module: an ordinary I/O module or a DMA module */
    const dma = st.mode === 'dma', mx = mod.x, my = mod.y;  // dma is true when this moment shows a DMA module instead of an ordinary I/O module; mx, my are the module's top-left corner
    g.push(s('rect', { x: mx, y: my, width: mod.w, height: mod.h, rx: 12, class: (dma ? 's-accent' : 's-io') + ' blk' }));  // the module box: accent colour for a DMA module, I/O colour for an ordinary one
    g.push(txt(mx + 12, my + 20, dma ? 'DMA module' : 'I/O module', 't15 b'));  // the module's heading, which says which kind it is
    const box = (x, y, w, val, hot) => { g.push(s('rect', { x, y: y - 15, width: w, height: 21, rx: 5, class: 'reg' + (hot ? ' hot' : '') })); g.push(txt(x + w / 2, y, val == null || val === '' ? '–' : val, 't14 b mid mono')); };  // box(): draws a small register box with its value centred inside (a dash when empty); hot makes it glow
    if (dma) {  // DMA module: show the registers the processor loads during setup
      const d = st.dma || {}, hot = st.hotReg || '', L = G.dma;  // d holds the register values; hot lists which ones just changed; L gives the positions from the layout
      [[41, 'Operation', d.op, 'op', 'Device', d.dev, 'dev'], [66, 'Address', d.addr, 'addr', 'Count', d.count, 'count']].forEach(([oy, l1, v1, k1, l2, v2, k2]) => {  // two rows of two registers each: Operation and Device on the first row, Address and Count on the second
        g.push(txt(mx + L.l1, my + oy, l1, 't13')); box(mx + L.b1, my + oy, L.w1, v1, hot.includes(k1));  // left register of the row: its label and its value box
        g.push(txt(mx + L.l2, my + oy, l2, 't13')); box(mx + L.b2, my + oy, L.w2, v2, hot.includes(k2));  // right register of the row: its label and its value box
      });  // ends the two register rows
      g.push(txt(mx + L.l1, my + 91, 'Data', 't13')); box(mx + L.b1, my + 91, L.w1, st.data, hot.includes('data'));  // a third row: the Data register holding the word currently passing through the module
    } else {  // ordinary I/O module: show a status register with a READY lamp and a data register
      g.push(txt(mx + 12, my + 48, 'Status register', 't14'));  // label for the status register
      g.push(s('circle', { cx: mx + G.io.lamp, cy: my + 43, r: 8, class: 'lamp' + (st.lamp ? ' on' : '') }));  // the READY lamp: a small circle that lights up when st.lamp is set
      g.push(txt(mx + G.io.lamp + 14, my + 48, 'READY = ' + (st.lamp ? 1 : 0), 't14 b mono', tone(st.lamp ? 'ok' : 'ink-2')));  // the READY bit written out as 1 or 0, green when it is 1
      g.push(txt(mx + 12, my + 82, 'Data register', 't14'));  // label for the data register
      box(mx + G.io.bx, my + 82, 56, st.data, st.hotData);  // the data register's box, glowing when st.hotData says a word just arrived
    }  // ends the choice between a DMA module and an I/O module
    /* note box (what the other program is doing) */
    if (st.note) {  // the note box appears only when the step supplies one (it tells what the other program is doing)
      const ncx = note.x + note.w / 2;  // ncx is the horizontal centre of the note box
      g.push(s('rect', { x: note.x, y: note.y, width: note.w, height: note.h, rx: 12, class: 's-panel blk' }));  // the note box's rounded background
      g.push(txt(ncx, note.y + 22, st.note.title, 't13 mid s-sub b'));  // the note's small title line
      g.push(txt(ncx, note.y + 54, st.note.value, 't16 mid b', tone(st.note.tone)));  // the note's main value in large bold text, coloured by st.note.tone
      if (st.note.sub) g.push(txt(ncx, note.y + 82, st.note.sub, 't13 mid s-sub'));  // an optional small line under the value
    }  // ends the note box
    /* highlighted path with a travelling token */
    if (st.path) {  // draws a highlighted route only when the step names one in st.path
      const pts = PATHS[st.path], col = st.pathCls === 'cmd' ? 'cpu' : 'accent';  // pts is the chosen route; col picks the arrowhead colour: processor colour for command paths, accent colour for data
      g.push(s('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'hp ' + (st.pathCls || 'data') }));  // draws the route as one highlighted line through its corner points; the class decides its colour and dash style
      g.push(arrowHead(ctx, pts[pts.length - 2], pts[pts.length - 1], col));  // an arrowhead at the route's end, pointing along its last piece, so students see which way things flow
      if (st.tok) {  // when a token (the thing travelling, such as a word value) is given, draw it on the route
        const [tx, ty] = along(pts, st.frac == null ? 0.5 : st.frac), w = 14 + 8.6 * String(st.tok).length;  // finds where the token sits along the route (halfway by default) and sizes its label box to fit the text
        g.push(s('rect', { x: tx - w / 2, y: ty - 12, width: w, height: 24, rx: 8, class: 'tok' }));  // the token's rounded background box, centred on that point
        g.push(txt(tx, ty + 5, st.tok, 't14 b mid mono'));  // the token's text, centred in its box
      }  // ends the token drawing
    }  // ends the highlighted route
    return g;  // hands all the shapes to the caller
  }  // ends busNodes()
  /* ------------------------------------------------------------------
     Three flowcharts side by side (viewBox 1100 x 372) for the compare step.
     ------------------------------------------------------------------ */
  function flowNodes(ctx) {  // flowNodes(ctx): draws three flowcharts side by side, one per I/O technique, for the compare step
    const { s } = ctx, out = [];  // s builds SVG shapes; out collects one group per flowchart
    const NW = 250, NH = 30;  // every action box is 250 wide and 30 tall
    const col = (i) => { const g = s('g', { class: 's17-col', 'data-col': i }); out.push(g); return g; };  // col(i): starts a new group for flowchart i; the class and data-col attribute let the step highlight one column at a time
    const box = (g, cx, y, text, cls) => { g.append(s('rect', { x: cx - NW / 2, y, width: NW, height: NH, rx: 8, class: cls + ' blk' }), s('text', { x: cx, y: y + 20, class: 't14 mid' }, text)); };  // box(): an action box (rounded rectangle) centred at cx with its text, coloured by cls
    const dia = (g, cx, cy, text) => { g.append(s('path', { d: `M${cx},${cy - 20} L${cx + 62},${cy} L${cx},${cy + 20} L${cx - 62},${cy} Z`, class: 's-panel blk' }), s('text', { x: cx, y: cy + 5, class: 't14 mid b' }, text)); };  // dia(): a diamond-shaped decision box (a yes/no question) centred at (cx, cy) with bold text
    const arr = (g, d, cls, mk) => g.append(s('path', { d, class: cls || 's-line', 'marker-end': `url(#${mk || 'arr'})`, fill: 'none' }));  // arr(): an arrow along an SVG path, using the arrowhead marker named mk (the plain one unless told otherwise)
    const lbl = (g, x, y, t, st) => g.append(s('text', { x, y, class: 't13', style: st || 'fill:var(--muted)' }, t));  // lbl(): a small text label such as "yes" or "no", muted grey unless a style is given
    const loop = (g, cx, y1, y2, t) => { g.append(s('rect', { x: cx - 168, y: y1, width: 336, height: y2 - y1, rx: 12, class: 's-warn', style: 'opacity:.35', 'stroke-width': 1 })); lbl(g, cx - 160, y2 - 8, t, 'fill:var(--warn);font-weight:700'); };  // loop(): a faint warning-coloured band behind the steps that repeat, with a bold label in its bottom corner
    /* Programmed I/O */
    let g = col(0), X = 185;  // first column: programmed I/O, centred at x 185
    loop(g, X, 24, 318, 'every word');  // band showing that everything from the command down to "Done?" repeats for every word
    g.append(s('text', { x: X, y: 14, class: 't15 mid b', style: 'fill:var(--warn)' }, 'Programmed I/O'));  // column heading in the warning colour, because this technique wastes the most time
    box(g, X, 32, 'Issue READ command to I/O module', 's-cpu'); arr(g, `M${X},62 L${X},76`);  // step 1: the processor issues a READ command, then an arrow down
    box(g, X, 78, 'Read status of I/O module', 's-io'); arr(g, `M${X},108 L${X},120`);  // step 2: the processor reads the module's status register, then an arrow down
    dia(g, X, 142, 'Ready?'); arr(g, `M${X},162 L${X},176`); lbl(g, X + 8, 173, 'yes');  // decision: is the module ready? "yes" continues downward
    arr(g, `M${X - 62},142 L${X - 150},142 L${X - 150},93 L${X - 127},93`); lbl(g, X - 146, 136, 'not ready');  // "not ready" loops back up to reading the status again: this loop is the busy waiting
    box(g, X, 178, 'Read word from I/O module', 's-io'); arr(g, `M${X},208 L${X},222`);  // the processor itself reads the word from the module
    box(g, X, 224, 'Write word into memory', 's-mem'); arr(g, `M${X},254 L${X},268`);  // and writes that word into memory
    dia(g, X, 290, 'Done?'); arr(g, `M${X},310 L${X},330`); lbl(g, X + 8, 326, 'yes');  // decision: is the whole block done? "yes" goes on
    arr(g, `M${X + 62},290 L${X + 152},290 L${X + 152},47 L${X + 127},47`); lbl(g, X + 70, 283, 'no');  // "no" loops back up to issuing the next READ command
    box(g, X, 332, 'Next instruction', 's-panel');  // after the block: the program's next instruction
    /* Interrupt-driven I/O */
    g = col(1); X = 550;  // second column: interrupt-driven I/O, centred at x 550
    loop(g, X, 24, 318, 'every word');  // band showing that these steps still repeat for every word
    g.append(s('text', { x: X, y: 14, class: 't15 mid b', style: 'fill:var(--intr)' }, 'Interrupt-driven I/O'));  // column heading in the interrupt colour
    box(g, X, 32, 'Issue READ command to I/O module', 's-cpu'); arr(g, `M${X},62 L${X},76`);  // step 1: the processor issues a READ command, then an arrow down
    box(g, X, 78, 'Do something else', 's-proc'); arr(g, `M${X},108 L${X},132`, 's17-iarr', 'arr-intr'); lbl(g, X + 8, 125, 'interrupt', 'fill:var(--intr);font-weight:700');  // the processor does other work until an interrupt arrives, shown by a highlighted arrow and bold label
    box(g, X, 134, 'Read status of I/O module', 's-io'); arr(g, `M${X},164 L${X},176`);  // after the interrupt the processor reads the module's status
    box(g, X, 178, 'Read word from I/O module', 's-io'); arr(g, `M${X},208 L${X},222`);  // the processor reads the word from the module
    box(g, X, 224, 'Write word into memory', 's-mem'); arr(g, `M${X},254 L${X},268`);  // and writes the word into memory itself
    dia(g, X, 290, 'Done?'); arr(g, `M${X},310 L${X},330`); lbl(g, X + 8, 326, 'yes');  // decision: is the whole block done? "yes" goes on
    arr(g, `M${X + 62},290 L${X + 152},290 L${X + 152},47 L${X + 127},47`); lbl(g, X + 70, 283, 'no');  // "no" loops back to issuing the next READ command
    box(g, X, 332, 'Next instruction', 's-panel');  // after the block: the program's next instruction
    /* DMA */
    g = col(2); X = 915;  // third column: direct memory access, centred at x 915, with no repeating band because the processor does not loop
    g.append(s('text', { x: X, y: 14, class: 't15 mid b', style: 'fill:var(--accent)' }, 'Direct memory access'));  // column heading in the accent colour
    box(g, X, 32, 'Issue READ BLOCK command to DMA', 's-cpu'); arr(g, `M${X},62 L${X},76`);  // the processor issues a single READ BLOCK command to the DMA module
    box(g, X, 78, 'Do something else', 's-proc'); arr(g, `M${X},108 L${X},132`, 's17-iarr', 'arr-intr'); lbl(g, X + 8, 125, 'one interrupt, at the end', 'fill:var(--intr);font-weight:700');  // then does other work; only one interrupt arrives, when the whole block is done
    box(g, X, 134, 'Read status of DMA module', 's-accent'); arr(g, `M${X},164 L${X},176`);  // after that interrupt the processor reads the DMA module's status
    box(g, X, 178, 'Next instruction', 's-panel');  // and goes on with the next instruction
    g.append(s('rect', { x: X - 150, y: 232, width: 300, height: 86, rx: 12, class: 's-accent', style: 'stroke-dasharray:6 4', 'stroke-width': 1.5 }));  // a dashed box underneath for the work the DMA module does on its own
    [['Meanwhile, inside the DMA module:', 'b'], ['every word goes device → memory,', ''], ['one stolen bus cycle each,', ''], ['with no processor instructions.', '']].forEach(([t, c], i) => g.append(s('text', { x: X, y: 254 + i * 19, class: 't14 mid ' + c }, t)));  // four lines of text inside the dashed box: every word goes device to memory with one stolen bus cycle and no processor instructions
    return out;  // hands back the three column groups
  }  // ends flowNodes()
  /* Code listing. On phones a line with its comment beside it would be clipped, so each
     comment moves onto its own line just above its code; mark() keeps the original numbering. */
  function codeBox(ctx, src, o) {  // codeBox(ctx, src, o): shows a code listing; on phones it moves each end-of-line comment onto its own line above the code
    if (!ctx.narrow) return ctx.ui.code(src, o);  // on wider screens just use the guide's normal code box unchanged
    const out = [], map = [];  // out collects the rearranged lines; map records, for each original line number, which new lines it became
    String(src).replace(/^\n+|\s+$/g, '').split('\n').forEach((line) => {  // trims blank lines at the start and spaces at the end, then handles one original line at a time
      const k = line.indexOf('//'), code = k < 0 ? line : line.slice(0, k).replace(/\s+$/, '');  // k is where the line's comment starts (if any); code is the part before it, with trailing spaces removed
      const com = k < 0 ? '' : line.slice(k).replace(/^\/\/\s*/, '// '), ind = (code.match(/^\s*/) || [''])[0], at = [];  // com is the comment part tidied to start with "// "; ind is the code's leading spaces; at collects the new line numbers
      if (com) { at.push(out.length + 1); out.push(ind + com); }  // if there is a comment, it goes on its own line first, indented like its code
      if (code.trim()) { at.push(out.length + 1); out.push(code); }  // then the code itself, if the line had any
      map.push(at);  // remembers which new lines belong to this original line
    });  // ends the loop over original lines
    const pre = ctx.ui.code(out.join('\n'), Object.assign({}, o, { fontSize: 12 }));  // builds the code box from the rearranged lines with a slightly smaller 12-pixel font
    const mark = pre.mark;  // keeps the box's own mark() function, which highlights lines by number
    pre.mark = (nums, cls) => mark([].concat(nums == null ? [] : nums).flatMap((n) => map[n - 1] || []), cls);  // replaces mark() so callers can keep using the original line numbers; they are translated through map
    return pre;  // returns the finished code box
  }  // ends codeBox()
  function busSvg(ctx) { const G = geo(ctx.narrow); return ctx.s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Processor, main memory, system bus, device and its module' }); }  // busSvg(ctx): creates an empty, full-width SVG sized for the bus diagram, with a description for screen readers

  Guide.section({  // registers section 1.7 with the guide; everything below is the section's data, steps and styles
    id: '1.7',  // section number, used in links, the page address and saved progress
    title: 'Direct Memory Access',  // the section's full title
    short: 'DMA',  // short name shown where space is tight
    summary: 'Three ways to move data between devices and memory, and why DMA frees the processor.',  // one-sentence summary shown on the chapter page
    objectives: [  // learning objectives: what a student should be able to do after this section
      'Describe how programmed I/O, interrupt-driven I/O and DMA each move a block of data, and who does the work.',  // objective 1: describe the three techniques and who does the work in each
      'Explain why busy waiting wastes processor time and why interrupts help but still route every word through the processor.',  // objective 2: why busy waiting wastes time and why interrupts only partly help
      'State the two drawbacks shared by programmed and interrupt-driven I/O.',  // objective 3: the two drawbacks programmed and interrupt-driven I/O share
      'List the four items the processor gives a DMA module and trace a DMA block transfer from setup to completion interrupt.',  // objective 4: the four things a DMA module is given, and tracing a transfer end to end
      'Explain cycle stealing and why DMA still wins for multiple-word transfers.',  // objective 5: cycle stealing and why DMA still wins for multi-word transfers
    ],  // closes the objectives list
    terms: [  // key terms for this section: each entry is a term and its definition, used in the glossary and flip cards
      ['Programmed I/O', 'An I/O technique in which the processor gives a command to an I/O module and then checks the module’s status over and over until the operation is done. The module never interrupts.'],  // glossary entry: defines programmed I/O
      ['Interrupt-driven I/O', 'An I/O technique in which the processor gives a command, goes on with other work, and is interrupted by the I/O module when it is ready to exchange data. The processor still moves every word itself.'],  // glossary entry: defines interrupt-driven I/O
      ['Direct memory access (DMA)', 'An I/O technique in which a DMA module moves a whole block of words between a device and main memory by itself. The processor only sets up the transfer and handles one interrupt at the end.'],  // glossary entry: defines direct memory access (DMA)
      ['DMA module', 'Hardware, either a separate module on the system bus or logic built into an I/O module, that can take over the bus and move words to or from main memory in place of the processor.'],  // glossary entry: defines the DMA module and where it can live
      ['I/O status register (status register)', 'A small register inside an I/O module whose bits report how the current operation is going, for example ready, busy or error. The processor reads it to find out whether the module has finished.'],  // glossary entry: defines the I/O status register
      ['Data register', 'A register inside an I/O module that holds the word currently being passed between the device and the rest of the computer.'],  // glossary entry: defines the data register of an I/O module
      ['I/O command', 'A request the processor sends to an I/O module (by executing an I/O instruction) telling it what to do next, such as read the next word from the disk.'],  // glossary entry: defines an I/O command
      ['Polling', 'Asking a device for its status again and again, on the processor’s own initiative, to see whether it has finished.'],  // glossary entry: defines polling
      ['Busy waiting', 'Waiting by running a loop that checks a condition over and over instead of doing other work or sleeping. The processor looks busy but achieves nothing.'],  // glossary entry: defines busy waiting
      ['Interrupt handler', 'The routine, normally part of the operating system, that runs when the processor accepts an interrupt. It deals with the event and then lets the interrupted program continue.'],  // glossary entry: defines the interrupt handler
      ['Context (processor state)', 'Everything the processor needs to continue a program exactly where it stopped: the program counter, the status word and the other registers. It is saved before an interrupt is handled and restored afterwards.'],  // glossary entry: defines the context (processor state) saved and restored around an interrupt
      ['Word', 'The fixed-size group of bits that the processor, memory and bus move as one unit.'],  // glossary entry: defines a word
      ['Block transfer', 'Moving a group of consecutive words, such as one disk sector, between a device and memory as a single job.'],  // glossary entry: defines a block transfer
      ['Transfer rate', 'How many words (or bytes) per second actually move between a device and main memory.'],  // glossary entry: defines transfer rate
      ['Address register', 'A register in a DMA module that holds the memory address for the next word. It goes up by one after every word, so the block lands in consecutive cells.'],  // glossary entry: defines the DMA address register and how it counts up
      ['Count register', 'A register in a DMA module that holds how many words are still to move. It goes down by one after every word; at zero the block is finished.'],  // glossary entry: defines the DMA count register and how it counts down to zero
      ['Bus cycle', 'One use of the system bus: the time it takes to move one word from one module to another over it.'],  // glossary entry: defines a bus cycle
      ['Cycle stealing', 'The way a DMA module uses the bus: it takes the bus for one bus cycle at a time, and if the processor wanted the bus then, the processor simply pauses for that cycle. Nothing is saved and nothing is interrupted.'],  // glossary entry: defines cycle stealing
    ],  // closes the key terms list

    css: ` /* start of the section's own styles, added to the page once when the section registers; every rule starts with .sec-1-7 so it only affects this section */
      .sec-1-7 svg .bus { stroke: var(--line-2); stroke-width: 9; stroke-linecap: round; fill: none; } /* the system bus in the diagrams: a thick grey line with rounded ends */
      .sec-1-7 svg .conn { stroke: var(--line-2); stroke-width: 3; fill: none; } /* the short connector wires from each box to the bus, thinner than the bus itself */
      .sec-1-7 svg .intl { stroke: var(--line-2); stroke-width: 2; stroke-dasharray: 5 4; fill: none; } /* the interrupt line when quiet: thin and dashed */
      .sec-1-7 svg .intl.on { stroke: var(--intr); stroke-width: 4; stroke-dasharray: none; } /* the interrupt line when an interrupt is signalled: thick, solid and in the interrupt colour */
      .sec-1-7 svg .s17-iarr { stroke: var(--intr); stroke-width: 2; stroke-dasharray: 5 3; fill: none; } /* the dashed interrupt-coloured arrow in the flowcharts that marks where an interrupt arrives */
      .sec-1-7 svg .hp { fill: none; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; } /* a highlighted route along the wires: thick with rounded corners so it reads as one path */
      .sec-1-7 svg .hp.cmd { stroke: var(--cpu); } /* command routes are drawn in the processor colour */
      .sec-1-7 svg .hp.data { stroke: var(--accent); } /* data routes are drawn in the accent colour */
      .sec-1-7 svg .tok { fill: var(--hl); stroke: var(--ink-2); stroke-width: 1.5; } /* the travelling token: a highlight-coloured box with a dark outline so it stands out on the wires */
      .sec-1-7 svg .blk { stroke-width: 2; } /* gives every main box (processor, memory, device, module) a firm 2-pixel outline */
      .sec-1-7 svg .cell { fill: var(--panel); stroke: var(--line-2); stroke-width: 1.5; } /* an empty memory cell: plain panel colour with a thin outline */
      .sec-1-7 svg .cell.full { fill: var(--mem-bg); stroke: var(--mem); } /* a memory cell that holds a value takes the memory colour */
      .sec-1-7 svg .cell.sel { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 4 3; } /* cells inside the chosen target block get a dashed accent outline */
      .sec-1-7 svg .cell.hot { stroke: var(--accent); stroke-width: 3; stroke-dasharray: none; } /* the cell that was just written gets a thick solid accent outline so the student's eye goes there */
      .sec-1-7 svg .reg { fill: var(--panel); stroke: var(--line-2); stroke-width: 1.5; } /* a register box: plain panel colour with a thin outline */
      .sec-1-7 svg .reg.hot { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-bg); } /* a register that just changed glows with an accent fill and outline */
      .sec-1-7 svg .lamp { fill: var(--panel-3); stroke: var(--line-2); stroke-width: 2; } /* the READY lamp when off: dim fill with a grey outline */
      .sec-1-7 svg .lamp.on { fill: var(--ok); stroke: var(--ok); } /* the READY lamp when on: filled green, the "ok" colour */
      .sec-1-7 svg .mono { font-family: var(--mono); } /* monospace (fixed-width) font for values, so letters and digits line up */
      .sec-1-7 svg .b { font-weight: 700; } /* bold text */
      .sec-1-7 svg .mid { text-anchor: middle; } /* centres text on its x position */
      .sec-1-7 svg .end { text-anchor: end; } /* right-aligns text on its x position, used for the "system bus" label */
      .sec-1-7 svg .t13 { font-size: 13px; } /* 13-pixel text, the smallest size used in the diagrams */
      .sec-1-7 svg .t14 { font-size: 14px; } /* 14-pixel text */
      .sec-1-7 svg .t15 { font-size: 15px; } /* 15-pixel text, used for box headings */
      .sec-1-7 svg .t16 { font-size: 16px; } /* 16-pixel text, used for memory values and note values */
      .sec-1-7 svg .k-free { fill: var(--proc-bg); stroke: var(--proc); } /* timeline colour for "other program" time: the process colour */
      .sec-1-7 svg .k-poll { fill: var(--warn-bg); stroke: var(--warn); } /* timeline colour for busy waiting: the warning colour */
      .sec-1-7 svg .k-cmd { fill: var(--cpu-bg); stroke: var(--cpu); } /* timeline colour for commands and setup: the processor colour */
      .sec-1-7 svg .k-move { fill: var(--mem-bg); stroke: var(--mem); } /* timeline colour for moving a word: the memory colour */
      .sec-1-7 svg .k-ctx { fill: var(--intr-bg); stroke: var(--intr); } /* timeline colour for saving and restoring context: the interrupt colour */
      .sec-1-7 svg .k-stolen { fill: var(--accent-bg); stroke: var(--accent); } /* timeline colour for stolen cycles: the accent colour */
      .sec-1-7 .key { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); white-space: nowrap; } /* a legend entry: a small swatch and its label on one line that never wraps */
      .sec-1-7 .key i { width: 14px; height: 14px; border-radius: 4px; border: 2px solid; display: inline-block; } /* the legend's swatch itself: a 14-pixel square with rounded corners and a coloured border */
      .sec-1-7 .key i.k-free { background: var(--proc-bg); border-color: var(--proc); } /* legend swatch for "other program" time, matching the timeline colour */
      .sec-1-7 .key i.k-poll { background: var(--warn-bg); border-color: var(--warn); } /* legend swatch for busy waiting */
      .sec-1-7 .key i.k-cmd { background: var(--cpu-bg); border-color: var(--cpu); } /* legend swatch for commands and setup */
      .sec-1-7 .key i.k-move { background: var(--mem-bg); border-color: var(--mem); } /* legend swatch for moving a word */
      .sec-1-7 .key i.k-ctx { background: var(--intr-bg); border-color: var(--intr); } /* legend swatch for saving and restoring context */
      .sec-1-7 .key i.k-stolen { background: var(--accent-bg); border-color: var(--accent); } /* legend swatch for stolen cycles */
      .sec-1-7 .stat { display: flex; flex-direction: column; min-width: 0; } /* a statistic card: the number stacked above its label */
      .sec-1-7 .stat .v { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.15; } /* the statistic's number: large, heavy, with equal-width digits so changing numbers do not jiggle */
      .sec-1-7 .stat .l { font-size: 12.5px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; } /* the statistic's label: small, muted, uppercase with a little letter spacing */
      .sec-1-7 .fb { font-size: 15px; line-height: 1.45; } /* feedback callouts: slightly larger text with comfortable line spacing */
      .sec-1-7 .s17-item { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; align-items: start; } /* one numbered setup item in the DMA lab: a thin number column and a flexible content column */
      .sec-1-7 .s17-n { width: 26px; height: 26px; border-radius: 8px; background: var(--accent-bg); color: var(--accent); font-weight: 800; display: grid; place-items: center; font-size: 14px; } /* the rounded number badge (1-4) beside each setup item, in accent colours */
      .sec-1-7 .s17-item .ui-slider { font-size: 14px; } /* slightly smaller text inside the sliders of the setup items */
      .sec-1-7 .s17-range { font-size: 14.5px; line-height: 1.4; border-radius: 10px; padding: 7px 10px; background: var(--panel-2); border: 1px solid var(--line); } /* the line that describes the chosen block (how many words, which cells), in a soft rounded panel */
      .sec-1-7 .s17-range.bad { background: var(--bad-bg); border-color: var(--bad); } /* the same line turns red when the chosen block would run past the end of memory */
      .sec-1-7 .s17-log { height: 118px; font-size: 13px; } /* the scrolling event log in the DMA lab, fixed at 118 pixels tall so the layout does not jump */
      .sec-1-7 .s17-lane { display: grid; grid-template-columns: 150px minmax(0, 1fr) 244px; gap: 12px; align-items: center; padding: 7px 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); } /* one lane in the race: name column, timeline in the middle, info column on the right */
      .sec-1-7 .s17-info { font-size: 13px; line-height: 1.4; color: var(--ink-2); } /* the small info text on the right of each race lane */
      .sec-1-7 .s17-cs { padding-top: 6px; padding-bottom: 6px; } /* a compact statistic card with less padding, used in the cycle-stealing step */
      .sec-1-7 .s17-cs .v { font-size: 21px; } /* its number is a little smaller than a normal statistic */

    `,  // end of the section's styles

    steps: [  // the steps of this section, in the order the student sees them
      /* ============ 1. Big Picture: who carries the data? ============ */
      {  // step 1: an animated story comparing the three techniques
        title: 'Moving data: who does the carrying?',  // step 1 title shown at the top of the page
        kind: 'story',  // step kind "story": a narrative step, labelled as such in the header
        html: `${/* step 1's page layout, written as HTML text; the animated card is filled in by render() below */''}
          <div class="split l fill">${/* two-column layout: text on the left, the animation card on the right */''}
            <div class="stack">${/* left column: a vertical stack of paragraphs and callouts */''}
              <p class="lead m0">Every file you open must travel, <span class="t">word</span> by word, between an I/O device and main memory. The big question: <b>who carries it?</b></p>${/* opening paragraph: every file travels word by word, so who carries each word? */''}
              <p class="m0">In <span class="t">programmed I/O</span> the processor carries every word and keeps checking on the device. In <span class="t">interrupt-driven I/O</span> the I/O module interrupts (as in 1.4) when a word is ready, but the processor still carries every word. With <span class="t">direct memory access (DMA)</span>, previewed in 1.3, a helper module carries the whole block and tells the processor only at the end.</p>${/* paragraph: one-line summary of each technique and who carries the words in it */''}
              <div class="callout analogy m0" data-label="Analogy">Moving house. <b>(1)</b> You carry every box and keep running to the door to see if the next one has come. <b>(2)</b> A doorbell rings for each box, but you still carry each one in. <b>(3)</b> You hire movers, say what goes where, and they phone you once when all is inside.</div>${/* analogy callout: carrying boxes yourself, a doorbell per box, and hiring movers */''}
              <div class="callout tip m0" data-label="Try it">Switch techniques and watch the <b>Program B</b> box: other work the processor could be doing.</div>${/* tip callout: tells the student to switch techniques and watch the Program B box */''}
            </div>${/* end of the left column */''}
            <div class="card white stack s17-story" style="gap:10px"></div>${/* right column: an empty white card that render() fills with the switch, the diagram and the facts */''}
          </div>`,  // end of step 1's HTML
        render(el, ctx) {  // render(el, ctx): runs when step 1 opens; builds and starts the animation inside the empty card
          const { h } = ctx;  // h builds ordinary page elements (a small helper from the guide)
          const card = ctx.$('.s17-story');  // card is the empty white card from the HTML above
          const svg = busSvg(ctx);  // svg is the empty bus diagram that each animation frame redraws
          const W = ['H', 'I', '!'];  // W holds the three words that travel from the disk to memory: H, I and !
          /* each technique is a looping script of timed phases (seconds) */
          function script(mode) {  // script(mode): lists the phases of the animation for one technique; each phase has a duration d in seconds and what to show
            const ph = [];  // ph collects the phases in order
            if (mode === 'dma') ph.push({ d: 1.4, path: 'cmd', cls: 'cmd', tok: '4 items', cpu: 'setting up the DMA', sub: 'op, device, address, count', dma: [0] });  // DMA only: first the processor sends the 4 setup items along the command route
            W.forEach((c, i) => {  // then, for each of the three words
              if (mode === 'pio') {  // programmed I/O phases for this word
                ph.push({ d: 0.6, path: 'cmd', cls: 'cmd', tok: 'READ', cpu: 'sending a command', dev: 'reading…', m: i });  // the processor sends a READ command to the I/O module; the device starts reading
                ph.push({ d: 1.5, path: 'toCpu', cls: 'cmd', tok: '0', loops: 3, cpu: 'status? no… no…', tone: 'warn', sub: 'busy waiting', dev: 'reading…', m: i });  // the processor reads status "0" three times over (loops) while the device is still reading: busy waiting
                ph.push({ d: 0.5, path: 'dev', tok: c, dev: 'word ready', devTone: 'ok', m: i });  // the device finishes and hands the word to its module
                ph.push({ d: 0.6, path: 'toCpu', cls: 'cmd', tok: '1', cpu: 'status = READY', tone: 'ok', lamp: 1, data: c, m: i });  // the status finally reads 1 (READY); the lamp comes on and the word sits in the data register
                ph.push({ d: 0.7, path: 'toCpu', tok: c, cpu: 'reading the word', data: c, m: i });  // the processor reads the word out of the module into itself
                ph.push({ d: 0.7, path: 'toMem', tok: c, R: c, cpu: 'storing the word', m: i });  // the processor stores the word from register R into the next memory cell
              } else if (mode === 'int') {  // interrupt-driven I/O phases for this word
                ph.push({ d: 0.5, path: 'cmd', cls: 'cmd', tok: 'READ', cpu: i ? 'handler: next command' : 'sending a command', tone: i ? 'intr' : 'cpu', dev: 'reading…', m: i });  // the READ command goes out: from the main program for word 1, from the interrupt handler for the later words
                ph.push({ d: 1.4, cpu: 'running Program B', tone: 'proc', sub: 'useful work', dev: 'reading…', m: i, b: 1 });  // the processor runs Program B (useful work) while the device reads; b: 1 marks Program B as running
                ph.push({ d: 0.5, path: 'dev', tok: c, cpu: 'running Program B', tone: 'proc', dev: 'word ready', devTone: 'ok', m: i, b: 1 });  // the device finishes and hands the word to its module; Program B is still running
                ph.push({ d: 0.7, intr: 1, cpu: 'interrupted!', tone: 'intr', sub: 'saving its context', data: c, lamp: 1, m: i });  // the module interrupts: the processor stops Program B and saves its context; the READY lamp is on
                ph.push({ d: 0.7, path: 'toCpu', tok: c, cpu: 'handler reads word', tone: 'intr', data: c, m: i });  // the interrupt handler reads the word from the module into the processor
                ph.push({ d: 0.7, path: 'toMem', tok: c, R: c, cpu: 'handler stores word', tone: 'intr', m: i });  // the interrupt handler stores the word into memory
              } else {  // DMA phases for this word: the processor never touches it
                ph.push({ d: 0.55, path: 'dev', tok: c, cpu: 'running Program B', tone: 'proc', sub: 'useful work', dev: 'reading…', devTone: 'io', m: i, b: 1, dma: [i, c] });  // the device hands the word to the DMA module while the processor runs Program B; dma: [i, c] updates the registers
                ph.push({ d: 0.7, path: 'ctlToMem', tok: c, cpu: 'running Program B', tone: 'proc', sub: 'useful work', m: i, b: 1, dma: [i, c] });  // the DMA module writes the word straight into memory along its own route
              }  // ends the choice of technique for this word
            });  // ends the loop over the three words
            if (mode === 'dma') ph.push({ d: 1.1, intr: 1, cpu: 'one interrupt: done', tone: 'intr', sub: 'whole block is in memory', m: 3, dma: [3] });  // DMA only: one completion interrupt after the whole block is in memory
            ph.push({ d: 1.6, cpu: mode === 'pio' ? 'finally free' : 'running Program B', tone: mode === 'pio' ? 'cpu' : 'proc', sub: '3 words in memory', m: 3, b: 1, dma: mode === 'dma' ? [3] : null, R: mode === 'dma' ? '' : '!' });  // final phase for every technique: all 3 words are in memory; programmed I/O only now becomes free
            return ph;  // hands back the list of phases
          }  // ends script()
          const INFO = {  // INFO: three fact cards per technique, shown under the diagram (who moves words, how the processor finds out, time cost)
            pio: [['Who moves words?', 'The processor. Every word goes device → module → register R → memory.'], ['How it finds out', 'It keeps reading the module’s status register until the bit says ready.'], ['Processor time', 'All of it. While it waits and checks, it can do nothing else.']],  // programmed I/O facts: the processor moves every word, keeps checking status, and spends all its time on it
            int: [['Who moves words?', 'Still the processor: its interrupt handler copies each word.'], ['How it finds out', 'The module sends an interrupt each time a word is ready.'], ['Processor time', 'Only the handling, but that happens once for <b>every word</b>.']],  // interrupt-driven facts: the handler still copies each word, one interrupt per word
            dma: [['Who moves words?', 'The DMA module, straight into memory. No word visits the processor.'], ['How it finds out', 'One interrupt, after the <b>whole block</b> is done.'], ['Processor time', 'Only the setup at the start and the one interrupt at the end.']],  // DMA facts: the DMA module moves the words, one interrupt at the end, only setup and one interrupt cost time
          };  // closes the INFO table
          const facts = h('div', { class: 'grid-3', style: { gap: '8px' } });  // facts is the three-column row where the fact cards go
          let mode = 'pio', ph = script(mode), total = ph.reduce((a, p) => a + p.d, 0), t0 = performance.now();  // mode is the chosen technique; ph its phases; total the loop length in seconds; t0 the moment the loop started
          function paintFacts() { facts.replaceChildren(...INFO[mode].map(([a, b]) => h('div', { class: 'card tight' }, h('h4', { class: 'm0' }, a), h('div', { class: 'small', html: b })))); }  // paintFacts(): refills the fact row with the three cards for the current technique
          function frame(now) {  // frame(now): draws one animation frame; now is the current time in milliseconds, given by the browser
            let t = ((now - t0) / 1000) % total, p = ph[0], k = 0;  // t is how many seconds into the current loop we are (the % makes it start over); p will be the current phase
            for (k = 0; k < ph.length; k++) { if (t < ph[k].d) { p = ph[k]; break; } t -= ph[k].d; }  // walks through the phases, subtracting each duration until t falls inside one; that one is the current phase
            let f = Math.min(1, t / p.d);  // f is how far through the current phase we are, from 0 to 1; it moves the token along its route
            if (p.loops) f = (f * p.loops) % 1;  // a phase with loops repeats its token run that many times, so the status check is seen travelling again and again
            const mem = ['', '', '', '', '', ''];  // mem is the six memory cells on screen, empty to start
            for (let i = 0; i < Math.min(3, p.m); i++) mem[i] = W[i];  // every word that was already stored before this phase is shown in its cell
            if (p.path === 'toMem' || p.path === 'ctlToMem') { if (f > 0.92) mem[p.m] = W[p.m]; }  // during a store phase, the word appears in its cell just as the token arrives (the last 8 percent of the phase)
            const st = {  // st describes this frame for busNodes(), which draws the diagram
              mode: mode === 'dma' ? 'dma' : 'io', mem, hot: p.path === 'toMem' || p.path === 'ctlToMem' ? p.m : null,  // show a DMA module or an I/O module; the cell being written is highlighted as hot
              path: p.path, pathCls: p.cls, tok: p.tok, frac: f, intr: p.intr, R: p.R || (mode !== 'dma' && p.m > 0 ? W[p.m - 1] : ''),  // the route, its token and position; the interrupt flag; register R shows the last word handled unless the phase sets it
              cpuLine: p.cpu, cpuTone: p.tone, cpuSub: p.sub, lamp: p.lamp, data: p.data || '', devLine: p.dev || 'idle', devTone: p.devTone || (p.dev ? 'io' : 'muted'),  // the processor's status lines, the READY lamp, the module's data register and the device's status line
              note: { title: 'Program B', value: p.b ? 'running' : 'waiting', tone: p.b ? 'proc' : 'warn', sub: p.b ? 'useful work' : 'no progress' },  // the note box says whether Program B is running (useful work) or waiting (no progress)
            };  // ends the frame description
            if (mode === 'dma' && p.dma) {  // extra information for the DMA module's registers in DMA phases
              const done = p.dma[0];  // done is how many words the DMA module has already moved
              st.dma = { op: 'READ', dev: 'disk', addr: String(200 + Math.min(done, 3)), count: String(3 - done) };  // the registers: operation READ, device disk, the next address (counting up from 200) and the words left (counting down from 3)
              st.data = p.dma[1] || '';  // the DMA module's data register shows the word it is handling in this phase
              st.hotReg = p.path === 'cmd' ? 'op dev addr count' : p.path === 'ctlToMem' ? 'addr count data' : '';  // setup lights up all four registers; each word lights up address, count and data because they change
            }  // ends the DMA register details
            svg.replaceChildren(...busNodes(ctx, st));  // replaces the drawing with the shapes for this frame
          }  // ends frame()
          const seg = ctx.ui.seg([{ value: 'pio', label: '1 · Programmed I/O' }, { value: 'int', label: '2 · Interrupt-driven' }, { value: 'dma', label: '3 · DMA' }], mode, (v) => {  // seg: the three-button switch above the diagram (the guide's segmented control); clicking one calls the function below
            mode = v; ph = script(v); total = ph.reduce((a, p) => a + p.d, 0); t0 = performance.now(); paintFacts();  // switching technique: rebuild the phases, recompute the loop length, restart the loop, and refresh the facts
          });  // ends the switch's click handler
          paintFacts();  // shows the facts for the first technique right away
          frame(performance.now());  // draws the first frame immediately so the card is never blank
          ctx.raf((now) => { frame(now); });  // then redraws on every animation frame; ctx.raf stops the loop when the student leaves the step
          card.append(seg, h('div', { style: { display: 'grid', placeItems: 'center' } }, svg), facts);  // puts the switch, the centred diagram and the fact cards into the card
        },  // ends render() for step 1
      },  // ends step 1
      /* ============ 2. Programmed I/O: you are the processor ============ */
      {  // step 2: a lab where the student plays the processor doing programmed I/O
        title: 'Programmed I/O: you are the processor, so keep asking',  // step 2 title
        kind: 'lab',  // step kind "lab": a hands-on step
        render(el, ctx) {  // render(el, ctx): builds the lab when the step opens
          const { h } = ctx;  // h builds ordinary page elements
          const WORDS = ['H', 'I', '!'], NEED = [4, 3, 5];   // status checks until each word is ready (the last check sees READY = 1)
          const svg = busSvg(ctx);  // svg is the bus diagram, redrawn after every action
          const code = codeBox(ctx, `${/* the code the student is acting out, shown in a code box; on phones comments move above their lines */''}
for (i = 0; i < 3; i++) {       // once for each word of the block${/* shown code, line 1: the loop that runs once per word of the block */''}
  command(disk, READ);          // ask the module for one word${/* shown code, line 2: send the module a READ command for one word */''}
  while (status(disk) != READY) // read the status register...${/* shown code, line 3: the busy-wait loop that keeps reading the status register */''}
    ;                           // ...not ready yet: read it again${/* shown code, line 4: the empty loop body, meaning "check again" */''}
  R = data(disk);               // ready: copy the word into R${/* shown code, line 5: once ready, copy the word from the module into register R */''}
  memory[200 + i] = R;          // store R in the next memory cell${/* shown code, line 6: store R into the next memory cell */''}
}                               // repeat for the next word`, { nums: false, fontSize: 13 });  // shown code, line 7: end of the loop; options hide line numbers and use a 13-pixel font
          const fb = h('div', { class: 'callout m0 fb', style: { minHeight: '104px' } });  // fb is the feedback callout under the controls; its minimum height stops the page jumping as messages change
          const stats = h('div', { class: 'grid-4', style: { gap: '8px' } });  // stats is the row of four statistic cards
          let st, auto = null;  // st holds the lab's state; auto holds the timer for the automatic "finish it for me" mode, or null
          function reset() {  // reset(): puts the lab back to the start
            st = { w: 0, phase: 'cmd', checks: 0, instr: 0, allChecks: 0, wasted: 0, lamp: 0, data: '', R: '', mem: ['', '', '', '', '', ''], path: null, tok: null, cls: null, hot: null, dev: 'idle', devTone: 'muted', cpu: 'waiting for you', tone: 'cpu' };  // state: word number, phase, checks this word, instructions, total checks, wasted checks, lamp, registers, memory, route and labels
            code.clear();  // removes any highlighted line in the code box
            say('tip', 'Your job', 'Move the block <b>H I !</b> from the disk into cells 200–202. Start by sending the module a <b>READ</b> command.');  // first message: the student's job is to move H I ! into cells 200-202, starting with a READ command
            paint();  // draws the starting state
          }  // ends reset()
          function say(kind, label, html) { fb.className = 'callout m0 fb ' + kind; fb.dataset.label = label; fb.innerHTML = html; }  // say(kind, label, html): shows a message in the feedback callout; kind picks its colour and label its heading
          function stat(v, l, col) { return h('div', { class: 'stat card tight' }, h('span', { class: 'v', style: { color: col ? 'var(--' + col + ')' : null } }, String(v)), h('span', { class: 'l' }, l)); }  // stat(v, l, col): builds one statistic card with a big number v, a label l, and an optional colour
          function paint() {  // paint(): redraws the diagram and the statistics from the current state
            svg.replaceChildren(...busNodes(ctx, { mode: 'io', mem: st.mem, hot: st.hot, R: st.R, lamp: st.lamp, data: st.data, path: st.path, pathCls: st.cls, tok: st.tok, frac: 0.55,  // draws the bus with an I/O module, memory, register R, the lamp, the data register and any route and token
              cpuLine: st.cpu, cpuTone: st.tone, cpuSub: 'instructions so far: ' + st.instr, devLine: st.dev, devTone: st.devTone,  // the processor's status line with a running count of instructions, and the device's status line
              note: { title: 'Program B', value: '0 done', tone: 'warn', sub: st.phase === 'done' ? 'can run now' : 'still waiting' } }));  // Program B has done nothing: it can only run once the whole block is finished
            stats.replaceChildren(stat(st.instr, 'Instructions'), stat(st.allChecks, 'Status checks'), stat(st.wasted, 'Wasted', 'warn'), stat(st.mem.filter(Boolean).length + ' / 3', 'Words moved', 'mem'));  // the four statistics: instructions executed, status checks, wasted checks, and words moved out of 3
          }  // ends paint()
          function act(kind, fromAuto) {  // act(kind, fromAuto): handles one button press (send command, check status, read word, store word)
            if (!fromAuto && auto) { clearInterval(auto); auto = null; }  // a press by the student stops the automatic mode if it was running
            const w = st.w, c = WORDS[w];  // w is the current word's number and c its letter
            st.path = null; st.tok = null; st.hot = null;  // clears the last action's route, token and highlight before drawing the new one
            if (st.phase === 'done') { say('tip', 'Finished', 'The whole block is already in memory. Press <b>Reset</b> to try again.'); return paint(); }  // after the block is done, any button just says so and suggests Reset
            if (kind === 'cmd') {  // the "send READ command" button
              if (st.phase !== 'cmd') { say('warn', 'Not now', st.phase === 'wait' ? 'The module is already working on this word. Your job now is to <b>check its status</b>.' : 'Finish moving the current word first.'); return paint(); }  // it is only allowed when a new word is due; otherwise explain what the student should do instead
              st.instr++; st.phase = 'wait'; st.checks = 0; st.path = 'cmd'; st.cls = 'cmd'; st.tok = 'READ'; st.dev = 'reading…'; st.devTone = 'io'; st.cpu = 'command sent'; st.tone = 'cpu';  // counts one instruction, moves to the waiting phase, and shows the READ token travelling to the module
              code.clear(); code.mark(2);  // highlights shown code line 2, the command
              say('why', 'Command sent', `Your <span class="t">I/O command</span> starts the disk for word ${w + 1}. When the word arrives it will set <b>READY = 1</b> in its status register and then do nothing more. It will <b>not</b> tell you. Check its status.`);  // explains that the module will set READY = 1 when the word arrives but will not tell the processor
            } else if (kind === 'check') {  // the "check status" button
              if (st.phase === 'cmd') { say('warn', 'Nothing to wait for', 'The module has not been asked to do anything yet. Send the <b>READ</b> command first.'); return paint(); }  // checking before any command was sent makes no sense, so the lab explains and does nothing else
              if (st.phase === 'store') { say('warn', 'Not needed', 'You already hold the word in R. Store it in memory.'); return paint(); }  // checking while the word is already in R is also pointless; the lab says to store it instead
              st.instr++; st.allChecks++; st.cls = 'cmd'; st.path = 'toCpu';  // a real check: counts one instruction and one status check, and shows the status bit travelling to the processor
              code.clear();  // removes the previous code highlight
              if (st.phase === 'read') { st.wasted++; st.tok = '1'; code.mark([3]); say('warn', 'Already ready', 'Still <b>READY = 1</b>. You knew that already: one more wasted instruction. Read the data register.'); return paint(); }  // checking again after READY was already seen is wasted: counted as wasted, line 3 is highlighted, and the lab says so
              st.checks++;  // counts this check toward the current word
              if (st.checks >= NEED[w]) {  // once enough checks have passed (NEED says how many for this word), the word has arrived
                st.lamp = 1; st.data = c; st.phase = 'read'; st.tok = '1'; st.dev = 'word sent'; st.devTone = 'ok'; st.cpu = 'status = READY'; st.tone = 'ok';  // READY lamp on, word in the data register, next phase is "read"; the processor sees status = READY
                code.mark([3], 'ok');  // highlights shown code line 3 in the success colour
                say('tip', 'READY = 1', `Word ${w + 1} is in the module’s <span class="t">data register</span>. It took <b>${st.checks} checks</b>, and ${st.checks - 1} of them found nothing. Now read the data register.`);  // tells how many checks this word took and how many found nothing, then asks the student to read the data register
              } else {  // otherwise the word has not arrived yet
                st.wasted++; st.tok = '0'; st.cpu = 'status? not ready'; st.tone = 'warn';  // a wasted check: the token shows 0 and the processor line turns to the warning colour
                code.mark([3, 4]);  // highlights shown code lines 3 and 4, the busy-wait loop
                say('warn', 'READY = 0', `Not yet (check ${st.checks}). Checking like this is <span class="t">polling</span>, and since you can run nothing else meanwhile, it is <span class="t">busy waiting</span>. Check again.`);  // names what the student is doing: polling, and because nothing else can run meanwhile, busy waiting
              }  // ends the ready / not-ready choice
            } else if (kind === 'read') {  // the "read data register" button
              if (st.phase === 'wait') { st.instr++; st.wasted++; code.clear(); code.mark(5, 'bad'); say('bad', 'Too early', 'READY is still 0, so the data register does not hold the new word yet. In programmed I/O the <b>only</b> way to know is to check the status bit.'); return paint(); }  // reading before READY is a mistake: it still costs an instruction, line 5 turns red, and the lab explains why it is too early
              if (st.phase !== 'read') { say('warn', 'Not now', st.phase === 'cmd' ? 'There is no word waiting. Send a READ command first.' : 'You already read this word. Store it.'); return paint(); }  // reading at any other wrong moment only gets a hint about what to do next
              st.instr++; st.R = c; st.lamp = 0; st.data = ''; st.phase = 'store'; st.path = 'toCpu'; st.cls = 'data'; st.tok = c; st.dev = 'idle'; st.devTone = 'muted'; st.cpu = 'word is in R'; st.tone = 'cpu';  // a correct read: one instruction, the word moves into R, the lamp goes off and the module's data register empties
              code.clear(); code.mark(5);  // highlights shown code line 5
              say('why', 'Into the processor', `“${c}” travels over the bus into register R. Every single word of the block must pass through the processor like this.`);  // points out that every word of the block has to pass through the processor this way
            } else if (kind === 'store') {  // the "store R in memory" button
              if (st.phase !== 'store') { say('warn', 'Not now', st.phase === 'read' ? 'The word is still in the module. Read the data register into R first.' : 'R does not hold a new word yet.'); return paint(); }  // storing is only allowed while R holds a fresh word; otherwise a hint explains the right next move
              st.instr++; st.mem[w] = c; st.hot = w; st.path = 'toMem'; st.cls = 'data'; st.tok = c; st.w++;  // one instruction: the word goes into its memory cell, which is highlighted, and the word counter moves on
              code.clear(); code.mark(6);  // highlights shown code line 6
              if (st.w === 3) {  // if that was the third word, the block is complete
                st.phase = 'done'; st.cpu = 'block finished'; st.tone = 'ok';  // marks the lab finished and shows it in the success colour
                say('tip', 'Block finished', `3 words took <b>${st.instr} instructions</b>, and <b>${st.wasted}</b> of them achieved nothing. Program B ran <b>0</b>. A real device is so much slower than the processor that one wait can last thousands of checks, not ${NEED.slice(0, -1).join(', ')} or ${NEED[NEED.length - 1]}.`);  // summary: instructions used, how many were wasted, Program B ran 0, and a real device would need thousands of checks
              } else {  // otherwise more words remain
                st.phase = 'cmd'; st.cpu = 'word stored'; st.tone = 'cpu';  // back to the command phase for the next word
                say('why', 'Word stored', `“${c}” is in cell ${200 + w}. For word ${w + 2} the whole routine repeats: command, check, check, check…, read, store.`);  // says where the word landed and that the whole routine repeats for the next word
              }  // ends the "store" branch
            }  // ends the choice of button
            paint();  // redraws the diagram and statistics after the action
          }  // ends act()
          const nextAct = () => ({ cmd: 'cmd', wait: 'check', read: 'read', store: 'store' })[st.phase];  // nextAct(): the correct next button for the current phase, used by the automatic mode
          const B = (label, k, cls) => h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: () => act(k) }, label);  // B(label, k, cls): builds one action button that calls act(k) when clicked
          const btns = h('div', { class: 'grid-2', style: { gap: '8px' } }, B('1 · Send READ command', 'cmd', 'cpu'), B('2 · Check status', 'check', 'io'), B('3 · Read data register', 'read', 'cpu'), B('4 · Store R in memory', 'store', 'mem'));  // the four action buttons in a 2 by 2 grid, each coloured by the part of the machine it uses
          const finish = h('button', { class: 'btn primary sm', type: 'button', onclick: () => {  // the "Finish it for me" button, which plays the rest of the lab automatically
            if (auto || st.phase === 'done') return;  // does nothing if it is already running or the block is finished
            auto = ctx.every(380, () => { if (st.phase === 'done') { clearInterval(auto); auto = null; return; } act(nextAct(), true); });  // every 380 milliseconds presses the correct next button, and stops itself once the block is done
          } }, 'Finish it for me');  // ends the button's click handler and gives its label
          const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { if (auto) { clearInterval(auto); auto = null; } reset(); } }, 'Reset');  // Reset button: stops the automatic mode if it is running and starts the lab over
          reset();  // sets up the starting state before the page is shown
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0,6fr) minmax(0,5fr)' } },  // page layout: two columns, the left a little wider than the right
            h('div', { class: 'card white stack', style: { gap: '8px' } }, svg, code,  // left column: a white card with the diagram, the code, and a warning callout
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Thinking the module “tells” the processor it has finished. In programmed I/O it only flips a bit; the processor has to come and look.' })),  // common-mistake callout: the module does not tell the processor it is done; it only sets a bit
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: explanation, buttons, feedback and statistics stacked vertically
              h('p', { class: 'm0', html: '<b>You are the processor.</b> In <span class="t">programmed I/O</span> the <span class="t">I/O module</span> does what it is told and sets bits in its <span class="t">status register</span>, but it never interrupts. Finding out when it is done is <i>your</i> problem.' }),  // intro paragraph: you are the processor, and the I/O module never interrupts
              btns, fb, stats, h('div', { class: 'row' }, finish, again, h('span', { class: 'xs muted' }, 'Each button press = one instruction.')),  // the action buttons, the feedback callout, the statistics, and a row with Finish, Reset and a reminder that each press is one instruction
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The processor is 100% busy, yet Program B makes no progress at all. Every failed check is an instruction thrown away. The next two techniques attack exactly this waste.' }))));  // why-it-matters callout: the processor is fully busy yet Program B makes no progress; the next techniques attack this waste
        },  // ends render() for step 2
      },  // ends step 2
      /* ============ 3. Interrupt-driven I/O: a doorbell for every word ============ */
      {  // step 3: an animated walk-through of interrupt-driven I/O
        title: 'Interrupt-driven I/O: a doorbell for every word',  // step 3 title
        kind: 'explore',  // step kind "explore": the student steps through an animation
        render(el, ctx) {  // render(el, ctx): builds the step when it opens
          const { h, s } = ctx;  // h builds page elements and s builds SVG shapes
          const S = simulate('int', 3, 16);            // 73 ticks: 33 on I/O, 40 for Program B
          const svg = busSvg(ctx);  // svg is the bus diagram
          const TW = ctx.narrow ? 340 : 600;            // time-line width: narrower viewBox on phones keeps its text readable
          const tl = s('svg', { viewBox: `0 0 ${TW} 64`, width: '100%', role: 'img', 'aria-label': 'Processor time line' });  // tl is the processor time line strip under the diagram, sized to the width chosen above
          const code = codeBox(ctx, `${/* the interrupt handler the student follows, shown in a code box */''}
void on_disk_interrupt() {   // runs when the disk interrupts${/* shown code, line 1: the handler's name; it runs each time the disk interrupts */''}
  save_context();            // keep Program B's registers safe${/* shown code, line 2: save Program B's registers first */''}
  R = data(disk);            // copy the ready word into R${/* shown code, line 3: copy the ready word from the module into R */''}
  memory[next++] = R;        // store it; next cell next time${/* shown code, line 4: store R in memory and move on to the next cell */''}
  if (next < 203)            // more words still to come?${/* shown code, line 5: test whether more words are still to come */''}
    command(disk, READ);     //   then ask for the next one${/* shown code, line 6: if so, send the command for the next word */''}
  restore_context();         // put Program B's registers back${/* shown code, line 7: put Program B's registers back */''}
}                            // return: Program B continues`, { nums: false, fontSize: 13 });  // shown code, line 8: return so Program B continues; no line numbers, 13-pixel font
          const stats = h('div', { class: 'grid-4', style: { gap: '8px' } });  // stats is the row of four statistic cards
          const io = 'io';  // io is the colour name used for the device's status line while it is reading
          const F = [  // F: the frames of the animation; each gives the tick to draw up to (cut), interrupts so far (ni), words stored, diagram state, code lines and caption
            { cut: 0, ni: 0, mem: 0, st: { cpuLine: 'running Program A', cpuSub: 'needs the block H I !' }, lines: [],  // frame 1: Program A is running and needs the block; nothing has happened yet
              cap: '<b>Start.</b> Program A needs the three-word block <b>H I !</b> from the disk. This time the processor will not sit and poll.' },  // caption for frame 1: Program A needs H I ! and the processor will not poll this time
            { cut: 1, ni: 0, mem: 0, st: { path: 'cmd', pathCls: 'cmd', tok: 'READ', cpuLine: 'sending a command', devLine: 'reading…', devTone: io }, lines: [],  // frame 2: the READ command travels to the module (tick 1) and the disk starts reading
              cap: 'The processor sends a <b>READ</b> command to the I/O module (1 instruction). The module starts the disk.' },  // caption for frame 2: one instruction for the command; the module starts the disk
            { cut: 17, ni: 0, mem: 0, st: { cpuLine: 'running Program B', cpuTone: 'proc', cpuSub: 'useful work', devLine: 'reading…', devTone: io }, lines: [],  // frame 3: ticks 2-17, the processor runs Program B while the disk works
              cap: 'Program A cannot go on without its data, so instead of polling the processor <b>switches to Program B</b> and does 16 instructions of useful work while the disk is busy.' },  // caption for frame 3: instead of polling, the processor switches to Program B for 16 useful instructions
            { cut: 17, ni: 1, mem: 0, st: { intr: true, lamp: 1, data: 'H', path: 'dev', tok: 'H', cpuLine: 'interrupt request!', cpuTone: 'intr', devLine: 'word sent', devTone: 'ok' }, lines: [1],  // frame 4: the word H arrives and the module raises the interrupt; code line 1 lights up
              cap: 'The word reaches the module’s data register and the module <b>raises an interrupt</b>. The processor finishes its current instruction, then runs the <span class="t">interrupt handler</span>.' },  // caption for frame 4: the module interrupts, and the processor finishes its instruction and runs the handler
            { cut: 21, ni: 1, mem: 0, st: { lamp: 1, data: 'H', cpuLine: 'saving context', cpuTone: 'intr', cpuSub: 'overhead, no data moved' }, lines: [2],  // frame 5: saving Program B's context (4 ticks); code line 2 lights up
              cap: 'First Program B’s <span class="t">context</span> (program counter, status word, registers) is saved so B can later resume exactly where it stopped. Our model charges 4 instructions. Pure overhead: no data has moved yet.' },  // caption for frame 5: what the context is and why saving it is pure overhead
            { cut: 22, ni: 1, mem: 0, st: { path: 'toCpu', tok: 'H', R: 'H', hotR: true, cpuLine: 'handler reads word', cpuTone: 'intr' }, lines: [3],  // frame 6: H travels from the module into register R; code line 3 lights up
              cap: 'The handler reads the data register: <b>H</b> travels over the bus into register R. The word still passes <b>through the processor</b>.' },  // caption for frame 6: the word still passes through the processor
            { cut: 23, ni: 1, mem: 1, hot: 0, st: { path: 'toMem', tok: 'H', R: 'H', cpuLine: 'handler stores word', cpuTone: 'intr' }, lines: [4],  // frame 7: R is written into cell 200 and the cell glows; code line 4 lights up
              cap: 'Then it writes R into memory cell 200. Reading and storing are the only 2 instructions that actually move data.' },  // caption for frame 7: reading and storing are the only 2 instructions that move data
            { cut: 24, ni: 1, mem: 1, st: { path: 'cmd', pathCls: 'cmd', tok: 'READ', R: 'H', cpuLine: 'handler: next word', cpuTone: 'intr', devLine: 'reading…', devTone: io }, lines: [5, 6],  // frame 8: the handler sends the next READ command; code lines 5 and 6 light up
              cap: 'More words are still to come, so the handler sends the next <b>READ</b> command. The disk starts on word 2.' },  // caption for frame 8: more words remain, so the disk starts on word 2
            { cut: 28, ni: 1, mem: 1, st: { R: 'H', cpuLine: 'restoring context', cpuTone: 'intr', devLine: 'reading…', devTone: io }, lines: [7, 8],  // frame 9: restoring Program B's context (4 ticks); code lines 7 and 8 light up
              cap: 'The handler restores Program B’s registers (4 more) and returns; B carries on where it stopped. Word 1 cost <b>11 instructions</b>: its command 1 + save 4 + move 2 + restore 4. (I/O work shows 12: it also counts the command that started word 2.)' },  // caption for frame 9: word 1 cost 11 instructions, and why the I/O counter shows 12
            { cut: 51, ni: 2, mem: 2, st: { R: 'I', cpuLine: 'running Program B', cpuTone: 'proc', cpuSub: 'useful work', devLine: 'reading…', devTone: io }, lines: [],  // frame 10: jumps ahead to tick 51, with word 2 (I) stored after the second interrupt
              cap: '<b>Word 2</b> repeats the pattern. Program B runs only 12 instructions this time, because the disk was already working during the 4-instruction restore. Then: interrupt, save, move <b>I</b> to cell 201, next command, restore.' },  // caption for frame 10: word 2 repeats the pattern, and Program B gets only 12 instructions because the disk overlapped the restore
            { cut: 73, ni: 3, mem: 3, st: { R: '!', cpuLine: 'running Program B', cpuTone: 'proc', cpuSub: 'block is complete' }, lines: [],  // frame 11: tick 73, the whole block is stored after three interrupts
              cap: '<b>Word 3</b> is the last, so no new command. Total: <b>3 interrupts, 33 instructions of I/O work</b> (11 per word), and Program B got 40 instructions done.' },  // caption for frame 11: totals of 3 interrupts, 33 instructions of I/O work, and 40 for Program B
          ];  // closes the frame list
          function stat(v, l, col) { return h('div', { class: 'stat card tight' }, h('span', { class: 'v', style: { color: col ? 'var(--' + col + ')' : null } }, String(v)), h('span', { class: 'l' }, l)); }  // stat(v, l, col): builds one statistic card with a big number, a label and an optional colour
          function render(i) {  // render(i): draws frame i of the animation; the player calls it and shows the caption it returns
            const f = F[i], part = S.acts.slice(0, f.cut);  // f is this frame; part is the ticks of the simulated run up to this frame's tick
            const busyIO = part.filter((a) => a !== 'free').length, freeB = part.length - busyIO;  // busyIO counts the ticks spent on I/O work so far; freeB counts the ticks Program B got
            const mem = ['H', 'I', '!', '', '', ''].map((v, k) => (k < f.mem ? v : ''));  // memory shows H, I and ! in the first cells, but only as many as this frame has stored
            svg.replaceChildren(...busNodes(ctx, Object.assign({ mode: 'io', mem, hot: f.hot, R: '', note: { title: 'Program B', value: freeB + ' done', tone: 'proc', sub: 'instructions' } }, f.st)));  // redraws the bus diagram: I/O module, memory, and a note with Program B's instruction count, plus this frame's own details
            tl.replaceChildren(  // redraws the time line strip underneath
              s('text', { x: 0, y: 13, class: 't13 b' }, 'Processor time line'),  // the strip's title at the top left
              s('text', { x: TW, y: 13, class: 't13 end s-sub' }, 't = ' + f.cut + ' of ' + S.end),  // at the top right, how far along the run this frame is, e.g. "t = 17 of 73"
              ...timelineNodes(ctx, S.acts, { x: 1, y: 26, w: TW - 2, h: 24, tMax: S.end, cut: f.cut, marks: S.ints.slice(0, f.ni), cursor: f.cut }),  // the coloured strip itself, drawn up to this frame's tick, with a triangle for each interrupt so far and a cursor line
              s('text', { x: 1, y: 63, class: 't13 s-sub' }, '▼ = interrupt'));  // a small key under the strip explaining the triangle symbol
            stats.replaceChildren(stat(f.ni, 'Interrupts', 'intr'), stat(busyIO, 'I/O work'), stat(freeB, 'Program B', 'proc'), stat(f.mem + ' / 3', 'Through R', 'cpu'));  // the four statistics: interrupts, I/O work, Program B's instructions, and words that went through register R
            code.clear(); if (f.lines.length) code.mark(f.lines);  // clears the code highlight, then lights up the handler lines this frame is about
            return f.cap;  // hands the caption to the player, which shows it above the controls
          }  // ends render() for the frames
          const player = ctx.ui.player({ count: F.length, render, interval: 2600 });  // player: the guide's step-through control (play, pause, next, back); it calls render() for each frame, 2.6 seconds apart when playing
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // page layout: a vertical stack filling the step
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0,6fr) minmax(0,5fr)' } },  // top part: two columns, the left a little wider
              h('div', { class: 'card white stack', style: { gap: '6px' } }, svg, tl, keyRow(ctx, ['free', 'cmd', 'move', 'ctx'])),  // left: a white card with the diagram, the time line and its colour legend
              h('div', { class: 'stack', style: { gap: '10px' } },  // right: explanation, handler code, statistics and a caution
                h('p', { class: 'm0 small', html: 'In <span class="t">interrupt-driven I/O</span> the processor gives a command and walks away. When a word is ready the module interrupts, and this short handler moves that one word:' }),  // intro paragraph: the processor gives a command and walks away; this handler moves one word per interrupt
                code, stats,  // the handler code and the statistics row
                h('div', { class: 'callout warn m0 small', 'data-label': 'Better, but…', html: 'Program B now gets real work done. Yet every word still passes through register R, and every word costs a whole interrupt: save, move, restore.' }))),  // caution callout: better, but every word still goes through R and costs a whole interrupt
            player.el));  // the player controls go underneath the two columns
        },  // ends render() for step 3
      },  // ends step 3
      /* ============ 4. The two drawbacks both techniques share ============ */
      {  // step 4: the two drawbacks shared by programmed and interrupt-driven I/O
        title: 'Two drawbacks that polling and interrupts share',  // step 4 title
        kind: 'explore',  // step kind "explore"
        html: `${/* step 4's layout as HTML: two drawback cards on the left, an interactive chart card on the right */''}
          <div class="split l fill">${/* two-column layout */''}
            <div class="stack" style="gap:10px">${/* left column: a vertical stack */''}
              <p class="m0">Programmed I/O and interrupt-driven I/O wait in different ways, but they share <b>two drawbacks</b>:</p>${/* intro paragraph: the two techniques wait differently but share two drawbacks */''}
              <div class="card tight" style="border-left:5px solid var(--warn)"><h3 class="m0">1 · A speed limit</h3><p class="small m0">The <span class="t">transfer rate</span> can never be faster than the processor can <b>test and service</b> the device. However quick the device is, each word waits for its turn of processor instructions.</p></div>${/* drawback card 1: the transfer rate is limited by how fast the processor can test and service the device */''}
              <div class="card tight" style="border-left:5px solid var(--intr)"><h3 class="m0">2 · A tied-up processor</h3><p class="small m0">The processor must run instructions for <b>every word</b>: a 4,096-word block means 4,096 rounds of service code and, with interrupts, 4,096 interrupts.</p></div>${/* drawback card 2: the processor must run instructions, and with interrupts take an interrupt, for every word */''}
              <div class="callout why m0 small" data-label="The root cause">In both techniques every word travels through a processor register. Take the processor out of the data path and both drawbacks disappear. That is exactly what <span class="t">DMA</span> does.</div>${/* root-cause callout: every word travels through a processor register, which DMA removes */''}
              <div class="s17-pred"></div>${/* empty slot where render() puts the "Predict" reveal button */''}
            </div>${/* end of the left column */''}
            <div class="card white stack s17-dr" style="gap:8px"></div>${/* right column: an empty white card that render() fills with the slider and chart */''}
          </div>`,  // end of step 4's HTML
        render(el, ctx) {  // render(el, ctx): builds the interactive chart when the step opens
          const { h, s } = ctx;  // h builds page elements and s builds SVG shapes
          const card = ctx.$('.s17-dr');  // card is the empty white card from the HTML
          const NW = ctx.narrow;                       // phones get a narrower viewBox so the labels stay readable
          const svg = s('svg', { viewBox: NW ? '0 0 340 290' : '0 0 620 272', width: '100%', role: 'img', 'aria-label': 'Bars comparing transfer rate and processor time' });  // svg is the bar chart, with a taller, smaller-width drawing area on phones
          const say = h('div', { class: 'callout m0 fb' });  // say is the callout under the chart that explains what the current setting shows
          const fmt = (x) => (x >= 100 ? Math.round(x) : x.toFixed(1));  // fmt(x): shows big numbers rounded to whole numbers and small ones with one decimal
          function draw(D) {  // draw(D): redraws the chart for a device that needs D instruction-times per word; runs whenever the slider moves
            const pio = 1 / (D + 3), int = 1 / (Math.max(D, 4) + 7), dev = 1 / D;  // words per instruction-time: polling needs D+3 per word; interrupts need max(D,4)+7 because the 4-tick restore overlaps device time
            const intBusy = 11 / (Math.max(D, 4) + 7);  // intBusy is the share of processor time spent in the 11 handler instructions for each word
            const X0 = NW ? 118 : 168, BW = NW ? 130 : 300;  // X0 is where the bars start (after their labels) and BW is the full bar width; both shrink on phones
            const bar = (y, label, frac, col, txt) => [  // bar(): builds one labelled bar: label, empty track, filled part (frac of the track) and value text
              s('text', { x: X0 - 10, y: y + 18, class: 't14 end' }, label),  // the bar's label, right-aligned just left of the bar
              s('rect', { x: X0, y, width: BW, height: 26, rx: 6, class: 's-panel', 'stroke-width': 1 }),  // the empty track the bar fills, with rounded corners
              s('rect', { x: X0, y, width: Math.max(2, BW * Math.min(1, frac)), height: 26, rx: 6, style: `fill:var(--${col}-bg);stroke:var(--${col});stroke-width:1.5` }),  // the filled part, at least 2 units wide so a tiny value is still visible, in the colour col
              s('text', { x: X0 + BW + (NW ? 6 : 10), y: y + 18, class: 't14 b', style: `fill:var(--${col})` }, txt)];  // the value written just right of the bar in the same colour
            svg.replaceChildren(  // replaces the whole chart with the new bars
              s('text', { x: 0, y: 15, class: 't14 b' }, 'Words moved per 1,000 instruction-times'),  // heading of the first group: words moved per 1,000 instruction-times
              ...bar(28, 'Device could do', 1, 'io', fmt(1000 * dev)),  // bar: the device's own top speed, always full length
              ...bar(64, 'Programmed I/O', pio / dev, 'warn', fmt(1000 * pio) + '  (' + Math.round(100 * pio / dev) + '%)'),  // bar: programmed I/O's speed, with its percentage of the device's speed
              ...bar(100, 'Interrupt-driven', int / dev, 'intr', fmt(1000 * int) + '  (' + Math.round(100 * int / dev) + '%)'),  // bar: interrupt-driven I/O's speed, with its percentage of the device's speed
              s('text', { x: 0, y: 164, class: 't14 b' }, NW ? 'Processor time eaten by the transfer' : 'Share of processor time eaten by the transfer'),  // heading of the second group, shortened on phones
              ...bar(177, 'Programmed I/O', 1, 'warn', '100%'),  // bar: programmed I/O always uses 100 percent of the processor
              ...bar(213, 'Interrupt-driven', intBusy, 'intr', Math.round(100 * intBusy) + '%'),  // bar: interrupt-driven I/O uses the share intBusy
              ...(NW ? [s('text', { x: 0, y: 268, class: 't13 s-sub' }, 'Model: polling = 1 command + D checks + 2'), s('text', { x: 0, y: 286, class: 't13 s-sub' }, 'moves per word; each interrupt = 11 instructions.')]  // on phones the model note is split over two lines so it fits
                : [s('text', { x: 0, y: 268, class: 't13 s-sub' }, 'Model: polling = 1 command + D checks + 2 moves per word; each interrupt = 11 instructions.')]));  // on wider screens the model note fits on a single line
            if (D <= 4) { say.className = 'callout bad m0 fb'; say.dataset.label = 'Drawback 1: the processor is the bottleneck'; say.innerHTML = `The device could hand over a word every <b>${D}</b> instruction-time${D > 1 ? 's' : ''}. Polling needs ${D + 3} instruction-times per word and each interrupt needs 11, so the data trickles at <b>${Math.round(100 * pio / dev)}%</b> and <b>${Math.round(100 * int / dev)}%</b> of the device’s speed. The processor cannot test and service it any faster.`; }  // fast device (D up to 4): explains drawback 1, the processor itself is the bottleneck
            else if (D <= 15) { say.className = 'callout warn m0 fb'; say.dataset.label = 'Both drawbacks at once'; say.innerHTML = `At ${D} per word the transfer still loses ${Math.round(100 - 100 * pio / dev)}% (polling) and ${Math.round(100 - 100 * int / dev)}% (interrupts) of the device’s speed, and the processor is tied up <b>100%</b> or <b>${Math.round(100 * intBusy)}%</b> of the time.`; }  // medium device (D up to 15): both drawbacks show at once, lost speed and a busy processor
            else { say.className = 'callout why m0 fb'; say.dataset.label = 'Drawback 2: a tied-up processor'; say.innerHTML = `With a slow device (${D} per word) the speed limit hurts less: the transfer reaches ${Math.round(100 * pio / dev)}% and ${Math.round(100 * int / dev)}% of the device’s speed. The bigger cost is processor time: polling burns <b>100%</b>, interrupts about <b>${Math.round(100 * intBusy)}%</b>, just to move words.`; }  // slow device: the speed limit matters less, and the bigger cost is the processor time
          }  // ends draw()
          const sl = ctx.ui.slider({ label: 'Device needs <i>D</i> =', min: 1, max: 60, value: 30, format: (v) => v + ' per word', onInput: draw });  // the slider for D, from 1 to 60, starting at 30; moving it calls draw() with the new value
          card.append(h('h3', { class: 'm0' }, 'Explore: make the device faster'),  // fills the card: a heading asking the student to make the device faster
            h('p', { class: 'small muted m0' }, 'D = instruction-times the device needs to produce one word. Smaller D = faster device.'),  // a short line explaining what D means (smaller D = faster device)
            sl, svg, say);  // then the slider, the chart and the explanation callout
          ctx.$('.s17-pred').append(ctx.ui.reveal('Predict: device 10× faster → polling 10× faster?', '<p class="small m0">No. From 30 to 3 per word the device gets 10× faster, but polling only rises from 30.3 to 166.7 words per 1,000 (about 5.5×): each word still needs 3 service instructions.</p>'));  // puts a "Predict" reveal button in the left column: a 10 times faster device makes polling only about 5.5 times faster
          draw(30);  // draws the chart for the starting value, D = 30
        },  // ends render() for step 4
      },  // ends step 4
      /* ============ 5. Program a DMA module ============ */
      {  // step 5: a lab where the student sets up a DMA module and watches the block move
        title: 'Lab: hand a whole block to the DMA module',  // step 5 title
        kind: 'lab',  // step kind "lab"
        core: true,  // core: true keeps this step on the short "core" route through the guide
        render(el, ctx) {  // render(el, ctx): builds the lab when the step opens
          const { h } = ctx;  // h builds page elements
          const MEM0 = 'hello-world!'.split('');                       // what memory holds before the transfer
          const DEVDATA = { 3: 'SECTOR42'.split(''), 5: 'PACKET#7'.split('') };  // what each device will deliver: the disk (number 3) sends SECTOR42 and the network card (number 5) sends PACKET#7
          const DEVNAME = { 3: 'Disk', 5: 'Network' };  // display names for device numbers 3 and 5
          const D = 10;                                                  // device needs 10 ticks per word (as in the model)
          const f = { op: 'READ', dev: 3, start: 204, n: 5 };  // f holds the four items the student chooses: operation, device number, start address and word count
          let st, gen = 0;  // st is the lab's state; gen counts runs so an old run can notice it was replaced and stop
          const svg = busSvg(ctx);  // svg is the bus diagram
          const log = h('div', { class: 'log s17-log' });  // log is the scrolling list of events under the diagram
          const stats = h('div', { class: 'grid-4', style: { gap: '8px' } });  // stats is the row of four statistic cards
          const range = h('div', { class: 's17-range' });  // range is the line that describes the chosen block, or warns when it does not fit in memory
          function fresh() {  // fresh(): builds a clean state for a new run
            st = { mem: MEM0.slice(), dma: { op: '', dev: '', addr: '', count: '' }, data: '', hotReg: '', path: null, tok: null, cls: null, hot: null, intr: false,  // memory back to its starting contents, empty DMA registers, nothing highlighted, no interrupt
              cpu: 'running Program A', tone: 'cpu', sub: 'about to request a block', dev: 'idle', devTone: 'muted', instr: 0, stolen: 0, ints: 0, B: 0, running: false, got: '' };  // the processor is running Program A, all counters at zero, and nothing received from the device yet
          }  // ends fresh()
          function stat(v, l, col) { return h('div', { class: 'stat card tight' }, h('span', { class: 'v', style: { color: col ? 'var(--' + col + ')' : null } }, String(v)), h('span', { class: 'l' }, l)); }  // stat(v, l, col): builds one statistic card with a big number, a label and an optional colour
          function paint() {  // paint(): redraws the diagram and the statistics from the current state
            svg.replaceChildren(...busNodes(ctx, { mode: 'dma', mem: st.mem, hot: st.hot, sel: valid() ? [f.start - 200, f.start - 200 + f.n] : null, R: '', dma: st.dma, data: st.data, hotReg: st.hotReg, path: st.path, pathCls: st.cls, tok: st.tok, frac: 0.55,  // redraws the bus with a DMA module; the chosen block is outlined in memory (sel) when it fits; R stays empty in DMA
              intr: st.intr, cpuLine: st.cpu, cpuTone: st.tone, cpuSub: st.sub, devName: DEVNAME[f.dev], devIcon: f.dev === 5 ? 'net' : 'disk', devLine: st.dev, devTone: st.devTone,  // interrupt flag, processor status lines, and the device's name, icon (disk or network card) and status line
              note: { title: 'Program B', value: st.B + ' done', tone: 'proc', sub: 'instructions' } }));  // the note box counts the instructions Program B has finished
            stats.replaceChildren(stat(st.instr, 'Processor I/O work'), stat(st.stolen, 'Stolen cycles', 'accent'), stat(st.ints, 'Interrupts', 'intr'), stat(0, 'Words through R', 'cpu'));  // the statistics: processor I/O instructions, stolen cycles, interrupts, and words through R, which is always 0 with DMA
          }  // ends paint()
          function addLog(html) { log.append(h('div', { html })); log.scrollTop = log.scrollHeight; }  // addLog(html): adds one line to the event log and scrolls it so the newest line is visible
          function valid() { return f.start + f.n - 1 <= 211; }  // valid(): true when the chosen block fits in memory, whose last cell here is 211
          function paintRange() {  // paintRange(): updates the line that describes the chosen block, and enables or disables the Send button
            const ok = valid();  // ok says whether the block fits
            range.className = 's17-range' + (ok ? '' : ' bad');  // turns the line red when it does not fit
            range.innerHTML = ok ? `Block: <b>${f.n}</b> word${f.n > 1 ? 's' : ''}, cells <b>${f.start}–${f.start + f.n - 1}</b>, ${f.op === 'READ' ? DEVNAME[f.dev].toLowerCase() + ' → memory' : 'memory → ' + DEVNAME[f.dev].toLowerCase()}.`  // when it fits: how many words, which cells, and the direction (device to memory for READ, memory to device for WRITE)
              : `The block would need cells up to <b>${f.start + f.n - 1}</b>, but memory here ends at 211. Choose an earlier start or fewer words.`;  // when it does not fit: how far the block would reach, and what to change
            go.disabled = !ok || (st && st.running);  // the Send button only works when the block fits and no transfer is already running
          }  // ends paintRange()
          function reset() { gen++; fresh(); log.replaceChildren(); addLog('Fill in the four items, then press <b>Send to DMA module</b>.'); paint(); paintRange(); }  // reset(): cancels any running transfer (by bumping gen), clears the state and the log, shows the first hint, and redraws
          async function run() {  // run(): plays one whole DMA transfer step by step; async means it can pause with await between steps
            if (!valid() || st.running) return;  // refuses to start when the block does not fit or a transfer is already running
            const my = ++gen; fresh(); st.running = true; log.replaceChildren(); paintRange();  // my is this run's number; starts clean, marks the lab busy, clears the log and disables the Send button
            const alive = () => ctx.alive && gen === my;  // alive(): true while the student is still on this step and no newer run or reset has replaced this one
            const wait = async (ms) => { await ctx.sleep(ms); return alive(); };  // wait(ms): pauses for ms milliseconds, then reports whether this run should keep going
            const read = f.op === 'READ', words = read ? DEVDATA[f.dev].slice(0, f.n) : st.mem.slice(f.start - 200, f.start - 200 + f.n);  // read is true for READ; words is what will move: the device's data for a read, or the memory contents for a write
            const items = [['op', f.op, 'Operation = ' + f.op + ' (on the read/write control line)'], ['dev', '#' + f.dev, 'Device = #' + f.dev + ' (' + DEVNAME[f.dev].toLowerCase() + ', on the data lines)'],  // items: the four setup items as register key, value and log text; first operation and device number
              ['addr', String(f.start), 'Start address = ' + f.start + ' → address register'], ['count', String(f.n), 'Word count = ' + f.n + ' → count register']];  // then the start address (into the address register) and the word count (into the count register)
            for (let i = 0; i < 4; i++) {  // the processor writes the four items into the DMA module one at a time
              const [k, v, txt] = items[i];  // k is the register name, v the value, txt the log line for this item
              Object.assign(st, { path: 'cmd', cls: 'cmd', tok: v, hotReg: k, cpu: 'setting up the DMA', tone: 'cpu', sub: 'item ' + (i + 1) + ' of 4' });  // shows the value travelling from the processor to the DMA module, with that register glowing
              st.dma[k] = v; st.instr++;  // stores the value in the DMA register and counts one processor instruction
              addLog('<b>P → DMA</b> ' + txt); paint();  // logs "P to DMA" with this item and redraws
              if (!(await wait(750))) return;  // waits 0.75 seconds; stops quietly if the student left or pressed Reset
            }  // ends the setup loop
            Object.assign(st, { path: null, tok: null, hotReg: '', cpu: 'running Program B', tone: 'proc', sub: 'the DMA does the rest', dev: read ? 'reading…' : 'waiting', devTone: 'io' });  // setup is over: the processor goes back to Program B and the device starts (reading, or waiting for data on a write)
            addLog('<b>Processor</b> goes back to Program B. From here on the DMA module works alone.'); paint();  // logs that the DMA module now works alone, and redraws
            for (let k = 0; k < f.n; k++) {  // moves the block one word at a time
              const c = words[k], addr = f.start + k, freeTicks = k === 0 ? D : D - 1;  // c is this word, addr its memory address; freeTicks is how many ticks Program B runs before the word (one tick is the stolen cycle)
              if (read) {  // READ: device to memory
                for (let j = 0; j < freeTicks; j++) { st.B++; paint(); if (!(await wait(45))) return; }  // while the device produces the word, Program B runs one instruction per tick, shown as a quick count-up
                Object.assign(st, { path: 'dev', cls: 'data', tok: c, data: c, hotReg: 'data', dev: 'word ready', devTone: 'ok' }); paint();  // the word arrives from the device into the DMA module's data register
                if (!(await wait(450))) return;  // holds that for 0.45 seconds so the student can see it
                Object.assign(st, { path: 'ctlToMem', tok: c, hot: addr - 200, hotReg: 'addr count', cpu: 'paused 1 bus cycle', tone: 'accent', sub: 'the DMA is using the bus' });  // the DMA module writes the word to memory: the cell glows, and the processor pauses for 1 bus cycle
                st.mem[addr - 200] = c; st.stolen++;  // puts the word in memory and counts one stolen cycle
              } else {  // WRITE: memory to device
                Object.assign(st, { path: 'memToCtl', cls: 'data', tok: c, hot: addr - 200, data: c, hotReg: 'addr count data', cpu: 'paused 1 bus cycle', tone: 'accent', sub: 'the DMA is using the bus' });  // the DMA module reads the word from memory into its data register; the processor pauses for 1 bus cycle
                st.stolen++;  // counts one stolen cycle
              }  // ends the read/write choice for this word
              st.dma.addr = String(addr + 1); st.dma.count = String(f.n - k - 1); paint();  // the address register goes up by one and the count register down by one, then redraw
              addLog(`<b>DMA</b> ${read ? `“${c}” → memory[${addr}]` : `memory[${addr}] “${c}” → DMA`} · 1 bus cycle stolen · count now ${f.n - k - 1}`);  // logs which word moved where, that 1 bus cycle was stolen, and the new count
              if (!(await wait(700))) return;  // holds for 0.7 seconds
              Object.assign(st, { hot: null, hotReg: '', cpu: 'running Program B', tone: 'proc', sub: 'the DMA does the rest' });  // clears the highlights; the processor is back on Program B
              if (read) Object.assign(st, { path: null, tok: null, data: '', dev: k < f.n - 1 ? 'reading…' : 'idle', devTone: k < f.n - 1 ? 'io' : 'muted' });  // after a read: clear the route and data register; the device keeps reading unless this was the last word
              else {  // after a write
                st.got += c;  // adds the word to what the device has received so far
                Object.assign(st, { path: 'toDev', tok: c, dev: 'got ' + st.got.slice(-6), devTone: 'io' }); paint();  // shows the word going from the DMA module to the device, whose status line lists the last 6 characters received
                for (let j = 0; j < freeTicks; j++) { st.B++; paint(); if (!(await wait(45))) return; }  // meanwhile Program B keeps running, one instruction per tick
                Object.assign(st, { path: null, tok: null, data: '' });  // clears the route and the data register
              }  // ends the write branch
              paint();  // redraws after the word is done
            }  // ends the loop over words
            Object.assign(st, { intr: true, cpu: 'INTERRUPT: block done', tone: 'intr', sub: 'count reached 0' }); st.ints = 1; paint();  // count reached 0: the DMA module raises its one interrupt, and the processor shows it
            addLog('<b>DMA → P</b> INTERRUPT: count is 0, the whole block is done.');  // logs the completion interrupt
            if (!(await wait(1000))) return;  // holds for 1 second
            st.instr += 10; Object.assign(st, { intr: false, cpu: 'completion handler', tone: 'intr', sub: 'save, check status, restore' }); paint();  // the completion handler costs 10 processor instructions: save context, check status, restore
            addLog('<b>Processor</b> handles the one interrupt: save context, check the DMA status, restore (10 instructions).');  // logs what the handler does
            if (!(await wait(900))) return;  // holds for 0.9 seconds
            Object.assign(st, { cpu: 'running Program B', tone: 'proc', sub: 'block transfer finished', running: false }); paint(); paintRange();  // back to Program B; the lab is no longer busy, so the Send button works again
            addLog(`<b>Done.</b> ${f.n} words for <b>14</b> processor instructions and ${f.n} stolen cycles. Interrupt-driven I/O would have needed ${11 * f.n} instructions and ${f.n} interrupts; polling at least ${13 * f.n}.`);  // final log line: 14 processor instructions in all, compared with 11 per word for interrupts and at least 13 per word for polling
          }  // ends run()
          const change = (k) => (v) => { f[k] = v; reset(); };  // change(k): makes a handler that stores a new choice for item k and resets the lab
          const opSeg = ctx.ui.seg([{ value: 'READ', label: 'Read: device → memory' }, { value: 'WRITE', label: 'Write: memory → device' }], f.op, change('op'));  // item 1 control: a two-button switch between READ (device to memory) and WRITE (memory to device)
          const devSeg = ctx.ui.seg([{ value: 3, label: 'Disk (#3)' }, { value: 5, label: 'Network card (#5)' }], f.dev, change('dev'));  // item 2 control: a switch between the disk (device 3) and the network card (device 5)
          const sStart = ctx.ui.slider({ label: 'Address', min: 200, max: 211, value: f.start, onInput: change('start') });  // item 3 control: a slider for the start address, 200 to 211
          const sN = ctx.ui.slider({ label: 'Words', min: 1, max: 8, value: f.n, onInput: change('n') });  // item 4 control: a slider for the word count, 1 to 8
          const go = h('button', { class: 'btn primary', type: 'button', onclick: run }, 'Send to DMA module ▶');  // the main button that starts the transfer
          const again = h('button', { class: 'btn', type: 'button', onclick: reset }, 'Reset');  // the Reset button
          const item = (n, title, hint, control) => h('div', { class: 's17-item' }, h('span', { class: 's17-n' }, String(n)),  // item(): builds one numbered setup row: a number badge, then a title and hint above the control
            h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '6px' } }, h('b', { class: 'small' }, title), h('span', { class: 'xs muted', html: hint })), control));  // inside the row: the title on the left and a small hint on the right, then the control underneath
          reset();  // sets up the starting state before the page is shown
          el.append(h('div', { class: 'split l fill' },  // page layout: two columns
            h('div', { class: 'card stack', style: { gap: '8px' } },  // left column: the setup card
              h('p', { class: 'small m0', html: 'You are the processor again, but now you only <b>set up</b> the <span class="t">block transfer</span>: write four items into the <span class="t">DMA module</span>, then walk away.' }),  // intro paragraph: you only set up the block transfer by writing four items, then walk away
              item(1, 'Read or write?', 'control line', opSeg),  // setup row 1: read or write, which travels on a control line
              item(2, 'Which I/O device?', 'its address', devSeg),  // setup row 2: which device, given by its address
              item(3, 'Start address in memory', '→ <span class="t">address register</span>', sStart),  // setup row 3: the start address, which goes into the address register
              item(4, 'How many words?', '→ <span class="t">count register</span>', sN),  // setup row 4: the word count, which goes into the count register
              range,  // the line describing the chosen block
              h('div', { class: 'row' }, go, again),  // the Send and Reset buttons side by side
              h('div', { class: 'callout why m0 small', 'data-label': 'Why this works', html: 'The DMA module <b>does the processor’s bus work itself</b>: it puts each word’s address on the bus, moves the word, and updates its own address and count registers. The processor acts only at the start and at the end.' })),  // why-this-works callout: the DMA module does the processor's bus work itself and updates its own registers
            h('div', { class: 'card white stack', style: { gap: '8px' } }, svg, stats, log)));  // right column: a white card with the diagram, the statistics and the event log
        },  // ends render() for step 5
      },  // ends step 5
      /* ============ 6. Cycle stealing ============ */
      {  // step 6: cycle stealing, how the DMA module shares the bus with the processor
        title: 'Cycle stealing: the DMA module borrows the bus',  // step 6 title
        kind: 'explore',  // step kind "explore"
        render(el, ctx) {  // render(el, ctx): builds the step when it opens
          const { h, s } = ctx;  // h builds page elements and s builds SVG shapes
          const C = 20, LONG = 1000;         // the strip shows 20 cycles; the totals cover 1,000
          const STAGE = { F: ['fetch the next instruction', 1], D: ['decode the instruction', 0], O: ['fetch an operand', 1], X: ['execute the operation', 0], W: ['write the result to memory', 1] };  // STAGE: the stages an instruction can go through; the number is 1 if that stage needs the bus, 0 if it stays inside the processor
          /* A fixed (seeded) mix of 3- to 5-stage instructions, so the DMA module's regular
             steals do not lock onto one repeating instruction pattern. */
          const TYPES = ['FDOX', 'FDX', 'FDXW', 'FDOXW'], STREAM = [], ENDS = [];  // TYPES: four instruction shapes as stage letters; STREAM will hold the stage of every cycle, ENDS the cycles where instructions end
          const rnd = ctx.util.seeded(3);  // rnd is a seeded random number generator: it gives the same "random" sequence on every visit, so the strip always looks the same
          while (STREAM.length < LONG + 8) { const t = TYPES[Math.floor(rnd() * TYPES.length)]; for (let j = 0; j < t.length; j++) { STREAM.push(t[j]); ENDS.push(j === t.length - 1); } }  // builds the instruction stream: picks instruction shapes at random and lists their stages one cycle at a time, marking each last stage
          let BASE = 0; for (let c = 0; c < LONG; c++) if (ENDS[c]) BASE++;   // instructions finished with no DMA at all
          let k = 4, R = null;  // k is how often the DMA module takes the bus (every k-th cycle, 4 to start); R will hold the simulation result
          function sim(k) {  // sim(k): runs 1,000 cycles with the DMA module stealing every k-th one, and counts what happens
            const cyc = []; let p = 0, paused = 0, stolen = 0, done = 0;  // cyc keeps the first cycles for drawing; p is the processor's place in the stream; then counters for pauses, steals and finished instructions
            for (let c = 0; c < LONG; c++) {  // one pass per bus cycle
              const dma = c % k === k - 1, stg = STREAM[p], bus = STAGE[stg][1];  // dma is true when this is a stolen cycle; stg is the stage the processor wants to do; bus says whether that stage needs the bus
              let x;  // x will describe this cycle for the drawing
              if (dma) stolen++;  // every stolen cycle moves one word for the DMA module
              if (dma && bus) { paused++; x = { c, dma, owner: 'DMA', proc: 'wait', stg, end: false }; }  // a steal when the processor needed the bus: the processor waits and does not move on in its stream
              else { x = { c, dma, owner: dma ? 'DMA' : bus ? 'CPU' : 'idle', proc: 'run', stg, end: ENDS[p] }; if (ENDS[p]) done++; p++; }  // otherwise the processor does its stage (the bus belongs to the DMA module, the processor, or nobody); count finished instructions
              if (c < C) cyc.push(x);  // only the first C cycles are kept for the drawing
            }  // ends the cycle loop
            return { cyc, paused, stolen, free: stolen - paused, done };  // returns the kept cycles and totals: pauses, steals, harmless steals (steals minus pauses) and instructions finished
          }  // ends sim()
          const svg = s('svg', { viewBox: ctx.narrow ? `0 0 340 ${34 + C * 30}` : '0 0 1100 150', width: '100%', role: 'img', 'aria-label': 'Bus cycles shared by the processor and the DMA module' });  // svg is the cycle strip: a tall one-row-per-cycle drawing on phones, a wide one-column-per-cycle drawing otherwise
          const wrap = h('div', {}, svg);  // wrap is a plain container around the drawing
          const stats = h('div', { class: 'grid-2', style: { gap: '6px' } });  // stats is a 2 by 2 grid of statistic cards
          const slow = h('div', { class: 'small', style: { lineHeight: '1.35' } });  // slow is the line that says what share of processor cycles was lost
          function stat(v, l, col) { return h('div', { class: 'stat card tight s17-cs' }, h('span', { class: 'v', style: { color: col ? 'var(--' + col + ')' : null } }, String(v)), h('span', { class: 'l' }, l)); }  // stat(v, l, col): builds one compact statistic card
          function cellTexts(x) {  // cellTexts(x): picks the bus cell's label (P for the processor, DMA, or idle), its box colour and its text colour
            return { owner: x.owner === 'CPU' ? 'P' : x.owner, ownerCls: x.owner === 'DMA' ? 's-accent' : x.owner === 'CPU' ? 's-cpu' : 's-panel', ownerCol: x.owner === 'idle' ? 'fill:var(--muted)' : `fill:var(--${x.owner === 'DMA' ? 'accent' : 'cpu'})` };  // returns those three: the label, a box class by owner, and a text colour (muted for idle)
          }  // ends cellTexts()
          function drawV(i) {              /* phones: one row per cycle */
            const n = [], cols = [['Cycle', 22], ['DMA', 110], ['Bus', 200], ['Processor', 290]];  // four column headings with their x positions: cycle number, DMA module, bus, processor
            cols.forEach(([t, x]) => n.push(s('text', { x, y: 18, class: 't13 mid b' }, t)));  // writes the four headings across the top
            R.cyc.forEach((x, c) => {  // one row per cycle
              const y = 30 + c * 30, g = s('g', { style: 'opacity:' + (c > i ? 0.22 : 1) }), o = cellTexts(x);  // y is the row's top; cycles not yet reached are faded; o holds the bus cell's texts
              g.append(s('text', { x: 22, y: y + 17, class: 't13 mid s-sub' }, String(c)));  // the cycle number on the left
              g.append(s('rect', { x: 70, y, width: 80, height: 24, rx: 5, class: x.dma ? 's-accent' : 's-panel', 'stroke-width': 1.2, style: x.dma ? null : 'stroke-dasharray:3 3' }));  // the DMA cell: accent colour when the DMA module moves a word this cycle, a dashed empty box otherwise
              if (x.dma) g.append(s('text', { x: 110, y: y + 17, class: 't13 mid b', style: 'fill:var(--accent)' }, 'word'));  // writes "word" in the DMA cell when a word moves
              g.append(s('rect', { x: 160, y, width: 80, height: 24, rx: 5, class: o.ownerCls, 'stroke-width': 1.2 }));  // the bus cell, coloured by who owns the bus this cycle
              g.append(s('text', { x: 200, y: y + 17, class: 't13 mid b', style: o.ownerCol }, o.owner));  // the bus owner's label: P, DMA or idle
              g.append(s('rect', { x: 250, y, width: 80, height: 24, rx: 5, class: x.proc === 'wait' ? 's-warn' : 's-cpu', 'stroke-width': 1.2 }));  // the processor cell: warning colour when it has to wait, processor colour when it works
              g.append(s('text', { x: 290, y: y + 17, class: 't13 mid b', style: x.proc === 'wait' ? 'fill:var(--warn)' : null }, x.proc === 'wait' ? 'wait' : x.stg));  // the processor cell's text: "wait", or the letter of the stage it did
              if (x.end) g.append(s('path', { d: `M${332},${y + 12} l6,9 l-12,0 z`, style: 'fill:var(--intr)' }));  // a small triangle at the right edge when this cycle ends an instruction
              n.push(g);  // adds the row to the drawing
            });  // ends the loop over rows
            if (i >= 0) n.push(s('rect', { x: 2, y: 30 + i * 30 - 3, width: 336, height: 30, rx: 7, style: 'fill:none;stroke:var(--ink);stroke-width:2' }));  // a dark outline around the current cycle's row
            svg.replaceChildren(...n);  // replaces the drawing with the new rows
          }  // ends drawV()
          function draw(i) {  // draw(i): draws the strip up to cycle i; the player calls it for every frame
            if (ctx.narrow) return drawV(i);  // phones use the one-row-per-cycle drawing instead
            const X0 = 132, P = 48, W = 44, n = [];  // X0 is where the first column starts, P the space per column, W each cell's width; n collects the shapes
            [['DMA module', 40], ['System bus', 80], ['Processor', 120]].forEach(([t, y]) => n.push(s('text', { x: 0, y: y + 5, class: 't14 b' }, t)));  // row labels on the left: DMA module, system bus and processor
            R.cyc.forEach((x, c) => {  // one column per cycle
              const cx = X0 + c * P, op = c > i ? 0.22 : 1, g = s('g', { style: 'opacity:' + op });  // cx is the column's left edge; cycles not yet reached are faded
              g.append(s('text', { x: cx + W / 2, y: 13, class: 't13 mid s-sub' }, String(c)));  // the cycle number above the column
              g.append(s('rect', { x: cx, y: 26, width: W, height: 28, rx: 5, class: x.dma ? 's-accent' : 's-panel', 'stroke-width': 1.2, style: x.dma ? null : 'stroke-dasharray:3 3' }));  // the DMA row: accent colour when the DMA module moves a word, a dashed empty box otherwise
              if (x.dma) g.append(s('text', { x: cx + W / 2, y: 45, class: 't13 mid b', style: 'fill:var(--accent)' }, 'word'));  // writes "word" in the DMA cell when a word moves
              g.append(s('rect', { x: cx, y: 66, width: W, height: 28, rx: 5, class: x.owner === 'DMA' ? 's-accent' : x.owner === 'CPU' ? 's-cpu' : 's-panel', 'stroke-width': 1.2 }));  // the bus row, coloured by who owns the bus
              g.append(s('text', { x: cx + W / 2, y: 85, class: 't13 mid b', style: x.owner === 'idle' ? 'fill:var(--muted)' : `fill:var(--${x.owner === 'DMA' ? 'accent' : 'cpu'})` }, x.owner === 'CPU' ? 'P' : x.owner));  // the bus owner's label: P for the processor, DMA, or a muted "idle"
              g.append(s('rect', { x: cx, y: 106, width: W, height: 28, rx: 5, class: x.proc === 'wait' ? 's-warn' : 's-cpu', 'stroke-width': 1.2 }));  // the processor row: warning colour when it has to wait, processor colour when it works
              g.append(s('text', { x: cx + W / 2, y: 125, class: 't14 mid b', style: x.proc === 'wait' ? 'fill:var(--warn)' : null }, x.proc === 'wait' ? 'wait' : x.stg));  // the processor cell's text: "wait", or the stage letter it did
              if (x.end) g.append(s('path', { d: `M${cx + W + 2},${136} l-5,9 l10,0 z`, style: 'fill:var(--intr)' }));  // a small upward triangle under the column when this cycle ends an instruction
              n.push(g);  // adds the column to the drawing
            });  // ends the loop over columns
            if (i >= 0) n.push(s('rect', { x: X0 + i * P - 3, y: 20, width: W + 6, height: 120, rx: 8, style: 'fill:none;stroke:var(--ink);stroke-width:2' }));  // a dark outline around the current cycle's column
            svg.replaceChildren(...n);  // replaces the drawing with the new columns
          }  // ends draw()
          function caption(i) {  // caption(i): builds the explanation under the strip for cycle i
            const x = R.cyc[i], [what] = STAGE[x.stg];  // x is this cycle; what is the plain-words description of the stage the processor wanted
            let t = `<b>Cycle ${i}.</b> `;  // the caption starts with the cycle number in bold
            if (x.dma && x.proc === 'wait') t += `The DMA module has a word ready and takes the bus. The processor needed the bus to <b>${what}</b>, so it simply <b>pauses for this one cycle</b> and does it next cycle. Nothing is saved; no handler runs.`;  // a steal that clashes: the processor wanted the bus, so it pauses for one cycle; nothing is saved and no handler runs
            else if (x.dma) t += `The DMA module takes the bus, but this cycle the processor only has to <b>${what}</b>, which happens inside the processor. It carries on: this steal costs nothing.`;  // a harmless steal: the processor's stage stays inside itself, so it carries on and loses nothing
            else if (x.owner === 'CPU') t += `The processor uses the bus to <b>${what}</b>.`;  // a normal cycle where the processor uses the bus
            else t += `The processor is busy inside itself: it has to <b>${what}</b>, so the bus is idle.`;  // a cycle where nobody uses the bus because the processor is working inside itself
            if (x.end) t += ' This ends an instruction (▲): only here would it check for interrupts.';  // at an instruction's end, adds that this is the only point where it would check for interrupts
            return t;  // hands the caption to the player
          }  // ends caption()
          function paintStats() {  // paintStats(): refreshes the four statistics and the lost-time line
            stats.replaceChildren(stat(R.stolen, 'Words moved by DMA', 'accent'), stat(R.free, 'Harmless steals', 'ok'),  // words moved by DMA and harmless steals
              stat(R.paused, 'Processor pauses', 'warn'), stat(R.done, `Instructions finished (${BASE} with no DMA)`, 'cpu'));  // processor pauses, and instructions finished compared with how many finish with no DMA at all
            slow.innerHTML = `Over ${LONG.toLocaleString('en-US')} cycles: <b>${ctx.util.fmt(100 * R.paused / LONG, 1)}%</b> of processor cycles lost`;  // the share of the 1,000 cycles in which the processor was paused, to one decimal place
          }  // ends paintStats()
          R = sim(k);  // runs the simulation once for the starting setting
          const player = ctx.ui.player({ count: C, start: C - 1, interval: 1300, render: (i) => { draw(i); return caption(i); } });  // player: steps through the first 20 cycles, starting on the last one so the full strip shows; each frame draws and returns a caption
          const sl = ctx.ui.slider({ label: 'DMA word every', min: 2, max: 10, value: k, format: (v) => v + ' cycles', onInput: (v) => { k = v; R = sim(k); paintStats(); player.stop(); player.go(C - 1); } });  // slider for how often the DMA module takes a word (every 2 to 10 cycles); moving it re-simulates and shows the full strip again
          paintStats();  // shows the statistics for the starting setting
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // page layout: a vertical stack filling the step
            h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)', height: 'auto' } },  // top part: two columns, the left a little wider, sized to their content
              h('div', { class: 'stack', style: { gap: '8px' } },  // left: the explanation and two callouts
                h('p', { class: 'm0', html: 'The DMA module needs the <span class="t">system bus</span> for every word it moves, but the processor also uses that bus to fetch instructions and data. The DMA module wins: it takes the bus for <b>one <span class="t">bus cycle</span></b> at a time. This is <span class="t">cycle stealing</span>.' }),  // paragraph: the DMA module and the processor share the bus, and the DMA module takes it one bus cycle at a time
                h('div', { class: 'grid-2', style: { gap: '8px' } },  // a pair of callouts side by side
                  h('div', { class: 'callout warn m0 small', 'data-label': 'Not an interrupt', html: 'No context is saved and no handler runs. The processor just waits one cycle, even mid-instruction.' }),  // callout: this is not an interrupt; the processor just waits one cycle, even in the middle of an instruction
                  h('div', { class: 'callout why m0 small', 'data-label': 'Still worth it', html: 'The processor runs somewhat slower, but losing at most one bus cycle per word beats running 11 instructions per word.' }))),  // callout: still worth it, because at most one lost cycle per word beats 11 instructions per word
              h('div', { class: 'card stack', style: { gap: '6px' } }, sl, slow, stats)),  // right: a card with the slider, the lost-time line and the statistics
            h('div', { class: 'card white', style: { padding: '6px 12px' } }, wrap,  // below: a white card holding the cycle strip
              h('div', { class: 'xs muted', style: { marginTop: '2px' } }, 'F fetch instruction · D decode · O fetch operand · X execute · W write result (each instruction uses 3 to 5 of these). F, O, W need the bus; D, X do not. ▲ = instruction ends.')),  // key under the strip: what each stage letter means, which stages need the bus, and the triangle symbol
            player.el));  // the player controls at the bottom
        },  // ends render() for step 6
      },  // ends step 6
      /* ============ 7. The race + flowcharts ============ */
      {  // step 7: a race between the three techniques moving the same block
        title: 'The race: one block, three techniques',  // step 7 title
        kind: 'compare',  // step kind "compare"
        core: true,  // core: true keeps this step on the shorter core route
        render(el, ctx) {  // render(el, ctx): builds the race when the step opens
          const { h, s } = ctx;  // h builds page elements and s builds SVG shapes
          const TECH = [['pio', 'Programmed I/O', 'warn'], ['int', 'Interrupt-driven', 'intr'], ['dma', 'DMA', 'accent']];  // TECH: the three race lanes, each with its technique key, display name and colour
          let N = 8, D = 30;  // N is how many words the block has; D is how many ticks the device needs per word (slow device to start)
          function raceTab(p) {  // raceTab(p): builds the Race tab inside panel p; the tabs control calls it when the tab is chosen
            let R, tMax, stop = null;  // R holds the three simulation results; tMax is the longest finishing time; stop cancels a running animation
            const lanes = TECH.map(([k, name, col]) => {  // builds one lane per technique
              const now = h('div', { class: 'xs muted', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }), words = h('div', { class: 'xs' });  // now shows what the lane's processor is doing at this moment; words shows how many words are in memory
              const svg = s('svg', { viewBox: '0 0 600 48', width: '100%', role: 'img', 'aria-label': name + ' processor time line' });  // the lane's time line strip
              const info = h('div', { class: 's17-info' });  // info is the lane's right-hand column of running totals
              const row = h('div', { class: 's17-lane', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0,1fr)' } : null }, h('div', { class: 'stack', style: { gap: '2px' } }, h('div', { class: 'b', style: { color: `var(--${col})` } }, name), now, words), svg, info);  // the lane row: name, "now" and "words" on the left, the strip in the middle, totals on the right; on phones they stack in one column
              return { k, now, words, svg, info, row };  // keeps the lane's parts so paint() can update them
            });  // ends the lane builder
            const verdict = h('div', { class: 'callout m0 fb' });  // verdict is the callout under the lanes: a prediction prompt before the race, the result after
            function compute() { R = {}; TECH.forEach(([k]) => (R[k] = simulate(k, N, D))); tMax = Math.max(...TECH.map(([k]) => R[k].end)); }  // compute(): simulates all three techniques for the current N and D and finds the latest finishing tick
            function paint(cut) {  // paint(cut): redraws every lane as it looks at tick cut
              lanes.forEach((L) => {  // for each lane
                const S = R[L.k], c = Math.min(cut, S.end), part = S.acts.slice(0, c);  // S is this lane's result; c is the cut limited to when this lane finished; part is its ticks so far
                const free = part.filter((a) => a === 'free').length, stolen = part.filter((a) => a === 'stolen').length, io = c - free - stolen;  // counts so far: ticks free for Program B, ticks paused by stolen cycles, and the rest spent on I/O work
                const stored = S.stores.filter((x) => x <= c).length, ints = S.ints.filter((x) => x < c).length;  // words already in memory, and interrupts that have happened
                const nodes = timelineNodes(ctx, S.acts, { x: 0, y: 11, w: 600, h: 22, tMax, cut: c, marks: S.ints.filter((x) => x < c), cursor: cut < S.end && cut > 0 ? c : null });  // the lane's strip drawn to the same time scale for all lanes, with interrupt triangles and a moving cursor while running
                for (let i = 0; i < N; i++) nodes.push(s('rect', { x: i * 600 / N + 1, y: 38, width: Math.max(2, 600 / N - 3), height: 9, rx: 2, style: i < stored ? 'fill:var(--mem-bg);stroke:var(--mem)' : 'fill:var(--panel-3);stroke:var(--line-2)', 'stroke-width': 1 }));  // under the strip, one small box per word, filled in the memory colour once that word is stored
                L.svg.replaceChildren(...nodes);  // puts the new shapes into the lane's strip
                L.now.innerHTML = cut >= S.end ? `<b style="color:var(--ok)">finished at t = ${S.end}</b>` : cut > 0 ? KIND[S.acts[c]].toLowerCase() : 'ready to start';  // the "now" line: finished (with its time), the current kind of work, or "ready to start"
                L.words.innerHTML = `words in memory: <b>${stored} / ${N}</b>`;  // the words-in-memory count, e.g. 3 / 8
                L.info.innerHTML = `Processor on I/O: <b>${io}</b>${c ? ' (' + Math.round(100 * io / c) + '%)' : ''}<br>Paused by stolen cycles: <b>${stolen}</b><br>Free for Program B: <b style="color:var(--proc)">${free}</b><br>Interrupts: <b>${ints}</b> · words via R: <b>${L.k === 'dma' ? 0 : stored}</b>`;  // the totals: I/O time with its share, paused time, free time for Program B, interrupts, and words that went through R
              });  // ends the loop over lanes
            }  // ends paint()
            function showVerdict(done) {  // showVerdict(done): fills the callout under the lanes
              const a = R.pio, b = R.int, c = R.dma;  // a, b and c are the programmed, interrupt and DMA results
              if (!done) { verdict.className = 'callout tip m0 fb'; verdict.dataset.label = 'Predict first'; verdict.innerHTML = 'Which lane will leave the most time for Program B? Which will finish first? Press <b>Run the race</b>.'; return; }  // before the race ends: asks the student to predict which lane leaves Program B the most time and which finishes first
              verdict.className = 'callout why m0 fb'; verdict.dataset.label = 'Result';  // after the race: the callout becomes a Result
              let t = `Processor time spent on the transfer: polling <b>${a.io}</b>, interrupts <b>${b.io}</b>, DMA <b>${c.io}</b> (4 setup + 10 for its one interrupt), plus ${c.stolen} stolen cycle${c.stolen > 1 ? 's' : ''}.`;  // first sentence: processor time spent on the transfer by each technique, with DMA's 4 setup and 10 interrupt instructions
              if (N === 1) t += ' With a single word DMA’s fixed cost (14) is more than one interrupt (11): DMA pays off for <b>multiple-word</b> transfers.';  // with one word, DMA's fixed cost of 14 beats a single interrupt's 11, so DMA pays off only for multi-word transfers
              else if (D === 3) t += ` Fast device: it could deliver all ${N} words by t = ${N * 3}, yet polling needs until t = ${a.end} and interrupts until t = ${b.end}: the processor is the bottleneck. DMA moves each word as soon as the device has it and finishes at t = ${c.end}, setup and final interrupt included.`;  // with the fast device: the processor is the bottleneck for polling and interrupts, while DMA keeps up with the device
              else t += ` DMA left <b>${c.free}</b> time units for Program B, against ${b.free} (interrupts) and ${a.free} (polling).`;  // otherwise: compares the free time Program B got in each lane
              verdict.innerHTML = t;  // shows the finished text
            }  // ends showVerdict()
            function run() {  // run(): animates the race from the start
              if (stop) stop();  // stops any race that is already running
              compute(); const t0 = performance.now(), dur = 5200; showVerdict(false);  // simulates, notes the start time, sets the race to last 5.2 seconds, and shows the prediction prompt
              stop = ctx.raf((now) => { const cut = Math.min(tMax, Math.floor(((now - t0) / dur) * tMax)); paint(cut); if (cut >= tMax) { showVerdict(true); stop = null; return false; } });  // on every animation frame, works out which tick the race has reached and redraws; at the end shows the result and stops
            }  // ends run()
            function finish() { if (stop) { stop(); stop = null; } compute(); paint(tMax); showVerdict(true); }  // finish(): jumps straight to the end of the race and shows the result
            function resetRace() { if (stop) { stop(); stop = null; } compute(); paint(0); showVerdict(false); }  // resetRace(): stops any race, simulates again, draws the lanes at tick 0 and shows the prediction prompt
            const sl = ctx.ui.slider({ label: 'Words in the block', min: 1, max: 32, value: N, onInput: (v) => { N = v; resetRace(); } });  // slider for words in the block (1 to 32); moving it resets the race
            sl.style.width = ctx.narrow ? '100%' : '330px';  // the slider takes the full width on phones and 330 pixels otherwise
            const seg = ctx.ui.seg([{ value: 30, label: 'Slow device · 30 per word' }, { value: 3, label: 'Fast device · 3 per word' }], D, (v) => { D = v; resetRace(); });  // switch between a slow device (30 ticks per word) and a fast one (3 ticks per word); changing it resets the race
            p.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // fills the Race tab with a vertical stack
              h('div', { class: 'row', style: { gap: '10px 16px' } }, sl, seg, h('button', { class: 'btn primary sm', type: 'button', onclick: run }, 'Run the race ▶'), h('button', { class: 'btn sm', type: 'button', onclick: finish }, 'Skip to the end')),  // the control row: slider, device switch, Run button and Skip button
              ...lanes.map((L) => L.row), keyRow(ctx, ['free', 'poll', 'cmd', 'move', 'ctx', 'stolen']), verdict));  // then the three lanes, the colour legend for every kind of time, and the verdict callout
            resetRace();  // draws the starting position
            return () => { if (stop) stop(); };  // gives the tabs control a clean-up function that stops the animation when the student leaves this tab
          }  // ends raceTab()
          function flowTab(p) {  // flowTab(p): builds the Flowcharts tab inside panel p
            const svg = s('svg', { viewBox: '0 0 1100 372', width: '100%', style: ctx.narrow ? null : 'height:340px', role: 'img', 'aria-label': 'Flowcharts of programmed I/O, interrupt-driven I/O and DMA' }, ...flowNodes(ctx));  // the three flowcharts in one drawing; on wide screens the height is fixed at 340 pixels
            const say = h('div', { class: 'callout m0 small' });  // say is the callout under the flowcharts that explains the chosen column
            const TXT = {  // TXT: the callout's heading and text for each choice
              all: ['Compare', 'Look inside the shaded loops: the processor itself reads every word and writes it to memory. Only the DMA column has no per-word loop in the processor.'],  // "Compare all": the shaded loops show the processor moving every word; only DMA has no per-word loop in the processor
              0: ['Programmed I/O', 'The processor never leaves the loop: ask for a word, check the status until it is ready, move it, repeat. Nothing else can run in the meantime.'],  // programmed I/O: the processor never leaves the loop
              1: ['Interrupt-driven I/O', 'The waiting is gone (“do something else”), but the processor still runs the read-word and write-word boxes once per word, after an interrupt each time.'],  // interrupt-driven: the waiting is gone, but the processor still moves each word after each interrupt
              2: ['DMA', 'One command at the start, one interrupt at the end. The per-word work happens inside the DMA module, outside these boxes.'],  // DMA: one command at the start, one interrupt at the end, with the per-word work inside the DMA module
            };  // closes the TXT table
            const pick = (v) => {  // pick(v): shows the chosen flowchart and its explanation
              if (ctx.narrow) svg.setAttribute('viewBox', `${5 + 365 * v} 0 360 372`);  // on phones, moves the drawing's visible window onto just that one column so its text stays readable
              svg.querySelectorAll('.s17-col').forEach((g) => (g.style.opacity = v === 'all' || String(v) === g.dataset.col ? 1 : 0.22));  // fades every column except the chosen one (or none, for "all")
              say.dataset.label = TXT[v][0]; say.innerHTML = TXT[v][1];  // fills the callout's heading and text for the choice
            };  // ends pick()
            const opts = [{ value: 'all', label: 'Compare all' }, { value: 0, label: 'Programmed I/O' }, { value: 1, label: 'Interrupt-driven' }, { value: 2, label: 'DMA' }];  // the choices for the switch above the flowcharts
            const first = ctx.narrow ? 0 : 'all';  // phones start on the first column; wide screens start with all three
            const seg = ctx.ui.seg(ctx.narrow ? opts.slice(1) : opts, first, pick);  // the switch, without the "Compare all" option on phones, since only one column fits
            p.append(h('div', { class: 'stack fill', style: { gap: '8px' } }, seg, svg, say));  // fills the tab: the switch, the flowcharts and the callout
            pick(first);  // shows the starting choice
          }  // ends flowTab()
          el.append(ctx.ui.tabs([{ label: 'Race', render: raceTab }, { label: 'Flowcharts', render: flowTab }]));  // the step shows two tabs, Race and Flowcharts, each built by its function above
        },  // ends render() for step 7
      },  // ends step 7
      /* ============ 8. Recap ============ */
      {  // step 8: a recap of the section
        title: 'Recap: three ways to move a block',  // step 8 title
        kind: 'recap',  // step kind "recap": a summary step
        html: `${/* step 8's layout as HTML: a comparison table, then a row of flip cards */''}
          <div class="stack fill" style="gap:10px">${/* a vertical stack filling the step */''}
            <div class="s17-tblwrap"><table class="tbl compact">${/* a wrapper that render() finds to rebuild the table as cards on phones, and the compact comparison table itself */''}
              <colgroup><col style="width:19%"><col style="width:22%"><col style="width:26%"><col style="width:11%"><col style="width:22%"></colgroup>${/* sets the width share of each of the five table columns */''}
              <tr><th>Technique</th><th>Who moves each word?</th><th>How the processor learns it is done</th><th>Interrupts (N words)</th><th>Processor cost</th></tr>${/* table header row: technique, who moves each word, how the processor learns it is done, interrupts, and processor cost */''}
              <tr><td><b style="color:var(--warn)">Programmed I/O</b></td><td>The processor</td><td>Polls the status register (busy waiting)</td><td class="num">0</td><td>All of its time until the block is done</td></tr>${/* table row for programmed I/O: the processor moves words and polls, 0 interrupts, all of its time */''}
              <tr><td><b style="color:var(--intr)">Interrupt-driven I/O</b></td><td>The processor, in the interrupt handler</td><td>An interrupt each time a word is ready</td><td class="num">N</td><td>Save + move + restore, for every word</td></tr>${/* table row for interrupt-driven I/O: the handler moves words, N interrupts, save + move + restore per word */''}
              <tr><td><b style="color:var(--accent)">DMA</b></td><td>The DMA module, straight to memory</td><td>One interrupt when the whole block is done</td><td class="num">1</td><td>Setup + one interrupt, plus stolen bus cycles</td></tr>${/* table row for DMA: the DMA module moves words, 1 interrupt, setup + one interrupt + stolen cycles */''}
            </table></div>${/* end of the table and its wrapper */''}
            <div class="row" style="justify-content:space-between"><p class="m0 small muted">Say each answer out loud before you flip the card.</p><span class="s17-flipall"></span></div>${/* a row with a hint to answer aloud before flipping, and a slot where the "flip all" button can go */''}
            <div class="s17-flips"></div>${/* empty slot that render() fills with the flip cards */''}
          </div>`,  // end of step 8's HTML
        render(el, ctx) {  // render(el, ctx): fills in the flip cards when the step opens
          ctx.$('.s17-flips').append(ctx.ui.flipcards([  // puts a set of flip cards (front: prompt, back: answer) into the empty slot
            ['Programmed I/O in one line', 'Send a command, then check the status bit again and again (busy waiting). The module never interrupts.'],  // flip card: programmed I/O in one line
            ['Interrupt-driven I/O in one line', 'Send a command, do other work, get interrupted when a word is ready, move it in the handler. Every word still passes through the processor.'],  // flip card: interrupt-driven I/O in one line
            ['The two shared drawbacks', '1. The transfer rate is capped by how fast the processor can test and service the device. 2. The processor is tied up running instructions for every word.'],  // flip card: the two shared drawbacks
            ['The four items a DMA module needs', 'Read or write · the address of the I/O device · the starting location in memory · the number of words.'],  // flip card: the four items a DMA module needs
            ['When does DMA involve the processor?', 'Only at the beginning (sending the four items) and at the end (one completion interrupt). No word passes through it.'],  // flip card: when DMA involves the processor, only at the start and the end
            ['Cycle stealing', 'The DMA module takes the bus for one cycle; if the processor needed it, the processor just pauses, saving nothing. It runs a little slower, but for multi-word blocks DMA is far more efficient.'],  // flip card: cycle stealing and why DMA still wins
          ], { cols: 3, height: 128 }));  // closes the card list; lays them out in 3 columns, each card 128 pixels tall
          if (ctx.narrow) {                 /* phones: the five-column table becomes one card per technique */
            const wrap = ctx.$('.s17-tblwrap'), rows = Array.from(wrap.querySelectorAll('tr')), heads = Array.from(rows[0].children).map((c) => c.textContent);  // wrap is the table's wrapper; rows are its table rows; heads are the header texts, reused as labels on the cards
            wrap.replaceChildren(ctx.h('div', { class: 'stack', style: { gap: '8px' } }, ...rows.slice(1).map((r) => {  // replaces the table with a stack of cards, one per technique row (the header row is skipped)
              const cells = Array.from(r.children);  // cells are this row's five table cells
              return ctx.h('div', { class: 'card tight stack', style: { gap: '2px' } }, ctx.h('div', { html: cells[0].innerHTML }), ...cells.slice(1).map((c, k) => ctx.h('div', { class: 'small', html: `<span class="muted">${heads[k + 1].replace(/\?$/, '')}:</span> ${c.innerHTML}` })));  // a card: the technique name on top, then each other cell as a small line starting with its muted header label
            })));  // ends the card builder and the replacement
          }  // ends the phone-only table rebuild
          ctx.$('.s17-flipall').append(ctx.h('button', { class: 'btn sm', type: 'button', onclick: () => { const all = ctx.$$('.flip'); const on = !all.every((c) => c.classList.contains('on')); all.forEach((c) => c.classList.toggle('on', on)); } }, 'Flip all'));  // a "Flip all" button: if any card is face down it turns them all over, otherwise it turns them all back
        },  // ends render() for step 8
      },  // ends step 8
      /* ============ 9. Check yourself ============ */
      {  // step 9: the end-of-section quiz
        title: 'Check yourself',  // step 9 title
        kind: 'check',  // step kind "check": a self-test step
        quiz: [  // the quiz questions; the guide's quiz engine draws them, checks answers and shows explanations
          { q: 'In programmed I/O, how does the processor learn that the I/O module has finished an operation?',  // question 1 (multiple choice): how the processor learns an operation finished in programmed I/O
            choices: ['It reads the module’s status register again and again until the ready bit is set.', 'The I/O module sends it an interrupt as soon as the word is ready.', 'A DMA module reports it once the whole block is in memory.', 'The timer interrupt tells it at the next clock tick.'], answer: 0,  // choices: polling the status register (correct), an interrupt, a DMA report, or a timer tick
            feedback: [null, 'That describes interrupt-driven I/O. In programmed I/O the module sets status bits and takes no further action.', 'That describes DMA; programmed I/O involves no DMA module.', 'Timer interrupts keep time for the operating system; they carry no news about a particular I/O operation.'],  // feedback for each wrong choice: that is interrupt-driven I/O, that is DMA, and timer interrupts carry no I/O news
            why: 'The module does the work and sets bits in its I/O status register, but it never signals. The processor must poll that register, which is busy waiting.' },  // explanation: the module only sets status bits, so the processor must poll, which is busy waiting
          { type: 'tf', q: 'With interrupt-driven I/O, the words being transferred no longer pass through the processor.', answer: false,  // question 2 (true or false): interrupts keep the words out of the processor; the answer is false
            why: 'Interrupts remove the waiting, not the carrying. The interrupt handler still reads each word from the module into a processor register and then writes it to memory.' },  // explanation: interrupts remove the waiting, not the carrying
          { type: 'multi', q: 'Which items does the processor send to a DMA module to start a block transfer? Select all that apply.',  // question 3 (select all): which items the processor sends a DMA module to start a transfer
            choices: ['Whether the operation is a read or a write', 'The address of the I/O device involved', 'The starting location in memory to read from or write to', 'The number of words to transfer', 'The data words themselves', 'The address of a handler to run after every word'], answer: [0, 1, 2, 3],  // choices: the four real items (correct) plus two traps, the data itself and a per-word handler address
            why: 'Those four items are all the DMA module needs. The data never passes through the processor, and there is no per-word handler: the module interrupts once, when the whole block is done.' },  // explanation: only the four items are needed, the data never passes through the processor, and there is one interrupt at the end
          { type: 'order', q: 'Put the steps of a DMA block transfer in order.',  // question 4 (put in order): the steps of a DMA block transfer
            items: ['The processor sends the operation, device address, start address and word count to the DMA module', 'The processor goes back to other work', 'The DMA module moves the words one at a time between the device and memory', 'The count reaches zero and the DMA module sends an interrupt', 'The processor runs the interrupt handler and continues'],  // the five steps in correct order, from setup to the processor running the completion handler
            why: 'The processor takes part only at the beginning (setup) and at the end (the completion interrupt). Everything in between is done by the DMA module.' },  // explanation: the processor takes part only at the start and at the end
          { type: 'match', q: 'Match each technique or mechanism to its description.',  // question 5 (match the pairs): each technique or mechanism with its short description
            pairs: [['Programmed I/O', 'Checks a status bit again and again'], ['Interrupt-driven I/O', 'An interrupt for every word'], ['Direct memory access', 'One interrupt for the whole block'], ['Cycle stealing', 'Borrows the bus for one cycle']],  // the four pairs: polling, an interrupt per word, one interrupt per block, and borrowing one bus cycle
            why: 'Polling, one interrupt per word, one interrupt per block, and borrowing single bus cycles: four different answers to the question “who moves the data, and who waits?”.' },  // explanation: four different answers to "who moves the data, and who waits?"
          { type: 'bucket', q: 'During a DMA block transfer, who does each job?', buckets: ['Processor', 'DMA module'],  // question 6 (sort into groups): which jobs the processor does and which the DMA module does
            items: [['Sending the start address and word count to the module', 0], ['Putting each word’s memory address on the bus', 1], ['Adding one to the address register after each word', 1], ['Subtracting one from the count register after each word', 1], ['Raising the interrupt when the count reaches zero', 1], ['Running the handler when the block is finished', 0]],  // the six jobs, each tagged with its correct group (0 = processor, 1 = DMA module)
            why: 'The processor sets the job up and handles the one interrupt at the end. Every per-word job, including updating the address and count registers, belongs to the DMA module.' },  // explanation: the processor sets up and handles the final interrupt; every per-word job belongs to the DMA module
          { type: 'num', q: 'A 512-word block is read from a disk twice: once with interrupt-driven I/O and once with DMA. How many interrupts does the processor receive in total over both transfers?', answer: 513, tol: 0, unit: 'interrupts',  // question 7 (calculate): total interrupts for a 512-word block read once with interrupts and once with DMA; answer 513
            why: 'Interrupt-driven I/O interrupts once per word (512); the DMA module interrupts only once, after the whole block is done (1). 512 + 1 = 513.' },  // explanation: 512 interrupts plus 1 interrupt
          { type: 'num', q: 'Suppose interrupt-driven I/O costs the processor 11 instructions per word (save context 4, move the word 2, issue the next command 1, restore context 4), while a DMA transfer costs it 14 instructions per block (4 to set up, 10 for the one completion interrupt), whatever the block size. How many processor instructions does DMA save on a 200-word block?', answer: 2186, tol: 0, unit: 'instructions',  // question 8 (calculate): instructions DMA saves on a 200-word block, using 11 per word versus 14 per block; answer 2,186
            why: 'Interrupt-driven: 200 × 11 = 2,200 instructions. DMA: 14, because the processor works only at the start and the end. Saving: 2,200 − 14 = 2,186.' },  // explanation: 200 times 11 is 2,200, minus 14
          { type: 'num', q: 'With programmed I/O, the device needs 25 status checks before each word is ready (the 25th check finds it ready). Each word also needs 1 command, 1 read and 1 store. How many instructions does a 10-word block take?', answer: 280, tol: 0, unit: 'instructions',  // question 9 (calculate): instructions for a 10-word block with programmed I/O and 25 checks per word; answer 280
            why: 'Per word: 1 command + 25 checks + 1 read + 1 store = 28 instructions, so 10 words take 280. Of those, 240 are checks that found nothing (24 per word).' },  // explanation: 28 instructions per word, of which 24 checks found nothing
          { q: 'Which statement about cycle stealing is correct?',  // question 10 (multiple choice): which statement about cycle stealing is correct
            choices: ['The DMA module uses the bus for one bus cycle, and the processor pauses for that cycle without saving its context.', 'The DMA module interrupts the processor for each word, and the processor saves its context before giving up the bus.', 'The processor must finish its current instruction before the DMA module may use the bus.', 'The processor steals bus cycles from the DMA module, so the transfer never slows the processor down.'], answer: 0,  // choices: a one-cycle pause with no context saved (correct), an interrupt per word, waiting for the instruction to end, or the reverse
            feedback: [null, 'No context is saved and no handler runs. If it did, DMA would cost as much as interrupt-driven I/O.', 'That is the rule for interrupts. A DMA module may take the bus in the middle of an instruction, whenever the processor next needs the bus.', 'It is the other way round: the DMA module steals the cycles, so the processor runs somewhat slower during a transfer.'],  // feedback for each wrong choice: nothing is saved, the end-of-instruction rule is for interrupts, and it is the DMA module that steals
            why: 'Cycle stealing is a pause, not an interrupt: one bus cycle is handed to the DMA module, and the processor carries on afterwards as if nothing happened.' },  // explanation: cycle stealing is a pause, not an interrupt
          { q: 'Programmed I/O and interrupt-driven I/O share two drawbacks. Which pair is it?',  // question 11 (multiple choice): which pair of drawbacks programmed and interrupt-driven I/O share
            choices: ['The transfer rate is limited by how fast the processor can test and service the device, and the processor is tied up managing each transfer.', 'The device writes straight into memory behind the processor’s back, and each word needs its own DMA setup.', 'Every word is stored twice in main memory, and they can only read from a device, never write to one.', 'They rely on cycle stealing, so the processor pauses for a bus cycle on every word.'], answer: 0,  // choices: the speed limit plus a tied-up processor (correct), and three wrong pairs that describe DMA or false claims
            feedback: [null, 'In both techniques the processor itself copies every word; no DMA module is involved.', 'A processor register is not main memory: each word is written to memory once. And both techniques handle output (writes) as well as input.', 'Cycle stealing belongs to DMA, not to these two techniques.'],  // feedback for each wrong choice: no DMA is involved, a word is stored in memory once, and cycle stealing belongs to DMA
            why: 'In both techniques every word travels through a processor register, so the processor both caps the speed and pays instructions for every word.' },  // explanation: every word travels through a processor register, which causes both drawbacks
          { type: 'tf', q: 'Because a DMA module steals bus cycles, the processor runs a little slower during a DMA transfer; even so, DMA is far more efficient than the other two techniques for multiple-word transfers.', answer: true,  // question 12 (true or false): DMA slows the processor a little but is far more efficient for multi-word transfers; the answer is true
            why: 'Losing one bus cycle per word is tiny compared with many instructions and an interrupt per word. For a single word, though, DMA’s fixed setup cost can outweigh its benefit.' },  // explanation: one lost cycle per word is tiny, though for a single word DMA's setup cost can outweigh the benefit
        ],  // closes the quiz question list
      },  // ends step 9
    ],  // closes the list of steps

    notes: `${/* start of the section notes: a full written summary the student opens with the Notes button (or the N key) */''}
      <h3>The problem: who carries the data?</h3>${/* notes heading: the problem of who carries the data */''}
      <p>A disk read or a network packet is a <b>block</b> of words that must travel between an I/O device and main memory. There are three ways to move it: <b>programmed I/O</b>, <b>interrupt-driven I/O</b> and <b>direct memory access (DMA)</b>. They differ in who moves each word and how much processor time the transfer eats.</p>${/* notes paragraph: a block must travel between device and memory, and the three techniques differ in who moves each word */''}

      <h3>1. Programmed I/O</h3>${/* notes heading for part 1, programmed I/O */''}
      <p>The processor gives the I/O module a command (for example, read the next word). The module carries it out and, when finished, sets bits in its <b>I/O status register</b> (such as READY). It then does nothing more: <b>no interrupt</b>. The processor must check the status register again and again until the bit shows the operation is complete. This repeated checking is <b>polling</b>; waiting this way is <b>busy waiting</b>, because the processor is fully occupied yet achieves nothing.</p>${/* notes paragraph: the command, the status register, no interrupt, and why this is polling and busy waiting */''}
      <ol>${/* start of the numbered list of programmed I/O steps */''}
        <li>Issue a READ command to the I/O module.</li>${/* programmed I/O step 1: issue a READ command */''}
        <li>Read the status register. Not ready? Read it again (loop).</li>${/* programmed I/O step 2: read the status register until it says ready */''}
        <li>Ready: read the word from the module’s data register into a processor register.</li>${/* programmed I/O step 3: read the word into a processor register */''}
        <li>Write that register into the next memory cell.</li>${/* programmed I/O step 4: write that register into memory */''}
        <li>More words? Go back to step 1.</li>${/* programmed I/O step 5: repeat for the next word */''}
      </ol>${/* end of the programmed I/O step list */''}
      <p><b>Cost per word</b> = 1 command + the status checks + 1 read + 1 store. If each word needs 25 checks (the 25th finds it ready), a 10-word block costs 10 × (1 + 25 + 1 + 1) = <b>280 instructions</b>, of which 240 are checks that found nothing, and no other program runs meanwhile.</p>${/* notes paragraph: the cost per word, and the worked example of 280 instructions for 10 words */''}

      <h3>2. Interrupt-driven I/O</h3>${/* notes heading for part 2, interrupt-driven I/O */''}
      <p>The processor issues the command and then <b>goes on with other useful work</b>. When the module is ready to exchange a word, it <b>interrupts</b> the processor. The processor finishes its current instruction, saves the <b>context</b> of the running program (program counter, status, registers), and runs the <b>interrupt handler</b>. The handler reads the word from the module, writes it to memory, issues the next command, restores the context and returns; the interrupted program continues where it stopped.</p>${/* notes paragraph: how the command, the interrupt, context saving and the handler move each word */''}
      <p>This beats polling because the waiting time goes to other programs. But <b>every word still passes through the processor</b> and costs a full interrupt. In the guide’s model a word costs 11 instructions (save 4, move 2, next command 1, restore 4), so a 200-word block costs 2,200 instructions and 200 interrupts. Worked example (3 words, device needs 16 time units per word): 3 interrupts and 33 instructions of I/O work, while the other program gets 40 instructions done.</p>${/* notes paragraph: better than polling, but 11 instructions per word, with the 3-word worked example */''}

      <h3>The two drawbacks both techniques share</h3>${/* notes heading: the two drawbacks both techniques share */''}
      <ol>${/* start of the list of drawbacks */''}
        <li><b>Speed limit:</b> the I/O transfer rate is limited by how fast the processor can test and service a device. With a very fast device, polling needs at least 3 instructions of service per word and each interrupt needs 11, so the processor, not the device, sets the pace.</li>${/* drawback 1: the speed limit set by how fast the processor can test and service the device */''}
        <li><b>Tied-up processor:</b> the processor must execute a number of instructions for every single word transferred.</li>${/* drawback 2: the processor must run instructions for every word */''}
      </ol>${/* end of the drawbacks list */''}
      <p>Root cause: each word travels through a processor register. Model (device needs D time units per word): polling moves a word every D + 3 units using 100% of the processor; interrupts move one every max(D, 4) + 7 units, 11 of them busy. D = 30: polling reaches 91% of the device’s speed, interrupts 81% while using about 30% of the processor. D = 3: only 50% and 27%, with the processor busy 100% of the time.</p>${/* notes paragraph: the root cause, and the model's numbers for a slow and a fast device */''}

      <h3>3. Direct memory access (DMA)</h3>${/* notes heading for part 3, direct memory access */''}
      <p>A <b>DMA module</b> is hardware that does the processor’s bus work for a transfer: it puts addresses and words on the bus and tells memory to read or write. It may be a separate module on the system bus or built into an I/O module. To start a block transfer, the processor sends it four items:</p>${/* notes paragraph: what a DMA module is, where it can live, and that the processor sends it four items */''}
      <ol>${/* start of the list of the four setup items */''}
        <li>whether the operation is a <b>read or a write</b> (on the read/write control line);</li>${/* setup item 1: read or write, on the read/write control line */''}
        <li>the <b>address of the I/O device</b> involved;</li>${/* setup item 2: the address of the I/O device */''}
        <li>the <b>starting location in memory</b> to read from or write to (kept in the DMA module’s <b>address register</b>);</li>${/* setup item 3: the starting memory location, kept in the address register */''}
        <li>the <b>number of words</b> to transfer (kept in its <b>count register</b>).</li>${/* setup item 4: the number of words, kept in the count register */''}
      </ol>${/* end of the setup items list */''}
      <p>The processor then continues with other work. The DMA module transfers the entire block, one word at a time, directly to or from memory, <b>without the words passing through the processor</b>. After each word the address register goes up by one and the count register goes down by one. When the count reaches zero the module sends <b>one interrupt</b>. The processor is involved only at the <b>beginning</b> (setup) and at the <b>end</b> (the completion interrupt). In the guide’s model that is 4 setup instructions + 10 for the completion interrupt = <b>14 instructions per block</b>, whatever its size: a 200-word block costs 14 instead of 2,200 with interrupts, saving 2,186. For a single word, though, 14 is more than one interrupt’s 11, so DMA pays off for <b>multiple-word</b> transfers.</p>${/* notes paragraph: the block moves without the processor, one interrupt at the end, 14 instructions per block */''}

      <h3>Cycle stealing</h3>${/* notes heading: cycle stealing */''}
      <p>The DMA module needs the system bus for every word, and the processor uses the same bus. Rather than waiting for a cycle the processor leaves free, the module usually takes the bus for <b>one bus cycle</b> whenever it has a word; if the processor wants the bus in that cycle, it must <b>pause</b> for that one cycle. This is <b>cycle stealing</b>. It is <b>not an interrupt</b>: no context is saved and no handler runs; the processor simply waits, then carries on. So it can happen in the middle of an instruction, wherever the processor needs the bus (fetching an instruction or operand, writing a result), whereas an interrupt is only recognised at the end of an instruction. If the processor does not need the bus in that cycle (decoding, executing internally), the steal costs nothing.</p>${/* notes paragraph: what cycle stealing is, why it is not an interrupt, and when a steal costs nothing */''}
      <p>Effect: the processor runs somewhat slower during a DMA transfer. Example (instructions of 3 to 5 stages, about half the cycles using the bus): a DMA word every 4 cycles gives 250 steals in 1,000 cycles; 143 cause a pause (14.3% of cycles lost, 213 instructions finished, where 248 would finish with no DMA at all) and 107 cost nothing. Still, at most one lost cycle per word is far cheaper than many instructions and an interrupt per word, so for multiple-word transfers DMA is far more efficient than the other two techniques.</p>${/* notes paragraph: the processor runs somewhat slower, with the 1,000-cycle example numbers, yet DMA still wins */''}

      <h3>Comparison</h3>${/* notes heading: comparison table */''}
      <table>${/* start of the notes comparison table */''}
        <tr><th>Technique</th><th>Who moves each word</th><th>How the processor learns it is done</th><th>Interrupts for N words</th><th>Processor cost</th></tr>${/* comparison table header row */''}
        <tr><td>Programmed I/O</td><td>Processor</td><td>Polls the status register</td><td>0</td><td>All its time (busy waiting)</td></tr>${/* comparison row: programmed I/O */''}
        <tr><td>Interrupt-driven I/O</td><td>Processor (handler)</td><td>Interrupt per word</td><td>N</td><td>Save + move + restore per word</td></tr>${/* comparison row: interrupt-driven I/O */''}
        <tr><td>DMA</td><td>DMA module</td><td>One interrupt per block</td><td>1</td><td>Setup + one interrupt + stolen cycles</td></tr>${/* comparison row: DMA */''}
      </table>${/* end of the notes comparison table */''}
      <p>Race, 8 words, slow device (30 units per word): processor time on the transfer is 264 (polling), 88 (interrupts), 14 (DMA, plus 8 stolen cycles); the other program gets 0, 212 and 233 units done. Fast device (3 per word): the device could deliver all 8 by t = 24, but polling ends at t = 48 and interrupts at t = 91 (the processor is the bottleneck); DMA keeps pace and ends at t = 39.</p>${/* notes paragraph: the race results for 8 words with a slow device and with a fast device */''}

      <h4>Common mistakes</h4>${/* notes heading: common mistakes */''}
      <ul>${/* start of the list of common mistakes */''}
        <li>Thinking the I/O module signals the processor in programmed I/O. It only sets status bits; the processor must look.</li>${/* mistake: thinking the module signals the processor in programmed I/O */''}
        <li>Thinking interrupts keep the data out of the processor. They remove the waiting, not the carrying.</li>${/* mistake: thinking interrupts keep the data out of the processor */''}
        <li>Thinking DMA interrupts once per word. It interrupts once per block.</li>${/* mistake: thinking DMA interrupts once per word */''}
        <li>Calling cycle stealing an interrupt. It is a one-cycle pause; nothing is saved.</li>${/* mistake: calling cycle stealing an interrupt */''}
      </ul>`,  // end of the mistakes list and of the notes text
  });  // closes the section definition passed to Guide.section()
})();  // closes and immediately runs the wrapper function that holds this whole file
