/* =====================================================================
   11.6 RAID
   Original teaching material. Small helpers shared by several steps live
   inside this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ---- byte helpers ---- */
  const hex = (v) => v.toString(16).toUpperCase().padStart(2, '0');
  const bits = (v, w = 8) => v.toString(2).padStart(w, '0');

  /* ---- GF(2^8) arithmetic for RAID 6's Q check (polynomial 0x11d, generator 2) ---- */
  const EXP = new Array(512), LOG = new Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  const gdiv = (a, b) => (a ? EXP[(LOG[a] - LOG[b] + 255) % 255] : 0);
  const gpow = (i) => EXP[i % 255];
  function computePQ(data) { let P = 0, Q = 0; data.forEach((v, i) => { P ^= v; Q ^= gmul(gpow(i), v); }); return { P, Q }; }

  /* Recover the data bytes of one stripe. known[i] is null when data strip i is lost; P or Q is null when lost.
     Returns the full data array, or null when too much is missing. Uses only the surviving values. */
  function recoverStripe(known, P, Q) {
    const lost = known.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0);
    const out = known.slice();
    if (!lost.length) return out;
    if (lost.length === 1) {
      const a = lost[0];
      if (P != null) { let v = P; known.forEach((w, i) => { if (i !== a) v ^= w; }); out[a] = v; return out; }
      if (Q != null) { let v = Q; known.forEach((w, i) => { if (i !== a) v ^= gmul(gpow(i), w); }); out[a] = gdiv(v, gpow(a)); return out; }
      return null;
    }
    if (lost.length === 2 && P != null && Q != null) {
      const [a, b] = lost; let pab = P, qab = Q;
      known.forEach((w, i) => { if (i !== a && i !== b) { pab ^= w; qab ^= gmul(gpow(i), w); } });
      const da = gdiv(gmul(gpow(b), pab) ^ qab, gpow(a) ^ gpow(b));
      out[a] = da; out[b] = pab ^ da; return out;
    }
    return null;
  }

  /* Smallest number of single-error-correcting Hamming check bits (check disks) for N data bits (disks). */
  const hammingChecks = (N) => { let m = 1; while ((1 << m) < N + m + 1) m++; return m; };

  /* Layout of one stripe row for a level. Returns an array of n cells:
     { k: 'D' | 'P' | 'Q' | 'M', d: index of the data strip within the row (D/M), strip: logical strip number }.
     level: 0, 1, 4 (also used for 3), 5, 6. RAID 1 uses mirrored pairs (disk 2i and 2i+1). */
  function stripeRow(level, n, row) {
    const cells = new Array(n);
    if (level === 0) { for (let c = 0; c < n; c++) cells[c] = { k: 'D', d: c, strip: row * n + c }; return cells; }
    if (level === 1) { const p = n / 2; for (let c = 0; c < n; c++) { const d = Math.floor(c / 2); cells[c] = { k: c % 2 ? 'M' : 'D', d, strip: row * p + d }; } return cells; }
    const nd = level === 6 ? n - 2 : n - 1;
    let pDisk = n - 1, qDisk = -1;
    if (level === 5) pDisk = (n - 1) - (row % n);
    if (level === 6) { pDisk = ((n - 2 - row) % n + n) % n; qDisk = (pDisk + 1) % n; }
    let d = 0;
    for (let c = 0; c < n; c++) {
      if (c === pDisk) cells[c] = { k: 'P' };
      else if (c === qDisk) cells[c] = { k: 'Q' };
      else { cells[c] = { k: 'D', d, strip: row * nd + d }; d++; }
    }
    return cells;
  }

  /* One labelled rectangle (a strip) in an SVG grid. */
  function cellRect(s, x, y, w, hgt, cls, label, sub, extra = {}) {
    return s('g', extra,
      s('rect', { x, y, width: w, height: hgt, rx: 7, class: cls, 'stroke-width': 2 }),
      s('text', { x: x + w / 2, y: sub ? y + hgt / 2 - 2 : y + hgt / 2 + 5, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, label),
      sub ? s('text', { x: x + w / 2, y: y + hgt / 2 + 15, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub s-monot' }, sub) : null);
  }

  Guide.section({
    id: '11.6',
    title: 'RAID',
    short: 'RAID',
    summary: 'Many disks working as one: striping for speed, mirrors and parity to survive failures, levels 0 to 6.',
    objectives: [
      'Explain why arrays of disks raise both the data transfer capacity and the I/O request rate, and why they need redundancy.',
      'Map a logical strip to its disk and stripe, and describe striping (RAID 0) and mirroring (RAID 1).',
      'Compute XOR parity, regenerate a failed disk from it, and count the reads and writes of a small write.',
      'Explain how RAID 2 to 6 differ: parallel versus independent access, a dedicated versus distributed parity disk, single versus dual redundancy.',
      'Compare the levels by disks needed, usable capacity, failures survived and performance.',
    ],
    terms: [
      ['RAID (redundant array of independent disks)', 'A set of physical disk drives that the operating system sees as one logical drive. Data is spread across the drives and, at every level except RAID 0, extra redundant information lets the array survive a disk failure.'],
      ['Logical drive', 'The single drive the operating system sees and uses, even though a controller or driver really spreads its blocks over several physical drives.'],
      ['Strip', 'A fixed-size chunk of an array’s data stored on one disk: one or more blocks or sectors in most levels, as little as a byte or a word in RAID 2 and 3.'],
      ['Stripe', 'One row across the array: the strips that sit at the same position on every disk, including any parity strips in that row.'],
      ['Striping', 'Laying consecutive strips of data round-robin across the disks of an array, so that several disks can work on the data at the same time.'],
      ['Data transfer capacity', 'How many bytes per second an array can move for one large request. Striping raises it because several disks deliver parts of the same request at once.'],
      ['I/O request rate', 'How many separate I/O requests an array can complete per second. It rises when independent requests land on different disks that work at the same time.'],
      ['Mirroring', 'Keeping two identical copies of every strip on two different disks (RAID 1), so either copy can serve a read and one copy survives if a disk fails.'],
      ['Exclusive-OR (XOR)', 'A bit operation, written ⊕, that gives 1 when its two input bits differ and 0 when they are equal. XOR-ing the same value twice cancels it: A ⊕ B ⊕ B = A.'],
      ['Parity', 'A check value made by XOR-ing corresponding bits of the data strips. Together with all the other strips of its stripe it regenerates any one missing strip.'],
      ['Hamming code', 'An error-correcting code whose extra check bits can locate and fix a single wrong bit. RAID 2 keeps these check bits on extra disks.'],
      ['Parallel access array', 'An array (RAID 2 and RAID 3) in which every disk takes part in every request, with the spindles (the motors that spin the platters) synchronized so that all heads are at the same position.'],
      ['Independent access array', 'An array (RAID 4, 5 and 6) in which each disk can serve a different request at the same time, which suits workloads made of many small requests.'],
      ['Small-write penalty', 'The extra I/O a parity array needs when a write changes only one strip: read the old data and old parity, then write the new data and new parity (2 reads + 2 writes in RAID 4 and 5).'],
      ['Distributed parity', 'Putting the parity strips of different stripes on different disks in rotation (RAID 5), so that no single disk has to take part in every write.'],
      ['Dual redundancy', 'Storing two independent check values per stripe, P (ordinary XOR parity) and Q (a different calculation such as a Reed–Solomon code), on two different disks, as RAID 6 does, so any two disks can fail.'],
      ['Degraded mode', 'How an array runs after a disk fails: it still answers every request, but it must recompute the missing data from the surviving disks, so it is slower and has less protection left.'],
      ['Rebuild', 'Recreating every strip of a failed disk on a replacement disk by reading the surviving disks and recomputing the missing data.'],
    ],
    css: `
      .sec-11-6 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-11-6 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-6 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-6 .prow { display: grid; grid-template-columns: 96px repeat(8, 30px) minmax(0, 1fr); gap: 4px; align-items: center; padding: 2px 4px; border-radius: 8px; border: 2px solid transparent; }
      .sec-11-6 .prow.cur { border-color: var(--accent); background: var(--accent-bg); }
      .sec-11-6 .prow .lab { font-weight: 800; font-size: 15px; white-space: nowrap; }
      .sec-11-6 .prow .val { font-family: var(--mono); font-size: 14px; color: var(--ink-2); white-space: nowrap; padding-left: 6px; }
      .sec-11-6 .bit { width: 30px; height: 30px; border-radius: 7px; border: 1.5px solid var(--line-2); background: var(--panel); font-family: var(--mono); font-weight: 800; font-size: 15px; color: var(--ink-2); padding: 0; display: grid; place-items: center; }
      .sec-11-6 button.bit { cursor: pointer; }
      .sec-11-6 button.bit:disabled { cursor: default; }
      .sec-11-6 .bit.one { background: var(--io-bg); border-color: var(--io); color: var(--io); }
      .sec-11-6 .bit.par { border-style: dashed; }
      .sec-11-6 .bit.par.one { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
      .sec-11-6 .bit.lost { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
      .sec-11-6 .bit.acc { border-color: var(--accent); color: var(--accent); }
      .sec-11-6 .bit.acc.one { background: var(--accent-bg); }
      .sec-11-6 .prow.slim { grid-template-columns: 42px repeat(8, 25px) minmax(0, 1fr); gap: 3px; padding: 2px; }
      .sec-11-6 .prow.slim .bit { width: 25px; height: 26px; font-size: 14px; }
      .sec-11-6 .prow.slim .val { padding-left: 2px; font-size: 13px; }
      .sec-11-6 table.cmp th, .sec-11-6 table.cmp td { padding: 4px 7px; line-height: 1.3; }
      .sec-11-6 table.cmp td { font-size: 14px; }
      .sec-11-6 .chars { font: inherit; font-family: var(--mono); font-size: 18px; width: 110px; height: 36px; border-radius: 9px; border: 2px solid var(--line-2); padding: 0 10px; background: var(--panel); color: var(--ink); letter-spacing: .15em; }
    `,
    steps: [
      /* ---------------- 1. Big picture ---------------- */
      {
        title: 'One disk is too slow and too fragile',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">A single hard disk has two weaknesses: it is slow next to the processor, and some day it will fail.</p>
              <p class="m0">Processors have sped up thousands of times over the decades; a disk’s swinging arm and spinning platter only a few times. The fix is teamwork: keep several disks busy at once. One big request split over many disks finishes sooner (higher <span class="t">data transfer capacity</span>); many small requests on different disks run side by side (higher <span class="t">I/O request rate</span>).</p>
              <p class="m0">More disks also means more failures, so arrays add <b>redundant</b> information. That is <span class="t" data-t="RAID (redundant array of independent disks)">RAID</span>, a <b>redundant array of independent disks</b> (the 1988 paper that coined the name said <i>inexpensive</i>).</p>
              <div class="callout analogy m0" data-label="Analogy">One cook is slow. Four cooks can split one banquet or serve four tables at once, and a shared recipe binder means a sick cook does not take a dish off the menu.</div>
              <div class="row gap-s small"><span class="chip io">map strips to disks</span><span class="chip ok">rebuild a disk with XOR</span><span class="chip warn">count write costs</span><span class="chip bad">break an array</span></div>
            </div>
            <div class="card stack" style="gap:10px">
              <h4 class="m0">RAID in three ideas: click each one</h4>
              <div class="row gap-s idea-btns"></div>
              <div class="card white grow idea-pic" style="display:grid;place-items:center;padding:8px"></div>
              <div class="narr idea-text"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const ideas = [
            ['1. One logical drive', 'The OS sees one big disk, the <span class="t">logical drive</span>. A RAID controller (hardware) or a driver (software) turns each logical block number into a disk and a position on it. File systems and programs need no changes.'],
            ['2. Data striped across disks', 'Data is cut into <span class="t">strips</span> laid round-robin across the disks (<span class="t">striping</span>): strip 0 on disk 0, strip 1 on disk 1, and so on. A big request keeps every disk busy at once.'],
            ['3. Redundant information', 'Extra capacity holds a mirror copy or <span class="t">parity</span> computed from the data. If one disk dies, its contents are recomputed from the others. RAID 0 is the one level that skips this.'],
          ];
          let cur = 0;
          const btns = ideas.map((t, i) => h('button', { class: 'btn sm', type: 'button', onclick: () => show(i) }, t[0]));
          ctx.$('.idea-btns').append(...btns);
          const slim = ctx.narrow, W = slim ? 340 : 600, cx = W / 2;
          const svg = s('svg', { viewBox: `0 0 ${W} 262`, width: '100%', style: { maxHeight: '262px' } });
          ctx.$('.idea-pic').append(svg);
          function draw() {
            const hot = (i) => (cur === i ? { stroke: 'var(--accent)', 'stroke-width': 4 } : {});
            const k = [], bw = slim ? 300 : 300, dw = slim ? 60 : 96, gap = slim ? 7 : 20, x0 = (W - (5 * dw + 4 * gap)) / 2;
            k.push(s('rect', { x: cx - 130, y: 4, width: 260, height: 38, rx: 10, class: 's-os', 'stroke-width': 2 }));
            k.push(s('text', { x: cx, y: 28, 'text-anchor': 'middle', 'font-weight': 700 }, 'Operating system'));
            k.push(s('line', { x1: cx, y1: 42, x2: cx, y2: 58, class: 's-line', 'marker-end': 'url(#arr)' }));
            k.push(s('rect', Object.assign({ x: cx - bw / 2, y: 62, width: bw, height: 40, rx: 10, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '6 4' }, hot(0))));
            k.push(s('text', { x: cx, y: 88, 'text-anchor': 'middle', 'font-weight': 700 }, slim ? 'Logical drive D: (OS view)' : 'Logical drive D: (what the OS sees)'));
            k.push(s('line', { x1: cx, y1: 102, x2: cx, y2: 116, class: 's-line', 'marker-end': 'url(#arr)' }));
            k.push(s('rect', Object.assign({ x: cx - bw / 2, y: 120, width: bw, height: 34, rx: 10, class: 's-panel', 'stroke-width': 2 }, hot(0))));
            k.push(s('text', { x: cx, y: 142, 'text-anchor': 'middle', 'font-size': 15 }, 'RAID controller or driver'));
            for (let d = 0; d < 5; d++) {
              const x = x0 + d * (dw + gap), par = d === 4;
              k.push(s('line', { x1: cx, y1: 154, x2: x + dw / 2, y2: 172, class: 's-muted' }));
              k.push(s('rect', Object.assign({ x, y: 174, width: dw, height: 84, rx: 12, class: par ? 's-ok' : 's-io', 'stroke-width': 2 }, par ? hot(2) : hot(1))));
              k.push(s('text', { x: x + dw / 2, y: 192, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, par ? (slim ? 'Extra' : 'Redundant') : (slim ? 'D' : 'Disk ') + d));
              for (let r = 0; r < 3; r++) {
                const lab = par ? 'P' + r : String(r * 4 + d);
                k.push(s('rect', { x: x + 6, y: 199 + r * 19, width: dw - 12, height: 16, rx: 4, class: par ? 's-ok' : (cur === 1 && r === 1 ? 's-accent' : 's-panel'), 'stroke-width': 1 }));
                k.push(s('text', { x: x + dw / 2, y: 212 + r * 19, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot' }, par || slim ? lab : 'strip ' + lab));
              }
            }
            svg.replaceChildren(...k);
          }
          function show(i) {
            cur = i;
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            ctx.$('.idea-text').innerHTML = ideas[i][1];
            draw();
          }
          show(0);
        },
      },

      /* ---------------- 2. RAID 0 ---------------- */
      {
        title: 'RAID 0: cut the data into strips',
        kind: 'explore',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">RAID 0 is pure <span class="t">striping</span>, with no redundancy at all.</p>
              <p class="m0">The array’s space is cut into equal <span class="t">strips</span> (one or more blocks each). Strip 0 goes on disk 0, strip 1 on disk 1, and so on round-robin. One row of strips, one per disk, is a <span class="t">stripe</span>.</p>
              <div class="card tight io"><b>With n disks, logical strip k lives on<br>disk (k mod n), in stripe ⌊k / n⌋.</b><div class="small map-ex" style="margin-top:4px"></div></div>
              <div class="callout why m0" data-label="Two conditions for the speed-up"><b>Big requests:</b> the whole path from the disks to memory (controller, buses) must carry all n streams at once. <b>Small requests:</b> strips must be big enough that one request touches one disk, and requests must spread evenly over the disks.</div>
              <div class="callout warn m0" data-label="Common mistake">Level numbers are names, not a protection scale, and RAID 0 has <b>zero</b> redundancy. It is <b>less</b> reliable than one disk: any one failure loses data.</div>
            </div>
            <div class="card stack r0-panel" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const panel = ctx.$('.r0-panel');
          const SHOWN = 12;
          let n = 4, mode = 'find', pick = 7, failed = 1, seed = 3;
          const slim = ctx.narrow;
          const W = slim ? 360 : 620, LX = slim ? 34 : 80;
          const svg = s('svg', { width: '100%' });
          const narr = h('div', { class: 'narr' });
          const tools = h('div', { class: 'row gap-s' });
          const seg = ctx.ui.seg([{ value: 'find', label: 'Find a strip' }, { value: 'big', label: 'One big request' }, { value: 'small', label: 'Small requests' }, { value: 'fail', label: 'A disk fails' }], mode, (v) => { mode = v; draw(); });
          const sl = ctx.ui.slider({ label: 'Disks (n)', min: 2, max: 6, value: n, onInput: (v) => { n = v; failed = Math.min(failed, n - 1); draw(); } });
          panel.append(seg, sl, h('div', { class: 'grow', style: { display: 'grid', placeItems: 'center', minHeight: '0' } }, svg), narr, tools);
          function smallSet() {
            const rng = ctx.util.seeded(seed), all = ctx.util.range(SHOWN);
            for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
            return all.slice(0, 6).sort((a, b) => a - b);
          }
          function draw() {
            const R = Math.ceil(SHOWN / n), colW = (W - LX - 4) / n, cH = Math.min(50, 236 / R - 6), H = 28 + R * (cH + 6) + 22;
            svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            const req = mode === 'big' ? ctx.util.range(SHOWN) : mode === 'small' ? smallSet() : [];
            const load = new Array(n).fill(0); req.forEach((k) => load[k % n]++);
            const k = [];
            for (let c = 0; c < n; c++) {
              const x = LX + c * colW + 3, bad = mode === 'fail' && c === failed;
              k.push(s('text', { x: x + (colW - 6) / 2, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: bad ? 'fill:var(--bad)' : '' }, (slim ? 'D' : 'Disk ') + c + (bad ? ' ✗' : '')));
              if (mode === 'big' || mode === 'small') k.push(s('text', { x: x + (colW - 6) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, load[c] + (slim ? 'u' : ' unit' + (load[c] === 1 ? '' : 's'))));
            }
            for (let r = 0; r < R; r++) {
              const y = 28 + r * (cH + 6);
              k.push(s('text', { x: 2, y: y + cH / 2 + 5, 'font-size': 13, class: 's-sub' }, (slim ? 'S' : 'stripe ') + r));
              for (let c = 0; c < n; c++) {
                const strip = r * n + c, x = LX + c * colW + 3;
                if (strip >= SHOWN) { k.push(s('rect', { x, y, width: colW - 6, height: cH, rx: 7, class: 's-muted', 'stroke-dasharray': '4 4' })); continue; }
                let cls = 's-panel';
                if (mode === 'find' && strip === pick) cls = 's-accent';
                if (req.includes(strip)) cls = 's-io';
                if (mode === 'fail' && c === failed) cls = 's-bad';
                const g = cellRect(s, x, y, colW - 6, cH, cls, (slim ? '' : 'strip ') + strip, null, mode === 'find' ? { role: 'button', tabindex: 0, style: 'cursor:pointer', 'aria-label': 'Strip ' + strip } : {});
                if (mode === 'find') {
                  g.addEventListener('click', () => { pick = strip; draw(); });
                  g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick = strip; draw(); } });
                }
                k.push(g);
              }
            }
            svg.replaceChildren(...k);
            const ex = ctx.$('.map-ex');
            const p = Math.min(pick, SHOWN - 1);
            ex.innerHTML = `Example: strip ${p} with n = ${n} → disk ${p} mod ${n} = <b>${p % n}</b>, stripe ⌊${p}/${n}⌋ = <b>${Math.floor(p / n)}</b>.`;
            tools.replaceChildren();
            const busiest = Math.max(...load);
            if (mode === 'find') {
              narr.className = 'narr';
              narr.innerHTML = `Click any strip. Strip <b>${p}</b> sits on <b>disk ${p % n}</b> in <b>stripe ${Math.floor(p / n)}</b>. Change n and watch every strip move: the controller recomputes the address with one division.`;
            } else if (mode === 'big') {
              narr.className = 'narr ok';
              narr.innerHTML = `One request for strips 0–${SHOWN - 1}, one time unit per strip. Each disk reads ${busiest === Math.min(...load) ? 'its own ' : 'at most '}${busiest} strip${busiest === 1 ? '' : 's'} while the others do the same, so the request takes <b>${busiest} units</b> instead of ${SHOWN} on one disk (<b>${ctx.util.fmt(SHOWN / busiest, 1)}× faster</b>).`;
            } else if (mode === 'small') {
              narr.className = 'narr ok';
              narr.innerHTML = `Six separate one-strip requests: ${req.join(', ')}. Requests on different disks run at the same time; the busiest disk has <b>${busiest}</b>, so all six finish in <b>${busiest} unit${busiest === 1 ? '' : 's'}</b> instead of 6. Uneven spreads cost time: try another set.`;
              tools.append(h('button', { class: 'btn sm', type: 'button', onclick: () => { seed += 1; draw(); } }, 'Try another set of requests'));
            } else {
              const lost = ctx.util.range(SHOWN).filter((x) => x % n === failed);
              narr.className = 'narr bad';
              narr.innerHTML = `Disk ${failed} died. Strips ${lost.join(', ')} are gone and nothing can recompute them, so a file spread over strips 0–${SHOWN - 1} now has a hole every ${n} strips. With ${n} disks, a failure is roughly ${n}× as likely as with one disk.`;
              tools.append(h('span', { class: 'small b' }, 'Fail disk:'), ...ctx.util.range(n).map((c) => h('button', { class: 'btn sm' + (c === failed ? ' on' : ''), type: 'button', onclick: () => { failed = c; draw(); } }, String(c))));
            }
          }
          draw();
        },
      },

      /* ---------------- 3. RAID 1 ---------------- */
      {
        title: 'RAID 1: keep a mirror copy of every strip',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0">RAID 1 is <span class="t">mirroring</span>: every strip is stored twice, on two different disks.</p>
              <div class="card tight"><b>Reads:</b> either copy will do. The controller picks the disk that can reach the data sooner (shorter seek plus rotational wait), and two reads can run at once, one on each copy.</div>
              <div class="card tight"><b>Writes:</b> both copies must change. The two writes run in parallel, but the write is finished only when the <b>slower</b> disk is done.</div>
              <div class="card tight"><b>Failure:</b> the twin still holds everything. Recovery is simply copying the survivor onto a new disk; no arithmetic is needed.</div>
              <div class="card tight"><b>Cost:</b> 2N disks for N disks of data, so only half the raw space is usable. Worth it for system software and highly critical files.</div>
            </div>
            <div class="card stack r1-panel" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const panel = ctx.$('.r1-panel');
          const REQ = [['R', 30], ['R', 170], ['R', 40], ['W', 120], ['R', 185], ['R', 25], ['W', 90], ['R', 160]];
          let failedB = false;
          const slim = ctx.narrow, W = slim ? 360 : 620, X0 = slim ? 18 : 40, X1 = W - 18;
          const tx = (t) => X0 + (t / 199) * (X1 - X0);
          /* run the whole request list once; frames[i] is the state after i requests */
          function simulate() {
            let a = 100, b = 100, one = 100, tMirror = 0, tOne = 0;
            const frames = [{ a, b, one, tMirror, tOne, cap: `Start: both heads at track 100. ${failedB ? 'Disk B has <b>failed</b>, so disk A must do all the work.' : 'Press Next to send the first request.'}` }];
            REQ.forEach(([op, t], i) => {
              const dA = Math.abs(a - t), dB = Math.abs(b - t), dOne = Math.abs(one - t);
              let cap, cost, who;
              if (failedB) { cost = dA; a = t; who = 'A'; cap = `${op === 'R' ? 'Read' : 'Write'} track ${t}: disk B is dead, so disk A ${op === 'R' ? 'serves the read' : 'takes the write alone'} (moves ${dA}). Nothing is lost, but the speed advantage is gone.`; }
              else if (op === 'R') {
                who = dA <= dB ? 'A' : 'B'; cost = Math.min(dA, dB);
                if (who === 'A') a = t; else b = t;
                cap = dA === dB ? `Read track ${t}: both heads are ${dA} tracks away, so either copy will do; the controller uses <b>disk A</b>.` : `Read track ${t}: disk A is ${dA} tracks away, disk B ${dB}. The controller sends it to <b>disk ${who}</b>, which moves only ${cost}.`;
              } else {
                who = 'AB'; cost = Math.max(dA, dB); a = t; b = t;
                cap = `Write track ${t}: <b>both</b> copies must change. A moves ${dA} and B moves ${dB} at the same time, so the write takes as long as the slower one: <b>${cost}</b>.`;
              }
              one = t; tMirror += cost; tOne += dOne;
              frames.push({ a, b, one, tMirror, tOne, t, op, who, i, cap });
            });
            return frames;
          }
          let frames = simulate();
          const svg = s('svg', { viewBox: `0 0 ${W} 190`, width: '100%' });
          const totals = h('div', { class: 'stack', style: { gap: '4px' } });
          function bar(label, val, max, cls) {
            return h('div', { class: 'row nw small', style: { gap: '8px' } }, h('span', { style: { width: slim ? '96px' : '150px', flex: 'none' } }, label),
              h('div', { class: 'meter grow' }, h('i', { style: { width: (max ? (100 * val) / max : 0) + '%', background: `var(--${cls})` } })), h('b', { class: 'num', style: { width: '46px', textAlign: 'right' } }, String(val)));
          }
          function draw(i) {
            const f = frames[i], k = [];
            [['Disk A', 55, f.a, false], ['Disk B (mirror)', 135, f.b, failedB]].forEach(([lab, y, pos, dead]) => {
              k.push(s('text', { x: X0, y: y - 26, 'font-weight': 800, 'font-size': 14, style: dead ? 'fill:var(--bad)' : '' }, lab + (dead ? ' ✗ failed' : '')));
              k.push(s('line', { x1: X0, y1: y, x2: X1, y2: y, class: dead ? 's-muted' : 's-line' }));
              [0, 50, 100, 150, 199].forEach((t) => k.push(s('text', { x: tx(t), y: y + 20, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t))));
              if (!dead) k.push(s('path', { d: `M${tx(pos)} ${y - 4} l-8 -14 h16 z`, class: 's-io', 'stroke-width': 2 }));
            });
            if (f.t != null) {
              k.push(s('line', { x1: tx(f.t), y1: 34, x2: tx(f.t), y2: 160, class: 's-muted', 'stroke-dasharray': '5 4', style: 'stroke:var(--accent)' }));
              k.push(s('text', { x: Math.min(Math.max(tx(f.t), X0 + 30), X1 - 30), y: 182, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--accent)' }, (f.op === 'R' ? 'read ' : 'write ') + f.t));
            }
            svg.replaceChildren(...k);
            const max = Math.max(frames[frames.length - 1].tOne, frames[frames.length - 1].tMirror);
            totals.replaceChildren(
              bar(failedB ? 'Pair, B failed' : 'Mirrored pair', f.tMirror, max, failedB ? 'warn' : 'ok'),
              bar('One disk alone', f.tOne, max, 'io'),
              h('div', { class: 'xs muted' }, 'Running total of tracks moved on the critical path (the time requests wait). To keep the arithmetic simple, rotation is ignored; both heads start at track 100.'));
            return f.cap;
          }
          const seg = ctx.ui.seg([{ value: 0, label: 'Both disks working' }, { value: 1, label: 'Disk B has failed' }], 0, (v) => { failedB = !!v; frames = simulate(); player.go(0); });
          const player = ctx.ui.player({ count: REQ.length + 1, render: draw, interval: 2200 });
          panel.append(seg, h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg), totals, player.el);
        },
      },

      /* ---------------- 4. RAID 2 and RAID 3 ---------------- */
      {
        title: 'RAID 2 and 3: every disk works on every request',
        kind: 'learn',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:8px">
              <p class="m0"><b>RAID 2 and 3</b> are <span class="t" data-t="Parallel access array">parallel access arrays</span>: the spindles (the motors that spin the platters) turn in lock-step, so every head is over the same spot at the same moment, and strips are tiny (a byte or a word), so every request uses every disk.</p>
              <div class="card tight"><b>RAID 2</b> stores a <span class="t">Hamming code</span>, computed across corresponding bits, on extra check disks whose number grows with the <i>logarithm</i> of the number of data disks. It fixes single-bit errors on the fly, which helps only where disks make many errors. Modern drives correct bit errors internally, so RAID 2 is essentially unused.</div>
              <div class="card tight ok"><b>RAID 3</b> needs <b>one parity disk</b>, however large the array. That is enough because a dead disk announces itself: the controller knows <i>which</i> disk is missing, so parity only has to supply the value, never find it.</div>
              <div class="callout why m0" data-label="The trade-off">Every disk delivers part of every transfer: superb for large reads and writes. But the array serves one request at a time, so many small requests queue up.</div>
            </div>
            <div class="card stack r23-panel" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow, W = slim ? 360 : 500;
          const tabs = ctx.ui.tabs([
            { label: 'How many check disks?', render: (p) => {
              const svg = s('svg', { viewBox: `0 0 ${W} 170`, width: '100%' });
              const narr = h('div', { class: 'narr' });
              let N = 4;
              const sl = ctx.ui.slider({ label: 'Data disks (N)', min: 1, max: 32, value: N, onInput: (v) => { N = v; draw(); } });
              function rowOf(y, label, m) {
                const k = [], tot = N + m, LX = slim ? 0 : 120, avail = W - LX - 6, w = Math.min(26, avail / tot - 3);
                k.push(s('text', { x: slim ? 0 : 0, y: slim ? y - 6 : y + 26, 'font-weight': 800, 'font-size': 14 }, label));
                const yy = slim ? y : y;
                for (let i = 0; i < tot; i++) k.push(s('rect', { x: LX + i * (w + 3), y: yy + (slim ? 4 : 6), width: w, height: 34, rx: 4, class: i < N ? 's-io' : 's-ok', 'stroke-width': 1.5 }));
                k.push(s('text', { x: LX, y: yy + (slim ? 58 : 60), 'font-size': 13, class: 's-sub' }, `${N} data + ${m} check = ${tot} disks · ${Math.round((100 * N) / tot)}% usable`));
                return k;
              }
              function draw() {
                const m = hammingChecks(N);
                svg.replaceChildren(...rowOf(slim ? 20 : 8, 'RAID 2', m), ...rowOf(slim ? 100 : 92, 'RAID 3', 1));
                narr.innerHTML = `With ${N} data disk${N === 1 ? '' : 's'}, RAID 2 needs the smallest m with 2<sup>m</sup> ≥ N + m + 1 = <b>${m} check disks</b>: the m check bits must be able to name any one of the ${N + m} disks as the bad one, or say “no error”. RAID 3 always needs <b>1</b>. Doubling N adds only about one check disk.`;
              }
              p.append(h('div', { class: 'stack', style: { gap: '10px' } }, sl, h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), narr));
              draw();
            } },
            { label: 'One request at a time', render: (p) => {
              const svg = s('svg', { viewBox: `0 0 ${W} 278`, width: '100%' });
              const narr = h('div', { class: 'narr' });
              let K = 4;
              const POS = 2, DISKS = 4, MAXT = 16;
              const sl = ctx.ui.slider({ label: 'Small reads waiting', min: 1, max: 8, value: K, onInput: (v) => { K = v; draw(); } });
              function gantt(y0, title, blocks) {
                const LX = slim ? 30 : 56, uw = (W - LX - 6) / MAXT, rh = 24, k = [];
                k.push(s('text', { x: 0, y: y0 - 6, 'font-weight': 800, 'font-size': 14 }, title));
                for (let d = 0; d < DISKS; d++) {
                  k.push(s('text', { x: 0, y: y0 + d * (rh + 3) + 17, 'font-size': 13, class: 's-sub' }, (slim ? 'D' : 'disk ') + d));
                  k.push(s('rect', { x: LX, y: y0 + d * (rh + 3), width: uw * MAXT, height: rh, class: 's-panel', 'stroke-width': 1 }));
                }
                blocks.forEach(([r, d0, d1, t0]) => {
                  const y = y0 + d0 * (rh + 3), hh = (d1 - d0 + 1) * (rh + 3) - 3;
                  k.push(s('rect', { x: LX + t0 * uw + 1, y, width: POS * uw - 2, height: hh, rx: 4, class: 's-io', 'stroke-width': 1.5 }));
                  k.push(s('text', { x: LX + (t0 + POS / 2) * uw, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, 'R' + (r + 1)));
                });
                return k;
              }
              function draw() {
                const par = ctx.util.range(K).map((r) => [r, 0, DISKS - 1, r * POS]);
                const ind = ctx.util.range(K).map((r) => [r, r % DISKS, r % DISKS, Math.floor(r / DISKS) * POS]);
                const tPar = K * POS, tInd = Math.ceil(K / DISKS) * POS;
                svg.replaceChildren(...gantt(22, `Parallel access (RAID 3): ${tPar} time units`, par), ...gantt(166, `Independent access (RAID 4 and 5): ${tInd} time units`, ind));
                narr.innerHTML = `Each small read needs about ${POS} time units to position the heads; its tiny transfer is negligible. RAID 3 must move <b>all</b> heads for every read, so ${K} reads take ${tPar} units. With large strips, each read touches one disk, so up to ${DISKS} run at once: <b>${tInd} units</b>.`;
              }
              p.append(h('div', { class: 'stack', style: { gap: '8px' } }, sl, h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg), narr));
              draw();
            } },
          ]);
          ctx.$('.r23-panel').append(tabs);
        },
      },

      /* ---------------- 5. Parity lab ---------------- */
      {
        title: 'Parity lab: rebuild a lost disk with XOR',
        kind: 'lab',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Parity, the trick behind RAID 3 to 6, is nothing more than <span class="t" data-t="Exclusive-OR (XOR)">XOR</span>.</p>
              <div class="row nw" style="gap:14px;align-items:flex-start">
                <table class="tbl compact" style="width:auto;flex:none"><tr><th>a</th><th>b</th><th>a ⊕ b</th></tr><tr><td>0</td><td>0</td><td>0</td></tr><tr><td>0</td><td>1</td><td>1</td></tr><tr><td>1</td><td>0</td><td>1</td></tr><tr><td>1</td><td>1</td><td>0</td></tr></table>
                <p class="small m0">XOR gives 1 when the bits differ. Over many bits it gives 1 when the count of 1s is <b>odd</b>, so each <span class="t">parity</span> bit makes its column’s total count of 1s even.</p>
              </div>
              <div class="card tight io"><b>P = X3 ⊕ X2 ⊕ X1 ⊕ X0</b>, bit by bit.<br>Because any value XOR-ed with itself is 0, XOR-ing P with the survivors cancels them and leaves the lost one:<br><b>X1 = P ⊕ X3 ⊕ X2 ⊕ X0</b></div>
              <div class="callout warn m0" data-label="Common mistake">Parity cannot tell you <i>which</i> disk is wrong, and it can rebuild only <b>one</b> missing strip per stripe. RAID works because a failed disk is known.</div>
            </div>
            <div class="card stack pl-panel" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const panel = ctx.$('.pl-panel');
          const slim = ctx.narrow;
          let data = [...'DISK'].map((c) => c.charCodeAt(0));
          let failed = -1;
          const show = (v) => (v >= 32 && v <= 126 ? `'${String.fromCharCode(v)}'` : '·');
          const parity = () => data.reduce((a, b) => a ^ b, 0);
          const input = h('input', { class: 'chars', type: 'text', maxlength: 4, value: 'DISK', 'aria-label': 'Four characters, one per data disk', spellcheck: 'false' });
          input.addEventListener('input', () => {
            const t = (input.value + '    ').slice(0, 4);
            data = [...t].map((c) => { const v = c.charCodeAt(0); return v >= 32 && v <= 126 ? v : 63; });
            drawGrid();
          });
          const grid = h('div', { class: 'stack', style: { gap: '3px' } });
          const rebuild = h('div', { class: 'stack', style: { gap: '6px' } });
          const failSeg = ctx.ui.seg([{ value: -1, label: 'none' }, ...[0, 1, 2, 3].map((i) => ({ value: i, label: 'X' + i })), { value: 4, label: 'P' }], -1, (v) => { failed = v; input.disabled = v >= 0; drawGrid(); drawRebuild(); });
          panel.append(
            h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b' }, 'Type 4 characters (one per data disk):'), input),
            grid,
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Fail a disk:'), failSeg),
            rebuild);
          function row(label, v, opts = {}) {
            const r = h('div', { class: 'prow' + (slim ? ' slim' : '') + (opts.cur ? ' cur' : '') });
            r.append(h('span', { class: 'lab', html: label }));
            for (let b = 7; b >= 0; b--) {
              const one = !opts.lost && ((v >> b) & 1) === 1;
              const cls = 'bit' + (opts.par ? ' par' : '') + (opts.acc ? ' acc' : '') + (opts.lost ? ' lost' : '') + (one ? ' one' : '');
              const txt = opts.lost ? '?' : one ? '1' : '0';
              if (opts.edit != null) {
                r.append(h('button', { class: cls, type: 'button', disabled: failed >= 0, 'aria-label': `${label} bit ${b}`, onclick: () => { data[opts.edit] ^= 1 << b; input.value = data.map((x) => (x >= 32 && x <= 126 ? String.fromCharCode(x) : '·')).join(''); drawGrid(); } }, txt));
              } else r.append(h('span', { class: cls }, txt));
            }
            r.append(h('span', { class: 'val', html: opts.lost ? '<b style="color:var(--bad)">lost ✗</b>' : (slim ? hex(v) : '0x' + hex(v) + ' ' + show(v)) }));
            return r;
          }
          let curRow = -1, curPlayer = null;
          function drawGrid() {
            const P = parity();
            grid.replaceChildren(...data.map((v, i) => row((slim ? 'X' : 'Disk X') + i, v, { edit: i, lost: failed === i, cur: curRow === i })),
              row(slim ? 'P' : 'Parity P', P, { par: true, lost: failed === 4, cur: curRow === 4 }));
          }
          function drawRebuild() {
            if (curPlayer) curPlayer.stop();
            curPlayer = null;
            rebuild.replaceChildren();
            curRow = -1;
            if (failed < 0) {
              rebuild.append(h('div', { class: 'narr' }, 'Click bits or type characters and watch the parity row follow. Then fail a disk and rebuild it, one XOR at a time.'));
              drawGrid();
              return;
            }
            const all = [...data, parity()], names = ['X0', 'X1', 'X2', 'X3', 'P'];
            const surv = [0, 1, 2, 3, 4].filter((i) => i !== failed);
            const accRow = h('div');
            const player = ctx.ui.player({ count: surv.length, interval: 1700, speed: false, render: (f) => {
              let acc = 0; surv.slice(0, f + 1).forEach((i) => { acc ^= all[i]; });
              curRow = surv[f]; drawGrid();
              accRow.replaceChildren(row(slim ? 'acc' : 'Running XOR', acc, { acc: true }));
              const expr = surv.slice(0, f + 1).map((i) => names[i]).join(' ⊕ ');
              if (f === 0) return `Start the running result with a survivor: <b>${names[surv[0]]}</b> = ${bits(acc)}.`;
              if (f < surv.length - 1) return `XOR in <b>${names[surv[f]]}</b>: ${expr} = ${bits(acc)}. Bits where ${names[surv[f]]} has a 1 flip.`;
              const ok = acc === all[failed];
              return `XOR in <b>${names[surv[f]]}</b>: ${expr} = <b>${bits(acc)}</b> = 0x${hex(acc)}${failed < 4 ? ' ' + show(acc) : ''}. That is exactly what ${names[failed]} held ${ok ? '✓' : '✗'}. Write it to a replacement disk and the array is whole again.`;
            } });
            curPlayer = player;
            rebuild.append(accRow, player.el);
          }
          drawGrid();
          drawRebuild();
        },
      },

      /* ---------------- 6. RAID 4 vs RAID 5 small writes ---------------- */
      {
        title: 'RAID 4 vs RAID 5: the cost of a small write',
        kind: 'lab',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0">RAID 4 and 5 are <span class="t" data-t="Independent access array">independent access arrays</span>: strips are large, so a small request touches one disk and other disks stay free for other requests. Writes are the catch. Changing one strip takes:</p>
              <ol class="m0" style="padding-left:22px">
                <li>read the old data strip X<sub>old</sub></li>
                <li>read the old parity strip P</li>
                <li>compute <b>P′ = P ⊕ X<sub>old</sub> ⊕ X<sub>new</sub></b> (cancel the old value, add the new)</li>
                <li>write X<sub>new</sub> and P′</li>
              </ol>
              <p class="m0">That is <b>2 reads + 2 writes</b> for one logical write: the <span class="t">small-write penalty</span>. A write that fills a whole stripe needs no reads; its parity comes from the new data alone.</p>
              <div class="callout why m0" data-label="Why RAID 5 exists">RAID 4 keeps every parity strip on one disk, so <b>every</b> write needs that disk and it becomes the bottleneck. RAID 5 rotates parity round-robin over all disks (<span class="t">distributed parity</span>), so writes to different stripes can use different disks.</div>
            </div>
            <div class="card stack sw-panel" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const panel = ctx.$('.sw-panel');
          const slim = ctx.narrow, N = 5, ROWS = 5, ND = N - 1;
          let rng, vals, par, cnt, writes, last;
          function reset() {
            rng = ctx.util.seeded(11);
            vals = ctx.util.range(ROWS * ND).map(() => Math.floor(rng() * 256));
            par = ctx.util.range(ROWS).map((r) => vals.slice(r * ND, r * ND + ND).reduce((a, b) => a ^ b, 0));
            cnt = { 4: new Array(N).fill(0), 5: new Array(N).fill(0) };
            writes = 0; last = null;
          }
          const where = (level, strip) => { const r = Math.floor(strip / ND), row = stripeRow(level, N, r); return { r, d: row.findIndex((c) => c.k === 'D' && c.strip === strip), p: row.findIndex((c) => c.k === 'P') }; };
          function doWrite() {
            const strip = Math.floor(rng() * ROWS * ND), nv = Math.floor(rng() * 256);
            const r = Math.floor(strip / ND), old = vals[strip], oldP = par[r];
            const newP = oldP ^ old ^ nv;
            vals[strip] = nv; par[r] = newP;
            const check = vals.slice(r * ND, r * ND + ND).reduce((a, b) => a ^ b, 0);
            [4, 5].forEach((lv) => { const w = where(lv, strip); cnt[lv][w.d] += 2; cnt[lv][w.p] += 2; });
            writes++;
            last = { strip, r, old, nv, oldP, newP, check };
          }
          const W = slim ? 340 : 300, H = 296;
          const svgs = { 4: s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' }), 5: s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' }) };
          const narr = h('div', { class: 'narr' });
          function drawArray(level) {
            const k = [], cw = (W - 4) / N, ch = 28, y0 = 46;
            const lw = last ? where(level, last.strip) : null;
            k.push(s('text', { x: 2, y: 16, 'font-weight': 800, 'font-size': 15 }, level === 4 ? 'RAID 4: one parity disk' : 'RAID 5: rotating parity'));
            for (let c = 0; c < N; c++) {
              const touched = lw && (c === lw.d || c === lw.p);
              k.push(s('text', { x: 2 + c * cw + cw / 2, y: 38, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: touched ? 'fill:var(--accent)' : '' }, 'disk ' + c));
            }
            for (let r = 0; r < ROWS; r++) {
              const row = stripeRow(level, N, r);
              row.forEach((cell, c) => {
                let cls = cell.k === 'P' ? 's-ok' : 's-panel';
                if (lw && last.r === r && c === lw.d) cls = 's-accent';
                if (lw && last.r === r && c === lw.p) cls = 's-warn';
                k.push(cellRect(s, 2 + c * cw + 2, y0 + r * (ch + 4), cw - 4, ch, cls, cell.k === 'P' ? 'P' + r : 'D' + cell.strip));
              });
            }
            const base = H - 4, maxC = Math.max(8, ...cnt[4], ...cnt[5]), busiest = Math.max(...cnt[level]);
            k.push(s('text', { x: 2, y: 222, 'font-size': 13, class: 's-sub' }, 'I/O operations per disk'));
            for (let c = 0; c < N; c++) {
              const v = cnt[level][c], bh = (v / maxC) * 50;
              const hot = v > 0 && v === busiest && level === 4;
              k.push(s('rect', { x: 2 + c * cw + cw / 2 - 12, y: base - bh, width: 24, height: Math.max(bh, 1), rx: 3, class: hot ? 's-bad' : 's-io', 'stroke-width': 1.5 }));
              k.push(s('text', { x: 2 + c * cw + cw / 2, y: base - bh - 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, String(v)));
            }
            svgs[level].replaceChildren(...k);
          }
          function draw() {
            drawArray(4); drawArray(5);
            if (!last) { narr.className = 'narr'; narr.innerHTML = 'Both arrays hold the same 20 data strips. Press <b>Write 1 strip</b>: the same small write goes to both, and the bars count I/O operations (reads + writes) per disk.'; return; }
            const w4 = where(4, last.strip), w5 = where(5, last.strip), tot = 4 * writes;
            const busy5 = Math.max(...cnt[5]);
            narr.className = 'narr';
            narr.innerHTML = `Write #${writes}: D${last.strip} 0x${hex(last.old)} → 0x${hex(last.nv)}. P′ = 0x${hex(last.oldP)} ⊕ 0x${hex(last.old)} ⊕ 0x${hex(last.nv)} = <b>0x${hex(last.newP)}</b> (full recompute: 0x${hex(last.check)} ${last.check === last.newP ? '✓' : '✗'}). RAID 4 used disks ${w4.d} and ${w4.p}; RAID 5 used disks ${w5.d} and ${w5.p}.<br>Of ${tot} I/Os per array, RAID 4’s parity disk did <b>${cnt[4][N - 1]}</b> (${Math.round((100 * cnt[4][N - 1]) / tot)}%); RAID 5’s busiest disk did <b>${busy5}</b> (${Math.round((100 * busy5) / tot)}%).`;
          }
          reset();
          panel.append(
            h('div', { class: 'row gap-s' },
              h('button', { class: 'btn sm primary', type: 'button', onclick: () => { doWrite(); draw(); } }, 'Write 1 strip'),
              h('button', { class: 'btn sm', type: 'button', onclick: () => { for (let i = 0; i < 10; i++) doWrite(); draw(); } }, 'Write 10 strips'),
              h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); draw(); } }, 'Reset')),
            h('div', { class: 'grid-2', style: { gap: '10px' } }, h('div', { class: 'card white', style: { padding: '6px' } }, svgs[4]), h('div', { class: 'card white', style: { padding: '6px' } }, svgs[5])),
            narr);
          draw();
        },
      },

      /* ---------------- 7. RAID 6 and the failure simulator ---------------- */
      {
        title: 'RAID 6, and what each level survives',
        kind: 'lab',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0">RAID 5 survives one failed disk. RAID 6 survives <b>any two</b>.</p>
              <p class="m0">It uses <span class="t">dual redundancy</span>: every stripe holds two different check strips on two different disks. <b>P</b> is the usual XOR parity. <b>Q</b> uses different arithmetic (commonly a Reed–Solomon code), so it gives an independent second equation. Two lost strips = two unknowns, and two independent equations solve them.</p>
              <div class="card tight warn"><b>Cost:</b> N disks of data need <b>N + 2</b> disks, and a small write must update the data, P and Q: <b>3 reads + 3 writes</b>, a heavier penalty than RAID 5.</div>
              <div class="callout why m0" data-label="Why pay for a second check?">Rebuilding a large disk can take many hours, and the array runs in <span class="t">degraded mode</span> all that time. A second failure during that <span class="t">rebuild</span> loses RAID 5 data, and one unreadable sector on a survivor loses that stripe. RAID 6 recovers from both.</div>
            </div>
            <div class="card stack fs-panel" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const panel = ctx.$('.fs-panel');
          const slim = ctx.narrow, W = slim ? 360 : 620, LX = slim ? 24 : 70, ROWS = 4;
          const rng = ctx.util.seeded(5), BYTES = ctx.util.range(64).map(() => Math.floor(rng() * 256));
          let level = 6, n = 6, failed = new Set();
          const names = { 0: 'RAID 0', 1: 'RAID 1', 4: 'RAID 3 / 4', 5: 'RAID 5', 6: 'RAID 6' };
          const svg = s('svg', { width: '100%' });
          const narr = h('div', { class: 'narr' });
          const failRow = h('div', { class: 'row gap-s' });
          const segL = ctx.ui.seg([0, 1, 4, 5, 6].map((v) => ({ value: v, label: names[v] })), level, (v) => { level = v; draw(); });
          const segN = ctx.ui.seg([4, 6, 8].map((v) => ({ value: v, label: v + (slim ? '' : ' disks') })), n, (v) => { n = v; failed = new Set([...failed].filter((d) => d < n)); draw(); });
          panel.append(h('div', { class: 'row gap-s' }, segL, segN), failRow, h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), narr);
          /* evaluate one stripe: returns per-cell { v, state: 'ok' | 'rebuilt' | 'lost' } */
          function stripe(r) {
            const row = stripeRow(level, n, r);
            const dataCells = row.filter((c) => c.k === 'D');
            const truth = dataCells.map((c) => BYTES[c.strip % 64]);
            const { P, Q } = computePQ(truth);
            const out = row.map(() => null);
            if (level === 1) {
              row.forEach((c, i) => {
                const v = BYTES[c.strip % 64], twin = i % 2 ? i - 1 : i + 1;
                out[i] = { v, state: !failed.has(i) ? 'ok' : failed.has(twin) ? 'lost' : 'rebuilt' };
              });
              return out;
            }
            const known = dataCells.map((c, j) => (failed.has(row.indexOf(c)) ? null : truth[j]));
            const pi = row.findIndex((c) => c.k === 'P'), qi = row.findIndex((c) => c.k === 'Q');
            const pK = pi >= 0 && !failed.has(pi) ? P : null, qK = qi >= 0 && !failed.has(qi) ? Q : null;
            const rec = recoverStripe(known, pK, level === 6 ? qK : null);
            const ok = rec && rec.every((v, j) => v === truth[j]);
            row.forEach((c, i) => {
              const dead = failed.has(i);
              if (c.k === 'D') { const j = dataCells.indexOf(c); out[i] = { v: dead ? (ok ? rec[j] : null) : truth[j], state: !dead ? 'ok' : ok ? 'rebuilt' : 'lost' }; }
              else { const v = c.k === 'P' ? P : Q; out[i] = { v: dead && !ok ? null : v, state: !dead ? 'ok' : ok ? 'rebuilt' : 'lost' }; }
            });
            return out;
          }
          function draw() {
            failRow.replaceChildren(h('span', { class: 'small b' }, 'Fail disk:'),
              ...ctx.util.range(n).map((d) => h('button', { class: 'btn sm' + (failed.has(d) ? ' on' : ''), type: 'button', 'aria-pressed': failed.has(d) ? 'true' : 'false', 'aria-label': 'Fail or repair disk ' + d, onclick: () => {
                if (failed.has(d)) failed.delete(d); else if (failed.size >= 3) { ctx.toast('This lab stops at three failed disks.'); return; } else failed.add(d);
                draw();
              } }, (failed.has(d) ? '✗ ' : '') + d)),
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { failed = new Set(); draw(); } }, 'Repair all'));
            const cw = (W - LX - 2) / n, ch = 42, H = 30 + ROWS * (ch + 6);
            svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            const k = [];
            for (let c = 0; c < n; c++) k.push(s('text', { x: LX + c * cw + cw / 2, y: 18, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: failed.has(c) ? 'fill:var(--bad)' : '' }, (slim ? '' : 'disk ') + c + (failed.has(c) ? ' ✗' : '')));
            let total = 0, rebuilt = 0, lost = 0;
            for (let r = 0; r < ROWS; r++) {
              const y = 28 + r * (ch + 6), row = stripeRow(level, n, r), res = stripe(r);
              k.push(s('text', { x: 0, y: y + ch / 2 + 5, 'font-size': 13, class: 's-sub' }, (slim ? 'S' : 'stripe ') + r));
              row.forEach((c, i) => {
                const st = res[i], isData = c.k === 'D';
                if (isData) { const twin = level === 1 ? res[i + 1].state : 'ok', any = (x) => st.state === x || twin === x; total++; if (any('lost')) lost++; else if (any('rebuilt')) rebuilt++; }
                const cls = st.state === 'lost' ? 's-bad' : st.state === 'rebuilt' ? 's-accent' : c.k === 'D' ? 's-panel' : c.k === 'M' ? 's-io' : 's-ok';
                const label = c.k === 'D' || c.k === 'M' ? 'D' + c.strip : c.k + r;
                const sub = st.state === 'lost' ? 'lost' : (st.state === 'rebuilt' ? '↻' : '') + hex(st.v);
                k.push(cellRect(s, LX + i * cw + 2, y, cw - 4, ch, cls, label, sub));
              });
            }
            svg.replaceChildren(...k);
            const how = { 0: '', 1: 'had one copy on a failed disk; they are served from the surviving copy', 4: 'sat on a failed disk; every read recomputes them by XOR-ing parity with the surviving data', 5: 'sat on a failed disk; every read recomputes them by XOR-ing parity with the surviving data', 6: 'sat on a failed disk; every read recomputes them from whichever of P and Q survived' }[level];
            const why = { 0: 'RAID 0 keeps no redundant information, so whatever was on a failed disk is gone.', 1: 'Both copies of a mirrored pair died, so that pair’s strips are gone.', 4: 'One parity strip per stripe can rebuild only one missing strip.', 5: 'One parity strip per stripe can rebuild only one missing strip.', 6: 'Two check strips can rebuild at most two missing strips per stripe.' }[level];
            const usable = level === 0 ? n : level === 1 ? n / 2 : level === 6 ? n - 2 : n - 1;
            const cap = `${names[level]}, ${n} disks: ${usable} disks’ worth of data (${Math.round((100 * usable) / n)}% usable).`;
            if (!failed.size) { narr.className = 'narr'; narr.innerHTML = `${cap} Every disk is healthy. Fail one, two or three disks and see whether the data survives.`; }
            else if (!lost && !rebuilt) { narr.className = 'narr ok'; narr.innerHTML = `<b>Data survives:</b> only check strips were on the failed disk${failed.size > 1 ? 's' : ''}, so every data strip is still read directly. Replace the disk${failed.size > 1 ? 's' : ''} and recompute ${failed.size > 1 ? 'their' : 'its'} check strips from the data.`; }
            else if (!lost) { narr.className = 'narr ok'; narr.innerHTML = `<b>Data survives</b> in degraded mode: ${rebuilt} of ${total} data strips shown ${how} (marked ↻; the values match the originals). Replace the disk${failed.size > 1 ? 's' : ''} and rebuild.`; }
            else { narr.className = 'narr bad'; narr.innerHTML = `<b>Data lost:</b> ${lost} of ${total} data strips shown cannot be recovered. ${why}`; }
          }
          draw();
        },
      },

      /* ---------------- 8. Comparison ---------------- */
      {
        title: 'Compare the seven levels',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const slim = ctx.narrow, SIZE = 4;
          let n = 8, sel = 5;
          const LV = [
            { lv: 0, cat: 'Striping', disks: 'N', fail: '0: worse than one disk', big: 'Very high', small: 'Very high, reads and writes', write: '1 write',
              use: 'Choose it for scratch data that can be recreated, where only speed matters (temporary files, render caches). Never for data you cannot afford to lose.' },
            { lv: 1, cat: 'Mirroring', disks: '2N', fail: '1 per pair', big: 'Reads above one disk; writes like one disk', small: 'Reads up to 2× one disk; writes like one disk', write: '2 writes (in parallel)',
              use: 'Choose it for system software, boot disks and small, highly critical data: simple, fast reads and instant recovery, at the price of half the raw space.' },
            { lv: 2, cat: 'Parallel access', disks: 'N + m', fail: '1', big: 'Highest', small: 'Low: one request at a time', write: 'Every disk, in lock-step',
              use: 'Historical only. Drives now correct their own bit errors, so the extra Hamming check disks buy nothing.' },
            { lv: 3, cat: 'Parallel access', disks: 'N + 1', fail: '1', big: 'Highest', small: 'Low: one request at a time', write: 'Every disk, in lock-step',
              use: 'Suits one user streaming long sequential transfers. Poor for many small requests, so it is rarely chosen today.' },
            { lv: 4, cat: 'Independent access', disks: 'N + 1', fail: '1', big: 'Reads near RAID 0; writes limited by the parity disk', small: 'Reads near RAID 0; writes poor (parity-disk bottleneck)', write: '2 reads + 2 writes',
              use: 'Good reads, but the single parity disk is involved in every write. RAID 5 removes that bottleneck at no extra cost in disks.' },
            { lv: 5, cat: 'Independent access', disks: 'N + 1', fail: '1', big: 'Reads near RAID 0; writes pay for parity', small: 'Reads near RAID 0; writes cost 4 I/Os, spread out', write: '2 reads + 2 writes',
              use: 'A common general-purpose choice: the capacity of n − 1 disks, good reads, acceptable writes, and one failure survived.' },
            { lv: 6, cat: 'Independent access', disks: 'N + 2', fail: 'Any 2', big: 'Reads near RAID 0; writes pay for P and Q', small: 'Reads near RAID 0; writes cost 6 I/Os', write: '3 reads + 3 writes',
              use: 'Large arrays of large disks, where rebuilds take hours: two failures survived, for one more disk and slower writes than RAID 5.' },
          ];
          function usable(lv) {
            if (lv === 0) return { d: n, note: '' };
            if (lv === 1) return { d: n / 2, note: '' };
            if (lv === 2) { let N = 0; for (let k = 1; k + hammingChecks(k) <= n; k++) N = k; return { d: N, note: ` (${N} data + ${hammingChecks(N)} check${N + hammingChecks(N) < n ? ', ' + (n - N - hammingChecks(N)) + ' unused' : ''})` }; }
            if (lv === 6) return { d: n - 2, note: '' };
            return { d: n - 1, note: '' };
          }
          const table = h('table', { class: 'tbl compact cmp', style: { tableLayout: 'fixed' } });
          const detail = h('div', { class: 'narr' });
          const sl = ctx.ui.slider({ label: `Disks in the array (n), ${SIZE} TB each`, min: 4, max: 12, step: 2, value: n, onInput: (v) => { n = v; draw(); } });
          function draw() {
            const head = slim ? ['Level', 'Disks for N', `Usable (n = ${n})`, 'Survives'] : ['Level', 'Category', 'Disks for N data', `Usable, n = ${n}`, 'Failures survived', 'Large transfers', 'Small requests', 'One small write'];
            const widths = slim ? ['22%', '24%', '30%', '24%'] : ['7%', '12%', '10%', '12%', '11%', '18%', '18%', '12%'];
            table.replaceChildren(h('colgroup', {}, ...widths.map((w) => h('col', { style: { width: w } }))), h('tr', {}, ...head.map((x) => h('th', {}, x))));
            LV.forEach((r, i) => {
              const u = usable(r.lv), pct = Math.round((100 * u.d) / n);
              const useTxt = `${pct}% · ${u.d * SIZE} TB`;
              const cells = slim ? ['RAID ' + r.lv, r.disks, useTxt, r.fail] : ['RAID ' + r.lv, r.cat, r.disks, useTxt, r.fail, r.big, r.small, r.write];
              const tr = h('tr', { class: i === sel ? 'on' : '', tabindex: 0, role: 'button', 'aria-label': 'Show details for RAID ' + r.lv, style: { cursor: 'pointer' }, onclick: () => { sel = i; draw(); } },
                ...cells.map((c, j) => h('td', { html: j === 0 ? `<b>${c}</b>` : c })));
              tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel = i; draw(); } });
              table.append(tr);
            });
            const r = LV[sel], u = usable(r.lv);
            detail.innerHTML = `<b>RAID ${r.lv}</b> with ${n} disks of ${SIZE} TB: <b>${u.d * SIZE} TB usable</b>${u.note}. ${slim ? `Large transfers: ${r.big.toLowerCase()}. Small requests: ${r.small.toLowerCase()}. ` : ''}${r.use}`;
          }
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('p', { class: 'm0 small' }, 'Each level trades capacity, protection and speed differently. Resize the array, and click a row for when to choose that level. (RAID 2’s m check disks grow like log N.)'),
            sl, table, detail));
          draw();
        },
      },

      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: what to remember about RAID',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['What three ideas make an array RAID?', 'The OS sees <b>one logical drive</b>; data is <b>striped</b> across the disks; <b>redundant</b> information (a mirror or parity) survives a failure. RAID 0 skips the third.'],
              ['In RAID 0 with n disks, where is logical strip k?', 'On disk <b>k mod n</b>, in stripe <b>⌊k / n⌋</b>. Big requests use every disk at once; small requests spread over the disks.'],
              ['How does parity rebuild a lost disk?', 'XOR every surviving strip of each stripe, parity included. It rebuilds <b>one</b> strip per stripe, and only because the failed disk is known.'],
              ['What does a one-strip write cost?', 'RAID 4 and 5: read old data and old parity, write new data and new parity = <b>4 I/Os</b>. RAID 6 also updates Q: <b>6 I/Os</b>. RAID 1: 2 writes.'],
              ['Why RAID 5 instead of RAID 4?', 'RAID 4’s single parity disk joins <b>every</b> write and becomes the bottleneck. RAID 5 rotates parity over all disks.'],
              ['With n disks: usable space and failures survived?', 'RAID 0: n, none. RAID 1: n/2, one per pair. RAID 3/4/5: n − 1, one. RAID 6: n − 2, any two.'],
            ], { cols: 3, height: 178 }),
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '<b>RAID is not a backup.</b> It protects against a disk dying, but deleting a file, a virus or a fire reaches every disk at once. Keep separate backups too.' })));
        },
      },

      /* ---------------- 10. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A RAID 0 array has 4 disks, numbered from 0, with strips laid round-robin starting at disk 0. Where is logical strip 13?',
            choices: ['Disk 3, stripe 1', 'Disk 1, stripe 3', 'Disk 1, stripe 4', 'Disk 0, stripe 3'], answer: 1,
            feedback: ['That swaps the two numbers. The disk is 13 mod 4 = 1 and the stripe is ⌊13 / 4⌋ = 3.', null, 'Stripes are numbered from 0: strips 12 to 15 form stripe 3, not stripe 4.', 'Strip 12 starts stripe 3 on disk 0; strip 13 sits one disk further along.'],
            why: 'With n disks, strip k lives on disk k mod n in stripe ⌊k / n⌋: 13 mod 4 = 1 and ⌊13 / 4⌋ = 3.' },
          { type: 'num', q: 'A RAID 5 array is built from 6 disks of 4 TB each. How many terabytes are available for user data?', answer: 20, tol: 0, unit: 'TB',
            why: 'Parity takes one disk’s worth of space (spread over all six disks), so usable space is (6 − 1) × 4 = 20 TB.' },
          { q: 'Four data disks and one parity disk hold 4-bit values: X0 = 1011, X1 = 0110, X3 = 0011 and parity P = 0010. Disk X2 fails. What did X2 hold?',
            choices: ['1100', '1110', '1111', '0010'], answer: 0,
            feedback: [null, 'That is X0 ⊕ X1 ⊕ X3 without the parity. P must be included, because it is the only place that carries information about X2.', 'That leaves X3 out. Every survivor, data and parity alike, goes into the XOR.', 'That is just P. P mixes all four data disks together, so it must be XOR-ed with the other survivors to isolate X2.'],
            why: 'X2 = P ⊕ X0 ⊕ X1 ⊕ X3 = 0010 ⊕ 1011 ⊕ 0110 ⊕ 0011 = 1100. XOR-ing P with the survivors cancels them and leaves the missing value.' },
          { type: 'tf', q: 'In RAID 1, every read must be sent to both disks so the controller can compare the two copies.', answer: false,
            why: 'Either copy can serve a read. The controller picks the disk that can reach the data sooner, and two different reads can run on the two disks at once. Only writes go to both disks.' },
          { type: 'num', q: 'In RAID 5, how many disk I/O operations (reads plus writes) does a write that changes only one data strip need?', answer: 4, tol: 0, unit: 'I/Os',
            why: 'Read the old data strip and the old parity strip, compute P′ = P ⊕ X_old ⊕ X_new, then write the new data and the new parity: 2 reads + 2 writes.' },
          { type: 'order', q: 'An array has 6 disks. Order these levels by usable capacity, from most to least.', items: ['RAID 0', 'RAID 5', 'RAID 6', 'RAID 1'],
            why: 'With 6 disks: RAID 0 uses all 6 (100%), RAID 5 uses 5 (83%), RAID 6 uses 4 (67%), and RAID 1 uses 3 (50%).' },
          { type: 'bucket', q: 'Sort each level by how its disks serve requests.', buckets: ['Parallel access: every disk works on every request', 'Independent access: disks can serve separate requests'],
            items: [['RAID 2', 0], ['RAID 3', 0], ['RAID 4', 1], ['RAID 5', 1], ['RAID 6', 1]],
            why: 'RAID 2 and 3 synchronize their disks and use tiny strips, so each request occupies the whole array. RAID 4, 5 and 6 use large strips, so different disks can work on different requests.' },
          { type: 'match', q: 'Match each level to the redundancy it stores.', pairs: [['RAID 0', 'None at all'], ['RAID 1', 'A full mirror copy of every strip'], ['RAID 2', 'A Hamming code on several check disks'], ['RAID 4', 'Parity strips on one dedicated disk'], ['RAID 5', 'Parity strips rotated across all disks'], ['RAID 6', 'Two independent checks, P and Q']],
            why: 'RAID 0 is pure striping; RAID 1 mirrors; RAID 2 uses an error-correcting code; RAID 4 and 5 both use XOR parity, on one disk or rotated; RAID 6 adds a second, independent check.' },
          { q: 'Why does RAID 3 need only one check disk, while RAID 2 needs several?',
            choices: ['RAID 3 uses large strips, so far fewer bits need protecting', 'RAID 3 mirrors the data, so a check disk is rarely needed', 'The failed disk is known, so parity need not locate the error', 'RAID 3 only detects errors; it cannot rebuild a failed disk'], answer: 2,
            feedback: ['RAID 3 uses tiny strips, just like RAID 2; strip size is not what saves check disks.', 'RAID 3 does not mirror anything; its only redundancy is the single parity disk.', null, 'RAID 3 can rebuild a whole failed disk by XOR-ing the survivors.'],
            why: 'A Hamming code must find which bit is wrong, which takes several check bits. A failed disk announces itself, so a single parity value is enough to recompute the missing bits.' },
          { type: 'multi', q: 'Which statements about RAID 4 and RAID 5 are true?',
            choices: ['Both need N + 1 disks for N disks of data', 'In RAID 4, every write involves the same parity disk', 'RAID 5 survives any two disk failures', 'A one-strip write in either level needs two reads and two writes', 'In RAID 5, some disks never hold any parity'], answer: [0, 1, 3],
            why: 'Both levels add one disk of XOR parity and pay 2 reads + 2 writes per small write. RAID 4 keeps all parity on one disk (a write bottleneck); RAID 5 rotates parity so every disk holds some. Either survives only one failure.' },
          { q: 'A team needs an array that keeps all its data after <b>any two</b> disks fail, and it can accept slower writes. Which level fits?',
            choices: ['RAID 5', 'RAID 1', 'RAID 0', 'RAID 6'], answer: 3,
            feedback: ['RAID 5 has one parity strip per stripe, so it survives only one failure.', 'A mirror survives two failures only if they hit different pairs; losing both disks of one pair loses data.', 'RAID 0 has no redundancy, so a single failure already loses data.', null],
            why: 'RAID 6 stores two independent checks (P and Q) per stripe on different disks, so any two disks can fail. The price is N + 2 disks and 3 reads + 3 writes per small write.' },
        ],
      },
    ],
    notes: `
<h3>Why arrays of disks?</h3>
<p>Processors have sped up thousands of times over the decades; a disk’s moving arm and spinning platter only a few times. Using several disks at once helps in two ways: one <b>large request</b> split across many disks finishes sooner (higher <b>data transfer capacity</b>), and many <b>small requests</b> on different disks run at the same time (higher <b>I/O request rate</b>). More disks also means more failures, so arrays store <b>redundant</b> information.</p>
<p><b>RAID</b> (redundant array of independent disks; the 1988 paper that coined the name said <i>inexpensive</i>) rests on three ideas:</p>
<ol>
<li>The operating system sees the set of physical drives as <b>one logical drive</b>. A controller or driver maps each logical block to a disk and position.</li>
<li>Data is <b>striped</b>: spread across the drives in round-robin order.</li>
<li><b>Redundant capacity</b> holds a mirror copy or check data (parity) so data can be recovered after a disk failure. RAID 0 is the one level without this.</li>
</ol>
<h3>RAID 0: striping, no redundancy</h3>
<p>The space is cut into equal <b>strips</b> (one or more blocks or sectors). Strip 0 goes on disk 0, strip 1 on disk 1, and so on. A <b>stripe</b> is one row: one strip on every disk. With n disks, logical strip k lives on <b>disk k mod n</b> in <b>stripe ⌊k / n⌋</b>. Example: n = 4, strip 13 → disk 1, stripe 3.</p>
<ul>
<li><b>Large requests</b> are fast when every disk delivers part of the data at once, if the path to memory (controller, buses) can carry all the streams. 12 strips on 4 disks take 3 strip-times instead of 12.</li>
<li><b>Small requests</b> are fast when strips are large enough that one request touches one disk and requests spread evenly (load balancing).</li>
<li>No redundancy: losing any one disk loses data, so RAID 0 is <i>less</i> reliable than a single disk (roughly n times as likely to suffer a failure).</li>
</ul>
<h3>RAID 1: mirroring</h3>
<p>Every strip is stored on two disks. A <b>read</b> can use either copy; the controller picks the one that can reach the data sooner (shorter seek plus rotational delay), and two reads can run at once. A <b>write</b> must update both copies; the two writes run in parallel, but the write finishes only when the slower disk does. <b>Recovery</b> is simple: copy the twin to a new disk. <b>Cost:</b> 2N disks for N disks of data (50% usable). Good for system software and highly critical files.</p>
<h3>RAID 2 and RAID 3: parallel access</h3>
<p>In a <b>parallel access array</b> every disk takes part in every request: the spindles (the motors that spin the platters) are synchronized so all heads are at the same position, and strips are tiny (a byte or a word).</p>
<ul>
<li><b>RAID 2</b> stores a <b>Hamming code</b> computed across corresponding bits on extra check disks. A single-error-correcting code with m check disks must name any one of the N + m disks or “no error”, so it needs the smallest m with 2<sup>m</sup> ≥ N + m + 1: 3 check disks for 4 data disks, 4 for 10. The number grows with the logarithm of N. It helps only where disk errors are frequent; modern drives correct bit errors internally, so RAID 2 is essentially unused.</li>
<li><b>RAID 3</b> needs a single parity disk however large the array, because a failed disk is known: parity only has to supply the missing bits, not locate them.</li>
<li>Both give a very high transfer rate for large requests, but the array serves only one request at a time, so small-request rate is poor.</li>
</ul>
<h3>Parity with XOR</h3>
<p>Exclusive-OR (⊕) gives 1 when two bits differ and 0 when they are equal; across many bits it gives 1 when the number of 1s is odd. With four data disks, <b>P = X3 ⊕ X2 ⊕ X1 ⊕ X0</b>, bit by bit. Because a value XOR-ed with itself is 0, any one value equals the XOR of all the others, e.g. <b>X1 = P ⊕ X3 ⊕ X2 ⊕ X0</b>.</p>
<p><b>Worked example.</b> X0 = 1011, X1 = 0110, X2 = 1100, X3 = 0011 gives P = 0010. If disk X2 fails: P ⊕ X0 ⊕ X1 ⊕ X3 = 0010 ⊕ 1011 ⊕ 0110 ⊕ 0011 = 1100, exactly the lost value. Parity can rebuild only one missing strip per stripe, and only because the failed disk is known.</p>
<h3>RAID 4: block-level parity and the small-write penalty</h3>
<p>RAID 4, 5 and 6 are <b>independent access arrays</b>: strips are relatively large, so each disk can serve a different request at the same time, which suits high request rates. RAID 4 keeps a parity strip for each stripe on one dedicated parity disk.</p>
<p>Writing a single strip (a <b>small write</b>) takes four operations: read the old data strip, read the old parity strip, compute <b>P′ = P ⊕ X<sub>old</sub> ⊕ X<sub>new</sub></b>, then write the new data and the new parity. That is <b>2 reads + 2 writes</b>, the <b>small-write penalty</b>. Example: P = 0010, X1 changes from 0110 to 1111, so P′ = 0010 ⊕ 0110 ⊕ 1111 = 1011 (recomputing from all four strips agrees). A write that fills a whole stripe needs no reads; its parity comes from the new data alone. Because every write needs the parity disk, that disk becomes a <b>bottleneck</b>: under random small writes it performs half of all the array’s I/O operations.</p>
<h3>RAID 5: distributed parity</h3>
<p>RAID 5 is organized like RAID 4 but rotates the parity strips round-robin over all disks: for n disks, the parity strip is on a different disk for each of the first n stripes, then the pattern repeats. Writes to different stripes can then use different disks, removing the parity-disk bottleneck. It still needs N + 1 disks and 2 reads + 2 writes per small write, and survives the loss of any one disk.</p>
<h3>RAID 6: dual redundancy</h3>
<p>RAID 6 stores two different check values per stripe on two different disks: <b>P</b>, ordinary XOR parity, and <b>Q</b>, an independent check computed with different arithmetic (commonly a Reed–Solomon code). Two independent equations can solve for two missing strips, so <b>any two disks may fail</b>. N disks of data need <b>N + 2</b> disks, and a small write must update data, P and Q: <b>3 reads + 3 writes</b>, a heavier write penalty than RAID 5. It matters because a rebuild of a large disk can take hours; during that time the array runs in <b>degraded mode</b> (missing data recomputed on every read). A second disk failure in that window loses data on a RAID 5 array, and a single unreadable sector on a surviving disk loses the stripe it belongs to; RAID 6 can still recover in both cases.</p>
<h3>Comparison</h3>
<table>
<tr><th>Level</th><th>Disks for N data</th><th>Usable with n disks</th><th>Failures survived</th><th>Large transfers</th><th>Small requests</th><th>One small write</th></tr>
<tr><td>0</td><td>N</td><td>100%</td><td>0</td><td>Very high</td><td>Very high</td><td>1 write</td></tr>
<tr><td>1</td><td>2N</td><td>50%</td><td>1 per pair</td><td>Reads above one disk; writes like one disk</td><td>Reads up to 2× one disk; writes like one disk</td><td>2 writes</td></tr>
<tr><td>2</td><td>N + m</td><td>N / (N + m)</td><td>1</td><td>Highest</td><td>Low (one at a time)</td><td>All disks</td></tr>
<tr><td>3</td><td>N + 1</td><td>(n − 1)/n</td><td>1</td><td>Highest</td><td>Low (one at a time)</td><td>All disks</td></tr>
<tr><td>4</td><td>N + 1</td><td>(n − 1)/n</td><td>1</td><td>Reads near RAID 0; writes limited</td><td>Reads near RAID 0; writes poor (parity disk)</td><td>2 reads + 2 writes</td></tr>
<tr><td>5</td><td>N + 1</td><td>(n − 1)/n</td><td>1</td><td>Reads near RAID 0; writes pay for parity</td><td>Reads near RAID 0; writes cost 4 I/Os, spread out</td><td>2 reads + 2 writes</td></tr>
<tr><td>6</td><td>N + 2</td><td>(n − 2)/n</td><td>Any 2</td><td>Reads near RAID 0; writes pay for P and Q</td><td>Reads near RAID 0; writes cost 6 I/Os</td><td>3 reads + 3 writes</td></tr>
</table>
<p>Example: 6 disks of 4 TB give 24 TB (RAID 0), 20 TB (RAID 5), 16 TB (RAID 6) or 12 TB (RAID 1). In practice today: levels 0, 1, 5, 6 and combinations of levels, such as RAID 10 (data striped across several mirrored pairs); RAID 2 and 3 are historical.</p>
<p><b>RAID is not a backup:</b> it protects against a disk dying, but a deleted file, malware or a fire reaches every disk at once.</p>
  `,
  });
})();
