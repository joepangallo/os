// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   8.3 UNIX and Solaris Memory Management
   Original teaching material. The pure models (no DOM) sit first, between the
   models:start and models:end markers, so every number a student sees comes
   from the same code that draws the simulations. Helpers stay inside this IIFE
   so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away (an IIFE), so its names stay private to this file
/* models:start */
  // ---------- 1. The four SVR4 paging tables (two processes right after fork) ----------
  // Q is P's child, created by fork() a moment ago. Page 0 is code, 1 is data in memory, 2 is data that
  // was paged out, 3 is a heap page never touched yet. Reference counts are COUNTED from these rows.
  const T4_PT = ['P', 'Q'].flatMap((p) => [  // T4_PT: the page table entries of parent P and child Q; flatMap builds the same four rows for each and joins them into one list
    { p, v: 0, f: 0, cow: 0, prot: 'RO', dev: 2, blk: 870, type: 'file' },  // page 0 (code): in frame 0, read-only, not copy on write; its disk copy is block 870 of the program file on device 2
    { p, v: 1, f: 1, cow: 1, prot: 'RW', dev: 1, blk: 120, type: 'swap' },  // page 1 (data): in frame 1, writable but marked copy on write; its disk copy is page 120 of swap device 1
    { p, v: 2, f: null, cow: 1, prot: 'RW', dev: 1, blk: 121, type: 'swap' },  // page 2 (data): paged out, so no frame (null); still copy on write, and it lives only on swap page 121
    { p, v: 3, f: null, cow: 0, prot: 'RW', dev: null, blk: null, type: 'zero' },  // page 3 (heap): never touched, so no frame and no disk copy; type zero means "fill with zeros on first use"
  ]);  // closes the four rows and the flatMap, so T4_PT holds 8 entries: 4 for P, then the same 4 for Q
  const T4_FR = [  // T4_FR: the page frame data table, one row per physical frame: its state, its disk copy, and whether it is on the free list and a hash queue
    { f: 0, state: 'file', dev: 2, blk: 870, free: false, hashed: true },  // frame 0 holds the code page read from file block 870; in use, and hashed so a later fault can find it
    { f: 1, state: 'swap', dev: 1, blk: 120, free: false, hashed: true },  // frame 1 holds the data page whose disk copy is swap page 120; in use
    { f: 2, state: 'swap', dev: 1, blk: 121, free: true, hashed: true },  // frame 2 is on the free list but still holds swap page 121 and stays hashed, so a fault on page 2 can reclaim it without a disk read
    { f: 3, state: 'avail', dev: null, blk: null, free: true, hashed: false },  // frame 3 is empty ('avail'): free, with no disk copy and on no hash queue
  ];  // closes the frame table
  const T4_SW = [120, 121, 122];                                     // pages of swap device 1 shown in its swap-use table
  const t4FrameRefs = (f) => T4_PT.filter((e) => e.f === f).length;  // processes whose valid PTE points at frame f
  const t4SwapRefs = (blk) => T4_PT.filter((e) => e.type === 'swap' && e.dev === 1 && e.blk === blk).length;  // PTEs (via their DBDs) that point at swap page blk
  const t4FreeList = () => T4_FR.filter((r) => r.free).map((r) => r.f).sort((a, b) => b - a);  // head first: empty frames are reused before ones that still hold a page

  // ---------- 2. fork() and copy on write ----------
  const COW_PAGES = [{ name: 'code', w: false }, { name: 'data', w: true }, { name: 'heap', w: true }, { name: 'stack', w: true }];  // COW_PAGES: the four pages of the copy-on-write demo; w marks the ones the process may write (code may not)
  const COW_NF = 8;                                                  // physical frames in the demo
  function cowNew() {  // cowNew(): the starting state of the copy-on-write demo, the parent alone before fork()
    return { refs: [1, 1, 1, 1, 0, 0, 0, 0], P: COW_PAGES.map((pg, i) => ({ frame: i, cow: false, mod: false })), C: null, child: 'none', copies: 0 };  // refs counts the users of each of the 8 frames (the parent's pages sit in frames 0-3); P is the parent's page table, C the child's (none yet)
  }  // ends cowNew
  function cowFork(st) {                                             // child gets copies of the PTEs, not of the pages
    if (st.child !== 'none') return { k: 'nofork' };  // only one fork per run: once a child exists (or has exec'd) the request is refused with the reason 'nofork'
    st.C = st.P.map((e) => ({ frame: e.frame, cow: false, mod: false }));  // the child's page table: a copy of every parent entry, pointing at the very same frames
    COW_PAGES.forEach((pg, i) => { st.refs[st.P[i].frame]++; if (pg.w) { st.P[i].cow = true; st.C[i].cow = true; } });  // each shared frame gains one user; every writable page is marked copy on write in both tables, code stays plain read-only
    st.child = 'live';  // records that the child now exists
    return { k: 'fork', shared: COW_PAGES.length, marked: COW_PAGES.filter((pg) => pg.w).length };  // reports the fork: how many pages are now shared and how many got the copy-on-write mark
  }  // ends cowFork
  function cowWrite(st, who, i) {  // cowWrite(st, who, i): process who ('P' or 'C') writes to its page i; the result says what the kernel had to do
    const tab = who === 'P' ? st.P : st.C;  // tab is the writer's page table, the parent's or the child's
    if (!tab) return { k: 'nochild' };  // no child table means there is no child (never forked, or it exec'd): there is nothing to write to
    const e = tab[i];  // e is the writer's page table entry for page i
    if (!COW_PAGES[i].w) return { k: 'prot', frame: e.frame };      // protect bit says read-only: no copy, an error
    if (!e.cow) { e.mod = true; return { k: 'plain', frame: e.frame }; }  // a page without the copy-on-write mark already belongs to the writer alone: write in place and mark it modified
    if (st.refs[e.frame] > 1) {                                      // still shared: copy it for the writer only
      const nf = st.refs.indexOf(0);  // nf: the first frame nobody uses (reference count 0); it will receive the private copy
      if (nf < 0) return { k: 'nomem' };  // no empty frame left, so the copy cannot be made; reported as 'nomem'
      const from = e.frame;  // from remembers the shared frame being copied
      st.refs[from]--; st.refs[nf] = 1;  // the old frame loses one user; the new frame has exactly one, the writer
      e.frame = nf; e.cow = false; e.mod = true; st.copies++;  // the writer's entry now points at its own copy: no longer copy on write, modified, and the copy counter goes up
      return { k: 'copy', from, to: nf, left: st.refs[from] };  // reports the copy: source frame, destination frame, and how many users the old frame still has
    }  // ends the still-shared case
    e.cow = false; e.mod = true;                                     // last user of the frame: just clear the bit
    return { k: 'last', frame: e.frame };  // reports that no copy was needed because the writer was the frame's last user
  }  // ends cowWrite
  function cowExec(st) {                                             // child replaces its whole address space
    if (st.child !== 'live') return { k: 'noexec' };  // exec is only possible while the child is alive and has not exec'd already
    const freed = [];  // freed will list the frames that no one uses any more
    st.C.forEach((e) => { st.refs[e.frame]--; if (st.refs[e.frame] === 0) freed.push(e.frame); });  // drops the child's claim on each of its frames; a frame whose count reaches 0 becomes free
    st.C = null; st.child = 'exec';  // the child now has none of the old pages, and the state records that it has exec'd
    return { k: 'exec', freed };  // reports the exec and the list of frames it freed
  }  // ends cowExec

  // ---------- 3. The two-handed clock ----------
  // 16 frames in a ring. Each page has a use pattern: touched every `every` ms starting at phase `ph`.
  const CLK_CAT = { hot: { every: 1000, label: 'hot', name: 'used every 1 s' }, warm: { every: 3000, label: 'warm', name: 'used every 3 s' },  // CLK_CAT: the four kinds of page in the clock demo: how often each is used (every, in ms) and its labels; hot and warm here
    cool: { every: 8000, label: 'cool', name: 'used every 8 s' }, idle: { every: 0, label: 'idle', name: 'never used again' } };  // the other two kinds: cool (used every 8 s) and idle (every 0, meaning never used again); closes CLK_CAT
  const CLK_PAGES = [['hot', 0], ['warm', 500], ['idle', 0], ['cool', 2000], ['hot', 250], ['cool', 6000], ['warm', 1500], ['idle', 0],  // CLK_PAGES: the 16 pages in ring order, each written [kind, phase]; the phase is the first moment (ms) the page is used
    ['hot', 500], ['warm', 2500], ['cool', 4000], ['idle', 0], ['hot', 750], ['idle', 0], ['warm', 1000], ['cool', 0]];  // the second half of the ring; closes the list
  const CLK_N = CLK_PAGES.length;  // CLK_N: the number of frames in the ring (16)
  function clkNew() {  // clkNew(): the starting state of the clock demo
    const by = () => ({ hot: 0, warm: 0, cool: 0, idle: 0 });  // by(): a fresh set of counters, one per kind of page, used to break the totals down by kind
    return { pages: CLK_PAGES.map(([cat, ph], i) => ({ i, cat, ph, R: 1, inMem: true })), back: 0, t: 0, ticks: 0, freed: 0, faults: 0, freedBy: by(), faultBy: by() };  // every page starts in memory with its reference bit R set; back hand at frame 0, time 0 ms, all counters zero
  }  // ends clkNew
  function clkTouchedIn(p, t0, t1) {                                // does the program use page p at some time in (t0, t1] ?
    const T = CLK_CAT[p.cat].every;  // T: how often this page is used, in ms
    if (!T) return false;  // an idle page (T is 0) is never used again
    const next = t0 < p.ph ? p.ph : p.ph + T * (Math.floor((t0 - p.ph) / T) + 1);  // next: the first use after t0: the phase if that is still ahead, otherwise the next multiple of T after the phase
    return next <= t1;  // true when that use falls inside the slice of time that ends at t1
  }  // ends clkTouchedIn
  function clkTouch(st, i) {                                         // the program uses page i: reference bit set; a freed page faults back in
    const p = st.pages[i];  // p is the page being used
    let fault = false;  // fault will record whether this use found the page paged out
    if (!p.inMem) { p.inMem = true; st.faults++; st.faultBy[p.cat]++; fault = true; }  // a page the clock freed must be brought back: it is in memory again and counts as a page fault, in total and for its kind
    p.R = 1;  // sets the reference bit, as the hardware does on every use of a page
    return fault;  // tells the caller whether this use caused a fault
  }  // ends clkTouch
  function clkTick(st, hs, sr) {                                     // one move of both hands; dt = 1000/sr ms of simulated time
    const dt = 1000 / sr, t1 = st.t + dt, faulted = [];  // dt: the simulated time one move takes; t1 is when it ends; faulted collects the pages that had to fault back in
    st.pages.forEach((p) => { if (clkTouchedIn(p, st.t, t1) && clkTouch(st, p.i)) faulted.push(p.i); });  // first the running program uses every page whose time comes inside this slice; pages that fault are noted
    st.t = t1; st.ticks++;  // moves the simulated time forward and counts the move
    st.back = (st.back + 1) % CLK_N;  // the back hand moves one frame forward, wrapping from frame 15 back to 0
    const front = (st.back + hs) % CLK_N, pf = st.pages[front], pb = st.pages[st.back];  // the front hand is handspread (hs) frames ahead of the back hand; pf and pb are the pages under the front and back hands
    const ev = { front, back: st.back, faulted, cleared: pf.inMem, frontWas: pf.R, result: 'skip' };  // ev describes this move for the display: both hand positions, the faults, and the front page's bit before clearing; result starts as 'skip'
    if (pf.inMem) pf.R = 0;  // the front hand clears the reference bit of its page, if that page is in memory
    if (pb.inMem) {  // the back hand only judges a page that is in memory
      if (pb.R === 0) { pb.inMem = false; st.freed++; st.freedBy[pb.cat]++; ev.result = 'freed'; } else ev.result = 'kept';  // a bit still 0 means the page was not used since the front hand passed: it is paged out and counted; a bit of 1 means it is kept
    }  // ends the back hand's check
    return ev;  // hands the description of this move to the display
  }  // ends clkTick

  // ---------- 4. How fast the hands move ----------
  const SCAN = { lotsfree: 4000, minfree: 1000, slowscan: 100, fastscan: 1000 };   // pages, pages, pages/s, pages/s
  function scanRate(free) {  // scanRate(free): how many pages per second the hands move when this many pages are free
    if (free >= SCAN.lotsfree) return 0;                             // plenty of memory: the page daemon sleeps
    if (free <= SCAN.minfree) return SCAN.fastscan;  // at or below minfree memory is critically short, so the hands move at full speed (fastscan)
    return SCAN.slowscan + (SCAN.fastscan - SCAN.slowscan) * (SCAN.lotsfree - free) / (SCAN.lotsfree - SCAN.minfree);  // in between, the speed rises in a straight line from slowscan at lotsfree to fastscan at minfree
  }  // ends scanRate

  // ---------- 5. Lazy and eager buddy allocators ----------
  // A block is { addr, size, st, t, label }. st: 'alloc' (given to a caller), 'split' (cut in two; counts as in use
  // at its own size), 'local' (locally free, lazy only), 'global' (free and allowed to merge with its buddy).
  const BUD_TOTAL = 256, BUD_MIN = 32, BUD_SIZES = [32, 64, 128, 256];  // the buddy demo's sizes: a 256-byte pool, 32 bytes the smallest block, and the four block sizes that exist
  function budNew(lazy) { return { lazy, blocks: [{ addr: 0, size: BUD_TOTAL, st: 'global', t: 0, label: '' }], splits: 0, merges: 0, clock: 0 }; }  // budNew(lazy): a fresh allocator, lazy or eager, holding one globally free 256-byte block; splits, merges and the clock start at 0
  function budClone(m) { return { lazy: m.lazy, blocks: m.blocks.map((b) => Object.assign({}, b)), splits: m.splits, merges: m.merges, clock: m.clock }; }  // budClone(m): a full copy of an allocator, so each animation frame keeps its own snapshot that later changes cannot touch
  function budCounts(m, size) {                                      // N = A + G + L; slack D = A - L
    const at = m.blocks.filter((b) => b.size === size);  // at: every block of this size, whatever its state
    const A = at.filter((b) => b.st === 'alloc' || b.st === 'split').length, L = at.filter((b) => b.st === 'local').length, G = at.filter((b) => b.st === 'global').length;  // A counts the blocks in use (given out, or split into halves), L the locally free ones, G the globally free ones
    return { N: at.length, A, G, L, D: A - L };  // returns all the counts plus the slack D = A - L, which decides what a free does in the lazy system
  }  // ends budCounts
  const budLeaves = (m) => m.blocks.filter((b) => b.st !== 'split').sort((a, b) => a.addr - b.addr);  // budLeaves(m): the blocks that are not split, in address order: exactly the pieces drawn across the memory strip
  function budObtain(m, size, ev) {  // budObtain(m, size, ev): finds or makes a free block of this size, records each move in ev, and returns the block (or null)
    const pick = (st) => m.blocks.filter((b) => b.size === size && b.st === st);  // pick(st): every block of this size in state st
    const D0 = budCounts(m, size).D;  // D0: the slack for this size before the request, kept for the explanation
    let b = null, how = '';  // b will be the block handed out; how records where it came from
    const loc = m.lazy ? pick('local') : [];  // loc: the locally free blocks of this size (the eager allocator has none)
    if (loc.length) { b = loc.reduce((x, y) => (y.t > x.t ? y : x)); how = 'local'; }   // most recently freed first
    else { const gl = pick('global'); if (gl.length) { b = gl.reduce((x, y) => (y.addr < x.addr ? y : x)); how = 'global'; } }  // otherwise a globally free block of this size is used, the one with the lowest address
    if (b) { b.st = 'alloc'; ev.push({ k: 'take', how, size, addr: b.addr, D0, D1: budCounts(m, size).D }); return b; }  // found one: it is marked given out, the move is recorded with the slack before and after, and the block is returned
    if (size >= BUD_TOTAL) return null;  // nothing free and this is already the whole pool: the request fails
    const p = budObtain(m, size * 2, ev);  // asks for a block twice the size (the same search, one size up), which may itself split something bigger
    if (!p) return null;  // none of that size could be found either: the request fails
    p.st = 'split'; m.splits++;  // the bigger block is marked split, and the split counter goes up
    m.blocks.push({ addr: p.addr, size, st: 'alloc', t: 0, label: '' }, { addr: p.addr + size, size, st: m.lazy ? 'local' : 'global', t: ++m.clock, label: '' });  // its two halves join the list: the lower half is given out, the upper half is free (locally in the lazy system, globally in the eager one)
    ev.push({ k: 'split', size: size * 2, addr: p.addr, D0, D1: budCounts(m, size).D });  // records the split, with the slack of the smaller size before and after
    return m.blocks[m.blocks.length - 2];  // returns the lower half, the second-to-last block just added
  }  // ends budObtain
  function budGlobal(m, b, ev) {                                     // mark b globally free; merge upward while the buddy is globally free
    b.st = 'global'; b.label = '';  // the block is now globally free and loses its caller's label
    const bud = m.blocks.find((y) => y !== b && y.size === b.size && y.addr === (b.addr ^ b.size) && y.st === 'global');  // bud: its buddy, the same-size block at address addr XOR size (the other half of the same parent), if it is globally free too
    if (!bud) return;  // if the buddy is not globally free, the block simply waits
    m.blocks = m.blocks.filter((y) => y !== b && y !== bud);  // both halves leave the list...
    m.merges++;  // ...and the merge counter goes up
    const parent = m.blocks.find((y) => y.size === b.size * 2 && y.addr === Math.min(b.addr, bud.addr) && y.st === 'split');  // parent: the split block they were cut from, twice their size at the lower of the two addresses
    ev.push({ k: 'merge', size: b.size, addr: parent.addr });  // records the merge for the explanation
    budRelease(m, parent, ev);                                       // the rebuilt parent is itself being freed at its size
  }  // ends budGlobal
  function budRelease(m, b, ev) {  // budRelease(m, b, ev): frees block b, following the lazy rules or the eager ones
    if (!m.lazy) { budGlobal(m, b, ev); return; }  // eager allocator: every freed block is globally free at once and merges whenever it can
    const D0 = budCounts(m, b.size).D;  // D0: the slack for this size, read before the block is freed
    if (D0 >= 2) { b.st = 'local'; b.t = ++m.clock; b.label = ''; ev.push({ k: 'local', size: b.size, addr: b.addr, D0, D1: budCounts(m, b.size).D }); return; }  // slack 2 or more: the block is locally free and kept for reuse at this size, with no merge; the move is recorded and the free ends here
    ev.push({ k: D0 === 1 ? 'global1' : 'global0', size: b.size, addr: b.addr, D0 });  // slack 1 or less: the block becomes globally free; the event says which of the two cases (1, or 0 and below) applied
    budGlobal(m, b, ev);  // marks it globally free and merges it with its buddy when possible
    if (D0 <= 0) {                                                   // also turn one locally free block of this size global
      const loc = m.blocks.filter((x) => x.size === b.size && x.st === 'local');  // loc: the locally free blocks of this size
      const budIsFree = (x) => m.blocks.some((y) => y.size === x.size && y.addr === (x.addr ^ x.size) && y.st === 'global');  // budIsFree(x): true when block x's buddy is globally free, so x would merge as soon as it went global
      const pl = loc.find(budIsFree) || loc.reduce((x, y) => (y.t < x.t ? y : x));  // pl: the locally free block to promote, preferably one that can merge right away, otherwise the one freed longest ago
      ev.push({ k: 'promote', size: b.size, addr: pl.addr });  // records the promotion for the explanation
      budGlobal(m, pl, ev);  // turns it globally free, merging it if its buddy is free
    }  // ends the slack-0 extra step
    ev.push({ k: 'slack', size: b.size, D0, D1: budCounts(m, b.size).D });  // records the slack for this size before and after the whole free
  }  // ends budRelease
  function budAlloc(m, size, label) { const ev = [], b = budObtain(m, size, ev); if (b) b.label = label; return { ok: !!b, ev, addr: b ? b.addr : null }; }  // budAlloc(m, size, label): one allocation request; labels the block it got and reports success, the moves made, and the address
  function budFree(m, addr) {  // budFree(m, addr): one free request for the block given out at addr
    const b = m.blocks.find((x) => x.addr === addr && x.st === 'alloc');  // b: the allocated block at that address, if there is one
    const ev = [];  // ev will collect the moves this free causes
    if (b) { ev.push({ k: 'free', size: b.size, addr, label: b.label }); budRelease(m, b, ev); }  // if the block exists, the free is recorded and the release rules run
    return { ok: !!b, ev };  // reports whether anything was freed, plus the moves
  }  // ends budFree
  // The scripted burst for the side-by-side lab: hold X and Y, then four rounds of "two records come and go".
  const BURST = [['a', 'X', 32], ['a', 'Y', 32]].concat(...[1, 2, 3, 4].map((r) => [['a', 'P' + r, 32], ['a', 'Q' + r, 32], ['f', 'P' + r], ['f', 'Q' + r]]));  // BURST: the request script: allocate X and Y (32 bytes each), then rounds 1 to 4 each allocate two records and free them again
  function budRun(lazy, script) {                                    // frames[i] = state after i requests
    const m = budNew(lazy), where = {}, frames = [{ m: budClone(m), ev: [], op: null }];  // m: a fresh allocator; where maps each label to its address; frames starts with the empty snapshot before any request
    script.forEach((op) => {  // runs every request of the script in order
      const r = op[0] === 'a' ? budAlloc(m, op[2], op[1]) : budFree(m, where[op[1]]);  // 'a' allocates op[2] bytes under the label op[1]; 'f' frees the block that label was given
      if (op[0] === 'a') where[op[1]] = r.addr;  // remembers where each allocated label landed, so its later free can find it
      frames.push({ m: budClone(m), ev: r.ev, op });  // stores a snapshot after this request, with its moves and the request itself
    });  // ends the loop over the script
    return frames;  // hands back every snapshot, ready for the player to step through
  }  // ends budRun
/* models:end */

  // ---------- DOM helpers ----------
  // mtext: a multi-line SVG <text>, one tspan per line.
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {  // mtext(s, x, y, lines, attrs, lh): builds an SVG text label at x, y; s is the SVG element builder, lh the gap between lines in pixels
    const t = s('text', Object.assign({ x, y }, attrs));  // t: the text element, with its position and any extra attributes such as a class
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // each line becomes a tspan (a piece of SVG text) at the same x, moved down lh pixels from the line before
    return t;  // hands back the finished label
  }  // ends mtext
  // hotGroup: an SVG group that behaves like a button (it answers a mouse click, and Enter or Space from the keyboard).
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(ctx, onAct, label, ...kids): wraps drawing pieces in a clickable group that runs onAct
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // g: an SVG group with the pointer cursor, reachable with Tab, announced to screen readers as a button with this label
    g.addEventListener('click', onAct);  // a mouse click runs the action
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // Enter or Space run it too, so it works from the keyboard; preventDefault stops Space from scrolling the page
    return g;  // hands back the group
  }  // ends hotGroup
  // flash: replay the one-shot highlight animation on an element.
  function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }  // flash(el): restarts the one-second highlight on el: remove the class, read offsetWidth to make the browser notice, then add it back

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '8.3',  // the section number, used in links, the progress list and saved progress
    title: 'UNIX and Solaris Memory Management',  // the full title shown at the top of every step
    short: 'UNIX/Solaris memory',  // the short name used in the side menu and progress list
    summary: 'SVR4 and Solaris: four paging tables, copy on write, the two-handed clock and the lazy buddy allocator.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Explain why SVR4 UNIX and Solaris run two separate memory schemes: a paging system and a kernel memory allocator.',  // objective 1: why the kernel runs two memory managers side by side
      'Name the four paging data structures (page table, disk block descriptor, page frame data table, swap-use table), list their fields, and follow one page through all four.',  // objective 2: the four paging tables, their fields, and following one page through them
      'Trace copy on write after fork(): which pages are shared, which get copied, and when.',  // objective 3: tracing copy on write after fork()
      'Run the two-handed clock and compute how handspread, scanrate and free memory set the time a page has to be used again before it is paged out.',  // objective 4: running the two-handed clock and working out how long a page has to be used again
      'Explain the lazy buddy system (locally vs globally free blocks) and use the slack count to decide what happens when a block is freed.',  // objective 5: the lazy buddy system and the slack rule for a freed block
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['SVR4 (System V Release 4)', 'A late-1980s version of AT&T’s UNIX that combined features of the main UNIX lines of its day. Its paged virtual-memory design was carried into Solaris and other commercial UNIX systems.'],  // glossary entry: SVR4, the UNIX version whose paging design this section follows
      ['Paging system', 'The part of an SVR4 or Solaris kernel that hands out page frames: to the pages of user processes and to disk block buffers that cache file data. It runs virtual memory.'],  // glossary entry: the paging system, the manager of whole page frames
      ['Kernel memory allocator', 'The part of the kernel that hands out the small pieces of memory the kernel itself needs (tables, records, buffers), most of them much smaller than a page.'],  // glossary entry: the kernel memory allocator, the manager of small kernel pieces
      ['Copy on write (COW)', 'A way to share pages after fork(): parent and child map the same frames, marked copy on write, and a page is copied only when one of them first writes to it, and only for the writer.'],  // glossary entry: copy on write, sharing pages after fork() until someone writes
      ['Disk block descriptor', 'A record kept beside each page table entry that says where the page lives on disk: swap device number, block number, and the type of storage (swap, executable file, or fill with zeros).'],  // glossary entry: disk block descriptor, where a page lives on disk
      ['Page frame data table', 'A kernel table with one entry per physical page frame, indexed by frame number: what state the frame is in, how many processes use it, where its disk copy is, and links into the free list and a hash queue.'],  // glossary entry: page frame data table, one entry per physical frame
      ['Swap-use table', 'A table kept for each swap device, with one entry per page on the device: how many page table entries point at that disk page (a reference count) and the page’s identifier on the device.'],  // glossary entry: swap-use table, a reference count per page of a swap device
      ['Swap device', 'A disk area (a partition or a file) set aside to hold pages of processes that are not in main memory.'],  // glossary entry: swap device, the disk area that holds paged-out pages
      ['Reference count', 'A counter of how many users share one object. When it drops to zero the object can be freed; while it is above one, changing the object needs care.'],  // glossary entry: reference count, how many users share one object
      ['Hash queue', 'A short linked list reached by hashing a key. The kernel hashes a disk page’s device and block number to find, without a full search, whether some frame already holds that page.'],  // glossary entry: hash queue, the quick lookup of a disk page among the frames
      ['Reference bit', 'A bit in a page table entry that the hardware sets whenever the page is used. Replacement algorithms clear it and later check whether it was set again (also called the use bit).'],  // glossary entry: reference bit, the hardware's "this page was used" mark
      ['Page daemon', 'A kernel process (also called the pageout daemon) that wakes up when free memory runs low, runs the replacement algorithm and puts unused pages on the list of pages to be paged out.'],  // glossary entry: page daemon, the kernel process that frees memory when it runs low
      ['Two-handed clock', 'The SVR4 and Solaris page replacement algorithm: a front hand sweeps the frames clearing reference bits, and a back hand a fixed distance behind pages out every frame whose bit is still 0.'],  // glossary entry: two-handed clock, the replacement algorithm with a front and a back hand
      ['Handspread', 'The gap, in pages, between the front hand and the back hand of the two-handed clock.'],  // glossary entry: handspread, the gap between the two hands
      ['Scanrate', 'How many pages per second the two hands of the two-handed clock move. Divided into the handspread it gives the time a page has to be used again.'],  // glossary entry: scanrate, how fast the hands move
      ['Free-memory thresholds (lotsfree, minfree)', 'Two tuning levels for free memory. Below lotsfree the page daemon starts scanning, slowly; as free memory falls toward minfree the scan speeds up to its maximum.'],  // glossary entry: the free-memory thresholds lotsfree and minfree that set the scan speed
      ['Lazy buddy system', 'The SVR4 kernel memory allocator: a buddy system that does not merge a freed block with its buddy right away, because a block of that size is likely to be wanted again soon.'],  // glossary entry: lazy buddy system, a buddy system that delays merging
      ['Locally free block', 'In the lazy buddy system, a free block that is kept ready for reuse at its own size and is not allowed to merge with its buddy.'],  // glossary entry: locally free block, free but kept at its size, not merged
      ['Globally free block', 'In the lazy buddy system, a free block that is allowed to merge with its buddy, exactly as in an ordinary buddy system.'],  // glossary entry: globally free block, free and allowed to merge
      ['Slab allocator', 'A kernel allocator, introduced by Solaris and later adopted by Linux, that keeps caches of ready-made objects of one size and type, so allocating one is just taking it from its cache.'],  // glossary entry: slab allocator, the later object-cache design
    ],  // closes the glossary list
    css: ` /* this section's own styles; every rule starts with .sec-8-3 so it only affects this section's slides */
      .sec-8-3 .hot { cursor: pointer; } /* .hot: the clickable drawing groups show the hand cursor, so students can see they can be clicked */
      .sec-8-3 .tx-ok { fill: var(--ok); } .sec-8-3 .tx-bad { fill: var(--bad); } .sec-8-3 .tx-warn { fill: var(--warn); } /* tx-ok, tx-bad, tx-warn: colour SVG text (fill) green, red or amber, for good, bad and caution results */
      .sec-8-3 .tx-os { fill: var(--os); } .sec-8-3 .tx-mem { fill: var(--mem); } .sec-8-3 .tx-proc { fill: var(--proc); } /* tx-os, tx-mem, tx-proc: colour SVG text with the kernel, memory and process colours of the guide's colour key */
      .sec-8-3 .tx-io { fill: var(--io); } .sec-8-3 .tx-acc { fill: var(--accent); } .sec-8-3 .tx-muted { fill: var(--muted); } /* tx-io, tx-acc, tx-muted: colour SVG text with the I/O colour, the accent colour or a quiet grey */
      .sec-8-3 .c-ok { color: var(--ok); } .sec-8-3 .c-bad { color: var(--bad); } .sec-8-3 .c-warn { color: var(--warn); } /* c-ok, c-bad, c-warn: the same green, red and amber for ordinary HTML text (color instead of fill) */
      .sec-8-3 .c-os { color: var(--os); } .sec-8-3 .c-mem { color: var(--mem); } .sec-8-3 .c-proc { color: var(--proc); } /* c-os, c-mem, c-proc: the kernel, memory and process colours for HTML text */
      .sec-8-3 .c-io { color: var(--io); } .sec-8-3 .c-acc { color: var(--accent); } /* c-io, c-acc: the I/O and accent colours for HTML text */
      .sec-8-3 .fld { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 6px 4px; min-height: 68px; min-width: 0; /* .fld: one field button of the page table entry: a column with the field name above its value, at least 68px tall so rows line up */
        border: 2px solid var(--line-2); border-radius: 10px; background: var(--panel); color: var(--ink); font: inherit; cursor: pointer; } /* continues .fld: a rounded outline, the plain panel background, the page's normal font, and a hand cursor */
      .sec-8-3 .fld:hover { border-color: var(--accent); } /* hovering over a field button outlines it in the accent colour */
      .sec-8-3 .fld.on { border-color: var(--accent); background: var(--accent-bg); } /* the chosen field button gets the accent outline and a pale accent fill */
      .sec-8-3 .fld .lab { font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; line-height: 1.15; } /* .lab: the field name inside a field button, small, bold and grey, centred */
      .sec-8-3 .fld .val { font-family: var(--mono); font-size: 19px; font-weight: 800; line-height: 1.1; } /* .val: the field's value inside a field button, large and bold in the fixed-width font so digits line up */
      .sec-8-3 .scn { justify-content: flex-start; text-align: left; white-space: normal; height: auto; min-height: 36px; padding: 5px 10px; line-height: 1.2; } /* .scn: the page-scenario buttons: text left-aligned and allowed to wrap onto a second line */
      .sec-8-3 .rowbtn { cursor: pointer; } /* .rowbtn: table rows that can be clicked show the hand cursor */
      .sec-8-3 .rowbtn:hover td { background: var(--panel-3); } /* hovering over a clickable row tints all its cells, so students see which row they are about to pick */
      .sec-8-3 table.tbl tr.lk td { background: var(--hl); } /* a row linked to the chosen one (class lk) gets the yellow highlighter, showing which records point at each other */
      .sec-8-3 table.tbl tr.sel td { background: var(--accent-bg); font-weight: 700; } /* the chosen row itself (class sel) gets the pale accent fill and bold text */
      .sec-8-3 table.tbl.nw td, .sec-8-3 table.tbl.nw th { white-space: nowrap; } /* tables with class nw never wrap cell text, so each record stays on one line */
    `,  // end of the section styles
    steps: [  // steps: the screens of this section, in order
      /* ---------------- 1. Big picture: two memory managers in one kernel ---------------- */
      {  // step 1 begins
        title: 'One kernel, two memory managers',  // step 1 title
        kind: 'story',  // a Big Picture step
        render(el, ctx) {  // render(el, ctx): draws step 1 into el when the student arrives; ctx is the guide's toolbox
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG (the browser's drawing format) elements
          const INFO = {  // INFO: what the info card says for each clickable part, each written [title, colour, explanation]
            paging: ['Paging system', 'os', 'Manages whole <b>page frames</b>. It gives frames to the resident pages of user processes (virtual memory, 8.1–8.2) and to <b>disk block buffers</b>. When free frames run short, its page daemon reclaims some with the two-handed clock (steps 5–6).'],  // info text for the paging system box: it manages whole frames and reclaims them with the clock
            kma: ['Kernel memory allocator', 'os', 'The kernel constantly creates and frees small records: an entry for a new process, a table slot for an open file, a buffer for one network message. Most are tens to hundreds of bytes, far smaller than a page, and live only briefly. This allocator takes whole frames from the paging system and cuts them into small blocks. SVR4 uses a <b>lazy buddy system</b> (steps 7–8).'],  // info text for the kernel memory allocator box: why small, short-lived kernel records need their own allocator
            proc: ['Pages of user processes', 'proc', 'The virtual pages of each process that are in memory right now. The kernel describes every one with four tables (steps 2–3), and after <code>fork()</code> parent and child share them until one writes (step 4).'],  // info text for the user-process pages: described by four tables and shared after fork()
            buf: ['Disk block buffers', 'io', 'Copies of recently read or written disk blocks, kept in memory so that repeated file access does not wait for the disk. They take their frames from the same pool as process pages.'],  // info text for the disk block buffers: cached disk blocks that share the frame pool
            kobj: ['Kernel tables and buffers', 'os', 'Frames lent to the kernel memory allocator, each cut into blocks of different sizes. One 4 KB frame can hold dozens of small kernel records.'],  // info text for the kernel-record frames: frames lent to the allocator and cut into small blocks
            free: ['Free frames', 'mem', 'Frames on the free list, ready for whichever manager asks next. The page daemon’s job is to keep enough of them around.'],  // info text for the free frames: ready for either manager
            early: ['Early UNIX (1970s)', 'muted', 'No virtual memory. Each process sat in one variable-sized partition (7.2), and whole processes were swapped out to disk when memory ran short.'],  // history entry: early UNIX, whole processes in partitions and swapping, no virtual memory
            svr4: ['SVR4 (late 1980s)', 'os', 'Paged virtual memory, built from the structures in this section: four tables that describe pages and frames, the two-handed clock for replacement, and the lazy buddy system for kernel memory.'],  // history entry: SVR4, the paged design this section teaches
            sol: ['Solaris', 'os', 'Sun’s UNIX, built on SVR4. It keeps the same page structures and the two-handed clock. For kernel memory it later introduced the <span class="t">slab allocator</span>, an idea Linux adopted.'],  // history entry: Solaris, the same paging plus the later slab allocator
          };  // closes the INFO table
          const info = h('div', { class: 'card tight', style: { minHeight: '124px', flex: 'none' } });  // info: the card under the picture that explains the chosen part; a fixed minimum height so the layout does not jump
          const groups = {};  // groups: the clickable parts of the picture, keyed by INFO name
          const tlBtns = {};  // tlBtns: the history buttons, keyed by INFO name
          function pick(k) {  // pick(k): runs when a part or history button is chosen; shows its explanation and highlights it
            const [t, c, body] = INFO[k];  // t, c and body: the title, colour and text of the chosen entry
            info.innerHTML = `<div class="b c-${c}" style="margin-bottom:2px">${t}</div><div class="small">${body}</div>`;  // writes the coloured bold title and the explanation into the info card
            Object.entries(groups).forEach(([kk, g]) => (g.style.opacity = kk === k || !(k in groups) ? '1' : '0.5'));  // dims every other part of the picture to half strength; a history choice (not in the picture) leaves all parts at full strength
            Object.entries(tlBtns).forEach(([kk, b]) => b.classList.toggle('on', kk === k));  // lights up the chosen history button and turns the others off
          }  // ends pick
          const arrow = (d, mk, dash) => s('path', { d, class: 's-line', fill: 'none', 'marker-end': `url(#arr-${mk})`, style: `stroke:var(--${mk})`, 'stroke-dasharray': dash || null });  // arrow(d, mk, dash): an SVG line following path d in colour mk, ending in the arrowhead of that colour; dash makes it dashed
          const panelRect = (x, y, w, hh) => s('rect', { x, y, width: w, height: hh, rx: 2, fill: 'var(--panel)', style: 'stroke:var(--os)', 'stroke-width': 1 });  // panelRect(x, y, w, hh): a tiny white rectangle with a kernel-coloured outline, one small kernel record drawn inside a frame
          let svg;  // svg will hold the picture, built in one of two layouts
          if (ctx.narrow) {  // when the guide's phone-width flag is on, the picture is built in a more compact layout
            // small screens: a 340-unit-wide layout with fewer, larger labels (subtitles live in the info card instead)
            svg = s('svg', { viewBox: '0 0 340 230', width: '100%' });  // the small-screen picture: 340 by 230 drawing units, stretched to the card's width
            const FW = 23, X0 = 9, BY = 108;  // FW: the width of one frame box; X0: the left edge of the row of frames; BY: the top of that row
            const frame = (i, cls) => s('rect', { x: X0 + i * FW, y: BY, width: FW - 3, height: 40, rx: 4, class: cls, 'stroke-width': 1.5 });  // frame(i, cls): the box for frame i, coloured by class cls
            const under = (i0, i1, lines, cls) => mtext(s, X0 + ((i0 + i1 + 1) / 2) * FW - 1.5, BY + 58, lines, { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: cls }, 15);  // under(i0, i1, lines, cls): a bold label centred under frames i0 to i1, in colour cls
            groups.paging = hotGroup(ctx, () => pick('paging'), 'Paging system',  // the clickable Paging system box; choosing it shows its explanation
              s('rect', { x: 4, y: 4, width: 150, height: 48, rx: 10, class: 's-os', 'stroke-width': 2 }),  // its purple kernel-coloured box, top left
              s('text', { x: 79, y: 33, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'Paging system'));  // its title
            groups.kma = hotGroup(ctx, () => pick('kma'), 'Kernel memory allocator',  // the clickable Kernel memory allocator box
              s('rect', { x: 186, y: 4, width: 150, height: 48, rx: 10, class: 's-os', 'stroke-width': 2 }),  // its box, top right
              mtext(s, 261, 24, ['Kernel memory', 'allocator'], { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 }, 17));  // its title on two lines, so it fits the small box
            const kobjKids = [frame(10, 's-os'), frame(11, 's-os')];  // kobjKids: the drawing pieces for the kernel-record part, starting with frames 10 and 11 in the kernel colour
            [2, 11].forEach((dx) => [3, 15, 27].forEach((dy) => kobjKids.push(panelRect(X0 + 10 * FW + dx, BY + dy, 7, 9))));  // draws a 2 by 3 grid of tiny equal records inside frame 10
            [[2, 3, 16, 14], [2, 21, 7, 15], [11, 21, 7, 15]].forEach(([dx, dy, w, hh]) => kobjKids.push(panelRect(X0 + 11 * FW + dx, BY + dy, w, hh)));  // draws three records of different sizes inside frame 11: one wide on top, two smaller below
            groups.proc = hotGroup(ctx, () => pick('proc'), 'Process pages', ...[0, 1, 2, 3, 4, 5, 6].map((i) => frame(i, 's-proc')), under(0, 6, ['pages of user', 'processes'], 'tx-proc'));  // the clickable part for frames 0-6, the pages of user processes, in the process colour, with its two-line label
            groups.buf = hotGroup(ctx, () => pick('buf'), 'Disk block buffers', ...[7, 8, 9].map((i) => frame(i, 's-io')), under(7, 9, ['disk', 'buffers'], 'tx-io'));  // the clickable part for frames 7-9, the disk block buffers, in the I/O colour
            groups.kobj = hotGroup(ctx, () => pick('kobj'), 'Kernel tables and buffers', ...kobjKids, under(10, 11, ['kernel', 'records'], 'tx-os'));  // the clickable part for frames 10-11, the kernel records cut into small pieces
            groups.free = hotGroup(ctx, () => pick('free'), 'Free frames', frame(12, 's-panel'), frame(13, 's-panel'), under(12, 13, ['free'], 's-sub'));  // the clickable part for frames 12-13, the free frames, drawn plain
            svg.append(s('text', { x: 170, y: 13, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, 'lends frames'),  // fills the picture, starting with the small "lends frames" caption between the two manager boxes
              s('g', { transform: 'translate(0,16)' },  // a group moved down 16 units that holds the arrows, the caption and every clickable part
                arrow('M60,54 C60,80 88,84 88,102', 'proc'), arrow('M130,54 C150,84 203,80 203,102', 'io'), arrow('M261,54 V102', 'os'),  // three arrows from the managers to the frames they hand out: process pages and disk buffers from paging, kernel records from the allocator
                arrow('M156,28 H182', 'os', '4 3'),  // a dashed arrow from the paging system to the allocator: the allocator borrows its frames from the paging system
                s('text', { x: 170, y: 207, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, class: 's-sub' }, 'Main memory: one box per page frame'),  // caption under the row of frames: each box is one page frame of main memory
                groups.paging, groups.kma, groups.proc, groups.buf, groups.kobj, groups.free));  // the six clickable parts; closes the group and the append
          } else {  // otherwise the wider desktop layout
            svg = s('svg', { viewBox: '0 0 600 268', width: '100%' });  // the desktop picture: 600 by 268 drawing units, stretched to the card's width
            const FW = 40, X0 = 20, BY = 150;   // frame width, left edge, bar top
            const frame = (i, cls) => s('rect', { x: X0 + i * FW, y: BY, width: FW - 3, height: 54, rx: 5, class: cls, 'stroke-width': 1.5 });  // frame(i, cls): the box for frame i, taller than in the small-screen layout
            groups.paging = hotGroup(ctx, () => pick('paging'), 'Paging system',  // the clickable Paging system box
              s('rect', { x: 20, y: 8, width: 250, height: 58, rx: 12, class: 's-os', 'stroke-width': 2 }),  // its purple kernel-coloured box, top left
              s('text', { x: 145, y: 33, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17 }, 'Paging system'),  // its title
              s('text', { x: 145, y: 54, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 'hands out whole page frames'));  // its subtitle: it hands out whole page frames
            groups.kma = hotGroup(ctx, () => pick('kma'), 'Kernel memory allocator',  // the clickable Kernel memory allocator box
              s('rect', { x: 330, y: 8, width: 250, height: 58, rx: 12, class: 's-os', 'stroke-width': 2 }),  // its box, top right
              s('text', { x: 455, y: 33, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17 }, 'Kernel memory allocator'),  // its title
              s('text', { x: 455, y: 54, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 'hands out small blocks'));  // its subtitle: it hands out small blocks
            const kobjKids = [frame(10, 's-os'), frame(11, 's-os')];  // kobjKids: the kernel-record part, starting with frames 10 and 11
            [0, 17].forEach((dx) => [0, 17, 34].forEach((dy) => kobjKids.push(s('rect', { x: X0 + 10 * FW + 4 + dx, y: BY + 4 + dy, width: 13, height: 13, rx: 2, fill: 'var(--panel)', style: 'stroke:var(--os)', 'stroke-width': 1 }))));  // draws a 2 by 3 grid of tiny equal records inside frame 10
            [[0, 0, 33, 22], [0, 26, 15, 22], [18, 26, 15, 22]].forEach(([dx, dy, w, hh]) => kobjKids.push(s('rect', { x: X0 + 11 * FW + 2 + dx, y: BY + 4 + dy, width: w, height: hh, rx: 2, fill: 'var(--panel)', style: 'stroke:var(--os)', 'stroke-width': 1 })));  // draws one wide and two smaller records inside frame 11, to show blocks of different sizes
            const under = (i0, i1, txt, cls) => s('text', { x: X0 + ((i0 + i1 + 1) / 2) * FW - 1.5, y: BY + 74, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: cls }, txt);  // under(i0, i1, txt, cls): a bold one-line label centred under frames i0 to i1, in colour cls
            groups.proc = hotGroup(ctx, () => pick('proc'), 'Process pages', ...[0, 1, 2, 3, 4, 5, 6].map((i) => frame(i, 's-proc')), under(0, 6, 'pages of user processes', 'tx-proc'));  // the clickable part for frames 0-6, the pages of user processes
            groups.buf = hotGroup(ctx, () => pick('buf'), 'Disk block buffers', ...[7, 8, 9].map((i) => frame(i, 's-io')), under(7, 9, 'disk buffers', 'tx-io'));  // the clickable part for frames 7-9, the disk block buffers
            groups.kobj = hotGroup(ctx, () => pick('kobj'), 'Kernel tables and buffers', ...kobjKids, mtext(s, X0 + 11 * FW - 1.5, BY + 74, ['kernel', 'records'], { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: 'tx-os' }, 15));  // the clickable part for frames 10-11, labelled "kernel records" on two lines
            groups.free = hotGroup(ctx, () => pick('free'), 'Free frames', frame(12, 's-panel'), frame(13, 's-panel'), under(12, 13, 'free', 's-sub'));  // the clickable part for frames 12-13, the free frames
            svg.append(  // fills the desktop picture
              s('text', { x: 300, y: 260, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: 's-sub' }, 'Main memory: one box per page frame (sizes illustrative)'),  // caption under the row of frames, noting the sizes are only illustrative
              arrow('M110,68 C110,104 150,110 150,144', 'proc'), arrow('M200,68 C230,108 330,104 334,144', 'io'),  // arrows from the paging system to the process pages and to the disk buffers
              arrow('M455,68 C455,104 470,110 470,144', 'os'),  // arrow from the allocator to the kernel records
              arrow('M272,30 H326', 'os', '5 4'),  // dashed arrow from the paging system to the allocator: frames are lent across
              s('text', { x: 299, y: 22, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'lends'),  // the word "lends" above the dashed arrow
              s('text', { x: 299, y: 48, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'frames'),  // the word "frames" below it
              groups.paging, groups.kma, groups.proc, groups.buf, groups.kobj, groups.free);  // the six clickable parts; closes the append
          }  // ends the choice between the two layouts
          const tl = h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'History:'),  // tl: the history row, a bold "History:" label followed by its buttons
            ...[['early', 'Early UNIX'], ['svr4', 'SVR4'], ['sol', 'Solaris']].map(([k, lab]) => (tlBtns[k] = h('button', { class: 'btn sm', onclick: () => pick(k) }, lab))));  // three history buttons (early UNIX, SVR4, Solaris), each stored in tlBtns and showing its INFO entry when clicked
          info.innerHTML = '<div class="b">Click any box in the picture, or a history button.</div><div class="small muted">Each part explains what it holds and which manager owns it.</div>';  // what the info card says before anything is chosen: an invitation to click
          el.append(h('div', { class: 'split l fill' },  // lays out the step in two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: the explanation, stacked
              h('p', { class: 'lead m0', html: 'UNIX was built to run on many kinds of machines, so its memory management differs from version to version.' }),  // lead paragraph: UNIX memory management differs from version to version
              h('p', { class: 'm0', html: 'The earliest versions had no virtual memory. Modern ones, such as <span class="t">SVR4</span> and Solaris, use paging, with <b>two separate memory managers</b> in the kernel:' }),  // paragraph: early versions had no virtual memory; SVR4 and Solaris page, with two memory managers
              h('ul', { class: 'm0', html: '<li>the <span class="t">paging system</span> hands out whole <b>page frames</b>, to the pages of user processes and to disk block buffers;</li><li>the <span class="t">kernel memory allocator</span> hands out <b>small pieces</b> for the kernel’s own tables and buffers.</li>' }),  // list of the two managers and what each one hands out
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A storage company rents whole units to its customers but keeps its own paper clips in a drawer of small trays. Nobody rents a unit to store one clip.' }),  // analogy callout: renting whole storage units versus keeping paper clips in small trays
              h('div', { class: 'callout why m0 small', 'data-label': 'In this section you will', html: 'follow a page through the four tables SVR4 keeps, watch fork() share pages with copy on write, run the two-handed clock, and play the lazy buddy allocator.' })),  // callout listing what the student will do in this section
            h('div', { class: 'stack' }, h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), tl, info)));  // right column: the picture on a white card, the history row and the info card; closes the layout
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------- 2. The page table entry and its disk block descriptor ---------------- */
      {  // step 2 begins
        title: 'One page, two records: the PTE and its disk descriptor',  // step 2 title
        kind: 'learn',  // a Learn step
        render(el, ctx) {  // render(el, ctx): draws step 2 when the student arrives
          const { h } = ctx;  // only the HTML builder h is needed here
          // Six pages of one made-up process, "editor". null = the field means nothing in this state.
          const SC = [  // SC: the six example pages; each lists the page table entry fields and the disk block descriptor fields for that page
            { k: 'code', lab: 'Code page in memory', frame: 37, age: 0, cow: 0, mod: 0, ref: 1, valid: 1, prot: 'RO', dev: 2, blk: 5312, type: 'file' },  // scenario: a code page in frame 37, read-only and just used; its copy is in the program file (device 2, block 5,312)
            { k: 'wrote', lab: 'Data page just written', frame: 12, age: 0, cow: 0, mod: 1, ref: 1, valid: 1, prot: 'RW', dev: 1, blk: 2048, type: 'swap' },  // scenario: a data page just written, so the Modify bit is set; its disk copy is on swap
            { k: 'idle', lab: 'Data page left idle', frame: 44, age: 3, cow: 0, mod: 0, ref: 0, valid: 1, prot: 'RW', dev: 1, blk: 2056, type: 'swap' },  // scenario: a data page left idle: age 3 and Reference bit clear, a good candidate for replacement
            { k: 'shared', lab: 'Shared after fork()', frame: 20, age: 0, cow: 1, mod: 0, ref: 1, valid: 1, prot: 'RW', dev: 1, blk: 2064, type: 'swap' },  // scenario: a page shared after fork(), with the Copy on write bit set
            { k: 'out', lab: 'Paged out to swap', frame: null, age: null, cow: 0, mod: 0, ref: 0, valid: 0, prot: 'RW', dev: 1, blk: 2072, type: 'swap' },  // scenario: a page paged out to swap: Valid is 0, there is no frame, and the copy is swap block 2,072
            { k: 'zero', lab: 'Heap page never touched', frame: null, age: null, cow: 0, mod: 0, ref: 0, valid: 0, prot: 'RW', dev: null, blk: null, type: 'zero' },  // scenario: a heap page never touched: no frame and no disk copy, so it comes as demand zero
          ];  // closes SC
          const TYPE = { file: 'exec file', swap: 'swap', zero: 'demand zero' };  // TYPE: how each kind of storage is written on screen
          const PTE = [['frame', 'Page frame number'], ['age', 'Age'], ['cow', 'Copy on write'], ['mod', 'Modify'], ['ref', 'Reference'], ['valid', 'Valid'], ['prot', 'Protect']];  // PTE: the seven page table entry fields, each written [key, name shown on its button]
          const DBD = [['dev', 'Swap device number'], ['blk', 'Device block number'], ['type', 'Type of storage']];  // DBD: the three disk block descriptor fields
          const show = (f, v) => (v == null ? '—' : f === 'type' ? TYPE[v] : f === 'blk' ? v.toLocaleString('en-US') : String(v));  // show(f, v): how a value appears: a dash when it means nothing, words for the storage type, commas in block numbers
          const EXPL = {  // EXPL: for each field, a function that returns [name, what the field means, what it means for the chosen page]
            frame: (c) => ['Page frame number', 'Which physical frame holds the page. It means something only while Valid = 1.', c.valid ? `This page sits in frame ${c.frame}.` : 'No frame: the page is not in main memory, so this field is ignored.'],  // explanation of the page frame number: which frame holds the page, only meaningful while Valid is 1
            age: (c) => ['Age', 'How long the page has been in memory without being referenced (how many bits it has and what it counts depend on the machine). The older the page, the better a candidate it is for replacement.', c.age == null ? 'Not in memory, so there is nothing to age.' : c.age === 0 ? 'Age 0: used very recently.' : `Age ${c.age}: it has gone unused for a while, so it is a strong candidate to be paged out.`],  // explanation of Age: how long the page has gone unused, and why old pages are replaced first
            cow: (c) => ['Copy on write', 'Set when processes share this page, for example after fork(). Copying is put off: the first write makes a private copy for the writer only (step 4).', c.cow ? 'Set: the frame is shared, so this process’s next write first triggers a copy.' : 'Clear: no sharing to undo; a write may go straight to the frame if Protect allows it.'],  // explanation of Copy on write: sharing after fork() and the copy on first write
            mod: (c) => ['Modify', 'Set by the hardware when the page is written. A modified page must be written to disk before its frame is reused; an unmodified one can simply be dropped, because its disk copy is still good.', c.mod ? 'Set: the disk copy is out of date, so evicting this page costs a disk write.' : 'Clear: the disk copy is current, so the frame can be reused without a write.'],  // explanation of Modify: a written page must go back to disk before its frame is reused
            ref: (c) => ['Reference', 'Set by the hardware whenever the page is used. The replacement algorithm clears it, then looks later to see whether it was set again (steps 5–6).', c.ref ? 'Set: the page was used since the bit was last cleared.' : 'Clear: no use since the bit was last cleared.'],  // explanation of Reference: set on every use, cleared and checked by the clock
            valid: (c) => ['Valid', '1 when the page is in main memory. Touching a page whose Valid bit is 0 causes a page fault, and the kernel turns to the disk block descriptor to find the page.', c.valid ? 'Valid = 1: accesses go straight to the frame.' : 'Valid = 0: the next access faults.'],  // explanation of Valid: 0 means the next access faults and the kernel reads the disk block descriptor
            prot: (c) => ['Protect', 'Whether writing is allowed. Code pages are read-only, so a write to one is an error, never a copy.', c.prot === 'RO' ? 'RO: read-only. Reads and instruction fetches are fine; a write is refused.' : 'RW: reads and writes are allowed.'],  // explanation of Protect: a write to a read-only code page is an error, never a copy
            dev: (c) => ['Swap device number', 'Which logical device holds the page’s disk copy: a swap device, or the device that holds the program file.', c.dev == null ? 'None: this page has no disk copy at all.' : `Device ${c.dev}.`],  // explanation of the swap device number: which device holds the disk copy
            blk: (c) => ['Device block number', 'Where on that device the page’s copy starts.', c.blk == null ? 'None: nothing to read.' : `Block ${c.blk.toLocaleString('en-US')} of device ${c.dev}.`],  // explanation of the device block number: where on that device the copy starts
            type: (c) => ['Type of storage', 'Where a missing page comes from: <b>swap</b> (a swap device), <b>exec file</b> (read it from the program’s executable file), or <b>demand zero</b> (no disk copy: hand out a frame cleared to zeros, so no data left by another process can leak).', `This page: ${TYPE[c.type]}.`],  // explanation of the type of storage: swap, executable file, or demand zero (a frame cleared so no old data leaks)
          };  // closes EXPL
          let sc = SC[0], fsel = 'cow';  // sc: the page now chosen (the first one to start); fsel: the field now explained (Copy on write to start)
          const cells = {};  // cells: the field buttons, keyed by field
          const mkCell = ([k, lab]) => (cells[k] = h('button', { class: 'fld', type: 'button', onclick: () => { fsel = k; paint(); } }, h('span', { class: 'lab' }, lab), h('span', { class: 'val' }, '')));  // mkCell([k, lab]): makes a field button with its name and an empty value slot; clicking it explains that field
          const pteRow = h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'repeat(4, minmax(0,1fr))' : 'repeat(7, minmax(0,1fr))', gap: '6px' } }, ...PTE.map(mkCell));  // pteRow: the seven page table entry fields in a grid, all in one row on desktop, four per row on a small screen
          const dbdRow = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '6px' } }, ...DBD.map(mkCell));  // dbdRow: the three disk block descriptor fields in three equal columns
          const info = h('div', { class: 'card tight small', style: { minHeight: '102px', flex: 'none' } });  // info: the card that explains the chosen field; a fixed minimum height keeps the layout steady
          const out = h('div', { class: 'card tight small', style: { minHeight: '64px', flex: 'none' } });  // out: the card that shows what a Read or Write does to this page
          const hint = '<span class="muted">Pick Read or Write to see what the hardware and kernel do with this page.</span>';  // hint: the grey prompt shown in the out card until Read or Write is pressed
          const scBtns = SC.map((c) => h('button', { class: 'btn sm scn', type: 'button', onclick: () => { sc = c; out.innerHTML = hint; paint(true); } }, c.lab));  // scBtns: one button per example page; choosing one switches page, puts the prompt back, and repaints with changes flashed
          function paint(changed) {  // paint(changed): redraws the field buttons and the explanation; changed is true right after the page was switched
            scBtns.forEach((b, i) => b.classList.toggle('on', SC[i] === sc));  // lights up the chosen page's button
            Object.entries(cells).forEach(([k, b]) => {  // goes through every field button
              b.classList.toggle('on', k === fsel);  // lights up the field being explained
              const v = b.querySelector('.val'), txt = show(k, sc[k]);  // v: the button's value slot; txt: what that field shows for the chosen page
              if (changed && v.textContent !== txt) flash(b);  // after a page switch, a field whose value differs from before flashes, so the student sees what changed
              v.textContent = txt;  // writes the field's value for the chosen page
            });  // ends the loop over field buttons
            const [t, gen, now] = EXPL[fsel](sc);  // t, gen and now: the chosen field's name, its general meaning, and what it means for this page
            info.innerHTML = `<div class="b c-acc">${t}</div><div>${gen}</div><div class="b" style="margin-top:3px">${now}</div>`;  // fills the info card: the field name in the accent colour, the general meaning, then the bold line about this page
          }  // ends paint
          function access(op) {                       // what an access would do, worked out from the fields on screen
            const c = sc, w = op === 'write';  // c: the chosen page; w is true for a write and false for a read
            let msg;  // msg will hold the explanation
            if (!c.valid) {  // case 1: the page is not in memory (Valid = 0)
              const src = c.type === 'zero' ? 'demand zero, so it takes a free frame and <b>fills it with zeros</b> (there is nothing to read)' : c.type === 'swap' ? `swap, so it reads <b>swap device ${c.dev}, block ${c.blk.toLocaleString('en-US')}</b> into a free frame` : 'exec file, so it reads the page from the <b>program file</b> into a free frame';  // src: what the disk block descriptor says to do, by storage type: zero-fill a frame, read the swap block, or read the program file
              msg = `<b class="c-bad">Page fault</b> (Valid = 0). The disk block descriptor says ${src}. The kernel then sets Valid = 1 and the ${op} is retried.`;  // a page fault: the kernel follows the descriptor, sets Valid to 1 and retries the access
            } else if (!w) msg = `<b class="c-ok">Read from frame ${c.frame}.</b> No kernel help needed; the hardware sets Reference = 1.`;  // case 2: a read of a page in memory goes straight to its frame; the hardware only sets the Reference bit
            else if (c.prot === 'RO') msg = '<b class="c-bad">Protection fault.</b> Protect says read-only, so the write is refused (a real program would be stopped with an error). Code is never copied on write.';  // case 3: a write to a read-only page is a protection fault, an error, never a copy
            else if (c.cow) msg = `<b class="c-warn">Copy-on-write fault.</b> Frame ${c.frame} is shared, so the kernel copies the page into a new frame for this process only, clears Copy on write, and the write goes ahead there.`;  // case 4: a write to a copy-on-write page is a copy-on-write fault: the kernel gives this process its own copy first
            else msg = `<b class="c-ok">Write to frame ${c.frame}.</b> The hardware sets Modify = 1 and Reference = 1, so the page must be written to disk before its frame is reused.`;  // case 5: an ordinary write goes to the frame and sets Modify, so the page needs a disk write before its frame is reused
            out.innerHTML = `<b>${w ? 'Write' : 'Read'}:</b> ${msg}`;  // shows the result in the out card, starting with "Read:" or "Write:"
          }  // ends access
          paint();  // draws the field buttons and explanation for the first time
          out.innerHTML = hint;  // puts the starting prompt in the out card
          el.append(h('div', { class: 'split l fill' },  // lays out step 2 in two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: the explanation and the page choices
              h('p', { class: 'm0', html: 'Every process has a <span class="t">page table</span> with one entry per virtual page. SVR4 keeps a second record beside each entry, a <span class="t">disk block descriptor</span>, saying where the page lives on disk. The entry answers “where is it in memory, and how may it be used?”; the descriptor answers “where do I get it if it is not?”' }),  // paragraph: the page table entry says where the page is in memory; the disk block descriptor says where to get it if it is not
              h('p', { class: 'm0 small b' }, 'Pick a page of the process “editor”:'),  // instruction above the page buttons
              h('div', { class: 'grid-2', style: { gap: '6px' } }, ...scBtns),  // the six page buttons in two columns
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Valid = 0 does not mean the page is lost. It is just not in memory now, and the disk block descriptor says where to find it (or that it starts as zeros).' }),  // common-mistake callout: Valid = 0 means "not in memory now", not "lost"
              h('div', { class: 'callout why m0 small', 'data-label': 'Why two records?', html: 'The hardware reads the entry on every memory access, so it must stay small. The disk address matters only after a page fault, so the kernel keeps it apart.' })),  // why-callout: the entry stays small because the hardware reads it on every access; the disk address is kept apart
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the two records, the explanation and the access buttons
              h('div', { class: 'card white tight stack gap-s', style: { flex: 'none' } }, h('h4', { class: 'm0' }, 'Page table entry · click a field'), pteRow),  // card holding the page table entry fields, with a heading
              h('div', { class: 'card white tight stack gap-s', style: { flex: 'none' } }, h('h4', { class: 'm0' }, 'Disk block descriptor · same virtual page'), dbdRow),  // card holding the disk block descriptor fields for the same page
              info,  // the explanation card for the chosen field
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Try an access:'),  // a row with a bold "Try an access:" label...
                h('button', { class: 'btn sm cpu', onclick: () => access('read') }, 'Read the page'), h('button', { class: 'btn sm cpu', onclick: () => access('write') }, 'Write the page')),  // ...and the Read and Write buttons, which run access() for the chosen page
              out)));  // the result card; closes the right column and the layout
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------- 3. Follow one page through all four tables ---------------- */
      {  // step 3 begins
        title: 'Follow one page through all four tables',  // step 3 title
        kind: 'explore',  // an Explore step
        core: true,  // core: true puts this step on the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): draws step 3 when the student arrives
          const { h } = ctx;  // only the HTML builder h is needed here
          const STATE = { file: 'exec file', swap: 'on swap', avail: 'available' };  // STATE: how each frame state is written in the frame table
          const TYPE = { file: 'exec file', swap: 'swap', zero: 'zero' };  // TYPE: how each storage type is written in the descriptor table
          const nm = (e) => `${e.p}·${e.v}`;  // nm(e): a page's short name, process then page number, such as P·1
          let sel = { kind: 'pt', key: 'P·1' };  // sel: the row now chosen, as its table (kind) and key; P's page 1 to start
          const rows = { pt: {}, dbd: {}, fr: {}, sw: {} };  // rows: every table row, by table (pt, dbd, fr, sw) and key, so rows can be highlighted later
          const rowBtn = (kind, key, label, cells) => {  // rowBtn(kind, key, label, cells): makes one table row that can be clicked to choose it
            const tr = h('tr', { class: 'rowbtn', tabindex: 0, role: 'button', 'aria-label': label, onclick: () => { sel = { kind, key }; paint(); },  // the row: hand cursor on hover, reachable with Tab, announced as a button; a click chooses it and repaints
              onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel = { kind, key }; paint(); } } }, ...cells.map((c) => h('td', { html: String(c) })));  // Enter or Space also choose it, from the keyboard; each value becomes one cell
            rows[kind][key] = tr;  // remembers the row under its table and key
            return tr;  // hands back the row
          };  // ends rowBtn
          const tbl = (head, trs) => h('table', { class: 'tbl compact nw' }, h('tr', {}, ...head.map((x) => h('th', { html: x }))), ...trs);  // tbl(head, trs): a compact table that never wraps, with a header row and the given rows
          const ptT = tbl(['Page', 'Frame', 'V', 'COW'], T4_PT.map((e) => rowBtn('pt', nm(e), 'Page table entry ' + nm(e), [nm(e), e.f == null ? '—' : 'F' + e.f, e.f == null ? 0 : 1, e.cow])));  // ptT: the page table, one row per page of P and Q: frame (a dash if none), Valid bit, Copy-on-write bit
          const dbdT = tbl(['Page', 'Dev', 'Block', 'Type'], T4_PT.map((e) => rowBtn('dbd', nm(e), 'Disk block descriptor ' + nm(e), [nm(e), e.dev ?? '—', e.blk ?? '—', TYPE[e.type]])));  // dbdT: the disk block descriptors for the same pages: device, block and storage type
          const frT = tbl(['Frame', 'State', 'Refs', 'Copy at', 'Lists'], T4_FR.map((r) => rowBtn('fr', 'F' + r.f, 'Frame ' + r.f, ['F' + r.f, STATE[r.state], t4FrameRefs(r.f), r.dev == null ? '—' : `${r.dev} / ${r.blk}`,  // frT: the page frame data table: state, reference count counted from the page tables, disk copy as device / block...
            [r.free ? 'free' : '', r.hashed ? 'hash' : ''].filter(Boolean).join(' + ') || '—'])));  // ...and which lists the frame is on: the free list, a hash queue, both, or neither
          const swT = tbl(['Block', 'Refs'], T4_SW.map((b) => rowBtn('sw', String(b), 'Swap page ' + b, [b, t4SwapRefs(b)])));  // swT: the swap-use table for swap device 1: each block and how many descriptors point at it
          const info = h('div', { class: 'card tight small', style: { minHeight: '112px', flex: 'none', lineHeight: '1.45' } });  // info: the card that explains the chosen row; a fixed minimum height keeps the layout steady
          const freeList = t4FreeList().map((f) => 'F' + f).join(' → ');  // freeList: the free list as text, head first, such as "F3 → F2"
          const card = (title, cls, t, foot) => h('div', { class: 'card white tight stack gap-s', style: { padding: '8px 10px', borderTop: `4px solid var(--${cls})` } }, h('h4', { class: 'm0', html: title, style: { color: `var(--${cls})` } }), t, foot ? h('div', { class: 'xs muted', html: foot }) : null);  // card(title, cls, t, foot): a white card with a coloured top edge and title, the table, and an optional small footnote
          const go = (kind, key) => { sel = { kind, key }; paint(); flash(rows[kind][key]); };  // go(kind, key): chooses a row from a shortcut button, repaints, and flashes the row so the eye finds it
          const tryCard = h('div', { class: 'card tight stack gap-s' }, h('h4', { class: 'm0' }, 'Good places to start'),  // tryCard: a card of suggested starting points
            h('div', { class: 'row', style: { gap: '6px' } },  // a row of shortcut buttons
              h('button', { class: 'btn sm', onclick: () => go('pt', 'P·2') }, 'P·2: a fault with no disk read'),  // shortcut: P's page 2, a page fault that needs no disk read
              h('button', { class: 'btn sm', onclick: () => go('pt', 'Q·3') }, 'Q·3: a page that starts as zeros'),  // shortcut: Q's page 3, a page that starts as zeros
              h('button', { class: 'btn sm', onclick: () => go('fr', 'F2') }, 'F2: free, but still remembers'),  // shortcut: frame 2, free but still holding a page
              h('button', { class: 'btn sm', onclick: () => go('sw', '122') }, '122: an unused swap slot')));  // shortcut: swap block 122, which no page uses; closes the row and the card
          function paint() {  // paint(): highlights the chosen row and every row linked to it, and writes the explanation
            Object.values(rows).forEach((m) => Object.values(m).forEach((tr) => tr.classList.remove('sel', 'lk')));  // clears every earlier highlight from every table
            const mark = (kind, key, c) => { const tr = rows[kind][key]; if (tr && !tr.classList.contains('sel')) tr.classList.add(c); };  // mark(kind, key, c): adds highlight c to a row, unless it is already the chosen row
            const sharers = (pred) => T4_PT.filter(pred).map(nm);  // sharers(pred): the names of the pages that pass the test pred
            let msg = '';  // msg will hold the explanation
            if (sel.kind === 'pt' || sel.kind === 'dbd') {  // case 1: a page table row or a descriptor row was chosen
              const e = T4_PT.find((x) => nm(x) === sel.key), other = e.p === 'P' ? 'Q' : 'P';  // e: that page's entry; other: the other process
              mark('pt', sel.key, 'sel'); mark('dbd', sel.key, 'sel');  // the page's page table row and descriptor row are both marked as chosen
              if (e.f != null) { mark('fr', 'F' + e.f, 'lk'); sharers((x) => x.f === e.f && x !== e).forEach((k) => { mark('pt', k, 'lk'); mark('dbd', k, 'lk'); }); }  // if the page has a frame: that frame is linked, and so is every other page mapping the same frame
              if (e.type === 'swap') { mark('sw', String(e.blk), 'lk'); sharers((x) => x.type === 'swap' && x.blk === e.blk && x !== e).forEach((k) => { mark('pt', k, 'lk'); mark('dbd', k, 'lk'); }); }  // if the page is on swap: its swap-use row is linked, and so is every other page whose descriptor names that block
              const fr = e.f != null ? T4_FR[e.f] : T4_FR.find((r) => r.hashed && r.dev === e.dev && r.blk === e.blk);  // fr: the page's frame, or, for a paged-out page, a frame that still holds its disk block (found the way a hash queue would)
              if (e.f == null && fr) mark('fr', 'F' + fr.f, 'lk');  // a paged-out page whose old frame still holds it links to that frame too
              msg = `<b>${e.p}’s virtual page ${e.v}.</b> `;  // the explanation starts with the page's name
              if (e.f != null) msg += `Valid = 1: it is in <b>frame ${e.f}</b>, whose page frame data table entry has reference count <b>${t4FrameRefs(e.f)}</b> (${sharers((x) => x.f === e.f).join(' and ')}). `;  // in memory: names the frame, its reference count, and who maps it
              else msg += 'Valid = 0: it is <b>not in memory</b>. ';  // or notes that the page is not in memory
              if (e.type === 'file') msg += `Copy on write is 0 because code is read-only: ${e.p} and ${other} simply share it. Its descriptor says <b>exec file, device ${e.dev}, block ${e.blk}</b>: if the frame is ever reclaimed, the page is read again from the program file, so it never needs swap space and has no swap-use entry.`;  // code page: read-only, so it is shared without copy on write and reloaded from the program file, never from swap
              else if (e.type === 'swap' && e.f != null) msg += `Copy on write = 1: shared with ${other} since the fork, so the first write by either one makes a copy. Its descriptor names <b>swap device ${e.dev}, block ${e.blk}</b>, and swap-use entry ${e.blk} has reference count <b>${t4SwapRefs(e.blk)}</b>, because both processes’ descriptors point at that disk page.`;  // shared data page: copy on write since the fork, and its swap block is counted by both processes' descriptors
              else if (e.type === 'swap') msg += `Its descriptor names <b>swap device ${e.dev}, block ${e.blk}</b> (swap-use count <b>${t4SwapRefs(e.blk)}</b>). On a fault the kernel hashes (device ${e.dev}, block ${e.blk}) and searches that <span class="t">hash queue</span>: <b>frame ${fr.f}</b> still holds the page although it is on the free list, so the page is reclaimed with <b>no disk read</b>.`;  // paged-out data page: the hash queue lookup finds it still in a free frame, so it is reclaimed with no disk read
              else msg += `Its descriptor says <b>demand zero</b>: there is no copy anywhere. On the first touch the kernel takes the frame at the head of the free list (F${t4FreeList()[0]}) and clears it to zeros.`;  // demand-zero page: no copy anywhere; the first touch takes the frame at the head of the free list and clears it
            } else if (sel.kind === 'fr') {  // case 2: a frame row was chosen
              const r = T4_FR[+sel.key.slice(1)], users = sharers((x) => x.f === r.f);  // r: that frame's entry; users: the pages that map it
              mark('fr', sel.key, 'sel');  // marks the frame row as chosen
              users.forEach((k) => { mark('pt', k, 'lk'); mark('dbd', k, 'lk'); });  // links every page that maps this frame
              if (r.dev === 1) { mark('sw', String(r.blk), 'lk'); sharers((x) => x.type === 'swap' && x.blk === r.blk).forEach((k) => { mark('pt', k, 'lk'); mark('dbd', k, 'lk'); }); }  // a frame holding a swap page also links its swap-use row and every page whose descriptor names that block
              msg = `<b>Frame ${r.f}</b> (page frame data table entry ${r.f}, found by indexing with the frame number). `;  // the explanation starts with the frame number and how its entry is found (by indexing with the frame number)
              if (r.state === 'avail') msg += `State <b>available</b>: empty, on the free list (${freeList}), and in no hash queue. Reference count <b>${t4FrameRefs(r.f)}</b>. Other possible states mark a frame whose page is on swap, in an executable file, or in the middle of a DMA transfer, so nobody uses it mid-transfer.`;  // available frame: empty, on the free list and no hash queue; also lists the other states a frame can be in
              else if (r.free) msg += `On the <b>free list</b> (${freeList}) with reference count <b>${t4FrameRefs(r.f)}</b>, yet it still holds the page from <b>swap device ${r.dev}, block ${r.blk}</b> and stays in that page’s hash queue. Until the frame is handed to someone else, a fault on that page reclaims it for free.`;  // free but still hashed: it keeps its old page, so a fault on that page can take it back for free
              else msg += `State <b>${STATE[r.state]}</b>: its disk copy is at device ${r.dev}, block ${r.blk}, and it sits in the hash queue for that pair so the kernel can find it from the disk address. Reference count <b>${t4FrameRefs(r.f)}</b>: ${users.join(' and ')} map it. It cannot be freed until the count drops to 0.`;  // frame in use: its disk copy, its hash queue, and why it cannot be freed while its count is above 0
            } else {  // case 3: a swap-use row was chosen
              const b = +sel.key, users = sharers((x) => x.type === 'swap' && x.blk === b), fr = T4_FR.find((r) => r.dev === 1 && r.blk === b);  // b: the swap block; users: the pages whose descriptors name it; fr: a frame that holds a copy of it, if any
              mark('sw', sel.key, 'sel');  // marks the swap-use row as chosen
              users.forEach((k) => { mark('pt', k, 'lk'); mark('dbd', k, 'lk'); });  // links every page whose descriptor points at this swap block
              if (fr) mark('fr', 'F' + fr.f, 'lk');  // links the frame that holds a copy of the block, if one does
              msg = `<b>Swap page ${b}</b> on swap device 1 (its identifier on the device). `;  // the explanation starts with the block number, the page's identifier on swap device 1
              msg += users.length ? `Reference count <b>${users.length}</b>: the disk block descriptors of ${users.join(' and ')} point here, so the slot stays reserved until both processes are done with it. ` : 'Reference count <b>0</b>: no descriptor points here, so this swap slot is free for the next page that needs swap space. ';  // a count above 0 keeps the slot reserved for those pages; a count of 0 means the slot is free for the next page that needs swap
              if (fr) msg += `A copy is also in <b>frame ${fr.f}</b>${fr.free ? ' (on the free list, still reclaimable)' : ''}.`;  // notes when a copy of the block is also in a frame, and whether that frame is free but reclaimable
            }  // ends the three cases
            info.innerHTML = msg;  // writes the explanation into the info card
          }  // ends paint
          paint();  // highlights the starting row (P's page 1) and fills in its explanation
          const grid = h('div', { class: 'grid-3', style: { gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.12fr) minmax(0,2.3fr)', gap: '10px', alignItems: 'start' } },  // grid: three columns of different widths, the widest on the right for the frame and swap tables
            card('Page tables', 'os', ptT, 'one entry per virtual page'),  // column 1: the page tables card, in the kernel colour
            card('Disk block descriptors', 'os', dbdT, 'one per virtual page'),  // column 2: the disk block descriptors card
            h('div', { class: 'stack', style: { gap: '10px' } },  // column 3: a stack with two tables side by side above the shortcut card
              h('div', { class: 'grid-2', style: { gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,.7fr)', gap: '10px', alignItems: 'start' } },  // a two-column row inside column 3, the frame table wider than the swap table
                card('Page frame data table', 'mem', frT, `one entry per frame · free list: ${freeList}`),  // the page frame data table card, in the memory colour, with the free list in its footnote
                card('Swap-use table', 'io', swT, 'swap device 1 · one per page')),  // the swap-use table card, in the I/O colour
              tryCard));  // the shortcut card below them; closes column 3 and the grid
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays out step 3 top to bottom, filling the step's height
            h('p', { class: 'm0', html: 'Process <b>Q</b> was created by <code>fork()</code> from <b>P</b> a moment ago, so both have the same four virtual pages: 0 code, 1 data, 2 data that was paged out, 3 a heap page never touched. <b>Click any row in any table</b> to follow its links. <span class="chip accent">selected</span> <span class="chip warn">linked</span>' }),  // intro paragraph: Q was just forked from P, the four pages, and a key to the two row highlights (selected and linked)
            grid, info));  // the tables, then the explanation card; closes the layout
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------- 4. fork() and copy on write ---------------- */
      {  // step 4 begins
        title: 'fork() without the copying: copy on write',  // step 4 title
        kind: 'lab',  // a Hands-on Lab step
        core: true,  // on the core path
        render(el, ctx) {  // render(el, ctx): draws step 4 when the student arrives
          const { h } = ctx;  // only the HTML builder h is needed here
          let st = cowNew();  // st: the copy-on-write model's state (frames, both page tables, child status), fresh at the start
          const WR = COW_PAGES.filter((p) => p.w).length;  // WR: how many pages are writable (3); an eager fork would have to copy that many
          const tabBox = { P: h('div'), C: h('div') };  // tabBox: the boxes that show the parent's and the child's page tables
          const framesRow = h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'repeat(4, minmax(0,1fr))' : 'repeat(8, minmax(0,1fr))', gap: '6px' } });  // framesRow: the physical frames, eight across on desktop, four per row on a small screen
          const stats = h('div', { class: 'row', style: { gap: '6px' } });  // stats: the row of counters under the frames
          const narr = h('div', { class: 'card tight small', style: { minHeight: '128px', flex: 'none', lineHeight: '1.45' } });  // narr: the card that explains what the last action did; a fixed minimum height keeps the layout steady
          const forkBtn = h('button', { class: 'btn primary', onclick: () => act('fork') }, 'Call fork()');  // the main button: calls fork()
          const execBtn = h('button', { class: 'btn sm proc', onclick: () => act('exec') }, 'Child calls exec()');  // the button that makes the child call exec()
          const wBtns = { P: [], C: [] };  // wBtns: the write buttons of each process, kept so the child's can be switched off when there is no child
          const users = (f) => ['P', 'C'].filter((w) => st[w] && st[w].some((e) => e.frame === f));  // users(f): which processes ('P', 'C') have a page in frame f
          function drawTable(who) {  // drawTable(who): redraws one process's page table box
            const tab = st[who], name = who === 'P' ? 'Parent P' : 'Child C';  // tab: that process's page table; name: its heading
            if (!tab) {  // no table: the child does not exist yet, or has exec'd
              tabBox[who].replaceChildren(h('h4', { class: 'm0' }, name + ' · page table'), h('div', { class: 'card tight small muted', style: { minHeight: '150px', display: 'grid', placeItems: 'center', textAlign: 'center' } },  // shows the heading and a centred grey placeholder...
                st.child === 'exec' ? 'C called exec(): it now runs a new program. Its old page table is gone.' : 'No child yet. Call fork().'));  // ...saying either that C has exec'd and its old table is gone, or that there is no child yet
              return;  // nothing more to draw for this box
            }  // ends the placeholder case
            tabBox[who].replaceChildren(h('h4', { class: 'm0' }, name + ' · page table'), h('table', { class: 'tbl compact nw' },  // replaces the box with the heading and the page table
              h('tr', {}, ...['Page', 'Frame', 'COW', 'M'].map((x) => h('th', {}, x))),  // header row: page name, frame, copy-on-write bit, Modify bit
              ...tab.map((e, i) => h('tr', {}, h('td', { html: COW_PAGES[i].name + (COW_PAGES[i].w ? '' : ' <span class="xs muted">(RO)</span>') }), h('td', { class: 'mono' }, 'F' + e.frame),  // one row per page: its name (code marked RO, read-only) and its frame number
                h('td', { html: e.cow ? '<b class="c-warn">1</b>' : '0' }), h('td', {}, e.mod ? '1' : '0')))));  // the copy-on-write bit (a 1 shown bold in amber) and the Modify bit; closes the table
          }  // ends drawTable
          function draw(changed = []) {  // draw(changed): redraws everything; changed lists frames to flash because the last action touched them
            drawTable('P'); drawTable('C');  // redraws both page tables
            framesRow.replaceChildren(...st.refs.map((r, f) => {  // rebuilds the frame boxes, one per frame
              const u = users(f), pg = u.length ? COW_PAGES[st[u[0]].findIndex((e) => e.frame === f)].name : '';  // u: who uses frame f; pg: the name of the page it holds, looked up in the first user's table
              const b = h('div', { class: 'box ' + (r ? (r > 1 ? 'warn' : 'mem') : ''), style: { padding: '5px 4px', fontSize: '13.5px', minHeight: '78px', opacity: r ? 1 : 0.6 } },  // b: the frame box: amber when shared, memory green when one user, faded when free
                h('div', { class: 'mono b' }, 'F' + f), h('div', {}, r ? pg : 'free'), h('div', { class: 'xs muted' }, u.join(' + ') || '—'), h('div', { class: 'xs b' }, 'refs ' + r));  // inside the box: the frame number, the page or "free", its users, and its reference count
              if (changed.includes(f)) flash(b);  // flashes the frame if the last action changed it
              return b;  // hands back the frame box
            }));  // ends the frame boxes
            const used = st.refs.filter((r) => r > 0).length;  // used: how many frames hold a page
            stats.innerHTML = `<span class="chip warn">pages copied: ${st.copies}</span><span class="chip mem">frames in use: ${used} of ${COW_NF}</span>` +  // stats badges: pages copied so far and frames in use out of 8...
              `<span class="chip">copying at fork would cost ${WR} pages up front</span>`;  // ...plus how many pages an eager fork would have copied up front, for comparison
            forkBtn.disabled = st.child !== 'none';  // fork() can be called only while there is no child
            execBtn.disabled = st.child !== 'live';  // exec() can be called only while the child is alive
            wBtns.C.forEach((b) => (b.disabled = st.child !== 'live'));  // the child's write buttons work only while the child is alive
          }  // ends draw
          function act(what, who, i) {  // act(what, who, i): runs one button's action on the model and explains the outcome
            let r, msg = '', changed = [];  // r: the model's report; msg: the explanation; changed: the frames to flash
            if (what === 'reset') { st = cowNew(); msg = 'Back to the start: P alone, using frames F0–F3.'; }  // reset: a fresh model with the parent alone
            else if (what === 'fork') {  // the student pressed Call fork()
              r = cowFork(st);  // runs fork() on the model
              changed = [0, 1, 2, 3];  // all four of the parent's frames change (their counts go to 2)
              msg = `<b>fork():</b> the kernel built C’s page table as a copy of P’s (${r.shared} entries) and copied <b>0 pages</b>. Every frame now has reference count 2. The ${r.marked} writable pages (data, heap, stack) are marked <b>copy on write in both tables</b>; code is read-only, so it is simply shared.`;  // explains: a copied page table, no copied pages, counts of 2, and copy on write for the writable pages only
            } else if (what === 'exec') {  // the student pressed Child calls exec()
              r = cowExec(st);  // runs exec() on the model
              changed = [0, 1, 2, 3].concat(r.freed);  // flashes the four original frames and any frame exec freed
              msg = `<b>C calls exec():</b> it throws away its whole old address space. Every frame it was using loses one reference${r.freed.length ? `, and ${r.freed.map((f) => 'F' + f).join(', ')} (C’s private ${r.freed.length > 1 ? 'copies' : 'copy'}) drop${r.freed.length > 1 ? '' : 's'} to 0 and become${r.freed.length > 1 ? '' : 's'} free` : ''}. Copies made so far: <b>${st.copies}</b>; an eager fork would have copied ${WR} pages only to discard them now.`;  // explains: C drops its old pages, its private copies become free, and the copies an eager fork would have wasted
            } else {  // otherwise it is a write
              const pn = COW_PAGES[i].name, nm = who;  // pn: the page's name; nm: the writer ('P' or 'C')
              r = cowWrite(st, who, i);  // runs the write on the model
              if (r.k === 'prot') msg = `<b>${nm} writes its ${pn} page:</b> Protect says read-only, so the hardware traps and the kernel refuses (the program would be stopped with a memory-protection error). Copy on write never applies to code: nobody may write it.`;  // a write to code: a protection fault, refused, never copied
              else if (r.k === 'plain') { changed = [r.frame]; msg = `<b>${nm} writes its ${pn} page:</b> Copy on write is 0, so the write goes straight into F${r.frame} and the hardware sets Modify = 1. No kernel help needed.`; }  // a write to an unshared page: it goes straight into the frame and sets Modify
              else if (r.k === 'copy') { changed = [r.from, r.to]; msg = `<b>${nm} writes its ${pn} page:</b> COW = 1 and F${r.from} has reference count 2, so the hardware traps to the kernel. The kernel <b>copies F${r.from} into free frame F${r.to}</b>, points ${nm}’s entry at F${r.to} with COW = 0 and M = 1, and lowers F${r.from}’s count to ${r.left}. The write then lands in F${r.to}; ${nm === 'P' ? 'C' : 'P'} still sees the old contents in F${r.from}.`; }  // a write to a shared copy-on-write page: the kernel copies the frame, repoints the writer, and the other process keeps the old one
              else if (r.k === 'last') { changed = [r.frame]; msg = `<b>${nm} writes its ${pn} page:</b> COW is still 1, but F${r.frame}’s reference count is 1: ${nm} is its only user. <b>No copy is needed</b>: the kernel just clears COW and lets the write go ahead in F${r.frame}.`; }  // the last user of a copy-on-write frame writes: no copy, the kernel just clears the bit
              else if (r.k === 'nochild') msg = 'There is no child to write: call fork() first.';  // the child's write buttons were used with no child
              else msg = 'No free frame is left for a copy (this demo has only 8).';  // no free frame left for a copy
            }  // ends the action cases
            draw(changed);  // redraws, flashing the frames that changed
            narr.innerHTML = msg;  // shows the explanation
          }  // ends act
          const wRow = (who) => h('div', { class: 'row', style: { gap: '5px' } }, h('span', { class: 'small b', style: { width: '74px' } }, who + ' writes:'),  // wRow(who): a row with a "P writes:" or "C writes:" label...
            ...COW_PAGES.map((pg, i) => { const b = h('button', { class: 'btn sm ' + (who === 'P' ? 'os' : 'proc'), onclick: () => act('write', who, i) }, pg.name); wBtns[who].push(b); return b; }));  // ...and one write button per page, in the kernel colour for P and the process colour for C; each is kept in wBtns
          const rows = [wRow('P'), wRow('C')];  // rows: the parent's and the child's write rows
          draw();  // draws the starting state
          narr.innerHTML = '<b>P is running alone</b> in frames F0–F3. Call fork(), then make the parent or the child write. Predict each time: will a page be copied?';  // starting explanation: P is alone, what to do, and the question to predict each time
          el.append(h('div', { class: 'split l fill' },  // lays out step 4 in two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: the explanation and the controls
              h('p', { class: 'm0', html: '<code>fork()</code> must give the child its own copy of the parent’s memory. Copying every page at once is slow, and often wasted: many children call <code>exec()</code> straight away and throw the copy out.' }),  // paragraph: copying every page at fork() is slow and often wasted because the child calls exec()
              h('p', { class: 'm0', html: 'With <span class="t">copy on write</span> the two processes share every frame, and a page is copied only when someone actually writes it, and only for the writer. Each frame’s <span class="t">reference count</span> says how many processes use it.' }),  // paragraph: with copy on write the frames are shared and a page is copied only for a process that writes it
              h('div', { class: 'row', style: { gap: '8px' } }, forkBtn, execBtn, h('button', { class: 'btn sm ghost', onclick: () => act('reset') }, 'Reset')),  // the control row: Call fork(), Child calls exec(), and a quiet Reset button
              ...rows, narr),  // the two write rows and the explanation card; closes the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the page tables, the frames and a summary of the rules
              h('div', { class: 'grid-2', style: { gap: '10px' } }, tabBox.P, tabBox.C),  // the parent's and the child's page tables side by side
              h('h4', { class: 'm0' }, 'Physical frames (amber = shared by two processes)'), framesRow, stats,  // heading for the frame boxes (amber means shared), then the frames and the counters
              h('div', { class: 'card tight small', style: { flex: 'none' } }, h('div', { class: 'b', style: { marginBottom: '3px' } }, 'What a write does, read straight from the fields'),  // a card that sums up what a write does...
                h('ul', { class: 'm0', style: { lineHeight: '1.45' }, html: '<li>Protect = read-only → refused (an error, never a copy).</li><li>COW = 0 → write in place; the hardware sets M = 1.</li><li>COW = 1 and the frame’s reference count &gt; 1 → <b>copy</b> the page for the writer, then write.</li><li>COW = 1 but the count is 1 → the writer is the last user: clear COW, no copy.</li><li>Reads never copy anything.</li>' })))));  // ...as a list of five rules read from the fields: protect, COW 0, COW 1 and shared, COW 1 and last user, reads; closes the layout
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------- 5. The two-handed clock ---------------- */
      {  // step 5 begins
        title: 'The two-handed clock: a page must prove it is still used',  // step 5 title
        kind: 'explore',  // an Explore step
        core: true,  // on the core path
        render(el, ctx) {  // render(el, ctx): draws step 5 when the student arrives
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          let st = clkNew(), hs = 4, sr = 2, timer = null, gen = 0;  // st: the clock model's state; hs: handspread (4 pages); sr: scanrate (2 pages a second); timer: the play timer; gen counts play sessions
          const CC = { hot: 'ok', warm: 'cpu', cool: 'warn', idle: 'muted' };  // CC: the colour for each kind of page: hot green, warm blue, cool amber, idle grey
          const CX = 260, CY = 196, RR = 160, ang = (i) => (-90 + (i * 360) / CLK_N) * Math.PI / 180;  // CX, CY: the centre of the ring; RR: its radius; ang(i): the angle of frame i, starting at the top and going clockwise
          const pos = (i, r) => [CX + r * Math.cos(ang(i)), CY + r * Math.sin(ang(i))];  // pos(i, r): the x, y point at distance r from the centre in the direction of frame i
          const svg = s('svg', { viewBox: ctx.narrow ? '66 0 388 392' : '0 0 520 392', width: '100%' });  // the picture: 520 by 392 units on desktop; on a small screen the empty side margins are cut off so the ring draws larger
          const wedge = s('path', { style: 'fill:var(--accent-bg);stroke:none;opacity:.9' });  // wedge: the shaded slice between the two hands, showing the handspread
          const handF = s('line', { class: 's-line', 'stroke-width': 4, 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)' });  // handF: the front hand, a thick accent-coloured line with an arrowhead
          const handB = s('line', { class: 's-line', 'stroke-width': 4, 'marker-end': 'url(#arr-warn)', style: 'stroke:var(--warn)' });  // handB: the back hand, the same in amber
          const labF = s('text', { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-acc' }, 'front');  // labF: the "front" label that follows the front hand
          const labB = s('text', { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-warn' }, 'back');  // labB: the "back" label that follows the back hand
          const tTxt = s('text', { x: CX, y: CY + 6, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800 }, '');  // tTxt: the simulated time, written in the middle of the ring
          const PB = st.pages.map((p, i) => {  // PB: the drawing pieces for each of the 16 pages
            const [x, y] = pos(i, RR);  // x, y: where page i sits on the ring
            const o = { box: s('rect', { x: x - 25, y: y - 19, width: 50, height: 38, rx: 7, 'stroke-width': 1.5 }), bar: s('rect', { x: x - 25, y: y - 19, width: 50, height: 7, rx: 3 }),  // box: the page's rectangle; bar: a coloured strip along its top showing how often the page is used
              num: s('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'P' + i), r: s('text', { x, y: y + 16, 'text-anchor': 'middle', 'font-size': 12, class: 's-monot' }, '') };  // num: the page's name (P0 to P15); r: a small fixed-width line showing its reference bit or "freed"
            o.g = hotGroup(ctx, () => touch(i), `Use page ${i}`, o.box, o.bar, o.num, o.r);  // g: wraps the pieces in a clickable group; clicking it uses the page, as the program would
            return o;  // hands back the pieces of this page
          });  // ends PB
          svg.append(wedge, handF, handB, s('circle', { cx: CX, cy: CY, r: 34, class: 's-panel' }), tTxt, labF, labB, ...PB.map((o) => o.g));  // puts it all in the picture: wedge, hands, a centre disc, the time, the hand labels and the 16 pages
          const winOut = h('div', { class: 'card tight', style: { flex: 'none' } });  // winOut: the card that shows the window, the time a page has to be used again
          const narr = h('div', { class: 'card tight small', style: { minHeight: '72px', flex: 'none', lineHeight: '1.45' } });  // narr: the card that explains each move; a fixed minimum height keeps the layout steady
          const catRow = h('div', { class: 'grid-4', style: { gap: '6px' } });  // catRow: four small cards, one per kind of page, with their counts
          const playBtn = h('button', { class: 'btn sm primary', onclick: () => (timer ? stop() : play()) }, 'Play');  // playBtn: starts or pauses automatic movement of the hands
          function draw() {  // draw(): redraws the clock, the window card and the counts from the current state
            const front = (st.back + hs) % CLK_N, a0 = ang(st.back), a1 = ang(front), r = RR - 30;  // front: where the front hand is; a0, a1: the angles of the two hands; r: the radius of the shaded wedge
            const span = ((front - st.back + CLK_N) % CLK_N) * 360 / CLK_N;  // span: the angle covered from the back hand forward to the front hand
            wedge.setAttribute('d', `M${CX},${CY} L${CX + r * Math.cos(a0)},${CY + r * Math.sin(a0)} A${r},${r} 0 ${span > 180 ? 1 : 0} 1 ${CX + r * Math.cos(a1)},${CY + r * Math.sin(a1)} Z`);  // the wedge's outline: centre, out to the back hand, along an arc to the front hand, back to centre (the long way when span > 180)
            const [fx, fy] = pos(front, RR - 44), [bx, by] = pos(st.back, RR - 44);  // fx, fy and bx, by: the tips of the front and back hands, a little inside the ring of pages
            Object.entries({ x1: CX, y1: CY, x2: fx, y2: fy }).forEach(([k, v]) => handF.setAttribute(k, v));  // points the front hand from the centre to its tip
            Object.entries({ x1: CX, y1: CY, x2: bx, y2: by }).forEach(([k, v]) => handB.setAttribute(k, v));  // points the back hand the same way
            const lab = (t, i, side) => { const [x, y] = pos(i, 84), a = ang(i); t.setAttribute('x', x - side * 22 * Math.sin(a)); t.setAttribute('y', y + side * 22 * Math.cos(a) + 5); };  // lab(t, i, side): puts a hand's label beside the hand, pushed sideways so the two labels do not cover each other
            lab(labF, front, 1); lab(labB, st.back, -1);  // places the front label on one side of its hand and the back label on the other side of its own
            tTxt.textContent = ctx.util.fmt(st.t / 1000, 3) + ' s';  // writes the simulated time in seconds in the middle, with up to 3 decimal places
            st.pages.forEach((p, i) => {  // updates every page's drawing
              const o = PB[i];  // o: the drawing pieces of page i
              o.box.setAttribute('class', p.inMem ? 's-mem' : 's-panel');  // a page in memory is drawn in the memory colour; a freed one plain
              o.box.setAttribute('stroke-dasharray', p.inMem ? '' : '4 3');  // a freed page gets a dashed outline
              o.bar.setAttribute('style', `fill:var(--${CC[p.cat]});stroke:none;opacity:${p.inMem ? 1 : 0.35}`);  // colours the top strip by kind of page, faded when the page is freed
              o.r.textContent = p.inMem ? 'R=' + p.R : 'freed';  // shows R=1 or R=0 for a page in memory, or "freed"
              o.r.setAttribute('class', p.inMem ? (p.R ? 's-monot tx-ok' : 's-monot') : 's-monot tx-muted');  // a set bit shows in green, a clear one plain, "freed" in grey
              o.g.style.opacity = p.inMem ? '1' : '0.75';  // fades freed pages slightly
            });  // ends the loop over pages
            const W = (hs * 1000) / sr, safe = Object.keys(CLK_CAT).filter((c) => CLK_CAT[c].every && CLK_CAT[c].every <= W);  // W: the window in ms, handspread divided by scanrate; safe: the kinds of page used at least once every W, which the clock always keeps
            winOut.innerHTML = `<div class="row" style="gap:10px"><span class="big" style="font-size:30px">${ctx.util.fmt(W / 1000, 3)} s</span>` +  // writes the window in large type...
              `<span class="small">window = handspread ÷ scanrate = ${hs} ÷ ${sr} pages/s.<br>Always kept: <b>${safe.length ? safe.map((c) => CLK_CAT[c].label).join(', ') : 'nothing that is used'}</b>${safe.length ? ' (used at least every ' + ctx.util.fmt(W / 1000, 3) + ' s)' : ''}.</span></div>`;  // ...with how it is worked out, and which kinds of page are always kept
            catRow.replaceChildren(...Object.entries(CLK_CAT).map(([c, d]) => h('div', { class: 'card tight', style: { padding: '5px 8px', borderTop: `4px solid var(--${CC[c]})` } },  // rebuilds the four kind cards, each with a top edge in its colour...
              h('div', { class: 'small b' }, d.label), h('div', { class: 'xs muted' }, d.name), h('div', { class: 'xs' }, `freed ${st.freedBy[c]} · back ${st.faultBy[c]}`))));  // ...its label, how often it is used, and how many of its pages were freed and faulted back
            playBtn.innerHTML = timer ? 'Pause' : 'Play';  // the play button reads Pause while running, Play otherwise
          }  // ends draw
          function tickOnce() {  // tickOnce(): one move of the hands, then explains it
            const ev = clkTick(st, hs, sr), W = ctx.util.fmt((hs * 1000) / sr / 1000, 3);  // ev: what the move did; W: the window in seconds, for the text
            let m = `<b>t = ${ctx.util.fmt(st.t / 1000, 3)} s.</b> `;  // the explanation starts with the new simulated time
            if (ev.faulted.length) m += `Page${ev.faulted.length > 1 ? 's' : ''} ${ev.faulted.join(', ')} ${ev.faulted.length > 1 ? 'were' : 'was'} needed again after being freed: <b class="c-bad">page fault</b>, read back in. `;  // reports any freed page that the program needed again: a page fault that reads it back in
            m += ev.cleared ? `Front hand clears page ${ev.front}’s reference bit${ev.frontWas ? '' : ' (already 0)'}. ` : `Front hand passes page ${ev.front} (already freed). `;  // what the front hand did: cleared a bit (noting if it was already 0) or passed a freed page
            if (ev.result === 'freed') m += `Back hand finds page ${ev.back} still at R = 0: unused for the last ${W} s, so it goes on the <b>page-out list</b>.`;  // back hand found R = 0: unused for a whole window, so the page goes on the page-out list
            else if (ev.result === 'kept') m += `Back hand finds page ${ev.back} at R = 1: it was used during the window, so it <b class="c-ok">stays</b>.`;  // back hand found R = 1: the page was used during the window and stays
            else m += `Back hand passes page ${ev.back} (already freed).`;  // back hand passed a page already freed
            narr.innerHTML = m;  // shows the explanation
            draw();  // redraws the clock
          }  // ends tickOnce
          function play() { const g = ++gen; timer = ctx.every(750, () => { if (g === gen) tickOnce(); }); draw(); }  // play(): starts a new play session that moves the hands every 0.75 s; a tick from an older session is ignored
          function stop() { gen++; if (timer) clearInterval(timer); timer = null; draw(); }  // stop(): ends the session, stops the timer, and redraws so the button reads Play
          function touch(i) {  // touch(i): the student clicks page i to use it
            const fault = clkTouch(st, i);  // fault: whether the page had been freed and had to come back
            narr.innerHTML = fault ? `<b>You used page ${i}</b>, but it had been freed: a <b class="c-bad">page fault</b> brings it back in with R = 1.` : `<b>You used page ${i}</b>: the hardware sets its reference bit to 1, so the back hand will keep it on its next visit (unless the front hand clears the bit first and no use follows).`;  // explains either the page fault or the reference bit being set, and what that means for the back hand
            draw();  // redraws the clock
          }  // ends touch
          const hsSl = ctx.ui.slider({ label: '<span class="t">Handspread</span>', min: 1, max: 8, value: hs, format: (v) => v + ' pages', onInput: (v) => { hs = v; draw(); } });  // hsSl: the handspread slider, 1 to 8 pages; moving it redraws the hands and the window
          const srSeg = ctx.ui.seg([1, 2, 4, 8].map((v) => ({ value: v, label: v + '/s' })), sr, (v) => { sr = v; draw(); });  // srSeg: the scanrate switch, 1, 2, 4 or 8 pages a second; changing it updates the window
          const reset = () => { stop(); st = clkNew(); narr.innerHTML = 'Reset: every page in memory with R = 1, the back hand at page 0.'; draw(); };  // reset(): stops, starts a fresh clock model, and says so
          const ff = () => { stop(); const f0 = st.freed, b0 = st.faults, t0 = st.t; while (st.t < t0 + 60000) clkTick(st, hs, sr); narr.innerHTML = `<b>60 simulated seconds later:</b> ${st.freed - f0} pages paged out; ${st.faults - b0} page faults when a freed page was wanted again. A short window frees memory faster but evicts pages still in use.`; draw(); };  // ff(): stops, runs 60 simulated seconds at once, and reports how many pages were freed and how many faulted back
          draw();  // draws the starting clock
          narr.innerHTML = 'Press <b>Play</b> or <b>Step</b>. Click any page to use it yourself. Coloured bars show how often the program uses each page.';  // starting instructions: Play or Step, click a page to use it, and what the coloured bars mean
          el.append(h('div', { class: 'split fill' },  // lays out step 5 in two equal columns, filling the step's height
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation and the controls
              h('p', { class: 'm0', html: 'When free memory runs low, the <span class="t">page daemon</span> sweeps the frames with a <span class="t">two-handed clock</span>. The <b class="c-acc">front hand</b> clears each page’s <span class="t">reference bit</span>. The <b class="c-warn">back hand</b>, a fixed distance behind, checks it: still 0 means “not used since the front hand passed”, so the page goes on the page-out list; 1 means it was used, so it stays.' }),  // paragraph: the page daemon, the front hand that clears bits and the back hand that checks them
              hsSl, h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b', html: '<span class="t">Scanrate</span>' }), srSeg),  // the handspread slider, then a row with the scanrate label and switch
              winOut,  // the window card
              h('div', { class: 'row', style: { gap: '6px' } }, playBtn, h('button', { class: 'btn sm', onclick: () => { stop(); tickOnce(); } }, 'Step'),  // the play row: Play/Pause, Step (one move)...
                h('button', { class: 'btn sm', onclick: ff }, 'Fast-forward 60 s'), h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // ...Fast-forward 60 s and Reset
              narr,  // the explanation card
              h('div', { class: 'callout why m0 small', 'data-label': 'Why two hands?', html: 'With one hand (the clock policy of 8.2) a bit is checked only after a full lap. With millions of frames a lap takes so long that nearly every bit is set again by then. A second hand fixes the wait, however big memory is.' })),  // why-callout: one hand checks a bit only after a full lap, which takes too long with huge memories; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white', style: { padding: '4px 6px' } }, svg), catRow)));  // right column: the clock on a white card, with the kind cards below; closes the layout
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------- 6. How fast should the hands move? ---------------- */
      {  // step 6 begins
        title: 'How fast should the hands move? Free memory decides',  // step 6 title
        kind: 'explore',  // an Explore step
        render(el, ctx) {  // render(el, ctx): draws step 6 when the student arrives
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          const fmt = (v, d = 2) => ctx.util.fmt(v, d);  // fmt(v, d): rounds v to d decimal places and adds thousands commas, using the guide's shared helper
          let free = 2500, spread = 2000;  // free: the free memory being tried, in pages; spread: the handspread, in pages
          const F = ctx.narrow ? 1.45 : 1;   // bigger graph text on small screens
          const XMAX = 6000, X0 = 64, X1 = 580, Y0 = 236, Y1 = 30;  // the graph's frame: free memory runs 0 to 6,000 pages; X0, X1 are its left and right edges, Y0 its bottom, Y1 its top
          const xOf = (f) => X0 + (f / XMAX) * (X1 - X0), yOf = (r) => Y0 - (r / SCAN.fastscan) * (Y0 - Y1);  // xOf(f): the x position for f free pages; yOf(r): the y position for a scanrate of r (fastscan at the top)
          const svg = s('svg', { viewBox: '0 0 600 284', width: '100%' });  // the graph: 600 by 284 drawing units, stretched to the card's width
          const kids = [s('line', { x1: X0, y1: Y0, x2: X1 + 6, y2: Y0, class: 's-line', 'marker-end': 'url(#arr)' }), s('line', { x1: X0, y1: Y0, x2: X0, y2: Y1 - 14, class: 's-line', 'marker-end': 'url(#arr)' })];  // kids: the fixed parts of the graph, starting with the horizontal and vertical axes, each ending in an arrowhead
          [0, 250, 500, 750, 1000].forEach((r) => kids.push(s('line', { x1: X0 - 4, y1: yOf(r), x2: X1, y2: yOf(r), class: 's-muted', 'stroke-width': 1 }), s('text', { x: X0 - 8, y: yOf(r) + 5, 'text-anchor': 'end', 'font-size': 13 * F, class: 's-sub' }, String(r))));  // faint grid lines and labels for scanrates 0, 250, 500, 750 and 1,000 pages a second along the left side
          [0, 1000, 2000, 3000, 4000, 5000, 6000].forEach((f) => kids.push(s('text', { x: xOf(f), y: Y0 + 18, 'text-anchor': f === XMAX ? 'end' : 'middle', 'font-size': 13 * F, class: 's-sub' }, f.toLocaleString('en-US'))));  // labels for free memory every 1,000 pages along the bottom (the last one right-aligned so it stays inside)
          kids.push(s('text', { x: (X0 + X1) / 2, y: Y0 + 40, 'text-anchor': 'middle', 'font-size': 14 * F, 'font-weight': 700 }, 'Free memory (pages)'));  // the bottom axis title: free memory in pages
          [['minfree', SCAN.minfree], ['lotsfree', SCAN.lotsfree]].forEach(([n, f]) => kids.push(s('line', { x1: xOf(f), y1: Y0, x2: xOf(f), y2: Y1 - 4, class: 's-muted', 'stroke-dasharray': '5 4', style: 'stroke:var(--os)' }),  // a dashed purple line at each threshold, minfree and lotsfree...
            s('text', { x: xOf(f), y: Y1 - 10, 'text-anchor': 'middle', 'font-size': 13 * F, 'font-weight': 700, class: 'tx-os' }, n)));  // ...with its name above it
          const curve = [[0, SCAN.fastscan], [SCAN.minfree, SCAN.fastscan], [SCAN.lotsfree, SCAN.slowscan]];  // curve: the corners of the scanrate line: fastscan from 0 to minfree, then down to slowscan at lotsfree
          kids.push(s('path', { d: 'M' + curve.map(([f, r]) => `${xOf(f)},${yOf(r)}`).join(' L') + ` M${xOf(SCAN.lotsfree)},${yOf(0)} L${xOf(XMAX)},${yOf(0)}`, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 3 }),  // draws that line in the chapter colour, then a second piece along 0 from lotsfree to the right edge
            s('text', { x: xOf(5000), y: yOf(0) - 10, 'text-anchor': 'middle', 'font-size': 13 * F, class: 's-sub' }, 'daemon asleep'),  // label on the flat piece: the daemon is asleep there
            s('text', { x: xOf(SCAN.lotsfree) + 6, y: yOf(SCAN.slowscan) - 6, 'font-size': 13 * F, class: 's-sub' }, 'slowscan ' + SCAN.slowscan),  // label at the lotsfree corner: the slowscan value
            s('text', { x: X0 + 4, y: yOf(SCAN.fastscan) + 20, 'font-size': 13 * Math.min(F, 1.32), class: 's-sub' }, 'fastscan'));  // label on the top piece: fastscan (its size capped so it fits beside the axis)
          const guideV = s('line', { class: 's-muted', 'stroke-dasharray': '3 3', 'stroke-width': 1.5 }), guideH = s('line', { class: 's-muted', 'stroke-dasharray': '3 3', 'stroke-width': 1.5 });  // guideV and guideH: dotted lines from the axes to the chosen point, so its two values can be read off
          const dot = s('circle', { r: 7, style: 'fill:var(--accent);stroke:var(--panel)', 'stroke-width': 2 });  // dot: the accent-coloured marker on the line at the chosen free memory
          const dotLab = s('text', { 'font-size': 14 * F, 'font-weight': 800, class: 'tx-acc' }, '');  // dotLab: the label next to the dot giving the scanrate
          svg.append(...kids, guideV, guideH, dot, dotLab);  // puts the fixed parts, the guide lines, the dot and its label into the graph
          const calc = h('div', { class: 'card tight small', style: { lineHeight: '1.55', flex: 'none' } });  // calc: the card that shows the worked calculation
          const pA = 3000, pB = 1500, rA = scanRate(pA), rB = scanRate(pB);  // the two free-memory levels used in the prediction question (3,000 and 1,500 pages), with their scanrates
          const predict = h('p', { class: 'small m0' });  // predict: the answer to the prediction question, hidden until revealed
          const big = h('div', { class: 'row', style: { gap: '18px' } });  // big: the row with the two large results
          function update() {  // update(): recomputes everything when a slider moves
            const r = scanRate(free), x = xOf(free), y = yOf(r);  // r: the scanrate for the current free memory; x, y: the matching point on the graph
            [['x1', x], ['y1', Y0], ['x2', x], ['y2', y]].forEach(([k, v]) => guideV.setAttribute(k, v));  // moves the vertical guide from the bottom axis up to the point
            [['x1', X0], ['y1', y], ['x2', x], ['y2', y]].forEach(([k, v]) => guideH.setAttribute(k, v));  // moves the horizontal guide from the left axis across to the point
            dot.setAttribute('cx', x); dot.setAttribute('cy', y);  // moves the dot to the point
            dotLab.textContent = r ? fmt(r, 0) + ' pages/s' : 'no scanning';  // the dot's label: the scanrate in pages a second, or "no scanning"
            dotLab.setAttribute('x', x + (x > 420 ? -12 : 12)); dotLab.setAttribute('y', y - 12); dotLab.setAttribute('text-anchor', x > 420 ? 'end' : 'start');  // places the label to the right of the dot, or to its left when the dot is near the right edge
            let how;  // how will hold the calculation text
            if (free >= SCAN.lotsfree) how = `Free memory ${free.toLocaleString('en-US')} ≥ lotsfree ${SCAN.lotsfree.toLocaleString('en-US')}: the page daemon <b>sleeps</b>. No hands move, no pages are taken.`;  // at or above lotsfree: the page daemon sleeps and the hands do not move
            else if (free <= SCAN.minfree) how = `Free memory ${free.toLocaleString('en-US')} ≤ minfree ${SCAN.minfree.toLocaleString('en-US')}: the hands run at <b>fastscan = ${SCAN.fastscan} pages/s</b>, as fast as they ever go.`;  // at or below minfree: the hands run at fastscan, their top speed
            else how = `Between the thresholds the rate is a straight line:<br>scanrate = slowscan + (fastscan − slowscan) × (lotsfree − free) ÷ (lotsfree − minfree)<br>= ${SCAN.slowscan} + ${SCAN.fastscan - SCAN.slowscan} × (${SCAN.lotsfree} − ${free}) ÷ ${SCAN.lotsfree - SCAN.minfree} = <b>${fmt(r, 1)} pages/s</b>`;  // in between: the straight-line formula, written out with the current numbers filled in
            calc.innerHTML = how + (r ? `<br>window = handspread ÷ scanrate = ${spread.toLocaleString('en-US')} ÷ ${fmt(r, 1)} = <b>${fmt(spread / r, 2)} s</b>` : '');  // fills the card, adding the window (handspread divided by scanrate) whenever the hands are moving
            predict.innerHTML = `With handspread ${spread.toLocaleString('en-US')}: scanrate goes from ${fmt(rA, 1)} to ${fmt(rB, 1)} pages/s, so the window shrinks from ${fmt(spread / rA, 2)} s to ${fmt(spread / rB, 2)} s. Halving free memory more than halves the time a page gets: less free memory → faster hands → shorter window → more pages freed.`;  // the prediction answer: free memory halves, but the window shrinks by more than half
            big.innerHTML = `<div><div class="xs muted b">SCANRATE</div><div class="big" style="font-size:32px">${r ? fmt(r, 0) : '0'}<span class="small muted"> pages/s</span></div></div>` +  // big results: the scanrate...
              `<div><div class="xs muted b">TIME A PAGE HAS TO BE USED AGAIN</div><div class="big" style="font-size:32px">${r ? fmt(spread / r, 2) + '<span class="small muted"> s</span>' : '—'}</div></div>`;  // ...and the time a page has to be used again (a dash while the daemon sleeps)
          }  // ends update
          const sF = ctx.ui.slider({ label: 'Free memory', min: 0, max: XMAX, step: 100, value: free, format: (v) => v.toLocaleString('en-US') + ' pages', onInput: (v) => { free = v; update(); } });  // sF: the free memory slider, 0 to 6,000 pages in steps of 100
          const sH = ctx.ui.slider({ label: 'Handspread', min: 500, max: 4000, step: 250, value: spread, format: (v) => v.toLocaleString('en-US') + ' pages', onInput: (v) => { spread = v; update(); } });  // sH: the handspread slider, 500 to 4,000 pages in steps of 250
          update();  // fills the graph and the cards for the starting values
          el.append(h('div', { class: 'split l fill' },  // lays out step 6 in two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: the explanation and the controls
              h('p', { class: 'm0', html: 'The <span class="t">scanrate</span> is not fixed. The kernel compares the number of free pages with two <span class="t" data-t="Free-memory thresholds">thresholds</span>:' }),  // paragraph: the scanrate depends on free memory compared with two thresholds
              h('ul', { class: 'm0 small', style: { lineHeight: '1.5' }, html: '<li><b>lotsfree</b>: at or above it, memory is plentiful and the page daemon sleeps.</li><li>Below it the hands start at <b>slowscan</b> and speed up in a straight line, reaching <b>fastscan</b> once free memory is down to <b>minfree</b>.</li>' }),  // list: lotsfree, where the daemon sleeps, and the climb from slowscan to fastscan at minfree
              sF, sH, big,  // the two sliders and the big results
              h('p', { class: 'small b m0' }, `Predict: free memory falls from ${pA.toLocaleString('en-US')} to ${pB.toLocaleString('en-US')} pages. Does the window halve, shrink by more, or by less?`),  // the prediction question: does the window halve, shrink by more, or by less?
              ctx.ui.reveal('Show the answer', predict)),  // a button that reveals the answer; closes the left column
            h('div', { class: 'stack' }, h('div', { class: 'card white', style: { padding: '6px 8px' } }, h('div', { class: 'small b', style: { margin: '2px 0 0 4px' } }, 'Scanrate (pages per second) against free memory'), svg), calc,  // right column: the graph on a white card with its title, then the calculation card
              h('p', { class: 'xs muted m0', html: 'The thresholds and rates here are made up for the demo. Real kernels derive them from the size of physical memory, and an administrator can tune them.' }))));  // note: the thresholds and rates are made up for the demo; real kernels set them from memory size; closes the layout
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------- 7. Kernel memory: plain buddy vs lazy buddy ---------------- */
      {  // step 7 begins
        title: 'Kernel memory: plain buddy versus lazy buddy',  // step 7 title
        kind: 'compare',  // a Compare step
        render(el, ctx) {  // render(el, ctx): draws step 7 when the student arrives
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          const RUN = [budRun(false, BURST), budRun(true, BURST)], N = BURST.length;  // RUN: every snapshot of the request burst, run once on a plain buddy and once on a lazy one; N: the number of requests
          const opTxt = (op) => (op[0] === 'a' ? `${op[1]} asks for ${op[2]} bytes` : `${op[1]} is freed`);  // opTxt(op): a request in words, such as "P1 asks for 32 bytes" or "P1 is freed"
          const VW = ctx.narrow ? 360 : 640;  // VW: the drawing width, 640 units on desktop and 360 on a small screen
          const svg = s('svg', { viewBox: `0 0 ${VW} 206`, width: '100%' });  // the picture: VW by 206 units, stretched to the card's width
          const BX = 20, BW = VW - 40, SC = BW / BUD_TOTAL;  // BX: the left edge of each memory bar; BW: its width; SC: drawing units per byte
          const bars = [{ y: 30, name: ctx.narrow ? 'Plain buddy' : 'Plain buddy: merges at once' }, { y: 136, name: ctx.narrow ? 'Lazy buddy' : 'Lazy buddy: merges only when needed' }].map((b) => Object.assign(b, {  // bars: the two memory bars, plain on top and lazy below, each with a name (shorter on a small screen)...
            g: s('g'), cnt: s('text', { x: BX + BW, y: b.y - 9, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800 }, '') }));  // ...plus a group for its blocks and a counter text at its top right
          bars.forEach((b) => svg.append(s('text', { x: BX, y: b.y - 9, 'font-size': 14.5, 'font-weight': 800 }, b.name), b.cnt, b.g,  // draws each bar's name, counter and block group...
            ...[0, 64, 128, 192, 256].map((a) => s('text', { x: BX + a * SC, y: b.y + 64, 'text-anchor': a === 0 ? 'start' : a === 256 ? 'end' : 'middle', 'font-size': 12, class: 's-sub' }, String(a)))));  // ...and byte addresses 0, 64, 128, 192 and 256 under the bar
          function drawBar(bar, m) {  // drawBar(bar, m): redraws one bar from allocator snapshot m
            bar.g.replaceChildren(...budLeaves(m).map((b) => {  // replaces the bar's blocks with one drawing per block that is not split
              const x = BX + b.addr * SC, w = b.size * SC, cls = b.st === 'alloc' ? 's-proc' : b.st === 'local' ? 's-warn' : 's-panel';  // x, w: where the block starts and how wide it is; cls: process colour if given out, amber if locally free, plain if globally free
              return s('g', {}, s('rect', { x: x + 1.5, y: bar.y, width: w - 3, height: 46, rx: 6, class: cls, 'stroke-width': 1.5 }),  // the block's rounded rectangle
                s('text', { x: x + w / 2, y: bar.y + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: b.st === 'alloc' ? 'tx-proc' : b.st === 'local' ? 'tx-warn' : 's-sub' }, b.st === 'alloc' ? b.label : b.st === 'local' ? 'local' : 'free'),  // its label: the owner's name if given out, "local" if locally free, otherwise "free"
                s('text', { x: x + w / 2, y: bar.y + 38, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, b.size + ' B'));  // its size in bytes, under the label
            }));  // ends the blocks
            bar.cnt.textContent = `splits ${m.splits} · merges ${m.merges}`;  // the counter: how many splits and merges this allocator has done so far
          }  // ends drawBar
          const chips = BURST.map((op) => h('span', { class: 'chip', style: { fontSize: '12.5px', padding: '0 7px' } }, (op[0] === 'a' ? '+' : '−') + op[1]));  // chips: one small tag per request in the burst, + for an allocation and − for a free, shown as a timeline
          function say(f, lazy) {  // say(f, lazy): explains in words what one request did to one allocator
            const op = f.op, ev = f.ev;  // op: the request; ev: the moves it caused
            if (op[0] === 'a') {  // case 1: the request was an allocation
              const sp = ev.filter((e) => e.k === 'split');  // sp: the splits it needed
              if (sp.length) return `no free ${op[2]} B block, so it splits ${sp.map((e) => e.size).join(' → ')} → ${op[2]} (<b>${sp.length} split${sp.length > 1 ? 's' : ''}</b>)${lazy ? '; the spare halves are kept locally free' : ''}.`;  // if it split: the sizes split, how many splits, and (lazy) that the spare halves stay locally free
              const tk = ev.find((e) => e.k === 'take');  // tk: the move that took a block
              return tk.how === 'local' ? `reuses a <b>locally free</b> ${op[2]} B block: no split.` : `takes a free ${op[2]} B block: no split.`;  // no split: says whether it reused a locally free block or took a globally free one
            }  // ends the allocation case
            const size = ev[0].size, mg = ev.filter((e) => e.k === 'merge');  // case 2: the request was a free; size is the freed block's size; mg: the merges it caused
            const mtxt = mg.length ? `merges with its buddy into ${mg.map((e) => e.size * 2).join(' → ')} B (<b>${mg.length} merge${mg.length > 1 ? 's' : ''}</b>)` : '';  // mtxt: the merge sizes and how many merges, or nothing if none
            if (!lazy) return mg.length ? `its buddy is free, so it ${mtxt}.` : 'its buddy is still in use, so nothing merges.';  // plain buddy: either it merged with its free buddy, or the buddy is still in use and nothing merges
            const r = ev.find((e) => e.k === 'local' || e.k === 'global1' || e.k === 'global0');  // lazy buddy: r is the move that says which slack rule applied
            if (r.k === 'local') return `slack D = ${r.D0} ≥ 2, so the ${size} B block stays <b>locally free</b> (D → ${r.D1}). No merge.`;  // slack 2 or more: the block stays locally free and nothing merges; shows the slack before and after
            return `slack D = ${r.D0}, so it is freed <b>globally</b>${r.k === 'global0' ? ' and one locally free block becomes global too' : ''}; ${mg.length ? 'it ' + mtxt : 'nothing can merge yet'}.`;  // otherwise it is freed globally (at slack 0 one locally free block goes global too), then says whether anything merged
          }  // ends say
          const player = ctx.ui.player({  // player: the shared animation player, one frame per snapshot, that steps both allocators through the burst together
            count: N + 1, interval: 1500,  // N + 1 frames (the start plus one per request), advancing every 1.5 s when playing
            render(i) {  // render(i): draws frame i and returns its caption
              drawBar(bars[0], RUN[0][i].m); drawBar(bars[1], RUN[1][i].m);  // redraws the plain bar and the lazy bar from their snapshots after i requests
              chips.forEach((c, k) => { c.className = 'chip' + (k === i - 1 ? ' accent' : k < i - 1 ? '' : ' muted'); c.style.opacity = k < i ? '1' : '0.55'; });  // restyles the request tags: the current one highlighted, earlier ones plain, later ones grey and faded
              if (i === 0) return '<b>Start:</b> both allocators own one free 256-byte block. X and Y are held for the whole run; then four rounds of “two short-lived records arrive, both are freed”. In the lazy captions, D is the slack count that picks local or global freeing (next step).';  // caption for the start: both pools free, X and Y held throughout, four rounds of short-lived records, and what D means
              let cap = `<b>Request ${i} of ${N}: ${opTxt(RUN[0][i].op)}.</b><br>Plain: ${say(RUN[0][i], false)}<br>Lazy: ${say(RUN[1][i], true)}`;  // caption for request i: what was asked, then what the plain and the lazy allocator each did
              if (i === N) { const e = RUN[0][N].m, l = RUN[1][N].m; cap += `<br><b>Totals:</b> plain ${e.splits} splits + ${e.merges} merges = ${e.splits + e.merges}; lazy ${l.splits} + ${l.merges} = ${l.splits + l.merges}.`; }  // on the last frame, adds the totals of splits plus merges for each allocator, the cost being compared
              return cap;  // hands the caption to the player
            },  // ends render
          });  // closes the player settings
          player.caption.style.minHeight = '106px';  // keeps the caption box tall enough for three lines, so the controls do not jump between frames
          el.append(h('div', { class: 'split l fill' },  // lays out step 7 in two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: the explanation
              h('p', { class: 'm0', html: 'The kernel’s own requests are small, frequent and short-lived: a 40-byte timer record, a 200-byte message header, a 600-byte table. A page is 4 KB, so handing out whole pages would waste most of each one, and the paging system is far too heavy for that traffic.' }),  // paragraph: kernel requests are small, frequent and short-lived, so whole pages would waste memory
              h('p', { class: 'm0', html: 'SVR4 uses a <span class="t">buddy system</span> (7.2): blocks of 2<sup>k</sup> bytes, halved to fit a request and merged with their buddy when both are free. A plain buddy system merges at once. Yet the kernel often frees a block and asks for the same size moments later, so it splits, merges, splits again…' }),  // paragraph: the plain buddy system halves and merges at once, so the same size gets split and merged over and over
              h('p', { class: 'm0', html: 'The <span class="t">lazy buddy system</span> keeps a freed block <span class="t" data-t="Locally free block">locally free</span>: ready for reuse at its size, not allowed to merge. It coalesces only when that looks necessary, and then as much as it can (blocks allowed to merge are <span class="t" data-t="Globally free block">globally free</span>).' }),  // paragraph: the lazy buddy keeps freed blocks locally free and merges only when needed
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A café that folds every tablecloth the moment a guest leaves, though the next guest sits down a minute later. The lazy café leaves the cloth on until the rush is over.' })),  // analogy callout: a café folding tablecloths between guests versus waiting until the rush is over; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the request tags, the picture and the player
              h('div', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'xs b muted', style: { marginRight: '4px' } }, 'REQUESTS'), ...chips),  // a row with a "REQUESTS" label and one tag per request
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg,  // the two memory bars on a white card...
                h('div', { class: 'row xs', style: { gap: '8px', justifyContent: 'center' } }, h('span', { class: 'chip proc' }, 'allocated'), h('span', { class: 'chip warn' }, 'locally free (no merging)'), h('span', { class: 'chip' }, 'free (may merge)'))),  // ...with a colour key below: allocated, locally free, free; closes the card
              player.el)));  // the player's caption and controls; closes the layout
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------- 8. Inside the lazy buddy: the slack count ---------------- */
      {  // step 8 begins
        title: 'Inside the lazy buddy: local, global and the slack count',  // step 8 title
        kind: 'lab',  // a Hands-on Lab step
        render(el, ctx) {  // render(el, ctx): draws step 8 when the student arrives
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          let m = budNew(true), seq = 0, touched = [], prev = {};  // m: a fresh lazy allocator; seq numbers the blocks given out; touched: sizes the last action affected; prev: each size's slack before it
          const VW = ctx.narrow ? 360 : 640;  // VW: the drawing width, 640 units on desktop and 360 on a small screen
          const svg = s('svg', { viewBox: `0 0 ${VW} 84`, width: '100%' });  // the picture: one memory bar, VW by 84 units, stretched to the card's width
          const BX = 10, BW = VW - 20, SC = BW / BUD_TOTAL;  // BX: the bar's left edge; BW: its width; SC: drawing units per byte
          const barG = s('g');  // barG: the group that holds the bar's blocks
          svg.append(barG, ...[0, 64, 128, 192, 256].map((a) => s('text', { x: BX + a * SC, y: 80, 'text-anchor': a === 0 ? 'start' : a === 256 ? 'end' : 'middle', 'font-size': 12, class: 's-sub' }, String(a))));  // adds the block group and byte addresses 0, 64, 128, 192 and 256 under the bar
          const tblBox = h('div');  // tblBox: the box that shows the per-size counts table
          const log = h('div', { class: 'log', style: { height: '96px', fontFamily: 'var(--font)', fontSize: '13.5px' } });  // log: the scrolling box that lists every move of the last request in words
          const counts = h('div', { class: 'row', style: { gap: '6px' } });  // counts: badges with the total splits and merges
          const allocBtns = [32, 64, 128].map((z) => h('button', { class: 'btn sm proc', onclick: () => alloc(z) }, z + ' B'));  // allocBtns: buttons that ask for 32, 64 or 128 bytes
          function draw() {  // draw(): redraws the bar, the counts table and the badges from the model
            barG.replaceChildren(...budLeaves(m).map((b) => {  // replaces the bar's blocks with one drawing per block that is not split
              const x = BX + b.addr * SC, w = b.size * SC, cls = b.st === 'alloc' ? 's-proc' : b.st === 'local' ? 's-warn' : 's-panel';  // x, w: where the block starts and how wide it is; cls: process colour if given out, amber if locally free, plain if globally free
              const kids = [s('rect', { x: x + 1.5, y: 4, width: w - 3, height: 54, rx: 6, class: cls, 'stroke-width': 1.5 }),  // kids: the block's rounded rectangle...
                s('text', { x: x + w / 2, y: 26, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: b.st === 'alloc' ? 'tx-proc' : b.st === 'local' ? 'tx-warn' : 's-sub' }, b.st === 'alloc' ? b.label : w < 50 ? (b.st === 'local' ? 'loc.' : 'glob.') : b.st === 'local' ? 'local' : 'global'),  // ...its label: the owner's number if given out, else local or global (shortened when the block is small)...
                s('text', { x: x + w / 2, y: 45, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, b.size + ' B')];  // ...and its size in bytes
              return b.st === 'alloc' ? hotGroup(ctx, () => free(b.addr), `Free block ${b.label}`, ...kids) : s('g', {}, ...kids);  // a given-out block is clickable, and clicking frees it; free blocks are drawn but cannot be clicked
            }));  // ends the blocks
            const rows = BUD_SIZES.map((z) => { const c = budCounts(m, z); return [z, c]; });  // rows: each block size with its counts N, A, G, L and slack D
            tblBox.replaceChildren(h('table', { class: 'tbl compact nw' },  // replaces the box with a compact table...
              h('tr', {}, ...['Size', 'N', 'A', 'G', 'L', 'D = A − L'].map((x) => h('th', { html: x }))),  // ...whose header names the columns: size, N, A, G, L and D = A − L
              ...rows.map(([z, c]) => {  // one row per size
                const tr = h('tr', { class: touched.includes(z) ? 'on' : '' }, h('td', { class: 'b' }, z + ' B'), ...['N', 'A', 'G', 'L'].map((k) => h('td', { class: 'mono' }, String(c[k]))),  // sizes the last action touched are highlighted; each count goes in a fixed-width cell
                  h('td', { class: 'mono b', html: String(c.D) + (prev[z] != null && prev[z] !== c.D ? ` <span class="xs muted">(was ${prev[z]})</span>` : '') }));  // the slack D in bold, with its old value beside it when this action changed it
                return tr;  // hands back the row
              })));  // ends the rows and the table
            counts.innerHTML = `<span class="chip">splits ${m.splits}</span><span class="chip">merges ${m.merges}</span>`;  // the split and merge badges
          }  // ends draw
          const snap = () => { prev = {}; BUD_SIZES.forEach((z) => (prev[z] = budCounts(m, z).D)); };  // snap(): records every size's slack before an action, so the table can show what changed
          function line(e) {  // line(e): turns one move from the model into a sentence for the log
            const z = e.size + ' B';  // z: the size in words, such as "32 B"
            switch (e.k) {  // picks the sentence by kind of move
              case 'take': return e.how === 'local' ? `${z}: reuse a <b>locally free</b> block → A+1, L−1, so D rises by 2 (${e.D0} → ${e.D1}).` : `${z}: take a <b>globally free</b> block → A+1, so D rises by 1 (${e.D0} → ${e.D1}).`;  // take: reusing a locally free block raises D by 2; taking a globally free one raises it by 1
              case 'split': return `Split the ${z} block at ${e.addr} into two ${e.size / 2} B halves: one serves the request, the other is marked <b>locally free</b>. A+1 and L+1, so D at ${e.size / 2} B is unchanged (${e.D1}).`;  // split: one half serves the request, the other half is locally free, so D at the smaller size does not change
              case 'free': return `<b>Free ${e.label}</b> (${z} at address ${e.addr}).`;  // free: names the block being freed
              case 'local': return `${z}: D = ${e.D0} ≥ 2 → free it <b>locally</b>; D falls by 2 (→ ${e.D1}). No merging.`;  // local: slack 2 or more, so the block is freed locally and D falls by 2
              case 'global1': return `${z}: D = 1 → free it <b>globally</b>, so it may merge with its buddy (D → 0).`;  // global1: slack 1, so the block is freed globally and may merge
              case 'global0': return `${z}: D = 0 → free it <b>globally</b>, and also make one locally free ${z} block global (D stays 0).`;  // global0: slack 0, so it is freed globally and one locally free block of that size becomes global too
              case 'promote': return `${z}: the locally free block at ${e.addr} becomes <b>globally free</b>.`;  // promote: which locally free block became globally free
              case 'merge': return `Two globally free ${z} buddies <b>merge</b> into ${e.size * 2} B at ${e.addr}. That split block counted as allocated, so it is now freed at ${e.size * 2} B by the same rules.`;  // merge: two globally free buddies join, and the rebuilt parent is freed at its own size by the same rules
              case 'slack': return `${z}: slack is now D = ${e.D1}.`;  // slack: the slack for this size after the whole free
              default: return '';  // any other move gives no sentence
            }  // ends the switch
          }  // ends line
          function show(ev, head) {  // show(ev, head): writes the log for one action and redraws
            touched = [...new Set(ev.map((e) => e.size).concat(ev.filter((e) => e.k === 'split').map((e) => e.size / 2)))];  // touched: every size the moves affected, including the halves made by a split
            log.innerHTML = (head ? `<div>${head}</div>` : '') + ev.map((e) => `<div>${line(e)}</div>`).join('');  // the optional heading line, then one line per move
            draw();  // redraws the bar and the table
          }  // ends show
          function alloc(z) {  // alloc(z): runs when the student asks for z bytes
            snap();  // records the slack values before the request
            const r = budAlloc(m, z, '#' + (seq + 1));  // asks the model for z bytes, naming the block with the next number (#1, #2...)
            if (!r.ok) {  // the request failed: no block of this size could be found or made
              const freeBytes = budLeaves(m).filter((b) => b.st !== 'alloc').reduce((a, b) => a + b.size, 0);  // freeBytes: how many bytes of the pool are free, in any state
              touched = [];  // no size is highlighted
              log.innerHTML = `<div><b>No ${z} B block can be made.</b> ${freeBytes >= z ? `${freeBytes} B are free in total, but every free piece is smaller than ${z} B, and no two of them are globally free buddies that could merge.` :`Only ${freeBytes} B of this 256 B pool are free.`} A real kernel would now ask the paging system for another page.</div>`;  // explains why: free pieces too small and none able to merge, or too little free at all; a real kernel would get another page
              draw(); return;  // redraws and stops here
            }  // ends the failure case
            seq++;  // counts the new block
            show(r.ev, `<b>Allocate ${z} B → block #${seq} at address ${r.addr}.</b>`);  // logs the request and every move it caused
          }  // ends alloc
          function free(addr) { snap(); show(budFree(m, addr).ev); }  // free(addr): runs when the student clicks a given-out block; records the slack, frees it, and logs the moves
          function reset() { m = budNew(true); seq = 0; prev = {}; touched = []; log.innerHTML = '<div>One globally free 256 B block. Allocate something, then click a teal block to free it.</div>'; draw(); }  // reset(): a fresh lazy allocator with one globally free 256-byte block, cleared counters, and the starting instructions
          reset();  // starts the lab from that fresh state
          el.append(h('div', { class: 'split l fill' },  // lays out step 8 in two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: the counting rules, the slack formula and the rule table
              h('p', { class: 'm0', html: 'For each block size 2<sup>i</sup> the allocator counts <b>N</b> blocks: <b>A</b> allocated (a split block counts as allocated until its halves merge back), <b>G</b> globally free and <b>L</b> locally free, so N = A + G + L. The <b>slack</b> is:' }),  // paragraph: the four counts kept per block size (N, A, G, L) and that a split block counts as allocated
              h('div', { class: 'card tight center', style: { flex: 'none', fontSize: '19px' }, html: 'D<sub>i</sub> = N<sub>i</sub> − 2L<sub>i</sub> − G<sub>i</sub> = <b>A<sub>i</sub> − L<sub>i</sub></b>' }),  // the slack formula in large type: D = N − 2L − G, which works out to A − L
              h('table', { class: 'tbl compact', html: ['<tr><th>Event</th><th>What happens</th><th>D</th></tr>',  // a compact rule table, starting with its header row (event, what happens, change in D)...
                ['Free, D ≥ 2', 'free it locally (no merging)', '−2'], ['Free, D = 1', 'free it globally and coalesce', '→ 0'],  // rows: freeing at D ≥ 2 (local, D falls by 2) and at D = 1 (global and coalesce, D goes to 0)
                ['Free, D = 0', 'free it globally and coalesce; also make one locally free block global', 'stays 0'],  // row: freeing at D = 0 (global, plus one locally free block made global, D stays 0)
                ['Allocate', 'reuse a locally free block / take a globally free one', '+2 / +1'], ['Split', 'one half allocated, the other locally free', 'same']]  // rows: allocating (D rises by 2 or 1) and splitting (D unchanged)
                .map((r) => (typeof r === 'string' ? r : `<tr><td style="white-space:nowrap">${r[0]}</td><td>${r[1]}</td><td style="white-space:nowrap">${r[2]}</td></tr>`)).join('') }),  // turns each row into table HTML, keeping the event and the D column on one line; closes the table
              h('div', { class: 'callout why m0 small', 'data-label': 'What D measures', html: 'A local free moves one block from A to L, so D drops by 2. The rules never let D go below 0, so locally free blocks never outnumber allocated ones.' })),  // callout: what D measures, and why the rules keep locally free blocks from outnumbering allocated ones; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the controls, the bar, the table and the log
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Allocate:'), ...allocBtns, h('span', { class: 'small muted' }, 'or click a teal block to free it'), h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // the control row: "Allocate:" with the 32, 64 and 128 B buttons, a hint to click a teal block to free it, and Reset
              h('div', { class: 'card white', style: { padding: '4px 6px' } }, svg),  // the memory bar on a white card
              tblBox, log, counts,  // the counts table, the move log and the split and merge badges
              h('div', { class: 'callout tip m0 small', 'data-label': 'Solaris, later', html: 'Solaris went on to introduce the <span class="t">slab allocator</span>: one cache per kind of kernel object, holding ready-made objects of that size. Getting one is just taking it from its cache: no splitting, no merging. Linux adopted the idea.' }))));  // tip callout: Solaris later moved to the slab allocator, one cache of ready-made objects per kind; closes the layout
        },  // ends render() for step 8
      },  // ends step 8
      /* ---------------- 9. Recap ---------------- */
      {  // step 9 begins
        title: 'Recap: eight ideas to carry away',  // step 9 title
        kind: 'recap',  // a Recap step
        render(el, ctx) {  // render(el, ctx): draws step 9 when the student arrives
          const { h } = ctx;  // only the HTML builder h is needed here
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));  // flipAll(on): turns every card in this step face up (true) or face down (false)
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // lays out the recap top to bottom, filling the step's height
            h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer out loud before you flip the card. Click a card again to flip it back.'),  // a row with the instruction to say each answer before flipping...
              h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),  // ...and the Flip all and Hide all buttons
            ctx.ui.flipcards([  // the grid of recap cards, each written [front, back]
              ['Two memory managers', 'The <b>paging system</b> hands out whole frames to process pages and disk block buffers. The <b>kernel memory allocator</b> cuts frames into small blocks for the kernel’s own short-lived tables and buffers.'],  // card: the two memory managers and what each hands out
              ['The page table entry', 'One per virtual page: page frame number, age, copy on write, modify, reference, valid, protect.'],  // card: the seven fields of a page table entry
              ['The disk block descriptor', 'Beside each entry: swap device number, device block number, and the type of storage (swap, executable file, or demand zero).'],  // card: the three fields of a disk block descriptor
              ['Frame table and swap-use table', 'Page frame data table: one entry per frame with its state, reference count, disk copy, free-list and hash-queue links. Swap-use table: one entry per swap page, counting the descriptors that point at it.'],  // card: the page frame data table and the swap-use table
              ['Copy on write', 'fork() copies page table entries, not pages, and marks writable pages COW in both. The first write copies the page for the writer only; a last user just clears the bit.'],  // card: how copy on write handles fork() and the first write
              ['The two-handed clock', 'The front hand clears reference bits; the back hand, a handspread behind, pages out frames still at 0. Window = handspread ÷ scanrate.'],  // card: the two hands and the window formula
              ['Scanrate and free memory', 'At or above lotsfree: no scanning. Below it: slowscan, rising in a straight line to fastscan at minfree. Less memory → shorter window.'],  // card: how free memory sets the scanrate
              ['Lazy buddy', 'Keep freed blocks locally free for quick reuse. Slack D = A − L decides: D ≥ 2 free locally; D = 1 free globally; D = 0 free globally and make one local block global too.'],  // card: the lazy buddy slack rules
            ], { cols: 4, height: 222 })));  // four cards per row, each 222 pixels tall; closes the layout
        },  // ends render() for step 9
      },  // ends step 9
      /* ---------------- 10. Check yourself ---------------- */
      {  // step 10 begins
        title: 'Check yourself: UNIX and Solaris memory management',  // step 10 title
        kind: 'check',  // a Check Yourself step
        quiz: [  // quiz: the questions for this step, checked by the guide's quiz engine
          { q: 'Why do SVR4 UNIX and Solaris use a separate kernel memory allocator instead of giving the kernel’s own tables and buffers whole pages from the paging system?',  // quiz question 1 (multiple choice): why kernel tables and buffers need their own allocator
            choices: ['The paging system can only hand out memory that may later be paged out, and kernel data must always stay in memory.', 'Most kernel requests are far smaller than a page and come and go very often, so whole pages would waste memory and time.', 'The paging system serves only user processes and their disk buffers, so it cannot give any frames to the kernel.', 'The kernel allocator is faster because it uses the two-handed clock to pick which small blocks to hand out next.'],  // choices: kernel data must stay resident; small and frequent requests (correct); paging serves only users; the clock picks blocks
            answer: 1,  // answer: the second choice
            feedback: ['Kernel memory is usually kept resident, but that alone would not call for a different allocator: the problem is the small size and constant churn of the requests.', null, 'The kernel memory allocator actually gets its memory as whole frames from the paging system; the question is how those frames are cut up.', 'The two-handed clock is the paging system’s replacement algorithm. It has nothing to do with handing out small kernel blocks.'],  // feedback for each wrong choice: residency is not the reason; the allocator does get frames from paging; the clock is for replacement
            why: 'Kernel tables and buffers are typically tens to hundreds of bytes and come and go constantly. A 4 KB page per request would waste most of each page, so the allocator cuts frames into small power-of-two blocks (a lazy buddy system in SVR4).' },  // explanation shown after answering: small, constant requests would waste most of each page
          { type: 'match', q: 'Match each SVR4 paging structure with what it keeps one entry for.',  // quiz question 2 (match the pairs): each paging structure and what it keeps one entry for
            pairs: [['Page table', 'Each virtual page: its frame and status bits'], ['Disk block descriptor', 'Each virtual page: where its disk copy is'], ['Page frame data table', 'Each physical page frame'], ['Swap-use table', 'Each page on one swap device']],  // the four pairs: page table, disk block descriptor, page frame data table, swap-use table
            why: 'Two records describe every virtual page (the page table entry and, beside it, the disk block descriptor); the page frame data table describes physical frames; each swap device has its own swap-use table.' },  // explanation: two records per virtual page, one table of frames, one swap-use table per swap device
          { type: 'bucket', q: 'Which SVR4 structure holds each field? (PTE = page table entry, DBD = disk block descriptor, frame table = page frame data table.)', buckets: ['PTE', 'DBD', 'Frame table', 'Swap-use'],  // quiz question 3 (sort into groups): which of the four structures holds each field
            items: [['Copy on write bit', 0], ['Age', 0], ['Type of storage', 1], ['Swap device number', 1], ['Count of processes sharing a frame', 2], ['Free-list and hash-queue links', 2], ['Count of PTEs naming one disk page', 3]],  // the seven fields, each with the number of its correct group
            why: 'The page table entry holds the per-page bits the hardware and replacement algorithm use; the descriptor says where the page is on disk; the frame table entry describes one physical frame; the swap-use entry counts users of one page on a swap device.' },  // explanation: what each structure is responsible for
          { type: 'tf', q: 'With copy on write, fork() immediately copies every writable page of the parent so that the child has its own copy.', answer: false,  // quiz question 4 (true or false): fork() with copy on write copies every writable page at once (false)
            why: 'fork() copies only the page table entries and marks the writable pages copy on write in both processes. A page is copied later, when one of them first writes it, and only for the writer. Pages never written are never copied.' },  // explanation: fork() copies only the entries; a page is copied on its first write, for the writer
          { type: 'multi', q: 'Parent P creates child C with fork(), using copy on write. Then C writes its data page. Which statements are true?',  // quiz question 5 (select all that apply): what happens when the child writes its shared data page
            choices: ['C now has a private copy of the data page in a different frame.', 'The original frame’s reference count drops from 2 to 1.', 'P is also given a fresh copy of the data page.', 'If P writes its data page later, the kernel just clears P’s copy-on-write bit without copying, because P is the frame’s only user.', 'The shared, read-only code page is copied as well.'],  // choices: about the child's copy, the old frame's count, the parent, a later parent write, and the code page
            answer: [0, 1, 3],  // answer: the first, second and fourth statements are true
            why: 'Only the writer gets a copy, so C moves to a new frame and the old frame’s count falls to 1. P keeps the original; when P writes, it is the last user, so no copy is needed. Code is read-only and is never copied.' },  // explanation: only the writer copies; the parent becomes the last user; code is never copied
          { type: 'order', q: 'Put in order what happens to a page that the program does not use again while the two-handed clock is running.',  // quiz question 6 (put in order): the steps that lead to an unused page being paged out by the clock
            items: ['The front hand reaches the page and clears its reference bit', 'The hands move on while the program leaves the page alone', 'A handspread later, the back hand reaches the page and finds the bit still 0', 'The page is put on the list of pages to be paged out', 'Its frame becomes free (after the page is written to swap, if it was modified)'],  // the five steps, from the front hand clearing the bit to the frame becoming free
            why: 'The front hand gives the page a fresh start, the gap between the hands is the time it has to be used, and the back hand acts on the result: still 0 means unused, so out it goes.' },  // explanation: the front hand resets, the gap is the window, the back hand acts
          { type: 'num', q: 'A two-handed clock runs with a handspread of 3,000 pages and a scanrate of 750 pages per second. After the front hand clears a page’s reference bit, how many seconds does the page have to be used again before the back hand checks it?', answer: 4, tol: 0.01, unit: 's',  // quiz question 7 (calculate): the window for a handspread of 3,000 pages and a scanrate of 750 pages a second (4 s)
            why: 'The back hand reaches the page after the hands have moved 3,000 pages, which takes 3,000 ÷ 750 = 4 seconds.' },  // explanation: 3,000 ÷ 750 = 4 seconds
          { type: 'num', q: 'A system has lotsfree = 5,000 pages, minfree = 1,000 pages, slowscan = 200 pages/s and fastscan = 1,800 pages/s. The scan rate rises in a straight line from slowscan (at lotsfree) to fastscan (at minfree). Free memory is now 2,000 pages. What is the scan rate?', answer: 1400, tol: 1, unit: 'pages/s',  // quiz question 8 (calculate): the scanrate at 2,000 free pages between the thresholds (1,400 pages a second)
            why: 'scanrate = 200 + (1,800 − 200) × (5,000 − 2,000) ÷ (5,000 − 1,000) = 200 + 1,600 × 0.75 = 1,400 pages per second.' },  // explanation: the straight-line formula worked through with these numbers
          { q: 'A process faults on a page whose disk block descriptor says swap device 1, block 121. Before reading the disk, the kernel hashes the pair (1, 121) and searches a hash queue of page frame data table entries. Why?',  // quiz question 9 (multiple choice): why the kernel searches a hash queue before reading a faulted page from disk
            choices: ['To choose which swap device the page should be read from, since a copy may be kept on more than one device.', 'To find a free slot on the swap device, so the page has somewhere to go the next time it is paged out.', 'To find out whether some frame, even one on the free list, still holds that page, so no disk read is needed.', 'To pick which page the two-handed clock should evict next, so a frame is ready before the disk read starts.'],  // choices: picking a device, finding a free swap slot, finding the page still in a frame (correct), picking a victim
            answer: 2,  // answer: the third choice
            feedback: ['The descriptor already names the device (1) and block (121); nothing needs to be chosen.', 'Free swap slots are tracked by the swap-use table’s reference counts, not found by hashing a disk address.', null, 'Eviction is the two-handed clock’s job; the hash queue answers “is this disk page already in memory?”.'],  // feedback for each wrong choice: the descriptor names the device; free slots come from swap-use counts; eviction is the clock's job
            why: 'Frames are linked into hash queues by the disk address of the page they hold. A freed frame keeps its contents until it is reused, so a quick hash lookup can rescue the page and skip the slow disk read.' },  // explanation: frames are hashed by disk address, so a freed frame that still holds the page can be reused
          { type: 'num', q: 'In a lazy buddy system, the 64-byte blocks are counted as A = 5 allocated, G = 1 globally free and L = 2 locally free. The slack is D = N − 2L − G = A − L. What is D?', answer: 3, tol: 0,  // quiz question 10 (calculate): the slack for A = 5, G = 1, L = 2 (D = 3)
            why: 'N = 5 + 1 + 2 = 8, so D = 8 − 2 × 2 − 1 = 3, which equals A − L = 5 − 2. Because D ≥ 2, the next 64-byte block freed will be freed locally, and D will drop to 1.' },  // explanation: both forms of the formula give 3, so the next free is local
          { q: 'In a lazy buddy system the slack for one block size is D = 1, and a block of that size is freed. What happens?',  // quiz question 11 (multiple choice): what happens when a block is freed while D = 1
            choices: ['It is freed locally, and D rises to 3.', 'It is freed globally, and one locally free block of that size is made global as well.', 'It is freed locally, and D drops to −1.', 'It is freed globally, so it may merge with its buddy, and D becomes 0.'],  // choices: local with D rising, the D = 0 rule, local with D falling to −1, and global with D going to 0 (correct)
            answer: 3,  // answer: the fourth choice
            feedback: ['Local freeing needs D ≥ 2, and it lowers D by 2 rather than raising it.', 'That is the rule for D = 0, where the allocator must also release a locally free block to keep D from going negative.', 'Freeing locally with D = 1 would leave more locally free blocks than allocated ones, so the rule forbids it.', null],  // feedback for each wrong choice: local needs D ≥ 2; that is the D = 0 rule; a local free would make D negative
            why: 'A local free would push D = A − L down to −1, so the block is freed globally instead: A falls by 1, D falls to 0, and the block merges with its buddy if the buddy is globally free too.' },  // explanation: a local free would push D to −1, so the block is freed globally and may merge
          { type: 'tf', q: 'If the scanrate stays the same, a larger handspread gives each page more time to be used again before the back hand checks it, so fewer pages are paged out.', answer: true,  // quiz question 12 (true or false): a larger handspread at the same scanrate gives pages longer to be used (true)
            why: 'The window is handspread ÷ scanrate. A bigger gap at the same speed means a longer window, so more pages get used in time and survive.' },  // explanation: the window is handspread ÷ scanrate
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list
    notes: `${/* notes: the reading-notes text shown in the Notes panel for this section, written in HTML */''}
<h3>Two memory managers in one kernel</h3>${/* notes heading: the two memory managers */''}
<p>UNIX runs on many kinds of machines, so its memory management varies. Early UNIX had no virtual memory: each process sat in one variable-sized partition, and whole processes were swapped out. <b>SVR4</b> (System V Release 4, late 1980s) and <b>Solaris</b> (Sun’s UNIX, built on SVR4) use paged virtual memory, with two separate schemes in the kernel:</p>${/* notes paragraph: early UNIX versus SVR4 and Solaris, and the two schemes in the kernel */''}
<ul>${/* start of the list of the two schemes */''}
<li>The <b>paging system</b> hands out whole page frames, to the pages of user processes and to <b>disk block buffers</b> (cached copies of disk blocks).</li>${/* list item: the paging system and what it hands frames to */''}
<li>The <b>kernel memory allocator</b> takes frames from the paging system and cuts them into small pieces for the kernel’s own tables and buffers.</li>${/* list item: the kernel memory allocator and where it gets its frames */''}
</ul>${/* end of the list */''}

<h3>The four paging data structures</h3>${/* notes heading: the four paging data structures */''}
<p><b>Page table</b>: one per process, one entry per virtual page. Fields:</p>${/* notes paragraph: the page table, one entry per virtual page, introducing its fields */''}
<ul>${/* start of the list of page table entry fields */''}
<li><b>Page frame number</b>: the physical frame holding the page (meaningful only when valid).</li>${/* field: page frame number */''}
<li><b>Age</b>: how long the page has been in memory without being referenced; older pages are better replacement candidates.</li>${/* field: age */''}
<li><b>Copy on write</b>: set when processes share the page (as after fork()); the first write makes a private copy for the writer.</li>${/* field: copy on write */''}
<li><b>Modify</b>: set on a write; the page must then be written to disk before its frame is reused.</li>${/* field: modify */''}
<li><b>Reference</b>: set when the page is used; cleared by the replacement algorithm.</li>${/* field: reference */''}
<li><b>Valid</b>: the page is in main memory (touching it while Valid = 0 causes a page fault).</li>${/* field: valid */''}
<li><b>Protect</b>: whether writing is allowed (code pages are read-only).</li>${/* field: protect, with code pages read-only */''}
</ul>${/* end of the page table field list */''}
<p><b>Disk block descriptor</b>: one per virtual page, beside its entry. Fields: <b>swap device number</b>, <b>device block number</b>, <b>type of storage</b> (swap, executable file, or demand zero: no disk copy, start from a zeroed frame). The entry stays small because the hardware reads it on every access.</p>${/* notes paragraph: the disk block descriptor's three fields, and why they are kept out of the page table entry */''}
<p><b>Page frame data table</b>: one entry per physical frame, indexed by frame number. Fields: <b>page state</b> (available, or holding a page whose copy is on swap, in an executable file, or in a DMA transfer); <b>reference count</b> (processes using the frame); <b>logical device</b> and <b>block number</b> of its disk copy; <b>pointers</b> into the <b>free-page list</b> and a <b>hash queue</b>. Hashing a disk page’s (device, block) finds quickly whether a frame already holds it; a freed frame keeps its contents until reused, so a fault can reclaim the page with no disk read.</p>${/* notes paragraph: the page frame data table's fields, from page state to its free-list and hash-queue links */''}
<p><b>Swap-use table</b>: one per swap device, one entry per page on it: a <b>reference count</b> of the page table entries (via their descriptors) that point at that disk page, and the page’s <b>identifier</b> on the device. Count 0: a free slot.</p>${/* notes paragraph: the swap-use table, its reference count and page identifier, and what a count of 0 means */''}
<p><b>Example.</b> After P forks Q, their shared data page (frame 1, swap block 120, copy on write) has frame count 2 and swap-use count 2; their code page (exec file) has frame count 2 and no swap-use entry, since code is reread from the program file.</p>${/* notes paragraph: worked example of the counts for P and Q's shared data page and code page after the fork */''}

<h3>fork() and copy on write</h3>${/* notes heading: fork() and copy on write */''}
<p>fork() copies the parent’s page table entries, not its pages: every frame’s reference count rises by one, and writable pages are marked copy on write in <b>both</b> tables (read-only code is simply shared). On a write:</p>${/* notes paragraph: fork() copies entries, not pages, and marks writable pages in both tables */''}
<ul>${/* start of the list of write cases */''}
<li>Protect = read-only → refused (an error, never a copy).</li>${/* write case: a read-only page is refused */''}
<li>Copy on write = 0 → write in place; the hardware sets Modify.</li>${/* write case: copy on write 0, written in place */''}
<li>Copy on write = 1 and frame count &gt; 1 → copy the page into a free frame for the writer only, clear its COW bit, lower the old frame’s count.</li>${/* write case: copy on write 1 on a shared frame, copied for the writer */''}
<li>Copy on write = 1 and frame count = 1 → last user: just clear the bit, no copy.</li>${/* write case: copy on write 1 with one user, bit cleared with no copy */''}
</ul>${/* end of the write cases */''}
<p>Reads never copy. A child that calls exec() at once has copied almost nothing.</p>${/* notes paragraph: reads never copy, and a child that calls exec() at once has copied almost nothing */''}
<h3>The two-handed clock</h3>${/* notes heading: the two-handed clock */''}
<p>When free memory runs low, the <b>page daemon</b> sweeps the page frame data table entries of the replaceable (not locked) pages as a circular list with two hands:</p>${/* notes paragraph: the page daemon sweeps the replaceable frames as a ring with two hands */''}
<ul>${/* start of the list of the two hands */''}
<li>The <b>front hand</b> clears each page’s reference bit as it passes.</li>${/* list item: the front hand clears reference bits */''}
<li>The <b>back hand</b>, a fixed distance behind, checks the bit. Still 0: not used since the front hand passed, so the page goes on the page-out list (written to swap first if modified). 1: used, so it stays.</li>${/* list item: the back hand checks them and pages out what is still 0 */''}
</ul>${/* end of the list */''}
<p><b>Scanrate</b> is how many pages per second the hands move; <b>handspread</b> is the gap between the hands in pages. Together they set the time a page has to be used again:</p>${/* notes paragraph: what scanrate and handspread mean */''}
<p><b>window = handspread ÷ scanrate</b>. Example: 2,000 pages at 500 pages/s gives 4 s; a page used at least every 4 s is never paged out. A larger handspread or slower scan gives pages longer; a shorter window frees memory faster but evicts pages still wanted, which fault back in. With one hand (plain clock) a bit is checked only after a full lap, so on a huge memory nearly every bit is set again by then.</p>${/* notes paragraph: the window formula, a worked example, the tradeoff of a short window, and why one hand is not enough */''}

<h3>How fast the hands move</h3>${/* notes heading: how fast the hands move */''}
<p>The scanrate depends on free memory. At or above <b>lotsfree</b> the page daemon sleeps (no scanning). Below it the scanrate starts at <b>slowscan</b> and rises in a straight line as free memory falls, reaching <b>fastscan</b> at <b>minfree</b>.</p>${/* notes paragraph: lotsfree, slowscan, fastscan and minfree */''}
<p>scanrate = slowscan + (fastscan − slowscan) × (lotsfree − free) ÷ (lotsfree − minfree). Example: lotsfree 4,000, minfree 1,000, slowscan 100, fastscan 1,000 pages/s and 2,500 free pages: 100 + 900 × 1,500 ÷ 3,000 = 550 pages/s; with handspread 2,000 the window is 2,000 ÷ 550 ≈ 3.64 s. Less free memory → faster hands → shorter window → more pages freed.</p>${/* notes paragraph: the scanrate formula with a worked example and the window it gives */''}

<h3>Kernel memory: the lazy buddy system</h3>${/* notes heading: the lazy buddy system */''}
<p>Kernel objects are small (tens to hundreds of bytes), short-lived and constantly allocated and freed, so paging is a poor fit. SVR4 uses a <b>buddy system</b>: blocks of 2<sup>k</sup> bytes, halved to fit a request and merged with their buddy when both are free. A plain buddy system merges at once, though the same size is often wanted again moments later. The <b>lazy buddy system</b> defers coalescing until it looks necessary, then coalesces as much as possible. A free block is <b>locally free</b> (kept for reuse at its size, may not merge) or <b>globally free</b> (may merge).</p>${/* notes paragraph: why kernel memory needs its own allocator, and how the lazy buddy delays merging */''}
<p>For each size 2<sup>i</sup>: N<sub>i</sub> blocks exist, A<sub>i</sub> allocated (a split block counts as allocated until its halves merge back; the rebuilt block is then freed by the same rules), G<sub>i</sub> globally free, L<sub>i</sub> locally free; N<sub>i</sub> = A<sub>i</sub> + G<sub>i</sub> + L<sub>i</sub>. The <b>slack</b> is D<sub>i</sub> = N<sub>i</sub> − 2L<sub>i</sub> − G<sub>i</sub> = A<sub>i</sub> − L<sub>i</sub>, allocated minus locally free. A local free moves a block from A to L, so D drops by 2; the rules keep D ≥ 0.</p>${/* notes paragraph: the per-size counts N, A, G, L and the slack formula */''}
<table>${/* start of the slack rule table */''}
<tr><th>Event</th><th>Action</th><th>D</th></tr>${/* table header: event, action, change in D */''}
<tr><td>Free, D ≥ 2</td><td>free locally</td><td>D − 2</td></tr>${/* rule: freeing at D ≥ 2 is local */''}
<tr><td>Free, D = 1</td><td>free globally and coalesce</td><td>0</td></tr>${/* rule: freeing at D = 1 is global */''}
<tr><td>Free, D = 0</td><td>free globally and coalesce; also free one locally free block globally and coalesce</td><td>0</td></tr>${/* rule: freeing at D = 0 is global and also releases one locally free block */''}
<tr><td>Allocate a locally free block</td><td>reuse it</td><td>D + 2</td></tr>${/* rule: allocating a locally free block raises D by 2 */''}
<tr><td>Allocate a globally free block</td><td>take it</td><td>D + 1</td></tr>${/* rule: allocating a globally free block raises D by 1 */''}
<tr><td>Split a larger block</td><td>one half allocated, the other locally free</td><td>unchanged</td></tr>${/* rule: a split leaves D unchanged */''}
</table>${/* end of the rule table */''}
<p><b>Example.</b> 64-byte blocks: A = 5, G = 1, L = 2, so N = 8 and D = 8 − 4 − 1 = 3. The next free is local (D becomes 1); the one after is global (D becomes 0). In a burst of 18 requests on a 256-byte pool (two 32-byte records held, then four rounds of two allocated and freed), a plain buddy system made 7 splits and 4 merges, the lazy one 4 splits and 0 merges.</p>${/* notes paragraph: worked slack example, and the split and merge totals of the burst in step 7 */''}

<h3>Solaris</h3>${/* notes heading: Solaris */''}
<p>Solaris keeps the SVR4 page structures and the two-handed clock. For kernel memory it later introduced the <b>slab allocator</b>: a cache per kind of kernel object holding ready-made objects, so an allocation just takes one from its cache. Linux adopted the idea.</p>`,  // notes paragraph: Solaris keeps the SVR4 paging design and later added the slab allocator; end of the notes text
  });  // closes the section object and the Guide.section call
})();  // ends the wrapping function and runs it immediately
