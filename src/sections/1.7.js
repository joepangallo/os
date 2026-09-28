/* =====================================================================
   Section 1.7  Direct Memory Access
   The three I/O techniques (programmed I/O, interrupt-driven I/O, DMA),
   the two drawbacks shared by the first two, what the processor hands a
   DMA module, how the block moves without the processor, and cycle
   stealing on the system bus.
   ===================================================================== */
(function () {
  /* ------------------------------------------------------------------
     Shared timing model used by the interrupt timeline, the drawbacks
     explorer and the race. One tick = one instruction time = one bus cycle.
       Programmed I/O, per word: 1 command + D status checks + 2 (read, store)
       Interrupt-driven, per word: save 4 + move 2 + next command 1 + restore 4
       DMA, per block: 4 setup + one stolen cycle per word + completion
                       interrupt (save 4 + 2 bookkeeping + restore 4)
     D = how many ticks the device needs to produce one word.
     ------------------------------------------------------------------ */
  const KIND = {
    free: 'Other program (useful)',
    poll: 'Busy waiting',
    cmd: 'Commands / setup',
    move: 'Moving a word',
    ctx: 'Save / restore context',
    stolen: 'Paused: stolen cycle',
  };
  function simulate(tech, N, D) {
    const acts = [], stores = [], ints = [];
    const put = (k, n) => { for (let j = 0; j < n; j++) acts.push(k); };
    if (tech === 'pio') {
      for (let w = 0; w < N; w++) { put('cmd', 1); put('poll', D); put('move', 2); stores.push(acts.length); }
    } else if (tech === 'int') {
      put('cmd', 1);
      let ready = 1 + D;
      for (let w = 0; w < N; w++) {
        if (acts.length < ready) put('free', ready - acts.length);
        ints.push(acts.length);
        put('ctx', 4); put('move', 2); stores.push(acts.length);
        if (w < N - 1) { put('cmd', 1); ready = acts.length + D; }
        put('ctx', 4);
      }
    } else {
      put('cmd', 4);
      const t0 = acts.length;
      for (let w = 0; w < N; w++) {
        const r = t0 + (w + 1) * D;
        if (acts.length < r) put('free', r - acts.length);
        put('stolen', 1); stores.push(acts.length);
      }
      ints.push(acts.length);
      put('ctx', 4); put('cmd', 2); put('ctx', 4);
    }
    const cnt = (k) => acts.reduce((n, a) => n + (a === k ? 1 : 0), 0);
    const free = cnt('free'), stolen = cnt('stolen');
    return { tech, N, D, acts, stores, ints, end: acts.length, free, stolen, io: acts.length - free - stolen, through: tech === 'dma' ? 0 : N };
  }
  /* merge consecutive ticks of the same kind into segments, up to tick `cut` */
  function segsOf(acts, cut) {
    const out = []; const n = Math.min(cut == null ? acts.length : cut, acts.length);
    for (let t = 0; t < n; t++) {
      const last = out[out.length - 1];
      if (last && last.k === acts[t] && last.b === t) last.b = t + 1; else out.push({ a: t, b: t + 1, k: acts[t] });
    }
    return out;
  }
  function timelineNodes(ctx, acts, o) {
    const { s } = ctx, sc = o.w / o.tMax, nodes = [];
    nodes.push(s('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: 5, class: 's-panel', 'stroke-width': 1 }));
    segsOf(acts, o.cut).forEach((g) => nodes.push(s('rect', { x: o.x + g.a * sc, y: o.y, width: Math.max(1, (g.b - g.a) * sc), height: o.h, class: 'k-' + g.k, 'stroke-width': 1 })));
    (o.marks || []).filter((t) => o.cut == null || t <= o.cut).forEach((t) => nodes.push(s('path', { d: `M${o.x + t * sc - 5},${o.y - 9} l10,0 l-5,8 z`, style: 'fill:var(--intr)' })));
    if (o.cursor != null) nodes.push(s('line', { x1: o.x + o.cursor * sc, y1: o.y - 3, x2: o.x + o.cursor * sc, y2: o.y + o.h + 3, style: 'stroke:var(--ink);stroke-width:2' }));
    return nodes;
  }
  function keyRow(ctx, kinds) {
    return ctx.h('div', { class: 'row', style: { gap: '4px 14px' } }, ...kinds.map((k) => ctx.h('span', { class: 'key', html: `<i class="k-${k}"></i>${KIND[k]}` })));
  }

  /* ------------------------------------------------------------------
     The bus diagram shared by several steps. Wide screens: viewBox 620 x 276,
     processor and memory above the system bus, the device, its I/O or DMA
     module and a small note box below it. Phones: viewBox 360 x 372, memory
     on top, processor + note in the middle, so labels stay readable.
     ------------------------------------------------------------------ */
  function geo(narrow) {
    if (!narrow) return { W: 620, H: 276, busY: 142, busX2: 608, lbl: [606, 132],
      cpu: { x: 12, y: 10, w: 200, h: 104 }, mem: { x: 232, y: 10, w: 376, h: 104, cy: 32, ch: 34, ly: [84, 98] },
      dev: { x: 12, y: 168, w: 108, h: 100 }, mod: { x: 164, y: 168, w: 312, h: 100 }, note: { x: 488, y: 168, w: 120, h: 100 },
      cX: 112, mX: 420, dX: 320, iX: 196, intLbl: [204, 162], devY: 218,
      dma: { l1: 12, b1: 86, w1: 74, l2: 172, b2: 228, w2: 74 }, io: { lamp: 154, bx: 146 } };
    return { W: 360, H: 372, busY: 240, busX2: 352, lbl: [352, 232],
      cpu: { x: 8, y: 116, w: 200, h: 104 }, mem: { x: 8, y: 8, w: 344, h: 96, cy: 28, ch: 30, ly: [74, 88] },
      dev: { x: 8, y: 264, w: 84, h: 100 }, mod: { x: 118, y: 264, w: 234, h: 100 }, note: { x: 218, y: 116, w: 134, h: 104 },
      cX: 108, mX: 213, dX: 300, iX: 180, intLbl: [186, 258], devY: 314,
      dma: { l1: 10, b1: 76, w1: 58, l2: 140, b2: 186, w2: 44 }, io: { lamp: 128, bx: 126 } };
  }
  function pathsOf(G) {
    const cpuB = G.cpu.y + G.cpu.h, memB = G.mem.y + G.mem.h, modT = G.mod.y, by = G.busY;
    const P = {
      cmd: [[G.cX, cpuB], [G.cX, by], [G.dX, by], [G.dX, modT]],          // processor → module
      toMem: [[G.cX, cpuB], [G.cX, by], [G.mX, by], [G.mX, memB]],        // processor → memory
      ctlToMem: [[G.dX, modT], [G.dX, by], [G.mX, by], [G.mX, memB]],     // module → memory (DMA read)
      dev: [[G.dev.x + G.dev.w, G.devY], [G.mod.x, G.devY]],              // device → module
    };
    P.toCpu = P.cmd.slice().reverse();          // module → processor
    P.memToCtl = P.ctlToMem.slice().reverse();  // memory → module (DMA write)
    P.toDev = P.dev.slice().reverse();          // module → device
    return P;
  }
  function along(pts, f) {
    const segs = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(L); total += L; }
    let d = Math.max(0, Math.min(1, f)) * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) { const r = segs[i] ? Math.min(1, d / segs[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r]; }
      d -= segs[i];
    }
    return pts[pts.length - 1];
  }
  function arrowHead(ctx, p, q, col) {
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]), L = 12, W = 7;
    const bx = q[0] - Math.cos(a) * L, by = q[1] - Math.sin(a) * L;
    const pts = [q, [bx - Math.sin(a) * W, by + Math.cos(a) * W], [bx + Math.sin(a) * W, by - Math.cos(a) * W]];
    return ctx.s('polygon', { points: pts.map((x) => x.join(',')).join(' '), style: 'fill:var(--' + col + ')' });
  }
  function busNodes(ctx, st) {
    const { s } = ctx, G = geo(ctx.narrow), PATHS = pathsOf(G);
    const { cpu, mem: M, dev, mod, note } = G, by = G.busY, cpuB = cpu.y + cpu.h, memB = M.y + M.h;
    const g = [];
    const txt = (x, y, str, cls, style) => s('text', { x, y, class: cls || '', style: style || null }, String(str));
    const tone = (t) => 'fill:var(--' + (t || 'ink') + ')';
    /* bus, connectors, interrupt line */
    g.push(s('line', { x1: 12, y1: by, x2: G.busX2, y2: by, class: 'bus' }));
    g.push(txt(G.lbl[0], G.lbl[1], 'system bus', 't13 end s-sub'));
    [[G.cX, cpuB], [G.dX, mod.y], [G.mX, memB]].forEach(([x, y]) => g.push(s('line', { x1: x, y1: y, x2: x, y2: by, class: 'conn' })));
    g.push(s('line', { x1: dev.x + dev.w, y1: G.devY, x2: mod.x, y2: G.devY, class: 'conn' }));
    g.push(s('line', { x1: G.iX, y1: mod.y, x2: G.iX, y2: cpuB + 4, class: 'intl' + (st.intr ? ' on' : '') }));
    if (st.intr) { g.push(arrowHead(ctx, [G.iX, by - 2], [G.iX, cpuB + 1], 'intr')); g.push(txt(G.intLbl[0], G.intLbl[1], 'INTERRUPT', 't13 b', tone('intr'))); }
    /* processor */
    g.push(s('rect', { x: cpu.x, y: cpu.y, width: cpu.w, height: cpu.h, rx: 12, class: 's-cpu blk' }));
    g.push(txt(cpu.x + 12, cpu.y + 22, 'Processor', 't15 b'));
    g.push(txt(cpu.x + 12, cpu.y + 51, 'Register R', 't13 s-sub'));
    g.push(s('rect', { x: cpu.x + 100, y: cpu.y + 33, width: 56, height: 26, rx: 6, class: 'reg' + (st.hotR ? ' hot' : '') }));
    g.push(txt(cpu.x + 128, cpu.y + 51, st.R || '–', 't15 b mid mono'));
    g.push(txt(cpu.x + 12, cpu.y + 80, st.cpuLine || '', 't14 b', tone(st.cpuTone || 'cpu')));
    if (st.cpuSub) g.push(txt(cpu.x + 12, cpu.y + 97, st.cpuSub, 't13 s-sub'));
    /* memory: one cell per word, addresses underneath (staggered when there are many) */
    const mem = st.mem || [];
    g.push(s('rect', { x: M.x, y: M.y, width: M.w, height: M.h, rx: 12, class: 's-mem blk' }));
    g.push(txt(M.x + 12, M.y + 22, 'Main memory', 't15 b'));
    const pitch = (M.w - 24) / Math.max(1, mem.length), cw = pitch - 4;
    mem.forEach((v, i) => {
      const x = M.x + 12 + i * pitch;
      const sel = st.sel && i >= st.sel[0] && i < st.sel[1];
      g.push(s('rect', { x, y: M.y + M.cy, width: cw, height: M.ch, rx: 5, class: 'cell' + (v ? ' full' : '') + (sel ? ' sel' : '') + (st.hot === i ? ' hot' : '') }));
      g.push(txt(x + cw / 2, M.y + M.cy + M.ch - 11, v || '', 't16 b mid mono'));
      g.push(txt(x + cw / 2, M.y + (mem.length > 8 && i % 2 ? M.ly[1] : M.ly[0]), (st.base || 200) + i, 't13 mid ' + (sel ? 'b' : 's-sub'), sel ? 'fill:var(--accent)' : null));
    });
    /* device */
    const dcx = dev.x + dev.w / 2, dy = dev.y;
    g.push(s('rect', { x: dev.x, y: dy, width: dev.w, height: dev.h, rx: 12, class: 's-io blk' }));
    g.push(txt(dcx, dy + 20, st.devName || 'Disk', 't15 b mid'));
    if (st.devIcon === 'net') {
      g.push(s('rect', { x: dcx - 30, y: dy + 32, width: 60, height: 34, rx: 5, class: 's-panel' }));
      [-22, -6, 10].forEach((o) => g.push(s('rect', { x: dcx + o, y: dy + 44, width: 12, height: 10, rx: 2, class: 'conn', style: 'stroke-width:1.5' })));
    } else {
      g.push(s('ellipse', { cx: dcx, cy: dy + 63, rx: 26, ry: 7, class: 's-panel' }));
      g.push(s('rect', { x: dcx - 26, y: dy + 37, width: 52, height: 26, class: 's-panel', style: 'stroke:none' }));
      g.push(s('line', { x1: dcx - 26, y1: dy + 37, x2: dcx - 26, y2: dy + 63, class: 'conn', style: 'stroke-width:1.5' }));
      g.push(s('line', { x1: dcx + 26, y1: dy + 37, x2: dcx + 26, y2: dy + 63, class: 'conn', style: 'stroke-width:1.5' }));
      g.push(s('ellipse', { cx: dcx, cy: dy + 37, rx: 26, ry: 7, class: 's-panel' }));
    }
    g.push(txt(dcx, dy + 90, st.devLine || 'idle', 't13 mid b', tone(st.devTone || 'muted')));
    /* the module: an ordinary I/O module or a DMA module */
    const dma = st.mode === 'dma', mx = mod.x, my = mod.y;
    g.push(s('rect', { x: mx, y: my, width: mod.w, height: mod.h, rx: 12, class: (dma ? 's-accent' : 's-io') + ' blk' }));
    g.push(txt(mx + 12, my + 20, dma ? 'DMA module' : 'I/O module', 't15 b'));
    const box = (x, y, w, val, hot) => { g.push(s('rect', { x, y: y - 15, width: w, height: 21, rx: 5, class: 'reg' + (hot ? ' hot' : '') })); g.push(txt(x + w / 2, y, val == null || val === '' ? '–' : val, 't14 b mid mono')); };
    if (dma) {
      const d = st.dma || {}, hot = st.hotReg || '', L = G.dma;
      [[41, 'Operation', d.op, 'op', 'Device', d.dev, 'dev'], [66, 'Address', d.addr, 'addr', 'Count', d.count, 'count']].forEach(([oy, l1, v1, k1, l2, v2, k2]) => {
        g.push(txt(mx + L.l1, my + oy, l1, 't13')); box(mx + L.b1, my + oy, L.w1, v1, hot.includes(k1));
        g.push(txt(mx + L.l2, my + oy, l2, 't13')); box(mx + L.b2, my + oy, L.w2, v2, hot.includes(k2));
      });
      g.push(txt(mx + L.l1, my + 91, 'Data', 't13')); box(mx + L.b1, my + 91, L.w1, st.data, hot.includes('data'));
    } else {
      g.push(txt(mx + 12, my + 48, 'Status register', 't14'));
      g.push(s('circle', { cx: mx + G.io.lamp, cy: my + 43, r: 8, class: 'lamp' + (st.lamp ? ' on' : '') }));
      g.push(txt(mx + G.io.lamp + 14, my + 48, 'READY = ' + (st.lamp ? 1 : 0), 't14 b mono', tone(st.lamp ? 'ok' : 'ink-2')));
      g.push(txt(mx + 12, my + 82, 'Data register', 't14'));
      box(mx + G.io.bx, my + 82, 56, st.data, st.hotData);
    }
    /* note box (what the other program is doing) */
    if (st.note) {
      const ncx = note.x + note.w / 2;
      g.push(s('rect', { x: note.x, y: note.y, width: note.w, height: note.h, rx: 12, class: 's-panel blk' }));
      g.push(txt(ncx, note.y + 22, st.note.title, 't13 mid s-sub b'));
      g.push(txt(ncx, note.y + 54, st.note.value, 't16 mid b', tone(st.note.tone)));
      if (st.note.sub) g.push(txt(ncx, note.y + 82, st.note.sub, 't13 mid s-sub'));
    }
    /* highlighted path with a travelling token */
    if (st.path) {
      const pts = PATHS[st.path], col = st.pathCls === 'cmd' ? 'cpu' : 'accent';
      g.push(s('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'hp ' + (st.pathCls || 'data') }));
      g.push(arrowHead(ctx, pts[pts.length - 2], pts[pts.length - 1], col));
      if (st.tok) {
        const [tx, ty] = along(pts, st.frac == null ? 0.5 : st.frac), w = 14 + 8.6 * String(st.tok).length;
        g.push(s('rect', { x: tx - w / 2, y: ty - 12, width: w, height: 24, rx: 8, class: 'tok' }));
        g.push(txt(tx, ty + 5, st.tok, 't14 b mid mono'));
      }
    }
    return g;
  }
  /* ------------------------------------------------------------------
     Three flowcharts side by side (viewBox 1100 x 372) for the compare step.
     ------------------------------------------------------------------ */
  function flowNodes(ctx) {
    const { s } = ctx, out = [];
    const NW = 250, NH = 30;
    const col = (i) => { const g = s('g', { class: 's17-col', 'data-col': i }); out.push(g); return g; };
    const box = (g, cx, y, text, cls) => { g.append(s('rect', { x: cx - NW / 2, y, width: NW, height: NH, rx: 8, class: cls + ' blk' }), s('text', { x: cx, y: y + 20, class: 't14 mid' }, text)); };
    const dia = (g, cx, cy, text) => { g.append(s('path', { d: `M${cx},${cy - 20} L${cx + 62},${cy} L${cx},${cy + 20} L${cx - 62},${cy} Z`, class: 's-panel blk' }), s('text', { x: cx, y: cy + 5, class: 't14 mid b' }, text)); };
    const arr = (g, d, cls, mk) => g.append(s('path', { d, class: cls || 's-line', 'marker-end': `url(#${mk || 'arr'})`, fill: 'none' }));
    const lbl = (g, x, y, t, st) => g.append(s('text', { x, y, class: 't13', style: st || 'fill:var(--muted)' }, t));
    const loop = (g, cx, y1, y2, t) => { g.append(s('rect', { x: cx - 168, y: y1, width: 336, height: y2 - y1, rx: 12, class: 's-warn', style: 'opacity:.35', 'stroke-width': 1 })); lbl(g, cx - 160, y2 - 8, t, 'fill:var(--warn);font-weight:700'); };
    /* Programmed I/O */
    let g = col(0), X = 185;
    loop(g, X, 24, 318, 'every word');
    g.append(s('text', { x: X, y: 14, class: 't15 mid b', style: 'fill:var(--warn)' }, 'Programmed I/O'));
    box(g, X, 32, 'Issue READ command to I/O module', 's-cpu'); arr(g, `M${X},62 L${X},76`);
    box(g, X, 78, 'Read status of I/O module', 's-io'); arr(g, `M${X},108 L${X},120`);
    dia(g, X, 142, 'Ready?'); arr(g, `M${X},162 L${X},176`); lbl(g, X + 8, 173, 'yes');
    arr(g, `M${X - 62},142 L${X - 150},142 L${X - 150},93 L${X - 127},93`); lbl(g, X - 146, 136, 'not ready');
    box(g, X, 178, 'Read word from I/O module', 's-io'); arr(g, `M${X},208 L${X},222`);
    box(g, X, 224, 'Write word into memory', 's-mem'); arr(g, `M${X},254 L${X},268`);
    dia(g, X, 290, 'Done?'); arr(g, `M${X},310 L${X},330`); lbl(g, X + 8, 326, 'yes');
    arr(g, `M${X + 62},290 L${X + 152},290 L${X + 152},47 L${X + 127},47`); lbl(g, X + 70, 283, 'no');
    box(g, X, 332, 'Next instruction', 's-panel');
    /* Interrupt-driven I/O */
    g = col(1); X = 550;
    loop(g, X, 24, 318, 'every word');
    g.append(s('text', { x: X, y: 14, class: 't15 mid b', style: 'fill:var(--intr)' }, 'Interrupt-driven I/O'));
    box(g, X, 32, 'Issue READ command to I/O module', 's-cpu'); arr(g, `M${X},62 L${X},76`);
    box(g, X, 78, 'Do something else', 's-proc'); arr(g, `M${X},108 L${X},132`, 's17-iarr', 'arr-intr'); lbl(g, X + 8, 125, 'interrupt', 'fill:var(--intr);font-weight:700');
    box(g, X, 134, 'Read status of I/O module', 's-io'); arr(g, `M${X},164 L${X},176`);
    box(g, X, 178, 'Read word from I/O module', 's-io'); arr(g, `M${X},208 L${X},222`);
    box(g, X, 224, 'Write word into memory', 's-mem'); arr(g, `M${X},254 L${X},268`);
    dia(g, X, 290, 'Done?'); arr(g, `M${X},310 L${X},330`); lbl(g, X + 8, 326, 'yes');
    arr(g, `M${X + 62},290 L${X + 152},290 L${X + 152},47 L${X + 127},47`); lbl(g, X + 70, 283, 'no');
    box(g, X, 332, 'Next instruction', 's-panel');
    /* DMA */
    g = col(2); X = 915;
    g.append(s('text', { x: X, y: 14, class: 't15 mid b', style: 'fill:var(--accent)' }, 'Direct memory access'));
    box(g, X, 32, 'Issue READ BLOCK command to DMA', 's-cpu'); arr(g, `M${X},62 L${X},76`);
    box(g, X, 78, 'Do something else', 's-proc'); arr(g, `M${X},108 L${X},132`, 's17-iarr', 'arr-intr'); lbl(g, X + 8, 125, 'one interrupt, at the end', 'fill:var(--intr);font-weight:700');
    box(g, X, 134, 'Read status of DMA module', 's-accent'); arr(g, `M${X},164 L${X},176`);
    box(g, X, 178, 'Next instruction', 's-panel');
    g.append(s('rect', { x: X - 150, y: 232, width: 300, height: 86, rx: 12, class: 's-accent', style: 'stroke-dasharray:6 4', 'stroke-width': 1.5 }));
    [['Meanwhile, inside the DMA module:', 'b'], ['every word goes device → memory,', ''], ['one stolen bus cycle each,', ''], ['with no processor instructions.', '']].forEach(([t, c], i) => g.append(s('text', { x: X, y: 254 + i * 19, class: 't14 mid ' + c }, t)));
    return out;
  }
  /* Code listing. On phones a line with its comment beside it would be clipped, so each
     comment moves onto its own line just above its code; mark() keeps the original numbering. */
  function codeBox(ctx, src, o) {
    if (!ctx.narrow) return ctx.ui.code(src, o);
    const out = [], map = [];
    String(src).replace(/^\n+|\s+$/g, '').split('\n').forEach((line) => {
      const k = line.indexOf('//'), code = k < 0 ? line : line.slice(0, k).replace(/\s+$/, '');
      const com = k < 0 ? '' : line.slice(k).replace(/^\/\/\s*/, '// '), ind = (code.match(/^\s*/) || [''])[0], at = [];
      if (com) { at.push(out.length + 1); out.push(ind + com); }
      if (code.trim()) { at.push(out.length + 1); out.push(code); }
      map.push(at);
    });
    const pre = ctx.ui.code(out.join('\n'), Object.assign({}, o, { fontSize: 12 }));
    const mark = pre.mark;
    pre.mark = (nums, cls) => mark([].concat(nums == null ? [] : nums).flatMap((n) => map[n - 1] || []), cls);
    return pre;
  }
  function busSvg(ctx) { const G = geo(ctx.narrow); return ctx.s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Processor, main memory, system bus, device and its module' }); }

  Guide.section({
    id: '1.7',
    title: 'Direct Memory Access',
    short: 'DMA',
    summary: 'Three ways to move data between devices and memory, and why DMA frees the processor.',
    objectives: [
      'Describe how programmed I/O, interrupt-driven I/O and DMA each move a block of data, and who does the work.',
      'Explain why busy waiting wastes processor time and why interrupts help but still route every word through the processor.',
      'State the two drawbacks shared by programmed and interrupt-driven I/O.',
      'List the four items the processor gives a DMA module and trace a DMA block transfer from setup to completion interrupt.',
      'Explain cycle stealing and why DMA still wins for multiple-word transfers.',
    ],
    terms: [
      ['Programmed I/O', 'An I/O technique in which the processor gives a command to an I/O module and then checks the module’s status over and over until the operation is done. The module never interrupts.'],
      ['Interrupt-driven I/O', 'An I/O technique in which the processor gives a command, goes on with other work, and is interrupted by the I/O module when it is ready to exchange data. The processor still moves every word itself.'],
      ['Direct memory access (DMA)', 'An I/O technique in which a DMA module moves a whole block of words between a device and main memory by itself. The processor only sets up the transfer and handles one interrupt at the end.'],
      ['DMA module', 'Hardware, either a separate module on the system bus or logic built into an I/O module, that can take over the bus and move words to or from main memory in place of the processor.'],
      ['I/O status register (status register)', 'A small register inside an I/O module whose bits report how the current operation is going, for example ready, busy or error. The processor reads it to find out whether the module has finished.'],
      ['Data register', 'A register inside an I/O module that holds the word currently being passed between the device and the rest of the computer.'],
      ['I/O command', 'A request the processor sends to an I/O module (by executing an I/O instruction) telling it what to do next, such as read the next word from the disk.'],
      ['Polling', 'Asking a device for its status again and again, on the processor’s own initiative, to see whether it has finished.'],
      ['Busy waiting', 'Waiting by running a loop that checks a condition over and over instead of doing other work or sleeping. The processor looks busy but achieves nothing.'],
      ['Interrupt handler', 'The routine, normally part of the operating system, that runs when the processor accepts an interrupt. It deals with the event and then lets the interrupted program continue.'],
      ['Context (processor state)', 'Everything the processor needs to continue a program exactly where it stopped: the program counter, the status word and the other registers. It is saved before an interrupt is handled and restored afterwards.'],
      ['Word', 'The fixed-size group of bits that the processor, memory and bus move as one unit.'],
      ['Block transfer', 'Moving a group of consecutive words, such as one disk sector, between a device and memory as a single job.'],
      ['Transfer rate', 'How many words (or bytes) per second actually move between a device and main memory.'],
      ['Address register', 'A register in a DMA module that holds the memory address for the next word. It goes up by one after every word, so the block lands in consecutive cells.'],
      ['Count register', 'A register in a DMA module that holds how many words are still to move. It goes down by one after every word; at zero the block is finished.'],
      ['Bus cycle', 'One use of the system bus: the time it takes to move one word from one module to another over it.'],
      ['Cycle stealing', 'The way a DMA module uses the bus: it takes the bus for one bus cycle at a time, and if the processor wanted the bus then, the processor simply pauses for that cycle. Nothing is saved and nothing is interrupted.'],
    ],

    css: `
      .sec-1-7 svg .bus { stroke: var(--line-2); stroke-width: 9; stroke-linecap: round; fill: none; }
      .sec-1-7 svg .conn { stroke: var(--line-2); stroke-width: 3; fill: none; }
      .sec-1-7 svg .intl { stroke: var(--line-2); stroke-width: 2; stroke-dasharray: 5 4; fill: none; }
      .sec-1-7 svg .intl.on { stroke: var(--intr); stroke-width: 4; stroke-dasharray: none; }
      .sec-1-7 svg .s17-iarr { stroke: var(--intr); stroke-width: 2; stroke-dasharray: 5 3; fill: none; }
      .sec-1-7 svg .hp { fill: none; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
      .sec-1-7 svg .hp.cmd { stroke: var(--cpu); }
      .sec-1-7 svg .hp.data { stroke: var(--accent); }
      .sec-1-7 svg .tok { fill: var(--hl); stroke: var(--ink-2); stroke-width: 1.5; }
      .sec-1-7 svg .blk { stroke-width: 2; }
      .sec-1-7 svg .cell { fill: var(--panel); stroke: var(--line-2); stroke-width: 1.5; }
      .sec-1-7 svg .cell.full { fill: var(--mem-bg); stroke: var(--mem); }
      .sec-1-7 svg .cell.sel { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 4 3; }
      .sec-1-7 svg .cell.hot { stroke: var(--accent); stroke-width: 3; stroke-dasharray: none; }
      .sec-1-7 svg .reg { fill: var(--panel); stroke: var(--line-2); stroke-width: 1.5; }
      .sec-1-7 svg .reg.hot { stroke: var(--accent); stroke-width: 2.5; fill: var(--accent-bg); }
      .sec-1-7 svg .lamp { fill: var(--panel-3); stroke: var(--line-2); stroke-width: 2; }
      .sec-1-7 svg .lamp.on { fill: var(--ok); stroke: var(--ok); }
      .sec-1-7 svg .mono { font-family: var(--mono); }
      .sec-1-7 svg .b { font-weight: 700; }
      .sec-1-7 svg .mid { text-anchor: middle; }
      .sec-1-7 svg .end { text-anchor: end; }
      .sec-1-7 svg .t13 { font-size: 13px; }
      .sec-1-7 svg .t14 { font-size: 14px; }
      .sec-1-7 svg .t15 { font-size: 15px; }
      .sec-1-7 svg .t16 { font-size: 16px; }
      .sec-1-7 svg .k-free { fill: var(--proc-bg); stroke: var(--proc); }
      .sec-1-7 svg .k-poll { fill: var(--warn-bg); stroke: var(--warn); }
      .sec-1-7 svg .k-cmd { fill: var(--cpu-bg); stroke: var(--cpu); }
      .sec-1-7 svg .k-move { fill: var(--mem-bg); stroke: var(--mem); }
      .sec-1-7 svg .k-ctx { fill: var(--intr-bg); stroke: var(--intr); }
      .sec-1-7 svg .k-stolen { fill: var(--accent-bg); stroke: var(--accent); }
      .sec-1-7 .key { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); white-space: nowrap; }
      .sec-1-7 .key i { width: 14px; height: 14px; border-radius: 4px; border: 2px solid; display: inline-block; }
      .sec-1-7 .key i.k-free { background: var(--proc-bg); border-color: var(--proc); }
      .sec-1-7 .key i.k-poll { background: var(--warn-bg); border-color: var(--warn); }
      .sec-1-7 .key i.k-cmd { background: var(--cpu-bg); border-color: var(--cpu); }
      .sec-1-7 .key i.k-move { background: var(--mem-bg); border-color: var(--mem); }
      .sec-1-7 .key i.k-ctx { background: var(--intr-bg); border-color: var(--intr); }
      .sec-1-7 .key i.k-stolen { background: var(--accent-bg); border-color: var(--accent); }
      .sec-1-7 .stat { display: flex; flex-direction: column; min-width: 0; }
      .sec-1-7 .stat .v { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.15; }
      .sec-1-7 .stat .l { font-size: 12.5px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
      .sec-1-7 .fb { font-size: 15px; line-height: 1.45; }
      .sec-1-7 .s17-item { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; align-items: start; }
      .sec-1-7 .s17-n { width: 26px; height: 26px; border-radius: 8px; background: var(--accent-bg); color: var(--accent); font-weight: 800; display: grid; place-items: center; font-size: 14px; }
      .sec-1-7 .s17-item .ui-slider { font-size: 14px; }
      .sec-1-7 .s17-range { font-size: 14.5px; line-height: 1.4; border-radius: 10px; padding: 7px 10px; background: var(--panel-2); border: 1px solid var(--line); }
      .sec-1-7 .s17-range.bad { background: var(--bad-bg); border-color: var(--bad); }
      .sec-1-7 .s17-log { height: 118px; font-size: 13px; }
      .sec-1-7 .s17-lane { display: grid; grid-template-columns: 150px minmax(0, 1fr) 244px; gap: 12px; align-items: center; padding: 7px 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); }
      .sec-1-7 .s17-info { font-size: 13px; line-height: 1.4; color: var(--ink-2); }
      .sec-1-7 .s17-cs { padding-top: 6px; padding-bottom: 6px; }
      .sec-1-7 .s17-cs .v { font-size: 21px; }

    `,

    steps: [
      /* ============ 1. Big Picture: who carries the data? ============ */
      {
        title: 'Moving data: who does the carrying?',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack">
              <p class="lead m0">Every file you open must travel, <span class="t">word</span> by word, between an I/O device and main memory. The big question: <b>who carries it?</b></p>
              <p class="m0">In <span class="t">programmed I/O</span> the processor carries every word and keeps checking on the device. In <span class="t">interrupt-driven I/O</span> the I/O module interrupts (as in 1.4) when a word is ready, but the processor still carries every word. With <span class="t">direct memory access (DMA)</span>, previewed in 1.3, a helper module carries the whole block and tells the processor only at the end.</p>
              <div class="callout analogy m0" data-label="Analogy">Moving house. <b>(1)</b> You carry every box and keep running to the door to see if the next one has come. <b>(2)</b> A doorbell rings for each box, but you still carry each one in. <b>(3)</b> You hire movers, say what goes where, and they phone you once when all is inside.</div>
              <div class="callout tip m0" data-label="Try it">Switch techniques and watch the <b>Program B</b> box: other work the processor could be doing.</div>
            </div>
            <div class="card white stack s17-story" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const card = ctx.$('.s17-story');
          const svg = busSvg(ctx);
          const W = ['H', 'I', '!'];
          /* each technique is a looping script of timed phases (seconds) */
          function script(mode) {
            const ph = [];
            if (mode === 'dma') ph.push({ d: 1.4, path: 'cmd', cls: 'cmd', tok: '4 items', cpu: 'setting up the DMA', sub: 'op, device, address, count', dma: [0] });
            W.forEach((c, i) => {
              if (mode === 'pio') {
                ph.push({ d: 0.6, path: 'cmd', cls: 'cmd', tok: 'READ', cpu: 'sending a command', dev: 'reading…', m: i });
                ph.push({ d: 1.5, path: 'toCpu', cls: 'cmd', tok: '0', loops: 3, cpu: 'status? no… no…', tone: 'warn', sub: 'busy waiting', dev: 'reading…', m: i });
                ph.push({ d: 0.5, path: 'dev', tok: c, dev: 'word ready', devTone: 'ok', m: i });
                ph.push({ d: 0.6, path: 'toCpu', cls: 'cmd', tok: '1', cpu: 'status = READY', tone: 'ok', lamp: 1, data: c, m: i });
                ph.push({ d: 0.7, path: 'toCpu', tok: c, cpu: 'reading the word', data: c, m: i });
                ph.push({ d: 0.7, path: 'toMem', tok: c, R: c, cpu: 'storing the word', m: i });
              } else if (mode === 'int') {
                ph.push({ d: 0.5, path: 'cmd', cls: 'cmd', tok: 'READ', cpu: i ? 'handler: next command' : 'sending a command', tone: i ? 'intr' : 'cpu', dev: 'reading…', m: i });
                ph.push({ d: 1.4, cpu: 'running Program B', tone: 'proc', sub: 'useful work', dev: 'reading…', m: i, b: 1 });
                ph.push({ d: 0.5, path: 'dev', tok: c, cpu: 'running Program B', tone: 'proc', dev: 'word ready', devTone: 'ok', m: i, b: 1 });
                ph.push({ d: 0.7, intr: 1, cpu: 'interrupted!', tone: 'intr', sub: 'saving its context', data: c, lamp: 1, m: i });
                ph.push({ d: 0.7, path: 'toCpu', tok: c, cpu: 'handler reads word', tone: 'intr', data: c, m: i });
                ph.push({ d: 0.7, path: 'toMem', tok: c, R: c, cpu: 'handler stores word', tone: 'intr', m: i });
              } else {
                ph.push({ d: 0.55, path: 'dev', tok: c, cpu: 'running Program B', tone: 'proc', sub: 'useful work', dev: 'reading…', devTone: 'io', m: i, b: 1, dma: [i, c] });
                ph.push({ d: 0.7, path: 'ctlToMem', tok: c, cpu: 'running Program B', tone: 'proc', sub: 'useful work', m: i, b: 1, dma: [i, c] });
              }
            });
            if (mode === 'dma') ph.push({ d: 1.1, intr: 1, cpu: 'one interrupt: done', tone: 'intr', sub: 'whole block is in memory', m: 3, dma: [3] });
            ph.push({ d: 1.6, cpu: mode === 'pio' ? 'finally free' : 'running Program B', tone: mode === 'pio' ? 'cpu' : 'proc', sub: '3 words in memory', m: 3, b: 1, dma: mode === 'dma' ? [3] : null, R: mode === 'dma' ? '' : '!' });
            return ph;
          }
          const INFO = {
            pio: [['Who moves words?', 'The processor. Every word goes device → module → register R → memory.'], ['How it finds out', 'It keeps reading the module’s status register until the bit says ready.'], ['Processor time', 'All of it. While it waits and checks, it can do nothing else.']],
            int: [['Who moves words?', 'Still the processor: its interrupt handler copies each word.'], ['How it finds out', 'The module sends an interrupt each time a word is ready.'], ['Processor time', 'Only the handling, but that happens once for <b>every word</b>.']],
            dma: [['Who moves words?', 'The DMA module, straight into memory. No word visits the processor.'], ['How it finds out', 'One interrupt, after the <b>whole block</b> is done.'], ['Processor time', 'Only the setup at the start and the one interrupt at the end.']],
          };
          const facts = h('div', { class: 'grid-3', style: { gap: '8px' } });
          let mode = 'pio', ph = script(mode), total = ph.reduce((a, p) => a + p.d, 0), t0 = performance.now();
          function paintFacts() { facts.replaceChildren(...INFO[mode].map(([a, b]) => h('div', { class: 'card tight' }, h('h4', { class: 'm0' }, a), h('div', { class: 'small', html: b })))); }
          function frame(now) {
            let t = ((now - t0) / 1000) % total, p = ph[0], k = 0;
            for (k = 0; k < ph.length; k++) { if (t < ph[k].d) { p = ph[k]; break; } t -= ph[k].d; }
            let f = Math.min(1, t / p.d);
            if (p.loops) f = (f * p.loops) % 1;
            const mem = ['', '', '', '', '', ''];
            for (let i = 0; i < Math.min(3, p.m); i++) mem[i] = W[i];
            if (p.path === 'toMem' || p.path === 'ctlToMem') { if (f > 0.92) mem[p.m] = W[p.m]; }
            const st = {
              mode: mode === 'dma' ? 'dma' : 'io', mem, hot: p.path === 'toMem' || p.path === 'ctlToMem' ? p.m : null,
              path: p.path, pathCls: p.cls, tok: p.tok, frac: f, intr: p.intr, R: p.R || (mode !== 'dma' && p.m > 0 ? W[p.m - 1] : ''),
              cpuLine: p.cpu, cpuTone: p.tone, cpuSub: p.sub, lamp: p.lamp, data: p.data || '', devLine: p.dev || 'idle', devTone: p.devTone || (p.dev ? 'io' : 'muted'),
              note: { title: 'Program B', value: p.b ? 'running' : 'waiting', tone: p.b ? 'proc' : 'warn', sub: p.b ? 'useful work' : 'no progress' },
            };
            if (mode === 'dma' && p.dma) {
              const done = p.dma[0];
              st.dma = { op: 'READ', dev: 'disk', addr: String(200 + Math.min(done, 3)), count: String(3 - done) };
              st.data = p.dma[1] || '';
              st.hotReg = p.path === 'cmd' ? 'op dev addr count' : p.path === 'ctlToMem' ? 'addr count data' : '';
            }
            svg.replaceChildren(...busNodes(ctx, st));
          }
          const seg = ctx.ui.seg([{ value: 'pio', label: '1 · Programmed I/O' }, { value: 'int', label: '2 · Interrupt-driven' }, { value: 'dma', label: '3 · DMA' }], mode, (v) => {
            mode = v; ph = script(v); total = ph.reduce((a, p) => a + p.d, 0); t0 = performance.now(); paintFacts();
          });
          paintFacts();
          frame(performance.now());
          ctx.raf((now) => { frame(now); });
          card.append(seg, h('div', { style: { display: 'grid', placeItems: 'center' } }, svg), facts);
        },
      },
      /* ============ 2. Programmed I/O: you are the processor ============ */
      {
        title: 'Programmed I/O: you are the processor, so keep asking',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const WORDS = ['H', 'I', '!'], NEED = [4, 3, 5];   // status checks until each word is ready (the last check sees READY = 1)
          const svg = busSvg(ctx);
          const code = codeBox(ctx, `
for (i = 0; i < 3; i++) {       // once for each word of the block
  command(disk, READ);          // ask the module for one word
  while (status(disk) != READY) // read the status register...
    ;                           // ...not ready yet: read it again
  R = data(disk);               // ready: copy the word into R
  memory[200 + i] = R;          // store R in the next memory cell
}                               // repeat for the next word`, { nums: false, fontSize: 13 });
          const fb = h('div', { class: 'callout m0 fb', style: { minHeight: '104px' } });
          const stats = h('div', { class: 'grid-4', style: { gap: '8px' } });
          let st, auto = null;
          function reset() {
            st = { w: 0, phase: 'cmd', checks: 0, instr: 0, allChecks: 0, wasted: 0, lamp: 0, data: '', R: '', mem: ['', '', '', '', '', ''], path: null, tok: null, cls: null, hot: null, dev: 'idle', devTone: 'muted', cpu: 'waiting for you', tone: 'cpu' };
            code.clear();
            say('tip', 'Your job', 'Move the block <b>H I !</b> from the disk into cells 200–202. Start by sending the module a <b>READ</b> command.');
            paint();
          }
          function say(kind, label, html) { fb.className = 'callout m0 fb ' + kind; fb.dataset.label = label; fb.innerHTML = html; }
          function stat(v, l, col) { return h('div', { class: 'stat card tight' }, h('span', { class: 'v', style: { color: col ? 'var(--' + col + ')' : null } }, String(v)), h('span', { class: 'l' }, l)); }
          function paint() {
            svg.replaceChildren(...busNodes(ctx, { mode: 'io', mem: st.mem, hot: st.hot, R: st.R, lamp: st.lamp, data: st.data, path: st.path, pathCls: st.cls, tok: st.tok, frac: 0.55,
              cpuLine: st.cpu, cpuTone: st.tone, cpuSub: 'instructions so far: ' + st.instr, devLine: st.dev, devTone: st.devTone,
              note: { title: 'Program B', value: '0 done', tone: 'warn', sub: st.phase === 'done' ? 'can run now' : 'still waiting' } }));
            stats.replaceChildren(stat(st.instr, 'Instructions'), stat(st.allChecks, 'Status checks'), stat(st.wasted, 'Wasted', 'warn'), stat(st.mem.filter(Boolean).length + ' / 3', 'Words moved', 'mem'));
          }
          function act(kind, fromAuto) {
            if (!fromAuto && auto) { clearInterval(auto); auto = null; }
            const w = st.w, c = WORDS[w];
            st.path = null; st.tok = null; st.hot = null;
            if (st.phase === 'done') { say('tip', 'Finished', 'The whole block is already in memory. Press <b>Reset</b> to try again.'); return paint(); }
            if (kind === 'cmd') {
              if (st.phase !== 'cmd') { say('warn', 'Not now', st.phase === 'wait' ? 'The module is already working on this word. Your job now is to <b>check its status</b>.' : 'Finish moving the current word first.'); return paint(); }
              st.instr++; st.phase = 'wait'; st.checks = 0; st.path = 'cmd'; st.cls = 'cmd'; st.tok = 'READ'; st.dev = 'reading…'; st.devTone = 'io'; st.cpu = 'command sent'; st.tone = 'cpu';
              code.clear(); code.mark(2);
              say('why', 'Command sent', `Your <span class="t">I/O command</span> starts the disk for word ${w + 1}. When the word arrives it will set <b>READY = 1</b> in its status register and then do nothing more. It will <b>not</b> tell you. Check its status.`);
            } else if (kind === 'check') {
              if (st.phase === 'cmd') { say('warn', 'Nothing to wait for', 'The module has not been asked to do anything yet. Send the <b>READ</b> command first.'); return paint(); }
              if (st.phase === 'store') { say('warn', 'Not needed', 'You already hold the word in R. Store it in memory.'); return paint(); }
              st.instr++; st.allChecks++; st.cls = 'cmd'; st.path = 'toCpu';
              code.clear();
              if (st.phase === 'read') { st.wasted++; st.tok = '1'; code.mark([3]); say('warn', 'Already ready', 'Still <b>READY = 1</b>. You knew that already: one more wasted instruction. Read the data register.'); return paint(); }
              st.checks++;
              if (st.checks >= NEED[w]) {
                st.lamp = 1; st.data = c; st.phase = 'read'; st.tok = '1'; st.dev = 'word sent'; st.devTone = 'ok'; st.cpu = 'status = READY'; st.tone = 'ok';
                code.mark([3], 'ok');
                say('tip', 'READY = 1', `Word ${w + 1} is in the module’s <span class="t">data register</span>. It took <b>${st.checks} checks</b>, and ${st.checks - 1} of them found nothing. Now read the data register.`);
              } else {
                st.wasted++; st.tok = '0'; st.cpu = 'status? not ready'; st.tone = 'warn';
                code.mark([3, 4]);
                say('warn', 'READY = 0', `Not yet (check ${st.checks}). Checking like this is <span class="t">polling</span>, and since you can run nothing else meanwhile, it is <span class="t">busy waiting</span>. Check again.`);
              }
            } else if (kind === 'read') {
              if (st.phase === 'wait') { st.instr++; st.wasted++; code.clear(); code.mark(5, 'bad'); say('bad', 'Too early', 'READY is still 0, so the data register does not hold the new word yet. In programmed I/O the <b>only</b> way to know is to check the status bit.'); return paint(); }
              if (st.phase !== 'read') { say('warn', 'Not now', st.phase === 'cmd' ? 'There is no word waiting. Send a READ command first.' : 'You already read this word. Store it.'); return paint(); }
              st.instr++; st.R = c; st.lamp = 0; st.data = ''; st.phase = 'store'; st.path = 'toCpu'; st.cls = 'data'; st.tok = c; st.dev = 'idle'; st.devTone = 'muted'; st.cpu = 'word is in R'; st.tone = 'cpu';
              code.clear(); code.mark(5);
              say('why', 'Into the processor', `“${c}” travels over the bus into register R. Every single word of the block must pass through the processor like this.`);
            } else if (kind === 'store') {
              if (st.phase !== 'store') { say('warn', 'Not now', st.phase === 'read' ? 'The word is still in the module. Read the data register into R first.' : 'R does not hold a new word yet.'); return paint(); }
              st.instr++; st.mem[w] = c; st.hot = w; st.path = 'toMem'; st.cls = 'data'; st.tok = c; st.w++;
              code.clear(); code.mark(6);
              if (st.w === 3) {
                st.phase = 'done'; st.cpu = 'block finished'; st.tone = 'ok';
                say('tip', 'Block finished', `3 words took <b>${st.instr} instructions</b>, and <b>${st.wasted}</b> of them achieved nothing. Program B ran <b>0</b>. A real device is so much slower than the processor that one wait can last thousands of checks, not ${NEED.slice(0, -1).join(', ')} or ${NEED[NEED.length - 1]}.`);
              } else {
                st.phase = 'cmd'; st.cpu = 'word stored'; st.tone = 'cpu';
                say('why', 'Word stored', `“${c}” is in cell ${200 + w}. For word ${w + 2} the whole routine repeats: command, check, check, check…, read, store.`);
              }
            }
            paint();
          }
          const nextAct = () => ({ cmd: 'cmd', wait: 'check', read: 'read', store: 'store' })[st.phase];
          const B = (label, k, cls) => h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: () => act(k) }, label);
          const btns = h('div', { class: 'grid-2', style: { gap: '8px' } }, B('1 · Send READ command', 'cmd', 'cpu'), B('2 · Check status', 'check', 'io'), B('3 · Read data register', 'read', 'cpu'), B('4 · Store R in memory', 'store', 'mem'));
          const finish = h('button', { class: 'btn primary sm', type: 'button', onclick: () => {
            if (auto || st.phase === 'done') return;
            auto = ctx.every(380, () => { if (st.phase === 'done') { clearInterval(auto); auto = null; return; } act(nextAct(), true); });
          } }, 'Finish it for me');
          const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { if (auto) { clearInterval(auto); auto = null; } reset(); } }, 'Reset');
          reset();
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0,6fr) minmax(0,5fr)' } },
            h('div', { class: 'card white stack', style: { gap: '8px' } }, svg, code,
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Thinking the module “tells” the processor it has finished. In programmed I/O it only flips a bit; the processor has to come and look.' })),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: '<b>You are the processor.</b> In <span class="t">programmed I/O</span> the <span class="t">I/O module</span> does what it is told and sets bits in its <span class="t">status register</span>, but it never interrupts. Finding out when it is done is <i>your</i> problem.' }),
              btns, fb, stats, h('div', { class: 'row' }, finish, again, h('span', { class: 'xs muted' }, 'Each button press = one instruction.')),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The processor is 100% busy, yet Program B makes no progress at all. Every failed check is an instruction thrown away. The next two techniques attack exactly this waste.' }))));
        },
      },
      /* ============ 3. Interrupt-driven I/O: a doorbell for every word ============ */
      {
        title: 'Interrupt-driven I/O: a doorbell for every word',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const S = simulate('int', 3, 16);            // 73 ticks: 33 on I/O, 40 for Program B
          const svg = busSvg(ctx);
          const TW = ctx.narrow ? 340 : 600;            // time-line width: narrower viewBox on phones keeps its text readable
          const tl = s('svg', { viewBox: `0 0 ${TW} 64`, width: '100%', role: 'img', 'aria-label': 'Processor time line' });
          const code = codeBox(ctx, `
void on_disk_interrupt() {   // runs when the disk interrupts
  save_context();            // keep Program B's registers safe
  R = data(disk);            // copy the ready word into R
  memory[next++] = R;        // store it; next cell next time
  if (next < 203)            // more words still to come?
    command(disk, READ);     //   then ask for the next one
  restore_context();         // put Program B's registers back
}                            // return: Program B continues`, { nums: false, fontSize: 13 });
          const stats = h('div', { class: 'grid-4', style: { gap: '8px' } });
          const io = 'io';
          const F = [
            { cut: 0, ni: 0, mem: 0, st: { cpuLine: 'running Program A', cpuSub: 'needs the block H I !' }, lines: [],
              cap: '<b>Start.</b> Program A needs the three-word block <b>H I !</b> from the disk. This time the processor will not sit and poll.' },
            { cut: 1, ni: 0, mem: 0, st: { path: 'cmd', pathCls: 'cmd', tok: 'READ', cpuLine: 'sending a command', devLine: 'reading…', devTone: io }, lines: [],
              cap: 'The processor sends a <b>READ</b> command to the I/O module (1 instruction). The module starts the disk.' },
            { cut: 17, ni: 0, mem: 0, st: { cpuLine: 'running Program B', cpuTone: 'proc', cpuSub: 'useful work', devLine: 'reading…', devTone: io }, lines: [],
              cap: 'Program A cannot go on without its data, so instead of polling the processor <b>switches to Program B</b> and does 16 instructions of useful work while the disk is busy.' },
            { cut: 17, ni: 1, mem: 0, st: { intr: true, lamp: 1, data: 'H', path: 'dev', tok: 'H', cpuLine: 'interrupt request!', cpuTone: 'intr', devLine: 'word sent', devTone: 'ok' }, lines: [1],
              cap: 'The word reaches the module’s data register and the module <b>raises an interrupt</b>. The processor finishes its current instruction, then runs the <span class="t">interrupt handler</span>.' },
            { cut: 21, ni: 1, mem: 0, st: { lamp: 1, data: 'H', cpuLine: 'saving context', cpuTone: 'intr', cpuSub: 'overhead, no data moved' }, lines: [2],
              cap: 'First Program B’s <span class="t">context</span> (program counter, status word, registers) is saved so B can later resume exactly where it stopped. Our model charges 4 instructions. Pure overhead: no data has moved yet.' },
            { cut: 22, ni: 1, mem: 0, st: { path: 'toCpu', tok: 'H', R: 'H', hotR: true, cpuLine: 'handler reads word', cpuTone: 'intr' }, lines: [3],
              cap: 'The handler reads the data register: <b>H</b> travels over the bus into register R. The word still passes <b>through the processor</b>.' },
            { cut: 23, ni: 1, mem: 1, hot: 0, st: { path: 'toMem', tok: 'H', R: 'H', cpuLine: 'handler stores word', cpuTone: 'intr' }, lines: [4],
              cap: 'Then it writes R into memory cell 200. Reading and storing are the only 2 instructions that actually move data.' },
            { cut: 24, ni: 1, mem: 1, st: { path: 'cmd', pathCls: 'cmd', tok: 'READ', R: 'H', cpuLine: 'handler: next word', cpuTone: 'intr', devLine: 'reading…', devTone: io }, lines: [5, 6],
              cap: 'More words are still to come, so the handler sends the next <b>READ</b> command. The disk starts on word 2.' },
            { cut: 28, ni: 1, mem: 1, st: { R: 'H', cpuLine: 'restoring context', cpuTone: 'intr', devLine: 'reading…', devTone: io }, lines: [7, 8],
              cap: 'The handler restores Program B’s registers (4 more) and returns; B carries on where it stopped. Word 1 cost <b>11 instructions</b>: its command 1 + save 4 + move 2 + restore 4. (I/O work shows 12: it also counts the command that started word 2.)' },
            { cut: 51, ni: 2, mem: 2, st: { R: 'I', cpuLine: 'running Program B', cpuTone: 'proc', cpuSub: 'useful work', devLine: 'reading…', devTone: io }, lines: [],
              cap: '<b>Word 2</b> repeats the pattern. Program B runs only 12 instructions this time, because the disk was already working during the 4-instruction restore. Then: interrupt, save, move <b>I</b> to cell 201, next command, restore.' },
            { cut: 73, ni: 3, mem: 3, st: { R: '!', cpuLine: 'running Program B', cpuTone: 'proc', cpuSub: 'block is complete' }, lines: [],
              cap: '<b>Word 3</b> is the last, so no new command. Total: <b>3 interrupts, 33 instructions of I/O work</b> (11 per word), and Program B got 40 instructions done.' },
          ];
          function stat(v, l, col) { return h('div', { class: 'stat card tight' }, h('span', { class: 'v', style: { color: col ? 'var(--' + col + ')' : null } }, String(v)), h('span', { class: 'l' }, l)); }
          function render(i) {
            const f = F[i], part = S.acts.slice(0, f.cut);
            const busyIO = part.filter((a) => a !== 'free').length, freeB = part.length - busyIO;
            const mem = ['H', 'I', '!', '', '', ''].map((v, k) => (k < f.mem ? v : ''));
            svg.replaceChildren(...busNodes(ctx, Object.assign({ mode: 'io', mem, hot: f.hot, R: '', note: { title: 'Program B', value: freeB + ' done', tone: 'proc', sub: 'instructions' } }, f.st)));
            tl.replaceChildren(
              s('text', { x: 0, y: 13, class: 't13 b' }, 'Processor time line'),
              s('text', { x: TW, y: 13, class: 't13 end s-sub' }, 't = ' + f.cut + ' of ' + S.end),
              ...timelineNodes(ctx, S.acts, { x: 1, y: 26, w: TW - 2, h: 24, tMax: S.end, cut: f.cut, marks: S.ints.slice(0, f.ni), cursor: f.cut }),
              s('text', { x: 1, y: 63, class: 't13 s-sub' }, '▼ = interrupt'));
            stats.replaceChildren(stat(f.ni, 'Interrupts', 'intr'), stat(busyIO, 'I/O work'), stat(freeB, 'Program B', 'proc'), stat(f.mem + ' / 3', 'Through R', 'cpu'));
            code.clear(); if (f.lines.length) code.mark(f.lines);
            return f.cap;
          }
          const player = ctx.ui.player({ count: F.length, render, interval: 2600 });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0,6fr) minmax(0,5fr)' } },
              h('div', { class: 'card white stack', style: { gap: '6px' } }, svg, tl, keyRow(ctx, ['free', 'cmd', 'move', 'ctx'])),
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('p', { class: 'm0 small', html: 'In <span class="t">interrupt-driven I/O</span> the processor gives a command and walks away. When a word is ready the module interrupts, and this short handler moves that one word:' }),
                code, stats,
                h('div', { class: 'callout warn m0 small', 'data-label': 'Better, but…', html: 'Program B now gets real work done. Yet every word still passes through register R, and every word costs a whole interrupt: save, move, restore.' }))),
            player.el));
        },
      },
      /* ============ 4. The two drawbacks both techniques share ============ */
      {
        title: 'Two drawbacks that polling and interrupts share',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:10px">
              <p class="m0">Programmed I/O and interrupt-driven I/O wait in different ways, but they share <b>two drawbacks</b>:</p>
              <div class="card tight" style="border-left:5px solid var(--warn)"><h3 class="m0">1 · A speed limit</h3><p class="small m0">The <span class="t">transfer rate</span> can never be faster than the processor can <b>test and service</b> the device. However quick the device is, each word waits for its turn of processor instructions.</p></div>
              <div class="card tight" style="border-left:5px solid var(--intr)"><h3 class="m0">2 · A tied-up processor</h3><p class="small m0">The processor must run instructions for <b>every word</b>: a 4,096-word block means 4,096 rounds of service code and, with interrupts, 4,096 interrupts.</p></div>
              <div class="callout why m0 small" data-label="The root cause">In both techniques every word travels through a processor register. Take the processor out of the data path and both drawbacks disappear. That is exactly what <span class="t">DMA</span> does.</div>
              <div class="s17-pred"></div>
            </div>
            <div class="card white stack s17-dr" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const card = ctx.$('.s17-dr');
          const NW = ctx.narrow;                       // phones get a narrower viewBox so the labels stay readable
          const svg = s('svg', { viewBox: NW ? '0 0 340 290' : '0 0 620 272', width: '100%', role: 'img', 'aria-label': 'Bars comparing transfer rate and processor time' });
          const say = h('div', { class: 'callout m0 fb' });
          const fmt = (x) => (x >= 100 ? Math.round(x) : x.toFixed(1));
          function draw(D) {
            const pio = 1 / (D + 3), int = 1 / (Math.max(D, 4) + 7), dev = 1 / D;
            const intBusy = 11 / (Math.max(D, 4) + 7);
            const X0 = NW ? 118 : 168, BW = NW ? 130 : 300;
            const bar = (y, label, frac, col, txt) => [
              s('text', { x: X0 - 10, y: y + 18, class: 't14 end' }, label),
              s('rect', { x: X0, y, width: BW, height: 26, rx: 6, class: 's-panel', 'stroke-width': 1 }),
              s('rect', { x: X0, y, width: Math.max(2, BW * Math.min(1, frac)), height: 26, rx: 6, style: `fill:var(--${col}-bg);stroke:var(--${col});stroke-width:1.5` }),
              s('text', { x: X0 + BW + (NW ? 6 : 10), y: y + 18, class: 't14 b', style: `fill:var(--${col})` }, txt)];
            svg.replaceChildren(
              s('text', { x: 0, y: 15, class: 't14 b' }, 'Words moved per 1,000 instruction-times'),
              ...bar(28, 'Device could do', 1, 'io', fmt(1000 * dev)),
              ...bar(64, 'Programmed I/O', pio / dev, 'warn', fmt(1000 * pio) + '  (' + Math.round(100 * pio / dev) + '%)'),
              ...bar(100, 'Interrupt-driven', int / dev, 'intr', fmt(1000 * int) + '  (' + Math.round(100 * int / dev) + '%)'),
              s('text', { x: 0, y: 164, class: 't14 b' }, NW ? 'Processor time eaten by the transfer' : 'Share of processor time eaten by the transfer'),
              ...bar(177, 'Programmed I/O', 1, 'warn', '100%'),
              ...bar(213, 'Interrupt-driven', intBusy, 'intr', Math.round(100 * intBusy) + '%'),
              ...(NW ? [s('text', { x: 0, y: 268, class: 't13 s-sub' }, 'Model: polling = 1 command + D checks + 2'), s('text', { x: 0, y: 286, class: 't13 s-sub' }, 'moves per word; each interrupt = 11 instructions.')]
                : [s('text', { x: 0, y: 268, class: 't13 s-sub' }, 'Model: polling = 1 command + D checks + 2 moves per word; each interrupt = 11 instructions.')]));
            if (D <= 4) { say.className = 'callout bad m0 fb'; say.dataset.label = 'Drawback 1: the processor is the bottleneck'; say.innerHTML = `The device could hand over a word every <b>${D}</b> instruction-time${D > 1 ? 's' : ''}. Polling needs ${D + 3} instruction-times per word and each interrupt needs 11, so the data trickles at <b>${Math.round(100 * pio / dev)}%</b> and <b>${Math.round(100 * int / dev)}%</b> of the device’s speed. The processor cannot test and service it any faster.`; }
            else if (D <= 15) { say.className = 'callout warn m0 fb'; say.dataset.label = 'Both drawbacks at once'; say.innerHTML = `At ${D} per word the transfer still loses ${Math.round(100 - 100 * pio / dev)}% (polling) and ${Math.round(100 - 100 * int / dev)}% (interrupts) of the device’s speed, and the processor is tied up <b>100%</b> or <b>${Math.round(100 * intBusy)}%</b> of the time.`; }
            else { say.className = 'callout why m0 fb'; say.dataset.label = 'Drawback 2: a tied-up processor'; say.innerHTML = `With a slow device (${D} per word) the speed limit hurts less: the transfer reaches ${Math.round(100 * pio / dev)}% and ${Math.round(100 * int / dev)}% of the device’s speed. The bigger cost is processor time: polling burns <b>100%</b>, interrupts about <b>${Math.round(100 * intBusy)}%</b>, just to move words.`; }
          }
          const sl = ctx.ui.slider({ label: 'Device needs <i>D</i> =', min: 1, max: 60, value: 30, format: (v) => v + ' per word', onInput: draw });
          card.append(h('h3', { class: 'm0' }, 'Explore: make the device faster'),
            h('p', { class: 'small muted m0' }, 'D = instruction-times the device needs to produce one word. Smaller D = faster device.'),
            sl, svg, say);
          ctx.$('.s17-pred').append(ctx.ui.reveal('Predict: device 10× faster → polling 10× faster?', '<p class="small m0">No. From 30 to 3 per word the device gets 10× faster, but polling only rises from 30.3 to 166.7 words per 1,000 (about 5.5×): each word still needs 3 service instructions.</p>'));
          draw(30);
        },
      },
      /* ============ 5. Program a DMA module ============ */
      {
        title: 'Lab: hand a whole block to the DMA module',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const MEM0 = 'hello-world!'.split('');                       // what memory holds before the transfer
          const DEVDATA = { 3: 'SECTOR42'.split(''), 5: 'PACKET#7'.split('') };
          const DEVNAME = { 3: 'Disk', 5: 'Network' };
          const D = 10;                                                  // device needs 10 ticks per word (as in the model)
          const f = { op: 'READ', dev: 3, start: 204, n: 5 };
          let st, gen = 0;
          const svg = busSvg(ctx);
          const log = h('div', { class: 'log s17-log' });
          const stats = h('div', { class: 'grid-4', style: { gap: '8px' } });
          const range = h('div', { class: 's17-range' });
          function fresh() {
            st = { mem: MEM0.slice(), dma: { op: '', dev: '', addr: '', count: '' }, data: '', hotReg: '', path: null, tok: null, cls: null, hot: null, intr: false,
              cpu: 'running Program A', tone: 'cpu', sub: 'about to request a block', dev: 'idle', devTone: 'muted', instr: 0, stolen: 0, ints: 0, B: 0, running: false, got: '' };
          }
          function stat(v, l, col) { return h('div', { class: 'stat card tight' }, h('span', { class: 'v', style: { color: col ? 'var(--' + col + ')' : null } }, String(v)), h('span', { class: 'l' }, l)); }
          function paint() {
            svg.replaceChildren(...busNodes(ctx, { mode: 'dma', mem: st.mem, hot: st.hot, sel: valid() ? [f.start - 200, f.start - 200 + f.n] : null, R: '', dma: st.dma, data: st.data, hotReg: st.hotReg, path: st.path, pathCls: st.cls, tok: st.tok, frac: 0.55,
              intr: st.intr, cpuLine: st.cpu, cpuTone: st.tone, cpuSub: st.sub, devName: DEVNAME[f.dev], devIcon: f.dev === 5 ? 'net' : 'disk', devLine: st.dev, devTone: st.devTone,
              note: { title: 'Program B', value: st.B + ' done', tone: 'proc', sub: 'instructions' } }));
            stats.replaceChildren(stat(st.instr, 'Processor I/O work'), stat(st.stolen, 'Stolen cycles', 'accent'), stat(st.ints, 'Interrupts', 'intr'), stat(0, 'Words through R', 'cpu'));
          }
          function addLog(html) { log.append(h('div', { html })); log.scrollTop = log.scrollHeight; }
          function valid() { return f.start + f.n - 1 <= 211; }
          function paintRange() {
            const ok = valid();
            range.className = 's17-range' + (ok ? '' : ' bad');
            range.innerHTML = ok ? `Block: <b>${f.n}</b> word${f.n > 1 ? 's' : ''}, cells <b>${f.start}–${f.start + f.n - 1}</b>, ${f.op === 'READ' ? DEVNAME[f.dev].toLowerCase() + ' → memory' : 'memory → ' + DEVNAME[f.dev].toLowerCase()}.`
              : `The block would need cells up to <b>${f.start + f.n - 1}</b>, but memory here ends at 211. Choose an earlier start or fewer words.`;
            go.disabled = !ok || (st && st.running);
          }
          function reset() { gen++; fresh(); log.replaceChildren(); addLog('Fill in the four items, then press <b>Send to DMA module</b>.'); paint(); paintRange(); }
          async function run() {
            if (!valid() || st.running) return;
            const my = ++gen; fresh(); st.running = true; log.replaceChildren(); paintRange();
            const alive = () => ctx.alive && gen === my;
            const wait = async (ms) => { await ctx.sleep(ms); return alive(); };
            const read = f.op === 'READ', words = read ? DEVDATA[f.dev].slice(0, f.n) : st.mem.slice(f.start - 200, f.start - 200 + f.n);
            const items = [['op', f.op, 'Operation = ' + f.op + ' (on the read/write control line)'], ['dev', '#' + f.dev, 'Device = #' + f.dev + ' (' + DEVNAME[f.dev].toLowerCase() + ', on the data lines)'],
              ['addr', String(f.start), 'Start address = ' + f.start + ' → address register'], ['count', String(f.n), 'Word count = ' + f.n + ' → count register']];
            for (let i = 0; i < 4; i++) {
              const [k, v, txt] = items[i];
              Object.assign(st, { path: 'cmd', cls: 'cmd', tok: v, hotReg: k, cpu: 'setting up the DMA', tone: 'cpu', sub: 'item ' + (i + 1) + ' of 4' });
              st.dma[k] = v; st.instr++;
              addLog('<b>P → DMA</b> ' + txt); paint();
              if (!(await wait(750))) return;
            }
            Object.assign(st, { path: null, tok: null, hotReg: '', cpu: 'running Program B', tone: 'proc', sub: 'the DMA does the rest', dev: read ? 'reading…' : 'waiting', devTone: 'io' });
            addLog('<b>Processor</b> goes back to Program B. From here on the DMA module works alone.'); paint();
            for (let k = 0; k < f.n; k++) {
              const c = words[k], addr = f.start + k, freeTicks = k === 0 ? D : D - 1;
              if (read) {
                for (let j = 0; j < freeTicks; j++) { st.B++; paint(); if (!(await wait(45))) return; }
                Object.assign(st, { path: 'dev', cls: 'data', tok: c, data: c, hotReg: 'data', dev: 'word ready', devTone: 'ok' }); paint();
                if (!(await wait(450))) return;
                Object.assign(st, { path: 'ctlToMem', tok: c, hot: addr - 200, hotReg: 'addr count', cpu: 'paused 1 bus cycle', tone: 'accent', sub: 'the DMA is using the bus' });
                st.mem[addr - 200] = c; st.stolen++;
              } else {
                Object.assign(st, { path: 'memToCtl', cls: 'data', tok: c, hot: addr - 200, data: c, hotReg: 'addr count data', cpu: 'paused 1 bus cycle', tone: 'accent', sub: 'the DMA is using the bus' });
                st.stolen++;
              }
              st.dma.addr = String(addr + 1); st.dma.count = String(f.n - k - 1); paint();
              addLog(`<b>DMA</b> ${read ? `“${c}” → memory[${addr}]` : `memory[${addr}] “${c}” → DMA`} · 1 bus cycle stolen · count now ${f.n - k - 1}`);
              if (!(await wait(700))) return;
              Object.assign(st, { hot: null, hotReg: '', cpu: 'running Program B', tone: 'proc', sub: 'the DMA does the rest' });
              if (read) Object.assign(st, { path: null, tok: null, data: '', dev: k < f.n - 1 ? 'reading…' : 'idle', devTone: k < f.n - 1 ? 'io' : 'muted' });
              else {
                st.got += c;
                Object.assign(st, { path: 'toDev', tok: c, dev: 'got ' + st.got.slice(-6), devTone: 'io' }); paint();
                for (let j = 0; j < freeTicks; j++) { st.B++; paint(); if (!(await wait(45))) return; }
                Object.assign(st, { path: null, tok: null, data: '' });
              }
              paint();
            }
            Object.assign(st, { intr: true, cpu: 'INTERRUPT: block done', tone: 'intr', sub: 'count reached 0' }); st.ints = 1; paint();
            addLog('<b>DMA → P</b> INTERRUPT: count is 0, the whole block is done.');
            if (!(await wait(1000))) return;
            st.instr += 10; Object.assign(st, { intr: false, cpu: 'completion handler', tone: 'intr', sub: 'save, check status, restore' }); paint();
            addLog('<b>Processor</b> handles the one interrupt: save context, check the DMA status, restore (10 instructions).');
            if (!(await wait(900))) return;
            Object.assign(st, { cpu: 'running Program B', tone: 'proc', sub: 'block transfer finished', running: false }); paint(); paintRange();
            addLog(`<b>Done.</b> ${f.n} words for <b>14</b> processor instructions and ${f.n} stolen cycles. Interrupt-driven I/O would have needed ${11 * f.n} instructions and ${f.n} interrupts; polling at least ${13 * f.n}.`);
          }
          const change = (k) => (v) => { f[k] = v; reset(); };
          const opSeg = ctx.ui.seg([{ value: 'READ', label: 'Read: device → memory' }, { value: 'WRITE', label: 'Write: memory → device' }], f.op, change('op'));
          const devSeg = ctx.ui.seg([{ value: 3, label: 'Disk (#3)' }, { value: 5, label: 'Network card (#5)' }], f.dev, change('dev'));
          const sStart = ctx.ui.slider({ label: 'Address', min: 200, max: 211, value: f.start, onInput: change('start') });
          const sN = ctx.ui.slider({ label: 'Words', min: 1, max: 8, value: f.n, onInput: change('n') });
          const go = h('button', { class: 'btn primary', type: 'button', onclick: run }, 'Send to DMA module ▶');
          const again = h('button', { class: 'btn', type: 'button', onclick: reset }, 'Reset');
          const item = (n, title, hint, control) => h('div', { class: 's17-item' }, h('span', { class: 's17-n' }, String(n)),
            h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '6px' } }, h('b', { class: 'small' }, title), h('span', { class: 'xs muted', html: hint })), control));
          reset();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'card stack', style: { gap: '8px' } },
              h('p', { class: 'small m0', html: 'You are the processor again, but now you only <b>set up</b> the <span class="t">block transfer</span>: write four items into the <span class="t">DMA module</span>, then walk away.' }),
              item(1, 'Read or write?', 'control line', opSeg),
              item(2, 'Which I/O device?', 'its address', devSeg),
              item(3, 'Start address in memory', '→ <span class="t">address register</span>', sStart),
              item(4, 'How many words?', '→ <span class="t">count register</span>', sN),
              range,
              h('div', { class: 'row' }, go, again),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why this works', html: 'The DMA module <b>does the processor’s bus work itself</b>: it puts each word’s address on the bus, moves the word, and updates its own address and count registers. The processor acts only at the start and at the end.' })),
            h('div', { class: 'card white stack', style: { gap: '8px' } }, svg, stats, log)));
        },
      },
      /* ============ 6. Cycle stealing ============ */
      {
        title: 'Cycle stealing: the DMA module borrows the bus',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const C = 20, LONG = 1000;         // the strip shows 20 cycles; the totals cover 1,000
          const STAGE = { F: ['fetch the next instruction', 1], D: ['decode the instruction', 0], O: ['fetch an operand', 1], X: ['execute the operation', 0], W: ['write the result to memory', 1] };
          /* A fixed (seeded) mix of 3- to 5-stage instructions, so the DMA module's regular
             steals do not lock onto one repeating instruction pattern. */
          const TYPES = ['FDOX', 'FDX', 'FDXW', 'FDOXW'], STREAM = [], ENDS = [];
          const rnd = ctx.util.seeded(3);
          while (STREAM.length < LONG + 8) { const t = TYPES[Math.floor(rnd() * TYPES.length)]; for (let j = 0; j < t.length; j++) { STREAM.push(t[j]); ENDS.push(j === t.length - 1); } }
          let BASE = 0; for (let c = 0; c < LONG; c++) if (ENDS[c]) BASE++;   // instructions finished with no DMA at all
          let k = 4, R = null;
          function sim(k) {
            const cyc = []; let p = 0, paused = 0, stolen = 0, done = 0;
            for (let c = 0; c < LONG; c++) {
              const dma = c % k === k - 1, stg = STREAM[p], bus = STAGE[stg][1];
              let x;
              if (dma) stolen++;
              if (dma && bus) { paused++; x = { c, dma, owner: 'DMA', proc: 'wait', stg, end: false }; }
              else { x = { c, dma, owner: dma ? 'DMA' : bus ? 'CPU' : 'idle', proc: 'run', stg, end: ENDS[p] }; if (ENDS[p]) done++; p++; }
              if (c < C) cyc.push(x);
            }
            return { cyc, paused, stolen, free: stolen - paused, done };
          }
          const svg = s('svg', { viewBox: ctx.narrow ? `0 0 340 ${34 + C * 30}` : '0 0 1100 150', width: '100%', role: 'img', 'aria-label': 'Bus cycles shared by the processor and the DMA module' });
          const wrap = h('div', {}, svg);
          const stats = h('div', { class: 'grid-2', style: { gap: '6px' } });
          const slow = h('div', { class: 'small', style: { lineHeight: '1.35' } });
          function stat(v, l, col) { return h('div', { class: 'stat card tight s17-cs' }, h('span', { class: 'v', style: { color: col ? 'var(--' + col + ')' : null } }, String(v)), h('span', { class: 'l' }, l)); }
          function cellTexts(x) {
            return { owner: x.owner === 'CPU' ? 'P' : x.owner, ownerCls: x.owner === 'DMA' ? 's-accent' : x.owner === 'CPU' ? 's-cpu' : 's-panel', ownerCol: x.owner === 'idle' ? 'fill:var(--muted)' : `fill:var(--${x.owner === 'DMA' ? 'accent' : 'cpu'})` };
          }
          function drawV(i) {              /* phones: one row per cycle */
            const n = [], cols = [['Cycle', 22], ['DMA', 110], ['Bus', 200], ['Processor', 290]];
            cols.forEach(([t, x]) => n.push(s('text', { x, y: 18, class: 't13 mid b' }, t)));
            R.cyc.forEach((x, c) => {
              const y = 30 + c * 30, g = s('g', { style: 'opacity:' + (c > i ? 0.22 : 1) }), o = cellTexts(x);
              g.append(s('text', { x: 22, y: y + 17, class: 't13 mid s-sub' }, String(c)));
              g.append(s('rect', { x: 70, y, width: 80, height: 24, rx: 5, class: x.dma ? 's-accent' : 's-panel', 'stroke-width': 1.2, style: x.dma ? null : 'stroke-dasharray:3 3' }));
              if (x.dma) g.append(s('text', { x: 110, y: y + 17, class: 't13 mid b', style: 'fill:var(--accent)' }, 'word'));
              g.append(s('rect', { x: 160, y, width: 80, height: 24, rx: 5, class: o.ownerCls, 'stroke-width': 1.2 }));
              g.append(s('text', { x: 200, y: y + 17, class: 't13 mid b', style: o.ownerCol }, o.owner));
              g.append(s('rect', { x: 250, y, width: 80, height: 24, rx: 5, class: x.proc === 'wait' ? 's-warn' : 's-cpu', 'stroke-width': 1.2 }));
              g.append(s('text', { x: 290, y: y + 17, class: 't13 mid b', style: x.proc === 'wait' ? 'fill:var(--warn)' : null }, x.proc === 'wait' ? 'wait' : x.stg));
              if (x.end) g.append(s('path', { d: `M${332},${y + 12} l6,9 l-12,0 z`, style: 'fill:var(--intr)' }));
              n.push(g);
            });
            if (i >= 0) n.push(s('rect', { x: 2, y: 30 + i * 30 - 3, width: 336, height: 30, rx: 7, style: 'fill:none;stroke:var(--ink);stroke-width:2' }));
            svg.replaceChildren(...n);
          }
          function draw(i) {
            if (ctx.narrow) return drawV(i);
            const X0 = 132, P = 48, W = 44, n = [];
            [['DMA module', 40], ['System bus', 80], ['Processor', 120]].forEach(([t, y]) => n.push(s('text', { x: 0, y: y + 5, class: 't14 b' }, t)));
            R.cyc.forEach((x, c) => {
              const cx = X0 + c * P, op = c > i ? 0.22 : 1, g = s('g', { style: 'opacity:' + op });
              g.append(s('text', { x: cx + W / 2, y: 13, class: 't13 mid s-sub' }, String(c)));
              g.append(s('rect', { x: cx, y: 26, width: W, height: 28, rx: 5, class: x.dma ? 's-accent' : 's-panel', 'stroke-width': 1.2, style: x.dma ? null : 'stroke-dasharray:3 3' }));
              if (x.dma) g.append(s('text', { x: cx + W / 2, y: 45, class: 't13 mid b', style: 'fill:var(--accent)' }, 'word'));
              g.append(s('rect', { x: cx, y: 66, width: W, height: 28, rx: 5, class: x.owner === 'DMA' ? 's-accent' : x.owner === 'CPU' ? 's-cpu' : 's-panel', 'stroke-width': 1.2 }));
              g.append(s('text', { x: cx + W / 2, y: 85, class: 't13 mid b', style: x.owner === 'idle' ? 'fill:var(--muted)' : `fill:var(--${x.owner === 'DMA' ? 'accent' : 'cpu'})` }, x.owner === 'CPU' ? 'P' : x.owner));
              g.append(s('rect', { x: cx, y: 106, width: W, height: 28, rx: 5, class: x.proc === 'wait' ? 's-warn' : 's-cpu', 'stroke-width': 1.2 }));
              g.append(s('text', { x: cx + W / 2, y: 125, class: 't14 mid b', style: x.proc === 'wait' ? 'fill:var(--warn)' : null }, x.proc === 'wait' ? 'wait' : x.stg));
              if (x.end) g.append(s('path', { d: `M${cx + W + 2},${136} l-5,9 l10,0 z`, style: 'fill:var(--intr)' }));
              n.push(g);
            });
            if (i >= 0) n.push(s('rect', { x: X0 + i * P - 3, y: 20, width: W + 6, height: 120, rx: 8, style: 'fill:none;stroke:var(--ink);stroke-width:2' }));
            svg.replaceChildren(...n);
          }
          function caption(i) {
            const x = R.cyc[i], [what] = STAGE[x.stg];
            let t = `<b>Cycle ${i}.</b> `;
            if (x.dma && x.proc === 'wait') t += `The DMA module has a word ready and takes the bus. The processor needed the bus to <b>${what}</b>, so it simply <b>pauses for this one cycle</b> and does it next cycle. Nothing is saved; no handler runs.`;
            else if (x.dma) t += `The DMA module takes the bus, but this cycle the processor only has to <b>${what}</b>, which happens inside the processor. It carries on: this steal costs nothing.`;
            else if (x.owner === 'CPU') t += `The processor uses the bus to <b>${what}</b>.`;
            else t += `The processor is busy inside itself: it has to <b>${what}</b>, so the bus is idle.`;
            if (x.end) t += ' This ends an instruction (▲): only here would it check for interrupts.';
            return t;
          }
          function paintStats() {
            stats.replaceChildren(stat(R.stolen, 'Words moved by DMA', 'accent'), stat(R.free, 'Harmless steals', 'ok'),
              stat(R.paused, 'Processor pauses', 'warn'), stat(R.done, `Instructions finished (${BASE} with no DMA)`, 'cpu'));
            slow.innerHTML = `Over ${LONG.toLocaleString('en-US')} cycles: <b>${ctx.util.fmt(100 * R.paused / LONG, 1)}%</b> of processor cycles lost`;
          }
          R = sim(k);
          const player = ctx.ui.player({ count: C, start: C - 1, interval: 1300, render: (i) => { draw(i); return caption(i); } });
          const sl = ctx.ui.slider({ label: 'DMA word every', min: 2, max: 10, value: k, format: (v) => v + ' cycles', onInput: (v) => { k = v; R = sim(k); paintStats(); player.stop(); player.go(C - 1); } });
          paintStats();
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)', height: 'auto' } },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0', html: 'The DMA module needs the <span class="t">system bus</span> for every word it moves, but the processor also uses that bus to fetch instructions and data. The DMA module wins: it takes the bus for <b>one <span class="t">bus cycle</span></b> at a time. This is <span class="t">cycle stealing</span>.' }),
                h('div', { class: 'grid-2', style: { gap: '8px' } },
                  h('div', { class: 'callout warn m0 small', 'data-label': 'Not an interrupt', html: 'No context is saved and no handler runs. The processor just waits one cycle, even mid-instruction.' }),
                  h('div', { class: 'callout why m0 small', 'data-label': 'Still worth it', html: 'The processor runs somewhat slower, but losing at most one bus cycle per word beats running 11 instructions per word.' }))),
              h('div', { class: 'card stack', style: { gap: '6px' } }, sl, slow, stats)),
            h('div', { class: 'card white', style: { padding: '6px 12px' } }, wrap,
              h('div', { class: 'xs muted', style: { marginTop: '2px' } }, 'F fetch instruction · D decode · O fetch operand · X execute · W write result (each instruction uses 3 to 5 of these). F, O, W need the bus; D, X do not. ▲ = instruction ends.')),
            player.el));
        },
      },
      /* ============ 7. The race + flowcharts ============ */
      {
        title: 'The race: one block, three techniques',
        kind: 'compare',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const TECH = [['pio', 'Programmed I/O', 'warn'], ['int', 'Interrupt-driven', 'intr'], ['dma', 'DMA', 'accent']];
          let N = 8, D = 30;
          function raceTab(p) {
            let R, tMax, stop = null;
            const lanes = TECH.map(([k, name, col]) => {
              const now = h('div', { class: 'xs muted', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }), words = h('div', { class: 'xs' });
              const svg = s('svg', { viewBox: '0 0 600 48', width: '100%', role: 'img', 'aria-label': name + ' processor time line' });
              const info = h('div', { class: 's17-info' });
              const row = h('div', { class: 's17-lane', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0,1fr)' } : null }, h('div', { class: 'stack', style: { gap: '2px' } }, h('div', { class: 'b', style: { color: `var(--${col})` } }, name), now, words), svg, info);
              return { k, now, words, svg, info, row };
            });
            const verdict = h('div', { class: 'callout m0 fb' });
            function compute() { R = {}; TECH.forEach(([k]) => (R[k] = simulate(k, N, D))); tMax = Math.max(...TECH.map(([k]) => R[k].end)); }
            function paint(cut) {
              lanes.forEach((L) => {
                const S = R[L.k], c = Math.min(cut, S.end), part = S.acts.slice(0, c);
                const free = part.filter((a) => a === 'free').length, stolen = part.filter((a) => a === 'stolen').length, io = c - free - stolen;
                const stored = S.stores.filter((x) => x <= c).length, ints = S.ints.filter((x) => x < c).length;
                const nodes = timelineNodes(ctx, S.acts, { x: 0, y: 11, w: 600, h: 22, tMax, cut: c, marks: S.ints.filter((x) => x < c), cursor: cut < S.end && cut > 0 ? c : null });
                for (let i = 0; i < N; i++) nodes.push(s('rect', { x: i * 600 / N + 1, y: 38, width: Math.max(2, 600 / N - 3), height: 9, rx: 2, style: i < stored ? 'fill:var(--mem-bg);stroke:var(--mem)' : 'fill:var(--panel-3);stroke:var(--line-2)', 'stroke-width': 1 }));
                L.svg.replaceChildren(...nodes);
                L.now.innerHTML = cut >= S.end ? `<b style="color:var(--ok)">finished at t = ${S.end}</b>` : cut > 0 ? KIND[S.acts[c]].toLowerCase() : 'ready to start';
                L.words.innerHTML = `words in memory: <b>${stored} / ${N}</b>`;
                L.info.innerHTML = `Processor on I/O: <b>${io}</b>${c ? ' (' + Math.round(100 * io / c) + '%)' : ''}<br>Paused by stolen cycles: <b>${stolen}</b><br>Free for Program B: <b style="color:var(--proc)">${free}</b><br>Interrupts: <b>${ints}</b> · words via R: <b>${L.k === 'dma' ? 0 : stored}</b>`;
              });
            }
            function showVerdict(done) {
              const a = R.pio, b = R.int, c = R.dma;
              if (!done) { verdict.className = 'callout tip m0 fb'; verdict.dataset.label = 'Predict first'; verdict.innerHTML = 'Which lane will leave the most time for Program B? Which will finish first? Press <b>Run the race</b>.'; return; }
              verdict.className = 'callout why m0 fb'; verdict.dataset.label = 'Result';
              let t = `Processor time spent on the transfer: polling <b>${a.io}</b>, interrupts <b>${b.io}</b>, DMA <b>${c.io}</b> (4 setup + 10 for its one interrupt), plus ${c.stolen} stolen cycle${c.stolen > 1 ? 's' : ''}.`;
              if (N === 1) t += ' With a single word DMA’s fixed cost (14) is more than one interrupt (11): DMA pays off for <b>multiple-word</b> transfers.';
              else if (D === 3) t += ` Fast device: it could deliver all ${N} words by t = ${N * 3}, yet polling needs until t = ${a.end} and interrupts until t = ${b.end}: the processor is the bottleneck. DMA moves each word as soon as the device has it and finishes at t = ${c.end}, setup and final interrupt included.`;
              else t += ` DMA left <b>${c.free}</b> time units for Program B, against ${b.free} (interrupts) and ${a.free} (polling).`;
              verdict.innerHTML = t;
            }
            function run() {
              if (stop) stop();
              compute(); const t0 = performance.now(), dur = 5200; showVerdict(false);
              stop = ctx.raf((now) => { const cut = Math.min(tMax, Math.floor(((now - t0) / dur) * tMax)); paint(cut); if (cut >= tMax) { showVerdict(true); stop = null; return false; } });
            }
            function finish() { if (stop) { stop(); stop = null; } compute(); paint(tMax); showVerdict(true); }
            function resetRace() { if (stop) { stop(); stop = null; } compute(); paint(0); showVerdict(false); }
            const sl = ctx.ui.slider({ label: 'Words in the block', min: 1, max: 32, value: N, onInput: (v) => { N = v; resetRace(); } });
            sl.style.width = ctx.narrow ? '100%' : '330px';
            const seg = ctx.ui.seg([{ value: 30, label: 'Slow device · 30 per word' }, { value: 3, label: 'Fast device · 3 per word' }], D, (v) => { D = v; resetRace(); });
            p.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
              h('div', { class: 'row', style: { gap: '10px 16px' } }, sl, seg, h('button', { class: 'btn primary sm', type: 'button', onclick: run }, 'Run the race ▶'), h('button', { class: 'btn sm', type: 'button', onclick: finish }, 'Skip to the end')),
              ...lanes.map((L) => L.row), keyRow(ctx, ['free', 'poll', 'cmd', 'move', 'ctx', 'stolen']), verdict));
            resetRace();
            return () => { if (stop) stop(); };
          }
          function flowTab(p) {
            const svg = s('svg', { viewBox: '0 0 1100 372', width: '100%', style: ctx.narrow ? null : 'height:340px', role: 'img', 'aria-label': 'Flowcharts of programmed I/O, interrupt-driven I/O and DMA' }, ...flowNodes(ctx));
            const say = h('div', { class: 'callout m0 small' });
            const TXT = {
              all: ['Compare', 'Look inside the shaded loops: the processor itself reads every word and writes it to memory. Only the DMA column has no per-word loop in the processor.'],
              0: ['Programmed I/O', 'The processor never leaves the loop: ask for a word, check the status until it is ready, move it, repeat. Nothing else can run in the meantime.'],
              1: ['Interrupt-driven I/O', 'The waiting is gone (“do something else”), but the processor still runs the read-word and write-word boxes once per word, after an interrupt each time.'],
              2: ['DMA', 'One command at the start, one interrupt at the end. The per-word work happens inside the DMA module, outside these boxes.'],
            };
            const pick = (v) => {
              if (ctx.narrow) svg.setAttribute('viewBox', `${5 + 365 * v} 0 360 372`);
              svg.querySelectorAll('.s17-col').forEach((g) => (g.style.opacity = v === 'all' || String(v) === g.dataset.col ? 1 : 0.22));
              say.dataset.label = TXT[v][0]; say.innerHTML = TXT[v][1];
            };
            const opts = [{ value: 'all', label: 'Compare all' }, { value: 0, label: 'Programmed I/O' }, { value: 1, label: 'Interrupt-driven' }, { value: 2, label: 'DMA' }];
            const first = ctx.narrow ? 0 : 'all';
            const seg = ctx.ui.seg(ctx.narrow ? opts.slice(1) : opts, first, pick);
            p.append(h('div', { class: 'stack fill', style: { gap: '8px' } }, seg, svg, say));
            pick(first);
          }
          el.append(ctx.ui.tabs([{ label: 'Race', render: raceTab }, { label: 'Flowcharts', render: flowTab }]));
        },
      },
      /* ============ 8. Recap ============ */
      {
        title: 'Recap: three ways to move a block',
        kind: 'recap',
        html: `
          <div class="stack fill" style="gap:10px">
            <div class="s17-tblwrap"><table class="tbl compact">
              <colgroup><col style="width:19%"><col style="width:22%"><col style="width:26%"><col style="width:11%"><col style="width:22%"></colgroup>
              <tr><th>Technique</th><th>Who moves each word?</th><th>How the processor learns it is done</th><th>Interrupts (N words)</th><th>Processor cost</th></tr>
              <tr><td><b style="color:var(--warn)">Programmed I/O</b></td><td>The processor</td><td>Polls the status register (busy waiting)</td><td class="num">0</td><td>All of its time until the block is done</td></tr>
              <tr><td><b style="color:var(--intr)">Interrupt-driven I/O</b></td><td>The processor, in the interrupt handler</td><td>An interrupt each time a word is ready</td><td class="num">N</td><td>Save + move + restore, for every word</td></tr>
              <tr><td><b style="color:var(--accent)">DMA</b></td><td>The DMA module, straight to memory</td><td>One interrupt when the whole block is done</td><td class="num">1</td><td>Setup + one interrupt, plus stolen bus cycles</td></tr>
            </table></div>
            <div class="row" style="justify-content:space-between"><p class="m0 small muted">Say each answer out loud before you flip the card.</p><span class="s17-flipall"></span></div>
            <div class="s17-flips"></div>
          </div>`,
        render(el, ctx) {
          ctx.$('.s17-flips').append(ctx.ui.flipcards([
            ['Programmed I/O in one line', 'Send a command, then check the status bit again and again (busy waiting). The module never interrupts.'],
            ['Interrupt-driven I/O in one line', 'Send a command, do other work, get interrupted when a word is ready, move it in the handler. Every word still passes through the processor.'],
            ['The two shared drawbacks', '1. The transfer rate is capped by how fast the processor can test and service the device. 2. The processor is tied up running instructions for every word.'],
            ['The four items a DMA module needs', 'Read or write · the address of the I/O device · the starting location in memory · the number of words.'],
            ['When does DMA involve the processor?', 'Only at the beginning (sending the four items) and at the end (one completion interrupt). No word passes through it.'],
            ['Cycle stealing', 'The DMA module takes the bus for one cycle; if the processor needed it, the processor just pauses, saving nothing. It runs a little slower, but for multi-word blocks DMA is far more efficient.'],
          ], { cols: 3, height: 128 }));
          if (ctx.narrow) {                 /* phones: the five-column table becomes one card per technique */
            const wrap = ctx.$('.s17-tblwrap'), rows = Array.from(wrap.querySelectorAll('tr')), heads = Array.from(rows[0].children).map((c) => c.textContent);
            wrap.replaceChildren(ctx.h('div', { class: 'stack', style: { gap: '8px' } }, ...rows.slice(1).map((r) => {
              const cells = Array.from(r.children);
              return ctx.h('div', { class: 'card tight stack', style: { gap: '2px' } }, ctx.h('div', { html: cells[0].innerHTML }), ...cells.slice(1).map((c, k) => ctx.h('div', { class: 'small', html: `<span class="muted">${heads[k + 1].replace(/\?$/, '')}:</span> ${c.innerHTML}` })));
            })));
          }
          ctx.$('.s17-flipall').append(ctx.h('button', { class: 'btn sm', type: 'button', onclick: () => { const all = ctx.$$('.flip'); const on = !all.every((c) => c.classList.contains('on')); all.forEach((c) => c.classList.toggle('on', on)); } }, 'Flip all'));
        },
      },
      /* ============ 9. Check yourself ============ */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In programmed I/O, how does the processor learn that the I/O module has finished an operation?',
            choices: ['It reads the module’s status register again and again until the ready bit is set.', 'The I/O module sends it an interrupt as soon as the word is ready.', 'A DMA module reports it once the whole block is in memory.', 'The timer interrupt tells it at the next clock tick.'], answer: 0,
            feedback: [null, 'That describes interrupt-driven I/O. In programmed I/O the module sets status bits and takes no further action.', 'That describes DMA; programmed I/O involves no DMA module.', 'Timer interrupts keep time for the operating system; they carry no news about a particular I/O operation.'],
            why: 'The module does the work and sets bits in its I/O status register, but it never signals. The processor must poll that register, which is busy waiting.' },
          { type: 'tf', q: 'With interrupt-driven I/O, the words being transferred no longer pass through the processor.', answer: false,
            why: 'Interrupts remove the waiting, not the carrying. The interrupt handler still reads each word from the module into a processor register and then writes it to memory.' },
          { type: 'multi', q: 'Which items does the processor send to a DMA module to start a block transfer? Select all that apply.',
            choices: ['Whether the operation is a read or a write', 'The address of the I/O device involved', 'The starting location in memory to read from or write to', 'The number of words to transfer', 'The data words themselves', 'The address of a handler to run after every word'], answer: [0, 1, 2, 3],
            why: 'Those four items are all the DMA module needs. The data never passes through the processor, and there is no per-word handler: the module interrupts once, when the whole block is done.' },
          { type: 'order', q: 'Put the steps of a DMA block transfer in order.',
            items: ['The processor sends the operation, device address, start address and word count to the DMA module', 'The processor goes back to other work', 'The DMA module moves the words one at a time between the device and memory', 'The count reaches zero and the DMA module sends an interrupt', 'The processor runs the interrupt handler and continues'],
            why: 'The processor takes part only at the beginning (setup) and at the end (the completion interrupt). Everything in between is done by the DMA module.' },
          { type: 'match', q: 'Match each technique or mechanism to its description.',
            pairs: [['Programmed I/O', 'Checks a status bit again and again'], ['Interrupt-driven I/O', 'An interrupt for every word'], ['Direct memory access', 'One interrupt for the whole block'], ['Cycle stealing', 'Borrows the bus for one cycle']],
            why: 'Polling, one interrupt per word, one interrupt per block, and borrowing single bus cycles: four different answers to the question “who moves the data, and who waits?”.' },
          { type: 'bucket', q: 'During a DMA block transfer, who does each job?', buckets: ['Processor', 'DMA module'],
            items: [['Sending the start address and word count to the module', 0], ['Putting each word’s memory address on the bus', 1], ['Adding one to the address register after each word', 1], ['Subtracting one from the count register after each word', 1], ['Raising the interrupt when the count reaches zero', 1], ['Running the handler when the block is finished', 0]],
            why: 'The processor sets the job up and handles the one interrupt at the end. Every per-word job, including updating the address and count registers, belongs to the DMA module.' },
          { type: 'num', q: 'A 512-word block is read from a disk twice: once with interrupt-driven I/O and once with DMA. How many interrupts does the processor receive in total over both transfers?', answer: 513, tol: 0, unit: 'interrupts',
            why: 'Interrupt-driven I/O interrupts once per word (512); the DMA module interrupts only once, after the whole block is done (1). 512 + 1 = 513.' },
          { type: 'num', q: 'Suppose interrupt-driven I/O costs the processor 11 instructions per word (save context 4, move the word 2, issue the next command 1, restore context 4), while a DMA transfer costs it 14 instructions per block (4 to set up, 10 for the one completion interrupt), whatever the block size. How many processor instructions does DMA save on a 200-word block?', answer: 2186, tol: 0, unit: 'instructions',
            why: 'Interrupt-driven: 200 × 11 = 2,200 instructions. DMA: 14, because the processor works only at the start and the end. Saving: 2,200 − 14 = 2,186.' },
          { type: 'num', q: 'With programmed I/O, the device needs 25 status checks before each word is ready (the 25th check finds it ready). Each word also needs 1 command, 1 read and 1 store. How many instructions does a 10-word block take?', answer: 280, tol: 0, unit: 'instructions',
            why: 'Per word: 1 command + 25 checks + 1 read + 1 store = 28 instructions, so 10 words take 280. Of those, 240 are checks that found nothing (24 per word).' },
          { q: 'Which statement about cycle stealing is correct?',
            choices: ['The DMA module uses the bus for one bus cycle, and the processor pauses for that cycle without saving its context.', 'The DMA module interrupts the processor for each word, and the processor saves its context before giving up the bus.', 'The processor must finish its current instruction before the DMA module may use the bus.', 'The processor steals bus cycles from the DMA module, so the transfer never slows the processor down.'], answer: 0,
            feedback: [null, 'No context is saved and no handler runs. If it did, DMA would cost as much as interrupt-driven I/O.', 'That is the rule for interrupts. A DMA module may take the bus in the middle of an instruction, whenever the processor next needs the bus.', 'It is the other way round: the DMA module steals the cycles, so the processor runs somewhat slower during a transfer.'],
            why: 'Cycle stealing is a pause, not an interrupt: one bus cycle is handed to the DMA module, and the processor carries on afterwards as if nothing happened.' },
          { q: 'Programmed I/O and interrupt-driven I/O share two drawbacks. Which pair is it?',
            choices: ['The transfer rate is limited by how fast the processor can test and service the device, and the processor is tied up managing each transfer.', 'The device writes straight into memory behind the processor’s back, and each word needs its own DMA setup.', 'Every word is stored twice in main memory, and they can only read from a device, never write to one.', 'They rely on cycle stealing, so the processor pauses for a bus cycle on every word.'], answer: 0,
            feedback: [null, 'In both techniques the processor itself copies every word; no DMA module is involved.', 'A processor register is not main memory: each word is written to memory once. And both techniques handle output (writes) as well as input.', 'Cycle stealing belongs to DMA, not to these two techniques.'],
            why: 'In both techniques every word travels through a processor register, so the processor both caps the speed and pays instructions for every word.' },
          { type: 'tf', q: 'Because a DMA module steals bus cycles, the processor runs a little slower during a DMA transfer; even so, DMA is far more efficient than the other two techniques for multiple-word transfers.', answer: true,
            why: 'Losing one bus cycle per word is tiny compared with many instructions and an interrupt per word. For a single word, though, DMA’s fixed setup cost can outweigh its benefit.' },
        ],
      },
    ],

    notes: `
      <h3>The problem: who carries the data?</h3>
      <p>A disk read or a network packet is a <b>block</b> of words that must travel between an I/O device and main memory. There are three ways to move it: <b>programmed I/O</b>, <b>interrupt-driven I/O</b> and <b>direct memory access (DMA)</b>. They differ in who moves each word and how much processor time the transfer eats.</p>

      <h3>1. Programmed I/O</h3>
      <p>The processor gives the I/O module a command (for example, read the next word). The module carries it out and, when finished, sets bits in its <b>I/O status register</b> (such as READY). It then does nothing more: <b>no interrupt</b>. The processor must check the status register again and again until the bit shows the operation is complete. This repeated checking is <b>polling</b>; waiting this way is <b>busy waiting</b>, because the processor is fully occupied yet achieves nothing.</p>
      <ol>
        <li>Issue a READ command to the I/O module.</li>
        <li>Read the status register. Not ready? Read it again (loop).</li>
        <li>Ready: read the word from the module’s data register into a processor register.</li>
        <li>Write that register into the next memory cell.</li>
        <li>More words? Go back to step 1.</li>
      </ol>
      <p><b>Cost per word</b> = 1 command + the status checks + 1 read + 1 store. If each word needs 25 checks (the 25th finds it ready), a 10-word block costs 10 × (1 + 25 + 1 + 1) = <b>280 instructions</b>, of which 240 are checks that found nothing, and no other program runs meanwhile.</p>

      <h3>2. Interrupt-driven I/O</h3>
      <p>The processor issues the command and then <b>goes on with other useful work</b>. When the module is ready to exchange a word, it <b>interrupts</b> the processor. The processor finishes its current instruction, saves the <b>context</b> of the running program (program counter, status, registers), and runs the <b>interrupt handler</b>. The handler reads the word from the module, writes it to memory, issues the next command, restores the context and returns; the interrupted program continues where it stopped.</p>
      <p>This beats polling because the waiting time goes to other programs. But <b>every word still passes through the processor</b> and costs a full interrupt. In the guide’s model a word costs 11 instructions (save 4, move 2, next command 1, restore 4), so a 200-word block costs 2,200 instructions and 200 interrupts. Worked example (3 words, device needs 16 time units per word): 3 interrupts and 33 instructions of I/O work, while the other program gets 40 instructions done.</p>

      <h3>The two drawbacks both techniques share</h3>
      <ol>
        <li><b>Speed limit:</b> the I/O transfer rate is limited by how fast the processor can test and service a device. With a very fast device, polling needs at least 3 instructions of service per word and each interrupt needs 11, so the processor, not the device, sets the pace.</li>
        <li><b>Tied-up processor:</b> the processor must execute a number of instructions for every single word transferred.</li>
      </ol>
      <p>Root cause: each word travels through a processor register. Model (device needs D time units per word): polling moves a word every D + 3 units using 100% of the processor; interrupts move one every max(D, 4) + 7 units, 11 of them busy. D = 30: polling reaches 91% of the device’s speed, interrupts 81% while using about 30% of the processor. D = 3: only 50% and 27%, with the processor busy 100% of the time.</p>

      <h3>3. Direct memory access (DMA)</h3>
      <p>A <b>DMA module</b> is hardware that does the processor’s bus work for a transfer: it puts addresses and words on the bus and tells memory to read or write. It may be a separate module on the system bus or built into an I/O module. To start a block transfer, the processor sends it four items:</p>
      <ol>
        <li>whether the operation is a <b>read or a write</b> (on the read/write control line);</li>
        <li>the <b>address of the I/O device</b> involved;</li>
        <li>the <b>starting location in memory</b> to read from or write to (kept in the DMA module’s <b>address register</b>);</li>
        <li>the <b>number of words</b> to transfer (kept in its <b>count register</b>).</li>
      </ol>
      <p>The processor then continues with other work. The DMA module transfers the entire block, one word at a time, directly to or from memory, <b>without the words passing through the processor</b>. After each word the address register goes up by one and the count register goes down by one. When the count reaches zero the module sends <b>one interrupt</b>. The processor is involved only at the <b>beginning</b> (setup) and at the <b>end</b> (the completion interrupt). In the guide’s model that is 4 setup instructions + 10 for the completion interrupt = <b>14 instructions per block</b>, whatever its size: a 200-word block costs 14 instead of 2,200 with interrupts, saving 2,186. For a single word, though, 14 is more than one interrupt’s 11, so DMA pays off for <b>multiple-word</b> transfers.</p>

      <h3>Cycle stealing</h3>
      <p>The DMA module needs the system bus for every word, and the processor uses the same bus. Rather than waiting for a cycle the processor leaves free, the module usually takes the bus for <b>one bus cycle</b> whenever it has a word; if the processor wants the bus in that cycle, it must <b>pause</b> for that one cycle. This is <b>cycle stealing</b>. It is <b>not an interrupt</b>: no context is saved and no handler runs; the processor simply waits, then carries on. So it can happen in the middle of an instruction, wherever the processor needs the bus (fetching an instruction or operand, writing a result), whereas an interrupt is only recognised at the end of an instruction. If the processor does not need the bus in that cycle (decoding, executing internally), the steal costs nothing.</p>
      <p>Effect: the processor runs somewhat slower during a DMA transfer. Example (instructions of 3 to 5 stages, about half the cycles using the bus): a DMA word every 4 cycles gives 250 steals in 1,000 cycles; 143 cause a pause (14.3% of cycles lost, 213 instructions finished, where 248 would finish with no DMA at all) and 107 cost nothing. Still, at most one lost cycle per word is far cheaper than many instructions and an interrupt per word, so for multiple-word transfers DMA is far more efficient than the other two techniques.</p>

      <h3>Comparison</h3>
      <table>
        <tr><th>Technique</th><th>Who moves each word</th><th>How the processor learns it is done</th><th>Interrupts for N words</th><th>Processor cost</th></tr>
        <tr><td>Programmed I/O</td><td>Processor</td><td>Polls the status register</td><td>0</td><td>All its time (busy waiting)</td></tr>
        <tr><td>Interrupt-driven I/O</td><td>Processor (handler)</td><td>Interrupt per word</td><td>N</td><td>Save + move + restore per word</td></tr>
        <tr><td>DMA</td><td>DMA module</td><td>One interrupt per block</td><td>1</td><td>Setup + one interrupt + stolen cycles</td></tr>
      </table>
      <p>Race, 8 words, slow device (30 units per word): processor time on the transfer is 264 (polling), 88 (interrupts), 14 (DMA, plus 8 stolen cycles); the other program gets 0, 212 and 233 units done. Fast device (3 per word): the device could deliver all 8 by t = 24, but polling ends at t = 48 and interrupts at t = 91 (the processor is the bottleneck); DMA keeps pace and ends at t = 39.</p>

      <h4>Common mistakes</h4>
      <ul>
        <li>Thinking the I/O module signals the processor in programmed I/O. It only sets status bits; the processor must look.</li>
        <li>Thinking interrupts keep the data out of the processor. They remove the waiting, not the carrying.</li>
        <li>Thinking DMA interrupts once per word. It interrupts once per block.</li>
        <li>Calling cycle stealing an interrupt. It is a one-cycle pause; nothing is saved.</li>
      </ul>`,
  });
})();
