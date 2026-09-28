/* Section 1.6 Cache Memory
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {
  /* ------------------------------------------------------------------ shared helpers */
  const K = 4;                 // words per block in every small demo (so the word field is 2 bits)
  const NBLOCKS = 16;          // main memory in the small demos: 16 blocks x 4 words = 64 words
  const NSLOTS = 4;            // cache slots in the small demos
  const bin = (v, bits) => v.toString(2).padStart(bits, '0');
  // multi-line SVG text: lines is a string or an array of strings (one tspan per line)
  function mtext(s, x, y, lines, attrs = {}, lh = 18) {
    const arr = [].concat(lines);
    const t = s('text', Object.assign({ x, y }, attrs));
    arr.forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));
    return t;
  }
  // a clickable SVG group that the student (and the fuzzer) can activate with mouse or keyboard
  function hotGroup(ctx, onAct, label, ...kids) {
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);
    g.addEventListener('click', onAct);
    // SVG elements have no .click() method, so test automation can only send synthetic pointer events;
    // accept those (never trusted user events, which arrive as the click above) so scripted checks reach the hotspot.
    g.addEventListener('pointerdown', (e) => { if (!e.isTrusted) onAct(); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });
    return g;
  }
  /* A tiny cache model used by the simulator lab: 16 blocks x 4 words of memory, 4 slots.
     mode 'direct': slot = block mod 4 (forced).  mode 'assoc': any slot; when full, evict the least recently used. */
  function makeCache(mode) {
    return { mode, slots: [0, 1, 2, 3].map(() => ({ valid: false, block: -1, last: 0 })), t: 0, hits: 0, misses: 0 };
  }
  function lruIndex(c) { return c.slots.reduce((m, sl, k) => (sl.last < c.slots[m].last ? k : m), 0); }
  function cacheAccess(c, addr) {
    const block = addr >> 2, word = addr & 3;
    c.t++;
    let slot, hit, victim = null, reason = '', victimLast = 0;
    if (c.mode === 'direct') {
      slot = block & 3;
      const sl = c.slots[slot];
      hit = sl.valid && sl.block === block;
      if (!hit) { reason = sl.valid ? 'forced' : 'empty'; if (sl.valid) victim = sl.block; }
    } else {
      slot = c.slots.findIndex((sl) => sl.valid && sl.block === block);
      hit = slot >= 0;
      if (!hit) {
        slot = c.slots.findIndex((sl) => !sl.valid);
        if (slot >= 0) reason = 'empty';
        else { slot = lruIndex(c); victim = c.slots[slot].block; victimLast = c.slots[slot].last; reason = 'lru'; }
      }
    }
    const sl = c.slots[slot];
    if (hit) c.hits++; else { c.misses++; sl.valid = true; sl.block = block; }
    sl.last = c.t;
    return { addr, block, word, slot, hit, victim, victimLast, reason, t: c.t };
  }
  // preset reference strings (word addresses). Results verified: seq 12/16 both modes; loop 22/24 both;
  // random 3/16 both; pingpong 0/12 direct but 10/12 associative.
  const PROGRAMS = {
    seq: { label: 'Array walk', refs: Array.from({ length: 16 }, (_, i) => i),
      what: 'Reads words 0, 1, 2, … 15 in order, like a loop adding up an array.',
      after: 'Each miss brings in a whole 4-word block, so the next 3 reads hit: <b>spatial locality</b> at work. Mapping makes no difference here.' },
    loop: { label: 'Loop ×3', refs: [0, 1, 2].flatMap(() => [20, 21, 22, 23, 24, 25, 26, 27]),
      what: 'Fetches an 8-instruction loop body at addresses 20–27, three times.',
      after: 'Only the first pass misses (twice). Every later fetch reuses a cached block: <b>temporal locality</b>. This is why loops run fast.' },
    rand: { label: 'Random', refs: [33, 0, 42, 12, 34, 4, 0, 58, 62, 13, 59, 24, 1, 3, 28, 50],
      what: 'Reads addresses with no pattern, like jumping around a big table.',
      after: 'Most blocks are touched once and then evicted before they are needed again, so only 3 reads hit. <b>Little locality, little benefit</b>: the cache only helps programs that reuse and stay near their data.' },
    ping: { label: 'Ping-pong', refs: [0, 16, 1, 17, 2, 18, 3, 19, 0, 16, 1, 17],
      what: 'Alternates between block 0 (words 0–3) and block 4 (words 16–19), like copying one array into another.',
      after: { direct: 'Direct mapping sends blocks 0 and 4 to the <b>same slot</b>, so each read evicts the other: every read misses while 3 slots sit empty. Now switch to associative mapping and run it again.',
        assoc: 'Associative mapping lets blocks 0 and 4 sit in different slots, so after the first two misses every read hits. Under direct mapping the same program gets 0 hits.' } },
  };

  Guide.section({
    id: '1.6',
    title: 'Cache Memory',
    short: 'Cache memory',
    summary: 'How a small, fast cache hides slow main memory: blocks, tags, hits, mapping, replacement, writes.',
    objectives: [
      'Explain why processors need a cache (the speed gap, every instruction fetch touches memory) and why a cache works (locality).',
      'Describe how main memory is divided into blocks, how cache slots and tags record which blocks are present, and trace a read through a hit and a miss.',
      'Split an address into tag, slot and word fields for a direct-mapped cache, and contrast direct mapping with associative mapping and LRU replacement.',
      'Explain how cache size, block size and write policy (write-through vs write-back) affect performance and correctness.',
      'Describe why modern computers stack several levels of cache (L1, L2, L3).',
    ],
    terms: [
      ['Cache memory (cache)', 'A small, very fast memory placed between the processor and main memory that holds copies of the parts of main memory in current use. Hardware fills it and chooses what to replace without help from programs or, normally, from the OS.'],
      ['Word', 'The unit of data the processor reads or writes in one memory access. Every word in main memory has its own address.'],
      ['Block', 'A fixed-size group of K neighbouring words. Blocks are the unit copied between main memory and the cache: a miss brings in a whole block, never a single word.'],
      ['Slot (cache line)', 'One place in the cache that can hold exactly one block, together with the tag that says which block it is.'],
      ['Tag', 'A few bits stored with each cache slot that identify which main-memory block the slot currently holds.'],
      ['Cache hit (hit)', 'A memory access whose word is already in the cache, so it is delivered at cache speed.'],
      ['Cache miss (miss)', 'A memory access whose word is not in the cache, so its whole block must first be copied in from slower main memory.'],
      ['Hit ratio', 'The fraction of memory accesses that are hits: hits ÷ total accesses. A higher hit ratio means the processor waits for main memory less often.'],
      ['Locality of reference (locality)', 'The tendency of programs to reuse the same memory locations soon (temporal locality) and to use locations near recently used ones (spatial locality).'],
      ['Mapping function', 'The rule that decides which cache slot (or slots) a given main-memory block is allowed to occupy.'],
      ['Direct mapping', 'A mapping function in which every block has exactly one slot it can use: slot = block number mod C. Simple and fast, but blocks that share a slot evict each other.'],
      ['Associative mapping', 'A mapping function in which a block may be placed in any slot (also called fully associative). Flexible, but every slot’s tag must be checked on each access.'],
      ['Set-associative mapping', 'A compromise mapping: slots are grouped into small sets; a block maps to one set (like direct mapping) but may use any slot within that set (like associative mapping).'],
      ['Replacement algorithm', 'The rule that picks which block to throw out of the cache when a new block must be loaded and there is a choice of slot.'],
      ['Least recently used (LRU)', 'A replacement algorithm that evicts the block that has gone unused for the longest time, betting that it is the least likely to be needed soon.'],
      ['Write policy', 'The rule for when main memory is updated after the processor writes to a word that is in the cache.'],
      ['Write-through', 'A write policy in which every write goes to both the cache and main memory at once, so main memory is never out of date.'],
      ['Write-back', 'A write policy in which writes update only the cache; the changed block is copied to main memory later, when it is evicted.'],
      ['Dirty bit', 'A one-bit flag per cache slot (also called the modified or update bit) that is set when the block has been written, so the cache knows it must be written back before being replaced.'],
      ['Multilevel cache', 'A stack of caches (L1, L2, L3) between the processor and main memory, each larger and slower than the one above it.'],
    ],
    css: `
      .sec-1-6 .hot { cursor: pointer; }
      .sec-1-6 .hot:hover rect, .sec-1-6 .hot:hover path { filter: brightness(0.97); }
      .sec-1-6 .s-cache { fill: var(--accent-bg); stroke: var(--accent); }
      .sec-1-6 .tx-acc { fill: var(--accent); }
      .sec-1-6 .tx-ok { fill: var(--ok); }
      .sec-1-6 .tx-bad { fill: var(--bad); }
      .sec-1-6 .tx-mem { fill: var(--mem); }
      .sec-1-6 .tx-cpu { fill: var(--cpu); }
      .sec-1-6 .tx-muted { fill: var(--muted); }
      .sec-1-6 .c-acc { color: var(--accent); }
      .sec-1-6 .c-ok { color: var(--ok); }
      .sec-1-6 .c-bad { color: var(--bad); }
      .sec-1-6 .c-mem { color: var(--mem); }
      .sec-1-6 .c-cpu { color: var(--cpu); }
    `,
    steps: [
      /* ---------------------------------------------------------------- 1. Big picture */
      {
        title: 'The speed gap, and the small memory that hides it',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const INFO = {
            cpu: ['Processor', 'cpu', 'Runs billions of instructions per second. Every one begins with an <b>instruction fetch</b> from memory, so the processor asks memory for words constantly.'],
            word: ['Word transfer (fast)', 'cpu', 'On a <b>hit</b> the cache hands the processor just the one word it asked for, within a few processor cycles. No trip to main memory is needed.'],
            cache: ['Cache', 'acc', 'Tens of kilobytes (the level nearest the processor) to tens of megabytes (the largest level) of very fast memory holding <b>copies</b> of recently used parts of main memory. Hardware runs it: neither your program nor the OS decides what goes in it.'],
            block: ['Block transfer (slower)', 'mem', 'On a <b>miss</b> the cache fetches the whole <b>block</b> of neighbouring words that contains the wanted word. Moving a block costs more than moving one word, but the neighbours are likely to be wanted next, so the trip pays off.'],
            mem: ['Main memory', 'mem', 'Gigabytes of space, but each access takes tens of nanoseconds: long enough for the processor to have run hundreds of instructions. It is divided into fixed-size blocks, the unit the cache copies.'],
          };
          const info = h('div', { class: 'card tight', style: { minHeight: '118px', flex: 'none' } });
          let sel = null;
          const groups = {};
          function pick(k) {
            sel = k;
            const [t, c, body] = INFO[k];
            info.innerHTML = `<div class="b c-${c === 'acc' ? 'acc' : c}" style="margin-bottom:2px">${t}</div><div class="small">${body}</div>`;
            Object.entries(groups).forEach(([kk, g]) => g.style.opacity = kk === k ? '1' : '0.55');
          }
          const svg = s('svg', { viewBox: '0 0 640 250', width: '100%' });
          // processor
          groups.cpu = hotGroup(ctx, () => pick('cpu'), 'Processor',
            s('rect', { x: 10, y: 70, width: 130, height: 100, rx: 14, class: 's-cpu', 'stroke-width': 2.5 }),
            s('text', { x: 75, y: 115, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18 }, 'Processor'),
            s('text', { x: 75, y: 140, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'cycle < 1 ns'));
          // word transfer arrows
          groups.word = hotGroup(ctx, () => pick('word'), 'Word transfer',
            s('rect', { x: 146, y: 88, width: 92, height: 64, fill: 'transparent', stroke: 'none' }),
            s('line', { x1: 148, y1: 110, x2: 232, y2: 110, class: 's-line', 'marker-end': 'url(#arr-cpu)', style: 'stroke:var(--cpu)' }),
            s('line', { x1: 232, y1: 130, x2: 148, y2: 130, class: 's-line', 'marker-end': 'url(#arr-cpu)', style: 'stroke:var(--cpu)' }),
            s('text', { x: 190, y: 80, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 'tx-cpu' }, 'one word'),
            s('text', { x: 190, y: 160, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'fast'));
          // cache
          groups.cache = hotGroup(ctx, () => pick('cache'), 'Cache',
            s('rect', { x: 240, y: 80, width: 120, height: 80, rx: 12, class: 's-cache', 'stroke-width': 2.5 }),
            s('text', { x: 300, y: 115, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18, class: 'tx-acc' }, 'Cache'),
            s('text', { x: 300, y: 140, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, '≈ 1–10 ns'));
          // block transfer arrows
          groups.block = hotGroup(ctx, () => pick('block'), 'Block transfer',
            s('rect', { x: 366, y: 70, width: 110, height: 100, fill: 'transparent', stroke: 'none' }),
            s('line', { x1: 470, y1: 110, x2: 368, y2: 110, class: 's-line', 'marker-end': 'url(#arr-mem)', style: 'stroke:var(--mem)' }),
            s('line', { x1: 368, y1: 130, x2: 470, y2: 130, class: 's-line', 'marker-end': 'url(#arr-mem)', style: 'stroke:var(--mem)' }),
            ...[0, 1, 2, 3].map((i) => s('rect', { x: 392 + i * 14, y: 90, width: 12, height: 12, rx: 2, class: 's-mem', 'stroke-width': 1.5 })),
            s('text', { x: 420, y: 80, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 'tx-mem' }, 'whole block'),
            s('text', { x: 420, y: 162, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'slower'));
          // main memory with block stripes
          const memKids = [s('rect', { x: 478, y: 10, width: 150, height: 220, rx: 12, class: 's-mem', 'stroke-width': 2.5 })];
          for (let i = 0; i < 8; i++) memKids.push(s('rect', { x: 492, y: 46 + i * 20, width: 122, height: 16, rx: 4, fill: 'var(--panel)', style: 'stroke:var(--mem);opacity:.9', 'stroke-width': 1 }));
          memKids.push(s('text', { x: 553, y: 34, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17 }, 'Main memory'));
          memKids.push(s('text', { x: 553, y: 222, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, '≈ 50–100 ns'));
          groups.mem = hotGroup(ctx, () => pick('mem'), 'Main memory', ...memKids);
          svg.append(groups.cpu, groups.word, groups.cache, groups.block, groups.mem,
            s('text', { x: 300, y: 205, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'times are rough, typical figures'));
          info.innerHTML = '<div class="b">Click any part of the picture.</div><div class="small muted">Each part explains its job. Try the two kinds of arrow too: they carry different amounts of data.</div>';

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'A processor can finish a simple instruction in about a nanosecond, often less. Fetching one <span class="t">word</span> from main memory takes roughly <b>a hundred times longer</b>.' }),
              h('p', { class: 'm0', html: 'Every instruction cycle touches memory at least once, because the processor must <b>fetch the instruction</b> before it can run it. Memory speed therefore caps processor speed, and for decades processors have sped up far faster than memory chips.' }),
              h('p', { class: 'm0', html: 'The fix is a <span class="t">cache</span>: a small, very fast memory between the two that keeps copies of the pieces of memory in use right now. It works because of <span class="t">locality of reference</span> (see 1.5): programs keep reusing the same and neighbouring locations.' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why an OS course cares', html: 'The OS does not choose what the cache holds, but its choices (how often it switches programs, how it lays out memory) decide how well the cache works. The same idea returns later as virtual memory and disk caching.' })),
            h('div', { class: 'stack' },
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),
              info,
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A chef keeps tonight’s ingredients on the counter instead of walking to the storeroom for every pinch of salt. When something is missing, the chef brings back the whole crate, because the rest of it will probably be needed soon.' }))));
        },
      },
      /* ---------------------------------------------------------------- 2. Blocks, slots, tags */
      {
        title: 'Blocks, slots and tags: how a cache is organized',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const HELD = [12, 9, 2, 7];                    // block held by slot 0..3 (tag = block number here)
          const slotOf = (b) => HELD.indexOf(b);
          const info = h('div', { class: 'card tight small', style: { minHeight: '74px' } });
          const svg = s('svg', { viewBox: '0 0 640 430', width: '100%' });
          let selAddr = null, selSlot = null;
          const rowBox = [], wordRect = [], slotRect = [];
          const kids = [
            s('text', { x: 150, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: 'tx-mem' }, 'Main memory: 64 words = 16 blocks of 4'),
            s('text', { x: 510, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: 'tx-acc' }, 'Cache: 4 slots'),
          ];
          for (let b = 0; b < NBLOCKS; b++) {
            const y = 30 + b * 25, cached = slotOf(b) >= 0;
            kids.push(s('text', { x: 40, y: y + 15, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: cached ? 'tx-acc' : 'tx-muted' }, 'B' + b));
            rowBox[b] = s('rect', { x: 45, y: y - 1, width: 216, height: 23, rx: 5, fill: 'none', 'stroke-width': 0 });
            kids.push(rowBox[b]);
            for (let w = 0; w < K; w++) {
              const a = b * K + w;
              wordRect[a] = s('rect', { x: 48 + w * 53, y: y + 1, width: 50, height: 19, rx: 4, class: cached ? 's-cache' : 's-mem', 'stroke-width': 1 });
              kids.push(hotGroup(ctx, () => { selAddr = a; selSlot = null; update(); }, 'Address ' + a, wordRect[a],
                s('text', { x: 73 + w * 53, y: y + 15, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot' }, String(a))));
            }
            if (cached) kids.push(s('text', { x: 268, y: y + 15, 'font-size': 12, class: 'tx-acc' }, '→ slot ' + slotOf(b)));
          }
          for (let i = 0; i < NSLOTS; i++) {
            const y = 36 + i * 96, b = HELD[i];
            slotRect[i] = s('rect', { x: 380, y, width: 256, height: 82, rx: 10, class: 's-cache', 'stroke-width': 1.5 });
            kids.push(hotGroup(ctx, () => { selSlot = i; selAddr = null; update(); }, 'Slot ' + i, slotRect[i],
              s('text', { x: 392, y: y + 22, 'font-weight': 800, 'font-size': 14 }, 'Slot ' + i),
              s('rect', { x: 452, y: y + 7, width: 172, height: 22, rx: 5, fill: 'var(--panel)', stroke: 'var(--accent)' }),
              s('text', { x: 538, y: y + 23, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: 'tx-acc' }, 'tag: block ' + b),
              ...[0, 1, 2, 3].map((w) => s('g', {},
                s('rect', { x: 392 + w * 60, y: y + 40, width: 54, height: 30, rx: 5, fill: 'var(--panel)', stroke: 'var(--line-2)' }),
                s('text', { x: 419 + w * 60, y: y + 60, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot' }, 'm[' + (b * K + w) + ']')))));
          }
          svg.append(...kids);
          function update() {
            const selBlock = selAddr != null ? selAddr >> 2 : (selSlot != null ? HELD[selSlot] : null);
            rowBox.forEach((r, b) => { r.setAttribute('stroke-width', b === selBlock ? 2.5 : 0); r.style.stroke = b === selBlock ? 'var(--ink)' : ''; });
            wordRect.forEach((r, a) => { r.setAttribute('stroke-width', a === selAddr ? 2.5 : 1); r.style.stroke = a === selAddr ? 'var(--ink)' : ''; });
            slotRect.forEach((r, i) => r.setAttribute('stroke-width', selSlot === i || HELD[i] === selBlock ? 3.5 : 1.5));
            if (selAddr != null) {
              const b = selAddr >> 2, w = selAddr & 3, sl = slotOf(b);
              info.innerHTML = `<b>Address ${selAddr}</b> is word ${w} of <b>block ${b}</b> (${selAddr} ÷ ${K} = ${b} remainder ${w}); block ${b} holds addresses ${b * K}–${b * K + 3}. ` +
                (sl >= 0 ? `<span class="c-ok b">In the cache:</span> slot ${sl}’s tag says “block ${b}”, so reading ${selAddr} would be a <b>hit</b>.`
                  : `<span class="c-bad b">Not in the cache:</span> no slot’s tag says “block ${b}”, so reading ${selAddr} would be a <b>miss</b> and the whole block would be copied in.`);
            } else if (selSlot != null) {
              const b = HELD[selSlot];
              info.innerHTML = `<b>Slot ${selSlot}</b> holds a copy of <b>block ${b}</b> (addresses ${b * K}–${b * K + 3}). Sixteen blocks share four slots, so the <b>tag</b> is what records which block this slot holds right now. (Here the tag is simply the block number; step 4 shows how direct mapping stores fewer bits.)`;
            } else info.innerHTML = '<b>Click any memory word or any cache slot.</b> <span class="muted">Tinted words currently have a copy in the cache.</span>';
          }
          update();

          // live size calculator
          const out = h('div', { class: 'small', style: { lineHeight: '1.55' } });
          let n = 16, ke = 2, ce = 8;
          const calc = () => {
            const words = 2 ** n, kk = 2 ** ke, M = words / kk, C = 2 ** ce;
            const pct = (100 * C) / M;
            // C is kept at most M / 4 (see fixC), so the cache is always much smaller than memory
            out.innerHTML = `2<sup>${n}</sup> = <b>${words.toLocaleString('en-US')}</b> words ÷ K = ${kk} → <b>M = ${M.toLocaleString('en-US')} blocks</b>. ` +
              `<b>C = ${C.toLocaleString('en-US')} slots</b>: one per ${(M / C).toLocaleString('en-US')} blocks (${pct >= 0.01 ? ctx.util.fmt(pct, 2) : 'under 0.01'}% of memory).`;
          };
          const sC = ctx.ui.slider({ label: 'Cache slots C', min: 2, max: 12, value: ce, format: (v) => String(2 ** v), onInput: (v) => { ce = v; calc(); } });
          // n ≥ 10 and K ≤ 64 guarantee n − log2K − 2 ≥ 2, so the C slider's max never drops below its min
          const fixC = () => { const mx = Math.min(12, n - ke - 2); sC.input.max = mx; if (ce > mx) { ce = mx; sC.set(ce); } calc(); };
          const sN = ctx.ui.slider({ label: 'Address bits n', min: 10, max: 32, value: n, onInput: (v) => { n = v; fixC(); } });
          const sK = ctx.ui.slider({ label: 'Words per block K', min: 0, max: 6, value: ke, format: (v) => String(2 ** v), onInput: (v) => { ke = v; fixC(); } });
          fixC();

          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'Main memory is a long row of <span class="t">words</span>, each with an n-bit address, so there are <b>2<sup>n</sup></b> of them. For caching, memory is cut into fixed-size <span class="t">blocks</span> of <b>K</b> words each, giving <b>M = 2<sup>n</sup> / K</b> blocks.' }),
              h('p', { class: 'm0', html: 'The cache has <b>C</b> <span class="t">slots</span> (also called lines). Each slot holds one whole block of K words plus a <span class="t">tag</span> that names the block. Because <b>C is far smaller than M</b>, blocks take turns in the slots; only the tag records which block a slot holds right now.' }),
              h('div', { class: 'card stack gap-s', style: { padding: '10px 12px', flex: 'none' } }, h('h4', { class: 'm0' }, 'Size calculator'), sN, sK, sC, out),
              h('p', { class: 'small muted m0', html: 'At real scale (every byte has its own address), 16 GB of memory in 64-byte blocks is about 268 million blocks; a 32 KB first-level cache has just 512 slots.' })),
            h('div', { class: 'stack gap-s' }, h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), info)));
        },
      },
      /* ---------------------------------------------------------------- 3. Read operation */
      {
        title: 'A cache read, box by box: hit path vs miss path',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const N = {
            start: { x: 280, y: 30, w: 360, h: 38, pill: 1, t: ['Receive address RA from the processor'] },
            dec: { x: 280, y: 124, w: 300, h: 100, dia: 1, t: ['Is the block holding RA', 'already in the cache?'] },
            fetch: { x: 460, y: 250, w: 190, h: 52, t: ['Fetch word RA', 'from its cache slot'] },
            dlvH: { x: 460, y: 345, w: 190, h: 52, t: ['Deliver word RA', 'to the processor'] },
            mem: { x: 110, y: 250, w: 210, h: 52, t: ['Read the whole block', 'holding RA from memory'] },
            alloc: { x: 110, y: 330, w: 210, h: 52, t: ['Allocate a cache slot', '(evict a block if needed)'] },
            load: { x: 60, y: 418, w: 108, h: 52, t: ['Load block', 'into slot'] },
            dlvM: { x: 172, y: 418, w: 108, h: 52, t: ['Deliver word', 'to processor'] },
            done: { x: 280, y: 494, w: 140, h: 34, pill: 1, t: ['Done'] },
          };
          const E = {
            s_d: 'M280,49 V72', d_f: 'M430,124 H460 V222', f_h: 'M460,276 V317', h_x: 'M460,371 V494 H352',
            d_m: 'M130,124 H110 V222', m_a: 'M110,276 V302', a_l: 'M110,356 V372 H60 V390', a_v: 'M110,372 H172 V390',
            l_x: 'M60,444 V494 H208', v_x: 'M172,444 V494',
          };
          const HIT = [['start'], ['s_d', 'dec'], ['d_f', 'fetch'], ['f_h', 'dlvH'], ['h_x', 'done']];
          const MISS = [['start'], ['s_d', 'dec'], ['d_m', 'mem'], ['m_a', 'alloc'], ['a_l', 'a_v', 'load', 'dlvM'], ['l_x', 'v_x', 'done']];
          const svg = s('svg', { viewBox: '0 0 560 516', width: '100%' });
          const nodeEl = {}, edgeEl = {};
          for (const [k, d] of Object.entries(E)) edgeEl[k] = s('path', { d, class: 's-muted', fill: 'none', 'marker-end': 'url(#arr-muted)' });
          for (const [k, n] of Object.entries(N)) {
            const shape = n.dia
              ? s('polygon', { points: `${n.x},${n.y - n.h / 2} ${n.x + n.w / 2},${n.y} ${n.x},${n.y + n.h / 2} ${n.x - n.w / 2},${n.y}`, class: 's-panel', 'stroke-width': 2 })
              : s('rect', { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: n.pill ? n.h / 2 : 9, class: 's-panel', 'stroke-width': 2 });
            const ty = n.y - (n.t.length - 1) * 8.5 + 5;
            nodeEl[k] = s('g', {}, shape, mtext(s, n.x, ty, n.t, { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': k === 'dec' ? 700 : 600 }, 17));
          }
          svg.append(...Object.values(edgeEl), ...Object.values(nodeEl),
            s('text', { x: 440, y: 114, 'font-size': 13.5, 'font-weight': 800, class: 'tx-ok' }, 'Yes: hit'),
            s('text', { x: 120, y: 114, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 800, class: 'tx-bad' }, 'No: miss'),
            s('text', { x: 232, y: 423, 'font-size': 12.5, class: 's-sub' }, '← at the'),
            s('text', { x: 232, y: 439, 'font-size': 12.5, class: 's-sub' }, 'same time'));
          function paint(path, upto, kind) {
            const lit = new Set(path.slice(0, upto).flat());
            for (const [k, g] of Object.entries(nodeEl)) g.firstChild.setAttribute('class', lit.has(k) ? (kind === 'hit' ? 's-ok' : 's-bad') : 's-panel');
            for (const [k, p] of Object.entries(edgeEl)) {
              const on = lit.has(k);
              p.setAttribute('class', on ? 's-line' : 's-muted');
              p.style.stroke = on ? (kind === 'hit' ? 'var(--ok)' : 'var(--bad)') : '';
              p.setAttribute('marker-end', on ? (kind === 'hit' ? 'url(#arr-ok)' : 'url(#arr-bad)') : 'url(#arr-muted)');
            }
          }
          // tiny cache model: 4 slots, first empty slot else least recently used
          let slots, t, hits, misses, token = 0;
          const cacheBox = h('div', { class: 'grid-2', style: { gap: '8px' } });
          const narr = h('div', { class: 'card tight small', style: { minHeight: '98px' } });
          const score = h('div', { class: 'row', style: { gap: '8px' } });
          function drawCache(fresh) {
            cacheBox.replaceChildren(...slots.map((sl, i) => h('div', {
              class: 'box' + (i === fresh ? ' flash' : ''), style: { borderColor: 'var(--accent)', background: sl ? 'var(--accent-bg)' : 'var(--panel-2)', padding: '5px 8px', fontSize: '14.5px', textAlign: 'left' },
              html: `<span class="xs muted">Slot ${i}</span><br>` + (sl ? `<b class="c-acc">block ${sl.b}</b> <span class="small muted">(${sl.b * K}–${sl.b * K + 3})</span>` : '<span class="muted">empty</span>'),
            })));
            score.innerHTML = `<span class="chip ok">hits ${hits}</span><span class="chip bad">misses ${misses}</span>`;
          }
          function reset() { token++; slots = [null, null, null, null]; t = 0; hits = 0; misses = 0; paint(HIT, 0, 'hit'); drawCache(-1); narr.innerHTML = '<b>Click an address above.</b> <span class="muted">The cache starts empty. Try them left to right and predict each result first. In this cache a new block takes any empty slot; once all 4 are full, the block left unused the longest is evicted.</span>'; }
          async function read(a) {
            const my = ++token, b = a >> 2;
            drawCache(-1);
            t++;
            let i = slots.findIndex((sl) => sl && sl.b === b);
            const hit = i >= 0;
            let why = '';
            if (hit) { slots[i].last = t; hits++; }
            else {
              misses++;
              i = slots.findIndex((sl) => !sl);
              if (i >= 0) why = `slot ${i} was empty`;
              else { i = slots.reduce((m, sl, k) => (sl.last < slots[m].last ? k : m), 0); why = `evicting block ${slots[i].b}, the one unused for longest`; }
              slots[i] = { b, last: t };
            }
            narr.innerHTML = `<b>Read ${a}</b> → block ${b} (addresses ${b * K}–${b * K + 3}). Checking the tags…`;
            const path = hit ? HIT : MISS;
            for (let k = 1; k <= path.length; k++) {
              paint(path, k, hit ? 'hit' : 'miss');
              if (!hit && k === 5) drawCache(i);
              await ctx.sleep(300);
              if (!ctx.alive || my !== token) return;
            }
            drawCache(hit ? -1 : i);
            narr.innerHTML = hit
              ? `<b>Read ${a}</b> → block ${b}. Slot ${i}’s tag says “block ${b}”: <b class="c-ok">HIT</b>. The word comes straight from the cache and main memory is never touched. This is the fast, common case.`
              : `<b>Read ${a}</b> → block ${b}. No tag matches: <b class="c-bad">MISS</b>. The cache reads <b>all four words</b> ${b * K}–${b * K + 3} from main memory into slot ${i} (${why}) and passes word ${a} to the processor as the block arrives.`;
          }
          const addrs = [13, 14, 40, 12, 41, 7, 60, 2];
          const btns = h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { gap: '5px' } }, h('span', { class: 'small b', style: { marginRight: '2px' } }, 'Read:'),
            ...addrs.map((a) => h('button', { class: 'btn sm', style: { minWidth: '40px' }, title: 'Read address ' + a, onclick: () => read(a) }, String(a))),
            h('button', { class: 'btn sm ghost', onclick: reset }, 'Empty cache'));
          reset();
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'card white', style: { padding: '8px 10px', display: 'grid', placeItems: 'center' } }, svg),
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'Each time the processor issues a read address <b>RA</b>, the cache hardware runs this procedure. A hit is done in a few processor cycles; a miss must wait for main memory. Pick an address and watch which path lights up.' }),
              btns,
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Cache contents (4 slots, 4 words per block)'), score),
              cacheBox, narr,
              h('div', { class: 'callout tip m0 small', 'data-label': 'Notice', html: 'A <span class="t">hit</span> never touches main memory. A <span class="t">miss</span> on 13 brings in the whole block 12–15, so the later reads of 14 and 12 hit.' }))));
        },
      },
      /* ---------------------------------------------------------------- 4. Mapping function */
      {
        title: 'Mapping: which slot is a block allowed to use?',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          let mode = 'direct', addr = 37;
          const FIELD = { tag: 'var(--warn)', slot: 'var(--accent)', word: 'var(--mem)' };
          const bitsRow = h('div', { class: 'row nw', style: { gap: '4px', justifyContent: 'center' } });
          const labelsRow = h('div', { class: 'row nw', style: { gap: '4px', justifyContent: 'center' } });
          const decode = h('div', { class: 'card tight small', style: { lineHeight: '1.45' } });
          const pro = h('div', { class: 'callout m0 small' });
          const foot = h('span');
          function fieldsFor(m) { return m === 'direct' ? [['tag', 2], ['slot', 2], ['word', 2]] : [['tag', 4], ['word', 2]]; }
          // SVG: memory blocks (left) and cache slots (right)
          const svg = s('svg', { viewBox: '0 0 600 436', width: '100%' });
          const rows = [], rowTxt = [], slotBox = [], slotTxt = [], arrows = [];
          svg.append(s('text', { x: 130, y: 16, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: 'tx-mem' }, 'Memory blocks'),
            s('text', { x: 510, y: 16, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: 'tx-acc' }, 'Cache slots'));
          for (let i = 0; i < 4; i++) {
            arrows[i] = s('path', { fill: 'none', class: 's-line', 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)' });
            svg.append(arrows[i]);
          }
          for (let b = 0; b < NBLOCKS; b++) {
            const y = 26 + b * 25.5;
            rows[b] = s('rect', { x: 40, y, width: 190, height: 21, rx: 5, class: 's-mem', 'stroke-width': 1 });
            rowTxt[b] = s('text', { x: 222, y: y + 15.5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, '');
            svg.append(hotGroup(ctx, () => { addr = b * K + (addr & 3); slider.set(addr); update(); }, 'Block ' + b, rows[b],
              s('text', { x: 34, y: y + 15.5, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700 }, 'B' + b),
              s('text', { x: 50, y: y + 15.5, 'font-size': 12.5, class: 's-monot' }, `${b * K}–${b * K + 3}`), rowTxt[b]));
          }
          for (let i = 0; i < NSLOTS; i++) {
            const y = 44 + i * 98;
            slotBox[i] = s('rect', { x: 430, y, width: 160, height: 76, rx: 10, class: 's-cache', 'stroke-width': 1.5 });
            slotTxt[i] = s('text', { x: 510, y: y + 52, 'text-anchor': 'middle', 'font-size': 13 }, '');
            svg.append(slotBox[i], s('text', { x: 510, y: y + 28, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'Slot ' + i + '  (' + bin(i, 2) + ')'), slotTxt[i]);
          }
          const arrowPath = (b, i) => { const y1 = 36.5 + b * 25.5, y2 = 82 + i * 98; return `M232,${y1} C330,${y1} 330,${y2} 426,${y2}`; };
          function update() {
            const b = addr >> 2, w = addr & 3, slot = b & 3, tagD = b >> 2;
            const bits = bin(addr, 6).split('');
            let k = 0;
            bitsRow.replaceChildren(); labelsRow.replaceChildren();
            for (const [f, n] of fieldsFor(mode)) {
              for (let j = 0; j < n; j++, k++) bitsRow.append(h('div', { class: 'mono', style: { width: '50px', height: '44px', display: 'grid', placeItems: 'center', fontSize: '25px', fontWeight: 800, borderRadius: '8px', border: '2px solid ' + FIELD[f], background: 'color-mix(in srgb, ' + FIELD[f] + ' 14%, var(--panel))' } }, bits[k]));
              labelsRow.append(h('div', { class: 'xs b center', style: { width: (n * 54 - 4) + 'px', color: FIELD[f] } }, `${f}: ${n} bits`));
            }
            if (mode === 'direct') {
              decode.innerHTML = `<div><b style="color:var(--mem)">word</b> = last 2 bits = ${w}: which of the block’s 4 words.</div>` +
                `<div><b style="color:var(--accent)">slot</b> = middle 2 bits = ${slot}: block ${b} mod 4 = ${slot}. No search needed.</div>` +
                `<div><b style="color:var(--warn)">tag</b> = first 2 bits = ${tagD}: block ${b} ÷ 4 = ${tagD}, remainder dropped. It tells apart the 4 blocks that share slot ${slot}.</div>` +
                '<div class="muted" style="margin-top:3px">In general: word = log<sub>2</sub>K bits, slot = log<sub>2</sub>C bits, tag = the n − log<sub>2</sub>C − log<sub>2</sub>K bits left over.</div>';
              pro.className = 'callout warn m0 small'; pro.dataset.label = 'Trade-off';
              pro.innerHTML = '<span class="t">Direct mapping</span> is cheap and fast: check <b>one</b> slot, compare <b>one</b> tag. But blocks that share a slot evict each other, even while other slots sit idle.';
              foot.innerHTML = 'Click a block to jump to it. Tinted rows are its rivals for the same slot.';
            } else {
              decode.innerHTML = `<div><b style="color:var(--mem)">word</b> = last 2 bits = ${w}: which of the block’s 4 words.</div>` +
                `<div><b style="color:var(--warn)">tag</b> = first 4 bits = ${b}: the whole block number (longer than the 2&#8209;bit direct-mapped tag).</div>` +
                `<div>No slot field: block ${b} may sit <b>anywhere</b>, so ${b} is compared with <b>all four tags at once</b>.</div>` +
                '<div class="muted" style="margin-top:3px">In general: word = log<sub>2</sub>K bits, tag = the other n − log<sub>2</sub>K bits.</div>';
              pro.className = 'callout tip m0 small'; pro.dataset.label = 'Trade-off';
              pro.innerHTML = '<span class="t">Associative mapping</span> never evicts while a slot is free. The price: one comparator (a circuit that tests two tags for equality) per slot, and a <span class="t">replacement algorithm</span> to pick a victim when all are full.';
              foot.innerHTML = 'Click a block to jump to it. Here any block may use any slot.';
            }
            for (let bb = 0; bb < NBLOCKS; bb++) {
              const cur = bb === b, rival = mode === 'direct' && (bb & 3) === slot && !cur;
              rows[bb].setAttribute('class', cur ? 's-warn' : rival ? 's-cache' : 's-mem');
              rows[bb].setAttribute('stroke-width', cur ? 2.5 : 1);
              rowTxt[bb].textContent = mode === 'direct' ? '→ slot ' + (bb & 3) : '';
            }
            for (let i = 0; i < 4; i++) {
              const on = mode === 'assoc' || i === slot;
              arrows[i].setAttribute('d', arrowPath(b, i));
              arrows[i].style.display = on ? '' : 'none';
              arrows[i].style.strokeDasharray = mode === 'assoc' ? '6 5' : '';
              slotBox[i].setAttribute('stroke-width', on ? 3 : 1.5);
              slotTxt[i].textContent = mode === 'direct' ? (i === slot ? `block ${b} goes here, tag ${tagD}` : `blocks ${i}, ${i + 4}, ${i + 8}, ${i + 12}`) : `could hold block ${b}`;
              slotTxt[i].setAttribute('class', on ? 'tx-acc' : 's-sub');
            }
          }
          const slider = ctx.ui.slider({ label: 'Address', min: 0, max: 63, value: addr, format: (v) => v + ' = ' + bin(v, 6), onInput: (v) => { addr = v; update(); } });
          const seg = ctx.ui.seg([{ value: 'direct', label: 'Direct mapping' }, { value: 'assoc', label: 'Associative mapping' }], mode, (v) => { mode = v; update(); });
          update();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'The <span class="t">mapping function</span> decides which slot a block may occupy, and so how the cache splits an address into <b>fields</b>. (Same demo: 64 words, blocks of 4, 4 slots.)' }),
              seg, slider,
              h('div', { class: 'stack', style: { gap: '4px', flex: 'none' } }, bitsRow, labelsRow),
              decode, pro),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),
              h('p', { class: 'xs muted m0' }, foot, ' Real caches mostly use a middle ground, ', h('span', { class: 't' }, 'set-associative mapping'), ': a block maps to one small set of slots and may use any slot inside it.'))));
        },
      },
      /* ---------------------------------------------------------------- 5. Simulator lab */
      {
        title: 'Cache simulator: run programs, count hits and misses',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          let mode = 'direct', prog = 'seq', cache, pc, hist, last, timer = null;
          const FC = { tag: 'var(--warn)', slot: 'var(--accent)', word: 'var(--mem)' };
          // --- main memory (click a word to read it)
          const memSvg = s('svg', { viewBox: '0 0 270 462', width: '100%' });
          const rowRect = [], cellRect = [];
          memSvg.append(s('text', { x: 135, y: 14, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, class: 'tx-mem' }, 'Main memory · click a word'),
            s('rect', { x: 33, y: 443, width: 16, height: 13, rx: 3, class: 's-cache' }), s('text', { x: 55, y: 454, 'font-size': 12.5, class: 's-sub' }, '= block has a copy in the cache'));
          for (let b = 0; b < NBLOCKS; b++) {
            const y = 26 + b * 25.6;
            rowRect[b] = s('rect', { x: 29, y: y - 2, width: 238, height: 25, rx: 6, fill: 'none', 'stroke-width': 0 });
            memSvg.append(rowRect[b], s('text', { x: 25, y: y + 15, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700 }, 'B' + b));
            for (let w = 0; w < K; w++) {
              const a = b * K + w;
              cellRect[a] = s('rect', { x: 33 + w * 58, y, width: 54, height: 21, rx: 4, class: 's-mem', 'stroke-width': 1 });
              memSvg.append(hotGroup(ctx, () => { stop(); doAccess(a, true); }, 'Read address ' + a, cellRect[a],
                s('text', { x: 60 + w * 58, y: y + 15, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot' }, String(a))));
            }
          }
          // --- cache slots
          const cSvg = s('svg', { viewBox: '0 0 520 302', width: '100%' });
          const SL = [];
          for (let i = 0; i < NSLOTS; i++) {
            const y = 2 + i * 76, o = {};
            o.box = s('rect', { x: 2, y, width: 516, height: 70, rx: 10, class: 's-cache', 'stroke-width': 1.5 });
            o.name = s('text', { x: 14, y: y + 28, 'font-weight': 800, 'font-size': 15 }, 'Slot ' + i);
            o.sub = s('text', { x: 14, y: y + 50, 'font-size': 12.5, class: 's-sub' }, '');
            o.tagBox = s('rect', { x: 92, y: y + 12, width: 76, height: 46, rx: 7, fill: 'var(--panel)', 'stroke-width': 1.5, style: 'stroke:var(--warn)' });
            o.tagLbl = s('text', { x: 130, y: y + 26, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 700, style: 'fill:var(--warn)' }, 'TAG');
            o.tag = s('text', { x: 130, y: y + 48, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, class: 's-monot' }, '');
            o.blk = s('text', { x: 180, y: y + 30, 'font-size': 14.5, 'font-weight': 700 }, '');
            o.info = s('text', { x: 180, y: y + 52, 'font-size': 12.5, class: 's-sub' }, '');
            o.words = [0, 1, 2, 3].map((w) => { const r = s('rect', { x: 330 + w * 46, y: y + 18, width: 42, height: 34, rx: 5, fill: 'var(--panel)', stroke: 'var(--line-2)' }); const t = s('text', { x: 351 + w * 46, y: y + 40, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-monot' }, ''); return { r, t }; });
            cSvg.append(o.box, o.name, o.sub, o.tagBox, o.tagLbl, o.tag, o.blk, o.info, ...o.words.flatMap((q) => [q.r, q.t]));
            SL.push(o);
          }
          const addrLine = h('div', { class: 'card tight', style: { fontSize: '15px', minHeight: '46px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } });
          // --- stats
          const big = h('div', { class: 'big' });
          const counts = h('div', { class: 'small muted' });
          const meter = h('div', { class: 'meter' }, h('i'));
          const strip = h('div', { class: 'row', style: { gap: '4px' } });
          const narr = h('div', { class: 'card tight small', style: { minHeight: '88px' } });
          const note = h('div', { class: 'callout m0 small' });

          function paintSlots() {
            const full = cache.slots.every((q) => q.valid), lru = lruIndex(cache);
            cache.slots.forEach((q, i) => {
              const o = SL[i], isLast = last && last.slot === i;
              o.box.setAttribute('stroke-width', isLast ? 3.5 : 1.5);
              o.box.style.stroke = isLast ? (last.hit ? 'var(--ok)' : 'var(--bad)') : '';
              o.sub.textContent = mode === 'direct' ? 'slot bits ' + bin(i, 2) : '';
              o.tag.textContent = q.valid ? (mode === 'direct' ? bin(q.block >> 2, 2) : bin(q.block, 4)) : '–';
              o.blk.textContent = q.valid ? 'block ' + q.block : 'empty';
              o.blk.setAttribute('class', q.valid ? 'tx-acc' : 'tx-muted');
              o.info.textContent = mode === 'assoc' ? (q.valid ? 'last used t=' + q.last + (full && i === lru ? '  ← LRU' : '') : '') : (q.valid ? 'words ' + q.block * K + '–' + (q.block * K + 3) : 'blocks ' + i + ', ' + (i + 4) + ', ' + (i + 8) + ', ' + (i + 12));
              o.info.setAttribute('class', mode === 'assoc' && full && i === lru ? 'tx-bad' : 's-sub');
              o.words.forEach((wq, w) => { wq.t.textContent = q.valid ? 'm' + (q.block * K + w) : ''; wq.r.style.stroke = isLast && last.word === w ? 'var(--ink)' : ''; wq.r.setAttribute('stroke-width', isLast && last.word === w ? 2.5 : 1); });
            });
            const inCache = new Set(cache.slots.filter((q) => q.valid).map((q) => q.block));
            for (let b = 0; b < NBLOCKS; b++) {
              const cur = last && last.block === b;
              rowRect[b].setAttribute('stroke-width', cur ? 2.5 : 0);
              rowRect[b].style.stroke = cur ? (last.hit ? 'var(--ok)' : 'var(--bad)') : '';
              for (let w = 0; w < K; w++) cellRect[b * K + w].setAttribute('class', inCache.has(b) ? 's-cache' : 's-mem');
            }
          }
          function bits(a) {
            const b6 = bin(a, 6), sp = (t, c) => `<span class="mono b" style="color:${c};font-size:17px">${t}</span>`;
            return mode === 'direct' ? sp(b6.slice(0, 2), FC.tag) + '|' + sp(b6.slice(2, 4), FC.slot) + '|' + sp(b6.slice(4), FC.word)
              : sp(b6.slice(0, 4), FC.tag) + '|' + sp(b6.slice(4), FC.word);
          }
          function narrate(r) {
            const b = r.block, sl = r.slot, head = `<b>Read ${r.addr}</b> → block ${b}, word ${r.word}. `;
            let body;
            if (mode === 'direct') {
              const m = `Block ${b} may only use slot ${sl} (${b} mod 4). `;
              if (r.hit) body = m + `Slot ${sl}’s tag ${bin(b >> 2, 2)} matches the address’s tag: <b class="c-ok">HIT</b>.`;
              else if (r.reason === 'empty') body = m + `Slot ${sl} is empty: <b class="c-bad">MISS</b>. Block ${b} (words ${b * K}–${b * K + 3}) is copied in.`;
              else body = m + `It holds block ${r.victim} (tag ${bin(r.victim >> 2, 2)}), not ${b}: <b class="c-bad">MISS</b>. Block ${r.victim} is thrown out with no choice, even if other slots are free.`;
            } else {
              const m = `The tag ${bin(b, 4)} is compared with all four slots at once. `;
              if (r.hit) body = m + `Slot ${sl} matches: <b class="c-ok">HIT</b>, and it becomes the most recently used.`;
              else if (r.reason === 'empty') body = m + `No match: <b class="c-bad">MISS</b>. Block ${b} goes into free slot ${sl}.`;
              else body = m + `No match and every slot is full: <b class="c-bad">MISS</b>. <span class="t">LRU</span> evicts block ${r.victim} from slot ${sl}: last used at t=${r.victimLast}, longer ago than any other.`;
            }
            narr.innerHTML = head + body;
          }
          function paint() {
            paintSlots();
            const P = PROGRAMS[prog], n = P.refs.length, tot = cache.hits + cache.misses;
            addrLine.innerHTML = last ? `<span>Read <b>${last.addr}</b> =</span> ${bits(last.addr)} <span class="small muted">→ ${mode === 'direct' ? `tag ${last.block >> 2} · slot ${last.slot} · word ${last.word}` : `tag ${last.block} · word ${last.word}`}</span>`
              : `<span class="small muted">The address fields appear here: ${mode === 'direct' ? '<b style="color:var(--warn)">tag</b> | <b style="color:var(--accent)">slot</b> | <b style="color:var(--mem)">word</b>. The slot field picks the only slot the block may use; the tag is compared with that slot’s tag' : '<b style="color:var(--warn)">tag</b> | <b style="color:var(--mem)">word</b> (no slot field)'}.</span>`;
            big.textContent = tot ? ctx.util.fmt((100 * cache.hits) / tot, 1) + '%' : '–';
            big.style.color = !tot ? 'var(--muted)' : cache.hits / tot >= 0.6 ? 'var(--ok)' : cache.hits / tot >= 0.3 ? 'var(--warn)' : 'var(--bad)';
            counts.innerHTML = `<b class="c-ok">${cache.hits} hits</b> · <b class="c-bad">${cache.misses} misses</b> · ${tot} reads`;
            meter.firstChild.style.width = (tot ? (100 * cache.hits) / tot : 0) + '%';
            const rem = P.refs.slice(pc), shown = hist.slice(-Math.max(0, 30 - rem.length));
            strip.replaceChildren(...shown.map((x) => h('span', { class: 'chip mono ' + (x.hit ? 'ok' : 'bad'), title: x.manual ? 'your click' : '', style: x.manual ? { outline: '2px dashed var(--line-2)' } : null }, String(x.a))),
              ...rem.map((a, k) => h('span', { class: 'chip mono', style: k === 0 ? { outline: '2px solid var(--accent)' } : { opacity: '.7' } }, String(a))));
            const progHist = hist.filter((x) => !x.manual), ph = progHist.filter((x) => x.hit).length;
            if (pc >= n) {
              note.className = 'callout why m0 small'; note.dataset.label = `Result: ${ph} / ${n} hits (${ctx.util.fmt((100 * ph) / n, 1)}%)`;
              note.innerHTML = (typeof P.after === 'string' ? P.after : P.after[mode]) +
                (hist.some((x) => x.manual) ? ' <i>(Your own clicks also changed the cache, so press Reset to see the program’s result on its own.)</i>' : '');
            } else {
              note.className = 'callout tip m0 small'; note.dataset.label = 'Predict first';
              note.innerHTML = `${P.what} How many of the ${n} reads will hit? Then press <b>Run all</b>.`;
            }
            bStep.disabled = pc >= n;
            bRun.textContent = timer ? 'Pause' : 'Run all';
            bRun.disabled = pc >= n && !timer;
          }
          function doAccess(a, manual) {
            last = cacheAccess(cache, a);
            hist.push({ a, hit: last.hit, manual });
            if (!manual) pc++;
            narrate(last);
            paint();
          }
          function stepOnce() { const refs = PROGRAMS[prog].refs; if (pc < refs.length) doAccess(refs[pc], false); if (pc >= refs.length) stop(); }
          function stop() { if (timer) { clearInterval(timer); timer = null; } if (cache) paint(); }
          function run() { stop(); timer = ctx.every(420, stepOnce); paint(); }
          function reset() {
            if (timer) { clearInterval(timer); timer = null; }
            cache = makeCache(mode); pc = 0; hist = []; last = null;
            narr.innerHTML = `<b>Empty cache.</b> <span class="muted">Press <b>Step</b> to issue the next read in the reference string, or click any word in memory to read it yourself. ${mode === 'direct' ? 'Direct mapping: each block has one fixed slot, so no choice is ever needed.' : 'Associative: any slot. When all four are full, the <span class="t">replacement algorithm</span> (here LRU) evicts the block whose “last used” time t (a count of reads) is oldest.'}</span>`;
            paint();
          }
          const bStep = h('button', { class: 'btn sm primary', onclick: () => { stop(); stepOnce(); } }, 'Step →');
          const bRun = h('button', { class: 'btn sm', onclick: () => (timer ? stop() : run()) }, 'Run all');
          const bReset = h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset');
          const segMode = ctx.ui.seg([{ value: 'direct', label: 'Direct-mapped' }, { value: 'assoc', label: 'Associative + LRU' }], mode, (v) => { mode = v; reset(); });
          const segProg = ctx.ui.seg(Object.entries(PROGRAMS).map(([k, p]) => ({ value: k, label: p.label })), prog, (v) => { prog = v; reset(); });
          reset();
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { gap: '10px' } }, segMode, segProg, h('div', { class: 'grow' }), bStep, bRun, bReset),
            h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : '272px minmax(0, 1fr) 300px', gap: '14px', flex: '1', minHeight: '0' } },
              h('div', { class: 'card white', style: { padding: '6px 6px 2px' } }, memSvg),
              h('div', { class: 'stack', style: { gap: '8px' } }, addrLine, h('div', { class: 'card white', style: { padding: '6px' } }, cSvg), narr),
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('div', { class: 'card tight stack', style: { gap: '4px' } }, h('h4', { class: 'm0', html: '<span class="t">Hit ratio</span> = hits ÷ reads' }), big, counts, meter),
                h('h4', { class: 'm0' }, 'Reference string'), strip, note))));
        },
      },
      /* ---------------------------------------------------------------- 6. Cache size and block size */
      {
        title: 'Design choices: cache size and block size',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          // A simulated program: walks array A, walks array B at half speed, reuses 2 locals and 12 scattered
          // objects, and makes an occasional random read. 2,400 loop iterations = 8,700 references.
          const rnd = ctx.util.seeded(5), trace = [];
          const hot = Array.from({ length: 12 }, () => 16384 + Math.floor(rnd() * 16384));
          for (let i = 0; i < 2400; i++) {
            trace.push(i, 12000 + (i % 2), hot[Math.floor(rnd() * 12)]);
            if (i % 2 === 0) trace.push(8192 + (i >> 1));
            if (i % 8 === 0) trace.push(16384 + Math.floor(rnd() * 16384));
          }
          function hitRatio(cap, B) {          // fully associative, LRU (a Map keeps blocks in recency order)
            const slots = cap / B, m = new Map(); let hits = 0;
            for (const a of trace) {
              const blk = Math.floor(a / B);
              if (m.has(blk)) { hits++; m.delete(blk); } else if (m.size >= slots) m.delete(m.keys().next().value);
              m.set(blk, 1);
            }
            return hits / trace.length;
          }
          const CAPS = [64, 128, 256, 512], BE = [0, 1, 2, 3, 4, 5, 6, 7];
          const data = {};
          for (const c of CAPS) data[c] = BE.filter((e) => 2 ** e <= c / 4).map((e) => hitRatio(c, 2 ** e));
          let cap = 256, be = 3;
          // the y axis starts at 40% (every curve stays above it) so the differences are easy to see
          const X = (e) => 70 + e * 70, Y = (v) => 272 - ((v - 0.4) / 0.6) * 250;
          const svg = s('svg', { viewBox: '0 0 600 320', width: '100%' });
          const grid = [];
          for (const v of [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) grid.push(s('line', { x1: 60, x2: 580, y1: Y(v), y2: Y(v), class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': v === 0.4 ? '' : '3 4' }), s('text', { x: 52, y: Y(v) + 5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, Math.round(v * 100) + '%'));
          for (const e of BE) grid.push(s('text', { x: X(e), y: 294, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(2 ** e)));
          grid.push(s('text', { x: 320, y: 315, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'Block size (words per block)'),
            s('text', { x: 14, y: 150, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, transform: 'rotate(-90 14 150)' }, 'Hit ratio'));
          const layer = s('g');
          svg.append(...grid, layer);
          const readout = h('div', { class: 'card tight' });
          const explain = h('div', { class: 'callout m0 small' });
          const strip = s('svg', { viewBox: '0 0 600 34', width: '100%' });
          function draw() {
            const kids = [];
            for (const c of CAPS) {
              const pts = data[c].map((v, e) => `${X(e)},${Y(v)}`).join(' ');
              const on = c === cap, lastE = data[c].length - 1;
              kids.push(s('polyline', { points: pts, fill: 'none', 'stroke-width': on ? 3.5 : 1.5, style: on ? 'stroke:var(--accent)' : 'stroke:var(--line-2)' }));
              kids.push(s('text', { x: X(lastE), y: Y(data[c][lastE]) + 20, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': on ? 800 : 600, class: on ? 'tx-acc' : 's-sub' }, c + ' w'));
            }
            const v = data[cap][be], peakE = data[cap].indexOf(Math.max(...data[cap]));
            kids.push(s('line', { x1: X(be), x2: X(be), y1: Y(0.4), y2: Y(v), style: 'stroke:var(--accent)', 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }),
              s('circle', { cx: X(be), cy: Y(v), r: 7, class: 's-cache', 'stroke-width': 3 }),
              s('text', { x: X(be), y: Y(v) - 14, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 'tx-acc' }, ctx.util.fmt(v * 100, 1) + '%'));
            layer.replaceChildren(...kids);
            const B = 2 ** be, slots = cap / B;
            readout.innerHTML = `<div class="row" style="gap:14px"><span class="big c-acc" style="font-size:34px">${ctx.util.fmt(v * 100, 1)}%</span><span class="small">${cap}-word cache ÷ ${B}-word blocks<br>= <b>${slots} slots</b></span></div>`;
            const sk = [s('rect', { x: 1, y: 4, width: 598, height: 26, rx: 6, class: 's-cache', 'stroke-width': 1.5 })];
            if (slots <= 128) for (let k = 1; k < slots; k++) sk.push(s('line', { x1: 1 + (598 * k) / slots, x2: 1 + (598 * k) / slots, y1: 4, y2: 30, style: 'stroke:var(--accent)', 'stroke-width': slots > 64 ? 0.8 : 1.5 }));
            strip.replaceChildren(...sk);
            if (be < peakE) {
              explain.className = 'callout tip m0 small'; explain.dataset.label = 'Rising: bigger blocks help';
              explain.innerHTML = B === 1
                ? 'With 1-word blocks a miss brings in only the word asked for, so every step of an array walk misses again. Double the block size and watch the neighbours start to hit.'
                : `Each miss now brings in a block of ${B} words. The array walks read those neighbours next, so they hit: <b>spatial locality</b> pays off. Try doubling the block size again.`;
            } else if (be === peakE) {
              explain.className = 'callout why m0 small'; explain.dataset.label = 'The sweet spot';
              explain.innerHTML = `For a ${cap}-word cache, ${B}-word blocks are best for this program: big enough to catch the array walks, while ${slots} slots still leave room for everything it keeps reusing.`;
            } else {
              explain.className = 'callout warn m0 small'; explain.dataset.label = 'Falling: blocks too big';
              explain.innerHTML = `Only ${slots} slots now. The two arrays, the locals and the dozen scattered objects each need a slot of their own, so they start evicting one another, and every big block drags in words that will never be used.`;
            }
          }
          const slider = ctx.ui.slider({ label: 'Block size', min: 0, max: 6, value: be, format: (e) => 2 ** e + ' words', onInput: (e) => { be = e; draw(); } });
          const seg = ctx.ui.seg(CAPS.map((c) => ({ value: c, label: c + ' words' })), cap, (c) => {
            cap = c; const mx = data[c].length - 1; slider.input.max = mx; if (be > mx) { be = mx; slider.set(be); } draw();
          });
          draw();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Designers must pick the <b>cache size</b> and the <b>block size</b>. This chart is computed live from a simulated program (8,700 memory references), not drawn by hand. Move the controls.' }),
              h('div', { class: 'stack gap-s' }, h('div', { class: 'xs b muted' }, 'CACHE SIZE'), seg), slider, readout, explain,
              h('div', { class: 'callout why m0 small', 'data-label': 'Cache size', html: `Even the smallest cache here, at its best block size, turns about three of every four references into hits. Each doubling adds less (best: ${CAPS.map((c) => Math.round(100 * Math.max(...data[c])) + '%').join(' → ')}). Bigger caches also cost more and respond more slowly, so fast caches stay small.` })),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),
              h('div', { class: 'xs b muted' }, 'THE SAME CACHE, CUT INTO SLOTS'), strip,
              h('p', { class: 'xs muted m0', html: 'The program walks two arrays in order, reuses two local variables and a dozen objects scattered across memory, and sometimes reads a random location. Fully associative cache with LRU replacement; each block size keeps at least 4 slots. The hit-ratio axis starts at 40%. Real programs differ in detail, but the rise-then-fall shape is typical.' }))));
        },
      },
      /* ---------------------------------------------------------------- 7. Write policy */
      {
        title: 'Write policy: write-through vs write-back',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const F = [
            { cap: '<b>Start.</b> The program has already read variable x, so x’s block sits in a cache slot. Cache and main memory agree: x = 10. Now a loop starts updating x. The <span class="t">write policy</span> decides when main memory hears about each change.' },
            { op: 11, cap: '<b>Store x = 11.</b> <span class="t">Write-through</span> updates the cache <b>and</b> main memory. <span class="t">Write-back</span> updates only the cache and sets the slot’s <span class="t">dirty bit</span>; main memory still says 10.' },
            { op: 12, cap: '<b>Store x = 12.</b> Another store, another memory write for write-through (2 so far). Write-back has still made none.' },
            { op: 13, cap: '<b>Store x = 13.</b> Write-through: 3 memory writes. Write-back: 0, but main memory is now three updates behind.' },
            { dma: 1, cap: '<b>An I/O module reads x straight from main memory</b>, without going through the processor or its cache (this is direct memory access, DMA, covered in 1.7). Write-through hands it 13: correct. Write-back hands it <b>10, a stale value</b>. Hardware or the OS must prevent this, for example by writing dirty blocks back first.' },
            { op: 14, cap: '<b>Store x = 14.</b> Write-through: 4 memory writes. Write-back: still 0.' },
            { evict: 1, cap: '<b>The block is evicted</b> to make room. Write-through has nothing left to do. Write-back sees the dirty bit and copies the block to memory <b>once</b>. Totals: 4 writes vs 1. A loop of 1,000 updates would cost 1,000 vs 1.' },
          ];
          function stateAt(i) {
            const st = { wt: { c: 10, m: 10, n: 0, w: false, got: null }, wb: { c: 10, m: 10, n: 0, w: false, d: 0, got: null }, op: null, dma: false, evict: false };
            for (let k = 1; k <= i; k++) {
              const f = F[k], now = k === i;
              st.wt.w = st.wb.w = false; st.wt.got = st.wb.got = null;
              if (f.op != null) { st.wt.c = st.wt.m = f.op; st.wt.n++; st.wt.w = now; st.wb.c = f.op; st.wb.d = 1; }
              if (f.dma) { st.wt.got = st.wt.m; st.wb.got = st.wb.m; }
              if (f.evict) { if (st.wb.d) { st.wb.m = st.wb.c; st.wb.n++; st.wb.w = true; st.wb.d = 0; } st.wt.c = st.wb.c = null; }
              if (now) { st.op = f.op ?? null; st.dma = !!f.dma; st.evict = !!f.evict; }
            }
            return st;
          }
          function panel(kind) {
            const svg = s('svg', { viewBox: '0 0 540 200', width: '100%' });
            return { svg, draw(st) {
              const p = st[kind], stale = p.c != null && p.m !== p.c;
              const kids = [
                s('rect', { x: 6, y: 46, width: 104, height: 60, rx: 10, class: 's-cpu', 'stroke-width': 2 }),
                s('text', { x: 58, y: 81, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'Processor'),
                s('line', { x1: 112, y1: 76, x2: 164, y2: 76, 'marker-end': st.op != null ? 'url(#arr-cpu)' : 'url(#arr-muted)', class: st.op != null ? 's-line' : 's-muted', style: st.op != null ? 'stroke:var(--cpu)' : '' }),
                s('text', { x: 138, y: 66, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-cpu' }, st.op != null ? 'x=' + st.op : ''),
                s('rect', { x: 168, y: 30, width: 160, height: 92, rx: 12, class: 's-cache', 'stroke-width': 2 }),
                s('text', { x: 248, y: 50, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, class: 'tx-acc' }, 'Cache slot'),
                s('text', { x: 248, y: 84, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': p.c != null ? 26 : 16, class: p.c != null ? 's-monot' : 's-sub' }, p.c != null ? 'x = ' + p.c : '(block evicted)'),
                s('line', { x1: 330, y1: 76, x2: 380, y2: 76, 'marker-end': p.w ? 'url(#arr-mem)' : 'url(#arr-muted)', class: p.w ? 's-line' : 's-muted', style: p.w ? 'stroke:var(--mem);stroke-width:4' : '' }),
                s('text', { x: 355, y: 66, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-mem' }, p.w ? 'write' : ''),
                s('rect', { x: 384, y: 30, width: 150, height: 92, rx: 12, class: stale ? 's-bad' : 's-mem', 'stroke-width': 2 }),
                s('text', { x: 459, y: 50, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 }, 'Main memory'),
                s('text', { x: 459, y: 84, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 26, class: 's-monot' }, 'x = ' + p.m),
                s('text', { x: 459, y: 110, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, class: stale ? 'tx-bad' : 'tx-ok' }, stale ? 'STALE (out of date)' : 'up to date'),
                s('text', { x: 8, y: 156, 'font-size': 14, 'font-weight': 700 }, 'Memory writes so far'),
                s('text', { x: 8, y: 190, 'font-size': 32, 'font-weight': 800, style: 'fill:var(--' + (kind === 'wt' ? 'warn' : 'ok') + ')' }, String(p.n)),
              ];
              if (kind === 'wb') kids.push(s('rect', { x: 206, y: 96, width: 84, height: 20, rx: 6, fill: 'var(--panel)', 'stroke-width': 1.5, style: 'stroke:var(--' + (p.d ? 'warn' : 'line-2') + ')' }),
                s('text', { x: 248, y: 111, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--' + (p.d ? 'warn' : 'muted') + ')' }, 'dirty = ' + p.d));
              if (p.got != null) {
                const ok = p.got === (p.c ?? p.m);   // newest x lives in the cache, or in memory once evicted
                kids.push(s('line', { x1: 459, y1: 124, x2: 459, y2: 150, class: 's-line', 'marker-end': 'url(#arr-io)', style: 'stroke:var(--io)' }),
                  s('rect', { x: 296, y: 154, width: 238, height: 40, rx: 9, class: 's-io', 'stroke-width': 2 }),
                  s('text', { x: 415, y: 179, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: ok ? 'tx-ok' : 'tx-bad' }, `I/O (DMA) reads x = ${p.got} ${ok ? '✓' : '✗ stale'}`));
              }
              svg.replaceChildren(...kids);
            } };
          }
          const A = panel('wt'), B = panel('wb');
          const drawBoth = (st) => { A.draw(st); B.draw(st); };
          const player = ctx.ui.player({ count: F.length, interval: 2600, speed: false, render: (i) => { drawBoth(stateAt(i)); return F[i].cap; } });
          const playerCtl = player.el.querySelector('.player-ctl');
          // "Your turn": the student chooses the events; both policies react to the same sequence
          let ms, val;
          const manCap = h('div', { class: 'player-cap', 'aria-live': 'polite' });
          const bStore = h('button', { class: 'btn sm primary', onclick: () => act('store') }, 'Store x = x + 1');
          const bDma = h('button', { class: 'btn sm io', onclick: () => act('dma') }, 'I/O module reads x');
          const bEvict = h('button', { class: 'btn sm', onclick: () => act('evict') }, 'Evict the block');
          const manCtl = h('div', { class: 'player-ctl' }, bStore, bDma, bEvict, h('button', { class: 'btn sm ghost', onclick: () => manReset() }, 'Start over'), h('div', { class: 'grow' }));
          const manEl = h('div', { class: 'player', style: { display: 'none' } }, manCap, manCtl);
          function manReset() {
            ms = { wt: { c: 10, m: 10, n: 0, w: false, got: null }, wb: { c: 10, m: 10, n: 0, w: false, d: 0, got: null }, op: null };
            val = 10; bEvict.disabled = false; drawBoth(ms);
            manCap.innerHTML = '<b>Your turn.</b> x = 10 is cached and memory agrees. Pick events in any order and predict both write counters before each click. Try several stores, then let the I/O module read x.';
          }
          function act(k) {
            const st = ms; let cap;
            st.wt.w = st.wb.w = false; st.wt.got = st.wb.got = null; st.op = null;
            if (k === 'store') {
              const miss = st.wt.c == null; val++;
              st.wt.c = st.wt.m = val; st.wt.n++; st.wt.w = true;     // write-through: cache and memory
              st.wb.c = val; st.wb.d = 1; st.op = val;                 // write-back: cache only, mark dirty
              cap = `<b>Store x = ${val}.</b> ` + (miss ? 'The block had been evicted, so it is first read back into a slot (a miss). ' : '') +
                `Write-through also writes memory (write number ${st.wt.n}). Write-back changes only the cache and sets the dirty bit; memory still says ${st.wb.m}.`;
            } else if (k === 'dma') {
              st.wt.got = st.wt.m; st.wb.got = st.wb.m;
              cap = `<b>An I/O module reads x from main memory</b>, bypassing the cache. Write-through hands it ${st.wt.m}: correct. ` +
                (st.wb.m !== val ? `Write-back hands it <b>${st.wb.m}, a stale value</b>: the newest x (${val}) is still only in the cache.` : `Write-back hands it ${st.wb.m}, also correct: no newer value is waiting in the cache.`);
            } else {
              const dirty = st.wb.d === 1;
              if (dirty) { st.wb.m = st.wb.c; st.wb.n++; st.wb.w = true; st.wb.d = 0; }
              st.wt.c = st.wb.c = null;
              cap = '<b>The block is evicted.</b> Write-through has nothing to do: memory is already current. ' +
                (dirty ? `Write-back sees the dirty bit and copies the block to memory once (write number ${st.wb.n}).` : 'Write-back’s dirty bit is 0, so the block is simply dropped with no memory write.');
            }
            bEvict.disabled = st.wt.c == null;
            drawBoth(st);
            manCap.innerHTML = cap + ` <span class="muted">Memory writes so far: ${st.wt.n} vs ${st.wb.n}.</span>`;
          }
          const modeSeg = ctx.ui.seg([{ value: 'tour', label: 'Guided tour' }, { value: 'you', label: 'Your turn' }], 'tour', (v) => {
            const you = v === 'you';
            player.stop();
            player.el.style.display = you ? 'none' : '';
            manEl.style.display = you ? '' : 'none';
            (you ? manCtl : playerCtl).append(modeSeg);
            if (you) manReset(); else player.refresh();
          });
          playerCtl.append(modeSeg);
          const card = (title, cls, p, pros) => h('div', { class: 'card white stack', style: { gap: '4px', padding: '8px 12px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', style: { fontSize: '18px' } }, title), h('span', { class: 'chip ' + cls }, cls === 'warn' ? 'simple, safe' : 'fast, fewer writes')), p.svg,
            h('div', { class: 'xs', style: { lineHeight: '1.45' }, html: pros }));
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'grid-2' },
              card('Write-through', 'warn', A, '<b class="c-ok">+</b> Main memory is always current, so an I/O module reading memory never gets stale data.<br><b class="c-bad">−</b> Every store becomes a memory write: heavy memory traffic that can become a bottleneck.'),
              card('Write-back', 'ok', B, '<b class="c-ok">+</b> Memory is written only when a dirty block is evicted, so repeated stores cost one write.<br><b class="c-bad">−</b> Memory can be stale, so I/O that reads it directly needs care; more complex circuitry.')),
            player.el, manEl,
            h('div', { class: 'grid-2' },
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Write-back does <b>not</b> lose data. The newest value is safe in the cache; it simply reaches main memory later, when its block is evicted (or flushed on purpose).' }),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'With several processors, each cache may hold its own copy of x. Even under write-through, another processor’s cache can keep an old copy, so hardware must update or invalidate it (cache coherence, 1.8).' }))));
        },
      },
      /* ---------------------------------------------------------------- 8. Cache levels */
      {
        title: 'More than one level: L1, L2 and L3',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const LV = [
            { k: 'L1', cyc: 4, ns: 'about 1 ns', say: 'The level-1 data cache inside the core had it: the fastest case, and the most common one.' },
            { k: 'L2', cyc: 12, ns: 'about 3 ns', say: 'L1 missed, so the core’s private L2 answered. Still inside the core, still quick.' },
            { k: 'L3', cyc: 40, ns: 'about 10 ns', say: 'L1 and L2 missed, so the shared L3 answered. Slower: it is big and shared by every core.' },
            { k: 'Main memory', cyc: 200, ns: '50 ns or more', say: 'All three caches missed, so the core may sit idle for hundreds of cycles.' },
          ];
          const svg = s('svg', { viewBox: '0 0 540 272', width: '100%' });
          const box = (x, y, w, hh, cls, lines, fs = 14) => {
            const r = s('rect', { x, y, width: w, height: hh, rx: 9, class: cls, 'stroke-width': 1.5 });
            return { r, g: s('g', {}, r, mtext(s, x + w / 2, y + hh / 2 + 5 - (lines.length - 1) * 8, lines, { 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 700 }, 16)) };
          };
          const parts = [];
          const core = (ox, dim) => {
            const c = { frame: s('rect', { x: ox, y: 4, width: 252, height: 132, rx: 12, fill: 'none', 'stroke-width': 1.5, style: 'stroke:var(--line-2)', 'stroke-dasharray': '5 4' }) };
            c.title = s('text', { x: ox + 12, y: 22, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, dim ? 'Core 1' : 'Core 0 (asking)');
            c.cpu = box(ox + 12, 30, 76, 40, 's-cpu', ['CPU']);
            c.l1d = box(ox + 110, 30, 64, 40, 's-cache', ['L1-D', '32 KB'], 12.5);
            c.l1i = box(ox + 180, 30, 62, 40, 's-cache', ['L1-I', '32 KB'], 12.5);
            c.l2 = box(ox + 12, 84, 230, 44, 's-cache', ['L2 (private)', 'e.g. 1 MB'], 13.5);
            const g = s('g', { style: dim ? 'opacity:.45' : '' }, c.frame, c.title, c.cpu.g, c.l1i.g, c.l1d.g, c.l2.g);
            parts.push(g);
            return c;
          };
          const c0 = core(8, false); core(280, true);
          const l3 = box(8, 150, 524, 42, 's-cache', ['L3: shared by every core (e.g. 16 MB)'], 14.5);
          const mem = box(8, 208, 524, 44, 's-mem', ['Main memory (e.g. 16 GB)'], 14.5);
          const arr = [
            s('path', { d: 'M96,50 H116', fill: 'none' }),
            s('path', { d: 'M150,70 V82', fill: 'none' }),
            s('path', { d: 'M127,128 V148', fill: 'none' }),
            s('path', { d: 'M127,192 V206', fill: 'none' }),
          ];
          svg.append(...parts, l3.g, mem.g, ...arr,
            s('text', { x: 532, y: 268, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'Sizes and times are rough figures for a typical desktop processor.'));
          const cap = h('div', { class: 'card tight small', style: { minHeight: '64px', flex: 'none' } });
          const targets = [c0.l1d, c0.l2, l3, mem];
          function showLevel(i) {
            targets.forEach((t, k) => { t.r.setAttribute('class', k < i ? 's-warn' : k === i ? 's-ok' : (k === 3 ? 's-mem' : 's-cache')); t.r.setAttribute('stroke-width', k <= i ? 3 : 1.5); t.g.style.opacity = k > i ? '0.5' : ''; });
            arr.forEach((a, k) => { const on = k <= i; a.setAttribute('class', on ? 's-line' : 's-muted'); a.style.stroke = on ? (k === i ? 'var(--ok)' : 'var(--warn)') : ''; a.setAttribute('marker-end', on ? (k === i ? 'url(#arr-ok)' : 'url(#arr-warn)') : 'url(#arr-muted)'); });
            const L = LV[i];
            cap.innerHTML = `<b>Found in ${L.k}: ≈ ${L.cyc} cycles (${L.ns}).</b> ${L.say}`;
          }
          const seg = ctx.ui.seg(LV.map((L, i) => ({ value: i, label: L.k })), 0, showLevel);
          showLevel(0);
          // average access time with 1, 2 or 3 levels (time = cycles to get the word from the level where it is found)
          const bars = h('div', { class: 'stack', style: { gap: '6px' } });
          function avg(h1, n) {
            const beyondL3 = 0.75 * 40 + 0.25 * 200, beyondL2 = n >= 3 ? 0.8 * 12 + 0.2 * beyondL3 : 0.8 * 12 + 0.2 * 200;
            return h1 * 4 + (1 - h1) * (n === 1 ? 200 : beyondL2);
          }
          let h1 = 0.9;
          function drawBars() {
            const vals = [1, 2, 3].map((n) => avg(h1, n)), mx = avg(0.8, 1);
            bars.replaceChildren(...['L1 only', 'L1 + L2', 'L1 + L2 + L3'].map((lab, k) => h('div', { style: { display: 'grid', gridTemplateColumns: '104px 1fr 92px', alignItems: 'center', gap: '8px' } },
              h('span', { class: 'small b' }, lab),
              h('div', { class: 'meter', style: { height: '14px' } }, h('i', { style: { width: (100 * vals[k]) / mx + '%', background: k === 0 ? 'var(--bad)' : k === 1 ? 'var(--warn)' : 'var(--ok)' } })),
              h('span', { class: 'mono b small', style: { textAlign: 'right' } }, vals[k].toFixed(1) + ' cyc'))));
            const hp = Math.round(h1 * 100);
            const hitPart = h1 * 4, missPart = (1 - h1) * 200;
            insight.innerHTML = `<b class="c-bad">L1 alone:</b> the ${hp}% of hits add ${ctx.util.fmt(hitPart, 2)} cycles to the average, the ${100 - hp}% of misses add <b>${ctx.util.fmt(missPart, 2)}</b>. ` +
              (missPart >= 2 * hitPart ? 'Rare misses dominate, so extra levels pay off.' : 'Even these few misses cost more than all the hits combined.');
          }
          const insight = h('p', { class: 'small m0', style: { lineHeight: '1.4' } });
          const sl = ctx.ui.slider({ label: 'L1 hit ratio', min: 80, max: 98, value: 90, format: (v) => v + '%', onInput: (v) => { h1 = v / 100; drawBars(); } });
          drawBars();
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'One cache cannot be both big and very fast: a bigger memory has longer wires and more circuitry to select a word, so it takes longer to access. So designers stack a <span class="t">multilevel cache</span>, each level larger and slower than the one above.' }),
              h('ul', { class: 'm0 small', style: { lineHeight: '1.5' }, html: '<li><b>L1</b>: tiny and fastest, inside each core, usually split into an instruction cache (L1-I) and a data cache (L1-D).</li><li><b>L2</b>: larger and a little slower, usually private to each core.</li><li><b>L3</b>: several megabytes, shared by all cores on the chip.</li><li>A miss at one level is looked up in the next; only a miss in every level goes to main memory.</li>' }),
              h('div', { class: 'card stack', style: { gap: '8px', padding: '10px 12px', flex: 'none' } },
                h('h4', { class: 'm0' }, 'Average time per access'), sl, bars,
                h('p', { class: 'xs muted m0', html: 'Each access costs the total time to get the word from the level where it is found (4, 12, 40 or 200 cycles). Assumes L2 catches 80% of L1’s misses and L3 catches 75% of the rest.' }), insight)),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Where is the word found?'), seg),
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), cap,
              h('div', { class: 'callout why m0 small', 'data-label': 'Where the OS feels it', html: 'After the OS switches to another process, the caches are still full of the old one’s blocks, so the new process starts with a burst of misses: a hidden cost of switching often.' }))));
        },
      },
      /* ---------------------------------------------------------------- 9. Recap */
      {
        title: 'Recap: eight ideas to carry away',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const issues = ['Cache size', 'Block size', 'Mapping function', 'Replacement algorithm', 'Write policy', 'Number of levels'];
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'The six design decisions:'), ...issues.map((t) => h('span', { class: 'chip accent' }, t))),
            h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer out loud before you flip the card. Click a card again to flip it back.'),
              h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),
            ctx.ui.flipcards([
              ['Why do caches exist?', 'Processors outran memory, and every instruction needs at least one memory access (its fetch). A small fast memory holding recently used blocks answers most accesses, thanks to locality.'],
              ['Blocks, slots, tags', '<div>Memory: M = 2<sup>n</sup>/K blocks of K words. Cache: C slots (C ≪ M), each holding one block plus a tag that names the block.</div>'],
              ['Hit vs miss', 'Hit: the word comes straight from the cache. Miss: the whole block containing it is read into a slot and the word is delivered.'],
              ['Mapping function', 'Direct: slot = block mod C (cheap, but rivals evict each other). Associative: any slot (flexible, compare every tag). Set-associative sits between.'],
              ['Replacement (LRU)', 'When a new block must come in and there is a choice of slot, evict the block that has gone unused the longest. Direct mapping never has a choice.'],
              ['Cache size and block size', 'Size: even a small cache helps a lot; each doubling helps less, and bigger is slower. Block size: the hit ratio first rises (neighbours get used), then falls (too few, too large blocks push out data still in use).'],
              ['Write-through vs write-back', 'Through: memory updated on every write (always current, heavy traffic). Back: written only when a dirty block is evicted (fewer writes, memory can be stale).'],
              ['L1, L2, L3', 'L1 tiny and fastest (per core, split into I and D), L2 larger, L3 shared by all cores. Each level catches misses before they reach main memory.'],
            ], { cols: 4, height: 206 })));
        },
      },
      /* ---------------------------------------------------------------- 10. Check yourself */
      {
        title: 'Check yourself: cache memory',
        kind: 'check',
        quiz: [
          { q: 'Why does the speed of main memory limit how fast a processor can run, even for a program that touches very little data?',
            choices: ['Every instruction must itself be fetched from memory before it can run.', 'The processor must copy the whole program into the cache before starting it.', 'The operating system checks main memory after every instruction.', 'The processor’s registers are stored in main memory.'],
            answer: 0,
            feedback: [null, 'Caches load blocks on demand, when a miss happens; nothing copies the whole program in advance.', 'The OS does not inspect memory after each instruction; the instruction cycle is run by hardware.', 'Registers are inside the processor; that is exactly why they are fast.'],
            why: 'Each instruction cycle starts with an instruction fetch, which is a memory access. So even data-light code needs at least one memory access per instruction, and a slow memory would stall the processor constantly.' },
          { type: 'tf', q: 'The operating system decides which blocks of main memory are copied into the cache.', answer: false,
            why: 'Hardware loads blocks on a miss and picks which ones to replace, with no OS involvement. The OS shapes cache performance indirectly (for example through how often it switches processes), and occasionally it performs explicit cache maintenance, such as flushing or invalidating lines around a DMA transfer or when it changes memory mappings, but it never chooses which blocks are copied in.' },
          { type: 'num', q: 'A memory has 16-bit addresses, so it holds 2<sup>16</sup> words, and it is divided into blocks of K = 8 words. How many blocks M does it contain?', answer: 8192, tol: 0, unit: 'blocks',
            why: 'M = 2<sup>n</sup> / K = 65,536 / 8 = 8,192 blocks.' },
          { type: 'order', q: 'Put the steps of a cache read that turns out to be a miss in order.',
            items: ['The processor issues read address RA', 'The cache checks the tags and finds the block containing RA is not present', 'The block containing RA is read from main memory', 'A cache slot is allocated for the block, evicting one if necessary', 'The block is loaded into the slot and the word is delivered to the processor'],
            why: 'Receive the address, check for a hit, and on a miss fetch the whole block, find it a slot, then store it while passing the wanted word to the processor (those last two happen together).' },
          { type: 'num', q: 'A direct-mapped cache has C = 128 slots. Which slot can main-memory block number 1000 be stored in?', answer: 104, tol: 0,
            why: 'Direct mapping uses slot = block mod C. 1000 = 7 × 128 + 104, so the block can only go in slot 104.' },
          { type: 'num', q: 'A direct-mapped cache is used with 16-bit addresses, blocks of 4 words and 64 slots. How many bits long is the tag field?', answer: 8, tol: 0, unit: 'bits',
            why: '4 words per block need a 2-bit word field; 64 slots need a 6-bit slot field. The tag is what is left: 16 − 2 − 6 = 8 bits.' },
          { type: 'num', q: 'A processor has an L1 cache and an L2 cache. Getting a word takes 4 cycles when it is found in L1, 12 cycles when it is found in L2, and 200 cycles when it must come from main memory. 95% of accesses hit in L1, and L2 catches 80% of the accesses that miss in L1. What is the average number of cycles per access?', answer: 6.28, tol: 0.05, unit: 'cycles',
            why: 'Weight each time by how often it happens: 0.95 × 4 + 0.05 × (0.8 × 12 + 0.2 × 200) = 3.8 + 0.05 × 49.6 = 3.8 + 2.48 = 6.28 cycles. Without the L2 it would be 0.95 × 4 + 0.05 × 200 = 13.8 cycles, so the second level more than halves the average.' },
          { type: 'multi', q: 'Compared with direct mapping, which statements about associative (fully associative) mapping are true?',
            choices: ['A block can be placed in any slot.', 'The address’s tag must be compared with the tags of all slots.', 'A replacement algorithm such as LRU is needed to choose a victim when the cache is full.', 'Two busy blocks can keep evicting each other while other slots sit empty.', 'It needs fewer tag comparisons per access.', 'Its tag field is shorter.'],
            answer: [0, 1, 2],
            why: 'Freedom to use any slot means the hardware must search every slot at once and must choose a victim when all are full. Two blocks fighting over one slot while others sit empty is the weakness of direct mapping (for example, with 4 slots blocks 3 and 7 both map to slot 3); associative mapping avoids it. Its tag is the whole block number, so it is longer, not shorter.' },
          { q: 'The cache size stays fixed while the block size grows from 1 word to very large blocks. What typically happens to the hit ratio?',
            choices: ['It rises at first, then falls.', 'It rises steadily, because each miss brings in more neighbouring words.', 'It falls steadily, because each miss takes longer to service.', 'It stays the same, because the cache holds the same number of words.'],
            answer: 0,
            feedback: [null, 'It rises only up to a point: beyond it the cache holds too few blocks and throws out data that is still being reused.', 'Small increases help at first thanks to spatial locality, so the ratio does not fall from the start.', 'The number of words is the same, but how they are grouped into blocks changes what stays in the cache.'],
            why: 'Bigger blocks exploit spatial locality, so hits increase at first. Past a sweet spot, fewer, larger blocks mean useful data is evicted and much of each block is never used, so the hit ratio drops.' },
          { type: 'bucket', q: 'Sort each property under the write policy it describes.', buckets: ['Write-through', 'Write-back'],
            items: [['Main memory is updated on every write', 0], ['Uses a dirty bit to remember which slots changed', 1], ['A loop that stores to one variable 1,000 times causes about 1,000 memory writes', 0], ['Main memory can hold stale data for a while', 1], ['A changed block is copied to memory when it is evicted', 1], ['An I/O module reading main memory always sees the newest value', 0]],
            why: 'Write-through keeps memory current at the price of a memory write per store. Write-back saves traffic by writing a block only when a dirty one is evicted, so memory may lag behind the cache.' },
          { type: 'match', q: 'Match each cache design issue to the question it answers.',
            pairs: [['Mapping function', 'Which slot or slots may this block occupy?'], ['Replacement algorithm', 'Which block should be thrown out to make room?'], ['Write policy', 'When does main memory get updated after a store?'], ['Block size', 'How many words move on each miss?'], ['Number of levels', 'How many caches sit between the processor and main memory?']],
            why: 'Together with cache size, these are the design decisions every cache designer must make.' },
          { q: 'A 4-slot associative cache uses LRU replacement. It holds blocks A, B, C and D, last used at times 5, 9, 2 and 7. Block E is now needed. Which block is evicted?',
            choices: ['A', 'B', 'C', 'D'], answer: 2,
            feedback: ['A was used at time 5, more recently than C.', 'B was used most recently (time 9); LRU keeps it.', null, 'D was used at time 7, more recently than C.'],
            why: 'Least recently used means the block with the oldest last-use time: C, last used at time 2. LRU bets that the block idle the longest is the least likely to be needed soon.' },
        ],
      },
    ],
    notes: `
<h3>Why a cache is needed</h3>
<p>Processor speed has grown much faster than memory speed: a simple instruction can run in about a nanosecond, while a main-memory access takes 50–100 nanoseconds, roughly a hundred times longer. Every instruction cycle touches memory at least once, because the instruction itself must be fetched, so memory speed caps processor speed.</p>
<p>A <b>cache</b> is a small, very fast memory between the processor and main memory that holds <b>copies</b> of the parts of main memory in current use. It works because of <b>locality of reference</b>: programs soon reuse locations they just used (temporal locality) and use locations near them (spatial locality). The hardware normally handles cache fills and replacement by itself, without help from programs or the operating system. The OS affects the cache mostly indirectly: after a process switch the cache is full of the old process’s blocks, so the new one starts with a burst of misses. The OS does occasionally perform explicit <b>cache maintenance</b>, for example flushing (writing back) or invalidating lines around a DMA transfer, or when it changes memory mappings, but it never decides which blocks are copied in.</p>
<p>Processor and cache exchange single <b>words</b> (fast); cache and main memory exchange whole <b>blocks</b> (slower, but the neighbouring words are likely to be used soon).</p>

<h3>Organization: blocks, slots and tags</h3>
<ul>
<li>Main memory has <b>2<sup>n</sup></b> addressable words (n-bit addresses), divided into fixed-length <b>blocks</b> of <b>K</b> words, so there are <b>M = 2<sup>n</sup> / K</b> blocks.</li>
<li>The cache has <b>C slots</b> (also called <b>lines</b>). Each holds one block of K words plus a <b>tag</b> identifying which block it holds.</li>
<li><b>C ≪ M</b>, so many blocks take turns in each slot; the tag is the only record of which one is there now.</li>
</ul>
<p><b>Example.</b> n = 16, K = 4: 2<sup>16</sup> = 65,536 words and M = 65,536 / 4 = 16,384 blocks. At real scale (every byte has an address), 16 GB in 64-byte blocks is about 268 million blocks, while a 32 KB level-1 cache has 512 slots.</p>

<h3>The cache read operation</h3>
<ol>
<li>The processor generates a read address <b>RA</b>.</li>
<li>The cache checks (by comparing tags) whether the block containing RA is present.</li>
<li><b>Hit:</b> fetch the word from its slot and deliver it to the processor; main memory is not touched.</li>
<li><b>Miss:</b> read the block containing RA from main memory; allocate a slot for it (evicting a block if necessary); load the block into the slot and deliver the word to the processor, these last two at the same time.</li>
</ol>
<p>The <b>hit ratio</b> is hits ÷ total accesses, e.g. 340 hits in 400 accesses = 85%.</p>

<h3>Mapping function</h3>
<p>The mapping function decides which slot(s) a block may occupy, and so how the cache splits an address into fields.</p>
<p><b>Direct mapping:</b> each block has exactly one slot: <b>slot = block number mod C</b>. The address splits (high bits to low) into <b>tag | slot | word</b>: the word field has log<sub>2</sub>K bits, the slot field log<sub>2</sub>C bits, and the tag the remaining n − log<sub>2</sub>C − log<sub>2</sub>K bits. In block terms: slot = block mod C and tag = block ÷ C (whole part); the tag tells apart the blocks that share a slot. Only one tag is compared: simple, cheap, fast. Drawback: two busy blocks that map to the same slot keep evicting each other even while other slots are empty.</p>
<p><b>Examples.</b> (a) 64 words, 4-word blocks, 4 slots: address 37 = 100101 → tag 10, slot 01, word 01 (word 1 of block 9; slot 9 mod 4 = 1; tag 9 ÷ 4 = 2, remainder dropped). (b) 20-bit addresses, 8-word blocks, 128 slots: word 3 bits, slot 7 bits, tag 20 − 3 − 7 = 10 bits. (c) With C = 64, block 200 goes to slot 200 mod 64 = 8. (d) With 8 slots, blocks 5 and 13 both map to slot 5, so alternating between them misses every time.</p>
<p><b>Associative (fully associative) mapping:</b> a block may go into <b>any</b> slot. The address splits into <b>tag | word</b>; the tag is the whole block number, so it is longer than a direct-mapped tag. The hardware must compare it with every slot’s tag at once (one comparator per slot, more complex and costly), and a replacement algorithm must choose a victim when the cache is full. In return, no block is evicted while a slot is free. <b>Set-associative mapping</b>, used by most real caches, is the compromise: a block maps to one small set of slots and may use any slot in that set.</p>
<h3>Replacement algorithm</h3>
<p>When a block must be loaded and there is a choice of slot, the replacement algorithm picks the victim (direct mapping has no choice). The usual one is <b>least recently used (LRU)</b>: evict the block unused the longest, betting it is least likely to be needed soon. Example: blocks P, Q, R, S last used at times 8, 3, 6, 4: LRU evicts Q.</p>

<p><b>Locality in the simulator</b> (4 slots, 4-word blocks): an array walk hits 12 of 16 reads (spatial locality); a loop run 3 times, 22 of 24 (temporal locality); random reads, 3 of 16; alternating blocks 0 and 4, 0 of 12 direct-mapped (both need slot 0), 10 of 12 associative.</p>

<h3>Cache size and block size</h3>
<p><b>Cache size:</b> even a small cache has a large effect, and each further doubling helps less. Larger caches also cost more and are slower, so the fastest caches stay small. (Simulated program: best hit ratio 76% at 64 words, 94% at 512.)</p>
<p><b>Block size:</b> as blocks grow, the hit ratio <b>first rises</b>, because each miss brings in neighbouring words that are soon used (spatial locality), <b>then falls</b>: with the cache size fixed there are fewer, larger blocks, so data still being reused gets evicted, and much of each large block is never used. (Simulated 256-word cache: 55% with 1-word blocks, 91% with 8, 51% with 64.)</p>

<h3>Write policy</h3>
<table>
<tr><th></th><th>Write-through</th><th>Write-back</th></tr>
<tr><td>Main memory updated</td><td>On every write, with the cache</td><td>Only when a changed block is evicted (or flushed)</td></tr>
<tr><td>Extra hardware</td><td>None</td><td>A <b>dirty bit</b> (modified bit) per slot, set by a write</td></tr>
<tr><td>Memory traffic</td><td>High: a memory write per store</td><td>Low: one block write per dirty eviction</td></tr>
<tr><td>Main memory current?</td><td>Always</td><td>Not always: it can be <b>stale</b></td></tr>
</table>
<p>Example: four stores to x, then its block is evicted: write-through makes 4 memory writes, write-back 1. <b>Direct memory access (DMA)</b> lets an I/O module use main memory without going through the processor or its cache; if it reads x before the eviction, write-back hands it a stale value, so hardware or the OS must write dirty blocks back first. With several processors, another cache can keep an old copy even under write-through, so hardware must update or invalidate it (<b>cache coherence</b>). Write-back never loses data: the newest value stays in the cache until written back.</p>

<h3>Multiple levels of cache</h3>
<p>One cache cannot be both large and very fast (a bigger memory takes longer to access), so processors stack levels. <b>L1</b>: tiny and fastest, in each core, usually split into instruction and data caches. <b>L2</b>: larger, a little slower, usually private to each core. <b>L3</b>: several megabytes, shared by all cores. A miss at one level goes to the next; only a miss at every level reaches main memory. Rough total times: L1 about 4 cycles, L2 12, L3 40, main memory 200+.</p>
<p><b>Average access time</b> = sum over the levels of (fraction of accesses answered there × time to get the word from there). With a 90% L1 hit ratio: L1 only gives 0.9 × 4 + 0.1 × 200 = 23.6 cycles, 20 of them from the rare misses. An L2 that catches 80% of L1 misses gives 0.9 × 4 + 0.1 × (0.8 × 12 + 0.2 × 200) = 8.56 cycles. An L3 that catches 75% of what is left brings it to about 6.2 cycles.</p>

<h3>The six cache design issues</h3>
<p>(1) Cache size, (2) block size, (3) mapping function, (4) replacement algorithm, (5) write policy, (6) number of cache levels.</p>`,
  });
})();
