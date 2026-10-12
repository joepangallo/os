/* =====================================================================
   12.2 File Organization and Access
   Original teaching material. Every number a student is told comes out of
   the small engines below (a real search over a generated file for the cost
   lab; small state machines for the pile, sequential, indexed sequential,
   indexed and hashed demos). Helpers live in this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ENGINE (cost lab) -------------------------------------------------
     A generated file of n records whose keys are 10, 20, 30, ... in key
     order. Every index entry or record whose key is compared with the
     target counts as one access. dev/qa-12.2/engine.test.mjs extracts this
     exact block and checks it against the formulas.                     */
  const KEY = (i) => 10 * (i + 1);
  function rng32(a) {                                   // small seeded generator: same seed, same keys
    return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function buildFile(n) { const k = new Int32Array(n); for (let i = 0; i < n; i++) k[i] = KEY(i); return k; }
  function makeIndex(keys, entries) {                   // one entry per run of `seg` keys: the run's first key and where it starts
    const seg = Math.ceil(keys.length / entries), cnt = Math.ceil(keys.length / seg);
    const ik = new Int32Array(cnt), ip = new Int32Array(cnt);
    for (let j = 0; j < cnt; j++) { ik[j] = keys[j * seg]; ip[j] = j * seg; }
    return { ik, ip, seg };
  }
  function scanIndex(ik, from, to, target) {            // scan entries until one is past the target; the one before it is the answer
    let j = from, n = 0;
    while (j < to) { n++; if (ik[j] > target) break; j++; }
    return { pos: j - 1, n };
  }
  function scanRecords(keys, from, to, target) {        // scan records in key order until the key is reached or passed
    let n = 0;
    for (let i = from; i < to; i++) { n++; if (keys[i] >= target) return { n, found: keys[i] === target }; }
    return { n, found: false };
  }
  function hashOf(k, b) { let x = k | 0; x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) % b; }
  function buildHash(keys, buckets) {                   // chaining: records that collide are linked in arrival order
    const head = new Int32Array(buckets).fill(-1), tail = new Int32Array(buckets).fill(-1), next = new Int32Array(keys.length).fill(-1);
    for (let i = 0; i < keys.length; i++) { const b = hashOf(keys[i], buckets); if (head[b] < 0) head[b] = i; else next[tail[b]] = i; tail[b] = i; }
    return { head, next, buckets };
  }
  const SEARCH = {
    seq(f, t) { const r = scanRecords(f.keys, 0, f.keys.length, t); return { total: r.n, parts: [['file', r.n]], found: r.found }; },
    idx1(f, t) {
      const a = scanIndex(f.i1.ik, 0, f.i1.ik.length, t);
      if (a.pos < 0) return { total: a.n, parts: [['index', a.n]], found: false };
      const s = f.i1.ip[a.pos], r = scanRecords(f.keys, s, Math.min(s + f.i1.seg, f.keys.length), t);
      return { total: a.n + r.n, parts: [['index', a.n], ['file', r.n]], found: r.found };
    },
    idx2(f, t) {
      const a = scanIndex(f.top.ik, 0, f.top.ik.length, t);
      if (a.pos < 0) return { total: a.n, parts: [['top index', a.n]], found: false };
      const ls = f.top.ip[a.pos], b = scanIndex(f.lo.ik, ls, Math.min(ls + f.top.seg, f.lo.ik.length), t);
      const s = f.lo.ip[b.pos], r = scanRecords(f.keys, s, Math.min(s + f.lo.seg, f.keys.length), t);
      return { total: a.n + b.n + r.n, parts: [['top index', a.n], ['lower index', b.n], ['file', r.n]], found: r.found };
    },
    hash(f, t) {
      let i = f.h.head[hashOf(t, f.h.buckets)], n = 0;
      while (i >= 0) { n++; if (f.keys[i] === t) return { total: n, parts: [['bucket chain', n]], found: true }; i = f.h.next[i]; }
      return { total: Math.max(n, 1), parts: [['bucket chain', Math.max(n, 1)]], found: false };
    },
  };
  function buildOrg(org, n, p) {                        // the file plus whatever structure the organization adds
    const f = { keys: buildFile(n) };
    if (org === 'idx1') f.i1 = makeIndex(f.keys, p.I);
    if (org === 'idx2') { f.lo = makeIndex(f.keys, p.L); f.top = makeIndex(f.lo.ik, p.U); }
    if (org === 'hash') f.h = buildHash(f.keys, Math.max(1, Math.round(n / p.load)));
    return f;
  }
  const NICE = [2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  const LOADS = [0.5, 1, 2, 4];
  function estimate(org, n, p) {                        // what the simple formulas predict for an average successful search
    if (org === 'seq') return n / 2;
    if (org === 'idx1') return p.I / 2 + Math.ceil(n / p.I) / 2;
    if (org === 'idx2') return p.U / 2 + Math.ceil(p.L / p.U) / 2 + Math.ceil(n / p.L) / 2;
    return 1 + p.load / 2;
  }
  /* ENGINE-END */

  Guide.section({
    id: '12.2',
    title: 'File Organization and Access',
    short: 'File organization',
    summary: 'Five ways to arrange the records of a file, from a loose pile to a hashed file, and what each one costs.',
    objectives: [
      'Explain what a file organization is and weigh the five criteria (access time, ease of update, storage economy, simple maintenance, reliability) for a given use.',
      'Describe how a pile, a sequential file, an indexed sequential file, an indexed file and a direct (hashed) file store, add and find records.',
      'Compute the average number of accesses to find a record in a sequential file and through one- and two-level indexes.',
      'Explain overflow files, exhaustive and partial indexes, and how a hashed file handles collisions.',
      'Choose a suitable organization for an application and justify the choice with the strengths and weaknesses of each.',
    ],
    terms: [
      ['File organization', 'The logical arrangement of the records in a file: their order, any indexes, and where new records go. It is chosen to match the way the records will be accessed.'],
      ['Pile', 'The simplest file organization: records are stored in the order they arrive, may have different lengths and different fields, and each field names itself. Finding a record means searching the whole file.'],
      ['Exhaustive search', 'Finding a record by examining records one after another until it turns up, or until every record has been examined.'],
      ['Sequential file', 'A file in which every record has the same fixed format (same fields, same order, same length) and the records are stored in order of a key field.'],
      ['Key field', 'The field whose value identifies a record (such as an employee number) and that decides the order of the records in a sequential file.'],
      ['Log file (transaction file)', 'A separate file that collects new or changed records as they arrive, so they can later be merged into the main file in one batch run.'],
      ['Batch update', 'Applying many accumulated changes to a file in one run, usually by merging a log file into the sorted main file and writing a fresh copy.'],
      ['Indexed sequential file', 'A sequential file with two additions: an index that lets a search jump close to the wanted record, and an overflow file that holds new records until the next reorganization.'],
      ['Index', 'A smaller, sorted table of key values with pointers to where the records (or the next index level) can be found.'],
      ['Overflow file', 'In an indexed sequential file, the area where newly added records are written. Each one is linked from the record that comes just before it in key order.'],
      ['Multilevel index', 'An index built on top of another index: the top level picks a stretch of the level below, which in turn picks a stretch of the file.'],
      ['Reorganization', 'Rewriting an indexed sequential file so the overflow records are merged into the main file in key order and the index is rebuilt.'],
      ['Indexed file', 'A file whose records have no particular order and are reached only through indexes, usually one index for each field that people search by.'],
      ['Exhaustive index', 'An index with one entry for every record in the main file.'],
      ['Partial index', 'An index with entries only for the records that contain the field of interest.'],
      ['Direct file (hashed file)', 'A file in which a hash function turns each record\'s key into the address of a block (bucket), so a record can be fetched with about one access and no searching.'],
      ['Bucket', 'In a hashed file, the block that a hash value selects; it holds the records whose keys hash to that value.'],
      ['Collision', 'Two different keys that hash to the same bucket. The file needs a rule, such as chaining extra records into an overflow area, for where the newcomer goes.'],
    ],
    css: `
      .sec-12-2 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-12-2 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-2 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-2 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-12-2 .mw0 > * { min-width: 0; }
      .sec-12-2 input.kin, .sec-12-2 select.kin { height: 32px; font: inherit; font-size: 15px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--panel); color: var(--ink); padding: 0 8px; }
      .sec-12-2 input.kin { width: 92px; }
      .sec-12-2 .crit-row { border: 1px solid var(--line); background: var(--panel); border-radius: 10px; padding: 6px 10px; }
      .sec-12-2 .crit-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .sec-12-2 .crit-reason { color: var(--ink-2); margin-top: 2px; }
      .sec-12-2 .bdg { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px; font-size: 12px; font-weight: 800; background: var(--accent); color: var(--accent-ink); font-variant-numeric: tabular-nums; }
      .sec-12-2 .bdg.off { visibility: hidden; }
      .sec-12-2 .p2-top { display: grid; grid-template-columns: 430px minmax(0, 1fr); gap: 12px; align-items: start; }
      .sec-12-2 .p2-top .narr { min-height: 84px; font-size: 14.5px; }
      .sec-12-2 .p2-top.slim { grid-template-columns: minmax(0, 1fr); }
      .sec-12-2 .slim .prow .pf { white-space: normal; overflow-wrap: anywhere; }
      .sec-12-2 .slim table.seqt td, .sec-12-2 .slim table.seqt th { padding: 1px 3px; font-size: 12px; }
      .sec-12-2 .prow { display: flex; align-items: center; gap: 8px; padding: 1px 6px; border-radius: 7px; font-size: 13.5px; min-height: 23px; }
      .sec-12-2 .prow .pf { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sec-12-2 .fk { color: var(--muted); }
      .sec-12-2 .prow.ex, .sec-12-2 tr.ex td { background: var(--accent-bg); }
      .sec-12-2 .prow.hit, .sec-12-2 tr.hit td { background: var(--ok-bg); }
      .sec-12-2 .prow.hit .bdg, .sec-12-2 tr.hit .bdg { background: var(--ok); }
      .sec-12-2 tr.stop td { background: var(--warn-bg); }
      .sec-12-2 tr.stop .bdg { background: var(--warn); }
      .sec-12-2 table.seqt td, .sec-12-2 table.seqt th { padding: 1px 7px; font-size: 13px; line-height: 21px; }
      .sec-12-2 table.seqt td.pad { color: var(--line-2); }
      .sec-12-2 table.logt { border-color: var(--io); }
      .sec-12-2 .isam { display: grid; grid-template-columns: 104px minmax(0, 1fr) 112px; gap: 16px; align-items: start; }
      .sec-12-2 .isam .stack { gap: 10px !important; }
      .sec-12-2 .isam.slim { grid-template-columns: minmax(0, 1fr); }
      .sec-12-2 .isam.slim .stack { flex-direction: row; flex-wrap: wrap; }
      .sec-12-2 .isam.slim .stack > .xs { width: 100%; }
      .sec-12-2 .isam.slim .rec { min-width: 66px; padding: 2px 6px; }
      .sec-12-2 .isam.slim .mrow { gap: 9px; }
      .sec-12-2 .isam.slim .rec.ov { width: auto; }
      .sec-12-2 .isam.slim .mrow { width: 100%; }
      .sec-12-2 .ixe, .sec-12-2 .rec { position: relative; display: flex; align-items: center; gap: 6px; border: 2px solid var(--cpu); background: var(--cpu-bg); border-radius: 8px; padding: 2px 8px; font-size: 16px; height: 36px; white-space: nowrap; }
      .sec-12-2 .rec { display: inline-flex; border-color: var(--mem); background: var(--mem-bg); min-width: 82px; }
      .sec-12-2 .ixe .bdg, .sec-12-2 .rec .bdg { position: absolute; top: -9px; left: -9px; }
      .sec-12-2 .mrow { display: flex; align-items: center; gap: 12px; height: 36px; }
      .sec-12-2 .mrow .blk { width: 34px; flex: none; white-space: nowrap; }
      .sec-12-2 .rec.ov { border-color: var(--io); background: var(--io-bg); width: 100%; min-width: 0; }
      .sec-12-2 .rec .ptr { font-style: normal; font-size: 13px; color: var(--muted); margin-left: auto; }
      .sec-12-2 .rec .ptr.on { color: var(--io); font-weight: 800; }
      .sec-12-2 .ixe.ex, .sec-12-2 .rec.ex { outline: 3px solid var(--accent); outline-offset: 1px; }
      .sec-12-2 .ixe.pick, .sec-12-2 .rec.pick { outline: 3px solid var(--thread); outline-offset: 1px; }
      .sec-12-2 .ixe.pick .bdg, .sec-12-2 .rec.pick .bdg { background: var(--thread); }
      .sec-12-2 .ixe.stop, .sec-12-2 .rec.stop { outline: 3px dashed var(--warn); outline-offset: 1px; }
      .sec-12-2 .ixe.stop .bdg, .sec-12-2 .rec.stop .bdg { background: var(--warn); }
      .sec-12-2 .rec.hit { outline: 3px solid var(--ok); outline-offset: 1px; }
      .sec-12-2 .rec.hit .bdg { background: var(--ok); }
      .sec-12-2 .lg { display: inline-block; width: 16px; height: 12px; border-radius: 3px; margin: 0 5px 0 6px; vertical-align: -1px; }
      .sec-12-2 .lg.ex { outline: 3px solid var(--accent); } .sec-12-2 .lg.pick { outline: 3px solid var(--thread); }
      .sec-12-2 .lg.stop { outline: 3px dashed var(--warn); } .sec-12-2 .lg.hit { outline: 3px solid var(--ok); }
      .sec-12-2 .lg.ov { background: var(--io-bg); border: 2px solid var(--io); }
      .sec-12-2 .lab-params { min-height: 92px; }
      .sec-12-2 .lab-params .ui-slider { font-size: 14.5px; }
      .sec-12-2 .lab-narr { min-height: 92px; }
      .sec-12-2 .lab-tabs { flex: 1; min-height: 120px; }
      .sec-12-2 .ixwrap { display: grid; grid-template-columns: 158px minmax(0, 1fr); gap: 12px; align-items: start; }
      .sec-12-2 .ixlist { display: flex; flex-direction: column; gap: 4px; }
      .sec-12-2 .ixb { display: flex; justify-content: space-between; align-items: center; gap: 6px; height: 27px; padding: 0 8px; border: 1px solid var(--line-2); border-radius: 7px; background: var(--panel-2); color: var(--ink); font: inherit; font-size: 14px; cursor: pointer; text-align: left; }
      .sec-12-2 .ixb .v { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sec-12-2 .ixb:hover { border-color: var(--accent); }
      .sec-12-2 .ixb.on { background: var(--ok-bg); border-color: var(--ok); }
      .sec-12-2 .ixb.new, .sec-12-2 .slot.new { box-shadow: 0 0 0 3px var(--hl); }
      .sec-12-2 .slots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
      .sec-12-2 .slot { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 8px; padding: 3px 6px; min-height: 86px; display: flex; flex-direction: column; justify-content: space-between; gap: 1px; min-width: 0; }
      .sec-12-2 .ixwrap.slim { grid-template-columns: minmax(0, 1fr); }
      .sec-12-2 .ixwrap.slim .slots { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sec-12-2 .slot.free { border: 2px dashed var(--line-2); background: transparent; justify-content: flex-start; gap: 4px; }
      .sec-12-2 .slot.read { border-color: var(--ok); background: var(--ok-bg); outline: 3px solid var(--ok); outline-offset: 1px; }
      .sec-12-2 .slot > * { flex: none; }
      .sec-12-2 .slot .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px; font-weight: 700; }
      .sec-12-2 .tagx { font-size: 12.5px; padding: 0 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .sec-12-2 .hcalc { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px; border-radius: 10px; background: var(--os-bg); border: 1px solid color-mix(in srgb, var(--os) 35%, transparent); font-size: 22px; }
      .sec-12-2 .hcalc b { color: var(--os); }
      .sec-12-2 .hrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; row-gap: 12px; padding: 3px 6px; border-radius: 9px; min-height: 44px; }
      .sec-12-2 .hrow.on { background: var(--accent-bg); }
      .sec-12-2 .hb { width: 70px; flex: none; font-size: 14px; font-weight: 700; color: var(--ink-2); }
      .sec-12-2 .hblock { display: inline-flex; gap: 4px; padding: 3px; border: 2px solid var(--io); border-radius: 9px; background: var(--panel-2); }
      .sec-12-2 .hrec { position: relative; display: inline-grid; place-items: center; width: 64px; height: 30px; border-radius: 7px; border: 2px solid var(--mem); background: var(--mem-bg); font-family: var(--mono); font-weight: 700; font-size: 15px; }
      .sec-12-2 .hrec.empty { border-style: dashed; border-color: var(--line-2); background: transparent; color: var(--muted); font-family: var(--font); font-weight: 600; font-size: 12.5px; }
      .sec-12-2 .hrec.ov { border-color: var(--io); background: var(--io-bg); }
      .sec-12-2 .hrec.ex { outline: 3px solid var(--accent); outline-offset: 1px; }
      .sec-12-2 .hrec.hit { outline: 3px solid var(--ok); outline-offset: 1px; }
      .sec-12-2 .hrec .bdg { position: absolute; top: -9px; left: -9px; }
      .sec-12-2 .hrec.hit .bdg { background: var(--ok); }
      .sec-12-2 .harr { color: var(--io); font-weight: 800; }
      .sec-12-2 table.cmp th { font-size: 12.5px; padding: 5px 8px; }
      .sec-12-2 table.cmp th.cg { text-align: center; color: var(--chc); border-left: 1px solid var(--line); }
      .sec-12-2 table.cmp td { padding: 4px 6px; vertical-align: middle; font-size: 15px; }
      .sec-12-2 .rt { display: inline-block; border: 1px solid transparent; border-radius: 7px; padding: 2px 8px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; width: 100%; text-align: center; }
      .sec-12-2 span.rt { width: auto; cursor: default; }
      .sec-12-2 .rt.r-e { background: var(--ok-bg); color: var(--ok); }
      .sec-12-2 .rt.r-g { background: var(--cpu-bg); color: var(--cpu); }
      .sec-12-2 .rt.r-a { background: var(--warn-bg); color: var(--warn); }
      .sec-12-2 .rt.r-p { background: var(--bad-bg); color: var(--bad); }
      .sec-12-2 button.rt.on { outline: 3px solid var(--ink); outline-offset: 1px; }
      .sec-12-2 .cmp-info { min-height: 68px; }
      .sec-12-2 table.cmp td { padding: 4px 6px; }
      .sec-12-2 .obtns { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
      .sec-12-2 .obtns.slim { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sec-12-2 .obtn { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-height: 84px; padding: 10px 12px; border: 2px solid var(--line-2); border-radius: 12px; background: var(--panel); color: var(--ink); font: inherit; font-size: 15.5px; text-align: left; cursor: pointer; }
      .sec-12-2 .obtn:hover { border-color: var(--accent); }
      .sec-12-2 .obtn.good { border-color: var(--ok); background: var(--ok-bg); }
      .sec-12-2 .obtn.wrong { border-color: var(--bad); background: var(--bad-bg); }
      .sec-12-2 .sdot { width: 26px; height: 26px; border-radius: 13px; border: 1px solid var(--line-2); background: var(--panel-2); color: var(--ink-2); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
      .sec-12-2 .sdot.on { border: 2px solid var(--accent); color: var(--accent); }
      .sec-12-2 .sdot.ok { background: var(--ok-bg); color: var(--ok); }
      .sec-12-2 .sdot.bad { background: var(--bad-bg); color: var(--bad); }
      .sec-12-2 .okey { color: var(--io); font-weight: 800; }
      .sec-12-2 .flip-face.front { font-size: 20px; }
      .sec-12-2 .flip-face.back { font-size: 16px; line-height: 1.45; }
      .sec-12-2 .ordl { line-height: 1.5; }
    `,
    steps: [
      /* ---------------- 1. Big picture: the arrangement follows the use ---------------- */
      {
        title: 'How you will look records up decides how you store them',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">A file of records is useless unless you can find, change and add records again later. How fast that goes depends on how the records are arranged.</p>
              <p class="m0">That arrangement is the <span class="t">file organization</span>: the order of the records, whether there is an index, and where a new record goes. It is chosen to fit the way the file will be used, and the wrong choice is expensive: later you will measure one lookup that costs half a million record accesses in one organization and one or two in another.</p>
              <div class="callout analogy m0" data-label="Analogy">Receipts in a shoebox, names in a phone book, recipes found through a cookbook's index, coats on numbered hooks: four ways to store things for finding later, each quick for one kind of search and clumsy for another.</div>
              <h4 class="m0" style="margin-top:4px">The five organizations you will meet</h4>
              <div class="row gap-s">
                <span class="chip warn"><span class="t" data-t="pile">Pile</span></span>
                <span class="chip mem"><span class="t" data-t="sequential file">Sequential</span></span>
                <span class="chip cpu"><span class="t" data-t="indexed sequential file">Indexed sequential</span></span>
                <span class="chip os"><span class="t" data-t="indexed file">Indexed</span></span>
                <span class="chip io"><span class="t" data-t="direct file">Direct (hashed)</span></span>
              </div>
            </div>
            <div class="card stack crit-card" style="gap:8px">
              <div class="row" style="justify-content:space-between">
                <h4 class="m0">What we want from an organization</h4>
                <span class="xs muted">priorities change with the job</span>
              </div>
              <div class="crit-seg"></div>
              <div class="crit-list stack" style="gap:6px"></div>
              <div class="callout why m0 crit-why" data-label="Why it matters"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const CRIT = [
            ['Short access time', 'reach the one record you want quickly'],
            ['Ease of update', 'add, change and delete records with little work'],
            ['Economy of storage', 'no wasted padding, duplicates or bulky extras'],
            ['Simple maintenance', 'few structures to keep in step or rebuild'],
            ['Reliability', 'records survive crashes and mistakes intact'],
          ];
          const USES = [
            { label: 'Nightly payroll run', why: 'A batch job reads every record once, in employee-number order. A plain sorted file serves it perfectly, so paying for an index would buy nothing.',
              p: [['Low', 'Every record is read anyway, in order; fetching one record fast is not the goal.'],
                ['Medium', 'Changes can wait for the next run and be applied all at once.'],
                ['Medium', 'The file is large and copied every run, so compact records help.'],
                ['High', 'A simple sorted file is easy to check, back up and rebuild.'],
                ['High', 'Paychecks depend on it: no record may be lost or garbled.']] },
            { label: 'Help-desk lookups', why: 'One customer at a time, by number, while someone waits. Here an index or a hash is worth its extra space and its extra update work.',
              p: [['High', 'A customer is waiting on the phone for each lookup.'],
                ['High', 'Addresses and orders change all day; the next caller must see the change.'],
                ['Low', 'Extra space for indexes is a fair price for fast answers.'],
                ['Medium', 'Indexes must be kept in step with the records, which takes care.'],
                ['High', 'Wrong or missing customer data costs money and trust.']] },
            { label: 'Write-once archive', why: 'Records written once to media that cannot be rewritten never need updating, so ease of update drops out and packing records tightly matters most.',
              p: [['Low', 'Lookups are rare; waiting a few seconds is acceptable.'],
                ['Low', 'The medium cannot be rewritten, so records never change.'],
                ['High', 'Every byte saved fits more records on each disc.'],
                ['Low', 'Nothing changes, so nothing needs rebuilding.'],
                ['High', 'The archive may be the only surviving copy.']] },
          ];
          const CLS = { High: 'ok', Medium: 'warn', Low: 'muted' };
          const list = ctx.$('.crit-list'), why = ctx.$('.crit-why');
          function show(u) {
            const use = USES[u];
            list.replaceChildren(...CRIT.map(([name, def], i) => {
              const [lvl, reason] = use.p[i];
              return h('div', { class: 'crit-row' },
                h('div', { class: 'crit-top' },
                  h('span', {}, h('b', {}, name), h('span', { class: 'small muted' }, ' · ' + def)),
                  h('span', { class: 'chip ' + (CLS[lvl] === 'muted' ? '' : CLS[lvl]) }, lvl)),
                h('div', { class: 'small crit-reason' }, reason));
            }));
            why.innerHTML = use.why;
            list.classList.remove('fade-in'); void list.offsetWidth; list.classList.add('fade-in');
          }
          ctx.$('.crit-seg').append(ctx.ui.seg(USES.map((u, i) => ({ value: i, label: u.label })), 0, show));
          show(0);
        },
      },

      /* ---------------- 2. Pile versus sequential file ---------------- */
      {
        title: 'The pile and the sequential file',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const FIELDS = ['id', 'name', 'phone', 'email', 'team'];
          const WIDTH = { id: 4, name: 20, phone: 12, email: 30, team: 8 };        // fixed bytes per field in the sequential format: room for the longest value allowed
          const RECSIZE = FIELDS.reduce((a, f) => a + WIDTH[f], 0);
          const START = [
            { id: 205, name: 'Ana', team: 'Red' }, { id: 117, name: 'Ben', phone: '555-0134', email: 'ben@mail.org' },
            { id: 342, name: 'Chen', email: 'chen@uni.edu' }, { id: 150, name: 'Dara', phone: '555-0178', team: 'Blue' },
            { id: 288, name: 'Eli' }, { id: 109, name: 'Fay', phone: '555-0101', email: 'fay@club.net', team: 'Gold' },
            { id: 263, name: 'Gus', team: 'Blue' }, { id: 321, name: 'Hana', phone: '555-0190' },
          ];
          const ARRIVE = [{ id: 230, name: 'Ivy', email: 'ivy@mail.org' }, { id: 128, name: 'Jon', team: 'Red' }, { id: 300, name: 'Kai', phone: '555-0122' }, { id: 175, name: 'Lia', email: 'lia@uni.edu', team: 'Gold' }];
          const MISSING = 199;
          const pileBytes = (r) => FIELDS.filter((f) => r[f] != null).reduce((a, f) => a + f.length + String(r[f]).length + 2, 0);  // "name=value;" per field present
          let st;
          function fresh() { st = { pile: START.slice(), master: START.slice().sort((a, b) => a.id - b.id), log: [], next: 0, marks: null }; }
          fresh();

          const narr = h('div', { class: 'narr' });
          const addBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: add });
          const batchBtn = h('button', { class: 'btn sm', type: 'button', onclick: batch }, 'Batch update');
          const sel = h('select', { class: 'kin', 'aria-label': 'Key to look up', 'data-keys': '', onchange: () => lookup(+sel.value) });
          const findBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => lookup(+sel.value) }, 'Look up');
          const resetBtn = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { fresh(); say('Back to the start: eight records, kept as a pile on the left and as a sorted sequential file on the right.', ''); draw(); } }, '↺ Reset');
          const pileBox = h('div', { class: 'stack', style: { gap: '3px' } });
          const seqBox = h('div', { class: 'stack', style: { gap: '6px' } });
          const pileSpace = h('div', { class: 'xs muted' }), seqSpace = h('div', { class: 'xs muted' });

          function say(html, cls) { narr.className = 'narr' + (cls ? ' ' + cls : ''); narr.innerHTML = html; }
          const badge = (n) => h('span', { class: 'bdg' + (n ? '' : ' off') }, n ? String(n) : '0');
          function markOf(where, i) { const m = st.marks && st.marks[where]; return m && m[i] ? m[i] : null; }

          function draw() {
            const nx = ARRIVE[st.next];
            addBtn.textContent = nx ? `+ New record ${nx.id} arrives` : 'No more arrivals';
            addBtn.disabled = !nx;
            const ids = st.pile.map((r) => r.id).concat(MISSING).sort((a, b) => a - b);
            const keep = +sel.value;
            sel.replaceChildren(...ids.map((id) => h('option', { value: id }, id === MISSING ? id + ' (not in file)' : String(id))));
            sel.value = ids.includes(keep) ? keep : 263;
            pileBox.replaceChildren(...st.pile.map((r, i) => {
              const m = markOf('pile', i);
              return h('div', { class: 'prow' + (m ? ' ' + m.cls : '') }, badge(m && m.n),
                h('span', { class: 'mono pf', html: FIELDS.filter((f) => r[f] != null).map((f) => `<span class="fk">${f}=</span>${r[f]}`).join(' ') }));
            }));
            pileSpace.textContent = `Space: ${st.pile.reduce((a, r) => a + pileBytes(r), 0)} bytes (only the fields a record has, each stored as name=value)`;
            const row = (r, i, where) => {
              const m = markOf(where, i);
              return h('tr', { class: m ? m.cls : '' }, h('td', {}, badge(m && m.n)),
                ...FIELDS.map((f) => h('td', { class: 'mono' + (r[f] == null ? ' pad' : '') }, r[f] == null ? '·'.repeat(Math.min(WIDTH[f], 6)) : String(r[f]))));
            };
            const head = h('tr', {}, h('th', {}, ''), ...FIELDS.map((f) => h('th', {}, f)));
            seqBox.replaceChildren(
              h('table', { class: 'tbl compact seqt' }, h('thead', {}, head), h('tbody', {}, ...st.master.map((r, i) => row(r, i, 'master')))),
              h('div', { class: 'xs b', style: { color: 'var(--io)' } }, st.log.length ? `Log file: ${st.log.length} record${st.log.length === 1 ? '' : 's'} waiting for the next batch update` : 'Log file: empty'),
              ...(st.log.length ? [h('table', { class: 'tbl compact seqt logt' }, h('tbody', {}, ...st.log.map((r, i) => row(r, i, 'log'))))] : []));
            seqSpace.textContent = `Space: ${st.master.length + st.log.length} × ${RECSIZE} bytes = ${(st.master.length + st.log.length) * RECSIZE} bytes (room for each field's longest allowed value)`;
            batchBtn.disabled = !st.log.length;
          }

          function add() {
            const r = ARRIVE[st.next]; if (!r) return;
            st.next++; st.pile.push(r); st.log.push(r); st.marks = { pile: { [st.pile.length - 1]: { n: 1, cls: 'hit' } }, log: { [st.log.length - 1]: { n: 1, cls: 'hit' } } };
            say(`Record <b>${r.id}</b> (${r.name}) arrived. <b>Pile:</b> written at the end, 1 write, nothing else moves. <b>Sequential file:</b> the main file must stay in key order, so the record goes to the <span class="t">log file</span> instead (1 write) and waits for the next <span class="t">batch update</span>.`, 'ok');
            draw();
          }

          function lookup(id) {
            const marks = { pile: {}, master: {}, log: {} };
            let p = 0, pf = false;
            for (let i = 0; i < st.pile.length; i++) { p++; const hit = st.pile[i].id === id; marks.pile[i] = { n: p, cls: hit ? 'hit' : 'ex' }; if (hit) { pf = true; break; } }
            let m = 0, mf = false, stopAt = null;
            for (let i = 0; i < st.master.length; i++) { m++; const k = st.master[i].id; if (k === id) { mf = true; marks.master[i] = { n: m, cls: 'hit' }; break; } if (k > id) { stopAt = k; marks.master[i] = { n: m, cls: 'stop' }; break; } marks.master[i] = { n: m, cls: 'ex' }; }
            let l = 0, lf = false;
            if (!mf) for (let i = 0; i < st.log.length; i++) { l++; const hit = st.log[i].id === id; marks.log[i] = { n: m + l, cls: hit ? 'hit' : 'ex' }; if (hit) { lf = true; break; } }
            st.marks = marks; draw();
            const pileTxt = pf ? `examined <b>${p}</b> of ${st.pile.length} records before finding ${id}; arrival order says nothing about where a key is, so this is an <span class="t">exhaustive search</span> (and each record must be read field by field to find its id).`
              : `examined <b>all ${p}</b> records to be sure ${id} is not there.`;
            let seqTxt;
            if (mf) seqTxt = `scanned <b>${m}</b> record${m === 1 ? '' : 's'} in key order and found ${id}.`;
            else {
              const stop = stopAt != null ? `stopped after <b>${m}</b> at key ${stopAt}: keys only grow from here, so ${id} is not in the main file` : `scanned all <b>${m}</b> main-file records`;
              seqTxt = st.log.length ? `${stop}; then it had to check the unsorted log too (${l} more), <b>${m + l}</b> in all${lf ? ', and found it there' : ''}.` : `${stop}. Total <b>${m}</b>.`;
            }
            say(`<b>Pile:</b> ${pileTxt}<br><b>Sequential:</b> ${seqTxt}`, (pf || mf || lf) ? '' : 'warn');
          }

          function batch() {
            if (!st.log.length) return;
            const k = st.log.length;
            st.master = st.master.concat(st.log).sort((a, b) => a.id - b.id); st.log = [];
            st.marks = { master: Object.fromEntries(st.master.map((r, i) => [i, { n: 0, cls: ARRIVE.includes(r) ? 'hit' : '' }])) };
            say(`<b>Batch update:</b> the ${k} logged record${k === 1 ? ' was' : 's were'} sorted and merged with the main file in one pass, writing a fresh copy of all <b>${st.master.length}</b> records. Cheap per record but far too slow to repeat after every arrival, so it runs on a schedule (say, nightly). A variant keeps the records as a linked list in key order: an insert then only relinks pointers, but every scan must follow them.`, 'ok');
            draw();
          }

          say('Both files hold the same eight people. <b>Add</b> records, <b>look up</b> a key in both files at once, then run a <b>batch update</b>. The numbered badges show the order in which records were examined.', '');
          draw();
          const pileCard = h('div', { class: 'card white stack', style: { gap: '6px' } },
            h('div', { html: '<b style="color:var(--warn)">Pile</b> <span class="small muted">· arrival order; fields name themselves; records vary</span>' }), pileSpace, pileBox);
          const seqCard = h('div', { class: 'card white stack', style: { gap: '6px' } },
            h('div', { html: '<b style="color:var(--mem)">Sequential file</b> <span class="small muted">· fixed format, sorted by the <span class="t">key field</span> <code>id</code></span>' }), seqSpace, seqBox);
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'p2-top' + (ctx.narrow ? ' slim' : '') }, h('div', { class: 'row gap-s' }, addBtn, batchBtn, h('span', { class: 'row gap-s nw' }, sel, findBtn), resetBtn), narr),
            h('div', { class: 'grid-2 mw0 grow' + (ctx.narrow ? ' slim' : '') }, pileCard, seqCard)));
        },
      },

      /* ---------------- 3. Indexed sequential file with an overflow file ---------------- */
      {
        title: 'Indexed sequential: an index plus an overflow file',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const SEG = 3, OVMAX = 6, MAXREC = 24;
          const START = [12, 18, 25, 31, 40, 46, 53, 61, 67, 74, 82, 95];
          const QUICK = [44, 42, 47, 43, 97, 28];
          let st, marks = null, base = 0;
          function build(keys) {
            const main = keys.map((k) => ({ k, p: -1 }));
            st = { main, ov: [], idx: [] };
            for (let i = 0; i < main.length; i += SEG) st.idx.push({ k: main[i].k, at: i });
          }
          const nodeOf = (x) => (x.w === 'm' ? st.main[x.i] : st.ov[x.i]);
          function logical() {                                   // every record in key order: each main record, then its overflow chain
            const out = [];
            st.main.forEach((r, i) => { out.push({ k: r.k, w: 'm', i }); for (let p = r.p; p >= 0; p = st.ov[p].p) out.push({ k: st.ov[p].k, w: 'o', i: p }); });
            return out;
          }
          function search(k) {
            const path = [];
            let n = 0, j = 0;
            for (; j < st.idx.length; j++) { n++; if (st.idx[j].k > k) { path.push({ w: 'i', i: j, n, cls: 'stop', k: st.idx[j].k }); break; } path.push({ w: 'i', i: j, n, cls: 'ex', k: st.idx[j].k }); }
            const seg = j - 1;
            if (seg < 0) return { path, n, found: false, seg };
            path.filter((x) => x.w === 'i' && x.i === seg).forEach((x) => { x.cls = 'pick'; });
            const from = st.idx[seg].at, to = seg + 1 < st.idx.length ? st.idx[seg + 1].at : st.main.length;
            const visit = (w, i, key) => { n++; const cls = key === k ? 'hit' : key > k ? 'stop' : 'ex'; path.push({ w, i, n, cls, k: key }); return cls; };
            for (let i = from; i < to; i++) {
              let c = visit('m', i, st.main[i].k); if (c !== 'ex') return { path, n, found: c === 'hit', seg };
              for (let p = st.main[i].p; p >= 0; p = st.ov[p].p) { c = visit('o', p, st.ov[p].k); if (c !== 'ex') return { path, n, found: c === 'hit', seg }; }
            }
            return { path, n, found: false, seg };
          }
          const avgCost = () => {                                // average over every key, split into index accesses and file (main + overflow) accesses
            const L = logical(); let ix = 0, fl = 0;
            L.forEach((x) => { const r = search(x.k), i = r.path.filter((p) => p.w === 'i').length; ix += i; fl += r.n - i; });
            return { keys: L.length, ixSum: ix, flSum: fl, ix: ix / L.length, fl: fl / L.length, all: (ix + fl) / L.length };
          };
          const d2 = (v) => v.toFixed(2);
          function reset() { build(START); marks = null; base = avgCost(); }
          reset();

          const inp = h('input', { class: 'kin', type: 'number', min: 1, max: 199, value: 44, 'data-keys': '', 'aria-label': 'Key to search (1 to 199) or insert (13 to 199)', onkeydown: (e) => { if (e.key === 'Enter') doSearch(); } });
          const narr = h('div', { class: 'narr' });
          const ixCol = h('div', { class: 'stack', style: { gap: '4px' } }), mainCol = h('div', { class: 'stack', style: { gap: '4px' } }), ovCol = h('div', { class: 'stack', style: { gap: '4px' } });
          const orderLine = h('div', { class: 'small mono ordl' }), costLine = h('div', { class: 'small' });
          const quickRow = h('div', { class: 'row gap-s' });
          const say = (html, cls) => { narr.className = 'narr' + (cls ? ' ' + cls : ''); narr.innerHTML = html; };
          const markAt = (w, i) => (marks || []).find((x) => x.w === w && x.i === i);
          const bdg = (m) => h('span', { class: 'bdg' + (m ? '' : ' off') }, m ? String(m.n) : '0');
          const oname = (p) => 'O' + (p + 1);

          function draw() {
            ixCol.replaceChildren(h('div', { class: 'xs b muted' }, 'INDEX'), ...st.idx.map((e, j) => { const m = markAt('i', j); return h('div', { class: 'ixe ' + (m ? m.cls : '') }, bdg(m), h('b', {}, String(e.k)), h('span', { class: 'xs muted' }, '→ blk ' + j)); }));
            const rows = [];
            for (let j = 0; j < st.idx.length; j++) {
              const to = j + 1 < st.idx.length ? st.idx[j + 1].at : st.main.length;
              const cells = [];
              for (let i = st.idx[j].at; i < to; i++) { const r = st.main[i], m = markAt('m', i); cells.push(h('span', { class: 'rec ' + (m ? m.cls : '') }, bdg(m), h('b', {}, String(r.k)), h('i', { class: r.p >= 0 ? 'ptr on' : 'ptr' }, r.p >= 0 ? '→' + oname(r.p) : '·'))); }
              rows.push(h('div', { class: 'mrow' }, h('span', { class: 'xs muted blk' }, 'blk ' + j), ...cells));
            }
            mainCol.replaceChildren(h('div', { class: 'xs b muted' }, 'MAIN FILE (key order, ' + SEG + ' per block)'), ...rows);
            ovCol.replaceChildren(h('div', { class: 'xs b muted' }, `OVERFLOW (${st.ov.length}/${OVMAX})`),
              ...(st.ov.length ? st.ov.map((o, p) => { const m = markAt('o', p); return h('span', { class: 'rec ov ' + (m ? m.cls : '') }, bdg(m), h('span', { class: 'xs muted' }, oname(p)), h('b', {}, String(o.k)), h('i', { class: o.p >= 0 ? 'ptr on' : 'ptr' }, o.p >= 0 ? '→' + oname(o.p) : '·')); }) : [h('div', { class: 'xs muted' }, 'empty')]));
            orderLine.innerHTML = '<b class="b">Key order:</b> ' + logical().map((x) => (x.w === 'o' ? `<span class="okey">${x.k}</span>` : String(x.k))).join(' ');
            const a = avgCost();
            costLine.innerHTML = `Finding each of the ${a.keys} keys once: index ${a.ixSum} + file ${a.flSum} = <b>${a.ixSum + a.flSum}</b> accesses, <b>${d2(a.all)}</b> per search. <span class="muted">File part per search: ${d2(a.fl)} now, ${d2(base.fl)} right after the last reorganization.</span>`;
            const full = st.ov.length >= OVMAX || st.main.length + st.ov.length >= MAXREC;
            const have = new Set(logical().map((x) => x.k));
            quickRow.replaceChildren(h('span', { class: 'xs muted' }, 'Quick inserts:'), ...QUICK.map((k) => h('button', { class: 'btn sm', type: 'button', disabled: have.has(k) || full, onclick: () => { inp.value = k; doInsert(); } }, String(k))));
          }

          function readKey(lo) {
            const k = Math.round(Number(inp.value));
            if (!Number.isFinite(k) || k < lo || k > 199) { say(lo > 1 ? 'To insert, type a whole-number key from 13 to 199: a new key needs a smaller key in front of it to link from, and the smallest key in the file is 12.' : 'Type a whole-number key from 1 to 199.', 'warn'); return null; }
            return k;
          }
          function doInsert() {
            const k = readKey(13); if (k == null) return;
            const L = logical();
            if (L.some((x) => x.k === k)) { marks = search(k).path; draw(); say(`Key ${k} is already in the file. Keys are unique, so it was not added.`, 'warn'); return; }
            if (st.ov.length >= OVMAX || L.length >= MAXREC) { marks = null; draw(); say('The overflow file is full. Press <b>Reorganize</b> to merge it into the main file and make room.', 'warn'); return; }
            let pred = null; L.forEach((x) => { if (x.k < k) pred = x; });
            const node = nodeOf(pred);
            const oldNext = node.p;
            st.ov.push({ k, p: oldNext }); node.p = st.ov.length - 1;
            marks = [{ w: pred.w, i: pred.i, n: 1, cls: 'pick' }, { w: 'o', i: st.ov.length - 1, n: 2, cls: 'hit' }];
            draw();
            say(`${k} went to the overflow file as <b>${oname(st.ov.length - 1)}</b>. Its predecessor in key order is ${pred.k} (${pred.w === 'm' ? 'in the main file' : 'already in overflow'}), so ${pred.k}'s pointer now leads to ${oname(st.ov.length - 1)}, which points on to ${oldNext >= 0 ? oname(oldNext) + ' (' + st.ov[oldNext].k + ')' : 'nothing (the scan then returns to the main file)'}. The main file and index did not move.`, 'ok');
          }
          function doSearch() {
            const k = readKey(1); if (k == null) return;
            const r = search(k); marks = r.path; draw();
            if (r.seg < 0) { say(`<b>Index:</b> the very first entry (${st.idx[0].k}) is already past ${k}, so ${k} cannot be anywhere in the file: <b>${r.n}</b> access.`, 'warn'); return; }
            const ix = r.path.filter((x) => x.w === 'i'), fl = r.path.filter((x) => x.w !== 'i');
            const chosen = st.idx[r.seg];
            const ixTxt = ix[ix.length - 1].cls === 'stop' ? `<b>Index:</b> ${ix.length} entr${ix.length === 1 ? 'y' : 'ies'} examined; ${ix[ix.length - 1].k} is already past ${k}, so ${k} belongs to the block that starts at ${chosen.k}.` : `<b>Index:</b> all ${ix.length} entries examined; the last one (${chosen.k}) is the highest key ≤ ${k}.`;
            const flTxt = fl.map((x) => (x.w === 'o' ? `<span class="okey">${x.k}</span>` : String(x.k))).join(' → ');
            const miss = fl[fl.length - 1].cls === 'stop' ? `${fl[fl.length - 1].k} is already past ${k}` : `the block ended without reaching ${k}`;
            const extra = [ix[ix.length - 1].cls === 'stop' ? `the index entry past ${k}` : '', fl.some((x) => x.w === 'o') ? 'the overflow records on the way' : ''].filter(Boolean).join(' and ');
            say(`${ixTxt}<br><b>File:</b> ${flTxt} ${r.found ? '<b>found</b>' : `(${miss}: <b>not in the file</b>)`}. Total <b>${r.n}</b> accesses${extra ? ', counting ' + extra : ''}.`, r.found ? '' : 'warn');
          }
          function doReorg() {
            const before = st.ov.length, was = avgCost(), blocks0 = st.idx.length;
            const keys = logical().map((x) => x.k); build(keys); marks = null; base = avgCost(); draw();
            say(before ? `<b>Reorganized:</b> ${keys.length} records rewritten in key order (${before} from overflow), ${st.idx.length} blocks, a new ${st.idx.length}-entry index. No chain detours: the file part of a search fell from ${d2(was.fl)} to <b>${d2(base.fl)}</b> accesses.${st.idx.length > blocks0 ? ` The index part rose (${d2(was.ix)} → ${d2(base.ix)}) only because the bigger file has more blocks.` : ''}` : 'Nothing in the overflow file, so <b>reorganizing</b> would only copy the file unchanged.', 'ok');
          }

          say('Type a key and <b>Search</b>, or <b>Insert</b> new keys (try 44, then 42, 47 and 43) and watch the chain behind 40 grow. Badges number every access.', '');
          draw();
          const ctl = h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Key'), inp,
              h('button', { class: 'btn sm primary', type: 'button', onclick: doSearch }, 'Search'),
              h('button', { class: 'btn sm', type: 'button', onclick: doInsert }, 'Insert'),
              h('button', { class: 'btn sm', type: 'button', onclick: doReorg }, 'Reorganize'),
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); draw(); say('Back to the original twelve records and an empty overflow file.', ''); } }, '↺')),
            quickRow);
          const left = h('div', { class: 'stack', style: { gap: '8px' } },
            h('p', { class: 'm0', html: 'An <span class="t">indexed sequential file</span> keeps a sorted sequential file and adds two things:' }),
            h('ul', { class: 'm0 small', html: '<li>an <span class="t">index</span>: the first key of each block with a pointer to it. Search it for the highest key ≤ the target, jump there, and scan forward.</li><li>an <span class="t">overflow file</span>: new records go here, each linked from the record just before it in key order, so the main file never moves until the next <span class="t">reorganization</span>.</li>' }),
            ctl, narr,
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'The index does not list every record, only the first key of each block. That is why a search still scans a short stretch of the main file after the index.' }));
          const right = h('div', { class: 'card white stack', style: { gap: '8px' } },
            h('div', { class: 'isam' + (ctx.narrow ? ' slim' : '') }, ixCol, mainCol, ovCol), h('div', { class: 'grow' }),
            h('div', { class: 'row xs muted', html: '<span><span class="bdg">1</span> access order</span><span><span class="lg ex"></span> examined</span><span><span class="lg pick"></span> chosen</span><span><span class="lg stop"></span> past the key</span><span><span class="lg hit"></span> found / new</span><span><span class="lg ov"></span> overflow</span>' }),
            orderLine, costLine);
          el.append(h('div', { class: 'split l fill' }, left, right));
        },
      },

      /* ---------------- 4. Cost lab: measure the search cost ---------------- */
      {
        title: 'Cost lab: how many accesses does one lookup take?',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const fmt = ctx.util.fmt;
          const ORGS = [
            { value: 'seq', label: 'Sequential', short: 'Sequential' },
            { value: 'idx1', label: '1-level index', short: '1-level' },
            { value: 'idx2', label: '2-level index', short: '2-level' },
            { value: 'hash', label: 'Hashed', short: 'Hashed' },
          ];
          const SIZES = [1000, 10000, 100000, 1000000];
          const RUNS = 300;
          const st = { org: 'seq', n: 1000000, p: null, res: {}, seed: 1 };
          const nice = (lo, hi) => NICE.filter((v) => v >= lo && v <= hi);
          function defaults(n) {
            const I = nice(2, n / 2).reduce((b, v) => (estimate('idx1', n, { I: v }) < estimate('idx1', n, { I: b }) ? v : b));
            return { I, L: I, U: I >= 20 ? 10 : 2, load: 1 };
          }
          st.p = defaults(st.n);
          let built = null;
          const pkey = () => st.org + '|' + st.n + '|' + (st.org === 'idx1' ? st.p.I : st.org === 'idx2' ? st.p.L + '/' + st.p.U : st.org === 'hash' ? st.p.load : '');
          function file() { const k = pkey(); if (!built || built.k !== k) built = { k, f: buildOrg(st.org, st.n, st.p) }; return built.f; }
          const paramText = (org, p) => (org === 'seq' ? 'no index' : org === 'idx1' ? fmt(p.I, 0) + ' entries' : org === 'idx2' ? fmt(p.U, 0) + ' over ' + fmt(p.L, 0) : 'load ' + p.load);
          function formula(org, n, p) {
            if (org === 'seq') return `N/2 = ${fmt(n, 0)}/2 = <b>${fmt(n / 2, 1)}</b>`;
            if (org === 'idx1') { const S = Math.ceil(n / p.I); return `I/2 + S/2 = ${fmt(p.I, 0)}/2 + ${fmt(S, 0)}/2 = <b>${fmt(estimate(org, n, p), 1)}</b> <span class="muted">(S = records per index entry)</span>`; }
            if (org === 'idx2') { const T = Math.ceil(p.L / p.U), S = Math.ceil(n / p.L); return `U/2 + T/2 + S/2 = ${fmt(p.U, 0)}/2 + ${fmt(T, 0)}/2 + ${fmt(S, 0)}/2 = <b>${fmt(estimate(org, n, p), 1)}</b> <span class="muted">(T = lower entries per top entry, S = records per lower entry)</span>`; }
            return `1 + load/2 = 1 + ${p.load}/2 = <b>${fmt(estimate(org, n, p), 2)}</b> <span class="muted">(average chain position)</span>`;
          }

          const narr = h('div', { class: 'narr small lab-narr' });
          const paramBox = h('div', { class: 'stack lab-params', style: { gap: '6px' } });
          const say = (html, cls) => { narr.className = 'narr small lab-narr' + (cls ? ' ' + cls : ''); narr.innerHTML = html; };
          function slider(label, list, val, fmtv, set) {
            const i0 = Math.max(0, list.indexOf(val));
            return ctx.ui.slider({ label, min: 0, max: list.length - 1, step: 1, value: i0, format: (i) => fmtv(list[i]), onInput: (i) => { set(list[i]); } });
          }
          function drawParams() {
            const n = st.n, p = st.p;
            const kids = [];
            if (st.org === 'seq') kids.push(h('p', { class: 'small muted m0', html: 'No index: every search starts at the first record and reads forward in key order until it reaches the key.' }));
            if (st.org === 'idx1') kids.push(slider('Index entries I', nice(2, n / 2), p.I, (v) => fmt(v, 0), (v) => { p.I = v; refreshNote(); }));
            if (st.org === 'idx2') {
              kids.push(h('p', { class: 'small muted m0', html: 'A <span class="t">multilevel index</span>: the top index (U entries) picks a stretch of the lower index (L entries), which picks a stretch of the file.' }));
              kids.push(slider('Lower index L', nice(4, n / 2), p.L, (v) => fmt(v, 0), (v) => { p.L = v; if (p.U > v / 2) p.U = nice(2, v / 2).pop(); drawParams(); }));
              kids.push(slider('Top index U', nice(2, p.L / 2), p.U, (v) => fmt(v, 0), (v) => { p.U = v; refreshNote(); }));
            }
            if (st.org === 'hash') {
              kids.push(h('p', { class: 'small muted m0', html: 'Each bucket is a chain of records; every record compared along the chain counts as one access.' }));
              kids.push(slider('Average records per bucket', LOADS, p.load, (v) => String(v), (v) => { p.load = v; refreshNote(); }));
            }
            kids.push(h('div', { class: 'small lab-est' }));
            paramBox.replaceChildren(...kids);
            refreshNote();
          }
          function refreshNote() { const e = paramBox.querySelector('.lab-est'); if (e) e.innerHTML = 'Formula: ' + formula(st.org, st.n, st.p); }

          function searchOne() {
            const f = file(); const rnd = rng32(st.seed++ * 7919);
            const t = KEY(Math.floor(rnd() * st.n));
            const r = SEARCH[st.org](f, t);
            say(`Key <b>${fmt(t, 0)}</b>: ${r.parts.map(([w, c]) => `${w} <b>${fmt(c, 0)}</b>`).join(' + ')} = <b>${fmt(r.total, 0)}</b> access${r.total === 1 ? '' : 'es'}. One search is luck of the draw; press <b>Run ${RUNS} searches</b> for a fair average.`, '');
          }
          function runMany() {
            const f = file(); const rnd = rng32(st.seed++ * 104729);
            let sum = 0, lo = Infinity, hi = 0;
            for (let r = 0; r < RUNS; r++) { const c = SEARCH[st.org](f, KEY(Math.floor(rnd() * st.n))).total; sum += c; lo = Math.min(lo, c); hi = Math.max(hi, c); }
            const avg = sum / RUNS, est = estimate(st.org, st.n, st.p);
            (st.res[st.n] = st.res[st.n] || {})[st.org] = { avg, est, p: Object.assign({}, st.p) };
            const lv = st.org === 'idx1' ? 1 : st.org === 'idx2' ? 2 : 0;
            say(`<b>${RUNS} random searches</b> in a ${fmt(st.n, 0)}-record file, ${ORGS.find((o) => o.value === st.org).label.toLowerCase()} (${paramText(st.org, st.p)}): average <b>${fmt(avg, 1)}</b> accesses, fewest ${fmt(lo, 0)}, most ${fmt(hi, 0)}. The formula predicts ${fmt(est, 1)}${lv ? `; the count adds about ${lv} for the entry read just past the target in ${lv === 1 ? 'the index' : 'each index level'}` : ''}.`, 'ok');
            drawChart();
          }

          const W = ctx.narrow ? 360 : 640, LBL = ctx.narrow ? 92 : 150, X0 = LBL + 8, X1 = W - 66, ROW = 60, TOP = 34, H = TOP + ROW * 4 + 6;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Average accesses per search for each organization, on a log scale' });
          const xOf = (v) => X0 + (Math.log10(Math.max(v, 1)) / 6) * (X1 - X0);
          const title = h('h4', { class: 'm0' });
          function drawChart() {
            const res = st.res[st.n] || {};
            title.innerHTML = `Average accesses per search · ${fmt(st.n, 0)} records · <span class="t" data-t="log scale">log scale</span>`;
            const kids = [];
            [1, 10, 100, 1000, 10000, 100000, 1000000].forEach((v, i) => {
              const x = xOf(v);
              kids.push(s('line', { x1: x, y1: TOP - 6, x2: x, y2: H - 4, class: 's-muted', 'stroke-dasharray': '3 4' }));
              if (!ctx.narrow || i % 2 === 0) kids.push(s('text', { x, y: TOP - 12, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, ['1', '10', '100', '1k', '10k', '100k', '1M'][i]));
            });
            ORGS.forEach((o, r) => {
              const y = TOP + r * ROW, d = res[o.value];
              kids.push(s('text', { x: 0, y: y + 20, 'font-size': 14.5, 'font-weight': 700, style: o.value === st.org ? 'fill:var(--chc)' : '' }, ctx.narrow ? o.short : o.label));
              kids.push(s('text', { x: 0, y: y + 37, 'font-size': 13, class: 's-sub' }, d ? paramText(o.value, d.p) : 'not run yet'));
              if (d) {
                const xe = xOf(d.avg);
                kids.push(s('rect', { x: X0, y: y + 8, width: Math.max(3, xe - X0), height: 28, rx: 5, class: ['s-mem', 's-cpu', 's-os', 's-io'][r], 'stroke-width': 2 }));
                const xt = xOf(d.est);
                kids.push(s('line', { x1: xt, y1: y + 2, x2: xt, y2: y + 42, stroke: 'var(--ink)', 'stroke-width': 2.5 }));
                kids.push(s('text', { x: Math.max(xe, xt) + 6, y: y + 27, 'font-size': 14, 'font-weight': 800 }, fmt(d.avg, d.avg < 10 ? 2 : d.avg < 1000 ? 1 : 0)));
              }
            });
            svg.replaceChildren(...kids);
          }

          const orgSeg = ctx.ui.seg(ORGS.map((o) => ({ value: o.value, label: o.label })), st.org, (v) => { st.org = v; drawParams(); drawChart(); say(`Now testing: <b>${ORGS.find((o) => o.value === v).label}</b>. Adjust the setting, then <b>Run ${RUNS} searches</b>.`, ''); });
          const nSeg = ctx.ui.seg(SIZES.map((n) => ({ value: n, label: fmt(n, 0) })), st.n, (v) => { st.n = v; st.p = defaults(v); drawParams(); drawChart(); say(`File size: <b>${fmt(v, 0)}</b> records. Results for each size are kept separately.`, ''); });
          // the sequential file is measured once at the start so the chart opens with its scale visible
          runMany();
          say(`The chart already shows the plain sequential file: about half the file per lookup. Now pick another organization and press <b>Run ${RUNS} searches</b>. The bar is the measured average; the black tick is the formula.`, '');
          drawParams();
          const left = h('div', { class: 'stack', style: { gap: '9px' } },
            h('p', { class: 'small m0', html: 'Every search runs over a real generated file whose keys are 10, 20, 30, … in order. Each index entry or record whose key is compared with the target counts as <b>one access</b>, including the index entry that shows a scan has gone past the target.' }),
            h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'xs b muted' }, 'ORGANIZATION'), orgSeg),
            h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'xs b muted' }, 'RECORDS IN THE FILE (N)'), nSeg),
            paramBox,
            h('div', { class: 'row gap-s' }, h('button', { class: 'btn sm', type: 'button', onclick: searchOne }, 'Search one random key'), h('button', { class: 'btn sm primary', type: 'button', onclick: runMany }, `Run ${RUNS} searches`)),
            narr);
          const tabs = ctx.ui.tabs([
            { label: 'Best index size', html: '<p class="small m0">Read entry by entry, one level costs about I/2 in the index plus N/(2I) in the stretch of file it points to. A bigger index means shorter stretches, so the total is least when the two parts are equal: <b>I = √N</b>. For 1,000,000 records: 1,000 entries, about 500 + 500 = 1,000 accesses. With two levels the three parts balance at N<sup>1/3</sup>: 100 top entries over 10,000 lower ones gives about 50 + 50 + 50 = 150. Try it.</p>' },
            { label: 'Why slightly above the formula?', html: '<p class="small m0">A scan of an index learns that it has gone far enough only by reading the first entry that is past the target, and that read counts, so each index level costs about one access more than half its length. Averaged over every key, a 1,000-entry index on 1,000,000 records costs 1,002, not 1,000. Random sampling adds a little noise too.</p>' },
            { label: 'Real disks', html: '<p class="small m0">Real systems read whole blocks that hold many records or index entries, keep the top index levels in memory, and search a sorted index by halving it (binary search) instead of reading it entry by entry, so disk reads are far fewer than these counts. The ranking of the organizations, and the huge gap between them, stays the same.</p>' },
          ]);
          const right = h('div', { class: 'card white stack', style: { gap: '8px' } }, title, svg,
            h('div', { class: 'xs muted', html: 'Bar = measured average of ' + RUNS + ' random searches · black tick = formula' }), h('div', { class: 'lab-tabs' }, tabs));
          drawChart();
          el.append(h('div', { class: 'split l fill' }, left, right));
        },
      },

      /* ---------------- 5. Indexed file: many indexes, no order ---------------- */
      {
        title: 'Indexed file: one index per field you search by',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const NSLOT = 16;
          const START = [
            [2, { code: 'QX7', name: 'Okafor', flight: '302', ff: 'FF-4417' }], [5, { code: 'B2M', name: 'Lindqvist', flight: '118', meal: 'Vegan' }],
            [0, { code: 'T9R', name: 'Alvarez', flight: '302' }], [9, { code: 'H4P', name: 'Nguyen', flight: '550', ff: 'FF-1022', meal: 'Kosher' }],
            [13, { code: 'C8Z', name: 'Bauer', flight: '118' }], [7, { code: 'M3K', name: 'Patel', flight: '302', ff: 'FF-7790', meal: 'Halal' }],
            [11, { code: 'R5D', name: 'Kim', flight: '550' }], [4, { code: 'W1E', name: 'Haddad', flight: '118', ff: 'FF-3051' }],
            [14, { code: 'J6N', name: 'Rossi', flight: '550', meal: 'Gluten-free' }], [1, { code: 'F2A', name: 'Mensah', flight: '302' }],
          ];
          const ARRIVE = [{ code: 'Y7U', name: 'Cohen', flight: '118', ff: 'FF-5562', meal: 'Vegan' }, { code: 'D9S', name: 'Ito', flight: '550' }, { code: 'P4G', name: 'Silva', flight: '302', ff: 'FF-2208' }];
          const IDX = [
            { f: 'name', label: 'Passenger', kind: 'exhaustive' }, { f: 'flight', label: 'Flight', kind: 'exhaustive' },
            { f: 'ff', label: 'Frequent flyer #', kind: 'partial' }, { f: 'meal', label: 'Special meal', kind: 'partial' },
          ];
          let st;
          function fresh() { st = { slots: Array(NSLOT).fill(null), next: 0, idx: 0, sel: null, fresh: null }; START.forEach(([i, r]) => { st.slots[i] = r; }); }
          fresh();
          const bytes = (r) => Object.values(r).reduce((a, v) => a + String(v).length + 1, 0);
          function entries(f) {                                       // the index for field f, built from the CURRENT records, sorted by value
            const out = [];
            st.slots.forEach((r, i) => { if (r && r[f] != null) out.push({ v: r[f], slot: i }); });
            return out.sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : a.slot - b.slot));
          }
          const narr = h('div', { class: 'narr small' });
          const say = (html, cls) => { narr.className = 'narr small' + (cls ? ' ' + cls : ''); narr.innerHTML = html; };
          const listBox = h('div', { class: 'ixlist' }), slotBox = h('div', { class: 'slots' }), ixHead = h('div', { class: 'small' }), lenLine = h('div', { class: 'xs muted' });
          const addBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: add });

          function draw() {
            const ix = IDX[st.idx], E = entries(ix.f), recs = st.slots.filter(Boolean).length;
            ixHead.innerHTML = `<b>${ix.label} index</b> · <span class="chip ${ix.kind === 'partial' ? 'warn' : 'ok'}">${ix.kind}</span> <span class="muted">${E.length} entr${E.length === 1 ? 'y' : 'ies'} for ${recs} records</span>`;
            listBox.replaceChildren(...E.map((e) => h('button', { type: 'button', class: 'ixb' + (st.sel === e.v ? ' on' : '') + (st.fresh && st.fresh.slot === e.slot ? ' new' : ''), onclick: () => pick(e.v) },
              h('span', { class: 'v' }, ix.f === 'flight' ? 'Flight ' + e.v : e.v), h('span', { class: 'xs muted' }, '→ slot ' + e.slot))));
            slotBox.replaceChildren(...st.slots.map((r, i) => {
              if (!r) return h('div', { class: 'slot free' }, h('span', { class: 'xs muted' }, 'slot ' + i), h('span', { class: 'xs muted' }, 'free'));
              const read = st.sel != null && r[ix.f] === st.sel;
              return h('div', { class: 'slot' + (read ? ' read' : '') + (st.fresh && st.fresh.slot === i ? ' new' : '') },
                h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: '4px' } }, h('span', { class: 'xs muted' }, 'slot ' + i), h('b', { class: 'mono small' }, r.code)),
                h('div', { class: 'nm' }, r.name),
                h('div', { class: 'xs muted' }, 'Flight ' + r.flight),
                h('div', { class: 'row nw', style: { gap: '3px', minHeight: '17px' } }, ...(r.ff ? [h('span', { class: 'chip cpu tagx' }, 'FF')] : []), ...(r.meal ? [h('span', { class: 'chip mem tagx' }, r.meal)] : [])));
            }));
            const lens = st.slots.filter(Boolean).map(bytes);
            lenLine.innerHTML = `Record lengths vary from <b>${Math.min(...lens)}</b> to <b>${Math.max(...lens)}</b> bytes; each record is stored at its own length, with no padding.`;
            const nx = ARRIVE[st.next]; addBtn.textContent = nx ? `+ Add booking ${nx.code}` : 'No more bookings'; addBtn.disabled = !nx;
          }
          function pick(v) {
            const ix = IDX[st.idx];
            st.sel = v; st.fresh = null; draw();
            const hits = entries(ix.f).filter((e) => e.v === v);
            const others = st.slots.filter(Boolean).length - hits.length;
            const what = ix.f === 'flight' ? 'flight ' + v : v;
            say(`The ${ix.label.toLowerCase()} index is sorted, so <b>${what}</b> is found by halving it (binary search), not by reading every entry. ${hits.length === 1 ? 'Its one entry points' : `Its <b>${hits.length}</b> entries point`} to slot${hits.length === 1 ? '' : 's'} ${hits.map((e) => e.slot).join(', ')}: the file reads exactly ${hits.length === 1 ? 'that record' : `those ${hits.length} records`} and never touches the other ${others}.`, 'ok');
          }
          function add() {
            const r = ARRIVE[st.next]; if (!r) return;
            const slot = st.slots.findIndex((x) => !x);
            st.slots[slot] = r; st.next++; st.sel = null; st.fresh = { slot };
            const done = IDX.map((ix) => (r[ix.f] != null ? `${ix.label} ✓` : `${ix.label} — (no value, ${ix.kind} index unchanged)`));
            const n = IDX.filter((ix) => r[ix.f] != null).length;
            draw();
            say(`Booking <b>${r.code}</b> went into slot ${slot}, the first free one: there is no order to keep, and its length (${bytes(r)} bytes) does not matter. But every index on a field it has needs a new entry: ${done.join('; ')}. <b>${n} index updates</b> for one new record.`, '');
          }
          const seg = ctx.ui.seg(IDX.map((ix, i) => ({ value: i, label: ix.label })), 0, (i) => { st.idx = i; st.sel = null; st.fresh = null; draw(); say(`Showing the <b>${IDX[i].label.toLowerCase()}</b> index (${IDX[i].kind}${IDX[i].kind === 'partial' ? ': only records that have this field get an entry' : ': one entry for every record'}). Click an entry to fetch its records.`, ''); });
          say('An airline keeps bookings wherever there is room. Pick an index, then click an entry: the index leads straight to the records. <b>Add</b> a booking to see what an insert costs.', '');
          draw();
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'An <span class="t">indexed file</span> drops the sorted order and the single key. Records go wherever there is room, may have different lengths, and are reached <b>only through indexes</b>, usually one per field that people search by.' }),
            h('ul', { class: 'm0 small', html: '<li>An <span class="t">exhaustive index</span> has an entry for every record (every booking has a passenger and a flight).</li><li>A <span class="t">partial index</span> has entries only for records that contain the field (not every passenger has a frequent-flyer number).</li><li>Typical uses: airline reservations and inventory control, where data must be current to the minute and whole-file scans are rare.</li>' }),
            narr,
            h('div', { class: 'row gap-s' }, addBtn, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { fresh(); seg.set(0); draw(); say('Back to the ten original bookings.', ''); } }, '↺ Reset')));
          const right = h('div', { class: 'card white stack', style: { gap: '8px' } }, seg, ixHead,
            h('div', { class: 'ixwrap' + (ctx.narrow ? ' slim' : '') }, listBox, h('div', { class: 'stack', style: { gap: '6px' } }, slotBox, lenLine)));
          el.append(h('div', { class: 'split l fill' }, left, right));
        },
      },

      /* ---------------- 6. Direct (hashed) file ---------------- */
      {
        title: 'Direct (hashed) file: compute where the record lives',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const B = 7, CAP = 2, MAXOV = 6;
          const START = [1234, 2051, 3307, 4416, 5520, 6608, 7003, 8125];
          const QUICK = [['Insert', 3010], ['Insert', 4704], ['Insert', 9104], ['Find', 7003], ['Find', 4704], ['Find', 5555]];
          let st;
          function fresh() { st = { home: Array.from({ length: B }, () => []), chain: Array.from({ length: B }, () => []), mark: null, calc: null }; START.forEach(put); }
          function put(k) { const b = k % B; if (st.home[b].length < CAP) { st.home[b].push(k); return { b, ov: false }; } st.chain[b].push(k); return { b, ov: true }; }
          const ovCount = () => st.chain.reduce((a, c) => a + c.length, 0);
          const has = (k) => st.home[k % B].includes(k) || st.chain[k % B].includes(k);
          fresh();
          const inp = h('input', { class: 'kin', type: 'number', min: 1000, max: 9999, value: 3010, 'data-keys': '', 'aria-label': 'Four-digit product code', onkeydown: (e) => { if (e.key === 'Enter') find(); } });
          const calc = h('div', { class: 'hcalc' }), rows = h('div', { class: 'stack', style: { gap: '6px' } }), fillLine = h('div', { class: 'xs muted' });
          const narr = h('div', { class: 'narr small' });
          const say = (html, cls) => { narr.className = 'narr small' + (cls ? ' ' + cls : ''); narr.innerHTML = html; };
          function draw() {
            const m = st.mark;
            if (st.calc != null) { const k = st.calc; calc.innerHTML = `<span class="mono">h(${k}) = ${k} mod ${B} = <b>${k % B}</b></span><span class="xs muted">because ${k} = ${B} × ${Math.floor(k / B)} + ${k % B}</span>`; }
            else calc.innerHTML = `<span class="mono">h(key) = key mod ${B}</span><span class="xs muted">the remainder picks one of buckets 0 to ${B - 1}</span>`;
            rows.replaceChildren(...st.home.map((recs, b) => {
              const on = m && m.b === b;
              const cell = (k, ov) => {
                const pm = on && m.path.find((x) => x.k === k);
                return h('span', { class: 'hrec' + (ov ? ' ov' : '') + (pm ? ' ' + pm.cls : '') }, pm ? h('span', { class: 'bdg' }, String(pm.n)) : '', String(k));
              };
              const slots = [0, 1].map((i) => (recs[i] != null ? cell(recs[i], false) : h('span', { class: 'hrec empty' }, 'empty')));
              const ch = st.chain[b].flatMap((k) => [h('span', { class: 'harr' }, '→'), cell(k, true)]);
              return h('div', { class: 'hrow' + (on ? ' on' : '') }, h('span', { class: 'hb' }, 'bucket ' + b), h('span', { class: 'hblock' }, ...slots), ...ch);
            }));
            const home = st.home.reduce((a, r) => a + r.length, 0);
            fillLine.textContent = `${home + ovCount()} records · home buckets ${home}/${B * CAP} slots full · overflow area ${ovCount()}/${MAXOV}`;
          }
          function readKey() {
            const k = Math.round(Number(inp.value));
            if (!Number.isFinite(k) || k < 1000 || k > 9999) { say('Type a four-digit product code (1000 to 9999).', 'warn'); return null; }
            return k;
          }
          function find(kIn) {
            const k = kIn != null ? kIn : readKey(); if (k == null) return;
            inp.value = k;
            const b = k % B, path = [];
            let n = 1, found = false;
            st.home[b].forEach((x) => { path.push({ k: x, n: 1, cls: x === k ? 'hit' : 'ex' }); if (x === k) found = true; });
            if (!found) for (const x of st.chain[b]) { n++; path.push({ k: x, n, cls: x === k ? 'hit' : 'ex' }); if (x === k) { found = true; break; } }
            st.calc = k; st.mark = { b, path }; draw();
            const chainTxt = n > 1 ? `, then followed the overflow chain (${n - 1} more)` : '';
            say(found ? `${k} mod ${B} = ${b}, so the file read <b>bucket ${b}</b> (1 access: one block holding both of its slots)${chainTxt} and found ${k}: <b>${n}</b> access${n === 1 ? '' : 'es'}, however big the file is.`
              : `${k} mod ${B} = ${b}: the file read bucket ${b}${chainTxt}. ${k} is not there, and it cannot be in any other bucket, so "not in the file" took only <b>${n}</b> access${n === 1 ? '' : 'es'}.`, found ? 'ok' : 'warn');
          }
          function insert(kIn) {
            const k = kIn != null ? kIn : readKey(); if (k == null) return;
            inp.value = k;
            if (has(k)) { find(k); say(`${k} is already in the file (bucket ${k % B}). Keys are unique, so it was not added again.`, 'warn'); return; }
            const b = k % B;
            if (st.home[b].length >= CAP && ovCount() >= MAXOV) { st.calc = k; st.mark = null; draw(); say('The overflow area is full. A real system would now rebuild the file with more buckets.', 'warn'); return; }
            const r = put(k);
            st.calc = k; st.mark = { b, path: [{ k, n: r.ov ? 1 + st.chain[b].length : 1, cls: 'hit' }] }; draw();
            say(r.ov ? `${k} mod ${B} = ${b}, but bucket ${b} is full: a <span class="t">collision</span>. ${k} went to the overflow area, chained behind bucket ${b}. Finding it later costs <b>${1 + st.chain[b].length}</b> accesses instead of 1.`
              : `${k} mod ${B} = ${b}, and <span class="t">bucket</span> ${b} had a free slot, so ${k} was written there with 1 access. No searching, and no other record moved.`, r.ov ? 'warn' : 'ok');
          }
          function readAll() {
            st.mark = null; st.calc = null; draw();
            const order = st.home.flatMap((r, b) => r.concat(st.chain[b]));
            say(`Reading every bucket gives the records in this order: ${order.join(', ')}. That is hash order, not key order: to list the products by code you would have to read every bucket and then sort. A hashed file has no sequential order.`, '');
          }
          say('Type a product code and press <b>Find</b> or <b>Insert</b>, or use the quick buttons. Try inserting 3010 and 4704: both hash to a full bucket.', '');
          draw();
          const left = h('div', { class: 'stack', style: { gap: '9px' } },
            h('p', { class: 'm0', html: 'A <span class="t">direct file</span> (hashed file) needs no index and no search. A <span class="t">hash function</span> turns the key straight into a bucket number, and the disk can fetch any block whose address is known. Every record must have a key, and there is no order among records.' }),
            h('p', { class: 'm0 small', html: '<b>Collisions</b> are handled here by <b>overflow chaining</b>: each bucket is one block with room for ' + CAP + ' records; when it is full, the newcomer goes to a shared overflow area and is linked behind its bucket.' }),
            h('p', { class: 'm0 small muted', html: 'Best when records have a fixed length and are always fetched one at a time, fast: directories, price tables, schedules, name lists.' }),
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Code'), inp,
              h('button', { class: 'btn sm primary', type: 'button', onclick: () => find() }, 'Find'),
              h('button', { class: 'btn sm', type: 'button', onclick: () => insert() }, 'Insert'),
              h('button', { class: 'btn sm', type: 'button', onclick: readAll }, 'Read whole file'),
              h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': 'Reset', onclick: () => { fresh(); draw(); say('Back to the original eight products.', ''); } }, '↺')),
            h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted' }, 'Quick:'), ...QUICK.map(([op, k]) => h('button', { class: 'btn sm ' + (op === 'Insert' ? 'io' : ''), type: 'button', onclick: () => (op === 'Insert' ? insert(k) : find(k)) }, op + ' ' + k))),
            narr);
          const right = h('div', { class: 'card white stack', style: { gap: '10px' } }, calc, rows, h('div', { class: 'grow' }), fillLine);
          el.append(h('div', { class: 'split l fill' }, left, right));
        },
      },

      /* ---------------- 7. Compare the five, then choose for a job ---------------- */
      {
        title: 'Compare the five organizations, then choose',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const ORG = ['Pile', 'Sequential', 'Indexed sequential', 'Indexed', 'Direct (hashed)'];
          const COLS = [
            ['Space', 'Variable records', 'storing records whose length and fields vary'], ['Space', 'Fixed records', 'storing records that all have the same format'],
            ['Update', 'Same size', 'changing a record without changing its length'], ['Update', 'Larger', 'changing a record so that it grows'],
            ['Retrieval', 'One record', 'fetching a single record by its key'], ['Retrieval', 'Subset', 'fetching every record that meets a condition'], ['Retrieval', 'All records', 'processing every record in the file'],
          ];
          const R = { E: ['Excellent', 'r-e'], G: ['Good', 'r-g'], A: ['Adequate', 'r-a'], P: ['Poor', 'r-p'] };
          const T = [
            [['E', 'Each record stores only the fields it has, at their real length. The field names cost some bytes, but far less than reserving room for every possible field.'],
              ['A', 'When every record has the same fields, repeating every field name in every record is pure overhead that a fixed format avoids.'],
              ['E', 'Overwrite it where it is: same length, and no order, index or pointer depends on its position. (Finding it is the slow part, rated under One record.)'],
              ['G', 'Write the longer version at the end of the file and mark the old copy deleted; nothing else moves, but the dead copy wastes space until the file is compacted.'],
              ['P', 'Exhaustive search: about half the file on average, and each record must be parsed to find its key.'],
              ['P', 'Every record must be read and parsed to test the condition.'],
              ['A', 'One pass reads everything, but in arrival order, so key-order processing needs a sort first.']],
            [['P', 'Every record has the same fixed format, so a short record is padded to the longest size allowed.'],
              ['E', 'No field names, no pointers, no index: just records packed one after another.'],
              ['E', 'Same fixed length, so it is overwritten in its own slot and the key order is untouched (as long as the key itself does not change).'],
              ['P', 'A record cannot grow inside a fixed format; the format and the whole file would have to change.'],
              ['P', 'About N/2 accesses: half the file for every lookup.'],
              ['A', 'The whole file must be scanned, but the scan is fast and simple, and a key range can stop early.'],
              ['E', 'One smooth pass in key order: exactly what a batch job wants.']],
            [['P', 'The main file keeps the sequential file\'s fixed format.'],
              ['G', 'Compact records, plus some space for the index, the overflow file and a pointer in each record.'],
              ['E', 'Overwritten in place, in the main file or in overflow; the index lists only the first key of each block, so it does not change.'],
              ['P', 'The same fixed-format limit as a sequential file.'],
              ['G', 'The index jumps close to the record and only a short stretch is scanned: about √N accesses with a well-sized single-level index, fewer with more levels.'],
              ['A', 'A key range is found quickly through the index; a condition on any other field still needs a full scan.'],
              ['G', 'The main file is in key order, but overflow chains interrupt the smooth pass until the next reorganization.']],
            [['G', 'Records are stored at their real length wherever there is room; only the indexes add space.'],
              ['A', 'It works, but several indexes can take as much space as the data; a sequential file would be far more compact.'],
              ['G', 'Overwritten in place, but if a changed field has an index, that index entry must move to keep the index sorted.'],
              ['G', 'Write the bigger record somewhere else and update its pointer in each index: several writes, but no other record moves.'],
              ['E', 'A sorted exhaustive index, searched by halving it (binary search), points straight at the record.'],
              ['E', 'For a field that has an index, the index lists exactly the matching records.'],
              ['A', 'Read the records where they lie and they come in no useful order, as in a pile; follow an index for key order and the reads jump all over the disk.']],
            [['P', 'Bucket slots have a fixed size, so records of varying length do not fit the scheme.'],
              ['A', 'Buckets are kept partly empty so collisions stay rare; that spare room is the price of speed.'],
              ['E', 'Overwritten in its bucket slot; the key, and so the bucket, does not change.'],
              ['P', 'A slot has a fixed size; a record that grows no longer fits it.'],
              ['E', 'About one access, however large the file.'],
              ['P', 'Hashing scatters records, so any condition, even a key range, means reading every bucket.'],
              ['P', 'Every bucket, empty space included, must be read, and the records come out in hash order, not key order.']],
          ];
          function table(panel) {
            const info = h('div', { class: 'narr small cmp-info' });
            const cells = [];
            const pick = (r, c) => {
              cells.forEach((b) => b.classList.toggle('on', +b.dataset.r === r && +b.dataset.c === c));
              const [k, why] = T[r][c];
              info.innerHTML = `<b>${ORG[r]}</b> · ${COLS[c][0].toLowerCase()}, ${COLS[c][1].toLowerCase()} (${COLS[c][2]}): <span class="rt ${R[k][1]}">${R[k][0]}</span><br>${why}`;
            };
            const cellBtn = (r, ci) => {
              const [k] = T[r][ci];
              const b = h('button', { type: 'button', class: 'rt ' + R[k][1], 'data-r': r, 'data-c': ci, 'aria-label': `${ORG[r]}, ${COLS[ci][1]}: ${R[k][0]}`, onclick: () => pick(r, ci) }, R[k][0]);
              cells.push(b); return b;
            };
            let grid, start = () => pick(0, 4);
            if (ctx.narrow) {                                  // small screens: one organization at a time, its seven ratings as rows
              const list = h('table', { class: 'tbl compact cmp' });
              const orgBtns = ORG.map((o, r) => h('button', { class: 'btn sm', type: 'button', onclick: () => showOrg(r) }, o));
              const showOrg = (r) => {
                orgBtns.forEach((b, i) => b.classList.toggle('on', i === r));
                cells.length = 0;
                list.replaceChildren(h('tbody', {}, ...COLS.map((c, ci) => h('tr', {}, h('td', {}, c[0] + ' · ' + c[1].toLowerCase()), h('td', {}, cellBtn(r, ci))))));
                pick(r, 4);
              };
              grid = h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row gap-s' }, ...orgBtns), list);
              start = () => showOrg(0);
            } else {
              const head1 = h('tr', {}, h('th', {}, ''), h('th', { colspan: 2, class: 'cg' }, 'Space'), h('th', { colspan: 2, class: 'cg' }, 'Update'), h('th', { colspan: 3, class: 'cg' }, 'Retrieval'));
              const head2 = h('tr', {}, h('th', {}, 'Organization'), ...COLS.map((c) => h('th', {}, c[1])));
              const body = ORG.map((o, r) => h('tr', {}, h('td', { class: 'b' }, o), ...COLS.map((c, ci) => h('td', {}, cellBtn(r, ci)))));
              grid = h('table', { class: 'tbl compact cmp' }, h('thead', {}, head1, head2), h('tbody', {}, ...body));
            }
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'small m0 muted' }, 'Each rating compares the organizations on one job. Update ratings assume the record is already found (finding it is the One record column). Click one to see why.'),
              grid, info,
              h('div', { class: 'grid-2' },
                h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'No organization wins every column. Indexes buy fast lookups with space and update work; a plain sorted file buys compact storage and fast batch passes with slow single lookups.' }),
                h('div', { class: 'callout tip m0 small', 'data-label': 'How to use the table', html: 'Start from the job: which operations happen most often? Read those columns top to bottom and rule out any organization that is Poor at something the job needs.' }))));
            start();
          }
          const SC = [
            { t: 'A field biologist logs observations on a tablet. Each one has whatever fields made sense at the time (species, count, photo, weather), and nobody knows yet how the data will be analysed.', a: 0, hint: 'Look at the variable-records column, and ask whether any key or search field is known yet.',
              f: ['Data gathered before anyone organizes it, with records of varying shape: the pile\'s niche. Each record is simply stored as it comes.',
                'A fixed format would force every observation into the same fields and pad most of them, and there is no useful key to sort by yet.',
                'An index and a sort order pay off for repeated keyed lookups; nobody is looking anything up yet.',
                'Indexes need to know which fields people will search by, and that is still unknown.',
                'Hashing needs a key in every record and fixed-length records; these observations have neither.'] },
            { t: 'A utility company prints every customer\'s bill once a month, in account-number order. Nothing else ever reads the file.', a: 1, hint: 'Only one operation ever happens: processing all records, in key order.',
              f: ['Arrival order means sorting before every run; a file kept in key order avoids that.',
                'Every record processed once, in key order: a sequential file streams straight through with no index to maintain.',
                'No single account is ever looked up, so the index would be wasted space and upkeep.',
                'Several indexes for a file that is only read start to finish are pure overhead, and reading through an index hops around the disk.',
                'Hash order is not account order, and reading every bucket is a hashed file\'s weakest operation.'] },
            { t: 'A college processes its student file in student-ID order at the end of each term, but advisers also look up single students all day long.', a: 2, hint: 'Two operations matter: all records in key order, and one record by key.',
              f: ['Neither the ordered term-end run nor the single lookups would be served well.',
                'Fine for the term-end run, but every adviser lookup would scan half the file.',
                'Both patterns at once: the main file stays in ID order for the term-end run, and the index makes single lookups quick.',
                'Lookups would be quick, but the term-end pass would hop around the disk through the index instead of streaming through records already in order.',
                'Lookups by ID would be quick, but the ID-order run would need every bucket read and sorted.'] },
            { t: 'An airline booking system: agents search by passenger name, by flight and by frequent-flyer number, and every seat change must be visible at once.', a: 3, hint: 'Count the different fields people search by.',
              f: ['Every search would scan all bookings.',
                'Half the file per lookup, and new bookings would sit in a log until the next batch merge.',
                'One index on one key cannot answer searches by name, by flight and by frequent-flyer number.',
                'Several search fields and up-to-the-minute data: one index per field, and every record reached directly.',
                'A hash works on one key only; a search by flight or by name would read every bucket.'] },
            { t: 'A checkout scanner reads a barcode and must show that one product\'s price instantly. Prices are never listed in order.', a: 4, hint: 'Only one record at a time, by one key, as fast as possible.',
              f: ['An exhaustive search for every item scanned.',
                'Half the price list read for every beep at the register.',
                'Index plus scan costs more accesses than hashing straight to the bucket, and the key order is never used.',
                'It would work, but an index lookup adds steps that a hash avoids, and only one field is ever searched.',
                'One key, one record at a time, as fast as possible, fixed-length records: the hashed file\'s home ground.'] },
            { t: 'A parts warehouse: staff look parts up by part number, by supplier and by bin location, and stock counts change with every delivery.', a: 3, hint: 'Several search fields, and changes all day long.',
              f: ['Every lookup would read the whole file.',
                'Changes would wait for a batch merge, and every lookup would scan half the file.',
                'Only the part-number search would be quick; searches by supplier or bin would scan the file.',
                'Three fields to search by and constantly changing data: one index per field.',
                'Quick by part number only; the other two searches would read every bucket.'] },
          ];
          function chooser(panel) {
            let i = 0; const first = {};
            const card = h('div', { class: 'card white stack', style: { gap: '10px' } });
            const fb = h('div', { class: 'narr small', style: { minHeight: '64px' } });
            const score = h('span', { class: 'chip ok' });
            const nextBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { i = (i + 1) % SC.length; show(); } }, 'Next scenario →');
            const DESC = ['arrival order, no structure', 'fixed records sorted by key', 'sorted file + index + overflow', 'reached only through indexes', 'hash the key to a bucket'];
            const dots = SC.map((x, k) => h('button', { class: 'sdot', type: 'button', 'aria-label': 'Scenario ' + (k + 1), onclick: () => { i = k; show(); } }, String(k + 1)));
            const btns = ORG.map((o, k) => h('button', { class: 'obtn', type: 'button', onclick: () => answer(k) }, h('b', {}, o), h('span', { class: 'xs muted' }, DESC[k])));
            function show() {
              btns.forEach((b) => { b.classList.remove('good', 'wrong'); });
              dots.forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('ok', first[k] === true); d.classList.toggle('bad', first[k] === false); });
              card.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'row gap-s' }, h('h4', { class: 'm0' }, `Scenario ${i + 1} of ${SC.length}`), ...dots), score),
                h('p', { class: 'm0 lead' }, SC[i].t), ctx.ui.reveal('Hint', `<p class="small m0 muted">${SC[i].hint}</p>`));
              fb.className = 'narr small'; fb.innerHTML = 'Which organization fits this job best? Choose one.';
              upd();
            }
            function upd() { const done = Object.keys(first).length; score.textContent = `right first time: ${Object.values(first).filter(Boolean).length} of ${done}`; }
            function answer(k) {
              const sc = SC[i], ok = k === sc.a;
              if (!(i in first)) first[i] = ok;
              btns[k].classList.add(ok ? 'good' : 'wrong');
              dots[i].classList.toggle('ok', first[i] === true); dots[i].classList.toggle('bad', first[i] === false);
              fb.className = 'narr small ' + (ok ? 'ok' : 'bad');
              fb.innerHTML = (ok ? '<b>Yes.</b> ' : `<b>Not the best fit.</b> `) + sc.f[k] + (ok ? '' : ' Try another.');
              upd();
            }
            show();
            panel.append(h('div', { class: 'stack', style: { gap: '12px' } }, card, h('div', { class: 'obtns' + (ctx.narrow ? ' slim' : '') }, ...btns), fb, h('div', { class: 'row' }, nextBtn)));
          }
          el.append(h('div', { class: 'fill' }, ctx.ui.tabs([{ label: 'Ratings table', render: table }, { label: 'Pick the organization', render: chooser }])));
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: five organizations in six cards',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say the answer to yourself first, then click a card to check it.'),
            ctx.ui.flipcards([
              ['<b>Pile</b><br><span class="small muted">How are records kept, and how is one found?</span>', 'In arrival order, with varied lengths and fields, each field named. A lookup is an exhaustive search. Good for data collected before it is organized.'],
              ['<b>Sequential file</b><br><span class="small muted">Strength, weakness, and where do new records go?</span>', 'Fixed-format records sorted by a key field: ideal for batch runs over every record, but a lookup averages N/2. New records wait in a log file for a batch merge.'],
              ['<b>Indexed sequential file</b><br><span class="small muted">What two things are added, and what does a search cost?</span>', 'An index and an overflow file. Find the highest index key ≤ the target, then scan. Read entry by entry: about I/2 + N/(2I) accesses, least near I = √N. Reorganize to merge the overflow.'],
              ['<b>Indexed file</b><br><span class="small muted">How are records reached?</span>', 'Only through indexes, one per search field; records have no order and may vary in length. Exhaustive index: every record. Partial index: only records with the field.'],
              ['<b>Direct (hashed) file</b><br><span class="small muted">How fast, and what is lost?</span>', 'Hashing the key picks the bucket: about one access, whatever the size. Collisions go to overflow. There is no key order; best for fixed records fetched one at a time.'],
              ['<b>Choosing</b><br><span class="small muted">What decides the organization?</span>', 'How the file is used. Weigh short access time, ease of update, economy of storage, simple maintenance and reliability for that job.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 215 })));
        },
      },

      /* ---------------- 9. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In an indexed sequential file, where does a newly added record go?',
            choices: ['Into its place in the main file, shifting the later records along', 'Into the overflow file, linked from its predecessor in key order', 'At the end of the main file, after which the index is re-sorted', 'Into a separate log file that is merged in at the next batch run'], answer: 1,
            feedback: ['Shifting records would mean rewriting much of the main file on every insert; the main file is left alone until reorganization.', null, 'The main file stays in key order; appending out of order would break the scan that follows the index.', 'That is how a plain sequential file collects additions. An indexed sequential file instead links each new record into its overflow file, where searches find it by following pointers.'],
            why: 'The new record is written to the overflow file, and the record just before it in key order gets a pointer to it, so the main file and the index never move until the next reorganization.' },
          { type: 'num', q: 'A sequential file holds 200,000 records in key order. A lookup reads records one by one from the start. About how many records does it examine, on average, to find a record that is in the file?', answer: 100000, tol: 500, unit: 'records',
            why: 'Every position is equally likely, so on average the search goes halfway: about N/2 = 200,000 / 2 = 100,000 records.' },
          { type: 'num', q: 'A file of 160,000 records has a single-level index of 400 entries, each covering an equal stretch of the file. Using the estimate I/2 + S/2 (S = records per index entry), about how many accesses does an average successful search take?', answer: 400, tol: 5, unit: 'accesses',
            why: 'Each entry covers S = 160,000 / 400 = 400 records. Half the index plus half a stretch: 400/2 + 400/2 = 200 + 200 = 400, compared with 80,000 without the index. (Also counting the index entry read just past the target gives about 402.)' },
          { type: 'num', q: 'A hashed file has 7 buckets numbered 0 to 6 and uses h(key) = key mod 7. Which bucket does the record with key 1234 go to?', answer: 2, tol: 0,
            why: '1234 = 7 × 176 + 2, so the remainder is 2 and the record belongs in bucket 2.' },
          { type: 'tf', q: 'A partial index has an entry for every record in the file.', answer: false,
            why: 'That is an exhaustive index. A partial index has entries only for the records that contain the field of interest.' },
          { type: 'match', q: 'Match each organization with the job it fits best.',
            pairs: [['Pile', 'Data collected before anyone knows how it will be organized'], ['Sequential file', 'A monthly batch run over every record in key order'], ['Indexed sequential file', 'A key-order batch run plus quick lookups by key'], ['Indexed file', 'Searches on several fields with up-to-the-minute data'], ['Direct (hashed) file', 'One product\'s price, by barcode, instantly']],
            why: 'Each organization is chosen for its access pattern: unknown structure, full passes, passes plus lookups, many search fields, or single-key speed.' },
          { type: 'bucket', q: 'Which organization does each statement describe?', buckets: ['Pile', 'Sequential file', 'Direct (hashed) file'],
            items: [['Each field carries its own name', 0], ['Records may differ in length and in which fields they have', 0], ['Every record has the same fields in the same order', 1], ['New records wait in a log file for a batch merge', 1], ['A record\'s position is computed from its key', 2], ['A full bucket sends the newcomer to an overflow area', 2]],
            why: 'Self-describing, varied records make a pile; fixed records in key order with a log make a sequential file; computing the location from the key makes a hashed file.' },
          { type: 'order', q: 'Put the steps of finding a record in an indexed sequential file in order.',
            items: ['Compare the target with index entries until one is larger than it', 'Take the entry just before that one: the highest key ≤ the target', 'Jump to the main-file position that entry points to', 'Scan forward, following any overflow chain, until the target or a larger key appears'],
            why: 'The index cuts the search down to one stretch of the file; the scan then finishes the job, detouring through overflow records that sit between main-file records in key order.' },
          { type: 'multi', q: 'Which statements about an indexed file are true?',
            choices: ['Records may be variable in length', 'Records are kept physically sorted by one key field', 'Adding a record means updating every index whose field it has', 'A partial index skips records that lack the indexed field', 'Reading every record is its strongest operation'], answer: [0, 2, 3],
            why: 'An indexed file has no physical order and allows variable-length records; every applicable index must be updated on an insert; and a full pass through scattered records is one of its weaker operations.' },
          { q: 'Which criterion drops out of the decision entirely for a file that is written once to media that can never be rewritten?',
            choices: ['Ease of update', 'Short access time', 'Economy of storage', 'Reliability'], answer: 0,
            feedback: [null, 'Someone will still read the archive, so access time still counts, even if only a little.', 'Space on the media is fixed, so packing records tightly matters a lot.', 'Write-once archives are often the only copy, so reliability is critical.'],
            why: 'Records on write-once media are never changed, so ease of update drops out of the decision entirely.' },
          { q: 'A single-level index covers a file of N records. A search reads the index entry by entry, then reads the chosen stretch of the file record by record. Which index size gives the fewest accesses on average?',
            choices: ['One entry per record (N entries)', 'About log₂ N entries', 'About N/2 entries', 'About √N entries'], answer: 3,
            feedback: ['Then the index itself is as long as the file, and scanning half of it costs about N/2.', 'A tiny index leaves huge stretches of file to scan, about N/(2 log₂ N) records each time.', 'An index that large costs about N/4 to scan, far more than needed.', null],
            why: 'The cost is about I/2 + N/(2I). Growing the index shrinks the stretches and the other way round; the sum is smallest when I/2 = N/(2I), that is I = √N, giving about √N accesses. (An index searched by halving it instead would favour a bigger index.)' },
          { q: 'Why does a sequential file collect new records in a separate log file instead of inserting them directly?',
            choices: ['A log file stores each record in less space than the main file', 'The log is kept sorted, so every search checks it before the main file', 'Placing each one in key order would mean rewriting much of the file', 'Records in the log are complete, so they never need to be merged in'], answer: 2,
            feedback: ['The records take the same space; the log exists to avoid rewriting the file.', 'A log usually holds records in arrival order, and searches must check it as well as the main file.', null, 'The log is merged into the main file in the next batch update.'],
            why: 'Keeping the main file in key order would force every insert to move the records after it. Collecting additions and merging them in one batch pass is far cheaper.' },
        ],
      },
    ],
    notes: `
      <h3>File organization</h3>
      <p>A <b>file organization</b> is the logical arrangement of a file's records: their order, any indexes, and where new records go. It is chosen to match how the records will be accessed. Five criteria are weighed:</p>
      <ul>
        <li><b>Short access time</b>: reach the one record you want quickly.</li>
        <li><b>Ease of update</b>: add, change and delete records with little work.</li>
        <li><b>Economy of storage</b>: no wasted padding, duplicate copies or bulky extras.</li>
        <li><b>Simple maintenance</b>: few structures to keep in step or rebuild.</li>
        <li><b>Reliability</b>: records survive crashes and mistakes intact.</li>
      </ul>
      <p>Their priority depends on the use: a batch file read start to finish hardly cares about fast single lookups; an online file read one record at a time cares a great deal; a write-once file is never updated. The criteria also pull against each other: an index buys access time with extra storage and extra update work.</p>

      <h3>The pile</h3>
      <p>Records are kept in the order they arrive. They may differ in length and in which fields they have, so each field describes itself (name and value). There is no structure, so finding a record is an <b>exhaustive search</b> through the file, parsing each record to find its key. A pile suits data gathered before anyone organizes it, or data that is hard to organize, and it uses space well when records vary.</p>

      <h3>The sequential file</h3>
      <p>Every record has the same fixed format (same fields, same order, same length) and the records are stored in order of a <b>key field</b>. No field names are stored. A full pass in key order is fast, which suits batch jobs that process every record. A single lookup is poor: scanning from the start reads on average <b>N/2</b> records (exactly (N + 1)/2 for a key that is present; 500,000 for 1,000,000 records). Inserting in key order would mean moving every later record, so additions go to a separate <b>log file</b> (transaction file) and are merged into the main file in a periodic <b>batch update</b> that writes a fresh copy. Until the merge, a lookup must check the log too. A variant keeps the records as a linked list in key order, so an insert only relinks pointers, at the price of following pointers on every scan.</p>

      <h3>The indexed sequential file</h3>
      <p>A sequential file plus two additions:</p>
      <ul>
        <li>An <b>index</b> holding the first key of each stretch (block) of the file and a pointer to it. To find a key, scan the index for the highest entry ≤ the key, jump to that place in the main file, and scan forward.</li>
        <li>An <b>overflow file</b>. A new record is written there, and the record just before it in key order (in the main file or already in overflow) gets a pointer to it; the new record takes over that record's old pointer. The main file and index never move. A scan follows each chain and then returns to the main file. Long chains slow searches, so the file is periodically <b>reorganized</b>: overflow records are merged in key order and the index is rebuilt, so no search detours through overflow (a file that has grown also gets a longer index).</li>
      </ul>
      <p>A <b>multilevel index</b> treats the lowest index as a sequential file and builds a smaller index over it.</p>
      <p><b>Cost.</b> Counting every index entry or record compared as one access, and reading each index entry by entry, a search costs about half of each level plus half of the stretch of file it ends in:</p>
      <ul>
        <li>One level with I entries over N records (S = N/I per entry): about I/2 + S/2. With N = 1,000,000 and I = 1,000: 500 + 500 = 1,000 accesses, instead of 500,000.</li>
        <li>The sum is smallest when I = √N, giving about √N accesses.</li>
        <li>Two levels, U top entries over L lower entries: about U/2 + (L/U)/2 + (N/L)/2. With U = 100 and L = 10,000: 50 + 50 + 50 = 150. With U = 10 and L = 1,000: 5 + 50 + 500 = 555.</li>
      </ul>
      <p>These are estimates. An index scan learns it has gone far enough only by reading the first entry past the target, and the cost lab counts that read too: about one extra access per index level. Averaged over every key, the exact counts are 1,002 (not 1,000), 153.5 (not 150) and 558.4 (not 555); the lab's 300 random searches add a little sampling noise on top. Real systems read whole blocks, keep top index levels in memory and search a sorted index by halving it (binary search, about log₂ I steps), so disk reads are far fewer, but the ranking is the same.</p>

      <h3>The indexed file</h3>
      <p>The sorted order and the single key are dropped. Records go wherever there is room, may vary in length, and are reached <b>only through indexes</b>, usually one for each field people search by. An <b>exhaustive index</b> has one entry for every record; a <b>partial index</b> has entries only for records that contain the field. Each index is kept sorted so it can be searched quickly, by halving it (binary search) or through a tree of index levels, never entry by entry. Adding a record means updating every index whose field the record has. Indexed files suit jobs where data must be current and is searched many ways but rarely processed in full: airline reservations, inventory control.</p>

      <h3>The direct (hashed) file</h3>
      <p>A <b>hash function</b> turns the key straight into the address of a block, called a <b>bucket</b>, and the disk can read any block whose address is known, so a lookup takes about one access whatever the file size. Every record needs a key, and there is no sequential order. Two keys that hash to the same bucket cause a <b>collision</b>; the answer used here gives each bucket a few slots and, when it is full, chains the newcomer into an overflow area behind its bucket (one extra access per chain record). Example with 7 buckets and h(key) = key mod 7: 1234 = 7 × 176 + 2 goes to bucket 2; 2051 and 6608 both give 0 and fill bucket 0, so 3010 (also 0) goes to overflow and costs 2 accesses to find. A key that is absent is ruled out after reading just its bucket and chain. In the cost lab every record compared along a bucket's chain counts as one access, so with an average of α records per bucket a successful search costs about 1 + α/2 (1.5 at one record per bucket). Listing records in key order needs every bucket read and then a sort. Hashed files suit fixed-length records fetched one at a time and fast: directories, price tables, schedules, name lists.</p>

      <h3>Comparing the five</h3>
      <table>
        <tr><th></th><th>Space: variable</th><th>Space: fixed</th><th>Update: same size</th><th>Update: larger</th><th>One record</th><th>Subset</th><th>All records</th></tr>
        <tr><td>Pile</td><td>Excellent</td><td>Adequate</td><td>Excellent</td><td>Good</td><td>Poor</td><td>Poor</td><td>Adequate</td></tr>
        <tr><td>Sequential</td><td>Poor</td><td>Excellent</td><td>Excellent</td><td>Poor</td><td>Poor</td><td>Adequate</td><td>Excellent</td></tr>
        <tr><td>Indexed sequential</td><td>Poor</td><td>Good</td><td>Excellent</td><td>Poor</td><td>Good</td><td>Adequate</td><td>Good</td></tr>
        <tr><td>Indexed</td><td>Good</td><td>Adequate</td><td>Good</td><td>Good</td><td>Excellent</td><td>Excellent</td><td>Adequate</td></tr>
        <tr><td>Direct (hashed)</td><td>Poor</td><td>Adequate</td><td>Excellent</td><td>Poor</td><td>Excellent</td><td>Poor</td><td>Poor</td></tr>
      </table>
      <p>Each column compares the five on one job; the update columns assume the record has already been found. Why: the pile stores only the fields a record has but repeats field names; fixed formats pad short records and cannot let one grow; a same-size change is overwritten in place everywhere, though an indexed file must also move the entry of any changed indexed field; a larger record goes to the end of a pile (leaving a dead copy), or anywhere in an indexed file with each index pointer updated; indexes point straight at matching records, but a full pass through an indexed file either comes out in no order or hops around the disk; hashing finds one record in about one access but scatters records, so subsets and full passes read every bucket.</p>

      <h3>Choosing</h3>
      <ul>
        <li>Data gathered before its structure is known: <b>pile</b>.</li>
        <li>A batch run over every record in key order and little else (monthly billing): <b>sequential</b>.</li>
        <li>Key-order batch runs plus single lookups by key (a student file): <b>indexed sequential</b>.</li>
        <li>Searches on several fields with up-to-the-minute data (airline bookings, a parts warehouse): <b>indexed</b>.</li>
        <li>One record by one key, as fast as possible (price lookup at a checkout): <b>direct (hashed)</b>.</li>
      </ul>
`,
  });
})();
