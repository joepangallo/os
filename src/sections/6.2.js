// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.2  Deadlock Prevention
   Design deadlock out of the system in advance by making sure one of the
   four conditions can never hold: share what can be shared (mutual
   exclusion), ask for everything at once (hold and wait), let resources be
   taken back (no preemption), or number the resource types and request them
   in rising order (circular wait). Every rule works; every rule has a price.
   All helpers live in this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its names stay private to this file
  // the colour class of each process token: P1 teal, P2 indigo, P3 pink (just to tell them apart)
  const PCOL = { 1: 'proc', 2: 'accent', 3: 'thread' };  // PCOL: the colour name used for each process in drawings (P1 teal, P2 indigo, P3 pink), so a process keeps one colour everywhere
  // TOK(i): a small coloured pill that names process i inside narration text
  const TOK = (i) => `<span class="tok p${i}">P${i}</span>`;  // TOK(i): returns the HTML for a small coloured pill reading P1, P2 or P3, used inside captions and narration

  // the account record of step 2: opening balance, P1's deposit, P2's withdrawal (also quoted in the notes)
  const ACCT = { start: 800, dep: 150, wd: 200 };  // ACCT: the numbers of the shared bank-account example: opening balance 800, P1's deposit 150, P2's withdrawal 200
  // the numbering game of step 5: the devices in their starting number order, and three programs' natural request orders
  const ORD_RES = ['Scanner', 'Disk', 'Printer', 'Network'];  // ORD_RES: the four devices of the numbering game in their starting order; each device's number is its position plus 1
  const ORD_PROGS = [  // ORD_PROGS: the three programs of the numbering game, each with the order in which it naturally asks for devices
    { id: 1, job: 'Scan and upload', desc: 'scan pages, save them, send them', nat: ['Scanner', 'Disk', 'Network'] },  // program P1 (scan and upload): asks for the scanner, then the disk, then the network
    { id: 2, job: 'Print a stored file', desc: 'read the file, then print it', nat: ['Disk', 'Printer'] },  // program P2 (print a stored file): asks for the disk, then the printer
    { id: 3, job: 'Calibrate colours', desc: 'print a test sheet, then scan it', nat: ['Printer', 'Scanner'] },  // program P3 (calibrate colours): asks for the printer, then the scanner, the order that can close a circle
  ];  // closes the ORD_PROGS list

  // verdict(ctx): a coloured explanation box; .say(cls, html) swaps its colour and text
  function verdict(ctx) {  // verdict(ctx): builds the coloured box that explains each result in words; ctx is the toolkit the guide hands each step
    const el = ctx.h('div', { class: 'vbox', 'aria-live': 'polite' });  // ctx.h builds a div with the vbox style; aria-live="polite" makes screen readers announce new text put in it
    el.say = (cls, html) => { el.className = 'vbox ' + (cls || ''); el.innerHTML = html; };  // adds a say method to the box: it sets the colour class (ok, bad, warn or info) and replaces the text inside
    return el;  // hands the box back so the step can place it on the page and call say on it later
  }  // closes verdict

  /* ---- Hold-and-wait simulator (step 3) ----
     Three processes share a disk and a printer. Each program is a list of phases; a phase needs a set of
     resources for a number of ticks (an empty set means it only computes). simHold(policy) runs the whole
     workload tick by tick and returns one record per tick, so the chart, the numbers and the narration all
     come from the same run. Policies:
       'none'  ask as you go, one resource at a time, and keep anything a later phase will need;
       'all'   ask for the whole set in one request at the start, holding nothing while waiting;
       'free'  ask only while holding nothing: give everything back at the end of every phase. */
  const HW_NAME = { disk: 'the disk', prn: 'the printer' };  // HW_NAME: the words the step 3 narration uses for each resource (disk becomes "the disk", prn "the printer")
  const HW_PROCS = [  // HW_PROCS: the step 3 workload: three processes, the tick each one arrives, and the phases of its program
    { id: 1, arrive: 0, phases: [{ need: ['disk'], dur: 3, what: 'reads its data from the disk' }, { need: [], dur: 2, what: 'computes' }, { need: ['disk', 'prn'], dur: 2, what: 'prints a report from its disk file' }] },  // P1 arrives at tick 0: reads the disk for 3 ticks, computes for 2, then needs disk and printer together for 2
    { id: 2, arrive: 1, phases: [{ need: ['prn'], dur: 5, what: 'prints a long job' }] },  // P2 arrives at tick 1 and prints one long job, needing the printer for 5 ticks
    { id: 3, arrive: 4, phases: [{ need: ['disk'], dur: 3, what: 'backs up the disk' }] },  // P3 arrives at tick 4 and backs up the disk, needing it for 3 ticks
  ];  // closes the HW_PROCS list
  function simHold(policy) {  // simHold(policy): runs the step 3 workload under one rule ('none', 'all' or 'free') and records every tick
    const P = HW_PROCS.map((p) => ({ ...p, k: 0, left: p.phases[0].dur, held: new Set(), st: 'new', since: null, told: '', done: null }));  // a working copy of each process: phase number k, ticks left in the phase, resources held, state, wait start, finish tick
    const owner = { disk: null, prn: null };  // owner records which process holds each resource right now (null means the resource is free)
    const ticks = [];  // ticks collects one record per simulated tick; the chart, the numbers and the narration all read from it
    const later = (p) => new Set(p.phases.slice(p.k).flatMap((ph) => ph.need));   // resources this phase or a later one needs
    for (let t = 0; t < 40 && P.some((p) => p.done == null); t++) {  // repeats tick after tick until every process is done; 40 ticks is a safety limit in case one never finishes
      const ev = [];  // ev collects this tick's events (arrive, wait, grant, phase, release, done) for the narration
      P.forEach((p) => { if (p.st === 'new' && p.arrive === t) { p.st = 'start'; ev.push({ type: 'arrive', p: p.id }); } });  // a process whose arrival tick has come moves from 'new' to 'start', and an arrive event is recorded
      // requests: the longest waiter goes first, then processes starting a phase now, by number
      const queue = P.filter((p) => p.st === 'start' || p.st === 'wait').sort((a, b) => (a.since ?? t) - (b.since ?? t) || a.id - b.id);  // queue: processes that want resources now (starting a phase or still waiting), longest waiter first, ties by number
      queue.forEach((p) => {  // handles each request in queue order
        const ph = p.phases[p.k];  // ph is the phase the process is about to run
        const atomic = policy !== 'none';  // atomic is true under both prevention rules: a request is granted whole or not at all
        let want = ph.need.filter((r) => !p.held.has(r));  // want: the resources this phase needs that the process does not hold yet
        if (policy === 'all' && p.k === 0 && !p.held.size) want = [...new Set(p.phases.flatMap((x) => x.need))];  // under 'all', the very first request asks for every resource any phase of the program will ever need
        const busy = want.filter((r) => owner[r] != null && owner[r] !== p.id);  // busy: the wanted resources that another process holds right now
        let blocked = null;  // blocked will list the resources that stop the request, or stay null if the request is granted
        if (atomic) { if (busy.length) blocked = busy; else want.forEach((r) => { owner[r] = p.id; p.held.add(r); }); }  // an all-or-nothing request either blocks on the busy ones or takes every wanted resource in one go
        else for (const r of want) { if (owner[r] != null) { blocked = [r]; break; } owner[r] = p.id; p.held.add(r); }  // with no rule, resources are taken one at a time and the process stops at the first taken one, keeping what it got
        const got = want.filter((r) => p.held.has(r));  // got: the wanted resources the process now really holds
        if (blocked) {  // if the request could not be completed, the process must wait
          const sig = blocked.join() + '|' + [...p.held].join();   // narrate a wait only when its situation changes
          if (p.told !== sig) ev.push({ type: 'wait', p: p.id, want, busy: blocked, by: blocked.map((r) => owner[r]), held: [...p.held], partFree: atomic ? want.filter((r) => owner[r] == null) : [], again: p.st === 'wait' });  // records a wait event (wanted, holders, what it keeps) only when the situation is new, so the narration never repeats
          p.told = sig; p.st = 'wait'; if (p.since == null) p.since = t;  // remembers that situation, marks the process as waiting and notes the tick its wait began
        } else {  // otherwise the request succeeded
          if (want.length) ev.push({ type: 'grant', p: p.id, res: got, afterWait: p.st === 'wait', unused: want.filter((r) => !ph.need.includes(r)) });  // records a grant event, noting whether it ended a wait and which granted resources this phase does not use yet
          p.st = 'run'; p.since = null; p.told = '';  // the process can run now, and its waiting record is cleared
        }  // closes the if/else on blocked
      });  // closes the loop over the request queue
      // run: every process holding all it needs does one tick of its current phase
      const row = {};  // row: what each process is doing this tick, which becomes one column of the chart
      P.forEach((p) => {  // goes through every process
        if (p.st === 'run') {  // a running process does one tick of work
          const ph = p.phases[p.k];  // ph is its current phase
          if (p.left === ph.dur) ev.push({ type: 'phase', p: p.id, what: ph.what, idle: [...p.held].filter((r) => !ph.need.includes(r)) });  // on the phase's first tick, records a phase event that lists any held resources this phase leaves idle
          row[p.id] = { st: 'run', uses: ph.need.slice(), what: ph.what };  // the chart cell shows it running, with the resources it is using
          p.left--;  // one tick of the phase is used up
        } else row[p.id] = { st: p.st === 'wait' ? 'wait' : 'out', held: [...p.held] };  // any other process shows as waiting (with what it holds) or as out (not arrived yet, or already finished)
      });  // closes the loop over processes
      const res = {};  // res: the state of each resource during this tick
      Object.keys(owner).forEach((r) => { const o = owner[r]; res[r] = { owner: o, used: o != null && row[o].st === 'run' && row[o].uses.includes(r) }; });  // for each resource: who owns it, and whether the owner is really using it (held but unused counts as idle)
      // end of tick: finished phases advance, and resources are given back according to the policy
      P.forEach((p) => {  // goes through every process at the end of the tick
        if (p.st !== 'run' || p.left > 0) return;  // skips any process that did not just finish a phase
        p.k++;  // moves on to the next phase
        const keep = p.k < p.phases.length && policy !== 'free' ? later(p) : new Set();  // keep: under 'none' and 'all' a process keeps what later phases need; under 'free', or at the very end, nothing
        const back = [...p.held].filter((r) => !keep.has(r));  // back: the resources it gives back now
        back.forEach((r) => { owner[r] = null; p.held.delete(r); });  // frees each returned resource so others can have it
        if (p.k >= p.phases.length) { p.done = t + 1; p.st = 'done'; ev.push({ type: 'done', p: p.id, res: back }); }  // after the last phase the process is done: its finish tick and a done event are recorded
        else { p.left = p.phases[p.k].dur; p.st = 'start'; if (back.length) ev.push({ type: 'release', p: p.id, res: back }); }  // otherwise its next phase starts next tick, and a release event is recorded if anything was given back
      });  // closes the end-of-tick loop
      ticks.push({ t, row, res, ev });  // saves this tick's record: tick number, chart column, resource states and events
    }  // closes the tick loop
    return { ticks, T: ticks.length, finish: Object.fromEntries(P.map((p) => [p.id, p.done])) };  // returns every tick record, the number of ticks, and the tick at which each process finished
  }  // closes simHold

  /* ---- Rule lab (step 7) ----
     Two processes, a disk (#1) and a printer (#2). LAB[rule][p] is process p's program under that rule:
     one action per line (lock some resources, do work that uses some resources, or unlock everything).
     labStep(S, p) runs ONE line of process p and returns the narration; labAlt(rule) runs the same
     alternating schedule (P1, P2, P1, ...) under a rule, so the comparison table comes from the same engine. */
  const LN = (op, res, code, say) => ({ op, res, code, say });  // LN(op, res, code, say): makes one rule-lab program line: the action, its resources, the code shown, the narration words
  const RN = { disk: 'the disk', prn: 'the printer' };  // RN: the words the rule-lab narration uses for each resource
  const P1STD = [LN('lock', ['disk'], 'lock(disk);       // ask for disk'), LN('work', ['disk'], 'read_file();      // uses disk', 'reads the file'),  // P1STD: P1's ordinary program, first half: lock the disk and read the file with it
    LN('lock', ['prn'], 'lock(printer);    // ask for printer'), LN('work', ['disk', 'prn'], 'print_file();     // uses both', 'prints the file'), LN('unlock', [], 'unlock_all();     // give both back')];  // second half of P1's ordinary program: lock the printer, print the file using both, then give both back
  const LAB = {  // LAB: both processes' programs under every rule, looked up by rule name and then by process number
    none: { 1: P1STD,  // rule 'none' (no rule at all): P1 runs its ordinary program
      2: [LN('lock', ['prn'], 'lock(printer);    // ask for printer'), LN('work', ['prn'], 'print_banner();   // uses printer', 'prints a banner page'),  // P2 with no rule, first half: lock the printer and print a banner page with it
        LN('lock', ['disk'], 'lock(disk);       // ask for disk'), LN('work', ['disk', 'prn'], 'print_file();     // uses both', 'prints the file'), LN('unlock', [], 'unlock_all();     // give both back')] },  // second half: lock the disk, print the file, give both back; the reverse of P1's order, so a circle can form
    all: {  // rule 'all' (all at once), which rules out hold and wait
      1: [LN('lock', ['disk', 'prn'], 'lock(disk, printer); // one request'), LN('work', ['disk'], 'read_file();         // uses disk', 'reads the file'),  // P1 under 'all': a single request for disk and printer together, then it reads the file
        LN('work', ['disk', 'prn'], 'print_file();        // uses both', 'prints the file'), LN('unlock', [], 'unlock_all();        // give both back')],  // then P1 prints the file using both and gives both back
      2: [LN('lock', ['disk', 'prn'], 'lock(disk, printer); // one request'), LN('work', ['prn'], 'print_banner();      // uses printer', 'prints a banner page'),  // P2 under 'all': the same single request for both, then it prints a banner page
        LN('work', ['disk', 'prn'], 'print_file();        // uses both', 'prints the file'), LN('unlock', [], 'unlock_all();        // give both back')] },  // then P2 prints the file and gives both back; closes the 'all' rule
    back: {  // rule 'back' (give back when refused), which rules out no preemption
      1: [P1STD[0], P1STD[1], LN('lock', ['prn'], 'lock(printer);    // no? give all back'), P1STD[3], P1STD[4]],  // P1 under 'back': its ordinary program, except that a refused printer request makes it give everything back
      2: [LN('lock', ['prn'], 'lock(printer);    // ask for printer'), LN('work', ['prn'], 'print_banner();   // uses printer', 'prints a banner page'),  // P2 under 'back': lock the printer and print a banner page
        LN('lock', ['disk'], 'lock(disk);       // no? give all back'), LN('work', ['disk', 'prn'], 'print_file();     // uses both', 'prints the file'), LN('unlock', [], 'unlock_all();     // give both back')] },  // then ask for the disk (give all back if refused), print the file, give both back; closes the 'back' rule
    order: { 1: P1STD,  // rule 'order' (numbered order), which rules out circular wait; P1's ordinary program already asks in rising order
      2: [LN('lock', ['disk'], 'lock(disk);       // #1 first, early'), LN('lock', ['prn'], 'lock(printer);    // then #2'),  // P2 under 'order' must lock the disk (#1) first, early, and only then the printer (#2)
        LN('work', ['prn'], 'print_banner();   // uses printer', 'prints a banner page'), LN('work', ['disk', 'prn'], 'print_file();     // uses both', 'prints the file'), LN('unlock', [], 'unlock_all();     // give both back')] },  // then P2 prints the banner, prints the file and gives both back; closes the 'order' rule
  };  // closes the LAB table
  const labNew = (rule) => ({ rule, pc: { 1: 0, 2: 0 }, held: { 1: new Set(), 2: new Set() }, owner: { disk: null, prn: null }, st: { 1: 'ready', 2: 'ready' }, want: { 1: [], 2: [] }, tick: 0, blocked: 0, idle: 0, gaveBack: 0, dead: false });  // labNew(rule): a fresh lab: each process's line number, held resources, owners, states, waiting requests and counters
  const rnames = (rs) => rs.map((r) => RN[r]).join(' and ');  // rnames(rs): turns a list of resources into words, such as "the disk and the printer"
  function labRelease(S, p) { S.held[p].forEach((r) => { S.owner[r] = null; }); S.held[p].clear(); }  // labRelease(S, p): process p gives back everything it holds, and each of those resources becomes free
  // labWake(S): a blocked process whose whole request is free again is woken and given it, as the OS would do
  function labWake(S) {  // start of labWake, which runs every time some resource is given back
    const out = [];  // out collects one sentence for each process that wakes up
    [1, 2].forEach((x) => {  // checks both processes
      if (S.st[x] !== 'blocked' || S.want[x].some((r) => S.owner[r] != null && S.owner[r] !== x)) return;  // skips a process that is not blocked, or whose wanted resources are still held by the other one
      S.want[x].forEach((r) => { S.owner[r] = x; S.held[x].add(r); });  // gives the woken process every resource it was waiting for
      S.st[x] = 'ready'; S.pc[x]++;  // it is ready again, and its program moves past the lock line that had blocked it
      out.push(`P${x} is woken and gets ${rnames(S.want[x])}.`);  // adds a narration sentence naming the process and what it received
    });  // closes the loop over both processes
    return out;  // hands back the wake-up sentences
  }  // closes labWake
  function labStep(S, p) {  // labStep(S, p): runs one line of process p's program, updates the lab state S, and returns the narration sentences
    const prog = LAB[S.rule][p], q = 3 - p, a = prog[S.pc[p]], msg = [];  // prog: p's program under this rule; q: the other process (3 - p swaps 1 and 2); a: the line to run now
    S.tick++;  // every step counts as one tick
    if (a.op === 'lock') {  // a lock line asks for resources
      const busy = a.res.filter((r) => S.owner[r] != null && S.owner[r] !== p);  // busy: the requested resources that the other process holds
      if (!busy.length) { a.res.forEach((r) => { S.owner[r] = p; S.held[p].add(r); }); S.pc[p]++; msg.push(`P${p} locks ${rnames(a.res)}.`); }  // if none are busy, p takes them all, moves to its next line, and the narration says so
      else if (S.rule === 'back' && S.held[p].size) {  // refused under the 'back' rule while holding something
        const gave = [...S.held[p]];  // gave remembers what p holds, for the narration
        labRelease(S, p); S.gaveBack++;  // p gives it all back, and the give-back counter goes up
        S.st[p] = 'blocked'; S.want[p] = [...new Set([...gave, ...a.res])];  // p blocks, now waiting for what it gave back plus what it asked for, all together
        msg.push(`P${p} asks for ${rnames(a.res)}, but P${q} holds it: <b>refused</b>. The rule makes P${p} give back ${rnames(gave)} and wait, holding nothing, for ${rnames(S.want[p])} together.`);  // narration: the request is refused, and the rule makes p give back what it held
        msg.push(...labWake(S));  // the freed resources may let the other process wake up
      } else {  // otherwise (any other rule, or 'back' while holding nothing) the refused process simply waits
        S.st[p] = 'blocked'; S.want[p] = a.res.slice();  // p blocks and waits for exactly what it asked for
        msg.push(`P${p} asks for ${rnames(a.res)}, but P${q} holds ${rnames(busy)}. P${p} is blocked` + (S.held[p].size ? `, <b>still holding ${rnames([...S.held[p]])}</b>.` : ', holding nothing.'));  // narration: p is blocked, and whether it still holds something (hold and wait) or nothing
      }  // closes the lock case
    } else if (a.op === 'work') {  // a work line uses some resources for one tick
      const idle = [...S.held[p]].filter((r) => !a.res.includes(r));  // idle: the resources p holds that this line does not use
      S.idle += idle.length; S.pc[p]++;  // adds them to the idle counter and moves p to its next line
      msg.push(`P${p} ${a.say}` + (idle.length ? `, while ${rnames(idle)} sits idle in its hands.` : '.'));  // narration: what p does, and which held resources sit idle meanwhile
    } else {  // otherwise this is the unlock line at the end of the program
      const gave = [...S.held[p]];  // gave remembers what p holds, for the narration
      labRelease(S, p); S.pc[p]++; S.st[p] = 'done';  // p gives everything back, moves past the line and is finished
      msg.push(`P${p} finishes and gives back ${rnames(gave)}.`);  // narration: p finishes and gives its resources back
      msg.push(...labWake(S));  // the freed resources may wake the other process
    }  // closes the if/else on the kind of line
    [1, 2].forEach((x) => { if (S.st[x] === 'blocked') S.blocked++; });  // counts one blocked tick for every process that is blocked after this step
    if (S.st[1] === 'blocked' && S.st[2] === 'blocked') S.dead = true;  // both blocked at once means neither can ever move again: that is a deadlock
    return msg;  // returns the narration sentences for this step
  }  // closes labStep
  // labCount(rule): try EVERY possible order of steps under a rule and count how many end in deadlock
  function labCount(rule) {  // start of labCount, a search through every possible order of moves
    const copy = (S) => ({ ...S, pc: { ...S.pc }, held: { 1: new Set(S.held[1]), 2: new Set(S.held[2]) }, owner: { ...S.owner }, st: { ...S.st }, want: { 1: [...S.want[1]], 2: [...S.want[2]] } });  // copy(S): makes an independent copy of a lab state, so one branch of the search cannot disturb another
    let total = 0, dead = 0;  // total counts the orders explored to the end; dead counts the ones that ended in deadlock
    const walk = (S) => {  // walk(S): explores every next move from state S, calling itself again for each one (recursion)
      const run = [1, 2].filter((p) => S.st[p] === 'ready');  // run: the processes that are ready to take a step
      if (S.dead || !run.length || S.tick > 40) { total++; if (S.dead) dead++; return; }  // an order ends at deadlock, when nobody can move, or after 40 ticks; it is counted, deadlocks separately
      run.forEach((p) => { const T = copy(S); labStep(T, p); walk(T); });  // otherwise each ready process takes the next step on its own copy, and the search goes on from there
    };  // closes walk
    walk(labNew(rule));  // starts the search from a fresh lab under the chosen rule
    return { total, dead };  // returns how many orders there were and how many of them deadlocked
  }  // closes labCount
  // labAlt(rule): P1 and P2 take turns; a blocked or finished process's turn passes to the other one
  function labAlt(rule) {  // start of labAlt, the fixed alternating schedule used for the comparison table
    const S = labNew(rule), order = [];  // S is a fresh lab; order records which process moved at each step
    let turn = 1;  // P1 has the first turn
    while (!S.dead && S.tick < 60) {  // keeps going until a deadlock, with 60 ticks as a safety limit
      let p = turn;  // p is the process whose turn it is
      if (S.st[p] !== 'ready') p = 3 - p;  // if that process is blocked or finished, the other one moves instead
      if (S.st[p] !== 'ready') break;  // if neither can move, the run is over
      labStep(S, p); order.push(p); turn = 3 - p;  // runs one line of p, records it, and hands the turn to the other process
    }  // closes the loop
    return { S, order };  // returns the final lab state and the order of moves
  }  // closes labAlt

  /* ---- tables for the study notes, computed by the same engines the steps run ---- */
  function holdNotesTable() {  // holdNotesTable(): builds the notes table for step 3 from real runs of simHold, so the numbers always match
    const row = (lab, pol) => {  // row(lab, pol): runs the simulator under one rule and turns the result into one table row
      const r = simHold(pol);  // runs the whole step 3 workload under this rule
      let wait = 0, idle = 0, hw = null;  // counters for the row: ticks spent waiting, ticks a resource sat held but unused, and the first hold and wait seen
      r.ticks.forEach((k) => {  // looks at every tick of the run
        Object.entries(k.row).forEach(([id, x]) => { if (x.st === 'wait') { wait++; if (x.held.length && hw == null) hw = `P${id}, tick ${k.t}`; } });  // counts each waiting process, and notes the first time a waiting process was also holding something (hold and wait)
        Object.values(k.res).forEach((x) => { if (x.owner != null && !x.used) idle++; });  // counts each resource that someone owns but is not using this tick
      });  // closes the loop over ticks
      return `<tr><td>${lab}</td><td>${r.finish[1] - 1}</td><td>${r.finish[2] - 1}</td><td>${r.finish[3] - 1}</td><td>${wait}</td><td>${idle}</td><td>${hw ? 'yes (' + hw + ')' : 'never'}</td></tr>`;  // builds the row: rule name, the last tick each process ran (finish minus one), the two counters, and the hold-and-wait result
    };  // closes row
    return '<table><tr><th>Rule</th><th>P1 done</th><th>P2 done</th><th>P3 done</th><th>Ticks waiting</th><th>Held but idle</th><th>Hold and wait?</th></tr>'  // the table's header row: rule, when each process finished, ticks waiting, ticks held but idle, whether hold and wait happened
      + row('No rule', 'none') + row('All at once', 'all') + row('Release first', 'free') + '</table>';  // one row each for no rule, all at once and release first, then the closing tag of the table
  }  // closes holdNotesTable
  function labNotesTable() {  // labNotesTable(): builds the notes table for the step 7 rule lab from the same engine the lab runs on
    const RL = [['No rule', 'none', 'nothing'], ['All at once', 'all', 'hold and wait'], ['Give back when refused', 'back', 'no preemption'], ['Numbered order', 'order', 'circular wait']];  // RL: the four rules: the label shown, the key into LAB, and the condition each one rules out
    return '<table><tr><th>Rule</th><th>Rules out</th><th>Orders that deadlock</th><th>Alternating turns</th><th>Blocked</th><th>Idle</th><th>Given back</th></tr>'  // header row: rule, what it rules out, how many orders deadlock, the alternating run, and its three counters
      + RL.map(([lab, k, out]) => { const S = labAlt(k).S, C = labCount(k); return `<tr><td>${lab}</td><td>${out}</td><td>${C.dead} of ${C.total}</td><td>${S.dead ? `deadlock at tick ${S.tick}` : `both finish after ${S.tick} ticks`}</td><td>${S.blocked}</td><td>${S.idle}</td><td>${S.gaveBack}</td></tr>`; }).join('') + '</table>';  // for each rule, runs the alternating schedule and the search of every order, then fills one row with the results
  }  // closes labNotesTable

  Guide.section({  // registers this section with the guide; the object below holds everything section 6.2 shows
    id: '6.2',  // the section number, used in links, the side menu and saved progress
    title: 'Deadlock Prevention',  // the full title shown at the top of every step
    short: 'Prevention',  // the short name used in the side menu and progress list
    summary: 'Design deadlock out in advance: rule out one of the four conditions, and see what each choice costs.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Explain how deadlock prevention works by ruling out one of the four deadlock conditions, and tell the indirect methods from the direct method.',  // objective 1: how prevention works, and indirect versus direct methods
      'Explain why mutual exclusion usually cannot be given up, and recognise resources that can safely be shared.',  // objective 2: why mutual exclusion usually stays, and which resources can be shared
      'Describe the all-at-once rule for hold and wait and the two ways to remove no preemption, with the price of each.',  // objective 3: the all-at-once rule and the two ways to remove no preemption, with their costs
      'Apply a numbered resource ordering to a set of programs and explain why it makes a circular wait impossible.',  // objective 4: applying a resource numbering and explaining why it stops circular wait
      'Compare the prevention rules by what they cost: idle resources, longer waits, redone work and extra effort for programmers.',  // objective 5: comparing the rules by what each one costs
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Deadlock prevention', 'Designing the system in advance so that one of the four deadlock conditions can never hold. With one condition gone, deadlock cannot happen at all, whatever the timing.'],  // glossary entry: deadlock prevention
      ['Indirect method', 'A prevention method that rules out one of the first three conditions (mutual exclusion, hold and wait, or no preemption). It removes what a circular wait needs in order to freeze the system, instead of forbidding the circle itself.'],  // glossary entry: indirect method (rules out one of the first three conditions)
      ['Direct method', 'The prevention method that rules out the fourth condition, the circular wait itself, usually by numbering the resource types.'],  // glossary entry: direct method (rules out circular wait itself)
      ['Mutual exclusion', 'The rule that only one process at a time may use a resource; any other process that asks for it must wait. It is the first of the four deadlock conditions.'],  // glossary entry: mutual exclusion, the first deadlock condition
      ['Hold and wait', 'The deadlock condition in which a process keeps the resources it already holds while it waits for more.'],  // glossary entry: hold and wait
      ['No preemption', 'The deadlock condition in which a resource cannot be taken away from the process holding it; it is released only when the holder chooses to give it up.'],  // glossary entry: no preemption
      ['Circular wait', 'A closed chain of processes in which each one holds at least one resource that the next one in the chain is waiting for.'],  // glossary entry: circular wait
      ['Shareable resource', 'A resource that many processes can use at the same moment without harm, such as a read-only file. Nobody ever waits for it, so it can never be part of a deadlock.'],  // glossary entry: shareable resource
      ['Non-shareable resource', 'A resource that only one process may use at a time, such as a printer or a record that is being updated. Letting two processes use it at once would corrupt the work.'],  // glossary entry: non-shareable resource
      ['All-at-once request', 'A rule that removes hold and wait: a process asks for every resource it will need in one request and is blocked, holding nothing, until the whole set can be granted together.'],  // glossary entry: all-at-once request
      ['Preemption', 'Taking a resource away from the process that holds it before that process is finished with it, and giving it back later.'],  // glossary entry: preemption
      ['Preemptible resource', 'A resource whose state can be saved and restored later, such as the processor (save its registers) or a page of memory (copy it to disk), so it can be taken away without ruining the work.'],  // glossary entry: preemptible resource
      ['Priority', 'A ranking given to each process. When two processes compete, the one with the higher priority is served first, and a lower-priority process gives way to it.'],  // glossary entry: priority
      ['Resource ordering', 'A rule that removes circular wait: every resource type gets a number, and a process that holds a resource may afterwards request only resources with higher numbers.'],  // glossary entry: resource ordering
      ['Resource utilization', 'The share of time a resource spends doing useful work, rather than sitting idle or being held by a process that is not using it.'],  // glossary entry: resource utilization
    ],  // closes the terms list
    css: ` /* styles that belong to this section only; each rule starts with .sec-6-2 so it cannot change any other section */
      .sec-6-2 .tok { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; height: 24px; padding: 0 7px; border-radius: 999px; border: 2px solid; font-weight: 800; font-size: 13.5px; line-height: 1; vertical-align: 1px; } /* .tok: the process pill: a rounded, bold, outlined label sized to sit inside a line of text */
      .sec-6-2 .tok.p1 { color: var(--proc); background: var(--proc-bg); border-color: var(--proc); } /* P1's pill uses the process teal for text and border, on its pale fill */
      .sec-6-2 .tok.p2 { color: var(--accent); background: var(--accent-bg); border-color: var(--accent); } /* P2's pill uses indigo */
      .sec-6-2 .tok.p3 { color: var(--thread); background: var(--thread-bg); border-color: var(--thread); } /* P3's pill uses pink */
      .sec-6-2 .vbox { border-radius: 12px; padding: 8px 12px; border: 1px solid var(--line); border-left: 5px solid var(--accent); background: var(--panel-2); font-size: 15px; line-height: 1.45; } /* .vbox: the verdict box: a soft panel with a thick coloured bar down its left edge */
      .sec-6-2 .vbox.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* .vbox.ok: green bar and fill for a good outcome */
      .sec-6-2 .vbox.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* .vbox.bad: red bar and fill for a deadlock or a broken result */
      .sec-6-2 .vbox.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* .vbox.warn: amber bar and fill for a result that works but has a cost */
      .sec-6-2 .vbox.info { border-left-color: var(--info); background: var(--info-bg); } /* .vbox.info: blue bar and fill for neutral instructions */
      .sec-6-2 .ctiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } /* .ctiles: lays the four condition tiles of step 1 out in two equal columns */
      .sec-6-2 .ctile { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 10px; row-gap: 2px; align-items: start; text-align: left; padding: 9px 12px; border-radius: 12px; border: 2px solid var(--bad); background: var(--bad-bg); color: var(--ink); font: inherit; cursor: pointer; transition: background .15s, border-color .15s; } /* .ctile: one condition tile, a red button with the number on the left and three lines of text beside it */
      .sec-6-2 .ctile:hover { filter: brightness(1.03); } /* a tile brightens slightly under the mouse to show it can be clicked */
      .sec-6-2 .ctile .cnum { grid-row: 1 / span 3; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--bad); color: var(--accent-ink); font-weight: 800; font-size: 15px; } /* .cnum: the round red number badge, spanning all three text rows on the left of the tile */
      .sec-6-2 .ctile .cname { font-weight: 800; font-size: 16px; line-height: 1.25; } /* .cname: the condition's name in bold */
      .sec-6-2 .ctile .cwhat { font-size: 13.5px; line-height: 1.35; color: var(--ink-2); } /* .cwhat: the one-line meaning of the condition, in smaller grey text */
      .sec-6-2 .ctile .cstate { font-size: 12.5px; font-weight: 800; color: var(--bad); letter-spacing: .03em; } /* .cstate: the small red status line saying the condition can still hold */
      .sec-6-2 .ctile.off { border-color: var(--ok); background: var(--ok-bg); } /* a ruled-out tile (.off) turns green */
      .sec-6-2 .ctile.off .cnum { background: var(--ok); } /* its number badge turns green too */
      .sec-6-2 .ctile.off .cname { text-decoration: line-through; text-decoration-thickness: 2px; } /* its name is struck through to show the condition is gone */
      .sec-6-2 .ctile.off .cstate { color: var(--ok); } /* its status line turns green */
      .sec-6-2 .cdetail { border: 1px dashed var(--line-2); border-radius: 12px; padding: 8px 12px; background: var(--panel); display: flex; flex-direction: column; gap: 6px; font-size: 14.5px; line-height: 1.4; } /* .cdetail: the dashed panel under the tiles that explains the rule and price of the clicked condition */
      .sec-6-2 .cdetail .dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; align-items: baseline; } /* .dl: lines the RULE and PRICE labels up in one column with their text in the next */
      .sec-6-2 .capv.ok b { color: var(--ok); } .sec-6-2 .capv.bad b { color: var(--bad); } .sec-6-2 .capv.warn b { color: var(--warn); } /* bold words in a caption or summary take the colour of its outcome: green, red or amber */
      .sec-6-2 .resbox { border: 2px solid var(--io); background: var(--io-bg); border-radius: 12px; padding: 5px 14px; text-align: center; min-width: 150px; line-height: 1.3; } /* .resbox: the orange box in step 2 that names the resource and who is using it */
      .sec-6-2 .resbox.two { box-shadow: 0 0 0 4px color-mix(in srgb, var(--warn) 35%, transparent); } /* .resbox.two: an amber glow ring around the resource when two processes use it at once */
      .sec-6-2 .mout { flex: 1; min-height: 150px; display: flex; flex-direction: column; justify-content: center; } /* .mout: the step 2 output area; it fills spare height and centres the page, file or record shown in it */
      .sec-6-2 .mout .row.pages { align-items: stretch; } /* keeps the two printed pages the same height when they sit side by side */
      .sec-6-2 .mout .row.pages > .paper { flex: 1 1 220px; min-width: 0; } /* each page grows to share the width but starts at 220px, so on a small screen they stack instead of squeezing */
      .sec-6-2 .doc { border: 1px solid var(--line-2); border-radius: 8px; padding: 10px 14px; background: var(--panel-2); font-size: 16px; line-height: 1.6; } /* .doc: the look of the read-only help file page in step 2 */
      .sec-6-2 .paper { border: 1px solid var(--line-2); border-radius: 4px; padding: 8px 14px; background: var(--panel); box-shadow: var(--shadow); min-height: 150px; font-family: var(--mono); font-size: 15px; line-height: 1.6; } /* .paper: a sheet of printer paper in step 2: white, lightly shadowed, set in a fixed-width font */
      .sec-6-2 .paper .ln { border-left: 4px solid; padding-left: 8px; white-space: pre; } /* .ln: one printed line, with a coloured bar showing which process sent it; pre keeps its spaces */
      .sec-6-2 .paper .ln.l1 { border-color: var(--proc); color: var(--proc); } /* lines sent by P1 are teal */
      .sec-6-2 .paper .ln.l2 { border-color: var(--accent); color: var(--accent); } /* lines sent by P2 are indigo */
      .sec-6-2 .acct { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 10px; } /* .acct: the account demo's row of three boxes: the record, then what P1 read and what P2 read */
      .sec-6-2 .cellx { border: 2px solid var(--line-2); border-radius: 10px; padding: 4px 10px; text-align: center; background: var(--panel-2); } /* .cellx: one value box in that row */
      .sec-6-2 .cellx.mem { border-color: var(--mem); background: var(--mem-bg); } /* .cellx.mem: the record itself, coloured memory green */
      .sec-6-2 .cellx .v { font-family: var(--mono); font-size: 24px; font-weight: 800; } /* .v: the large dollar amount inside each box */
      .sec-6-2 .sb-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 2px 8px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); font-size: 14.5px; line-height: 1.3; } /* .sb-row: one item in the step 2 sorting game: its text, then the two answer buttons */
      .sec-6-2 .sb-row.good { border-color: var(--ok); background: var(--ok-bg); } /* a correctly sorted item turns green */
      .sec-6-2 .sb-row.oops { border-color: var(--bad); background: var(--bad-bg); } /* a wrongly sorted item turns red */
      .sec-6-2 .progs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; line-height: 1.45; } /* .progs: the three programs of step 3 described side by side in equal columns */
      .sec-6-2 .ordrow { display: flex; align-items: center; gap: 8px; padding: 1px 4px 1px 8px; border: 2px solid var(--io); background: var(--io-bg); border-radius: 10px; font-size: 15.5px; } /* .ordrow: one device in the step 5 numbering list: orange, with its number, name and move buttons */
      .sec-6-2 .numchip { font-family: var(--mono); font-weight: 800; font-size: 13.5px; padding: 1px 7px; border-radius: 7px; background: var(--panel); border: 1px solid var(--line-2); } /* .numchip: the small #number tag next to a device or request */
      .sec-6-2 .numchip.bad { color: var(--bad); border-color: var(--bad); } /* a red number tag marks the request that breaks the rising order */
      .sec-6-2 .btn.arr { width: 30px; padding: 0; font-size: 16px; } /* .btn.arr: the small square up and down buttons that move a device in the numbering list */
      .sec-6-2 .pcard { border: 2px solid var(--line); border-radius: 12px; padding: 8px 10px; background: var(--panel); display: flex; flex-direction: column; gap: 4px; min-width: 0; } /* .pcard: one program's card in step 5, listing its requests in order */
      .sec-6-2 .pcard.good { border-color: var(--ok); } .sec-6-2 .pcard.oops { border-color: var(--bad); } /* a program card gets a green border when its order is legal, a red one when it breaks the rule */
      .sec-6-2 .reqrow { display: flex; align-items: center; gap: 6px; padding: 0 2px 0 8px; border-radius: 8px; background: var(--panel-2); font-size: 14.5px; font-weight: 650; } /* .reqrow: one request inside a program card: its position, the device and its number */
      .sec-6-2 .reqrow.bad { background: var(--bad-bg); } /* a request that goes down in number is shaded red */
      .sec-6-2 .rbtn { min-width: 46px; font-family: var(--mono); font-weight: 800; border-color: var(--io); color: var(--io); } /* .rbtn: the R1 to R8 resource buttons of the step 6 staircase, orange and in a fixed-width font */
      .sec-6-2 .rbtn.low { opacity: .55; border-style: dashed; } /* .rbtn.low: buttons for numbers not above the last one picked are faded and dashed, since the rule forbids them */
      .sec-6-2 .ineq { font-family: var(--mono); font-size: 20px; text-align: center; min-height: 30px; } /* .ineq: the line of numbers joined by less-than signs under the staircase */
      .sec-6-2 .ineq .no { color: var(--bad); } /* .no: the number and cross that break the chain of less-than signs are red */
      .sec-6-2 .proof li { margin: 4px 0; } /* .proof li: a little space between the numbered lines of the step 6 proof */
      .sec-6-2 .resname { display: inline-block; min-width: 92px; padding: 2px 10px; border: 2px solid var(--io); background: var(--io-bg); border-radius: 8px; font-weight: 700; font-size: 15px; } /* .resname: the orange name tag for each resource in the step 7 rule lab */
      .sec-6-2 pre.code { margin: 0; } /* removes the default space around the rule lab's code boxes so they sit snugly in their cards */
      .sec-6-2 .mrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 2px 8px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); line-height: 1.3; } /* .mrow: one item of the step 8 matching exercise: the rule on the left, the condition buttons on the right */
      .sec-6-2 .mrow.good { border-color: var(--ok); background: var(--ok-bg); } /* a correctly matched item turns green */
      .sec-6-2 .mrow.oops { border-color: var(--bad); background: var(--bad-bg); } /* a wrongly matched item turns red */
      .sec-6-2 .mbtns { display: grid; grid-template-columns: repeat(2, auto); gap: 4px; } /* .mbtns: the four condition buttons of each item, arranged two by two */
      .sec-6-2 .mbtns .btn.sm { height: 26px; font-size: 13px; padding: 0 8px; } /* makes those buttons a little shorter and smaller so the two-by-two block fits beside the text */
    `,  // end of the section's styles
    steps: [  // steps: the pages of this section, shown one at a time in this order
      /* ---------------- 1. Big picture: four conditions, rule out one ---------------- */
      {  // opens step 1
        title: 'Break one condition and deadlock cannot happen',  // step 1 title
        kind: 'story',  // kind 'story' puts the label "Big Picture" above the title
        render(el, ctx) {  // render(el, ctx): draws step 1 into el, the step's empty page area, when the student opens it
          const { h } = ctx;  // takes the h helper (it builds HTML elements) out of ctx for short use below
          // the four conditions, each with the prevention rule that removes it, the kind of method and its price
          const CONDS = [  // CONDS: the four deadlock conditions, in order
            { name: 'Mutual exclusion', what: 'Only one process at a time may use the resource.',  // condition 1, mutual exclusion: its name and what it means
              rule: 'Let processes share the resource.', type: 'Indirect', where: 'step 2',  // its rule (share the resource), an indirect method covered in step 2
              price: 'Usually impossible: a printer, or a record being updated, really must be used by one process at a time.' },  // its price: usually it cannot be dropped at all
            { name: 'Hold and wait', what: 'A process keeps what it holds while it waits for more.',  // condition 2, hold and wait: its name and meaning
              rule: 'Ask for everything at once, or give everything back before asking again.', type: 'Indirect', where: 'step 3',  // its rule (ask for everything at once, or give everything back first), indirect, covered in step 3
              price: 'Resources sit held but unused, processes wait longer, and every process must know its needs in advance.' },  // its price: idle resources, longer waits, and needs that must be known in advance
            { name: 'No preemption', what: 'Nobody can take a resource away from its holder.',  // condition 3, no preemption: its name and meaning
              rule: 'Refused? Give back what you hold. Or let the OS take a resource from a lower-priority holder.', type: 'Indirect', where: 'step 4',  // its rules (give back when refused, or take from a lower-priority holder), indirect, covered in step 4
              price: 'Works only for resources whose state can be saved and restored, and some work may have to be redone.' },  // its price: it needs resources whose state can be saved, and some work may be redone
            { name: 'Circular wait', what: 'A closed chain: each process waits for a resource the next one holds.',  // condition 4, circular wait: its name and meaning
              rule: 'Number the resource types and request them only in rising order.', type: 'Direct', where: 'steps 5 to 7',  // its rule (number the types, ask only in rising order), the direct method, covered in steps 5 to 7
              price: 'Programs must request in number order instead of their natural order, so some resources are grabbed early and held longer.' },  // its price: programs request in number order, so some resources are taken early and held longer
          ];  // closes CONDS
          const off = new Set();   // numbers (1-4) of the conditions the student has ruled out
          let last = null;         // the condition clicked most recently; its details are shown
          const tiles = CONDS.map((c, k) => h('button', { type: 'button', class: 'ctile', 'aria-pressed': 'false', onclick: () => toggle(k + 1) },  // tiles: one button per condition; a click toggles it, and aria-pressed tells screen readers whether it is switched off
            h('span', { class: 'cnum' }, String(k + 1)),  // the round number badge of the tile
            h('span', { class: 'cname' }, c.name),  // the condition's name
            h('span', { class: 'cwhat' }, c.what),  // its one-line meaning
            h('span', { class: 'cstate' })));  // an empty status line that paint() fills in; closes the tile and the list of tiles
          const status = verdict(ctx);  // status: the verdict box saying whether deadlock is still possible
          const detail = h('div', { class: 'cdetail' });  // detail: the panel that explains the condition clicked most recently
          function toggle(n) { if (off.has(n)) off.delete(n); else off.add(n); last = n; paint(); }  // toggle(n): switches condition n off or back on, remembers it as the last one clicked, and redraws
          function paint() {  // paint(): brings the tiles, the verdict and the detail panel up to date; it runs after every click
            tiles.forEach((b, k) => {  // goes through the four tiles
              const isOff = off.has(k + 1);  // isOff: whether this condition has been ruled out
              b.classList.toggle('off', isOff);  // adds or removes the green "off" style
              b.setAttribute('aria-pressed', String(isOff));  // tells screen readers whether the tile is pressed
              b.lastChild.textContent = isOff ? '✗ ruled out' : '✓ can hold';  // the tile's status line reads "ruled out" or "can hold"
            });  // closes the loop over the tiles
            const gone = [...off].sort();  // gone: the numbers of the ruled-out conditions, in increasing order
            if (!gone.length) status.say('bad', '<b>All four conditions can hold together, so a deadlock is possible.</b> Click any one condition to rule it out.');  // none ruled out: a red verdict, deadlock is possible
            else if (gone.length === 1) status.say('ok', `<b>Condition ${gone[0]} can never hold, so deadlock is impossible.</b> One is enough: a deadlock needs all four at once.`);  // exactly one ruled out: a green verdict, deadlock is impossible
            else status.say('ok', `<b>Conditions ${gone.join(', ')} can never hold.</b> Deadlock is impossible, but ruling out just one would already have been enough.`);  // several ruled out: green, with a reminder that one alone would have been enough
            if (!last) { detail.innerHTML = '<div class="xs b muted">HOW EACH ONE IS RULED OUT</div><div class="small muted">Click a condition to see the rule that removes it, which kind of method that is, and what it costs.</div>'; return; }  // before the first click, the detail panel shows a heading and a hint, and paint stops here
            const c = CONDS[last - 1];  // c: the condition clicked most recently
            detail.innerHTML = `<div class="row gap-s"><b>Rule out ${c.name.toLowerCase()}</b><span class="chip ${c.type === 'Direct' ? 'accent' : 'os'}">${c.type} method</span><span class="grow"></span><span class="xs muted">more in ${c.where}</span></div>`  // detail heading: the condition, a chip saying direct or indirect method, and which step covers it
              + `<div class="dl"><span class="xs b muted">RULE</span><span>${c.rule}</span><span class="xs b muted">PRICE</span><span>${c.price}</span></div>`;  // the RULE and PRICE lines for that condition
          }  // closes paint
          paint();  // draws everything once when the step opens
          el.append(h('div', { class: 'split fill' },  // builds the page: a two-column layout, text on one side and the clickable tiles on the other
            h('div', { class: 'stack' },  // left column: the explanation, stacked
              h('p', { class: 'lead m0', html: 'A <span class="t">deadlock</span> can only happen when four conditions hold at the same time. <span class="t">Deadlock prevention</span> makes sure that at least one of them never can.' }),  // lead paragraph: what deadlock prevention is
              h('p', { class: 'm0', html: 'It is a design decision, made before anything runs. The system follows a rule that keeps one condition switched off for every process, all the time, so no schedule, however unlucky, can produce a deadlock.' }),  // paragraph: prevention is a design decision made before anything runs
              h('p', { class: 'm0', html: 'An <span class="t">indirect method</span> rules out one of the first three conditions, removing what a circular wait needs in order to freeze the system. The <span class="t">direct method</span> rules out the fourth, the <span class="t">circular wait</span> itself.' }),  // paragraph: indirect methods versus the direct method
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A fire needs fuel, heat, oxygen and the chain reaction that keeps it burning. Firefighters do not remove all four: foam that cuts off the oxygen is enough. Prevention treats the four deadlock conditions the same way.' }),  // analogy callout: a fire is put out by removing just one of the things it needs
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'COMING UP:'),  // a "coming up" row that previews the next steps
                ...['share it?', 'ask for everything at once', 'take it back', 'number the resources', 'try to break each rule'].map((t) => h('span', { class: 'chip accent' }, t)))),  // the five topic chips, one for each later step
            h('div', { class: 'card stack gap-s' },  // right column: the card that holds the clickable tiles
              h('h3', { class: 'm0' }, 'Click a condition to rule it out'),  // the card's heading tells the student what to do
              h('div', { class: 'ctiles', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : null }, ...tiles),  // the tile grid; on a small screen it becomes a single column
              status, detail,  // the verdict box and the detail panel sit under the tiles
              h('div', { class: 'grow' }),  // an empty spacer that pushes the last paragraph to the bottom of the card
              h('p', { class: 'small muted m0', html: '<b>Compare:</b> the next two sections rule out no condition in advance. <b>Avoidance</b> (6.3) checks each request as it is made; <b>detection</b> (6.4) lets deadlocks happen, then finds and breaks them. Prevention acts earlier than both: at design time.' }))));  // comparison note: how avoidance and detection, the next two sections, differ from prevention
        },  // closes render for step 1
      },  // closes step 1

      /* ---------------- 2. Mutual exclusion: usually not negotiable ---------------- */
      {  // opens step 2
        title: 'Mutual exclusion: the condition you cannot drop',  // step 2 title
        kind: 'explore',  // kind 'explore' puts the label "Explore" above the title
        render(el, ctx) {  // render(el, ctx): draws step 2 when the student opens it
          const { h } = ctx;  // takes h out of ctx
          const { start: START, dep: DEP, wd: WD } = ACCT;    // the account record: opening balance, P1's deposit, P2's withdrawal
          const L1 = ['Dear Ms. Ortiz,', 'Order 5521 has shipped.', 'It arrives on Friday.'];   // P1's letter, one entry per printed line
          const L2 = ['QUIZ 3 ANSWER KEY', '1. b     2. d', '3. a     4. c'];                // P2's answer key
          const PAGE = 'To reset your password, open Settings.';                            // page 3 of the read-only help file
          // output panels: each returns the HTML for the box under the processes
          const fileOut = (got) => `<div class="doc"><div class="xs b muted">help.txt · page 3 · read-only</div><div class="mono">${PAGE}</div></div>`  // fileOut(got): the help-file page, then a line per process saying whether it has the correct text yet
            + `<div class="row gap-s mt">${[1, 2].map((p) => `<span class="small">${TOK(p)} ${got.includes(p) ? 'got: <b style="color:var(--ok)">the correct text ✓</b>' : '<span class="muted">has not read yet</span>'}</span>`).join('<span class="grow"></span>')}</div>`;  // per process: a green "the correct text" once it has read, otherwise "has not read yet"
          const page = (lines, label) => `<div class="paper"><div class="xs muted">${label}</div>${lines.map(([p, t]) => `<div class="ln l${p}">${t}</div>`).join('') || '<div class="xs muted">(blank)</div>'}</div>`;  // page(lines, label): a sheet of printer paper with each printed line in its sender's colour, or "(blank)"
          const acctOut = (bal, r1, r2, note) => `<div class="acct"><div class="cellx mem"><div class="xs b">RECORD: BALANCE</div><div class="v">$${bal}</div></div>`  // acctOut(bal, r1, r2, note): the account record's balance box first
            + `<div class="cellx"><div class="xs b">P1 READ</div><div class="v">${r1 == null ? '–' : '$' + r1}</div></div><div class="cellx"><div class="xs b">P2 READ</div><div class="v">${r2 == null ? '–' : '$' + r2}</div></div></div>`  // then the value P1 read and the value P2 read (a dash until each one reads)
            + `<div class="small muted mt">${note}</div>`;  // then a note line under the boxes, which shows the correct result
          // frames(res, mode): every frame of the demo for one resource and one policy, computed from the data above
          function frames(res, mode) {  // start of frames, which builds the animation for the chosen resource and policy
            const F = (s1, s2, users, out, cap, cls) => ({ s1, s2, users, out, cap, cls });  // F(...): packs one frame: each process's status, who uses the resource, the output, the caption and its colour
            if (res === 'file' && mode === 'share') return [  // read-only file, shared: three frames
              F('opens the file', 'opens the file', [1, 2], fileOut([]), '<b>Share it.</b> P1 and P2 open the read-only help file at the same moment. Neither waits for the other.'),  // frame 1: both processes open the file at the same moment
              F('reads page 3', 'reads page 3', [1, 2], fileOut([1, 2]), 'Both read page 3 at once and both get exactly the right text. Reading changes nothing, so there is nothing to protect.'),  // frame 2: both read page 3 at once and both get the right text
              F('done', 'done', [], fileOut([1, 2]), '<b>No harm and no waiting.</b> A <span class="t">shareable resource</span> never makes a process wait, so it can never be part of a deadlock.', 'ok')];  // frame 3: done, with no harm and no waiting (shown green)
            if (res === 'file') return [  // read-only file, one at a time: three frames
              F('reads page 3', 'waits', [1], fileOut([1]), '<b>One at a time.</b> P1 opens the file first. P2 must wait, even though it only wants to read.'),  // frame 1: P1 opens the file first, and P2 must wait even though it only wants to read
              F('done', 'reads page 3', [2], fileOut([1, 2]), 'P1 finishes. Only now may P2 read the very same, unchanged page.'),  // frame 2: P1 is done; only now may P2 read the very same, unchanged page
              F('done', 'done', [], fileOut([1, 2]), '<b>Correct, but P2 waited for nothing.</b> For a shareable resource, mutual exclusion only adds waiting, and waiting is what deadlocks are built from.', 'warn')];  // frame 3: correct, but P2 waited for nothing (shown amber)
            if (res === 'prn' && mode === 'share') {  // printer, shared: the lines of the two jobs end up mixed on one page
              const order = [[1, L1[0]], [2, L2[0]], [1, L1[1]], [2, L2[1]], [1, L1[2]], [2, L2[2]]];   // lines arrive alternately
              const out = [F('sends a letter', 'sends a key', [1, 2], page([], 'page 1'), '<b>Share it.</b> P1 sends a letter and P2 sends an answer key to the printer at the same time. The printer prints each line as it arrives.')];  // out starts with frame 1: both processes send their jobs to the printer at the same time
              order.forEach(([p, t], k) => out.push(F(p === 1 ? 'sends a line' : 'sends a letter', p === 2 ? 'sends a line' : 'sends a key', [1, 2], page(order.slice(0, k + 1), 'page 1'),  // adds one frame per printed line; the sender's status says "sends a line" while the other keeps its job label
                `Line ${k + 1}: ${TOK(p)} sends <i>${t}</i>${k ? `, and it lands right under ${TOK(3 - p)}’s line` : ''}.`)));  // that frame's caption names the line and its sender, and from the second line on says it lands under the other's line
              out.push(F('ruined', 'ruined', [], page(order, 'page 1'), '<b>One page, two jobs, both ruined.</b> A printer is a <span class="t">non-shareable resource</span>: it must finish one job before it starts the next.', 'bad'));  // last frame: one page, two ruined jobs, because a printer is non-shareable (shown red)
              return out;  // hands back the printer-sharing frames
            }  // closes the shared-printer case
            if (res === 'prn') {  // printer, one at a time: four frames
              const p1 = L1.map((t) => [1, t]), p2 = L2.map((t) => [2, t]);  // p1 and p2: each job's lines, tagged with the process that sends them
              return [  // returns the list of frames below
                F('prints', 'waits', [1], page([], 'page 1'), '<b>One at a time.</b> P1 gets the printer first. P2 asks for it too and must wait.'),  // frame 1: P1 gets the printer and P2 must wait
                F('prints', 'waits', [1], page(p1, 'page 1'), 'P1 prints its whole letter on its own page.'),  // frame 2: P1 prints its whole letter on its own page
                F('done', 'prints', [2], `<div class="row pages">${page(p1, 'page 1')}${page(p2, 'page 2')}</div>`, 'P1 releases the printer. P2 gets it and prints its key on a fresh page.'),  // frame 3: P1 releases the printer and P2 prints on a fresh page; the two pages are shown side by side
                F('done', 'done', [], `<div class="row pages">${page(p1, 'page 1')}${page(p2, 'page 2')}</div>`, '<b>Two clean pages.</b> P2 had to wait, but for a printer there is no way around that: <span class="t">mutual exclusion</span> must stay.', 'ok')];  // frame 4: two clean pages; for a printer, mutual exclusion must stay (shown green)
            }  // closes the one-at-a-time printer case
            const right = START + DEP - WD;  // right: the correct final balance, opening balance plus the deposit minus the withdrawal
            const goal = `Correct result: $${START} + $${DEP} − $${WD} = <b>$${right}</b>.`;  // goal: the note under the account boxes that shows the correct sum
            if (mode === 'share') return [  // account record, shared: six frames that end in a lost update
              F('will add $' + DEP, 'will take $' + WD, [], acctOut(START, null, null, goal), `<b>Share it.</b> The record holds $${START}. P1 will add $${DEP} and P2 will take out $${WD}, both at the same time.`),  // frame 1: the record holds the opening balance, and both processes are about to change it
              F('reads', 'about to read', [1], acctOut(START, START, null, goal), `P1 reads the balance: $${START}.`),  // frame 2: P1 reads the balance
              F('computing', 'reads', [1, 2], acctOut(START, START, START, goal), `Sharing is allowed, so P2 reads it too, before P1 has written anything: also $${START}.`),  // frame 3: P2 reads the same balance before P1 has written anything
              F('writes', 'computing', [1, 2], acctOut(START + DEP, START, START, goal), `P1 writes $${START} + $${DEP} = $${START + DEP}.`),  // frame 4: P1 writes the balance plus its deposit
              F('done', 'writes', [2], acctOut(START - WD, START, START, goal), `P2 writes $${START} − $${WD} = $${START - WD}, right over P1’s update.`),  // frame 5: P2 writes the old balance minus its withdrawal, right over P1's update
              F('done', 'done', [], acctOut(START - WD, START, START, goal), `<b>Final balance $${START - WD}, not $${right}.</b> P1’s deposit vanished: a lost update, the <span class="t">race condition</span> of chapter 5. A record being updated needs one process at a time.`, 'bad')];  // frame 6: the deposit has vanished, a race condition (shown red)
            return [  // account record, one at a time: four frames
              F('locks it', 'waits', [1], acctOut(START, null, null, goal), '<b>One at a time.</b> P1 locks the record first. P2 asks too and must wait.'),  // frame 1: P1 locks the record and P2 must wait
              F('done', 'waits', [1], acctOut(START + DEP, START, null, goal), `P1 reads $${START}, writes $${START + DEP} and unlocks.`),  // frame 2: P1 reads, writes the new balance and unlocks
              F('done', 'done', [2], acctOut(right, START, START + DEP, goal), `P2 now gets the record, reads $${START + DEP} and writes $${START + DEP} − $${WD} = $${right}.`),  // frame 3: P2 gets the record, reads P1's result and writes the correct balance
              F('done', 'done', [], acctOut(right, START, START + DEP, goal), `<b>Final balance $${right}: correct.</b> The price was a short wait for P2. Exclusive access is what makes the answer right.`, 'ok')];  // frame 4: the result is correct, and the price was a short wait (shown green)
          }  // closes frames
          let res = 'file', mode = 'share', FR = frames(res, mode);  // the chosen resource and policy (shared read-only file at first) and the frames built for them
          const stat = { 1: h('span', { class: 'chip' }), 2: h('span', { class: 'chip' }) };  // stat: the status chip beside each process (prints, waits, done...)
          const rbox = h('div', { class: 'resbox' });  // rbox: the box between the two processes that names the resource and who is using it
          const outBox = h('div', { class: 'mout' });  // outBox: the output area under them (the help-file page, the printed paper or the account record)
          const NAMES = { file: 'Help file', prn: 'Printer', rec: 'Account record' };  // NAMES: the heading the resource box shows for each resource
          function draw(i) {  // draw(i): shows frame i; the player calls it and puts the text it returns into the caption
            const f = FR[i];  // f: the frame to show
            [1, 2].forEach((p) => { const s = p === 1 ? f.s1 : f.s2; stat[p].textContent = s; stat[p].className = 'chip ' + (s === 'waits' ? 'warn' : s === 'ruined' ? 'bad' : s === 'done' ? 'ok' : 'proc'); });  // sets each process's chip text and colour: amber for waits, red for ruined, green for done, teal otherwise
            rbox.innerHTML = `<div class="b">${NAMES[res]}</div><div class="xs muted">${f.users.length ? 'in use by ' + f.users.map((p) => 'P' + p).join(' and ') : 'not in use'}</div>`;  // the resource box: the resource name and who is using it now, or "not in use"
            rbox.className = 'resbox' + (f.users.length > 1 ? ' two' : '');  // adds the amber glow ring when two processes use it at once
            outBox.innerHTML = f.out;  // puts the frame's output into the output area
            return f.cls ? `<span class="capv ${f.cls}">${f.cap}</span>` : f.cap;  // returns the caption, wrapped so its bold words take the outcome colour when the frame has one
          }  // closes draw
          const player = ctx.ui.player({ count: FR.length, render: draw, interval: 1700 });  // player: the animation controls (restart, back, play, next); while playing it moves on every 1.7 seconds
          const reload = () => { FR = frames(res, mode); player.setCount(FR.length); };  // reload(): rebuilds the frames after a switch changes and gives the player the new frame count, which restarts it
          const segR = ctx.ui.seg([{ value: 'file', label: 'Read-only file' }, { value: 'prn', label: 'Printer' }, { value: 'rec', label: 'Account record' }], res, (v) => { res = v; reload(); });  // segR: the switch that picks the resource: read-only file, printer or account record
          const segM = ctx.ui.seg([{ value: 'share', label: 'Share it' }, { value: 'one', label: 'One at a time' }], mode, (v) => { mode = v; reload(); });  // segM: the switch that picks the policy: share it, or one at a time
          const demo = h('div', { class: 'stack gap-s fill' },  // demo: the whole animated demo for the first tab, stacked top to bottom
            h('div', { class: 'row gap-s' }, segR, segM),  // the two switches side by side
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // a row spread across the full width
              h('div', { class: 'row gap-s' }, h('span', { html: TOK(1) }), stat[1]), rbox, h('div', { class: 'row gap-s' }, stat[2], h('span', { html: TOK(2) }))),  // P1's pill and status on the left, the resource box in the middle, P2's status and pill on the right
            outBox, player.el);  // then the output area and the player controls
          el.append(h('div', { class: 'split l fill' },  // builds the page: text on the left, a card with two tabs on the right
            h('div', { class: 'stack' },  // left column, stacked
              h('p', { class: 'lead m0' }, 'The first condition is the hardest to remove, and usually you should not even try.'),  // lead sentence: mutual exclusion is the hardest condition to remove
              h('p', { class: 'm0', html: 'Some resources are <span class="t" data-t="shareable resource">shareable</span>: any number of processes can use them at once. A read-only file, or a database record that everyone is only reading, never makes anyone wait, so it can never take part in a deadlock.' }),  // paragraph: shareable resources never make anyone wait (data-t links the word to its glossary term)
              h('p', { class: 'm0', html: 'Others are not. If a resource needs exclusive access, like a printer or a record being updated, the OS <b>must</b> hand it to one process at a time. So prevention cannot, in general, switch <span class="t">mutual exclusion</span> off.' }),  // paragraph: a resource that needs exclusive access must go to one process at a time
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '“Just let everyone share it” does not cure deadlock. It trades a frozen system for scrambled output or lost updates, which is worse.' }),  // common-mistake callout: sharing anyway trades a frozen system for scrambled output
              h('div', { class: 'callout tip m0 small', 'data-label': 'What you can do', html: 'Keep mutual exclusion only where it is truly needed. Data that is only read can be shared, and a resource nobody waits for can never be in a deadlock.' })),  // tip callout: keep mutual exclusion only where it is truly needed
            h('div', { class: 'card white tight', style: { display: 'flex', flexDirection: 'column', minHeight: 0 } },  // right column: a card that stretches to fill the height
              ctx.ui.tabs([  // ctx.ui.tabs: a row of two tabs inside the card
                { label: 'What if two processes share it?', render: (p) => { p.append(demo); player.refresh(); return () => player.stop(); } },  // tab 1: shows the demo, redraws its current frame, and stops playback when the student leaves the tab
                { label: 'Sort the resources', render: (p) => p.append(sorter()) },  // tab 2: shows the sorting game built by sorter()
              ]))));  // closes the tabs, the card and the page layout
          // sorter(): the "shareable or one at a time?" mini-game in the second tab (its score survives tab switches)
          const ITEMS = [  // ITEMS: the sorting game, each item as [text, right answer (0 shareable, 1 one at a time), explanation]
            ['A read-only dictionary file used by a spell checker', 0, 'Reading never changes it, so any number of processes can read it at once.'],  // item: a read-only dictionary file (shareable)
            ['A printer', 1, 'Two jobs at once would mix their lines on the same page.'],  // item: a printer (one at a time)
            ['A database record that several reports are only reading', 0, 'Readers do not change the record, so they can share it safely.'],  // item: a record that reports only read (shareable)
            ['A database record that a process is updating', 1, 'Two updates at once can lose one of them: a lost update.'],  // item: a record being updated (one at a time)
            ['The machine code of a shared library', 0, 'Code that nobody writes to can be shared by every process that runs it.'],  // item: a shared library's machine code (shareable)
            ['A DVD burner in the middle of writing a disc', 1, 'Two processes writing one disc at once would leave garbage on it.'],  // item: a DVD burner writing a disc (one at a time)
            ['A shared counter that processes add 1 to', 1, '<code>count = count + 1</code> from two processes at once is the classic race condition.'],  // item: a shared counter that processes add to (one at a time, the classic race condition)
            ['A web page cached on disk that processes only read', 0, 'Read-only data again: sharing it is safe.'],  // item: a cached web page that is only read (shareable)
          ];  // closes ITEMS
          const got = ITEMS.map(() => null);   // got[k]: true/false once item k has been answered, null before
          const pick = ITEMS.map(() => null);  // pick[k]: the bucket the student chose for item k (0 shareable, 1 one at a time)
          function sorter() {  // sorter(): builds the sorting game; it runs each time the tab opens, but the answers above are kept between visits
            const score = h('span', { class: 'chip' });  // score: the chip that shows how many items are sorted correctly
            const say = verdict(ctx);  // say: the verdict box that explains each answer
            const rows = ITEMS.map(([txt], k) => {  // rows: one row per item
              const mk = (lab, v, col) => h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(--${col})`, color: `var(--${col})` }, onclick: () => choose(k, v) }, lab);  // mk(...): makes one answer button outlined in its colour (green for shareable, orange for one at a time)
              return h('div', { class: 'sb-row' }, h('span', { html: txt }), mk('Shareable', 0, 'ok'), mk('One at a time', 1, 'io'));  // the row itself: the item's text, then the Shareable and One at a time buttons
            });  // closes rows
            function paintRows() {  // paintRows(): repaints the rows and the score after every answer
              rows.forEach((r, k) => { r.className = 'sb-row' + (got[k] === true ? ' good' : got[k] === false ? ' oops' : ''); r.querySelectorAll('.btn').forEach((b, j) => b.classList.toggle('on', pick[k] === j)); });  // colours each row green or red by its answer, and highlights the button the student picked
              const right = got.filter((g) => g === true).length;  // right: how many items are sorted correctly
              score.className = 'chip ' + (right === ITEMS.length ? 'ok' : 'accent');  // the score chip turns green when every item is right
              score.textContent = `${right} / ${ITEMS.length} sorted correctly`;  // the score text, such as "5 / 8 sorted correctly"
            }  // closes paintRows
            function choose(k, v) {  // choose(k, v): runs when the student puts item k in bucket v
              const [, ans, why] = ITEMS[k];  // ans and why: the right bucket for this item and its explanation
              got[k] = v === ans; pick[k] = v;  // records whether the answer is right and which bucket was picked
              paintRows();  // repaints the rows and the score
              if (got.every((g) => g === true)) say.say('ok', '<b>All sorted.</b> Data that is only read can be shared; anything that is written or produces output needs one process at a time.');  // once every item is right, a green message sums up which resources can be shared
              else say.say(got[k] ? 'ok' : 'bad', `<b>${got[k] ? 'Right' : 'Not quite'}: ${ans ? 'one at a time' : 'shareable'}.</b> ${why}`);  // otherwise the box says right or not quite, names the correct bucket, and explains why
            }  // closes choose
            paintRows();  // paints the rows once, so answers given on an earlier visit to this tab show again
            say.say('info', 'Can several processes use it at the same moment without harm? Only resources that need one process at a time can ever be part of a deadlock.');  // starting hint in the verdict box: the question to ask about each item
            return h('div', { class: 'stack gap-s' }, h('div', { class: 'row' }, h('b', { class: 'small' }, 'Shareable, or one process at a time?'), h('span', { class: 'grow' }), score), ...rows, say);  // returns the game: a heading row with the score chip at the right, the item rows, then the verdict box
          }  // closes sorter
        },  // closes render for step 2
      },  // closes step 2

      /* ---------------- 3. Hold and wait: the all-at-once rule and its price ---------------- */
      {  // opens step 3
        title: 'Hold and wait: ask for everything at once',  // step 3 title
        kind: 'lab',  // kind 'lab' puts the label "Hands-on Lab" above the title
        render(el, ctx) {  // render(el, ctx): draws step 3 when the student opens it
          const { h, s } = ctx;  // takes h (builds HTML elements) and s (builds SVG drawing elements) out of ctx
          const RUNS = { none: simHold('none'), all: simHold('all'), free: simHold('free') };   // all three runs, computed once
          const TMAX = Math.max(...Object.values(RUNS).map((r) => r.T));  // TMAX: the length of the longest run, so all three charts share one time scale
          const list = (rs) => rs.map((r) => HW_NAME[r]).join(' and ');  // list(rs): names resources in words, such as "the disk and the printer"
          const up = (x) => x.charAt(0).toUpperCase() + x.slice(1);  // up(x): capitalises the first letter, so a list of names can start a sentence
          const isAre = (rs) => (rs.length > 1 ? 'are' : 'is');  // isAre(rs): picks "are" for two resources and "is" for one, so the sentences read correctly
          let pol = 'none';  // pol: the rule now shown, 'none' (no rule) at first
          // narration for one tick of the current run, built from that tick's events
          function tickText(k) {  // tickText(k): builds the caption for one tick record k from that tick's events
            const out = [], granted = new Set();  // out collects sentences; granted remembers who got resources this tick, so the same news is not said twice
            k.ev.forEach((e) => {  // goes through the tick's events in order
              const P = TOK(e.p);  // P: the coloured pill for the process in this event
              if (e.type === 'grant') {  // a grant event: the process got what it asked for
                granted.add(e.p);  // remembers that this process was granted resources this tick
                if (e.afterWait) out.push(`${up(list(e.res))} ${isAre(e.res)} free at last: ${P} gets ${e.res.length > 1 ? 'them' : 'it'}.`);  // after a wait: the resources are free at last and the process gets them
                else out.push(`${P} asks for ${list(e.res)}${e.res.length > 1 ? ' in one request: both free' : ': free'}, granted.` + (e.unused.length ? ` It will not use ${list(e.unused)} for a while, but holds it from now on.` : ''));  // a fresh grant: what it asked for and that it was free, plus a warning when it now holds something it will not use yet
              } else if (e.type === 'wait') {  // a wait event: the request could not be granted
                const holders = e.busy.map((r, j) => `${TOK(e.by[j])} holds ${HW_NAME[r]}`).join(' and ');  // holders: who holds each busy resource, in words
                if (e.again && e.partFree.length) out.push(`${up(list(e.partFree))} is free now, but ${P} needs ${list(e.want)} together and may not take part of its set, so it keeps waiting.`);  // all or nothing: part of the set is free now, but the process may not take only part, so it keeps waiting
                else if (e.held.length) out.push(`${P} needs ${list(e.busy)} too, but ${TOK(e.by[0])} has it. ${P} waits <b>while still holding ${list(e.held)}</b>: hold and wait.`);  // it waits while still holding something: the narration names hold and wait in bold
                else out.push(`${P} asks for ${list(e.want)}${e.want.length > 1 ? ' in one request' : ''}, but ${holders}, so ${P} waits, holding nothing.`);  // otherwise it waits holding nothing, and the sentence says who holds what it wants
              } else if (e.type === 'phase') {  // a phase event: the process starts a new part of its work
                if (!e.what.startsWith('computes')) { if (!granted.has(e.p) || e.idle.length === 0) out.push(`${P} ${e.what}.`); }  // a part that uses resources is described, unless the grant sentence has already said what it holds idle
                else out.push(e.idle.length ? `${P} computes, still holding ${list(e.idle)}, which ${isAre(e.idle) === 'are' ? 'sit' : 'sits'} idle.` : `${P} computes, holding nothing.`);  // a computing part also says which held resources sit idle meanwhile, if any
              } else if (e.type === 'release') {  // a release event: the process gives some resources back
                out.push(pol === 'free' ? `${P} finishes that part and must give back ${list(e.res)} before it may ask for anything else.` : `${P} is done with ${list(e.res)} and releases it.`);  // under release first it must give everything back before asking again; otherwise it releases what it no longer needs
              } else if (e.type === 'done') out.push(`${P} finishes${e.res.length ? ' and releases ' + list(e.res) : ''}.`);  // a done event: the process finishes and releases whatever it still held
            });  // closes the loop over events
            if (!out.length) {  // a quiet tick with no events still gets a sentence
              const runs = Object.entries(k.row).filter(([, x]) => x.st === 'run').map(([id, x]) => `${TOK(+id)} ${x.what}`);  // runs: each running process and what it is doing
              const idle = Object.entries(k.res).filter(([, x]) => x.owner != null && !x.used).map(([r, x]) => `${HW_NAME[r]} (held by ${TOK(x.owner)}) sits idle`);  // idle: each resource that is held but not used, and who holds it
              const waits = Object.entries(k.row).filter(([, x]) => x.st === 'wait').map(([id]) => TOK(+id));  // waits: the processes still waiting
              out.push(runs.join('; ') + '.' + (idle.length ? ' ' + up(idle.join('; ')) + '.' : '') + (waits.length ? ` ${waits.join(' and ')} ${waits.length > 1 ? 'wait' : 'waits'}.` : ''));  // joins them into one sentence: who runs, what sits idle, who waits
            }  // closes the quiet-tick case
            return `<b>Tick ${k.t}.</b> ${out.join(' ')}`;  // returns the caption: the tick number in bold, then the sentences
          }  // closes tickText
          // tallies over the first n ticks of a run: waiting ticks, held-but-idle ticks, first hold-and-wait
          function tally(run, n) {  // start of tally, which feeds the live numbers under the chart
            let wait = 0, idle = 0, hw = null;  // wait, idle and hw (the first tick with hold and wait) all start empty
            run.ticks.slice(0, n).forEach((k) => {  // looks at the first n ticks only, so the numbers match what the chart shows so far
              Object.values(k.row).forEach((x) => { if (x.st === 'wait') { wait++; if (x.held.length && hw == null) hw = k.t; } });  // counts waiting process-ticks, and notes the first tick in which a waiting process holds something
              Object.values(k.res).forEach((x) => { if (x.owner != null && !x.used) idle++; });  // counts resource-ticks in which a resource is held but not used
            });  // closes the loop over ticks
            return { wait, idle, hw };  // returns the three tallies
          }  // closes tally
          const INTRO = {  // INTRO: the first caption for each rule, which explains the rule before the run starts
            none: '<b>No rule.</b> Each process asks for a resource when it reaches the part that needs it, one at a time, and keeps anything it will need again later. Press <b>Play</b> or step forward.',  // intro for no rule: ask when a part needs it, one at a time, and keep what you will need again
            all: '<b>All at once.</b> Each process asks for every resource it will ever need in its very first request, and waits, holding nothing, until the whole set is free.',  // intro for all at once: ask for everything in the first request and wait holding nothing
            free: '<b>Release first.</b> A process may ask for resources only while it holds none, so at the end of each part of its work it gives everything back, then asks again.',  // intro for release first: ask only while holding nothing, giving everything back after each part
          };  // closes INTRO
          function summary() {  // summary(): the last caption of a run, which compares it with the run under no rule
            const r = RUNS[pol], base = RUNS.none, m = tally(r, r.T);  // r: the run now shown; base: the no-rule run to compare with; m: its tallies over the whole run
            if (pol === 'none') return `<b>Summary.</b> All three finished after tick ${r.T - 1}, but ${TOK(1)} held the disk while it waited for the printer (tick ${m.hw}). One more process holding the printer and waiting for the disk would have closed a deadlock.`;  // no rule: everyone finished, but P1 held the disk while waiting for the printer, one step away from deadlock
            if (pol === 'all') return `<span class="capv warn"><b>Summary: no hold and wait, so no deadlock.</b></span> The price: resources sat held but idle for ${m.idle} ticks (no rule: ${tally(base, base.T).idle}), and ${TOK(2)} finished after tick ${r.finish[2] - 1} instead of tick ${base.finish[2] - 1}.`;  // all at once: no deadlock, but resources sat idle and P2 finished later than with no rule
            return `<span class="capv warn"><b>Summary: no hold and wait here either.</b></span> But ${TOK(1)} had to give the disk back, lost it to ${TOK(3)} and finished after tick ${r.finish[1] - 1} instead of tick ${base.finish[1] - 1}. If others kept grabbing its resources, P1 could lose that race again and again: starvation.`;  // release first: no hold and wait either, but P1 lost the disk to P3 and finished later; repeated, that is starvation
          }  // closes summary
          // ---- the chart: one row per process (what it does each tick), one per resource (who holds it).
          // On a small screen the chart gets its own slim geometry with one- or two-letter cell labels.
          const slim = ctx.narrow, W = slim ? 360 : 640;  // slim is true on a small screen; W is the drawing's width in drawing units
          const X0 = slim ? 52 : 66, CW = (W - 6 - X0) / TMAX, RY = { 1: 22, 2: 52, 3: 82, disk: 122, prn: 152 }, RH = 25;  // X0: where the tick columns begin, after the labels; CW: column width; RY: the top of each row; RH: row height
          const svg = s('svg', { viewBox: `0 0 ${W} ${slim ? 234 : 212}`, width: '100%', role: 'img', 'aria-label': 'Timeline of the three processes and the two resources' });  // svg: the chart's drawing; it fills the width, and its label describes it to screen readers
          const SCL = { 1: 's-proc', 2: 's-accent', 3: 's-thread' };  // SCL: the drawing style (colour) of each process's bars
          const LAB = slim ? { disk: 'D', prn: 'P', both: 'DP', calc: 'c', wait: 'w' } : { disk: 'disk', prn: 'prn', both: 'd+p', calc: 'calc', wait: 'wait' };  // LAB: the words written inside the bars; on a small screen just a letter or two
          function drawChart(n) {  // drawChart(n): redraws the chart with the first n ticks of the current run
            const run = RUNS[pol], kids = [];  // run: the run now shown; kids collects every shape to draw
            kids.push(s('defs', {}, s('pattern', { id: 'hw62hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },  // defines a pattern of red diagonal stripes, used to mark a resource that is held but idle
              s('line', { x1: 0, y1: 0, x2: 0, y2: 7, style: 'stroke:var(--bad);stroke-width:3;stroke-opacity:.6' }))));  // the stripe itself: one red line that the pattern repeats and tilts; closes the definitions
            kids.push(s('text', { x: 4, y: 14, 'font-size': 13, class: 's-sub' }, 'tick'));  // the word "tick" above the row labels
            for (let t = 0; t < TMAX; t++) kids.push(s('text', { x: X0 + t * CW + CW / 2, y: 14, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t)));  // the tick numbers along the top, one per column
            [['P1', 1], ['P2', 2], ['P3', 3], [slim ? 'Disk' : 'Disk', 'disk'], [slim ? 'Prn' : 'Printer', 'prn']].forEach(([lab, key]) => kids.push(s('text', { x: 4, y: RY[key] + 17, 'font-size': 14, 'font-weight': 700 }, lab)));  // the row labels down the left: P1, P2, P3, then Disk and Printer (Prn on a small screen)
            kids.push(s('line', { x1: 0, y1: 114, x2: W, y2: 114, class: 's-line', 'stroke-dasharray': '3 4', 'stroke-opacity': 0.5 }));  // a dashed line separating the process rows from the resource rows
            run.ticks.slice(0, n).forEach((k) => {  // draws every tick shown so far
              const x = X0 + k.t * CW + 1.5, w = CW - 3;  // x and w: the left edge and width of this tick's cells, leaving a small gap between columns
              [1, 2, 3].forEach((id) => {  // first the three process rows
                const c = k.row[id];  // c: what this process did in this tick
                if (c.st === 'run') kids.push(s('rect', { x, y: RY[id], width: w, height: RH, rx: 4, class: SCL[id], 'stroke-width': 1.5 }),  // running: a bar in the process's colour
                  s('text', { x: x + w / 2, y: RY[id] + 17, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, c.uses.length === 2 ? LAB.both : c.uses.length ? LAB[c.uses[0]] : LAB.calc));  // labelled with what it is using: disk, printer, both, or calc for computing
                else if (c.st === 'wait') kids.push(s('rect', { x, y: RY[id], width: w, height: RH, rx: 4, class: 's-warn', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }),  // waiting: a dashed amber bar
                  s('text', { x: x + w / 2, y: RY[id] + 17, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--warn)' }, LAB.wait));  // labelled "wait" in amber
              });  // closes the process rows
              ['disk', 'prn'].forEach((r) => {  // then the two resource rows
                const c = k.res[r];  // c: who holds this resource in this tick
                if (c.owner == null) return;  // a free resource leaves its cell empty
                kids.push(s('rect', { x, y: RY[r], width: w, height: RH, rx: 4, class: SCL[c.owner], 'stroke-width': 1.5 }));  // a held resource gets a bar in its holder's colour
                if (!c.used) kids.push(s('rect', { x, y: RY[r], width: w, height: RH, rx: 4, fill: 'url(#hw62hatch)', style: 'stroke:none' }));  // if the holder is not using it, red stripes go on top: held but idle
                kids.push(s('text', { x: x + w / 2, y: RY[r] + 17, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, slim ? String(c.owner) : 'P' + c.owner));  // the holder's number is written inside the bar (P1, or just 1 on a small screen)
              });  // closes the resource rows
            });  // closes the loop over ticks
            if (n > 0 && n <= run.T) kids.push(s('line', { x1: X0 + n * CW, y1: 18, x2: X0 + n * CW, y2: 180, class: 's-line', 'stroke-width': 2, style: 'stroke:var(--chc)' }));  // a vertical line in the chapter colour marks how far the run has got
            // legend: one row on a wide screen, two rows on a small one
            const L2 = slim ? [X0 - 48, 0] : [X0 + 220, 0], L3 = slim ? [X0 - 48, 21] : [X0 + 360, 0];  // L2 and L3: where the second and third legend groups go (beside the first on a wide screen, under it on a small one)
            const lg = (x, dy, el, lab) => [el, s('text', { x: x + 26, y: 203 + dy, 'font-size': 13, class: 's-sub' }, lab)];  // lg(...): one legend entry: a sample shape with its label just to the right
            const sw = (x, dy, o) => s('rect', Object.assign({ x, y: 191 + dy, width: 20, height: 15, rx: 3, 'stroke-width': 1.5 }, o));  // sw(...): one small sample rectangle for the legend, styled by o
            kids.push(...lg(slim ? X0 + 60 : X0, 0, sw(slim ? X0 + 60 : X0, 0, { class: 's-proc' }), slim ? 'runs' : 'runs, using…'),  // legend entry "runs": a sample in the process colour
              ...lg(slim ? X0 + 140 : X0 + 130, 0, sw(slim ? X0 + 140 : X0 + 130, 0, { class: 's-warn', 'stroke-dasharray': '4 3' }), 'waits'),  // legend entry "waits": a dashed amber sample
              sw(L2[0], L2[1], { class: 's-panel' }),  // the base of the "held but idle" sample, a plain neutral box
              ...lg(L2[0], L2[1], sw(L2[0], L2[1], { fill: 'url(#hw62hatch)', style: 'stroke:none' }), 'held but idle'),  // red stripes over that box, labelled "held but idle"
              s('text', { x: L3[0] + (slim ? 0 : 0), y: 203 + L3[1], 'font-size': 13, class: 's-sub' }, slim ? 'D disk, P printer, c computing, w waits' : 'calc = computing, d+p = both'));  // a key to the short labels in the cells (letters on a small screen, calc and d+p on a wide one)
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one go
          }  // closes drawChart
          // ---- live numbers under the chart, always computed from the ticks drawn so far
          const metrics = h('div', { class: 'row gap-s' });  // metrics: the row of number chips under the chart
          function paintMetrics(n) {  // paintMetrics(n): refreshes the chips for the first n ticks
            const run = RUNS[pol], m = tally(run, n);  // run: the run now shown; m: its tallies so far
            metrics.replaceChildren(  // replaces all the chips at once
              ...[1, 2, 3].map((id) => { const f = run.finish[id]; const fin = f != null && f <= n; return h('span', { class: 'chip ' + (fin ? 'ok' : '') }, `P${id} ${fin ? 'done after tick ' + (f - 1) : 'not done'}`); }),  // one chip per process: green "done after tick ..." once it has finished within the ticks shown, else "not done"
              h('span', { class: 'chip ' + (m.wait ? 'warn' : '') }, `waiting: ${m.wait} tick${m.wait === 1 ? '' : 's'}`),  // a chip counting ticks spent waiting, amber if there were any
              h('span', { class: 'chip ' + (m.idle ? 'bad' : 'ok') }, `held but idle: ${m.idle}`),  // a chip counting held-but-idle ticks, red if there were any
              h('span', { class: 'chip ' + (m.hw == null ? 'ok' : 'bad') }, m.hw == null ? 'hold and wait: never' : `hold and wait in tick ${m.hw}`));  // a chip saying whether hold and wait has happened yet, and in which tick
          }  // closes paintMetrics
          const player = ctx.ui.player({  // player: the animation controls for the run
            count: RUNS[pol].T + 2, interval: 1500,  // one frame for the intro, one per tick and one for the summary; it moves on every 1.5 seconds while playing
            render(i) {  // render(i): draws frame i and returns its caption
              const run = RUNS[pol], n = Math.min(i, run.T);  // n: how many ticks to show (frame i shows i ticks, never more than the run has)
              drawChart(n); paintMetrics(n);  // redraws the chart and the chips
              return i === 0 ? INTRO[pol] : i <= run.T ? tickText(run.ticks[i - 1]) : summary();  // caption: the rule's intro on the first frame, the tick's narration in between, the summary at the end
            },  // closes render
          });  // closes the player settings
          const seg = ctx.ui.seg([{ value: 'none', label: 'No rule' }, { value: 'all', label: 'All at once' }, { value: 'free', label: 'Release first' }], pol, (v) => { pol = v; player.setCount(RUNS[pol].T + 2); });  // seg: the switch for the three rules; picking one restarts the player with that run's frame count
          const progs = h('div', { class: 'progs' }, ...HW_PROCS.map((p) => h('div', { class: 'small', html: `${TOK(p.id)} <span class="muted">arrives in tick ${p.arrive}</span><br>`  // progs: the three programs side by side: each one's pill and arrival tick
            + p.phases.map((ph) => (ph.need.length === 2 ? 'disk + printer' : ph.need.length ? HW_NAME[ph.need[0]].slice(4) : 'compute') + ' ' + ph.dur).join(' → ') })));  // then its parts written as resource and length, such as "disk 3 → compute 2 → disk + printer 2"
          el.append(h('div', { class: 'split l fill' },  // builds the page: text on the left, the simulator on the right
            h('div', { class: 'stack' },  // left column, stacked
              h('p', { class: 'lead m0', html: 'Rule: a process asks for <b>everything it will need in one request</b>, and is blocked until the whole set can be granted together.' }),  // lead sentence: the all-at-once rule
              h('p', { class: 'm0', html: 'Under this <span class="t">all-at-once request</span> rule, <span class="t">hold and wait</span> cannot happen. A process that holds nothing while it waits can never be part of a circular wait: nobody can be waiting for something it holds.' }),  // paragraph: why that rule removes hold and wait
              h('p', { class: 'm0', html: 'A milder variant: a process may ask for resources <b>only while it holds none</b>, so before it asks for more, it gives back everything it has.' }),  // paragraph: the milder variant, ask only while holding nothing
              h('div', { class: 'card tight' },  // a small card listing the price of the rule
                h('h4', { class: 'm0' }, 'The price'),  // the card's heading
                h('ul', { class: 'small m0', html: '<li><b>Long waits.</b> A process waits for its whole set, even when it could have started with part of it.</li>'  // price 1: long waits for the whole set
                  + '<li><b>Idle resources.</b> Resources stay allocated for long stretches without being used, which lowers <span class="t">resource utilization</span>.</li>'  // price 2: idle resources, which lower resource utilization
                  + '<li><b>Unknown needs.</b> A process may not know in advance all it will need; that can depend on its input.</li>'  // price 3: needs that are not known in advance
                  + '<li><b>Modular programs.</b> The needs of every module must be known and added up before the program starts.</li>' }))),  // price 4: a modular program must add up every module's needs; closes the left column
            h('div', { class: 'stack gap-s' },  // right column, stacked
              h('div', { class: 'row gap-s' }, seg, h('span', { class: 'xs muted' }, 'same three programs, three rules')),  // the rule switch, with a note that the programs stay the same
              h('div', { class: 'card white tight stack gap-s' }, progs, svg),  // a white card with the program descriptions above the chart
              metrics, player.el)));  // then the live number chips and the player controls; closes the page layout
        },  // closes render for step 3
      },  // closes step 3

      /* ---------------- 4. No preemption: two ways to take resources back ---------------- */
      {  // opens step 4
        title: 'No preemption: let resources be taken back',  // step 4 title
        kind: 'lab',  // kind 'lab' puts the label "Hands-on Lab" above the title
        render(el, ctx) {  // render(el, ctx): draws step 4 when the student opens it
          const { h, s } = ctx;  // takes h and s out of ctx
          let strat = 'a', kind = 'mem';  // strat: how preemption is allowed ('a' give back, 'b' take from the holder); kind: 'mem' memory buffers or 'prn' printers
          // frames(strat, kind): each frame says who holds A and B, who is asking for what, and the narration
          function frames(st, kd) {  // start of frames, which builds the step 4 animation for one strategy and one kind of resource
            const mem = kd === 'mem', N = mem ? 'buffer' : 'printer';  // mem: true for memory buffers; N: the word the captions use for the resources
            const half = 'P1’s page, half printed';  // half: what printer A shows while P1 is halfway through its page
            const F = (hold, req, s1, s2, cont, cap, cls, cost) => ({ hold, req, s1, s2, cont, cap, cls, cost: cost || {} });  // F(...): packs one frame: holders of A and B, request arrows, both statuses, contents, caption, its colour and the costs
            const c0 = { A: mem ? 'P1’s data' : half, B: mem ? 'P2’s data' : 'P2’s job' };  // c0: what A and B contain at the start
            const start = F({ A: 1, B: 2 }, [], 'working', 'working', c0,  // the first frame, shared by both strategies: P1 holds A and P2 holds B
              `<b>Start.</b> P1 holds ${N} A ${mem ? 'and has filled part of it' : 'and has printed half a page'}; P2 holds ${N} B. Each will soon need the other one’s ${N} as well.`);  // its caption: each will soon need the resource the other one holds
            if (st === 'a') return [start,  // strategy (a), give back when refused: six frames
              F({ A: 1, B: 2 }, [[1, 'B', 'bad']], 'asks for B', 'working', c0, `P1 asks for ${N} B. P2 holds it, so the request is <b>refused</b>. Without a rule, P1 would now wait while holding A: hold and wait.`),  // frame 2: P1 asks for B and is refused (a red dashed arrow)
              F({ A: null, B: 2 }, [], 'gave back A', 'working', { A: mem ? 'free · P1’s data saved' : 'free', B: c0.B },  // frame 3: P1 gives back A; for memory, its data is first saved to disk
                mem ? `<b>Rule (a):</b> refused while holding something, P1 must give back <b>everything</b>. Buffer A is released, and its contents are copied to disk so P1’s work is not lost.`  // caption for memory: the buffer is released and its contents copied to disk
                  : `<b>Rule (a):</b> P1 must give back printer A. But half of its page is already on paper, and there is no way to save that and put it back. <b>The half page is wasted.</b>`, mem ? '' : 'bad', mem ? { saved: 1 } : { wasted: 1 }),  // caption for printers: the half-printed page cannot be saved, so it is wasted (red); the cost chips record it
              F({ A: 2, B: 2 }, [[1, 'A', 'wait'], [1, 'B', 'wait']], 'waits for A + B', 'has A and B', { A: 'P2’s', B: 'P2’s' },  // frame 4: P2 takes A, which is free now, while P1 waits for A and B together
                `P2 asks for ${N} A. It is free now, so P2 gets it at once. P1 waits for A and B together, <b>holding nothing</b>, so no chain of waiting can form.`, '', mem ? { saved: 1 } : { wasted: 1 }),  // its caption: P1 waits holding nothing, so no chain of waiting can form
              F({ A: null, B: null }, [[1, 'A', 'wait'], [1, 'B', 'wait']], 'waits for A + B', 'done', { A: 'free', B: 'free' }, 'P2 finishes its work and releases both.', '', mem ? { saved: 1 } : { wasted: 1 }),  // frame 5: P2 finishes and releases both
              F({ A: 1, B: 1 }, [], 'has A and B', 'done', { A: mem ? 'P1’s data, restored' : 'P1’s page, from the top', B: 'P1’s' },  // frame 6: P1 gets A and B together
                mem ? '<b>P1 gets A and B together.</b> Its saved data is copied back into A, and it carries on. The price: one save, one restore, and the time P1 spent waiting.'  // memory ending: the data is restored and P1 carries on, at the cost of a save, a restore and waiting
                  : '<b>P1 gets both printers and starts its page again from the top.</b> Deadlock was prevented, but the half page and the time it took were thrown away. That is why printers are not preempted in practice.', mem ? 'ok' : 'warn', mem ? { saved: 1, restored: 1 } : { wasted: 1 })];  // printer ending: P1 starts its page again and the half page is thrown away (amber); closes strategy (a)
            return [start,  // strategy (b), take it from a lower-priority holder: five frames
              F({ A: 1, B: 2 }, [[1, 'B', 'wait']], 'waits for B', 'working', c0, `P1 asks for ${N} B. Its holder P2 has the <b>higher priority</b>, so P1 may not take it. P1 waits, still holding A.`),  // frame 2: P1 asks for B, but P2 has the higher priority, so P1 waits, still holding A
              F({ A: 2, B: 2 }, [[1, 'A', 'wait'], [1, 'B', 'wait']], 'lost A, waits', 'took A', { A: mem ? 'P2’s · P1’s data saved' : 'P2’s job on P1’s page', B: 'P2’s' },  // frame 3: P2 asks for A, and the OS takes it away from P1
                mem ? `P2 asks for ${N} A, which P1 holds. P1 has the lower priority, so the OS <b>preempts</b> it: A’s contents are saved to disk and A is handed to P2.`  // caption for memory: A's contents are saved to disk and A goes to P2
                  : `P2 asks for printer A. P1 has the lower priority, so the OS takes A from it <b>mid-page</b>. P2’s output now prints right under P1’s half page, ruining it.`, mem ? '' : 'bad', mem ? { saved: 1 } : { wasted: 1 }),  // caption for printers: A is taken mid-page and P2's output ruins P1's half page (red)
              F({ A: null, B: null }, [[1, 'A', 'wait'], [1, 'B', 'wait']], 'waits for A + B', 'done', { A: 'free', B: 'free' }, 'P2 has both, finishes its work and releases A and B.', '', mem ? { saved: 1 } : { wasted: 1 }),  // frame 4: P2 finishes and releases both
              F({ A: 1, B: 1 }, [], 'has A and B', 'done', { A: mem ? 'P1’s data, restored' : 'P1’s page, from the top', B: 'P1’s' },  // frame 5: P1 gets both resources back
                mem ? '<b>P1 gets A back, with its data restored from disk, and B.</b> It continues where it left off. Taking A away broke the chain, and it was safe because memory can be saved and restored.'  // memory ending: the data comes back from disk, which was safe because memory can be saved and restored
                  : '<b>P1 gets the printers back and must print its page again from the start.</b> Deadlock was prevented, but the ruined page was wasted: a printer’s state cannot be saved and restored.', mem ? 'ok' : 'warn', mem ? { saved: 1, restored: 1 } : { wasted: 1 })];  // printer ending: the page is printed again and the ruined one was wasted (amber); closes strategy (b)
          }  // closes frames
          // ---- the picture: two processes, two resources, holding arrows (solid) and request arrows (dashed)
          // geometry: wide screens get a 640-unit drawing; a small screen gets a slimmer one so the text stays readable
          const slim = ctx.narrow;  // slim is true on a small screen
          const GM = slim ? { W: 360, H: 252, c1: 40, c2: 320, cy: 112, r: 28, BL: 96, BR: 264, ya: 8, yb: 164, bh: 56 }  // GM: the drawing's sizes on a small screen: width, height, circle centres, radius, box edges, box tops and box height
            : { W: 640, H: 280, c1: 95, c2: 545, cy: 130, r: 36, BL: 228, BR: 412, ya: 18, yb: 178, bh: 64 };  // the same sizes for a wide screen
          const svg = s('svg', { viewBox: `0 0 ${GM.W} ${GM.H}`, width: '100%', role: 'img', 'aria-label': 'Two processes and two resources with holding and request arrows' });  // svg: the picture; its label describes it to screen readers
          const BOX = { A: GM.ya, B: GM.yb };  // BOX: the top edge of resource A's box and of resource B's box
          const anchor = (p, r) => ({ px: p === 1 ? GM.c1 + GM.r * 0.85 : GM.c2 - GM.r * 0.85, py: GM.cy + (r === 'A' ? -0.55 : 0.55) * GM.r, rx: p === 1 ? GM.BL : GM.BR, ry: BOX[r] + GM.bh / 2 });  // anchor(p, r): where an arrow between process p and resource r meets the circle's edge and the box's side
          function draw(f) {  // draw(f): redraws the picture for frame f
            const mem = kind === 'mem', kids = [], BW = GM.BR - GM.BL, mid = (GM.BL + GM.BR) / 2;  // mem: whether the resources are memory; kids collects shapes; BW and mid: the boxes' width and centre line
            ['A', 'B'].forEach((r) => {  // draws both resources, A and B
              kids.push(s('rect', { x: GM.BL, y: BOX[r], width: BW, height: GM.bh, rx: 10, class: mem ? 's-mem' : 's-io', 'stroke-width': 2 }),  // a box coloured green for a memory buffer or orange for a printer
                s('text', { x: mid, y: BOX[r] + 23, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, (mem ? 'Buffer ' : 'Printer ') + r),  // the box's title: "Buffer A" or "Printer A" (or B)
                s('text', { x: mid, y: BOX[r] + 43, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, f.cont[r]));  // under the title, what the resource contains in this frame; closes the box shapes
              const o = f.hold[r];  // o: the process that holds this resource in this frame, if any
              if (o) { const a = anchor(o, r); kids.push(s('line', { x1: a.rx, y1: a.ry, x2: a.px, y2: a.py, class: 's-line', 'stroke-width': 3, style: `stroke:var(--${PCOL[o]})`, 'marker-end': `url(#arr-${PCOL[o]})` })); }  // a holder gets a solid arrow in its own colour, pointing from the resource to the process: "held by"
            });  // closes the loop over resources
            f.req.forEach(([p, r, c]) => { const a = anchor(p, r); kids.push(s('line', { x1: a.px, y1: a.py, x2: a.rx, y2: a.ry, class: 's-line', 'stroke-width': 2.5, 'stroke-dasharray': '7 5', style: `stroke:var(--${c === 'bad' ? 'bad' : 'warn'})`, 'marker-end': `url(#arr-${c === 'bad' ? 'bad' : 'warn'})` })); });  // each request becomes a dashed arrow from the process to the resource: red if refused, amber if waiting
            [1, 2].forEach((p) => {  // draws both processes
              const cx = p === 1 ? GM.c1 : GM.c2, cy = GM.cy;  // cx, cy: the centre of this process's circle (P1 on the left, P2 on the right)
              // status text: centred under the circle on a wide screen; pinned to the outer edge on a small one
              const tx = slim ? (p === 1 ? 2 : GM.W - 2) : cx, anc = slim ? (p === 1 ? 'start' : 'end') : 'middle';  // tx and anc: where the status text goes and which way it is aligned
              kids.push(s('circle', { cx, cy, r: GM.r, class: p === 1 ? 's-proc' : 's-accent', 'stroke-width': 2.5 }),  // the process circle, teal for P1 and indigo for P2
                s('text', { x: cx, y: cy + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800 }, 'P' + p),  // the process name inside the circle
                s('text', { x: tx, y: cy + GM.r + (slim ? 18 : 22), 'text-anchor': anc, 'font-size': slim ? 13 : 14, 'font-weight': 700 }, p === 1 ? f.s1 : f.s2));  // the process's status under the circle, such as "waits for B"
              if (strat === 'b') kids.push(s('text', { x: tx, y: cy + GM.r + (slim ? 36 : 41), 'text-anchor': anc, 'font-size': 13, class: 's-sub' }, p === 1 ? 'low priority' : 'high priority'));  // under strategy (b), a second line gives each process's priority
            });  // closes the loop over processes
            kids.push(s('text', { x: 4, y: GM.H - 6, 'font-size': 13, class: 's-sub' }, slim ? 'solid = holds · dashed = asks for' : 'solid arrow: holds · dashed arrow: asks for (red = refused)'));  // a key at the bottom: solid arrows mean holds, dashed arrows mean asks for
            svg.replaceChildren(...kids);  // swaps the new drawing in
          }  // closes draw
          const cost = h('div', { class: 'row gap-s' });  // cost: the row of chips that count the price of preemption
          let FR = frames(strat, kind);  // FR: the frames for the current strategy and resource
          const player = ctx.ui.player({  // player: the animation controls for step 4
            count: FR.length, interval: 2100,  // one frame per entry in FR; it moves on every 2.1 seconds while playing
            render(i) {  // render(i): draws frame i and returns its caption
              const f = FR[i], mem = kind === 'mem';  // f: the frame to show; mem: whether the resources are memory
              draw(f);  // redraws the picture
              cost.replaceChildren(h('span', { class: 'chip ' + (mem ? 'ok' : 'bad') }, mem ? 'state can be saved: yes' : 'state can be saved: no'),  // first chip: whether the resource's state can be saved (a green yes for memory, a red no for printers)
                ...(mem ? [h('span', { class: 'chip' }, `saved to disk: ${f.cost.saved || 0}`), h('span', { class: 'chip' }, `restored: ${f.cost.restored || 0}`)] : []),  // for memory, two more chips count the saves to disk and the restores so far
                h('span', { class: 'chip ' + (f.cost.wasted ? 'bad' : '') }, f.cost.wasted ? 'work thrown away: half a page' : 'work thrown away: none'));  // last chip: the work thrown away, half a page (red) or none
              return f.cls ? `<span class="capv ${f.cls}">${f.cap}</span>` : f.cap;  // returns the caption, wrapped so its bold words take the outcome colour
            },  // closes render
          });  // closes the player settings
          const reload = () => { FR = frames(strat, kind); player.setCount(FR.length); };  // reload(): rebuilds the frames after a switch changes and restarts the player with the new frame count
          const segS = ctx.ui.seg([{ value: 'a', label: '(a) Give back when refused' }, { value: 'b', label: '(b) Take from the holder' }], strat, (v) => { strat = v; reload(); });  // segS: the switch between strategy (a) and strategy (b)
          const segK = ctx.ui.seg([{ value: 'mem', label: 'Memory' }, { value: 'prn', label: 'Printers' }], kind, (v) => { kind = v; reload(); });  // segK: the switch between memory and printers
          el.append(h('div', { class: 'split l fill' },  // builds the page: text on the left, the animation on the right
            h('div', { class: 'stack' },  // left column, stacked
              h('p', { class: 'lead m0', html: 'If a resource can be taken back from its holder, a chain of waiting can be broken before it closes. Two ways to allow <span class="t">preemption</span>:' }),  // lead paragraph: taking resources back breaks a chain of waiting, and there are two ways to allow preemption
              h('div', { class: 'card tight small', html: '<b>(a) Give back when refused.</b> A process that holds resources and is refused a further request must release <b>everything</b> it holds. Later it asks again for all of it, plus the new one.' }),  // card describing way (a): give back everything when refused
              h('div', { class: 'card tight small', html: '<b>(b) Take it from the holder.</b> When a process asks for a resource another process holds, the OS may force the holder to release it. This needs a tie-breaker: it works only if no two processes have the same <span class="t">priority</span>, so the rule always knows who gives way. With equal priorities, two processes could keep snatching the same resource back and forth.' }),  // card describing way (b): the OS takes the resource, which needs distinct priorities as a tie-breaker
              h('div', { class: 'callout warn m0 small', 'data-label': 'Only for some resources', html: 'Preemption is practical only for a <span class="t">preemptible resource</span>, one whose state can be saved and restored later: the processor (save its registers) or memory (copy a page to disk). A printer halfway through a page cannot be un-printed.' })),  // warning callout: preemption suits only resources whose state can be saved and restored
            h('div', { class: 'stack gap-s' },  // right column, stacked
              h('div', { class: 'row gap-s' }, segS, segK),  // the two switches side by side
              h('div', { class: 'card white tight' }, svg),  // a white card holding the drawing
              cost, player.el)));  // then the cost chips and the player controls; closes the page layout
        },  // closes render for step 4
      },  // closes step 4

      /* ---------------- 5. Circular wait: the numbering game ---------------- */
      {  // opens step 5
        title: 'Circular wait: number the resources',  // step 5 title
        kind: 'lab',  // kind 'lab' puts the label "Hands-on Lab" above the title
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): draws step 5 when the student opens it
          const { h, s } = ctx;  // takes h and s out of ctx
          const RES0 = ORD_RES, PROGS = ORD_PROGS;   // starting numbers are index + 1
          let order, progs;  // order: the devices in their current number order; progs: each program's current request order (both set by reset)
          const num = (r) => order.indexOf(r) + 1;  // num(r): a device's current number (its place in the list, plus 1)
          const firstBad = (l) => { for (let i = 1; i < l.length; i++) if (num(l[i]) < num(l[i - 1])) return i; return -1; };  // firstBad(l): the place of the first request numbered lower than the one before it, or -1 if the numbers only rise
          // findCycle(): a set of programs that could each hold one resource while waiting for the next one's
          // (a program keeps every resource it has locked until it finishes, so any earlier lock counts as held)
          function findCycle() {  // start of findCycle, which searches for a circle of waiting among the programs as they are now
            const pairs = progs.map((l) => l.flatMap((x, i) => l.slice(i + 1).map((y) => [x, y])));  // pairs: for each program, every (held, wanted) pair: a device locked earlier and one it asks for later
            const perms = [];  // perms: the orders of programs to try as a chain
            [0, 1, 2].forEach((a) => [0, 1, 2].forEach((b) => { if (b === a) return; perms.push([a, b]); [0, 1, 2].forEach((c) => { if (c !== a && c !== b) perms.push([a, b, c]); }); }));  // fills perms with every ordered choice of two or three different programs
            for (const pm of perms) {  // tries each choice of programs in turn
              const walk = (k, ch) => {  // walk(k, ch): builds a chain link by link; ch holds the (held, wanted) pairs chosen so far
                if (k === pm.length) return ch[ch.length - 1][1] === ch[0][0] ? ch : null;  // once every chosen program has a link, the chain is a cycle if the last one wants what the first one holds
                for (const [x, y] of pairs[pm[k]]) {  // tries each (held, wanted) pair of the next program in the chain
                  if (k > 0 && x !== ch[k - 1][1]) continue;  // a link must hold exactly the device the previous program wants
                  if (ch.some((c) => c[0] === x)) continue;  // two programs cannot hold the same device, so a device already held in the chain is skipped
                  const r = walk(k + 1, [...ch, [x, y]]); if (r) return r;  // adds this link and carries on; a cycle found further along is passed straight back
                }  // closes the loop over pairs
                return null;  // no link fitted: this branch holds no cycle
              };  // closes walk
              const cyc = walk(0, []);  // starts an empty chain for this choice of programs
              if (cyc) return cyc.map(([hold, want], k) => ({ p: PROGS[pm[k]].id, hold, want }));  // on success, returns the cycle as a list of who holds which device and waits for which
            }  // closes the loop over choices
            return null;  // no circular wait is possible
          }  // closes findCycle
          // ---- left: the resource numbering, with up/down buttons
          const orderBox = h('div', { class: 'stack gap-s' });  // orderBox: the column of device rows, each with its number and up/down buttons
          const cards = h('div', { class: 'grid-3' });  // cards: the three program cards in three columns
          const arcs = s('svg', { viewBox: '0 0 720 132', width: '100%', role: 'img', 'aria-label': 'Each program’s requests drawn as arrows along the resource numbers' });  // arcs: the drawing of each program's requests as arrows along the device numbers
          const say = verdict(ctx);  // say: the verdict box
          const arrowBtn = (lab, dis, fn, aria) => h('button', { class: 'btn sm ghost arr', type: 'button', disabled: dis || null, 'aria-label': aria, onclick: fn }, lab);  // arrowBtn(lab, dis, fn, aria): a small up or down button, disabled at the end of a list; aria tells screen readers what it does
          function paint() {  // paint(): redraws the numbering, the cards, the arrows and the verdict after every change
            orderBox.replaceChildren(...order.map((r, i) => h('div', { class: 'ordrow' },  // rebuilds the device list in its current number order
              h('span', { class: 'numchip' }, '#' + (i + 1)), h('b', { class: 'grow' }, r),  // each row: its #number chip and the device name
              arrowBtn('↑', i === 0, () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; paint(); }, `Move ${r} up`),  // an up button that swaps the device with the one above it (disabled for the first)
              arrowBtn('↓', i === order.length - 1, () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; paint(); }, `Move ${r} down`))));  // a down button that swaps it with the one below (disabled for the last); closes the list
            cards.replaceChildren(...PROGS.map((p, k) => {  // rebuilds one card per program
              const l = progs[k], bad = firstBad(l);  // l: this program's current request order; bad: where it first breaks the rule
              const early = p.nat.map((r) => [r, p.nat.indexOf(r) - l.indexOf(r)]).filter(([, d]) => d > 0);  // early: devices now requested before the program naturally needs them, and by how many places
              return h('div', { class: 'pcard ' + (bad < 0 ? 'good' : 'oops') },  // the card itself, with a green border if its order is legal and a red one if not
                h('div', { class: 'row gap-s' }, h('span', { html: TOK(p.id) }), h('b', { class: 'small' }, p.job)),  // the card's top line: the program's pill and job name
                h('div', { class: 'xs muted' }, p.desc),  // a one-line description of what the job does
                ...l.map((r, i) => h('div', { class: 'reqrow' + (i === bad ? ' bad' : '') },  // one row per request, shaded red at the request that breaks the rule
                  h('span', { class: 'xs muted' }, (i + 1) + '.'), h('span', { class: 'grow' }, r), h('span', { class: 'numchip' + (i === bad ? ' bad' : '') }, '#' + num(r)),  // the row: its position, the device name and the device's #number
                  arrowBtn('↑', i === 0, () => { [l[i - 1], l[i]] = [l[i], l[i - 1]]; paint(); }, `P${p.id}: ask for ${r} earlier`),  // an up button that makes the program ask for this device one place earlier
                  arrowBtn('↓', i === l.length - 1, () => { [l[i + 1], l[i]] = [l[i], l[i + 1]]; paint(); }, `P${p.id}: ask for ${r} later`))),  // a down button that makes it ask one place later; closes the rows
                h('div', { class: 'xs b', style: { color: `var(--${bad < 0 ? 'ok' : 'bad'})` } }, bad < 0 ? '✓ numbers only go up: legal' : `✗ asks for #${num(l[bad])} while holding #${num(l[bad - 1])}`),  // the card's verdict line: green "numbers only go up", or red, naming the number asked for while a higher one is held
                early.length ? h('div', { class: 'xs', style: { color: 'var(--warn)' } }, early.map(([r, d]) => `grabs the ${r.toLowerCase()} ${d} step${d > 1 ? 's' : ''} earlier than it needs it`).join('; ')) : null);  // an amber note when the new order makes the program grab devices before it needs them; closes the card
            }));  // closes the cards
            drawArcs();  // redraws the arrows
            const cyc = findCycle(), breakers = PROGS.filter((p, k) => firstBad(progs[k]) >= 0);  // cyc: a possible circular wait, if any; breakers: the programs that break the rising order
            const moved = PROGS.filter((p, k) => progs[k].join() !== p.nat.join());  // moved: the programs whose request order is no longer their natural one
            const natural = !moved.length, renumbered = order.join() !== RES0.join();  // natural: no program has been moved; renumbered: the devices are no longer in their starting order
            if (cyc) say.say('bad', `<b>A circular wait can form.</b> ${cyc.map((c) => `${TOK(c.p)} holds the ${c.hold.toLowerCase()} and waits for the ${c.want.toLowerCase()}`).join('; ')}. Each waits for the next one: deadlock.`  // a cycle can form: a red verdict naming who holds what and waits for what
              + (natural && renumbered ? ' <i>Renumbering alone cannot fix this: the natural orders already go around in a loop, so some program must change its order.</i>' : ''));  // if only the numbers were changed, adds that renumbering alone cannot help, because the natural orders already loop
            else if (breakers.length) say.say('warn', `<b>No cycle among these three, but ${breakers.map((p) => 'P' + p.id).join(' and ')} ${breakers.length > 1 ? 'break' : 'breaks'} the order.</b> The guarantee needs <b>every</b> program to follow it: one more program could close a loop.`);  // no cycle among these three, but a program breaks the order: amber, because one more program could close a loop
            else say.say('ok', `<b>Every program asks in rising order, so a circular wait is impossible.</b> ` + (moved.length ? `The price: ${moved.map((p) => 'P' + p.id).join(' and ')} no longer ${moved.length > 1 ? 'ask' : 'asks'} in ${moved.length > 1 ? 'their' : 'its'} natural order, so some devices are held before they are needed.` : 'Every program kept its natural order.'));  // every program asks in rising order: green, plus the price paid by any program moved off its natural order
          }  // closes paint
          // drawArcs(): the devices in number order, and each program's consecutive requests as arrows between them.
          // Every program has its own lane: above the devices when the number goes up, below when it goes back down.
          function drawArcs() {  // start of drawArcs, which runs inside every paint
            const slim = ctx.narrow, W = slim ? 360 : 720, G = W / 4, BW = slim ? 86 : 128, SP = slim ? 10 : 16;  // slim on a small screen; W: drawing width; G: gap between device centres; BW: device box width; SP: lane offset per program
            const kids = [], X = (r) => G / 2 + (num(r) - 1) * G;  // kids collects the shapes; X(r): the horizontal centre of device r's box
            arcs.setAttribute('viewBox', `0 0 ${W} 132`);  // sets the drawing's coordinate box to the current width
            order.forEach((r, i) => kids.push(s('rect', { x: G / 2 + i * G - BW / 2, y: 50, width: BW, height: 36, rx: 8, class: 's-io', 'stroke-width': 2 }),  // one orange box per device, in number order
              s('text', { x: G / 2 + i * G, y: 73, 'text-anchor': 'middle', 'font-size': slim ? 13 : 14, 'font-weight': 700 }, `#${i + 1} ${r}`)));  // each box labelled with its number and name
            PROGS.forEach((p, k) => {  // then the arrows of each program
              const l = progs[k], col = PCOL[p.id];  // l: the program's requests in order; col: its colour
              for (let i = 1; i < l.length; i++) {  // one arrow for each pair of back-to-back requests
                const upw = num(l[i]) > num(l[i - 1]), c = upw ? col : 'bad', dir = upw ? 1 : -1;  // upw: whether the number goes up; an upward step uses the program's colour, a downward step red
                const a = X(l[i - 1]) + (k - 1) * SP + 4 * dir, b = X(l[i]) + (k - 1) * SP - 4 * dir;  // a and b: where the arrow starts and ends, shifted a little per program so arrows do not lie on top of each other
                const y0 = upw ? 50 : 86, lane = upw ? 38 - 12 * k : 98 + 12 * k;  // y0: the top or bottom edge of the boxes; lane: this program's own height above the boxes (up) or below them (down)
                kids.push(s('path', { d: `M ${a} ${y0} V ${lane} H ${b} V ${y0 + (upw ? -2 : 2)}`, fill: 'none', class: 's-line', 'stroke-width': 2.5, 'stroke-linejoin': 'round', style: `stroke:var(--${c})`, 'stroke-dasharray': upw ? null : '6 4', 'marker-end': `url(#arr-${c})` }),  // the arrow: out of one box, along the lane, into the next box; dashed when the number goes down
                  s('text', { x: b - 15 * Math.sign(b - a), y: lane + 4.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: `fill:var(--${c});paint-order:stroke;stroke:var(--panel);stroke-width:5px` }, 'P' + p.id));  // the program's name on the arrow near its end, with a halo so it stays readable over other lines
              }  // closes the loop over requests
            });  // closes the loop over programs
            arcs.replaceChildren(...kids);  // swaps the new drawing in
          }  // closes drawArcs
          function reset() { order = RES0.slice(); progs = PROGS.map((p) => p.nat.slice()); paint(); }  // reset(): restores the starting numbers and every program's natural order, then repaints
          reset();  // sets everything up when the step opens
          el.append(h('div', { class: 'split l3 fill' },  // builds the page: text and the numbering on the left, the cards and drawing on the right
            h('div', { class: 'stack' },  // left column, stacked
              h('p', { class: 'lead m0', html: 'Number every resource type. A process holding a resource may then ask only for <b>higher</b> numbers.' }),  // lead sentence: the numbering rule itself
              h('p', { class: 'm0 small', html: 'This <span class="t">resource ordering</span> is the <span class="t">direct method</span>: it attacks the <span class="t">circular wait</span> itself. Three programs share four devices, and as written, one of them breaks the rule.' }),  // paragraph: this is resource ordering, the direct method; as written, one program breaks the rule
              h('div', { class: 'card tight stack gap-s' }, h('h4', { class: 'm0' }, 'Resource numbers (top is #1)'), orderBox,  // a card with the device numbering list (top is #1)
                h('div', { class: 'row gap-s' },  // a row of two buttons
                  h('button', { class: 'btn sm primary', type: 'button', onclick: () => { progs = progs.map((l) => l.slice().sort((a, b) => num(a) - num(b))); paint(); } }, 'Sort every program by number'),  // "Sort every program by number": reorders each program's requests into rising number order
                  h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset'))),  // "Reset": goes back to the starting numbers and orders
              h('div', { class: 'callout tip m0 small', 'data-label': 'Your move', html: 'Renumber the devices or reorder requests until every program is legal. Can you manage it without moving any program off its natural order?' })),  // tip callout: the challenge, make every program legal, ideally without changing any natural order
            h('div', { class: 'stack gap-s' }, cards,  // right column: the program cards first
              h('div', { class: 'card white tight' }, h('div', { class: 'xs muted' }, 'Each program’s requests in order. Arrows above climb to a higher number (allowed); dashed arrows below go back down (not allowed).'), arcs),  // then a white card with a short key above the arrow drawing
              say)));  // then the verdict box; closes the page layout
        },  // closes render for step 5
      },  // closes step 5

      /* ---------------- 6. Why numbering makes a cycle impossible ---------------- */
      {  // opens step 6
        title: 'Why numbered requests can never close a loop',  // step 6 title
        kind: 'explore',  // kind 'explore' puts the label "Explore" above the title
        render(el, ctx) {  // render(el, ctx): draws step 6 when the student opens it
          const { h, s } = ctx;  // takes h and s out of ctx
          const MAXR = 8, MAXP = 4;   // resource types R1..R8, and at most four processes in the chain
          let chain = [], closed = false;   // chain[k]: the number of the resource that P(k+1) holds
          const slim = ctx.narrow, W = slim ? 360 : 640, STEP = slim ? 84 : 150, BW = slim ? 56 : 90, X0 = slim ? 32 : 60;  // slim on a small screen; W: drawing width; STEP: gap between bars; BW: bar width; X0: left edge of the first bar
          const svg = s('svg', { viewBox: `0 0 ${W} 280`, width: '100%', role: 'img', 'aria-label': 'Staircase of resource numbers along a chain of waiting processes' });  // svg: the staircase drawing; its label describes it to screen readers
          const ineq = h('div', { class: 'ineq' });  // ineq: the line of numbers joined by less-than signs
          const prompt = h('div', { class: 'small b' });  // prompt: the bold instruction that tells the student what to do next
          const say = verdict(ctx);  // say: the verdict box
          const nums = Array.from({ length: MAXR }, (_, i) => h('button', { class: 'btn sm rbtn', type: 'button', onclick: () => pick(i + 1) }, 'R' + (i + 1)));  // nums: the eight buttons R1 to R8; clicking one gives the next process that resource
          const bClose = h('button', { class: 'btn sm primary', type: 'button', onclick: () => close() }, 'Close the loop');  // bClose: the button that tries to close the loop
          const bAgain = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { chain = []; closed = false; paint(); say.say('info', 'Pick the number of the resource that P1 holds. Any number will do.'); } }, 'Start over');  // bAgain: "Start over" clears the chain and shows the first instruction again
          const top = (n) => 248 - n * 25;  // top(n): the height where a bar for resource number n ends; a higher number makes a taller bar
          const bx = (k) => X0 + k * STEP;  // bx(k): the left edge of the bar for process k + 1
          function draw() {  // draw(): redraws the staircase
            const kids = [];  // kids collects the shapes
            // a faint height scale: one line per resource number, so the bars read as a number line
            for (let n = 1; n <= MAXR; n++) kids.push(s('line', { x1: X0 - 4, y1: top(n), x2: W - 4, y2: top(n), class: 's-line', 'stroke-opacity': 0.12 }),  // one faint line per resource number from R1 to R8, so the bars read against a scale
              s('text', { x: X0 - 8, y: top(n) + 5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'R' + n));  // the label R1, R2 ... at the left end of each line
            chain.forEach((n, k) => {  // one bar per process in the chain
              kids.push(s('rect', { x: bx(k), y: top(n), width: BW, height: n * 25, rx: 6, class: 's-io', 'stroke-width': 2 }),  // an orange bar whose height shows the number of the resource that process holds
                s('text', { x: bx(k) + BW / 2, y: top(n) + (n > 1 ? 22 : 18), 'text-anchor': 'middle', 'font-size': n > 1 ? 16 : 14, 'font-weight': 800 }, 'R' + n),  // the resource name written inside the top of the bar
                s('text', { x: bx(k) + BW / 2, y: 270, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: `fill:var(--${PCOL[1 + (k % 3)]})` }, 'P' + (k + 1) + ' holds'));  // "P1 holds", "P2 holds" ... under each bar, in that process's colour
              if (k > 0) {  // from the second process on
                const m = chain[k - 1];  // m: the number the previous process holds
                kids.push(s('line', { x1: bx(k - 1) + BW, y1: top(m) + 10, x2: bx(k) - 3, y2: top(n) + 10, class: 's-line', 'stroke-width': 2.5, 'marker-end': 'url(#arr-ok)', style: 'stroke:var(--ok)' }));  // a green arrow from the previous bar to this one: the previous process waits for this resource
              }  // closes the if
            });  // closes the loop over the chain
            const k = chain.length;  // k: how many processes the chain has
            if (!closed && k < MAXP && !(k && chain[k - 1] === MAXR))  // while the chain can still grow (not closed, fewer than four processes, last one not holding R8)
              kids.push(s('rect', { x: bx(k), y: 160, width: BW, height: 88, rx: 6, class: 's-panel', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }),  // a dashed empty bar marks the next process's place
                s('text', { x: bx(k) + BW / 2, y: 211, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, class: 's-sub' }, '?'),  // with a question mark inside it
                s('text', { x: bx(k) + BW / 2, y: 270, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 's-sub' }, 'P' + (k + 1)));  // and that process's name underneath
            if (k >= 2) {  // with two or more processes, draws the arc that would close the loop back to the first
              const xa = bx(k - 1) + BW / 2, xb = bx(0) + BW / 2, ya = top(chain[k - 1]) - 4, yb = top(chain[0]) - 4;  // xa, ya: the top of the last bar; xb, yb: the top of the first bar
              const c = closed ? 'bad' : 'muted';  // c: red once the student has tried to close the loop, grey before that
              kids.push(s('path', { d: `M ${xa} ${ya} Q ${(xa + xb) / 2} ${Math.min(ya, yb) - 70} ${xb} ${yb}`, fill: 'none', class: 's-line', 'stroke-width': closed ? 3 : 2, 'stroke-dasharray': '7 5', style: `stroke:var(--${c})`, 'marker-end': `url(#arr-${c})` }),  // a dashed curve from the last bar back to the first, with an arrowhead
                s('text', { x: (xa + xb) / 2, y: Math.max(14, Math.min(ya, yb) - 38), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: `fill:var(--${closed ? 'bad' : 'muted'});paint-order:stroke;stroke:var(--panel);stroke-width:5px` },  // a label over the curve, with a halo so it stays readable
                  closed ? `✗ R${chain[k - 1]} → R${chain[0]} goes down` : `to close: P${k} would ask for R${chain[0]}`));  // it says the closing request goes down (after trying), or what the last process would have to ask for
            }  // closes the arc
            if (chain.length > 1 && !slim) kids.push(s('text', { x: W - 4, y: 16, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'green arrow = waits for'));  // on a wide screen, a key says what the green arrows mean
            svg.replaceChildren(...kids);  // swaps the new drawing in
          }  // closes draw
          function paint() {  // paint(): updates the drawing, the number line, the prompt and the buttons after every pick
            const k = chain.length, last = chain[k - 1];  // k: the chain's length; last: the number the last process holds
            draw();  // redraws the staircase
            ineq.innerHTML = k ? chain.map((n) => `<b>${n}</b>`).join(' &lt; ') + (closed ? ` &lt; <b class="no">${chain[0]}</b> <span class="no">✗</span>` : '') : '<span class="muted small" style="font-family:var(--font)">the numbers along the chain appear here</span>';  // the numbers joined by less-than signs, with the failing closing number in red; a grey hint before the first pick
            const full = k >= MAXP || last === MAXR;  // full: the chain cannot grow, because it has four processes or the last one holds R8, the top number
            prompt.innerHTML = closed ? 'The loop cannot close. Start over and try other numbers.'  // prompt once the loop has been tried: it cannot close, start over
              : !k ? 'Step 1: pick the resource that P1 holds.'  // prompt before any pick: choose what P1 holds
                : full ? (k === 1 ? `P1 holds R${MAXR}, the highest number, so it may never ask for anything else. Start over with a lower number.`  // full with only P1: holding R8 leaves P1 nothing higher to ask for, so start over
                  : last === MAXR ? `P${k} holds R${MAXR}, the highest number, so it cannot wait for anything new. Now try to close the loop.` : 'That is enough processes. Now try to close the loop.')  // full otherwise: the last holds R8, or four processes are enough; now try to close the loop
                  : `Step ${k + 1}: P${k} waits for the resource that P${k + 1} holds. Pick its number.`;  // otherwise: the next instruction, pick the resource the next process holds
            nums.forEach((b, i) => { b.disabled = closed || full; b.classList.toggle('low', !!k && i + 1 <= last); });  // R buttons: all disabled once closed or full; numbers at or below the last pick are faded, since the rule forbids them
            bClose.disabled = closed || k < 2;  // Close the loop works only with two or more processes, and only until it has been tried
            bClose.textContent = k >= 2 ? `Close the loop: P${k} asks for R${chain[0]}` : 'Close the loop';  // its label spells out the closing request, such as "P3 asks for R2"
          }  // closes paint
          function pick(n) {  // pick(n): runs when the student clicks the button for resource Rn
            const k = chain.length, last = chain[k - 1];  // k: the chain's length; last: the number the last process holds
            if (k && n <= last) { say.say('bad', `<b>Not allowed.</b> P${k} holds R${last}, so the rule lets it ask only for R${last + 1} or higher. A wait arrow can never point to a lower number.`); return; }  // a number not above the last one is refused with a red explanation, and nothing changes
            chain.push(n);  // otherwise the next process now holds Rn
            say.say('info', k ? `P${k} holds R${last} and waits for R${n}, which P${k + 1} holds. The number went up: <b>${last} &lt; ${n}</b>.` : `P1 holds R${n}. Now choose what P1 waits for: the resource held by P2.`);  // the verdict explains the new link (the number went up), or after the first pick, what to choose next
            paint();  // redraws everything
          }  // closes pick
          function close() {  // close(): runs when the student presses Close the loop
            const k = chain.length, first = chain[0], last = chain[k - 1];  // first and last: the numbers held by the first and the last process
            closed = true;  // records that the attempt was made
            say.say('bad', `<b>The loop cannot close.</b> To finish the circle, P${k} (holding R${last}) must ask for R${first}, which P1 holds. But ${first} &lt; ${last}, so the rule forbids that request. The numbers ${chain.join(' &lt; ')} only climb, and a circle would have to come back down.`);  // red verdict: the closing request would have to go down in number, which the rule forbids
            paint();  // redraws, now with the red arc
          }  // closes close
          paint();  // draws the empty staircase when the step opens
          say.say('info', 'Pick the number of the resource that P1 holds. Any number will do.');  // the first instruction in the verdict box
          el.append(h('div', { class: 'split l fill' },  // builds the page: the proof on the left, the staircase card on the right
            h('div', { class: 'stack' },  // left column, stacked
              h('p', { class: 'lead m0', html: 'Why does numbering work? Try to build a <span class="t">circular wait</span> while obeying the rule, and see exactly where it breaks.' }),  // lead sentence: try to build a circular wait while obeying the rule
              h('ol', { class: 'm0 small proof', html: '<li>Each “waits for” arrow is a request made while holding something. The rule says its number must be <b>higher</b> than the number already held.</li>'  // the numbered proof, line 1: every wait is a request made while holding, so its number must be higher
                + '<li>So along any chain of waiting processes, the numbers <b>rise at every link</b>: a &lt; b &lt; c &lt; …</li>'  // proof line 2: the numbers rise at every link of a chain
                + '<li>A circular wait has to end where it began: the last process waits for the first one’s resource, number a.</li>'  // proof line 3: a circle has to end where it began
                + '<li>That needs a &lt; … &lt; a, a number bigger than itself. Impossible, so <b>no circular wait can ever form</b>, whatever the timing.</li>' }),  // proof line 4: that needs a number bigger than itself, which is impossible
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A staircase that only ever goes up can never bring you back to the floor you started on.' }),  // analogy callout: a staircase that only goes up
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'The argument uses only the rule itself, not luck or timing. That is what prevention promises: no schedule, however unlucky, can produce the deadlock.' })),  // why-it-matters callout: the argument rests on the rule alone, not on timing
            h('div', { class: 'card white stack gap-s' }, prompt,  // right column: a white card with the prompt at the top
              h('div', { class: 'row gap-s', 'data-keys': '' }, ...nums),  // the row of R buttons; data-keys keeps the arrow keys inside this row instead of turning the page
              svg, ineq, say, h('div', { class: 'row gap-s' }, bClose, bAgain))));  // then the drawing, the number line, the verdict box and the two buttons; closes the page layout
        },  // closes render for step 6
      },  // closes step 6

      /* ---------------- 7. Rule lab: be the scheduler and try to freeze the system ---------------- */
      {  // opens step 7
        title: 'Rule lab: try to cause a deadlock',  // step 7 title
        kind: 'compare',  // kind 'compare' puts the label "Compare" above the title
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): draws step 7 when the student opens it
          const { h } = ctx;  // takes h out of ctx
          const RULES = [  // RULES: the four rules the student can pick from
            { value: 'none', label: 'No rule', breaks: 'nothing', intro: '<b>No rule.</b> Each program locks what it needs when it needs it. Try P1, P2, P1, P2, … and watch what happens.' },  // no rule: its label, what it rules out (nothing) and its opening hint
            { value: 'all', label: 'All at once', breaks: 'hold and wait', intro: '<b>All at once.</b> Each program asks for both resources in its first line. Try any order you like: can you still freeze both?' },  // all at once: rules out hold and wait
            { value: 'back', label: 'Give back when refused', breaks: 'no preemption', intro: '<b>Give back when refused.</b> A refused process must release what it holds and wait, holding nothing, for everything it needs at once.' },  // give back when refused: rules out no preemption
            { value: 'order', label: 'Numbered order', breaks: 'circular wait', intro: '<b>Numbered order.</b> The disk is #1 and the printer #2, so P2 must lock the disk first, even though it uses the printer first.' },  // numbered order: rules out circular wait; the disk is #1 and the printer #2
          ];  // closes RULES
          const ALT = Object.fromEntries(RULES.map((r) => [r.value, labAlt(r.value)]));   // the comparison runs, computed once
          let rule = 'none', S, gen = 0, busy = false;  // rule: the chosen rule; S: the lab state; gen: counts resets so an old replay knows to stop; busy: a replay is running
          const say = verdict(ctx);  // say: the verdict box
          const meters = h('div', { class: 'row gap-s' });  // meters: the row of counter chips
          const resBox = h('div', { class: 'stack gap-s' });  // resBox: the list saying who holds the disk and the printer
          const pc = {};  // pc: the parts of each process's card (chip, button, code box, card)
          [1, 2].forEach((p) => {  // builds a card for each process
            const chip = h('span', { class: 'chip' });  // chip: the process's state (next line, blocked or done)
            const btn = h('button', { class: 'btn sm ' + (p === 1 ? 'proc' : ''), type: 'button', style: p === 2 ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : null, onclick: () => act(p) }, 'Step P' + p);  // btn: "Step P1" or "Step P2", which runs that process's next line; P2's button is outlined in indigo
            const codeBox = h('div');  // codeBox: the place where the program listing goes
            pc[p] = { chip, btn, codeBox, card: h('div', { class: 'card tight stack gap-s', style: { borderTop: `4px solid var(--${PCOL[p]})` } }, h('div', { class: 'row gap-s' }, h('span', { html: TOK(p) }), chip, h('span', { class: 'grow' }), btn), codeBox) };  // the card: a coloured top edge, a header row with the pill, chip and button, then the code
          });  // closes the loop over processes
          const rows = {};  // rows: the comparison table's rows by rule, so the chosen rule's row can be highlighted
          const table = h('table', { class: 'tbl compact' },  // table: the comparison table under the lab
            h('tr', {}, ...['Rule', 'Rules out', 'Every possible order', 'Alternating turns', 'Ticks', 'Turns blocked', 'Held but idle', 'Given back'].map((t) => h('th', {}, t))),  // its header row
            ...RULES.map((r) => {  // one row per rule
              const A = ALT[r.value].S, C = labCount(r.value);  // A: the final state of the alternating-turns run; C: the count over every possible order
              rows[r.value] = h('tr', {}, h('td', { class: 'b' }, r.label), h('td', {}, r.breaks),  // the row starts with the rule's name and what it rules out
                h('td', { html: C.dead ? `<b style="color:var(--bad)">${C.dead} of ${C.total} deadlock</b>` : `<span style="color:var(--ok)">0 of ${C.total} deadlock</span>` }),  // how many of all possible orders deadlock: red if any do, green when none do
                h('td', { html: A.dead ? `<b style="color:var(--bad)">deadlock at tick ${A.tick}</b>` : '<span style="color:var(--ok)">both finish</span>' }),  // what alternating turns give: a deadlock at some tick (red) or both finish (green)
                h('td', {}, A.dead ? 'never' : String(A.tick)), h('td', {}, String(A.blocked)), h('td', {}, String(A.idle)), h('td', {}, String(A.gaveBack)));  // then the ticks taken (never, if deadlocked), turns blocked, held-but-idle and given-back counts
              return rows[r.value];  // remembers the row and hands it to the table
            }));  // closes the rows and the table
          function reset() {  // reset(): starts the lab over under the chosen rule
            gen++; busy = false;  // bumps gen so a running replay stops, and clears busy
            S = labNew(rule);  // a fresh lab state for the rule
            [1, 2].forEach((p) => pc[p].codeBox.replaceChildren(pc[p].code = ctx.ui.code(LAB[rule][p].map((l) => (ctx.narrow ? l.code.replace(/\s{2,}\/\//, '  //') : l.code)).join('\n'), { fontSize: 13, nums: !ctx.narrow })));  // shows each program's code; on a small screen the gap before the // notes shrinks and line numbers are hidden
            Object.entries(rows).forEach(([k, tr]) => tr.classList.toggle('on', k === rule));  // highlights the table row of the chosen rule
            paint();  // repaints
            say.say('info', RULES.find((r) => r.value === rule).intro);  // the rule's opening hint in the verdict box
          }  // closes reset
          function paint() {  // paint(): updates both cards, the resource list and the counters
            [1, 2].forEach((p) => {  // for each process
              const st = S.st[p], o = pc[p];  // st: its state; o: its card's parts
              o.code.clear();  // clears the old highlights in its code
              if (st !== 'done') o.code.mark(S.pc[p] + 1, st === 'blocked' ? 'bad' : 'cur');  // highlights the next line to run, in red if the process is blocked on it
              o.chip.className = 'chip ' + (st === 'done' ? 'ok' : st === 'blocked' ? 'bad' : 'accent');  // the chip's colour: green when done, red when blocked, indigo when ready
              o.chip.textContent = st === 'done' ? 'done' : st === 'blocked' ? (S.dead ? 'stuck forever' : 'blocked') : `next: line ${S.pc[p] + 1}`;  // the chip's text: done, blocked (or "stuck forever" in a deadlock), or the next line number
              o.btn.disabled = busy || st !== 'ready' || S.dead;  // the step button works only when the process is ready, with no deadlock and no replay running
            });  // closes the loop over processes
            resBox.replaceChildren(...['disk', 'prn'].map((r) => {  // rebuilds the resource list: the disk and the printer
              const o = S.owner[r];  // o: who holds this resource
              return h('div', { class: 'row gap-s' }, h('span', { class: 'resname' }, (r === 'disk' ? 'Disk' : 'Printer') + (rule === 'order' ? (r === 'disk' ? ' #1' : ' #2') : '')),  // its name tag, with #1 or #2 added under the numbered rule
                o ? h('span', { html: 'held by ' + TOK(o) }) : h('span', { class: 'chip ok' }, 'free'));  // then "held by" and the holder's pill, or a green "free"
            }));  // closes the resource list
            meters.replaceChildren(h('span', { class: 'chip' }, `tick ${S.tick}`), h('span', { class: 'chip ' + (S.blocked ? 'warn' : '') }, `turns blocked: ${S.blocked}`),  // counter chips: the tick, and turns blocked (amber if any)
              h('span', { class: 'chip ' + (S.idle ? 'bad' : '') }, `held but idle: ${S.idle}`), h('span', { class: 'chip ' + (S.gaveBack ? 'warn' : '') }, `given back: ${S.gaveBack}`));  // then held but idle (red if any) and given back (amber if any)
          }  // closes paint
          function act(p) {  // act(p): runs one line of process p when its Step button is pressed, or during a replay
            if (S.dead || S.st[p] !== 'ready') return;  // does nothing after a deadlock, or if p cannot move right now
            const msg = labStep(S, p);  // runs the line in the lab engine and keeps the narration it returns
            paint();  // repaints the cards and the counters
            if (S.dead) say.say('bad', `<b>Deadlock.</b> P1 holds ${rnames([...S.held[1]])} and waits for ${rnames(S.want[1])}; P2 holds ${rnames([...S.held[2]])} and waits for ${rnames(S.want[2])}. Neither can ever move. Press Reset, or pick a rule.`);  // on deadlock: a red verdict saying what each process holds and what it waits for
            else if (S.st[1] === 'done' && S.st[2] === 'done') say.say('ok', `<b>Both finished after ${S.tick} ticks.</b> Costs on this run: ${S.blocked} turns blocked, ${S.idle} held but idle, ${S.gaveBack} given back. The table compares every rule on the same alternating turns.`);  // when both have finished: a green verdict listing the run's costs
            else say.say(msg.some((m) => m.includes('refused') || m.includes('still holding')) ? 'warn' : 'info', msg.join(' '));  // otherwise the step's narration, in amber if a request was refused or a process waits while holding
          }  // closes act
          async function replay() {  // replay(): plays the alternating schedule by itself; async lets it pause between moves with await
            reset(); busy = true; paint();  // starts fresh and turns off the step buttons while it plays
            const g = gen;  // g: the reset count when this replay began
            for (const p of ALT[rule].order) { await ctx.sleep(700); if (!ctx.alive || g !== gen) return; act(p); }  // makes each move of the alternating order 0.7 seconds apart, stopping if the student leaves the step or resets
            busy = false; paint();  // when finished, turns the buttons back on
          }  // closes replay
          const seg = ctx.ui.seg(RULES.map((r) => ({ value: r.value, label: r.label })), rule, (v) => { rule = v; reset(); });  // seg: the rule switch; picking a rule resets the lab under it
          reset();  // sets the lab up when the step opens
          el.append(h('div', { class: 'stack fill' },  // builds the page, stacked top to bottom
            h('p', { class: 'm0', html: 'You are the scheduler. Pick a rule, then press <b>Step P1</b> or <b>Step P2</b> in any order you like. Under which rules can you <span class="t" data-t="deadlock">freeze</span> both processes?' }),  // instructions: you are the scheduler; the word "freeze" links to the glossary entry for deadlock
            h('div', { class: 'row gap-s' }, seg, h('span', { class: 'grow' }),  // a row with the rule switch on the left and a spacer
              h('button', { class: 'btn sm', type: 'button', onclick: replay }, 'Replay alternating turns'),  // a button that replays the alternating turns by itself
              h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset')),  // and a Reset button
            h('div', { class: 'grid-3', style: { alignItems: 'start' } }, pc[1].card, pc[2].card,  // three columns: P1's card, then P2's card
              h('div', { class: 'card tight stack gap-s' }, resBox, meters, say)),  // then a card with the resource list, the counters and the verdict
            table,  // the comparison table
            h('p', { class: 'xs muted m0' }, 'Every possible order: all the different ways the two processes’ steps can interleave. The other columns use alternating turns. Turns blocked: a process waiting at the end of a tick. Held but idle: work steps with a held resource unused. Given back: times a refused process released what it held.')));  // a footnote that explains the table's columns
        },  // closes render for step 7
      },  // closes step 7

      /* ---------------- 8. Recap: which rule breaks which condition, and at what price ---------------- */
      {  // opens step 8
        title: 'Recap: four conditions, four rules, four prices',  // step 8 title
        kind: 'recap',  // kind 'recap' puts the label "Recap" above the title
        render(el, ctx) {  // render(el, ctx): draws step 8 when the student opens it
          const { h } = ctx;  // takes h out of ctx
          const CN = ['Mutual exclusion', 'Hold and wait', 'No preemption', 'Circular wait'];  // CN: the four conditions, used as the answer buttons
          const ITEMS = [  // ITEMS: the matching exercise, each as [rule, number of the condition it removes, explanation]
            ['Let any number of readers use a read-only file at the same time', 0, 'Sharing removes mutual exclusion, but only for resources that really can be shared, like read-only data.'],  // rule: let readers share a read-only file (removes mutual exclusion)
            ['Ask for every resource you will need in one request, before you start', 1, 'A process that waits while holding nothing can never hold and wait.'],  // rule: ask for everything in one request (removes hold and wait)
            ['Ask for resources only while you hold none', 1, 'The milder hold-and-wait rule: give everything back before asking again.'],  // rule: ask only while holding none (also removes hold and wait)
            ['Refused? Give back everything you hold, and ask again later', 2, 'Releasing on refusal means held resources are no longer untouchable: it removes no preemption.'],  // rule: give everything back when refused (removes no preemption)
            ['The OS takes a resource away from a lower-priority holder', 2, 'Forcing the holder to release is preemption. It needs distinct priorities and saveable state.'],  // rule: the OS takes from a lower-priority holder (also removes no preemption)
            ['Number the resource types and request only higher numbers', 3, 'Numbers rise along every chain of waiting, so no chain can close into a circle: the direct method.'],  // rule: number the types and ask only for higher ones (removes circular wait)
          ];  // closes ITEMS
          const got = ITEMS.map(() => null);  // got[k]: whether item k was answered correctly (null before any answer)
          const score = h('span', { class: 'chip' });  // score: the chip that counts matched items
          const say = verdict(ctx);  // say: the verdict box
          const rows = ITEMS.map(([txt], k) => h('div', { class: 'mrow', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : null }, h('span', { class: 'small' }, txt),  // rows: one row per rule, its text and then the buttons; on a small screen the buttons drop under the text
            h('div', { class: 'mbtns' }, ...CN.map((c, j) => h('button', { class: 'btn sm', type: 'button', onclick: () => choose(k, j) }, c)))));  // the four condition buttons, two by two; a click calls choose
          function choose(k, j) {  // choose(k, j): runs when the student matches item k with condition j
            const [, ans, why] = ITEMS[k];  // ans and why: the right condition for this item and the explanation
            got[k] = j === ans;  // records whether the answer is right
            rows[k].classList.toggle('good', got[k]); rows[k].classList.toggle('oops', !got[k]);  // colours the row green or red
            rows[k].querySelectorAll('.mbtns .btn').forEach((b, i) => b.classList.toggle('on', i === j));  // highlights the button that was picked
            const right = got.filter((g) => g === true).length;  // right: how many items are matched correctly
            score.className = 'chip ' + (right === ITEMS.length ? 'ok' : 'accent');  // the score chip turns green when all are right
            score.textContent = `${right} / ${ITEMS.length} matched`;  // the score text, such as "4 / 6 matched"
            if (right === ITEMS.length) say.say('ok', '<b>All matched.</b> Three indirect rules (sharing, all-at-once or release-first, preemption) and one direct rule (numbering). Any single one is enough to make deadlock impossible.');  // all matched: a green summary of the three indirect rules and the one direct rule
            else say.say(got[k] ? 'ok' : 'bad', `<b>${got[k] ? 'Right' : 'Not quite'}: ${CN[ans].toLowerCase()}.</b> ${why}`);  // otherwise: right or not quite, the correct condition, and the reason
          }  // closes choose
          score.textContent = `0 / ${ITEMS.length} matched`;  // the starting score
          say.say('info', 'For each rule, pick the deadlock condition it makes impossible. The reason appears here.');  // the starting hint in the verdict box
          el.append(h('div', { class: 'split r fill' },  // builds the page: the matching card and the flip cards side by side
            h('div', { class: 'card tight stack gap-s' },  // the matching card
              h('div', { class: 'row' }, h('h3', { class: 'm0' }, 'Which condition does each rule remove?'), h('span', { class: 'grow' }), score),  // its heading, with the score at the right
              ...rows, say),  // then the rows and the verdict box
            h('div', { class: 'stack gap-s' },  // the other column, stacked
              h('h3', { class: 'm0' }, 'Six facts to keep'),  // heading: six facts to keep
              h('p', { class: 'small muted m0' }, 'Say the answer out loud, then click the card to check.'),  // instruction: answer out loud, then click a card to check
              ctx.ui.flipcards([  // ctx.ui.flipcards: cards that turn over when clicked, each written as [front, back]
                ['Prevention in one line', 'Make one of the four conditions impossible by design. Then deadlock can never happen.'],  // card: prevention in one line
                ['Why keep mutual exclusion?', 'A printer or a record being updated must serve one process at a time. Only shareable resources escape it.'],  // card: why mutual exclusion must stay
                ['The price of all-at-once', 'Long waits for the whole set, resources held idle, and every need must be known in advance.'],  // card: the price of asking all at once
                ['When is preemption practical?', 'Only when a resource’s state can be saved and restored: the processor, memory pages.'],  // card: when preemption is practical
                ['The ordering rule', 'Holding R<sub>i</sub>, a process may request R<sub>j</sub> only if j &gt; i.'],  // card: the ordering rule, written with subscripts
                ['Prevention’s overall cost', 'Easy to reason about, but it lowers resource utilization or puts a burden on programmers.'],  // card: prevention's overall cost
              ], { cols: 2, height: 96 }),  // closes the cards: two columns, each card at least 96 pixels tall
              h('div', { class: 'callout tip m0 small', 'data-label': 'Next up', html: 'Avoidance (6.3) rules out no condition in advance. Instead it checks every request and grants it only if every process can still be sure to finish.' }))));  // tip callout: what avoidance, the next section, does differently; closes the page layout
        },  // closes render for step 8
      },  // closes step 8

      /* ---------------- 9. Quiz ---------------- */
      {  // opens step 9, the quiz
        title: 'Check yourself',  // step 9 title
        kind: 'check',  // kind 'check' puts the label "Check Yourself" above the title
        quiz: [  // quiz: the questions, which the guide shows, checks and scores
          { q: 'What does a deadlock prevention strategy do?',  // quiz question 1 (multiple choice): what a prevention strategy does
            choices: ['It designs the system so that at least one of the four deadlock conditions can never hold', 'It checks each request as it is made and refuses any grant that could lead to deadlock', 'It lets deadlocks happen, then finds the processes involved and breaks the deadlock', 'It removes all four deadlock conditions at once, so that no process ever has to wait'],  // its four choices: prevention, avoidance, detection, and removing all four conditions
            answer: 0,  // the right answer is the first choice (counting from 0)
            feedback: [null, 'That is deadlock avoidance, which rules out no condition in advance and instead decides request by request at run time.', 'That is detection and recovery. Prevention acts at design time, so the deadlock never forms in the first place.', 'Removing a single condition is enough, and processes can still wait under prevention; they just can never end up in a deadlock.'],  // feedback for each wrong choice (null for the right one)
            why: 'A deadlock needs all four conditions at the same time, so a rule that makes any one of them impossible rules deadlock out completely, whatever the timing.' },  // explanation shown after answering: removing one condition is enough
          { q: 'Which of these is the <b>direct</b> method of deadlock prevention?',  // quiz question 2 (multiple choice): which method is the direct one
            choices: ['Requiring each process to request all of its resources at once', 'Numbering the resource types and requiring requests in increasing order', 'Letting the OS take a resource away from a lower-priority holder', 'Letting many processes share a read-only file'],  // choices: all at once, numbering, preemption by priority, sharing
            answer: 1,  // the answer is numbering, choice 1
            feedback: ['This rules out hold and wait, one of the first three conditions, so it is an indirect method.', null, 'This rules out no preemption, one of the first three conditions: an indirect method.', 'This relaxes mutual exclusion for a shareable resource, one of the first three conditions: an indirect method.'],  // feedback: each wrong choice is an indirect method, and the reason why
            why: 'Indirect methods rule out one of the first three conditions (mutual exclusion, hold and wait, no preemption). The direct method rules out the fourth, circular wait, usually with a numbered order of resource types.' },  // explanation: indirect methods versus the direct method
          { type: 'bucket', q: 'Can several processes use each resource at the same moment without harm?',  // quiz question 3 (sort into buckets): shareable or one process at a time
            buckets: ['Shareable', 'One process at a time'],  // the two buckets
            items: [['A read-only file', 0], ['A printer', 1], ['A database record that several processes only read', 0], ['A database record that a process is updating', 1], ['Read-only program code used by many processes', 0], ['A DVD burner writing a disc', 1]],  // the six resources, each with its correct bucket
            why: 'Reading changes nothing, so readers can share. Output devices and data being written need one process at a time, which is why mutual exclusion cannot be ruled out in general.' },  // explanation: readers can share, while writers and output devices cannot
          { type: 'match', q: 'Match each prevention rule with the deadlock condition it makes impossible.',  // quiz question 4 (match): each prevention rule with the condition it makes impossible
            pairs: [['Request every resource in a single request', 'Hold and wait'], ['Release everything you hold when a request is refused', 'No preemption'], ['Request resource types only in increasing number order', 'Circular wait'], ['Let many readers share a read-only file at once', 'Mutual exclusion']],  // the four pairs: all at once, give back, numbering, sharing
            why: 'All-at-once requests stop a process from holding while it waits; giving resources back on refusal makes them preemptible; numbering stops any chain from closing into a circle; sharing removes the need for exclusive use, but only where sharing is safe.' },  // explanation: how each rule removes its condition
          { type: 'multi', q: 'A system makes every process request all of its resources at once and blocks it until the whole set can be granted. Which are costs of this rule? Select all that apply.',  // quiz question 5 (select all): the costs of the all-at-once rule
            choices: ['A process may wait a long time for its whole set, even though it could have started with part of it', 'Resources may stay allocated for long periods without being used', 'A process may not know in advance every resource it will need', 'A circular wait can still form among processes that each hold part of their set', 'In a program built from modules, the needs of every module must be known before it starts'],  // five choices; the fourth is the trap, a circular wait that cannot actually form
            answer: [0, 1, 2, 4],  // the right answers are choices 0, 1, 2 and 4
            why: 'The real costs all come from asking early and for everything. A circular wait cannot form, because under this rule a waiting process holds nothing at all.' },  // explanation: every real cost comes from asking early and for everything
          { type: 'num', q: 'Under an all-at-once rule, a process holds a plotter for its whole 12-minute run, but it uses the plotter only during its last 3 minutes. For what percentage of the holding time does the plotter sit idle?',  // quiz question 6 (number): the idle share of a plotter held 12 minutes but used for only 3
            answer: 75, tol: 0.5, unit: '%',  // the answer is 75 percent, accepted within half a percent either way
            hint: 'Idle time is holding time minus time in use.',  // hint shown after a wrong try: idle time is holding time minus time in use
            why: 'Held for 12 minutes, used for 3, so idle for 12 − 3 = 9 minutes: 9 / 12 = 0.75, or 75%. That idle time is lost resource utilization, the main price of the rule.' },  // explanation: the worked calculation
          { q: 'Process P holds the disk and asks for the printer, which another process holds. The system removes the no-preemption condition with the rule in which the <b>refused</b> process gives way, not the holder. What happens next?',  // quiz question 7 (multiple choice): what happens next under the give-back-when-refused rule
            choices: ['P keeps the disk and waits in line until the printer’s holder releases it', 'The OS takes the printer from its holder and gives it to P right away', 'P releases the disk, and later requests the disk and the printer again', 'P is terminated, and the system restarts it later from the beginning'],  // choices: keep and wait, take it from the holder, give back and ask again, terminate
            answer: 2,  // the answer is choice 2, give back and ask again later
            feedback: ['That is what happens with no rule at all. Under this rule a refused process may not keep what it holds, so it cannot sit on the disk while it waits.', 'That is the other preemption method, taking a resource from its holder. Under this rule it is the refused process that releases.', null, 'Nothing is terminated. P only gives up what it holds and asks for everything again later.'],  // feedback for each wrong choice
            why: 'Refused while holding something, a process must release all it holds and later ask again for everything, the new resource included. Waiting while holding nothing, it cannot be part of a circular wait.' },  // explanation: refused while holding, a process releases everything and asks again
          { q: 'A system prevents deadlock by letting the OS force a process to release a resource that another process asks for. What must be true for this method to work?',  // quiz question 8 (multiple choice): what forced preemption needs in order to work
            choices: ['Every process must request all of its resources at once', 'Every resource type must be numbered and requested in increasing order', 'Only processes that have finished their work may be asked to give resources up', 'No two processes may have the same priority, so it is always clear which one gives way'],  // choices: all at once, numbering, only finished processes, distinct priorities
            answer: 3,  // the answer is choice 3, distinct priorities
            feedback: ['That is the all-at-once rule for hold and wait, a different prevention method.', 'That is resource ordering, the method for circular wait.', 'A finished process releases everything anyway. This method takes resources from a process that is still running.', null],  // feedback for each wrong choice
            why: 'The OS uses priority to decide who must release. With equal priorities there is no tie-breaker, and two processes could keep taking the same resource from each other.' },  // explanation: priority is the tie-breaker that decides who gives way
          { type: 'tf', q: 'Preempting a resource is practical for the processor and for pages of memory, but not for a printer partway through printing a page.',  // quiz question 9 (true or false): preemption suits the processor and memory, but not a printer mid-page
            answer: true,  // the answer is true
            why: 'The processor’s state (its registers) can be saved and reloaded, and a memory page can be copied to disk and back. Half a printed page cannot be taken back, so preempting the printer would ruin the work.' },  // explanation: which kinds of state can be saved and which cannot
          { type: 'num', q: 'Resource types are numbered: tape drive 1, disk 2, scanner 3, printer 4, plotter 5. Under resource ordering, a process holds the scanner and nothing with a higher number. How many of the other resource types may it still request?',  // quiz question 10 (number): how many other types a process holding the scanner may still request
            answer: 2, tol: 0,  // the answer is 2, and only an exact answer counts
            hint: 'Holding type i, which numbers may it ask for?',  // hint: while holding type i, which numbers may it ask for
            why: 'Holding type 3, it may request only types numbered above 3: the printer (4) and the plotter (5). That is 2. The tape drive and the disk had to be requested before the scanner, if at all.' },  // explanation: only the printer (4) and the plotter (5) are numbered above the scanner (3)
          { q: 'Resources are numbered disk = 1, printer = 2, network = 3. Which request order obeys the resource ordering rule?',  // quiz question 11 (multiple choice): which lock order obeys the numbering
            choices: ['<code>lock(printer); lock(network); lock(disk);</code>', '<code>lock(disk); lock(printer); lock(network);</code>', '<code>lock(disk); lock(network); lock(printer);</code>', '<code>lock(network); lock(printer); lock(disk);</code>'],  // the four lock orders, shown as code
            answer: 1,  // the answer is choice 1: disk, then printer, then network
            feedback: ['It asks for the disk (1) while holding the printer (2) and the network (3): the number goes back down.', null, 'It asks for the printer (2) while holding the network (3): the number goes back down.', 'Every request goes down in number, 3 → 2 → 1: the opposite of the rule.'],  // feedback: where each wrong order goes down in number
            why: 'The rule: while holding resource i, request only resources numbered above i. Only 1 → 2 → 3 climbs at every step.' },  // explanation: only the order 1, 2, 3 climbs at every step
          { type: 'order', q: 'Put the steps of the argument that resource ordering makes a circular wait impossible in order.',  // quiz question 12 (put in order): the steps of the proof that numbering prevents a circular wait
            items: ['Assume a circular wait has formed among processes that all follow the ordering rule', 'Each process in the chain holds a resource and requests one held by the next process, so the numbers rise at every link', 'Following the chain all the way around leads back to the resource held by the first process', 'That would make the first number larger than itself, which is impossible, so no circular wait can form'],  // the four steps of the proof, written in their correct order
            why: 'It is a proof by contradiction: suppose the circle exists, notice that the numbers must strictly rise along it, and see that coming back to the start would need a number bigger than itself.' },  // explanation: it is a proof by contradiction
        ],  // closes the quiz list
      },  // closes step 9
    ],  // closes the steps list
    notes: `${/* notes: the section's study notes, HTML shown in the Notes panel; each ${...} part is filled in by code */''}
<h3>6.2 Deadlock Prevention</h3>${/* notes title: the section number and name */''}
<p>A deadlock needs four conditions at once: <b>mutual exclusion</b> (one process at a time per resource), <b>hold and wait</b> (a process keeps what it holds while waiting for more), <b>no preemption</b> (nobody can take a resource from its holder) and <b>circular wait</b> (a closed chain in which each process waits for a resource the next one holds). <b>Deadlock prevention</b> designs the system, before anything runs, so that at least one of them can never hold. One is enough: then no schedule can produce a deadlock. <b>Indirect methods</b> rule out one of the first three conditions, removing what a circular wait needs in order to freeze the system; the <b>direct method</b> rules out the fourth, the circular wait itself.</p>${/* notes paragraph: the four conditions, what prevention does, and indirect versus direct methods */''}
<p>Compare: avoidance (6.3) rules out no condition in advance but checks each request at run time; detection (6.4) lets deadlocks happen, then finds and breaks them. Analogy: a fire needs fuel, heat, oxygen and its chain reaction; removing any one (say, the oxygen) puts it out.</p>${/* notes paragraph: how avoidance and detection differ, and the fire analogy */''}
<h4>1. Mutual exclusion: usually cannot be ruled out</h4>${/* heading for part 1 of the notes: mutual exclusion */''}
<p>A <b>shareable resource</b> can be used by many processes at once without harm: a read-only file, a record everyone only reads, read-only program code. Nobody waits for it, so it is never part of a deadlock. A <b>non-shareable resource</b> needs exclusive access: a printer, a DVD burner, a record or counter being updated. The OS must provide that exclusive access, so prevention cannot drop this condition in general. Sharing anyway trades deadlock for corrupted results: two print jobs mix their lines on one page, and two updates to one record lose one (balance $${ACCT.start}; P1 adds $${ACCT.dep} while P2 takes $${ACCT.wd}; both read $${ACCT.start}; P1 writes $${ACCT.start + ACCT.dep}, then P2 writes $${ACCT.start - ACCT.wd}; the right answer was $${ACCT.start + ACCT.dep - ACCT.wd}). Keep exclusive access only where it is really needed.</p>${/* notes paragraph: shareable versus non-shareable resources, with the lost-update numbers taken from ACCT */''}
<h4>2. Hold and wait: ask for everything at once</h4>${/* heading for part 2 of the notes: hold and wait */''}
<p><b>All-at-once request:</b> a process asks for every resource it will need in one request and is blocked, holding nothing, until the whole set can be granted together. So hold and wait cannot happen, and a waiting process, holding nothing, can never be part of a circular wait. <b>Variant:</b> a process may request resources only while it holds none, giving back everything before it asks for more.</p>${/* notes paragraph: the all-at-once rule and its milder variant */''}
<p><b>The price:</b> (1) a process may wait long for its whole set when it could have started with part of it; (2) resources stay allocated but unused for long periods, lowering <b>resource utilization</b> (the share of time a resource does useful work); (3) a process may not know in advance all it will need (it can depend on the input); (4) in a modular program, every module’s needs must be known and added up before it starts.</p>${/* notes paragraph: the four prices of the all-at-once rule */''}
<p>Worked example: P1 arrives in tick 0 (disk 3 ticks, compute 2, then disk + printer 2); P2 in tick 1 (printer 5); P3 in tick 4 (disk 3). “Done” is a process’s last tick of work.</p>${/* notes paragraph: the step 3 workload, and what "done" means in the table below */''}
${holdNotesTable()}${/* inserts the hold-and-wait table, computed by holdNotesTable from real runs of the simulator */''}
<p>All at once leaves the printer held and idle while P1 is still reading, so P2 finishes much later. Release first makes P1 give the disk back; it loses it to P3 and finishes later, and a process that keeps losing that race could starve. Idle share = (time held − time used) / time held: a plotter held 12 minutes but used 3 is idle (12 − 3) / 12 = 75% of the time.</p>${/* notes paragraph: what the table shows, plus the formula for the idle share and the plotter example */''}
<h4>3. No preemption: let resources be taken back</h4>${/* heading for part 3 of the notes: no preemption */''}
<ul>${/* opens the list of the two ways to allow preemption */''}
  <li><b>(a) Give back when refused.</b> A process that holds resources and is refused a further request must release everything it holds, and later request it all again plus the new one. It waits holding nothing.</li>${/* list item: way (a), give back everything when refused */''}
  <li><b>(b) Take it from the holder.</b> When a process requests a resource another holds, the OS may force the holder to release it. This works only if no two processes have the same <b>priority</b>, so it is always clear who gives way; with equal priorities two processes could keep snatching it back and forth.</li>${/* list item: way (b), take it from the holder, which needs distinct priorities */''}
</ul>${/* closes the list */''}
<p>Practical only for a <b>preemptible resource</b>, whose state can be saved and restored later: the processor (save its registers) or memory (copy a page to disk and back). A printer halfway through a page cannot be un-printed: the half page is wasted and the work redone.</p>${/* notes paragraph: preemption works only for resources whose state can be saved and restored */''}
<h4>4. Circular wait: resource ordering (the direct method)</h4>${/* heading for part 4 of the notes: circular wait and resource ordering */''}
<p>Number every resource type R<sub>1</sub>, R<sub>2</sub>, … A process holding type R<sub>i</sub> may afterwards request only types R<sub>j</sub> with j &gt; i (several units of one type are requested together). Example: tape 1, disk 2, scanner 3, printer 4, plotter 5; holding the scanner, a process may still request only the printer and the plotter: 2 types.</p>${/* notes paragraph: the numbering rule and the five-device example */''}
<p>The numbering game (${ORD_RES.map((r, i) => `${r.toLowerCase()} ${i + 1}`).join(', ')}; ${ORD_PROGS.map((p) => `P${p.id} ${p.nat.map((r) => r.toLowerCase()).join(' → ')}`).join('; ')}): P3 breaks the rule, and the three can close a circle (P1 holds the scanner, waits for the disk; P2 holds the disk, waits for the printer; P3 holds the printer, waits for the scanner). The natural orders already form a loop, so no numbering makes all three legal; some program must change its order, e.g. P3 locks the scanner first, before it needs it.</p>${/* notes paragraph: the numbering game, with its devices and request orders filled in from ORD_RES and ORD_PROGS */''}
<p><b>Why no cycle can form</b> (proof by contradiction): (1) assume processes that all follow the rule form a circular wait; (2) each holds a resource and requests one held by the next, so the numbers rise at every link: a &lt; b &lt; c &lt; …; (3) going around the chain leads back to the first process’s resource, number a; (4) so a &lt; … &lt; a, a number larger than itself. Impossible, whatever the timing.</p>${/* notes paragraph: the four-line proof that no cycle can form */''}
<p><b>The price:</b> requests follow the number order, not the program’s natural order, so resources are grabbed early and held longer; this can be inefficient, slow processes down and deny access unnecessarily.</p>${/* notes paragraph: the price of numbering */''}
<h4>5. Comparing the rules</h4>${/* heading for part 5 of the notes: comparing the rules */''}
<p>Rule lab: P1 locks the disk, reads, locks the printer, prints, unlocks both; P2 locks the printer, prints a banner, locks the disk, prints, unlocks both (under the numbered rule, disk #1 and printer #2, P2 locks the disk first). Every possible interleaving, then alternating turns (blocked: a process blocked after a turn; idle: a work step with a held resource unused; given back: a refusal that forced a release):</p>${/* notes paragraph: the rule-lab programs and what each counter in the next table means */''}
${labNotesTable()}${/* inserts the rule-lab table, computed by labNotesTable with the same engine the lab uses */''}
<table><tr><th>Condition ruled out (kind)</th><th>Main price</th></tr>${/* summary table: header row, the condition ruled out and its main price */''}
  <tr><td>Mutual exclusion (indirect)</td><td>Possible only for truly shareable resources</td></tr>${/* summary row: mutual exclusion */''}
  <tr><td>Hold and wait (indirect)</td><td>Long waits, idle resources, needs known in advance</td></tr>${/* summary row: hold and wait */''}
  <tr><td>No preemption (indirect)</td><td>Only for saveable state; work may be redone</td></tr>${/* summary row: no preemption */''}
  <tr><td>Circular wait (direct)</td><td>Unnatural request order; resources held early</td></tr></table>${/* summary row: circular wait; closes the table */''}
<p><b>Overall:</b> prevention is simple to reason about and guarantees no deadlock, but it is conservative: it lowers resource utilization and slows processes, or burdens programmers.</p>`,  // closing paragraph: prevention's overall verdict; the backtick ends the notes text
  });  // closes the object passed to Guide.section
})();  // closes the wrapper function and runs it right away
