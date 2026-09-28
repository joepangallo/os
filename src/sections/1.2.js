// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 1.2 — Evolution of the Microprocessor
   From a processor spread over many chips, to one chip, to many cores on
   one chip, to a whole system on a chip with GPUs, DSPs and accelerators.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  'use strict';  // turns on strict mode: the browser reports common mistakes as errors instead of silently ignoring them

  /* ---------- colour roles used throughout this section ----------
     CPU cores = cpu (blue) · caches / memory = mem (green) · I/O, radios = io (orange)
     GPU = accent (indigo) · DSP = proc (teal) · fixed-function accelerators = warn (amber)
     hardware threads (logical processors) = thread (pink) */
  const ROLE = {  // ROLE: for each kind of unit on a chip, its drawing style, chip colour, colour variable and display name
    cpu: { cls: 's-cpu', chip: 'cpu', v: '--cpu', name: 'CPU core' },  // CPU cores: drawn in the processor blue
    gpu: { cls: 's-accent', chip: 'accent', v: '--accent', name: 'GPU' },  // GPU: drawn in the indigo accent colour
    dsp: { cls: 's-proc', chip: 'proc', v: '--proc', name: 'DSP' },  // DSP: drawn in teal
    acc: { cls: 's-warn', chip: 'warn', v: '--warn', name: 'Accelerator' },  // fixed-function accelerators: drawn in amber
    mem: { cls: 's-mem', chip: 'mem', v: '--mem', name: 'Memory / cache' },  // memory and caches: drawn in green
    io: { cls: 's-io', chip: 'io', v: '--io', name: 'I/O / radio' },  // I/O and radios: drawn in orange
  };  // closes the ROLE table

  /* ---------- tiny SVG helpers (pass ctx.s as s) ---------- */
  // centred multi-line label; lines are split on '\n'
  function slabel(s, x, y, text, o = {}) {  // slabel(s, x, y, text, o): makes an SVG text label centred on (x, y); o can set font size, line height, weight, class and style
    const lines = String(text).split('\n');  // splits the label text into separate lines wherever it contains a line break
    const fs = o.fs || 14, lh = o.lh || fs * 1.2;  // fs = font size (14 unless given); lh = line height (1.2 times the font size unless given)
    const t = s('text', { x, y: y - ((lines.length - 1) * lh) / 2 + fs * 0.35, 'text-anchor': o.anchor || 'middle', 'font-size': fs, 'font-weight': o.fw || 700, class: o.tcls || null, style: o.style || null });  // creates the text element, moved up by half the extra lines so the whole block stays centred on y
    lines.forEach((ln, i) => t.append(s('tspan', { x, dy: i ? lh : 0 }, ln)));  // each line becomes a tspan (one line inside an SVG text) at the same x, pushed down one line height after the first
    return t;  // hands back the finished label
  }  // ends slabel()
  // rounded rectangle (class "fr" so hover/selection styles can find it) with an optional centred label
  function sbox(s, x, y, w, hh, cls, label, o = {}) {  // sbox(s, x, y, w, hh, cls, label, o): draws a rounded box in style cls, with an optional centred label, inside a group
    const g = s('g', { class: o.gcls || null });  // the group that holds the box; o.gcls can give it a class such as "sel" (selected)
    g.append(s('rect', { x, y, width: w, height: hh, rx: o.rx != null ? o.rx : 8, class: cls + ' fr', 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash || null }));  // the rectangle itself; o can change the corner radius, frame width and dashes
    if (label) g.append(slabel(s, x + w / 2, y + hh / 2, label, o));  // adds the centred label when one is given
    return g;  // hands back the group
  }  // ends sbox()
  // make an SVG group behave like a button (mouse, keyboard, and the test fuzzer's ".hot" selector)
  function hotify(g, label, fn) {  // hotify(g, label, fn): makes a drawn group act like a button that runs fn
    g.setAttribute('class', ((g.getAttribute('class') || '') + ' p12-hot hot').trim());  // adds the classes p12-hot (for this section's hover styles) and hot (which the guide's automatic checker looks for)
    g.setAttribute('tabindex', '0');  // tabindex 0 lets the student reach the group with the Tab key
    g.setAttribute('role', 'button');  // tells screen readers the group is a button
    g.setAttribute('aria-label', label);  // gives the button a name that screen readers read out
    g.addEventListener('click', fn);  // a mouse click or tap runs fn
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });  // Enter or Space runs fn too; preventDefault stops Space from scrolling the page
    return g;  // hands back the group
  }  // ends hotify()

  /* ---------- step 3, tab 1: build a multicore chip and see what the OS sees ---------- */
  const CACHE_INFO = {  // CACHE_INFO: the explanation shown for each clickable part of the chip; each is a function so the core text can mention SMT
    core: (smt) => '<b>Core.</b> A complete processor with its own registers, control logic and execution units, able to run its own program.' + (smt ? ' With SMT it keeps two sets of registers (T0, T1), so the OS sees it as <b>two</b> logical processors.' : ' With 1 thread per core, the OS sees it as one logical processor.'),  // core: a full processor; with SMT it holds two register sets and counts as two logical processors
    l1: () => '<b>L1 cache · one per core.</b> Tiny and fastest. On a recent laptop or desktop chip it is typically 32–64 KB for data plus about as much for instructions, and it answers in about 4–5 clock cycles (around 1 ns).',  // L1 cache: one per core, tiny and fastest, with typical size and speed
    l2: () => '<b>L2 cache · one per core.</b> Bigger and a little slower: typically 256 KB to 2 MB, answering in about 12–16 cycles (a few ns). It catches most of what L1 misses.',  // L2 cache: one per core, bigger and a little slower
    l3: () => '<b>L3 cache · shared by all cores.</b> The big one: typically <span style="white-space:nowrap">8–64 MB</span>, answering in about 30–70 cycles (roughly <span style="white-space:nowrap">8–20 ns</span>). Because it is shared, one core can find data another core used recently.',  // L3 cache: shared by all cores, the biggest and slowest of the three
    mc: () => '<b>Memory controller.</b> Moved onto the processor chip during the 2000s. It talks to main memory (gigabytes of DRAM), which takes around 80–100 ns: hundreds of cycles. That gap is why chips carry three levels of cache.',  // memory controller: now on the chip; main memory is hundreds of cycles away, which is why caches exist
  };  // closes CACHE_INFO
  function chipBuilder(panel, ctx) {  // chipBuilder(panel, ctx): builds the "build a multicore chip" lab inside panel; used by step 3, tab 1
    const { h, s } = ctx;  // takes h (builds HTML elements) and s (builds SVG drawing elements) out of ctx
    let cores = 4, tpc = 2, picked = 'core';  // starting choices: 4 cores, 2 threads per core (SMT on), and the core's explanation showing
    // phones use a narrower drawing (two cores per row) so the labels stay readable
    const NW = ctx.narrow, VW = NW ? 340 : 640;  // NW is true on a phone-width screen; VW is the drawing's width in coordinate units (340 there, 640 otherwise)
    const svg = s('svg', { viewBox: `0 0 ${VW} 256`, width: '100%', role: 'img', 'aria-label': 'A multicore chip' });  // the SVG drawing of the chip; draw() resets its height to fit
    const info = h('div', { class: 'p12-cap', style: { fontSize: '14.5px' } });  // info box that shows the explanation for the clicked part
    const big = h('div', { class: 'big', style: { fontSize: '36px', color: 'var(--thread)' } });  // a big pink number: how many logical processors the OS sees
    const formula = h('div', { class: 'small b', style: { lineHeight: 1.3 } });  // the formula beside the big number: cores times threads per core
    const lps = h('div', { class: 'row', style: { gap: '3px' } });  // a row of small squares, one per logical processor
    const legend = h('p', { class: 'xs muted m0' });   // explains the unit boxes, or why they are not drawn
    function draw() {  // draw(): rebuilds the chip drawing and the readouts; runs at start and after every click or setting change
      const g = s('g', {});  // g: a fresh group that collects the new drawing
      const cols = Math.min(cores, NW ? 2 : 4), rows = Math.ceil(cores / cols);  // cols: cores per row (at most 4, or 2 on a phone); rows: how many rows that needs
      const W = Math.min(280, (VW - 44 - (cols - 1) * 12) / cols), H = rows === 1 ? 148 : 70;  // W: width of one core box (at most 280); H: tall boxes when there is one row, shorter ones for two rows
      const x0 = VW / 2 - (cols * W + (cols - 1) * 12) / 2;  // x0: left edge of the first core, chosen so the row of cores is centred
      const L3Y = 18 + rows * (H + 8) + 2, MCY = L3Y + 38, VH = MCY + 42;  // L3 and memory controller sit under the cores
      svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);  // resizes the coordinate grid to the height this layout needs
      g.append(sbox(s, 8, 6, VW - 16, VH - 12, 's-panel', null, { rx: 14, sw: 2.5 }));  // the chip outline: a big rounded box around everything
      for (let k = 0; k < cores; k++) {  // draws each core in turn
        const x = x0 + (k % cols) * (W + 12), y = 18 + Math.floor(k / cols) * (H + 8);  // x, y: where core k sits, from its column and row
        const coreG = sbox(s, x, y, W, H, 's-cpu', null, { gcls: picked === 'core' ? 'sel' : null });  // the core box in processor blue, marked "sel" when the core explanation is showing
        coreG.append(s('text', { x: x + 10, y: y + 21, 'font-size': 14, 'font-weight': 800 }, 'Core ' + k));  // the "Core k" label in the top-left corner
        for (let t = 0; t < tpc; t++) {  // one badge per hardware thread
          const bx = x + W - 8 - (tpc - t) * 33;  // bx: x position of this badge, counted in from the right edge of the core
          coreG.append(s('rect', { x: bx, y: y + 6, width: 29, height: 19, rx: 5, class: 's-thread', 'stroke-width': 1.5 }), s('text', { x: bx + 14.5, y: y + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'T' + t));  // the pink badge "T0" or "T1" that stands for one hardware thread
        }  // ends the loop over threads
        if (rows === 1) {  // room to show the core's own execution units
          const names = ['Int', 'Int', 'FP', 'Ld/St'], wide = W >= 200;  // names of the four execution units (two integer units, floating point, load/store); wide = room for one row of them
          const ew = wide ? (W - 20 - 18) / 4 : (W - 26) / 2;  // ew: width of each unit box, four in a row if wide, otherwise two by two
          names.forEach((nm, u) => {  // draws each execution unit
            const ex = x + 10 + (wide ? u * (ew + 6) : (u % 2) * (ew + 6)), ey = y + 38 + (wide ? 0 : Math.floor(u / 2) * 28);  // ex, ey: position of unit u, in one row or in a 2 x 2 block
            coreG.append(sbox(s, ex, ey, ew, 24, 's-panel', nm, { fs: 13, rx: 5, sw: 1.2 }));  // the unit box with its short name
          });  // ends the loop over units
          if (wide) coreG.append(s('text', { x: x + W / 2, y: y + 82, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'execution units'));  // when wide, a small caption "execution units" under the row
        }  // ends the one-row case
        g.append(hotify(coreG, 'Core ' + k, () => pick('core')));  // makes the whole core clickable; clicking shows the core explanation
        const cy = y + H - (rows === 1 ? 42 : 32), ch = rows === 1 ? 34 : 26, l1w = Math.round((W - 26) * 0.38), l2w = W - 26 - l1w;  // cy, ch: top and height of the cache boxes at the bottom of the core; l1w, l2w: their widths (L1 gets about 38%)
        g.append(hotify(sbox(s, x + 10, cy, l1w, ch, 's-mem', 'L1', { fs: 14, gcls: picked === 'l1' ? 'sel' : null }), 'L1 cache', () => pick('l1')));  // the core's own L1 cache box, clickable
        g.append(hotify(sbox(s, x + 16 + l1w, cy, l2w, ch, 's-mem', 'L2', { fs: 14, gcls: picked === 'l2' ? 'sel' : null }), 'L2 cache', () => pick('l2')));  // the core's own L2 cache box beside it, clickable
      }  // ends the loop over cores
      const mcW = NW ? 144 : 240;  // mcW: width of the memory controller box
      g.append(hotify(sbox(s, 24, L3Y, VW - 48, 30, 's-mem', 'Shared L3 cache (all cores)', { fs: 14, gcls: picked === 'l3' ? 'sel' : null }), 'L3 cache', () => pick('l3')));  // the shared L3 cache bar across the whole chip under the cores, clickable
      g.append(hotify(sbox(s, 24, MCY, mcW, 28, 's-mem', 'Memory controller', { fs: 14, gcls: picked === 'mc' ? 'sel' : null }), 'Memory controller', () => pick('mc')));  // the memory controller box under the L3, clickable
      const aw = NW ? 24 : 42;  // arrow length
      g.append(s('line', { x1: mcW + 28, y1: MCY + 14, x2: mcW + 28 + aw, y2: MCY + 14, class: 's-line', 'marker-end': 'url(#arr)' }), s('text', { x: mcW + 34 + aw, y: MCY + 19, 'font-size': 13.5, class: 's-sub', 'font-weight': 700 }, NW ? 'to DRAM, off chip' : 'to main memory (DRAM, off the chip)'));  // an arrow from the memory controller pointing off the chip (url(#arr) is the guide's shared arrowhead), with its label
      svg.replaceChildren(g);  // swaps the old drawing for the new one in a single step
      const n = cores * tpc;  // n: logical processors the OS sees = cores times threads per core
      big.textContent = n;  // shows n as the big number
      formula.innerHTML = `logical processor${n > 1 ? 's' : ''}<br>= ${cores} core${cores > 1 ? 's' : ''} × ${tpc} per core`;  // the formula under it, e.g. "logical processors = 4 cores x 2 per core", with plurals handled
      lps.replaceChildren(...ctx.util.range(n).map((i) => h('span', { title: 'CPU ' + i, style: { width: '14px', height: '14px', borderRadius: '3px', background: 'var(--thread)', display: 'inline-block' } })));  // redraws the row of small pink squares, one per logical processor, each with a tooltip such as "CPU 3"
      info.innerHTML = CACHE_INFO[picked](tpc === 2);  // shows the explanation for the part that was clicked last (the core text changes when SMT is on)
      legend.innerHTML = rows === 1  // the line under the lab explains the execution-unit boxes, or why they are missing
        ? '<b>Execution units</b> in each core: <b>Int</b> = integer (whole-number) math · <b>FP</b> = floating point (numbers with fractions) · <b>Ld/St</b> = load/store (moves data between memory and registers).'  // with one row of cores: what Int, FP and Ld/St stand for
        : 'With 8 cores there is no room to draw each core’s execution units (Int, FP, Ld/St). Pick 4 or fewer cores to see them.';  // with 8 cores: there is no room to draw the units, so pick 4 or fewer to see them
    }  // ends draw()
    function pick(k) { picked = k; draw(); }  // pick(k): remembers which part was clicked and redraws
    const segC = ctx.ui.seg([1, 2, 4, 8].map((v) => ({ value: v, label: v + (v === 1 ? ' core' : ' cores') })), cores, (v) => { cores = v; draw(); });  // switch for 1, 2, 4 or 8 cores; changing it redraws the chip
    const segT = ctx.ui.seg([{ value: 1, label: '1 thread/core' }, { value: 2, label: '2 (SMT)' }], tpc, (v) => { tpc = v; draw(); });  // switch for 1 thread per core or 2 (SMT); changing it redraws the chip
    panel.append(h('div', { class: 'stack gap-s' },  // fills the panel with a vertical stack
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, segC, segT),  // top row: the core switch on the left, the thread switch on the right
      h('div', { class: 'p12-svgwrap' }, svg),  // the drawing, centred in its wrapper
      h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0,4fr) minmax(0,7fr)', gap: '10px', height: 'auto' } },  // a two-column row below it (4 parts to 7) that grows only as tall as its content
        h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'xs muted b' }, 'THE OS SCHEDULER SEES'), h('div', { class: 'row gap-s nw' }, big, formula), lps),  // left card: "the OS scheduler sees", the big number with its formula, and the row of squares
        info),  // right: the explanation box
      legend));  // last: the legend line about execution units
    draw();  // draws the chip for the first time
  }  // ends chipBuilder()

  /* ---------- step 3, tab 2: two hardware threads sharing one core's execution units ----------
     4 units × 8 cycles. Rows: 0 = integer ALU 1, 1 = integer ALU 2, 2 = floating point, 3 = load/store.
     Thread A alone uses 11 of 32 slots (34%); with SMT, B adds 10 more → 21 of 32 (66%). */
  const SMT_UNITS = ['Integer unit 1', 'Integer unit 2', 'Floating point', 'Load / store'];  // SMT_UNITS: the names of the four execution units, one per row of the lab's grid
  const SMT_SCHED = [  // SMT_SCHED: for each of 8 cycles, which unit rows thread A and thread B use, and whether each thread is waiting
    { A: [0, 3], B: [1], wa: false, wb: false },  // cycle 1: A uses integer unit 1 and load/store; B gets integer unit 2
    { A: [0, 1, 2], B: [3], wa: false, wb: false },  // cycle 2: A uses both integer units and floating point; B gets load/store
    { A: [3], B: [0, 1], wa: false, wb: false },  // cycle 3: A uses only load/store (its load misses the cache); B uses both integer units
    { A: [], B: [0, 2, 3], wa: true, wb: false },  // cycle 4: A waits for memory; B uses integer 1, floating point and load/store
    { A: [], B: [], wa: true, wb: true },  // cycle 5: both threads wait, so every unit is idle
    { A: [0, 2], B: [], wa: false, wb: true },  // cycle 6: A runs again on integer 1 and floating point; B is still waiting
    { A: [0, 1], B: [2], wa: false, wb: false },  // cycle 7: A uses both integer units; B uses floating point
    { A: [3], B: [0, 2], wa: false, wb: false },  // cycle 8: A uses load/store; B uses integer 1 and floating point
  ];  // closes SMT_SCHED
  const SMT_CAP = {  // SMT_CAP: the caption for each frame (intro plus 8 cycles), for 1 thread and for 2 threads
    1: [  // captions with one thread:
      '<b>One thread, one core.</b> This core has four execution units, and each cycle it can start one instruction on each. Press play to watch thread A use them.',  // intro caption: four units, one instruction each per cycle
      '<b>Cycle 1.</b> A starts an integer add and a memory load: 2 of 4 units busy.',  // caption for cycle 1 with one thread: 2 of 4 units busy
      '<b>Cycle 2.</b> A finds three independent instructions: 3 of 4 busy. A good cycle.',  // caption for cycle 2 with one thread: 3 of 4 busy
      '<b>Cycle 3.</b> A’s load <i>misses</i> the cache. Everything A wants next needs that data, so only the load/store unit works.',  // caption for cycle 3 with one thread: a cache miss leaves only the load unit working
      '<b>Cycle 4.</b> A is waiting for main memory. All four units sit idle.',  // caption for cycle 4 with one thread: waiting for memory, all units idle
      '<b>Cycle 5.</b> Still waiting. (A real trip to main memory lasts hundreds of cycles, not two.)',  // caption for cycle 5 with one thread: still waiting (real misses last far longer)
      '<b>Cycle 6.</b> The data arrives and A carries on: 2 of 4 busy.',  // caption for cycle 6 with one thread: data arrives, 2 of 4 busy
      '<b>Cycle 7.</b> 2 of 4 busy again.',  // caption for cycle 7 with one thread: 2 of 4 busy again
      '<b>Cycle 8, done.</b> A has one load to start: 1 of 4 busy. In all, A used only <b>11 of 32 slots (34%)</b>; most of the core did nothing. Switch to 2 logical processors to see what SMT does with the gaps.',  // caption for cycle 8 with one thread: the total, 11 of 32 slots (34%)
    ],  // ends the one-thread captions
    2: [  // captions with two threads (SMT):
      '<b>Two threads, one core.</b> The core now holds the registers of two threads, A and B, so the OS sees two logical processors. Both feed the same four units.',  // intro caption: the core holds two threads' registers and both feed the same units
      '<b>Cycle 1.</b> A uses two units; B slips an integer add into a free one: 3 of 4 busy.',  // caption for cycle 1 with SMT: B fills a free unit, 3 of 4 busy
      '<b>Cycle 2.</b> A takes three units and B gets the last. B wanted more but had to wait: the two threads compete for the same hardware.',  // caption for cycle 2 with SMT: the two threads compete for the units
      '<b>Cycle 3.</b> A’s load misses the cache, but B uses both integer units: 3 of 4 busy.',  // caption for cycle 3 with SMT: A misses the cache but B keeps two units busy
      '<b>Cycle 4.</b> A is stalled, yet B keeps 3 of 4 units busy. This is the point of SMT: filling slots a stalled thread leaves empty.',  // caption for cycle 4 with SMT: A is stalled while B keeps 3 units busy, the point of SMT
      '<b>Cycle 5.</b> B’s load missed too. Both threads are waiting, so nothing starts. SMT cannot help when every thread is stuck.',  // caption for cycle 5 with SMT: both threads wait, so SMT cannot help
      '<b>Cycle 6.</b> A’s data arrives; B is still waiting: 2 of 4 busy.',  // caption for cycle 6 with SMT: A runs, B still waits
      '<b>Cycle 7.</b> Both run again: 3 of 4 busy.',  // caption for cycle 7 with SMT: both run, 3 of 4 busy
      '<b>Cycle 8, done.</b> A’s load plus two of B’s instructions: 3 of 4 busy. Together A and B used <b>21 of 32 slots (66%)</b> instead of 11. Real programs usually gain less, often around 10–30%, because the threads also compete for the caches.',  // caption for cycle 8 with SMT: the total, 21 of 32 slots (66%), and real gains are smaller
    ],  // ends the two-thread captions
  };  // closes SMT_CAP
  function smtLab(panel, ctx) {  // smtLab(panel, ctx): builds the SMT lab (threads sharing one core's units) inside panel; used by step 3, tab 2
    const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
    let mode = 1;  // mode: 1 or 2 logical processors on the core
    // phones: shorter labels and narrower columns so the grid keeps a readable text size
    const NW = ctx.narrow;  // NW is true on a phone-width screen
    const LX = NW ? 74 : 150, CW = NW ? 33 : 58, RH = NW ? 34 : 38, TOP = NW ? 58 : 62;  // layout numbers: LX = where the grid starts, CW = column width, RH = row height, TOP = top of the unit rows
    const UNITS = NW ? ['Integer 1', 'Integer 2', 'Float', 'Load/store'] : SMT_UNITS;  // unit names for the rows: shorter ones on phones
    const svg = s('svg', { viewBox: NW ? `0 0 ${LX + 8 * CW + 2} ${TOP + 4 * (RH + 5) + 4}` : '0 0 640 234', width: '100%', role: 'img', 'aria-label': 'Execution-unit slots, cycle by cycle' });  // the SVG drawing of the slots grid, sized to fit 8 columns and 4 rows
    const meter = h('div', { class: 'meter', style: { flex: '1' } }, h('i'));  // meter bar showing how many unit slots are busy
    const used = h('span', { class: 'small b', style: { minWidth: '150px', textAlign: 'right' } });  // the "k of n slots used" text beside the meter
    function draw(n) {  // draw(n): redraws the grid with the first n cycles filled in; the player calls it for each frame
      const g = s('g', {});  // g: a fresh group that collects the new drawing
      if (NW) g.append(s('text', { x: LX - 8, y: 16, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub', 'font-weight': 700 }, 'cycle'));  // on phones a single "cycle" label sits in the corner instead of a word on every column
      for (let c = 0; c < 8; c++) g.append(s('text', { x: LX + c * CW + CW / 2, y: 16, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, (NW ? '' : 'cycle ') + (c + 1)));  // the numbers 1 to 8 across the top, one per cycle column
      const threads = mode === 2 ? ['A', 'B'] : ['A'];  // threads to show: only A, or A and B
      threads.forEach((t, ti) => {  // draws one status strip per thread
        const y = 24 + ti * 17;  // y: the height of this thread's strip
        g.append(s('text', { x: LX - 8, y: y + 11, 'text-anchor': 'end', 'font-size': NW ? 12 : 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'thread ' + t));  // the thread's name at the left, in pink
        for (let c = 0; c < n; c++) {  // one small bar for every cycle played so far
          const wait = t === 'A' ? SMT_SCHED[c].wa : SMT_SCHED[c].wb;  // wait: whether this thread is stalled in this cycle
          g.append(s('rect', { x: LX + c * CW + 3, y, width: CW - 6, height: 13, rx: 4, style: wait ? 'fill:var(--intr-bg);stroke:var(--intr)' : 'fill:var(--thread-bg);stroke:var(--thread)', 'stroke-width': 1.2, 'stroke-dasharray': wait ? '3 2' : null }));  // a pink bar when running, or a dashed red-tinted bar when waiting
          if (wait) g.append(s('text', { x: LX + c * CW + CW / 2, y: y + 11, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, style: 'fill:var(--intr)' }, 'wait'));  // a waiting bar also gets the word "wait"
        }  // ends the loop over cycles
      });  // ends the loop over threads
      UNITS.forEach((u, r) => {  // draws one row for each execution unit
        const y = TOP + r * (RH + 5);  // y: the height of this unit's row
        g.append(s('text', { x: LX - 8, y: y + RH / 2 + 5, 'text-anchor': 'end', 'font-size': NW ? 12.5 : 13.5, 'font-weight': 700 }, u));  // the unit's name at the left
        for (let c = 0; c < 8; c++) {  // one slot for every cycle column
          const x = LX + c * CW + 3, cell = SMT_SCHED[c];  // x: this slot's position; cell: the schedule for this cycle
          const who = c < n ? (cell.A.includes(r) ? 'A' : mode === 2 && cell.B.includes(r) ? 'B' : null) : null;  // who: which thread uses this unit in this cycle (only for cycles already played, B only with SMT)
          g.append(s('rect', { x, y, width: CW - 6, height: RH, rx: 6, class: who ? 's-thread' : 's-panel', 'stroke-width': who ? 2 : 1.2, 'stroke-dasharray': who ? null : '3 3', style: who === 'A' ? 'fill:var(--thread)' : null }));  // a busy slot is pink (solid for A, tinted for B); a free slot is a dashed empty box
          if (who) g.append(s('text', { x: x + (CW - 6) / 2, y: y + RH / 2 + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 900, style: who === 'A' ? 'fill:var(--panel)' : 'fill:var(--thread)' }, who));  // a busy slot shows the letter of the thread using it
        }  // ends the loop over cycles
      });  // ends the loop over units
      if (n > 0) g.append(s('rect', { x: LX + (n - 1) * CW, y: TOP - 4, width: CW, height: 4 * (RH + 5) + 3, rx: 8, style: 'fill:none;stroke:var(--chc)', 'stroke-width': 2.5 }));  // a frame in the chapter colour around the column of the latest cycle
      svg.replaceChildren(g);  // swaps the old drawing for the new one
      let k = 0;  // k will count the unit slots used so far
      for (let c = 0; c < n; c++) k += SMT_SCHED[c].A.length + (mode === 2 ? SMT_SCHED[c].B.length : 0);  // adds up the slots thread A used in the cycles played so far, plus thread B's when SMT is on
      meter.firstChild.style.width = n ? (k / (n * 4)) * 100 + '%' : '0%';  // stretches the meter to the share of slots used (4 slots per cycle)
      used.textContent = n ? `${k} of ${n * 4} slots used (${Math.round((k / (n * 4)) * 100)}%)` : 'no cycles yet';  // writes "k of n slots used (percent)", or "no cycles yet" before the first cycle
    }  // ends draw()
    const player = ctx.ui.player({ count: 9, interval: 1500, render: (i) => { draw(i); return SMT_CAP[mode][i]; } });  // the guide's step player with 9 frames (intro plus 8 cycles), 1.5 s apart; each frame draws the grid and returns its caption
    const seg = ctx.ui.seg([{ value: 1, label: '1 logical processor' }, { value: 2, label: '2 logical processors (SMT)' }], mode, (v) => { mode = v; player.reset(); });  // switch for 1 or 2 logical processors; changing it restarts the player from the intro
    panel.append(h('div', { class: 'stack gap-s' }, seg, h('div', { class: 'p12-svgwrap' }, svg), h('div', { class: 'row nw' }, h('span', { class: 'xs muted b' }, 'UNITS BUSY'), meter, used), player.el));  // fills the panel: the switch, the grid, the "units busy" meter row and the player controls
  }  // ends smtLab()

  /* ---------- step 7: send each job to the unit that does it best ---------- */
  const BINS = [  // BINS: the four kinds of unit a job can be sent to, with the message shown when a job is sent to the wrong one
    { k: 'cpu', name: 'CPU core', chip: 'cpu', no: 'A CPU core <i>could</i> run this, but another unit does it faster or with far less energy.' },  // CPU core: it could run anything, but another unit may do the job faster or more cheaply
    { k: 'gpu', name: 'GPU', chip: 'accent', no: 'A GPU only shines when the same calculation runs over huge arrays of independent data.' },  // GPU: good only for the same calculation over huge arrays of data
    { k: 'dsp', name: 'DSP', chip: 'proc', no: 'A DSP is built for steady streams of samples, such as sound or radio signals.' },  // DSP: built for steady streams of samples such as sound or radio
    { k: 'acc', name: 'Accelerator', chip: 'warn', no: 'An accelerator does one fixed job, such as encryption or video decoding, and cannot run other code.' },  // accelerator: does one fixed job and cannot run other code
  ];  // closes BINS
  const JOBS = [  // JOBS: the nine jobs to place; best = the ideal unit, ok = other units that also work (with a note), why = explanation, hint = a clue
    { t: 'Compile a program’s source code', best: 'cpu', ok: {}, why: 'Compiling is branchy, irregular logic in which each decision depends on the one before. That is exactly what a general-purpose core is for; SIMD lanes would sit idle.', hint: 'Lots of if-statements and lookups, all different.' },  // job: compiling a program, best on a CPU core (branchy, irregular logic)
    { t: 'Render a 3D game scene, 60 frames a second', best: 'gpu', ok: {}, why: 'Millions of pixels each get the same shading math, every frame: pure SIMD work, which is what GPUs were invented for.', hint: 'The same small calculation for every pixel.' },  // job: rendering a 3D game, best on the GPU (the same math for every pixel)
    { t: 'Train one layer of a neural network', best: 'gpu', ok: { acc: 'Also reasonable: dedicated AI accelerators exist and are superb at running trained models. For large-scale training, GPUs are the usual workhorse.' }, why: 'Training is mostly huge grids of multiply-adds, the same operation on millions of numbers, so the GPU’s thousands of lanes are ideal.', hint: 'Enormous grids of numbers, all multiplied the same way.' },  // job: training a neural-network layer, best on the GPU, with an AI accelerator also accepted
    { t: 'Decode the audio of a phone call', best: 'dsp', ok: {}, why: 'A steady stream of compressed speech arrives every 20 ms and must be turned back into sound on time: classic DSP work.', hint: 'A never-ending stream of sound samples with a deadline.' },  // job: decoding phone-call audio, best on a DSP (a stream with a deadline)
    { t: 'Encrypt a message before it is sent', best: 'acc', ok: { cpu: 'Works: a CPU core can encrypt in software, and many have special instructions to help. A crypto engine does it with less energy and can keep the keys out of reach.' }, why: 'Encryption is one fixed, very common job, perfect for a dedicated crypto engine that is fast, frugal and can guard the keys.', hint: 'One specific, fixed job that happens constantly.' },  // job: encrypting a message, best on an accelerator, with a CPU core also accepted
    { t: 'Decode the video of a 4K movie stream', best: 'acc', ok: { gpu: 'Close: on many chips the video decoder sits right next to the GPU, but it is a separate fixed-function circuit, not the GPU’s programmable lanes.' }, why: 'Video decoding follows a fixed standard, so phones include a video codec accelerator that decodes a movie using a trickle of power.', hint: 'A fixed, standard job that runs for hours on battery.' },  // job: decoding a 4K video stream, best on an accelerator, with the GPU accepted as close
    { t: 'Filter noise out of live microphone audio', best: 'dsp', ok: {}, why: 'The same filter math runs on every incoming audio sample, in real time: exactly the streaming work DSPs are designed for.', hint: 'Filtering a live stream of samples.' },  // job: filtering live microphone noise, best on a DSP
    { t: 'Simulate the physics of a million particles', best: 'gpu', ok: {}, why: 'Every particle gets the same force and motion update each time step: the same math on a huge array, so SIMD lanes excel.', hint: 'One update rule applied to a huge array.' },  // job: simulating a million particles, best on the GPU
    { t: 'Decide which program runs next (OS scheduler)', best: 'cpu', ok: {}, why: 'The operating system itself is ordinary branchy code, so it runs on the CPU cores. It decides what runs on all the other units too.', hint: 'The operating system’s own code.' },  // job: the OS scheduler, best on a CPU core (the OS is ordinary code)
  ];  // closes JOBS
  function matcher(root, ctx, fb) {  // matcher(root, ctx, fb): builds the job-matching game inside root, writing messages into fb; used by step 7
    const { h } = ctx;  // takes the element-building helper h out of ctx
    const placed = {};       // job index → bin key
    const missed = new Set(); // jobs that had at least one wrong try
    let sel = null;  // sel: the job card the student has picked up (null = none)
    const pool = h('div', { class: 'grid-3', style: { gap: '8px' } });  // pool: a 3-column grid of job cards waiting to be placed
    const bins = h('div', { class: 'grid-4', style: { gap: '10px' } });  // bins: a 4-column row of the unit boxes the jobs can be sent to
    const score = h('span', { class: 'small b' });  // score text, e.g. "5/9 placed, 4 best fit, 3 right first try"
    const meter = h('div', { class: 'meter', style: { flex: '1' } }, h('i'));  // meter bar showing how many jobs have been placed
    function say(cls, head, body) { fb.replaceChildren(h('div', { class: 'b', style: { fontSize: '18px', color: `var(--${cls})` } }, head), h('p', { class: 'm0 small', html: body })); }  // say(cls, head, body): writes a coloured heading and a paragraph into the feedback box
    function place(j, k) {  // place(j, k): sends job j to unit k and judges the choice; runs on a click, a key press or a drop
      const job = JOBS[j];  // job: the job being placed
      if (placed[j] != null) return;  // a job that is already placed cannot be placed again
      sel = null;  // the job leaves the student's hand either way
      if (k === job.best) { placed[j] = k; say('ok', '✓ Best fit', '<b>' + job.t + ' → ' + BINS.find((b) => b.k === k).name + '.</b> ' + job.why); }  // best unit: the job stays there and the green message explains why
      else if (job.ok[k]) { placed[j] = k; missed.add(j); say('warn', '~ Works, but not the best', job.ok[k] + ' <b>Best fit: ' + BINS.find((b) => b.k === job.best).name + '.</b>'); }  // an acceptable unit: the job stays there, counts as missed, and the amber message names the best unit
      else { missed.add(j); say('bad', '✗ Not the best unit', BINS.find((b) => b.k === k).no + ' <b>Hint:</b> ' + job.hint + ' Try another unit.'); }  // a poor fit: the job stays in the pool, counts as missed, and the red message gives a hint
      paint();  // redraws the game
      if (placed[j] == null) { const c = pool.querySelector(`[data-j="${j}"]`); if (c) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } }  // if the job was not placed, its card flashes in the pool (remove the class, read offsetWidth, add it again to restart the animation)
    }  // ends place()
    function paint() {  // paint(): rebuilds the job cards and unit boxes from the state; runs after every change
      // placed jobs leave an empty slot so the layout does not jump (phones skip the slots to save scrolling)
      pool.replaceChildren(...JOBS.map((job, j) => [job, j]).filter(([, j]) => !(ctx.narrow && placed[j] != null)).map(([job, j]) => placed[j] != null ? h('div', { class: 'p12-slot' }) : h('button', {  // refills the pool: an empty slot for each placed job (skipped on phones), or a card button for each waiting one
        type: 'button', class: 'p12-task' + (sel === j ? ' on' : ''), draggable: 'true', 'data-j': j,  // each card is a button that can also be dragged; data-j stores the job number; "on" marks the picked card
        onclick: () => { sel = sel === j ? null : j; paint(); if (sel !== null) say('chc', 'Where should it run?', '<b>' + job.t + '.</b> Now click the unit that should do this job.'); },  // clicking a card picks it up (or puts it down) and asks where it should run
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', String(j)); },  // starting a drag stores the job number so the unit it is dropped on knows which job it is
      }, job.t)));  // the card shows the job's text; ends the pool refill
      bins.replaceChildren(...BINS.map((b) => {  // rebuilds the four unit boxes
        const here = JOBS.map((job, j) => [job, j]).filter(([, j]) => placed[j] === b.k);  // here: the jobs already placed on this unit
        return h('div', {  // each unit box:
          class: 'p12-bin ' + b.chip + (sel !== null ? ' target' : ''), role: 'button', tabindex: 0, 'aria-label': 'Send to ' + b.name,  // coloured by unit type, outlined as a target while a job is picked up, and reachable as a button
          onclick: () => { if (sel !== null) place(sel, b.k); else say('muted', 'Pick a job first', 'Click one of the job cards above, then click a unit.'); },  // clicking sends the picked job here, or reminds the student to pick a job first
          onkeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && sel !== null) { e.preventDefault(); place(sel, b.k); } },  // Enter or Space on a focused unit sends the picked job here
          ondragover: (e) => e.preventDefault(),  // allowing dragover is what lets a card be dropped on this box
          ondrop: (e) => { e.preventDefault(); const j = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!Number.isNaN(j)) place(j, b.k); },  // dropping a card reads its job number and sends that job here
        }, h('span', { class: 'chip ' + b.chip, style: { alignSelf: 'flex-start' } }, b.name),  // the unit's name chip at the top of the box
          ...here.map(([job, j]) => job.best === b.k ? h('div', { class: 'p12-placed best' }, '✓ ' + job.t)  // jobs placed on their best unit show as green entries with a tick
            : h('div', { class: 'p12-placed ok', role: 'button', tabindex: 0, title: 'Click to move it back and try again',  // jobs placed on an acceptable unit show as amber entries that can be clicked to try again
              onclick: (e) => { e.stopPropagation(); delete placed[j]; sel = j; paint(); say('chc', 'Try again', '<b>' + job.t + '</b> is back in your hand. Click the unit that suits it best.'); } }, '~ ' + job.t + ' (click to retry)')));  // clicking one takes the job back into the student's hand (stopPropagation keeps the unit's own click from firing)
      }));  // ends the unit box and the rebuild of all four
      const n = Object.keys(placed).length, best = JOBS.filter((job, j) => placed[j] === job.best).length, first = JOBS.filter((job, j) => placed[j] === job.best && !missed.has(j)).length;  // n = jobs placed; best = jobs on their best unit; first = best-unit jobs with no wrong try
      meter.firstChild.style.width = (n / JOBS.length) * 100 + '%';  // stretches the meter to the share of jobs placed
      score.textContent = `${n}/${JOBS.length} placed · ${best} best fit · ${first} right first try`;  // updates the score text
      if (n === JOBS.length) say('ok', 'All nine jobs placed!', `You found the best unit for ${best} of 9 jobs, ${first} on the first try. Notice the pattern: branchy logic → CPU, the same math over huge arrays → GPU, steady streams → DSP, one fixed common job → accelerator.`);  // once all nine are placed: a summary and the pattern (branchy code to CPU, arrays to GPU, streams to DSP, fixed jobs to accelerators)
    }  // ends paint()
    function reset() { Object.keys(placed).forEach((k) => delete placed[k]); missed.clear(); sel = null; paint(); say('chc', 'Your move', 'Click a job card, then click the unit that should run it. You can also drag a card onto a unit.'); }  // reset(): clears every placement and miss, redraws, and shows the starting instructions
    function solve() { JOBS.forEach((job, j) => { placed[j] = job.best; missed.add(j); }); sel = null; paint(); say('chc', 'Answers shown', 'Each job now sits on its best unit. Press Start over to try it yourself.'); }  // solve(): places every job on its best unit (counted as missed) and says the answers are shown
    root.append(h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'xs muted b' }, 'JOBS WAITING FOR A UNIT'), pool, h('div', { class: 'xs muted b' }, 'UNITS ON THE CHIP · CLICK ONE TO SEND THE SELECTED JOB'), bins));  // puts the headings, the job pool and the unit boxes into root
    reset();  // starts the game in its empty state
    const hint = () => say('warn', 'Rule of thumb', 'Branchy, varied logic → <b>CPU core</b>. The same math over huge arrays → <b>GPU</b>. A steady stream of samples with deadlines → <b>DSP</b>. One fixed, very common job → <b>accelerator</b>.');  // hint(): shows the rule of thumb for which unit suits which kind of work
    return { reset, solve, hint, scoreEl: h('div', { class: 'row nw' }, meter, score) };  // hands back reset, solve, hint and a score row (meter and score text) for the step to place in its toolbar
  }  // ends matcher()

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '1.2',  // the section number, used in links, the progress list and saved progress
    title: 'Evolution of the Microprocessor',  // the full title shown at the top of every step
    short: 'Microprocessor evolution',  // the short name used in the side menu and progress list
    summary: 'How one-chip processors grew into multicore chips and phone SoCs with GPUs, DSPs and accelerators.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Explain what a microprocessor is and why putting a whole processor on one chip changed computing.',  // objective 1: what a microprocessor is and why one chip mattered
      'Describe how chips evolved: more transistors, faster clocks until the power wall, then more cores, logical processors and deeper caches.',  // objective 2: how chips evolved, from faster clocks to more cores and caches
      'Explain how SIMD lets a GPU or a CPU vector unit process many numbers with one instruction, and work out the speedup.',  // objective 3: SIMD in GPUs and vector units, and working out the speedup
      'Describe what DSPs and hardware accelerators do and why a system on a chip combines them with CPU cores, caches, radios and memory.',  // objective 4: DSPs, accelerators and the system on a chip
      'Match a workload to the kind of processing unit that handles it best.',  // objective 5: matching a workload to the best kind of unit
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Microprocessor', 'A complete processor built on a single chip of silicon. The first commercial one appeared in 1971; today microprocessors run everything from phones to servers.'],  // glossary entry: microprocessor
      ['Transistor', 'A microscopic switch controlled by electricity. Chips are built from transistors, so more transistors means room for more circuitry, such as extra cores or bigger caches.'],  // glossary entry: transistor
      ["Moore's law", 'The long-running observation that the number of transistors that fit on a chip roughly doubles about every two years.'],  // glossary entry: Moore's law
      ['Clock speed (clock rate)', 'How many clock cycles a processor completes per second, measured in hertz. 3 GHz means 3 billion cycles per second; the processor does its work in steps timed by these ticks.'],  // glossary entry: clock speed
      ['Power wall', 'The limit reached in the mid-2000s when raising the clock speed further made chips use too much power and run too hot to cool, so designers began adding cores instead.'],  // glossary entry: power wall
      ['Logical processor (hardware thread)', 'A processor as the operating system sees it. With simultaneous multithreading, one physical core presents two (or more) logical processors that share its execution units.'],  // glossary entry: logical processor (hardware thread)
      ['Simultaneous multithreading (SMT)', 'A core design that holds the registers and program counter of two or more threads at once and issues their instructions in the same cycles, filling units one thread would leave idle. Intel calls it Hyper-Threading.'],  // glossary entry: simultaneous multithreading (SMT)
      ['Execution unit', 'A part of a core that performs one kind of operation, such as integer arithmetic, floating-point math, or loading and storing memory. Each core has several.'],  // glossary entry: execution unit
      ['Cache levels (L1, L2, L3)', 'The layers of cache on a typical modern chip: a tiny, fastest L1 inside each core, a larger L2 per core, and a big L3 shared by all cores. Each level is bigger and slower than the one above it.'],  // glossary entry: cache levels L1, L2 and L3
      ['Graphics processing unit (GPU)', 'A processor with a very large number of simple lanes that apply the same operation to big arrays of data. Built to draw graphics; now also used for science and machine learning.'],  // glossary entry: graphics processing unit (GPU)
      ['Single instruction, multiple data (SIMD)', 'A style of computing in which one instruction performs the same operation on many data items at once, each item in its own lane.'],  // glossary entry: SIMD (single instruction, multiple data)
      ['Lane', 'One slot of a SIMD unit, handling one data item. An 8-lane unit can add 8 pairs of numbers with a single instruction.'],  // glossary entry: lane
      ['Vector unit', 'Hardware inside a CPU core that performs SIMD operations on short vectors, for example 4, 8 or 16 numbers at a time.'],  // glossary entry: vector unit
      ['Digital signal processor (DSP)', 'A processor built for streams of samples, such as audio, radio or video signals. It repeats the same arithmetic on every sample fast enough to keep up with the stream.'],  // glossary entry: digital signal processor (DSP)
      ['Coprocessor', 'A processor that works alongside the main CPU cores and takes over one kind of work, such as graphics, signal processing or encryption.'],  // glossary entry: coprocessor
      ['Hardware accelerator', 'A circuit designed to do one specific job, such as encryption, compression or video decoding, much faster and with far less energy than software on a CPU core.'],  // glossary entry: hardware accelerator
      ['System on a chip (SoC)', 'A single chip that combines CPU cores, caches, a GPU, DSPs, accelerators and I/O such as radios, usually with main memory in the same package. The heart of every smartphone.'],  // glossary entry: system on a chip (SoC)
      ['Codec', 'Short for coder-decoder: hardware or software that compresses (encodes) and decompresses (decodes) audio or video.'],  // glossary entry: codec
      ['x86', 'The instruction set family that began with the Intel 8086 in 1978. Most desktop PCs, laptops and servers use x86 chips, made by Intel and AMD.'],  // glossary entry: x86
      ['ARM', 'A family of energy-efficient processor designs that many companies license and build into their own chips. Nearly every smartphone uses ARM cores.'],  // glossary entry: ARM
    ],  // closes the key terms list

    css: ` /* style rules used only by this section; every selector starts with .sec-1-2 so it cannot affect other sections */
      /* shell workaround: on phones the stage shrink-wraps the canvas to its min-content width, and this
         section's long nowrap eyebrow would make it wider than the screen; containment removes that pull */
      .sec-1-2 .step-eyebrow { contain: inline-size; } /* the line above each step title may not widen the page on a phone (the reason is in the note above) */
      .sec-1-2 .p12-svgwrap { display: grid; place-items: center; min-height: 0; } /* wrapper that centres a drawing in the space it has; min-height 0 lets it shrink instead of overflowing */
      .sec-1-2 .p12-hot { cursor: pointer; outline: none; } /* clickable parts of a drawing show a pointer cursor and no browser focus outline */
      .sec-1-2 .p12-hot:hover > .fr, .sec-1-2 .p12-hot:focus-visible > .fr { stroke-width: 3.5; } /* hovering over a clickable part, or reaching it with the Tab key, thickens its frame */
      .sec-1-2 .p12-hot.sel > .fr { stroke-width: 4; } /* the selected part gets the thickest frame */
      .sec-1-2 .p12-dim { opacity: .3; transition: opacity .25s; } /* p12-dim fades a unit that plays no part in the current frame of the phone-call animation; the fade takes 0.25 s */
      .sec-1-2 .p12-cap { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 15.5px; line-height: 1.45; } /* p12-cap: this section's caption box (soft panel, thin border, rounded corners, comfortable text) */
      .sec-1-2 .p12-cap b { color: var(--chc); } /* bold words inside a caption take the chapter colour */
      .sec-1-2 .p12-kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 12px; font-size: 15px; } /* p12-kv: a two-column label and value table, used for the chip facts in the timeline step */
      .sec-1-2 .p12-kv > :nth-child(odd) { color: var(--muted); font-weight: 650; } /* labels (odd items) are grey */
      .sec-1-2 .p12-kv > :nth-child(even) { font-weight: 700; } /* values (even items) are bold */
      .sec-1-2 .p12-task { text-align: left; border: 2px solid var(--line-2); background: var(--panel); border-radius: 10px; padding: 6px 10px; font-size: 14.5px; line-height: 1.3; font-weight: 650; cursor: grab; color: var(--ink); height: 56px; overflow: hidden; } /* job card in the step 7 game: a framed button with a grab cursor (it can be dragged) and a fixed height so the grid stays even */
      .sec-1-2 .p12-task:hover { border-color: var(--chc); } /* hovering a job card turns its frame the chapter colour */
      .sec-1-2 .p12-task.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 12%, var(--panel)); box-shadow: 0 0 0 2px var(--chc); } /* the picked job card gets a chapter-coloured frame, a light tint and an outer ring */
      .sec-1-2 .p12-slot { border: 2px dashed var(--line); border-radius: 10px; height: 56px; } /* an empty dashed slot left where a placed job card used to be, so the other cards do not move */
      .sec-1-2 .p12-bin { border: 2px solid var(--line-2); border-radius: 12px; padding: 8px; background: var(--panel-2); display: flex; flex-direction: column; gap: 6px; cursor: pointer; min-height: 236px; transition: box-shadow .15s; } /* unit box in the step 7 game: a tall rounded column that holds its name and the jobs sent to it */
      .sec-1-2 .p12-bin.cpu { border-color: var(--cpu); } .sec-1-2 .p12-bin.accent { border-color: var(--accent); } /* CPU and GPU boxes get frames in their own colours */
      .sec-1-2 .p12-bin.proc { border-color: var(--proc); } .sec-1-2 .p12-bin.warn { border-color: var(--warn); } /* DSP and accelerator boxes get frames in their own colours */
      .sec-1-2 .p12-bin.target { box-shadow: 0 0 0 4px var(--hl); } /* while a job is picked up every unit box glows with the highlight colour, a hint to click one */
      .sec-1-2 .p12-bin:hover { background: var(--panel); } /* hovering a unit box lightens its background */
      .sec-1-2 .p12-placed { font-size: 13.5px; line-height: 1.3; padding: 5px 8px; border-radius: 8px; background: var(--panel); border: 1px solid var(--line); font-weight: 600; } /* a job listed inside a unit box: a small rounded entry */
      .sec-1-2 .p12-placed.best { border-color: var(--ok); background: var(--ok-bg); } /* a job on its best unit is shown in green */
      .sec-1-2 .p12-placed.ok { border-color: var(--warn); background: var(--warn-bg); cursor: pointer; } /* a job on an acceptable but not best unit is amber and clickable, so it can be taken back */
    `,  // ends the section's style rules

    steps: [  // steps: the list of pages in this section, shown one at a time as the student presses Next
      /* ---------------- 1. Big picture: three eras of the processor ---------------- */
      {  // opens step 1: three eras of the processor, from a cabinet to one chip to a whole system
        title: 'From a cabinet of parts to one chip, then a whole system',  // step 1 title shown at the top of the page
        kind: 'story',  // kind "story" puts the "Big Picture" label above the title
        render(el, ctx) {  // render(el, ctx): builds the era viewer each time step 1 is shown; el is the page area, ctx the guide's toolbox
          const { h, s } = ctx;  // takes h (builds HTML elements) and s (builds SVG drawing elements) out of ctx
          const NW = ctx.narrow;  // phones: side panels move underneath (each era sets its own viewBox) so labels stay readable
          const svg = s('svg', { viewBox: '0 0 640 300', width: '100%', role: 'img', 'aria-label': 'How the processor moved onto one chip' });  // the SVG drawing (SVG is the browser's drawing format); each era changes its coordinate grid as needed
          const cap = h('div', { class: 'p12-cap' });  // caption box under the drawing that describes the chosen era
          const chipPins = (x, y, w, hh, n) => {  // chipPins(x, y, w, hh, n): draws n short metal pins sticking out of every side of a chip, so a box looks like a real chip
            const g = s('g', {});  // g: a group to hold the pins
            for (let i = 0; i < n; i++) {  // repeats once per pin position
              const px = x + ((i + 0.5) * w) / n, py = y + ((i + 0.5) * hh) / n;  // px, py: where pin i sits along the top and bottom edges, and along the left and right edges
              g.append(s('line', { x1: px, y1: y - 9, x2: px, y2: y, class: 's-line', 'stroke-width': 3 }), s('line', { x1: px, y1: y + hh, x2: px, y2: y + hh + 9, class: 's-line', 'stroke-width': 3 }),  // a pin above the top edge and one below the bottom edge
                s('line', { x1: x - 9, y1: py, x2: x, y2: py, class: 's-line', 'stroke-width': 3 }), s('line', { x1: x + w, y1: py, x2: x + w + 9, y2: py, class: 's-line', 'stroke-width': 3 }));  // a pin left of the left edge and one right of the right edge
            }  // ends the pin loop
            return g;  // hands back the group of pins
          };  // ends chipPins()
          const ERAS = [  // ERAS: the three eras the student can switch between, each with a label, a caption and a drawing routine
            {  // era 1:
              label: 'Before 1971',  // era 1 button label: before 1971
              cap: '<b>Before 1971.</b> A processor was built from many separate chips (earlier still, from individual transistors or even vacuum tubes) spread over several circuit boards, often filling a cabinet. Signals travelled long distances between parts, which limited speed and wasted power.',  // era 1 caption: a processor built from many chips on several boards, which limited speed
              draw() {  // draw(): builds the era 1 drawing
                const g = s('g', {});  // g: the group that collects this era's drawing
                g.append(sbox(s, 10, 14, 372, 278, 's-panel', null, { rx: 14 }), s('text', { x: 196, y: 38, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'The processor: many chips on several boards'));  // the outline of the processor cabinet and its title
                ['Arithmetic board', 'Registers board', 'Control board'].forEach((nm, i) => {  // draws three circuit boards: arithmetic, registers and control
                  const y = 54 + i * 78;  // y: how far down this board sits
                  g.append(sbox(s, 26, y, 340, 64, 's-cpu', null));  // the board, drawn in processor blue
                  g.append(s('text', { x: 38, y: y + 37, 'font-size': 14, 'font-weight': 700 }, nm));  // the board's name at its left
                  for (let k = 0; k < 9; k++) g.append(s('rect', { x: 170 + k * 21, y: y + 14, width: 15, height: 36, rx: 2, class: 's-panel', 'stroke-width': 1.5 }));  // a row of nine small chips on the board
                });  // ends the loop over boards
                if (NW) {  // memory and I/O sit below the processor boards
                  g.append(s('line', { x1: 100, y1: 292, x2: 100, y2: 306, class: 's-line' }), s('line', { x1: 292, y1: 292, x2: 292, y2: 306, class: 's-line' }));  // thin lines down from the processor to the parts below
                  g.append(sbox(s, 10, 306, 180, 90, 's-mem', 'Memory\n(its own boards)', { fs: 15 }), sbox(s, 202, 306, 180, 90, 's-io', 'Terminals, tape,\nprinters (separate\ncabinets)', { fs: 15 }));  // memory boxes and I/O cabinets drawn under the processor, on the phone layout
                  return g;  // hands back the phone drawing
                }  // ends the phone case
                g.append(sbox(s, 420, 14, 210, 120, 's-mem', 'Memory\n(its own boards)', { fs: 15 }), sbox(s, 420, 172, 210, 120, 's-io', 'Terminals, tape,\nprinters (separate\ncabinets)', { fs: 15 }));  // on wider screens: memory and I/O cabinets drawn to the right of the processor
                g.append(s('line', { x1: 382, y1: 74, x2: 420, y2: 74, class: 's-line' }), s('line', { x1: 382, y1: 232, x2: 420, y2: 232, class: 's-line' }));  // lines joining the processor to memory and to I/O
                return g;  // hands back the era 1 drawing
              },  // ends era 1's draw()
            },  // closes era 1
            {  // era 2:
              label: '1971 on: one-chip CPU',  // era 2 button label: 1971 on, a one-chip CPU
              cap: '<b>1971 onward.</b> The whole processor (arithmetic, registers and control) fits on one chip: the <span class="t">microprocessor</span>. The first one had about 2,300 transistors. Memory, graphics, sound and networking are still separate chips or plug-in cards, joined by a bus.',  // era 2 caption: the whole processor fits on one chip (the microprocessor); other parts are still separate
              draw() {  // draw(): builds the era 2 drawing
                const g = s('g', {});  // g: the group that collects this era's drawing
                if (NW) {  // a narrower board: chip and memory on top, the bus across the middle, cards below
                  g.append(sbox(s, 6, 8, 380, 318, 's-panel', null, { rx: 14 }), s('text', { x: 22, y: 30, 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'Circuit board (motherboard)'));  // the circuit board outline and its "motherboard" label
                  g.append(chipPins(30, 62, 110, 110, 5), sbox(s, 30, 62, 110, 110, 's-cpu', 'Micro-\nprocessor\n(whole CPU)', { fs: 14, sw: 2.5 }));  // the microprocessor chip with pins on every side
                  g.append(s('line', { x1: 85, y1: 181, x2: 85, y2: 206, class: 's-line' }), s('line', { x1: 20, y1: 206, x2: 372, y2: 206, class: 's-line', 'stroke-width': 4 }), s('text', { x: 372, y: 226, 'text-anchor': 'end', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'bus'));  // a line from the chip to the bus, the thick bus line, and its "bus" label
                  for (let k = 0; k < 4; k++) g.append(s('line', { x1: 194 + k * 48, y1: 132, x2: 194 + k * 48, y2: 206, class: 's-line' }), sbox(s, 176 + k * 48, 62, 36, 70, 's-mem', null, { rx: 4 }));  // four memory chips, each wired down to the bus
                  g.append(s('text', { x: 266, y: 54, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Memory chips'));  // label above the memory chips
                  [['Graphics\ncard', 's-accent', 16], ['Sound\ncard', 's-proc', 140], ['Modem\ncard', 's-io', 264]].forEach(([nm, c, x]) => g.append(s('line', { x1: x + 55, y1: 206, x2: x + 55, y2: 236, class: 's-line' }), sbox(s, x, 236, 110, 76, c, nm, { fs: 14 })));  // three plug-in cards (graphics, sound, modem) hanging below the bus
                  return g;  // hands back the phone drawing
                }  // ends the phone case
                g.append(sbox(s, 6, 8, 628, 288, 's-panel', null, { rx: 14 }), s('text', { x: 22, y: 30, 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'Circuit board (motherboard)'));  // on wider screens: the circuit board outline and its label
                g.append(chipPins(46, 66, 140, 140, 6), sbox(s, 46, 66, 140, 140, 's-cpu', 'Micro-\nprocessor\n(whole CPU)', { fs: 15, sw: 2.5 }));  // the microprocessor chip with its pins, at the left of the board
                g.append(s('line', { x1: 195, y1: 150, x2: 612, y2: 150, class: 's-line', 'stroke-width': 4 }), s('text', { x: 604, y: 142, 'text-anchor': 'end', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'bus'));  // the long thick bus line across the board and its "bus" label
                for (let k = 0; k < 4; k++) { g.append(s('line', { x1: 262 + k * 52, y1: 116, x2: 262 + k * 52, y2: 150, class: 's-line' }), sbox(s, 242 + k * 52, 46, 40, 70, 's-mem', null, { rx: 4 })); }  // four memory chips in a row, each wired down to the bus
                g.append(s('text', { x: 336, y: 38, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Memory chips'));  // label above the memory chips
                [['Graphics\ncard', 's-accent', 232], ['Sound\ncard', 's-proc', 362], ['Modem\ncard', 's-io', 492]].forEach(([nm, c, x]) => g.append(s('line', { x1: x + 55, y1: 150, x2: x + 55, y2: 196, class: 's-line' }), sbox(s, x, 196, 110, 76, c, nm, { fs: 14 })));  // three plug-in cards (graphics, sound, modem) hanging below the bus
                return g;  // hands back the era 2 drawing
              },  // ends era 2's draw()
            },  // closes era 2
            {  // era 3:
              label: 'Today: system on a chip',  // era 3 button label: today, a system on a chip
              cap: '<b>Today.</b> A phone’s main chip holds several cores, a shared cache, a GPU, a DSP, accelerators and the modem: a <span class="t">system on a chip (SoC)</span>, some 20 billion transistors in a flagship phone. Main memory is a separate piece of silicon (a die) stacked in the same package, the chip’s protective case. Former boards are now neighbours millimetres apart.',  // era 3 caption: a phone chip holds cores, cache, GPU, DSP, accelerators and modem, with memory stacked in the package
              draw() {  // draw(): builds the era 3 drawing
                const g = s('g', {});  // g: the group that collects this era's drawing
                g.append(sbox(s, 10, 12, 450, 280, 's-panel', null, { rx: 16, sw: 3 }), s('text', { x: 235, y: 38, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'One chip: a system on a chip (SoC)'));  // the outline of the one chip and its title
                [[30, 55], [95, 55], [30, 110], [95, 110]].forEach(([x, y]) => g.append(sbox(s, x, y, 58, 46, 's-cpu', 'Core', { fs: 13 })));  // four small CPU core boxes in a 2 x 2 block
                g.append(sbox(s, 170, 55, 130, 101, 's-accent', 'GPU', { fs: 16 }), sbox(s, 315, 55, 125, 46, 's-warn', 'AI engine', { fs: 13 }), sbox(s, 315, 110, 125, 46, 's-warn', 'Video codec', { fs: 13 }));  // the GPU, plus two accelerators: an AI engine and a video codec
                g.append(sbox(s, 30, 168, 123, 44, 's-mem', 'Shared cache', { fs: 13 }), sbox(s, 170, 168, 130, 44, 's-proc', 'DSP', { fs: 14 }), sbox(s, 315, 168, 125, 44, 's-warn', 'Security engine', { fs: 13 }));  // the shared cache, the DSP and a security engine (another accelerator)
                g.append(sbox(s, 30, 224, 190, 54, 's-io', 'Modem + radio', { fs: 14 }), sbox(s, 235, 224, 205, 54, 's-mem', 'Memory controller', { fs: 14 }));  // the modem with its radio, and the memory controller
                if (NW) {  // the stacked memory die is drawn underneath instead of beside
                  g.append(s('line', { x1: 337, y1: 278, x2: 337, y2: 312, class: 's-line', 'stroke-width': 3 }));  // a line down from the memory controller
                  g.append(sbox(s, 10, 312, 450, 76, 's-mem', 'Main memory (DRAM)\nstacked in the same package', { fs: 15, dash: '6 4' }));  // the stacked main memory drawn underneath with a dashed frame, on the phone layout
                  return g;  // hands back the phone drawing
                }  // ends the phone case
                g.append(s('line', { x1: 440, y1: 251, x2: 490, y2: 251, class: 's-line', 'stroke-width': 3 }));  // on wider screens: a line out to the right of the memory controller
                g.append(sbox(s, 490, 96, 140, 184, 's-mem', 'Main memory\n(DRAM)\nstacked in\nthe same\npackage', { fs: 14, dash: '6 4' }));  // the stacked main memory drawn to the right with a dashed frame (a separate piece of silicon in the same package)
                return g;  // hands back the era 3 drawing
              },  // ends era 3's draw()
            },  // closes era 3
          ];  // closes the ERAS list
          let cur = -1;  // cur: the era now showing (-1 before the first is drawn); show() stores it, though nothing else reads it
          function show(i) {  // show(i): draws era i, shows its caption and lights its button; runs at start and when the student picks an era
            cur = i;  // remembers the chosen era
            const g = ERAS[i].draw();  // builds that era's drawing
            svg.setAttribute('viewBox', NW ? ['0 0 392 400', '0 0 392 332', '0 0 470 396'][i] : '0 0 640 300');  // on phones each era has its own coordinate grid (their heights differ); wider screens use one 640 x 300 grid
            g.setAttribute('class', 'fade-in');  // the new drawing fades in (a shared guide animation) instead of popping in
            svg.replaceChildren(g);  // swaps the old drawing for the new one
            cap.innerHTML = ERAS[i].cap;  // shows the era's caption under the drawing
            seg.set(i);  // marks the matching button in the era switch as chosen
          }  // ends show()
          const seg = ctx.ui.seg(ERAS.map((e, i) => ({ value: i, label: e.label })), 0, (v) => show(v));  // switch with one button per era; picking one calls show()
          el.append(h('div', { class: 'split l fill' },  // builds the page: a two-column layout with the drawing in the wider right column
            h('div', { class: 'stack' },  // left column: a vertical stack of text
              h('p', { class: 'lead m0', html: 'Before 1971 a processor filled a cabinet. Now it fits on a fingernail-sized chip.' }),  // opening paragraph: a processor once filled a cabinet and now fits on a small chip
              h('p', { class: 'm0', html: 'A <span class="t">microprocessor</span> is a whole processor on a single chip. That made processors small, cheap and fast enough for desktops and then handheld devices, and they became the fastest general-purpose processors ever built. Each generation since has pulled more onto the chip: several <span class="t" data-t="core">cores</span>, big caches, graphics and signal processors, even radios.' }),  // paragraph: what a microprocessor is, and how each generation pulled more onto the chip
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A company starts as workshops scattered around town. First the main workshop moves into one building; later the storeroom, the studio and the mail room move in too. Nothing crosses town, so work is faster and cheaper.' }),  // analogy box: scattered workshops moving into one building
              h('div', { class: 'callout why m0', 'data-label': 'Why an OS cares', html: 'The operating system must share every engine on the chip: which program runs on which core, and who gets the graphics processor (GPU) or the video codec next.' })),  // "why an OS cares" box: the OS has to share every engine on the chip between programs
            h('div', { class: 'card white stack' },  // right column: a white card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Three eras · click each'), seg),  // its top row: the heading "Three eras" and the era switch
              h('div', { class: 'p12-svgwrap grow' }, svg),  // the drawing, centred and allowed to grow into the free space
              cap)));  // the caption box
          show(0);  // shows era 1 when the step opens
        },  // ends render() for step 1
      },  // closes step 1

      /* ---------------- 2. Timeline: transistors, clock speed, cores ---------------- */
      {  // opens step 2: an interactive timeline chart of fifty years of chips
        title: 'Fifty years of chips: transistors, clocks, cores, caches',  // step 2 title
        kind: 'explore',  // kind "explore" labels the page as an Explore step
        render(el, ctx) {  // render(el, ctx): builds the timeline chart each time step 2 is shown
          const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
          const fmtN = (n) => (n >= 1e9 ? ctx.util.fmt(n / 1e9, 1) + ' billion' : n >= 1e6 ? ctx.util.fmt(n / 1e6, 1) + ' million' : Math.round(n).toLocaleString('en-US'));  // fmtN(n): writes a transistor count in words, e.g. "1.6 billion", "3.1 million" or "2,300"
          const fmtHz = (m) => (m >= 1000 ? ctx.util.fmt(m / 1000, 2) + ' GHz' : m >= 1 ? ctx.util.fmt(m, 0) + ' MHz' : ctx.util.fmt(m * 1000, 0) + ' kHz');  // fmtHz(m): writes a clock speed given in MHz as GHz, MHz or kHz, whichever reads best
          // phones get a narrower viewBox so the axis labels stay readable when the chart shrinks
          const NW = ctx.narrow, VW = NW ? 400 : 640;  // NW is true on a phone-width screen; VW is the chart width in coordinate units
          const X0 = NW ? 92 : 100, X1 = VW - 14, Y0 = 50, Y1 = 346;  // X0, X1: the left and right ends of the time axis; Y0, Y1: the top and bottom of the plot area
          const xOf = (yr) => X0 + ((yr - 1970) / 55) * (X1 - X0);  // xOf(yr): turns a year (1970 to 2025) into an x position along the time axis
          const METRICS = {  // METRICS: the four things the chart can plot; lo and hi = value range, val = how to place a chip, ticks = axis labels
            tr: { lo: 3, hi: 11.4, val: (c) => Math.log10(c.tr), ticks: [[3, '1 thousand'], [5, '100 thousand'], [7, '10 million'], [9, '1 billion'], [11, '100 billion']], minor: [4, 6, 8, 10],  // transistor count, plotted on a log scale (log10: each step up means ten times more)
              cap: 'Log scale: each gridline is 10× the one below. The count rose from thousands to tens of billions, roughly doubling every two years (<span class="t">Moore’s law</span>).' },  // caption for transistors: a log scale, and the doubling every two years (Moore's law)
            hz: { lo: -1, hi: 4.25, val: (c) => Math.log10(c.mhz), ticks: [[-1, '0.1 MHz'], [0, '1 MHz'], [1, '10 MHz'], [2, '100 MHz'], [3, '1 GHz'], [4, '10 GHz']], minor: [],  // clock speed, also on a log scale, from 0.1 MHz to 10 GHz
              cap: 'The <span class="t">clock speed</span> climbed about 5,000-fold from 1971 to 2004, then flattened out near 3–4 GHz: the <span class="t">power wall</span>.' },  // caption for clock speed: a 5,000-fold climb to 2004, then the power wall
            co: { lo: -0.35, hi: 4.5, val: (c) => Math.log2(c.cores), lp: (c) => Math.log2(c.lp), ticks: [[0, '1'], [1, '2'], [2, '4'], [3, '8'], [4, '16']], minor: [],  // core count on a doubling scale (log2: each step up means twice as many); lp places the logical-processor rings
              cap: 'For about 35 years a chip had one core. Since the mid-2000s the count keeps doubling. Rings mark <span class="t" data-t="logical processor">logical processors</span> when a core runs two threads (two instruction streams) at once.' },  // caption for cores: one core for 35 years, then doubling; rings mark logical processors
            ca: { lo: -0.45, hi: 3.5, val: (c) => c.ca, ticks: [[0, 'none'], [1, 'L1'], [2, 'L1 + L2'], [3, 'L1 + L2 + L3']], minor: [],  // cache levels on the chip, from none up to three levels
              cap: 'Each step up is one more level of cache on the chip. Processors sped up far faster than main memory did, so designers spent transistors on deeper <span class="t" data-t="cache levels">cache levels</span> to keep the cores fed.' },  // caption for cache levels: memory lagged behind, so chips added more levels of cache
          };  // closes METRICS
          // a worked check of the numbers, one per metric
          const NOTES = {  // NOTES: a worked check for each metric, as [heading, text]
            tr: ['Check the doubling rule', 'Start at 2,300 in 1971 and double 25 times (50 years): 2,300 × 2<sup>25</sup> ≈ 77 billion by 2021. Real chips: 16 billion in 2020, 92 billion in 2023. Close!'],  // worked check for transistors: 2,300 doubled 25 times is about 77 billion, close to real chips
            hz: ['Check the numbers', '0.74 MHz (1971) → 3,800 MHz (2004) is about 5,000× faster. From 2004 to 2023 the top clock only crept from 3.8 to about 4 GHz, roughly 7% more.'],  // worked check for clock speed: about 5,000 times faster by 2004, then only about 7% more
            co: ['Count the cores', 'One core from 1971 until the mid-2000s. Then 2 (2006), 4 (2008), 8 (2020) and 16 (2023): the transistors that once bought clock speed now buy cores.'],  // worked check for cores: 1 until the mid-2000s, then 2, 4, 8 and 16
            ca: ['Count the levels', 'Early chips had no cache at all; the first on-chip caches came around 1989. One level by 1993, two by 2000, and a shared third level by 2008.'],  // worked check for cache levels: none at first, then one, two and three levels
          };  // closes NOTES
          const CHIPS = [  // CHIPS: the milestone chips on the chart: year, name, family, transistors, top clock in MHz, cores, logical processors, cache
            // ca = cache levels on the processor chip; cache = what they are (sizes rounded)
            { y: 1971, name: 'Intel 4004', fam: 'early Intel', tr: 2.3e3, mhz: 0.74, cores: 1, lp: 1, ca: 0, cache: 'none', note: 'The first commercial microprocessor: a 4-bit chip designed for a desktop calculator.' },  // milestone chip, 1971: the first commercial microprocessor, 4-bit, about 2,300 transistors
            { y: 1978, name: 'Intel 8086', fam: 'x86', tr: 2.9e4, mhz: 10, cores: 1, lp: 1, ca: 0, cache: 'none', note: 'A 16-bit chip that started the <span class="t">x86</span> family, still used by most PCs and servers today.' },  // milestone chip, 1978: the 16-bit chip that started the x86 family
            { y: 1985, name: 'ARM1', fam: 'ARM', tr: 2.5e4, mhz: 6, cores: 1, lp: 1, ca: 0, cache: 'none', note: 'The first <span class="t">ARM</span> processor: a deliberately simple, low-power design. Its descendants run nearly every phone.' },  // milestone chip, 1985: the first ARM processor, simple and low-power
            { y: 1985, name: 'Intel 386', fam: 'x86', tr: 2.75e5, mhz: 33, cores: 1, lp: 1, ca: 0, cache: 'none on the chip', note: 'The first 32-bit x86 chip, with the memory-management hardware (paging) that multitasking operating systems rely on.' },  // milestone chip, 1985: the first 32-bit x86 chip, with the paging hardware multitasking systems rely on
            { y: 1993, name: 'Intel Pentium', fam: 'x86', tr: 3.1e6, mhz: 66, cores: 1, lp: 1, ca: 1, cache: 'L1: 8 KB code + 8 KB data', note: 'Could start two instructions in the same clock tick: extra transistors bought more work per cycle.' },  // milestone chip, 1993: the first with an on-chip L1 cache in this list; starts two instructions per tick
            { y: 2000, name: 'Pentium 4', fam: 'x86', tr: 4.2e7, mhz: 2000, cores: 1, lp: 1, ca: 2, cache: 'L1 + 256 KB L2', note: 'Built for very high clock speeds: it launched at 1.5 GHz in 2000 and passed 2 GHz within a year. The race for gigahertz was on.' },  // milestone chip, 2000: built for high clock speeds, passing 2 GHz
            { y: 2004, name: 'Pentium 4 (late model)', fam: 'x86', tr: 1.25e8, mhz: 3800, cores: 1, lp: 2, ca: 2, cache: 'L1 + 1 MB L2', note: 'Reached 3.8 GHz but drew over 100 watts: the <span class="t">power wall</span>. Its one core showed the OS two logical processors.' },  // milestone chip, 2004: 3.8 GHz and over 100 watts, the power wall; one core seen as two logical processors
            { y: 2006, name: 'Intel Core 2 Duo', fam: 'x86', tr: 2.91e8, mhz: 2930, cores: 2, lp: 2, ca: 2, cache: 'L1 per core, 4 MB shared L2', note: 'Two cores at a lower clock beat one hot, fast core. From here on, new transistors mostly became more cores and cache.' },  // milestone chip, 2006: two slower cores beat one hot fast core
            { y: 2008, name: 'Intel Core i7', fam: 'x86', tr: 7.31e8, mhz: 3200, cores: 4, lp: 8, ca: 3, cache: 'L1 + L2 per core, 8 MB shared L3', note: 'Four cores with two logical processors each (8 in all), a big L3 shared by every core, and the memory controller on the chip.' },  // milestone chip, 2008: four cores, eight logical processors, a shared L3 and an on-chip memory controller
            { y: 2013, name: 'Apple A7', fam: 'ARM', tr: 1e9, mhz: 1300, cores: 2, lp: 2, ca: 3, cache: 'L1, 1 MB L2, 4 MB L3', note: 'A phone <span class="t" data-t="system on a chip">system on a chip</span> with about a billion transistors: CPU cores, a GPU and more on one piece of silicon.' },  // milestone chip, 2013: a phone system on a chip with about a billion transistors
            { y: 2020, name: 'Apple M1', fam: 'ARM', tr: 1.6e10, mhz: 3200, cores: 8, lp: 8, ca: 3, cache: 'L1, L2, shared system cache (L3)', note: 'An ARM system on a chip moves into laptops: 8 CPU cores, a GPU, an AI engine, with main memory in the same package.' },  // milestone chip, 2020: an ARM system on a chip in laptops, with memory in the same package
            { y: 2023, name: 'Apple M3 Max', fam: 'ARM', tr: 9.2e10, mhz: 4050, cores: 16, lp: 16, ca: 3, cache: 'L1, L2, shared system cache (L3)', note: 'About 92 billion transistors and 16 CPU cores, yet a clock close to 2004’s: the transistors went into cores, caches and specialised units.' },  // milestone chip, 2023: about 92 billion transistors and 16 cores, yet a clock close to 2004's
          ];  // closes CHIPS
          let metric = 'tr', sel = 0, moore = false;  // metric: which measure is plotted (transistors first); sel: the chip whose facts are shown; moore: whether the doubling line is drawn
          const svg = s('svg', { viewBox: `0 0 ${VW} 374`, width: '100%', role: 'img', 'aria-label': 'Chart of chip milestones' });  // the SVG chart area
          const capEl = h('p', { class: 'small m0' });  // the caption paragraph under the chart, which explains the metric being plotted
          const mooreBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { moore = !moore; draw(); } });  // button that shows or hides the "doubling every two years" line; it redraws the chart
          const mooreNote = h('div', { class: 'callout tip m0 small', 'data-label': 'Check the doubling rule' });  // tip box with the worked check for the current metric
          const info = h('div', { class: 'stack gap-s' });  // the facts panel for the selected chip
          const bPrev = h('button', { class: 'btn sm', type: 'button', onclick: () => pick(sel - 1) }, '◀ Earlier');  // "Earlier" button: selects the previous chip on the timeline
          const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => pick(sel + 1) }, 'Later ▶');  // "Later" button: selects the next chip on the timeline
          const yOf = (v) => { const m = METRICS[metric]; return Y1 - ((v - m.lo) / (m.hi - m.lo)) * (Y1 - Y0); };  // yOf(v): turns a value of the current metric into a y position (higher values sit nearer the top)
          function mark(c, x, y, r, isSel) {  // mark(c, x, y, r, isSel): draws one chip's point on the chart, shaped by its family
            // x86 = filled circle, ARM = filled diamond, early Intel = hollow circle; the selected chip gets a halo
            const halo = isSel ? s('circle', { cx: x, cy: y, r: r + 6, style: 'fill:none;stroke:var(--chc)', 'stroke-width': 2.5 }) : null;  // a ring in the chapter colour around the selected chip's point
            if (c.fam === 'ARM') return s('g', {}, halo, s('rect', { x: x - r * 0.85, y: y - r * 0.85, width: 1.7 * r, height: 1.7 * r, transform: `rotate(45 ${x} ${y})`, class: 's-cpu', 'stroke-width': 2, style: 'fill:var(--cpu)' }));  // ARM chips are drawn as a filled diamond (a square turned 45 degrees)
            return s('g', {}, halo, s('circle', { cx: x, cy: y, r, class: 's-cpu', 'stroke-width': 2.5, style: c.fam === 'x86' ? 'fill:var(--cpu)' : null }));  // other chips are circles: filled for x86, hollow for the earliest chip
          }  // ends mark()
          function draw() {  // draw(): rebuilds the whole chart and the panels beside it; runs at start and after every choice
            const m = METRICS[metric];  // m: the settings for the metric being plotted
            const g = s('g', {});  // g: a fresh group that collects the new chart
            // era bands
            g.append(s('rect', { x: xOf(2004.5), y: Y0, width: X1 - xOf(2004.5), height: Y1 - Y0, style: 'fill:var(--panel-2)' }));  // a shaded band behind everything after 2004: the multicore years
            g.append(s('text', { x: xOf(1987), y: 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, NW ? '← faster clocks' : '← one core, ever faster clocks'),  // era label over the left part: one core, ever faster clocks (shorter on phones)
              s('text', { x: xOf(2015), y: 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, NW ? 'more cores →' : 'more cores, same clock →'));  // era label over the right part: more cores, same clock
            // grid + axes
            m.minor.forEach((v) => g.append(s('line', { x1: X0, y1: yOf(v), x2: X1, y2: yOf(v), style: 'stroke:var(--line)', 'stroke-width': 1, 'stroke-dasharray': '2 4' })));  // faint dotted gridlines between the labelled ones (transistor chart only)
            m.ticks.forEach(([v, lab]) => g.append(s('line', { x1: X0, y1: yOf(v), x2: X1, y2: yOf(v), style: 'stroke:var(--line)', 'stroke-width': 1 }), s('text', { x: X0 - 6, y: yOf(v) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, lab)));  // a gridline and a value label at the left for every tick of the current metric
            for (let yr = 1970; yr <= 2020; yr += 10) g.append(s('text', { x: xOf(yr), y: Y1 + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, String(yr)), s('line', { x1: xOf(yr), y1: Y1, x2: xOf(yr), y2: Y1 + 5, class: 's-muted' }));  // year labels 1970 to 2020 under the time axis, each with a small tick mark
            g.append(s('line', { x1: X0, y1: Y1, x2: X1, y2: Y1, class: 's-line', 'stroke-width': 1.5 }));  // the time axis line along the bottom
            g.append(s('line', { x1: xOf(2004.5), y1: Y0, x2: xOf(2004.5), y2: Y1, style: 'stroke:var(--intr)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }), s('text', { x: xOf(2004.5), y: Y0 - 10, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--intr)', 'font-weight': 800 }, 'power wall ≈ 2004'));  // a dashed red line at 2004 labelled "power wall"
            // Moore's-law guide: 2,300 transistors in 1971, doubling every 2 years
            if (metric === 'tr' && moore) {  // only on the transistor chart, and only when the student has turned the doubling line on:
              const endYr = 1971 + ((m.hi - Math.log10(2300)) / Math.log10(2)) * 2;  // endYr: the year the doubling line reaches the top of the chart (starting at 2,300 transistors in 1971)
              g.append(s('line', { x1: xOf(1971), y1: yOf(Math.log10(2300)), x2: xOf(Math.min(endYr, 2025)), y2: yOf(Math.log10(2300) + ((Math.min(endYr, 2025) - 1971) / 2) * Math.log10(2)), style: 'stroke:var(--ok)', 'stroke-width': 2.5, 'stroke-dasharray': '8 5' }),  // the dashed green doubling line, stopped at 2025 if it would run past the chart
                s('text', { x: xOf(2003), y: yOf(Math.log10(2300) + 16 * Math.log10(2)) - 12, 'text-anchor': 'end', 'font-size': 13, style: 'fill:var(--ok)', 'font-weight': 800 }, '×2 every 2 years'));  // its label, "x2 every 2 years"
            }  // ends the doubling-line case
            // selected-year guide
            const c0 = CHIPS[sel];  // c0: the selected chip
            g.append(s('line', { x1: xOf(c0.y), y1: Y0, x2: xOf(c0.y), y2: Y1, style: 'stroke:var(--chc)', 'stroke-width': 1.5, opacity: 0.6 }));  // a faint vertical line through the selected chip's year
            // points (logical-processor rings first, then the chips)
            CHIPS.forEach((c, i) => {  // draws every chip on the chart
              const x = xOf(c.y) + (c.y === 1985 ? (c.fam === 'ARM' ? -5 : 5) : 0);  // x: the chip's year position; the two 1985 chips are nudged apart so they do not overlap
              if (metric === 'co' && c.lp > c.cores) g.append(s('circle', { cx: x, cy: yOf(m.lp(c)), r: 8, style: 'fill:none;stroke:var(--thread)', 'stroke-width': 2.5 }));  // on the cores chart, a pink ring where a chip's logical processors sit, if it has more than its cores
              const pt = s('g', {}, mark(c, x, yOf(m.val(c)), i === sel ? 9 : 6.5, i === sel), s('circle', { cx: x, cy: yOf(m.val(c)), r: 13, style: 'fill:transparent;stroke:none' }), s('title', {}, c.y + ' · ' + c.name));  // pt: the chip's mark, a bigger invisible circle that makes it easier to click, and a tooltip with year and name
              hotify(pt, c.y + ' ' + c.name, () => pick(i));  // makes the point a button; clicking it selects that chip
              g.append(pt);  // adds the point to the chart
            });  // ends the loop over chips
            // label the selected chip: try spots around the point, keep the first one that stays inside
            // the plot and does not cover another point (label width is estimated from its length)
            const sx = xOf(c0.y), sy = yOf(m.val(c0)), lw = c0.name.length * 7.8;  // sx, sy: where the selected chip's point is; lw: a rough width for its name label
            const others = CHIPS.filter((c, i) => i !== sel).map((c) => [xOf(c.y), yOf(m.val(c))]);  // others: the positions of every other chip, so the label can avoid covering them
            const spots = [[14, -12, 'start'], [-14, -12, 'end'], [-18, 5, 'end'], [18, 5, 'start'], [14, 26, 'start'], [-14, 26, 'end']];  // spots: places to try for the label, as [x offset, y offset, which side the text grows from]
            const fits = ([dx, dy, a]) => {  // fits(spot): true when a label at that spot stays inside the plot and covers no other point
              const bx0 = a === 'start' ? sx + dx : sx + dx - lw, bx1 = bx0 + lw, by0 = sy + dy - 14, by1 = sy + dy + 4;  // the corners of the box the label would take up
              if (bx0 < X0 + 4 || bx1 > X1 + 10 || by0 < Y0 - 2 || by1 > Y1 - 2) return false;  // false if the box would stick out of the plot area
              return !others.some(([ox, oy]) => ox > bx0 - 9 && ox < bx1 + 9 && oy > by0 - 9 && oy < by1 + 9);  // false if another chip's point lies inside (or very near) the box
            };  // ends fits()
            const [ldx, ldy, lan] = spots.find(fits) || spots[0];  // uses the first spot that fits, or the first spot if none does
            g.append(s('text', { x: sx + ldx, y: sy + ldy, 'text-anchor': lan, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--chc)' }, c0.name));  // writes the selected chip's name next to its point, in the chapter colour
            svg.replaceChildren(g);  // swaps the old chart for the new one
            capEl.innerHTML = m.cap;  // shows the caption for the current metric
            mooreBtn.style.display = metric === 'tr' ? '' : 'none';  // the doubling-line button only appears on the transistor chart
            mooreBtn.innerHTML = moore ? 'Hide the ×2 line' : 'Show ×2 every 2 years';  // its text says "Hide" or "Show" depending on whether the line is on
            mooreBtn.classList.toggle('on', moore);  // the button looks pressed while the line is on
            mooreNote.setAttribute('data-label', NOTES[metric][0]);  // sets the tip box heading for the current metric
            mooreNote.innerHTML = NOTES[metric][1];  // and its worked check text
            paintInfo();  // refreshes the facts panel for the selected chip
          }  // ends draw()
          function paintInfo() {  // paintInfo(): fills the facts panel for the selected chip
            const c = CHIPS[sel];  // c: the selected chip
            const era = c.y < 2004 ? ['chip cpu', 'Clock-speed race'] : c.y === 2004 ? ['chip intr', 'Power wall'] : c.y < 2010 ? ['chip thread', 'Multicore era'] : ['chip accent', 'System-on-chip era'];  // era: a coloured chip naming its era (clock race, power wall, multicore or system on a chip), chosen by year
            info.replaceChildren(  // replaces the panel's contents with:
              // the Earlier/Later buttons live in the year row (moved here on every repaint) to save height
              h('div', { class: NW ? 'row gap-s' : 'row gap-s nw' }, h('span', { class: 'big', style: { fontSize: '34px' } }, String(c.y)), h('span', { class: era[0] }, era[1]), h('span', { class: 'grow' }), bPrev, bNext),  // a row with the year as a big number, the era chip, and the Earlier / Later buttons pushed to the right
              h('div', { style: { fontSize: '20px', fontWeight: 800, lineHeight: 1.2 } }, c.name, ' ', h('span', { class: 'chip', style: { verticalAlign: 'middle' } }, c.fam + ' family')),  // the chip's name and a small chip naming its family
              h('div', { class: 'p12-kv' },  // a label and value table of its facts:
                h('span', {}, 'Transistors'), h('span', {}, '≈ ' + fmtN(c.tr)),  // row: transistor count, written in words
                h('span', {}, 'Top clock'), h('span', {}, '≈ ' + fmtHz(c.mhz)),  // row: top clock speed
                h('span', {}, 'Cores'), h('span', {}, c.cores + (c.lp > c.cores ? ` (${c.lp} logical processors)` : '')),  // row: cores, plus logical processors if there are more
                h('span', {}, 'On-chip cache'), h('span', {}, c.cache)),  // row: what cache the chip carries
              h('p', { class: 'small m0', html: c.note }));  // a short note on why the chip matters
            bPrev.title = bNext.title = `Chip ${sel + 1} of ${CHIPS.length}`;  // both buttons get a tooltip such as "Chip 3 of 12"
            bPrev.disabled = sel === 0; bNext.disabled = sel === CHIPS.length - 1;  // "Earlier" is disabled at the first chip and "Later" at the last
          }  // ends paintInfo()
          function pick(i) { sel = ctx.util.clamp(i, 0, CHIPS.length - 1); draw(); }  // pick(i): selects chip i (kept within the list by clamp) and redraws
          const seg = ctx.ui.seg([{ value: 'tr', label: 'Transistors' }, { value: 'hz', label: 'Clock speed' }, { value: 'co', label: 'Cores' }, { value: 'ca', label: 'Cache' }], metric, (v) => { metric = v; draw(); });  // switch for the metric: transistors, clock speed, cores or cache; picking one redraws
          el.append(h('div', { class: 'split r fill' },  // builds the page: a two-column layout with the chart in the wider left column
            h('div', { class: 'card white stack gap-s' },  // left: a white card holding the chart
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, mooreBtn),  // its top row: the metric switch and the doubling-line button
              h('div', { class: 'p12-svgwrap' }, svg),  // the chart, centred in its wrapper
              capEl,  // the caption for the metric
              h('p', { class: 'xs muted m0' }, 'Legend: ● x86   ◆ ARM   ○ earlier Intel. Values are approximate and rounded; clock = roughly the fastest version of that chip. Click any point.')),  // a small legend for the point shapes, a note that values are rounded, and "click any point"
            h('div', { class: 'stack' },  // right column: a vertical stack
              h('div', { class: 'card stack gap-s', style: { flex: 'none' } }, info),  // a card with the facts panel; flex none keeps it at its natural height
              mooreNote,  // the worked-check tip box
              h('div', { class: 'callout why m0 small', 'data-label': 'Why the clock stopped climbing', html: 'Power rises steeply with clock speed, since faster switching also needs a higher voltage. Near 4 GHz chips ran as hot as they could be cooled, so transistors went into more <span class="t" data-t="core">cores</span> and caches instead.' }))));  // "why the clock stopped climbing" box: power rises steeply with clock speed, so transistors went into cores
          draw();  // draws the chart when the step opens
        },  // ends render() for step 2
      },  // closes step 2

      /* ---------------- 3. Inside one chip: cores, cache levels, logical processors ---------------- */
      {  // opens step 3: inside one chip, with two tabs (build a multicore chip, and the SMT lab)
        title: 'One chip, many processors: cores, caches, threads',  // step 3 title
        kind: 'explore',  // kind "explore" labels the page as an Explore step
        core: true,  // core: true keeps this step on the guide's shorter core route
        render(el, ctx) {  // render(el, ctx): builds step 3 each time it is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          const tabs = ctx.ui.tabs([  // the guide's tab strip; each tab builds its lab into the panel when opened
            { label: 'Build a chip', render: (p) => chipBuilder(p, ctx) },  // tab 1: "Build a chip", filled by chipBuilder()
            { label: 'Two threads, one core', render: (p) => smtLab(p, ctx) },  // tab 2: "Two threads, one core", filled by smtLab()
          ]);  // closes the tab list
          el.append(h('div', { class: 'split l fill' },  // builds the page: a two-column layout with the tabs in the wider right column
            h('div', { class: 'stack' },  // left column: a vertical stack of text
              h('p', { class: 'lead m0' }, 'A modern microprocessor chip is really several processors plus a lot of fast memory.'),  // opening paragraph: a modern chip is several processors plus fast memory
              h('ul', { class: 'm0' },  // a bullet list of the three ideas
                h('li', { html: '<b>Several cores.</b> Each <span class="t">core</span> is a complete processor.' }),  // bullet: each core is a complete processor
                h('li', { html: '<b>Cache levels.</b> Each core has a small, fastest L1 and a larger L2; all cores share a big L3 (<span class="t" data-t="cache levels">L1, L2, L3</span>).' }),  // bullet: L1 and L2 per core, and a big shared L3
                h('li', { html: '<b>Logical processors.</b> A <b>thread</b> is one independent stream of instructions. With <span class="t" data-t="simultaneous multithreading">simultaneous multithreading (SMT)</span>, a core keeps two sets of registers, runs two threads at once and shows the OS two <span class="t" data-t="logical processor">logical processors</span> that share its <span class="t" data-t="execution unit">execution units</span>.' })),  // bullet: what a thread is, and how SMT shows the OS two logical processors per core
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Two logical processors are not two cores. They share one core’s units, so the gain is usually well under 2×.' }),  // "common mistake" box: two logical processors are not two cores
              h('div', { class: 'callout why m0', 'data-label': 'Why the OS cares', html: 'The OS <b>scheduler</b>, the part that decides which thread runs next, treats each logical processor as a CPU. Sharing a core or a cache changes how fast threads run.' })),  // "why the OS cares" box: the scheduler treats each logical processor as a CPU
            tabs));  // right column: the two tabs
        },  // ends render() for step 3
      },  // closes step 3

      /* ---------------- 4. GPUs and SIMD: one instruction, many numbers ---------------- */
      {  // opens step 4: GPUs and SIMD, adding two arrays with one lane or many
        title: 'GPUs and SIMD: one instruction, many numbers',  // step 4 title
        kind: 'explore',  // kind "explore" labels the page as an Explore step
        render(el, ctx) {  // render(el, ctx): builds the SIMD race each time step 4 is shown
          const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
          const A = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];  // A: the first array of 16 numbers to add
          const B = [2, 7, 1, 8, 2, 8, 1, 8, 2, 8, 4, 5, 9, 0, 4, 5];  // B: the second array of 16 numbers
          // geometry: desktop puts row labels on the left; phones put them above each row so the cells can be wider
          const NW = ctx.narrow, N = 16;  // NW is true on a phone-width screen; N is the number of items (16)
          const G = NW ? { VW: 340, VH: 238, CX: 6, CW: 20.5, RH: 26, fs: 13, ty: 18, rows: [20, 68, 126, 174], labs: [14, 62, 120, 168], line: 102, tick: 206, tickLab: 228 }  // phone layout numbers: drawing size, where the cells start, cell width, row height, font, and where rows and labels go
            : { VW: 640, VH: 256, CX: 132, CW: 31.5, RH: 34, fs: 15, ty: 23, rows: [6, 50, 108, 178], labs: [24, 68, 126, 196], line: 96, tick: 222, tickLab: 246 };  // wide layout numbers: the same settings, with room for row labels on the left
          const CX = G.CX, CW = G.CW;  // CX: x position of the first cell; CW: width of one cell column
          let lanes = 4;  // lanes: how many numbers the SIMD unit adds per instruction (4 to start)
          const svg = s('svg', { viewBox: `0 0 ${G.VW} ${G.VH}`, width: '100%', role: 'img', 'aria-label': 'Scalar versus SIMD addition of two arrays' });  // the SVG drawing of the four rows
          const readout = h('div', { class: 'grid-2', style: { gap: '10px' } });  // two small cards under the drawing that count instructions
          const cellX = (i) => CX + i * CW;  // cellX(i): the x position of cell i
          function row(g, y, vals, done, cls, hiFrom, hiTo) {  // row(g, y, vals, done, cls, hiFrom, hiTo): draws one row of 16 cells, filling the first "done" and framing hiFrom to hiTo
            for (let i = 0; i < N; i++) {  // goes through the 16 cells
              const on = i < done;  // on: whether this cell has been computed yet
              g.append(s('rect', { x: cellX(i), y, width: CW - 4, height: G.RH, rx: 5, class: on ? cls : 's-panel', 'stroke-width': on ? 2 : 1.2, 'stroke-dasharray': on ? null : '3 3' }));  // a filled, coloured cell when done, otherwise a dashed empty box
              if (on) g.append(s('text', { x: cellX(i) + (CW - 4) / 2, y: y + G.ty, 'text-anchor': 'middle', 'font-size': G.fs, 'font-weight': 800 }, String(vals[i])));  // a done cell shows its number
            }  // ends the loop over cells
            if (hiTo > hiFrom) g.append(s('rect', { x: cellX(hiFrom) - 3, y: y - 4, width: (hiTo - hiFrom) * CW + 2, height: G.RH + 8, rx: 8, style: 'fill:none;stroke:var(--chc)', 'stroke-width': 2.5 }));  // a chapter-coloured frame around the cells computed in this tick
          }  // ends row()
          function draw(t) {  // draw(t): redraws the race after t ticks (instructions); the player calls it for every frame
            const L = lanes, g = s('g', {});  // L: lanes now; g: a fresh group for the drawing
            const C = A.map((a, i) => a + B[i]);  // C: the answers, each A item plus the matching B item
            const sc = Math.min(t, N), sd = Math.min(N, t * L), simdPrev = Math.min(N, (t - 1) * L);  // sc: items the scalar core has done (one per tick); sd: items the SIMD unit has done (L per tick); simdPrev: before this tick
            // row label: two lines on the left (desktop) or one line above the row (phones)
            const lab = (k, a, b) => NW ? g.append(s('text', { x: 6, y: G.labs[k], 'font-size': 13.5, 'font-weight': 800 }, a, s('tspan', { class: 's-sub', 'font-weight': 700 }, '  ' + b)))  // lab(k, a, b): writes row k's label; on phones on one line above the row
              : g.append(s('text', { x: 4, y: G.labs[k], 'font-size': 14, 'font-weight': 800 }, a), s('text', { x: 4, y: G.labs[k] + 16, 'font-size': 13, class: 's-sub', 'font-weight': 700 }, b));  // on wider screens as a bold name with a grey note under it, to the left of the row
            lab(0, 'Array A', '16 numbers'); row(g, G.rows[0], A, N, 's-mem', 0, 0);  // row 1: array A, all 16 numbers shown
            lab(1, 'Array B', '16 numbers'); row(g, G.rows[1], B, N, 's-mem', 0, 0);  // row 2: array B, all 16 numbers shown
            g.append(s('line', { x1: CX, y1: G.line, x2: cellX(N) - 4, y2: G.line, class: 's-muted' }));  // a thin line separating the inputs from the two results
            lab(2, 'Scalar core', 'C = A + B, 1 lane'); row(g, G.rows[2], C, sc, 's-cpu', t >= 1 && t <= N ? sc - 1 : 0, t >= 1 && t <= N ? sc : 0);  // row 3: the scalar core's results so far, framing the one item it just computed
            lab(3, 'SIMD unit', 'C = A + B, ' + L + (L === 1 ? ' lane' : ' lanes')); row(g, G.rows[3], C, sd, 's-accent', t >= 1 && simdPrev < N ? simdPrev : 0, t >= 1 && simdPrev < N ? sd : 0);  // row 4: the SIMD unit's results so far, framing the group of L items it just computed
            // lane-group ticks under the SIMD row show how the 16 items split into instructions
            for (let k = 0; k < N / L; k++) {  // one bracket per SIMD instruction
              const x1 = cellX(k * L), x2 = cellX((k + 1) * L) - 4;  // x1, x2: the first and last cell covered by instruction k
              g.append(s('path', { d: `M${x1} ${G.tick} v6 H${x2} v-6`, class: 's-muted', 'stroke-width': 1.5 }));  // draws the bracket under those cells
              if (L >= 2) g.append(s('text', { x: (x1 + x2) / 2, y: G.tickLab, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, L >= 4 ? 'instr ' + (k + 1) : String(k + 1)));  // labels it "instr k" (just the number when there are only 2 lanes; no label for 1 lane)
            }  // ends the bracket loop
            if (L === 1) g.append(s('text', { x: cellX(8), y: G.tickLab, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, NW ? 'one instruction per number' : 'one instruction per number, like the scalar core'));  // with one lane, a note that it is one instruction per number, just like the scalar core
            svg.replaceChildren(g);  // swaps the old drawing for the new one
            const need = N / L, px = 3840 * 2160;  // need: SIMD instructions needed for 16 items; px: the number of pixels in a 4K image
            readout.replaceChildren(  // refills the two counting cards:
              h('div', { class: 'card tight' }, h('div', { class: 'xs muted b' }, 'ADD INSTRUCTIONS FOR 16 NUMBERS'), h('div', { class: 'small', html: `Scalar <b>16</b> · SIMD 16 ÷ ${L} = <b style="color:var(--accent)">${need}</b> · <b>${L === 1 ? 'no saving' : L + '× fewer'}</b>` })),  // card 1: 16 scalar adds versus 16 divided by L SIMD adds, and how many times fewer
              h('div', { class: 'card tight' }, h('div', { class: 'xs muted b' }, 'BRIGHTEN A 4K GREY IMAGE'), h('div', { class: 'small', html: `Scalar <b>8,294,400</b> · SIMD <b style="color:var(--accent)">${(px / L).toLocaleString('en-US')}</b>` }), h('div', { class: 'xs muted' }, '3840 × 2160 pixels, one add each')));  // card 2: brightening a 4K image, 8,294,400 scalar adds versus that number divided by L
          }  // ends draw()
          const cap = (t) => {  // cap(t): the caption for tick t
            const L = lanes, need = N / L;  // L: lanes now; need: SIMD instructions needed
            if (t === 0) return `<b>Ready.</b> Both units must add 16 pairs of numbers. The scalar core handles one pair per instruction; the SIMD unit handles ${L} pair${L > 1 ? 's' : ''} per instruction. Press play.`;  // tick 0: both units must add 16 pairs; press play
            if (t === N) return L === 1 ? '<b>Both done after 16 instructions.</b> With a single lane, SIMD is no better than scalar. Drag the slider to add lanes.' : `<b>Both done.</b> Scalar: 16 instructions. SIMD: ${need}. Same result, <b>${L}× fewer instructions</b>, because every lane did its add at the same time.`;  // tick 16: both done; with one lane there is no saving, otherwise L times fewer instructions
            if (t < need) return L === 1 ? `<b>Tick ${t}.</b> With a single lane, both units compute just one item per instruction: C[${t - 1}].` : `<b>Tick ${t}.</b> One scalar instruction computes C[${t - 1}]. One SIMD instruction computes C[${(t - 1) * L}] to C[${t * L - 1}] all at once.`;  // before the SIMD unit finishes: which item or group of items each unit computed this tick
            if (t === need) return `<b>Tick ${t}.</b> The SIMD unit is <b>finished</b> after just ${need} instruction${need > 1 ? 's' : ''}. The scalar core still has ${N - t} to go.`;  // the tick when the SIMD unit finishes, and how many the scalar core has left
            return `<b>Tick ${t}.</b> SIMD finished long ago; the scalar core is on item ${t} of 16.`;  // after that: the SIMD unit is done and the scalar core is still working
          };  // ends cap()
          const player = ctx.ui.player({ count: N + 1, interval: 750, render: (t) => { draw(t); return cap(t); } });  // the guide's step player with 17 frames (ticks 0 to 16), 0.75 s apart; each frame draws the race and returns its caption
          const slider = ctx.ui.slider({ label: 'Lanes in the SIMD unit', min: 0, max: 4, step: 1, value: 2, format: (v) => String(2 ** v), onInput: (v) => { lanes = 2 ** v; player.reset(); } });  // slider from 0 to 4 whose value v means 2 to the power v lanes (1, 2, 4, 8 or 16); moving it restarts the player
          el.append(h('div', { class: 'split l fill' },  // builds the page: a two-column layout with the lab in the wider right column
            h('div', { class: 'stack' },  // left column: a vertical stack of text
              h('p', { class: 'lead m0' }, 'Drawing a picture means doing the same small sum for millions of pixels. GPUs are built for exactly that.'),  // opening paragraph: drawing means the same small sum for millions of pixels
              h('p', { class: 'm0', html: 'A <span class="t" data-t="graphics processing unit">graphics processing unit (GPU)</span> uses <span class="t" data-t="SIMD">SIMD</span> (single instruction, multiple data): one instruction applies the same operation to many numbers at once, each in its own <span class="t">lane</span>. An ordinary (scalar) instruction handles just one number.' }),  // paragraph: what a GPU and SIMD are, and how a lane differs from a scalar instruction
              h('p', { class: 'm0', html: 'Built for graphics, GPUs now also crunch numbers for physics simulations and machine learning. Most CPU cores have a <span class="t">vector unit</span> too, for SIMD on 4 to 16 numbers.' }),  // paragraph: GPUs now also do science and machine learning; CPU cores have vector units too
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Training an AI model is mostly trillions of multiply-adds on big grids of numbers. A large GPU runs thousands of lanes at once, which is why GPUs power modern AI.' }),  // "why it matters" box: AI training is mostly multiply-adds, so GPUs power it
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'SIMD only helps when the same operation applies to many independent items. Code full of if-statements, or steps that each need the previous result, gains little.' })),  // "common mistake" box: SIMD only helps when the same operation applies to many independent items
            h('div', { class: 'card white stack gap-s' }, slider, h('div', { class: 'p12-svgwrap' }, svg), readout, player.el)));  // right column: a white card with the slider, the drawing, the counting cards and the player
        },  // ends render() for step 4
      },  // closes step 4

      /* ---------------- 5. DSPs and accelerators: follow a phone call ---------------- */
      {  // opens step 5: follow a phone call through a DSP and accelerators
        title: 'DSPs and accelerators: follow a phone call through the chip',  // step 5 title
        kind: 'learn',  // kind "learn" labels the page as a Learn step
        render(el, ctx) {  // render(el, ctx): builds the phone-call animation each time step 5 is shown
          const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
          const BLOCKS = [  // BLOCKS: the five stages a call passes through; lab = label going out, lab2 = coming back, out = what leaves the stage
            { k: 'mic', cls: 's-io', lab: 'Microphone\n+ converter', lab2: 'Speaker\n+ converter', out: '320 samples' },  // stage 1: the microphone and its converter going out (the speaker on the way back); it produces 320 samples
            { k: 'dsp', cls: 's-proc', lab: 'Audio DSP', lab2: 'Audio DSP', out: '5,120 → 250 bits' },  // stage 2: the audio DSP, which squeezes 5,120 bits of sound down to about 250 bits
            { k: 'enc', cls: 's-warn', lab: 'Encryption\nengine', lab2: 'Encryption\nengine', out: 'scrambled bits' },  // stage 3: the encryption engine (an accelerator), which outputs scrambled bits
            { k: 'mdsp', cls: 's-proc', lab: 'Modem DSP', lab2: 'Modem DSP', out: 'radio waveform' },  // stage 4: the modem DSP, which turns the bits into a radio waveform
            { k: 'rad', cls: 's-io', lab: 'Radio +\nantenna', lab2: 'Radio +\nantenna', out: 'sent' },  // stage 5: the radio and antenna, which send it
          ];  // closes BLOCKS
          // frames: which block is active, how many outputs are shown, direction, and the narration
          const F = [  // F: the nine animation frames; act = stages lit up, outs = output labels shown, dir = 1 going out or -1 coming in
            { act: [], outs: 0, dir: 1, cap: '<b>A phone call.</b> Every 20 ms a new slice of your voice must be captured, cleaned, squeezed, protected and sent, without ever falling behind. Watch which parts of the chip do the work.' },  // frame 0: the task, a new slice of voice every 20 ms that must never fall behind
            { act: ['mic'], outs: 1, dir: 1, cap: '<b>Capture.</b> The converter measures the microphone’s signal 16,000 times per second. Every 20 ms that makes a chunk of 320 samples of 16 bits each: 5,120 bits.' },  // frame 1: capture, 320 samples of 16 bits every 20 ms
            { act: ['dsp'], outs: 1, dir: 1, cap: '<b>Clean up (audio DSP).</b> The DSP removes echo and background noise by running the same multiply-and-add filter over every sample, finishing well inside the 20 ms before the next chunk arrives.' },  // frame 2: the audio DSP removes echo and noise with the same filter on every sample
            { act: ['dsp'], outs: 2, dir: 1, cap: '<b>Compress (DSP as a speech codec).</b> The same DSP encodes the speech, squeezing 5,120 bits into about 250: roughly 20 times smaller, so it fits the radio link.' },  // frame 3: the same DSP compresses the speech about 20 times
            { act: ['enc'], outs: 3, dir: 1, cap: '<b>Protect (accelerator).</b> A dedicated encryption engine inside the modem scrambles the bits so eavesdroppers hear nothing. It does only this one job, at a sliver of the energy software would need.' },  // frame 4: the encryption accelerator scrambles the bits
            { act: ['mdsp'], outs: 4, dir: 1, cap: '<b>Prepare to transmit (modem DSP).</b> The modem’s DSPs add error-correcting bits and turn the data into the exact waveform the radio must send.' },  // frame 5: the modem DSP adds error-correcting bits and makes the radio waveform
            { act: ['rad'], outs: 5, dir: 1, cap: '<b>Send.</b> The radio transmits the chunk. 20 ms later the next one is already on its way: 50 chunks every second, for as long as you talk.' },  // frame 6: the radio sends the chunk; 50 chunks a second
            { act: ['mic', 'dsp', 'enc', 'mdsp', 'rad'], outs: 0, dir: -1, cap: '<b>Listening runs in reverse.</b> The radio receives, the modem DSP recovers and error-corrects the bits, the engine decrypts, the audio DSP decodes, and the converter drives the speaker.' },  // frame 7: listening runs through the same stages in reverse
            { act: ['cpu'], outs: 0, dir: -1, cap: '<b>The main CPU cores barely woke up.</b> A core could do all of this in software, but specialists do it with far less energy, so in many phones the cores sleep through most of a call and the battery lasts.' },  // frame 8: the main CPU cores barely woke up, which saves battery
          ];  // closes the frame list
          // geometry: desktop runs the five blocks left to right; phones stack them top to bottom so text stays readable
          const NW = ctx.narrow;  // NW is true on a phone-width screen
          const GM = NW ? {  // GM: layout numbers; this first set stacks the stages top to bottom for phones
            VW: 340, VH: 598, blk: (k) => ({ x: 16, y: 30 + k * 58, w: 150, h: 44 }), fs: 14,  // phone: drawing size, where stage k's box goes, and the font size
            out: (b) => ({ x: b.x + b.w + 14, y: b.y + b.h / 2 + 5, a: 'start' }),  // phone: output labels sit to the right of each stage
            modem: (b2, b3) => ({ x: 8, y: b2.y - 8, w: 324, h: b3.y + b3.h - b2.y + 16, lx: 326, ly: b2.y + 10, la: 'end' }),  // phone: the dashed "inside the modem" frame around stages 3 and 4
            cpu: { x: 8, y: 330, w: 324, h: 100, cx: (c) => 26 + c * 76, cy: 358, cw: 56, ch: 36, ty: 350, nx: 170, ny: 420 },  // phone: the sleeping CPU cores box and the four core boxes inside it
            st: { tx: 8, ty: 456, x0: 12, step: 64, y: 466, base: 516, x1: 332 },  // phone: the stream timeline (title, first chunk, spacing, heights)
            key: (k) => ({ x: 8 + (k % 2) * 165, y: 556 + Math.floor(k / 2) * 22 }),  // phone: the colour key, two entries per row
          } : {  // the second set runs the stages left to right for wider screens
            VW: 640, VH: 362, blk: (k) => ({ x: 6 + k * 132, y: 52, w: 100, h: 100 }), fs: 14.5,  // wide: drawing size, stage boxes side by side, font size
            out: (b) => ({ x: b.x + b.w / 2, y: b.y + b.h + 22, a: 'middle' }),  // wide: output labels sit under each stage
            modem: (b2, b3) => ({ x: b2.x - 12, y: 24, w: b3.x + b3.w - b2.x + 24, h: 164, lx: (b2.x + b3.x + b3.w) / 2, ly: 40, la: 'middle' }),  // wide: the dashed modem frame around stages 3 and 4
            cpu: { x: 6, y: 206, w: 300, h: 118, cx: (c) => 24 + c * 70, cy: 242, cw: 52, ch: 44, ty: 230, nx: 156, ny: 311 },  // wide: the CPU cores box at the bottom left
            st: { tx: 330, ty: 230, x0: 332, step: 60, y: 246, base: 296, x1: 632 },  // wide: the stream timeline at the bottom right
            key: (k) => ({ x: 8 + k * 150, y: 342 }),  // wide: the colour key in one row along the bottom
          };  // closes the two layouts
          const svg = s('svg', { viewBox: `0 0 ${GM.VW} ${GM.VH}`, width: '100%', role: 'img', 'aria-label': 'The path of a phone call through the chip' });  // the SVG drawing of the chip's call path
          function draw(i) {  // draw(i): rebuilds the drawing for frame i and returns its caption; the player calls it for every frame
            const f = F[i], g = s('g', {});  // f: this frame; g: a fresh group for the drawing
            const act = new Set(f.act);  // act: the set of stages lit up in this frame
            const md = GM.modem(GM.blk(2), GM.blk(3));  // md: where the modem frame goes, worked out from stages 3 and 4
            g.append(s('rect', { x: md.x, y: md.y, width: md.w, height: md.h, rx: 12, style: 'fill:none;stroke:var(--io)', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }),  // the dashed orange modem frame
              s('text', { x: md.lx, y: md.ly, 'text-anchor': md.la, 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--io)' }, 'inside the modem'));  // and its label, "inside the modem"
            g.append(s('text', { x: 6, y: 16, 'font-size': 13.5, 'font-weight': 800, class: 's-sub' }, f.dir > 0 ? (NW ? 'Your voice, going out  ↓' : 'Your voice, going out  →') : (NW ? '↑  The other person’s voice, coming in' : '←  The other person’s voice, coming in')));  // a heading that says which way the sound travels, with an arrow (down or right going out, up or left coming in)
            BLOCKS.forEach((b, k) => {  // draws each of the five stages
              const on = act.has(b.k), dim = act.size && !on, B0 = GM.blk(k);  // on: this stage is working now; dim: another stage is working, so this one fades; B0: its box
              g.append(sbox(s, B0.x, B0.y, B0.w, B0.h, b.cls, f.dir > 0 ? b.lab : b.lab2, { fs: GM.fs, sw: on ? 4 : 2, gcls: dim ? 'p12-dim' : null }));  // the stage box, with its outgoing or incoming label; thick when working, faded when idle
              if (k < 4) {  // arrow to the next block, pointing the way the sound travels
                const B1 = GM.blk(k + 1);  // B1: the next stage's box
                const [p, q] = NW ? [[B0.x + B0.w / 2, B0.y + B0.h + 3], [B1.x + B1.w / 2, B1.y - 3]] : [[B0.x + B0.w + 3, B0.y + B0.h / 2], [B1.x - 3, B1.y + B1.h / 2]];  // p, q: the two ends of the arrow between the stages (vertical on phones, horizontal otherwise)
                const [a, z] = f.dir > 0 ? [p, q] : [q, p];  // the arrow points forward going out and backward coming in
                g.append(s('line', { x1: a[0], y1: a[1], x2: z[0], y2: z[1], class: 's-line', 'marker-end': 'url(#arr)' }));  // draws the arrow with the guide's shared arrowhead
              }  // ends the arrow case
              if (f.dir > 0 && k < f.outs) { const o = GM.out(B0); g.append(s('text', { x: o.x, y: o.y, 'text-anchor': o.a, 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--chc)' }, b.out)); }  // going out, stages the voice has already passed show what they produced, in the chapter colour
            });  // ends the loop over stages
            // main CPU cores: asleep
            const cpuOn = act.has('cpu'), C = GM.cpu;  // cpuOn: whether the CPU cores are lit in this frame; C: the CPU box layout
            const cg = sbox(s, C.x, C.y, C.w, C.h, 's-cpu', null, { sw: cpuOn ? 4 : 2, gcls: act.size && !cpuOn ? 'p12-dim' : null });  // the CPU cores box; it fades while other units work and thickens in the last frame
            [0, 1, 2, 3].forEach((c) => cg.append(s('rect', { x: C.cx(c), y: C.cy, width: C.cw, height: C.ch, rx: 7, class: 's-cpu', 'stroke-width': 1.5, style: 'fill:var(--panel)' }), s('text', { x: C.cx(c) + C.cw / 2, y: C.cy + C.ch / 2 + 5, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub', 'font-weight': 800 }, 'zz')));  // four small core boxes, each marked "zz" because they are asleep
            cg.append(s('text', { x: C.x + 14, y: C.ty, 'font-size': 15, 'font-weight': 800 }, 'Main CPU cores'), s('text', { x: C.nx, y: C.ny, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: 's-sub' }, 'asleep, saving battery'));  // the box title "Main CPU cores" and the note "asleep, saving battery"
            g.append(cg);  // adds the CPU box to the drawing
            // the stream: one chunk every 20 ms
            const T = GM.st;  // T: the stream timeline layout
            g.append(s('text', { x: T.tx, y: T.ty, 'font-size': 15, 'font-weight': 800 }, 'A stream: one chunk every 20 ms'));  // its title: one chunk every 20 ms
            g.append(s('line', { x1: T.x0 - 2, y1: T.base, x2: T.x1, y2: T.base, class: 's-line', 'stroke-width': 1.5 }));  // the time line along the bottom
            for (let c = 0; c < 5; c++) {  // draws five chunk slots, 20 ms apart
              const x = T.x0 + c * T.step;  // x: where this slot sits
              const cur = f.dir > 0 && i > 0 && c === 1, past = c === 0 && i > 0;  // cur: the chunk being worked on (going out, after the intro); past: the chunk already sent
              g.append(s('rect', { x, y: T.y, width: 54, height: 42, rx: 7, class: cur ? 's-proc' : past ? 's-ok' : 's-panel', 'stroke-width': cur ? 2.5 : 1.5, 'stroke-dasharray': !cur && !past ? '3 3' : null }),  // the chunk box: teal while being worked on, green once sent, dashed while still to come
                s('line', { x1: x, y1: T.base - 4, x2: x, y2: T.base + 4, class: 's-line', 'stroke-width': 1.5 }), s('text', { x: x + 2, y: T.base + 20, 'font-size': 13, class: 's-sub', 'font-weight': 700 }, c * 20 + ' ms'));  // a tick mark on the time line and its label (0 ms, 20 ms, ...)
              g.append(s('text', { x: x + 27, y: T.y + 26, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: cur ? null : 's-sub' }, past ? 'sent ✓' : cur ? 'now' : 'next'));  // the word inside the box: "sent", "now" or "next"
            }  // ends the slot loop
            // colour key
            [['s-cpu', 'CPU core'], ['s-proc', 'DSP'], ['s-warn', 'Accelerator'], ['s-io', 'I/O device']].forEach(([c, nm], k) => {  // draws the colour key: CPU core, DSP, accelerator, I/O device
              const K = GM.key(k);  // K: where this key entry goes
              g.append(s('rect', { x: K.x, y: K.y, width: 18, height: 14, rx: 3, class: c, 'stroke-width': 1.5 }), s('text', { x: K.x + 24, y: K.y + 12, 'font-size': 13.5, 'font-weight': 700, class: 's-sub' }, nm));  // a small coloured swatch and its name
            });  // ends the colour key
            svg.replaceChildren(g);  // swaps the old drawing for the new one
            return f.cap;  // hands the caption back to the player to show
          }  // ends draw()
          const player = ctx.ui.player({ count: F.length, interval: 3200, render: draw });  // the guide's step player with one frame per entry in F, 3.2 s apart; draw() renders each frame
          el.append(h('div', { class: 'split l fill' },  // builds the page: a two-column layout with the animation in the wider right column
            h('div', { class: 'stack' },  // left column: a vertical stack of text
              h('p', { class: 'lead m0' }, 'Some jobs never stop: sound from a microphone, a radio signal, a video. Signal processors are built for them.'),  // opening paragraph: some jobs never stop, and signal processors are built for them
              h('p', { class: 'm0', html: 'A <span class="t" data-t="digital signal processor">digital signal processor (DSP)</span> handles a <b>stream</b> of samples arriving at a fixed rate. It repeats the same arithmetic, mostly multiply-and-add, on every sample, and must finish each chunk before the next arrives. DSPs sit inside other devices as embedded <span class="t" data-t="coprocessor">coprocessors</span>: in modems, speech and video codecs, and security hardware.' }),  // paragraph: what a DSP does with a stream, and where DSPs sit as coprocessors
              h('p', { class: 'm0', html: 'A <span class="t">hardware accelerator</span> goes further: a circuit that does exactly one job, such as encryption or compression. It can do nothing else, but it is far faster and uses far less energy than software on a CPU core.' }),  // paragraph: a hardware accelerator does exactly one job, faster and with less energy
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A head chef (CPU core) can cook anything. The pastry station (DSP) and the espresso machine (accelerator) do one kind of thing, but faster and cheaper, and the chef is free for everything else.' })),  // analogy box: the head chef, the pastry station and the espresso machine
            h('div', { class: 'card white stack gap-s' }, h('div', { class: 'p12-svgwrap' }, svg), player.el)));  // right column: a white card with the drawing and the player
        },  // ends render() for step 5
      },  // closes step 5

      /* ---------------- 6. Floor plan of a smartphone SoC ---------------- */
      {  // opens step 6: a tour of a smartphone system on a chip, drawn as a floor plan
        title: 'Tour a smartphone system on a chip',  // step 6 title
        kind: 'explore',  // kind "explore" labels the page as an Explore step
        core: true,  // core: true keeps this step on the guide's shorter core route
        render(el, ctx) {  // render(el, ctx): builds the floor plan each time step 6 is shown
          const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
          const P = [  // P: the blocks of the floor plan; each has a position and size, a colour role, a label, and the text shown when clicked
            { k: 'pc', x: 20, y: 44, w: 160, h: 150, cls: 's-cpu', role: 'cpu', lab: '', name: 'Performance CPU cores (2)', text: 'Big, fast general-purpose cores. They run apps, web pages and the operating system itself when there is heavy work to do.', best: 'branchy, unpredictable code where each step depends on the last', os: 'The scheduler moves demanding threads onto these cores.' },  // block: 2 performance CPU cores, for heavy work
            { k: 'ec', x: 190, y: 44, w: 124, h: 150, cls: 's-cpu', role: 'cpu', lab: '', name: 'Efficiency CPU cores (4)', text: 'Smaller, slower cores that use a fraction of the power. They handle light and background work such as syncing mail or checking for messages.', best: 'light background tasks that must not drain the battery', os: 'Mixing big and small cores lets the OS trade speed for battery life, thread by thread.' },  // block: 4 efficiency CPU cores, for light background work
            { k: 'sc', x: 324, y: 44, w: 86, h: 150, cls: 's-mem', role: 'mem', lab: 'Shared\ncache', name: 'Shared cache', text: 'A few megabytes of fast memory shared by the cores, and often by the GPU and other units too, so data does not always make the slow trip to main memory.', best: 'keeping recently used data close to every unit', os: '' },  // block: the shared cache
            { k: 'gpu', x: 420, y: 44, w: 220, h: 220, cls: 's-accent', role: 'gpu', lab: 'GPU', name: 'Graphics processing unit (GPU)', text: 'Hundreds of SIMD lanes (SIMD: one instruction applied to many numbers at once). It draws the screen, the user interface and games, and doubles as a general-purpose vector processor.', best: 'the same calculation on millions of pixels or numbers', os: 'Apps reach it through a graphics driver; the OS shares it between apps.' },  // block: the GPU, hundreds of SIMD lanes
            { k: 'npu', x: 20, y: 204, w: 150, h: 140, cls: 's-warn', role: 'acc', lab: 'AI engine\n(NPU)', name: 'AI engine (neural processing unit)', text: 'An accelerator for the multiply-add grids inside neural networks: face unlock, photo clean-up, speech recognition, on-device assistants.', best: 'running trained AI models at very low power', os: '' },  // block: the AI engine (NPU), an accelerator for neural-network math
            { k: 'isp', x: 180, y: 204, w: 134, h: 65, cls: 's-warn', role: 'acc', lab: 'Camera image\nprocessor', name: 'Image signal processor (camera)', text: 'A fixed pipeline that turns the camera sensor’s raw readings into a picture: colour, noise removal, focus and exposure, for every frame, 30 to 60 times a second.', best: 'processing camera frames as they stream in', os: '' },  // block: the camera image signal processor, a fixed pipeline for every camera frame
            { k: 'vid', x: 180, y: 279, w: 134, h: 65, cls: 's-warn', role: 'acc', lab: 'Video codec', name: 'Video codec', text: 'A fixed-function accelerator that compresses and decompresses video. Streaming a movie through software on the CPU would drain the battery; the codec does it at a trickle of power.', best: 'encoding and decoding video streams', os: '' },  // block: the video codec, which compresses and decompresses video at very low power
            { k: 'dsp', x: 324, y: 204, w: 86, h: 140, cls: 's-proc', role: 'dsp', lab: 'DSP', name: 'Audio and sensor DSP', text: 'A digital signal processor, built for streams: call audio, echo removal, listening for a wake word, counting steps from motion sensors, all while the main cores sleep.', best: 'steady streams of samples with deadlines', os: '' },  // block: the audio and sensor DSP, which handles streams while the main cores sleep
            { k: 'sec', x: 420, y: 274, w: 105, h: 70, cls: 's-warn', role: 'acc', lab: 'Security\nengine', name: 'Security engine', text: 'A walled-off coprocessor with its own encryption accelerators. It encrypts storage, checks fingerprint or face data, and guards keys that even the operating system cannot read.', best: 'encryption and protecting secret keys', os: 'The OS asks it to perform crypto operations but never sees the keys.' },  // block: the security engine, which guards keys even the OS cannot read
            { k: 'io', x: 535, y: 274, w: 105, h: 70, cls: 's-io', role: 'io', lab: 'Display\n+ I/O', name: 'Display and I/O controllers', text: 'Drive the screen, the USB port, flash storage and sensors. Each is an I/O module built into the chip.', best: 'moving data to and from the outside world', os: 'The OS controls each one through a device driver.' },  // block: the display and I/O controllers, each an I/O module built into the chip
            { k: 'mod', x: 20, y: 354, w: 294, h: 152, cls: 's-io', role: 'io', lab: 'Modem (4G / 5G)\nwith its own DSPs', name: 'Modem', text: 'Turns bits into radio waveforms and back, using its own DSPs and accelerators for modulation, error correction and encryption. Many phone SoCs build it in; others use a separate modem chip.', best: 'cellular radio communication', os: 'To the OS it is an I/O device, driven like a network card.' },  // block: the modem with its own DSPs, which the OS treats as an I/O device
            { k: 'mc', x: 324, y: 354, w: 316, h: 66, cls: 's-mem', role: 'mem', lab: 'Memory controller', name: 'Memory controller', text: 'Manages the main-memory chips and schedules every read and write that the cores, GPU and other units send to them.', best: 'feeding every unit from one shared pool of memory', os: 'Because all units share one pool, the OS must share it fairly too.' },  // block: the memory controller, which schedules every unit's reads and writes
            { k: 'ram', x: 324, y: 430, w: 316, h: 76, cls: 's-mem', role: 'mem', lab: 'Main memory (DRAM)\nits own die, stacked on top', name: 'Main memory (DRAM)', text: 'Several gigabytes of DRAM on a separate memory die, stacked directly on top of the processor die in the same package. Very short wires make it faster and cheaper in energy than memory on a separate board.', best: 'holding every running program and its data', os: '' },  // block: main memory, a separate DRAM die stacked on top in the same package
          ];  // closes the block list
          // phones: a two-column floor plan in a narrow viewBox, so the labels stay readable
          const NW = ctx.narrow;  // NW is true on a phone-width screen
          const NARROW = { pc: [16, 40, 160, 150], ec: [184, 40, 140, 150], gpu: [16, 200, 196, 150], sc: [220, 200, 104, 150], npu: [16, 360, 150, 76], dsp: [174, 360, 150, 76],  // phone positions for every block as [x, y, width, height], laid out in two columns
            isp: [16, 446, 150, 64], vid: [174, 446, 150, 64], sec: [16, 520, 150, 64], io: [174, 520, 150, 64], mod: [16, 594, 308, 64], mc: [16, 668, 308, 50], ram: [16, 728, 308, 60] };  // (continued) the lower blocks of the phone layout, down to main memory
          if (NW) P.forEach((b) => { [b.x, b.y, b.w, b.h] = NARROW[b.k]; });  // on a phone, each block's position and size are replaced with its phone values
          const VW = NW ? 340 : 660, VH = NW ? 800 : 520;  // VW, VH: the size of the drawing's coordinate grid (tall on phones, wide otherwise)
          let sel = null;  // sel: the block clicked last (null = none yet)
          const seen = new Set();  // seen: the blocks the student has already clicked
          const svg = s('svg', { viewBox: `0 0 ${VW} ${VH}`, width: '100%', role: 'img', 'aria-label': 'Floor plan of a smartphone system on a chip' });  // the SVG floor plan
          const info = h('div', { class: 'card white stack gap-s', style: { minHeight: '262px' } });  // the info card beside the plan; a minimum height keeps it from jumping as texts change
          const prog = h('div', { class: 'meter', style: { flex: '1' } }, h('i'));  // progress meter for blocks explored
          const progTxt = h('span', { class: 'small b' });  // the "Explored n of 13" text beside the meter
          function draw() {  // draw(): rebuilds the floor plan; runs at start and after each click
            const g = s('g', {});  // g: a fresh group for the drawing
            g.append(sbox(s, 6, 6, VW - 12, VH - 12, 's-panel', null, { rx: 16, sw: 3 }), s('text', { x: 20, y: 28, 'font-size': 13.5, class: 's-sub', 'font-weight': 800 }, NW ? 'ONE SoC PACKAGE' : 'ONE SoC PACKAGE · the dashed block is a separate memory die stacked on top'));  // the package outline and its title (with a note about the dashed memory die on wider screens)
            P.forEach((b) => {  // draws each block
              // the GPU draws its own label (above its lane grid); the DRAM is dashed because it is a separate die
              const grp = sbox(s, b.x, b.y, b.w, b.h, b.cls, b.k === 'gpu' ? null : b.lab || null, { fs: 14, sw: 2, dash: b.k === 'ram' ? '7 4' : null, gcls: (sel === b.k ? 'sel' : '') + (seen.has(b.k) ? ' seen' : '') });  // the block box; the GPU gets no label here, main memory is dashed; "sel" and "seen" classes mark its state
              if (b.k === 'pc') [0, 1].forEach((c) => grp.append(sbox(s, b.x + 10 + c * 74, b.y + 36, 66, 102, 's-cpu', 'P-core', { fs: 13.5, sw: 1.5 })));  // the performance-core block gets two "P-core" boxes inside it
              if (b.k === 'ec') [0, 1, 2, 3].forEach((c) => grp.append(sbox(s, b.x + (b.w - 108) / 2 + (c % 2) * 56, b.y + 36 + Math.floor(c / 2) * 54, 52, 48, 's-cpu', 'E', { fs: 13.5, sw: 1.5 })));  // the efficiency-core block gets four small "E" boxes in a 2 x 2 grid
              if (b.k === 'pc' || b.k === 'ec') grp.append(s('text', { x: b.x + b.w / 2, y: b.y + 22, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, b.k === 'pc' ? 'Performance cores' : 'Efficiency cores'));  // both core blocks get a title along their top edge
              if (b.k === 'gpu') {  // the GPU block:
                grp.append(slabel(s, b.x + b.w / 2, b.y + (b.h - 72) / 2 + 4, 'GPU', { fs: 22 }));  // its "GPU" label, placed above the lane grid
                for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) grp.append(s('rect', { x: b.x + (b.w - 178) / 2 + c * 23, y: b.y + b.h - 72 + r * 20, width: 17, height: 14, rx: 3, class: 's-accent', 'stroke-width': 1 }));  // a grid of 3 rows by 8 small squares that stand for its many SIMD lanes
              }  // ends the GPU case
              if (seen.has(b.k)) grp.append(s('text', { x: b.x + b.w - 7, y: b.y + b.h - 7, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 900, style: 'fill:var(--ok)' }, '✓'));  // a block already explored gets a green tick in its bottom-right corner
              g.append(hotify(grp, b.name, () => pick(b.k)));  // makes the block a button; clicking it picks the block
            });  // ends the loop over blocks
            svg.replaceChildren(g);  // swaps the old plan for the new one
          }  // ends draw()
          function paintInfo() {  // paintInfo(): fills the info card for the picked block, or with the intro before anything is picked
            if (!sel) {  // nothing picked yet:
              info.replaceChildren(h('h3', { class: 'm0' }, 'Click any block'), h('p', { class: 'm0', html: 'Every solid block shares one piece of silicon: a <span class="t" data-t="system on a chip">system on a chip</span>. The main memory is a separate die (piece of silicon) stacked on top, inside the same protective package. Click each block to learn what it does, what it is best at, and how the OS deals with it.' }),  // intro heading and paragraph: every solid block shares one piece of silicon, and memory is stacked on top
                h('div', { class: 'row gap-s' }, ...Object.values(ROLE).map((r) => h('span', { class: 'chip ' + r.chip }, r.name))));  // a colour key made from the ROLE table's chips
            } else {  // a block is picked:
              const b = P.find((x) => x.k === sel), r = ROLE[b.role];  // b: the picked block; r: its colour role
              info.replaceChildren(h('div', { class: 'row gap-s' }, h('span', { class: 'chip ' + r.chip }, r.name)), h('h3', { class: 'm0' }, b.name), h('p', { class: 'm0 small' }, b.text),  // its role chip, its full name as a heading, and what it does
                h('div', { class: 'small', html: '<b>Best at:</b> ' + b.best }), ...(b.os ? [h('div', { class: 'small', html: '<b style="color:var(--os)">OS link:</b> ' + b.os })] : []));  // what it is best at, plus how the OS deals with it when the block has an OS note
            }  // ends the if/else
            prog.firstChild.style.width = (seen.size / P.length) * 100 + '%';  // stretches the meter to the share of blocks explored
            progTxt.textContent = `Explored ${seen.size} of ${P.length}`;  // updates the "Explored n of 13" text
          }  // ends paintInfo()
          // on phones the info card sits below the tall diagram, so bring it into view after each tap
          function pick(k) { sel = k; seen.add(k); draw(); paintInfo(); if (NW && info.scrollIntoView) info.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }  // pick(k): selects and records block k, redraws, and on phones scrolls the info card into view
          el.append(h('div', { class: 'split r fill' },  // builds the page: a two-column layout with the plan in the wider left column
            h('div', { class: 'p12-svgwrap' }, svg),  // left: the floor plan, centred in its wrapper
            h('div', { class: 'stack' },  // right column: a vertical stack
              info,  // the info card
              h('div', { class: 'row nw' }, prog, progTxt),  // the progress meter and its text
              h('div', { class: 'card tight stack gap-s' },  // a small card that shows the trade-off across the chip:
                h('div', { class: 'xs muted b' }, 'THE TRADE-OFF ACROSS THE CHIP'),  // its heading
                h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: NW ? '2px' : '4px' } }, ...[['cpu', 'CPU core'], ['accent', 'GPU'], ['proc', 'DSP'], ['warn', 'Accelerator']].flatMap(([c, t], i) => [i ? '→' : null, h('span', { class: 'chip ' + c, style: NW ? { fontSize: '12.5px', padding: '2px 7px' } : null }, t)]).filter(Boolean)),  // the chips CPU core, GPU, DSP, accelerator in a row with arrows between them
                h('div', { class: 'row nw xs muted b', style: { justifyContent: 'space-between' } }, h('span', {}, '← runs any program'), h('span', {}, 'one job, least energy →'))),  // under them: "runs any program" at the left end and "one job, least energy" at the right end
              h('div', { class: 'callout why m0 small', 'data-label': 'Why put it all on one chip?', html: 'Signals cross millimetres instead of centimetres, so they are faster and cost far less energy. One part is smaller and cheaper than many, and every unit can share the same memory instead of copying data between boards.' }))));  // "why put it all on one chip?" box: shorter wires, a cheaper single part, and one shared memory
          draw(); paintInfo();  // draws the plan and the intro text when the step opens
        },  // ends render() for step 6
      },  // closes step 6

      /* ---------------- 7. Lab: match each workload to the best unit ---------------- */
      {  // opens step 7: the lab that sends jobs to the right unit
        title: 'Lab: send each job to the unit that does it best',  // step 7 title
        kind: 'lab',  // kind "lab" labels the page as a Hands-on Lab
        render(el, ctx) {  // render(el, ctx): builds the job-matching lab each time step 7 is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          const fb = h('div', { class: 'card white stack gap-s', style: { minHeight: '176px' } });  // fb: the feedback card that the game writes into
          const left = h('div', {});  // left: the empty box the game is built in
          const m = matcher(left, ctx, fb);  // m: builds the matcher game (defined near the top of the file) and keeps its reset, solve, hint and score row
          el.append(h('div', { class: 'split r fill' },  // builds the page: a two-column layout with the game in the wider left column
            left,  // left: the game
            h('div', { class: 'stack' },  // right column: a vertical stack
              h('p', { class: 'm0', html: 'You are the dispatcher for a phone’s <span class="t" data-t="system on a chip">SoC</span>. Send every job to the unit that runs it fastest for the least energy.' }),  // instructions: you are the dispatcher for a phone's system on a chip
              fb,  // the feedback card
              m.scoreEl,  // the score meter and text from the game
              h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => m.reset() }, 'Start over'), h('button', { class: 'btn sm', type: 'button', onclick: () => m.hint() }, 'Rule of thumb'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => m.solve() }, 'Show answers')),  // buttons: Start over, Rule of thumb and Show answers, each calling the game's matching function
              h('div', { class: 'callout why m0 small', 'data-label': 'Why the OS cares', html: 'Every unit is a shared resource. The OS schedules threads onto CPU cores and, through device drivers, queues work for the GPU, DSP and accelerators, deciding which program gets each one next.' }))));  // "why the OS cares" box: every unit is a shared resource the OS schedules
        },  // ends render() for step 7
      },  // closes step 7

      /* ---------------- 8. Recap ---------------- */
      {  // opens step 8: the recap, with flip cards and an era timeline
        title: 'Recap: the six ideas to remember',  // step 8 title
        kind: 'recap',  // kind "recap" labels the page as a Recap step
        render(el, ctx) {  // render(el, ctx): builds the recap each time step 8 is shown
          const { h } = ctx;  // takes the element-building helper h out of ctx
          const arrow = () => h('span', { class: 'b muted', style: { fontSize: '20px', textAlign: 'center', lineHeight: 1 } }, ctx.narrow ? '↓' : '→');  // arrow(): a large grey arrow between two eras, pointing down on phones and right on wider screens
          const era = (cls, when, what) => h('div', { class: 'box ' + cls, style: { flex: '1', fontSize: '14.5px', padding: '6px 8px', lineHeight: 1.3 } }, h('div', { class: 'xs muted b' }, when), what);  // era(cls, when, what): a coloured box with a small date line and a short description
          el.append(h('div', { class: 'stack fill' },  // builds the page as one full-height stack
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Click again to flip back.'),  // instruction: say each answer out loud before flipping the card
            ctx.ui.flipcards([  // the guide's flip cards: each card shows a question and flips to the answer when clicked
              ['What is a microprocessor?', 'A whole processor on a single chip (first sold in 1971). It made desktop and handheld computers possible and became the fastest kind of general-purpose processor.'],  // flip card 1: what a microprocessor is
              ['Why did clock speeds stop climbing around 2004?', 'The power wall: faster clocks needed more power and made more heat than a chip could shed. New transistors went into more cores and bigger caches instead.'],  // flip card 2: why clock speeds stopped climbing around 2004
              ['What is inside a modern multicore chip?', 'Several cores, each with its own L1 and L2 cache, a shared L3, and often two logical processors per core (SMT) sharing that core’s execution units.'],  // flip card 3: what is inside a modern multicore chip
              ['What does SIMD mean, and who uses it?', 'Single instruction, multiple data: one instruction works on many numbers at once, one per lane. GPUs are built on it, and CPU vector units use it too.'],  // flip card 4: what SIMD means and who uses it
              ['What is a DSP for?', 'Streams of samples (audio, radio, video) arriving at a fixed rate with deadlines. DSPs sit inside modems, speech and video codecs, and security hardware.'],  // flip card 5: what a DSP is for
              ['What is a system on a chip?', 'One chip holding CPU cores, caches, a GPU, DSPs, accelerators and I/O such as radios and codecs, with main memory in the same package.'],  // flip card 6: what a system on a chip is
            ], { cols: 3, height: 172 }),  // closes the card list; the cards sit in 3 columns and are each at least 172 pixels tall
            h('div', { class: 'card tight stack gap-s' },  // a small card that tells the whole story as a row of eras
              h('h4', { class: 'm0' }, 'The whole story in one line'),  // its heading
              h('div', { class: ctx.narrow ? 'stack gap-s' : 'row nw', style: { gap: '6px', alignItems: 'stretch' } },  // a row of eras on wider screens, or a vertical stack on phones
                era('cpu', '1971', 'The whole CPU fits on one chip'), arrow(),  // era box: 1971, the whole CPU on one chip, then an arrow
                era('cpu', '1970s to ~2004', 'More transistors, ever faster clocks'), arrow(),  // era box: 1970s to about 2004, more transistors and faster clocks
                era('intr', '~2004', 'The power wall stops clock growth'), arrow(),  // era box: about 2004, the power wall (in the red interrupt colour)
                era('thread', 'mid-2000s on', 'More cores, SMT, deeper caches'), arrow(),  // era box: mid-2000s on, more cores, SMT and deeper caches (in the thread colour)
                era('mem', 'today', 'Phone SoCs: cores, GPU, DSPs, accelerators')))));  // era box: today, phone SoCs with many kinds of unit; closes the row and the page
        },  // ends render() for step 8
      },  // closes step 8

      /* ---------------- 9. Check yourself ---------------- */
      {  // opens step 9: the section quiz
        title: 'Check yourself: microprocessors, GPUs, DSPs and SoCs',  // step 9 title
        kind: 'check',  // kind "check" labels the page as Check Yourself
        quiz: [  // quiz: the questions, which the guide's quiz engine turns into interactive cards and marks
          { q: 'What made the first microprocessor different from the processors that came before it?',  // quiz question 1 (multiple choice): what made the first microprocessor different
            choices: ['The entire processor was built on a single chip.', 'It was the first processor able to run a stored program.', 'It had several cores working in parallel.', 'It was faster than any earlier computer.'], answer: 0,  // four choices; answer 0 (the first) is correct: the whole processor on one chip
            feedback: [null, 'Stored-program computers had existed since the 1940s. What was new was fitting the whole processor onto one chip.', 'Multicore chips arrived only in the mid-2000s. Early microprocessors had a single core.', 'The first microprocessor was far slower than the big computers of its day. Its advantage was size and cost.'],  // feedback for each wrong choice: stored programs, multiple cores and raw speed all came earlier or later
            why: 'A microprocessor puts the whole processor (arithmetic, registers and control) on one chip. Early ones were slow, but being tiny and cheap they made desktop and handheld computers possible.' },  // explanation: one chip made processors tiny and cheap, which made desktop and handheld computers possible
          { q: 'Around 2004–2005, chip makers stopped pushing clock speeds much higher. Why?',  // quiz question 2 (multiple choice): why clock speeds stopped rising around 2004
            choices: ['Faster clocks made chips use too much power and run too hot to cool.', 'Transistors could no longer be made any smaller.', 'Software could not take advantage of faster clocks.', 'Moore’s law ended, so no extra transistors were available.'], answer: 0,  // four choices; the first, too much power and heat, is correct
            feedback: [null, 'Transistors kept shrinking, and counts kept doubling for many more years.', 'Every program benefits from a faster clock; that was exactly its appeal.', 'Transistor counts kept climbing, from hundreds of millions to tens of billions.'],  // feedback for each wrong choice: transistors kept shrinking, software liked fast clocks, counts kept doubling
            why: 'This limit is the power wall. Power rises steeply with clock speed, so designers spent the growing transistor budget on more cores and bigger caches instead.' },  // explanation: the power wall pushed designers toward more cores and bigger caches
          { type: 'num', q: 'A laptop chip has 6 cores, and each core runs 2 hardware threads using simultaneous multithreading. How many logical processors does the operating system scheduler see?', answer: 12, tol: 0, unit: 'logical processors',  // quiz question 3 (calculate): logical processors on a 6-core chip with 2 threads per core, exactly 12
            why: 'Logical processors = cores × hardware threads per core = 6 × 2 = 12. The OS can hand a thread to each one, even though each pair shares a core.' },  // explanation: cores times threads per core, 6 x 2 = 12
          { type: 'tf', q: 'Turning on simultaneous multithreading (two logical processors per core) roughly doubles the work each core gets done.', answer: false,  // quiz question 4 (true or false): SMT roughly doubles a core's work; the answer is false
            why: 'Both logical processors share one core’s execution units and caches. SMT fills slots that would sit idle, often gaining something like 10–30 percent, far less than a second real core.' },  // explanation: the two threads share one core's units and caches, so the gain is often only 10 to 30 percent
          { type: 'num', q: 'A SIMD unit has 8 lanes. How many add instructions does it need to add two arrays of 1,024 numbers, pair by pair?', answer: 128, tol: 0, unit: 'instructions',  // quiz question 5 (calculate): SIMD instructions for 1,024 numbers with 8 lanes, exactly 128
            why: 'Each instruction adds 8 pairs at once, so 1,024 ÷ 8 = 128 instructions. A scalar core would need 1,024.' },  // explanation: 1,024 divided by 8 is 128, against 1,024 for a scalar core
          { type: 'num', q: 'A chip has 1 billion transistors. If the count doubles every two years, about how many billion transistors will a chip have 10 years later?', answer: 32, tol: 0, unit: 'billion',  // quiz question 6 (calculate): transistors after 10 years of doubling every two years from 1 billion, exactly 32
            why: 'Ten years is five doublings: 1 × 2 × 2 × 2 × 2 × 2 = 2⁵ = 32 billion. This steady doubling is Moore’s law.' },  // explanation: five doublings, 2 to the power 5 = 32 billion, which is Moore's law
          { type: 'match', q: 'Match each processing unit to the job it does best.',  // quiz question 7 (match the pairs): each processing unit with the job it does best
            pairs: [['CPU core', 'Running branchy, general-purpose code such as a compiler'], ['GPU', 'Shading millions of pixels with the same math'], ['DSP', 'Cleaning up a live stream of audio samples'], ['Hardware accelerator', 'Encrypting data with one fixed algorithm']],  // the four pairs: CPU core, GPU, DSP and hardware accelerator
            why: 'Each unit trades flexibility for efficiency: the CPU core runs anything, the GPU repeats math over huge arrays, the DSP keeps up with timed streams, and an accelerator does one fixed job.' },  // explanation: each unit trades flexibility for efficiency
          { type: 'bucket', q: 'Does each job suit SIMD (the same operation on many independent items) or not?', buckets: ['Suits SIMD', 'Gains little from SIMD'],  // quiz question 8 (sort into groups): does each job suit SIMD or not
            items: [['Brighten every pixel of a photo', 0], ['Add two lists of a million numbers', 0], ['Multiply the big number grids inside a neural network', 0], ['Walk a chain of records where each step needs the address found in the one before', 1], ['Parse a typed command full of if-statements', 1]],  // the five jobs with their correct group (0 = suits SIMD, 1 = gains little)
            why: 'SIMD needs many independent items that all get the same operation. Chains of dependent steps and branch-heavy logic cannot be spread across lanes.' },  // explanation: SIMD needs many independent items with the same operation
          { type: 'multi', q: 'Which of these can be integrated into a smartphone’s system on a chip (SoC)?',  // quiz question 9 (select all): what can be built into a smartphone SoC
            choices: ['CPU cores', 'Cache memory shared by the cores', 'A GPU', 'DSPs', 'A cellular modem and radio', 'Main memory, stacked in the same package', 'The touchscreen panel itself'], answer: [0, 1, 2, 3, 4, 5],  // seven choices; all but the touchscreen panel are correct
            why: 'An SoC combines CPU cores, caches, a GPU, DSPs, accelerators and I/O such as radios and codecs, with main memory stacked in the same package. It contains the display controller that drives the screen, but the glass touchscreen panel is a separate part of the phone.' },  // explanation: the SoC holds the display controller, but the glass panel is a separate part
          { q: 'Which statement best describes how SIMD hardware is used today?',  // quiz question 10 (multiple choice): how SIMD hardware is used today
            choices: ['GPUs, built for graphics, now also run physics and machine learning, and most CPU cores have vector units too.', 'GPUs only draw graphics; scientific and AI number crunching runs on ordinary CPU cores instead.', 'Only GPUs can do SIMD; a CPU core always handles exactly one number per instruction.', 'GPUs have replaced CPU cores in most computers, because SIMD speeds up every kind of program.'], answer: 0,  // four choices; the first (GPUs also do physics and AI, CPU cores have vector units) is correct
            feedback: [null, 'GPUs are now general-purpose vector processors: their thousands of lanes suit physics simulations and training AI models, not just pixels.', 'Most CPU cores now include vector units that apply one instruction to 4, 8 or 16 numbers at once.', 'SIMD helps only when the same operation applies to many independent items. Branchy code, including the OS itself, still runs best on CPU cores.'],  // feedback for each wrong choice: GPUs are general-purpose now, CPUs have vector units, SIMD does not help every program
            why: 'SIMD applies one instruction to many data items. GPUs are built from a huge number of SIMD lanes, which suits any big, repetitive array job, and CPU cores add smaller vector units for the same reason.' },  // explanation: GPUs are built from SIMD lanes and CPU cores add smaller vector units
          { q: 'Compared with running the same job as software on a CPU core, a hardware accelerator is usually:',  // quiz question 11 (multiple choice): how an accelerator compares with software on a CPU core
            choices: ['faster and far more energy-efficient, but able to do only its one job', 'slower, but able to run any program', 'faster only because it runs at a higher clock speed', 'the same thing as a GPU'], answer: 0,  // four choices; the first (faster and more efficient, but only one job) is correct
            feedback: [null, 'That describes a CPU core: flexible but less efficient. An accelerator is the specialist.', 'Its advantage comes from circuitry built for one task, not from a faster clock.', 'A GPU is programmable and handles many kinds of array math. An accelerator is fixed-function.'],  // feedback for each wrong choice: that is a CPU core, it is not about clock speed, and it is not a GPU
            why: 'An accelerator is circuitry designed for one task, such as encryption, compression or video decoding. That specialisation buys speed and large energy savings at the cost of flexibility.' },  // explanation: specialised circuitry buys speed and energy savings at the cost of flexibility
          { type: 'tf', q: 'Most desktop PCs use x86 processors, while nearly every smartphone uses ARM processor cores.', answer: true,  // quiz question 12 (true or false): PCs mostly use x86 and phones mostly use ARM; the answer is true
            why: 'The x86 family began with Intel’s 8086 in 1978 and dominates PCs and servers (Intel and AMD build it). ARM designs are licensed to many chip makers and power nearly all phones, and a growing number of laptops and servers.' },  // explanation: where the two instruction set families came from and where each is used
        ],  // closes the quiz list
      },  // closes step 9
    ],  // closes the steps list

    notes: `${/* notes: the printable reading notes for this section, written as HTML inside backticks */''}
<h3>1. What a microprocessor is</h3>${/* notes heading for part 1: what a microprocessor is */''}
<p>A <b>microprocessor</b> is a complete processor (arithmetic, registers and control) on a <b>single chip</b> of silicon. Before 1971 a processor was built from many separate chips (earlier still, from transistors or vacuum tubes) spread over several boards. The first commercial microprocessor (1971) held about 2,300 transistors. One chip made processors small, cheap and fast, which made desktop and then handheld computers possible, and microprocessors became the fastest general-purpose processors ever built. Three eras: a processor made of many chips; a one-chip CPU with memory, graphics, sound and modem on separate chips or cards; today’s <b>system on a chip (SoC)</b>.</p>${/* notes paragraph: a whole processor on one chip, the first one in 1971, and the three eras */''}

<h3>2. Fifty years of evolution</h3>${/* notes heading for part 2: fifty years of evolution */''}
<ul>${/* start of the bullet list of trends */''}
<li><b>More transistors.</b> A transistor is a tiny electrically controlled switch. The count per chip roughly doubles every two years (<b>Moore’s law</b>): count after <i>n</i> years ≈ start × 2<sup>n/2</sup>. Example: 1 billion, 10 years later → 2<sup>5</sup> = 32 billion. From 2,300 in 1971, 25 doublings give ≈ 77 billion by 2021; real chips reached 16 billion (2020) and 92 billion (2023).</li>${/* notes bullet: transistor counts double about every two years, with a worked example */''}
<li><b>Faster clocks, for a while.</b> Clock speed (cycles per second, in hertz) rose about 5,000-fold, from 0.74 MHz (1971) to 3.8 GHz (2004), then stalled near 3–4 GHz: the <b>power wall</b>. Power rises steeply with clock speed (faster switching also needs a higher voltage), and chips could not shed the heat.</li>${/* notes bullet: clock speeds rose 5,000-fold, then hit the power wall */''}
<li><b>Then more cores.</b> From the mid-2000s extra transistors became extra cores (2, 4, 8, 16…) and specialised units.</li>${/* notes bullet: from the mid-2000s, extra transistors became extra cores */''}
<li><b>Deeper caches.</b> Early chips had no cache; on-chip caches arrived around 1989. One level (L1) by 1993, two by 2000, a shared third by 2008, because processors sped up far faster than main memory.</li>${/* notes bullet: caches grew from none to three levels */''}
<li><b>Two big families.</b> <b>x86</b> began with Intel’s 8086 (1978) and dominates PCs and servers (Intel, AMD). <b>ARM</b> designs are licensed to many chip makers and run nearly every smartphone, plus a growing number of laptops and servers.</li>${/* notes bullet: the two big instruction set families, x86 and ARM */''}
</ul>${/* ends the bullet list */''}
<table>${/* start of the notes table of milestone chips */''}
<tr><th>Year</th><th>Chip</th><th>Transistors</th><th>Clock</th><th>Cores</th><th>Cache levels</th></tr>${/* table header row: year, chip, transistors, clock, cores, cache levels */''}
<tr><td>1971</td><td>Intel 4004</td><td>2,300</td><td>740 kHz</td><td>1</td><td>none</td></tr>${/* table row: the first microprocessor, 1971 */''}
<tr><td>1978</td><td>Intel 8086 (x86)</td><td>29,000</td><td>10 MHz</td><td>1</td><td>none</td></tr>${/* table row: the chip that began x86, 1978 */''}
<tr><td>1985</td><td>ARM1 (ARM)</td><td>25,000</td><td>6 MHz</td><td>1</td><td>none</td></tr>${/* table row: the first ARM chip, 1985 */''}
<tr><td>2004</td><td>Late Pentium 4</td><td>125 million</td><td>3.8 GHz</td><td>1 (2 logical)</td><td>L1, L2</td></tr>${/* table row: the power-wall chip of 2004, one core seen as two logical processors */''}
<tr><td>2008</td><td>Core i7</td><td>731 million</td><td>3.2 GHz</td><td>4 (8 logical)</td><td>L1, L2, L3</td></tr>${/* table row: the 2008 quad-core chip with a shared L3 */''}
<tr><td>2023</td><td>Apple M3 Max (ARM)</td><td>92 billion</td><td>4.05 GHz</td><td>16</td><td>L1, L2, L3</td></tr>${/* table row: the 2023 chip with 92 billion transistors and 16 cores */''}
</table>${/* ends the table */''}
<p><small>All values approximate and rounded.</small></p>${/* small print: all values are approximate */''}

<h3>3. Inside a modern multicore chip</h3>${/* notes heading for part 3: inside a modern multicore chip */''}
<ul>${/* start of the bullet list of chip parts */''}
<li><b>Cores:</b> each is a complete processor with its own registers, control logic and <b>execution units</b> (for example two integer units “Int” for whole-number math, a floating-point unit “FP” for numbers with fractions, and a load/store unit “Ld/St” that moves data between memory and registers).</li>${/* notes bullet: cores and their execution units (Int, FP, Ld/St) */''}
<li><b>Cache levels:</b> on a typical recent laptop or desktop chip, each core has a private <b>L1</b> (about 32–64 KB, ~4–5 cycles) and <b>L2</b> (256 KB–2 MB, ~12–16 cycles); all cores share a large <b>L3</b> (8–64 MB, ~30–70 cycles). Main memory, reached through the on-chip memory controller, takes ~80–100 ns: hundreds of cycles.</li>${/* notes bullet: cache levels with typical sizes and speeds, and how slow main memory is */''}
<li><b>Logical processors:</b> a <b>thread</b> is one independent stream of instructions being carried out. With <b>simultaneous multithreading (SMT)</b>, one core holds the registers of two threads and presents two <b>logical processors</b> (hardware threads) sharing its execution units. Logical processors = cores × threads per core: 4 × 2 = 8; 6 × 2 = 12.</li>${/* notes bullet: threads, SMT and how to count logical processors */''}
</ul>${/* ends the bullet list */''}
<p>Why SMT helps: one thread often leaves units idle, especially while it waits for memory; a second thread fills those slots. In the toy example thread A alone used 11 of 32 slots (34%); with a second thread, 21 of 32 (66%). Real gains are usually around 10–30%, because the threads also compete for the same units and caches. <b>Common mistake:</b> two logical processors are not two cores.</p>${/* notes paragraph: why SMT helps (the 11 versus 21 of 32 slots example) and why real gains are smaller */''}
<h3>4. GPUs and SIMD</h3>${/* notes heading for part 4: GPUs and SIMD */''}
<p><b>SIMD</b> (single instruction, multiple data): one instruction performs the same operation on many data items at once, each in its own <b>lane</b>. An ordinary <b>scalar</b> instruction handles one item. With L lanes, N items need N ÷ L instructions: 16 numbers with 4 lanes → 4; 1,024 with 8 lanes → 128; brightening a 4K grey image (3840 × 2160 = 8,294,400 pixels, one add each) with 16 lanes → 518,400.</p>${/* notes paragraph: SIMD and lanes, with instruction counts for 16, 1,024 and a 4K image */''}
<p>A <b>GPU</b> is built from a very large number of SIMD lanes. Designed for graphics (every pixel gets the same math), GPUs now also serve as general-purpose vector processors for physics simulations and machine learning (huge grids of multiply-adds). Most CPU cores also include <b>vector units</b> that do SIMD on 4 to 16 numbers. <b>Common mistake:</b> SIMD helps only when the same operation applies to many independent items; branchy code, or steps that each need the previous result, gain little.</p>${/* notes paragraph: GPUs as SIMD machines, vector units in CPUs, and when SIMD does not help */''}

<h3>5. DSPs and hardware accelerators</h3>${/* notes heading for part 5: DSPs and hardware accelerators */''}
<p>A <b>digital signal processor (DSP)</b> handles <b>streams</b> of samples (audio, radio, video) arriving at a fixed rate. It repeats the same multiply-and-add arithmetic on every sample and must finish each chunk before the next arrives. DSPs are embedded <b>coprocessors</b> in modems, in encoding and decoding speech and video (<b>codecs</b>), and in encryption and security hardware.</p>${/* notes paragraph: what a DSP does with streams, and where DSPs are embedded */''}
<p>A <b>hardware accelerator</b> is a circuit for one specific job, such as encryption, compression, video coding or running AI models. It cannot run other code, but its specialised circuitry (not a faster clock) makes it much faster and far more energy-efficient than software on a CPU core.</p>${/* notes paragraph: an accelerator does one job, faster and with less energy */''}
<p>A phone call: the microphone is sampled 16,000 times a second (320 samples × 16 bits = 5,120 bits every 20 ms); the audio DSP removes noise and encodes the chunk to about 250 bits; the modem’s encryption hardware scrambles it; the modem’s DSPs add error correction and form the radio waveform; the radio transmits. Incoming speech takes the reverse path, and the main CPU cores can sleep through most of the call.</p>${/* notes paragraph: the phone call worked example, stage by stage */''}

<h3>6. The system on a chip</h3>${/* notes heading for part 6: the system on a chip */''}
<p>A smartphone <b>SoC</b> puts on one die (one piece of silicon): performance and efficiency CPU cores, shared cache, a GPU, an AI engine, a camera image processor, a video codec, an audio/sensor DSP, a security engine, display and I/O controllers, often the cellular modem, and a memory controller. Main memory (DRAM) is a separate die stacked on top in the same <b>package</b>. The display controller is on the chip; the touchscreen panel is not. Why one chip: shorter wires are faster and use less energy, one part is cheaper than many, and all units share one pool of memory. Trade-off across the chip: CPU core (runs any program) → GPU → DSP → accelerator (one job, least energy).</p>${/* notes paragraph: every unit on a phone SoC, memory stacked in the package, and why one chip helps */''}

<h3>7. Matching jobs to units</h3>${/* notes heading for part 7: matching jobs to units */''}
<table>${/* start of the notes table that matches units to jobs */''}
<tr><th>Unit</th><th>Best at</th><th>Examples</th></tr>${/* table header row: unit, best at, examples */''}
<tr><td>CPU core</td><td>branchy, varied, general-purpose logic</td><td>compiling code; the OS scheduler</td></tr>${/* table row: CPU core, branchy general-purpose logic */''}
<tr><td>GPU</td><td>the same math over huge arrays</td><td>rendering 3D scenes; physics of a million particles; training a neural-network layer</td></tr>${/* table row: GPU, the same math over huge arrays */''}
<tr><td>DSP</td><td>steady streams of samples with deadlines</td><td>decoding call audio; filtering microphone noise</td></tr>${/* table row: DSP, steady streams with deadlines */''}
<tr><td>Accelerator</td><td>one fixed, very common job</td><td>encrypting messages; decoding video</td></tr>${/* table row: accelerator, one fixed common job */''}
</table>${/* ends the table */''}
<p><b>Why the OS cares:</b> every unit is a shared resource. The <b>scheduler</b> (the part of the OS that decides which thread runs next, and where) treats each logical processor as a CPU it can run a thread on, and through device drivers the OS queues work for the GPU, DSPs and accelerators.</p>`,  // notes paragraph: why the OS cares, since every unit is shared; the backtick then ends the notes text
  });  // closes the section object and ends the call that registers it with the guide
})();  // closes the function that wraps the whole file and runs it straight away
