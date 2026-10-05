// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   8.2 Operating System Software (the virtual-memory policies)
   Original teaching material. The pure models (no DOM) sit first, between the
   models:start and models:end markers, so every number a student sees comes
   from the same code that draws the simulations. Helpers stay inside this IIFE
   so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away (an IIFE), so its names stay private to this file
/* models:start */
  // ---- Pure models used by the steps (no DOM). Every number a student sees comes from these. ----

  // simulate(policy, refs, n): runs one replacement policy ('opt' | 'lru' | 'fifo' | 'clock') over the
  // reference string refs with n frames and records the full state after every reference.
  function simulate(policy, refs, n) {  // simulate(): the replacement simulator behind the lab grids, the prediction step and the size chart; gives back the fault count and one snapshot per reference
    const frames = Array(n).fill(null), use = Array(n).fill(0), loaded = Array(n).fill(-1), last = Array(n).fill(-1);  // frames: the page in each frame (null = empty); use: the use bits; loaded: when each page arrived (for FIFO); last: when each was last referenced (for LRU)
    let ptr = 0, faults = 0;  // ptr is the clock pointer (the frame it will examine next); faults counts the page faults so far
    const steps = [];  // steps collects one snapshot per reference, which the grids and captions read later
    refs.forEach((p, t) => {  // goes through the reference string in order; p is the page referenced and t its position in time, counting from 0
      let slot = frames.indexOf(p);  // slot: the frame that already holds page p, or -1 when p is not in memory
      const hit = slot >= 0, ptrBefore = ptr, passed = [];  // hit is true when the page is resident; ptrBefore remembers where the clock pointer started; passed lists the frames the clock skips
      let victim = null, info = null;  // victim will be the page thrown out (null if none); info keeps the fact that decided it (next use, last use or load time)
      if (hit) { last[slot] = t; use[slot] = 1; }  // a hit: records the time of this use (LRU needs it) and sets the page's use bit (clock needs it); nothing is evicted
      else {  // otherwise the page is missing from memory: a page fault
        faults++;  // counts the fault
        if (policy === 'clock') {  // the clock policy chooses its frame in its own way
          // advance from the pointer: a frame with use bit 1 gets the bit cleared and is passed over
          while (frames[ptr] !== null && use[ptr] === 1) { use[ptr] = 0; passed.push(ptr); ptr = (ptr + 1) % n; }  // while the frame under the pointer holds a page with use bit 1: clear the bit, note the frame as passed, move the pointer on (% wraps it round)
          slot = ptr; ptr = (ptr + 1) % n;  // the pointer now rests on an empty frame or one with use bit 0: that frame is used, and the pointer moves one past it
        } else {  // OPT, LRU and FIFO choose the frame differently
          slot = frames.indexOf(null);  // first looks for an empty frame (indexOf gives -1 when there is none)
          if (slot < 0) {  // no empty frame: a resident page must be evicted
            // bigger score = better victim; ties go to the lowest frame number
            const score = frames.map((q, k) => {  // score gives every frame a number saying how good a victim its page would be
              if (policy === 'fifo') return -loaded[k];  // FIFO: an earlier load time gives a bigger score, so the oldest page wins
              if (policy === 'lru') return -last[k];  // LRU: an earlier last use gives a bigger score, so the page unused the longest wins
              const nx = refs.indexOf(q, t + 1);  // OPT: finds where page q is referenced next after now (-1 if never)
              return nx < 0 ? Infinity : nx;  // a page never used again scores Infinity, the best possible victim; otherwise the farther away its next use, the better
            });  // ends the scoring function
            slot = score.indexOf(Math.max(...score));  // the victim frame is the one with the highest score; indexOf finds the first, so ties go to the lowest frame number
            if (policy === 'opt') { const nx = refs.indexOf(frames[slot], t + 1); info = nx < 0 ? -1 : nx; }  // for OPT, info keeps the victim's next-use time (or -1 for never) so the caption can explain the choice
            else info = policy === 'fifo' ? loaded[slot] : last[slot];  // for FIFO, info keeps the victim's load time; for LRU, its last-use time
          }  // ends the no-empty-frame case
        }  // ends the choice for OPT, LRU and FIFO
        victim = frames[slot];  // victim: the page that was in the chosen frame (null when the frame was empty)
        frames[slot] = p; loaded[slot] = t; last[slot] = t; use[slot] = 1;  // loads page p into that frame, records now as its load time and last use, and sets its use bit
      }  // ends the fault case
      steps.push({ t, page: p, hit, slot, victim, info, passed, ptrBefore, ptr, frames: frames.slice(), use: use.slice(), faults });  // saves a full snapshot of this step, with copies of the frames and use bits so later steps cannot change it
    });  // ends the loop over the references
    return { faults, steps };  // hands back the total number of faults and the list of snapshots
  }  // ends simulate

  // prepage(refs, k, nPages): fetch policy with unlimited frames. On a fault the OS reads the faulting page and
  // the next k - 1 pages stored after it on disk (k = 1 is pure demand paging) in ONE disk operation.
  const SEEK = 8, XFER = 0.1;   // ms to reach the data on disk, ms to transfer one page (rough hard-disk figures)
  function prepage(refs, k, nPages) {  // prepage(): runs the fetch-policy example of step 2; memory never fills up, so only faults and disk reads matter
    const resident = new Set(), loadedBy = {};  // resident: the pages already in memory; loadedBy: for each page read, the time of the fault that brought it in
    let faults = 0, ops = 0, read = 0, ms = 0;  // counters: faults, disk operations (ops), pages read in all, and total disk time in milliseconds
    const steps = [];  // steps: one record per reference, used by the drawing
    refs.forEach((p, t) => {  // walks the reference string; p is the page referenced at time t
      let got = [];  // got lists the pages read from disk at this step (stays empty when there is no fault)
      if (!resident.has(p)) {  // page p is not in memory: a page fault
        faults++; ops++;  // counts the fault and the one disk operation that serves it
        for (let q = p; q < Math.min(nPages, p + k); q++) if (!resident.has(q)) { resident.add(q); got.push(q); loadedBy[q] = t; }  // reads p and the next k - 1 page numbers (not past the last page), skipping any already in memory, and notes when each arrived
        read += got.length; ms += SEEK + XFER * got.length;  // adds the pages read to the total, and charges one seek plus one transfer per page to the disk time
      }  // ends the fault case
      steps.push({ t, page: p, fault: got.length > 0, got, faults });  // saves this reference's record: the page, whether it faulted, which pages came in, and the running fault count
    });  // ends the loop over the references
    const used = new Set(refs);  // used: every page the process actually references
    const wasted = Object.keys(loadedBy).map(Number).filter((q) => !used.has(q));  // wasted: the pages that were read from disk but never referenced at all
    return { faults, ops, read, ms, wasted, steps, loadedBy };  // hands back the totals, the wasted pages, the per-reference records and the arrival times
  }  // ends prepage

  // enhancedClock(frames, ptr): frames = [{ page, u, m }]. Returns every frame the pointer examines (events)
  // in order, the chosen frame, and what the simple one-bit clock would have chosen from the same state.
  function enhancedClock(frames, ptr) {  // enhancedClock(): the clock policy that also checks the modified bit, used by the first tab of step 5
    const n = frames.length, f = frames.map((x) => ({ ...x })), events = [];  // n is the number of frames; f is a copy of the frames so clearing bits does not touch the picture; events records every frame looked at
    let victim = -1, pass = 0;  // victim: the chosen frame (-1 until one is found); pass counts the scans made so far (1 to 4)
    const scanFor00 = () => {  // scanFor00(): one trip round the ring looking for u = 0 and m = 0, changing no bits
      pass++;  // counts this scan
      for (let k = 0; k < n; k++) {  // examines each of the n frames once, starting at the pointer
        const i = (ptr + k) % n, x = f[i];  // i is the frame reached (wrapping past the last frame back to 0); x holds its bits
        const hit = x.u === 0 && x.m === 0;  // a match is a page not used lately and not modified: the cheapest victim, since it needs no disk write
        events.push({ pass, look: '00', i, u: x.u, m: x.m, pick: hit, cleared: false, bits: f.map((y) => ({ ...y })) });  // records what the pointer saw, with a copy of every frame's bits at this moment, for the step-through animation
        if (hit) return i;  // stops at the first match and gives back its frame number
      }  // ends the loop over the frames
      return -1;  // -1 means a whole trip found no match
    };  // ends scanFor00
    const scanFor01 = () => {  // scanFor01(): one trip looking for u = 0 and m = 1, clearing the use bit of every frame it passes
      pass++;  // counts this scan
      for (let k = 0; k < n; k++) {  // examines each frame once, starting at the pointer
        const i = (ptr + k) % n, x = f[i];  // i is the frame reached (wrapping round); x holds its bits
        const hit = x.u === 0 && x.m === 1, before = { u: x.u, m: x.m };  // a match is a page not used lately but modified; before keeps the bits as found, for the caption
        if (!hit && x.u === 1) x.u = 0;  // no match and its use bit is 1: the bit is cleared, so the page counts as not used lately on the next scan
        events.push({ pass, look: '01', i, u: before.u, m: before.m, pick: hit, cleared: !hit && before.u === 1, bits: f.map((y) => ({ ...y })) });  // records the frame, whether it matched and whether its bit was cleared, with a snapshot of all bits after the change
        if (hit) return i;  // stops at the first match
      }  // ends the loop over the frames
      return -1;  // -1 means no match on this trip
    };  // ends scanFor01
    victim = scanFor00();  // step 1: look for a page that is idle and clean
    if (victim < 0) victim = scanFor01();  // step 2, only if step 1 failed: look for an idle page that is modified, clearing use bits along the way
    if (victim < 0) victim = scanFor00();  // step 3, part one: every use bit is now 0, so step 1 is repeated
    if (victim < 0) victim = scanFor01();  // step 3, part two: if that failed too, step 2 runs again and is now sure to find a frame
    // simple clock on the same starting state: pass frames with u = 1 (clearing them), take the first u = 0
    let j = ptr, guard = 0;  // j walks the ring from the starting pointer; guard caps the loop at two trips as a safety limit
    const g = frames.map((x) => ({ ...x }));  // g is a fresh copy of the starting bits, so the simple clock sees what the smarter one saw at the start
    while (g[j].u === 1 && guard++ < 2 * n) { g[j].u = 0; j = (j + 1) % n; }  // passes every frame with u = 1, clearing its bit, until it reaches one with u = 0
    return { events, victim, passes: pass, simple: j };  // hands back the scan log, the chosen frame, how many scans it took, and the simple clock's choice for comparison
  }  // ends enhancedClock

  // makeBuffer(): page buffering with a FIFO resident set of RES pages, TOTAL frames in all, and the modified
  // list written out in batches of BATCH. Also runs plain FIFO (no buffering) on the same references for comparison.
  function makeBuffer(RES = 4, TOTAL = 7, BATCH = 3) {  // makeBuffer(): builds the page-buffering model behind the second tab of step 5; defaults: 4 resident pages, 7 frames, batches of 3
    const S = {  // S is the whole state of the model, kept in one object that the tab reads and redraws from
      frame: Array(TOTAL).fill(null),            // page held by each frame (it stays there while on a list)
      dirty: Array(TOTAL).fill(false),           // modified bit of the page in each frame
      resident: [],                               // frames of the resident set, oldest first
      free: Array.from({ length: TOTAL }, (_, i) => i),   // free page list: frames, head first
      modified: [],                               // modified page list: frames, head first
      reads: 0, writes: 0, batches: 0, rescues: 0, refs: 0,  // counters shown in the tiles: disk reads, disk writes, write batches, faults reclaimed with no read, references made
      plain: { set: [], dirty: {}, reads: 0, writes: 0 },  // plain FIFO, same resident-set size, no buffering
      log: '',  // log keeps the explanation of the latest reference
    };  // closes the state object
    function flush() {  // flush(): writes the whole modified list to disk in one batch and gives back a sentence describing it
      if (!S.modified.length) return '';  // nothing waiting to be written: nothing to say
      const pages = S.modified.map((f) => S.frame[f]);  // pages: the page numbers in the modified list, for the sentence
      S.writes += S.modified.length; S.batches++;  // counts one disk write per page, but only one batch
      S.modified.forEach((f) => { S.dirty[f] = false; S.free.push(f); });  // each frame written is now clean and joins the tail of the free list, still holding its page
      S.modified = [];  // empties the modified list
      return ` The modified list reached ${BATCH}, so pages ${pages.join(', ')} are written to disk in one batch and their frames join the free list (the pages are still there).`;  // the sentence added to the caption: which pages went out together, and that they are still in their frames
    }  // ends flush
    function evictOldest() {  // evictOldest(): removes the oldest page from the full resident set and parks its frame on a list
      const f = S.resident.shift(), p = S.frame[f];  // f is the oldest resident frame (shift takes it off the front of the list); p is the page it holds
      if (S.dirty[f]) { S.modified.push(f); return ` Resident set full: page ${p} (oldest, modified) goes to the tail of the modified list.`; }  // a modified page goes to the tail of the modified list, because it must be written before its frame is reused
      S.free.push(f); return ` Resident set full: page ${p} (oldest, clean) goes to the tail of the free list.`;  // a clean page goes straight to the tail of the free list; either way a sentence explains what happened
    }  // ends evictOldest
    S.ref = function (p, write) {  // S.ref(p, write): the student references page p (as a read, or a write when write is true); gives back the caption
      S.refs++;  // counts the reference
      let msg = '';  // msg builds the explanation sentence by sentence
      const rf = S.resident.find((f) => S.frame[f] === p);  // rf: the resident frame holding page p, if any
      if (rf != null) { if (write) S.dirty[rf] = true; msg = `Page ${p} is resident: no fault.`; }  // resident: a write sets its modified bit, and the caption reports no fault
      else {  // not resident: a page fault
        const onFree = S.free.find((f) => S.frame[f] === p), onMod = S.modified.find((f) => S.frame[f] === p);  // looks for the page still parked in a frame on the free list or on the modified list
        if (onFree != null || onMod != null) {  // it is still in memory on one of the lists
          const f = onFree != null ? onFree : onMod;  // f is that frame, whichever list it was on
          if (onFree != null) S.free.splice(S.free.indexOf(f), 1); else S.modified.splice(S.modified.indexOf(f), 1);  // takes the frame off its list (splice removes one item at the given position)
          S.rescues++;  // counts a reclaim: a fault served with no disk read
          msg = `Page fault, but page ${p} is still in frame ${f} on the ${onFree != null ? 'free' : 'modified'} list: it is <b>reclaimed</b> with no disk read.`;  // the caption explains the cheap fault: the page was found on a list and moved back
          if (S.resident.length >= RES) msg += evictOldest();  // if the resident set is already full, the oldest page is moved out to make room
          S.resident.push(f); if (write) S.dirty[f] = true;  // the frame rejoins the resident set as the newest; a write marks it modified
        } else {  // the page is not in memory at all, so it must be read from disk
          if (S.resident.length >= RES) msg += evictOldest();  // if the resident set is full, its oldest page is parked on a list first
          if (!S.free.length) msg += flush();  // no free frame left: the modified list is written out so its frames become free
          const f = S.free.shift(), old = S.frame[f];  // takes the frame at the head of the free list; old is the page still parked there, which is about to be overwritten
          S.frame[f] = p; S.dirty[f] = !!write; S.reads++;  // loads page p into that frame, marks it modified only for a write, and counts one disk read
          S.resident.push(f);  // the frame joins the resident set as the newest
          msg = `Page fault.${msg} Page ${p} is read from disk into frame ${f}, the head of the free list${old != null ? ` (page ${old}, still parked there, is now gone for good)` : ''}.`;  // the caption: page fault, any evictions, then where page p was read into and which parked page was lost
        }  // ends the read-from-disk case
        if (S.modified.length >= BATCH) msg += flush();  // once the modified list reaches the batch size, it is written out together
      }  // ends the fault case
      // plain FIFO on the same reference
      const P = S.plain, k = P.set.indexOf(p);  // P is the plain FIFO model; k is the position of page p in its resident set (-1 if absent)
      if (k >= 0) { if (write) P.dirty[p] = true; }  // plain FIFO hit: a write only marks the page dirty
      else {  // plain FIFO fault
        if (P.set.length >= RES) { const v = P.set.shift(); if (P.dirty[v]) P.writes++; delete P.dirty[v]; }  // if its set is full, the oldest page is dropped at once; a dirty one costs a single disk write
        P.set.push(p); P.reads++; P.dirty[p] = !!write;  // page p joins the set, costing a disk read, and is dirty only for a write
      }  // ends the plain FIFO fault case
      S.log = msg;  // keeps the latest explanation in S.log
      return msg;  // hands the explanation back to the tab
    };  // ends S.ref
    return S;  // hands back the finished model
  }  // ends makeBuffer

  // workingSet(refs, t, delta): the distinct pages referenced in the window of the last delta references
  // ending at virtual time t (t counts from 1).
  function workingSet(refs, t, delta) {  // workingSet(): used by the working-set tab and its size bars
    return [...new Set(refs.slice(Math.max(0, t - delta), t))];  // takes the last delta references up to time t (slice), removes repeats with a Set, and gives the pages back as a list
  }  // ends workingSet

  // pff(refs, F): page fault frequency. On each fault, if fewer than F references have passed since the last
  // fault the faulting page is simply added; otherwise pages with use bit 0 are dropped first and the
  // survivors' use bits are reset.
  function pff(refs, F) {  // pff(): runs the page fault frequency policy for the PFF tab of step 7
    const R = new Map(); let lastFault = 0, faults = 0;  // R maps each resident page to its use bit; lastFault is the time of the previous fault; faults counts them
    const steps = refs.map((p, i) => {  // builds one record per reference, in order
      const t = i + 1;  // t is the virtual time, counting from 1
      let fault = false, action = null, dropped = [], gap = null;  // what happened at this reference: fault or not, grow or shrink, pages dropped, and the gap since the last fault
      if (R.has(p)) R.set(p, 1);  // a resident page just gets its use bit set
      else {  // otherwise it is a fault
        fault = true; faults++; gap = t - lastFault;  // counts it and measures how many references have passed since the previous fault
        if (gap < F) action = 'grow';  // faults are coming fast (gap below F): the page is simply added and the set grows
        else {  // faults are far apart
          action = 'shrink';  // the set may shrink
          for (const [q, u] of [...R]) { if (u === 0) { R.delete(q); dropped.push(q); } else R.set(q, 0); }  // every page with use bit 0 is dropped; every survivor has its use bit reset to 0
        }  // ends the shrink case
        R.set(p, 1); lastFault = t;  // the faulting page joins with use bit 1, and this fault becomes the last one
      }  // ends the fault case
      return { t, page: p, fault, gap, action, dropped, size: R.size, set: [...R.keys()] };  // the record for this reference, including the set's size and contents afterwards
    });  // ends the map over the references
    return { faults, steps };  // hands back the fault count and the records
  }  // ends pff

  // vsws(refs, M, L, Q): variable-interval sampled working set. Use bits are reset at every sampling instant;
  // a sample drops pages whose use bit is still 0. A sample happens when L references have passed since the
  // last one, or after the Q-th fault since the last one (but never before M references have passed).
  function vsws(refs, M, L, Q) {  // vsws(): runs the sampled working-set policy for the VSWS tab of step 7
    const R = new Map(); let last = 0, faultsSince = 0, faults = 0, samples = 0;  // R maps each resident page to its use bit; last: time of the last sample; faultsSince: faults since then; plus totals of faults and samples
    const steps = refs.map((p, i) => {  // builds one record per reference, in order
      const t = i + 1;  // t is the virtual time, counting from 1
      let fault = false;  // fault records whether this reference faulted
      if (R.has(p)) R.set(p, 1);  // a resident page just gets its use bit set
      else { fault = true; faults++; faultsSince++; R.set(p, 1); }  // a missing page is a fault: counted in both totals, and added to the set with use bit 1
      const el = t - last;  // el: how many references have passed since the last sample
      let sample = null;  // sample will say why a sample happens now ('L' or 'Q'), or stay null
      if (el >= L) sample = 'L';  // L references have passed: a sample is due no matter what
      else if (faultsSince >= Q && el >= M) sample = 'Q';  // or Q faults have happened, as long as at least M references have passed (otherwise the sample waits)
      let dropped = [];  // dropped lists the pages a sample removes
      if (sample) {  // a sampling instant
        samples++;  // counts it
        for (const [q, u] of [...R]) { if (u === 0) { R.delete(q); dropped.push(q); } else R.set(q, 0); }  // drops every page whose use bit is still 0 and resets the survivors' use bits to 0
        last = t; faultsSince = 0;  // restarts both counts: time since the last sample and faults since the last sample
      }  // ends the sample case
      return { t, page: p, fault, sample, dropped, size: R.size, set: [...R.keys()], waiting: !sample && faultsSince >= Q };  // the record for this reference; waiting is true when Q faults have come but the sample must wait until M
    });  // ends the map over the references
    return { faults, samples, steps };  // hands back the totals and the records
  }  // ends vsws

  // loadModel(N): CPU utilization with N processes sharing MEM frames equally (exact mean value analysis of a
  // closed queueing model: one CPU, one paging disk, and each process's own I/O as a delay).
  const LM = { MEM: 96, W: 16, K: 4, LMAX: 100, S: 20, DCPU: 50, DIO: 200 };  // LM: the load model's settings: 96 frames, lifetime curve (W, K, LMAX), 20 ms per fault (S), 50 ms computing and 200 ms own I/O per cycle
  function lifetime(f) { return LM.LMAX / (1 + Math.pow(LM.W / f, LM.K)); }  // lifetime(f): mean computing time between faults with f frames: near LMAX when f is large, falling steeply once f drops below W
  function loadModel(N, paging = true) {  // loadModel(): one point of the chart in step 8; paging = false gives the "unlimited memory" curve
    const f = LM.MEM / N, L = lifetime(f), Dp = paging ? (LM.DCPU / L) * LM.S : 0;  // f: frames per process; L: time between its faults; Dp: paging-disk time each cycle needs (faults per cycle times S)
    let Qc = 0, Qp = 0, X = 0;  // Qc and Qp: average queue at the processor and at the paging disk; X: throughput (cycles finished per ms)
    for (let n = 1; n <= N; n++) {  // mean value analysis adds the processes one at a time, from 1 up to N
      const Rc = LM.DCPU * (1 + Qc), Rp = Dp * (1 + Qp);  // time a cycle spends at the processor and at the disk, including the wait behind the queue already there
      X = n / (Rc + Rp + LM.DIO); Qc = X * Rc; Qp = X * Rp;  // throughput for n processes, then the new queue lengths from it (a standard queueing law)
    }  // ends the loop
    return { N, f, L, U: X * LM.DCPU, disk: X * Dp };  // hands back the frames, lifetime, processor utilization (U) and paging-disk busy fraction for N processes
  }  // ends loadModel

  // localityTrace(seed): a long reference string with locality (phases that each favour a small set of pages).
  function localityTrace(seed) {  // localityTrace(): builds the long test string for the frames-per-process chart in step 6
    let s = seed >>> 0;  // s is the generator's state, forced to a whole 32-bit number (>>> 0) so the same seed always gives the same string
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };  // rnd(): a simple repeatable random-number generator (a linear congruential one) giving a fraction from 0 up to 1
    const out = [];  // out collects the references
    for (let ph = 0; ph < 8; ph++) {  // eight phases, each with its own locality
      const base = Math.floor(rnd() * 24), set = Array.from({ length: 6 }, (_, k) => (base + k * 3) % 30);  // each phase favours 6 pages spaced 3 apart, starting from a random base page (out of 30 pages in all)
      for (let i = 0; i < 100; i++) out.push(rnd() < 0.92 ? set[Math.floor(rnd() * 6)] : Math.floor(rnd() * 30));  // 100 references per phase: 92% from the favoured pages, the rest any page at all
    }  // ends the phase loop
    return out;  // hands back the 800 references
  }  // ends localityTrace
/* models:end */

  /* A clickable SVG group that also works from the keyboard (Enter or Space). */
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(): wraps SVG shapes so a click, Enter or Space all run onAct; used for the clickable u and m bits and the time boxes
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // builds the group: class hot gives a pointer cursor, tabindex 0 makes it reachable with Tab, role and label describe it to screen readers
    g.addEventListener('click', onAct);  // a mouse click runs the action
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // Enter or Space also runs it; preventDefault stops Space from scrolling the page
    return g;  // hands back the group
  }  // ends hotGroup
  const POL = { opt: 'OPT', lru: 'LRU', fifo: 'FIFO', clock: 'Clock' };  // POL: the display name of each policy, keyed by the short names simulate() uses
  const listOf = (arr) => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);  // listOf(): joins words as plain English, like "2, 3 and 5", for the captions

  /* parseRefs(text): a reference string typed by the student. Numbers may be separated by spaces or commas;
     a run of digits with no separators at all ("1231") is read one digit per page. At most 20 references.
     skipped is true when something other than page numbers 0-99 (letters, 100, -) was ignored. */
  function parseRefs(text) {  // parseRefs(): reads the reference string typed into the replacement lab
    const t = String(text || '').trim();  // t: the text as a string with spaces trimmed off both ends (empty when nothing was given)
    let nums = /^\d+$/.test(t) && t.length > 1 ? t.split('') : t.match(/\d+/g) || [];  // digits only and more than one: one page per digit; otherwise every run of digits is a page (none found gives an empty list)
    const all = nums.length;  // all: how many numbers were found before any were thrown out
    nums = nums.map(Number).filter((v) => v <= 99);  // turns them into numbers and keeps only 0 to 99
    const skipped = nums.length < all || /[^\d\s,]/.test(t);  // skipped: true if a number was dropped or the text holds characters other than digits, spaces and commas
    return { refs: nums.slice(0, 20), cut: nums.length > 20, skipped };  // hands back at most the first 20 references, with flags saying whether some were cut or skipped
  }  // ends parseRefs

  /* gridSvg(ctx, refs, n, sim, policy, upto): one replacement grid. Time runs left to right (one column per
     reference), one row per frame. A red cell is a page just loaded by a fault (so each red cell is one fault),
     a green cell a hit. Columns after `upto` (0-based) are not simulated yet and stay empty. On a phone the
     columns wrap into bands of 10 references so the digits stay readable. */
  function gridSvg(ctx, refs, n, sim, policy, upto) {  // gridSvg(): draws one policy's grid for the replacement lab, redrawn for every animation frame
    const { s } = ctx;  // s builds SVG elements (SVG is the browser's drawing format)
    const len = refs.length, LX = 46;  // len: the number of references; LX: width of the label column on the left (page, F0, F1...)
    const per = ctx.narrow ? 10 : Math.max(len, 1), bands = Math.ceil(Math.max(len, 1) / per);  // per: columns per band (10 on a phone, all of them on a wide screen); bands: how many bands that needs
    const CW = ctx.narrow ? 30 : Math.min(36, (560 - LX - 4) / per);  // CW: column width: 30 on a phone, otherwise the 560-unit width shared out (at most 36 each)
    const W = ctx.narrow ? LX + per * CW + 4 : 560;  // W: the drawing's width, just wide enough for one band on a phone, else 560
    const RH = Math.min(30, Math.floor(128 / (n + 1)));  // RH: row height, shrinking as frames are added so the grid keeps about the same height (at most 30)
    const BH = (n + 1) * RH + 2, GAP = 10, H = bands * BH + (bands - 1) * GAP;  // BH: height of one band (the page row plus one row per frame); GAP: space between bands; H: total height
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });  // the drawing, stretched to the width of its box; viewBox sets its own coordinate system
    const fs = Math.min(15, RH - 6);  // fs: font size of the digits, a little smaller than a row
    const kids = [];  // kids collects every shape, added to the drawing in one go at the end
    const top = (t) => Math.floor(t / per) * (BH + GAP), colX = (t) => LX + (t % per) * CW;   // band offset and column of time t
    if (upto >= 0) kids.push(s('rect', { x: colX(upto), y: top(upto), width: CW, height: BH, rx: 4, class: 's-accent', style: 'opacity:.55', 'stroke-width': 1.5 }));  // highlights the column of the current time (upto) with a see-through accent box
    for (let b = 0; b < bands; b++) {  // each band gets its own row labels
      const y0 = b * (BH + GAP);  // y0: the top of band b
      kids.push(s('text', { x: LX - 6, y: y0 + RH * 0.7, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, 'page'));  // label "page" for the top row, which shows the page referenced
      for (let k = 0; k < n; k++) kids.push(s('text', { x: LX - 6, y: y0 + RH * (k + 1) + RH * 0.68, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'F' + k));  // labels F0, F1, ... for the frame rows
    }  // ends the band loop
    refs.forEach((p, t) => {  // one column per reference: p is the page, t its time
      const x = colX(t), y0 = top(t), done = t <= upto;  // x and y0 place the column; done is true for references already simulated
      kids.push(s('text', { x: x + CW / 2, y: y0 + RH * 0.7, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 800, class: done ? '' : 's-sub' }, String(p)));  // the page referenced, in bold at the top of the column, grey until it is reached
      if (!done) return;  // a reference not reached yet shows only its page number, with empty frame cells below
      const st = sim.steps[t];  // st: the simulator's snapshot of the frames right after this reference
      for (let k = 0; k < n; k++) {  // one cell per frame
        const q = st.frames[k], y = y0 + RH * (k + 1);  // q: the page in frame k at this time; y: the top of that frame's row
        if (q === null) continue;  // an empty frame leaves its cell blank
        const here = st.slot === k, cls = here ? (st.hit ? 's-ok' : 's-bad') : 's-panel';  // here: this frame is the one touched at this time; it is green for a hit, red for a fault, plain otherwise
        kids.push(s('rect', { x: x + 1.5, y: y + 1.5, width: CW - 3, height: RH - 3, rx: 4, class: cls, 'stroke-width': here ? 1.8 : 1 }),  // the cell box, with a thicker border on the frame just touched
          s('text', { x: x + CW / 2, y: y + RH * 0.68, 'text-anchor': 'middle', 'font-size': fs - 1, 'font-weight': here ? 800 : 500 }, String(q)));  // the page number inside the cell, bold on the frame just touched
        if (policy === 'clock') {  // the clock grid also shows the use bits and the pointer
          kids.push(s('circle', { cx: x + CW - 6, cy: y + 6.5, r: 2.8, 'stroke-width': 1.2, style: 'stroke:var(--ink-2);fill:' + (st.use[k] ? 'var(--ink-2)' : 'var(--panel)') }));  // a small dot in the cell's corner: filled when the use bit is 1, hollow when it is 0
          if (t === upto && st.ptr === k) kids.push(s('path', { d: `M${x - 1},${y + RH / 2 - 5} l7,5 l-7,5 z`, style: 'fill:var(--accent);stroke:none' }));  // in the current column only, a small triangle marks the frame the clock pointer now rests on
        }  // ends the clock extras
      }  // ends the loop over the frames
    });  // ends the loop over the references
    svg.append(...kids);  // adds every shape to the drawing at once
    return svg;  // hands the finished grid to the lab card
  }  // ends gridSvg

  /* say(policy, st): one short phrase saying what a policy did at one time step (for the lab's caption). */
  function say(policy, st) {  // say(): builds the short reason shown beside each policy's name in the lab, at every time step
    if (st.hit) return '<span class="c-ok b">hit</span>';  // a hit: just the word hit in green
    if (st.victim === null) return `<span class="c-bad b">fault</span>, fills empty F${st.slot}`;  // a fault into an empty frame needs no victim, so it names the frame filled
    let why = '';  // why will hold the reason for the eviction
    if (policy === 'opt') why = st.info < 0 ? 'never used again' : `next used at t = ${st.info + 1}`;  // OPT: when the evicted page is next needed, or that it is never used again (times shown counting from 1)
    else if (policy === 'lru') why = `last used at t = ${st.info + 1}`;  // LRU: when the evicted page was last used
    else if (policy === 'fifo') why = `loaded at t = ${st.info + 1}`;  // FIFO: when the evicted page was loaded
    else {  // clock: names the pages whose use bits were cleared on the way
      const passed = st.passed.map((i) => (i === st.slot ? st.victim : st.frames[i]));  // the pages passed; if the pointer went all the way round, the victim's own frame is named by its old page, since the snapshot already shows the new one
      why = passed.length ? `after clearing the use bit of ${listOf(passed.map(String))}` : 'its use bit was 0';  // either lists the pages whose bits were cleared, or says the first frame examined already had use bit 0
    }  // ends the clock case
    return `<span class="c-bad b">fault</span>, evicts ${st.victim} (${why})`;  // the phrase: fault, the page evicted, and the reason in brackets
  }  // ends say

  /* tabClockM(panel, ctx): the clock policy with a modified bit, as a step-through on a ring of 8 frames.
     The student can click any u or m bit to change it; the scan is recomputed from the new bits. */
  function tabClockM(panel, ctx) {  // tabClockM(): the first tab of step 5; draws into the tab's panel and gives back a function that stops playback
    const { h, s } = ctx;  // h builds HTML elements and s builds SVG ones
    const PAGES = [12, 7, 30, 4, 19, 25, 8, 16];  // PAGES: the page held by each of the 8 frames on the ring
    const PRESETS = {  // PRESETS: four starting patterns of bits, chosen with the switch above the player
      clean: { label: 'A clean idle page exists', bits: ['10', '01', '11', '00', '10', '01', '00', '11'] },  // preset: one frame has u = 0, m = 0, so step 1 finds a clean idle page
      dirty: { label: 'Only modified idle pages', bits: ['10', '01', '11', '10', '01', '11', '10', '10'] },  // preset: no clean idle page, so the scan needs step 2
      used: { label: 'Every page recently used', bits: ['10', '11', '11', '10', '11', '10', '11', '11'] },  // preset: every use bit is 1, so the scans must clear them and go round again
      worst: { label: 'All used and modified', bits: ['11', '11', '11', '11', '11', '11', '11', '11'] },  // preset: every bit is 1, the worst case, which runs all four scans
    };  // closes the PRESETS table
    const K = ctx.keep.clockM || (ctx.keep.clockM = { frames: null, start: 0, preset: 'clean', frame: 0 });  // K: this tab's state (the bits, the start frame, the preset chosen, the player's frame), kept in the step's ctx.keep so a phone-width or desktop redraw hands it back
    let frames, scan, start = K.start;  // frames: the current bits of each frame; scan: the result of enhancedClock; start: the frame the pointer starts at (0 on a fresh visit)
    const setBits = (b) => { frames = PAGES.map((page, i) => ({ page, u: +b[i][0], m: +b[i][1] })); };  // setBits(b): turns a list of two-digit strings ("10" = u 1, m 0) into the frames' bits
    if (K.frames) frames = K.frames; else setBits(PRESETS.clean.bits);  // reuses the kept bits after a redraw, or starts with the "clean idle page" preset
    const N = 8, CX = 210, CY = 190, R = 140;  // ring geometry: 8 frames on a circle centred at (210, 190) with radius 140
    const pos = (i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / N; return [CX + R * Math.cos(a), CY + R * Math.sin(a)]; };  // pos(i): where frame i sits on the ring, starting at the top and going clockwise
    const svg = s('svg', { viewBox: '0 0 420 380', width: '100%' });  // the ring drawing
    const steps = h('ol', { class: 'm0 small', style: { lineHeight: '1.45', paddingLeft: '20px' } });  // steps: the numbered list of the three rules, whose current rule is highlighted
    const STEP_TXT = [  // STEP_TXT: the text of the three rules
      'Scan from the pointer for <b>u = 0, m = 0</b> (not used lately, not modified). Change no bits. Take the first one found.',  // rule 1: look for a frame that is idle and clean, changing nothing
      'If none, scan again for <b>u = 0, m = 1</b> (not used lately, modified), <b>clearing the use bit</b> of every frame passed. Take the first one found.',  // rule 2: look for an idle but modified frame, clearing use bits along the way
      'If still none, the pointer is back at its start and every use bit is now 0. Repeat step 1 and, if needed, step 2: this time a frame is found.',  // rule 3: repeat rules 1 and 2, which must now succeed
    ];  // closes STEP_TXT
    const LABEL = ['', 'Step 1', 'Step 2', 'Step 3 (step 1 again)', 'Step 3 (step 2 again)'];  // LABEL: the name of each scan for the caption (index 0 is unused, since scans count from 1)
    function paintSteps(pass) {  // paintSteps(pass): redraws the list of rules with the one in use highlighted
      const cur = pass === 0 ? -1 : Math.min(pass, 3) - 1;  // cur: which rule to highlight: none before the scan starts, and rule 3 for the third and fourth scans
      steps.replaceChildren(...STEP_TXT.map((t, k) => h('li', { html: t, style: k === cur ? { background: 'var(--accent-bg)', borderRadius: '6px', padding: '2px 6px' } : { padding: '2px 6px' } })));  // one list item per rule, the current one on a tinted background
    }  // ends paintSteps
    function draw(i) {  // draw(i): the player's render function: draws frame i of the scan and gives back its caption
      const ev = i > 0 ? scan.events[i - 1] : null, bits = ev ? ev.bits : frames, ptr = ev ? ev.i : start;  // ev: the event shown (none for frame 0); bits: the bits at that moment; ptr: the frame the pointer is on
      const kids = [s('circle', { cx: CX, cy: CY, r: R, fill: 'none', class: 's-muted', 'stroke-dasharray': '4 5' })];  // starts with the dashed circle of the ring
      for (let k = 0; k < N; k++) {  // draws each of the 8 frames
        const [x, y] = pos(k), b = bits[k], isPick = ev && ev.pick && ev.i === k, isCur = ptr === k;  // x, y: the frame's position; b: its bits; isPick: it is the chosen victim; isCur: the pointer is on it
        const cls = isPick ? (b.m ? 's-warn' : 's-ok') : isCur ? 's-accent' : 's-panel';  // colour: green for a clean victim, amber for a modified one, accent where the pointer is, plain otherwise
        const bit = (key, bx) => hotGroup(ctx, () => { frames[k][key] ^= 1; recompute(); }, `Frame ${k}: toggle ${key} bit`,  // bit(): a clickable u or m box; clicking flips that bit (^= 1 swaps 0 and 1) in the starting state and recomputes the scan
          s('rect', { x: bx, y: y + 4, width: 34, height: 20, rx: 5, style: 'fill:var(--panel);stroke:var(--line-2)' }),  // the box behind the bit
          s('text', { x: bx + 17, y: y + 19, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: b[key] ? (key === 'm' ? 'tx-warn' : 'tx-acc') : 's-sub' }, `${key}=${b[key]}`));  // the bit as text, such as u=1, coloured when it is 1
        kids.push(s('rect', { x: x - 46, y: y - 30, width: 92, height: 58, rx: 9, class: cls, 'stroke-width': isCur || isPick ? 2.5 : 1.2 }),  // the frame's box, with a thicker border where the pointer is or on the victim
          s('text', { x: x - 40, y: y - 13, 'font-size': 12.5, class: 's-sub' }, 'F' + k),  // the frame number in the top-left corner
          s('text', { x: x + 40, y: y - 12, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700 }, 'page ' + frames[k].page),  // the page it holds, in the top-right corner
          bit('u', x - 40), bit('m', x + 6));  // the two clickable bits, u on the left and m on the right
        if (k === start) kids.push(s('text', { x, y: y + (y < CY ? -36 : 44), 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-acc' }, 'start'));  // the word start, above or below the frame where the pointer begins (outside the ring)
      }  // ends the loop over the frames
      const [px, py] = pos(ptr), d = Math.hypot(px - CX, py - CY), sc = (d - 46) / d;  // px, py: where the pointer's frame sits; d: its distance from the centre; sc: shortens the arrow so it stops at the frame's box
      kids.push(s('line', { x1: CX, y1: CY, x2: CX + (px - CX) * sc, y2: CY + (py - CY) * sc, class: 's-line', style: 'stroke:var(--accent);stroke-width:3', 'marker-end': 'url(#arr-accent)' }),  // the pointer: a thick arrow from the centre toward that frame, with the shared accent arrowhead
        s('circle', { cx: CX, cy: CY, r: 6, style: 'fill:var(--accent)' }));  // a dot at the centre, where the pointer pivots
      svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes
      paintSteps(ev ? ev.pass : 0);  // highlights the rule the current scan belongs to
      if (!ev) return `<b>The pointer starts at frame ${start}.</b> Press Play or step forward to watch the scan. Click any <b>u</b> or <b>m</b> bit to change it first.`;  // frame 0's caption: where the pointer starts, and a hint to change bits before playing
      const head = `<b>${LABEL[ev.pass]}</b> (looking for u = 0, m = ${ev.look === '00' ? 0 : 1}${ev.look === '01' ? ', clearing use bits' : ', bits untouched'}): frame ${ev.i} (page ${frames[ev.i].page}) has u = ${ev.u}, m = ${ev.m}: `;  // head: the start of the caption: which scan, what it looks for, and the frame examined with its bits
      if (!ev.pick) return head + (ev.cleared ? 'not a match, so its use bit is <b>cleared to 0</b> and the pointer moves on.' : 'not a match, move on.');  // not a match: says whether its use bit was cleared, then that the pointer moves on
      const sim = scan.simple, simDirty = frames[sim].m;  // sim: the frame the simple one-bit clock would take; simDirty: whether that page is modified
      return head + `<b>victim</b>. ${ev.m ? 'It was modified, so it must be written to disk before its frame is reused.' : 'It is clean, so its frame can be reused at once.'} ` +  // a match: names the victim and says whether it needs a disk write first
        (sim === ev.i ? 'The simple clock (use bit only) would pick the same frame.' : `The simple clock (use bit only) would have taken frame ${sim} (page ${frames[sim].page})${simDirty ? ', a modified page that needs a write first' : ''}.`);  // then compares with the simple clock, warning when that one would pick a modified page
    }  // ends draw
    const back = K.frame;  // back: the player's frame before a phone-width or desktop redraw (0 on a fresh visit); read now because building the player and recompute both rewind it
    const player = ctx.ui.player({ count: 1, render: draw, interval: 1200, onStep: (i) => { K.frame = i; } });  // the player (Play, Step and a caption); it starts with one frame and is resized once the scan is computed; every frame change is recorded in K
    function recompute() { K.frames = frames; K.start = start; scan = enhancedClock(frames, start); player.setCount(scan.events.length + 1); }  // recompute(): records the bits and start frame in K, reruns the scan from them and resizes the player to one frame per event plus the start
    const seg = ctx.ui.seg(Object.entries(PRESETS).map(([k, p]) => ({ value: k, label: p.label })), K.preset, (v) => { K.preset = v; setBits(PRESETS[v].bits); recompute(); });  // the preset switch (showing the kept choice): choosing one records it in K, loads its bits and recomputes
    const rand = h('button', { class: 'btn sm', onclick: () => { frames.forEach((f) => { f.u = Math.random() < 0.5 ? 1 : 0; f.m = Math.random() < 0.5 ? 1 : 0; }); start = Math.floor(Math.random() * N); recompute(); } }, 'Random bits');  // Random bits: gives every u and m bit a coin-flip value and picks a random start frame, then recomputes
    recompute(); player.go(back);  // computes the first scan, then returns the player to the kept frame
    panel.append(h('div', { class: 'split l', style: { height: '100%' } },  // lays out the tab: drawing on the left, rules and controls on the right
      h('div', { class: 'stack gap-s' }, h('div', { class: 'card white', style: { padding: '4px 6px' } }, svg),  // left column: the ring drawing on a white card
        h('p', { class: 'xs muted m0', html: 'Each frame shows its use bit <b>u</b> (set when the page is referenced) and its <span class="t">modified bit</span> <b>m</b> (set when it is written).' })),  // note under the drawing: what u and m mean
      h('div', { class: 'stack', style: { gap: '8px' } },  // right column
        h('p', { class: 'm0 small', html: 'A modified page needs a disk write before its frame is reused, so this clock also checks the <b>m</b> bit. Best victim: <b>(u=0, m=0)</b>, then <b>(0, 1)</b>, then <b>(1, 0)</b>, then <b>(1, 1)</b>.' }),  // intro: why this clock also checks m, and the order of preference among the four bit pairs
        h('div', { class: 'card tight' }, steps),  // the list of rules on a card
        h('div', { class: 'row', style: { gap: '6px' } }, seg, rand),  // the preset switch and the Random bits button side by side
        player.el)));  // the player's controls and caption at the bottom of the right column; closes the layout
    return () => player.stop();   // leaving the tab stops any playback
  }  // ends tabClockM

  /* tabBuffer(panel, ctx): page buffering. A FIFO resident set of 4 pages, 7 frames in all, and a free list and
     a modified list that keep evicted pages in their frames. Plain FIFO runs on the same references for comparison. */
  function tabBuffer(panel, ctx) {  // tabBuffer(): the second tab of step 5; draws into the tab's panel and gives back a function that cancels the demo
    const { h } = ctx;  // h builds HTML elements
    const DEMO = [[1, 1], [2, 0], [3, 1], [4, 0], [5, 1], [6, 0], [7, 1], [1, 1], [4, 1], [2, 0], [5, 1], [3, 1], [8, 0], [1, 0]];  // DEMO: the demo's references as [page, 1 = write or 0 = read], chosen so some evicted pages get reclaimed from the lists
    const K = ctx.keep.buf || (ctx.keep.buf = { B: null, hist: [], write: false, msg: '' });  // K: this tab's state (the model, the history, the Read/Write choice, the caption), kept in the step's ctx.keep so a phone-width or desktop redraw hands it back
    let B = K.B || makeBuffer(4, 7, 3), write = K.write, hist = K.hist, gen = 0;  // B: the buffering model (the kept one after a redraw); write: whether a click writes; hist: the references so far; gen: a counter that cancels old demo timers
    const view = h('div', { class: 'stack', style: { gap: '8px' } });  // view: the three lanes (resident set, free list, modified list)
    const tiles = h('div', { class: 'grid-3', style: { gap: '8px' } });  // tiles: the three counters below the lanes
    const cmp = h('div', { class: 'small' });  // cmp: the sentence comparing with plain FIFO
    const narr = h('div', { class: 'card tight small', style: { minHeight: '84px', lineHeight: '1.45' } });  // narr: the caption explaining the latest reference; its minimum height stops the layout from jumping
    const box = (f, role) => {  // box(f, role): one frame's tile, coloured by the list it is on
      const p = B.frame[f], d = B.dirty[f];  // p: the page in frame f; d: whether that page is modified
      const cls = { res: 'proc', free: 'ok', mod: 'warn', none: '' }[role];  // colour by list: teal for resident, green for free, amber for modified
      return h('div', { class: 'box ' + cls, style: { padding: '2px 6px', minWidth: '62px', fontSize: '14px', lineHeight: '1.25' }, html: `${p == null ? '<span class="muted">empty</span>' : '<b>page ' + p + '</b>'}<br><span class="xs muted">F${f}</span>${d ? ' <span class="xs c-warn b">M</span>' : ''}` });  // the tile: the page (or the word empty), the frame number below it, and an amber M when modified
    };  // ends box
    const lane = (title, frames, role, empty) => h('div', { style: { display: 'grid', gridTemplateColumns: '118px minmax(0, 1fr)', gap: '6px', alignItems: 'center', minHeight: '42px' } },  // lane(): one labelled row, the list's name on the left and its frames as tiles on the right
      h('span', { class: 'small b', html: title }),  // the lane's title
      h('div', { class: 'row', style: { gap: '5px' } }, ...(frames.length ? frames.map((f) => box(f, role)) : [h('span', { class: 'small muted' }, empty)])));  // the frames on this list as tiles, or a grey word when the list is empty
    function paint() {  // paint(): redraws the lanes, the counters and the comparison from the model
      K.B = B; K.hist = hist; K.msg = narr.innerHTML;  // records the model, the history and the caption in K, so a phone-width or desktop redraw shows the same point of the demo
      view.replaceChildren(  // replaces the three lanes
        lane('Resident set<br><span class="xs muted">oldest first</span>', B.resident, 'res', 'none yet'),  // lane for the resident set, oldest page first
        lane('Free page list<br><span class="xs muted">head → tail</span>', B.free, 'free', 'empty'),  // lane for the free page list, from head to tail
        lane('Modified page list<br><span class="xs muted">head → tail</span>', B.modified, 'mod', 'empty'));  // lane for the modified page list, from head to tail
      const tile = (lab, v, sub, c) => h('div', { class: 'card tight', style: { padding: '5px 10px' } }, h('div', { class: 'xs muted b' }, lab), h('div', { class: 'b ' + (c || ''), style: { fontSize: '22px' } }, String(v)), h('div', { class: 'xs muted' }, sub));  // tile(): one counter card with a small label, a big number and a note
      tiles.replaceChildren(tile('Disk reads', B.reads, 'pages read in'), tile('Disk writes', B.writes, B.batches + ' batch' + (B.batches === 1 ? '' : 'es')), tile('Reclaimed', B.rescues, 'faults with no disk read', 'c-ok'));  // counters: disk reads, disk writes (with the number of batches), and faults reclaimed with no read
      cmp.innerHTML = `<b>Plain FIFO</b> on the same ${B.refs} reference${B.refs === 1 ? '' : 's'} (4-page resident set, evicted pages dropped at once): <b>${B.plain.reads}</b> disk reads and <b>${B.plain.writes}</b> single writes.`;  // comparison: what plain FIFO with the same 4-page resident set costs on the same references
    }  // ends paint
    function ref(p, w, fromDemo) {  // ref(p, w, fromDemo): references page p (a write when w is true), then updates the caption and redraws
      if (!fromDemo) gen++;  // a click by the student cancels any demo still running (raising gen makes its waiting timers do nothing)
      const msg = B.ref(p, w);  // runs the reference through the model and gets the explanation
      hist.push((w ? 'W' : 'R') + p);  // adds it to the history, written like W3 or R5
      narr.innerHTML = `<div class="xs muted mono" style="margin-bottom:3px">${hist.slice(-16).join(' ')}</div><b>${w ? 'Write' : 'Read'} page ${p}.</b> ${msg}`;  // caption: the last 16 references in small type, then what this reference did
      paint();  // redraws everything
    }  // ends ref
    function reset() {  // reset(): starts over with empty memory
      gen++; B = makeBuffer(4, 7, 3); hist = [];  // cancels any running demo, builds a fresh model and clears the history
      narr.innerHTML = '<b>Memory starts empty</b>: all 7 frames are on the free list. Click pages to reference them (choose Read or Write first), or run the demo. Watch for a fault that is <b>reclaimed</b> from a list with no disk read.';  // starting caption: every frame is free, and how to use the tab
      paint();  // redraws
    }  // ends reset
    function demo() {  // demo(): plays the DEMO references one after another
      reset();  // starts from empty memory
      const g = gen;  // g remembers this demo's generation number
      DEMO.forEach(([p, w], i) => ctx.after(700 * (i + 1), () => { if (g !== gen) return; ref(p, w, true); }));  // schedules each reference 0.7 s after the previous one; a timer does nothing if gen has changed (reset, a click, or leaving the tab)
    }  // ends demo
    const seg = ctx.ui.seg([{ value: 0, label: 'Read' }, { value: 1, label: 'Write' }], write ? 1 : 0, (v) => { write = K.write = !!v; });  // Read/Write switch (showing the kept choice): decides whether the page buttons read or write their page, and records the choice in K
    const pages = h('div', { class: 'row', style: { gap: '5px' } }, ...[1, 2, 3, 4, 5, 6, 7, 8].map((p) => h('button', { class: 'btn sm', style: { minWidth: '36px' }, onclick: () => ref(p, write) }, String(p))));  // buttons for pages 1 to 8; each references its page in the chosen mode
    if (K.B) { narr.innerHTML = K.msg; paint(); } else reset();  // after a redraw, shows the kept caption and model; on a fresh visit, starts in the empty state
    panel.append(h('div', { class: 'split l', style: { height: '100%' } },  // lays out the tab: explanation and controls on the left, the lists and counters on the right
      h('div', { class: 'stack', style: { gap: '9px' } },  // left column
        h('p', { class: 'm0 small', html: 'With <span class="t">page buffering</span> an evicted page is not thrown away at once. Its page table entry is removed, but the page stays in its frame, which joins the tail of the <b>free page list</b> (if clean) or the <b>modified page list</b> (if changed). A page that must be read in takes the frame at the <b>head</b> of the free list.' }),  // paragraph: what page buffering does with an evicted page, and which frame a newly read page takes
        h('p', { class: 'm0 small', html: 'If an evicted page is referenced again before its frame is reused, the OS simply moves it back: a fault with <b>no disk I/O</b>. Modified pages are written out <b>in batches</b> (here 3 at a time), not one by one. That turns even plain FIFO into a decent policy.' }),  // paragraph: why a reclaimed page needs no disk I/O, and why modified pages are written in batches
        h('div', { class: 'row', style: { gap: '8px' } }, seg, pages),  // the Read/Write switch next to the page buttons
        h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn sm primary', onclick: demo }, 'Run the demo'), h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // the Run the demo and Reset buttons
        cmp),  // then the plain FIFO comparison; ends the left column
      h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white', style: { padding: '8px 10px' } }, view), tiles, narr)));  // right column: the lanes on a white card, the counters, and the caption
    return () => { gen++; };   // leaving the tab cancels a running demo
  }  // ends tabBuffer

  /* cleaningModel(d, r): per 100 replacements, d of the victims are modified; under precleaning, r% of the
     pages already written are modified again before they are replaced. T ms per disk transfer. */
  const T_IO = 8;  // T_IO: milliseconds per disk transfer in the cleaning model
  function cleaningModel(d, r) {  // cleaningModel(): the numbers for the table in the cleaning tab
    return {  // gives back one set of numbers per policy
      demand: { writes: d, wasted: 0, wait: T_IO * (1 + d / 100) },  // demand cleaning: d writes, none wasted; every fault reads, and d% of them must also write the victim first
      pre: { writes: d * (1 + r / 100), wasted: (d * r) / 100, wait: T_IO * (1 + (d / 100) * (r / 100)) },  // precleaning: re-modified pages are written twice, the extra writes are wasted, and only those victims make a fault wait for a write
      buf: { writes: d, wasted: 0, wait: T_IO },  // page buffering: d writes at most, none wasted, and a fault only waits for its read
    };  // closes the returned object
  }  // ends cleaningModel

  /* tabCleaning(panel, ctx): demand cleaning vs precleaning vs page buffering, with two sliders. */
  function tabCleaning(panel, ctx) {  // tabCleaning(): the third tab of step 5, comparing three cleaning policies with two sliders
    const { h, s } = ctx;  // h builds HTML elements and s builds SVG ones
    const K = ctx.keep.clean || (ctx.keep.clean = { d: 50, r: 30, pol: 'demand' });  // K: this tab's settings, kept in the step's ctx.keep so a phone-width or desktop redraw hands them back
    let d = K.d, r = K.r, pol = K.pol;  // d: percent of victims that are modified; r: percent of precleaned pages modified again; pol: the policy highlighted (50, 30 and demand cleaning on a fresh visit)
    const NAME = { demand: 'Demand cleaning', pre: 'Precleaning', buf: 'Page buffering' };  // NAME: the display name of each policy
    const SAYS = {  // SAYS: the explanation of each policy, shown under the controls
      demand: 'A modified page is written only when it is chosen for replacement. No write is ever wasted, but a fault whose victim is modified waits for <b>two</b> transfers: the old page out, then the new page in.',  // demand cleaning: no wasted writes, but a modified victim means waiting for two transfers
      pre: 'Modified pages are written ahead of time, in batches, so most victims are already clean and a fault waits for one transfer. The catch: a page written early may be modified again before it is replaced, and that write was wasted.',  // precleaning: a fault usually waits for one transfer, but some early writes are wasted
      buf: 'Clean only pages that replacement has already chosen (they wait on the modified list), and write them in batches. Cleaning is separate from replacement, so a fault takes a free frame at once and never waits for a write.',  // page buffering: cleaning runs apart from replacement, so a fault never waits for a write
    };  // closes SAYS
    // VW: drawing width (slimmer on a phone so its labels stay readable); X0: where the bars start; SEG: one 8 ms transfer
    const VW = ctx.narrow ? 400 : 600, X0 = ctx.narrow ? 134 : 150, SEG = ctx.narrow ? 131 : T_IO * 12 * 2;  // the sizes: VW 400 on a phone or 600; bars start at 134 or 150; one transfer is 131 or 192 units wide
    const svg = s('svg', { viewBox: `0 0 ${VW} 150`, width: '100%' });  // the timeline drawing
    const table = h('table', { class: 'tbl compact' });  // table: the numbers for the three policies
    const say = h('div', { class: 'card tight small', style: { lineHeight: '1.45', minHeight: '86px' } });  // say: the card explaining the chosen policy
    function bar(x, y, w, cls, label, dash) {  // bar(): one labelled bar of the timeline, dashed when it happens only some of the time
      return [s('rect', { x, y, width: w, height: 24, rx: 5, class: cls, 'stroke-width': 1.5, 'stroke-dasharray': dash || '' }), s('text', { x: x + w / 2, y: y + 16.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, label)];  // the rectangle and its centred label
    }  // ends bar
    function draw() {  // draw(): recomputes the model and redraws the timeline, the table and the explanation after every change
      const M = cleaningModel(d, r);  // M: the numbers for the current slider values
      K.d = d; K.r = r; K.pol = pol;  // records the settings in K, so a phone-width or desktop redraw keeps them
      const rows = [  // rows: for each policy, which transfers a fault waits for, in order (slot 0 first, then slot 1)
        ['demand', [[0, 'write old page', 's-io'], [1, 'read new page', 's-mem']]],  // demand cleaning: write the old page, then read the new one
        ['pre', [[0, ctx.narrow ? `write old (${r}%)` : `write old (${r}% of the time)`, 's-io', '5 4'], [1, 'read new page', 's-mem']]],  // precleaning: the write happens only when the page was modified again (dashed bar); a shorter label on a phone
        ['buf', [[0, 'read new page', 's-mem']]],  // page buffering: only the read
      ];  // closes rows
      const kids = [s('text', { x: 0, y: 13, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, ctx.narrow ? 'Fault with a modified victim: the wait' : 'A fault whose victim is modified: what the process waits for'),  // the drawing's title, shorter on a phone
        s('text', { x: X0, y: 147, 'font-size': 12.5, class: 's-sub' }, '0'), s('text', { x: X0 + 2 * SEG - (ctx.narrow ? 4 : 0), y: 147, 'text-anchor': ctx.narrow ? 'end' : 'middle', 'font-size': 12.5, class: 's-sub' }, (2 * T_IO) + ' ms')];  // time axis labels: 0 at the left, and 16 ms (two transfers) at the right end
      rows.forEach(([k, segs], i) => {  // draws one row of bars per policy; i is the row number
        const y = 24 + i * 38, on = k === pol;  // y: the top of this row; on: this is the policy chosen with the switch
        kids.push(s('text', { x: X0 - 8, y: y + 17, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': on ? 800 : 500, class: on ? 'tx-acc' : '' }, NAME[k]));  // the policy's name to the left of its bars, bold and in the accent colour when chosen
        segs.forEach(([slot, label, cls, dash]) => kids.push(...bar(X0 + slot * SEG, y, SEG - 4, cls, label, dash)));  // draws each transfer as a bar in its slot (slot 1 starts one transfer later), leaving a small gap between bars
        if (k === 'buf') kids.push(s('text', { x: X0 + SEG + 6, y: y + 17, 'font-size': 12.5, class: 's-sub' }, ctx.narrow ? 'old page: later' : 'old page: written later, in a batch'));  // page buffering's row adds a note that the old page goes out later in a batch (shorter on a phone)
        if (on) kids.push(s('rect', { x: 0, y: y - 4, width: VW - 2, height: 32, rx: 7, fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 1.5 }));  // a rounded accent outline around the chosen policy's row
      });  // ends the loop over the rows
      svg.replaceChildren(...kids);  // replaces the old timeline with the new shapes
      const f = (v) => ctx.util.fmt(v, 1);  // f(v): writes a number with at most one decimal place, using the shared formatter
      table.replaceChildren(h('thead', {}, h('tr', {}, ...['Per 100 replacements', 'Disk writes', 'Wasted', 'Average wait per fault'].map((t) => h('th', {}, t)))),  // rebuilds the table: the header row with its four column titles
        h('tbody', {}, ...['demand', 'pre', 'buf'].map((k) => h('tr', { class: k === pol ? 'on' : '' },  // one body row per policy, the chosen one highlighted with class on
          h('td', { class: 'b' }, NAME[k]), h('td', { class: 'num' }, (k === 'buf' ? 'at most ' : '') + f(M[k].writes)), h('td', { class: 'num' }, f(M[k].wasted)), h('td', { class: 'num' }, f(M[k].wait) + ' ms')))));  // cells: name, disk writes ("at most" for page buffering), wasted writes, and the average wait per fault
      say.innerHTML = `<b>${NAME[pol]}.</b> ${SAYS[pol]}`;  // the explanation card: the chosen policy's name in bold, then its description from SAYS
    }  // ends draw
    const seg = ctx.ui.seg(Object.keys(NAME).map((k) => ({ value: k, label: NAME[k] })), pol, (v) => { pol = v; draw(); });  // switch for choosing which policy to highlight and explain
    const s1 = ctx.ui.slider({ label: 'Victims that are modified', min: 0, max: 100, step: 10, value: d, format: (v) => v + '%', onInput: (v) => { d = v; draw(); } });  // slider for d, the share of victims that are modified, in steps of 10%
    const s2 = ctx.ui.slider({ label: 'Precleaned pages modified again', min: 0, max: 100, step: 10, value: r, format: (v) => v + '%', onInput: (v) => { r = v; draw(); } });  // slider for r, the share of precleaned pages modified again before they are replaced
    draw();  // draws the first picture
    panel.append(h('div', { class: 'split l', style: { height: '100%' } },  // lays out the tab: explanation on the left, controls, timeline and table on the right
      h('div', { class: 'stack', style: { gap: '9px' } },  // left column
        h('p', { class: 'm0 small', html: 'The <span class="t">cleaning policy</span> is the mirror image of the fetch policy: it decides <b>when</b> a modified page is written back to disk.' }),  // paragraph: the cleaning policy decides when modified pages are written back
        h('div', { class: 'card tight small', style: { lineHeight: '1.45' }, html: '<b>Demand cleaning</b>: write a page only when it is selected for replacement.<br><b>Precleaning</b>: write modified pages before their frames are needed, so they can go out in batches.' }),  // card: one-line definitions of demand cleaning and precleaning
        h('div', { class: 'callout tip m0 small', 'data-label': 'The usual answer', html: 'Combine cleaning with page buffering: clean only replaceable pages, keep cleaning and replacement apart, and write the modified list in batches.' }),  // tip box: the usual answer, cleaning combined with page buffering
        say,  // the explanation card of the chosen policy
        h('p', { class: 'xs muted m0', html: 'The model assumes ' + T_IO + ' ms per disk transfer and counts only pages that end up replaced. Under page buffering a page reclaimed from the modified list before the batch goes out is never written, hence “at most”.' })),  // small print: the model's assumptions and why page buffering's writes are "at most"
      h('div', { class: 'stack', style: { gap: '8px' } }, seg, s1, s2, h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), table)));  // right column: the switch, both sliders, the timeline on a white card, and the table
  }  // ends tabCleaning

  /* The reference string used by the three working-set tabs: four phases with different localities. */
  const WSREF = [1, 2, 3, 1, 2, 3, 1, 2, 4, 5, 4, 6, 5, 4, 6, 5, 1, 2, 1, 3, 2, 1, 3, 2, 7, 4, 7, 8, 4, 7, 8, 4];  // WSREF: 32 references in four phases: pages 1-3, then 4-6, then 1-3 again, then 4, 7 and 8

  /* wsSvg(ctx, d): a time line over WSREF. d = { sizes[], faults[] (optional), marks[] (optional sample
     labels), win: [from, to] (optional, 1-based), cur (1-based), sizeLabel, onPick(t) (optional) }. */
  function wsSvg(ctx, d) {  // wsSvg(): draws the time line with size bars for the three working-set tabs
    const { s } = ctx;  // s builds SVG elements
    // one long row on a wide screen; rows of 8 references on a phone so the text stays readable
    const n = WSREF.length, per = ctx.narrow ? 8 : n, W = ctx.narrow ? 380 : 1140, X0 = ctx.narrow ? 62 : 64;  // n: number of references; per: references per row; W: drawing width; X0: where the first reference sits, after the labels
    const CW = (W - 30 - X0) / per, BH = ctx.narrow ? 7 : 9.5, TOPB = ctx.narrow ? 129 : 160, ROWH = TOPB + (d.marks ? 32 : 12);  // CW: width per reference; BH: bar height per page; TOPB: where the bars' baseline sits in a row; ROWH: one row's height, taller when sample marks are shown
    const rows = Math.ceil(n / per), kids = [];  // rows: how many rows are needed; kids collects every shape
    for (let r = 0; r < rows; r++) {  // draws the labels and guide lines of each row
      const y0 = r * ROWH, BASE = y0 + TOPB, m = Math.min(per, n - r * per);  // y0: top of row r; BASE: its bar baseline; m: how many references this row holds (the last row may be short)
      kids.push(s('text', { x: X0 - 8, y: y0 + 15, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 't'),  // left labels: t for the time row
        s('text', { x: X0 - 8, y: y0 + 40, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700 }, 'page'),  // page for the row of referenced pages
        s('text', { x: X0 - 8, y: BASE - 4 * BH + 4, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700 }, d.sizeLabel),  // the caller's name for the bars (like |W| or resident) beside the bar area
        s('line', { x1: X0, x2: X0 + m * CW, y1: BASE, y2: BASE, class: 's-muted' }));  // the baseline under the bars
      for (const v of (ctx.narrow ? [4, 8] : [2, 4, 6, 8])) kids.push(s('line', { x1: X0, x2: X0 + m * CW, y1: BASE - v * BH, y2: BASE - v * BH, class: 's-muted', 'stroke-width': 0.6, 'stroke-dasharray': '2 5' }), s('text', { x: X0 + m * CW + 6, y: BASE - v * BH + 4, 'font-size': 12.5, class: 's-sub' }, String(v)));  // dotted guide lines at bar heights 4 and 8 on a phone, or 2, 4, 6 and 8 on a wide screen, each numbered at the right
      if (d.win) {  // when a window is given, it is outlined
        const a = Math.max(d.win[0], r * per + 1), b = Math.min(d.win[1], r * per + m);  // a and b: the part of the window that falls inside this row
        if (a <= b) kids.push(s('rect', { x: X0 + (a - 1 - r * per) * CW, y: y0 + 22, width: (b - a + 1) * CW, height: 28, rx: 6, class: 's-accent', 'stroke-width': 2.5, style: 'fill:none' }));  // an accent outline around the referenced pages in the window, if any of it is in this row
      }  // ends the window case
    }  // ends the loop over the rows
    WSREF.forEach((p, i) => {  // draws each reference: its time, its page and its size bar
      const t = i + 1, r = Math.floor(i / per), y0 = r * ROWH, BASE = y0 + TOPB, x = X0 + (i % per) * CW;  // t: its time (from 1); r: its row; y0 and BASE: that row's top and baseline; x: its column
      const on = t === d.cur, inWin = d.win && t >= d.win[0] && t <= d.win[1];  // on: this is the current time; inWin: it lies inside the window
      const cls = d.faults && d.faults[i] ? 's-bad' : inWin ? 's-accent' : 's-panel';  // the page box is red for a fault, accent inside the window, plain otherwise
      const box = [s('text', { x: x + CW / 2, y: y0 + 15, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': on ? 800 : 400, class: on ? 'tx-acc' : 's-sub' }, String(t)),  // the time number, bold and in the accent colour at the current time
        s('rect', { x: x + 2, y: y0 + 25, width: CW - 4, height: 22, rx: 4, class: cls, 'stroke-width': 1 }),  // the page box
        s('text', { x: x + CW / 2, y: y0 + 41, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, String(p))];  // the page number inside it
      kids.push(d.onPick ? hotGroup(ctx, () => d.onPick(t), 'Time ' + t, ...box) : s('g', {}, ...box));  // with an onPick handler the time and page become one clickable group; otherwise a plain group
      const v = d.sizes[i];  // v: the size of the set at this time
      kids.push(s('rect', { x: x + 4, y: BASE - v * BH, width: CW - 8, height: v * BH, rx: 2, class: on ? 's-accent' : 's-proc', 'stroke-width': on ? 2 : 1 }));  // the size bar, rising from the baseline, highlighted at the current time
      if (on) kids.push(s('text', { x: x + CW / 2, y: BASE - v * BH - 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 'tx-acc' }, String(v)));  // at the current time, the size is printed above the bar
      if (d.marks && d.marks[i]) kids.push(s('path', { d: `M${x + CW / 2},${BASE + 4} l-5,9 h10 z`, style: 'fill:var(--os);stroke:none' }), s('text', { x: x + CW / 2, y: BASE + 26, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-os' }, d.marks[i]));  // at a sampling instant, a small triangle under the bar with its label (S)
    });  // ends the loop over the references
    return s('svg', { viewBox: `0 0 ${W} ${rows * ROWH - 2}`, width: '100%' }, ...kids);  // hands back the drawing, its height set by the number of rows, less 2 units of spare space at the bottom
  }  // ends wsSvg

  /* tabWS(panel, ctx): the working set W(t, Δ) with sliders for the window Δ and the time t. */
  function tabWS(panel, ctx) {  // tabWS(): the first tab of step 7, showing W(t, Δ) with sliders for the window Δ and the time t
    const { h } = ctx;  // h builds HTML elements
    const K = ctx.keep.ws || (ctx.keep.ws = { delta: 4, t: 12 });  // K: this tab's settings, kept in the step's ctx.keep so a phone-width or desktop redraw hands them back
    let delta = K.delta, t = K.t;  // the window Δ and the time t (on a fresh visit a window of 4 references, ending at time 12)
    const top = h('div', { class: 'card white', style: { padding: '4px 6px' } });  // top: the white card that holds the time line
    const out = h('div', { class: 'card tight small', style: { lineHeight: '1.5' } });  // out: the card that writes out the working set and its size
    function draw() {  // draw(): recomputes and redraws everything after any slider move or click
      const sizes = WSREF.map((_, i) => workingSet(WSREF, i + 1, delta).length);  // sizes: the working set's size at every time, with the current Δ
      K.delta = delta; K.t = t;  // records both settings in K, so a phone-width or desktop redraw keeps them
      top.replaceChildren(wsSvg(ctx, { sizes, win: [Math.max(1, t - delta + 1), t], cur: t, sizeLabel: '|W|', onPick: (v) => { t = v; st.set(t); draw(); } }));  // redraws the time line with the window outlined; a click on a reference moves t there and updates the time slider
      const W = workingSet(WSREF, t, delta).sort((a, b) => a - b), cap = Math.min(delta, 8);  // W: the working set at time t, sorted; cap: the largest size possible, min(Δ, 8), since the string uses 8 different pages
      out.innerHTML = `<b>W(${t}, ${delta}) = { ${W.join(', ')} }</b>: the distinct pages among references ${Math.max(1, t - delta + 1)} to ${t}. ` +  // writes out W(t, Δ) and which references the window covers
        `Size |W| = <b>${W.length}</b>, and indeed 1 ≤ ${W.length} ≤ min(Δ, pages in the process) = min(${delta}, 8) = ${cap}.<br>` +  // its size, checked against the bound 1 ≤ |W| ≤ min(Δ, pages)
        `<span class="muted">Across the whole run the size peaks at ${Math.max(...sizes)} with Δ = ${delta}. The bars stay low inside a phase and jump while the process moves to a new locality.</span>`;  // a grey note: the largest size over the run, and how the bars jump when the locality changes
    }  // ends draw
    const sd = ctx.ui.slider({ label: 'Window Δ', min: 1, max: 10, value: delta, onInput: (v) => { delta = v; draw(); } });  // slider for the window Δ, from 1 to 10
    const st = ctx.ui.slider({ label: 'Time t', min: 1, max: WSREF.length, value: t, onInput: (v) => { t = v; draw(); } });  // slider for the time t, from 1 to the end of the string
    draw();  // draws the first picture
    panel.append(h('div', { class: 'stack', style: { gap: '8px', height: '100%' } }, top,  // lays out the tab: the time line on top
      h('div', { class: 'split l', style: { height: 'auto' } },  // below it, two columns
        h('div', { class: 'stack gap-s' }, sd, st, h('p', { class: 'xs muted m0' }, 'Click any reference to jump to it. Try a bigger Δ: the set can only stay the same or grow.')),  // left: the two sliders and a hint to click references and try a bigger Δ
        out),  // right: the working-set readout
      h('div', { class: 'grid-2', style: { gap: '10px' } },  // at the bottom, two cards side by side
        h('div', { class: 'card tight small', style: { lineHeight: '1.45' }, html: '<b>The policy</b>: keep watching each process’s <span class="t">working set</span>; now and then remove from its resident set the pages that have left it; and let a process run only if its whole working set fits in main memory.' }),  // card: the working-set policy in three rules
        h('div', { class: 'callout warn m0 small', 'data-label': 'Why nobody runs it exactly', html: 'The past does not always predict the future; measuring the true working set would mean timestamping every reference; and the best Δ is unknown and varies. Real systems approximate it.' }))));  // warning box: why no system measures the working set exactly
  }  // ends tabWS

  /* tabPFF(panel, ctx): page fault frequency with a threshold slider F. */
  function tabPFF(panel, ctx) {  // tabPFF(): the second tab of step 7, page fault frequency with a slider for the threshold F
    const { h } = ctx;  // h builds HTML elements
    const K = ctx.keep.pff || (ctx.keep.pff = { F: 3 });  // K: this tab's setting, kept in the step's ctx.keep so a phone-width or desktop redraw hands it back
    let F = K.F;  // the threshold F (3 references on a fresh visit)
    const top = h('div', { class: 'card white', style: { padding: '4px 6px' } });  // top: the white card that holds the time line
    const stats = h('div', { class: 'row', style: { gap: '8px' } });  // stats: chips with the fault count and the resident set sizes
    const log = h('div', { class: 'log', style: { height: '96px' } });  // log: a scrolling list of what happened at each fault
    function draw() {  // draw(): reruns PFF with the current F and redraws, every time the slider moves
      const r = pff(WSREF, F), sizes = r.steps.map((x) => x.size), avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;  // r: the PFF run; sizes: the resident set size at each time; avg: their average (reduce adds them up)
      K.F = F;  // records the threshold in K, so a phone-width or desktop redraw keeps it
      top.replaceChildren(wsSvg(ctx, { sizes, faults: r.steps.map((x) => x.fault), cur: 0, sizeLabel: 'resident' }));  // redraws the time line: faults in red and the resident set size as bars, with no current time picked
      stats.innerHTML = `<span class="chip bad">${r.faults} faults</span><span class="chip proc">average resident set ${ctx.util.fmt(avg, 2)} pages</span><span class="chip">largest ${Math.max(...sizes)}</span>`;  // chips: the number of faults, the average resident set size, and the largest size reached
      log.replaceChildren(...r.steps.filter((x) => x.fault).map((x) => h('div', { html: `t=${x.t}: fault on ${x.page}, ${x.gap} reference${x.gap === 1 ? '' : 's'} since the ${x.gap === x.t ? 'start' : 'last fault'} ` +  // the log: one line per fault giving its time, its page and the gap since the previous fault (or since the start)
        (x.action === 'grow' ? `&lt; F → just add it (size ${x.size})` : `≥ F → drop unused {${x.dropped.join(', ') || 'none'}}, reset use bits, add it (size ${x.size})`) })));  // then the decision: below F just add the page, otherwise drop the unused pages, reset use bits and add it, with the new size
    }  // ends draw
    const sf = ctx.ui.slider({ label: 'Threshold F', min: 1, max: 6, value: F, onInput: (v) => { F = v; draw(); } });  // slider for the threshold F, from 1 to 6 references
    draw();  // draws the first picture
    panel.append(h('div', { class: 'stack', style: { gap: '8px', height: '100%' } }, top,  // lays out the tab: the time line on top
      h('div', { class: 'split l', style: { height: 'auto' } },  // below it, two columns
        h('div', { class: 'stack gap-s' },  // left column
          h('div', { class: 'small', style: { lineHeight: '1.45' }, html: '<span class="t">Page fault frequency (PFF)</span> keeps a use bit per page and acts only on a fault. If fewer than <b>F</b> references have passed since the last fault, faults are coming fast: <b>add</b> the page. Otherwise first <b>drop every page whose use bit is 0</b>, reset the others’ use bits, then add the page.' }),  // paragraph: the PFF rule, one decision made only at each fault
          sf, stats),  // the slider and the chips
        h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0' }, 'What happened at each fault'), log,  // right column: a heading and the fault log
          h('div', { class: 'callout warn m0 small', 'data-label': 'Weak spot', html: 'When a process moves to a new locality, faults come quickly, so nothing is dropped: old and new pages pile up together. Watch the bars swell after t = 9 and t = 25, more so with a large F.' })))));  // warning box: why PFF lets old and new pages pile up when the locality changes, and where to see it
  }  // ends tabPFF

  /* tabVSWS(panel, ctx): variable-interval sampled working set with sliders M, L and Q. */
  function tabVSWS(panel, ctx) {  // tabVSWS(): the third tab of step 7, the sampled working set with sliders for M, L and Q
    const { h } = ctx;  // h builds HTML elements
    const K = ctx.keep.vsws || (ctx.keep.vsws = { M: 3, L: 8, Q: 2 });  // K: this tab's settings, kept in the step's ctx.keep so a phone-width or desktop redraw hands them back
    let M = K.M, L = K.L, Q = K.Q;  // on a fresh visit: at least 3 and at most 8 references between samples, with a sample after 2 faults
    const top = h('div', { class: 'card white', style: { padding: '4px 6px' } });  // top: the white card that holds the time line
    const stats = h('div', { class: 'row', style: { gap: '8px' } });  // stats: chips with the counts of faults and samples and the average resident set size
    const log = h('div', { class: 'log', style: { height: '118px' } });  // log: a scrolling list explaining each sample
    function draw() {  // draw(): reruns VSWS with the current settings and redraws, after every slider move
      const r = vsws(WSREF, M, L, Q), sizes = r.steps.map((x) => x.size), avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;  // r: the VSWS run; sizes: resident set size at each time; avg: their average
      K.M = M; K.L = L; K.Q = Q;  // records the three settings in K, so a phone-width or desktop redraw keeps them
      top.replaceChildren(wsSvg(ctx, { sizes, faults: r.steps.map((x) => x.fault), marks: r.steps.map((x) => (x.sample ? 'S' : null)), cur: 0, sizeLabel: 'resident' }));  // redraws the time line with faults in red, size bars, and an S mark under every sampling instant
      stats.innerHTML = `<span class="chip bad">${r.faults} faults</span><span class="chip os">${r.samples} samples</span><span class="chip proc">average resident set ${ctx.util.fmt(avg, 2)} pages</span>`;  // chips: faults, samples, and the average resident set size
      let prev = 0;   // virtual time of the previous sample
      log.replaceChildren(...r.steps.filter((x) => x.sample).map((x) => {  // the log: one line per sample, in time order
        const el = x.t - prev, waited = x.sample === 'Q' && x.t >= 2 && r.steps[x.t - 2].waiting;  // el: references since the previous sample; waited: a Q sample that had to wait because Q faults came before M references had passed
        prev = x.t;  // remembers this sample's time for the next line
        return h('div', { html: `t=${x.t}: sample, ${el} reference${el === 1 ? '' : 's'} after the last (${x.sample === 'L' ? `reached L = ${L}` : `Q = ${Q} fault${Q === 1 ? '' : 's'} reached and ${el} ≥ M = ${M}${waited ? ', so it waited for M' : ''}`}) → drop unused {${x.dropped.join(', ') || 'none'}}, reset use bits` });  // the line: when it happened, why (L reached, or Q faults with at least M passed), and which pages it dropped
      }));  // ends the log
    }  // ends draw
    const sM = ctx.ui.slider({ label: 'M (minimum)', min: 1, max: 6, value: M, onInput: (v) => { M = v; if (L < M) { L = M; sL.set(L); } draw(); } });  // slider for M; if M passes L, L is pushed up to match (and its slider moved) so the minimum never exceeds the maximum
    const sL = ctx.ui.slider({ label: 'L (maximum)', min: 2, max: 16, value: L, onInput: (v) => { L = v; if (M > L) { M = L; sM.set(M); } draw(); } });  // slider for L; if L drops below M, M is pulled down to match
    const sQ = ctx.ui.slider({ label: 'Q (faults)', min: 1, max: 4, value: Q, onInput: (v) => { Q = v; draw(); } });  // slider for Q, the number of faults that can bring a sample forward
    draw();  // draws the first picture
    panel.append(h('div', { class: 'stack', style: { gap: '8px', height: '100%' } }, top,  // lays out the tab: the time line on top
      h('div', { class: 'split l', style: { height: 'auto' } },  // below it, two columns
        h('div', { class: 'stack gap-s' },  // left column
          h('div', { class: 'small', style: { lineHeight: '1.45' }, html: '<b>Variable-interval sampled working set</b>: use bits are reset at each <b>sampling instant</b> (S); pages that fault in between are added. A sample drops every page whose use bit is still 0. Samples come after <b>L</b> references at most, or sooner once <b>Q</b> faults have happened, but never less than <b>M</b> after the last sample.' }),  // paragraph: the VSWS rules, what a sample does and when samples happen
          sM, sL, sQ),  // the three sliders
        h('div', { class: 'stack gap-s' }, stats, log,  // right column: the chips and the sample log
          h('p', { class: 'xs muted m0' }, 'Faults bunch up when the process changes locality, so samples come early and old pages are dropped quickly; in a quiet phase samples wait up to L.')))));  // small note: why samples come early when the locality changes and late in a quiet phase
  }  // ends tabVSWS

  /* tabLoad(panel, ctx): CPU utilization against the multiprogramming level, from loadModel(). */
  function tabLoad(panel, ctx) {  // tabLoad(): the first tab of step 8, processor utilization against the number of processes in memory
    const { h, s } = ctx;  // h builds HTML elements and s builds SVG ones
    const NMAX = 14, data = Array.from({ length: NMAX }, (_, i) => loadModel(i + 1)), free = Array.from({ length: NMAX }, (_, i) => loadModel(i + 1, false));  // NMAX: up to 14 processes; data: the model at each level with paging; free: the same with unlimited memory (no faults)
    const peak = data.reduce((a, b) => (b.U > a.U ? b : a)).N;  // peak: the level with the highest utilization
    const ls = data.find((x) => x.L <= LM.S).N;  // ls: the first level at which the time between faults (L) has fallen to the fault service time (S)
    const half = data.reduce((a, b) => (Math.abs(b.disk - 0.5) < Math.abs(a.disk - 0.5) ? b : a)).N;  // half: the level whose paging disk is closest to 50% busy
    const K = ctx.keep.load || (ctx.keep.load = { N: 3 });  // K: this tab's setting, kept in the step's ctx.keep so a phone-width or desktop redraw hands it back
    let N = K.N;  // N: the level picked with the slider (3 on a fresh visit)
    // a phone gets a slimmer chart so its labels keep a readable size
    const LX = ctx.narrow ? 40 : 52, VW = ctx.narrow ? 372 : 600, X = (v) => LX + (v - 1) * (ctx.narrow ? 24 : 38), Y = (u) => 214 - u * 190;  // sizes: LX is where the chart starts; VW its width; X(v) the position of level v; Y(u) the height for utilization u (0 to 1)
    const svg = s('svg', { viewBox: `0 0 ${VW} 254`, width: '100%' });  // the chart drawing
    const stat = h('div', { class: 'grid-4', style: { gap: '6px' } });  // stat: four tiles of numbers for the chosen level
    const verdict = h('div', { class: 'callout m0 small' });  // verdict: the callout that says what the chosen level means; its colour and label change with the level
    const base = [s('line', { x1: LX, x2: X(NMAX), y1: Y(0), y2: Y(0), class: 's-muted' }), s('line', { x1: LX, x2: LX, y1: Y(0), y2: Y(1), class: 's-muted' })];  // the fixed parts of the chart, drawn once: the horizontal axis and the vertical axis
    [0, 0.5, 1].forEach((u) => base.push(s('text', { x: LX - 6, y: Y(u) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, u * 100 + '%')));  // labels 0%, 50% and 100% up the vertical axis
    for (let v = 1; v <= NMAX; v++) base.push(s('text', { x: X(v), y: 232, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(v)));  // the numbers 1 to 14 along the horizontal axis
    base.push(s('text', { x: X(7.5), y: 248, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'multiprogramming level (processes in memory)'),  // the horizontal axis title
      s('text', { x: LX + 6, y: 12, 'font-size': 12.5, 'font-weight': 700 }, 'Processor utilization'),  // the chart title
      s('polyline', { points: free.map((d) => `${X(d.N)},${Y(d.U)}`).join(' '), fill: 'none', style: 'stroke:var(--line-2)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }),  // the dashed grey curve: utilization if memory were unlimited
      s('text', { x: X(NMAX), y: Y(free[NMAX - 1].U) - 6, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, ctx.narrow ? 'unlimited memory' : 'if memory were unlimited'),  // its label at the right end, shorter on a phone
      s('polyline', { points: data.map((d) => `${X(d.N)},${Y(d.U)}`).join(' '), fill: 'none', style: 'stroke:var(--os)', 'stroke-width': 3 }));  // the solid curve: utilization with paging, which rises, peaks and collapses
    const layer = s('g');  // layer: a group for the parts that change with the slider
    svg.append(...base, layer);  // puts the fixed parts and the changing layer into the drawing
    function draw() {  // draw(): redraws the marker, the tiles and the verdict for the chosen level
      const d = data[N - 1], flip = X(N) + 50 > VW;   // flip: too close to the right edge, so the label goes below-left of the point
      K.N = N;  // records the level in K, so a phone-width or desktop redraw keeps it
      layer.replaceChildren(s('line', { x1: X(N), x2: X(N), y1: Y(0), y2: Y(d.U), style: 'stroke:var(--accent)', 'stroke-dasharray': '4 4' }),  // a dashed line up from the axis to the curve at the chosen level
        s('circle', { cx: X(N), cy: Y(d.U), r: 7, class: 's-accent', 'stroke-width': 3 }),  // a circle on the curve at that point
        s('text', { x: X(N) + (flip ? -12 : 12), y: Y(d.U) + (flip || N <= peak ? 22 : -10), 'text-anchor': flip ? 'end' : 'start', 'font-size': 14, 'font-weight': 800, class: 'tx-acc' }, Math.round(d.U * 100) + '%'));  // the utilization as a percent beside the point: below it up to the peak, above it after, and to the left near the right edge
      const tile = (lab, v, sub) => h('div', { class: 'card tight', style: { padding: '4px 8px' } }, h('div', { class: 'xs muted b' }, lab), h('div', { class: 'b', style: { fontSize: '19px' } }, v), h('div', { class: 'xs muted' }, sub));  // tile(): one number card with a label, the value and a note
      stat.replaceChildren(tile('Frames each', ctx.util.fmt(d.f, 1), `${LM.MEM} ÷ ${N}`), tile('L: time between faults', ctx.util.fmt(d.L, 1) + ' ms', `S = ${LM.S} ms per fault`),  // tiles: frames per process (96 shared by N), and L, the time between faults, compared with S
        tile('Paging disk busy', Math.round(d.disk * 100) + '%', ''), tile('CPU busy', Math.round(d.U * 100) + '%', N === peak ? 'the peak' : ''));  // tiles: how busy the paging disk is, and how busy the processor is (marked at the peak)
      let cls, lab, txt;  // cls, lab and txt: the verdict's style, label and text
      if (N < peak - 1) { cls = 'tip'; lab = 'Too few processes'; txt = `Often every process is waiting for its own I/O at once, so the processor idles. Memory is plentiful (${ctx.util.fmt(d.f, 0)} frames each), so faults are rare: room for more.`; }  // well below the peak: too few processes, so all are often blocked on their own I/O
      else if (N <= peak + 1) { cls = 'why'; lab = 'Near the peak'; txt = `Utilization peaks at ${peak} processes. Here the paging disk is ${Math.round(d.disk * 100)}% busy (the 50% rule points to ${half}) and L is ${ctx.util.fmt(d.L / LM.S, 1)} × S (L = S falls between ${ls - 1} and ${ls}). Rules of thumb land near the peak, not exactly on it.`; }  // near the peak: names the peak and compares it with what the 50% rule and the L = S rule would suggest
      else { cls = 'bad'; lab = 'Thrashing'; txt = `Each process has only ${ctx.util.fmt(d.f, 1)} frames, less than its locality, so it faults every ${ctx.util.fmt(d.L, 1)} ms, faster than the paging disk can serve (${Math.round(d.disk * 100)}% busy). Processes queue for the disk and the processor sits idle.`; }  // past the peak: thrashing, explained with the frames each process has and how often it faults
      verdict.className = 'callout m0 small ' + cls; verdict.dataset.label = lab; verdict.innerHTML = txt;  // applies the verdict's colour, label and text to the callout
    }  // ends draw
    const sl = ctx.ui.slider({ label: 'Processes in memory', min: 1, max: NMAX, value: N, onInput: (v) => { N = v; draw(); } });  // slider for the number of processes in memory, 1 to 14
    draw();  // draws the first picture
    panel.append(h('div', { class: 'split l', style: { height: '100%' } },  // lays out the tab: explanation on the left, chart and numbers on the right
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column
        h('p', { class: 'm0 small', html: '<span class="t">Load control</span> sets the multiprogramming level. Too few processes and all of them are often blocked at once; too many and each has too few frames, so the system <span class="t" data-t="Thrashing">thrashes</span>. Ways to find the sweet spot:' }),  // paragraph: what load control decides, and what goes wrong with too few or too many processes
        h('ul', { class: 'm0 small', style: { lineHeight: '1.4' }, html: '<li><b>Working set or PFF</b>: load control comes for free, since a process runs only when its resident set is big enough.</li><li><b>L = S</b>: keep the mean time between faults (L) about equal to the mean time to service one (S).</li><li><b>50% rule</b>: keep the paging device about half busy.</li><li><b>Clock sweep rate</b>: a slow-moving pointer means few faults and room for more; a fast one means too many.</li>' }),  // list: four ways to find the right level (working set or PFF, L = S, the 50% rule, clock sweep rate)
        verdict),  // the verdict callout; ends the left column
      h('div', { class: 'stack', style: { gap: '8px' } }, sl, h('div', { class: 'card white', style: { padding: '4px 6px' } }, svg), stat,  // right column: the slider, the chart on a white card, and the tiles
        h('p', { class: 'xs muted m0', style: { lineHeight: '1.4' }, html: `<b>The model:</b> each process repeats ${LM.DCPU} ms of computing and ${LM.DIO} ms of waiting for its own I/O; each page fault needs ${LM.S} ms of one shared paging disk. The ${LM.MEM} frames are split equally, and with f frames a process computes L(f) ms between faults: about ${LM.LMAX} ms when memory is plentiful, falling steeply below about ${LM.W} frames. Utilization comes from a standard queueing calculation (mean value analysis).` }))));  // small print: the model behind the chart, filled in from the LM settings
  }  // ends tabLoad

  /* tabSuspend(panel, ctx): six ways to pick the process to suspend when the level must drop. */
  function tabSuspend(panel, ctx) {  // tabSuspend(): the second tab of step 8, six rules for choosing a process to suspend
    const { h } = ctx;  // h builds HTML elements
    const P = [  // P: six made-up resident processes, built so that each rule picks a different one
      { id: 'A', pri: 5, res: 30, size: 120, act: 1, rem: 40, fault: true },  // process A: the highest priority and the oldest, but it is the one waiting on a page fault
      { id: 'B', pri: 1, res: 18, size: 40, act: 2, rem: 10 },  // process B: the lowest priority
      { id: 'C', pri: 3, res: 6, size: 60, act: 3, rem: 25 },  // process C: the smallest resident set (6 frames)
      { id: 'D', pri: 4, res: 34, size: 200, act: 4, rem: 15 },  // process D: the largest process (200 pages) holding the most frames
      { id: 'E', pri: 2, res: 14, size: 80, act: 6, rem: 5 },  // process E: the most recently activated, with the least run time left
      { id: 'F', pri: 3, res: 25, size: 90, act: 5, rem: 90 },  // process F: the most run time left
    ];  // closes the process table
    const by = (key, dir) => P.reduce((a, b) => ((dir > 0 ? b[key] > a[key] : b[key] < a[key]) ? b : a)).id;  // by(key, dir): the id of the process with the largest (dir > 0) or smallest (dir < 0) value of key; reduce keeps the earlier one on a tie
    const RULES = [  // RULES: the six suspension rules; each has a key, a button name, how it picks, which table column it uses, and why
      { k: 'pri', name: 'Lowest priority', pick: () => by('pri', -1), col: 1, why: 'A pure scheduling decision: the least important work waits. It ignores memory entirely, so it may free few frames or hit a process with a tidy working set.' },  // rule: lowest priority, which ignores memory entirely
      { k: 'fault', name: 'Faulting process', pick: () => P.find((p) => p.fault).id, col: 6, why: 'It is about to block anyway, and a process that faults probably lacks its working set, so suspending it costs little. But if its working set is mostly there, that resident set is thrown away.' },  // rule: the faulting process, about to block anyway
      { k: 'act', name: 'Last activated', pick: () => by('act', 1), col: 4, why: 'The newest process is the least likely to have built up its working set yet, so little useful memory is lost.' },  // rule: the last process activated, which has the least working set to lose
      { k: 'res', name: 'Smallest resident set', pick: () => by('res', -1), col: 2, why: 'The cheapest to bring back later. The drawback: it punishes programs with strong locality, which need few frames precisely because they behave well.' },  // rule: the smallest resident set, cheap to reload but unfair to well-behaved programs
      { k: 'size', name: 'Largest process', pick: () => by('size', 1), col: 3, why: `A large process usually holds the most frames (here ${P.find((p) => p.id === by('size', 1)).res}), so suspending it frees the most memory in one go and another suspension is unlikely to be needed soon.` },  // rule: the largest process, which frees the most frames at once; its frame count is looked up from the table
      { k: 'rem', name: 'Largest remaining run time', pick: () => by('rem', 1), col: 5, why: 'Like shortest-process-first scheduling: the job that will take longest to finish is the one that waits.' },  // rule: the largest remaining run time, like shortest-process-first scheduling
    ];  // closes RULES
    const K = ctx.keep.susp || (ctx.keep.susp = { cur: null });  // K: this tab's choice, kept in the step's ctx.keep so a phone-width or desktop redraw hands it back
    let cur = K.cur;  // cur: the key of the rule chosen, none until a button is clicked (on a fresh visit)
    const table = h('table', { class: 'tbl compact' });  // table: the process table
    const say = h('div', { class: 'card tight small', style: { minHeight: '68px', lineHeight: '1.45' } });  // say: the card explaining the chosen rule
    function draw() {  // draw(): rebuilds the table, the explanation and the button highlight after a rule is clicked
      const r = RULES.find((x) => x.k === cur), pick = r ? r.pick() : null;  // r: the chosen rule (if any); pick: the id of the process it suspends
      const hd = ['Process', 'Priority', 'Resident frames', 'Size (pages)', 'Activated', 'Run time left', 'State'];  // hd: the table's column titles
      table.replaceChildren(h('thead', {}, h('tr', {}, ...hd.map((x, i) => h('th', { style: r && r.col === i ? { background: 'var(--accent-bg)', color: 'var(--accent)' } : null }, x)))),  // header row, with the column the chosen rule looks at tinted in the accent colour
        h('tbody', {}, ...P.map((p) => h('tr', { class: p.id === pick ? 'on' : '' }, h('td', { class: 'b' }, p.id + (p.id === pick ? '  ← suspend' : '')), h('td', { class: 'num' }, String(p.pri)), h('td', { class: 'num' }, String(p.res)),  // one row per process, the picked one highlighted and marked with an arrow; first cells: name, priority, resident frames
          h('td', { class: 'num' }, String(p.size)), h('td', { class: 'num' }, ['', '1st', '2nd', '3rd', '4th', '5th', '6th'][p.act]), h('td', { class: 'num' }, p.rem + ' s'), h('td', { class: 'small' }, p.fault ? 'waiting for a page' : 'ready')))));  // remaining cells: size, activation order written as 1st, 2nd..., run time left, and whether it is waiting for a page
      say.innerHTML = r ? `<b>${r.name} → process ${pick}.</b> ${r.why}` : '<b>Click a rule.</b> <span class="muted">The highlighted column is the fact it uses, and the row is the process it suspends.</span>';  // explanation: the rule and the process it picks, then why; before any click, a hint on how to read the table
      Object.entries(btns).forEach(([k, b]) => b.classList.toggle('on', k === cur));  // lights up the button of the chosen rule and no other
    }  // ends draw
    const btns = {};  // btns: the rule buttons, by key (filled in below; draw uses them only after this line has run)
    RULES.forEach((r) => { btns[r.k] = h('button', { class: 'btn sm', onclick: () => { cur = K.cur = r.k; draw(); } }, r.name); });  // one button per rule; clicking it makes that rule current (recorded in K too) and redraws
    draw();  // draws the starting table
    panel.append(h('div', { class: 'stack', style: { gap: '9px', height: '100%' } },  // lays out the tab as one column
      h('p', { class: 'm0 small', html: 'When load control must lower the multiprogramming level, a resident process is <span class="t" data-t="Suspended process">suspended</span> (swapped out). Six common choices, each with its own logic. Priority: higher number = more important.' }),  // paragraph: why a process must be suspended, and how to read the priority numbers
      h('div', { class: 'row', style: { gap: '6px' } }, ...Object.values(btns)), table, say,  // the row of rule buttons, then the table and the explanation
      h('div', { class: 'callout why m0 small', 'data-label': 'No single right answer', html: 'Each rule trades something off: how many frames the suspension frees, how much useful resident memory is thrown away, how costly the process is to bring back, and fairness. Real systems mix several of these signals.' })));  // closing note: each rule trades something off, and real systems mix signals
  }  // ends tabSuspend

  Guide.section({  // registers section 8.2 with the guide: its steps, glossary terms, styles and notes
    id: '8.2',  // the section number, used in links, saved progress and the contents panel
    title: 'Operating System Software',  // the full title shown on the section's pages
    short: 'VM policies',  // a short name for menus where space is tight
    summary: 'The OS decisions behind virtual memory: fetch, placement, replacement, resident sets, cleaning, load control.',  // one-line summary shown in the chapter overview
    objectives: [  // objectives: what a student should be able to do after this section
      'Name the six policy areas of virtual-memory software and the question each one answers.',  // objective: name the six policy areas
      'Contrast demand paging with prepaging, and explain why placement barely matters for paging.',  // objective: demand paging versus prepaging, and why placement barely matters
      'Run OPT, LRU, FIFO and clock (including the modified-bit variant) on a reference string, count page faults, and recognise Belady’s anomaly.',  // objective: run the four replacement policies by hand and spot Belady's anomaly
      'Explain page buffering, fixed vs variable allocation, local vs global scope, the working set and its approximations (PFF, VSWS).',  // objective: page buffering, allocation and scope, the working set and its approximations
      'Describe cleaning policies, load control and the choices for which process to suspend.',  // objective: cleaning, load control and suspension choices
    ],  // closes the objectives
    terms: [  // terms: glossary entries added by this section, each a [term, definition] pair
      ['Fetch policy', 'The rule that decides when a page is brought into main memory: only when it is referenced (demand paging), or ahead of time together with others (prepaging).'],  // glossary entry: fetch policy
      ['Demand paging', 'A fetch policy that reads a page from disk only when the process references it and takes a page fault. A new process faults often at first, then less as the pages it is using arrive.'],  // glossary entry: demand paging
      ['Prepaging', 'A fetch policy that, along with the page that faulted, reads other pages the process has not asked for yet, usually its neighbours on disk, because one larger disk read is cheaper than several small ones.'],  // glossary entry: prepaging, and why one larger read beats several small ones
      ['Placement policy', 'The rule that decides where in real memory a piece of a process goes. It matters for pure segmentation (first-fit, best-fit) but hardly at all for paging, where every frame is as good as any other.'],  // glossary entry: placement policy
      ['Replacement policy', 'The rule that chooses which resident page to evict when a new page must come in and no frame is free. It aims to remove the page least likely to be used soon.'],  // glossary entry: replacement policy
      ['Frame locking', 'Marking a frame with a lock bit so its page can never be chosen for replacement; used for the kernel, key control structures, I/O buffers and time-critical code.'],  // glossary entry: frame locking and what gets locked
      ['Optimal policy (OPT)', 'The replacement policy that evicts the page whose next reference lies farthest in the future. It causes the fewest possible faults but needs knowledge of the future, so it serves only as a yardstick.'],  // glossary entry: the optimal policy (OPT), a yardstick only
      ['Least recently used (LRU)', 'The replacement policy that evicts the page that has gone unreferenced for the longest time, betting that the recent past predicts the near future.'],  // glossary entry: least recently used (LRU)
      ['First-in-first-out (FIFO)', 'The replacement policy that evicts the page that has been in memory the longest, no matter how often it is used. Simple, but it throws out busy pages just because they are old.'],  // glossary entry: first-in-first-out (FIFO)
      ['Clock policy', 'A cheap approximation of LRU: frames form a circle with a pointer, and each frame has a use bit. The pointer passes over frames whose use bit is 1 (clearing it) and evicts the first page whose use bit is 0.'],  // glossary entry: the clock policy
      ['Use bit', 'A one-bit flag per frame (also called the reference bit) set to 1 when a page is loaded and every time it is referenced; replacement and working-set policies clear it to see which pages are still being used.'],  // glossary entry: the use bit, also called the reference bit
      ['Belady’s anomaly', 'The surprising case in which giving FIFO replacement more frames produces more page faults on the same reference string. LRU and OPT never behave this way.'],  // glossary entry: Belady's anomaly
      ['Page buffering', 'Keeping recently evicted pages in their frames on a free page list (clean pages) or a modified page list (changed pages) so that a page referenced again soon can be reclaimed without a disk read.'],  // glossary entry: page buffering
      ['Resident set', 'The pages of a process that are in main memory right now. Resident set management decides how many frames each process gets and whose page is replaced.'],  // glossary entry: resident set
      ['Variable allocation', 'A resident set policy in which the number of frames a process holds can change over its lifetime. Its opposite, fixed allocation, gives a process a set number of frames for its whole run.'],  // glossary entry: variable allocation, and its opposite, fixed allocation
      ['Replacement scope', 'Which pages are candidates when a process faults: local scope considers only that process’s own resident pages; global scope considers every unlocked page in memory.'],  // glossary entry: replacement scope, local or global
      ['Working set', 'W(t, Δ): the set of pages a process referenced during its last Δ units of virtual time (its last Δ memory references). It estimates the pages the process needs right now.'],  // glossary entry: the working set W(t, Δ)
      ['Page fault frequency (PFF)', 'A working-set approximation that sizes a resident set from how quickly faults arrive: a fault soon after the previous one adds a page; a fault after a long gap first drops the pages that went unused.'],  // glossary entry: page fault frequency (PFF)
      ['Cleaning policy', 'The rule for when a modified page is written back to disk: only when it is chosen for replacement (demand cleaning) or ahead of time in batches (precleaning).'],  // glossary entry: cleaning policy
      ['Load control', 'Deciding how many processes are resident in main memory at once (the multiprogramming level), so that the processor stays busy without the system thrashing.'],  // glossary entry: load control
    ],  // closes the glossary terms
    css: ` /* css: styles that apply only inside this section (every rule starts with .sec-8-2) */
      .sec-8-2 .hot { cursor: pointer; } /* clickable drawing parts (the u and m bits, the time boxes) show a pointing-hand cursor */
      .sec-8-2 .hot:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; } /* a thick accent outline when a clickable part is reached with the keyboard, so keyboard users can see where they are */
      .sec-8-2 .tx-ok { fill: var(--ok); } .sec-8-2 .tx-bad { fill: var(--bad); } .sec-8-2 .tx-acc { fill: var(--accent); } /* text colours for drawings (SVG text uses fill): green for ok, red for bad, accent */
      .sec-8-2 .tx-mem { fill: var(--mem); } .sec-8-2 .tx-os { fill: var(--os); } .sec-8-2 .tx-warn { fill: var(--warn); } /* more drawing text colours: memory, operating system, warning amber */
      .sec-8-2 .tx-muted { fill: var(--muted); } .sec-8-2 .tx-proc { fill: var(--proc); } .sec-8-2 .tx-io { fill: var(--io); } /* more drawing text colours: grey, process teal, I/O */
      .sec-8-2 .c-ok { color: var(--ok); } .sec-8-2 .c-bad { color: var(--bad); } .sec-8-2 .c-acc { color: var(--accent); } /* text colours for ordinary page text: green, red, accent */
      .sec-8-2 .c-warn { color: var(--warn); } .sec-8-2 .c-os { color: var(--os); } .sec-8-2 .c-mem { color: var(--mem); } /* more page text colours: warning amber, operating system, memory */
    `,  // end of the section's styles
    steps: [  // steps: the section's ten screens, in order
      /* ---------------- 1. Big picture: six decisions behind every page fault ---------------- */
      {  // opens step 1, the big picture
        title: 'Six decisions behind every page fault',  // step 1's title
        kind: 'story',  // kind story: a Big Picture introduction
        render(el, ctx) {  // render(): draws step 1 into el when the student arrives on it
          const { h } = ctx;  // h builds HTML elements
          const P = [  // P: the six policy areas, each with its key, name, question, colour, the step that explores it, options and an analogy
            { k: 'fetch', name: 'Fetch policy', q: 'When does a page come in?', col: 'mem', step: 2,  // fetch policy: when a page comes in, explored in step 2
              opts: ['<b>Demand paging</b>: only when the process touches it and faults.', '<b>Prepaging</b>: also bring in pages it has not asked for yet, usually its neighbours on disk.'],  // its two options: demand paging and prepaging
              desk: 'fetch a book only when you need it, or also grab the books shelved next to it on the same trip?' },  // its library-desk analogy
            { k: 'place', name: 'Placement policy', q: 'Where in real memory does it go?', col: 'mem', step: 2,  // placement policy: where a page goes, also in step 2
              opts: ['Matters for pure segmentation: first-fit, best-fit and friends (chapter 7).', 'For paging any free frame is as good as another, except on NUMA machines, where memory close to the running processor is faster.'],  // its options: matters for segmentation, barely for paging except on NUMA machines
              desk: 'which spot on the desk? With equal-sized slots, any free slot will do.' },  // its library-desk analogy
            { k: 'repl', name: 'Replacement policy', q: 'Which page goes out to make room?', col: 'cpu', step: '3 to 5',  // replacement policy: which page leaves, explored in steps 3 to 5
              opts: ['Basic algorithms: <b>OPT</b>, <b>LRU</b>, <b>FIFO</b> and <b>clock</b>.', '<b>Page buffering</b> keeps evicted pages around for a while.', 'Locked frames are never candidates.'],  // its options: the four basic algorithms, page buffering, locked frames
              desk: 'the desk is full; which book goes back to the library?' },  // its library-desk analogy
            { k: 'rs', name: 'Resident set management', q: 'How many frames per process, and whose page goes?', col: 'proc', step: '6 and 7',  // resident set management: frames per process and whose page goes, steps 6 and 7
              opts: ['Size: <b>fixed</b> or <b>variable</b> allocation.', 'Scope: <b>local</b> (only the faulting process’s pages) or <b>global</b> (any unlocked page).', 'The working set idea and its approximations size it well.'],  // its options: fixed or variable size, local or global scope, the working set
              desk: 'how much desk space does each reader get, and may you take a book off a neighbour’s pile?' },  // its library-desk analogy
            { k: 'clean', name: 'Cleaning policy', q: 'When are changed pages written back?', col: 'io', step: 5,  // cleaning policy: when changed pages are written back, explored in step 5
              opts: ['<b>Demand cleaning</b>: only when the page is chosen for replacement.', '<b>Precleaning</b>: ahead of time, in batches.'],  // its two options: demand cleaning and precleaning
              desk: 'copy your notes back into the library book only when you return it, or every so often?' },  // its library-desk analogy
            { k: 'load', name: 'Load control', q: 'How many processes share memory?', col: 'os', step: 8,  // load control: how many processes share memory, explored in step 8
              opts: ['Sets the <b>multiprogramming level</b>.', 'Too few: the processor idles. Too many: <b>thrashing</b>.', 'When it must drop, pick a process to suspend.'],  // its options: the multiprogramming level, idling versus thrashing, suspending a process
              desk: 'how many readers fit in the room before nobody can work?' },  // its library-desk analogy
          ];  // closes the list of policy areas
          const info = h('div', { class: 'card tight', style: { minHeight: '136px', flex: 'none' } });  // info: the card that describes the chosen policy; its minimum height keeps the layout from jumping
          const btns = {};  // btns: the six policy buttons, by key, so the chosen one can be lit up
          function pick(k) {  // pick(k): shows the details of policy k when its button is clicked
            const p = P.find((x) => x.k === k);  // p: the chosen policy's entry in P
            Object.entries(btns).forEach(([kk, b]) => b.classList.toggle('on', kk === k));  // lights up the chosen button and no other
            info.innerHTML = `<div class="row" style="gap:8px;margin-bottom:4px"><span class="chip ${p.col}">${p.name}</span><b>${p.q}</b></div>` +  // the card's first line: a coloured chip with the policy's name, and its question
              `<ul class="m0 small" style="line-height:1.45">${p.opts.map((o) => '<li>' + o + '</li>').join('')}</ul>` +  // then its options as a bullet list
              `<div class="xs muted" style="margin-top:6px">Library-desk version: ${p.desk} · Explored in step ${p.step}.</div>`;  // then the library-desk analogy and which step explores it
          }  // ends pick
          const grid = h('div', { class: 'grid-3', style: { gap: '10px' } }, ...P.map((p) => {  // grid: the six policy buttons in three columns
            const b = h('button', { class: 'btn ' + p.col, style: { height: 'auto', minHeight: '74px', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', whiteSpace: 'normal', textAlign: 'left', padding: '8px 12px', gap: '2px' }, onclick: () => pick(p.k) },  // each button is tall, left-aligned and coloured like its policy area; a click calls pick
              h('span', { class: 'b', style: { fontSize: '15.5px' } }, p.name), h('span', { class: 'small', style: { color: 'var(--ink-2)', fontWeight: 500 } }, p.q));  // the button's text: the policy's name in bold, its question below in smaller type
            btns[p.k] = b;  // keeps the button so pick can light it up
            return b;  // hands the button to the grid
          }));  // closes the grid
          info.innerHTML = '<b>Click any of the six policies.</b> <span class="muted small">Each one is a separate decision the OS makes, and each changes how often processes fault or how much each fault costs.</span>';  // the card's text before any click: a prompt to click a policy
          el.append(h('div', { class: 'split l fill' },  // lays out the step: explanation on the left, the policy grid on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column
              h('p', { class: 'lead m0', html: 'Section 8.1 showed the hardware that makes <span class="t">virtual memory</span> possible. The rest is software: decisions the operating system makes every time a process needs a page.' }),  // lead paragraph: the hardware came in section 8.1; this section is about the software decisions
              h('p', { class: 'm0 small', html: 'Designers first settle three things: whether to use virtual memory at all (a tiny embedded system may not), whether to use <span class="t">paging</span>, segmentation or both (largely fixed by the hardware), and which algorithm to use for each policy. Only the last is pure OS software, and it is the subject of this section.' }),  // paragraph: the three choices designers make, of which only the algorithms are pure OS software
              h('div', { class: 'card stack gap-s', style: { padding: '10px 12px', flex: 'none' } },  // card listing the three costs of a page fault
                h('h4', { class: 'm0' }, 'Why every fault is expensive'),  // the card's heading
                h('div', { class: 'small', style: { lineHeight: '1.45' }, html: '<b>1.</b> The OS runs code to <b>choose a page to evict</b> and update its tables.<br><b>2.</b> It does <b>disk I/O</b>: milliseconds, the time of millions of instructions.<br><b>3.</b> It <b>blocks the process</b> and schedules another one meanwhile.' })),  // the three costs: OS code to pick a victim, disk I/O, and blocking the process
              h('div', { class: 'callout why m0 small', 'data-label': 'The goal of every policy: a low page fault rate', html: 'With memory accesses at about 100 ns and a <span class="t">page fault</span> at about 8 ms, one fault every 100,000 references nearly doubles a program’s run time.' })),  // callout: the goal of every policy, with numbers showing how even rare faults double the run time
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'The six policy areas'), h('span', { class: 'xs muted' }, 'Goal: few page faults, little overhead')),  // heading row: "The six policy areas" with the goal on the right
              grid, info,  // the button grid and the details card
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'Main memory is a small desk; the disk is a big library. Each policy answers one question about using the desk well, from what to fetch to how many readers share the room.' }))));  // analogy box: memory as a small desk, the disk as a big library
        },  // ends render for step 1
      },  // ends step 1
      /* ---------------- 2. Fetch policy (demand paging vs prepaging) and placement ---------------- */
      {  // opens step 2, fetch and placement
        title: 'Fetch and placement: when a page comes in, and where',  // step 2's title
        kind: 'explore',  // kind explore: an interactive step
        render(el, ctx) {  // render(): draws step 2 into el when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG ones
          // a 24-page process: code in pages 0-5, data in 10-12, stack in 20; it starts in code, then moves on
          const REFS = [0, 1, 0, 2, 1, 3, 2, 0, 10, 11, 10, 0, 11, 1, 20, 2, 20, 3, 4, 5, 4, 12, 5, 4, 12, 20, 5, 4, 0, 1];  // REFS: the 30 references the process makes, in order
          const NP = 24, T = REFS.length;  // NP: the process has 24 pages; T: the number of references
          // geometry: one long row on a wide screen; on a phone the string and the disk wrap onto two rows each
          const G = ctx.narrow  // G: every size and position in the drawing, one set for a phone and another for a wide screen
            ? { W: 360, H: 402, rPer: 15, rX: 24, rCW: 22, X0: 32, CW: 10, base: 222, dTitle: 270, dPer: 12, dY: 278, legY: 346 }  // phone sizes: a taller drawing, 15 references per row, the disk pages in rows of 12
            : { W: 650, H: 262, rPer: 30, rX: 34, rCW: 20, X0: 34, CW: 20, base: 166, dTitle: 194, dPer: 24, dY: 202, legY: 240 };  // wide-screen sizes: all 30 references in one row, all 24 disk pages in one row
          const demand = prepage(REFS, 1, NP);  // demand: the same string under pure demand paging (one page per fault), the baseline to compare with
          const K = ctx.keep.fetch || (ctx.keep.fetch = { k: 4 });  // K: this step's setting, kept in ctx.keep so a phone-width or desktop redraw hands it back (a normal visit starts at 4)
          let k = K.k;  // k: how many pages each disk read brings in, set by the slider (4 on a fresh visit)
          const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%' });  // the drawing
          const layer = s('g');  // layer: a group holding everything that changes with the slider
          const Y = (v) => G.base - v * 9.2, XT = (t) => G.X0 + t * G.CW;  // Y(v): the height for v faults on the chart; XT(t): the position of time t along it
          const rPos = (t) => [G.rX + (t % G.rPer) * G.rCW, 22 + Math.floor(t / G.rPer) * 32];  // rPos(t): where reference t's box sits in the reference string, wrapping onto new rows
          const dPos = (q) => [G.X0 + (q % G.dPer) * 25, G.dY + Math.floor(q / G.dPer) * 32];  // dPos(q): where disk page q sits in the row of disk pages
          const legend = (x, y, cls, txt) => [s('rect', { x, y: y - 11, width: 13, height: 13, rx: 3, class: cls }), s('text', { x: x + 18, y, 'font-size': 12.5, class: 's-sub' }, txt)];  // legend(): a small coloured square with its explanation beside it
          const axes = [  // axes: the parts of the drawing that never change
            s('text', { x: 0, y: 14, 'font-size': 13, 'font-weight': 700 }, 'Reference string, virtual time 1 → 30'),  // title over the reference string
            ...(ctx.narrow ? [...legend(0, 102, 's-bad', 'page fault'), ...legend(100, 102, 's-accent', 'prepaged earlier: no fault')]  // on a phone, the two colour keys for the string go on their own line below it
              : [...legend(300, 14, 's-bad', 'page fault'), ...legend(398, 14, 's-accent', 'prepaged earlier, so no fault')]),  // on a wide screen they sit at the right of the title
            s('line', { x1: G.X0, x2: XT(T), y1: Y(0), y2: Y(0), class: 's-muted' }),  // the chart's horizontal axis
            s('line', { x1: G.X0, x2: G.X0, y1: Y(0), y2: Y(10.5), class: 's-muted' }),  // the chart's vertical axis
            s('text', { x: G.X0 - 6, y: Y(10) + 5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, '10'),  // tick label 10 on the vertical axis
            s('text', { x: G.X0 - 6, y: Y(5) + 5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, '5'),  // tick label 5
            s('text', { x: G.X0 - 6, y: Y(0) + 5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, '0'),  // tick label 0
            s('text', { x: G.X0 + 8, y: Y(10.5) + 4, 'font-size': 13, 'font-weight': 700 }, 'Faults so far'),  // the chart's title, at the top of the vertical axis
            s('text', { x: 0, y: G.dTitle, 'font-size': 13, 'font-weight': 700 }, 'The process’s 24 pages, stored in order on disk'),  // title over the row of disk pages
          ];  // closes the fixed parts
          svg.append(...axes, layer);  // puts the fixed parts and the changing layer into the drawing
          const tiles = h('div', { class: 'grid-4', style: { gap: '8px' } });  // tiles: the four number cards below the drawing
          const narr = h('div', { class: 'card tight small', style: { minHeight: '64px' } });  // narr: the explanation card; its minimum height keeps the layout steady
          function draw() {  // draw(): reruns the fetch model with the current k and redraws, after every slider move
            const r = prepage(REFS, k, NP), kids = [];  // r: the run with k pages per read; kids collects the new shapes
            K.k = k;  // records the slider's value in K, so a phone-width or desktop redraw keeps it
            const early = new Set();      // references that hit only because prepaging brought the page in early
            const seenFirst = new Set();  // seenFirst: pages already referenced once, so only a page's first reference can count as early
            r.steps.forEach((st) => { if (!st.fault && !seenFirst.has(st.page) && r.loadedBy[st.page] !== undefined) { const op = r.steps[r.loadedBy[st.page]]; if (op.page !== st.page) early.add(st.t); } seenFirst.add(st.page); });  // a first reference with no fault, whose page came in on another page's fault, is marked as saved by prepaging
            r.steps.forEach((st, t) => {  // draws the reference string
              const cls = st.fault ? 's-bad' : early.has(t) ? 's-accent' : 's-panel', [x, y] = rPos(t);  // red for a fault, accent for a reference saved by prepaging, plain otherwise; x and y place the box
              kids.push(s('rect', { x: x + 1, y, width: G.rCW - 2, height: 26, rx: 4, class: cls, 'stroke-width': 1 }),  // the reference's box
                s('text', { x: x + G.rCW / 2, y: y + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot' }, String(st.page)));  // the page number inside it, in fixed-width type
            });  // ends the reference string
            const line = (res, cls, dash) => s('polyline', { points: [[0, 0]].concat(res.steps.map((st, t) => [t + 1, st.faults])).map(([t, v]) => `${XT(t)},${Y(v)}`).join(' '), fill: 'none', 'stroke-width': cls ? 3 : 2, style: cls || 'stroke:var(--line-2)', 'stroke-dasharray': dash || '' });  // line(): the running count of faults as a line on the chart, starting from 0 at time 0
            kids.push(line(demand, '', '5 4'));  // the dashed grey line: demand paging
            if (k > 1) kids.push(line(r, 'stroke:var(--accent)'));  // with k above 1, the solid accent line: prepaging
            kids.push(s('text', { x: XT(T) + 4, y: Y(demand.faults) + 4, 'font-size': 12.5, class: 's-sub' }, demand.faults + ''));  // the final fault count for demand paging, at the right end of its line
            if (k > 1) kids.push(s('text', { x: XT(T) + 4, y: Y(r.faults) + 4, 'font-size': 12.5, 'font-weight': 700, class: 'tx-acc' }, r.faults + ''));  // the final fault count for prepaging, in bold accent, at the end of its line
            const key = k > 1 ? '(dashed: demand paging, solid: prepaging)' : '(demand paging)';  // key: explains which line is which
            kids.push(ctx.narrow ? s('text', { x: G.X0, y: Y(0) + 18, 'font-size': 12.5, class: 's-sub' }, key) : s('text', { x: G.X0 + 108, y: Y(10.5) + 4, 'font-size': 12.5, class: 's-sub' }, key));  // puts the key under the chart on a phone, or beside the chart's title on a wide screen
            const used = new Set(REFS);  // used: every page the process actually references
            for (let q = 0; q < NP; q++) {  // draws the 24 pages on disk
              const read = r.loadedBy[q] !== undefined, cls = !read ? 's-panel' : used.has(q) ? 's-mem' : 's-warn', [x, y] = dPos(q);  // a page never read stays plain; read and used is memory-coloured; read but never used is amber (wasted)
              kids.push(s('rect', { x, y, width: 23, height: 26, rx: 4, class: cls, 'stroke-width': 1.2 }),  // the page's box
                s('text', { x: x + 11.5, y: y + 18, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-monot' }, String(q)));  // the page number inside it
            }  // ends the disk pages
            const L = G.legY;  // L: where the legend for the disk row starts
            kids.push(...(ctx.narrow  // on a phone, the legend's three keys stack on separate lines
              ? [...legend(G.X0, L + 11, 's-mem', 'read from disk and used'), ...legend(G.X0, L + 30, 's-warn', 'read but never used (wasted)'), ...legend(G.X0, L + 49, 's-panel', 'never read')]  // keys: read and used, read but wasted, never read
              : [...legend(G.X0, L + 11, 's-mem', 'read from disk and used'), ...legend(G.X0 + 190, L + 11, 's-warn', 'read but never used (wasted)'), ...legend(G.X0 + 420, L + 11, 's-panel', 'never read')]));  // on a wide screen the three keys sit side by side on one line
            layer.replaceChildren(...kids);  // replaces the old changing shapes with the new ones
            const tile = (lab, val, sub, c) => h('div', { class: 'card tight', style: { padding: '6px 10px' } }, h('div', { class: 'xs muted b' }, lab), h('div', { class: 'b ' + (c || ''), style: { fontSize: '24px', lineHeight: '1.15' } }, val), h('div', { class: 'xs muted' }, sub));  // tile(): one number card with a label, a big value and a note; c adds a colour class
            tiles.replaceChildren(  // rebuilds the four tiles
              tile('Page faults', String(r.faults), k > 1 ? `demand paging: ${demand.faults}` : 'each one blocks the process', r.faults < demand.faults ? 'c-ok' : ''),  // tile: page faults, compared with demand paging, in green when prepaging saved some
              tile('Disk reads', String(r.ops), `${r.read} pages in all`),  // tile: disk operations, and how many pages they read in all
              tile('Disk time', ctx.util.fmt(r.ms, 1) + ' ms', `${r.ops} × ${SEEK} ms + ${r.read} × ${XFER} ms`),  // tile: total disk time, with the sum that produces it
              tile('Wasted pages', String(r.wasted.length), r.wasted.length ? 'read, never used' : 'all were used', r.wasted.length ? 'c-warn' : 'c-ok'));  // tile: pages read but never used, amber when there are any
            const firstHalf = demand.steps.slice(0, 10).filter((x) => x.fault).length;  // firstHalf: how many of demand paging's faults fall in the first 10 references
            narr.innerHTML = k === 1  // the explanation depends on the slider
              ? `<b>Demand paging</b>: one disk read per fault. ${firstHalf} of the ${demand.faults} faults come in the first 10 references; once the pages in use have arrived, the <span class="t">principle of locality</span> keeps the process running with few new faults. Drag the slider to prepage.`  // with 1 page per read: demand paging, its burst of faults at the start, and a hint to drag the slider
              : `<b>Prepaging ${k} pages per read</b>: each fault also brings in the next ${k - 1} pages on disk, in the same disk operation. Faults drop from ${demand.faults} to ${r.faults} and disk time from ${ctx.util.fmt(demand.ms, 1)} to ${ctx.util.fmt(r.ms, 1)} ms` +  // with more: how many pages each read brings, and how faults and disk time drop
                (r.wasted.length ? `, but pages ${listOf(r.wasted.map(String))} were read and never used: memory spent for nothing.` : ', and every extra page read was used.');  // then either which pages were wasted, or that every extra page was used
          }  // ends draw
          const sl = ctx.ui.slider({ label: 'Pages read per fault', min: 1, max: 8, value: k, format: (v) => (v === 1 ? '1 (demand paging)' : v + ' (prepaging)'), onInput: (v) => { k = v; draw(); } });  // slider for k, pages read per fault, 1 to 8; its readout says demand paging or prepaging
          draw();  // draws the first picture
          el.append(h('div', { class: 'split l fill' },  // lays out the step: explanation on the left, the simulation on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column
              h('p', { class: 'm0', html: 'The <span class="t">fetch policy</span> decides <b>when</b> a page is brought into main memory.' }),  // paragraph: the fetch policy decides when a page comes in
              h('div', { class: 'card tight small', style: { lineHeight: '1.45' }, html: '<b class="c-mem">Demand paging</b>: read a page only when the process references it. A new process faults a lot at first, then far less once the pages it is using have arrived.<br><b class="c-mem">Prepaging</b>: on a fault, also read other pages, usually the ones stored right after it on disk. Positioning the disk costs far more than transferring one more page, so a run of pages costs little more than one. Pages never used are wasted. (Current systems do versions of this, often called read-ahead or fault clustering.)' }),  // card: demand paging and prepaging explained, and why a run of pages costs little more than one
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Prepaging is not <span class="t">swapping</span>. Swapping moves a whole process out of memory and back; prepaging only reads a few extra pages for a process that is running.' }),  // warning box: prepaging is not swapping
              h('div', { class: 'card tight small', style: { lineHeight: '1.45' }, html: '<b class="c-mem"><span class="t">Placement policy</span></b>: <b>where</b> the piece goes. For pure segmentation it matters (first-fit, best-fit, as in chapter 7). For paging it does not: the translation hardware makes every frame equally good. One exception: on a NUMA (non-uniform memory access) multiprocessor, memory near the processor running the process is faster, so the OS prefers frames there.' })),  // card: the placement policy, and the NUMA exception
            h('div', { class: 'stack', style: { gap: '8px' } }, sl, h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), tiles, narr,  // right column: the slider, the drawing on a white card, the tiles and the explanation
              h('p', { class: 'xs muted m0' }, `Disk times use rough hard-disk figures: ${SEEK} ms to reach the data, ${XFER} ms to transfer each page. An SSD is far faster at both, but one larger read still costs less than several small ones.`))));  // small print: the disk timings assumed, and why the idea still holds for SSDs
        },  // ends render for step 2
      },  // ends step 2
      /* ---------------- 3. Replacement: one fault, four answers (predict) ---------------- */
      {  // opens step 3, predicting which page each policy evicts
        title: 'Choosing a victim: one fault, four classic answers',  // step 3's title
        kind: 'predict',  // kind predict: the student guesses before seeing the answer
        render(el, ctx) {  // render(): draws step 3 into el when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG ones
          // three frames for the process (shown as frames 1-3); frame 0 is a locked kernel I/O buffer
          const REFS = [1, 4, 3, 4, 3, 5, 4, 5, 2, 4, 3, 2, 3], NOW = 8;   // NOW = index of the reference that faults
          const sims = Object.fromEntries(Object.keys(POL).map((p) => [p, simulate(p, REFS, 3)]));  // sims: all four policies run on REFS with 3 frames, keyed by policy name
          const before = sims.clock.steps[NOW - 1];  // before: the clock's snapshot just before the fault; up to here all four policies hold the same pages, and clock also has use bits and a pointer
          const loadedAt = [0, 0, 0], lastUse = [0, 0, 0];  // loadedAt and lastUse: when each frame's page arrived and when it was last used (times counting from 1)
          sims.fifo.steps.slice(0, NOW).forEach((st) => { if (!st.hit) loadedAt[st.slot] = st.t + 1; lastUse[st.slot] = st.t + 1; });  // fills them in by replaying the references before the fault
          const pages = before.frames;  // pages: the page in each of the three frames at the moment of the fault
          const nextUse = pages.map((q) => { const i = REFS.indexOf(q, NOW + 1); return i < 0 ? null : i + 1; });  // nextUse: when each of those pages is next referenced after now, or null if never
          const COL = { opt: 3, lru: 2, fifo: 1, clock: 4 };   // which fact column each policy looks at
          const K = ctx.keep.pick || (ctx.keep.pick = { pol: 'opt', result: {}, last: null });  // K: this step's state (chosen policy, score, the frame last clicked), kept in ctx.keep so a phone-width or desktop redraw hands it back
          let pol = K.pol;  // pol: the policy chosen with the switch (OPT on a fresh visit)
          const result = K.result;  // result: each policy's first guess, true when right, false when wrong (the very object kept in K)
          // a phone gets slimmer columns and the three labels on two lines, so the text keeps a readable size
          const TW = ctx.narrow ? 360 : 640, CW = ctx.narrow ? 24 : 40, X0 = ctx.narrow ? 44 : 60;  // TW: drawing width; CW: column width per reference; X0: where the first reference sits
          const svg = s('svg', { viewBox: `0 0 ${TW} ${ctx.narrow ? 92 : 74}`, width: '100%' });  // the drawing of the reference string, a little taller on a phone so the labels fit
          svg.append(s('text', { x: 0, y: 41, 'font-size': 13, 'font-weight': 700 }, 'Page'), s('text', { x: 0, y: 16, 'font-size': 12.5, class: 's-sub' }, 'time t'));  // the row labels: Page for the boxes, time t for the numbers above them
          REFS.forEach((q, i) => {  // one column per reference: q is the page, i its position
            const past = i < NOW, now = i === NOW;  // past: before the fault; now: the faulting reference itself
            svg.append(s('text', { x: X0 + i * CW + CW / 2, y: 16, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(i + 1)),  // the time number above the box (counting from 1)
              s('rect', { x: X0 + i * CW + 2, y: 22, width: CW - 4, height: 28, rx: 5, class: now ? 's-bad' : past ? 's-panel' : 's-accent', 'stroke-width': now ? 2.5 : 1, 'stroke-dasharray': past || now ? '' : '4 3' }),  // the box: red for now, plain for the past, dashed accent for the future
              s('text', { x: X0 + i * CW + CW / 2, y: 41, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': now ? 800 : 600, class: past || now ? '' : 'tx-acc' }, String(q)));  // the page number in the box, bold for now and accent-coloured in the future
          });  // ends the reference string
          svg.append(s('text', { x: X0 + 4, y: 68, 'font-size': 12.5, class: 's-sub' }, '← past references (known)'),  // labels under the string: the past is known
            s('text', ctx.narrow ? { x: X0 + NOW * CW - 2, y: 68, 'font-size': 12.5, 'font-weight': 800, class: 'tx-bad' } : { x: X0 + NOW * CW + CW / 2 - 8, y: 68, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, class: 'tx-bad' }, 'now: fault on ' + REFS[NOW]),  // the fault happening now, placed under its box (left-aligned on a phone so it fits)
            s('text', { x: TW, y: ctx.narrow ? 86 : 68, 'text-anchor': 'end', 'font-size': 12.5, class: 'tx-acc' }, 'future: only OPT may look →'));  // the future, which only OPT may look at (on its own line on a phone)
          const table = h('table', { class: 'tbl compact' });  // table: the frames with the facts each policy uses
          const res = h('div', { class: 'card tight small', style: { minHeight: '104px', lineHeight: '1.45' } });  // res: the feedback card after a guess; its minimum height keeps the layout steady
          const score = h('div', { class: 'row', style: { gap: '6px' } });  // score: chips showing the first guess for each policy
          function why(p) {  // why(p): the explanation of policy p's choice, shown after a guess
            const st = sims[p].steps[NOW], F = (i) => 'frame ' + (i + 1), v = st.slot;  // st: policy p's snapshot at the fault; F(i) names frame i as shown (frames are numbered from 1 here); v is the victim's frame
            if (p === 'opt') return `<b>OPT looks ahead.</b> Next uses: ${pages.map((q, i) => `page ${q} ${nextUse[i] ? 'at t = ' + nextUse[i] : '<b>never again</b>'}`).join(', ')}. The page needed farthest in the future is page ${st.victim}, so it goes from ${F(v)}. No real OS can do this: it would have to know the future.`;  // OPT: lists each page's next use, picks the farthest, and notes that no real OS can know it
            if (p === 'lru') return `<b>LRU looks back.</b> Last used: ${pages.map((q, i) => `page ${q} at t = ${lastUse[i]}`).join(', ')}. Page ${st.victim} has gone unused the longest, so it goes from ${F(v)}.`;  // LRU: lists each page's last use and picks the one unused longest
            if (p === 'fifo') return `<b>FIFO looks only at arrival times.</b> Loaded: ${pages.map((q, i) => `page ${q} at t = ${loadedAt[i]}`).join(', ')}. Page ${st.victim} is the oldest, so it goes from ${F(v)}, even though it was used at t = ${lastUse[v]} and is needed again at t = ${nextUse[v]}.`;  // FIFO: lists load times and picks the oldest, pointing out it was used recently and is needed again soon
            const steps = st.passed.map((i) => `Frame ${i + 1} (page ${pages[i]}) has use bit 1: clear it and move on.`);  // clock: one sentence per frame passed, saying its use bit was cleared
            return `<b>Clock starts at the pointer, ${F(st.ptrBefore)}.</b> ${steps.join(' ')} Frame ${v + 1} (page ${st.victim}) has use bit 0: it is the victim. The pointer then moves to ${F(st.ptr)}.`;  // clock: where the pointer started, the frames passed, the victim with use bit 0, and where the pointer goes next
          }  // ends why
          // the table is built once (so its buttons stay put); choosing a policy only re-highlights a column
          const ths = ['Frame', 'Page', 'Loaded at', 'Last used', 'Next use', 'Use bit'].map((x) => h('th', {}, x));  // ths: the column headings, kept so the chosen policy's column can be tinted
          const rows = [h('tr', {}, h('td', {}, h('button', { class: 'btn sm', onclick: () => guess(-1) }, 'Frame 0')),  // first row: a button for frame 0, the locked one
            h('td', { colspan: 5, class: 'small muted', html: '<b class="c-os">Locked</b>: kernel I/O buffer (lock bit = 1), never a candidate' }))];  // which says the frame is a locked kernel I/O buffer, never a candidate
          pages.forEach((q, i) => rows.push(h('tr', {},  // one row per process frame
            h('td', {}, h('button', { class: 'btn sm', onclick: () => guess(i) }, 'Frame ' + (i + 1))),  // a button naming the frame (numbered from 1); clicking it is the guess
            h('td', { class: 'b' }, 'page ' + q),  // the page in it
            h('td', { class: 'num' }, 't = ' + loadedAt[i]),  // when it was loaded
            h('td', { class: 'num' }, 't = ' + lastUse[i]),  // when it was last used
            h('td', { class: 'num' }, nextUse[i] ? 't = ' + nextUse[i] : 'never'),  // when it is next used, or never
            h('td', { class: 'num' }, String(before.use[i]) + (before.ptr === i ? '  ← pointer' : '')))));  // its use bit, with an arrow on the frame the clock pointer is at
          table.append(h('thead', {}, h('tr', {}, ...ths)), h('tbody', {}, ...rows));  // puts the heading row and the body rows into the table
          function drawTable() {  // drawTable(): tints the heading of the column the chosen policy looks at
            ths.forEach((th, i) => { const on = i === COL[pol] + 1; th.style.background = on ? 'var(--accent-bg)' : ''; th.style.color = on ? 'var(--accent)' : ''; });  // the column is COL[pol] + 1 because the Frame column comes first
          }  // ends drawTable
          function drawScore() {  // drawScore(): rebuilds the chips showing whether each first guess was right
            score.replaceChildren(h('span', { class: 'small b' }, 'Your first predictions:'), ...Object.keys(POL).map((p) => h('span', { class: 'chip ' + (result[p] === true ? 'ok' : result[p] === false ? 'bad' : '') }, POL[p] + (result[p] === true ? ' ✓' : result[p] === false ? ' ✗' : ' ?'))));  // a label, then one chip per policy: green with a tick when right, red with a cross when wrong, a question mark if not tried
          }  // ends drawScore
          function guess(i) {  // guess(i): the student clicked frame i (i = -1 is the locked frame 0)
            K.last = i;  // records the click in K, so a phone-width or desktop redraw shows the same feedback again
            if (i < 0) { res.innerHTML = '<b class="c-os">Frame 0 is locked.</b> Its lock bit tells every replacement policy to skip it: the kernel’s I/O buffer must stay put while a device may be transferring into it.'; return; }  // the locked frame is never a victim: explains why and stops
            const st = sims[pol].steps[NOW], ok = st.slot === i;  // st: the chosen policy's snapshot at the fault; ok: the student picked the frame it actually evicts
            if (result[pol] === undefined) result[pol] = ok;  // only the first guess for each policy is recorded in the score
            res.innerHTML = (ok ? `<b class="c-ok">Right: ${POL[pol]} evicts page ${st.victim}.</b> ` : `<b class="c-bad">Not quite: ${POL[pol]} keeps page ${pages[i]} and evicts page ${st.victim}.</b> `) + why(pol);  // feedback: right or not quite, naming the evicted page, followed by the policy's explanation
            drawScore();  // updates the score chips
          }  // ends guess
          function choose(p) {  // choose(p): switches to policy p
            pol = K.pol = p; K.last = null; drawTable();  // records it (in K too, with no frame clicked yet for it) and tints its column
            res.innerHTML = `<b>Predict:</b> click the frame you think <b>${POL[p]}</b> evicts. <span class="muted">The highlighted column is the fact ${POL[p]} uses. Try all four algorithms: they do not all agree.</span>`;  // the prompt to predict, reminding the student that the policies do not all agree
          }  // ends choose
          const seg = ctx.ui.seg(Object.keys(POL).map((p) => ({ value: p, label: POL[p] })), pol, choose);  // switch for choosing the policy to predict
          const back = K.last;  // back: the frame clicked before a phone-width or desktop redraw (null on a fresh visit); read now because choose clears it
          choose(pol); drawScore();  // shows the chosen policy (OPT on a fresh visit) and the score so far (empty on a fresh visit)
          if (back !== null) guess(back);  // after a redraw, repeats the last click so its feedback shows again (the score only ever records a first guess, so it is unchanged)
          el.append(h('div', { class: 'split l fill' },  // lays out the step: explanation on the left, the prediction game on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column
              h('p', { class: 'm0', html: 'When a page must come in and every frame is full, the <span class="t">replacement policy</span> picks a victim. The ideal victim is the page least likely to be referenced soon. Nobody knows the future, so real policies predict it from the recent past, which works because of locality.' }),  // paragraph: what the replacement policy does, and why predicting from the recent past works
              h('div', { class: 'card tight small', style: { lineHeight: '1.5' }, html:  // card: one line per algorithm
                '<b><span class="t">OPT</span></b>: evict the page whose next use is farthest away.<br>' +  // OPT's rule
                '<b><span class="t">LRU</span></b>: evict the page unused for the longest time (exact LRU must timestamp every reference or keep a stack of pages: costly).<br>' +  // LRU's rule, and why exact LRU is costly
                '<b><span class="t">FIFO</span></b>: treat the frames as a circular buffer and evict the page in memory longest.<br>' +  // FIFO's rule
                '<b><span class="t" data-t="Clock policy">Clock</span></b>: sweep a pointer round the frames; skip (and clear) pages whose <span class="t">use bit</span> is 1, evict the first with 0. If every bit is 1, it goes all the way round.' }),  // the clock's rule, including the full trip round when every use bit is 1
              h('div', { class: 'callout why m0 small', 'data-label': 'Frame locking', html: 'Some frames must never be evicted: most of the kernel, key control structures, I/O buffers in use and time-critical code. A <b>lock bit</b> per frame marks them, and every policy simply skips them (<span class="t">frame locking</span>).' })),  // callout: frame locking, which frames are locked and why every policy skips them
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),  // the reference string drawing on a white card
              h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b' }, 'Algorithm:'), seg),  // the algorithm switch with its label
              table, res, score)));  // then the frame table, the feedback card and the score chips; closes the layout
        },  // ends render for step 3
      },  // ends step 3
      /* ---------------- 4. The replacement lab: OPT, LRU, FIFO and clock side by side ---------------- */
      {  // opens step 4, the replacement lab
        title: 'Replacement lab: OPT, LRU, FIFO and clock side by side',  // step 4's title
        kind: 'lab',  // kind lab: a hands-on experiment
        core: true,  // core: true keeps this step on the shorter core path through the course
        render(el, ctx) {  // render(): draws step 4 into el when the student arrives on it
          const { h } = ctx;  // h builds HTML elements
          const EXAMPLE = '3 4 5 2 4 3 4 1 4 2 3 2 4 1', BELADY = '1 2 3 4 1 2 5 1 2 3 4 5';  // EXAMPLE: the starting reference string; BELADY: the classic string that shows Belady's anomaly under FIFO
          const DESC = { opt: 'evicts the page whose next use is farthest away', lru: 'evicts the page unused for the longest time', fifo: 'evicts the page in memory the longest', clock: 'evicts the first page with use bit 0, starting at the pointer' };  // DESC: a one-line rule for each policy, shown on its card before the animation starts
          const K = ctx.keep.lab || (ctx.keep.lab = { refs: parseRefs(EXAMPLE).refs, typed: EXAMPLE, n: 3, frame: 0 });  // K: the lab's state (the string being run, the text in the box, the frame count, the player's frame); it lives in ctx.keep, so a phone-width or desktop redraw hands it back, while a normal visit starts fresh
          let refs = K.refs, n = K.n, sims = {};  // refs: the references being run; n: the number of frames (3 on a fresh visit); sims: each policy's simulation
          const cards = {}, svgBox = {}, chips = {}, notes = {};  // per-policy parts: the card, the box its grid goes in, its fault-count chip and its reason text
          for (const p of Object.keys(POL)) {  // builds one card per policy
            chips[p] = h('span', { class: 'chip' });  // the chip showing the fault count
            svgBox[p] = h('div');  // the box that holds the grid drawing
            notes[p] = h('span', { class: 'small grow', style: ctx.narrow ? { minWidth: '0' } : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } });   // a phone wraps the reason instead of cutting it
            cards[p] = h('div', { class: 'card white', style: { padding: '5px 8px 4px' } },  // the card: a header row (name, reason, fault chip) above the grid
              h('div', { class: 'row nw', style: { gap: '8px' } }, h('b', {}, POL[p]), notes[p], chips[p]),  // the header row, kept on one line
              svgBox[p]);  // the grid box under it
          }  // ends the card loop
          const inp = h('input', { type: 'text', value: K.typed, spellcheck: 'false', 'aria-label': 'Reference string', class: 'mono',  // inp: the text box where the student types a reference string, showing the kept text (the example on a fresh visit); spellcheck is off since it holds numbers
            style: { width: '330px', height: '32px', fontSize: '14px', padding: '0 8px', borderRadius: '8px', border: '2px solid var(--line-2)', background: 'var(--panel)', color: 'var(--ink)' } });  // its look: fixed width, rounded corners and colours that follow the theme
          const strip = h('div', { class: 'small', style: { minHeight: '22px' } });  // strip: the line showing FIFO's fault counts for 1 to 5 frames
          const segN = ctx.ui.seg([1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })), n, (v) => { n = v; rebuild(); });  // segN: switch for the number of frames, 1 to 5; choosing one reruns everything
          function anomalyStrip() {  // anomalyStrip(): checks the current string for Belady's anomaly under FIFO
            const counts = [1, 2, 3, 4, 5].map((m) => simulate('fifo', refs, m).faults);  // runs FIFO with 1, 2, 3, 4 and 5 frames and keeps each fault count
            const bad = counts.map((c, i) => i > 0 && c > counts[i - 1]);  // bad: marks each count that went up compared with one frame fewer
            strip.innerHTML = '<b>FIFO faults with 1, 2, 3, 4, 5 frames:</b> ' + counts.map((c, i) => `<span class="${bad[i] ? 'chip bad' : 'mono'}">${c}</span>`).join(' · ') +  // writes the counts, any rising one in a red chip
              (bad.some(Boolean) ? ' <span class="b c-bad">← more frames, more faults: Belady’s anomaly</span>' : ' <span class="muted">(never rising here; LRU and OPT can never rise)</span>');  // then either flags Belady's anomaly, or notes that the counts never rise here
          }  // ends anomalyStrip
          function caption(i) {  // caption(i): the player's caption for animation frame i
            if (i === 0) return `<b>All ${n} frames start empty.</b> Press Play or step forward. Each grid runs left to right in time, one row per frame (F0…). <span class="c-bad b">Red</span> = page just loaded by a fault, <span class="c-ok b">green</span> = hit. In the clock grid a dot is the <span class="t">use bit</span> (filled = 1) and the arrow is the pointer.`;  // frame 0: the frames start empty, plus how to read the grids and the clock's dots and arrow
            const t = i - 1, faulted = Object.keys(POL).filter((p) => !sims[p].steps[t].hit);  // t: the reference shown (frame i shows reference i - 1); faulted: the policies that fault on it
            const head = `<b>t = ${i}: page ${refs[t]} is referenced.</b> ` + (faulted.length ? `${faulted.length === 4 ? 'All four' : listOf(faulted.map((p) => POL[p]))} ${faulted.length === 1 ? 'faults' : 'fault'}; each card says why.` : 'It is resident under every policy: four hits.');  // head: which page is referenced and which policies fault, or that it is a hit for all four
            if (i < refs.length) return head;  // before the last reference, that is the whole caption
            const order = Object.keys(POL).sort((a, b) => sims[a].faults - sims[b].faults);  // order: the policies sorted from fewest faults to most
            return `<b>t = ${i}, the end.</b> Total faults: ${order.map((p) => POL[p] + ' ' + sims[p].faults).join(', ')}. The first loads into empty frames count too. Change the string or the frames and run it again.`;  // at the end: the total faults of each policy, best first, and a reminder that the first loads count
          }  // ends caption
          function render(i) {  // render(i): the player's render function: redraws all four cards for animation frame i
            for (const p of Object.keys(POL)) {  // for each policy
              svgBox[p].replaceChildren(gridSvg(ctx, refs, n, sims[p], p, i - 1));  // redraws its grid up to reference i - 1
              const f = i ? sims[p].steps[i - 1].faults : 0;  // f: its fault count so far
              notes[p].innerHTML = i ? say(p, sims[p].steps[i - 1]) : `<span class="muted">${DESC[p]}</span>`;  // its reason: what it just did, or its rule before the animation starts
              chips[p].className = 'chip ' + (i === refs.length ? 'accent' : '');  // at the end the chip turns accent-coloured
              chips[p].textContent = (i === refs.length ? 'total ' : '') + f + ' fault' + (f === 1 ? '' : 's');  // the chip's text: the fault count, with "total" at the end
            }  // ends the loop over the policies
            return caption(i);  // hands the caption to the player
          }  // ends render
          for (const p of Object.keys(POL)) sims[p] = simulate(p, refs, n);  // runs the four simulations for the starting string
          const player = ctx.ui.player({ count: refs.length + 1, render, interval: 1100, start: K.frame, onStep: (i) => { K.frame = i; } });  // the player: one frame for the start plus one per reference, advancing every 1.1 s; it opens on the kept frame (the first on a fresh visit) and records every frame change in K
          function rebuild() {  // rebuild(): reruns everything after the string or the number of frames changes
            K.refs = refs; K.n = n;  // records the new string and frame count in K, so a phone-width or desktop redraw keeps them
            for (const p of Object.keys(POL)) sims[p] = simulate(p, refs, n);  // reruns the four simulations
            anomalyStrip();  // refreshes the anomaly line
            player.setCount(refs.length + 1);  // resizes the player, which also jumps back to the start
          }  // ends rebuild
          function load(text, frames) {  // load(text, frames): reads a new string (and optionally a frame count) and reruns
            const r = parseRefs(text);  // r: the string read by parseRefs
            if (!r.refs.length) { ctx.toast('Type page numbers from 0 to 99, for example 1 2 3 1 4'); return; }  // nothing usable: a short message at the bottom of the screen (a toast) and no change
            refs = r.refs; inp.value = K.typed = refs.join(' ');  // uses the references, and rewrites the text box neatly with single spaces (also kept in K as the box's text)
            if (frames) { n = frames; segN.set(n); }  // when a frame count is given, it is set and the switch updated to match
            if (r.cut || r.skipped) ctx.toast(((r.skipped ? 'Only page numbers from 0 to 99 are used; the rest was skipped.' : '') + (r.cut ? ' Only the first 20 references are used.' : '')).trim());  // tells the student if some input was skipped or the string was cut to 20 references
            rebuild();  // reruns everything
          }  // ends load
          ctx.on(inp, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); load(inp.value); } });  // pressing Enter in the text box runs the string (ctx.on removes this listener when the step closes)
          ctx.on(inp, 'input', () => { K.typed = inp.value; });  // every keystroke records the box's text in K, so even a string not yet run survives a phone-width or desktop redraw
          const rnd = () => { const out = []; let cur = 1 + Math.floor(Math.random() * 6); for (let i = 0; i < 15; i++) { if (Math.random() < 0.35) cur = 1 + Math.floor(Math.random() * 6); out.push(Math.random() < 0.5 ? cur : 1 + Math.floor(Math.random() * 6)); } return out.join(' '); };  // rnd(): a random string of 15 references with some locality: a current page that changes now and then, mixed with random pages 1-6
          anomalyStrip();  // fills the anomaly line for the starting string
          el.append(h('div', { class: 'stack fill', style: { gap: '7px' } },  // lays out the step as one column
            h('div', { class: 'row', style: { gap: '8px' } },  // top row of controls
              h('span', { class: 'small b' }, 'Reference string'), inp,  // label and text box for the reference string
              h('button', { class: 'btn sm primary', onclick: () => load(inp.value) }, 'Run'),  // Run button: reads the text box
              h('span', { class: 'small b', style: { marginLeft: '6px' } }, 'Frames'), segN,  // label and switch for the number of frames
              h('div', { class: 'grow' }),  // an empty spacer that pushes the remaining buttons to the right
              h('button', { class: 'btn sm', onclick: () => load(EXAMPLE, 3) }, 'Example'),  // Example button: restores the starting string with 3 frames
              h('button', { class: 'btn sm', onclick: () => load(BELADY, n === 3 ? 4 : 3), title: 'Load the classic anomaly string; each click swaps between 3 and 4 frames' }, 'Belady (3 ⇄ 4)'),  // Belady button: loads the anomaly string, swapping between 3 and 4 frames on each click
              h('button', { class: 'btn sm', onclick: () => load(rnd()) }, 'Random')),  // Random button: loads a random string
            strip,  // the FIFO anomaly line
            h('div', { class: 'grid-2', style: { gap: '8px', flex: '1', minHeight: '0', alignContent: 'start' } }, cards.opt, cards.lru, cards.fifo, cards.clock),  // the four cards in a 2 by 2 grid
            player.el));  // the player at the bottom; closes the layout
        },  // ends render for step 4
      },  // ends step 4
      /* ---------------- 5. Modified pages: clock with an M bit, page buffering, cleaning ---------------- */
      {  // opens step 5, modified pages
        title: 'Modified pages: a smarter clock, page buffering, cleaning',  // step 5's title
        kind: 'explore',  // kind explore: an interactive step
        render(el, ctx) {  // render(): draws step 5 into el when the student arrives on it
          el.append(ctx.ui.tabs([  // three tabs, each drawn by one of the tab functions above
            { label: 'Clock with a modified bit', render: (p) => tabClockM(p, ctx) },  // tab 1: the clock with a modified bit
            { label: 'Page buffering', render: (p) => tabBuffer(p, ctx) },  // tab 2: page buffering
            { label: 'Cleaning policy', render: (p) => tabCleaning(p, ctx) },  // tab 3: the cleaning policy
          ], { initial: ctx.keep.tab || 0, onChange: (i) => { ctx.keep.tab = i; } }));  // closes the tab list and the tabs widget; it opens on the tab kept in ctx.keep (the first on a fresh visit) and records every switch there
        },  // ends render for step 5
      },  // ends step 5
      /* ---------------- 6. Resident set management: size and scope ---------------- */
      {  // opens step 6, resident set management
        title: 'Resident set: how many frames, and whose page goes?',  // step 6's title
        kind: 'compare',  // kind compare: a step that sets options side by side
        render(el, ctx) {  // render(): draws step 6 into el when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG ones
          const MEM = 48, TRACE = localityTrace(11);  // MEM: 48 frames of memory in this example; TRACE: an 800-reference string with locality, the same every time (seed 11)
          const rate = Array.from({ length: 17 }, (_, f) => (f ? (100 * simulate('lru', TRACE, f).faults) / TRACE.length : 100));  // rate[f]: faults per 100 references under LRU with f frames, for f = 1 to 16 (slot 0 is only a placeholder)
          const K = ctx.keep.rs || (ctx.keep.rs = { f: 4, cell: 'fl' });  // K: this step's settings (frames per process, the combination shown), kept in ctx.keep so a phone-width or desktop redraw hands them back
          let f = K.f;  // f: the frames per process picked with the slider (4 on a fresh visit)
          const svg = s('svg', { viewBox: '0 0 420 198', width: '100%' });  // the chart of fault rate against frames per process
          const X = (v) => 46 + (v - 1) * 23, Y = (v) => 160 - v * 1.6;  // X(v): position of v frames along the chart; Y(v): height for a rate of v faults per 100 references
          const readout = h('div', { class: 'small', style: { lineHeight: '1.45', minHeight: '42px' } });  // readout: the sentence under the chart; its minimum height keeps the layout steady
          function drawSize() {  // drawSize(): redraws the chart and the readout for the chosen frame count
            K.f = f;  // records the slider's value in K, so a phone-width or desktop redraw keeps it
            const kids = [s('line', { x1: 46, x2: 46 + 15 * 23, y1: Y(0), y2: Y(0), class: 's-muted' }), s('line', { x1: 46, x2: 46, y1: Y(0), y2: Y(90), class: 's-muted' })];  // the horizontal and vertical axes
            [0, 40, 80].forEach((v) => kids.push(s('text', { x: 40, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, String(v))));  // labels 0, 40 and 80 up the vertical axis
            [1, 4, 8, 12, 16].forEach((v) => kids.push(s('text', { x: X(v), y: 178, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(v))));  // labels 1, 4, 8, 12 and 16 along the horizontal axis
            kids.push(s('text', { x: 54, y: 12, 'font-size': 12.5, 'font-weight': 700 }, 'Faults per 100 references'), s('text', { x: X(8.5), y: 196, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'frames per process'));  // the chart title and the horizontal axis title
            kids.push(s('polyline', { points: rate.slice(1).map((v, i) => `${X(i + 1)},${Y(v)}`).join(' '), fill: 'none', style: 'stroke:var(--proc)', 'stroke-width': 2.5 }));  // the curve itself, in the process colour: high with few frames, flattening out as locality is covered
            kids.push(s('line', { x1: X(f), x2: X(f), y1: Y(0), y2: Y(rate[f]), style: 'stroke:var(--accent)', 'stroke-dasharray': '4 4' }), s('circle', { cx: X(f), cy: Y(rate[f]), r: 6, class: 's-accent', 'stroke-width': 2.5 }),  // a dashed line and a circle marking the chosen frame count on the curve
              s('text', { x: X(f) + 10, y: Y(rate[f]) - 8, 'font-size': 13.5, 'font-weight': 800, class: 'tx-acc' }, ctx.util.fmt(rate[f], 1)));  // the fault rate written beside the circle
            svg.replaceChildren(...kids);  // replaces the old chart with the new shapes
            const fits = Math.floor(MEM / f), gain = rate[f] - rate[Math.min(16, f + 2)];  // fits: how many processes the 48 frames hold at this size; gain: how much two more frames each would cut the rate
            readout.innerHTML = `With <b>${f}</b> frames each, <b>${fits}</b> processes fit in ${MEM} frames, and each faults about <b>${ctx.util.fmt(rate[f], 1)}</b> times per 100 references. ` +  // readout: frames each, how many processes fit, and the fault rate
              (f >= 16 ? 'Memory now holds very few processes.' : gain > 8 ? `Two more frames each would cut that by ${ctx.util.fmt(gain, 1)}: still well worth it.` : `Two more frames each would save only ${ctx.util.fmt(gain, 1)}: locality means extra frames barely help now.`);  // then a verdict: memory holds very few processes, two more frames still help a lot, or they barely help
          }  // ends drawSize
          const sl = ctx.ui.slider({ label: 'Frames per process', min: 2, max: 16, value: f, onInput: (v) => { f = v; drawSize(); } });  // slider for frames per process, 2 to 16
          drawSize();  // draws the first chart
          // the four combinations of allocation and scope, with a small before/after picture of one fault
          const CELLS = {  // CELLS: the four allocation and scope combinations, each with a title, whether it is possible, picture rows and an explanation
            fl: { t: 'Fixed allocation, local scope', ok: true, rows: [['Before', 'a1 a2 a3 a4 | b1 b2 b3 b4 | - -'], ['After A faults on a5', 'a5 a2 a3 a4 | b1 b2 b3 b4 | - -']],  // fixed and local: before, and after A replaces its own page a1 with a5
              say: 'A replaces one of <b>its own</b> pages (here a1) and keeps exactly 4 frames. Simple and predictable, but the size must be chosen in advance: too small and A faults constantly; too large and frames sit idle while fewer processes fit.' },  // its explanation: predictable, but the size must be chosen in advance
            fg: { t: 'Fixed allocation, global scope', ok: false, rows: [['Before', 'a1 a2 a3 a4 | b1 b2 b3 b4 | - -'], ['Taking b1 for a5?', 'a1 a2 a3 a4 | a5 b2 b3 b4 | - -']],  // fixed and global: the picture shows a5 taking B's frame, which is not allowed
              say: '<b>Impossible.</b> If A’s fault could take one of B’s frames, A would grow to 5 and B would shrink to 3, so neither allocation would be fixed any more.' },  // its explanation: why this combination cannot exist
            vg: { t: 'Variable allocation, global scope', ok: true, rows: [['Before', 'a1 a2 a3 a4 | b1 b2 b3 b4 | - -'], ['A faults on a5', 'a1 a2 a3 a4 a5 | b1 b2 b3 b4 | -'], ['B faults on b5', 'a1 a2 a3 a4 a5 | b1 b2 b3 b4 b5 |'], ['A faults on a6: full', 'a1 a2 a3 a4 a5 a6 | b2 b3 b4 b5 |']],  // variable and global: A grows into a free frame, then B does, then A takes b1 once memory is full
              say: 'A faulting process simply gets a free frame and grows. Once none is free, the victim can be <b>any</b> unlocked page in memory, so another process may shrink (here B loses b1). The easiest scheme and a common one; its weakness is that the victim is chosen with no regard for who can spare a page, which page buffering softens.' },  // its explanation: the easiest and most common scheme, and its weakness
            vl: { t: 'Variable allocation, local scope', ok: true, rows: [['Before', 'a1 a2 a3 a4 | b1 b2 b3 b4 | - -'], ['A faults on a5', 'a5 a2 a3 a4 | b1 b2 b3 b4 | - -'], ['Later re-evaluation', 'a5 a2 a3 a4 a6 | b1 b2 b3 | - -']],  // variable and local: A replaces its own page, then a later re-evaluation moves a frame from B to A
              say: 'A new process starts with an allocation based on its type or request. A fault replaces one of its <b>own</b> pages, but every so often the OS re-evaluates each allocation and grows or shrinks it. Here A turned out to need more and B less. Getting this right is what the working set ideas (next step) are for.' },  // its explanation: own-page replacement plus periodic resizing, which leads into the working set
          };  // closes CELLS
          const detail = h('div', { class: 'card tight', style: { minHeight: '236px' } });  // detail: the card explaining the chosen combination; its minimum height keeps the layout steady
          const btn = {};  // btn: the four matrix buttons, by key
          function strip(spec) {  // strip(spec): turns a text picture like "a1 a2 | b1 | - -" into a row of small frame boxes
            const w = ctx.narrow ? '27px' : '34px';  // w: box width, smaller on a phone so a row fits
            return h('div', { class: 'row nw', style: { gap: ctx.narrow ? '2px' : '3px' } }, ...spec.split(' ').map((x) => (x === '|' ? h('span', { style: { width: '5px' } }) :  // splits the picture at spaces; a bar becomes a small gap between processes
              h('span', { class: 'box ' + (x[0] === 'a' ? 'proc' : x[0] === 'b' ? 'accent' : ''), style: { padding: '1px 0', width: w, fontSize: '13px', fontWeight: 700, borderWidth: ctx.narrow ? '1.5px' : '2px' } }, x === '-' ? '·' : x))));  // each frame box is teal for A's pages, indigo for B's, plain for free frames (shown as a dot)
          }  // ends strip
          function pick(k) {  // pick(k): shows combination k in the detail card
            const c = CELLS[k]; K.cell = k;  // c: its entry in CELLS; the choice is also recorded in K, so a phone-width or desktop redraw shows the same one
            Object.entries(btn).forEach(([kk, b]) => b.classList.toggle('on', kk === k));  // lights up its button and no other
            detail.replaceChildren(h('div', { class: 'b', style: { marginBottom: '6px' }, html: `${c.t} ${c.ok ? '' : '<span class="chip bad">not possible</span>'}` }),  // the card's title, with a red "not possible" chip for the impossible combination
              ...c.rows.map(([lab, spec]) => h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'minmax(0, 1fr)' : '150px minmax(0, 1fr)', alignItems: 'center', gap: ctx.narrow ? '2px' : '6px', marginBottom: '5px' } }, h('span', { class: 'xs muted b' }, lab), strip(spec))),  // one row per picture line: its label, then its strip of frames (stacked on a phone, side by side otherwise)
              h('div', { class: 'small', style: { lineHeight: '1.45', marginTop: '4px' }, html: c.say }));  // the explanation below the pictures
          }  // ends pick
          const cell = (k, txt) => (btn[k] = h('button', { class: 'btn' + (CELLS[k].ok ? '' : ' danger'), style: { height: 'auto', minHeight: '58px', whiteSpace: 'normal', padding: '6px 10px', fontSize: '14px', fontWeight: 600 }, onclick: () => pick(k) }, txt));  // cell(): one matrix button, red for the impossible one, kept in btn; a click calls pick
          const matrix = h('div', { style: { display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '6px', alignItems: 'stretch' } },  // matrix: a 3-column grid, row labels on the left, local and global scope as the columns
            h('span'), h('span', { class: 'small b center', html: '<span class="t" data-t="Replacement scope">Local</span> scope<br><span class="xs muted">only its own pages</span>' }), h('span', { class: 'small b center', html: 'Global scope<br><span class="xs muted">any unlocked page</span>' }),  // header row: an empty corner, then the local and global column titles with short explanations
            h('span', { class: 'small b', style: { alignSelf: 'center' } }, 'Fixed allocation'), cell('fl', 'Evict one of its own pages; size never changes'), cell('fg', 'Not possible'),  // fixed allocation row: its label and its two buttons
            h('span', { class: 'small b', style: { alignSelf: 'center', }, html: '<span class="t">Variable allocation</span>' }), cell('vl', 'Evict own page now; re-size it from time to time'), cell('vg', 'Grow into free frames; any page may go'));  // variable allocation row: its label (a glossary link) and its two buttons
          pick(K.cell);  // shows the kept combination (fixed allocation and local scope on a fresh visit)
          el.append(h('div', { class: 'split l fill' },  // lays out the step: the size chart on the left, the matrix on the right
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column
              h('p', { class: 'm0 small', html: '<b>Size.</b> Fewer frames per process means more processes fit, so it is likelier that one of them is ready to run. But each one faults more, and once its <span class="t">resident set</span> holds its current locality, extra frames barely help.' }),  // paragraph: the trade-off between more processes and more faults per process
              sl, h('div', { class: 'card white', style: { padding: '4px 6px' } }, svg), readout,  // the slider, the chart on a white card, and the readout
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The knee moves as a program changes phase, so no fixed size stays right for long: the case for variable allocation.' })),  // callout: the knee moves as the program changes phase, which argues for variable allocation
            h('div', { class: 'stack', style: { gap: '9px' } },  // right column
              h('p', { class: 'm0 small', html: '<b>Allocation</b> (fixed or variable size) and <b>scope</b> (whose pages can be replaced) combine into four options. Click each one: process A (teal) has 4 frames, B (indigo) has 4, and 2 are free.' }),  // paragraph: allocation and scope give four options, and the starting picture of A, B and the free frames
              matrix, detail)));  // the matrix and the detail card; closes the layout
        },  // ends render for step 6
      },  // ends step 6
      /* ---------------- 7. The working set and its practical stand-ins ---------------- */
      {  // opens step 7, the working set
        title: 'The working set, and two practical stand-ins',  // step 7's title
        kind: 'explore',  // kind explore: an interactive step
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(): draws step 7 into el when the student arrives on it
          const { h } = ctx;  // h builds HTML elements
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // lays out the step as one column
            h('p', { class: 'm0 small', html: '<b>Virtual time</b> counts only a process’s own memory references: t = 1, 2, 3, … The <span class="t">working set</span> <b>W(t, Δ)</b> is the set of pages the process referenced in its last <b>Δ</b> units of virtual time, the window of references ending at t. It is the variable-allocation ideal: give each process exactly its working set.' }),  // paragraph: virtual time and the definition of the working set W(t, Δ)
            h('div', { class: 'grow' }, ctx.ui.tabs([  // the three tabs fill the rest of the step
              { label: 'Working set W(t, Δ)', render: (p) => tabWS(p, ctx) },  // tab 1: the working set itself
              { label: 'Page fault frequency', render: (p) => tabPFF(p, ctx) },  // tab 2: page fault frequency
              { label: 'Sampled working set (VSWS)', render: (p) => tabVSWS(p, ctx) },  // tab 3: the sampled working set (VSWS)
            ], { initial: ctx.keep.tab || 0, onChange: (i) => { ctx.keep.tab = i; } }))));  // closes the tabs and the layout; the tabs open on the one kept in ctx.keep (the first on a fresh visit) and record every switch there
        },  // ends render for step 7
      },  // ends step 7
      /* ---------------- 8. Load control and process suspension ---------------- */
      {  // opens step 8, load control
        title: 'Load control: how many processes, and who must go',  // step 8's title
        kind: 'explore',  // kind explore: an interactive step
        render(el, ctx) {  // render(): draws step 8 into el when the student arrives on it
          el.append(ctx.ui.tabs([  // two tabs, each drawn by one of the tab functions above
            { label: 'Multiprogramming level', render: (p) => tabLoad(p, ctx) },  // tab 1: the multiprogramming level chart
            { label: 'Who gets suspended?', render: (p) => tabSuspend(p, ctx) },  // tab 2: choosing which process to suspend
          ], { initial: ctx.keep.tab || 0, onChange: (i) => { ctx.keep.tab = i; } }));  // closes the tab list and the tabs widget; it opens on the tab kept in ctx.keep (the first on a fresh visit) and records every switch there
        },  // ends render for step 8
      },  // ends step 8
      /* ---------------- 9. Recap ---------------- */
      {  // opens step 9, the recap
        title: 'Recap: eight ideas to carry away',  // step 9's title
        kind: 'recap',  // kind recap: a summary step
        render(el, ctx) {  // render(): draws step 9 into el when the student arrives on it
          const { h } = ctx;  // h builds HTML elements
          const belady = [3, 4].map((m) => simulate('fifo', [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5], m).faults);  // belady: FIFO's fault counts on the anomaly string with 3 and 4 frames, computed live so the card always matches the simulator
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));  // flipAll(on): turns every flip card in this step face up (true) or face down (false)
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays out the step as one column
            h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer out loud before you flip the card. Click a card again to flip it back.'),  // top row: an instruction to answer out loud before flipping
              h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),  // Flip all and Hide all buttons
            ctx.ui.flipcards([  // the eight recap cards, each a [front, back] pair
              ['The six policy areas', 'Fetch (when a page comes in), placement (where it goes), replacement (which page leaves), resident set management (how many frames, whose page), cleaning (when changes are written back), load control (how many processes). One goal: few page faults.'],  // card: the six policy areas and their single goal
              ['Demand paging vs prepaging', 'Demand: read a page only when it faults; a burst of faults at start-up, then locality takes over. Prepaging: read its disk neighbours in the same operation; cheaper per page, wasted if unused. Placement barely matters for paging (NUMA aside).'],  // card: demand paging versus prepaging, and placement
              ['OPT, LRU, FIFO, clock', 'OPT: next use farthest away (best, needs the future). LRU: unused longest (close to OPT, costly to track exactly). FIFO: oldest (simple, evicts busy pages). Clock: pointer plus use bits, a cheap LRU stand-in.'],  // card: the four replacement policies in one line each
              ['Belady’s anomaly', `FIFO can fault more with more frames: 1 2 3 4 1 2 5 1 2 3 4 5 gives ${belady[0]} faults with 3 frames and ${belady[1]} with 4. LRU and OPT never do this.`],  // card: Belady's anomaly, with the counts filled in from the simulator
              ['Modified pages', 'The smarter clock takes (u=0, m=0) first, then (0, 1) while clearing use bits, then repeats. Page buffering parks evicted pages on free or modified lists so they can be reclaimed with no disk read; modified pages are written in batches.'],  // card: the smarter clock and page buffering
              ['Resident set management', 'Size: fixed or variable. Scope: local (own pages) or global (any unlocked page). Fixed + global is impossible. Variable + global is simplest and common; variable + local re-evaluates allocations from time to time.'],  // card: resident set size and scope, and which combinations work
              ['Working set', 'W(t, Δ): pages referenced in the last Δ units of virtual time; 1 ≤ |W| ≤ min(Δ, pages). Exact tracking is impractical, so PFF (threshold F) and VSWS (M, L, Q) approximate it with use bits.'],  // card: the working set and its two approximations
              ['Cleaning and load control', 'Demand cleaning vs precleaning; best is cleaning the modified list in batches. Too few processes: idle processor; too many: thrashing. Guides: L = S, a half-busy paging disk, clock sweep speed. Six rules choose whom to suspend.'],  // card: cleaning and load control in brief
            ], { cols: 4, height: 218 })));  // four columns of cards, each 218 pixels tall; closes the layout
        },  // ends render for step 9
      },  // ends step 9
      /* ---------------- 10. Quiz ---------------- */
      {  // opens step 10, the quiz
        title: 'Check yourself: virtual-memory policies',  // step 10's title
        kind: 'check',  // kind check: the section's quiz, whose score is saved
        quiz: [  // quiz: the questions; the quiz engine draws them, checks answers and shows the explanations
          { type: 'match', q: 'Match each virtual-memory policy to the question it answers.',  // question 1 (match): pair each policy area with the question it answers
            pairs: [['Fetch policy', 'When is a page brought into main memory?'], ['Placement policy', 'Where in real memory does a piece go?'], ['Replacement policy', 'Which resident page is removed to make room?'],  // the first three pairs: fetch, placement, replacement
              ['Resident set management', 'How many frames does each process get?'], ['Cleaning policy', 'When is a modified page written to disk?'], ['Load control', 'How many processes are kept in main memory?']],  // the last three pairs: resident set management, cleaning, load control
            why: 'Six separate decisions, all serving one goal: keep the page fault rate low, because every fault costs OS work, disk I/O and a process switch.' },  // explanation: all six serve one goal, a low page fault rate
          { q: 'Why can no real operating system use the optimal (OPT) replacement policy?',  // question 2 (multiple choice): why OPT cannot be used in a real system
            choices: ['It needs a use bit in every page table entry, which most hardware lacks.', 'It must know when each page will next be referenced, which lies in the future.', 'It suffers from Belady’s anomaly, so adding memory can make it worse.', 'It takes too long to scan all the frames on every fault.'],  // four choices: missing hardware, needing the future, Belady's anomaly, scanning cost
            answer: 1,  // the correct choice is the second (counting from 0, answer 1)
            feedback: ['Use bits are common hardware, and OPT does not use them anyway: it looks forward, not back.', null, 'OPT never shows Belady’s anomaly; FIFO does.', 'Scanning the frames is cheap; knowing the future is what is impossible.'],  // feedback for each wrong choice (null for the right one)
            why: 'OPT evicts the page whose next reference is farthest away, which requires knowing future references. It is used only as a yardstick to judge real policies.' },  // explanation: OPT needs future references, so it is only a yardstick
          { type: 'num', q: 'A process has 3 frames, all empty at the start, and makes the references 2 6 1 2 5 6 2 1 4 6 2 5. How many page faults does FIFO replacement cause, counting the first three loads?', answer: 8, tol: 0, unit: 'faults',  // question 3 (calculate): FIFO fault count on a 12-reference string with 3 frames
            why: 'Faults on 2, 6, 1; 2 hits; 5 evicts 2; 6 hits; 2 evicts 6; 1 hits; 4 evicts 1; 6 evicts 5; 2 hits; 5 evicts 2. That is 3 + 5 = 8 faults.' },  // explanation: the FIFO trace step by step, 8 faults
          { type: 'num', q: 'A process has 3 frames, all empty at the start, and makes the references 2 6 1 2 5 6 2 1 4 6 2 5. How many page faults does LRU replacement cause, counting the first three loads?', answer: 10, tol: 0, unit: 'faults',  // question 4 (calculate): LRU fault count on the same string
            why: 'After 2, 6, 1 load: 2 hits; 5 evicts 6; 6 evicts 1; 2 hits; 1 evicts 5; 4 evicts 6; 6 evicts 2; 2 evicts 1; 5 evicts 4. 3 + 7 = 10 faults. On this string FIFO happens to beat LRU (8 faults): neither is always better, and OPT beats both (7 faults).' },  // explanation: the LRU trace, 10 faults, and a note that FIFO wins here and OPT beats both
          { type: 'tf', q: 'Under FIFO replacement, giving a process more frames can never increase the number of page faults it suffers.', answer: false,  // question 5 (true or false): more frames can never hurt FIFO; the answer is false
            why: 'Belady’s anomaly: with FIFO, the string 1 2 3 4 1 2 5 1 2 3 4 5 causes 9 faults with 3 frames but 10 with 4. LRU and OPT never behave this way, because the pages they hold with n frames are always among those they would hold with n + 1.' },  // explanation: Belady's anomaly, and why LRU and OPT are immune
          { q: 'A clock policy manages four frames holding pages A, B, C and D, in that order around the circle, with use bits 0, 1, 1, 1. The pointer is at the frame holding C. Page E must be loaded. Which page is replaced?',  // question 6 (multiple choice): which page a clock replaces, given the use bits and the pointer
            choices: ['A', 'B', 'C', 'D'], answer: 0,  // choices A to D; the answer is A
            feedback: [null, 'B’s use bit is 1, and the pointer finds A (use bit 0) before it ever reaches B.', 'C’s use bit is 1, so the pointer clears it to 0 and moves on.', 'D’s use bit is 1, so the pointer clears it and moves on.'],  // feedback for each wrong choice: why B, C and D are not taken
            why: 'From C: use bit 1, clear it and move on; D: use bit 1, clear and move on; A: use bit 0, so A is replaced. E goes into that frame with its use bit set, and the pointer moves on to B.' },  // explanation: the pointer's path from C, clearing bits until it reaches A
          { type: 'order', q: 'Put the steps of the clock policy that also uses the modified bit (u = use bit, m = modified bit) in order.',  // question 7 (put in order): the scans of the clock with a modified bit
            items: ['Scan from the pointer for a frame with u = 0 and m = 0, changing no bits', 'If none, scan for u = 0 and m = 1, clearing the use bit of each frame passed', 'If still none, repeat the first scan: every use bit is now 0', 'If needed, repeat the second scan, which is now sure to find a frame'],  // the four scans, listed in their correct order (the quiz shuffles them)
            why: 'The first scan looks for the cheapest victim: idle and clean. The second accepts an idle but modified page and ages every page it passes. If both fail, all use bits are 0, so repeating them must succeed.' },  // explanation: why each scan comes where it does, and why the last one must succeed
          { type: 'bucket', q: 'Sort each statement under the resident set strategy it describes.', buckets: ['Fixed allocation, local scope', 'Variable allocation, global scope', 'Variable allocation, local scope'],  // question 8 (sort into groups): statements under three resident set strategies
            items: [['The number of frames is chosen when the process starts and never changes', 0], ['A page fault can take a frame away from another process', 1], ['The simplest scheme to implement, and a widely used one', 1],  // first three statements, each with the number of its correct group
              ['A fault replaces one of the process’s own pages, but its allocation is re-evaluated from time to time', 2], ['Too small an allocation means many faults; too large wastes memory', 0]],  // last two statements with their groups
            why: 'Fixed + local never changes a size. Variable + global grows the faulting process and can take any unlocked page. Variable + local replaces within the process and adjusts sizes periodically. Fixed + global cannot exist.' },  // explanation: how the strategies differ, and that fixed with global cannot exist
          { type: 'num', q: 'A process makes the references 2 4 2 3 4 5 5 3 2 6 at virtual times 1 to 10. What is the size of its working set W(10, 5)?', answer: 4, tol: 0, unit: 'pages',  // question 9 (calculate): the size of a working set from a short reference string
            why: 'W(10, 5) holds the distinct pages referenced at times 6 to 10: 5, 5, 3, 2, 6, which is the set {5, 3, 2, 6}, so |W| = 4.' },  // explanation: the window covers times 6 to 10, giving 4 distinct pages
          { type: 'multi', q: 'Which statements about page buffering are true?',  // question 10 (select all): true statements about page buffering
            choices: ['An evicted page stays in its frame until that frame is given to another page.', 'A page reclaimed from the free page list needs no disk read.', 'Pages on the modified page list are written to disk in batches.', 'An evicted page keeps a valid page table entry, so referencing it causes no fault at all.', 'Page buffering only works together with LRU replacement.'],  // five choices, two of them traps (a valid page table entry, needing LRU)
            answer: [0, 1, 2],  // the correct choices are the first three
            why: 'The page table entry is removed, so a reference does fault, but the fault is cheap: the page is still in memory and is simply moved back. It works with any replacement policy and makes even FIFO perform well.' },  // explanation: the page table entry is removed, so it is a fault, but a cheap one
          { q: 'As more and more processes are loaded into memory, processor utilization rises and then drops sharply. What causes the drop?',  // question 11 (multiple choice): why utilization collapses with too many processes
            choices: ['Each process gets too few frames, so faults pile up at the paging device while the processor waits: thrashing.', 'The scheduler spends so much time choosing among all the ready processes that little time is left to run them.', 'Each process spends more of its time waiting for ordinary I/O, such as keyboard input, so fewer are ready to run.', 'The page tables grow so large that they no longer fit in the TLB, so every address translation slows down.'],  // four choices: thrashing, scheduler overhead, ordinary I/O waits, TLB size
            answer: 0,  // the correct choice is the first
            feedback: [null, 'Choosing among more processes costs a little, but not enough to collapse utilization.', 'Ordinary I/O waits are why too FEW processes leave the processor idle; more processes help hide them.', 'The TLB caches only recent translations, and a TLB miss costs nanoseconds; the collapse comes from millisecond disk waits for page faults.'],  // feedback for each wrong choice
            why: 'Past the peak, each process has fewer frames than its working set, so it faults constantly. The paging device saturates, processes queue for it, and the processor idles. Load control keeps the level below that point.' },  // explanation: past the peak each process lacks its working set and the paging disk saturates
          { q: 'Load control must suspend one process. Under the “last process activated” rule, which process goes, and why?',  // question 12 (multiple choice): what the last-activated suspension rule picks and why
            choices: ['The most recently activated process, because new processes are always given the lowest priority.', 'The process that caused the most recent page fault, because it is about to block for the disk anyway.', 'The most recently activated process, because it is the least likely to have its working set in memory yet.', 'The oldest process in memory, because it has already had more processor time than any other process.'],  // four choices mixing up this rule with the priority, faulting and oldest-process ideas
            answer: 2,  // the correct choice is the third
            feedback: ['Activation order says nothing about priority; that is a separate rule.', 'That is the faulting-process rule, a different choice.', null, 'The rule picks the newest process, not the oldest.'],  // feedback for each wrong choice
            why: 'A newly activated process has not yet built up its working set, so suspending it throws away little useful resident memory. The other rules use priority, the faulting process, resident set size, process size or remaining run time.' },  // explanation: a new process has little working set to lose
        ],  // closes the quiz questions
      },  // ends step 10
    ],  // closes the list of steps
    notes: `${/* notes: the section's reading notes, opened with the Notes button, written as HTML */''}
<h3>Why the software decisions matter</h3>${/* notes heading for part 1: why the software decisions matter */''}
<p>Designers choose whether to use virtual memory, whether to use paging, segmentation or both (mostly set by the hardware), and the algorithm for each policy (pure OS software). Every page fault costs OS code (choosing a victim, updating tables), disk I/O (milliseconds) and a process switch, so the goal of every policy is a <b>low page fault rate</b>. With 100 ns per access and 8 ms per fault, one fault per 100,000 references nearly doubles the run time.</p>${/* notes paragraph: the design choices, the three costs of a fault, and how rare faults still double the run time */''}
<table>${/* start of the summary table of the six policy areas */''}
<tr><th>Policy</th><th>Question it answers</th></tr>${/* table header row: policy and the question it answers */''}
<tr><td>Fetch</td><td>When does a page come in?</td></tr>${/* table row: fetch */''}
<tr><td>Placement</td><td>Where in real memory does it go?</td></tr>${/* table row: placement */''}
<tr><td>Replacement</td><td>Which page leaves to make room?</td></tr>${/* table row: replacement */''}
<tr><td>Resident set management</td><td>How many frames per process, and whose page goes?</td></tr>${/* table row: resident set management */''}
<tr><td>Cleaning</td><td>When is a modified page written back?</td></tr>${/* table row: cleaning */''}
<tr><td>Load control</td><td>How many processes are kept in memory?</td></tr>${/* table row: load control */''}
</table>${/* end of the summary table */''}

<h3>Fetch and placement</h3>${/* notes heading for part 2: fetch and placement */''}
<p><b>Demand paging</b> reads a page only when it is referenced: a burst of faults at start-up, then few, thanks to locality. <b>Prepaging</b> also reads other pages, usually the ones stored after it on disk, in the same operation; positioning the disk costs far more than transferring one more page. Unused pages are wasted. Prepaging is not swapping, which moves a whole process. Example (8 ms per disk operation + 0.1 ms per page): demand paging 10 faults, 81 ms; 3 pages per read 4 faults, 33.2 ms; 8 per read 3 faults, but 10 of 20 pages read are never used.</p>${/* notes paragraph: demand paging versus prepaging, with the numbers from the step 2 example */''}
<p><b>Placement</b> matters for pure segmentation (first-fit, best-fit). For paging any frame is as good as any other, except on NUMA machines, where memory near the processor running the process is faster.</p>${/* notes paragraph: placement matters for segmentation but not for paging, except on NUMA machines */''}

<h3>Replacement</h3>${/* notes heading for part 3: replacement */''}
<p>The ideal victim is the page least likely to be referenced soon, predicted from past behaviour. <b>Frame locking</b>: a lock bit marks frames that may never be replaced (kernel, key control structures, I/O buffers, time-critical code).</p>${/* notes paragraph: the ideal victim, and frame locking */''}
<ul>${/* start of the list of the four replacement policies */''}
<li><b>OPT</b>: evict the page whose next reference is farthest in the future. Fewest possible faults, but needs the future: a yardstick only.</li>${/* list item: OPT */''}
<li><b>LRU</b>: evict the page unused for the longest time. Close to OPT thanks to locality, but exact LRU needs a time stamp per reference or a stack of pages.</li>${/* list item: LRU and why exact LRU is costly */''}
<li><b>FIFO</b>: treat the frames as a circular buffer and evict the page in memory longest. Simple, but evicts busy pages just because they are old.</li>${/* list item: FIFO */''}
<li><b>Clock</b>: a use bit per frame, set when the page is loaded and on every reference. To replace, the pointer advances: a frame with use bit 1 has it cleared and is passed; the first frame with use bit 0 is the victim; the pointer then moves to the next frame. If every bit is 1 the pointer goes all the way round and evicts the page where it started.</li>${/* list item: the clock, step by step, including the full trip round */''}
</ul>${/* end of the policy list */''}
<p><b>Worked example</b>, 3 frames, references 3 4 5 2 4 3 4 1 4 2 3 2 4 1: OPT 7 faults, LRU 9, clock 10, FIFO 11 (counts include the first loads into empty frames). <b>Belady’s anomaly</b>: FIFO on 1 2 3 4 1 2 5 1 2 3 4 5 gives 9 faults with 3 frames and 10 with 4. LRU and OPT never do this, because the pages they keep with n frames are always among those they keep with n + 1.</p>${/* notes paragraph: the worked example's fault counts for each policy, and Belady's anomaly */''}

<h3>Modified pages</h3>${/* notes heading for part 4: modified pages */''}
<p><b>Clock with the modified bit</b> sorts frames into (u, m) = (0, 0) best, (0, 1), (1, 0), (1, 1) worst. (1) Scan from the pointer for (0, 0), changing no bits; take the first. (2) If none, scan for (0, 1), clearing the use bit of each frame passed; take the first. (3) If none, every use bit is now 0: repeat step 1 and, if needed, step 2, which must succeed. It prefers pages needing no write-back.</p>${/* notes paragraph: the clock with a modified bit, its order of preference and its three steps */''}
<p><b>Page buffering</b>: an evicted page loses its page table entry but stays in its frame, on the tail of the <b>free page list</b> (clean) or the <b>modified page list</b> (changed). A page read in takes the frame at the head of the free list. A page referenced again before its frame is reused is reclaimed with no disk read; modified pages are written in batches. This makes even FIFO perform well.</p>${/* notes paragraph: page buffering, the free and modified lists, and cheap reclaims */''}
<p><b>Cleaning policy</b>: <b>demand cleaning</b> writes a page only when it is selected for replacement, so a fault with a modified victim waits for two transfers. <b>Precleaning</b> writes modified pages ahead of time in batches, but a page may be modified again, wasting the write. Best: page buffering, cleaning only replaceable pages in batches and keeping cleaning separate from replacement. (Model: 8 ms transfers, half the victims modified, 30% re-modified: average wait 12 ms with demand cleaning, 9.2 ms with precleaning but 15 wasted writes per 100 replacements, 8 ms with buffering.)</p>${/* notes paragraph: demand cleaning versus precleaning, with the numbers from the cleaning model */''}

<h3>Resident set management</h3>${/* notes heading for part 5: resident set management */''}
<p>Fewer frames per process lets more processes fit (one is likelier to be ready) but raises each one’s fault rate; past some size, more frames barely help. <b>Fixed allocation</b> gives a process a set number of frames; <b>variable allocation</b> lets it change. <b>Local scope</b> picks a victim among the faulting process’s own pages; <b>global scope</b> among all unlocked pages.</p>${/* notes paragraph: the size trade-off, and the meaning of fixed, variable, local and global */''}
<ul>${/* start of the list of the four combinations */''}
<li>Fixed + local: evict an own page; the size must be chosen in advance (too small: many faults; too large: wasted memory).</li>${/* list item: fixed allocation with local scope */''}
<li>Fixed + global: impossible (taking another process’s frame changes both sizes).</li>${/* list item: fixed allocation with global scope, which is impossible */''}
<li>Variable + global: the faulting process gets a free frame; when none is left, any process may lose a page. Easiest and common; page buffering softens bad victim choices.</li>${/* list item: variable allocation with global scope */''}
<li>Variable + local: start with an allocation based on the program type, replace within the process, and periodically re-evaluate the allocation.</li>${/* list item: variable allocation with local scope */''}
</ul>${/* end of the combinations list */''}

<h3>Working set and its approximations</h3>${/* notes heading for part 6: the working set and its approximations */''}
<p><b>W(t, Δ)</b> is the set of pages referenced in the last Δ units of <b>virtual time</b> (the process’s own references). A larger Δ never gives a smaller set, and 1 ≤ |W| ≤ min(Δ, number of pages). Example: for 1 2 3 1 2 3 1 2 4 5 4 6 …, W(12, 4) = {4, 5, 6}. Policy: track each working set, drop pages that leave it, and run a process only if its working set is resident. Problems: the past may not predict the future, exact measurement is impractical, and the best Δ is unknown and varies.</p>${/* notes paragraph: the definition of W(t, Δ), its bounds, an example, the policy and its problems */''}
<p><b>Page fault frequency (PFF)</b>: a use bit per page. On a fault, if fewer than F references have passed since the last fault, add the page; otherwise first drop every page with use bit 0, reset the others’ use bits, then add the page. Weak when locality changes: faults come fast, so old and new pages pile up.</p>${/* notes paragraph: page fault frequency and its weak spot */''}
<p><b>VSWS</b> (variable-interval sampled working set) uses M (minimum interval), L (maximum) and Q (faults allowed). Use bits are reset at each sampling instant; faulting pages are added; a sample drops pages whose use bit is still 0. Sample when L references have passed; if Q faults happen first, sample at once if at least M have passed, otherwise wait until M.</p>${/* notes paragraph: VSWS and its three settings M, L and Q */''}

<h3>Load control and suspension</h3>${/* notes heading for part 7: load control and suspension */''}
<p>Too few processes in memory: often all are blocked and the processor idles. Too many: each has too few frames and the system thrashes. Utilization rises, peaks, then collapses (in this section’s model: 19% with 1 process, 87% at 7, 16% at 14). Guides: working set or PFF (implicit load control); <b>L = S</b> (mean time between faults equal to mean fault service time); keep the paging device about <b>50% busy</b>; watch the <b>clock sweep rate</b> (slow sweeps: room for more).</p>${/* notes paragraph: too few versus too many processes, the model's numbers, and four guides to the right level */''}
<p>To lower the level, suspend: the <b>lowest-priority</b> process; the <b>faulting</b> process (probably lacks its working set and is about to block); the <b>last activated</b> (least likely to have its working set resident); the one with the <b>smallest resident set</b> (cheapest to reload, but penalises good locality); the <b>largest</b> process (frees the most frames); or the one with the <b>largest remaining execution window</b> (like shortest-processing-time scheduling).</p>`,  // notes paragraph: the six suspension rules; the backtick at the end closes the notes text
  });  // closes the object passed to Guide.section, which registers the section
})();  // ends the wrapper function and runs it at once
