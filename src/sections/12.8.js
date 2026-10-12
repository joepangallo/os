/* =====================================================================
   12.8 UNIX File Management
   Original teaching material. Every number a student is told (capacities,
   block indexes, index-block counts, disk reads, volume sizes) comes out of
   the small helpers below. Helpers live in this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ---- sizes: binary units throughout (1 KB = 1,024 bytes, 1 MB = 1,024 KB, ...) ---- */
  const KB = 1024, MB = KB * KB, GB = MB * KB, TB = GB * KB;
  const UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const commas = (n) => Math.round(n).toLocaleString('en-US');
  // human-readable size: whole numbers stay whole ("48 KB"), others get up to `dig` decimals ("513.002 GB")
  function size(x, dig = 1) {
    let i = 0;
    while (x >= 1024 && i < UNITS.length - 1) { x /= 1024; i++; }
    if (i === 0) return commas(x) + (x === 1 ? ' byte' : ' bytes');
    const r = Number.isInteger(x) ? String(x) : String(+x.toFixed(dig));
    return r + ' ' + UNITS[i];
  }
  /* ---- the classic UNIX pointer tree: 12 direct, then single, double and triple indirect ---- */
  const NDIRECT = 12;
  // reach of every level for block size B (bytes) and pointer size p (bytes)
  function levels(B, p) {
    const P = B / p;
    const blocks = [NDIRECT, P, P * P, P * P * P];
    const names = ['Direct', 'Single indirect', 'Double indirect', 'Triple indirect'];
    let first = 0;
    const rows = blocks.map((n, k) => { const r = { k, name: names[k], blocks: n, bytes: n * B, firstBlock: first, reads: k }; first += n; return r; });
    return { P, B, p, rows, totalBlocks: first, totalBytes: first * B };
  }
  // where byte `off` of a file lives: logical block, level, the entry used in each index block, and the extra reads
  function locate(off, B, p) {
    const P = B / p;
    const L = Math.floor(off / B), within = off - L * B;
    let r = L;
    if (r < NDIRECT) return { L, within, level: 0, slot: r, idx: [] };
    r -= NDIRECT;
    if (r < P) return { L, within, level: 1, slot: NDIRECT, idx: [r] };
    r -= P;
    if (r < P * P) return { L, within, level: 2, slot: NDIRECT + 1, idx: [Math.floor(r / P), r % P] };
    r -= P * P;
    return { L, within, level: 3, slot: NDIRECT + 2, idx: [Math.floor(r / (P * P)), Math.floor(r / P) % P, r % P] };
  }
  // how many data blocks and indirect blocks a file of `bytes` bytes needs, level by level
  function shape(bytes, B, p) {
    const P = B / p;
    const n = Math.ceil(bytes / B);
    let r = n;
    const d = Math.min(r, NDIRECT); r -= d;
    const s = Math.min(r, P); r -= s;
    const dd = Math.min(r, P * P); r -= dd;
    const t = r;
    const ib1 = s > 0 ? 1 : 0;
    const ib2 = dd > 0 ? 1 + Math.ceil(dd / P) : 0;
    const ib3 = t > 0 ? 1 + Math.ceil(t / (P * P)) + Math.ceil(t / P) : 0;
    const deepest = t > 0 ? 3 : dd > 0 ? 2 : s > 0 ? 1 : 0;
    return { n, used: [d, s, dd, t], ib: [0, ib1, ib2, ib3], index: ib1 + ib2 + ib3, deepest };
  }
  // a log-scale slider position (0..1000) to a byte value in [lo, hi] and back
  const logPos = (v, lo, hi) => Math.round(1000 * Math.log(v / lo) / Math.log(hi / lo));
  const logVal = (pos, lo, hi) => lo * Math.pow(hi / lo, pos / 1000);
  // makes an SVG group behave like a button: focusable, Enter/Space activate it, a label for screen readers
  function hot(g, label, fn) {
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', label);
    g.style.cursor = 'pointer';
    g.addEventListener('click', fn);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
    return g;
  }
  // multi-line SVG text centred on (x, y)
  function lines(s, x, y, arr, attrs = {}, gap = 17) {
    const y0 = y - ((arr.length - 1) * gap) / 2;
    return arr.map((t, i) => s('text', Object.assign({ x, y: y0 + i * gap, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, attrs), t));
  }

  /* ---- the example volume used in the big picture: 64 GB, 4 KB blocks, one 256-byte inode per 16 KB ---- */
  const VOL = (function () {
    const bytes = 64 * GB, B = 4 * KB, perInode = 16 * KB, isz = 256;
    const blocks = bytes / B, inodes = bytes / perInode, tableBytes = inodes * isz, tableBlocks = tableBytes / B;
    return { bytes, B, perInode, isz, blocks, inodes, tableBytes, tableBlocks, dataBlocks: blocks - 2 - tableBlocks, pct: (100 * tableBytes) / bytes };
  })();


  Guide.section({
    id: '12.8',
    title: 'UNIX File Management',
    short: 'UNIX files',
    summary: 'Inodes, links and the pointer tree that lets one UNIX file grow from a single block to hundreds of gigabytes.',
    objectives: [
      'Name the six classic UNIX file types and say what each one is for.',
      'Describe the main fields of an inode and explain why the file\'s name is not one of them.',
      'Explain hard links, symbolic links and the link count, and predict what happens when a name is removed.',
      'Compute how far the direct, single, double and triple indirect pointers reach, and which blocks must be read to find any byte of a file.',
      'Trace a path lookup from the root inode and describe the layout of a UNIX volume.',
    ],
    terms: [
      ['Inode (index node)', 'The small fixed-size record a UNIX file system keeps for every file. It holds the file\'s type, permissions, owner, size, times, link count and the addresses of its data blocks, but not its name.'],
      ['Inode number (i-number)', 'The position of an inode in the inode table. A directory entry ties a file name to this number.'],
      ['Inode table', 'The array of inodes kept at known places on the volume, one slot for every file the file system can hold.'],
      ['In-memory inode table', 'The kernel\'s table of inode copies for files that are open or in use, with extra bookkeeping such as how many open references each one has.'],
      ['Regular file (ordinary file)', 'A file holding whatever bytes a program wrote into it: text, a photo, a program. The file system imposes no structure on its contents.'],
      ['Named pipe (FIFO)', 'A pipe that has a name in the directory tree, so unrelated processes can open it. Bytes written by one process come out, first in first out, for another; only the name and inode are on disk, never the bytes.'],
      ['Hard link', 'An extra directory entry for an existing file: another name holding the same inode number. Every name is equal; none of them is the "original".'],
      ['Symbolic link (soft link)', 'A small file whose contents are the path name of another file. Opening it makes the kernel follow that path.'],
      ['Link count', 'The inode field that counts the directory entries (hard links) naming the file. The inode and its blocks are freed only when the count reaches 0 and no process still has the file open.'],
      ['Dangling link', 'A symbolic link whose stored path no longer names an existing file, so following it fails.'],
      ['File mode', 'The inode field that encodes the file\'s type and its permission bits: read, write and execute for the owner, the group and everyone else, plus a few special bits.'],
      ['Direct pointer', 'One of the twelve block addresses in an inode that name a data block of the file directly.'],
      ['Indirect block (index block)', 'A disk block that holds nothing but block addresses. The indirect pointers in an inode lead to such blocks.'],
      ['Single indirect pointer', 'The inode entry that names one indirect block whose entries point straight at data blocks.'],
      ['Double indirect pointer', 'The inode entry that names an indirect block full of pointers to more indirect blocks, which point at data blocks: two levels of index.'],
      ['Triple indirect pointer', 'The inode entry that adds a third level of indirect blocks, so that very large files can still be mapped.'],
      ['Indexed allocation', 'A file allocation method that keeps, for each file, an index of the addresses of its blocks, so any block can be found without reading the blocks before it.'],
      ['Boot block', 'The area at the very start of a volume set aside for the code that starts (boots) the operating system.'],
      ['Superblock', 'The block that describes a whole file system: its size, block size, how many inodes it has and where they are, how much space is free, and its state.'],
      ['Path lookup (pathname resolution)', 'Turning a path such as /home/ann/notes.txt into an inode number by starting at the root (or working) directory and reading one directory at a time.'],
    ],
    css: `
      .sec-12-8 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-12-8 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-8 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-8 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-12-8 .mw0 > * { min-width: 0; }
      .sec-12-8 .ft-btn { display: grid; grid-template-columns: 54px minmax(0, 1fr); align-items: center; gap: 12px; width: 100%; text-align: left; padding: 8px 12px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--panel); color: var(--ink); font: inherit; cursor: pointer; }
      .sec-12-8 .ft-btn:hover { border-color: var(--accent); }
      .sec-12-8 .ft-btn.right { border: 2px solid var(--ok); background: var(--ok-bg); }
      .sec-12-8 .ft-btn.wrong { border: 2px solid var(--bad); background: var(--bad-bg); }
      .sec-12-8 .ft-let { font-family: var(--mono); font-weight: 800; font-size: 17px; text-align: center; border-radius: 8px; background: var(--panel-3); padding: 4px 0; white-space: nowrap; }
      .sec-12-8 .ft-name { font-weight: 800; font-size: 17px; line-height: 1.25; }
      .sec-12-8 .ft-desc { font-size: 14.5px; color: var(--ink-2); line-height: 1.35; }
      .sec-12-8 .fld { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 6px 10px; border: 1px solid var(--line-2); border-radius: 9px; background: var(--panel); color: var(--ink); text-align: left; font: inherit; cursor: pointer; min-width: 0; }
      .sec-12-8 .fld:hover { border-color: var(--accent); }
      .sec-12-8 .fld.on { border: 2px solid var(--accent); background: var(--accent-bg); padding: 5px 9px; }
      .sec-12-8 .fld .k { font-size: 12.5px; color: var(--muted); font-weight: 800; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
      .sec-12-8 .fld .v { font-family: var(--mono); font-weight: 700; font-size: 15px; white-space: nowrap; }
      .sec-12-8 .fld.miss { border-style: dashed; border-color: var(--bad); }
      .sec-12-8 .addr { display: grid; gap: 3px; width: 100%; }
      .sec-12-8 .addr > span { display: flex; flex-direction: column; align-items: center; border: 1px solid var(--line); border-radius: 6px; background: var(--panel-2); padding: 2px 0; min-width: 0; }
      .sec-12-8 .addr > span.used { background: var(--io-bg); border-color: var(--io); }
      .sec-12-8 .addr > span.ind { background: var(--os-bg); }
      .sec-12-8 .addr b { font-family: var(--mono); font-size: 13px; }
      .sec-12-8 .addr i { font-style: normal; font-size: 12.5px; color: var(--muted); font-weight: 700; }
      .sec-12-8 .bits { display: flex; gap: 10px; flex-wrap: wrap; }
      .sec-12-8 .bits .grp { display: flex; flex-direction: column; gap: 2px; align-items: center; }
      .sec-12-8 .bits .grp > span { font-size: 12.5px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .sec-12-8 .bits .grp > div { display: flex; gap: 3px; }
      .sec-12-8 .bits button { width: 30px; height: 32px; border-radius: 6px; border: 1px solid var(--line-2); background: var(--panel); font-family: var(--mono); font-weight: 800; font-size: 15px; color: var(--ink); cursor: pointer; padding: 0; display: inline-grid; place-items: center; }
      .sec-12-8 .bits button.one { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
      .sec-12-8 .cmds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      .sec-12-8 .cmds .btn { justify-content: flex-start; font-family: var(--mono); font-size: 13.5px; font-weight: 700; }
      .sec-12-8 .icard { border: 2px solid var(--accent); background: var(--accent-bg); border-radius: 10px; padding: 6px 10px; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .sec-12-8 .icard.sym { border-color: var(--proc); background: var(--proc-bg); }
      .sec-12-8 .icard.freed { border-style: dashed; border-color: var(--line-2); background: var(--panel-3); color: var(--muted); }
      .sec-12-8 .icard .lc { font-size: 26px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
      .sec-12-8 .icard .dt { font-family: var(--mono); font-size: 13.5px; overflow-wrap: anywhere; }
      .sec-12-8 .dirtab td { font-family: var(--mono); font-size: 14.5px; }
      .sec-12-8 .lsline { font-family: var(--mono); font-size: 14.5px; background: var(--panel-3); border-radius: 8px; padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
    `,
    steps: [
      /* ---------------- 1. Big picture: name, inode, blocks on one volume ---------------- */
      {
        title: 'A name, an inode and some blocks',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">In UNIX a file is really three things kept in three places: a <b>name</b> in a directory, an <span class="t" data-t="inode">inode</span> that describes the file, and <b>data blocks</b> that hold its bytes.</p>
              <p class="m0">The name is only a label. A directory pairs each name with an <span class="t">inode number</span>. Everything else the system knows about the file (type, owner, permissions, size, times, where its blocks are) lives in the inode. This split is what makes links, quick lookups and enormous files possible.</p>
              <div class="callout analogy m0" data-label="Analogy">A storage warehouse. The front-desk register lists names next to locker numbers (the directory). Each locker has a record card: owner, amount stored, which shelves hold the goods (the inode). The goods sit on whatever shelves were free (the data blocks). Two names may share one locker.</div>
              <h4 class="m0">In this section you will</h4>
              <div class="row gap-s">
                <span class="chip io">sort the six file types</span><span class="chip accent">open up an inode</span><span class="chip proc">make and break links</span><span class="chip os">find any byte of a huge file</span><span class="chip mem">follow a path from the root</span>
              </div>
            </div>
            <div class="card white stack bp-card" style="gap:6px">
              <div class="row" style="justify-content:space-between"><h4 class="m0">Inside one UNIX volume</h4><span class="xs muted">click any part</span></div>
              <div class="bp-svg"></div>
              <div class="narr bp-detail" style="min-height:118px"></div>
              <div class="row gap-s bp-facts" style="margin-top:auto"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { s } = ctx;
          const slim = ctx.narrow;
          const host = ctx.$('.bp-svg'), detail = ctx.$('.bp-detail');
          const W = slim ? 360 : 640, H = slim ? 470 : 306;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });
          host.append(svg);
          // the four regions of the volume, left to right, and the three objects that hold one file
          const R = slim
            ? [[8, 80, ['Boot', 'block']], [90, 82, ['Super-', 'block']], [174, 84, ['Inode', 'table']], [260, 92, ['Data', 'blocks']]]
            : [[8, 92, ['Boot block']], [102, 100, ['Superblock']], [204, 150, ['Inode table']], [356, 276, ['Data blocks']]];
          const regCls = ['s-panel', 's-os', 's-accent', 's-io'];
          const barY = 26, barH = 52;
          const box = slim
            ? { dir: [20, 120, 320, 96], ino: [20, 252, 320, 108], dat: [20, 392, 320, 66] }
            : { dir: [372, 108, 230, 92], ino: [40, 132, 250, 128], dat: [400, 234, 230, 66] };
          const info = {
            boot: ['Boot block', `Block 0 of the volume is set aside for <b>boot code</b>, the small program that starts the operating system. A volume that never boots anything still keeps the space. In the example volume it is one 4 KB block.`],
            super: ['Superblock', `The file system's own description: total size (<b>${commas(VOL.blocks)}</b> blocks of 4 KB = ${size(VOL.bytes)}), block size, number of inodes (<b>${commas(VOL.inodes)}</b>) and where they are, free block and free inode counts, and whether it was shut down cleanly. Without it nothing else can be found, so real systems keep backup copies across the disk.`],
            table: ['Inode table', `One fixed-size inode (${VOL.isz} bytes here) for every file the volume can ever hold. The count is fixed when the file system is created: one inode per ${size(VOL.perInode)} of space gives <b>${commas(VOL.inodes)}</b> inodes, a table of ${size(VOL.tableBytes)} (${ctx.util.fmt(VOL.pct, 1)}% of the volume). Use them all up with tiny files and the disk is "full" even with free blocks left.`],
            data: ['Data blocks', `Everything else: <b>${commas(VOL.dataBlocks)}</b> blocks that hold file contents, directory contents and indirect blocks. Free blocks are tracked by a free-space structure (section 12.7).`],
            dir: ['Directory entry', `A <span class="t">directory</span> is itself a file. Its contents are (name, inode number) pairs. This entry says: in /home/ann, the name <b>notes.txt</b> means inode <b>7731</b>. Every directory also lists <code>.</code> (itself) and <code>..</code> (its parent).`],
            ino: ['Inode 7731', `Everything about the file <b>except its name</b>: type and permissions, owner, size, link count, three times, and the addresses of its data blocks. It sits in the inode table at a spot computed from its number, so no search is needed.`],
            dat: ['Data block 20480', `The file's actual bytes. For a <span class="t" data-t="regular file">regular file</span> the file system imposes no structure: to UNIX it is just a numbered sequence of bytes, and the program decides what they mean.`],
          };
          const groups = {};
          let cur = null;
          function show(k) {
            cur = k;
            Object.entries(groups).forEach(([key, g]) => g.setAttribute('stroke-width', key === k ? 4 : 2));
            const term = { boot: 'boot block', super: 'superblock', table: 'inode table' }[k];
            detail.innerHTML = `<b>${term ? `<span class="t" data-t="${term}">${info[k][0]}</span>` : info[k][0]}.</b> ${info[k][1]}`;
          }
          function draw() {
            svg.replaceChildren();
            svg.append(s('text', { x: 8, y: 16, class: 's-sub', 'font-size': 13 }, 'One volume, classic layout (not to scale)'));
            ['boot', 'super', 'table', 'data'].forEach((k, i) => {
              const [x, w, lab] = R[i];
              const g = s('g', { class: regCls[i], 'stroke-width': 2 },
                s('rect', { x, y: barY, width: w, height: barH, rx: 6 }),
                ...lines(s, x + w / 2, barY + barH / 2, lab, { 'font-size': slim ? 14 : 15, 'font-weight': 700, stroke: 'none' }));
              groups[k] = hot(g, info[k][0], () => show(k));
              svg.append(g);
            });
            const conn = (from, tx) => s('path', { d: `M${from[0]} ${from[1]} L${tx} ${barY + barH + 2}`, class: 's-muted', 'stroke-dasharray': '3 4' });
            if (!slim) {
              svg.append(conn([box.dir[0] + 40, box.dir[1]], 412), conn([box.ino[0] + 125, box.ino[1]], 279), conn([box.dat[0] + 218, box.dat[1]], 618));
            }
            const mk = (k, cls, title, rows) => {
              const [x, y, w, hh] = box[k];
              const g = s('g', { class: cls, 'stroke-width': 2 },
                s('rect', { x, y, width: w, height: hh, rx: 10 }),
                s('text', { x: x + 10, y: y + 21, 'font-size': 15, 'font-weight': 800, stroke: 'none' }, title),
                ...rows.map((r, i) => s('text', { x: x + 10, y: y + 43 + i * 20, 'font-size': slim ? 14 : 15, stroke: 'none', class: r[1] ? 's-monot' : null, 'font-weight': r[2] ? 800 : 400, style: 'white-space:pre' }, r[0])));
              groups[k] = hot(g, info[k][0], () => show(k));
              svg.append(g);
            };
            mk('dir', 's-io', 'Directory /home/ann', [['.          → 412', true], ['..         → 37', true], ['notes.txt  → 7731', true, true]]);
            mk('ino', 's-accent', 'Inode 7731', [['regular file, rw-r--r--'], ['owner ann, 3,412 bytes'], ['link count 1'], ['block list: 20480, -, -, …']]);
            mk('dat', 's-io', 'Data block 20480', [['"Buy milk. Call Bo…"', true]]);
            // arrows: name → inode, inode → data block
            const a1 = slim ? `M180 ${box.dir[1] + box.dir[3]} L180 ${box.ino[1] - 4}` : `M${box.dir[0]} ${box.dir[1] + 76} L${box.ino[0] + box.ino[2] + 4} ${box.ino[1] + 52}`;
            const a2 = slim ? `M180 ${box.ino[1] + box.ino[3]} L180 ${box.dat[1] - 4}` : `M${box.ino[0] + box.ino[2]} ${box.ino[1] + 112} L${box.dat[0] - 4} ${box.dat[1] + 36}`;
            svg.append(s('path', { d: a1, class: 's-line', 'marker-end': 'url(#arr)' }), s('path', { d: a2, class: 's-line', 'marker-end': 'url(#arr)' }));
            const lab = (x, y, t) => s('text', { x, y, 'font-size': 13, class: 's-sub', 'text-anchor': 'middle' }, t);
            if (slim) svg.append(lab(250, box.dir[1] + box.dir[3] + 20, 'inode number'), lab(255, box.ino[1] + box.ino[3] + 20, 'block address'));
            else svg.append(lab(331, 168, 'inode no.'), lab(345, 296, 'block address'));
          }
          ctx.$('.bp-facts').innerHTML = `<span class="xs muted b">EXAMPLE VOLUME</span><span class="chip">${size(VOL.bytes)}</span><span class="chip">4 KB blocks</span><span class="chip accent">${commas(VOL.inodes)} inodes</span><span class="chip accent">inode table ${size(VOL.tableBytes)} (${ctx.util.fmt(VOL.pct, 1)}%)</span><span class="chip io">${commas(VOL.dataBlocks)} data blocks</span>`;
          draw();
          show('ino');
        },
      },

      /* ---------------- 2. The six file types: sort real ls -l lines ---------------- */
      {
        title: 'Six kinds of file in one directory tree',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack ft-list" style="gap:6px">
              <h4 class="m0">The six classic UNIX file types (click one to answer)</h4>
            </div>
            <div class="stack" style="gap:10px">
              <p class="lead m0">UNIX gives disks, terminals and pipes a name in the same tree as your files. The first character of an <code>ls -l</code> line tells you which kind a name is.</p>
              <div class="callout why m0" data-label="Why it matters">Devices and pipes are files too, so one set of calls (open, read, write, close) works on all of them, unchanged.</div>
              <div class="card white stack ft-q" style="gap:8px;flex:none"></div>
              <div class="narr ft-fb" style="min-height:104px"></div>
              <div class="row ft-ctl"></div>
              <p class="small muted m0">Later UNIX systems (from 4.2BSD, 1983) add a seventh kind: the <b>socket</b> (<code>s</code>), a named two-way endpoint between processes on one machine.</p>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const TYPES = [
            ['-', 'Regular file', 'Any bytes at all: text, photos, programs. UNIX imposes no structure.', 'regular file'],
            ['d', 'Directory', 'A list of (name, inode number) pairs. Only the file system writes it.', null],
            ['c b', 'Special file', 'Stands for an I/O device; reading or writing it drives the device.', 'special file'],
            ['p', 'Named pipe', 'A FIFO with a name: one process writes, another reads, in order.', 'named pipe'],
            ['same', 'Link (hard link)', 'One more name for an existing inode. Shown with the file\'s own letter.', 'hard link'],
            ['l', 'Symbolic link', 'A tiny file whose contents are another file\'s path name.', 'symbolic link'],
          ];
          const ITEMS = [
            ['Ann copies a photo from her phone.', '-rw-r--r--  1 ann  users  2187264  holiday.jpg', 0, 'The leading <code>-</code> marks a <b><span class="t" data-t="regular file">regular file</span></b>. The 2,187,264 bytes are JPEG data, but the file system neither knows nor cares: only the photo viewer gives them meaning.'],
            ['Ann lists her home directory.', 'drwxr-x---  4 ann  users     4096  projects', 1, 'The <code>d</code> marks a <b>directory</b>. Its 4,096 bytes are (name, inode number) entries. Its link count is 4: its name in /home/ann, its own <code>.</code> entry, and the <code>..</code> entries of two subdirectories.'],
            ['On a Linux machine:', 'crw-rw-rw-  1 root root     1, 3  /dev/null', 2, 'The <code>c</code> marks a character <b><span class="t" data-t="special file">special file</span></b>. Where a size would be, <code style="white-space:nowrap">1, 3</code> are the major and minor device numbers that select the driver and the device (section 11.8). Writing here goes to a driver that throws the bytes away.'],
            ['Ann runs <code>ln -s notes.txt todo</code>.', 'lrwxrwxrwx  1 ann  users        9  todo -> notes.txt', 5, 'The <code>l</code> marks a <b><span class="t" data-t="symbolic link">symbolic link</span></b>. Its size is 9 because its whole content is the 9-character path <code>notes.txt</code>. Opening <code>todo</code> makes the kernel look that path up.'],
            ['A print service creates a rendezvous point.', 'prw-r--r--  1 ann  users        0  /tmp/jobs', 3, 'The <code>p</code> marks a <b><span class="t" data-t="named pipe">named pipe</span></b>. Its size is always 0: bytes pass through a buffer in the kernel from the writer to the reader and are never stored on disk.'],
            ['Ann runs <code>ln notes.txt backup.txt</code>, then <code>ls -li</code> (the first column is the inode number).', '7731 -rw-r--r--  2 ann users 3412  backup.txt\n7731 -rw-r--r--  2 ann users 3412  notes.txt', 4, '<b>backup.txt is a <span class="t" data-t="hard link">hard link</span></b>: a second directory entry holding the same inode number, 7731. It shows <code>-</code> because the file it names is regular, and the link count is now 2. Neither name is the "real" one.'],
            ['On a Linux machine:', 'brw-rw----  1 root disk     8, 0  /dev/sda', 2, 'The <code>b</code> marks a block <b>special file</b>: the first whole disk. Reads and writes go through the block driver in fixed-size blocks. Every I/O device gets such a file, usually under <code>/dev</code>.'],
            ['The command that lists directories:', '-rwxr-xr-x  1 root wheel  151200  /bin/ls', 0, 'A program is a <b>regular file</b> too. The <code>x</code> permission bits make it executable; they do not change its type. The loader, not the file system, understands its format.'],
          ];
          let idx = 0, done = false, score = 0, tries = 0;
          const list = ctx.$('.ft-list'), qBox = ctx.$('.ft-q'), fb = ctx.$('.ft-fb'), ctl = ctx.$('.ft-ctl');
          const btns = TYPES.map((t, i) => h('button', { class: 'ft-btn', type: 'button', onclick: () => answer(i) },
            h('span', { class: 'ft-let' }, t[0]),
            h('span', {}, h('div', { class: 'ft-name' }, t[1]), h('div', { class: 'ft-desc' }, t[2]))));
          list.append(...btns);
          const scoreChip = h('span', { class: 'chip accent' });
          const next = h('button', { class: 'btn primary', type: 'button', onclick: () => { if (idx < ITEMS.length - 1) { idx++; load(); } else restart(); } });
          const again = h('button', { class: 'btn ghost', type: 'button', onclick: () => restart() }, 'Start over');
          ctl.append(scoreChip, next, again);
          function restart() { idx = 0; score = 0; tries = 0; load(); }
          function load() {
            done = false;
            btns.forEach((b) => { b.classList.remove('right', 'wrong'); });
            const [ctxText, line] = ITEMS[idx];
            qBox.innerHTML = `<div class="row" style="justify-content:space-between"><h4 class="m0">Item ${idx + 1} of ${ITEMS.length}: what kind of file is it?</h4></div><div class="small m0">${ctxText}</div><div class="lsline">${ctx.util.esc(line)}</div>`;
            fb.className = 'narr ft-fb';
            fb.innerHTML = 'Read the line, then click the matching type on the left.';
            next.textContent = 'Next item';
            next.disabled = true;
            paint();
          }
          function paint() { scoreChip.textContent = `${score} right of ${tries} tried`; }
          function answer(i) {
            if (done) return;
            const it = ITEMS[idx];
            done = true; tries++;
            const ok = i === it[2];
            if (ok) score++;
            btns[it[2]].classList.add('right');
            if (!ok) btns[i].classList.add('wrong');
            fb.className = 'narr ft-fb ' + (ok ? 'ok' : 'bad');
            // a hard link names a regular file, so "not a regular file" would be false there: say what is half right instead
            const miss = it[2] === 4 && i === 0
              ? '✗ Half right: the inode behind both names is a regular file (hence the <code>-</code>), but the question is what <code>ln</code> just made. '
              : `✗ Not a ${TYPES[i][3] || 'directory'}. `;
            fb.innerHTML = (ok ? '✓ Right. ' : miss) + it[3];
            next.disabled = false;
            next.textContent = idx < ITEMS.length - 1 ? 'Next item' : `Done: ${score} of ${ITEMS.length}. Play again`;
            paint();
          }
          load();
        },
      },

      /* ---------------- 3. Inode explorer ---------------- */
      {
        title: 'Open up an inode',
        kind: 'explore',
        html: `
          <div class="split r fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0">Click any field of this <span class="t">inode</span> to see what it records, and why.</p>
              <div class="card white stack in-card" style="gap:8px;flex:none"></div>
              <div class="callout tip m0 small" data-label="On disk and in memory">On open, the kernel copies the inode into the <span class="t">in-memory inode table</span>, adds bookkeeping (such as a count of open references) and writes changes back to disk later.</div>
            </div>
            <div class="stack" style="gap:8px">
              <div class="narr in-detail stack" style="gap:8px"></div>
              <div class="card tight" style="margin-top:auto">
                <h4>Where each piece of a file lives</h4>
                <table class="tbl compact"><tr><td><b>Its name</b></td><td>a directory entry (name, inode number)</td></tr><tr><td><b>Facts about it</b></td><td>its inode, in the inode table</td></tr><tr><td><b>Its bytes</b></td><td>data blocks, found through the inode</td></tr></table>
              </div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const slim = ctx.narrow;
          const card = ctx.$('.in-card'), detail = ctx.$('.in-detail');
          let mode = 0o644; // the 12 low bits: set-user-ID, set-group-ID, sticky, then rwx for owner, group, others
          const modeStr = () => {
            const b = (n) => (mode >> n) & 1;
            const x = (n, sp, ch) => (b(sp) ? (b(n) ? ch : ch.toUpperCase()) : (b(n) ? 'x' : '-'));
            return '-' + (b(8) ? 'r' : '-') + (b(7) ? 'w' : '-') + x(6, 11, 's') + (b(5) ? 'r' : '-') + (b(4) ? 'w' : '-') + x(3, 10, 's') + (b(2) ? 'r' : '-') + (b(1) ? 'w' : '-') + x(0, 9, 't');
          };
          const modeOct = () => '010' + mode.toString(8).padStart(4, '0');
          const F = [
            ['mode', 'File mode', () => modeStr(), () => `<b>The <span class="t" data-t="file mode">file mode</span>: type and permissions in one 16-bit field.</b> 4 bits give the type (here 1000 = regular file; other values mean directory, special file, pipe, symbolic link or socket). The other 12 bits are set-user-ID, set-group-ID, sticky, then read, write, execute for the owner, the group and everyone else. Click a bit to flip it.`],
            ['links', 'Link count', () => '1', () => `<b>How many directory entries name this inode.</b> <code>ln</code> adds one, <code>rm</code> removes one. When it reaches 0 and no process still has the file open, the inode and its blocks are freed. The next step lets you try it.`],
            ['uid', 'Owner ID', () => '1001 (ann)', () => `<b>The owner's numeric user ID.</b> Only the number 1001 is stored; the name "ann" comes from the system's user database when <code>ls</code> prints it.`],
            ['gid', 'Group ID', () => '100 (users)', () => `<b>The file's numeric group.</b> Members of group 100 (other than the owner, who always gets the owner bits) get the middle three permission bits of the mode.`],
            ['size', 'Size', () => '3,412 bytes', () => `<b>The file's length in bytes</b>, that is, the offset just past its last byte. It is not the space used: the last block is partly empty, and a file with holes (never-written gaps) can be larger than the space it holds.`],
            ['blocks', 'Block count', () => '1 block', () => `<b>How much disk space is really allocated</b>, indirect blocks included. 3,412 bytes fit in one 4 KB block. Many systems count this field in 512-byte units, so <code>stat</code> would report 8 for the same block.`],
            ['atime', 'Last access', () => '10-09 08:14', () => `<b>atime: when the data was last read.</b> Updating it on every read would cost a disk write per read, so systems cut corners: Linux by default updates it only when it is older than mtime or a day old, and a noatime mount turns it off.`],
            ['mtime', 'Last modified', () => '10-07 21:40', () => `<b>mtime: when the data was last changed</b> (written, appended or truncated). Backup and build tools compare it to decide what is out of date.`],
            ['ctime', 'Inode changed', () => '10-07 21:40', () => `<b>ctime: when the inode itself last changed</b>: any write, but also chmod, chown or a new link. <span class="b" style="color:var(--warn)">Common mistake:</span> the c means <i>change</i>, not creation. Classic UNIX kept no creation time; FreeBSD's UFS2 and Linux's ext4 later added a separate birth time.`],
            ['flags', 'Flags', () => 'none', () => `<b>Extra on/off switches</b> some systems add, such as immutable (nobody may change or delete the file, not even its owner) or append-only (writes may only add to the end).`],
            ['gen', 'Generation no.', () => '0x2c41f9a3', () => `<b>A number that changes each time this inode slot is reused</b> for a new file. A network file server puts it in the file handles it hands out, so an old handle to a deleted file can never reach the new file that took over the slot.`],
            ['ext', 'Ext. attr. size', () => '0 bytes', () => `<b>Bytes of extended attributes</b>: extra name = value metadata, such as security labels or access-control lists. FreeBSD's UFS2 keeps them in up to two extra blocks named by the inode. This file has none.`],
          ];
          const ADDR = ['20480', ...Array(14).fill('0')];
          const addrInfo = `<b>Fifteen block addresses</b>, the heart of the inode: 12 <span class="t" data-t="direct pointer">direct pointers</span>, then the single, double and triple indirect pointers. This small file uses only d0 = block 20480; 0 means "no block". Steps 5 and 6 show how the last three reach files of hundreds of gigabytes.`;
          const nameInfo = `<b>Not here!</b> The file's name lives only in directory entries. That is why one file can have several names (hard links), and why renaming or moving a file within one file system rewrites directory entries but never copies the file's data. The inode does not even store its own number: the number is its position in the table.`;
          let sel = 'mode';
          const btns = {};
          function fieldBtn(key, label, val, extra = '') {
            const b = h('button', { class: 'fld' + extra, type: 'button', onclick: () => select(key) }, h('span', { class: 'k' }, label), h('span', { class: 'v' }, val));
            btns[key] = b;
            return b;
          }
          function build() {
            card.replaceChildren();
            card.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Inode 7731: /home/ann/notes.txt'), h('span', { class: 'chip accent' }, 'regular file')));
            const grid = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${slim ? 2 : 4}, minmax(0, 1fr))`, gap: '6px' } });
            F.forEach(([k, lab, val]) => grid.append(fieldBtn(k, lab, val())));
            card.append(grid);
            const cells = h('div', { class: 'addr', style: { gridTemplateColumns: slim ? 'repeat(5, minmax(0, 1fr))' : '1.6fr repeat(14, minmax(0, 1fr))' } });
            ADDR.forEach((v, i) => cells.append(h('span', { class: (i === 0 ? 'used' : '') + (i >= 12 ? ' ind' : '') }, h('i', {}, i < 12 ? 'd' + i : ['S', 'D', 'T'][i - 12]), h('b', {}, v))));
            const ab = h('button', { class: 'fld', type: 'button', style: { width: '100%' }, onclick: () => select('addr') }, h('span', { class: 'k', style: { whiteSpace: 'normal' } }, 'Block addresses: d0 to d11 direct, S/D/T single, double, triple indirect'), cells);
            btns.addr = ab;
            card.append(ab, fieldBtn('name', 'File name?', 'not stored in the inode', ' miss'));
            Object.entries(btns).forEach(([k, b]) => b.classList.toggle('on', k === sel));
          }
          function bitsRow() {
            const row = h('div', { class: 'bits', 'aria-label': 'Mode bits' });
            const names = ['set-user-ID', 'set-group-ID', 'sticky', 'owner read', 'owner write', 'owner execute', 'group read', 'group write', 'group execute', 'others read', 'others write', 'others execute'];
            ['special', 'owner', 'group', 'others'].forEach((g, gi) => {
              const cells = h('div');
              for (let j = 0; j < 3; j++) {
                const n = 11 - (gi * 3 + j), on = (mode >> n) & 1;
                cells.append(h('button', { type: 'button', class: on ? 'one' : '', title: names[11 - n], 'aria-label': names[11 - n] + (on ? ' on' : ' off'), onclick: () => { mode ^= 1 << n; build(); select('mode'); } }, on ? '1' : '0'));
              }
              row.append(h('div', { class: 'grp' }, h('span', {}, g), cells));
            });
            return row;
          }
          function select(k) {
            sel = k;
            Object.entries(btns).forEach(([key, b]) => b.classList.toggle('on', key === k));
            detail.replaceChildren();
            detail.className = 'narr in-detail stack' + (k === 'name' ? ' bad' : '');
            if (k === 'addr') { detail.innerHTML = addrInfo; return; }
            if (k === 'name') { detail.innerHTML = nameInfo; return; }
            const f = F.find((x) => x[0] === k);
            detail.append(h('div', { html: `<span class="chip accent">${f[1]}</span> <span class="mono b">${f[2]()}</span>` }), h('div', { html: f[3]() }));
            if (k === 'mode') {
              detail.append(bitsRow(),
                h('div', { html: `As <code>ls</code> shows it: <b class="mono">${modeStr()}</b> · in octal: <b class="mono">${modeOct()}</b>` }),
                h('div', { class: 'small', html: `<b>Who may do what.</b> On open, the kernel compares the process's user and group IDs with the owner and group here and applies the matching three bits. A set-user-ID program runs with its owner's rights (<code>passwd</code>); a sticky directory such as <code>/tmp</code> stops users deleting each other's files.` }));
            }
          }
          build();
          select('mode');
        },
      },

      /* ---------------- 4. Links lab: hard links, symbolic links, link count ---------------- */
      {
        title: 'Hard links, symbolic links and the link count',
        kind: 'lab',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0">Run commands in Ann's directory and watch the directory entries, the inodes and their <span class="t">link count</span> change. Try making both kinds of link, then removing <code>notes.txt</code>.</p>
              <div class="cmds lk-cmds"></div>
              <div class="narr lk-narr" style="min-height:118px"></div>
              <div class="callout warn m0 small" data-label="Common mistake">A <span class="t">hard link</span> is not a shortcut: it <i>is</i> the file, under another name. The <span class="t">symbolic link</span> is the shortcut, and it breaks when its target name goes away.</div>
            </div>
            <div class="stack" style="gap:8px">
              <div class="card tight lk-dir"></div>
              <div class="lk-inodes" style="display:grid;gap:8px"></div>
              <div class="log lk-log grow" aria-live="polite"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const esc = ctx.util.esc;
          const cmdsEl = ctx.$('.lk-cmds'), narr = ctx.$('.lk-narr'), dirEl = ctx.$('.lk-dir'), inEl = ctx.$('.lk-inodes'), logEl = ctx.$('.lk-log');
          let st;
          function reset() {
            st = { dir: [{ name: 'notes.txt', ino: 7731 }], inodes: { 7731: { type: 'regular', links: 1, data: 'Buy milk.\n' } }, next: 7790, freed: [], log: [{ cmd: 'cat notes.txt', lines: ['Buy milk.'] }] };
            say('Start: one name, <b>notes.txt</b>, for inode 7731, whose link count is 1. Pick a command.', '');
            draw();
          }
          const find = (name) => st.dir.find((e) => e.name === name);
          function say(html, cls) { narr.className = 'narr lk-narr ' + (cls || ''); narr.innerHTML = html; }
          function out(cmd, lines) { st.log.push({ cmd, lines }); }
          function newInode(type, data) { const ino = st.next++; st.inodes[ino] = { type, links: 1, data }; return ino; }
          function unlink(name) {
            const e = find(name);
            st.dir = st.dir.filter((x) => x !== e);
            const ino = st.inodes[e.ino];
            ino.links--;
            if (ino.links === 0) { st.freed.push(e.ino); delete st.inodes[e.ino]; return { ino: e.ino, freed: true }; }
            return { ino: e.ino, freed: false, left: ino.links };
          }
          // follow a name to the inode number it leads to (through one symbolic link if needed)
          function resolve(name) {
            const e = find(name);
            if (!e) return { err: 'missing' };
            const ino = st.inodes[e.ino];
            if (ino.type !== 'symlink') return { ino: e.ino };
            const t = find(ino.data);
            return t ? { ino: t.ino, via: e.ino } : { err: 'dangling', via: e.ino };
          }
          const CMDS = [
            ['ln notes.txt backup.txt', () => {
              const c = 'ln notes.txt backup.txt';
              if (!find('notes.txt')) { out(c, ['ln: notes.txt: No such file or directory']); return say('There is no entry named notes.txt any more, so there is nothing to link to.', 'bad'); }
              if (find('backup.txt')) { out(c, ['ln: backup.txt: File exists']); return say('The name backup.txt is already taken in this directory; a directory cannot hold one name twice.', 'warn'); }
              const ino = find('notes.txt').ino;
              st.dir.push({ name: 'backup.txt', ino });
              st.inodes[ino].links++;
              out(c, []);
              say(`<b>Hard link made.</b> A second directory entry, backup.txt, now holds the same inode number, ${ino}. No data was copied. The link count of ${ino} rose to <b>${st.inodes[ino].links}</b>, and neither name is the "original".`, 'ok');
            }],
            ['ln -s notes.txt todo', () => {
              const c = 'ln -s notes.txt todo';
              if (find('todo')) { out(c, ['ln: todo: File exists']); return say('The name todo is already taken.', 'warn'); }
              const ino = newInode('symlink', 'notes.txt');
              st.dir.push({ name: 'todo', ino });
              out(c, []);
              const tgt = find('notes.txt');
              say(`<b>Symbolic link made.</b> A brand-new inode, ${ino}, of type symbolic link, whose only content is the text <code>notes.txt</code>. ${tgt ? `The link count of ${tgt.ino} did not change: a symbolic link stores a path, not an inode number.` : 'UNIX does not check that the target exists: this link is dangling from birth.'}`, 'ok');
            }],
            ['echo eggs >> backup.txt', () => {
              const c = 'echo eggs >> backup.txt';
              const e = find('backup.txt');
              out(c, []);
              if (!e) { const ino = newInode('regular', 'eggs\n'); st.dir.push({ name: 'backup.txt', ino }); return say(`No entry named backup.txt existed, so the shell created a new file: inode ${ino}, link count 1.`, ''); }
              st.inodes[e.ino].data += 'eggs\n';
              const names = st.dir.filter((x) => x.ino === e.ino).map((x) => x.name);
              say(`The write went through the name backup.txt to inode <b>${e.ino}</b>. ${names.length > 1 ? `So it shows up through every name of that inode: ${names.join(' and ')}.` : 'Only one name leads to that inode now.'}`, '');
            }],
            ['echo gym > notes.txt', () => {
              const c = 'echo gym > notes.txt';
              const e = find('notes.txt');
              out(c, []);
              if (e) { st.inodes[e.ino].data = 'gym\n'; return say(`notes.txt exists, so its inode ${e.ino} was emptied and rewritten. Every hard link to ${e.ino} sees the new text.`, ''); }
              const ino = newInode('regular', 'gym\n');
              st.dir.push({ name: 'notes.txt', ino });
              say(`No entry named notes.txt existed, so the shell created a <b>new</b> file: inode ${ino}, link count 1. A symbolic link to notes.txt will now find this new file, while any old hard link still holds the old one.`, 'warn');
            }],
            ['rm notes.txt', () => rmCmd('notes.txt')],
            ['rm backup.txt', () => rmCmd('backup.txt')],
            ['cat notes.txt', () => catCmd('notes.txt')],
            ['cat backup.txt', () => catCmd('backup.txt')],
            ['cat todo', () => catCmd('todo')],
            ['rm todo', () => rmCmd('todo')],
          ];
          function rmCmd(name) {
            const c = 'rm ' + name;
            const e = find(name);
            if (!e) { out(c, [`rm: ${name}: No such file or directory`]); return say(`There is no entry named ${name} to remove.`, 'bad'); }
            const sym = st.inodes[e.ino].type === 'symlink';
            const r = unlink(name);
            out(c, []);
            if (sym) return say(`Removing a symbolic link removes only the link itself (inode ${r.ino} is freed). The file it pointed to is untouched.`, '');
            if (r.freed) return say(`<b>That was the last name.</b> The link count of ${r.ino} fell to 0, and no process had the file open, so the file system freed inode ${r.ino} and its data blocks.`, 'bad');
            say(`<code>rm</code> (the <code>unlink</code> call) removed only the <b>name</b> ${name} and lowered the link count of ${r.ino} to <b>${r.left}</b>. The inode and its blocks stay, because another name still leads to them.`, 'ok');
          }
          function catCmd(name) {
            const c = 'cat ' + name;
            const r = resolve(name);
            if (r.err === 'missing') { out(c, [`cat: ${name}: No such file or directory`]); return say(`No directory entry is called ${name}.`, 'bad'); }
            if (r.err === 'dangling') { out(c, [`cat: ${name}: No such file or directory`]); return say(`The link <b>${name}</b> still exists, but the path inside it, notes.txt, names nothing now. It is a <span class="t">dangling link</span>.`, 'bad'); }
            const data = st.inodes[r.ino].data;
            out(c, data.replace(/\n$/, '').split('\n'));
            if (r.via) say(`The kernel read the symbolic link (inode ${r.via}), found the path <code>notes.txt</code>, looked that name up again and opened whatever it names <i>now</i>: inode <b>${r.ino}</b>.`, 'ok');
            else say(`${name} → inode <b>${r.ino}</b> → its data blocks. Any name of inode ${r.ino} shows the same bytes.`, '');
          }
          if (ctx.narrow) cmdsEl.style.gridTemplateColumns = 'minmax(0, 1fr)';
          cmdsEl.append(...CMDS.map(([label, fn]) => h('button', { class: 'btn sm', type: 'button', onclick: () => { fn(); draw(); } }, label)));
          cmdsEl.append(h('button', { class: 'btn sm ghost', type: 'button', style: { gridColumn: '1 / -1', justifyContent: 'center', fontFamily: 'inherit' }, onclick: reset }, '↺ Reset the directory'));
          function draw() {
            dirEl.innerHTML = `<h4>Directory /home/ann: (name, inode number) entries</h4>` + (st.dir.length
              ? `<table class="tbl compact dirtab">${st.dir.map((e) => `<tr><td>${esc(e.name)}</td><td>→ ${e.ino}${st.inodes[e.ino].type === 'symlink' ? ' <span class="chip proc">symbolic link</span>' : ''}</td></tr>`).join('')}</table>`
              : '<p class="small muted m0">(no entries left besides . and ..)</p>');
            const nums = Object.keys(st.inodes).map(Number);
            const shown = [...nums.map((n) => ({ n, ino: st.inodes[n] })), ...(nums.length < 4 ? st.freed.slice(-1) : []).map((n) => ({ n, ino: null }))];
            inEl.style.gridTemplateColumns = `repeat(${ctx.narrow ? Math.min(2, shown.length) : Math.max(1, Math.min(4, shown.length))}, minmax(0, 1fr))`;
            inEl.replaceChildren(...shown.map(({ n, ino }) => ino
              ? h('div', { class: 'icard' + (ino.type === 'symlink' ? ' sym' : '') },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'inode ' + n), h('span', { class: 'xs b' }, ino.type === 'symlink' ? 'symbolic link' : 'regular file')),
                h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'lc' }, String(ino.links)), h('span', { class: 'xs muted b' }, 'LINK COUNT')),
                h('div', { class: 'dt' }, (ino.type === 'symlink' ? 'path: ' + ino.data : 'data: ' + ino.data.replace(/\n$/, '').replace(/\n/g, ' ↵ '))))
              : h('div', { class: 'icard freed' }, h('b', {}, 'inode ' + n), h('span', { class: 'small' }, 'freed: link count 0, slot and blocks back on the free lists'))));
            logEl.replaceChildren(...st.log.slice(-12).map((l) => h('div', { html: `<b>ann$ ${esc(l.cmd)}</b>${l.lines.map((x) => '<br>' + esc(x)).join('')}` })));
            logEl.scrollTop = logEl.scrollHeight;
          }
          reset();
        },
      },

      /* ---------------- 5. Grow a file: direct, then single, double, triple indirect ---------------- */
      {
        title: 'Fifteen addresses, files of any size',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0">UNIX hands out space one block at a time as a file grows, wherever free blocks are, so a file's blocks need not be contiguous. It finds them by <span class="t">indexed allocation</span>, with the index in the inode. The inode has room for only 15 addresses: 12 direct, then the <span class="t" data-t="single indirect pointer">single</span>, <span class="t" data-t="double indirect pointer">double</span> and <span class="t" data-t="triple indirect pointer">triple indirect</span> pointers, which lead to <span class="t" data-t="indirect block">indirect blocks</span> full of more addresses. <span class="muted">(Here: 4 KB blocks, 8-byte addresses, 512 per block.)</span></p>
              <div class="gr-ctl stack" style="gap:6px"></div>
              <table class="tbl compact gr-tab"></table>
              <div class="callout why m0 small gr-why" data-label="Why this design works"></div>
            </div>
            <div class="card white stack" style="gap:6px">
              <div class="row" style="justify-content:space-between"><h4 class="m0">The inode's pointer tree for this file</h4><span class="xs muted">orange = data · violet = index blocks</span></div>
              <div class="gr-svg grow" style="display:grid;place-items:center"></div>
              <p class="xs muted m0">Older System V UNIX inodes held 13 addresses (10 direct + 3 indirect), packed into 39 bytes at 3 bytes each.</p>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const B = 4 * KB, p = 8, LV = levels(B, p), P = LV.P, MAX = LV.totalBytes;
          let bytes = 3412;
          const W = slim ? 360 : 700, H = slim ? 400 : 440;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });
          ctx.$('.gr-svg').append(svg);
          const tab = ctx.$('.gr-tab'), why = ctx.$('.gr-why');
          const sl = ctx.ui.slider({ label: 'File size', min: 0, max: 1000, step: 1, value: logPos(bytes, 1, MAX), format: () => size(bytes, 2), onInput: (v) => { bytes = Math.max(1, Math.round(logVal(v, 1, MAX))); draw(); } });
          sl.input.setAttribute('data-keys', '');
          const PRE = [['2 KB note', 2 * KB], ['48 KB', 48 * KB], ['49 KB', 49 * KB], ['5 MB song', 5 * MB], ['700 MB video', 700 * MB], ['50 GB image', 50 * GB], ['Largest', MAX]];
          const pre = h('div', { class: 'row gap-s' }, ...PRE.map(([lab, v]) => h('button', { class: 'btn sm', type: 'button', onclick: () => { bytes = v; sl.set(logPos(v, 1, MAX)); draw(); } }, lab)));
          ctx.$('.gr-ctl').append(sl, pre);
          // geometry: four rows (direct, single, double, triple) and four columns (index level 1, 2, 3, data)
          const G = slim
            ? { ix: 4, iw: 70, cols: [82, 152, 222, 290], cw: 64, dw: 66, rowY: [60, 150, 240, 330], rh: 66, fs: 13 }
            : { ix: 8, iw: 128, cols: [158, 296, 434, 572], cw: 120, dw: 120, rowY: [70, 180, 290, 400], rh: 72, fs: 16 };
          function boxEl(x, y, w, hh, cls, linesTxt, fill, dashed) {
            const g = s('g', {});
            g.append(s('rect', { x, y: y - hh / 2, width: w, height: hh, rx: 8, class: cls, 'stroke-width': 2, 'stroke-dasharray': dashed ? '5 4' : null }));
            linesTxt.forEach((t, i) => g.append(s('text', { x: x + w / 2, y: y - hh / 2 + 21 + i * (G.fs + 3), 'text-anchor': 'middle', 'font-size': i === 0 ? G.fs : G.fs - 1, 'font-weight': i === 0 ? 800 : 400, class: dashed ? 's-sub' : null }, t)));
            if (fill != null && !dashed) {
              g.append(s('rect', { x: x + 8, y: y + hh / 2 - 13, width: w - 16, height: 6, rx: 3, class: 's-panel', 'stroke-width': 0 }));
              g.append(s('rect', { x: x + 8, y: y + hh / 2 - 13, width: Math.max(2, (w - 16) * fill), height: 6, rx: 3, style: 'fill:var(--chc)' }));
            }
            return g;
          }
          const arrow = (x1, y1, x2, cls) => s('path', { d: `M${x1} ${y1} L${x2 - 3} ${y1}`, class: cls || 's-line', 'marker-end': `url(#${cls === 's-muted' ? 'arr-muted' : 'arr'})` });
          const blk = (n) => (n >= 1e6 ? `${ctx.util.fmt(n / 1e6, 1)} M blocks` : `${commas(n)} block${n === 1 ? '' : 's'}`);
          function draw() {
            const sh = shape(bytes, B, p);
            svg.replaceChildren();
            const [d, s1, dd, t] = sh.used;
            // the inode: a tall box on the left with its 15 slots grouped by row
            svg.append(s('rect', { x: G.ix, y: 22, width: G.iw, height: H - 30, rx: 10, class: 's-accent', 'stroke-width': 2 }));
            svg.append(s('text', { x: G.ix + G.iw / 2, y: 16, 'text-anchor': 'middle', 'font-size': G.fs, 'font-weight': 800 }, 'Inode'));
            const labels = slim ? ['d0-11', 'S', 'D', 'T'] : ['12 direct', 'single', 'double', 'triple'];
            const used = [d > 0, s1 > 0, dd > 0, t > 0];
            G.rowY.forEach((y, r) => {
              if (r === 0) {
                if (slim) {
                  svg.append(s('text', { x: G.ix + G.iw / 2, y: y - 6, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, labels[0]), s('text', { x: G.ix + G.iw / 2, y: y + 12, 'text-anchor': 'middle', 'font-size': 13 }, `${d}/12`));
                } else {
                  for (let i = 0; i < 12; i++) svg.append(s('rect', { x: G.ix + 8 + (i % 6) * 19, y: y - 22 + Math.floor(i / 6) * 22, width: 16, height: 16, rx: 3, class: i < d ? 's-io' : 's-panel', 'stroke-width': 1.5 }));
                  svg.append(s('text', { x: G.ix + G.iw / 2, y: y + 40, 'text-anchor': 'middle', 'font-size': 15, class: 's-sub' }, `${d} of 12 direct`));
                }
              } else {
                svg.append(s('rect', { x: G.ix + 10, y: y - 18, width: G.iw - 20, height: 36, rx: 6, class: used[r] ? 's-os' : 's-panel', 'stroke-width': 2 }));
                svg.append(s('text', { x: G.ix + G.iw / 2, y: y + 5, 'text-anchor': 'middle', 'font-size': G.fs, 'font-weight': 700 }, labels[r]));
              }
            });
            // row 0: direct → data
            const dataBox = (r, n, cap) => boxEl(G.cols[3], G.rowY[r], G.dw, G.rh, n ? 's-io' : 's-panel', n ? (slim ? [size(n * B), 'data'] : [size(n * B), blk(n)]) : ['none'], n / cap, !n);
            svg.append(arrow(G.ix + G.iw, G.rowY[0], G.cols[3], d ? 's-line' : 's-muted'), dataBox(0, d, 12));
            // index levels: entries used per level and how many index blocks that level needs
            // each box: [index blocks at this level, fraction of the level's entries in use (the bar)]
            const c2 = Math.ceil(dd / P), c3a = Math.ceil(t / (P * P)), c3b = Math.ceil(t / P);
            const lvl = [
              null,
              [[1, s1 / P]],
              [[1, c2 / P], [c2, dd / (P * P)]],
              [[1, c3a / P], [c3a, c3b / (P * P)], [c3b, t / (P * P * P)]],
            ];
            const counts = [0, s1, dd, t], caps = [12, P, P * P, P * P * P];
            for (let r = 1; r <= 3; r++) {
              const on = counts[r] > 0;
              let x0 = G.ix + G.iw;
              lvl[r].forEach(([nBlocks, fill], k) => {
                svg.append(arrow(x0, G.rowY[r], G.cols[k], on ? 's-line' : 's-muted'));
                const txt = on ? [commas(nBlocks), slim ? (nBlocks === 1 ? 'block' : 'blocks') : (nBlocks === 1 ? 'index block' : 'index blocks')] : ['unused'];
                svg.append(boxEl(G.cols[k], G.rowY[r], G.cw, G.rh, on ? 's-os' : 's-panel', txt, fill, !on));
                x0 = G.cols[k] + G.cw;
              });
              svg.append(arrow(x0, G.rowY[r], G.cols[3], on ? 's-line' : 's-muted'), dataBox(r, counts[r], caps[r]));
            }
            // readouts, all from shape()
            const deep = sh.deepest;
            tab.innerHTML = `<tr><td>Data blocks</td><td class="num"><b>${commas(sh.n)}</b> × 4 KB</td></tr>
              <tr><td>Index blocks</td><td class="num"><b>${commas(sh.index)}</b> (single ${sh.ib[1]}, double ${commas(sh.ib[2])}, triple ${commas(sh.ib[3])})</td></tr>
              <tr><td>Space overhead</td><td class="num">${sh.n ? ctx.util.fmt((100 * sh.index) / sh.n, 2) : 0}% extra for the index</td></tr>
              <tr class="on"><td>Reading one byte</td><td>at most <b>${deep}</b> index-block read${deep === 1 ? '' : 's'}, then the data block</td></tr>`;
            why.innerHTML = deep === 0
              ? `Most files are small. Up to 48 KB, the inode alone maps the whole file: no index block to store and none to read.`
              : `Even this file needs only ${deep} extra read${deep === 1 ? '' : 's'} to reach any byte, and its index costs ${ctx.util.fmt((100 * sh.index) / sh.n, 2)}% extra space. Small files stay cheap; huge files stay possible.`;
          }
          draw();
        },
      },

      /* ---------------- 6. Centerpiece: which blocks must be read to reach byte N? ---------------- */
      {
        title: 'Find any byte: the offset calculator',
        kind: 'lab',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0">To read byte <i>N</i> of a file, the kernel divides by the block size to get a <b>logical block number</b>, then works out which pointer covers that block and which entry to use in each <span class="t">indirect block</span>. Change the sizes and the offset.</p>
              <div class="oc-ctl stack" style="gap:6px"></div>
              <table class="tbl compact oc-cap"></table>
              <p class="small m0 oc-lim"></p>
            </div>
            <div class="card white stack" style="gap:8px">
              <div class="log oc-calc" style="font-size:14px;overflow:hidden"></div>
              <div class="oc-svg"></div>
              <div class="narr oc-sum" style="margin-top:auto"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          let B = 4 * KB, p = 8, off = 100000;
          let LV = levels(B, p);
          const calc = ctx.$('.oc-calc'), cap = ctx.$('.oc-cap'), sum = ctx.$('.oc-sum'), lim = ctx.$('.oc-lim');
          const W = slim ? 360 : 680, H = slim ? 250 : 272;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });
          ctx.$('.oc-svg').append(svg);
          const maxOff = () => LV.totalBytes - 1;
          const toPos = (v) => logPos(v + 1, 1, maxOff() + 1);
          const sl = ctx.ui.slider({ label: 'Byte offset', min: 0, max: 1000, step: 1, value: toPos(off), format: () => (slim ? size(off, 2) : commas(off)), onInput: (v) => { off = Math.min(maxOff(), Math.max(0, Math.floor(logVal(v, 1, maxOff() + 1)) - 1)); draw(); } });
          sl.input.setAttribute('data-keys', '');
          // 16 KB is the largest choice: with 32 KB blocks and 4-byte addresses the last byte (about 2^54) is past exact JavaScript integers
          const segB = ctx.ui.seg([1, 4, 8, 16].map((k) => ({ value: k * KB, label: k + ' KB' })), B, (v) => { B = v; resize(); });
          const segP = ctx.ui.seg([{ value: 4, label: '4 bytes' }, { value: 8, label: '8 bytes' }], p, (v) => { p = v; resize(); });
          const PRE = [['byte 0', 0], ['byte 50,000', 50000], ['byte 100,000', 100000], ['5 MB in', 5 * MB], ['2 GB in', 2 * GB], ['last byte', -1]];
          const pre = h('div', { class: 'row gap-s' }, ...PRE.map(([lab, v]) => h('button', { class: 'btn sm', type: 'button', onclick: () => { off = v < 0 ? maxOff() : Math.min(v, maxOff()); sl.set(toPos(off)); draw(); } }, lab)));
          const lab = (t) => h('span', { class: 'small b', style: { width: '96px' } }, t);
          ctx.$('.oc-ctl').append(h('div', { class: 'row gap-s' }, lab('Block size'), segB), h('div', { class: 'row gap-s' }, lab('Address size'), segP), sl, pre);
          function resize() { LV = levels(B, p); off = Math.min(off, maxOff()); sl.set(toPos(off)); draw(); }
          const NAMES = ['direct', 'single indirect', 'double indirect', 'triple indirect'];
          // one index block drawn as a column of entries with the chosen entry lit
          function indexCol(x, y, w, hh, title, entry, P, on) {
            const g = s('g', {});
            g.append(s('text', { x: x + w / 2, y: y - 8, 'text-anchor': 'middle', 'font-size': slim ? 13 : 14, 'font-weight': 700, class: on ? null : 's-sub' }, title));
            g.append(s('rect', { x, y, width: w, height: hh, rx: 8, class: on ? 's-os' : 's-panel', 'stroke-width': 2, 'stroke-dasharray': on ? null : '5 4' }));
            if (!on) { g.append(s('text', { x: x + w / 2, y: y + 26, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'not used')); return { g, y: y + hh / 2 }; }
            const keys = [...new Set([0, entry, P - 1])].sort((a, b) => a - b);
            const rows = [];
            keys.forEach((k, i) => { if (i && k - keys[i - 1] > 1) rows.push(null); rows.push(k); });
            const rh = Math.min(30, (hh - 10) / rows.length);
            const top = y + (hh - rows.length * rh) / 2;
            let litY = y + hh / 2;
            rows.forEach((k, i) => {
              const ry = top + i * rh;
              if (k === entry) { g.append(s('rect', { x: x + 4, y: ry, width: w - 8, height: rh - 2, rx: 5, class: 's-accent', 'stroke-width': 2 })); litY = ry + rh / 2 - 1; }
              g.append(s('text', { x: x + w / 2, y: ry + rh / 2 + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': k === entry ? 800 : 400, class: k === entry ? 's-monot' : 's-sub s-monot' }, k == null ? '⋮' : (slim ? commas(k) : 'entry ' + commas(k))));
            });
            return { g, y: litY };
          }
          function draw() {
            const r = locate(off, B, p), P = LV.P;
            // capacity table, highlighted at the level in use
            cap.innerHTML = `<tr><th>Level</th><th>Data blocks</th><th>Reach</th><th>Index reads</th></tr>` +
              LV.rows.map((row) => `<tr class="${row.k === r.level ? 'on' : ''}"><td>${row.name}</td><td class="num">${commas(row.blocks)}</td><td class="num">${size(row.bytes)}</td><td class="num">${row.reads}</td></tr>`).join('') +
              `<tr><td><b>Largest file</b></td><td class="num"><b>${commas(LV.totalBlocks)}</b></td><td class="num"><b>≈ ${size(LV.totalBytes, 3)}</b></td><td></td></tr>`;
            // a p-byte address can number only 2^(8p) blocks; with 4-byte addresses and big blocks that, not the tree, is the real limit
            const nums = Math.pow(2, 8 * p);
            lim.innerHTML = LV.totalBlocks > nums
              ? `<b style="color:var(--warn)">Catch:</b> ${p}-byte addresses number only ${commas(nums)} blocks, so a volume of ${size(B)} blocks stops at ${size(nums * B)}, short of this tree's reach.`
              : '';
            // the worked calculation
            const Ls = commas(r.L);
            const work = [`N = ${commas(off)} · block size ${commas(B)} bytes · ${commas(P)} addresses per block`, `logical block L = ⌊N / ${commas(B)}⌋ = ${Ls}, byte ${commas(r.within)} inside it`];
            if (r.level === 0) work.push(`L < 12 → direct pointer d${r.slot}`);
            else {
              const rel = r.L - LV.rows[r.level].firstBlock;
              work.push(`L ≥ ${commas(LV.rows[r.level].firstBlock)} → ${NAMES[r.level]}, block ${commas(rel)} of that range`);
              if (r.level === 1) work.push(`entry ${commas(r.idx[0])} of the single indirect block`);
              if (r.level === 2) work.push(`entry ⌊${commas(rel)} / ${commas(P)}⌋ = ${commas(r.idx[0])} in the top block, then entry ${commas(rel)} mod ${commas(P)} = ${commas(r.idx[1])}`);
              if (r.level === 3) work.push(`entries ${r.idx.map(commas).join(', ')} (the base-${commas(P)} digits of ${commas(rel)})`);
            }
            calc.innerHTML = work.map((t) => `<div>${t}</div>`).join('');
            // the path picture: inode slot → up to three index blocks → data block
            svg.replaceChildren();
            const G = slim ? { ix: 4, iw: 64, cols: [78, 146, 214], cw: 60, dx: 284, dw: 72, y: 30, hh: 210 } : { ix: 6, iw: 116, cols: [160, 290, 420], cw: 104, dx: 556, dw: 118, y: 30, hh: 232 };
            svg.append(s('text', { x: G.ix + G.iw / 2, y: G.y - 8, 'text-anchor': 'middle', 'font-size': slim ? 13 : 14, 'font-weight': 700 }, 'Inode'));
            svg.append(s('rect', { x: G.ix, y: G.y, width: G.iw, height: G.hh, rx: 8, class: 's-accent', 'stroke-width': 2 }));
            const slots = [r.level === 0 ? `d${r.slot}` : 'd0–d11', 'S', 'D', 'T'];
            let fromY = G.y + G.hh / 2;
            slots.forEach((t, i) => {
              const sy = G.y + 8 + i * ((G.hh - 16) / 4), shh = (G.hh - 16) / 4 - 6;
              const lit = i === r.level;
              svg.append(s('rect', { x: G.ix + 6, y: sy, width: G.iw - 12, height: shh, rx: 5, class: lit ? 's-ok' : 's-panel', 'stroke-width': lit ? 2.5 : 1 }));
              svg.append(s('text', { x: G.ix + G.iw / 2, y: sy + shh / 2 + 5, 'text-anchor': 'middle', 'font-size': slim ? 13 : 14, 'font-weight': lit ? 800 : 400 }, t));
              if (lit) fromY = sy + shh / 2;
            });
            let x0 = G.ix + G.iw;
            const titles = slim ? ['level 1', 'level 2', 'level 3'] : ['index level 1', 'index level 2', 'index level 3'];
            for (let k = 0; k < 3; k++) {
              const on = k < r.level;
              const col = indexCol(G.cols[k], G.y, G.cw, G.hh, titles[k], on ? r.idx[k] : 0, P, on);
              svg.append(col.g);
              if (on) { svg.append(s('path', { d: `M${x0} ${fromY} L${G.cols[k] - 3} ${col.y}`, class: 's-line', 'marker-end': 'url(#arr)' })); x0 = G.cols[k] + G.cw; fromY = col.y; }
            }
            svg.append(s('text', { x: G.dx + G.dw / 2, y: G.y - 8, 'text-anchor': 'middle', 'font-size': slim ? 13 : 14, 'font-weight': 700 }, 'Data block'));
            svg.append(s('rect', { x: G.dx, y: G.y, width: G.dw, height: G.hh, rx: 8, class: 's-io', 'stroke-width': 2 }));
            svg.append(...lines(s, G.dx + G.dw / 2, G.y + G.hh / 2, slim ? ['block', Ls, 'byte', commas(r.within)] : ['logical block', Ls, 'byte ' + commas(r.within)], { 'font-size': 14, 'font-weight': 700 }, 22));
            svg.append(s('path', { d: `M${x0} ${fromY} L${G.dx - 3} ${G.y + G.hh / 2}`, class: 's-line', 'marker-end': 'url(#arr)' }));
            // the cost
            const k = r.level;
            sum.className = 'narr oc-sum ' + (k === 0 ? 'ok' : k === 3 ? 'warn' : '');
            sum.innerHTML = `<b>${NAMES[k][0].toUpperCase() + NAMES[k].slice(1)}.</b> With the file open (inode already in memory), reaching this byte costs <b>${k}</b> index-block read${k === 1 ? '' : 's'} + 1 data-block read = <b>${k + 1}</b> disk read${k ? 's' : ''}. ${k === 0 ? 'The inode itself holds the address.' : 'Once those index blocks sit in the cache, neighbouring bytes are nearly free.'}`;
          }
          draw();
        },
      },

      /* ---------------- 7. Directories and path lookup ---------------- */
      {
        title: 'Follow a path from the root inode',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">A directory is just a file of (name, inode number) pairs. Opening <code>/home/ann/notes.txt</code> means walking the tree one name at a time.</p>
              <p class="m0">That walk is <span class="t" data-t="path lookup">path lookup</span>. For each name: read the current directory's inode to learn where its blocks are, read those blocks, and find the name to get the next inode number.</p>
              <div class="callout tip m0" data-label="Relative paths and ..">A relative path such as <code>../bo/todo</code> starts at the working directory's inode instead of the root. <code>..</code> is no special trick: it is an ordinary entry that every directory keeps, holding its parent's inode number.</div>
              <div class="callout why m0" data-label="Why kernels cache lookups">Uncached, each directory on the path costs at least two disk reads, so kernels keep recent names and inodes in memory; a repeat lookup usually needs none.</div>
              <p class="small m0">Programs may read a directory, but only the file system writes it, through calls such as <code>mkdir</code>, <code>link</code>, <code>unlink</code> and <code>rename</code>. No program can scribble a broken entry into the tree.</p>
            </div>
            <div class="card white stack" style="gap:8px">
              <div class="pl-svg grow" style="display:grid;align-items:center"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { s } = ctx;
          const slim = ctx.narrow;
          // a tiny file system: inodes (type and first data block) and directory blocks ((name, inode) pairs)
          const INO = { 2: { type: 'dir', block: 900 }, 37: { type: 'dir', block: 1450 }, 412: { type: 'dir', block: 3091 }, 7731: { type: 'file', block: 20480 } };
          const BLK = { 900: [['.', 2], ['..', 2], ['bin', 11], ['home', 37], ['usr', 64]], 1450: [['.', 37], ['..', 2], ['ann', 412], ['bo', 415]], 3091: [['.', 412], ['..', 37], ['notes.txt', 7731], ['projects', 7802]] };
          const DIRNAME = { 900: '/', 1450: '/home', 3091: '/home/ann' };
          const COMPS = ['home', 'ann', 'notes.txt'];
          // run the lookup once and record every event; captions and counters come from these events
          const EV = [{ t: 'start', reads: 0 }];
          let cur = 2, reads = 0;
          COMPS.forEach((name, j) => {
            EV.push({ t: 'inode', ino: cur, reads: ++reads, bar: j });
            const blk = INO[cur].block, hit = BLK[blk].find((e) => e[0] === name);
            EV.push({ t: 'block', blk, name, found: hit[1], reads: ++reads, bar: j + 1 });
            cur = hit[1];
          });
          EV.push({ t: 'inode', ino: cur, reads: ++reads, bar: COMPS.length, last: true });
          EV.push({ t: 'done', reads, bar: COMPS.length });
          const ORDER = [2, 37, 412, 7731], BORDER = [900, 1450, 3091];
          const W = slim ? 360 : 660, H = slim ? 784 : 330;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });
          ctx.$('.pl-svg').append(svg);
          // positions: inode cards and directory blocks (wide: two rows; slim: one zig-zag column)
          const pos = {};
          if (slim) {
            let y = 78;
            ORDER.forEach((n, i) => {
              pos['i' + n] = [70, y, 220, 44]; y += 44 + 26;
              if (i < 3) { const b = BORDER[i], hh = 30 + BLK[b].length * 21; pos['b' + b] = [40, y, 280, hh]; y += hh + 26; }
            });
          } else {
            ORDER.forEach((n, i) => { pos['i' + n] = [8 + i * 164, 66, 150, 58]; });
            BORDER.forEach((b, i) => { pos['b' + b] = [8 + i * 214, 162, 200, 30 + BLK[b].length * 26]; });
          }
          const entryY = (b, k) => pos['b' + b][1] + 40 + k * (slim ? 21 : 26);
          function frame(i) {
            const ev = EV[i];
            const seenI = new Set(EV.slice(0, i + 1).filter((e) => e.t === 'inode').map((e) => e.ino));
            const seenB = new Set(EV.slice(0, i + 1).filter((e) => e.t === 'block').map((e) => e.blk));
            svg.replaceChildren();
            // the path, one box per component, with the one being handled lit
            const parts = ['/', ...COMPS];
            let x = 8;
            const fs = slim ? 14 : 15;
            parts.forEach((t, k) => {
              const w = t.length * (fs * 0.62) + 22;
              const lit = ev.bar === k && ev.t !== 'start';
              const done = ev.bar > k || ev.t === 'done';
              svg.append(s('rect', { x, y: 10, width: w, height: 30, rx: 7, class: lit ? 's-accent' : done ? 's-ok' : 's-panel', 'stroke-width': lit ? 2.5 : 1.5 }));
              svg.append(s('text', { x: x + w / 2, y: 30, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 700, class: 's-monot' }, t));
              x += w + 6;
            });
            svg.append(slim ? s('text', { x: 8, y: 62, 'font-size': fs, 'font-weight': 800 }, `disk reads: ${ev.reads}`) : s('text', { x: W - 8, y: 30, 'text-anchor': 'end', 'font-size': fs, 'font-weight': 800 }, `disk reads: ${ev.reads}`));
            // arrows first, so boxes sit on top of them
            const arrows = [];
            EV.slice(1, i + 1).forEach((e) => {
              // inode → its directory block: straight down
              if (e.t === 'inode' && !e.last && seenB.has(INO[e.ino].block)) { const a = pos['i' + e.ino], b = pos['b' + INO[e.ino].block]; const ax = slim ? a[0] + a[2] / 2 : Math.max(a[0] + a[2] / 2, b[0] + 34); arrows.push(`M${ax} ${a[1] + a[3]} L${ax} ${b[1] - 3}`); }
              // matched entry → the next inode: out of the block's right edge, up the gap beside it
              if (e.t === 'block') { const b = pos['b' + e.blk], k = BLK[e.blk].findIndex((r) => r[0] === e.name), t = pos['i' + e.found]; const gx = b[0] + b[2] + 7, ey = entryY(e.blk, k) - 5; arrows.push(slim ? `M${t[0] + t[2] / 2} ${b[1] + b[3]} L${t[0] + t[2] / 2} ${t[1] - 3}` : `M${b[0] + b[2] - 4} ${ey} L${gx} ${ey} L${gx} ${t[1] + t[3] + 3}`); }
            });
            arrows.forEach((d) => svg.append(s('path', { d, class: 's-line', 'marker-end': 'url(#arr)' })));
            ORDER.forEach((n) => {
              const [bx, by, bw, bh] = pos['i' + n];
              const seen = seenI.has(n), lit = ev.t === 'inode' && ev.ino === n;
              svg.append(s('rect', { x: bx, y: by, width: bw, height: bh, rx: 8, class: seen ? (lit ? 's-ok' : 's-accent') : 's-panel', 'stroke-width': lit ? 3 : 2, 'stroke-dasharray': seen ? null : '5 4' }));
              const known = seen || EV.some((e, j) => j <= i && e.t === 'block' && e.found === n);
              svg.append(s('text', { x: bx + bw / 2, y: by + (slim ? 18 : 22), 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 800, class: seen ? null : 's-sub' }, known ? `inode ${n}` : 'inode ?'));
              if (known && !seen) svg.append(s('text', { x: bx + bw / 2, y: by + (slim ? 36 : 44), 'text-anchor': 'middle', 'font-size': slim ? 13 : 14, class: 's-sub' }, 'next to read'));
              if (seen) svg.append(s('text', { x: bx + bw / 2, y: by + (slim ? 36 : 44), 'text-anchor': 'middle', 'font-size': slim ? 13 : 14 }, INO[n].type === 'dir' ? `dir → block ${INO[n].block}` : `file → block ${INO[n].block}`));
            });
            BORDER.forEach((b) => {
              const [bx, by, bw, bh] = pos['b' + b];
              const seen = seenB.has(b), lit = ev.t === 'block' && ev.blk === b;
              svg.append(s('rect', { x: bx, y: by, width: bw, height: bh, rx: 8, class: seen ? 's-io' : 's-panel', 'stroke-width': lit ? 3 : 2, 'stroke-dasharray': seen ? null : '5 4' }));
              svg.append(s('text', { x: bx + 10, y: by + 20, 'font-size': fs - 1, 'font-weight': 800, class: seen ? null : 's-sub' }, seen ? `block ${b} (${DIRNAME[b]})` : 'directory block ?'));
              if (!seen) return;
              BLK[b].forEach(([nm, ino], k) => {
                const ey = entryY(b, k);
                const hit = EV.some((e, j) => j <= i && e.t === 'block' && e.blk === b && e.name === nm);
                if (hit) svg.append(s('rect', { x: bx + 5, y: ey - 16, width: bw - 10, height: slim ? 20 : 23, rx: 4, class: 's-ok', 'stroke-width': 1.5 }));
                svg.append(s('text', { x: bx + 14, y: ey, 'font-size': slim ? 13 : 14, class: 's-monot', 'font-weight': hit ? 800 : 400 }, nm));
                svg.append(s('text', { x: bx + bw - 14, y: ey, 'text-anchor': 'end', 'font-size': slim ? 13 : 14, class: 's-monot', 'font-weight': hit ? 800 : 400 }, '→ ' + ino));
              });
            });
            // narration from the event
            if (ev.t === 'start') return `Lookup starts at the <b>root directory</b>. Its inode number is fixed in advance for every file system (inode 2 on many UNIX systems), so the kernel knows where to begin without searching. Disk reads so far: 0.`;
            if (ev.t === 'inode' && ev.last) return `Read <b>inode ${ev.ino}</b>: a regular file whose data starts at block ${INO[ev.ino].block}. The lookup is over. <code>open</code> copies this inode into the in-memory inode table and returns a file descriptor. Disk reads: <b>${ev.reads}</b>.`;
            if (ev.t === 'inode') return `Read <b>inode ${ev.ino}</b> from the inode table: a directory whose entries live in block ${INO[ev.ino].block}. The kernel also checks that the process may search this directory (its execute bit). Disk reads: <b>${ev.reads}</b>.`;
            if (ev.t === 'block') return `Read <b>block ${ev.blk}</b>, the contents of directory ${DIRNAME[ev.blk]}, and scan it for the name <b>${ev.name}</b>: found, inode <b>${ev.found}</b>. Disk reads: <b>${ev.reads}</b>.`;
            return `Done: <b>${ev.reads} disk reads</b> for a path of ${COMPS.length} names: two per directory (its inode, then its block) plus one for the file's own inode. A directory too big for one block costs more reads; the name and inode caches usually make all of them unnecessary.`;
          }
          const player = ctx.ui.player({ count: EV.length, render: frame, interval: 2200 });
          ctx.$('.pl-svg').parentNode.append(player.el);
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: what to remember about UNIX files',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const L = levels(4 * KB, 8);
          const reach = L.rows.map((r) => size(r.bytes)).join(' + ');
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            h('div', { class: 'grow' }, ctx.ui.flipcards([
              ['The six classic file types?', 'Regular, directory, special (one per device), named pipe, link (an extra name for an inode) and symbolic link.'],
              ['Where does a file\'s name live?', 'Only in directory entries, as (name, inode number) pairs. The inode holds everything else about the file, never its name.'],
              ['What does rm really do?', 'It removes one name and lowers the link count. The inode and blocks are freed only at link count 0, with no process holding the file open.'],
              ['Hard link or symbolic link?', 'Hard: one more entry with the same inode number. Symbolic: its own small file holding a path; it dangles if that name disappears.'],
              [`Reach of the 15 addresses (4 KB blocks, 8-byte addresses)?`, `${L.P} addresses per block: ${reach} ≈ ${size(L.totalBytes, 0)}.`],
              ['Most reads to reach any byte of an open file?', '3 index blocks (triple indirect) plus the data block. Files up to 48 KB need no index block at all.'],
              ['How is /home/ann/notes.txt found?', 'From the root inode, one name at a time: each directory\'s inode, then its block, then the next inode. 7 reads with nothing cached.'],
              ['The regions of a classic UNIX volume?', 'Boot block, superblock (size, inode count, free counts), inode table, then the data blocks.'],
            ], { cols: ctx.narrow ? 1 : 4, height: 214 }))));
        },
      },

      /* ---------------- 9. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In a UNIX file system, what does a directory entry hold?',
            choices: ['The file\'s owner and permission bits', 'The file\'s name and its inode number', 'The file\'s size and its block addresses', 'The file\'s name and its access times'], answer: 1,
            feedback: ['Owner and permissions are inode fields, shared by every name the file has.', null, 'Size and block addresses live in the inode, not in the directory.', 'Times are inode fields; the entry holds only the name and a number.'],
            why: 'A UNIX directory is a file of (name, inode number) pairs. Everything else about the file lives in its inode, which is why one file can have several names.' },
          { type: 'tf', q: 'An inode\'s ctime field records when the file was created.', answer: false,
            why: 'The c stands for change: ctime is the last time the inode itself changed (a write, chmod, chown or a new link). Classic UNIX kept no creation time; some newer file systems add a separate birth time.' },
          { type: 'num', q: 'A UNIX file system uses 4 KB blocks and 12 direct pointers per inode. What is the largest file size, in KB, that needs no indirect block at all?', answer: 48, tol: 0, unit: 'KB',
            why: '12 direct pointers × 4 KB per block = 48 KB. Any file up to that size is mapped by the inode alone.' },
          { type: 'num', q: 'Blocks are 4 KB and each block address takes 8 bytes. How many data blocks can the double indirect pointer reach?', answer: 262144, tol: 0, unit: 'blocks',
            why: 'One block holds 4,096 / 8 = 512 addresses. The double indirect pointer leads to 512 index blocks, each pointing to 512 data blocks: 512 × 512 = 262,144 blocks (1 GB).' },
          { q: 'Blocks are 4 KB, block addresses are 8 bytes, and the inode has 12 direct pointers. Which pointer leads to the block that holds byte offset 100,000 of a file?',
            choices: ['The double indirect pointer', 'One of the direct pointers', 'The triple indirect pointer', 'The single indirect pointer'], answer: 3,
            feedback: ['The double indirect range starts only at logical block 12 + 512 = 524, and byte 100,000 lies in block 24.', 'Direct pointers cover logical blocks 0 to 11 (bytes 0 to 49,151); byte 100,000 is in block 24.', 'Triple indirect starts at logical block 262,668, far beyond block 24.', null],
            why: '⌊100,000 / 4,096⌋ = 24. Blocks 0 to 11 are direct; blocks 12 to 523 go through the single indirect block, so block 24 is entry 24 − 12 = 12 of that block.' },
          { type: 'num', q: 'Blocks are 4 KB, addresses are 8 bytes, 12 direct pointers. A file is open (its inode is in memory) and nothing else is cached. How many disk reads does it take to read the byte at offset 2,147,483,648 (2 GB)?', answer: 4, tol: 0, unit: 'reads',
            why: 'Logical block 524,288 is past 12 + 512 + 262,144 = 262,668, so it is reached through the triple indirect pointer: 3 index blocks plus 1 data block = 4 reads.' },
          { q: 'Ann runs <code>ln report.txt copy.txt</code> and then <code>rm report.txt</code>. What happens to the data?',
            choices: ['copy.txt becomes a dangling link to a missing file', 'The data is freed because report.txt was the original', 'copy.txt still reaches it; the link count drops to 1', 'rm refuses, because the file still has two names'], answer: 2,
            feedback: ['Only symbolic links dangle. A hard link names the inode itself, not the name report.txt.', 'There is no "original": both entries are equal, and the data is freed only when the link count reaches 0.', null, 'rm (unlink) happily removes one name; it simply lowers the link count.'],
            why: '<code>ln</code> made a second entry for the same inode (link count 2). <code>rm</code> removed one entry (link count 1), so the inode and its blocks stay, reachable through copy.txt.' },
          { type: 'bucket', q: 'Sort each property: does it describe a hard link or a symbolic link?', buckets: ['Hard link', 'Symbolic link'],
            items: [['Is another directory entry holding the same inode number', 0], ['Raises the target\'s link count', 0], ['Still works after the other name is removed', 0], ['Has its own inode whose contents are a path name', 1], ['Can name a file on a different file system', 1], ['Breaks (dangles) if the target name is deleted', 1]],
            why: 'A hard link is the file itself under another name, so it shares the inode and its link count. A symbolic link is a separate small file holding a path, so it can cross file systems but fails once that path names nothing.' },
          { type: 'order', q: 'Nothing is cached. Put the disk reads for opening <code>/home/ann/notes.txt</code> in order.',
            items: ['Read the root directory\'s inode', 'Read the root directory\'s block and find "home"', 'Read the inode of /home', 'Read the block of /home and find "ann"', 'Read the inode of /home/ann', 'Read the block of /home/ann and find "notes.txt"', 'Read the inode of notes.txt'],
            why: 'Path lookup starts at the root inode and alternates: a directory\'s inode tells where its blocks are; its block gives the next inode number. Three names cost 2 × 3 + 1 = 7 reads.' },
          { type: 'match', q: 'Match each UNIX file type to its description.',
            pairs: [['Regular file', 'Arbitrary bytes, with no structure imposed by the system'], ['Directory', 'A list of (name, inode number) pairs'], ['Special file', 'Gives programs access to an I/O device'], ['Named pipe', 'A first-in, first-out channel between processes'], ['Symbolic link', 'A small file whose contents are a path name']],
            why: 'All of them live in the same directory tree and are used with the same open, read, write and close calls; the type in the inode\'s mode field tells the kernel how to treat each one.' },
          { type: 'multi', q: 'Which of these are kept in a UNIX inode?', choices: ['The file mode (type and permission bits)', 'The link count', 'The file\'s name', 'The time of the last modification', 'The addresses of the file\'s blocks', 'The name of the parent directory'], answer: [0, 1, 3, 4],
            why: 'The inode holds the mode, link count, owner and group, size, times and block addresses. Names, including the parent\'s, live only in directory entries.' },
          { q: 'Which part of a classic UNIX volume records how big the file system is, how many inodes it has and how much space is free?',
            choices: ['The superblock', 'The boot block', 'The root directory', 'The inode table'], answer: 0,
            feedback: [null, 'The boot block only holds code used to start the operating system.', 'The root directory lists names and inode numbers; it does not describe the volume.', 'The inode table holds one inode per file, but the totals about the table live elsewhere.'],
            why: 'The superblock describes the whole file system: its size, block size, inode count and location, and free counts. Because it is so important, real systems keep backup copies of it.' },
        ],
      },
    ],
    notes: `
      <h3>UNIX file management</h3>
      <p>In UNIX a file is three separate things kept in three places: a <b>name</b> in a directory, an <b>inode</b> (index node) that describes the file, and <b>data blocks</b> that hold its bytes. A directory entry pairs a name with an <b>inode number</b>; everything else the system knows about the file lives in the inode. This split is what makes links, quick lookups and very large files possible.</p>

      <h4>The six classic file types</h4>
      <table>
        <tr><th>Type</th><th>ls -l letter</th><th>What it is</th></tr>
        <tr><td>Regular (ordinary)</td><td>-</td><td>Any bytes a program wrote: text, photos, programs. The system imposes no structure; programs give the bytes meaning. An executable program is a regular file too.</td></tr>
        <tr><td>Directory</td><td>d</td><td>A list of (name, inode number) pairs that builds the tree. Programs may read it; only the file system writes it.</td></tr>
        <tr><td>Special</td><td>c or b</td><td>One per I/O device (character or block). Reading or writing it drives the device; the major and minor device numbers select the driver and the unit.</td></tr>
        <tr><td>Named pipe (FIFO)</td><td>p</td><td>A pipe with a name in the tree, so unrelated processes can use it. Bytes pass first in, first out, through a kernel buffer; only the name and inode are on disk, never the bytes.</td></tr>
        <tr><td>Link (hard link)</td><td>the file's own letter</td><td>Not a new object: one more directory entry naming an existing inode.</td></tr>
        <tr><td>Symbolic link</td><td>l</td><td>Its own small file whose contents are the path name of another file.</td></tr>
      </table>
      <p>Later UNIX systems (from 4.2BSD, 1983) add a seventh type, the socket (s), a named two-way endpoint between processes on one machine. Because devices and pipes are files, the same open, read, write and close calls work on all of them.</p>

      <h4>The inode</h4>
      <p>Every file has exactly one inode; several names may lead to the same inode, but an inode belongs to one file. The inodes sit in the <b>inode table</b> on disk, and the inode number is simply the position in that table (so the number itself is not stored inside). When a file is opened, the kernel copies its inode into the <b>in-memory inode table</b> and adds bookkeeping such as a count of open references. Typical fields (a modern UNIX such as FreeBSD):</p>
      <ul>
        <li><b>File mode</b>: 4 type bits, then set-user-ID, set-group-ID and sticky bits, then read/write/execute for owner, group and others. Example: <code>-rw-r--r--</code> = octal 0100644. On open the kernel compares the process's user and group IDs with the owner and group IDs and applies the matching three bits; a set-user-ID program runs with its owner's rights, and the sticky bit on a shared directory such as /tmp stops users from deleting each other's files.</li>
        <li><b>Link count</b>: how many directory entries name the inode.</li>
        <li><b>Owner and group IDs</b> (numbers only).</li>
        <li><b>Size</b> in bytes (the logical length) and <b>block count</b> (space really allocated, indirect blocks included; often counted in 512-byte units).</li>
        <li><b>Times</b>: last access (atime), last modification of the data (mtime), last change of the inode itself (ctime). ctime is <i>not</i> creation time; classic UNIX kept none, while UFS2 and ext4 later added a birth time.</li>
        <li><b>Block addresses</b>: 12 direct pointers plus single, double and triple indirect pointers.</li>
        <li><b>Flags</b> (such as immutable or append-only), a <b>generation number</b> (changed whenever the slot is reused, so stale network file handles are detected) and the <b>size of the extended attributes</b>.</li>
      </ul>
      <p>The file's <b>name is not in the inode</b>; it lives only in directory entries.</p>

      <h4>Hard links, symbolic links and the link count</h4>
      <ul>
        <li><code>ln a b</code> adds a directory entry b with a's inode number; the link count rises by 1. No data is copied and neither name is the "original".</li>
        <li><code>rm</code> (the unlink call) removes one name and lowers the link count. The inode and its blocks are freed only when the count reaches 0 and no process still has the file open.</li>
        <li><code>ln -s a s</code> creates a new inode of type symbolic link whose data is the text "a". The target's link count does not change, and the target need not exist. Opening s makes the kernel look the stored path up again, so if a is removed, s is a <b>dangling link</b>; if a new file named a appears, s finds that new file.</li>
        <li>Hard links cannot cross file systems (inode numbers are local to one file system) and normally cannot name directories; symbolic links can do both.</li>
      </ul>

      <h4>File allocation: indexed, with the index in the inode</h4>
      <p>Space is allocated dynamically, one block at a time, and a file's blocks need not be contiguous. The index of the file's blocks is kept in the inode: 12 <b>direct pointers</b> name data blocks; the <b>single indirect pointer</b> names an index block full of data-block addresses; the <b>double indirect pointer</b> names an index block of pointers to index blocks; the <b>triple indirect pointer</b> adds a third level. Older System V inodes held 13 addresses (10 direct + 3 indirect) packed into 39 bytes, 3 bytes each.</p>
      <p>With block size B and address size p, one index block holds P = B / p addresses.</p>
      <table>
        <tr><th>Level</th><th>Data blocks</th><th>4 KB blocks, 8-byte addresses (P = 512)</th><th>4 KB blocks, 4-byte addresses (P = 1,024)</th></tr>
        <tr><td>Direct</td><td>12</td><td>48 KB</td><td>48 KB</td></tr>
        <tr><td>Single indirect</td><td>P</td><td>512 blocks = 2 MB</td><td>1,024 blocks = 4 MB</td></tr>
        <tr><td>Double indirect</td><td>P²</td><td>262,144 blocks = 1 GB</td><td>1,048,576 blocks = 4 GB</td></tr>
        <tr><td>Triple indirect</td><td>P³</td><td>134,217,728 blocks = 512 GB</td><td>about 1.07 billion blocks = 4 TB</td></tr>
        <tr><td>Largest file</td><td>12 + P + P² + P³</td><td>134,480,396 blocks ≈ 513 GB</td><td>≈ 4 TB</td></tr>
      </table>
      <p>(1 KB = 1,024 bytes, 1 MB = 1,024 KB, and so on.) The tree's reach is only an upper bound. A block address of p bytes can number at most 2<sup>8p</sup> blocks: with 4-byte addresses that is 4,294,967,296 blocks, or 16 TB of 4 KB blocks, so there the 4 TB tree is the tighter limit; with 8 KB or larger blocks the block numbers run out before the tree does. Real file systems may set still lower limits through other fields.</p>
      <p><b>Finding byte N.</b> Logical block L = ⌊N / B⌋. If L &lt; 12 use direct pointer L. Otherwise subtract 12; if the rest is below P, use entry (L − 12) of the single indirect block. Otherwise subtract P; below P² use the double indirect pointer with entries ⌊r / P⌋ and r mod P; otherwise subtract P² and use the triple indirect pointer, whose three entries are the base-P digits of the rest. Worked examples (4 KB blocks, 8-byte addresses, file open):</p>
      <ul>
        <li>N = 100,000 → L = 24 → single indirect, entry 12 → 1 index read + 1 data read = 2 reads.</li>
        <li>N = 5,242,880 (5 MB) → L = 1,280 → double indirect, r = 756 → entries 1 and 244 → 3 reads.</li>
        <li>N = 2,147,483,648 (2 GB) → L = 524,288 → triple indirect, r = 261,620 → entries 0, 510, 500 → 4 reads.</li>
      </ul>
      <p><b>Why this design works.</b> Most files are small, and every file up to 48 KB is mapped by the inode alone, with no index block to store or read. Large files remain possible, and reaching any byte costs at most 3 extra index reads (fewer once those blocks are cached). The index is cheap in space: a 1 GB file needs 262,144 data blocks and only 513 index blocks (about 0.2%); a 49 KB file needs 13 data blocks and 1 index block.</p>

      <h4>Directories and path lookup</h4>
      <p>A directory is a file of (name, inode number) pairs; each one also lists <code>.</code> (itself) and <code>..</code> (its parent). To open /home/ann/notes.txt the kernel starts at the root directory, whose inode number is fixed in advance (2 on many UNIX file systems), and for each name reads the directory's inode (to find its blocks), reads the directory block, and finds the name to get the next inode number. With one block per directory and nothing cached that is 2 × 3 + 1 = 7 reads: root inode, root block, /home inode, /home block, /home/ann inode, /home/ann block, notes.txt inode. A relative path starts at the working directory's inode instead. The kernel checks search (execute) permission on each directory, and caches recent names and inodes, so repeated lookups usually need no disk reads.</p>

      <h4>Volume structure</h4>
      <ul>
        <li><b>Boot block</b>: space at the start of the volume for code that starts the operating system.</li>
        <li><b>Superblock</b>: describes the file system: its size, block size, number of inodes and where the inode table is, free block and free inode counts, and its state. Real systems keep backup copies.</li>
        <li><b>Inode table</b>: one fixed-size inode for every file the volume can hold; the count is fixed when the file system is created.</li>
        <li><b>Data blocks</b>: file contents, directory contents and indirect blocks.</li>
      </ul>
      <p>Example: a 64 GB volume with 4 KB blocks has 16,777,216 blocks. With one 256-byte inode per 16 KB of space it has 4,194,304 inodes, an inode table of 1 GB (about 1.6% of the volume), and 16,515,070 data blocks. Running out of inodes makes the disk "full" even with free blocks left. Modern UNIX file systems split the volume into groups (cylinder groups in FreeBSD, block groups in Linux ext4), each with its own inodes and data blocks, and keep backup copies of the superblock in several of them.</p>
    `,
  });
})();
