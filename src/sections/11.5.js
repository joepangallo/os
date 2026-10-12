/* =====================================================================
   11.5 Disk Scheduling
   Original teaching material. One deterministic disk-arm engine (plan for
   a queue that is all present, runDyn for requests that arrive over time,
   runProcs for processes that each read their own file) drives every chart,
   table, caption and score in the section. Helpers live in this IIFE.
   ===================================================================== */
(function () {
  /* ENGINE-BEGIN ------------------------------------------------------
     Pure disk-arm code (no DOM). dev/qa-11.5/engine.test.js extracts this
     exact block and checks it against hand-computed results.          */
  const LAST = 199;                                   // tracks are numbered 0..199
  const CLASSIC = [55, 58, 39, 18, 90, 160, 150, 38, 184];
  function rng32(a) {                                 // small seeded generator (same seed, same order)
    return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const closest = (list, from) => list.reduce((b, p) => (Math.abs(p.t - from) < Math.abs(b.t - from) || (Math.abs(p.t - from) === Math.abs(b.t - from) && p.i < b.i) ? p : b), list[0]);
  /* plan(): serve a queue that is all present at the start.
     Each served request records the path the arm took to reach it
     (pts = waypoints, jump = index of a return segment that serves nothing,
     or -1) and its seek length = every track the arm passed since the
     previous service, including any trip to the edge and any return.   */
  function plan(reqs, head, up, pol, seed) {
    const pend = reqs.map((t, i) => ({ t, i }));
    const steps = [];
    let pos = head, dir = up ? 1 : -1;
    const rnd = rng32(seed || 7);
    while (pend.length) {
      let pick = null, jump = -1, turned = false;
      const pts = [pos], before = pend.map((p) => p.t);
      if (pol === 'fifo') pick = pend[0];
      else if (pol === 'lifo') pick = pend[pend.length - 1];
      else if (pol === 'rss') pick = pend[Math.floor(rnd() * pend.length)];
      else if (pol === 'sstf') pick = closest(pend, pos);
      else {
        const ahead = pend.filter((p) => (p.t - pos) * dir >= 0);
        if (ahead.length) pick = closest(ahead, pos);
        else if (pol === 'scan' || pol === 'look') {
          const edge = dir > 0 ? LAST : 0;
          if (pol === 'scan' && pos !== edge) pts.push(edge);
          dir = -dir; turned = true;
          pick = closest(pend, pts[pts.length - 1]);
        } else if (pol === 'cscan') {
          const edge = dir > 0 ? LAST : 0, other = dir > 0 ? 0 : LAST;
          if (pos !== edge) pts.push(edge);
          jump = pts.length - 1; pts.push(other); turned = true;
          pick = closest(pend, other);
        } else {                                       // clook: jump to the far end of the waiting requests
          jump = 0; turned = true;
          pick = pend.reduce((b, p) => ((dir > 0 ? p.t < b.t : p.t > b.t) || (p.t === b.t && p.i < b.i) ? p : b), pend[0]);
        }
      }
      if (pick.t !== pts[pts.length - 1] || pts.length === 1) pts.push(pick.t);
      let dist = 0;
      for (let k = 1; k < pts.length; k++) dist += Math.abs(pts[k] - pts[k - 1]);
      pend.splice(pend.indexOf(pick), 1);
      steps.push({ t: pick.t, i: pick.i, from: pos, pts, jump, dist, turned, dir, before, left: pend.map((p) => p.t) });
      pos = pick.t;
    }
    const total = steps.reduce((a, s) => a + s.dist, 0);
    return { steps, total, avg: steps.length ? total / steps.length : 0 };
  }
  /* best(): the least total arm movement for a batch that is all present:
     sweep to the nearer end of the requests first, then to the other end. */
  function best(reqs, head) {
    if (!reqs.length) return 0;
    const lo = Math.min(head, ...reqs), hi = Math.max(head, ...reqs);
    return Math.min((head - lo) * 2 + (hi - head), (hi - head) * 2 + (head - lo));
  }
  /* rssMean(): average seek length of random order, over n shuffles. */
  function rssMean(reqs, head, n) {
    let sum = 0;
    for (let k = 1; k <= n; k++) sum += plan(reqs, head, true, 'rss', k * 7919).avg;
    return sum / n;
  }
  /* runDyn(): requests that ARRIVE over time.
     reqs = [{id, track, arr, seq}] with arr in tenths of a millisecond.
     Toy timing: the arm needs 0.1 ms per track (1 tenth) and every request
     then needs 2 ms (SVC = 20 tenths) of rotation + transfer.
     pol: fifo | sstf | scan (reverses at the last request) | nstep | fscan.
     New arrivals join the queue only at decision points (between services). */
  const SVC = 20;
  function runDyn(reqs, head, up, pol, N) {
    const todo = reqs.slice().sort((a, b) => a.arr - b.arr || a.seq - b.seq);
    let now = 0, pos = head, dir = up ? 1 : -1, moved = 0, batchNo = 0, guard = 0;
    let pend = [], active = [], later = [];        // one queue | the batch being swept + what waits behind it
    const done = [], segs = [], batches = [];
    const admit = () => {
      while (todo.length && todo[0].arr <= now) {
        const r = Object.assign({}, todo.shift());
        if (pol === 'fscan') later.push(r);
        else if (pol === 'nstep') { const last = later[later.length - 1]; if (last && last.length < N) last.push(r); else later.push([r]); }
        else pend.push(r);
      }
    };
    const sweepPick = (list) => {
      let ahead = list.filter((r) => (r.track - pos) * dir >= 0);
      if (!ahead.length) { dir = -dir; ahead = list; }
      return ahead.reduce((b, r) => (Math.abs(r.track - pos) < Math.abs(b.track - pos) ? r : b), ahead[0]);
    };
    while ((todo.length || pend.length || active.length || later.length) && guard++ < 5000) {
      admit();
      if (!active.length && later.length && (pol === 'fscan' || pol === 'nstep')) {
        active = pol === 'fscan' ? later : later.shift();
        if (pol === 'fscan') later = [];
        batchNo++; batches.push({ at: now, ids: active.map((r) => r.id) });
      }
      const pool = pol === 'fscan' || pol === 'nstep' ? active : pend;
      if (!pool.length) { if (todo.length) { segs.push({ x0: pos, t0: now, x1: pos, t1: todo[0].arr, idle: true }); now = todo[0].arr; } continue; }
      let r;
      if (pol === 'fifo') r = pool[0];
      else if (pol === 'sstf') r = pool.reduce((b, q) => (Math.abs(q.track - pos) < Math.abs(b.track - pos) ? q : b), pool[0]);
      else r = sweepPick(pool);
      pool.splice(pool.indexOf(r), 1);
      const d = Math.abs(r.track - pos);
      segs.push({ x0: pos, t0: now, x1: r.track, t1: now + d, seek: true });
      segs.push({ x0: r.track, t0: now + d, x1: r.track, t1: now + d + SVC, svc: true, id: r.id });
      moved += d; now += d + SVC; pos = r.track;
      done.push({ id: r.id, track: r.track, arr: r.arr, start: now - d - SVC, reach: now - SVC, fin: now, resp: now - r.arr, batch: batchNo, tag: r.tag });
    }
    const resp = done.map((x) => x.resp);
    return { done, segs, batches, moved, end: now, mean: resp.reduce((a, b) => a + b, 0) / (resp.length || 1), max: Math.max(...resp) };
  }
  /* runProcs(): P processes each read READS neighbouring tracks of their own
     file, one request at a time: a process issues its next request the moment
     the previous one is served, so the queue holds one request per process.
     pol: fifo | lifo | pri (P1 has the highest priority) | rss.
     wait = how many other requests were served while this one waited.  */
  const BASES = [35, 140, 80, 170, 15, 110], READS = 6;
  function runProcs(P, pol, seed) {
    const rnd = rng32(seed || 11);
    const pend = BASES.slice(0, P).map((b, k) => ({ p: k, track: b, n: 0, at: k, issued: 0 }));
    let pos = 100, clock = P;
    const served = [];
    while (pend.length) {
      let r;
      if (pol === 'fifo') r = pend.reduce((b, x) => (x.at < b.at ? x : b), pend[0]);
      else if (pol === 'lifo') r = pend.reduce((b, x) => (x.at > b.at ? x : b), pend[0]);
      else if (pol === 'pri') r = pend.reduce((b, x) => (x.p < b.p ? x : b), pend[0]);
      else r = pend[Math.floor(rnd() * pend.length)];
      pend.splice(pend.indexOf(r), 1);
      served.push({ p: r.p, track: r.track, dist: Math.abs(r.track - pos), wait: served.length - r.issued });
      pos = r.track;
      if (r.n + 1 < READS) pend.push({ p: r.p, track: r.track + 1, n: r.n + 1, at: clock++, issued: served.length });
    }
    const total = served.reduce((a, s) => a + s.dist, 0);
    return { served, total, avg: total / served.length, maxWait: Math.max(...served.map((s) => s.wait)) };
  }
  /* ENGINE-END */

  /* fileTimes(): time to read a file of `sectors` sectors, laid out on neighbouring full tracks (seq)
     or scattered one sector at a time (rnd). Each new track costs an average half turn to find its
     first sector; neighbouring tracks are assumed to need no extra seek. Times in ms. */
  function fileTimes(seek, rpm, spt, sectors) {
    const rev = 60000 / rpm, rot = rev / 2, per = rev / spt;
    const tracks = Math.ceil(sectors / spt), lastFrac = (sectors - (tracks - 1) * spt) / spt;
    const first = seek + rot + (tracks === 1 ? lastFrac : 1) * rev;
    const other = rot + rev, last = rot + lastFrac * rev;
    const seq = tracks === 1 ? first : first + (tracks - 2) * other + last;
    const one = seek + rot + per;
    return { rev, rot, per, tracks, first, other, last, lastFrac, seq, one, rnd: sectors * one };
  }
  const FT = fileTimes(4, 7500, 500, 2500);           // the worked example: 4 ms seek, 7,500 rpm, 500 sectors/track, 2,500 sectors
  const f1 = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('en-US', { maximumFractionDigits: d });
  /* noReturn(): classic-queue total when the return trip (C-SCAN) or jump (C-LOOK) is left out, as some sources do */
  const noReturn = (k) => { const r = plan(CLASSIC, 100, true, k); return r.total - r.steps.reduce((a, st) => a + (st.jump >= 0 ? Math.abs(st.pts[st.jump + 1] - st.pts[st.jump]) : 0), 0); };

  /* Policy facts used by captions, cards and the summary. */
  const POL = {
    fifo: { name: 'FIFO', full: 'First in, first out', how: 'Serves requests strictly in the order they arrived.' },
    sstf: { name: 'SSTF', full: 'Shortest service time first', how: 'Picks the waiting request closest to where the arm is now.' },
    scan: { name: 'SCAN', full: 'SCAN (elevator), to the edge', how: 'Sweeps one way serving every request it meets, runs on to the last track, then reverses.' },
    look: { name: 'LOOK', full: 'LOOK', how: 'Like SCAN, but reverses as soon as no request is left ahead, without visiting the edge.' },
    cscan: { name: 'C-SCAN', full: 'Circular SCAN', how: 'Serves only while sweeping one way. At the last track it returns to the far end without serving, then sweeps again.' },
    clook: { name: 'C-LOOK', full: 'Circular LOOK', how: 'Like C-SCAN, but turns at the last request and jumps straight to the farthest waiting request at the other end.' },
    lifo: { name: 'LIFO', full: 'Last in, first out', how: 'Serves the newest waiting request first.' },
    rss: { name: 'RSS', full: 'Random scheduling', how: 'Picks one of the waiting requests at random.' },
  };
  const SIM_POLS = ['fifo', 'sstf', 'scan', 'look', 'cscan', 'clook', 'lifo', 'rss'];

  /* zigChart(ctx, o): the classic picture of a schedule. Tracks run across the top (0..199); each row
     down is one more served request, so the arm's path zig-zags down the chart.
     o = { W, rows, rowH, steps, head, upto, labels, rowLabels, cur, queue, bands, fs, L, R, T, B, dot } */
  function zigChart(ctx, o) {
    const { s } = ctx;
    const W = o.W, L = o.L ?? 40, R = o.R ?? 18, T = o.T ?? 40, rh = o.rowH, rows = Math.max(1, o.rows), fs = o.fs || 13;
    const B = o.B ?? (o.bands ? 22 : 10), H = T + rows * rh + B;
    const X = (t) => L + (t / LAST) * (W - L - R), Y = (k) => T + k * rh;
    const kids = [];
    (o.bands || []).forEach((b) => kids.push(
      s('rect', { x: X(b.a), y: T - 4, width: Math.max(4, X(b.b) - X(b.a)), height: rows * rh + 8, class: 's-proc', 'stroke-width': 0, opacity: 0.45 }),
      s('text', { x: (X(b.a) + X(b.b)) / 2, y: H - 5, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 700, style: 'fill:var(--proc)' }, b.label)));
    const ticks = o.ticks || [0, 50, 100, 150, 199];
    ticks.forEach((t) => kids.push(
      s('line', { x1: X(t), y1: T - 10, x2: X(t), y2: T + rows * rh, class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 4' }),
      s('text', { x: X(t), y: T - 25, 'text-anchor': 'middle', 'font-size': fs, class: 's-sub' }, String(t))));
    kids.push(s('line', { x1: X(0), y1: T - 10, x2: X(LAST), y2: T - 10, class: 's-line', 'stroke-width': 1.5 }));
    if (o.rowLabels) for (let k = 0; k <= rows; k++) kids.push(s('text', { x: L - 10, y: Y(k) + 4.5, 'text-anchor': 'end', 'font-size': fs, class: 's-sub' }, k === 0 ? 'start' : String(k)));
    (o.queue || []).forEach((t) => kids.push(s('path', { d: `M${X(t) - 5} ${T - 20} h10 l-5 9 z`, class: 's-warn', 'stroke-width': 1.5 })));
    const upto = Math.min(o.upto ?? o.steps.length, o.steps.length);
    for (let k = 0; k < upto; k++) {
      const st = o.steps[k], pts = st.pts;
      let tot = 0; for (let j = 1; j < pts.length; j++) tot += Math.abs(pts[j] - pts[j - 1]);
      let acc = 0;
      for (let j = 1; j < pts.length; j++) {
        const d = Math.abs(pts[j] - pts[j - 1]);
        const y0 = Y(k) + (tot ? acc / tot : (j - 1) / (pts.length - 1)) * rh;
        acc += d;
        const y1 = Y(k) + (tot ? acc / tot : j / (pts.length - 1)) * rh;
        const jump = j - 1 === st.jump;
        kids.push(s('line', { x1: X(pts[j - 1]), y1: y0, x2: X(pts[j]), y2: y1, style: jump ? 'stroke:var(--muted)' : 'stroke:var(--chc)', 'stroke-width': jump ? 2 : (o.thin ? 2 : 2.6), 'stroke-dasharray': jump ? '5 4' : '', 'stroke-linecap': 'round' }));
      }
    }
    const dot = o.dot || 5;
    kids.push(s('circle', { cx: X(o.head), cy: Y(0), r: dot, class: 's-os', 'stroke-width': 2 }));
    for (let k = 0; k < upto; k++) {
      const st = o.steps[k], last = o.cur && k === upto - 1;
      kids.push(s('circle', { cx: X(st.t), cy: Y(k + 1), r: last ? dot + 2 : dot, class: last ? 's-accent' : 's-io', 'stroke-width': 2 }));
      if (o.labels) { const right = X(st.t) < W - 60; kids.push(s('text', { x: X(st.t) + (right ? 1 : -1) * (dot + 5), y: Y(k + 1) + 4.5, 'text-anchor': right ? 'start' : 'end', 'font-size': fs, 'font-weight': last ? 800 : 600, style: 'paint-order:stroke;stroke:var(--panel);stroke-width:4px;stroke-linejoin:round' }, String(st.t))); }
    }
    return s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': o.aria || 'Path of the disk arm: tracks across, service order downward' }, ...kids);
  }

  Guide.section({
    id: '11.5',
    title: 'Disk Scheduling',
    short: 'Disk scheduling',
    summary: 'Where the time of a disk access goes, and how the order of waiting requests decides how far the arm travels.',
    objectives: [
      'Break a disk access into seek time, rotational delay and transfer time, and compute each from the disk\'s parameters.',
      'Explain with numbers why reading a file sequentially can be hundreds of times faster than reading the same sectors at random.',
      'Trace FIFO, SSTF, SCAN, C-SCAN, LOOK and C-LOOK on a request queue and compute total and average seek lengths.',
      'Compare the policies that choose by requester (RSS, FIFO, PRI, LIFO) with those that choose by requested track.',
      'Explain starvation and arm stickiness, and how N-step-SCAN and FSCAN prevent them.',
    ],
    terms: [
      ['Track', 'One ring of data on a disk surface. A surface holds many concentric tracks, numbered from the outer edge inward (or the reverse).'],
      ['Sector', 'A fixed-size slice of a track, the smallest unit the disk reads or writes: classically 512 bytes, on most newer drives 4,096 bytes.'],
      ['Cylinder', 'All the tracks, one per surface, that sit under the read/write heads at one arm position. Data in one cylinder can be read without moving the arm.'],
      ['Read/write head', 'The tiny sensor at the tip of the disk arm that reads and writes the magnetic data as the surface spins beneath it.'],
      ['Disk arm', 'The moving arm (actuator) that carries the read/write heads across the surfaces to reach a chosen track. All heads move together.'],
      ['Seek time', 'The time the disk arm needs to move the heads to the track that holds the wanted data.'],
      ['Rotational delay (rotational latency)', 'The time spent waiting, once the head is on the right track, for the wanted sector to spin around under it. On average half a revolution.'],
      ['Transfer time', 'The time for the wanted sectors to pass under the head while their data is read or written.'],
      ['Access time', 'Seek time plus rotational delay: the time to get the head into position to read or write. Adding the transfer time gives the time for the whole operation.'],
      ['Disk scheduling', 'The operating system\'s choice of which waiting disk request to serve next, mainly to cut the time the arm spends moving.'],
      ['Random scheduling (RSS)', 'Picking the next disk request at random. Never used for real; it is the yardstick that other policies are measured against.'],
      ['Last-in-first-out (LIFO)', 'Serving the newest request first. Good when a process\'s next request is near its last one; old requests can starve.'],
      ['Shortest service time first (SSTF)', 'Serving the waiting request that needs the least arm movement from where the arm is now.'],
      ['SCAN (elevator algorithm)', 'The arm sweeps in one direction, serving every request it reaches, until it reaches the last track (or the last request) in that direction, then reverses.'],
      ['C-SCAN (circular SCAN)', 'The arm serves requests in one sweep direction only. At the end it returns to the far end without serving anything and sweeps the same way again.'],
      ['LOOK', 'The usual refinement of SCAN: the arm reverses at the last waiting request in its direction instead of running on to the disk\'s edge.'],
      ['C-LOOK', 'The same refinement of C-SCAN: after the last request in the sweep direction, the arm jumps straight back to the farthest waiting request at the other end.'],
      ['N-step-SCAN', 'The queue is cut into subqueues of N requests. One subqueue at a time is served with SCAN, and new requests go into later subqueues.'],
      ['FSCAN', 'Two queues: a sweep serves only the requests that were waiting when it began, while every new arrival waits in the other queue for the next sweep.'],
      ['Arm stickiness', 'One or a few processes sending requests to the same track so fast that a nearest-first or sweeping policy keeps the arm there, while everyone else waits.'],
    ],
    css: `
      .sec-11-5 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-11-5 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-5 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-5 .mw0 > * { min-width: 0; }
      .sec-11-5 .kv { display: flex; justify-content: space-between; gap: 10px; font-size: 15px; }
      .sec-11-5 .kv b { font-variant-numeric: tabular-nums; }
      .sec-11-5 .qin { flex: 1; min-width: 0; box-sizing: border-box; max-width: 100%; height: 30px; border: 1px solid var(--line-2); border-radius: 8px; padding: 0 8px; font-family: var(--mono); font-size: 14px; background: var(--panel); color: var(--ink); }
      .sec-11-5 .qin:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
      .sec-11-5 table.tbl.simtbl td, .sec-11-5 table.tbl.simtbl th { padding-top: 2.5px; padding-bottom: 2.5px; }
    `,
    steps: [
      {
        title: 'Why the order of disk requests matters',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const fifo = plan(CLASSIC, 100, true, 'fifo').total, opt = best(CLASSIC, 100);
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'lead m0' }, 'A hard disk spends most of each request getting into position, not reading.'),
            h('p', { class: 'm0', html: 'Inside the drive, spinning platters carry data in rings called <span class="t">track</span>s, and a <span class="t">disk arm</span> swings the heads from ring to ring. Each move takes milliseconds: millions of processor cycles. Many processes share one disk, so requests pile up in a queue and the operating system chooses the order. That choice is <span class="t">disk scheduling</span>.' }),
            h('p', { class: 'm0', html: `For the classic nine-request queue used in this section, arrival order moves the arm <b>${fifo}</b> tracks; the best order needs only <b>${opt}</b>.` }),
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A lift in a tall building. Serve button presses in the order they were made and it zig-zags all day; serve every floor on the way up, then every floor on the way down, and the same riders arrive with far less travel. One classic disk policy is nicknamed the elevator.' }),
            h('div', { class: 'row gap-s small' }, ...[['time an access', 'io'], ['run eight policies', 'os'], ['beat SSTF by hand', 'proc'], ['starve a request', 'intr']].map(([t, c]) => h('span', { class: 'chip ' + c }, t))));
          /* the drive: a top view and a side view; each part carries data-part so a button can light it up */
          const P = (part, el2) => { el2.setAttribute('data-part', part); return el2; };
          const cx = 140, cy = 128;
          const wedge = (r0, r1, a0, a1) => { const p = (r, a) => `${(cx + r * Math.cos(a * Math.PI / 180)).toFixed(1)} ${(cy + r * Math.sin(a * Math.PI / 180)).toFixed(1)}`; return `M${p(r0, a0)} L${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`; };
          const hx = cx + 88 * Math.cos(Math.PI / 9), hy = cy + 88 * Math.sin(Math.PI / 9);
          const top = s('svg', { viewBox: '0 0 320 262', width: '100%', role: 'img', 'aria-label': 'Top view of a disk platter with tracks, a sector, the spindle and the arm' },
            s('text', { x: 6, y: 16, class: 's-sub', 'font-size': 13, 'font-weight': 700 }, 'TOP VIEW'),
            P('platter', s('circle', { cx, cy, r: 118, class: 's-panel', 'stroke-width': 2 })),
            ...[44, 58, 72, 102, 116].map((r) => s('circle', { cx, cy, r: r - 6, class: 's-muted', 'stroke-width': 1 })),
            P('track', s('circle', { cx, cy, r: 88, fill: 'none', class: 's-line', 'stroke-width': 3 })),
            P('cylinder', s('circle', { cx, cy, r: 88, fill: 'none', class: 's-muted', 'stroke-width': 0, opacity: 0 })),
            P('sector', s('path', { d: wedge(81, 95, -112, -82), class: 's-io', 'stroke-width': 2 })),
            P('spindle', s('circle', { cx, cy, r: 16, class: 's-panel', 'stroke-width': 2 })),
            s('path', { d: `M${cx - 104} ${cy + 66} A124 124 0 0 0 ${cx - 40} ${cy + 116}`, class: 's-line', 'marker-end': 'url(#arr)', 'stroke-width': 1.5 }),
            s('text', { x: 12, y: 240, class: 's-sub', 'font-size': 13 }, 'spins'),
            P('arm', s('line', { x1: 300, y1: 246, x2: hx + 4, y2: hy + 3, class: 's-io', 'stroke-width': 7, 'stroke-linecap': 'round' })),
            P('arm', s('circle', { cx: 300, cy: 246, r: 9, class: 's-io', 'stroke-width': 2 })),
            P('head', s('rect', { x: hx - 7, y: hy - 6, width: 14, height: 12, rx: 3, class: 's-os', 'stroke-width': 2 })));
          const side = s('svg', { viewBox: '0 0 300 262', width: '100%', role: 'img', 'aria-label': 'Side view of three platters on a spindle with the arm assembly' },
            s('text', { x: 6, y: 16, class: 's-sub', 'font-size': 13, 'font-weight': 700 }, 'SIDE VIEW'),
            P('spindle', s('rect', { x: 64, y: 36, width: 14, height: 200, rx: 3, class: 's-panel', 'stroke-width': 2 })),
            ...[78, 136, 194].map((y) => P('platter', s('rect', { x: 6, y, width: 130, height: 9, rx: 3, class: 's-panel', 'stroke-width': 2 }))),
            P('cylinder', s('rect', { x: 104, y: 62, width: 16, height: 152, rx: 3, fill: 'none', class: 's-line', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 })),
            P('arm', s('rect', { x: 262, y: 54, width: 14, height: 170, rx: 4, class: 's-io', 'stroke-width': 2 })),
            ...[70, 95, 128, 153, 186, 211].map((y) => P('arm', s('line', { x1: 262, y1: y, x2: 124, y2: y, class: 's-io', 'stroke-width': 4 }))),
            ...[70, 95, 128, 153, 186, 211].map((y, k) => P('head', s('rect', { x: 106, y: k % 2 ? y - 4 : y - 3, width: 14, height: 7, rx: 2, class: 's-os', 'stroke-width': 1.5 }))),
            s('text', { x: 196, y: 250, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, 'heads move together'));
          const parts = [
            ['platter', 'Platter', 'A rigid disc coated with magnetic material on both surfaces. A drive stacks several on one shaft, so they all turn together.', 'Every bit on it passes the head once per revolution.'],
            ['spindle', 'Spindle', 'The motor shaft that spins every platter at a constant speed, commonly between 5,400 and 15,000 revolutions per minute.', 'Rotation speed sets both the rotational delay and how fast data streams past the head.'],
            ['track', 'Track', 'One ring of data on one surface. A surface holds many thousands of concentric tracks; this section uses a toy disk with 200 (numbered 0 to 199).', 'Reaching a different track means moving the arm: that is seek time.'],
            ['sector', 'Sector', 'A fixed-size slice of a track, the smallest piece the disk reads or writes: classically 512 bytes, on most newer drives 4,096 bytes.', 'Once on the track, the head waits for the sector to come round: rotational delay.'],
            ['head', 'Read/write head', 'A tiny sensor that flies a small fraction of a micrometre above the spinning surface, one per surface.', 'Only the head that is over the right track and sector can read the data.'],
            ['arm', 'Disk arm', 'The actuator that swings all the heads across the surfaces at once. A typical drive has a single arm assembly, so all its heads sit at one track position at a time.', 'Moving it is the slowest step of a typical request, so its travel is what disk scheduling tries to cut.'],
            ['cylinder', 'Cylinder', 'The stack of tracks, one per surface, that sit under the heads at one arm position (dashed in the side view).', 'Data spread over one cylinder can be read with no arm movement at all.'],
          ];
          const detail = h('div', { class: 'card white stack', style: { gap: '4px', minHeight: '112px' } });
          const btns = parts.map((p, i) => h('button', { class: 'btn sm', type: 'button', onclick: () => show(i) }, p[1]));
          const termOf = { platter: null, spindle: null, track: 'track', sector: 'sector', head: 'read/write head', arm: 'disk arm', cylinder: 'cylinder' };
          function show(i) {
            const [key, name, what, why] = parts[i];
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            [top, side].forEach((svg) => svg.querySelectorAll('[data-part]').forEach((n) => {
              const on = n.getAttribute('data-part') === key;
              n.style.stroke = on ? 'var(--accent)' : '';
              n.style.strokeWidth = on ? (key === 'arm' && n.tagName === 'line' ? '' : '3.5') : '';
              if (key === 'cylinder' && n.tagName === 'circle') { n.setAttribute('opacity', on ? 1 : 0); n.style.strokeWidth = on ? '12' : ''; n.style.strokeOpacity = on ? '0.35' : ''; }
            }));
            detail.replaceChildren(
              h('b', { style: { fontSize: '17px' }, html: termOf[key] ? `<span class="t" data-t="${termOf[key]}">${name}</span>` : name }),
              h('p', { class: 'm0', style: { fontSize: '15px' } }, what),
              h('p', { class: 'm0 small', html: '<b style="color:var(--io)">Timing: </b>' + why }));
          }
          const pics = h('div', { class: ctx.narrow ? 'stack' : 'row nw', style: { gap: '8px', alignItems: 'flex-start' } },
            h('div', { style: { flex: '1 1 0', minWidth: 0 } }, top), h('div', { style: { flex: '1 1 0', minWidth: 0 } }, side));
          const right = h('div', { class: 'card stack', style: { gap: '8px' } },
            h('h4', { class: 'm0' }, 'Inside a hard disk: click a part'),
            pics, h('div', { class: 'row gap-s' }, ...btns), detail);
          el.append(h('div', { class: 'split fill' }, left, right));
          show(5);
        },
      },
      {
        title: 'Where the time goes in one disk access',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const fmt = ctx.util.fmt;
          /* one worked access: the numbers below feed the drawing, the timeline and every caption */
          const m = 0.03, st = 1, from = 50, to = 150, n = to - from, rpm = 7500, b = 512, spt = 500;
          const r = rpm / 60, rev = 1000 / r, Ts = m * n + st, rot = rev / 2, N = spt * b, Tt = (b / (r * N)) * 1000, Ta = Ts + rot + Tt;
          const C = { x: 170, y: 150 }, Q = { x: 345, y: 285 }, A = 175;
          const rad = (t) => 128 - t * (88 / LAST);
          function headAt(t) {                                   // where the head sits when the arm is over track t
            const R = rad(t), dx = Q.x - C.x, dy = Q.y - C.y, d = Math.hypot(dx, dy);
            const a = (R * R - A * A + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, R * R - a * a));
            const px = C.x + (a * dx) / d, py = C.y + (a * dy) / d;
            return { x: px + (hh * dy) / d, y: py - (hh * dx) / d };
          }
          const H0 = headAt(from), H1 = headAt(to);
          const angH = Math.atan2(H1.y - C.y, H1.x - C.x) * 180 / Math.PI;
          const pt = (R, a) => ({ x: C.x + R * Math.cos(a * Math.PI / 180), y: C.y + R * Math.sin(a * Math.PI / 180) });
          const wedge = (R, a) => { const r0 = R - 7, r1 = R + 7, a0 = a - 11, a1 = a + 11, p = (rr, aa) => { const q = pt(rr, aa); return q.x.toFixed(1) + ' ' + q.y.toFixed(1); }; return `M${p(r0, a0)} L${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`; };
          const svg = s('svg', { viewBox: '0 0 360 300', width: '100%', role: 'img', 'aria-label': 'Disk platter with the arm moving to the target track and the sector turning under the head' });
          function drawDisk(f) {
            const kids = [s('circle', { cx: C.x, cy: C.y, r: 135, class: 's-panel', 'stroke-width': 2 })];
            for (let t = 0; t <= LAST; t += 25) kids.push(s('circle', { cx: C.x, cy: C.y, r: rad(t), fill: 'none', class: 's-muted', 'stroke-width': 1 }));
            kids.push(s('circle', { cx: C.x, cy: C.y, r: rad(to), fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 2.5, 'stroke-dasharray': f >= 3 ? '' : '4 4' }));
            kids.push(s('circle', { cx: C.x, cy: C.y, r: 14, class: 's-panel', 'stroke-width': 2 }));
            const sa = f <= 3 ? angH + 180 : f === 4 ? angH + 270 : angH;
            kids.push(s('path', { d: wedge(rad(to), sa), class: f >= 5 ? 's-ok' : 's-io', 'stroke-width': 2 }));
            if (f === 4) {
              const p0 = pt(rad(to) + 16, angH + 284), p1 = pt(rad(to) + 16, angH + 346);
              kids.push(s('path', { d: `M${p0.x} ${p0.y} A${rad(to) + 16} ${rad(to) + 16} 0 0 1 ${p1.x} ${p1.y}`, class: 's-line', 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)' }));
            }
            const Hd = f >= 3 ? H1 : H0;
            if (f === 3) {
              kids.push(s('line', { x1: Q.x, y1: Q.y, x2: H0.x, y2: H0.y, class: 's-muted', 'stroke-width': 5, 'stroke-dasharray': '6 5' }));
              kids.push(s('path', { d: `M${H0.x - 4} ${H0.y + 10} Q ${(H0.x + H1.x) / 2 + 26} ${(H0.y + H1.y) / 2 + 6} ${H1.x + 12} ${H1.y + 8}`, class: 's-line', 'marker-end': 'url(#arr-io)', style: 'stroke:var(--io)' }));
            }
            kids.push(s('line', { x1: Q.x, y1: Q.y, x2: Hd.x, y2: Hd.y, class: 's-io', 'stroke-width': 7, 'stroke-linecap': 'round' }));
            kids.push(s('circle', { cx: Q.x, cy: Q.y, r: 10, class: 's-io', 'stroke-width': 2 }));
            kids.push(s('rect', { x: Hd.x - 7, y: Hd.y - 6, width: 14, height: 12, rx: 3, class: 's-os', 'stroke-width': 2 }));
            kids.push(s('text', { x: 6, y: 296, class: 's-sub', 'font-size': 13 }, `arm over track ${f >= 3 ? to : from} · target: track ${to}`));
            if (f === 1 || f === 2) {
              const lbl = f === 1 ? 'device busy: 3 requests ahead' : 'channel busy: waiting for it';
              kids.push(s('rect', { x: 6, y: 6, width: 236, height: 26, rx: 8, class: 's-warn', 'stroke-width': 1.5 }), s('text', { x: 14, y: 24, 'font-size': 14, 'font-weight': 700 }, lbl));
            }
            svg.replaceChildren(...kids);
          }
          /* the timeline: waits are drawn at a nominal width because their length depends on the load */
          const parts = [
            { k: 'dev', label: 'wait for device', w: null, cls: 's-warn' },
            { k: 'chan', label: 'wait for channel', w: null, cls: 's-warn' },
            { k: 'seek', label: 'seek', w: Ts, cls: 's-io' },
            { k: 'rot', label: 'rotational delay', w: rot, cls: 's-accent' },
            { k: 'xfer', label: 'transfer', w: Tt, cls: 's-ok' },
          ];
          const TW = ctx.narrow ? 340 : 560;
          const tl = s('svg', { viewBox: `0 0 ${TW} 92`, width: '100%', role: 'img', 'aria-label': 'Timeline of the access' });
          function drawTimeline(f) {
            const WW = 58, pxPerMs = (TW - 4 - 2 * WW - 8 - 72) / (Ts + rot);
            const kids = [];
            let x = 4;
            parts.forEach((p, i) => {
              const w = p.w == null ? WW : Math.max(4, p.w * pxPerMs);
              const shown = f > i;
              kids.push(s('rect', { x, y: 18, width: w, height: 30, rx: 4, class: shown ? p.cls : 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': p.w == null ? '4 3' : '', opacity: shown ? 1 : 0.45 }));
              const mid = x + w / 2, lab = p.w == null ? 'varies' : fmt(p.w, 3) + ' ms';
              if (shown) kids.push(s('text', { x: i === 4 ? x + w + 4 : mid, y: 38, 'text-anchor': i === 4 ? 'start' : 'middle', 'font-size': 13, 'font-weight': 700 }, lab));
              const lx = i === 4 ? x + w + 4 : i < 2 ? x : mid, anchor = i === 4 || i < 2 ? 'start' : 'middle';
              kids.push(s('text', { x: lx, y: i === 1 || i === 3 ? 82 : 66, 'text-anchor': anchor, 'font-size': 13, class: 's-sub' }, p.label));
              x += w + 2;
            });
            kids.push(s('text', { x: 4, y: 12, 'font-size': 13, class: 's-sub' }, 'time →'));
            tl.replaceChildren(...kids);
          }
          const card = h('div', { class: 'card white stack', style: { gap: '6px' } });
          const frames = [
            ['The request', `A process asks to read one ${b}-byte sector on track ${to}. The arm happens to be over track ${from}.`, '', 'Nothing has moved yet. Before any data flows, the request may have to <b>wait</b>, then the arm must <b>move</b> and the platter must <b>turn</b>.'],
            ['Wait for the device', 'If the disk is busy, the request joins the device\'s queue. Its wait depends on the load and on the order in which the operating system serves the queue.', '', 'Queueing delay 1: <b>waiting for the device</b>. This wait, and the order that decides it, is what disk scheduling is about.'],
            ['Wait for a channel', 'On some systems several disks share one I/O channel, a data path to memory, so the disk must also wait until that path is free. Many systems have no such step.', '', 'Queueing delay 2 (some systems only): <b>waiting for a channel</b>. Now the real work starts.'],
            ['Seek time', 'T<sub>s</sub> = m × n + s', `n = ${n} tracks to cross, m = ${m} ms per track, s = ${st} ms to start and settle.<br>T<sub>s</sub> = ${m} × ${n} + ${st} = <b>${fmt(Ts, 3)} ms</b>`, `<b>Seek:</b> the arm swings from track ${from} to track ${to}. A straight-line model; real arms speed up, coast and settle. Average seek times of today's drives are a few milliseconds.`],
            ['Rotational delay', 'average = 1 / (2r)', `${fmt(rpm, 0)} rpm = ${fmt(r, 0)} revolutions per second, so one turn takes 1/${fmt(r, 0)} s = ${fmt(rev, 3)} ms.<br>Average wait = half a turn = <b>${fmt(rot, 3)} ms</b> (anything from 0 to ${fmt(rev, 3)} ms).`, '<b>Rotational delay:</b> the head is on the track, but the sector is somewhere else on the ring. On average the platter must turn half a revolution to bring it round.'],
            ['Transfer time', 'T = b / (r × N)', `b = ${b} bytes wanted, N = ${spt} × ${b} = ${fmt(N, 0)} bytes per track, r = ${fmt(r, 0)} per second.<br>T = ${b} / (${fmt(r, 0)} × ${fmt(N, 0)}) s = <b>${fmt(Tt, 3)} ms</b>`, '<b>Transfer:</b> the sector passes under the head and its bytes are read. One sector is 1/' + spt + ' of a track, so it takes 1/' + spt + ' of a turn.'],
            ['Putting it together', 'T<sub>a</sub> = T<sub>s</sub> + 1/(2r) + b/(rN)', `T<sub>a</sub> = ${fmt(Ts, 3)} + ${fmt(rot, 3)} + ${fmt(Tt, 3)} = <b>${fmt(Ta, 3)} ms</b>, plus any queueing delay.`, `<b>Total:</b> getting into position (seek + rotational delay, together the <span class="t">access time</span>) is ${fmt(((Ts + rot) / Ta) * 100, 1)}% of the work; moving the data is ${fmt((Tt / Ta) * 100, 1)}%. Cutting arm travel is where the time is.`],
          ];
          function draw(i) {
            drawDisk(i); drawTimeline(i);
            const [t, f, w] = frames[i];
            card.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, t), h('span', { class: 'chip io' }, 'part ' + i + ' of ' + (frames.length - 1))),
              w ? h('div', { class: 'mono', style: { fontSize: '19px', fontWeight: 700, color: 'var(--chc)' }, html: f }) : h('p', { class: 'm0', style: { fontSize: '15.5px' } }, f),
              w ? h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: w }) : null);
            return frames[i][3];
          }
          const player = ctx.ui.player({ count: frames.length, render: draw, interval: 3200 });
          card.style.minHeight = '150px';
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'split mw0', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 430px) minmax(0, 1fr)', flex: '1', minHeight: 0 } },
              h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '6px' } }, svg),
              h('div', { class: 'stack', style: { gap: '10px' } },
                h('p', { class: 'm0', html: 'Reading one sector takes three mechanical steps, and possibly two waits first. The <span class="t">seek time</span> moves the arm, the <span class="t">rotational delay</span> brings the sector round, the <span class="t">transfer time</span> reads it.' }),
                h('div', { class: 'card', style: { padding: '8px 10px' } }, tl), card)),
            player.el));
        },
      },
      {
        title: 'Same file, two layouts: 64 ms or 20 seconds?',
        kind: 'predict',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const fmt = ctx.util.fmt;
          const K = fileTimes(4, 7500, 500, 2500);
          let guessed = null;
          const guesses = [['About 2 times', 2], ['About 10 times', 10], ['About 30 times', 30], ['About 300 times', 300]];
          const ratio = K.rnd / K.seq;
          const bestG = guesses.reduce((b, g) => (Math.abs(Math.log(g[1] / ratio)) < Math.abs(Math.log(b[1] / ratio)) ? g : b))[1];
          const gBtns = guesses.map(([t, v]) => h('button', { class: 'btn', type: 'button', onclick: () => guess(v) }, t));
          const fb = h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'callout tip small m0', 'data-label': 'Hint', html: 'Count how often each layout pays for a seek and for half a turn of the platter. Layout A pays per <b>track</b>; layout B pays per <b>sector</b>.' }));
          function guess(v) {
            guessed = v;
            gBtns.forEach((b, i) => { b.classList.toggle('on', guesses[i][1] === v); });
            const ok = v === bestG;
            fb.replaceChildren(
              h('div', { class: 'narr ' + (ok ? 'ok' : 'bad'), html: (ok ? '<b>Right.</b> ' : '<b>Not quite: it is far worse.</b> ') + `Layout B takes about <b>${fmt(ratio, 0)} times</b> as long.` }),
              h('div', { class: 'card white small', style: { lineHeight: 1.5 }, html:
                `<b>A, sequential:</b> first track ${fmt(4, 0)} seek + ${fmt(K.rot, 0)} rotational + ${fmt(K.rev, 0)} to read the whole track = <b>${fmt(K.first, 3)} ms</b>. Each of the other ${K.tracks - 1} tracks: ${fmt(K.rot, 0)} + ${fmt(K.rev, 0)} = ${fmt(K.other, 3)} ms (no further seek). Total <b>${fmt(K.seq, 3)} ms</b>.<br>` +
                `<b>B, random:</b> each sector ${fmt(4, 0)} + ${fmt(K.rot, 0)} + ${fmt(K.per, 3)} = ${fmt(K.one, 3)} ms; × ${fmt(2500, 0)} = <b>${fmt(K.rnd, 3)} ms</b> ≈ ${fmt(K.rnd / 1000, 2)} s.` }),
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Same disk, same bytes; only the visiting order differs. Choosing that order well is the whole job of <span class="t">disk scheduling</span>.' }));
            update();
          }
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'lead m0', html: 'One file of 2,500 sectors (1.28 MB). One disk: average seek 4 ms, 7,500 rpm, 500 sectors of 512 bytes per track.' }),
            h('div', { class: 'grid-2' },
              h('div', { class: 'card tight io small', html: '<b>Layout A, sequential</b><br>The file fills 5 neighbouring tracks, in order.' }),
              h('div', { class: 'card tight intr small', html: '<b>Layout B, random</b><br>Its 2,500 sectors are scattered all over the disk.' })),
            h('p', { class: 'm0 b' }, 'Predict: reading layout B takes how many times as long as layout A?'),
            h('div', { class: 'grid-4', style: { gap: '8px' } }, ...gBtns), fb);
          /* the calculator */
          const st = { seek: 4, rpm: 7500, spt: 500, sectors: 2500 };
          const out = h('div', { class: 'stack', style: { gap: '8px' } });
          const sl = [
            ctx.ui.slider({ label: 'Average seek', min: 1, max: 12, step: 0.5, value: st.seek, format: (v) => fmt(v, 1) + ' ms', onInput: (v) => { st.seek = v; update(); } }),
            ctx.ui.slider({ label: 'Sectors per track', min: 100, max: 1000, step: 50, value: st.spt, format: (v) => String(v), onInput: (v) => { st.spt = v; update(); } }),
            ctx.ui.slider({ label: 'File size', min: 500, max: 10000, step: 500, value: st.sectors, format: (v) => fmt(v, 0) + ' sectors', onInput: (v) => { st.sectors = v; update(); } }),
          ];
          const rpmSeg = ctx.ui.seg([5400, 7200, 7500, 10000, 15000].map((v) => ({ value: v, label: fmt(v, 0) })), st.rpm, (v) => { st.rpm = v; update(); });
          function update() {
            if (guessed == null) { out.replaceChildren(h('div', { class: 'narr' }, 'Make your prediction on the left first. Then change the disk here and watch both times react.')); return; }
            const T = fileTimes(st.seek, st.rpm, st.spt, st.sectors);
            const bar = (label, ms, cls, sub) => h('div', { class: 'stack', style: { gap: '3px' } },
              h('div', { class: 'kv' }, h('span', { html: label }), h('b', {}, ms >= 1000 ? fmt(ms / 1000, 2) + ' s' : fmt(ms, 2) + ' ms')),
              h('div', { class: 'meter', style: { height: '16px' } }, h('i', { style: { width: Math.max(0.6, (ms / Math.max(T.seq, T.rnd)) * 100) + '%', background: `var(--${cls})` } })),
              h('div', { class: 'xs muted' }, sub));
            out.replaceChildren(
              h('div', { class: 'row small', style: { gap: '14px' } },
                h('span', { html: `one turn <b>${fmt(T.rev, 2)} ms</b>` }), h('span', { html: `avg rotational delay <b>${fmt(T.rot, 2)} ms</b>` }), h('span', { html: `one sector <b>${fmt(T.per, 4)} ms</b>` })),
              bar('<b>A</b> sequential', T.seq, 'io', `${T.tracks} track${T.tracks > 1 ? 's' : ''}: the first pays a seek; every track pays half a turn, then reads the track`),
              bar('<b>B</b> random', T.rnd, 'intr', `${fmt(st.sectors, 0)} × (${fmt(st.seek, 1)} + ${fmt(T.rot, 2)} + ${fmt(T.per, 4)}) ms: a seek and half a turn for every sector`),
              h('div', { class: 'row', style: { alignItems: 'baseline', gap: '10px' } }, h('span', { class: 'big', style: { color: 'var(--chc)' } }, fmt(T.rnd / T.seq, 0) + '×'), h('span', { class: 'small' }, 'slower when the same sectors are read in a scattered order')));
          }
          const right = h('div', { class: 'card stack', style: { gap: '10px' } },
            h('div', { class: 'small', html: '<b>Calculator.</b> Every piece of a read costs T<sub>s</sub> + 1/(2r) + b/(rN); change the disk:' }),
            sl[0], h('div', { class: 'row', style: { gap: '10px' } }, h('b', { style: { fontSize: '15px' } }, 'Rotation (rpm)'), rpmSeg), sl[1], sl[2], out);
          el.append(h('div', { class: 'split fill' }, left, right));
          update();
        },
      },
      {
        title: 'Choosing by who asked: FIFO, PRI, LIFO and RSS',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const fmt = ctx.util.fmt;
          const info = {
            fifo: ['FIFO', 'first in, first out', 'Serves requests in the order they arrived.', 'Fair: every request gets its turn and nobody starves.', 'It ignores the arm. One process reading in order is ideal; several taking turns make almost every request a long jump.'],
            pri: ['PRI', 'priority', 'Serves the request of the most important process first; here P1 outranks P2, P2 outranks P3, and so on.', 'The order comes from outside the disk manager, for example to favour short batch jobs and interactive users.', 'The disk manager gives up control of the arm. Low-priority work can wait a very long time, which suits database systems badly.'],
            lifo: ['LIFO', 'last in, first out', 'Serves the newest request first.', 'In transaction systems the newest request usually comes from the process just served and sits next to its previous one, so the arm barely moves.', 'An old request keeps being pushed back. With a steady stream of new work it can starve.'],
            rss: ['RSS', 'random scheduling', 'Picks a waiting request at random.', 'Nobody uses it for real: it is the yardstick. A policy that does worse than random has a problem.', 'Unpredictable, and it ignores both the arm and the requesters.'],
          };
          let pol = 'fifo', P = 3;
          const card = h('div', { class: 'card white stack', style: { gap: '6px' } });
          const stats = h('div', { class: 'narr' });
          const chartBox = h('div', { class: 'grow', style: { display: 'grid', placeItems: 'center', minHeight: 0 } });
          const seg = ctx.ui.seg(['fifo', 'pri', 'lifo', 'rss'].map((k) => ({ value: k, label: info[k][0] })), pol, (v) => { pol = v; draw(); });
          const slider = ctx.ui.slider({ label: 'Processes', min: 1, max: 6, value: P, format: (v) => v + (v === 1 ? ' process' : ' processes'), onInput: (v) => { P = v; draw(); } });
          const rssBench = (p) => { let sum = 0; for (let k = 1; k <= 300; k++) sum += runProcs(p, 'rss', k * 101).avg; return sum / 300; };
          function draw() {
            const run = runProcs(P, pol, 11), I = info[pol];
            card.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '19px' }, html: `${I[0]} <span class="muted small">(${I[1]})</span>` }), h('span', { class: 'chip os' }, 'chooses by requester')),
              h('p', { class: 'm0', style: { fontSize: '15.5px' } }, I[2]),
              h('p', { class: 'm0 small', html: '<b style="color:var(--ok)">+ </b>' + I[3] }),
              h('p', { class: 'm0 small', html: '<b style="color:var(--bad)">− </b>' + I[4] }));
            const worst = run.served.reduce((b, x) => (x.wait > b.wait ? x : b), run.served[0]);
            const bench = rssBench(P);
            let msg = `Average seek <b>${fmt(run.avg, 1)}</b> tracks (random order over 300 runs: ${fmt(bench, 1)}). `;
            msg += P === 1 ? 'With one process every policy reads the file in order: after the first seek the arm moves one track at a time.'
              : `Longest wait: one request of <b>P${worst.p + 1}</b> waited while <b>${worst.wait}</b> others were served` + (pol === 'fifo' ? ', never more than one per other process: fair, but the arm hops between files.' : pol === 'rss' ? '.' : ', because the policy kept serving other processes first.');
            if (pol === 'pri' && P > 1) msg += ' (PRI keeps the arm local here only because each process reads its own file in order; it never looks at the arm.)';
            stats.innerHTML = msg;
            const steps = []; let prev = 100;
            run.served.forEach((x) => { steps.push({ t: x.track, pts: [prev, x.track], jump: -1 }); prev = x.track; });
            const W = ctx.narrow ? 360 : 640, rows = steps.length, rowH = Math.min(30, (ctx.narrow ? 300 : 360) / rows);
            chartBox.replaceChildren(zigChart(ctx, { W, rows, rowH, steps, head: 100, dot: rows > 12 ? 3.5 : 5, thin: rows > 12, L: 18, bands: BASES.slice(0, P).map((b, k) => ({ a: b - 2, b: b + READS + 1, label: 'P' + (k + 1) })), aria: 'Arm path while several processes read their files' }));
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'The simplest policies look only at <b>who</b> made a request or <b>when</b>, never at where its data lies on the disk.' }),
              h('div', { class: 'row' }, seg), card, slider, stats,
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Fair is not the same as fast. FIFO never starves anyone, yet with several processes taking turns it moves the arm as much as random choice, or more.' })),
            h('div', { class: 'card white stack', style: { gap: '6px' } },
              h('div', { class: 'small', html: 'Each process reads 6 neighbouring tracks of its own file (teal bands), one request at a time: it asks for the next as soon as the previous one is served. Rows going down = requests served in order.' }),
              chartBox)));
          draw();
        },
      },
      {
        title: 'The disk-arm simulator: eight policies, one queue',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const fmt = ctx.util.fmt;
          let pol = 'sstf', up = true, head = 100, queue = CLASSIC.slice(), res = null, rndSeed = 0;
          const dw = (d) => (d > 0 ? 'up' : 'down'), beyond = (d) => (d > 0 ? 'above' : 'below');
          function caption(k) {
            const n = res.steps.length;
            if (k === 0) return `<b>Start.</b> The arm is at track ${head}, moving ${up ? 'up (toward 199)' : 'down (toward 0)'}. ${n} requests wait, in arrival order: ${queue.join(', ')} (orange markers). Press <b>Next</b> to see which one ${POL[pol].name} serves first.`;
            const st = res.steps[k - 1], name = POL[pol].name, parts = [];
            for (let j = 1; j < st.pts.length; j++) parts.push(Math.abs(st.pts[j] - st.pts[j - 1]));
            const sum = res.steps.slice(0, k).reduce((a, x) => a + x.dist, 0);
            const before = (pol === 'scan' || pol === 'look') && st.turned ? -st.dir : st.dir;
            let t;
            if (st.before.length === 1 && ['fifo', 'lifo', 'rss', 'sstf'].includes(pol)) t = `Only one request is left, <b>${st.t}</b>, so every policy takes it: ${st.from} → ${st.t} is <b>${st.dist}</b> tracks.`;
            else if (pol === 'fifo') t = `${name} serves the oldest waiting request, <b>${st.t}</b>, wherever it is: ${st.from} → ${st.t} is <b>${st.dist}</b> tracks.`;
            else if (pol === 'lifo') t = `${name} serves the newest waiting request, <b>${st.t}</b>: ${st.from} → ${st.t} is <b>${st.dist}</b> tracks.`;
            else if (pol === 'rss') t = `${name} picks one of the ${st.before.length} waiting requests at random: <b>${st.t}</b>, <b>${st.dist}</b> tracks away.`;
            else if (pol === 'sstf') {
              const list = st.before.slice().sort((a, b) => Math.abs(a - st.from) - Math.abs(b - st.from));
              t = `From ${st.from}, ${name} measures every waiting request: ${list.slice(0, 4).map((x) => `${x} (${Math.abs(x - st.from)})`).join(', ')}${list.length > 4 ? ', …' : ''}. The closest is <b>${st.t}</b>: <b>${st.dist}</b> tracks.`;
            } else if (!st.turned) t = `Moving ${dw(before)} from ${st.from}, the next request in that direction is <b>${st.t}</b>: <b>${st.dist}</b> track${st.dist === 1 ? '' : 's'}.`;
            else if (pol === 'scan') t = parts.length > 1 ? `Nothing is left ${beyond(before)} ${st.from}, but SCAN runs on to the edge (track ${st.pts[1]}) before reversing, then serves <b>${st.t}</b>: ${parts.join(' + ')} = <b>${st.dist}</b> tracks.` : `The arm is already at the edge, so SCAN reverses and serves <b>${st.t}</b>: <b>${st.dist}</b> tracks.`;
            else if (pol === 'look') t = `Nothing is left ${beyond(before)} ${st.from}, so LOOK reverses right here and serves <b>${st.t}</b>: <b>${st.dist}</b> tracks. SCAN would first have run on to track ${before > 0 ? LAST : 0}.`;
            else if (pol === 'cscan') t = `Nothing is left ${beyond(before)} ${st.from}. C-SCAN runs on to the edge, returns to track ${before > 0 ? 0 : LAST} without serving anything (dashed), and sweeps ${dw(before)} again to <b>${st.t}</b>: ${parts.join(' + ')} = <b>${st.dist}</b> tracks (the return trip is counted).`;
            else t = `Nothing is left ${beyond(before)} ${st.from}. C-LOOK jumps straight back (dashed) to the farthest waiting request, <b>${st.t}</b>, and sweeps ${dw(before)} again: <b>${st.dist}</b> tracks, counted like any other seek.`;
            return t + (k === n ? ` <b>Done:</b> ${res.total} tracks in all; average seek length ${fmt(res.avg, 1)}.` : ` Running total: ${sum} tracks.`);
          }
          /* controls */
          const polSeg = ctx.ui.seg(SIM_POLS.map((k) => ({ value: k, label: POL[k].name })), pol, (v) => { pol = v; recompute(true); });
          const dirSeg = ctx.ui.seg([{ value: true, label: '↑ toward 199' }, { value: false, label: '↓ toward 0' }], up, (v) => { up = v; recompute(true); });
          const qIn = h('input', { type: 'text', class: 'qin', value: queue.join(', '), 'aria-label': 'Request queue, track numbers in arrival order', onkeydown: (e) => { if (e.key === 'Enter') applyQueue(); } });
          function applyQueue() {
            const vals = qIn.value.split(/[\s,;]+/).filter(Boolean).map(Number);
            if (!vals.length || vals.length > 10 || vals.some((v) => !Number.isInteger(v) || v < 0 || v > LAST)) { ctx.toast('Type 1 to 10 whole track numbers between 0 and 199, separated by commas.'); return; }
            queue = vals; recompute(false);
          }
          const headSl = ctx.ui.slider({ label: 'Arm starts at track', min: 0, max: LAST, value: head, onInput: (v) => { head = v; recompute(false); } });
          const card = h('div', { class: 'card white stack', style: { gap: '4px', padding: '10px 14px' } });
          const tbody = h('tbody'), table = h('table', { class: 'tbl compact simtbl' }, h('thead', {}, h('tr', {}, ...['#', 'Next track', 'Tracks moved', 'Running total'].map((x) => h('th', {}, x)))), tbody);
          const totals = h('div', { class: 'narr small' });
          const chartBox = h('div', { class: 'card white', style: { padding: '4px 8px', display: 'grid', placeItems: 'center' } });
          let player = null;
          function draw(k) {
            const n = res.steps.length;
            chartBox.replaceChildren(zigChart(ctx, { W: ctx.narrow ? 360 : 640, rows: n, rowH: ctx.narrow ? 24 : Math.min(26, 220 / n), steps: res.steps, head, upto: k, labels: true, rowLabels: true, cur: true, queue: k === 0 ? queue : res.steps[k - 1].left, aria: 'Arm path for ' + POL[pol].name }));
            let run = 0;
            tbody.replaceChildren(...res.steps.map((st, j) => {
              run += st.dist;
              const shown = j < k;
              return h('tr', { class: j === k - 1 ? 'on' : '' }, h('td', {}, String(j + 1)), h('td', { class: 'num b' }, shown ? String(st.t) : '·'), h('td', { class: 'num' }, shown ? String(st.dist) : '·'), h('td', { class: 'num' }, shown ? String(run) : '·'));
            }));
            const opt = best(queue, head);
            /* on the classic setup, say which printed figure each sweep result corresponds to */
            const classic = up && head === 100 && queue.join() === CLASSIC.join();
            const lk = () => fmt(plan(queue, head, up, 'look').avg, 1), clk = () => fmt(plan(queue, head, up, 'clook').avg, 1);
            const conv = !classic ? '' : pol === 'scan' ? ` Tables that print ${lk()} for SCAN here turn at the last request, as LOOK does.`
              : pol === 'look' ? ` This is the ${lk()} that many tables print for SCAN.`
              : pol === 'cscan' ? ` Tables that print ${clk()} for C-SCAN here turn at the last request, as C-LOOK does.`
              : pol === 'clook' ? ` This is the ${clk()} that many tables print for C-SCAN.`
              : pol === 'sstf' ? ` Some tables print ${Math.floor(res.avg * 10) / 10}: ${res.total} / ${n} = ${fmt(res.avg, 2)}, cut off instead of rounded.` : '';
            totals.innerHTML = k === n
              ? `<b>${POL[pol].name}:</b> ${res.total} tracks, average seek length <b>${fmt(res.avg, 1)}</b>. Least possible for this queue: ${opt} tracks (average ${fmt(opt / n, 1)}).${conv}`
              : `Step through to the end for the total. So far: ${res.steps.slice(0, k).reduce((a, x) => a + x.dist, 0)} tracks after ${k} of ${n} requests.`;
            return caption(k);
          }
          function recompute(keep) {
            res = plan(queue, head, up, pol, 101 + rndSeed);
            card.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, POL[pol].name + (POL[pol].full !== POL[pol].name ? ' · ' + POL[pol].full : '')),
                h('span', { class: 'chip ' + (['fifo', 'lifo', 'rss'].includes(pol) ? 'os' : 'io') }, ['fifo', 'lifo', 'rss'].includes(pol) ? 'by requester' : 'by track')),
              h('p', { class: 'm0', style: { fontSize: '15px' } }, POL[pol].how + (['scan', 'look', 'cscan', 'clook'].includes(pol) ? '' : ' The direction setting does not affect it.')));
            if (player) player.setCount(res.steps.length + 1, keep);
          }
          recompute(false);
          player = ctx.ui.player({ count: res.steps.length + 1, render: draw, interval: 1900 });
          if (ctx.narrow) { qIn.style.flex = '1 1 100%'; qIn.style.fontSize = '12.5px'; }
          const qRow = h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { gap: '8px' } }, h('b', { class: 'small', style: { whiteSpace: 'nowrap' } }, 'Queue'), qIn,
            h('button', { class: 'btn sm primary', type: 'button', onclick: applyQueue }, 'Apply'),
            h('button', { class: 'btn sm', type: 'button', onclick: () => { queue = CLASSIC.slice(); head = 100; up = true; qIn.value = queue.join(', '); headSl.set(head); dirSeg.set(true); recompute(false); } }, 'Classic'),
            h('button', { class: 'btn sm', type: 'button', onclick: () => { rndSeed++; const r = rng32(rndSeed * 977 + 13); queue = Array.from({ length: 9 }, () => Math.floor(r() * (LAST + 1))); qIn.value = queue.join(', '); recompute(false); } }, 'Random'));
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
            h('div', { class: 'row', style: { gap: '12px' } }, polSeg, dirSeg),
            h('div', { class: 'split grow', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 640px) minmax(0, 1fr)', gap: '16px' } },
              h('div', { class: 'stack', style: { gap: '7px' } }, qRow, headSl, chartBox, player.el),
              h('div', { class: 'stack', style: { gap: '8px' } }, card, table, totals))));
        },
      },
      {
        title: 'You are the disk scheduler',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const fmt = ctx.util.fmt;
          const PRESETS = { classic: { head: 100, q: CLASSIC.slice() }, trap: { head: 100, q: [30, 160, 92, 10, 185, 112, 20, 140, 125] } };
          let head = 100, queue = CLASSIC.slice(), served = [], seed = 0, which = 'classic';
          const btnRow = h('div', { class: 'row gap-s', style: { minHeight: '44px' } });
          const chartBox = h('div', { class: 'card white grow', style: { padding: '4px 8px', display: 'grid', placeItems: 'start center' } });
          const score = h('div', { class: 'stack', style: { gap: '4px' } });
          const verdict = h('div', { class: 'stack', style: { gap: '8px' } });
          const presetSeg = ctx.ui.seg([{ value: 'classic', label: 'Classic queue' }, { value: 'trap', label: 'Tricky queue' }, { value: 'random', label: 'Random queue' }], which, (v) => { which = v; load(); });
          function load() {
            if (which === 'random') { seed++; const r = rng32(seed * 7717 + 3); head = 20 + Math.floor(r() * 160); queue = Array.from({ length: 8 }, () => Math.floor(r() * (LAST + 1))); }
            else { head = PRESETS[which].head; queue = PRESETS[which].q.slice(); }
            served = []; draw();
          }
          function pathSteps() {
            const out = []; let pos = head;
            served.forEach((i) => { out.push({ t: queue[i], pts: [pos, queue[i]], jump: -1, dist: Math.abs(queue[i] - pos) }); pos = queue[i]; });
            return { steps: out, pos, total: out.reduce((a, x) => a + x.dist, 0) };
          }
          function draw() {
            const P = pathSteps(), left = queue.map((t, i) => i).filter((i) => !served.includes(i)).sort((a, b) => queue[a] - queue[b] || a - b);
            btnRow.replaceChildren(...(left.length ? left.map((i) => h('button', { class: 'btn io', type: 'button', style: { flexDirection: 'column', height: '44px', gap: 0, lineHeight: 1.1, padding: '0 6px', minWidth: '54px' }, onclick: () => { served.push(i); draw(); }, 'aria-label': `Serve track ${queue[i]}, ${Math.abs(queue[i] - P.pos)} tracks away` },
              h('b', { style: { fontSize: '16px' } }, String(queue[i])), h('span', { class: 'xs', style: { color: 'var(--muted)' } }, Math.abs(queue[i] - P.pos) + ' away'))) : [h('span', { class: 'chip ok' }, 'All requests served.')]));
            chartBox.replaceChildren(zigChart(ctx, { W: ctx.narrow ? 360 : 620, rows: queue.length, rowH: ctx.narrow ? 24 : Math.min(36, 330 / queue.length), steps: P.steps, head, labels: true, rowLabels: true, cur: true, queue: left.map((i) => queue[i]), aria: 'Your schedule so far' }));
            score.replaceChildren(
              h('div', { class: 'row', style: { alignItems: 'baseline', gap: '10px' } }, h('span', { class: 'big', style: { color: 'var(--chc)' } }, String(P.total)), h('span', {}, 'tracks moved so far')),
              h('div', { class: 'small muted' }, `Arm at track ${P.pos} · ${served.length} of ${queue.length} requests served · started at ${head}`));
            if (left.length) {
              verdict.replaceChildren(h('div', { class: 'callout tip small m0', 'data-label': 'Tip', html: 'Always taking the nearest request is exactly what <span class="t">SSTF</span> does. Sometimes a move that looks worse now saves a long trip later: think about which end of the disk you will have to visit anyway.' }),
                h('p', { class: 'small muted m0' }, 'Finish the queue to see how your total compares with the policies and with the least possible total.'));
              return;
            }
            const rows = [['You', P.total], ['Least possible', best(queue, head)], ['SSTF', plan(queue, head, true, 'sstf').total], ['LOOK, starting up', plan(queue, head, true, 'look').total], ['LOOK, starting down', plan(queue, head, false, 'look').total], ['C-LOOK, up', plan(queue, head, true, 'clook').total], ['FIFO', plan(queue, head, true, 'fifo').total]];
            const sorted = rows.slice().sort((a, b) => a[1] - b[1] || (a[0] === 'You' ? -1 : b[0] === 'You' ? 1 : 0));
            const opt = rows[1][1], sstf = rows[2][1];
            const msg = P.total === opt ? `<b>Perfect.</b> ${P.total} tracks is the least possible for this queue${sstf > opt ? `, and you beat SSTF by ${sstf - opt} tracks` : ''}.` : P.total <= sstf ? `<b>Good.</b> You matched or beat SSTF, but ${P.total - opt} tracks more than the least possible.` : `<b>${P.total - opt} tracks more than the least possible.</b> Try again: sweep to one end of the requests first, then to the other.`;
            verdict.replaceChildren(h('div', { class: 'narr ' + (P.total === opt ? 'ok' : P.total <= sstf ? '' : 'bad'), html: msg }),
              h('table', { class: 'tbl compact' }, h('tbody', {}, ...sorted.map(([nm, v]) => h('tr', { class: nm === 'You' ? 'on' : '' }, h('td', { class: nm === 'You' ? 'b' : '' }, nm), h('td', { class: 'num' }, v + ' tracks'), h('td', { class: 'num muted' }, 'avg ' + fmt(v / queue.length, 1)))))));
          }
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 640px) minmax(0, 1fr)', gap: '18px' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'Now <b>you</b> pick the order. Click the request to serve next; the button shows how far the arm must move. Fewer tracks in total wins.' }),
              btnRow, chartBox),
            h('div', { class: 'stack', style: { gap: '10px' } }, presetSeg, score,
              h('div', { class: 'row gap-s' },
                h('button', { class: 'btn sm', type: 'button', onclick: () => { served.pop(); draw(); } }, 'Undo last'),
                h('button', { class: 'btn sm', type: 'button', onclick: () => { served = []; draw(); } }, 'Start over'),
                h('button', { class: 'btn sm', type: 'button', onclick: () => { which = 'random'; presetSeg.set('random'); load(); } }, 'Deal a new random queue')),
              verdict)));
          load();
        },
      },
      {
        title: 'Every policy on the same queue',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const fmt = ctx.util.fmt;
          const PRE = {
            classic: { label: 'Classic', head: 100, q: CLASSIC.slice() },
            cluster: { label: 'Two clusters', head: 100, q: [12, 182, 15, 186, 9, 179, 18, 190, 14] },
            near: { label: 'Mostly near the arm', head: 100, q: [96, 104, 22, 99, 108, 93, 181, 101, 111] },
            random: { label: 'Random', head: 100, q: null },
          };
          let which = 'classic', up = true, seed = 0;
          const grid = h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: '8px' } });
          const bars = h('div', { class: 'card white', style: { padding: '8px 10px' } });
          const take = h('div', { class: 'narr small' });
          const preSeg = ctx.ui.seg(Object.entries(PRE).map(([k, v]) => ({ value: k, label: v.label })), which, (v) => { which = v; if (v === 'random') seed++; draw(); });
          const dirSeg = ctx.ui.seg([{ value: true, label: '↑ up' }, { value: false, label: '↓ down' }], up, (v) => { up = v; draw(); });
          function draw() {
            const P = PRE[which];
            let q = P.q, head = P.head;
            if (which === 'random') { const r = rng32(seed * 4241 + 9); head = Math.floor(r() * (LAST + 1)); q = Array.from({ length: 9 }, () => Math.floor(r() * (LAST + 1))); }
            const res = SIM_POLS.map((k) => { const run = plan(q, head, up, k, 101); return { k, run, avg: k === 'rss' ? rssMean(q, head, 500) : run.avg }; });
            const opt = best(q, head) / q.length;
            const minAvg = Math.min(...res.map((r) => r.avg));
            grid.replaceChildren(...res.map((r) => h('div', { class: 'card tight', style: { padding: '6px 8px', borderColor: r.avg === minAvg ? 'var(--ok)' : '' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, POL[r.k].name), h('span', { class: 'small num', style: { fontWeight: 700, color: r.avg === minAvg ? 'var(--ok)' : 'var(--ink-2)' } }, (r.k === 'rss' ? '≈ ' : '') + fmt(r.avg, 1))),
              zigChart(ctx, { W: 200, rows: q.length, rowH: 12, steps: r.run.steps, head, L: 10, R: 12, T: 38, dot: 3, thin: true, ticks: [0, 100, 199], aria: POL[r.k].name + ' path' }))));
            /* bar chart of average seek length */
            const W = ctx.narrow ? 340 : 400, LW = 70, rowH = 21, n = res.length + 1, H = n * rowH + 26;
            const max = Math.max(...res.map((r) => r.avg), opt) * 1.12;
            const X = (v) => LW + (v / max) * (W - LW - 50);
            const kids = [s('text', { x: 0, y: 14, 'font-size': 13, class: 's-sub' }, 'average seek length (tracks per request)')];
            [...res.map((r) => [POL[r.k].name, r.avg, r.avg === minAvg ? 's-ok' : r.k === 'rss' ? 's-panel' : 's-io']), ['Best', opt, 's-accent']].forEach(([nm, v, cls], i) => {
              const y = 24 + i * rowH;
              kids.push(s('text', { x: LW - 8, y: y + 16, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700 }, nm),
                s('rect', { x: LW, y: y + 3, width: Math.max(2, X(v) - LW), height: rowH - 8, rx: 4, class: cls, 'stroke-width': 1.5 }),
                s('text', { x: X(v) + 6, y: y + 16, 'font-size': 13.5, 'font-weight': 700 }, (nm === 'RSS' ? '≈' : '') + fmt(v, 1)));
            });
            bars.replaceChildren(s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Bar chart of average seek length per policy' }, ...kids));
            const winners = res.filter((r) => r.avg === minAvg).map((r) => POL[r.k].name).join(' and ');
            const av = (k) => fmt(res.find((r) => r.k === k).avg, 1);
            take.innerHTML = `Arm at <b>${head}</b>; queue ${q.join(', ')}. Lowest here: <b>${winners}</b> (${fmt(minAvg, 1)}), against FIFO's ${av('fifo')}. RSS is the mean of 500 random orders; its chart shows one.` +
              (which === 'classic' && up ? `<br><b>Tables that give SCAN ${av('look')} and C-SCAN ${av('clook')}</b> turn at the last request: that is LOOK and C-LOOK here. To the edge, counting C-SCAN's return: ${av('scan')} and ${av('cscan')}.` : '');
          }
          /* "Who waits longest?": the arm sweeps steadily 0 → 199 → 0, one track per time unit. Track x is
             passed going up and again coming down, so its two gaps are 2(199 − x) and 2x. A request that
             arrives at a random moment falls in a gap with probability gap / (2 × 199) and then waits half
             that gap on average: mean wait = (x² + (199 − x)²) / 199 time units = that / 199 sweeps. */
          const gapsOf = (x) => ({ far: 2 * (LAST - x), near: 2 * x });
          const waitOf = (x) => (x * x + (LAST - x) * (LAST - x)) / (LAST * LAST);   // in sweeps (one sweep = crossing the disk once)
          let wx = 20;
          const WW = ctx.narrow ? 340 : 400;
          const tlSvg = s('svg', { viewBox: `0 0 ${WW} 66`, width: '100%', role: 'img', 'aria-label': 'One full round trip of the arm, with the moments it passes the chosen track' });
          const cvSvg = s('svg', { viewBox: `0 0 ${WW} 132`, width: '100%', role: 'img', 'aria-label': 'Average wait under SCAN for each track' });
          const wTxt = h('div', { class: 'narr small' });
          const wSl = ctx.ui.slider({ label: 'Track', min: 0, max: LAST, value: wx, onInput: (v) => { wx = v; drawWait(); } });
          function drawWait() {
            const g = gapsOf(wx), cyc = 2 * LAST, x0 = 6, x1 = WW - 6, X = (t) => x0 + (t / cyc) * (x1 - x0);
            const a = 0, b = g.far, c = cyc, short = Math.min(g.far, g.near), long = Math.max(g.far, g.near);
            tlSvg.replaceChildren(
              s('rect', { x: X(a), y: 20, width: Math.max(0, X(b) - X(a)), height: 16, rx: 3, class: g.far >= g.near ? 's-bad' : 's-ok', 'stroke-width': 1.2 }),
              s('rect', { x: X(b), y: 20, width: Math.max(0, X(c) - X(b)), height: 16, rx: 3, class: g.near > g.far ? 's-bad' : 's-ok', 'stroke-width': 1.2 }),
              ...[a, b, c].map((t) => s('line', { x1: X(t), y1: 14, x2: X(t), y2: 42, style: 'stroke:var(--os)', 'stroke-width': 3 })),
              s('text', { x: 6, y: 11, 'font-size': 13, class: 's-sub' }, `passes of track ${wx} during one round trip →`),
              s('text', { x: (X(a) + X(b)) / 2, y: 58, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, g.far > 60 ? `${g.far} via 199` : String(g.far)),
              s('text', { x: (X(b) + X(c)) / 2, y: 58, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, g.near > 60 ? `${g.near} via 0` : String(g.near)));
            const L0 = 42, R0 = 10, T0 = 10, B0 = 26, Xc = (t) => L0 + (t / LAST) * (WW - L0 - R0), Yc = (w) => T0 + (1 - w) * (132 - T0 - B0);
            const pts = []; for (let t = 0; t <= LAST; t += 1) pts.push(`${Xc(t).toFixed(1)},${Yc(waitOf(t)).toFixed(1)}`);
            cvSvg.replaceChildren(
              ...[0, 0.5, 1].map((w) => s('line', { x1: L0, y1: Yc(w), x2: WW - R0, y2: Yc(w), class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 4' })),
              ...[0, 0.5, 1].map((w) => s('text', { x: L0 - 6, y: Yc(w) + 4.5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(w))),
              ...[0, 100, 199].map((t) => s('text', { x: Xc(t), y: 128, 'text-anchor': t ? (t === LAST ? 'end' : 'middle') : 'start', 'font-size': 13, class: 's-sub' }, String(t))),
              s('polyline', { points: pts.join(' '), fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 2.5 }),
              s('circle', { cx: Xc(wx), cy: Yc(waitOf(wx)), r: 5.5, class: 's-accent', 'stroke-width': 2 }),
              s('text', { x: (WW + L0 - R0) / 2, y: Yc(0.86), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'paint-order:stroke;stroke:var(--panel);stroke-width:4px' }, `track ${wx}: ${fmt(waitOf(wx), 2)} sweep`));
            wTxt.innerHTML = (short ? `Track ${wx} is passed twice ${short} time units apart, then not again for ${long}. A request arriving at a random moment lands in that long gap ${fmt((long / cyc) * 100, 0)}% of the time` : `Track ${wx} is passed once per round trip, at the turn, every ${long} time units`) +
              `. Average wait: <b>${fmt(waitOf(wx), 2)} sweep</b> (middle ${fmt(waitOf(100), 2)}, edges ${fmt(waitOf(0), 2)}).`;
          }
          const waitBox = h('div', { class: 'card white stack', style: { gap: '6px', padding: '8px 12px' } },
            h('div', { class: 'small', html: 'SCAN sweeping steadily from edge to edge. Time unit: one track of arm travel; one sweep = crossing the disk once.' }),
            wSl, tlSvg, h('div', { class: 'xs muted' }, 'Average wait (in sweeps) for each track under SCAN'), cvSvg, wTxt);
          const whyBox = h('div', { class: 'callout warn small m0', 'data-label': 'Edge tracks: favoured or not?', html: 'You may read that SCAN favours the innermost and outermost tracks. True part: an edge track is passed twice in quick succession, so a request arriving just before the turn is served at once; waits there vary most. Averaged over many arrivals, though, edge tracks wait <b>longest</b>, up to twice the middle. C-SCAN gives every track the same average wait.' });
          let view = 'avg';
          const panel = h('div', { class: 'stack', style: { gap: '8px' } });
          const viewSeg = ctx.ui.seg([{ value: 'avg', label: 'Average seek' }, { value: 'wait', label: 'Who waits longest?' }], view, (v) => { view = v; showView(); });
          function showView() { panel.replaceChildren(...(view === 'avg' ? [bars, take] : [waitBox])); left.replaceChildren(grid, view === 'avg' ? whyAvg : whyBox); drawWait(); }
          const whyAvg = h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'No policy wins on every queue. Nearest-first and sweeping policies keep the arm reading instead of travelling; the sweeping ones also spread the waiting more evenly, which is why classic disk schedulers in real systems were built around sweeps.' });
          const left = h('div', { class: 'stack', style: { gap: '10px' } });
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
            h('div', { class: 'row', style: { gap: '12px' } }, preSeg, dirSeg,
              h('button', { class: 'btn sm', type: 'button', onclick: () => { which = 'random'; seed++; preSeg.set('random'); draw(); } }, 'New random queue')),
            h('div', { class: 'split', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 7fr) minmax(0, 4fr)', gap: '14px', flex: 1, minHeight: 0 } },
              left, h('div', { class: 'stack', style: { gap: '8px' } }, viewSeg, panel))));
          showView();
          draw();
        },
      },
      {
        title: 'Starvation and arm stickiness: N-step-SCAN and FSCAN',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const fmt = ctx.util.fmt;
          const SCEN = {
            A: { label: 'A · a far request', head: 50, make() {
              const r = [{ id: 'F', track: 185, arr: 0, tag: 1 }];
              [48, 53, 45].forEach((t, k) => r.push({ id: 'L' + (k + 1), track: t, arr: 0 }));
              [56, 47, 51, 44, 57, 49, 54, 46, 52, 43, 55, 50].forEach((t, k) => r.push({ id: 'L' + (k + 4), track: t, arr: 15 + k * 18 }));
              return r.map((x, k) => Object.assign(x, { seq: k }));
            }, text: 'Request <b>F</b> (track 185) arrives at time 0 together with three requests near track 50. Every 1.8 ms another request arrives near track 50.' },
            B: { label: 'B · one process hammers one track', head: 70, make() {
              const r = [{ id: 'A', track: 20, arr: 0, tag: 1 }, { id: 'B', track: 150, arr: 0, tag: 1 }];
              for (let k = 0; k < 14; k++) r.push({ id: 'P' + (k + 1), track: 70, arr: k * 15 });
              return r.map((x, k) => Object.assign(x, { seq: k }));
            }, text: 'Requests <b>A</b> (track 20) and <b>B</b> (track 150) wait at time 0. Meanwhile process P sends a request for track 70, where the arm is, every 1.5 ms.' },
          };
          const PD = {
            fifo: ['FIFO', 'One queue in strict arrival order. Wasteful when requests are scattered, but nothing can ever overtake anything.'],
            sstf: ['SSTF', 'Always the nearest request. A stream of nearby arrivals keeps winning, so a far request can wait as long as the stream lasts: starvation.'],
            scan: ['SCAN', 'Sweeps, turning at the last request (LOOK style). A far request in the sweep direction is reached on this pass. But a request at the arm\'s own track always counts as ahead, so a busy process can hold the arm: arm stickiness.'],
            nstep: ['N-step-SCAN', 'The queue is cut into subqueues of N requests. The arm sweeps one subqueue completely; arrivals join later subqueues. N = 1 makes it FIFO; a large N makes it perform like SCAN.'],
            fscan: ['FSCAN', 'Two queues. When a sweep begins, everything waiting is in one queue and the other is empty; new arrivals go to the other queue and wait for the next sweep.'],
          };
          let sc = 'A', pol = 'sstf', N = 3;
          const chartBox = h('div', { class: 'card white', style: { padding: '4px 6px', display: 'grid', placeItems: 'start center' } });
          const card = h('div', { class: 'card white stack', style: { gap: '4px', padding: '10px 14px' } });
          const tbl = h('div');
          const narr = h('div', { class: 'narr small' });
          const scText = h('p', { class: 'm0 small' });
          const scSeg = ctx.ui.seg(Object.entries(SCEN).map(([k, v]) => ({ value: k, label: v.label })), sc, (v) => { sc = v; draw(); });
          const polSeg = ctx.ui.seg(Object.keys(PD).map((k) => ({ value: k, label: PD[k][0] })), pol, (v) => { pol = v; draw(); });
          const nSl = ctx.ui.slider({ label: 'N', min: 1, max: 8, value: N, format: (v) => String(v), onInput: (v) => { N = v; draw(); } });
          nSl.style.minWidth = '170px';
          function chart(run, reqs, tmax) {
            const W = ctx.narrow ? 360 : 600, H = 392, L = 50, R = 16, T = 34, B = 8;
            const X = (t) => L + (t / LAST) * (W - L - R), Y = (tt) => T + (tt / tmax) * (H - T - B);
            const kids = [];
            for (let ms = 0; ms * 10 <= tmax; ms += 10) kids.push(s('line', { x1: L, y1: Y(ms * 10), x2: W - R, y2: Y(ms * 10), class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 5' }), s('text', { x: L - 8, y: Y(ms * 10) + 4.5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, ms + ' ms'));
            [0, 50, 100, 150, 199].forEach((t) => kids.push(s('text', { x: X(t), y: 14, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t))));
            kids.push(s('line', { x1: X(0), y1: T - 12, x2: X(LAST), y2: T - 12, class: 's-line', 'stroke-width': 1.5 }), s('text', { x: 4, y: 14, 'font-size': 13, class: 's-sub' }, 'track'));
            if (run.batches.length > 1 && run.batches.length <= 9) run.batches.forEach((b, k) => k && kids.push(s('line', { x1: L, y1: Y(b.at), x2: W - R, y2: Y(b.at), style: 'stroke:var(--os)', 'stroke-width': 1.2, 'stroke-dasharray': '8 4' })));
            reqs.forEach((r) => kids.push(s('circle', { cx: X(r.track), cy: Y(r.arr), r: 3.5, fill: 'none', style: 'stroke:var(--muted)', 'stroke-width': 1.5 })));
            run.done.filter((d) => d.tag).forEach((d) => kids.push(s('line', { x1: X(d.track), y1: Y(d.arr), x2: X(d.track), y2: Y(d.reach), style: 'stroke:var(--bad)', 'stroke-width': 2, 'stroke-dasharray': '4 4' })));
            run.segs.forEach((g) => {
              if (g.seek) kids.push(s('line', { x1: X(g.x0), y1: Y(g.t0), x2: X(g.x1), y2: Y(g.t1), style: 'stroke:var(--chc)', 'stroke-width': 2.2 }));
              else if (g.svc) kids.push(s('line', { x1: X(g.x0), y1: Y(g.t0), x2: X(g.x1), y2: Y(g.t1), style: 'stroke:var(--io)', 'stroke-width': 5 }));
              else kids.push(s('line', { x1: X(g.x0), y1: Y(g.t0), x2: X(g.x1), y2: Y(g.t1), class: 's-muted', 'stroke-dasharray': '2 3' }));
            });
            run.done.filter((d) => d.tag).forEach((d) => {
              const right = X(d.track) < W - 90;
              kids.push(s('text', { x: X(d.track) + (right ? 8 : -8), y: Y(d.arr) + 16, 'text-anchor': right ? 'start' : 'end', 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--bad);paint-order:stroke;stroke:var(--panel);stroke-width:4px' }, `${d.id} · ${fmt(d.resp / 10, 1)} ms`));
            });
            return s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Arm position over time; time runs downward' }, ...kids);
          }
          function draw() {
            const S = SCEN[sc], reqs = S.make();
            const runs = {}; Object.keys(PD).forEach((k) => { runs[k] = runDyn(reqs, S.head, true, k, N); });
            const tmax = Math.ceil(Math.max(...Object.values(runs).map((r) => r.end)) / 50) * 50;
            const run = runs[pol];
            scText.innerHTML = S.text;
            chartBox.replaceChildren(chart(run, reqs, tmax));
            card.replaceChildren(h('b', { style: { fontSize: '17px' } }, PD[pol][0] + (pol === 'nstep' ? ` (N = ${N})` : '')), h('p', { class: 'm0', style: { fontSize: '14.5px' } }, PD[pol][1]));
            const far = (r) => r.done.filter((d) => d.tag).map((d) => `${d.id} ${fmt(d.resp / 10, 1)}`).join(' · ');
            tbl.replaceChildren(h('table', { class: 'tbl compact' },
              h('thead', {}, h('tr', {}, h('th', {}, 'Policy'), h('th', {}, sc === 'A' ? 'F done after (ms)' : 'A, B done after (ms)'), h('th', {}, 'Mean (ms)'), h('th', {}, 'Arm moved'))),
              h('tbody', {}, ...Object.keys(PD).map((k) => h('tr', { class: k === pol ? 'on' : '' }, h('td', { class: 'b' }, PD[k][0] + (k === 'nstep' ? ' ' + N : '')), h('td', { class: 'num' }, far(runs[k])), h('td', { class: 'num' }, fmt(runs[k].mean / 10, 1)), h('td', { class: 'num' }, runs[k].moved + ' tr'))))));
            const tagged = run.done.filter((d) => d.tag), n = run.done.length;
            const pos = tagged.map((d) => `${d.id} was served ${ordinal(run.done.indexOf(d) + 1)} of ${n}`).join('; ');
            const starving = tagged.some((d) => run.done.indexOf(d) >= n - 2);
            narr.className = 'narr small ' + (starving ? 'bad' : 'ok');
            narr.innerHTML = `<b>${PD[pol][0]}:</b> ${pos}. ` + (starving ? (sc === 'A' ? 'The nearby stream kept winning until it dried up.' : 'The arm stuck to track 70 until process P stopped.') : (pol === 'fifo' ? 'Nobody overtakes, at the price of more arm travel.' : 'Freezing the queue for each sweep let the waiting requests through.'));
            if (pol === 'scan' && sc === 'A') narr.innerHTML = `<b>SCAN:</b> ${pos}. The sweep up from track 50 reached F on this pass. Try scenario B to see where SCAN fails.`;
          }
          const ordinal = (k) => k + (k % 10 === 1 && k !== 11 ? 'st' : k % 10 === 2 && k !== 12 ? 'nd' : k % 10 === 3 && k !== 13 ? 'rd' : 'th');
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
            h('div', { class: 'row', style: { gap: '12px' } }, scSeg, polSeg, nSl),
            h('div', { class: 'split', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 600px) minmax(0, 1fr)', gap: '16px', flex: 1, minHeight: 0 } },
              chartBox,
              h('div', { class: 'stack', style: { gap: '8px' } }, scText, card, tbl, narr,
                h('p', { class: 'xs muted m0' }, 'Time runs downward. Hollow circles: arrivals. Orange bars: a request being served (2 ms). Red dashes: a marked request waiting for the arm (its label gives the time until it was done). Violet dashes: a new batch begins. Toy timing: 0.1 ms per track moved.')))));
          draw();
        },
      },
      {
        title: 'Recap: ten ways to order the queue',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const avg = (k, up = true) => f1(plan(CLASSIC, 100, up, k).avg);
          const rows = [
            ['g', 'Chosen by who asked (the requester)'],
            ['RSS', 'Any waiting request, picked at random', 'Only a yardstick for judging the others'],
            ['FIFO', 'Oldest request first', `Fair, nobody starves; ignores the arm (classic queue: ${avg('fifo')})`],
            ['PRI', 'Request of the highest-priority process first', 'Set outside the disk manager; poor for database systems'],
            ['LIFO', 'Newest request first', 'Uses locality in transaction work; old requests can starve'],
            ['g', 'Chosen by what was asked for (the track)'],
            ['SSTF', 'Request nearest the arm first', `Least travel per step, short queues; far requests can starve (${avg('sstf')})`],
            ['SCAN', 'Sweep one way to the edge serving requests, then back', `Spreads service; just-swept tracks and, on average, edge tracks wait longest (${avg('scan')})`],
            ['C-SCAN', 'Sweep one way only; return to the start without serving', `Most even waiting times; the return trip costs travel (${avg('cscan')})`],
            ['LOOK, C-LOOK', 'SCAN and C-SCAN turning at the last request', `No empty edge trips (${avg('look')} and ${avg('clook')}: what many tables print as SCAN and C-SCAN)`],
            ['N-step-SCAN', 'SCAN over one subqueue of N requests at a time', 'Guaranteed service, no arm stickiness; N = 1 is FIFO'],
            ['FSCAN', 'SCAN over the requests waiting when the sweep began', 'New arrivals wait for the next sweep; no arm stickiness'],
          ];
          const body = h('tbody', {}, ...rows.map((r) => r[0] === 'g'
            ? h('tr', {}, h('td', { colspan: 3, style: { background: 'var(--panel-3)', fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-2)' } }, r[1]))
            : h('tr', {}, h('td', { class: 'b', style: { whiteSpace: 'nowrap' } }, r[0]), h('td', {}, r[1]), h('td', {}, r[2]))));
          const table = h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Policy'), h('th', {}, 'How it chooses'), h('th', {}, 'Remarks (average seek, classic queue)'))), body);
          const keep = [
            ['Where time goes', `Seek + rotational delay + transfer. One random sector: ${f1(4, 0)} + ${f1(FT.rot, 0)} + ${f1(FT.per, 3)} = ${f1(FT.one, 3)} ms. Positioning is almost all of it.`],
            ['Order is everything', `The same 2,500 sectors: ${f1(FT.seq, 0)} ms when read in track order, ${f1(FT.rnd / 1000, 1)} s when scattered.`],
            ['Travel versus fairness', 'SSTF and the sweeps cut arm travel; FIFO is fair but wasteful; random order is only a benchmark.'],
            ['Freeze the batch', 'SSTF and SCAN can starve or stick to one busy track; N-step-SCAN and FSCAN sweep a frozen batch.'],
          ];
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } }, table,
            h('div', { class: 'grid-4', style: { gap: '10px' } }, ...keep.map(([t, d]) => h('div', { class: 'card tight', style: { borderLeft: '4px solid var(--chc)' } }, h('b', { class: 'small' }, t), h('p', { class: 'm0', style: { fontSize: '14px', lineHeight: 1.4 } }, d))))));
        },
      },
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { type: 'num', q: 'A disk spins at 15,000 rpm. What is its average rotational delay, in milliseconds?', answer: 2, tol: 0.01, unit: 'ms',
            hint: 'Find the time for one revolution first.',
            why: '15,000 rpm is 250 revolutions per second, so one turn takes 1/250 s = 4 ms. On average the sector is half a turn away: 1/(2r) = 2 ms.' },
          { type: 'num', q: 'A disk spins at 7,500 rpm and holds 500 sectors of 512 bytes on each track. Once the wanted sector starts to pass under the head, how long does reading that one sector take, in milliseconds?', answer: 0.016, tol: 0.0005, unit: 'ms',
            why: 'One revolution takes 60,000 / 7,500 = 8 ms. One sector is 1/500 of the track, so it passes in 8 / 500 = 0.016 ms; the formula b/(rN) = 512 / (125 × 256,000) s gives the same.' },
          { type: 'num', q: 'The disk arm is at track 50. Requests arrive in this order: 80, 20, 60. With FIFO scheduling, how many tracks does the arm cross in total?', answer: 130, tol: 0, unit: 'tracks',
            why: 'FIFO serves them in arrival order: 50 → 80 is 30, 80 → 20 is 60, 20 → 60 is 40. Total 30 + 60 + 40 = 130 tracks.' },
          { type: 'order', q: 'The arm is at track 50. The queue holds requests for tracks 80, 20, 60, 45 and 90. Put them in the order SSTF serves them.', items: ['Track 45', 'Track 60', 'Track 80', 'Track 90', 'Track 20'],
            why: 'SSTF always takes the nearest: 45 (5 away), then 60 (15), 80 (20), 90 (10), and only then the far request at 20 (70). Total 120 tracks.' },
          { q: 'A request for a distant track is waiting. Meanwhile new requests keep arriving for tracks a few tracks to either side of the arm. Which policy can leave the distant request waiting for as long as that stream continues?', choices: ['FIFO', 'SSTF', 'C-SCAN', 'FSCAN'], answer: 1,
            feedback: ['FIFO serves strictly in arrival order, so newer nearby requests can never overtake the older distant one.', null, 'C-SCAN keeps moving in its sweep direction and leaves arrivals behind it for the next sweep, so it reaches the distant track on this sweep or the next.', 'FSCAN serves only the requests waiting when a sweep began; newcomers wait for the next sweep, so the distant request is reached.'],
            why: 'SSTF always picks the request nearest the arm. A steady supply of nearby requests always beats the distant one, so it can starve.' },
          { q: 'Under C-SCAN, what does the arm do once it has served the last request in its sweep direction?', choices: ['It reverses direction and serves requests on its way back to the start.', 'It stops at the edge and waits there until a new request turns up.', 'It returns to the other end without serving, then sweeps the same way.', 'It moves next to whichever waiting request is closest to where it is.'], answer: 2,
            feedback: ['Serving on the way back is SCAN, not C-SCAN.', 'The arm does not idle while requests are waiting behind it.', null, 'Picking the closest request is SSTF.'],
            why: 'C-SCAN serves in one direction only. It goes back to the far end without serving (C-LOOK jumps straight to the farthest waiting request) and sweeps again, which keeps waiting times even across tracks.' },
          { q: 'N-step-SCAN with N = 1 behaves exactly like which policy?', choices: ['SCAN', 'SSTF', 'FSCAN', 'FIFO'], answer: 3,
            feedback: ['SCAN orders a whole set of requests by position; with N = 1 there is nothing to order.', 'SSTF compares the waiting requests by distance; a subqueue of one request offers no choice.', 'FSCAN freezes everything that is waiting when a sweep starts, which is like a very large N, not N = 1.', null],
            why: 'Each subqueue holds a single request, and subqueues are served in the order they were filled, which is arrival order: FIFO.' },
          { q: 'With priority (PRI) disk scheduling, what decides which request is served next?', choices: ['The priority of the requesting process, set outside the disk manager', 'How far the arm must travel from its position to each request', 'The exact order in which the requests arrived in the disk queue', 'A random pick among all the requests that are currently waiting'], answer: 0,
            feedback: [null, 'Choosing by distance is SSTF, a policy based on the requested item.', 'Arrival order is FIFO.', 'Random choice is RSS, the benchmark.'],
            why: 'PRI takes the order from the importance of the requesting process, for example favouring short batch jobs and interactive users. The disk manager does not control it, so it does nothing for arm travel.' },
          { type: 'bucket', q: 'Does each policy choose by who made the request, or by which track it asks for?', buckets: ['By requester', 'By requested track'],
            items: [['RSS', 0], ['FIFO', 0], ['PRI', 0], ['LIFO', 0], ['SSTF', 1], ['SCAN', 1], ['C-SCAN', 1], ['N-step-SCAN', 1], ['FSCAN', 1]],
            why: 'RSS, FIFO, PRI and LIFO look only at the requester or arrival time. SSTF and the sweeping family look at where the requested data lies.' },
          { type: 'match', q: 'Match each policy to how it picks the next request.',
            pairs: [['LIFO', 'Newest request first'], ['SSTF', 'Least arm movement from the current position'], ['LOOK', 'Sweeps, but reverses at the last request instead of the edge'], ['FSCAN', 'New arrivals wait in a second queue until the sweep ends'], ['RSS', 'Random order, used only as a benchmark']],
            why: 'Each name says how the choice is made: by recency (LIFO), by distance (SSTF), by sweep (LOOK), by frozen batch (FSCAN) or by chance (RSS).' },
          { type: 'tf', q: 'Doubling a disk\'s rotation speed halves both its average rotational delay and the time to transfer a given number of bytes.', answer: true,
            why: 'Both terms have the rotation speed r in the denominator: 1/(2r) and b/(rN). Seek time is not affected.' },
          { type: 'multi', q: 'Which policies stop one process that keeps requesting the same track from holding the arm there (arm stickiness)?', choices: ['SSTF', 'SCAN', 'N-step-SCAN', 'FSCAN', 'C-SCAN'], answer: [2, 3],
            why: 'N-step-SCAN and FSCAN serve a batch that is frozen when the sweep starts; new requests for the busy track wait for a later batch. SSTF, SCAN and C-SCAN accept a request at the arm\'s own track at once, so they can stick.' },
        ],
      },
    ],
    notes: `
      <h3>Disk scheduling</h3>
      <p>A hard disk spends most of each request getting its head into position, not reading. Many processes share one disk, so requests queue up and the operating system chooses the order; that choice, made mainly to cut arm travel, is <b>disk scheduling</b>.</p>
      <h4>Inside a hard disk</h4>
      <ul>
        <li><b>Platter</b>: a rigid disc with magnetic coating on both surfaces; several sit on one <b>spindle</b>, which spins them together at a constant speed (commonly 5,400 to 15,000 rpm).</li>
        <li><b>Track</b>: one ring of data on one surface. <b>Sector</b>: a fixed-size slice of a track, the smallest unit read or written (classically 512 bytes, 4,096 on most newer drives).</li>
        <li><b>Read/write head</b>: flies just above each surface. The <b>disk arm</b> (actuator) moves all heads together, so it can be at only one track position at a time.</li>
        <li><b>Cylinder</b>: the tracks, one per surface, under the heads at one arm position; reading within one cylinder needs no arm movement.</li>
      </ul>
      <h4>Where the time goes</h4>
      <p>Before the mechanics start, a request may wait for the <b>device</b> (the disk is busy with other requests) and, on some systems, for a <b>channel</b> (a data path shared by several disks). Then:</p>
      <ul>
        <li><b>Seek time</b> T<sub>s</sub>: moving the arm to the track. Straight-line model T<sub>s</sub> = m × n + s (n tracks crossed, m time per track, s startup and settling time). Real arms speed up, coast and settle, so this is an approximation; average seeks today take a few ms.</li>
        <li><b>Rotational delay</b> (latency): waiting for the sector to come round, on average half a revolution: 1/(2r) for r revolutions per second. 7,500 rpm = 125 rev/s, so one turn takes 8 ms and the average delay is 4 ms; at 15,000 rpm it is 2 ms.</li>
        <li><b>Transfer time</b> T = b / (r × N): b bytes to move, N bytes per track.</li>
      </ul>
      <p><b>Access time</b> is seek time plus rotational delay. The whole operation takes on average <b>T<sub>a</sub> = T<sub>s</sub> + 1/(2r) + b/(rN)</b>, plus any queueing. Worked example: crossing 100 tracks with m = 0.03 ms and s = 1 ms gives T<sub>s</sub> = 4 ms; at 7,500 rpm with 500 sectors of 512 bytes per track, one sector transfers in 8/500 = ${f1(FT.per, 3)} ms, so T<sub>a</sub> = 4 + 4 + ${f1(FT.per, 3)} = ${f1(FT.one, 3)} ms. Positioning is ${f1((8 / FT.one) * 100, 1)}% of it.</p>
      <h4>Sequential versus random: the order matters</h4>
      <p>Disk with 4 ms average seek, 7,500 rpm, 500 sectors of 512 bytes per track; file of 2,500 sectors (1.28 MB).</p>
      <ul>
        <li><b>Sequential</b> (5 neighbouring full tracks): first track 4 + 4 + 8 = ${f1(FT.first, 0)} ms; each of the other 4 tracks 4 + 8 = ${f1(FT.other, 0)} ms (no further seek assumed). Total ${f1(FT.seq, 0)} ms.</li>
        <li><b>Random</b> (sectors scattered): each sector 4 + 4 + ${f1(FT.per, 3)} = ${f1(FT.one, 3)} ms; × 2,500 = ${f1(FT.rnd, 0)} ms ≈ ${f1(FT.rnd / 1000, 2)} s.</li>
      </ul>
      <p>Same disk, same bytes, about ${f1(FT.rnd / FT.seq, 0)} times slower: only the visiting order differs.</p>
      <h4>Policies that choose by requester</h4>
      <ul>
        <li><b>RSS (random scheduling)</b>: a random waiting request. Never used for real; it is the benchmark other policies are judged against.</li>
        <li><b>FIFO</b>: arrival order. Fair: nothing starves. It ignores the arm: excellent for one process reading a file in order, but with many processes taking turns almost every request is a long jump, and it performs like random order or worse.</li>
        <li><b>PRI (priority)</b>: the importance of the requesting process decides, set outside the disk manager (for example short batch jobs and interactive users first). It does nothing for arm travel, low-priority work can wait a long time, and it suits database systems poorly.</li>
        <li><b>LIFO</b>: newest request first. In transaction processing the newest request usually comes from the process just served and lies next to its previous one, so the arm barely moves. Old requests can be pushed back indefinitely: starvation.</li>
      </ul>
      <h4>Policies that choose by requested track</h4>
      <ul>
        <li><b>SSTF</b> (shortest service time first): the waiting request nearest the arm. Small seeks and short queues, but a far request can starve while closer ones keep arriving. Always taking the nearest is greedy and not always optimal.</li>
        <li><b>SCAN</b> (elevator): sweep one way serving every request reached, to the last track, then reverse. It evens out service compared with SSTF, but it is biased against the region it just swept: requests just behind the arm wait for the return trip, while new arrivals just ahead are served at once (so the latest arrivals are favoured).</li>
        <li><b>Edge tracks under SCAN</b>: you may read that SCAN favours the innermost and outermost tracks. True part: an edge track is passed twice in quick succession (just before and after the turn), then not again for nearly a full round trip, so a request arriving just before the turn is served almost at once and waits there vary the most. Averaged over many arrivals, though, edge tracks wait <b>longest</b>: most arrivals land in the long gap. With a steady sweep over tracks 0 to L, a request for track x arriving at a random moment waits on average (x² + (L − x)²) / L track-times: L/2 in the middle, L (twice as long) at the edges. With L = 199, track 20 waits ${f1((20 * 20 + 179 * 179) / 199, 1)}, track 100 waits ${f1((100 * 100 + 99 * 99) / 199, 1)}.</li>
        <li><b>C-SCAN</b>: serve in one direction only; at the end return to the far end without serving and sweep again. Every track is passed once per cycle at even intervals, so every track has the same average wait (half a cycle).</li>
        <li><b>LOOK</b> and <b>C-LOOK</b>: the usual refinements that turn at the last waiting request instead of the disk edge (C-LOOK jumps straight to the farthest waiting request). Many descriptions simply call these SCAN and C-SCAN.</li>
      </ul>
      <p>For a batch that is all present at once, the least possible travel is a sweep to the nearer end of the requests and then to the other end.</p>
      <h4>The classic example</h4>
      <p>200 tracks (0 to 199), arm at track 100 moving toward higher tracks, queue in arrival order 55, 58, 39, 18, 90, 160, 150, 38, 184. Seek length = tracks crossed since the previous service, including any trip to the edge and any return (counted here).</p>
      <table>
        <tr><th>Policy</th><th>Service order</th><th>Total</th><th>Average</th></tr>
        ${['fifo', 'sstf', 'scan', 'look', 'cscan', 'clook', 'lifo'].map((k) => { const r = plan(CLASSIC, 100, true, k); return `<tr><td>${POL[k].name}</td><td>${r.steps.map((x) => x.t).join(', ')}</td><td>${r.total}</td><td>${f1(r.avg, 1)}</td></tr>`; }).join('')}
      </table>
      <p><b>Which convention gives which number.</b> FIFO (${f1(plan(CLASSIC, 100, true, 'fifo').avg, 1)}) and SSTF (248 / 9 = 27.56, often printed as 27.5) do not depend on any convention. The widely printed 27.8 for SCAN and 35.8 for C-SCAN come from turning at the last request: they are the LOOK and C-LOOK rows above, with C-LOOK's jump from 184 back to 18 counted as 166 tracks. Running to the edge gives SCAN ${f1(plan(CLASSIC, 100, true, 'scan').avg, 1)} and, counting the run to 199 and the return to 0, C-SCAN ${f1(plan(CLASSIC, 100, true, 'cscan').avg, 1)}. Some sources leave the return trip out: C-SCAN then gives ${noReturn('cscan')} tracks (${(noReturn('cscan') / 9).toFixed(1)}) and C-LOOK ${noReturn('clook')} (${(noReturn('clook') / 9).toFixed(1)}). Random order averages about ${f1(rssMean(CLASSIC, 100, 500), 0)} here.</p>
      <h4>Starvation, arm stickiness, N-step-SCAN and FSCAN</h4>
      <p><b>Arm stickiness</b>: one or a few processes sending requests to the same track so fast that SSTF, SCAN or C-SCAN keep the arm there (a request at the arm's own track always counts as nearest and as ahead), while everyone else waits.</p>
      <ul>
        <li><b>N-step-SCAN</b>: cut the queue into subqueues of N requests; serve one subqueue at a time with SCAN; requests arriving meanwhile join later subqueues. N = 1 gives FIFO; a large N performs like SCAN. Every request is served within a bounded number of sweeps.</li>
        <li><b>FSCAN</b>: two queues. When a sweep begins, all waiting requests are in one queue and the other is empty; new arrivals go to the other queue and wait for the next sweep.</li>
      </ul>
      <h4>Summary</h4>
      <table>
        <tr><th>Policy</th><th>How it chooses</th><th>Remarks</th></tr>
        <tr><td colspan="3"><i>Selection according to the requester</i></td></tr>
        <tr><td>RSS</td><td>Random</td><td>Benchmark only</td></tr>
        <tr><td>FIFO</td><td>Oldest first</td><td>Fairest; ignores the arm</td></tr>
        <tr><td>PRI</td><td>Process priority</td><td>Control outside disk management</td></tr>
        <tr><td>LIFO</td><td>Newest first</td><td>Uses locality; can starve old requests</td></tr>
        <tr><td colspan="3"><i>Selection according to the requested item</i></td></tr>
        <tr><td>SSTF</td><td>Nearest track first</td><td>High utilization, short queues; starvation possible</td></tr>
        <tr><td>SCAN</td><td>Sweep back and forth</td><td>Better spread of service than SSTF</td></tr>
        <tr><td>C-SCAN</td><td>Sweep one way, return</td><td>Lowest variation in waiting time</td></tr>
        <tr><td>N-step-SCAN</td><td>SCAN on N requests at a time</td><td>Service guarantee</td></tr>
        <tr><td>FSCAN</td><td>SCAN on the queue frozen at sweep start</td><td>Responds to load; no stickiness</td></tr>
      </table>
      <h4>Real systems</h4>
      <p>Solid-state drives have no arm and no rotation, so reordering by position gains little there; Linux, for example, usually applies no reordering (its "none" scheduler) to fast NVMe drives. Section 11.9 follows how Linux's disk schedulers evolved.</p>
    `,
  });
})();
