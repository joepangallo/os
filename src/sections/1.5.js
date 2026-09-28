/* Section 1.5 The Memory Hierarchy
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {
  /* ------------------------------------------------------------------ shared helpers */
  const fmt = (v, d = 3) => {                       // trim trailing zeros: 0.150 -> 0.15
    const s = Number(v).toFixed(d);
    return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  };
  // Average access time of a two-level memory: a hit costs T1, a miss costs T1 + T2.
  const avgTime = (H, T1, T2) => H * T1 + (1 - H) * (T1 + T2);
  // multi-line SVG text: one tspan per line
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {
    const t = s('text', Object.assign({ x, y }, attrs));
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));
    return t;
  }
  // a clickable SVG group usable with mouse, keyboard and scripted (synthetic) pointer events
  function hotGroup(ctx, onAct, label, ...kids) {
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);
    g.addEventListener('click', onAct);
    g.addEventListener('pointerdown', (e) => { if (!e.isTrusted) onAct(); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });
    return g;
  }

  /* ------------------------------------------------------------------ locality lab model
     Memory = 256 words (addresses 0..255). The fast memory holds N blocks of B words;
     when it is full, the block that has gone unused the longest is sent back down. */
  const LOC_N = 64;                                  // references per pattern
  function locPattern(k) {
    const r = [];
    if (k === 'loop') { while (r.length < LOC_N) for (let a = 64; a <= 71 && r.length < LOC_N; a++) r.push(a); }   // 8-instruction loop, 8 passes
    else if (k === 'array') { for (let i = 0; i < 16; i++) r.push(32, 160 + i, 33, 34); }
    else if (k === 'sub') { for (let j = 0; j < 8; j++) r.push(8 + 2 * j, 9 + 2 * j, 200, 201, 202, 203, 204, 205); }
    else if (k === 'seq') { for (let a = 96; a < 96 + LOC_N; a++) r.push(a); }
    else { let x = 20250917; for (let i = 0; i < LOC_N; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; r.push((x >>> 8) % 256); } }
    return r;
  }
  function locSimulate(refs, B, N) {
    const slots = [];                                // { blk, last }
    const seen = new Set();
    let hits = 0, misses = 0;
    return refs.map((a, t) => {
      const blk = Math.floor(a / B);
      const s = slots.find((x) => x.blk === blk);
      let hit = !!s, victim = null, kind = null;
      if (hit) { hits++; s.last = t; kind = seen.has(a) ? 'temporal' : 'spatial'; }
      else {
        misses++;
        if (slots.length < N) slots.push({ blk, last: t });
        else {
          const lru = slots.reduce((m, x) => (x.last < m.last ? x : m), slots[0]);
          victim = lru.blk; lru.blk = blk; lru.last = t;
        }
      }
      seen.add(a);
      return { a, blk, hit, victim, kind, hits, misses, resident: slots.map((x) => x.blk).sort((p, q) => p - q) };
    });
  }

  Guide.section({
    id: '1.5',
    title: 'The Memory Hierarchy',
    short: 'Memory hierarchy',
    summary: 'Why memory comes in levels: the speed, size and cost trade-off, hit ratio, locality and the disk cache.',
    objectives: [
      'State the three design constraints on memory (capacity, access time, cost) and the three relationships that link them.',
      'Name the levels of the memory hierarchy, group them into inboard, outboard and off-line storage, and describe the four trends going down it.',
      'Compute the average access time of a two-level memory from the hit ratio H and the access times T1 and T2.',
      'Explain locality of reference (temporal and spatial) and why it makes a hierarchy fast and cheap at the same time.',
      'Describe secondary memory and how the operating system uses part of main memory as a disk cache.',
    ],
    terms: [
      ['Memory hierarchy', 'The arrangement of a computer’s storage into levels, from small, fast, expensive memory next to the processor down to huge, slow, cheap storage far from it.'],
      ['Capacity', 'How much data a memory can hold, measured in bytes (KB, MB, GB, TB).'],
      ['Access time', 'How long a memory takes to deliver (or store) a piece of data after the processor asks for it.'],
      ['Cost per bit', 'The price of storing one bit in a memory technology; in practice quoted as dollars per gigabyte.'],
      ['Inboard memory', 'The levels the processor reaches directly or over the system bus: registers, cache and main memory.'],
      ['Outboard storage', 'Large storage attached through I/O modules, such as solid-state disks, magnetic disks and optical discs.'],
      ['Off-line storage', 'Storage media kept outside the running system, such as magnetic tape cartridges, that must be mounted before use; used for backup and archives.'],
      ['Hit', 'An access whose data is already in the faster level, so it is served at that level’s speed.'],
      ['Miss', 'An access whose data is not in the faster level, so it must be fetched from the slower level below (and copied up).'],
      ['Hit ratio (H)', 'The fraction of all memory accesses that are hits in the faster memory: hits ÷ total accesses, a number from 0 to 1.'],
      ['Average access time (Ts)', 'The mean time per access over many accesses. For two levels: Ts = H × T1 + (1 − H) × (T1 + T2).'],
      ['Locality of reference (locality)', 'The tendency of a program’s memory references to cluster: over a short period it uses only a small set of locations, and that set changes slowly.'],
      ['Temporal locality', 'A location used recently is likely to be used again soon, as with a loop’s instructions or a counter variable.'],
      ['Spatial locality', 'A location near one used recently is likely to be used soon, as with consecutive instructions or neighbouring array elements.'],
      ['Block', 'A fixed-size group of neighbouring words that moves between two levels as one unit. A miss copies up the whole block, so the neighbours of the word you asked for arrive too.'],
      ['Secondary memory (auxiliary memory)', 'Large, nonvolatile storage outside main memory, such as disks, that holds programs and files permanently.'],
      ['Volatile memory', 'Memory that loses its contents when the power is turned off, such as registers, cache and main memory.'],
      ['Nonvolatile memory', 'Memory that keeps its contents without power, such as solid-state disks, magnetic disks, optical discs and tape.'],
      ['Disk cache', 'A portion of main memory that the operating system uses as a buffer for disk data. It is a software technique, not a separate hardware memory.'],
      ['Solid-state disk (SSD)', 'Nonvolatile storage built from flash memory chips with no moving parts, also called a solid-state drive; much faster than a magnetic disk but more expensive per bit.'],
    ],
    css: `
      .sec-1-5 .hot { cursor: pointer; outline: none; }
      .sec-1-5 .hot:hover .fr, .sec-1-5 .hot:focus-visible .fr { stroke-width: 3.5; }
      .sec-1-5 .tx-cpu { fill: var(--cpu); } .sec-1-5 .tx-mem { fill: var(--mem); } .sec-1-5 .tx-io { fill: var(--io); }
      .sec-1-5 .tx-os { fill: var(--os); } .sec-1-5 .tx-ok { fill: var(--ok); } .sec-1-5 .tx-bad { fill: var(--bad); }
      .sec-1-5 .tx-acc { fill: var(--accent); } .sec-1-5 .tx-warn { fill: var(--warn); }
      .sec-1-5 .c-cpu { color: var(--cpu); } .sec-1-5 .c-mem { color: var(--mem); } .sec-1-5 .c-io { color: var(--io); }
      .sec-1-5 .c-os { color: var(--os); } .sec-1-5 .c-ok { color: var(--ok); } .sec-1-5 .c-bad { color: var(--bad); }
      .sec-1-5 .c-acc { color: var(--accent); } .sec-1-5 .c-warn { color: var(--warn); }
      .sec-1-5 .sc-row { display: grid; grid-template-columns: 230px minmax(0, 1fr) 210px; align-items: center; gap: 14px; padding: 5px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); min-height: 43px; }
      .sec-1-5 .sc-row.done { background: var(--panel); }
      .sec-1-5 .sc-row.sc-head { background: none; border: 0; min-height: 0; padding: 0 13px; letter-spacing: .06em; flex: none; }
      .sec-1-5 .sc-row .btn.sm { height: 28px; padding: 0 9px; }
      .sec-1-5 .sc-bar { height: 12px; border-radius: 99px; background: var(--panel-3); overflow: hidden; }
      .sec-1-5 .sc-bar > i { display: block; height: 100%; width: 0; border-radius: 99px; transition: width .6s ease; }
      .sec-1-5 .dc-lane { display: flex; flex-direction: column; gap: 6px; }
      .sec-1-5 .dc-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
      .sec-1-5 .dc-box { border: 2px solid var(--line-2); border-radius: 10px; padding: 4px 8px 5px; min-height: 62px; }
      .sec-1-5 .dc-box.mem { border-color: var(--mem); background: var(--mem-bg); }
      .sec-1-5 .dc-box.io { border-color: var(--io); background: var(--io-bg); }
      .sec-1-5 .dc-box .lab { font-size: 12.5px; font-weight: 800; letter-spacing: .04em; color: var(--ink-2); }
      .sec-1-5 .dc-blk { display: inline-grid; place-items: center; min-width: 36px; height: 25px; padding: 0 5px; margin: 2px 2px 0 0; border-radius: 6px; font: 700 13px var(--mono); background: var(--panel); border: 1.5px solid var(--line-2); color: var(--ink); }
      .sec-1-5 .dc-blk.dirty { border-color: var(--warn); background: var(--warn-bg); color: var(--warn); }
      .sec-1-5 .dc-blk.stale { border-style: dashed; border-color: var(--warn); color: var(--warn); }
      .sec-1-5 .dc-blk.hl { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 55%, transparent); }
      .sec-1-5 .dc-blk.gone { opacity: .45; border-style: dashed; }
      .sec-1-5 .dc-blk.lost { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); text-decoration: line-through; }
      .sec-1-5 .dc-req { display: inline-grid; place-items: center; min-width: 50px; height: 28px; padding: 0 6px; border-radius: 8px; font: 700 13px var(--mono); border: 1.5px solid var(--line-2); background: var(--panel); color: var(--ink-2); }
      .sec-1-5 .dc-req.done { opacity: .5; }
      .sec-1-5 .dc-req.on { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); }
      .sec-1-5 .fn-row { display: grid; grid-template-columns: 136px minmax(0, 1fr) 222px; align-items: center; gap: 12px; padding: 6px 12px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--panel); }
      .sec-1-5 .fn-bar { height: 22px; border-radius: 6px; background: var(--panel-3); overflow: hidden; }
      .sec-1-5 .fn-bar > i { display: block; height: 100%; min-width: 3px; border-radius: 6px; transition: width .35s ease; }
      .sec-1-5 .fn-down { padding: 1px 0 1px 162px; font-size: 14px; color: var(--bad); font-weight: 700; }
      .sec-1-5 .fn-time { display: flex; height: 22px; border-radius: 6px; overflow: hidden; background: var(--panel-3); }
      .sec-1-5 .fn-time > i { display: block; height: 100%; transition: width .35s ease; }
      .sec-1-5 .fn-key { display: inline-block; width: 11px; height: 11px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; }
      @media (max-width: 760px) {
        .sec-1-5 .sc-row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
        .sec-1-5 .sc-row.sc-head { display: none; }
        .sec-1-5 .fn-row { grid-template-columns: minmax(0, 1fr); gap: 4px; }
        .sec-1-5 .fn-down { padding-left: 12px; }
      }
    `,
    steps: [
      /* ---------------------------------------------------------------- 1. Big picture */
      {
        title: 'Fast, big and cheap: pick any two',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          // [place, level, shape class, text class, colour name, what the pairing means]
          const ROWS = [
            ['The clothes you are wearing', 'Registers', 's-cpu', 'tx-cpu', 'cpu', 'The processor works <b>directly</b> on the values in its registers, just as you already have these clothes on. There are only a handful, and using them costs no trip at all.'],
            ['Tomorrow’s outfit on the chair', 'Cache', 's-accent', 'tx-acc', 'accent', 'The cache holds <b>copies</b> of what the processor will probably need next, like the outfit you laid out in advance: a few items, grabbed in a moment.'],
            ['Your closet', 'Main memory', 's-mem', 'tx-mem', 'mem', 'Main memory holds <b>every running program</b> and its data: plenty of room, a few steps away. Most things you reach for today come from here or closer.'],
            ['Boxes in the basement', 'Disk', 's-io', 'tx-io', 'io', 'The disk keeps <b>everything you own</b>, even things untouched for months, and it survives a power cut. Fetching from it is a slow trip downstairs, so you batch your trips.'],
            ['A storage unit across town', 'Tape', 's-io', 'tx-io', 'io', 'Tape holds <b>backups and archives</b>. Space there is the cheapest of all, but a visit takes ages, so you go only when something is lost or must be kept for years.'],
          ];
          let pickRow = -1;
          const rowInfo = h('div', { class: 'card tight small', style: { minHeight: '92px' } });
          const frames = [];
          const svg = s('svg', { viewBox: '0 0 600 282', width: '100%', role: 'img', 'aria-label': 'Wardrobe analogy for the memory hierarchy' });
          function showRow(i) {
            pickRow = i;
            frames.forEach((f, k) => f.setAttribute('stroke-width', k === i ? 4 : 2));
            const r = ROWS[i];
            rowInfo.innerHTML = i < 0 ? '<b>Click any row</b> to see why each place stands for its level of memory.'
              : `<b class="c-${r[4] === 'accent' ? 'acc' : r[4]}">${r[1]}</b> = ${r[0].toLowerCase()}. ${r[5]}`;
          }
          ROWS.forEach(([place, level, cls, tx], i) => {
            const y = 10 + i * 54;
            const fr = s('rect', { x: 326, y, width: 168, height: 44, rx: 10, class: 'fr ' + cls, 'stroke-width': 2 });
            frames.push(fr);
            svg.append(hotGroup(ctx, () => showRow(i), level + ': ' + place,
              s('rect', { x: 6, y, width: 262, height: 44, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),
              s('text', { x: 20, y: y + 27, 'font-size': 15, 'font-weight': 600 }, place),
              s('line', { x1: 274, y1: y + 22, x2: 318, y2: y + 22, class: 's-line', 'marker-end': 'url(#arr)' }),
              fr,
              s('text', { x: 410, y: y + 28, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, class: tx }, level)));
          });
          svg.append(
            s('line', { x1: 526, y1: 14, x2: 526, y2: 266, class: 's-line', 'marker-end': 'url(#arr)' }),
            s('text', { x: 548, y: 140, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, transform: 'rotate(90 548 140)' }, 'more room, cheaper per item'),
            s('text', { x: 572, y: 140, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub', transform: 'rotate(90 572 140)' }, 'slower to reach, used less often'));
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)' } },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Every program wants memory that is <b>huge</b>, <b>instant</b> and <b>nearly free</b>. No single technology is all three, so computers stack several kinds of memory in levels: a <span class="t">memory hierarchy</span>.' }),
              h('div', { class: 'grid-3', style: { gap: '10px' } },
                h('div', { class: 'card tight', html: '<h4>How much?</h4><div class="small"><span class="t">Capacity</span>: room for every program and its data.</div>' }),
                h('div', { class: 'card tight', html: '<h4>How fast?</h4><div class="small"><span class="t">Access time</span>: keep up with a processor that wants a word every nanosecond.</div>' }),
                h('div', { class: 'card tight', html: '<h4>How expensive?</h4><div class="small"><span class="t">Cost per bit</span>: low enough not to dominate the price of the machine.</div>' })),
              h('div', { class: 'card white tight', html: '<h4>In this section you will</h4><ul class="small m0"><li>see why no one memory technology can win on all three</li><li>climb the hierarchy level by level and feel its speed gaps</li><li>calculate how fast a two-level memory really is</li><li>discover <b>locality</b>, the habit of programs that makes it all work</li><li>see how the OS turns main memory into a <b>disk cache</b></li></ul>' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why an OS course cares', html: 'The OS manages the lower levels: it decides what stays in <span class="t">main memory</span> and what waits on disk. Processes, virtual memory and file systems all sit on this hierarchy.' })),
            h('div', { class: 'stack' },
              h('div', { class: 'card white', style: { padding: '10px 12px' } }, ctx.narrow
                ? h('div', { class: 'stack gap-s' }, ...ROWS.map(([place, level, , , col], i) => h('button', { class: 'btn', type: 'button', style: { justifyContent: 'space-between', width: '100%', height: 'auto', padding: '6px 10px', whiteSpace: 'normal', textAlign: 'left' }, onclick: () => showRow(i) },
                    h('span', { class: 'small b', text: place + ' →' }),
                    h('span', { class: 'box', style: { minWidth: '112px', padding: '3px 8px', borderColor: `var(--${col})`, background: `var(--${col}-bg)` }, text: level }))),
                  h('div', { class: 'small muted', text: '↓ going down: more room and cheaper per item, but slower to reach and used less often' }))
                : svg),
              rowInfo,
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy: your clothes', html: 'You keep what you use most within arm’s reach and everything else further away. Most days you never visit the basement, so your wardrobe <b>feels</b> as quick as the chair yet <b>holds</b> as much as the storage unit. A memory hierarchy plays the same trick.' }))));
          showRow(-1);
        },
      },
      /* ---------------------------------------------------------------- 2. The dilemma */
      {
        title: 'The dilemma: build everything from one technology',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          // Rough mid-2020s figures. Only the ratios matter; they are stable even as prices fall.
          const TECH = [
            { k: 'sram', name: 'SRAM', long: 'SRAM (cache chips)', ns: 1, time: '≈ 1 ns', perGB: 1000, per: '≈ $1,000', devGB: 0.032, dev: '≈ 32 MB', vol: true },
            { k: 'dram', name: 'DRAM', long: 'DRAM (main memory)', ns: 100, time: '≈ 100 ns', perGB: 5, per: '≈ $5', devGB: 32, dev: '≈ 32 GB', vol: true },
            { k: 'ssd', name: 'Flash SSD', long: 'Flash (solid-state disk)', ns: 1e5, time: '≈ 100 µs', perGB: 0.08, per: '≈ $0.08', devGB: 4000, dev: '≈ 4 TB', vol: false },
            { k: 'hdd', name: 'Magnetic disk', long: 'Magnetic disk', ns: 5e6, time: '≈ 5 ms', perGB: 0.02, per: '≈ $0.02', devGB: 20000, dev: '≈ 20 TB', vol: false },
          ];
          const CAPS = [1, 4, 16, 64, 256, 1000, 4000];
          const capLabel = (gb) => (gb >= 1000 ? gb / 1000 + ' TB' : gb + ' GB');
          const money = (x) => (x >= 1e6 ? '$' + fmt(x / 1e6, 1) + ' million' : x >= 100 ? '$' + Math.round(x).toLocaleString('en-US') : '$' + x.toFixed(2));
          // seconds -> readable duration (hours up to two days, so 10^5 s reads "27.8 hours", not "1 days")
          const human = (sec) => (sec < 60 ? fmt(sec, 1) + ' s' : sec < 3600 ? fmt(sec / 60, 1) + ' min' : sec < 172800 ? fmt(sec / 3600, 1) + ' hours' : Math.round(sec / 86400) + ' days');
          let pick = 1, capIdx = 5;
          const costOut = h('div', { class: 'big', style: { fontSize: '30px' } });
          const timeOut = h('div', { class: 'big', style: { fontSize: '30px' } });
          const devOut = h('div', { class: 'big', style: { fontSize: '30px' } });
          const verdict = h('div', { class: 'callout m0' });
          const rows = TECH.map((t, i) => h('tr', { role: 'button', tabindex: 0, style: { cursor: 'pointer' }, onclick: () => choose(i), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i); } } },
            h('td', { class: 'b', text: t.long }), h('td', { class: 'num', text: t.time }), h('td', { class: 'num', text: t.per }), h('td', { class: 'num', text: t.dev })));
          const seg = ctx.ui.seg(TECH.map((t, i) => ({ value: i, label: t.name })), pick, (v) => choose(v));
          const slider = ctx.ui.slider({ label: 'Storage needed', min: 0, max: CAPS.length - 1, step: 1, value: capIdx, format: (v) => capLabel(CAPS[v]), onInput: (v) => { capIdx = v; paint(); } });
          function choose(i) { pick = i; seg.set(i); paint(); }
          function paint() {
            const t = TECH[pick], gb = CAPS[capIdx];
            const cost = t.perGB * gb, secs = t.ns;            // 10^9 accesses × t.ns ns = t.ns seconds
            const devs = Math.ceil(gb / t.devGB);
            costOut.textContent = money(cost);
            timeOut.textContent = human(secs);
            devOut.textContent = devs.toLocaleString('en-US');
            rows.forEach((r, i) => r.classList.toggle('on', i === pick));
            const forget = t.vol ? ' And it <b>forgets everything</b> when the power goes off.' : '';
            const msg = {
              sram: [`bad`, 'Too expensive', `Blazing fast, but ${capLabel(gb)} costs about <b>${money(cost)}</b> and needs <b>${devs.toLocaleString('en-US')}</b> chips’ worth of SRAM, far too many to sit next to the processor.${forget}`],
              dram: ['warn', gb > 64 ? 'Costly and forgetful' : 'Affordable, but forgetful', `A billion accesses take <b>${human(secs)}</b>, a hundred times slower than SRAM. ${capLabel(gb)} costs <b>${money(cost)}</b>${devs > 4 ? ` and needs ${devs} modules, more than a typical machine has slots for` : ''}.${forget} Every saved file would vanish too, which is why DRAM serves as main memory but never as the only storage.`],
              ssd: ['warn', 'Cheap and big, but slow', `${capLabel(gb)} for only <b>${money(cost)}</b>, and it keeps data without power. But each access takes about <b>1,000×</b> longer than DRAM: a billion accesses take <b>${human(secs)}</b>. The processor would spend almost all its time waiting.`],
              hdd: ['bad', 'Cheapest, and far too slow', `${capLabel(gb)} costs just <b>${money(cost)}</b>, but every access waits for a spinning platter: a billion accesses take <b>${human(secs)}</b>, about <b>50,000×</b> longer than DRAM.`],
            }[t.k];
            verdict.className = 'callout m0 ' + msg[0];
            verdict.setAttribute('data-label', msg[1]);
            verdict.innerHTML = msg[2];
          }
          const readout = (label, out, sub) => h('div', { class: 'card tight center' }, h('h4', { text: label }), out, h('div', { class: 'xs muted', text: sub }));
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Suppose you had to build <b>all</b> of a computer’s storage from <b>one</b> technology. Pick one and see what goes wrong.' }),
              h('div', { class: 'card white tight stack gap-s', html: `<h4>Three relationships that always hold</h4>
                <div class="row gap-s"><span class="chip cpu">faster access time</span>→<span class="chip bad">greater cost per bit</span></div>
                <div class="row gap-s"><span class="chip mem">greater capacity</span>→<span class="chip ok">smaller cost per bit</span></div>
                <div class="row gap-s"><span class="chip mem">greater capacity</span>→<span class="chip warn">greater (slower) access time</span></div>
                <div class="xs muted">Read the table down any column to see all three at once.</div>` }),
              h('div', { class: 'callout warn m0', 'data-label': 'The dilemma', html: 'We want <b>large capacity</b>, because it is cheap per bit and programs need room. We also want <b>fast access</b>. But the big technologies are slow and the fast ones are expensive.' }),
              h('div', { class: 'callout tip m0', 'data-label': 'The way out', html: 'Do not choose. Use a <b>little</b> of the fast, costly memory and a <b>lot</b> of the slow, cheap memory, stacked in levels, and keep the data in use near the top.' })),
            h('div', { class: 'stack' },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('div', { style: { flex: '1', minWidth: '260px' } }, slider)),
              h('div', { class: 'grid-3', style: { gap: '10px' } },
                readout('Cost to build', costOut, 'at the price per GB below'),
                readout('Time for 10⁹ accesses', timeOut, 'a fast processor needs ≤ 1 s'),
                readout('Devices needed', devOut, 'chips, modules or drives')),
              verdict,
              h('table', { class: 'tbl compact' },
                h('thead', {}, h('tr', {}, h('th', { text: 'Technology' }), h('th', { text: 'Access time' }), h('th', { text: 'Cost per GB' }), h('th', { text: 'One device holds' }))),
                h('tbody', {}, ...rows)),
              h('div', { class: 'xs muted', html: '<b>Units:</b> 1 ns (nanosecond) = a billionth of a second; 1 µs = 1,000 ns; 1 ms = 1,000 µs. <b>SRAM</b> (static RAM) is fast but bulky; <b>DRAM</b> (dynamic RAM) packs bits densely but is slower. Figures are rough mid-2020s values: prices fall, but the ratios between rows barely change.' }))));
          paint();
        },
      },
      /* ---------------------------------------------------------------- 3. The pyramid */
      {
        title: 'The hierarchy pyramid, level by level',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const GROUP = ['Inboard memory', 'Outboard storage', 'Off-line storage'];
          // tier: 0..4 (tier 3 holds three side-by-side cells). v = pyramid labels for the four trends.
          const L = [
            { k: 'reg', name: 'Registers', tier: 0, cls: 's-cpu', tx: 'tx-cpu', c: 'c-cpu', g: 0, vol: true,
              v: { cost: 'highest', cap: '≈ 1 KB', time: '≈ 0.3 ns', freq: 'constantly' },
              cap: 'about a kilobyte in total', time: '≈ 0.3 ns (within one clock tick)', cost: 'the highest of all: part of the processor', freq: 'several times in almost every instruction', who: 'the program (the compiler picks them)',
              d: 'Tiny storage slots inside the processor itself. Instructions name registers directly, so reading one is simply part of carrying out the instruction.' },
            { k: 'cache', name: 'Cache', tier: 1, cls: 's-accent', tx: 'tx-acc', c: 'c-acc', g: 0, vol: true,
              v: { cost: '≈ $1,000 / GB', cap: '≈ 64 KB–64 MB', time: '≈ 1–10 ns', freq: 'very often' },
              cap: 'kilobytes to tens of megabytes', time: '≈ 1–10 ns', cost: 'very high (≈ $1,000 per GB)', freq: 'on most memory accesses', who: 'hardware, automatically',
              d: 'Fast SRAM on the processor chip that keeps copies of recently used blocks of main memory. Hardware fills it and picks what to replace automatically; programs never manage it, and the OS steps in only for occasional maintenance such as flushing. Section 1.6 opens it up.' },
            { k: 'main', name: 'Main memory', tier: 2, cls: 's-mem', tx: 'tx-mem', c: 'c-mem', g: 0, vol: true,
              v: { cost: '≈ $5 / GB', cap: '≈ 8–64 GB', time: '≈ 50–100 ns', freq: 'often' },
              cap: 'gigabytes (8–64 GB is typical)', time: '≈ 50–100 ns', cost: 'moderate (≈ $5 per GB)', freq: 'only when the cache misses', who: 'the operating system',
              d: 'The computer’s working memory, built from DRAM chips. A program’s instructions and data must be here while it runs, and the OS decides which program gets how much.' },
            { k: 'ssd', name: 'SSD', tier: 3, cell: 0, cls: 's-io', tx: 'tx-io', c: 'c-io', g: 1, vol: false,
              v: { cost: '≈ 8¢ / GB', cap: '≈ 0.5–4 TB', time: '≈ 0.1 ms', freq: 'occasionally' },
              cap: 'about 0.5–4 TB per drive', time: '≈ 0.1 ms (100 µs)', cost: 'low (≈ 8 cents per GB)', freq: 'only when data is not in main memory', who: 'the OS, through an I/O module',
              d: 'A <span class="t">solid-state disk</span>: flash memory chips with no moving parts. Far faster than a spinning disk, but several times more expensive per bit.' },
            { k: 'hdd', name: 'Magnetic disk', tier: 3, cell: 1, cls: 's-io', tx: 'tx-io', c: 'c-io', g: 1, vol: false,
              v: { cost: '≈ 2¢ / GB', cap: '≈ 1–20 TB', time: '≈ 5–10 ms', freq: 'occasionally' },
              cap: 'about 1–20 TB per drive', time: '≈ 5–10 ms', cost: 'very low (≈ 2 cents per GB)', freq: 'only when data is not in main memory', who: 'the OS, through an I/O module',
              d: 'Spinning platters read by a moving arm. Huge and cheap per bit, but every access waits for the arm to move and the platter to turn under it.' },
            { k: 'opt', name: 'Optical discs', tier: 3, cell: 2, cls: 's-io', tx: 'tx-io', c: 'c-io', g: 1, vol: false,
              v: { cost: '≈ 5¢ / GB', cap: '≤ 100 GB / disc', time: '≈ 100 ms', freq: 'occasionally' },
              cap: 'up to about 100 GB per disc', time: '≈ 100 ms', cost: '≈ 5 cents per GB: more than a magnetic disk (a niche product now)', freq: 'only when a disc is in the drive', who: 'the OS, through an I/O module',
              d: 'CDs, DVDs and Blu-ray discs read by a laser. One disc holds less than a hard disk, but discs are removable, so a shelf of them holds as much as you like.' },
            { k: 'tape', name: 'Magnetic tape', tier: 4, cls: 's-io', tx: 'tx-io', c: 'c-io', g: 2, vol: false, dash: true,
              v: { cost: '≈ 0.5¢ / GB', cap: '≈ 10–30 TB each', time: 'seconds to minutes', freq: 'rarely' },
              cap: 'about 10–30 TB per cartridge', time: 'seconds to minutes (load, then wind to the spot)', cost: 'the lowest (≈ half a cent per GB)', freq: 'rarely: backups and restores', who: 'operators and backup software',
              d: 'Cartridges kept on a shelf or in a robot library and mounted only when needed. Tape is sequential: reaching one spot means winding past everything before it.' },
          ];
          const TRENDS = [
            { k: 'cost', lab: '(a) Decreasing <b>cost per bit</b>', arrow: 'cost per bit decreases' },
            { k: 'cap', lab: '(b) Increasing <b>capacity</b>', arrow: 'capacity increases' },
            { k: 'time', lab: '(c) Increasing <b>access time</b>', arrow: 'access time increases' },
            { k: 'freq', lab: '(d) Decreasing <b>frequency of access</b> by the processor', arrow: 'processor uses it less often' },
          ];
          let sel = 2, trend = 0;
          const NW = ctx.narrow;                        // phones: crop the side labels and enlarge the text
          const svg = s('svg', { viewBox: NW ? '146 4 474 363' : '0 0 660 371', width: '100%', role: 'img', 'aria-label': 'Memory hierarchy pyramid' });
          const SHORT = { 'Magnetic disk': 'Disk', 'Optical discs': 'Optical' };
          const cx = 392, Y0 = 10, TH = 66, GAP = 4;
          const wAt = (y) => 120 + 340 * (y - Y0) / (5 * TH + 4 * GAP);
          const valText = [];
          const polys = [];
          L.forEach((lv, i) => {
            const top = Y0 + lv.tier * (TH + GAP), bot = top + TH;
            let xl0 = cx - wAt(top) / 2, xr0 = cx + wAt(top) / 2, xl1 = cx - wAt(bot) / 2, xr1 = cx + wAt(bot) / 2;
            if (lv.cell != null) {       // split the outboard tier into three cells
              const a = lv.cell / 3, b = (lv.cell + 1) / 3, g = lv.cell === 0 ? 0 : 2, g2 = lv.cell === 2 ? 0 : 2;
              [xl0, xr0] = [xl0 + (xr0 - xl0) * a + g, xl0 + (xr0 - xl0) * b - g2];
              [xl1, xr1] = [xl1 + (xr1 - xl1) * a + g, xl1 + (xr1 - xl1) * b - g2];
            }
            const mid = (xl0 + xr0 + xl1 + xr1) / 4, small = lv.cell != null;
            const poly = s('polygon', { points: `${xl0},${top} ${xr0},${top} ${xr1},${bot} ${xl1},${bot}`, class: 'fr ' + lv.cls, 'stroke-width': 2, 'stroke-dasharray': lv.dash ? '7 4' : null });
            const vt = s('text', { x: mid, y: top + (NW ? 54 : 51), 'text-anchor': 'middle', 'font-size': NW ? (small ? 14.5 : 18) : (small ? 13.5 : 15), 'font-weight': 700, class: lv.tx });
            polys.push(poly); valText.push(vt);
            svg.append(hotGroup(ctx, () => { sel = i; paint(); }, lv.name, poly,
              s('text', { x: mid, y: top + (NW ? 29 : 28), 'text-anchor': 'middle', 'font-size': NW ? (small ? 17 : 21) : (small ? 15 : 17), 'font-weight': 800 }, NW && SHORT[lv.name] ? SHORT[lv.name] : lv.name), vt));
          });
          // brackets for the three groups
          const brk = (y1, y2, lines) => [s('path', { d: `M142 ${y1} H132 V${y2} H142`, class: 's-line', 'stroke-width': 1.8 }),
            mtext(s, 122, (y1 + y2) / 2 - (lines.length - 1) * 8.5 + 5, lines, { 'text-anchor': 'end', 'font-size': 15, 'font-weight': 800 })];
          svg.append(...brk(Y0 + 2, Y0 + 3 * TH + 2 * GAP - 2, ['Inboard', 'memory']),
            ...brk(Y0 + 3 * (TH + GAP) + 2, Y0 + 4 * TH + 3 * GAP - 2, ['Outboard', 'storage']),
            ...brk(Y0 + 4 * (TH + GAP) + 2, Y0 + 5 * TH + 4 * GAP - 2, ['Off-line', 'storage']));
          const arrowLab = s('text', { x: 648, y: 186, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800, class: 'tx-acc', transform: 'rotate(90 648 186)' });
          svg.append(s('line', { x1: 626, y1: 18, x2: 626, y2: 353, class: 's-line', 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)', 'stroke-width': 2.5 }), arrowLab);

          const info = h('div', { class: 'card white tight stack gap-s', style: { flex: 'none' } });
          const tbtns = TRENDS.map((t, i) => h('button', { class: 'btn sm', type: 'button', style: { justifyContent: 'flex-start', width: '100%', whiteSpace: 'normal', height: 'auto', minHeight: '32px', padding: '4px 10px', textAlign: 'left' }, onclick: () => { trend = i; paint(); }, html: '<span>↓ ' + t.lab + '</span>' }));
          function paint() {
            const lv = L[sel], tr = TRENDS[trend];
            polys.forEach((p, i) => p.setAttribute('stroke-width', i === sel ? 4.5 : 2));
            valText.forEach((vt, i) => { vt.textContent = L[i].v[tr.k]; });
            arrowLab.textContent = 'going down: ' + tr.arrow;
            tbtns.forEach((b, i) => b.classList.toggle('on', i === trend));
            info.innerHTML = `<div class="row" style="justify-content:space-between"><span class="b ${lv.c}" style="font-size:19px">${lv.name}</span>
                <span class="row gap-s"><span class="chip accent">${GROUP[lv.g]}</span><span class="chip ${lv.vol ? 'warn' : 'ok'}"><span class="t" data-t="${lv.vol ? 'volatile memory' : 'nonvolatile memory'}">${lv.vol ? 'volatile' : 'nonvolatile'}</span></span></span></div>
              <div class="small">${lv.d}</div>
              <table class="tbl compact"><tbody>
                <tr><td class="b">Capacity</td><td>${lv.cap}</td></tr>
                <tr><td class="b">Access time</td><td>${lv.time}</td></tr>
                <tr><td class="b">Cost per bit</td><td>${lv.cost}</td></tr>
                <tr><td class="b">Processor uses it</td><td>${lv.freq}</td></tr>
                <tr><td class="b">Managed by</td><td>${lv.who}</td></tr></tbody></table>`;
          }
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'small', html: 'The brackets group the levels into <span class="t">inboard memory</span>, <span class="t">outboard storage</span> and <span class="t">off-line storage</span>. <span class="muted">Click any level; the trend buttons relabel the pyramid. (Figures approximate.)</span>' }),
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg),
              h('div', { class: 'small', html: '<b>Why a pyramid?</b> Each level is wider than the one above: it holds more and costs less per bit, but it is slower and the processor visits it less often. The three outboard cells are alternatives on one level, not steps down. <b>One exception:</b> optical discs (≈&nbsp;5¢ per GB) cost more per bit than magnetic disk (≈&nbsp;2¢), because discs are now a niche medium.' })),
            h('div', { class: 'stack gap-s' }, info,
              h('div', { class: 'card tight stack gap-s', style: { flex: 'none' } }, h('h4', { class: 'm0', text: 'Going down the hierarchy' }), ...tbtns))));
          paint();
        },
      },
      /* ---------------------------------------------------------------- 4. Scale analogy */
      {
        title: 'Feel the gaps: if a register access took 1 second',
        kind: 'predict',
        render(el, ctx) {
          const { h } = ctx;
          const CATS = ['Seconds', 'Minutes', 'Hours', 'Days', 'Months', 'Years', 'Millennia'];
          const REG = 0.3e-9;                                   // one register access, in seconds
          // real = rough typical access time in seconds; stretched = real / REG seconds
          const LV = [
            { name: 'Register', real: REG, rt: '≈ 0.3 ns', cat: null, st: '1 second', like: 'glancing at a note in your hand', col: 'var(--cpu)' },
            { name: 'Cache', real: 1e-9, rt: '≈ 1 ns', cat: 'Seconds', st: '≈ 3.3 seconds', like: 'reaching across your desk', col: 'var(--accent)' },
            { name: 'Main memory', real: 100e-9, rt: '≈ 100 ns', cat: 'Minutes', st: '≈ 5.6 minutes', like: 'walking down the hall to a coworker and back', col: 'var(--mem)' },
            { name: 'Solid-state disk', real: 100e-6, rt: '≈ 100 µs', cat: 'Days', st: '≈ 3.9 days', like: 'waiting for a parcel to arrive by post', col: 'var(--io)' },
            { name: 'Magnetic disk', real: 5e-3, rt: '≈ 5 ms', cat: 'Months', st: '≈ 6.3 months', like: 'a whole semester, plus summer break', col: 'var(--io)' },
            { name: 'Optical disc', real: 0.1, rt: '≈ 100 ms', cat: 'Years', st: '≈ 10.6 years', like: 'a child growing from age 5 to 15', col: 'var(--io)' },
            { name: 'Magnetic tape', real: 60, rt: '≈ 1 min to wind', cat: 'Millennia', st: '≈ 6,300 years', like: 'all of recorded history, and then some', col: 'var(--io)' },
          ];
          const MAXLOG = Math.log10(LV[LV.length - 1].real / REG) + 0.4;
          const barW = (lv) => ((Math.log10(lv.real / REG) + 0.4) / MAXLOG * 100).toFixed(1) + '%';
          const score = h('span', { class: 'chip accent' });
          let right = 0, answered = 0;
          const rows = LV.map((lv) => {
            const mid = h('div', { class: 'row gap-s' });
            const bar = h('i', { style: { background: lv.col } });
            const row = h('div', { class: 'sc-row' },
              h('div', { class: 'row nw', style: { gap: '8px', justifyContent: 'space-between' } }, h('span', { class: 'b', text: lv.name }), h('span', { class: 'xs muted', text: lv.rt })),
              mid, h('div', { class: 'sc-bar', title: 'log scale' }, bar));
            const reveal = (guess) => {
              const ok = guess === lv.cat;
              const mark = guess == null ? '' : ok ? '<b class="c-ok">✓ ' + guess + '.</b> ' : `<b class="c-bad">✗ ${guess}?</b> No, <b>${lv.cat.toLowerCase()}</b>. `;
              mid.innerHTML = `<div class="small">${mark}<b>${lv.st}</b>: like ${lv.like}.</div>`;
              bar.style.width = barW(lv);
              if (guess != null) { answered++; if (ok) right++; }
              row.classList.add('done');
              paintScore();
            };
            row._reveal = reveal; row._lv = lv;
            if (!lv.cat) { mid.innerHTML = `<div class="small"><b>${lv.st}</b>: our starting point, like ${lv.like}.</div>`; ctx.after(60, () => { bar.style.width = barW(lv); }); }
            else mid.append(...CATS.map((c) => h('button', { class: 'btn sm', type: 'button', text: c, onclick: () => reveal(c) })));
            return row;
          });
          function paintScore() { score.textContent = answered ? `Guessed right: ${right} / ${answered}` : 'Make a guess for each row'; }
          const revealAll = h('button', { class: 'btn sm', type: 'button', text: 'Reveal all', onclick: () => rows.forEach((r) => { if (!r.classList.contains('done')) r._reveal(null); }) });
          paintScore();
          el.append(h('div', { class: 'stack fill gap-s' },
            h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', flex: 'none', gap: '10px 18px' } },
              h('p', { class: 'm0', style: { flex: '1 1 460px', minWidth: '0' }, html: 'Stretch every access time by the <b>same</b> factor (about 3.3 billion) so that a register access lasts <b>one second</b>. Guess the unit for each level, then compare. Real times are rough, typical values.' }),
              h('div', { class: 'row nw gap-s', style: { flex: 'none' } }, score, revealAll)),
            h('div', { class: 'sc-row sc-head xs muted b' }, h('div', { text: 'LEVEL · REAL TIME' }), h('div', { text: 'YOUR GUESS, THEN THE STRETCHED TIME' }), h('div', { text: 'LOG-SCALE BAR' })),
            h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } }, ...rows),
            h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'At this scale a magnetic-disk access lasts months, so the OS does not let the processor sit idle waiting for one. It runs another program meanwhile and lets an interrupt announce that the data has arrived (see Interrupts, 1.4). The gaps also explain why the top levels must handle almost every access.' })));
        },
      },
      /* ---------------------------------------------------------------- 5. Two-level memory, read by read */
      {
        title: 'A two-level memory, one read at a time',
        kind: 'learn',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const T1 = 0.1, T2 = 1;                         // µs; the strip draws U pixels per 0.1 µs (see G below)
          // 20 reads: a loop reads a[0..3] five times. Only the very first read misses.
          const READS = Array.from({ length: 20 }, (_, r) => ({ n: r + 1, w: r % 4, hit: r !== 0 }));
          // frame -> how many reads are complete, which read is on screen, and the phase
          const F = [
            { done: 0, cur: null, ph: 'setup' }, { done: 0, cur: 0, ph: 'look' }, { done: 1, cur: 0, ph: 'fetch' },
            { done: 2, cur: 1, ph: 'hit' }, { done: 4, cur: 3, ph: 'hit' }, { done: 8, cur: 7, ph: 'hit' },
            { done: 20, cur: 19, ph: 'hit' }, { done: 20, cur: null, ph: 'sum' }, { done: 20, cur: null, ph: 'rule' },
          ];
          const CAP = [
            '<b>Setup.</b> A <b>two-level memory</b>, the simplest hierarchy: level 1 is small and fast (T1 = 0.1 µs), level 2 is large and slow (T2 = 1 µs). The processor reads only from level 1. A loop will read the four neighbouring words a[0], a[1], a[2], a[3] five times: <b>20 reads</b>. Level 1 starts empty.',
            '<b>Read 1: a[0].</b> The processor always looks in level 1 first, which takes T1 = 0.1 µs. Level 1 is empty, so this read is a <span class="t">miss</span>.',
            '<b>Still read 1.</b> The word must come up from level 2, costing another T2 = 1 µs. Level 2 sends the whole <span class="t">block</span> a[0]–a[3] into level 1, and the processor reads a[0] from there. So a miss costs <b>T1 + T2 = 1.1 µs</b>.',
            '<b>Read 2: a[1].</b> Already in level 1: a <span class="t">hit</span>, done in just 0.1 µs. It arrived together with a[0], because a whole block travels up at once: <b>spatial locality</b> paying off.',
            '<b>Reads 3–4.</b> a[2] and a[3] are hits too. The first pass is over: 4 reads in 1.1 + 0.1 + 0.1 + 0.1 = <b>1.4 µs</b>.',
            '<b>Reads 5–8.</b> The loop starts again at a[0]. It is still in level 1, so all four reads hit. The same words are used again soon: <b>temporal locality</b>.',
            '<b>Reads 9–20.</b> Every one hits. Look at the strip: one long red bar and nineteen short green ones.',
            '<b>Totals.</b> 19 hits out of 20 reads, so the <span class="t">hit ratio</span> is <b>H = 19 / 20 = 0.95</b>. Total time = 19 × 0.1 + 1 × 1.1 = 3.0 µs, so the average is <b>3.0 / 20 = 0.15 µs</b> per read.',
            '<b>The general rule</b> for the <span class="t">average access time</span>: Ts = H × T1 + (1 − H) × (T1 + T2) = 0.95 × 0.1 + 0.05 × 1.1 = 0.095 + 0.055 = <b>0.15 µs</b>. Without level 1, all 20 reads would take 1 µs each (20 µs), so the small memory made this loop about <b>6.7× faster</b>.',
          ];
          // geometry: wide canvas (side by side) or phone (stacked)
          const NW = ctx.narrow;
          const G = NW ? {
            vb: '0 0 420 470', U: 13, sx: 12,
            cpu: [8, 10, 132, 112], cpuT: [74, 36, 16], cpuS: [74, 66, 13], cpuB: [74, 100, 22],
            l1: [190, 10, 222, 112], l1T: [301, 32, 15], l1S: [301, 116, 13], slot: [200, 51, 44, 46, 38, 13], l1St: [301, 100, 13],
            l2: [8, 160, 404, 126], l2T: [210, 182, 15], l2S: [210, 279, 13], cell: [30, 45, 192, 19, 39, 15, 12.5], blk: [116, 208, 182, 21],
            ar1: [[143, 56, 186, 56], [186, 80, 143, 80]], ar1L: null, ar2: [300, 157, 300, 127], ar2L: [[310, 146, 'start', 'on a miss: + T2']],
            stripT: [12, 314, 13, 'Time taken by each read (width = time)'], strip: [322, 32, 343], axis: [360, 380, 12.5], tally: [[12, 412], [12, 436]], hLab: [12, 460, 'start'], fs: 14,
          } : {
            vb: '0 0 1100 350', U: 34, sx: 20,
            cpu: [20, 40, 170, 124], cpuT: [105, 70, 18], cpuS: [105, 102, 14], cpuB: [105, 136, 26],
            l1: [300, 30, 280, 144], l1T: [440, 56, 17], l1S: [440, 160, 13.5], slot: [318, 64, 76, 56, 46, 14], l1St: [440, 142, 14.5],
            l2: [690, 10, 392, 186], l2T: [886, 36, 17], l2S: [886, 184, 13.5], cell: [708, 45, 50, 30, 39, 24, 12.5], blk: [794, 76, 182, 32],
            ar1: [[194, 92, 294, 92], [294, 116, 194, 116]], ar1L: [[244, 82, 'request'], [244, 138, 'word']], ar2: [686, 104, 586, 104], ar2L: [[636, 92, 'middle', 'on a miss'], [636, 124, 'middle', '+ T2']],
            stripT: [20, 222, 14.5, 'Time taken by each read (bar width = time)'], strip: [232, 40, 257], axis: [276, 299, 13], tally: [[20, 334], null], hLab: [1080, 334, 'end'], fs: 16,
          };
          const U = G.U;
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Two-level memory simulation' });
          const box = ([x, y, w, hh], cls) => s('rect', { x, y, width: w, height: hh, rx: 14, class: cls, 'stroke-width': 2.5 });
          const txt = ([x, y, fs], str, attrs = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': fs }, attrs), str);
          svg.append(
            box(G.cpu, 's-cpu'), txt(G.cpuT, 'Processor', { 'font-weight': 800 }),
            box(G.l1, 's-accent'), txt(G.l1T, 'Level 1: small, fast', { 'font-weight': 800, class: 'tx-acc' }), txt(G.l1S, 'access time T1 = 0.1 µs', { class: 's-sub' }),
            box(G.l2, 's-mem'), txt(G.l2T, 'Level 2: large, slow', { 'font-weight': 800, class: 'tx-mem' }), txt(G.l2S, 'access time T2 = 1 µs', { class: 's-sub' }),
            s('text', { x: G.stripT[0], y: G.stripT[1], 'font-size': G.stripT[2], 'font-weight': 700 }, G.stripT[3]));
          const [cx0, cdx, cy0, cdy, cw, chh, cfs] = G.cell;
          for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
            const inA = r === 1 && c >= 2 && c <= 5;
            svg.append(s('rect', { x: cx0 + c * cdx, y: cy0 + r * cdy, width: cw, height: chh, rx: 4, class: inA ? 's-mem' : 's-panel', 'stroke-width': inA ? 2 : 1 }));
            if (inA) svg.append(s('text', { x: cx0 + c * cdx + cw / 2, y: cy0 + r * cdy + chh / 2 + cfs * 0.36, 'text-anchor': 'middle', 'font-size': cfs, 'font-weight': 700, class: 's-monot' }, `a[${c - 2}]`));
          }
          const [axY, axL, axF] = G.axis;
          for (let k = 0; k <= 6; k++) {
            const x = G.sx + k * 5 * U;
            svg.append(s('line', { x1: x, y1: axY, x2: x, y2: axY + 7, class: 's-line', 'stroke-width': 1.5 }),
              s('text', { x, y: axL, 'text-anchor': k === 0 ? 'start' : 'middle', 'font-size': axF, class: 's-sub' }, k === 0 ? '0' : (k * 0.5).toFixed(1) + ' µs'));
          }
          svg.append(s('line', { x1: G.sx, y1: axY, x2: G.sx + 30 * U, y2: axY, class: 's-muted', 'stroke-width': 1.5 }));
          const dyn = s('g');
          svg.append(dyn);
          function draw(f) {
            const fr = F[f], kids = [];
            const loaded = fr.done >= 1;
            const cur = fr.cur != null ? READS[fr.cur] : null;
            // processor: which word is being read
            kids.push(txt(G.cpuS, cur ? 'read ' + cur.n + ' wants' : fr.ph === 'setup' ? 'about to run' : 'all done', { class: 's-sub' }),
              txt(G.cpuB, cur ? `a[${cur.w}]` : fr.ph === 'setup' ? '…' : '20 reads', { 'font-weight': 800, class: 's-monot tx-cpu' }));
            // level-1 slots
            const [sx0, sdx, sy, sw, sh, sfs] = G.slot;
            for (let i = 0; i < 4; i++) {
              const isCur = cur && cur.w === i && fr.ph !== 'setup';
              const cls = !loaded ? 's-panel' : isCur ? (fr.ph === 'hit' ? 's-ok' : 's-bad') : 's-mem';
              kids.push(s('rect', { x: sx0 + i * sdx, y: sy, width: sw, height: sh, rx: 8, class: cls, 'stroke-width': isCur ? 3 : 1.5, 'stroke-dasharray': loaded ? null : '5 4' }),
                s('text', { x: sx0 + i * sdx + sw / 2, y: sy + sh / 2 + sfs * 0.36, 'text-anchor': 'middle', 'font-size': sfs, 'font-weight': 700, class: 's-monot' + (loaded ? '' : ' s-sub') }, loaded ? `a[${i}]` : 'empty'));
            }
            const st = (str, cls) => kids.push(txt(G.l1St, str, { 'font-weight': 800, class: cls }));
            if (fr.ph === 'look') st('a[0] is not here: MISS', 'tx-bad');
            if (fr.ph === 'fetch') { st('block a[0]–a[3] copied in', 'tx-mem'); kids.push(s('rect', { x: G.blk[0], y: G.blk[1], width: G.blk[2], height: G.blk[3], rx: 7, fill: 'none', style: 'stroke:var(--mem)', 'stroke-width': 3, 'stroke-dasharray': '6 4' })); }
            if (fr.ph === 'hit' && cur) st(`a[${cur.w}] found: HIT`, 'tx-ok');
            // arrows: processor <-> level 1, level 1 <-> level 2
            const a1 = fr.ph === 'look' || fr.ph === 'hit' || fr.ph === 'fetch';
            G.ar1.forEach(([x1, y1, x2, y2], k) => {
              const on = a1 && (k === 0 || fr.ph !== 'look');
              kids.push(s('line', { x1, y1, x2, y2, class: 's-line', 'stroke-width': on ? 3 : 1.5, 'marker-end': 'url(#arr-cpu)', style: on ? 'stroke:var(--cpu)' : '' }));
            });
            (G.ar1L || []).forEach(([x, y, str]) => kids.push(s('text', { x, y, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, str)));
            const a2 = fr.ph === 'fetch';
            const [bx1, by1, bx2, by2] = G.ar2;
            kids.push(s('line', { x1: bx1, y1: by1, x2: bx2, y2: by2, class: 's-line', 'stroke-width': a2 ? 4 : 1.5, 'marker-end': a2 ? 'url(#arr-mem)' : 'url(#arr-muted)', style: a2 ? 'stroke:var(--mem)' : 'stroke:var(--line-2)' }));
            G.ar2L.forEach(([x, y, anc, str]) => kids.push(s('text', { x, y, 'text-anchor': anc, 'font-size': 13, class: a2 ? 'tx-mem' : 's-sub', 'font-weight': a2 ? 800 : 400 }, str)));
            // time strip
            const [sy0, shh, sty] = G.strip;
            let x = G.sx;
            READS.forEach((rd, r) => {
              const partial = fr.ph === 'look' && r === 0;
              if (r >= fr.done && !partial) return;
              const w = partial ? U : rd.hit ? U : 11 * U;
              kids.push(s('rect', { x: x + 1, y: sy0, width: w - 2, height: shh, rx: NW ? 3 : 5, class: partial ? 's-warn' : rd.hit ? 's-ok' : 's-bad', 'stroke-width': 1.5, 'stroke-dasharray': partial ? '4 3' : null }));
              if (!NW || !(rd.hit || partial)) kids.push(s('text', { x: x + w / 2, y: sty, 'text-anchor': 'middle', 'font-size': rd.hit ? 13 : NW ? 12.5 : 14, 'font-weight': 700 }, rd.hit || partial ? String(rd.n) : NW ? 'read 1: miss, 1.1 µs' : 'read 1: miss, 1.1 µs'));
              x += w;
            });
            // tally
            const done = fr.done, hits = READS.slice(0, done).filter((r) => r.hit).length, miss = done - hits;
            const tot = hits * T1 + miss * (T1 + T2) + (fr.ph === 'look' ? T1 : 0);   // while looking, T1 is already spent
            const items = [['Reads', done], ['Hits', hits], ['Misses', miss], [NW ? 'Time' : 'Time so far', tot.toFixed(1) + ' µs'], [NW ? 'Average' : 'Average per read', done ? fmt(tot / done, 3) + ' µs' : '—']];
            const lines = NW ? [items.slice(0, 3), items.slice(3)] : [items];
            lines.forEach((ln, li) => {
              const tl = s('text', { x: G.tally[li][0], y: G.tally[li][1], 'font-size': G.fs });
              ln.forEach(([k, v], i) => tl.append(s('tspan', { class: 's-sub', dx: i ? (NW ? 16 : 26) : 0 }, k), s('tspan', { 'font-weight': 800, dx: 6 }, String(v))));
              kids.push(tl);
            });
            if (fr.ph === 'sum' || fr.ph === 'rule') kids.push(s('text', { x: G.hLab[0], y: G.hLab[1], 'text-anchor': G.hLab[2], 'font-size': G.fs, 'font-weight': 800, class: 'tx-acc' }, 'H = 19 / 20 = 0.95'));
            dyn.replaceChildren(...kids);
          }
          const player = ctx.ui.player({ count: F.length, render: (i) => { draw(i); return CAP[i]; }, interval: 2600 });
          el.append(h('div', { class: 'stack fill' }, h('div', { class: 'card white', style: { padding: '8px 12px', flex: 'none' } }, svg), player.el));
        },
      },
      /* ---------------------------------------------------------------- 6. Calculator */
      {
        title: 'Average access time calculator',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          let H = 0.95, T1 = 0.1, T2 = 1;
          const n2 = (v) => fmt(v, 2), n4 = (v) => fmt(v, 4);
          const sH = ctx.ui.slider({ label: '<span class="t" data-t="hit ratio">Hit ratio</span> H', min: 0, max: 1, step: 0.01, value: H, format: (v) => v.toFixed(2), onInput: (v) => { H = v; paint(); } });
          const sT1 = ctx.ui.slider({ label: 'T1 (level 1)', min: 0.01, max: 0.5, step: 0.01, value: T1, format: (v) => v.toFixed(2) + ' µs', onInput: (v) => { T1 = v; paint(); } });
          const sT2 = ctx.ui.slider({ label: 'T2 (level 2)', min: 0.5, max: 10, step: 0.1, value: T2, format: (v) => v.toFixed(1) + ' µs', onInput: (v) => { T2 = v; paint(); } });
          const preset = (label, h1, t1, t2, cls = 'btn sm') => h('button', { class: cls, type: 'button', html: label, onclick: () => { H = h1; T1 = t1; T2 = t2; sH.set(H); sT1.set(T1); sT2.set(T2); paint(); } });
          const formula = h('div', { class: 'card white tight mono', style: { fontSize: '15.5px', lineHeight: '1.65' } });
          const outTs = h('div', { class: 'big', style: { fontSize: '32px' } });
          const outSlow = h('div', { class: 'big', style: { fontSize: '26px' } });
          const outFast = h('div', { class: 'big', style: { fontSize: '26px' } });
          const fastSub = h('div', { class: 'xs muted' });
          const tip = h('div', { class: 'callout tip m0 small', 'data-label': 'What the graph shows' });
          // graph: Ts against H. zoom = the smallest H shown (0 = full range, 0.8 = zoom on the useful region)
          let zoom = 0;
          const NW = ctx.narrow, VBW = NW ? 420 : 640, VBH = NW ? 318 : 398;
          const X0 = NW ? 52 : 74, X1 = VBW - 28, Y0 = 24, Y1 = VBH - 54;
          const svg = s('svg', { viewBox: `0 0 ${VBW} ${VBH}`, width: '100%', role: 'img', 'aria-label': 'Average access time versus hit ratio' });
          const gx = (hh) => X0 + (X1 - X0) * (hh - zoom) / (1 - zoom);
          const axes = s('g'), dyn = s('g');
          svg.append(axes, dyn,
            s('line', { x1: X0, y1: Y1, x2: X1 + 6, y2: Y1, class: 's-line', 'stroke-width': 1.5 }),
            s('line', { x1: X0, y1: Y1, x2: X0, y2: Y0 - 8, class: 's-line', 'stroke-width': 1.5 }),
            s('text', { x: (X0 + X1) / 2, y: VBH - 7, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700 }, NW ? 'Hit ratio H' : 'Hit ratio H  (fraction of accesses found in level 1)'),
            s('text', { x: 16, y: (Y0 + Y1) / 2, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, transform: `rotate(-90 16 ${(Y0 + Y1) / 2})` }, NW ? 'Ts (µs)' : 'Average access time Ts (µs)'));
          const legCur = h('span');
          const legEx = h('span', { html: '<span style="display:inline-block;width:12px;height:12px;border:2px dashed var(--warn);border-radius:50%;vertical-align:-1px"></span> worked example: <b class="c-warn">H = 0.95 → Ts = 0.15 µs</b>' });
          const zoomSeg = ctx.ui.seg([{ value: 0, label: 'H from 0 to 1' }, { value: 0.8, label: 'Zoom: H from 0.8 to 1' }], 0, (v) => { zoom = v; paint(); });
          function paint() {
            const Ts = avgTime(H, T1, T2), yMax = avgTime(zoom, T1, T2) * 1.12;
            const gy = (v) => Y1 - (Y1 - Y0) * v / yMax;
            const miss = 1 - H;
            formula.innerHTML = `Ts = H × T1 + (1 − H) × (T1 + T2)<br>
              &nbsp;&nbsp; = <b class="c-acc">${n2(H)}</b> × <b class="c-cpu">${n2(T1)}</b> + <b class="c-bad">${n2(miss)}</b> × (<b class="c-cpu">${n2(T1)}</b> + <b class="c-mem">${fmt(T2, 1)}</b>)<br>
              &nbsp;&nbsp; = ${n4(H * T1)} + ${n4(miss * (T1 + T2))}<br>
              &nbsp;&nbsp; = <b class="c-acc" style="font-size:18px">${n4(Ts)} µs</b>`;
            outTs.textContent = n4(Ts) + ' µs';
            outSlow.textContent = fmt(Ts / T1, 2) + '×';
            outFast.textContent = fmt(T2 / Ts, 1) + '×';
            fastSub.textContent = T2 / Ts >= 1 ? 'T2 ÷ Ts: faster' : 'slower than level 2 alone!';
            const hMin = 1 - T1 / T2;
            tip.innerHTML = T1 >= T2
              ? `<b>Level 1 is no faster than level 2 here</b> (T1 = ${n2(T1)} µs, T2 = ${fmt(T2, 1)} µs), so it cannot help: every miss even pays for both. A real hierarchy puts the <b>faster</b> memory on top. Raise T2 or lower T1.`
              : `The line is <b>straight</b>: each 0.01 drop in H adds 0.01 × T2 = ${fmt(0.01 * T2, 3)} µs. It runs from T1 + T2 at H = 0 down to T1 at H = 1. To keep Ts within <b>2 × T1</b>, H must be at least 1 − T1/T2 = <b>${hMin.toFixed(2)}</b>.`;
            // x ticks for the current range
            const ax = [];
            const step = zoom ? 0.02 : 0.1;
            for (let v = zoom; v <= 1.0001; v += step) {
              const x = gx(v), major = zoom ? (!NW || Math.round(v * 100) % 4 === 0) : Math.round(v * 10) % 2 === 0;
              ax.push(s('line', { x1: x, y1: Y1, x2: x, y2: Y1 + 6, class: 's-line', 'stroke-width': 1.2 }));
              if (major) ax.push(s('text', { x, y: Y1 + 22, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, v.toFixed(zoom ? 2 : 1)));
            }
            axes.replaceChildren(...ax);
            const kids = [];
            // dashed reference lines: T1 (the best possible) and, when visible, T1 + T2 (every access misses)
            const refs = [[T1, 'T1 = ' + n2(T1) + (NW ? '' : ' (every access hits)')]];
            if (!zoom) refs.push([T1 + T2, 'T1 + T2 = ' + n2(T1 + T2) + (NW ? '' : ' (every access misses)')]);
            refs.forEach(([v, lab], i) => {
              kids.push(s('line', { x1: X0, y1: gy(v), x2: X1, y2: gy(v), class: 's-muted', 'stroke-dasharray': '5 5', 'stroke-width': 1.3 }),
                s('text', { x: X0 - 6, y: gy(v) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, fmt(v, 2)),
                s('text', { x: i === 0 ? X0 + 8 : X1 - 4, y: gy(v) - 7, 'text-anchor': i === 0 ? 'start' : 'end', 'font-size': 13, class: 's-sub' }, lab));
            });
            if (gy(T1) < Y1 - 16) kids.push(s('text', { x: X0 - 6, y: Y1 + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, '0'));
            const top = avgTime(zoom, T1, T2);
            kids.push(s('text', { x: X0 - 6, y: gy(top) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, zoom ? fmt(top, 2) : ''));
            kids.push(s('line', { x1: gx(zoom), y1: gy(top), x2: gx(1), y2: gy(T1), class: 's-line', 'stroke-width': 3, style: 'stroke:var(--accent)' }));
            const exOn = Math.abs(T1 - 0.1) < 1e-9 && Math.abs(T2 - 1) < 1e-9;
            if (exOn) kids.push(s('circle', { cx: gx(0.95), cy: gy(0.15), r: 12, fill: 'none', style: 'stroke:var(--warn)', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));
            legEx.style.visibility = exOn ? 'visible' : 'hidden';
            legCur.innerHTML = `<b class="c-acc">●</b> your setting: <b class="c-acc">H = ${H.toFixed(2)} → Ts = ${n4(Ts)} µs</b>`;
            if (H >= zoom - 1e-9) {
              const px = gx(H), py = gy(Ts);
              kids.push(s('line', { x1: px, y1: py, x2: px, y2: Y1, class: 's-muted', 'stroke-dasharray': '3 4', style: 'stroke:var(--accent)', 'stroke-width': 1.5 }),
                s('circle', { cx: px, cy: py, r: 8, class: 's-accent', 'stroke-width': 3 }));
            } else {
              kids.push(s('text', { x: X0 + 12, y: Y0 + 14, 'font-size': 14, 'font-weight': 700, class: 'tx-warn' }, `H = ${H.toFixed(2)} is left of this zoomed view`));
            }
            dyn.replaceChildren(...kids);
          }
          const readout = (lab, out, sub) => h('div', { class: 'card tight center' }, h('h4', { text: lab }), out, typeof sub === 'string' ? h('div', { class: 'xs muted', text: sub }) : sub);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack gap-s' },
              sH, sT1, sT2,
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', text: 'TRY:' }), preset('Worked example', 0.95, 0.1, 1, 'btn sm primary'), preset('H = 0.5', 0.5, 0.1, 1), preset('H = 0.99', 0.99, 0.1, 1), preset('Slow level 2', 0.95, 0.1, 10)),
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', text: 'GRAPH:' }), zoomSeg),
              formula,
              h('div', { class: 'grid-3', style: { gap: '8px' } }, readout('Average Ts', outTs, 'per access'), readout('vs level 1', outSlow, 'Ts ÷ T1: slower'), readout('vs level 2', outFast, fastSub)),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'A miss costs <b>T1 + T2</b>, not just T2: the processor already spent T1 looking in level 1 before it went down to level 2.' })),
            h('div', { class: 'stack gap-s' }, h('div', { class: 'card white', style: { padding: '8px 10px 6px', flex: 'none' } }, svg,
              h('div', { class: 'row small', style: { justifyContent: 'center', gap: '22px' } }, legCur, legEx)), tip)));
          paint();
        },
      },
      /* ---------------------------------------------------------------- 7. Locality lab */
      {
        title: 'Locality lab: why most accesses hit',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const PAT = {
            loop: { label: 'Loop', note: 'An 8-instruction loop (addresses 64–71) runs 8 times: <b>temporal locality</b>. Only the first pass can miss. Pick block size 1 word and 8 blocks: pass 1 misses all 8 instructions, then every later pass hits. Now drop to 7 blocks: the loop no longer fits, each instruction is thrown out just before it is needed again, and the hits vanish.' },
            array: { label: 'Array scan', note: 'A 3-instruction loop adds up an array that starts at address 160. The code repeats (<b>temporal</b>); the data marches forward one word at a time (<b>spatial</b>). Try block size 1: every array element misses.' },
            sub: { label: 'Subroutine', note: 'The main program walks forward and calls the same 6-instruction subroutine (addresses 200–205) on every pass. The subroutine stays in fast memory because it keeps being reused.' },
            seq: { label: 'Straight-line', note: 'Instructions run one after another with no loop: only <b>spatial</b> locality helps. Each miss brings the next few instructions along, so bigger blocks mean fewer misses. With block size 1, nothing ever hits.' },
            rand: { label: 'Random', note: 'Addresses picked at random from all of memory: <b>no locality</b>. Almost every access misses, whatever you change. Real programs look nothing like this, which is exactly why hierarchies work.' },
          };
          let pat = 'loop', B = 4, N = 4, sim = [];
          const NW = ctx.narrow, VBW = NW ? 420 : 660, VBH = NW ? 250 : 300;
          const PX0 = NW ? 50 : 56, PX1 = VBW - 12, PY0 = 12, PY1 = VBH - 46, DOT = NW ? 3 : 4.2;
          const xOf = (t) => PX0 + (PX1 - PX0) * (t + 0.5) / LOC_N;
          const yOf = (a) => PY1 - (PY1 - PY0) * (a + 0.5) / 256;
          const svg = s('svg', { viewBox: `0 0 ${VBW} ${VBH}`, width: '100%', role: 'img', 'aria-label': 'Memory address against time' });
          svg.append(s('rect', { x: PX0, y: PY0, width: PX1 - PX0, height: PY1 - PY0, class: 's-panel', 'stroke-width': 1 }));
          [0, 64, 128, 192, 255].forEach((a) => svg.append(s('text', { x: PX0 - 6, y: yOf(a) + 4, 'text-anchor': 'end', 'font-size': NW ? 11.5 : 12.5, class: 's-sub' }, String(a))));
          [1, 16, 32, 48, 64].forEach((n) => svg.append(s('text', { x: xOf(n - 1), y: PY1 + 17, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(n))));
          svg.append(s('text', { x: (PX0 + PX1) / 2, y: VBH - 6, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'Reference number (time →)'),
            s('text', { x: 12, y: (PY0 + PY1) / 2, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, transform: `rotate(-90 12 ${(PY0 + PY1) / 2})` }, 'Address'));
          const dyn = s('g');
          svg.append(dyn);
          const slotsRow = h('div', { class: 'row gap-s' });
          const stats = h('div', { class: 'row gap-s' });
          const note = h('div', { class: 'card tight small' });
          const range = (blk) => (B === 1 ? String(blk) : `${blk * B}–${blk * B + B - 1}`);
          function draw(i) {
            const kids = [];
            const last = i > 0 ? sim[i - 1] : null;
            // bands: the blocks sitting in fast memory right now
            (last ? last.resident : []).forEach((blk) => {
              const yTop = yOf(blk * B + B - 1) - (PY1 - PY0) * 0.5 / 256, yBot = yOf(blk * B) + (PY1 - PY0) * 0.5 / 256;
              kids.push(s('rect', { x: PX0 + 1, y: Math.min(yTop, (yTop + yBot) / 2 - 1.5), width: PX1 - PX0 - 2, height: Math.max(3, yBot - yTop), style: 'fill:var(--accent);opacity:.16' }));
            });
            sim.slice(0, i).forEach((r, t) => kids.push(s('circle', { cx: xOf(t), cy: yOf(r.a), r: DOT, class: r.hit ? 's-ok' : 's-bad', 'stroke-width': 1.4 })));
            if (last) kids.push(s('circle', { cx: xOf(i - 1), cy: yOf(last.a), r: DOT * 2, fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 2.5 }));
            dyn.replaceChildren(...kids);
            // fast-memory slots
            const res = last ? last.resident : [];
            slotsRow.replaceChildren(h('span', { class: 'xs muted b', text: `FAST MEMORY, ${N} × ${B}:` }),
              ...Array.from({ length: N }, (_, k) => h('span', { style: { fontSize: '12px', padding: '0 7px' }, class: 'chip mono ' + (res[k] != null ? (last && res[k] === last.blk ? (last.hit ? 'ok' : 'bad') : 'accent') : ''), text: res[k] != null ? range(res[k]) : 'empty' })));
            const hits = last ? last.hits : 0, miss = last ? last.misses : 0;
            const Hr = i ? hits / i : 0;
            stats.innerHTML = `<span class="chip">refs ${i}</span><span class="chip ok">hits ${hits}</span><span class="chip bad">misses ${miss}</span>
              <span class="chip accent">H = ${i ? Hr.toFixed(3) : '—'}</span><span class="chip">Ts = ${i ? fmt(avgTime(Hr, 0.1, 1), 3) + ' µs' : '—'} <span class="muted" style="font-weight:600">(T1 = 0.1, T2 = 1)</span></span>`;
            if (!last) return `<b>${PAT[pat].label}.</b> ${LOC_N} memory references are ready. Press play (or step) and watch where they land. Red = miss, green = hit; the shaded bands are the blocks now in fast memory.`;
            if (i === LOC_N) return `<b>Done.</b> ${hits} of ${LOC_N} references hit, so <b>H = ${hits}/${LOC_N} ≈ ${Hr.toFixed(3)}</b> and the average access time is <b>${fmt(avgTime(Hr, 0.1, 1), 3)} µs</b> (level 1 alone: 0.1 µs). ${Hr > 0.85 ? `Only ${miss} of ${LOC_N} references had to go down to the slow level: locality keeps its share of the work tiny.` : Hr > 0.5 ? `Locality helps, but ${miss} of ${LOC_N} references (${Math.round(miss / LOC_N * 100)}%) still went down to the slow level.` : 'Little usable locality with these settings: most accesses go to the slow level.'}`;
            if (last.hit) return `Ref ${i}: address <b>${last.a}</b> is in block ${range(last.blk)}, already in fast memory: <b>hit</b>. ${last.kind === 'temporal' ? 'This exact address was used before (temporal locality).' : 'Never used before, but it came up with a neighbour (spatial locality).'}`;
            return `Ref ${i}: address <b>${last.a}</b> is not in fast memory: <b>miss</b>. Block ${range(last.blk)} is copied up from the slow level${last.victim != null ? `, replacing block ${range(last.victim)}, the one unused the longest` : ''}.`;
          }
          const player = ctx.ui.player({ count: LOC_N + 1, render: draw, interval: 360 });
          function rerun() { sim = locSimulate(locPattern(pat), B, N); note.innerHTML = PAT[pat].note; player.setCount(LOC_N + 1, true); }
          const segPat = ctx.ui.seg(Object.entries(PAT).map(([k, v]) => ({ value: k, label: v.label })), pat, (v) => { pat = v; rerun(); });
          const segB = ctx.ui.seg([{ value: 1, label: '1 word' }, { value: 4, label: '4 words' }, { value: 8, label: '8 words' }], B, (v) => { B = v; rerun(); });
          const slN = ctx.ui.slider({ label: 'Fast memory size', min: 1, max: 8, step: 1, value: N, format: (v) => v + (v === 1 ? ' block' : ' blocks'), onInput: (v) => { N = v; rerun(); } });
          const toEnd = h('button', { class: 'btn sm', type: 'button', text: 'Jump to end', onclick: () => { player.stop(); player.go(LOC_N); } });
          player.el.querySelector('.player-ctl').append(toEnd);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack gap-s' },
              h('p', { class: 'm0', html: 'Programs do not touch memory at random. Over any short stretch of time their references <b>cluster</b> in a few small areas, and those areas drift slowly. This is <span class="t">locality of reference</span>.' }),
              h('div', { class: 'grid-2', style: { gap: '8px' } },
                h('div', { class: 'card tight small', html: '<b class="c-acc"><span class="t">Temporal locality</span></b><br>The <b>same</b> address is used again soon: loop instructions, counters, a subroutine called repeatedly.' }),
                h('div', { class: 'card tight small', html: '<b class="c-acc"><span class="t">Spatial locality</span></b><br>Addresses <b>next to</b> recent ones are used soon: instructions in sequence, array elements in order.' })),
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', text: 'PROGRAM' }), segPat),
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', text: 'BLOCK SIZE' }), segB),
              slN, note),
            h('div', { class: 'stack gap-s' },
              h('div', { class: 'card white', style: { padding: '6px 10px', flex: 'none' } }, svg),
              slotsRow, stats, player.el)));
          rerun();
        },
      },
      /* ---------------------------------------------------------------- 8. The access funnel (three levels) */
      {
        title: 'The funnel: each level down sees far fewer accesses',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const TOTAL = 1e6;                                   // references issued by the processor
          const TC = 1, TM = 100, TD = 5e6;                    // access times in ns: cache, main memory, magnetic disk (5 ms)
          const ODDS = [100, 1e3, 1e4, 1e5, 1e6, 1e7];         // "1 in N" main-memory accesses must go on to the disk
          let hc = 0.95, oi = 3;
          const num = (x) => (x >= 10 ? Math.round(x).toLocaleString('en-US') : fmt(x, x >= 1 ? 1 : 3));
          const share = (f) => (f >= 0.999 ? 'all of them' : f >= 0.01 ? fmt(f * 100, 1) + '% of all' : '1 in ' + Math.round(1 / f).toLocaleString('en-US'));
          const time = (ns) => (ns >= 1000 ? fmt(ns / 1000, 2) + ' µs' : fmt(ns, 2) + ' ns');
          const LV = [
            { name: 'Cache', t: '≈ 1 ns each', col: 'accent', c: 'c-acc' },
            { name: 'Main memory', t: '≈ 100 ns each', col: 'mem', c: 'c-mem' },
            { name: 'Magnetic disk', t: '≈ 5 ms each', col: 'io', c: 'c-io' },
          ];
          const rows = LV.map((lv) => {
            const bar = h('i', { style: { background: `var(--${lv.col})` } });
            const out = h('div', { class: 'small' });
            const row = h('div', { class: 'fn-row' },
              h('div', {}, h('div', { class: 'b ' + lv.c, text: lv.name }), h('div', { class: 'xs muted', text: lv.t })),
              h('div', { class: 'fn-bar' }, bar), out);
            return { row, bar, out };
          });
          const downs = [h('div', { class: 'fn-down' }), h('div', { class: 'fn-down' })];
          const tsOut = h('span', { class: 'big', style: { fontSize: '30px' } });
          const tBar = h('div', { class: 'fn-time' }, ...LV.map((lv) => h('i', { style: { background: `var(--${lv.col})` } })));
          const tKey = h('div', { class: 'xs', style: { marginTop: '5px' } });
          const say = h('div', { class: 'callout m0 small' });
          function paint() {
            const N = ODDS[oi], m = 1 / N;
            const reach = [TOTAL, TOTAL * (1 - hc), TOTAL * (1 - hc) * m];        // references that arrive at each level
            const served = [reach[0] - reach[1], reach[1] - reach[2], reach[2]];  // references finished at each level
            reach.forEach((r, i) => {
              rows[i].bar.style.width = (r / TOTAL * 100) + '%';
              rows[i].out.innerHTML = `<b style="font-size:17px">${num(r)}</b> arrive <span class="xs muted">(${share(r / TOTAL)})</span><br><span class="xs muted">${i < 2 ? num(served[i]) + ' finished here' : r < 1 ? 'on average; all finished here' : 'all finished here'}</span>`;
            });
            downs[0].textContent = `↓ ${num(reach[1])} cache misses (${fmt((1 - hc) * 100, 0)}%) go on to main memory`;
            downs[1].textContent = `↓ of those, 1 in ${N.toLocaleString('en-US')} also misses and goes on to the disk`;
            // every reference pays the cache time; a cache miss adds TM; a main-memory miss adds TD as well
            const part = [TC, (1 - hc) * TM, (1 - hc) * m * TD], Ts = part[0] + part[1] + part[2];
            tsOut.textContent = time(Ts);
            [...tBar.children].forEach((seg, i) => { seg.style.width = (part[i] / Ts * 100) + '%'; });
            tKey.innerHTML = LV.map((lv, i) => `<span class="fn-key" style="background:var(--${lv.col})"></span>${lv.name.toLowerCase()} ${time(part[i])}`).join(' &nbsp;+&nbsp; ') + ` &nbsp;= <b>${time(Ts)}</b>`;
            const diskShare = part[2] / Ts;
            if (diskShare > 0.5) {
              say.className = 'callout warn m0 small'; say.setAttribute('data-label', 'The disk dominates');
              say.innerHTML = `Only ${num(reach[2])} of a million references reach the disk, yet they cause <b>${fmt(diskShare * 100, 0)}%</b> of the average time: each one costs as much as 50,000 main-memory accesses. The lower a level, the <b>more rarely</b> it must be visited. Drag “Main memory misses” to the right to make disk trips rarer.`;
            } else {
              say.className = 'callout tip m0 small'; say.setAttribute('data-label', 'Locality at work');
              say.innerHTML = `Every reference starts at the cache, ${fmt((1 - hc) * 100, 0)}% reach main memory and only 1 in ${Math.round(N / (1 - hc)).toLocaleString('en-US')} reach the disk. Each level down sees a <b>far smaller fraction</b> than the one above, so the average (<b>${time(Ts)}</b>) stays near cache speed while almost all the bits sit on the cheap disk.`;
            }
          }
          const sHc = ctx.ui.slider({ label: 'Cache hit ratio', min: 0.8, max: 0.99, step: 0.01, value: hc, format: (v) => v.toFixed(2), onInput: (v) => { hc = v; paint(); } });
          const sOdds = ctx.ui.slider({ label: 'Main memory misses', min: 0, max: ODDS.length - 1, step: 1, value: oi, format: (v) => '1 in ' + ODDS[v].toLocaleString('en-US'), onInput: (v) => { oi = v; paint(); } });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack gap-s' },
              h('p', { class: 'm0', html: 'Locality works at <b>every</b> level. Follow <b>one million</b> memory references from the processor down through the cache, main memory and the disk. Each level serves what it can; only its misses travel further down.' }),
              sHc, sOdds,
              h('div', { class: 'callout tip m0 small', 'data-label': 'Same rule, one more level', html: 'Every reference pays the cache time. A cache miss adds the main-memory time, and a main-memory miss adds the disk time too:<div class="mono" style="margin-top:4px">Ts = 1 ns + (1 − Hc) × (100 ns + m × 5 ms)</div>where Hc is the cache hit ratio and m is the fraction of main-memory accesses that go to disk.' }),
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'This is trend (d) from the pyramid: the frequency of access falls going down. It <b>must</b> fall steeply, because each level is far slower than the one above. The OS helps by keeping each program’s active data in main memory.' })),
            h('div', { class: 'stack gap-s' },
              rows[0].row, downs[0], rows[1].row, downs[1], rows[2].row,
              h('div', { class: 'card white tight' },
                h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' } }, h('h4', { class: 'm0', text: 'Average access time Ts' }), tsOut),
                tBar, tKey),
              say)));
          paint();
        },
      },
      /* ---------------------------------------------------------------- 9. Secondary memory and the disk cache */
      {
        title: 'Secondary memory and the disk cache',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const REQ = [['R', 12], ['R', 13], ['R', 12], ['W', 12], ['W', 13], ['W', 12], ['R', 13], ['W', 14], ['R', 12], ['F']];
          const reqLabel = (r) => (r[0] === 'F' ? 'flush' : (r[0] === 'R' ? 'read ' : 'write ') + r[1]);
          const CAP = [
            'A program works on a file stored in disk blocks 10–15. Both computers run the same ten requests (R = read a block, W = write a block). The top lane has <b>no disk cache</b>; the bottom lane keeps a <b>disk cache</b> in main memory.',
            '<b>Read block 12.</b> Neither lane has it in memory yet, so both make a disk trip (≈ 5 ms each). The bottom lane keeps a copy in its disk cache.',
            '<b>Read block 13.</b> Both go to the disk again. First uses always miss, so the cache has not helped yet.',
            '<b>Read block 12 again.</b> Top: another disk trip. Bottom: found in main memory, no trip at all. Data referenced again is often still in the disk cache.',
            '<b>Write block 12.</b> Top: a disk trip. Bottom: the new data goes into the cached copy, marked <b>*</b> (changed). The disk copy is now out of date and will be updated later.',
            '<b>Write block 13.</b> Top: one more disk trip. Bottom: block 13 is already cached from the earlier read, so the new data simply replaces the cached copy, marked *. Two changed blocks now wait in memory.',
            '<b>Write block 12 again.</b> The top lane writes it to disk a second time. Below, the cached copy is simply overwritten, so the first write never needed to reach the disk at all.',
            '<b>Read block 13.</b> The bottom lane already holds the newest version in memory. The top lane goes back to the disk.',
            '<b>Write block 14.</b> Top: a disk trip. Bottom: kept in the cache and marked changed.',
            '<b>Read block 12.</b> Top: yet another trip. Bottom: a hit.',
            '<b>Flush.</b> The OS writes every changed block (12, 13, 14) to disk in <b>one</b> clustered trip, since they sit side by side. Total: <b>9 trips (≈ 45 ms)</b> without a cache against <b>3 trips (≈ 15 ms)</b> with one.',
          ];
          function stateAt(f) {
            const A = { trips: 0, act: '', touch: null }, Bs = { trips: 0, act: '', touch: [], disk: [], cache: new Map(), stale: new Set() };
            REQ.slice(0, f).forEach((r, k) => {
              const last = k === f - 1;
              if (r[0] !== 'F') { A.trips++; if (last) { A.act = `<span class="chip bad">disk trip</span> ${reqLabel(r)} goes to the disk`; A.touch = r[1]; } }
              else if (last) { A.act = '<span class="chip">no trip</span> nothing to flush: every write already went to disk'; A.touch = null; }
              if (r[0] === 'R') {
                if (Bs.cache.has(r[1])) { if (last) Bs.act = `<span class="chip ok">hit</span> block ${r[1]} found in the disk cache`; }
                else { Bs.trips++; Bs.cache.set(r[1], false); if (last) { Bs.act = `<span class="chip bad">disk trip</span> block ${r[1]} read from disk into the cache`; Bs.disk = [r[1]]; } }
                if (last) Bs.touch = [r[1]];
              } else if (r[0] === 'W') {
                Bs.cache.set(r[1], true); Bs.stale.add(r[1]);
                if (last) { Bs.act = `<span class="chip accent">no trip</span> written into the cached copy, marked *`; Bs.touch = [r[1]]; }
              } else {
                const dirty = [...Bs.cache].filter(([, d]) => d).map(([b]) => b);
                if (dirty.length) Bs.trips++;
                dirty.forEach((b) => Bs.cache.set(b, false)); Bs.stale.clear();
                if (last) { Bs.act = `<span class="chip bad">1 disk trip</span> blocks ${dirty.join(', ')} written together`; Bs.touch = dirty; Bs.disk = dirty; }
              }
            });
            return { A, B: Bs };
          }
          const strip = h('div', { class: 'row gap-s' });
          const reqEls = REQ.map((r) => h('span', { class: 'dc-req', text: r[0] === 'F' ? 'flush' : r[0] + ' ' + r[1] }));
          strip.append(h('span', { class: 'xs muted b', text: 'REQUESTS:' }), ...reqEls);
          const lane = (title) => {
            const trips = h('span', { class: 'big', style: { fontSize: '26px' } });
            const ms = h('span', { class: 'small muted' });
            const memBox = h('div', { class: 'dc-box mem' }), diskBox = h('div', { class: 'dc-box io' });
            const act = h('div', { class: 'small', style: { minHeight: '26px' } });
            const card = h('div', { class: 'card white tight dc-lane' },
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'b', html: title }), h('span', { class: 'row nw gap-s' }, h('span', { class: 'xs muted b', text: 'DISK TRIPS' }), trips, ms)),
              h('div', { class: 'dc-grid' }, memBox, diskBox), act);
            return { card, trips, ms, memBox, diskBox, act };
          };
          const LA = lane('Without a disk cache'), LB = lane('With a disk cache <span class="chip os">OS software</span>');
          let cur = 0, cut = false;
          const blk = (txt, cls) => h('span', { class: 'dc-blk ' + (cls || ''), text: txt });
          function paint(f) {
            cur = f;
            const { A, B } = stateAt(f);
            reqEls.forEach((e, k) => { e.classList.toggle('on', k === f - 1); e.classList.toggle('done', k < f - 1); });
            LA.trips.textContent = A.trips; LA.ms.textContent = '≈ ' + A.trips * 5 + ' ms';
            LB.trips.textContent = B.trips; LB.ms.textContent = '≈ ' + B.trips * 5 + ' ms';
            LA.memBox.replaceChildren(h('div', { class: 'lab', text: 'MAIN MEMORY' }), h('div', { class: 'small muted', text: cut ? 'wiped by the power cut' : 'no disk cache: every request goes to the disk' }));
            const cached = [...B.cache.keys()].sort((p, q) => p - q);
            LB.memBox.replaceChildren(h('div', { class: 'lab', text: 'MAIN MEMORY · DISK CACHE' }),
              h('div', {}, ...(cached.length ? cached.map((b) => blk(b + (B.cache.get(b) ? '*' : ''), cut ? (B.cache.get(b) ? 'lost' : 'gone') : (B.cache.get(b) ? 'dirty' : '') + (B.touch.includes(b) ? ' hl' : ''))) : [h('span', { class: 'small muted', text: 'empty' })])));
            LA.diskBox.replaceChildren(h('div', { class: 'lab', text: 'DISK (nonvolatile)' }), h('div', {}, ...[10, 11, 12, 13, 14, 15].map((b) => blk(b, b === A.touch ? 'hl' : ''))));
            LB.diskBox.replaceChildren(h('div', { class: 'lab', text: 'DISK (nonvolatile)' }), h('div', {}, ...[10, 11, 12, 13, 14, 15].map((b) => blk(B.stale.has(b) ? b + ' old' : b, (B.stale.has(b) ? 'stale' : '') + (B.disk.includes(b) ? ' hl' : '')))));
            LA.act.innerHTML = f ? A.act : '<span class="muted">waiting for the first request</span>';
            LB.act.innerHTML = f ? B.act : '<span class="muted">waiting for the first request</span>';
          }
          const player = ctx.ui.player({ count: REQ.length + 1, interval: 2600, render: (i) => { cut = false; paint(i); return CAP[i]; } });
          const powerBtn = h('button', { class: 'btn sm intr', type: 'button', text: 'Power cut now?', onclick: () => {
            player.stop(); cut = true; paint(cur);
            const dirty = [...stateAt(cur).B.cache].filter(([, d]) => d).map(([b]) => b);
            player.caption.innerHTML = dirty.length
              ? `<b>Power cut!</b> Main memory is <span class="t" data-t="volatile memory">volatile</span>, so the disk cache vanishes. The changes to block${dirty.length > 1 ? 's' : ''} <b>${dirty.join(', ')}</b> had not reached the disk yet and are <b>lost</b>. The disk is <span class="t" data-t="nonvolatile memory">nonvolatile</span>, so everything already written survives. This is why the OS writes changed blocks back regularly (typically within seconds) and flushes everything at shutdown. (The top lane loses nothing, but it paid a disk trip for every write.)`
              : '<b>Power cut!</b> Main memory is <span class="t" data-t="volatile memory">volatile</span>, so the disk cache vanishes, but nothing is lost: no changes were waiting in it. The <span class="t" data-t="nonvolatile memory">nonvolatile</span> disk holds everything. Press next or back to resume.';
          } });
          player.el.querySelector('.player-ctl').append(powerBtn);
          el.append(h('div', { class: 'split l fill', style: { gridTemplateColumns: 'minmax(0,4fr) minmax(0,7fr)' } },
            h('div', { class: 'stack gap-s' },
              h('p', { class: 'm0', html: 'Below main memory sits <span class="t">secondary memory</span> (met in 1.1, also called auxiliary memory): SSDs and disks. It is <b>nonvolatile</b>, so files survive with the power off, but it is thousands of times slower than main memory.' }),
              h('p', { class: 'm0', html: 'The OS plays the hierarchy trick again, one level down: it sets aside part of main memory as a <span class="t">disk cache</span>, a buffer for disk blocks. It is <b>software</b> (OS code plus ordinary RAM), not extra hardware.' }),
              h('div', { class: 'card tight small', html: '<b>Two payoffs</b><ul class="m0" style="margin-top:2px"><li><b>Clustered writes:</b> changes pile up in memory and go to disk later in a few large trips instead of many small ones.</li><li><b>Re-use:</b> data referenced again is often still in the cache, so it comes from memory, not the disk.</li></ul>' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Do not mix them up', html: 'The processor <b>cache</b> (1.6) is hardware between processor and main memory. The <b>disk cache</b> is a slice of main memory, run by the OS, in front of the disk.' })),
            h('div', { class: 'stack gap-s' }, strip, LA.card, LB.card, player.el)));
        },
      },
      /* ---------------------------------------------------------------- 9. Recap */
      {
        title: 'Recap: six ideas to carry away',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0', html: 'Say each answer out loud <b>before</b> you flip the card. Click a card to check yourself.' }),
            ctx.ui.flipcards([
              ['The memory dilemma', 'Faster memory costs more per bit. Bigger memory is cheaper per bit but slower. No one technology is big, fast and cheap, so we build a <b>hierarchy</b>.'],
              ['The levels, top to bottom', '<b>Inboard:</b> registers, cache, main memory. <b>Outboard:</b> SSD, magnetic disk, optical discs. <b>Off-line:</b> magnetic tape.'],
              ['Going down the hierarchy…', 'Cost per bit <b>falls</b>, capacity <b>grows</b>, access time <b>grows</b>, and the processor uses the level <b>less often</b>.'],
              ['Average access time (two levels)', 'Ts = H × T1 + (1 − H) × (T1 + T2). With T1 = 0.1 µs, T2 = 1 µs and H = 0.95: <b>Ts = 0.15 µs</b>, close to the fast level.'],
              ['Why it works: locality', 'References <b>cluster</b>. Temporal: the same address again soon. Spatial: nearby addresses soon. So each lower level is accessed far less often than the one above.'],
              ['The disk cache', 'A slice of <b>main memory</b> that the OS (software) uses to buffer disk blocks. Writes get clustered; data used again comes from memory, not the disk.'],
            ].map(([f, b]) => [`<div>${f}</div>`, `<div>${b}</div>`]), { cols: 3, height: 150 }),
            h('div', { class: 'grid-2' },
              h('div', { class: 'callout tip m0', 'data-label': 'If you remember one thing', html: 'A hierarchy is <b>fast</b> because locality keeps most accesses in the small top levels, and <b>cheap</b> because most of its bits live in the big bottom levels.' }),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Using T2 alone as the cost of a miss. The processor checked level 1 first, so a miss costs <b>T1 + T2</b>.' }))));
        },
      },
      /* ---------------------------------------------------------------- 10. Check yourself */
      {
        title: 'Check yourself: the memory hierarchy',
        kind: 'check',
        quiz: [
          { q: 'Which statement about memory technologies is correct?',
            choices: ['Faster access time goes with a smaller cost per bit.', 'Greater capacity goes with a greater cost per bit.', 'Greater capacity goes with a greater (slower) access time.', 'Capacity and access time are unrelated.'],
            answer: 2,
            feedback: ['It is the other way round: the fastest technologies (such as SRAM) cost the most per bit.', 'Technologies that pack in more bits are cheaper per bit, not more expensive.', null, 'They are linked: the technologies that hold the most data are also the slowest to reach.'],
            why: 'Three relationships hold: faster access → greater cost per bit; greater capacity → smaller cost per bit; greater capacity → slower access time. That tension is why computers use a hierarchy.' },
          { type: 'order', q: 'Put these levels in order from the <b>top</b> of the memory hierarchy (closest to the processor) to the <b>bottom</b>.',
            items: ['Registers', 'Cache', 'Main memory', 'Magnetic disk', 'Magnetic tape'],
            why: 'Registers and cache sit in the processor, main memory completes inboard memory, magnetic disk is outboard storage, and tape is off-line storage at the bottom.' },
          { type: 'bucket', q: 'Moving <b>down</b> the memory hierarchy (from registers toward tape), does each quantity increase or decrease?',
            buckets: ['Increases', 'Decreases'],
            items: [['Cost per bit', 1], ['Capacity', 0], ['Access time', 0], ['How often the processor accesses the level', 1]],
            why: 'Going down: cost per bit decreases, capacity increases, access time increases, and the frequency of access by the processor decreases.' },
          { type: 'match', q: 'Match each term to its meaning.',
            pairs: [['Hit ratio', 'Fraction of accesses found in the faster memory'], ['Temporal locality', 'A location used recently is likely to be used again soon'], ['Spatial locality', 'Locations near a recently used one are likely to be used soon'], ['Disk cache', 'Part of main memory the OS uses to buffer disk blocks'], ['Secondary memory', 'Nonvolatile storage below main memory, such as disks, that keeps files without power']],
            why: 'H measures how well the fast level works, the two kinds of locality explain why it works, secondary memory is the permanent (nonvolatile) store below main memory, and the disk cache is the OS’s way of speeding it up.' },
          { type: 'num', q: 'A two-level memory has T1 = 0.1 µs and T2 = 1 µs. The hit ratio is H = 0.95. What is the average access time Ts, in µs?',
            answer: 0.15, tol: 0.001, unit: 'µs',
            hint: 'A hit costs T1; a miss costs T1 + T2.',
            why: 'Ts = H × T1 + (1 − H) × (T1 + T2) = 0.95 × 0.1 + 0.05 × 1.1 = 0.095 + 0.055 = 0.15 µs, close to the speed of the fast level.' },
          { type: 'num', q: 'A two-level memory has T1 = 0.1 µs and T2 = 1 µs. What hit ratio H gives an average access time of 0.3 µs? (Answer as a decimal between 0 and 1.)',
            answer: 0.8, tol: 0.005,
            hint: 'Ts = H × T1 + (1 − H) × (T1 + T2) simplifies to Ts = T1 + (1 − H) × T2.',
            why: '0.3 = 0.1 + (1 − H) × 1, so 1 − H = 0.2 and H = 0.8. Dropping H from 0.95 to 0.8 doubles the average time (0.15 µs → 0.3 µs), which is why hit ratios must stay close to 1.' },
          { q: 'In a two-level memory, how long does an access that <b>misses</b> in level 1 take?',
            choices: ['T1', 'T2', 'T1 + T2', 'T2 − T1'],
            answer: 2,
            feedback: ['T1 is the cost of a hit; a miss has to go further.', 'This forgets the time already spent looking in level 1 before going down to level 2.', null, 'Nothing is subtracted: the time spent checking level 1 is added to the level-2 time, not taken away from it.'],
            why: 'The processor first checks level 1 (T1). On a miss, the word is fetched from level 2 into level 1 (T2) and then read, so the total is T1 + T2.' },
          { q: 'Why can a small, fast memory level satisfy most of the processor’s accesses?',
            choices: ['Programs’ memory references cluster in small regions for a while (locality of reference).', 'The OS copies all of main memory into it when the computer starts.', 'The processor slows down to match the speed of the lower levels.', 'The lower levels are volatile, so data must be kept in the top level.'],
            answer: 0,
            feedback: [null, 'The fast level is far too small to hold all of main memory; it holds only what is in use now.', 'The processor does not slow down; the hierarchy hides the slow levels instead.', 'Volatility has nothing to do with it, and the lower disk levels are actually nonvolatile.'],
            why: 'Because references cluster (temporal and spatial locality), the few blocks in use right now can sit in the fast level, and the lower levels are accessed far less often.' },
          { type: 'bucket', q: 'Classify each example by the kind of locality it mainly shows.',
            buckets: ['Temporal locality', 'Spatial locality'],
            items: [['A loop’s instructions executed again on every pass', 0], ['A counter variable updated in every iteration', 0], ['Reading array elements a[0], a[1], a[2] in order', 1], ['Executing straight-line instructions one after another', 1], ['Calling the same subroutine many times', 0]],
            why: 'Temporal locality means re-using the same location soon (loops, counters, repeated calls). Spatial locality means using neighbouring locations soon (sequential instructions, array elements).' },
          { type: 'tf', q: 'The disk cache that the operating system manages is a separate hardware memory chip placed between main memory and the disk.',
            answer: false,
            why: 'The OS’s disk cache is a portion of ordinary main memory that the operating system sets aside and manages in software as a buffer for disk blocks. No extra hardware is involved.' },
          { type: 'multi', q: 'Which are benefits of a disk cache?',
            choices: ['Writes can be clustered into fewer, larger disk transfers.', 'Data referenced again may be found in main memory instead of on the disk.', 'It makes main memory nonvolatile.', 'It removes the need for secondary memory.'],
            answer: [0, 1],
            why: 'Buffering disk blocks in main memory lets the OS batch writes and serve repeated references from memory. It cannot make RAM survive a power cut, and the disk is still needed to store data permanently.' },
          { type: 'bucket', q: 'Sort each technology into its group of the memory hierarchy.',
            buckets: ['Inboard memory', 'Outboard storage', 'Off-line storage'],
            items: [['Registers', 0], ['Cache', 0], ['Main memory', 0], ['Solid-state disk', 1], ['Magnetic disk', 1], ['Optical disc (DVD, Blu-ray)', 1], ['Magnetic tape', 2]],
            why: 'Inboard memory is what the processor reaches directly or over the system bus: registers, cache and main memory. Outboard storage is attached through I/O modules: SSDs, magnetic disks and optical discs. Off-line storage, such as tape, sits outside the running system and must be mounted before use.' },
        ],
      },
    ],
    notes: `
      <h3>1. The memory designer’s dilemma</h3>
      <p>A memory is judged on three design constraints: <b>capacity</b> (how much it holds), <b>access time</b> (how long it takes to deliver or store data once asked) and <b>cost per bit</b> (the price of storing one bit, usually quoted per GB). Across real technologies three relationships always hold:</p>
      <ol>
        <li><b>Faster access time → greater cost per bit.</b></li>
        <li><b>Greater capacity → smaller cost per bit.</b></li>
        <li><b>Greater capacity → greater (slower) access time.</b></li>
      </ol>
      <p><b>The dilemma:</b> we want large capacity (cheap per bit, room for programs) and fast access, but the big technologies are the slow ones. All-SRAM storage would cost a fortune and forget everything at power-off; all-disk storage would leave the processor waiting. <b>The solution:</b> do not rely on one technology. Use a little fast, expensive memory and a lot of slow, cheap memory, stacked in levels, and keep the data in use near the top. This is the <b>memory hierarchy</b>.</p>
      <p><small>1 ns = a billionth of a second; 1 µs = 1,000 ns; 1 ms = 1,000 µs. Caches use fast, bulky SRAM; main memory uses denser, cheaper DRAM.</small></p>

      <h3>2. The levels of the hierarchy</h3>
      <ul>
        <li><b>Inboard memory</b>: registers, cache, main memory (reached directly or over the system bus).</li>
        <li><b>Outboard storage</b>: solid-state disks, magnetic disks, optical discs (attached through I/O modules).</li>
        <li><b>Off-line storage</b>: magnetic tape, kept outside the running system and mounted when needed (backups, archives).</li>
      </ul>
      <table>
        <tr><th>Level</th><th>Capacity</th><th>Access time</th><th>Cost per GB</th></tr>
        <tr><td>Registers</td><td>≈ 1 KB</td><td>≈ 0.3 ns</td><td>highest</td></tr>
        <tr><td>Cache (SRAM)</td><td>64 KB–64 MB</td><td>1–10 ns</td><td>≈ $1,000</td></tr>
        <tr><td>Main memory (DRAM)</td><td>8–64 GB</td><td>50–100 ns</td><td>≈ $5</td></tr>
        <tr><td>SSD</td><td>0.5–4 TB</td><td>≈ 0.1 ms</td><td>≈ 8¢</td></tr>
        <tr><td>Magnetic disk</td><td>1–20 TB</td><td>5–10 ms</td><td>≈ 2¢</td></tr>
        <tr><td>Optical disc</td><td>≤ 100 GB per disc</td><td>≈ 100 ms</td><td>≈ 5¢</td></tr>
        <tr><td>Magnetic tape</td><td>10–30 TB per cartridge</td><td>seconds–minutes</td><td>≈ 0.5¢</td></tr>
      </table>
      <p>Rough mid-2020s figures; the ratios matter most. Registers, cache and main memory are <b>volatile</b> (they forget without power); the outboard and off-line levels are <b>nonvolatile</b>.</p>
      <p><b>Going down the hierarchy:</b> (a) cost per bit <b>decreases</b>; (b) capacity <b>increases</b>; (c) access time <b>increases</b>; (d) frequency of access by the processor <b>decreases</b>. Point (d) is what makes (c) bearable. The trends compare levels. SSD, magnetic disk and optical disc are side-by-side alternatives on the same outboard level, so they need not line up with each other: optical discs (≈ 5¢ per GB) even cost more per bit than magnetic disk (≈ 2¢), because discs are now a niche medium.</p>
      <p><b>Feeling the gaps:</b> if a 0.3 ns register access took 1 second, a cache access would take ≈ 3 s, main memory ≈ 5.6 min, an SSD ≈ 4 days, a magnetic disk ≈ 6 months, an optical disc ≈ 10 years, and winding a tape ≈ 6,300 years. So the OS does not let the processor idle during a disk access: it runs another program and an interrupt announces the data.</p>

      <h3>3. A two-level memory and its average access time</h3>
      <p>Level 1 is small and fast (access time <b>T1</b>); level 2 is large and slow (access time <b>T2</b>). The processor always looks in level 1 first.</p>
      <ul>
        <li><b>Hit</b>: the word is in level 1; the access takes T1.</li>
        <li><b>Miss</b>: the word’s <b>block</b> (a fixed-size group of neighbouring words) is copied up from level 2 and the word is then read from level 1; the access takes <b>T1 + T2</b>.</li>
        <li><b>Hit ratio H</b> = hits ÷ total accesses, between 0 and 1.</li>
      </ul>
      <p><b>Ts = H × T1 + (1 − H) × (T1 + T2)</b>, which simplifies to Ts = T1 + (1 − H) × T2.</p>
      <p><b>Worked example</b> (T1 = 0.1 µs, T2 = 1 µs, H = 0.95): Ts = 0.95 × 0.1 + 0.05 × 1.1 = 0.095 + 0.055 = <b>0.15 µs</b>. Read by read: a loop reads a[0]–a[3] five times (20 reads); only the first misses (1.1 µs) and 19 hit (0.1 µs each), so the total is 3.0 µs, the average 0.15 µs and H = 19/20 = 0.95. Without level 1 the 20 reads would take 20 µs, so level 1 made the loop ≈ 6.7× faster.</p>
      <p>Other values: H = 0.9 → 0.2 µs; H = 0.8 → 0.3 µs; H = 0.99 → 0.11 µs; H = 0 → 1.1 µs (worse than level 2 alone). Ts against H is a straight line from T1 + T2 (H = 0) to T1 (H = 1); each 0.01 lost in H adds 0.01 × T2. Keeping Ts within 2 × T1 needs H ≥ 1 − T1/T2 (0.9 here): H must be close to 1.</p>
      <p><b>Common mistake:</b> charging only T2 for a miss. The processor already spent T1 checking level 1.</p>

      <h3>4. Locality of reference: why the hierarchy works</h3>
      <p>High hit ratios are possible because of <b>locality of reference</b>: over a short period, a program’s memory references cluster in a few small areas, and those clusters change only slowly. Causes: sequential instructions, loops, subroutines (the same code called repeatedly, touching a few local variables) and arrays or records processed item by item.</p>
      <ul>
        <li><b>Temporal locality</b>: a location used recently is likely to be used again soon (loop instructions, counters, repeated calls).</li>
        <li><b>Spatial locality</b>: locations near a recently used one are likely to be used soon (straight-line code, array elements). Copying whole blocks exploits it.</li>
      </ul>
      <p>A loop hits on later passes only if it fits in the fast memory; straight-line code has only spatial locality (bigger blocks, fewer misses); random addresses almost always miss.</p>
      <p><b>The funnel.</b> Because references cluster, data can be arranged so that the <b>fraction of accesses going to each lower level is much smaller</b> than the fraction going to the level above. Example: 1,000,000 references, cache hit ratio 0.95, and 1 in 100,000 main-memory accesses going on to disk. All million use the cache, 50,000 reach main memory and on average 0.5 reach the disk. The same rule with three levels (cache 1 ns, memory 100 ns, disk 5 ms) gives Ts = 1 + 0.05 × (100 + 0.00001 × 5,000,000) = 1 + 5 + 2.5 = <b>8.5 ns</b>. With 1 in 10,000 going to disk, Ts is 31 ns, 80% of it disk time: the slower a level, the rarer its use must be.</p>

      <h3>5. Secondary memory and the disk cache</h3>
      <p><b>Secondary (auxiliary) memory</b>, such as SSDs and magnetic disks, sits below main memory. It is <b>nonvolatile</b>, so it holds programs and files permanently, but it is thousands of times slower than main memory.</p>
      <p>A <b>disk cache</b> is a portion of main memory that the OS uses as a buffer for disk blocks. It is a <b>software</b> technique (OS code plus ordinary RAM), not a separate hardware memory. (A drive may also carry a small hardware buffer of its own; that is a different thing.) Benefits:</p>
      <ul>
        <li><b>Clustered writes:</b> changed blocks collect in memory and go out later in a few large transfers; a block written twice may reach the disk only once.</li>
        <li><b>Re-use:</b> data referenced again (read or just written) may still be in the disk cache, so it comes from memory instead of the disk.</li>
      </ul>
      <p><b>Example:</b> read 12, read 13, read 12, write 12, write 13, write 12, read 13, write 14, read 12, flush takes 9 disk trips (≈ 45 ms) without a disk cache but 3 (≈ 15 ms) with one: two first-time reads plus one clustered write of blocks 12–14.</p>
      <p><b>The price:</b> main memory is volatile, so changes still waiting in the disk cache are lost if the power fails. The OS therefore writes changed blocks back regularly and flushes everything at shutdown.</p>
      <p><b>Do not confuse</b> the processor cache (hardware, between processor and main memory) with the disk cache (software, a slice of main memory in front of the disk).</p>
`,
  });
})();
