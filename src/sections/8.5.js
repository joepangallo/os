// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   8.5 Windows Memory Management
   Original teaching material. The pure models (address map, stack growth,
   working-set runs, the trimming lab) sit first and never touch the DOM, so
   every number a student sees comes from the same code that draws it.
   Helpers stay inside this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  const KB = 1024, MB = KB * KB, GB = MB * KB;  // KB, MB, GB: the number of bytes in a kilobyte (1024), a megabyte and a gigabyte, used for every size on the page
  const PAGE = 4 * KB;                       // ordinary page size on x86 and x64
  const GRAN = 64 * KB;                      // allocation granularity: regions start on 64 KB boundaries

  // hex(n): a 32-bit address written the way Windows tools show it, 0x plus 8 upper-case digits
  const hex = (n, digits = 8) => '0x' + Math.floor(n).toString(16).toUpperCase().padStart(digits, '0');  // hex(n): writes n as "0x" plus upper-case hexadecimal digits, padded with zeros to 8 places unless digits says otherwise
  // commas(n): 2147352576 -> "2,147,352,576"
  const commas = (n) => Math.round(n).toLocaleString('en-US');  // commas(n): rounds n and adds thousands separators, so byte counts beside the hex addresses are easy to read
  // size(bytes): the friendliest exact name for a byte count ("64 KB", "2 GB", "2 GB − 128 KB")
  function size(b) {  // size(b): starts the function that names a byte count in the friendliest exact unit
    const exact = (u, name) => (b % u === 0 ? `${b / u} ${name}` : null);  // exact(u, name): gives "N name" when b is a whole number of unit u (for example 64 KB), otherwise null
    const plain = exact(GB, 'GB') || exact(MB, 'MB') || exact(KB, 'KB');  // plain: the largest unit (GB, then MB, then KB) that divides b exactly, or null if none does
    if (plain && (b < MB || b % MB === 0)) return plain;  // uses that name for anything under 1 MB or any whole number of MB; a huge KB count would be hard to read, so other sizes go on
    const up = Math.ceil(b / GB) * GB;       // just under a whole number of GB? say so
    if (up - b < MB && (up - b) % KB === 0) return `${up / GB} GB − ${(up - b) / KB} KB`;  // a size just under a whole number of GB is named that way, so user space reads "2 GB − 128 KB" instead of millions of KB
    return plain || `${commas(b)} bytes`;  // otherwise falls back to the plain name, or to the exact byte count with commas when no unit fits
  }  // ends size()

/* models:start */
  // ---------- 1. The 32-bit address map ----------
  // layout(user3): the four regions of a 32-bit process address space, low to high.
  // user3 = false is the default 2 GB / 2 GB split; true is the 3 GB user-space boot option.
  function layout(user3) {  // layout(user3): starts the function that builds the address map as a list of four region records
    const top = user3 ? 0xC0000000 : 0x80000000;            // first address of system space
    return [  // hands back the regions in order, lowest addresses first
      { key: 'null', name: 'Null-pointer region', lo: 0, hi: GRAN - 1, cls: 'intr', user: false, kernel: false },  // null-pointer region: the first 64 KB, coloured red (intr); neither user-mode nor kernel-mode code may touch it
      { key: 'user', name: 'User space', lo: GRAN, hi: top - GRAN - 1, cls: 'proc', user: true, kernel: true },  // user space: from 64 KB up to just below the guard region, coloured teal (proc); both modes may reach it
      { key: 'guard', name: 'Guard region', lo: top - GRAN, hi: top - 1, cls: 'warn', user: false, kernel: false },  // guard region: the 64 KB just below system space, coloured amber (warn); no access for anyone
      { key: 'sys', name: 'System space', lo: top, hi: 0xFFFFFFFF, cls: 'os', user: false, kernel: true },  // system space: from top up to 0xFFFFFFFF, the last 32-bit address, coloured purple (os); kernel mode only
    ];  // closes the list of regions
  }  // ends layout()
  const regionOf = (addr, user3) => layout(user3).find((r) => addr >= r.lo && addr <= r.hi);  // regionOf(addr, user3): finds the one region whose lo-to-hi range contains addr in the chosen layout
  // parseAddr(text): accepts 7fff0010, 0x7FFF0010, 7FFF_0010 or 7fff'0010; returns { addr } or { err }
  function parseAddr(text) {  // parseAddr(text): starts the function that reads what the student typed into the address box in step 2
    const t = String(text).trim().replace(/^0x/i, '').replace(/[_'`\s]/g, '');  // t: the typed text with spaces trimmed, a leading 0x removed, and separator marks (underscores, quotes, spaces) taken out
    if (!t) return { err: 'Type an address in hexadecimal, for example 7FFF0010.' };  // an empty box gives an error message that asks for an address and shows an example
    if (!/^[0-9a-f]+$/i.test(t)) return { err: 'That is not a hexadecimal number: use the digits 0–9 and the letters A–F.' };  // a regular expression (a text pattern) checks that only the digits 0-9 and letters A-F remain; anything else is an error
    if (t.replace(/^0+/, '').length > 8) return { err: 'That needs more than 32 bits. The largest 32-bit address is FFFFFFFF.' };  // once leading zeros are dropped, more than 8 hex digits would need more than 32 bits, so that is an error too
    return { addr: parseInt(t, 16) };  // a valid entry: parseInt with base 16 turns the hex text into an ordinary number
  }  // ends parseAddr()

  // ---------- 2. A thread stack: reserved, guard page, committed ----------
  // A toy stack reserves 16 pages at 0x00030000-0x0003FFFF. Page 15 is the top (highest addresses); the stack
  // grows down. Page states: 'res' reserved only, 'guard' committed + PAGE_GUARD, 'com' committed.
  // ram = the page has a frame in physical memory now; page 0 is never committed (a permanent barrier).
  const STK_N = 16, STK_BASE = 0x00030000;  // STK_N: the toy stack has 16 pages; STK_BASE: the lowest address of its reservation
  function stackNew() {  // stackNew(): builds a fresh thread stack for the step 4 lab, at the start and on every Reset
    const pages = Array.from({ length: STK_N }, () => ({ st: 'res', ram: false }));  // pages: 16 page records, each starting as merely reserved ('res') with no frame in physical memory
    pages[STK_N - 1] = { st: 'com', ram: true };            // the thread's first page, already in use
    pages[STK_N - 2] = { st: 'guard', ram: false };         // the trip-wire just below it
    return { pages, frames: [], dead: false, why: null, faults: 0, guardHits: 0 };  // hands back the stack: its pages, an empty list of call frames, not crashed, no crash reason, and zeroed counters
  }  // ends stackNew()
  const stackSp = (S) => STK_N - 1 - S.frames.reduce((a, b) => a + b, 0);  // page the stack pointer is in
  const stackCommit = (S) => S.pages.filter((p) => p.st !== 'res').length * PAGE;  // stackCommit(S): the commit charge in bytes: every page that is more than reserved (committed or guard) counts 4 KB
  const stackRam = (S) => S.pages.filter((p) => p.ram).length * PAGE;  // stackRam(S): the physical memory in bytes: 4 KB for each page that holds a frame right now
  // stackTouch(S, k): the thread reads or writes page k; returns what the hardware and the VMM did
  function stackTouch(S, k) {  // starts stackTouch(): every call, return and probe in the lab goes through here
    if (k < 0) { S.dead = true; S.why = 'below'; S.crashK = 0; return { k, kind: 'below' }; }  // a page number below 0 lies below the whole reservation: the thread crashes, and the crash is drawn at page 0
    const p = S.pages[k];  // p: the record of the page being touched
    if (p.st === 'res') { S.dead = true; S.why = 'av'; S.crashK = k; return { k, kind: 'av', barrier: k === 0 }; }  // a page that is only reserved has nothing behind it: access violation and crash; barrier notes whether it was the bottom page
    if (p.st === 'guard') {  // touching the guard page: the one-time exception that tells Windows the stack needs to grow
      S.guardHits++;  // counts guard-page hits for the status line under the lab
      p.st = 'com'; p.ram = true;                           // becomes an ordinary stack page with a zero-filled frame
      if (k - 1 >= 1) { S.pages[k - 1].st = 'guard'; return { k, kind: 'guard', next: k - 1 }; }  // if the page below is not the bottom page, it becomes the new guard page and the result reports a guard hit
      S.dead = true; S.why = 'overflow'; S.crashK = k; return { k, kind: 'overflow' };   // no room left for a new guard page
    }  // ends the guard-page case
    if (p.ram) return { k, kind: 'hit' };  // a committed page that still has its frame: an ordinary access, no fault
    p.ram = true; S.faults++;                               // trimmed earlier: the VMM brings it back
    return { k, kind: 'back' };  // reports that a trimmed page was brought back
  }  // ends stackTouch()
  // stackCall(S, n, probes): a call whose frame needs n pages. Without probes the first write lands at the
  // far (lowest) end of the frame; with probes the compiler touches each new page in order, top to bottom.
  function stackCall(S, n, probes) {  // starts stackCall(), which the Call buttons run
    const sp = stackSp(S), out = [];  // sp: the page the stack pointer is in before the call; out collects the result of each page touched
    const order = probes ? Array.from({ length: n }, (_, i) => sp - 1 - i) : [sp - n];  // order: with probes, each of the n new pages from the top down; without, only the lowest one, sp minus n
    for (const k of order) { out.push(stackTouch(S, k)); if (S.dead) break; }  // touches those pages in turn and stops at the first crash
    S.frames.push(n);  // records the new frame's size in pages, which moves the stack pointer down by that many pages
    return out;  // hands back the list of touch results, which the lab turns into sentences
  }  // ends stackCall()
  // stackRet(S): the newest frame is popped; returning touches the caller's page (pages stay committed)
  function stackRet(S) { S.frames.pop(); return [stackTouch(S, stackSp(S))]; }  // stackRet(S): pops the newest frame, then touches the page the stack pointer moved back to, and returns that one result in a list
  // stackTrim(S): memory pressure: every resident page except the one in use leaves the working set
  function stackTrim(S) {  // starts stackTrim(), which the "Memory runs short" button runs
    const sp = stackSp(S); let n = 0;  // sp: the page in use, which keeps its frame; n counts the pages that lose theirs
    S.pages.forEach((p, k) => { if (p.ram && k !== sp) { p.ram = false; n++; } });  // every other page that has a frame loses it, but stays committed, so its contents are not lost
    return n;  // hands back how many pages were trimmed, for the message under the buttons
  }  // ends stackTrim()

  // ---------- 3. One working set, two memory moods (local LRU replacement) ----------
  // wsRun(refs, cap): cap = Infinity means memory is plentiful (the set grows on every fault); a number caps
  // the set and the process replaces its OWN least recently used page (local scope). A page dropped earlier
  // waits on the standby list, so touching it again is a soft fault; a first touch reads the disk (hard).
  function wsRun(refs, cap) {  // starts wsRun(), which step 5 runs twice on the same page list: once with no cap, once capped at 3 pages
    const slots = [], last = {}, parked = new Set(), steps = [];  // slots: the pages in the working set, one per frame; last: when each page was last used; parked: the standby list; steps: snapshots
    let hard = 0, soft = 0;  // hard and soft count the two kinds of page fault so far
    refs.forEach((p, t) => {  // goes through the page references in order; p is the page and t the time (its position in the list)
      let slot = slots.indexOf(p), kind = 'hit', evicted = null;  // slot: which frame holds p (-1 if none); kind starts as an ordinary hit; evicted will name any page pushed out
      if (slot < 0) {  // p is not in the working set, so this reference is a page fault
        if (parked.has(p)) { kind = 'soft'; soft++; parked.delete(p); } else { kind = 'hard'; hard++; }  // a page waiting on the standby list comes back as a soft fault; any other page must be read from disk, a hard fault
        if (slots.length < cap) { slot = slots.length; slots.push(p); }  // below the cap, the working set simply grows: p goes into a new frame at the end
        else {  // at the cap: the process must give up one of its own pages
          slot = slots.reduce((m, q, k) => (last[q] < last[slots[m]] ? k : m), 0);  // finds the frame whose page has the oldest last-use time, the least recently used one (LRU)
          evicted = slots[slot]; parked.add(evicted); slots[slot] = p;  // that page moves to the standby list and p takes over its frame
        }  // ends the replacement case
      }  // ends the page-fault case
      last[p] = t;  // records that p was used at time t, for later LRU choices
      steps.push({ t, p, kind, slot, evicted, slots: slots.slice(), hard, soft, size: slots.length });  // saves a snapshot of this step (a copy of the frames, the counters and the size) for the drawing and captions
    });  // ends the loop over references
    return steps;  // hands back one snapshot per reference
  }  // ends wsRun()

  // ---------- 4. Three processes, 24 frames, memory pressure and the second-chance lists ----------
  // Frame states: 'free', 'ws' (in its owner's working set), 'sb' (standby list), 'md' (modified list),
  // 'hog' (taken by a newly started program, the pressure slider). Each tick, every process touches the next
  // page of its own reference pattern; pages listed in `writes` are changed whenever they are touched.
  const TF = 24, TMIN = 2, TPLENTY = 6, TBATCH = 4, THOG = 14;  // TF: 24 frames in all; TMIN: the smallest working set; TPLENTY: available frames needed to count as plentiful; TBATCH: batch size; THOG: slider top
  const TPROC = {  // TPROC: the three simulated processes and the pages each one touches
    A: { refs: [0, 1, 2, 3, 0, 4, 1, 5, 2, 0, 3, 1], writes: [1, 3] },  // process A: the 12 pages it touches over and over, in this order; pages 1 and 3 are changed whenever it touches them
    B: { refs: [0, 1, 0, 2, 3, 0, 1, 4, 0, 2], writes: [0] },  // process B: a 10-page pattern that keeps going back to page 0, the only page it changes
    C: { refs: [0, 1, 2, 3, 0, 4, 5, 1, 2, 0], writes: [2, 4] },  // process C: a 10-page pattern over six pages; it changes pages 2 and 4
  };  // closes TPROC
  const PIDS = Object.keys(TPROC);  // PIDS: the process names A, B and C, in order
  const avail = (M) => M.frames.filter((f) => f.use === 'free' || f.use === 'sb').length;   // what Windows counts as available
  const wsOf = (M, p) => M.frames.filter((f) => f.use === 'ws' && f.owner === p);  // wsOf(M, p): the frames that are in process p's working set right now
  const listOf = (M, use) => M.frames.map((f, i) => ({ f, i })).filter((x) => x.f.use === use).sort((a, b) => a.f.at - b.f.at);  // listOf(M, use): the frames on one list with their positions, oldest arrival first, so item 0 is the head of the list
  const hogCount = (M) => M.frames.filter((f) => f.use === 'hog').length;  // hogCount(M): how many frames the newly started program from the slider holds
  const lruOf = (M, p, except) => wsOf(M, p).filter((f) => f !== except).sort((a, b) => a.last - b.last)[0] || null;  // lruOf(M, p, except): p's least recently used working-set page, skipping the one just brought in, or null if there is none
  // park(M, f, why): a page leaves its working set; it keeps its frame and joins the end of the standby or modified list
  function park(M, f, ev, why) { f.use = f.dirty ? 'md' : 'sb'; f.at = M.seq++; ev.push({ type: why, owner: f.owner, page: f.page, to: f.use }); }  // park(): changed pages go to the modified list, unchanged ones to standby; a new sequence number puts it at the end; the move is logged
  // writeOut(M, list): the modified page writer saves pages to the paging file; they join the standby list
  // reason: 'batch' (the list grew long), 'forced' (no other frame left) or 'manual' (the student asked)
  function writeOut(M, items, ev, reason) {  // starts writeOut(), the simulated modified page writer
    if (!items.length) return;  // nothing to write: does nothing and logs nothing
    items.forEach(({ f }) => { f.dirty = false; f.use = 'sb'; f.at = M.seq++; M.writes++; });  // each page is saved: marked unchanged, moved to the end of the standby list, and counted as one page written
    ev.push({ type: 'write', pages: items.map(({ f }) => f.owner + f.page), reason });  // logs one write event naming the pages (such as A1) and the reason for the write
  }  // ends writeOut()
  // takeFrame(M): a frame for new contents: the free list first, then the oldest standby page (its old contents
  // are lost), and only if both are empty, the oldest modified page after writing it out
  function takeFrame(M, ev) {  // starts takeFrame(), which every hard fault and every frame the new program grabs goes through
    let i = M.frames.findIndex((f) => f.use === 'free');  // i: the first free frame, or -1 if none is free
    if (i >= 0) return { i, from: 'free' };  // a free frame is the cheapest choice: hand it back
    let sb = listOf(M, 'sb');  // sb: the standby list, oldest first
    if (!sb.length) { writeOut(M, listOf(M, 'md').slice(0, 1), ev, 'forced'); sb = listOf(M, 'sb'); }  // if standby is empty, the oldest modified page is written out first (a forced write), which puts it on standby
    if (!sb.length) return null;  // if there was nothing to write either, no frame can be found and null says so
    const { f } = sb[0]; M.repurposed++;  // f: the oldest standby page, whose frame will be reused; the reuse is counted
    return { i: sb[0].i, from: 'standby', lost: f.owner + f.page };  // hands back that frame's position, says it came from standby, and names the page whose in-memory copy is now lost
  }  // ends takeFrame()
  // trimOne(M): the trimmer takes the least recently used page from the largest working set above its minimum
  function trimOne(M, ev) {  // starts trimOne(), one action of the working-set trimmer
    const big = PIDS.map((p) => [p, wsOf(M, p).length]).filter(([, n]) => n > TMIN).sort((a, b) => b[1] - a[1])[0];  // big: [name, size] of the largest working set still above its minimum of TMIN pages
    if (!big) return false;  // every working set is at its minimum: nothing can be trimmed, so it reports false
    park(M, lruOf(M, big[0]), ev, 'trim');  // moves that process's least recently used page to the standby or modified list, logged as a trim
    return true;  // reports that one page was trimmed
  }  // ends trimOne()
  // balance(M): after every change, trim until enough memory is available, then batch-write a long modified list
  function balance(M, ev) {  // starts balance(), run after every action in the step 6 lab
    while (avail(M) < TPLENTY && trimOne(M, ev)) { /* keep trimming */ }
    if (listOf(M, 'md').length >= TBATCH) writeOut(M, listOf(M, 'md'), ev, 'batch');  // once 4 or more pages wait on the modified list, the writer saves them all in one batch
  }  // ends balance()
  // touchPage(M, p, page, write): process p touches one of its pages; hit, soft fault or hard fault
  function touchPage(M, p, page, write, ev) {  // starts touchPage(), the heart of the step 6 lab
    let f = M.frames.find((x) => x.owner === p && x.page === page && x.use !== 'free' && x.use !== 'hog');  // f: the frame that still holds this page, in the working set or on a list; free frames and the new program's frames hold no one's page
    const plenty = avail(M) >= TPLENTY;  // plenty: whether memory counted as plentiful before this touch; it decides below whether the working set may grow
    if (f && f.use === 'ws') { f.last = M.t; if (write) f.dirty = true; ev.push({ type: 'hit', owner: p, page }); return; }  // already in the working set: an ordinary hit; updates the last-use time, marks a write, logs the hit and stops
    if (f) { ev.push({ type: 'soft', owner: p, page, from: f.use }); M.soft++; }  // found on the standby or modified list: a soft fault, logged with the list it came from, and counted
    else {  // not in memory at all: a hard fault
      const got = takeFrame(M, ev);  // got: a frame for the page, from the free list, standby or a forced write
      f = M.frames[got.i];  // f becomes that frame
      ev.push({ type: 'hard', owner: p, page, from: got.from, lost: got.lost || null }); M.hard++;  // logs the hard fault, where the frame came from and any standby page lost to make room; counts it
      Object.assign(f, { owner: p, page, dirty: false });  // the frame now holds p's page, unchanged because it was just read from disk
    }  // ends the hard-fault case
    Object.assign(f, { use: 'ws', last: M.t }); if (write) f.dirty = true;  // either way the page joins p's working set, stamped with the current time; a write marks it changed
    if (!plenty && wsOf(M, p).length > TMIN) park(M, lruOf(M, p, f), ev, 'replace');   // local scope: drop its own page
    else ev.push({ type: 'grow', owner: p, size: wsOf(M, p).length, plenty });  // otherwise the working set keeps the new page and grows; the log records its size and whether memory was plentiful
  }  // ends touchPage()
  function trimNew() {  // trimNew(): builds a fresh 24-frame lab for step 6, at the start and on every Reset
    const M = { frames: Array.from({ length: TF }, () => ({ use: 'free', owner: null, page: null, dirty: false, last: 0, at: 0 })),  // M: the lab state; 24 frames, all free, holding no page
      t: 0, seq: 0, ptr: { A: 0, B: 0, C: 0 }, hard: 0, soft: 0, writes: 0, repurposed: 0 };  // t: the clock; seq orders list arrivals; ptr: where each process is in its pattern; then the four counters shown as chips
    for (let k = 0; k < 3; k++) trimTick(M);                // warm up: each process has run three steps
    Object.assign(M, { hard: 0, soft: 0, writes: 0, repurposed: 0 });  // zeroes the counters so the faults of the warm-up do not show
    return M;  // hands back the warmed-up lab
  }  // ends trimNew()
  // trimTick(M): one time step; every process touches its next page, then the balancer runs
  function trimTick(M) {  // starts trimTick(), one press of Run 1 tick or one beat of Play
    const ev = []; M.t++;  // ev: the events of this tick, for the log; the clock moves on by one
    PIDS.forEach((p) => {  // each process A, B and C takes its turn
      const P = TPROC[p], page = P.refs[M.ptr[p] % P.refs.length];  // P: the process's pattern; page: its next page, where % (remainder) wraps back to the start of the pattern
      M.ptr[p]++;  // moves that process on to the following page for next time
      touchPage(M, p, page, P.writes.includes(page), ev);  // touches the page, as a write if the page is one of those the process changes
    });  // ends the loop over processes
    balance(M, ev);  // then the balancer trims and writes as needed
    return ev;  // hands back the events for the log
  }  // ends trimTick()
  // trimHog(M, n): a newly started program grabs (or gives back) frames until it holds n of them
  function trimHog(M, n) {  // starts trimHog(), which runs each time the student moves the "New program takes" slider
    const ev = [], before = hogCount(M);  // ev: the events for the log; before: how many frames the new program held before this move
    while (hogCount(M) < n) {  // while the new program holds fewer frames than the slider asks for, it takes one more
      if (!avail(M)) trimOne(M, ev);                        // nothing available: trim one page first
      const got = takeFrame(M, ev);                         // free list, then standby, then a forced write
      if (!got) break;  // no frame could be found at all: stops early
      ev.push({ type: 'take', from: got.from, lost: got.lost || null });  // logs where the frame came from and which standby page, if any, lost its in-memory copy
      Object.assign(M.frames[got.i], { use: 'hog', owner: null, page: null, dirty: false });  // marks the frame as belonging to the new program; it holds no page of A, B or C any more
    }  // ends the taking loop
    while (hogCount(M) > n) Object.assign(M.frames.find((f) => f.use === 'hog'), { use: 'free', owner: null, page: null });  // if the slider went down, frames are handed back one at a time until the count matches; they become free
    const after = hogCount(M);  // after: how many frames the new program holds now
    if (after !== before) ev.unshift({ type: 'hog', from: before, to: after });  // if that changed, a summary event goes to the front of the list (unshift) so the log mentions it first
    balance(M, ev);  // the balancer then trims working sets if memory is now short
    return ev;  // hands back the events for the log
  }  // ends trimHog()
  // trimRescue(M, i): the owner of the page in frame i touches it again before the frame is reused
  function trimRescue(M, i) {  // starts trimRescue(), run when the student clicks a page on the standby or modified list
    const f = M.frames[i], ev = [];  // f: the frame that was clicked; ev: the events for the log
    if (f.use !== 'sb' && f.use !== 'md') return ev;  // only a page still waiting on one of the two lists can be taken back; otherwise nothing happens
    M.t++;  // the clock moves on by one, since this counts as a new moment of use
    touchPage(M, f.owner, f.page, false, ev);  // the owner touches its page again (a read), which brings it back as a soft fault
    balance(M, ev);  // the balancer runs as after any other action
    return ev;  // hands back the events for the log
  }  // ends trimRescue()
  function trimWrite(M) { const ev = []; writeOut(M, listOf(M, 'md'), ev, 'manual'); balance(M, ev); return ev; }  // trimWrite(M): the "Write modified pages" button; saves the whole modified list (reason "manual"), balances, returns the events
/* models:end */

  // ---------- small drawing helpers shared by the steps ----------
  // mtext(): an SVG text element with one tspan per line
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {  // mtext(): starts the helper; s is the SVG builder, lines one string or a list of them, lh the gap between lines in pixels
    const t = s('text', Object.assign({ x, y }, attrs));  // t: the text element at (x, y) with any extra settings, such as size and colour, copied in
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // each line becomes a tspan (a piece of SVG text) at the same x; every line after the first moves down by lh
    return t;  // hands back the finished text element
  }  // ends mtext()
  // hotGroup(): a clickable SVG group that also works from the keyboard (Tab to it, Enter or Space)
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(): starts the helper; onAct runs on a click, label is what a screen reader announces, kids are the shapes inside
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // g: an SVG group, reachable with Tab (tabindex 0) and announced as a button; class hot gives it the hand cursor
    g.addEventListener('click', onAct);  // a mouse click runs the action
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // Enter or Space also run it, so the drawing works from the keyboard; preventDefault stops Space from scrolling the page
    return g;  // hands back the group, ready to add to a drawing
  }  // ends hotGroup()
  // meterRow(): a labelled meter whose bar and value the caller updates through .set(fraction, text)
  function meterRow(ctx, label, cls) {  // meterRow(): starts the helper; label is the bold title and cls the colour name, such as warn or mem
    const { h } = ctx;  // takes the HTML builder h out of ctx
    const bar = h('i', { style: { width: '0%', background: `var(--${cls})` } });  // bar: the coloured fill of the meter, starting empty (0% wide) in the chosen colour
    const val = h('span', { class: 'mono b c-' + cls });  // val: the number shown at the right of the label, bold, fixed-width and in the same colour
    const el = h('div', { class: 'stack gap-s', style: { gap: '4px' } },  // el: the whole meter, a small column of two rows
      h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '6px' } }, h('span', { class: 'small b', html: label }), val),  // top row: the label on the left and the value on the right
      h('div', { class: 'meter' }, bar));  // bottom row: the meter track holding the bar
    el.set = (frac, text) => { bar.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'; val.textContent = text; };  // el.set(frac, text): stretches the bar to frac of its track, kept between 0 and 1, and writes the value text
    return el;  // hands back the meter
  }  // ends meterRow()

  Guide.section({  // registers section 8.5 with the guide: its id, titles, glossary terms, styles, steps and notes
    id: '8.5',  // id: the section number used in links and saved progress
    title: 'Windows Memory Management',  // title: the full name shown at the top of the section
    short: 'Windows memory',  // short: the brief name used in the contents panel and on small screens
    summary: 'How Windows lays out each address space, reserves and commits regions, and grows and trims working sets.',  // summary: one sentence about the section, shown on the chapter overview
    objectives: [  // objectives: what a student should be able to do after this section
      'Read the 32-bit Windows address map: name each region, give its address range and size, and explain why the two no-access regions exist.',  // objective 1: read the 32-bit address map and explain the two no-access regions
      'Explain the three states of an address-space region (available, reserved, committed) and why a program reserves first and commits later.',  // objective 2: the three region states and why programs reserve before committing
      'Trace a thread stack growing through its guard page, and tell apart reserved addresses, commit charge and physical memory.',  // objective 3: trace stack growth through the guard page and tell the three memory measures apart
      'Describe Windows resident set management: variable allocation with local scope, working-set growth and trimming, and how the standby and modified lists make trimmed pages cheap to recover.',  // objective 4: resident set management, trimming, and the standby and modified lists
    ],  // closes the objectives list
    terms: [  // terms: this section's glossary entries; each dotted word on the page shows one of these definitions
      ['Virtual memory manager (VMM)', 'The part of the Windows executive that runs virtual memory: it decides how each process’s address space is handed out, which pages sit in physical memory, and when pages move between memory and disk.'],  // glossary entry: defines the virtual memory manager (VMM)
      ['User space', 'The lower part of a process’s virtual address space. It is private to that process and is where the program’s own code, data, heap and stacks live. On 32-bit Windows it is about 2 GB by default.'],  // glossary entry: defines user space, the private lower part of an address space
      ['System space', 'The upper part of every process’s virtual address space (2 GB by default on 32-bit Windows). It holds the executive, the kernel, the HAL and the device drivers, it looks the same in every process, and only kernel-mode code may touch it.'],  // glossary entry: defines system space, the shared upper part only kernel code may use
      ['Null-pointer region', 'The lowest 64 KB of a 32-bit Windows address space (0x00000000–0x0000FFFF). It is never usable, so a program that follows a null pointer, or a null pointer plus a small offset, gets an access violation instead of quietly reading junk.'],  // glossary entry: defines the null-pointer region at the very bottom of the address space
      ['Guard region', 'A 64 KB block that can never be accessed, placed just below system space (0x7FFF0000–0x7FFFFFFF by default). A pointer that runs off the top of user space faults there instead of reaching kernel memory, which keeps the kernel’s checks on user pointers simple.'],  // glossary entry: defines the guard region below system space and why it exists
      ['Access violation', 'The exception Windows raises when a program touches an address it may not use: one that is not committed, one in a no-access region, or one in system space while the thread runs in user mode. If the program does not handle it, the process ends.'],  // glossary entry: defines an access violation and the three ways to cause one
      ['Allocation granularity', 'The boundary on which every new region of an address space must start: 64 KB on Windows. A region’s size is always a whole number of pages.'],  // glossary entry: defines allocation granularity, the 64 KB boundary for new regions
      ['Available region', 'Addresses the process has not claimed at all (Windows itself calls them free). Touching one raises an access violation.'],  // glossary entry: defines an available region (unclaimed addresses)
      ['Reserved region', 'Addresses set aside for a process so that nothing else is placed there, but not yet backed by physical memory or paging-file space. Reserving adds nothing to the commit charge; touching a reserved page raises an access violation.'],  // glossary entry: defines a reserved region, claimed but not backed
      ['Committed region', 'Addresses that have backing storage: each page is either in physical memory or on disk, in the paging file or in a mapped file. Committing private pages adds to the commit charge.'],  // glossary entry: defines a committed region, which has backing storage
      ['Commit charge', 'The total amount of committed private memory Windows has promised to back. It may not exceed the commit limit, roughly physical memory plus the paging files, so a commit can fail even while plenty of address space is free.'],  // glossary entry: defines the commit charge and the commit limit that caps it
      ['Paging file (page file)', 'A file on disk where Windows writes committed pages that must leave physical memory, so that they can be read back when they are needed again.'],  // glossary entry: defines the paging file
      ['Guard page (PAGE_GUARD)', 'A committed page marked to raise a one-time exception the first time it is touched. Windows keeps one just below the used part of each thread’s stack to notice that the stack needs to grow.'],  // glossary entry: defines a guard page and its use on thread stacks
      ['Working set', 'In Windows, the set of a process’s pages that are in physical memory right now (its resident set). Section 8.2 uses the same words for W(t, Δ), the pages referenced recently; Windows uses them for the resident pages.'],  // glossary entry: defines the Windows meaning of working set and how it differs from section 8.2's
      ['Working-set trimming (trimming)', 'Removing pages that have not been used recently from processes’ working sets when available memory runs low. The pages are not lost at once: they move to the standby or modified list.'],  // glossary entry: defines working-set trimming
      ['Standby list', 'The list of frames holding pages that left a working set unchanged (or that have already been written to disk). Their contents are still valid, so the owner can take a page back without any disk I/O, but the frame may be reused for something else whenever memory is needed.'],  // glossary entry: defines the standby list of unchanged pages
      ['Modified list', 'The list of frames holding pages that left a working set after being changed. They must be written to disk before their frames can be reused; until then the owner can take them back at once.'],  // glossary entry: defines the modified list of changed pages
      ['Soft page fault (soft fault)', 'A page fault Windows resolves without reading the disk, for example by moving the page back from the standby or modified list into the working set, or by handing out a fresh zero-filled frame.'],  // glossary entry: defines a soft page fault, resolved without the disk
      ['Hard page fault (hard fault)', 'A page fault that must read the page from disk, from the paging file or from a mapped file such as the program file. It is far slower than a soft fault.'],  // glossary entry: defines a hard page fault, which reads the disk
      ['Modified page writer', 'A Windows system thread that writes pages from the modified list to disk (the paging file or their mapped file) and then moves them to the standby list.'],  // glossary entry: defines the modified page writer thread
    ],  // closes the glossary list
    css: ` /* css: styles used only by this section; every rule starts with .sec-8-5 so it cannot change other sections */
      .sec-8-5 .hot { cursor: pointer; } /* a pointer cursor over every clickable part of a drawing */
      .sec-8-5 .hot:focus { outline: none; } /* removes the browser's default focus outline from those parts; the rule below gives a clearer one */
      .sec-8-5 .hot:focus-visible rect, .sec-8-5 .hot:focus-visible circle { stroke-width: 3.5; } /* when a part is reached with the keyboard, its shapes get a thicker outline so the student sees where focus is */
      .sec-8-5 .tx-ok { fill: var(--ok); } .sec-8-5 .tx-bad { fill: var(--bad); } .sec-8-5 .tx-warn { fill: var(--warn); } /* tx- classes colour SVG text: green (ok), red (bad) and amber (warn) */
      .sec-8-5 .tx-os { fill: var(--os); } .sec-8-5 .tx-mem { fill: var(--mem); } .sec-8-5 .tx-proc { fill: var(--proc); } /* more SVG text colours: purple (os), green (mem) and teal (proc) */
      .sec-8-5 .tx-intr { fill: var(--intr); } .sec-8-5 .tx-muted { fill: var(--muted); } /* SVG text colours for interrupt red and muted grey */
      .sec-8-5 .c-ok { color: var(--ok); } .sec-8-5 .c-bad { color: var(--bad); } .sec-8-5 .c-warn { color: var(--warn); } /* c- classes colour ordinary page text: green, red and amber */
      .sec-8-5 .c-os { color: var(--os); } .sec-8-5 .c-mem { color: var(--mem); } .sec-8-5 .c-proc { color: var(--proc); } /* page text colours for the operating system, memory and process themes */
      .sec-8-5 .c-intr { color: var(--intr); } .sec-8-5 .c-muted { color: var(--muted); } /* page text colours for interrupt red and muted grey */
      .sec-8-5 .s-dash { stroke-dasharray: 5 4; } /* s-dash: draws a shape's outline as a dashed line, used for available regions, free frames and trimmed pages */
      .sec-8-5 .lh { line-height: 1.45; } /* lh: slightly taller line spacing so dense explanation cards are easier to read */
      .sec-8-5 .fgrid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px; } /* fgrid: lays the 24 frames of the step 6 lab out as a grid of 8 equal columns with small gaps */
      .sec-8-5 .fcell { height: 48px; border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel-2); font-family: var(--mono); font-size: 14px; font-weight: 700; display: grid; place-items: center; transition: box-shadow .3s; } /* fcell: one frame box, a fixed 48 pixels tall with a rounded border and bold fixed-width label; its glow fades in smoothly */
      .sec-8-5 .fcell.ws { background: var(--proc-bg); border-color: var(--proc); color: var(--proc); } /* a frame in a working set: teal fill, border and text (the process colour) */
      .sec-8-5 .fcell.sb { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* a frame on the standby list: green, matching the standby chip and list */
      .sec-8-5 .fcell.md { background: var(--warn-bg); border-color: var(--warn); color: var(--warn); } /* a frame on the modified list: amber, matching the modified chip and list */
      .sec-8-5 .fcell.free { border-style: dashed; color: var(--muted); font-weight: 600; font-family: var(--font); } /* a free frame: dashed grey border and plain lighter text, so it reads as empty */
      .sec-8-5 .fcell.hog { background: var(--os-bg); border-color: var(--os); color: var(--os); font-family: var(--font); } /* a frame taken by the newly started program: purple, in the ordinary typeface */
      .sec-8-5 .fcell.chg { box-shadow: 0 0 0 3px var(--hl); } /* chg: a yellow ring around any frame that changed in the last action, so the eye finds it */
    `,  // end of the section's styles
    steps: [  // steps: the seven screens of this section, in order
      /* ---------------- 1. Big picture ---------------- */
      {  // step 1 starts here
        title: 'One manager, three questions about every page',  // title of step 1, shown at the top of the screen
        kind: 'story',  // kind story: the guide labels this step "Big Picture"
        render(el, ctx) {  // render(el, ctx): draws step 1 into the box el each time the screen opens; ctx carries the guide's helpers
          const { h, s } = ctx;  // takes the two element builders out of ctx: h for page elements, s for SVG drawing elements
          const INFO = {  // INFO: the text each of the three panels shows when clicked: a title, a colour name and a paragraph
            map: ['1 · The address map', 'proc', 'Every process gets its own private set of virtual addresses. On 32-bit Windows that is 4 GB: by default the lower half is <b>user space</b> for the program and the upper half is <b>system space</b>, shared by the kernel and drivers. Two small no-access regions catch bad pointers. <span class="muted">Step 2 lets you look up any address.</span>'],  // panel 1 text: each process's private 4 GB split into user and system space, with two no-access strips
            reg: ['2 · Reserved or committed', 'warn', 'Inside user space, the VMM hands out addresses in <b>regions</b> that start on 64 KB boundaries. A region can be <b>available</b> (unclaimed), <b>reserved</b> (claimed, nothing behind it yet) or <b>committed</b> (backed by memory or by the paging file). <span class="muted">Steps 3 and 4 show why programs reserve first.</span>'],  // panel 2 text: regions and their three states, available, reserved and committed
            ws: ['3 · The working set', 'mem', 'Only some committed pages are in physical memory at any moment: the process’s <b>working set</b>. It grows while memory is plentiful and is <b>trimmed</b> when memory runs short; trimmed pages wait on the standby or modified list in case they are wanted back. <span class="muted">Steps 5 and 6 let you run it.</span>'],  // panel 3 text: the working set, how it grows and is trimmed, and the standby and modified lists
          };  // closes INFO
          const info = h('div', { class: 'card tight lh', style: { minHeight: '128px', flex: 'none' } });  // info: the card under the drawing where the clicked panel's explanation appears; a minimum height stops the layout jumping
          const groups = {};  // groups: the three clickable panels, filled in below, so pick() can dim the others
          function pick(k) {  // pick(k): runs when panel k is clicked or chosen from the keyboard
            const [t, c, body] = INFO[k];  // takes the panel's title, colour and paragraph out of INFO
            info.innerHTML = `<div class="b c-${c}" style="margin-bottom:3px">${t}</div><div class="small">${body}</div>`;  // writes them into the info card, the title bold and in the panel's colour
            Object.entries(groups).forEach(([kk, g]) => { g.style.opacity = kk === k ? '1' : '0.5'; });  // keeps the chosen panel at full strength and fades the other two to half, so the student sees which one is explained
          }  // ends pick()
          // desktop: three tall panels side by side; small screens: three wide panels stacked, text on the left
          const slim = ctx.narrow;  // slim: the guide's phone-width layout flag; when true the drawing stacks its three panels instead of setting them side by side
          const svg = s('svg', { viewBox: slim ? '0 0 340 396' : '0 0 640 214', width: '100%' });  // svg: the drawing area; its viewBox (its own coordinate system) is tall for phones and wide for desktops
          const P = (k) => (slim ? { x: 4, y: 4 + k * 130, w: 332, h: 122 } : { x: 8 + k * 214, y: 6, w: 196, h: 202 });  // P(k): the box of panel k: stacked rows on small screens, three columns on desktops
          const panel = (k, title, q) => {  // panel(k, title, q): the frame, title and question text of panel k, returned as a list of shapes
            const b = P(k);  // b: that panel's box
            return [s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 14, class: 's-panel', 'stroke-width': 1.5 }),  // first item: the rounded background rectangle of the panel
              slim ? s('text', { x: b.x + 12, y: b.y + 28, 'font-weight': 800, 'font-size': 16 }, title)  // small screens: the title sits at the top left
                : s('text', { x: b.x + b.w / 2, y: b.y + 23, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, title),  // desktops: the title is centred at the top
              slim ? mtext(s, b.x + 12, b.y + 54, q, { 'font-size': 13.5, class: 's-sub' }, 18)  // small screens: the two-line question sits under the title on the left
                : mtext(s, b.x + b.w / 2, b.y + 178, q, { 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 16)];  // desktops: the question is centred near the bottom of the tall panel
          };  // ends panel()
          // panel 1: a 4 GB address space, system half above user half, no-access slivers drawn in red/amber
          const m = slim ? { x: 236, y: P(0).y + 12, hh: 46 } : { x: 66, y: 40, hh: 56 };  // m: where the little address-space column sits inside panel 1, and hh, the height of each half
          groups.map = hotGroup(ctx, () => pick('map'), 'The address map', ...panel(0, 'Address map', ['Where may this', 'process’s addresses go?']),  // groups.map: panel 1 as one clickable group (hotGroup) that explains the address map
            s('rect', { x: m.x, y: m.y, width: 80, height: m.hh, rx: 4, class: 's-os', 'stroke-width': 1.5 }),  // the upper box: system space, in purple
            s('text', { x: m.x + 40, y: m.y + m.hh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-os' }, 'system'),  // its label, "system", centred in the box
            s('rect', { x: m.x, y: m.y + m.hh, width: 80, height: 6, class: 's-warn', 'stroke-width': 1 }),  // a thin amber strip under it: the guard region
            s('rect', { x: m.x, y: m.y + m.hh + 6, width: 80, height: m.hh - 4, class: 's-proc', 'stroke-width': 1.5 }),  // the lower box: user space, in teal
            s('text', { x: m.x + 40, y: m.y + m.hh * 1.5 + 6, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-proc' }, 'user'),  // its label, "user", centred in the box
            s('rect', { x: m.x, y: m.y + 2 * m.hh + 2, width: 80, height: 6, class: 's-intr', 'stroke-width': 1 }),  // a thin red strip at the very bottom: the null-pointer region
            s('text', { x: m.x - 8, y: m.y + 7, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub s-monot' }, '4 GB'),  // "4 GB" written beside the top edge, the high end of the addresses
            s('text', { x: m.x - 8, y: m.y + 2 * m.hh + 9, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub s-monot' }, '0'));  // "0" written beside the bottom edge, the lowest address; closes panel 1
          // panel 2: regions in their three states (one column on desktop, two columns on small screens)
          const regKids = [], ry = P(1).y;  // regKids: the shapes inside panel 2; ry: the top of that panel
          [['available', 's-panel s-dash'], ['reserved', 's-warn'], ['reserved', 's-warn'], ['committed', 's-mem'], ['committed', 's-mem'], ['available', 's-panel s-dash']].forEach(([lab, cls], i) => {  // six sample regions, from the bottom of user space upward, each with its state and its colour class
            const c = slim ? { x: 188 + (i % 2) * 74, y: ry + 12 + Math.floor(i / 2) * 36, w: 70, h: 30 } : { x: 262, y: 38 + i * 20, w: 112, h: 17 };  // c: the box of region i: a column of thin bars on desktops, a grid of two columns on small screens
            regKids.push(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 5, class: cls, 'stroke-width': 1.5 }),  // draws the region's box in its state colour (dashed grey for available)
              s('text', { x: c.x + c.w / 2, y: c.y + c.h / 2 + 4.5, 'text-anchor': 'middle', 'font-size': 12.5, class: lab === 'committed' ? 'tx-mem' : lab === 'reserved' ? 'tx-warn' : 'tx-muted' }, lab));  // writes the state name in the middle, green for committed, amber for reserved, grey for available
          });  // ends the loop over regions
          groups.reg = hotGroup(ctx, () => pick('reg'), 'Reserved or committed regions', ...panel(1, 'Regions', ['Which addresses', 'are actually backed?']), ...regKids);  // groups.reg: panel 2 as a clickable group that explains region states
          // panel 3: physical frames: working-set pages, standby, modified and free frames
          const wsKids = [], wy = P(2).y;  // wsKids: the shapes inside panel 3; wy: the top of that panel
          const fr = ['ws', 'ws', 'sb', 'ws', 'md', 'ws', 'free', 'ws', 'sb', 'free', 'ws', 'free'];  // fr: what each of 12 sample frames holds: working-set pages, standby, modified or nothing
          const frCls = { ws: 's-proc', sb: 's-ok', md: 's-warn', free: 's-panel s-dash' };  // frCls: the colour class for each kind of frame, matching the step 6 lab
          fr.forEach((u, i) => {  // draws each sample frame in turn
            const c = slim ? { x: 204 + (i % 4) * 32, y: wy + 14 + Math.floor(i / 4) * 32, w: 27, h: 27 } : { x: 466 + (i % 3) * 44, y: 38 + Math.floor(i / 3) * 28, w: 38, h: 24 };  // c: the box of frame i: a grid of 3 columns on desktops, 4 on small screens
            wsKids.push(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 5, class: frCls[u], 'stroke-width': 1.5 }));  // a small rounded square in the frame's colour
          });  // ends the loop over frames
          wsKids.push(slim ? s('text', { x: 16, y: wy + 106, 'font-size': 13, class: 's-sub' }, '(physical memory frames)')  // small screens: a caption under the squares saying they are physical memory frames
            : s('text', { x: 534, y: 160, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'physical memory frames'));  // desktops: the same caption, centred under the grid
          groups.ws = hotGroup(ctx, () => pick('ws'), 'The working set', ...panel(2, 'Working set', ['Which pages are in', 'physical memory now?']), ...wsKids);  // groups.ws: panel 3 as a clickable group that explains the working set
          svg.append(groups.map, groups.reg, groups.ws, ...(slim ? [] : [  // puts the three panels into the drawing; on desktops two arrows are added between them
            s('line', { x1: 205, y1: 100, x2: 220, y2: 100, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from panel 1 to panel 2, using the guide's shared arrowhead
            s('line', { x1: 419, y1: 100, x2: 434, y2: 100, class: 's-line', 'marker-end': 'url(#arr)' })]));  // arrow from panel 2 to panel 3; closes the list and the append
          info.innerHTML = '<div class="b">Click each of the three panels.</div><div class="small muted">Each one is a question the VMM answers for every page of every process. The rest of this section takes them in order.</div>';  // starting text in the info card: an invitation to click the three panels
          el.append(h('div', { class: 'split l fill' },  // builds the screen: a two-column split filling the step (the left column is the smaller one)
            h('div', { class: 'stack' },  // left column: the text, stacked
              h('p', { class: 'lead m0', html: 'Every Windows process behaves as if it owns a huge private stretch of memory. The <span class="t">virtual memory manager</span> (VMM), one of the managers inside the Windows <span class="t">executive</span>, makes that true without wasting real memory.' }),  // opening paragraph: what the virtual memory manager is and where it sits in Windows
              h('p', { class: 'm0', html: 'The VMM decides how each process’s addresses are handed out and how <span class="t">pages</span> move between physical memory and disk. Windows supports page sizes from 4 KB to 64 KB, depending on the processor; on x86 and x64 processors ordinary pages are <b>4 KB</b> (x64 also offers 2 MB large pages for special uses).' }),  // paragraph: what the VMM decides and the page sizes Windows uses
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A city map shows every plot of land (the address space). Putting your name on a plot <b>reserves</b> it: nobody else may build there, and it costs nothing yet. A building permit <b>commits</b> it: the city now guarantees the materials. Furniture (physical memory) is delivered only to rooms someone walks into, and is cleared from rooms nobody has used lately when the city runs short.' })),  // analogy callout: reserving, committing and physical memory compared to plots, permits and furniture
            h('div', { class: 'stack' },  // right column: the drawing and its explanation
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // the drawing on a white card
              info,  // the info card that pick() fills
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'These three layers explain everyday Windows experiences: a null-pointer bug crashes at once, a program can claim more memory than the machine has, and an idle program is briefly slow when you return to it.' }))));  // why-it-matters callout: three everyday effects of the three layers; closes both columns and the split
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------- 2. The 32-bit address map ---------------- */
      {  // step 2 starts here
        title: 'The 32-bit address map: look up any address',  // title of step 2
        kind: 'explore',  // kind explore: the guide labels this step "Explore"
        core: true,  // core: this step is part of the shorter core path through the course
        render(el, ctx) {  // render(): draws step 2 each time the screen opens
          const { h, s } = ctx;  // takes the two element builders out of ctx
          const WHY = {  // WHY: the explanation shown for each region once the looked-up address falls in it
            null: 'Windows keeps this strip unusable. A null pointer is address 0, and a null pointer to a structure plus a field offset (null + 0x24) also lands in the first 64 KB, so the bug faults at once instead of quietly reading or overwriting real data.',  // explanation for the null-pointer region: why null and null plus an offset fault at once
            user: 'The program’s own space: its code, global data, heap and thread stacks live here, and every process has a private copy. The address is usable only if the page there is <b>committed</b>; touching an available or merely reserved page also raises an access violation (next step).',  // explanation for user space: what lives there, and that a page must also be committed to be usable
            guard: 'A 64 KB strip nobody may touch. It makes pointer checks easier: the kernel compares an address handed in by a program with one boundary, and anything that starts just below that boundary and runs a little past it faults here instead of reaching kernel memory.',  // explanation for the guard region: how one boundary keeps the kernel's pointer checks simple
            sys: 'Shared by every process and usable only in kernel mode: the executive, the kernel, the HAL and the device drivers live here with the kernel’s data. Because system space appears in every process’s map, the kernel can serve a system call inside the calling process’s own address space.',  // explanation for system space: what lives there and why it appears in every process
          };  // closes WHY
          const PICK = { null: 0, user: 0x00400000, guard: null, sys: null };    // the address a click on each band shows
          const PRESETS = [[0x00000000, 'NULL'], [0x00000024, 'NULL + 0x24'], [0x00400000], [0x7FFF0010], [0x80000000], [0xBFFF0004], [0xC0001000]];  // PRESETS: the quick-try buttons, each an address with an optional label (null, null plus an offset, and edge cases)
          let user3 = false, addr = 0x7FFF0010, err = null;  // user3: which layout is chosen (false = default 2 GB); addr: the address looked up, starting in the guard region; err: any input error

          const svg = s('svg', { viewBox: '0 0 370 510', width: '100%', style: { maxHeight: '100%' } });  // svg: the tall drawing of the address map; maxHeight keeps it inside its card
          const X0 = 94, W = 140, TOP = 22, BOT = 470, THIN = 36;  // X0 and W: the left edge and width of the bands; TOP and BOT: where the map starts and ends; THIN: the drawn height of a 64 KB strip
          function bands() {                         // y-extent of each band, drawn high addresses at the top
            const L = layout(user3), big = BOT - TOP - 2 * THIN;  // L: the four regions of the chosen layout; big: the height left for user and system space once the two thin strips are drawn
            const sysH = Math.round(big * (L[3].hi - L[3].lo + 1) / 2 ** 32), userH = big - sysH;  // sysH: system space's share of that height, in proportion to its real size out of all 2^32 addresses; userH: the rest
            const y = { sys: [TOP, TOP + sysH] };  // y: the top and bottom of each band; system space starts at the top
            y.guard = [y.sys[1], y.sys[1] + THIN]; y.user = [y.guard[1], y.guard[1] + userH]; y.null = [y.user[1], BOT];  // below it come the guard strip, then user space, then the null-pointer strip down to the bottom
            return L.map((r) => Object.assign({}, r, { y0: y[r.key][0], y1: y[r.key][1] }));  // hands back each region with its drawn top (y0) and bottom (y1) added
          }  // ends bands()
          function draw() {  // draw(): redraws the whole map, after every change of address or layout
            const B = bands(), kids = [];  // B: the bands with their positions; kids collects every shape
            B.forEach((r) => {  // draws each band in turn
              const thin = r.y1 - r.y0 < 60, cy = (r.y0 + r.y1) / 2, sel = !err && addr >= r.lo && addr <= r.hi;  // thin: a band too short for two lines of text; cy: its middle; sel: whether the looked-up address falls inside it
              const lab = thin ? [mtext(s, X0 + W / 2, cy + 5, `${r.key === 'null' ? 'null-pointer' : 'guard'} · 64 KB`, { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-' + r.cls })]  // a thin band gets one label line, "null-pointer · 64 KB" or "guard · 64 KB", in its colour
                : [mtext(s, X0 + W / 2, cy - 4, [r.name, size(r.hi - r.lo + 1)], { 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, class: 'tx-' + r.cls }, 19)];  // a tall band gets its name and its size on two lines
              kids.push(hotGroup(ctx, () => { addr = PICK[r.key] ?? r.lo; err = null; inp.value = hex(addr).slice(2); update(); }, r.name,  // each band is clickable: it looks up that band's sample address (or its lowest one), clears any error and fills the box
                s('rect', { x: X0, y: r.y0, width: W, height: r.y1 - r.y0, class: 's-' + r.cls, 'stroke-width': sel ? 3.5 : 1.5, style: sel ? 'stroke:var(--ink)' : '' }), ...lab));  // the band's rectangle in its region colour; the band holding the address gets a thick dark outline
            });  // ends the loop over bands
            const edge = (y, txt) => s('text', { x: X0 - 8, y: y + 4.5, 'text-anchor': 'end', 'font-size': 13, class: 's-monot s-sub' }, txt);  // edge(y, txt): a grey fixed-width address written to the left of the map at height y
            const by = Object.fromEntries(B.map((r) => [r.key, r]));  // by: the same bands looked up by name (sys, guard, user, null)
            kids.push(edge(TOP + 6, '0xFFFFFFFF'), edge(by.sys.y1, hex(by.sys.lo)), edge(by.guard.y1, hex(by.guard.lo)), edge(by.user.y1, hex(by.user.lo)), edge(BOT - 6, '0x00000000'));  // writes the address at each boundary: the very top, the start of system space, the guard strip, user space, and 0
            kids.push(s('text', { x: X0 + W / 2, y: TOP - 8, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'high addresses'),  // a caption above the map: high addresses
              mtext(s, X0 + W / 2, BOT + 17, ['low addresses', '(the 64 KB strips are not to scale)'], { 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 16));  // captions below: low addresses, and a reminder that the 64 KB strips are drawn far larger than their true size
            if (!err) {                              // the pointer: where this address sits inside its band
              const r = B.find((b) => addr >= b.lo && addr <= b.hi);  // r: the band that holds the address
              const y = r.y1 - (r.y1 - r.y0) * ((addr - r.lo) / (r.hi - r.lo + 1));  // y: how far up the band the address lies, in proportion to its distance from the band's lowest address
              kids.push(s('line', { x1: X0 - 2, y1: y, x2: X0 + W + 14, y2: y, class: 's-line', style: 'stroke:var(--ink);stroke-width:2.5' }),  // a dark horizontal line across the map at that height
                s('path', { d: `M${X0 + W + 6},${y} l12,-8 v16 z`, style: 'fill:var(--ink)' }),  // an arrowhead (a small filled triangle) at the right end of the line
                s('text', { x: X0 + W + 22, y: y + 5, 'font-size': 13.5, 'font-weight': 800, class: 's-monot' }, hex(addr)));  // the address itself in hex, written beside the arrowhead
            }  // ends the pointer drawing
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one go
          }  // ends draw()
          const out = h('div', { class: 'card white lh', style: { flex: '1 1 auto', minHeight: '0' } });  // out: the white card under the controls that describes the looked-up address
          const inp = h('input', { type: 'text', class: 'mono', value: hex(addr).slice(2), 'data-keys': '', 'aria-label': 'Address in hexadecimal', spellcheck: 'false', autocomplete: 'off',  // inp: the text box for typing an address; data-keys keeps arrow keys typed here from changing the slide
            style: { width: '150px', height: '34px', fontSize: '16px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--panel)', color: 'var(--ink)' } });  // the box's size, font and colours, set to match the guide's theme
          ctx.on(inp, 'input', () => { const p = parseAddr(inp.value); err = p.err || null; if (!err) addr = p.addr; update(); });  // on every keystroke: reads the box with parseAddr, keeps any error, takes the address if it is valid, and redraws
          const access = (ok, maybe, txt) => `<span class="b ${ok ? (maybe ? 'c-warn' : 'c-ok') : 'c-bad'}">${ok ? (maybe ? '✓ if committed' : '✓ allowed') : '✗ access violation'}</span> <span class="small muted">${txt}</span>`;  // access(ok, maybe, txt): the verdict line, green "allowed", amber "if committed" or red "access violation", plus a short reason
          function update() {  // update(): refreshes the map and the description card together
            draw();  // redraws the map first
            if (err) { out.innerHTML = `<div class="b c-bad">Not a 32-bit address</div><p class="small m0">${err}</p>`; return; }  // bad input: the card shows "Not a 32-bit address" and the reason, and nothing more
            const r = regionOf(addr, user3), other = regionOf(addr, !user3);  // r: the region holding the address in the chosen layout; other: the region it would be in under the other layout
            const userTxt = r.key === 'user' ? 'the program’s own space' : r.key === 'sys' ? 'kernel only' : 'no one may use it';  // userTxt: the short reason shown beside the user-mode verdict
            const kerTxt = r.key === 'sys' ? 'where the OS lives' : r.key === 'user' ? 'the kernel can reach the current process’s user space' : 'kept unusable for everyone';  // kerTxt: the short reason shown beside the kernel-mode verdict
            out.innerHTML = `<div class="row" style="gap:8px;margin-bottom:6px"><span class="mono b" style="font-size:20px">${hex(addr)}</span><span class="small muted">= ${commas(addr)}</span></div>` +  // card line 1: the address in large hex, then the same number in decimal with commas
              `<div class="row" style="gap:8px;margin-bottom:6px"><span class="chip ${r.cls}">${r.name}</span><span class="small mono">${hex(r.lo)} – ${hex(r.hi)}</span><span class="small">(${size(r.hi - r.lo + 1)}${r.key === 'user' ? ' = ' + commas(r.hi - r.lo + 1) + ' bytes' : ''})</span></div>` +  // card line 2: the region's name as a coloured chip, its address range and its size (with the exact byte count for user space)
              `<div class="small" style="margin-bottom:2px">User-mode access: ${access(r.user, r.key === 'user', userTxt)}</div>` +  // card line 3: may user-mode code touch this address?
              `<div class="small" style="margin-bottom:8px">Kernel-mode access: ${access(r.kernel, r.key === 'user', kerTxt)}</div>` +  // card line 4: may kernel-mode code touch it?
              `<p class="small m0">${WHY[r.key]}</p>` +  // then the paragraph from WHY that explains this region
              (other.key !== r.key ? `<p class="small m0 mt c-os"><b>Layout matters:</b> in the ${user3 ? 'default 2 GB' : '3 GB'} layout this same address is in <b>${other.name.toLowerCase()}</b>.</p>` : '');  // if the other layout puts the address in a different region, a purple note names that region
          }  // ends update()
          const seg = ctx.ui.seg([{ value: false, label: '2 GB user (default)' }, { value: true, label: '3 GB user (boot option)' }], user3, (v) => { user3 = v; update(); });  // seg: the switch between the default 2 GB layout and the 3 GB boot option; choosing one redraws everything
          const presets = h('div', { class: 'row', style: { gap: '6px' } }, ...PRESETS.map(([a, lab]) =>  // presets: a row of quick-try buttons, one for each entry in PRESETS
            h('button', { class: 'btn sm mono', type: 'button', onclick: () => { addr = a; err = null; inp.value = hex(a).slice(2); update(); } }, lab || hex(a))));  // each button looks up its address, clears any error and fills the box; it shows its label or the address in hex
          el.append(h('div', { class: 'split l3 fill' },  // builds the screen: a split with the drawing in the left third and the controls in the right two thirds
            h('div', { class: 'card white', style: { padding: '4px 6px', display: 'grid', placeItems: 'center' } }, svg),  // left: the map drawing, centred on a white card
            h('div', { class: 'stack', style: { gap: '10px' } },  // right: a stack of text and controls
              h('p', { class: 'm0', html: 'On 32-bit Windows each process sees its own 4 GB of virtual addresses in four regions. By default the lower half is <span class="t">user space</span> and the upper half is <span class="t">system space</span>, with a 64 KB no-access strip at the very bottom and another just below the halfway line.' }),  // paragraph: the four regions of a 32-bit address space and where the two no-access strips sit
              h('div', { class: 'row', style: { gap: '10px' } }, seg, h('span', { class: 'xs muted', style: { flex: '1 1 160px' }, html: 'The 3 GB boot option gives programs marked “large address aware” 3 GB and leaves 1 GB for the system.' })),  // the layout switch, beside a grey note on who gets the 3 GB option
              h('div', { class: 'row', style: { gap: '8px' } }, h('label', { class: 'small b' }, 'Type an address: 0x'), inp, h('span', { class: 'xs muted' }, 'or click a band, or try:')),  // the address box with its "0x" label and a hint to click a band or try a preset
              presets, out,  // the preset buttons, then the description card
              h('div', { class: 'callout tip m0 small', 'data-label': '64-bit Windows', html: 'Same plan, vastly bigger: <b>128 TB</b> of user space per process (Windows 8.1 and later; earlier 64-bit versions gave 8 TB), with system space far above it.' }))));  // tip callout: the same plan on 64-bit Windows, with its much larger user space; closes the columns and the split
          update();  // fills in the map and the card for the starting address when the screen opens
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------- 3. Region states: reserve, commit, decommit, release ---------------- */
      {  // step 3 starts here
        title: 'Reserve first, commit later: the three region states',  // title of step 3
        kind: 'learn',  // kind learn: the guide labels this step "Learn"
        render(el, ctx) {  // render(): draws step 3 each time the screen opens
          const { h, s } = ctx;  // takes the two element builders out of ctx
          // ---- tab 1: walk through eight calls on a 1 MB region (256 pages) ----
          function walkTab(panel) {  // walkTab(panel): draws the first tab, an animated walk through eight calls, into panel
            const SRC = `p = VirtualAlloc(NULL, 0x100000, MEM_RESERVE, PAGE_NOACCESS);  // claim 1 MB${/* shown code, line 1: reserve 1 MB of addresses with nothing behind them */''}
VirtualAlloc(p, 0x10000, MEM_COMMIT, PAGE_READWRITE);   // back first 64 KB${/* shown code, line 2: commit the first 64 KB of the reservation */''}
p[0] = 42;                       // first touch of page 0${/* shown code, line 3: the first write into page 0 */''}
p[70000] = 7;                    // page 17 is only reserved: fault${/* shown code, line 4: a write into page 17, which is only reserved, so it faults */''}
VirtualAlloc(p + 0x11000, 0x1000, MEM_COMMIT, PAGE_READWRITE); // handler${/* shown code, line 5: the exception handler commits just page 17 */''}
p[70000] = 7;                    // retry: page 17 is committed now${/* shown code, line 6: the same write tried again, which now works */''}
VirtualFree(p, 0x10000, MEM_DECOMMIT);  // drop backing, keep addresses${/* shown code, line 7: decommit the first 64 KB but keep the addresses reserved */''}
VirtualFree(p, 0, MEM_RELEASE);         // hand the whole 1 MB back`;  // shown code, line 8: release the whole region; the backtick ends the listing
            const NP = 256, TOUCH = Math.floor(70000 / PAGE);           // byte 70000 lies in page 17
            const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);  // range(a, b): the whole numbers from a up to, but not including, b
            const OPS = [  // OPS: what each of the eight lines does to the model, in order
              (st) => { st.pg.fill('res'); },  // line 1: all 256 pages become reserved
              (st) => { range(0, 16).forEach((k) => { st.pg[k] = 'com'; }); },  // line 2: pages 0 to 15 (the first 64 KB) become committed
              (st) => { st.ram.add(0); },  // line 3: page 0 gets a frame in physical memory
              (st) => { st.av = TOUCH; },  // line 4: the fault on page 17 is marked (av) so the drawing shows it in red
              (st) => { st.av = null; st.pg[TOUCH] = 'com'; },  // line 5: the fault mark is cleared and page 17 is committed
              (st) => { st.ram.add(TOUCH); },  // line 6: the retried write gives page 17 a frame
              (st) => { range(0, 16).forEach((k) => { st.pg[k] = 'res'; st.ram.delete(k); }); },  // line 7: pages 0 to 15 go back to reserved and lose their frames
              (st) => { st.pg.fill('a'); st.ram.clear(); },  // line 8: every page becomes available again and every frame is given back
            ];  // closes OPS
            const stateAt = (i) => { const st = { pg: Array(NP).fill('a'), ram: new Set(), av: null }; for (let k = 0; k < i; k++) OPS[k](st); return st; };  // stateAt(i): the state after the first i lines, rebuilt from scratch each time so stepping backward works too
            const claimed = (st) => st.pg.filter((x) => x !== 'a').length * PAGE, charge = (st) => st.pg.filter((x) => x === 'com').length * PAGE, phys = (st) => st.ram.size * PAGE;  // the three measures in bytes: addresses claimed (any page not available), commit charge (committed pages), physical memory (pages with frames)
            const code = ctx.ui.code(SRC, { lang: 'c', fontSize: 13 });  // code: the listing of SRC with line numbers, coloured as C; the player highlights the line being run
            const grid = s('svg', { viewBox: '0 0 476 124', width: '100%' });  // grid: the drawing that holds one small square per page
            const stat = (lab, cls) => { const v = h('div', { class: 'mono b c-' + cls, style: { fontSize: '17px' } }); return [h('div', { class: 'xs muted b' }, lab), v]; };  // stat(lab, cls): a small grey label and a large coloured value under it; both are returned so the value can be updated
            const [l1, vClaim] = stat('ADDRESSES CLAIMED', 'warn'), [l2, vCharge] = stat('COMMIT CHARGE', 'mem'), [l3, vPhys] = stat('PHYSICAL MEMORY', 'proc');  // the three readouts beside the grid: addresses claimed (amber), commit charge (green) and physical memory (teal)
            const stats = h('div', { class: 'stack', style: { gap: '1px', flex: '0 0 150px' } }, l1, vClaim, l2, vCharge, l3, vPhys);  // stats: the three readouts stacked in a fixed 150-pixel column beside the grid
            function draw(st) {  // draw(st): repaints the 256 page squares for one state of the walk
              const kids = [];  // kids collects the squares
              for (let k = 0; k < NP; k++) {  // one square for each of the 256 pages
                const r = Math.floor(k / 32), c = k % 32, x = 2 + c * 14.6 + (c >= 16 ? 6 : 0), y = 2 + r * 15;  // 32 squares per row and 8 rows; an extra gap after square 16 splits each row into two 64 KB halves
                const cls = st.av === k ? 's-intr' : st.pg[k] === 'a' ? 's-panel' : st.pg[k] === 'res' ? 's-warn' : 's-mem';  // colour by state: red for the page that just faulted, grey for available, amber for reserved, green for committed
                const r1 = s('rect', { x, y, width: 12.5, height: 12.5, rx: 2, class: cls, 'stroke-width': st.av === k ? 2.5 : 1 });  // the square itself; the faulting page gets a thicker outline
                if (st.ram.has(k)) r1.style.fill = 'var(--mem)';  // a page that holds a frame is filled solid green, so "in RAM" stands out from "committed"
                if (st.pg[k] === 'a') r1.style.opacity = '0.55';  // available pages are faded, since nothing has claimed them
                kids.push(r1);  // adds the square to the list
              }  // ends the loop over pages
              grid.replaceChildren(...kids);  // replaces the old squares with the new ones in one go
            }  // ends draw()
            const KB_ = (b) => b / KB + ' KB';  // KB_(b): writes a byte count in KB, such as "64 KB"
            const CAP = [  // CAP: the caption for each frame of the walk, built from the state so every number matches the readouts
              (st) => `<b>Before line 1.</b> This 1 MB of addresses is <b>available</b>: the program has not claimed it. Commit charge ${KB_(charge(st))}, physical memory ${KB_(phys(st))}.`,  // caption before line 1: the megabyte is still available and costs nothing
              (st) => `<b>Line 1 reserves</b> 1 MB (${claimed(st) / PAGE} pages), starting on a 64 KB boundary. Nothing backs it, so the commit charge stays at ${KB_(charge(st))} and no physical memory is used. Reserving is almost free.`,  // caption for line 1: reserving 1 MB claims 256 pages but adds no commit charge and no memory
              (st) => `<b>Line 2 commits</b> the first 64 KB (16 pages). The commit charge rises to ${KB_(charge(st))}: Windows now promises room in RAM or the paging file for them. Still no frames: physical memory is ${KB_(phys(st))}.`,  // caption for line 2: committing 16 pages raises the commit charge but still uses no frames
              (st) => `<b>Line 3 touches page 0</b> for the first time. A page fault gives it a zero-filled frame, with no disk read. Physical memory is now ${KB_(phys(st))}; the commit charge does not move.`,  // caption for line 3: the first touch of page 0 gets a zero-filled frame without a disk read
              () => `<b>Line 4 writes byte 70000</b>, which is in page ${TOUCH} (70000 ÷ 4096 = ${ctx.util.fmt(70000 / 4096, 2)}). Page ${TOUCH} is only <b>reserved</b>, so the page fault finds nothing to bring in and Windows raises an <b>access violation</b>. Unhandled, the program would crash.`,  // caption for line 4: works out which page byte 70000 is in and explains why the write is an access violation
              (st) => `<b>Line 5 runs in an exception handler</b> the program installed for exactly this case. It commits page ${TOUCH} alone (commit charge ${KB_(charge(st))}) and then lets line 4 run again. A sparse table can grow on demand this way.`,  // caption for line 5: an exception handler commits just that one page so a sparse table can grow on demand
              (st) => `<b>Line 6 is the retried write.</b> Page ${TOUCH} is committed now, so its first touch simply gets a zero-filled frame. Physical memory ${KB_(phys(st))}, commit charge ${KB_(charge(st))}: the whole 1 MB range uses just ${phys(st) / PAGE} frames.`,  // caption for line 6: the retried write succeeds, and the whole 1 MB uses only two frames
              (st) => `<b>Line 7 decommits</b> the first 64 KB: page 0’s frame and those 16 pages of commit charge go back (commit charge now ${KB_(charge(st))}, physical ${KB_(phys(st))}), but the addresses stay <b>reserved</b>, so the program could commit them again.`,  // caption for line 7: decommitting gives back the frames and commit charge but keeps the addresses reserved
              (st) => `<b>Line 8 releases</b> the region (MEM_RELEASE needs size 0 and the region’s base, and always frees the whole region). Every page, committed or reserved, is available again: claimed ${KB_(claimed(st))}, commit charge ${KB_(charge(st))}, physical ${KB_(phys(st))}.`,  // caption for line 8: releasing needs size 0 and the base address, and makes every page available again
            ];  // closes CAP
            const player = ctx.ui.player({ count: OPS.length + 1, interval: 2600, render(i) {  // player: the animation player with 9 frames (before line 1, then one per line), 2.6 seconds apart when playing
              const st = stateAt(i);  // st: the state after the first i lines
              draw(st); code.clear(); if (i > 0) code.mark(i);  // repaints the grid, clears the listing's highlight and highlights line i (no line before the first call)
              vClaim.textContent = KB_(claimed(st)); vCharge.textContent = KB_(charge(st)); vPhys.textContent = KB_(phys(st));  // writes the three measures into the readouts
              return CAP[i](st);  // hands the caption for this frame to the player, which shows it above its buttons
            } });  // ends the player's render function and its settings
            const legend = h('div', { class: 'row xs muted', style: { gap: '10px' } },  // legend: a row of small chips that explains the square colours
              h('span', { html: 'one square = one 4 KB page:' }),  // legend text: each square stands for one 4 KB page
              h('span', { class: 'chip warn' }, 'reserved'), h('span', { class: 'chip mem' }, 'committed'),  // chips for reserved (amber) and committed (green)
              h('span', { class: 'chip', style: { background: 'var(--mem)', color: 'var(--panel)' } }, 'committed + in RAM'), h('span', { class: 'chip intr' }, 'fault'));  // a solid green chip for committed and in RAM, and a red chip for a fault
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } }, code,  // fills the tab: the listing on top, then a row with the grid and the readouts
              h('div', { class: 'row nw', style: { gap: '14px', alignItems: 'center' } }, h('div', { class: 'grow' }, grid), stats), legend, player.el));  // the grid takes the spare width, the readouts sit at its right; then the legend and the player below
          }  // ends walkTab()
          // ---- tab 2: a clickable state diagram; each state and each arrow explains itself ----
          function stateTab(panel) {  // stateTab(panel): draws the second tab, the clickable state diagram, into panel
            const COST = { a: ['no', '0', '0'], res: ['yes', '0', '0'], com: ['yes', 'its full size', 'only the pages touched so far'] };  // COST: for each state, whether addresses are claimed, how much commit charge it has, and how much physical memory it uses
            const INFO = {  // INFO: the title, colour, explanation and resulting state for every state and every arrow of the diagram
              a: ['Available', '', 'No part of the program has claimed these addresses. The VMM may place a new region here. Touching one raises an access violation.', 'a'],  // the Available state: unclaimed addresses
              res: ['Reserved', 'warn', 'Claimed for the program, so no other allocation can land here, but nothing backs the pages. Windows keeps only a small bookkeeping record. Touching one raises an access violation.', 'res'],  // the Reserved state: claimed, with only a small bookkeeping record behind it
              com: ['Committed', 'mem', 'Backed by storage the VMM has promised: each page is in physical memory, in the paging file or in a mapped file. A committed page that was never touched has no frame yet; its first touch gets a zero-filled one.', 'com'],  // the Committed state: promised backing; a frame arrives at first touch
              reserve: ['reserve · VirtualAlloc(…, MEM_RESERVE, …)', 'warn', 'Claims a range that starts on a 64 KB boundary. Cheap: the commit charge does not change and no frame is used. Even a 4 KB reservation uses up the rest of its 64 KB of addresses, so programs reserve big pieces and let a heap carve them up.', 'res'],  // the reserve arrow: claims a 64 KB-aligned range cheaply, and why programs reserve big pieces
              commit: ['commit · VirtualAlloc(…, MEM_COMMIT, …)', 'mem', 'Backs reserved pages. The commit charge grows by their size, and the call fails if that would pass the commit limit (about RAM plus the paging files). Frames still arrive only at first touch.', 'com'],  // the commit arrow: raises the commit charge and can fail at the commit limit
              decommit: ['decommit · VirtualFree(…, MEM_DECOMMIT)', 'warn', 'Gives back the frames and paging-file space behind the pages and lowers the commit charge. The addresses stay reserved, so they can be committed again later.', 'res'],  // the decommit arrow: hands back frames and commit charge but keeps the addresses reserved
              release: ['release · VirtualFree(base, 0, MEM_RELEASE)', '', 'Gives a whole region back: the size must be 0 and the address must be the base the reservation returned, because part of a region cannot be released. The addresses become available.', 'a'],  // the release arrow: must name the region's base with size 0 and frees the whole region
              both: ['reserve + commit in one call', 'mem', 'VirtualAlloc(…, MEM_RESERVE | MEM_COMMIT, …): the usual choice for memory the program will use right away. A heap does this behind every ordinary allocation.', 'com'],  // the one-call shortcut from available straight to committed, the usual choice for a heap
              all: ['release a region that has committed pages', '', 'MEM_RELEASE on a region that still has committed pages decommits them and releases the addresses in one step.', 'a'],  // the one-call shortcut from committed straight back to available
            };  // closes INFO
            const info = h('div', { class: 'card tight small lh', style: { minHeight: '150px' } });  // info: the card under the diagram that explains the clicked state or arrow
            const parts = {};  // parts: every clickable piece, by name, so pick() can fade the others
            function pick(k) {  // pick(k): runs when a state or arrow is clicked or chosen from the keyboard
              const [t, c, body, st] = INFO[k], [cl, ch, ph] = COST[st];  // unpacks the title, colour, text and resulting state, and that state's three costs
              info.innerHTML = `<div class="b ${c ? 'c-' + c : ''}" style="font-size:16px;margin-bottom:3px">${t}</div><p class="m0" style="margin-bottom:6px">${body}</p>` +  // writes the title (coloured when it has a colour) and the explanation into the card
                `<div class="row" style="gap:6px"><span class="chip">${INFO[st][0]} pages:</span><span class="chip">addresses claimed: ${cl}</span><span class="chip mem">commit charge: ${ch}</span><span class="chip proc">physical memory: ${ph}</span></div>`;  // then a row of chips: the resulting state's name and its three costs
              Object.entries(parts).forEach(([kk, g]) => { g.style.opacity = kk === k ? '1' : '0.45'; });  // keeps the chosen piece at full strength and fades every other piece
            }  // ends pick()
            // desktop: the three states in a row; small screens: a column, with the two one-call shortcuts as buttons
            const slim = ctx.narrow;  // slim: the guide's phone-width layout flag; when true the states are drawn in a column
            const svg = s('svg', { viewBox: slim ? '0 0 340 400' : '0 0 640 270', width: '100%' });  // svg: the diagram area, tall on small screens and wide on desktops
            const node = (k, x, y, cls, label) => hotGroup(ctx, () => pick(k), label + ' state',  // node(): a clickable state circle with its name in the middle
              s('circle', { cx: x, cy: y, r: 46, class: cls, 'stroke-width': 2.5 }),  // the circle, filled in the state's colour
              s('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: cls === 's-panel' ? '' : 'tx-' + cls.slice(2) }, label));  // the state's name in bold, coloured to match (plain for Available)
            const arc = (k, d, lx, ly, label, anchor = 'middle') => hotGroup(ctx, () => pick(k), label,  // arc(): a clickable curved arrow between two states, with its label
              s('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 16 }),  // an invisible, much wider copy of the curve, so the thin arrow is easy to hit with a mouse or finger
              s('path', { d, class: 's-line', 'marker-end': 'url(#arr)' }),  // the visible curve with the shared arrowhead at its end
              s('text', { x: lx, y: ly, 'text-anchor': anchor, 'font-size': slim ? 14 : 13.5, 'font-weight': 700 }, label));  // the arrow's label, placed at (lx, ly)
            const extra = [];  // extra: page elements that go under the diagram on small screens only
            if (slim) {  // small screens: the three states in a column
              parts.reserve = arc('reserve', 'M204,84 Q254,125 204,166', 240, 130, 'reserve', 'start');  // reserve: an arrow curving down the right side from Available to Reserved
              parts.release = arc('release', 'M136,166 Q86,125 136,84', 100, 130, 'release', 'end');  // release: an arrow curving up the left side from Reserved back to Available
              parts.commit = arc('commit', 'M204,234 Q254,275 204,316', 240, 280, 'commit', 'start');  // commit: an arrow down the right side from Reserved to Committed
              parts.decommit = arc('decommit', 'M136,316 Q86,275 136,234', 100, 280, 'decommit', 'end');  // decommit: an arrow up the left side from Committed back to Reserved
              parts.a = node('a', 170, 50, 's-panel', 'Available'); parts.res = node('res', 170, 200, 's-warn', 'Reserved'); parts.com = node('com', 170, 350, 's-mem', 'Committed');  // the three state circles, top to bottom: Available, Reserved, Committed
              parts.both = h('button', { class: 'btn sm', type: 'button', onclick: () => pick('both') }, 'Available → Committed in one call');  // the one-call shortcut from available to committed becomes a button, since a long arrow would not fit
              parts.all = h('button', { class: 'btn sm', type: 'button', onclick: () => pick('all') }, 'Committed → Available in one call');  // the one-call shortcut from committed back to available also becomes a button
              extra.push(h('div', { class: 'row', style: { gap: '8px' } }, parts.both, parts.all));  // the two buttons sit in a row under the diagram
            } else {  // desktops: the three states in a row
              parts.both = arc('both', 'M120,89 Q320,-10 520,89', 320, 30, 'reserve + commit in one call');  // a long arrow over the top from Available straight to Committed (reserve and commit in one call)
              parts.reserve = arc('reserve', 'M150,112 Q215,70 280,112', 215, 82, 'reserve');  // reserve: a short arrow over the top from Available to Reserved
              parts.commit = arc('commit', 'M360,112 Q425,70 490,112', 425, 82, 'commit');  // commit: a short arrow over the top from Reserved to Committed
              parts.release = arc('release', 'M280,158 Q215,200 150,158', 215, 200, 'release');  // release: an arrow underneath from Reserved back to Available
              parts.decommit = arc('decommit', 'M490,158 Q425,200 360,158', 425, 200, 'decommit');  // decommit: an arrow underneath from Committed back to Reserved
              parts.all = arc('all', 'M520,181 Q320,280 120,181', 320, 252, 'release (committed pages too)');  // a long arrow underneath from Committed straight back to Available
              parts.a = node('a', 110, 135, 's-panel', 'Available'); parts.res = node('res', 320, 135, 's-warn', 'Reserved'); parts.com = node('com', 530, 135, 's-mem', 'Committed');  // the three state circles, left to right: Available, Reserved, Committed
            }  // ends the desktop layout
            svg.append(...Object.values(parts).filter((g) => g instanceof SVGElement));  // puts every SVG piece into the diagram; the buttons are page elements, so they are left out here
            info.innerHTML = '<div class="b">Click a state or an arrow.</div><div class="muted">Each arrow is one call a program can make; the card shows what it costs.</div>';  // starting text in the card: click a state or an arrow
            panel.append(h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), ...extra, info));  // fills the tab: the diagram on a white card, any shortcut buttons, then the info card
          }  // ends stateTab()
          el.append(h('div', { class: 'split l fill' },  // builds the screen: the explanation on the left, the two tabs on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked
              h('p', { class: 'm0', html: 'Inside user space the VMM hands out addresses in <b>regions</b>. Each starts on a 64 KB boundary (the <span class="t">allocation granularity</span>) and is a whole number of pages long. Every page is in one of three states:' }),  // paragraph: regions start on 64 KB boundaries and every page is in one of three states
              h('div', { class: 'card tight small lh' }, h('span', { class: 'chip' }, 'Available'), ' ', h('span', { html: 'Not claimed (Windows calls it free). Touching it: <b class="c-bad">access violation</b>.' })),  // card: the available state and what touching it does
              h('div', { class: 'card tight small lh' }, h('span', { class: 'chip warn' }, 'Reserved'), ' ', h('span', { html: 'Claimed for later, with nothing behind it: no frame, no paging-file space, no commit charge. Touching it: <b class="c-bad">access violation</b>.' })),  // card: the reserved state, with nothing behind it
              h('div', { class: 'card tight small lh' }, h('span', { class: 'chip mem' }, 'Committed'), ' ', h('span', { html: 'Backed: each page is in physical memory or on disk, in the <span class="t">paging file</span> or a mapped file. Counts toward the <span class="t">commit charge</span>. A page gets a frame only when first touched.' })),  // card: the committed state, which counts toward the commit charge
              h('div', { class: 'callout why m0 small', 'data-label': 'Why reserve first?', html: 'A program can claim one long, unbroken range (1 MB for a thread stack, say) almost for free, then commit pieces only as it needs them. The addresses stay contiguous; memory is spent only on what is used.' })),  // why callout: why a program reserves a long range first and commits pieces later; closes the left column
            ctx.ui.tabs([{ label: 'Walk through the calls', render: walkTab }, { label: 'State diagram', render: (p) => stateTab(p) }])));  // the right column: two tabs, the animated walk and the state diagram; closes the split and the append
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------- 4. Lab: grow a thread stack through its guard page ---------------- */
      {  // step 4 starts here
        title: 'Lab: grow a thread’s stack through its guard page',  // title of step 4
        kind: 'lab',  // kind lab: the guide labels this step "Hands-on Lab"
        core: true,  // core: part of the shorter core path
        render(el, ctx) {  // render(): draws step 4 each time the screen opens
          const { h, s } = ctx;  // takes the two element builders out of ctx
          let S = stackNew(), probes = false;  // S: the stack model from stackNew(); probes: whether the compiler touches every page of a big frame in order
          const addrOf = (k) => hex(STK_BASE + k * PAGE);  // addrOf(k): the starting address of stack page k, in hex
          const KBs = (b) => b / KB + ' KB';  // KBs(b): writes a byte count in KB
          const slim = ctx.narrow;                   // phones get a slimmer drawing so the labels stay readable
          const svg = s('svg', { viewBox: slim ? '0 0 380 416' : '0 0 540 416', width: '100%' });  // svg: the stack drawing, a little less wide on phones
          const X = slim ? 92 : 112, W = slim ? 168 : 220, Y0 = 26, RH = 23;  // X and W: the left edge and width of the page rows; Y0: where the first row starts; RH: the height of one row
          const rowY = (k) => Y0 + (STK_N - 1 - k) * RH;      // page 15 at the top
          function cellInfo(p, k, sp) {  // cellInfo(p, k, sp): chooses the colour class, label and text colour for page k; sp is the stack pointer's page
            if (k === 0 && p.st === 'res') return ['s-warn', slim ? 'never committed' : 'reserved · never committed', 'tx-warn'];  // the bottom page, never committed: amber, labelled as the permanent barrier
            if (p.st === 'res') return ['s-warn', 'reserved', 'tx-warn'];  // any other reserved page: amber, labelled "reserved"
            if (p.st === 'guard') return ['s-intr', slim ? 'guard page' : 'guard page (committed)', 'tx-intr'];  // the guard page: red, labelled as a committed guard page
            const where = p.ram ? 'in RAM' : slim ? 'trimmed' : 'trimmed, not in RAM';  // where: whether a committed page holds a frame now, or was trimmed
            return [p.ram ? 's-mem' : 's-mem s-dash', (k >= sp ? 'in use · ' : 'committed · ') + where, 'tx-mem'];  // committed pages are green, dashed when trimmed; pages at or above the stack pointer are labelled "in use"
          }  // ends cellInfo()
          function draw(lastK) {  // draw(lastK): redraws the stack after every action; lastK is the page touched last, outlined more heavily
            const sp = stackSp(S), kids = [];  // sp: the stack pointer's page; kids collects every shape
            kids.push(s('text', { x: X + W / 2, y: 15, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'top of stack: ' + hex(STK_BASE + STK_N * PAGE) + ' (higher addresses)'));  // a caption above the rows: the top address of the stack, at the high end
            S.pages.forEach((p, k) => {  // one row per page
              const [cls, lab, tx] = cellInfo(p, k, sp), y = rowY(k), hot = k === lastK;  // its colour, label and text colour; y: its row position; hot: whether it was the page touched last
              const r = s('rect', { x: X, y, width: W, height: RH - 3, rx: 5, class: S.dead && k === S.crashK ? 's-intr' : cls, 'stroke-width': hot ? 3 : 1.5 });  // the row's rectangle; the page where a crash happened is drawn red
              if (p.ram && p.st === 'com') r.style.fill = k >= sp ? 'color-mix(in srgb, var(--mem) 45%, var(--panel))' : '';  // pages in use that hold a frame get a stronger green fill so the live part of the stack stands out
              const crash = S.dead && k === S.crashK ? { overflow: 'stack overflow here', av: 'access violation here', below: 'fault below this page' }[S.why] : null;  // crash: the message written on the crash page, chosen by the crash reason, or null when nothing crashed
              kids.push(r, s('text', { x: X - 8, y: y + 15, 'text-anchor': 'end', 'font-size': 13, class: 's-monot s-sub' }, addrOf(k)),  // adds the row, plus the page's address in grey to its left
                s('text', { x: X + W / 2, y: y + 15, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': crash ? 800 : 650, class: crash ? 'tx-intr' : tx }, crash || lab));  // and the label in the middle of the row, or the crash message in bold red
            });  // ends the loop over pages
            const spY = rowY(S.dead ? S.crashK : Math.max(0, sp)) + (RH - 3) / 2;  // spY: the middle of the row the stack pointer arrow points at (the crash page after a crash)
            kids.push(s('path', { d: `M${X + W + 6},${spY} l14,-9 v18 z`, style: 'fill:var(--ink)' }),  // a dark triangle to the right of the rows pointing at that page
              s('text', { x: X + W + 26, y: spY + 5, 'font-size': 14, 'font-weight': 800 }, S.dead ? (slim ? 'crash' : 'SP (crashed)') : slim ? 'SP' : 'SP: stack pointer'));  // its label: SP, the stack pointer, or a crash note; shorter words on phones
            if (sp < STK_N - 1 && !S.dead) {                  // bracket over the pages the current call chain uses
              const yTop = rowY(STK_N - 1), yBot = rowY(sp) + RH - 3, bx = X + W + (slim ? 50 : 128);  // yTop and yBot: from the top page down to the stack pointer's page; bx: where the bracket is drawn
              kids.push(s('path', { d: `M${bx - 6},${yTop} h6 V${yBot} h-6`, class: 's-line', style: 'stroke:var(--proc)' }),  // a teal bracket beside those pages
                mtext(s, bx + 8, (yTop + yBot) / 2 - 2, [`${S.frames.length} call${S.frames.length === 1 ? '' : 's'}`, 'deep'], { 'font-size': 13, 'font-weight': 700, class: 'tx-proc' }, 16));  // beside it, how many calls deep the thread is now
            }  // ends the bracket
            kids.push(s('text', { x: X + W / 2, y: Y0 + STK_N * RH + 12, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, (slim ? 'bottom: ' : 'bottom of the reservation: ') + hex(STK_BASE) + ' · the stack grows down ↓'));  // a caption under the rows: the bottom address of the reservation and an arrow showing the stack grows down
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes
          }  // ends draw()
          const mRes = meterRow(ctx, 'Reserved', 'warn'), mCom = meterRow(ctx, 'Commit charge', 'mem'), mRam = meterRow(ctx, 'Physical memory', 'proc');  // three meters under the drawing: reserved (amber), commit charge (green) and physical memory (teal)
          const say = h('div', { class: 'card white small lh', style: { flex: '1 1 auto', minHeight: '0' } });  // say: the white card that explains what the last action did
          // tell(r): one sentence per page the thread touched, built from the model's result
          function tell(r, big) {  // starts tell(); big is true when a 12 KB call ran without probes
            const at = `page ${r.k} (${addrOf(r.k)})`;  // at: the words "page k (address)", used in every sentence
            if (r.kind === 'hit') return `<b class="c-ok">No fault.</b> ${at[0].toUpperCase() + at.slice(1)} is committed and still in RAM${r.ret ? ': the caller’s own page' : ', left over from an earlier, deeper call'}.`;  // a hit: no fault, either the caller's own page after a return or a page left from an earlier, deeper call
            if (r.kind === 'guard') return `<b class="c-intr">Guard page hit</b> at ${at}. Windows catches the one-time exception, turns it into an ordinary stack page with a zero-filled frame, and commits page ${r.next} as the new guard: commit +4 KB, physical +4 KB.`;  // a guard page hit: Windows grows the stack by one page and moves the guard down; both meters rise by 4 KB
            if (r.kind === 'back') return `<b class="c-warn">Page fault</b> at ${at}. It was trimmed but is still committed, so the VMM brings it back: a soft fault if it is still on the standby or modified list, a hard fault if it must come from the paging file. Physical +4 KB; commit unchanged.`;  // a trimmed page brought back: a soft or hard fault, more physical memory, no change in commit charge
            if (r.kind === 'overflow') return `<b class="c-bad">Stack overflow.</b> ${at[0].toUpperCase() + at.slice(1)} held the last guard page; page 0 is never committed, so there is no room for a new guard. Windows raises a stack overflow exception, and since this program does not handle it, the process ends.`;  // a stack overflow: the last guard page was hit and the bottom page leaves no room for another
            const where = r.kind === 'below' ? 'an address below the whole reservation' : `${at}, which is only <b>reserved</b>: part of the stack’s range, but with nothing behind it`;  // where: the place of an access violation, below the whole reservation or on a page that is only reserved
            return `<b class="c-bad">Access violation</b>: the first write landed on ${where}. The process crashes.` +  // the access violation sentence
              (big ? ' The 12 KB frame jumped over the guard page. Compilers prevent this with <b>stack probes</b>: they touch each new page of a big frame in order, so the guard page is always hit first. Reset, turn probes on and try again.' : '');  // after a 12 KB call without probes, adds why the frame jumped the guard page and how stack probes prevent it
          }  // ends tell()
          const bCall = h('button', { class: 'btn sm proc', type: 'button', onclick: () => act('call') }, 'Call a function (1 page)');  // bCall: the button for an ordinary call whose frame needs one page
          const bBig = h('button', { class: 'btn sm proc', type: 'button', onclick: () => act('big') }, 'Call with a 12 KB local array');  // bBig: the button for a call whose frame holds a 12 KB array (three pages)
          const bRet = h('button', { class: 'btn sm', type: 'button', onclick: () => act('ret') }, 'Return');  // bRet: the Return button
          const bTrim = h('button', { class: 'btn sm os', type: 'button', onclick: () => act('trim') }, 'Memory runs short: trim');  // bTrim: the button that simulates memory running short
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { S = stackNew(); show(null, '<b>Reset.</b> A fresh thread: only the top page is committed and in use, with the guard page just below it.'); } }, 'Reset');  // bReset: starts a fresh thread and shows a short message about it
          const probeSeg = ctx.ui.seg([{ value: false, label: 'Probes off' }, { value: true, label: 'Probes on' }], probes, (v) => { probes = v; });  // probeSeg: the switch that turns stack probes off or on for big calls
          function show(lastK, html) {  // show(lastK, html): redraws everything and writes html into the explanation card
            draw(lastK);  // redraws the stack, outlining page lastK
            mRes.set(1, KBs(STK_N * PAGE)); mCom.set(stackCommit(S) / (STK_N * PAGE), KBs(stackCommit(S))); mRam.set(stackRam(S) / (STK_N * PAGE), KBs(stackRam(S)));  // updates the three meters: reserved is always full; commit and physical are fractions of the 64 KB reservation
            say.innerHTML = html + `<div class="xs muted mt">Reserved ${KBs(STK_N * PAGE)} · commit charge ${KBs(stackCommit(S))} · physical ${KBs(stackRam(S))} · guard-page hits ${S.guardHits} · faults ${S.faults}</div>`;  // writes the explanation, then a grey line of totals and counters under it
            [bCall, bBig, bTrim].forEach((b) => { b.disabled = S.dead; });  // after a crash the call and trim buttons are greyed out until Reset
            bRet.disabled = S.dead || !S.frames.length;  // Return is greyed out after a crash or when no call is active
          }  // ends show()
          function act(kind) {  // act(kind): runs when one of the lab buttons is pressed
            if (S.dead) return;  // after a crash nothing happens until Reset
            if (kind === 'trim') {  // the trim button
              const n = stackTrim(S);  // n: how many pages the model trimmed
              return show(null, `<b>Memory ran short.</b> The VMM trimmed ${n} page${n === 1 ? '' : 's'} from this process’s working set (every resident page except the one in use). They stay <b>committed</b>, their contents safe on the standby or modified list: physical memory fell, the commit charge did not. Now call or return into one of them.`);  // explains that trimming lowered physical memory but not the commit charge
            }  // ends the trim case
            if (kind === 'ret') {  // the Return button
              const [r] = stackRet(S);  // r: the result of touching the caller's page
              return show(r.k, `<b>Return.</b> The stack pointer moves back up to page ${r.k}. The pages below stay committed: a stack’s commit charge never shrinks on return, it records the deepest point reached. ` + tell(Object.assign(r, { ret: true }), false));  // explains that returning never lowers a stack's commit charge, then adds what the touch did, marked as a return
            }  // ends the return case
            const big = kind === 'big', out = stackCall(S, big ? 3 : 1, probes);  // big: whether this is the 12 KB call; out: the result of each page touched by the call
            const head = big ? `<b>Call with a 12 KB array</b> (3 pages; probes ${probes ? 'on, so each page is touched in order' : 'off, so the first write lands at the far end'}). ` : '<b>Call.</b> The new frame needs one page. ';  // head: the opening of the message, naming the kind of call and whether probes are on
            // narrate the touches in the order they happened, folding a run of guard-page hits into one sentence
            const parts = [];  // parts collects one sentence per touch, or one per run of guard-page hits
            for (let i = 0; i < out.length; i++) {  // goes through the touches in order
              let j = i; while (j + 1 < out.length && out[i].kind === 'guard' && out[j + 1].kind === 'guard') j++;  // j: how far a run of guard-page hits starting at i continues
              const run = out.slice(i, j + 1);  // run: the touches from i to j
              parts.push(run.length > 1 ? `<b class="c-intr">Guard page hit ${run.length} times</b>, at pages ${run.map((r) => r.k).join(', ')} in turn. Each time Windows turns the page into an ordinary stack page with a zero-filled frame and commits the next page down as the new guard: commit +${run.length * 4} KB, physical +${run.length * 4} KB.` : tell(out[i], big && !probes));  // a run of guard hits becomes one sentence with the total growth; a single touch gets its own sentence from tell()
              i = j;  // skips past the run just described
            }  // ends the loop over touches
            if (big && !probes && !S.dead) parts.push('It worked only because earlier, deeper calls had already committed the pages in between. Without probes, whether a big frame survives depends on luck.');  // a 12 KB call without probes that did not crash survived only by luck; this sentence says why
            show(out[out.length - 1].k, head + parts.join(' '));  // redraws with the last page touched outlined and shows the full message
          }  // ends act()
          show(null, '<b>Start.</b> A fresh thread: only the top page is committed and in use. Just below it waits the <b>guard page</b>; the other 14 pages are merely reserved. Press <b>Call</b> a few times and watch the meters.');  // the starting message, shown when the screen opens
          el.append(h('div', { class: 'split fill' },  // builds the screen: a two-column split filling the step
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: text and controls, stacked
              h('p', { class: 'm0', html: 'This stack <b>reserves</b> 16 pages (64 KB) at ' + hex(STK_BASE) + ' (a real thread reserves 1 MB by default). Only the top page starts out committed. Below it sits a <span class="t">guard page</span>: committed memory that raises a one-time exception when touched, which tells Windows the stack is growing.' }),  // paragraph: how this toy stack is laid out and what the guard page is for
              h('div', { class: 'row', style: { gap: '8px' } }, bCall, bRet, bTrim),  // the first row of buttons: Call, Return and Trim
              h('div', { class: 'row', style: { gap: '8px' } }, bBig, probeSeg, bReset),  // the second row: the 12 KB call button, the probes switch and Reset
              say,  // the explanation card
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Thinking reserved memory is usable. A reserved page has nothing behind it; the stack grows only because the guard page is always touched first.' })),  // common-mistake callout: thinking reserved memory can be used; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the drawing and the meters, stacked
              h('div', { class: 'card white', style: { padding: '4px 8px' } }, svg),  // the stack drawing on a white card
              h('div', { class: 'grid-3', style: { gap: '12px' } }, mRes, mCom, mRam))));  // the three meters side by side; closes the right column, the split and the append
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------- 5. Variable allocation, local scope ---------------- */
      {  // step 5 starts here
        title: 'Variable allocation, local scope: plentiful vs scarce memory',  // title of step 5
        kind: 'compare',  // kind compare: the guide labels this step "Compare"
        render(el, ctx) {  // render(): draws step 5 each time the screen opens
          const { h, s } = ctx;  // takes the two element builders out of ctx
          const REFS = [1, 2, 1, 3, 2, 4, 1, 2, 5, 1, 3, 2], CAP3 = 3;  // REFS: the 12 pages the process touches, in order; CAP3: the working-set size allowed when memory is scarce
          const lanes = [  // lanes: the two runs drawn one above the other
            { key: 'plenty', title: 'Memory plentiful: the working set grows', run: wsRun(REFS, Infinity), cls: 'ok' },  // the plentiful lane: wsRun with no cap, so the working set just grows; drawn in green
            { key: 'scarce', title: `Memory scarce: it keeps ${CAP3} pages and replaces its own`, run: wsRun(REFS, CAP3), cls: 'warn' },  // the scarce lane: wsRun capped at 3 pages, so the process replaces its own pages; drawn in amber
          ];  // closes the lanes list
          const rows = [Math.max(...lanes[0].run.map((x) => x.size)), CAP3];  // rows: how many frame rows each lane needs: the largest size the free run reached, and 3
          const slim = ctx.narrow;                   // phones: tighter columns and short labels so the text stays readable
          const CX = slim ? 40 : 96, CW = slim ? 28 : 44, VW = CX + REFS.length * CW + 6, colX = (t) => CX + t * CW;  // CX: where the first column starts; CW: the width of one column; VW: the drawing's total width; colX(t): column t's left edge
          const svg = s('svg', { viewBox: `0 0 ${VW} 360`, width: '100%' });  // svg: the drawing, sized to fit all 12 columns
          function draw(i) {                         // i = number of references done so far (0..12)
            const kids = [];  // kids collects every shape
            if (i > 0) kids.push(s('rect', { x: colX(i - 1) + 1, y: 4, width: CW - 2, height: 352, rx: 6, style: 'fill:var(--hl);opacity:.55' }));  // a yellow band behind the column of the latest reference, so the eye follows the animation
            kids.push(s('text', { x: CX - (slim ? 4 : 10), y: 24, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, slim ? 'page' : 'page used'));  // the header label at the left of the top row ("page used", or "page" on phones)
            REFS.forEach((p, t) => kids.push(s('text', { x: colX(t) + CW / 2, y: 24, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: t < i ? '' : 'opacity:.4' }, String(p))));  // the 12 page numbers across the top; those not reached yet are faded
            let y = 40;  // y: where the next row is drawn, moving down as each lane is added
            lanes.forEach((L, li) => {  // draws each lane in turn; li is 0 for plentiful and 1 for scarce
              const st = i > 0 ? L.run[i - 1] : { hard: 0, soft: 0, size: 0 };  // st: the lane's snapshot after i references, or zeros before the first
              kids.push(s('text', { x: 6, y: y + 14, 'font-size': 14, 'font-weight': 800, class: 'tx-' + L.cls }, slim ? L.title.split(':')[0] : L.title),  // the lane's title in its colour (only the part before the colon on phones)
                s('text', { x: VW - 6, y: y + 14, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, `hard ${st.hard} · soft ${st.soft} · ${st.size} page${st.size === 1 ? '' : 's'}`));  // at the right, the lane's running totals: hard faults, soft faults and the working-set size
              y += 24;  // moves down past the title
              for (let r = 0; r < rows[li]; r++) {  // one row per frame in this lane
                kids.push(s('text', { x: CX - (slim ? 4 : 10), y: y + r * 24 + 16, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, (slim ? 'f' : 'frame ') + (r + 1)));  // the row label at the left, "frame 1", "frame 2"... ("f1" on phones)
                for (let t = 0; t < REFS.length; t++) {  // one square per reference
                  const cell = t < i ? L.run[t].slots[r] : undefined, fresh = t < i && L.run[t].slot === r && L.run[t].kind !== 'hit';  // cell: the page in this frame after reference t (none yet for later columns); fresh: the frame just took a page by a fault
                  kids.push(s('rect', { x: colX(t) + 3, y: y + r * 24 + 2, width: CW - 6, height: 20, rx: 4, class: cell === undefined ? 's-panel' : fresh ? 's-' + (L.run[t].kind === 'hard' ? 'bad' : 'warn') : 's-proc', 'stroke-width': 1, style: cell === undefined ? 'opacity:.45' : '' }));  // the square: faded grey when empty, red for a page that just arrived by hard fault, amber by soft fault, teal otherwise
                  if (cell !== undefined) kids.push(s('text', { x: colX(t) + CW / 2, y: y + r * 24 + 17, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, String(cell)));  // writes the page number in the square when there is one
                }  // ends the loop over references
              }  // ends the loop over frame rows
              y += rows[li] * 24 + 4;  // moves down past the frame rows
              kids.push(s('text', { x: CX - (slim ? 4 : 10), y: y + 13, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'fault'));  // the "fault" row label
              L.run.forEach((x, t) => { if (t < i && x.kind !== 'hit') kids.push(s('text', { x: colX(t) + CW / 2, y: y + 13, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: x.kind === 'hard' ? 'tx-bad' : 'tx-warn' }, slim ? x.kind[0].toUpperCase() : x.kind)); });  // under each column, the kind of fault that happened (hard in red, soft in amber); just H or S on phones
              y += 20;  // moves down past the fault row
              if (li === 1) {  // the scarce lane gets one more row
                kids.push(s('text', { x: CX - (slim ? 4 : 10), y: y + 13, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, slim ? 'out' : 'dropped'));  // the "dropped" row label ("out" on phones)
                L.run.forEach((x, t) => { if (t < i && x.evicted != null) kids.push(s('text', { x: colX(t) + CW / 2, y: y + 13, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-mem' }, slim ? String(x.evicted) : x.evicted + '→sb')); });  // under each column, the page the process gave up and sent to the standby list
              }  // ends the extra row
              y += 16;  // leaves a gap before the next lane
            });  // ends the loop over lanes
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one go
          }  // ends draw()
          function caption(i) {  // caption(i): the text under the drawing for frame i of the animation
            if (i === 0) return '<b>Start.</b> Two copies of the same process touch the same 12 pages in the same order. Only one thing differs: how much memory is free. Every page starts out on disk, so a first touch is a hard fault (red, read from disk); amber = soft fault.';  // frame 0: explains the setup, two runs of the same pattern with different amounts of free memory, and the colours
            const a = lanes[0].run[i - 1], b = lanes[1].run[i - 1], p = a.p;  // a and b: the two lanes' snapshots for this reference; p: the page touched
            const one = (x) => x.kind === 'hit' ? 'already resident, no fault' : x.kind === 'hard' ? 'hard fault' : 'soft fault (back from the standby list)';  // one(x): a few words for what happened in one lane: no fault, a hard fault or a soft fault
            let txt = a.kind === 'hit' && b.kind === 'hit' ? `<b>Page ${p}</b> is resident in both runs: no fault` : `<b>Page ${p}.</b> Plentiful: ${one(a)}${a.kind !== 'hit' ? `; the working set grows to ${a.size}` : ''}. Scarce: ${one(b)}`;  // txt: either "resident in both runs" or what happened in each lane, with the plentiful lane's new size
            if (b.evicted != null) txt += `; already at ${CAP3} pages, it drops its least recently used page, <b>${b.evicted}</b>, to the standby list`;  // if the scarce lane had to give up a page, names the page it sent to the standby list
            txt += '.';  // adds the full stop after the caption sentence
            if (i === REFS.length) txt += ` <b>Totals:</b> ${a.hard + a.soft} faults with ${a.size} frames, against ${b.hard + b.soft} (${b.hard} hard + ${b.soft} soft) with ${CAP3}.`;  // on the last frame, adds the totals for both runs
            return txt;  // hands the caption to the player
          }  // ends caption()
          const player = ctx.ui.player({ count: REFS.length + 1, interval: 1700, render(i) { draw(i); return caption(i); } });  // player: 13 frames (the start plus one per reference), 1.7 seconds apart when playing; each frame redraws and returns its caption
          el.append(h('div', { class: 'split l fill' },  // builds the screen: a two-column split filling the step
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked
              h('p', { class: 'm0', html: 'Windows uses <span class="t">variable allocation</span> with local <span class="t">replacement scope</span> (8.2). A process’s <span class="t">working set</span> is its pages in physical memory right now; it has a minimum and a maximum size.' }),  // paragraph: Windows uses variable allocation with local scope, and what a Windows working set is
              h('ul', { class: 'm0 small lh', html: '<li><b>Memory plentiful:</b> on a fault the working set just grows (it may even pass its maximum).</li><li><b>Memory scarce:</b> the process gives up one of <b>its own</b> pages, one it has not used lately (Windows approximates LRU with the accessed bit), so its size stays the same.</li><li>The dropped page waits on the standby or modified list, so a quick return costs only a soft fault.</li>' }),  // bullet list: what happens on a fault when memory is plentiful, when it is scarce, and where dropped pages wait
              h('div', { class: 'callout why m0 small', 'data-label': 'Why local scope?', html: 'A process that faults a lot recycles only its own pages; it cannot steal frames from a quiet neighbour. Taking memory back is a separate job: trimming (next step).' }),  // why callout: local scope stops a busy process from taking frames from its neighbours
              (() => {                                // predict, then reveal the totals the two runs produced
                const A = lanes[0].run[REFS.length - 1], B = lanes[1].run[REFS.length - 1];  // A and B: the final snapshots of the two runs
                return h('div', { class: 'card tight small lh' }, h('div', { class: 'b', style: { marginBottom: '4px' } }, `Predict: with only ${CAP3} frames instead of ${A.size}, how many extra faults will the process take?`),  // a small card asking the student to predict how many extra faults the capped run takes
                  ctx.ui.reveal('Show the totals', `<b>${B.hard + B.soft - A.hard - A.soft} extra:</b> ${A.hard + A.soft} faults with ${A.size} frames, against ${B.hard + B.soft} (${B.hard} hard + ${B.soft} soft) with ${CAP3}. Every extra fault is soft: each dropped page was still on the standby list.`));  // a button that reveals the answer, built from the two runs' totals so it always matches the drawing
              })()),  // ends the prediction card and runs it at once; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white', style: { padding: '4px 8px' } }, svg), player.el)));  // right column: the drawing on a white card with the player under it; closes the split and the append
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------- 6. Lab: trimming and the standby / modified lists ---------------- */
      {  // step 6 starts here
        title: 'Lab: memory pressure, trimming and the second-chance lists',  // title of step 6
        kind: 'lab',  // kind lab: the guide labels this step "Hands-on Lab"
        core: true,  // core: part of the shorter core path
        render(el, ctx) {  // render(): draws step 6 each time the screen opens
          const { h } = ctx;  // takes the HTML builder h out of ctx; this step draws with page elements only
          let M = trimNew(), gen = 0, timer = null, ticks = 0;  // M: the lab model from trimNew(); gen: bumped on Reset so an old Play timer stops acting; timer: the Play timer; ticks: ticks run
          const LIST = { sb: 'standby', md: 'modified' };  // LIST: the full name of each list, for the sentences
          // describe(ev): turns one action's model events into plain sentences, in the order they matter
          function describe(ev) {  // starts describe(), which the log uses after every action
            const lines = [], hits = [], trims = [], takes = [];  // lines: the finished sentences; hits, trims and takes are gathered first and summed up at the end
            for (let i = 0; i < ev.length; i++) {  // goes through the events in order
              const e = ev[i];  // e: the current event
              if (e.type === 'hit') hits.push(e.owner + e.page);  // a hit is only noted by page name (such as B0) for the summary line
              else if (e.type === 'soft' || e.type === 'hard') {  // a soft or hard fault gets its own sentence
                const nx = ev[i + 1] && (ev[i + 1].type === 'grow' || ev[i + 1].type === 'replace') && ev[i + 1].owner === e.owner ? ev[++i] : null;  // nx: the same process's grow or replace event right after the fault, taken now (++i) so one sentence covers both
                let t = e.type === 'soft' ? `<b>${e.owner}${e.page}</b>: <b class="c-ok">soft fault</b>, taken back from the ${LIST[e.from]} list with no disk read`  // soft fault: the page was taken back from the standby or modified list without a disk read
                  : `<b>${e.owner}${e.page}</b>: <b class="c-bad">hard fault</b>, read from disk into ${e.from === 'free' ? 'a free frame' : `the frame of standby page ${e.lost}, whose in-memory copy is now gone`}`;  // hard fault: read from disk into a free frame, or into a reused standby frame whose old page is now gone
                if (nx && nx.type === 'grow') t += nx.plenty ? `. At least ${TPLENTY} frames are available, so ${e.owner}’s working set grows to ${nx.size}` : `. ${e.owner} is at its minimum, so it keeps the page (${nx.size} pages)`;  // grow: memory was plentiful and the working set grew, or the process was at its minimum and kept the page
                if (nx && nx.type === 'replace') t += `. Fewer than ${TPLENTY} frames are available, so ${e.owner} drops its own least recently used page, ${nx.owner}${nx.page}, to the ${LIST[nx.to]} list`;  // replace: memory was short, so the process dropped its own least recently used page to a list
                lines.push(t + '.');  // ends the sentence and adds it
              } else if (e.type === 'hog') lines.push(`The new program now holds <b>${e.to}</b> frame${e.to === 1 ? '' : 's'} (was ${e.from}).`);  // the slider changed the new program's frame count: says how many it holds now and how many before
              else if (e.type === 'take') takes.push(e);  // frames the new program took are gathered for one summary sentence
              else if (e.type === 'trim') trims.push(`${e.owner}${e.page} → ${LIST[e.to]}`);  // each trimmed page is noted as "page → list" for the trimmer's summary sentence
              else if (e.type === 'write') lines.push(e.reason === 'forced' ? `No free or standby frame was left, so the <b>modified page writer</b> first wrote ${e.pages.join(', ')} to the paging file.`  // a forced write: the writer had to save a modified page first because no free or standby frame was left
                : `<b>Modified page writer</b>${e.reason === 'batch' ? ' (the modified list had grown long)' : ''}: wrote ${e.pages.join(', ')} to the paging file; ${e.pages.length === 1 ? 'it moves' : 'they move'} to the standby list.`);  // a batch or manual write: names the pages written and says they move to the standby list
            }  // ends the loop over events
            if (takes.length) {  // if the new program took any frames, one sentence sums them up
              const fromFree = takes.filter((t) => t.from === 'free').length, lost = takes.filter((t) => t.lost).map((t) => t.lost);  // fromFree: how many came off the free list; lost: the standby pages whose frames were reused
              lines.push(`It took ${fromFree} free frame${fromFree === 1 ? '' : 's'}${lost.length ? ` and reused ${lost.length} standby frame${lost.length === 1 ? '' : 's'} (the in-memory copies of ${lost.join(', ')} are gone)` : ''}.`);  // the summary sentence, naming every page whose in-memory copy is now gone
            }  // ends the takes summary
            if (trims.length) lines.push(`<b>Trimmer:</b> available memory was under ${TPLENTY} frames, so it took the least recently used pages from the largest working sets: ${trims.join(', ')}.`);  // if the trimmer acted, one sentence explains why and lists every page it moved
            if (hits.length) lines.push(`<span class="muted">No fault (already in the working set): ${hits.join(', ')}.</span>`);  // hits come last, in grey, since nothing happened to them
            return lines;  // hands back the sentences for the log
          }  // ends describe()
          const grid = h('div', { class: 'fgrid' });  // grid: the box of 24 frame cells, laid out by the fgrid style
          const procRows = h('div', { class: 'stack', style: { gap: '4px' } });  // procRows: one row per process with a meter and its list of resident pages
          const sbRow = h('div', { class: 'row', style: { gap: '5px', minHeight: '30px' } }), mdRow = h('div', { class: 'row', style: { gap: '5px', minHeight: '30px' } });  // sbRow and mdRow: the standby and modified lists, each a row of clickable page chips
          const availLine = h('div', { class: 'small' });  // availLine: the line that adds up available memory
          const counters = h('div', { class: 'row', style: { gap: '6px' } });  // counters: the row of four counter chips
          const log = h('div', { class: 'log grow', style: { fontFamily: 'var(--font)', fontSize: '13.5px' } });  // log: the scrolling history of actions, newest at the top, in the ordinary typeface
          let before = null;  // before: the frame fingerprints from the last paint, so changed frames can be ringed
          const snap = () => M.frames.map((f) => f.use + (f.owner || '') + (f.page ?? '') + (f.dirty ? '*' : ''));  // snap(): a short text fingerprint of every frame (state, owner, page and changed mark)
          function paint() {  // paint(): redraws every part of the lab from the model, after every action
            const now = snap();  // now: the fingerprints of the frames as they are now
            grid.replaceChildren(...M.frames.map((f, i) => {  // rebuilds the 24 frame cells
              const lab = f.use === 'free' ? 'free' : f.use === 'hog' ? 'new' : f.owner + f.page + (f.dirty ? '*' : '');  // the cell's label: "free", "new" for the new program, or the page's name such as A3, with * if changed
              return h('div', { class: 'fcell ' + f.use + (before && before[i] !== now[i] ? ' chg' : ''), title: { ws: 'in the working set', sb: 'standby list', md: 'modified list', free: 'free list', hog: 'taken by the new program' }[f.use] }, lab);  // the cell, coloured by its state and ringed if it changed since the last paint; hovering it names its state
            }));  // ends the cell list
            before = now;  // remembers these fingerprints for the next paint
            procRows.replaceChildren(...PIDS.map((p) => {  // rebuilds the three process rows
              const n = wsOf(M, p).length, pages = wsOf(M, p).map((f) => f.page).sort((a, b) => a - b).join(' ');  // n: the size of the process's working set; pages: its resident page numbers in order
              return h('div', { class: 'row nw', style: { gap: '10px' } }, h('span', { class: 'small b c-proc', style: { width: '74px', flex: 'none' } }, 'Process ' + p),  // the row: the process name in bold teal
                h('div', { class: 'meter', style: { flex: '1 1 auto' } }, h('i', { style: { width: (n / 6) * 100 + '%', background: 'var(--proc)' } })),  // a meter that fills completely at 6 pages
                h('span', { class: 'small mono', style: { width: '186px', flex: 'none' } }, `${n} page${n === 1 ? '' : 's'}: ${pages || '–'}`));  // the size and the page list, or a dash when the working set is empty
            }));  // ends the process rows
            const chips = (use) => { const l = listOf(M, use); return l.length ? l.map(({ f, i }) => h('button', { class: 'btn sm mono ' + (use === 'sb' ? 'ok' : 'warn'), type: 'button', style: { color: `var(--${use === 'sb' ? 'ok' : 'warn'})`, borderColor: `var(--${use === 'sb' ? 'ok' : 'warn'})` }, title: `Let ${f.owner} touch ${f.owner}${f.page} again`, onclick: () => act('rescue', i) }, f.owner + f.page)) : [h('span', { class: 'small muted' }, 'empty')]; };  // chips(use): one button per page on a list, oldest first, in green or amber; a click lets the owner touch it again, else "empty"
            sbRow.replaceChildren(h('span', { class: 'small b c-ok', style: { width: '128px' } }, 'Standby list:'), ...chips('sb'));  // the standby row: its green label and its page buttons
            mdRow.replaceChildren(h('span', { class: 'small b c-warn', style: { width: '128px' } }, 'Modified list:'), ...chips('md'));  // the modified row: its amber label and its page buttons
            const free = M.frames.filter((f) => f.use === 'free').length, sb = listOf(M, 'sb').length, av = avail(M);  // free, sb and av: the counts that make up available memory
            availLine.innerHTML = `<b>Available</b> = free ${free} + standby ${sb} = <b class="${av >= TPLENTY ? 'c-ok' : 'c-bad'}">${av} frames</b> <span class="muted">· the trimmer acts when this falls below ${TPLENTY}</span>`;  // writes the sum, green when there is enough and red when the trimmer will act
            counters.replaceChildren(h('span', { class: 'chip bad' }, `hard faults ${M.hard}`), h('span', { class: 'chip ok' }, `soft faults ${M.soft}`), h('span', { class: 'chip warn' }, `pages written ${M.writes}`), h('span', { class: 'chip' }, `standby reused ${M.repurposed}`));  // refreshes the four counters: hard faults, soft faults, pages written and standby frames reused
          }  // ends paint()
          function record(head, ev) {  // record(head, ev): adds one action to the log under a bold heading, then repaints
            const lines = describe(ev);  // lines: the sentences for this action
            if (avail(M) < TPLENTY && PIDS.every((p) => wsOf(M, p).length <= TMIN))  // if memory is short and every working set is already at its minimum...
              lines.push(`<b class="c-bad">Every working set is down to its minimum of ${TMIN} pages</b>, the floor this simulated trimmer respects, so it can win back nothing more (real Windows dips below a minimum only when memory is desperately short). Each process now faults on almost every touch: the road to thrashing (8.2). Lower the slider to give memory back.`);  // ...adds a red warning that the trimmer can do no more and the processes are heading toward thrashing
            [...log.children].forEach((b) => { b.style.opacity = '0.6'; });  // fades the older log entries so the newest stands out
            log.prepend(h('div', { style: { paddingBottom: '4px' } }, h('div', { class: 'b' }, head), ...lines.map((l) => h('div', { html: l }))));  // puts the new entry at the top of the log
            while (log.children.length > 10) log.lastChild.remove();  // keeps at most 10 entries, removing the oldest
            paint();  // redraws the frames, rows, lists and counters
          }  // ends record()
          const playBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => (timer ? stop() : play()) }, 'Play');  // playBtn: starts or pauses automatic ticks
          function stop() { if (timer) clearInterval(timer); timer = null; playBtn.textContent = 'Play'; }  // stop(): cancels the Play timer and sets the button back to "Play"
          function play() { const g = gen; timer = ctx.every(1100, () => { if (g !== gen) return; act('tick'); }); playBtn.textContent = 'Pause'; }  // play(): runs a tick every 1.1 seconds while the slide is open; a timer from before a Reset does nothing
          function act(kind, arg) {  // act(kind, arg): carries out one student action and logs it
            if (kind === 'tick') { ticks++; record(`Tick ${ticks}: A, B and C each touch their next page`, trimTick(M)); }  // a tick: counts it and logs what A, B and C did
            else if (kind === 'rescue') { const f = M.frames[arg]; record(`You let ${f.owner} touch ${f.owner}${f.page} again`, trimRescue(M, arg)); }  // a rescue: the owner of the clicked page touches it again
            else if (kind === 'write') record('You ran the modified page writer', trimWrite(M));  // the "Write modified pages" button
            else if (kind === 'hog') record(`Slider: the new program wants ${arg} frame${arg === 1 ? '' : 's'}`, trimHog(M, arg));  // the slider: the new program now wants arg frames
          }  // ends act()
          const slider = ctx.ui.slider({ label: 'New program takes', min: 0, max: THOG, value: 0, format: (v) => v + ' frames', onInput: (v) => act('hog', v) });  // slider: how many frames the new program takes, from 0 to 14; each move runs the hog action
          function start(head) {  // start(head): fills the log with a starting message and paints the lab
            const used = PIDS.reduce((a, p) => a + wsOf(M, p).length, 0);  // used: how many frames the three working sets hold after the warm-up
            log.replaceChildren(h('div', {}, h('div', { class: 'b' }, head),  // replaces the log with one entry under the given heading
              h('div', { html: `A, B and C have each run three steps: ${used} frames hold their pages and ${TF - used} are free, so memory is plentiful. Press <b>Run 1 tick</b> a few times, then raise the slider.` })));  // the message: how many frames are used and free, and what to try first
            before = null; paint();  // clears the change rings and paints everything
          }  // ends start()
          const reset = () => { gen++; stop(); M = trimNew(); ticks = 0; slider.set(0); start('Reset.'); };  // reset: a new generation, playback stopped, a fresh model, the tick count and slider back to 0, then the start message
          const bTick = h('button', { class: 'btn sm primary', type: 'button', onclick: () => act('tick') }, 'Run 1 tick');  // bTick: runs a single tick
          const bWrite = h('button', { class: 'btn sm', type: 'button', onclick: () => act('write') }, 'Write modified pages');  // bWrite: runs the modified page writer on demand
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset');  // bReset: the Reset button
          el.append(h('div', { class: 'split l fill' },  // builds the screen: a two-column split filling the step
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: controls and the log, stacked
              h('p', { class: 'm0 small lh', html: 'Processes A, B and C share 24 frames. Each tick, every process touches the next page it needs; its pages start out on disk (a * marks a page it has changed). Raise the slider to start a big new program, run ticks, and watch the VMM <span class="t" data-t="trimming">trim</span> working sets. Click a page on a list to let its owner touch it again.' }),  // paragraph: how the lab works, what * means, and what to try
              slider,  // the slider
              h('div', { class: 'row', style: { gap: '8px' } }, bTick, playBtn, bWrite, bReset),  // the row of buttons: Run 1 tick, Play, Write modified pages and Reset
              counters,  // the counter chips
              log),  // the log; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: memory and the lists, stacked
              h('div', { class: 'card white', style: { padding: '8px 10px' } },  // a white card for physical memory
                h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '6px' } }, h('span', { class: 'xs b muted' }, 'PHYSICAL MEMORY: 24 FRAMES'),  // its header: the title on the left...
                  h('span', { class: 'row xs', style: { gap: '5px' } }, h('span', { class: 'chip proc' }, 'working set'), h('span', { class: 'chip ok' }, 'standby'), h('span', { class: 'chip warn' }, 'modified'), h('span', { class: 'chip' }, 'free'), h('span', { class: 'chip os' }, 'new program'))),  // ...and a legend of chips for the five frame states on the right
                grid),  // the frame grid itself; closes the card
              procRows,  // the three process rows
              h('div', { class: 'card tight stack', style: { gap: '4px' } }, sbRow, mdRow, availLine),  // a card with the standby list, the modified list and the available-memory sum
              h('div', { class: 'callout tip m0 small', 'data-label': 'Modern Windows', html: 'Since Windows 10, many pages headed for the paging file are first <b>compressed</b> and kept in memory. Since Windows 8, a suspended modern (Store) app can have its whole working set written out in one go.' }))));  // tip callout: compressed memory and whole-working-set swapping in newer Windows; closes the columns and the split
          start('Start.');  // writes the starting message and paints the lab when the screen opens
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------- 7. Recap ---------------- */
      {  // step 7 starts here
        title: 'Recap: six things to remember about Windows memory',  // title of step 7
        kind: 'recap',  // kind recap: the guide labels this step "Recap"
        render(el, ctx) {  // render(): draws step 7 each time the screen opens
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const L = layout(false), row = (r) => `<span class="mono">${hex(r.lo)}–${hex(r.hi)}</span> ${r.name.toLowerCase()}`;  // L: the default layout; row(r): one region as its address range and lower-case name
          el.append(h('div', { class: 'stack fill' },  // builds the screen: one stack filling the step
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // opening line: say each answer before flipping
            ctx.ui.flipcards([  // the six flip cards, three per row
              ['What are the four regions of the default 32-bit address map?', `<div class="small lh">${L.map(row).join('<br>')}<br>The 3 GB boot option moves the user/system line to 0xC0000000.</div>`],  // card 1: the four regions of the default map, with the ranges built from layout() so they always match step 2
              ['Reserved versus committed: what is the difference?', '<div class="small lh"><b>Reserved:</b> addresses claimed, nothing behind them, no commit charge; touching one faults. <b>Committed:</b> backed by RAM, the paging file or a mapped file; counts toward the commit charge; a frame arrives at first touch.</div>'],  // card 2: the difference between reserved and committed pages
              ['Why would a program reserve before committing?', '<div class="small lh">To claim one long, contiguous range almost for free (1 MB for a thread stack, say) and commit pieces only when they are needed. Regions start on 64 KB boundaries.</div>'],  // card 3: why a program reserves a range before committing any of it
              ['How does a thread stack grow?', '<div class="small lh">A <b>guard page</b> sits below the used part. Touching it raises a one-time exception; Windows makes it a normal page and commits the next page down as the new guard. No room left: <b>stack overflow</b>.</div>'],  // card 4: how the guard page lets a thread stack grow, and when it overflows
              ['What resident set policy does Windows use?', '<div class="small lh"><b>Variable allocation, local scope.</b> Working sets grow while memory is plentiful; when it is scarce, a faulting process replaces one of its own pages that has not been used recently.</div>'],  // card 5: the resident set policy Windows uses
              ['Where do trimmed pages go, and why does it matter?', '<div class="small lh">Unchanged pages go to the <b>standby list</b>, changed ones to the <b>modified list</b> (written to the paging file first). Touching one before its frame is reused is a cheap <b>soft fault</b>.</div>'],  // card 6: where trimmed pages wait and why that makes coming back cheap
            ], { cols: 3, height: 172 }),  // closes the card list; 3 columns, each card 172 pixels tall
            h('div', { class: 'card tight small lh', html: '<b>Also keep in mind:</b> ordinary pages are <b>4 KB</b> on x86 and x64 (Windows supports 4 KB to 64 KB, depending on the processor). 64-bit Windows gives each process <b>128 TB</b> of user space (Windows 8.1 and later). Since Windows 10, many evicted pages are <b>compressed in memory</b> before going to disk; since Windows 8, a suspended modern app can have its whole working set written out at once.' })));  // a closing card of extra facts: page sizes, 64-bit user space and memory compression; closes the stack and the append
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------- 8. Check yourself ---------------- */
      {  // step 8 starts here
        title: 'Check yourself',  // title of step 8
        kind: 'check',  // kind check: the guide labels this step "Check Yourself"
        quiz: [  // quiz: the questions; the guide's quiz engine draws them, checks answers and saves progress
          { q: 'On 32-bit Windows with the default layout, a program reads address <code>0x7FFF0010</code>. Which region is that, and what happens?',  // quiz question 1 (multiple choice): which region holds the address 0x7FFF0010 and what a read there does
            choices: ['User space: the read works if the page is committed', 'System space: the read works only in kernel mode', 'The guard region: the read raises an access violation', 'The null-pointer region: the read returns zero'], answer: 2,  // the four choices; answer 2, the guard region, is correct
            feedback: ['User space ends at 0x7FFEFFFF. Addresses 0x7FFF0000 to 0x7FFFFFFF form the 64 KB guard region.', 'System space starts at 0x80000000, which is above this address.', null, 'The null-pointer region is the lowest 64 KB (0x00000000–0x0000FFFF), and touching it faults rather than returning data.'],  // feedback for each wrong choice, saying where user space ends and where system space and the null region lie; none for the right one
            why: 'Default map: null-pointer region 0x00000000–0x0000FFFF, user space 0x00010000–0x7FFEFFFF, guard region 0x7FFF0000–0x7FFFFFFF, system space 0x80000000–0xFFFFFFFF. The guard region can never be accessed.' },  // explanation shown after answering: the four ranges of the default map
          { type: 'num', q: 'In the default 32-bit Windows layout, user space runs from <code>0x00010000</code> to <code>0x7FFEFFFF</code>. How many KB is that? (2 GB = 2,097,152 KB.)', answer: 2097024, tol: 0, unit: 'KB',  // quiz question 2 (calculate): the size of default user space in KB; the answer must be exact (tol 0)
            hint: 'The lower 2 GB minus the two 64 KB no-access regions.',  // hint: subtract the two 64 KB no-access regions from 2 GB
            why: '0x7FFEFFFF − 0x00010000 + 1 = 0x7FFE0000 bytes: the lower 2 GB minus the 64 KB null-pointer region and the 64 KB guard region. 2,097,152 − 128 = 2,097,024 KB.' },  // explanation: the subtraction in hex and in KB
          { type: 'tf', q: 'Reserving a 1 MB region (VirtualAlloc with MEM_RESERVE) raises the process’s commit charge by 1 MB.', answer: false,  // quiz question 3 (true or false): does reserving 1 MB raise the commit charge? (false)
            why: 'Reserving only claims addresses; nothing backs them, so the commit charge does not move. It rises only when pages are committed.' },  // explanation: reserving claims addresses only; committing raises the charge
          { type: 'num', q: 'A program reserves 1 MB, commits the first 5 pages (4 KB each), and then touches 2 of those 5 pages. By how many KB does its commit charge grow?', answer: 20, tol: 0, unit: 'KB',  // quiz question 4 (calculate): the commit charge after committing 5 pages and touching 2 of them
            why: 'The commit charge counts committed pages whether or not they have been touched: 5 × 4 KB = 20 KB. Only the 2 touched pages (8 KB) take physical memory, and the rest of the reservation costs nothing.' },  // explanation: every committed page counts, touched or not; only the touched ones use physical memory
          { type: 'bucket', q: 'Sort each description into the state of the pages it describes.', buckets: ['Available', 'Reserved', 'Committed'],  // quiz question 5 (sort into groups): put six descriptions under Available, Reserved or Committed
            items: [['Addresses no part of the program has claimed', 0], ['The range VirtualAlloc with MEM_RESERVE just returned', 1], ['Pages counted in the commit charge', 2], ['A page whose contents now sit in the paging file', 2], ['The part of a thread stack below its guard page', 1], ['A range right after VirtualFree with MEM_RELEASE', 0]],  // the six items, each with the number of its correct group
            why: 'Available addresses are unclaimed. Reserved ones are claimed but have no backing, like the unused part of a stack below its guard page. Committed pages are backed, in memory or in the paging file, and count toward the commit charge.' },  // explanation: what makes a page available, reserved or committed
          { type: 'order', q: 'Put the life of one region in order.',  // quiz question 6 (put in order): the life of one region
            items: ['The addresses are available', 'VirtualAlloc with MEM_RESERVE claims the range', 'VirtualAlloc with MEM_COMMIT backs the first pages', 'The first touch of a committed page gets it a zero-filled frame', 'VirtualFree with MEM_DECOMMIT returns the backing but keeps the addresses', 'VirtualFree with MEM_RELEASE makes the range available again'],  // the six stages in their correct order; the quiz engine shuffles them before showing
            why: 'Reserve, then commit, then touch: frames arrive last, only for pages actually used. On the way back, decommit returns the backing and release returns the addresses.' },  // explanation: reserve, commit, touch, then decommit and release on the way back
          { q: 'A function with a 16 KB local array first writes at the far end of its frame, jumping over the thread’s guard page onto a stack page that is reserved but not committed. What happens?',  // quiz question 7 (multiple choice): a 16 KB frame writes past the guard page onto a reserved page
            choices: ['Windows commits the page automatically, as it does for the guard page', 'A soft page fault brings the page in from the standby list', 'The write works, because the page belongs to the stack’s reservation', 'An access violation: a reserved page has nothing behind it'], answer: 3,  // the four choices; answer 3, an access violation, is correct
            feedback: ['Only touching the guard page makes Windows grow the stack. A reserved page gives the VMM nothing to bring in, so it reports an access violation.', 'A soft fault needs a committed page whose contents are still in memory; this page was never committed.', 'Belonging to a reservation is not enough: only committed pages can be used.', null],  // feedback for each wrong choice: only the guard page grows the stack, no soft fault, a reservation is not enough
            why: 'A stack grows one page at a time because the guard page is always touched first. For frames bigger than a page, compilers insert stack probes that touch each page in order.' },  // explanation: the guard page is always hit first, and stack probes keep it that way for big frames
          { q: 'Which resident set policy does Windows use?', choices: ['Fixed allocation, local scope', 'Variable allocation, local scope', 'Variable allocation, global scope', 'Fixed allocation, global scope'], answer: 1,  // quiz question 8 (multiple choice): the resident set policy Windows uses; answer 1, variable allocation with local scope
            feedback: ['Windows working sets are not fixed: they grow while memory is plentiful and are trimmed when it is scarce.', null, 'On a fault, a Windows process gives up one of its own pages, not any page in memory; taking memory from processes is done separately, by trimming.', 'Windows working sets change size, so the allocation is not fixed, and a faulting process replaces only its own pages. Fixed allocation cannot be paired with global scope anyway: taking any page in memory would change some process’s fixed size.'],  // feedback for each wrong choice, including why fixed allocation with global scope cannot work at all
            why: 'Working sets grow and shrink (variable allocation), and a faulting process that must give up a page gives up one of its own (local scope).' },  // explanation: working sets change size, and a faulting process gives up its own page
          { type: 'multi', q: 'Available memory has fallen too low. Which of these does the Windows VMM do? Select all that apply.',  // quiz question 9 (select all that apply): what the VMM does when available memory runs low
            choices: ['Trims working sets, removing pages that have not been used recently', 'Moves unchanged trimmed pages to the standby list', 'Moves changed trimmed pages to the modified list, to be written to disk before their frames are reused', 'Gives back the trimmed pages’ commit charge', 'Ends the process with the largest working set'], answer: [0, 1, 2],  // the five choices; the first three are correct
            why: 'Trimming only takes pages out of physical memory; they stay committed, so the commit charge does not change. Unchanged pages go to the standby list, changed ones to the modified list, and no process is ended.' },  // explanation: trimming keeps pages committed, sorts them by changed or unchanged, and ends no process
          { type: 'tf', q: 'A soft page fault has to read the page from the paging file.', answer: false,  // quiz question 10 (true or false): must a soft fault read the paging file? (false)
            why: 'A soft fault is resolved without disk I/O, for example by moving the page back from the standby or modified list into the working set. A fault that must read the disk is a hard fault.' },  // explanation: a soft fault needs no disk I/O; one that reads the disk is a hard fault
          { type: 'match', q: 'Match each Windows memory structure to what it holds.',  // quiz question 11 (match the pairs): each memory structure and what it holds
            pairs: [['Working set', 'A process’s pages that are in physical memory now'], ['Standby list', 'Pages removed unchanged, whose frames can be reused at once'], ['Modified list', 'Pages removed after being changed, not yet written out'], ['Paging file', 'Disk space for committed pages that left physical memory']],  // the four pairs: working set, standby list, modified list and paging file
            why: 'The working set is what is resident. Trimmed pages wait on the standby list (clean) or the modified list (dirty) until the modified page writer saves the dirty ones to the paging file.' },  // explanation: how pages move between the four structures
          { type: 'num', q: 'On 32-bit Windows booted with the 3 GB user-space option, how many GB of system space does each process’s address map keep?', answer: 1, tol: 0, unit: 'GB',  // quiz question 12 (calculate): system space left by the 3 GB boot option
            why: 'The 4 GB address space is split at 0xC0000000 instead of 0x80000000: 3 GB of user addresses below the line, leaving 0xC0000000–0xFFFFFFFF, which is 1 GB, for the system.' },  // explanation: the line moves to 0xC0000000, leaving 1 GB above it
        ],  // closes the quiz list
      },  // ends step 8
    ],  // closes the steps list
    notes: `${/* notes: the section's reading notes, shown in the Notes panel; the text is HTML */''}
<h3>The Windows virtual memory manager</h3>${/* notes heading: the Windows virtual memory manager */''}
<p>The <b>virtual memory manager (VMM)</b> is the part of the Windows executive that runs virtual memory. For every page it settles three things: where the process’s addresses may go (the address map), which addresses are backed (reserved or committed), and which pages are in physical memory now (the working set). Windows supports page sizes from 4 KB to 64 KB, depending on the processor; on x86 and x64 processors ordinary pages are <b>4 KB</b>.</p>${/* notes paragraph: the three things the VMM settles for every page, and the page sizes Windows uses */''}

<h3>The 32-bit address map</h3>${/* notes heading: the 32-bit address map */''}
<p>Each 32-bit process sees its own 4 GB of virtual addresses. By default the lower half is <b>user space</b> (private to the process: code, data, heap, stacks) and the upper half is <b>system space</b> (the same in every process, usable only in kernel mode).</p>${/* notes paragraph: each process's 4 GB, split into user space and system space */''}
<table>${/* starts the notes table of the four regions */''}
  <tr><th>Range</th><th>Region</th><th>Size</th><th>Why it exists</th></tr>${/* table header row: range, region, size and why it exists */''}
  <tr><td>0x00000000–0x0000FFFF</td><td>Null-pointer region</td><td>64 KB</td><td>Never usable, so following a null pointer (or null plus a small offset) faults at once.</td></tr>${/* table row: the null-pointer region and why it is never usable */''}
  <tr><td>0x00010000–0x7FFEFFFF</td><td>User space</td><td>2 GB − 128 KB</td><td>The program’s own space; an address works only if its page is committed.</td></tr>${/* table row: user space and its size, 2 GB minus 128 KB */''}
  <tr><td>0x7FFF0000–0x7FFFFFFF</td><td>Guard region</td><td>64 KB</td><td>No access. A pointer running off the top of user space faults here instead of reaching kernel memory, which simplifies the kernel’s pointer checks.</td></tr>${/* table row: the guard region and how it simplifies pointer checks */''}
  <tr><td>0x80000000–0xFFFFFFFF</td><td>System space</td><td>2 GB</td><td>Executive, kernel, HAL, device drivers and kernel data. Mapped into every process, so the kernel can serve a system call inside the caller’s own address space.</td></tr>${/* table row: system space, what lives there and why it is in every process */''}
</table>${/* ends the table */''}
<p>Worked size: user space is 0x7FFEFFFF − 0x00010000 + 1 = 0x7FFE0000 bytes = 2,097,152 KB − 128 KB = <b>2,097,024 KB</b>. A boot option gives programs marked large-address-aware <b>3 GB</b> of user space: the line moves to 0xC0000000, the guard region becomes 0xBFFF0000–0xBFFFFFFF, and system space shrinks to <b>1 GB</b>. User-mode code touching the null-pointer region, the guard region or system space gets an <b>access violation</b>. On 64-bit Windows each process has <b>128 TB</b> of user space (Windows 8.1 and later; earlier 64-bit versions gave 8 TB).</p>${/* notes paragraph: the worked user-space size, the 3 GB boot option, access violations and 64-bit user space */''}

<h3>Regions and their three states</h3>${/* notes heading: regions and their three states */''}
<p>The VMM hands out user space in <b>regions</b>. A region starts on a <b>64 KB boundary</b> (the allocation granularity) and is a whole number of pages long; reserving even 4 KB uses up the rest of that 64 KB of addresses, so programs reserve big pieces and let a heap carve them up. Every page is in one of three states:</p>${/* notes paragraph: regions start on 64 KB boundaries, so programs reserve large pieces */''}
<ul>${/* starts the list of the three states */''}
  <li><b>Available</b> (Windows calls it free): not claimed; touching it faults.</li>${/* list item: the available state */''}
  <li><b>Reserved</b>: claimed for the process so nothing else lands there, but with nothing behind it: no frame, no paging-file space, no commit charge. Touching it faults.</li>${/* list item: the reserved state, with nothing behind it */''}
  <li><b>Committed</b>: backed by storage the VMM has promised. Each page is in physical memory or on disk, in the <b>paging file</b> or in a mapped file. Committed private pages count toward the <b>commit charge</b>, which may not exceed the commit limit (roughly RAM plus the paging files). A committed page gets a frame only when first touched (a zero-filled frame, with no disk read).</li>${/* list item: the committed state, the commit charge and the commit limit */''}
</ul>${/* ends the list */''}
<p>The calls: <b>VirtualAlloc(MEM_RESERVE)</b> reserves; <b>VirtualAlloc(MEM_COMMIT)</b> commits reserved pages (both flags together reserve and commit in one call); <b>VirtualFree(MEM_DECOMMIT)</b> returns the backing but keeps the addresses reserved; <b>VirtualFree(base, 0, MEM_RELEASE)</b> returns the whole region, which becomes available again.</p>${/* notes paragraph: the four calls that reserve, commit, decommit and release */''}
<p>Why reserve first? A program can claim one long, contiguous range almost for free (1 MB for a thread stack, or a table that may grow) and commit pieces only as it needs them.</p>${/* notes paragraph: why programs reserve first */''}
<p>Worked example (4 KB pages): reserve 1 MB → claimed 1,024 KB, commit charge 0, physical 0. Commit the first 64 KB → commit charge 64 KB, physical still 0. Touch byte 0 → page 0 gets a frame, physical 4 KB. Write byte 70000 → page 17 (70000 ÷ 4096 = 17.09), only reserved → access violation; an exception handler commits page 17 (commit charge 68 KB) and the retried write gives it a frame (physical 8 KB). Decommit the first 64 KB → commit charge 4 KB, physical 4 KB. Release → everything back to 0.</p>${/* notes paragraph: the worked example from step 3, with the commit charge and physical memory after each call */''}
<h3>How a thread stack grows: the guard page</h3>${/* notes heading: how a thread stack grows through its guard page */''}
<p>A thread stack is a reserved region (1 MB by default) that grows toward lower addresses. At first only the top page is committed. Just below the used part sits a <b>guard page</b> (PAGE_GUARD): committed memory that raises a one-time exception when touched.</p>${/* notes paragraph: a thread stack's reservation and the guard page below its used part */''}
<ol>${/* starts the numbered list of the growth steps */''}
  <li>A call pushes the stack into the guard page and touches it.</li>${/* growth step 1: a call touches the guard page */''}
  <li>Windows catches the exception and turns the page into an ordinary stack page (it gets a zero-filled frame).</li>${/* growth step 2: Windows turns it into an ordinary stack page */''}
  <li>Windows commits the next page down as the new guard page. Commit charge +4 KB, physical memory +4 KB.</li>${/* growth step 3: the next page down becomes the new guard; commit and physical memory both rise */''}
  <li>When there is no room for another guard page (the bottom page of the reservation is never committed), Windows raises a <b>stack overflow</b> exception; if the program does not handle it, the process ends.</li>${/* growth step 4: with no room for another guard page, a stack overflow */''}
</ol>${/* ends the numbered list */''}
<p>A frame bigger than a page could jump over the guard page onto a page that is only reserved, which is an access violation. Compilers prevent this with <b>stack probes</b> that touch each new page in order. Returns do not decommit stack pages, so the commit charge records the deepest point reached. Trimming lowers physical memory, not the commit charge.</p>${/* notes paragraph: big frames and stack probes, why returns keep the commit charge, and what trimming lowers */''}

<h3>Resident set management: variable allocation, local scope</h3>${/* notes heading: resident set management with variable allocation and local scope */''}
<p>In Windows a process’s <b>working set</b> is its set of pages in physical memory right now (its resident set). Each working set has a minimum and a maximum size; these are soft limits. On a page fault the VMM brings the page in, and then:</p>${/* notes paragraph: the Windows working set and its soft minimum and maximum */''}
<ul>${/* starts the list of what happens after a fault */''}
  <li><b>Memory plentiful:</b> the working set simply grows (it may pass its maximum).</li>${/* list item: when memory is plentiful the working set grows */''}
  <li><b>Memory scarce:</b> the faulting process gives up one of <b>its own</b> pages that has not been used recently (Windows approximates LRU with the accessed bit), so its size stays the same. This is local scope: a busy process cannot steal frames from its neighbours on a fault.</li>${/* list item: when memory is scarce the process gives up one of its own pages */''}
</ul>${/* ends the list */''}
<p>Worked example: one process touches pages 1 2 1 3 2 4 1 2 5 1 3 2. With memory plentiful its working set grows to 5 pages and it takes <b>5 faults</b>, all hard first touches. Held to 3 pages with local LRU replacement, it takes <b>8 faults</b>: 5 hard plus 3 soft, because each dropped page was still waiting on the standby list.</p>${/* notes paragraph: the worked example from step 5, 5 faults against 8 */''}

<h3>Trimming and the second-chance lists</h3>${/* notes heading: trimming and the second-chance lists */''}
<p><b>Available memory</b> = free frames + standby frames. When it falls too low, the VMM <b>trims</b> working sets: it removes the least recently used pages of processes that are above their minimum. Trimmed pages are not thrown away at once (page buffering):</p>${/* notes paragraph: what available memory is and what the trimmer removes */''}
<ul>${/* starts the list of where trimmed pages go */''}
  <li>An unchanged page goes to the <b>standby list</b>. Its contents are still valid; its frame can be reused immediately if memory is needed.</li>${/* list item: unchanged pages go to the standby list */''}
  <li>A changed page goes to the <b>modified list</b>. The <b>modified page writer</b>, a system thread, writes such pages to the paging file (usually in batches) and then moves them to the standby list.</li>${/* list item: changed pages go to the modified list and the modified page writer */''}
  <li>If the owner touches a page that is still on either list, the VMM moves it back into the working set with no disk read: a <b>soft page fault</b>.</li>${/* list item: touching a page still on a list is a soft fault */''}
  <li>Once a standby frame has been reused for something else, the old copy is gone, and the next touch is a <b>hard page fault</b> that reads the page from disk (the paging file or a mapped file).</li>${/* list item: once a standby frame is reused, the next touch is a hard fault */''}
</ul>${/* ends the list */''}
<p>Once every working set is near its minimum, trimming wins back little and processes fault on almost every touch: the road to thrashing. Since Windows 10, many pages headed for the paging file are first compressed in memory; since Windows 8, a suspended modern app can have its whole working set written out at once.</p>`,  // notes paragraph: near the minimum, trimming wins little and thrashing follows; newer Windows features; the backtick ends the notes
  });  // ends the section object and the Guide.section call
})();  // ends the wrapper function and runs it at once
