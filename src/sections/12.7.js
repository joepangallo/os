/* =====================================================================
   12.7 Secondary Storage Management
   Original teaching material. Helpers shared by several steps live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {
  // ---- MODEL-START: the allocation lab's disk model (checked by dev/qa-12.7/model.mjs) ----
  const NB = 40;                                                    // blocks on the lab disk, numbered 0..39
  const NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];                     // at most six files at once
  const FCOL = { A: 'proc', B: 'mem', C: 'io', D: 'os', E: 'thread', F: 'cpu' };
  const METHOD_NAME = { contig: 'contiguous', chained: 'chained', indexed: 'indexed' };

  function range(a, n) { return Array.from({ length: n }, (_, i) => a + i); }
  function newDisk(method) { return { method, own: new Array(NB).fill(null), isIdx: new Array(NB).fill(false), files: [] }; }
  function getFile(d, name) { return d.files.find((f) => f.name === name) || null; }
  function freeBlocks(d) { const r = []; for (let b = 0; b < NB; b++) if (d.own[b] === null) r.push(b); return r; }
  function freeRuns(d) {                                            // maximal runs of free blocks as [start, length]
    const r = []; let s = -1;
    for (let b = 0; b <= NB; b++) {
      const free = b < NB && d.own[b] === null;
      if (free && s < 0) s = b;
      if (!free && s >= 0) { r.push([s, b - s]); s = -1; }
    }
    return r;
  }
  function largestRun(d) { return freeRuns(d).reduce((m, r) => Math.max(m, r[1]), 0); }
  function pieces(list) { let p = 0; list.forEach((b, i) => { if (i === 0 || b !== list[i - 1] + 1) p++; }); return p; }
  function readOrder(f) { return (f.index === null ? [] : [f.index]).concat(f.blocks); }
  function firstBlock(f) { return Math.min(...readOrder(f)); }
  function put(d, f, b, idx) { d.own[b] = f.name; d.isIdx[b] = !!idx; }
  function release(d, b) { d.own[b] = null; d.isIdx[b] = false; }
  function sortFiles(d) { d.files.sort((a, b) => a.name.localeCompare(b.name)); }
  function list(a) { return a.length <= 6 ? a.join(', ') : a.slice(0, 5).join(', ') + ', … ' + a[a.length - 1]; }

  function create(d, n, forced) {                                   // make a new file of n blocks; forced picks the name
    const name = forced || NAMES.find((x) => !getFile(d, x));
    if (!name) return { ok: false, msg: 'All six file names are in use. Delete a file first.' };
    const free = freeBlocks(d);
    const f = { name, blocks: [], index: null };
    if (d.method === 'contig') {
      const hole = freeRuns(d).find((r) => r[1] >= n);
      if (!hole) {
        if (free.length >= n) return { ok: false, frag: true, msg: `<b>Refused.</b> ${free.length} blocks are free, but the longest run of free blocks is only ${largestRun(d)}, and contiguous allocation needs all ${n} side by side. That is <b>external fragmentation</b>. Press <b>Compact</b>, then try again.` };
        return { ok: false, msg: `<b>Refused.</b> Only ${free.length} blocks are free; a ${n}-block file cannot fit by any method.` };
      }
      f.blocks = range(hole[0], n);
      f.blocks.forEach((b) => put(d, f, b));
      d.files.push(f); sortFiles(d);
      return { ok: true, name, msg: `File <b>${name}</b> needed one run of ${n} free blocks. First fit scanned from block 0 and took ${n === 1 ? 'block ' + hole[0] : `blocks ${hole[0]}–${hole[0] + n - 1}`}. Its table entry is just <b>start ${hole[0]}, length ${n}</b>.` };
    }
    const need = n + (d.method === 'indexed' ? 1 : 0);
    if (free.length < need) return { ok: false, msg: `<b>Refused.</b> The file needs ${need} free block${need > 1 ? 's' : ''}${d.method === 'indexed' ? ` (${n} for data plus 1 for its index)` : ''}, but only ${free.length} ${free.length === 1 ? 'is' : 'are'} free.` };
    if (d.method === 'indexed') { f.index = free[0]; put(d, f, free[0], true); f.blocks = free.slice(1, need); }
    else f.blocks = free.slice(0, n);
    f.blocks.forEach((b) => put(d, f, b));
    d.files.push(f); sortFiles(d);
    if (d.method === 'chained') return { ok: true, name, msg: `File <b>${name}</b> took the first ${n === 1 ? 'free block' : n + ' free blocks'} it found (${list(f.blocks)}). They need not be side by side: each block stores the number of the next one, and the last stores “end”. Table entry: <b>start ${f.blocks[0]}, length ${n}</b>.` };
    return { ok: true, name, msg: `Block ${f.index} became file <b>${name}</b>’s <b>index block</b>; it lists the ${n === 1 ? 'one data block' : n + ' data blocks in order'} (${list(f.blocks)}). The table entry only says <b>index block ${f.index}</b>.` };
  }

  function grow(d, name) {                                          // add one block to the end of a file
    const f = getFile(d, name); if (!f) return { ok: false, msg: 'Pick a file first.' };
    const n = f.blocks.length, last = f.blocks[n - 1];
    if (d.method === 'contig') {
      const nxt = last + 1;
      if (nxt < NB && d.own[nxt] === null) { f.blocks.push(nxt); put(d, f, nxt); return { ok: true, msg: `Lucky: block ${nxt}, right after the end of <b>${name}</b>, was free, so the run simply became one block longer (start ${f.blocks[0]}, length ${n + 1}).` }; }
      const blocker = nxt >= NB ? 'it already ends at the last block of the disk' : 'block ' + nxt + ' belongs to file ' + d.own[nxt];
      const old = f.blocks.slice();
      old.forEach((b) => release(d, b));                             // while it looks for a new home, the file's own blocks count as free
      const hole = freeRuns(d).find((r) => r[1] >= n + 1);
      if (!hole) {
        old.forEach((b) => put(d, f, b));                           // nowhere to go: the file keeps its blocks
        const fr = freeBlocks(d).length, lastFile = d.files.reduce((a, x) => (firstBlock(x) > firstBlock(a) ? x : a));
        const why = fr >= 1 && (fr >= n + 1 || lastFile === f) ? `${fr} block${fr === 1 ? ' is' : 's are'} free, but not side by side where ${name} can use them. Compact first.` : 'There is not enough free space left.';
        return { ok: false, msg: `<b>Cannot grow ${name}.</b> ${blocker[0].toUpperCase() + blocker.slice(1)}, so the run cannot be extended in place, and no run of ${n + 1} blocks (free ones plus its own) exists to move it to. ${why}` };
      }
      f.blocks = range(hole[0], n + 1); f.blocks.forEach((b) => put(d, f, b));
      const slid = old.some((b) => f.blocks.includes(b));
      return { ok: true, msg: `<b>${name}</b> could not grow in place (${blocker}). The OS copied ${n === 1 ? 'its one block to ' + hole[0] : `all ${n} blocks to ${hole[0]}–${hole[0] + n - 1}`}${slid ? ', sliding into the free space beside it,' : ''} and put the new block at ${hole[0] + n}: <b>${n} block cop${n === 1 ? 'y' : 'ies'}</b> just to add one block. This is why contiguous allocation wants the final size up front.` };
    }
    const free = freeBlocks(d);
    if (!free.length) return { ok: false, msg: '<b>Disk full.</b> There is no free block left.' };
    const b = free[0]; f.blocks.push(b); put(d, f, b);
    if (d.method === 'chained') return { ok: true, msg: `Any free block will do. The OS took block ${b} and wrote ${b} into the pointer of <b>${name}</b>’s old last block (${last}), which used to say “end”. Length is now ${n + 1}; the start in the table does not change.` };
    return { ok: true, msg: `The OS took free block ${b} and appended it to the list in index block ${f.index}. Entry ${n} of the index now says ${b}. The table entry does not change.` };
  }

  function remove(d, name) {                                        // delete a file and free its blocks
    const f = getFile(d, name); if (!f) return { ok: false, msg: 'Pick a file first.' };
    const all = readOrder(f);
    all.forEach((b) => release(d, b));
    d.files = d.files.filter((x) => x !== f);
    return { ok: true, msg: `File <b>${name}</b> is gone and its ${all.length} block${all.length > 1 ? 's' : ''} (${list(all.slice().sort((a, b) => a - b))}) are free again. Its table entry was removed.` };
  }

  function compact(d) {                                             // slide files together in disk order; returns blocks moved
    const order = d.files.slice().sort((a, b) => firstBlock(a) - firstBlock(b));
    const own = new Array(NB).fill(null), isIdx = new Array(NB).fill(false);
    let p = 0, moved = 0;
    for (const f of order) {
      if (f.index !== null) { if (f.index !== p) moved++; f.index = p; own[p] = f.name; isIdx[p] = true; p++; }
      f.blocks = f.blocks.map((b) => { if (b !== p) moved++; own[p] = f.name; return p++; });
    }
    d.own = own; d.isIdx = isIdx;
    return moved;
  }

  function readPath(d, name, k) {                                   // the disk blocks read, in order, to reach block k of a file
    const f = getFile(d, name); if (!f) return [];
    if (d.method === 'contig') return [f.blocks[k]];
    if (d.method === 'chained') return f.blocks.slice(0, k + 1);
    return [f.index, f.blocks[k]];
  }

  function startDisk(method) {                                      // the same four files (A 6, B 8, C 9, D 5) under each method
    const d = newDisk(method);
    if (method === 'contig') {                                       // a history of creates and deletes has left three holes
      [['A', 0, 6], ['B', 10, 8], ['C', 23, 9], ['D', 35, 5]].forEach(([name, s, n]) => {
        const f = { name, blocks: range(s, n), index: null }; f.blocks.forEach((b) => put(d, f, b)); d.files.push(f);
      });
      return d;
    }
    const goal = { A: 6, B: 8, C: 9, D: 5 };                         // files created small, then grown in turns, so their blocks interleave
    create(d, 2, 'A'); create(d, 3, 'B'); create(d, 3, 'C'); create(d, 2, 'D');
    let more = true;
    while (more) {
      more = false;
      for (const nm of ['A', 'B', 'C', 'D']) if (getFile(d, nm).blocks.length < goal[nm]) { grow(d, nm); more = true; }
    }
    return d;
  }
  // ---- MODEL-END ----

  Guide.section({
    id: '12.7',
    title: 'Secondary Storage Management',
    short: 'Storage management',
    summary: 'How the OS hands out disk blocks to files, keeps track of the free ones, and keeps both records safe.',
    objectives: [
      'Weigh preallocation against dynamic allocation, and explain how portion size trades speed, table size and wasted space.',
      'Lay out files with contiguous, chained and indexed allocation, and compare their tables, fragmentation and random-access cost.',
      'Track free space with a bit table, chained free portions, an index or a free block list, and compute how big a bit table is.',
      'Explain what a volume is, and how a crash or two concurrent allocators can hand the same block to two files.',
      'Apply the lock-search-allocate-update-unlock procedure that keeps allocation safe.',
    ],
    terms: [
      ['Preallocation', 'Giving a file its maximum size in disk space at the moment it is created, before any data is written.'],
      ['Dynamic allocation', 'Giving a file disk space in portions only as it actually needs them, while it grows.'],
      ['Portion', 'A contiguous piece of disk space handed to a file in one allocation. It can be as small as one block or as large as the whole file.'],
      ['File allocation table', 'The record the OS keeps of which portions of the disk belong to each file. What one entry holds depends on the allocation method.'],
      ['Contiguous allocation', 'An allocation method that gives each file one run of consecutive blocks when it is created; the table needs only the start block and the length.'],
      ['Chained allocation (linked allocation)', 'An allocation method in which a file\'s blocks may sit anywhere; each block stores the number of the next block of the file, and the table holds the first block and the length.'],
      ['Indexed allocation', 'An allocation method in which each file has an index (normally kept in its own block) listing the file\'s blocks or portions in order; the table entry points to that index.'],
      ['Index block', 'The disk block that holds a file\'s index: one entry per block or portion of the file, in file order.'],
      ['FAT (file allocation table file system)', 'The file system of MS-DOS and early Windows, still common on memory cards and USB sticks. It is chained allocation with every next-pointer moved out of the data blocks into one table, one entry per cluster.'],
      ['Nearest fit', 'A placement rule for variable-size portions: choose the free portion closest to the file\'s previous portion, so the file\'s pieces stay near each other.'],
      ['Consolidation', 'Rewriting a scattered file (or all files) so each file\'s blocks sit next to each other again, which shortens the seeks needed to read it.'],
      ['Bit table (bit map)', 'A free-space record with one bit per disk block: 0 means the block is free and 1 means it is in use.'],
      ['Summary table', 'A small table kept beside a bit table that records, for each range of blocks, how many are free and the longest free run, so most ranges can be skipped without scanning their bits.'],
      ['Chained free portions', 'A free-space method that links the free portions together; each free portion stores its own length and a pointer to the next free portion.'],
      ['Free block list', 'A free-space method that keeps the number of every free block in a list on disk (24 or 32 bits per entry), used as a stack or a FIFO queue with only a small part held in memory.'],
      ['Disk allocation table', 'The OS\'s record of which blocks of a volume are free, kept with any of the free-space methods. It is updated on every allocation and every deletion.'],
      ['Volume', 'A logical disk: a set of addressable sectors on secondary storage that an OS or application can use for data. Its sectors need not be contiguous and may be spread over several physical disks.'],
      ['Lost block', 'A block marked as in use that no file refers to. It wastes space but corrupts nothing, and a disk-checking utility can find it and free it.'],
    ],
    css: `
      .sec-12-7 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-12-7 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-7 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-7 .grid-2 > *, .sec-12-7 .grid-3 > *, .sec-12-7 .grid-4 > *, .sec-12-7 .mw0 > * { min-width: 0; }
      .sec-12-7 .disk { display: grid; gap: 4px; }
      .sec-12-7 .blk { position: relative; border: 2px solid var(--line-2); border-radius: 7px; background: var(--panel); display: grid; place-items: center; font-weight: 800; font-size: 17px; line-height: 1; color: var(--ink); padding: 0; min-width: 0; font-family: inherit; }
      .sec-12-7 button.blk { cursor: pointer; }
      .sec-12-7 .blk .bn { position: absolute; top: 2px; left: 4px; font-size: 12.5px; font-weight: 600; color: var(--muted); }
      .sec-12-7 .blk .pt { position: absolute; bottom: 2px; right: 4px; font-size: 12.5px; font-weight: 700; font-family: var(--mono); color: var(--ink-2); }
      .sec-12-7 .blk.free { border-style: dashed; background: var(--panel-2); color: var(--muted); font-weight: 600; }
      .sec-12-7 .blk.c-proc { border-color: var(--proc); background: var(--proc-bg); }
      .sec-12-7 .blk.c-mem { border-color: var(--mem); background: var(--mem-bg); }
      .sec-12-7 .blk.c-io { border-color: var(--io); background: var(--io-bg); }
      .sec-12-7 .blk.c-os { border-color: var(--os); background: var(--os-bg); }
      .sec-12-7 .blk.c-thread { border-color: var(--thread); background: var(--thread-bg); }
      .sec-12-7 .blk.c-cpu { border-color: var(--cpu); background: var(--cpu-bg); }
      .sec-12-7 .blk.c-other { border-color: var(--line-2); background: var(--panel-3); color: var(--ink-2); }
      .sec-12-7 .blk.idx { border-style: double; border-width: 4px; }
      .sec-12-7 .blk.sel { outline: 3px solid var(--accent); outline-offset: 1px; }
      .sec-12-7 .blk.dim { opacity: .35; }
      .sec-12-7 .blk.rd { background: var(--hl); }
      .sec-12-7 .blk .ord { position: absolute; top: -8px; right: -6px; background: var(--accent); color: var(--accent-ink); border-radius: 9px; font-size: 12.5px; padding: 1px 5px; font-weight: 800; }
      .sec-12-7 .sw { display: inline-block; width: 14px; height: 14px; border-radius: 4px; border: 2px solid var(--line-2); vertical-align: -2px; margin-right: 4px; }
      .sec-12-7 .sw.free { border-style: dashed; background: var(--panel-2); }
      .sec-12-7 .sw.idx { border-style: double; border-width: 4px; }
    `,
    steps: [
      {
        title: 'Every block has an owner, or it is free',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">A disk is one long row of numbered blocks. For every block, the file system must be able to answer two questions at any moment.</p>
              <p class="m0"><b>1. Which file owns it, and where does it come in that file?</b> Deciding this is <span class="t">file allocation</span>. The answer for each file is written down in a <span class="t">file allocation table</span>.</p>
              <p class="m0"><b>2. Is it free?</b> Keeping this list is <span class="t" data-t="free storage management">free-space management</span> (also called free storage management), and its record is the <span class="t">disk allocation table</span>. Every new file, every file that grows and every deletion changes both records.</p>
              <div class="callout analogy m0" data-label="Analogy">A self-storage building with numbered lockers. The front desk keeps a ledger of which lockers each customer rents, and in what order the boxes were packed, plus a list of empty lockers. If either record is wrong, two customers get the same locker.</div>
              <div class="row gap-s small"><span class="chip os">decide how much space to give</span><span class="chip io">lay out files three ways</span><span class="chip mem">track free blocks four ways</span><span class="chip intr">stop a crash from double-booking a block</span></div>
            </div>
            <div class="card stack" style="gap:10px">
              <h4 class="m0">One small volume, 24 blocks</h4>
              <p class="small muted m0">Click a button to see which blocks it describes.</p>
              <div class="v-disk stack" style="gap:6px"></div>
              <div class="row gap-s v-btns"></div>
              <div class="card white grow v-detail" style="display:flex;flex-direction:column;gap:6px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const own = new Array(24).fill(null);
          const FILES = { A: [0, 1, 2, 9, 10], B: [3, 4, 5, 6, 7], C: [14, 15, 16, 17, 18, 19] };
          Object.entries(FILES).forEach(([f, bl]) => bl.forEach((b) => { own[b] = f; }));
          const free = own.map((o, b) => (o ? null : b)).filter((b) => b !== null);
          const runs = []; free.forEach((b, i) => { if (i && b === free[i - 1] + 1) runs[runs.length - 1].push(b); else runs.push([b]); });
          const runTxt = runs.map((r) => (r.length > 1 ? r[0] + '–' + r[r.length - 1] : String(r[0]))).join(', ');
          const cls = { A: 'c-proc', B: 'c-mem', C: 'c-io' };
          const cols = ctx.narrow ? 6 : 12;
          const host = ctx.$('.v-disk');
          const cells = [];
          const rows = [0, 1].map((r) => {
            const tag = h('div', { class: 'xs b', style: { color: 'var(--io)', visibility: 'hidden' } }, 'physical drive ' + (r + 1) + ' holds blocks ' + (r * 12) + '–' + (r * 12 + 11));
            const grid = h('div', { class: 'disk', style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } });
            for (let b = r * 12; b < r * 12 + 12; b++) {
              const c = h('div', { class: 'blk ' + (own[b] ? cls[own[b]] : 'free'), style: { height: '52px' } }, h('span', { class: 'bn' }, String(b)), own[b] || '');
              cells[b] = c; grid.append(c);
            }
            const wrap = h('div', { class: 'stack', style: { gap: '3px', borderRadius: '10px', padding: '2px' } }, tag, grid);
            wrap.tag = tag; host.append(wrap); return wrap;
          });
          const items = [
            ['File A', 'proc', (b) => own[b] === 'A', `<b>File A</b> owns blocks ${FILES.A.join(', ')}, in that order. It grew after file B was written, so its last two blocks landed further along. Nothing inside block 9 says “I belong to A”: the file system must record which blocks are A’s and in what order.`],
            ['File B', 'mem', (b) => own[b] === 'B', `<b>File B</b> owns blocks ${FILES.B[0]}–${FILES.B[FILES.B.length - 1]}: one neat run of ${FILES.B.length}. A run like this can be read with almost no movement of the disk arm.`],
            ['File C', 'io', (b) => own[b] === 'C', `<b>File C</b> owns blocks ${FILES.C[0]}–${FILES.C[FILES.C.length - 1]}. To remember it, the table needs only two numbers: where it starts and how long it is.`],
            ['Free blocks', 'ok', (b) => !own[b], `<b>${free.length} blocks are free</b>: ${runTxt}. New and growing files are given blocks from this pool, and a deleted file’s blocks return to it. The free space is already broken into ${runs.length} separate runs, which matters when a file wants its blocks side by side.`],
            ['Where is it really?', 'warn', null, 'All 24 blocks form one <span class="t">volume</span>: a logical disk, meaning a set of addressable sectors the OS can store data in. A volume need not sit on one physical disk. Here blocks 0–11 really live on drive 1 and blocks 12–23 on drive 2, yet the file system only ever sees block numbers 0–23.'],
          ];
          const detail = ctx.$('.v-detail');
          const btns = items.map((it, i) => h('button', { class: 'btn sm ' + (it[1] === 'ok' || it[1] === 'warn' ? '' : it[1]), type: 'button', onclick: () => show(i) }, it[0]));
          ctx.$('.v-btns').append(...btns);
          function show(i) {
            const [, , test, text] = items[i];
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            cells.forEach((c, b) => c.classList.toggle('dim', !!test && !test(b)));
            rows.forEach((w) => {
              w.tag.style.visibility = test ? 'hidden' : 'visible';
              w.style.outline = test ? 'none' : '2px dashed var(--io)';
            });
            detail.innerHTML = `<p class="m0" style="font-size:15.5px;line-height:1.45">${text}</p>`;
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
          }
          show(0);
        },
      },
      {
        title: 'Three decisions: when, how much, and where',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const strip = (n, cols, height) => h('div', { class: 'disk', style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } });
          const cell = (b, cls, label, height) => h('div', { class: 'blk ' + cls, style: { height: (height || 40) + 'px' } }, b === null ? '' : h('span', { class: 'bn' }, String(b)), label || '');

          /* ---- tab 1: preallocate or grow? ---- */
          function tabPre(p) {
            const SIZES = [2, 3, 5, 6, 8, 10];                       // the file's real size at the end of weeks 1..6
            const CAP = 16;
            let mode = 'pre', declared = 6;
            const chart = h('div', { class: 'stack', style: { gap: '8px' } });
            const narr = h('div', { class: 'narr' });
            const sl = ctx.ui.slider({ label: 'Size declared at creation', min: 1, max: CAP, value: declared, format: (v) => v + ' blocks', onInput: (v) => { declared = v; draw(); } });
            const seg = ctx.ui.seg([{ value: 'pre', label: 'Preallocation' }, { value: 'dyn', label: 'Dynamic allocation' }], mode, (v) => { mode = v; draw(); });
            function draw() {
              sl.style.visibility = mode === 'pre' ? 'visible' : 'hidden';
              chart.replaceChildren();
              let ranOut = -1;
              SIZES.forEach((s, w) => {
                const g = strip(CAP, CAP);
                for (let i = 0; i < CAP; i++) {
                  let cls = 'free dim', lab = '';
                  if (mode === 'dyn') { if (i < s) cls = 'c-proc'; }
                  else if (i < Math.min(s, declared)) cls = 'c-proc';
                  else if (i < declared) { cls = 'free'; lab = '·'; }
                  else if (i < s) { cls = 'c-other'; lab = '✗'; }
                  const c = cell(null, cls, lab, ctx.narrow ? 24 : 34);
                  if (lab === '✗') { c.style.borderColor = 'var(--bad)'; c.style.background = 'var(--bad-bg)'; c.style.color = 'var(--bad)'; }
                  g.append(c);
                }
                if (mode === 'pre' && s > declared && ranOut < 0) ranOut = w;
                const wk = h('span', { class: 'small b', style: { width: ctx.narrow ? 'auto' : '136px', flex: 'none', whiteSpace: 'nowrap' } }, 'Week ' + (w + 1) + ': ' + s + ' blocks');
                chart.append(ctx.narrow ? h('div', { class: 'stack', style: { gap: '2px' } }, wk, g)
                  : h('div', { class: 'row nw', style: { gap: '8px', alignItems: 'center' } }, wk, h('div', { style: { flex: 1, minWidth: 0 } }, g)));
              });
              const fin = SIZES[SIZES.length - 1];
              if (mode === 'dyn') { narr.className = 'narr ok'; narr.innerHTML = `Space arrives in portions (here one block) only when the file needs it, so it ends at exactly <b>${fin} blocks</b>, with nothing reserved and nothing to guess. The price: an allocation every time the file grows, and blocks that may end up scattered over the disk.`; }
              else if (ranOut >= 0) { narr.className = 'narr bad'; narr.innerHTML = `In <b>week ${ranOut + 1}</b> the file needed ${SIZES[ranOut]} blocks but only ${declared} were reserved (red ✗). Now the program gets an error, or the OS must find a bigger run and copy all ${declared} blocks there. Guessing low is painful.`; }
              else { narr.className = 'narr'; narr.innerHTML = `The file never ran out, but its reserved space was mostly idle: in week 1, <b>${declared - SIZES[0]} of ${declared}</b> blocks sat unused (dots), and ${declared > fin ? `even at the end ${declared - fin} were never used` : 'only in the last week was all of it used'}. Reserved blocks cannot be lent to other files, so guessing high wastes space.`; }
            }
            p.append(h('div', { class: 'split l fill' },
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('p', { class: 'm0', html: '<b>When</b> is space handed out? With <span class="t">preallocation</span> a file states its maximum size when it is created and gets all of it at once. With <span class="t">dynamic allocation</span> it gets space in pieces as it grows.' }),
                h('p', { class: 'small m0', html: 'For many files (a log, a mailbox, a document being written) nobody knows the final size, so people guess high to be safe. The file below really grows to 10 blocks over six weeks.' }),
                seg, sl, narr,
                h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The next steps show that <span class="t">contiguous allocation</span> cannot work without preallocation: a file kept in one run must get the whole run at once.' })),
              h('div', { class: 'card white stack', style: { gap: '8px', justifyContent: 'center' } },
                h('div', { class: 'row gap-s xs' }, h('span', {}, h('i', { class: 'sw c-proc', style: { borderColor: 'var(--proc)', background: 'var(--proc-bg)' } }), 'used by the file'), h('span', {}, h('i', { class: 'sw free' }), 'reserved, unused'), h('span', {}, h('i', { class: 'sw', style: { borderColor: 'var(--bad)', background: 'var(--bad-bg)' } }), 'needed, not reserved')),
                chart)));
            draw();
          }

          /* ---- tab 2: portion size ---- */
          function tabSize(p) {
            let f = 23, ps = 4;
            const vis = h('div', { class: 'row', style: { gap: '8px', rowGap: '8px', alignContent: 'flex-start' } });
            const stats = h('div', { class: 'grid-3', style: { gap: '8px' } });
            const narr = h('div', { class: 'narr' });
            const s1 = ctx.ui.slider({ label: 'File size', min: 1, max: 40, value: f, format: (v) => v + ' blk', onInput: (v) => { f = v; draw(); } });
            const s2 = ctx.ui.slider({ label: 'Portion size', min: 1, max: 24, value: ps, format: (v) => v + ' blk', onInput: (v) => { ps = v; draw(); } });
            const stat = (big, lab) => h('div', { class: 'card tight center' }, h('div', { style: { fontSize: '26px', fontWeight: 900, lineHeight: 1.1 } }, String(big)), h('div', { class: 'xs muted' }, lab));
            function draw() {
              const portions = Math.ceil(f / ps), reserved = portions * ps, waste = reserved - f;
              vis.replaceChildren();
              let used = 0;
              for (let k = 0; k < portions; k++) {
                const g = h('div', { class: 'row', style: { gap: '2px', padding: '3px', border: '2px solid var(--line-2)', borderRadius: '8px', flexWrap: 'wrap' } });
                for (let i = 0; i < ps; i++) {
                  const u = used < f; used++;
                  g.append(h('div', { class: 'blk ' + (u ? 'c-proc' : 'free'), style: { width: '17px', height: '22px' } }));
                }
                vis.append(g);
              }
              stats.replaceChildren(stat(portions, 'portions = table entries'), stat(waste, 'blocks given but unused'), stat(portions, 'places the arm may visit'));
              const verdict = ps === 1 ? 'Single blocks: no waste at all, but one table entry per block and no promise that neighbours sit together.'
                : portions === 1 ? `One portion holds the whole file: one table entry and one smooth sequential read${waste ? ', but the space beyond the file is given away unused' : ''}.`
                  : `Bigger portions mean fewer entries and longer stretches read without seeking; smaller portions waste less of the last portion.`;
              narr.innerHTML = `${f} blocks in portions of ${ps} need <b>${portions} portion${portions > 1 ? 's' : ''}</b>; the last one has <b>${waste}</b> unused block${waste === 1 ? '' : 's'}. ${verdict}`;
            }
            p.append(h('div', { class: 'split l fill' },
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('p', { class: 'm0', html: '<b>How much</b> is handed out at a time? A <span class="t">portion</span> can be anything from one block to the whole file. Each choice trades three things against each other.' }),
                s1, s2, stats, narr),
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('div', { class: 'card white grow', style: { minHeight: '120px' } }, vis),
                h('div', { class: 'grid-2', style: { gap: '10px' } },
                  h('div', { class: 'card tight small', html: '<b>Large, variable-size contiguous portions.</b> Fast to read and little overallocation, but the tables get more complex and free space breaks into odd-sized holes, so a placement rule is needed (next tab).' }),
                  h('div', { class: 'card tight small', html: '<b>Small, fixed-size blocks.</b> Flexible: any free block fits any need, so reallocation is simple. The cost is large tables and blocks that may be scattered.' })))));
            draw();
          }

          /* ---- tab 3: which free portion? ---- */
          function tabFit(p) {
            const HOLES = [[2, 4], [9, 14], [16, 17], [24, 28], [33, 36]];   // free runs [first, last]
            const PREV = [20, 23];                                          // the file's previous portion
            let need = 4, rule = 'first';
            const host = h('div', {});
            const narr = h('div', { class: 'narr' });
            const tbl = h('table', { class: 'tbl compact' });
            const size = (hl) => hl[1] - hl[0] + 1;
            const gap = (hl) => (hl[0] > PREV[1] ? hl[0] - PREV[1] - 1 : PREV[0] - hl[1] - 1);
            function pick(r) {
              const fits = HOLES.filter((hl) => size(hl) >= need);
              if (!fits.length) return null;
              if (r === 'first') return fits[0];
              if (r === 'best') return fits.reduce((a, b) => (size(b) < size(a) ? b : a));
              return fits.reduce((a, b) => (gap(b) < gap(a) ? b : a));
            }
            const sl = ctx.ui.slider({ label: 'New portion needs', min: 1, max: 7, value: need, format: (v) => v + ' blk', onInput: (v) => { need = v; draw(); } });
            const seg = ctx.ui.seg([{ value: 'first', label: 'First fit' }, { value: 'best', label: 'Best fit' }, { value: 'near', label: 'Nearest fit' }], rule, (v) => { rule = v; draw(); });
            function draw() {
              const ch = pick(rule);
              const g = strip(40, ctx.narrow ? 10 : 40);
              for (let b = 0; b < 40; b++) {
                const hole = HOLES.find((hl) => b >= hl[0] && b <= hl[1]);
                let cls = hole ? 'free' : 'c-other';
                if (b >= PREV[0] && b <= PREV[1]) cls = 'c-proc';
                if (ch && b >= ch[0] && b < ch[0] + need) cls = 'c-proc sel';
                g.append(cell(b, cls, '', 38));
              }
              host.replaceChildren(g);
              tbl.innerHTML = '<tr><th>Free portion</th><th>Size</th><th>Gap to 20–23</th></tr>' + HOLES.map((hl) => `<tr class="${ch === hl ? 'on' : ''}"><td>${hl[0]}–${hl[1]}</td><td>${size(hl)}${size(hl) < need ? ' (too small)' : ''}</td><td>${gap(hl)} blocks</td></tr>`).join('');
              const leftover = ch ? size(ch) - need : 0;
              const why = { first: 'scans from block 0 and takes the first free portion big enough', best: 'takes the smallest free portion that is big enough, so the leftover sliver is as small as possible', near: 'takes the free portion closest to the file’s previous portion (20–23), so the file’s pieces stay together' }[rule];
              narr.className = 'narr' + (ch ? '' : ' bad');
              narr.innerHTML = ch ? `<b>${{ first: 'First fit', best: 'Best fit', near: 'Nearest fit' }[rule]}</b> ${why}: it chooses <b>${ch[0]}–${ch[1]}</b> and uses blocks ${ch[0]}–${ch[0] + need - 1}, leaving ${leftover} free block${leftover === 1 ? '' : 's'} there.`
                : `No free portion holds ${need} blocks, although ${HOLES.reduce((a, hl) => a + size(hl), 0)} blocks are free in total. With dynamic allocation the OS can split the request into two smaller portions.`;
            }
            p.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
              h('p', { class: 'm0', html: '<b>Where</b> does a variable-size portion go? The disk has the same problem main memory had in chapter 7, and the same kind of answer: <span class="t">first-fit</span>, <span class="t">best-fit</span>, or a disk-specific rule, <span class="t">nearest fit</span>. The file’s previous portion is blocks 20–23 (teal); grey blocks belong to other files.' }),
              h('div', { class: 'card white tight' }, host),
              h('div', { class: 'split', style: { height: 'auto' } },
                h('div', { class: 'stack', style: { gap: '10px' } }, seg, sl, narr),
                h('div', { class: 'stack', style: { gap: '10px' } }, tbl,
                  h('div', { class: 'callout why m0 small', 'data-label': 'Why three rules', html: 'First fit is the quickest to compute; best fit leaves the smallest leftover slivers; nearest fit keeps a file’s portions close together, so reading the file needs only short seeks.' })))));
            draw();
          }

          el.append(ctx.ui.tabs([
            { label: 'When: preallocate or grow?', render: tabPre },
            { label: 'How much: portion size', render: tabSize },
            { label: 'Where: choosing a free portion', render: tabFit },
          ]));
        },
      },
      {
        title: 'One file, three ways to lay it out',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const OTHERS = [0, 1, 2, 5, 9, 13, 17, 19];                     // blocks used by other files (before removing this file's own)
          const V = {
            contig: { label: 'Contiguous', blocks: [5, 6, 7, 8, 9], index: null, entry: '<b>notes</b>: start 5, length 5',
              how: 'The file gets <b>one run of consecutive blocks</b> when it is created, so its full size must be known then (preallocation).',
              pros: ['Reading in order needs almost no seeks, and several blocks can come in one transfer.', 'Block k is simply at start + k: direct access costs one read.'],
              cons: ['Size is fixed at creation; growing may mean moving the whole file.', 'Free space breaks into holes (<span class="t">external fragmentation</span>), so the disk needs compaction now and then.'] },
            chained: { label: 'Chained', blocks: [3, 11, 7, 15, 18], index: null, ptr: true, entry: '<b>notes</b>: start 3, length 5',
              how: 'Blocks can be anywhere. <b>Each block stores the number of the next block</b> of the file; the last one says “end”.',
              pros: ['Any free block will do: no external fragmentation, and the file grows easily.', 'Reading in order is fine: follow the pointers as you go.'],
              cons: ['To reach block k the OS must read the k blocks before it, just to follow the chain.', 'Blocks drift apart (poor locality), so systems run <span class="t">consolidation</span> now and then.', 'One damaged pointer cuts off the rest of the file.'] },
            fat: { label: 'FAT', blocks: [3, 11, 7, 15, 18], index: null, fat: true, entry: 'directory: <b>notes</b>, first cluster 3',
              how: 'The same chain, but the pointers live in <b>one table, the <span class="t" data-t="FAT">FAT</span></b>, with an entry for every cluster (FAT’s word for an allocation block). Entry n says which cluster follows n.',
              pros: ['The FAT can be cached in memory, so following the chain costs no disk reads.', 'Data blocks hold nothing but data.'],
              cons: ['The table has an entry for every cluster of the volume, so it grows with the disk.', 'Still a chain: finding block k means stepping through k entries.'] },
            iblk: { label: 'Indexed (blocks)', blocks: [3, 11, 7, 15, 18], index: 12, entry: '<b>notes</b>: index block 12',
              how: 'A separate <span class="t">index block</span> lists the file’s blocks in order: <b>entry k holds the address of block k</b>.',
              pros: ['Direct access: read the index (often already in memory), then exactly the block wanted.', 'Any free block will do, so no external fragmentation.'],
              cons: ['Every file spends at least one block on its index, even a tiny file.', 'A big file needs several index blocks (UNIX adds levels of indirection, section 12.8).'] },
            iport: { label: 'Indexed (portions)', blocks: [3, 4, 14, 15, 16], index: 12, portions: [[3, 2], [14, 3]], entry: '<b>notes</b>: index block 12',
              how: 'The index lists <b>portions</b> instead of single blocks: each entry gives a start block and a length. (Linux ext4 works this way and calls the portions extents.)',
              pros: ['A few entries describe a large file, and each portion is read without seeking (better locality).', 'Direct access still works: add up portion lengths to find block k.'],
              cons: ['Variable-size portions bring back holes in free space, so a placement rule (first, best or nearest fit) is needed.', 'Finding block k means adding up portion lengths until k is covered (cheap, but not a single lookup).'] },
          };
          let key = 'chained';
          const cols = ctx.narrow ? 5 : 10;
          const BW = 52, BH = 52, GX = 12, GY = ctx.narrow ? 22 : 100, TOP = ctx.narrow ? 12 : 38;
          const W = 32 + cols * BW + (cols - 1) * GX, rowsN = 20 / cols, H = TOP + rowsN * BH + (rowsN - 1) * GY + 34;
          const P = (b) => ({ x: 16 + (b % cols) * (BW + GX), y: TOP + Math.floor(b / cols) * (BH + GY) });
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });
          const how = h('p', { class: 'm0' }), pros = h('ul', { class: 'm0 small', style: { paddingLeft: '20px' } }), cons = h('ul', { class: 'm0 small', style: { paddingLeft: '20px' } });
          const entry = h('div', { class: 'small' }), extra = h('div', {}), cost = h('div', { class: 'small' });
          const tail = h('div', {});
          function clip(cx, cy, dx, dy) { const sx = dx ? (BW / 2 + 3) / Math.abs(dx) : 1e9, sy = dy ? (BH / 2 + 3) / Math.abs(dy) : 1e9, k = Math.min(sx, sy); return [cx + dx * k, cy + dy * k]; }
          function draw() {
            const v = V[key];
            const mine = new Set(v.blocks.concat(v.index === null ? [] : [v.index]));
            const kids = [];
            for (let b = 0; b < 20; b++) {
              const { x, y } = P(b);
              const k = v.blocks.indexOf(b);
              const cls = b === v.index ? 's-os' : k >= 0 ? 's-accent' : OTHERS.includes(b) && !mine.has(b) ? 's-panel' : 's-muted';
              kids.push(s('rect', { x, y, width: BW, height: BH, rx: 7, class: cls, 'stroke-width': 2, 'stroke-dasharray': cls === 's-muted' ? '5 4' : null }));
              kids.push(s('text', { x: x + 4, y: y + 14, 'font-size': 13, class: 's-sub' }, String(b)));
              if (b === v.index) kids.push(s('text', { x: x + BW / 2, y: y + 32, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--os)' }, 'index'));
              else if (k >= 0) {
                kids.push(s('text', { x: x + BW / 2, y: y + (v.ptr ? 29 : 32), 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800 }, '#' + k));
                if (v.ptr) kids.push(s('text', { x: x + BW - 4, y: y + BH - 4, 'text-anchor': 'end', 'font-size': 13, 'font-family': 'var(--mono)', style: 'fill:var(--accent)' }, k < v.blocks.length - 1 ? '→' + v.blocks[k + 1] : 'end'));
              }
            }
            const arrows = [];
            if (v.ptr && !ctx.narrow) v.blocks.slice(0, -1).forEach((a, i) => {
              const b = v.blocks[i + 1], pa = P(a), pb = P(b), ax = pa.x + BW / 2, bx = pb.x + BW / 2;
              let d;
              if (pa.y === pb.y) d = `M${ax},${pa.y - 2} C${ax},${pa.y - 30} ${bx},${pb.y - 30} ${bx},${pb.y - 4}`;
              else if (pb.y > pa.y) d = `M${ax},${pa.y + BH + 2} C${ax},${pa.y + BH + 34} ${bx},${pb.y - 34} ${bx},${pb.y - 4}`;
              else d = `M${ax},${pa.y - 2} C${ax},${pa.y - 34} ${bx},${pb.y + BH + 34} ${bx},${pb.y + BH + 4}`;
              arrows.push(s('path', { d, fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 2.2, 'marker-end': 'url(#arr-accent)' }));
            });
            if (v.index !== null && !ctx.narrow) {
              const targets = v.portions ? v.portions.map((pp) => pp[0]) : v.blocks;
              const pi = P(v.index), cx = pi.x + BW / 2, cy = pi.y + BH / 2;
              targets.forEach((b) => {
                const pb = P(b), tx = pb.x + BW / 2, ty = pb.y + BH / 2, dx = tx - cx, dy = ty - cy;
                const [x1, y1] = clip(cx, cy, dx, dy), [x2, y2] = clip(tx, ty, -dx, -dy);
                arrows.push(s('line', { x1, y1, x2, y2, style: 'stroke:var(--os)', 'stroke-width': 1.8, 'marker-end': 'url(#arr-os)' }));
              });
            }
            svg.replaceChildren(...kids, ...arrows);
            how.innerHTML = v.how;
            pros.innerHTML = v.pros.map((t) => `<li><b style="color:var(--ok)">+</b> ${t}</li>`).join('');
            cons.innerHTML = v.cons.map((t) => `<li><b style="color:var(--bad)">−</b> ${t}</li>`).join('');
            entry.innerHTML = `<b>File allocation table entry</b> · ${v.entry}`;
            // what the index or FAT holds
            if (v.fat) {
              const fatVal = (b) => { const k = v.blocks.indexOf(b); if (k >= 0) return k < v.blocks.length - 1 ? String(v.blocks[k + 1]) : 'EOF'; return OTHERS.includes(b) ? '…' : '0'; };
              extra.innerHTML = `<div class="xs muted" style="margin-bottom:3px">The FAT in memory: entry n → next cluster (0 = free, … = another file’s chain)</div><div class="disk" style="grid-template-columns:repeat(${cols}, minmax(0,1fr))">` +
                Array.from({ length: 20 }, (_, b) => `<div class="blk ${v.blocks.includes(b) ? 'c-cpu' : 'free'}" style="height:34px;font-size:14px"><span class="bn">${b}</span>${fatVal(b)}</div>`).join('') + '</div>';
            } else if (v.index !== null) {
              extra.innerHTML = `<div class="small"><b style="color:var(--os)">Index block 12 holds:</b> <span class="mono">${v.portions ? v.portions.map((pp) => `(start ${pp[0]}, length ${pp[1]})`).join(' ') : v.blocks.join(', ')}</span></div>`;
            } else extra.innerHTML = '';
            // cost of reading block #3
            const k = 3, tgt = v.blocks[k];
            const reads = key === 'contig' ? [tgt] : key === 'chained' ? v.blocks.slice(0, k + 1) : key === 'fat' ? [tgt] : [v.index, tgt];
            const why = key === 'contig' ? `5 + 3 = ${tgt}, computed` : key === 'chained' ? 'each block read only to learn where the next one is'
              : key === 'fat' ? `chain followed in the cached FAT: 3 → 11 → 7 → ${tgt}` : v.portions ? `#3 is the 2nd block of portion (14, 3) → block ${tgt}` : `entry 3 of the index says ${tgt}`;
            cost.innerHTML = `<b>To read block #3:</b> ${reads.length} disk read${reads.length > 1 ? 's' : ''} (${reads.join(' → ')}); ${why}.`;
            tail.innerHTML = {
              contig: '<div class="callout warn m0" data-label="Common mistake">“Contiguous means no fragmentation.” Inside each file, yes. But the free space <i>between</i> files breaks into holes, and that is exactly what hurts this method.</div>',
              chained: '<div class="callout warn m0" data-label="Common mistake">“Chained allocation is slow.” Reading the whole file in order costs one read per block, the same as any method. Only <i>jumping</i> to block k is slow.</div>',
              fat: '<div class="callout why m0" data-label="Why it matters">FAT is old (MS-DOS era) but still on most memory cards and USB sticks, because almost every camera, phone and computer can read it.</div>',
              iblk: '<div class="callout tip m0" data-label="Most common">Indexed allocation, in one form or another, is how most of today’s file systems keep track of files.</div>',
              iport: '<div class="callout tip m0" data-label="Most common">Indexed allocation, in one form or another, is how most of today’s file systems keep track of files.</div>',
            }[key];
          }
          const seg = ctx.ui.seg(Object.keys(V).map((k) => ({ value: k, label: V[k].label })), key, (v) => { key = v; draw(); });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { alignItems: 'center' } }, seg, h('p', { class: 'm0 small muted', style: { flex: '1 1 260px' } }, 'The same 5-block file, “notes”, under each method. Its blocks are numbered #0–#4 in file order.')),
            h('div', { class: 'split l grow', style: { height: 'auto' } },
              h('div', { class: 'stack', style: { gap: '8px' } }, how, pros, cons, tail),
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('div', { class: 'card white tight grow', style: { display: 'grid', placeItems: 'center' } }, svg),
                h('div', { class: 'card tight stack', style: { gap: '5px' } }, entry, extra, cost)))));
          draw();
        },
      },
      {
        title: 'Allocation lab: create, grow, delete, compact',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          let method = 'contig', d = startDisk(method), sel = 'C', k = 4, newSize = 6, gen = 0;
          const cols = ctx.narrow ? 8 : 10;
          const grid = h('div', { class: 'disk', style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } });
          const stats = h('div', { class: 'small' });
          const tbl = h('table', { class: 'tbl compact' });
          const narr = h('div', { class: 'narr', 'aria-live': 'polite' });
          const readOut = h('div', { class: 'small', style: { minHeight: '42px' } });
          const say = (html, cls) => { narr.className = 'narr' + (cls ? ' ' + cls : ''); narr.innerHTML = html; };
          const bGrow = h('button', { class: 'btn sm', type: 'button', onclick: () => act(() => grow(d, sel)) });
          const bDel = h('button', { class: 'btn sm', type: 'button', onclick: () => act(() => { const r = remove(d, sel); sel = d.files.length ? d.files[0].name : null; return r; }) });
          const bCompact = h('button', { class: 'btn sm', type: 'button', onclick: () => doCompact() });
          const bRead = h('button', { class: 'btn sm primary', type: 'button', onclick: () => doRead() });
          const sizeSl = ctx.ui.slider({ label: 'New file', min: 1, max: 10, value: newSize, format: (v) => v + ' blk', onInput: (v) => { newSize = v; } });
          const kSl = ctx.ui.slider({ label: 'Block k', min: 0, max: 8, value: k, onInput: (v) => { k = v; gen++; draw(); readOut.innerHTML = 'Press <b>Read block k</b> to count the disk reads.'; } });
          const bCreate = h('button', { class: 'btn sm primary', type: 'button', onclick: () => act(() => { const r = create(d, newSize); if (r.ok) sel = r.name; return r; }) });
          bCreate.textContent = 'Create';
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => setMethod(method) }, 'Reset');
          const seg = ctx.ui.seg([{ value: 'contig', label: 'Contiguous' }, { value: 'chained', label: 'Chained' }, { value: 'indexed', label: 'Indexed' }], method, (v) => setMethod(v));

          function act(fn) { gen++; const r = fn(); say(r.msg, r.ok ? '' : 'bad'); readOut.innerHTML = 'Press <b>Read block k</b> to count the disk reads.'; draw(); }
          function intro() {
            const runs = freeRuns(d), fr = freeBlocks(d).length;
            if (method === 'contig') return `<b>Contiguous.</b> Each file is one run, found by first fit. ${fr} blocks are free, but in ${runs.length} holes (the longest is ${largestRun(d)}). Try to create a ${largestRun(d) + 1}-block file, then press <b>Compact</b> and try again.`;
            if (method === 'chained') return `<b>Chained.</b> Files A–D were created small and then grew in turns, so their blocks interleave. Each block shows the pointer it stores (→ next block). Pick file C and read block 4 to feel the cost of the chain.`;
            return `<b>Indexed.</b> Each file has an index block (double border) listing its data blocks; the small #k in a block is its position in the file. Pick file C and read block 4: two reads, however large k is.`;
          }
          function setMethod(m) { gen++; method = m; d = startDisk(m); sel = 'C'; k = Math.min(k, 4); say(intro()); readOut.innerHTML = 'Press <b>Read block k</b> to count the disk reads.'; draw(); }
          function doCompact() {
            gen++;
            const before = d.files.map((f) => pieces(readOrder(f))).reduce((a, b) => a + b, 0);
            const starts = Object.fromEntries(d.files.map((f) => [f.name, firstBlock(f)]));
            const moved = compact(d);
            const newStart = d.files.filter((f) => firstBlock(f) !== starts[f.name]).length;
            const runs = freeRuns(d), fr = freeBlocks(d).length;
            const tailRun = runs.length ? ` all ${fr} free blocks now form one run, ${runs[0][0]}–${NB - 1}` : ' there is no free space at all';
            if (method === 'contig') say(`<b>Compaction</b> slid the files toward block 0: <b>${moved} block${moved === 1 ? '' : 's'} copied</b>, and${tailRun}. ${newStart} of the ${d.files.length} table entries got a new start. Copying this much keeps the disk busy, so systems compact rarely, at quiet times.`, 'ok');
            else say(`<b>Consolidation</b> rewrote each file into neighbouring blocks: <b>${moved} block${moved === 1 ? '' : 's'} moved</b>, the files went from ${before} pieces to ${d.files.length}, and${tailRun}. ${method === 'chained' ? 'The pointers that named moved blocks were rewritten too.' : 'The index entries (and index blocks) of moved blocks were rewritten too.'} Reading a file in order now needs no seeks between its blocks.`, 'ok');
            readOut.innerHTML = 'Press <b>Read block k</b> to count the disk reads.';
            draw();
          }
          function doRead() {
            const f = getFile(d, sel); if (!f) return;
            gen++; const g = gen;
            draw();
            const path = readPath(d, sel, k);
            path.forEach((b, i) => ctx.after(i * 420, () => {
              if (g !== gen) return;
              const c = grid.children[b];
              c.classList.add('rd');
              const o = c.querySelector('.ord') || c.appendChild(h('span', { class: 'ord' }));
              o.textContent = o.textContent ? o.textContent + ',' + (i + 1) : String(i + 1);
            }));
            const n = path.length, tgt = path[n - 1];
            if (method === 'contig') readOut.innerHTML = `Block ${k} of ${sel} is at start + k = ${f.blocks[0]} + ${k} = disk block ${tgt}. <b>1 disk read</b>, whatever k is.`;
            else if (method === 'chained') readOut.innerHTML = `The OS reads ${sel}’s blocks from the start just to learn each next pointer: <b>${n} disk read${n > 1 ? 's' : ''}</b> (${path.join(' → ')}), k + 1 in all. Only the last one is the data it wanted.`;
            else readOut.innerHTML = `Read index block ${f.index}, look up entry ${k} → disk block ${tgt}, read it: <b>2 disk reads</b> (1 if the index block is already cached).`;
          }
          function draw() {
            const f = getFile(d, sel);
            grid.replaceChildren();
            for (let b = 0; b < NB; b++) {
              const o = d.own[b];
              if (o === null) { grid.append(h('div', { class: 'blk free', style: { height: '68px' } }, h('span', { class: 'bn' }, String(b)))); continue; }
              const fo = getFile(d, o), pos = fo.blocks.indexOf(b);
              let pt = '';
              if (d.isIdx[b]) pt = ctx.narrow ? 'idx' : 'index';
              else if (method === 'chained') pt = pos < fo.blocks.length - 1 ? '→' + fo.blocks[pos + 1] : 'end';
              else pt = '#' + pos;
              grid.append(h('button', { class: 'blk c-' + FCOL[o] + (d.isIdx[b] ? ' idx' : '') + (o === sel ? ' sel' : ''), type: 'button', style: { height: '68px' }, 'aria-label': `block ${b}, file ${o}`, onclick: () => { gen++; sel = o; k = Math.min(k, getFile(d, o).blocks.length - 1); readOut.innerHTML = 'Press <b>Read block k</b> to count the disk reads.'; draw(); } },
                h('span', { class: 'bn' }, String(b)), o, h('span', { class: 'pt' }, pt)));
            }
            const runs = freeRuns(d);
            stats.innerHTML = `<b>${freeBlocks(d).length}</b> free blocks · longest free run <b>${largestRun(d)}</b> · <b>${runs.length}</b> separate free run${runs.length === 1 ? '' : 's'}`;
            const head = method === 'indexed' ? '<tr><th>File</th><th>Index block</th><th>Index lists</th><th>Pieces</th></tr>' : '<tr><th>File</th><th>Start</th><th>Length</th><th>Pieces</th></tr>';
            tbl.innerHTML = head + d.files.map((x) => {
              const cells = method === 'indexed' ? `<td>${x.index}</td><td class="mono">${list(x.blocks)}</td>` : `<td>${x.blocks[0]}</td><td>${x.blocks.length}</td>`;
              return `<tr class="${x.name === sel ? 'on' : ''}"><td><button type="button" class="btn sm ghost" data-f="${x.name}" style="height:26px;padding:0 10px"><span class="sw" style="border-color:var(--${FCOL[x.name]});background:var(--${FCOL[x.name]}-bg)"></span>${x.name}</button></td>${cells}<td>${pieces(readOrder(x))}</td></tr>`;
            }).join('') + (d.files.length ? '' : '<tr><td colspan="4" class="muted">No files.</td></tr>');
            tbl.querySelectorAll('button[data-f]').forEach((b) => b.addEventListener('click', () => { gen++; sel = b.dataset.f; k = Math.min(k, getFile(d, sel).blocks.length - 1); readOut.innerHTML = 'Press <b>Read block k</b> to count the disk reads.'; draw(); }));
            bGrow.textContent = f ? `Grow ${sel} by 1 block` : 'Grow';
            bDel.textContent = f ? `Delete ${sel}` : 'Delete';
            bCompact.textContent = method === 'contig' ? 'Compact' : 'Consolidate';
            bRead.textContent = f ? `Read block k of ${sel}` : 'Read block k';
            [bGrow, bDel, bRead].forEach((b) => { b.disabled = !f; });
            const max = f ? f.blocks.length - 1 : 0;
            kSl.input.max = String(Math.max(1, max)); kSl.input.disabled = !f || max < 1;
            k = Math.min(k, max); kSl.set(k);
          }
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { alignItems: 'center', gap: '10px' } }, seg, h('div', { style: { width: '230px' } }, sizeSl), bCreate, bReset),
            h('div', { class: 'split r grow', style: { height: 'auto' } },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('div', { class: 'card white tight stack', style: { gap: '8px' } }, grid, stats),
                h('div', { class: 'card tight stack', style: { gap: '6px' } },
                  h('div', { class: 'row', style: { alignItems: 'center', gap: '10px' } }, h('div', { style: { flex: '1 1 200px' } }, kSl), bRead),
                  readOut)),
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('div', { class: 'xs b muted' }, 'FILE ALLOCATION TABLE (pick a file)'),
                tbl,
                h('div', { class: 'row gap-s' }, bGrow, bDel, bCompact),
                narr))));
          say(intro());
          readOut.innerHTML = 'Press <b>Read block k</b> to count the disk reads.';
          draw();
        },
      },
      {
        title: 'Compare the methods: reaching block k, and the big table',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;

          /* ---- tab 1: how many disk reads to reach block k ---- */
          function tabReach(p) {
            let n = 20, k = 12;
            const MAXN = 40;
            const bars = h('div', { class: 'stack', style: { gap: '10px' } });
            const tbl = h('table', { class: 'tbl compact' });
            const narr = h('div', { class: 'narr' });
            const sK = ctx.ui.slider({ label: 'Block k', min: 0, max: n - 1, value: k, onInput: (v) => { k = v; draw(); } });
            const sN = ctx.ui.slider({ label: 'File length n', min: 2, max: MAXN, value: n, format: (v) => v + ' blk', onInput: (v) => { n = v; sK.input.max = String(n - 1); if (k > n - 1) { k = n - 1; sK.set(k); } draw(); } });
            const ROWS = [
              ['Contiguous', 'io', () => 1, () => 'compute start + k, read it'],
              ['Chained', 'intr', () => k + 1, () => `read blocks 0…${k} to follow the pointers`],
              ['FAT (table cached)', 'cpu', () => 1, () => `${k} lookup${k === 1 ? '' : 's'} in memory, then 1 read`],
              ['Indexed', 'os', () => 2, () => 'read index, then block k (1 if index cached)'],
            ];
            function draw() {
              bars.replaceChildren(...ROWS.map(([name, c, f, why]) => {
                const v = f();
                return h('div', { class: 'stack', style: { gap: '3px' } },
                  h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '8px' } }, h('b', { class: 'small' }, name), h('span', { class: 'small' }, h('b', {}, v + ' disk read' + (v > 1 ? 's' : '')), ' · ' + why())),
                  h('div', { class: 'meter', style: { height: '14px' } }, h('i', { style: { width: (v / MAXN * 100) + '%', minWidth: '6px', background: `var(--${c})` } })));
              }));
              const avg = (n + 1) / 2;
              tbl.innerHTML = '<tr><th>Method</th><th>Average over every k</th><th>Read all n in order</th></tr>' +
                `<tr><td>Contiguous</td><td>1</td><td>${n}</td></tr><tr><td>Chained</td><td><b>${ctx.util.fmt(avg, 1)}</b> = (n + 1) / 2</td><td>${n}</td></tr><tr><td>FAT (table cached)</td><td>1</td><td>${n}</td></tr><tr><td>Indexed</td><td>2</td><td>${n + 1} (index once)</td></tr>`;
              narr.innerHTML = `Reaching block <b>${k}</b> of a ${n}-block file: chained allocation needs <b>${k + 1}</b> disk reads because each block's location is written only inside the block before it. The other methods compute or look up the address and go straight there.`;
            }
            p.append(h('div', { class: 'split l fill' },
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('p', { class: 'm0', html: 'A program asks for block k of a file (direct access). How many blocks must the OS read from disk to get it, assuming nothing is cached except where stated?' }),
                sN, sK, narr,
                h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Counting reads is not the whole story. Reading in order costs about n reads with every method, but scattered blocks (chained, block-indexed) also cost a seek between reads, while a contiguous file is read in one sweep.' })),
              h('div', { class: 'stack', style: { gap: '12px' } }, h('div', { class: 'card white' }, bars), tbl)));
            draw();
          }

          /* ---- tab 2: the comparison table ---- */
          function tabTable(p) {
            const COLS = ['Contiguous', 'Chained', 'Indexed, blocks', 'Indexed, portions'];
            const ROWS = [
              ['Preallocation?', ['Necessary', 'Possible', 'Possible', 'Possible'], 'Contiguous allocation must reserve the whole run when the file is created; later there may be no room next to it. The other methods <i>may</i> preallocate if asked, but do not need to, because they can add a block anywhere at any time.'],
              ['Fixed or variable portions?', ['Variable', 'Fixed blocks', 'Fixed blocks', 'Variable'], 'A contiguous file is one portion exactly as long as the file, so portion sizes vary. Chained allocation works one block at a time. Indexed allocation can do either: list single blocks, or list variable portions.'],
              ['Portion size', ['Large', 'Small', 'Small', 'Medium'], 'Contiguous: one large portion, the whole file. Chained and block-indexed: a single block. Portion-indexed: medium pieces, as large as the free space allows.'],
              ['How often it allocates', ['Once', 'Low to high', 'High', 'Low'], 'Contiguous allocates once, at creation. Chained allocates every time the file grows by a block, so it ranges from rare (a file that never grows, or one preallocated) to constant (a growing log). Block-indexed also allocates per block; portion-indexed only when the current portion is full.'],
              ['Time to allocate', ['Medium', 'Long', 'Short', 'Medium'], 'Contiguous must search for a hole big enough. Chained takes any free block, but must then write its number into the file’s last block, and the table holds only the first block and the length, so reaching that last block means following the chain from the start. Block-indexed just takes any free block and adds an index entry. Portion-indexed must search for a suitable free portion.'],
              ['File allocation table size', ['One entry', 'One entry', 'Large', 'Medium'], 'Contiguous and chained need one entry per file (start and length), however big the file. With indexing, the index grows with the file: an entry per block is large, an entry per portion is medium.'],
            ];
            let cur = 0;
            const tbl = h('table', { class: 'tbl' });
            const narr = h('div', { class: 'narr' });
            function draw() {
              tbl.innerHTML = '<tr><th></th>' + COLS.map((c) => `<th>${c}</th>`).join('') + '</tr>' +
                ROWS.map((r, i) => `<tr class="${i === cur ? 'on' : ''}"><td><button type="button" class="btn sm ${i === cur ? 'on' : 'ghost'}" data-r="${i}">${r[0]}</button></td>${r[1].map((v) => `<td>${v}</td>`).join('')}</tr>`).join('');
              tbl.querySelectorAll('button[data-r]').forEach((b) => b.addEventListener('click', () => { cur = +b.dataset.r; draw(); }));
              narr.innerHTML = `<b>${ROWS[cur][0]}</b> ${ROWS[cur][2]}`;
            }
            p.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
              h('p', { class: 'm0 small muted' }, 'Click a row label to see why each method lands where it does.'),
              tbl, narr));
            draw();
          }

          el.append(ctx.ui.tabs([
            { label: 'Reaching block k', render: tabReach },
            { label: 'The comparison table', render: tabTable },
          ]));
        },
      },
      {
        title: 'Four ways to remember which blocks are free',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const N = 32, used = new Array(N).fill(false);
          [0, 1, 2, 3, 6, 7, 10, 11, 12, 13, 14, 18, 19, 20, 24, 25, 26, 27, 31].forEach((b) => { used[b] = true; });
          let stack = [];                                                   // free block list used as a stack; stack[0] is the top
          for (let b = 0; b < N; b++) if (!used[b]) stack.push(b);
          let need = 1, hot = -1;
          const cols = ctx.narrow ? 8 : 16;
          const grid = h('div', { class: 'disk', style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } });
          const status = h('div', { class: 'small' });
          const runsOf = () => { const r = []; let s0 = -1; for (let b = 0; b <= N; b++) { const f = b < N && !used[b]; if (f && s0 < 0) s0 = b; if (!f && s0 >= 0) { r.push([s0, b - s0]); s0 = -1; } } return r; };
          const span = (a, n) => Array.from({ length: n }, (_, i) => a + i);
          const rangeTxt = (c) => (c.length > 1 ? c[0] + '–' + c[c.length - 1] : String(c[0]));
          function cands() {
            const runs = runsOf(), out = {};
            let bt = null, scanned = N, run = 0;
            for (let b = 0; b < N; b++) { run = used[b] ? 0 : run + 1; if (run === need) { bt = span(b - need + 1, need); scanned = b + 1; break; } }
            out.bit = { c: bt, cost: bt ? (need === 1 ? `Scans from bit 0; the first 0 is bit ${bt[0]}: <b>${scanned} bits checked</b>.` : `Looks for ${need} zeros in a row: blocks ${rangeTxt(bt)}, after <b>${scanned} bits checked</b>.`) : `No ${need === 1 ? 'zero bit' : 'run of ' + need + ' zeros'} anywhere: all ${N} bits checked.` };
            let visited = 0, ch = null;
            for (const [s0, len] of runs) { visited++; if (len >= need) { ch = span(s0, need); break; } }
            out.chain = { c: ch, cost: ch ? (need === 1 ? `Takes block ${ch[0]}, the head of the first portion, but must first <b>read block ${ch[0]} from disk</b>: its length and next pointer are stored inside it.` : `Follows the chain to a portion of length ≥ ${need}: <b>${visited} portion header${visited > 1 ? 's' : ''} read from disk</b>, then blocks ${rangeTxt(ch)}.`) : 'No free portion is long enough.' };
            out.index = { c: ch, cost: ch ? (need === 1 ? `Takes the first entry’s first block, ${ch[0]}, and shrinks that entry. <b>No disk read</b> if the index is in memory.` : `Scans the entries for length ≥ ${need}: <b>${visited} entr${visited > 1 ? 'ies' : 'y'} examined</b>, then blocks ${rangeTxt(ch)}.`) : 'No entry is long enough.' };
            let fl = null;
            if (need === 1) fl = stack.length ? [stack[0]] : null;
            else { const set = new Set(stack); const st = stack.slice().sort((a, b) => a - b).find((b) => span(b, need).every((x) => set.has(x))); fl = st === undefined ? null : span(st, need); }
            out.list = { c: fl, cost: fl ? (need === 1 ? `Pops the top entry: block ${fl[0]}. <b>No disk read</b> until the in-memory part runs out; then the next chunk is loaded.` : `The numbers are in no useful order, so finding ${need} neighbours means <b>searching all ${stack.length} entries</b> (or sorting them).`) : (stack.length ? `Searched all ${stack.length} entries: no ${need} neighbours.` : 'The list is empty.') };
            return out;
          }
          const PANELS = [
            ['bit', 'Bit table', 'cpu', 'One bit per block: 0 free, 1 used. Small, and runs of free blocks are easy to spot.'],
            ['chain', 'Chained free portions', 'io', 'Each free portion stores its own length and a pointer to the next one. Almost no extra space, but portions get chopped small over time.'],
            ['index', 'Indexing', 'os', 'Free space is treated like a file: an index with one (start, length) entry per free portion.'],
            ['list', 'Free block list', 'mem', 'The number of every free block, 24 or 32 bits each, kept on disk and used as a stack (or a FIFO queue).'],
          ];
          const bodies = {}, costs = {}, takes = {};
          const panels = PANELS.map(([key, title, c, desc]) => {
            bodies[key] = h('div', { style: { minHeight: '92px' } });
            costs[key] = h('div', { class: 'small', style: { lineHeight: 1.35 } });
            takes[key] = h('button', { class: 'btn sm ' + c, type: 'button', onclick: () => take(key) }, 'Allocate this way');
            const card = h('div', { class: 'card tight stack', style: { gap: '6px' }, onmouseenter: () => { hot = key; paintDisk(); }, onmouseleave: () => { hot = -1; paintDisk(); } },
              h('b', { style: { color: `var(--${c})` } }, title), h('div', { class: 'xs muted', style: { fontSize: '13px', lineHeight: 1.3 } }, desc), bodies[key], costs[key], h('div', { style: { marginTop: 'auto' } }, takes[key]));
            card.addEventListener('focusin', () => { hot = key; paintDisk(); });
            return card;
          });
          const chip = (txt, cls, extra) => h('span', { class: 'mono', style: Object.assign({ display: 'inline-block', padding: '1px 6px', borderRadius: '6px', border: '1.5px solid var(--line-2)', fontSize: '13.5px', fontWeight: 700, background: 'var(--panel)' }, cls || {}, extra || {}) }, txt);
          function take(key) {
            const c = cands()[key].c; if (!c) return;
            c.forEach((b) => { used[b] = true; });
            stack = stack.filter((x) => !c.includes(x));
            status.innerHTML = `Allocated block${c.length > 1 ? 's' : ''} <b>${rangeTxt(c)}</b> using the ${PANELS.find((p) => p[0] === key)[1].toLowerCase()}. All four records were updated to match.`;
            draw();
          }
          function toggle(b) {
            used[b] = !used[b];
            if (used[b]) { stack = stack.filter((x) => x !== b); status.innerHTML = `Block ${b} is now in use: bit ${b} became 1, its free portion shrank or split, and ${b} left the free list.`; }
            else { stack.unshift(b); status.innerHTML = `Block ${b} was freed: bit ${b} became 0, it joined or started a free portion, and ${b} was pushed on top of the free list.`; }
            draw();
          }
          function paintDisk() {
            const c = hot === -1 ? null : cands()[hot].c;
            [...grid.children].forEach((cell, b) => cell.classList.toggle('rd', !!c && c.includes(b)));
          }
          function draw() {
            const runs = runsOf(), cc = cands();
            grid.replaceChildren(...Array.from({ length: N }, (_, b) => h('button', { class: 'blk ' + (used[b] ? 'c-other' : 'free'), type: 'button', style: { height: '42px', fontSize: '14px' }, 'aria-label': `block ${b}, ${used[b] ? 'used' : 'free'}`, onclick: () => toggle(b) }, h('span', { class: 'bn' }, String(b)), used[b] ? '■' : '')));
            const bitRows = [];
            for (let r = 0; r < N / 8; r++) {
              const bits = Array.from({ length: 8 }, (_, i) => { const b = r * 8 + i, on = cc.bit.c && cc.bit.c.includes(b); return `<span style="${on ? 'background:var(--hl);font-weight:900;' : ''}${used[b] ? '' : 'color:var(--ok);'}">${used[b] ? 1 : 0}</span>` + (i === 3 ? ' ' : ''); }).join('');
              bitRows.push(`<div class="mono" style="font-size:15px;line-height:1.45"><span class="muted" style="display:inline-block;width:52px">${r * 8}–${r * 8 + 7}</span>${bits}</div>`);
            }
            bodies.bit.innerHTML = bitRows.join('');
            const shown = runs.slice(0, 7);
            bodies.chain.replaceChildren(h('div', { class: 'row', style: { gap: '3px', rowGap: '5px', alignItems: 'center' } },
              h('span', { class: 'xs muted' }, 'head →'), ...shown.flatMap(([s0, len], i) => [chip(`${s0}·${len}`, null, cc.chain.c && cc.chain.c[0] === s0 ? { background: 'var(--hl)' } : null), h('span', { class: 'xs' }, i < runs.length - 1 ? '→' : '∅')]), runs.length > 7 ? h('span', { class: 'xs muted' }, `+${runs.length - 7} more`) : null));
            bodies.index.replaceChildren(h('div', { class: 'row', style: { gap: '4px', rowGap: '5px' } },
              ...shown.map(([s0, len]) => chip(`(${s0}, ${len})`, null, cc.index.c && cc.index.c[0] === s0 ? { background: 'var(--hl)' } : null)), runs.length > 7 ? h('span', { class: 'xs muted' }, `+${runs.length - 7} more`) : null));
            const MEM = 4;
            bodies.list.replaceChildren(h('div', { class: 'row', style: { gap: '4px', rowGap: '5px', alignItems: 'center' } },
              h('span', { class: 'xs b', style: { color: 'var(--mem)' } }, 'top ▸'),
              ...stack.slice(0, 12).map((b, i) => chip(String(b), i < MEM ? { borderColor: 'var(--mem)', background: 'var(--mem-bg)' } : { color: 'var(--muted)', borderStyle: 'dashed' }, cc.list.c && cc.list.c.includes(b) ? { background: 'var(--hl)' } : null)),
              stack.length > 12 ? h('span', { class: 'xs muted' }, `+${stack.length - 12}`) : null),
              h('div', { class: 'xs muted', style: { marginTop: '4px' } }, `solid: top ${Math.min(MEM, stack.length)} in memory · dashed: on disk`));
            PANELS.forEach(([key]) => { costs[key].innerHTML = cc[key].cost; takes[key].disabled = !cc[key].c; });
            const fr = used.filter((u) => !u).length;
            counts.innerHTML = `<b>${fr}</b> free blocks in <b>${runs.length}</b> free portion${runs.length === 1 ? '' : 's'}`;
            paintDisk();
          }
          const counts = h('span', { class: 'small' });
          const seg = ctx.ui.seg([{ value: 1, label: 'Need 1 block' }, { value: 3, label: 'Need 3 in a row' }], need, (v) => { need = v; draw(); });
          status.innerHTML = 'Click any block to free it or fill it. Point at a panel to see the block it would hand out.';
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'card white tight stack', style: { gap: '6px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', gap: '10px' } }, h('span', { class: 'small' }, h('b', {}, 'The same 32-block disk, four records. '), counts), seg),
              grid, status),
            h('div', { class: 'grid-4 grow', style: { gap: '10px' } }, ...panels)));
          draw();
        },
      },
      {
        title: 'How big is a bit table, and how to search it fast',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
          const fmtB = (x) => { let u = 0; while (x >= 1024 && u < UNITS.length - 1) { x /= 1024; u++; } return (Number.isInteger(x) ? x : ctx.util.fmt(x, 2)) + ' ' + UNITS[u]; };
          const fmtN = (x) => Math.round(x).toLocaleString('en-US');
          let dk = 34, bk = 9;                                              // disk = 2^dk bytes, block = 2^bk bytes (16 GB, 512 B)
          const out = h('table', { class: 'tbl compact' });
          const narr = h('div', { class: 'narr' });
          const sD = ctx.ui.slider({ label: 'Disk size', min: 30, max: 44, value: dk, format: (v) => fmtB(2 ** v), onInput: (v) => { dk = v; draw(); } });
          const sB = ctx.ui.slider({ label: 'Block size', min: 9, max: 16, value: bk, format: (v) => fmtB(2 ** v), onInput: (v) => { bk = v; draw(); } });
          const bEx = h('button', { class: 'btn sm', type: 'button', onclick: () => { dk = 34; bk = 9; sD.set(dk); sB.set(bk); draw(); } }, 'Classic example: 16 GB, 512-byte blocks');
          function draw() {
            const nb = 2 ** (dk - bk), bitBytes = nb / 8, tblBlocks = Math.ceil(bitBytes / 2 ** bk), bits = dk - bk;
            const entry = bits <= 24 ? 24 : bits <= 32 ? 32 : 64;
            out.innerHTML = `<tr><th>Quantity</th><th>How</th><th>Value</th></tr>
              <tr><td>Blocks on the disk</td><td>disk ÷ block = 2<sup>${dk}</sup> ÷ 2<sup>${bk}</sup></td><td><b>2<sup>${bits}</sup></b> = ${fmtN(nb)}</td></tr>
              <tr><td>Bit table</td><td>blocks ÷ 8 (one bit each)</td><td><b>${fmtB(bitBytes)}</b></td></tr>
              <tr><td>Share of the disk</td><td>1 ÷ (8 × block size)</td><td>${ctx.util.fmt(100 / (8 * 2 ** bk), 4)} %</td></tr>
              <tr><td>Blocks to store it</td><td>bit table ÷ block size</td><td>${fmtN(tblBlocks)}</td></tr>
              <tr><td>Bits in a block number</td><td>log<sub>2</sub>(blocks)</td><td>${bits} → ${entry}-bit list entries</td></tr>
              <tr><td>Free block list, empty disk</td><td>blocks × ${entry} bits</td><td><b>${fmtB(nb * entry / 8)}</b> (${entry} × the bit table)</td></tr>`;
            narr.innerHTML = `A ${fmtB(2 ** dk)} disk with ${fmtB(2 ** bk)} blocks has 2<sup>${bits}</sup> blocks, so its bit table is 2<sup>${bits}</sup> bits = <b>${fmtB(bitBytes)}</b>. ${bitBytes > 2 ** 20 ? 'That is too big to rescan from the start on every allocation, and too big to reread from disk each time, which is why summary tables help (' + (ctx.narrow ? 'below' : 'right') + ').' : 'Small enough to keep in memory, but scanning it bit by bit still costs time.'}${entry === 64 ? ` These block numbers need ${bits} bits, too many for 32-bit list entries.` : ''}`;
          }

          /* ---- summary-table demo ---- */
          const PATTERN = ['11111111', '11011111', '11111111', '10011011', '11111111', '11100001', '11111101', '10000000'];
          const bitsAll = PATTERN.join('').split('').map(Number);
          let need = 3;
          const rowsEl = h('div', { class: 'stack', style: { gap: '4px' } });
          const res = h('div', { class: 'small' });
          const sN = ctx.ui.slider({ label: 'Need a run of', min: 1, max: 7, value: need, format: (v) => v + ' blk', onInput: (v) => { need = v; drawSum(); } });
          const longest = (s) => s.split('1').reduce((m, z) => Math.max(m, z.length), 0);
          const free = (s) => s.split('').filter((c) => c === '0').length;
          function drawSum() {
            const pick = PATTERN.findIndex((s) => longest(s) >= need);
            let runStart = -1, inRange = 0;
            if (pick >= 0) { let run = 0; for (let i = 0; i < 8; i++) { run = PATTERN[pick][i] === '0' ? run + 1 : 0; if (run === need) { runStart = pick * 8 + i - need + 1; inRange = i + 1; break; } } }
            let plain = 0, r2 = 0;
            for (let b = 0; b < 64; b++) { r2 = bitsAll[b] ? 0 : r2 + 1; plain = b + 1; if (r2 === need) break; }
            rowsEl.replaceChildren(...PATTERN.map((s, r) => {
              const skipped = pick < 0 || r < pick, scanned = r === pick, unused = pick >= 0 && r > pick;
              const bitsEl = h('span', { class: 'mono', style: { fontSize: '15px', letterSpacing: ctx.narrow ? '1px' : '2px', opacity: skipped ? 0.45 : unused ? 0.6 : 1 } },
                ...s.split('').map((c, i) => { const b = r * 8 + i, hit = runStart >= 0 && b >= runStart && b < runStart + need; return h('span', { style: { background: hit ? 'var(--hl)' : 'none', color: c === '0' ? 'var(--ok)' : 'inherit', fontWeight: hit ? 900 : 600 } }, c); }));
              return h('div', { class: 'row nw', style: { gap: ctx.narrow ? '6px' : '10px', alignItems: 'center', fontSize: '14px' } },
                h('span', { class: 'muted', style: { width: ctx.narrow ? '44px' : '48px', flex: 'none', whiteSpace: 'nowrap', fontSize: ctx.narrow ? '13px' : '14px' } }, `${r * 8}–${r * 8 + 7}`), bitsEl,
                h('span', { class: 'mono', style: { padding: '1px 6px', borderRadius: '6px', background: scanned ? 'var(--accent-bg)' : 'var(--panel-3)', fontSize: '13.5px', whiteSpace: 'nowrap' } }, `free ${free(s)}, run ${longest(s)}`),
                h('span', { class: 'xs b', style: { color: scanned ? 'var(--accent)' : 'var(--muted)', whiteSpace: 'nowrap' } }, scanned ? (ctx.narrow ? '◂ scan' : '◂ scan this one') : skipped ? 'skip' : ''));
            }));
            res.innerHTML = pick >= 0
              ? `The summaries rule out ${pick} range${pick === 1 ? '' : 's'} at a glance; the scan finds ${need === 1 ? `block <b>${runStart}</b>` : `blocks <b>${runStart}–${runStart + need - 1}</b>`} after reading <b>${pick + 1} summar${pick === 0 ? 'y' : 'ies'} + ${inRange} bits</b>. A plain scan from bit 0 would check <b>${plain} bits</b>.`
              : `No range has a free run of ${need}; the summaries say so without touching a single bit.`;
          }
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'A <span class="t">bit table</span> costs one bit per block. Move the sliders to see how that adds up on a real disk (sizes in powers of two: 1 KB = 1024 bytes).' }),
              sD, sB, h('div', {}, bEx), out, narr),
            h('div', { class: 'card stack', style: { gap: '9px' } },
              h('b', {}, 'Summary tables'),
              h('p', { class: 'm0 small', html: 'Split the bit table into ranges and keep a tiny <span class="t">summary table</span>: for each range, how many blocks are free and the longest free run. The allocator only scans a range whose summary says the request can fit. (Runs that cross a range boundary need a little extra care, which this demo leaves out.)' }),
              sN, rowsEl, res)));
          draw(); drawSum();
        },
      },
      {
        title: 'Reliability: never hand out a block twice',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const B0 = 16;                                                    // the strip shows blocks 16..23
          const INIT = () => ({ mem: [1, 1, 1, 1, 0, 0, 0, 0], disk: [1, 1, 1, 1, 0, 0, 0, 0], cand: [], memA: '16 → 17 → end', diskA: '16 → 17 → end', diskB: 'none yet', data: ['', '', '', ''], lock: null, A: 'running', B: 'running', lost: false, step: 0, verdict: null, ifCrash: '' });
          const mark = (arr, bl, v) => bl.forEach((b) => { arr[b - B0] = v; });
          const NOTHING = 'Nothing has changed on disk yet, so nothing is lost or shared.';
          const SC = {
            crash: [
              [(s) => s, '<b>Start.</b> For speed, the OS keeps copies of the disk allocation table and of each file’s allocation in memory. Right now memory and disk agree: blocks 20–23 are free, and file A owns 16 → 17.'],
              [(s) => { mark(s.mem, [20, 21], 1); s.cand = [20, 21]; s.A = 'allocating 2 blocks'; }, 'A asks for 2 more blocks. The OS searches its <b>memory copy</b>, finds 20 and 21 free and marks them used, <b>in memory only</b>. The table on disk still says they are free.'],
              [(s) => { s.cand = []; s.memA = s.diskA = '16 → 17 → 20 → 21'; s.data[0] = s.data[1] = 'A'; s.A = 'wrote 20, 21'; }, 'A writes its new data into 20 and 21, and block 17 on disk now points to 20. So a <b>reference</b> to block 20 is on disk, while the record that 20 is taken is still only in memory.'],
              [(s) => { s.lost = true; s.A = 'stopped'; s.B = 'stopped'; }, '<b>Crash!</b> The power fails. Everything in memory vanishes, including the only record that blocks 20 and 21 are in use.'],
              [(s) => { s.lost = false; s.mem = s.disk.slice(); s.memA = s.diskA; s.A = 'running'; s.B = 'running'; }, 'The system restarts and reloads the disk allocation table from disk. It says 20–23 are free, which is now <b>wrong</b>.'],
              [(s) => { mark(s.mem, [20, 21], 1); s.data[0] = s.data[1] = 'B over A'; s.diskB = '20 → 21'; s.B = 'given 20, 21'; }, 'B asks for 2 blocks and is given <b>20 and 21</b>, the very blocks A is using. B writes its data there, over A’s.'],
              [(s) => { s.A = 'reads B’s data!'; s.verdict = 'bad'; }, 'A follows its chain 16 → 17 → 20 and reads <b>B’s data</b>. Two files share blocks 20 and 21, so both are corrupted. The cause: a reference reached the disk <b>before</b> the record that the blocks were taken.'],
            ],
            race: [
              [(s) => s, '<b>Start.</b> A and B ask for space at the same moment: on two processors, or A is interrupted halfway through. Nothing stops their allocation code from using the table together.'],
              [(s) => { s.cand = [20, 21]; s.A = 'saw 20, 21 free'; }, 'A’s allocation code scans the table and sees <b>20 and 21 free</b>. Before it can mark them, B’s code runs.'],
              [(s) => { s.B = 'saw 20, 21 free'; }, 'B’s code scans the same table. 20 and 21 <b>still look free</b>, because A has not marked them yet.'],
              [(s) => { s.cand = []; mark(s.mem, [20, 21], 1); s.A = 'took 20, 21'; }, 'A marks 20 and 21 used and takes them.'],
              [(s) => { s.B = 'took 20, 21'; s.diskB = '20 → 21'; s.memA = s.diskA = '16 → 17 → 20 → 21'; }, 'B marks them used too (they already are) and also takes them. Both files now list the same two blocks.'],
              [(s) => { mark(s.disk, [20, 21], 1); s.data[0] = s.data[1] = 'B over A'; s.verdict = 'bad'; }, 'Both write their data; whoever writes last wins and the other file is silently corrupted. This is a <span class="t">race condition</span>: the search-and-mark must be a <span class="t">critical section</span>.'],
            ],
            safe: [
              [(s) => { s.ifCrash = NOTHING; }, '<b>Start.</b> Same disk, same two requests. This time every allocation follows five steps, in order (right).'],
              [(s) => { s.lock = 'A'; s.step = 1; s.A = 'holds the lock'; }, '<b>Step 1.</b> A <b>locks</b> the disk allocation table on disk. While A holds the lock, nobody else can allocate on this volume.'],
              [(s) => { s.B = 'waiting for the lock'; }, 'B asks for space too and tries to lock the table. It has to <b>wait</b>.'],
              [(s) => { s.step = 2; s.cand = [20, 21]; s.A = 'searching'; }, '<b>Step 2.</b> A <b>searches</b> for free space and finds 20 and 21. The memory copy can be trusted, because only the lock holder may change the table.'],
              [(s) => { s.step = 3; s.cand = []; s.A = 'allocating'; mark(s.mem, [20, 21], 1); mark(s.disk, [20, 21], 1); s.ifCrash = 'Blocks 20 and 21 are marked used on disk but no file points to them: two <span class="t">lost blocks</span>. A disk check can find and free them. Wasted space, but no block is shared.'; }, '<b>Step 3.</b> A <b>allocates</b> 20 and 21 and <b>writes the updated table to disk</b> right away (with chained allocation, any changed pointers too).'],
              [(s) => { s.step = 4; s.A = 'updating its file'; s.memA = s.diskA = '16 → 17 → 20 → 21'; s.data[0] = s.data[1] = 'A'; s.ifCrash = 'The disk is fully consistent: 20 and 21 are marked used and belong to A.'; }, '<b>Step 4.</b> A’s <b>file allocation</b> entry is updated and written to disk (17 now points to 20), and A writes its data.'],
              [(s) => { s.step = 5; s.lock = 'B'; s.A = 'done'; s.B = 'holds the lock'; }, '<b>Step 5.</b> A <b>unlocks</b> the table. B, which was waiting, gets the lock at once.'],
              [(s) => { s.step = 0; s.lock = null; mark(s.mem, [22, 23], 1); mark(s.disk, [22, 23], 1); s.diskB = '22 → 23'; s.data[2] = s.data[3] = 'B'; s.B = 'done: got 22, 23'; s.verdict = 'ok'; }, 'B runs the same five steps. The table already says 20 and 21 are taken, so B gets <b>22 and 23</b>. Every block has exactly one owner.'],
            ],
          };
          const STEPS5 = ['Lock the disk allocation table on disk', 'Search it for free space', 'Allocate: update the table and write it to disk', 'Update the file allocation table and write it to disk', 'Unlock the disk allocation table'];
          let sc = 'crash';
          const stateAt = (i) => { const s = INIT(); SC[sc].slice(0, i + 1).forEach((f) => f[0](s)); return s; };
          const chipA = h('span', { class: 'chip proc' }), chipB = h('span', { class: 'chip proc' }), lockEl = h('span', { class: 'chip' });
          const memBits = h('div', { class: 'disk', style: { gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' } }), diskBits = memBits.cloneNode();
          const memA = h('div', { class: 'mono', style: { fontSize: '15.5px' } }), diskA = h('div', { class: 'mono', style: { fontSize: '15.5px' } }), diskB = h('div', { class: 'mono', style: { fontSize: '15.5px' } });
          const dataEl = h('div', { class: 'disk', style: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' } });
          const memBody = h('div', { class: 'stack', style: { gap: '9px' } }), lostEl = h('div', { class: 'narr bad', style: { display: 'none', fontWeight: 700 } }, 'Erased by the crash: memory holds nothing.');
          const side = h('div', { class: 'stack', style: { gap: '8px' } });
          function bitCells(host, arr, prev, cand) {
            host.replaceChildren(...arr.map((v, i) => h('div', { class: 'blk ' + (v ? 'c-other' : 'free'), style: { height: '60px', paddingTop: '14px', fontSize: '22px', background: v !== prev[i] ? 'var(--hl)' : cand.includes(B0 + i) ? 'var(--accent-bg)' : null, borderColor: cand.includes(B0 + i) ? 'var(--accent)' : null } }, h('span', { class: 'bn' }, String(B0 + i)), String(v))));
          }
          function draw(i) {
            const st = stateAt(i), pv = i ? stateAt(i - 1) : st;
            chipA.textContent = 'A: ' + st.A; chipB.textContent = 'B: ' + st.B;
            lockEl.textContent = st.lock ? 'table locked by ' + st.lock : 'table unlocked';
            lockEl.className = 'chip ' + (st.lock ? 'warn' : '');
            memBody.style.display = st.lost ? 'none' : ''; lostEl.style.display = st.lost ? '' : 'none';
            bitCells(memBits, st.mem, pv.lost ? st.mem : pv.mem, st.cand);
            bitCells(diskBits, st.disk, pv.disk, []);
            memA.textContent = 'A: ' + st.memA; diskA.textContent = 'A: ' + st.diskA; diskB.textContent = 'B: ' + st.diskB;
            dataEl.replaceChildren(...st.data.map((v, j) => h('div', { class: 'blk ' + (v === 'B over A' ? '' : v === 'A' ? 'c-proc' : v === 'B' ? 'c-thread' : 'free'), style: Object.assign({ height: '72px', paddingTop: '12px', fontSize: v === 'B over A' ? '14px' : '18px' }, v === 'B over A' ? { borderColor: 'var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' } : {}) }, h('span', { class: 'bn' }, String(20 + j)), v === 'B over A' ? 'B over A' : v)));
            if (sc === 'safe') {
              side.replaceChildren(h('b', { class: 'small' }, 'Safe allocation, in this order'),
                h('ol', { class: 'm0 small', style: { paddingLeft: '22px', lineHeight: 1.45 } }, ...STEPS5.map((t, j) => h('li', { style: { background: st.step === j + 1 ? 'var(--accent-bg)' : 'none', borderRadius: '6px', padding: '1px 4px', fontWeight: st.step === j + 1 ? 800 : 400 } }, t))),
                h('div', { class: 'narr ' + (st.verdict === 'ok' ? 'ok' : ''), html: `<b>If the power failed now:</b> ${st.ifCrash}` }));
            } else {
              side.replaceChildren(h('div', { class: 'narr ' + (st.verdict === 'bad' ? 'bad' : ''), html: sc === 'crash'
                ? '<b>The danger.</b> Copies in memory are fast but vanish in a crash. If a pointer to a block reaches the disk while the record “this block is used” is still only in memory, a restart can give that block away again.'
                : '<b>The danger.</b> Searching the table and marking the result are two separate actions. If two allocators interleave between them, both pick the same free blocks.' }),
              h('p', { class: 'small m0 muted' }, 'Switch to “Safe” to see the five-step cure for both problems.'));
            }
          }
          let player;
          const seg = ctx.ui.seg([{ value: 'crash', label: 'Crash, no care' }, { value: 'race', label: 'Race, no lock' }, { value: 'safe', label: 'Safe: lock, then write in order' }], sc, (v) => { sc = v; player.stop(); player.setCount(SC[sc].length); player.go(0); });
          player = ctx.ui.player({ count: SC[sc].length, interval: 3200, render: (i) => { draw(i); return SC[sc][i][1]; } });
          const memCard = h('div', { class: 'card mem stack', style: { gap: '9px' } }, h('b', { style: { color: 'var(--mem)' } }, 'Main memory (fast, lost in a crash)'),
            memBody, lostEl);
          memBody.append(h('div', { class: 'xs b muted' }, 'COPY OF THE DISK ALLOCATION TABLE, BLOCKS 16–23'), memBits, h('div', { class: 'xs b muted' }, 'COPY OF A’S FILE ALLOCATION'), memA,
            h('p', { class: 'small m0 muted', style: { marginTop: '6px' } }, 'Why keep copies here? Checking a table in memory takes well under a microsecond; reading it from a hard disk takes milliseconds.'));
          const diskCard = h('div', { class: 'card io stack', style: { gap: '9px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } }, h('b', { style: { color: 'var(--io)' } }, 'Disk (survives a crash)'), lockEl),
            h('div', { class: 'xs b muted' }, 'DISK ALLOCATION TABLE ON DISK'), diskBits,
            h('div', { class: 'xs b muted' }, 'FILE CHAINS STORED ON DISK'), h('div', { class: 'row', style: { gap: '16px' } }, diskA, diskB),
            h('div', { class: 'xs b muted' }, 'DATA IN BLOCKS 20–23'), dataEl);
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { alignItems: 'center', gap: '10px' } }, seg, chipA, chipB),
            h('div', { class: 'grid-3 grow', style: { gap: '10px', gridTemplateColumns: ctx.narrow ? '1fr' : '1fr 1.15fr 1fr' } }, memCard, diskCard, side),
            player.el));
        },
      },
      {
        title: 'Recap: what to remember',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['Preallocation or dynamic allocation?', 'Preallocation reserves a file’s maximum size at creation: simple, but sizes are hard to guess and the extra space is wasted. Dynamic allocation hands out portions as the file grows.'],
              ['Big portions or small blocks?', 'Large contiguous portions: fast reads and few table entries, but free space fragments. Small fixed blocks: flexible and simple, but large tables and scattered blocks.'],
              ['Contiguous, chained, indexed?', 'Contiguous: one run (start, length), fast but fragments. Chained: each block points to the next, no external fragmentation, slow to reach block k. Indexed: an index lists the blocks; the most used.'],
              ['What is FAT?', 'Chained allocation with every next-pointer moved out of the data blocks into one table, one entry per cluster. Cached in memory, the chain costs no disk reads to follow.'],
              ['Four ways to track free space?', 'Bit table (one bit per block), chained free portions (length and pointer inside each), indexing (an entry per free portion), free block list (24- or 32-bit numbers, a stack or queue).'],
              ['16 GB disk, 512-byte blocks: bit table?', '2<sup>34</sup> ÷ 2<sup>9</sup> = 2<sup>25</sup> blocks, so 2<sup>25</sup> bits = <b>4 MB</b>. A free block list of 32-bit entries would need 128 MB.'],
              ['What is a volume?', 'A logical disk: a set of addressable sectors that an OS or application can use. It may be part of one disk or spread over several.'],
              ['How is a block never given out twice?', 'Lock the disk allocation table, search, allocate and write the table to disk, update the file allocation table on disk, unlock. A crash can then only lose blocks.'],
            ], { cols: ctx.narrow ? 1 : 4, height: 215 })));
        },
      },
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which file allocation method <b>requires</b> preallocation, so that a file’s full size must be reserved when the file is created?',
            choices: ['Chained allocation, where each block names the next one', 'Indexed allocation with single fixed-size blocks', 'Contiguous allocation, one run of blocks per file', 'Indexed allocation with variable-size portions'], answer: 2,
            feedback: ['Chained allocation can add any free block at any time, so it never needs to reserve space in advance.', 'Block-indexed allocation adds any free block to the index whenever the file grows; preallocation is optional.', null, 'Portion-indexed allocation adds a new portion to the index whenever the file needs one; preallocation is optional.'],
            why: 'A contiguous file is one run, so the whole run must be chosen at creation; later there may be no free block next to it. The other methods can grow a file one block or portion at a time.' },
          { type: 'num', q: 'A 16-GB disk (2<sup>34</sup> bytes) uses 512-byte blocks. How many megabytes (1 MB = 2<sup>20</sup> bytes) does its bit table occupy?', answer: 4, tol: 0, unit: 'MB',
            why: '2<sup>34</sup> ÷ 2<sup>9</sup> = 2<sup>25</sup> blocks, one bit each: 2<sup>25</sup> bits = 2<sup>22</sup> bytes = 4 MB.' },
          { type: 'num', q: 'A disk has 2<sup>25</sup> blocks. A free block list stores each free block’s number in a 32-bit entry. How many megabytes does the list need when every block is free?', answer: 128, tol: 0, unit: 'MB',
            why: '2<sup>25</sup> entries × 4 bytes = 2<sup>27</sup> bytes = 128 MB, which is 32 times the size of the 4-MB bit table for the same disk.' },
          { type: 'num', q: 'A file uses chained allocation and none of its blocks are in memory. Blocks are numbered from 0 in file order. How many disk reads does the OS need to get block 6?', answer: 7, tol: 0, unit: 'reads',
            why: 'The address of each block is stored only in the block before it, so the OS must read blocks 0 to 6: k + 1 = 7 reads.' },
          { q: 'How does the FAT file system differ from plain chained allocation?',
            choices: ['It stores each file in one contiguous run of clusters, so no next pointers are needed at all', 'It gives each file its own index block that lists all of that file’s clusters in order', 'It replaces the chain with a bit table that marks which clusters belong to which file', 'It moves every next pointer out of the data blocks into one table, one entry per cluster'], answer: 3,
            feedback: ['FAT files can be scattered; that is exactly why a chain of next pointers is needed.', 'A per-file list of blocks is indexed allocation. FAT keeps a single table for the whole volume.', 'A bit table only says free or used; it cannot record which block comes next in a file.', null],
            why: 'FAT is still a chain, but the links live in one table with an entry per cluster. The table can be cached in memory, so following the chain needs no disk reads.' },
          { q: 'Which statement about a <b>volume</b> is correct?',
            choices: ['It is always exactly one whole physical drive, never part of one or several', 'It is a logical disk whose sectors may be spread over several physical disks', 'It is the region of the file system that records which of its blocks are free', 'It is the set of blocks that belong to one file, wherever on the disk they lie'], answer: 1,
            feedback: ['A volume can be part of one drive (a partition) or combine space from several drives.', null, 'That is the disk allocation table (the free-space record), which lives inside a volume.', 'Those blocks form one file; a volume holds many files.'],
            why: 'A volume is a collection of addressable sectors that an OS or application can use for storage. They need not be contiguous and may sit on several physical disks.' },
          { q: 'After a crash and restart, the OS gives file B two blocks that file A is still using. What made this possible?',
            choices: ['A reference to the blocks reached the disk before the on-disk table recorded them as used', 'The disk allocation table on disk was locked before the search for free blocks began', 'The file allocation table was written to disk only after the disk allocation table', 'The OS searched its cached copy of the free-space table instead of reading the table on disk'], answer: 0,
            feedback: [null, 'Locking first is the correct first step of safe allocation; it prevents two allocators from interleaving.', 'That order is the safe one: a crash between the two writes leaves lost blocks, never shared ones.', 'Searching the cached copy is fine, and the safe procedure does it while holding the lock. The problem is what reached the disk first.'],
            why: 'The memory copy said “used”, but the disk still said “free” when the crash erased memory. After the restart the stale on-disk table handed the blocks out again.' },
          { type: 'tf', q: 'Chained allocation suffers from external fragmentation, so the disk must be compacted from time to time to keep it usable.', answer: false,
            why: 'Any free block can join a chain, so free space never becomes unusable. Files may be consolidated now and then, but only to improve locality (fewer seeks).' },
          { type: 'order', q: 'Put the steps of safe block allocation in order.', items: ['Lock the disk allocation table on disk', 'Search the table for free space', 'Allocate the space and write the updated table to disk', 'Update the file allocation table and write it to disk', 'Unlock the disk allocation table'],
            why: 'Locking stops two allocators from interleaving. Writing the free-space table before the file’s own records means a crash can only leave lost blocks, never blocks owned twice.' },
          { type: 'match', q: 'Match each method to the property that best describes it.',
            pairs: [['Contiguous allocation', 'Needs compaction now and then to cure external fragmentation'], ['Chained allocation', 'Must follow pointers block by block to reach block k'], ['Indexed allocation', 'Keeps a separate block listing the file’s blocks in order'], ['FAT', 'Keeps every next pointer in one table that can be cached']],
            why: 'Each method’s strength and weakness follows from where it records the order of a file’s blocks: implied by position, inside each block, in a per-file index, or in one shared table.' },
          { type: 'bucket', q: 'Which free-space method does each statement describe?', buckets: ['Bit table', 'Chained free portions', 'Free block list'],
            items: [['One bit per block: 0 free, 1 in use', 0], ['Summary tables per range of blocks speed up searching', 0], ['Each free portion stores its length and a pointer to the next one', 1], ['Allocating a block first means reading that block from disk', 1], ['Each entry is a 24- or 32-bit block number', 2], ['Often used as a stack with only its top part in memory', 2]],
            why: 'A bit table maps every block to one bit; chained free portions keep their bookkeeping inside the free space itself; a free block list stores full block numbers.' },
          { type: 'multi', q: 'Which statements about the size of allocation portions are true?',
            choices: ['Larger portions mean fewer entries in the file allocation table', 'Fixed-size portions make reallocating space simple', 'Small fixed-size blocks give a file the best contiguity', 'Variable-size portions can leave free space in many odd-sized holes'], answer: [0, 1, 3],
            why: 'Big portions cut table size and seeks; fixed sizes make any free portion fit any need. Small blocks are flexible but scatter a file, and variable portions fragment free space.' },
        ],
      },
    ],
    notes: `
      <h3>Two records the file system must keep</h3>
      <p>For every block of secondary storage the OS must know (1) which file owns it and where it comes in that file, and (2) whether it is free. Deciding and recording the first is <b>file allocation</b>; its record is the <b>file allocation table</b>. Tracking the second is <b>free-space management</b> (also called free storage management); its record is the <b>disk allocation table</b>. Every create, grow and delete changes both. All of this happens inside a <b>volume</b>: a logical disk, meaning a set of addressable sectors that an OS or application can use for data. A volume's sectors need not be contiguous and may be spread over several physical disks.</p>

      <h3>Three allocation decisions</h3>
      <ul>
        <li><b>When:</b> <b>preallocation</b> gives a file its declared maximum size at creation; <b>dynamic allocation</b> gives space in portions as the file grows. Final sizes are hard to guess, so people overestimate and preallocation wastes space; guessing too low forces a copy to a bigger area or an error.</li>
        <li><b>How much:</b> a <b>portion</b> can be one block or the whole file. Contiguity (big portions) speeds reading; many small portions make the allocation tables big; fixed-size portions make reallocation simple; variable or small fixed portions reduce the space lost to overallocation. Example: a 23-block file in 4-block portions needs 6 portions (6 table entries) with 1 unused block.</li>
        <li><b>Two main options:</b> large, variable-size contiguous portions (good performance, little waste, but complex tables and fragmented free space) or small fixed blocks (flexible, simple, but large tables and scattered files).</li>
        <li><b>Where:</b> a variable portion is placed with <b>first fit</b> (first free portion big enough), <b>best fit</b> (smallest one big enough) or <b>nearest fit</b> (the one closest to the file's previous portion, for locality), as with main memory in chapter 7. Example with free portions 2–4, 9–14, 16–17, 24–28, 33–36, a previous portion at 20–23 and a 4-block request: first fit picks 9–14, best fit 33–36, nearest fit 24–28.</li>
      </ul>

      <h3>The three allocation methods</h3>
      <h4>Contiguous allocation</h4>
      <p>One run of consecutive blocks per file, chosen at creation (preallocation is necessary). Table entry: <b>start block and length</b>. Best for sequential reading (no seeks inside the file) and direct access is easy: block k is at start + k, one read. Weakness: <b>external fragmentation</b> of free space; a new file can be refused although enough blocks are free in total, so the disk needs <b>compaction</b> now and then, which copies many blocks. A file that grows may have to be moved.</p>
      <h4>Chained (linked) allocation</h4>
      <p>Blocks can be anywhere; each block holds a pointer to the next, and the last says end. Table entry: <b>start block and length</b>. Any free block can be added, so there is no external fragmentation and growth is easy. Sequential reading is fine, but reaching block k needs k + 1 reads (average (n + 1)/2 for an n-block file), and blocks scatter (poor locality), so files are <b>consolidated</b> now and then. <b>FAT</b> (MS-DOS and Windows) keeps the chain pointers in one table with an entry per cluster instead of inside the blocks; cached in memory, the chain can be followed without disk reads.</p>
      <h4>Indexed allocation</h4>
      <p>Each file has a one-level index, kept in its own <b>index block</b>, with one entry per block or portion of the file; the table entry points to the index block. With fixed-size blocks there is no external fragmentation; with variable portions (start, length) the index is smaller and locality is better. It supports sequential and direct access (read the index, then block k: 2 reads, or 1 if the index is cached). It is the most widely used method.</p>

      <h3>Comparison</h3>
      <table>
        <tr><th></th><th>Contiguous</th><th>Chained</th><th>Indexed (blocks)</th><th>Indexed (portions)</th></tr>
        <tr><td>Preallocation</td><td>Necessary</td><td>Possible</td><td>Possible</td><td>Possible</td></tr>
        <tr><td>Fixed or variable portions</td><td>Variable</td><td>Fixed blocks</td><td>Fixed blocks</td><td>Variable</td></tr>
        <tr><td>Portion size</td><td>Large</td><td>Small</td><td>Small</td><td>Medium</td></tr>
        <tr><td>Allocation frequency</td><td>Once</td><td>Low to high</td><td>High</td><td>Low</td></tr>
        <tr><td>Time to allocate</td><td>Medium</td><td>Long</td><td>Short</td><td>Medium</td></tr>
        <tr><td>File allocation table size</td><td>One entry</td><td>One entry</td><td>Large</td><td>Medium</td></tr>
      </table>

      <h3>Free-space management</h3>
      <ul>
        <li><b>Bit table (bit map):</b> one bit per block, 0 = free, 1 = in use. Small, and runs of free blocks are easy to find. Size = number of blocks ÷ 8 bytes. A large table is slow to scan, so <b>summary tables</b> record, for each range of blocks, the number of free blocks and the longest free run, and the allocator scans only ranges that can satisfy the request.</li>
        <li><b>Chained free portions:</b> free portions are linked; each stores its length and a pointer to the next free portion. Almost no space overhead, but free space fragments over time, and allocating a block first requires reading it to recover the pointer it holds.</li>
        <li><b>Indexing:</b> free space is treated like a file with an index table; for efficiency, one entry per free (variable-size) portion.</li>
        <li><b>Free block list:</b> each free block's number is kept in a list on disk, 24 or 32 bits per entry (so the list is 24 or 32 times the size of a bit table). It is used as a stack or a FIFO queue, with only a small part held in memory.</li>
      </ul>
      <h4>Worked example</h4>
      <p>A 16-GB disk (2<sup>34</sup> bytes) with 512-byte blocks (2<sup>9</sup>) has 2<sup>25</sup> = 33,554,432 blocks. Its bit table is 2<sup>25</sup> bits = 2<sup>22</sup> bytes = <b>4 MB</b>, which itself fills 8,192 blocks (1/4096 of the disk). Block numbers need 25 bits, so a free block list would use 32-bit entries: 2<sup>25</sup> × 4 bytes = <b>128 MB</b> when the disk is empty.</p>

      <h3>Reliability</h3>
      <p>For speed, the OS keeps copies of the disk allocation table and file allocation data in memory. Two dangers follow. <b>Crash:</b> A is given blocks 20–21 in memory, a pointer to block 20 is written into A's file on disk, then the power fails before the on-disk table records 20–21 as used; after the restart the stale table gives 20–21 to B, and both files are corrupted. <b>Race:</b> two allocators both search the table, both see the same free blocks before either marks them, and both take them. The cure is to allocate in this order:</p>
      <ol>
        <li>Lock the disk allocation table on disk.</li>
        <li>Search it for free space (the memory copy is trustworthy while the lock is held).</li>
        <li>Allocate the space, update the disk allocation table and write it to disk (for chained allocation, also update the pointers on disk).</li>
        <li>Update the file allocation table and write it to disk.</li>
        <li>Unlock the disk allocation table.</li>
      </ol>
      <p>The lock stops interleaving. Writing the free-space record before the file's own records means a crash can at worst leave <b>lost blocks</b> (marked used, owned by no file), which a disk check can reclaim, but never a block owned by two files.</p>`,
  });
})();
