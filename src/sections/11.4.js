/* =====================================================================
   11.4 I/O Buffering
   Original teaching material. Shared helpers live inside this IIFE (no globals).
   One timing model drives every timeline, number and caption in the section.
   ===================================================================== */
(function () {
  /* simBuf(N, T, C, M, n): the process reads n blocks, one after another, and computes C ms on each.
     N = 0  no buffer: the device reads straight into the process's own area (T), then the process computes.
     N >= 1 N system buffers: the device fills buffer (k mod N) as soon as that buffer is empty and the device
            is free; the process waits until its next block is in a buffer, copies it out (M), then computes.
     Returns per-block times and the steady-state time per block (the gap between completions n-1 and n). */
  function simBuf(N, T, C, M, n) {
    const B = [];
    for (let k = 0; k < n + 4; k++) {
      const req = k ? B[k - 1].cE : 0;
      let dS, dE, mS, mE;
      if (N === 0) { dS = req; dE = dS + T; mS = dE; mE = dE; }
      else {
        dS = Math.max(k ? B[k - 1].dE : 0, k >= N ? B[k - N].mE : 0);
        dE = dS + T; mS = Math.max(dE, req); mE = mS + M;
      }
      B.push({ k: k + 1, buf: N ? k % N : -1, req, dS, dE, mS, mE, cE: mE + C });
    }
    // steady state: the cycle that ends with block n; four extra blocks are simulated after it,
    // so the device's read-ahead of the following blocks is part of the measurement (n >= 2)
    const a = B[n - 2].cE, b = B[n - 1].cE, per = b - a;
    const ov = (s, e) => Math.max(0, Math.min(e, b) - Math.max(s, a));
    let wait = 0, busy = 0;
    B.forEach((x) => { wait += ov(x.req, x.mS); busy += ov(x.dS, x.dE); });
    return { N, T, C, M, blocks: B, per, wait, devIdle: per - busy };
  }

  // process and device segments of one run, clipped to [0, win]
  function segments(run, win) {
    const P = [], D = [];
    const add = (arr, s, e, kind, k) => { if (e > s && s < win) arr.push({ s, e: Math.min(e, win), kind, k }); };
    let lastD = 0;
    run.blocks.forEach((x) => {
      add(P, x.req, x.mS, 'wait', x.k);
      add(P, x.mS, x.mE, 'copy', x.k);
      add(P, x.mE, x.cE, 'comp', x.k);
      add(D, lastD, x.dS, 'idle', x.k);
      add(D, x.dS, x.dE, 'read', x.k);
      lastD = x.dE;
    });
    return { P, D };
  }

  const fmt = (v) => (Math.round(v * 10) / 10).toString();
  // whoWaits(run): one sentence about who loses time in the steady state, from the run's own numbers
  function whoWaits(r) {
    const w = fmt(r.wait), id = fmt(r.devIdle);
    if (r.wait === 0 && r.devIdle === 0) return 'Neither side ever waits: the two are perfectly matched.';
    if (r.wait === 0) return `The process never waits for I/O; the device rests ${id} ms per block.`;
    if (r.devIdle === 0) return `The device never rests; the process waits ${w} ms per block.`;
    return `Both lose time: the process waits ${w} ms and the device rests ${id} ms per block.`;
  }
  // whoShort(run): the same facts in a few words, for a timeline label
  function whoShort(r) {
    const w = r.wait === 0 ? 'process never waits' : `process waits ${fmt(r.wait)}`, d = r.devIdle === 0 ? 'device never rests' : `device rests ${fmt(r.devIdle)}`;
    return `${w} · ${d}`;
  }
  /* makeRing(N, B, P, T): a ring of N system buffers between a device and a process, simulated 1 ms at a time.
     The device reads one block in T ms into the next empty slot (and idles when none is empty).
     The process repeats: compute for P ms, then take B blocks back to back (1 ms each).
     step() advances 1 ms and returns true if the process spent that millisecond waiting for a block. */
  function makeRing(N, B, P, T) {
    // the process starts with a compute pause, so the device gets a head start (as after opening a file)
    const st = { slots: Array(N).fill(null), inI: 0, outI: 0, dev: 0, take: 0, phase: P > 0 ? 'compute' : 'burst', left: P > 0 ? P : B, waited: 0, got: 0, t: 0, nextBlock: 1 };
    // starts(): at a millisecond boundary, the idle device starts on an empty slot and a bursting process takes a ready block
    function starts() {
      const sl = st.slots;
      if (!st.dev && !sl[st.inI]) { sl[st.inI] = { k: st.nextBlock++, s: 'filling' }; st.dev = T; }
      if (st.phase === 'burst' && !st.take && sl[st.outI] && sl[st.outI].s === 'full') { sl[st.outI].s = 'taking'; st.take = 1; }
    }
    function step() {
      const sl = st.slots;
      starts();
      let waited = false;
      if (st.dev && --st.dev === 0) { sl[st.inI].s = 'full'; st.inI = (st.inI + 1) % N; }
      if (st.take) {
        if (--st.take === 0) {
          sl[st.outI] = null; st.outI = (st.outI + 1) % N; st.got++;
          if (--st.left === 0) { if (P > 0) { st.phase = 'compute'; st.left = P; } else st.left = B; }
        }
      } else if (st.phase === 'burst') { waited = true; st.waited++; }
      else if (--st.left === 0) { st.phase = 'burst'; st.left = B; }
      st.t++;
      starts(); // so the state shown between steps already includes the work that starts right now
      return waited;
    }
    starts();
    return { st, step };
  }
  // longRun(N, B, P, T): percent of time the process waits once the ring has settled (second half of 4,000 ms)
  function longRun(N, B, P, T) {
    const r = makeRing(N, B, P, T);
    let w = 0;
    for (let i = 0; i < 4000; i++) if (r.step() && i >= 2000) w++;
    return Math.round(w / 20 * 10) / 10;
  }
  const perSec = (ms) => (ms > 0 ? Math.round(1000 / ms) : 0);

  /* lanes(ctx, rows, o): draws timelines. rows = [{ label, run }]; each row gets a process lane and a device lane.
     o = { win (ms), W (viewBox width), labelW, laneH, rowGap, cursor (ms or null), tick (ms) } */
  function lanes(ctx, rows, o) {
    const { s } = ctx;
    const W = o.W, LW = o.labelW, LH = o.laneH, RG = o.rowGap, top = 4, x0 = LW, x1 = W - 10;
    const X = (t) => x0 + (x1 - x0) * (t / o.win);
    const kids = [];
    const HD = rows.some((r) => r.label) ? 20 : 0, rowH = HD + LH * 2 + 6;
    rows.forEach((r, ri) => {
      const y0 = top + ri * (rowH + RG), y = y0 + HD;
      if (r.label) kids.push(s('text', { x: 4, y: y0 + 14, 'font-size': 14.5, 'font-weight': 800 }, r.label));
      if (r.note) kids.push(s('text', { x: x1, y: y0 + 14, 'font-size': 13.5, 'text-anchor': 'end', 'font-weight': 700, style: 'fill:var(--ink-2)' }, r.note));
      kids.push(s('text', { x: LW - 8, y: y + LH * 0.5 + 5, 'font-size': 13, 'text-anchor': 'end', style: 'fill:var(--proc)', 'font-weight': 700 }, 'process'));
      kids.push(s('text', { x: LW - 8, y: y + LH * 1.5 + 11, 'font-size': 13, 'text-anchor': 'end', style: 'fill:var(--io)', 'font-weight': 700 }, 'device'));
      const sg = segments(r.run, o.win);
      const lim = o.cursor == null ? o.win : o.cursor;
      const draw = (seg, yy) => {
        if (seg.s >= lim) return;
        const e = Math.min(seg.e, lim), xa = X(seg.s), xb = X(e), w = xb - xa;
        const cls = { comp: 's-proc', copy: 's-os', wait: 's-bad', read: 's-io', idle: 's-panel' }[seg.kind];
        kids.push(s('rect', { x: xa, y: yy, width: Math.max(w, 0.5), height: LH, rx: 3, class: cls, 'stroke-width': 1.2, 'stroke-dasharray': seg.kind === 'idle' || seg.kind === 'wait' ? '4 3' : null }));
        const lab = seg.kind === 'idle' ? '' : seg.kind === 'wait' ? (w > 46 ? 'wait' : '') : (w >= 15 ? String(seg.k) : '');
        if (lab) kids.push(s('text', { x: xa + w / 2, y: yy + LH / 2 + 5, 'font-size': 13, 'text-anchor': 'middle', 'font-weight': 700, style: seg.kind === 'wait' ? 'fill:var(--bad)' : null }, lab));
      };
      sg.P.forEach((g) => draw(g, y));
      sg.D.forEach((g) => draw(g, y + LH + 6));
    });
    const yAxis = top + rows.length * (rowH + RG) - RG + 6;
    kids.push(s('line', { x1: x0, y1: yAxis, x2: x1, y2: yAxis, class: 's-muted' }));
    for (let t = 0; t <= o.win + 1e-9; t += o.tick) {
      kids.push(s('line', { x1: X(t), y1: yAxis, x2: X(t), y2: yAxis + 5, class: 's-muted' }));
      kids.push(s('text', { x: X(t), y: yAxis + 19, 'font-size': 13, 'text-anchor': 'middle', class: 's-sub' }, t + (t === 0 ? ' ms' : '')));
    }
    if (o.cursor != null) kids.push(s('line', { x1: X(o.cursor), y1: 0, x2: X(o.cursor), y2: yAxis, style: 'stroke:var(--accent)', 'stroke-width': 2 }));
    return { kids, height: yAxis + 24 };
  }

  Guide.section({
    id: '11.4',
    title: 'I/O Buffering',
    short: 'I/O buffering',
    summary: 'Buffers let the OS read ahead and write behind, so slow devices and busy processes wait less.',
    objectives: [
      'Explain why the OS moves data through its own buffers instead of straight into a process’s memory, including locked pages and single-process deadlock.',
      'Tell block-oriented devices from stream-oriented devices and match each to a style of buffering.',
      'Compute the time per block with no buffer (T + C), a single buffer (max[C, T] + M) and a double buffer (about max[C, T]), and name the bottleneck.',
      'Describe line-at-a-time and byte-at-a-time buffering and circular buffers, and explain why no number of buffers cures a sustained overload.',
    ],
    terms: [
      ['I/O buffering', 'Letting data wait in a reserved memory area on its way between a device and a process, so input can be fetched before it is asked for and output can be sent after the process has moved on.'],
      ['System buffer', 'A buffer in the operating system’s own memory, outside every process’s address space, where data waits on its way between a device and a process.'],
      ['Block-oriented device', 'A device that keeps data in fixed-size blocks, moves one whole block per transfer and lets the OS ask for any block by its number. Disks, SSDs and USB flash drives are examples.'],
      ['Stream-oriented device', 'A device that sends or accepts data as a flow of bytes with no block structure and no block numbers. Keyboards, mice, printers and communication ports are examples.'],
      ['Single-process deadlock', 'A standstill that needs only one process: it waits for its I/O to finish, while the I/O waits for the process’s swapped-out memory to come back.'],
      ['Single buffering', 'Using one system buffer: the OS transfers the next block into it while the process works on the block it already has.'],
      ['Read-ahead (anticipated input)', 'Starting to read the next block before the process asks for it, betting that it will be wanted soon.'],
      ['Double buffering (buffer swapping)', 'Using two system buffers: the OS fills (or empties) one while the process empties (or fills) the other, and then the two swap roles.'],
      ['Circular buffering', 'Using more than two system buffers arranged in a ring and managed as a bounded buffer, so a process can make rapid bursts of I/O without waiting.'],
      ['Line-at-a-time operation', 'Stream I/O in which the buffer holds one whole line: the process is handed input only when a complete line, ended by Enter, has arrived.'],
      ['Byte-at-a-time operation', 'Stream I/O in which each character is handed over the moment it arrives, because every keystroke may matter.'],
      ['Scroll-mode terminal', 'A terminal where the user types and edits a line, then sends it with Enter; finished lines scroll up the screen.'],
      ['Forms-mode terminal', 'A terminal that shows a form with fields; each keystroke can matter at once, for example Tab jumping to the next field.'],
      ['Bottleneck', 'The slowest stage in a chain of work. It sets the pace, so speeding up any other stage does not help.'],
    ],
    css: `
      .sec-11-4 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 14px; font-size: 15.5px; line-height: 1.45; }
      .sec-11-4 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-4 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-4 .mw0, .sec-11-4 .mw0 > * { min-width: 0; }
      .sec-11-4 .sw { display: inline-block; width: 14px; height: 12px; border-radius: 3px; border: 1.5px solid; vertical-align: -1px; margin-right: 5px; }
      .sec-11-4 .sw.comp { background: var(--proc-bg); border-color: var(--proc); }
      .sec-11-4 .sw.copy { background: var(--os-bg); border-color: var(--os); }
      .sec-11-4 .sw.wait { background: var(--bad-bg); border-color: var(--bad); border-style: dashed; }
      .sec-11-4 .sw.read { background: var(--io-bg); border-color: var(--io); }
      .sec-11-4 .sw.idle { background: var(--panel-2); border-color: var(--line-2); border-style: dashed; }
      .sec-11-4 .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 14px; color: var(--ink-2); }
      .sec-11-4 table.tbl td, .sec-11-4 table.tbl th { padding: 5px 9px; }
      .sec-11-4 .ui-slider { margin: 0; }
      .sec-11-4 .b11-path { display: flex; flex-direction: column; align-items: stretch; gap: 0; }
      .sec-11-4 .b11-arrow { text-align: center; color: var(--muted); font-size: 16px; line-height: 18px; }
      .sec-11-4 .b11-stop { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 8px 14px; border-radius: 10px; border: 2px solid; cursor: pointer; font: inherit; color: var(--ink); text-align: left; }
      .sec-11-4 .b11-stop .nm { font-weight: 800; }
      .sec-11-4 .b11-stop .sub { font-size: 14px; color: var(--ink-2); }
      .sec-11-4 .b11-stop.io { border-color: var(--io); background: var(--io-bg); }
      .sec-11-4 .b11-stop.os { border-color: var(--os); background: var(--os-bg); }
      .sec-11-4 .b11-stop.mem { border-color: var(--mem); background: var(--mem-bg); }
      .sec-11-4 .b11-stop.proc { border-color: var(--proc); background: var(--proc-bg); }
      .sec-11-4 .b11-stop.on { outline: 3px solid var(--accent); outline-offset: 2px; }
      .sec-11-4 .b11-sort { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .sec-11-4 .b11-dev { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--panel-2); min-width: 0; }
      .sec-11-4 .b11-dev .nm { font-weight: 700; font-size: 15px; line-height: 1.25; }
      .sec-11-4 .b11-dev.right { border-color: var(--ok); background: var(--ok-bg); }
      .sec-11-4 .b11-dev.wrong { border-color: var(--bad); background: var(--bad-bg); }
      .sec-11-4 table.b11-lab td, .sec-11-4 table.b11-lab th { font-size: 14px; padding: 5px 6px; white-space: nowrap; }
      .sec-11-4 .b11-term { min-height: 44px; padding: 8px 10px; border-radius: 8px; background: var(--panel); border: 1px solid var(--line); font-size: 16px; line-height: 1.6; overflow-wrap: anywhere; }
      .sec-11-4 .b11-tok { display: inline-block; padding: 0 6px; margin: 1px 0; border-radius: 6px; background: var(--proc-bg); border: 1px solid var(--proc); }
      .sec-11-4 .b11-flow { display: grid; grid-template-columns: minmax(0, 1fr) 28px minmax(0, 1.3fr); align-items: stretch; gap: 6px; }
      .sec-11-4 .b11-to { display: grid; place-items: center; font-size: 22px; color: var(--muted); }
      .sec-11-4 .b11-lbuf { flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; border: 2px dashed var(--line-2); background: var(--panel-2); display: flex; flex-direction: column; gap: 2px; }
      .sec-11-4 .b11-lbuf.full { border-style: solid; border-color: var(--os); background: var(--os-bg); }
      .sec-11-4 .b11-lbuf.printing { border-style: solid; border-color: var(--io); background: var(--io-bg); }
      .sec-11-4 .b11-pred { display: grid; grid-template-columns: 120px auto minmax(0, 1fr); gap: 6px 12px; align-items: center; }
      .sec-11-4 .b11-num { width: 74px; font: inherit; font-size: 16px; padding: 4px 8px; border: 1.5px solid var(--line-2); border-radius: 8px; background: var(--panel); color: var(--ink); }
      .sec-11-4 .b11-dev .btn.on { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
    `,
    steps: [
      {
        title: 'Who waits, and where does the data land?',
        kind: 'story',
        html: `
          <div class="split r fill mw0">
            <div class="stack" style="gap:10px">
              <p class="lead m0">A disk needs milliseconds to deliver one block. In a single millisecond a processor can run millions of instructions.</p>
              <p class="m0">So every read and write raises two questions. <b>Who waits?</b> A program that stops until its block arrives wastes processor time. <b>Where does the data land?</b> If it lands in the program’s own memory, that memory is tied up until the transfer ends.</p>
              <p class="m0"><span class="t">I/O buffering</span> answers both. The OS passes data through buffers in its own memory, starting input transfers <b>before</b> the program asks and finishing output transfers <b>after</b> it has moved on, so speed differences are smoothed out.</p>
              <div class="callout why m0" data-label="Why it matters">Buffering is one of the tools that let <span class="t">multiprogramming</span> work well: while one program’s data is on its way, the processor and the program’s memory stay free for other work.</div>
              <div class="callout analogy m0" data-label="Analogy">A courier brings a book series one volume at a time. With no mailbox, you order volume 2 only after finishing volume 1, then wait. With one mailbox, the next volume is ordered as soon as you empty the box, so it is often there when you are ready. With two, the courier can drop one off while you are still unpacking the last.</div>
            </div>
            <div class="card white stack" style="gap:8px">
              <h4 class="m0">The path of one block of input (click each stop)</h4>
              <div class="b11-path"></div>
              <div class="narr b11-info" style="min-height:96px"></div>
              <p class="small muted m0">Coming up: the danger of reading straight into a program’s memory, block versus stream devices, three timing formulas and a lab, terminals, and rings of buffers.</p>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const stops = [
            ['io', 'Device', 'disk, keyboard, network card…', 'The <b>device</b> works at its own pace. Call the time it needs to deliver one block <b>T</b>. Nothing the processor does can make it faster.'],
            ['os', 'System buffer', 'memory owned by the OS', 'A <span class="t">system buffer</span> lives in the OS’s own memory, outside every process. The device fills it without touching the program’s memory, so the program may even be swapped out while it waits.'],
            ['mem', 'The program’s own area', 'e.g. addresses 4096–4607', 'This is where the program wants the data. Copying one block from the system buffer to here costs a little time, called <b>M</b> (move time).'],
            ['proc', 'The process', 'computes, then asks again', 'The <span class="t" data-t="process">process</span> spends <b>C</b> ms computing on each block, then asks for the next. Whether it ever waits depends on T, C, M and how many buffers the OS keeps.'],
          ];
          const path = el.querySelector('.b11-path'), info = el.querySelector('.b11-info');
          const btns = [];
          function pick(i) {
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            info.innerHTML = stops[i][3];
          }
          stops.forEach(([c, name, sub], i) => {
            const b = h('button', { type: 'button', class: 'b11-stop ' + c, onclick: () => pick(i) },
              h('span', { class: 'nm' }, name), h('span', { class: 'sub' }, sub));
            btns.push(b);
            if (i) path.append(h('div', { class: 'b11-arrow', 'aria-hidden': 'true' }, '↓'));
            path.append(b);
          });
          pick(0);
        },
      },
      {
        title: 'Why not read straight into the program’s memory?',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const SM = ctx.narrow;
          // geometry for the wide canvas and for a slim phone screen
          const L = SM ? {
            W: 360, H: 386, disk: [10, 8, 165, 104], swap: [185, 8, 165, 104], mem: [10, 124, 340, 252],
            fr: [[180, 206], [180, 152], [180, 260], [180, 314]], fw: 156, fh: 50, kern: [20, 152, 150, 212], buf: [28, 214, 134, 62],
            arrFrame: [150, 112, 222, 146], arrBuf: [140, 112, 140, 208], copy: [162, 246, 176, 196], copyLab: [28, 206],
          } : {
            W: 600, H: 470, disk: [10, 10, 250, 130], swap: [340, 10, 250, 130], mem: [10, 160, 580, 300],
            fr: [[426, 200], [262, 200], [262, 334], [426, 334]], fw: 150, fh: 100, kern: [24, 196, 222, 250], buf: [38, 300, 194, 70],
            arrFrame: [210, 140, 300, 194], arrBuf: [130, 140, 130, 294], copy: [234, 335, 258, 285], copyLab: [38, 290],
          };
          const INIT = [['P · page 0', 'code', 's-proc'], ['P · page 1', '4096–4607', 's-proc'], ['Q · page 3', '', 's-panel'], ['R · page 0', '', 's-panel']];
          const SWAPPED = [['S · page 0', 'swapped in', 's-panel'], ['S · page 1', 'swapped in', 's-panel']];
          const DESIGNS = [
            { value: 0, label: 'Direct, unlocked' },
            { value: 1, label: 'Direct, locked' },
            { value: 2, label: 'System buffer' },
          ];
          let design = 0;
          // state(d, i): what the picture shows for design d at frame i
          function state(d, i) {
            const st = { frames: INIT.map((f) => f.slice()), swap: [], disk: 'Q, R, then P: block 7', arrow: null, buf: d === 2 ? 'reserved for P' : null, p: ['Blocked', 'warn'], lock: d === 1 && i < 4, copy: false, tone: '' };
            st.arrow = { to: d === 2 ? 'buf' : 1, kind: 'plan' };
            if (i === 1) st.flagSwap = true;
            if (i >= 2) {
              if (d === 1) { st.frames[0] = SWAPPED[0].slice(); st.swap = ['P · page 0']; st.p = ['Blocked, half swapped out', 'warn']; }
              else { st.frames[0] = SWAPPED[0].slice(); st.frames[1] = SWAPPED[1].slice(); st.frames[1][1] = 'was P’s page 1'; st.swap = ['P · page 0', 'P · page 1']; st.p = ['Blocked, swapped out', 'warn']; }
              st.disk = 'R, then P: block 7';
            }
            if (i >= 3) {
              st.disk = 'serving P: block 7';
              if (d === 0) { st.arrow = { to: 1, kind: 'stuck' }; st.p = ['Blocked, swapped out', 'bad']; st.tone = 'bad'; }
              if (d === 1) { st.arrow = { to: 1, kind: 'flow' }; st.frames[1][1] = '4096–4607: block 7'; }
              if (d === 2) { st.arrow = { to: 'buf', kind: 'flow' }; st.buf = 'block 7, for P'; }
            }
            if (i >= 4) {
              if (d === 0) { st.disk = 'stuck on P: block 7'; }
              if (d === 1) { st.arrow = null; st.disk = 'idle'; st.p = ['Ready', 'ok']; st.tone = 'ok'; }
              if (d === 2) { st.arrow = null; st.disk = 'idle'; st.frames = INIT.map((f) => f.slice()); st.frames[1][1] = '4096–4607: block 7'; st.swap = []; st.copy = true; st.buf = 'block 7, for P'; st.p = ['Ready', 'ok']; st.tone = 'ok'; }
            }
            return st;
          }
          const CAP = [
            [
              '<b>1.</b> P calls <code>read</code> and asks for block 7 to land at addresses 4096–4607 of its own memory (the start of page 1, with 4 KB pages). P becomes <b>Blocked</b>. The disk is busy, so the request waits in its queue.',
              '<b>2.</b> Memory runs short and the OS must swap a process out. A Blocked process is the obvious choice: it cannot use the processor anyway.',
              '<b>3.</b> P is swapped out, page 1 included. Its frames now hold another process’s pages. The request still says “put the data in P’s page 1”.',
              '<b>4.</b> The disk reaches P’s request, but the target page is not in memory. Writing into the old frame would wreck another process’s data, so the transfer must wait for P to come back. P, though, is Blocked waiting for this very transfer.',
              '<b>5.</b> <b>Stuck forever.</b> The I/O waits for P’s page; P waits for the I/O. One process is enough for this <span class="t">single-process deadlock</span>. To prevent it, the page must be locked before the request is issued, or the data must go somewhere else.',
            ],
            [
              '<b>1.</b> P asks for block 7 at addresses 4096–4607. Before issuing the request the OS <b>locks</b> page 1 (<span class="t" data-t="frame locking">frame locking</span>), so that page cannot leave memory until the transfer ends.',
              '<b>2.</b> Memory runs short. The OS would like to swap P out, since it is Blocked.',
              '<b>3.</b> It can only do part of the job. Page 0 goes to disk, but locked page 1 must stay. P cannot be swapped out completely, so its frame stays tied up however long the disk queue is.',
              '<b>4.</b> The disk reaches P’s request and writes block 7 straight into the locked frame. It works.',
              '<b>5.</b> P becomes <b>Ready</b> and the OS unlocks the page. Safe, but the frame was pinned for the whole wait, and the OS lost the freedom to swap P out. With many processes doing I/O, much of memory can end up locked.',
            ],
            [
              '<b>1.</b> P asks for block 7. This time the OS reserves a <span class="t">system buffer</span> in its own memory and points the transfer there. P’s pages stay free to move.',
              '<b>2.</b> Memory runs short. The OS can pick P, because no transfer targets P’s memory.',
              '<b>3.</b> P is swapped out completely. The system buffer stays where it is, waiting for the disk.',
              '<b>4.</b> The disk reaches P’s request and writes block 7 into the system buffer. P’s memory is not involved at all.',
              '<b>5.</b> The I/O is done, so P waits for nothing (Ready/Suspend while still on disk). The OS swaps it back in, copies block 7 from the buffer into 4096–4607, and P is <b>Ready</b>. The price: one extra copy (time <b>M</b>) and bookkeeping about which buffer belongs to whom.',
            ],
          ];
          const svg = s('svg', { viewBox: `0 0 ${L.W} ${L.H}`, width: '100%', style: { maxHeight: SM ? null : '100%' } });
          const pChip = h('span', { class: 'chip' });
          const dChip = h('span', { class: 'chip io' });
          const box = ([x, y, w, hh], cls, extra = {}) => s('rect', Object.assign({ x, y, width: w, height: hh, rx: 12, class: cls, 'stroke-width': 2 }, extra));
          const txt = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'font-size': 14 }, o), t);
          function draw(i) {
            const st = state(design, i), k = [];
            const [dx, dy, dw, dh] = L.disk, [sx, sy, sw] = L.swap, [mx, my, mw] = L.mem;
            k.push(box(L.disk, 's-io'), txt(dx + 12, dy + 24, 'Disk', { 'font-weight': 800, 'font-size': 15 }));
            k.push(txt(dx + 12, dy + 50, 'queue:', { class: 's-sub', 'font-size': 13 }));
            st.disk.split(', then ').forEach((line, j, arr) => k.push(txt(dx + 12, dy + 70 + j * 18, line + (j < arr.length - 1 ? ', then' : ''), { 'font-size': 13.5, 'font-weight': 700 })));
            k.push(box(L.swap, 's-io', { 'stroke-dasharray': '6 4' }), txt(sx + 12, sy + 24, 'Swap area (disk)', { 'font-weight': 800, 'font-size': 14 }));
            if (!st.swap.length) k.push(txt(sx + 12, sy + 50, '(empty)', { class: 's-sub', 'font-size': 13 }));
            st.swap.forEach((p, j) => { k.push(box([sx + 10, sy + 36 + j * 34, sw - 20, 28], 's-proc', { rx: 7, 'stroke-width': 1.5 }), txt(sx + 20, sy + 55 + j * 34, p, { 'font-size': 13, 'font-weight': 700 })); });
            k.push(box(L.mem, 's-mem', { style: 'fill:var(--panel-2)' }), txt(mx + 12, my + 22, 'Main memory', { 'font-weight': 800, 'font-size': 15 }));
            st.frames.forEach(([a, b, cls], j) => {
              const [fx, fy] = L.fr[j], locked = st.lock && j === 1, target = j === 1 && st.arrow && st.arrow.to === 1;
              k.push(box([fx, fy, L.fw, L.fh], cls, { rx: 8, 'stroke-width': target || locked ? 3 : 1.5, style: locked ? 'stroke:var(--warn)' : null }));
              k.push(txt(fx + 10, fy + (SM ? 20 : 38), a, { 'font-size': SM ? 13.5 : 15, 'font-weight': 800 }));
              if (b) k.push(txt(fx + (SM ? 8 : 10), fy + (SM ? 40 : 66), b, { 'font-size': 13, class: b.includes('block 7') ? '' : 's-sub', style: b.includes('block 7') ? 'fill:var(--io);font-weight:800' : null }));
              if (locked) k.push(txt(fx + L.fw - 8, fy + (SM ? 20 : 88), 'locked', { 'font-size': 13, 'text-anchor': 'end', 'font-weight': 800, style: 'fill:var(--warn)' }));
            });
            const [kx, ky, kw] = L.kern, [bx, by, bw, bh] = L.buf;
            k.push(box(L.kern, 's-os', { rx: 10, 'stroke-width': 1.5 }), txt(kx + 10, ky + 22, 'OS memory', { 'font-weight': 800, 'font-size': 14, style: 'fill:var(--os)' }));
            if (st.buf) {
              k.push(box(L.buf, 's-os', { rx: 8, style: 'fill:var(--panel)', 'stroke-width': 2 }));
              k.push(txt(bx + bw / 2, by + 20, 'system buffer', { 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }));
              k.push(txt(bx + bw / 2, by + 39, st.buf, { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: st.buf.includes('block 7') ? 'fill:var(--io)' : null }));
            } else k.push(txt(kx + 10, ky + 48, '(no buffer used for P)', { 'font-size': 13, class: 's-sub' }));
            if (st.flagSwap) [0, 1].forEach((j) => { const [fx, fy] = L.fr[j]; k.push(s('rect', { x: fx - 4, y: fy - 4, width: L.fw + 8, height: L.fh + 8, rx: 10, fill: 'none', style: 'stroke:var(--warn)', 'stroke-width': 2.5, 'stroke-dasharray': '5 4' })); });
            if (st.arrow) {
              const [x1, y1, x2, y2] = st.arrow.to === 'buf' ? L.arrBuf : L.arrFrame;
              const kind = st.arrow.kind, col = kind === 'flow' ? 'io' : kind === 'stuck' ? 'bad' : 'muted';
              k.push(s('line', { x1, y1, x2, y2, style: `stroke:var(--${col === 'muted' ? 'muted' : col})`, 'stroke-width': kind === 'plan' ? 2 : 3.5, 'stroke-dasharray': kind === 'plan' ? '6 5' : kind === 'stuck' ? '3 5' : null, 'marker-end': `url(#arr-${col})` }));
              if (kind === 'stuck') { const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2; k.push(s('circle', { cx, cy, r: 13, class: 's-bad', 'stroke-width': 2 }), txt(cx, cy + 5, '✗', { 'text-anchor': 'middle', 'font-weight': 900, style: 'fill:var(--bad)' })); }
            }
            if (st.copy) {
              const [c1, c2, c3, c4] = L.copy;
              k.push(s('line', { x1: c1, y1: c2, x2: c3, y2: c4, style: 'stroke:var(--os)', 'stroke-width': 3.5, 'marker-end': 'url(#arr-os)' }));
              k.push(txt(L.copyLab[0], L.copyLab[1], 'copy (M) →', { 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }));
            }
            svg.replaceChildren(...k);
            pChip.className = 'chip ' + st.p[1]; pChip.textContent = 'P: ' + st.p[0];
            dChip.textContent = 'disk: ' + (i >= 3 && st.arrow ? 'transferring' : i >= 4 ? 'idle' : 'busy with others');
            if (design === 0 && i >= 3) dChip.textContent = 'disk: request stuck';
            return CAP[design][i];
          }
          const player = ctx.ui.player({ count: 5, render: draw, interval: 3200, speed: false });
          const VERDICT = [
            ['bad', 'Verdict', 'Unsafe. No real OS lets a transfer target memory that might be swapped out.'],
            ['warn', 'Verdict', 'Safe, but costly: the locked frame is pinned for the whole wait and the process cannot be swapped out completely.'],
            ['tip', 'Verdict', 'Safe and flexible: the process can be swapped out freely. The cost is one extra copy per block.'],
          ];
          const verdict = h('div', { class: 'callout m0' });
          const showVerdict = () => { const [c, lab, txt2] = VERDICT[design]; verdict.className = 'callout m0 ' + c; verdict.setAttribute('data-label', lab); verdict.innerHTML = txt2; };
          showVerdict();
          const seg = ctx.ui.seg(DESIGNS, 0, (v) => { design = v; showVerdict(); player.stop(); player.go(0); });
          el.append(h('div', { class: 'mw0', style: { display: 'grid', gridTemplateColumns: SM ? '1fr' : '600px minmax(0, 1fr)', gap: '16px', height: SM ? 'auto' : '100%' } },
            h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center', minHeight: 0 } }, svg),
            h('div', { class: 'stack mw0', style: { gap: '10px' } },
              h('p', { class: 'm0' }, 'Process P wants block 7 of a file. Pick where the OS sends the data, then step through what happens when memory runs short.'),
              seg,
              h('div', { class: 'row gap-s' }, pChip, dChip),
              player.el, verdict,
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'First benefit of a system buffer: the transfer no longer pins the process’s memory, so the OS stays free to swap. The second, overlapping waiting with computing, comes next.' }))));
        },
      },
      {
        title: 'Block-oriented or stream-oriented?',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          const DEV = [
            ['Keyboard', 1, 'Keystrokes arrive one character at a time, whenever someone types. There is nothing numbered to ask for again.'],
            ['Hard disk drive', 0, 'It stores fixed-size sectors grouped into numbered blocks, and the OS can ask for any block by its number.'],
            ['Printer', 1, 'The OS sends it a flow of bytes (text or a page description). There is no “block 12 of the printer” to read back.'],
            ['USB flash drive', 0, 'Plugged in, it looks to the OS like a small disk: a store of numbered, fixed-size blocks.'],
            ['Mouse', 1, 'It reports a flow of small movement and click messages as they happen. Nothing is kept to be read back later.'],
            ['Solid-state drive (SSD)', 0, 'It has no moving parts, but it still presents the OS with numbered fixed-size blocks, exactly like a disk.'],
            ['Serial communications port', 1, 'Bytes leave and arrive one after another over the line, with no block structure.'],
            ['SD memory card', 0, 'Like a USB key, it is secondary storage: numbered blocks that can be read and rewritten in any order.'],
            ['Touchscreen', 1, 'Touch positions arrive as a flow of events while the finger moves.'],
            ['Sound output (speakers)', 1, 'Audio leaves as a continuous flow of samples; the OS cannot ask for a numbered block of it.'],
          ];
          const NAMES = ['Block', 'Stream'];
          const ans = DEV.map(() => null);
          const score = h('span', { class: 'chip accent' });
          const fb = h('div', { class: 'narr', style: { minHeight: '74px' }, html: 'Pick <b>Block</b> or <b>Stream</b> for each device. Ask yourself: does it hold fixed-size, numbered blocks that the OS can ask for by number?' });
          const rows = [];
          function paint() {
            const right = ans.filter((a, i) => a === DEV[i][1]).length;
            score.textContent = `${right} / ${DEV.length} right`;
            rows.forEach((r, i) => {
              r.row.classList.toggle('right', ans[i] === DEV[i][1]);
              r.row.classList.toggle('wrong', ans[i] != null && ans[i] !== DEV[i][1]);
              r.btns.forEach((b, j) => { b.classList.toggle('on', ans[i] === j); b.setAttribute('aria-pressed', ans[i] === j); });
            });
            if (right === DEV.length) { fb.className = 'narr ok'; fb.innerHTML = '<b>All ten right.</b> Notice the pattern: the block-oriented devices are all secondary storage. Nearly everything else, from keyboards to printers to ports, is stream-oriented.'; }
          }
          function choose(i, j) {
            ans[i] = j;
            const ok = j === DEV[i][1];
            fb.className = 'narr ' + (ok ? 'ok' : 'bad');
            fb.innerHTML = `<b>${DEV[i][0]}: ${ok ? '✓ ' + NAMES[j] + '-oriented.' : '✗ not ' + NAMES[j].toLowerCase() + '-oriented.'}</b> ${DEV[i][2]}${ok ? '' : ' Try the other button.'}`;
            paint();
          }
          const grid = h('div', { class: 'b11-sort', style: { gridTemplateColumns: ctx.narrow ? '1fr' : null } });
          DEV.forEach(([name], i) => {
            const btns = NAMES.map((n, j) => h('button', { type: 'button', class: 'btn sm', 'aria-pressed': 'false', onclick: () => choose(i, j) }, n));
            const row = h('div', { class: 'b11-dev' }, h('span', { class: 'nm' }, name), h('span', { class: 'row gap-s', style: { flexWrap: 'nowrap' } }, ...btns));
            rows.push({ row, btns });
            grid.append(row);
          });
          const reset = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { ans.fill(null); fb.className = 'narr'; fb.innerHTML = 'Cleared. Pick <b>Block</b> or <b>Stream</b> for each device.'; paint(); } }, 'Reset');
          paint();
          el.append(h('div', { class: 'split l fill mw0' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'card io stack', style: { gap: '4px' }, html: '<h4 class="m0">Block-oriented devices</h4><p class="m0 small">A <span class="t">block-oriented device</span> keeps data in <b>fixed-size blocks</b> and moves one whole block per transfer. Each block has a <b>number</b>, so the OS can say “read block 7,412” and later read the very same block again.</p>' }),
              h('div', { class: 'card proc stack', style: { gap: '4px' }, html: '<h4 class="m0">Stream-oriented devices</h4><p class="m0 small">A <span class="t">stream-oriented device</span> moves a <b>flow of bytes</b> with no block structure. There is no “byte 5,000 of the keyboard” to ask for: data is taken as it comes, in order.</p>' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '“Stream” does not mean “slow”, and “block” does not mean “fast”. The difference is <b>structure</b>: numbered blocks you can ask for, or bytes that simply arrive.' }),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The kind of device shapes the buffer. Block devices are buffered a whole block at a time; stream devices a line or a single byte at a time.' })),
            h('div', { class: 'stack mw0', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Sort the devices'), h('span', { class: 'row gap-s' }, score, reset)),
              grid, fb)));
        },
      },
      {
        title: 'No buffer, one buffer, two buffers: step by step',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const SM = ctx.narrow;
          const T = 10, C = 4, M = 1, WIN = 45;
          const NAMES = ['No buffer', 'Single buffer', 'Double buffer'];
          let N = 1, run, frames;
          const L = SM ? {
            W: 360, H: 296, dev: [10, 8, 340, 64], buf1: [[10, 98, 340, 60]], buf2: [[10, 98, 165, 60], [185, 98, 165, 60]],
            proc: [10, 184, 340, 104], area: [22, 214, 150, 62], stat: [186, 236],
          } : {
            W: 1100, H: 168, dev: [8, 28, 240, 112], buf1: [[340, 28, 240, 112]], buf2: [[340, 6, 240, 72], [340, 90, 240, 72]],
            proc: [672, 10, 420, 148], area: [690, 46, 180, 98], stat: [890, 86],
          };
          const dia = s('svg', { viewBox: `0 0 ${L.W} ${L.H}`, width: '100%' });
          const tl = s('svg', { viewBox: `0 0 ${SM ? 360 : 1100} 100`, width: '100%' });
          const bufName = (j) => (N === 1 ? 'the system buffer' : 'buffer ' + 'AB'[j]);
          function stateAt(t) {
            const B = run.blocks, st = { proc: null, dev: null, bufs: [], area: null };
            B.forEach((x) => {
              if (x.req <= t && t < x.mS) st.proc = ['wait', x];
              else if (x.mS <= t && t < x.mE) st.proc = ['copy', x];
              else if (x.mE <= t && t < x.cE) st.proc = ['comp', x];
              if (x.dS <= t && t < x.dE) st.dev = x;
              if ((N === 0 ? x.dE : x.mE) <= t) st.area = x.k;
            });
            for (let j = 0; j < N; j++) {
              let c = ['empty', null];
              B.forEach((x) => {
                if (x.buf !== j || t < x.dS || t >= x.mE) return;
                c = t < x.dE ? ['filling', x] : t < x.mS ? ['holds', x] : ['copying', x];
              });
              st.bufs.push(c);
            }
            return st;
          }
          const txt = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'font-size': 14 }, o), t);
          const rect = ([x, y, w, hh], cls, o = {}) => s('rect', Object.assign({ x, y, width: w, height: hh, rx: 10, class: cls, 'stroke-width': 2 }, o));
          function drawDia(t) {
            const st = stateAt(t), k = [];
            const [dx, dy, dw, dh] = L.dev;
            k.push(rect(L.dev, 's-io'), txt(dx + 12, dy + 24, 'Device', { 'font-weight': 800, 'font-size': 15 }));
            const dLine = st.dev ? (N === 0 ? `reading block ${st.dev.k} → P’s area` : `reading block ${st.dev.k} → ${N === 1 ? 'buffer' : 'buffer ' + 'AB'[st.dev.buf]}`) : (N === 0 ? 'idle: nothing asked for' : 'idle: no empty buffer');
            k.push(txt(dx + 12, dy + (SM ? 48 : 58), dLine, { 'font-weight': 700, style: st.dev ? 'fill:var(--io)' : 'fill:var(--muted)' }));
            if (!SM) k.push(txt(dx + 12, dy + 84, `T = ${T} ms per block`, { class: 's-sub', 'font-size': 13 }));
            const bufs = N === 1 ? L.buf1 : N === 2 ? L.buf2 : [];
            bufs.forEach((b, j) => {
              const [c, x] = st.bufs[j], [bx, by, bw, bh] = b;
              const cls = c === 'empty' ? 's-panel' : c === 'filling' ? 's-io' : 's-os';
              k.push(rect(b, cls, { 'stroke-dasharray': c === 'filling' ? '6 4' : null }));
              k.push(txt(bx + 10, by + 22, N === 1 ? 'System buffer' : 'Buffer ' + 'AB'[j], { 'font-weight': 800, 'font-size': 14, style: 'fill:var(--os)' }));
              const lab = c === 'empty' ? 'empty' : c === 'filling' ? `filling: block ${x.k}` : c === 'holds' ? `holds block ${x.k}` : `copying out ${x.k}`;
              k.push(txt(bx + 10, by + (bh > 80 ? 60 : 46), lab, { 'font-weight': 700, 'font-size': 14 }));
              // device → buffer arrow
              const fill = st.dev && st.dev.buf === j;
              if (SM) k.push(s('line', { x1: bx + bw / 2, y1: dy + dh, x2: bx + bw / 2, y2: by - 6, style: `stroke:var(--${fill ? 'io' : 'line-2'})`, 'stroke-width': fill ? 3.5 : 2, 'marker-end': `url(#arr-${fill ? 'io' : 'muted'})` }));
              else k.push(s('line', { x1: dx + dw, y1: dy + dh / 2, x2: bx - 6, y2: by + bh / 2, style: `stroke:var(--${fill ? 'io' : 'line-2'})`, 'stroke-width': fill ? 3.5 : 2, 'marker-end': `url(#arr-${fill ? 'io' : 'muted'})` }));
              // buffer → own area arrow
              const cp = c === 'copying';
              const [ax, ay, aw] = L.area;
              if (SM) k.push(s('line', { x1: bx + bw / 2, y1: by + bh, x2: Math.min(bx + bw / 2, ax + aw - 20), y2: ay - 6, style: `stroke:var(--${cp ? 'os' : 'line-2'})`, 'stroke-width': cp ? 3.5 : 2, 'marker-end': `url(#arr-${cp ? 'os' : 'muted'})` }));
              else k.push(s('line', { x1: bx + bw, y1: by + bh / 2, x2: ax - 6, y2: L.area[1] + L.area[3] / 2, style: `stroke:var(--${cp ? 'os' : 'line-2'})`, 'stroke-width': cp ? 3.5 : 2, 'marker-end': `url(#arr-${cp ? 'os' : 'muted'})` }));
              if (cp && !SM) k.push(txt((bx + bw + ax) / 2, by + bh / 2 - (j ? -22 : 12), 'copy', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }));
            });
            const [px, py] = L.proc, [ax, ay, aw, ah] = L.area;
            k.push(rect(L.proc, 's-proc', { style: 'fill:var(--panel-2)' }), txt(px + 12, py + 24, 'Process P', { 'font-weight': 800, 'font-size': 15, style: 'fill:var(--proc)' }));
            k.push(rect(L.area, 's-mem', { rx: 8 }), txt(ax + 10, ay + 22, 'its own area', { 'font-size': 13, class: 's-sub' }));
            const filling = N === 0 && st.dev, getting = st.proc && st.proc[0] === 'copy';
            k.push(txt(ax + 10, ay + ah - 16, filling ? `filling: block ${st.dev.k}` : getting ? `receiving ${st.proc[1].k}` : st.area ? `block ${st.area}` : 'empty', { 'font-weight': 800, 'font-size': 15, style: filling ? 'fill:var(--io)' : getting ? 'fill:var(--os)' : null }));
            if (N === 0) {
              if (SM) k.push(s('line', { x1: ax + aw / 2, y1: dy + dh, x2: ax + aw / 2, y2: ay - 6, style: `stroke:var(--${filling ? 'io' : 'line-2'})`, 'stroke-width': filling ? 3.5 : 2, 'marker-end': `url(#arr-${filling ? 'io' : 'muted'})` }));
              else k.push(s('line', { x1: dx + dw, y1: dy + dh / 2, x2: ax - 6, y2: ay + ah / 2, style: `stroke:var(--${filling ? 'io' : 'line-2'})`, 'stroke-width': filling ? 3.5 : 2, 'marker-end': `url(#arr-${filling ? 'io' : 'muted'})` }));
              if (!SM) k.push(txt((dx + dw + ax) / 2, dy + dh / 2 - 12, 'straight into P’s memory', { 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }));
            }
            const [sx, sy] = L.stat, p = st.proc;
            const big = !p ? 'done' : p[0] === 'wait' ? 'waiting' : p[0] === 'copy' ? 'copying' : 'computing';
            const small = !p ? '' : p[0] === 'wait' ? `for block ${p[1].k}` : p[0] === 'copy' ? `block ${p[1].k} (M = ${M} ms)` : `on block ${p[1].k} (C = ${C} ms)`;
            const col = !p ? 'ink' : p[0] === 'wait' ? 'bad' : p[0] === 'copy' ? 'os' : 'proc';
            k.push(txt(sx, sy, big, { 'font-weight': 900, 'font-size': SM ? 20 : 24, style: `fill:var(--${col})` }), txt(sx, sy + 24, small, { 'font-size': 14, 'font-weight': 700 }));
            dia.replaceChildren(...k);
          }
          function caption(t, last) {
            const st = stateAt(t), p = st.proc;
            if (last) {
              const f = N === 0 ? `T + C = ${T} + ${C} = ${T + C} ms` : N === 1 ? `max(C, T) + M = max(${C}, ${T}) + ${M} = ${Math.max(C, T) + M} ms` : `max(C, T) = max(${C}, ${T}) = ${Math.max(C, T)} ms`;
              const why = N === 0 ? 'The device and the process take turns: while one works, the other waits.' : N === 1 ? 'Reading now overlaps computing, but the copy still stops the device, because the only buffer is busy.' : 'The device never stops: it fills one buffer while the other is being copied out. It is the bottleneck now.';
              return `<b>t = ${t} ms.</b> Block 3 is finished. From here on a new block finishes every <b>${fmt(run.per)} ms</b>: ${f}. ${why}`;
            }
            let ps = '', ds = '';
            if (p && p[0] === 'wait') ps = N === 0 ? `The process asked for block ${p[1].k} and is <b>waiting</b> while the device reads it straight into its own memory.` : `The process asked for block ${p[1].k}, but it is not in a buffer yet, so the process <b>waits</b>.`;
            if (p && p[0] === 'copy') ps = `The OS <b>copies</b> block ${p[1].k} out of ${bufName(p[1].buf)} into the process’s own area.`;
            if (p && p[0] === 'comp') ps = `The process <b>computes</b> on block ${p[1].k}.`;
            if (st.dev) {
              const ahead = st.dev.req > t;
              ds = N === 0 ? '' : `The device reads block ${st.dev.k} into ${bufName(st.dev.buf)}${ahead ? ' before the process has even asked for it: that is <span class="t" data-t="read-ahead">read-ahead</span>.' : '.'}`;
              if (N === 2 && p && p[0] === 'copy') ds += ' Two buffers let it keep going during the copy.';
            } else ds = N === 0 ? 'The device sits <b>idle</b>: nobody has asked for the next block yet.' : `The device sits <b>idle</b>: ${N === 1 ? 'the only buffer is still occupied' : 'neither buffer is empty'}, so it has nowhere to put the next block.`;
            return `<b>t = ${t} ms.</b> ${ps} ${ds}`;
          }
          function rebuild() {
            run = simBuf(N, T, C, M, 8);
            const end = run.blocks[2].cE, set = new Set([0, end]);
            run.blocks.forEach((x) => [x.req, x.dS, x.dE, x.mS, x.mE, x.cE].forEach((v) => { if (v <= end) set.add(v); }));
            frames = [...set].sort((a, b) => a - b);
          }
          function render(i) {
            const t = frames[i];
            drawDia(t);
            const lz = lanes(ctx, [{ run }], { win: WIN, W: SM ? 360 : 1100, labelW: SM ? 66 : 90, laneH: SM ? 22 : 30, rowGap: 0, cursor: t, tick: SM ? 15 : 5 });
            tl.setAttribute('viewBox', `0 0 ${SM ? 360 : 1100} ${lz.height}`);
            tl.replaceChildren(...lz.kids);
            return caption(t, i === frames.length - 1);
          }
          rebuild();
          const player = ctx.ui.player({ count: frames.length, render, interval: 2600 });
          const seg = ctx.ui.seg(NAMES.map((n, i) => ({ value: i, label: n })), N, (v) => { N = v; rebuild(); player.stop(); player.setCount(frames.length); player.go(0); });
          el.append(h('div', { class: 'stack fill mw0', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg,
              h('div', { class: 'row gap-s' }, h('span', { class: 'chip io' }, `T = ${T} ms to read a block`), h('span', { class: 'chip proc' }, `C = ${C} ms to compute`), h('span', { class: 'chip os' }, `M = ${M} ms to copy`))),
            h('div', { class: 'card white tight' }, dia, tl),
            h('div', { class: 'legend' }, ...[['comp', 'process computes'], ['copy', 'OS copies the block'], ['wait', 'process waits'], ['read', 'device reads'], ['idle', 'device idle']].map(([c, t]) => h('span', {}, h('i', { class: 'sw ' + c }), t))),
            player.el));
        },
      },
      {
        title: 'Three formulas: predict, then check',
        kind: 'predict',
        render(el, ctx) {
          const { h, s } = ctx;
          const SM = ctx.narrow;
          const EX = [{ T: 10, C: 4, M: 1 }, { T: 5, C: 8, M: 1 }];
          const NAMES = ['No buffer', 'Single buffer', 'Double buffer'];
          let ex = 0, checked = false;
          const inputs = NAMES.map(() => h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', class: 'b11-num', 'data-keys': '', 'aria-label': 'Your prediction in ms' }));
          const fbs = NAMES.map(() => h('span', { class: 'small' }));
          const params = h('p', { class: 'm0' });
          const svg = s('svg', { viewBox: '0 0 640 230', width: '100%' });
          const res = h('div', { class: 'stack', style: { gap: '8px' } });
          const GENERIC = 'The slower side sets the pace. With two buffers, compare T with C + M: if T is larger, the device is the bottleneck and runs flat out; if C + M is larger, the process is, and it never waits for I/O.';
          const tip = h('div', { class: 'callout tip m0 small', 'data-label': 'Who sets the pace?', html: GENERIC });
          // answers(): the one right value per scheme, counting every millisecond (the copy included), straight from the simulation
          function answers() {
            const { T, C, M } = EX[ex];
            const runs = [0, 1, 2].map((N) => simBuf(N, T, C, M, 12));
            const classic = Math.max(C, T), exact = runs[2].per;
            return {
              runs,
              ok: runs.map((r) => r.per),
              work: [`T + C = ${T} + ${C} = ${T + C} ms`, `max[C, T] + M = max(${C}, ${T}) + ${M} = ${Math.max(C, T) + M} ms`,
                `max[T, C + M] = max(${T}, ${C + M}) = ${fmt(exact)} ms` + (classic === exact ? ', the same as the estimate max[C, T]' : `. The estimate max[C, T] = ${classic} ms leaves out the copy`)],
            };
          }
          function paint() {
            const { T, C, M } = EX[ex], a = answers();
            params.innerHTML = `A process reads a long file. It takes <b>T = ${T} ms</b> to read a block, <b>C = ${C} ms</b> to compute on it and <b>M = ${M} ms</b> to copy it out of a system buffer. Predict the <b>exact</b> time per block once things settle, counting every millisecond, the copy included:`;
            fbs.forEach((f, i) => {
              if (!checked) { f.innerHTML = ''; return; }
              const v = parseFloat(inputs[i].value), good = Math.abs(a.ok[i] - v) < 0.051;
              f.innerHTML = `<b style="color:var(--${good ? 'ok' : 'bad'})">${good ? '✓' : '✗'}</b> ${a.work[i]}`;
            });
            res.style.display = checked ? '' : 'none';
            tip.setAttribute('data-label', checked ? 'Who is the bottleneck here?' : 'Who sets the pace?');
            if (!checked) { tip.innerHTML = GENERIC; return; }
            const lz = lanes(ctx, a.runs.map((r, i) => ({ label: NAMES[i], note: SM ? `${fmt(r.per)} ms per block` : `${fmt(r.per)} ms per block · ${whoShort(r)}`, run: r })), { win: 50, W: SM ? 360 : 720, labelW: SM ? 64 : 80, laneH: SM ? 18 : 15, rowGap: 6, cursor: null, tick: 10 });
            svg.setAttribute('viewBox', `0 0 ${SM ? 360 : 720} ${lz.height}`);
            svg.replaceChildren(...lz.kids);
            const slow = T > C + M ? `T = ${T} is larger than C + M = ${C + M}, so the <b>device</b> is the <span class="t">bottleneck</span>` : `C + M = ${C + M} is larger than T = ${T}, so the <b>process</b> is the <span class="t">bottleneck</span>`;
            tip.innerHTML = `${slow}. ` + (SM ? a.runs.map((r, i) => `<b>${NAMES[i]}:</b> ${whoWaits(r)}`).join(' ') + ' ' : '') +
              (a.runs[1].per === a.runs[2].per ? 'One buffer already hides the I/O here, so a second buys nothing while T and C stay steady; it pays off when the device is slower or its speed varies.' : 'Each extra buffer lets more of the device’s work overlap with the process’s work, until the device never rests.');
          }
          const check = h('button', { type: 'button', class: 'btn sm primary', onclick: () => { checked = true; paint(); ctx.refit(); } }, 'Check my numbers');
          const show = h('button', { type: 'button', class: 'btn sm', onclick: () => { const a = answers(); inputs.forEach((inp, i) => { inp.value = a.ok[i]; }); checked = true; paint(); ctx.refit(); } }, 'Show the answers');
          const seg = ctx.ui.seg([{ value: 0, label: 'Example 1' }, { value: 1, label: 'Example 2' }], 0, (v) => { ex = v; checked = false; inputs.forEach((i) => { i.value = ''; }); paint(); });
          res.append(h('div', { class: 'card white tight' }, svg));
          paint();
          const rowsEl = h('div', { class: 'b11-pred' }, ...NAMES.flatMap((n, i) => [h('label', { class: 'b' }, n), h('span', { class: 'row gap-s', style: { flexWrap: 'nowrap' } }, inputs[i], h('span', { class: 'small muted' }, 'ms')), fbs[i]]));
          el.append(h('div', { class: 'mw0', style: { display: 'grid', gridTemplateColumns: SM ? '1fr' : '400px minmax(0, 1fr)', gap: '18px', height: SM ? 'auto' : '100%' } },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('h3', { class: 'm0' }, 'Time per block, once things settle'),
              h('table', { class: 'tbl compact', html: '<tr><th>Scheme</th><th>Time per block</th></tr><tr><td>No buffer</td><td><b>T + C</b><div class="xs muted">device and process take turns</div></td></tr><tr><td><span class="t">Single buffering</span></td><td><b>max[C, T] + M</b><div class="xs muted">reading overlaps computing; the copy overlaps nothing</div></td></tr><tr><td><span class="t">Double buffering</span></td><td><b>≈ max[C, T]</b><div class="xs muted">the device keeps reading during the copy</div></td></tr>' }),
              tip,
              h('div', { class: 'callout warn m0 small', 'data-label': 'Estimate or exact?', html: 'The classic formula max[C, T] treats the copy as free, but the copy still takes the process’s time: C + M per block. So the exact time is <b>max[T, C + M]</b>; the two agree whenever C + M ≤ T.' })),
            h('div', { class: 'stack mw0', style: { gap: '10px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('div', { class: 'row gap-s' }, check, show)),
              params, rowsEl, res)));
        },
      },
      {
        title: 'Buffer timeline lab: who waits for whom?',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const SM = ctx.narrow;
          const NAMES = ['No buffer', 'Single buffer', 'Double buffer'];
          const P = { T: 10, C: 4, M: 1 };
          const svg = s('svg', { viewBox: '0 0 800 280', width: '100%' });
          const tbody = h('tbody');
          const narr = h('div', { class: 'narr' });
          function update() {
            const { T, C, M } = P;
            const runs = [0, 1, 2].map((N) => simBuf(N, T, C, M, 30));
            const classic = Math.max(C, T);
            const formula = [[`T + C`, T + C], [`max[C, T] + M`, Math.max(C, T) + M], [`max[C, T]`, classic]];
            tbody.replaceChildren(...runs.map((r, i) => h('tr', {},
              h('td', { class: 'b' }, ['None', 'Single', 'Double'][i]),
              h('td', { html: `${formula[i][0]} = <b>${fmt(formula[i][1])}</b>${formula[i][1] !== r.per ? ' *' : ''}` }),
              h('td', { html: `<b>${fmt(r.per)}</b>` }),
              h('td', {}, String(perSec(r.per))))));
            const lz = lanes(ctx, runs.map((r, i) => ({ label: NAMES[i], note: SM ? `${fmt(r.per)} ms per block` : `${fmt(r.per)} ms per block · ${whoShort(r)}`, run: r })), { win: SM ? 60 : 100, W: SM ? 360 : 800, labelW: SM ? 64 : 82, laneH: SM ? 18 : 31, rowGap: 10, cursor: null, tick: SM ? 20 : 10 });
            svg.setAttribute('viewBox', `0 0 ${SM ? 360 : 800} ${lz.height}`);
            svg.replaceChildren(...lz.kids);
            const [n0, , n2] = runs.map((r) => r.per), d = runs[2];
            const work = C + M;
            let txt = T > work ? `The device needs T = ${T} ms per block, the process C + M = ${work} ms: the <b>device</b> is the <span class="t">bottleneck</span>. `
              : work > T ? `The process needs C + M = ${work} ms per block, the device T = ${T} ms: the <b>process</b> is the <span class="t">bottleneck</span>${T > C ? ' (the copy tips the balance: by C alone the device looked slower)' : ''}. `
              : `T = C + M = ${T} ms: the two sides are evenly matched. `;
            txt += n2 < n0 ? `Two buffers instead of none cut the time per block from ${fmt(n0)} to ${fmt(n2)} ms, so ${fmt(n0 / n2)}× as many blocks per second. `
              : `Here copying a block (M = ${M} ms) costs at least as much as reading it (T = ${T} ms), so buffering does not pay: two buffers give ${fmt(n2)} ms per block against ${fmt(n0)} ms with none. `;
            if (d.devIdle === 0) txt += 'With two buffers the device never rests, so only a faster device could help now.';
            else if (d.wait === 0) txt += 'With two buffers the process never waits for I/O, so only less computing or copying per block could help now.';
            else txt += 'With two buffers both sides still lose a little time, mostly to the copy.';
            if (classic !== d.per) txt += ` <br>* The classic estimate max[C, T] = ${classic} ms leaves out the copy; counted exactly it is max[T, C + M] = ${fmt(d.per)} ms.`;
            narr.innerHTML = txt;
          }
          const sl = {
            T: ctx.ui.slider({ label: 'T: read a block', min: 1, max: 20, value: P.T, format: (v) => v + ' ms', onInput: (v) => { P.T = v; update(); } }),
            C: ctx.ui.slider({ label: 'C: compute on it', min: 1, max: 20, value: P.C, format: (v) => v + ' ms', onInput: (v) => { P.C = v; update(); } }),
            M: ctx.ui.slider({ label: 'M: copy it over', min: 0, max: 5, value: P.M, format: (v) => v + ' ms', onInput: (v) => { P.M = v; update(); } }),
          };
          const preset = (lab, T, C, M) => h('button', { type: 'button', class: 'btn sm', onclick: () => { Object.assign(P, { T, C, M }); ['T', 'C', 'M'].forEach((k) => sl[k].set(P[k], false)); update(); } }, lab);
          update();
          el.append(h('div', { class: 'mw0', style: { display: 'grid', gridTemplateColumns: SM ? '1fr' : '380px minmax(0, 1fr)', gap: '18px', height: SM ? 'auto' : '100%' } },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0 small' }, 'Drag the sliders. All three timelines come from the same simulation, and so do the numbers.'),
              sl.T, sl.C, sl.M,
              h('div', { class: 'row gap-s' }, preset('Device slower', 10, 4, 1), preset('Process slower', 5, 8, 1), preset('Copy-heavy', 10, 8, 4)),
              h('table', { class: 'tbl compact b11-lab' }, h('thead', { html: '<tr><th>Scheme</th><th>Formula, ms</th><th>Sim, ms</th><th>Blocks/s</th></tr>' }), tbody),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Drag M down to 0. Single and double buffering now tie, because the only work a second buffer can overlap is the copy (with steady T and C).' }),
              h('div', { class: 'legend' }, ...[['comp', 'computes'], ['copy', 'copy'], ['wait', 'process waits'], ['read', 'device reads'], ['idle', 'device idle']].map(([c, t]) => h('span', {}, h('i', { class: 'sw ' + c }), t)))),
            h('div', { class: 'stack mw0', style: { gap: '10px' } },
              h('div', { class: 'card white tight' }, svg), narr)));
        },
      },
      {
        title: 'Stream devices: a line at a time or a byte at a time',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const SM = ctx.narrow;
          /* ---------- tab 1: keyboard input ---------- */
          function inputTab(panel) {
            let mode = 'line', buf = '', got = [], keys = 0, wakes = 0, awake = false, gen = 0;
            const KEYS = [['l', 'l'], ['s', 's'], [' ', '␣ space'], ['-', '-'], ['a', 'a'], ['x', 'x'], ['BS', '⌫ Backspace'], ['EN', '⏎ Enter']];
            const bufEl = h('div', { class: 'b11-term mono' });
            const gotEl = h('div', { class: 'b11-term mono' });
            const pChip = h('span', { class: 'chip' });
            const count = h('div', { class: 'small b' });
            const narr = h('div', { class: 'narr', style: { minHeight: '72px' } });
            const bufLab = h('div', { class: 'xs b' });
            const log = h('div', { class: 'log', style: { height: '112px' } });
            const note = (html) => { log.prepend(h('div', { html })); while (log.childNodes.length > 30) log.lastChild.remove(); };
            const show = (c) => (c === ' ' ? '␣' : c);
            function paint() {
              bufEl.innerHTML = buf ? ctx.util.esc(buf.split('').map(show).join('')) + '<span class="pulse">▏</span>' : '<span class="muted">(empty)</span>';
              gotEl.innerHTML = got.length ? got.map((g) => `<span class="b11-tok">${ctx.util.esc(g)}</span>`).join(' ') : '<span class="muted">(nothing yet)</span>';
              pChip.className = 'chip ' + (awake ? 'ok' : 'warn');
              pChip.textContent = awake ? 'Running: handling input' : mode === 'line' ? 'Blocked: waiting for a whole line' : 'Blocked: waiting for the next key';
              count.textContent = `Keys pressed: ${keys} · times the process was woken: ${wakes}`;
              bufLab.textContent = mode === 'line' ? 'OS line buffer (holds one line)' : 'OS buffer (holds one byte)';
            }
            function wake() {
              wakes++; awake = true;
              const g = ++gen;
              ctx.after(900, () => { if (g !== gen) return; awake = false; paint(); });
            }
            function press(k) {
              keys++;
              const label = k === 'BS' ? '⌫' : k === 'EN' ? '⏎' : show(k);
              if (mode === 'byte') {
                got.push(label); if (got.length > 14) got.shift();
                wake();
                note(`key ${ctx.util.esc(label)} → handed over at once · <b>wake-up #${wakes}</b>`);
                narr.innerHTML = k === 'BS' ? 'Even <b>Backspace</b> is handed over at once. The program itself must decide what it means, which is exactly what a form needs.'
                  : `The key <b>${ctx.util.esc(label)}</b> goes into a one-byte buffer and the process is woken to take it straight away: one wake-up per keystroke. The OS (producer) and the process (consumer) pass bytes like a tiny producer/consumer pair.`;
              } else if (k === 'BS') {
                buf = buf.slice(0, -1);
                note('key ⌫ → OS removes the last character · process still asleep');
                narr.innerHTML = '<b>Backspace</b> is handled by the OS inside its line buffer. The process never sees the mistake, and it stays asleep.';
              } else if (k === 'EN') {
                got.push((buf.split('').map(show).join('') || '(empty line)') + ' ⏎'); if (got.length > 4) got.shift();
                narr.innerHTML = `<b>Enter</b> completes the line. The OS hands the whole line <b>${ctx.util.esc(buf.split('').map(show).join('') || '(empty)')}</b> to the process and wakes it <b>once</b>.`;
                buf = ''; wake();
                note(`key ⏎ → whole line handed over · <b>wake-up #${wakes}</b>`);
              } else {
                buf += k;
                note(`key ${ctx.util.esc(label)} → OS line buffer · process still asleep`);
                narr.innerHTML = `The OS appends <b>${ctx.util.esc(label)}</b> to its line buffer. The process stays <b>Blocked</b>: a line is not complete until Enter.`;
              }
              paint();
            }
            function reset() { gen++; buf = ''; got = []; keys = 0; wakes = 0; awake = false; log.replaceChildren(h('div', { class: 'muted' }, 'Events appear here, newest first.')); narr.innerHTML = mode === 'line' ? 'Type a command with the keys above, fix a typo with Backspace, then press Enter. Watch how often the process is woken.' : 'Press a few keys. Watch how often the process is woken now.'; paint(); }
            const seg = ctx.ui.seg([{ value: 'line', label: 'Line at a time' }, { value: 'byte', label: 'Byte at a time' }], mode, (v) => { mode = v; reset(); });
            const keyRow = h('div', { class: 'row gap-s' }, ...KEYS.map(([k, lab]) => h('button', { type: 'button', class: 'btn mono' + (k.length > 1 ? ' io' : ''), onclick: () => press(k), 'aria-label': 'Key ' + lab }, lab)));
            reset();
            panel.append(h('div', { class: 'mw0', style: { display: 'grid', gridTemplateColumns: SM ? '1fr' : '400px minmax(0, 1fr)', gap: '18px', paddingTop: '6px' } },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0 small', html: '<b>Line at a time.</b> The buffer holds one line. The user types and edits it, and the process is woken only when Enter completes it. This fits a <span class="t">scroll-mode terminal</span>, where finished lines scroll up the screen.' }),
                h('p', { class: 'm0 small', html: '<b>Byte at a time.</b> Each character is handed over the moment it arrives. This fits a <span class="t">forms-mode terminal</span>, where every keystroke can matter at once (Tab jumps to the next field), and devices such as sensors that send single bytes.' }),
                h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Line mode saves work: one wake-up per line instead of one per key. Byte mode gives the program full control over every key.' })),
              h('div', { class: 'stack mw0', style: { gap: '8px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('button', { type: 'button', class: 'btn sm', onclick: reset }, 'Reset')),
                keyRow,
                h('div', { class: 'b11-flow', style: { gridTemplateColumns: SM ? '1fr' : null } },
                  h('div', { class: 'card os tight stack', style: { gap: '4px' } }, bufLab, bufEl),
                  h('div', { class: 'b11-to', 'aria-hidden': 'true' }, SM ? '↓' : '→'),
                  h('div', { class: 'card proc tight stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs b' }, 'Process receives'), pChip), gotEl)),
                count, narr, log)));
            return () => { gen++; };
          }
          /* ---------- tab 2: line output with one or two buffers ---------- */
          function outputTab(panel) {
            const PRINT = 1600, DT = 100;
            let NB = 2, q = [], written = 0, printed = 0, blocked = false, pending = 0, blocks = 0, prog = 0;
            const bufBox = h('div', { class: 'row gap-s', style: { flexWrap: 'nowrap' } });
            const meter = h('div', { class: 'meter', style: { width: '100%' } }, h('i'));
            const prn = h('div', { class: 'small b' });
            const pChip = h('span', { class: 'chip' });
            const count = h('div', { class: 'small b' });
            const narr = h('div', { class: 'narr', style: { minHeight: '72px' } });
            const log = h('div', { class: 'log', style: { height: '112px' } });
            let ticks = 0;
            const note = (html) => { log.prepend(h('div', { html: `${(ticks * DT / 1000).toFixed(1)} s · ${html}` })); while (log.childNodes.length > 30) log.lastChild.remove(); };
            const writeBtn = h('button', { type: 'button', class: 'btn sm primary', onclick: () => write() }, 'Process writes a line');
            function paint() {
              bufBox.replaceChildren(...Array.from({ length: NB }, (_, j) => {
                const ln = q.find((x) => (x - 1) % NB === j), printing = ln && ln === q[0];
                return h('div', { class: 'b11-lbuf ' + (ln ? (printing ? 'printing' : 'full') : '') }, h('div', { class: 'xs b' }, NB === 1 ? 'Line buffer' : 'Buffer ' + 'AB'[j]), h('div', { class: 'b' }, ln ? `line ${ln}` : 'empty'), h('div', { class: 'xs' }, ln ? (printing ? 'printing…' : 'waiting to print') : ' '));
              }));
              meter.firstChild.style.width = (q.length ? prog * 100 : 0) + '%';
              prn.textContent = q.length ? `Printer: printing line ${q[0]}` : 'Printer: idle';
              pChip.className = 'chip ' + (blocked ? 'bad' : 'ok');
              pChip.textContent = blocked ? `Blocked: line ${pending} has no free buffer` : 'Running';
              writeBtn.disabled = blocked;
              count.textContent = `Lines written: ${written} · printed: ${printed} · times the process had to wait: ${blocks}`;
            }
            function write() {
              if (blocked) return;
              written++;
              if (q.length < NB) {
                q.push(written);
                note(`line ${written} → ${NB === 1 ? 'the buffer' : 'buffer ' + 'AB'[(written - 1) % NB]}${q.length === 1 ? ' · printer starts' : ''} · process runs on`);
                narr.innerHTML = q.length === 1 ? `Line ${written} is copied into ${NB === 1 ? 'the buffer' : 'buffer ' + 'AB'[(written - 1) % NB]} and the printer starts on it. The process carries on at once.`
                  : `Line ${written} goes into buffer ${'AB'[(written - 1) % NB]} while line ${q[0]} prints. The process carries on: it is now one line ahead of the printer.`;
              } else {
                blocked = true; pending = written; blocks++;
                note(`line ${written}: no free buffer · <b>process Blocked</b>`);
                narr.innerHTML = NB === 1 ? `The only buffer still holds line ${q[0]}, which is printing. Line ${written} has nowhere to go, so the process is <b>Blocked</b>. With one buffer it must wait as soon as it is one line ahead.`
                  : `Both buffers are full: the process is <b>two lines ahead</b> of the printer. Line ${written} has nowhere to go, so the process is <b>Blocked</b> until a buffer frees.`;
              }
              paint();
            }
            function tick() {
              ticks++;
              if (!q.length) return;
              prog += DT / PRINT;
              if (prog >= 1) {
                prog = 0; printed++; const done = q.shift();
                note(`printer finished line ${done}`);
                if (blocked) { q.push(pending); blocked = false; narr.innerHTML = `The printer finished line ${done}, freeing its buffer. Waiting line ${pending} is copied in and the process runs again.`; note(`line ${pending} → freed buffer · <b>process runs again</b>`); }
              }
              paint();
            }
            function reset() { ticks = 0; log.replaceChildren(h('div', { class: 'muted' }, 'Events appear here, newest first.')); q = []; written = 0; printed = 0; blocked = false; pending = 0; blocks = 0; prog = 0; narr.innerHTML = 'Click <b>Process writes a line</b> quickly, several times in a row. Each line takes the printer about 1.6 seconds.'; paint(); }
            const seg = ctx.ui.seg([{ value: 1, label: 'One line buffer' }, { value: 2, label: 'Two line buffers' }], NB, (v) => { NB = v; reset(); });
            reset();
            const timer = ctx.every(DT, tick);
            panel.append(h('div', { class: 'mw0', style: { display: 'grid', gridTemplateColumns: SM ? '1fr' : '400px minmax(0, 1fr)', gap: '18px', paddingTop: '6px' } },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0 small', html: '<b><span class="t">Double buffering</span> a stream.</b> For line-at-a-time output, the process copies a finished line into a free buffer and carries on while the OS prints it. With one buffer it must wait as soon as it is one line ahead. With two, it need not wait unless it gets <b>two lines ahead</b> of the device.' }),
                h('p', { class: 'm0 small', html: 'For byte-at-a-time streams a second buffer is no better than one buffer twice as long: either way it is a plain producer/consumer queue of bytes.' }),
                h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'With one buffer, click twice fast: the process blocks at once. Switch to two buffers and do the same: it now blocks only on the third quick line.' })),
              h('div', { class: 'stack mw0', style: { gap: '8px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('button', { type: 'button', class: 'btn sm', onclick: reset }, 'Reset')),
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, writeBtn, pChip),
                bufBox, h('div', { class: 'stack', style: { gap: '4px' } }, prn, meter), count, narr, log)));
            return () => clearInterval(timer);
          }
          el.append(ctx.ui.tabs([{ label: 'Input: a line or a byte at a time', render: inputTab }, { label: 'Output: one or two line buffers', render: outputTab }]));
        },
      },
      {
        title: 'Circular buffers: bursts versus a steady overload',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const SM = ctx.narrow;
          const T = 4, HIST = 120;
          const P = { N: 2, B: 6, Pz: 30 };
          let ring, hist = [], running = false;
          const ringSvg = s('svg', { viewBox: '0 0 300 300', width: '100%' });
          const chart = s('svg', { viewBox: '0 0 440 190', width: '100%' });
          const pChip = h('span', { class: 'chip' }), dChip = h('span', { class: 'chip' });
          const stat = h('div', { class: 'small b' });
          const narr = h('div', { class: 'narr' });
          const runBtn = h('button', { type: 'button', class: 'btn sm primary', onclick: () => { running = !running; paintBtn(); } }, 'Run');
          const paintBtn = () => { runBtn.textContent = running ? 'Pause' : 'Run'; runBtn.classList.toggle('primary', !running); };
          function fresh() { ring = makeRing(P.N, P.B, P.Pz, T); hist = []; verdict(); draw(); }
          function verdict() {
            const { N, B, Pz } = P, pct = longRun(N, B, Pz, T), need = B * T, have = B + Pz;
            const floor = Math.round(1000 * (1 - have / need)) / 10;
            let txt, tone = '';
            if (need > have) {
              txt = `<b>Steady overload.</b> Each cycle the process takes ${B} blocks in ${have} ms, but the device needs ${need} ms to read them. In the long run the process waits <b>${pct}%</b> of the time, and no number of buffers can push that below about ${floor}%: once the ring drains it never refills. Buffers smooth bursts; they cannot create speed.`;
              tone = 'bad';
            } else if (pct === 0) {
              txt = `<b>Bursts absorbed.</b> The device needs ${need} ms per cycle and gets ${have} ms, so it keeps up on average. With ${N} buffer${N > 1 ? 's' : ''} the ring refills during each pause, so a whole burst is waiting when it starts: in the long run the process never waits.`;
              tone = 'ok';
            } else if (N < B) {
              txt = `The device keeps up on average (${need} ms of reading per ${have} ms cycle), but a burst of ${B} blocks is bigger than a ring of ${N}. In the long run the process waits <b>${pct}%</b> of the time. Add buffers until the ring holds a whole burst.`;
            } else {
              txt = `The device only just keeps up (${need} ms of reading per ${have} ms cycle), so the ring is not quite full when a burst starts. In the long run the process waits <b>${pct}%</b> of the time. A longer pause would fix it.`;
            }
            narr.className = 'narr' + (tone ? ' ' + tone : '');
            narr.innerHTML = txt;
          }
          function draw() {
            const st = ring.st, N = P.N, k = [];
            const cx = 150, cy = 150, R = N === 1 ? 0 : N <= 4 ? 88 : 104, sw = N <= 4 ? 100 : 80, sh = 54;
            k.push(s('circle', { cx, cy, r: Math.max(R, 40), class: 's-muted', 'stroke-dasharray': '3 6' }));
            st.slots.forEach((x, j) => {
              const a = (-90 + j * 360 / N) * Math.PI / 180, x0 = cx + R * Math.cos(a), y0 = cy + R * Math.sin(a);
              const cls = !x ? 's-panel' : x.s === 'filling' ? 's-io' : x.s === 'full' ? 's-os' : 's-proc';
              k.push(s('rect', { x: x0 - sw / 2, y: y0 - sh / 2, width: sw, height: sh, rx: 10, class: cls, 'stroke-width': 2, 'stroke-dasharray': !x || x.s === 'filling' ? '5 4' : null }));
              k.push(s('text', { x: x0, y: y0 - 4, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'buf ' + j));
              k.push(s('text', { x: x0, y: y0 + 15, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, !x ? 'empty' : x.s === 'filling' ? 'filling' : '#' + x.k));
            });
            const full = st.slots.filter((x) => x && x.s === 'full').length;
            k.push(s('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-size': N === 1 ? 0 : 26, 'font-weight': 900 }, N === 1 ? '' : `${full}/${N}`));
            if (N > 1) k.push(s('text', { x: cx, y: cy + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'blocks ready'));
            ringSvg.replaceChildren(...k);
            // strip chart: ready blocks per millisecond, red marks where the process waited
            const c = [], X0 = 34, X1 = 436, Y0 = 150, Hc = 118, per = (X1 - X0) / HIST, maxN = N;
            c.push(s('line', { x1: X0, y1: Y0, x2: X1, y2: Y0, class: 's-muted' }));
            [...new Set([0, Math.round(N / 2), N])].forEach((v) => c.push(s('text', { x: X0 - 6, y: Y0 - v * Hc / maxN + 5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(v))));
            hist.forEach((p, i) => {
              const x = X1 - (hist.length - i) * per;
              if (p.full) c.push(s('rect', { x, y: Y0 - p.full * Hc / maxN, width: per + 0.3, height: p.full * Hc / maxN, style: 'fill:var(--os-bg);stroke:var(--os);stroke-width:0.6' }));
              if (p.wait) c.push(s('rect', { x, y: Y0 + 4, width: per + 0.3, height: 10, style: 'fill:var(--bad);stroke:none' }));
            });
            c.push(s('text', { x: X0, y: Y0 + 34, 'font-size': 13, class: 's-sub' }, `${HIST} ms ago`), s('text', { x: X1, y: Y0 + 34, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'now'));
            c.push(s('text', { x: X0 + 4, y: 14, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--os)' }, 'blocks ready in the ring'), s('text', { x: X1, y: 14, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--bad)' }, 'red = process waits'));
            chart.replaceChildren(...c);
            const waiting = st.phase === 'burst' && !st.take, reading = st.dev > 0;
            pChip.className = 'chip ' + (waiting ? 'bad' : st.phase === 'burst' ? 'proc' : 'ok');
            pChip.textContent = waiting ? 'Process: WAITING, ring empty' : st.phase === 'burst' ? `Process: taking a burst (${st.left} left)` : `Process: computing (${st.left} ms)`;
            dChip.className = 'chip ' + (reading ? 'io' : 'warn');
            dChip.textContent = reading ? 'Device: reading ahead' : 'Device: idle, ring full';
            stat.textContent = `Time: ${st.t} ms · blocks taken: ${st.got} · waited: ${st.waited} ms (${st.t ? Math.round(100 * st.waited / st.t) : 0}%)`;
          }
          function tick() {
            if (!running) return;
            const w = ring.step();
            hist.push({ full: ring.st.slots.filter((x) => x && x.s === 'full').length, wait: w });
            if (hist.length > HIST) hist.shift();
            draw();
          }
          const sliders = [
            ctx.ui.slider({ label: 'Buffers in the ring', min: 1, max: 8, value: P.N, onInput: (v) => { P.N = v; fresh(); } }),
            ctx.ui.slider({ label: 'Burst size (blocks)', min: 1, max: 8, value: P.B, onInput: (v) => { P.B = v; fresh(); } }),
            ctx.ui.slider({ label: 'Compute between bursts', min: 0, max: 40, step: 2, value: P.Pz, format: (v) => v + ' ms', onInput: (v) => { P.Pz = v; fresh(); } }),
          ];
          fresh();
          ctx.every(45, tick);
          el.append(h('div', { class: 'stack fill mw0', style: { gap: '10px' } },
            h('div', { class: 'mw0', style: { display: 'grid', gridTemplateColumns: SM ? '1fr' : '330px 320px minmax(0, 1fr)', gap: '16px', flex: '1', minHeight: 0 } },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0 small', html: '<span class="t">Circular buffering</span>: the OS keeps a ring of buffers and runs it as a <span class="t">bounded buffer</span>. The device (producer) reads ahead into empty slots; the process (consumer) takes blocks in bursts. The device needs 4 ms per block; taking one costs the process 1 ms.' }),
                ...sliders,
                h('div', { class: 'row gap-s' }, runBtn, h('button', { type: 'button', class: 'btn sm', onclick: () => { running = false; paintBtn(); fresh(); } }, 'Reset')),
                h('div', { class: 'legend' }, ...[['idle', 'empty slot'], ['read', 'device filling it'], ['copy', 'block ready'], ['comp', 'process taking it']].map(([c, t2]) => h('span', {}, h('i', { class: 'sw ' + c }), t2)))),
              h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center', minHeight: 0 } }, ringSvg),
              h('div', { class: 'stack mw0', style: { gap: '8px' } },
                h('div', { class: 'row gap-s' }, pChip, dChip), stat,
                h('div', { class: 'card white tight' }, chart),
                h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Press Run with 2 buffers and watch the red marks. Drag the buffers up to 6: they vanish. Now drag the compute time down to 10 ms: red comes back however many buffers you add.' }))),
            narr));
        },
      },
      {
        title: 'Recap: six things to remember',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud, then click the card to check yourself.'),
            ctx.ui.flipcards([
              ['Why not transfer straight into a process’s own memory?', 'Its page must stay locked until the transfer ends, so the process cannot be fully swapped out. Without the lock, swapping it out risks a single-process deadlock. A system buffer avoids both, at the cost of one copy.'],
              ['Block-oriented versus stream-oriented devices?', 'Block: fixed-size numbered blocks, one block per transfer (disks, SSDs, USB keys). Stream: a flow of bytes with no block structure (keyboards, mice, printers, ports).'],
              ['Time per block with no buffer, one buffer, two buffers?', '<b>T + C</b>, <b>max[C, T] + M</b> and about <b>max[C, T]</b>. Counting the copy exactly, the double buffer gives max[T, C + M].'],
              ['Who sets the pace?', 'The slower side, the bottleneck. With two buffers, compare T with C + M: if T is larger the device runs nonstop; if C + M is larger the process never waits for I/O. (With a tiny copy, that is T against C.)'],
              ['A line at a time or a byte at a time?', 'Line: the process gets a whole, already edited line when Enter is pressed (scroll-mode terminal). Byte: every keystroke is handed over at once (forms-mode terminal).'],
              ['What can a ring of buffers do, and not do?', 'It absorbs bursts of I/O, as a bounded buffer. It cannot cure a steady overload: if the process wants blocks faster on average than the device delivers, the ring drains and the process waits.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 200 })));
        },
      },
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A process asks for a block to be read straight into its own address space. Why must the OS lock the target page in main memory before issuing the request?',
            choices: ['So that no other process can read the block before its owner does', 'So the transfer cannot land in a frame that no longer holds that page', 'So the device can use DMA rather than programmed I/O for the job', 'So the page table needs no update once the transfer has finished'], answer: 1,
            feedback: ['Separate address spaces already keep other processes out; locking is about where the page is, not who may read it.', null, 'Locking does not choose between DMA and programmed I/O; it only keeps the page from leaving memory while the transfer is pending.', 'The page table is not the problem. The danger is the page leaving memory while the transfer is still pending.'],
            why: 'If the page were swapped out while the request waited, the transfer would have no valid place to go, or it would overwrite whatever now occupies the frame. Locking keeps the page in place until the I/O completes.' },
          { type: 'order', q: 'Put the steps of a single-process deadlock in order.',
            items: ['The process asks for a block to be read into its own page', 'The process blocks while its request waits for the device', 'Memory runs short and the OS swaps the process out', 'The device is ready, but the target page is no longer in memory', 'The I/O waits for the process, and the process waits for the I/O'],
            why: 'One process is enough: it waits for its I/O, and the I/O waits for the process’s page to come back. Locking the page before the request, or reading into a system buffer, prevents it.' },
          { type: 'bucket', q: 'Sort each device: block-oriented or stream-oriented?', buckets: ['Block-oriented', 'Stream-oriented'],
            items: [['Hard disk drive', 0], ['Keyboard', 1], ['USB flash drive', 0], ['Mouse', 1], ['Printer', 1], ['Solid-state drive', 0], ['Communications port', 1]],
            why: 'Block-oriented devices hold fixed-size numbered blocks and move one block per transfer; they are the secondary-storage devices. Nearly everything else moves a plain stream of bytes.' },
          { type: 'num', q: 'With no buffering, reading a block takes T = 8 ms and the process computes for C = 5 ms on each block. What is the time per block?', answer: 13, tol: 0.01, unit: 'ms',
            why: 'Without a buffer the device and the process take turns: T + C = 8 + 5 = 13 ms.' },
          { type: 'num', q: 'With single buffering, T = 8 ms, C = 5 ms and M = 2 ms (the time to copy a block from the system buffer to the process). What is the time per block?', answer: 10, tol: 0.01, unit: 'ms',
            why: 'max[C, T] + M = max(5, 8) + 2 = 10 ms. Reading the next block overlaps the computing, but the copy overlaps nothing, because the only buffer is busy during it.' },
          { type: 'num', q: 'With double buffering, T = 8 ms, C = 5 ms and M = 2 ms. How many blocks per second can the process handle?', answer: 125, tol: 1, unit: 'blocks/s',
            why: 'The time per block is max[C, T] = 8 ms. Here even C + M = 7 ms is below T, so the device is the bottleneck and never stops. 1,000 ms ÷ 8 ms = 125 blocks per second.' },
          { q: 'With double buffering, a process computes longer on each block than the device needs to read one (C > T). Which statement is true?',
            choices: ['The device runs nonstop and the process sometimes waits for it', 'The process ends up waiting for I/O on every second block', 'The process never waits for I/O; the device is idle part of the time', 'Both buffers fill up, so the process eventually has to wait'], answer: 2,
            feedback: ['That describes the opposite case, a device slower than the process (T > C + M), where the device is the bottleneck.', 'The device is faster and keeps both buffers stocked, so no block is ever late.', null, 'Full buffers make the device wait for a free one, not the process.'],
            why: 'When C > T the process is the bottleneck. The device keeps the buffers stocked and then waits for a free one, so the process always finds its next block ready.' },
          { type: 'match', q: 'Match each technique to what it does.',
            pairs: [['Line-at-a-time input', 'The process is woken once per complete line'], ['Byte-at-a-time input', 'Every keystroke is handed to the process at once'], ['Double buffering', 'The OS fills one buffer while the process empties the other'], ['Circular buffering', 'A ring of more than two buffers run as a bounded buffer']],
            why: 'Line and byte modes are the two ways to buffer a stream; double and circular buffering add buffers so more device work can overlap with process work.' },
          { q: 'A program reads commands from a scroll-mode terminal with line-at-a-time buffering. The user types <code>lss</code>, presses Backspace, then Enter. What does the program receive?',
            choices: ['Four separate wake-ups: l, s, s and Backspace', 'The line lss followed by a Backspace code', 'Nothing until the OS buffer is completely full', 'One wake-up with the edited line ls'], answer: 3,
            feedback: ['That is byte-at-a-time behaviour, as in a forms-mode terminal.', 'In line mode the OS applies the edit inside its own line buffer, so the program never sees the typo.', 'Enter completes the line; the buffer does not have to be full.', null],
            why: 'In line-at-a-time mode the OS collects and edits the line in its buffer and wakes the process once, when Enter completes it.' },
          { type: 'tf', q: 'With two line buffers for line-at-a-time output, a process must wait as soon as it gets one line ahead of the printer.', answer: false,
            why: 'With two buffers it waits only when it gets two lines ahead: one line can be printing from one buffer while the next waits in the other.' },
          { type: 'multi', q: 'Which statements about I/O buffering are true?',
            choices: ['Input can be read ahead, before the process asks for it', 'Output can be written out after the process has moved on', 'Enough buffers let a process outpace a slower device forever', 'A system buffer lets the OS swap a process out during its I/O', 'Buffering makes each single transfer finish sooner'], answer: [0, 1, 3],
            why: 'Buffering moves transfers earlier (input) or later (output) and frees the process’s memory during I/O. It does not speed up the device, and no number of buffers keeps up with a steady overload.' },
          { q: 'On average, a process asks for blocks faster than the disk can deliver them. What does adding more circular buffers achieve?',
            choices: ['Nothing lasting: the buffers drain and the process waits', 'The process stops waiting once there are enough buffers', 'The disk is pushed into transferring each block faster', 'The OS starts dropping blocks so it can keep up with demand'], answer: 0,
            feedback: [null, 'Buffers only store blocks the device has already read; on average the device still delivers too few.', 'Buffering never changes the device’s own speed.', 'An OS does not discard file data to keep up; the process simply waits.'],
            why: 'Buffers smooth out bursts. When the average demand is higher than the device’s rate, every buffer empties and the process waits for each block the device delivers.' },
        ],
      },
    ],
    notes: `
      <h3>Why the OS buffers I/O</h3>
      <p>Devices are slow compared with the processor, so every transfer raises two questions: who waits, and where does the data land? <b>I/O buffering</b> keeps data for a while in memory on its way between a device and a process. Input transfers can then happen <b>before</b> the process asks for the data (read-ahead), and output transfers can happen <b>after</b> the process has handed the data over and moved on. Speed differences are smoothed out instead of forcing one side to wait.</p>
      <h4>The trouble with transferring straight into a process’s memory</h4>
      <ul>
        <li>The process has nothing to do until the slow transfer ends.</li>
        <li>The target area (say addresses 4096–4607 of the process) must stay in main memory for the whole transfer, so its page must be <b>locked</b> before the request is issued. A process with a locked page cannot be swapped out completely, and locked frames reduce the OS’s freedom to manage memory.</li>
        <li>Without the lock there is a <b>single-process deadlock</b>: the process issues the request and blocks; the OS swaps it out; the device is now ready but the target page is not in memory, so the I/O waits for the process to come back, while the process waits for the I/O. One process is enough.</li>
      </ul>
      <p>The fix is a <b>system buffer</b> in the OS’s own memory. The device fills (or drains) the system buffer, so the process’s memory is not involved and the process can be swapped out freely. The cost is an extra copy between the system buffer and the process (time <b>M</b>) and bookkeeping about which buffer belongs to which process.</p>
      <h3>Block-oriented and stream-oriented devices</h3>
      <ul>
        <li><b>Block-oriented device:</b> stores data in fixed-size blocks, transfers one block at a time, and lets the OS ask for any block by its number. Examples: disks, SSDs, USB flash drives, memory cards (secondary storage).</li>
        <li><b>Stream-oriented device:</b> moves a flow of bytes with no block structure and no block numbers. Examples: keyboards and terminals, mice and other pointing devices, printers, communication ports, and most other devices that are not secondary storage.</li>
      </ul>
      <p>“Stream” is about structure, not speed. Block devices are buffered a block at a time; stream devices a line or a byte at a time.</p>
      <h3>Timing: no buffer, single buffer, double buffer</h3>
      <p>Let <b>T</b> = time to read one block, <b>C</b> = computing time per block between requests, <b>M</b> = time to copy a block from a system buffer into the process.</p>
      <table>
        <tr><th>Scheme</th><th>How it works</th><th>Time per block</th></tr>
        <tr><td>No buffer</td><td>The process asks, waits while the device reads into its memory, then computes. The two take turns.</td><td>T + C</td></tr>
        <tr><td>Single buffer</td><td>While the process computes on block i, the OS reads block i+1 into the system buffer (<b>read-ahead</b>, or anticipated input). The copy M overlaps nothing, because the only buffer is busy during it.</td><td>max[C, T] + M</td></tr>
        <tr><td>Double buffer (buffer swapping)</td><td>Two system buffers: the OS fills one while the other is being emptied into the process, then they swap roles. The device keeps reading during the copy.</td><td>about max[C, T]; exactly max[T, C + M]</td></tr>
      </table>
      <p><b>Estimate versus exact.</b> The classic double-buffer formula max[C, T] treats the copy as free. With that simplification, if C ≤ T the device runs at full speed, and if C > T the process never waits for I/O. But the copy still takes the process’s time, so the process needs C + M per block and the exact time is <b>max[T, C + M]</b>; the two agree whenever C + M ≤ T. Counted exactly, the dividing line is C + M against T: if T is larger the device never rests; if C + M is larger the process never waits. The slower side is the <b>bottleneck</b>: it sets the pace. (No buffer and single buffer have no such gap: T + C and max[C, T] + M are exact in this model.)</p>
      <h4>Worked example 1 (device slower): T = 10 ms, C = 4 ms, M = 1 ms</h4>
      <ul>
        <li>No buffer: 10 + 4 = 14 ms per block. The process waits 10 ms and the device rests 4 ms per block.</li>
        <li>Single buffer: max(4, 10) + 1 = 11 ms. The process waits 6 ms per block; the device rests 1 ms (during the copy).</li>
        <li>Double buffer: max(4, 10) = 10 ms, and the exact max[T, C + M] = max(10, 5) = 10 ms agrees because C + M ≤ T. The device never rests; only a faster device could help. 1,000 ÷ 10 = 100 blocks per second, against about 71 with no buffer.</li>
      </ul>
      <h4>Worked example 2 (process slower): T = 5 ms, C = 8 ms, M = 1 ms</h4>
      <ul>
        <li>No buffer: 5 + 8 = 13 ms per block.</li>
        <li>Single buffer: max(8, 5) + 1 = 9 ms. The process never waits for I/O; the device rests 4 ms per block.</li>
        <li>Double buffer: the estimate max(8, 5) = 8 ms leaves out the copy; the exact time is max[T, C + M] = max(5, 9) = <b>9 ms</b>, the value a timeline (and this guide’s exercises, which count every millisecond) gives. The process never waits for I/O; the device rests 4 ms per block. With steady times one buffer already hides the I/O here; the second buffer pays off when the device is the slower side or its speed varies.</li>
      </ul>
      <h3>Buffering stream devices</h3>
      <ul>
        <li><b>Line-at-a-time:</b> the buffer holds one line. Input reaches the process only when the user presses Enter, so the process is woken once per line, and editing (Backspace) happens inside the OS buffer. For output, the process copies a whole line into the buffer and carries on. This fits a <b>scroll-mode terminal</b>.</li>
        <li><b>Byte-at-a-time:</b> each character is handed over the moment it arrives, so the OS and the process form a small producer/consumer pair. This fits a <b>forms-mode terminal</b>, where every keystroke can matter at once.</li>
        <li><b>Double buffering a stream:</b> with two line buffers, a process writing lines need not wait unless it gets two lines ahead of the device (with one buffer it waits as soon as it is one line ahead). For byte-at-a-time streams a double buffer gives no special advantage over a single buffer twice as long.</li>
      </ul>
      <h3>Circular buffering</h3>
      <p>When a process does rapid bursts of I/O, two buffers may not be enough. A <b>circular buffer</b> is a ring of more than two system buffers run as a bounded buffer: the device (producer) fills empty slots in order, wrapping around, and the process (consumer) empties them in the same order. During a pause the device reads ahead and fills the ring; a burst then finds its blocks already waiting.</p>
      <p>Example with a device that needs 4 ms per block and a process that takes bursts of 6 blocks (1 ms each) separated by 30 ms of computing: with 2 buffers the process waits about a quarter of the time; with 6 buffers, enough for a whole burst, it never waits.</p>
      <h3>What buffering can and cannot do</h3>
      <ul>
        <li>Buffering smooths out <b>peaks</b> in I/O demand and lets device work overlap with process work.</li>
        <li>No amount of buffering lets a process keep going forever if it demands data faster, on average, than the device can supply. The buffers drain (input) or fill (output), and from then on the process waits for the device. In the example above, with only 10 ms of computing between bursts, the process waits at least a third of the time, however many buffers the ring has.</li>
        <li>Buffering does not make any single transfer faster; it changes <b>when</b> transfers happen.</li>
        <li>In a multiprogramming system, buffering is one of the tools that raise efficiency: memory and the processor stay available for other work while transfers are in progress.</li>
      </ul>`,
  });
})();
