/* =====================================================================
   12.6 Record Blocking
   Original teaching material. Helpers shared by several steps (the packing
   algorithm and the block drawing) live inside this IIFE (no globals).
   ===================================================================== */
(function () {
  const LET = 'ABCDEFGHIJ';                                     // record names
  const HUES = ['cpu', 'io', 'mem', 'os', 'thread', 'proc', 'accent'];
  const hue = (i) => HUES[i % HUES.length];                     // colour of record i
  const n0 = (v) => Number(v).toLocaleString('en-US');          // 1234 -> "1,234"
  const pct = (a, b, d = 1) => (b ? (Math.round((10 ** (d + 2) * a) / b) / 10 ** d).toLocaleString('en-US') : '0') + '%';
  const listNames = (ids) => ids.map((i) => LET[i]).join(', ');
  let uid = 0;                                                  // makes pattern ids unique per drawing

  /* Packs record sizes into blocks of B bytes with one of the three methods.
     fixed:     every record padded to the longest one (the slot); floor(B / slot) per block.
     unspanned: records kept whole; a record that does not fit starts a new block.
     spanned:   bytes packed end to end; a record that reaches the end of a block continues in the next.
     waste = unusable gaps; pad = padding inside fixed slots; free = room still usable in the last block. */
  function pack(sizes, B, method) {
    const out = { method, B, ok: true, blocks: [], split: [], maxParts: 1, pad: 0, waste: 0, free: 0, data: 0, slot: 0, bf: 0, tail: 0, err: '', big: -1 };
    out.data = sizes.reduce((a, b) => a + b, 0);
    const nb = () => { const b = { segs: [], used: 0 }; out.blocks.push(b); return b; };
    if (!sizes.length) { out.lost = 0; out.alloc = 0; return out; }
    if (method === 'fixed') {
      const slot = Math.max(...sizes); out.slot = slot;
      if (slot > B) { out.ok = false; out.err = 'slot'; out.big = sizes.indexOf(slot); return out; }
      out.bf = Math.floor(B / slot); out.tail = B - out.bf * slot;
      let b = null;
      sizes.forEach((sz, i) => {
        if (i % out.bf === 0) b = nb();
        b.segs.push({ r: i, len: sz, kind: 'data' });
        if (slot > sz) b.segs.push({ r: i, len: slot - sz, kind: 'pad' });
        b.used += slot; out.pad += slot - sz;
      });
      out.waste = out.tail * out.blocks.length;
      out.free = (out.bf - (sizes.length - (out.blocks.length - 1) * out.bf)) * slot;
    } else {
      if (method === 'unspanned') {
        const big = sizes.findIndex((sz) => sz > B);
        if (big >= 0) { out.ok = false; out.err = 'big'; out.big = big; return out; }
      }
      let b = nb();
      sizes.forEach((sz, i) => {
        if (method === 'unspanned') {
          if (b.used + sz > B) b = nb();
          b.segs.push({ r: i, len: sz, kind: 'data' }); b.used += sz;
          return;
        }
        let left = sz, part = 0;
        while (left > 0) {
          if (b.used === B) b = nb();
          const take = Math.min(B - b.used, left);
          left -= take;
          b.segs.push({ r: i, len: take, kind: 'data', part, more: left > 0 });
          b.used += take; part++;
        }
        if (part > 1) out.split.push(i);
        out.maxParts = Math.max(out.maxParts, part);
      });
      out.blocks.forEach((bk, k) => { if (k < out.blocks.length - 1) out.waste += B - bk.used; });
      out.free = B - out.blocks[out.blocks.length - 1].used;
    }
    out.lost = out.waste + out.pad;
    out.alloc = out.blocks.length * B;
    return out;
  }

  /* Draws a packing result as a stack of horizontal block bars (block 0 on top).
     o.W: viewBox width; o.rowH / o.gap: bar height and space between bars; o.minRows: empty bars to show;
     o.hi: record index to emphasise; o.fs: label font size. */
  function drawPack(ctx, res, o = {}) {
    const { s } = ctx;
    const W = o.W || 300, rowH = o.rowH || 26, gap = o.gap || 10, top = 3, fs = o.fs || 13;
    const rows = Math.max(res.blocks.length, o.minRows || 1);
    const H = top + rows * (rowH + gap) - gap + 4;
    const x0 = 34, x1 = W - 13, bw = x1 - x0, sc = bw / res.B;
    const id = 's126p' + (++uid);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': o.label || 'Blocks of the file' });
    svg.append(s('defs', {},
      s('pattern', { id: id + 'w', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
        s('rect', { width: 7, height: 7, style: 'fill:var(--bad-bg)' }), s('line', { x1: 1, y1: 0, x2: 1, y2: 7, style: 'stroke:var(--bad);stroke-width:2' })),
      s('pattern', { id: id + 'p', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-45)' },
        s('rect', { width: 7, height: 7, style: 'fill:var(--warn-bg)' }), s('line', { x1: 1, y1: 0, x2: 1, y2: 7, style: 'stroke:var(--warn);stroke-width:1.6' }))));
    const arrows = [];
    for (let k = 0; k < rows; k++) {
      const y = top + k * (rowH + gap), b = res.blocks[k], last = k === res.blocks.length - 1;
      svg.append(s('text', { x: x0 - 15, y: y + rowH / 2 + fs * 0.36, 'font-size': fs, 'text-anchor': 'end', class: 's-sub' }, String(k)));
      svg.append(s('rect', { x: x0, y, width: bw, height: rowH, rx: 3, style: 'fill:var(--panel)' }));
      if (!b) {
        svg.append(s('rect', { x: x0, y, width: bw, height: rowH, rx: 3, fill: 'none', style: 'stroke:var(--line-2)', 'stroke-dasharray': '4 3' }));
        continue;
      }
      let x = x0;
      b.segs.forEach((g) => {
        const w = g.len * sc;
        if (g.kind === 'pad') {
          svg.append(s('rect', { x, y: y + 1, width: w, height: rowH - 2, style: `fill:url(#${id}p)` }));
        } else {
          const em = o.hi === g.r;
          svg.append(s('rect', { x, y: y + 1, width: w, height: rowH - 2, class: 's-' + hue(g.r), 'stroke-width': em ? 3 : 1.3 }));
          const piece = (g.part ? '…' : '') + LET[g.r] + (g.more ? '…' : '');
          let lab = w >= piece.length * fs * 0.62 + 2 ? piece : '';
          if (lab && w >= piece.length * fs * 0.62 + fs * 2.6 && rowH >= 20) lab += ' ' + g.len;
          if (lab) svg.append(s('text', { x: x + w / 2, y: y + rowH / 2 + fs * 0.36, 'font-size': fs, 'font-weight': 700, 'text-anchor': 'middle' }, lab));
        }
        x += w;
        if (g.more) arrows.push([k, x]);
      });
      if (res.method === 'fixed') {
        const freeSlots = last ? Math.round(res.free / res.slot) : 0;
        for (let f = 0; f < freeSlots; f++) {
          svg.append(s('rect', { x: x + 1, y: y + 2, width: res.slot * sc - 2, height: rowH - 4, rx: 2, fill: 'none', style: 'stroke:var(--line-2)', 'stroke-dasharray': '4 3' }));
          x += res.slot * sc;
        }
        if (res.tail) svg.append(s('rect', { x, y: y + 1, width: res.tail * sc, height: rowH - 2, style: `fill:url(#${id}w)` }));
      } else if (b.used < res.B && !last) {
        svg.append(s('rect', { x, y: y + 1, width: (res.B - b.used) * sc, height: rowH - 2, style: `fill:url(#${id}w)` }));
      } else if (b.used < res.B && (res.B - b.used) * sc > 34 && rowH >= 18) {
        svg.append(s('text', { x: (x + x1) / 2, y: y + rowH / 2 + fs * 0.36, 'font-size': fs, 'text-anchor': 'middle', class: 's-sub' }, 'free'));
      }
      svg.append(s('rect', { x: x0, y, width: bw, height: rowH, rx: 3, fill: 'none', style: 'stroke:var(--ink-2)', 'stroke-width': 1.4 }));
    }
    // continuation pointers: from the end of block k, round the gap, into the start of block k+1
    arrows.forEach(([k, xe]) => {
      const y = top + k * (rowH + gap), ym = y + rowH / 2, yg = y + rowH + gap / 2, yn = ym + rowH + gap;
      svg.append(s('path', { d: `M${xe} ${ym} H${x1 + 7} V${yg} H${x0 - 8} V${yn} H${x0 + 1}`, fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 1.8, 'marker-end': 'url(#arr-accent)' }));
    });
    return svg;
  }

  /* A small key for the block drawings. */
  function legend(ctx, items) {
    const { h } = ctx;
    const sw = {
      gap: '<i class="sw w"></i>wasted gap',
      pad: '<i class="sw p"></i>padding',
      free: '<i class="sw f"></i>free end of last block',
      ptr: '<b style="color:var(--accent)">↩</b> continues in next block',
    };
    return h('div', { class: 'lgd', html: items.map((k) => `<span>${sw[k]}</span>`).join('') });
  }

  Guide.section({
    id: '12.6',
    title: 'Record Blocking',
    short: 'Record blocking',
    summary: 'Programs read records but disks move blocks: three ways to pack records into blocks, and what each one costs.',
    objectives: [
      'Explain why records must be packed into blocks, and weigh fixed against variable block sizes and large against small blocks.',
      'Compute the blocking factor, the unused bytes per block and the number of blocks a file of fixed-length records needs.',
      'Describe fixed blocking, variable-length spanned blocking and variable-length unspanned blocking, with the strengths and costs of each.',
      'Pack a list of variable-length records under each method and count the blocks used, the bytes wasted and the records split across blocks.',
    ],
    terms: [
      ['Record', 'The logical unit a program reads or writes, such as one customer or one order. Programs ask for records; the hardware never sees them.'],
      ['Block (physical record)', 'The unit of I/O between main memory and secondary storage: a run of bytes, usually of one fixed size, that is always read or written as a whole.'],
      ['Record blocking', 'Packing a file\'s records into blocks before they are written, and unpacking them again after a block is read.'],
      ['Blocking factor', 'The number of fixed-length records that fit in one block: ⌊B / R⌋ for block size B and record size R, rounded down because a record cannot be cut.'],
      ['Fixed-length record', 'A record whose length is the same for every record of the file, so the position of record k can be computed directly.'],
      ['Variable-length record', 'A record whose length differs from record to record, for example because a text field is long in one record and short in another.'],
      ['Fixed blocking', 'Record blocking for fixed-length records: each block holds the same whole number of records, and any bytes left at the end of each block go unused.'],
      ['Variable-length spanned blocking', 'Record blocking that packs variable-length records end to end with no gaps; a record that reaches the end of a block continues in the next block.'],
      ['Variable-length unspanned blocking', 'Record blocking that never splits a record: when the next record does not fit in the space left, that space is abandoned and the record starts a new block.'],
      ['Spanned record', 'A record that is split across two (or more) blocks, so reading it on its own takes one block read per piece.'],
      ['Continuation pointer', 'A pointer stored with a block whose last record is incomplete, naming the block that holds the rest of that record.'],
      ['Internal fragmentation', 'Space wasted inside an allocated unit because what it holds does not fill it. In fixed blocking it is the tail of each block that is too short for another record.'],
      ['Padding', 'Filler bytes added to a shorter record so that it occupies the full fixed record length.'],
      ['Sequential processing', 'Reading or writing the records of a file one after another in their stored order, as a payroll run or a backup does.'],
      ['Random access', 'Reading single records in an unpredictable order, such as looking up one customer, without needing the records stored around it.'],
    ],
    css: `
      .sec-12-6 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 8px 13px; font-size: 15px; line-height: 1.45; }
      .sec-12-6 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-6 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-6 .grid-2 > *, .sec-12-6 .grid-3 > *, .sec-12-6 .mw0 > * { min-width: 0; }
      .sec-12-6 .lgd { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: var(--ink-2); align-items: center; }
      .sec-12-6 .lgd span { display: inline-flex; align-items: center; gap: 5px; }
      .sec-12-6 .sw { display: inline-block; width: 18px; height: 12px; border-radius: 2px; border: 1px solid var(--line-2); }
      .sec-12-6 .sw.w { background: repeating-linear-gradient(45deg, var(--bad) 0 2px, var(--bad-bg) 2px 6px); border-color: var(--bad); }
      .sec-12-6 .sw.p { background: repeating-linear-gradient(-45deg, var(--warn) 0 2px, var(--warn-bg) 2px 6px); border-color: var(--warn); }
      .sec-12-6 .sw.f { background: var(--panel); border: 1.5px dashed var(--line-2); }
      .sec-12-6 ol.qs { padding-left: 22px; display: flex; flex-direction: column; gap: 3px; }
      .sec-12-6 .disk { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .sec-12-6 .dblk { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) 10px; gap: 2px; border: 2px solid var(--io); background: var(--io-bg); border-radius: 8px; padding: 3px; position: relative; padding-top: 19px; }
      .sec-12-6 .dblk.mem { border-color: var(--mem); background: var(--mem-bg); width: 62%; }
      .sec-12-6 .dblk.cur { box-shadow: 0 0 0 3px var(--hl); }
      .sec-12-6 .dblk .bl { position: absolute; top: 2px; left: 7px; font-size: 12.5px; font-weight: 700; color: var(--ink-2); }
      .sec-12-6 .dcell { font: 700 13px var(--mono); text-align: center; padding: 4px 0; background: var(--panel); border-radius: 4px; border: 1px solid var(--line); }
      .sec-12-6 .dcell.e { color: var(--muted); border-style: dashed; }
      .sec-12-6 .dcell.inb { border-color: var(--mem); }
      .sec-12-6 .dcell.want { outline: 3px solid var(--proc); outline-offset: -1px; background: var(--proc-bg); }
      .sec-12-6 .dtail { border-radius: 3px; background: repeating-linear-gradient(45deg, var(--bad) 0 2px, var(--bad-bg) 2px 5px); }
      .sec-12-6 .prog { font-size: 15px; min-height: 22px; }
      .sec-12-6 .fbox { font: 800 22px var(--mono); background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 8px 14px; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
      .sec-12-6 .fbox .small { font-family: var(--font); font-weight: 400; }
      .sec-12-6 .res { display: flex; flex-direction: column; gap: 4px; font-size: 15px; }
      .sec-12-6 .res .mono { font-size: 15px; }
      .sec-12-6 .tiles { gap: 8px; }
      .sec-12-6 .tile { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 6px 9px; display: flex; flex-direction: column; gap: 2px; }
      .sec-12-6 .tile .tv { font-size: 24px; font-weight: 900; line-height: 1.1; font-variant-numeric: tabular-nums; }
      .sec-12-6 .tile .xs { line-height: 1.3; }
      .sec-12-6 .rchip { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; font: 700 14px var(--mono); border: 2px solid var(--c); background: var(--cb); }
      .sec-12-6 .rchip.done { opacity: .45; }
      .sec-12-6 .rchip.now { opacity: 1; box-shadow: 0 0 0 3px var(--hl); }
      .sec-12-6 .pane2 { display: flex; flex-direction: column; gap: 3px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 6px 8px; }
      .sec-12-6 .mcard { flex-shrink: 0; }
      .sec-12-6 .mcard .chip { padding: 0 7px; }
      .sec-12-6 .prow { display: flex; flex-direction: column; gap: 3px; }
      .sec-12-6 .lab5a .rchip { font-size: 13.5px; padding: 1px 7px; }
      .sec-12-6 .prow .seg button { min-width: 38px; }
      .sec-12-6 .expl { font-size: 13.5px; line-height: 1.35; }
      .sec-12-6 .lab6 { display: grid; gap: 12px; height: 100%; }
      .sec-12-6 .lab6 > * { min-width: 0; }
      .sec-12-6 .col6 { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 8px 9px; }
      .sec-12-6 .cbody { min-height: 60px; }
      .sec-12-6 .fail { background: var(--bad-bg); border: 1px solid var(--bad); border-radius: 8px; padding: 8px 10px; font-size: 14px; line-height: 1.4; margin: 4px 0; }
      .sec-12-6 table.st6 td { padding: 2px 6px; font-size: 14px; }
      .sec-12-6 table.st6 td:first-child { white-space: nowrap; width: 50%; }
      .sec-12-6 .rchip.pick { cursor: pointer; }
      .sec-12-6 table.rc7 th, .sec-12-6 table.rc7 td { font-size: 14.5px; padding: 5px 9px; vertical-align: top; line-height: 1.35; }
      .sec-12-6 table.rc7 td:first-child { font-weight: 700; white-space: nowrap; }
      .sec-12-6 .rc7cards .flip-face.front { font-size: 17px; }
      .sec-12-6 .rc7cards .flip-face.back { font-size: 14.5px; line-height: 1.4; }
      .sec-12-6 .chart { display: flex; flex-direction: column; gap: 2px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 6px 8px 2px; }
    `,
    steps: [
      /* ---------------- 1. Big picture: records in, blocks out ---------------- */
      {
        title: 'Programs want records, disks move blocks',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">A program thinks in <span class="t">records</span>: one customer, one order, one sensor reading. A disk thinks in <span class="t" data-t="block">blocks</span>.</p>
              <p class="m0">A record is the <b>logical unit of access</b>, the piece of data a program asks for. A block is the <b>unit of I/O</b>, the chunk (usually of one fixed size) that moves between secondary storage and main memory in a single operation. The two sizes rarely match, so before records are written they must be packed into blocks, and after a block is read they must be unpacked. That job is <span class="t">record blocking</span>.</p>
              <div class="callout analogy m0" data-label="Analogy">A warehouse that only ships full pallets. Order one tin of paint and a whole pallet arrives. If you wanted the neighbouring tins next, one delivery served many orders; if not, the truck hauled a lot you never used.</div>
              <p class="m0"><b>Three design questions</b> run through this section:</p>
              <ol class="m0 qs">
                <li>Should every block be the same size?</li>
                <li>How big should a block be?</li>
                <li>How are records laid out inside blocks: <b>fixed blocking</b>, <b>variable-length spanned</b> or <b>variable-length unspanned</b> blocking?</li>
              </ol>
            </div>
            <div class="card stack lab1" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const N = 12, BF = 4, R = 120, B = 512;
          const lab = ctx.$('.lab1');
          let st, rng;
          function fresh() { st = { buf: -1, last: -1, asked: 0, ios: 0, want: -1, msg: 'Press <b>Read next record</b> a few times, then try <b>Read a random record</b>. Watch the block reads.', cls: '' }; rng = ctx.util.seeded(1206); }
          fresh();
          const disk = h('div', { class: 'disk', style: { gridTemplateColumns: ctx.narrow ? 'minmax(0, 1fr)' : null } });
          const buf = h('div', { class: 'dblk mem', style: { width: ctx.narrow ? '100%' : null } });
          const prog = h('div', { class: 'prog' });
          const cnt = h('div', { class: 'row gap-s' });
          const narr = h('div', { class: 'narr', 'aria-live': 'polite' });
          const read = (k, rand) => {
            const blk = Math.floor(k / BF), slot = k % BF;
            st.asked++; st.want = k; st.cls = '';
            const where = `<span class="mono">R${k}</span> is in block ⌊${k} / ${BF}⌋ = ${blk}, slot ${k} mod ${BF} = ${slot}.`;
            if (st.buf === blk) {
              st.cls = 'ok';
              st.msg = `${where} That block is <b>already in the buffer</b>, so no I/O happens: the record is copied straight out of main memory.`;
            } else {
              const prev = st.buf;
              st.buf = blk; st.ios++;
              st.msg = `${where} The OS reads the <b>whole block</b> (${BF} records, ${B} bytes) into the buffer: one I/O${prev >= 0 ? `, replacing block ${prev}` : ''}.` +
                (rand ? ` The program asked for just one of the ${BF} records it carried.` : '');
            }
            if (st.asked === N && st.ios === N / BF) st.msg += ` All ${N} records in order cost only ${N / BF} block reads: each I/O carried ${BF} records the program really wanted.`;
            draw();
          };
          const bNext = h('button', { class: 'btn primary', type: 'button', onclick: () => { st.last = (st.last + 1) % N; read(st.last); } }, 'Read next record');
          const bRand = h('button', { class: 'btn', type: 'button', onclick: () => { let k; do { k = Math.floor(rng() * N); } while (k === st.want); st.last = k; read(k, true); } }, 'Read a random record');
          const bReset = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { fresh(); draw(); } }, 'Reset');
          lab.append(
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, `Try it: ${N} records of ${R} bytes`), bReset),
            h('div', { class: 'small muted', html: `${BF} records fit in each ${B}-byte block (${BF} × ${R} = ${BF * R} bytes); the last ${B - BF * R} bytes of every block stay empty.` }),
            h('div', { class: 'xs b', style: { color: 'var(--io)' } }, 'ON THE DISK'),
            disk,
            h('div', { class: 'xs b', style: { color: 'var(--mem)' } }, 'BUFFER IN MAIN MEMORY (holds one block)'),
            buf, prog,
            h('div', { class: 'row gap-s' }, bNext, bRand),
            cnt, narr);
          const cell = (k, inBuf) => h('div', { class: 'dcell' + (k === st.want ? ' want' : '') + (inBuf ? ' inb' : '') }, 'R' + k);
          function draw() {
            disk.replaceChildren(...ctx.util.range(N / BF).map((b) => h('div', { class: 'dblk io' + (b === st.buf ? ' cur' : '') },
              h('div', { class: 'bl' }, 'block ' + b),
              ...ctx.util.range(BF).map((j) => cell(b * BF + j, false)), h('div', { class: 'dtail', title: (B - BF * R) + ' unused bytes' }))));
            buf.replaceChildren(h('div', { class: 'bl' }, st.buf < 0 ? 'empty' : 'block ' + st.buf),
              ...ctx.util.range(BF).map((j) => (st.buf < 0 ? h('div', { class: 'dcell e' }, '·') : cell(st.buf * BF + j, true))), h('div', { class: 'dtail' }));
            prog.innerHTML = st.want < 0 ? '<span class="muted">The program has not asked for anything yet.</span>' : `Program received <b class="mono" style="color:var(--proc)">R${st.want}</b> (${R} bytes) from the buffer.`;
            cnt.replaceChildren(
              h('span', { class: 'chip proc' }, `records asked for: ${st.asked}`),
              h('span', { class: 'chip io' }, `block reads (I/Os): ${st.ios}`),
              h('span', { class: 'chip' }, `records moved from disk: ${st.ios * BF}`));
            narr.className = 'narr' + (st.cls ? ' ' + st.cls : '');
            narr.innerHTML = st.msg;
          }
          draw();
        },
      },
      /* ---------------- 2. Fixed blocking and the blocking factor ---------------- */
      {
        title: 'Fixed blocking and the blocking factor',
        kind: 'learn',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0"><span class="t">Fixed blocking</span> is the simplest layout: every record has the same length, and each block holds the same whole number of records.</p>
              <p class="m0">That number is the <span class="t">blocking factor</span>. A record cannot be cut in two, so the division rounds <b>down</b>:</p>
              <div class="fbox">bfr = ⌊ B / R ⌋ <span class="small muted">B = block size, R = record size, both in bytes</span></div>
              <p class="m0">The leftover <b>B − bfr × R</b> bytes at the end of every block are too short for another record and stay unused. That waste is <span class="t">internal fragmentation</span>.</p>
              <p class="m0">Fixed blocking is the usual layout for sequential files of <span class="t" data-t="fixed-length record">fixed-length records</span>. Finding record k is pure arithmetic: block ⌊k / bfr⌋, slot k mod bfr.</p>
              <div class="callout warn m0" data-label="Common mistake">Rounding up. ⌈512 / 120⌉ = 5 records would need 600 bytes, more than the 512-byte block holds.</div>
            </div>
            <div class="card stack lab2" style="gap:9px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const NREC = 1000, SIZES = [256, 512, 1024, 2048, 4096];
          let R = 120, B = 512, K = 742;
          const lab = ctx.$('.lab2');
          const W = ctx.narrow ? 340 : 640;
          const svg = s('svg', { viewBox: `0 0 ${W} 96`, width: '100%', role: 'img', 'aria-label': 'One block filled with fixed-length records' });
          const out = h('div', { class: 'res' });
          const narr = h('div', { class: 'narr', 'aria-live': 'polite' });
          const slR = ctx.ui.slider({ label: 'Record size R', min: 40, max: 600, step: 10, value: R, format: (v) => v + ' bytes', onInput: (v) => { R = v; draw(); } });
          const segB = ctx.ui.seg(SIZES.map((v) => ({ value: v, label: n0(v) })), B, (v) => { B = v; draw(); });
          const slK = ctx.ui.slider({ label: 'Find record k', min: 0, max: NREC - 1, step: 1, value: K, format: (v) => 'k = ' + v, onInput: (v) => { K = v; draw(); } });
          const find = h('div', { class: 'res' });
          const bEx = h('button', { class: 'btn sm', type: 'button', onclick: () => { R = 120; B = 512; slR.set(R); segB.set(B); draw(); } }, 'Worked example: 512 and 120');
          lab.append(
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Try it: pack one block'), bEx),
            slR,
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Block size B (bytes):'), segB),
            svg, out, narr, slK, find);
          function draw() {
            const bf = Math.floor(B / R), used = bf * R, tail = B - used, slot = bf ? K % bf : -1;
            const X0 = 10, X1 = W - 10, sc = (X1 - X0) / B, y = 26, bh = 40;
            const kids = [s('rect', { x: X0, y, width: X1 - X0, height: bh, rx: 4, style: 'fill:var(--panel)' })];
            for (let k = 0; k < bf; k++) {
              const x = X0 + k * R * sc, w = R * sc;
              kids.push(s('rect', { x, y: y + 1, width: w, height: bh - 2, class: 's-' + hue(k % 2 ? 4 : 2), 'stroke-width': k === slot ? 3.5 : bf > 60 ? 0.6 : 1.3 }));
              const lab = w >= 62 ? 'slot ' + k : w >= 20 && k < 100 ? String(k) : '';
              if (lab) kids.push(s('text', { x: x + w / 2, y: y + bh / 2 + 5, 'font-size': 14, 'font-weight': 700, 'text-anchor': 'middle' }, lab));
            }
            if (tail) {
              kids.push(s('rect', { x: X0 + used * sc, y: y + 1, width: tail * sc, height: bh - 2, style: 'fill:var(--bad-bg);stroke:var(--bad)', 'stroke-width': 1.3 }));
              kids.push(s('text', { x: X1, y: y + bh + 20, 'font-size': 14, 'text-anchor': 'end', style: 'fill:var(--bad)', 'font-weight': 700 }, (bf ? '' : 'all ') + n0(tail) + ' B unused'));
            }
            kids.push(s('rect', { x: X0, y, width: X1 - X0, height: bh, rx: 4, fill: 'none', style: 'stroke:var(--ink-2)', 'stroke-width': 1.5 }));
            kids.push(s('text', { x: X0, y: 16, 'font-size': 13, class: 's-sub' }, 'byte 0'));
            kids.push(s('text', { x: X1, y: 16, 'font-size': 13, class: 's-sub', 'text-anchor': 'end' }, n0(B)));
            if (bf && tail && used * sc > 80 && tail * sc >= 46) kids.push(s('text', { x: X0 + used * sc - 2, y: 16, 'font-size': 13, class: 's-sub', 'text-anchor': 'end' }, n0(used)));
            if (bf) kids.push(s('text', { x: X0, y: y + bh + 20, 'font-size': 14, 'font-weight': 700, style: 'fill:var(--ink-2)' }, `${bf} record${bf === 1 ? '' : 's'} × ${R} B = ${n0(used)} B`));
            svg.replaceChildren(...kids);
            const q = B / R;
            find.innerHTML = bf ? `<div>Record ${K} sits in block ⌊${K} / ${bf}⌋ = <b>${Math.floor(K / bf)}</b>, slot ${K} mod ${bf} = <b>${slot}</b> (outlined above), bytes ${n0(slot * R)}–${n0(slot * R + R - 1)} of that block.</div>` : '<div class="muted">With no record per block there is nowhere to find record k.</div>';
            if (!bf) {
              out.innerHTML = `<div class="mono">bfr = ⌊${n0(B)} / ${R}⌋ = ⌊${ctx.util.fmt(q, 2)}⌋ = <b>0</b></div>`;
              narr.className = 'narr bad';
              narr.innerHTML = `A ${R}-byte record is longer than a ${n0(B)}-byte block, so not even one fits: fixed blocking cannot store this file. Choose bigger blocks, or use a method that lets a record continue into the next block (coming up).`;
              return;
            }
            const nb = Math.ceil(NREC / bf);
            out.innerHTML = `<div class="mono">bfr = ⌊${n0(B)} / ${R}⌋ = ⌊${ctx.util.fmt(q, 2)}⌋ = <b>${bf}</b> records per block</div>` +
              `<div class="mono">unused = ${n0(B)} − ${bf} × ${R} = <b>${n0(tail)}</b> bytes per block (${pct(tail, B, 2)})</div>`;
            narr.className = 'narr';
            narr.innerHTML = `A file of ${n0(NREC)} such records needs ⌈${n0(NREC)} / ${bf}⌉ = <b>${n0(nb)} blocks</b>: ${n0(nb * B)} bytes on the disk for ${n0(NREC * R)} bytes of records.` +
              (tail === 0 ? ' Here R divides B exactly, so nothing is wasted inside the blocks.' : tail * 4 >= B ? ' A quarter or more of every block is wasted: the record size and block size fit together badly.' : '');
          }
          draw();
        },
      },
      /* ---------------- 3. Block size: fixed or variable, large or small ---------------- */
      {
        title: 'How big should a block be?',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Before packing a single record, the designer settles two questions about the blocks themselves.</p>
              <div class="card tight stack" style="gap:4px">
                <b>Fixed or variable block size?</b>
                <span class="small">Most systems pick <b>one fixed size</b>. Every I/O request then moves the same amount, every buffer in main memory is the same size, and blocks are easy to lay out and find on the disk.</span>
              </div>
              <div class="card tight stack" style="gap:4px">
                <b>Large or small blocks?</b>
                <span class="small"><span class="chip ok">+</span> A large block carries more records per I/O, so <span class="t">sequential processing</span> needs far fewer block reads.</span>
                <span class="small"><span class="chip bad">−</span> In <span class="t">random access</span> each lookup still moves a whole block, so most of the bytes moved are records nobody asked for.</span>
                <span class="small"><span class="chip bad">−</span> Large blocks need large <span class="t" data-t="buffer">I/O buffers</span> in main memory, which are harder to manage.</span>
              </div>
              <div class="callout why m0" data-label="Why it matters">The best size depends on how the file is used. Real systems settle in the middle: ext4 on Linux and NTFS on Windows (which calls its blocks clusters) both default to 4 KB on typical disks.</div>
            </div>
            <div class="card stack lab3" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const NREC = 10000, R = 200, SIZES = [512, 1024, 2048, 4096, 8192, 16384, 32768];
          const lbl = (b) => (b < 1024 ? b + ' B' : b / 1024 + ' KB');
          const short = (b) => (b < 1024 ? '0.5K' : b / 1024 + 'K');
          const rows = SIZES.map((b) => { const bf = Math.floor(b / R); return { b, bf, reads: Math.ceil(NREC / bf), extra: bf - 1, tail: b - bf * R }; });
          let cur = 3;
          const lab = ctx.$('.lab3');
          const chartA = h('div', { class: 'chart' }), chartB = h('div', { class: 'chart' });
          const tiles = h('div', { class: 'grid-4 tiles' });
          const narr = h('div', { class: 'narr', 'aria-live': 'polite' });
          const sl = ctx.ui.slider({ label: 'Block size', min: 0, max: SIZES.length - 1, step: 1, value: cur, format: (v) => lbl(SIZES[v]), onInput: (v) => { cur = v; draw(); } });
          lab.append(h('h4', { class: 'm0' }, `Try it: a file of ${n0(NREC)} records of ${R} bytes`), sl, h('div', { class: 'grid-2', style: { gap: '10px' } }, chartA, chartB), tiles, narr);
          function chart(title, key, cls) {
            const W = 290, H = 158, base = 128, top = 22, slot = (W - 8) / rows.length, mx = Math.max(...rows.map((r) => r[key]));
            const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': title });
            rows.forEach((r, i) => {
              const bh = Math.max(2, ((base - top) * r[key]) / mx), x = 4 + i * slot + 5, w = slot - 10, on = i === cur;
              svg.append(s('rect', { x, y: base - bh, width: w, height: bh, rx: 2, class: on ? 's-' + cls : 's-panel', 'stroke-width': on ? 2 : 1 }));
              svg.append(s('text', { x: x + w / 2, y: base - bh - 5, 'font-size': 13, 'text-anchor': 'middle', 'font-weight': on ? 800 : 400, class: on ? null : 's-sub' }, n0(r[key])));
              svg.append(s('text', { x: x + w / 2, y: base + 17, 'font-size': 13, 'text-anchor': 'middle', 'font-weight': on ? 800 : 400, class: on ? null : 's-sub' }, short(r.b)));
            });
            svg.append(s('line', { x1: 2, y1: base, x2: W - 2, y2: base, class: 's-muted' }));
            return [h('div', { class: 'small b' }, title), svg];
          }
          function draw() {
            const r = rows[cur], r0 = rows[0];
            chartA.replaceChildren(...chart('Block reads for one full sequential pass', 'reads', 'ok'));
            chartB.replaceChildren(...chart('Unwanted records per random lookup', 'extra', 'bad'));
            const tile = (big, cap) => h('div', { class: 'tile' }, h('div', { class: 'tv', html: big }), h('div', { class: 'xs muted', html: cap }));
            tiles.replaceChildren(
              tile(String(r.bf), `records per block (${n0(r.tail)}&nbsp;B unused each)`),
              tile(n0(r.reads), 'block reads to read all records in order'),
              tile(pct(R, r.b), `of each lookup's ${n0(r.b)} bytes are the record wanted`),
              tile(lbl(2 * r.b), 'of main memory for two buffers'));
            narr.innerHTML = cur === 0
              ? `With ${lbl(r.b)} blocks a full pass costs the most block reads (${n0(r.reads)}), but a random lookup moves only ${r.extra} record it did not want. Small blocks suit lookups.`
              : `With ${lbl(r.b)} blocks a full pass costs ${n0(r.reads)} block reads, ${ctx.util.fmt(r0.reads / r.reads, 1)}× fewer than with 512-byte blocks. The price: every random lookup drags ${n0(r.extra)} unwanted records (${n0(r.extra * R)} bytes) along, and each buffer grows to ${lbl(r.b)}.`;
          }
          draw();
        },
      },
      /* ---------------- 4. Variable-length records: spanned or unspanned ---------------- */
      {
        title: 'Variable-length records: spanned or unspanned',
        kind: 'compare',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0">Real records often vary in length. Two methods pack <span class="t" data-t="variable-length record">variable-length records</span>.</p>
              <div class="card tight stack mcard" style="gap:3px">
                <b><span class="t">Variable-length spanned blocking</span></b>
                <span class="small">Records are packed end to end, so no space is left unused. A record that reaches the end of a block continues in the next one, and a <span class="t">continuation pointer</span> names that block.</span>
                <span class="small"><span class="chip ok">+</span> Efficient storage, and no limit on record size.</span>
                <span class="small"><span class="chip bad">−</span> Hard to implement. A <span class="t">spanned record</span> needs one I/O per block it touches (two if it crosses one boundary). Growing or shrinking a record shifts every byte after it, so the file is hard to update.</span>
              </div>
              <div class="card tight stack mcard" style="gap:3px">
                <b><span class="t">Variable-length unspanned blocking</span></b>
                <span class="small">Records are never split. If the next record does not fit in the space left, that space is abandoned and the record starts a new block.</span>
                <span class="small"><span class="chip ok">+</span> Every record arrives in one I/O, and the layout is simpler.</span>
                <span class="small"><span class="chip bad">−</span> Wasted space at the end of most blocks, and no record may be longer than a block.</span>
              </div>
              <div class="callout tip m0 small" data-label="In practice">UNIX, Linux and Windows store files as byte streams, so records simply run across block boundaries: spanning in effect.</div>
            </div>
            <div class="card stack lab4" style="gap:7px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const SZ = [220, 180, 270, 250, 180, 310, 210, 100], B = 512, N = SZ.length;
          const lab = ctx.$('.lab4');
          const chips = h('div', { class: 'row gap-s' });
          const panes = ['spanned', 'unspanned'].map((m) => ({ m, svg: h('div'), stat: h('div', { class: 'small' }) }));
          const where = (res) => { const b = res.blocks.length ? res.blocks[res.blocks.length - 1] : null; return { j: b ? res.blocks.length - 1 : 0, left: b ? B - b.used : B }; };
          function say(m, k) {
            const before = where(pack(SZ.slice(0, k), B, m)), after = pack(SZ.slice(0, k + 1), B, m);
            const nm = `<b>${LET[k]}</b> (${SZ[k]} B)`, j = before.j, left = before.left;
            if (m === 'unspanned') {
              if (k > 0 && after.blocks.length > j + 1) return `<b>Unspanned:</b> block ${j} has only ${left} bytes left, too few for ${nm}. Those ${left} bytes are abandoned and ${LET[k]} starts block ${j + 1}.`;
              return `<b>Unspanned:</b> ${nm} fits in the ${left} bytes left in block ${j}.`;
            }
            if (k > 0 && left === 0) return `<b>Spanned:</b> block ${j} is exactly full, so ${nm} starts block ${j + 1}.`;
            if (SZ[k] <= left) return `<b>Spanned:</b> ${nm} fits in the ${left} bytes left in block ${j}.`;
            return `<b>Spanned:</b> block ${j} has ${left} bytes left. The first ${left} bytes of ${LET[k]} go there, the other ${SZ[k] - left} continue in block ${j + 1}, and block ${j} gets a pointer to block ${j + 1}.`;
          }
          lab.append(
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, `Watch: records A–H into ${B}-byte blocks`)),
            chips,
            h('div', { class: 'grid-2', style: { gap: '10px' } }, ...panes.map((p) => h('div', { class: 'pane2' }, h('div', { class: 'small b' }, p.m === 'spanned' ? 'Variable-length spanned' : 'Variable-length unspanned'), p.svg, p.stat))),
            legend(ctx, ['gap', 'free', 'ptr']));
          const player = ctx.ui.player({
            count: N + 2,
            interval: 2200,
            render(i) {
              const k = Math.min(i, N);
              chips.replaceChildren(...SZ.map((sz, r) => h('span', { class: 'rchip' + (r < k ? ' done' : '') + (r === k - 1 && i <= N ? ' now' : ''), style: { '--c': `var(--${hue(r)})`, '--cb': `var(--${hue(r)}-bg)` } }, LET[r] + ' ' + sz)));
              panes.forEach((p) => {
                const res = pack(SZ.slice(0, k), B, p.m);
                p.svg.replaceChildren(drawPack(ctx, res, { W: 300, rowH: 30, gap: 13, minRows: 5, hi: i <= N ? k - 1 : -1, label: p.m + ' blocks' }));
                p.stat.innerHTML = `blocks: <b>${res.blocks.length}</b> · wasted: <b>${n0(res.waste)} B</b>` + (p.m === 'spanned' ? ` · split records: <b>${res.split.length}</b>` : '');
              });
              if (i === 0) return `Eight records of different lengths, ${n0(SZ.reduce((a, b) => a + b, 0))} bytes in all, go into ${B}-byte blocks. Press <b>Next</b> to place them one at a time with both methods.`;
              if (i <= N) return say('spanned', i - 1) + '<br>' + say('unspanned', i - 1);
              const u = pack(SZ, B, 'unspanned'), sp = pack(SZ, B, 'spanned');
              return `<b>Result.</b> Spanned used <b>${sp.blocks.length} blocks</b> with no gaps, but ${listNames(sp.split)} each straddle two blocks, so reading one of them alone takes two block reads. Unspanned kept every record whole but needed <b>${u.blocks.length} blocks</b> and abandoned ${n0(u.waste)} bytes in gaps.`;
            },
          });
          lab.append(player.el);
        },
      },
      /* ---------------- 5. Predict, then reveal ---------------- */
      {
        title: 'Predict: how many blocks will each method need?',
        kind: 'predict',
        html: `
          <div class="split l fill">
            <div class="stack lab5a" style="gap:8px"></div>
            <div class="card stack lab5b" style="gap:7px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const B = 512, N = 7, FIRST = [180, 240, 50, 140, 180, 70, 150];
          const M = [
            { m: 'fixed', name: 'Fixed blocking', note: '(each record padded to the longest one)' },
            { m: 'unspanned', name: 'Variable-length unspanned', note: '' },
            { m: 'spanned', name: 'Variable-length spanned', note: '' },
          ];
          const rng = ctx.util.seeded(612);
          let sizes = FIRST.slice(), guess = [null, null, null], checked = false, round = 1;
          const left = ctx.$('.lab5a'), right = ctx.$('.lab5b');
          const chips = h('div', { class: 'row gap-s' });
          const segs = M.map((x, i) => ctx.ui.seg(ctx.util.range(N).map((v) => ({ value: v + 1, label: String(v + 1) })), null, (v) => { guess[i] = v; checked = false; draw(); }));
          const bCheck = h('button', { class: 'btn primary', type: 'button', onclick: () => { checked = true; draw(); } }, 'Check my predictions');
          const bNew = h('button', { class: 'btn', type: 'button', onclick: () => { sizes = fresh(); guess = [null, null, null]; segs.forEach((g) => g.set(null)); checked = false; round++; draw(); } }, 'New records');
          const score = h('div', { class: 'narr', 'aria-live': 'polite' });
          left.append(
            h('p', { class: 'lead m0', html: `These ${N} records go into <b>${B}-byte blocks</b>. How many blocks does each method need?` }),
            chips,
            ...M.map((x, i) => h('div', { class: 'prow' }, h('div', { class: 'small', html: `<b>${x.name}</b> <span class="muted">${x.note}</span>` }), segs[i])),
            h('div', { class: 'row gap-s' }, bCheck, bNew),
            ctx.ui.reveal('Show a hint', `<div class="small"><b>Fixed:</b> every slot is as long as the longest record L, and ⌊${B} / L⌋ slots fit per block. <b>Unspanned:</b> fill a block until the next record does not fit, then start a new one. <b>Spanned:</b> add up all the bytes and divide by ${B}, rounding up.</div>`),
            score);
          function fresh() {
            for (;;) {
              const cap = [220, 250, 300, 380][Math.floor(rng() * 4)];
              const t = ctx.util.range(N).map(() => 50 + Math.floor(rng() * ((cap - 50) / 10 + 1)) * 10);
              const a = M.map((x) => pack(t, B, x.m).blocks.length);
              if (new Set(a).size >= 2) return t;
            }
          }
          function explain(x, res) {
            if (x.m === 'fixed') return `Longest record ${res.slot} B, so ⌊${B} / ${res.slot}⌋ = ${res.bf} slot${res.bf === 1 ? '' : 's'} per block: ⌈${N} / ${res.bf}⌉ = <b>${res.blocks.length}</b>.`;
            if (x.m === 'unspanned') return res.blocks.map((b) => `{${b.segs.map((g) => LET[g.r]).join(' ')}} ${b.used} B`).join(' · ') + ` → <b>${res.blocks.length}</b>.`;
            return `${n0(res.data)} bytes in all: ⌈${n0(res.data)} / ${B}⌉ = <b>${res.blocks.length}</b>.`;
          }
          function scaleView() {
            const W = ctx.narrow ? 330 : 600, x0 = 30, sc = (W - x0 - 58) / B, rh = 24, g = 7, top = 34;
            const svg = s('svg', { viewBox: `0 0 ${W} ${top + (N + 1) * (rh + g)}`, width: '100%', role: 'img', 'aria-label': 'The records drawn to scale next to one block' });
            svg.append(s('rect', { x: x0, y: 4, width: B * sc, height: rh, rx: 3, class: 's-panel', 'stroke-width': 1.5 }),
              s('text', { x: x0 + (B * sc) / 2, y: 4 + rh / 2 + 5, 'font-size': 14, 'font-weight': 700, 'text-anchor': 'middle' }, `one block = ${B} bytes`));
            sizes.forEach((sz, i) => {
              const y = top + 4 + i * (rh + g);
              svg.append(s('text', { x: x0 - 10, y: y + rh / 2 + 5, 'font-size': 14, 'font-weight': 700, 'text-anchor': 'end' }, LET[i]),
                s('rect', { x: x0, y, width: sz * sc, height: rh, rx: 3, class: 's-' + hue(i), 'stroke-width': 1.3 }),
                s('text', { x: x0 + sz * sc + 8, y: y + rh / 2 + 5, 'font-size': 14, class: 's-sub' }, sz + ' B'));
            });
            return svg;
          }
          function draw() {
            chips.replaceChildren(...sizes.map((sz, r) => h('span', { class: 'rchip', style: { '--c': `var(--${hue(r)})`, '--cb': `var(--${hue(r)}-bg)` } }, LET[r] + ' ' + sz)));
            bCheck.disabled = guess.some((g) => g == null);
            right.innerHTML = '';
            if (!checked) {
              right.append(h('h4', { class: 'm0' }, 'The records, drawn to scale'), scaleView(),
                h('p', { class: 'small muted m0' }, 'Each bar is drawn on the same scale as the block at the top. Pick a number for all three methods to unlock the check.'),
                h('div', { class: 'callout tip small m0', 'data-label': 'Fixed blocking with records that vary', html: `Fixed blocking needs every record to have the same length. To use it on these records, the file takes the <b>longest</b> record's length L as its record length and <span class="t" data-t="padding">pads</span> every shorter record with filler bytes up to L. Each block then holds ⌊${B} / L⌋ slots, and the padding is wasted on top of the unused tail of every block.` }));
              score.className = 'narr';
              score.innerHTML = bCheck.disabled ? `Puzzle ${round}: choose a block count for each of the three methods.` : 'Ready. Press <b>Check my predictions</b>.';
              return;
            }
            const res = M.map((x) => pack(sizes, B, x.m));
            const rows = Math.max(...res.map((r) => r.blocks.length));
            const right3 = res.map((r, i) => r.blocks.length === guess[i]);
            right.append(h('h4', { class: 'm0' }, 'The real packing'),
              h('div', { class: 'grid-3', style: { gap: '8px' } }, ...M.map((x, i) => h('div', { class: 'pane2' },
                h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '4px' } }, h('span', { class: 'small b' }, x.name.replace('Variable-length ', '')), h('span', { class: 'chip ' + (right3[i] ? 'ok' : 'bad') }, (right3[i] ? '✓ ' : '✗ ') + 'you: ' + guess[i])),
                drawPack(ctx, res[i], { W: ctx.narrow ? 330 : 190, rowH: Math.min(38, Math.floor(270 / rows) - 11), gap: 11, minRows: rows, fs: 13, label: x.name + ' packing' }),
                h('div', { class: 'expl', html: explain(x, res[i]) })))),
              legend(ctx, ['pad', 'gap', 'free', 'ptr']));
            const n = right3.filter(Boolean).length;
            score.className = 'narr' + (n === 3 ? ' ok' : '');
            score.innerHTML = n === 3 ? '<b>3 of 3.</b> You can pack records in your head. Try <b>New records</b> for another set.'
              : `<b>${n} of 3 right.</b> Read the working under each drawing, then change a prediction or press <b>New records</b>.`;
          }
          draw();
        },
      },
      /* ---------------- 6. Packing lab: three methods side by side ---------------- */
      {
        title: 'Packing lab: three methods side by side',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const PRESET = {
            mixed: [220, 180, 270, 250, 180, 310, 210, 100],
            similar: [120, 110, 120, 100, 120, 110, 120, 100],
            huge: [150, 600, 120, 200],
          };
          const MAXN = 8, MIN = 20, MAX = 600;
          const M = [
            { m: 'fixed', name: 'Fixed blocking', sub: 'each record padded to the longest' },
            { m: 'unspanned', name: 'Variable unspanned', sub: 'records kept whole' },
            { m: 'spanned', name: 'Variable spanned', sub: 'records may cross blocks' },
          ];
          const rng = ctx.util.seeded(1260);
          let sizes = PRESET.mixed.slice(), B = 512, sel = 0;
          const chips = h('div', { class: 'row gap-s' });
          const sl = ctx.ui.slider({ label: 'Size', min: MIN, max: MAX, step: 10, value: sizes[sel], format: (v) => v + ' B', onInput: (v) => { sizes[sel] = v; draw(); } });
          const bAdd = h('button', { class: 'btn sm', type: 'button', onclick: () => { if (sizes.length < MAXN) { sizes.push(150); sel = sizes.length - 1; draw(); } } }, '+ Add record');
          const bDel = h('button', { class: 'btn sm', type: 'button', onclick: () => { if (sizes.length > 1) { sizes.splice(sel, 1); sel = Math.min(sel, sizes.length - 1); draw(); } } }, 'Remove');
          const segB = ctx.ui.seg([512, 1024, 2048].map((v) => ({ value: v, label: n0(v) })), B, (v) => { B = v; draw(); });
          const preset = (key, label) => h('button', { class: 'btn sm', type: 'button', onclick: () => {
            sizes = key === 'random' ? ctx.util.range(6 + Math.floor(rng() * 3)).map(() => 40 + Math.floor(rng() * 37) * 10) : PRESET[key].slice();
            sel = 0; draw();
          } }, label);
          const cols = M.map((x) => ({ x, body: h('div', { class: 'cbody' }), stats: h('table', { class: 'tbl compact st6' }) }));
          const narr = h('div', { class: 'narr', 'aria-live': 'polite' });
          const side = h('div', { class: 'stack side6', style: { gap: '8px' } },
            h('h4', { class: 'm0' }, 'Records (click one to edit)'),
            chips, sl,
            h('div', { class: 'row gap-s' }, bAdd, bDel),
            h('div', { class: 'small b' }, 'Block size B (bytes)'), segB,
            h('div', { class: 'small b' }, 'Start from'),
            h('div', { class: 'grid-2', style: { gap: '6px' } }, preset('mixed', 'Mixed sizes'), preset('similar', 'Similar sizes'), preset('huge', 'One huge record'), preset('random', 'Random')),
            legend(ctx, ['gap', 'pad', 'free', 'ptr']));
          const main = h('div', { class: 'stack', style: { gap: '8px', minWidth: 0 } },
            h('div', { class: 'grid-3', style: { gap: '8px' } }, ...cols.map((c) => h('div', { class: 'card tight col6' },
              h('div', { class: 'b' }, c.x.name), h('div', { class: 'xs muted', style: { marginTop: '-3px' } }, c.x.sub), c.body, c.stats))),
            narr);
          el.append(h('div', { class: 'lab6', style: { gridTemplateColumns: ctx.narrow ? 'minmax(0, 1fr)' : '280px minmax(0, 1fr)' } }, side, main));
          function draw() {
            chips.replaceChildren(...sizes.map((sz, r) => h('button', { type: 'button', class: 'rchip pick' + (r === sel ? ' now' : ''), style: { '--c': `var(--${hue(r)})`, '--cb': `var(--${hue(r)}-bg)` }, 'aria-pressed': r === sel ? 'true' : 'false', onclick: () => { sel = r; draw(); } }, LET[r] + ' ' + sz)));
            sl.querySelector('label').textContent = 'Size of ' + LET[sel];
            sl.set(sizes[sel]);
            bAdd.disabled = sizes.length >= MAXN; bDel.disabled = sizes.length <= 1;
            bDel.textContent = 'Remove ' + LET[sel];
            const res = M.map((x) => pack(sizes, B, x.m));
            const rows = Math.max(ctx.narrow ? 4 : 8, ...res.map((r) => r.blocks.length));
            const gap = rows > 8 ? 7 : 10, rowH = Math.max(14, Math.min(30, Math.floor((ctx.narrow ? 300 : 262) / rows) - gap));
            cols.forEach((c, i) => {
              const r = res[i];
              c.body.replaceChildren(r.ok ? drawPack(ctx, r, { W: 260, rowH, gap, minRows: rows, fs: 13, label: c.x.name + ' packing' })
                : h('div', { class: 'fail', html: r.err === 'slot'
                  ? `<b>Cannot store this file.</b> Every record would be padded to ${r.slot} bytes, but a ${n0(B)}-byte block cannot hold even one such slot.`
                  : `<b>Cannot store this file.</b> Record ${LET[r.big]} (${sizes[r.big]} B) is longer than a ${n0(B)}-byte block, and an unspanned record must fit inside one block.` }));
              const cell = (v) => (r.ok ? v : '—');
              c.stats.innerHTML = `<tr><td>Blocks used</td><td class="b">${cell(r.blocks.length)}</td></tr>` +
                `<tr><td>Wasted bytes</td><td class="b">${cell(n0(r.lost) + ' <span class="muted">(' + pct(r.lost, r.alloc) + ')</span>')}</td></tr>` +
                `<tr><td>Split records</td><td class="b">${cell(r.split.length ? r.split.length + (r.split.length <= 4 ? ' <span class="muted">(' + listNames(r.split) + ')</span>' : '') : '0')}</td></tr>` +
                `<tr><td>Largest record</td><td class="b">${maxRec(c.x.m)}</td></tr>`;
            });
            narr.className = 'narr';
            narr.innerHTML = verdict(res);
          }
          const maxRec = (m) => (m === 'spanned' ? 'no limit' : '≤ ' + n0(B) + ' B');
          function verdict([f, u, sp]) {
            const tot = sp.data, minB = Math.ceil(tot / B), pl = (n) => n + ' block' + (n === 1 ? '' : 's');
            let t = `<b>Spanned:</b> ${pl(sp.blocks.length)}, the minimum (⌈${n0(tot)} / ${n0(B)}⌉)` +
              (sp.split.length ? `; ${sp.split.length > 4 ? sp.split.length + ' records cross' : listNames(sp.split) + ' cross' + (sp.split.length === 1 ? 'es' : '')} a block boundary (${sp.maxParts > 2 ? 'one read per block touched, up to ' + sp.maxParts : 'two reads to fetch alone'}).` : '; no record crosses a boundary.');
            t += u.ok ? ` <b>Unspanned:</b> ${pl(u.blocks.length)}${u.blocks.length > minB ? `, ${n0(u.lost)} B of gaps` : ''}.` : ` <b>Unspanned:</b> record ${LET[u.big]} is longer than a block.`;
            if (!f.ok) t += ' <b>Fixed:</b> cannot store the file at all.';
            else if (!f.pad) t += ` <b>Fixed:</b> all records are ${f.slot} B, so nothing is padded: ${f.bf} per block, ${pl(f.blocks.length)}. Its ideal case.`;
            else t += ` <b>Fixed:</b> every record padded to ${f.slot} B, ${f.bf} per block: ${pl(f.blocks.length)}, ${n0(f.lost)} B lost.`;
            return t;
          }
          draw();
        },
      },
      /* ---------------- 7. Recap ---------------- */
      {
        title: 'Recap: three ways to pack records',
        kind: 'recap',
        html: `
          <div class="stack fill" style="gap:10px">
            <table class="tbl compact rc7">
              <thead><tr><th></th><th>Fixed blocking</th><th>Variable-length spanned</th><th>Variable-length unspanned</th></tr></thead>
              <tbody>
                <tr><td>Record lengths</td><td>all the same</td><td>vary</td><td>vary</td></tr>
                <tr><td>Records split across blocks?</td><td>never</td><td>yes, with a pointer to the next block</td><td>never</td></tr>
                <tr><td>Unused space</td><td>the tail of every block (plus padding if the data really varies)</td><td>none, apart from the open end of the last block</td><td>a gap at the end of most blocks</td></tr>
                <tr><td>Longest record allowed</td><td>one block</td><td>no limit</td><td>one block</td></tr>
                <tr><td>Reading one record alone</td><td>one I/O</td><td>two I/Os if it spans two blocks</td><td>one I/O</td></tr>
                <tr><td>Ease</td><td>simplest; record k is found by arithmetic</td><td>hardest to implement and to update</td><td>in between</td></tr>
              </tbody>
            </table>
            <div class="rc7cards"></div>
          </div>`,
        render(el, ctx) {
          ctx.$('.rc7cards').append(ctx.ui.flipcards([
            ['Blocking factor?', 'bfr = ⌊B / R⌋, rounded down. 512-byte blocks and 120-byte records give ⌊4.27⌋ = 4.'],
            ['Unused bytes per fixed block?', 'B − bfr × R. For 512 and 120: 512 − 480 = 32 bytes, 6.25% of each block.'],
            ['Fewest blocks any method can use?', '⌈total bytes / B⌉. Spanned blocking reaches it, if the few bytes for pointers and lengths are ignored.'],
            ['Who gains from large blocks?', 'Sequential processing: fewer I/Os. Random access loses: unneeded records move, and buffers grow.'],
            ['What does a spanned record cost?', 'One I/O per block it touches to read it on its own (two if it crosses one boundary), plus a pointer to the next block.'],
            ['Why one fixed block size?', 'Simple I/O, interchangeable buffers in main memory, and an easy layout on the disk.'],
          ], { cols: ctx.narrow ? 1 : 3, height: 116 }));
        },
      },
      /* ---------------- 8. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { type: 'num', q: 'Fixed blocking uses 4,096-byte blocks and 300-byte records. What is the blocking factor (records per block)?', answer: 13, tol: 0,
            why: '⌊4,096 / 300⌋ = ⌊13.65⌋ = 13. Thirteen records use 3,900 bytes; the other 196 bytes of each block are too short for a fourteenth record and stay unused.' },
          { type: 'num', q: 'Fixed blocking uses 512-byte blocks and 120-byte records. How many bytes at the end of each block are unused?', answer: 32, tol: 0, unit: 'bytes',
            why: '⌊512 / 120⌋ = 4 records fit, using 4 × 120 = 480 bytes, so 512 − 480 = 32 bytes (6.25% of the block) are internal fragmentation.' },
          { type: 'num', q: 'A file of 2,000 fixed-length records of 120 bytes is stored with fixed blocking in 512-byte blocks. How many blocks does it occupy?', answer: 500, tol: 0, unit: 'blocks',
            why: 'The blocking factor is ⌊512 / 120⌋ = 4, so the file needs ⌈2,000 / 4⌉ = 500 blocks.' },
          { type: 'num', q: 'Variable-length unspanned blocking, 512-byte blocks. The records arrive in this order: 300, 450, 200 and 380 bytes. How many blocks are used?', answer: 4, tol: 0, unit: 'blocks',
            why: 'No two neighbours fit together (300 + 450 = 750, 450 + 200 = 650, 200 + 380 = 580, all over 512), so every record starts a new block: 4 blocks. Spanned blocking would need only ⌈1,330 / 512⌉ = 3.' },
          { q: 'Which blocking method can store a record that is longer than one block?',
            choices: ['Fixed blocking, by giving that record a block of its own', 'Variable-length unspanned blocking, by starting it in a fresh block', 'Variable-length spanned blocking, continuing it in later blocks', 'None of them, because a record must always fit inside one block'],
            answer: 2,
            feedback: ['Fixed blocking stores a whole number of records in each block, so a record longer than a block cannot fit at all.', 'Unspanned blocking never splits a record, so even an empty block is too small for it.', null, 'Spanned blocking removes that limit: the record continues in as many following blocks as it needs.'],
            why: 'Only spanned blocking lets a record continue past the end of a block, linked by a pointer to the next block, so record size is not limited by block size.' },
          { type: 'tf', q: 'In variable-length unspanned blocking, a record that does not fit in the space left in a block is split, and the rest goes into the next block.', answer: false,
            why: 'Unspanned means records are never split. The leftover space is abandoned and the whole record starts the next block; splitting is what spanned blocking does.' },
          { type: 'multi', q: 'Which of these are drawbacks of variable-length spanned blocking? Choose all that apply.',
            choices: ['It is harder to implement than the other two methods', 'Reading a record that crosses a block boundary takes one block read per block it touches', 'No record may be longer than one block', 'Most blocks end with a stretch of unused space', 'Growing or shrinking a record shifts every byte after it, so the file is hard to update'],
            answer: [0, 1, 4],
            why: 'Spanned blocking wastes no space and has no record-size limit; its costs are complexity, one block read for every block a spanned record touches (two when it crosses one boundary, more for a record longer than a block), and painful updates. The size limit and the end-of-block gaps belong to unspanned blocking.' },
          { type: 'bucket', q: 'Sort each statement under the blocking method it describes.', buckets: ['Fixed', 'Variable spanned', 'Variable unspanned'],
            items: [['Every block holds the same whole number of records', 0], ['A block may end with a pointer to the block that holds the rest of a record', 1], ['Records vary in length, and leftover space is abandoned when the next record does not fit', 2], ['Records are packed end to end with no gaps at all', 1], ['Record k is in block ⌊k / bfr⌋, slot k mod bfr', 0], ['Variable-length records are never cut, so each one is read with a single I/O', 2]],
            why: 'Fixed blocking: equal records and a constant blocking factor, so positions are pure arithmetic. Spanned: no gaps, records may continue in the next block via a pointer. Unspanned: varying records kept whole, so each takes one I/O but gaps are left behind.' },
          { type: 'order', q: 'A program asks for record k of a file that uses fixed blocking. Put the file system\'s steps in order.',
            items: ['Compute the block number ⌊k / bfr⌋', 'Check whether that block is already in a buffer in main memory', 'If it is not, read the whole block from the disk into a buffer', 'Copy the record at offset (k mod bfr) × R in the buffer to the program'],
            why: 'The block number comes first, because that is what the disk understands. Only a block that is not already buffered costs an I/O; the record is then unpacked from its slot in the buffer.' },
          { type: 'match', q: 'Match each term to its meaning.',
            pairs: [['Record', 'The logical unit a program reads or writes'], ['Block', 'The unit of I/O with secondary storage'], ['Blocking factor', 'The number of records that fit in one block'], ['Internal fragmentation', 'Unused bytes at the end of each fixed block'], ['Continuation pointer', 'Names the block that holds the rest of a spanned record']],
            why: 'Programs work in records, the disk moves blocks, and record blocking bridges the two: the blocking factor counts records per block, and each method leaves its own kind of waste or pointer.' },
          { q: 'A payroll program reads every record of a large file in stored order. What does switching the file to larger blocks do for this program?',
            choices: ['Every read now moves records the program does not need, so the run slows down', 'More records arrive with each I/O, so the run needs fewer block reads', 'Nothing, since the number of block reads depends only on the number of records', 'It removes the internal fragmentation at the end of every block'],
            answer: 1,
            feedback: ['In a sequential run every record in the block is needed soon, so nothing moved is wasted; that complaint applies to random access.', null, 'Block reads equal ⌈records / blocking factor⌉, and a larger block raises the blocking factor.', 'The unused tail depends on B mod R; a larger block can leave a tail just as large, or larger.'],
            why: 'Sequential processing uses every record a block brings, so larger blocks mean fewer I/Os for the same file. Random access is the workload that suffers from large blocks.' },
          { q: 'Why do most systems use a single fixed block size?',
            choices: ['Fixed blocks always hold more records than variable blocks of the same average size', 'Fixed blocks remove internal fragmentation from every file', 'Fixed blocks make it impossible for any record to span two blocks', 'Fixed blocks keep I/O, buffer allocation and disk layout simple'],
            answer: 3,
            feedback: ['Giving every block the same size does not pack records more densely; a variable-size block could even be cut to fit its records exactly.', 'Fixed blocking is exactly where internal fragmentation appears: the tail of each block is too short for another record.', 'Spanned blocking works with fixed-size blocks; block size and spanning are separate choices.', null],
            why: 'With one block size every transfer moves the same amount, every buffer in main memory is interchangeable, and blocks are easy to place and find on the disk.' },
        ],
      },
    ],
    notes: `
      <h3>Records versus blocks</h3>
      <p>A <b>record</b> is the logical unit of access: the piece of data a program asks for, such as one customer or one order. A <b>block</b> (sometimes called a physical record) is the unit of I/O: the run of bytes, usually of one fixed size, that moves between secondary storage and main memory in a single operation. The two sizes rarely match, so the file system must pack records into blocks before they are written and unpack them after a block is read. This is <b>record blocking</b>.</p>
      <p>Reading records through a buffer shows why blocks pay off. With 120-byte records and 512-byte blocks, 4 records travel in each block. Reading 12 records in order costs only 3 block reads, because every block brought into the buffer serves the next 3 requests too. In a file of many blocks, reading records in random order rarely finds the needed block already in the buffer, so almost every request costs a full block read that carries 3 records nobody asked for.</p>
      <p>Three design questions follow: should all blocks be the same size, how big should they be, and how should records be laid out inside them?</p>

      <h3>Fixed blocking and the blocking factor</h3>
      <p>In <b>fixed blocking</b> every record has the same length R, and each block of B bytes holds the same whole number of records. That number is the <b>blocking factor</b>:</p>
      <pre>bfr = ⌊ B / R ⌋        (rounded down: a record cannot be cut)
unused bytes per block = B − bfr × R
blocks for a file of n records = ⌈ n / bfr ⌉</pre>
      <p><b>Worked example.</b> B = 512, R = 120: bfr = ⌊4.27⌋ = 4 records per block, using 480 bytes. The remaining 512 − 480 = 32 bytes (6.25% of each block) are too short for another record and are wasted. This waste inside an allocated unit is <b>internal fragmentation</b>. A file of 1,000 such records needs ⌈1,000 / 4⌉ = 250 blocks, or 128,000 bytes on the disk for 120,000 bytes of records. Rounding up instead (⌈4.27⌉ = 5) is a classic mistake: 5 records would need 600 bytes.</p>
      <p>Because every position is fixed, record k is found by arithmetic: it lies in block ⌊k / bfr⌋, in slot k mod bfr, starting at byte (k mod bfr) × R of that block. With bfr = 4, record 742 is in block 185, slot 2, bytes 240 to 359. Fixed blocking is the usual layout for sequential files of fixed-length records. If a record is longer than a block, bfr = 0 and fixed blocking cannot store the file at all.</p>

      <h3>Block size: fixed or variable, large or small</h3>
      <p>Most systems use <b>one fixed block size</b>: every transfer moves the same amount, every buffer in main memory is the same size and interchangeable, and blocks are easy to lay out and locate on the disk.</p>
      <p>The size itself is a trade-off:</p>
      <ul>
        <li><b>Larger blocks</b> carry more records per I/O, so <b>sequential processing</b> (reading every record in stored order) needs fewer block reads.</li>
        <li>For <b>random access</b> (single records in unpredictable order) each lookup still moves a whole block, so a larger block moves more records that are not needed.</li>
        <li>Larger blocks need larger I/O buffers in main memory, which are harder to manage.</li>
      </ul>
      <table>
        <tr><th>Block size (10,000 records of 200 B)</th><th>bfr</th><th>Block reads, full pass</th><th>Unwanted records per lookup</th></tr>
        <tr><td>512 B</td><td>2</td><td>5,000</td><td>1</td></tr>
        <tr><td>4 KB</td><td>20</td><td>500</td><td>19</td></tr>
        <tr><td>32 KB</td><td>163</td><td>62</td><td>162</td></tr>
      </table>
      <p>Real systems settle in the middle: ext4 on Linux and NTFS on Windows (which calls its blocks clusters) both default to 4 KB on typical disks.</p>

      <h3>Variable-length records: spanned and unspanned</h3>
      <p>When records differ in length (a long address here, a short one there), two methods are available.</p>
      <h4>Variable-length spanned blocking</h4>
      <p>Records are packed end to end with no unused space. A record that reaches the end of a block continues at the start of the next block; a <b>continuation pointer</b> stored with the first block names the block that holds the rest. Such a record is a <b>spanned record</b>.</p>
      <ul>
        <li>Advantages: storage is used efficiently, and there is no limit on record size (a record longer than a block simply continues across as many blocks as it needs).</li>
        <li>Drawbacks: it is hard to implement; a spanned record needs one block read for every block it touches to read on its own, assuming none of them is already cached (two when it crosses one boundary; a record of R bytes starting at offset o in B-byte blocks touches ⌈(o + R) / B⌉ blocks, so a 1,200-byte record at offset 0 in 512-byte blocks touches 3, and at offset 400 it touches ⌈1,600 / 512⌉ = 4; a disk may merge neighbouring blocks into one larger request, but each block is still a separate block access); and growing or shrinking a record shifts every byte after it, so the file is hard to update.</li>
        <li>The fewest blocks any method can use is ⌈total bytes / B⌉, and spanned blocking achieves it (real implementations also store a pointer per block and a length per record, which this guide's examples leave out).</li>
      </ul>
      <h4>Variable-length unspanned blocking</h4>
      <p>Records are never split. If the next record does not fit in the space left in the current block, that space is abandoned and the record starts a new block.</p>
      <ul>
        <li>Advantages: every record is read with a single I/O, and the layout is simpler.</li>
        <li>Drawbacks: space is wasted at the end of most blocks, and no record may be longer than a block.</li>
      </ul>
      <h4>Fixed blocking with records that vary</h4>
      <p>Fixed blocking needs every record to have the same length. To use it for records that vary, the file takes the <b>longest</b> record's length L as its record length and <b>pads</b> every shorter record with filler bytes up to L. Each block then holds ⌊B / L⌋ slots, and the padding is wasted on top of the unused tail (B − ⌊B / L⌋ × L) of every block, so one long record can make fixed blocking very wasteful. When all records really are the same length, nothing is padded and fixed blocking is at its best.</p>
      <p><b>Worked example</b> (512-byte blocks; records A–H of 220, 180, 270, 250, 180, 310, 210 and 100 bytes, 1,720 bytes in all):</p>
      <table>
        <tr><th>Method</th><th>Blocks</th><th>Layout</th><th>Wasted</th></tr>
        <tr><td>Spanned</td><td>4 = ⌈1,720 / 512⌉</td><td>[A B C…] […C D E…] […E F G…] […G H]; C, E and G each span two blocks</td><td>0 bytes</td></tr>
        <tr><td>Unspanned</td><td>5</td><td>[A B] [C] [D E] [F] [G H]</td><td>112 + 242 + 82 + 202 = 638 bytes of gaps</td></tr>
        <tr><td>Fixed (padded to 310)</td><td>8</td><td>one 310-byte slot per block, since ⌊512 / 310⌋ = 1</td><td>760 bytes of padding + 8 × 202 = 2,376 bytes</td></tr>
      </table>
      <p>Counting blocks by hand: for fixed blocking compute ⌊B / L⌋ for the slot length L, then ⌈n / bfr⌉; for unspanned, fill each block until the next record does not fit; for spanned, add up all the bytes and divide by B, rounding up. Example: records of 300, 450, 200 and 380 bytes in 512-byte blocks need 4 blocks unspanned (no two neighbours fit together) but only ⌈1,330 / 512⌉ = 3 spanned.</p>

      <h3>Summary comparison</h3>
      <table>
        <tr><th></th><th>Fixed</th><th>Variable spanned</th><th>Variable unspanned</th></tr>
        <tr><td>Record lengths</td><td>all equal</td><td>vary</td><td>vary</td></tr>
        <tr><td>Records split?</td><td>never</td><td>yes, with a pointer</td><td>never</td></tr>
        <tr><td>Unused space</td><td>tail of each block (B − bfr × R)</td><td>none</td><td>gap at the end of most blocks</td></tr>
        <tr><td>Longest record</td><td>one block</td><td>no limit</td><td>one block</td></tr>
        <tr><td>Reading one record</td><td>one I/O</td><td>one I/O per block touched (two if it spans two)</td><td>one I/O</td></tr>
        <tr><td>Ease</td><td>simplest</td><td>hardest; hard to update</td><td>in between</td></tr>
      </table>
      <p><b>In real systems.</b> UNIX, Linux and Windows store an ordinary file as a stream of bytes, so a line of text that reaches the end of a block simply carries on in the file's next block: spanning in effect. There the file system's own map of the file's blocks, not a pointer inside each block, says which block comes next. IBM mainframe data sets still name these choices in their record formats: FB (fixed, blocked), VB (variable, blocked, unspanned) and VBS (variable, blocked, spanned).</p>
    `,
  });
})();
