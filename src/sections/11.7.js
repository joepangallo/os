/* =====================================================================
   11.7 Disk Cache
   Original teaching material. Every step is self-contained; small helpers
   shared by several steps live inside this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ---------- the replacement engine (one copy, used by every step) ---------- */
  const POLS = ['lru', 'lfu', 'fbr2', 'fbr3'];
  const PNAME = { lru: 'LRU', lfu: 'LFU', fbr2: 'FBR (2 sections)', fbr3: 'FBR (3 sections)' };
  const PSHORT = { lru: 'LRU', lfu: 'LFU', fbr2: 'FBR-2', fbr3: 'FBR-3' };
  const PCOL = { lru: 'cpu', lfu: 'io', fbr2: 'mem', fbr3: 'os' };

  // Section sizes for a cache of k slots: the new (and middle) section each take k/3 rounded down, at least 1.
  function sizes(policy, k) {
    const n = Math.max(1, Math.floor(k / 3));
    if (policy === 'fbr2') return { nNew: n, nMid: 0 };
    if (policy === 'fbr3') return { nNew: n, nMid: n };
    return { nNew: 0, nMid: 0 };
  }

  // Runs a reference string through a cache of k slots. stack[0] is the top (most recently used).
  // opt.aging: after each reference, if the average count passes 2, every count is halved (rounded up).
  function simulate(refs, k, policy, opt = {}) {
    const { nNew, nMid } = sizes(policy, k);
    const counting = policy !== 'lru';
    let stack = [];
    let hits = 0;
    const frames = [];
    for (const b of refs) {
      const pos = stack.findIndex((e) => e.b === b);
      const f = { ref: b, hit: pos >= 0, pos, evicted: null, vpos: -1, vcount: 0, counted: false, aged: false };
      if (pos >= 0) {
        hits++;
        const e = stack[pos];
        if (counting && pos >= nNew) { e.c++; f.counted = true; }
        f.oldCount = f.counted ? e.c - 1 : e.c;
        stack.splice(pos, 1);
        stack.unshift(e);
      } else {
        if (stack.length >= k) {
          let v = stack.length - 1;
          if (counting) {
            const from = nNew + nMid;
            v = -1;
            for (let i = stack.length - 1; i >= from; i--) if (v < 0 || stack[i].c < stack[v].c) v = i;
          }
          f.evicted = stack[v].b; f.vpos = v; f.vcount = stack[v].c;
          stack.splice(v, 1);
        }
        stack.unshift({ b, c: 1 });
      }
      if (opt.aging && counting) {
        const avg = stack.reduce((s, e) => s + e.c, 0) / stack.length;
        if (avg > 2) { stack.forEach((e) => { e.c = Math.ceil(e.c / 2); }); f.aged = true; }
      }
      f.hits = hits;
      f.stack = stack.map((e) => ({ b: e.b, c: e.c }));
      frames.push(f);
    }
    return { frames, hits, misses: refs.length - hits, nNew, nMid };
  }

  // Which section a stack position belongs to.
  function zoneOf(policy, k, i) {
    const { nNew, nMid } = sizes(policy, k);
    if (policy === 'lru' || policy === 'lfu') return 'all';
    if (i < nNew) return 'new';
    if (i < nNew + nMid) return 'mid';
    return 'old';
  }

  /* ---------- synthetic workloads for the miss-ratio chart ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // mixed: 12 hot blocks with skewed popularity, plus file scans of new blocks (each read 1-3 times in a row).
  // shift: the same, but the hot set moves to 12 different blocks every 500 references.
  // random: 30 blocks, each equally likely.  loop: blocks 1..20 read in order, over and over.
  function workload(kind, n = 3000) {
    const r = rng(7);
    const out = [];
    if (kind === 'loop') { while (out.length < n) for (let b = 1; b <= 20 && out.length < n; b++) out.push(b); return out; }
    if (kind === 'random') { while (out.length < n) out.push(1 + Math.floor(r() * 30)); return out; }
    const w = [];
    let tot = 0;
    for (let i = 1; i <= 12; i++) { tot += 1 / i; w.push(tot); }
    let next = 1000, base = 0;
    while (out.length < n) {
      if (kind === 'shift' && out.length >= (base / 50 + 1) * 500) base += 50;
      if (r() < 0.08) {
        const len = 4 + Math.floor(r() * 9);
        for (let j = 0; j < len && out.length < n; j++) {
          const b = next++;
          const rep = 1 + Math.floor(r() * 3);
          for (let q = 0; q < rep && out.length < n; q++) out.push(b);
        }
      } else {
        const x = r() * tot;
        let i = 0;
        while (w[i] < x) i++;
        out.push(base + i + 1);
      }
    }
    return out;
  }

  /* ---------- small drawing helpers (HTML, so they reflow on phones) ---------- */
  // A stack of k rows for one policy after frame f (or the empty start when f is null).
  function stackEl(ctx, policy, k, f, o = {}) {
    const { h } = ctx;
    const counting = policy !== 'lru';
    const wrap = h('div', { class: 'stk' });
    const st = f ? f.stack : [];
    const zLab = { new: 'new', mid: 'middle', old: 'old' };
    for (let i = 0; i < k; i++) {
      const z = zoneOf(policy, k, i);
      const e = st[i];
      let cls = 'slot z-' + z;
      if (!e) cls += ' empty';
      else if (f && i === 0) cls += f.hit ? ' just-hit' : ' just-in';
      const tag = z === 'all' ? (i === 0 ? 'top' : i === k - 1 ? 'bottom' : '') : zLab[z];
      const row = h('div', { class: cls },
        h('span', { class: 'pos xs' + (z === 'all' ? '' : ' zt-' + z), text: tag }),
        h('span', { class: 'blk', text: e ? String(e.b) : '·' }),
        counting && e ? h('span', { class: 'cnt' + (f && i === 0 && f.counted ? ' up' : ''), text: 'count ' + e.c }) : h('span', { class: 'cnt none' }));
      wrap.append(row);
    }
    if (o.event !== undefined) wrap.append(h('div', { class: 'evict small', html: o.event || '&nbsp;' }));
    else if (o.showEvict !== false) {
      wrap.append(h('div', { class: 'evict small', html: f && f.evicted != null ? `<span class="chip bad">evicted</span> block <b>${f.evicted}</b>` + (counting ? ` (count ${f.vcount})` : '') : '&nbsp;' }));
    }
    return wrap;
  }

  // A reference strip: the references in order, with a hit/miss mark per policy up to frame idx (-1 = none yet).
  function stripEl(ctx, refs, runs, idx, o = {}) {
    const { h } = ctx;
    const per = o.per || (ctx.narrow ? 9 : refs.length);
    const labW = o.labW || (ctx.narrow ? 52 : 64);
    const box = h('div', { class: 'strips' });
    for (let s = 0; s < refs.length; s += per) {
      const part = refs.slice(s, s + per);
      const g = h('div', { class: 'strip', style: { gridTemplateColumns: `${labW}px repeat(${part.length}, ${o.cell || (ctx.narrow ? 24 : 26)}px)` } });
      g.append(h('span', { class: 'lab xs', text: 'request' }));
      part.forEach((b, j) => g.append(h('span', { class: 'ref' + (s + j === idx ? ' cur' : '') + (s + j > idx ? ' later' : ''), text: String(b) })));
      runs.forEach((r) => {
        g.append(h('span', { class: 'lab xs', html: `<span class="dot ${PCOL[r.policy]}"></span>${PSHORT[r.policy]}` }));
        part.forEach((b, j) => {
          const f = r.frames[s + j];
          const done = s + j <= idx;
          g.append(h('span', { class: 'mk' + (done ? (f.hit ? ' h' : ' m') : ''), text: done ? (f.hit ? 'H' : 'M') : '' }));
        });
      });
      box.append(g);
    }
    return box;
  }

  // One policy's part of a narration line for one reference.
  function describe(policy, k, f) {
    const z = f.hit ? zoneOf(policy, k, f.pos) : null;
    const zName = { new: 'new', mid: 'middle', old: 'old' };
    if (f.hit) {
      if (policy === 'lru') return `hit, block ${f.ref} moves to the top`;
      if (policy === 'lfu') return `hit, count ${f.oldCount} → ${f.oldCount + 1}`;
      if (z === 'new') return `hit in the <b>new</b> section, count stays ${f.oldCount}`;
      return `hit in the <b>${zName[z]}</b> section, count ${f.oldCount} → ${f.oldCount + 1}`;
    }
    if (f.evicted == null) return 'miss, read into a free slot' + (policy === 'lru' ? '' : ' with count 1');
    if (policy === 'lru') return `miss, bottom block ${f.evicted} evicted`;
    if (policy === 'lfu') return `miss, block ${f.evicted} evicted (smallest count, ${f.vcount})`;
    return `miss, block ${f.evicted} evicted (smallest old-section count, ${f.vcount})`;
  }

  // Two policies side by side on one reference string, stepped with a player. Draws into host.
  function duel(ctx, host, cfg) {
    const { h } = ctx;
    const runs = cfg.pols.map((p) => ({ policy: p, ...simulate(cfg.refs, cfg.k, p) }));
    const stripBox = h('div');
    const cols = runs.map(() => h('div', { class: 'stack duel-col', style: { gap: '5px' } }));
    function frame(i) {
      stripBox.replaceChildren(stripEl(ctx, cfg.refs, runs, i - 1, { cell: cfg.cell }));
      runs.forEach((r, j) => {
        const f = i > 0 ? r.frames[i - 1] : null;
        const hits = f ? f.hits : 0;
        cols[j].replaceChildren(
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('span', { class: 'chip ' + PCOL[r.policy], text: PNAME[r.policy] }),
            h('span', { class: 'small b', text: `${hits} hit${hits === 1 ? '' : 's'} / ${i - hits} miss${i - hits === 1 ? '' : 'es'}` })),
          stackEl(ctx, r.policy, cfg.k, f, { event: f ? `<span class="chip ${f.hit ? 'ok' : 'bad'}">${f.hit ? 'hit' : 'miss'}</span> ` + describe(r.policy, cfg.k, f).replace(/^(hit|miss),? /, '') : '' }));
      });
      if (i === 0) return cfg.start;
      const note = cfg.note ? cfg.note(i, runs) : '';
      return `<b>Request ${i}: block ${cfg.refs[i - 1]}.</b> ${note || 'Compare what each policy did, under its stack.'}`;
    }
    const player = ctx.ui.player({ count: cfg.refs.length + 1, render: frame, interval: cfg.interval || 1500 });
    host.append(stripBox, h('div', { class: 'grid-2' }, ...cols), h('div', { class: 'grow' }), player.el);
    return { player, runs };
  }

  const fmtPct = (x) => (x * 100).toFixed(1) + '%';
  const statBox = (h, label, value) => h('div', { class: 'card tight white stat' }, h('div', { class: 'xs muted b', text: label }), h('div', { class: 'stat-v', text: value }));
  const parseRefs = (txt) => String(txt).split(/[\s,;]+/).filter(Boolean);

  Guide.section({
    id: '11.7',
    title: 'Disk Cache',
    short: 'Disk cache',
    summary: 'Main memory keeps copies of recently used disk blocks; LRU, LFU and FBR decide which copy to drop.',
    objectives: [
      'Explain what a disk cache is, what happens on a hit and on a miss, and why locality makes it pay off.',
      'Compare the two ways of delivering a cached block to a process: copying it or passing a pointer to shared memory.',
      'Trace LRU as a stack of pointers and LFU with reference counts, and explain LFU’s burst problem.',
      'Apply frequency-based replacement with two and three sections and explain what each section is for.',
      'Read a miss-ratio-versus-cache-size curve and explain why its shape depends on the workload.',
    ],
    terms: [
      ['Disk cache', 'A buffer in main memory that holds copies of some disk blocks. The OS looks there before going to the disk, so a block used again is delivered at memory speed.'],
      ['Disk block', 'The fixed-size unit in which the OS reads and writes a disk, made of one or more sectors (a sector is the smallest piece the drive itself reads or writes).'],
      ['Cache hit (hit)', 'A request that finds the wanted disk block already in the disk cache, so it is served from main memory with no disk access.'],
      ['Cache miss (miss)', 'A request that does not find the wanted disk block in the disk cache, so the block is first read from the disk into the cache.'],
      ['Hit ratio', 'The fraction of requests that are hits: hits ÷ requests.'],
      ['Miss ratio', 'The fraction of requests that are misses: misses ÷ requests, which is 1 − hit ratio. Lower is better.'],
      ['Locality of reference (locality)', 'The tendency of programs to keep reusing a small, slowly changing set of data, so a block used recently is likely to be used again soon.'],
      ['Reference string', 'The sequence of block numbers requested, in order. Replacement policies are traced and compared on reference strings.'],
      ['Least recently used (LRU)', 'The replacement policy that evicts the cached block that has gone unreferenced for the longest time.'],
      ['LRU stack', 'The cached blocks ordered by last use, most recent on top and least recent at the bottom. It is kept as a list of pointers, so the blocks themselves never move.'],
      ['Least frequently used (LFU)', 'The replacement policy that keeps a reference count for each cached block and evicts the block with the smallest count.'],
      ['Reference count', 'A counter kept with each cached block that goes up when the block is referenced. LFU and FBR pick their victims with it.'],
      ['Frequency-based replacement (FBR)', 'A replacement policy that keeps the LRU stack but splits it into sections, counts only hits outside the new section, and evicts the old-section block with the smallest count.'],
      ['New section', 'In FBR, the top part of the LRU stack, holding the most recently used blocks. A hit here does not raise the block’s count, so quick repeats in a burst count only once.'],
      ['Old section', 'In FBR, the bottom part of the LRU stack. Only blocks here may be replaced: the one with the smallest count goes, and LRU order breaks ties.'],
      ['Middle section', 'In three-section FBR, the part of the stack between the new and old sections. Its blocks cannot be replaced, and a hit raises their count, so they get time to earn one.'],
      ['Count aging', 'Shrinking every reference count from time to time, for example halving them all, so that popularity earned long ago fades away.'],
      ['Write-through', 'A write policy in which every change to a cached block is also written to the disk at once.'],
      ['Delayed write', 'A write policy in which a changed block stays in the cache, marked dirty, and is written to the disk later: when it is replaced or when the cache is flushed.'],
    ],
    css: `
      .sec-11-7 .stk { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .sec-11-7 .slot { display: grid; grid-template-columns: 54px 1fr auto; align-items: center; gap: 6px; height: 40px; padding: 0 10px; border: 2px solid var(--line-2); border-radius: 9px; background: var(--panel); }
      .sec-11-7 .slot.empty { border-style: dashed; background: transparent; }
      .sec-11-7 .slot.empty .blk { color: var(--muted); }
      .sec-11-7 .slot .pos { color: var(--muted); font-weight: 700; }
      .sec-11-7 .slot .blk { font: 800 20px var(--mono); text-align: center; }
      .sec-11-7 .slot .cnt { font-size: 13px; font-weight: 700; color: var(--ink-2); background: var(--panel-3); border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
      .sec-11-7 .slot .cnt.none { background: transparent; padding: 0; }
      .sec-11-7 .slot .cnt.up { background: var(--ok-bg); color: var(--ok); }
      .sec-11-7 .slot.z-new { background: var(--accent-bg); }
      .sec-11-7 .slot.z-mid { background: var(--warn-bg); }
      .sec-11-7 .slot.z-old { background: var(--panel-2); }
      .sec-11-7 .slot.empty.z-new, .sec-11-7 .slot.empty.z-mid, .sec-11-7 .slot.empty.z-old { background: transparent; }
      .sec-11-7 .slot.just-hit { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok-bg); }
      .sec-11-7 .slot.just-in { border-color: var(--io); box-shadow: 0 0 0 2px var(--io-bg); }
      .sec-11-7 .slot .pos.zt-new, .sec-11-7 .slot .pos.zt-mid, .sec-11-7 .slot .pos.zt-old { text-transform: uppercase; letter-spacing: .05em; font-weight: 800; }
      .sec-11-7 .slot .pos.zt-new { color: var(--accent); }
      .sec-11-7 .slot .pos.zt-mid { color: var(--warn); }
      .sec-11-7 .slot .pos.zt-old { color: var(--ink-2); }
      .sec-11-7 .evict { min-height: 26px; display: flex; align-items: center; gap: 6px; }
      .sec-11-7 .strips { display: flex; flex-direction: column; gap: 6px; }
      .sec-11-7 .strip { display: grid; gap: 3px; align-items: center; }
      .sec-11-7 .strip .lab { font-weight: 700; color: var(--ink-2); white-space: nowrap; display: flex; align-items: center; gap: 4px; }
      .sec-11-7 .strip .ref, .sec-11-7 .strip .mk { height: 24px; display: grid; place-items: center; border-radius: 6px; font: 700 13px var(--mono); }
      .sec-11-7 .strip .ref { background: var(--panel-3); }
      .sec-11-7 .strip .ref.later { color: var(--muted); background: transparent; border: 1px dashed var(--line-2); }
      .sec-11-7 .strip .ref.cur { background: var(--accent); color: var(--accent-ink); }
      .sec-11-7 .strip .mk { border: 1px solid var(--line); }
      .sec-11-7 .strip .mk.h { background: var(--ok-bg); color: var(--ok); border-color: var(--ok); }
      .sec-11-7 .strip .mk.m { background: var(--bad-bg); color: var(--bad); border-color: var(--bad); }
      .sec-11-7 .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
      .sec-11-7 .dot.cpu { background: var(--cpu); } .sec-11-7 .dot.io { background: var(--io); }
      .sec-11-7 .dot.mem { background: var(--mem); } .sec-11-7 .dot.os { background: var(--os); }
      .sec-11-7 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-11-7 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-7 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-7 .ptr, .sec-11-7 .cslot { display: grid; align-items: center; gap: 8px; height: 46px; padding: 0 10px; border: 2px solid var(--line-2); border-radius: 9px; background: var(--panel); }
      .sec-11-7 .ptr { grid-template-columns: 52px 1fr auto; background: var(--os-bg); border-color: var(--os); }
      .sec-11-7 .cslot { grid-template-columns: 52px 1fr; background: var(--mem-bg); border-color: var(--mem); }
      .sec-11-7 .ptr.empty, .sec-11-7 .cslot.empty { border-style: dashed; background: transparent; border-color: var(--line-2); }
      .sec-11-7 .ptr.just-hit, .sec-11-7 .cslot.just-hit { border-color: var(--ok); box-shadow: 0 0 0 3px var(--ok-bg); }
      .sec-11-7 .ptr.just-in, .sec-11-7 .cslot.just-in { border-color: var(--io); box-shadow: 0 0 0 3px var(--io-bg); }
      .sec-11-7 .stat { padding: 6px 10px; }
      .sec-11-7 .flip-face.front { font-size: 19px; }
      .sec-11-7 .flip-face.back { font-size: 16px; line-height: 1.45; }
      .sec-11-7 .lab-in { flex: 1; min-width: 0; height: 32px; padding: 4px 10px; resize: none; border: 1px solid var(--line-2); border-radius: 8px; background: var(--panel); color: var(--ink); font-size: 14.5px; }
      .sec-11-7 .nw-row { flex-wrap: nowrap; }
      .sec-11-7 textarea.lab-in { height: auto; flex-basis: 100%; line-height: 1.4; }
      .sec-11-7 .lab-msg { color: var(--muted); white-space: nowrap; min-width: 150px; }
      .sec-11-7 .lab-msg.bad { color: var(--bad); font-weight: 700; }
      .sec-11-7 .lab-main { display: grid; gap: 18px; min-height: 0; }
      .sec-11-7 .lab .slot { height: 31px; }
      .sec-11-7 .lab .stk { gap: 3px; }
      .sec-11-7 .lab .slot .blk { font-size: 18px; }
      .sec-11-7 .lab-tbl td, .sec-11-7 .lab-tbl th { padding: 3px 8px; }
      .sec-11-7 .lab-hint { background: var(--panel-2); border-radius: 10px; padding: 6px 10px; }
      .sec-11-7 .ui-slider { min-width: 220px; }
      .sec-11-7 .stat-v { font-size: 21px; font-weight: 800; font-variant-numeric: tabular-nums; }
      .sec-11-7 .dc-diag { display: flex; flex-direction: column; gap: 8px; }
      .sec-11-7 .dc-lane { border: 2px solid var(--line-2); border-radius: 12px; padding: 6px 10px 8px; display: flex; flex-direction: column; gap: 5px; }
      .sec-11-7 .dc-lane.mem { border-color: var(--mem); background: var(--mem-bg); }
      .sec-11-7 .dc-lane.mem > .xs { color: var(--mem); }
      .sec-11-7 .dc-lane.io { border-color: var(--io); background: var(--io-bg); }
      .sec-11-7 .dc-lane.io > .xs { color: var(--io); }
      .sec-11-7 .dc-slots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .sec-11-7 .dc-slot { background: var(--panel); border: 2px solid var(--line-2); border-radius: 10px; padding: 3px 8px 5px; display: flex; flex-direction: column; align-items: center; }
      .sec-11-7 .dc-slot b { font-size: 17px; }
      .sec-11-7 .dc-slot.empty { border-style: dashed; background: transparent; }
      .sec-11-7 .dc-slot.empty b { color: var(--muted); font-weight: 600; }
      .sec-11-7 .dc-slot.hit { border-color: var(--ok); box-shadow: 0 0 0 3px var(--ok-bg); }
      .sec-11-7 .dc-slot.in { border-color: var(--io); box-shadow: 0 0 0 3px var(--io-bg); }
      .sec-11-7 .dc-disk { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px; }
      .sec-11-7 .dc-dblk { height: 30px; display: grid; place-items: center; border-radius: 7px; background: var(--panel); border: 1px solid var(--line-2); font: 700 15px var(--mono); }
      .sec-11-7 .dc-dblk.read { background: var(--io); color: var(--panel); border-color: var(--io); }
    `,
    steps: [
      /* ---------------------------------------------------------------- 1. Big picture */
      {
        title: 'A waiting room in memory for disk blocks',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Fetching a block from a hard disk takes milliseconds. Fetching a copy already in main memory takes microseconds.</p>
              <p class="m0">So the OS sets aside part of main memory as a <span class="t">disk cache</span>: a buffer that holds copies of some <span class="t">disk blocks</span>. Every read checks the cache first. On a <span class="t">hit</span> the block is delivered straight from memory. On a <span class="t">miss</span> the block is read from the disk into the cache, then delivered, and the copy stays in case it is wanted again.</p>
              <p class="m0">This pays off because of <span class="t">locality</span>: programs keep coming back to the same blocks, such as a directory, an index or the file being edited.</p>
              <div class="callout why m0" data-label="Same idea, one level down">The <span class="t">cache memory</span> of chapter 1 is hardware between the processor and main memory. A disk cache plays the same trick between main memory and the disk, but it is software: OS code plus ordinary RAM.</div>
              <div class="callout analogy m0" data-label="Analogy">A library desk keeps a cart of the books asked for today. A book on the cart is handed over at once; any other book means a long walk to the basement, and it then joins the cart.</div>
            </div>
            <div class="card stack dc-demo" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const K = 4, T1 = 0.01, T2 = 8;
          const box = ctx.$('.dc-demo');
          let cache = [];            // LRU order: index 0 = most recently used
          let req = 0, hits = 0, tCache = 0;
          let last = null;
          let gen = 0;
          const narr = h('div', { class: 'narr' });
          const slotRow = h('div', { class: 'dc-slots' });
          const diskRow = h('div', { class: 'dc-disk' });
          const stats = h('div', { class: 'grid-4 dc-stats' });
          const reqBtns = [1, 2, 3, 4, 5, 6, 7, 8].map((b) => h('button', { class: 'btn sm proc', type: 'button', text: String(b), 'aria-label': 'Ask for block ' + b, onclick: () => { gen++; request(b); } }));
          const typical = [3, 5, 3, 6, 5, 3, 1, 3, 5, 6, 3, 5];
          const playBtn = h('button', { class: 'btn sm primary', type: 'button', text: 'Play a typical pattern', onclick: () => playPattern() });
          const resetBtn = h('button', { class: 'btn sm', type: 'button', text: 'Reset', onclick: () => { gen++; cache = []; req = hits = tCache = 0; last = null; draw(); } });
          function request(b) {
            req++;
            const i = cache.indexOf(b);
            if (i >= 0) {
              hits++; tCache += T1;
              cache.splice(i, 1); cache.unshift(b);
              last = { b, hit: true };
            } else {
              let out = null;
              if (cache.length >= K) out = cache.pop();
              cache.unshift(b);
              tCache += T2 + T1;
              last = { b, hit: false, out };
            }
            draw();
          }
          function playPattern() {
            gen++;
            const g = gen;
            cache = []; req = hits = tCache = 0; last = null; draw();
            typical.forEach((b, j) => ctx.after(500 * (j + 1), () => { if (g !== gen) return; request(b); }));
          }
          function draw() {
            slotRow.replaceChildren(...Array.from({ length: K }, (_, i) => {
              const b = cache[i];
              const fresh = last && b === last.b && i === 0;
              return h('div', { class: 'dc-slot' + (b == null ? ' empty' : '') + (fresh ? (last.hit ? ' hit' : ' in') : '') },
                h('span', { class: 'xs muted', text: i === 0 ? 'newest' : i === K - 1 ? 'oldest' : '\u00a0' }),
                h('b', { text: b == null ? 'free' : 'block ' + b }));
            }));
            diskRow.replaceChildren(...[1, 2, 3, 4, 5, 6, 7, 8].map((b) => h('span', { class: 'dc-dblk' + (last && !last.hit && last.b === b ? ' read' : ''), text: String(b) })));
            if (!last) {
              narr.className = 'narr';
              narr.innerHTML = 'Ask for a block. The cache starts empty, so the first requests must go to the disk.';
            } else if (last.hit) {
              narr.className = 'narr ok';
              narr.innerHTML = `<b>Hit.</b> Block ${last.b} is already in the cache, so it is delivered from main memory in about ${T1} ms. No disk access at all.`;
            } else {
              narr.className = 'narr bad';
              narr.innerHTML = `<b>Miss.</b> Block ${last.b} is not in the cache: it is read from the disk (about ${T2} ms) into the cache, then delivered.` + (last.out != null ? ` The cache was full, so block ${last.out}, the one unused for longest, was dropped to make room.` : '');
            }
            const H = req ? hits / req : 0;
            const tNo = req * T2;
            stats.replaceChildren(
              statBox(h, 'requests', String(req)),
              statBox(h, 'hit ratio', req ? fmtPct(H) : '–'),
              statBox(h, 'time with cache', ctx.util.fmt(tCache, 2) + ' ms'),
              statBox(h, 'without a cache', ctx.util.fmt(tNo, 2) + ' ms'));
          }
          box.append(
            h('h4', { class: 'm0', text: 'Try it: you are the process' }),
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b', text: 'Ask for block' }), ...reqBtns),
            h('div', { class: 'row gap-s' }, playBtn, resetBtn, h('span', { class: 'xs muted', text: 'cache: 4 slots · hit ≈ 0.01 ms · disk read ≈ 8 ms (hard disk)' })),
            h('div', { class: 'dc-diag' },
              h('div', { class: 'dc-lane mem' }, h('span', { class: 'xs b', text: 'DISK CACHE (part of main memory)' }), slotRow),
              h('div', { class: 'dc-lane io' }, h('span', { class: 'xs b', text: 'DISK' }), diskRow)),
            narr, stats,
            h('p', { class: 'xs muted m0', html: 'Average time per request = H × 0.01 + (1 − H) × (8 + 0.01) ms, the two-level formula from chapter 1 with H = <span class="t">hit ratio</span>.' }));
          draw();
        },
      },

      /* ---------------------------------------------------------------- 2. Copy or pointer */
      {
        title: 'Design issue 1: hand over a copy, or a pointer?',
        kind: 'compare',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">A hit found the block in the cache. How do the bytes reach the process?</p>
              <div class="card tight"><b>Option 1: copy.</b> The OS copies the block from its slot into a buffer in the process’s own memory. Simple and safe, but every read costs a copy, and the data sits in memory twice.</div>
              <div class="card tight"><b>Option 2: pointer.</b> The slot becomes <span class="t">shared memory</span>: the OS maps it into the process’s address space and returns its address. No copy, but the slot must stay put while it is in use.</div>
              <div class="callout why m0" data-label="In real systems">On Linux and other UNIX-like systems, <code>read()</code> copies cached file data into your buffer (option 1); <code>mmap()</code> maps the cached pages into your address space (option 2), and the MMU lets the kernel still reclaim such a page by unmapping it first.</div>
              <div class="callout tip m0" data-label="And writes?"><span class="t">Write-through</span> sends each change to the disk at once; <span class="t">delayed write</span> marks the block changed and writes it later (section 11.8).</div>
            </div>
            <div class="card white stack cp-box" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const box = ctx.$('.cp-box');
          const N = ctx.narrow;
          const G = N
            ? { W: 360, H: 300, kb: [4, 4, 352, 124], kl: [14, 24], slots: [0, 1, 2, 3].map((i) => [12 + i * 86, 36, 78, 70]), pb: [4, 150, 352, 146], pl: [14, 286], ptr: [14, 166, 155, 70], buf: [190, 166, 155, 70], fs: 13, lab: [-8, 141, 'end'] }
            : { W: 520, H: 230, kb: [4, 4, 512, 98], kl: [16, 22], slots: [0, 1, 2, 3].map((i) => [16 + i * 124, 30, 112, 60]), pb: [4, 126, 512, 100], pl: [16, 218], ptr: [24, 136, 180, 58], buf: [300, 136, 196, 58], fs: 15, lab: [14, 118, 'start'] };
          const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Main memory: kernel cache slots above, the process address space below' });
          const blocks = [7, 13, 42, 88];
          let mode = 'copy';
          const caps = {
            copy: [
              '<b>The request.</b> Process P calls <code>read</code> and asks for block 42, giving the address of its own buffer <code>buf</code>.',
              '<b>Hit.</b> The OS looks in the disk cache and finds block 42 in slot 2. No disk access is needed.',
              '<b>Copy.</b> The OS copies all 4,096 bytes from slot 2 into <code>buf</code> in P’s memory. That costs processor time on every read, and block 42 now sits in memory twice.',
              '<b>Done.</b> P works on its private copy. The OS may reuse slot 2 for another block at any moment; P’s copy is not affected, and nothing P does to <code>buf</code> can damage the cache.',
            ],
            ptr: [
              '<b>The request.</b> Process P asks for block 42 and expects a pointer back, not a filled buffer.',
              '<b>Hit.</b> The OS finds block 42 in slot 2, exactly as before.',
              '<b>Share.</b> The OS maps slot 2 into P’s address space (shared memory) and returns its address in <code>p</code>. Zero bytes are copied and only one copy of block 42 exists.',
              '<b>The price.</b> Slot 2 must not be replaced while P still uses it, so the cache has one slot fewer to juggle; and P must not scribble on the shared copy (map it read-only, or copy on write).',
            ],
          };
          const T = (x, y, txt, o = {}) => s('text', Object.assign({ x, y, 'font-size': G.fs, 'font-weight': 700 }, o), txt);
          function draw(i) {
            const kids = [];
            kids.push(s('rect', { x: G.kb[0], y: G.kb[1], width: G.kb[2], height: G.kb[3], rx: 12, class: 's-os', 'stroke-width': 2 }));
            kids.push(T(G.kl[0], G.kl[1], 'KERNEL: disk cache slots', { style: 'fill:var(--os)', 'font-size': 13 }));
            blocks.forEach((b, j) => {
              const [x, y, w, hh] = G.slots[j];
              const on = j === 2 && i >= 1;
              kids.push(s('rect', { x, y, width: w, height: hh, rx: 9, class: on ? (mode === 'ptr' && i >= 2 ? 's-warn' : 's-ok') : 's-panel', 'stroke-width': on ? 3 : 2 }));
              kids.push(T(x + w / 2, y + 24, 'slot ' + j, { 'text-anchor': 'middle', class: 's-sub', 'font-size': 13, 'font-weight': 600 }));
              kids.push(T(x + w / 2, y + 47, (N ? 'blk ' : 'block ') + b, { 'text-anchor': 'middle' }));
            });
            kids.push(s('rect', { x: G.pb[0], y: G.pb[1], width: G.pb[2], height: G.pb[3], rx: 12, class: 's-proc', 'stroke-width': i === 0 ? 3 : 2 }));
            kids.push(T(G.pl[0], G.pl[1], 'PROCESS P: its own address space', { style: 'fill:var(--proc)', 'font-size': 13 }));
            const [sx, sy, sw, sh] = G.slots[2];
            if (mode === 'copy') {
              const [x, y, w, hh] = G.buf;
              const full = i >= 2;
              kids.push(s('rect', { x, y, width: w, height: hh, rx: 9, class: full ? 's-ok' : 's-panel', 'stroke-width': 2 }));
              kids.push(T(x + w / 2, y + 26, 'buf', { 'text-anchor': 'middle', class: 's-monot' }));
              kids.push(T(x + w / 2, y + 49, full ? 'copy of block 42' : 'empty', { 'text-anchor': 'middle', 'font-size': 13, class: full ? '' : 's-sub' }));
              if (i === 2) {
                kids.push(s('line', { x1: sx + sw / 2, y1: sy + sh + 4, x2: x + w / 2, y2: y - 6, class: 's-line', 'stroke-width': 3, style: 'stroke:var(--ok)', 'marker-end': 'url(#arr-ok)' }));
                kids.push(T((sx + sw / 2 + x + w / 2) / 2 + G.lab[0], G.lab[1], 'copy 4,096 bytes', { style: 'fill:var(--ok)', 'font-size': 13, 'text-anchor': G.lab[2] }));
              }
            } else {
              const [x, y, w, hh] = G.ptr;
              const set = i >= 2;
              kids.push(s('rect', { x, y, width: w, height: hh, rx: 9, class: set ? 's-accent' : 's-panel', 'stroke-width': 2 }));
              kids.push(T(x + w / 2, y + 26, 'p', { 'text-anchor': 'middle', class: 's-monot' }));
              kids.push(T(x + w / 2, y + 49, set ? '→ slot 2 (shared)' : 'not set yet', { 'text-anchor': 'middle', 'font-size': 13, class: set ? '' : 's-sub' }));
              if (set) {
                kids.push(s('path', { d: `M ${x + w / 2} ${y - 4} C ${x + w / 2} ${y - 40}, ${sx + sw / 2} ${sy + sh + 40}, ${sx + sw / 2} ${sy + sh + 6}`, class: 's-line', 'stroke-width': 2.5, 'stroke-dasharray': '6 5', style: 'stroke:var(--accent)', 'marker-end': 'url(#arr-accent)' }));
              }
              if (i >= 3) kids.push(T(sx + sw / 2, sy - 6, 'pinned', { 'text-anchor': 'middle', style: 'fill:var(--warn)', 'font-size': 13 }));
            }
            svg.replaceChildren(...kids);
            const copied = mode === 'copy' && i >= 2;
            tally.replaceChildren(
              statBox(h, 'bytes copied', copied ? '4,096' : '0'),
              statBox(h, 'copies of block 42', copied ? '2' : '1'),
              statBox(h, 'slot 2 reusable?', mode === 'ptr' && i >= 2 ? 'no' : 'yes'));
            return caps[mode][i];
          }
          const tally = h('div', { class: 'grid-3' });
          const seg = ctx.ui.seg([{ value: 'copy', label: 'Option 1: copy' }, { value: 'ptr', label: 'Option 2: pointer' }], mode, (v) => { mode = v; player.go(0); });
          const player = ctx.ui.player({ count: 4, render: (i) => draw(i), interval: 2200 });
          box.append(seg, h('div', { class: 'grow', style: { display: 'grid', placeItems: 'center' } }, svg), tally, player.el);
        },
      },

      /* ---------------------------------------------------------------- 3. LRU as a stack of pointers */
      {
        title: 'Design issue 2: LRU keeps a stack of pointers',
        kind: 'explore',
        core: true,
        html: `
          <div class="split fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">When the cache is full and a miss arrives, some block must go. The most common choice is <span class="t">least recently used (LRU)</span>.</p>
              <p class="m0">Picture the cache as an <span class="t">LRU stack</span>: the block referenced most recently on top, the one unused for longest at the bottom.</p>
              <ul class="m0">
                <li><b>Hit:</b> the block jumps to the top; the blocks that were above it slide down one place.</li>
                <li><b>Miss:</b> the bottom block is replaced, and the new block goes on top.</li>
              </ul>
              <div class="callout warn m0" data-label="Common mistake">The OS does not drag 4 KB blocks around memory. Each block stays in its slot; the stack is a short list of <b>pointers</b> to slots, and only the pointers move.</div>
              <div class="callout why m0" data-label="Why it works">LRU bets on locality: the block untouched for longest is the least likely to be wanted soon, the same bet as page replacement in chapter 8.</div>
            </div>
            <div class="card white stack lru-box" style="gap:10px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const box = ctx.$('.lru-box');
          const refs = [5, 2, 9, 5, 7, 2, 4, 5, 9], K = 4;
          const run = simulate(refs, K, 'lru');
          // Which slot each block lives in: a new block takes a free slot, or the slot of the block it replaced.
          const slotsAt = [];
          let slots = [null, null, null, null];
          run.frames.forEach((f) => {
            slots = slots.slice();
            if (!f.hit) {
              const at = f.evicted != null ? slots.indexOf(f.evicted) : slots.indexOf(null);
              slots[at] = f.ref;
            }
            slotsAt.push(slots);
          });
          const stripBox = h('div');
          const stackBox = h('div', { class: 'stack', style: { gap: '4px' } });
          const slotBox = h('div', { class: 'stack', style: { gap: '4px' } });
          const tally = h('div', { class: 'row small' });
          function frame(i) {
            const f = i > 0 ? run.frames[i - 1] : null;
            const sl = i > 0 ? slotsAt[i - 1] : [null, null, null, null];
            stripBox.replaceChildren(stripEl(ctx, refs, [{ policy: 'lru', frames: run.frames }], i - 1, { cell: ctx.narrow ? 24 : 34 }));
            const st = f ? f.stack : [];
            stackBox.replaceChildren(h('h4', { class: 'm0', text: 'LRU stack (pointers)' }), ...Array.from({ length: K }, (_, j) => {
              const e = st[j];
              const cls = 'ptr' + (!e ? ' empty' : '') + (f && j === 0 ? (f.hit ? ' just-hit' : ' just-in') : '');
              return h('div', { class: cls },
                h('span', { class: 'xs muted b', text: j === 0 ? 'top' : j === K - 1 ? 'bottom' : '' }),
                h('span', { class: 'mono b', text: e ? '→ slot ' + sl.indexOf(e.b) : '(empty)' }),
                h('span', { class: 'small muted', text: e ? 'block ' + e.b : '' }));
            }));
            slotBox.replaceChildren(h('h4', { class: 'm0', text: 'Cache slots (data stays put)' }), ...sl.map((b, j) => {
              const cls = 'cslot' + (b == null ? ' empty' : '') + (f && b === f.ref ? (f.hit ? ' just-hit' : ' just-in') : '');
              return h('div', { class: cls }, h('span', { class: 'xs muted b', text: 'slot ' + j }), h('b', { text: b == null ? 'free' : 'block ' + b }));
            }));
            const done = run.frames.slice(0, i);
            const hits = done.filter((x) => x.hit).length;
            tally.replaceChildren(h('span', { class: 'chip ok', text: 'hits ' + hits }), h('span', { class: 'chip bad', text: 'misses ' + (i - hits) }), h('span', { class: 'chip', text: 'block bytes moved inside the cache: 0' }));
            if (!f) return '<b>Start.</b> The cache has 4 free slots. Press Next to send the requests in the strip one at a time.';
            if (f.hit) {
              const was = f.pos === K - 1 ? 'the bottom' : 'position ' + (f.pos + 1) + ' from the top';
              return `<b>Request ${i}: block ${f.ref}, hit.</b> It was at ${was} of the stack. Its pointer moves to the top and the pointers above it slide down; block ${f.ref} itself stays in slot ${sl.indexOf(f.ref)}.`;
            }
            if (f.evicted == null) return `<b>Request ${i}: block ${f.ref}, miss.</b> A free slot remains, so block ${f.ref} is read from the disk into slot ${sl.indexOf(f.ref)}, and a pointer to it goes on top of the stack.`;
            const back = refs.indexOf(f.evicted, i) >= 0;
            return `<b>Request ${i}: block ${f.ref}, miss.</b> The cache is full, so the <b>bottom</b> pointer’s block, ${f.evicted}, is replaced: block ${f.ref} is read into slot ${sl.indexOf(f.ref)} and its pointer goes on top.` + (back ? ` (Block ${f.evicted} is asked for again later, so this guess will cost a miss.)` : '');
          }
          const player = ctx.ui.player({ count: refs.length + 1, render: frame, interval: 2200 });
          box.append(stripBox, h('div', { class: 'grid-2 lru-panels' }, stackBox, slotBox), tally, h('div', { class: 'grow' }), player.el);
        },
      },

      /* ---------------------------------------------------------------- 4. LFU and the burst problem */
      {
        title: 'LFU counts references, and a burst fools it',
        kind: 'predict',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Another idea is to count. <span class="t">Least frequently used (LFU)</span> keeps a <span class="t">reference count</span> for each block and evicts the block with the smallest count.</p>
              <p class="m0 small">A block read 50 times sounds more valuable than one read once. The trouble is that a count never forgets.</p>
              <div class="callout bad m0" data-label="The burst problem">A program reads ten short records that all sit in block 9, one right after another. Block 9’s count jumps to 10, and then the program never touches it again. Every newer block starts at count 1, so LFU keeps block 9 anyway.</div>
              <div class="card tight stack lfu-pred" style="gap:6px">
                <p class="m0 small"><b>Predict.</b> After the burst, blocks 1, 2, 3, 4 are read in a loop three times (12 requests). The cache has 4 slots. How many of those 12 requests will LFU hit?</p>
                <div class="row gap-s lfu-choices"></div>
                <div class="small lfu-ans"></div>
              </div>
            </div>
            <div class="card white stack lfu-box" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const refs = [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];
          const burst = 10;
          const d = duel(ctx, ctx.$('.lfu-box'), {
            refs, k: 4, pols: ['lru', 'lfu'], cell: ctx.narrow ? 24 : 22,
            start: '<b>Start.</b> Both caches have 4 empty slots. The first ten requests are the burst on block 9. Press Next or Play.',
            note: (i, runs) => {
              const lfu = runs[1].frames[i - 1];
              const b9 = lfu.stack.find((e) => e.b === 9);
              if (i === burst) return `The burst is over: block 9’s LFU count is <b>${b9.c}</b>.`;
              if (i === refs.length) return `<b>Final:</b> LRU ${runs[0].hits} hits, LFU ${runs[1].hits}. Every LFU hit was part of the burst itself.`;
              if (lfu.evicted != null && b9 && lfu.evicted !== 9) return `Block 9 (count ${b9.c}) keeps its slot, so blocks 1–4 fight over the other three.`;
              return '';
            },
          });
          const loopHits = (r) => r.hits - r.frames.slice(0, burst).filter((f) => f.hit).length;
          const lruLoop = loopHits(d.runs[0]), lfuLoop = loopHits(d.runs[1]);
          const ans = ctx.$('.lfu-ans');
          const opts = [0, 4, 8, 12];
          const btns = opts.map((n) => h('button', { class: 'btn sm', type: 'button', text: String(n), onclick: () => pick(n) }));
          function pick(n) {
            btns.forEach((b, j) => b.classList.toggle('on', opts[j] === n));
            const right = n === lfuLoop;
            ans.innerHTML = (right ? '<span class="chip ok">Right</span> ' : '<span class="chip bad">Not quite</span> ') +
              `LFU hits <b>${lfuLoop}</b> of the 12 (LRU hits ${lruLoop}). Block 9 sits in one slot with count 10, so four blocks take turns in three slots, and each one is thrown out just before it is needed again. Play the simulation to watch it.`;
            ctx.refit();
          }
          ctx.$('.lfu-choices').append(...btns);
        },
      },

      /* ---------------------------------------------------------------- 5. Frequency-based replacement */
      {
        title: 'Frequency-based replacement: count only hits that matter',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0"><span class="t">Frequency-based replacement (FBR)</span> keeps LRU’s stack but counts with care.</p>
              <ol class="m0 fbr-rules">
                <li>Split the LRU stack into a <span class="t">new section</span> on top and an <span class="t">old section</span> below it.</li>
                <li><b>Hit in the new section:</b> move to the top, count <b>unchanged</b>. A burst of quick repeats counts once.</li>
                <li><b>Hit in the old section:</b> count + 1, move to the top.</li>
                <li><b>Miss:</b> evict the old-section block with the <b>smallest count</b>; LRU order breaks ties. The new block enters on top with count 1.</li>
              </ol>
              <div class="callout tip m0" data-label="Refinement: three sections">Add a <span class="t">middle section</span> between new and old. Only old-section blocks can be evicted, so a block that has just left the new section gets time in the middle to earn a count.</div>
              <p class="xs muted m0">In these demos the new (and middle) section is a third of the cache, rounded down: 1 slot each in a 4-slot cache.</p>
            </div>
            <div class="card white fbr-box" style="padding:10px 14px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const host = ctx.$('.fbr-box');
          const burstRefs = [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];
          const shiftRefs = [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 5, 6, 7, 5, 6, 7, 5, 6, 7, 5, 6, 7];
          const cell = ctx.narrow ? 24 : 20;
          const tabs = ctx.ui.tabs([
            { label: 'Burst: LFU vs FBR', render: (p) => {
              const col = h('div', { class: 'stack fill', style: { gap: '8px' } });
              p.append(col);
              const d = duel(ctx, col, {
                refs: burstRefs, k: 4, pols: ['lfu', 'fbr2'], cell,
                start: '<b>Start.</b> The same burst as before: block 9 ten times, then blocks 1–4 in a loop. The top slot is FBR’s new section.',
                note: (i, runs) => {
                  const f = runs[1].frames[i - 1];
                  const b9 = f.stack.find((e) => e.b === 9);
                  if (i === 10) return `After the burst, FBR’s count for block 9 is still <b>${b9.c}</b>: every repeat found it in the new section.`;
                  if (f.evicted === 9) return 'FBR drops block 9: it drifted into the old section with a count of 1 and is the least recently used of the smallest counts.';
                  if (i === burstRefs.length) return `<b>Final:</b> LFU ${runs[0].hits} hits, FBR ${runs[1].hits}.`;
                  return '';
                },
              });
              return () => d.player.stop();   // a hidden tab must not keep playing
            } },
            { label: 'New hot set: 2 vs 3 sections', render: (p) => {
              const col = h('div', { class: 'stack fill', style: { gap: '8px' } });
              p.append(col);
              const d = duel(ctx, col, {
                refs: shiftRefs, k: 4, pols: ['fbr2', 'fbr3'], cell,
                start: '<b>Start.</b> Blocks 1–3 are popular for a while, then the program switches to blocks 5–7 for good.',
                note: (i, runs) => {
                  const a = runs[0].frames[i - 1], b = runs[1].frames[i - 1];
                  if (i === 12) return 'Blocks 1–3 have each built a count of 4. Now the hot set changes.';
                  if (i === 15) return `Key moment: FBR-2 evicts block ${a.evicted}, fresh out of the new section with count ${a.vcount}. FBR-3 cannot: ${a.evicted} is in its middle section, so block ${b.evicted} goes.`;
                  if (i === shiftRefs.length) return `<b>Final:</b> FBR-2 ${runs[0].hits} hits, FBR-3 ${runs[1].hits}. Old counts still pin a block in both caches.`;
                  return '';
                },
              });
              return () => d.player.stop();   // a hidden tab must not keep playing
            } },
          ]);
          host.append(tabs);
        },
      },

      /* ---------------------------------------------------------------- 6. The lab */
      {
        title: 'Lab: the cache stack simulator',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const PRESETS = [
            { name: 'Looping scan', k: 4, refs: '1 2 3 4 5 1 2 3 4 5 1 2 3 4 5',
              hint: (r) => `A loop over 5 blocks with only 4 slots: every policy scores ${r.lru.hits} hits, because each block is evicted just before it comes round again. Drag the cache to 5 slots and see what changes.` },
            { name: 'Burst', k: 4, refs: '9 9 9 9 9 9 9 9 9 9 1 2 3 4 1 2 3 4 1 2 3 4',
              hint: (r) => `Block 9 is read 10 times in a burst, then never again. LFU keeps it and scores ${r.lfu.hits} hits; FBR does not count repeats in the new section and scores ${r.fbr2.hits}.` },
            { name: 'Hot-set shift', k: 4, refs: '1 2 3 1 2 3 1 2 3 1 2 3 5 6 7 5 6 7 5 6 7 5 6 7',
              hint: (r) => `The popular blocks change halfway. Old counts trap LFU (${r.lfu.hits} hits) and two-section FBR (${r.fbr2.hits}); three-section FBR protects the newcomers and matches LRU (${r.fbr3.hits} vs ${r.lru.hits}).` },
            { name: 'Hot blocks + scan', k: 5, refs: '1 2 1 2 1 2 11 12 13 1 14 15 16 2 17 18 19 1 20 21 22 2',
              hint: (r) => `Blocks 1 and 2 are popular; a scan reads blocks 11–22 once each. The scan pushes the popular blocks out of LRU (${r.lru.hits} hits), while the counting policies keep them (FBR-2 ${r.fbr2.hits}).` },
          ];
          let refs = [], K = 4, sel = 'fbr2', runs = {}, hint = '';
          const input = ctx.narrow
            ? h('textarea', { class: 'lab-in mono', rows: 3, 'aria-label': 'Reference string: block numbers separated by spaces', spellcheck: 'false' })
            : h('input', { type: 'text', class: 'lab-in mono', 'aria-label': 'Reference string: block numbers separated by spaces', spellcheck: 'false' });
          const msg = h('div', { class: 'small lab-msg' });
          const applyBtn = h('button', { class: 'btn sm primary', type: 'button', text: 'Apply', onclick: () => apply(input.value, null) });
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(input.value, null); } e.stopPropagation(); });
          const presetBtns = PRESETS.map((p) => h('button', { class: 'btn sm', type: 'button', text: p.name, onclick: () => usePreset(p) }));
          const kSlider = ctx.ui.slider({ label: 'Cache slots', min: 3, max: 6, value: K, onInput: (v) => { K = v; rerun(); } });
          const polSeg = ctx.ui.seg(POLS.map((p) => ({ value: p, label: PSHORT[p] })), sel, (v) => { sel = v; player.refresh(); });
          const stackBox = h('div', { class: 'stack', style: { gap: '6px' } });
          const stripBox = h('div');
          const tbl = h('table', { class: 'tbl compact lab-tbl' });
          function usePreset(p) {
            presetBtns.forEach((b) => b.classList.toggle('on', b.textContent === p.name));
            K = p.k; kSlider.set(K, false);
            apply(p.refs, p);
          }
          function apply(txt, preset) {
            const toks = parseRefs(txt);
            const bad = toks.find((t) => !/^\d{1,2}$/.test(t));
            if (!toks.length || bad !== undefined) {
              msg.className = 'small lab-msg bad';
              msg.textContent = !toks.length ? 'Type some block numbers.' : `“${bad.slice(0, 6)}” is not 0–99.`;
              return;
            }
            if (!preset) presetBtns.forEach((b) => b.classList.remove('on'));
            const cut = toks.length > 30;
            refs = toks.slice(0, 30).map(Number);
            input.value = refs.join(' ');
            msg.className = 'small lab-msg';
            msg.textContent = cut ? 'First 30 requests kept.' : `${refs.length} requests, ${new Set(refs).size} blocks`;
            hint = preset ? preset.name : '';
            rerun();
          }
          function rerun() {
            POLS.forEach((p) => { runs[p] = simulate(refs, K, p); });
            const preset = PRESETS.find((p) => p.name === hint);
            const tot = POLS.map((p) => `${PSHORT[p]} ${runs[p].hits}`).join(', ');
            if (preset && K === preset.k) hintEl.innerHTML = '<b>What to notice:</b> ' + preset.hint(runs);
            else if (preset) hintEl.innerHTML = `<b>${preset.name}, ${K} slots.</b> Hits: ${tot}. Compare with the ${preset.k}-slot cache this preset starts with.`;
            else hintEl.innerHTML = `<b>Your own string.</b> Hits: ${tot}. Step through it to see why they differ.`;
            player.setCount(refs.length + 1);
          }
          const hintEl = h('div', { class: 'small lab-hint' });
          function frame(i) {
            if (!runs[sel]) return '';
            const f = i > 0 ? runs[sel].frames[i - 1] : null;
            const { nNew, nMid } = sizes(sel, K);
            const secTxt = sel === 'fbr2' ? `new section ${nNew}, old ${K - nNew}` : sel === 'fbr3' ? `new ${nNew}, middle ${nMid}, old ${K - nNew - nMid}` : sel === 'lfu' ? 'one pool, smallest count goes' : 'bottom block goes';
            stackBox.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'chip ' + PCOL[sel], text: PNAME[sel] }), h('span', { class: 'xs muted', text: secTxt })),
              stackEl(ctx, sel, K, f, { event: f ? `<span class="chip ${f.hit ? 'ok' : 'bad'}">${f.hit ? 'hit' : 'miss'}</span> ` + describe(sel, K, f).replace(/^(hit|miss),? /, '') : '' }));
            stripBox.replaceChildren(stripEl(ctx, refs, POLS.map((p) => ({ policy: p, frames: runs[p].frames })), i - 1, { cell: ctx.narrow ? 24 : 21 }));
            const heads = ctx.narrow ? ['Policy', 'So far H / M', 'Final hits', 'Miss ratio'] : ['Policy', 'So far: hits / misses', 'Final hits', 'Final miss ratio'];
            tbl.replaceChildren(
              h('tr', {}, ...heads.map((t) => h('th', { text: t }))),
              ...POLS.map((p) => {
                const r = runs[p];
                const sofar = i > 0 ? r.frames[i - 1].hits : 0;
                return h('tr', { class: p === sel ? 'on' : '' },
                  h('td', { html: `<span class="dot ${PCOL[p]}"></span> ${PSHORT[p]}` }),
                  h('td', { class: 'num', text: `${sofar} / ${i - sofar}` }),
                  h('td', { class: 'num b', text: String(r.hits) }), h('td', { class: 'num', text: fmtPct(r.misses / refs.length) }));
              }));
            if (!f) return `<b>Ready.</b> ${refs.length} requests, a ${K}-slot cache. Press Next to step, or Play.`;
            return `<b>Request ${i}: block ${f.ref}.</b> ${PSHORT[sel]}: ${describe(sel, K, f)}.`;
          }
          const player = ctx.ui.player({ count: 2, render: frame, interval: 1300 });
          el.append(h('div', { class: 'stack fill lab', style: { gap: '10px' } },
            h('div', { class: 'card tight stack', style: { gap: '8px' } },
              h('div', { class: 'row gap-s' + (ctx.narrow ? '' : ' nw-row') }, h('span', { class: 'small b', text: 'Reference string' }), input, applyBtn, msg),
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b', text: 'Presets' }), ...presetBtns, kSlider)),
            h('div', { class: 'lab-main grow', style: { gridTemplateColumns: ctx.narrow ? 'minmax(0, 1fr)' : 'minmax(0, 300px) minmax(0, 1fr)' } },
              h('div', { class: 'stack', style: { gap: '8px' } }, polSeg, stackBox, hintEl),
              h('div', { class: 'stack', style: { gap: '8px' } }, stripBox, tbl, h('div', { class: 'grow' }), player.el))));
          usePreset(PRESETS[1]);
        },
      },

      /* ---------------------------------------------------------------- 7. Miss ratio versus cache size */
      {
        title: 'Bigger caches miss less, but the curve depends on the workload',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack mr-left" style="gap:9px">
              <p class="m0">Each curve runs one policy over a synthetic trace of <b>3,000 requests</b> at every cache size from 3 to 30 slots and plots its <span class="t">miss ratio</span>. Pick a workload; hover the chart or drag the slider.</p>
            </div>
            <div class="card white stack mr-right" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const left = ctx.$('.mr-left'), right = ctx.$('.mr-right');
          const KMIN = 3, KMAX = 30, N = KMAX - KMIN + 1;
          const WL = [
            { value: 'mixed', label: 'Hot + scans', desc: 'Twelve hot blocks, some far hotter than others, plus file scans that read new blocks once or a few times in a row.' },
            { value: 'shift', label: 'Shifting', desc: 'The same mix, but the hot set moves to twelve different blocks every 500 requests.' },
            { value: 'random', label: 'Random', desc: 'Thirty blocks, each equally likely on every request: no locality at all.' },
            { value: 'loop', label: 'Loop of 20', desc: 'Blocks 1 to 20 read in order, over and over.' },
          ];
          const WHY = {
            'mixed-0': 'Scans push hot blocks out of LRU’s stack; the counting policies hold on to them. The curves level off toward {floor}, the share of first-time reads, which miss however big the cache.',
            'mixed-1': 'The hot set never moves, so aging only forgets useful popularity: it costs FBR-2 a few points, though FBR-2 still beats LRU at every size.',
            'shift-0': 'Counts earned by an old hot set never fade, so stale blocks keep their slots after the program has moved on. Turn aging on.',
            'shift-1': 'Halving every count from time to time lets old popularity fade. The published FBR design ages its counts for exactly this reason.',
            'random-0': 'With no locality, no policy can guess well. The curves almost lie on top of each other and fall in a straight line: a cache holding k of the 30 blocks hits about k/30 of the time.',
            'random-1': 'With no locality, no policy can guess well, with or without aging. A cache holding k of the 30 blocks hits about k/30 of the time.',
            'loop-0': 'Below 20 slots every policy misses every time: each block is evicted just before it comes round again. At 20 slots the loop fits and only the first pass misses: a cliff, not a curve.',
            'loop-1': 'Below 20 slots every policy misses every time; at 20 the loop fits. Aging cannot help when nothing is ever reused before it is evicted.',
          };
          let wl = 'mixed', aging = 0, K = 12;
          const cache = {};
          function data() {
            const key = wl + '-' + aging;
            if (!cache[key]) {
              const t = workload(wl);
              const d = {};
              POLS.forEach((p) => { d[p] = []; for (let k = KMIN; k <= KMAX; k++) d[p].push(simulate(t, k, p, { aging: !!aging }).misses / t.length); });
              d.floor = new Set(t).size / t.length;   // first reads: they miss whatever the cache size
              cache[key] = d;
            }
            return cache[key];
          }
          const wlSeg = ctx.ui.seg(WL.map((w) => ({ value: w.value, label: w.label })), wl, (v) => { wl = v; draw(); });
          const agSeg = ctx.ui.seg([{ value: 0, label: 'Aging off' }, { value: 1, label: 'Aging on' }], aging, (v) => { aging = v; draw(); });
          const kSl = ctx.ui.slider({ label: 'Cache size', min: KMIN, max: KMAX, value: K, format: (v) => v + ' slots', onInput: (v) => { K = v; draw(); } });
          const tbl = h('table', { class: 'tbl compact' });
          const story = h('div', { class: 'narr small' });
          left.append(h('div', { class: 'row gap-s' }, wlSeg), h('div', { class: 'row gap-s' }, agSeg, h('span', { class: 'xs muted', html: '<span class="t">count aging</span>: halve every count when the average passes 2' })), kSl, tbl,
            h('div', { class: 'callout why m0 small', 'data-label': 'Real traces', html: 'Studies that replayed real disk traces found FBR somewhat better than LRU. These synthetic traces only illustrate the shapes: the winner, and the curve, depend on the workload.' }));
          const NW = ctx.narrow;
          const G = NW ? { W: 360, H: 290, l: 44, r: 12, t: 12, b: 40 } : { W: 640, H: 340, l: 52, r: 104, t: 12, b: 44 };
          const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Miss ratio against cache size for four replacement policies', 'data-keys': '' });
          const DASH = { lru: '', lfu: '9 5', fbr2: '2 5', fbr3: '14 4 3 4' };
          const X = (k) => G.l + (k - KMIN) / (KMAX - KMIN) * (G.W - G.l - G.r);
          const Y = (v) => G.t + (1 - v) * (G.H - G.t - G.b);
          const legend = h('div', { class: 'row gap-s mr-legend' }, ...POLS.map((p) => h('span', { class: 'row gap-s small b', style: { gap: '5px' } },
            s('svg', { viewBox: '0 0 30 10', width: 30, height: 10 }, s('line', { x1: 1, y1: 5, x2: 29, y2: 5, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-dasharray': DASH[p], style: `stroke:var(--${PCOL[p]})` })),
            PNAME[p])));
          right.append(legend, h('div', { class: 'grow', style: { display: 'grid', placeItems: 'center' } }, svg), story);
          svg.addEventListener('pointermove', (e) => {
            const r = svg.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width * G.W;
            const k = Math.round(KMIN + (x - G.l) / (G.W - G.l - G.r) * (KMAX - KMIN));
            if (k >= KMIN && k <= KMAX && k !== K) { K = k; kSl.set(k, false); draw(); }
          });
          function draw() {
            const d = data();
            const kids = [];
            for (let v = 0; v <= 1.0001; v += 0.2) {
              kids.push(s('line', { x1: G.l, y1: Y(v), x2: G.W - G.r, y2: Y(v), class: 's-muted', 'stroke-width': 1 }));
              kids.push(s('text', { x: G.l - 6, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, Math.round(v * 100) + '%'));
            }
            for (let k = KMIN; k <= KMAX; k += (NW ? 9 : 3)) kids.push(s('text', { x: X(k), y: G.H - G.b + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(k)));
            kids.push(s('text', { x: (G.l + G.W - G.r) / 2, y: G.H - 6, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'cache size (slots)'));
            kids.push(s('line', { x1: X(K), y1: G.t, x2: X(K), y2: G.H - G.b, class: 's-line', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }));
            POLS.forEach((p) => {
              const pts = d[p].map((v, j) => `${X(KMIN + j).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
              kids.push(s('polyline', { points: pts, fill: 'none', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': DASH[p], style: `stroke:var(--${PCOL[p]})` }));
            });
            POLS.forEach((p) => kids.push(s('circle', { cx: X(K), cy: Y(d[p][K - KMIN]), r: 5, 'stroke-width': 2, style: `fill:var(--${PCOL[p]});stroke:var(--panel)` })));
            if (!NW) {
              const ends = POLS.map((p) => ({ p, y: Y(d[p][N - 1]) })).sort((a, b) => a.y - b.y);
              for (let j = 1; j < ends.length; j++) if (ends[j].y - ends[j - 1].y < 15) ends[j].y = ends[j - 1].y + 15;
              const ymax = G.H - G.b - 2, last = ends.length - 1;
              if (ends[last].y > ymax) { ends[last].y = ymax; for (let j = last - 1; j >= 0; j--) if (ends[j + 1].y - ends[j].y < 15) ends[j].y = ends[j + 1].y - 15; }
              ends.forEach((e) => kids.push(s('text', { x: G.W - G.r + 8, y: e.y + 4, 'font-size': 13, 'font-weight': 700 }, PSHORT[e.p] + ' ' + (d[e.p][N - 1] * 100).toFixed(0) + '%')));
            }
            svg.replaceChildren(...kids);
            const at = POLS.map((p) => d[p][K - KMIN]);
            const best = Math.min(...at);
            tbl.replaceChildren(h('tr', {}, h('th', { text: 'Policy' }), h('th', { text: `Miss ratio at ${K} slots` }), h('th', { text: 'vs LRU' })),
              ...POLS.map((p, j) => h('tr', { class: at[j] === best ? 'on' : '' },
                h('td', { html: `<span class="dot ${PCOL[p]}"></span> ${PNAME[p]}` }),
                h('td', { class: 'num' + (at[j] === best ? ' b' : ''), text: fmtPct(at[j]) }),
                h('td', { class: 'num', text: p === 'lru' ? '–' : ((at[j] - at[0]) * 100 >= 0 ? '+' : '−') + Math.abs((at[j] - at[0]) * 100).toFixed(1) + ' pts' }))));
            const beat = (p) => d[p].filter((v, j) => v < d.lru[j] - 1e-9).length;
            const w = WL.find((x) => x.value === wl);
            story.innerHTML = `<b>${w.label}.</b> ${w.desc} FBR-2 beats LRU at <b>${beat('fbr2')}</b> of ${N} sizes, FBR-3 at <b>${beat('fbr3')}</b>, LFU at <b>${beat('lfu')}</b>. ${WHY[wl + '-' + aging].replace('{floor}', fmtPct(d.floor))}`;
          }
          draw();
        },
      },

      /* ---------------------------------------------------------------- 8. Recap */
      {
        title: 'Recap: eight ideas to keep',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0', text: 'Say each answer out loud, then click the card to check it.' }),
            ctx.ui.flipcards([
              ['What is a disk cache?', 'A buffer in main memory holding copies of some disk blocks. A hit is served from memory; a miss reads the block from disk into the cache first.'],
              ['Why does it pay off?', 'Locality: programs keep coming back to the same blocks, so a block used recently is likely to be used again soon.'],
              ['Copy or pointer?', 'Copy: simple and safe, but costs a copy and memory. Pointer into shared memory: no copy, but the slot is pinned while in use.'],
              ['How is LRU kept?', 'As a stack of pointers. A referenced block moves to the top; a miss replaces the bottom block. The blocks never move.'],
              ['LFU’s weakness?', 'A burst gives a block a high count, so it stays long after it stops being useful while newcomers (count 1) are evicted.'],
              ['FBR’s three rules?', 'New-section hits do not count; old-section hits add 1; a miss evicts the smallest count in the old section, LRU breaking ties.'],
              ['Why a middle section?', 'A block that just left the new section still has count 1. The middle section shields it from eviction while it earns a count.'],
              ['Miss ratio vs cache size?', 'It falls as the cache grows, but the shape and the winner depend on the workload. First reads always miss.'],
            ], { cols: 4, height: 222 })));
        },
      },

      /* ---------------------------------------------------------------- 9. Quiz */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A process asks for disk block 812, and the OS finds a copy of block 812 in the disk cache. What happens next?',
            choices: ['The OS reads block 812 from the disk anyway, to make sure the copy is current', 'The block is delivered from main memory, and the disk is not touched', 'The OS moves block 812 to the bottom of the LRU stack, marking it as used', 'The request waits in the disk queue until the arm reaches block 812'],
            answer: 1,
            feedback: ['The cached copy is the current version (the cache sees every change), so rereading the disk would throw away the whole benefit.', null, 'A referenced block moves to the top of the LRU stack, not the bottom; the bottom is where victims come from.', 'A hit never reaches the disk queue at all; only misses need the disk.'],
            why: 'That is a hit: the block is delivered from main memory at memory speed, with no disk access. Only a miss reads from the disk.' },
          { type: 'num', q: 'A disk cache has a hit ratio of 0.9. A hit costs 0.01 ms. A miss costs a disk read of 8 ms plus the 0.01 ms to deliver the block from the cache. What is the average time per request, in milliseconds?',
            answer: 0.81, tol: 0.005, unit: 'ms',
            why: 'Average = H × T1 + (1 − H) × (T1 + T2) = 0.9 × 0.01 + 0.1 × 8.01 = 0.009 + 0.801 = 0.81 ms, about ten times faster than 8 ms per request with no cache.' },
          { q: 'Instead of copying a cached block into the process’s buffer, the OS hands the process a pointer to the cache slot in shared memory. What is the trade-off?',
            choices: ['It needs more memory, since the block is then stored once in the cache and once in the process', 'It lets the cache replace the slot whenever it likes, since the process holds only an address', 'It needs no protection at all, since the process can only ever read a block from the disk', 'It saves the copy, but the slot cannot be replaced while the process is still using it'],
            answer: 3,
            feedback: ['That describes the copy approach. With a pointer there is only one copy of the block.', 'The opposite: if the slot were reused, the process’s pointer would suddenly show another block’s data.', 'The process could write through the pointer and damage the shared copy, so the OS must map it read-only or use copy on write.', null],
            why: 'Sharing removes a memory-to-memory copy and the duplicate data, but the slot is tied up (pinned) while the process uses it and must be protected from the process’s writes.' },
          { type: 'order', q: 'A read request misses in a full disk cache that uses LRU. Put the steps in order.',
            items: ['Search the cache for the block and fail to find it', 'Choose the block at the bottom of the LRU stack as the victim', 'Read the requested block from the disk into the victim’s slot', 'Deliver the block, now cached, to the process'],
            why: 'A miss is detected first, then LRU picks the bottom block, its slot receives the new block from the disk (whose pointer goes on top of the stack), and finally the data reaches the process. The block cannot be delivered before it has been read.' },
          { type: 'num', q: 'An LRU disk cache has 3 slots and starts empty. The blocks requested are 3, 1, 3, 5, 1, 4, 3, 1. How many requests are hits?',
            answer: 3, tol: 0,
            why: 'Miss 3, miss 1, hit 3, miss 5, hit 1, then 4 misses and evicts 3 (least recently used), so 3 misses and evicts 5, and the last 1 hits. Hits: 3.' },
          { type: 'tf', q: 'Under LRU, a hit copies the block’s data into the slot at the top of the cache.',
            answer: false,
            why: 'The blocks stay where they are. LRU keeps a stack of pointers to the slots, and only the referenced block’s pointer moves to the top.' },
          { q: 'Block 9 is read ten times in quick succession and then never again. Why might LFU keep it in the cache long afterwards?',
            choices: ['LFU keeps the most recently used block on top, and block 9 never leaves the top', 'LFU never evicts any block that has been read more than once since it arrived', 'Its count reached 10, while blocks loaded later start at 1 and so look less valuable', 'The burst marked block 9 as dirty, and a dirty block cannot be evicted by LFU'],
            answer: 2,
            feedback: ['LFU ranks blocks by count, not by recency, and block 9 slides down as soon as other blocks are referenced.', 'LFU evicts whichever block has the smallest count; blocks read more than once are evicted too when their count is the smallest.', null, 'Reading never makes a block dirty; only a change to its data does.'],
            why: 'LFU counts never shrink, so a short burst leaves a high count behind. Newer blocks start at 1 and are evicted first, while the stale block stays: the burst problem.' },
          { type: 'tf', q: 'In frequency-based replacement, a hit on a block in the new section does not increase the block’s reference count.',
            answer: true,
            why: 'That is FBR’s key rule. Quick repeats land in the new section, so a burst counts only once; hits in the old (or middle) section do add 1.' },
          { q: 'An FBR cache has 5 slots: the new section is the top 2, the old section the bottom 3. From top to bottom the blocks and counts are 14 (1), 22 (1), 37 (3), 41 (2), 58 (2). A miss arrives. Which block is replaced?',
            choices: ['Block 58', 'Block 22', 'Block 41', 'Block 37'],
            answer: 0,
            feedback: [null, 'Block 22 has the smallest count overall, but it is in the new section, and new-section blocks are never replaced.', 'Block 41 ties for the smallest old-section count, but it was used more recently than 58, and LRU order breaks ties.', 'Block 37 has the largest count in the old section, so it is the last to go.'],
            why: 'Only old-section blocks (37, 41, 58) are candidates. The smallest count there is 2 (41 and 58); the tie goes to the less recently used block, the lower one in the stack: 58.' },
          { q: 'Three-section FBR adds a middle section between the new and old sections. What does the middle section achieve?',
            choices: ['It doubles the counts of the blocks inside it, so popular blocks are never replaced', 'It shields blocks that just left the new section from eviction while they earn a count', 'It stores the changed (dirty) blocks until they have been written back to the disk', 'It makes hits in the new section count after all, but only half as much as others'],
            answer: 1,
            feedback: ['Counts in the middle section rise by 1 per hit, like the old section; nothing is doubled.', null, 'Write-back is a separate question from replacement; the sections are about reference order.', 'New-section hits still do not count at all; the middle section changes which blocks can be evicted.'],
            why: 'A block leaving the new section still has count 1 and would be the first victim. Only old-section blocks can be evicted, so the middle section gives it time to collect hits there.' },
          { type: 'bucket', q: 'Sort each statement under the replacement policy it describes.',
            buckets: ['LRU', 'LFU', 'FBR'],
            items: [['Evicts the block at the bottom of the stack', 0], ['Keeps no reference counts at all', 0], ['Evicts the block with the smallest count anywhere in the cache', 1], ['A short burst can keep a dead block cached for a long time', 1], ['Ignores hits on blocks in the new section when counting', 2], ['Chooses victims only from the old section', 2]],
            why: 'LRU uses recency alone (bottom of the stack goes). LFU uses counts alone, which a burst can inflate. FBR combines them: sections decide which hits count and which blocks may be evicted.' },
          { type: 'multi', q: 'Which statements about miss ratio and cache size are true?',
            choices: ['As the cache grows, the miss ratio generally falls', 'With no locality, a cache holding k of N equally likely blocks hits about k/N of the time', 'FBR has a lower miss ratio than LRU on every possible workload', 'A block requested for the very first time misses however big the cache is', 'Once the cache can hold half of the blocks a trace uses, the miss ratio is always close to zero'],
            answer: [0, 1, 3],
            why: 'Bigger caches generally miss less, and first-time reads always miss. Without locality the hit ratio is just the fraction of blocks that fit. No policy wins everywhere, and a loop just larger than the cache can miss on every request, however close it is to fitting.' },
        ],
      },
    ],
    notes: `
      <h3>What a disk cache is</h3>
      <p>A <b>disk cache</b> is a buffer in main memory that holds copies of some disk blocks (a block is one or more sectors, the unit the OS reads and writes). Every read request checks the cache first:</p>
      <ul>
        <li><b>Hit:</b> the block is already in the cache, so it is delivered from main memory. The disk is not touched.</li>
        <li><b>Miss:</b> the block is read from the disk into the cache, then delivered. The copy stays, in case it is wanted again.</li>
      </ul>
      <p>It pays off because of <b>locality of reference</b>: programs keep coming back to the same blocks (a directory, an index, the file being edited), so a block used recently is likely to be used again soon. It is the same idea as the hardware cache memory of chapter 1, one level further down (between main memory and the disk) and done in software: OS code plus ordinary RAM.</p>
      <p><b>Average time.</b> With hit ratio H, hit time T1 and disk time T2, the average time per request is H × T1 + (1 − H) × (T1 + T2). Example: H = 0.9, T1 = 0.01 ms, T2 = 8 ms gives 0.9 × 0.01 + 0.1 × 8.01 = 0.009 + 0.801 = 0.81 ms, about ten times better than 8 ms per request without a cache. The <b>miss ratio</b> is misses ÷ requests = 1 − H.</p>

      <h3>Design issue 1: delivering the block</h3>
      <table>
        <tr><th></th><th>Copy</th><th>Pointer (shared memory)</th></tr>
        <tr><td>How</td><td>The OS copies the block from its cache slot into a buffer in the process’s memory.</td><td>The OS maps the cache slot into the process’s address space and returns its address.</td></tr>
        <tr><td>Cost</td><td>One memory-to-memory copy per read; the block sits in memory twice.</td><td>No copy, one copy of the data.</td></tr>
        <tr><td>Catch</td><td>None for the cache: it may reuse the slot at any time.</td><td>The slot is pinned (cannot be replaced) while the process uses it, and must be protected from the process’s writes (read-only mapping or copy on write).</td></tr>
      </table>
      <p>Real systems offer both: on Linux and other UNIX-like systems, read() copies cached file data into your buffer, while mmap() maps the cached pages into your address space. Unlike the classic pointer scheme, a mapped page need not stay pinned: the MMU lets the kernel take it back by unmapping it first, and the next touch faults it in again.</p>
      <p><b>Writes</b> need a policy too: <b>write-through</b> sends every change to the disk at once; <b>delayed write</b> keeps the changed (dirty) block in the cache and writes it later, when it is replaced or the cache is flushed. The UNIX buffer cache of section 11.8 uses delayed write.</p>

      <h3>Design issue 2: replacement</h3>
      <h4>Least recently used (LRU)</h4>
      <p>The most common policy. The cache is viewed as an <b>LRU stack</b>: the most recently referenced block on top, the least recently referenced at the bottom. On a hit, the block moves to the top and those above it slide down one place. On a miss with a full cache, the bottom block is replaced and the new block goes on top. The stack is a list of <b>pointers</b> to cache slots; the blocks themselves never move in memory.</p>
      <p>Example, 3 slots, requests 3 1 3 5 1 4 3 1: miss, miss, hit, miss, hit, miss (evicts 3), miss (evicts 5), hit. Three hits.</p>
      <h4>Least frequently used (LFU)</h4>
      <p>Keep a <b>reference count</b> for each cached block (a new block starts at 1; each hit adds 1) and evict the block with the smallest count. Weakness, the <b>burst problem</b>: a block referenced many times in a short burst (for example ten small records that sit in one block) gets a high count and stays long after it stops being useful, while newer blocks, starting at count 1, are evicted first. Example with 4 slots: block 9 read 10 times, then blocks 1, 2, 3, 4 in a loop three times. LRU scores 17 hits; LFU scores only 9, all from the burst, because block 9 (count 10) keeps one slot and blocks 1 to 4 take turns in the other three.</p>
      <h4>Frequency-based replacement (FBR)</h4>
      <ol>
        <li>Keep the LRU stack, split into a <b>new section</b> on top and an <b>old section</b> below.</li>
        <li>A hit in the new section moves the block to the top but does <b>not</b> change its count, so a burst of quick repeats counts only once.</li>
        <li>A hit in the old section adds 1 to the count and moves the block to the top.</li>
        <li>On a miss, the block with the <b>smallest count in the old section</b> is replaced; if several share it, the least recently used one (lowest in the stack) goes. The new block enters on top with count 1.</li>
      </ol>
      <p>On the burst example FBR keeps block 9’s count at 1 and evicts it as soon as the loop needs the room: 17 hits, like LRU.</p>
      <p><b>Three sections.</b> In the two-section version, a block that has just slid out of the new section still has count 1, so it can be evicted at once if older blocks have higher counts. The refinement adds a <b>middle section</b> between new and old: hits there add 1, but only old-section blocks can be evicted, so newcomers get time to earn a count. Example with 4 slots: blocks 1, 2, 3 read four times each, then blocks 5, 6, 7 four times each. Two-section FBR keeps evicting the newcomer and scores 9 hits; three-section FBR scores 18.</p>
      <p><b>Count aging.</b> Counts that never shrink let a hot set that has gone cold hold its slots. The published FBR design ages its counts (halving them from time to time) so old popularity fades; the simple versions above leave that out. The aging switch in the miss-ratio explorer halves every count (rounding up) whenever the average count of the cached blocks passes 2.</p>

      <h3>Performance: miss ratio versus cache size</h3>
      <ul>
        <li>The miss ratio generally falls as the cache grows, then flattens: a block read for the first time always misses, however big the cache.</li>
        <li>The shape depends on the workload. With no locality (every block equally likely), a cache holding k of N blocks hits about k/N of the time: a straight line, and all policies are alike. A loop over more blocks than the cache holds misses every time (each block is evicted just before it returns); once the loop fits, almost everything hits: a cliff.</li>
        <li>On a mix of hot blocks and one-time scans, counting policies beat LRU, because scans push hot blocks out of LRU’s stack. When the hot set moves, counting without aging can lose to LRU; with aging, FBR leads again. When the hot set stays put, aging can cost a few points, because it forgets popularity that was still useful.</li>
        <li>Studies that replayed real disk traces found FBR somewhat better than LRU. No policy wins on every workload.</li>
      </ul>
    `,
  });
})();
