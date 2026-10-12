/* =====================================================================
   11.9 Linux I/O
   Original teaching material. Small simulation engines shared by several
   steps live inside this IIFE (no globals). Every number shown to the
   student is computed by these engines.
   ===================================================================== */
(function () {
  /* ---------- A. the classic Linux 2.4 elevator ----------
     One queue, kept in the order the head will sweep it: sectors at or above the head in ascending
     order, then (after the wrap back to the start) the sectors below the head. */
  const ELV_LIMIT = 3; // a request jumped this many times is "too old": newcomers may no longer pass it
  const elvStart = () => ({ head: 50, nextId: 10, script: 0, q: [
    { id: 1, type: 'R', start: 64, end: 71, passed: 0 },
    { id: 2, type: 'W', start: 120, end: 127, passed: 0 },
    { id: 3, type: 'W', start: 168, end: 175, passed: 0 },
  ] });
  const ELV_SCRIPT = [
    { type: 'W', start: 96 }, { type: 'W', start: 128 }, { type: 'R', start: 56 }, { type: 'R', start: 16 },
    { type: 'R', start: 144 }, { type: 'W', start: 156 }, { type: 'R', start: 80 },
  ];
  const elvKey = (st, x) => (x >= st.head ? x : x + 1000);
  function elvArrive(st, a) {
    const n = { id: st.nextId++, type: a.type, start: a.start, end: a.start + 7, passed: 0 };
    for (const r of st.q) {
      if (r.type !== n.type) continue;
      if (r.end + 1 === n.start) { r.end = n.end; return { kind: 'back', req: n, into: r }; }
      if (n.end + 1 === r.start) { r.start = n.start; return { kind: 'front', req: n, into: r }; }
    }
    const old = st.q.find((r) => r.passed >= ELV_LIMIT);
    if (old) { st.q.push(n); return { kind: 'guard', req: n, old }; }
    const k = elvKey(st, n.start);
    let at = -1;
    for (let i = 0; i < st.q.length; i++) {
      const before = i === 0 ? -Infinity : elvKey(st, st.q[i - 1].start);
      if (before <= k && k < elvKey(st, st.q[i].start)) { at = i; break; }
    }
    if (at < 0) { st.q.push(n); return { kind: 'tail', req: n }; }
    const jumped = st.q.slice(at);
    jumped.forEach((r) => r.passed++);
    st.q.splice(at, 0, n);
    return { kind: 'insert', req: n, at, jumped };
  }
  function elvServe(st) {
    const r = st.q.shift();
    if (!r) return null;
    const from = st.head;
    st.head = r.end + 1;
    return { req: r, from };
  }

  /* ---------- B. plain elevator vs deadline scheduler ----------
     A backup job keeps four writes pending, each one 16 sectors further up the disk; two reads arrive.
     Every request takes 40 ms of disk time in this model. */
  const DL = { svc: 40, readExp: 500, writeExp: 5000, head: 100, writes: 22, window: 4, wFirst: 108, wGap: 16, max: 499,
    reads: [{ name: 'R1', start: 40, t: 0 }, { name: 'R2', start: 196, t: 60 }] };
  function dlRun(mode) {
    let head = DL.head, nextW = 0, t = 0, guard = 0;
    const pending = [], frames = [], done = {};
    const arrivals = DL.reads.map((r) => ({ name: r.name, type: 'R', start: r.start, t: r.t }));
    const issueW = (when) => { if (nextW < DL.writes) { pending.push({ name: 'W' + (nextW + 1), type: 'W', start: DL.wFirst + nextW * DL.wGap, t: when }); nextW++; } };
    for (let i = 0; i < DL.window; i++) issueW(0);
    while (guard++ < 200) {
      for (let i = arrivals.length - 1; i >= 0; i--) if (arrivals[i].t <= t) { pending.push(arrivals[i]); arrivals.splice(i, 1); }
      if (!pending.length) { if (!arrivals.length) break; t = Math.min(...arrivals.map((a) => a.t)); continue; }
      const key = (r) => (r.start >= head ? r.start : r.start + 1000);
      const sorted = pending.slice().sort((a, b) => key(a) - key(b));
      const fifo = (ty) => pending.filter((r) => r.type === ty).sort((a, b) => a.t - b.t);
      let pick = sorted[0], why = 'sorted';
      if (mode === 'deadline') {
        const rh = fifo('R')[0], wh = fifo('W')[0];
        if (rh && t - rh.t >= DL.readExp) { pick = rh; why = 'read-expired'; }
        else if (wh && t - wh.t >= DL.writeExp) { pick = wh; why = 'write-expired'; }
      }
      frames.push({ t, head, pending: pending.map((r) => Object.assign({}, r)), sorted: sorted.map((r) => r.name), pick: Object.assign({}, pick), why });
      pending.splice(pending.indexOf(pick), 1);
      head = pick.start + 8;
      t += DL.svc;
      done[pick.name] = { start: t - DL.svc, end: t, wait: t - DL.svc - pick.t };
      if (pick.type === 'W') issueW(t);
    }
    frames.push({ t, head, pending: [], sorted: [], pick: null, why: 'done' });
    return { frames, done };
  }

  /* ---------- C. anticipation ----------
     Process A reads 6 blocks one after another (synchronous: one at a time, with think time between).
     Process B has 6 writes queued far away. Moving between the two areas is one long seek. */
  const AS = { reads: 6, writes: 6, svc: 2, seek: 8, window: 6 };
  function asRun(think, anticipate) {
    let t = 0, where = 'A', aDone = 0, aNextAt = 0, wDone = 0, seeks = 0, idle = 0, guard = 0, readPending = true;
    let aFinish = null, bFinish = null;
    const segs = [];
    const go = (area, kind, label) => {
      if (where !== area) { segs.push({ kind: 'seek', t0: t, t1: t + AS.seek }); t += AS.seek; seeks++; where = area; }
      segs.push({ kind, t0: t, t1: t + AS.svc, label }); t += AS.svc;
    };
    while (guard++ < 200 && (aDone < AS.reads || wDone < AS.writes)) {
      if (!readPending && aDone < AS.reads && aNextAt <= t) readPending = true;
      if (readPending) {
        go('A', 'read', 'A' + (aDone + 1));
        aDone++; readPending = false;
        if (aDone === AS.reads) aFinish = t; else aNextAt = t + think;
        if (anticipate) {
          const more = aDone < AS.reads && aNextAt - t <= AS.window;
          const waitEnd = more ? aNextAt : t + AS.window;
          if (waitEnd > t) { segs.push({ kind: 'idle', t0: t, t1: waitEnd, hit: more }); idle += waitEnd - t; t = waitEnd; }
          if (more) readPending = true;
        }
        continue;
      }
      if (wDone < AS.writes) { go('B', 'write', 'B' + (wDone + 1)); wDone++; if (wDone === AS.writes) bFinish = t; continue; }
      segs.push({ kind: 'gap', t0: t, t1: aNextAt }); t = aNextAt; // only A is left and it is still thinking
    }
    return { segs, seeks, idle, aFinish, bFinish, end: t };
  }

  /* ---------- D. CFQ round robin ----------
     Three always-busy processes in different disk areas; switching between them costs one seek.
     Slice length follows CFQ's rule: base + base/5 × (4 − priority), priority 0 (highest) to 7. */
  const CFQ = { seek: 8, horizon: 1000 };
  const cfqSlice = (base, prio) => base + (base / 5) * (4 - prio);
  function cfqRun(base, prioA) {
    const procs = [{ n: 'A', s: cfqSlice(base, prioA) }, { n: 'B', s: base }, { n: 'C', s: base }];
    const segs = [];
    let t = 0, i = 0;
    while (t < CFQ.horizon) {
      const p = procs[i % 3];
      const s1 = Math.min(t + CFQ.seek, CFQ.horizon); segs.push({ n: 'seek', t0: t, t1: s1 }); t = s1;
      const e = Math.min(t + p.s, CFQ.horizon); if (e > t) segs.push({ n: p.n, t0: t, t1: e }); t = e; i++;
    }
    const work = procs.reduce((a, p) => a + p.s, 0), cycle = work + 3 * CFQ.seek;
    return { procs, segs, cycle, share: procs.map((p) => p.s / work), waitB: cycle - base, overhead: (3 * CFQ.seek) / cycle };
  }

  /* ---------- E. page cache and the flusher ----------
     24 page frames, one tick per second. The flusher wakes every 5 s and writes pages that have been dirty
     for at least the age limit; whenever free frames drop below the memory threshold, it writes back every
     dirty page (in sector order) and the kernel then frees least-recently-used clean pages. */
  const PC = { frames: 24, secs: 60, wake: 5 };
  function pcWorkload(t) {
    const ev = [];
    if (t % 2 === 0) ev.push({ op: 'w', page: 'L' + Math.floor(t / 8) });           // a log file gets a new line every 2 s
    if (t % 10 === 5) ev.push({ op: 'w', page: 'D0' }, { op: 'w', page: 'D1' });    // an editor autosaves a two-page document
    ev.push({ op: 'r', page: 'P' + (t % 4) });                                      // a program rereads four library pages
    if (t >= 24 && t < 48) ev.push({ op: 'r', page: 'M' + (t - 24) });             // a media player streams a big file once
    return ev;
  }
  const pcSector = (page) => ({ L: 400, D: 120, P: 40, M: 700 }[page[0]]) + Number(page.slice(1)) * 8;
  function pcRun(memMin, ageMax) {
    const slots = new Array(PC.frames).fill(null), info = {}, states = [];
    let writes = 0, hits = 0, misses = 0, calls = 0;
    const freeCount = () => slots.filter((x) => x === null).length;
    const load = (k) => { slots[slots.indexOf(null)] = k; info[k] = { dirty: false, since: null, used: 0 }; };
    for (let t = 0; t <= PC.secs; t++) {
      const ev = [], log = [];
      for (const e of pcWorkload(t)) {
        const had = slots.includes(e.page);
        if (!had) load(e.page);
        const p = info[e.page];
        if (e.op === 'r') { if (had) hits++; else misses++; }
        else { calls++; if (!p.dirty) { p.dirty = true; p.since = t; } }
        p.used = t;
        ev.push({ op: e.op, page: e.page, hit: had });
      }
      if (t % PC.wake === 0) {
        const old = slots.filter((k) => k && info[k].dirty && t - info[k].since >= ageMax).sort((a, b) => pcSector(a) - pcSector(b));
        old.forEach((k) => (info[k].dirty = false));
        writes += old.length;
        log.push({ why: 'wake', pages: old });
      }
      if (freeCount() < memMin) {
        const before = freeCount();
        const dirty = slots.filter((k) => k && info[k].dirty).sort((a, b) => pcSector(a) - pcSector(b));
        dirty.forEach((k) => (info[k].dirty = false));
        writes += dirty.length;
        const lru = slots.filter((k) => k).sort((a, b) => info[a].used - info[b].used);
        const freed = [];
        while (freeCount() < memMin + 4 && lru.length) { const k = lru.shift(); slots[slots.indexOf(k)] = null; delete info[k]; freed.push(k); }
        log.push({ why: 'mem', pages: dirty, freed, before });
      }
      const dirtyNow = slots.filter((k) => k && info[k].dirty);
      states.push({ t, ev, log, writes, hits, misses, calls,
        slots: slots.map((k) => (k ? { k, dirty: info[k].dirty, age: info[k].dirty ? t - info[k].since : 0 } : null)),
        free: freeCount(), dirty: dirtyNow.length, oldest: dirtyNow.length ? Math.max(...dirtyNow.map((k) => t - info[k].since)) : 0 });
    }
    return states;
  }

  /* ---------- small drawing helpers ---------- */
  const rect = (s, x, y, w, h, cls, extra) => s('rect', Object.assign({ x, y, width: Math.max(0, w), height: h, rx: Math.min(6, w / 2), class: cls, 'stroke-width': 1.5 }, extra || {}));
  const txt = (s, x, y, str, extra) => s('text', Object.assign({ x, y, 'font-size': 13 }, extra || {}), str);

  Guide.section({
    id: '11.9',
    title: 'Linux I/O',
    short: 'Linux I/O',
    summary: 'How Linux orders disk requests, from the 2.4 elevator to blk-mq, and how its page cache delays writes.',
    objectives: [
      'Trace how the classic Linux 2.4 elevator merges, sorts or appends each new request, and name its two weaknesses.',
      'Explain how the deadline scheduler’s FIFO queues and expiry times bound waiting, and why reads get the shorter deadline.',
      'Explain when the anticipatory scheduler saves seeks and when its pause wastes time, and how CFQ shares the disk fairly among processes.',
      'Place each Linux I/O scheduler in its kernel versions, and name today’s blk-mq choices: mq-deadline, BFQ, Kyber and none.',
      'Describe the unified page cache and the two triggers that send dirty pages to the disk.',
    ],
    terms: [
      ['I/O scheduler (elevator)', 'The part of the kernel that decides in which order pending disk requests are sent to the device. Linux calls it the elevator, because the classic design sweeps across the disk like a lift moving between floors.'],
      ['Linux elevator', 'The I/O scheduler of Linux 2.4: one request queue per disk, kept in sector order, with request merging and a crude age limit against starvation.'],
      ['Request merging', 'Joining a new request onto a pending request of the same direction (read or write) for the sectors right next to it, so the disk handles both in one operation. A back merge adds to the end of the pending request, a front merge to its start.'],
      ['Deadline scheduler', 'A Linux 2.6 I/O scheduler that keeps the sorted queue but also puts every request in a read FIFO or a write FIFO with an expiry time, so no request waits much past its deadline.'],
      ['Expiry time', 'How long the deadline scheduler lets a request wait before it is served out of sector order. The Linux defaults are 500 ms for a read and 5 s for a write.'],
      ['Synchronous request', 'A request the issuing process must wait for before it can go on, such as most reads. An asynchronous request, such as a typical write, completes in the background while the process keeps running.'],
      ['Anticipatory scheduler', 'A Linux 2.6 I/O scheduler built on the deadline scheduler. After a read finishes it may keep the disk idle for a few milliseconds (about 6 ms by default), betting that the same process will soon ask for a nearby block. Removed in 2.6.33.'],
      ['Deceptive idleness', 'The false impression that a process has no more disk work, created in the short gap between one of its synchronous reads finishing and its next read arriving.'],
      ['Think time', 'The time a process spends computing between the end of one I/O request and the start of its next one.'],
      ['Completely Fair Queuing (CFQ)', 'A Linux I/O scheduler that gives each process its own queue and serves the queues in round robin, each with a time slice on the disk. The default scheduler of the single-queue block layer from 2.6.18 until that layer was removed in 5.0.'],
      ['I/O priority', 'A per-process setting (changed with the ionice command) that schedulers such as CFQ and BFQ use to give a process longer or shorter turns at the disk.'],
      ['Multi-queue block layer (blk-mq)', 'The Linux block layer introduced in 3.13: each CPU puts requests in its own software queue, and these feed one or more hardware queues, so fast devices are not held back by one shared, locked queue. The only block layer since 5.0.'],
      ['mq-deadline', 'The deadline scheduler rewritten for blk-mq (Linux 4.11): sector order plus read and write expiry times. The usual default for devices with a single hardware queue, such as SATA disks.'],
      ['Budget Fair Queueing (BFQ)', 'A blk-mq scheduler (Linux 4.12) that gives each process a budget of sectors per turn and shares the disk in proportion to weights, favouring interactive and soft real-time work.'],
      ['Kyber', 'A small blk-mq scheduler (Linux 4.12) for fast devices. It limits how many requests are in flight so that reads and synchronous writes meet target latencies.'],
      ['Page cache', 'The main memory Linux uses to hold copies of file and disk data. Since the 2.4 series it is one unified cache for both file pages and disk blocks.'],
      ['Dirty page', 'A page in the page cache that has been changed in memory but not yet written to the disk.'],
      ['Writeback', 'Copying dirty pages from the page cache to the disk. Afterwards they are clean, so their frames can be freed or reused without losing data.'],
      ['Flusher thread', 'A kernel thread that performs writeback in the background. Linux 2.6 used a pool of pdflush threads; from 2.6.32 there is one flusher per storage device.'],
    ],
    css: `
      .sec-11-9 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-11-9 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-9 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-9 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-11-9 td.mono { white-space: nowrap; }
      .sec-11-9 .flip-face.front { font-size: 19px; }
      .sec-11-9 .flip-face.back { font-size: 16.5px; line-height: 1.45; }
      .sec-11-9 svg { flex: none; }
      .sec-11-9 .path .box { padding: 4px 10px; font-size: 14.5px; }
      .sec-11-9 ol.rules { padding-left: 24px; font-size: 15.5px; line-height: 1.4; }
      .sec-11-9 ol.rules li { padding: 2px 6px; border-radius: 6px; transition: background .2s; }
      .sec-11-9 ol.rules li.on { background: var(--hl); }
    `,
    steps: [
      /* ---------------- 1. Big picture ---------------- */
      {
        title: 'Two stops on the way to the disk',
        kind: 'story',
        html: `
          <div class="split fill" style="grid-template-columns:minmax(0, 6fr) minmax(0, 5fr)">
            <div class="stack" style="gap:10px">
              <p class="lead m0">When a Linux program reads or writes a file, the request makes two stops inside the kernel before it reaches a disk.</p>
              <p class="m0"><b>Stop 1: the <span class="t">page cache</span>.</b> If the data is already in memory, a read is answered at once, and a write only changes the copy in memory, which becomes a <span class="t">dirty page</span>. <b>Stop 2: the <span class="t" data-t="I/O scheduler">I/O scheduler</span>.</b> Requests that truly need the disk wait in a queue, and the scheduler picks the order in which the device gets them.</p>
              <div class="row gap-s path small">
                <span class="box proc">Process</span><span class="muted">→</span><span class="box mem">Page cache</span><span class="muted">→</span><span class="box os">I/O scheduler</span><span class="muted">→</span><span class="box os">Driver</span><span class="muted">→</span><span class="box io">Disk</span>
              </div>
              <div class="callout analogy m0" data-label="Analogy">A lift in a busy building does not answer calls in the order the buttons were pressed: it picks people up floor by floor on its way up, then on its way down. That is why Linux calls its I/O scheduler the <b>elevator</b>.</div>
              <div class="callout why m0" data-label="Why it matters">One disk seek takes a few milliseconds, long enough for a processor to run millions of instructions. A good request order, and skipping the disk whenever memory already has the data, are the kernel’s two biggest levers.</div>
              <div class="row gap-s small"><span class="chip os">run the 2.4 elevator</span><span class="chip intr">beat a deadline</span><span class="chip proc">count saved seeks</span><span class="chip mem">tune the flusher</span></div>
            </div>
            <div class="card stack" style="gap:10px">
              <h4 class="m0">Linux block I/O, version by version</h4>
              <p class="small muted m0">Linux has replaced its I/O scheduler several times. Click a version to see what changed.</p>
              <div class="vgrid"></div>
              <div class="card white grow vdetail" style="display:flex;flex-direction:column;gap:6px"></div>
              <div class="stack gap-s">
                <span class="xs b muted">DEFAULT SCHEDULER OVER TIME</span>
                <div class="vstrip"></div>
              </div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const V = [
            ['2.4', '2001', 'The Linux elevator', 'One request queue kept in sector order, with <b>merging</b> of neighbouring requests and a crude age limit against starvation. During the 2.4 series the separate buffer cache was also folded into one unified <b>page cache</b>.', 'Steps 2 and 6'],
            ['2.6.0', '2003', 'Choose your scheduler', 'The block layer is rebuilt so the scheduler can be chosen (at first only at boot time). The choices are <b>deadline</b>, <b>anticipatory</b> (the default) and noop (no reordering). Dirty pages are written back by a pool of <b>pdflush</b> threads.', 'Steps 3, 4 and 6'],
            ['2.6.18', '2006', 'CFQ becomes the default', '<b>Completely Fair Queuing</b>, added in 2.6.6, becomes the default: every process gets its own queue and a turn at the disk.', 'Step 5'],
            ['2.6.32', '2009', 'Per-device flushers', 'The shared pool of pdflush threads is replaced by <b>one flusher thread per storage device</b>, so a slow disk can no longer hold up writeback to a fast one.', 'Step 6'],
            ['2.6.33', '2010', 'Anticipatory removed', 'The <b>anticipatory</b> scheduler is deleted. CFQ already paused briefly for a process’s next request in a similar way, so the idea lived on.', 'Step 4'],
            ['3.13', '2014', 'Multi-queue block layer', '<b>blk-mq</b> arrives: each CPU gets its own software queue feeding one or more hardware queues, because one locked queue could not keep up with fast solid-state drives.', 'Step 5'],
            ['4.11–4.12', '2017', 'Schedulers for blk-mq', '<b>mq-deadline</b> (4.11), then <b>BFQ</b> and <b>Kyber</b> (4.12) give blk-mq devices a choice of scheduler. A device may also use <b>none</b>.', 'Step 5'],
            ['5.0', '2019', 'Old path deleted', 'The old single-queue block layer is removed, and with it noop, deadline and CFQ. Every device now uses blk-mq with mq-deadline, BFQ, Kyber or none.', 'Step 5'],
          ];
          const grid = ctx.$('.vgrid'), detail = ctx.$('.vdetail');
          grid.style.cssText = `display:grid;grid-template-columns:repeat(${ctx.narrow ? 2 : 4}, minmax(0, 1fr));gap:8px`;
          const btns = V.map((v, i) => h('button', { class: 'btn sm', type: 'button', style: { height: '44px', flexDirection: 'column', gap: '0', lineHeight: '1.15' }, onclick: () => show(i) },
            h('span', { class: 'b' }, v[0]), h('span', { class: 'xs muted' }, v[1])));
          grid.append(...btns);
          function show(i) {
            const [ver, year, head, body, where] = V[i];
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            detail.innerHTML = '';
            detail.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },
                h('b', { style: { fontSize: '19px' } }, 'Linux ' + ver + ' · ' + head),
                h('span', { class: 'chip os' }, year)),
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: body }),
              h('p', { class: 'small muted m0', style: { marginTop: 'auto' } }, h('b', {}, 'Where in this section: '), where));
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
          }
          const strip = ctx.$('.vstrip');
          strip.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
          [['Elevator', '2.4', 'os', 1.1], ['Anticipatory', '2.6.0 – 2.6.17', 'proc', 1.3], ['CFQ', '2.6.18 – 4.20', 'mem', 1.8], ['mq-deadline / none', '5.0 →', 'io', 1.7]].forEach(([n, r, c, g]) =>
            strip.append(h('div', { class: 'box ' + c, style: { flex: g + ' 1 0', minWidth: '0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '4px 8px' } },
              h('span', { class: 'small b' }, n), h('span', { class: 'xs' }, r))));
          show(0);
        },
      },

      /* ---------------- 2. The 2.4 elevator lab ---------------- */
      {
        title: 'The 2.4 elevator: merge, insert or append',
        kind: 'lab',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0">Linux 2.4 kept <b>one</b> request queue per disk, in the order the head would sweep across it. The <span class="t">Linux elevator</span> put every new request through four checks, in this order:</p>
              <ol class="rules m0">
                <li data-k="merge"><b>Merge.</b> If a pending request of the same kind (read or write) covers the sectors right next to the new one, join the two (<span class="t">request merging</span>).</li>
                <li data-k="guard"><b>Too old?</b> If some pending request has waited too long, put the newcomer at the <b>tail</b>, so nobody passes the old one again.</li>
                <li data-k="insert"><b>Insert in sector order</b>, where the sweep of the head will pass it.</li>
                <li data-k="tail"><b>Append at the tail</b> if no place in the sweep fits.</li>
              </ol>
              <p class="small m0">Here “too old” means jumped 3 times, shown as dots. Real 2.4 measured age by how many sectors of newer work had jumped ahead of a request, not by the clock.</p>
              <div class="callout warn small m0" data-label="Two weaknesses">Requests far from the head can wait a long time. And reads share the one sorted queue with writes: apart from a smaller jump limit, nothing favours a read, even though a read is usually a <span class="t">synchronous request</span>: its process is blocked until it finishes, while most writes finish in the background.</div>
            </div>
            <div class="stack elv" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const W = ctx.narrow ? 360 : 660, perRow = ctx.narrow ? 5 : 9, bw = ctx.narrow ? 64 : 66, gapX = ctx.narrow ? 6 : 6;
          const rows = Math.ceil(9 / perRow), qy = 146, pitch = ctx.narrow ? 104 : 94, H = qy + rows * pitch + 2;
          const X = (sec) => 20 + sec * ((W - 40) / 200);
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Disk sector axis with the head position and the request queue' });
          const narr = h('div', { class: 'narr' });
          const nextLbl = h('div', { class: 'small', style: { minHeight: '22px' } });
          const stat = h('span', { class: 'chip os' });
          const bArr = h('button', { class: 'btn primary', type: 'button', onclick: () => arrive() }, 'Next arrival ▶');
          const bServe = h('button', { class: 'btn', type: 'button', onclick: () => serve() }, 'Serve front');
          const bReset = h('button', { class: 'btn ghost', type: 'button', onclick: () => reset() }, 'Reset');
          const lis = ctx.$$('.rules li');
          let st, rng, upcoming, flashId = null, done = [];
          const order = h('div', { class: 'card tight small', style: { lineHeight: 1.45 } });
          const name = (r) => `${r.type} ${r.start}–${r.end}`;
          const kindWord = (t) => (t === 'R' ? 'read' : 'write');
          function pickRandom() {
            for (let k = 0; k < 20; k++) {
              const a = { type: rng() < 0.5 ? 'R' : 'W', start: 8 * Math.floor(rng() * 25) };
              if (!st.q.some((r) => a.start <= r.end && a.start + 7 >= r.start)) return a;
            }
            return { type: 'R', start: 8 * Math.floor(rng() * 25) };
          }
          function nextUp() { upcoming = st.script < ELV_SCRIPT.length ? ELV_SCRIPT[st.script] : pickRandom(); }
          function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }
          function rule(k) { lis.forEach((li) => li.classList.toggle('on', li.dataset.k === k)); }
          function draw() {
            const kids = [];
            kids.push(txt(s, W - 20, 16, 'disk sectors 0–199', { 'font-weight': 700, 'text-anchor': 'end', class: 's-sub' }));
            kids.push(s('line', { x1: X(0), y1: 62, x2: X(200), y2: 62, class: 's-line', 'stroke-width': 2 }));
            const hx = X(Math.min(st.head, 200));
            for (let k = 0; k <= 200; k += ctx.narrow ? 50 : 25) {
              kids.push(s('line', { x1: X(k), y1: 58, x2: X(k), y2: 66, class: 's-line' }));
              if (Math.abs(X(k) - hx) > 14) kids.push(txt(s, X(k), 84, String(k), { 'text-anchor': 'middle', class: 's-sub' }));
            }
            st.q.forEach((r) => kids.push(rect(s, X(r.start), 45, X(r.end + 1) - X(r.start), 13, r.type === 'R' ? 's-proc' : 's-io')));
            if (upcoming && st.q.length < 9) {
              kids.push(rect(s, X(upcoming.start), 24, X(upcoming.start + 8) - X(upcoming.start), 13, 's-panel', { 'stroke-dasharray': '3 2', style: 'stroke:var(--ink-2)' }));
              const nx = X(upcoming.start + 8) + 5, right = nx > W - 50;
              kids.push(txt(s, right ? X(upcoming.start) - 5 : nx, 35, 'next', { 'font-weight': 700, 'text-anchor': right ? 'end' : 'start', class: 's-sub' }));
            }
            kids.push(s('path', { d: `M${hx} 64 l-8 14 h16 z`, class: 's-accent', 'stroke-width': 1.5 }));
            kids.push(txt(s, Math.min(W - 4, hx + 12), 106, `head at ${st.head}, sweeping up`, { 'font-weight': 700, 'text-anchor': hx > W - 170 ? 'end' : 'start', style: 'fill:var(--accent)' }));
            kids.push(txt(s, 0, qy - 10, 'Queue, front first →', { 'font-weight': 700, 'font-size': 14 }));
            st.q.forEach((r, i) => {
              const row = Math.floor(i / perRow), col = i % perRow, x = col * (bw + gapX), y = qy + row * pitch;
              const over = r.passed >= ELV_LIMIT;
              kids.push(rect(s, x + 1, y, bw - 2, 76, r.type === 'R' ? 's-proc' : 's-io', r.id === flashId ? { 'stroke-width': 3.5, style: 'stroke:var(--accent)' } : {}));
              if (over) kids.push(rect(s, x - 1, y - 2, bw + 2, 80, '', { style: 'fill:none;stroke:var(--bad)', 'stroke-width': 3 }));
              kids.push(txt(s, x + bw / 2, y + 23, r.type === 'R' ? 'read' : 'write', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }));
              kids.push(txt(s, x + bw / 2, y + 44, `${r.start}–${r.end}`, { 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 14 }));
              for (let d = 0; d < ELV_LIMIT; d++) kids.push(s('circle', { cx: x + bw / 2 - 14 + d * 14, cy: y + 62, r: 5, class: 's-panel', 'stroke-width': 1.2, style: d < r.passed ? `fill:var(${over ? '--bad' : '--warn'});stroke:var(${over ? '--bad' : '--warn'})` : 'stroke:var(--ink-2)' }));
            });
            if (!st.q.length) kids.push(txt(s, 0, qy + 30, '(empty: the disk is idle)', { class: 's-sub' }));
            else {
              const last = st.q.length - 1, lx = (last % perRow) * (bw + gapX) + bw / 2, ly = qy + Math.floor(last / perRow) * pitch + 92;
              kids.push(txt(s, lx, ly, 'tail', { 'text-anchor': 'middle', class: 's-sub', 'font-size': 12.5 }));
              if (last > 0) kids.push(txt(s, bw / 2, qy + 92, 'front', { 'text-anchor': 'middle', class: 's-sub', 'font-size': 12.5 }));
            }
            svg.replaceChildren(...kids);
            const full = st.q.length >= 9;
            nextLbl.innerHTML = full ? '<b>The queue is full in this demo.</b> Serve a few requests first.'
              : `Next arrival: <b>${upcoming.type === 'R' ? 'read' : 'write'} of sectors ${upcoming.start}–${upcoming.start + 7}</b>${st.script >= ELV_SCRIPT.length ? ' <span class="muted">(random)</span>' : ` <span class="muted">(${st.script + 1} of ${ELV_SCRIPT.length})</span>`}`;
            bArr.disabled = full; bServe.disabled = !st.q.length;
            stat.textContent = `served ${done.length} · pending ${st.q.length}`;
            order.innerHTML = done.length ? `<b>Order the disk served:</b> ${done.slice(-8).join(' → ')}${done.length > 8 ? ' <span class="muted">(last 8)</span>' : ''}` : '<b>Order the disk served:</b> <span class="muted">nothing yet. Press Serve front to send the front request to the disk.</span>';
          }
          function arrive() {
            const res = elvArrive(st, upcoming);
            if (st.script < ELV_SCRIPT.length) st.script++;
            const n = name(res.req);
            if (res.kind === 'back' || res.kind === 'front') {
              flashId = res.into.id; rule('merge');
              const was = res.kind === 'back' ? `${res.into.start}–${res.req.start - 1}` : `${res.req.end + 1}–${res.into.end}`;
              say(`<b>${n}</b> ${res.kind === 'back' ? 'starts right after' : 'ends right before'} the pending ${kindWord(res.req.type)} of sectors ${was}, so the two are <b>merged</b> (a ${res.kind} merge) into one request, <b>${name(res.into)}</b>. The disk does both in one operation, and the queue does not grow.`, 'ok');
            } else if (res.kind === 'guard') {
              flashId = res.req.id; rule('guard');
              const k = elvKey(st, res.req.start), behind = st.q.filter((r) => r !== res.req && elvKey(st, r.start) > k).length;
              say(`<b>${name(res.old)}</b> has already been jumped ${ELV_LIMIT} times. To stop it from <span class="t">starvation</span>, nobody may pass it now, so <b>${n}</b> goes to the <b>tail</b>${behind ? `, behind ${behind} request${behind === 1 ? '' : 's'} that sector order would have let it pass` : ', which is where sector order would have put it anyway'}.${behind && res.req.type === 'R' ? ' Its process sits blocked the whole time.' : ''}`, 'bad');
            } else if (res.kind === 'tail') {
              flashId = res.req.id; rule('tail');
              if (st.q.length === 1) { say(`The queue was empty, so <b>${n}</b> simply becomes the only request. With nothing to sort, it is both the front and the tail.`); nextUp(); draw(); return; }
              const behind = res.req.start < st.head;
              say(`<b>${n}</b> ${behind ? `lies behind the head (sector ${st.head}). The head sweeps upward first, so this request belongs after everything else in the sweep:` : 'lies beyond every pending request in the sweep, so'} it is <b>appended at the tail</b>.${behind ? ' It waits until the sweep wraps back to the low sectors.' : ''}`, 'warn');
            } else {
              flashId = res.req.id; rule('insert');
              const prev = st.q[res.at - 1];
              say(`<b>${n}</b> is <b>inserted in sector order</b>, ${prev ? `right after ${name(prev)}` : 'at the front'}. It jumped ahead of ${res.jumped.length === 1 ? '1 request, which gets' : res.jumped.length + ' requests, and each of them gets'} one more dot.`);
            }
            nextUp(); draw();
          }
          function serve() {
            const res = elvServe(st);
            if (!res) return;
            done.push(name(res.req)); flashId = null; rule(null);
            say(`The disk serves the front request, <b>${name(res.req)}</b>. The head moves from sector ${res.from} to ${st.head}.${res.req.type === 'R' ? ' The process that was blocked on this read can run again.' : ''}`);
            draw();
          }
          function reset() {
            st = elvStart(); rng = ctx.util.seeded(9); flashId = null; done = []; rule(null); nextUp();
            say('Three requests are pending and the head is at sector 50, sweeping toward higher sectors. Press <b>Next arrival</b> to watch the elevator place each new request, or <b>Serve front</b> to let the disk take the front request.');
            draw();
          }
          ctx.$('.elv').append(svg, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, nextLbl, stat),
            h('div', { class: 'row' }, bArr, bServe, bReset,
              h('span', { class: 'xs muted', style: { marginLeft: 'auto' } }, h('span', { class: 'chip proc' }, 'read'), ' ', h('span', { class: 'chip io' }, 'write'), ' dots = times jumped')),
            narr, order);
          reset();
        },
      },

      /* ---------------- 3. Deadline scheduler ---------------- */
      {
        title: 'Deadline scheduler: every request gets a clock',
        kind: 'explore',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0">The <span class="t">deadline scheduler</span> (Linux 2.6) keeps the sorted queue, but every request is also filed in one of two first-in, first-out lists:</p>
              <div class="stack gap-s small">
                <div class="card tight os"><b>Sorted queue</b>: every request, in sweep order.</div>
                <div class="card tight proc"><b>Read FIFO</b>: reads in arrival order. <span class="t">Expiry time</span> 500 ms.</div>
                <div class="card tight io"><b>Write FIFO</b>: writes in arrival order. Expiry time 5 s.</div>
              </div>
              <p class="m0 small"><b>Before each dispatch:</b> if the oldest request in a FIFO has expired, serve it next and carry on the sweep from its sector. Otherwise take the next request in sector order. (Real Linux checks only as each batch of up to 16 requests starts.)</p>
              <div class="callout why small m0" data-label="Why reads get the shorter clock">A process usually sits blocked until its read arrives. A write usually goes into the page cache first, and the process keeps running.</div>
              <div class="card tight white dl-res"></div>
            </div>
            <div class="stack dl" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const N = ctx.narrow, W = N ? 360 : 680, lab = N ? 0 : 132, bw = N ? 66 : 82, gx = 6, laneH = N ? 80 : 66, bh = 52;
          const slots = Math.floor((W - lab + gx) / (bw + gx));
          const l1 = N ? 128 : 116, H = l1 - 26 + 2 * laneH + (N ? 22 : 4) + bh + 4;
          const X = (sec) => 14 + sec * ((W - 28) / 500);
          const runs = { plain: dlRun('plain'), deadline: dlRun('deadline') };
          let mode = 'deadline';
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Disk head position, the sorted queue and the two FIFO queues' });
          const res = ctx.$('.dl-res');
          const r1 = { plain: runs.plain.done.R1.wait, deadline: runs.deadline.done.R1.wait };
          const mx = Math.max(r1.plain, r1.deadline);
          res.innerHTML = `<div class="small b" style="margin-bottom:4px">How long R1 (a read at sector 40) waits</div>` +
            [['plain', 'Plain elevator', 'warn'], ['deadline', 'Deadline', 'ok']].map(([k, label, c]) =>
              `<div class="row nw small" style="gap:8px;margin:3px 0"><span style="width:104px">${label}</span><div class="meter grow"><i style="width:${(100 * r1[k]) / mx}%;background:var(--${c})"></i></div><b class="mono" style="width:62px;text-align:right">${r1[k]} ms</b></div>`).join('');
          function lane(kids, y, label, sub, items, dim) {
            if (N) { kids.push(txt(s, 0, y + 14, label + ' · ' + sub, { 'font-weight': 700 })); }
            else { kids.push(txt(s, 0, y + 26, label, { 'font-weight': 700, 'font-size': 14.5 })); kids.push(txt(s, 0, y + 45, sub, { class: 's-sub', 'font-size': 12.5 })); }
            const by = N ? y + 22 : y + 4;
            if (dim) {
              kids.push(rect(s, lab, by, W - lab, bh, 's-panel', { 'stroke-dasharray': '5 4', style: 'stroke:var(--line-2)' }));
              kids.push(txt(s, lab + (W - lab) / 2, by + 31, 'no FIFO lists in the plain elevator', { 'text-anchor': 'middle', class: 's-sub', 'font-weight': 700 }));
              return;
            }
            items.slice(0, slots).forEach((it, i) => {
              const x = lab + i * (bw + gx);
              kids.push(rect(s, x, by, bw, bh, it.cls, it.pick ? { 'stroke-width': 3.5, style: 'stroke:var(--accent)' } : {}));
              kids.push(txt(s, x + bw / 2, by + 20, it.top, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14.5 }));
              kids.push(txt(s, x + bw / 2, by + 38, it.bot, { 'text-anchor': 'middle', 'font-size': 12.5, style: it.late ? 'fill:var(--bad);font-weight:800' : '' }));
              if (it.frac != null) kids.push(rect(s, x + 5, by + 44, (bw - 10) * Math.max(0, it.frac), 4, '', { rx: 2, style: `fill:var(${it.frac <= 0 ? '--bad' : it.frac < 0.25 ? '--warn' : '--ok'});stroke:none` }));
            });
            if (items.length > slots) kids.push(txt(s, W - 2, by - 3, `+${items.length - slots} more`, { 'text-anchor': 'end', class: 's-sub', 'font-size': 12.5 }));
            if (!items.length) kids.push(txt(s, lab + 4, by + 31, '(empty)', { class: 's-sub' }));
          }
          function draw(f) {
            const kids = [];
            const pick = f.pick ? f.pick.name : null;
            kids.push(txt(s, 0, 22, `t = ${f.t} ms`, { 'font-weight': 800, 'font-size': 20 }));
            if (f.pick) kids.push(txt(s, W, 22, `${N ? '' : 'disk now serves '}${f.pick.name} (sector ${f.pick.start})`, { 'text-anchor': 'end', 'font-weight': 700, style: 'fill:var(--accent)' }));
            kids.push(s('line', { x1: X(0), y1: 66, x2: X(500), y2: 66, class: 's-line', 'stroke-width': 2 }));
            const hx = X(f.head);
            for (let k = 0; k <= 500; k += 100) {
              kids.push(s('line', { x1: X(k), y1: 62, x2: X(k), y2: 70, class: 's-line' }));
              if (Math.abs(X(k) - hx) > 16) kids.push(txt(s, X(k), 86, String(k), { 'text-anchor': 'middle', class: 's-sub', 'font-size': 12.5 }));
            }
            kids.push(txt(s, W - 14, 46, 'sector', { 'text-anchor': 'end', class: 's-sub', 'font-size': 12.5 }));
            f.pending.forEach((r) => kids.push(rect(s, X(r.start), 50, Math.max(4, X(r.start + 8) - X(r.start)), 12, r.type === 'R' ? 's-proc' : 's-io', Object.assign({ rx: 2 }, r.name === pick ? { 'stroke-width': 3, style: 'stroke:var(--accent)' } : {}))));
            f.pending.filter((r) => r.type === 'R').forEach((r) => kids.push(txt(s, X(r.start + 4), 44, r.name, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 12.5 })));
            kids.push(s('path', { d: `M${hx} 68 l-7 12 h14 z`, class: 's-accent', 'stroke-width': 1.5 }));
            const byName = Object.fromEntries(f.pending.map((r) => [r.name, r]));
            const sorted = f.sorted.map((n) => { const r = byName[n]; return { cls: r.type === 'R' ? 's-proc' : 's-io', top: r.name, bot: (N ? 'sec ' : 'sector ') + r.start, pick: n === pick }; });
            const fifo = (ty, exp) => f.pending.filter((r) => r.type === ty).sort((a, b) => a.t - b.t).map((r) => {
              const left = exp - (f.t - r.t);
              return { cls: ty === 'R' ? 's-proc' : 's-io', top: r.name, bot: left <= 0 ? 'expired' : (left >= 1000 ? (left / 1000).toFixed(1) + ' s' : left + ' ms') + (N ? '' : ' left'), late: left <= 0, frac: left / exp, pick: r.name === pick };
            });
            lane(kids, l1 - 26, 'Sorted queue', 'sweep order', sorted, false);
            lane(kids, l1 - 26 + laneH, 'Read FIFO', N ? 'expiry 500 ms, time left' : 'expiry 500 ms', fifo('R', DL.readExp), mode === 'plain');
            lane(kids, l1 - 26 + 2 * laneH, 'Write FIFO', N ? 'expiry 5 s, time left' : 'expiry 5 s', fifo('W', DL.writeExp), mode === 'plain');
            svg.replaceChildren(...kids);
          }
          function caption(f, i, run) {
            if (!f.pick) {
              const d = run.done;
              return `<b>All requests done at t = ${f.t} ms.</b> R1 waited <b>${d.R1.wait} ms</b> and R2 waited ${d.R2.wait} ms. ${mode === 'plain' ? 'The plain elevator only reached R1 when the backup job ran out of writes ahead of the head.' : 'The read FIFO capped R1’s wait near its 500 ms deadline, and the writes lost only one 40 ms turn.'}`;
            }
            const r1 = f.pending.find((r) => r.name === 'R1');
            const p = f.pick;
            if (f.why === 'read-expired') return `<b>R1 has waited ${f.t - p.t} ms, past its 500 ms expiry.</b> The deadline scheduler serves it next, out of sector order. The head jumps to sector ${p.start}, and the sweep then carries on upward from there.`;
            if (p.type === 'R') return `<b>${p.name}</b>, a read at sector ${p.start}, is simply next in the sweep, so it is served normally after waiting ${f.t - p.t} ms. Its deadline never mattered.`;
            let out = `${i === 0 ? `A backup job keeps four writes pending, each one further up the disk, and every request takes 40 ms.${mode === 'plain' ? ' This plain elevator sorts by sector only, with no age guard.' : ''} ` : ''}Next in sector order is <b>${p.name}</b> (sector ${p.start}).`;
            if (r1) out += mode === 'plain' ? ` R1 sits behind the head and has waited <b>${f.t - r1.t} ms</b>: new writes keep landing ahead of the head, so the sweep never turns back.` : ` R1 has waited <b>${f.t - r1.t} ms</b> of its 500 ms.`;
            return out;
          }
          const player = ctx.ui.player({ count: runs[mode].frames.length, interval: 1300, render: (i) => { const run = runs[mode], f = run.frames[i]; draw(f); return caption(f, i, run); } });
          const seg = ctx.ui.seg([{ value: 'plain', label: 'Plain elevator' }, { value: 'deadline', label: 'Deadline scheduler' }], mode, (v) => { mode = v; player.setCount(runs[mode].frames.length); });
          ctx.$('.dl').append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'xs muted' }, 'R = read, W = write · bars = time left')), svg, player.el);
        },
      },

      /* ---------------- 4. Anticipation ---------------- */
      {
        title: 'Anticipation: wait a moment, save two seeks',
        kind: 'compare',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:6px">
              <p class="m0">A process reading a file in order needs only a moment, its <span class="t">think time</span>, between one read finishing and asking for the next block. In that gap its queue is empty, so the scheduler wrongly decides it is done: <span class="t">deceptive idleness</span>. The disk seeks away to other work, then must seek back.</p>
              <p class="m0">The <span class="t">anticipatory scheduler</span> (Linux 2.6.0, the default until 2.6.17) bets on the reader: after a read it keeps the disk idle for up to about <b>6 ms</b>, waiting for a nearby request from that process.</p>
              <div class="callout warn small m0" data-label="When the bet loses">If the next read comes after the wait ends, the disk idled for nothing. So the real scheduler kept per-process statistics (average think time and seek distance) and waited only when it was likely to pay.</div>
              <div class="callout analogy small m0" data-label="Analogy">A waiter who has just served a table lingers a moment, since diners often order again at once, rather than crossing the room and coming straight back.</div>
              <p class="small muted m0">Removed in 2.6.33. CFQ, and later BFQ, keep a similar short idle wait for a process’s next request.</p>
            </div>
            <div class="stack as" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const N = ctx.narrow, W = N ? 360 : 680, lab = N ? 0 : 128, T = 150;
          const x0 = lab + 4, X = (ms) => x0 + ms * ((W - x0 - 8) / T);
          const rowY = N ? [44, 140] : [30, 120], H = N ? 226 : 196;
          let think = 2;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Disk timelines with and without anticipation' });
          const tbl = h('table', { class: 'tbl compact small' });
          const verdict = h('div', { class: 'narr' });
          const CLS = { read: 's-proc', write: 's-io', seek: 's-intr', idle: 's-panel', gap: 's-panel' };
          function row(kids, y, label, run) {
            if (N) kids.push(txt(s, 0, y - 8, label, { 'font-weight': 700 }));
            else kids.push(txt(s, 0, y + 22, label, { 'font-weight': 700 }));
            kids.push(rect(s, x0, y, X(T) - x0, 34, 's-panel', { rx: 4, style: 'stroke:var(--line)' }));
            run.segs.forEach((g) => {
              const extra = g.kind === 'idle' ? { 'stroke-dasharray': '3 2', style: `stroke:var(${g.hit ? '--ok' : '--bad'})` } : g.kind === 'gap' ? { style: 'stroke:none' }
                : g.kind === 'read' ? { style: 'fill:var(--proc);stroke:var(--panel)' } : g.kind === 'write' ? { style: 'fill:var(--io);stroke:var(--panel)' } : {};
              kids.push(rect(s, X(g.t0), y + (g.kind === 'seek' ? 9 : 2), X(g.t1) - X(g.t0), g.kind === 'seek' ? 16 : 30, CLS[g.kind], Object.assign({ rx: 2 }, extra)));
            });
            const sum = `A done ${run.aFinish} ms · B done ${run.bFinish} ms · ${run.seeks} long seek${run.seeks === 1 ? '' : 's'}`;
            kids.push(txt(s, x0, y + 52, sum, { class: 's-sub', 'font-size': 13 }));
          }
          function draw() {
            const off = asRun(think, false), on = asRun(think, true);
            const kids = [];
            for (let ms = 0; ms <= T; ms += N ? 50 : 25) {
              kids.push(s('line', { x1: X(ms), y1: N ? 22 : 14, x2: X(ms), y2: H - 4, class: 's-line', style: 'stroke:var(--line);stroke-dasharray:2 4' }));
              kids.push(txt(s, X(ms), N ? 16 : 10, ms + (ms === T ? ' ms' : ''), { 'text-anchor': ms === T ? 'end' : 'middle', class: 's-sub', 'font-size': 12.5 }));
            }
            row(kids, rowY[0], 'No anticipation', off);
            row(kids, rowY[1], 'Wait up to 6 ms', on);
            svg.replaceChildren(...kids);
            const cells = (r) => [r.seeks, r.idle + ' ms', r.aFinish + ' ms', r.bFinish + ' ms'].map((v) => h('td', { class: 'mono' }, String(v)));
            tbl.replaceChildren(
              h('tr', {}, h('th', {}, ''), h('th', {}, 'long seeks'), h('th', {}, 'disk idle'), h('th', {}, 'A done'), h('th', {}, 'B done')),
              h('tr', {}, h('td', {}, 'No anticipation'), ...cells(off)),
              h('tr', { class: on.end < off.end ? 'on' : '' }, h('td', {}, 'Wait up to 6 ms'), ...cells(on)));
            if (on.end < off.end) {
              verdict.className = 'narr ok';
              verdict.innerHTML = `<b>The bet wins.</b> A asks for its next block ${think} ms after each read, inside the 6 ms wait, so the head stays put. Waiting costs ${on.idle} ms of idle disk but saves ${off.seeks - on.seeks} long seeks (${(off.seeks - on.seeks) * AS.seek} ms of arm travel). Even B, the process that was kept waiting, finishes at ${on.bFinish} ms instead of ${off.bFinish} ms.`;
            } else {
              verdict.className = 'narr bad';
              verdict.innerHTML = `<b>The bet loses.</b> A thinks for ${think} ms, longer than the 6 ms wait, so every wait times out and the disk seeks away anyway. The ${on.idle} ms of idling are pure loss: A finishes at ${on.aFinish} ms instead of ${off.aFinish} ms. This is why the real scheduler tracked each process’s think time.`;
            }
          }
          const sl = ctx.ui.slider({ label: 'A’s think time', min: 1, max: 10, step: 1, value: think, format: (v) => v + ' ms', onInput: (v) => { think = v; draw(); } });
          const legend = h('div', { class: 'row gap-s xs' },
            h('span', { class: 'chip proc' }, 'A reads (2 ms)'), h('span', { class: 'chip io' }, 'B writes (2 ms)'), h('span', { class: 'chip intr' }, 'long seek (8 ms)'), h('span', { class: 'chip' }, 'dashed = idle wait'));
          ctx.$('.as').append(
            h('p', { class: 'small m0' }, h('b', {}, 'Scenario. '), 'Process A reads 6 blocks of one file in order, one at a time. Process B has 6 writes queued at the far end of the disk. Without anticipation, a waiting read always goes first.'),
            sl, legend, svg, tbl, verdict);
          draw();
        },
      },

      /* ---------------- 5. CFQ and the modern block layer ---------------- */
      {
        title: 'CFQ, and the Linux block layer today',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const N = ctx.narrow;
          /* ----- tab 1: CFQ round robin ----- */
          function cfqTab(p) {
            const W = N ? 360 : 640, x0 = 6, X = (ms) => x0 + ms * ((W - 2 * x0) / CFQ.horizon), H = 92;
            let base = 100, prio = 4;
            const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'flex:none', role: 'img', 'aria-label': 'One second of disk time shared by three processes' });
            const tbl = h('table', { class: 'tbl compact small' });
            const narr = h('div', { class: 'narr small' });
            const PC3 = { A: 's-proc', B: 's-cpu', C: 's-thread' };
            function draw() {
              const r = cfqRun(base, prio), kids = [];
              kids.push(txt(s, x0, 14, 'One second of disk time', { 'font-weight': 700 }));
              r.segs.forEach((g) => {
                const w = X(g.t1) - X(g.t0);
                if (g.n === 'seek') { kids.push(rect(s, X(g.t0), 30, w, 30, 's-intr', { rx: 1 })); return; }
                kids.push(rect(s, X(g.t0), 22, w, 46, PC3[g.n], { rx: 3 }));
                if (w > 16) kids.push(txt(s, X(g.t0) + w / 2, 50, g.n, { 'text-anchor': 'middle', 'font-weight': 800 }));
              });
              for (let ms = 0; ms <= 1000; ms += N ? 250 : 200) kids.push(txt(s, Math.min(W - 4, Math.max(4, X(ms))), 86, ms + (N && ms < 1000 ? '' : ' ms'), { 'text-anchor': ms === 0 ? 'start' : ms === 1000 ? 'end' : 'middle', class: 's-sub', 'font-size': 12.5 }));
              svg.replaceChildren(...kids);
              const prios = { A: prio, B: 4, C: 4 };
              tbl.replaceChildren(h('tr', {}, ...(N ? ['', 'prio', 'slice', 'share', 'wait'] : ['process', 'priority', 'slice', 'disk share', 'wait between turns']).map((x) => h('th', {}, x))),
                ...r.procs.map((q, i) => h('tr', {}, h('td', { class: 'b' }, q.n), h('td', { class: 'mono' }, String(prios[q.n])), h('td', { class: 'mono' }, q.s + ' ms'),
                  h('td', { class: 'mono' }, Math.round(r.share[i] * 100) + '%'), h('td', { class: 'mono' }, (r.cycle - q.s) + ' ms'))));
              narr.innerHTML = `One full round takes ${r.procs.map((q) => q.s).join(' + ')} ms of slices plus 3 switches × ${CFQ.seek} ms = <b>${r.cycle} ms</b>. The switches eat <b>${Math.round(r.overhead * 1000) / 10}%</b> of the disk’s time. ${base <= 40 ? 'Short slices: quick turns, but many seeks.' : base >= 160 ? 'Long slices: few seeks, but each process waits longer for its turn.' : 'Longer slices mean fewer seeks but longer waits for a turn: the classic trade-off.'}`;
            }
            const sl = ctx.ui.slider({ label: 'Base slice', min: 20, max: 200, step: 10, value: base, format: (v) => v + ' ms', onInput: (v) => { base = v; draw(); } });
            const sg = ctx.ui.seg([{ value: 0, label: '0 (highest)' }, { value: 4, label: '4 (normal)' }, { value: 7, label: '7 (lowest)' }], prio, (v) => { prio = Number(v); draw(); });
            p.append(h('div', { class: 'split l fill' },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0', html: '<span class="t">Completely Fair Queuing (CFQ)</span> (added in 2.6.6, the default from 2.6.18 until it was removed in 5.0) gives the disk to processes in turn, much like round robin gives out the processor.' }),
                h('ul', { class: 'm0 small', style: { lineHeight: 1.45 }, html: '<li>Each process’s <b>synchronous</b> requests (mostly reads) go into that process’s own queue. Asynchronous writes share a few queues, one per priority level.</li><li>Queues take turns. A turn is a <b>time slice</b> of the disk: 100 ms by default for synchronous queues. Inside its slice a queue is served in sector order.</li><li>A process’s <span class="t">I/O priority</span>, 0 (highest) to 7 (lowest), set with <code>ionice</code>, stretches or shrinks its slice: slice = base + base/5 × (4 − priority).</li>' }),
                h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'A process that floods the disk with requests can no longer shut out one that asks for a block now and then. The light user waits, at worst, for the other processes’ slices.' })),
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'small m0' }, h('b', {}, 'Three always-busy processes '), 'in different parts of the disk. Moving to another process’s area costs one 8 ms seek.'),
                sl, h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'A’s I/O priority'), sg), svg, tbl, narr)));
            draw();
          }
          /* ----- tab 2: blk-mq ----- */
          function mqTab(p) {
            const W = N ? 360 : 500, H = 236;
            let multi = true;
            const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'CPUs, request queues and the device' });
            const cap = h('p', { class: 'small m0', style: { minHeight: '44px' } });
            function draw() {
              const kids = [], n = 4, cw = (W - 30) / n, cx = (i) => 15 + cw * i + cw / 2;
              for (let i = 0; i < n; i++) { kids.push(rect(s, cx(i) - cw / 2 + 6, 6, cw - 12, 34, 's-cpu')); kids.push(txt(s, cx(i), 28, 'CPU ' + i, { 'text-anchor': 'middle', 'font-weight': 700 })); }
              if (!multi) {
                for (let i = 0; i < n; i++) kids.push(s('line', { x1: cx(i), y1: 42, x2: W / 2, y2: 92, class: 's-line', 'marker-end': 'url(#arr)' }));
                kids.push(rect(s, W / 2 - 110, 96, 220, 52, 's-os'));
                kids.push(txt(s, W / 2, 118, 'one request queue', { 'text-anchor': 'middle', 'font-weight': 700 }));
                kids.push(txt(s, W / 2, 138, 'one lock for everyone', { 'text-anchor': 'middle', 'font-size': 12.5, style: 'fill:var(--bad);font-weight:700' }));
                kids.push(s('line', { x1: W / 2, y1: 150, x2: W / 2, y2: 182, class: 's-line', 'marker-end': 'url(#arr)' }));
              } else {
                for (let i = 0; i < n; i++) {
                  kids.push(s('line', { x1: cx(i), y1: 42, x2: cx(i), y2: 62, class: 's-line', 'marker-end': 'url(#arr)' }));
                  kids.push(rect(s, cx(i) - cw / 2 + 4, 66, cw - 8, 30, 's-os'));
                  kids.push(txt(s, cx(i), 86, N ? 'sw queue' : 'software queue', { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }));
                }
                [0, 1].forEach((k) => {
                  const hx = W / 4 + k * (W / 2);
                  [0, 1].forEach((j) => kids.push(s('line', { x1: cx(2 * k + j), y1: 98, x2: hx, y2: 124, class: 's-line', 'marker-end': 'url(#arr)' })));
                  kids.push(rect(s, hx - 70, 128, 140, 30, 's-io'));
                  kids.push(txt(s, hx, 148, 'hardware queue ' + k, { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }));
                  kids.push(s('line', { x1: hx, y1: 160, x2: W / 2 + (k ? 30 : -30), y2: 182, class: 's-line', 'marker-end': 'url(#arr)' }));
                });
              }
              kids.push(rect(s, W / 2 - 120, 186, 240, 42, 's-io'));
              kids.push(txt(s, W / 2, 212, multi ? 'NVMe SSD (many queues)' : 'disk', { 'text-anchor': 'middle', 'font-weight': 800 }));
              svg.replaceChildren(...kids);
              cap.innerHTML = multi
                ? '<b>blk-mq (3.13 and later).</b> Each CPU queues requests without waiting for the others. A scheduler, if one is chosen, works on top of these queues. A drive with several hardware queues takes requests on all of them in parallel.'
                : '<b>The old single-queue layer.</b> Every CPU had to take the same lock to add or remove a request. That was fine for a disk doing a few hundred requests per second, but a bottleneck for a solid-state drive doing hundreds of thousands.';
            }
            const sg = ctx.ui.seg([{ value: 'single', label: 'Before: one queue' }, { value: 'multi', label: 'blk-mq' }], 'multi', (v) => { multi = v === 'multi'; draw(); });
            p.append(h('div', { class: 'split fill' },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0', html: 'Every scheduler so far was designed for spinning disks, where a seek costs milliseconds. A <span class="t" data-t="Solid-state disk (SSD)">solid-state drive</span> has no arm to move and can finish hundreds of thousands of requests per second. An <b>NVMe</b> drive, an SSD attached straight to the fast PCI Express bus, even takes requests on many hardware queues at once.' }),
                h('p', { class: 'm0', html: 'The <span class="t">multi-queue block layer (blk-mq)</span>, added in Linux 3.13, gives each CPU its own queue. Since <b>5.0</b> it is the only block layer: the old single-queue path, with noop, deadline and CFQ, was deleted.' }),
                h('div', { class: 'card tight white small', html: 'See and switch the scheduler of a device (the active one is in brackets):<br><code>cat /sys/block/sda/queue/scheduler</code><br><code>[mq-deadline] kyber bfq none</code>' }),
                h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking “deadline” and “mq-deadline” are one scheduler. mq-deadline is a rewrite for blk-mq (4.11); the original deadline scheduler disappeared with the single-queue layer in 5.0.' })),
              h('div', { class: 'stack', style: { gap: '8px' } }, sg, svg, cap)));
            draw();
          }
          /* ----- tab 3: pick a scheduler ----- */
          function pickTab(p) {
            const S = [
              ['mq-deadline', 'os', 'The <span class="t">mq-deadline</span> scheduler: sector order plus read and write expiry times. Cheap, and the kernel’s default for devices with one hardware queue.'],
              ['BFQ', 'proc', '<span class="t">Budget Fair Queueing (BFQ)</span>: per-process budgets of sectors and weights; keeps interactive programs responsive. Uses the most processor time per request.'],
              ['Kyber', 'mem', '<span class="t">Kyber</span>: limits how many requests are in flight so that reads and synchronous writes meet target latencies. Very little overhead.'],
              ['none', 'io', 'No reordering at all: requests go straight to the device. The kernel’s default for devices with many hardware queues, such as NVMe drives.'],
            ];
            const Q = [
              ['A SATA hard disk in a file server', 0, 'Seeks are costly on a spinning disk, so sorting by sector pays, and the expiry times stop any request from waiting forever.'],
              ['A desktop where music must not stutter while a big copy runs', 1, 'BFQ shares the disk by process and boosts interactive and soft real-time programs, so the music player keeps getting its turn.'],
              ['A fast NVMe SSD in a database server', 3, 'There is no arm to save, and the drive reorders requests itself. Any extra work per request is pure overhead.'],
              ['A fast SSD whose reads must stay quick during heavy writing', 2, 'When reads start missing their latency target, Kyber lets fewer requests into the device at once, so writes cannot swamp it, at almost no processor cost.'],
            ];
            const cards = S.map(([n, c, d]) => h('div', { class: 'card tight ' + c }, h('b', {}, n), h('div', { class: 'small', html: d })));
            const out = h('div', { class: 'narr', style: { minHeight: '96px' } }, 'Pick a device on the right to see the scheduler most often chosen for it, and why.');
            const btns = Q.map((q, i) => h('button', { class: 'btn', type: 'button', style: { justifyContent: 'flex-start', whiteSpace: 'normal', height: 'auto', minHeight: '44px', padding: '6px 12px', textAlign: 'left' }, onclick: () => {
              btns.forEach((b, j) => b.classList.toggle('on', j === i));
              cards.forEach((c, j) => { c.style.outline = j === q[1] ? '3px solid var(--accent)' : ''; });
              out.className = 'narr ok';
              out.innerHTML = `<b>${q[0]} → ${S[q[1]][0]}.</b> ${q[2]}`;
            } }, q[0]));
            p.append(h('div', { class: 'split fill' },
              h('div', { class: 'stack', style: { gap: '8px' } }, h('p', { class: 'm0' }, 'Since Linux 5.0 a device can use one of four choices:'), ...cards),
              h('div', { class: 'stack', style: { gap: '8px' } }, h('p', { class: 'm0 b' }, 'Which one fits?'), ...btns, out,
                h('p', { class: 'xs muted m0' }, 'These are common choices, not laws: distributions pick their own defaults, and the right answer depends on the workload.'))));
          }
          el.append(ctx.ui.tabs([
            { label: 'CFQ: fair turns', render: cfqTab },
            { label: 'blk-mq (3.13 and later)', render: mqTab },
            { label: 'Which scheduler?', render: pickTab },
          ]));
        },
      },

      /* ---------------- 6. Page cache and flusher ---------------- */
      {
        title: 'The page cache and its flusher threads',
        kind: 'lab',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0 small">Linux keeps file data in one <span class="t">page cache</span>. Older kernels also had a separate <span class="t">buffer cache</span> for disk blocks, so the same data could sit in memory twice; during the 2.4 series the two became one.</p>
              <p class="m0 small"><b>Why delay writes?</b> (1) Dirty pages can later go to the disk together, <b>sorted by sector</b>, which suits the disk. (2) Pages used recently are found again in memory with no disk access. A page changed ten times may even reach the disk once.</p>
              <p class="m0 small"><b>When does a <span class="t">dirty page</span> go to disk?</b> <span class="t">Writeback</span> is done by <span class="t" data-t="flusher thread">flusher threads</span> when either</p>
              <div class="card tight mem small"><b>Memory is short:</b> free memory falls below a threshold. Clean pages can be dropped at once, so writing dirty pages back makes their frames reclaimable. (Today’s kernels also start when dirty pages pass 10% of memory.)</div>
              <div class="card tight os small"><b>A page is old:</b> it has been dirty longer than an age limit. Linux’s default is 30 s, checked by a flusher that wakes every 5 s.</div>
              <p class="m0 xs muted">Linux 2.6 used a shared pool of pdflush threads; 2.6.32 gave each storage device its own flusher (later kernels run that work on general kernel worker threads).</p>
            </div>
            <div class="stack pc" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const N = ctx.narrow, cols = N ? 6 : 8, rows = PC.frames / cols, W = N ? 360 : 640, cw = (W - (cols - 1) * 6) / cols, ch = N ? 50 : 62, H = rows * (ch + 6);
          let memMin = 4, ageMax = 30, states = pcRun(memMin, ageMax);
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'The 24 page frames of the page cache' });
          const stats = h('div', { class: 'row gap-s small' });
          const fmtList = (a) => a.join(', ');
          function draw(i) {
            const st = states[i], kids = [];
            const flushed = new Set(st.log.flatMap((l) => l.pages));
            st.slots.forEach((p, k) => {
              const x = (k % cols) * (cw + 6), y = Math.floor(k / cols) * (ch + 6);
              if (!p) { kids.push(rect(s, x, y, cw, ch, 's-panel', { 'stroke-dasharray': '4 3', style: 'stroke:var(--line-2)' })); kids.push(txt(s, x + cw / 2, y + ch / 2 + 5, 'free', { 'text-anchor': 'middle', class: 's-sub', 'font-size': 12.5 })); return; }
              kids.push(rect(s, x, y, cw, ch, p.dirty ? 's-warn' : 's-mem', flushed.has(p.k) ? { 'stroke-width': 3.5, style: 'stroke:var(--ok)' } : {}));
              kids.push(txt(s, x + cw / 2, y + (N ? 22 : 26), p.k, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }));
              kids.push(txt(s, x + cw / 2, y + (N ? 41 : 47), p.dirty ? (N ? p.age + ' s' : 'dirty ' + p.age + ' s') : flushed.has(p.k) ? (N ? 'saved' : 'just saved') : 'clean', { 'text-anchor': 'middle', 'font-size': 12.5, style: p.dirty ? 'font-weight:700' : '' }));
            });
            svg.replaceChildren(...kids);
            const reads = st.hits + st.misses;
            stats.replaceChildren(
              h('span', { class: 'chip' + (st.free <= memMin ? ' warn' : '') }, `free frames ${st.free} (threshold ${memMin})`),
              h('span', { class: 'chip warn' }, `dirty ${st.dirty} · oldest ${st.oldest} s`),
              h('span', { class: 'chip io' }, `disk writes ${st.writes} (for ${st.calls} write call${st.calls === 1 ? '' : 's'})`),
              h('span', { class: 'chip mem' }, `reads from memory ${st.hits}/${reads}`));
            const evs = st.ev.filter((e) => e.op === 'w').map((e) => e.page);
            let cap = `<b>t = ${st.t} s.</b> ${evs.length ? `Writes change ${fmtList(evs)} in memory only. ` : ''}`;
            const rd = st.ev.filter((e) => e.op === 'r');
            cap += rd.map((e) => `${e.page} is read${e.hit ? ' from memory' : ' from disk and cached'}`).join('; ') + '. ';
            st.log.forEach((l) => {
              if (l.why === 'wake') cap += l.pages.length ? `<b>The flusher wakes</b> and writes ${fmtList(l.pages)} (dirty ≥ ${ageMax} s)${l.pages.length > 1 ? ', in sector order' : ''}. ` : `The flusher wakes: no page has been dirty for ${ageMax} s yet. `;
              else cap += `<b>Free frames fell to ${l.before}, below ${memMin}.</b> ${l.pages.length ? `The flusher writes back ${fmtList(l.pages)}${l.pages.length > 1 ? ' in sector order' : ''}; ` : 'No page is dirty; '}then the least recently used clean pages (${fmtList(l.freed)}) are freed. `;
            });
            return cap;
          }
          const player = ctx.ui.player({ count: states.length, interval: 900, render: (i) => draw(i) });
          const recompute = () => { states = pcRun(memMin, ageMax); player.refresh(); };
          const s1 = ctx.ui.slider({ label: 'Free-memory threshold', min: 2, max: 8, step: 1, value: memMin, format: (v) => v + ' frames', onInput: (v) => { memMin = v; recompute(); } });
          const s2 = ctx.ui.slider({ label: 'Age limit', min: 5, max: 30, step: 5, value: ageMax, format: (v) => v + ' s', onInput: (v) => { ageMax = v; recompute(); } });
          ctx.$('.pc').append(
            h('p', { class: 'xs muted m0' }, 'Workload: a log file gets a new line every 2 s (L0, L1, …); an editor autosaves two pages (D0, D1) every 10 s; a program keeps rereading four pages (P0–P3); from 24 s a media player streams a big file once (M0, M1, …).'),
            s1, s2, svg, stats, player.el);
        },
      },

      /* ---------------- 7. Recap ---------------- */
      {
        title: 'Recap: Linux I/O in six cards',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['The 2.4 elevator’s four checks', 'Merge with a neighbouring request → if some request is too old, go to the tail → otherwise insert in sector order → if nothing fits, append at the tail.'],
              ['Deadline scheduler', 'Sorted queue + read FIFO (expiry 500 ms) + write FIFO (5 s). An expired FIFO head is served next, then the sweep continues from its sector.'],
              ['Anticipatory scheduler', 'After a read, idle up to about 6 ms for the same process’s next nearby read. Beats deceptive idleness; loses when think time is longer. Gone since 2.6.33.'],
              ['CFQ', 'One queue per process, served in round robin with time slices (100 ms for synchronous queues); I/O priority 0–7 stretches or shrinks the slice. Default 2.6.18 until 5.0.'],
              ['Linux 5.0 and later', 'Only blk-mq (since 3.13): per-CPU software queues feeding hardware queues. Schedulers: mq-deadline, BFQ, Kyber or none.'],
              ['When dirty pages go to disk', 'When free memory falls below a threshold, or when a page has been dirty longer than the age limit (30 s by default). Done by pdflush (2.6), per-device flushers since 2.6.32.'],
            ], { cols: ctx.narrow ? 1 : 3, height: ctx.narrow ? 160 : 222 })));
        },
      },

      /* ---------------- 8. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'The Linux 2.4 elevator has a pending write for sectors 120–127 when a new write for sectors 128–135 arrives. What happens to the new request?',
            choices: ['It is inserted in sector order just behind the pending write', 'It is appended at the tail, behind every other request', 'It is joined with the pending write into one request', 'It goes straight to the disk, ahead of the whole queue'],
            answer: 2,
            feedback: ['Merging is checked before sorted insertion. Because the sectors are adjacent and both are writes, the two become one request.', 'The tail is used only when a request is too old or nothing else fits; here a merge is possible.', null, 'The elevator never lets a newcomer skip the queue like this; it merges, inserts or appends.'],
            why: 'The first check is merging: a new request for the sectors right next to a pending request of the same direction is joined to it (a back merge here), giving one request for sectors 120–135.' },
          { type: 'order', q: 'Put the checks the Linux 2.4 elevator applies to each new request in order.',
            items: ['Try to merge it with a pending request for the neighbouring sectors', 'If some pending request is too old, add the new one at the tail', 'Otherwise insert it at its place in sector order', 'If no place in sector order fits, append it at the tail'],
            why: 'Merge first (cheapest), then the starvation guard, then sorted insertion, and finally the tail as the fallback.' },
          { type: 'num', q: 'Under the deadline scheduler with its default settings, a read request enters the queue at t = 1.2 s. At what time, in seconds, does it expire?', answer: 1.7, tol: 0.001, unit: 's',
            why: 'The default read expiry time is 500 ms = 0.5 s, so the request expires at 1.2 + 0.5 = 1.7 s. From then on, the next time the scheduler checks the read FIFO, it serves this request ahead of sector order.' },
          { type: 'tf', q: 'In the deadline scheduler, every request sits in the sorted queue and also in exactly one of the two FIFO queues.', answer: true,
            why: 'Each request is in the sorted (elevator) queue and in the read FIFO or the write FIFO, depending on its direction. The FIFO tells the scheduler which request has waited longest.' },
          { q: 'Why does the deadline scheduler give reads a much shorter expiry time (500 ms) than writes (5 s)?',
            choices: ['A process usually waits for its read, but most writes finish in the background', 'Reads move far less data than writes, so they always finish sooner', 'Writes must be sorted before they reach the disk, so they need extra time', 'Disks read faster than they write, so a read needs less time to complete'],
            answer: 0,
            feedback: [null, 'The size of a request has nothing to do with it; a read can be large and a write small.', 'Both reads and writes are kept in the sorted queue; neither needs extra sorting time.', 'The expiry time is about how long a request may wait, not about how fast the disk works.'],
            why: 'Most reads are synchronous: the process is blocked until the data arrives. Most writes land in the page cache first, so the process keeps running while the write waits.' },
          { q: 'Which problem does the anticipatory scheduler attack?',
            choices: ['A stream of reads that keeps every write waiting forever', 'Seeking away just before the same process asks for a nearby block', 'Many CPUs fighting over the lock of one request queue', 'Dirty pages that stay in memory much longer than they should'],
            answer: 1,
            feedback: ['The deadline FIFOs already bound waiting; anticipation is about seeks, not starvation.', null, 'That is the problem blk-mq solves with per-CPU queues.', 'That is the job of the flusher threads and their age limit.'],
            why: 'Between two reads of a sequential reader, its queue looks empty (deceptive idleness). Waiting a few milliseconds for its next request avoids a seek away and a seek back.' },
          { q: 'Which statement about the anticipatory scheduler is true?',
            choices: ['It became the default scheduler for blk-mq devices in Linux 5.0', 'It improves throughput whatever the think time of the reading process', 'It waits after every request for any process at all, reads or writes', 'It was removed in 2.6.33, and CFQ kept a similar short idle wait'],
            answer: 3,
            feedback: ['It was deleted in 2.6.33, long before 5.0; the blk-mq choices are mq-deadline, BFQ, Kyber and none.', 'If the next read comes after the wait ends (about 6 ms), the disk has idled for nothing.', 'It waits after a read, for the next request of that same process.', null],
            why: 'The anticipatory scheduler was the default from 2.6.0 to 2.6.17 and was removed in 2.6.33. CFQ already idled briefly for a process’s next request, so the idea lived on.' },
          { type: 'num', q: 'CFQ serves 4 always-busy processes, each with a 100 ms time slice. Ignoring the cost of switching, how many milliseconds does one process wait between the end of its slice and the start of its next one?', answer: 300, tol: 0, unit: 'ms',
            why: 'The other three processes each use their 100 ms slice first: 3 × 100 = 300 ms. With seeks between areas the real wait is a little longer.' },
          { type: 'bucket', q: 'Which I/O schedulers can a Linux 5.0 (or later) kernel still use, and which were removed?', buckets: ['Available in 5.0 and later', 'Removed'],
            items: [['mq-deadline', 0], ['BFQ', 0], ['Kyber', 0], ['none (no reordering)', 0], ['CFQ', 1], ['Anticipatory', 1], ['noop (single-queue)', 1]],
            why: 'Linux 5.0 deleted the single-queue block layer and with it noop, deadline and CFQ; the anticipatory scheduler was already gone in 2.6.33. blk-mq devices choose among mq-deadline, BFQ, Kyber and none.' },
          { type: 'match', q: 'Match each Linux version with the change it brought.',
            pairs: [['2.6.18', 'CFQ becomes the default scheduler'], ['2.6.32', 'Per-device flushers replace pdflush'], ['2.6.33', 'The anticipatory scheduler is removed'], ['3.13', 'The multi-queue block layer arrives'], ['5.0', 'The single-queue layer and CFQ are deleted']],
            why: 'CFQ default (2.6.18), per-device flusher threads (2.6.32), anticipatory removed (2.6.33), blk-mq added (3.13), single-queue path removed (5.0).' },
          { type: 'multi', q: 'The Linux page cache keeps file pages in main memory and writes dirty pages to the disk later rather than at once. Which are real benefits of this design?',
            choices: ['Dirty pages can later be written together in an order that suits the disk', 'A page changed many times may reach the disk only once', 'Data that was just written can be read again from memory', 'No data can be lost if the power fails'], answer: [0, 1, 2],
            why: 'Delaying writes lets the kernel sort and batch them and absorbs repeated changes; keeping the pages cached serves the next read from memory. The price is the opposite of the last choice: dirty data not yet written is lost in a power failure.' },
          { type: 'num', q: 'A page first becomes dirty at t = 12 s and is not touched again. Memory is plentiful. The age limit is 30 s and the flusher wakes at t = 5, 10, 15, … s. At what time, in seconds, is the page written to disk?', answer: 45, tol: 0, unit: 's',
            why: 'The page becomes due at 12 + 30 = 42 s, but nothing checks until the flusher’s next wake-up, which is at 45 s.' },
        ],
      },

    ],
    notes: `
      <h3>Linux I/O: two stops before the disk</h3>
      <p>A file read or write in Linux passes two kernel layers. The <b>page cache</b> answers reads from memory when it can and absorbs writes as <b>dirty pages</b>. Requests that really need the device wait in a queue, and the <b>I/O scheduler</b> (Linux calls it the <b>elevator</b>) decides their order.</p>
      <table>
        <tr><th>Version</th><th>What changed</th></tr>
        <tr><td>2.4 (2001)</td><td>The Linux elevator; during 2.4 the buffer cache is folded into one unified page cache</td></tr>
        <tr><td>2.6.0 (2003)</td><td>Pluggable schedulers: deadline, anticipatory (default), noop; writeback by pdflush threads</td></tr>
        <tr><td>2.6.18 (2006)</td><td>CFQ (added in 2.6.6) becomes the default</td></tr>
        <tr><td>2.6.32 (2009)</td><td>One flusher thread per storage device replaces pdflush</td></tr>
        <tr><td>2.6.33 (2010)</td><td>Anticipatory scheduler removed</td></tr>
        <tr><td>3.13 (2014)</td><td>Multi-queue block layer (blk-mq)</td></tr>
        <tr><td>4.11 / 4.12 (2017)</td><td>mq-deadline (4.11), BFQ and Kyber (4.12) for blk-mq</td></tr>
        <tr><td>5.0 (2019)</td><td>Single-queue layer deleted, with noop, deadline and CFQ</td></tr>
      </table>

      <h3>The Linux 2.4 elevator</h3>
      <p>One request queue, kept in the order the head will sweep it: sectors at or above the head in ascending order, then (after the sweep wraps) the sectors below the head. Each new request goes through four checks, in order:</p>
      <ol>
        <li><b>Merge.</b> If a pending request of the same direction (read or write) covers the sectors right next to the new one, the two are joined into one request: a <i>back merge</i> if the new request continues the old one, a <i>front merge</i> if it comes just before it. Example: pending write 120–127 plus new write 128–135 gives one write 120–135.</li>
        <li><b>Age guard.</b> If some pending request has waited too long, the newcomer is added at the tail, so nobody passes the old request again. The 2.4 code measured age not by the clock but by how many sectors of newer work had already been allowed to jump ahead of a request, with a smaller limit for reads than for writes (the lab simply counts jumps, with a limit of 3). (The real code still sorted the newcomer among the requests behind the old one rather than always using the very tail.)</li>
        <li><b>Sorted insertion</b> at the request's place in the sweep. Every request behind it has been jumped once more.</li>
        <li><b>Append at the tail</b> if no place in the sweep fits (for example, a request behind the head belongs to the next sweep).</li>
      </ol>
      <p><b>Weaknesses:</b> requests far from the head can wait a long time (the guard is crude), and reads share one sorted queue with writes with no real priority (only a smaller jump limit). Yet most reads are <b>synchronous requests</b>: the process is blocked until the data arrives. Most writes are asynchronous: they sit in the page cache and the process keeps running.</p>

      <h3>The deadline scheduler (2.6)</h3>
      <p>Three queues. Every request is in the <b>sorted queue</b> and in either the <b>read FIFO</b> or the <b>write FIFO</b>. Default <b>expiry times</b>: 500 ms for reads, 5 s for writes. Before each dispatch: if the oldest request of a FIFO has expired, it is served next and the sweep carries on from its sector; otherwise the next request in sector order is served. Reads get the shorter clock because programs wait for them. (The real code keeps separate sorted lists for reads and writes, dispatches in batches of up to 16 requests, checks the FIFOs only when a batch starts, and prefers reads but never passes over waiting writes more than twice in a row.)</p>
      <p><b>Worked example (the lab):</b> every request takes 40 ms; a backup job keeps four writes pending ahead of the head; read R1 at sector 40 arrives at t = 0, behind the head. With the plain elevator new writes keep landing ahead of the head, so R1 waits 920 ms. With the deadline scheduler R1 expires at 500 ms and is served at the next dispatch, t = 520 ms. A read that arrives at 1.2 s expires at 1.7 s.</p>

      <h3>The anticipatory scheduler (2.6.0 to 2.6.32)</h3>
      <p>A sequential reader issues a read, waits for it, computes briefly (its <b>think time</b>), then asks for the next block. In that gap its queue is empty, so a scheduler may wrongly conclude it is finished (<b>deceptive idleness</b>) and seek away, only to seek back a moment later. The anticipatory scheduler, built on the deadline scheduler and the default from 2.6.0 to 2.6.17, keeps the disk idle for up to about 6 ms after a read, waiting for a nearby request from the same process. The bet wins when think time is shorter than the wait and loses when it is longer, so the real scheduler kept per-process statistics (average think time and seek distance) and waited only when it was likely to pay. It was removed in 2.6.33; CFQ, and later BFQ, keep a similar short idle wait.</p>
      <p><b>Worked example (the lab):</b> A reads 6 blocks (2 ms each, think time 2 ms); B has 6 writes far away; a long seek costs 8 ms; a waiting read always goes first. Without anticipation every read costs a seek away and a seek back: 11 long seeks, A done at 102 ms, B at 112 ms. Waiting up to 6 ms: 1 long seek, 16 ms of idle disk, A done at 22 ms and even B done at 48 ms. With an 8 ms think time every wait times out: still 11 seeks plus 36 ms of wasted idling.</p>

      <h3>Completely Fair Queuing (CFQ)</h3>
      <p>Added in 2.6.6, the default from 2.6.18 until its removal in 5.0. Each process's synchronous requests go into its own queue; asynchronous writes share a few queues, one per priority level. The queues are served in round robin; each turn is a time slice of the disk (100 ms by default for synchronous queues), and within a slice requests are served in sector order. The <b>I/O priority</b> (0 highest to 7 lowest, set with <i>ionice</i>) scales the slice: slice = base + base/5 × (4 − priority), so with a 100 ms base, priority 0 gets 180 ms and priority 7 gets 40 ms. So a process that floods the disk cannot shut out a light user. With n busy processes and slice q, a process waits (n − 1) × q between turns plus the switching seeks; for 4 processes and 100 ms that is 300 ms. Longer slices: fewer seeks, longer waits.</p>

      <h3>Linux today: blk-mq</h3>
      <p>Solid-state drives have no arm and complete hundreds of thousands of requests per second, so one queue behind one lock became a bottleneck. The <b>multi-queue block layer (blk-mq)</b>, added in 3.13, gives each CPU its own software queue feeding one or more hardware queues. Since 5.0 it is the only block layer. The choices are:</p>
      <ul>
        <li><b>mq-deadline</b>: sector order plus read and write expiry; the default for devices with a single hardware queue (such as SATA disks).</li>
        <li><b>BFQ (Budget Fair Queueing)</b>: per-process budgets of sectors and weights; favours interactive and soft real-time programs; the most processor time per request.</li>
        <li><b>Kyber</b>: limits requests in flight so reads and synchronous writes meet target latencies; very light.</li>
        <li><b>none</b>: no reordering; the default for devices with many hardware queues, such as NVMe drives (SSDs attached straight to the PCI Express bus).</li>
      </ul>
      <p>The active scheduler is shown in brackets in /sys/block/&lt;device&gt;/queue/scheduler. mq-deadline is a rewrite; the original deadline scheduler was deleted in 5.0.</p>

      <h3>The page cache and writeback</h3>
      <p>Older kernels had a page cache for file pages and a separate buffer cache for disk blocks, so data could be cached twice; during the 2.4 series they became one unified <b>page cache</b>. Delaying writes has two main benefits: dirty pages can later be written together, sorted by sector, in an order that suits the disk; and recently used pages can be used again from memory. A page changed many times may reach the disk only once. The cost: dirty data is lost in a power failure.</p>
      <p><b>Writeback</b> is done by <b>flusher threads</b> (a pool of pdflush threads in 2.6; one flusher per storage device from 2.6.32; later kernels run that work on general kernel worker threads). Dirty pages are written when:</p>
      <ul>
        <li><b>free memory falls below a threshold</b>: clean pages can be freed immediately, so writing dirty pages back makes their frames reclaimable (current kernels state this trigger as a share of memory: background writeback starts when dirty pages exceed 10% of available memory by default);</li>
        <li><b>a page has been dirty longer than an age limit</b>: 30 s by default, checked by a flusher that wakes every 5 s.</li>
      </ul>
      <p><b>Worked example:</b> a page first dirtied at t = 12 s becomes due at 42 s and is written at the next wake-up, 45 s. A short age limit means more disk writes but less data at risk; a long one, the reverse.</p>
    `,
  });
})();
