// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 9.1 — Types of Processor Scheduling
   The four kinds of scheduling decision (long-term, medium-term,
   short-term, I/O), where each one acts on the seven-state model, the
   queuing view, admission and the degree of multiprogramming, and the
   events that wake each scheduler. Every number shown to the student
   comes out of the small engines below. Helpers live in the IIFE so
   nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this section
  /* The four schedulers. cls is the colour family used everywhere in this
     section: long-term = OS violet (admission), medium-term = memory green
     (swapping), short-term = processor blue (dispatching), I/O = orange. */
  const SCH = {  // SCH: the table of the four schedulers, keyed long, medium, short and io; every step reads names, colours and questions from it
    long: { name: 'Long-term', cls: 'os', q: 'Should this new program be allowed into the system at all?' },  // long-term entry: its name, the violet OS colour family (cls) and the admission question it answers (q)
    medium: { name: 'Medium-term', cls: 'mem', q: 'Which processes should be in main memory, and which swapped out to disk?' },  // medium-term entry: green memory colours; its question is about swapping between memory and disk
    short: { name: 'Short-term', cls: 'cpu', q: 'Which ready process gets the processor next?' },  // short-term entry: processor blue; its question is which ready process runs next
    io: { name: 'I/O', cls: 'io', q: 'Which waiting I/O request does this device serve next?' },  // I/O entry: orange; its question is which waiting device request is served next
  };  // closes the SCH table
  const chip = (k, txt) => `<span class="chip ${SCH[k].cls}">${txt || SCH[k].name}</span>`;  // chip(k, txt): builds a small coloured label (a "chip") in scheduler k's colour, showing txt or the scheduler's name

  /* Message box helper: kind is '', 'ok', 'bad' or 'info'. */
  function say(box, kind, head, html) {  // say(box, kind, head, html): fills a message box with an optional bold heading and some text, in the colour that kind picks
    box.className = 'msg ' + (kind || '');  // sets the box's classes to msg plus the kind (ok = green, bad = red, info = accent colour), which sets its border and background
    box.innerHTML = (head ? `<b class="h">${head}</b>` : '') + html;  // writes the heading (if any) as a bold uppercase line, then the message HTML under it
  }  // ends say()

  /* ENGINE-BEGIN ------------------------------------------------------
     Pure simulation code (no DOM). dev/qa-9.1/engine.test.js extracts
     this block and checks the numbers the steps show.                 */

  /* "You are the scheduler" lab. Each job is a list of bursts that
     alternate processor, I/O, processor, ...  Main memory holds LAB_MEM
     processes (Ready + Running + Blocked); a process may hold the
     processor for at most LAB_Q ticks in a row before a time-out. */
  const LAB_JOBS = [['J1', [2, 7, 2]], ['J2', [1, 8, 2]], ['J3', [2, 6, 1]], ['J4', [7]], ['J5', [2, 4, 2]], ['J6', [5]]];  // LAB_JOBS: the six batch jobs of the lab; each burst list alternates processor ticks and I/O ticks (J4 and J6 only compute)
  const LAB_MEM = 3, LAB_Q = 3;  // LAB_MEM: main memory holds 3 processes; LAB_Q: the time slice, 3 ticks on the processor before a time-out
  function labFresh() {  // labFresh(): builds a brand-new lab state, used when the lab opens and whenever the student presses Reset
    return {  // hands back the new state object
      t: 0, busy: 0, idle: 0, wasted: 0, run: null, slice: 0, tally: { long: 0, medium: 0, short: 0 },  // clock t, busy and idle ticks, wasted (idle while a job was Ready), run (the running job), slice (ticks in its turn), tally (decisions per scheduler)
      P: LAB_JOBS.map(([id, b]) => ({ id, b, ph: 0, left: b[0], st: 'new' })),  // P: one record per job: its bursts b, ph (which burst it is in), left (ticks left in that burst) and st (its state, New at first)
      q: { new: LAB_JOBS.map((j) => j[0]), ready: [], blk: [], rs: [], bs: [], exit: [] },  // q: one waiting line per state; all six jobs start in the New (batch) queue and every other queue starts empty
    };  // ends the state object
  }  // ends labFresh()
  const labGet = (S, id) => S.P.find((p) => p.id === id);  // labGet(S, id): finds a job's record by its name, for example "J3"
  const labInMem = (S) => S.q.ready.length + S.q.blk.length + (S.run ? 1 : 0);  // labInMem(S): how many processes occupy main memory: the Ready ones, the Blocked ones and the Running one, if any
  function labMove(S, p, to) {  // labMove(S, p, to): takes job p out of the queue for its current state and puts it in the queue for state to
    const from = S.q[p.st];  // from is the queue for the job's current state (Running has none: the running job is kept in S.run instead)
    if (from && from.includes(p.id)) from.splice(from.indexOf(p.id), 1);  // removes the job's name from that queue if it is there
    p.st = to;  // records the new state on the job itself
    if (S.q[to]) S.q[to].push(p.id);  // adds the job to the back of the new state's queue, if that state has one
  }  // ends labMove()
  /* One decision. Returns { ok, why } (why explains a refusal) or { ok, to }. */
  function labAct(S, what, id) {  // labAct(S, what, id): carries out one decision (admit, dispatch, out or in) on job id, or refuses it with a reason
    const p = labGet(S, id);  // looks up the job the decision is about
    if (!p) return { ok: false, why: 'none' };  // refuses with reason "none" if no job has that name
    if (what === 'admit') {  // admit is the long-term decision: let a New job into the system
      if (p.st !== 'new') return { ok: false, why: 'state' };  // only a job still in the New state can be admitted; anything else is refused with reason "state"
      const to = labInMem(S) < LAB_MEM ? 'ready' : 'rs';  // a free memory slot sends the job to Ready; with memory full it is admitted onto disk as Ready/Suspend
      labMove(S, p, to); S.tally.long++;  // moves the job and counts one long-term decision for the tally bars
      return { ok: true, to };  // reports success and where the job went, so the message can say New → Ready or New → Ready/Suspend
    }  // ends the admit case
    if (what === 'dispatch') {  // dispatch is the short-term decision: give the processor to a Ready job
      if (p.st !== 'ready') return { ok: false, why: 'state' };  // only a Ready job in main memory can be dispatched; a job on disk must be swapped in first
      if (S.run) return { ok: false, why: 'busy' };  // refuses with reason "busy" if another job already holds the processor
      labMove(S, p, 'run'); S.run = p; S.slice = 0; S.tally.short++;  // makes the job Running, remembers it in S.run, starts its time slice at 0 and counts one short-term decision
      return { ok: true, to: 'run' };  // reports success
    }  // ends the dispatch case
    if (what === 'out') {  // out is a medium-term decision: swap a job out of main memory to disk
      if (p.st !== 'ready' && p.st !== 'blk') return { ok: false, why: 'state' };  // only Ready or Blocked jobs can be swapped out; the running job and jobs already on disk are refused
      const to = p.st === 'ready' ? 'rs' : 'bs';  // a Ready job becomes Ready/Suspend; a Blocked job becomes Blocked/Suspend and keeps waiting on disk
      labMove(S, p, to); S.tally.medium++;  // moves the job, which frees its memory slot, and counts one medium-term decision
      return { ok: true, to };  // reports success and the suspended state the job went to
    }  // ends the swap-out case
    if (what === 'in') {  // in is the other medium-term decision: swap a suspended job back into main memory
      if (p.st !== 'rs' && p.st !== 'bs') return { ok: false, why: 'state' };  // only Ready/Suspend or Blocked/Suspend jobs can be swapped in
      if (labInMem(S) >= LAB_MEM) return { ok: false, why: 'full' };  // refuses with reason "full" when every memory slot is taken
      const to = p.st === 'rs' ? 'ready' : 'blk';  // Ready/Suspend comes back as Ready; Blocked/Suspend comes back as Blocked
      labMove(S, p, to); S.tally.medium++;  // moves the job into memory and counts one medium-term decision
      return { ok: true, to };  // reports success and the state the job returned to
    }  // ends the swap-in case
    return { ok: false, why: 'state' };  // any other decision name is refused
  }  // ends labAct()
  /* One tick of time. Devices first (every waiting process, in memory or on
     disk, gets one tick of I/O), then the processor. Returns the events. */
  function labTick(S) {  // labTick(S): moves the lab clock forward one tick and returns a list of what happened, for the message box
    const ev = [], readyBefore = S.q.ready.length;  // ev collects the events; readyBefore notes how many jobs were Ready at the start, to tell later whether an idle tick was wasted
    for (const id of [...S.q.blk, ...S.q.bs]) {  // walks every waiting job, in memory and on disk (over a copy of the lists, since jobs may move during the loop)
      const p = labGet(S, id);  // looks up the waiting job's record
      p.left--;  // its device does one tick of I/O, so one tick less is left in the burst
      if (!p.left) { p.ph++; p.left = p.b[p.ph]; const to = p.st === 'blk' ? 'ready' : 'rs'; labMove(S, p, to); ev.push({ k: 'io', id, to }); }  // I/O burst over: move to the next (processor) burst; Blocked becomes Ready, Blocked/Suspend becomes Ready/Suspend; record an io event
    }  // ends the loop over waiting jobs
    if (S.run) {  // then the processor: only if some job is Running
      const p = S.run;  // p is the running job
      p.left--; S.busy++; S.slice++;  // it computes for one tick: its burst shrinks, the busy count grows and its time slice uses up one more tick
      if (!p.left) {  // the processor burst is finished
        p.ph++; S.run = null;  // moves on to the job's next burst and frees the processor
        if (p.ph >= p.b.length) { labMove(S, p, 'exit'); ev.push({ k: 'exit', id: p.id }); }  // no bursts left: the job goes to Exit and an exit event is recorded
        else { p.left = p.b[p.ph]; labMove(S, p, 'blk'); ev.push({ k: 'wait', id: p.id }); }  // otherwise its next burst is I/O: the job goes to Blocked and a wait event is recorded
      } else if (S.slice >= LAB_Q) { S.run = null; labMove(S, p, 'ready'); ev.push({ k: 'timeout', id: p.id }); }  // burst not finished but the slice has reached LAB_Q ticks: time-out, back to the end of the ready queue
      else ev.push({ k: 'ran', id: p.id });  // the processor burst is not finished and the slice is not used up: record that the job simply ran this tick
    } else { S.idle++; if (readyBefore) S.wasted++; ev.push({ k: 'idle', wasted: readyBefore > 0 }); }  // nothing Running: count an idle tick, and a wasted one if some job sat Ready while the processor did nothing
    S.t++;  // the clock moves forward one tick
    return ev;  // hands back this tick's events so the lab can describe them
  }  // ends labTick()
  /* The built-in OS policy, applied before a tick. Returns its decisions as [what, id].
     Medium-term first (swap in waiting ready work), then long-term (admit while memory
     is free), then make room if the processor would otherwise sit idle, then dispatch. */
  function labPolicy(S) {  // labPolicy(S): the built-in OS policy; it makes its decisions just before a tick and returns them as [what, id] pairs
    const did = [], go = (what, id) => { if (labAct(S, what, id).ok) did.push([what, id]); };  // did collects the decisions made; go(what, id) tries one decision and records it only if it was allowed
    while (S.q.rs.length && labInMem(S) < LAB_MEM) go('in', S.q.rs[0]);  // medium-term first: while jobs wait in Ready/Suspend and memory has room, swap in the one at the front
    while (S.q.new.length && labInMem(S) < LAB_MEM) go('admit', S.q.new[0]);  // then long-term: while jobs wait in the batch queue and memory has room, admit the one at the front
    if (!S.run && !S.q.ready.length && (S.q.rs.length || S.q.new.length) && S.q.blk.length) {  // processor free, nothing Ready, work waiting outside memory and some job Blocked in memory: time to make room
      const id = S.q.blk.slice().sort((a, b) => labGet(S, b).left - labGet(S, a).left)[0];  // picks the Blocked job with the most I/O ticks still to go (sorted largest first), since it will be waiting longest anyway
      go('out', id);  // swaps that job out to disk, which frees one memory slot
      if (S.q.rs.length) go('in', S.q.rs[0]); else go('admit', S.q.new[0]);  // fills the slot: swap in a Ready/Suspend job if there is one, otherwise admit the next batch job
    }  // ends the make-room case
    if (!S.run && S.q.ready.length) go('dispatch', S.q.ready[0]);  // short-term last: if the processor is free and a job is Ready, dispatch the front of the ready queue (first come first served)
    return did;  // hands back the list of decisions so the message box can say what the OS decided
  }  // ends labPolicy()
  const labDone = (S) => S.q.exit.length === LAB_JOBS.length;  // labDone(S): true once all six jobs have reached Exit, which ends the lab
  function labRunPolicy() {  // labRunPolicy(): plays the whole lab with the built-in policy so the student's result can be compared with it at the end
    const S = labFresh();  // starts from a fresh lab state
    for (let g = 0; !labDone(S) && g < 500; g++) { labPolicy(S); labTick(S); }  // repeats policy-then-tick until every job is done; the 500-round limit is a safety net against an endless loop
    return S;  // hands back the finished state: its tick count, busy ticks and decision tally
  }  // ends labRunPolicy()

  /* Process-mix game: one processor and one disk, each first come first served
     and nonpreemptive. Every admitted job repeats its cycle for the whole window:
     processor-bound = 5 ticks of processor then 1 of disk; I/O-bound = 1 then 4. */
  const MIX_KIND = { p: [5, 1], i: [1, 4] };  // MIX_KIND: the repeating cycle of each job kind: processor-bound (p) = 5 processor ticks then 1 disk tick; I/O-bound (i) = 1 then 4
  function mixRun(kinds, T) {  // mixRun(kinds, T): simulates the chosen jobs for T ticks on one processor and one disk, recording who used each one every tick
    const J = kinds.map((k, n) => ({ n, k, left: MIX_KIND[k][0] }));  // J: one record per job: n (its place in the admission order), k (its kind) and left (ticks left in its first processor burst)
    const cpuQ = J.slice(), diskQ = [], rowC = [], rowD = [];  // every job starts in the processor queue in admission order; the disk queue is empty; rowC and rowD record each tick's user
    let cpu = null, disk = null;  // cpu and disk hold the job each one is serving right now (null means idle)
    for (let t = 0; t < T; t++) {  // one pass of the loop per tick of the T-tick window
      if (!cpu && cpuQ.length) cpu = cpuQ.shift();  // a free processor takes the job at the front of its queue (first come first served)
      if (!disk && diskQ.length) disk = diskQ.shift();  // a free disk does the same with its own queue
      rowC.push(cpu ? cpu.n : -1); rowD.push(disk ? disk.n : -1);  // records this tick for the timeline: the job number on the processor and on the disk, or -1 for idle
      let toDisk = null, toCpu = null;  // toDisk and toCpu hold a job that finishes its burst this tick and must change queues
      if (cpu && !--cpu.left) { cpu.left = MIX_KIND[cpu.k][1]; toDisk = cpu; cpu = null; }  // the processor job works one tick; if its burst is over it gets its disk-burst length and leaves the processor for the disk queue
      if (disk && !--disk.left) { disk.left = MIX_KIND[disk.k][0]; toCpu = disk; disk = null; }  // the disk job works one tick; if its burst is over it gets its next processor-burst length and leaves the disk
      if (toCpu) cpuQ.push(toCpu);  // the job leaving the disk joins the back of the processor queue
      if (toDisk) diskQ.push(toDisk);  // the job leaving the processor joins the back of the disk queue
    }  // ends the tick loop
    const busy = (r) => r.filter((x) => x >= 0).length;  // busy(r): counts the ticks in a timeline row where some job was being served (not -1)
    return { rowC, rowD, cpu: busy(rowC) / T, disk: busy(rowD) / T };  // hands back both timeline rows plus how busy the processor and the disk were, as fractions from 0 to 1
  }  // ends mixRun()

  /* Simple multiprogramming model for "how many to admit": if each process waits
     for I/O a fraction p of the time, independently of the others, the processor
     is idle only when all n wait at once, so utilization = 1 - p^n. */
  const mpUtil = (n, p) => 1 - Math.pow(p, n);  // mpUtil(n, p): processor utilization 1 − p^n for n processes that each wait for I/O a fraction p of the time; used by the How many? tab
  /* ENGINE-END */

  Guide.section({  // registers section 9.1 with the guide, which builds its pages, glossary, notes and quiz from this description
    id: '9.1',  // section number, used for page addresses and cross-references
    title: 'Types of Processor Scheduling',  // full title shown at the top of every step
    short: 'Scheduling types',  // short title for the contents list
    summary: 'Long-, medium- and short-term scheduling: who decides what, on which states, and how often.',  // one-line summary shown on the chapter page
    objectives: [  // learning objectives listed for the student
      'Explain what processor scheduling is for and name the four kinds of scheduling decision.',  // objective 1: what scheduling is for, and naming the four kinds of decision
      'Place long-term, medium-term and short-term scheduling on the seven-state process model and the queuing diagram.',  // objective 2: placing the three processor schedulers on the state model and the queuing diagram
      'Explain how long-term scheduling controls the degree of multiprogramming, and when and which jobs it admits.',  // objective 3: how admission sets the degree of multiprogramming, and the when and which of admitting
      'Explain why medium-term scheduling is part of swapping, and list the events that invoke the short-term scheduler.',  // objective 4: medium-term scheduling as part of swapping, and the events that call the short-term scheduler
      'Compare how often each scheduler runs, and why the short-term scheduler must be fast.',  // objective 5: comparing how often each scheduler runs and why the short-term one must be quick
    ],  // closes the objectives list
    terms: [  // glossary terms for this section; dotted words on the page show these definitions when clicked or hovered
      ['Processor scheduling', 'Deciding which process gets the processor, and when, so the system meets its goals, such as quick response, high throughput and efficient use of the processor.'],  // glossary entry: defines processor scheduling and the goals it serves
      ['Long-term scheduling', 'The decision whether to add a newly submitted program to the pool of processes the OS will run. It controls the degree of multiprogramming and runs rarely.'],  // glossary entry: long-term scheduling, the admission decision that sets how many processes run
      ['Medium-term scheduling', 'The decision whether a process should be partly or fully in main memory, or swapped out to disk. It is the swapping part of the OS.'],  // glossary entry: medium-term scheduling, the swapping decision about what stays in main memory
      ['Short-term scheduling', 'The decision which ready process in main memory runs on the processor next. It is carried out by the dispatcher and runs many times a second.'],  // glossary entry: short-term scheduling, the dispatcher's frequent choice of who runs next
      ['I/O scheduling', 'The decision which pending I/O request an available device (such as a disk) handles next.'],  // glossary entry: I/O scheduling, the order in which a device serves pending requests
      ['Degree of multiprogramming', 'The number of processes active in the system at the same time, sharing the processor and main memory.'],  // glossary entry: degree of multiprogramming, the number of processes active at once
      ['Admission', 'Accepting a newly created process into the pool that competes for the system: the move from New to Ready, or from New to Ready/Suspend when memory is full.'],  // glossary entry: admission, the move from New into Ready or Ready/Suspend
      ['Batch job', 'A program submitted to run with no user interacting with it. It waits (usually on disk) until the long-term scheduler admits it.'],  // glossary entry: batch job, a program run with no user at the keyboard that waits to be admitted
      ['Processor-bound process', 'A process that mostly computes: it uses long stretches of processor time and does little I/O. Also called CPU-bound.'],  // glossary entry: processor-bound process, one that mostly computes (also called CPU-bound)
      ['I/O-bound process', 'A process that mostly waits for I/O: it runs for short bursts, then blocks for a device, again and again.'],  // glossary entry: I/O-bound process, one that runs in short bursts between device waits
      ['Saturation', 'The point where a system already serves as many users or processes as it can with acceptable performance. A saturated time-sharing system refuses new logins.'],  // glossary entry: saturation, the point where a system cannot take on more users and still perform well
      ['Queuing diagram', 'A picture of the OS as a network of waiting lines (queues). Arrows show the events and scheduling decisions that move a process from one queue to another.'],  // glossary entry: queuing diagram, the OS drawn as a network of waiting lines joined by arrows
    ],  // closes the glossary list

    css: ` /* styles used only by this section; every rule starts with .sec-9-1 so it cannot affect other sections */
      .sec-9-1 .msg { border-radius: 10px; padding: 9px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; } /* .msg: the message boxes: rounded corners, padding, a pale panel background, a thin border and easy-to-read 15px text */
      .sec-9-1 .msg.ok { border-color: var(--ok); background: var(--ok-bg); } /* a message of kind ok gets a green border and a pale green background */
      .sec-9-1 .msg.bad { border-color: var(--bad); background: var(--bad-bg); } /* a message of kind bad gets a red border and a pale red background */
      .sec-9-1 .msg.info { border-color: var(--accent); background: var(--accent-bg); } /* a message of kind info gets the accent colour for its border and background */
      .sec-9-1 .msg b.h { display: block; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2px; } /* the heading inside a message sits on its own line in small, spaced-out capital letters */
      .sec-9-1 .msg.ok b.h { color: var(--ok); } .sec-9-1 .msg.bad b.h { color: var(--bad); } .sec-9-1 .msg.info b.h { color: var(--accent); } /* colours that heading to match its box: green for ok, red for bad, the accent colour for info */
      .sec-9-1 svg text { font-family: var(--font); } /* text inside this section's drawings uses the guide's own font instead of the browser default */
      .sec-9-1 svg .lbl { font-size: 13.5px; font-weight: 700; paint-order: stroke; stroke: var(--panel); stroke-width: 4px; stroke-linejoin: round; } /* .lbl labels in drawings: bold, with a thick outline in the background colour behind the letters so they stay readable over lines */
      .sec-9-1 svg .s-sub { fill: var(--muted); } /* .s-sub: grey for the smaller secondary labels in drawings */

      .sec-9-1 .frow { cursor: pointer; outline: none; } /* .frow: each row of the "how often" chart shows a pointer cursor because it can be clicked; its own highlight replaces the focus outline */
      .sec-9-1 .frow .hit { fill: transparent; stroke: transparent; stroke-width: 2; } /* the invisible rectangle behind a row that makes the whole row clickable, not just its text */
      .sec-9-1 .frow:hover .hit, .sec-9-1 .frow:focus-visible .hit { fill: var(--panel-2); } /* hovering over a row, or reaching it with the Tab key, tints its background */
      .sec-9-1 .frow.on .hit { fill: var(--accent-bg); stroke: var(--accent); } /* the selected row gets a pale accent background and an accent border */
      .sec-9-1 .frow .track { fill: var(--panel-2); stroke: var(--line-2); stroke-width: 1; } /* the grey track that each row's decision marks are drawn on */

      .sec-9-1 .ring { cursor: pointer; outline: none; } /* .ring: the three scheduling rings in the state diagram are clickable, so they show a pointer cursor; no browser focus outline */
      .sec-9-1 .ring rect { stroke-width: 2; stroke-dasharray: 8 5; transition: stroke-width .15s; } /* ring outlines are 2px and dashed; their thickness changes smoothly (over 0.15 s) when a ring is highlighted */
      .sec-9-1 .ring.long rect { fill: color-mix(in srgb, var(--os) 6%, transparent); stroke: var(--os); } /* long-term ring: a very faint violet tint that lets the page show through, and a violet outline */
      .sec-9-1 .ring.medium rect { fill: color-mix(in srgb, var(--mem) 8%, var(--panel)); stroke: var(--mem); } /* medium-term ring: a faint green tint mixed with the panel colour, so it covers the tint of the ring outside it; green outline */
      .sec-9-1 .ring.short rect { fill: color-mix(in srgb, var(--cpu) 8%, var(--panel)); stroke: var(--cpu); } /* short-term ring: a faint blue tint over the panel colour and a blue outline */
      .sec-9-1 .ring.on rect, .sec-9-1 .ring:hover rect, .sec-9-1 .ring:focus-visible rect { stroke-width: 3.5; } /* the selected ring, or one under the mouse or the keyboard focus, gets a thicker outline */
      .sec-9-1 .ring .rl { font-size: 13.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; } /* .rl: the ring titles, in bold capital letters spaced slightly apart */
      .sec-9-1 .ring.long .rl { fill: var(--os); } .sec-9-1 .ring.medium .rl { fill: var(--mem); } .sec-9-1 .ring.short .rl { fill: var(--cpu); } /* colours each ring title like its ring: violet long-term, green medium-term, blue short-term */
      .sec-9-1 .st rect { stroke-width: 2.2; transition: opacity .2s; } /* .st: the seven state boxes get a 2.2px outline and fade smoothly when they are dimmed */
      .sec-9-1 .st.dash rect { stroke-dasharray: 7 4; } /* the two suspended states, which live on disk, get dashed outlines */
      .sec-9-1 .st .nm { font-size: 14.5px; font-weight: 800; text-anchor: middle; dominant-baseline: central; pointer-events: none; } /* .nm: the state name, bold and centred in its box both ways; it ignores the mouse so it never blocks a click */
      .sec-9-1 .st.dim { opacity: .35; } /* a state that has nothing to do with the current highlight fades to 35% */
      .sec-9-1 .st.dash .nm { font-size: 13px; } /* the longer suspended-state names use slightly smaller letters so they fit in their boxes */
      .sec-9-1 .ar { cursor: pointer; outline: none; } /* .ar: each arrow in the state diagram can be clicked, so it shows a pointer cursor; no browser focus outline */
      .sec-9-1 .ar .ln { fill: none; stroke-width: 2.4; } /* .ln: the visible arrow line, 2.4px thick and never filled */
      .sec-9-1 .ar .hit { fill: none; stroke: transparent; stroke-width: 16; pointer-events: stroke; } /* .hit: an invisible 16px-wide band along each arrow, so a thin line is still easy to click or tap */
      .sec-9-1 .ar.long .ln { stroke: var(--os); } .sec-9-1 .ar.long text { fill: var(--os); } /* long-term arrows and their labels in violet */
      .sec-9-1 .ar.medium .ln { stroke: var(--mem); } .sec-9-1 .ar.medium text { fill: var(--mem); } /* medium-term arrows and their labels in green */
      .sec-9-1 .ar.short .ln { stroke: var(--cpu); } .sec-9-1 .ar.short text { fill: var(--cpu); } /* short-term arrows and their labels in blue */
      .sec-9-1 .ar.event .ln { stroke: var(--muted); stroke-dasharray: 6 5; } .sec-9-1 .ar.event text { fill: var(--ink-2); } /* event arrows, which no scheduler chooses: grey and dashed, with dark grey labels */
      .sec-9-1 .ar:hover .ln, .sec-9-1 .ar:focus-visible .ln { stroke-width: 3.4; } /* hovering over an arrow, or reaching it with the Tab key, thickens its line */
      .sec-9-1 .ar.on .ln { stroke-width: 4; } /* the selected arrow gets the thickest line */
      .sec-9-1 .ar.dim { opacity: .16; } /* arrows that are not part of the current highlight fade almost out of sight */

      .sec-9-1 .qa { fill: none; stroke-width: 2.2; opacity: .75; } /* .qa: the arrows of the queuing diagram: unfilled, 2.2px and slightly see-through */
      .sec-9-1 .qa.os { stroke: var(--os); } .sec-9-1 .qa.mem { stroke: var(--mem); } .sec-9-1 .qa.cpu { stroke: var(--cpu); } /* colours queuing arrows by scheduler: violet long-term, green medium-term, blue short-term */
      .sec-9-1 .qa.muted { stroke: var(--muted); stroke-dasharray: 6 4; } /* event arrows in the queuing diagram are grey and dashed */
      .sec-9-1 .qa.on { stroke: var(--accent); stroke-width: 4; opacity: 1; stroke-dasharray: none; } /* the arrow used by the move just made: solid, thick, fully visible and in the accent colour */
      .sec-9-1 .qa.faint { opacity: .4; } /* the other arrows fade while a move is highlighted */
      .sec-9-1 .qglow { fill: none; stroke: var(--hl); stroke-width: 12; stroke-linejoin: round; opacity: .9; } /* .qglow: a wide yellow highlight drawn under the arrow just used, so it stands out at a glance */
      .sec-9-1 .qal { font-size: 13px; } /* .qal: the arrow labels in the queuing diagram, 13px */
      .sec-9-1 .qal.os { fill: var(--os); } .sec-9-1 .qal.mem { fill: var(--mem); } .sec-9-1 .qal.muted { fill: var(--ink-2); } /* colours arrow labels like their arrows: violet, green, or dark grey for events */
      .sec-9-1 .qal.on { fill: var(--accent); } /* the label of the arrow just used turns the accent colour too */
      .sec-9-1 .qbox { stroke-width: 2; } /* .qbox: the queue boxes get a 2px outline */
      .sec-9-1 .qbox.disk { stroke-dasharray: 7 4; } /* queues kept on disk (the suspended ones) get dashed outlines */
      .sec-9-1 .qnode { stroke-width: 2; } /* .qnode: the small Long-term and Short-term scheduler boxes in the diagram, 2px outline */
      .sec-9-1 .qnode.on { stroke: var(--accent); stroke-width: 4; } /* the scheduler that made the latest move gets a thick accent outline */
      .sec-9-1 .qtok { fill: var(--panel); stroke: var(--proc); stroke-width: 2; } /* .qtok: the small process boxes inside a queue: plain fill with a teal outline (teal = process) */
      .sec-9-1 .qtok.run { fill: var(--cpu-bg); stroke: var(--cpu); } /* the process on the processor is drawn in processor blue instead */

      .sec-9-1 .lane { display: grid; grid-template-columns: 132px minmax(0, 1fr); align-items: center; gap: 8px; border: 1px solid var(--line); /* .lane: one queue row in the lab: a 132px label column, then the job tokens, inside a thin border */
        border-radius: 10px; padding: 3px 10px; background: var(--panel-2); min-height: 44px; } /* rounded corners, a little padding, a pale background and a minimum height so an empty lane does not collapse */
      .sec-9-1 .lane.cpu { border-color: color-mix(in srgb, var(--cpu) 45%, transparent); background: var(--cpu-bg); } /* the Processor lane is tinted blue so it stands out from the queues */
      .sec-9-1 .lane .lbl { font-weight: 800; font-size: 14px; line-height: 1.15; } /* a lane's label: bold, 14px */
      .sec-9-1 .lane .lbl small { display: block; font-weight: 600; color: var(--muted); font-size: 12.5px; } /* the small grey second line under a lane label, such as "New" under Batch queue */
      .sec-9-1 .toks { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; min-height: 34px; } /* .toks: the row of job tokens in a lane; it wraps onto another line when it fills up */
      .sec-9-1 .tok { position: relative; width: 50px; height: 32px; border-radius: 9px; border: 2px solid var(--proc); background: var(--proc-bg); /* .tok: one job button: a 50 by 32 pixel rounded box with a teal outline and fill; positioned so its corner badge can sit on it */
        color: var(--ink); font-weight: 800; font-size: 14.5px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; flex: none; } /* bold dark text centred inside; a pointer cursor because clicking selects the job; it never shrinks */
      .sec-9-1 .tok.run { border-color: var(--cpu); background: var(--panel); } /* the running job: blue outline on a plain background */
      .sec-9-1 .tok.blk { border-color: var(--warn); background: var(--warn-bg); } /* a blocked job: amber outline and pale amber fill */
      .sec-9-1 .tok.new { border-color: var(--line-2); background: var(--panel); } /* a New job not yet admitted: grey outline on a plain background */
      .sec-9-1 .tok.sus { border-style: dashed; } /* suspended jobs, on disk, get a dashed outline */
      .sec-9-1 .tok.ex { opacity: .55; border-style: dashed; border-color: var(--line-2); background: var(--panel-2); } /* a finished job: faded, dashed and grey */
      .sec-9-1 .tok.sel { outline: 3px solid var(--accent); outline-offset: 2px; } /* the selected job gets a thick accent ring around it */
      .sec-9-1 .tok .tag { position: absolute; top: -8px; right: -8px; min-width: 17px; height: 17px; border-radius: 9px; font-size: 11.5px; line-height: 17px; /* .tag: the small badge on a token's top-right corner that shows the ticks left in the current burst */
        font-weight: 800; background: var(--cpu); color: var(--panel); padding: 0 4px; } /* bold white number on processor blue */
      .sec-9-1 .tok .tag.io { background: var(--io); } /* the badge turns orange while the job is in an I/O burst */
      .sec-9-1 .lane.hit { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-bg); } /* a lane touched by the last move (in the phone-width queuing view) gets an accent border and glow */
      .sec-9-1 .empty { font-size: 13px; color: var(--muted); font-style: italic; } /* .empty: grey italic placeholder text such as "empty" or "idle" in a lane with no jobs */
      .sec-9-1 .membox { border: 2px solid color-mix(in srgb, var(--mem) 55%, transparent); border-radius: 12px; padding: 6px 8px 8px; } /* .membox: the green-bordered box around the lanes that are in main memory */
      .sec-9-1 .diskbox { border: 2px dashed var(--line-2); border-radius: 12px; padding: 6px 8px 8px; } /* .diskbox: the dashed grey box around the lanes in the swap area on disk */
      .sec-9-1 .boxhead { font-size: 13.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; } /* .boxhead: the heading of the memory and disk boxes: bold, in one row with its chip */
      .sec-9-1 .ph { padding: 1px 8px; border-radius: 7px; border: 1.5px solid var(--line-2); font-weight: 700; font-size: 13.5px; } /* .ph: one burst in the selected job's burst list: a small rounded label */
      .sec-9-1 .ph.cpu { border-color: var(--cpu); } .sec-9-1 .ph.io { border-color: var(--io); } /* processor bursts are outlined blue, I/O bursts orange */
      .sec-9-1 .ph.cur.cpu { background: var(--cpu-bg); } .sec-9-1 .ph.cur.io { background: var(--io-bg); } /* the burst in progress is filled with its colour */
      .sec-9-1 .ph.done { opacity: .5; } /* finished bursts fade */
      .sec-9-1 .tally { display: grid; grid-template-columns: 112px minmax(0, 1fr) 34px; align-items: center; gap: 8px; } /* .tally: one row of the "Your decisions" bars: a 112px label, the bar, then a 34px count */
      .sec-9-1 .tally b { text-align: right; } /* the count at the end of the row is right-aligned */
      .sec-9-1 .labr > * { flex: none; } /* .labr: the lab's right-hand column; its parts keep their natural height and never shrink */

      .sec-9-1 .share { display: flex; height: 38px; border-radius: 9px; overflow: hidden; border: 1px solid var(--line-2); } /* .share: the bar split into each process's share of the processor; 38px tall with rounded corners */
      .sec-9-1 .share > div { display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; min-width: 0; overflow: hidden; } /* each segment centres its label and hides text that does not fit; min-width 0 lets very thin segments shrink */
      .sec-9-1 .seg-p { background: var(--proc-bg); border-right: 2px solid var(--proc); color: var(--proc); } /* .seg-p: one process's share: pale teal with a teal divider on its right */
      .sec-9-1 .seg-idle { background: repeating-linear-gradient(45deg, var(--panel-2) 0 6px, var(--panel-3) 6px 12px); color: var(--muted); } /* .seg-idle: idle processor time, drawn as grey diagonal stripes */
      .sec-9-1 .jobs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; padding-top: 4px; } /* .jobs: the six job cards of the process-mix game, in one row of six equal columns */
      .sec-9-1 .jobc { position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 4px; border-radius: 10px; /* .jobc: one job card button: contents stacked and centred, rounded; positioned so its number badge can sit on it */
        border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); cursor: pointer; font-size: 15px; line-height: 1.2; } /* grey border, plain background and a pointer cursor because clicking admits or removes the job */
      .sec-9-1 .jobc.p { border-color: color-mix(in srgb, var(--cpu) 50%, transparent); } .sec-9-1 .jobc.i { border-color: color-mix(in srgb, var(--io) 50%, transparent); } /* processor-bound cards have a faint blue border, I/O-bound ones a faint orange border */
      .sec-9-1 .jobc.on.p { background: var(--cpu-bg); border-color: var(--cpu); } .sec-9-1 .jobc.on.i { background: var(--io-bg); border-color: var(--io); } /* an admitted card fills with its colour and gets a full-strength border */
      .sec-9-1 .jobc.on::after { content: attr(data-n); position: absolute; top: -7px; right: 5px; width: 18px; height: 18px; border-radius: 9px; /* ::after: a round badge on an admitted card's top-right corner showing its admission order (taken from data-n) */
        background: var(--accent); color: var(--accent-ink); font-size: 12px; font-weight: 800; line-height: 18px; } /* the badge is accent-coloured with a small bold number */
      .sec-9-1 .tl { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 6px 8px; align-items: center; } /* .tl: the timeline grid: a 70px label column (Processor, Disk) beside the row of tick cells */
      .sec-9-1 .cells { display: grid; grid-template-columns: repeat(30, minmax(0, 1fr)); gap: 2px; } /* .cells: 30 equal columns, one per tick of the window */
      .sec-9-1 .cells .c { height: 30px; border-radius: 4px; font-style: normal; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; overflow: hidden; } /* .c: one tick cell: 30px tall, rounded, with a bold job number centred; not italic, even though cells are i elements */
      .sec-9-1 .cells .c.p { background: var(--cpu-bg); border: 1.5px solid var(--cpu); color: var(--cpu); } /* a tick used by a processor-bound job is blue */
      .sec-9-1 .cells .c.i { background: var(--io-bg); border: 1.5px solid var(--io); color: var(--io); } /* a tick used by an I/O-bound job is orange */
      .sec-9-1 .cells .c.idle { border: 1.5px dashed var(--line-2); } /* an idle tick is an empty dashed box */
      .sec-9-1 .slots { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; } /* .slots: the five login slots, in a row of equal columns */
      .sec-9-1 .slot { border: 2px solid var(--proc); background: var(--proc-bg); border-radius: 10px; min-height: 64px; display: flex; flex-direction: column; /* .slot: one active session: a teal box with its contents stacked and centred */
        align-items: center; justify-content: center; gap: 2px; } /* centring of the slot's contents, both ways */
      .sec-9-1 .ladder { display: flex; gap: 10px; align-items: stretch; } /* .ladder: the recap strip of the three schedulers, side by side and the same height */
      .sec-9-1 .rung { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 1px; padding: 8px 12px; border-radius: 12px; border: 2px dashed; } /* .rung: one card of the strip: flexible width, stacked lines of text, rounded dashed border */
      .sec-9-1 .rung.os { border-color: var(--os); background: var(--os-bg); } .sec-9-1 .rung.os b { color: var(--os); } /* long-term card: violet border and tint, violet heading */
      .sec-9-1 .rung.mem { border-color: var(--mem); background: var(--mem-bg); } .sec-9-1 .rung.mem b { color: var(--mem); } /* medium-term card: green border and tint, green heading */
      .sec-9-1 .rung.cpu { border-color: var(--cpu); background: var(--cpu-bg); } .sec-9-1 .rung.cpu b { color: var(--cpu); } /* short-term card: blue border and tint, blue heading */
      .sec-9-1 .goal { display: flex; gap: 5px; flex-wrap: wrap; } /* .goal: the row of numbered squares that tracks progress in the "which scheduler reacts?" game; wraps if needed */
      .sec-9-1 .goal span { width: 26px; height: 26px; border-radius: 7px; display: inline-grid; place-items: center; font-size: 13px; font-weight: 800; /* one numbered square: 26px, rounded, with its number centred */
        border: 2px solid var(--line-2); color: var(--muted); background: var(--panel); } /* unanswered squares: grey border and grey number */
      .sec-9-1 .goal span.done { background: var(--ok); border-color: var(--ok); color: var(--panel); } /* answered right: filled green with a white number */
      .sec-9-1 .goal span.miss { background: var(--bad); border-color: var(--bad); color: var(--panel); } /* answered wrong: filled red with a white number */
      .sec-9-1 .goal span.cur { border-color: var(--accent); color: var(--accent); } /* the event being shown now: accent outline and number */
      .sec-9-1 .scen { font-size: 19px; line-height: 1.45; font-weight: 600; min-height: 84px; padding: 12px 14px; border-radius: 12px; /* .scen: the box that shows the current event in the "which scheduler reacts?" game: large semi-bold text, fixed minimum height */
        background: var(--panel-2); border: 1px solid var(--line); } /* a pale panel background with a thin border and rounded corners */
      .sec-9-1 .sorted .col { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; min-width: 0; } /* .sorted .col: one column of the results sorted by scheduler; its lines stack top to bottom, left-aligned */
      .sec-9-1 .sorted .it { font-size: 13px; line-height: 1.25; color: var(--ink-2); } /* .it: one sorted result line, small and dark grey */
      .sec-9-1 .sorted .it.miss { color: var(--bad); } /* a result that was answered wrong is shown in red */
      .sec-9-1 .btn.right { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); opacity: 1; } /* .btn.right: after an answer, the correct scheduler's button turns green and stays fully visible even though it is disabled */
      .sec-9-1 .btn.wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); opacity: 1; } /* .btn.wrong: the button the student wrongly picked turns red, also fully visible */
      .sec-9-1 .slot.free { border-style: dashed; border-color: var(--line-2); background: transparent; color: var(--muted); font-size: 13px; font-style: italic; } /* .slot.free: an empty login slot: dashed grey outline, no fill, small grey italic "free" */
      .sec-9-1 .bar { height: 12px; border-radius: 6px; background: var(--panel-3); overflow: hidden; } /* .bar: the thin rounded track behind each decision-tally bar */
      .sec-9-1 .bar > i { display: block; height: 100%; border-radius: 6px; transition: width .3s; } /* .bar > i: the coloured fill of a tally bar; the script sets its width and it grows smoothly */
    `,  // end of the CSS text

    steps: [  // the ordered list of steps (pages) in this section
      /* ============ 1. Big picture: four decisions on four time scales ============ */
      {  // opens step 1
        title: 'One processor, many processes: who decides?',  // step title
        kind: 'story',  // kind "story": the opening explanation page of the section
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 1; draws the how-often chart and the introduction
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements (SVG is the browser's drawing format)
          /* Example decision rates per second for one busy server (illustrative only). */
          const ROWS = [  // ROWS: one row per scheduler: [key, decisions per second, subtitle, restaurant comparison, when it runs]
            ['long', 1 / 180, 'admits new work', 'The host at the door decides whether a new party gets in tonight. When the dining room is full, newcomers are told to come back later.', 'Rarely: when a job finishes, when the processor has been idle too much of the time, or when someone tries to log in.'],  // long-term row: one decision every 3 minutes (1/180 per second); the host at the door, and the moments it acts
            ['medium', 1 / 5, 'swaps in and out', 'The manager asks a party that is waiting on something to move to the bar, which frees their table, and seats them again later.', 'Now and then: when main memory runs short, or when room opens up again.'],  // medium-term row: one decision every 5 seconds; the manager moving waiting parties to the bar, and when it acts
            ['short', 200, 'dispatches', 'The chef picks which order to cook next. That choice is made again every time a dish is finished or set aside.', 'Constantly: on every clock interrupt, I/O interrupt, system call and semaphore signal that might change who should run.'],  // short-term row: 200 decisions a second; the chef choosing the next order, and the events that call it
            ['io', 100, 'orders device requests', 'The single oven works through the baking requests in some order: whose tray goes in next?', 'Every time a device finishes one request while others are waiting. Each device has its own queue. I/O scheduling is a topic of its own; the rest of this section is about the three processor schedulers.'],  // I/O row: 100 a second; the oven's line of trays; it also says the rest of the section is about the processor schedulers only
          ];  // closes ROWS
          const WIN = { 1: '1 second', 60: '1 minute', 3600: '1 hour' };  // WIN: the three time windows the switch offers, in seconds, with their labels
          /* Small screens put the label above a full-width track; wide screens put it on the left. */
          const SLIM = ctx.narrow, W = SLIM ? 340 : 600, X0 = SLIM ? 6 : 150, X1 = SLIM ? 334 : 470, RH = SLIM ? 72 : 64, Y0 = 12, TY = SLIM ? 24 : 4;  // SLIM is true on small screens; W = drawing width, X0 and X1 = the track's ends, RH = row height, Y0 = top margin, TY = track offset in a row
          const svg = s('svg', { viewBox: `0 0 ${W} ${Y0 + ROWS.length * RH}`, width: '100%', role: 'img', 'aria-label': 'How often each scheduler makes a decision' });  // the SVG drawing for the chart; viewBox sets its coordinate size, one row height per scheduler; aria-label describes it for screen readers
          const info = h('div', { class: 'msg info', style: { minHeight: '112px' } });  // info: the message box under the chart that explains the clicked row; its minimum height stops the page jumping
          let win = 60, sel = null;  // win: the chosen window in seconds (1 minute at first); sel: the key of the selected row (none yet)
          const rowEls = [];  // rowEls: the drawn row groups, kept so pick() can highlight one of them
          function pick(k) {  // pick(k): runs when a row is clicked; selects it and explains that scheduler in the info box
            sel = k;  // remembers the choice so the highlight survives a redraw
            const r = ROWS.find((x) => x[0] === k);  // finds that scheduler's entry in ROWS
            rowEls.forEach((g) => g.classList.toggle('on', g.dataset.k === k));  // highlights the clicked row and removes the highlight from the others
            say(info, 'info', `${SCH[k].name} scheduling`, `<b>${SCH[k].q}</b> ${r[4]}<div class="small" style="margin-top:5px"><b>In the restaurant:</b> ${r[3]}</div>`);  // fills the info box: the scheduler's question, when it runs, and the restaurant comparison
          }  // ends pick()
          function draw() {  // draw(): draws every row of the chart for the current window; runs at the start and whenever the window changes
            svg.replaceChildren();  // clears the old drawing
            rowEls.length = 0;  // empties the rowEls list, ready for the new rows
            ROWS.forEach(([k, rate, sub], i) => {  // for each scheduler row: its key, rate and subtitle, plus its position i
              const y = Y0 + i * RH, n = rate * win, cnt = Math.round(n);  // y = top of this row; n = expected decisions in the window (rate times seconds); cnt = n rounded to whole decisions
              const g = s('g', { class: 'frow' + (sel === k ? ' on' : ''), 'data-k': k, role: 'button', tabindex: 0, 'aria-label': SCH[k].name + ' scheduling' });  // g: an SVG group for the whole row that acts as a button reachable with Tab, labelled for screen readers; on if selected
              const count = n < 0.5 ? 'usually 0' : '≈ ' + cnt.toLocaleString('en-US');  // count: "usually 0" when fewer than half a decision is expected, otherwise "≈" and the number with thousands separators
              g.append(s('rect', { x: 0, y: y - 5, width: W, height: RH - 4, rx: 10, class: 'hit' }),  // adds the invisible full-width rectangle that makes the row clickable and shows its highlight
                s('text', { x: SLIM ? 6 : 10, y: y + (SLIM ? 14 : 19), 'font-size': 15.5, 'font-weight': 800, style: `fill:var(--${SCH[k].cls})` }, SCH[k].name),  // the scheduler's name, in its own colour, at the row's top left
                s('rect', { x: X0, y: y + TY, width: X1 - X0, height: 36, rx: 6, class: 'track' }));  // the grey track that holds the decision marks
              if (!SLIM) g.append(s('text', { x: 10, y: y + 39, 'font-size': 13, class: 's-sub' }, sub));  // on wide screens the short subtitle, such as "dispatches", goes under the name
              if (cnt > 150) {  // more than 150 decisions: too many marks to draw clearly
                g.append(s('rect', { x: X0, y: y + TY, width: X1 - X0, height: 36, rx: 6, style: `fill:var(--${SCH[k].cls});opacity:.55` }),  // so the whole track is filled with the scheduler's colour, slightly see-through
                  s('text', { x: (X0 + X1) / 2, y: y + TY + 23, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'lbl' }, 'too many to draw one by one'));  // and "too many to draw one by one" is written across it
              } else if (cnt > 0) {  // between 1 and 150 decisions: one mark per decision
                const rnd = ctx.util.seeded(7 + i * 31 + win);  // rnd: a seeded random generator (the same seed always gives the same numbers), so the marks land in the same spots on every redraw
                for (let j = 0; j < cnt; j++) {  // one pass per decision
                  const x = X0 + 4 + ((j + 0.15 + rnd() * 0.7) / cnt) * (X1 - X0 - 8);  // x: spreads the marks evenly along the track, each nudged a little at random so they look like real, irregular events
                  g.append(s('line', { x1: x, y1: y + TY + 4, x2: x, y2: y + TY + 32, style: `stroke:var(--${SCH[k].cls});stroke-width:${cnt > 60 ? 1.5 : 3}` }));  // draws the mark as a short upright line in the scheduler's colour, thinner when there are many
                }  // ends the loop over marks
              } else {  // no decision expected in this window
                g.append(s('text', { x: (X0 + X1) / 2, y: y + TY + 23, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'no decision expected in this window'));  // so the track says "no decision expected in this window" in grey
              }  // ends the three cases
              if (SLIM) g.append(s('text', { x: W - 6, y: y + 14, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800 }, count + (n < 0.5 ? '' : cnt === 1 ? ' decision' : ' decisions')));  // small screens: the count and the word decision or decisions go at the right end of the name line
              else g.append(s('text', { x: X1 + 12, y: y + 19, 'font-size': 15, 'font-weight': 800 }, count),  // wide screens: the count goes just right of the track
                s('text', { x: X1 + 12, y: y + 39, 'font-size': 13, class: 's-sub' }, cnt === 1 ? 'decision' : 'decisions'));  // with the word decision or decisions under it in grey
              g.addEventListener('click', () => pick(k));  // clicking the row selects it
              g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); } });  // Enter or Space selects it too, for keyboard users; preventDefault stops Space from scrolling the page
              rowEls.push(g);  // keeps the row for pick()
              svg.append(g);  // adds the row to the drawing
            });  // ends the loop over rows
          }  // ends draw()
          const seg = ctx.ui.seg(Object.entries(WIN).map(([v, label]) => ({ value: +v, label })), win, (v) => { win = v; draw(); });  // seg: the 1 second / 1 minute / 1 hour switch; choosing one stores the window and redraws the chart
          draw();  // draws the chart for the first time
          say(info, 'info', 'Click a row', 'Each row is one kind of scheduler. Switch the time window above and watch the scale change; click a row to see what that scheduler decides and when it runs.');  // starting message in the info box: what the rows are and how to use the switch
          el.append(h('div', { class: 'split l fill' },  // puts the page together: two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: a stack of text blocks
              h('p', { class: 'lead m0', html: 'A computer may hold dozens of processes that all want its one processor. <span class="t">Processor scheduling</span> decides who gets the processor, and when.' }),  // opening sentence: many processes want one processor; the dotted term opens its glossary entry
              h('p', { class: 'm0', html: 'The OS schedules to meet goals such as <b>quick <span class="t">response time</span></b>, high <span class="t">throughput</span> and efficient use of the processor. It does this with <b>four kinds of decision</b>, made on very different time scales: ' + chip('long') + ' ' + chip('medium') + ' ' + chip('short') + ' ' + chip('io') + '.' }),  // paragraph: the goals of scheduling and the four kinds of decision, each shown as a coloured chip
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'Picture a busy restaurant with <b>one chef</b> (the processor). A host decides who may come in, a manager moves waiting parties out to the bar and back, the chef keeps choosing the next order, and the oven works through its own line of trays. Four decision makers, one kitchen.' }),  // analogy callout: a restaurant with one chef and four decision makers
              h('div', { class: 'card tight small', html: '<b>In this section you will</b> see where each scheduler acts on the seven-state process model, follow processes through a network of queues, run a small system yourself as all three processor schedulers, and choose which jobs to admit.' })),  // card: what the student will do in the rest of this section
            h('div', { class: 'card white stack' },  // right column: a white card holding the chart
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'How often does each one decide?'), seg),  // header row: the chart title on the left, the window switch on the right
              h('p', { class: 'xs muted m0' }, 'Illustrative rates for an imaginary busy server, not measurements; real systems vary widely. Click a row for details.'),  // small grey fine print: the rates are illustrative, not measurements
              svg, info)));  // then the chart and its info box; closes both columns
        },  // ends render() for step 1
      },  // ends step 1

      /* ============ 2. The schedulers on the seven-state model (nested rings) ============ */
      {  // opens step 2
        title: 'Where each scheduler acts on the state diagram',  // step title
        kind: 'explore',  // kind "explore": an interactive page to experiment with
        core: true,  // core: true keeps this step in the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 2; draws the state diagram inside the three rings and wires up the clicks
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const NAME = { new: 'New', exit: 'Exit', rs: 'Ready/Suspend', bs: 'Blocked/Suspend', ready: 'Ready', running: 'Running', blocked: 'Blocked' };  // NAME: the display name of each of the seven states, keyed by a short id
          const SHAPE = { new: 's-panel', exit: 's-panel', rs: 's-proc', bs: 's-warn', ready: 's-proc', running: 's-cpu', blocked: 's-warn' };  // SHAPE: the colour class of each state box: grey for New and Exit, teal for the ready states, amber for blocked, blue for Running
          const ST = { new: [100, 48], exit: [540, 48], rs: [100, 220], bs: [100, 380], ready: [300, 220], running: [510, 220], blocked: [300, 380] };  // ST: the centre point [x, y] of each state box in the wide drawing
          const RING = {  // RING: the three rings: [x, y, width, height, [title x, title y, alignment], explanation, states inside]
            long: [4, 4, 632, 462, [320, 54, 'middle'], 'Outermost ring: <b>New</b> and <b>Exit</b>. Long-term scheduling decides whether a process may enter the system at all. Its arrows are New → Ready and New → Ready/Suspend.', ['new', 'exit']],  // long-term ring: the outermost box; its explanation of admission; New and Exit belong to it
            medium: [20, 92, 604, 366, [32, 448, 'start'], 'Middle ring: the two <b>suspended</b> states. Medium-term scheduling decides which processes are in main memory. It swaps processes between Ready and Ready/Suspend, and between Blocked and Blocked/Suspend. (The rare Running → Ready/Suspend move, preempting a process and swapping it out at once, is left off this drawing.)', ['rs', 'bs']],  // medium-term ring: the middle box; its explanation of swapping; the two suspended states belong to it
            short: [200, 126, 408, 302, [596, 418, 'end'], 'Innermost ring: <b>Ready</b>, <b>Running</b> and <b>Blocked</b>, the processes already in main memory. Short-term scheduling makes one move, Ready → Running, but it makes it far more often than any other.', ['ready', 'running', 'blocked']],  // short-term ring: the innermost box; its explanation of dispatching; Ready, Running and Blocked belong to it
          };  // closes RING
          /* [id, path, label x, label y, anchor, label, who decides, from → to, explanation] */
          const AR = [  // AR: the twelve arrows of the diagram; each entry follows the field order in the comment above
            ['admit', 'M140,69 L262,197', 214, 120, 'start', 'admit', 'long', 'New → Ready', 'The long-term scheduler admits a new process into the pool that competes for the processor. There is room in main memory, so it goes straight to Ready.'],  // arrow New → Ready, a long-term admission while memory has room; its line, label spot and explanation
            ['admitS', 'M100,69 L100,197', 92, 150, 'end', 'admit', 'long', 'New → Ready/Suspend', 'Also an admission, but main memory is full, so the new process starts out swapped out on disk. Medium-term scheduling can bring it in later.'],  // arrow New → Ready/Suspend, an admission while memory is full, so the process starts on disk
            ['activate', 'M162,212 L236,212', 199, 205, 'middle', 'activate', 'medium', 'Ready/Suspend → Ready', 'Swap in: the medium-term scheduler brings a process back into main memory, for example because room has opened up or because nothing in memory is ready to run.'],  // arrow Ready/Suspend → Ready, a medium-term swap in
            ['suspendR', 'M238,228 L164,228', 199, 247, 'middle', 'suspend', 'medium', 'Ready → Ready/Suspend', 'Swap out: memory is needed. The OS would rather swap out a Blocked process, but it may pick a Ready one, typically one with low priority.'],  // arrow Ready → Ready/Suspend, a medium-term swap out of a ready process when memory is needed
            ['dispatch', 'M362,212 L446,212', 404, 205, 'middle', 'dispatch', 'short', 'Ready → Running', 'The short-term scheduler (the <span class="t">dispatcher</span>) picks one process from the ready queue and gives it the processor. This is the decision made many times every second.'],  // arrow Ready → Running, the short-term dispatch; the dotted word links to the dispatcher's glossary entry
            ['timeout', 'M448,228 L364,228', 406, 247, 'middle', 'timeout', 'event', 'Running → Ready', 'A clock interrupt ends the time slice, or a more important process has become ready (preemption). The process goes back to Ready and the short-term scheduler picks who runs next.'],  // arrow Running → Ready, the time-out event (a clock interrupt or a preemption), not a scheduler's choice
            ['release', 'M515,199 L535,71', 533, 137, 'start', 'release', 'event', 'Running → Exit', 'The process finishes or is aborted. Its memory is freed, which gives the long-term scheduler a chance to admit another job, and the short-term scheduler must find a new process to run.'],  // arrow Running → Exit, the release event when a process finishes, which frees memory for new work
            ['wait', 'M490,241 L340,357', 430, 308, 'start', 'event wait', 'event', 'Running → Blocked', 'The process asks for I/O or waits on a semaphore, so it cannot continue. Its own request causes this move; the short-term scheduler must then choose another process.'],  // arrow Running → Blocked, the event wait caused by the process's own I/O request or semaphore wait
            ['occurs', 'M300,357 L300,243', 308, 300, 'start', 'event occurs', 'event', 'Blocked → Ready', 'The awaited event happens, for example an I/O interrupt reports a finished disk read. The process becomes Ready, and the short-term scheduler may decide that it should run now.'],  // arrow Blocked → Ready, the event occurs case, such as an I/O interrupt for a finished disk read
            ['suspendB', 'M238,372 L164,372', 199, 365, 'middle', 'suspend', 'medium', 'Blocked → Blocked/Suspend', 'Swap out a Blocked process. It cannot use its memory while it waits anyway, so this is the medium-term scheduler’s favourite way to free memory.'],  // arrow Blocked → Blocked/Suspend, the swap out the medium-term scheduler prefers, since a blocked process cannot use its memory
            ['activateB', 'M162,388 L236,388', 199, 407, 'middle', 'activate', 'medium', 'Blocked/Suspend → Blocked', 'An unusual swap in: the process is still waiting, but memory is free and its event is expected soon, so the OS brings it back early.'],  // arrow Blocked/Suspend → Blocked, the rare early swap in of a process whose event is expected soon
            ['occursS', 'M100,357 L100,243', 108, 300, 'start', 'event occurs', 'event', 'Blocked/Suspend → Ready/Suspend', 'The awaited event happens while the process is on disk. It is no longer waiting, but it still needs the medium-term scheduler to swap it in before it can run.'],  // arrow Blocked/Suspend → Ready/Suspend, the awaited event happening while the process is still on disk
          ];  // closes AR
          const MARK = { long: 'os', medium: 'mem', short: 'cpu', event: 'muted' };  // MARK: which arrowhead colour each kind of arrow uses: violet, green, blue, or grey for events
          /* Small screens get their own taller, slimmer drawing: suspended states along the bottom, no arrow
             labels (the buttons under the drawing name every arrow), and shorter ring titles. */
          const PH = ctx.narrow ? {  // PH: on small screens, a separate layout for the drawing (otherwise null): sizes, positions and arrow paths
            vb: [360, 432], bw: 104, bh: 34,  // vb: the drawing's width and height; bw and bh: the size of each state box
            st: { new: [70, 30], exit: [290, 30], ready: [88, 126], running: [270, 126], blocked: [212, 236], rs: [74, 360], bs: [212, 360] },  // st: the centre point of each state box in the phone-width drawing
            ring: { long: [2, 2, 356, 426, 180, 35, 'middle'], medium: [16, 58, 328, 356, 180, 80, 'middle'], short: [28, 92, 304, 212, 326, 292, 'end'] },  // ring: each ring's box and title position, flattened into one list per ring
            d: { admit: 'M70,47 L70,107', admitS: 'M18,30 L8,30 L8,360 L20,360', activate: 'M60,343 L60,145', suspendR: 'M96,143 L96,341',  // d: the arrow paths for this layout, written in SVG path language (M = move to a point, L = draw a line to a point)
              dispatch: 'M140,118 L216,118', timeout: 'M218,134 L142,134', release: 'M290,109 L290,49', wait: 'M252,143 L236,217',  // more arrow paths: dispatch, time-out, release and event wait
              occurs: 'M186,219 L124,145', suspendB: 'M198,253 L198,341', activateB: 'M226,343 L226,255', occursS: 'M160,360 L128,360' },  // the last arrow paths: event occurs, the blocked swaps, and event occurs on disk
          } : null;  // ends the phone-width layout; wide screens get null and use the positions given above
          const VB = PH ? PH.vb : [640, 470], BW = PH ? PH.bw : 124, BH = PH ? PH.bh : 42;  // VB: drawing size; BW and BH: state-box size, taken from the phone-width layout if there is one, otherwise the wide values
          const svg = s('svg', { viewBox: `0 0 ${VB[0]} ${VB[1]}`, width: '100%', class: 'rings', role: 'img', 'aria-label': 'Seven-state diagram inside three nested scheduling rings' });  // the SVG drawing; viewBox sets its coordinate size; aria-label describes it for screen readers
          const ringG = {}, arG = {}, stG = {};  // ringG, arG and stG keep the drawn rings, arrows and states by key, so they can be highlighted or dimmed later
          for (const [k, [x0, y0, w0, h0, [lx0, ly0, anchor0]]] of Object.entries(RING)) {  // draws the three rings, outermost first, so the inner ones are painted on top
            const [x, y, w, ht, lx, ly, anchor] = PH ? PH.ring[k] : [x0, y0, w0, h0, lx0, ly0, anchor0];  // picks the ring's box and title position from the phone-width layout or from RING
            const g = s('g', { class: 'ring ' + k, role: 'button', tabindex: 0, 'aria-label': SCH[k].name + ' scheduling ring' },  // g: a group for the ring that acts as a button reachable with Tab, labelled for screen readers
              s('rect', { x, y, width: w, height: ht, rx: PH ? 14 : 18 }),  // the ring's rounded dashed box
              s('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'rl' }, SCH[k].name + (PH ? '' : ' scheduling')));  // the ring's title; small screens drop the word "scheduling" to save room
            g.addEventListener('click', (e) => { e.stopPropagation(); focus(k); });  // clicking a ring explains it; stopPropagation keeps the click from also reaching the drawing behind it
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focus(k); } });  // Enter or Space does the same for keyboard users; preventDefault stops Space from scrolling the page
            ringG[k] = g;  // keeps the ring so light() can highlight it
            svg.append(g);  // adds the ring to the drawing
          }  // ends the loop over rings
          const arrowLayer = s('g'), stateLayer = s('g');  // two layers: arrows go in the first and states in the second, so state boxes are painted over arrow ends
          svg.append(arrowLayer, stateLayer);  // adds both layers to the drawing, on top of the rings
          AR.forEach(([id, d0, lx, ly, anchor, label, who]) => {  // draws every arrow: its id, wide-layout path, label position and alignment, label text and who decides
            const d = PH ? PH.d[id] : d0;  // d: the arrow's path, from the phone-width layout if there is one
            const g = s('g', { class: 'ar ' + who, role: 'button', tabindex: 0, 'aria-label': label },  // g: a group for the arrow that acts as a button reachable with Tab; its class sets its colour
              s('path', { d, class: 'ln', 'marker-end': `url(#arr-${MARK[who]})` }), s('path', { d, class: 'hit' }),  // the visible line with an arrowhead in the matching colour, plus the wide invisible copy that makes it easy to click
              PH ? null : s('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'lbl' }, label));  // the arrow's label next to it, left out on small screens where the buttons below name each arrow
            g.addEventListener('click', () => pickArrow(id));  // clicking an arrow explains that move
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickArrow(id); } });  // Enter or Space does the same for keyboard users
            arG[id] = g;  // keeps the arrow so light() can highlight or dim it
            arrowLayer.append(g);  // adds the arrow to the arrow layer
          });  // ends the loop over arrows
          for (const [id, [x, y]] of Object.entries(PH ? PH.st : ST)) {  // draws every state box at its centre point, from the phone-width layout or from ST
            const dash = id === 'rs' || id === 'bs';  // dash: true for the two suspended states, which get dashed outlines
            const g = s('g', { class: 'st' + (dash ? ' dash' : '') },  // g: a group for one state box
              s('rect', { x: x - BW / 2, y: y - BH / 2, width: BW, height: BH, rx: 11, class: SHAPE[id] }),  // the rounded box, centred on the point, coloured by SHAPE
              s('text', { x, y: y + 1, class: 'nm', style: PH ? `font-size:${dash ? 11.5 : 13}px` : null }, NAME[id]));  // the state's name in the middle; on small screens the font is smaller, especially for the long suspended names
            stG[id] = g;  // keeps the state so light() can dim it
            stateLayer.append(g);  // adds the state to the state layer
          }  // ends the loop over states
          const info = h('div', { class: 'msg info', style: { minHeight: '178px' } });  // info: the message box that explains the clicked ring or arrow; its minimum height stops the page jumping
          const btns = {};  // btns: the four legend buttons, kept by key so the chosen one can be highlighted
          const legend = h('div', { class: 'row gap-s' }, ...['long', 'medium', 'short', 'event'].map((k) => {  // legend: a row of buttons, one per scheduler plus one for events
            btns[k] = h('button', { type: 'button', class: 'btn sm ' + (k === 'event' ? '' : SCH[k].cls), onclick: () => focus(k) }, k === 'event' ? 'Events (no choice)' : SCH[k].name);  // each button is coloured like its scheduler and explains that scheduler's ring when clicked; the events button is plain
            return btns[k];  // keeps the button and hands it to the row
          }));  // ends the legend row
          function light(fnAr, fnSt, ring) {  // light(fnAr, fnSt, ring): sets the highlight: fnAr says on or dim for each arrow, fnSt says which states dim, ring names the ring to outline
            AR.forEach(([id]) => { const c = fnAr(id); arG[id].classList.toggle('on', c === 'on'); arG[id].classList.toggle('dim', c === 'dim'); });  // marks each arrow as on (thick), dim (faded) or neither
            Object.keys(stG).forEach((id) => stG[id].classList.toggle('dim', fnSt(id)));  // dims the states that fnSt picks
            Object.keys(ringG).forEach((k) => ringG[k].classList.toggle('on', k === ring));  // outlines the chosen ring, if any
            Object.keys(btns).forEach((k) => btns[k].classList.toggle('on', k === ring));  // highlights the matching legend button, if any
          }  // ends light()
          function focus(k) {  // focus(k): shows one scheduler's ring (or all the event arrows) and explains it
            const mine = AR.filter((a) => a[6] === k).map((a) => a[0]);  // mine: the ids of the arrows that scheduler k owns
            light((id) => (mine.includes(id) ? 'on' : 'dim'), (id) => k !== 'event' && !RING[k][6].includes(id), k);  // lights those arrows, dims the rest, dims the states outside ring k (no states dim for events) and outlines ring k
            const head = k === 'event' ? 'Events, not scheduling choices' : SCH[k].name + ' scheduling';  // head: the heading for the info box
            const body = k === 'event' ? 'Grey dashed arrows are not decisions a scheduler makes: something happens (a clock tick, a request for I/O, an interrupt, the end of the program) and the process moves. Most of these events then <b>wake the short-term scheduler</b>, because the processor may need a new owner.' : RING[k][5];  // body: for events, an explanation that no scheduler chooses them; otherwise the ring's own explanation
            say(info, k === 'event' ? '' : 'info', head, body + (k === 'event' ? '' : `<div class="small" style="margin-top:6px">${mine.length} arrow${mine.length === 1 ? '' : 's'}: ${AR.filter((a) => a[6] === k).map((a) => a[7]).join(', ')}.</div>`));  // fills the info box and, for a scheduler, adds how many arrows it owns and lists their moves
          }  // ends focus()
          function pickArrow(id) {  // pickArrow(id): highlights one arrow and explains that move
            const a = AR.find((x) => x[0] === id), who = a[6];  // a: the arrow's entry in AR; who: the scheduler that makes the move, or event
            const from = Object.keys(NAME).find((k) => a[7].startsWith(NAME[k] + ' '));  // from: the state the arrow leaves, found by matching the start of its "from → to" text (the space stops Ready matching Ready/Suspend)
            light((x) => (x === id ? 'on' : 'dim'), (x) => x !== from && !a[7].endsWith('→ ' + NAME[x]), null);  // lights this arrow alone, dims every other arrow and every state except the two it joins, and outlines no ring
            say(info, who === 'event' ? '' : 'info', a[7] + ' · ' + (who === 'event' ? 'caused by an event' : SCH[who].name + ' scheduling'), a[8]);  // fills the info box: the move, who causes it, and the arrow's explanation
          }  // ends pickArrow()
          light(() => '', () => false, null);  // starts with nothing highlighted and nothing dimmed
          say(info, 'info', 'Click an arrow or a ring', 'Coloured arrows are scheduling <b>decisions</b>: violet for long-term, green for medium-term, blue for short-term. Grey dashed arrows are caused by events. Click any arrow, ring label or button to see who acts and when.');  // starting message: what the colours mean and what can be clicked
          const lead = h('p', { class: 'lead m0', html: 'Recall the seven-state process model. Each kind of scheduling owns particular <b>arrows</b> in it, and the three kinds nest like rings.' });  // lead: the opening sentence, linking back to the seven-state model
          const why = h('div', { class: 'callout why m0 small', 'data-label': 'Why nested rings?', html: 'To reach the processor, a process must pass every ring from the outside in: first be <b>admitted</b> (long-term), then be <b>in main memory</b> (medium-term), and only then be <b>chosen to run</b> (short-term). The inner the ring, the more often its decision is made.' });  // why: a callout explaining the order of the rings: admitted, then in memory, then chosen to run
          if (ctx.narrow) {  // small screens get a single column
            /* Small screens: the drawing is small, so every arrow also gets a button, and the explanation sits right below. */
            const list = h('div', { class: 'row gap-s' }, ...AR.map(([id, , , , , , who, ft]) => h('button', { type: 'button', class: 'btn sm ' + (who === 'event' ? '' : SCH[who].cls), onclick: () => pickArrow(id) }, ft)));  // list: one button per arrow, labelled with its move and coloured by its scheduler; a click explains that move
            el.append(h('div', { class: 'stack' }, lead, legend, h('div', { class: 'card white' }, svg), list, info, why));  // stacks the opening sentence, legend, drawing, arrow buttons, info box and callout
          } else {  // wide screens
            el.append(h('div', { class: 'split l fill' }, h('div', { class: 'stack' }, lead, legend, info, why),  // two columns: on the left the opening sentence, legend, info box and callout
              h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center' } }, svg)));  // on the right a white card with the drawing centred in it
          }  // ends the layout choice
        },  // ends render() for step 2
      },  // ends step 2

      /* ============ 3. The queuing view, step by step ============ */
      {  // opens step 3
        title: 'The queuing view: follow processes through the queues',  // step title
        kind: 'learn',  // kind "learn": a guided explanation
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 3; builds the queuing diagram, the memory meter and the player
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const CAP = 5;  // CAP: main memory in this story holds at most 5 processes
          /* Queue boxes: key → [x, y, w, h, label, colour class, on disk?] */
          const BOX = {  // BOX: the eight queue boxes of the diagram; each entry follows the field order in the comment above
            users: [10, 22, 140, 56, 'Interactive users', 's-panel'], jobs: [10, 92, 140, 56, 'Batch jobs', 's-panel'],  // the two waiting lines on the left: interactive users about to log in, and submitted batch jobs
            rq: [300, 44, 180, 56, 'Ready queue', 's-proc'], cpu: [620, 40, 96, 64, 'Processor', 's-cpu'], exit: [752, 44, 80, 56, 'Exit', 's-panel'],  // the ready queue, the processor and Exit along the top row
            bq: [520, 150, 196, 56, 'Blocked queue', 's-warn'], rsq: [300, 256, 180, 56, 'Ready/Suspend (disk)', 's-proc', 1], bsq: [520, 256, 196, 56, 'Blocked/Suspend (disk)', 's-warn', 1],  // the blocked queue under the processor, and the two suspended queues on disk along the bottom (the trailing 1 means on disk)
          };  // closes BOX
          /* Arrows: id → [path, colour family, label, label x, label y, anchor] */
          const QA = {  // QA: the arrows between the boxes; each entry follows the field order in the comment above (arrows without a label stop at colour)
            u2r: ['M150,50 L298,62', 'muted'], j2l: ['M150,120 L170,120', 'os'], l2r: ['M256,110 L298,86', 'os'],  // a login going straight to the ready queue (grey), and batch jobs passing through the long-term scheduler into the ready queue (violet)
            l2rs: ['M214,140 L214,284 L298,284', 'os', 'memory full', 207, 232, 'end'],  // the long-term scheduler sending a job to Ready/Suspend on disk when memory is full
            r2s: ['M480,72 L508,72', 'cpu'], s2c: ['M592,72 L618,72', 'cpu'], c2x: ['M716,72 L750,72', 'muted', 'release', 734, 38, 'middle'],  // ready queue to the short-term scheduler to the processor (blue), and the release arrow from the processor to Exit
            tout: ['M668,40 L668,14 L420,14 L420,42', 'muted', 'time-out', 545, 32, 'middle'],  // the time-out arrow that loops over the top from the processor back to the ready queue
            c2b: ['M668,104 L668,148', 'muted', 'event wait', 676, 131, 'start'],  // event wait: from the processor down to the blocked queue
            b2r: ['M520,178 L468,178 L468,102', 'muted', 'event occurs', 460, 142, 'end'],  // event occurs: from the blocked queue back up to the ready queue
            r2rs: ['M335,100 L335,254', 'mem'], rs2r: ['M365,256 L365,102', 'mem', 'medium-term', 327, 182, 'end'],  // the medium-term pair between the ready queue and Ready/Suspend: swap out down, swap in up (green)
            b2bs: ['M600,206 L600,254', 'mem'], bs2b: ['M630,256 L630,208', 'mem', 'medium-term', 640, 236, 'start'],  // the medium-term pair between the blocked queue and Blocked/Suspend
            bs2rs: ['M520,284 L482,284', 'muted', 'event occurs', 500, 330, 'middle'],  // event occurs on disk: Blocked/Suspend to Ready/Suspend
          };  // closes QA
          const INIT = () => ({ users: ['U1'], jobs: ['B1', 'B2'], rq: ['A', 'C'], cpu: [], bq: ['D'], rsq: [], bsq: [], exit: [] });  // INIT(): the starting queues: U1 about to log in, B1 and B2 waiting, A and C ready, D blocked, everything else empty
          const mem = (S) => S.rq.length + S.bq.length + S.cpu.length;  // mem(S): how many processes are in main memory: ready, blocked and running
          const take = (list, id) => list.splice(list.indexOf(id), 1)[0];  // take(list, id): removes the named process from a queue and hands it back
          /* Each op changes the state and returns the arrows it used and its caption. */
          const dispatch = { who: 'short', run(S) { const p = S.rq.shift(); S.cpu.push(p); return [['r2s', 's2c'], `<b>Short-term scheduling.</b> The processor is free, so the short-term scheduler takes <b>${p}</b>, the process at the front of the ready queue, and dispatches it.`]; } };  // dispatch operation (short-term): the front of the ready queue moves onto the processor; returns the arrows used and the caption
          const admit = { who: 'long', run(S) {  // admit operation (long-term): takes the next batch job; run(S) changes the queues and returns arrows and caption
            const p = S.jobs.shift(), m = mem(S);  // p: the batch job at the front of the line; m: how many processes main memory holds right now
            if (m < CAP) { S.rq.push(p); return [['j2l', 'l2r'], `<b>Long-term scheduling.</b> The OS decides it can take on batch job <b>${p}</b>. Main memory holds ${m} of its ${CAP} processes, so ${p} is admitted straight into the ready queue.`]; }  // memory has room: the job joins the ready queue, and the caption reports the memory count
            S.rsq.push(p); return [['j2l', 'l2rs'], `<b>Long-term scheduling.</b> Batch job <b>${p}</b> is admitted too, but main memory already holds ${m} of ${CAP} processes. ${p} joins the <b>Ready/Suspend</b> queue on disk instead.`];  // memory is full: the job is admitted onto disk, into the Ready/Suspend queue
          } };  // ends the admit operation
          const OPS = [  // OPS: the story played by the player, one operation per Next press, in order
            dispatch,  // move 1: dispatch A
            { who: null, run(S) { take(S.users, 'U1'); S.rq.push('U1'); return [['u2r'], `<b>A user logs in.</b> Interactive logins skip the batch line: as long as the system is not <span class="t" data-t="Saturation">saturated</span>, the new session’s process <b>U1</b> joins the ready queue directly. Memory now holds ${mem(S)} processes.`]; } },  // move 2: user U1 logs in and goes straight into the ready queue (an event, not a scheduler's choice, so who is null)
            { who: null, run(S) { const p = S.cpu.pop(); S.rq.push(p); return [['tout'], `<b>Time-out.</b> A clock interrupt ends <b>${p}</b>’s time slice. ${p} goes to the <b>back</b> of the ready queue. The processor is free again, which calls for a new short-term decision.`]; } },  // move 3: a clock interrupt times out the running process, which goes to the back of the ready queue
            dispatch,  // move 4: dispatch C
            admit,  // move 5: admit batch job B1 while memory still has room
            { who: null, run(S) { const p = S.cpu.pop(); S.bq.push(p); return [['c2b'], `<b>Event wait.</b> <b>${p}</b> asks for a disk read and cannot go on until it arrives, so it moves to the <b>blocked queue</b>. It still occupies main memory while it waits.`]; } },  // move 6: the running process asks for a disk read and moves to the blocked queue, still using memory
            dispatch,  // move 7: dispatch the next ready process, U1
            admit,  // move 8: admit batch job B2, but memory is full, so it goes to Ready/Suspend on disk
            { who: 'medium', run(S) { const p = S.bq.shift(); S.bsq.push(p); return [['b2bs'], `<b>Medium-term scheduling: swap out.</b> Ready work is waiting on disk, and <b>${p}</b> has been blocked for a long time, so the OS swaps ${p} out to the Blocked/Suspend queue. Memory now holds ${mem(S)} of ${CAP}.`]; } },  // move 9 (medium-term): swap the long-blocked D out to Blocked/Suspend to make room
            { who: 'medium', run(S) { const p = S.rsq.shift(); S.rq.push(p); return [['rs2r'], `<b>Medium-term scheduling: swap in.</b> The freed memory goes to <b>${p}</b>, which moves from Ready/Suspend into the ready queue. Memory holds ${mem(S)} of ${CAP} again.`]; } },  // move 10 (medium-term): swap B2 in from Ready/Suspend to use the freed memory
            { who: null, run(S) { take(S.bsq, 'D'); S.rsq.push('D'); return [['bs2rs'], '<b>Event occurs, on disk.</b> D’s disk read finishes while D is swapped out. D is no longer waiting, so it moves to <b>Ready/Suspend</b>, but it cannot run until the medium-term scheduler brings it back into memory.']; } },  // move 11: D's disk read finishes while it is on disk, so it moves to Ready/Suspend
            { who: null, run(S) { take(S.bq, 'C'); S.rq.push('C'); return [['b2r'], '<b>Event occurs.</b> An I/O interrupt reports that C’s disk read is done. C leaves the blocked queue and joins the back of the ready queue.']; } },  // move 12: C's disk read finishes and an I/O interrupt moves it back to the ready queue
            { who: null, run(S) { const p = S.cpu.pop(); S.exit.push(p); return [['c2x'], `<b>Release.</b> <b>${p}</b> finishes and leaves the system. Its memory is freed (${mem(S)} of ${CAP} in use), so the long-term or medium-term scheduler may now bring in more work.`]; } },  // move 13: the running process finishes and is released to Exit, freeing memory
            dispatch,  // move 14: dispatch again, ending the story
          ];  // closes OPS
          const tally = (i) => { const t = { long: 0, medium: 0, short: 0 }; OPS.slice(0, i).forEach((o) => { if (o.who) t[o.who]++; }); return t; };  // tally(i): counts the long-, medium- and short-term decisions among the first i moves, for the "Decisions so far" box
          const svg = s('svg', { viewBox: '0 0 840 338', width: '100%', role: 'img', 'aria-label': 'Queuing diagram of the three processor schedulers' });  // the SVG drawing for the wide-screen diagram; aria-label describes it for screen readers
          const memBox = h('div', { class: 'stack gap-s' }), decBox = h('div', { class: 'stack gap-s' });  // memBox shows the memory meter; decBox shows the decision counts
          /* Small screens: the same queues as a stack of lanes; lanes touched by the last move light up. */
          const LANES = ['users', 'jobs', 'rq', 'cpu', 'exit', 'bq', 'rsq', 'bsq'];  // LANES: the order in which the queues are listed as lanes on small screens
          const AL = { u2r: ['users', 'rq'], j2l: ['jobs'], l2r: ['rq'], l2rs: ['rsq'], r2s: ['rq'], s2c: ['cpu'], c2x: ['cpu', 'exit'], tout: ['cpu', 'rq'], c2b: ['cpu', 'bq'],  // AL: which lanes each arrow touches, so the lanes involved in the last move can light up
            b2r: ['bq', 'rq'], r2rs: ['rq', 'rsq'], rs2r: ['rsq', 'rq'], b2bs: ['bq', 'bsq'], bs2b: ['bsq', 'bq'], bs2rs: ['bsq', 'rsq'] };  // more of AL: the event, swap and on-disk arrows
          const lanesBox = h('div', { class: 'stack gap-s', style: { width: '100%' } });  // lanesBox: the stack of lanes used instead of the diagram on small screens
          function drawLanes(S, on) {  // drawLanes(S, on): draws the queues as lanes; on lists the arrows used by the last move
            const hot = new Set(on.flatMap((a) => AL[a] || []));  // hot: the set of lanes touched by those arrows
            lanesBox.replaceChildren(...LANES.map((k) => h('div', { class: 'lane' + (hot.has(k) ? ' hit' : ''), style: { gridTemplateColumns: '126px minmax(0, 1fr)' } },  // one lane per queue, with an accent border if the last move touched it
              h('div', { class: 'lbl' }, BOX[k][4]),  // the lane's label, the same name as on the diagram's box
              h('div', { class: 'toks' }, ...(S[k].length ? S[k].map((p) => h('span', { class: 'tok' + (k === 'cpu' ? ' run' : k === 'bq' || k === 'bsq' ? ' blk' : '') + (BOX[k][6] ? ' sus' : ''), style: { cursor: 'default' } }, p)) : [h('span', { class: 'empty' }, 'empty')])))));  // the lane's processes as tokens (blue on the processor, amber when blocked, dashed on disk), or "empty"; not clickable here
          }  // ends drawLanes()
          function drawSvg(S, on, who) {  // drawSvg(S, on, who): draws the diagram; on = arrows to highlight, who = the scheduler that made the last move
            svg.replaceChildren();  // clears the old drawing
            for (const [id, [d, fam, label, lx, ly, anchor]] of Object.entries(QA)) {  // draws every arrow with its colour family and optional label
              const lit = on.includes(id);  // lit: true if the last move used this arrow
              if (lit) svg.append(s('path', { d, class: 'qglow' }));  // a lit arrow first gets a wide yellow glow underneath
              svg.append(s('path', { d, class: 'qa ' + fam + (lit ? ' on' : on.length ? ' faint' : ''), 'marker-end': `url(#arr-${lit ? 'accent' : fam})` }));  // the arrow itself: accent colour if lit, faded if some other arrow is lit, with a matching arrowhead
              if (label) svg.append(s('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'lbl qal ' + fam + (lit ? ' on' : '') }, label));  // the arrow's label, if it has one, accent-coloured when lit
            }  // ends the loop over arrows
            svg.append(s('rect', { x: 172, y: 100, width: 84, height: 40, rx: 9, class: 'qnode s-os' + (who === 'long' ? ' on' : '') }),  // the small Long-term scheduler box, outlined in accent if it made the last move
              s('text', { x: 214, y: 125, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'Long-term'),  // its label
              s('rect', { x: 508, y: 52, width: 84, height: 40, rx: 9, class: 'qnode s-cpu' + (who === 'short' ? ' on' : '') }),  // the small Short-term scheduler box, outlined in accent if it made the last move
              s('text', { x: 550, y: 77, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'Short-term'));  // its label
            for (const [k, [x, y, w, ht, label, cls, disk]] of Object.entries(BOX)) {  // draws every queue box and the processes in it
              svg.append(s('rect', { x, y, width: w, height: ht, rx: 10, class: 'qbox ' + cls + (disk ? ' disk' : '') }),  // the box, with a dashed outline if the queue is on disk
                s('text', { x: x + 8, y: y + 15, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, label));  // the queue's name in small grey letters at its top left
              S[k].forEach((p, j) => {  // one small token per process in the queue
                const tx = k === 'cpu' ? x + w / 2 - 17 : x + 8 + j * 36, ty = y + ht - 32;  // tx, ty: the token's position; the processor centres its one token, queues line theirs up left to right
                svg.append(s('rect', { x: tx, y: ty, width: 32, height: 24, rx: 6, class: 'qtok' + (k === 'cpu' ? ' run' : '') }),  // the token box, blue for the running process
                  s('text', { x: tx + 16, y: ty + 17, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, p));  // the process name inside the token
              });  // ends the loop over processes
            }  // ends the loop over boxes
          }  // ends drawSvg()
          function draw(S, on, who) {  // draw(S, on, who): draws the queues and the memory meter for the current frame
            if (ctx.narrow) drawLanes(S, on); else drawSvg(S, on, who);  // small screens use the lanes; wide screens use the diagram
            const m = mem(S);  // m: processes in main memory
            memBox.innerHTML = `<h4 class="m0">Main memory</h4><div class="meter"><i style="width:${(m / CAP) * 100}%"></i></div><div class="small"><b>${m} of ${CAP}</b> processes (ready, running and blocked). Suspended ones are on disk.</div>`;  // the memory panel: a heading, a meter filled to m out of CAP, and the count in words
          }  // ends draw()
          function render(i) {  // render(i): the player calls this for frame i; it rebuilds the state from scratch by replaying the first i moves, so stepping back works too
            const S = INIT();  // S: a fresh copy of the starting queues
            let on = [], cap = '<b>The OS as a network of queues.</b> A, C and D are already in main memory; D waits for the disk. Two batch jobs wait to be admitted and one user is about to log in. Press <b>Play</b> or <b>Next</b>.', who = null;  // on: arrows to highlight; cap: the caption, first the introduction for frame 0; who: the scheduler of the last move
            for (let k = 0; k < i; k++) [on, cap] = OPS[k].run(S);  // replays moves 1 to i; each one updates the queues and returns its arrows and caption
            if (i) who = OPS[i - 1].who;  // who: the scheduler that made the last move replayed (none on frame 0)
            draw(S, on, who);  // draws the frame
            const t = tally(i);  // t: the decision counts so far
            decBox.innerHTML = '<h4 class="m0">Decisions so far</h4>' + ['long', 'medium', 'short'].map((k) =>  // the "Decisions so far" box: a heading, then one row per processor scheduler
              `<div class="row nw" style="justify-content:space-between">${chip(k)}<b class="${who === k ? 'flash' : ''}">${t[k]}</b></div>`).join('');  // each row: the scheduler's chip and its count; the count flashes if that scheduler made the move just shown
            if (i === OPS.length) cap += ` <b>Count the decisions:</b> short-term ${t.short}, long-term ${t.long}, medium-term ${t.medium}. Over a real minute the short-term count would be in the thousands.`;  // on the last frame the caption adds the final decision counts and a reminder of how many short-term decisions a real minute holds
            return cap;  // hands the caption back to the player, which shows it above the controls
          }  // ends render() for the player
          const player = ctx.ui.player({ count: OPS.length + 1, render, interval: 2600 });  // player: the shared animation player with one frame per move plus the opening frame; Play advances every 2.6 seconds
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the page together: a stack that fills the step's height
            h('div', { class: 'grow', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) 220px', gap: '12px' } },  // top part: on wide screens the diagram plus a 220px side panel; on small screens a single column
              h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '8px 10px' } }, ctx.narrow ? lanesBox : svg),  // a white card holding the lanes on small screens or the diagram on wide ones
              h('div', { class: 'card stack', style: { gap: '14px' } }, memBox, decBox,  // the side panel: memory meter and decision counts
                h('p', { class: 'xs muted m0', html: 'Violet arrows: long-term. Green: medium-term. Blue: short-term. Grey: events. The highlighted arrow is the move just made.' }))),  // a small grey key to the arrow colours
            player.el));  // the player's controls and caption at the bottom; closes the layout
        },  // ends render() for step 3
      },  // ends step 3

      /* ============ 4. Lab: you are all three processor schedulers ============ */
      {  // opens step 4
        title: 'Lab: you are the long-, medium- and short-term scheduler',  // step title
        kind: 'lab',  // kind "lab": a hands-on page
        core: true,  // core: true keeps this step in the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 4; builds the lab's lanes, buttons, messages and counters
          const { h } = ctx;  // h builds HTML elements
          const STN = { new: 'New, waiting to be admitted', ready: 'Ready, in main memory', run: 'Running', blk: 'Blocked, waiting for I/O', rs: 'Ready/Suspend, on disk', bs: 'Blocked/Suspend, on disk', exit: 'Exit, finished' };  // STN: a plain-words description of each state, used in tooltips and messages
          const TOK = { new: 'tok new', ready: 'tok', run: 'tok run', blk: 'tok blk', rs: 'tok sus', bs: 'tok blk sus', exit: 'tok ex' };  // TOK: the token classes for each state: grey for New, teal for Ready, blue for Running, amber for Blocked, dashed on disk, faded at Exit
          const POL = labRunPolicy();  // POL: the result of the built-in policy playing the whole lab, worked out once so the final message can compare against it
          let S = labFresh(), sel = 'J1', gen = 0, auto = false;  // S: the live lab state; sel: the selected job (J1 at first); gen: a counter that cancels old auto-play loops; auto: whether the OS is playing
          const lane = (label, sub) => { const toks = h('div', { class: 'toks' }); return [h('div', { class: 'lane', style: ctx.narrow ? { gridTemplateColumns: '124px minmax(0, 1fr)' } : null }, h('div', { class: 'lbl', html: label + (sub ? `<small>${sub}</small>` : '') }), toks), toks]; };  // lane(label, sub): builds one lane with its label (and optional small second line) and hands back the lane and its token area
          const [lNew, tNew] = lane('Batch queue', 'New'), [lRdy, tRdy] = lane('Ready queue'), [lRun, tRun] = lane('Processor'), [lBlk, tBlk] = lane('Blocked');  // the batch queue, ready queue, processor and blocked lanes
          const [lRs, tRs] = lane('Ready/Suspend'), [lBs, tBs] = lane('Blocked/Suspend'), [lEx, tEx] = lane('Exit');  // the two lanes on disk and the Exit lane
          lRun.classList.add('cpu');  // tints the Processor lane blue
          const memHead = h('div', { class: 'boxhead' }), diskHead = h('div', { class: 'boxhead', html: 'Swap area on disk <span class="xs muted">(cannot run from here)</span>' });  // memHead: the memory box heading, filled in by paint(); diskHead: the disk box heading, which says jobs cannot run from there
          const selBox = h('div', { class: 'card tight stack gap-s' }), msg = h('div', { class: 'msg', style: { minHeight: '92px' } });  // selBox: the panel for the selected job and its decision buttons; msg: the message box under it
          const stats = h('div', { class: 'row gap-s' }), tallyBox = h('div', { class: 'stack gap-s' });  // stats: the row of counter chips; tallyBox: the decision bars
          const bTick = h('button', { class: 'btn primary', type: 'button', onclick: () => { stopAuto(); step(false); } }, 'Next tick ▶');  // Next tick button: stops any auto play, then moves time forward one tick using only the student's own decisions
          const bAuto = h('button', { class: 'btn', type: 'button', onclick: () => (auto ? stopAuto() : startAuto()) }, 'Let the OS play');  // Let the OS play button: starts or pauses auto play, where the built-in policy makes every decision
          const bReset = h('button', { class: 'btn ghost', type: 'button', onclick: reset }, 'Reset');  // Reset button: starts the lab over
          const acts = {  // acts: the four decision buttons, each coloured like its scheduler
            admit: h('button', { class: 'btn sm os', type: 'button', onclick: () => doAct('admit') }, 'Admit · long-term'),  // Admit (long-term), violet
            dispatch: h('button', { class: 'btn sm cpu', type: 'button', onclick: () => doAct('dispatch') }, 'Dispatch · short-term'),  // Dispatch (short-term), blue
            out: h('button', { class: 'btn sm mem', type: 'button', onclick: () => doAct('out') }, 'Swap out · medium'),  // Swap out (medium-term), green
            in: h('button', { class: 'btn sm mem', type: 'button', onclick: () => doAct('in') }, 'Swap in · medium'),  // Swap in (medium-term), green
          };  // closes acts
          const ALLOW = { admit: ['new'], dispatch: ['ready', 'rs'], out: ['ready', 'blk', 'run'], in: ['rs', 'bs'] };  // ALLOW: the states that enable each button; a few wrong ones (dispatch from disk, swap out the runner) stay clickable to explain why they are refused
          function tok(id) {  // tok(id): builds the clickable token for one job
            const p = labGet(S, id), io = p.ph % 2 === 1;  // p: the job's record; io is true during an I/O burst (bursts at odd positions are I/O)
            return h('button', { class: TOK[p.st] + (id === sel ? ' sel' : ''), type: 'button', title: `${id}: ${STN[p.st]}`, onclick: () => pick(id) },  // a button styled for the job's state, outlined if selected; its tooltip names the state; a click selects the job
              id, p.st === 'exit' ? null : h('span', { class: 'tag' + (io ? ' io' : '') }, String(p.left)));  // the job's name plus a corner badge with the ticks left in its burst (orange for I/O); finished jobs have no badge
          }  // ends tok()
          const fillLane = (box, ids, empty) => box.replaceChildren(...(ids.length ? ids.map(tok) : [h('span', { class: 'empty' }, empty)]));  // fillLane(box, ids, empty): fills a lane with the tokens of the listed jobs, or with a grey placeholder word when there are none
          function paint() {  // paint(): redraws the whole lab from S; runs after every decision and every tick
            fillLane(tNew, S.q.new, 'all admitted'); fillLane(tRdy, S.q.ready, 'empty'); fillLane(tRun, S.run ? [S.run.id] : [], 'idle');  // fills the batch queue, ready queue and processor lanes ("all admitted" and "idle" when empty)
            fillLane(tBlk, S.q.blk, 'empty'); fillLane(tRs, S.q.rs, 'empty'); fillLane(tBs, S.q.bs, 'empty'); fillLane(tEx, S.q.exit, 'none yet');  // fills the blocked, suspended and Exit lanes
            const m = labInMem(S);  // m: how many memory slots are in use
            memHead.innerHTML = `Main memory <span class="chip ${m >= LAB_MEM ? 'warn' : 'mem'}">${m} of ${LAB_MEM} slots used</span>`;  // the memory heading with a chip "m of 3 slots used", amber when memory is full
            const p = labGet(S, sel);  // p: the selected job's record
            const script = p.b.map((n, i) => `<span class="ph${i < p.ph ? ' done' : i === p.ph && p.st !== 'exit' ? ' cur' : ''} ${i % 2 ? 'io' : 'cpu'}">${i % 2 ? 'I/O' : 'CPU'} ${i === p.ph && p.st !== 'exit' ? p.left + '/' + n : n}${i < p.ph || p.st === 'exit' ? ' ✓' : ''}</span>`).join('<span class="muted">→</span>');  // script: the selected job's bursts in a row (CPU 2 → I/O 7 → CPU 2); done ones faded with a tick, the current one shows left/total
            selBox.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, sel), h('span', { class: 'small muted' }, STN[p.st])),  // fills the job panel: its name and state on top
              h('div', { class: 'row gap-s small', html: script }), h('div', { class: 'grid-2', style: { gap: '6px' } }, acts.admit, acts.dispatch, acts.out, acts.in));  // then its bursts, then the four decision buttons in a 2 by 2 grid
            Object.entries(acts).forEach(([k, b]) => { b.disabled = auto || !ALLOW[k].includes(p.st); });  // disables every decision button during auto play, and each button whose decision does not fit the job's state
            const pct = S.t ? Math.round((S.busy / S.t) * 100) : 0;  // pct: the processor's busy share so far as a whole percentage (0 before the first tick)
            stats.innerHTML = `<span class="chip">tick ${S.t}</span><span class="chip cpu">processor busy ${S.busy} of ${S.t} (${pct}%)</span><span class="chip ${S.idle ? 'bad' : ''}">idle ${S.idle}</span><span class="chip ok">done ${S.q.exit.length} of ${LAB_JOBS.length}</span>`;  // the counter chips: tick number, processor busy, idle ticks (red if any) and jobs done
            const mx = Math.max(1, ...Object.values(S.tally));  // mx: the largest decision count (at least 1), so the longest bar fills its track
            tallyBox.innerHTML = '<h4 class="m0">Your decisions</h4>' + ['long', 'medium', 'short'].map((k) =>  // the "Your decisions" panel: a heading and one bar per processor scheduler
              `<div class="tally"><span class="chip ${SCH[k].cls}">${SCH[k].name}</span><div class="bar"><i style="width:${(S.tally[k] / mx) * 100}%;background:var(--${SCH[k].cls})"></i></div><b>${S.tally[k]}</b></div>`).join('');  // each bar row: the scheduler's chip, a bar in its colour scaled to the count, and the count itself
            bTick.disabled = labDone(S);  // Next tick is disabled once all jobs are done
            bAuto.textContent = auto ? 'Pause' : 'Let the OS play';  // the auto button reads Pause while the OS plays, otherwise Let the OS play
            bAuto.disabled = labDone(S);  // and is disabled once all jobs are done
          }  // ends paint()
          function hint() {  // hint(): looks at the lab and returns [message kind, heading, advice] for what the student might do next
            if (labDone(S)) {  // every job has finished
              const pct = Math.round((S.busy / S.t) * 100), pp = Math.round((POL.busy / POL.t) * 100);  // pct: the student's busy share; pp: the built-in policy's busy share
              return ['ok', 'All six jobs finished', `<b>${S.t} ticks</b>, processor busy ${S.busy} of them (<b>${pct}%</b>)${S.wasted ? `; idle ${S.wasted} time${S.wasted === 1 ? '' : 's'} while a process was Ready` : ''}. The built-in OS policy needs ${POL.t} ticks (${pp}%). Note the bars: each job is admitted once, but every time-out, I/O request and exit needs a new short-term decision.`];  // final message: ticks taken, busy share, any wasted idle ticks, the policy's result, and why short-term decisions far outnumber the others
            }  // ends the finished case
            if (!S.run && S.q.ready.length) return ['info', 'Short-term decision needed', `The processor is free and ${S.q.ready.join(', ')} ${S.q.ready.length > 1 ? 'are' : 'is'} Ready. Pick one and <b>dispatch</b> it.`];  // processor free and a job Ready: suggests a short-term dispatch, naming the ready jobs
            if (!S.run && labInMem(S) < LAB_MEM && (S.q.rs.length || S.q.new.length)) return ['info', 'Room in memory', S.q.rs.length ? `Nothing in memory can run, but ${S.q.rs[0]} is Ready on disk. <b>Swap it in</b> (medium-term), then dispatch it.` : `Memory has a free slot. <b>Admit</b> a job from the batch queue (long-term).`];  // processor free and memory has room: suggests swapping in a Ready/Suspend job, or else admitting a batch job
            if (!S.run && S.q.blk.length && (S.q.rs.length || S.q.new.length)) return ['bad', 'Everything in memory is blocked', 'The processor will sit idle. Make room: <b>swap out</b> a Blocked process (medium-term), then swap in or admit work that can run.'];  // processor free, everything in memory blocked, work waiting outside: warns that the processor will idle and suggests swapping out
            return ['', '', 'Make any decisions you like, then press <b>Next tick</b>.'];  // otherwise there is nothing urgent: make any decisions, then press Next tick
          }  // ends hint()
          function pick(id) { sel = id; paint(); const p = labGet(S, id); say(msg, '', id, `${STN[p.st]}. Its bursts are shown above; the small number on a job is the ticks left in its current burst (blue: processor, orange: I/O).`); }  // pick(id): selects a job when its token is clicked, redraws, and describes its state and how to read its bursts
          function doAct(what) {  // doAct(what): runs when a decision button is clicked; tries the decision on the selected job and explains the result
            const p = labGet(S, sel), r = labAct(S, what, sel), m = labInMem(S);  // p: the selected job; r: the engine's answer (allowed or refused, and why); m: memory slots in use afterwards
            let kind = 'ok', head = SCH[what === 'admit' ? 'long' : what === 'dispatch' ? 'short' : 'medium'].name + ' decision', text;  // kind and head start as a success message headed with the matching scheduler's name; text is filled in below
            if (r.ok) {  // the decision was allowed
              text = what === 'admit' ? (r.to === 'ready' ? `${sel} is admitted. Memory had room, so it joins the ready queue (New → Ready).` : `${sel} is admitted, but memory is full, so it starts on disk (New → Ready/Suspend).`)  // admit: says whether the job went to the ready queue or, with memory full, to disk
                : what === 'dispatch' ? `${sel} gets the processor (Ready → Running). It keeps it for up to ${LAB_Q} ticks, or until its burst ends.`  // dispatch: the job gets the processor for up to 3 ticks or until its burst ends
                : what === 'out' ? `${sel} is swapped out to disk (${r.to === 'rs' ? 'Ready → Ready/Suspend' : 'Blocked → Blocked/Suspend. Its I/O carries on'}). Memory now holds ${m} of ${LAB_MEM}.`  // swap out: which suspended state the job went to (a blocked job's I/O carries on) and the new memory count
                : `${sel} is swapped back into memory (${r.to === 'ready' ? 'Ready/Suspend → Ready' : 'Blocked/Suspend → Blocked'}). Memory holds ${m} of ${LAB_MEM}.`;  // swap in: which state the job returned to and the memory count
            } else {  // the decision was refused
              kind = 'bad'; head = 'Not allowed';  // the message turns red with the heading "Not allowed"
              text = r.why === 'busy' ? `The processor is busy with ${S.run.id}. Only one process runs at a time.`  // busy: only one process can run at a time
                : r.why === 'full' ? `Memory is full (${LAB_MEM} of ${LAB_MEM}). Swap something out first, or wait for a process to finish.`  // full: memory has no free slot, so something must be swapped out first
                : what === 'dispatch' && p.st === 'rs' ? `${sel} is ready but on disk. Only processes in main memory can be dispatched: swap it in first.`  // dispatching a job on disk: only jobs in main memory can run, so swap it in first
                : what === 'out' && p.st === 'run' ? 'In this lab the running process is not swapped out. Wait until it leaves the processor.' : `That decision does not apply to a process in the ${STN[p.st]} state.`;  // swapping out the running job is not part of this lab; any other refusal says the decision does not fit the job's state
            }  // ends the refusal case
            paint();  // redraws the lab to show the change
            const [, hh, ht] = hint();  // asks hint() for a suggestion about what to do next
            say(msg, kind, head, text + (r.ok && hh ? `<div class="small" style="margin-top:4px"><b>Next:</b> ${ht}</div>` : ''));  // shows the message; after a successful decision it adds a "Next:" line when hint() has advice
          }  // ends doAct()
          const EV = { io: (e) => `${e.id}’s I/O finished → ${e.to === 'ready' ? 'Ready' : 'Ready/Suspend (still on disk)'}`, wait: (e) => `${e.id} started I/O → Blocked`, exit: (e) => `${e.id} finished → Exit`,  // EV: turns each kind of tick event into a short sentence: I/O finished, started I/O, finished
            timeout: (e) => `${e.id} used its ${LAB_Q}-tick slice → time-out, back to Ready`, ran: (e) => `${e.id} ran (${labGet(S, e.id).left} left in this burst)`,  // time-out after the 3-tick slice, and a plain run showing the ticks left in the burst
            idle: (e) => (e.wasted ? '<b>the processor sat idle even though a process was Ready!</b>' : 'the processor sat idle: nothing in memory could run') };  // an idle tick: stronger, bold wording when a job sat Ready while the processor did nothing
          function step(byOS) {  // step(byOS): moves the lab forward one tick; when byOS is true the built-in policy makes its decisions first
            if (labDone(S)) return;  // does nothing once every job has finished
            const did = byOS ? labPolicy(S) : [];  // did: the decisions the OS made this tick (none when the student is in charge)
            const ev = labTick(S);  // ev: what happened during the tick, from the engine
            if (!labGet(S, sel) || labGet(S, sel).st === 'exit') { const live = S.P.find((p) => p.st !== 'exit'); if (live) sel = live.id; }  // if the selected job has finished, selects the first job still in the system so the panel stays useful
            paint();  // redraws the lab
            const [k, hh, ht] = hint();  // asks hint() for the message kind, heading and advice for the new situation
            const os = did.length ? 'OS decided: ' + did.map(([w, id]) => `${{ admit: 'admit', dispatch: 'dispatch', out: 'swap out', in: 'swap in' }[w]} ${id}`).join(', ') + '. ' : '';  // os: when the OS played, its decisions in words, such as "OS decided: admit J1, dispatch J1. "
            const idleBad = ev.some((e) => e.k === 'idle' && e.wasted);  // idleBad: true if the processor idled while a job was Ready
            let line = ev.map((e) => EV[e.k](e)).join('; ');  // line: the tick's events as sentences joined with semicolons
            line = line.replace(/^(<b>)?([a-z])/, (m0, tag, c) => (tag || '') + c.toUpperCase()) + (line.endsWith('!</b>') ? '' : '.');  // capitalizes the first letter (skipping a leading bold tag) and adds a full stop unless the line already ends in a bold exclamation
            say(msg, labDone(S) ? 'ok' : idleBad ? 'bad' : k, `Tick ${S.t}${hh ? ' · ' + hh : ''}`, os + line + `<div class="small" style="margin-top:4px">${ht}</div>`);  // shows the tick report: green when all jobs are done, red after a wasted idle tick, otherwise the hint's colour, with the advice below
          }  // ends step()
          function startAuto() {  // startAuto(): starts auto play, where the built-in policy runs the lab
            auto = true; paint();  // turns auto play on and redraws, which disables the decision buttons and relabels the button Pause
            const g = ++gen;  // g: this loop's ticket number; if gen moves on, this loop knows it has been cancelled
            const loop = () => { if (g !== gen || !auto) return; step(true); if (labDone(S)) { stopAuto(); return; } ctx.after(650, loop); };  // loop: stops if cancelled or paused, otherwise plays one tick, stops at the end, or runs again in 650 ms (only while the slide is open)
            loop();  // plays the first tick right away
          }  // ends startAuto()
          function stopAuto() { if (!auto) return; auto = false; gen++; paint(); }  // stopAuto(): if auto play is on, turns it off, moves gen on so the waiting loop stops, and redraws
          function reset() {  // reset(): puts the lab back to its starting point
            gen++; auto = false; S = labFresh(); sel = 'J1'; paint();  // cancels auto play, makes a fresh state, selects J1 and redraws
            say(msg, 'info', 'Six batch jobs are waiting', 'Click a job, then choose a decision. <b>Admit</b> jobs (long-term), <b>dispatch</b> one (short-term) and press <b>Next tick</b>. When everything in memory is blocked, try <b>swapping</b> (medium-term).');  // starting instructions: select a job, admit, dispatch, tick, and swap when everything in memory is blocked
          }  // ends reset()
          reset();  // sets up the lab as soon as the step opens
          el.append(h('div', { class: 'split r fill' },  // puts the page together: two columns, the right one smaller
            h('div', { class: 'card white stack', style: { gap: '8px' } },  // left column: a white card with the lanes
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip mem' }, `memory: ${LAB_MEM} processes`), h('span', { class: 'chip cpu' }, `time slice: ${LAB_Q} ticks`), h('span', { class: 'chip io' }, 'one I/O device per job'), h('span', { class: 'chip' }, 'swaps are instant')),  // a row of chips with the lab's rules: 3 memory slots, a 3-tick slice, one I/O device per job, instant swaps
              lNew, h('div', { class: 'membox stack gap-s' }, memHead, lRdy, lRun, lBlk), h('div', { class: 'diskbox stack gap-s' }, diskHead, lRs, lBs), lEx),  // the batch lane, then the memory box (ready, processor, blocked), the disk box (the two suspended lanes), then Exit
            h('div', { class: 'stack labr', style: { gap: '10px' } },  // right column: the controls and readouts
              h('div', { class: 'row gap-s' }, bTick, bAuto, bReset), selBox, msg, stats, tallyBox)));  // the tick, auto and reset buttons, the selected job panel, the message box, the counters and the decision bars
        },  // ends render() for step 4
      },  // ends step 4

      /* ============ 5. Long-term scheduling: how many, which, and logins ============ */
      {  // opens step 5
        title: 'Long-term scheduling: how many jobs, and which ones?',  // step title
        kind: 'explore',  // kind "explore": an interactive page to experiment with
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 5; builds the explanation and three tabs
          const { h } = ctx;  // h builds HTML elements
          /* Tab 1: degree of multiprogramming versus each process's share. */
          function howMany(panel) {  // howMany(panel): fills the "How many?" tab: two sliders, the results and a bar chart for 1 to 8 processes
            let n = 3, p = 60;  // n: processes admitted (3 at first); p: the percent of time each one waits for I/O (60 at first)
            const out = h('div', { class: 'stack gap-s' });  // out: the results area above the chart
            const CW = ctx.narrow ? 340 : 560, CS = (CW - 32) / 8;  // CW: the chart width (smaller on small screens); CS: the width of each of the 8 columns
            const chart = ctx.s('svg', { viewBox: `0 0 ${CW} 106`, width: '100%', role: 'img', 'aria-label': 'Processor busy and share per process for 1 to 8 processes' });  // the chart's SVG drawing; aria-label describes it for screen readers
            const drawChart = () => {  // drawChart(): redraws the 8 pairs of bars for the current p and highlights column n
              const { s } = ctx, k = 0.72, B = 90;  // s builds SVG elements; k scales 100% to 72 units of bar height; B is the height of the baseline
              chart.replaceChildren(s('text', { x: 4, y: 14, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--cpu)' }, '■ processor busy'),  // legend in blue: the processor busy bars
                s('text', { x: ctx.narrow ? 140 : 130, y: 14, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--proc)' }, ctx.narrow ? '■ share each' : '■ each process’s share'),  // legend in teal: the share-per-process bars (shorter wording on small screens)
                s('line', { x1: 30, y1: B, x2: CW - 2, y2: B, class: 's-line', 'stroke-width': 1 }));  // the baseline the bars stand on
              for (let m = 1; m <= 8; m++) {  // one column for each number of processes, 1 to 8
                const x = 30 + (m - 1) * CS, U = mpUtil(m, p / 100), bw = (CS - 14) / 2;  // x: the column's left edge; U: utilization with m processes; bw: the width of each of the two bars
                if (m === n) chart.append(s('rect', { x: x + 2, y: 18, width: CS - 4, height: 88, rx: 6, style: 'fill:var(--accent-bg)' }));  // the column that matches the slider gets a pale accent background
                chart.append(s('rect', { x: x + 6, y: B - U * k * 100, width: bw, height: U * k * 100, rx: 3, style: 'fill:var(--cpu)' }),  // blue bar: how busy the processor is with m processes
                  s('rect', { x: x + 8 + bw, y: B - (U / m) * k * 100, width: bw, height: (U / m) * k * 100, rx: 3, style: 'fill:var(--proc)' }),  // teal bar beside it: what each process gets, U divided by m
                  s('text', { x: x + CS / 2, y: B + 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': m === n ? 800 : 600 }, (ctx.narrow ? '' : 'n=') + m));  // the label under the column ("n=" and the number, just the number on small screens), bold for the chosen column
              }  // ends the loop over columns
            };  // ends drawChart()
            const draw = () => {  // draw(): updates everything whenever a slider moves
              drawChart();  // redraws the chart
              const U = mpUtil(n, p / 100), idle = 1 - U, share = U / n, f = (x) => ctx.util.fmt(x * 100, 1) + '%';  // U: busy fraction; idle: the rest; share: U split n ways; f: writes a fraction as a percentage with one decimal
              const segs = ctx.util.range(n).map((i) => `<div class="seg-p" style="width:${share * 100}%" title="P${i + 1}">${share > 0.07 ? 'P' + (i + 1) : ''}</div>`).join('') + `<div class="seg-idle" style="width:${idle * 100}%">${idle > 0.09 ? 'idle' : ''}</div>`;  // segs: the share bar: one teal segment per process (labelled P1, P2 ... if wide enough), then a striped idle segment
              out.innerHTML = `<div class="row" style="justify-content:space-between"><div><div class="xs muted b">PROCESSOR BUSY</div><div class="big">${f(U)}</div></div><div><div class="xs muted b">EACH PROCESS GETS</div><div class="big" style="color:var(--proc)">${f(share)}</div></div></div>${/* shown text, part 1: two big numbers side by side, processor busy and what each process gets */''}
                <div class="share">${segs}</div>${/* shown text, part 2: the share bar built above */''}
                <p class="small m0">Busy = 1 − p<sup>n</sup> = 1 − ${ctx.util.fmt(p / 100, 1)}<sup>${n}</sup> = <b>${f(U)}</b>, shared by ${n} process${n > 1 ? 'es' : ''}: ${f(U)} ÷ ${n} = <b>${f(share)}</b> each.</p>${/* shown text, part 3: the formula worked with the current p and n, then the split into equal shares */''}
                <div class="msg ${idle > 0.1 ? 'info' : 'ok'}"><b class="h">${idle > 0.1 ? 'Admit another job' : 'Hold new jobs back'}</b>Idle ${f(idle)} ${idle > 0.1 ? '>' : '≤'} 10%. Using the rule “admit while the processor is idle more than 10% of the time”, the long-term scheduler would ${idle > 0.1 ? '<b>admit</b> one more job.' : '<b>wait</b>: more jobs would add little throughput, shrink every share and need more memory.'}</div>`;  // shown text, part 4: the verdict under the rule "admit while idle more than 10%": admit one more (blue) or hold back (green)
            };  // ends draw()
            panel.append(h('div', { class: 'stack' },  // builds the tab's content
              ctx.ui.slider({ label: 'Processes admitted (n)', min: 1, max: 8, value: n, onInput: (v) => { n = v; draw(); } }),  // slider for n, from 1 to 8; moving it redraws everything
              ctx.ui.slider({ label: 'Each waits for I/O (p)', min: 20, max: 90, step: 10, value: p, format: (v) => v + '%', onInput: (v) => { p = v; draw(); } }),  // slider for p, from 20% to 90% in steps of 10
              out, chart, h('p', { class: 'xs muted m0' }, 'A simplified model: it assumes each process waits for I/O independently of the others.')));  // the results, the chart, and fine print saying the model assumes processes wait independently
            draw();  // draws everything once at the start
          }  // ends howMany()
          /* Tab 2: the process-mix game. */
          function mix(panel) {  // mix(panel): fills the "Which mix?" tab: admit three of six jobs and see how busy the processor and disk stay
            const T = 30, POOL = [['P1', 'p'], ['P2', 'p'], ['P3', 'p'], ['I1', 'i'], ['I2', 'i'], ['I3', 'i']];  // T: a 30-tick window; POOL: three processor-bound jobs (P1 to P3) and three I/O-bound jobs (I1 to I3)
            let chosen = [];  // chosen: the admitted jobs, in admission order
            const tried = [];  // tried: up to three recent mixes and their results, newest first, for the comparison table
            const cards = POOL.map(([id, k]) => h('button', { class: 'jobc ' + k, type: 'button', onclick: () => toggle(id) }, h('b', {}, id), h('span', { class: 'xs' }, k === 'p' ? 'processor-bound' : 'I/O-bound')));  // cards: one button per job showing its name and kind; a click admits or removes it
            const result = h('div', { class: 'stack gap-s' });  // result: the area for the timelines, meters and verdict
            function toggle(id) {  // toggle(id): admits or removes one job
              if (chosen.includes(id)) chosen = chosen.filter((x) => x !== id);  // already admitted: remove it
              else if (chosen.length < 3) chosen.push(id);  // fewer than three admitted: add it to the end of the order
              else { ctx.toast('Three jobs are already admitted. Click one to remove it first.'); return; }  // three already admitted: a short pop-up message, and nothing changes
              draw();  // redraws
            }  // ends toggle()
            function draw() {  // draw(): updates the cards and, once three jobs are chosen, runs the simulation and shows the results
              cards.forEach((c, i) => { const at = chosen.indexOf(POOL[i][0]); c.classList.toggle('on', at >= 0); c.dataset.n = at >= 0 ? at + 1 : ''; });  // marks each admitted card and stores its admission number for the corner badge
              if (chosen.length < 3) {  // fewer than three chosen
                result.innerHTML = `<div class="msg info"><b class="h">Admit three jobs (${chosen.length} of 3 chosen)</b>Processor-bound jobs compute for 5 ticks, then use the disk for 1. I/O-bound jobs compute for 1 tick, then use the disk for 4. <b>Predict:</b> which mix keeps both the processor and the disk busy?</div>`;  // shows how many are chosen and how each kind behaves, and asks the student to predict the best mix
                return;  // stops here until three are chosen
              }  // ends that case
              const kinds = chosen.map((id) => POOL.find((x) => x[0] === id)[1]), r = mixRun(kinds, T);  // kinds: the kind of each chosen job, in admission order; r: the simulation result
              const cell = (j) => (j < 0 ? '<i class="c idle"></i>' : `<i class="c ${kinds[j]}" title="${chosen[j]}">${ctx.narrow ? '' : chosen[j].slice(1)}</i>`);  // cell(j): one timeline cell: dashed when idle (-1), otherwise coloured by the job's kind with its number (no number on small screens)
              const pc = Math.round(r.cpu * 100), pd = Math.round(r.disk * 100);  // pc and pd: processor and disk busy as whole percentages
              const v = pc >= 80 && pd >= 80 ? ['ok', 'Both kept busy', 'A balanced mix: while one job computes, others use the disk, so neither device waits long.']  // verdict: both at 80% or more means a balanced mix
                : pd < 50 ? ['bad', 'The disk is mostly idle', kinds.includes('i') ? 'Two of the three jobs are processor-bound. They keep the processor full, but the disk is idle more than half the time. Replace one of them with an I/O-bound job.' : 'Every job wants the processor and hardly touches the disk. The jobs queue for the processor while the disk does almost nothing.']  // disk under 50%: too many processor-bound jobs, with different advice when there is no I/O-bound job at all
                : pc < 50 ? ['bad', 'The processor is mostly idle', 'Every job spends most of its time on the disk, so the jobs queue there while the processor waits.']  // processor under 50%: the jobs spend most of their time queued for the disk
                : ['info', 'Better, but not balanced', 'One resource is well used and the other only partly. Try a different mix.'];  // otherwise one resource is well used and the other only partly: try another mix
              const key = chosen.join(' '), old = tried.findIndex((x) => x[0] === key);  // key: this mix written as text, such as "P1 I1 I2"; old: where the same mix already sits in the tried list, if anywhere
              if (old >= 0) tried.splice(old, 1);  // removes the old entry so a repeated mix is not listed twice
              tried.unshift([key, pc, pd]);  // puts this mix at the top of the list with its two percentages
              tried.length = Math.min(tried.length, 3);  // keeps only the three most recent mixes
              result.innerHTML = `<div class="tl"><span class="xs b">Processor</span><div class="cells">${r.rowC.map(cell).join('')}</div><span class="xs b">Disk</span><div class="cells">${r.rowD.map(cell).join('')}</div></div>${/* shown text, part 1: the two timelines, one cell per tick for the processor and for the disk */''}
                <div class="grid-2" style="gap:10px"><div><div class="xs muted b">PROCESSOR BUSY ${pc}%</div><div class="meter"><i style="width:${pc}%"></i></div></div><div><div class="xs muted b">DISK BUSY ${pd}%</div><div class="meter"><i style="width:${pd}%"></i></div></div></div>${/* shown text, part 2: two meters with the processor and disk busy percentages */''}
                <div class="msg ${v[0]}"><b class="h">${v[1]}</b>${v[2]}</div>${/* shown text, part 3: the verdict box chosen above */''}
                <table class="tbl compact"><tr><th>Mixes you tried</th><th>Processor</th><th>Disk</th></tr>${tried.map((t, i) => `<tr${i ? '' : ' class="on"'}><td>${t[0]}</td><td>${t[1]}%</td><td>${t[2]}%</td></tr>`).join('')}</table>`;  // shown text, part 4: a small table of the mixes tried, with the newest row highlighted
            }  // ends draw()
            panel.append(h('div', { class: 'stack gap-s' }, h('div', { class: 'jobs' }, cards), result,  // builds the tab: the six job cards, then the results area
              h('p', { class: 'xs muted m0' }, `Cells show the job number (blue: processor-bound, orange: I/O-bound). One processor and one disk, each serving jobs in arrival order; admission order sets the starting order; each job repeats its cycle for ${T} ticks.`)));  // fine print: how to read the cells and the rules of the simulation, including the 30-tick window
            draw();  // draws the starting state, which asks for three jobs
          }  // ends mix()
          /* Tab 3: interactive logins until saturation. */
          function logins(panel) {  // logins(panel): fills the "Logins" tab: users log in until the time-sharing system is saturated
            const CAP = 5;  // CAP: this system can serve 5 sessions well
            let users = [], next = 1, refused = 0;  // users: the active sessions; next: the number for the next user's name; refused: logins turned away so far
            const slots = h('div', { class: 'slots' }), msg = h('div', { class: 'msg', style: { minHeight: '74px' } }), bar = h('div', { class: 'share' });  // slots: the five session boxes; msg: the message box; bar: the processor-share bar
            const draw = () => {  // draw(): redraws the share bar and the session slots
              bar.innerHTML = users.length ? users.map((u) => `<div class="seg-p" style="width:${100 / users.length}%">${u} · ${Math.round(100 / users.length)}%</div>`).join('') : '<div class="seg-idle" style="width:100%">no sessions: the processor is idle</div>';  // the share bar: an equal segment per session showing its percentage, or a striped "processor is idle" bar when nobody is logged in
              slots.replaceChildren(...ctx.util.range(CAP).map((i) => (users[i] ? h('div', { class: 'slot' }, h('b', {}, users[i]), h('span', { class: 'xs' }, 'session')) : h('div', { class: 'slot free' }, 'free'))));  // the five slots: a filled box for each active session, a dashed "free" box for the rest
            };  // ends draw()
            const login = () => {  // login(): runs when the student clicks "Log in a new user"
              if (users.length >= CAP) { refused++; say(msg, 'bad', 'System full, try later', `${CAP} sessions are active: the system is <span class="t" data-t="Saturation">saturated</span>. The OS refuses the new login instead of making every user slower. Refused so far: ${refused}.`); return; }  // at the limit the login is refused: counts it and explains saturation in a red message
              const u = 'U' + next++; users.push(u); draw();  // otherwise makes the next user name, adds the session and redraws
              say(msg, 'ok', 'Login accepted', `${u} is authorized, so the OS creates a process for the session and puts it straight into the ready queue. ${users.length} active session${users.length > 1 ? 's' : ''}: if all are busy computing, each gets about ${Math.round(100 / users.length)}% of the processor.`);  // green message: the login creates a process that goes straight to the ready queue, and the share each session would now get
            };  // ends login()
            const logout = () => {  // logout(): runs when the student clicks "Log one user out"
              if (!users.length) { say(msg, '', 'Nobody is logged in', 'Log a user in first.'); return; }  // nobody to log out: a plain message asking for a login first
              const u = users.shift(); draw(); say(msg, 'info', 'Logout', `${u} logs out and its process ends, so there is room for one more login.`);  // removes the oldest session, redraws, and says one more login now fits
            };  // ends logout()
            draw();  // draws the empty system once at the start
            say(msg, '', 'Time-sharing logins', `This system can serve ${CAP} sessions well. Log users in and see what happens at the limit.`);  // starting message: the system's limit of 5 sessions and what to try
            panel.append(h('div', { class: 'stack' },  // builds the tab's content
              h('p', { class: 'small m0', html: 'In a time-sharing system, a <b>login</b> creates a process. There is no batch queue to wait in: the OS accepts every authorized user until the system is saturated.' }),  // explanation: in time-sharing a login creates a process, and there is no batch queue to wait in
              h('div', { class: 'row gap-s' }, h('button', { class: 'btn primary', type: 'button', onclick: login }, 'Log in a new user'), h('button', { class: 'btn', type: 'button', onclick: logout }, 'Log one user out')), slots, msg,  // the login and logout buttons, then the slots and the message box
              h('div', { class: 'stack gap-s' }, h('div', { class: 'xs muted b' }, 'PROCESSOR SHARE IF EVERY SESSION IS BUSY COMPUTING'), bar),  // a small heading and the processor-share bar
              h('div', { class: 'callout why m0 small', 'data-label': 'Why refuse instead of queue?', html: 'A batch job can wait in the batch queue for hours and nobody is harmed, so a busy system simply admits it later. A person at a keyboard cannot be parked like that: past saturation every session would crawl, so the OS says “try later” up front.' })));  // callout: why a saturated system refuses logins instead of queueing them like batch jobs
          }  // ends logins()
          el.append(h('div', { class: 'split l fill' },  // puts the page together: two columns, the left one smaller
            h('div', { class: 'stack' },  // left column: the explanation
              h('p', { class: 'lead m0', html: '<span class="t">Long-term scheduling</span> decides which submitted programs are admitted, so it sets the <span class="t">degree of multiprogramming</span>.' }),  // opening sentence: long-term scheduling sets the degree of multiprogramming; dotted terms open glossary entries
              h('p', { class: 'm0 small', html: 'More processes give the processor more chances to find work, but each process then gets a smaller share of it. The scheduler makes two decisions:' }),  // the trade-off: more processes give the processor more work but shrink each share
              h('div', { class: 'card tight stack gap-s small' },  // a small card listing the scheduler's two decisions
                h('div', { html: '<b>When</b> can the OS take on another process? For example each time a job ends, or when the processor has been idle more than some fraction of the time.' }),  // the "when" decision: for example when a job ends or when the processor is too often idle
                h('div', { html: '<b>Which</b> job? First come first served, by priority, by expected run time, or by I/O needs, for example a balanced mix of <span class="t" data-t="Processor-bound process">processor-bound</span> and <span class="t" data-t="I/O-bound process">I/O-bound</span> jobs, or jobs that need devices nobody is using.' })),  // the "which" decision: the possible admission rules, including a balanced mix of job kinds
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Admitting more jobs does not always mean more work done. Past a point the processor is already busy, so extra jobs only slow everyone down and crowd main memory.' })),  // warning callout: admitting more jobs does not always mean more work done
            ctx.ui.tabs([{ label: 'How many?', render: howMany }, { label: 'Which mix?', render: mix }, { label: 'Logins', render: logins }])));  // right column: the three tabs, each built by the function named in it
        },  // ends render() for step 5
      },  // ends step 5

      /* ============ 6. Medium-term and short-term: what wakes each scheduler ============ */
      {  // opens step 6
        title: 'Medium- and short-term: what wakes each scheduler?',  // step title
        kind: 'explore',  // kind "explore": an interactive page to experiment with
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 6; builds the sorting game and the explanation cards
          const { h } = ctx;  // h builds HTML elements
          /* [event, which scheduler reacts, why, short label] */
          const EVENTS = [  // EVENTS: the ten events of the game; each entry follows the field order in the comment above
            ['The hardware clock interrupts: the running process has used up its time slice.', 'short', 'A clock interrupt is the classic trigger for the short-term scheduler: another process may now deserve the processor.', 'clock interrupt'],  // event 1: a clock interrupt at the end of a time slice (short-term)
            ['A batch job has left the system, which frees room for one more. Submitted jobs are waiting in the batch queue.', 'long', 'Each time a job ends is a natural moment for the long-term scheduler to decide whether to admit one of the waiting jobs. (The free processor also gets a short-term decision, but only long-term scheduling can let a new job in.)', 'job finished'],  // event 2: a batch job leaves while others wait to be admitted (long-term), with a note on why it is not short-term
            ['Free main memory is almost gone, and several processes in memory are blocked waiting for slow devices.', 'medium', 'Swapping blocked processes out to disk frees memory. That is a medium-term decision.', 'memory nearly full'],  // event 3: memory almost gone with several blocked processes (medium-term: swap out)
            ['A disk finishes a read and raises an I/O interrupt, so the process that asked for the data can run again.', 'short', 'The I/O interrupt makes a process Ready. The short-term scheduler decides whether it should preempt the running one.', 'I/O interrupt'],  // event 4: an I/O interrupt from a finished disk read (short-term: maybe preempt)
            ['Someone types a valid username and password to start a new session.', 'long', 'A login creates a new process. Accepting it is an admission decision, made unless the system is saturated.', 'new login'],  // event 5: a new login (long-term admission)
            ['A process calls semSignal, and a higher-priority process that was blocked on that semaphore becomes ready.', 'short', 'A signal on a semaphore can make a more important process ready: a chance to preempt, so the short-term scheduler runs.', 'semSignal wakes a process'],  // event 6: semSignal wakes a higher-priority process (short-term: a chance to preempt)
            ['Plenty of main memory has just become free, while two processes sit in Ready/Suspend on disk, waiting to come back in.', 'medium', 'Bringing suspended processes back into main memory (swapping in) is medium-term scheduling.', 'memory freed'],  // event 7: memory freed while processes wait on disk (medium-term: swap in)
            ['The running process makes a system call to read a file and must wait for the disk.', 'short', 'An OS call that blocks the caller leaves the processor free, so the short-term scheduler picks the next process.', 'blocking system call'],  // event 8: a system call that blocks the caller on the disk (short-term)
            ['Over the last minute the processor sat idle 40% of the time, and no process is swapped out.', 'long', 'An underused processor with nothing on disk to bring back means too few processes: the long-term scheduler can admit more work.', 'processor 40% idle'],  // event 9: the processor idle 40% of the time with nothing swapped out (long-term: admit more)
            ['The running process calls semWait on a semaphore whose value is 0.', 'short', 'The process blocks on the semaphore, so the processor needs a new owner right away.', 'semWait blocks'],  // event 10: semWait blocks the running process (short-term)
          ];  // closes EVENTS
          let i = 0, score = 0, answered = false, res = [];  // i: the event on screen; score: first-try right answers; answered: whether this event has been answered; res: right or wrong for each event
          const sorted = h('div', { class: 'grid-3 sorted', style: { gap: '8px' } });  // sorted: three columns that collect the answered events under the scheduler each one wakes
          const dots = h('div', { class: 'goal' }), scen = h('div', { class: 'scen' }), msg = h('div', { class: 'msg', style: { minHeight: '84px' } });  // dots: the numbered progress squares; scen: the box showing the event; msg: the feedback box
          const btns = ['long', 'medium', 'short'].map((k) => h('button', { class: 'btn ' + SCH[k].cls, type: 'button', 'data-k': k, onclick: () => answer(k) }, SCH[k].name));  // btns: one answer button per processor scheduler, in its colour; a click answers with that scheduler
          const bNext = h('button', { class: 'btn primary', type: 'button', onclick: () => { if (i < EVENTS.length - 1) { i++; show(); } } }, 'Next event →');  // Next event button: moves to the next event, if there is one
          const bAgain = h('button', { class: 'btn ghost', type: 'button', onclick: () => { i = 0; score = 0; res = []; show(); } }, 'Start over');  // Start over button: clears the score and answers and goes back to event 1
          function paintDots() {  // paintDots(): redraws the sorted columns and the progress squares
            sorted.replaceChildren(...['long', 'medium', 'short'].map((k) => h('div', { class: 'col' }, h('span', { class: 'chip ' + SCH[k].cls }, SCH[k].name + ' wakes on'),  // one column per scheduler, headed by a chip such as "Short-term wakes on"
              ...EVENTS.map((e, j) => (res[j] !== undefined && e[1] === k ? h('div', { class: 'it' + (res[j] ? '' : ' miss') }, (res[j] ? '✓ ' : '✗ ') + e[3]) : null)).filter(Boolean))));  // the answered events whose answer is that scheduler, with a tick if answered right or a cross (in red) if missed
            dots.replaceChildren(...EVENTS.map((_, j) => h('span', { class: res[j] === true ? 'done' : res[j] === false ? 'miss' : j === i ? 'cur' : '' }, String(j + 1))));  // one numbered square per event: green if right, red if wrong, outlined if it is the current one
          }  // ends paintDots()
          function show() {  // show(): puts event i on screen, ready to be answered
            answered = false;  // clears the answered flag
            scen.textContent = EVENTS[i][0];  // writes the event's description in the large box
            btns.forEach((b) => { b.disabled = false; b.classList.remove('on', 'right', 'wrong'); });  // re-enables the answer buttons and removes last time's right and wrong colours
            bNext.disabled = true;  // Next stays off until the event is answered
            paintDots();  // redraws the columns and squares
            say(msg, '', `Event ${i + 1} of ${EVENTS.length}`, 'Which scheduler reacts to this event? Choose one.');  // asks the question: which scheduler reacts to this event?
          }  // ends show()
          function answer(k) {  // answer(k): runs when an answer button is clicked; k is the scheduler chosen
            if (answered) return;  // ignores further clicks once this event has been answered
            answered = true;  // marks the event as answered
            const [, right, why] = EVENTS[i], ok = k === right;  // right: the correct scheduler; why: the explanation; ok: whether the student chose right
            res[i] = ok; if (ok) score++;  // records the result and adds a point if right
            btns.forEach((b) => { b.disabled = true; if (b.dataset.k === right) b.classList.add('right'); else if (b.dataset.k === k) b.classList.add('wrong'); });  // disables all buttons, colours the correct one green, and the wrongly chosen one red
            bNext.disabled = i >= EVENTS.length - 1;  // turns Next on unless this was the last event
            paintDots();  // redraws the columns and squares
            const end = i === EVENTS.length - 1 ? `<div class="small" style="margin-top:4px"><b>Done: ${score} of ${EVENTS.length} right on the first try.</b> ${EVENTS.filter((e) => e[1] === 'short').length} of the ${EVENTS.length} events woke the short-term scheduler.</div>` : '';  // after the last event, adds the final score and how many of the ten events woke the short-term scheduler
            say(msg, ok ? 'ok' : 'bad', ok ? 'Right: ' + SCH[right].name : 'Not quite: it is ' + SCH[right].name, why + end);  // feedback: green "Right" or red "Not quite" with the correct scheduler, then the explanation
          }  // ends answer()
          show();  // puts the first event on screen when the step opens
          el.append(h('div', { class: 'split l fill' },  // puts the page together: two columns, the left one smaller
            h('div', { class: 'stack' },  // left column: the explanation cards
              h('div', { class: 'card mem tight small', html: '<b>Medium-term scheduling</b> is part of the <span class="t">swapping</span> function. Its swap-in and swap-out decisions manage the degree of multiprogramming and, on a system without virtual memory, main memory itself: a swapped-in process must fit in the free memory.' }),  // green card: medium-term scheduling as part of swapping, and why memory size matters without virtual memory
              h('div', { class: 'card cpu tight small', html: '<b>Short-term scheduling</b> runs far more often and makes the fine-grained choice of which process runs next. It is invoked whenever an event may <b>block</b> the running process or offer a chance to <b>preempt</b> it:<ul class="m0" style="margin-top:4px"><li><span class="t">Clock interrupts</span></li><li><span class="t">I/O interrupts</span></li><li>Operating system calls</li><li>Signals, for example semaphore operations</li></ul>' }),  // blue card: short-term scheduling and the four kinds of event that call it, as a bullet list
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it must be fast', html: 'The short-term scheduler may run hundreds of times a second. Every microsecond it spends choosing is a microsecond no process gets, so its code is kept short and quick.' })),  // callout: why the short-term scheduler must be fast
            h('div', { class: 'card white stack' },  // right column: a white card holding the game
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Which scheduler reacts?'), dots),  // header row: the game's title on the left and the numbered progress squares on the right
              scen, h('div', { class: 'grid-3', style: { gap: '8px' } }, ...btns), msg,  // the event box, the three answer buttons in a row, and the feedback box
              h('div', { class: 'row gap-s' }, bNext, bAgain), sorted)));  // the Next and Start over buttons, then the columns of sorted answers
        },  // ends render() for step 6
      },  // ends step 6

      /* ============ 7. Recap ============ */
      {  // opens step 7
        title: 'Recap: four decisions, three rings, one processor',  // step title
        kind: 'recap',  // kind "recap": the summary page of the section
        render(el, ctx) {  // render(el, ctx): runs when the student opens step 7; builds the strip of schedulers and the flip cards
          const { h } = ctx;  // h builds HTML elements
          const ladder = h('div', { class: 'ladder' },  // ladder: the strip of three cards, one per processor scheduler, outer ring to inner ring
            ...[['long', 'Rarely', 'New, Exit'], ['medium', 'Now and then', 'Ready/Suspend, Blocked/Suspend'], ['short', 'Many times a second', 'Ready, Running, Blocked']].map(([k, f, st], i) =>  // each card's data: the scheduler, how often it runs, and the states of its ring
              h('div', { class: 'rung ' + SCH[k].cls, style: { flexGrow: String(1 + i * 0.35) } }, h('b', {}, SCH[k].name), h('span', { class: 'small' }, f), h('span', { class: 'xs muted' }, st))));  // one card in the scheduler's colour, a little wider for each inner ring; its name, how often, and its states
          el.append(h('div', { class: 'stack fill' },  // puts the page together as a stack that fills the step's height
            h('p', { class: 'lead m0', html: 'Click each card and try to say the answer before it turns over. The strip shows the three processor schedulers from the outer ring (least often) to the inner ring (most often).' }),  // opening sentence: how to use the flip cards and how to read the strip
            ladder,  // the strip of schedulers
            ctx.ui.flipcards([  // the flip cards: each pair is [front question, back answer]
              ['What is processor scheduling <b>for</b>?', 'Assigning processes to the processor over time so the system meets its goals: quick response time, high throughput and efficient processor use.'],  // card 1: what processor scheduling is for
              ['What does <b>long-term</b> scheduling decide?', 'Whether a new program joins the pool of processes (New → Ready, or New → Ready/Suspend). It sets the degree of multiprogramming: <b>when</b> to admit and <b>which</b> job.'],  // card 2: what long-term scheduling decides, and its when and which
              ['What does <b>medium-term</b> scheduling decide?', 'Which processes are in main memory: it swaps between Ready and Ready/Suspend, and between Blocked and Blocked/Suspend. It is part of swapping.'],  // card 3: what medium-term scheduling decides, and its link to swapping
              ['What does <b>short-term</b> scheduling decide?', 'Which Ready process runs next (Ready → Running), carried out by the dispatcher. Clock and I/O interrupts, OS calls and signals wake it.'],  // card 4: what short-term scheduling decides, and what wakes it
              ['What does <b>I/O</b> scheduling decide?', 'Which pending I/O request an available device handles next. Each device keeps its own queue of requests.'],  // card 5: what I/O scheduling decides
              ['Why admit a <b>mix</b> of jobs?', 'Processor-bound jobs keep the processor busy and I/O-bound jobs keep the devices busy. A mix keeps both working; more jobs alone mainly shrinks every share.'],  // card 6: why a mix of job kinds is admitted
            ], { cols: 3, height: 156 })));  // three columns of cards, each at least 156px tall; closes the layout
        },  // ends render() for step 7
      },  // ends step 7

      /* ============ 8. Check yourself ============ */
      {  // opens step 8
        title: 'Check yourself',  // step title
        kind: 'check',  // kind "check": the end-of-section quiz
        quiz: [  // the quiz questions; the guide's quiz engine builds, checks and scores them
          { q: 'Which kind of scheduling decides which Ready process in main memory gets the processor next?',  // quiz question 1 (multiple choice): which scheduler picks the ready process that runs next
            choices: ['Long-term scheduling', 'Medium-term scheduling', 'Short-term scheduling', 'I/O scheduling'], answer: 2,  // the four kinds of scheduling as choices; the right one is short-term (answer counts from 0)
            feedback: ['Long-term scheduling decides whether a new program enters the system at all, not who runs next.', 'Medium-term scheduling decides which processes are in main memory (swapping), not which one runs.', null, 'I/O scheduling orders requests waiting for a device, not processes waiting for the processor.'],  // feedback for each wrong choice saying what that kind really decides (null for the right one)
            why: 'Short-term scheduling, carried out by the dispatcher, makes the Ready → Running decision, many times a second.' },  // explanation shown after answering: the dispatcher's Ready → Running decision
          { q: 'A newly created batch job goes straight into the Ready/Suspend state instead of Ready. Which kind of scheduling made that decision, and why?',  // quiz question 2: who sends a new batch job straight to Ready/Suspend, and why
            choices: ['Long-term: it admitted the job while main memory was full', 'Medium-term: it swapped the job out because it had low priority', 'Short-term: it preempted the job when its time slice ended', 'I/O scheduling: the job is waiting for the disk'], answer: 0,  // choices: an admission while memory is full (right), a swap out, a preemption, or waiting for I/O
            feedback: [null, 'The job was never in main memory, so nothing was swapped out. New → Ready/Suspend is an admission.', 'A preempted process goes from Running to Ready; this job has never run.', 'Ready/Suspend means not waiting for any event, so the job is not waiting for the disk.'],  // feedback: the job was never in memory, has never run, and is not waiting for any event
            why: 'New → Ready and New → Ready/Suspend are both admissions, made by long-term scheduling. When memory is full, the admitted process starts out on disk.' },  // explanation: both admission arrows belong to long-term scheduling
          { type: 'tf', q: 'Medium-term scheduling runs more often than short-term scheduling, because processes are swapped in and out constantly.', answer: false,  // quiz question 3 (true or false): the claim that medium-term scheduling runs more often than short-term; it is false
            why: 'Swapping is slow disk work, so it happens now and then. Short-term scheduling runs on every clock interrupt, I/O interrupt, system call and signal: by far the most often.' },  // explanation: swapping is slow disk work, while short-term scheduling runs most often
          { type: 'multi', q: 'Which of these events invoke the short-term scheduler? Select all that apply.',  // quiz question 4 (select all): which events call the short-term scheduler
            choices: ['A clock interrupt', 'An I/O interrupt', 'A process making an operating system call', 'A semaphore operation such as semSignal', 'A new batch job arriving in the batch queue'], answer: [0, 1, 2, 3],  // choices: interrupts, OS calls and semaphore operations are right; a new batch job is the odd one out
            why: 'The short-term scheduler runs whenever an event may block the running process or offer a chance to preempt it: clock interrupts, I/O interrupts, OS calls and signals. A new batch job is a matter for long-term scheduling.' },  // explanation: the four triggers, and why a new batch job is long-term business
          { type: 'order', q: 'Order the three processor schedulers from the one that runs least often to the one that runs most often.',  // quiz question 5 (put in order): the three processor schedulers from least often to most often
            items: ['Long-term scheduling', 'Medium-term scheduling', 'Short-term scheduling'],  // the items, written in the correct order (the quiz engine shuffles them)
            why: 'Long-term decisions happen when jobs arrive or leave, medium-term when memory pressure changes, and short-term many times every second. The inner the ring, the more often its decision.' },  // explanation: when each one acts, and the rule that inner rings decide more often
          { type: 'match', q: 'Match each move or decision to the kind of scheduling that makes it.',  // quiz question 6 (match): each move or decision to its kind of scheduling
            pairs: [['New → Ready/Suspend', 'Long-term scheduling'], ['Blocked → Blocked/Suspend', 'Medium-term scheduling'], ['Ready → Running', 'Short-term scheduling'], ['A disk chooses which pending request to serve next', 'I/O scheduling']],  // the four pairs: an admission, a swap out, a dispatch, and a disk ordering its requests
            why: 'Admission is long-term, swapping in or out is medium-term, dispatching is short-term, and ordering a device’s request queue is I/O scheduling.' },  // explanation: admission, swapping, dispatching and request ordering in one sentence
          { type: 'bucket', q: 'Sort each transition or event by the kind of scheduling that handles it.', buckets: ['Long-term', 'Medium-term', 'Short-term'],  // quiz question 7 (sort into groups): six moves and events into long-, medium- and short-term
            items: [['New → Ready', 0], ['A user logs in to a time-sharing system', 0], ['Ready/Suspend → Ready', 1], ['Blocked → Blocked/Suspend', 1], ['Ready → Running', 2], ['A clock interrupt ends a time slice', 2]],  // the items, each with its correct group number: admissions and logins, swaps, and dispatching with clock interrupts
            why: 'Admissions and logins are long-term; swapping between memory and disk is medium-term; dispatching and reacting to clock interrupts is short-term.' },  // explanation: the rule behind each group
          { type: 'num', q: 'The long-term scheduler admits 4 processes. Each waits for I/O 50% of the time, independently of the others. Using processor utilization = 1 − p<sup>n</sup>, what percentage of the time is the processor busy?', answer: 93.75, tol: 0.3, unit: '%',  // quiz question 8 (calculate): processor busy with 4 processes that each wait 50% of the time; 93.75, within 0.3
            why: 'p = 0.5 and n = 4: 1 − 0.5<sup>4</sup> = 1 − 0.0625 = 0.9375, so the processor is busy 93.75% of the time.' },  // explanation: the formula worked through step by step
          { type: 'num', q: 'Five admitted processes are always ready to compute, and the short-term scheduler shares the processor equally among them. What percentage of the processor’s time does each process get?', answer: 20, tol: 0.01, unit: '%',  // quiz question 9 (calculate): each process's share when five always-ready processes split the processor; 20%
            why: 'The processor is busy all the time and is split five ways: 100% ÷ 5 = 20% each. Admitting more processes shrinks every share.' },  // explanation: 100% split five ways, and why more processes shrink every share
          { q: 'Three processor-bound jobs are running and the disk sits mostly idle. Which waiting job should the long-term scheduler admit next to make better use of the hardware?',  // quiz question 10: which job to admit when three processor-bound jobs leave the disk idle
            choices: ['Another processor-bound job', 'An I/O-bound job', 'No job: admission has no effect on how busy the devices are', 'Whichever job needs the most memory'], answer: 1,  // choices: another processor-bound job, an I/O-bound job (right), no job, or the biggest job
            feedback: ['The processor is already busy; another processor-bound job only shrinks the shares while the disk stays idle.', null, 'Admission decides the mix of work, and the mix decides which devices stay busy.', 'Memory size says nothing about whether the job will use the idle disk.'],  // feedback: why more computing, doing nothing, or memory size do not help the idle disk
            why: 'An I/O-bound job uses the disk while the processor-bound jobs compute, so both resources stay busy. Keeping a balanced mix is a classic long-term policy.' },  // explanation: a balanced mix keeps both the processor and the disk busy
          { q: 'A time-sharing system is already saturated. What does the OS typically do when one more authorized user tries to log in?',  // quiz question 11: what a saturated time-sharing system does with one more login
            choices: ['Refuse the login with a “system full, try later” message', 'Accept it and keep accepting every login, however slow the system becomes', 'Put the login in the batch queue to start hours later', 'Accept it by permanently ending the oldest user’s session'], answer: 0,  // choices: refuse it (right), accept everything, queue it like a batch job, or end someone else's session
            feedback: [null, 'Past saturation every user would get poor response time, which is exactly what the limit prevents.', 'An interactive user needs an answer now; parking a login for hours is not how time-sharing admission works.', 'The OS does not end someone else’s work to make room for a newcomer.'],  // feedback: why each wrong choice is not how time-sharing admission works
            why: 'Logins are admitted until the system is saturated; after that the OS refuses new ones so the existing users keep acceptable response times.' },  // explanation: logins are accepted until saturation, then refused to protect response time
          { type: 'tf', q: 'On a system without virtual memory, medium-term scheduling must consider whether a swapped-out process will fit in the free main memory before swapping it in.', answer: true,  // quiz question 12 (true or false): without virtual memory a swap in must check that the process fits; it is true
            why: 'Without virtual memory a process must be wholly in main memory to run, so the swap-in decision depends on its memory needs as well as on the degree of multiprogramming.' },  // explanation: the whole process must be in memory to run, so its size matters
        ],  // closes the quiz list
      },  // ends step 8

    ],  // closes the steps list

    notes: `${/* notes: the section's reading notes, opened with the Notes button; written as HTML */''}
      <h3>What processor scheduling is for</h3>${/* heading for part 1 of the notes: what scheduling is for */''}
      <p>A system may hold many processes but only one processor. <b>Processor scheduling</b> assigns processes to the processor over time so that the system meets its goals, such as quick <b>response time</b>, high <b>throughput</b> (work finished per unit of time) and efficient use of the processor. The OS does this with four different kinds of decision, made on very different time scales.</p>${/* notes paragraph: one processor, many processes, the goals of scheduling and the four kinds of decision */''}
      <table>${/* start of the summary table of the four kinds of scheduling */''}
        <tr><th>Kind</th><th>The question it answers</th><th>State moves it makes</th><th>How often</th></tr>${/* table header: kind, question, state moves, how often */''}
        <tr><td><b>Long-term</b></td><td>Should a new program be added to the pool of processes to be executed?</td><td>New → Ready, New → Ready/Suspend</td><td>Rarely</td></tr>${/* table row: long-term scheduling */''}
        <tr><td><b>Medium-term</b></td><td>Should a process be partly or fully in main memory, or swapped out to disk?</td><td>Ready ↔ Ready/Suspend, Blocked ↔ Blocked/Suspend</td><td>Now and then</td></tr>${/* table row: medium-term scheduling */''}
        <tr><td><b>Short-term</b></td><td>Which ready process does the processor run next? (the dispatcher)</td><td>Ready → Running</td><td>Most often: many times a second</td></tr>${/* table row: short-term scheduling, the dispatcher */''}
        <tr><td><b>I/O</b></td><td>Which pending I/O request does an available device handle next?</td><td>none (it orders a device’s request queue)</td><td>Each time a device finishes a request</td></tr>${/* table row: I/O scheduling, which makes no state moves */''}
      </table>${/* end of the summary table */''}

      <h3>The schedulers on the seven-state model</h3>${/* heading for part 2: the schedulers on the seven-state model */''}
      <p>The three processor schedulers nest like rings around the seven-state process model. The <b>innermost</b> ring is short-term scheduling: Ready, Running and Blocked, the processes already in main memory. Around it is <b>medium-term</b> scheduling: the suspended states Ready/Suspend and Blocked/Suspend. The <b>outermost</b> ring is long-term scheduling: New and Exit. To reach the processor a process passes every ring from the outside in: it is admitted, it is in main memory, and only then is it chosen to run. The inner the ring, the more often its decision is made.</p>${/* notes paragraph: the three nested rings and the order a process passes them */''}
      <p>Other arrows are <b>events</b>, not scheduling choices: <i>time-out</i> (Running → Ready), <i>event wait</i> (Running → Blocked, e.g. an I/O request or semWait), <i>event occurs</i> (Blocked → Ready, or Blocked/Suspend → Ready/Suspend on disk) and <i>release</i> (Running → Exit). Most of them wake the short-term scheduler. Only processes in main memory can be dispatched, so a Ready/Suspend process must first be swapped in.</p>${/* notes paragraph: the event arrows that no scheduler chooses, and why a suspended process must be swapped in first */''}

      <h3>The queuing view</h3>${/* heading for part 3: the queuing view */''}
      <p>The same system can be drawn as a network of queues:</p>${/* notes paragraph: introduces the network of queues */''}
      <ul>${/* start of the list of queues */''}
        <li><b>Batch jobs</b> wait (usually on disk) until long-term scheduling admits them into the <b>ready queue</b>, or into the <b>Ready/Suspend queue</b> when main memory is full.</li>${/* list item: batch jobs wait to be admitted into the ready queue, or into Ready/Suspend when memory is full */''}
        <li><b>Interactive users</b> do not wait in a batch queue: a login creates a process that goes straight into the ready queue, as long as the system is not saturated.</li>${/* list item: interactive logins go straight to the ready queue unless the system is saturated */''}
        <li>Short-term scheduling dispatches from the ready queue. A <b>time-out</b> returns the process to the back of the ready queue, an <b>event wait</b> moves it to a <b>blocked queue</b>, and <b>release</b> sends it to Exit. When the event occurs it rejoins the ready queue.</li>${/* list item: dispatch, time-out, event wait, release and event occurs around the ready and blocked queues */''}
        <li>Medium-term scheduling moves processes between the ready queue and the Ready/Suspend queue, and between the blocked queue and the Blocked/Suspend queue. If the event a swapped-out process waits for occurs, it moves from Blocked/Suspend to Ready/Suspend.</li>${/* list item: the medium-term moves between memory queues and disk queues, and an event occurring on disk */''}
      </ul>${/* end of the list of queues */''}
      <h3>Long-term scheduling</h3>${/* heading for part 4: long-term scheduling */''}
      <p>Long-term scheduling decides which programs are admitted to the system, so it controls the <b>degree of multiprogramming</b>: how many processes are active at once. More processes give the processor more chances to find work, but each process then gets a smaller share of it, and every process needs main memory.</p>${/* notes paragraph: admission controls the degree of multiprogramming, and the trade-off it involves */''}
      <p><b>Worked example.</b> In a simplified model where each process waits for I/O a fraction p of the time, independently of the others, the processor is idle only when all n processes wait at once, so utilization = 1 − p<sup>n</sup>. With p = 0.6: n = 3 gives 1 − 0.216 = 78.4% busy, about 26.1% per process; n = 5 gives 1 − 0.078 = 92.2% busy, about 18.4% per process. Each extra process adds less while every share shrinks. (p = 0.5, n = 4: 1 − 0.0625 = 93.75%.)</p>${/* notes paragraph: the worked example of the 1 − p^n model, with the numbers for n = 3, n = 5 and the quiz case */''}
      <p>The long-term scheduler makes two decisions:</p>${/* notes paragraph: introduces the two long-term decisions */''}
      <ul>${/* start of the list of the two decisions */''}
        <li><b>When</b> can the OS take on another process? For example each time a job ends, or when the processor has been idle for more than some fraction of the time (a rule such as “admit while idle more than 10%”).</li>${/* list item: when to admit, including the "idle more than 10%" rule */''}
        <li><b>Which</b> job comes next? Possible rules: first come first served, priority, expected execution time, or I/O requirements. A common goal is a <b>balanced mix</b> of processor-bound jobs (long processor bursts, little I/O) and I/O-bound jobs (short bursts, much I/O), or favouring jobs that need devices nobody is using right now.</li>${/* list item: which job to admit, and the goal of a balanced mix of job kinds */''}
      </ul>${/* end of the list of the two decisions */''}
      <p><b>The mix in numbers.</b> One processor and one disk, each serving jobs in arrival order, for 30 time units; processor-bound jobs compute 5 units then use the disk for 1, I/O-bound jobs compute 1 then use the disk for 4. Three processor-bound jobs: processor 100% busy, disk only 17%. Three I/O-bound jobs: processor 33%, disk 97%. One processor-bound then two I/O-bound jobs (in that order): processor 90%, disk 83%. The mix keeps both resources working.</p>${/* notes paragraph: the process-mix results in numbers, matching the "Which mix?" tab */''}
      <p><b>Time-sharing.</b> A user logging in creates a process. The OS accepts every authorized user until the system is <b>saturated</b>, then refuses new logins with a message such as “system full, try later”. A batch job can wait to be admitted later; a person at a keyboard cannot.</p>${/* notes paragraph: time-sharing logins and saturation */''}
      <p><b>Common mistake:</b> more jobs is not always more work done. Once the processor is nearly always busy, extra jobs mostly shrink every share and crowd memory.</p>${/* notes paragraph: the common mistake that more jobs always means more work done */''}

      <h3>Medium-term scheduling</h3>${/* heading for part 5: medium-term scheduling */''}
      <p>Medium-term scheduling is part of the <b>swapping</b> function: it decides when to swap a process out to disk and when to swap one back in. Its decisions manage the degree of multiprogramming and, on a system without virtual memory, main memory itself, because a process must then fit entirely in free memory before it can be swapped in. The usual way to free memory is to swap out a <b>Blocked</b> process, which cannot use its memory while it waits anyway. When everything in memory is blocked and ready work waits on disk, swapping keeps the processor busy.</p>${/* notes paragraph: swapping, the memory-fit rule without virtual memory, and why blocked processes are swapped out first */''}

      <h3>Short-term scheduling</h3>${/* heading for part 6: short-term scheduling */''}
      <p>Short-term scheduling, carried out by the <b>dispatcher</b>, makes the fine-grained decision of which ready process runs next. It runs far more often than the other two. It is invoked whenever an event may block the current process or offer a chance to preempt it:</p>${/* notes paragraph: the dispatcher's job and when it is called */''}
      <ul>${/* start of the list of events that call it */''}
        <li><b>Clock interrupts</b> (for example, the end of a time slice)</li>${/* list item: clock interrupts */''}
        <li><b>I/O interrupts</b> (a device finished, so a waiting process may now be ready)</li>${/* list item: I/O interrupts */''}
        <li><b>Operating system calls</b> (the caller may have to wait)</li>${/* list item: operating system calls */''}
        <li><b>Signals</b>, for example semaphore operations such as semWait and semSignal</li>${/* list item: signals such as semaphore operations */''}
      </ul>${/* end of the list of events */''}
      <p>It may run hundreds of times a second, so it must be fast: time spent choosing is time no process gets.</p>${/* notes paragraph: why the short-term scheduler must be fast */''}

      <h3>How often each one runs</h3>${/* heading for part 7: how often each one runs */''}
      <p>Long-term scheduling runs rarely (when jobs arrive or finish, or users log in), medium-term scheduling more often (when memory pressure changes), and short-term scheduling most often. In a small run of six jobs (three memory slots, 3-unit time slice) a sensible policy made 6 long-term, 2 medium-term and 13 short-term decisions: each job is admitted once, but every time-out, I/O request and exit needs a new dispatch.</p>${/* notes paragraph: the three frequencies, with the decision counts from the lab's built-in policy */''}
    `,  // end of the notes text
  });  // ends the section description passed to Guide.section
})();  // ends the function that wraps the section and runs it immediately
