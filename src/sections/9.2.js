// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 9.2 — Scheduling Algorithms
   Criteria, priorities, selection functions and decision modes, then
   FCFS, round robin, SPN, SRT, HRRN, feedback and fair-share scheduling.
   One deterministic engine (simulate) drives every chart, table and
   caption, so the numbers on screen always come from the same code.
   Helpers live in the IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ENGINE-BEGIN ------------------------------------------------------
     Pure scheduling code (no DOM). dev/qa-9.2/engine.test.js extracts
     this exact block and checks it against the reference results.    */
  const NAMES = 'ABCDEF';  // NAMES: the letters that name the processes on screen; process 0 is A, process 1 is B, and so on up to six
  const STANDARD = [[0, 3], [2, 6], [4, 4], [6, 5], [8, 2]].map(([arr, svc]) => ({ arr, svc }));  // STANDARD: the five-process workload used all through the section, written as (arrival, service) pairs, turned into {arr, svc} objects
  const FB_LEVELS = 4;                                   // RQ0 (highest) .. RQ3 (lowest, round robin)
  const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);  // avg(a): the mean of a list of numbers; the "|| 1" avoids dividing by zero when the list is empty
  const lessKey = (a, b) => { for (let k = 0; k < a.length; k++) { if (a[k] < b[k]) return true; if (a[k] > b[k]) return false; } return false; };  // lessKey(a, b): compares two lists item by item, like words in a dictionary; true if a sorts first. Used to rank processes and break ties

  /* simulate(procs, pol, opt): one whole run, one time unit at a time.
     procs: [{arr, svc}], pol: fcfs | rr | spn | srt | hrrn | fb, opt: {q} for rr, {fb: '1' | '2i'} for feedback.
     Order of work at each instant t: a process that just finished leaves, new arrivals join the
     ready queue, THEN a quantum expiry or preemption puts the running process back (so it lands
     behind the arrivals), then the dispatcher picks if the processor is free.
     frames[t] records the state right after the decision at t (run = who runs during [t, t+1)). */
  function simulate(procs, pol, opt = {}) {  // simulate(): runs one policy on one workload, one time unit at a time, and returns everything the charts and captions need
    const Q = opt.q || 1, fbv = opt.fb || '1';  // Q is the round robin quantum (1 if none is given); fbv picks the feedback quanta: '1' means 1 everywhere, '2i' means 2 to the power of the queue number
    const quantum = (lvl) => (pol === 'fb' ? (fbv === '2i' ? 2 ** lvl : 1) : Q);  // quantum(lvl): how many units a process may run at feedback level lvl before it is checked; for every other policy it is simply Q
    const P = procs.map((p, i) => ({ i, arr: p.arr, svc: p.svc, rem: p.svc, lvl: 0, fin: null }));  // P: a working copy of each process: its index, arrival, service time, time remaining (rem), feedback level (lvl) and finish time (unknown yet)
    const n = P.length, q = [[]];  // n counts the processes; q is the list of ready queues, which starts with just one queue (queue 0)
    if (pol === 'fb') for (let k = 1; k < FB_LEVELS; k++) q.push([]);  // feedback needs FB_LEVELS queues, so for it the lower queues RQ1 to RQ3 are added under the first
    let t = 0, run = null, used = 0, done = 0;  // t is the clock; run is the process on the processor (null = none); used counts the units it has run this turn; done counts finished processes
    const frames = [], segs = [];  // frames collects one snapshot per time unit for the players and captions; segs collects the bars of the Gantt chart (a timeline chart)
    const waited = (p) => t - p.arr - (p.svc - p.rem);  // waited(p): how long p has waited so far: the time since it arrived minus the time it has already run
    const keyOf = (p) => (pol === 'spn' ? [p.svc, p.arr, p.i] : pol === 'srt' ? [p.rem, p.arr, p.i]  // keyOf(p): the ranking key of the policies that compare processes (smallest wins): SPN uses service time, SRT time remaining; arrival and index break ties
      : pol === 'hrrn' ? [-(waited(p) + p.svc) / p.svc, p.arr, p.i] : [0, 0, 0]);  // HRRN uses minus the response ratio, so the largest ratio sorts first; FCFS, RR and feedback never compare, so they get a dummy key
    const best = (list) => list.reduce((b, p) => (lessKey(keyOf(p), keyOf(b)) ? p : b), list[0]);  // best(list): the process in the list with the smallest key, which is the one the policy would choose
    const limit = Math.max(...P.map((p) => p.arr)) + P.reduce((a, p) => a + p.svc, 0) + 1;  // limit: a safe upper bound for the clock (last arrival plus all the work plus 1), so the loop can never run forever
    while (t <= limit) {  // the main loop: one pass per time unit until every process has finished
      const ev = [];  // ev collects what happens at this instant (finish, arrival, quantum end, preemption, dispatch); the captions are written from it later
      let pool = null;  // pool will list the processes the dispatcher compared at this instant, for the caption; it stays null until a decision is made
      if (run && run.rem === 0) { run.fin = t; done++; ev.push({ k: 'fin', p: run.i }); run = null; }  // if the running process has no work left, it finishes now: record its finish time, count it, log a 'fin' event and free the processor
      for (const p of P) if (p.arr === t) { q[0].push(p); ev.push({ k: 'arr', p: p.i }); }  // every process that arrives at this instant joins the back of the top ready queue (event 'arr')
      if (run) {  // if a process is still running, check whether the policy takes the processor away from it now
        const others = q.some((x) => x.length);  // others: true if anyone at all is waiting in any of the ready queues
        if (pol === 'rr' && used >= Q) { q[0].push(run); ev.push({ k: 'tq', p: run.i }); run = null; }  // round robin: once the running process has used a whole quantum it goes to the back of the queue (event 'tq', time quantum over)
        else if (pol === 'fb' && used >= quantum(run.lvl)) {  // feedback: the running process has used up the quantum of the level it is on
          if (others) { run.lvl = Math.min(run.lvl + 1, FB_LEVELS - 1); q[run.lvl].push(run); ev.push({ k: 'down', p: run.i, lvl: run.lvl }); run = null; }  // if others are waiting, it sinks one level (never below the last), joins that queue and gives up the processor (event 'down')
          else { used = 0; ev.push({ k: 'stay', p: run.i }); }  // if nobody else is waiting, it keeps running with a fresh quantum at the same level (event 'stay')
        } else if (pol === 'srt' && q[0].length) {  // SRT: when processes are waiting, the running one must be compared against them
          pool = [run.i, ...q[0].map((p) => p.i)];  // pool lists the running process plus everyone waiting, the candidates the caption will compare
          const b = best(q[0]);  // b is the waiting process with the least time remaining
          if (lessKey(keyOf(b), keyOf(run))) { q[0].push(run); ev.push({ k: 'pre', p: run.i, by: b.i }); run = null; }  // if b needs strictly less time than the running process, the running one is preempted and goes back to the queue (event 'pre')
          else ev.push({ k: 'keep', p: run.i });  // otherwise the running process keeps the processor (event 'keep')
        }  // closes the SRT case
      }  // closes the checks on the running process
      if (!run && done < n) {  // if the processor is free and work remains, the dispatcher (the part of the OS that hands out the processor) picks the next process
        const lv = q.findIndex((x) => x.length);  // lv: the highest-priority queue that has someone in it (always queue 0 unless the policy is feedback)
        if (lv >= 0) {  // someone is ready to run
          if (!pool) pool = q[lv].map((p) => p.i);  // unless the SRT check already filled pool, the candidates are everyone in that queue
          const pick = pol === 'spn' || pol === 'srt' || pol === 'hrrn' ? best(q[lv]) : q[lv][0];  // SPN, SRT and HRRN take the best process by their key; FCFS, RR and feedback take whoever is at the front of the queue
          q[lv].splice(q[lv].indexOf(pick), 1);  // removes the chosen process from its queue
          ev.push({ k: 'go', p: pick.i, lvl: lv });  // records the dispatch (event 'go') together with the queue level it came from
          run = pick; used = 0;  // the chosen process now runs, and its count of units used starts again at 0
        } else ev.push({ k: 'idle' });  // nobody is ready, so the processor sits idle for this unit (event 'idle')
      }  // closes the dispatch step
      frames.push({ t, run: run ? run.i : -1, q: q.map((x) => x.map((p) => p.i)), rem: P.map((p) => p.rem), lvl: P.map((p) => p.lvl), ev, pool, used });  // saves the snapshot for this instant: time, who runs, each queue, time left and level of every process, events, candidates and units used
      if (done === n) break;  // once everyone has finished the run is over; the final snapshot has already been saved
      if (run) { run.rem--; used++; }  // the running process does one unit of work: one unit less remaining, one unit more used of its quantum
      const id = run ? run.i : -1, last = segs[segs.length - 1];  // id is who ran during this unit (-1 means idle); last is the most recent Gantt bar
      if (last && last.p === id && last.b === t) last.b = t + 1; else segs.push({ p: id, a: t, b: t + 1 });  // if the same process (or idle) continues a bar that ends right now, that bar grows by one unit; otherwise a new one-unit bar starts
      t++;  // the clock moves on to the next time unit
    }  // ends the main loop
    const fin = P.map((p) => p.fin), tr = P.map((p) => p.fin - p.arr), ntr = P.map((p, i) => tr[i] / p.svc);  // finish times; turnaround Tr = finish minus arrival; normalized turnaround Tr/Ts = Tr divided by the service time
    return { pol, opt, n, T: t, frames, segs, fin, tr, ntr, meanTr: avg(tr), meanNtr: avg(ntr) };  // returns the whole run: policy, options, count, end time T, snapshots, bars, per-process results and the two mean values
  }  // ends simulate

  /* The order in which processes first got the processor (for nonpreemptive runs, the whole schedule). */
  const startOrder = (sim) => { const o = []; sim.frames.forEach((f) => f.ev.forEach((e) => { if (e.k === 'go' && !o.includes(e.p)) o.push(e.p); })); return o; };  // startOrder(sim): lists processes in the order they first got the processor; it is kept for the checks run on the engine

  /* Nonpreemptive dispatcher game: who is waiting at time t, and the result of a chosen order. */
  const waitingAt = (procs, done, t) => procs.map((p, i) => i).filter((i) => !done.includes(i) && procs[i].arr <= t);  // waitingAt(procs, done, t): the indexes of the processes that have arrived by time t and are not in the done list yet
  function runOrder(procs, order) {  // runOrder(procs, order): plays out a nonpreemptive schedule in the given order and measures it; the dispatcher game in step 1 uses it
    let t = 0; const fin = procs.map(() => null), segs = [];  // t is the clock; fin holds each finish time (null until the process has run); segs collects the Gantt bars
    order.forEach((i) => { t = Math.max(t, procs[i].arr); segs.push({ p: i, a: t, b: t + procs[i].svc }); t += procs[i].svc; fin[i] = t; });  // for each process in turn: if it has not arrived yet the clock jumps to its arrival, then it runs to the end; its bar and finish are saved
    const tr = fin.map((f, i) => (f == null ? null : f - procs[i].arr));  // turnaround Tr = finish minus arrival, left null for processes that have not run yet
    const ntr = tr.map((x, i) => (x == null ? null : x / procs[i].svc));  // normalized turnaround Tr/Ts for each process, also null for processes that have not run yet
    return { fin, segs, t, tr, ntr, meanTr: avg(tr.filter((x) => x != null)), meanNtr: avg(ntr.filter((x) => x != null)) };  // returns finishes, bars, end time, per-process results and the means over just the processes that have run
  }  // ends runOrder
  /* Every order a nonpreemptive dispatcher could pick without idling while someone waits. */
  function allOrders(procs) {  // allOrders(procs): every complete order a nonpreemptive dispatcher could choose; the game uses it to find the best possible score
    const out = [];  // out collects the complete orders
    const dfs = (order, t) => {  // dfs(order, t): a depth-first search (try one choice, go deeper, then undo it and try the next) from a partial order at time t
      if (order.length === procs.length) { out.push(order.slice()); return; }  // once every process has a place, a copy of the finished order is saved
      let w = waitingAt(procs, order, t);  // w: the processes waiting at time t
      if (!w.length) { t = Math.min(...procs.map((p, i) => (order.includes(i) ? Infinity : p.arr))); w = waitingAt(procs, order, t); }  // if nobody is waiting, the clock jumps ahead to the next arrival among the processes not yet placed
      w.forEach((i) => { order.push(i); dfs(order, Math.max(t, procs[i].arr) + procs[i].svc); order.pop(); });  // tries each waiting process next: adds it, searches on from the time it would finish, then removes it again to try the next one
    };  // ends dfs
    dfs([], 0);  // starts the search with an empty order at time 0
    return out;  // hands back every order found
  }  // ends allOrders

  /* Round robin with a context-switch cost c (continuous time): every dispatch costs c before the quantum starts. */
  function rrCost(procs, q, c) {  // rrCost(procs, q, c): round robin where every dispatch first costs c units of switching; step 4's quantum chart uses it
    const n = procs.length, rem = procs.map((p) => p.svc), fin = procs.map(() => null), segs = [], queue = [];  // n counts the processes; rem is the time each still needs; fin holds finish times; segs collects bars; queue is the ready queue
    const order = procs.map((p, i) => i).sort((a, b) => procs[a].arr - procs[b].arr || a - b);  // order: the process numbers sorted by arrival time (ties by number), the order in which they will be let into the queue
    let t = 0, k = 0, done = 0, disp = 0, ovh = 0, oneQ = 0;  // t is the clock (it may hold fractions); k is the next process to admit; then counters for finished, dispatches, overhead time and one-quantum jobs
    const admit = () => { while (k < n && procs[order[k]].arr <= t + 1e-9) queue.push(order[k++]); };  // admit(): moves every process that has arrived by time t into the queue; the tiny 1e-9 allows for rounding errors in fractional times
    while (done < n) {  // loops until every process has finished
      admit();  // lets in anyone who has arrived by now
      if (!queue.length) { t = procs[order[k]].arr; continue; }  // if nobody is ready, the clock jumps to the next arrival and the loop starts over
      const p = queue.shift();  // p: takes the process at the front of the queue
      if (c > 0) { segs.push({ p: -2, a: t, b: t + c }); t += c; ovh += c; }  // if switching costs time, a switch bar (p = -2, drawn red) of length c comes first, and its time is added to the overhead
      disp++;  // counts this dispatch
      const r = Math.min(q, rem[p]);  // r: the process runs for a whole quantum, or less if it needs less
      segs.push({ p, a: t, b: t + r }); t += r; rem[p] -= r;  // adds its bar to the timeline, moves the clock past it and subtracts the work done
      admit();  // admits anyone who arrived during that turn, so they queue ahead of the process that was just cut off
      if (rem[p] > 1e-9) queue.push(p); else { fin[p] = t; done++; if (procs[p].svc <= q) oneQ++; }  // work left (more than a rounding error): back of the queue; otherwise record the finish, and count it if it fit in one quantum
    }  // ends the loop
    return { fin, segs, T: t, disp, ovh, oneQ };  // returns finish times, bars, end time, number of dispatches, total overhead and the one-quantum count
  }  // ends rrCost

  /* ioMix(mode, q, H, zb, zio): processor-bound X and Y share the processor with I/O-bound Z, which needs zb units
     of processor time, then zio units of I/O, forever. mode 'rr' or 'vrr'. Returns who ran in each unit and Z's state.
     Under VRR, Z returning from I/O with quantum left over joins the auxiliary queue (served first) and may use only
     that leftover; once its quantum since the last main-queue pick is used up it goes back to the main queue. */
  function ioMix(mode, q, H = 36, zb = 1, zio = 3) {  // ioMix(): a small round robin simulation with two processor-bound processes and one I/O-bound one, for the virtual round robin tab
    const main = [0, 1, 2], aux = [], cpu = [], zst = [], waits = [];  // X, Y and Z (0, 1, 2) start in the main queue; aux is the auxiliary queue; cpu, zst and waits record who ran, Z's state and Z's waits
    let run = -1, budget = 0, zLeft = zb, ioEnd = -1, zKeep = 0, readyAt = 0, zRan = 0, bursts = 0;  // run: who holds the processor (-1 none); budget: units left in this turn; then Z's burst left, I/O end time, kept quantum, ready time and counters
    for (let t = 0; t < H; t++) {  // one pass per time unit, for H units in all
      if (ioEnd === t) { zLeft = zb; ioEnd = -1; readyAt = t; if (mode === 'vrr' && zKeep > 0) aux.push(2); else main.push(2); }  // when Z's I/O ends: a new burst starts and Z is ready now; under VRR with quantum left over it joins the auxiliary queue, else the main queue
      if (run === 2 && zLeft === 0) { bursts++; zKeep = budget; ioEnd = t + zio; run = -1; }  // Z just finished its burst: count it, keep the unused part of its quantum, start its I/O and free the processor
      else if (run >= 0 && budget === 0) { if (run === 2) { zKeep = 0; readyAt = t; } main.push(run); run = -1; }  // a process used up its turn: Z loses any kept leftover; the process goes to the back of the main queue and the processor is freed
      if (run < 0) {  // the processor is free, so the dispatcher picks
        if (mode === 'vrr' && aux.length) { run = aux.shift(); budget = zKeep; }  // VRR serves the auxiliary queue first, and the process may use only the leftover quantum it kept
        else if (main.length) { run = main.shift(); budget = q; }  // otherwise the front of the main queue runs with a full quantum q
        if (run === 2) waits.push(t - readyAt);  // whenever Z is picked, how long it waited since becoming ready is recorded
      }  // closes the dispatch step
      cpu.push(run);  // records who runs during this unit (-1 = idle)
      zst.push(run === 2 ? 'run' : ioEnd > t ? 'io' : 'wait');  // records Z's state for this unit: running, busy with I/O, or waiting for the processor
      budget--;  // one unit of the turn is used up
      if (run === 2) { zLeft--; zRan++; }  // if Z ran, its burst shrinks by one and its total running time grows by one
    }  // ends the loop over time units
    return { cpu, zst, share: zRan / H, waits, meanWait: avg(waits), bursts };  // returns who ran, Z's states, Z's share of the processor, Z's waits and their mean, and how many bursts Z finished
  }  // ends ioMix

  /* Prediction of the next burst: S[i] is the estimate made before observation i is known (S[0] = initial guess). */
  const expAvg = (T, a, s0) => T.reduce((S, x, i) => (S.push(a * x + (1 - a) * S[i]), S), [s0]);  // expAvg(): exponential averaging; each new estimate is a times the latest burst plus (1 - a) times the old estimate, starting from s0
  const simpleAvg = (T, s0) => T.reduce((S, x, i) => (S.push((S[i] * i + x) / (i + 1)), S), [s0]);  // simpleAvg(): the plain mean of every burst so far, updated from the previous mean; S[1] is just the first burst

  /* fairShare(o): once per second, halve every CPU count and group count, recompute
     P = base + CPU/2 + GCPU/(4W) (integer division), and give the whole next second (o.ticks clock ticks)
     to the lowest P; ties go to the process that has waited longest. Weights are in tenths (5 = 0.5). */
  function fairShare(o) {  // fairShare(o): simulates fair-share scheduling second by second and returns one row per second plus each process's share
    const n = o.procs.length, cpu = Array(n).fill(0), gcpu = o.w10.map(() => 0), last = Array(n).fill(-1), runs = Array(n).fill(0), rows = [];  // n counts processes; cpu and gcpu are recent processor use per process and per group; last is when each last ran; runs counts its seconds
    for (let s = 0; s < o.secs; s++) {  // one pass per simulated second
      if (s > 0) { for (let j = 0; j < n; j++) cpu[j] = Math.floor(cpu[j] / 2); for (let k = 0; k < gcpu.length; k++) gcpu[k] = Math.floor(gcpu[k] / 2); }  // after the first second, every count is halved (rounded down), so old processor use fades away
      const gterm = (g) => (o.group ? Math.floor((gcpu[g] * 10) / (4 * o.w10[g])) : 0);  // gterm(g): the group part of the priority, GCPU/(4W); weights are stored in tenths, so it multiplies by 10; zero when groups are ignored
      const P = o.procs.map((p, j) => o.base + Math.floor(cpu[j] / 2) + gterm(p.g));  // P: each process's priority number, base + CPU/2 + group part, all rounded down; a lower number means it runs sooner
      let r = 0;  // r: the process chosen to run this second, starting with the first
      for (let j = 1; j < n; j++) if (P[j] < P[r] || (P[j] === P[r] && last[j] < last[r])) r = j;  // looks for the lowest P; on a tie, the process that ran longest ago wins
      rows.push({ s, cpu: cpu.slice(), gcpu: gcpu.slice(), P, run: r });  // records this second's counts, priorities and choice for the table on screen
      cpu[r] += o.ticks; gcpu[o.procs[r].g] += o.ticks; last[r] = s; runs[r]++;  // the chosen process uses the whole second: its own count and its group's count rise by o.ticks, and its last run and total are updated
    }  // ends the loop over seconds
    return { rows, runs, share: runs.map((x) => x / o.secs) };  // returns the rows, the seconds each process got, and each process's share of the time
  }  // ends fairShare
  /* ENGINE-END */

  /* ------------------------------------------------------------------
     Shared display helpers: names, tokens, Gantt charts, captions, queues
     ------------------------------------------------------------------ */
  const f2 = (x) => (x == null || !isFinite(x) ? '—' : x.toFixed(2));  // f2(x): writes a number with exactly 2 decimals, or a dash when there is no value or it is infinite
  const PN = (i) => NAMES[i] || '?';  // PN(i): the letter name of process i, or ? if there is no such letter
  const andList = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);  // andList(a): joins a list the way people write it, e.g. "A, B and C"
  const tok = (ctx, i, small, cls) => ctx.h('span', { class: 'tk pc' + (i % 6) + (cls ? ' ' + cls : '') }, PN(i), small != null ? ctx.h('small', {}, small) : null);  // tok(): a small coloured badge for process i (6 colours, by number), with an optional small number inside and an extra class
  function say(box, kind, head, html) { box.className = 'msg ' + (kind || ''); box.innerHTML = (head ? `<b class="h">${head}</b>` : '') + html; }  // say(box, kind, head, html): fills a message box; kind sets its colour (ok, bad, info) and head is an optional bold heading above the text
  const POL = {  // POL: a short description of every policy for the lab: short name, full name, decision mode and selection function
    fcfs: { name: 'FCFS', long: 'First-come-first-served', mode: 'Nonpreemptive', fn: 'max[w]' },  // FCFS: never interrupts; picks the longest wait, max[w]
    rr: { name: 'RR', long: 'Round robin', mode: 'Preemptive at the end of each quantum', fn: 'constant (everyone in turn)' },  // round robin: interrupts at the end of each quantum; everyone simply takes turns
    spn: { name: 'SPN', long: 'Shortest process next', mode: 'Nonpreemptive', fn: 'min[s]' },  // SPN: never interrupts; picks the shortest service time, min[s]
    srt: { name: 'SRT', long: 'Shortest remaining time', mode: 'Preemptive when a process arrives', fn: 'min[s − e]' },  // SRT: may interrupt when a process arrives; picks the least time left, min[s - e]
    hrrn: { name: 'HRRN', long: 'Highest response ratio next', mode: 'Nonpreemptive', fn: 'max[(w + s)/s]' },  // HRRN: never interrupts; picks the highest response ratio
    fb: { name: 'Feedback', long: 'Multilevel feedback', mode: 'Preemptive at the end of each quantum', fn: 'highest non-empty queue, FCFS inside it' },  // feedback: interrupts at the end of each quantum; serves the highest queue with anyone in it, FCFS inside the queue
  };  // closes POL
  const VARIANTS = [['FCFS', 'fcfs', {}], ['RR q=1', 'rr', { q: 1 }], ['RR q=4', 'rr', { q: 4 }], ['SPN', 'spn', {}], ['SRT', 'srt', {}],  // VARIANTS: the eight runs the lab compares side by side, each as label, policy and options; first FCFS, two round robins, SPN and SRT
    ['HRRN', 'hrrn', {}], ['FB q=1', 'fb', { fb: '1' }], ['FB q=2ⁱ', 'fb', { fb: '2i' }]];  // then HRRN and the two feedback versions (quantum 1 everywhere, or 2 to the power i in queue i); closes the list
  /* A seeded random workload: first arrival at 0, gaps of 0-3, service times 1-7. */
  function randomWorkload(seed, n = 5) {  // randomWorkload(seed, n): a repeatable random workload of n processes; the same seed always gives the same workload
    let x = (seed >>> 0) || 1;  // x is the generator's state, made a whole positive 32-bit number; 0 is replaced by 1 because this generator would stay at 0 forever
    const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return (x % 10007) / 10007; };  // rnd(): a xorshift generator, which scrambles x with bit shifts and exclusive-or, then returns a fraction from 0 up to 1
    let t = 0;  // t: the arrival time of the next process
    return Array.from({ length: n }, (_, i) => { if (i) t += Math.floor(rnd() * 4); return { arr: t, svc: 1 + Math.floor(rnd() * 7) }; });  // builds n processes: after the first, each arrives 0 to 3 units after the one before, and each needs 1 to 7 units
  }  // ends randomWorkload

  /* gantt(ctx, procs, segs, o): time runs left to right. One lane per process (arrival ▼, dashed = waiting,
     bar = running) or, with o.rows, any set of lanes. o.upTo hides everything after that time (for players),
     o.cursor draws the "now" line, o.right(i) writes text at the right end of a lane. */
  function gantt(ctx, procs, segs, o = {}) {  // gantt(): builds a Gantt chart as SVG (the browser's drawing format) and returns it; every timeline in the section comes from here
    const { s } = ctx;  // s builds SVG elements, the same way h builds HTML ones
    const T = Math.max(1, o.T), W = ctx.narrow ? Math.min(o.W || 640, 360) : o.W || 640, LW = o.labelW ?? 34, RW = o.rightW || 0, rh = o.rowH || 22, gap = o.gap ?? 5;  // T: time span shown (at least 1); W: width (at most 360 on phone-width screens); then label column, right text column, row height and gap
    const rows = o.rows || procs.map((p, i) => ({ label: o.label ? o.label(i) : PN(i), i }));  // rows: the lanes to draw: the caller's own list, or one lane per process labelled with its letter
    const top = 7, yb = top + rows.length * (rh + gap) - gap + 3, H = yb + 16;  // top is the space above the first lane; yb is the height of the time axis, just below the last lane; H adds room for the axis numbers
    const x0 = LW, x1 = W - RW - 10, X = (tt) => x0 + (Math.max(0, Math.min(tt, T)) / T) * (x1 - x0);  // x0 and x1 are the left and right ends of the time axis; X(tt) turns a time into an x position, clamped to the range 0 to T
    const up = o.upTo == null ? Infinity : o.upTo;  // up: the time after which nothing is drawn yet (no limit if upTo is missing), so an animation can reveal the chart bit by bit
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': o.aria || 'Gantt chart: time runs from left to right' });  // svg: the drawing, scaled to fill the box width; role and aria-label describe it to screen readers
    const per = (x1 - x0) / T, step = [1, 2, 5, 10, 20, 25, 50, 100].find((k) => k * per >= 22) || 100;  // per is pixels per time unit; step is the smallest tick spacing that leaves at least 22 pixels between the axis numbers
    for (let tt = 0; tt <= T + 1e-9; tt += step) svg.append(s('line', { x1: X(tt), x2: X(tt), y1: top - 4, y2: yb, class: 'gl' }), s('text', { x: X(tt), y: yb + 13, 'text-anchor': 'middle', class: 'ax' }, String(tt)));  // at every tick: a faint vertical grid line, and the time written under the axis
    const bar = (g, y, p) => {  // bar(g, y, p): draws one bar, for segment g, in the lane whose top is at y
      if (p === -1 || g.a >= up) return;  // idle stretches (-1) and bars that start after the visible time are not drawn
      const w = X(Math.min(g.b, up)) - X(g.a);  // w: the bar's width in pixels, cut off at the visible time
      svg.append(s('rect', { x: X(g.a), y, width: Math.max(w, 1), height: rh, rx: 3, class: p === -2 ? 'pcx' : 'pc' + ((o.color ? o.color(p) : p) % 6), 'stroke-width': p === -2 ? 0 : 1.5 }));  // draws the bar: red for switching overhead (-2), otherwise the process's colour (or the one o.color picks), at least 1 pixel wide
      if (p >= 0 && w >= (ctx.narrow ? 11 : 13) && o.letters !== false) svg.append(s('text', { x: X(g.a) + w / 2, y: y + rh / 2 + 1, class: 'bl' }, o.name ? o.name(p) : PN(p)));  // writes the process letter (or o.name's label) in the middle of the bar, only if the bar is wide enough (11 pixels on phone-width screens, else 13)
    };  // ends bar
    rows.forEach((r, k) => {  // draws each lane in turn, from top to bottom
      const y = top + k * (rh + gap);  // y: the top of this lane
      svg.append(s('text', { x: 2, y: y + rh / 2 + 5, class: 'lbl', style: r.small ? 'font-size:13px' : null }, r.label));  // the lane's label on the left, in a smaller font for rows marked small
      if (r.i != null && !r.segs) {  // a lane that belongs to one process (rather than a ready-made list of bars)
        const p = procs[r.i], fin = o.fin ? o.fin[r.i] : null;  // p is that process; fin is its finish time, if the caller passed the finish times
        if (p.arr <= up && o.waits !== false) {  // if the process has arrived within the visible time and waiting boxes are wanted
          const end = Math.min(fin == null ? T : fin, up);  // end: the waiting box lasts until the process finishes (or to the end of the chart), cut off at the visible time
          if (end > p.arr) svg.append(s('rect', { x: X(p.arr), y: y + 2, width: X(end) - X(p.arr), height: rh - 4, rx: 4, class: 'wait' }));  // draws the dashed waiting box from arrival to end; the running bars are drawn on top of it
        }  // closes the waiting-box case
        if (p.arr <= up && o.arrows !== false) svg.append(s('path', { d: `M${X(p.arr) - 5},${y - 5} L${X(p.arr) + 5},${y - 5} L${X(p.arr)},${y + 2} Z`, class: 'arrm' }));  // draws the small downward triangle that marks the arrival time, unless arrows are switched off
        segs.filter((g) => g.p === r.i).forEach((g) => bar(g, y, r.i));  // draws this process's own bars
      } else (r.segs || segs).forEach((g) => bar(g, y, g.p));  // any other lane (the CPU row, or a row per policy) draws every bar it is given, each in its process's colour
      if (o.right) svg.append(s('text', { x: W - RW + 2, y: y + rh / 2 + 5, class: 'ax', style: 'font-size:13px;fill:var(--ink-2)' }, o.right(r.i != null ? r.i : k)));  // optional text at the right end of the lane, such as a turnaround figure
    });  // ends the loop over lanes
    if (o.cursor != null) svg.append(s('line', { x1: X(o.cursor), x2: X(o.cursor), y1: 0, y2: yb + 3, class: 'cur' }));  // the "now" line: a vertical accent line at the cursor time, if one was asked for
    return svg;  // returns the finished drawing to the caller
  }  // ends gantt

  /* narrate(sim, procs, t): the caption for frame t, built only from the simulation's own events. */
  function narrate(sim, procs, t) {  // narrate(): writes the caption for frame t from the simulation's own events, so the words always match the chart
    const f = sim.frames[t], N = (i) => `<b>${PN(i)}</b>`, out = [];  // f: the snapshot at time t; N(i) writes a process letter in bold; out collects the sentences
    const goE = f.ev.find((e) => e.k === 'go');  // goE: the dispatch event at this instant, if there is one
    const why = (e) => {  // why(e): explains why the dispatcher picked the process named in dispatch event e
      const pool = f.pool || [e.p];  // pool: the candidates that were compared (or just the chosen one)
      if (pool.length < 2 && sim.pol !== 'fb') return `${N(e.p)} is the only process ready, so it runs.`;  // with only one candidate there is nothing to compare (feedback is skipped here because it always names the queue)
      if (sim.pol === 'fcfs') return `${N(e.p)} has waited longest (max[w]), so it runs.`;  // FCFS: the chosen process has waited longest
      if (sim.pol === 'rr') return `${N(e.p)} is at the front of the queue and gets a quantum of ${sim.opt.q || 1}.`;  // round robin: it is at the front of the queue and gets one quantum
      if (sim.pol === 'spn') return 'Service times: ' + pool.map((i) => `${PN(i)} ${procs[i].svc}`).join(', ') + ` → shortest is ${N(e.p)}.`;  // SPN: lists every candidate's service time and names the shortest
      if (sim.pol === 'srt') return 'Time left: ' + pool.map((i) => `${PN(i)} ${f.rem[i]}`).join(', ') + ` → least is ${N(e.p)}.`;  // SRT: lists every candidate's time left and names the least
      if (sim.pol === 'hrrn') return 'Ratios (w + s)/s: ' + pool.map((i) => { const w = t - procs[i].arr - (procs[i].svc - f.rem[i]); return `${PN(i)} (${w}+${procs[i].svc})/${procs[i].svc} = ${f2((w + procs[i].svc) / procs[i].svc)}`; }).join(', ') + ` → largest is ${N(e.p)}.`;  // HRRN: works out each candidate's response ratio (w + s)/s with the numbers filled in, then names the largest
      return `${N(e.p)} is first in RQ${e.lvl}, the highest queue with anyone in it (quantum ${sim.opt.fb === '2i' ? 2 ** e.lvl : 1}).`;  // feedback: names the queue the process came from and that queue's quantum
    };  // ends why
    for (const e of f.ev) {  // one sentence per event at this instant, in the order the engine recorded them
      if (e.k === 'fin') out.push(`${N(e.p)} finishes: Tr = ${t} − ${procs[e.p].arr} = ${t - procs[e.p].arr}.`);  // a finish: shows the turnaround sum, finish time minus arrival time
      else if (e.k === 'arr') out.push(`${N(e.p)} arrives needing ${procs[e.p].svc}.`);  // an arrival, with the time the process needs
      else if (e.k === 'tq') out.push(goE && goE.p === e.p ? `${N(e.p)}’s quantum ends, but nobody else is waiting, so it carries on.` : `${N(e.p)}’s quantum ends: back of the queue.`);  // a quantum end: if the same process was picked again it carries on, otherwise it goes to the back of the queue
      else if (e.k === 'down') out.push(`${N(e.p)} used its quantum while others wait, so it drops to RQ${e.lvl}.`);  // feedback: the process used its quantum while others wait, so it drops one queue
      else if (e.k === 'stay') out.push(`${N(e.p)} used its quantum, but nobody else is waiting, so it stays in RQ${f.lvl[e.p]} and keeps going.`);  // feedback: quantum used but nobody else waiting, so it stays where it is
      else if (e.k === 'pre') out.push(`${N(e.by)} needs only ${f.rem[e.by]}, less than the ${f.rem[e.p]} that ${N(e.p)} still needs, so ${N(e.p)} is preempted.`);  // SRT preemption: compares the newcomer's time left with what the running process still needs
      else if (e.k === 'keep') out.push(`${N(e.p)} has ${f.rem[e.p]} left, no more than anyone waiting, so it keeps the processor.`);  // SRT: the running process keeps going because nobody waiting needs less
      else if (e.k === 'idle') out.push('Nobody is ready, so the processor sits idle.');  // nobody is ready: the processor is idle
      else if (e.k === 'go' && f.ev.some((x) => x.k === 'pre')) out.push(`${N(e.p)} takes over.`);  // a dispatch right after a preemption: the newcomer simply takes over (the reason was just given)
      else if (e.k === 'go' && !f.ev.some((x) => x.k === 'tq' && x.p === e.p)) out.push(why(e));  // any other dispatch, unless it is the same process carrying on after its quantum, gets its reason from why()
    }  // ends the loop over events
    if (t === sim.T) out.push(`All done. Mean Tr = ${f2(sim.meanTr)}, mean Tr/Ts = ${f2(sim.meanNtr)}.`);  // at the final instant: the two means for the whole run
    else if (f.run >= 0 && !f.ev.length) out.push(`${N(f.run)} keeps running (${f.rem[f.run]} left).`);  // on a quiet instant (no events), says the running process carries on and how much it still needs
    return `<b>t = ${t}.</b> ` + out.join(' ');  // the finished caption: the time in bold, then the sentences
  }  // ends narrate

  /* queueView(ctx, sim, t): the ready queue(s) and the processor at frame t. Small numbers = time still needed. */
  function queueView(ctx, sim, t) {  // queueView(): draws the ready queue(s) and the processor at frame t as rows of process badges
    const { h } = ctx, f = sim.frames[t];  // h builds HTML elements; f is the snapshot at time t
    const lane = (label, sub, ids, cls) => h('div', { class: 'lane ' + (cls || '') }, h('div', { class: 'ln' }, label, h('small', {}, sub)),  // lane(label, sub, ids, cls): one row: a name with a small subtitle on the left, then the badges
      h('div', { class: 'toks' }, ...(ids.length ? ids.map((i) => tok(ctx, i, f.rem[i])) : [h('span', { class: 'empty' }, 'empty')])));  // each badge shows a process and the time it still needs; an empty queue just says "empty"
    const cpu = lane('CPU', 'running', f.run >= 0 ? [f.run] : [], 'cpu');  // cpu: the processor row, holding the running process if there is one
    const one = ctx.narrow ? ' one' : '';  // one: on phone-width screens the rows are stacked in a single column
    if (sim.pol === 'fb') return h('div', { class: 'qgrid fbq' + one }, ...f.q.map((ids, k) => lane('RQ' + k, 'quantum ' + (sim.opt.fb === '2i' ? 2 ** k : 1), ids)), cpu);  // feedback: one row for each queue RQ0 to RQ3 with its quantum, then the processor
    return h('div', { class: 'qgrid' + one }, lane('Ready', 'queue', f.q[0]), cpu);  // every other policy: the single ready queue beside the processor
  }  // ends queueView

  Guide.section({  // registers this section with the guide: its titles, goals, key terms, styles and steps
    id: '9.2',  // the section number, used in the contents list and in links
    title: 'Scheduling Algorithms',  // the full title shown in headings
    short: 'Scheduling algorithms',  // a shorter title for the contents list
    summary: 'Run FCFS, round robin, SPN, SRT, HRRN, feedback and fair-share scheduling, and judge each by the numbers.',  // the one-line summary shown on the chapter overview
    objectives: [  // objectives: what a student should be able to do after this section
      'Name the user-oriented and system-oriented scheduling criteria and explain why they pull against each other.',  // objective 1: the scheduling criteria and why they conflict
      'Describe any scheduling policy by its selection function (written with w, e and s) and its decision mode.',  // objective 2: describing a policy by its selection function and decision mode
      'Simulate FCFS, round robin, SPN, SRT, HRRN and feedback scheduling and compute finish, turnaround and normalized turnaround times.',  // objective 3: simulating the six policies and computing finish and turnaround times
      'Explain the quantum trade-off, virtual round robin, exponential averaging, and which policies can starve long processes.',  // objective 4: the quantum trade-off, virtual round robin, exponential averaging and starvation
      'Compute fair-share priorities and predict how groups of processes split the processor.',  // objective 5: fair-share priorities and how groups split the processor
    ],  // closes the objectives
    terms: [  // terms: this section's glossary entries as [term, definition]; dotted words on the slides open these definitions
      ['Service time', 'The total processor time a process needs to finish its work (written Ts, or s in a selection function). It usually has to be estimated in advance.'],  // glossary entry: service time, the processor time a process needs
      ['Normalized turnaround time', 'Turnaround time divided by service time (Tr/Ts). A value of 1.0 means the process never waited; larger values mean a longer delay relative to the work it needed.'],  // glossary entry: normalized turnaround time, Tr divided by Ts
      ['Processor utilization', 'The percentage of time the processor is busy doing useful work rather than sitting idle.'],  // glossary entry: processor utilization
      ['Selection function', 'The rule a scheduling policy uses to pick which ready process runs next, usually written in terms of w (time waited), e (time executed) and s (total service time).'],  // glossary entry: selection function, written with w, e and s
      ['Decision mode', 'When a policy is allowed to make its choice: only when the running process ends or blocks (nonpreemptive) or also by interrupting it (preemptive).'],  // glossary entry: decision mode, nonpreemptive or preemptive
      ['Nonpreemptive scheduling', 'Once a process is running it keeps the processor until it finishes or blocks itself, for example to wait for I/O.'],  // glossary entry: nonpreemptive scheduling
      ['Preemptive scheduling', 'The OS may interrupt the running process and move it back to Ready, for example when a new process arrives or a clock interrupt marks the end of a quantum.'],  // glossary entry: preemptive scheduling
      ['Processor-bound process', 'A process that mostly computes: it uses long stretches of processor time and does little I/O. Also called CPU-bound.'],  // glossary entry: processor-bound (CPU-bound) process
      ['I/O-bound process', 'A process that mostly waits for I/O: it runs for short bursts, then blocks for a device, again and again.'],  // glossary entry: I/O-bound process
      ['First-come-first-served (FCFS)', 'A nonpreemptive policy that always runs the process that has waited longest in the ready queue. Also called FIFO.'],  // glossary entry: first-come-first-served (FCFS)
      ['Round robin (RR)', 'A preemptive policy that gives each ready process one quantum in turn; when its quantum ends, the running process goes to the back of the ready queue.'],  // glossary entry: round robin (RR)
      ['Virtual round robin (VRR)', 'A round robin variant in which processes coming back from I/O wait in an auxiliary queue that is served before the main ready queue, and run only for what was left of their quantum.'],  // glossary entry: virtual round robin (VRR) and its auxiliary queue
      ['Shortest process next (SPN)', 'A nonpreemptive policy that runs the waiting process with the shortest expected service time.'],  // glossary entry: shortest process next (SPN)
      ['Shortest remaining time (SRT)', 'The preemptive version of SPN: the process with the shortest expected remaining time runs, and a new arrival with less time left takes over the processor.'],  // glossary entry: shortest remaining time (SRT), the preemptive version of SPN
      ['Exponential averaging', 'Predicting the next value as a weighted blend of the latest observation and the previous prediction, S(n+1) = αT(n) + (1 − α)S(n), so older observations count less and less.'],  // glossary entry: exponential averaging and its formula
      ['Response ratio', 'R = (w + s) / s, where w is the time a process has waited so far and s its expected service time. It starts at 1.0 and grows while the process waits.'],  // glossary entry: response ratio R = (w + s)/s, which starts at 1.0 and grows while a process waits
      ['Highest response ratio next (HRRN)', 'A nonpreemptive policy that runs the waiting process with the largest response ratio, favouring short jobs while letting long ones age their way to the front.'],  // glossary entry: highest response ratio next (HRRN)
      ['Feedback scheduling', 'A preemptive policy with several ready queues of falling priority: a new process starts in the top queue and drops one queue each time it is preempted, so long-running processes sink. Also called multilevel feedback.'],  // glossary entry: feedback (multilevel feedback) scheduling and its sinking queues
      ['Aging', 'Raising the priority of a process the longer it waits, so that it cannot be passed over forever.'],  // glossary entry: aging, raising priority the longer a process waits
      ['Fair-share scheduling', 'Scheduling that divides the processor among groups of processes (for example users) according to each group’s share, instead of treating every process separately.'],  // glossary entry: fair-share scheduling, dividing the processor among groups
    ],  // closes the glossary list

    css: ` /* css: this section's own styles, added to the page when the section registers; every rule starts with .sec-9-2 so it touches only this section */
      .sec-9-2 svg { display: block; } /* makes every drawing a block, so no stray gap appears under it as it would under a line of text */
      .sec-9-2 svg .pc0 { fill: color-mix(in srgb, var(--cpu) 30%, var(--panel)); stroke: var(--cpu); } /* process colour 0 (processor blue): a pale fill mixed 30% into the panel colour with a solid outline; Gantt bars of process A use it */
      .sec-9-2 svg .pc1 { fill: color-mix(in srgb, var(--mem) 30%, var(--panel)); stroke: var(--mem); } /* process colour 1 (memory colour), used for process B's bars */
      .sec-9-2 svg .pc2 { fill: color-mix(in srgb, var(--io) 30%, var(--panel)); stroke: var(--io); } /* process colour 2 (I/O colour), used for process C's bars */
      .sec-9-2 svg .pc3 { fill: color-mix(in srgb, var(--os) 30%, var(--panel)); stroke: var(--os); } /* process colour 3 (OS colour), used for process D's bars */
      .sec-9-2 svg .pc4 { fill: color-mix(in srgb, var(--thread) 30%, var(--panel)); stroke: var(--thread); } /* process colour 4 (thread colour), used for process E's bars */
      .sec-9-2 svg .pc5 { fill: color-mix(in srgb, var(--proc) 30%, var(--panel)); stroke: var(--proc); } /* process colour 5 (process colour), used for a sixth process F */
      .sec-9-2 svg .pcx { fill: var(--intr); stroke: var(--intr); } /* solid red bars for switching overhead, the time lost between turns in the quantum chart */
      .sec-9-2 svg .wait { fill: none; stroke: var(--line-2); stroke-width: 1.5; stroke-dasharray: 3 3; } /* waiting box: no fill and a dashed grey outline, so waiting time shows but stays quieter than the running bars */
      .sec-9-2 svg .gl { stroke: var(--line); stroke-width: 1; } /* faint vertical grid lines at each time tick */
      .sec-9-2 svg .ax { font-size: 12.5px; fill: var(--muted); } /* axis numbers and small labels: small and muted grey */
      .sec-9-2 svg .lbl { font-size: 14px; font-weight: 800; } /* lane labels (the process letters at the left): bold */
      .sec-9-2 svg .bl { font-size: 13px; font-weight: 800; text-anchor: middle; dominant-baseline: central; pointer-events: none; } /* letters inside bars: bold and centred both ways; pointer-events none lets clicks pass through them */
      .sec-9-2 svg .cur { stroke: var(--accent); stroke-width: 2.5; } /* the "now" line: a thick line in the accent colour */
      .sec-9-2 svg .fut { opacity: .18; } /* a faded style for parts of a drawing that lie in the future; none of the current charts uses it */
      .sec-9-2 svg .arrm { fill: var(--ink-2); } /* arrival triangles: filled with the secondary text colour */
      .sec-9-2 .tk { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 32px; height: 30px; padding: 0 7px; /* process badge: a small rounded box with the letter centred, at least 32 pixels wide and 30 tall */
        border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); font-weight: 800; font-size: 15px; flex: none; } /* continues the badge: rounded corners, a border, panel background, bold 15px text; flex: none stops a row from squeezing it */
      .sec-9-2 .tk.pc0 { background: color-mix(in srgb, var(--cpu) 20%, var(--panel)); border-color: var(--cpu); } /* badge colour 0: pale processor blue with a matching border, the same family as the Gantt bars, so process A looks the same everywhere */
      .sec-9-2 .tk.pc1 { background: color-mix(in srgb, var(--mem) 20%, var(--panel)); border-color: var(--mem); } /* badge colour 1, matching process B's bars */
      .sec-9-2 .tk.pc2 { background: color-mix(in srgb, var(--io) 20%, var(--panel)); border-color: var(--io); } /* badge colour 2, matching process C's bars */
      .sec-9-2 .tk.pc3 { background: color-mix(in srgb, var(--os) 20%, var(--panel)); border-color: var(--os); } /* badge colour 3, matching process D's bars */
      .sec-9-2 .tk.pc4 { background: color-mix(in srgb, var(--thread) 20%, var(--panel)); border-color: var(--thread); } /* badge colour 4, matching process E's bars */
      .sec-9-2 .tk.pc5 { background: color-mix(in srgb, var(--proc) 20%, var(--panel)); border-color: var(--proc); } /* badge colour 5, matching process F's bars */
      .sec-9-2 .tk small { font-weight: 600; font-size: 12.5px; color: var(--ink-2); } /* the small number inside a badge (time still needed): smaller and lighter than the letter */
      .sec-9-2 .tk.s { min-width: 24px; height: 22px; padding: 0 5px; font-size: 13.5px; border-radius: 6px; border-width: 1.5px; } /* .s: a smaller badge, used inside table rows */
      .sec-9-2 .lane { display: grid; grid-template-columns: 74px minmax(0, 1fr); align-items: center; gap: 8px; border: 1px solid var(--line); /* queue lane: a two-column grid (a 74-pixel name, then the badges) inside a light bordered box */
        border-radius: 9px; padding: 4px 8px; background: var(--panel-2); min-height: 40px; } /* continues the lane: rounded corners, padding, light background and a minimum height so an empty lane does not collapse */
      .sec-9-2 .lane .ln { font-weight: 800; font-size: 13.5px; line-height: 1.15; } /* the lane name (Ready, CPU, RQ0 ...): bold */
      .sec-9-2 .lane .ln small { display: block; font-weight: 600; font-size: 12.5px; color: var(--muted); } /* the subtitle under the lane name: on its own line, smaller and muted */
      .sec-9-2 .lane .toks { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; min-height: 30px; } /* the badge area: badges in a row with small gaps, wrapping onto a new line when there are many */
      .sec-9-2 .lane .empty { font-size: 13px; color: var(--muted); font-style: italic; } /* the word "empty" in an empty lane: small, muted and italic */
      .sec-9-2 .lane.cpu { border-color: color-mix(in srgb, var(--cpu) 45%, transparent); background: var(--cpu-bg); } /* the processor lane is tinted processor blue so it stands apart from the queues */
      .sec-9-2 .msg { border-radius: 10px; padding: 8px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; } /* message box (captions and results): a rounded light box with readable 15px text */
      .sec-9-2 .msg.ok { border-color: var(--ok); background: var(--ok-bg); } /* green version of the message box, for success and finished results */
      .sec-9-2 .msg.bad { border-color: var(--bad); background: var(--bad-bg); } /* red version, for warnings such as starvation */
      .sec-9-2 .msg.info { border-color: var(--accent); background: var(--accent-bg); } /* accent-coloured version, for ordinary information */
      .sec-9-2 .msg b.h { display: block; font-size: 12.5px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2px; color: var(--accent); } /* the small heading at the top of a message box: on its own line, uppercase, spaced out, in the accent colour */
      .sec-9-2 .msg.ok b.h { color: var(--ok); } .sec-9-2 .msg.bad b.h { color: var(--bad); } /* that heading turns green in a success box and red in a warning box */
      .sec-9-2 .num { font-variant-numeric: tabular-nums; } /* .num: digits of equal width, so numbers in a column line up */
      .sec-9-2 .eq { font-family: var(--mono); font-size: 14.5px; background: var(--panel-3); border-radius: 8px; padding: 6px 10px; } /* .eq: a formula box in a fixed-width font on a tinted background */
      .sec-9-2 table.tbl td.c, .sec-9-2 table.tbl th.c { text-align: center; } /* table cells with class c are centred */
      .sec-9-2 table.tbl td.r, .sec-9-2 table.tbl th.r { text-align: right; } /* table cells with class r are right-aligned */
      .sec-9-2 table.tbl.slim td, .sec-9-2 table.tbl.slim th { padding-left: 4px; padding-right: 4px; } /* .slim tables (used on phone-width screens) have less padding at the sides so every column fits */
      .sec-9-2 table.fsr { border-collapse: collapse; font-variant-numeric: tabular-nums; } /* fair-share results table: no gaps between cells, digits of equal width */
      .sec-9-2 table.fsr th, .sec-9-2 table.fsr td { padding: 0 0 0 10px; text-align: left; white-space: nowrap; } /* its cells: 10 pixels of space on the left only, left-aligned, never wrapping */
      .sec-9-2 table.fsr th:first-child { padding-left: 0; } /* the first column has no left space, so the table lines up with the text above it */
      .sec-9-2 table.fsr .r { text-align: right; } /* number columns of that table are right-aligned */
      .sec-9-2 input.nin { width: 56px; height: 26px; font: inherit; font-size: 14px; text-align: center; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel); color: var(--ink); padding: 0 2px; } /* the small number boxes in the lab where students type arrival and service times: 56 pixels wide, centred, themed border and colours */
      .sec-9-2 .qgrid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 6px; } /* queue view: the ready queue gets twice the width of the processor lane */
      .sec-9-2 .qgrid.fbq { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* feedback queue view: two equal columns, so RQ0 to RQ3 form a 2 x 2 grid */
      .sec-9-2 .qgrid.fbq .lane.cpu { grid-column: 1 / -1; } /* in that grid the processor lane spans the whole width under the queues */
      .sec-9-2 .qgrid.one { grid-template-columns: minmax(0, 1fr); } /* .one: a single column, used on phone-width screens */
    `,  // end of the section's style text

    steps: [  // steps: the section's slides, in order
      /* ---------------- 1. Big picture: the student plays the dispatcher ---------------- */
      {  // step 1 begins
        title: 'One processor, five processes: who runs next?',  // step 1 title, shown above the slide
        kind: 'story',  // kind story: the slide is labelled Big Picture
        render(el, ctx) {  // render(el, ctx): draws the step into el when the slide opens; ctx is the guide's toolbox for this slide
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          let procs = STANDARD.map((p) => ({ ...p })), seed = 0, order = [], t = 0, orders = [], T = 1;  // game state: the workload (a copy of STANDARD), its seed (0 = standard), the picks so far, the clock, all possible orders and the chart length
          const wl = h('p', { class: 'small m0' });  // wl: the line that lists the workload
          const chart = h('div');  // chart: the box that holds the Gantt chart
          const waitRow = h('div', { class: 'row gap-s', style: { minHeight: '34px' } });  // waitRow: the buttons for the processes waiting now; the minimum height stops the layout from jumping
          const info = h('div', { class: 'msg info', style: { minHeight: '92px' } });  // info: the message box for prompts and the final result
          const NAMED = [['fcfs', 'first-come-first-served (FCFS)'], ['spn', 'shortest process next (SPN)'], ['hrrn', 'highest response ratio next (HRRN)']];  // NAMED: the three nonpreemptive policies that the student's picks are compared with at the end
          const nextArrival = () => Math.min(...procs.map((p, i) => (order.includes(i) ? Infinity : p.arr)));  // nextArrival(): the earliest arrival among the processes not picked yet
          function load(list) {  // load(list): starts a new game with the given workload
            procs = list; order = []; t = 0;  // sets the workload and clears the picks and the clock
            ctx.keep.game = { seed, order: [] };  // records the fresh game in ctx.keep, so a redraw for a phone-width or desktop layout can rebuild it
            orders = allOrders(procs);  // orders: every order this game allows
            T = Math.max(...orders.map((o) => runOrder(procs, o).t));  // T: the latest end time of all those orders, so the chart's time axis fits whatever the student picks
            wl.innerHTML = '<b>Workload</b> (arrival, service): ' + procs.map((p, i) => `${PN(i)} (${p.arr}, ${p.svc})`).join(' · ') + (seed ? ` <span class="muted">· random seed ${seed}</span>` : '');  // writes the workload line: each process with (arrival, service), plus the seed for a random workload
            if (!waitingAt(procs, order, t).length) t = nextArrival();  // if nobody has arrived at time 0, the clock jumps to the first arrival
            const w0 = waitingAt(procs, order, t), names = w0.map((x) => '<b>' + PN(x) + '</b>');  // w0: who is waiting at the start; names: their letters in bold
            draw('Start', `<b>t = ${t}.</b> ` + (w0.length === 1 ? `Only ${names[0]} has arrived. Click it to hand it the processor.` : `${andList(names)} have arrived together. Click the one you want to run first.`)  // draws the opening state and tells the student who has arrived and to click one
              + ' Whoever you pick runs until it is finished: no interruptions.');  // adds the rule of the game: the chosen process runs until it is finished
          }  // ends load
          /* fits(pol): true if every one of the student's picks is a process this policy rates best at that moment
             (FCFS max[w], SPN min[s], HRRN max[(w + s)/s]); at a tie either choice fits the rule */
          function fits(pol) {  // fits(pol): replays the student's picks against one policy; 0 = a pick breaks the rule, 1 = every pick fits, 2 = fits, with at least one tie
            let tt = 0, tie = false;  // tt is the replay clock; tie notes whether any pick was made among equally good choices
            for (let k = 0; k < order.length; k++) {  // replays each pick in turn
              const done = order.slice(0, k);  // done: the picks made before this one
              if (!waitingAt(procs, done, tt).length) tt = Math.min(...procs.map((p, j) => (done.includes(j) ? Infinity : p.arr)));  // if nobody was waiting, the replay clock jumps to the next arrival
              const w = waitingAt(procs, done, tt), i = order[k];  // w: who was waiting at that moment; i: the process the student picked
              const score = (j) => (pol === 'fcfs' ? tt - procs[j].arr : pol === 'spn' ? -procs[j].svc : (tt - procs[j].arr + procs[j].svc) / procs[j].svc);  // score(j): how the policy rates process j (FCFS: time waited, SPN: minus service time, HRRN: response ratio); higher is better
              const top = Math.max(...w.map(score));  // top: the best score among those waiting
              if (score(i) < top - 1e-9) return 0;  // if the student's pick scored below the best, this policy would not have chosen it
              if (w.filter((j) => score(j) > top - 1e-9).length > 1) tie = true;  // if more than one process shares the best score, the pick was a tie
              tt = Math.max(tt, procs[i].arr) + procs[i].svc;  // the replay clock moves past the chosen process's run
            }  // ends the replay loop
            return tie ? 2 : 1;  // every pick fitted: 2 if any of them was a tie, 1 if none was
          }  // ends fits
          function draw(head, html) {  // draw(head, html): redraws the chart, the waiting buttons and the message box after every change
            const r = runOrder(procs, order), done = order.length === procs.length;  // r: the student's schedule so far, played out by runOrder; done: true once every process has been picked
            chart.replaceChildren(gantt(ctx, procs, r.segs, { T, fin: r.fin, upTo: done ? null : t, cursor: done ? null : t, rightW: 96, rowH: 26, gap: 7,  // draws the chart up to the current time with a "now" line (the whole chart once done), leaving room on the right for results
              right: (i) => (r.fin[i] != null ? `Tr ${r.tr[i]} · ${f2(r.ntr[i])}` : ''), aria: 'Your schedule so far' }));  // at the right of each finished lane: its turnaround Tr and Tr/Ts; aria-label names the chart for screen readers
            const w = done ? [] : waitingAt(procs, order, t);  // w: who is waiting at the current time (nobody once the game is over)
            waitRow.replaceChildren(h('span', { class: 'small b' }, done ? 'All five have finished.' : `Waiting at t = ${t}:`),  // the waiting row starts with a label: the current time, or a note that all five have finished
              ...w.map((i) => h('button', { class: 'btn sm', type: 'button', onclick: () => pick(i), 'aria-label': `Run ${PN(i)}` },  // one button per waiting process; clicking it hands that process the processor
                tok(ctx, i), h('span', { class: 'small' }, `needs ${procs[i].svc}, waited ${t - procs[i].arr}`))));  // each button shows the process badge plus how much it needs and how long it has waited so far
            say(info, done ? 'ok' : 'info', head, html);  // fills the message box: green once finished, otherwise the accent colour
          }  // ends draw
          function pick(i) {  // pick(i): runs when the student clicks a waiting process
            const a = t;  // a remembers when the process starts
            order.push(i); t += procs[i].svc;  // adds it to the order and moves the clock past its whole run (no interruptions in this game)
            ctx.keep.game = { seed, order: order.slice() };  // records the picks so far in ctx.keep, so a layout redraw can replay them
            let msg = `<b>${PN(i)}</b> runs from ${a} to ${t}. `;  // msg starts by saying when the chosen process ran
            if (order.length === procs.length) return finish();  // when the last process has been picked, the game ends with the results
            if (!waitingAt(procs, order, t).length) { const n = nextArrival(); msg += `Nobody is waiting at ${t}, so the processor idles until ${n}. `; t = n; }  // if nobody is waiting now, the processor idles until the next arrival, and the message says so
            const now = waitingAt(procs, order, t);  // now: who is waiting at the new time
            msg += now.length === 1 ? `Now only <b>${PN(now[0])}</b> is waiting.` : `Now ${now.map((x) => '<b>' + PN(x) + '</b>').join(', ')} are waiting. Your call: what matters most to you?`;  // one waiting process: says so; several: names them and asks the student to decide
            draw(`Time ${t}`, msg);  // redraws with the new time as the heading
          }  // ends pick
          function finish() {  // finish(): shows the results once every process has run
            const r = runOrder(procs, order);  // r: the measurements of the student's complete order
            const fit = NAMED.map(([k, n]) => [fits(k), `<b>${n}</b>`]).filter(([x]) => x), same = fit.map(([, n]) => n);  // fit: which named policies agree with every pick (keeping the 1 or 2 from fits); same: just their names
            const res = orders.map((o) => runOrder(procs, o)), best = Math.min(...res.map((x) => x.meanNtr));  // res: the results of every allowed order; best: the lowest mean Tr/Ts any of them reaches
            const isBest = Math.abs(r.meanNtr - best) < 1e-9;  // isBest: true if the student's order reaches that lowest value
            draw('Your schedule', `Order ${order.map(PN).join(' → ')}: mean turnaround <b>${f2(r.meanTr)}</b>, mean normalized turnaround <b>${f2(r.meanNtr)}</b>. `  // the result: the order chosen and its mean Tr and mean Tr/Ts
              + (same.length ? `Every pick you made is what ${same.join(' and ')} would choose${fit.some(([x]) => x === 2) ? ' (where processes tied, either choice fits the rule)' : ''}. ` : 'No classic nonpreemptive policy picks exactly that order. ')  // then which classic policies would have made the same picks (noting ties), or that none would
              + `Of the ${orders.length} orders this game allows, the lowest mean Tr/Ts is ${f2(best)}${isBest ? ' (yours!).' : '. Start over and try to reach it.'}`);  // finally the best possible mean Tr/Ts, and either praise or an invitation to try again
          }  // ends finish
          const btns = h('div', { class: 'row gap-s' },  // btns: the row of game buttons under the chart
            h('button', { class: 'btn sm', type: 'button', onclick: () => load(procs) }, 'Start over'),  // Start over: replays the same workload from the beginning
            h('button', { class: 'btn sm', type: 'button', onclick: () => { seed = seed ? seed + 1 : 41; load(randomWorkload(seed)); } }, 'New random workload'),  // New random workload: the first click uses seed 41, later clicks the next seed, so each workload can be found again
            h('button', { class: 'btn sm', type: 'button', onclick: () => { seed = 0; load(STANDARD.map((p) => ({ ...p }))); } }, 'Standard workload'));  // Standard workload: goes back to the five standard processes
          el.append(h('div', { class: 'split l fill' },  // the slide layout: two columns, the smaller one on the left, filling the full height
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation, stacked with 10-pixel gaps
              h('p', { class: 'lead m0', html: 'A processor runs one process at a time, yet many may be ready. Whenever it falls free, the OS must decide <b>who goes next</b>.' }),  // lead paragraph: the processor runs one process at a time, so someone must choose who goes next
              h('p', { class: 'm0', html: 'That choice belongs to the short-term scheduler, the <span class="t">dispatcher</span>. Its rule is a <b>scheduling algorithm</b> (or policy), and the rule changes how long everyone waits.' }),  // paragraph: names the dispatcher (a dotted glossary term) and the idea of a scheduling algorithm
              h('div', { class: 'callout analogy small m0', 'data-label': 'Analogy', html: 'One barista, a line of orders. Serve strictly in arrival order? Make the quick espressos first? Let the big catering order go once it has waited long enough? Each rule is fair one way and unfair another.' }),  // analogy callout: a barista choosing which order to make next
              h('div', { class: 'callout tip small m0', 'data-label': 'Reading the results', html: '<b>Turnaround</b> Tr = finish − arrival, all the waiting plus all the running. <span class="t" data-t="Normalized turnaround time">Tr/Ts</span> divides it by the service time: 1.00 means no waiting; 3.00 means it took three times as long as its own run.' }),  // tip callout: how to read turnaround Tr and normalized turnaround Tr/Ts in the results
              h('div', { class: 'card tight small', html: '<b>In this section you will</b> learn the yardsticks, meet six classic policies, run each on the same five processes, and see why none of them wins everywhere.' })),  // card: what the student will do in this section
            h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column: the game, in a white card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'You are the dispatcher'), h('span', { class: 'chip warn' }, 'chosen process runs to the end')),  // the game's heading, with a warning chip that the chosen process runs to the end
              h('p', { class: 'xs muted m0', html: '▼ arrival · dashed box = waiting · bar = running · at the right: turnaround Tr and normalized turnaround Tr/Ts' }),  // legend for the chart: arrival marker, dashed waiting box, running bar and the figures on the right
              wl, chart, waitRow, info, btns)));  // then the workload line, chart, waiting buttons, message box and game buttons, in that order
          const kept = ctx.keep.game;  // kept: the game recorded before a phone-width or desktop redraw (nothing on a normal visit)
          if (kept && kept.seed) { seed = kept.seed; procs = randomWorkload(seed); }  // a random workload is rebuilt from its seed (the same seed always gives the same processes)
          load(procs);  // starts the game as soon as the slide opens: the standard workload on a normal visit, the kept one after a redraw
          if (kept) kept.order.forEach((i) => pick(i));  // after a redraw, replays the student's picks in order, so the chart, the message and any final result come back as they were
        },  // ends render for step 1
      },  // ends step 1

      /* ---------------- 2. Scheduling criteria and priorities ---------------- */
      {  // step 2 begins
        title: 'What makes a schedule good?',  // step 2 title
        kind: 'learn',  // kind learn: the slide is labelled Learn
        render(el, ctx) {  // render(el, ctx): draws step 2 when the slide opens
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          /* [name, user|system, perf|other, what it means, a concrete example] */
          const CRIT = [  // CRIT: the nine scheduling criteria, sorted by viewpoint (user or system) and by kind (measurable or not)
            ['Turnaround time', 'user', 'perf', 'The time from submitting a process until it completes: every moment of waiting plus every moment of running. It is the natural yardstick for batch jobs, which you hand in and collect later.', 'A job arrives at 2 and finishes at 9. Its turnaround is 7, although it only needed 6 units of processor time.'],  // criterion: turnaround time, user-oriented and measurable, with a worked example
            ['Response time', 'user', 'perf', 'For an interactive request, the time from submitting it until the response <i>begins</i> to appear. From a user’s chair this matters more than turnaround: a reply that starts quickly feels fast even if it takes a while to finish.', 'A search page that shows its first results after 0.2 s feels instant, even if the full list needs another second.'],  // criterion: response time, the time until a reply begins to appear
            ['Deadlines', 'user', 'perf', 'When processes carry deadlines, the scheduler should finish as many as possible on time. The measure is the percentage of deadlines met, and other goals come second.', 'A video player must decode each frame before it is due on screen. A late frame is a visible stutter, however good the average is.'],  // criterion: deadlines, measured as the share of deadlines met
            ['Predictability', 'user', 'other', 'A given job should take about the same time, and cost about the same, whether the machine is quiet or busy. Wild swings are annoying in themselves and often hint that the system is overloaded.', 'A report that takes 2 minutes on Monday and 20 on Tuesday frustrates people even when the average looks fine.'],  // criterion: predictability, the same job taking about the same time whatever the load
            ['Throughput', 'system', 'perf', 'How many processes the system completes per unit of time. It depends on how long the processes are, but the policy matters too: time spent switching is time not spent finishing work.', 'Finishing 30 jobs an hour instead of 25 on the same hardware is a 20% gain.'],  // criterion: throughput, jobs finished per unit of time
            ['Processor utilization', 'system', 'perf', 'The percentage of time the processor is busy. It is a key measure on an expensive shared machine; on a personal computer, how responsive the machine feels matters far more.', 'If the processor was busy for 45 of the last 60 seconds, utilization is 75%.'],  // criterion: processor utilization, the share of time the processor is busy
            ['Fairness', 'system', 'other', 'Unless told otherwise, the scheduler should treat processes alike, and no process should starve.', 'A long simulation should still get the processor now and then, even while short jobs keep arriving.'],  // criterion: fairness, no process starving
            ['Enforcing priorities', 'system', 'other', 'When processes have been given priorities, the scheduler should favour the more important ones.', 'A process that handles a patient monitor’s alarms must win over a background backup.'],  // criterion: enforcing priorities, favouring more important processes
            ['Balancing resources', 'system', 'other', 'Keep every part of the system busy. Prefer processes that will not pile more work onto a resource that is already overloaded.', 'If the disk queue is long, prefer a process that will compute for a while over one about to issue yet another disk read.'],  // criterion: balancing resources, keeping every part of the system busy
          ];  // closes the CRIT list
          const LAB = { user: 'User-oriented', system: 'System-oriented', perf: 'Performance-related', other: 'Other (qualitative)' };  // LAB: the display names of the two viewpoints and the two kinds
          function criteria(panel) {  // criteria(panel): draws the first tab, the grid of criteria and the detail card
            const detail = h('div', { class: 'card white stack', style: { gap: '8px' } });  // detail: the card on the right that explains the chosen criterion
            const btns = [];  // btns: the criterion buttons, kept so the chosen one can be highlighted
            const show = (k) => {  // show(k): displays criterion k in the detail card
              const [name, who, kind, def, ex] = CRIT[k];  // unpacks the criterion's name, viewpoint, kind, definition and example
              btns.forEach((b, j) => b.classList.toggle('on', j === k));  // highlights the chosen button and clears the others
              detail.replaceChildren(  // replaces the detail card's contents with the three parts below
                h('div', { class: 'row gap-s' }, h('h3', { class: 'm0' }, name), h('span', { class: 'chip ' + (who === 'user' ? 'proc' : 'os') }, LAB[who]), h('span', { class: 'chip' }, LAB[kind])),  // a heading row: the name plus two chips, one for the viewpoint (coloured by user or system) and one for the kind
                h('p', { class: 'm0', html: def }),  // the definition
                h('div', { class: 'callout tip small m0', 'data-label': 'Example', html: ex }));  // the worked example in a tip callout
            };  // ends show
            const cell = (who, kind) => h('div', { class: 'card tight stack', style: { gap: '6px' } }, ...CRIT.map((c, k) => {  // cell(who, kind): one box of the grid, holding a button for every criterion of that viewpoint and kind
              if (c[1] !== who || c[2] !== kind) return null;  // criteria from another box are skipped
              const b = h('button', { class: 'btn sm', type: 'button', style: { justifyContent: 'flex-start' }, onclick: () => show(k) }, c[0]);  // the button shows the criterion's name; clicking it shows that criterion
              btns[k] = b; return b;  // remembers the button so it can be highlighted later
            }).filter(Boolean));  // removes the skipped (empty) entries
            const hd = (t, sub) => h('div', { class: 'small b', style: { alignSelf: ctx.narrow ? 'start' : 'end' } }, t, h('div', { class: 'xs muted', style: { fontWeight: 500 } }, sub));  // hd(t, sub): a bold row or column heading with a small grey explanation under it
            /* on a small screen the 2 × 2 grid becomes one column, so each box carries its own column label */
            const sub = (t) => h('div', { class: 'xs muted b' }, t);  // sub(t): a small grey label put above each box in the one-column phone layout
            const grid = ctx.narrow ? h('div', { class: 'stack', style: { gap: '6px' } },  // on phone-width screens the grid becomes one column
              hd('User-oriented', 'what one user or process experiences'), sub('Performance-related (measurable numbers)'), cell('user', 'perf'), sub('Other (qualities, harder to measure)'), cell('user', 'other'),  // user-oriented heading, then its measurable box and its other box, each with its own label
              hd('System-oriented', 'how well the whole machine is used'), sub('Performance-related (measurable numbers)'), cell('system', 'perf'), sub('Other (qualities, harder to measure)'), cell('system', 'other'))  // system-oriented heading, then its two labelled boxes
              : h('div', { style: { display: 'grid', gridTemplateColumns: '112px minmax(0,1fr) minmax(0,1fr)', gap: '8px' } },  // on wider screens: a grid with a 112-pixel heading column and two equal columns
              h('div'), hd('Performance-related', 'measurable numbers'), hd('Other', 'qualities, harder to measure'),  // top row: an empty corner, then the two column headings
              hd('User-oriented', 'what one user or process experiences'), cell('user', 'perf'), cell('user', 'other'),  // user-oriented row: heading, measurable box, other box
              hd('System-oriented', 'how well the whole machine is used'), cell('system', 'perf'), cell('system', 'other'));  // system-oriented row: heading, measurable box, other box
            panel.append(h('div', { class: 'split l fill' },  // the tab layout: two columns, the smaller one on the left
              h('div', { class: 'stack' }, h('p', { class: 'm0 small', html: 'A short-term scheduler is judged by <b>criteria</b>, sorted two ways. Click any criterion.' }), grid,  // left column: a short instruction to click a criterion, then the grid
                h('div', { class: 'callout analogy small m0', 'data-label': 'Analogy', html: 'A restaurant is judged by its diners (how long until my food arrives?) and by its owner (how many tables per hour, is the kitchen ever idle?). Same restaurant, two viewpoints.' })),  // analogy callout: a restaurant judged by its diners and by its owner
              h('div', { class: 'stack' }, detail,  // right column: the detail card first
                h('div', { class: 'callout warn small m0', 'data-label': 'Criteria conflict', html: 'You cannot maximize everything at once. Switching often between processes gives quick <span class="t">response time</span>, but every switch costs processor time, which lowers <span class="t">throughput</span>. Guaranteeing deadlines can be unfair to processes without one. Every policy is a compromise.' }),  // warning callout: the criteria conflict, e.g. quick response time costs throughput
                h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'In the rest of this section we score policies mainly by <b>turnaround</b> and <b>normalized turnaround</b> (Tr/Ts), because they show who waited and by how much.' }))));  // why-it-matters callout: the rest of the section scores policies by turnaround and Tr/Ts; closes the tab layout
            show(0);  // shows the first criterion (turnaround time) when the tab opens
          }  // ends criteria
          function priorities(panel) {  // priorities(panel): draws the second tab, a small simulation of priority queues that shows starvation and aging
            const AGE = 3;  // AGE: how many ticks a job must wait at one level before aging lifts it a level
            let st, stream = true, aging = false;  // st holds the simulation state; stream: a new top-priority job arrives every tick; aging: whether aging is on
            const lanes = h('div', { class: 'stack', style: { gap: '9px' } });  // lanes: the box that holds the four queue rows and the processor row
            const info = h('div', { class: 'msg info', style: { minHeight: '88px' } });  // info: the message box under the queues
            const color = (n) => (n[0] === 'H' ? 'pc2' : n[0] === 'M' ? 'pc3' : 'pc4');  // color(n): picks a badge colour from the job's first letter: H (high), M (middle) and L (low) each get their own
            const reset = () => { st = { t: 0, q: [[{ n: 'H1', w: 0 }], [{ n: 'M1', w: 0 }], [], [{ n: 'L', w: 0 }]], k: 1, ran: null, lDone: null }; draw('Start', 'Four ready queues. <b>L</b> sits in the lowest one. Each job needs one tick of processor time. Press <b>Next tick</b>.'); };  // reset(): back to the start: H1 in RQ0, M1 in RQ1, RQ2 empty, L in RQ3, then draws it with instructions
            function tick() {  // tick(): one tick of the simulation, run when Next tick is pressed
              const ev = [];  // ev collects the sentences for this tick
              st.t++;  // the clock moves on one tick
              if (stream) { st.k++; st.q[0].push({ n: 'H' + st.k, w: 0 }); ev.push(`H${st.k} arrives in RQ0.`); }  // with arrivals on, a new high-priority job joins RQ0 every tick
              if (aging) for (let lv = 1; lv < 4; lv++) {  // with aging on, check queues RQ1 to RQ3 for jobs that have waited long enough
                st.q[lv].filter((p) => p.w >= AGE).forEach((p) => { st.q[lv].splice(st.q[lv].indexOf(p), 1); p.w = 0; st.q[lv - 1].push(p); ev.push(`${p.n} has waited ${AGE} ticks: aging lifts it to RQ${lv - 1}.`); });  // each such job leaves its queue, its wait count restarts at 0 and it moves up one level
              }  // closes the aging loop
              const lv = st.q.findIndex((x) => x.length);  // lv: the highest-priority queue that is not empty
              if (lv >= 0) { const p = st.q[lv].shift(); st.ran = { n: p.n, lv }; ev.push(`<b>${p.n}</b> runs (RQ${lv} is the highest non-empty queue) and finishes.`); if (p.n === 'L') st.lDone = st.t; }  // the job at its front runs for the tick and finishes; if that job is L, the tick is recorded
              else { st.ran = null; ev.push('Every queue is empty: the processor idles.'); }  // all queues empty: the processor idles
              st.q.forEach((x) => x.forEach((p) => p.w++));  // every job still waiting has waited one more tick at its level
              const starving = st.lDone == null && stream && !aging && st.t >= 5;  // starving: L has still not run after 5 ticks while new work keeps coming and aging is off
              const lw = st.lDone != null ? `<b>L</b> got the processor at tick ${st.lDone}.` : `<b>L</b> has waited ${st.t} ticks.` + (starving ? ' With higher-priority work arriving forever and no aging, it will never run (and neither will M1): <b>starvation</b>.' : '');  // lw: L's status: when it ran, or how long it has waited, plus the starvation warning when it applies
              draw(`Tick ${st.t}`, ev.join(' ') + ' ' + lw, starving ? 'bad' : st.lDone != null ? 'ok' : 'info');  // redraws; the box turns red for starvation, green once L has run, otherwise stays the accent colour
            }  // ends tick
            function draw(head, html, kind) {  // draw(head, html, kind): redraws the queues and the message box
              const lane = (label, sub, items, cls) => h('div', { class: 'lane ' + (cls || '') }, h('div', { class: 'ln' }, label, h('small', {}, sub)),  // lane(): one row with a name and subtitle, then a badge for each job
                h('div', { class: 'toks' }, ...(items.length ? items.map((p) => h('span', { class: 'tk ' + color(p.n) }, p.n, p.w != null ? h('small', { title: 'ticks waited at this level' }, String(p.w)) : null)) : [h('span', { class: 'empty' }, 'empty')])));  // each badge shows the job's name and, in small print, the ticks it has waited at this level; an empty row says "empty"
              lanes.replaceChildren(...st.q.map((x, k) => lane('RQ' + k, k === 0 ? 'highest' : k === 3 ? 'lowest' : 'priority ' + k, x)),  // one row per queue, RQ0 marked highest and RQ3 lowest
                lane('CPU', st.ran ? 'ran this tick' : 'idle', st.ran ? [{ n: st.ran.n }] : [], 'cpu'));  // then the processor row, showing the job that ran this tick or "idle"
              say(info, kind || 'info', head, html);  // fills the message box with the heading and text
            }  // ends draw
            const run = (n) => { for (let i = 0; i < n; i++) tick(); };  // run(n): runs n ticks in a row (for the Run 5 ticks button)
            reset();  // sets up the starting state when the tab opens
            panel.append(h('div', { class: 'split l fill' },  // the tab layout: two columns, the smaller one on the left
              h('div', { class: 'stack' },  // left column: the explanation
                h('p', { class: 'm0', html: 'Many systems give each process a <span class="t">priority</span>. A simple design keeps one ready queue per level: <b>RQ0</b> (highest) down to <b>RQn</b> (lowest).' }),  // paragraph: priorities and one ready queue per level, RQ0 down to RQn
                h('p', { class: 'm0', html: 'The dispatcher always serves the <b>highest-priority queue that is not empty</b>. A process in RQ2 runs only when RQ0 and RQ1 are both empty.' }),  // paragraph: the dispatcher always serves the highest non-empty queue
                h('div', { class: 'callout bad small m0', 'data-label': 'The risk', html: 'If higher-priority work keeps arriving, a low-priority process may wait forever: <span class="t">starvation</span>.' }),  // risk callout: starvation of low-priority work
                h('div', { class: 'callout tip small m0', 'data-label': 'The remedy', html: 'Let priority change over time: raise it as a process waits (<span class="t">aging</span>), or base it on recent processor use. Feedback and fair-share scheduling, later in this section, do this.' }),  // remedy callout: aging, or priority based on recent processor use
                h('div', { class: 'card tight small', html: `<b>Try it.</b> Keep arrivals on with aging off: L never runs. Then turn aging on: L climbs one queue for every ${AGE} ticks it waits and finally reaches the processor.` })),  // try-it card: what to expect with aging off and then on
              h('div', { class: 'card white stack', style: { gap: '12px' } },  // right column: the simulation in a white card
                h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row: the two switches, spread apart
                  h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'New RQ0 job every tick'), ctx.ui.seg([{ value: 1, label: 'On' }, { value: 0, label: 'Off' }], 1, (v) => { stream = !!v; reset(); })),  // switch: a new RQ0 job every tick, on or off; changing it restarts the simulation
                  h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Aging'), ctx.ui.seg([{ value: 0, label: 'Off' }, { value: 1, label: `On (after ${AGE} ticks)` }], 0, (v) => { aging = !!v; reset(); }))),  // switch: aging off or on; changing it restarts the simulation
                lanes, info,  // the queue rows and the message box
                h('div', { class: 'row gap-s' },  // the button row
                  h('button', { class: 'btn sm primary', type: 'button', onclick: () => run(1) }, 'Next tick'),  // Next tick: runs one tick
                  h('button', { class: 'btn sm', type: 'button', onclick: () => run(5) }, 'Run 5 ticks'),  // Run 5 ticks: runs five ticks at once
                  h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset'),  // Reset: back to the starting state
                  h('span', { class: 'xs muted' }, 'Small numbers: ticks waited at this level.')))));  // a note that the small numbers count the ticks waited at the current level; closes the layout
          }  // ends priorities
          el.append(h('div', { class: 'fill' }, ctx.ui.tabs([  // the slide shows two tabs filling the full height
            { label: 'Scheduling criteria', render: criteria },  // tab 1: scheduling criteria
            { label: 'Priorities and starvation', render: priorities },  // tab 2: priorities and starvation
          ])));  // closes the tab list
        },  // ends render for step 2
      },  // ends step 2

      /* ---------------- 3. Describing a policy: w, e, s and the decision mode ---------------- */
      {  // step 3 begins
        title: 'Describing a policy: w, e, s and the decision mode',  // step 3 title
        kind: 'learn',  // kind learn: the slide is labelled Learn
        render(el, ctx) {  // render(el, ctx): draws step 3 when the slide opens
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          const procs = STANDARD;  // this step always uses the standard workload
          let pol = 'fcfs', t = 9, sim = simulate(procs, 'fcfs');  // pol: the policy shown; t: the time on the slider (starts at 9); sim: the run of that policy
          const chart = h('div'), tbody = h('tbody'), picks = h('div', { class: 'row gap-s' }), cap = h('div', { class: 'msg', style: { minHeight: '46px', fontSize: '14.5px' } });  // chart, table body, the row of rule chips, and the caption box under them
          const RUNS = { fcfs: ['fcfs', {}], rr: ['rr', { q: 1 }], srt: ['srt', {}] };  // RUNS: the three policies on offer here and the options each one runs with
          function draw() {  // draw(): redraws the chart, table, chips and caption for the current time and policy
            const f = sim.frames[Math.min(t, sim.T)];  // f: the snapshot at time t (never past the end of the run)
            chart.replaceChildren(gantt(ctx, procs, sim.segs, { T: sim.T, fin: sim.fin, upTo: t, cursor: t, rowH: 17, gap: 5, aria: 'Schedule up to time t' }));  // the chart up to time t, with the "now" line
            const info = procs.map((p, i) => {  // info: each process's state and its w and e at time t
              const fin = sim.fin[i], e = p.svc - f.rem[i];  // fin is its finish time; e is how long it has executed so far
              if (p.arr > t) return { i, st: (ctx.narrow ? 'due ' : 'arrives at ') + p.arr, live: false };  // not arrived yet: shows its arrival time (a shorter word on phone-width screens); no numbers
              if (fin != null && fin <= t) return { i, st: (ctx.narrow ? 'done ' : 'done at ') + fin, live: false, w: fin - p.arr - p.svc, e: p.svc };  // finished: shows when; its total wait is finish minus arrival minus service, and e equals its whole service time
              return { i, st: f.run === i ? 'Running' : 'Ready', live: true, w: t - p.arr - e, e };  // otherwise it is in the race: Running or Ready, with its wait so far and time executed so far
            });  // ends the map over processes
            tbody.replaceChildren(...info.map((x) => {  // rebuilds the table, one row per process
              const p = procs[x.i], has = x.w != null;  // p: the process; has: whether there are w and e values to show
              return h('tr', { class: x.live ? (f.run === x.i ? 'on' : '') : 'muted' },  // the row is highlighted for the running process and greyed out for processes not in the race
                h('td', {}, tok(ctx, x.i, null, 's')), h('td', {}, x.st),  // cells: the process badge and its state
                h('td', { class: 'c num' }, has ? String(x.w) : '—'), h('td', { class: 'c num' }, has ? String(x.e) : '—'), h('td', { class: 'c num' }, String(p.svc)),  // cells: w, e and s
                h('td', { class: 'c num' }, x.live ? String(p.svc - x.e) : '—'), h('td', { class: 'c num' }, x.live ? f2((x.w + p.svc) / p.svc) : '—'));  // cells: s - e (time still needed) and the response ratio (w + s)/s, only for processes in the race
            }));  // ends the table rows
            const live = info.filter((x) => x.live);  // live: the processes in the race at time t
            const arg = (score) => live.reduce((b, x) => (b == null || score(x) > score(b) + 1e-9 ? x : b), null);  // arg(score): the process in the race with the highest score (the first one on a tie)
            const rows = [['max[w]', 'FCFS', (x) => x.w], ['min[s]', 'SPN', (x) => -procs[x.i].svc], ['min[s − e]', 'SRT', (x) => -(procs[x.i].svc - x.e)], ['max[(w + s)/s]', 'HRRN', (x) => (x.w + procs[x.i].svc) / procs[x.i].svc]];  // rows: four selection functions, the policy that uses each, and a score for each; a min rule is turned into a max by the minus sign
            picks.replaceChildren(h('span', { class: 'small b' }, live.length ? 'Each rule, choosing now:' : 'Nobody is ready now.'),  // the chips row starts with a label, or says nobody is ready
              ...(live.length ? rows.map(([fn, who, sc]) => h('span', { class: 'chip accent', title: who + ' uses this rule' }, `${fn} → ${PN(arg(sc).i)}`)) : []));  // one chip per rule showing which process it would choose right now; hovering names the policy
            cap.innerHTML = narrate(sim, procs, Math.min(t, sim.T));  // the caption under the chips: the engine's own account of what happens at time t
          }  // ends draw
          const slider = ctx.ui.slider({ label: 'Time t', min: 0, max: sim.T, value: t, onInput: (v) => { t = v; draw(); } });  // slider: moves the time t from 0 to the end of the run; each movement redraws
          const seg = ctx.ui.seg([{ value: 'fcfs', label: 'FCFS' }, { value: 'rr', label: 'RR, q = 1' }, { value: 'srt', label: 'SRT' }], pol, (v) => {  // seg: switch between FCFS, round robin with quantum 1, and SRT
            pol = v; sim = simulate(procs, RUNS[v][0], RUNS[v][1]); slider.input.max = sim.T; t = Math.min(t, sim.T); draw();  // a new choice reruns the simulation, resets the slider's end, keeps t inside the run and redraws
          });  // closes the switch
          const table = h('table', { class: 'tbl compact' + (ctx.narrow ? ' slim' : '') }, h('thead', {}, h('tr', {}, h('th', {}, 'Proc'), h('th', {}, 'State at t'), ...['w', 'e', 's', 's − e', '(w+s)/s'].map((x) => h('th', { class: 'c', style: { textTransform: 'none', fontSize: '14px', whiteSpace: 'nowrap' } }, x)))), tbody);  // table (slimmer on phone-width screens): a header row (process, state, then w, e, s, s - e and the ratio, centred), then the body
          draw();  // draws everything once before the slide is shown
          el.append(h('div', { class: 'split l fill' },  // the slide layout: two columns, the smaller one on the left
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation, stacked with 10-pixel gaps
              h('p', { class: 'm0', html: 'Any policy can be described by two things.' }),  // paragraph: every policy is described by two things
              h('div', { class: 'card tight stack', style: { gap: '6px' } },  // first card: the selection function
                h('div', { class: 'b', html: '1. The <span class="t">selection function</span>' }),  // card heading, with "selection function" as a dotted glossary term
                h('div', { class: 'small', html: 'The rule that picks the next process, written with three numbers per process:' }),  // the function uses three numbers per process
                h('div', { class: 'small', html: '<span class="chip accent">w</span> time spent <b>waiting</b> so far<br><span class="chip accent">e</span> time spent <b>executing</b> so far<br><span class="chip accent">s</span> total <span class="t">service time</span> needed, including e (usually an estimate)' }),  // the three numbers as accent chips: w (waiting so far), e (executing so far) and s (total service time)
                h('div', { class: 'small muted', html: 'So s − e is the time the process still needs.' })),  // a muted note that s - e is the time still needed
              h('div', { class: 'card tight stack', style: { gap: '6px' } },  // second card: the decision mode
                h('div', { class: 'b', html: '2. The <span class="t">decision mode</span>' }),  // card heading, with "decision mode" as a dotted glossary term
                h('div', { class: 'small', html: '<b><span class="t" data-t="Nonpreemptive scheduling">Nonpreemptive</span>:</b> once running, a process keeps the processor until it finishes or blocks itself, for example to wait for I/O.' }),  // nonpreemptive: the process keeps the processor until it finishes or blocks
                h('div', { class: 'small', html: '<b><span class="t" data-t="Preemptive scheduling">Preemptive</span>:</b> the OS may interrupt it and move it back to Ready when a new process arrives, when an interrupt makes a blocked process ready, or periodically on a <span class="t">clock interrupt</span>.' })),  // preemptive: the OS may interrupt it, e.g. on an arrival or a clock interrupt
              h('div', { class: 'callout why small m0', 'data-label': 'Trade-off', html: 'Preemption costs more overhead (more process switches), but it usually gives better service, because no single process can hog the processor.' })),  // trade-off callout: preemption costs more switching but gives better service
            h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column: the live example in a white card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Watch w, e and s change'), seg),  // heading row: the card title with the policy switch at the right
              chart, slider, table, picks, cap)));  // then the chart, the time slider, the table, the rule chips and the caption; closes the layout
        },  // ends render for step 3
      },  // ends step 3

      /* ---------------- 4. FCFS and round robin: the quantum trade-off, virtual round robin ---------------- */
      {  // step 4 begins
        title: 'FCFS and round robin: how long should a turn be?',  // step 4 title
        kind: 'explore',  // kind explore: the slide is labelled Explore
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): draws step 4 when the slide opens
          const { h, s } = ctx;  // takes the builders h (HTML) and s (SVG) out of the toolbox
          const K = ctx.keep.rr || (ctx.keep.rr = { q: 4, c: 1, mode: 'rr', tab: 0 });  // K: this step's settings (quantum, switch cost, round robin mode, open tab); kept in ctx.keep, so a phone-width or desktop redraw hands them back
          const fc = simulate(STANDARD, 'fcfs'), eI = 4;  // fc: the FCFS run of the standard workload; eI = 4 is process E, the short job quoted in the FCFS callout
          const QW = [{ arr: 0, svc: 60 }, { arr: 0, svc: 50 }, { arr: 3, svc: 6 }, { arr: 18, svc: 8 }, { arr: 40, svc: 5 }, { arr: 61, svc: 7 }, { arr: 85, svc: 6 }];  // QW: the workload for the quantum chart: two long jobs at time 0, then five short requests arriving later (times in ms)
          const SHORT = [2, 3, 4, 5, 6], QMAX = 60;  // SHORT: the indexes of the five short requests; QMAX: the largest quantum the chart tries
          const qName = (p) => (p < 2 ? 'L' + (p + 1) : 'I' + (p - 1)), qColor = (p) => (p === 0 ? 0 : p === 1 ? 3 : 2);  // qName(p) names the jobs L1, L2 and I1 to I5; qColor(p) gives the two long jobs their own colours and all requests one shared colour
          const answer = (r) => avg(SHORT.map((i) => r.fin[i] - QW[i].arr));  // answer(r): the mean time from arrival to finish of the five short requests, the "time to answer" a user feels
          function quantumTab(panel) {  // quantumTab(panel): draws the first tab, where the quantum and the switch cost can be changed
            let q = K.q, c = K.c;  // q: the chosen quantum in ms; c: the switch cost in ms (both read from K: 4 and 1 on a normal visit)
            const chart = h('div'), strip = h('div'), stats = h('div', { class: 'row gap-s' });  // chart: the line graph; strip: the processor timeline; stats: the row of result chips
            const note = h('div', { class: 'msg info', style: { fontSize: '14.5px' } });  // note: the message box under the chips
            function plot() {  // plot(): recomputes and redraws the whole tab whenever a slider moves
              const W = ctx.narrow ? 360 : 620, H = 176, L = 40, R = 44, T = 8, B = 22;  // drawing size (smaller on phone-width screens) and its margins on the left, right, top and bottom
              const pts = []; for (let k = 1; k <= QMAX; k++) { const r = rrCost(QW, k, c); pts.push([k, answer(r), (100 * r.ovh) / r.T]); }  // pts: for every quantum from 1 to 60, runs rrCost and keeps the quantum, the answer time and the overhead as a percentage
              const yMax = Math.ceil(Math.max(...pts.map((p) => p[1])) / 20) * 20, oMax = 70;  // yMax: the top of the left scale, rounded up to a multiple of 20; oMax: the top of the right (overhead) scale, fixed at 70%
              const X = (k) => L + ((k - 1) / (QMAX - 1)) * (W - L - R), Y = (v) => T + (1 - v / yMax) * (H - T - B), YO = (v) => T + (1 - v / oMax) * (H - T - B);  // X(k) turns a quantum into an x position; Y(v) and YO(v) turn values on the left and right scales into y positions
              const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Answer time and overhead as the quantum grows' });  // svg: the drawing, scaled to the box width, with a description for screen readers
              for (let v = 0; v <= yMax; v += yMax / 4) svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'ax', style: 'fill:var(--cpu)' }, String(v)));  // horizontal grid lines at quarters of the left scale, each with its value written in processor blue
              for (let v = 0; v <= oMax; v += 35) svg.append(s('text', { x: W - R + 6, y: YO(v) + 4, class: 'ax', style: 'fill:var(--intr)' }, v + '%'));  // right-scale labels 0%, 35% and 70%, written in interrupt red
              [1, 10, 20, 30, 40, 50, 60].forEach((k) => svg.append(s('text', { x: X(k), y: H - 6, 'text-anchor': 'middle', class: 'ax' }, k === 60 ? '60 ms' : String(k))));  // quantum labels along the bottom: 1, 10, 20 ... 60 ms
              svg.append(s('polyline', { points: pts.map((p) => `${X(p[0])},${Y(p[1])}`).join(' '), fill: 'none', style: 'stroke:var(--cpu);stroke-width:2.5' }),  // solid blue line: the answer time for every quantum
                s('polyline', { points: pts.map((p) => `${X(p[0])},${YO(p[2])}`).join(' '), fill: 'none', style: 'stroke:var(--intr);stroke-width:2;stroke-dasharray:6 4' }),  // dashed red line: the overhead for every quantum
                s('line', { x1: X(q), x2: X(q), y1: T - 4, y2: H - B, class: 'cur' }),  // a vertical line at the chosen quantum
                s('circle', { cx: X(q), cy: Y(pts[q - 1][1]), r: 5, style: 'fill:var(--cpu)' }), s('circle', { cx: X(q), cy: YO(pts[q - 1][2]), r: 5, style: 'fill:var(--intr)' }));  // a dot on each curve where that line crosses it
              chart.replaceChildren(svg);  // puts the drawing into the chart box
              const r = rrCost(QW, q, c), fit = SHORT.filter((i) => QW[i].svc <= q).length;  // r: the run with the chosen quantum; fit: how many short requests need no more than one quantum
              const best = pts.reduce((b, p) => (p[1] < b[1] - 1e-9 ? p : b), pts[0]);  // best: the quantum with the lowest answer time (the smallest one on a tie)
              strip.replaceChildren(gantt(ctx, QW, r.segs, { T: r.T, W: 620, labelW: 40, rows: [{ label: 'CPU', segs: r.segs }], rowH: 26, name: qName, color: qColor, aria: 'Processor timeline: red slivers are switching overhead' }));  // strip: a one-lane timeline of the processor, with the jobs named and the red switching slivers between turns
              stats.replaceChildren(  // refills the chips row
                h('span', { class: 'chip cpu' }, `answer time ${ctx.util.fmt(answer(r), 1)} ms`),  // chip: the answer time, rounded to 1 decimal
                h('span', { class: 'chip intr' }, `overhead ${Math.round((100 * r.ovh) / r.T)}%`),  // chip: the share of all time lost to switching
                h('span', { class: 'chip' }, `${r.disp} dispatches`),  // chip: how many dispatches there were
                h('span', { class: 'chip' }, `${fit} of 5 requests fit in one quantum`));  // chip: how many requests fit in one quantum
              const fcfs = q >= Math.max(...QW.map((p) => p.svc));  // fcfs: true when the quantum is at least as long as the longest job, so nobody is ever cut off
              note.innerHTML = (fcfs ? `<b>q = ${q} ms</b> is at least as long as every burst, so nobody is ever cut off: this <b>is FCFS</b>, and short requests wait behind the long jobs. `  // the note then says the quantum is so long that round robin has become FCFS
                : fit === 0 ? `<b>q = ${q} ms</b> is shorter than every request, so each needs several turns, and every turn pays the switch cost. `  // or that the quantum is shorter than every request, so each pays several switches
                  : `<b>q = ${q} ms</b>: ${fit} of the 5 requests finish in a single turn. `)  // or how many requests finish in a single turn
                + (c > 0 ? `With a ${c} ms switch cost, the best quantum here is <b>${best[0]} ms</b> (answer time ${ctx.util.fmt(best[1], 1)} ms)${best[0] >= 6 ? ', just above the size of a typical request (about 6 ms)' : ''}.` : 'With free switching, the smallest quantum wins. Real switches are never free: raise the switch cost.');  // then the best quantum for this switch cost (and whether it is just above a typical request), or that free switching favours tiny quanta
            }  // ends plot
            const sq = ctx.ui.slider({ label: 'Quantum q', min: 1, max: QMAX, value: q, format: (v) => v + ' ms', onInput: (v) => { q = v; K.q = v; plot(); } });  // quantum slider: 1 to 60 ms; every movement is recorded in K and replots
            const sc = ctx.ui.slider({ label: 'Switch cost', min: 0, max: 2, step: 0.5, value: c, format: (v) => v + ' ms', onInput: (v) => { c = v; K.c = v; plot(); } });  // switch cost slider: 0 to 2 ms in steps of 0.5; every movement is recorded in K and replots
            plot();  // draws the tab once as it opens
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } },  // the tab's contents, stacked
              h('p', { class: 'xs muted m0', html: 'Two long processor-bound jobs (<b>L1</b> 60 ms, <b>L2</b> 50 ms) start at 0. Five short interactive requests (<b>I1–I5</b>, 5 to 8 ms each) arrive at 3, 18, 40, 61 and 85 ms. Each dispatch costs the switch cost (red slivers).' }),  // intro line: describes the two long jobs, the five short requests and the switch cost
              h('div', { class: 'grid-2' }, sq, sc),  // the two sliders side by side
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'b', style: { color: 'var(--cpu)' } }, '━ time to answer a short request (ms, left scale)'), h('span', { class: 'b', style: { color: 'var(--intr)' } }, '┅ overhead (% of all time, right scale)'), h('span', { class: 'muted' }, 'x axis: quantum')),  // legend: solid blue for answer time (left scale), dashed red for overhead (right scale), quantum along the bottom
              chart, strip, stats, note));  // then the chart, the timeline, the chips and the note; closes the tab
          }  // ends quantumTab
          function vrrTab(panel) {  // vrrTab(panel): draws the second tab, comparing plain and virtual round robin
            let mode = K.mode;  // mode: 'rr' for plain round robin, 'vrr' for virtual round robin (read from K: 'rr' on a normal visit)
            const view = h('div', { class: 'stack', style: { gap: '8px' } });  // view: the box that is refilled whenever the mode changes
            function diagram() {  // diagram(): draws where Z goes after I/O under the chosen mode
              if (ctx.narrow) return h('div', { class: 'row gap-s small' }, h('span', { class: 'box io' }, 'I/O done'), '→',  // on phone-width screens, a simple row of boxes instead of a drawing: I/O done, then
                mode === 'vrr' ? h('span', { class: 'box accent' }, 'auxiliary queue (served first)') : h('span', { class: 'box proc' }, 'back of the main queue'), '→', h('span', { class: 'box cpu' }, 'processor'));  // the auxiliary queue (VRR) or the back of the main queue (RR), then the processor
              const vr = mode === 'vrr', box = (x, y, w, cls, txt, dim) => s('g', { style: dim ? 'opacity:.35' : null },  // vr: true for VRR; box(): one labelled rounded box in the drawing, faded and dashed when dim is true
                s('rect', { x, y, width: w, height: 34, rx: 9, class: cls, 'stroke-width': 2, 'stroke-dasharray': dim ? '6 4' : null }),  // the box's rectangle, with the class giving its colour
                s('text', { x: x + w / 2, y: y + 22, 'text-anchor': 'middle', style: 'font-size:14px;font-weight:700' }, txt));  // the box's label, centred
              const svg = s('svg', { viewBox: '0 0 620 118', width: '100%', role: 'img', 'aria-label': 'Queues for round robin and virtual round robin' });  // svg: the drawing, scaled to the box width, with a description for screen readers
              svg.append(box(6, 12, 196, 's-proc', 'Main ready queue'), box(6, 68, 196, 's-accent', vr ? 'Auxiliary queue' : 'Auxiliary queue (VRR only)', !vr),  // the main ready queue, and the auxiliary queue (faded and marked "VRR only" in plain round robin)
                box(290, 40, 120, 's-cpu', 'Processor'), box(494, 40, 120, 's-io', 'I/O device'),  // the processor and the I/O device
                s('line', { x1: 204, y1: 36, x2: 286, y2: 52, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the main queue to the processor
                s('line', { x1: 204, y1: 82, x2: 286, y2: 66, class: 's-line', 'marker-end': 'url(#arr)', style: vr ? null : 'opacity:.3' }),  // arrow from the auxiliary queue to the processor, faded in plain round robin
                s('line', { x1: 412, y1: 57, x2: 490, y2: 57, class: 's-line', 'marker-end': 'url(#arr-io)' }),  // arrow from the processor to the I/O device
                s('text', { x: 451, y: 50, 'text-anchor': 'middle', class: 'ax' }, 'Z blocks'),  // label on that arrow: Z blocks for I/O
                s('path', { d: 'M350,38 L350,22 L206,22', class: 's-line', 'marker-end': 'url(#arr)' }), s('text', { x: 278, y: 17, 'text-anchor': 'middle', class: 'ax' }, 'quantum over'),  // arrow from the processor back to the main queue, labelled "quantum over"
                vr ? s('path', { d: 'M554,76 L554,112 L104,112 L104,106', class: 's-line', style: 'stroke:var(--accent)', 'marker-end': 'url(#arr-accent)' })  // VRR: an accent-coloured path from the I/O device down and around into the auxiliary queue
                  : s('path', { d: 'M554,38 L554,6 L104,6 L104,10', class: 's-line', style: 'stroke:var(--io)', 'marker-end': 'url(#arr-io)' }),  // RR: an I/O-coloured path from the I/O device over the top to the back of the main queue
                s('text', { x: vr ? 330 : 544, y: vr ? 106 : 20, 'text-anchor': vr ? 'middle' : 'end', class: 'ax', style: 'font-weight:700' }, vr ? 'I/O done: to the auxiliary queue' : 'I/O done: back of the main queue'),  // the label for whichever return path is shown
                vr ? s('text', { x: 246, y: 92, 'text-anchor': 'middle', class: 'ax', style: 'fill:var(--accent);font-weight:700' }, 'served first') : null);  // VRR only: "served first" next to the auxiliary queue's arrow
              return svg;  // returns the drawing
            }  // ends diagram
            function draw() {  // draw(): reruns the simulation and redraws the tab
              const r = ioMix(mode, 4), H = r.cpu.length;  // r: ioMix run for the chosen mode with quantum 4; H: how many time units it covers
              const runs = (pred, code) => { const out = []; for (let t = 0; t < H; t++) if (pred(t)) { const g = out[out.length - 1]; if (g && g.b === t && g.p === code(t)) g.b = t + 1; else out.push({ p: code(t), a: t, b: t + 1 }); } return out; };  // runs(pred, code): joins neighbouring time units where pred holds and code gives the same value into bars for the chart
              const cpuSegs = runs((t) => r.cpu[t] >= 0, (t) => r.cpu[t]);  // cpuSegs: one bar per stretch of a process on the processor (idle units are left blank)
              const zSegs = runs((t) => r.zst[t] !== 'wait', (t) => (r.zst[t] === 'run' ? 2 : 11));  // zSegs: Z's own lane: running (code 2, Z's colour) or busy with I/O (code 11); time spent waiting stays blank
              view.replaceChildren(diagram(),  // refills the view with the diagram first
                gantt(ctx, [], [], { T: H, W: 620, labelW: ctx.narrow ? 36 : 70, rowH: 26, rows: [{ label: 'CPU', segs: cpuSegs }, { label: 'Z', segs: zSegs }], name: (p) => (p === 11 ? 'I/O' : 'XYZ'[p]), color: (p) => (p === 11 ? 2 : [0, 3, 1][p]), aria: 'Who runs, and what Z is doing' }),  // then a two-lane chart: CPU (who ran: X, Y or Z, each in its own colour) and Z (running, or I/O in the I/O colour)
                h('div', { class: 'row gap-s' },  // a row of result chips
                  h('span', { class: 'chip mem' }, `Z’s share of the processor: ${Math.round(r.share * 100)}%`),  // chip: the share of the processor that Z got
                  h('span', { class: 'chip' }, `Z’s average wait after I/O: ${ctx.util.fmt(r.meanWait, 2)}`),  // chip: Z's average wait between becoming ready and getting the processor
                  h('span', { class: 'chip' }, `Z’s bursts finished: ${r.bursts}`)),  // chip: how many bursts Z finished in the window
                h('div', { class: 'callout ' + (mode === 'rr' ? 'bad' : 'tip') + ' small m0', 'data-label': mode === 'rr' ? 'Plain round robin' : 'Virtual round robin',  // explanation callout: red for plain round robin, a tip for virtual round robin
                  html: mode === 'rr' ? 'After each I/O, Z joins the <b>back of the main queue</b> and waits behind full quanta of X and Y. Z used only 1 unit of its quantum, yet it gets no credit for the rest: round robin is unfair to I/O-bound processes.'  // plain round robin text: Z rejoins the back of the main queue and gets no credit for its unused quantum
                    : 'In <span class="t">virtual round robin</span>, Z joins an <b>auxiliary queue</b> after I/O, and the dispatcher serves it before the main queue. Z may use only what is left of its quantum (here 4 − 1 = 3 units); once that leftover is used up, Z goes back to the main queue for a fresh quantum.' }));  // virtual round robin text: Z waits in the auxiliary queue, served first, and may use only its leftover quantum; closes the view
            }  // ends draw
            draw();  // draws the tab once as it opens
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } },  // the tab's contents, stacked
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Quantum q = 4'),  // top row: the fixed quantum on the left
                ctx.ui.seg([{ value: 'rr', label: 'Round robin' }, { value: 'vrr', label: 'Virtual round robin' }], mode, (v) => { mode = v; K.mode = v; draw(); })),  // and the switch between round robin and virtual round robin on the right; switching is recorded in K and redraws
              h('p', { class: 'small m0', html: '<b>X</b> and <b>Y</b> are <span class="t" data-t="Processor-bound process">processor-bound</span>: they always use their whole quantum. <b>Z</b> is <span class="t" data-t="I/O-bound process">I/O-bound</span>: it computes for 1 unit, then waits 3 units for its device, over and over.' }),  // paragraph: X and Y are processor-bound, Z is I/O-bound (1 unit of computing, then 3 units of I/O)
              view));  // then the view; closes the tab
          }  // ends vrrTab
          el.append(h('div', { class: 'split l fill' },  // the slide layout: two columns, the smaller one on the left
            h('div', { class: 'stack', style: { gap: '7px' } },  // left column: the explanation of the two policies
              h('h3', { class: 'm0', html: '<span class="t">First-come-first-served (FCFS)</span>' }),  // heading: FCFS, as a dotted glossary term
              h('p', { class: 'm0 small', html: 'Selection function <b>max[w]</b>: run the process that has waited longest. <b>Nonpreemptive.</b> Simple and fine for long processes.' }),  // paragraph: FCFS's selection function and decision mode
              h('div', { class: 'callout warn small m0', 'data-label': 'Who loses', html: `A short process stuck behind long ones: in the standard workload E needs only ${STANDARD[eI].svc} units but finishes at ${fc.fin[eI]}, so Tr/Ts = ${f2(fc.ntr[eI])}. It also favours processor-bound work: a waking I/O-bound process waits behind a whole long burst while its device sits idle.` }),  // warning callout: who loses under FCFS, with process E's real figures taken from the engine's FCFS run
              h('h3', { class: 'm0', html: '<span class="t">Round robin (RR)</span>' }),  // heading: round robin, as a dotted glossary term
              h('p', { class: 'm0 small', html: 'A <span class="t">clock interrupt</span> arrives every <b>q</b> time units (the quantum, or <span class="t">time slice</span>); the running process goes to the back of the ready queue. <b>Preemptive</b> at the quantum.' }),  // paragraph: the clock interrupt every quantum and the trip to the back of the queue
              h('div', { class: 'callout tip small m0', 'data-label': 'Choosing q', html: 'Too short: switching overhead eats the processor. Too long: round robin becomes FCFS. Rule of thumb: a bit longer than a typical interaction, so most interactions fit in one quantum.' }),  // tip callout: choosing the quantum, neither too short nor too long
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'A quantum is a limit, not a reservation: a process that finishes or blocks early gives up the processor at once.' })),  // warning callout: a quantum is a limit, not a reservation
            ctx.ui.tabs([{ label: 'Quantum vs overhead', render: quantumTab }, { label: 'Virtual round robin', render: vrrTab }], { initial: K.tab, onChange: (i) => { K.tab = i; } })));  // right column: two tabs, the quantum chart and the virtual round robin comparison, opening on K.tab and recording every switch there; closes the layout
        },  // ends render for step 4
      },  // ends step 4

      /* ---------------- 5. Shortest first: SPN, SRT and estimating service time ---------------- */
      {  // step 5 begins
        title: 'Shortest first: SPN, SRT and guessing the future',  // step 5 title
        kind: 'explore',  // kind explore: the slide is labelled Explore
        render(el, ctx) {  // render(el, ctx): draws step 5 when the slide opens
          const { h, s } = ctx;  // takes the builders h (HTML) and s (SVG) out of the toolbox
          const K = ctx.keep.spn || (ctx.keep.spn = { wl: 'std', a: 0.5, tab: 0 });  // K: this step's settings (workload switch, alpha, open tab); kept in ctx.keep, so a phone-width or desktop redraw hands them back
          const fc = simulate(STANDARD, 'fcfs'), sp = simulate(STANDARD, 'spn'), sr = simulate(STANDARD, 'srt');  // fc, sp and sr: the FCFS, SPN and SRT runs of the standard workload, whose means are quoted in the text
          const STREAM = [[0, 2], [1, 7], [2, 2], [4, 2], [6, 2], [8, 2]].map(([arr, svc]) => ({ arr, svc }));  // STREAM: a workload where one long job (B, needing 7) is followed by a stream of short jobs, to show starvation
          function vsTab(panel) {  // vsTab(panel): draws the first tab, SPN and SRT side by side
            let wl = K.wl;  // wl: which workload is shown, 'std' or 'stream' (read from K: 'std' on a normal visit)
            const view = h('div', { class: 'stack', style: { gap: '6px' } });  // view: the box that is refilled whenever the workload changes
            function draw() {  // draw(): reruns both policies and redraws the tab
              const procs = wl === 'std' ? STANDARD : STREAM, a = simulate(procs, 'spn'), b = simulate(procs, 'srt'), T = Math.max(a.T, b.T);  // procs: the chosen workload; a and b: its SPN and SRT runs; T: the longer of the two, so both charts share one time axis
              const head = (name, r) => h('div', { class: 'row gap-s small' }, h('b', {}, name), h('span', { class: 'chip' }, `mean Tr ${f2(r.meanTr)}`), h('span', { class: 'chip' }, `mean Tr/Ts ${f2(r.meanNtr)}`));  // head(name, r): a heading for one chart: the policy's name plus chips for its mean Tr and mean Tr/Ts
              const g = (r) => gantt(ctx, procs, r.segs, { T, fin: r.fin, rowH: 15, gap: 4, rightW: 64, right: (i) => `Tr ${r.tr[i]}` });  // g(r): a compact chart of run r, with each process's turnaround written at the right
              let msg;  // msg: the explanation under the charts
              if (wl === 'std') {  // standard workload: explain the moment the two policies part ways
                const f = b.frames.find((x) => x.ev.some((e) => e.k === 'pre')), e = f.ev.find((x) => x.k === 'pre');  // f: the first snapshot where SRT preempts; e: that preemption event
                msg = `<b>The difference:</b> at t = ${f.t}, ${PN(e.by)} arrives needing ${f.rem[e.by]} while ${PN(e.p)} still needs ${f.rem[e.p]}, so SRT hands the processor to ${PN(e.by)}. SPN, being nonpreemptive, lets ${PN(e.p)} finish first.`;  // the message names the time, the newcomer, both times left, and why SPN behaves differently
              } else {  // stream workload: explain the starvation
                const st = a.frames.findIndex((x) => x.run === 1), fcf = simulate(procs, 'fcfs');  // st: when B first runs under SPN; fcf: the FCFS run of the same workload, for comparison
                msg = `<b>Starvation in the making:</b> B arrives at ${procs[1].arr} but starts only at ${st}: every newcomer is shorter, so all ${procs.length - 2} later arrivals go first (under FCFS, B would finish at ${fcf.fin[1]}, not ${a.fin[1]}). If short jobs never stopped coming, B would never run.` + (a.fin.join() === b.fin.join() ? ' SRT does exactly the same here.' : '');  // the message: B waits while every shorter newcomer goes first, compared with FCFS; plus a note if SRT behaves the same
              }  // closes the two cases
              view.replaceChildren(head('SPN (nonpreemptive)', a), g(a), head('SRT (preemptive)', b), g(b), h('div', { class: 'msg ' + (wl === 'std' ? 'info' : 'bad'), html: msg }));  // refills the view: SPN heading and chart, SRT heading and chart, then the message (red for the starvation case)
            }  // ends draw
            draw();  // draws the tab once as it opens
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } },  // the tab's contents, stacked
              ctx.ui.seg([{ value: 'std', label: 'Standard workload' }, { value: 'stream', label: 'A long job versus a stream of short ones' }], wl, (v) => { wl = v; K.wl = v; draw(); }), view));  // the workload switch (switching is recorded in K and redraws), then the view; closes the tab
          }  // ends vsTab
          function estTab(panel) {  // estTab(panel): draws the second tab, predicting the next burst from past ones
            const T = [6, 4, 6, 4, 13, 13, 13, 13, 13, 13], S0 = 5;  // T: ten observed bursts (around 5 at first, then 13 from burst 5 on); S0: the first guess
            let a = K.a;  // a: alpha, the weight of the newest burst, set by the slider (read from K: 0.5 on a normal visit)
            const plot = h('div'), wbox = h('div'), msg = h('div', { class: 'msg info', style: { fontSize: '14.5px' } });  // plot: the line chart; wbox: the weights chart; msg: the message under them
            function draw() {  // draw(): recomputes both estimates and redraws the tab
              const E = expAvg(T, a, S0), M = simpleAvg(T, S0);  // E: the exponential estimates; M: the simple averages; both lists start with the first guess
              const W = ctx.narrow ? 360 : 620, H = 176, L = 30, R = 12, Tp = 8, B = 22, n = T.length + 1;  // drawing size (smaller on phone-width screens), its margins, and n, the number of points: 10 bursts plus the next prediction
              const X = (i) => L + ((i - 1) / (n - 1)) * (W - L - R), Y = (v) => Tp + (1 - v / 15) * (H - Tp - B);  // X(i) turns a burst number into an x position; Y(v) turns a value from 0 to 15 into a y position
              const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Observed bursts and two kinds of estimate' });  // svg: the drawing, scaled to the box width, with a description for screen readers
              [0, 5, 10, 15].forEach((v) => svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'gl' }), s('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'ax' }, String(v))));  // horizontal grid lines with their values at 0, 5, 10 and 15
              for (let i = 1; i <= n; i++) svg.append(s('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', class: 'ax' }, i === n ? 'next' : String(i)));  // burst numbers along the bottom, with the last position labelled "next"
              svg.append(s('polyline', { points: M.map((v, i) => `${X(i + 1)},${Y(v)}`).join(' '), fill: 'none', style: 'stroke:var(--muted);stroke-width:2;stroke-dasharray:6 4' }),  // dashed grey line: the simple average
                s('polyline', { points: E.map((v, i) => `${X(i + 1)},${Y(v)}`).join(' '), fill: 'none', style: 'stroke:var(--accent);stroke-width:2.5' }),  // solid accent line: the exponential estimate
                ...E.map((v, i) => s('circle', { cx: X(i + 1), cy: Y(v), r: 3.5, style: 'fill:var(--accent)' })),  // a dot at each exponential estimate
                ...T.map((v, i) => s('rect', { x: X(i + 1) - 6, y: Y(v) - 6, width: 12, height: 12, rx: 2, class: 'pc2', 'stroke-width': 2 })));  // a small square at each observed burst, in the I/O colour
              plot.replaceChildren(svg);  // puts the drawing into the plot box
              const ws = [0, 1, 2, 3, 4, 5].map((k) => a * (1 - a) ** k), last4 = 1 - (1 - a) ** 4;  // ws: the weight of the newest burst and the five before it, a(1 - a)^k; last4: the total weight of the last four bursts
              const bw = ((ctx.narrow ? 360 : 620) - 8) / 6 - 8, wsvg = s('svg', { viewBox: `0 0 ${ctx.narrow ? 360 : 620} 64`, width: '100%', role: 'img', 'aria-label': 'Weight given to each past burst' });  // bw: the width of each weight bar; wsvg: the second drawing, a short bar chart
              ws.forEach((w, k) => wsvg.append(s('rect', { x: 8 + k * (bw + 8), y: 44 - w * 40, width: bw, height: Math.max(1, w * 40), rx: 3, class: 's-accent', 'stroke-width': 1.5 }),  // one bar per weight, its height in proportion to the weight
                s('text', { x: 8 + k * (bw + 8) + bw / 2, y: 40 - w * 40, 'text-anchor': 'middle', class: 'ax', style: 'fill:var(--ink-2);font-weight:700' }, w.toFixed(3)),  // the weight written above its bar, to 3 decimals
                s('text', { x: 8 + k * (bw + 8) + bw / 2, y: 60, 'text-anchor': 'middle', class: 'ax' }, k ? `T(n−${k})` : 'T(n)')));  // the burst's label under its bar: T(n), T(n-1) and so on
              wbox.replaceChildren(wsvg);  // puts the bar chart into its box
              const k = E.findIndex((v, i) => i >= 5 && Math.abs(v - 13) <= 1);  // k: the first estimate from burst 6 on that is within 1 of the new level, 13
              msg.innerHTML = `With α = ${a.toFixed(1)}, the latest burst counts ${Math.round(a * 100)}% and the last four together carry <b>${(last4 * 100).toFixed(1)}%</b> of the weight. `  // the message: how much weight the newest burst and the last four bursts carry
                + `The process changes behaviour at burst 5 (from about 5 to 13). ` + (k >= 0 ? `The exponential estimate is within 1 of 13 by burst ${k + 1}; ` : 'The exponential estimate never gets within 1 of 13 in this window; ')  // then how quickly the exponential estimate catches up with the change at burst 5
                + `the simple average is still only ${M[T.length].toFixed(1)} after burst ${T.length}.`;  // and how far behind the simple average still is at the end
            }  // ends draw
            const sl = ctx.ui.slider({ label: 'α (weight of the newest burst)', min: 0.1, max: 0.9, step: 0.1, value: a, format: (v) => v.toFixed(1), onInput: (v) => { a = v; K.a = v; draw(); } });  // alpha slider: 0.1 to 0.9 in steps of 0.1; every movement is recorded in K and redraws
            draw();  // draws the tab once as it opens
            panel.append(h('div', { class: 'stack', style: { gap: '6px' } },  // the tab's contents, stacked
              h('div', { class: 'eq', html: ctx.narrow ? 'Simple average (the mean):<br>S(n+1) = (1/n)·ΣT(i)<br>Exponential:<br>S(n+1) = α·T(n) + (1 − α)·S(n)' : 'Simple average:&nbsp; S(n+1) = (1/n)·ΣT(i), the mean of all n bursts so far<br>Exponential:&nbsp;&nbsp;&nbsp; S(n+1) = α·T(n) + (1 − α)·S(n)' }), sl,  // formula box: the simple average and the exponential formula (split over more lines on phone-width screens), then the slider
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'b', style: { color: 'var(--io)' } }, '■ observed burst T(i)'), h('span', { class: 'b', style: { color: 'var(--accent)' } }, '● exponential estimate'), h('span', { class: 'b muted' }, '┅ simple average'), h('span', { class: 'muted' }, `first guess S(1) = ${S0}`)),  // legend: squares for observed bursts, dots for exponential estimates, dashes for the simple average, plus the first guess
              plot, h('div', { class: 'xs muted b' }, 'Weight each past burst gets in the exponential estimate'), wbox, msg));  // then the plot, a caption, the weights chart and the message; closes the tab
          }  // ends estTab
          el.append(h('div', { class: 'split l fill' },  // the slide layout: two columns, the smaller one on the left
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the explanation of the two policies
              h('h3', { class: 'm0', html: '<span class="t">Shortest process next (SPN)</span>' }),  // heading: SPN, as a dotted glossary term
              h('p', { class: 'm0 small', html: `Selection function <b>min[s]</b>: the waiting process with the shortest expected service time. <b>Nonpreemptive.</b> Short jobs jump the line, so mean turnaround falls (${f2(sp.meanTr)} against ${f2(fc.meanTr)} for FCFS on the standard workload). Long jobs wait longer and less predictably, and can starve.` }),  // paragraph: SPN's rule, with the real mean turnaround of SPN and FCFS taken from the engine
              h('h3', { class: 'm0', html: '<span class="t">Shortest remaining time (SRT)</span>' }),  // heading: SRT, as a dotted glossary term
              h('p', { class: 'm0 small', html: `The preemptive version, <b>min[s − e]</b>: a newcomer with less time left takes over. It needs no extra clock interrupts, but the OS must track how long each process has run. Turnaround improves again (mean ${f2(sr.meanTr)}); long jobs can still starve.` }),  // paragraph: SRT as preemptive SPN, with its real mean turnaround
              h('div', { class: 'callout warn small m0', 'data-label': 'The catch', html: 'Both need s before the process runs. For a batch job the submitter may supply an estimate (and the job may be aborted if it runs far beyond it). For interactive work, the OS must <b>predict</b> each burst from the past: see the second tab.' }),  // warning callout: both policies need s in advance, so it must be supplied or predicted
              h('div', { class: 'callout why small m0', 'data-label': 'Predicting from history', html: 'In <span class="t">exponential averaging</span> the weights fall off geometrically: α, α(1&nbsp;−&nbsp;α), α(1&nbsp;−&nbsp;α)², ... Recent behaviour dominates and old behaviour fades. A larger α reacts faster to a change; with α = 0.8 almost all the weight sits on the last four bursts.' })),  // why callout: exponential averaging and its weights that fall off geometrically
            ctx.ui.tabs([{ label: 'SPN versus SRT', render: vsTab }, { label: 'Estimating s from history', render: estTab }], { initial: K.tab, onChange: (i) => { K.tab = i; } })));  // right column: two tabs, SPN versus SRT and estimating s from history, opening on K.tab and recording every switch there; closes the layout
        },  // ends render for step 5
      },  // ends step 5

      /* ---------------- 6. HRRN (ratio race) and feedback (sinking queues) ---------------- */
      {  // step 6 begins
        title: 'HRRN and feedback: no starvation, no guessing',  // step 6 title
        kind: 'explore',  // kind explore: the slide is labelled Explore
        render(el, ctx) {  // render(el, ctx): draws step 6 when the slide opens
          const { h, s } = ctx;  // takes the builders h (HTML) and s (SVG) out of the toolbox
          function hrrnTab(panel) {  // hrrnTab(panel): draws the first tab, an animated race of response ratios
            const procs = STANDARD, sim = simulate(procs, 'hrrn');  // the standard workload and its HRRN run, which every chart and caption in this tab comes from
            /* the first real contest (three or more waiting) and the next decision, described from the simulation itself */
            const ratio = (i, t) => (t - procs[i].arr + procs[i].svc) / procs[i].svc;  // ratio(i, t): the response ratio of waiting process i at time t, (w + s)/s
            const dec = sim.frames.filter((f) => f.ev.some((e) => e.k === 'go') && f.pool && f.pool.length > 1);  // dec: the snapshots where the dispatcher had to choose between two or more candidates
            const d1 = (() => {  // d1: the text for the "Watch" callout, worked out once by a function that runs immediately
              const f = dec.find((x) => x.pool.length >= 3) || dec[0], win = f.ev.find((e) => e.k === 'go').p;  // f: the first decision with three or more candidates (or else the first contest); win: who HRRN picked there
              const sh = f.pool.reduce((b, i) => (procs[i].svc < procs[b].svc ? i : b), f.pool[0]);  // sh: the shortest candidate at that moment, the one SPN would have picked
              const g = dec.find((x) => x.t > f.t), w2 = g ? g.ev.find((e) => e.k === 'go').p : null;  // g: the next contested decision; w2: who won it
              return { t: f.t, html: `SPN would pick ${PN(sh)} (the shortest). HRRN picks ${PN(win)}, which has waited ${f.t - procs[win].arr}: its ratio ${f2(ratio(win, f.t))} beats ${PN(sh)}’s ${f2(ratio(sh, f.t))}.`  // the callout text: SPN's choice versus HRRN's, with both ratios worked out
                + (g && w2 === sh ? ` At t = ${g.t}, ${PN(sh)} has waited long enough to win (${f2(ratio(sh, g.t))}).` : '') };  // if the shortest job wins the next decision, adds when, and the ratio that let it win
            })();  // ends the function and runs it
            const chart = h('div'), bars = h('div');  // chart: the Gantt chart; bars: the ratio bar chart
            function draw(t) {  // draw(t): draws frame t of the animation; the player calls it and shows the caption it returns
              const f = sim.frames[t], go = f.ev.find((e) => e.k === 'go'), W = ctx.narrow ? 360 : 600, rh = 30, LW = 30, RW = ctx.narrow ? 140 : 200, MAXR = 4;  // f: the snapshot at t; go: its dispatch event; then the drawing size, row height, label and text widths, and the top of the ratio scale (4)
              chart.replaceChildren(gantt(ctx, procs, sim.segs, { T: sim.T, fin: sim.fin, upTo: t, cursor: t, rowH: 17, gap: 5, aria: 'HRRN schedule so far' }));  // the chart up to time t, with the "now" line
              const svg = s('svg', { viewBox: `0 0 ${W} ${procs.length * rh + 22}`, width: '100%', role: 'img', 'aria-label': 'Response ratio of each process at time t' });  // svg: the ratio chart, one row per process, with a description for screen readers
              const X = (r) => LW + (r / MAXR) * (W - LW - RW);  // X(r) turns a ratio into an x position
              [1, 2, 3, 4].forEach((r) => svg.append(s('line', { x1: X(r), x2: X(r), y1: 0, y2: procs.length * rh, class: 'gl' }), s('text', { x: X(r), y: procs.length * rh + 15, 'text-anchor': 'middle', class: 'ax' }, 'R = ' + r)));  // vertical grid lines at R = 1, 2, 3 and 4, each labelled under the chart
              procs.forEach((p, i) => {  // one row per process
                const y = i * rh + 4, fin = sim.fin[i], chosen = go && go.p === i;  // y: the top of the row; fin: its finish time; chosen: true if this process is picked at time t
                svg.append(s('text', { x: 4, y: y + 16, class: 'lbl' }, PN(i)));  // the process letter at the left
                let label;  // label: the text at the right of the row
                if (p.arr > t) label = `arrives at ${p.arr}`;  // not arrived yet: says when it will
                else if (fin != null && fin <= t) label = `done at ${fin}`;  // finished: says when
                else if (f.run === i && !chosen) label = ctx.narrow ? 'running' : 'running (ratio no longer matters)';  // already running (and not just picked): its ratio no longer matters (a shorter label on phone-width screens)
                else {  // otherwise it is waiting, so it gets a bar
                  const w = t - p.arr - (p.svc - f.rem[i]), R = (w + p.svc) / p.svc;  // w: the time it has waited so far; R: its response ratio
                  svg.append(s('rect', { x: LW, y, width: X(R) - LW, height: rh - 10, rx: 4, class: 'pc' + i, 'stroke-width': chosen ? 3.5 : 1.5, style: chosen ? 'stroke:var(--accent)' : null }));  // a bar as long as R, in the process's colour; the chosen process gets a thick accent outline
                  label = `(${w} + ${p.svc})/${p.svc} = ${f2(R)}` + (chosen ? (ctx.narrow ? ' ✓' : '  ← chosen') : '');  // label: the ratio sum with the numbers filled in, plus a marker on the chosen one (a tick on phone-width screens)
                }  // closes the waiting case
                svg.append(s('text', { x: W - RW + 8, y: y + 16, class: 'ax', style: chosen ? 'fill:var(--accent);font-weight:800;font-size:14px' : 'font-size:13.5px;fill:var(--ink-2)' }, label));  // writes the label at the right, in bold accent for the chosen process
              });  // ends the loop over processes
              bars.replaceChildren(svg);  // puts the ratio chart into its box
              return narrate(sim, procs, t);  // returns the caption for this frame, written by narrate from the engine's events
            }  // ends draw
            const player = ctx.ui.player({ count: sim.T + 1, render: draw, interval: 1300 });  // player: the animation controls, one frame per time unit from 0 to the end, 1.3 seconds per frame when playing
            panel.append(h('div', { class: 'split l fill' },  // the tab layout: two columns, the smaller one on the left
              h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the explanation
                h('h3', { class: 'm0', html: '<span class="t">Highest response ratio next (HRRN)</span>' }),  // heading: HRRN, as a dotted glossary term
                h('div', { class: 'eq', html: 'R = (w + s) / s' }),  // formula box: R = (w + s)/s
                h('p', { class: 'm0 small', html: '<b>Nonpreemptive.</b> Whenever the processor falls free, run the waiting process with the largest <span class="t">response ratio</span>. A newcomer starts at R = 1.0 (it has not waited yet), and R climbs for as long as it waits.' }),  // paragraph: HRRN is nonpreemptive and picks the largest ratio, which starts at 1.0 and climbs while waiting
                h('p', { class: 'm0 small', html: 'A short job climbs fast: each unit of waiting adds 1/s to its ratio, and s is small. So short jobs are favoured. But a long job’s ratio never stops growing, so it eventually beats any newcomer: <b>no starvation</b>.' }),  // paragraph: short jobs climb fast, yet long jobs keep growing, so nobody starves
                h('div', { class: 'callout tip small m0', 'data-label': `Watch t = ${d1.t}`, html: d1.html }),  // tip callout: the moment worked out in d1, with its time in the heading
                h('div', { class: 'callout warn small m0', 'data-label': 'Still needs a guess', html: 'Like SPN and SRT, HRRN needs an estimate of s for every process.' })),  // warning callout: HRRN still needs an estimate of s
              h('div', { class: 'stack', style: { gap: '6px' } }, chart, bars, player.el)));  // right column: the chart, the ratio bars and the player
            return () => player.stop();  // returns a tidy-up function, so playback stops when another tab is opened
          }  // ends hrrnTab
          function fbTab(panel) {  // fbTab(panel): draws the second tab, an animation of feedback scheduling
            let v = '1', sim = simulate(STANDARD, 'fb', { fb: v });  // v: which quanta are used ('1' or '2i'); sim: the feedback run of the standard workload
            const chart = h('div'), qs = h('div');  // chart: the Gantt chart; qs: the four queues and the processor
            const draw = (t) => {  // draw(t): draws frame t and returns its caption
              chart.replaceChildren(gantt(ctx, STANDARD, sim.segs, { T: sim.T, fin: sim.fin, upTo: t, cursor: t, rowH: 17, gap: 5, aria: 'Feedback schedule so far' }));  // the chart up to time t, with the "now" line
              qs.replaceChildren(queueView(ctx, sim, t));  // the queues and the processor as they are at time t
              return narrate(sim, STANDARD, t);  // returns the caption, written by narrate from the engine's events
            };  // ends draw
            const player = ctx.ui.player({ count: sim.T + 1, render: draw, interval: 1300 });  // player: one frame per time unit, 1.3 seconds per frame when playing
            const seg = ctx.ui.seg([{ value: '1', label: 'q = 1 in every queue' }, { value: '2i', label: 'q = 2ⁱ in RQi' }], v, (x) => { v = x; sim = simulate(STANDARD, 'fb', { fb: v }); player.setCount(sim.T + 1); });  // seg: switches the quanta; reruns the simulation and resets the player to the new number of frames
            panel.append(h('div', { class: 'split l fill' },  // the tab layout: two columns, the smaller one on the left
              h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the explanation
                h('p', { class: 'm0 small', html: '<span class="t">Feedback scheduling</span> needs <b>no estimates</b>. Instead of favouring jobs that are expected to be short, it penalizes jobs that have <i>already</i> run a long time.' }),  // paragraph: feedback needs no estimates; it penalizes jobs that have already run a long time
                h('ul', { class: 'small m0' },  // the list of rules
                  h('li', { html: 'A new process enters <b>RQ0</b>, the top queue.' }),  // rule: a new process enters RQ0
                  h('li', { html: 'Each time its quantum ends while others wait, it drops <b>one queue</b>. (If nobody else is waiting, it just carries on.)' }),  // rule: it drops one queue each time its quantum ends while others wait
                  h('li', { html: `The dispatcher serves the highest non-empty queue; each queue is FCFS, and the lowest (here RQ${FB_LEVELS - 1}) is round robin.` })),  // rule: the highest non-empty queue is served, and the lowest queue is round robin
                h('p', { class: 'm0 small', html: 'Short processes finish before sinking far, and a new short process beats an old long one.' }),  // paragraph: short processes finish before sinking far
                h('div', { class: 'callout warn small m0', 'data-label': 'Starvation risk', html: 'If new processes keep arriving, the ones at the bottom may never run. Giving lower queues longer quanta (2<sup>i</sup> in RQi) lets a long process get more done each time it does run, but only promoting a process that has waited too long (aging) truly prevents starvation.' })),  // warning callout: the starvation risk, and why longer quanta in lower queues do not fully cure it
              h('div', { class: 'stack', style: { gap: '6px' } }, seg, chart, qs, h('div', { class: 'xs muted' }, 'Small number on each process: the time it still needs.'), player.el)));  // right column: the quanta switch, chart, queues, a note on the small numbers, and the player
            return () => player.stop();  // returns a tidy-up function, so playback stops when another tab is opened
          }  // ends fbTab
          el.append(h('div', { class: 'fill' }, ctx.ui.tabs([  // the slide shows two tabs filling the full height
            { label: 'HRRN: the ratio race', render: hrrnTab },  // tab 1: HRRN
            { label: 'Feedback: sinking queues', render: fbTab },  // tab 2: feedback
          ])));  // closes the tab list
        },  // ends render for step 6
      },  // ends step 6

      /* ---------------- 7. The scheduler lab: one policy step by step, or all of them side by side ---------------- */
      {  // step 7 begins
        title: 'Scheduler lab: any policy, any workload',  // step 7 title
        kind: 'lab',  // kind lab: the slide is labelled Hands-on Lab
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): draws step 7 when the slide opens
          const { h, s } = ctx;  // takes the builders h (HTML) and s (SVG) out of the toolbox
          /* shared by both tabs: the workload (seed 0 = standard, -1 = edited by hand) and the chosen policy */
          const S = ctx.keep.lab || (ctx.keep.lab = { procs: STANDARD.map((p) => ({ ...p })), seed: 0, pol: 'fcfs', q: 1, fbv: '1', tab: 0, metric: 'ntr', frame: 0 });  // S: the shared state: the workload (a copy of STANDARD), its seed, the chosen policy, the round robin quantum, the feedback quanta, the open tab, the compare metric and the player's frame
          /* S lives in ctx.keep: empty on a normal visit (so a fresh S is made), but handed back when the window crosses the phone-width breakpoint, so the student's work survives that redraw */
          const optOf = () => (S.pol === 'rr' ? { q: S.q } : S.pol === 'fb' ? { fb: S.fbv } : {});  // optOf(): the options for the chosen policy: the quantum for round robin, the quanta for feedback, nothing for the rest
          const wlName = () => (S.seed > 0 ? `random, seed ${S.seed}` : S.seed < 0 ? 'edited by you' : 'standard');  // wlName(): a short name for the workload: random with its seed, edited by you, or standard
          const wlBtns = (after) => h('div', { class: 'row gap-s' },  // wlBtns(after): the two workload buttons; after() redraws whichever tab they sit in
            h('button', { class: 'btn sm', type: 'button', onclick: () => { S.seed = 0; S.procs = STANDARD.map((p) => ({ ...p })); after(); } }, 'Standard workload'),  // Standard workload: back to a fresh copy of the five standard processes
            h('button', { class: 'btn sm', type: 'button', onclick: () => { S.seed = S.seed > 0 ? S.seed + 1 : 7; S.procs = randomWorkload(S.seed); after(); } }, 'Random workload'));  // Random workload: the first click uses seed 7, each later click the next seed; closes the button row
          function stepTab(panel) {  // stepTab(panel): draws the first tab, one policy animated step by step on an editable workload
            let sim = simulate(S.procs, S.pol, optOf());  // sim: the run of the chosen policy on the current workload
            const chart = h('div'), qbox = h('div'), desc = h('p', { class: 'small m0', style: { minHeight: '42px' } }), variant = h('div', { class: 'row gap-s', style: { minHeight: '32px' } });  // chart, queue box, policy description, and the row for the policy's own setting (minimum heights stop the layout jumping)
            const wl = h('span', { class: 'chip' });  // wl: a chip naming the current workload
            const rows = [], cells = [];  // rows and cells: the table rows and their result cells, kept so draw() can update them in place
            const meanTr = h('td', { class: 'c num b' }), meanN = h('td', { class: 'c num b' });  // meanTr and meanN: the cells for the two means at the bottom of the table
            const mkIn = (i, key, lo, hi) => {  // mkIn(i, key, lo, hi): a small number box for process i's arrival or service time, limited to lo..hi
              const inp = h('input', { type: 'number', min: lo, max: hi, step: 1, value: S.procs[i][key], class: 'nin', 'aria-label': `${key === 'arr' ? 'Arrival' : 'Service'} time of ${PN(i)}` });  // the box itself, showing the current value, with a screen-reader label such as "Arrival time of A"
              inp.addEventListener('input', () => { const v = parseInt(inp.value, 10); if (!Number.isFinite(v)) return; S.procs[i][key] = Math.max(lo, Math.min(hi, v)); S.seed = -1; recompute(true); });  // on each keystroke: a whole number is clamped into range, stored, marks the workload as edited, and reruns the policy at the same frame
              inp.addEventListener('change', () => { inp.value = S.procs[i][key]; });  // when the student leaves the box, it shows the value actually used (after clamping)
              return inp;  // hands back the box
            };  // ends mkIn
            const inputs = S.procs.map((p, i) => [mkIn(i, 'arr', 0, 30), mkIn(i, 'svc', 1, 12)]);  // inputs: for each process, an arrival box (0 to 30) and a service box (1 to 12)
            S.procs.forEach((p, i) => {  // builds one table row per process
              cells[i] = [h('td', { class: 'c num' }), h('td', { class: 'c num' }), h('td', { class: 'c num' })];  // three empty result cells: finish, Tr and Tr/Ts
              rows[i] = h('tr', {}, h('td', {}, tok(ctx, i, null, 's')), h('td', { class: 'c' }, inputs[i][0]), h('td', { class: 'c' }, inputs[i][1]), ...cells[i]);  // the row: process badge, the two input boxes, then the result cells
            });  // ends the loop over processes
            const table = h('table', { class: 'tbl compact' },  // table: the lab's results table
              h('thead', {}, h('tr', {}, ...['Proc', 'Arrival', 'Service Ts', 'Finish', 'Tr', 'Tr/Ts'].map((x, k) => h('th', { class: k ? 'c' : '', style: { textTransform: 'none', fontSize: '13.5px' } }, x)))),  // header row: process, arrival, service, finish, Tr and Tr/Ts (all but the first centred)
              h('tbody', {}, ...rows, h('tr', {}, h('td', { class: 'b', colspan: 4 }, 'Mean'), meanTr, meanN)));  // body: the process rows, then a Mean row with the two mean cells
            function draw(t) {  // draw(t): draws frame t of the animation and returns its caption
              const f = sim.frames[t];  // f: the snapshot at time t
              chart.replaceChildren(gantt(ctx, S.procs, sim.segs, { T: sim.T, fin: sim.fin, upTo: t, cursor: t, rowH: 25, gap: 7, aria: 'Schedule so far' }));  // the chart up to time t, with the "now" line
              qbox.replaceChildren(queueView(ctx, sim, t));  // the ready queue(s) and the processor at time t
              S.procs.forEach((p, i) => {  // updates every process's row
                const done = sim.fin[i] != null && sim.fin[i] <= t;  // done: true once the process has finished by time t
                cells[i][0].textContent = done ? sim.fin[i] : '—';  // finish cell: its finish time once done, a dash before
                cells[i][1].textContent = done ? sim.tr[i] : '—';  // Tr cell: its turnaround once done
                cells[i][2].textContent = done ? f2(sim.ntr[i]) : '—';  // Tr/Ts cell: its normalized turnaround once done
                rows[i].classList.toggle('on', f.run === i);  // highlights the row of the process that is running now
              });  // ends the loop over rows
              meanTr.textContent = t === sim.T ? f2(sim.meanTr) : '—';  // mean Tr is shown only on the last frame, when every process has finished
              meanN.textContent = t === sim.T ? f2(sim.meanNtr) : '—';  // mean Tr/Ts likewise
              wl.textContent = 'workload: ' + wlName();  // refreshes the workload chip
              return narrate(sim, S.procs, t);  // returns the caption, written by narrate from the engine's events
            }  // ends draw
            const player = ctx.ui.player({ count: sim.T + 1, render: draw, interval: 1100, start: S.frame, onStep: (i) => { S.frame = i; } });  // player: one frame per time unit, 1.1 seconds per frame when playing; it opens on S.frame (the first frame on a normal visit) and records every frame change there
            function recompute(keep) { sim = simulate(S.procs, S.pol, optOf()); player.setCount(sim.T + 1, keep); }  // recompute(keep): reruns the policy and gives the player the new number of frames; keep stays on the current frame if possible
            function showVariant() {  // showVariant(): shows the chosen policy's description and its own setting
              const P = POL[S.pol];  // P: the chosen policy's entry in POL
              desc.innerHTML = `<b>${P.long}.</b> Selection: <b>${P.fn}</b>. ${P.mode}.`;  // the description: full name, selection function and decision mode
              if (S.pol === 'rr') variant.replaceChildren(ctx.ui.slider({ label: 'Quantum q', min: 1, max: 8, value: S.q, onInput: (v) => { S.q = v; recompute(false); } }));  // round robin: a quantum slider from 1 to 8; moving it reruns from the start
              else if (S.pol === 'fb') variant.replaceChildren(h('span', { class: 'small b' }, 'Quanta'), ctx.ui.seg([{ value: '1', label: 'q = 1 everywhere' }, { value: '2i', label: 'q = 2ⁱ in RQi' }], S.fbv, (v) => { S.fbv = v; recompute(false); }));  // feedback: a switch between quantum 1 everywhere and 2 to the power i in queue i
              else variant.replaceChildren(h('span', { class: 'small muted' }, 'No settings: this policy has no quantum.'));  // every other policy: a note that there is nothing to set
            }  // ends showVariant
            const polSeg = ctx.ui.seg(['fcfs', 'rr', 'spn', 'srt', 'hrrn', 'fb'].map((k) => ({ value: k, label: k === 'fb' ? 'FB' : POL[k].name, title: POL[k].long })), S.pol, (v) => { S.pol = v; showVariant(); recompute(false); });  // polSeg: the switch between the six policies (hovering shows the full name); a choice updates the setting row and reruns
            const reload = () => { inputs.forEach(([a, b], i) => { a.value = S.procs[i].arr; b.value = S.procs[i].svc; }); recompute(false); };  // reload(): after a workload button, copies the new times into the input boxes and reruns
            showVariant();  // shows the setting row for the starting policy
            panel.append(h('div', { class: 'split l fill' },  // the tab layout: two columns, the smaller one on the left
              h('div', { class: 'stack', style: { gap: '8px' } }, polSeg, desc, variant, table,  // left column: policy switch, description, setting, and the table
                h('div', { class: 'row gap-s' }, wlBtns(reload), wl),  // the workload buttons and the workload chip
                h('p', { class: 'xs muted m0' }, 'Type new arrival (0–30) and service (1–12) times to make your own workload.')),  // a hint that the student can type new times to build a workload
              h('div', { class: 'stack', style: { gap: '6px' } }, h('p', { class: 'xs muted m0' }, '▼ arrival · dashed = waiting · bar = running · blue line = now · queue numbers = time still needed'), chart, qbox, player.el)));  // right column: a legend for the chart, then the chart, the queues and the player
            return () => player.stop();  // returns a tidy-up function, so playback stops when another tab is opened
          }  // ends stepTab
          function compareTab(panel) {  // compareTab(panel): draws the second tab, all eight policy runs side by side on the same workload
            let metric = S.metric;  // metric: which mean the bar chart shows, 'ntr' (Tr/Ts) or 'tr' (Tr), read from S
            S.frame = 0;  // the workload can change on this tab, so the step tab starts again from its first frame when the student returns to it, as it always has
            const left = h('div', { class: 'stack', style: { gap: '6px' } }), bars = h('div'), msg = h('div', { class: 'msg info', style: { fontSize: '14.5px' } });  // left: the workload line and the stacked charts; bars: the bar chart; msg: the message under it
            function draw() {  // draw(): reruns every policy and redraws the tab
              const runs = VARIANTS.map(([name, pol, o]) => ({ name, sim: simulate(S.procs, pol, o) }));  // runs: every entry of VARIANTS run on the current workload
              const T = Math.max(...runs.map((r) => r.sim.T));  // T: the longest run, so every row shares one time axis
              left.replaceChildren(h('p', { class: 'small m0', html: `<b>Workload</b> (${wlName()}): ` + S.procs.map((p, i) => `${PN(i)} (${p.arr}, ${p.svc})`).join(' · ') }),  // the workload line: its name and each process's (arrival, service)
                gantt(ctx, S.procs, [], { T, W: 640, labelW: 74, rowH: 29, gap: 10, rows: runs.map((r) => ({ label: r.name, segs: r.sim.segs, small: true })), aria: 'Every policy on the same workload' }));  // one chart row per policy run, labelled with the run's name in a smaller font
              const vals = runs.map((r) => (metric === 'ntr' ? r.sim.meanNtr : r.sim.meanTr)), lo = Math.min(...vals), hi = Math.max(...vals);  // vals: each run's mean for the chosen metric; lo and hi: the best and worst of them
              const W = ctx.narrow ? 340 : 420, LW = 76, RW = 46, rh = 27, svg = s('svg', { viewBox: `0 0 ${W} ${runs.length * rh + 4}`, width: '100%', role: 'img', 'aria-label': 'Mean of the chosen measure for each policy' });  // drawing size (smaller on phone-width screens), label and value widths, row height, and the bar chart's svg
              runs.forEach((r, k) => {  // one bar per run
                const v = vals[k], y = k * rh + 4, w = (v / (hi * 1.02)) * (W - LW - RW), best = Math.abs(v - lo) < 1e-9, worst = Math.abs(v - hi) < 1e-9;  // v: its value; y: its row; w: bar length in proportion to the worst value; best and worst mark the ends
                svg.append(s('text', { x: 0, y: y + 15, class: 'lbl', style: 'font-size:13px' }, r.name),  // the run's name at the left
                  s('rect', { x: LW, y, width: Math.max(2, w), height: rh - 8, rx: 4, class: best ? 's-ok' : worst ? 's-bad' : 's-panel', 'stroke-width': 1.5 }),  // the bar: green for the best, red for the worst, plain for the rest
                  s('text', { x: LW + w + 6, y: y + 15, class: 'ax', style: 'font-size:13.5px;font-weight:700;fill:var(--ink-2)' }, f2(v)));  // the value written just after the bar
              });  // ends the loop over runs
              bars.replaceChildren(svg);  // puts the bar chart into its box
              const names = (pred) => runs.filter((r, k) => pred(vals[k])).map((r) => r.name).join(', ');  // names(pred): the names of the runs whose value passes the test pred, joined with commas
              const label = metric === 'ntr' ? 'mean normalized turnaround (Tr/Ts)' : 'mean turnaround (Tr)';  // label: the metric written in words
              msg.innerHTML = (Math.abs(hi - lo) < 1e-9 ? `Every policy gives the same ${label} here (${f2(lo)}), so on this workload the choice of policy makes no difference to the average. `  // if every run gives the same value, the message says the choice of policy makes no difference here
                : `Lowest ${label}: <b>${names((v) => Math.abs(v - lo) < 1e-9)}</b> (${f2(lo)}). Highest: <b>${names((v) => Math.abs(v - hi) < 1e-9)}</b> (${f2(hi)}). `) + `Try a few random workloads: policies that favour short processes usually win on averages, while round robin and feedback trade some of that for responsiveness without needing estimates.`;  // otherwise it names the best and worst runs, then suggests trying random workloads and what usually happens
            }  // ends draw
            draw();  // draws the tab once as it opens
            panel.append(h('div', { class: 'split r fill' }, left,  // the tab layout: two columns, the larger one on the left for the charts
              h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked
                ctx.ui.seg([{ value: 'ntr', label: 'Mean Tr/Ts' }, { value: 'tr', label: 'Mean Tr' }], metric, (v) => { metric = v; S.metric = v; draw(); }),  // the metric switch; switching is recorded in S and redraws
                bars, msg, wlBtns(draw))));  // the bar chart, the message and the workload buttons; closes the layout
          }  // ends compareTab
          el.append(h('div', { class: 'fill' }, ctx.ui.tabs([  // the slide shows two tabs filling the full height
            { label: 'Step through one policy', render: stepTab },  // tab 1: step through one policy
            { label: 'Compare all policies', render: compareTab },  // tab 2: compare all policies
          ], { initial: S.tab, onChange: (i) => { S.tab = i; } })));  // closes the tab list; the tabs open on S.tab (the first on a normal visit) and record every switch there
        },  // ends render for step 7
      },  // ends step 7

      /* ---------------- 8. Fair-share scheduling: dividing the processor among groups ---------------- */
      {  // step 8 begins
        title: 'Fair-share scheduling: fair to groups, not just processes',  // step 8 title
        kind: 'lab',  // kind lab: the slide is labelled Hands-on Lab
        render(el, ctx) {  // render(el, ctx): draws step 8 when the slide opens
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          const SECS = 24, BASE = 60, TICKS = 60;  // SECS: seconds simulated; BASE: the base priority; TICKS: clock ticks in one second, all added to the running process's count
          const K = ctx.keep.fair || (ctx.keep.fair = { k: 2, w1: 5, group: true, sec: 0 });  // K: this step's settings and the player's second; kept in ctx.keep, so a phone-width or desktop redraw hands them back
          let k = K.k, w1 = K.w1, group = K.group, run;  // k: processes in group 2; w1: group 1's weight in tenths (5 = 0.5); group: whether the group term is used (all read from K); run: the latest result
          const strip = h('div'), tbody = h('tbody'), pHead = h('th', { style: { textTransform: 'none', fontSize: '13px' } });  // strip: the timeline of who ran; tbody: the table body; pHead: the priority column heading, changed with the mode
          const procsOf = () => [{ g: 0 }, ...Array.from({ length: k }, () => ({ g: 1 }))];  // procsOf(): the processes to simulate: A alone in group 1 (g 0), then k processes in group 2 (g 1)
          const target = (j) => (j === 0 ? w1 / 10 : (10 - w1) / 10 / k);  // target(j): the share process j should get: A takes group 1's whole weight; group 2's weight is split evenly among its members
          const num = (x) => { const v = x * 100; return Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1); }, pct = (x) => num(x) + '%';  // num(x): a fraction written as a percentage, whole when it is close to whole, otherwise to 1 decimal; pct(x) adds the % sign
          const sum = h('div', { class: 'msg ok', style: { fontSize: '14.5px' } });  // sum: the green box that summarizes the whole run
          const compute = () => {  // compute(): runs the fair-share simulation for the current settings and fills in the summary box
            const o = { procs: procsOf(), w10: [w1, 10 - w1], base: BASE, ticks: TICKS, secs: SECS };  // o: the settings: processes, the two weights in tenths, base priority, ticks per second and seconds to simulate
            run = fairShare({ ...o, group });  // run: the run for the chosen mode (group term on or off); the player animates this one
            const fs = group ? run : fairShare({ ...o, group: true }), pp = group ? fairShare({ ...o, group: false }) : run;  // fs and pp: the fair-share run and the per-process-only run, reusing run for the chosen mode, so the two can be compared
            const off = Math.abs(fs.share[0] - w1 / 10) > 0.04, grp = (r) => `${pct(r.share[0])} / ${pct(1 - r.share[0])}`;  // off: true if fair share misses group 1's weight by more than 4 points; grp(r): the split between the two groups as "x% / y%"
            const note = off ? `<div class="xs" style="margin-top:3px">Whole-second turns let the split only approximate the weights.</div>` : '';  // note: when off, a small line explaining that whole-second turns can only approximate the weights
            /* small screens get one line per mode; the wide layout gets a compact table (one column per process) */
            const body = ctx.narrow  // body: the summary content; on phone-width screens, one line per mode
              ? ['Fair share', 'Per process only'].map((nm, k) => { const r = k ? pp : fs; return `${nm}: <b>${r.share.map((x, j) => `${PN(j)} ${pct(x)}`).join(' · ')}</b> <span class="muted">(groups ${grp(r)})</span>`; }).join('<br>')  // each line: the mode's name, every process's share in bold, and the group split in grey
              : `<table class="fsr"><tr><th class="muted">% of time</th>${fs.share.map((x, j) => `<th class="r">${PN(j)}</th>`).join('')}<th class="r">groups</th></tr>`  // on wider screens, a compact table: a header row with one column per process and a groups column
                + [['Fair share', fs], ['Per process', pp]].map(([nm, r]) => `<tr><th>${nm}</th>${r.share.map((x) => `<td class="r">${num(x)}</td>`).join('')}<td class="r b">${num(r.share[0])} / ${num(1 - r.share[0])}</td></tr>`).join('') + '</table>';  // one row per mode: each process's percentage, then the group split in bold; closes the table
            say(sum, 'ok', `Whole run (${SECS} s) · weights ${pct(w1 / 10)} / ${pct(1 - w1 / 10)}`, body + note);  // fills the summary box: a heading with the run length and the weights, then the body and the note
          };  // ends compute

          /* describe a tie truthfully: longest wait wins; if the tied processes waited equally, the first in line goes */
          function tieNote(sec) {  // tieNote(sec): extra caption text when second sec was decided by a tie
            const r = run.rows[sec], lo = Math.min(...r.P), tied = r.P.map((P, j) => j).filter((j) => r.P[j] === lo);  // r: that second's row; lo: the lowest priority number; tied: every process with that number
            if (tied.length < 2) return '';  // no tie: nothing to add
            const last = (j) => { for (let x = sec - 1; x >= 0; x--) if (run.rows[x].run === j) return x; return -1; };  // last(j): the most recent second before sec in which process j ran (-1 if it never has)
            return new Set(tied.map(last)).size === 1 ? ` (tied with ${andList(tied.filter((j) => j !== r.run).map(PN))}, which ${tied.length > 2 ? 'have' : 'has'} waited just as long, so the first in line goes)` : ' (a tie, won by the process that has waited longest)';  // if every tied process last ran at the same moment, the first in line wins; otherwise the one that has waited longest wins
          }  // ends tieNote
          function draw(sec) {  // draw(sec): draws second sec of the animation and returns its caption
            const r = run.rows[sec], n = r.P.length, W = [w1, 10 - w1];  // r: that second's row; n: how many processes there are; W: the two weights in tenths
            const segs = run.rows.slice(0, sec + 1).map((x) => ({ p: x.run, a: x.s, b: x.s + 1 }));  // segs: one bar a second long for every second so far, coloured by the process that ran
            strip.replaceChildren(gantt(ctx, [], segs, { T: SECS, W: 620, labelW: ctx.narrow ? 40 : 76, rowH: 30, rows: [{ label: ctx.narrow ? 'CPU' : 'Processor', segs, small: true }], cursor: sec, aria: 'Which process got each whole second' }));  // strip: a one-lane timeline (labelled CPU on phone-width screens, Processor otherwise) with a "now" line at sec
            const counts = Array(n).fill(0); run.rows.slice(0, sec + 1).forEach((x) => counts[x.run]++);  // counts: how many seconds each process has had so far
            tbody.replaceChildren(...r.P.map((P, j) => {  // rebuilds the table, one row per process
              const g = j === 0 ? 0 : 1, half = Math.floor(r.cpu[j] / 2), gt = group ? Math.floor((r.gcpu[g] * 10) / (4 * W[g])) : null;  // g: its group (A is group 1, the rest group 2); half: CPU/2 rounded down; gt: the group term, only in fair-share mode
              const share = counts[j] / (sec + 1);  // share: the fraction of the seconds so far that it got
              if (ctx.narrow) return h('tr', { class: r.run === j ? 'on' : '' }, h('td', {}, tok(ctx, j, null, 's')),  // phone-width row, highlighted for the process that runs this second: first the badge
                h('td', { class: 'c num' }, String(r.cpu[j])), h('td', { class: 'c num' }, String(r.gcpu[g])),  // then its own CPU count and its group's GCPU count
                h('td', { class: 'num', style: { whiteSpace: 'nowrap' }, html: `${BASE}+${half}${group ? '+' + gt : ''} = <b>${P}</b>` }), h('td', { class: 'num' }, pct(share)));  // then its priority sum written out (base + CPU/2 + group term = P) and its share so far
              return h('tr', { class: r.run === j ? 'on' : '' },  // wider row, highlighted for the process that runs this second
                h('td', {}, tok(ctx, j, null, 's')), h('td', { class: 'c' }, String(g + 1)),  // the badge and the group number
                h('td', { class: 'c num' }, String(r.cpu[j])), h('td', { class: 'c num' }, String(r.gcpu[g])),  // the CPU and GCPU counts
                h('td', { class: 'num', style: { whiteSpace: 'nowrap' }, html: `${BASE} + ${half}${group ? ' + ' + gt : ''} = <b>${P}</b>` }),  // the priority sum written out, with the result P in bold
                h('td', {}, h('div', { class: 'row gap-s nw' }, h('div', { class: 'meter', style: { width: '44px', flex: 'none' } }, h('i', { style: { width: Math.round(share * 100) + '%' } })), h('span', { class: 'small num', style: { whiteSpace: 'nowrap' } }, `${pct(share)} `, h('span', { class: 'muted xs' }, `aim ${pct(target(j))}`)))));  // a small meter bar showing its share so far, the percentage, and in grey the share it aims for
            }));  // ends the table rows
            pHead.textContent = ctx.narrow ? 'P' : group ? 'Priority P' : 'Priority P (no group term)';  // the priority column heading: just P on phone-width screens, otherwise Priority P, noting when the group term is left out
            return `<b>Second ${sec}.</b> ` + (sec ? 'Every count was halved, then priorities recomputed. ' : 'Nobody has run yet, so all priorities equal the base. ')  // caption: the second, then either that every count was halved and priorities recomputed, or that nobody has run yet
              + `Lowest number: <b>${PN(r.run)}</b> (${r.P[r.run]})` + tieNote(sec) + `. ${PN(r.run)} runs the whole second and gains ${TICKS} ticks` + (group ? ` (so does group ${r.run === 0 ? 1 : 2}).` : '.');  // then who has the lowest number (plus any tie note), and that it runs the whole second and gains 60 ticks, as does its group
          }  // ends draw
          compute();  // runs the simulation once before the slide is drawn
          const player = ctx.ui.player({ count: SECS, render: draw, interval: 1200, start: K.sec, onStep: (i) => { K.sec = i; } });  // player: one frame per simulated second, 1.2 seconds per frame when playing; it opens on K.sec (second 0 on a normal visit) and records every change there
          const redo = () => { compute(); player.setCount(SECS, true); };  // redo(): after a setting changes, reruns and keeps the player on the same second
          el.append(h('div', { class: 'split l fill' },  // the slide layout: two columns, the smaller one on the left
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the explanation
              h('p', { class: 'm0 small', html: 'So far each policy judged single processes, so a user running ten processes gets ten times the share of a user running one. <span class="t">Fair-share scheduling</span> decides by <b>groups</b> (users or applications).' }),  // paragraph: per-process policies favour users who run many processes; fair share decides by groups
              h('p', { class: 'm0 small', html: 'Each group k gets a <b>weight</b> W<sub>k</sub> (0 &lt; W<sub>k</sub> ≤ 1, all weights adding to 1): its intended share of the processor. Once a second:' }),  // paragraph: each group has a weight, its intended share of the processor
              h('div', { class: 'eq', html: 'CPU<sub>j</sub> = CPU<sub>j</sub> / 2 &nbsp;&nbsp; GCPU<sub>k</sub> = GCPU<sub>k</sub> / 2<br>P<sub>j</sub> = Base<sub>j</sub> + CPU<sub>j</sub>/2 + GCPU<sub>k</sub>/(4 × W<sub>k</sub>)<br><span style="font-family:var(--font)">lowest P runs next: a lower number is a higher priority</span>' }),  // formula box: the once-a-second halving, the priority formula, and that the lowest P runs next
              h('p', { class: 'small m0', html: '<b>CPU<sub>j</sub></b> is process j’s recent use (+1 for every clock tick it runs, 60 a second) and <b>GCPU<sub>k</sub></b> the same for its whole group. Halving makes old use fade; every division rounds down.' }),  // paragraph: what CPU and GCPU count, and that every division rounds down
              h('div', { class: 'callout why small m0', 'data-label': 'Why it works', html: 'Recent use by any member raises the number of <i>every</i> member of its group, so the members share one slice instead of each grabbing their own.' }), sum),  // why callout: one member's use raises every member's number, so the group shares one slice; then the summary box
            h('div', { class: 'card white stack', style: { gap: '7px' } },  // right column: the simulation in a white card
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Group 1: A.  Group 2:'), ctx.ui.seg([2, 3, 4].map((x) => ({ value: x, label: 'BCDE'.slice(0, x).split('').join(', ') })), k, (v) => { k = v; K.k = v; redo(); })),  // group 2 switch: B and C, B to D, or B to E; changing it is recorded in K and reruns
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'W₁ / W₂'), ctx.ui.seg([5, 4, 3].map((x) => ({ value: x, label: `${x / 10} / ${(10 - x) / 10}` })), w1, (v) => { w1 = v; K.w1 = v; redo(); }),  // weights switch: 0.5 / 0.5, 0.4 / 0.6 or 0.3 / 0.7; changing it is recorded in K and reruns
                ctx.ui.seg([{ value: 1, label: 'Fair share' }, { value: 0, label: 'Per process only' }], group ? 1 : 0, (v) => { group = !!v; K.group = group; redo(); })),  // mode switch: fair share or per process only, starting on the kept mode; changing it is recorded in K and reruns
              strip,  // the timeline of who got each second
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, ...(ctx.narrow ? ['Proc', 'CPU', 'GCPU'] : ['Proc', 'Group', 'CPU', 'GCPU']).map((x, i) => h('th', { class: i ? 'c' : '', style: { textTransform: 'none', fontSize: '13px' } }, x)), pHead,  // the table header: process, group (wider screens only), CPU, GCPU, then the priority heading
                h('th', { style: { textTransform: 'none', fontSize: '13px' } }, ctx.narrow ? 'Share' : 'Share so far'))), tbody),  // last heading: the share so far (shorter on phone-width screens); then the body
              player.el)));  // the player; closes the layout
          return () => player.stop();  // returns a tidy-up function, so playback stops when the student leaves the slide
        },  // ends render for step 8
      },  // ends step 8

      /* ---------------- 9. Recap: the summary table and the ideas to keep ---------------- */
      {  // step 9 begins
        title: 'Recap: six policies at a glance',  // step 9 title
        kind: 'recap',  // kind recap: the slide is labelled Recap
        render(el, ctx) {  // render(el, ctx): draws step 9 when the slide opens
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          /* [policy, selection, decision mode, throughput, response time, overhead, effect on processes, starvation, one-line takeaway] */
          const ROWS = [  // ROWS: the summary table, one row per policy, in the order given in the comment above
            ['FCFS', 'max[w]', 'Nonpreemptive', 'Not emphasized', 'Can be high, especially when service times vary a lot', 'Minimal', 'Penalizes short and I/O-bound processes', 'No', 'Simple and fair in arrival order, but one long job makes everyone behind it wait.'],  // row: FCFS, simple but one long job delays everyone
            ['Round robin', 'Constant (everyone in turn)', 'Preemptive, at the end of each quantum', 'Can be low if the quantum is too small', 'Good for short processes', 'Minimal', 'Fair to all', 'No', 'Everyone gets a turn; the quantum length decides between overhead and FCFS-like behaviour.'],  // row: round robin, where the quantum decides between overhead and FCFS-like behaviour
            ['SPN', 'min[s]', 'Nonpreemptive', 'High', 'Good for short processes', 'Can be high', 'Penalizes long processes', 'Possible', 'Short jobs jump the line; needs estimates of s; long jobs can wait forever.'],  // row: SPN, short jobs first, long jobs can starve
            ['SRT', 'min[s − e]', 'Preemptive, when a process arrives', 'High', 'Good', 'Can be high', 'Penalizes long processes', 'Possible', 'SPN with preemption. If service times were known exactly, no policy could beat its mean turnaround; the price is tracking e.'],  // row: SRT, SPN with preemption and the best mean turnaround when service times are known
            ['HRRN', 'max[(w + s)/s]', 'Nonpreemptive', 'High', 'Good', 'Can be high', 'Good balance', 'No', 'Favours short jobs, but waiting raises everyone’s ratio, so nobody starves.'],  // row: HRRN, favours short jobs while waiting prevents starvation
            ['Feedback', 'Highest non-empty queue (FCFS inside)', 'Preemptive, at the end of each quantum', 'Not emphasized', 'Not emphasized', 'Can be high', 'May favour I/O-bound processes', 'Possible', 'No estimates needed: processes that have run a long time sink to lower queues.'],  // row: feedback, no estimates, long-running processes sink
          ];  // closes ROWS
          const HD = ['Policy', 'Selection function', 'Decision mode', 'Throughput', 'Response time', 'Overhead', 'Effect on processes', 'Starvation'];  // HD: the column headings of the table (the takeaway column is shown separately)
          function tableTab(panel) {  // tableTab(panel): draws the first tab, the clickable summary table
            const say1 = h('div', { class: 'msg info' });  // say1: the message box that shows the chosen policy's takeaway
            const trs = ROWS.map((r, k) => {  // trs: one table row per policy
              const tr = h('tr', { tabindex: 0, role: 'button', style: { cursor: 'pointer' }, 'aria-label': 'Explain ' + r[0] },  // the row can be reached with Tab and acts as a button, with a pointer cursor and a screen-reader label such as "Explain FCFS"
                ...r.slice(0, 8).map((c, j) => h('td', { class: j === 0 ? 'b' : j === 7 ? 'c' : '', style: j === 7 ? { color: c === 'No' ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 } : j === 1 ? { fontFamily: 'var(--mono)', fontSize: '13px' } : null }, c)));  // its first 8 cells: the name bold, the selection function in a fixed-width font, starvation centred in green (No) or red
              const pick = () => { trs.forEach((x, j) => x.classList.toggle('on', j === k)); say(say1, 'info', r[0], r[8]); };  // pick(): highlights this row and shows its one-sentence takeaway in the box
              tr.addEventListener('click', pick);  // a click picks the row
              tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });  // Enter or Space pick it too; preventDefault stops Space from scrolling the page
              return tr;  // hands back the row
            });  // ends the rows
            say(say1, 'info', 'Click a row', 'Click any policy for its one-sentence takeaway.');  // the box's starting text: click any row
            if (ctx.narrow) {  // on phone-width screens: one card per policy instead of a wide table
              panel.append(h('div', { class: 'stack gap-s' }, ...ROWS.map((r) => h('div', { class: 'card tight small' },  // one card for each policy
                h('div', { class: 'b', style: { fontSize: '16px' } }, r[0]),  // the policy's name, large and bold
                h('div', { html: HD.slice(1).map((x, j) => `<b>${x}:</b> ${r[j + 1]}`).join(' · ') }),  // every other column as "heading: value", all on one line
                h('div', { class: 'muted', style: { marginTop: '4px' } }, r[8])))));  // the takeaway in grey; closes the cards
              return;  // the cards are done, so the wide table is skipped
            }  // closes the phone-width case
            panel.append(h('div', { class: 'stack' },  // wider screens: a stack holding
              h('table', { class: 'tbl compact', style: { fontSize: '13.5px' } }, h('thead', {}, h('tr', {}, ...HD.map((x) => h('th', { style: { fontSize: '12px' } }, x)))), h('tbody', {}, ...trs)),  // the summary table in a smaller font: a header row from HD, then the policy rows built above
              say1));  // and the takeaway box under it; closes the stack
          }  // ends tableTab
          function cardsTab(panel) {  // cardsTab(panel): draws the second tab, six flip cards for testing recall
            panel.append(h('div', { class: 'stack fill' },  // a stack filling the tab
              h('p', { class: 'm0 small muted' }, 'Say the answer out loud, then click the card to check.'),  // instruction: say the answer out loud before flipping the card
              ctx.ui.flipcards([  // the flip cards, each written as [question on the front, answer on the back]
                ['What do Tr and Tr/Ts measure?', 'Turnaround Tr = finish − arrival (all waiting plus all running). Tr/Ts divides by the service time: 1.0 is perfect; bigger means a longer wait relative to the work.'],  // card: what Tr and Tr/Ts measure
                ['Selection function vs decision mode?', 'The selection function (written with w, e, s) picks who runs. The decision mode says when a choice may be made: only when the running process stops, or also by interrupting it.'],  // card: selection function versus decision mode
                ['Why not use a tiny quantum?', 'Every switch costs processor time. Too small a quantum wastes the processor on overhead; too large turns round robin into FCFS. Aim a little above a typical interaction.'],  // card: why a tiny quantum is a bad idea
                ['Which policies can starve a process?', 'SPN, SRT and feedback (and fixed priority queues without aging). FCFS, round robin and HRRN cannot.'],  // card: which policies can starve a process
                ['Where do SPN, SRT and HRRN get s?', 'From estimates: supplied for batch jobs, or predicted from past bursts with exponential averaging, S(n+1) = αT(n) + (1 − α)S(n).'],  // card: where SPN, SRT and HRRN get s
                ['What makes fair share different?', 'It divides the processor among groups by weight. A group’s recent use (GCPU) raises the priority number of all its members, so they share one slice.'],  // card: what makes fair share different
              ], { cols: ctx.narrow ? 1 : 3, height: 200 })));  // one column of cards on phone-width screens, three otherwise, each 200 pixels tall; closes the tab
          }  // ends cardsTab
          el.append(h('div', { class: 'fill' }, ctx.ui.tabs([{ label: 'Summary table', render: tableTab }, { label: 'Six ideas to keep', render: cardsTab }])));  // the slide shows two tabs filling the full height: the summary table and the six ideas
        },  // ends render for step 9
      },  // ends step 9

      /* ---------------- 10. Check yourself (numeric answers come from the engine) ---------------- */
      {  // step 10 begins
        title: 'Check yourself',  // step 10 title
        kind: 'check',  // kind check: the slide is labelled Check Yourself
        quiz: (() => {  // quiz: built by a function that runs once when the page loads, so every numeric answer is computed by the engine
          const W = STANDARD, fc = simulate(W, 'fcfs'), spn = simulate(W, 'spn'), hr = simulate(W, 'hrrn');  // W: the standard workload; fc, spn and hr: its FCFS, SPN and HRRN runs
          const eStart = fc.fin[4] - W[4].svc;  // eStart: when E starts under FCFS (its finish time minus its service time), quoted in question 2
          const d9 = hr.frames[9], R = (i) => (9 - W[i].arr + W[i].svc) / W[i].svc;  // d9: the HRRN snapshot at time 9; R(i): the response ratio of process i at time 9, for a process that has not run yet
          const nextS = expAvg([4], 0.5, 10)[1];  // nextS: one step of exponential averaging from a guess of 10 and a burst of 4 with alpha 0.5
          const fsr = fairShare({ procs: [{ g: 0 }, { g: 1 }, { g: 1 }], w10: [5, 5], base: 60, ticks: 60, secs: 2, group: true }).rows[1];  // fsr: second 1 of a small fair-share run: A alone in group 1, two processes in group 2, equal weights
          return [  // returns the list of questions
            { q: 'An interactive user cares most about how soon the system <i>starts</i> to answer a request. Which criterion measures exactly that?',  // question 1 (multiple choice): which criterion measures how soon a system starts to answer
              choices: ['Turnaround time', 'Response time', 'Throughput', 'Processor utilization'], answer: 1,  // the four choices; the right one is response time (position 1, counting from 0)
              feedback: ['Turnaround runs until the whole process completes, so it includes much more than the wait for the first reply.', null, 'Throughput counts completed processes per unit of time for the whole system; it says nothing about one user’s wait.', 'Utilization is the share of time the processor is busy, a system-oriented measure.'],  // feedback for each wrong choice (null for the right one), shown after a wrong pick
              why: 'Response time runs from submitting a request until the response begins. It is user-oriented and performance-related, and it is the right yardstick for interactive work.' },  // explanation shown after answering: what response time measures
            { type: 'num', q: `Under FCFS, process E arrives at time ${W[4].arr} and needs ${W[4].svc} units of processor time. Processes that arrived earlier keep the processor busy until time ${eStart}, and then E runs. What is E’s normalized turnaround time (Tr/Ts)?`,  // question 2 (calculate): E's normalized turnaround under FCFS, with E's numbers filled in from the workload
              answer: +fc.ntr[4].toFixed(2), tol: 0.01,  // the answer comes from the engine's FCFS run, rounded to 2 decimals; answers within 0.01 count
              why: `E finishes at ${fc.fin[4]}, so Tr = ${fc.fin[4]} − ${W[4].arr} = ${fc.tr[4]} and Tr/Ts = ${fc.tr[4]} / ${W[4].svc} = ${f2(fc.ntr[4])}. A short process stuck behind long ones is exactly where FCFS does worst.` },  // explanation: the turnaround sums worked out
            { type: 'num', q: 'Five processes, given as (arrival, service): ' + W.map((p, i) => `${PN(i)} (${p.arr}, ${p.svc})`).join(', ') + '. Under shortest process next (SPN, nonpreemptive), at what time does C finish?',  // question 3 (calculate): when C finishes under SPN, with the whole workload listed
              answer: spn.fin[2], tol: 0,  // the answer comes from the engine's SPN run and must be exact
              why: 'The schedule is ' + spn.segs.map((g) => `${PN(g.p)} ${g.a}–${g.b}`).join(', ') + `. At t = ${spn.fin[1]}, C, D and E are waiting and E (s = ${W[4].svc}) is the shortest, so E runs before C.` },  // explanation: the whole SPN schedule, and why E runs before C
            { type: 'num', q: `Under HRRN, the processor falls free at time 9. Process C arrived at time ${W[2].arr}, needs ${W[2].svc} units and has not run yet. What is its response ratio R = (w + s)/s?`,  // question 4 (calculate): C's response ratio at time 9 under HRRN
              answer: +R(2).toFixed(2), tol: 0.01,  // the answer is R(2), rounded to 2 decimals
              why: `C has waited w = 9 − ${W[2].arr} = ${9 - W[2].arr}, so R = (${9 - W[2].arr} + ${W[2].svc})/${W[2].svc} = ${f2(R(2))}. ` + d9.pool.filter((i) => i !== 2).map((i) => `${PN(i)} has ${f2(R(i))}`).join(' and ') + `, so HRRN runs ${PN(d9.run)}.` },  // explanation: C's ratio worked out, the other candidates' ratios, and who HRRN runs
            { type: 'num', q: 'A process’s predicted burst was S(n) = 10 ms, but its latest burst actually took T(n) = 4 ms. With exponential averaging and α = 0.5, what is the next prediction S(n+1), in ms?',  // question 5 (calculate): one step of exponential averaging
              answer: nextS, tol: 0.01, unit: 'ms',  // the answer is nextS, in ms
              why: `S(n+1) = αT(n) + (1 − α)S(n) = 0.5 × 4 + 0.5 × 10 = ${nextS} ms. The estimate moves halfway toward the newest observation.` },  // explanation: the formula with the numbers put in
            { type: 'num', q: `Fair-share scheduling with base priority 60 and 60 clock ticks per second. Process A is alone in group 1 (weight 0.5) and ran for the whole first second. At the next update the counts are halved, so CPU<sub>A</sub> = ${fsr.cpu[0]} and GCPU<sub>1</sub> = ${fsr.gcpu[0]}. What is A’s new priority P = Base + CPU/2 + GCPU/(4W)?`,  // question 6 (calculate): A's fair-share priority after the first second, with the halved counts filled in from the engine
              answer: fsr.P[0], tol: 0,  // the answer comes from the engine's fair-share row and must be exact
              why: `P = 60 + ${fsr.cpu[0]}/2 + ${fsr.gcpu[0]}/(4 × 0.5) = 60 + ${Math.floor(fsr.cpu[0] / 2)} + ${fsr.P[0] - 60 - Math.floor(fsr.cpu[0] / 2)} = ${fsr.P[0]}. Processes that have not run still have 60, and a lower number means a higher priority, so one of them runs next.` },  // explanation: the priority sum worked out, and why a process that has not run goes next
            { type: 'tf', q: 'Making the round-robin quantum longer than every process’s service time turns round robin into FCFS.', answer: true,  // question 7 (true or false): a quantum longer than every service time turns round robin into FCFS; true
              why: 'If the clock never cuts a process off, each one runs to completion in the order it reached the queue, which is exactly FCFS.' },  // explanation: nobody is ever cut off, so processes run in arrival order
            { type: 'multi', q: 'Which of these policies can starve a process, leaving it waiting indefinitely while other processes keep arriving?',  // question 8 (select all that apply): which policies can starve a process
              choices: ['FCFS', 'Round robin', 'SPN', 'SRT', 'HRRN', 'Feedback'], answer: [2, 3, 5],  // the six policies; the right answers are SPN, SRT and feedback
              why: 'SPN and SRT keep preferring newly arrived short processes over a long one, and feedback can leave long processes stuck in the bottom queue. FCFS and round robin serve in turn, and a waiting process’s HRRN ratio keeps growing until it wins.' },  // explanation: why those three can starve and the other three cannot
            { type: 'match', q: 'Match each policy to its selection function (w = time waited, e = time executed, s = total service time).',  // question 9 (match the pairs): each policy with its selection function
              pairs: [['FCFS', 'max[w]'], ['SPN', 'min[s]'], ['SRT', 'min[s − e]'], ['HRRN', 'max[(w + s)/s]'], ['Round robin', 'constant: everyone in turn']],  // the five correct pairs; the quiz mixes up the right-hand side
              why: 'FCFS picks the longest waiter, SPN the shortest job, SRT the least remaining time, HRRN the largest response ratio, and round robin simply rotates through the ready queue.' },  // explanation: what each policy picks
            { type: 'bucket', q: 'Sort each policy by its decision mode.', buckets: ['Nonpreemptive', 'Preemptive'],  // question 10 (sort into groups): nonpreemptive or preemptive
              items: [['FCFS', 0], ['Round robin', 1], ['SPN', 0], ['SRT', 1], ['HRRN', 0], ['Feedback', 1]],  // the six policies, each with its correct group (0 = nonpreemptive, 1 = preemptive)
              why: 'FCFS, SPN and HRRN choose only when the running process ends or blocks. Round robin and feedback preempt at the end of a quantum; SRT preempts when a process with less remaining time arrives.' },  // explanation: when each policy may make its choice
            { q: 'In virtual round robin, what happens to a process that comes back from an I/O wait?',  // question 11 (multiple choice): what virtual round robin does with a process returning from I/O
              choices: ['It joins an auxiliary queue served before the main ready queue, and runs for at most the rest of its quantum', 'It goes to the back of the main ready queue, like any other process, and receives a fresh full quantum', 'It immediately preempts whichever process is running, then uses up the rest of its unfinished quantum', 'It joins an auxiliary queue that the dispatcher serves only once the main ready queue is completely empty'], answer: 0,  // the four choices; the first is right
              feedback: [null, 'That is plain round robin, and it is exactly what makes round robin unfair to I/O-bound processes.', 'VRR does not interrupt the running process; the auxiliary queue is served at the next dispatch.', 'That would make I/O-bound processes wait even longer. The auxiliary queue is served first, not last.'],  // feedback for each wrong choice: plain round robin, preempting, and serving the auxiliary queue last
              why: 'VRR gives an I/O-bound process credit for the part of its quantum it did not use: it is served first, but only for that remainder, so it never gets more than one quantum per turn.' },  // explanation: the process gets credit for its unused quantum, but never more than one quantum per turn
            { type: 'order', q: 'Put the once-per-second work of the fair-share scheduler in order.',  // question 12 (put in order): the fair-share scheduler's once-a-second work
              items: ['Halve every process’s CPU count and every group’s GCPU count', 'Recompute each priority P = Base + CPU/2 + GCPU/(4W)', 'Give the processor to the process with the lowest P', 'Add the clock ticks it uses to its own CPU count and to its group’s GCPU count'],  // the four steps, written in the correct order; the quiz shuffles them for the student
              why: 'Decay comes first, so old use counts less; then every priority is recomputed; the lowest number runs; and the ticks it uses are charged to it and to its whole group, raising their numbers for the next round.' },  // explanation: decay first, then recompute, run the lowest, and charge the ticks
          ];  // closes the question list
        })(),  // ends the function and runs it at once
      },  // ends step 10
    ],  // closes the steps list

    notes: `${/* notes: the section's study notes for the Notes panel, written as HTML in a template string so engine results can be filled in */''}
      <h3>Scheduling algorithms</h3>${/* notes title: scheduling algorithms */''}
      <p>On one processor only one process runs at a time. The short-term scheduler (the <b>dispatcher</b>) chooses which ready process runs next; its rule is the scheduling algorithm, or policy.</p>${/* notes paragraph: one process runs at a time, and the dispatcher picks the next by a policy */''}
      <h4>Scheduling criteria</h4>${/* notes heading: scheduling criteria */''}
      <table>${/* start of the criteria table */''}
        <tr><th></th><th>Performance-related (measurable)</th><th>Other (qualitative)</th></tr>${/* table header row: measurable criteria versus qualitative ones */''}
        <tr><th>User-oriented</th><td><b>Turnaround time</b>: submission to completion (waiting plus running); suits batch jobs. <b>Response time</b>: for an interactive request, submission until the response <i>begins</i>; what users notice. <b>Deadlines</b>: maximize the percentage met.</td><td><b>Predictability</b>: a job takes about the same time and cost whatever the load.</td></tr>${/* user-oriented row: turnaround, response time and deadlines; then predictability */''}
        <tr><th>System-oriented</th><td><b>Throughput</b>: processes completed per unit of time. <b>Processor utilization</b>: percentage of time busy; matters on expensive shared systems.</td><td><b>Fairness</b>: treat processes alike; none starves. <b>Enforcing priorities</b>: favour higher priorities. <b>Balancing resources</b>: keep all resources busy; favour processes that avoid overloaded resources.</td></tr>${/* system-oriented row: throughput and utilization; then fairness, priorities and balancing resources */''}
      </table>${/* end of the criteria table */''}
      <p>Criteria conflict: frequent switching gives good response time but adds overhead, lowering throughput.</p>${/* notes paragraph: the criteria conflict with each other */''}
      <h4>Priorities</h4>${/* notes heading: priorities */''}
      <p>Ready queues RQ0 (highest priority) to RQn (lowest); the dispatcher serves the highest non-empty queue. Risk: low-priority processes can <b>starve</b>. Remedy: let priority change with age (aging) or execution history.</p>${/* notes paragraph: priority queues, starvation and aging */''}
      <h4>Describing a policy</h4>${/* notes heading: describing a policy */''}
      <ul>${/* start of the list */''}
        <li><b>Selection function</b>: the rule that picks the next process, written with <b>w</b> = time spent waiting so far, <b>e</b> = time spent executing so far, <b>s</b> = total service time required, including e (usually an estimate). s − e is the time still needed.</li>${/* list item: the selection function and what w, e and s mean */''}
        <li><b>Decision mode</b>. <i>Nonpreemptive</i>: a running process continues until it terminates or blocks itself. <i>Preemptive</i>: the OS may interrupt it and move it to Ready when a new process arrives, when an interrupt makes a blocked process ready, or periodically on a clock interrupt. More overhead, but usually better service.</li>${/* list item: the decision mode, nonpreemptive or preemptive */''}
      </ul>${/* end of the list */''}
      <h4>Measuring a schedule</h4>${/* notes heading: measuring a schedule */''}
      <p>Turnaround Tr = finish time − arrival time. Normalized turnaround = Tr/Ts, where Ts is the service time; 1.0 means the process never waited, and larger values mean a longer delay relative to the work it needed. Standard workload (arrival, service): ${STANDARD.map((p, i) => `${PN(i)} (${p.arr}, ${p.svc})`).join(', ')}. Conventions: time advances in whole units; a process arriving at time t joins the queue before a process that is preempted (or whose quantum expires) at the same t; ties in SPN and SRT go to the earlier arrival.</p>${/* notes paragraph: Tr and Tr/Ts, the standard workload filled in from STANDARD, and the timing rules the simulations follow */''}
      <h4>First-come-first-served (FCFS)</h4>${/* notes heading: FCFS */''}
      <p>Selection max[w]; nonpreemptive. Bad for a short process behind a long one: on the standard workload E needs ${STANDARD[4].svc} units but finishes at ${simulate(STANDARD, 'fcfs').fin[4]}, a normalized turnaround of ${f2(simulate(STANDARD, 'fcfs').ntr[4])}. It favours processor-bound over I/O-bound processes, which wait behind long bursts while their devices sit idle.</p>${/* notes paragraph: FCFS, with process E's finish and Tr/Ts computed by the engine when the page loads */''}
      <h4>Round robin (RR)</h4>${/* notes heading: round robin */''}
      <p>A clock interrupt every quantum q; the running process goes to the back of the ready queue (behind processes arriving at that instant). Very short q: short processes finish fast but interrupt and dispatch overhead grows. Rule of thumb: slightly longer than a typical interaction. Longer than every burst: RR becomes FCFS.</p>${/* notes paragraph: how round robin works and how to choose the quantum */''}
      <p>RR is unfair to I/O-bound processes, which use part of a quantum, block, then wait behind full quanta. <b>Virtual round robin</b>: processes returning from I/O join an auxiliary FCFS queue served before the main queue, and run only for the rest of their quantum.</p>${/* notes paragraph: why round robin is unfair to I/O-bound processes, and how virtual round robin fixes it */''}
      <h4>Shortest process next (SPN) and shortest remaining time (SRT)</h4>${/* notes heading: SPN and SRT */''}
      <p><b>SPN</b>: selection min[s]; nonpreemptive. Short processes jump ahead, so averages improve (mean Tr ${f2(simulate(STANDARD, 'spn').meanTr)} against ${f2(simulate(STANDARD, 'fcfs').meanTr)} for FCFS on the standard workload), but long processes wait longer and less predictably, and can starve. It needs service-time estimates; a batch job that runs far past its estimate may be aborted.</p>${/* notes paragraph: SPN, with the mean turnaround of SPN and FCFS computed by the engine */''}
      <p><b>SRT</b>: the preemptive version, selection min[s − e]. A new arrival with less time left preempts. No extra clock interrupts, but elapsed times must be recorded. Turnaround is better than SPN (mean Tr ${f2(simulate(STANDARD, 'srt').meanTr)}); long processes can still starve.</p>${/* notes paragraph: SRT as preemptive SPN, with its mean turnaround from the engine */''}
      <p><b>Estimating service time</b> from past bursts T(1), T(2), ...: the simple average S(n+1) = (1/n) Σ T(i) weights bursts equally. <b>Exponential averaging</b> S(n+1) = αT(n) + (1 − α)S(n), 0 &lt; α &lt; 1, gives weights α, α(1 − α), α(1 − α)², ... to T(n), T(n − 1), T(n − 2), ...; older observations count less and less. A larger α follows changes faster: with α = 0.8 the last four bursts carry ${(100 * (1 - 0.2 ** 4)).toFixed(2)}% of the weight. Worked example: α = 0.5, S(n) = 10, T(n) = 4 gives S(n+1) = 0.5 × 4 + 0.5 × 10 = ${expAvg([4], 0.5, 10)[1]}.</p>${/* notes paragraph: the simple and exponential averages, the weight on the last four bursts, and a worked example */''}
      <h4>Highest response ratio next (HRRN)</h4>${/* notes heading: HRRN */''}
      <p>Selection max[R] with response ratio R = (w + s)/s; nonpreemptive. R starts at 1.0 and grows while a process waits, faster for short ones: short jobs are favoured, yet a long job’s ratio eventually wins, so no starvation. Needs estimates. Example: at t = 9 on the standard workload ${[2, 3, 4].map((i) => `${PN(i)} has R = (${9 - STANDARD[i].arr} + ${STANDARD[i].svc})/${STANDARD[i].svc} = ${f2((9 - STANDARD[i].arr + STANDARD[i].svc) / STANDARD[i].svc)}`).join(', ')}, so ${PN(simulate(STANDARD, 'hrrn').frames[9].run)} runs (SPN would have picked ${PN(simulate(STANDARD, 'spn').frames[9].run)}).</p>${/* notes paragraph: HRRN, with the response ratios at t = 9 worked out and compared with SPN's choice */''}
      <h4>Feedback (multilevel feedback queues)</h4>${/* notes heading: feedback */''}
      <p>No estimates: penalize processes that have run longer. Preemptive at the quantum. A new process enters RQ0 and drops one queue each time it is preempted (unless nobody else is waiting). Queues are FCFS, the lowest is round robin, and the highest non-empty queue is served (the simulations in this section use ${FB_LEVELS} queues, RQ0 to RQ${FB_LEVELS - 1}). Short processes finish before sinking far. Long ones can starve. Giving RQi a longer quantum of 2<sup>i</sup> lets a long process do more per turn; promoting a process that has waited too long (aging) is what prevents starvation.</p>${/* notes paragraph: how feedback queues work, the number of queues used here, and the starvation risk */''}
      <h4>Results on the standard workload</h4>${/* notes heading: results on the standard workload */''}
      <table>${/* start of the results table */''}
        <tr><th>Policy</th>${STANDARD.map((p, i) => `<th>${PN(i)}</th>`).join('')}<th>Mean Tr</th><th>Mean Tr/Ts</th></tr>${/* results header row: one column per process, then the two means */''}
        ${VARIANTS.map(([name, pol, o]) => { const r = simulate(STANDARD, pol, o); return `<tr><td>${name}</td>${r.fin.map((x) => `<td>${x}</td>`).join('')}<td>${f2(r.meanTr)}</td><td>${f2(r.meanNtr)}</td></tr>`; }).join('')}${/* one row per policy run in VARIANTS, its finish times and means computed by the engine when the page loads */''}
      </table>${/* end of the results table */''}
      <p>Cells are finish times. ${(() => { const r = VARIANTS.map(([n, p, o]) => [n, simulate(STANDARD, p, o)]), lo = Math.min(...r.map((x) => x[1].meanNtr)), hi = Math.max(...r.map((x) => x[1].meanNtr)); const who = (v) => r.filter((x) => Math.abs(x[1].meanNtr - v) < 1e-9).map((x) => x[0]).join(' and '); return `Lowest mean Tr/Ts: ${who(lo)} (${f2(lo)}); highest: ${who(hi)} (${f2(hi)}).`; })()}</p>${/* notes paragraph: what the cells mean, and which runs give the lowest and highest mean Tr/Ts */''}
      <h4>Summary of characteristics</h4>${/* notes heading: summary of characteristics */''}
      <table>${/* start of the summary table */''}
        <tr><th>Policy</th><th>Selection</th><th>Decision mode</th><th>Throughput</th><th>Response time</th><th>Overhead</th><th>Effect on processes</th><th>Starvation</th></tr>${/* summary header row: the eight properties compared */''}
        <tr><td>FCFS</td><td>max[w]</td><td>Nonpreemptive</td><td>Not emphasized</td><td>May be high, especially with large variance in service times</td><td>Minimum</td><td>Penalizes short and I/O-bound processes</td><td>No</td></tr>${/* summary row: FCFS */''}
        <tr><td>RR</td><td>constant</td><td>Preemptive (at quantum)</td><td>May be low if quantum too small</td><td>Good for short processes</td><td>Minimum</td><td>Fair treatment</td><td>No</td></tr>${/* summary row: round robin */''}
        <tr><td>SPN</td><td>min[s]</td><td>Nonpreemptive</td><td>High</td><td>Good for short processes</td><td>Can be high</td><td>Penalizes long processes</td><td>Possible</td></tr>${/* summary row: SPN */''}
        <tr><td>SRT</td><td>min[s − e]</td><td>Preemptive (at arrival)</td><td>High</td><td>Good</td><td>Can be high</td><td>Penalizes long processes</td><td>Possible</td></tr>${/* summary row: SRT */''}
        <tr><td>HRRN</td><td>max[(w + s)/s]</td><td>Nonpreemptive</td><td>High</td><td>Good</td><td>Can be high</td><td>Good balance</td><td>No</td></tr>${/* summary row: HRRN */''}
        <tr><td>Feedback</td><td>highest non-empty queue</td><td>Preemptive (at quantum)</td><td>Not emphasized</td><td>Not emphasized</td><td>Can be high</td><td>May favour I/O-bound processes</td><td>Possible</td></tr>${/* summary row: feedback */''}
      </table>${/* end of the summary table */''}
      <h4>Fair-share scheduling</h4>${/* notes heading: fair-share scheduling */''}
      <p>Decisions are based on groups of processes (per user or per application) rather than single processes. Group k gets a weight W<sub>k</sub> (0 &lt; W<sub>k</sub> ≤ 1, weights summing to 1), its share of the processor. Once per second: CPU<sub>j</sub> = CPU<sub>j</sub>/2 and GCPU<sub>k</sub> = GCPU<sub>k</sub>/2 (old use decays), then P<sub>j</sub> = Base<sub>j</sub> + CPU<sub>j</sub>/2 + GCPU<sub>k</sub>/(4 × W<sub>k</sub>), with whole-number division. CPU<sub>j</sub> counts process j’s recent clock ticks (60 a second) and GCPU<sub>k</sub> its group’s; the lowest P runs.</p>${/* notes paragraph: groups, weights, the once-a-second halving and the priority formula */''}
      <p>Example: A alone in group 1, B and C in group 2, both weights 0.5, base 60. ${(() => { const o = { procs: [{ g: 0 }, { g: 1 }, { g: 1 }], w10: [5, 5], base: 60, ticks: 60, secs: 12 }, f = fairShare({ ...o, group: true }), pp = fairShare({ ...o, group: false }); return `Priorities (A/B/C) at seconds 0 to 3: ${f.rows.slice(0, 4).map((r) => r.P.join('/')).join(', ')}. The processor goes to ${f.rows.map((r) => 'ABC'[r.run]).join(', ')}, ..., so A gets ${Math.round(f.share[0] * 100)}% and B and C ${Math.round(f.share[1] * 100)}% each: each group gets half, whatever the number of processes in it. Without the group term (P = Base + CPU/2) the order becomes ${pp.rows.slice(0, 6).map((r) => 'ABC'[r.run]).join(', ')}, ..., and the shares become ${pp.share.map((x, j) => 'ABC'[j] + ' ' + Math.round(x * 100) + '%').join(', ')}`; })()}. Because the processor is handed out a whole second at a time, other weights are matched only approximately.</p>`,  // notes paragraph: a fair-share example run by the engine with and without the group term; the closing backtick ends the notes
  });  // ends the object passed to Guide.section, which registers the section
})();  // ends and immediately runs the function that wraps the whole file
