/* =====================================================================
   Section 1.2 — Evolution of the Microprocessor
   From a processor spread over many chips, to one chip, to many cores on
   one chip, to a whole system on a chip with GPUs, DSPs and accelerators.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- colour roles used throughout this section ----------
     CPU cores = cpu (blue) · caches / memory = mem (green) · I/O, radios = io (orange)
     GPU = accent (indigo) · DSP = proc (teal) · fixed-function accelerators = warn (amber)
     hardware threads (logical processors) = thread (pink) */
  const ROLE = {
    cpu: { cls: 's-cpu', chip: 'cpu', v: '--cpu', name: 'CPU core' },
    gpu: { cls: 's-accent', chip: 'accent', v: '--accent', name: 'GPU' },
    dsp: { cls: 's-proc', chip: 'proc', v: '--proc', name: 'DSP' },
    acc: { cls: 's-warn', chip: 'warn', v: '--warn', name: 'Accelerator' },
    mem: { cls: 's-mem', chip: 'mem', v: '--mem', name: 'Memory / cache' },
    io: { cls: 's-io', chip: 'io', v: '--io', name: 'I/O / radio' },
  };

  /* ---------- tiny SVG helpers (pass ctx.s as s) ---------- */
  // centred multi-line label; lines are split on '\n'
  function slabel(s, x, y, text, o = {}) {
    const lines = String(text).split('\n');
    const fs = o.fs || 14, lh = o.lh || fs * 1.2;
    const t = s('text', { x, y: y - ((lines.length - 1) * lh) / 2 + fs * 0.35, 'text-anchor': o.anchor || 'middle', 'font-size': fs, 'font-weight': o.fw || 700, class: o.tcls || null, style: o.style || null });
    lines.forEach((ln, i) => t.append(s('tspan', { x, dy: i ? lh : 0 }, ln)));
    return t;
  }
  // rounded rectangle (class "fr" so hover/selection styles can find it) with an optional centred label
  function sbox(s, x, y, w, hh, cls, label, o = {}) {
    const g = s('g', { class: o.gcls || null });
    g.append(s('rect', { x, y, width: w, height: hh, rx: o.rx != null ? o.rx : 8, class: cls + ' fr', 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash || null }));
    if (label) g.append(slabel(s, x + w / 2, y + hh / 2, label, o));
    return g;
  }
  // make an SVG group behave like a button (mouse, keyboard, and the test fuzzer's ".hot" selector)
  function hotify(g, label, fn) {
    g.setAttribute('class', ((g.getAttribute('class') || '') + ' p12-hot hot').trim());
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', label);
    g.addEventListener('click', fn);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
    return g;
  }

  /* ---------- step 3, tab 1: build a multicore chip and see what the OS sees ---------- */
  const CACHE_INFO = {
    core: (smt) => '<b>Core.</b> A complete processor with its own registers, control logic and execution units, able to run its own program.' + (smt ? ' With SMT it keeps two sets of registers (T0, T1), so the OS sees it as <b>two</b> logical processors.' : ' With 1 thread per core, the OS sees it as one logical processor.'),
    l1: () => '<b>L1 cache · one per core.</b> Tiny and fastest. On a recent laptop or desktop chip it is typically 32–64 KB for data plus about as much for instructions, and it answers in about 4–5 clock cycles (around 1 ns).',
    l2: () => '<b>L2 cache · one per core.</b> Bigger and a little slower: typically 256 KB to 2 MB, answering in about 12–16 cycles (a few ns). It catches most of what L1 misses.',
    l3: () => '<b>L3 cache · shared by all cores.</b> The big one: typically <span style="white-space:nowrap">8–64 MB</span>, answering in about 30–70 cycles (roughly <span style="white-space:nowrap">8–20 ns</span>). Because it is shared, one core can find data another core used recently.',
    mc: () => '<b>Memory controller.</b> Moved onto the processor chip during the 2000s. It talks to main memory (gigabytes of DRAM), which takes around 80–100 ns: hundreds of cycles. That gap is why chips carry three levels of cache.',
  };
  function chipBuilder(panel, ctx) {
    const { h, s } = ctx;
    let cores = 4, tpc = 2, picked = 'core';
    // phones use a narrower drawing (two cores per row) so the labels stay readable
    const NW = ctx.narrow, VW = NW ? 340 : 640;
    const svg = s('svg', { viewBox: `0 0 ${VW} 256`, width: '100%', role: 'img', 'aria-label': 'A multicore chip' });
    const info = h('div', { class: 'p12-cap', style: { fontSize: '14.5px' } });
    const big = h('div', { class: 'big', style: { fontSize: '36px', color: 'var(--thread)' } });
    const formula = h('div', { class: 'small b', style: { lineHeight: 1.3 } });
    const lps = h('div', { class: 'row', style: { gap: '3px' } });
    const legend = h('p', { class: 'xs muted m0' });   // explains the unit boxes, or why they are not drawn
    function draw() {
      const g = s('g', {});
      const cols = Math.min(cores, NW ? 2 : 4), rows = Math.ceil(cores / cols);
      const W = Math.min(280, (VW - 44 - (cols - 1) * 12) / cols), H = rows === 1 ? 148 : 70;
      const x0 = VW / 2 - (cols * W + (cols - 1) * 12) / 2;
      const L3Y = 18 + rows * (H + 8) + 2, MCY = L3Y + 38, VH = MCY + 42;  // L3 and memory controller sit under the cores
      svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
      g.append(sbox(s, 8, 6, VW - 16, VH - 12, 's-panel', null, { rx: 14, sw: 2.5 }));
      for (let k = 0; k < cores; k++) {
        const x = x0 + (k % cols) * (W + 12), y = 18 + Math.floor(k / cols) * (H + 8);
        const coreG = sbox(s, x, y, W, H, 's-cpu', null, { gcls: picked === 'core' ? 'sel' : null });
        coreG.append(s('text', { x: x + 10, y: y + 21, 'font-size': 14, 'font-weight': 800 }, 'Core ' + k));
        for (let t = 0; t < tpc; t++) {
          const bx = x + W - 8 - (tpc - t) * 33;
          coreG.append(s('rect', { x: bx, y: y + 6, width: 29, height: 19, rx: 5, class: 's-thread', 'stroke-width': 1.5 }), s('text', { x: bx + 14.5, y: y + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'T' + t));
        }
        if (rows === 1) {  // room to show the core's own execution units
          const names = ['Int', 'Int', 'FP', 'Ld/St'], wide = W >= 200;
          const ew = wide ? (W - 20 - 18) / 4 : (W - 26) / 2;
          names.forEach((nm, u) => {
            const ex = x + 10 + (wide ? u * (ew + 6) : (u % 2) * (ew + 6)), ey = y + 38 + (wide ? 0 : Math.floor(u / 2) * 28);
            coreG.append(sbox(s, ex, ey, ew, 24, 's-panel', nm, { fs: 13, rx: 5, sw: 1.2 }));
          });
          if (wide) coreG.append(s('text', { x: x + W / 2, y: y + 82, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'execution units'));
        }
        g.append(hotify(coreG, 'Core ' + k, () => pick('core')));
        const cy = y + H - (rows === 1 ? 42 : 32), ch = rows === 1 ? 34 : 26, l1w = Math.round((W - 26) * 0.38), l2w = W - 26 - l1w;
        g.append(hotify(sbox(s, x + 10, cy, l1w, ch, 's-mem', 'L1', { fs: 14, gcls: picked === 'l1' ? 'sel' : null }), 'L1 cache', () => pick('l1')));
        g.append(hotify(sbox(s, x + 16 + l1w, cy, l2w, ch, 's-mem', 'L2', { fs: 14, gcls: picked === 'l2' ? 'sel' : null }), 'L2 cache', () => pick('l2')));
      }
      const mcW = NW ? 144 : 240;
      g.append(hotify(sbox(s, 24, L3Y, VW - 48, 30, 's-mem', 'Shared L3 cache (all cores)', { fs: 14, gcls: picked === 'l3' ? 'sel' : null }), 'L3 cache', () => pick('l3')));
      g.append(hotify(sbox(s, 24, MCY, mcW, 28, 's-mem', 'Memory controller', { fs: 14, gcls: picked === 'mc' ? 'sel' : null }), 'Memory controller', () => pick('mc')));
      const aw = NW ? 24 : 42;  // arrow length
      g.append(s('line', { x1: mcW + 28, y1: MCY + 14, x2: mcW + 28 + aw, y2: MCY + 14, class: 's-line', 'marker-end': 'url(#arr)' }), s('text', { x: mcW + 34 + aw, y: MCY + 19, 'font-size': 13.5, class: 's-sub', 'font-weight': 700 }, NW ? 'to DRAM, off chip' : 'to main memory (DRAM, off the chip)'));
      svg.replaceChildren(g);
      const n = cores * tpc;
      big.textContent = n;
      formula.innerHTML = `logical processor${n > 1 ? 's' : ''}<br>= ${cores} core${cores > 1 ? 's' : ''} × ${tpc} per core`;
      lps.replaceChildren(...ctx.util.range(n).map((i) => h('span', { title: 'CPU ' + i, style: { width: '14px', height: '14px', borderRadius: '3px', background: 'var(--thread)', display: 'inline-block' } })));
      info.innerHTML = CACHE_INFO[picked](tpc === 2);
      legend.innerHTML = rows === 1
        ? '<b>Execution units</b> in each core: <b>Int</b> = integer (whole-number) math · <b>FP</b> = floating point (numbers with fractions) · <b>Ld/St</b> = load/store (moves data between memory and registers).'
        : 'With 8 cores there is no room to draw each core’s execution units (Int, FP, Ld/St). Pick 4 or fewer cores to see them.';
    }
    function pick(k) { picked = k; draw(); }
    const segC = ctx.ui.seg([1, 2, 4, 8].map((v) => ({ value: v, label: v + (v === 1 ? ' core' : ' cores') })), cores, (v) => { cores = v; draw(); });
    const segT = ctx.ui.seg([{ value: 1, label: '1 thread/core' }, { value: 2, label: '2 (SMT)' }], tpc, (v) => { tpc = v; draw(); });
    panel.append(h('div', { class: 'stack gap-s' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, segC, segT),
      h('div', { class: 'p12-svgwrap' }, svg),
      h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0,4fr) minmax(0,7fr)', gap: '10px', height: 'auto' } },
        h('div', { class: 'card tight stack gap-s' }, h('div', { class: 'xs muted b' }, 'THE OS SCHEDULER SEES'), h('div', { class: 'row gap-s nw' }, big, formula), lps),
        info),
      legend));
    draw();
  }

  /* ---------- step 3, tab 2: two hardware threads sharing one core's execution units ----------
     4 units × 8 cycles. Rows: 0 = integer ALU 1, 1 = integer ALU 2, 2 = floating point, 3 = load/store.
     Thread A alone uses 11 of 32 slots (34%); with SMT, B adds 10 more → 21 of 32 (66%). */
  const SMT_UNITS = ['Integer unit 1', 'Integer unit 2', 'Floating point', 'Load / store'];
  const SMT_SCHED = [
    { A: [0, 3], B: [1], wa: false, wb: false },
    { A: [0, 1, 2], B: [3], wa: false, wb: false },
    { A: [3], B: [0, 1], wa: false, wb: false },
    { A: [], B: [0, 2, 3], wa: true, wb: false },
    { A: [], B: [], wa: true, wb: true },
    { A: [0, 2], B: [], wa: false, wb: true },
    { A: [0, 1], B: [2], wa: false, wb: false },
    { A: [3], B: [0, 2], wa: false, wb: false },
  ];
  const SMT_CAP = {
    1: [
      '<b>One thread, one core.</b> This core has four execution units, and each cycle it can start one instruction on each. Press play to watch thread A use them.',
      '<b>Cycle 1.</b> A starts an integer add and a memory load: 2 of 4 units busy.',
      '<b>Cycle 2.</b> A finds three independent instructions: 3 of 4 busy. A good cycle.',
      '<b>Cycle 3.</b> A’s load <i>misses</i> the cache. Everything A wants next needs that data, so only the load/store unit works.',
      '<b>Cycle 4.</b> A is waiting for main memory. All four units sit idle.',
      '<b>Cycle 5.</b> Still waiting. (A real trip to main memory lasts hundreds of cycles, not two.)',
      '<b>Cycle 6.</b> The data arrives and A carries on: 2 of 4 busy.',
      '<b>Cycle 7.</b> 2 of 4 busy again.',
      '<b>Cycle 8, done.</b> A has one load to start: 1 of 4 busy. In all, A used only <b>11 of 32 slots (34%)</b>; most of the core did nothing. Switch to 2 logical processors to see what SMT does with the gaps.',
    ],
    2: [
      '<b>Two threads, one core.</b> The core now holds the registers of two threads, A and B, so the OS sees two logical processors. Both feed the same four units.',
      '<b>Cycle 1.</b> A uses two units; B slips an integer add into a free one: 3 of 4 busy.',
      '<b>Cycle 2.</b> A takes three units and B gets the last. B wanted more but had to wait: the two threads compete for the same hardware.',
      '<b>Cycle 3.</b> A’s load misses the cache, but B uses both integer units: 3 of 4 busy.',
      '<b>Cycle 4.</b> A is stalled, yet B keeps 3 of 4 units busy. This is the point of SMT: filling slots a stalled thread leaves empty.',
      '<b>Cycle 5.</b> B’s load missed too. Both threads are waiting, so nothing starts. SMT cannot help when every thread is stuck.',
      '<b>Cycle 6.</b> A’s data arrives; B is still waiting: 2 of 4 busy.',
      '<b>Cycle 7.</b> Both run again: 3 of 4 busy.',
      '<b>Cycle 8, done.</b> A’s load plus two of B’s instructions: 3 of 4 busy. Together A and B used <b>21 of 32 slots (66%)</b> instead of 11. Real programs usually gain less, often around 10–30%, because the threads also compete for the caches.',
    ],
  };
  function smtLab(panel, ctx) {
    const { h, s } = ctx;
    let mode = 1;
    // phones: shorter labels and narrower columns so the grid keeps a readable text size
    const NW = ctx.narrow;
    const LX = NW ? 74 : 150, CW = NW ? 33 : 58, RH = NW ? 34 : 38, TOP = NW ? 58 : 62;
    const UNITS = NW ? ['Integer 1', 'Integer 2', 'Float', 'Load/store'] : SMT_UNITS;
    const svg = s('svg', { viewBox: NW ? `0 0 ${LX + 8 * CW + 2} ${TOP + 4 * (RH + 5) + 4}` : '0 0 640 234', width: '100%', role: 'img', 'aria-label': 'Execution-unit slots, cycle by cycle' });
    const meter = h('div', { class: 'meter', style: { flex: '1' } }, h('i'));
    const used = h('span', { class: 'small b', style: { minWidth: '150px', textAlign: 'right' } });
    function draw(n) {
      const g = s('g', {});
      if (NW) g.append(s('text', { x: LX - 8, y: 16, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub', 'font-weight': 700 }, 'cycle'));
      for (let c = 0; c < 8; c++) g.append(s('text', { x: LX + c * CW + CW / 2, y: 16, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, (NW ? '' : 'cycle ') + (c + 1)));
      const threads = mode === 2 ? ['A', 'B'] : ['A'];
      threads.forEach((t, ti) => {
        const y = 24 + ti * 17;
        g.append(s('text', { x: LX - 8, y: y + 11, 'text-anchor': 'end', 'font-size': NW ? 12 : 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'thread ' + t));
        for (let c = 0; c < n; c++) {
          const wait = t === 'A' ? SMT_SCHED[c].wa : SMT_SCHED[c].wb;
          g.append(s('rect', { x: LX + c * CW + 3, y, width: CW - 6, height: 13, rx: 4, style: wait ? 'fill:var(--intr-bg);stroke:var(--intr)' : 'fill:var(--thread-bg);stroke:var(--thread)', 'stroke-width': 1.2, 'stroke-dasharray': wait ? '3 2' : null }));
          if (wait) g.append(s('text', { x: LX + c * CW + CW / 2, y: y + 11, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, style: 'fill:var(--intr)' }, 'wait'));
        }
      });
      UNITS.forEach((u, r) => {
        const y = TOP + r * (RH + 5);
        g.append(s('text', { x: LX - 8, y: y + RH / 2 + 5, 'text-anchor': 'end', 'font-size': NW ? 12.5 : 13.5, 'font-weight': 700 }, u));
        for (let c = 0; c < 8; c++) {
          const x = LX + c * CW + 3, cell = SMT_SCHED[c];
          const who = c < n ? (cell.A.includes(r) ? 'A' : mode === 2 && cell.B.includes(r) ? 'B' : null) : null;
          g.append(s('rect', { x, y, width: CW - 6, height: RH, rx: 6, class: who ? 's-thread' : 's-panel', 'stroke-width': who ? 2 : 1.2, 'stroke-dasharray': who ? null : '3 3', style: who === 'A' ? 'fill:var(--thread)' : null }));
          if (who) g.append(s('text', { x: x + (CW - 6) / 2, y: y + RH / 2 + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 900, style: who === 'A' ? 'fill:var(--panel)' : 'fill:var(--thread)' }, who));
        }
      });
      if (n > 0) g.append(s('rect', { x: LX + (n - 1) * CW, y: TOP - 4, width: CW, height: 4 * (RH + 5) + 3, rx: 8, style: 'fill:none;stroke:var(--chc)', 'stroke-width': 2.5 }));
      svg.replaceChildren(g);
      let k = 0;
      for (let c = 0; c < n; c++) k += SMT_SCHED[c].A.length + (mode === 2 ? SMT_SCHED[c].B.length : 0);
      meter.firstChild.style.width = n ? (k / (n * 4)) * 100 + '%' : '0%';
      used.textContent = n ? `${k} of ${n * 4} slots used (${Math.round((k / (n * 4)) * 100)}%)` : 'no cycles yet';
    }
    const player = ctx.ui.player({ count: 9, interval: 1500, render: (i) => { draw(i); return SMT_CAP[mode][i]; } });
    const seg = ctx.ui.seg([{ value: 1, label: '1 logical processor' }, { value: 2, label: '2 logical processors (SMT)' }], mode, (v) => { mode = v; player.reset(); });
    panel.append(h('div', { class: 'stack gap-s' }, seg, h('div', { class: 'p12-svgwrap' }, svg), h('div', { class: 'row nw' }, h('span', { class: 'xs muted b' }, 'UNITS BUSY'), meter, used), player.el));
  }

  /* ---------- step 7: send each job to the unit that does it best ---------- */
  const BINS = [
    { k: 'cpu', name: 'CPU core', chip: 'cpu', no: 'A CPU core <i>could</i> run this, but another unit does it faster or with far less energy.' },
    { k: 'gpu', name: 'GPU', chip: 'accent', no: 'A GPU only shines when the same calculation runs over huge arrays of independent data.' },
    { k: 'dsp', name: 'DSP', chip: 'proc', no: 'A DSP is built for steady streams of samples, such as sound or radio signals.' },
    { k: 'acc', name: 'Accelerator', chip: 'warn', no: 'An accelerator does one fixed job, such as encryption or video decoding, and cannot run other code.' },
  ];
  const JOBS = [
    { t: 'Compile a program’s source code', best: 'cpu', ok: {}, why: 'Compiling is branchy, irregular logic in which each decision depends on the one before. That is exactly what a general-purpose core is for; SIMD lanes would sit idle.', hint: 'Lots of if-statements and lookups, all different.' },
    { t: 'Render a 3D game scene, 60 frames a second', best: 'gpu', ok: {}, why: 'Millions of pixels each get the same shading math, every frame: pure SIMD work, which is what GPUs were invented for.', hint: 'The same small calculation for every pixel.' },
    { t: 'Train one layer of a neural network', best: 'gpu', ok: { acc: 'Also reasonable: dedicated AI accelerators exist and are superb at running trained models. For large-scale training, GPUs are the usual workhorse.' }, why: 'Training is mostly huge grids of multiply-adds, the same operation on millions of numbers, so the GPU’s thousands of lanes are ideal.', hint: 'Enormous grids of numbers, all multiplied the same way.' },
    { t: 'Decode the audio of a phone call', best: 'dsp', ok: {}, why: 'A steady stream of compressed speech arrives every 20 ms and must be turned back into sound on time: classic DSP work.', hint: 'A never-ending stream of sound samples with a deadline.' },
    { t: 'Encrypt a message before it is sent', best: 'acc', ok: { cpu: 'Works: a CPU core can encrypt in software, and many have special instructions to help. A crypto engine does it with less energy and can keep the keys out of reach.' }, why: 'Encryption is one fixed, very common job, perfect for a dedicated crypto engine that is fast, frugal and can guard the keys.', hint: 'One specific, fixed job that happens constantly.' },
    { t: 'Decode the video of a 4K movie stream', best: 'acc', ok: { gpu: 'Close: on many chips the video decoder sits right next to the GPU, but it is a separate fixed-function circuit, not the GPU’s programmable lanes.' }, why: 'Video decoding follows a fixed standard, so phones include a video codec accelerator that decodes a movie using a trickle of power.', hint: 'A fixed, standard job that runs for hours on battery.' },
    { t: 'Filter noise out of live microphone audio', best: 'dsp', ok: {}, why: 'The same filter math runs on every incoming audio sample, in real time: exactly the streaming work DSPs are designed for.', hint: 'Filtering a live stream of samples.' },
    { t: 'Simulate the physics of a million particles', best: 'gpu', ok: {}, why: 'Every particle gets the same force and motion update each time step: the same math on a huge array, so SIMD lanes excel.', hint: 'One update rule applied to a huge array.' },
    { t: 'Decide which program runs next (OS scheduler)', best: 'cpu', ok: {}, why: 'The operating system itself is ordinary branchy code, so it runs on the CPU cores. It decides what runs on all the other units too.', hint: 'The operating system’s own code.' },
  ];
  function matcher(root, ctx, fb) {
    const { h } = ctx;
    const placed = {};       // job index → bin key
    const missed = new Set(); // jobs that had at least one wrong try
    let sel = null;
    const pool = h('div', { class: 'grid-3', style: { gap: '8px' } });
    const bins = h('div', { class: 'grid-4', style: { gap: '10px' } });
    const score = h('span', { class: 'small b' });
    const meter = h('div', { class: 'meter', style: { flex: '1' } }, h('i'));
    function say(cls, head, body) { fb.replaceChildren(h('div', { class: 'b', style: { fontSize: '18px', color: `var(--${cls})` } }, head), h('p', { class: 'm0 small', html: body })); }
    function place(j, k) {
      const job = JOBS[j];
      if (placed[j] != null) return;
      sel = null;
      if (k === job.best) { placed[j] = k; say('ok', '✓ Best fit', '<b>' + job.t + ' → ' + BINS.find((b) => b.k === k).name + '.</b> ' + job.why); }
      else if (job.ok[k]) { placed[j] = k; missed.add(j); say('warn', '~ Works, but not the best', job.ok[k] + ' <b>Best fit: ' + BINS.find((b) => b.k === job.best).name + '.</b>'); }
      else { missed.add(j); say('bad', '✗ Not the best unit', BINS.find((b) => b.k === k).no + ' <b>Hint:</b> ' + job.hint + ' Try another unit.'); }
      paint();
      if (placed[j] == null) { const c = pool.querySelector(`[data-j="${j}"]`); if (c) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } }
    }
    function paint() {
      // placed jobs leave an empty slot so the layout does not jump (phones skip the slots to save scrolling)
      pool.replaceChildren(...JOBS.map((job, j) => [job, j]).filter(([, j]) => !(ctx.narrow && placed[j] != null)).map(([job, j]) => placed[j] != null ? h('div', { class: 'p12-slot' }) : h('button', {
        type: 'button', class: 'p12-task' + (sel === j ? ' on' : ''), draggable: 'true', 'data-j': j,
        onclick: () => { sel = sel === j ? null : j; paint(); if (sel !== null) say('chc', 'Where should it run?', '<b>' + job.t + '.</b> Now click the unit that should do this job.'); },
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', String(j)); },
      }, job.t)));
      bins.replaceChildren(...BINS.map((b) => {
        const here = JOBS.map((job, j) => [job, j]).filter(([, j]) => placed[j] === b.k);
        return h('div', {
          class: 'p12-bin ' + b.chip + (sel !== null ? ' target' : ''), role: 'button', tabindex: 0, 'aria-label': 'Send to ' + b.name,
          onclick: () => { if (sel !== null) place(sel, b.k); else say('muted', 'Pick a job first', 'Click one of the job cards above, then click a unit.'); },
          onkeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && sel !== null) { e.preventDefault(); place(sel, b.k); } },
          ondragover: (e) => e.preventDefault(),
          ondrop: (e) => { e.preventDefault(); const j = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!Number.isNaN(j)) place(j, b.k); },
        }, h('span', { class: 'chip ' + b.chip, style: { alignSelf: 'flex-start' } }, b.name),
          ...here.map(([job, j]) => job.best === b.k ? h('div', { class: 'p12-placed best' }, '✓ ' + job.t)
            : h('div', { class: 'p12-placed ok', role: 'button', tabindex: 0, title: 'Click to move it back and try again',
              onclick: (e) => { e.stopPropagation(); delete placed[j]; sel = j; paint(); say('chc', 'Try again', '<b>' + job.t + '</b> is back in your hand. Click the unit that suits it best.'); } }, '~ ' + job.t + ' (click to retry)')));
      }));
      const n = Object.keys(placed).length, best = JOBS.filter((job, j) => placed[j] === job.best).length, first = JOBS.filter((job, j) => placed[j] === job.best && !missed.has(j)).length;
      meter.firstChild.style.width = (n / JOBS.length) * 100 + '%';
      score.textContent = `${n}/${JOBS.length} placed · ${best} best fit · ${first} right first try`;
      if (n === JOBS.length) say('ok', 'All nine jobs placed!', `You found the best unit for ${best} of 9 jobs, ${first} on the first try. Notice the pattern: branchy logic → CPU, the same math over huge arrays → GPU, steady streams → DSP, one fixed common job → accelerator.`);
    }
    function reset() { Object.keys(placed).forEach((k) => delete placed[k]); missed.clear(); sel = null; paint(); say('chc', 'Your move', 'Click a job card, then click the unit that should run it. You can also drag a card onto a unit.'); }
    function solve() { JOBS.forEach((job, j) => { placed[j] = job.best; missed.add(j); }); sel = null; paint(); say('chc', 'Answers shown', 'Each job now sits on its best unit. Press Start over to try it yourself.'); }
    root.append(h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'xs muted b' }, 'JOBS WAITING FOR A UNIT'), pool, h('div', { class: 'xs muted b' }, 'UNITS ON THE CHIP · CLICK ONE TO SEND THE SELECTED JOB'), bins));
    reset();
    const hint = () => say('warn', 'Rule of thumb', 'Branchy, varied logic → <b>CPU core</b>. The same math over huge arrays → <b>GPU</b>. A steady stream of samples with deadlines → <b>DSP</b>. One fixed, very common job → <b>accelerator</b>.');
    return { reset, solve, hint, scoreEl: h('div', { class: 'row nw' }, meter, score) };
  }

  Guide.section({
    id: '1.2',
    title: 'Evolution of the Microprocessor',
    short: 'Microprocessor evolution',
    summary: 'How one-chip processors grew into multicore chips and phone SoCs with GPUs, DSPs and accelerators.',
    objectives: [
      'Explain what a microprocessor is and why putting a whole processor on one chip changed computing.',
      'Describe how chips evolved: more transistors, faster clocks until the power wall, then more cores, logical processors and deeper caches.',
      'Explain how SIMD lets a GPU or a CPU vector unit process many numbers with one instruction, and work out the speedup.',
      'Describe what DSPs and hardware accelerators do and why a system on a chip combines them with CPU cores, caches, radios and memory.',
      'Match a workload to the kind of processing unit that handles it best.',
    ],
    terms: [
      ['Microprocessor', 'A complete processor built on a single chip of silicon. The first commercial one appeared in 1971; today microprocessors run everything from phones to servers.'],
      ['Transistor', 'A microscopic switch controlled by electricity. Chips are built from transistors, so more transistors means room for more circuitry, such as extra cores or bigger caches.'],
      ["Moore's law", 'The long-running observation that the number of transistors that fit on a chip roughly doubles about every two years.'],
      ['Clock speed (clock rate)', 'How many clock cycles a processor completes per second, measured in hertz. 3 GHz means 3 billion cycles per second; the processor does its work in steps timed by these ticks.'],
      ['Power wall', 'The limit reached in the mid-2000s when raising the clock speed further made chips use too much power and run too hot to cool, so designers began adding cores instead.'],
      ['Logical processor (hardware thread)', 'A processor as the operating system sees it. With simultaneous multithreading, one physical core presents two (or more) logical processors that share its execution units.'],
      ['Simultaneous multithreading (SMT)', 'A core design that holds the registers and program counter of two or more threads at once and issues their instructions in the same cycles, filling units one thread would leave idle. Intel calls it Hyper-Threading.'],
      ['Execution unit', 'A part of a core that performs one kind of operation, such as integer arithmetic, floating-point math, or loading and storing memory. Each core has several.'],
      ['Cache levels (L1, L2, L3)', 'The layers of cache on a typical modern chip: a tiny, fastest L1 inside each core, a larger L2 per core, and a big L3 shared by all cores. Each level is bigger and slower than the one above it.'],
      ['Graphics processing unit (GPU)', 'A processor with a very large number of simple lanes that apply the same operation to big arrays of data. Built to draw graphics; now also used for science and machine learning.'],
      ['Single instruction, multiple data (SIMD)', 'A style of computing in which one instruction performs the same operation on many data items at once, each item in its own lane.'],
      ['Lane', 'One slot of a SIMD unit, handling one data item. An 8-lane unit can add 8 pairs of numbers with a single instruction.'],
      ['Vector unit', 'Hardware inside a CPU core that performs SIMD operations on short vectors, for example 4, 8 or 16 numbers at a time.'],
      ['Digital signal processor (DSP)', 'A processor built for streams of samples, such as audio, radio or video signals. It repeats the same arithmetic on every sample fast enough to keep up with the stream.'],
      ['Coprocessor', 'A processor that works alongside the main CPU cores and takes over one kind of work, such as graphics, signal processing or encryption.'],
      ['Hardware accelerator', 'A circuit designed to do one specific job, such as encryption, compression or video decoding, much faster and with far less energy than software on a CPU core.'],
      ['System on a chip (SoC)', 'A single chip that combines CPU cores, caches, a GPU, DSPs, accelerators and I/O such as radios, usually with main memory in the same package. The heart of every smartphone.'],
      ['Codec', 'Short for coder-decoder: hardware or software that compresses (encodes) and decompresses (decodes) audio or video.'],
      ['x86', 'The instruction set family that began with the Intel 8086 in 1978. Most desktop PCs, laptops and servers use x86 chips, made by Intel and AMD.'],
      ['ARM', 'A family of energy-efficient processor designs that many companies license and build into their own chips. Nearly every smartphone uses ARM cores.'],
    ],

    css: `
      /* shell workaround: on phones the stage shrink-wraps the canvas to its min-content width, and this
         section's long nowrap eyebrow would make it wider than the screen; containment removes that pull */
      .sec-1-2 .step-eyebrow { contain: inline-size; }
      .sec-1-2 .p12-svgwrap { display: grid; place-items: center; min-height: 0; }
      .sec-1-2 .p12-hot { cursor: pointer; outline: none; }
      .sec-1-2 .p12-hot:hover > .fr, .sec-1-2 .p12-hot:focus-visible > .fr { stroke-width: 3.5; }
      .sec-1-2 .p12-hot.sel > .fr { stroke-width: 4; }
      .sec-1-2 .p12-dim { opacity: .3; transition: opacity .25s; }
      .sec-1-2 .p12-cap { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 15.5px; line-height: 1.45; }
      .sec-1-2 .p12-cap b { color: var(--chc); }
      .sec-1-2 .p12-kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 12px; font-size: 15px; }
      .sec-1-2 .p12-kv > :nth-child(odd) { color: var(--muted); font-weight: 650; }
      .sec-1-2 .p12-kv > :nth-child(even) { font-weight: 700; }
      .sec-1-2 .p12-task { text-align: left; border: 2px solid var(--line-2); background: var(--panel); border-radius: 10px; padding: 6px 10px; font-size: 14.5px; line-height: 1.3; font-weight: 650; cursor: grab; color: var(--ink); height: 56px; overflow: hidden; }
      .sec-1-2 .p12-task:hover { border-color: var(--chc); }
      .sec-1-2 .p12-task.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 12%, var(--panel)); box-shadow: 0 0 0 2px var(--chc); }
      .sec-1-2 .p12-slot { border: 2px dashed var(--line); border-radius: 10px; height: 56px; }
      .sec-1-2 .p12-bin { border: 2px solid var(--line-2); border-radius: 12px; padding: 8px; background: var(--panel-2); display: flex; flex-direction: column; gap: 6px; cursor: pointer; min-height: 236px; transition: box-shadow .15s; }
      .sec-1-2 .p12-bin.cpu { border-color: var(--cpu); } .sec-1-2 .p12-bin.accent { border-color: var(--accent); }
      .sec-1-2 .p12-bin.proc { border-color: var(--proc); } .sec-1-2 .p12-bin.warn { border-color: var(--warn); }
      .sec-1-2 .p12-bin.target { box-shadow: 0 0 0 4px var(--hl); }
      .sec-1-2 .p12-bin:hover { background: var(--panel); }
      .sec-1-2 .p12-placed { font-size: 13.5px; line-height: 1.3; padding: 5px 8px; border-radius: 8px; background: var(--panel); border: 1px solid var(--line); font-weight: 600; }
      .sec-1-2 .p12-placed.best { border-color: var(--ok); background: var(--ok-bg); }
      .sec-1-2 .p12-placed.ok { border-color: var(--warn); background: var(--warn-bg); cursor: pointer; }
    `,

    steps: [
      /* ---------------- 1. Big picture: three eras of the processor ---------------- */
      {
        title: 'From a cabinet of parts to one chip, then a whole system',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const NW = ctx.narrow;  // phones: side panels move underneath (each era sets its own viewBox) so labels stay readable
          const svg = s('svg', { viewBox: '0 0 640 300', width: '100%', role: 'img', 'aria-label': 'How the processor moved onto one chip' });
          const cap = h('div', { class: 'p12-cap' });
          const chipPins = (x, y, w, hh, n) => {
            const g = s('g', {});
            for (let i = 0; i < n; i++) {
              const px = x + ((i + 0.5) * w) / n, py = y + ((i + 0.5) * hh) / n;
              g.append(s('line', { x1: px, y1: y - 9, x2: px, y2: y, class: 's-line', 'stroke-width': 3 }), s('line', { x1: px, y1: y + hh, x2: px, y2: y + hh + 9, class: 's-line', 'stroke-width': 3 }),
                s('line', { x1: x - 9, y1: py, x2: x, y2: py, class: 's-line', 'stroke-width': 3 }), s('line', { x1: x + w, y1: py, x2: x + w + 9, y2: py, class: 's-line', 'stroke-width': 3 }));
            }
            return g;
          };
          const ERAS = [
            {
              label: 'Before 1971',
              cap: '<b>Before 1971.</b> A processor was built from many separate chips (earlier still, from individual transistors or even vacuum tubes) spread over several circuit boards, often filling a cabinet. Signals travelled long distances between parts, which limited speed and wasted power.',
              draw() {
                const g = s('g', {});
                g.append(sbox(s, 10, 14, 372, 278, 's-panel', null, { rx: 14 }), s('text', { x: 196, y: 38, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'The processor: many chips on several boards'));
                ['Arithmetic board', 'Registers board', 'Control board'].forEach((nm, i) => {
                  const y = 54 + i * 78;
                  g.append(sbox(s, 26, y, 340, 64, 's-cpu', null));
                  g.append(s('text', { x: 38, y: y + 37, 'font-size': 14, 'font-weight': 700 }, nm));
                  for (let k = 0; k < 9; k++) g.append(s('rect', { x: 170 + k * 21, y: y + 14, width: 15, height: 36, rx: 2, class: 's-panel', 'stroke-width': 1.5 }));
                });
                if (NW) {  // memory and I/O sit below the processor boards
                  g.append(s('line', { x1: 100, y1: 292, x2: 100, y2: 306, class: 's-line' }), s('line', { x1: 292, y1: 292, x2: 292, y2: 306, class: 's-line' }));
                  g.append(sbox(s, 10, 306, 180, 90, 's-mem', 'Memory\n(its own boards)', { fs: 15 }), sbox(s, 202, 306, 180, 90, 's-io', 'Terminals, tape,\nprinters (separate\ncabinets)', { fs: 15 }));
                  return g;
                }
                g.append(sbox(s, 420, 14, 210, 120, 's-mem', 'Memory\n(its own boards)', { fs: 15 }), sbox(s, 420, 172, 210, 120, 's-io', 'Terminals, tape,\nprinters (separate\ncabinets)', { fs: 15 }));
                g.append(s('line', { x1: 382, y1: 74, x2: 420, y2: 74, class: 's-line' }), s('line', { x1: 382, y1: 232, x2: 420, y2: 232, class: 's-line' }));
                return g;
              },
            },
            {
              label: '1971 on: one-chip CPU',
              cap: '<b>1971 onward.</b> The whole processor (arithmetic, registers and control) fits on one chip: the <span class="t">microprocessor</span>. The first one had about 2,300 transistors. Memory, graphics, sound and networking are still separate chips or plug-in cards, joined by a bus.',
              draw() {
                const g = s('g', {});
                if (NW) {  // a narrower board: chip and memory on top, the bus across the middle, cards below
                  g.append(sbox(s, 6, 8, 380, 318, 's-panel', null, { rx: 14 }), s('text', { x: 22, y: 30, 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'Circuit board (motherboard)'));
                  g.append(chipPins(30, 62, 110, 110, 5), sbox(s, 30, 62, 110, 110, 's-cpu', 'Micro-\nprocessor\n(whole CPU)', { fs: 14, sw: 2.5 }));
                  g.append(s('line', { x1: 85, y1: 181, x2: 85, y2: 206, class: 's-line' }), s('line', { x1: 20, y1: 206, x2: 372, y2: 206, class: 's-line', 'stroke-width': 4 }), s('text', { x: 372, y: 226, 'text-anchor': 'end', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'bus'));
                  for (let k = 0; k < 4; k++) g.append(s('line', { x1: 194 + k * 48, y1: 132, x2: 194 + k * 48, y2: 206, class: 's-line' }), sbox(s, 176 + k * 48, 62, 36, 70, 's-mem', null, { rx: 4 }));
                  g.append(s('text', { x: 266, y: 54, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Memory chips'));
                  [['Graphics\ncard', 's-accent', 16], ['Sound\ncard', 's-proc', 140], ['Modem\ncard', 's-io', 264]].forEach(([nm, c, x]) => g.append(s('line', { x1: x + 55, y1: 206, x2: x + 55, y2: 236, class: 's-line' }), sbox(s, x, 236, 110, 76, c, nm, { fs: 14 })));
                  return g;
                }
                g.append(sbox(s, 6, 8, 628, 288, 's-panel', null, { rx: 14 }), s('text', { x: 22, y: 30, 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'Circuit board (motherboard)'));
                g.append(chipPins(46, 66, 140, 140, 6), sbox(s, 46, 66, 140, 140, 's-cpu', 'Micro-\nprocessor\n(whole CPU)', { fs: 15, sw: 2.5 }));
                g.append(s('line', { x1: 195, y1: 150, x2: 612, y2: 150, class: 's-line', 'stroke-width': 4 }), s('text', { x: 604, y: 142, 'text-anchor': 'end', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'bus'));
                for (let k = 0; k < 4; k++) { g.append(s('line', { x1: 262 + k * 52, y1: 116, x2: 262 + k * 52, y2: 150, class: 's-line' }), sbox(s, 242 + k * 52, 46, 40, 70, 's-mem', null, { rx: 4 })); }
                g.append(s('text', { x: 336, y: 38, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Memory chips'));
                [['Graphics\ncard', 's-accent', 232], ['Sound\ncard', 's-proc', 362], ['Modem\ncard', 's-io', 492]].forEach(([nm, c, x]) => g.append(s('line', { x1: x + 55, y1: 150, x2: x + 55, y2: 196, class: 's-line' }), sbox(s, x, 196, 110, 76, c, nm, { fs: 14 })));
                return g;
              },
            },
            {
              label: 'Today: system on a chip',
              cap: '<b>Today.</b> A phone’s main chip holds several cores, a shared cache, a GPU, a DSP, accelerators and the modem: a <span class="t">system on a chip (SoC)</span>, some 20 billion transistors in a flagship phone. Main memory is a separate piece of silicon (a die) stacked in the same package, the chip’s protective case. Former boards are now neighbours millimetres apart.',
              draw() {
                const g = s('g', {});
                g.append(sbox(s, 10, 12, 450, 280, 's-panel', null, { rx: 16, sw: 3 }), s('text', { x: 235, y: 38, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'One chip: a system on a chip (SoC)'));
                [[30, 55], [95, 55], [30, 110], [95, 110]].forEach(([x, y]) => g.append(sbox(s, x, y, 58, 46, 's-cpu', 'Core', { fs: 13 })));
                g.append(sbox(s, 170, 55, 130, 101, 's-accent', 'GPU', { fs: 16 }), sbox(s, 315, 55, 125, 46, 's-warn', 'AI engine', { fs: 13 }), sbox(s, 315, 110, 125, 46, 's-warn', 'Video codec', { fs: 13 }));
                g.append(sbox(s, 30, 168, 123, 44, 's-mem', 'Shared cache', { fs: 13 }), sbox(s, 170, 168, 130, 44, 's-proc', 'DSP', { fs: 14 }), sbox(s, 315, 168, 125, 44, 's-warn', 'Security engine', { fs: 13 }));
                g.append(sbox(s, 30, 224, 190, 54, 's-io', 'Modem + radio', { fs: 14 }), sbox(s, 235, 224, 205, 54, 's-mem', 'Memory controller', { fs: 14 }));
                if (NW) {  // the stacked memory die is drawn underneath instead of beside
                  g.append(s('line', { x1: 337, y1: 278, x2: 337, y2: 312, class: 's-line', 'stroke-width': 3 }));
                  g.append(sbox(s, 10, 312, 450, 76, 's-mem', 'Main memory (DRAM)\nstacked in the same package', { fs: 15, dash: '6 4' }));
                  return g;
                }
                g.append(s('line', { x1: 440, y1: 251, x2: 490, y2: 251, class: 's-line', 'stroke-width': 3 }));
                g.append(sbox(s, 490, 96, 140, 184, 's-mem', 'Main memory\n(DRAM)\nstacked in\nthe same\npackage', { fs: 14, dash: '6 4' }));
                return g;
              },
            },
          ];
          let cur = -1;
          function show(i) {
            cur = i;
            const g = ERAS[i].draw();
            svg.setAttribute('viewBox', NW ? ['0 0 392 400', '0 0 392 332', '0 0 470 396'][i] : '0 0 640 300');
            g.setAttribute('class', 'fade-in');
            svg.replaceChildren(g);
            cap.innerHTML = ERAS[i].cap;
            seg.set(i);
          }
          const seg = ctx.ui.seg(ERAS.map((e, i) => ({ value: i, label: e.label })), 0, (v) => show(v));
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Before 1971 a processor filled a cabinet. Now it fits on a fingernail-sized chip.' }),
              h('p', { class: 'm0', html: 'A <span class="t">microprocessor</span> is a whole processor on a single chip. That made processors small, cheap and fast enough for desktops and then handheld devices, and they became the fastest general-purpose processors ever built. Each generation since has pulled more onto the chip: several <span class="t" data-t="core">cores</span>, big caches, graphics and signal processors, even radios.' }),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A company starts as workshops scattered around town. First the main workshop moves into one building; later the storeroom, the studio and the mail room move in too. Nothing crosses town, so work is faster and cheaper.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why an OS cares', html: 'The operating system must share every engine on the chip: which program runs on which core, and who gets the graphics processor (GPU) or the video codec next.' })),
            h('div', { class: 'card white stack' },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Three eras · click each'), seg),
              h('div', { class: 'p12-svgwrap grow' }, svg),
              cap)));
          show(0);
        },
      },

      /* ---------------- 2. Timeline: transistors, clock speed, cores ---------------- */
      {
        title: 'Fifty years of chips: transistors, clocks, cores, caches',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const fmtN = (n) => (n >= 1e9 ? ctx.util.fmt(n / 1e9, 1) + ' billion' : n >= 1e6 ? ctx.util.fmt(n / 1e6, 1) + ' million' : Math.round(n).toLocaleString('en-US'));
          const fmtHz = (m) => (m >= 1000 ? ctx.util.fmt(m / 1000, 2) + ' GHz' : m >= 1 ? ctx.util.fmt(m, 0) + ' MHz' : ctx.util.fmt(m * 1000, 0) + ' kHz');
          // phones get a narrower viewBox so the axis labels stay readable when the chart shrinks
          const NW = ctx.narrow, VW = NW ? 400 : 640;
          const X0 = NW ? 92 : 100, X1 = VW - 14, Y0 = 50, Y1 = 346;
          const xOf = (yr) => X0 + ((yr - 1970) / 55) * (X1 - X0);
          const METRICS = {
            tr: { lo: 3, hi: 11.4, val: (c) => Math.log10(c.tr), ticks: [[3, '1 thousand'], [5, '100 thousand'], [7, '10 million'], [9, '1 billion'], [11, '100 billion']], minor: [4, 6, 8, 10],
              cap: 'Log scale: each gridline is 10× the one below. The count rose from thousands to tens of billions, roughly doubling every two years (<span class="t">Moore’s law</span>).' },
            hz: { lo: -1, hi: 4.25, val: (c) => Math.log10(c.mhz), ticks: [[-1, '0.1 MHz'], [0, '1 MHz'], [1, '10 MHz'], [2, '100 MHz'], [3, '1 GHz'], [4, '10 GHz']], minor: [],
              cap: 'The <span class="t">clock speed</span> climbed about 5,000-fold from 1971 to 2004, then flattened out near 3–4 GHz: the <span class="t">power wall</span>.' },
            co: { lo: -0.35, hi: 4.5, val: (c) => Math.log2(c.cores), lp: (c) => Math.log2(c.lp), ticks: [[0, '1'], [1, '2'], [2, '4'], [3, '8'], [4, '16']], minor: [],
              cap: 'For about 35 years a chip had one core. Since the mid-2000s the count keeps doubling. Rings mark <span class="t" data-t="logical processor">logical processors</span> when a core runs two threads (two instruction streams) at once.' },
            ca: { lo: -0.45, hi: 3.5, val: (c) => c.ca, ticks: [[0, 'none'], [1, 'L1'], [2, 'L1 + L2'], [3, 'L1 + L2 + L3']], minor: [],
              cap: 'Each step up is one more level of cache on the chip. Processors sped up far faster than main memory did, so designers spent transistors on deeper <span class="t" data-t="cache levels">cache levels</span> to keep the cores fed.' },
          };
          // a worked check of the numbers, one per metric
          const NOTES = {
            tr: ['Check the doubling rule', 'Start at 2,300 in 1971 and double 25 times (50 years): 2,300 × 2<sup>25</sup> ≈ 77 billion by 2021. Real chips: 16 billion in 2020, 92 billion in 2023. Close!'],
            hz: ['Check the numbers', '0.74 MHz (1971) → 3,800 MHz (2004) is about 5,000× faster. From 2004 to 2023 the top clock only crept from 3.8 to about 4 GHz, roughly 7% more.'],
            co: ['Count the cores', 'One core from 1971 until the mid-2000s. Then 2 (2006), 4 (2008), 8 (2020) and 16 (2023): the transistors that once bought clock speed now buy cores.'],
            ca: ['Count the levels', 'Early chips had no cache at all; the first on-chip caches came around 1989. One level by 1993, two by 2000, and a shared third level by 2008.'],
          };
          const CHIPS = [
            // ca = cache levels on the processor chip; cache = what they are (sizes rounded)
            { y: 1971, name: 'Intel 4004', fam: 'early Intel', tr: 2.3e3, mhz: 0.74, cores: 1, lp: 1, ca: 0, cache: 'none', note: 'The first commercial microprocessor: a 4-bit chip designed for a desktop calculator.' },
            { y: 1978, name: 'Intel 8086', fam: 'x86', tr: 2.9e4, mhz: 10, cores: 1, lp: 1, ca: 0, cache: 'none', note: 'A 16-bit chip that started the <span class="t">x86</span> family, still used by most PCs and servers today.' },
            { y: 1985, name: 'ARM1', fam: 'ARM', tr: 2.5e4, mhz: 6, cores: 1, lp: 1, ca: 0, cache: 'none', note: 'The first <span class="t">ARM</span> processor: a deliberately simple, low-power design. Its descendants run nearly every phone.' },
            { y: 1985, name: 'Intel 386', fam: 'x86', tr: 2.75e5, mhz: 33, cores: 1, lp: 1, ca: 0, cache: 'none on the chip', note: 'The first 32-bit x86 chip, with the memory-management hardware (paging) that multitasking operating systems rely on.' },
            { y: 1993, name: 'Intel Pentium', fam: 'x86', tr: 3.1e6, mhz: 66, cores: 1, lp: 1, ca: 1, cache: 'L1: 8 KB code + 8 KB data', note: 'Could start two instructions in the same clock tick: extra transistors bought more work per cycle.' },
            { y: 2000, name: 'Pentium 4', fam: 'x86', tr: 4.2e7, mhz: 2000, cores: 1, lp: 1, ca: 2, cache: 'L1 + 256 KB L2', note: 'Built for very high clock speeds: it launched at 1.5 GHz in 2000 and passed 2 GHz within a year. The race for gigahertz was on.' },
            { y: 2004, name: 'Pentium 4 (late model)', fam: 'x86', tr: 1.25e8, mhz: 3800, cores: 1, lp: 2, ca: 2, cache: 'L1 + 1 MB L2', note: 'Reached 3.8 GHz but drew over 100 watts: the <span class="t">power wall</span>. Its one core showed the OS two logical processors.' },
            { y: 2006, name: 'Intel Core 2 Duo', fam: 'x86', tr: 2.91e8, mhz: 2930, cores: 2, lp: 2, ca: 2, cache: 'L1 per core, 4 MB shared L2', note: 'Two cores at a lower clock beat one hot, fast core. From here on, new transistors mostly became more cores and cache.' },
            { y: 2008, name: 'Intel Core i7', fam: 'x86', tr: 7.31e8, mhz: 3200, cores: 4, lp: 8, ca: 3, cache: 'L1 + L2 per core, 8 MB shared L3', note: 'Four cores with two logical processors each (8 in all), a big L3 shared by every core, and the memory controller on the chip.' },
            { y: 2013, name: 'Apple A7', fam: 'ARM', tr: 1e9, mhz: 1300, cores: 2, lp: 2, ca: 3, cache: 'L1, 1 MB L2, 4 MB L3', note: 'A phone <span class="t" data-t="system on a chip">system on a chip</span> with about a billion transistors: CPU cores, a GPU and more on one piece of silicon.' },
            { y: 2020, name: 'Apple M1', fam: 'ARM', tr: 1.6e10, mhz: 3200, cores: 8, lp: 8, ca: 3, cache: 'L1, L2, shared system cache (L3)', note: 'An ARM system on a chip moves into laptops: 8 CPU cores, a GPU, an AI engine, with main memory in the same package.' },
            { y: 2023, name: 'Apple M3 Max', fam: 'ARM', tr: 9.2e10, mhz: 4050, cores: 16, lp: 16, ca: 3, cache: 'L1, L2, shared system cache (L3)', note: 'About 92 billion transistors and 16 CPU cores, yet a clock close to 2004’s: the transistors went into cores, caches and specialised units.' },
          ];
          let metric = 'tr', sel = 0, moore = false;
          const svg = s('svg', { viewBox: `0 0 ${VW} 374`, width: '100%', role: 'img', 'aria-label': 'Chart of chip milestones' });
          const capEl = h('p', { class: 'small m0' });
          const mooreBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { moore = !moore; draw(); } });
          const mooreNote = h('div', { class: 'callout tip m0 small', 'data-label': 'Check the doubling rule' });
          const info = h('div', { class: 'stack gap-s' });
          const bPrev = h('button', { class: 'btn sm', type: 'button', onclick: () => pick(sel - 1) }, '◀ Earlier');
          const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => pick(sel + 1) }, 'Later ▶');
          const yOf = (v) => { const m = METRICS[metric]; return Y1 - ((v - m.lo) / (m.hi - m.lo)) * (Y1 - Y0); };
          function mark(c, x, y, r, isSel) {
            // x86 = filled circle, ARM = filled diamond, early Intel = hollow circle; the selected chip gets a halo
            const halo = isSel ? s('circle', { cx: x, cy: y, r: r + 6, style: 'fill:none;stroke:var(--chc)', 'stroke-width': 2.5 }) : null;
            if (c.fam === 'ARM') return s('g', {}, halo, s('rect', { x: x - r * 0.85, y: y - r * 0.85, width: 1.7 * r, height: 1.7 * r, transform: `rotate(45 ${x} ${y})`, class: 's-cpu', 'stroke-width': 2, style: 'fill:var(--cpu)' }));
            return s('g', {}, halo, s('circle', { cx: x, cy: y, r, class: 's-cpu', 'stroke-width': 2.5, style: c.fam === 'x86' ? 'fill:var(--cpu)' : null }));
          }
          function draw() {
            const m = METRICS[metric];
            const g = s('g', {});
            // era bands
            g.append(s('rect', { x: xOf(2004.5), y: Y0, width: X1 - xOf(2004.5), height: Y1 - Y0, style: 'fill:var(--panel-2)' }));
            g.append(s('text', { x: xOf(1987), y: 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, NW ? '← faster clocks' : '← one core, ever faster clocks'),
              s('text', { x: xOf(2015), y: 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, NW ? 'more cores →' : 'more cores, same clock →'));
            // grid + axes
            m.minor.forEach((v) => g.append(s('line', { x1: X0, y1: yOf(v), x2: X1, y2: yOf(v), style: 'stroke:var(--line)', 'stroke-width': 1, 'stroke-dasharray': '2 4' })));
            m.ticks.forEach(([v, lab]) => g.append(s('line', { x1: X0, y1: yOf(v), x2: X1, y2: yOf(v), style: 'stroke:var(--line)', 'stroke-width': 1 }), s('text', { x: X0 - 6, y: yOf(v) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, lab)));
            for (let yr = 1970; yr <= 2020; yr += 10) g.append(s('text', { x: xOf(yr), y: Y1 + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, String(yr)), s('line', { x1: xOf(yr), y1: Y1, x2: xOf(yr), y2: Y1 + 5, class: 's-muted' }));
            g.append(s('line', { x1: X0, y1: Y1, x2: X1, y2: Y1, class: 's-line', 'stroke-width': 1.5 }));
            g.append(s('line', { x1: xOf(2004.5), y1: Y0, x2: xOf(2004.5), y2: Y1, style: 'stroke:var(--intr)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }), s('text', { x: xOf(2004.5), y: Y0 - 10, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--intr)', 'font-weight': 800 }, 'power wall ≈ 2004'));
            // Moore's-law guide: 2,300 transistors in 1971, doubling every 2 years
            if (metric === 'tr' && moore) {
              const endYr = 1971 + ((m.hi - Math.log10(2300)) / Math.log10(2)) * 2;
              g.append(s('line', { x1: xOf(1971), y1: yOf(Math.log10(2300)), x2: xOf(Math.min(endYr, 2025)), y2: yOf(Math.log10(2300) + ((Math.min(endYr, 2025) - 1971) / 2) * Math.log10(2)), style: 'stroke:var(--ok)', 'stroke-width': 2.5, 'stroke-dasharray': '8 5' }),
                s('text', { x: xOf(2003), y: yOf(Math.log10(2300) + 16 * Math.log10(2)) - 12, 'text-anchor': 'end', 'font-size': 13, style: 'fill:var(--ok)', 'font-weight': 800 }, '×2 every 2 years'));
            }
            // selected-year guide
            const c0 = CHIPS[sel];
            g.append(s('line', { x1: xOf(c0.y), y1: Y0, x2: xOf(c0.y), y2: Y1, style: 'stroke:var(--chc)', 'stroke-width': 1.5, opacity: 0.6 }));
            // points (logical-processor rings first, then the chips)
            CHIPS.forEach((c, i) => {
              const x = xOf(c.y) + (c.y === 1985 ? (c.fam === 'ARM' ? -5 : 5) : 0);
              if (metric === 'co' && c.lp > c.cores) g.append(s('circle', { cx: x, cy: yOf(m.lp(c)), r: 8, style: 'fill:none;stroke:var(--thread)', 'stroke-width': 2.5 }));
              const pt = s('g', {}, mark(c, x, yOf(m.val(c)), i === sel ? 9 : 6.5, i === sel), s('circle', { cx: x, cy: yOf(m.val(c)), r: 13, style: 'fill:transparent;stroke:none' }), s('title', {}, c.y + ' · ' + c.name));
              hotify(pt, c.y + ' ' + c.name, () => pick(i));
              g.append(pt);
            });
            // label the selected chip: try spots around the point, keep the first one that stays inside
            // the plot and does not cover another point (label width is estimated from its length)
            const sx = xOf(c0.y), sy = yOf(m.val(c0)), lw = c0.name.length * 7.8;
            const others = CHIPS.filter((c, i) => i !== sel).map((c) => [xOf(c.y), yOf(m.val(c))]);
            const spots = [[14, -12, 'start'], [-14, -12, 'end'], [-18, 5, 'end'], [18, 5, 'start'], [14, 26, 'start'], [-14, 26, 'end']];
            const fits = ([dx, dy, a]) => {
              const bx0 = a === 'start' ? sx + dx : sx + dx - lw, bx1 = bx0 + lw, by0 = sy + dy - 14, by1 = sy + dy + 4;
              if (bx0 < X0 + 4 || bx1 > X1 + 10 || by0 < Y0 - 2 || by1 > Y1 - 2) return false;
              return !others.some(([ox, oy]) => ox > bx0 - 9 && ox < bx1 + 9 && oy > by0 - 9 && oy < by1 + 9);
            };
            const [ldx, ldy, lan] = spots.find(fits) || spots[0];
            g.append(s('text', { x: sx + ldx, y: sy + ldy, 'text-anchor': lan, 'font-size': 14, 'font-weight': 800, style: 'fill:var(--chc)' }, c0.name));
            svg.replaceChildren(g);
            capEl.innerHTML = m.cap;
            mooreBtn.style.display = metric === 'tr' ? '' : 'none';
            mooreBtn.innerHTML = moore ? 'Hide the ×2 line' : 'Show ×2 every 2 years';
            mooreBtn.classList.toggle('on', moore);
            mooreNote.setAttribute('data-label', NOTES[metric][0]);
            mooreNote.innerHTML = NOTES[metric][1];
            paintInfo();
          }
          function paintInfo() {
            const c = CHIPS[sel];
            const era = c.y < 2004 ? ['chip cpu', 'Clock-speed race'] : c.y === 2004 ? ['chip intr', 'Power wall'] : c.y < 2010 ? ['chip thread', 'Multicore era'] : ['chip accent', 'System-on-chip era'];
            info.replaceChildren(
              // the Earlier/Later buttons live in the year row (moved here on every repaint) to save height
              h('div', { class: NW ? 'row gap-s' : 'row gap-s nw' }, h('span', { class: 'big', style: { fontSize: '34px' } }, String(c.y)), h('span', { class: era[0] }, era[1]), h('span', { class: 'grow' }), bPrev, bNext),
              h('div', { style: { fontSize: '20px', fontWeight: 800, lineHeight: 1.2 } }, c.name, ' ', h('span', { class: 'chip', style: { verticalAlign: 'middle' } }, c.fam + ' family')),
              h('div', { class: 'p12-kv' },
                h('span', {}, 'Transistors'), h('span', {}, '≈ ' + fmtN(c.tr)),
                h('span', {}, 'Top clock'), h('span', {}, '≈ ' + fmtHz(c.mhz)),
                h('span', {}, 'Cores'), h('span', {}, c.cores + (c.lp > c.cores ? ` (${c.lp} logical processors)` : '')),
                h('span', {}, 'On-chip cache'), h('span', {}, c.cache)),
              h('p', { class: 'small m0', html: c.note }));
            bPrev.title = bNext.title = `Chip ${sel + 1} of ${CHIPS.length}`;
            bPrev.disabled = sel === 0; bNext.disabled = sel === CHIPS.length - 1;
          }
          function pick(i) { sel = ctx.util.clamp(i, 0, CHIPS.length - 1); draw(); }
          const seg = ctx.ui.seg([{ value: 'tr', label: 'Transistors' }, { value: 'hz', label: 'Clock speed' }, { value: 'co', label: 'Cores' }, { value: 'ca', label: 'Cache' }], metric, (v) => { metric = v; draw(); });
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'card white stack gap-s' },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, mooreBtn),
              h('div', { class: 'p12-svgwrap' }, svg),
              capEl,
              h('p', { class: 'xs muted m0' }, 'Legend: ● x86   ◆ ARM   ○ earlier Intel. Values are approximate and rounded; clock = roughly the fastest version of that chip. Click any point.')),
            h('div', { class: 'stack' },
              h('div', { class: 'card stack gap-s', style: { flex: 'none' } }, info),
              mooreNote,
              h('div', { class: 'callout why m0 small', 'data-label': 'Why the clock stopped climbing', html: 'Power rises steeply with clock speed, since faster switching also needs a higher voltage. Near 4 GHz chips ran as hot as they could be cooled, so transistors went into more <span class="t" data-t="core">cores</span> and caches instead.' }))));
          draw();
        },
      },

      /* ---------------- 3. Inside one chip: cores, cache levels, logical processors ---------------- */
      {
        title: 'One chip, many processors: cores, caches, threads',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const tabs = ctx.ui.tabs([
            { label: 'Build a chip', render: (p) => chipBuilder(p, ctx) },
            { label: 'Two threads, one core', render: (p) => smtLab(p, ctx) },
          ]);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0' }, 'A modern microprocessor chip is really several processors plus a lot of fast memory.'),
              h('ul', { class: 'm0' },
                h('li', { html: '<b>Several cores.</b> Each <span class="t">core</span> is a complete processor.' }),
                h('li', { html: '<b>Cache levels.</b> Each core has a small, fastest L1 and a larger L2; all cores share a big L3 (<span class="t" data-t="cache levels">L1, L2, L3</span>).' }),
                h('li', { html: '<b>Logical processors.</b> A <b>thread</b> is one independent stream of instructions. With <span class="t" data-t="simultaneous multithreading">simultaneous multithreading (SMT)</span>, a core keeps two sets of registers, runs two threads at once and shows the OS two <span class="t" data-t="logical processor">logical processors</span> that share its <span class="t" data-t="execution unit">execution units</span>.' })),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Two logical processors are not two cores. They share one core’s units, so the gain is usually well under 2×.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why the OS cares', html: 'The OS <b>scheduler</b>, the part that decides which thread runs next, treats each logical processor as a CPU. Sharing a core or a cache changes how fast threads run.' })),
            tabs));
        },
      },

      /* ---------------- 4. GPUs and SIMD: one instruction, many numbers ---------------- */
      {
        title: 'GPUs and SIMD: one instruction, many numbers',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const A = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
          const B = [2, 7, 1, 8, 2, 8, 1, 8, 2, 8, 4, 5, 9, 0, 4, 5];
          // geometry: desktop puts row labels on the left; phones put them above each row so the cells can be wider
          const NW = ctx.narrow, N = 16;
          const G = NW ? { VW: 340, VH: 238, CX: 6, CW: 20.5, RH: 26, fs: 13, ty: 18, rows: [20, 68, 126, 174], labs: [14, 62, 120, 168], line: 102, tick: 206, tickLab: 228 }
            : { VW: 640, VH: 256, CX: 132, CW: 31.5, RH: 34, fs: 15, ty: 23, rows: [6, 50, 108, 178], labs: [24, 68, 126, 196], line: 96, tick: 222, tickLab: 246 };
          const CX = G.CX, CW = G.CW;
          let lanes = 4;
          const svg = s('svg', { viewBox: `0 0 ${G.VW} ${G.VH}`, width: '100%', role: 'img', 'aria-label': 'Scalar versus SIMD addition of two arrays' });
          const readout = h('div', { class: 'grid-2', style: { gap: '10px' } });
          const cellX = (i) => CX + i * CW;
          function row(g, y, vals, done, cls, hiFrom, hiTo) {
            for (let i = 0; i < N; i++) {
              const on = i < done;
              g.append(s('rect', { x: cellX(i), y, width: CW - 4, height: G.RH, rx: 5, class: on ? cls : 's-panel', 'stroke-width': on ? 2 : 1.2, 'stroke-dasharray': on ? null : '3 3' }));
              if (on) g.append(s('text', { x: cellX(i) + (CW - 4) / 2, y: y + G.ty, 'text-anchor': 'middle', 'font-size': G.fs, 'font-weight': 800 }, String(vals[i])));
            }
            if (hiTo > hiFrom) g.append(s('rect', { x: cellX(hiFrom) - 3, y: y - 4, width: (hiTo - hiFrom) * CW + 2, height: G.RH + 8, rx: 8, style: 'fill:none;stroke:var(--chc)', 'stroke-width': 2.5 }));
          }
          function draw(t) {
            const L = lanes, g = s('g', {});
            const C = A.map((a, i) => a + B[i]);
            const sc = Math.min(t, N), sd = Math.min(N, t * L), simdPrev = Math.min(N, (t - 1) * L);
            // row label: two lines on the left (desktop) or one line above the row (phones)
            const lab = (k, a, b) => NW ? g.append(s('text', { x: 6, y: G.labs[k], 'font-size': 13.5, 'font-weight': 800 }, a, s('tspan', { class: 's-sub', 'font-weight': 700 }, '  ' + b)))
              : g.append(s('text', { x: 4, y: G.labs[k], 'font-size': 14, 'font-weight': 800 }, a), s('text', { x: 4, y: G.labs[k] + 16, 'font-size': 13, class: 's-sub', 'font-weight': 700 }, b));
            lab(0, 'Array A', '16 numbers'); row(g, G.rows[0], A, N, 's-mem', 0, 0);
            lab(1, 'Array B', '16 numbers'); row(g, G.rows[1], B, N, 's-mem', 0, 0);
            g.append(s('line', { x1: CX, y1: G.line, x2: cellX(N) - 4, y2: G.line, class: 's-muted' }));
            lab(2, 'Scalar core', 'C = A + B, 1 lane'); row(g, G.rows[2], C, sc, 's-cpu', t >= 1 && t <= N ? sc - 1 : 0, t >= 1 && t <= N ? sc : 0);
            lab(3, 'SIMD unit', 'C = A + B, ' + L + (L === 1 ? ' lane' : ' lanes')); row(g, G.rows[3], C, sd, 's-accent', t >= 1 && simdPrev < N ? simdPrev : 0, t >= 1 && simdPrev < N ? sd : 0);
            // lane-group ticks under the SIMD row show how the 16 items split into instructions
            for (let k = 0; k < N / L; k++) {
              const x1 = cellX(k * L), x2 = cellX((k + 1) * L) - 4;
              g.append(s('path', { d: `M${x1} ${G.tick} v6 H${x2} v-6`, class: 's-muted', 'stroke-width': 1.5 }));
              if (L >= 2) g.append(s('text', { x: (x1 + x2) / 2, y: G.tickLab, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, L >= 4 ? 'instr ' + (k + 1) : String(k + 1)));
            }
            if (L === 1) g.append(s('text', { x: cellX(8), y: G.tickLab, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, NW ? 'one instruction per number' : 'one instruction per number, like the scalar core'));
            svg.replaceChildren(g);
            const need = N / L, px = 3840 * 2160;
            readout.replaceChildren(
              h('div', { class: 'card tight' }, h('div', { class: 'xs muted b' }, 'ADD INSTRUCTIONS FOR 16 NUMBERS'), h('div', { class: 'small', html: `Scalar <b>16</b> · SIMD 16 ÷ ${L} = <b style="color:var(--accent)">${need}</b> · <b>${L === 1 ? 'no saving' : L + '× fewer'}</b>` })),
              h('div', { class: 'card tight' }, h('div', { class: 'xs muted b' }, 'BRIGHTEN A 4K GREY IMAGE'), h('div', { class: 'small', html: `Scalar <b>8,294,400</b> · SIMD <b style="color:var(--accent)">${(px / L).toLocaleString('en-US')}</b>` }), h('div', { class: 'xs muted' }, '3840 × 2160 pixels, one add each')));
          }
          const cap = (t) => {
            const L = lanes, need = N / L;
            if (t === 0) return `<b>Ready.</b> Both units must add 16 pairs of numbers. The scalar core handles one pair per instruction; the SIMD unit handles ${L} pair${L > 1 ? 's' : ''} per instruction. Press play.`;
            if (t === N) return L === 1 ? '<b>Both done after 16 instructions.</b> With a single lane, SIMD is no better than scalar. Drag the slider to add lanes.' : `<b>Both done.</b> Scalar: 16 instructions. SIMD: ${need}. Same result, <b>${L}× fewer instructions</b>, because every lane did its add at the same time.`;
            if (t < need) return L === 1 ? `<b>Tick ${t}.</b> With a single lane, both units compute just one item per instruction: C[${t - 1}].` : `<b>Tick ${t}.</b> One scalar instruction computes C[${t - 1}]. One SIMD instruction computes C[${(t - 1) * L}] to C[${t * L - 1}] all at once.`;
            if (t === need) return `<b>Tick ${t}.</b> The SIMD unit is <b>finished</b> after just ${need} instruction${need > 1 ? 's' : ''}. The scalar core still has ${N - t} to go.`;
            return `<b>Tick ${t}.</b> SIMD finished long ago; the scalar core is on item ${t} of 16.`;
          };
          const player = ctx.ui.player({ count: N + 1, interval: 750, render: (t) => { draw(t); return cap(t); } });
          const slider = ctx.ui.slider({ label: 'Lanes in the SIMD unit', min: 0, max: 4, step: 1, value: 2, format: (v) => String(2 ** v), onInput: (v) => { lanes = 2 ** v; player.reset(); } });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0' }, 'Drawing a picture means doing the same small sum for millions of pixels. GPUs are built for exactly that.'),
              h('p', { class: 'm0', html: 'A <span class="t" data-t="graphics processing unit">graphics processing unit (GPU)</span> uses <span class="t" data-t="SIMD">SIMD</span> (single instruction, multiple data): one instruction applies the same operation to many numbers at once, each in its own <span class="t">lane</span>. An ordinary (scalar) instruction handles just one number.' }),
              h('p', { class: 'm0', html: 'Built for graphics, GPUs now also crunch numbers for physics simulations and machine learning. Most CPU cores have a <span class="t">vector unit</span> too, for SIMD on 4 to 16 numbers.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Training an AI model is mostly trillions of multiply-adds on big grids of numbers. A large GPU runs thousands of lanes at once, which is why GPUs power modern AI.' }),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'SIMD only helps when the same operation applies to many independent items. Code full of if-statements, or steps that each need the previous result, gains little.' })),
            h('div', { class: 'card white stack gap-s' }, slider, h('div', { class: 'p12-svgwrap' }, svg), readout, player.el)));
        },
      },

      /* ---------------- 5. DSPs and accelerators: follow a phone call ---------------- */
      {
        title: 'DSPs and accelerators: follow a phone call through the chip',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const BLOCKS = [
            { k: 'mic', cls: 's-io', lab: 'Microphone\n+ converter', lab2: 'Speaker\n+ converter', out: '320 samples' },
            { k: 'dsp', cls: 's-proc', lab: 'Audio DSP', lab2: 'Audio DSP', out: '5,120 → 250 bits' },
            { k: 'enc', cls: 's-warn', lab: 'Encryption\nengine', lab2: 'Encryption\nengine', out: 'scrambled bits' },
            { k: 'mdsp', cls: 's-proc', lab: 'Modem DSP', lab2: 'Modem DSP', out: 'radio waveform' },
            { k: 'rad', cls: 's-io', lab: 'Radio +\nantenna', lab2: 'Radio +\nantenna', out: 'sent' },
          ];
          // frames: which block is active, how many outputs are shown, direction, and the narration
          const F = [
            { act: [], outs: 0, dir: 1, cap: '<b>A phone call.</b> Every 20 ms a new slice of your voice must be captured, cleaned, squeezed, protected and sent, without ever falling behind. Watch which parts of the chip do the work.' },
            { act: ['mic'], outs: 1, dir: 1, cap: '<b>Capture.</b> The converter measures the microphone’s signal 16,000 times per second. Every 20 ms that makes a chunk of 320 samples of 16 bits each: 5,120 bits.' },
            { act: ['dsp'], outs: 1, dir: 1, cap: '<b>Clean up (audio DSP).</b> The DSP removes echo and background noise by running the same multiply-and-add filter over every sample, finishing well inside the 20 ms before the next chunk arrives.' },
            { act: ['dsp'], outs: 2, dir: 1, cap: '<b>Compress (DSP as a speech codec).</b> The same DSP encodes the speech, squeezing 5,120 bits into about 250: roughly 20 times smaller, so it fits the radio link.' },
            { act: ['enc'], outs: 3, dir: 1, cap: '<b>Protect (accelerator).</b> A dedicated encryption engine inside the modem scrambles the bits so eavesdroppers hear nothing. It does only this one job, at a sliver of the energy software would need.' },
            { act: ['mdsp'], outs: 4, dir: 1, cap: '<b>Prepare to transmit (modem DSP).</b> The modem’s DSPs add error-correcting bits and turn the data into the exact waveform the radio must send.' },
            { act: ['rad'], outs: 5, dir: 1, cap: '<b>Send.</b> The radio transmits the chunk. 20 ms later the next one is already on its way: 50 chunks every second, for as long as you talk.' },
            { act: ['mic', 'dsp', 'enc', 'mdsp', 'rad'], outs: 0, dir: -1, cap: '<b>Listening runs in reverse.</b> The radio receives, the modem DSP recovers and error-corrects the bits, the engine decrypts, the audio DSP decodes, and the converter drives the speaker.' },
            { act: ['cpu'], outs: 0, dir: -1, cap: '<b>The main CPU cores barely woke up.</b> A core could do all of this in software, but specialists do it with far less energy, so in many phones the cores sleep through most of a call and the battery lasts.' },
          ];
          // geometry: desktop runs the five blocks left to right; phones stack them top to bottom so text stays readable
          const NW = ctx.narrow;
          const GM = NW ? {
            VW: 340, VH: 598, blk: (k) => ({ x: 16, y: 30 + k * 58, w: 150, h: 44 }), fs: 14,
            out: (b) => ({ x: b.x + b.w + 14, y: b.y + b.h / 2 + 5, a: 'start' }),
            modem: (b2, b3) => ({ x: 8, y: b2.y - 8, w: 324, h: b3.y + b3.h - b2.y + 16, lx: 326, ly: b2.y + 10, la: 'end' }),
            cpu: { x: 8, y: 330, w: 324, h: 100, cx: (c) => 26 + c * 76, cy: 358, cw: 56, ch: 36, ty: 350, nx: 170, ny: 420 },
            st: { tx: 8, ty: 456, x0: 12, step: 64, y: 466, base: 516, x1: 332 },
            key: (k) => ({ x: 8 + (k % 2) * 165, y: 556 + Math.floor(k / 2) * 22 }),
          } : {
            VW: 640, VH: 362, blk: (k) => ({ x: 6 + k * 132, y: 52, w: 100, h: 100 }), fs: 14.5,
            out: (b) => ({ x: b.x + b.w / 2, y: b.y + b.h + 22, a: 'middle' }),
            modem: (b2, b3) => ({ x: b2.x - 12, y: 24, w: b3.x + b3.w - b2.x + 24, h: 164, lx: (b2.x + b3.x + b3.w) / 2, ly: 40, la: 'middle' }),
            cpu: { x: 6, y: 206, w: 300, h: 118, cx: (c) => 24 + c * 70, cy: 242, cw: 52, ch: 44, ty: 230, nx: 156, ny: 311 },
            st: { tx: 330, ty: 230, x0: 332, step: 60, y: 246, base: 296, x1: 632 },
            key: (k) => ({ x: 8 + k * 150, y: 342 }),
          };
          const svg = s('svg', { viewBox: `0 0 ${GM.VW} ${GM.VH}`, width: '100%', role: 'img', 'aria-label': 'The path of a phone call through the chip' });
          function draw(i) {
            const f = F[i], g = s('g', {});
            const act = new Set(f.act);
            const md = GM.modem(GM.blk(2), GM.blk(3));
            g.append(s('rect', { x: md.x, y: md.y, width: md.w, height: md.h, rx: 12, style: 'fill:none;stroke:var(--io)', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }),
              s('text', { x: md.lx, y: md.ly, 'text-anchor': md.la, 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--io)' }, 'inside the modem'));
            g.append(s('text', { x: 6, y: 16, 'font-size': 13.5, 'font-weight': 800, class: 's-sub' }, f.dir > 0 ? (NW ? 'Your voice, going out  ↓' : 'Your voice, going out  →') : (NW ? '↑  The other person’s voice, coming in' : '←  The other person’s voice, coming in')));
            BLOCKS.forEach((b, k) => {
              const on = act.has(b.k), dim = act.size && !on, B0 = GM.blk(k);
              g.append(sbox(s, B0.x, B0.y, B0.w, B0.h, b.cls, f.dir > 0 ? b.lab : b.lab2, { fs: GM.fs, sw: on ? 4 : 2, gcls: dim ? 'p12-dim' : null }));
              if (k < 4) {  // arrow to the next block, pointing the way the sound travels
                const B1 = GM.blk(k + 1);
                const [p, q] = NW ? [[B0.x + B0.w / 2, B0.y + B0.h + 3], [B1.x + B1.w / 2, B1.y - 3]] : [[B0.x + B0.w + 3, B0.y + B0.h / 2], [B1.x - 3, B1.y + B1.h / 2]];
                const [a, z] = f.dir > 0 ? [p, q] : [q, p];
                g.append(s('line', { x1: a[0], y1: a[1], x2: z[0], y2: z[1], class: 's-line', 'marker-end': 'url(#arr)' }));
              }
              if (f.dir > 0 && k < f.outs) { const o = GM.out(B0); g.append(s('text', { x: o.x, y: o.y, 'text-anchor': o.a, 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--chc)' }, b.out)); }
            });
            // main CPU cores: asleep
            const cpuOn = act.has('cpu'), C = GM.cpu;
            const cg = sbox(s, C.x, C.y, C.w, C.h, 's-cpu', null, { sw: cpuOn ? 4 : 2, gcls: act.size && !cpuOn ? 'p12-dim' : null });
            [0, 1, 2, 3].forEach((c) => cg.append(s('rect', { x: C.cx(c), y: C.cy, width: C.cw, height: C.ch, rx: 7, class: 's-cpu', 'stroke-width': 1.5, style: 'fill:var(--panel)' }), s('text', { x: C.cx(c) + C.cw / 2, y: C.cy + C.ch / 2 + 5, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub', 'font-weight': 800 }, 'zz')));
            cg.append(s('text', { x: C.x + 14, y: C.ty, 'font-size': 15, 'font-weight': 800 }, 'Main CPU cores'), s('text', { x: C.nx, y: C.ny, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: 's-sub' }, 'asleep, saving battery'));
            g.append(cg);
            // the stream: one chunk every 20 ms
            const T = GM.st;
            g.append(s('text', { x: T.tx, y: T.ty, 'font-size': 15, 'font-weight': 800 }, 'A stream: one chunk every 20 ms'));
            g.append(s('line', { x1: T.x0 - 2, y1: T.base, x2: T.x1, y2: T.base, class: 's-line', 'stroke-width': 1.5 }));
            for (let c = 0; c < 5; c++) {
              const x = T.x0 + c * T.step;
              const cur = f.dir > 0 && i > 0 && c === 1, past = c === 0 && i > 0;
              g.append(s('rect', { x, y: T.y, width: 54, height: 42, rx: 7, class: cur ? 's-proc' : past ? 's-ok' : 's-panel', 'stroke-width': cur ? 2.5 : 1.5, 'stroke-dasharray': !cur && !past ? '3 3' : null }),
                s('line', { x1: x, y1: T.base - 4, x2: x, y2: T.base + 4, class: 's-line', 'stroke-width': 1.5 }), s('text', { x: x + 2, y: T.base + 20, 'font-size': 13, class: 's-sub', 'font-weight': 700 }, c * 20 + ' ms'));
              g.append(s('text', { x: x + 27, y: T.y + 26, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: cur ? null : 's-sub' }, past ? 'sent ✓' : cur ? 'now' : 'next'));
            }
            // colour key
            [['s-cpu', 'CPU core'], ['s-proc', 'DSP'], ['s-warn', 'Accelerator'], ['s-io', 'I/O device']].forEach(([c, nm], k) => {
              const K = GM.key(k);
              g.append(s('rect', { x: K.x, y: K.y, width: 18, height: 14, rx: 3, class: c, 'stroke-width': 1.5 }), s('text', { x: K.x + 24, y: K.y + 12, 'font-size': 13.5, 'font-weight': 700, class: 's-sub' }, nm));
            });
            svg.replaceChildren(g);
            return f.cap;
          }
          const player = ctx.ui.player({ count: F.length, interval: 3200, render: draw });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0' }, 'Some jobs never stop: sound from a microphone, a radio signal, a video. Signal processors are built for them.'),
              h('p', { class: 'm0', html: 'A <span class="t" data-t="digital signal processor">digital signal processor (DSP)</span> handles a <b>stream</b> of samples arriving at a fixed rate. It repeats the same arithmetic, mostly multiply-and-add, on every sample, and must finish each chunk before the next arrives. DSPs sit inside other devices as embedded <span class="t" data-t="coprocessor">coprocessors</span>: in modems, speech and video codecs, and security hardware.' }),
              h('p', { class: 'm0', html: 'A <span class="t">hardware accelerator</span> goes further: a circuit that does exactly one job, such as encryption or compression. It can do nothing else, but it is far faster and uses far less energy than software on a CPU core.' }),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A head chef (CPU core) can cook anything. The pastry station (DSP) and the espresso machine (accelerator) do one kind of thing, but faster and cheaper, and the chef is free for everything else.' })),
            h('div', { class: 'card white stack gap-s' }, h('div', { class: 'p12-svgwrap' }, svg), player.el)));
        },
      },

      /* ---------------- 6. Floor plan of a smartphone SoC ---------------- */
      {
        title: 'Tour a smartphone system on a chip',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const P = [
            { k: 'pc', x: 20, y: 44, w: 160, h: 150, cls: 's-cpu', role: 'cpu', lab: '', name: 'Performance CPU cores (2)', text: 'Big, fast general-purpose cores. They run apps, web pages and the operating system itself when there is heavy work to do.', best: 'branchy, unpredictable code where each step depends on the last', os: 'The scheduler moves demanding threads onto these cores.' },
            { k: 'ec', x: 190, y: 44, w: 124, h: 150, cls: 's-cpu', role: 'cpu', lab: '', name: 'Efficiency CPU cores (4)', text: 'Smaller, slower cores that use a fraction of the power. They handle light and background work such as syncing mail or checking for messages.', best: 'light background tasks that must not drain the battery', os: 'Mixing big and small cores lets the OS trade speed for battery life, thread by thread.' },
            { k: 'sc', x: 324, y: 44, w: 86, h: 150, cls: 's-mem', role: 'mem', lab: 'Shared\ncache', name: 'Shared cache', text: 'A few megabytes of fast memory shared by the cores, and often by the GPU and other units too, so data does not always make the slow trip to main memory.', best: 'keeping recently used data close to every unit', os: '' },
            { k: 'gpu', x: 420, y: 44, w: 220, h: 220, cls: 's-accent', role: 'gpu', lab: 'GPU', name: 'Graphics processing unit (GPU)', text: 'Hundreds of SIMD lanes (SIMD: one instruction applied to many numbers at once). It draws the screen, the user interface and games, and doubles as a general-purpose vector processor.', best: 'the same calculation on millions of pixels or numbers', os: 'Apps reach it through a graphics driver; the OS shares it between apps.' },
            { k: 'npu', x: 20, y: 204, w: 150, h: 140, cls: 's-warn', role: 'acc', lab: 'AI engine\n(NPU)', name: 'AI engine (neural processing unit)', text: 'An accelerator for the multiply-add grids inside neural networks: face unlock, photo clean-up, speech recognition, on-device assistants.', best: 'running trained AI models at very low power', os: '' },
            { k: 'isp', x: 180, y: 204, w: 134, h: 65, cls: 's-warn', role: 'acc', lab: 'Camera image\nprocessor', name: 'Image signal processor (camera)', text: 'A fixed pipeline that turns the camera sensor’s raw readings into a picture: colour, noise removal, focus and exposure, for every frame, 30 to 60 times a second.', best: 'processing camera frames as they stream in', os: '' },
            { k: 'vid', x: 180, y: 279, w: 134, h: 65, cls: 's-warn', role: 'acc', lab: 'Video codec', name: 'Video codec', text: 'A fixed-function accelerator that compresses and decompresses video. Streaming a movie through software on the CPU would drain the battery; the codec does it at a trickle of power.', best: 'encoding and decoding video streams', os: '' },
            { k: 'dsp', x: 324, y: 204, w: 86, h: 140, cls: 's-proc', role: 'dsp', lab: 'DSP', name: 'Audio and sensor DSP', text: 'A digital signal processor, built for streams: call audio, echo removal, listening for a wake word, counting steps from motion sensors, all while the main cores sleep.', best: 'steady streams of samples with deadlines', os: '' },
            { k: 'sec', x: 420, y: 274, w: 105, h: 70, cls: 's-warn', role: 'acc', lab: 'Security\nengine', name: 'Security engine', text: 'A walled-off coprocessor with its own encryption accelerators. It encrypts storage, checks fingerprint or face data, and guards keys that even the operating system cannot read.', best: 'encryption and protecting secret keys', os: 'The OS asks it to perform crypto operations but never sees the keys.' },
            { k: 'io', x: 535, y: 274, w: 105, h: 70, cls: 's-io', role: 'io', lab: 'Display\n+ I/O', name: 'Display and I/O controllers', text: 'Drive the screen, the USB port, flash storage and sensors. Each is an I/O module built into the chip.', best: 'moving data to and from the outside world', os: 'The OS controls each one through a device driver.' },
            { k: 'mod', x: 20, y: 354, w: 294, h: 152, cls: 's-io', role: 'io', lab: 'Modem (4G / 5G)\nwith its own DSPs', name: 'Modem', text: 'Turns bits into radio waveforms and back, using its own DSPs and accelerators for modulation, error correction and encryption. Many phone SoCs build it in; others use a separate modem chip.', best: 'cellular radio communication', os: 'To the OS it is an I/O device, driven like a network card.' },
            { k: 'mc', x: 324, y: 354, w: 316, h: 66, cls: 's-mem', role: 'mem', lab: 'Memory controller', name: 'Memory controller', text: 'Manages the main-memory chips and schedules every read and write that the cores, GPU and other units send to them.', best: 'feeding every unit from one shared pool of memory', os: 'Because all units share one pool, the OS must share it fairly too.' },
            { k: 'ram', x: 324, y: 430, w: 316, h: 76, cls: 's-mem', role: 'mem', lab: 'Main memory (DRAM)\nits own die, stacked on top', name: 'Main memory (DRAM)', text: 'Several gigabytes of DRAM on a separate memory die, stacked directly on top of the processor die in the same package. Very short wires make it faster and cheaper in energy than memory on a separate board.', best: 'holding every running program and its data', os: '' },
          ];
          // phones: a two-column floor plan in a narrow viewBox, so the labels stay readable
          const NW = ctx.narrow;
          const NARROW = { pc: [16, 40, 160, 150], ec: [184, 40, 140, 150], gpu: [16, 200, 196, 150], sc: [220, 200, 104, 150], npu: [16, 360, 150, 76], dsp: [174, 360, 150, 76],
            isp: [16, 446, 150, 64], vid: [174, 446, 150, 64], sec: [16, 520, 150, 64], io: [174, 520, 150, 64], mod: [16, 594, 308, 64], mc: [16, 668, 308, 50], ram: [16, 728, 308, 60] };
          if (NW) P.forEach((b) => { [b.x, b.y, b.w, b.h] = NARROW[b.k]; });
          const VW = NW ? 340 : 660, VH = NW ? 800 : 520;
          let sel = null;
          const seen = new Set();
          const svg = s('svg', { viewBox: `0 0 ${VW} ${VH}`, width: '100%', role: 'img', 'aria-label': 'Floor plan of a smartphone system on a chip' });
          const info = h('div', { class: 'card white stack gap-s', style: { minHeight: '262px' } });
          const prog = h('div', { class: 'meter', style: { flex: '1' } }, h('i'));
          const progTxt = h('span', { class: 'small b' });
          function draw() {
            const g = s('g', {});
            g.append(sbox(s, 6, 6, VW - 12, VH - 12, 's-panel', null, { rx: 16, sw: 3 }), s('text', { x: 20, y: 28, 'font-size': 13.5, class: 's-sub', 'font-weight': 800 }, NW ? 'ONE SoC PACKAGE' : 'ONE SoC PACKAGE · the dashed block is a separate memory die stacked on top'));
            P.forEach((b) => {
              // the GPU draws its own label (above its lane grid); the DRAM is dashed because it is a separate die
              const grp = sbox(s, b.x, b.y, b.w, b.h, b.cls, b.k === 'gpu' ? null : b.lab || null, { fs: 14, sw: 2, dash: b.k === 'ram' ? '7 4' : null, gcls: (sel === b.k ? 'sel' : '') + (seen.has(b.k) ? ' seen' : '') });
              if (b.k === 'pc') [0, 1].forEach((c) => grp.append(sbox(s, b.x + 10 + c * 74, b.y + 36, 66, 102, 's-cpu', 'P-core', { fs: 13.5, sw: 1.5 })));
              if (b.k === 'ec') [0, 1, 2, 3].forEach((c) => grp.append(sbox(s, b.x + (b.w - 108) / 2 + (c % 2) * 56, b.y + 36 + Math.floor(c / 2) * 54, 52, 48, 's-cpu', 'E', { fs: 13.5, sw: 1.5 })));
              if (b.k === 'pc' || b.k === 'ec') grp.append(s('text', { x: b.x + b.w / 2, y: b.y + 22, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, b.k === 'pc' ? 'Performance cores' : 'Efficiency cores'));
              if (b.k === 'gpu') {
                grp.append(slabel(s, b.x + b.w / 2, b.y + (b.h - 72) / 2 + 4, 'GPU', { fs: 22 }));
                for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) grp.append(s('rect', { x: b.x + (b.w - 178) / 2 + c * 23, y: b.y + b.h - 72 + r * 20, width: 17, height: 14, rx: 3, class: 's-accent', 'stroke-width': 1 }));
              }
              if (seen.has(b.k)) grp.append(s('text', { x: b.x + b.w - 7, y: b.y + b.h - 7, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 900, style: 'fill:var(--ok)' }, '✓'));
              g.append(hotify(grp, b.name, () => pick(b.k)));
            });
            svg.replaceChildren(g);
          }
          function paintInfo() {
            if (!sel) {
              info.replaceChildren(h('h3', { class: 'm0' }, 'Click any block'), h('p', { class: 'm0', html: 'Every solid block shares one piece of silicon: a <span class="t" data-t="system on a chip">system on a chip</span>. The main memory is a separate die (piece of silicon) stacked on top, inside the same protective package. Click each block to learn what it does, what it is best at, and how the OS deals with it.' }),
                h('div', { class: 'row gap-s' }, ...Object.values(ROLE).map((r) => h('span', { class: 'chip ' + r.chip }, r.name))));
            } else {
              const b = P.find((x) => x.k === sel), r = ROLE[b.role];
              info.replaceChildren(h('div', { class: 'row gap-s' }, h('span', { class: 'chip ' + r.chip }, r.name)), h('h3', { class: 'm0' }, b.name), h('p', { class: 'm0 small' }, b.text),
                h('div', { class: 'small', html: '<b>Best at:</b> ' + b.best }), ...(b.os ? [h('div', { class: 'small', html: '<b style="color:var(--os)">OS link:</b> ' + b.os })] : []));
            }
            prog.firstChild.style.width = (seen.size / P.length) * 100 + '%';
            progTxt.textContent = `Explored ${seen.size} of ${P.length}`;
          }
          // on phones the info card sits below the tall diagram, so bring it into view after each tap
          function pick(k) { sel = k; seen.add(k); draw(); paintInfo(); if (NW && info.scrollIntoView) info.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'p12-svgwrap' }, svg),
            h('div', { class: 'stack' },
              info,
              h('div', { class: 'row nw' }, prog, progTxt),
              h('div', { class: 'card tight stack gap-s' },
                h('div', { class: 'xs muted b' }, 'THE TRADE-OFF ACROSS THE CHIP'),
                h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: NW ? '2px' : '4px' } }, ...[['cpu', 'CPU core'], ['accent', 'GPU'], ['proc', 'DSP'], ['warn', 'Accelerator']].flatMap(([c, t], i) => [i ? '→' : null, h('span', { class: 'chip ' + c, style: NW ? { fontSize: '12.5px', padding: '2px 7px' } : null }, t)]).filter(Boolean)),
                h('div', { class: 'row nw xs muted b', style: { justifyContent: 'space-between' } }, h('span', {}, '← runs any program'), h('span', {}, 'one job, least energy →'))),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why put it all on one chip?', html: 'Signals cross millimetres instead of centimetres, so they are faster and cost far less energy. One part is smaller and cheaper than many, and every unit can share the same memory instead of copying data between boards.' }))));
          draw(); paintInfo();
        },
      },

      /* ---------------- 7. Lab: match each workload to the best unit ---------------- */
      {
        title: 'Lab: send each job to the unit that does it best',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const fb = h('div', { class: 'card white stack gap-s', style: { minHeight: '176px' } });
          const left = h('div', {});
          const m = matcher(left, ctx, fb);
          el.append(h('div', { class: 'split r fill' },
            left,
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'You are the dispatcher for a phone’s <span class="t" data-t="system on a chip">SoC</span>. Send every job to the unit that runs it fastest for the least energy.' }),
              fb,
              m.scoreEl,
              h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => m.reset() }, 'Start over'), h('button', { class: 'btn sm', type: 'button', onclick: () => m.hint() }, 'Rule of thumb'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => m.solve() }, 'Show answers')),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why the OS cares', html: 'Every unit is a shared resource. The OS schedules threads onto CPU cores and, through device drivers, queues work for the GPU, DSP and accelerators, deciding which program gets each one next.' }))));
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: the six ideas to remember',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const arrow = () => h('span', { class: 'b muted', style: { fontSize: '20px', textAlign: 'center', lineHeight: 1 } }, ctx.narrow ? '↓' : '→');
          const era = (cls, when, what) => h('div', { class: 'box ' + cls, style: { flex: '1', fontSize: '14.5px', padding: '6px 8px', lineHeight: 1.3 } }, h('div', { class: 'xs muted b' }, when), what);
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Click again to flip back.'),
            ctx.ui.flipcards([
              ['What is a microprocessor?', 'A whole processor on a single chip (first sold in 1971). It made desktop and handheld computers possible and became the fastest kind of general-purpose processor.'],
              ['Why did clock speeds stop climbing around 2004?', 'The power wall: faster clocks needed more power and made more heat than a chip could shed. New transistors went into more cores and bigger caches instead.'],
              ['What is inside a modern multicore chip?', 'Several cores, each with its own L1 and L2 cache, a shared L3, and often two logical processors per core (SMT) sharing that core’s execution units.'],
              ['What does SIMD mean, and who uses it?', 'Single instruction, multiple data: one instruction works on many numbers at once, one per lane. GPUs are built on it, and CPU vector units use it too.'],
              ['What is a DSP for?', 'Streams of samples (audio, radio, video) arriving at a fixed rate with deadlines. DSPs sit inside modems, speech and video codecs, and security hardware.'],
              ['What is a system on a chip?', 'One chip holding CPU cores, caches, a GPU, DSPs, accelerators and I/O such as radios and codecs, with main memory in the same package.'],
            ], { cols: 3, height: 172 }),
            h('div', { class: 'card tight stack gap-s' },
              h('h4', { class: 'm0' }, 'The whole story in one line'),
              h('div', { class: ctx.narrow ? 'stack gap-s' : 'row nw', style: { gap: '6px', alignItems: 'stretch' } },
                era('cpu', '1971', 'The whole CPU fits on one chip'), arrow(),
                era('cpu', '1970s to ~2004', 'More transistors, ever faster clocks'), arrow(),
                era('intr', '~2004', 'The power wall stops clock growth'), arrow(),
                era('thread', 'mid-2000s on', 'More cores, SMT, deeper caches'), arrow(),
                era('mem', 'today', 'Phone SoCs: cores, GPU, DSPs, accelerators')))));
        },
      },

      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself: microprocessors, GPUs, DSPs and SoCs',
        kind: 'check',
        quiz: [
          { q: 'What made the first microprocessor different from the processors that came before it?',
            choices: ['The entire processor was built on a single chip.', 'It was the first processor able to run a stored program.', 'It had several cores working in parallel.', 'It was faster than any earlier computer.'], answer: 0,
            feedback: [null, 'Stored-program computers had existed since the 1940s. What was new was fitting the whole processor onto one chip.', 'Multicore chips arrived only in the mid-2000s. Early microprocessors had a single core.', 'The first microprocessor was far slower than the big computers of its day. Its advantage was size and cost.'],
            why: 'A microprocessor puts the whole processor (arithmetic, registers and control) on one chip. Early ones were slow, but being tiny and cheap they made desktop and handheld computers possible.' },
          { q: 'Around 2004–2005, chip makers stopped pushing clock speeds much higher. Why?',
            choices: ['Faster clocks made chips use too much power and run too hot to cool.', 'Transistors could no longer be made any smaller.', 'Software could not take advantage of faster clocks.', 'Moore’s law ended, so no extra transistors were available.'], answer: 0,
            feedback: [null, 'Transistors kept shrinking, and counts kept doubling for many more years.', 'Every program benefits from a faster clock; that was exactly its appeal.', 'Transistor counts kept climbing, from hundreds of millions to tens of billions.'],
            why: 'This limit is the power wall. Power rises steeply with clock speed, so designers spent the growing transistor budget on more cores and bigger caches instead.' },
          { type: 'num', q: 'A laptop chip has 6 cores, and each core runs 2 hardware threads using simultaneous multithreading. How many logical processors does the operating system scheduler see?', answer: 12, tol: 0, unit: 'logical processors',
            why: 'Logical processors = cores × hardware threads per core = 6 × 2 = 12. The OS can hand a thread to each one, even though each pair shares a core.' },
          { type: 'tf', q: 'Turning on simultaneous multithreading (two logical processors per core) roughly doubles the work each core gets done.', answer: false,
            why: 'Both logical processors share one core’s execution units and caches. SMT fills slots that would sit idle, often gaining something like 10–30 percent, far less than a second real core.' },
          { type: 'num', q: 'A SIMD unit has 8 lanes. How many add instructions does it need to add two arrays of 1,024 numbers, pair by pair?', answer: 128, tol: 0, unit: 'instructions',
            why: 'Each instruction adds 8 pairs at once, so 1,024 ÷ 8 = 128 instructions. A scalar core would need 1,024.' },
          { type: 'num', q: 'A chip has 1 billion transistors. If the count doubles every two years, about how many billion transistors will a chip have 10 years later?', answer: 32, tol: 0, unit: 'billion',
            why: 'Ten years is five doublings: 1 × 2 × 2 × 2 × 2 × 2 = 2⁵ = 32 billion. This steady doubling is Moore’s law.' },
          { type: 'match', q: 'Match each processing unit to the job it does best.',
            pairs: [['CPU core', 'Running branchy, general-purpose code such as a compiler'], ['GPU', 'Shading millions of pixels with the same math'], ['DSP', 'Cleaning up a live stream of audio samples'], ['Hardware accelerator', 'Encrypting data with one fixed algorithm']],
            why: 'Each unit trades flexibility for efficiency: the CPU core runs anything, the GPU repeats math over huge arrays, the DSP keeps up with timed streams, and an accelerator does one fixed job.' },
          { type: 'bucket', q: 'Does each job suit SIMD (the same operation on many independent items) or not?', buckets: ['Suits SIMD', 'Gains little from SIMD'],
            items: [['Brighten every pixel of a photo', 0], ['Add two lists of a million numbers', 0], ['Multiply the big number grids inside a neural network', 0], ['Walk a chain of records where each step needs the address found in the one before', 1], ['Parse a typed command full of if-statements', 1]],
            why: 'SIMD needs many independent items that all get the same operation. Chains of dependent steps and branch-heavy logic cannot be spread across lanes.' },
          { type: 'multi', q: 'Which of these can be integrated into a smartphone’s system on a chip (SoC)?',
            choices: ['CPU cores', 'Cache memory shared by the cores', 'A GPU', 'DSPs', 'A cellular modem and radio', 'Main memory, stacked in the same package', 'The touchscreen panel itself'], answer: [0, 1, 2, 3, 4, 5],
            why: 'An SoC combines CPU cores, caches, a GPU, DSPs, accelerators and I/O such as radios and codecs, with main memory stacked in the same package. It contains the display controller that drives the screen, but the glass touchscreen panel is a separate part of the phone.' },
          { q: 'Which statement best describes how SIMD hardware is used today?',
            choices: ['GPUs, built for graphics, now also run physics and machine learning, and most CPU cores have vector units too.', 'GPUs only draw graphics; scientific and AI number crunching runs on ordinary CPU cores instead.', 'Only GPUs can do SIMD; a CPU core always handles exactly one number per instruction.', 'GPUs have replaced CPU cores in most computers, because SIMD speeds up every kind of program.'], answer: 0,
            feedback: [null, 'GPUs are now general-purpose vector processors: their thousands of lanes suit physics simulations and training AI models, not just pixels.', 'Most CPU cores now include vector units that apply one instruction to 4, 8 or 16 numbers at once.', 'SIMD helps only when the same operation applies to many independent items. Branchy code, including the OS itself, still runs best on CPU cores.'],
            why: 'SIMD applies one instruction to many data items. GPUs are built from a huge number of SIMD lanes, which suits any big, repetitive array job, and CPU cores add smaller vector units for the same reason.' },
          { q: 'Compared with running the same job as software on a CPU core, a hardware accelerator is usually:',
            choices: ['faster and far more energy-efficient, but able to do only its one job', 'slower, but able to run any program', 'faster only because it runs at a higher clock speed', 'the same thing as a GPU'], answer: 0,
            feedback: [null, 'That describes a CPU core: flexible but less efficient. An accelerator is the specialist.', 'Its advantage comes from circuitry built for one task, not from a faster clock.', 'A GPU is programmable and handles many kinds of array math. An accelerator is fixed-function.'],
            why: 'An accelerator is circuitry designed for one task, such as encryption, compression or video decoding. That specialisation buys speed and large energy savings at the cost of flexibility.' },
          { type: 'tf', q: 'Most desktop PCs use x86 processors, while nearly every smartphone uses ARM processor cores.', answer: true,
            why: 'The x86 family began with Intel’s 8086 in 1978 and dominates PCs and servers (Intel and AMD build it). ARM designs are licensed to many chip makers and power nearly all phones, and a growing number of laptops and servers.' },
        ],
      },
    ],

    notes: `
<h3>1. What a microprocessor is</h3>
<p>A <b>microprocessor</b> is a complete processor (arithmetic, registers and control) on a <b>single chip</b> of silicon. Before 1971 a processor was built from many separate chips (earlier still, from transistors or vacuum tubes) spread over several boards. The first commercial microprocessor (1971) held about 2,300 transistors. One chip made processors small, cheap and fast, which made desktop and then handheld computers possible, and microprocessors became the fastest general-purpose processors ever built. Three eras: a processor made of many chips; a one-chip CPU with memory, graphics, sound and modem on separate chips or cards; today’s <b>system on a chip (SoC)</b>.</p>

<h3>2. Fifty years of evolution</h3>
<ul>
<li><b>More transistors.</b> A transistor is a tiny electrically controlled switch. The count per chip roughly doubles every two years (<b>Moore’s law</b>): count after <i>n</i> years ≈ start × 2<sup>n/2</sup>. Example: 1 billion, 10 years later → 2<sup>5</sup> = 32 billion. From 2,300 in 1971, 25 doublings give ≈ 77 billion by 2021; real chips reached 16 billion (2020) and 92 billion (2023).</li>
<li><b>Faster clocks, for a while.</b> Clock speed (cycles per second, in hertz) rose about 5,000-fold, from 0.74 MHz (1971) to 3.8 GHz (2004), then stalled near 3–4 GHz: the <b>power wall</b>. Power rises steeply with clock speed (faster switching also needs a higher voltage), and chips could not shed the heat.</li>
<li><b>Then more cores.</b> From the mid-2000s extra transistors became extra cores (2, 4, 8, 16…) and specialised units.</li>
<li><b>Deeper caches.</b> Early chips had no cache; on-chip caches arrived around 1989. One level (L1) by 1993, two by 2000, a shared third by 2008, because processors sped up far faster than main memory.</li>
<li><b>Two big families.</b> <b>x86</b> began with Intel’s 8086 (1978) and dominates PCs and servers (Intel, AMD). <b>ARM</b> designs are licensed to many chip makers and run nearly every smartphone, plus a growing number of laptops and servers.</li>
</ul>
<table>
<tr><th>Year</th><th>Chip</th><th>Transistors</th><th>Clock</th><th>Cores</th><th>Cache levels</th></tr>
<tr><td>1971</td><td>Intel 4004</td><td>2,300</td><td>740 kHz</td><td>1</td><td>none</td></tr>
<tr><td>1978</td><td>Intel 8086 (x86)</td><td>29,000</td><td>10 MHz</td><td>1</td><td>none</td></tr>
<tr><td>1985</td><td>ARM1 (ARM)</td><td>25,000</td><td>6 MHz</td><td>1</td><td>none</td></tr>
<tr><td>2004</td><td>Late Pentium 4</td><td>125 million</td><td>3.8 GHz</td><td>1 (2 logical)</td><td>L1, L2</td></tr>
<tr><td>2008</td><td>Core i7</td><td>731 million</td><td>3.2 GHz</td><td>4 (8 logical)</td><td>L1, L2, L3</td></tr>
<tr><td>2023</td><td>Apple M3 Max (ARM)</td><td>92 billion</td><td>4.05 GHz</td><td>16</td><td>L1, L2, L3</td></tr>
</table>
<p><small>All values approximate and rounded.</small></p>

<h3>3. Inside a modern multicore chip</h3>
<ul>
<li><b>Cores:</b> each is a complete processor with its own registers, control logic and <b>execution units</b> (for example two integer units “Int” for whole-number math, a floating-point unit “FP” for numbers with fractions, and a load/store unit “Ld/St” that moves data between memory and registers).</li>
<li><b>Cache levels:</b> on a typical recent laptop or desktop chip, each core has a private <b>L1</b> (about 32–64 KB, ~4–5 cycles) and <b>L2</b> (256 KB–2 MB, ~12–16 cycles); all cores share a large <b>L3</b> (8–64 MB, ~30–70 cycles). Main memory, reached through the on-chip memory controller, takes ~80–100 ns: hundreds of cycles.</li>
<li><b>Logical processors:</b> a <b>thread</b> is one independent stream of instructions being carried out. With <b>simultaneous multithreading (SMT)</b>, one core holds the registers of two threads and presents two <b>logical processors</b> (hardware threads) sharing its execution units. Logical processors = cores × threads per core: 4 × 2 = 8; 6 × 2 = 12.</li>
</ul>
<p>Why SMT helps: one thread often leaves units idle, especially while it waits for memory; a second thread fills those slots. In the toy example thread A alone used 11 of 32 slots (34%); with a second thread, 21 of 32 (66%). Real gains are usually around 10–30%, because the threads also compete for the same units and caches. <b>Common mistake:</b> two logical processors are not two cores.</p>
<h3>4. GPUs and SIMD</h3>
<p><b>SIMD</b> (single instruction, multiple data): one instruction performs the same operation on many data items at once, each in its own <b>lane</b>. An ordinary <b>scalar</b> instruction handles one item. With L lanes, N items need N ÷ L instructions: 16 numbers with 4 lanes → 4; 1,024 with 8 lanes → 128; brightening a 4K grey image (3840 × 2160 = 8,294,400 pixels, one add each) with 16 lanes → 518,400.</p>
<p>A <b>GPU</b> is built from a very large number of SIMD lanes. Designed for graphics (every pixel gets the same math), GPUs now also serve as general-purpose vector processors for physics simulations and machine learning (huge grids of multiply-adds). Most CPU cores also include <b>vector units</b> that do SIMD on 4 to 16 numbers. <b>Common mistake:</b> SIMD helps only when the same operation applies to many independent items; branchy code, or steps that each need the previous result, gain little.</p>

<h3>5. DSPs and hardware accelerators</h3>
<p>A <b>digital signal processor (DSP)</b> handles <b>streams</b> of samples (audio, radio, video) arriving at a fixed rate. It repeats the same multiply-and-add arithmetic on every sample and must finish each chunk before the next arrives. DSPs are embedded <b>coprocessors</b> in modems, in encoding and decoding speech and video (<b>codecs</b>), and in encryption and security hardware.</p>
<p>A <b>hardware accelerator</b> is a circuit for one specific job, such as encryption, compression, video coding or running AI models. It cannot run other code, but its specialised circuitry (not a faster clock) makes it much faster and far more energy-efficient than software on a CPU core.</p>
<p>A phone call: the microphone is sampled 16,000 times a second (320 samples × 16 bits = 5,120 bits every 20 ms); the audio DSP removes noise and encodes the chunk to about 250 bits; the modem’s encryption hardware scrambles it; the modem’s DSPs add error correction and form the radio waveform; the radio transmits. Incoming speech takes the reverse path, and the main CPU cores can sleep through most of the call.</p>

<h3>6. The system on a chip</h3>
<p>A smartphone <b>SoC</b> puts on one die (one piece of silicon): performance and efficiency CPU cores, shared cache, a GPU, an AI engine, a camera image processor, a video codec, an audio/sensor DSP, a security engine, display and I/O controllers, often the cellular modem, and a memory controller. Main memory (DRAM) is a separate die stacked on top in the same <b>package</b>. The display controller is on the chip; the touchscreen panel is not. Why one chip: shorter wires are faster and use less energy, one part is cheaper than many, and all units share one pool of memory. Trade-off across the chip: CPU core (runs any program) → GPU → DSP → accelerator (one job, least energy).</p>

<h3>7. Matching jobs to units</h3>
<table>
<tr><th>Unit</th><th>Best at</th><th>Examples</th></tr>
<tr><td>CPU core</td><td>branchy, varied, general-purpose logic</td><td>compiling code; the OS scheduler</td></tr>
<tr><td>GPU</td><td>the same math over huge arrays</td><td>rendering 3D scenes; physics of a million particles; training a neural-network layer</td></tr>
<tr><td>DSP</td><td>steady streams of samples with deadlines</td><td>decoding call audio; filtering microphone noise</td></tr>
<tr><td>Accelerator</td><td>one fixed, very common job</td><td>encrypting messages; decoding video</td></tr>
</table>
<p><b>Why the OS cares:</b> every unit is a shared resource. The <b>scheduler</b> (the part of the OS that decides which thread runs next, and where) treats each logical processor as a CPU it can run a thread on, and through device drivers the OS queues work for the GPU, DSPs and accelerators.</p>`,
  });
})();
