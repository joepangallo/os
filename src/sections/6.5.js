// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.5  An Integrated Deadlock Strategy
   No single deadlock method suits every resource. A practical design sorts
   resources into classes, numbers the classes (so no deadlock can cross
   from one class to another), and inside each class uses the method that
   fits how those resources behave. All helpers live in this IIFE so
   nothing leaks into the global scope.
   ===================================================================== */
(() => {  // starts a function that runs once, right away, so every name defined in this section stays private to this file
  // CLS: the four resource classes, in the order a process acquires them, with the label of each class's method
  const CLS = [  // CLS: an array (ordered list) of the four resource classes, one object of named facts per class, lowest class first
    { n: 1, name: 'Swappable space', short: 'Swap space', what: 'Disk blocks that hold a swapped-out process’s image.', eg: 'swap area blocks',  // class 1, swappable space: its number, full name, short name for small tables, one-line description and examples
      mlabel: 'All at once', mshort: 'all at once' },  // class 1's method: the long label for the step 4 table headers and the short one for its slim small-screen layout
    { n: 2, name: 'Process resources', short: 'Devices, files', what: 'Devices and files a process keeps for long stretches.', eg: 'tape drives, files opened for exclusive use',  // class 2, process resources: devices and files kept a long time, with tape drives and locked files as examples
      mlabel: 'Avoidance', mshort: 'avoid' },  // class 2's method labels: avoidance (the banker's safety test), long and short
    { n: 3, name: 'Main memory', short: 'Memory', what: 'Memory handed out in pages or segments.', eg: 'page frames, segments',  // class 3, main memory: memory handed out in pages or segments, with page frames and segments as examples
      mlabel: 'Preempt by swapping', mshort: 'preempt' },  // class 3's method labels: preemption by swapping, long and short
    { n: 4, name: 'Internal resources', short: 'Channels', what: 'Things the system itself uses briefly during I/O.', eg: 'I/O channels',  // class 4, internal resources: things the system uses for a moment during I/O, with I/O channels as the example
      mlabel: 'Number order', mshort: 'order' },  // class 4's method labels: requesting in number order, long and short
  ];  // closes the CLS array
  // how the resources of each class behave: the three facts that decide which method fits
  CLS[0].facts = { known: 'Yes, the image size is known at the start.', back: 'No, swapped-out processes live there.', held: 'The whole life of the process.' };  // class 1 facts: the size is known ahead, it cannot be taken back, and it is held for the whole life of the process
  CLS[1].facts = { known: 'Yes, the job declares them up front.', back: 'No, a half-written tape is ruined.', held: 'Long stretches: minutes or hours.' };  // class 2 facts: needs are declared up front, taking them back ruins work, and they are held for long stretches
  CLS[2].facts = { known: 'Only roughly; use changes as it runs.', back: 'Yes, copy it to disk and back later.', held: 'While running, in changing amounts.' };  // class 3 facts: needs are only roughly known, memory is cheap to take back by swapping, and amounts change
  CLS[3].facts = { known: 'No, the system grabs them as I/O happens.', back: 'Awkward: a cut-off transfer restarts.', held: 'Milliseconds per use, thousands of uses.' };  // class 4 facts: needs are not known ahead, taking one back mid-transfer is awkward, and each use is very short
  // the workshop picture of each class (the analogy in step 1)
  CLS[0].shop = 'Shelf space in the storeroom, where a half-built project is parked.';  // workshop picture for class 1: storeroom shelf space where an unfinished project is parked
  CLS[1].shop = 'The big table saw, booked for a long stretch.';  // workshop picture for class 2: a large shared machine booked for a long time
  CLS[2].shop = 'A workbench. A project can be moved off it onto its shelf, and back.';  // workshop picture for class 3: a workbench a project can be moved off and back onto
  CLS[3].shop = 'Clamps, grabbed for a minute at a time.';  // workshop picture for class 4: small tools grabbed for a minute and put back
  // short versions of the facts, for the class cards in the matching lab (step 2)
  CLS[0].brief = ['yes, the image size', 'no', 'the whole run'];  // short facts for the class 1 card: known ahead, not cheap to take back, held for the whole run
  CLS[1].brief = ['yes, the job declares them', 'no, work is ruined', 'long stretches'];  // short facts for the class 2 card: declared ahead, taking back ruins work, held for long stretches
  CLS[2].brief = ['only roughly', 'yes, copy to disk', 'while running'];  // short facts for the class 3 card: known only roughly, easy to copy to disk, held while running
  CLS[3].brief = ['no', 'awkward mid-transfer', 'milliseconds, very often'];  // short facts for the class 4 card: not known ahead, awkward to take back, used briefly and very often

  // METHODS: the five methods offered in the matching lab
  const METHODS = [  // METHODS: the five method buttons on every class card in step 2, each with a key, a button label and a definition
    { k: 'all', label: 'All at once', def: 'all of it in one request' },  // method "all": ask for everything in a single request (the prevention rule that removes hold and wait)
    { k: 'avoid', label: 'Avoidance', def: 'banker’s test on each request' },  // method "avoid": run the banker's safety test before granting each request
    { k: 'preempt', label: 'Preempt', def: 'take it back from its holder' },  // method "preempt": take the resource back from whoever holds it
    { k: 'order', label: 'Number order', def: 'request in rising number order' },  // method "order": number the resources and request them only in rising order
    { k: 'detect', label: 'Detect later', def: 'grant now, break deadlocks later' },  // method "detect": grant freely now and find and break deadlocks afterwards
  ];  // closes the METHODS array
  // FIT[class][method] = [grade, explanation]; grade is 'best', 'ok' (works, but not the best) or 'poor'
  const FIT = [  // FIT: one object per class (in CLS order), keyed by method key; step 2 shows the matching text when a method is picked
    { all: ['best', 'The size of a process image is known when the process is created, so all of its swap space can be reserved in one request. A process waiting for swap space holds none, so hold and wait cannot happen in this class. Nothing is wasted either: the space is needed for the whole run anyway.'],  // class 1 with all at once (best): the size is known, so reserving it in one request removes hold and wait at no cost
      avoid: ['ok', 'Because the maximum need is known, the banker’s test could check each request. But the space is needed all at once and for the whole run, so a plain all-at-once reservation gives the same safety without running any test.'],  // class 1 with avoidance (works): the test would be safe, but a single reservation gives the same safety with no test
      preempt: ['poor', 'Swap space is where a swapped-out process’s memory image lives. Take it away and that image has nowhere to go: the process would have to be killed, or its image moved to yet more space.'],  // class 1 with preemption (poor): taking swap space away leaves a swapped-out image with nowhere to live
      order: ['poor', 'Swap blocks are one pool of identical units: a process needs a certain amount of space, not particular blocks. Ranking the blocks one by one would only stop a process from using free blocks numbered below the ones it holds. The real danger is holding part of the space while waiting for the rest, and all-at-once removes exactly that.'],  // class 1 with number order (poor): swap blocks are identical, so ranking them guards against the wrong danger
      detect: ['poor', 'A deadlock over swap space could only be broken by aborting a process, since swap space cannot be taken from a process without destroying its stored image. Its whole run would be lost, a needless risk when the need is known in advance.'] },  // class 1 with detection (poor): breaking a swap deadlock means aborting a process and losing its whole run
    { avoid: ['best', 'Jobs declare up front which devices and files they will use: exactly the maximum claim the banker’s algorithm needs. Such requests are few, so a safety test on each is cheap. Nothing is ever taken back, and a job does not have to grab every drive in one go.'],  // class 2 with avoidance (best): jobs already declare their maximum claims, and the rare requests make tests cheap
      order: ['ok', 'Numbering the drives and files and requesting them in rising order also rules out deadlock inside the class. The cost: a job may have to grab a resource earlier than it needs it, just to respect the numbering.'],  // class 2 with number order (works): it prevents deadlock, but may force a job to grab a resource too early
      all: ['ok', 'Reserving every drive and file at the start is safe, but a job that needs a drive only for its last few minutes holds it idle all along, while other jobs wait for nothing.'],  // class 2 with all at once (works): safe, but a drive needed only at the end sits idle in a job's hands meanwhile
      preempt: ['poor', 'Take an <span class="t">assignable device</span> such as a tape drive away halfway through a job and the half-written tape is useless: the job must rewind and redo all its tape work. A file being updated is worse: it may be left half-changed.'],  // class 2 with preemption (poor): taking a tape drive mid-job wastes the tape work and can leave a file half-changed
      detect: ['poor', 'Recovering here means aborting or rolling back a job that holds tapes or files, throwing away long stretches of work. The needs are declared anyway, so avoidance keeps the deadlock from ever forming, for the price of a quick test.'] },  // class 2 with detection (poor): recovery throws away long stretches of work that avoidance would have protected
    { preempt: ['best', 'Memory is easy to take back (<span class="t">preemption by swapping</span>): copy the process’s pages to its swap space, suspend it, and later bring it back exactly where it stopped. No work is lost, only some disk time, so a memory request never has to wait on a process that is itself stuck.'],  // class 3 with preemption (best): memory can be swapped out and back with no lost work, only some disk time
      all: ['ok', 'Every process would have to grab the most memory it might ever use, for its whole run. Memory is scarce, so far fewer processes could run at once.'],  // class 3 with all at once (works): each process would grab its largest possible memory, so far fewer could run
      avoid: ['poor', 'Memory use changes constantly as a process runs, so a declared maximum is a rough guess, and a safety test on every allocation adds up. It is also unnecessary: unlike a tape drive, memory can simply be taken back.'],  // class 3 with avoidance (poor): memory use changes too often for a declared maximum, and the tests add up
      order: ['poor', 'Memory is handed out as interchangeable page frames, or as segments carved from whatever space is free. A process needs enough of it, not one particular frame, so numbering frames gives no useful order.'],  // class 3 with number order (poor): page frames are interchangeable, so numbering them gives no useful order
      detect: ['poor', 'Breaking a memory deadlock after the fact would mean taking memory away anyway, or aborting a process. Memory can be preempted cheaply, so do it at once, before anyone sits frozen.'] },  // class 3 with detection (poor): recovery would take memory back anyway, so better to take it back at once
    { order: ['best', 'Channels are used inside the system’s own I/O code, so its designers simply write that code to take channels in number order. That costs nothing at run time: no test, no table, no waiting beyond the brief use itself.'],  // class 4 with number order (best): the system's own I/O code takes channels in order, costing nothing at run time
      all: ['poor', 'A channel is busy for milliseconds at a time. Reserving it for a whole run would lock every other process out of that I/O path for minutes, while it sits idle almost all the time.'],  // class 4 with all at once (poor): holding a channel for a whole run blocks that I/O path while it sits idle
      avoid: ['poor', 'A safety test on each of thousands of brief channel uses would cost far more than the transfers themselves, and nobody can sensibly declare channel needs in advance.'],  // class 4 with avoidance (poor): a test on thousands of tiny uses costs more than the transfers themselves
      preempt: ['poor', 'Snatching a channel in the middle of a transfer means the transfer must start over. Each use is over in moments, so waiting is simpler than preempting.'],  // class 4 with preemption (poor): cutting off a transfer means restarting it, while waiting a moment is simpler
      detect: ['poor', 'A deadlock inside the system’s own I/O paths would freeze I/O for every process until it was found. Numbering the channels prevents it for free.'] },  // class 4 with detection (poor): a deadlock in the I/O code would freeze I/O for everyone until it was found
  ];  // closes the FIT array
  const GRADE = { best: ['ok', '✓ Best fit'], ok: ['warn', '~ Works, but not the best'], poor: ['bad', '✗ Poor fit'] };  // GRADE: for each grade, the colour name for the feedback box and the verdict words shown on the card

  // JC: the colour class of each job token (teal, indigo, pink), just to tell jobs apart
  const JC = ['proc', 'accent', 'thread'];  // JC: the colour names for jobs A, B and C, so each job keeps the same colour in every table and caption

  // say(ctx): a coloured explanation box; .put(cls, html) swaps its colour and text
  function say(ctx) {  // say(ctx): builds the coloured feedback box used under the labs; ctx is the step's toolkit from the guide
    const el = ctx.h('div', { class: 'say', 'aria-live': 'polite' });  // creates the box as a div; aria-live makes screen readers announce each new message in it
    el.put = (cls, html) => { el.className = 'say ' + (cls || ''); el.innerHTML = html; };  // adds a put method that changes the box's colour (ok, bad, warn or info) and replaces its text in one call
    return el;  // hands the finished box back to the step that asked for it
  }  // ends say()

  /* ---- The walk-through (step 4) ----
     Three jobs collect resources class by class under the integrated design. WALK holds the system, the
     jobs and a script: the order in which the jobs make their requests. runWalk() plays the script through
     the four class methods and returns one frame per request, each with a snapshot of the whole system and
     the facts the narration needs, so the table, the meters and the captions all come from the same run. */
  const WALK = {  // WALK: the fixed scenario for step 4, so every visit replays exactly the same story
    swap: 10, tape: 3, mem: 7,   // GB of swap space, tape drives, GB of main memory; channels CH1 and CH2
    jobs: [   // pri: priority (higher wins); swap = mem, so a job's whole image always fits in its swap space
      { id: 'A', name: 'Payroll', pri: 3, swap: 4, claim: 3, mem: 4, use: ['CH1', 'CH2'] },  // job A, Payroll: highest priority, needs 4 GB swap and memory, claims up to 3 tape drives, uses CH1 then CH2
      { id: 'B', name: 'Backup', pri: 2, swap: 3, claim: 2, mem: 3, use: ['CH2', 'CH1'] },  // job B, Backup: middle priority, needs 3 GB, claims up to 2 tape drives, uses CH2 before CH1 (against the order)
      { id: 'C', name: 'Report', pri: 1, swap: 5, claim: 0, mem: 5, use: ['CH1'] },  // job C, Report: lowest priority, needs 5 GB, no tape drives, uses only CH1
    ],  // closes the job list
    script: [['A', 'swap'], ['B', 'swap'], ['C', 'swap'], ['A', 'tape', 2], ['B', 'tape', 1], ['A', 'tape', 1], ['A', 'mem'], ['A', 'ch'], ['A', 'end'],  // script, first half: each entry is [job, what it asks for, how many]; all reserve swap, A and B ask for tapes, A runs to the end
      ['B', 'tape', 1], ['C', 'mem'], ['B', 'mem'], ['B', 'ch'], ['B', 'end'], ['C', 'ch'], ['C', 'end']],  // script, second half: B asks for one more tape, C and B ask for memory, then B and C take their channels and finish
  };  // closes WALK
  // bankerTest(free, list): the safety test for one resource type; list holds {id, hold, claim}.
  // Returns whether it is safe, the order found (with the free count before and after each job), and who is stuck.
  function bankerTest(free, list) {  // bankerTest(free, list): repeatedly finds a job whose remaining need fits in what is free, as the banker's test does
    let work = free; const rest = list.slice(); const seq = [];  // work: drives free so far in the test; rest: jobs not yet shown able to finish; seq: the order in which they finish
    for (;;) {  // loops until no remaining job can finish (the break below ends it)
      const i = rest.findIndex((p) => p.claim - p.hold <= work);  // finds the first job whose claim minus what it holds fits in the work count; -1 if there is none
      if (i < 0) break;  // no job can finish with what is free, so the test stops here
      const p = rest.splice(i, 1)[0];  // takes that job out of the waiting list (splice removes it and returns it in a one-item list)
      seq.push({ id: p.id, need: p.claim - p.hold, before: work, after: work + p.hold });  // records the job in the safe order, with its remaining need and the free count before and after it finishes
      work += p.hold;  // a finished job hands back every drive it held, so more are free for the jobs still in the list
    }  // ends the test loop
    return { ok: !rest.length, seq, stuck: rest.map((p) => ({ id: p.id, need: p.claim - p.hold })) };  // safe only if every job finished; also returns the safe order and, for any jobs left over, how much they still need
  }  // ends bankerTest()
  function runWalk() {  // runWalk(): plays the step 4 script once and returns a frame for every request, plus the run's totals
    const st = { swap: WALK.swap, tape: WALK.tape, mem: WALK.mem, ch: { CH1: null, CH2: null }, tests: 0, outs: 0, ins: 0, refused: 0,  // st: the whole system's state: what is free of each kind, who holds each channel, and counters for the summary
      J: WALK.jobs.map((j) => ({ ...j, sH: 0, tH: 0, mH: 0, out: false, chH: [], wait: null, done: false })) };  // J: a working copy of each job with what it holds (swap, tape, memory, channels), whether it is swapped out or waiting
    const byId = (id) => st.J.find((j) => j.id === id);  // byId(id): finds a job in the working copy by its letter
    const queue = [];   // requests waiting to be retried, oldest first
    const frames = [];  // frames: the list of snapshots that the step 4 player steps through
    const snap = () => ({ swap: st.swap, tape: st.tape, mem: st.mem, ch: { ...st.ch }, J: st.J.map((j) => ({ ...j, chH: j.chH.slice(), wait: j.wait && { ...j.wait } })),  // snap(): copies the current state, so later changes to st cannot alter a frame already recorded
      tally: { tests: st.tests, refused: st.refused, outs: st.outs, ins: st.ins } });  // the snapshot also keeps the running counts of tests, refusals and swaps for the tally under the table
    // attempt(j, kind, n): one request, handled by its class's own method; returns what happened
    function attempt(j, kind, n) {  // attempt(j, kind, n): handles one request from job j for a kind of resource, using that class's method
      if (kind === 'swap') {   // class 1: all of it in one request, or nothing
        const ok = j.swap <= st.swap;  // the request succeeds only if the job's whole swap need fits in what is free
        if (ok) { st.swap -= j.swap; j.sH = j.swap; }  // if it fits, the free swap space shrinks and the job now holds all of it
        return { cls: 1, ok, n: j.swap, free: st.swap };  // reports the class, the result, the amount asked for and what remains free
      }  // ends the class 1 branch
      if (kind === 'tape') {   // class 2: grant on paper, keep the grant only if the safety test passes
        if (n > st.tape) return { cls: 2, ok: false, n, busy: true, free: st.tape };  // more drives asked for than are free: the request fails at once, before any safety test
        j.tH += n; st.tape -= n; st.tests++;  // grants the drives on paper (the job holds them for now) and counts one more safety test
        const left = st.tape;  // left: the drives still free after this paper grant, shown in the caption
        const test = bankerTest(left, st.J.filter((p) => !p.done && p.claim > 0).map((p) => ({ id: p.id, hold: p.tH, claim: p.claim })));  // runs the safety test over every unfinished job that has a tape claim, using what each holds and claims
        if (!test.ok) { j.tH -= n; st.tape += n; }  // if the state would be unsafe, the paper grant is undone and the drives go back to the free count
        return { cls: 2, ok: test.ok, n, test, left, free: st.tape };  // reports the result together with the full test, so the caption can show each step of the safe order
      }  // ends the class 2 branch
      if (kind === 'mem') {   // class 3: if memory is short, swap out the lowest-priority job in memory
        const had = st.mem;  // had: memory free before anything changes, quoted in the caption
        let victim = null;  // victim: the job whose memory gets taken back, if one is needed
        if (j.mem > st.mem) {  // only when the request does not fit in free memory
          victim = st.J.filter((p) => p !== j && p.mH > 0 && p.pri < j.pri).sort((a, b) => a.pri - b.pri)[0] || null;  // picks the lowest-priority other job that has memory and ranks below the asking job, or none
          if (victim) { st.mem += victim.mH; victim.mH = 0; victim.out = true; victim.wait = { kind: 'mem', cls: 3, n: victim.mem }; queue.push({ id: victim.id, kind: 'mem' }); st.outs++; }  // swaps the victim out: its memory is freed, it is marked swapped out and waiting, and its retry goes on the queue
        }  // ends the memory-is-short branch
        const ok = j.mem <= st.mem, back = ok && j.out;  // ok: the job's memory now fits; back: this grant also brings a swapped-out job back in
        if (ok) { st.mem -= j.mem; j.mH = j.mem; j.out = false; if (back) st.ins++; }  // on success the memory is handed over, the job is marked as in memory, and a swap-in is counted if it was out
        return { cls: 3, ok, n: j.mem, had, victim: victim && victim.id, vmem: victim && victim.mem, vswap: victim && victim.sH, back, free: st.mem };  // reports the result, including who was swapped out and how big its image and its swap space are
      }  // ends the class 3 branch
      // class 4: channels in number order, whatever order the program uses them in
      const order = j.use.slice().sort();  // order: the job's channels sorted by name, which puts CH1 before CH2 (number order)
      for (const c of order) {  // asks for each channel in that order
        if (st.ch[c] === j.id) continue;  // skips a channel the job already holds (this happens when a waiting job is retried)
        if (st.ch[c]) return { cls: 4, ok: false, order, busy: c };  // a channel held by another job stops the request here; the job keeps any lower channel it already has
        st.ch[c] = j.id; j.chH.push(c);  // the channel is free: it becomes this job's and is added to the job's list of held channels
      }  // ends the channel loop
      return { cls: 4, ok: true, order, use: j.use, reordered: order.join() !== j.use.join() };  // success; reordered tells the caption whether the rule changed the order the program wanted
    }  // ends attempt()
    frames.push({ start: true, snap: snap() });  // the first frame is the starting picture, before any request is made
    WALK.script.forEach(([id, kind, n]) => {  // plays the script one entry at a time: a job letter, a kind of request, and sometimes a count
      const j = byId(id);  // finds the job making this request
      if (kind === 'end') {   // the job finishes: give everything back, then retry the waiting requests, oldest first
        const rel = { swap: j.sH, tape: j.tH, mem: j.mH, ch: j.chH.slice() };  // rel: what the job is about to give back, kept for the caption
        st.swap += j.sH; st.tape += j.tH; st.mem += j.mH; j.chH.forEach((c) => { st.ch[c] = null; });  // returns all the job's swap space, tape drives and memory to the free counts and frees its channels
        Object.assign(j, { sH: 0, tH: 0, mH: 0, chH: [], done: true });  // clears the job's holdings and marks it done
        const woke = [];  // woke: the waiting requests that succeed on this retry
        for (let i = 0; i < queue.length;) {  // walks the queue from oldest to newest; i only moves on when a request stays in the queue
          const q = queue[i], wj = byId(q.id), r = attempt(wj, q.kind, q.n);  // q: the waiting request; wj: its job; r: the result of trying it again now
          if (r.ok) { wj.wait = null; queue.splice(i, 1); woke.push({ id: q.id, kind: q.kind, r }); } else i++;  // a success clears the job's wait and leaves the queue; a failure stays and the loop moves to the next one
        }  // ends the retry loop
        frames.push({ id, kind, rel, woke, snap: snap() });  // records the finish frame with what was released, who woke up, and a snapshot
        return;  // moves on to the next script entry
      }  // ends the finish branch
      const r = attempt(j, kind, n);  // any other entry is a request, handled by its class's method
      if (!r.ok) { j.wait = { kind, cls: r.cls, n: kind === 'swap' ? j.swap : n }; queue.push({ id, kind, n }); st.refused++; }  // a refused request marks the job as waiting, joins the queue for later retries, and is counted
      frames.push({ id, kind, n, r, snap: snap() });  // records the request frame with its result and a snapshot
    });  // ends the script loop
    return { frames, totals: { tests: st.tests, outs: st.outs, ins: st.ins, refused: st.refused } };  // hands back every frame and the totals for the closing caption and the study notes
  }  // ends runWalk()
  const TOKJ = (id) => `<span class="tok ${JC['ABC'.indexOf(id)]}">${id}</span>`;  // TOKJ(id): the coloured round badge for job A, B or C, used inside captions
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;  // plural(n, one, many): writes a count with the right word, such as "1 drive" or "2 drives"
  const listAnd = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join(''));  // listAnd(a): joins a list as "x, y and z" for readable captions
  // walkCaption(f, totals, last): the narration for one frame, written from the frame's own facts
  function walkCaption(f, totals, last) {  // walkCaption(f, totals, last): builds the step 4 caption for frame f; last is true on the final frame
    if (f.start) return `<b>Start.</b> Three jobs will collect resources class by class: swap space, then tape drives, then memory, then channels. The system owns ${WALK.swap} GB of swap space, ${WALK.tape} tape drives, ${WALK.mem} GB of memory and channels CH1 and CH2. Tape claims were declared in advance: ${WALK.jobs.map((j) => j.id + ' ' + j.claim).join(', ')}.`;  // caption for the starting frame: the plan, what the system owns, and each job's declared tape claim
    const J = TOKJ(f.id), job = WALK.jobs.find((x) => x.id === f.id), r = f.r;  // J: the job's badge; job: its fixed details from WALK; r: the result of its request, if any
    if (f.kind === 'end') {  // captions for a job finishing
      const rel = f.rel, parts = [`${rel.swap} GB of swap space`];  // starts the list of what was given back with the swap space
      if (rel.tape) parts.push(plural(rel.tape, 'tape drive', 'tape drives'));  // adds the tape drives, only if the job held any
      parts.push(`${rel.mem} GB of memory`);  // adds the memory
      if (rel.ch.length) parts.push(rel.ch.join(' and '));  // adds the channels, if any
      let out = `<b>${J} finishes</b> and gives back ${listAnd(parts)}. `;  // first sentence: which job finished and everything it returned
      out += f.woke.length ? 'The waiting requests are retried, oldest first. ' + f.woke.map((w) => {  // then, if any waiting requests succeeded on the retry, one sentence for each of them
        const W = TOKJ(w.id);  // W: the badge of the job that woke up
        if (w.kind === 'swap') return `${W} now gets its full ${w.r.n} GB of swap space in one piece (${w.r.free} GB remain).`;  // sentence for a swap request that now fits in one piece
        if (w.kind === 'tape') return `${W}’s request for ${plural(w.r.n, 'drive', 'drives')} passes the safety test this time (safe order: ${w.r.test.seq.map((x) => x.id).join(' → ')}).`;  // sentence for a tape request that now passes the safety test, with the safe order it found
        return `${W} is swapped back in: its ${w.r.n} GB fit, and it carries on exactly where it stopped.`;  // sentence for a swapped-out job coming back into memory and carrying on where it stopped
      }).join(' ') : 'Nobody was waiting.';  // joins those sentences, or says nobody was waiting
      if (last) out += ` <b>All three jobs are done.</b> The run took ${plural(totals.tests, 'safety test', 'safety tests')} (all in class 2), ${plural(totals.outs, 'swap-out', 'swap-outs')} and ${plural(totals.ins, 'swap-in', 'swap-ins')}, and at no moment was a deadlock possible.`;  // on the last frame, adds the summary: how many tests, swap-outs and swap-ins, and that deadlock was never possible
      return out;  // returns the finished caption
    }  // ends the finishing captions
    if (r.cls === 1) return r.ok  // class 1 captions: one for a granted request, one for a refused one
      ? `<b>Class 1, all at once.</b> ${J} asks for its whole ${r.n} GB of swap space in one request. It fits, so ${J} gets all of it; ${r.free} GB remain free.`  // granted: the job gets all its swap space in one go and the rest stays free
      : `<b>Class 1, all at once.</b> ${J} needs ${r.n} GB of swap space, but only ${r.free} GB are free. The request is refused <b>as a whole</b>: ${J} does not take the ${r.free} GB that are there, and waits holding nothing. No hold and wait, so no deadlock can start in this class.`;  // refused: the job takes none of the free space and waits holding nothing, so hold and wait cannot occur
    if (r.cls === 2) {  // class 2 captions
      const head = `<b>Class 2, avoidance.</b> ${J} asks for ${plural(r.n, 'tape drive', 'tape drives')} (its claim is ${job.claim}).`;  // head: the opening sentence shared by every class 2 caption, naming the request and the job's claim
      if (r.busy) return `${head} Only ${r.free} ${r.free === 1 ? 'is' : 'are'} free, so ${J} must wait.`;  // not enough drives free: the job just waits, and no test is run
      if (r.ok) return `${head} Grant on paper: ${r.left} left. Safety test: ${r.test.seq.map((x) => `${x.id} needs ${x.need} more (${x.before} free), finishes, ${x.after} free`).join('; ')}. Everyone can finish, so the state is <b>safe</b> and the grant stands.`;  // passed: shows each line of the safety test, job by job, and says the grant stands
      const last2 = r.test.seq.length ? r.test.seq[r.test.seq.length - 1].after : r.left;  // last2: drives that would be free after the jobs that could finish did, or just those left after the paper grant
      return `${head} A drive is free, but grant it on paper and ${r.test.seq.length ? 'even after ' + r.test.seq.map((x) => x.id).join(', ') + ' finished, ' : ''}${last2 ? 'only ' + plural(last2, 'drive', 'drives') : 'no drive'} would be free while ${r.test.stuck.map((x) => x.id + ' still needs ' + x.need).join(' and ')}. Nobody could be sure to finish: the state would be <b>unsafe</b>, so the banker says no and ${J} waits, holding only its swap space.`;  // refused: explains why the paper grant is unsafe (who still needs what, with too few drives), so the job waits
    }  // ends the class 2 captions
    if (r.cls === 3) {  // class 3 captions
      if (r.victim) {  // the case where another job was swapped out to make room
        const V = TOKJ(r.victim);  // V: the badge of the job that was swapped out
        return `<b>Class 3, preemption.</b> ${J} needs ${r.n} GB of memory but only ${r.had} GB are free. Instead of making ${J} wait, the system takes memory from ${V}, the lowest-priority job in memory: ${V}’s ${r.vmem} GB image is copied into the ${r.vswap} GB of swap space ${V} reserved in class 1, so it is sure to fit. ${V} is suspended, not killed. ${J} gets ${r.n} GB; ${r.free} GB remain.`;  // swap-out caption: the image goes into the swap space that job reserved in class 1, so it is suspended, not killed
      }  // ends the swap-out case
      return r.ok ? `<b>Class 3, preemption.</b> ${J} asks for ${r.n} GB of memory. ${r.had} GB are free, so nothing has to be taken back: ${J} is loaded at once and ${r.free} GB remain.`  // enough memory was already free: the job is loaded without taking anything back
        : `<b>Class 3, preemption.</b> ${J} needs ${r.n} GB but only ${r.had} GB are free and no lower-priority job can be swapped out, so ${J} waits.`;  // not enough memory and no lower-priority job to swap out: the job has to wait
    }  // ends the class 3 captions
    if (!r.ok) return `<b>Class 4, number order.</b> ${J} asks for ${r.order.join(', then ')}, but ${r.busy} is busy, so ${J} waits for it. It never asks for a lower-numbered channel while waiting, so no loop can form.`;  // class 4, refused: the job waits for a busy channel and never asks for a lower one meanwhile, so no loop forms
    const many = r.order.length > 1;  // many: true when the job uses both channels
    return `<b>Class 4, number order.</b> ` + (r.reordered  // class 4, granted: the caption has two forms depending on whether the rule changed the order
      ? `${J}’s program uses ${r.use.join(' first and ')} second, but the rule says lower number first, so ${J} asks for ${r.order.join(', then ')}.`  // reordered form: the program wanted CH2 first, but the rule makes the job ask for CH1 first
      : `${J} asks for ${r.order.join(', then ')}${many ? ', already in rising order' : ''}.`)  // plain form: the job already asked in rising order, or needs only one channel
      + ` ${many ? 'Both are' : 'It is'} free, so ${J} now holds everything it needs and runs.`;  // ends with the channels being free, so the job holds everything it needs and runs
  }  // ends walkCaption()

  /* ---- One rule for everything vs. the integrated design (step 5) ----
     The same three jobs run minute by minute under four designs. Each job is a list of phases; a phase lasts
     some minutes and may need a tape drive and some channels. simCompare(policy) returns every minute's job
     states and channel owners plus the totals, so the chart, the table and the narration come from one run.
       'int'     integrated: swap space all at once, the tape through the banker before memory, then memory,
                 and channels in number order, taken per phase and given back after it;
       'all'     all at once for everything: a job starts only when its whole set is free and keeps it to the end;
       'avoid'   the banker for everything: every single request must pass a safety test over all five types;
       'detect'  detection for everything: grant whatever is free in the program's own order, look for a
                 deadlock every few minutes, and abort the cheapest deadlocked job until none is left. */
  const CT = ['swap', 'tape', 'mem', 'CH1', 'CH2'];  // CT: the five resource types tracked in step 5, with each channel counted on its own
  const CMPW = {  // CMPW: the fixed workload for the step 5 comparison, the same for all four designs
    total: { swap: 12, tape: 2, mem: 8, CH1: 1, CH2: 1 },  // what the system owns: 12 GB of swap space, 2 tape drives, 8 GB of memory, and one CH1 and one CH2
    every: 3,   // the detection check runs at the end of every 3rd minute
    jobs: [  // the three jobs; each phase gives its length in minutes (dur), any tape drive it needs, and the channels it uses
      { id: 1, swap: 4, mem: 3, phases: [{ dur: 3, tape: 1, ch: ['CH1'] }, { dur: 4 }, { dur: 2, ch: ['CH1', 'CH2'] }] },  // job 1: 3 minutes with a tape and CH1, 4 minutes of computing, then 2 minutes using CH1 and CH2
      { id: 2, swap: 3, mem: 3, phases: [{ dur: 3 }, { dur: 3, tape: 1, ch: ['CH2'] }, { dur: 1 }, { dur: 2, ch: ['CH2', 'CH1'] }] },  // job 2: computes 3 minutes, uses a tape and CH2 for 3, computes 1, then uses CH2 and CH1 (in the opposite order)
      { id: 3, swap: 3, mem: 2, phases: [{ dur: 1 }, { dur: 2, tape: 1, ch: ['CH1'] }, { dur: 4 }, { dur: 1, ch: ['CH2'] }] },  // job 3: computes 1 minute, uses a tape and CH1 for 2, computes 4, then uses CH2 for 1
    ],  // closes the job list
  };  // closes CMPW
  const POLICY = [  // POLICY: the four designs compared in step 5: a key, a short label for buttons, and a longer name for headings
    { k: 'int', label: 'Integrated', long: 'Integrated: one method per class' },  // design "int": the integrated strategy, one method per class
    { k: 'all', label: 'All at once', long: 'All at once, for everything' },  // design "all": every resource requested at once, up front
    { k: 'avoid', label: 'Banker', long: 'The banker, for everything' },  // design "avoid": the banker's safety test on every request of every type
    { k: 'detect', label: 'Detect', long: 'Detect and recover, for everything' },  // design "detect": grant freely, then find and break deadlocks
  ];  // closes the POLICY list
  function simCompare(policy) {  // simCompare(policy): runs the step 5 workload minute by minute under one design and records what happened
    const J = CMPW.jobs.map((j) => {  // J: a working copy of each job, built fresh for every run so runs cannot affect each other
      const claim = { swap: j.swap, tape: Math.max(0, ...j.phases.map((p) => p.tape || 0)), mem: j.mem, CH1: 0, CH2: 0 };  // claim: the most of each type the job can ever need: its swap and memory, and the most tape drives any phase uses
      j.phases.forEach((p) => (p.ch || []).forEach((c) => { claim[c] = 1; }));  // marks every channel that any phase uses as claimed once
      return { ...j, claim, hold: { swap: 0, tape: 0, mem: 0, CH1: 0, CH2: 0 }, k: 0, left: j.phases[0].dur, inMem: false, done: null, since: null, prog: 0, from: 0 };  // the working job: claim, holdings (none yet), current phase k, minutes left in it, and finish and waiting times
    });  // ends the job copies
    const lastTape = (j) => j.phases.reduce((m, p, i) => (p.tape ? i : m), -1);  // lastTape(j): the index of the job's last phase that uses a tape drive (-1 if none); the drive is given back after it
    const free = { ...CMPW.total };  // free: what is free of each type right now; it starts as the full total
    const rows = [], chRows = [], events = [];  // rows: each minute's state of every job; chRows: who held each channel each minute; events: deadlocks found
    const tot = { tests: 0, lost: 0, chHeld: 0, chUsed: 0, tapeHeld: 0, tapeUsed: 0 };  // tot: run totals: safety tests, minutes of lost work, and minutes channels and tape drives were held versus used
    // next(j): the requests job j must still make before its current phase can run, in this policy's order
    function next(j) {  // next(j): builds the list of requests job j still has to make before its current phase can run
      const ph = j.phases[j.k], out = [];  // ph: the job's current phase; out: the list being built
      if (policy === 'all') return j.inMem ? out : [['all', 0]];  // all at once: a single combined request until the job is loaded, and nothing after that
      if (!j.hold.swap) out.push(['swap', j.swap]);  // swap space comes first, if the job does not hold it yet
      if (policy === 'int' && !j.inMem && j.hold.tape < j.claim.tape) out.push(['tape', j.claim.tape - j.hold.tape]);   // class 2 comes before class 3
      if (!j.inMem) out.push(['mem', j.mem]);  // memory next, if the job is not loaded yet
      if (policy !== 'int' && ph.tape && j.hold.tape < ph.tape) out.push(['tape', ph.tape - j.hold.tape]);  // the other designs ask for a tape drive only when the current phase needs one
      const chs = (ph.ch || []).slice();  // chs: the channels this phase uses, copied in the program's own order
      if (policy === 'int') chs.sort();   // class 4: number order
      chs.forEach((c) => { if (!j.hold[c]) out.push([c, 1]); });  // adds a request for each of those channels that the job does not hold already
      return out;  // an empty list means the phase can run now
    }  // ends next()
    const take = (j, t, n) => { free[t] -= n; j.hold[t] += n; };  // take(j, t, n): moves n units of type t from the free pool to job j
    const give = (j, list) => list.forEach((t) => { free[t] += j.hold[t]; j.hold[t] = 0; });  // give(j, list): returns everything job j holds of the listed types to the free pool
    // safe(types): the banker's safety test, over the given resource types only
    function safe(types) {  // safe(types): checks whether every unfinished job could still finish, for the listed types
      const work = { ...free }, rest = J.filter((j) => j.done == null);  // work: a copy of the free counts the test can change; rest: every job not finished yet
      for (let i = 0; (i = rest.findIndex((j) => types.every((t) => j.claim[t] - j.hold[t] <= work[t]))) >= 0;) {  // repeatedly finds a job whose remaining need fits in work for every listed type; the loop stops when none fits
        types.forEach((t) => { work[t] += rest[i].hold[t]; });  // that job could finish and hand back what it holds, so work grows by its holdings
        rest.splice(i, 1);  // removes it from the jobs still to be shown able to finish
      }  // ends the test loop
      return !rest.length;  // safe only if no job is left over
    }  // ends safe()
    // ask(j, [type, n]): one request under this policy; true if granted
    function ask(j, [t, n]) {  // ask(j, [t, n]): the request arrives as a pair and is unpacked into its type t and count n
      if (t === 'all') {  // the combined all-at-once request
        if (!CT.every((x) => j.claim[x] <= free[x])) return false;  // refused unless every type the job claims is free in full, all at the same moment
        CT.forEach((x) => take(j, x, j.claim[x])); j.inMem = true; return true;  // otherwise takes the whole claim of every type; the job is now loaded
      }  // ends the all-at-once branch
      if (n > free[t]) return false;  // not enough free of this type: refused, and the job waits
      take(j, t, n);  // grants it, for now
      if (policy === 'avoid' || (policy === 'int' && t === 'tape')) {   // grant on paper, keep it only if safe
        tot.tests++;  // counts one more safety test for the totals
        if (!safe(policy === 'int' ? ['tape'] : CT)) { free[t] += n; j.hold[t] -= n; return false; }  // integrated tests only tape drives, the banker-for-all tests all five types; if unsafe, the grant is undone
      }  // ends the safety test branch
      if (t === 'mem') j.inMem = true;  // a memory grant means the job is now loaded
      return true;  // the request is granted
    }  // ends ask()
    // findDead(row, gone): the detection algorithm; the waiting jobs that can never be satisfied
    function findDead(row, gone) {  // findDead(row, gone): row holds this minute's job states; gone holds jobs already aborted in this check
      const left = J.filter((j, i) => row[i] === 'wait' && !gone.has(j.id));  // left: the waiting jobs not yet aborted, the suspects that may be deadlocked
      const work = { ...free };  // work: a copy of the free counts
      J.forEach((j) => { if (j.done == null && !left.includes(j)) CT.forEach((x) => { work[x] += j.hold[x]; }); });  // assumes every running job will finish, so what it holds is added to work
      for (let i = 0; (i = left.findIndex((j) => { const [x, n] = next(j)[0]; return n <= work[x]; })) >= 0;) {  // finds a suspect whose next request would fit in work; that job can still go on, so it is not deadlocked
        CT.forEach((x) => { work[x] += left[i].hold[x]; });  // that job could go on and finish, handing back everything it holds, so work grows by its holdings
        left.splice(i, 1);  // removes it from the suspects
      }  // ends the search loop
      return left;  // whoever is left can never be satisfied: these jobs are deadlocked
    }  // ends findDead()
    for (let t = 0; t < 60 && J.some((j) => j.done == null); t++) {  // the clock: t counts minutes and the run stops when every job is done, or after 60 minutes as a safety limit
      // requests come in rounds: each unsatisfied job makes its next request, the longest waiter first
      const ready = new Set();  // ready: the jobs that hold everything their current phase needs this minute
      for (let moved = true; moved;) {  // keeps running rounds of requests as long as the last round granted something
        moved = false;  // assumes nothing will be granted this round until a request succeeds
        J.filter((j) => j.done == null && !ready.has(j.id)).sort((a, b) => (a.since ?? t) - (b.since ?? t) || a.id - b.id).forEach((j) => {  // every unfinished job not yet ready, longest waiter first (?? treats a job that is not waiting as starting now), ties by number
          const reqs = next(j);  // reqs: the requests this job still has to make
          if (!reqs.length) { ready.add(j.id); return; }  // none left: the job is ready to run this minute
          if (ask(j, reqs[0])) { moved = true; if (!next(j).length) ready.add(j.id); }  // makes only its first request; a grant means another round, and if that was its last request the job is ready
        });  // ends one round
      }  // ends the rounds for this minute
      const row = J.map((j) => (j.done != null ? 'done' : ready.has(j.id) ? 'run' : 'wait'));  // row: this minute's state of each job: done, run (has everything it needs) or wait
      J.forEach((j, i) => { if (row[i] === 'run') j.since = null; else if (row[i] === 'wait' && j.since == null) j.since = t; });  // a running job stops waiting; a job that just began to wait remembers this minute (it decides who asks first)
      const cr = {};  // cr: this minute's record for the two channels
      ['CH1', 'CH2'].forEach((c) => {  // looks at each channel in turn
        const o = J.find((j) => j.hold[c]);  // o: the job holding this channel, if any
        const used = !!o && row[J.indexOf(o)] === 'run' && (o.phases[o.k].ch || []).includes(c);  // used: the holder is running and its current phase really uses this channel; otherwise the channel is held but idle
        cr[c] = { owner: o ? o.id : null, used };  // records the owner (or nobody) and whether the channel did real work this minute
        if (o) tot.chHeld++;  // counts one channel-minute held
        if (used) tot.chUsed++;  // counts one channel-minute actually used
      });  // ends the channel loop
      J.forEach((j, i) => { tot.tapeHeld += j.hold.tape; if (row[i] === 'run') tot.tapeUsed += j.phases[j.k].tape || 0; });  // adds every tape drive held this minute to the held total, and the drives a running phase uses to the used total
      rows.push(row); chRows.push(cr);  // stores this minute's job states and channel record for the chart and the table
      // each running job does one minute; a finished phase gives back its channels (and the tape after its last tape phase)
      J.forEach((j, i) => {  // advances the clock by one minute for each job
        if (row[i] !== 'run') return;  // only running jobs make progress
        j.left--; j.prog++;  // one minute less left in the phase, one more minute of work done since the job last started
        if (j.left > 0) return;  // the phase is not over yet
        j.k++;  // moves the job on to its next phase
        if (j.k >= j.phases.length) { j.done = t + 1; give(j, CT); return; }  // past the last phase: the job finishes at the end of this minute and gives back everything it holds
        if (policy !== 'all') give(j, ['CH1', 'CH2'].concat(j.k > lastTape(j) ? ['tape'] : []));  // except under all at once, channels go back after every phase, and the tape drive after its last tape phase
        j.left = j.phases[j.k].dur;  // starts the countdown for the new phase
      });  // ends the minute of work
      if (policy === 'detect' && (t + 1) % CMPW.every === 0) {  // detection only: at the end of every third minute, the system checks for a deadlock
        const gone = new Set();  // gone: the jobs aborted during this check
        let dead = findDead(row, gone);  // dead: the jobs deadlocked right now
        if (!dead.length) continue;  // no deadlock: on to the next minute (continue skips the rest of this pass of the loop)
        const ev = { at: t + 1, formed: Math.max(...dead.map((j) => j.since)), victims: [],  // ev: a record of this deadlock: when it was found, when it formed (when its last member began to wait) and the victims
          dead: dead.map((j) => ({ id: j.id, holds: ['CH1', 'CH2'].filter((c) => j.hold[c]), wants: next(j)[0][0] })) };  // for each deadlocked job, the channels it holds and the type it wants next, for the step 5 caption
        dead.forEach((j) => { for (let u = ev.formed; u <= t; u++) if (rows[u][J.indexOf(j)] === 'wait') rows[u][J.indexOf(j)] = 'dead'; });  // marks those jobs' waiting minutes since the deadlock formed as "dead", so the chart shows how long they sat frozen
        while (dead.length) {   // abort the deadlocked job that has done the least work, then look again
          const v = dead.slice().sort((a, b) => a.prog - b.prog || b.id - a.id)[0];  // v: the deadlocked job that has done the least work, the cheapest to abort (a tie goes to the higher job number)
          ev.victims.push({ id: v.id, lost: v.prog });  // records it as a victim, with the minutes of work it loses
          tot.lost += v.prog;  // adds those minutes to the lost-work total
          for (let u = v.from; u <= t; u++) if (rows[u][J.indexOf(v)] === 'run') rows[u][J.indexOf(v)] = 'lost';  // marks the job's running minutes since its latest start as "lost" in the chart, since that work must be redone
          give(v, CT);  // gives back everything the aborted job held
          Object.assign(v, { k: 0, left: v.phases[0].dur, inMem: false, prog: 0, since: null, from: t + 1 });  // restarts it from scratch: first phase, not loaded, no progress, with a new start minute
          gone.add(v.id);  // remembers that this job has been aborted in this check
          dead = findDead(row, gone);  // looks again: the freed resources may already have ended the deadlock
        }  // ends the abort loop
        events.push(ev);  // stores the deadlock record for the chart and the caption
      }  // ends the detection check
    }  // ends the minute loop
    const fin = J.map((j) => j.done);  // fin: the minute at which each job finished
    return { rows, chRows, events, fin, T: rows.length, done: Math.max(...fin), avg: fin.reduce((a, b) => a + b, 0) / fin.length, ...tot };  // returns the chart rows, channel records, deadlocks, finish times, run length, last and average finish, and the totals
  }  // ends simCompare()

  // NOTE: the numbers quoted in the study notes, taken from the same runs the steps show
  const NOTE = (() => {  // NOTE: computed once when the page loads, by a function that is called right away
    const { frames, totals } = runWalk();  // replays the step 4 walk-through to read its numbers
    const f = (id, kind, k = 0) => frames.filter((x) => x.id === id && x.kind === kind)[k].r;  // f(id, kind, k): the result of job id's k-th request of that kind in the walk-through (the first by default)
    const C = Object.fromEntries(POLICY.map((p) => [p.k, simCompare(p.k)]));  // C: the step 5 run for each of the four designs, filed under the design's key
    return { totals, cSwap: f('C', 'swap'), aTape: f('A', 'tape'), bTape: f('B', 'tape'), bMem: f('B', 'mem'), C };  // keeps C's refused swap request, A's and B's first tape requests, B's memory request and the four runs
  })();  // ends the function and calls it at once, so NOTE holds its result

  Guide.section({  // registers this section with the guide, which files it under its id and builds its pages from these settings
    id: '6.5',  // id: the section number, used for links, the contents list and saved progress
    title: 'An Integrated Deadlock Strategy',  // title: the full section name shown at the top of its pages
    short: 'Integrated strategy',  // short: a shorter title for menus and other tight spaces
    summary: 'Sort resources into ordered classes and give each class the deadlock method that suits it best.',  // summary: the one-line description shown beside the title in the chapter's list of sections
    objectives: [  // objectives: the learning goals listed for this section
      'Explain why no single deadlock method suits every kind of resource, and what an integrated strategy does instead.',  // goal 1: explain why one method cannot suit every resource and what the integrated design does instead
      'Name the four resource classes in the order a process acquires them, with examples of each.',  // goal 2: name the four classes in their order, with examples
      'Choose the best method for each class and justify it from how its resources behave: known in advance, cheap to take back, or held only briefly.',  // goal 3: pick and justify the best method for each class from how its resources behave
      'Explain why numbering the classes makes a deadlock that crosses from one class to another impossible.',  // goal 4: explain why ordering the classes rules out a deadlock that crosses classes
      'Compare the integrated design with one-method-for-everything designs on waiting time, idle resources, checking overhead and deadlock risk.',  // goal 5: compare the integrated design with single-method designs on waiting, waste, overhead and risk
    ],  // closes the objectives list
    terms: [  // terms: this section's glossary entries, each a [term, definition] pair that joins the guide's glossary
      ['Integrated deadlock strategy', 'A design that sorts resources into classes, puts the classes in a fixed order, and inside each class uses whichever deadlock method suits that class best.'],  // glossary entry: defines the integrated deadlock strategy
      ['Resource class', 'A group of resources that behave alike (how long they are held, whether needs are known ahead, whether they can be taken back cheaply) and are therefore handled by one deadlock method.'],  // glossary entry: defines a resource class by the ways its members behave alike
      ['Class ordering', 'The rule that numbers the resource classes: a process that holds resources from one class may afterwards ask only for resources from that class or a higher-numbered one, never a lower-numbered one.'],  // glossary entry: defines class ordering, the rule against asking for a lower class
      ['Uniform strategy', 'Using one deadlock method, such as all-at-once requests or the banker’s algorithm, for every resource in the system, whatever its kind.'],  // glossary entry: defines a uniform strategy, one method for every resource
      ['Swappable space', 'Blocks of secondary storage (usually disk) set aside to hold a process’s memory image while the process is swapped out of main memory.'],  // glossary entry: defines swappable space on disk
      ['Process resources', 'Devices and files that are assigned to one process at a time for long stretches, such as tape drives and files opened for exclusive use.'],  // glossary entry: defines process resources, the devices and files held for long stretches
      ['Assignable device', 'A device that the operating system hands to one process for as long as that process needs it, instead of sharing it request by request. A tape drive is the classic example.'],  // glossary entry: defines an assignable device, handed to one process for as long as it needs it
      ['Tape drive', 'A device that reads and writes a reel or cartridge of magnetic tape in order, from start to end. A job mounts its tape and keeps the drive for a long time. Tapes are still used for backups and archives.'],  // glossary entry: defines a tape drive and why a job keeps one for a long time
      ['Internal resources', 'Resources the system itself uses for a moment at a time while doing work for processes, such as I/O channels. Each use is short, but uses are very frequent.'],  // glossary entry: defines internal resources, used briefly but very often by the system itself
      ['Preemption by swapping', 'Taking main memory back from a process by copying its memory image to its swappable space and suspending it. Later it is swapped back in and continues exactly where it stopped.'],  // glossary entry: defines preemption by swapping and that the process resumes where it stopped
      ['Held-but-idle time', 'Time during which a resource is assigned to a process that is not actually using it, so nobody else can use it either. It is the main waste of asking for everything at once.'],  // glossary entry: defines held-but-idle time, the waste of asking for everything at once
    ],  // closes the terms list
    css: ` /* css: this section's own style rules; each starts with .sec-6-5 so it can only affect this section */
      .sec-6-5 .say { border-radius: 12px; padding: 8px 12px; border: 1px solid var(--line); border-left: 5px solid var(--accent); background: var(--panel-2); font-size: 15px; line-height: 1.45; } /* feedback box: rounded corners, padding, and a thick coloured left edge on a soft background */
      .sec-6-5 .say.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* green feedback box for a best or correct answer */
      .sec-6-5 .say.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* red feedback box for a poor choice */
      .sec-6-5 .say.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* amber feedback box for a choice that works but is not the best */
      .sec-6-5 .say.info { border-left-color: var(--info); background: var(--info-bg); } /* blue feedback box for neutral instructions and hints */
      .sec-6-5 .cn { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--chc); color: var(--accent-ink); font-weight: 800; font-size: 14px; flex: none; } /* .cn: the round badge holding a class number, filled with the chapter colour so the four classes stand out */
      .sec-6-5 .tok { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 24px; padding: 0 7px; border-radius: 999px; border: 2px solid; font-weight: 800; font-size: 13.5px; line-height: 1; vertical-align: 1px; } /* .tok: the pill-shaped job badge (A, B, C or P1-P3) used in tables and captions */
      .sec-6-5 .tok.proc { color: var(--proc); background: var(--proc-bg); border-color: var(--proc); } /* teal job badge, the first job's colour */
      .sec-6-5 .tok.accent { color: var(--accent); background: var(--accent-bg); border-color: var(--accent); } /* indigo job badge, the second job's colour */
      .sec-6-5 .tok.thread { color: var(--thread); background: var(--thread-bg); border-color: var(--thread); } /* pink job badge, the third job's colour */
      .sec-6-5 .lband, .sec-6-5 .layer { display: flex; align-items: center; gap: 10px; text-align: left; font: inherit; color: var(--ink); cursor: pointer; border-radius: 12px; border: 2px solid var(--line); background: var(--panel); padding: 6px 12px; } /* step 1 buttons: the order banner and the class rows share a rounded, clickable row layout with a border */
      .sec-6-5 .lband { border-style: dashed; border-color: var(--chc); background: var(--panel-2); padding: 5px 12px; } /* the order banner gets a dashed border in the chapter colour so it reads as a rule, not a class */
      .sec-6-5 .lband .small { color: var(--ink-2); } /* softer text colour for the banner's explanation */
      .sec-6-5 .layer { padding: 4px 12px; } /* class rows are a little tighter than the banner */
      .sec-6-5 .layer .lname { display: flex; align-items: baseline; flex-wrap: wrap; column-gap: 10px; flex: 1; min-width: 0; line-height: 1.35; } /* a class row's name and examples sit side by side and wrap to a new line when space runs out */
      .sec-6-5 .lband:hover, .sec-6-5 .layer:hover { border-color: var(--accent); } /* hovering over the banner or a class row outlines it, showing it can be clicked */
      .sec-6-5 .lband.on, .sec-6-5 .layer.on { border-color: var(--accent); background: var(--accent-bg); } /* the chosen banner or class row is outlined and tinted */
      .sec-6-5 .ldetail { border: 1px dashed var(--line-2); border-radius: 12px; padding: 8px 12px; background: var(--panel); display: flex; flex-direction: column; gap: 5px; font-size: 15px; line-height: 1.4; } /* .ldetail: the dashed box under the class list where the rule or the chosen class's facts appear */
      .sec-6-5 .facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; } /* .facts: a two-column grid, each question in the left column and its answer on the right */
      .sec-6-5 .mlegend { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; line-height: 1.35; } /* .mlegend: the same two-column grid for the method legend in step 2 (name, then meaning) */
      .sec-6-5 .mcard { border: 2px solid var(--line); border-radius: 12px; background: var(--panel); padding: 7px 12px; display: flex; flex-direction: column; gap: 5px; transition: border-color .15s, background .15s; } /* .mcard: one class card in the step 2 matching lab; its border and background fade smoothly when graded */
      .sec-6-5 .mcard.g-best { border-color: var(--ok); background: var(--ok-bg); } /* a best-fit choice turns the card green */
      .sec-6-5 .mcard.g-ok { border-color: var(--warn); background: var(--warn-bg); } /* a works-but-not-best choice turns the card amber */
      .sec-6-5 .mcard.g-poor { border-color: var(--bad); background: var(--bad-bg); } /* a poor choice turns the card red */
      .sec-6-5 .mcard.g-best .mverdict { color: var(--ok); } .sec-6-5 .mcard.g-ok .mverdict { color: var(--warn); } .sec-6-5 .mcard.g-poor .mverdict { color: var(--bad); } /* colours the verdict words on each card to match its grade */
      .sec-6-5 .mverdict { white-space: nowrap; } /* keeps the verdict words on one line */
      .sec-6-5 .ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; } /* .ell: text that does not fit is cut off with "..." instead of wrapping */
      .sec-6-5 .mfacts { display: flex; flex-wrap: wrap; column-gap: 16px; row-gap: 2px; font-size: 13.5px; } /* .mfacts: the short facts on a card, side by side, wrapping on small screens */
      .sec-6-5 .mbtns { display: flex; flex-wrap: wrap; gap: 6px; } /* .mbtns: the row of five method buttons on each card, wrapping when needed */
      .sec-6-5 .mbtn { flex: 1 1 auto; } /* each method button stretches so a row of buttons fills the card's width */
      .sec-6-5 .proof li { margin: 4px 0; } /* spaces out the numbered steps of the step 3 proof */
      .sec-6-5 .ringctl { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 12px; } /* .ringctl: the step 3 controls that set each process's class, spread across the row and wrapping on small screens */
      .sec-6-5 .wgrid { display: grid; grid-template-columns: minmax(0, 1.25fr) repeat(4, minmax(0, 1fr)); gap: 4px; } /* .wgrid: the step 4 table as a grid: a wider first column for labels, then one column per class */
      .sec-6-5 .wgrid.slim { grid-template-columns: 28px repeat(4, minmax(0, 1fr)); gap: 2px; } /* small-screen version of the table: a thin label column and tighter gaps */
      .sec-6-5 .wgrid.slim .wh, .sec-6-5 .wgrid.slim .wc { padding: 3px 3px; font-size: 13.5px; overflow-wrap: break-word; } /* small-screen cells: less padding, smaller text, and long words allowed to break */
      .sec-6-5 .wgrid.slim .jlab { justify-content: center; padding: 0; } /* small-screen job labels are centred with no padding */
      .sec-6-5 .wh, .sec-6-5 .wc { border-radius: 8px; border: 2px solid transparent; background: var(--panel-2); padding: 3px 8px; min-width: 0; transition: background .2s, border-color .2s; } /* .wh and .wc: header and body cells of the step 4 table, with a hidden border that can light up */
      .sec-6-5 .wh { display: flex; flex-direction: column; gap: 2px; } /* header cells stack the class number, name and method vertically */
      .sec-6-5 .wc { display: flex; align-items: center; gap: 6px; font-size: 15px; line-height: 1.25; min-height: 52px; } /* body cells line up their contents in a row, with a minimum height so rows do not jump between frames */
      .sec-6-5 .corner { background: transparent; justify-content: flex-end; align-items: center; display: flex; } /* .corner: the top-left and row-label cells, transparent and aligned right */
      .sec-6-5 .mchip { color: var(--chc); } /* .mchip: the method name under each class header, written in the chapter colour */
      .sec-6-5 .wh.cur, .sec-6-5 .wc.cur { border-color: var(--accent); } /* the column of the class acting in this frame is outlined */
      .sec-6-5 .wc.hit-ok { background: var(--ok-bg); border-color: var(--ok); } /* a cell whose request was granted in this frame is shown green */
      .sec-6-5 .wc.hit-bad { background: var(--bad-bg); border-color: var(--bad); } /* a cell whose request was refused in this frame is shown red */
      .sec-6-5 .wc.hit-warn { background: var(--warn-bg); border-color: var(--warn); } /* the cell of a job that was swapped out in this frame is shown amber */
      .sec-6-5 .wc.dim { opacity: .55; } /* a finished job's cells are faded */
      .sec-6-5 .wc.capc { flex-direction: column; align-items: stretch; justify-content: center; gap: 2px; } /* capacity cells stack their meter above the free count */
      .sec-6-5 .jlab { gap: 6px; } /* job label cells space out the badge, name and status */
      .sec-6-5 .cap { display: flex; gap: 2px; height: 20px; } /* .cap: the capacity meter, a strip of small boxes, one per unit of the resource */
      .sec-6-5 .cap i { flex: 1; border-radius: 3px; background: var(--panel); border: 1px solid var(--line-2); } /* an empty (free) box in a meter */
      .sec-6-5 .cap i.o-proc { background: var(--proc); border-color: var(--proc); } /* a box held by the first job, filled teal */
      .sec-6-5 .cap i.o-accent { background: var(--accent); border-color: var(--accent); } /* a box held by the second job, filled indigo */
      .sec-6-5 .cap i.o-thread { background: var(--thread); border-color: var(--thread); } /* a box held by the third job, filled pink */
      .sec-6-5 .chb { flex: 1; display: grid; place-items: center; border-radius: 4px; border: 1px solid var(--line-2); background: var(--panel); font: 700 12px/1 var(--mono); white-space: nowrap; overflow: hidden; } /* .chb: a channel box in the meter, showing its name and its holder in small fixed-width text */
      .sec-6-5 .chb.o-proc { background: var(--proc-bg); border-color: var(--proc); color: var(--proc); } /* a channel box held by the first job, tinted teal */
      .sec-6-5 .chb.o-accent { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); } /* a channel box held by the second job, tinted indigo */
      .sec-6-5 .chb.o-thread { background: var(--thread-bg); border-color: var(--thread); color: var(--thread); } /* a channel box held by the third job, tinted pink */
      .sec-6-5 .lg { display: inline-block; width: 14px; height: 12px; border-radius: 3px; border: 1px solid; } /* .lg: a small colour swatch in the step 5 legend */
      .sec-6-5 .ctbl th, .sec-6-5 .ctbl td { text-align: center; } /* step 5 comparison table: cells are centred */
      .sec-6-5 .ctbl tr > :first-child { text-align: left; } /* except the first column (the row names), which is left-aligned */
    `,  // end of this section's CSS text
    steps: [  // steps: the pages of this section, in the order the student moves through them
      /* ---------------- 1. Big picture: classes, an order between them, a method inside each ---------------- */
      {  // step 1 begins
        title: 'One rule cannot fit every resource',  // title shown above step 1
        kind: 'story',  // kind story: the step is labelled Big Picture
        render(el, ctx) {  // render(el, ctx): builds the step's content inside el when the step is shown; ctx carries the guide's helpers
          const { h } = ctx;  // takes the h element builder out of ctx, so the code can write h(...) for each element it creates
          let pick = null;   // null = the ordering banner is shown; 0-3 = the class whose details are shown
          const detail = h('div', { class: 'ldetail', 'aria-live': 'polite' });  // detail: the box where the rule or a class's facts appear; aria-live makes screen readers read each change
          const banner = h('button', { type: 'button', class: 'lband', onclick: () => show(null) },  // banner: the button stating the order rule between classes; clicking it brings the rule back into the box
            h('b', {}, 'Between the classes:'), h('span', { class: 'small' }, 'acquire 1 → 2 → 3 → 4, never back down'));  // the banner's text: a bold label and the order 1 to 4, never going back down
          const layers = CLS.map((c, k) => h('button', { type: 'button', class: 'layer', onclick: () => show(k) },  // layers: one button per class, built from CLS; clicking one shows that class's facts
            h('span', { class: 'cn' }, String(c.n)),  // the round badge with the class number
            h('span', { class: 'lname' }, h('b', {}, c.name), h('span', { class: 'small muted' }, c.eg)),  // the class name in bold with its examples beside it
            h('span', { class: 'chip' }, 'method ?')));  // a "method ?" tag: which method each class gets is left for the next step to discover
          function show(k) {  // show(k): highlights the chosen button and fills the detail box; k is null for the rule, or 0-3 for a class
            pick = k;  // remembers the current choice
            banner.classList.toggle('on', k === null);  // highlights the banner only when the rule is chosen
            banner.setAttribute('aria-pressed', String(k === null));  // aria-pressed tells screen readers whether the banner is the chosen button
            layers.forEach((b, i) => { b.classList.toggle('on', i === k); b.setAttribute('aria-pressed', String(i === k)); });  // highlights the chosen class button and marks it pressed; every other class button is cleared
            if (k === null) {  // the rule between classes was chosen
              detail.innerHTML = '<div class="xs b muted">THE RULE BETWEEN CLASSES</div>'  // small uppercase heading for the rule
                + '<div>A process gets its resources class by class, in the order 1, 2, 3, 4. It may skip a class it does not need, but it never asks for a lower class while it holds a higher one. Requests inside one class follow that class’s own method.</div>'  // the rule: get resources class by class in rising order, skip a class if needed, never ask for a lower one
                + '<div class="small muted">Click a class to see how its resources behave.</div>';  // a hint inviting the student to click a class
              return;  // nothing more to show for the rule
            }  // ends the rule case
            const c = CLS[k];  // c: the chosen class
            detail.innerHTML = `<div class="xs b muted">CLASS ${c.n}: ${c.name.toUpperCase()}</div><div>${c.what}</div>`  // heading with the class number and name in capitals, then a sentence on what the class holds
              + `<div class="facts small"><span class="b">Known ahead?</span><span>${c.facts.known}</span><span class="b">Cheap to take back?</span><span>${c.facts.back}</span><span class="b">Held for</span><span>${c.facts.held}</span></div>`  // the three facts as question and answer pairs: known ahead, cheap to take back, how long held
              + `<div class="small muted">In the workshop: ${c.shop}</div>`;  // the workshop picture for this class
          }  // ends show()
          show(null);  // the step opens with the rule between classes shown
          el.append(h('div', { class: 'split fill' },  // lays the step out in two columns that fill the step's height (one column on a small screen)
            h('div', { class: 'stack' },  // left column: the introduction, stacked
              h('p', { class: 'lead m0', html: 'You have met three ways to handle <span class="t">deadlock</span>. Each one works, and each one has a price.' }),  // opening sentence: the three deadlock approaches already met each work, but each has a cost
              h('table', { class: 'tbl compact small', html: '<tr><th>Approach</th><th>What it does</th><th>Its price</th></tr>'  // a small table comparing the three approaches: header row
                + '<tr><td><b>Prevention</b></td><td>rules out a condition by design</td><td>idle resources, redone work</td></tr>'  // table row: prevention and its cost, idle resources and redone work
                + '<tr><td><b>Avoidance</b></td><td>checks each request for safety</td><td>needs declared, a test per request</td></tr>'  // table row: avoidance and its cost, declared needs and a test per request
                + '<tr><td><b>Detection</b></td><td>lets it happen, then breaks it</td><td>frozen processes, lost work</td></tr>' }),  // table row: detection and its cost, frozen processes and lost work; closes the table
              h('p', { class: 'm0', html: 'Real systems need not pick one. An <span class="t">integrated deadlock strategy</span> sorts resources into a few <span class="t" data-t="resource class">resource classes</span>, puts the classes in a fixed order, and inside each class uses the method that suits it.' }),  // paragraph introducing the integrated strategy; dotted terms show their definitions when touched
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A woodworking shop has no single rule for every tool. Shelf space is reserved in full before a project starts. The big saw is booked from a schedule filed in advance. A bench can be cleared by moving a project onto its shelf. Clamps are grabbed small before big. And everyone collects things in one order: shelf, saw, bench, clamps.' }),  // analogy box: a woodworking shop with a different rule for each kind of tool and one order for collecting them
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Each class pays only the price that suits it, not the price of the worst fit.' })),  // "why it matters" box: each class pays only the price that suits it; closes the left column
            h('div', { class: 'card stack gap-s' },  // right column: a card holding the clickable class list
              h('h3', { class: 'm0' }, 'Four classes, acquired top to bottom'),  // heading for the class list
              banner, ...layers, detail,  // the order banner, the four class buttons, and the detail box, in that order
              h('div', { class: 'grow' }),  // an empty spacer that grows to push the next row to the bottom of the card
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'COMING UP:'),  // a "coming up" row at the bottom of the card previewing the rest of the section
                ...['methods', 'ordering', 'three jobs', 'one rule vs. four'].map((t) => h('span', { class: 'chip accent' }, t))))));  // the four preview tags: methods, ordering, three jobs, one rule versus four; closes the card and the layout
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Lab: match each class to the method that suits it ---------------- */
      {  // step 2 begins
        title: 'Give each class the method that suits it',  // title shown above step 2
        kind: 'lab',  // kind lab: the step is labelled Hands-on Lab
        core: true,  // core: this step is part of the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): builds the matching lab when the step is shown
          const { h } = ctx;  // takes the h element builder out of ctx
          const choice = [null, null, null, null];   // the method key chosen for each class, or null
          const fb = say(ctx);  // fb: the feedback box that explains each choice
          const score = h('span', { class: 'chip' });  // score: a tag showing how many classes have their best method so far
          const START = 'Pick a method for each class. Use its three facts: is the need known ahead, can the resource be taken back cheaply, and how long is it held?';  // START: the opening instruction, which tells the student to judge each class by its three facts
          const cards = CLS.map((c, k) => {  // cards: one card per class, built from CLS
            const btns = METHODS.map((m) => h('button', { type: 'button', class: 'btn sm mbtn', 'aria-pressed': 'false', onclick: () => choose(k, m.k) }, m.label));  // btns: the five method buttons for this card; a click calls choose() with this class and that method
            const card = h('div', { class: 'mcard' },  // card: the class card, laid out from top to bottom
              h('div', { class: 'row gap-s nw' }, h('span', { class: 'cn' }, String(c.n)), h('b', { html: `<span class="t">${c.name}</span>` }), ctx.narrow ? null : h('span', { class: 'small muted ell' }, c.eg), h('span', { class: 'grow' }), h('span', { class: 'mverdict xs b' })),  // top row: class number, class name (a dotted term), examples unless the screen is small, then the verdict at the right
              ctx.narrow ? h('div', { class: 'small muted' }, 'e.g. ' + c.eg) : null,   // on a small screen the examples get their own line instead of being cut off
              h('div', { class: 'mfacts' }, ...['Known ahead', 'Cheap to take back', 'Held'].map((lab, i) => h('span', {}, h('span', { class: 'muted' }, lab + ': '), h('b', {}, c.brief[i])))),  // the three short facts, each a grey label followed by its answer in bold
              h('div', { class: 'mbtns' }, ...btns));  // the row of method buttons; closes the card
            card.btns = btns;  // keeps the card's buttons on the card so paint() can light up the chosen one
            return card;  // hands the card to the cards list
          });  // ends the cards
          function choose(k, m) {  // choose(k, m): runs when a method button is clicked; k is the class, m the method key
            choice[k] = m;  // remembers the method picked for this class
            const [g, text] = FIT[k][m];  // looks up the grade and explanation for this pairing in FIT
            const c = CLS[k], meth = METHODS.find((x) => x.k === m);  // c: the class; meth: the full method entry, for its label
            fb.put(GRADE[g][0], `<b>Class ${c.n}, ${c.name.toLowerCase()}: ${meth.label.toLowerCase()}. ${GRADE[g][1]}.</b> ${text}`);  // shows the verdict and explanation in the feedback box, coloured by the grade
            paint();  // repaints the cards and the score
            if (choice.every((x, i) => x && FIT[i][x][0] === 'best'))  // if every class now has its best method
              fb.put('ok', '<b>All four best fits.</b> The pattern: a need known in advance invites <b>all at once</b> or <b>avoidance</b>; a resource that is cheap to save and restore invites <b>preemption</b>; something grabbed briefly and very often invites a fixed <b>number order</b>, which costs nothing at run time.');  // the feedback switches to a summary of the pattern: which behaviour invites which method
          }  // ends choose()
          function paint() {  // paint(): colours each card by its current grade and updates the score
            let best = 0;  // best: counts the classes whose current choice is the best fit
            cards.forEach((card, k) => {  // goes through the cards one by one
              const g = choice[k] ? FIT[k][choice[k]][0] : null;  // g: the grade of this card's choice, or null if nothing is chosen yet
              if (g === 'best') best++;  // counts a best fit
              card.className = 'mcard' + (g ? ' g-' + g : '');  // sets the card's colour class from its grade (green, amber or red), or plain if nothing is chosen
              card.querySelector('.mverdict').textContent = g ? GRADE[g][1] : '';  // writes the verdict words at the top right of the card, or clears them
              card.btns.forEach((b, i) => { const on = METHODS[i].k === choice[k]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });  // lights up only the chosen method's button and tells screen readers which one is pressed
            });  // ends the card loop
            score.textContent = `Best fits: ${best} / 4`;  // updates the score text
            score.className = 'chip ' + (best === 4 ? 'ok' : 'accent');  // the score tag turns green when all four are best fits
          }  // ends paint()
          const reset = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { choice.fill(null); paint(); fb.put('info', START); } }, 'Reset');  // reset: a button that clears every choice, repaints, and brings back the opening instruction
          paint();  // draws the cards in their starting, ungraded state
          fb.put('info', START);  // shows the opening instruction
          const lead = h('p', { class: 'lead m0', html: 'Each <span class="t">resource class</span> gets one method. Choose it from how the class’s resources behave.' });  // lead: the opening sentence of the lab, saying each class gets one method
          const legend = h('div', { class: 'mlegend small', html: METHODS.map((m) => `<b>${m.label}</b><span>${m.def}</span>`).join('') });  // legend: each method's name with a short definition, as a two-column list
          const scoreRow = h('div', { class: 'row' }, score, h('span', { class: 'grow' }), reset);  // scoreRow: the score at the left and the Reset button at the right
          const warn = h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Asking which method is best <i>overall</i>. None is. Each method is cheap for resources with the right behaviour and costly or unsafe for the rest, which is the whole reason to split resources into classes.' });  // "common mistake" box: there is no single best method overall, which is why resources are split into classes
          // on a small screen the feedback sits right under the cards, where the buttons are
          if (ctx.narrow) el.append(h('div', { class: 'stack' }, lead, legend, ...cards, fb, scoreRow, warn));  // small screen: one column, with the feedback right under the cards so it stays near the buttons
          else el.append(h('div', { class: 'split l3 fill' },  // otherwise two columns: a third of the width on the left, two thirds on the right
            h('div', { class: 'stack' }, lead, legend, fb, h('div', { class: 'grow' }), scoreRow),  // left column: the lead, the legend, the feedback and, pushed to the bottom, the score row
            h('div', { class: 'stack gap-s' }, ...cards, warn)));  // right column: the four cards and the warning box; closes the layout
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Why the classes are numbered: no loop can cross a class boundary ---------------- */
      {  // step 3 begins
        title: 'Why the classes must come in a fixed order',  // title shown above step 3
        kind: 'explore',  // kind explore: the step is labelled Explore
        render(el, ctx) {  // render(el, ctx): builds the loop-building lab when the step is shown
          const { h, s } = ctx;  // takes the h builder and s, the builder for SVG (the browser's drawing format), out of ctx
          const HELD = ['swap space', 'a tape drive', 'memory', 'a channel'];   // a sample resource from each class
          // how each class's own method stops a loop whose resources are all in that class
          const INSIDE = [  // INSIDE: one explanation per class of how its own method stops a loop that stays inside the class
            '<b>All at once:</b> a process gets all of its swap space in one request and never holds some while waiting for more. So nobody in this loop can be holding swap space while waiting for swap space.',  // class 1: a process takes all its swap space at once, so it never holds some while waiting for more
            '<b>Avoidance:</b> the banker grants a request only if every process can still finish afterwards. A deadlocked loop is an unsafe state, so the banker never lets it form: at the latest, the request that would close it is refused.',  // class 2: the banker refuses the request that would close the loop, since a deadlock is an unsafe state
            '<b>Preemption:</b> a process waiting for memory gets it by swapping a holder out. Nobody waits for memory forever, so the loop is broken.',  // class 3: a process waiting for memory gets it by swapping a holder out, so nobody waits forever
            '<b>Number order inside the class:</b> the channels themselves are numbered, so the same argument one level down applies: closing the loop would need a request for a lower-numbered channel.',  // class 4: the channels are numbered, so the same ordering argument works one level down
          ];  // closes INSIDE
          const cls = [3, 2, 4];   // cls[i]: the class of the resource that process P(i+1) holds
          const slim = ctx.narrow, W = slim ? 360 : 620, LW = slim ? 40 : 170, BH = slim ? 44 : 50, TOP = 6;  // slim: true on a small screen; W: drawing width; LW: a label width set here but not used; BH: band height; TOP: top margin
          const NX = slim ? [120, 225, 330] : [290, 420, 550];  // NX: the left-to-right positions of the three process circles
          const H = TOP + 4 * BH + 46;  // H: drawing height: four bands plus room below them for the arrow that curves back to P1
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Three processes in a waiting loop, each placed on the band of the class of resource it holds' });  // svg: the drawing; viewBox sets its coordinate system and it scales to the card's width; aria-label describes it for screen readers
          const yOf = (c) => TOP + (4 - c) * BH + BH / 2;   // class 4 on top, class 1 at the bottom
          const fb = say(ctx);  // fb: the feedback box under the drawing
          const segs = cls.map((c, i) => ctx.ui.seg([1, 2, 3, 4].map((v) => ({ value: v, label: String(v), title: 'Class ' + v + ': ' + CLS[v - 1].name })), c, (v) => { cls[i] = v; paint(); }));  // segs: one 1-2-3-4 switch per process (a guide widget); changing one updates cls and redraws
          const kind = (a, b) => (b > a ? 'up' : b < a ? 'down' : 'same');  // kind(a, b): whether a wait goes up to a higher class, down to a lower one, or stays in the same class
          const COL = { up: 'ok', same: 'accent', down: 'bad' };  // COL: the colour for each kind of wait: green up, indigo same, red down
          function draw() {  // draw(): rebuilds the whole drawing from cls
            const kids = [];  // kids: the shapes of the drawing, collected before they are put in
            for (let c = 4; c >= 1; c--) {  // draws the four class bands from class 4 at the top down to class 1
              const y = TOP + (4 - c) * BH;  // y: the top edge of this band
              kids.push(s('rect', { x: 0, y, width: W, height: BH - 4, rx: 8, class: 's-panel', 'stroke-width': 1 }),  // the band itself: a rounded, neutral rectangle across the full width
                s('text', { x: 10, y: y + BH / 2 + 3, 'font-size': 14, 'font-weight': 800 }, slim ? 'C' + c : c + '  ' + CLS[c - 1].name));  // the band's label: the class number and name, or just C and the number on a small screen
            }  // ends the band loop
            // the three waiting arrows: P1 → P2 → P3 → back to P1
            for (let i = 0; i < 3; i++) {  // one arrow for each process
              const j = (i + 1) % 3, a = cls[i], b = cls[j], k = kind(a, b), col = COL[k];  // j: the next process round the loop; a and b: the classes involved; k: up, down or same; col: its colour
              const x1 = NX[i], y1 = yOf(a), x2 = NX[j], y2 = yOf(b);  // x1, y1: where the arrow starts (this process); x2, y2: where it ends (the next one)
              let d, lx, ly;  // d: the arrow's path; lx, ly: where its label goes
              if (j > i) {  // the forward arrows (P1 to P2, P2 to P3) are straight lines
                const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);  // dx, dy: the direction from start to end; L: the straight-line length (Math.hypot)
                d = `M ${x1 + dx / L * 22} ${y1 + dy / L * 22} L ${x2 - dx / L * 26} ${y2 - dy / L * 26}`;  // a straight path (M moves the pen, L draws a line) that stops short of both circles so the arrowhead stays visible
                const nx = dy / L, ny = -dx / L, f = ny > 0 ? -1 : 1;   // the unit normal that points up the screen
                lx = (x1 + x2) / 2 + nx * f * 14; ly = (y1 + y2) / 2 + ny * f * 14 + 4;  // the label sits beside the middle of the arrow, nudged 14 units toward the top of the screen
              } else {  // the arrow from P3 back to P1 has to curve around
                const yb = TOP + 4 * BH + 34, p0 = y1 + 22, p3 = y2 + 26;  // yb: a level below the four bands where the curve dips; p0 and p3: its start and end, just under the circles
                d = `M ${x1} ${p0} C ${x1} ${yb}, ${x2} ${yb}, ${x2} ${p3}`;  // a curve (C, a smooth curve bent by two control points) that runs below the bands and back up to P1
                lx = (x1 + x2) / 2; ly = (p0 + 6 * yb + p3) / 8 + 5;   // the curve's midpoint, so the label sits on it
              }  // ends the two arrow shapes
              kids.push(s('path', { d, fill: 'none', class: 's-line', 'stroke-width': k === 'down' ? 3 : 2.5, 'stroke-dasharray': k === 'down' ? '6 5' : null, style: `stroke:var(--${col})`, 'marker-end': `url(#arr-${col})` }));  // draws the arrow in its colour with an arrowhead; a downward wait is thicker and dashed so it stands out
              kids.push(s('text', { x: lx, y: ly, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: `fill:var(--${col});paint-order:stroke;stroke:var(--panel);stroke-width:5px` },  // the arrow's label, centred and coloured to match, with a halo in the panel colour so it stays readable over lines
                slim ? (k === 'up' ? '↑ ✓' : k === 'down' ? '↓ ✗' : '=') : k === 'up' ? '↑ up ✓' : k === 'down' ? '↓ down ✗' : '= same class'));  // the label text: up, down or same class, shortened to just the symbols on a small screen
            }  // ends the arrow loop
            cls.forEach((c, i) => {  // draws the three process circles, each on the band of the class it holds
              kids.push(s('circle', { cx: NX[i], cy: yOf(c), r: 20, class: 's-' + JC[i], 'stroke-width': 2.5 }),  // a circle in the process's own colour
                s('text', { x: NX[i], y: yOf(c) + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'P' + (i + 1)));  // the process name, P1 to P3, centred inside its circle
            });  // ends the circles
            svg.replaceChildren(...kids);  // swaps all the new shapes into the drawing in one go
          }  // ends draw()
          function paint() {  // paint(): redraws the loop and explains whether it can ever close
            draw();  // redraws the drawing
            const downs = [];  // downs: every wait that goes down to a lower class, as [waiting process, holding process]
            for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; if (cls[j] < cls[i]) downs.push([i, j]); }  // checks each of the three waits; j is the next process round the loop
            if (downs.length) {  // at least one wait goes down a class
              const [i, j] = downs[0];  // i, j: the first such downward wait
              fb.put('ok', `<b>This loop can never close.</b> P${i + 1} holds ${HELD[cls[i] - 1]} (class ${cls[i]}), so the ordering rule refuses its request for the ${HELD[cls[j] - 1].replace(/^an? /, '')} that P${j + 1} holds (class ${cls[j]}): ${cls[j]} is lower than ${cls[i]}.`  // green message: names the request the ordering rule refuses and why (the replace drops "a" or "an" from the name)
                + (downs.length > 1 ? ` The same goes for ${downs.slice(1).map(([a, b]) => `P${a + 1}’s request (class ${cls[a]} → ${cls[b]})`).join(' and ')}.` : '')  // if there are more downward waits, they are listed as well
                + ' A loop that crosses classes must step down somewhere, and that step is exactly the request the rule forbids.');  // the general point: a loop crossing classes must step down somewhere, and that step is forbidden
            } else {  // no wait goes down, so all three resources are in the same class
              const c = cls[0];  // c: that class
              fb.put('info', `<b>All three resources are in class ${c}, ${CLS[c - 1].name.toLowerCase()}.</b> The order between classes allows every request here, so stopping this loop is the job of the class’s own method. ${INSIDE[c - 1]}`);  // blue message: the order allows every request here, so the class's own method must stop the loop (text from INSIDE)
            }  // ends the two cases
          }  // ends paint()
          const rnd = () => 1 + Math.floor(Math.random() * 4);  // rnd(): a random class number from 1 to 4
          const bMix = h('button', { type: 'button', class: 'btn sm', onclick: () => { do { for (let i = 0; i < 3; i++) cls[i] = rnd(); } while (cls[0] === cls[1] && cls[1] === cls[2]); segs.forEach((g, i) => g.set(cls[i])); paint(); } }, 'Random classes');  // "Random classes" button: random classes, retried until not all equal, then the switches are updated and redrawn
          const bSame = h('button', { type: 'button', class: 'btn sm', onclick: () => { const c = rnd(); cls.fill(c); segs.forEach((g) => g.set(c)); paint(); } }, 'All in one class');  // "All in one class" button: puts all three resources into one random class
          paint();  // draws the starting loop (classes 3, 2, 4)
          el.append(h('div', { class: 'split l fill' },  // two columns filling the step, the left one smaller (5 parts to 7)
            h('div', { class: 'stack' },  // left column: the argument
              h('p', { class: 'lead m0', html: 'Why number the classes? Try to build a deadlock loop that runs through two different classes.' }),  // opening question: why number the classes? It invites building a loop that crosses classes
              h('ol', { class: 'm0 small proof', html: '<li>In a deadlock loop, each process holds a resource and waits for one held by the next process.</li>'  // proof, point 1: in a deadlock loop each process waits for a resource held by the next
                + '<li><span class="t">Class ordering</span>: a process holding a class-<i>a</i> resource may wait only for class <i>a</i> or higher. So around the loop, class numbers <b>never go down</b>.</li>'  // proof, point 2: under class ordering, class numbers never go down as you follow the loop
                + '<li>A loop ends where it began. Numbers that never go down and come back to their start never went up either: every resource in the loop is in <b>one class</b>.</li>'  // proof, point 3: a loop returns to its start, so numbers that never go down never went up: all in one class
                + '<li>Inside one class, that class’s own method rules the loop out. So no deadlock is possible anywhere.</li>' }),  // proof, point 4: inside a single class, that class's own method rules the loop out; closes the list
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'It is the argument for numbering single resources, used one level up on whole classes. Each class’s method stays simple: it never meets a loop that leaves its class.' }),  // "why it matters" box: this is the numbering of single resources applied one level up, to whole classes
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Thinking the order forbids a second request from the same class. It does not; that is the class method’s business. The order only forbids going back <i>down</i>.' })),  // "common mistake" box: the order does not forbid a second request in the same class, only going down; closes the column
            h('div', { class: 'card white stack gap-s' },  // right column: a white card holding the lab
              h('div', { class: 'small', html: '<b>Pick the class of the resource each process holds.</b> P1 waits for P2’s resource, P2 for P3’s, and P3 for P1’s.' }),  // instruction: pick the class each process holds, and who waits for whom around the loop
              h('div', { class: 'ringctl', 'data-keys': '' }, ...segs.map((g, i) => h('div', { class: 'row gap-s nw' }, h('span', { class: 'tok ' + JC[i] }, 'P' + (i + 1)), g))),  // the three switches with their process badges; data-keys keeps the arrow keys for the switches, not for changing step
              svg, slim ? h('div', { class: 'xs muted' }, '↑ ✓ up to a higher class (allowed) · = same class · ↓ ✗ down to a lower class (forbidden)') : null,  // the drawing, plus a key to the arrow symbols on a small screen
              fb, h('div', { class: 'grow' }), h('div', { class: 'row gap-s' }, bMix, bSame))));  // the feedback, a spacer, and the two buttons at the bottom; closes the layout
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Walk-through: three jobs pass through the four classes ---------------- */
      {  // step 4 begins
        title: 'Follow three jobs through the four classes',  // title shown above step 4
        kind: 'explore',  // kind explore: the step is labelled Explore
        core: true,  // core: part of the core path
        render(el, ctx) {  // render(el, ctx): builds the walk-through player and table
          const { h } = ctx;  // takes the h element builder out of ctx
          const { frames, totals } = runWalk();  // plays the scripted run once to get every frame and the totals
          const slim = ctx.narrow;  // slim: true on a small screen, where the table uses shorter wording
          const TOTAL = [WALK.swap, WALK.tape, WALK.mem];  // TOTAL: how many units of swap space, tape drives and memory exist, which sets the length of each meter
          const UNIT = ['GB', 'drives', 'GB'];  // UNIT: the unit word for each of those three
          const grid = h('div', { class: 'wgrid' + (slim ? ' slim' : '') });  // grid: the table of classes against jobs, rebuilt for each frame
          const tally = h('div', { class: 'row gap-s' });  // tally: the row of counters under the table
          const ownCls = (id) => 'o-' + JC['ABC'.indexOf(id)];  // ownCls(id): the colour class for a meter box held by job A, B or C
          // meter(k, snap): the capacity bar of class k, one cell per unit, coloured by the job that holds it
          function meter(k, sn) {  // meter(k, sn): builds the capacity meter for class k from snapshot sn
            if (k === 3) return h('div', { class: 'cap' }, ...['CH1', 'CH2'].map((c) => h('span', { class: 'chb ' + (sn.ch[c] ? ownCls(sn.ch[c]) : '') }, c + (sn.ch[c] ? ' ' + sn.ch[c] : ''))));  // class 4 is shown as two channel boxes, each tinted and labelled with the letter of the job holding it
            const key = ['sH', 'tH', 'mH'][k], cells = [];  // key: which held-amount field to read for this class; cells: one colour name per unit
            sn.J.forEach((j) => { for (let u = 0; u < j[key]; u++) cells.push(ownCls(j.id)); });  // each job adds one box in its own colour for every unit it holds
            while (cells.length < TOTAL[k]) cells.push('');  // the remaining boxes stay empty, meaning free
            return h('div', { class: 'cap' }, ...cells.map((c) => h('i', { class: c })));  // builds the meter, one small box per unit
          }  // ends meter()
          const freeText = (k, sn) => { const n = k === 3 ? ['CH1', 'CH2'].filter((c) => !sn.ch[c]).length : [sn.swap, sn.tape, sn.mem][k]; return slim ? n + ' free' : `${n} of ${k === 3 ? 2 : TOTAL[k]} ${k === 3 ? '' : UNIT[k] + ' '}free`; };  // freeText(k, sn): the free count under a meter: "n free" on a small screen, "n of total GB free" otherwise
          // what job j's cell in class k says, from the snapshot
          function cellText(j, k) {  // cellText(j, k): the text in job j's cell for class k
            const w = j.wait && j.wait.cls === k + 1;  // w: true when the job is waiting on a request in this class
            const wf = slim ? 'waits' : 'waits for';   // shorter wording on a small screen
            if (j.done) return '—';  // a finished job's cells show a dash
            if (k === 0) return j.sH ? `${j.sH} GB` : w ? `${wf} ${j.swap} GB` : '—';  // swap column: what the job holds, or what it is waiting for, or a dash
            if (k === 1) return j.claim === 0 ? (slim ? 'none' : 'none needed') : `${j.tH} of ${slim ? '' : 'claim '}${j.claim}` + (w ? ` · ${wf} ${slim ? '' : j.wait.n}` : '');  // tape column: "none needed" for a job with no claim, else drives held of its claim, plus any wait
            if (k === 2) return j.mH ? `${j.mH} GB` : j.out ? (slim ? 'swapped out' : `swapped out · waits for ${j.mem} GB`) : w ? `${wf} ${j.mem} GB` : '—';  // memory column: what it holds, or that it is swapped out, or what it waits for, or a dash
            return j.chH.length ? j.chH.join(slim ? ' ' : ' + ') : '—';  // channel column: the channels the job holds, or a dash
          }  // ends cellText()
          function status(j) {  // status(j): the colour and word for the job's status tag
            if (j.done) return ['ok', 'done'];  // done: green
            if (j.out) return ['bad', 'swapped out'];  // swapped out: red
            if (j.wait) return ['warn', 'waiting'];  // waiting: amber
            if (j.chH.length) return ['ok', 'running'];  // holding channels means it reached the last class and is running: green
            return j.sH ? ['accent', 'collecting'] : ['', 'not started'];  // holding swap space means it is still collecting; otherwise it has not started
          }  // ends status()
          function draw(i) {  // draw(i): rebuilds the table for frame i
            const f = frames[i], sn = f.snap, act = f.r ? f.r.cls - 1 : -1;  // f: the frame; sn: its snapshot; act: the column of the class that acted in this frame (-1 if none)
            // which cells to light up: the one that acted, plus any request that was granted on a retry
            const hits = {};  // hits: maps a job letter plus column number to the colour that cell lights up with
            if (f.r) hits[f.id + (f.r.cls - 1)] = f.r.ok ? 'ok' : 'bad';  // the requesting job's cell in the acting class turns green if granted, red if refused
            if (f.r && f.r.victim) hits[f.r.victim + 2] = 'warn';  // a job swapped out to make room has its memory cell (class 3, numbered 2 when counting from 0) turn amber
            (f.woke || []).forEach((w) => { hits[w.id + (w.r.cls - 1)] = 'ok'; });  // any waiting request granted on a retry turns its cell green too
            const kids = [h('div', { class: 'wh corner xs b muted' }, slim ? '' : 'CLASS →')];  // kids: the table's cells, in reading order; first the top-left corner with a "class" label (empty on a small screen)
            CLS.forEach((c, k) => kids.push(h('div', { class: 'wh' + (k === act ? ' cur' : '') },  // one header cell per class, outlined when that class acts in this frame
              h('div', { class: 'row gap-s nw' }, h('span', { class: 'cn' }, String(c.n)), slim ? null : h('b', { class: 'ell' }, c.name)),  // the class number badge and, on a wider screen, the class name
              slim ? h('b', { class: 'xs' }, c.short) : null,  // on a small screen, the class's short name instead
              h('div', { class: 'xs b mchip' }, slim ? c.mshort : c.mlabel))));  // the class's method label underneath, short on a small screen; closes the header cell
            kids.push(h('div', { class: 'wc corner xs b muted' }, slim ? '' : 'FREE'));  // the label cell for the meters row, "FREE" (empty on a small screen)
            CLS.forEach((c, k) => kids.push(h('div', { class: 'wc capc' + (k === act ? ' cur' : '') }, meter(k, sn), h('span', { class: 'xs muted' }, freeText(k, sn)))));  // one meter cell per class: the capacity meter with the free count under it
            sn.J.forEach((j, r) => {  // one row per job, read from the frame's snapshot; r is the row number, which picks the job's colour
              const [sc, st] = status(j);  // sc, st: the colour and word of the job's status tag
              kids.push(h('div', { class: 'wc jlab' + (j.done ? ' dim' : '') + (f.id === j.id && f.kind === 'end' ? ' hit-ok' : '') },  // the row label cell, faded once the job is done and green in the frame where it finishes
                h('span', { class: 'tok ' + JC[r] }, j.id), slim ? null : h('span', { class: 'small b ell' }, j.name), slim ? null : h('span', { class: 'chip ' + sc }, st)));  // the job badge and, on a wider screen, its name and status tag
              CLS.forEach((c, k) => {  // one cell per class for this job
                const hit = hits[j.id + k];  // hit: whether this cell lights up in this frame, and in which colour
                kids.push(h('div', { class: 'wc' + (k === act ? ' cur' : '') + (hit ? ' hit-' + hit : '') + (j.done ? ' dim' : '') }, cellText(j, k)));  // the cell, outlined if its class is acting, coloured if lit, faded if the job is done, with its text
              });  // ends this job's cells
            });  // ends the job rows
            grid.replaceChildren(...kids);  // swaps all the new cells into the table at once
            const t = sn.tally;  // t: the running counts saved in the snapshot
            tally.innerHTML = `<span class="xs b muted">SO FAR</span><span class="chip">safety tests: ${t.tests}</span><span class="chip">requests made to wait: ${t.refused}</span>`  // the counters row: safety tests run so far and requests made to wait so far
              + `<span class="chip">swap-outs: ${t.outs}, swap-ins: ${t.ins}</span><span class="chip ok">deadlocks: 0, and none possible</span>`;  // then swap-outs and swap-ins, and a green tag stating that no deadlock happened or could happen
            return walkCaption(f, totals, i === frames.length - 1);  // returns this frame's caption to the player; the last frame adds the run's summary
          }  // ends draw()
          const player = ctx.ui.player({ count: frames.length, render: draw, interval: 3200 });  // player: the guide's animation player with Previous, Play and Next buttons; it calls draw for each frame, 3.2 seconds apart
          el.append(h('div', { class: 'stack fill' },  // lays the step out as one column filling its height
            h('p', { class: 'm0', html: 'The integrated design at work. Three jobs (A = Payroll, B = Backup, C = Report; priority A &gt; B &gt; C) take their resources class by class. Step through and watch <b>which method acts</b> at each request.' }),  // intro: names the three jobs and their priorities, and asks the student to watch which method acts at each request
            h('div', { class: 'card white tight stack gap-s' }, grid, tally),  // a white card holding the table and the counters
            player.el));  // the player's controls and caption at the bottom; closes the layout
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. Compare: one rule for everything vs. the integrated design ---------------- */
      {  // step 5 begins
        title: 'One rule for everything, or one rule per class?',  // title shown above step 5
        kind: 'compare',  // kind compare: the step is labelled Compare
        render(el, ctx) {  // render(el, ctx): builds the comparison chart, table and design buttons
          const { h, s } = ctx;  // takes the h and s builders out of ctx
          const R = {};  // R: the run for each design, filed by its key
          POLICY.forEach((p) => { R[p.k] = simCompare(p.k); });  // runs the workload once under each of the four designs
          const TMAX = Math.max(...POLICY.map((p) => R[p.k].T));  // TMAX: the longest run's length in minutes, so all four charts share one time scale
          const slim = ctx.narrow, W = slim ? 360 : 660, LX = slim ? 40 : 52, RX = slim ? 14 : 44, RH = slim ? 22 : 28, GAP = slim ? 6 : 8, TOP = 18;  // chart sizes: W width, LX left label space, RX right margin, RH row height, GAP between rows, TOP space for a label
          const cw = (W - LX - RX) / TMAX;  // cw: the width of one minute on the chart
          const H = TOP + 5 * (RH + GAP) + 22;  // H: chart height: five rows (three jobs, two channels) plus room for the minute scale
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Minute-by-minute chart of three jobs and two channels' });  // svg: the chart; aria-label describes it for screen readers
          const fb = say(ctx);  // fb: the box that tells the story of the chosen design's run
          const pct = (a, b) => Math.round((100 * a) / b);  // pct(a, b): a as a whole-number percentage of b
          const maxRun = (r) => Math.max(...r.rows.map((row) => row.filter((x) => x === 'run').length));  // maxRun(r): the most jobs running in the same minute during run r
          // the narration for each design, written from its own run (and the integrated run for comparison)
          function story(k) {  // story(k): the colour and narration for design k
            const r = R[k], I = R.int;  // r: this design's run; I: the integrated run, for comparison
            const fastest = POLICY.every((p) => R[p.k].done >= r.done);  // fastest: true when no other design finished earlier
            if (k === 'int') return ['ok', `<b>Done at minute ${r.done}</b>${fastest ? ', the fastest of the four,' : ''} with only <b>${r.tests} safety tests</b>, because only tape requests are tested. The channels were busy ${r.chUsed === r.chHeld ? 'every minute they were held' : r.chUsed + ' of the ' + r.chHeld + ' minutes they were held'} (${r.chUsed} of ${r.chHeld}), and no deadlock can happen. The price: the class order makes a job take its tape before its memory, even if it needs the tape only later, so drives were held ${r.tapeHeld} drive-minutes but busy only ${r.tapeUsed}.`];  // integrated: when it finished, how few tests it ran, how busy the channels were, and the price of taking tapes early
            if (k === 'all') return ['warn', `<b>Done at minute ${r.done}</b>, ${r.done - I.done} minutes later than the integrated design. Each job held both channels and its tape drive for its whole run, so the channels were busy only ${pct(r.chUsed, r.chHeld)}% of the time they were held (${r.chUsed} of ${r.chHeld} channel-minutes); the rest is <span class="t">held-but-idle time</span>` + (maxRun(r) === 1 ? '. The jobs ran strictly one after another.' : '.') + ' Safe, but slow.'];  // all at once: how much later it finished and how idle the held channels were; notes if jobs ran strictly one at a time
            if (k === 'avoid') return ['warn', `<b>Done at minute ${r.done}</b>, ${r.done > I.done ? plural(r.done - I.done, 'minute', 'minutes') + ' after' : 'as soon as'} the integrated design, but it ran <b>${r.tests} safety tests</b> instead of ${I.tests}, and every job had to declare its maximum need for swap space, memory and each channel too. A real job makes thousands of channel transfers; here each one would need a test.`];  // banker for everything: when it finished, how many more tests it ran, and that every need had to be declared
            const ev = r.events[0];  // detection: ev is the first deadlock found, if any
            if (!ev) return ['ok', `No deadlock happened this time. Done at minute ${r.done}.`];  // if no deadlock formed in this run, a short green note
            return ['bad', `<b>A deadlock formed at minute ${ev.formed}:</b> ${ev.dead.map((d) => `J${d.id} held ${d.holds.join(' and ') || 'nothing'} and waited for ${d.wants}`).join(', while ')}. The check every ${CMPW.every} minutes found it at minute ${ev.at} and aborted ${ev.victims.map((v) => `J${v.id}, throwing away <b>${v.lost} minutes of work</b>`).join('; then ')}. Everyone finished at minute ${r.done}.`];  // otherwise: when the deadlock formed, what each stuck job held and wanted, when it was found, and the work thrown away
          }  // ends story()
          function draw(k) {  // draw(k): rebuilds the chart for design k
            const r = R[k], kids = [];  // r: this design's run; kids: the chart's shapes
            const x = (t) => LX + t * cw, y = (i) => TOP + i * (RH + GAP);  // x(t): where minute t sits across the chart; y(i): the top of row i
            ['J1', 'J2', 'J3', 'CH1', 'CH2'].forEach((lab, i) => kids.push(s('text', { x: LX - 8, y: y(i) + RH / 2 + 5, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 800 }, lab),  // a label for each of the five rows (J1-J3, CH1, CH2), right-aligned in the left margin
              s('rect', { x: x(0), y: y(i), width: TMAX * cw, height: RH, rx: 3, class: 's-panel', 'stroke-width': 1 })));  // and a neutral background strip for each row across the full time scale
            r.rows.forEach((row, t) => row.forEach((st, i) => {  // for every minute and every job, one coloured box showing the job's state
              if (st === 'done') return;  // no box once the job is done
              const col = JC[i];  // col: the job's own colour
              const style = st === 'run' ? `fill:var(--${col});stroke:var(--${col})` : st === 'wait' ? 'fill:var(--warn-bg);stroke:var(--warn)' : st === 'dead' ? 'fill:var(--bad);stroke:var(--bad)' : 'fill:var(--bad-bg);stroke:var(--bad)';  // running fills with the job's colour; waiting is amber; frozen in a deadlock is solid red; lost work is pale red
              kids.push(s('rect', { x: x(t) + 0.5, y: y(i) + 1, width: cw - 1, height: RH - 2, rx: 2, style, 'stroke-width': 1 }));  // draws the box for that minute, a little smaller than its slot so neighbours stay apart
            }));  // ends the job boxes
            r.chRows.forEach((c, t) => ['CH1', 'CH2'].forEach((ch, n) => {  // for every minute and each channel, a box when somebody holds it
              const o = c[ch].owner;  // o: the number of the job holding the channel this minute
              if (!o) return;  // nobody holds it: nothing to draw
              const col = JC[o - 1];  // col: the holder's colour
              kids.push(s('rect', { x: x(t) + 0.5, y: y(3 + n) + 1, width: cw - 1, height: RH - 2, rx: 2, 'stroke-width': 1, 'stroke-dasharray': c[ch].used ? null : '3 2',  // a box on the channel's row; dashed outline when it is held but not used that minute (held-but-idle time)
                style: c[ch].used ? `fill:var(--${col});stroke:var(--${col})` : `fill:var(--${col}-bg);stroke:var(--${col})` }));  // solid fill when really used, pale fill when idle
            }));  // ends the channel boxes
            r.fin.forEach((f, i) => kids.push(s('text', { x: x(f) + 3, y: y(i) + RH / 2 + 5, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, '✓' + (slim ? '' : ' ' + f))));  // a check mark where each job finished, with the minute beside it on a wider screen
            for (let t = 0; t <= TMAX; t += 5) kids.push(s('line', { x1: x(t), y1: y(5) - 2, x2: x(t), y2: y(5) + 3, class: 's-line' }),  // tick marks every 5 minutes along the bottom of the chart
              s('text', { x: x(t), y: y(5) + 16, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(t)));  // and the minute number under each tick
            kids.push(s('text', { x: LX - 8, y: y(5) + 16, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'min'));  // the unit label "min" at the left end of the scale
            r.events.forEach((ev) => kids.push(s('line', { x1: x(ev.at), y1: 2, x2: x(ev.at), y2: y(5) - 4, 'stroke-width': 2, 'stroke-dasharray': '4 3', style: 'stroke:var(--bad)' }),  // for every deadlock found, a red dashed line at the minute of the check
              s('text', { x: x(ev.at) + 4, y: 12, 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--bad)' }, 'check finds the deadlock')));  // with a red label saying the check finds the deadlock
            svg.replaceChildren(...kids);  // swaps the new shapes into the chart in one go
          }  // ends draw()
          const rowsOf = POLICY.map((p) => {  // rowsOf: one row of the comparison table per design
            const r = R[p.k];  // r: that design's run
            const dl = r.events.length ? `${r.events.length} found, ${r.lost} min lost` : 'impossible';  // dl: the deadlock column: how many were found and how many minutes were lost, or "impossible"
            const cells = slim ? [p.label, r.done, r.tests, dl] : [p.long, r.done, ctx.util.fmt(r.avg, 1), `${r.chUsed} / ${r.chHeld}`, `${r.tapeUsed} / ${r.tapeHeld}`, r.tests, dl];  // the cells: just name, finish, tests and deadlock on a small screen; otherwise adds average finish and busy/held figures
            return h('tr', {}, ...cells.map((c, i) => h('td', {}, i ? String(c) : h('b', {}, c))));  // builds the table row, with the design name in bold
          });  // ends rowsOf
          const head = slim ? ['Design', 'Done at', 'Tests', 'Deadlock'] : ['Design', 'Done at (min)', 'Avg. finish', 'Channels busy / held', 'Drives busy / held', 'Safety tests', 'Deadlock'];  // the column headings, shortened on a small screen
          const table = h('table', { class: 'tbl compact small ctbl' }, h('tr', {}, ...head.map((x) => h('th', {}, x))), ...rowsOf);  // table: the headings row followed by the four design rows
          function show(k) {  // show(k): switches the step to design k
            draw(k);  // redraws the chart
            const [cls, html] = story(k);  // cls, html: the colour and narration for this design
            fb.put(cls, html);  // shows them in the feedback box
            POLICY.forEach((p, i) => rowsOf[i].classList.toggle('on', p.k === k));  // highlights this design's row in the table
          }  // ends show()
          const seg = ctx.ui.seg(POLICY.map((p) => ({ value: p.k, label: p.label })), 'int', show);  // seg: a four-button switch (a guide widget) to pick a design; it starts on integrated and calls show() on a click
          const legend = h('div', { class: 'row gap-s xs' },  // legend: a row of colour swatches explaining the chart
            ...[['var(--proc)', 'var(--proc)', 'running'], ['var(--warn-bg)', 'var(--warn)', 'waiting'], ['var(--bad)', 'var(--bad)', 'deadlocked'], ['var(--bad-bg)', 'var(--bad)', 'work thrown away'], ['var(--proc-bg)', 'var(--proc)', 'channel held, idle']]  // the five entries as [fill, border, meaning]: running, waiting, deadlocked, work thrown away, channel held but idle
              .map(([f, b, t]) => h('span', { class: 'row gap-s nw' }, h('i', { class: 'lg', style: { background: f, borderColor: b } }), t)));  // each entry becomes a small swatch followed by its meaning
          show('int');  // opens the step on the integrated design
          el.append(h('div', { class: 'stack fill' },  // lays the step out as one column filling its height
            h('div', { class: 'row' }, h('p', { class: 'm0 grow', html: 'The integrated design against three <span class="t" data-t="uniform strategy">uniform strategies</span>. J1, J2 and J3 each need a <span class="t">tape drive</span> (2 exist) and spells of I/O on channel CH1, CH2 or both. Swap space and memory are plentiful here.' }), seg),  // top row: intro on the workload (three jobs, 2 tape drives, two channels) with the design switch at the right
            h('div', { class: 'split r' },  // middle: two columns, the left one larger (7 parts to 5)
              h('div', { class: 'card white stack gap-s' }, svg, legend,  // left: a white card with the chart and its legend
                h('div', { class: 'xs muted' }, 'Each square is one minute. The CH1 and CH2 rows show which job holds each channel; a dashed square means held but not in use.')),  // a note on how to read the chart: one square per minute, and dashed squares on the channel rows
              h('div', { class: 'stack gap-s' }, fb,  // right: the story of the chosen design
                h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Every one-rule design is a good fit for some resources and a bad fit for others. The integrated design pays each class only its own cheapest price. In this workload that puts it ahead overall, though not in every column.' }))),  // "why it matters" box: each single-rule design misfits some resources; the integrated one pays only the cheapest price
            table));  // the comparison table across the bottom; closes the layout
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. Recap ---------------- */
      {  // step 6 begins
        title: 'Recap: the integrated strategy in eight cards',  // title shown above step 6
        kind: 'recap',  // kind recap: the step is labelled Recap
        render(el, ctx) {  // render(el, ctx): builds the recap cards
          const { h } = ctx;  // takes the h element builder out of ctx
          // the comparison numbers on the last card come from the same simulation as step 5
          const I = simCompare('int'), A = simCompare('all'), B = simCompare('avoid'), D = simCompare('detect');  // reruns the step 5 workload under the integrated, all-at-once, banker and detection designs
          const wk = runWalk().totals;  // wk: the totals of the step 4 walk-through
          el.append(h('div', { class: 'stack fill' },  // one column filling the step
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction to answer each card aloud before flipping it
            ctx.ui.flipcards([  // flip cards (a guide widget): each card shows a question and turns over to reveal the answer
              ['What is an integrated strategy?', 'Sort resources into classes, put the classes in a fixed order, and inside each class use the deadlock method that suits it best.'],  // card 1: what an integrated strategy does
              ['The four classes, in order', '1 swappable space, 2 process resources (devices, files), 3 main memory, 4 internal resources (I/O channels).'],  // card 2: the four classes in order
              ['Class 1: swappable space', '<b>All at once</b> (no hold and wait). The size is known up front and the space is needed for the whole run. Avoidance also works.'],  // card 3: class 1's method and why, plus the runner-up
              ['Class 2: process resources', '<b>Avoidance.</b> Jobs declare their drives and files in advance, which is exactly the banker’s maximum claim. Ordering inside the class also works.'],  // card 4: class 2's method and why, plus the runner-up
              ['Class 3: main memory', '<b>Preemption.</b> Swap the process out to its swap space; nothing is lost and it resumes exactly where it stopped.'],  // card 5: class 3's method and why no work is lost
              ['Class 4: internal resources', '<b>Resource ordering.</b> Channels are grabbed briefly and very often; a fixed number order costs nothing at run time.'],  // card 6: class 4's method and why it is free at run time
              ['Why order the classes?', 'Requests never go to a lower class, so a waiting loop cannot cross classes. Any loop stays in one class, where that class’s method stops it.'],  // card 7: why ordering the classes keeps every loop inside one class
              ['Why not one rule for all?', `In the comparison, all at once finished at minute ${A.done} (integrated: ${I.done}), the banker everywhere ran ${B.tests} safety tests (integrated: ${I.tests}), and detection lost ${D.lost} minutes of work.`],  // card 8: why not one rule for all, quoting finish times, test counts and lost work from the step 5 runs
            ], { cols: ctx.narrow ? 2 : 4, height: 170 }),  // two columns of cards on a small screen and four otherwise, each at least 170 pixels tall
            h('div', { class: 'callout tip m0', 'data-label': 'The walk-through in numbers', html: `Three jobs passed through all four classes with ${plural(wk.tests, 'safety test', 'safety tests')} (all in class 2), ${plural(wk.refused, 'request', 'requests')} made to wait, ${plural(wk.outs, 'swap-out', 'swap-outs')} and ${plural(wk.ins, 'swap-in', 'swap-ins')}. At no moment was a deadlock possible.` })));  // tip box: the walk-through's totals of tests, waits, swap-outs and swap-ins, and that deadlock was never possible
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Quiz ---------------- */
      {  // step 7 begins
        title: 'Check yourself',  // title shown above step 7
        kind: 'check',  // kind check: the step is labelled Check Yourself
        quiz: [  // quiz: the section's questions; the guide draws each one and checks the answers
          { q: 'In the integrated strategy, which method handles <b>main memory</b>?',  // quiz question 1 (multiple choice): which method handles main memory
            choices: ['Avoidance: run the banker’s safety test on every allocation', 'All at once: each process reserves its largest memory need for its whole run', 'Preemption: swap a process out to its swap space and bring it back later', 'Detection: let memory deadlocks happen, then abort a process'], answer: 2,  // the four choices; answer 2 (counting from 0) is preemption by swapping
            feedback: ['Memory needs change constantly and requests are frequent, so a test on each one is costly; and memory, unlike a tape, can simply be taken back.', 'This works but wastes scarce memory: far fewer processes could be in memory at once.', null, 'Recovery would end up taking memory away anyway, after processes had sat frozen. Preempting at once is simpler.'],  // feedback for each wrong choice; null for the right one, which uses the explanation below instead
            why: 'Memory is cheap to preempt: its contents can be copied to swap space and restored exactly, so no work is lost. Taking it back removes the no-preemption condition for this class.' },  // explanation: memory can be saved and restored exactly, so taking it back loses no work
          { type: 'order', q: 'Put the four resource classes in the order in which a process is assigned them.',  // quiz question 2 (put in order): the order in which a process gets the four classes
            items: ['Swappable space', 'Process resources (devices and files)', 'Main memory', 'Internal resources (I/O channels)'],  // the four classes, given in the correct order; the guide shuffles them for the student
            why: 'Swap space first, then devices and files, then memory, then internal resources. One useful effect of this order: a process holding memory already owns the swap space it would be swapped out into.' },  // explanation: the order, and how holding memory implies already owning the swap space to be swapped out into
          { type: 'match', q: 'Match each class to the method that suits it best.',  // quiz question 3 (match): each class with its best method
            pairs: [['Swappable space', 'Allocate all of it in one request'], ['Process resources', 'Avoidance with declared claims'], ['Main memory', 'Preemption by swapping out'], ['Internal resources', 'Resource ordering']],  // the four class and method pairs
            why: 'Each method fits what is cheap for the class: known sizes for swap space, declared claims for devices and files, cheap save-and-restore for memory, and brief, frequent use for channels.' },  // explanation: each method fits what is cheap for its class
          { type: 'bucket', q: 'Sort each resource into its class.',  // quiz question 4 (sort into buckets): put each resource into its class
            buckets: ['Swappable space', 'Process resources', 'Main memory', 'Internal resources'],  // the four buckets, one per class
            items: [['Blocks of the disk’s swap area', 0], ['A tape drive', 1], ['A file opened for exclusive update', 1], ['Page frames', 2], ['An I/O channel', 3]],  // the resources with the bucket each belongs in: swap blocks, a tape drive, a locked file, page frames, a channel
            why: 'Swap blocks hold swapped-out images; drives and exclusively used files are long-held process resources; page frames are main memory; channels are used briefly by the system itself.' },  // explanation: why each resource falls in its class
          { type: 'tf', q: 'Under class ordering, a process that holds main memory may then ask for a tape drive.', answer: false,  // quiz question 5 (true or false): asking for a tape drive while holding memory is allowed (false)
            why: 'Tape drives are in class 2 and memory is in class 3. Asking for a drive while holding memory would go back down to a lower class, which the ordering forbids. The process must get its drive before its memory, or give its memory back first.' },  // explanation: that request goes from class 3 down to class 2, which the ordering forbids
          { type: 'tf', q: 'Ordering the classes is enough, by itself, to prevent every deadlock, including one among resources of a single class.', answer: false,  // quiz question 6 (true or false): class ordering alone prevents every deadlock (false)
            why: 'The ordering only rules out waiting loops that cross from one class to another. A loop inside a single class is stopped by that class’s own method, which is why each class still needs one.' },  // explanation: ordering only stops loops that cross classes; each class still needs its own method
          { q: 'Why is preemption a poor method for tape drives?',  // quiz question 7 (multiple choice): why preemption suits tape drives poorly
            choices: ['Tape drives cannot be numbered, so the OS cannot pick one to take back', 'A half-written tape is ruined, so the job’s tape work must be redone', 'Preemption works only for the processor, never for devices like drives', 'Jobs cannot know in advance which drives they will need while they run'], answer: 1,  // the four choices; answer 1 says a half-written tape is ruined
            feedback: ['Drives can be numbered; ordering inside the class is in fact a workable second choice.', null, 'Memory is preempted too, by swapping. What matters is whether the state can be saved and restored cheaply, and a half-written tape cannot.', 'They can: jobs declare their drives up front, which is what makes avoidance work for this class.'],  // feedback for each wrong choice: drives can be numbered, memory is preempted too, and drives are declared ahead
            why: 'A resource is a good candidate for preemption only if its state can be saved and restored cheaply. A tape drive in mid-job cannot, so its class uses avoidance instead.' },  // explanation: preemption suits only resources whose state is cheap to save and restore
          { type: 'multi', q: 'Which reasons explain why all-at-once allocation suits swappable space?',  // quiz question 8 (pick all that apply): why all at once suits swappable space
            choices: ['The amount a process needs is known when it is created', 'Swap space can be taken back cheaply', 'The space is needed for the whole run anyway, so reserving it early wastes little', 'Swap space is used for only a few milliseconds at a time', 'A process waiting for swap space holds none of it, so hold and wait cannot occur in this class'], answer: [0, 2, 4],  // five reasons; answers 0, 2 and 4 are right (known size, needed for the whole run, no hold and wait)
            why: 'Known size plus whole-run use makes the all-at-once rule cheap, and it removes hold and wait. Swap space cannot be taken back cheaply (it holds swapped-out images), and it is held for a long time, not milliseconds.' },  // explanation: why those three hold, and why the cheap-to-take-back and milliseconds reasons are wrong
          { type: 'num', q: 'A system has 12 GB of swap space. Running processes hold 4 GB and 3 GB of it. A new process needs 6 GB and, following the integrated strategy, asks for all of it in one request. How many GB does it receive right away?', answer: 0, tol: 0, unit: 'GB',  // quiz question 9 (number): swap space received when 6 GB is asked for and only 5 GB is free (0 GB)
            hint: 'All at once means all or nothing.',  // hint: all at once means all or nothing
            why: '12 − 4 − 3 = 5 GB are free, less than the 6 GB requested. The request is refused as a whole, so the process gets 0 GB and waits holding nothing: no hold and wait.' },  // explanation: the arithmetic, and that the process waits holding nothing
          { type: 'num', q: 'A job keeps an I/O channel reserved for its entire 50-minute run, but it actually transfers data on the channel for a total of 30 seconds. What percentage of the reserved time is the channel busy?', answer: 1, tol: 0.05, unit: '%',  // quiz question 10 (number): the percentage of time a channel reserved for 50 minutes is busy for 30 seconds (1%)
            hint: 'Convert both times to seconds.',  // hint: convert both times to seconds
            why: '50 minutes is 3,000 seconds, and 30 / 3,000 = 1%. The channel sits held but idle 99% of the time, which is why all-at-once is a poor fit for internal resources.' },  // explanation: the arithmetic, and why so much held-but-idle time makes all at once a poor fit for channels
          { q: 'A system has 3 tape drives, managed by avoidance. Job A (claim 3) holds 2 drives; job B (claim 2) holds none; 1 drive is free. B asks for 1 drive. What happens?',  // quiz question 11 (multiple choice): a banker's decision on one tape drive request
            choices: ['B gets the drive at once, because one drive is still free at the moment it asks', 'The system preempts a drive from A and hands it to B, since B holds no drive yet', 'B gets the drive, because the request stays within its declared claim of 2 drives', 'B waits: granting would leave an unsafe state (0 free; A and B each still need 1)'], answer: 3,  // the four choices; answer 3 is that B waits because the state would be unsafe
            feedback: ['A free unit is not enough under avoidance: the state after the grant must also be safe.', 'Process resources are not preempted in this design; taking a drive mid-job would ruin A’s work.', 'Staying within the claim is required, but the banker also checks that the result is safe.', null],  // feedback for each wrong choice: a free unit is not enough, drives are not preempted, a valid claim is not enough
            why: 'Grant on paper: 0 drives free, A needs 1 more, B needs 1 more. Neither can be sure to finish, so the state would be unsafe and B waits, even though a drive is free.' },  // explanation: the paper grant leaves 0 free while A and B each need 1 more, so neither can be sure to finish
          { q: 'Why does ordering the classes make a deadlock involving resources from two different classes impossible?',  // quiz question 12 (multiple choice): why ordered classes rule out a deadlock across two classes
            choices: ['Each class runs its own detector that breaks any loop it finds', 'A process may hold resources from only one class at any time', 'Class numbers can never go down around a waiting loop, so a loop cannot leave its class', 'The system preempts a resource from the higher class whenever a loop appears'], answer: 2,  // the four choices; answer 2 says class numbers can never go down around a loop
            feedback: ['No class in this design relies on detection; the ordering prevents such loops instead of finding them.', 'Processes routinely hold resources from several classes at once, for example swap space, a drive and memory.', null, 'Only memory is ever preempted, and the ordering argument needs no preemption at all.'],  // feedback for each wrong choice: there is no detector, processes hold several classes, only memory is preempted
            why: 'Each request goes to the same or a higher class. A loop must end where it began, so numbers that never go down can never have gone up either: every resource in the loop is in one class, where that class’s method takes over.' },  // explanation: the never-go-down argument that forces every loop into a single class
        ],  // closes the quiz list
      },  // ends step 7

    ],  // closes the steps list
    notes: `${/* notes: the study notes for this section, written as HTML inside a backtick string */''}
      <h3>Why mix methods?</h3>${/* notes heading: why mix methods */''}
      <p>Each deadlock approach works but has a price. <b>Prevention</b> rules out one of the four conditions by design (price: idle resources, longer waits, redone work). <b>Avoidance</b> grants a request only if the state stays safe (price: needs declared in advance, a test per request). <b>Detection</b> lets deadlocks happen, then finds and breaks them (price: frozen processes, aborted or rolled-back work).</p>${/* notes paragraph: the three deadlock approaches and the price each one pays */''}
      <p>No approach is cheapest for every kind of resource, so an <b>integrated deadlock strategy</b>:</p>${/* notes paragraph: introduces the three-part integrated strategy that follows */''}
      <ol>${/* starts the numbered list of the strategy's three parts */''}
        <li>groups resources that behave alike into a few <b>resource classes</b>;</li>${/* part 1: group resources that behave alike into classes */''}
        <li>puts the classes in a fixed order (<b>class ordering</b>): a process holding resources from one class may afterwards ask only for that class or a higher-numbered one (resource ordering, applied to whole classes);</li>${/* part 2: put the classes in a fixed order and never ask for a lower one, resource ordering applied to classes */''}
        <li>uses, inside each class, the method that suits that class best.</li>${/* part 3: inside each class, use the method that suits it */''}
      </ol>${/* ends the numbered list */''}
      <p>Using one method for everything (a <b>uniform strategy</b>) is a poor fit for at least one class.</p>${/* notes paragraph: one method for everything misfits at least one class */''}

      <h3>The four classes, in the order they are assigned</h3>${/* notes heading: the four classes in their assignment order */''}
      <table>${/* starts the notes table of classes and methods */''}
        <tr><th>Class</th><th>Best method</th><th>Why it fits</th></tr>${/* table header row: class, best method, why it fits */''}
        <tr><td>1. Swappable space: disk blocks that hold a process’s memory image while it is swapped out</td><td>Prevention: all the space in one request (no hold and wait). Avoidance also possible.</td><td>The size is known when the process is created, and the space is needed for the whole run anyway.</td></tr>${/* table row: swappable space, all at once, because the size is known and the space is needed for the whole run */''}
        <tr><td>2. Process resources: assignable devices such as tape drives, and files opened for exclusive use</td><td>Avoidance: the banker’s test on each request. Ordering inside the class also possible.</td><td>Jobs declare their devices and files in advance, exactly the maximum claim avoidance needs. Requests are few, so tests are cheap.</td></tr>${/* table row: process resources, avoidance, because jobs declare their claims and requests are few */''}
        <tr><td>3. Main memory, handed out in pages or segments</td><td>Prevention by preemption: swap a process out to secondary storage, freeing its memory.</td><td>Memory contents can be copied out and restored exactly, so no work is lost.</td></tr>${/* table row: main memory, preemption by swapping, because its contents can be saved and restored exactly */''}
        <tr><td>4. Internal resources, such as I/O channels</td><td>Prevention by resource ordering.</td><td>Uses are brief and very frequent; a fixed order written into the system’s code costs nothing at run time.</td></tr>${/* table row: internal resources, number order, because uses are brief and frequent and the order costs nothing */''}
      </table>${/* ends the notes table */''}
      <h4>Three questions that decide the method</h4>${/* notes subheading: the three questions that decide the method */''}
      <ul>${/* starts the list of questions */''}
        <li><b>Is the need known in advance?</b> Reserve it all at once, or use avoidance with the declared claim.</li>${/* question 1: a need known in advance points to all at once or avoidance */''}
        <li><b>Can it be taken back cheaply?</b> Preempt it (memory: swap the process out).</li>${/* question 2: a resource that is cheap to take back points to preemption */''}
        <li><b>Is it grabbed briefly and very often?</b> Use a fixed number order; any run-time check or long reservation costs far more than the use.</li>${/* question 3: brief, very frequent use points to a fixed number order */''}
      </ul>${/* ends the list of questions */''}
      <h4>Why the wrong pairings fail</h4>${/* notes subheading: why the wrong pairings fail */''}
      <ul>${/* starts the list of failures */''}
        <li>Preempting a tape drive mid-job ruins the half-written tape (a half-updated file may be left inconsistent). Preempting swap space leaves a swapped-out image nowhere to go.</li>${/* failure: preempting a tape drive or swap space destroys work or leaves an image homeless */''}
        <li>Reserving a channel for a whole run locks others out while it sits idle almost all the time; a safety test on each of thousands of brief channel uses costs more than the transfers.</li>${/* failure: reserving or testing channels costs far more than their brief uses */''}
        <li>Swap blocks and memory frames are interchangeable: a process needs a number of them, not particular ones, so ranking them gives no useful order.</li>${/* failure: ranking interchangeable swap blocks or memory frames gives no useful order */''}
        <li>Detection means frozen processes and lost work, a needless cost where prevention or avoidance is cheap.</li>${/* failure: detection loses work where prevention or avoidance would be cheap */''}
      </ul>${/* ends the list of failures */''}
      <p>Common mistake: asking which method is best <i>overall</i>. None is.</p>${/* notes reminder of the common mistake: there is no best method overall */''}

      <h3>Why ordering the classes prevents deadlock across classes</h3>${/* notes heading: why ordering the classes prevents deadlock across classes */''}
      <ol>${/* starts the numbered argument */''}
        <li>In a deadlock, processes form a loop: each holds a resource and waits for one held by the next.</li>${/* argument, point 1: a deadlock is a loop of processes, each waiting on the next */''}
        <li>With class ordering each wait goes to the same class or a higher one, so class numbers never go down around the loop.</li>${/* argument, point 2: under class ordering, class numbers never go down around the loop */''}
        <li>A loop ends where it began, so numbers that never go down never went up either: every resource in the loop is in one class.</li>${/* argument, point 3: a loop returns to its start, so every resource in it is in one class */''}
        <li>Inside one class, its own method rules the loop out: all-at-once means nobody holds swap space while waiting for more; avoidance never enters an unsafe state, and a deadlock is unsafe; preemption means nobody waits for memory forever; numbered channels give the same argument one level down.</li>${/* argument, point 4: how each class's own method rules out a loop inside that class */''}
      </ol>${/* ends the numbered argument */''}
      <p>This is the argument for numbering single resources, used on whole classes. It forbids only requests back down, not a second request in the same class (that is the class method’s business). Its cost: a process must take resources in class order, for example its tape drive before its memory (or give the memory back first).</p>${/* notes paragraph: this is resource numbering on whole classes, what it does not forbid, and its cost */''}

      <h3>Worked example: three jobs through the four classes</h3>${/* notes heading: the worked example of three jobs through the four classes */''}
      <p>System: ${WALK.swap} GB of swap space, ${WALK.tape} tape drives, ${WALK.mem} GB of memory, channels CH1 and CH2. Jobs (priority A &gt; B &gt; C): ${WALK.jobs.map((j) => `${j.id}: ${j.swap} GB swap, claim ${j.claim} drives, ${j.mem} GB memory, uses ${j.use.join(' then ')}`).join('; ')}.</p>${/* the walk-through's system and jobs, filled in from WALK when the page is built */''}
      <ul>${/* starts the list of class-by-class events */''}
        <li><b>Class 1.</b> C asks for ${NOTE.cSwap.n} GB of swap space with only ${NOTE.cSwap.free} GB free. The request is refused as a whole; C waits holding nothing.</li>${/* class 1 event: C's swap request is refused as a whole, with numbers from the walk-through run */''}
        <li><b>Class 2.</b> A asks for ${NOTE.aTape.n} drives: on paper ${NOTE.aTape.left} would be left, A could finish with it and then B, so the state is safe and the grant stands. B then asks for ${NOTE.bTape.n}: on paper ${NOTE.bTape.left ? NOTE.bTape.left + ' would be left' : 'none would be left'} while ${NOTE.bTape.test.stuck.map((x) => `${x.id} still needs ${x.need}`).join(' and ')}, an unsafe state, so B waits although a drive is free.</li>${/* class 2 events: A's tape grant passes the safety test, then B's request fails it, with the run's numbers */''}
        <li><b>Class 3.</b> Later B needs ${NOTE.bMem.n} GB of memory with only ${NOTE.bMem.had} GB free. ${NOTE.bMem.victim}, the lowest-priority job in memory, is swapped out into the ${NOTE.bMem.vswap} GB of swap space it reserved in class 1, and swapped back in when B finishes.</li>${/* class 3 event: B's memory request swaps out the lowest-priority job into the swap space it reserved */''}
        <li><b>Class 4.</b> B’s program uses CH2 before CH1, but the rule makes it ask for CH1 first.</li>${/* class 4 event: B's program wants CH2 first, but the rule makes it ask for CH1 first */''}
      </ul>${/* ends the list of events */''}
      <p>Whole run: ${NOTE.totals.tests} safety tests (all in class 2), ${NOTE.totals.refused} requests made to wait, ${NOTE.totals.outs} swap-out, ${NOTE.totals.ins} swap-in, and no deadlock possible at any moment.</p>${/* notes paragraph: the walk-through's totals, filled in from the same run */''}

      <h3>One rule for everything vs. the integrated design</h3>${/* notes heading: one rule for everything versus the integrated design */''}
      <p>Three jobs (each needs one of 2 tape drives, plus spells of I/O on CH1, CH2 or both) run minute by minute under four designs:</p>${/* notes paragraph: describes the step 5 workload run under four designs */''}
      <table>${/* starts the comparison table */''}
        <tr><th>Design</th><th>All done at (min)</th><th>Channels busy / held (min)</th><th>Safety tests</th><th>Deadlock</th></tr>${/* comparison table header row: design, finish time, channel use, safety tests, deadlock */''}
        ${POLICY.map((p) => { const r = NOTE.C[p.k]; return `<tr><td>${p.long}</td><td>${r.done}</td><td>${r.chUsed} / ${r.chHeld}</td><td>${r.tests}</td><td>${r.events.length ? `${r.events.length} found, ${r.lost} min of work lost` : 'impossible'}</td></tr>`; }).join('')}${/* one table row per design, filled in from the step 5 runs when the page is built */''}
      </table>${/* ends the comparison table */''}
      <ul>${/* starts the list of what each design costs */''}
        <li><b>All at once</b> is safe but slow: each job holds both channels and its drive for its whole run, so the channels are busy only ${Math.round((100 * NOTE.C.all.chUsed) / NOTE.C.all.chHeld)}% of the time they are held. The rest is <b>held-but-idle time</b>.</li>${/* all at once: safe but slow, with the channels' busy share computed from its run */''}
        <li><b>The banker</b> finishes close behind but runs many more safety tests, and every job must declare its maximum need for every resource, channels included.</li>${/* the banker everywhere: close in time but many more tests and declared needs for every resource */''}
        <li><b>Detection</b> lets a channel deadlock form (one job holds CH1 and waits for CH2, another holds CH2 and waits for CH1); recovery aborts a job and throws its work away.</li>${/* detection: a channel deadlock forms and recovery throws work away */''}
        <li><b>The integrated design</b> pays each class only its own cheapest price. In this workload it finishes first, though not best in every column (the class order makes a job take its tape before its memory, so a drive can sit idle).</li>${/* integrated: pays each class its cheapest price and finishes first here, though a drive can sit idle */''}
      </ul>`,  // ends the last list and the notes text
  });  // ends Guide.section(), the section's registration
})();  // ends the wrapping function and runs it immediately
