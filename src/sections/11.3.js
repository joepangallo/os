/* =====================================================================
   11.3 Operating System Design Issues (I/O design issues)
   Original teaching material. Small helpers shared by several steps live
   inside this IIFE (no globals).
   ===================================================================== */
(function () {

  /* simulate(n, C, T, shared, H): n processes each loop forever: compute for C ms, then one I/O of T ms.
     One processor with a first-come-first-served ready queue (no preemption). I/O goes either to one shared
     disk (FCFS queue) or to a private device per process. Time advances in 1 ms ticks up to H.
     Returns the bars for the chart and the busy fractions of the processor and of every device.
     H = 0 means "the long run": the loop goes on until the whole state repeats, and the busy fractions are
     measured over that repeating cycle, so start-up effects never shift the result. */
  function simulate(n, C, T, shared, H) {
    const nd = shared ? 1 : n, long = !H;
    const ready = [], devQ = Array.from({ length: nd }, () => []);
    const devCur = Array(nd).fill(null), devLeft = Array(nd).fill(0);
    const cpuSegs = [], devSegs = Array.from({ length: nd }, () => []);
    let cur = null, curLeft = 0, cpuBusy = 0;
    const devBusy = Array(nd).fill(0);
    const seen = new Map(), hist = [];
    const add = (segs, p, t) => { const l = segs[segs.length - 1]; if (l && l.p === p && l.e === t) l.e = t + 1; else segs.push({ p, s: t, e: t + 1 }); };
    for (let i = 0; i < n; i++) ready.push(i);
    for (let t = 0; long || t < H; t++) {
      if (long) {
        const key = [cur, curLeft, ready.join(','), devQ.map((q) => q.join(',')).join('|'), devCur.join(','), devLeft.join(',')].join(';');
        if (seen.has(key)) { const t0 = seen.get(key), P = t - t0, [c0, d0] = hist[t0]; return { cpu: (cpuBusy - c0) / P, dev: devBusy.map((b, d) => (b - d0[d]) / P) }; }
        seen.set(key, t); hist.push([cpuBusy, devBusy.slice()]);
      }
      if (cur === null && ready.length) { cur = ready.shift(); curLeft = C; }
      for (let d = 0; d < nd; d++) if (devCur[d] === null && devQ[d].length) { devCur[d] = devQ[d].shift(); devLeft[d] = T; }
      if (cur !== null) { add(cpuSegs, cur, t); cpuBusy++; curLeft--; }
      for (let d = 0; d < nd; d++) if (devCur[d] !== null) { add(devSegs[d], devCur[d], t); devBusy[d]++; devLeft[d]--; }
      for (let d = 0; d < nd; d++) if (devCur[d] !== null && devLeft[d] === 0) { ready.push(devCur[d]); devCur[d] = null; }
      if (cur !== null && curLeft === 0) { devQ[shared ? 0 : cur].push(cur); cur = null; }
    }
    return { cpuSegs, devSegs, cpu: cpuBusy / H, dev: devBusy.map((b) => b / H) };
  }

  const PN = ['A', 'B', 'C', 'D'];
  const pct = (x) => (Math.round(x * 1000) / 10).toFixed(1).replace(/\.0$/, '') + '%';

  /* The three layer stacks of the I/O model, top (user side) to bottom (hardware). The first, middle and last
     rows line up across stacks; the middle block (rows 2-4) is where the three stacks differ. */
  const LAYER = {
    user: { name: 'User process', cls: 'user' },
    logical: { name: 'Logical I/O' },
    comm: { name: 'Communications architecture', subs: ['TCP', 'IP'] },
    dir: { name: 'Directory management' },
    fs: { name: 'File system' },
    phys: { name: 'Physical organization' },
    devio: { name: 'Device I/O' },
    sched: { name: 'Scheduling and control' },
    hw: { name: 'Hardware', cls: 'hw' },
  };
  const STACKS = [
    { name: 'Local peripheral device', ex: 'keyboard, printer', hw: 'Keyboard / printer', rows: [['user', 1, 1], ['logical', 2, 3], ['devio', 5, 1], ['sched', 6, 1], ['hw', 7, 1]] },
    { name: 'Communications port', ex: 'network card', hw: 'Network card', rows: [['user', 1, 1], ['comm', 2, 3], ['devio', 5, 1], ['sched', 6, 1], ['hw', 7, 1]] },
    { name: 'File system', ex: 'disk or SSD', hw: 'Disk', rows: [['user', 1, 1], ['dir', 2, 1], ['fs', 3, 1], ['phys', 4, 1], ['devio', 5, 1], ['sched', 6, 1], ['hw', 7, 1]] },
  ];
  const SHARED = new Set(['user', 'devio', 'sched', 'hw']);
  /* The worked file read used in steps 5 and 6. Every number shown about it is computed here. */
  const FX = (() => {
    const f = { path: '/home/ana/notes.txt', id: 7731, pos: 8192, want: 4096, bs: 4096, sec: 512, map: [5120, 5121, 9034, 9035], spt: 500, queued: 2 };
    f.lb = Math.floor(f.pos / f.bs);
    f.off = f.pos % f.bs;
    f.end = f.pos + f.want - 1;
    f.pb = f.map[f.lb];
    f.spb = f.bs / f.sec;
    f.s0 = f.pb * f.spb;
    f.s1 = f.s0 + f.spb - 1;
    f.track = Math.floor(f.s0 / f.spt);
    f.ts0 = f.s0 % f.spt;
    f.ts1 = f.ts0 + f.spb - 1;
    return f;
  })();
  const nf = (x) => x.toLocaleString('en-US');
  /* The keyboard and network requests traced in step 6 (and summarized in the notes). */
  const KB = { typed: 'ls' };
  KB.line = KB.typed + '\n';
  const NET = (() => {
    const n = { want: 1000, payload: 512, eth: 14, ip: 20, tcp: 20 };
    n.frame = n.eth + n.ip + n.tcp + n.payload;
    n.ipPkt = n.frame - n.eth;
    n.seg = n.ipPkt - n.ip;
    return n;
  })();
  /* layerBox(ctx, col, key, o): one layer of one stack as a button; communications architecture shows its sublayers. */
  function layerBox(ctx, col, key, o = {}) {
    const L = LAYER[key], label = key === 'hw' ? STACKS[col].hw : L.name;
    const b = ctx.h(o.tag || 'button', { type: o.tag ? null : 'button', class: 'sb ' + (L.cls || ''), onclick: o.onclick || null, 'aria-label': o.tag ? null : label + ' (' + STACKS[col].name + ')' }, ctx.h('span', {}, label),
      ...(L.subs || []).map((sname) => ctx.h('span', { class: 'sub', 'data-sub': sname }, sname)));
    if (o.style) Object.assign(b.style, o.style);
    return b;
  }

  Guide.section({
    id: '11.3',
    title: 'Operating System Design Issues',
    short: 'I/O design issues',
    summary: 'The two goals of I/O design, efficiency and generality, and the layers that turn a read into device work.',
    objectives: [
      'State the two objectives of I/O design, efficiency and generality, and explain why each one matters.',
      'Explain how multiprogramming overlaps computing with I/O, and why the disk often stays the bottleneck.',
      'Describe how general functions such as open, read, write, close, lock and unlock hide device details.',
      'Name the layers used for a local device, a communications port and a file system, and say what each layer does.',
      'Trace a read request down through the layers to the hardware and back, and relate each layer to its time scale.',
    ],
    terms: [
      ['Efficiency (I/O design goal)', 'The goal of keeping slow I/O from wasting the fast processor: overlap I/O with computing and make each device, above all the disk, do its work with as little delay as possible.'],
      ['Generality (I/O design goal)', 'The goal of handling all devices in one uniform way, so processes and the upper parts of the OS use the same few general functions for every device.'],
      ['Bottleneck', 'The slowest stage in a chain of work. It sets the pace for the whole chain, so speeding up any other stage does not help.'],
      ['Device independence', 'Being able to use the same program, unchanged, with different devices: the program names a device or file, and the OS deals with the differences.'],
      ['Layered structure (hierarchical design)', 'Organizing software as a stack of layers. Each layer does one kind of job, uses only the services of the layer directly below it, hides that layer\'s details, and offers simpler services to the layer above.'],
      ['Logical I/O', 'A layer name used in two models. In the I/O model for a local device it is the top layer, which treats the device as a logical resource reached through a device identifier and simple commands (open, close, read, write); in the file-management model (chapter 12) it is the layer that gives programs records instead of disk blocks and keeps basic data about each file.'],
      ['Device identifier (device ID)', 'A name or number the OS uses to pick out one particular device, for example the keyboard or the first printer, without the program knowing how that device is wired.'],
      ['Device I/O', 'The I/O layer that turns requested operations and their data into the exact sequences of I/O instructions, channel commands and controller orders the device needs. It may buffer data to use the device better.'],
      ['Scheduling and control', 'The lowest I/O software layer: it queues and orders I/O operations, starts them on the hardware, handles their interrupts, and collects and reports their status. It is the layer that actually talks to the I/O module.'],
      ['Communications architecture', 'The layer that replaces logical I/O for a communications port. It is itself a stack of layers (for example TCP/IP) that turn a program\'s data into packets and back.'],
      ['Protocol', 'An agreed set of rules for the format, order and meaning of the messages two communicating parties exchange.'],
      ['TCP/IP', 'The family of protocols the Internet runs on. IP moves packets from computer to computer; TCP, on top of it, gives programs a reliable, in-order stream of bytes.'],
      ['Directory management', 'The top layer of the file-system I/O stack: it converts symbolic file names into the internal identifiers the file system uses, and carries out directory operations such as adding, deleting and reorganizing entries.'],
      ['Symbolic file name', 'A file name chosen for people, such as notes.txt or /home/ana/notes.txt. The OS translates it into an internal identifier before it uses the file.'],
      ['File system layer', 'The layer below directory management: it deals with the logical structure of files and with the operations users ask for (open, close, read, write), and it enforces access rights.'],
      ['Access rights', 'The permissions that say which users or processes may do which operations, such as read, write, execute or delete, on a file.'],
      ['Physical organization', 'In the file-system I/O stack, the layer that turns logical references to files and records into physical addresses on secondary storage (tracks and sectors). It also allocates disk space and main-memory buffers. (Chapter 7 uses the same name for a memory-management requirement.)'],
      ['Track', 'One of the concentric rings on a disk surface along which data are recorded.'],
      ['Sector', 'A fixed-size piece of a track, and the smallest unit a disk reads or writes: traditionally 512 bytes, 4096 bytes on many newer drives.'],
    ],
    css: `
      .sec-11-3 svg .pc0 { fill: color-mix(in srgb, var(--cpu) 30%, var(--panel)); stroke: var(--cpu); }
      .sec-11-3 svg .pc1 { fill: color-mix(in srgb, var(--mem) 30%, var(--panel)); stroke: var(--mem); }
      .sec-11-3 svg .pc2 { fill: color-mix(in srgb, var(--io) 30%, var(--panel)); stroke: var(--io); }
      .sec-11-3 svg .pc3 { fill: color-mix(in srgb, var(--os) 30%, var(--panel)); stroke: var(--os); }
      .sec-11-3 .tk { display: inline-block; width: 14px; height: 14px; border-radius: 4px; border: 2px solid; vertical-align: -2px; margin-right: 3px; }
      .sec-11-3 .tk.pc0 { background: color-mix(in srgb, var(--cpu) 30%, var(--panel)); border-color: var(--cpu); }
      .sec-11-3 .tk.pc1 { background: color-mix(in srgb, var(--mem) 30%, var(--panel)); border-color: var(--mem); }
      .sec-11-3 .tk.pc2 { background: color-mix(in srgb, var(--io) 30%, var(--panel)); border-color: var(--io); }
      .sec-11-3 .tk.pc3 { background: color-mix(in srgb, var(--os) 30%, var(--panel)); border-color: var(--os); }
      .sec-11-3 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-11-3 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-3 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-3 .stat { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .sec-11-3 .stat .v { font-size: 26px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
      .sec-11-3 .ui-slider { font-size: 14.5px; }
      .sec-11-3 .gmx { display: grid; grid-template-columns: 96px repeat(3, minmax(0, 1fr)); gap: 6px; align-items: stretch; }
      .sec-11-3 .gmx .hd { font-weight: 800; font-size: 14.5px; text-align: center; padding: 4px 6px; border-radius: 9px; background: var(--io-bg); color: var(--io); }
      .sec-11-3 .gmx .fn { display: flex; align-items: center; font-family: var(--mono); font-weight: 700; font-size: 14.5px; color: var(--os); }
      .sec-11-3 .gmx .cell { text-align: left; padding: 6px 9px; border-radius: 9px; border: 1px solid var(--line-2); background: var(--panel); color: var(--ink); font-size: 14px; line-height: 1.25; cursor: pointer; min-height: 44px; }
      .sec-11-3 .gmx .cell:hover { border-color: var(--chc); }
      .sec-11-3 .gmx .cell.na { color: var(--muted); font-style: italic; }
      .sec-11-3 .gmx .cell.on { border: 2px solid var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); }
      .sec-11-3 .lad { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 6px 10px; align-items: center; }
      .sec-11-3 .lad .lb { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; text-align: left; min-height: 44px; padding: 4px 10px; border-radius: 10px; border: 2px solid var(--os); background: var(--os-bg); color: var(--ink); font-size: 15px; font-weight: 750; cursor: pointer; }
      .sec-11-3 .lad .lb.user { border-color: var(--proc); background: var(--proc-bg); }
      .sec-11-3 .lad .lb.hw { border-color: var(--io); background: var(--io-bg); }
      .sec-11-3 .lad .lb.on { box-shadow: 0 0 0 3px var(--hl); }
      .sec-11-3 .lad .lb.yes { outline: 3px solid var(--warn); outline-offset: 1px; }
      .sec-11-3 .lad .lb.right { outline: 3px solid var(--ok); outline-offset: 1px; }
      .sec-11-3 .lad .lb.wrong { outline: 3px dashed var(--bad); outline-offset: 1px; }
      .sec-11-3 .lad .lb .xs { font-weight: 650; color: var(--ink-2); }
      .sec-11-3 .lad .trk { position: relative; height: 30px; border-radius: 8px; background: var(--panel-3); }
      .sec-11-3 .lad .trk i { position: absolute; top: 3px; bottom: 3px; border-radius: 6px; background: color-mix(in srgb, var(--chc) 35%, var(--panel)); border: 1.5px solid var(--chc); display: grid; place-items: center; font-style: normal; font-size: 13px; font-weight: 700; white-space: nowrap; }
      .sec-11-3 .lad .axis { position: relative; height: 18px; font-size: 13px; color: var(--muted); }
      .sec-11-3 .lad .axis span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
      .sec-11-3 .stk3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: auto repeat(7, minmax(0, 1fr)); gap: 6px 10px; height: 100%; }
      .sec-11-3 .stk3 .ch { text-align: center; line-height: 1.2; padding-bottom: 2px; }
      .sec-11-3 .sb { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; text-align: center; padding: 3px 8px; border-radius: 10px; border: 2px solid var(--os); background: var(--os-bg); color: var(--ink); font-size: 15px; font-weight: 750; line-height: 1.2; cursor: pointer; min-height: 0; transition: opacity .2s; }
      .sec-11-3 .sb.user { border-color: var(--proc); background: var(--proc-bg); }
      .sec-11-3 .sb.hw { border-color: var(--io); background: var(--io-bg); }
      .sec-11-3 .sb.on { box-shadow: 0 0 0 3px var(--hl); }
      .sec-11-3 .sb.dim { opacity: .3; }
      .sec-11-3 .sb .sub { display: block; width: 78%; font-size: 13px; font-weight: 700; padding: 1px 0; border-radius: 6px; border: 1px dashed var(--os); background: var(--panel); }
      .sec-11-3 .sb.cur { box-shadow: 0 0 0 4px var(--chc); }
      .sec-11-3 .sb .sub.cur { background: var(--hl); border-style: solid; }
      .sec-11-3 .rcol { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
      .sec-11-3 .rcol .sb { cursor: default; flex-basis: 0; }
      .sec-11-3 .see { font-family: var(--mono); font-size: 15px; line-height: 1.5; white-space: pre-wrap; background: var(--panel-3); border-radius: 10px; padding: 8px 12px; border-left: 5px solid var(--chc); }
      .sec-11-3 .rlog { font-size: 13px; }
    `,
    steps: [
      {
        title: 'Two goals for the I/O system',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Programs want I/O to be fast and simple. Devices are slow and all different (section 11.1). The OS stands between them, and its I/O design aims at two objectives:</p>
              <div class="card tight cpu m0"><b><span class="t">Efficiency</span>.</b> I/O is the slowest part of the system. Keep the processor busy while devices work, and make each device, above all the disk that files and swapping depend on, waste as little time as possible.</div>
              <div class="card tight os m0"><b><span class="t">Generality</span>.</b> Treat every device the same way where possible: programs see all devices through a few general functions, and the device details hide in low-level routines.</div>
              <div class="callout analogy m0" data-label="Analogy">A restaurant kitchen: the cook starts the next dish while the oven bakes (efficiency), and every order comes on the same kind of ticket, which each station turns into its own work (generality).</div>
              <div class="row gap-s small"><span class="chip cpu">overlap CPU and I/O</span><span class="chip os">one read() for all devices</span><span class="chip proc">trace a request</span></div>
            </div>
            <div class="card stack" style="gap:9px">
              <h4 class="m0">Why generality pays off</h4>
              <div class="row g-ctl"></div>
              <div class="g-sl"></div>
              <div class="card white grow g-fig" style="display:grid;place-items:center;padding:6px"></div>
              <div class="grid-2 g-stats"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const progs = ['Editor', 'Browser', 'Backup'];
          const devNames = ['Keyboard', 'Disk', 'Network', 'Printer', 'Camera'];
          let mode = 'mesh', m = 4;
          const W = ctx.narrow ? 340 : 600, H = 230, fs = ctx.narrow ? 13 : 15, fw = ctx.narrow ? 600 : 700;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Programs connected to devices' });
          const stats = ctx.$('.g-stats');
          function boxes(names, y, cls, bw) {
            const n = names.length, gap = 8, w = Math.min(bw, (W - 20 - gap * (n - 1)) / n);
            const x0 = (W - (n * w + gap * (n - 1))) / 2;
            return names.map((nm, i) => ({ nm, x: x0 + i * (w + gap), y, w, cx: x0 + i * (w + gap) + w / 2, cls }));
          }
          function rect(b, hgt) {
            return s('g', {}, s('rect', { x: b.x, y: b.y, width: b.w, height: hgt, rx: 9, class: b.cls, 'stroke-width': 2 }),
              s('text', { x: b.cx, y: b.y + hgt / 2 + fs * 0.35, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': fw }, b.nm));
          }
          function draw() {
            const P = boxes(progs, 8, 's-proc', 150), D = boxes(devNames.slice(0, m), H - 42, 's-io', 120);
            const kids = [];
            if (mode === 'mesh') {
              P.forEach((p) => D.forEach((d) => kids.push(s('line', { x1: p.cx, y1: 42, x2: d.cx, y2: H - 42, class: 's-line', 'stroke-width': 1.6, opacity: 0.75 }))));
              const lab = ctx.narrow ? 'line = device code in a program' : 'each line = device code inside a program', lw = Math.min(W - 10, lab.length * fs * 0.5 + 16);
              kids.push(s('rect', { x: W / 2 - lw / 2, y: H / 2 - 22, width: lw, height: 26, rx: 13, style: 'fill:var(--panel);stroke:var(--line-2)' }),
                s('text', { x: W / 2, y: H / 2 - 4, 'text-anchor': 'middle', 'font-size': ctx.narrow ? fs : fs - 1, class: 's-sub' }, lab));
            } else {
              const band = { x: 10, y: 66, w: W - 20 };
              const Dr = boxes(devNames.slice(0, m).map(() => 'driver'), 128, 's-os', 120);
              P.forEach((p) => kids.push(s('line', { x1: p.cx, y1: 42, x2: p.cx, y2: band.y, class: 's-line', 'marker-end': 'url(#arr)' })));
              kids.push(s('rect', { x: band.x, y: band.y, width: band.w, height: 34, rx: 9, class: 's-os', 'stroke-width': 2 }),
                s('text', { x: W / 2, y: band.y + 22, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 700, class: 's-monot' }, ctx.narrow ? 'open read write close …' : 'open · read · write · close · lock · unlock'));
              Dr.forEach((d, i) => { kids.push(s('line', { x1: d.cx, y1: band.y + 34, x2: d.cx, y2: 128, class: 's-line' }), s('line', { x1: d.cx, y1: 158, x2: D[i].cx, y2: H - 42, class: 's-line' })); });
              Dr.forEach((d) => kids.push(rect(d, 30)));
            }
            P.forEach((p) => kids.push(rect(p, 34)));
            D.forEach((d) => kids.push(rect(d, 34)));
            svg.replaceChildren(...kids);
            const mesh = mode === 'mesh';
            stats.replaceChildren(
              h('div', { class: 'card tight white stack', style: { gap: '2px' } }, h('span', { class: 'xs muted b' }, 'Pieces of device-specific code'),
                h('span', { class: 'b', style: { fontSize: '22px' }, html: mesh ? `${progs.length} × ${m} = ${progs.length * m}` : `${m} drivers` }),
                h('span', { class: 'xs muted' }, mesh ? 'scattered through every program' : 'all inside the OS; programs hold none')),
              h('div', { class: 'card tight white stack', style: { gap: '2px' } }, h('span', { class: 'xs muted b' }, 'Work to support one new device'),
                h('span', { class: 'b', style: { fontSize: '22px' } }, mesh ? `change ${progs.length} programs` : 'write 1 driver'),
                h('span', { class: 'xs muted' }, mesh ? 'and every program written later' : 'every program can use it at once')));
          }
          ctx.$('.g-ctl').append(ctx.ui.seg([{ value: 'mesh', label: 'Each program drives each device' }, { value: 'gen', label: 'One general interface' }], mode, (v) => { mode = v; draw(); }));
          ctx.$('.g-sl').append(ctx.ui.slider({ label: 'Devices', min: 2, max: 5, value: m, onInput: (v) => { m = v; draw(); } }));
          ctx.$('.g-fig').append(svg);
          draw();
        },
      },
      {
        title: 'Efficiency: keep the processor busy while I/O crawls',
        kind: 'explore',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">I/O is usually the <span class="t">bottleneck</span>. A processor runs billions of instructions per second, but one hard-disk access takes several milliseconds: time enough for over ten million instructions.</p>
              <p class="m0"><span class="t">Multiprogramming</span> is the main cure: while one process waits for its I/O, another one computes. Even so, I/O may not keep up. When memory holds too few ready processes, the OS brings more in by <span class="t">swapping</span>, and swapping is itself disk I/O, competing for the very device that is already the slowest.</p>
              <div class="callout why m0" data-label="Why it matters">This is why disk I/O gets the most attention in I/O design. Four of the next sections serve it: buffering (11.4), disk scheduling (11.5), RAID (11.6) and the disk cache (11.7).</div>
              <div class="callout tip m0" data-label="Try it">Each process computes for <b>C</b> ms, then does one I/O of <b>T</b> ms, again and again. Add processes, then compare one shared disk with a device each.</div>
            </div>
            <div class="stack" style="gap:8px">
              <div class="row e-ctl" style="gap:8px"></div>
              <div class="grid-2 e-sl" style="gap:6px 16px"></div>
              <div class="card white grow e-fig" style="display:flex;flex-direction:column;justify-content:center;gap:4px;padding:8px 10px"></div>
              <div class="grid-3 e-stats" style="gap:8px"></div>
              <div class="narr e-narr"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          let n = 1, shared = true, C = 4, T = 8;
          const HWIN = 60;
          const fig = ctx.$('.e-fig'), stats = ctx.$('.e-stats'), narr = ctx.$('.e-narr');
          const W = ctx.narrow ? 380 : 640, LW = ctx.narrow ? 54 : 74, fs = 14;
          const px = (W - LW - 10) / HWIN;
          function chart(r, nd) {
            const rows = ['CPU'].concat(shared ? ['Disk'] : PN.slice(0, nd).map((p) => (ctx.narrow ? 'Dev ' : 'Device ') + p));
            const RH = rows.length <= 2 ? 40 : rows.length <= 3 ? 34 : 28;
            const Hh = rows.length * (RH + 6) + 24;
            const svg = s('svg', { viewBox: `0 0 ${W} ${Hh}`, width: '100%', role: 'img', 'aria-label': 'Timeline of the processor and the I/O devices' });
            rows.forEach((lab, i) => {
              const y = i * (RH + 6) + 2;
              svg.append(s('text', { x: LW - 8, y: y + RH / 2 + 5, 'text-anchor': 'end', 'font-size': fs, 'font-weight': 700, style: i === 0 ? 'fill:var(--cpu)' : 'fill:var(--io)' }, lab),
                s('rect', { x: LW, y, width: HWIN * px, height: RH, rx: 5, class: 's-panel', 'stroke-width': 1 }));
              const segs = i === 0 ? r.cpuSegs : r.devSegs[i - 1];
              segs.forEach((g) => {
                const w = (g.e - g.s) * px;
                svg.append(s('rect', { x: LW + g.s * px + 0.5, y: y + 2, width: Math.max(1, w - 1), height: RH - 4, rx: 4, class: 'pc' + g.p, 'stroke-width': 1.5 }));
                if (w >= 16) svg.append(s('text', { x: LW + (g.s + g.e) / 2 * px, y: y + RH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, PN[g.p]));
              });
            });
            const yA = rows.length * (RH + 6) + 4;
            for (let t = 0; t <= HWIN; t += 10) {
              svg.append(s('line', { x1: LW + t * px, y1: yA - 4, x2: LW + t * px, y2: yA + 2, class: 's-line', 'stroke-width': 1 }),
                s('text', { x: LW + t * px, y: yA + 16, 'text-anchor': t === 0 ? 'start' : t === HWIN ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, t + (t === HWIN ? ' ms' : '')));
            }
            return svg;
          }
          function stat(label, value, note, color) {
            return h('div', { class: 'card tight white stat' }, h('span', { class: 'xs muted b' }, label), h('span', { class: 'v', style: { color } }, value), h('span', { class: 'xs muted' }, note));
          }
          function update() {
            const nd = shared ? 1 : n;
            const r = simulate(n, C, T, shared, HWIN), lr = simulate(n, C, T, shared, 0), one = simulate(1, C, T, shared, 0);
            const legend = h('div', { class: 'row xs muted', style: { gap: '10px', justifyContent: 'center' } },
              ...PN.slice(0, n).map((p, i) => h('span', { html: `<i class="tk pc${i}"></i>process ${p}` })), h('span', {}, 'first 60 ms; empty = idle'));
            fig.replaceChildren(chart(r, nd), legend);
            const devBusy = lr.dev.reduce((a, b) => a + b, 0) / lr.dev.length;
            const diskBound = shared && lr.dev[0] >= 0.995 && lr.cpu < 0.995;
            const bott = lr.cpu >= 0.995 ? 'processor' : diskBound ? 'the disk' : 'none yet';
            stats.replaceChildren(
              stat('Processor busy (long run)', pct(lr.cpu), n === 1 ? 'one process only' : 'with one process: ' + pct(one.cpu), 'var(--cpu)'),
              stat(shared ? 'Disk busy (long run)' : 'Each device busy (avg.)', pct(devBusy), shared ? 'one shared device' : n + ' separate devices', 'var(--io)'),
              stat('Bottleneck', bott, 'stage that sets the pace', diskBound ? 'var(--bad)' : lr.cpu >= 0.995 ? 'var(--ok)' : 'var(--ink-2)'));
            let txt, cls = '';
            if (n === 1) txt = `<b>One process:</b> the processor and the device simply take turns, so the processor is busy only C/(C+T) = ${C}/${C + T} = <b>${pct(lr.cpu)}</b> of the time. While the process waits for its I/O, nothing else can run.`;
            else if (lr.cpu >= 0.995) { cls = 'ok'; txt = `<b>Fully overlapped.</b> While some processes wait for I/O, another always has work, so the processor is busy ${pct(lr.cpu)} of the time (${pct(one.cpu)} with one process). Now the processor sets the pace, which is what we want.`; }
            else if (diskBound) { cls = 'bad'; txt = `<b>The shared disk is the bottleneck</b>: it is busy ${pct(lr.dev[0])} of the time. It finishes one ${T} ms I/O at a time, and each I/O lets one ${C} ms burst follow, so the processor can be busy at most C/T = ${C}/${T} = <b>${pct(C / T)}</b>. More processes only lengthen the disk queue.`; }
            else txt = `<b>Overlap helps:</b> the processor is busy ${pct(lr.cpu)} instead of ${pct(one.cpu)} with one process. Idle gaps remain whenever every process is waiting for I/O at the same moment; more processes would fill them.`;
            narr.className = 'narr e-narr ' + cls;
            narr.innerHTML = txt;
          }
          const ctl = ctx.$('.e-ctl');
          ctl.append(h('span', { class: 'small b' }, 'Processes'), ctx.ui.seg([1, 2, 3, 4], n, (v) => { n = v; update(); }),
            ctx.ui.seg([{ value: 'shared', label: 'One shared disk' }, { value: 'own', label: 'A device each' }], 'shared', (v) => { shared = v === 'shared'; update(); }));
          ctx.$('.e-sl').append(
            ctx.ui.slider({ label: 'Compute C', min: 1, max: 12, value: C, format: (v) => v + ' ms', onInput: (v) => { C = v; update(); } }),
            ctx.ui.slider({ label: 'I/O time T', min: 1, max: 12, value: T, format: (v) => v + ' ms', onInput: (v) => { T = v; update(); } }));
          update();
        },
      },
      {
        title: 'Generality: the same calls for every device',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Generality means one way of talking to every device.</p>
              <p class="m0">The OS hides the details of each device in low-level routines, such as the <span class="t">device drivers</span>. Processes, and the upper parts of the OS itself, then see every device through the same general functions: <code>open</code>, <code>close</code>, <code>read</code>, <code>write</code>, <code>lock</code> and <code>unlock</code>.</p>
              <p class="m0">The payoff is <span class="t">device independence</span>. The UNIX <code>sort</code> program reads whatever it is handed: typed alone, <code>sort</code> reads the keyboard; typed as <code>sort &lt; names.txt</code>, it reads a file. The program is not changed, or even recompiled.</p>
              <div class="callout warn m0" data-label="Common mistake">Generality does not mean every device can do everything. You cannot read from a printer; the general call just returns an error code. Devices differ so much that perfect uniformity is impossible, so device-specific settings (a terminal's line speed, ejecting a disc) go through an escape hatch, <code>ioctl</code> on UNIX-like systems.</div>
            </div>
            <div class="stack" style="gap:8px">
              <p class="small m0">Your program makes <b>the same call</b> in every column. Click a cell to see what the routines <b>below</b> the general interface do for that device.</p>
              <div class="gmx"></div>
              <div class="card white grow g-det stack" style="gap:6px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const devs = ['Keyboard', 'Disk file', 'Network connection'];
          const fns = [
            { f: 'open', code: 'fd = open(name, mode);' },
            { f: 'read', code: 'n = read(fd, buf, 512);' },
            { f: 'write', code: 'write(fd, buf, n);' },
            { f: 'lock / unlock', code: 'lock(fd);  …  unlock(fd);' },
            { f: 'close', code: 'close(fd);' },
          ];
          const cells = [
            [['check access, find driver', 'The OS checks that this process may use the terminal, sees that the name refers to the keyboard\'s driver, and hands back a descriptor (a <span class="t">file descriptor</span>). The keyboard hardware is not touched at all.'],
              ['name → file ID, check rights', 'Directory management turns the name into the file\'s internal identifier, the file system checks the access rights, and a record describing the open file is set up. The disk is read only if the directory entries are not already in memory.'],
              ['build a connection', 'The communications software sets up a connection with the remote computer, which takes an exchange of set-up packets. On UNIX-like systems this step uses <code>socket</code> and <code>connect</code> instead of <code>open</code>, but the descriptor they return works with the same read, write and close.']],
            [['wait for a typed line', 'If nothing has been typed, the process is blocked. Each key press raises an interrupt; the driver turns the key code into a character and, in the usual line-at-a-time mode, collects characters until Enter, then wakes the process and copies the whole line into its buffer.'],
              ['find the block, maybe read the disk', 'The file system works out which block of the file holds the requested bytes and where that block sits on the disk. If a copy is already in memory, it is copied at once; otherwise a disk request is queued, the process blocks, and the disk\'s interrupt wakes it when the block has arrived.'],
              ['wait for packets, unwrap them', 'If no data has arrived on this connection, the process blocks. When the network card delivers a packet, each protocol layer checks and removes its own header, and the data bytes are copied to the process.']],
            [['nothing to write to', 'A keyboard only produces data, so it cannot accept any. On UNIX-like systems the keyboard and screen together form one terminal device, so a write on this descriptor goes to the screen; a pure input device would refuse it with an error code.', true],
              ['copy to a buffer, write later', 'The bytes are copied into a buffer in main memory, and the call usually returns at once. The changed block is written to the disk a little later; if the file grows, the file system first allocates a new block for it.'],
              ['wrap in packets and send', 'The bytes are cut into packets. Each protocol layer adds its own header (TCP, then IP), and the network card\'s driver hands the finished frames to the card, which sends them.']],
            [['seldom needed', 'Seldom needed. A terminal already decides who gets the keystrokes: on UNIX-like systems only the program running in the foreground may read them.', true],
              ['hold the file, then release it', '<code>lock</code> marks the file (or a byte range) as held by this process; another process asking for a conflicting lock waits until <code>unlock</code> releases it. On UNIX-like systems (<code>flock</code>, <code>fcntl</code>) these locks are advisory by default: they bind only processes that also ask for a lock. Windows enforces its locks on everyone.'],
              ['seldom needed', 'Seldom needed: a connection normally belongs to one process, so there is nobody to lock out. Programs that share a connection coordinate in their own way.', true]],
            [['stop delivering keys', 'The driver stops delivering keystrokes to this process, and the descriptor number is freed so a later open can reuse it.'],
              ['free records; data go out later', 'The in-memory records about the open file are released and the descriptor number is freed. Changed blocks still waiting in memory are written to the disk on the OS\'s own schedule, so on UNIX-like systems close does not prove the data are on the disk; a program that must be sure calls <code>fsync</code> first.'],
              ['tell the other side, free', 'The communications software finishes sending any data still queued, tells the other side that the connection is ending, and frees the descriptor.']],
          ];
          const grid = ctx.$('.gmx'), det = ctx.$('.g-det');
          if (ctx.narrow) Object.assign(grid.style, { gridTemplateColumns: '56px repeat(3, minmax(0, 1fr))', gap: '4px' });
          const btns = [];
          grid.append(h('div'), ...devs.map((d) => h('div', { class: 'hd' }, ctx.narrow && d === 'Network connection' ? 'Network' : d)));
          fns.forEach((fn, r) => {
            grid.append(h('div', { class: 'fn' }, fn.f));
            devs.forEach((d, c) => {
              const [short, , na] = cells[r][c];
              const b = h('button', { type: 'button', class: 'cell' + (na ? ' na' : ''), 'aria-label': fn.f + ' on ' + d + ': ' + short, onclick: () => show(r, c) }, short);
              btns.push({ b, r, c });
              grid.append(b);
            });
          });
          function show(r, c) {
            btns.forEach((x) => x.b.classList.toggle('on', x.r === r && x.c === c));
            const [short, long, na] = cells[r][c];
            det.replaceChildren(
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'chip os' }, fns[r].f), h('span', { class: 'xs muted b' }, 'on a'), h('span', { class: 'chip io' }, devs[c]), na ? h('span', { class: 'chip warn' }, 'limited') : null),
              h('div', { class: 'small', html: `<b>Your program:</b> <code>${fns[r].code}</code> <span class="muted">(identical in all three columns)</span>` }),
              h('div', { class: 'small', style: { lineHeight: '1.45' }, html: '<b>Below the interface:</b> ' + long }));
          }
          show(1, 1);
        },
      },
      {
        title: 'Layers, and the clock each layer lives by',
        kind: 'learn',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">To reach generality, the I/O software is built as a <span class="t">layered structure</span>, the same idea section 2.1 used to picture a whole computer.</p>
              <ul class="m0" style="display:flex;flex-direction:column;gap:5px">
                <li>Each layer does <b>one kind of job</b> and relies on the layer just below it for more primitive work.</li>
                <li>It <b>hides</b> the details of the lower layers and offers simpler services to the layer above.</li>
                <li>Ideally, a layer can be <b>replaced</b> without changing the others.</li>
                <li>Layers follow the <b>time scale</b> of their work: near the hardware, events take nanoseconds or microseconds; near the user, milliseconds to seconds.</li>
              </ul>
              <div class="callout why m0" data-label="Why it matters">Fast, low-level events are handled close to the hardware, without involving the slow upper layers; the upper layers can deal in whole requests and never see a single bus cycle or interrupt.</div>
            </div>
            <div class="stack" style="gap:8px">
              <div class="row l-ctl"><span class="xs muted">The simplest stack: a local device such as a keyboard or printer.</span></div>
              <div class="lad"></div>
              <div class="card white grow l-det stack" style="gap:5px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const L = [
            { k: 'user', name: 'User process', cls: 'user', r: [-2, 1], lab: '10 ms – 10 s', change: false,
              job: 'Your program. It asks for I/O with system calls such as read and write, and knows nothing about how the device is built or controlled.',
              hides: 'Nothing below it to hide: it is the customer of the stack.',
              ts: 'Whole tasks, from milliseconds up to the seconds a person notices.' },
            { k: 'log', name: 'Logical I/O', cls: '', r: [-5, -1], lab: '10 µs – 0.1 s', change: false,
              job: 'Treats the device as a logical resource: a process names it with a <span class="t">device identifier</span> and uses simple commands such as open, close, read and write.',
              hides: 'What kind of device it is and every detail of controlling it.',
              ts: 'Complete requests: one whole read or write.' },
            { k: 'dev', name: 'Device I/O', cls: '', r: [-6, -2], lab: '1 µs – 10 ms', change: true,
              job: 'Turns each requested operation and its data into the exact I/O instructions, <span class="t" data-t="I/O channel">channel</span> commands and controller orders the device needs. It may buffer data to keep the device busy.',
              hides: 'The command language and data formats of this particular device.',
              ts: 'Single device operations: microseconds on fast devices, milliseconds on a disk.' },
            { k: 'sch', name: 'Scheduling and control', cls: '', r: [-7, -4], lab: '0.1 – 100 µs', change: true,
              job: 'Queues and orders the I/O operations, starts each one, handles the <span class="t">interrupt</span>s, and collects and reports status. It is the software layer that actually talks to the <span class="t">I/O module</span>.',
              hides: 'Queues, timing, interrupts, errors and retries.',
              ts: 'Single hardware events: an interrupt is handled in microseconds.' },
            { k: 'hw', name: 'Hardware', cls: 'hw', r: [-9, -6], lab: '1 ns – 1 µs', change: true,
              job: 'The I/O module (the <span class="t" data-t="device controller">device controller</span>) and the device itself: registers, signals and the physical medium.',
              hides: 'It is the bottom of the stack.',
              ts: 'Bus cycles and register accesses: nanoseconds.' },
          ];
          const D0 = -9, D1 = 1, pos = (v) => ((v - D0) / (D1 - D0)) * 100;
          const lad = ctx.$('.lad'), det = ctx.$('.l-det');
          let mode = 'explore', sel = 1, checked = false;
          const pick = L.map(() => false);
          const btns = L.map((l, i) => h('button', { type: 'button', class: 'lb ' + l.cls, onclick: () => click(i) },
            h('span', {}, l.name), ctx.narrow ? h('span', { class: 'xs' }, l.lab) : null));
          L.forEach((l, i) => {
            const bar = h('i', { style: { left: pos(l.r[0]) + '%', width: (pos(l.r[1]) - pos(l.r[0])) + '%' } }, ctx.narrow ? '' : l.lab);
            lad.append(btns[i], h('div', { class: 'trk' }, bar));
          });
          lad.append(h('div', { class: 'xs muted', style: { textAlign: 'right' } }, ctx.narrow ? 'rough' : 'rough orders of magnitude'),
            h('div', { class: 'axis' }, ...[[-9, '1 ns'], [-6, '1 µs'], [-3, '1 ms'], [0, '1 s']].map(([v, t]) => h('span', { style: { left: pos(v) + '%', transform: v === D0 ? 'none' : null } }, t))));
          function paint() {
            btns.forEach((b, i) => {
              b.classList.toggle('on', mode === 'explore' && i === sel);
              b.classList.toggle('yes', mode === 'predict' && !checked && pick[i]);
              b.classList.toggle('right', mode === 'predict' && checked && pick[i] === L[i].change);
              b.classList.toggle('wrong', mode === 'predict' && checked && pick[i] !== L[i].change);
              b.setAttribute('aria-pressed', mode === 'predict' ? String(pick[i]) : String(i === sel));
            });
            if (mode === 'explore') {
              const l = L[sel];
              det.replaceChildren(h('div', { class: 'b', style: { fontSize: '17px' } }, l.name),
                h('div', { html: '<b>Its job:</b> ' + l.job }),
                h('div', { html: '<b>Hides:</b> ' + l.hides }),
                h('div', { html: '<b>Time scale:</b> ' + l.ts }));
            } else if (!checked) {
              det.replaceChildren(h('div', { class: 'small', html: '<b>Predict.</b> You replace an old printer on a parallel port with a new USB printer that speaks a different printer language (the commands that describe a page). Click every layer that <b>must change</b>, then check.' }),
                h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn sm primary', onclick: () => { checked = true; paint(); } }, 'Check'), h('span', { class: 'xs muted' }, pick.filter(Boolean).length + ' marked as changing')));
            } else {
              const ok = pick.every((p, i) => p === L[i].change);
              det.replaceChildren(h('div', { class: 'small b', style: { color: ok ? 'var(--ok)' : 'var(--bad)' } }, ok ? 'All five right. Only the bottom three layers change.' : 'Not quite: green outlines are right, dashed red ones are wrong.'),
                h('div', { class: 'small', style: { lineHeight: '1.45' }, html: '<b>Unchanged:</b> the user process and logical I/O. They only use device IDs and general functions, which never mention the hardware. <b>Changed:</b> device I/O (pages must be put into a different printer language, so a different driver), scheduling and control (requests now go through the USB controller, with its own queues, interrupts and status reports), and of course the hardware.' }),
                h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn sm', onclick: () => { pick.fill(false); checked = false; paint(); } }, 'Try again')));
            }
          }
          function click(i) {
            if (mode === 'explore') sel = i;
            else if (!checked) pick[i] = !pick[i];
            paint();
          }
          ctx.$('.l-ctl').prepend(ctx.ui.seg([{ value: 'explore', label: 'Explore the layers' }, { value: 'predict', label: 'Predict: swap the printer' }], mode, (v) => { mode = v; paint(); }));
          paint();
        },
      },
      {
        title: 'Three stacks: local device, network port, file system',
        kind: 'explore',
        core: true,
        html: `
          <div class="split r fill">
            <div class="stk3"></div>
            <div class="stack" style="gap:8px">
              <p class="m0">The layers depend on what the I/O is for. Three common cases share their <b>bottom</b> layers and differ in the <b>middle</b>. Click any layer.</p>
              <div class="t3-seg"></div>
              <div class="card white grow t3-det stack" style="gap:6px"></div>
              <div class="callout why m0" data-label="Why it matters">The bottom layers are reused by everything above them. One disk driver serves every file on the disk; one network driver serves every connection.</div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const INFO = {
            user: ['The program that wants the I/O. It sees only the general functions and never the layers below.',
              ['A shell reading a typed command, or an editor printing a page.', 'A browser downloading a web page.', 'A program reading the file notes.txt.']],
            logical: ['Treats the device as a logical resource. It manages the general I/O functions for processes, which name the device with a <span class="t">device identifier</span> and use simple commands: open, close, read, write. How the device is controlled is not its concern.',
              ['read 100 characters from the keyboard; write a page to printer 1.']],
            comm: ['Takes the place of logical I/O for a communications port. It is itself several layers, for example <span class="t">TCP/IP</span>: TCP gives programs a reliable, in-order stream of bytes, and IP moves <span class="t">packet</span>s from computer to computer. On the way out each layer adds its own header; on the way in each removes one.',
              [null, 'Send these bytes to the web server; deliver its reply bytes in order, with nothing missing.']],
            dir: ['Converts <span class="t">symbolic file name</span>s into the internal identifiers the file system uses, which point to the file directly or through a descriptor record or index table. It also carries out directory operations such as adding, deleting and reorganizing entries.',
              [null, null, `${FX.path} → file ${FX.id}.`]],
            fs: ['Deals with the logical structure of files and with the operations users ask for: open, close, read, write. <span class="t">Access rights</span> are checked here.',
              [null, null, `May ana read file ${FX.id}? Yes. Bytes ${FX.pos} to ${FX.end} are wanted, which is logical block ${FX.lb} of the file.`]],
            phys: ['Turns logical references to files and records into physical addresses on secondary storage, allowing for the <span class="t">track</span> and <span class="t">sector</span> structure of the device, much as virtual memory turns virtual addresses into physical ones. It also allocates disk space and main-memory buffers.',
              [null, null, `Logical block ${FX.lb} of file ${FX.id} is disk block ${nf(FX.pb)}, which is sectors ${nf(FX.s0)} to ${nf(FX.s1)}.`]],
            devio: ['Turns each requested operation and its data into the I/O instructions, channel commands and controller orders the device needs. Buffering may be used to keep the device busy.',
              ['Keyboard: turn key codes into characters and collect a line. Printer: put the page into the printer\'s command language.', 'The network driver hands outgoing frames (the units the network link carries) to the card and collects incoming ones, which the card has placed in memory by DMA.', `Build the command “read ${FX.spb} sectors starting at sector ${nf(FX.s0)}” and set aside a buffer for the data.`]],
            sched: ['Queues and schedules the I/O operations, starts them, handles the interrupts, and collects and reports status. It is the layer that actually talks to the I/O module and so to the hardware.',
              ['Print chunks wait in a queue; each time the printer interrupts to say it is ready, the next chunk is sent.', 'Handles the card\'s interrupts when frames arrive or a send finishes.', 'Disk requests wait in a queue and may be reordered to save arm movement (section 11.5); the disk\'s interrupt reports each one done.']],
            hw: ['The I/O module and the device. Everything above it is software.',
              ['Keyboard or printer and its controller.', 'The network interface card and the cable or radio link.', 'The disk drive and its controller.']],
          };
          const grid = ctx.$('.stk3'), det = ctx.$('.t3-det');
          let sel = [0, 'logical'], show = 'all';
          const boxes = [];
          STACKS.forEach((st, c) => {
            grid.append(h('div', { class: 'ch', style: { gridColumn: c + 1, gridRow: 1 } }, h('div', { class: 'b small' }, st.name), h('div', { class: 'xs muted' }, st.ex)));
            st.rows.forEach(([k, r, span]) => {
              const b = layerBox(ctx, c, k, { onclick: () => { sel = [c, k]; paint(); }, style: Object.assign({ gridColumn: c + 1, gridRow: (r + 1) + ' / span ' + span }, ctx.narrow ? { fontSize: '12.5px', padding: '3px 2px' } : {}) });
              boxes.push({ b, c, k });
              grid.append(b);
            });
          });
          function paint() {
            boxes.forEach(({ b, c, k }) => {
              b.classList.toggle('on', c === sel[0] && k === sel[1]);
              b.classList.toggle('dim', (show === 'shared' && !SHARED.has(k)) || (show === 'diff' && SHARED.has(k)));
              b.setAttribute('aria-pressed', String(c === sel[0] && k === sel[1]));
            });
            const [c, k] = sel, [does, ex] = INFO[k];
            const name = k === 'hw' ? 'Hardware' : LAYER[k].name;
            const ins = SHARED.has(k) ? 'in all three stacks' : 'only in the ' + STACKS[c].name.toLowerCase() + ' stack';
            const eg = ex[c] || ex.find(Boolean);
            det.replaceChildren(
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'b', style: { fontSize: '18px' } }, name), h('span', { class: 'chip ' + (SHARED.has(k) ? 'ok' : 'accent') }, ins)),
              h('div', { class: 'small', style: { lineHeight: '1.45' }, html: does }),
              h('div', { class: 'small', style: { lineHeight: '1.45' }, html: `<b>In the ${STACKS[c].name.toLowerCase()} stack:</b> ${eg}` }));
          }
          ctx.$('.t3-seg').append(ctx.ui.seg([{ value: 'all', label: 'All layers' }, { value: 'shared', label: 'Shared' }, { value: 'diff', label: 'Different' }], show, (v) => { show = v; paint(); }));
          paint();
        },
      },
      {
        title: 'Follow one request down the stack and back',
        kind: 'lab',
        html: `
          <div class="stack fill" style="gap:8px">
            <div class="row r-ctl"><span class="small muted">Pick a request, then step through it. Each layer sees the request in its own terms.</span></div>
            <div class="grow r-main" style="display:grid;grid-template-columns:280px minmax(0,1fr);gap:16px;min-height:0">
              <div class="rcol"></div>
              <div class="stack" style="gap:8px;min-height:0">
                <div class="row r-meta" style="gap:8px"></div>
                <div class="see r-see"></div>
                <div class="log rlog grow r-log"></div>
              </div>
            </div>
            <div class="r-player"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const F = FX, nxt = F.pos + F.want;
          const fileFrames = [
            { L: 'user', d: 'down', see: `fd = open("${F.path}", READ)`, t: 'program',
              cap: '<b>User process.</b> The program asks to open the file by its symbolic name. It knows nothing about disks, blocks or sectors.' },
            { L: 'dir', d: 'down', see: `"${F.path}"\n  → file ${F.id}`, t: 'µs (directories in memory)',
              cap: `<b>Directory management</b> looks the name up one directory at a time (home, then ana, then notes.txt) and turns it into the file's internal identifier, ${F.id}.` },
            { L: 'fs', d: 'down', see: `file ${F.id}: may ana read it?  yes\n  → open-file record, descriptor 3`, t: 'µs',
              cap: '<b>File system layer.</b> It checks the access rights (ana may read this file), records the open file, and hands the program descriptor 3.' },
            { L: 'user', d: 'down', see: `n = read(3, buf, ${F.want})\n  // file position is ${F.pos}`, t: 'program',
              cap: `<b>User process.</b> Later the program reads ${F.want} bytes. Earlier reads used the first ${F.pos} bytes, so the file position is ${F.pos}.` },
            { L: 'fs', d: 'down', see: `file ${F.id}, bytes ${F.pos}–${F.end}\n  → logical block ${F.lb}`, t: 'µs',
              cap: `<b>File system layer.</b> The file is kept in ${F.bs}-byte blocks, so bytes ${F.pos} to ${F.end} are exactly logical block ${F.pos} ÷ ${F.bs} = ${F.lb} (blocks count from 0).` },
            { L: 'phys', d: 'down', see: `logical block ${F.lb} → disk block ${nf(F.pb)}\n  = sectors ${nf(F.s0)}–${nf(F.s1)}\n  = track ${F.track}, sectors ${F.ts0}–${F.ts1}\n  + one ${F.bs}-byte buffer in memory`, t: 'µs',
              cap: `<b>Physical organization.</b> The file's block table puts logical block ${F.lb} in disk block ${nf(F.pb)}. A block is ${F.spb} sectors of ${F.sec} bytes, so that is sectors ${nf(F.pb)} × ${F.spb} = ${nf(F.s0)} to ${nf(F.s1)}: on a toy disk with ${F.spt} sectors per track, track ${F.track}. It also sets aside a buffer.` },
            { L: 'devio', d: 'down', see: `controller command:\n  READ  start sector ${nf(F.s0)}, count ${F.spb}\n  destination: the buffer (by DMA)`, t: 'µs',
              cap: `<b>Device I/O</b> turns the request into the controller's own command: read ${F.spb} sectors starting at sector ${nf(F.s0)} and place them in the buffer by DMA.` },
            { L: 'sched', d: 'wait', see: `disk queue: ${Array.from({ length: F.queued }, (x, i) => '[req ' + (i + 1) + ']').join(' ')} [ours]\nprocess → Blocked`, t: 'µs, then a wait',
              cap: `<b>Scheduling and control.</b> ${['No', 'One', 'Two', 'Three', 'Four'][F.queued]} earlier request${F.queued === 1 ? ' is' : 's are'} already waiting for the disk, so ours joins the end of the queue and the process is <span class="t" data-t="blocked state">blocked</span>. When its turn comes, this layer starts it by writing the command into the controller's registers.` },
            { L: 'hw', d: 'hw', see: `arm moves to track ${F.track}\nwait for sector ${F.ts0} to come round\nread ${F.spb} sectors → buffer (DMA)`, t: 'milliseconds',
              cap: `<b>Hardware.</b> The drive moves its arm to track ${F.track}, waits for sector ${F.ts0} to spin under the head, and reads ${F.spb} sectors into the buffer. This is the slow part: milliseconds. (Real drives hide their geometry: the OS sends only the sector number.)` },
            { L: 'sched', d: 'up', see: 'interrupt: status OK\n  → start the next queued request\n  → process → Ready', t: 'µs',
              cap: '<b>Scheduling and control.</b> The controller raises an interrupt. The handler reads the status (no errors), starts the next request in the queue, and makes our process ready again.' },
            { L: 'fs', d: 'up', see: `copy ${F.want} bytes: buffer → buf\nfile position ${F.pos} → ${nxt}`, t: 'µs',
              cap: `<b>Back up the stack.</b> The filled buffer is passed up, and the file system layer copies the ${F.want} bytes into the program's buf and moves the file position to ${nxt}.` },
            { L: 'user', d: 'up', see: `n = ${F.want}`, t: 'program',
              cap: `<b>User process.</b> read returns ${F.want}. The program never saw a sector number, a queue or an interrupt: that is generality, delivered by the layers.` },
          ];
          const typed = KB.typed, line = KB.line, keys = line.length, shown = JSON.stringify(line);
          const kbFrames = [
            { L: 'user', d: 'down', see: 'n = read(0, line, 100)', t: 'program',
              cap: '<b>User process.</b> A shell asks for up to 100 characters from descriptor 0, which is connected to the keyboard.' },
            { L: 'logical', d: 'down', see: 'descriptor 0 → device: the keyboard\nrequest: read up to 100 characters', t: 'µs',
              cap: '<b>Logical I/O</b> looks up the device behind descriptor 0 (its device identifier names the keyboard) and sees a simple read request. Which keyboard model is plugged in does not matter here.' },
            { L: 'devio', d: 'down', see: 'line buffer: (empty)\n  → collect characters until Enter', t: 'µs',
              cap: '<b>Device I/O.</b> No complete line has been typed yet, so it arranges to collect characters in a line buffer until Enter arrives.' },
            { L: 'sched', d: 'wait', see: 'process → Blocked\nwaiting for keyboard interrupts', t: 'seconds (human speed)',
              cap: '<b>Scheduling and control.</b> There is nothing to deliver, so the process is blocked, and the processor runs other work while the person thinks. That can take seconds.' },
            { L: 'hw', d: 'hw', see: `key pressed: '${typed[0]}'\ncontroller: key code in register, interrupt`, t: 'ns – µs',
              cap: `<b>Hardware.</b> The person presses ‘${typed[0]}’. The keyboard controller places a key code in its register and raises an interrupt.` },
            { L: 'sched', d: 'up', see: 'interrupt handler: read the key code\nstatus OK', t: 'µs',
              cap: '<b>Scheduling and control.</b> The interrupt handler reads the key code from the controller and checks the status, in microseconds.' },
            { L: 'devio', d: 'up', see: `key code → '${typed[0]}'\nline buffer: "${typed[0]}"\necho '${typed[0]}' to the screen`, t: 'µs',
              cap: `<b>Device I/O</b> turns the key code into the character ‘${typed[0]}’, adds it to the line buffer, and echoes it so the person sees it.` },
            { L: 'devio', d: 'up', see: `'${typed.slice(1)}', then Enter: ${keys - 1} more interrupts\nline buffer: ${shown} (${line.length} chars)`, t: 'seconds of typing',
              cap: `The same happens for ‘${typed.slice(1)}’ and for Enter: ${keys} key presses, one interrupt each in this simple model (a real keyboard also reports every key release). Enter completes the line, so the process is made ready.` },
            { L: 'logical', d: 'up', see: `copy ${shown} → line (${line.length} chars)`, t: 'µs',
              cap: `<b>Logical I/O</b> copies the ${line.length} characters into the program's buffer.` },
            { L: 'user', d: 'up', see: `n = ${line.length}`, t: 'program',
              cap: `<b>User process.</b> read returns ${line.length}. The shell waited seconds, while each layer below did its part in microseconds: very different time scales inside one request.` },
          ];
          const { want, payload, eth, ip, tcp, frame, ipPkt } = NET, segB = NET.seg;
          const netFrames = [
            { L: 'user', d: 'down', see: `n = read(sock, buf, ${want})`, t: 'program',
              cap: `<b>User process.</b> A browser asks for up to ${want} bytes of a web page on its connection to the server.` },
            { L: 'comm', sub: 'TCP', d: 'wait', see: 'connection: no data waiting\nprocess → Blocked', t: 'µs, then a wait',
              cap: '<b>Communications architecture, TCP layer.</b> Nothing has arrived on this connection yet, so the process is blocked until data come in.' },
            { L: 'hw', d: 'hw', see: `frame arrives: ${frame} bytes\ncard → memory (DMA), interrupt`, t: 'µs',
              cap: `<b>Hardware.</b> The network card receives a frame (one unit of data on the network link) of ${frame} bytes, copies it into memory by DMA, and raises an interrupt.` },
            { L: 'sched', d: 'up', see: 'interrupt: frame received\nstatus OK', t: 'µs',
              cap: '<b>Scheduling and control.</b> The interrupt handler acknowledges the card and checks the status. Real kernels keep this part tiny and finish the work a moment later.' },
            { L: 'devio', d: 'up', see: `Ethernet header (${eth} B): carries IP\n  → pass up ${ipPkt} bytes`, t: 'µs',
              cap: `<b>Device I/O.</b> The network driver checks the ${eth}-byte Ethernet header (the label the local network link adds), sees that the frame carries an IP packet, and passes the other ${ipPkt} bytes up.` },
            { L: 'comm', sub: 'IP', d: 'up', see: `IP header (${ip} B): for this computer ✓\n  → pass up ${segB} bytes to TCP`, t: 'µs',
              cap: `<b>IP layer.</b> It checks that the packet is addressed to this computer, removes its ${ip}-byte header, and hands the remaining ${segB} bytes to TCP.` },
            { L: 'comm', sub: 'TCP', d: 'up', see: `TCP header (${tcp} B): in order ✓\n  → acknowledge to the sender\n  → ${payload} data bytes for this connection`, t: 'µs',
              cap: `<b>TCP layer.</b> It checks the sequence number (nothing missing), arranges an acknowledgement for the sender, removes its ${tcp}-byte header, and queues ${payload} data bytes. The waiting process is made ready.` },
            { L: 'user', d: 'up', see: `n = ${payload}   (asked for ${want})`, t: 'program',
              cap: `<b>User process.</b> read returns ${payload}: on a connection, read returns what has arrived, even if that is less than asked for. The frame the card delivered held ${eth} + ${ip} + ${tcp} + ${payload} = ${frame} bytes (minimum header sizes).` },
          ];
          const SC = [{ label: 'Read a file', col: 2, frames: fileFrames }, { label: 'Read the keyboard', col: 0, frames: kbFrames }, { label: 'Receive from the network', col: 1, frames: netFrames }];
          const DIR = { down: ['↓ request going down', 'os'], up: ['↑ result coming back up', 'ok'], wait: ['waiting', 'warn'], hw: ['hardware at work', 'io'] };
          let sc = 0, boxes = {};
          const col = ctx.$('.rcol'), meta = ctx.$('.r-meta'), see = ctx.$('.r-see'), log = ctx.$('.r-log');
          function buildCol() {
            boxes = {};
            col.replaceChildren(...STACKS[SC[sc].col].rows.map(([k, , span]) => {
              const b = layerBox(ctx, SC[sc].col, k, { tag: 'div', style: ctx.narrow ? { minHeight: 40 * span + 'px' } : { flexGrow: span } });
              boxes[k] = b;
              return b;
            }));
          }
          function draw(i) {
            const fr = SC[sc].frames[i];
            Object.entries(boxes).forEach(([k, b]) => {
              b.classList.toggle('cur', k === fr.L);
              b.querySelectorAll('.sub').forEach((x) => x.classList.toggle('cur', k === fr.L && x.dataset.sub === fr.sub));
            });
            const name = fr.L === 'hw' ? STACKS[SC[sc].col].hw : LAYER[fr.L].name + (fr.sub ? ' · ' + fr.sub : '');
            meta.replaceChildren(h('span', { class: 'b', style: { fontSize: '18px' } }, name), h('span', { class: 'chip ' + DIR[fr.d][1] }, DIR[fr.d][0]), h('span', { class: 'chip' }, 'time scale: ' + fr.t));
            see.textContent = fr.see;
            log.replaceChildren(...SC[sc].frames.map((f, j) => h('div', { style: j === i ? { fontWeight: '800', background: 'var(--hl)' } : j > i ? { opacity: '.45' } : null },
              `${j + 1}. ${f.d === 'up' ? '↑' : f.d === 'down' ? '↓' : '·'} ${f.L === 'hw' ? 'Hardware' : LAYER[f.L].name}${f.sub ? ' (' + f.sub + ')' : ''}: ${f.see.split('\n')[0]}`)));
            const curRow = log.children[i];
            if (curRow && log.scrollHeight > log.clientHeight) log.scrollTop = Math.max(0, curRow.offsetTop - log.clientHeight / 2);
            return fr.cap;
          }
          if (ctx.narrow) { ctx.$('.r-main').style.gridTemplateColumns = 'minmax(0, 1fr)'; Object.assign(log.style, { minHeight: '90px', maxHeight: '150px' }); }
          buildCol();
          const player = ctx.ui.player({ count: SC[sc].frames.length, render: draw, interval: 2600 });
          ctx.$('.r-player').append(player.el);
          ctx.$('.r-ctl').prepend(ctx.ui.seg(SC.map((x, i) => ({ value: i, label: x.label })), sc, (v) => { sc = v; buildCol(); player.stop(); player.setCount(SC[sc].frames.length); }));
        },
      },
      {
        title: 'Recap: six things to remember',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Click each card to check yourself. Try to say the answer before you flip it.'),
            ctx.ui.flipcards([
              ['What are the two objectives of I/O design?', '<b>Efficiency</b>: keep the processor busy, because I/O, above all the disk, is the bottleneck. <b>Generality</b>: handle every device the same way where possible.'],
              ['How does multiprogramming help, and where does it stop helping?', 'While one process waits for I/O, another computes. But a saturated device (one disk with T &gt; C) caps the processor at C/T; swapping is disk I/O too.'],
              ['Which general functions do upper levels use?', '<code>open</code>, <code>close</code>, <code>read</code>, <code>write</code>, <code>lock</code>, <code>unlock</code>. Device details hide in low-level routines; an operation a device cannot do returns an error.'],
              ['What are the rules of a layered design?', 'Each layer relies on the one below, hides its details and offers simpler services up. Layers near the hardware work on the shortest time scales.'],
              ['Layers for a local device, and for a communications port?', 'Local: logical I/O → device I/O → scheduling and control. Port: a communications architecture (such as TCP/IP, itself layered) replaces logical I/O.'],
              ['Layers for a file system?', 'Directory management → file system → physical organization → device I/O → scheduling and control.'],
            ], { cols: 3, height: 214 })));
        },
      },
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which pair names the two main objectives in designing the I/O facility of an operating system?',
            choices: ['Security and portability', 'Fairness and low cost', 'Efficiency and generality', 'Reliability and compatibility'], answer: 2,
            feedback: ['Both matter to an OS, but the two I/O design objectives are about speed and about treating devices uniformly.', 'Fairness belongs to scheduling, and cost is not an I/O design objective.', null, 'Desirable, but the two classic I/O objectives are efficiency (speed) and generality (uniform handling of devices).'],
            why: 'Efficiency keeps slow I/O from wasting the fast processor; generality lets processes and upper OS levels handle every device through the same few functions.' },
          { q: 'Why does disk I/O get more design attention than any other kind of I/O?',
            choices: ['Disks are the only devices able to raise interrupts', 'Disks are slow but needed for files and swapping', 'Disks move data a byte at a time, like keyboards', 'Disks cannot use DMA, so the CPU copies each byte'], answer: 1,
            feedback: ['Keyboards, network cards and printers raise interrupts too.', null, 'Disks are block-oriented: they transfer whole blocks, not single bytes.', 'Disks normally do use DMA; the processor does not copy every byte.'],
            why: 'A disk access takes milliseconds, millions of instruction times, and files, swapping and virtual memory all depend on the disk, so its speed limits the whole system.' },
          { type: 'num', q: 'A process alternates between 6 ms of computing and 9 ms of disk I/O, and no other process is ready to run. What percentage of the time is the processor busy?', answer: 40, tol: 0.5, unit: '%',
            why: 'With one process the processor and the disk take turns: the processor is busy 6 ms out of every 6 + 9 = 15 ms, and 6 / 15 = 40%.' },
          { type: 'num', q: 'Many processes each compute for 3 ms and then do one 12 ms I/O on the same single disk, which serves one request at a time. In the long run, at most what percentage of the time can the processor be busy?', answer: 25, tol: 0.5, unit: '%',
            hint: 'Which stage is the bottleneck, and how often can it finish an I/O?',
            why: 'The disk is the bottleneck: it finishes at most one I/O every 12 ms, and each finished I/O releases one 3 ms burst of computing, so the processor is busy at most 3 / 12 = 25%. Adding processes only lengthens the disk queue.' },
          { type: 'tf', q: 'Generality means every device must support every general operation, so a program can read from a printer just as it reads from a file.', answer: false,
            why: 'Generality means one uniform interface, not identical abilities. An operation a device cannot perform, such as reading from a printer, simply fails with an error code, and device-specific settings go through an escape hatch such as ioctl.' },
          { type: 'multi', q: 'Which of these are general functions through which processes and the upper levels of the OS see devices?',
            choices: ['read', 'lock', 'move the disk arm to track 144', 'close', 'set the DMA start address', 'open'], answer: [0, 1, 3, 5],
            why: 'open, close, read, write, lock and unlock work the same for every device. Moving an arm or programming a DMA address are device details that the lower layers hide.' },
          { type: 'order', q: 'Put the layers of the file-system I/O stack in order, from the one nearest the user to the one nearest the hardware.',
            items: ['Directory management', 'File system', 'Physical organization', 'Device I/O', 'Scheduling and control'],
            why: 'Names become identifiers, the file system handles logical file operations and access rights, physical organization finds tracks and sectors, device I/O builds the commands, and scheduling and control drives the hardware.' },
          { type: 'match', q: 'Match each I/O layer to its job.',
            pairs: [['Logical I/O', 'Device as a logical resource: device ID + simple commands'], ['Device I/O', 'Builds I/O instructions, channel commands, controller orders'], ['Scheduling and control', 'Queues operations, handles interrupts, reports status'], ['Directory management', 'Symbolic file names → internal identifiers'], ['Physical organization', 'Logical file references → tracks and sectors'], ['Communications architecture', 'Replaces logical I/O for a port; layered, e.g. TCP/IP']],
            why: 'Each layer has one kind of job and hides it from the layers above.' },
          { type: 'bucket', q: 'The layered model of I/O has three stacks: one for a local peripheral device, one for a communications port and one for a file system. Sort each layer into the only stack that uses it, or into “All three” if every stack uses it.', buckets: ['Local device', 'Communications port', 'File system', 'All three'],
            items: [['Logical I/O', 0], ['Communications architecture', 1], ['Directory management', 2], ['File system layer', 2], ['Physical organization', 2], ['Device I/O', 3], ['Scheduling and control', 3]],
            why: 'The three stacks differ only in their upper layers. Device I/O and scheduling and control, the layers closest to the hardware, appear in all three.' },
          { q: 'In the layered I/O model, which layer actually interacts with the I/O module and handles the device interrupts?',
            choices: ['Communications architecture', 'Logical I/O', 'Device I/O', 'Scheduling and control'], answer: 3,
            feedback: ['It turns data into packets and back, and relies on the layers below it to reach the hardware.', 'Logical I/O sees the device only as a logical resource with a device ID.', 'Device I/O builds the commands, but queuing them, starting them and handling the interrupts happen one layer lower.', null],
            why: 'Scheduling and control queues and schedules operations, starts them, handles interrupts, and collects and reports status. It is the layer that talks to the hardware.' },
          { q: 'How do the time scales of the I/O layers compare?',
            choices: ['Layers near the hardware deal with the shortest time scales', 'All layers work on one time scale, set by the device speed', 'Layers near the user deal with the shortest time scales', 'Only the user process has a time scale; the other layers are instant'], answer: 0,
            feedback: [null, 'Bus cycles take nanoseconds while a person waits seconds, so the layers clearly differ.', 'It is the other way round: near the user, events take milliseconds to seconds.', 'Every layer takes time; the layers near the hardware just deal with much shorter events.'],
            why: 'Hardware signals and bus cycles take nanoseconds, interrupts are handled in microseconds, and whole requests seen by the user take milliseconds or more. The layers follow that order.' },
          { type: 'num', q: 'A file system uses 4096-byte blocks on a disk with 512-byte sectors, and the blocks are laid end to end starting at sector 0. Physical organization finds the wanted data in disk block 9034. At which sector number does that block begin?', answer: 72272, tol: 0,
            why: 'Each block holds 4096 / 512 = 8 sectors, so block 9034 starts at sector 9034 × 8 = 72,272 and ends at sector 72,279.' },
        ],
      },
    ],
    notes: `
<h3>Two objectives of I/O design</h3>
<ul>
  <li><b>Efficiency.</b> I/O is usually the bottleneck: devices are far slower than the processor and main memory. The OS must keep the processor busy while devices work and make each device, above all the disk, waste as little time as possible.</li>
  <li><b>Generality.</b> Handle all devices in a uniform way where possible, both in how processes see them and in how the OS manages them. Device details are hidden in low-level routines so that processes and upper OS levels see every device through a few general functions.</li>
</ul>
<p>Without a general interface, 3 programs and 4 devices need 3 × 4 = 12 pieces of device code, and a new device means changing every program. With one, each device needs one driver in the OS, and a new device needs only a new driver.</p>

<h3>Efficiency: overlapping I/O with computing</h3>
<p>A processor runs billions of instructions per second, while one hard-disk access takes several milliseconds, long enough for over ten million instructions. <b>Multiprogramming</b> lets some processes wait for I/O while another computes. Even so, I/O may not keep up. When too few ready processes are in memory, the OS brings more in by <b>swapping</b>, but swapping is itself disk I/O. That is why disk efficiency gets the most attention: buffering (11.4), disk scheduling (11.5), RAID (11.6) and the disk cache (11.7).</p>
<p>Model: each process computes for C ms, then does one I/O of T ms, repeatedly.</p>
<ul>
  <li><b>One process:</b> processor and device take turns. Processor busy = C / (C + T). Example: C = 4, T = 8 gives 4 / 12 = ${pct(simulate(1, 4, 8, true, 0).cpu)}.</li>
  <li><b>Several processes, a separate device each:</b> overlap raises utilization. With C = 4, T = 8: 2 processes give ${pct(simulate(2, 4, 8, false, 0).cpu)}, 3 give ${pct(simulate(3, 4, 8, false, 0).cpu)}.</li>
  <li><b>Several processes, one shared disk:</b> if T &gt; C the disk saturates and becomes the bottleneck. It finishes one I/O per T ms, each releasing one C ms burst, so the processor is busy at most C / T. With C = 4, T = 8 that is ${pct(simulate(4, 4, 8, true, 0).cpu)}, however many processes there are; with C = 3, T = 12 it is ${pct(simulate(4, 3, 12, true, 0).cpu)}. More processes only lengthen the disk queue.</li>
</ul>
<p>A <b>bottleneck</b> is the slowest stage in a chain of work; it sets the pace for the whole chain.</p>

<h3>Generality: the same calls for every device</h3>
<p>The general functions are <b>open, close, read, write, lock, unlock</b>. The program's call is identical for every device; the routines below the interface differ:</p>
<table>
  <tr><th>Call</th><th>Keyboard</th><th>Disk file</th><th>Network connection</th></tr>
  <tr><td>open</td><td>check access, find the driver</td><td>name → file identifier, check access rights</td><td>set up a connection (UNIX: socket + connect)</td></tr>
  <tr><td>read</td><td>block until a line is typed; an interrupt per key</td><td>find the block; use a copy in memory or queue a disk read and block</td><td>block until packets arrive; each protocol layer strips its header</td></tr>
  <tr><td>write</td><td>input only (on UNIX the terminal sends it to the screen)</td><td>copy to a buffer; the block is written later</td><td>cut into packets, add headers, send</td></tr>
  <tr><td>lock / unlock</td><td>seldom needed (the foreground process gets the keys)</td><td>hold the file or a byte range; advisory by default on UNIX-like systems, enforced on Windows</td><td>seldom needed</td></tr>
  <tr><td>close</td><td>stop delivering keys, free the descriptor</td><td>free records; changed blocks reach the disk later (<code>fsync</code> forces them)</td><td>send queued data, tell the other side, free the descriptor</td></tr>
</table>
<p><b>Device independence</b>: the same program works with different devices unchanged. UNIX <code>sort</code> reads the keyboard when typed alone and a file when typed as <code>sort &lt; names.txt</code>.</p>
<p><b>Common mistake:</b> generality does not give every device every ability. Reading from a printer fails with an error code, and device-specific settings use an escape hatch (<code>ioctl</code> on UNIX-like systems).</p>

<h3>Layered (hierarchical) structure</h3>
<ul>
  <li>Each layer does one kind of job and relies on the next lower layer for more primitive functions.</li>
  <li>It hides the lower layers' details and offers simpler services to the layer above.</li>
  <li>Ideally a layer can be changed without changing the others.</li>
  <li>Layers follow time scale: near the hardware, events take nanoseconds to microseconds; near the user, milliseconds to seconds.</li>
</ul>
<p>Rough time scales (local-device stack): hardware 1 ns–1 µs, scheduling and control 0.1–100 µs, device I/O 1 µs–10 ms, logical I/O 10 µs–0.1 s, user process 10 ms–10 s.</p>
<p>Example: swapping a parallel-port printer for a USB printer with a different printer language changes device I/O, scheduling and control, and the hardware; logical I/O and the user process stay the same.</p>

<h3>Three layer stacks</h3>
<pre>Local peripheral device   Communications port          File system
User process              User process                 User process
Logical I/O               Communications architecture  Directory management
                          (e.g. TCP over IP)           File system
                                                       Physical organization
Device I/O                Device I/O                   Device I/O
Scheduling and control    Scheduling and control       Scheduling and control
Hardware                  Hardware                     Hardware</pre>
<ul>
  <li><b>Logical I/O</b> (local device): treats the device as a logical resource. It manages general I/O functions for processes, which use a <b>device identifier</b> and simple commands: open, close, read, write. It ignores how the device is controlled. (Chapter 12's file-management model uses the name for a different layer, which gives programs records instead of disk blocks.)</li>
  <li><b>Device I/O</b>: turns requested operations and data (buffered characters, records) into sequences of I/O instructions, channel commands and controller orders. Buffering may improve device use.</li>
  <li><b>Scheduling and control</b>: queues and schedules I/O operations, controls them, handles interrupts, and collects and reports status. It is the layer that actually talks to the I/O module.</li>
  <li><b>Communications architecture</b> (communications port): replaces logical I/O and is itself several layers, for example TCP/IP. IP moves packets between computers; TCP gives programs a reliable, in-order byte stream. Each layer adds a header on the way out and removes it on the way in.</li>
  <li><b>Directory management</b> (file system): converts symbolic file names into identifiers that point to the file directly or through a descriptor record or index table; also handles directory operations such as add, delete and reorganize.</li>
  <li><b>File system layer</b>: deals with the logical structure of files and the user operations open, close, read, write; manages <b>access rights</b>.</li>
  <li><b>Physical organization</b>: converts logical references to files and records into physical secondary-storage addresses, allowing for the <b>track</b> and <b>sector</b> structure of the device (as virtual addresses are converted to physical ones). It also allocates disk space and main-memory buffers.</li>
</ul>

<h3>Worked example: one file read through the stack</h3>
<ol>
  <li>open("${FX.path}"): directory management turns the name into file ${FX.id}; the file system layer checks that ana may read it and returns descriptor 3.</li>
  <li>read(3, buf, ${FX.want}) at file position ${FX.pos}: bytes ${FX.pos}–${FX.end} are logical block ${FX.pos} ÷ ${FX.bs} = ${FX.lb}.</li>
  <li>Physical organization: the file's block table gives disk block ${nf(FX.pb)}. With ${FX.sec}-byte sectors a block is ${FX.spb} sectors, so the data are sectors ${nf(FX.pb)} × ${FX.spb} = ${nf(FX.s0)} to ${nf(FX.s1)}; on a toy disk with ${FX.spt} sectors per track that is track ${FX.track}, sectors ${FX.ts0}–${FX.ts1}. A buffer is reserved.</li>
  <li>Device I/O builds the controller command “read ${FX.spb} sectors from sector ${nf(FX.s0)} into the buffer by DMA”.</li>
  <li>Scheduling and control queues it behind ${FX.queued} earlier requests and blocks the process, later starts the operation; the drive seeks and reads (milliseconds); the interrupt reports success and the process becomes ready.</li>
  <li>The data travel back up; the file system layer copies ${FX.want} bytes into buf, the position becomes ${FX.pos + FX.want}, and read returns ${FX.want}.</li>
</ol>
<p>Real drives hide their geometry: the OS sends only a sector number and the drive finds the track itself.</p>
<p><b>Keyboard read:</b> the process blocks; each key press (${KB.typed.split('').join(', ')}, Enter) raises an interrupt in this simple model (real keyboards also report each release), handled in microseconds; device I/O builds the line, and read returns ${KB.line.length}. The process waited seconds while the layers below worked in microseconds.</p>
<p><b>Network receive:</b> a ${NET.frame}-byte frame arrives by DMA; the driver strips the ${NET.eth}-byte Ethernet header, IP its ${NET.ip}-byte header, TCP its ${NET.tcp}-byte header (after checking order and acknowledging), leaving ${NET.payload} data bytes. read returns ${NET.payload} although ${NET.want} were asked for.</p>`,
  });
})();
