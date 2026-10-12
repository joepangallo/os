/* =====================================================================
   11.8 UNIX SVR4 I/O
   Original teaching material. Small helpers shared by several steps live
   inside this IIFE (no globals).
   ===================================================================== */
(function () {

  // hash slot of a (device, block) pair in the buffer-cache lab and the hash calculator
  const NSLOT = 4;
  const hashOf = (dev, blk) => (dev + blk) % NSLOT;
  const bufLabel = (b) => (b.valid ? `d${b.dev}:${b.blk}` : 'empty');

  // the starting contents of the six-buffer cache used in steps 3 and 4
  function initCache() {
    const bufs = [
      { id: 0, dev: 0, blk: 4, valid: true, dirty: false },
      { id: 1, dev: 0, blk: 9, valid: true, dirty: true },
      { id: 2, dev: 1, blk: 6, valid: true, dirty: false },
      { id: 3, dev: 0, blk: 12, valid: true, dirty: false },
      { id: 4, dev: 1, blk: 1, valid: true, dirty: false },
      { id: 5, dev: null, blk: null, valid: false, dirty: false },
    ];
    const chains = [[], [], [], []];
    bufs.forEach((b) => { if (b.valid) chains[hashOf(b.dev, b.blk)].push(b.id); });
    return { bufs, chains, free: [5, 1, 3, 0, 4, 2], ioq: [[], []] };
  }
  // search one hash chain for (dev, blk); returns the buffers compared and the hit (or null)
  function searchChain(st, dev, blk) {
    const slot = hashOf(dev, blk), seen = [];
    for (const id of st.chains[slot]) { const b = st.bufs[id]; seen.push(id); if (b.dev === dev && b.blk === blk) return { slot, seen, hit: id }; }
    return { slot, seen, hit: null };
  }

  // ENGINE START: the buffer-cache algorithm of the step-4 lab (also checked by dev/qa-11.8)
  function newLab() {
    return Object.assign(initCache(), { stats: { req: 0, hit: 0, miss: 0, rd: 0, wr: 0 } });
  }
  const dropFrom = (arr, id) => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); };
  // writes that were started earlier finish: each buffer becomes clean and goes to the HEAD of the free list
  function finishWrites(st, ev) {
    [0, 1].forEach((d) => {
      while (st.ioq[d].length) {
        const id = st.ioq[d].shift();
        st.bufs[id].dirty = false;
        st.free.unshift(id);
        ev.push({ t: 'done', id });
      }
    });
  }
  // one read or write request for (dev, blk); returns the list of events that happened, in order
  function labRequest(st, dev, blk, write) {
    const ev = [];
    finishWrites(st, ev);
    st.stats.req++;
    const r = searchChain(st, dev, blk);
    ev.push({ t: 'hash', slot: r.slot, seen: r.seen, hit: r.hit });
    let id;
    if (r.hit != null) {
      id = r.hit; st.stats.hit++;
      dropFrom(st.free, id);
    } else {
      st.stats.miss++;
      for (;;) {
        if (!st.free.length) {
          // every free buffer was dirty and is now being written: wait for the first write to finish
          const d = st.ioq[0].length ? 0 : 1, w = st.ioq[d].shift();
          st.bufs[w].dirty = false; st.free.push(w);
          ev.push({ t: 'wait', id: w });
        }
        const head = st.free[0], hb = st.bufs[head];
        if (!hb.dirty) break;
        st.free.shift(); st.ioq[hb.dev].push(head); st.stats.wr++;
        ev.push({ t: 'skip', id: head, old: bufLabel(hb) });
      }
      id = st.free.shift();
      const b = st.bufs[id];
      if (b.valid) { dropFrom(st.chains[hashOf(b.dev, b.blk)], id); ev.push({ t: 'evict', id, old: bufLabel(b) }); }
      else ev.push({ t: 'fresh', id });
      b.dev = dev; b.blk = blk; b.valid = true; b.dirty = false;
      st.chains[r.slot].push(id);
      st.stats.rd++;
      ev.push({ t: 'read', id });
    }
    if (write) { st.bufs[id].dirty = true; ev.push({ t: 'dirty', id }); }
    st.free.push(id);
    ev.push({ t: 'release', id });
    return { ev, id };
  }
  // sync: every delayed-write buffer is written out and becomes clean
  function labSync(st) {
    const ev = [];
    finishWrites(st, ev);
    const ids = st.bufs.filter((b) => b.dirty).map((b) => b.id);
    ids.forEach((id) => { st.bufs[id].dirty = false; st.stats.wr++; });
    ev.push({ t: 'sync', ids });
    return { ev, id: null };
  }
  // the guided tour: each request shows one idea
  const TOUR = [[0, 12, false], [1, 7, false], [0, 21, false], [0, 9, false], [1, 6, true], [0, 4, false], 'sync'];
  // ENGINE END

  // a clickable SVG box (rect + one or more centred text lines) that works with mouse and keyboard
  function hotBox(ctx, o) {
    const { s } = ctx;
    const lines = [].concat(o.text);
    const fs = o.fs || 15, lh = fs + 3;
    const y0 = o.y + o.h / 2 - ((lines.length - 1) * lh) / 2 + fs * 0.35;
    const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': o.label || lines.join(' ') },
      s('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: 10, class: o.cls, 'stroke-width': 2, 'stroke-dasharray': o.dash || null }),
      ...lines.map((t, k) => s('text', { x: o.x + o.w / 2, y: y0 + k * lh, 'text-anchor': 'middle', 'font-size': k === 0 ? fs : fs - 1.5, 'font-weight': k === 0 ? 700 : 500, class: k === 0 ? null : 's-sub' }, t)));
    g.addEventListener('click', o.onClick);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onClick(); } });
    return g;
  }

  Guide.section({
    id: '11.8',
    title: 'UNIX SVR4 I/O',
    short: 'UNIX SVR4 I/O',
    summary: 'UNIX makes every device a file, then moves data through the buffer cache, character queues or direct DMA.',
    objectives: [
      'Explain how UNIX gives each device a special file and why one uniform interface helps every program.',
      'Trace a block request through the buffer cache: hash lookup, hit or miss, the LRU free list and delayed writes.',
      'Describe character queues as producer/consumer buffers in which each character can be read only once.',
      'Compare buffered and unbuffered I/O: copies made, speed, and the cost of locking a process in memory.',
      'Say which kinds of I/O disks, tapes, terminals, communication lines and printers use, and why.',
    ],
    terms: [
      ['Special file (device special file)', 'A name in the file system, usually under /dev, that stands for an I/O device. Programs open, read, write and close it with the same calls they use for ordinary files, and the kernel hands the work to that device\'s driver.'],
      ['Block special file', 'A special file of type b. Its device is used a block at a time through the buffer cache; a disk partition is the usual example.'],
      ['Character special file', 'A special file of type c. Its driver is reached without the buffer cache: terminals and printers go through character queues, and raw disks and tapes do unbuffered transfers.'],
      ['Major device number', 'The number in a special file that picks the driver. The kernel uses it as an index into its table of block drivers or of character drivers.'],
      ['Minor device number', 'The number in a special file that is handed to the driver so it knows which of its units is meant, such as which disk partition or which terminal line.'],
      ['Buffered I/O', 'I/O whose data passes through buffers owned by the kernel (the buffer cache or character queues) on its way between a device and a process.'],
      ['Unbuffered I/O', 'I/O in which DMA moves data straight between the device and the process\'s own memory, with no kernel buffer in between. It is the fastest path, but the process must stay locked in main memory until the transfer ends.'],
      ['Raw device', 'The character special file through which a disk or a tape is used for unbuffered I/O, bypassing the buffer cache. Traditionally its name carries an r, as in /dev/rdsk/....'],
      ['Buffer cache', 'UNIX\'s pool of main-memory buffers, each holding a copy of one disk block. Block-device I/O passes through it, so a request for a block that is already there needs no disk access.'],
      ['Buffer header', 'The small record that describes one buffer: which device and block it holds, status flags (busy, valid, delayed write), where its data area is, and its links on a hash chain and on the free list.'],
      ['Free list', 'The list of buffers not in use at the moment, kept in least-recently-used order. A released buffer joins the tail; a buffer needed for a new block is taken from the head.'],
      ['Device list', 'For each disk, the list of all the buffers currently associated with that disk.'],
      ['Driver I/O queue', 'For each device, the list of buffers that are being transferred, or are waiting their turn to be transferred, by that device\'s driver.'],
      ['Hash chain', 'A linked list of the buffers whose (device, block) pairs hash to the same table slot. To find a block, the kernel searches only that one short chain.'],
      ['Delayed write', 'Leaving a modified buffer in the cache, marked dirty, and writing it to the disk later: when the buffer is about to be reused for another block, or when the cache is flushed.'],
      ['Character queue', 'A first-in, first-out queue of characters between a character device and a process. One side puts characters in, the other takes them out, and each character can be taken out only once.'],
      ['sync', 'The UNIX operation that writes every delayed-write buffer out to its disk. Classic systems ran it about every 30 seconds from a small background process.'],
    ],
    css: `
      .sec-11-8 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-11-8 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-8 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-8 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-11-8 .hot { cursor: pointer; }
      .sec-11-8 .hot:hover rect, .sec-11-8 .hot:focus rect { stroke-width: 3.5; }
      .sec-11-8 .hot:focus { outline: none; }
      .sec-11-8 .hot.on rect { stroke: var(--accent); stroke-width: 3.5; }
      .sec-11-8 .grid-2 > *, .sec-11-8 .mw0 > * { min-width: 0; }
      .sec-11-8 .log { font-size: 13px; }
      .sec-11-8 .lsrow, .sec-11-8 .lshead { display: grid; grid-template-columns: 44px 100px 110px minmax(0, 1fr); gap: 8px; align-items: center; text-align: left; font-family: var(--mono); }
      .sec-11-8 .lshead { padding: 0 12px; }
      .sec-11-8 .lsrow { width: 100%; height: 32px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--ink); font-size: 14.5px; cursor: pointer; }
      .sec-11-8 .lsrow:hover { border-color: var(--accent); }
      .sec-11-8 .lsrow.on { background: var(--accent-bg); border-color: var(--accent); }
      .sec-11-8 .lsrow .nm { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sec-11-8 .lsrow .mj { color: var(--os); font-weight: 700; }
      .sec-11-8 .mcell { width: 100%; max-width: 120px; height: 44px; border: 2px solid var(--line-2); border-radius: 9px; background: var(--panel); color: var(--ink); font-size: 18px; font-weight: 800; cursor: pointer; }
      .sec-11-8 .mcell:hover { border-color: var(--accent); }
      .sec-11-8 .mcell.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
      .sec-11-8 .mcell.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
      .sec-11-8 .mcell.miss { border-style: dashed; border-color: var(--warn); color: var(--warn); font-size: 13px; }
      .sec-11-8 table.mtable td { padding: 6px 8px; }
      .sec-11-8 table.tbl td, .sec-11-8 table.tbl th { vertical-align: middle; }
      .sec-11-8 .flip-face.front { font-size: 18px; }
      .sec-11-8 .flip-face.back { font-size: 15px; line-height: 1.42; }
    `,
    steps: [
      {
        title: 'One interface for every device',
        kind: 'story',
        html: `
          <div class="split fill" style="grid-template-columns:minmax(0,5fr) minmax(0,6fr)">
            <div class="stack" style="gap:9px">
              <p class="lead m0">A disk, a keyboard, a printer and a tape drive have almost nothing in common. Yet a UNIX program talks to all of them in exactly the same way.</p>
              <p class="m0">Each I/O device has a <span class="t">special file</span>: a name such as <code>/dev/term/a</code> that sits in the file system beside ordinary files. Programs open, read and write it exactly like a text file, and the kernel passes the work to the right <span class="t">device driver</span>.</p>
              <p class="m0">Under that clean surface the kernel moves data in one of two ways. <span class="t">Buffered I/O</span> goes through kernel buffers: the <span class="t">buffer cache</span> for disks and tapes, <span class="t">character queues</span> for terminals and printers. <span class="t">Unbuffered I/O</span> skips the kernel buffers and lets <span class="t">DMA</span> move data straight between the device and the process.</p>
              <div class="callout analogy m0" data-label="Analogy">A hotel front desk: every guest asks the same way, by phone, and the desk decides whether to call housekeeping, the kitchen or the garage.</div>
              <div class="row gap-s small"><span class="chip os">browse /dev</span><span class="chip mem">run the buffer cache</span><span class="chip io">fill a character queue</span><span class="chip proc">buffered vs unbuffered</span><span class="chip accent">sort the devices</span></div>
            </div>
            <div class="card stack" style="gap:8px">
              <h4 class="m0">The UNIX I/O structure · click any layer</h4>
              <div class="card white tight map" style="padding:6px 8px"></div>
              <div class="card white tight grow detail" style="display:flex;flex-direction:column;gap:5px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const W = slim ? 360 : 580;
          const svg = s('svg', { viewBox: `0 0 ${W} 300`, width: '100%' });
          const parts = {
            proc: ['Your process', 'proc', 'A process never needs to know what kind of device it is using. It calls <code>open</code>, <code>read</code>, <code>write</code> and <code>close</code> on a name. For a device, that name is a <span class="t">special file</span>.', 'Step 2 lets you browse some.'],
            fs: ['File subsystem', 'os', 'Looks up the name. For an ordinary file it finds the file\'s blocks on disk. For a special file it reads the type (block or character) and two numbers: the <span class="t">major device number</span> picks the driver and the <span class="t">minor device number</span> tells the driver which unit.', 'Step 2.'],
            bc: ['Buffer cache', 'mem', 'A pool of main-memory buffers, each holding a copy of one disk block. Disks and tapes read and write through it, so a block that was used a moment ago can be handed over without touching the device at all.', 'Steps 3 and 4: its lists, its hash table, and a working simulator.'],
            cq: ['Character queues', 'mem', 'First-in, first-out queues of characters for terminals, communication lines and printers. One side puts characters in and the other takes them out, and each character can be read only once.', 'Step 5.'],
            raw: ['Unbuffered path', 'os', 'No kernel buffer at all: <span class="t">DMA</span> moves the data straight between the device and the process\'s own memory. It is the fastest path, but the process has to stay locked in main memory until the transfer ends.', 'Step 6 races it against the buffered path.'],
            drv: ['Device drivers', 'os', 'Each <span class="t">device driver</span> knows the commands of one kind of device. The buffer cache, the character queues and the unbuffered path all end up calling a driver, which programs the device and fields its interrupts.', 'The major number picks which driver.'],
            dev: ['Devices', 'io', 'Disks and tapes store numbered blocks (<span class="t">block devices</span>). Terminals, communication lines and printers send or receive streams of bytes (<span class="t">character devices</span>).', 'Step 7: you sort them by the paths they use.'],
          };
          const L = slim
            ? { proc: [90, 6, 180, 36], fs: [60, 60, 240, 36], bc: [6, 128, 110, 50], cq: [125, 128, 110, 50], raw: [244, 128, 110, 50], drv: [60, 198, 240, 36], dev: [6, 254, 348, 40] }
            : { proc: [190, 6, 200, 36], fs: [150, 60, 280, 36], bc: [20, 128, 170, 50], cq: [205, 128, 170, 50], raw: [390, 128, 170, 50], drv: [150, 198, 280, 36], dev: [20, 254, 540, 40] };
          const label = {
            proc: ['Your process', 'open · read · write · close'],
            fs: ['File subsystem', 'names and special files'],
            bc: ['Buffer cache', 'disks, tapes'],
            cq: slim ? ['Char. queues', 'terminals…'] : ['Character queues', 'terminals, printers'],
            raw: slim ? ['Unbuffered', 'DMA direct'] : ['Unbuffered', 'DMA straight to process'],
            drv: ['Device drivers', 'one per kind of device'],
            dev: [slim ? 'Devices: disk · tape · tty · printer' : 'Devices: disk · tape · terminal · comm line · printer'],
          };
          const detail = ctx.$('.detail');
          const boxes = {};
          let cur = null;
          function show(k) {
            cur = k;
            Object.entries(boxes).forEach(([j, g]) => g.classList.toggle('on', j === k));
            const [name, cls, txt, where] = parts[k];
            detail.innerHTML = '';
            detail.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, name), h('span', { class: 'chip ' + cls }, k === 'bc' || k === 'cq' ? 'buffered I/O' : k === 'raw' ? 'unbuffered I/O' : 'every request')),
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: txt }),
              h('p', { class: 'small muted m0', style: { marginTop: 'auto' } }, h('b', {}, 'Where: '), where));
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
          }
          const kids = [];
          const mid = (r) => r[0] + r[2] / 2;
          const arrow = (x1, y1, x2, y2) => s('line', { x1, y1, x2, y2, class: 's-line', 'marker-end': 'url(#arr)' });
          kids.push(arrow(W / 2, 42, W / 2, 58));
          ['bc', 'cq', 'raw'].forEach((k) => {
            kids.push(arrow(W / 2, 96, mid(L[k]), 126));
            kids.push(arrow(mid(L[k]), 178, W / 2 + (mid(L[k]) - W / 2) * 0.35, 196));
          });
          kids.push(arrow(W / 2, 234, W / 2, 252));
          const bx = L.bc[0] - 4, bw = L.cq[0] + L.cq[2] - L.bc[0] + 8;
          kids.push(s('rect', { x: bx, y: 120, width: bw, height: 64, rx: 12, fill: 'none', style: 'stroke:var(--mem)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
          kids.push(s('text', { x: bx + 2, y: 114, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--mem)' }, 'buffered I/O'));
          Object.keys(parts).forEach((k) => {
            const r = L[k];
            const g = hotBox(ctx, { x: r[0], y: r[1], w: r[2], h: r[3], text: label[k], cls: 's-' + parts[k][1], fs: slim ? 13.5 : 15, dash: k === 'raw' ? '6 4' : null, label: parts[k][0], onClick: () => show(k) });
            boxes[k] = g;
            kids.push(g);
          });
          svg.replaceChildren(...kids);
          ctx.$('.map').append(svg);
          show('fs');
        },
      },

      {
        title: 'Special files: devices that live in the file system',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const PATH = {
            bc: ['buffer cache', 'mem'], cq: ['character queues', 'io'], raw: ['unbuffered (raw)', 'os'], none: ['no device at all', 'warn'],
          };
          const files = [
            { name: '/dev/dsk/0s1', t: 'b', maj: 7, min: 1, path: 'bc', what: 'Disk 0, partition 1, used through its <b>block</b> interface.',
              drv: 'the disk driver', unit: 'disk 0, partition 1', cmd: 'mount /dev/dsk/0s1 /home', cmdWhy: 'Mounts the file system on that partition. Every block the file system reads or writes then goes through the <span class="t">buffer cache</span>.' },
            { name: '/dev/rdsk/0s1', t: 'c', maj: 13, min: 1, path: 'raw', what: 'The <b>same</b> partition through its <span class="t">raw device</span>. Note the r in the name and the type c.',
              drv: 'the raw side of the disk driver', unit: 'disk 0, partition 1', cmd: 'dd if=/dev/rdsk/0s1 of=/dev/rmt/0 bs=64k', cmdWhy: 'Copies the whole partition to tape in big chunks. Neither side uses the buffer cache: DMA moves each chunk straight between the device and the program\'s memory.' },
            { name: '/dev/rmt/0', t: 'c', maj: 22, min: 0, path: 'raw', what: 'Tape drive 0, raw interface. (Older systems also offered a block tape file that went through the buffer cache.)',
              drv: 'the tape driver', unit: 'tape drive 0', cmd: 'tar cf /dev/rmt/0 /home', cmdWhy: 'Writes an archive of /home onto the tape, one large record after another.' },
            { name: '/dev/term/a', t: 'c', maj: 3, min: 0, path: 'cq', what: 'Serial line a, with a terminal (keyboard plus screen) plugged into it.',
              drv: 'the serial-line driver', unit: 'line a (line 0)', cmd: 'echo "Lunch is ready" > /dev/term/a', cmdWhy: 'The words appear on that terminal\'s screen. To the shell this is just output redirected to a file.' },
            { name: '/dev/tty', t: 'c', maj: 5, min: 0, perm: 'rw-rw-rw-', path: 'cq', what: 'Whatever terminal the current process is attached to: a nickname that means "my own terminal".',
              drv: 'the controlling-terminal driver', unit: 'the caller\'s own terminal', cmd: 'read answer < /dev/tty', cmdWhy: 'Asks the person at the keyboard for a line even when the script\'s normal input is coming from a file.' },
            { name: '/dev/lp', t: 'c', maj: 6, min: 0, path: 'cq', what: 'The line printer on the first parallel port.',
              drv: 'the printer driver', unit: 'printer 0', cmd: 'cat report.txt > /dev/lp', cmdWhy: 'Prints the file. <code>cat</code> has no idea it is talking to a printer; it just writes bytes to a file.' },
            { name: '/dev/null', t: 'c', maj: 2, min: 2, perm: 'rw-rw-rw-', path: 'none', what: 'Not hardware at all. Its tiny driver throws away everything written to it, and a read always reports end of file.',
              drv: 'the memory-device driver', unit: 'unit 2: the "null" device', cmd: 'make 2> /dev/null', cmdWhy: 'Runs make and discards its error messages. A special file only needs a driver behind it, not a real device.' },
          ];
          let cur = 0;
          const list = h('div', { class: 'stack', style: { gap: '4px' }, role: 'listbox', 'data-keys': '1', 'aria-label': 'Special files in /dev' });
          const cols = ctx.narrow ? '26px 64px minmax(0, 1fr)' : '44px 100px 110px minmax(0, 1fr)';
          const rows = files.map((f, i) => h('button', { type: 'button', class: 'lsrow', role: 'option', style: { gridTemplateColumns: cols }, onclick: () => pick(i) },
            h('span', { style: { color: f.t === 'b' ? 'var(--mem)' : 'var(--io)', fontWeight: 800 } }, f.t), ctx.narrow ? null : h('span', {}, f.perm || 'rw-rw----'),
            h('span', { class: 'mj' }, `${f.maj}, ${f.min}`), h('span', { class: 'nm' }, f.name)));
          list.append(...rows);
          list.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault(); e.stopPropagation();
            pick((cur + (e.key === 'ArrowDown' ? 1 : files.length - 1)) % files.length); rows[cur].focus();
          });
          const detail = h('div', { class: 'card white stack', style: { gap: '7px' } });
          function pick(i) {
            cur = i;
            const f = files[i];
            rows.forEach((r, j) => { r.classList.toggle('on', j === i); r.setAttribute('aria-selected', j === i); });
            const [pName, pCls] = PATH[f.path];
            detail.innerHTML = '';
            detail.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'mono', style: { fontSize: '18px' } }, f.name),
                h('span', { class: 'chip ' + (f.t === 'b' ? 'mem' : 'io') }, f.t === 'b' ? 'type b: block special' : 'type c: character special')),
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: f.what }),
              h('div', { class: 'grid-2', style: { gap: '8px' } },
                h('div', { class: 'card tight small', html: `<b>Major ${f.maj}</b> → picks the driver: ${f.drv}.` }),
                h('div', { class: 'card tight small', html: `<b>Minor ${f.min}</b> → tells the driver which unit: ${f.unit}.` })),
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Data path:'), h('span', { class: 'chip ' + pCls }, pName)),
              h('div', { class: 'mono small', style: { background: 'var(--panel-3)', borderRadius: '8px', padding: '5px 10px' } }, '$ ' + f.cmd),
              h('p', { class: 'small m0', html: f.cmdWhy }));
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
          }
          const code = ctx.ui.code(`
fd = open("/dev/term/a", O_RDWR); // open it like any file
write(fd, "Hello\\n", 6);          // shows on that screen
n = read(fd, line, 80);           // waits for a typed line
close(fd);                        // done, as with a file`, { lang: 'c', fontSize: 13.5 });
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 10fr)', gap: '22px' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'Part of an <code>ls -l /dev</code> listing. Where a normal file shows its size, a <span class="t">special file</span> shows two numbers: its <span class="t">major device number</span> and <span class="t">minor device number</span>. The first letter is the type: b for a <span class="t">block special file</span>, c for a <span class="t">character special file</span>. Click a row (or use ↑ ↓).' }),
              h('div', { class: 'lshead xs muted mono', style: { gridTemplateColumns: cols } }, h('span', {}, ctx.narrow ? '' : 'type'), ctx.narrow ? null : h('span', {}, 'access'), h('span', {}, ctx.narrow ? 'maj,min' : 'major, minor'), h('span', {}, 'name')),
              list,
              h('p', { class: 'xs muted m0' }, 'Names follow classic System V style; the numbers are made up, since every system assigns its own. Linux uses names such as /dev/sda1, /dev/ttyS0 and /dev/lp0.'),
              code),
            h('div', { class: 'stack', style: { gap: '10px' } },
              detail,
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Because devices look like files, every tool that reads or writes files (<code>cat</code>, <code>cp</code>, shell redirection with &gt;) already works with every device. Access rights work the same way too: rw-rw---- keeps the printer and the raw disk for their owner and group, while /dev/null is open to everyone (rw-rw-rw-).' }))));
          pick(0);
        },
      },

      {
        title: 'Inside the buffer cache: headers, lists, a hash table',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const st0 = initCache();
          const chipsOf = (ids) => ids.map((id) => `<span class="chip mem mono">b${id} ${bufLabel(st0.bufs[id])}</span>`).join(' ');
          // ---- tab 1: one buffer header, with clickable fields
          function tabHeader(p) {
            const F = [
              ['dev', 'Device number', '0', 'Which device the block comes from. Every disk numbers its blocks from 0, so a block number alone is ambiguous: the pair (device, block) names exactly one block.'],
              ['blk', 'Block number', '9', 'Which block of that device this buffer holds a copy of.'],
              ['st', 'Status flags', 'valid · delayed write', '<b>Busy</b>: a process is using the buffer now, so others must wait. <b>Valid</b>: the data area really holds that block. <b>Delayed write</b> (dirty): the copy here is newer than the one on disk and must be written out before the buffer is reused. <b>I/O in progress</b>: the driver is transferring it.'],
              ['ptr', 'Data pointer', '→ data area', 'Where the data area is: a block-sized piece of main memory that holds the copy of the disk block. The header is small; the data area is the big part.'],
              ['hq', 'Hash chain links', 'prev · next', 'Links to the other buffers on the same <span class="t">hash chain</span>, so the kernel can find a block by searching one short list (tab 3).'],
              ['fl', 'Free list links', 'prev · next', 'Links to the neighbours on the <span class="t">free list</span>, where buffers that nobody is using wait in least-recently-used order (tab 2).'],
            ];
            const W = slim ? 360 : 560;
            const svg = s('svg', { viewBox: `0 0 ${W} 326`, width: '100%' });
            const det = h('div', { class: 'card white stack', style: { gap: '6px', minHeight: '150px' } });
            const gs = [];
            function pick(i) {
              gs.forEach((g, j) => g.classList.toggle('on', i === j));
              det.innerHTML = '';
              det.append(h('b', { style: { fontSize: '17px' } }, F[i][1]), h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: F[i][3] }));
            }
            const fw = slim ? 200 : 260, fx = 14;
            const RY = (i) => 38 + i * 47;
            const kids = [s('rect', { x: 4, y: 4, width: fw + 20, height: 318, rx: 12, class: 's-os', 'stroke-width': 2 }),
              s('text', { x: fx, y: 24, 'font-weight': 800, 'font-size': 15 }, 'Buffer header of b1')];
            F.forEach((f, i) => {
              const g = hotBox(ctx, { x: fx, y: RY(i), w: fw, h: 39, text: [f[1] + ': ' + f[2]], cls: 's-panel', fs: slim ? 12.5 : 14, label: f[1], onClick: () => pick(i) });
              gs.push(g); kids.push(g);
            });
            const ax = fx + fw + 6, dx = slim ? 236 : 330, dw = W - dx - 6;
            kids.push(s('line', { x1: ax, y1: RY(3) + 19, x2: dx - 2, y2: 70, class: 's-line', 'marker-end': 'url(#arr-mem)' }));
            kids.push(s('rect', { x: dx, y: 30, width: dw, height: 92, rx: 10, class: 's-mem', 'stroke-width': 2 }));
            kids.push(s('text', { x: dx + dw / 2, y: 64, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14.5 }, 'Data area'));
            kids.push(s('text', { x: dx + dw / 2, y: 86, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, slim ? 'one block' : 'copy of disk 0, block 9'));
            kids.push(s('text', { x: dx + dw / 2, y: 106, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, slim ? 'of data' : '(one block of bytes)'));
            kids.push(s('line', { x1: ax, y1: RY(4) + 19, x2: dx - 2, y2: RY(4) + 19, class: 's-line', 'marker-end': 'url(#arr)' }));
            kids.push(s('text', { x: dx + 2, y: RY(4) + 24, 'font-size': 13 }, slim ? 'slot 1 chain' : 'other buffers of hash slot 1'));
            kids.push(s('line', { x1: ax, y1: RY(5) + 19, x2: dx - 2, y2: RY(5) + 19, class: 's-line', 'marker-end': 'url(#arr)' }));
            kids.push(s('text', { x: dx + 2, y: RY(5) + 24, 'font-size': 13 }, slim ? 'b5 ← b1 → b3' : 'neighbours: b5 ← b1 → b3'));
            svg.replaceChildren(...kids);
            p.append(h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 6fr) minmax(0, 5fr)', gap: '18px', height: 'auto' } },
              h('div', { class: 'card white tight' }, svg),
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('p', { class: 'small m0', html: 'Every buffer has a <span class="t">buffer header</span>, a small record the kernel uses to find and manage it. Click a field.' }),
                det,
                h('div', { class: 'callout tip small m0', 'data-label': 'Picture it', html: 'The header is a luggage tag; the data area is the suitcase. The kernel sorts, searches and queues the tags, and only touches the suitcase when bytes really move.' }))));
            pick(0);
          }
          // ---- tab 2: the three lists
          function tabLists(p) {
            const byDev = [0, 1].map((d) => st0.bufs.filter((b) => b.valid && b.dev === d).map((b) => b.id));
            p.append(h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'grid-3', style: { gap: '12px' } },
                h('div', { class: 'card stack', style: { gap: '6px' } }, h('b', { html: '1 · <span class="t">Free list</span>' }),
                  h('div', { class: 'small', html: '<span class="xs muted">head (LRU) →</span> ' + chipsOf(st0.free) + ' <span class="xs muted">← tail</span>' }),
                  h('p', { class: 'small m0', html: 'Buffers no process is using right now. A buffer a process has finished with joins the <b>tail</b>. A buffer needed for a new block is taken from the <b>head</b>: the one unused for longest, which is <span class="t">LRU</span> replacement.' })),
                h('div', { class: 'card stack', style: { gap: '6px' } }, h('b', { html: '2 · <span class="t">Device list</span>' }),
                  h('div', { class: 'small', html: `<div>disk 0: ${chipsOf(byDev[0])}</div><div style="margin-top:4px">disk 1: ${chipsOf(byDev[1])}</div>` }),
                  h('p', { class: 'small m0', html: 'For each disk, every buffer currently tied to it, busy or free. It lets the kernel find all of one disk\'s buffers, for example to write them out before that disk is removed.' })),
                h('div', { class: 'card stack', style: { gap: '6px' } }, h('b', {}, '3 · Driver I/O queue'),
                  h('div', { class: 'small' }, h('div', {}, 'disk 0: ', h('span', { class: 'muted' }, 'empty')), h('div', { style: { marginTop: '4px' } }, 'disk 1: ', h('span', { class: 'muted' }, 'empty'))),
                  h('p', { class: 'small m0', html: 'For each device, the buffers being transferred or waiting their turn. A buffer joins when a read misses or a delayed write is finally sent, and leaves when the driver\'s interrupt says the transfer is done.' }))),
              h('div', { class: 'callout why small m0', 'data-label': 'One buffer, several lists', html: 'Buffer b1 (disk 0, block 9) is on the free list, on hash chain 1 and on disk 0\'s device list all at the same time. Because a free buffer <b>keeps its data</b>, a later request for that block can still find it and get a hit, right up until the buffer is taken for another block.' }),
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking the free list holds empty buffers. Most of them hold perfectly good blocks; "free" only means no process is using the buffer this instant.' })));
          }
          // ---- tab 3: hash calculator
          function tabHash(p) {
            let dev = 0, blk = 9;
            const out = h('div', { class: 'stack', style: { gap: '6px' } });
            const svg = s('svg', { viewBox: `0 0 ${slim ? 360 : 470} 196`, width: '100%' });
            function draw() {
              const r = searchChain(st0, dev, blk);
              const kids = [];
              const bw = slim ? 84 : 104, gap = slim ? 18 : 26;
              for (let k = 0; k < NSLOT; k++) {
                const y = 8 + k * 47, on = k === r.slot;
                kids.push(s('rect', { x: 4, y, width: 70, height: 36, rx: 8, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 3 : 2 }));
                kids.push(s('text', { x: 39, y: y + 23, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14 }, 'slot ' + k));
                let x = 74;
                st0.chains[k].forEach((id) => {
                  const b = st0.bufs[id], seen = on && r.seen.includes(id), hit = r.hit === id;
                  kids.push(s('line', { x1: x, y1: y + 18, x2: x + gap - 2, y2: y + 18, class: 's-line', 'marker-end': 'url(#arr)' }));
                  x += gap;
                  kids.push(s('rect', { x, y, width: bw, height: 36, rx: 8, class: hit ? 's-ok' : seen ? 's-bad' : 's-mem', 'stroke-width': hit || seen ? 3 : 2 }));
                  kids.push(s('text', { x: x + bw / 2, y: y + 23, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, `b${id} ${bufLabel(b)}`));
                  x += bw;
                });
                if (!st0.chains[k].length) kids.push(s('text', { x: 86, y: y + 23, class: 's-sub', 'font-size': 13 }, 'empty chain'));
              }
              svg.replaceChildren(...kids);
              const cmp = r.seen.map((id) => `b${id} holds ${bufLabel(st0.bufs[id])} ${r.hit === id ? '✓' : '✗'}`).join(', ');
              out.innerHTML = '';
              out.append(
                h('div', { class: 'mono', style: { fontSize: '15px' }, html: `hash = (device + block) mod 4<br>&nbsp;&nbsp;&nbsp;&nbsp; = (${dev} + ${blk}) mod 4 = <b>${r.slot}</b>` }),
                h('div', { class: 'narr ' + (r.hit != null ? 'ok' : 'warn'), html: r.hit != null
                  ? `Search chain ${r.slot}: ${cmp}. <b>Found</b> in b${r.hit} after ${r.seen.length} comparison${r.seen.length > 1 ? 's' : ''}: a cache hit, no disk access.`
                  : `Search chain ${r.slot}: ${cmp || 'nothing to compare (empty chain)'}. <b>Not in the cache</b>: a miss. The kernel will take the buffer at the head of the free list and read the block from disk.` }));
            }
            const devSeg = ctx.ui.seg([{ value: 0, label: 'disk 0' }, { value: 1, label: 'disk 1' }], dev, (v) => { dev = v; draw(); });
            const blkSl = ctx.ui.slider({ label: 'Block', min: 0, max: 31, value: blk, onInput: (v) => { blk = v; draw(); } });
            p.append(h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 6fr)', gap: '18px', height: 'auto' } },
              h('div', { class: 'stack', style: { gap: '9px' } },
                h('p', { class: 'small m0', html: 'A real cache has thousands of buffers; checking them all on every request would be slow. Instead a <span class="t">hash function</span> turns (device, block) into one of a few slots, and only that slot\'s <span class="t">hash chain</span> is searched.' }),
                h('div', { class: 'row' }, devSeg), blkSl, out,
                h('p', { class: 'xs muted m0' }, 'This is a toy hash with four slots. Real kernels use many more slots and a function that mixes the two numbers more thoroughly, so chains stay short.')),
              h('div', { class: 'stack', style: { gap: '6px' } },
                h('div', { class: 'card white tight' }, svg),
                h('p', { class: 'xs muted m0' }, 'Pairs that land in the same slot collide; their buffers are simply linked one after another (separate chaining). Try disk 1, block 7: same slot as disk 0, block 4.'),
                h('div', { class: 'callout tip small m0', 'data-label': 'Why compare both numbers?', html: 'Different (device, block) pairs can share a slot, so landing in the right slot proves nothing. Each buffer on the chain is checked for the same device <b>and</b> the same block, which is why block 4 of disk 0 can never be mistaken for block 3 of disk 1.' }))));
            draw();
          }
          // ---- tab 4: what a read and a write do
          const tabRW = `<div class="grid-2" style="gap:14px">
            <div class="card stack" style="gap:6px"><b>Reading a block</b>
              <ol class="small m0" style="padding-left:20px;line-height:1.45">
                <li>Hash (device, block) and search that chain.</li>
                <li><b>Hit:</b> take the buffer (it is marked busy) and copy the bytes to the process.</li>
                <li><b>Miss:</b> take the first clean buffer from the <b>head</b> of the free list, give it the new (device, block), and put it on the <span class="t">driver I/O queue</span>. The disk fills it by DMA; then the bytes are copied to the process.</li>
                <li>Release: the buffer joins the <b>tail</b> of the free list, as the most recently used.</li>
              </ol></div>
            <div class="card stack" style="gap:6px"><b>Writing a block</b>
              <ol class="small m0" style="padding-left:20px;line-height:1.45">
                <li>Find or obtain the buffer exactly as for a read. (Changing only part of a block means reading the block in first.)</li>
                <li>Copy the process's bytes into the buffer and mark it <span class="t">delayed write</span>. The process carries on at once.</li>
                <li>The disk copy is updated later: when the buffer reaches the head of the free list and is about to be reused, or when <span class="t">sync</span> flushes every delayed write (classic UNIX ran it about every 30 seconds).</li>
              </ol></div>
          </div>
          <div class="callout warn small" style="margin-top:10px" data-label="The price of delayed write">A crash before the write loses the change. That is why sync runs regularly and why careful programs (databases, editors saving a file) force an immediate write with <code>fsync</code>.</div>
          <div class="callout small m0" data-label="Honest history">The disk fills a buffer by DMA; the copy between buffer and process is memory to memory, made by the processor in UNIX kernels (some descriptions say DMA). This is the classic design of the 1970s and 1980s, up to System V Release 3. SVR4 caches file data in virtual-memory pages instead and keeps the buffer cache mainly for file-system bookkeeping (the records that describe files); Linux merged its buffer cache into one <span class="t">page cache</span> (section 11.9).</div>`;
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
            h('p', { class: 'm0', html: 'The <span class="t">buffer cache</span> is a pool of buffers in main memory, each able to hold one disk block. Explore the four tabs: what a buffer looks like, the lists that track it, how a block is found, and what reads and writes do.' }),
            h('div', { class: 'grow' }, ctx.ui.tabs([
              { label: 'Buffer header', render: tabHeader },
              { label: 'Three lists', render: tabLists },
              { label: 'Finding a block', render: tabHash },
              { label: 'Reads and writes', html: tabRW },
            ]))));
        },
      },

      {
        title: 'Buffer cache lab: hits, misses, LRU and delayed writes',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const NOTICE = [
            'Tour 1/7 · A <b>hit</b>: the block is already cached, so no disk access at all.',
            'Tour 2/7 · A <b>miss</b>, but the head of the free list is an empty buffer, so nothing has to leave.',
            'Tour 3/7 · A miss where the LRU buffer is <b>dirty</b>: delayed write in action.',
            'Tour 4/7 · The buffer written in the background still holds its block: a hit.',
            'Tour 5/7 · A <b>write hit</b>: the change stays in memory and the buffer turns amber.',
            'Tour 6/7 · Block d0:4 was thrown out in request 3, so asking for it again is a miss.',
            'Tour 7/7 · <span class="t">sync</span> flushes every remaining delayed write.',
          ];
          let st, tour, focus = null, hot = [];
          let dev = 0, blk = 12, write = false;
          const svg = s('svg', { viewBox: slim ? '0 0 360 420' : '0 0 630 412', width: '100%' });
          const head = h('div', { class: 'row gap-s', style: { justifyContent: 'space-between', minHeight: '26px' } });
          const notice = h('div', { class: 'small', style: { minHeight: '20px' } });
          const evList = h('ol', { class: 'm0 small', style: { paddingLeft: '20px', lineHeight: 1.42 } });
          const evBox = h('div', { class: slim ? '' : 'scroll-y grow' }, evList);
          const stats = h('div', { class: 'grid-3', style: { gap: '6px' } });
          const devList = h('div', { class: 'small', style: { lineHeight: 1.6 } });
          const tourBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => tourStep() });
          // ---- drawing
          function bufBox(kids, id, x, y, w, ht, small) {
            const b = st.bufs[id], f = focus === id, warm = hot.includes(id);
            kids.push(s('rect', { x, y, width: w, height: ht, rx: 8, class: !b.valid ? 's-panel' : b.dirty ? 's-warn' : 's-mem', 'stroke-width': f || warm ? 3.5 : 2, style: f ? 'stroke:var(--accent)' : null, 'stroke-dasharray': b.valid ? null : '5 4' }));
            if (small) {
              kids.push(s('text', { x: x + w / 2, y: y + 17, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, 'b' + id));
              kids.push(s('text', { x: x + w / 2, y: y + 32, 'text-anchor': 'middle', 'font-size': 11.5 }, bufLabel(b)));
            } else kids.push(s('text', { x: x + w / 2, y: y + ht / 2 + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, `b${id} · ${bufLabel(b)}`));
          }
          function draw() {
            const kids = [];
            const G = slim
              ? { top: 14, rowY: (k) => 24 + k * 50, rowH: 40, slotW: 44, bw: 44, gap: 8, flT: 236, flY: 246, flW: 52, flStep: 60, flH: 40, ioT: 318, ioY: (d) => 330 + d * 44, ioX: 64, ioW: 52 }
              : { top: 16, rowY: (k) => 26 + k * 50, rowH: 40, slotW: 56, bw: 80, gap: 14, flT: 250, flY: 260, flW: 92, flStep: 104, flH: 42, ioT: 352, ioY: (d) => 330 + d * 42, ioX: 150, ioW: 84 };
            kids.push(s('text', { x: 4, y: G.top, 'font-weight': 700, 'font-size': 14 }, slim ? 'Hash table · (dev + block) mod 4' : 'Hash table · slot = (device + block) mod 4'));
            for (let k = 0; k < NSLOT; k++) {
              const y = G.rowY(k);
              kids.push(s('rect', { x: 2, y, width: G.slotW - 4, height: G.rowH, rx: 8, class: 's-os', 'stroke-width': 2 }));
              kids.push(s('text', { x: G.slotW / 2, y: y + G.rowH / 2 + 5, 'text-anchor': 'middle', 'font-size': slim ? 12 : 14, 'font-weight': 700 }, 'slot ' + k));
              let x = G.slotW - 2;
              st.chains[k].forEach((id) => {
                kids.push(s('line', { x1: x, y1: y + G.rowH / 2, x2: x + G.gap - 1, y2: y + G.rowH / 2, class: 's-line', 'marker-end': slim ? null : 'url(#arr)' }));
                x += G.gap;
                bufBox(kids, id, x, y, G.bw, G.rowH, slim);
                x += G.bw;
              });
            }
            kids.push(s('text', { x: 4, y: G.flT, 'font-weight': 700, 'font-size': 14 }, slim ? 'Free list (head = next victim)' : 'Free list · head = least recently used (next victim) · tail = just used'));
            st.free.forEach((id, i) => {
              const x = 2 + i * G.flStep;
              bufBox(kids, id, x, G.flY, G.flW, G.flH, slim);
              if (i < st.free.length - 1) kids.push(s('text', { x: x + G.flW + (G.flStep - G.flW) / 2, y: G.flY + G.flH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, '›'));
            });
            if (st.free.length) {
              kids.push(s('text', { x: 2 + G.flW / 2, y: G.flY + G.flH + 16, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'head'));
              kids.push(s('text', { x: 2 + (st.free.length - 1) * G.flStep + G.flW / 2, y: G.flY + G.flH + 16, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'tail'));
            }
            kids.push(s('text', { x: 4, y: slim ? G.ioT : G.ioT, 'font-weight': 700, 'font-size': 14 }, slim ? 'Driver I/O queues' : 'Driver I/O queues'));
            [0, 1].forEach((d) => {
              const x0 = slim ? 4 : G.ioX, y = slim ? G.ioY(d) + 4 : G.ioY(d);
              const n = st.ioq[d].length, room = (slim ? 356 : 626) - (x0 + 58);
              const w = Math.min(G.ioW, Math.floor(room / Math.max(n, 1)) - 6);
              kids.push(s('text', { x: x0, y: y + 22, 'font-size': 14 }, `disk ${d}:`));
              if (!n) kids.push(s('text', { x: x0 + 58, y: y + 22, 'font-size': 13.5, class: 's-sub' }, 'idle: nothing being written'));
              st.ioq[d].forEach((id, i) => {
                const x = x0 + 58 + i * (w + 6);
                kids.push(s('rect', { x, y, width: w, height: 32, rx: 8, class: 's-io', 'stroke-width': 2.5 }));
                kids.push(s('text', { x: x + w / 2, y: y + 21, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, w >= 80 ? `b${id} writing` : 'b' + id));
              });
            });
            svg.replaceChildren(...kids);
            const S = st.stats;
            const tile = (v, l, cls) => h('div', { class: 'card tight center', style: { padding: '4px 6px' } }, h('div', { class: 'b num', style: { fontSize: '19px', color: cls ? `var(--${cls})` : null } }, String(v)), h('div', { class: 'xs muted' }, l));
            stats.replaceChildren(tile(S.req, 'requests'), tile(S.hit, 'hits', 'ok'), tile(S.miss, 'misses', 'warn'),
              tile(S.req ? Math.round((100 * S.hit) / S.req) + '%' : '—', 'hit ratio'), tile(S.rd, 'disk reads', 'io'), tile(S.wr, 'disk writes', 'io'));
            devList.innerHTML = '<b>Device lists</b> · ' + [0, 1].map((d) => `disk ${d}: ` + (st.bufs.filter((b) => b.valid && b.dev === d).map((b) => 'b' + b.id).join(' ') || 'none')).join(' · ');
          }
          // ---- narration built from the engine's events
          function say(e) {
            const b = (id) => 'b' + id;
            switch (e.t) {
              case 'done': return `First, the write of ${b(e.id)} that started earlier finishes: ${b(e.id)} is clean and goes back to the <b>head</b> of the free list, still holding ${bufLabel(st.bufs[e.id])}.`;
              case 'hash': {
                const cmp = e.seen.map((id) => `${id === e.hit ? (e.hitLabel || '') : (e.labels[id] || '')}`).join(', ');
                return `hash = (${e.dev} + ${e.blk}) mod 4 = <b>${e.slot}</b>. Chain ${e.slot}: ${cmp || 'empty'} → ` + (e.hit != null ? `<b style="color:var(--ok)">hit</b> in ${b(e.hit)}, no disk access.` : '<b style="color:var(--warn)">miss</b>.');
              }
              case 'skip': return `Head ${b(e.id)} (${e.old}) is a <span class="t">delayed write</span>, so it is not reused yet: its write starts (it joins disk ${e.dev}'s <span class="t">driver I/O queue</span>) and the kernel tries the next buffer.`;
              case 'wait': return `Every free buffer was dirty, so the process waited for the write of ${b(e.id)} to finish, then used it.`;
              case 'evict': return `Head ${b(e.id)} is clean, so it is taken: its old block ${e.old} leaves the cache. That is <span class="t">LRU</span> replacement.`;
              case 'fresh': return `Head ${b(e.id)} is empty, so it is taken and no block has to leave.`;
              case 'read': return `${b(e.id)} joins chain ${e.slot} and the disk driver reads the block into it by DMA (1 disk read)${e.w ? ', since only part of the block will change' : ''}.`;
              case 'dirty': return `The process's bytes are copied into ${b(e.id)}, which is marked <b>delayed write</b> (amber). Nothing goes to disk yet.`;
              case 'release': return `${b(e.id)} is released to the <b>tail</b> of the free list: now the most recently used.`;
              case 'sync': return e.ids.length ? `sync writes every delayed-write buffer (${e.ids.map(b).join(', ')}). They are clean now and their data stays cached.` : 'sync finds no delayed-write buffers, so nothing is written.';
              default: return '';
            }
          }
          function run(req) {
            // labels of the buffers on the chain BEFORE the request changes anything
            const labels = {};
            st.bufs.forEach((x) => { labels[x.id] = `${bufLabel(x)} ${x.dev === req[0] && x.blk === req[1] && x.valid ? '✓' : '✗'}`; });
            const res = req === 'sync' ? labSync(st) : labRequest(st, req[0], req[1], req[2]);
            focus = res.id;
            hot = res.ev.filter((e) => e.t === 'skip' || e.t === 'done').map((e) => e.id);
            res.ev.forEach((e) => {
              if (e.t === 'hash') Object.assign(e, { dev: req[0], blk: req[1], labels, hitLabel: e.hit != null ? labels[e.hit] : '' });
              if (e.t === 'skip') e.dev = st.bufs[e.id].dev;
              if (e.t === 'read') Object.assign(e, { slot: hashOf(req[0], req[1]), w: req[2] });
            });
            const hashEv = res.ev.find((e) => e.t === 'hash');
            const title = req === 'sync' ? 'sync' : `${req[2] ? 'Write' : 'Read'} disk ${req[0]}, block ${req[1]}`;
            head.replaceChildren(h('b', { style: { fontSize: '16px' } }, title),
              req === 'sync' ? h('span', { class: 'chip os' }, 'flush') : hashEv.hit != null ? h('span', { class: 'chip ok' }, 'hit') : h('span', { class: 'chip warn' }, 'miss'));
            evList.replaceChildren(...res.ev.map((e) => h('li', { html: say(e) })));
            draw();
          }
          function setTourBtn() {
            if (tour >= 0 && tour < TOUR.length) tourBtn.textContent = `Guided tour: request ${tour + 1} of ${TOUR.length} ▶`;
            else tourBtn.textContent = tour < 0 ? 'Restart guided tour' : 'Tour done · restart';
          }
          function tourStep() {
            if (tour < 0 || tour >= TOUR.length) { reset(); return; }
            const req = TOUR[tour];
            if (req !== 'sync') { dev = req[0]; blk = req[1]; write = req[2]; devSeg.set(dev); blkSl.set(blk); opSeg.set(write ? 'w' : 'r'); }
            notice.innerHTML = NOTICE[tour];
            run(req);
            tour++;
            setTourBtn();
          }
          function manual(req) {
            if (tour >= 0 && tour < TOUR.length) notice.innerHTML = 'Free play: the guided tour stops when you send your own requests.';
            else notice.innerHTML = '';
            tour = -1; setTourBtn();
            run(req);
          }
          function reset() {
            st = newLab(); tour = 0; focus = null; hot = [];
            head.replaceChildren(h('b', { style: { fontSize: '16px' } }, 'Six buffers, two disks'), h('span', { class: 'chip' }, 'start'));
            notice.innerHTML = 'Press the <b>guided tour</b> button seven times, or build your own requests.';
            evList.replaceChildren(h('li', { html: 'Amber b1 already holds a <b>delayed write</b>: block 9 of disk 0 changed in memory but not yet on disk.' }),
              h('li', { html: 'b5 is empty, and it sits at the head of the free list.' }));
            setTourBtn(); draw();
          }
          const devSeg = ctx.ui.seg([{ value: 0, label: 'disk 0' }, { value: 1, label: 'disk 1' }], dev, (v) => { dev = v; });
          const blkSl = ctx.ui.slider({ label: 'Block', min: 0, max: 31, value: blk, onInput: (v) => { blk = v; } });
          blkSl.style.minWidth = slim ? '220px' : '210px';
          const opSeg = ctx.ui.seg([{ value: 'r', label: 'Read' }, { value: 'w', label: 'Write' }], 'r', (v) => { write = v === 'w'; });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { gap: '10px' } }, devSeg, blkSl, opSeg,
              h('button', { class: 'btn sm', type: 'button', onclick: () => manual([dev, blk, write]) }, 'Send request'),
              h('span', { style: { flex: slim ? '0 0 100%' : '1' } }), tourBtn,
              h('button', { class: 'btn sm', type: 'button', onclick: () => manual('sync') }, 'sync'),
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, 'Reset')),
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '16px' } },
              h('div', { class: 'stack', style: { gap: '6px' } },
                h('div', { class: 'card white tight' }, svg),
                h('div', { class: 'row gap-s xs muted' }, h('span', { class: 'chip mem' }, 'clean'), h('span', { class: 'chip warn' }, 'delayed write'), h('span', { class: 'chip' }, 'empty'), h('span', { class: 'chip io' }, 'being written'), h('span', {}, 'Thick accent outline: the buffer this request used.'))),
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('div', { class: 'card tight stack grow', style: { gap: '4px', minHeight: slim ? 0 : '250px' } }, head, notice, evBox),
                stats, devList))));
          reset();
        },
      },

      {
        title: 'Character queues: produced once, consumed once',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const CAP = 8;
          const KEYS = 'ls -l⏎date⏎who⏎';
          const WORDS = ['Hi!⏎', 'Report⏎', 'Done⏎'];
          let mode = 'in', q, typed, word, got, pending, blocked, dropped, lastGot;
          const svg = s('svg', { viewBox: slim ? '0 0 360 190' : '0 24 600 100', width: '100%' });
          const narr = h('div', { class: 'narr', style: { minHeight: '74px' } });
          const shown = h('div', { class: 'mono', style: { fontSize: '15px', minHeight: '46px' } });
          const btnRow = h('div', { class: 'row gap-s' });
          const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };
          const vis = (c) => (c === ' ' ? '␣' : c);
          function reset(msg) {
            q = []; typed = 0; word = 0; got = []; pending = []; blocked = false; dropped = 0; lastGot = null;
            say(msg || (mode === 'in'
              ? 'Keyboard input: the <b>device</b> is the producer and the <b>process</b> is the consumer. Type a few keys, then let the process read them.'
              : 'Printer output: the <b>process</b> is the producer and the <b>printer</b> is the consumer. Let the process write a word, then let the printer print.'));
            paint();
          }
          // ---- the two sides of the queue
          function produce() {
            if (mode === 'in') {
              const c = KEYS[typed % KEYS.length]; typed++;
              if (blocked) { blocked = false; got.push(c); lastGot = c; say(`Key <b>${vis(c)}</b> arrives. The process was asleep waiting for input, so it is woken and takes <b>${vis(c)}</b> at once. The queue is still empty.`, 'ok'); }
              else if (q.length >= CAP) { dropped++; say(`Key <b>${vis(c)}</b> arrives but the queue is <b>full</b>. The driver has nowhere to put it, so the keystroke is thrown away (many systems beep). The producer was faster than the consumer for too long.`, 'bad'); }
              else { q.push(c); say(`The keyboard produced <b>${vis(c)}</b>; it joins the back of the queue (${q.length} waiting).`); }
            } else {
              if (blocked) { say('The process is <b>blocked</b>: it is still waiting for room for the rest of its last word. Let the printer print first.', 'warn'); return; }
              const w = WORDS[word % WORDS.length]; word++;
              const chars = [...w], n = chars.length;
              while (chars.length && q.length < CAP) q.push(chars.shift());
              pending = chars;
              if (pending.length) { blocked = true; say(`The process writes <b>${w}</b>, but only ${n - pending.length} of its ${n} characters fit. With the queue full, the process <b>blocks</b>; ${pending.length} character${pending.length > 1 ? 's wait' : ' waits'} until the printer makes room.`, 'warn'); }
              else say(`The process writes <b>${w}</b>: all ${n} characters join the queue, and the process carries on at once without waiting for the slow printer.`, 'ok');
            }
            paint();
          }
          function consume(again) {
            if (!q.length) {
              if (mode === 'in') { blocked = true; say(again ? `The process tries to read <b>${vis(lastGot)}</b> again, but it is gone: reading removed it. The queue is empty, so the process <b>blocks</b> until another key arrives.` : 'The queue is empty, so the process <b>blocks</b> (sleeps) inside read until the keyboard produces a character.', 'warn'); }
              else say('Nothing to print: the queue is empty, so the printer simply waits.', 'warn');
              paint(); return;
            }
            const c = q.shift();
            if (mode === 'in') {
              const prev = lastGot; got.push(c); lastGot = c;
              say(again && prev != null ? `The process asks for <b>${vis(prev)}</b> again but receives <b>${vis(c)}</b>, the next character. <b>${vis(prev)}</b> was destroyed when it was first read: a character queue can only be read once.` : `The process reads <b>${vis(c)}</b> from the front of the queue. That character is now <b>gone</b> from the queue.`, again ? 'bad' : 'ok');
            } else {
              got.push(c);
              let woke = '';
              if (pending.length) { q.push(pending.shift()); if (!pending.length) { blocked = false; woke = ' Its last waiting character fits now, so the process is <b>woken</b> and continues.'; } else woke = ' One waiting character moves in; the process is still blocked.'; }
              say(`The printer takes <b>${vis(c)}</b> from the front and prints it; that slot is free again.${woke}`, 'ok');
            }
            paint();
          }
          // ---- drawing
          function paint() {
            const kids = [];
            const inMode = mode === 'in';
            const P = slim ? { pb: [4, 4, 150, 56], cb: [206, 4, 150, 56], qx: 12, qy: 112, sw: 38, step: 42 } : { pb: [4, 40, 104, 64], cb: [492, 40, 104, 64], qx: 126, qy: 50, sw: 40, step: 45 };
            const box = (r, name, cls, sub, tone) => {
              kids.push(s('rect', { x: r[0], y: r[1], width: r[2], height: r[3], rx: 10, class: tone || cls, 'stroke-width': 2.5 }));
              kids.push(s('text', { x: r[0] + r[2] / 2, y: r[1] + 25, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, name));
              kids.push(s('text', { x: r[0] + r[2] / 2, y: r[1] + 45, 'text-anchor': 'middle', 'font-size': 13, style: tone ? 'fill:var(--warn)' : null, class: tone ? null : 's-sub' }, sub));
            };
            const procSub = blocked ? 'blocked' : 'running';
            if (inMode) { box(P.pb, 'Keyboard', 's-io', 'producer'); box(P.cb, 'Process', 's-proc', procSub, blocked ? 's-warn' : null); }
            else { box(P.pb, 'Process', 's-proc', procSub, blocked ? 's-warn' : null); box(P.cb, 'Printer', 's-io', 'consumer'); }
            for (let i = 0; i < CAP; i++) {
              const x = P.qx + i * P.step, k = CAP - 1 - i, c = q[k];
              kids.push(s('rect', { x, y: P.qy, width: P.sw, height: 44, rx: 7, class: c != null ? 's-mem' : 's-muted', 'stroke-width': 2, 'stroke-dasharray': c != null ? null : '4 4' }));
              if (c != null) kids.push(s('text', { x: x + P.sw / 2, y: P.qy + 29, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, class: 's-monot' }, vis(c)));
            }
            const qEnd = P.qx + (CAP - 1) * P.step + P.sw;
            kids.push(s('text', { x: P.qx, y: P.qy + 64, 'font-size': 13, class: 's-sub' }, '← back: next in'));
            kids.push(s('text', { x: qEnd, y: P.qy + 64, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'front: next out →'));
            kids.push(s('text', { x: (P.qx + qEnd) / 2, y: P.qy - 10, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, `character queue · ${q.length} of ${CAP} slots used`));
            if (slim) {
              kids.push(s('line', { x1: 80, y1: 62, x2: 80, y2: 84, class: 's-line', 'marker-end': 'url(#arr)' }));
              kids.push(s('line', { x1: 300, y1: 84, x2: 300, y2: 64, class: 's-line', 'marker-end': 'url(#arr)' }));
            } else {
              kids.push(s('line', { x1: 108, y1: 72, x2: P.qx - 4, y2: 72, class: 's-line', 'marker-end': 'url(#arr)' }));
              kids.push(s('line', { x1: qEnd + 2, y1: 72, x2: 488, y2: 72, class: 's-line', 'marker-end': 'url(#arr)' }));
            }
            svg.replaceChildren(...kids);
            const gotTxt = got.map(vis).join(' ') || '(nothing yet)';
            shown.innerHTML = inMode
              ? `<div><span class="small b" style="font-family:var(--font)">Process has read:</span> ${ctx.util.esc(gotTxt)}</div>` + (dropped ? `<div class="small" style="color:var(--bad);font-family:var(--font)">${dropped} keystroke${dropped > 1 ? 's' : ''} lost to a full queue</div>` : '')
              : `<div><span class="small b" style="font-family:var(--font)">Printed on paper:</span> ${ctx.util.esc(gotTxt)}</div>` + (pending.length ? `<div class="small" style="font-family:var(--font)">Still in the process, waiting for room: <b>${ctx.util.esc(pending.map(vis).join(' '))}</b></div>` : '');
            btnRow.replaceChildren(
              h('button', { class: 'btn sm io', type: 'button', onclick: () => (inMode ? produce() : consume(false)) }, inMode ? 'Type a key' : 'Printer prints 1 char'),
              h('button', { class: 'btn sm proc', type: 'button', onclick: () => (inMode ? consume(false) : produce()) }, inMode ? 'Process reads 1 char' : 'Process writes a word'),
              inMode ? h('button', { class: 'btn sm', type: 'button', disabled: lastGot == null, onclick: () => consume(true) }, 'Read that char again') : null,
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, 'Reset'));
          }
          const modeSeg = ctx.ui.seg([{ value: 'in', label: 'Keyboard input' }, { value: 'out', label: 'Printer output' }], mode, (v) => { mode = v; reset(); });
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: '22px' } },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'lead m0', html: 'Terminals, communication lines and printers do not store numbered blocks. They produce or swallow a stream of characters, so UNIX gives them <span class="t">character queues</span>.' }),
              h('p', { class: 'm0', html: 'A character queue is a first-in, first-out line between a device and a process, a <span class="t">producer/consumer problem</span> in miniature. Either the device puts characters in and the process takes them out (keyboard input), or the process puts them in and the device takes them out (printer or screen output).' }),
              h('div', { class: 'callout why small m0', 'data-label': 'Read once', html: 'Taking a character out of the queue destroys it. A block in the <span class="t">buffer cache</span> stays there after it is read, ready for the next reader. A character can be read exactly once.' }),
              h('p', { class: 'xs muted m0', html: 'This demo hands the process one character per read, as an editor gets in raw mode; in normal line mode the driver holds characters until Enter and then hands over the whole line. Classic UNIX built these queues from small linked blocks of characters (clists); SVR4 moved terminal drivers onto <span class="t">STREAMS</span>, with the same producer/consumer idea.' })),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'row' }, modeSeg),
              h('div', { class: 'card white tight' }, svg),
              btnRow, shown, narr,
              h('table', { class: 'tbl compact', html: '<tr><th></th><th>Buffer cache</th><th>Character queue</th></tr>'
                + '<tr><td class="b">Unit</td><td>one disk block</td><td>one character</td></tr>'
                + '<tr><td class="b">After a read</td><td>block stays; the next reader hits it</td><td>character is gone</td></tr>'
                + '<tr><td class="b">Order</td><td>any block, by number</td><td>strictly first in, first out</td></tr>' }))));
          reset();
        },
      },

      {
        title: 'Buffered vs unbuffered: the same read, two ways',
        kind: 'compare',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          // one entry per frame: what each lane shows (b = buffered, u = unbuffered)
          const F = [
            { b: { p: 'asleep', buf: 'idle', dev: 'idle', arr: [] }, u: { p: 'asleep', dev: 'idle', arr: [] },
              cap: '<b>Both lanes:</b> process P calls <code>read</code> for 64 KB of data on the disk and goes to sleep until it arrives. Step through and compare.' },
            { b: { p: 'asleep', buf: 'filling', dev: 'busy', arr: ['db'] }, u: { p: 'asleep', lock: true, dev: 'busy for P', arr: ['dp'] },
              cap: '<b>Buffered:</b> DMA moves the data from the disk into kernel buffers. <b>Unbuffered:</b> the kernel first locks P\'s pages in main memory, then DMA writes straight into P\'s own memory.' },
            { b: { p: 'swapped', buf: 'filling', dev: 'busy', arr: ['db', 'ps'] }, u: { p: 'asleep', lock: true, refuse: true, dev: 'busy for P', arr: ['dp'] },
              cap: 'Memory runs short and the OS wants to <span class="t" data-t="swapping">swap</span> P out. <b>Buffered:</b> fine, the data lands in kernel buffers, not in P. <b>Unbuffered:</b> refused. The device is writing into P\'s page frames; if P left, it would write over whatever process got those frames next.' },
            { b: { p: 'swapped', buf: 'filling', dev: 'serves Q too', arr: ['db'], q: true }, u: { p: 'asleep', lock: true, dev: 'busy for P', arr: ['dp'], q: true },
              cap: 'Process Q needs the same disk. <b>Buffered:</b> the driver works block by block, so Q\'s request can be served between P\'s blocks, or straight from the cache if Q wants a block already there. <b>Unbuffered:</b> the device is tied to P until the whole transfer ends; Q waits.' },
            { b: { p: 'copying', buf: 'full', dev: 'idle', arr: ['bp'] }, u: { p: 'done', dev: 'idle', arr: [] },
              cap: '<b>Buffered:</b> P is brought back in and the kernel copies the data from the buffers into P: a second move. <b>Unbuffered:</b> the data is already in P, so P wakes at once and is unlocked.' },
            { b: { p: 'done', buf: 'full', dev: 'idle', arr: [], end: true }, u: { p: 'done', dev: 'idle', arr: [], end: true },
              cap: '<b>Score.</b> Unbuffered: one move, no copy, fastest. Buffered: one extra copy, but P stayed swappable, the disk stayed shared, and the data stays cached for the next reader.' },
          ];
          const moves = (lane, i) => {
            let n = 0;
            for (let k = 0; k <= i; k++) { const a = F[k][lane].arr; if (a.includes('db') && (k === 0 || !F[k - 1][lane].arr.includes('db'))) n++; if (a.includes('dp') && (k === 0 || !F[k - 1][lane].arr.includes('dp'))) n++; if (a.includes('bp')) n++; }
            return n;
          };
          const G = slim
            ? { W: 360, H: 206, p: [194, 6, 160, 56], b: [100, 80, 150, 46], d: [6, 146, 150, 54], sw: [204, 146, 150, 54] }
            : { W: 560, H: 196, p: [366, 6, 186, 58], b: [196, 74, 160, 48], d: [8, 134, 176, 58], sw: [392, 134, 160, 58] };
          function lane(which) {
            const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%' });
            const chips = h('div', { class: 'row gap-s' });
            return { svg, chips, which };
          }
          const L = { b: lane('b'), u: lane('u') };
          const mid = (r, side) => side === 'top' ? [r[0] + r[2] / 2, r[1]] : side === 'bot' ? [r[0] + r[2] / 2, r[1] + r[3]] : side === 'left' ? [r[0], r[1] + r[3] / 2] : [r[0] + r[2], r[1] + r[3] / 2];
          function drawLane(Ln, i) {
            const f = F[i][Ln.which], kids = [], isB = Ln.which === 'b';
            const box = (r, t1, t2, cls, dash, t2style) => {
              kids.push(s('rect', { x: r[0], y: r[1], width: r[2], height: r[3], rx: 10, class: cls, 'stroke-width': 2.5, 'stroke-dasharray': dash ? '6 4' : null }));
              kids.push(s('text', { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 - 3, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14.5 }, t1));
              kids.push(s('text', { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 + 15, 'text-anchor': 'middle', 'font-size': 13, class: t2style ? null : 's-sub', style: t2style || null }, t2));
            };
            const pTxt = { asleep: f.lock ? (f.refuse ? 'LOCKED: cannot leave' : 'asleep · LOCKED') : 'asleep', swapped: 'swapped out to disk', copying: 'back in · receiving copy', done: 'awake, has its data' }[f.p];
            box(G.p, "P's memory", pTxt, f.refuse ? 's-bad' : 's-proc', f.p === 'swapped', f.lock ? 'fill:var(--bad);font-weight:700' : null);
            if (isB) box(G.b, 'Kernel buffers', f.buf === 'idle' ? 'empty' : f.buf === 'filling' ? 'filling…' : 'holds the data', 's-mem');
            else box(G.sw, 'Kernel buffers', 'not used', 's-panel', true);
            box(G.d, 'Disk', f.dev, 's-io');
            if (f.p === 'swapped' || (isB && i >= 2 && i < 4)) box(G.sw, 'Swap area', 'holds P for now', 's-panel');
            const arrow = (a, b, label, on, color) => {
              kids.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 's-line', style: on ? `stroke:var(--${color});stroke-width:4` : 'opacity:.25', 'marker-end': on ? `url(#arr-${color})` : 'url(#arr-muted)' }));
              if (on) kids.push(s('text', { x: (a[0] + b[0]) / 2 - 6, y: (a[1] + b[1]) / 2 - 8, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800, style: `fill:var(--${color})` }, label));
            };
            if (isB) {
              arrow(mid(G.d, 'top'), mid(G.b, 'left'), 'DMA', f.arr.includes('db'), 'io');
              arrow(mid(G.b, 'right'), mid(G.p, 'bot'), 'copy', f.arr.includes('bp'), 'mem');
            } else {
              arrow(mid(G.d, 'top'), [G.p[0], G.p[1] + G.p[3] / 2], 'DMA', f.arr.includes('dp'), 'io');
            }
            if (f.q) kids.push(s('text', { x: G.d[0] + G.d[2] + 10, y: G.d[1] + G.d[3] - 6, 'font-size': 13, 'font-weight': 700, style: `fill:var(--${isB ? 'ok' : 'bad'})` }, isB ? 'Q served' : 'Q waits'));
            Ln.svg.replaceChildren(...kids);
            const n = moves(Ln.which, i);
            Ln.chips.replaceChildren(
              h('span', { class: 'chip ' + (n > 1 ? 'warn' : 'ok') }, `data moves: ${n}`),
              h('span', { class: 'chip ' + (f.lock ? 'bad' : 'ok') }, f.lock ? 'P locked in memory' : 'P swappable'),
              h('span', { class: 'chip ' + (!isB && (i === 1 || i === 2 || i === 3) ? 'bad' : 'ok') }, !isB && i >= 1 && i <= 3 ? 'disk tied to P' : 'disk shared'));
          }
          const player = ctx.ui.player({ count: F.length, interval: 3200, render: (i) => { drawLane(L.b, i); drawLane(L.u, i); return F[i].cap; } });
          const card = (Ln, title, cls, sub) => h('div', { class: 'card white tight stack', style: { gap: '6px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '17px' } }, title), h('span', { class: 'chip ' + cls }, sub)),
            Ln.svg, Ln.chips);
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('p', { class: 'm0', html: '<span class="t">Buffered I/O</span> parks data in kernel buffers on its way to or from the process. <span class="t">Unbuffered I/O</span> lets <span class="t">DMA</span> move it straight between the device and the process\'s memory. Step through one 64 KB read in both lanes at once.' }),
            h('div', { class: 'grid-2', style: { gap: '14px' } },
              card(L.b, 'Buffered', 'mem', 'through the buffer cache'),
              card(L.u, 'Unbuffered', 'os', 'raw: DMA to the process')),
            player.el,
            h('div', { class: 'callout tip small m0', 'data-label': 'Who goes unbuffered?', html: 'Big one-time transfers that gain nothing from caching: <span class="t">swapping</span>, tape backups, databases that keep their own buffers (on Linux today: the <code>O_DIRECT</code> flag).' })));
        },
      },

      {
        title: 'Which device takes which path?',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const COLS = [['Buffer cache', 'mem'], [ctx.narrow ? 'Char. queue' : 'Character queue', 'io'], ['Unbuffered', 'os']];
          const DEV = [
            ['Disk drive', [1, 0, 1], 'A block device. Ordinary file I/O goes through the buffer cache; swapping and the raw disk device move data unbuffered.'],
            ['Tape drive', [1, 0, 1], 'Also a block device. It can use the buffer cache, but big sequential jobs such as backups normally use the raw tape device, unbuffered.'],
            ['Terminal', [0, 1, 0], 'Keystrokes in and screen output out, one character at a time and never by block number: character queues.'],
            ['Communication line', [0, 1, 0], 'A serial line carries a stream of characters with no block structure: character queues.'],
            ['Printer', [0, 1, 1], 'Usually fed through a character queue, but a printer driver can also take a large chunk of output straight from the process, unbuffered.'],
          ];
          let sel, checked;
          const tipBox = h('div');
          const tbody = h('tbody');
          const score = h('span', { class: 'chip accent' });
          const whys = h('div', { class: 'stack', style: { gap: '6px' } });
          function cellCls(r, c) {
            const on = sel[r][c], want = DEV[r][1][c] === 1;
            if (!checked) return on ? 'ok' : '';
            if (on && want) return 'ok';
            if (on && !want) return 'bad';
            if (!on && want) return 'miss';
            return '';
          }
          function paint() {
            tbody.replaceChildren(...DEV.map((d, r) => h('tr', {},
              h('td', { class: 'b', style: { fontSize: ctx.narrow ? '14px' : '15.5px' } }, d[0]),
              ...COLS.map((col, c) => {
                const k = cellCls(r, c);
                return h('td', { class: 'center' }, h('button', {
                  type: 'button', class: 'mcell ' + k, 'aria-pressed': sel[r][c] ? 'true' : 'false',
                  'aria-label': `${d[0]} uses ${col[0]}`,
                  onclick: () => { sel[r][c] = !sel[r][c]; checked = false; whys.replaceChildren(h('p', { class: 'small muted m0' }, 'Press Check again when you are ready.')); score.textContent = 'not checked yet'; paint(); },
                }, k === 'miss' ? 'missed' : sel[r][c] ? '✓' : ''));
              }))));
          }
          function check(show) {
            if (show) sel = DEV.map((d) => d[1].map((x) => x === 1));
            checked = true;
            let right = 0;
            DEV.forEach((d, r) => { if (d[1].every((x, c) => (x === 1) === sel[r][c])) right++; });
            score.textContent = show ? 'answer shown' : `${right} of ${DEV.length} rows right`;
            whys.replaceChildren(...DEV.map((d, r) => {
              const ok = d[1].every((x, c) => (x === 1) === sel[r][c]);
              return h('div', { class: 'small', style: { lineHeight: 1.4 } }, h('span', { class: 'chip ' + (ok ? 'ok' : 'bad') }, (ok ? '✓ ' : '✗ ') + d[0]), ' ', h('span', { html: d[2] }));
            }));
            tipBox.className = 'callout why small m0';
            tipBox.dataset.label = 'The pattern';
            tipBox.innerHTML = 'Devices that store numbered blocks gain from the cache; devices that only stream characters cannot (a keystroke is never read twice), so they get character queues. Unbuffered I/O is the fast lane for big transfers.';
            paint();
          }
          function hint() { tipBox.className = 'callout tip small m0'; tipBox.dataset.label = 'Hint'; tipBox.innerHTML = 'Ask two questions about each device. Does it store numbered blocks that someone might read again soon? Does it ever move big chunks, where an extra copy through the kernel would only slow things down?'; }
          function clear() { hint(); sel = DEV.map(() => [false, false, false]); checked = false; whys.replaceChildren(h('p', { class: 'small muted m0' }, 'Tick the cells, then press Check. The explanation for every device appears here.')); score.textContent = 'not checked yet'; paint(); }
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 6fr) minmax(0, 5fr)', gap: '22px' } },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Classic UNIX gives each kind of device the I/O paths that suit it. Tick <b>every</b> path each device uses: some use two. Remember: <span class="t">block devices</span> store numbered blocks; <span class="t">character devices</span> send or receive streams of bytes.' }),
              h('table', { class: 'tbl mtable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Device'), ...COLS.map((c) => h('th', { class: 'center' }, h('span', { class: 'chip ' + c[1] }, c[0]))))), tbody),
              h('div', { class: 'row gap-s' },
                h('button', { class: 'btn sm primary', type: 'button', onclick: () => check(false) }, 'Check'),
                h('button', { class: 'btn sm', type: 'button', onclick: () => check(true) }, 'Show answer'),
                h('button', { class: 'btn sm ghost', type: 'button', onclick: clear }, 'Clear'), score)),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('h4', { class: 'm0' }, 'Why each device goes where it goes'),
              h('div', { class: 'card white tight' }, whys),
              tipBox)));
          clear();
        },
      },

      {
        title: 'Recap: eight things to carry away',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill', style: { gap: '10px' } },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['What is a special file?', 'A name in /dev that stands for a device. Programs open, read, write and close it like any file. Its major number picks the driver; its minor number picks the unit.'],
              ['Buffered vs unbuffered I/O?', 'Buffered: data passes through kernel buffers (the buffer cache or character queues). Unbuffered: DMA moves it straight between the device and the process.'],
              ['How is a cached block found?', 'Hash (device, block) to a slot, then search only that slot\'s chain, comparing both the device and the block number.'],
              ['The three buffer lists?', 'Free list (LRU: release to the tail, take from the head), device list (every buffer of one disk), driver I/O queue (buffers being transferred or waiting).'],
              ['What is a delayed write?', 'A changed buffer is marked dirty and written later: when it is about to be reused or when sync flushes it. Fast, but a crash can lose the change.'],
              ['Character queue in one line?', 'A FIFO producer/consumer queue for terminals, lines and printers in which each character can be read only once.'],
              ['The price of unbuffered I/O?', 'The process stays locked in main memory and the device is tied to it until the transfer ends. In return: one move, no copy.'],
              ['Which device, which path?', 'Disk and tape: buffer cache and unbuffered. Terminal and communication line: character queues. Printer: character queue or unbuffered.'],
            ], { cols: ctx.narrow ? 2 : 4, height: ctx.narrow ? 190 : 214 })));
        },
      },

      {
        title: 'Check yourself: UNIX SVR4 I/O',
        kind: 'check',
        quiz: [
          { q: 'In a UNIX special file, what does the <b>major</b> device number tell the kernel?',
            choices: ['Which unit of the device, such as which partition, is meant', 'How many bytes the device can move in a single transfer', 'Which driver should handle requests for this file', 'Whether the file is a block or a character special file'],
            answer: 2,
            feedback: ['That is the minor number, which is handed to the driver to pick the unit.', 'A special file records no transfer size; the driver knows its own device.', null, 'The type letter (b or c) says that, not the major number.'],
            why: 'The major number indexes the kernel\'s table of block drivers or of character drivers, so it picks the driver. The minor number is passed to that driver to say which unit is meant.' },
          { type: 'tf', q: 'A UNIX program needs special system calls, different from <code>read</code> and <code>write</code>, to send output to a printer.', answer: false,
            why: 'The printer has a special file, so the ordinary open, write and close calls work on it; the kernel routes them to the printer\'s driver. That uniform interface is the whole point of special files.' },
          { type: 'num', q: 'A buffer cache finds blocks with slot = (device number + block number) mod 4. In which slot is block 18 of device 1 found?', answer: 3, tol: 0,
            why: '1 + 18 = 19, and 19 mod 4 = 3 (19 = 4 × 4 + 3). The kernel then searches only slot 3\'s hash chain, comparing both numbers in each buffer.' },
          { q: 'A buffer cache\'s free list, from head to tail, is b4 (marked delayed write), b2, b7, b1; the last three are clean. A read misses. Which buffer receives the new block?',
            choices: ['b4', 'b2', 'b7', 'b1'],
            answer: 1,
            feedback: ['b4 holds a delayed write, so its write to disk is started and it is passed over for now.', null, 'b7 is further back; the kernel takes the first clean buffer from the head.', 'b1 is at the tail: the most recently used buffer, the last one to be replaced.'],
            why: 'Allocation takes the least recently used buffer from the head, but a delayed-write buffer must reach the disk before it can be reused. The kernel starts b4\'s write, moves on, and takes b2.' },
          { type: 'order', q: 'Put the handling of a buffer-cache <b>read miss</b> in order.',
            items: ['Hash (device, block) and search that slot\'s chain', 'Find no matching buffer: a miss', 'Take the clean buffer nearest the head of the free list', 'Move it from its old hash chain to the new one', 'The driver reads the block into the buffer by DMA', 'Copy the data to the process and release the buffer to the tail of the free list'],
            why: 'Search first; only a miss needs a buffer. The LRU victim loses its old identity, takes the new one, is filled from disk, and after the copy goes to the tail as the most recently used.' },
          { type: 'match', q: 'Match each buffer-cache structure to what it holds.',
            pairs: [['Free list', 'Buffers not in use, in least-recently-used order'], ['Device list', 'Every buffer currently tied to one disk'], ['Driver I/O queue', 'Buffers being transferred or waiting for a transfer'], ['Hash chain', 'Buffers whose (device, block) pairs map to the same slot']],
            why: 'One buffer can be on several of these at once: a free buffer holding a valid block is on the free list, its hash chain and its disk\'s device list together.' },
          { type: 'bucket', q: 'Sort each device by the kinds of I/O classic UNIX uses for it.',
            buckets: ['Buffer cache and unbuffered', 'Character queues', 'Character queue or unbuffered'],
            items: [['Disk drive', 0], ['Terminal', 1], ['Printer', 2], ['Tape drive', 0], ['Communication line', 1]],
            why: 'Block devices (disks, tapes) can use the buffer cache and also unbuffered transfers. Terminals and communication lines stream characters, so they use character queues. Printers use a character queue or unbuffered transfers.' },
          { type: 'multi', q: 'Which statements about <b>unbuffered</b> I/O in UNIX are true?',
            choices: ['DMA moves data directly between the device and the process\'s memory', 'The process cannot be swapped out until the transfer ends', 'The data is first copied into a kernel buffer, then into the process', 'The device is tied to that process for the whole transfer', 'A second read of the same data is served from the buffer cache'],
            answer: [0, 1, 3],
            why: 'Unbuffered I/O skips kernel buffers entirely: one DMA move, so the process must stay in memory and the device works for it alone. With no buffer, nothing is left in the cache for a later read.' },
          { type: 'tf', q: 'Each character in a UNIX character queue can be read only once: reading it removes it from the queue.', answer: true,
            why: 'A character queue is a producer/consumer queue, and the consumer takes each character out as it reads it. A block in the buffer cache, by contrast, stays there and can be read again.' },
          { q: 'Why must a process doing unbuffered I/O stay in main memory until its transfer ends?',
            choices: ['The kernel still has to copy the data from its buffer into the process', 'Swapping is never allowed while any I/O device is busy', 'The process holds the device driver and must release it before leaving', 'DMA is writing into its page frames, so they cannot be handed on'],
            answer: 3,
            feedback: ['Unbuffered I/O has no kernel buffer and no copy; that describes buffered I/O.', 'With buffered I/O the process can be swapped out while the device works.', 'Drivers belong to the kernel; a process never holds one.', null],
            why: 'The device\'s DMA writes into the process\'s own frames. If the process were swapped out and its frames given to another process, the transfer would overwrite that other process\'s memory.' },
          { q: 'In the classic UNIX buffer cache, when is a buffer marked <b>delayed write</b> copied to the disk?',
            choices: ['When the buffer is about to be reused, or when sync flushes it', 'Immediately, before the write call returns to the process', 'Only when the process that changed the block finally exits', 'Only at shutdown; until then the newest copy lives just in memory'],
            answer: 0,
            feedback: [null, 'That is write-through. Delayed write lets the process continue at once and writes later.', 'The buffer belongs to the cache, not to the process; the process exiting changes nothing.', 'sync runs regularly (about every 30 seconds in classic UNIX), and reuse of the buffer also forces the write.'],
            why: 'A delayed-write buffer reaches the disk when it gets to the head of the free list and must be reused, or when sync writes out every dirty buffer.' },
          { type: 'num', q: 'A process reads 64 KB through the buffer cache: the disk fills kernel buffers, then the kernel copies the data into the process. How many KB of data movement does this take in total?', answer: 128, tol: 0, unit: 'KB',
            why: 'Each byte moves twice: 64 KB from the device into the buffers plus 64 KB from the buffers into the process = 128 KB. An unbuffered read moves the 64 KB once.' },
        ],
      },

    ],
    notes: `
      <h3>One interface for every device</h3>
      <p>In UNIX every I/O device is represented by a <b>special file</b> (device special file), a name such as <code>/dev/term/a</code> that lives in the file system beside ordinary files. A program opens, reads, writes and closes it with exactly the same system calls it uses for a text file, and the kernel passes the request to the right device driver. Because devices look like files, every file tool and every shell redirection already works with every device, and the normal access bits decide who may use a device.</p>
      <ul>
        <li><b>Type.</b> <code>ls -l</code> shows <b>b</b> for a <b>block special file</b> (used a block at a time through the buffer cache, e.g. a disk partition) or <b>c</b> for a <b>character special file</b> (reached without the buffer cache: terminals, printers, and the raw interfaces of disks and tapes).</li>
        <li><b>Major device number:</b> picks the driver (an index into the kernel's table of block or character drivers).</li>
        <li><b>Minor device number:</b> handed to the driver to say which unit is meant (which partition, which terminal line).</li>
        <li><b>Raw device:</b> the character special file through which a disk or tape is used unbuffered, traditionally named with an r (<code>/dev/rdsk/...</code>). The same partition can therefore appear twice: once as a block file, once as a raw file.</li>
        <li>A special file only needs a driver, not hardware: <code>/dev/null</code> discards writes and reports end of file on reads.</li>
      </ul>
      <p>Under the file interface the kernel moves data in one of two ways. <b>Buffered I/O</b> passes through kernel buffers: the <b>buffer cache</b> (for block devices) or <b>character queues</b> (for character devices). <b>Unbuffered I/O</b> uses DMA to move data straight between the device and the process's own memory.</p>

      <h3>The buffer cache</h3>
      <p>The buffer cache is a pool of main-memory buffers, each able to hold a copy of one disk block; it is essentially a disk cache. All I/O to block devices goes through it. Each buffer has a <b>buffer header</b>: device number, block number, status flags (busy, valid, delayed write, I/O in progress), a pointer to the data area, and links for its hash chain and for the free list.</p>
      <h4>Three lists</h4>
      <ul>
        <li><b>Free list:</b> buffers not in use right now, in least-recently-used (LRU) order. A released buffer joins the <b>tail</b>; a buffer needed for a new block is taken from the <b>head</b>. Free buffers keep their data and can still be found (hit) until they are taken.</li>
        <li><b>Device list:</b> for each disk, every buffer currently associated with it.</li>
        <li><b>Driver I/O queue:</b> for each device, the buffers being transferred or waiting to be transferred.</li>
      </ul>
      <p>One buffer can be on several lists at once (a free buffer holding a valid block is on the free list, its hash chain and its disk's device list).</p>
      <h4>Finding a block: hashing</h4>
      <p>The key is the pair (device number, block number). A hash function maps it to a slot of a hash table, and buffers whose pairs land in the same slot are linked in a <b>hash chain</b> (separate chaining). Only that chain is searched, and each buffer is compared on both numbers, because different pairs can share a slot. Example with slot = (device + block) mod 4: block 21 of device 0 gives 21 mod 4 = 1; block 18 of device 1 gives 19 mod 4 = 3; block 4 of device 0 and block 7 of device 1 both land in slot 0.</p>
      <h4>Reads and writes</h4>
      <ol>
        <li><b>Read hit:</b> the buffer is found; it is taken off the free list, the bytes are copied to the process, and it is released to the tail.</li>
        <li><b>Read miss:</b> the clean buffer nearest the head of the free list is taken, moved from its old hash chain to the new one, put on the driver I/O queue and filled from disk by DMA; then the data is copied to the process and the buffer goes to the tail.</li>
        <li><b>Write:</b> the buffer is found or obtained the same way (a partial-block write reads the block first), the process's bytes are copied in, and the buffer is marked <b>delayed write</b> (dirty). The process continues at once.</li>
        <li><b>Delayed write:</b> the disk is updated later, when the buffer reaches the head of the free list and is about to be reused (the kernel starts its write, takes the next clean buffer, and the written buffer returns to the head when the write finishes), or when <b>sync</b> flushes every dirty buffer (classic UNIX ran sync about every 30 seconds). A crash before then loses the change; programs that cannot afford that call <code>fsync</code>.</li>
      </ol>
      <p>Worked trace (free list b5 empty, b1 = disk 0 block 9 delayed write, then b3, b0, b4, b2): reading d0:12 hits b3; reading d1:7 misses and uses the empty b5; reading d0:21 misses, finds b1 dirty at the head (its write starts) and reuses b0, evicting d0:4; a later read of d0:4 is therefore a miss.</p>
      <p>The device fills a buffer by DMA. The copy between buffer and process is memory to memory, and UNIX kernels let the processor make it (routines such as copyin and copyout); some descriptions say DMA does that copy too. History: this design is the classic UNIX buffer cache of the 1970s and 1980s (up to System V Release 3; BSD later split the free list into several lists). SVR4 caches ordinary file data in virtual-memory pages instead and keeps the buffer cache mainly for file-system metadata, such as the on-disk records that describe each file (inodes, chapter 12), and Linux (2.4 onward) merged its buffer cache into one page cache.</p>

      <h3>Character queues</h3>
      <p>Character devices (terminals, communication lines, printers) use <b>character queues</b>: first-in, first-out queues of characters organized as a producer/consumer problem. Either the device produces and the process consumes (keyboard input), or the process produces and the device consumes (printer or screen output). Each character can be read only once: reading removes it, unlike a buffer-cache block, which stays for the next reader. A reader of an empty queue blocks; a writer facing a full output queue blocks until the device makes room; input that arrives when the queue is full is lost. In normal line mode a terminal driver hands over a whole line after Enter. Classic UNIX built these queues from linked small blocks of characters (clists); SVR4 moved terminal drivers onto STREAMS with the same idea.</p>

      <h3>Unbuffered I/O</h3>
      <p>DMA moves data directly between the device and the process's I/O area: the fastest method, with one move and no copy. The costs: the process is <b>locked in main memory</b> and cannot be swapped out while the transfer is in progress (the device is writing into its frames), and the device is <b>tied to that process</b> for the whole transfer, unavailable to others. Example: reading 64 KB buffered moves 64 KB device → buffers plus 64 KB buffers → process = 128 KB of movement; unbuffered moves 64 KB once. Typical users: swapping, tape backups, databases that keep their own buffers (on Linux today, the <code>O_DIRECT</code> open flag).</p>
      <table>
        <tr><th></th><th>Buffered</th><th>Unbuffered</th></tr>
        <tr><td>Data moves</td><td>two (device ↔ buffer ↔ process)</td><td>one (device ↔ process)</td></tr>
        <tr><td>Process during transfer</td><td>may be swapped out</td><td>locked in memory</td></tr>
        <tr><td>Device</td><td>shared, block by block</td><td>tied to the process</td></tr>
        <tr><td>Later reads</td><td>may hit the cache</td><td>nothing cached</td></tr>
      </table>

      <h3>Which device uses which I/O</h3>
      <table>
        <tr><th>Device</th><th>Buffer cache</th><th>Character queue</th><th>Unbuffered</th></tr>
        <tr><td>Disk drive</td><td>✓</td><td></td><td>✓</td></tr>
        <tr><td>Tape drive</td><td>✓</td><td></td><td>✓</td></tr>
        <tr><td>Terminal</td><td></td><td>✓</td><td></td></tr>
        <tr><td>Communication line</td><td></td><td>✓</td><td></td></tr>
        <tr><td>Printer</td><td></td><td>✓</td><td>✓</td></tr>
      </table>
      <p>Pattern: devices that store numbered blocks gain from caching; devices that only stream characters cannot (a keystroke is never read twice), so they get character queues; unbuffered I/O is the fast lane for large transfers.</p>
    `,
  });
})();
