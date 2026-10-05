// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.4 Deadlock Detection
   Original teaching material. Shared helpers live inside this IIFE (no globals).
   Every number a student reads (marks, W, verdicts, costs) comes from these helpers.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  const add = (a, b) => a.map((x, j) => x + b[j]);  // add(a, b): adds two vectors position by position, e.g. W plus the units a finished process hands back
  const fits = (q, w) => q.every((x, j) => x <= w[j]);  // fits(q, w): true when every number in request q is at most the matching number in w, so the request could be granted
  const isZero = (r) => r.every((x) => x === 0);  // isZero(r): true when a row is all zeros, e.g. a process that holds no units at all
  const colSum = (M) => M[0].map((_, j) => M.reduce((s, r) => s + r[j], 0));  // colSum(M): adds each column of a matrix, giving how many units of each resource type are held in total
  const sub = (a, b) => a.map((x, j) => x - b[j]);  // sub(a, b): subtracts vectors position by position, e.g. total units minus held units gives the free units V
  const vec = (v) => '(' + v.join(', ') + ')';  // vec(v): writes a vector the way the notes print it, e.g. [1, 0, 2] becomes "(1, 0, 2)"
  const RES = (m) => Array.from({ length: m }, (_, j) => 'R' + (j + 1));  // RES(m): makes the resource-type names R1, R2 ... Rm used as column headings

  /* detect(A, Q, V, o): the detection algorithm, recording every move it makes.
     o.zeroRule === false skips step 1 (used for the banker's safety test, which has no such step). */
  function detect(A, Q, V, o = {}) {  // detect(A, Q, V, o): A = units held, Q = units requested, V = units free; returns the deadlocked processes and a log
    const n = A.length, marked = Array(n).fill(false), events = [], order = [], zero = [];  // n counts processes; marked starts all false; events logs every move for the animation; order and zero record marks
    if (o.zeroRule !== false) {  // step 1 runs unless the caller turns it off with zeroRule false (the banker's safety test has no such step)
      A.forEach((r, i) => { if (isZero(r)) { marked[i] = true; zero.push(i); } });  // step 1: any process whose row of A is all zeros holds nothing, so it cannot be part of a deadlock and is marked
      events.push({ t: 'zero', list: zero.slice(), W: null, marked: marked.slice() });  // logs step 1 with copies (slice) of the lists, so later changes do not alter what this frame shows
    }  // ends step 1
    let W = V.slice();  // step 2: W, the work vector, starts as a copy of the free units V
    events.push({ t: 'init', W: W.slice(), marked: marked.slice() });  // logs step 2 so the animation can show W being set
    for (;;) {  // the main loop repeats steps 3 and 4 until no unmarked process can be satisfied; for (;;) loops forever until a break
      let found = -1;  // found will hold the first process that passes the test in this round, or -1 if none does
      for (let i = 0; i < n; i++) {  // goes through the processes in order, P1 first
        if (marked[i]) continue;  // marked processes are already known to be safe, so they are skipped
        const ok = fits(Q[i], W);  // step 3: ok is true when everything this process is waiting for could be supplied from W
        events.push({ t: 'test', i, ok, bad: ok ? -1 : Q[i].findIndex((x, j) => x > W[j]), W: W.slice(), marked: marked.slice() });  // logs the test; bad is the first resource column that does not fit (or -1), so that cell can be drawn in red
        if (ok) { found = i; break; }  // the first process that fits is chosen, and the search stops for this round
      }  // ends the scan over the processes
      if (found < 0) { events.push({ t: 'none', W: W.slice(), marked: marked.slice() }); break; }  // when nothing fits, logs a final "none" event and leaves the main loop: the algorithm is finished
      const before = W.slice();  // keeps W as it was before the mark, so the notes can show the sum "before + held = after"
      marked[found] = true; order.push(found); W = add(W, A[found]);  // step 4: marks the process, records the order, and adds what it holds to W, as if it finished and gave everything back
      events.push({ t: 'mark', i: found, before, W: W.slice(), marked: marked.slice() });  // logs the mark with W before and after, for the animation and the notes
    }  // ends the main loop
    const dead = [];  // dead will list the processes still unmarked at the end
    marked.forEach((m, i) => { if (!m) dead.push(i); });  // every process left unmarked is deadlocked, so its number is added to dead
    return { events, order, zero, W, marked, dead };  // returns the full log and the results: order of marks, step 1 marks, final W, marked flags and the deadlocked list
  }  // ends detect

  const list = (arr) => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);  // list(arr): joins names in plain English, e.g. ["P1", "P2", "P3"] becomes "P1, P2 and P3"

  /* stuck(...): for each process left unmarked, the first resource it cannot get and which unmarked processes hold it.
     The missing units are never in W, so they must be held by unmarked processes (requests are capped at total - own). */
  function stuck(A, Q, W, dead, names, res) {  // stuck(...): explains each deadlocked process in words: what it waits for and who holds it
    return dead.map((i) => {  // builds one explanation for every deadlocked process
      const j = Q[i].findIndex((x, k) => x > W[k]);  // j is the first resource column where this process wants more than W can give
      const who = dead.filter((k) => k !== i && A[k][j] > 0).map((k) => names[k]);  // who lists the other deadlocked processes that hold at least one unit of that resource
      return { i, j, who, text: `${names[i]} waits for ${res[j]}` + (who.length ? `, held by ${list(who)}` : '') };  // returns the numbers plus a sentence such as "P1 waits for R2, held by P2"
    });  // ends the map over deadlocked processes
  }  // ends stuck

  /* The worked example used by the step-through and the request editor: 5 processes, 5 resource types.
     V is computed (total minus everything held), never typed. */
  const EX = {  // EX: the worked example used by the step-through and the request editor
    names: ['P1', 'P2', 'P3', 'P4', 'P5'],  // the five process names, one per row of each matrix
    res: RES(5),  // five resource types, named R1 to R5
    total: [1, 1, 2, 1, 2],  // total units that exist of each resource type
    A: [[1, 0, 1, 0, 0], [0, 1, 0, 0, 0], [0, 0, 0, 0, 1], [0, 0, 1, 1, 0], [0, 0, 0, 0, 0]],  // A, the allocation matrix: one row per process, how many units of each type it holds now
    Q: [[0, 1, 0, 0, 0], [1, 0, 0, 0, 1], [0, 0, 0, 1, 1], [0, 0, 0, 0, 0], [0, 0, 1, 0, 0]],  // Q, the request matrix: one row per process, how many units of each type it is still waiting for
  };  // closes the EX example
  EX.V = sub(EX.total, colSum(EX.A));  // V, the free units, is computed as total minus everything held, so it can never disagree with A

  /* matrixView(ctx, o): draws A, Q and the vectors for one display state st
     st = { marked, W, cur, test, add, fails, dead } ; o.qCell(i, j, cls) may supply an editable Q cell */
  function matrixView(ctx, o) {  // matrixView(ctx, o): builds the A, Q and vector tables for a step; o carries the data, the result redraws on demand
    const { h } = ctx;  // takes the HTML builder h from ctx (h(tag, settings, ...children) creates a page element)
    const { names, res } = o;  // the row names (processes) and column names (resource types) come from o
    const wrap = h('div', { class: 'stack', style: { gap: '8px' } });  // wrap is the outer box; draw() replaces its contents each time the display changes
    function draw(st) {  // draw(st): redraws everything for one display state st (which rows are marked, the current W, the row being tested ...)
      const rowCls = (i) => [st.marked[i] ? 'mk' : '', st.dead && st.dead.includes(i) ? 'dl' : '', st.cur === i ? 'cur' : ''].join(' ');  // rowCls(i): the CSS classes for row i: mk = marked (green), dl = deadlocked (red), cur = the row under test
      const zc = (x) => (x === 0 ? 'zero' : '');  // zc(x): gives zero cells the grey "zero" style so the non-zero numbers stand out
      const tA = mtable(ctx, { names, cols: res, rowCls, cell: (i, j) => ({ text: o.A[i][j], cls: st.add === i && o.A[i][j] > 0 ? 'add' : zc(o.A[i][j]) }) });  // tA: the A table; when a process is marked, its non-zero held cells get the "add" colour because they flow into W
      const tQ = mtable(ctx, { names, cols: res, rowCls, cell: (i, j) => {  // tQ: the Q table, whose cell colours depend on the test in progress
        const q = o.Q[i][j];  // q is this process's request for this resource type
        let cls = zc(q);  // default style: grey if zero
        if (st.cur === i && st.W && st.test) cls = q > st.W[j] ? 'fail' : q > 0 ? 'pass' : 'zero';  // while row i is being tested, each cell goes red if it asks for more than W has, green if it fits, grey if zero
        if (st.fails && st.fails[i] === j) cls = 'fail';  // fails marks a recorded failing cell for each process, so the reason a row is stuck stays visible in red
        return o.qCell ? { node: o.qCell(i, j), cls: cls === 'fail' ? 'fail' : '' } : { text: q, cls };  // in the request editor qCell supplies a clickable cell instead of plain text, keeping only the red failure style
      } });  // ends the Q cell function and the tQ table call
      const vrows = [['Total', o.total], ['V (free)', o.V], ['W', st.W]];  // the three vector rows: total units, V (free now) and W (the algorithm's work vector)
      const tV = h('table', { class: 'tbl compact mx' }, h('thead', {}, h('tr', {}, h('th', {}), ...res.map((r) => h('th', {}, r)))),  // tV: the vector table, starting with a header row of resource names
        h('tbody', {}, ...vrows.map(([lab, v], k) => h('tr', { class: k === 2 && st.W ? 'cur' : '' }, h('th', { class: 'rn' }, lab),  // one table row per vector; the W row gets the "cur" outline whenever W exists
          ...res.map((_, j) => {  // one cell per resource type
            if (!v) return h('td', { class: 'zero' }, '–');  // before step 2 there is no W yet, so its row shows dashes
            let cls = '';  // cls will hold the colour style for this cell
            if (k === 2 && st.cur != null && st.test) cls = o.Q[st.cur][j] > v[j] ? 'fail' : '';  // while a row is tested, a W cell goes red where the request asks for more than W holds
            if (k === 2 && st.add != null && o.A[st.add][j] > 0) cls = 'add';  // when a process is marked, the W cells that grow get the "add" colour
            return h('td', { class: cls }, String(v[j]));  // the cell shows the number as text
          })))));  // closes the cell map, the row map, the table body and the tV table
      wrap.replaceChildren(  // replaces whatever was drawn before with the new layout
        h('div', { class: 'grid-2', style: { gap: '14px' } },  // first row of the layout: two columns side by side
          h('div', {}, h('div', { class: 'mxcap' }, 'A · allocation: units held'), tA),  // left column: caption and the A table
          h('div', {}, h('div', { class: 'mxcap' }, 'Q · requests: units waited for'), tQ)),  // right column: caption and the Q table
        h('div', { class: 'grid-2', style: { gap: '14px', alignItems: 'start' } },  // second row of the layout: two columns lined up at the top
          h('div', {}, h('div', { class: 'mxcap' }, 'Vectors'), tV),  // left: caption and the vector table
          o.side ? o.side(st) : h('div')));  // right: an optional side panel supplied by the step, or an empty box; this also closes the whole layout
    }  // ends draw
    return { el: wrap, draw };  // hands back the outer box (to place on the page) and draw (to call whenever the state changes)
  }  // ends matrixView

  /* mtable(ctx, o): one matrix as a compact table; o.cell(i, j) returns { text, cls } */
  function mtable(ctx, o) {  // mtable(ctx, o): builds one matrix (A or Q) as a small table with a header row and one row per process
    const { h } = ctx;  // takes the HTML builder h from ctx
    const head = h('tr', {}, h('th', { html: o.corner || '' }), ...o.cols.map((c) => h('th', {}, c)));  // header row: an optional top-left corner label, then one heading per column (the resource names)
    const rows = o.names.map((nm, i) => h('tr', { class: o.rowCls ? o.rowCls(i) : '' },  // one table row per process, with the row classes (marked, deadlocked, under test) when a rowCls function is given
      h('th', { class: 'rn' }, nm),  // the first cell of each row is the process name, styled as a row heading
      ...o.cols.map((_, j) => { const c = o.cell(i, j); return h('td', { class: c.cls || '' }, c.node || String(c.text)); })));  // then one cell per column: o.cell supplies its text (or a ready-made element) and its colour class
    return h('table', { class: 'tbl compact mx' + (o.cls ? ' ' + o.cls : '') }, h('thead', {}, head), h('tbody', {}, ...rows));  // puts the header and the rows together into a compact table with the shared matrix style, plus any extra class
  }  // ends mtable


  /* The recovery lab: four deadlocked processes, five resource types. P1 and P2 wait for each other;
     P4 waits for P2 and P3 waits for P4, so all four are stuck. Costs are per process. */
  const LAB = {  // LAB: the recovery lab's data, four deadlocked processes with their holdings and the costs used to pick victims
    names: ['P1', 'P2', 'P3', 'P4'],  // the four process names
    res: RES(5),  // five resource types, R1 to R5
    total: [1, 1, 2, 2, 4],  // total units of each resource type
    A: [[1, 0, 0, 0, 2], [0, 1, 2, 0, 1], [0, 0, 0, 0, 1], [0, 0, 0, 2, 0]],  // A: what each process holds right now
    Q: [[0, 1, 0, 0, 0], [1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [0, 0, 1, 0, 0]],  // Q: what each process is waiting for; each request is held by another process, which is what makes the deadlock
    cpu: [40, 75, 30, 10],  // cpu: processor time each process has used so far, in seconds (lost if it is aborted)
    out: [300, 40, 80, 500],  // out: lines of output each process has written so far (also lost if it is aborted)
    left: [70, 5, 30, 50],  // left: estimated seconds each process still needs to finish
    prio: [6, 2, 1, 5],  // prio: each process's priority, where a higher number means more important
    ckpt: [12, 20, 4, 6],  // ckpt: seconds of work done since each process's last checkpoint, which a rollback throws away
    ckOut: [50, 10, 20, 100],  // ckOut: lines of output written since the last checkpoint, also lost on rollback
  };  // closes the LAB data
  LAB.held = LAB.A.map((r) => r.reduce((a, b) => a + b, 0));  // held: total units each process holds, the sum of its row of A, used by the "fewest held" criterion
  const CRIT = {  // CRIT: the five victim-selection criteria; key names the LAB field to compare, best says whether lowest or highest wins
    cpu: { label: 'Least CPU', key: 'cpu', best: 'min', long: 'Least processor time used so far', rule: 'Pick the process that has run for the shortest time.', why: 'Aborting it throws away the least computation. Easy to measure: the OS already accounts processor time for every process.' },  // criterion: least processor time used, with its rule and why it makes sense (cheap to measure)
    out: { label: 'Least output', key: 'out', best: 'min', long: 'Least output produced so far', rule: 'Pick the process that has written the least.', why: 'Less finished work to discard or redo. Fairly easy to count: lines, pages or records written.' },  // criterion: least output produced, with its rule and the reason (less finished work to redo)
    left: { label: 'Most time left', key: 'left', best: 'max', long: 'Most estimated time remaining', rule: 'Pick the process furthest from finishing.', why: 'Spares processes that are almost done. Hard to measure: the OS can only estimate how long a process still needs.' },  // criterion: most time left, the only one where the highest value wins; hard to measure because it is an estimate
    held: { label: 'Fewest held', key: 'held', best: 'min', long: 'Fewest resources held', rule: 'Pick the process holding the fewest units.', why: 'Least invested in acquiring resources. Easy to count, but freeing very little may not break the cycle at all.' },  // criterion: fewest units held, with the caveat that freeing little may not break the cycle
    prio: { label: 'Lowest priority', key: 'prio', best: 'min', long: 'Lowest priority', rule: 'Pick the least important process (higher number = more important).', why: 'Sacrifices the work that matters least. Easy if priorities exist, though it ignores how much work is lost.' },  // criterion: lowest priority, with the caveat that it ignores how much work is lost
  };  // closes the CRIT table
  /* labState / labAnalyse / labPick / labAbort: the recovery simulation. Detection always re-runs on the processes still present. */
  const labState = () => ({ gone: [false, false, false, false], rolled: false, victims: [], lostCpu: 0, lostOut: 0, dead: [0, 1, 2, 3], done: false, V: sub(LAB.total, colSum(LAB.A)) });  // labState(): a fresh lab: nobody removed or rolled back, nothing lost yet, all four deadlocked, V computed from A
  function labAnalyse(st) {  // labAnalyse(st): re-runs the detection algorithm on the processes still in the system and reports V and who is deadlocked
    const idx = LAB.names.map((_, i) => i).filter((i) => !st.gone[i]);  // idx lists the numbers of the processes not yet aborted
    const V = LAB.total.map((t, j) => t - idx.reduce((sum, i) => sum + LAB.A[i][j], 0));  // V: free units = total minus what the remaining processes hold (an aborted process's units return to the pool)
    if (!idx.length) return { V, dead: [] };  // if every process is gone, nothing can be deadlocked
    const run = detect(idx.map((i) => LAB.A[i]), idx.map((i) => LAB.Q[i]), V);  // runs the real detect() on just the remaining rows of A and Q
    return { V, dead: run.dead.map((k) => idx[k]) };  // detect numbers the remaining processes 0, 1, 2 ..., so idx turns those back into the original process numbers
  }  // ends labAnalyse
  function labPick(st, crit) {  // labPick(st, crit): chooses the next victim among the deadlocked processes by the chosen criterion
    const c = CRIT[crit], vals = LAB[c.key];  // c is the criterion; vals is its LAB list, e.g. the CPU time of each process
    return st.dead.reduce((b, i) => (b < 0 || (c.best === 'min' ? vals[i] < vals[b] : vals[i] > vals[b]) ? i : b), -1);  // walks the deadlocked list keeping the best so far: the smallest value, or the largest for "most time left"
  }  // ends labPick
  function labAbort(st, list0) {  // labAbort(st, list0): aborts the processes in list0 and works out what happens next
    const before = st.dead.slice();  // remembers who was deadlocked before the aborts
    list0.forEach((i) => { st.gone[i] = true; st.victims.push(i); st.lostCpu += LAB.cpu[i]; st.lostOut += LAB.out[i]; });  // each victim is removed, recorded, and its CPU time and output are added to the losses
    const r = labAnalyse(st);  // re-runs detection on the processes that remain
    st.V = r.V; st.dead = r.dead; st.done = !r.dead.length;  // stores the new free units and deadlocked list; the lab is done when nobody is deadlocked any more
    return { freed: before.filter((i) => !list0.includes(i) && !r.dead.includes(i)) };  // reports which processes were freed: deadlocked before, not aborted, and no longer deadlocked
  }  // ends labAbort
  function labRollback(st) {  // labRollback(st): rolls every deadlocked process back to its last checkpoint
    st.rolled = true; st.victims = st.dead.slice();  // marks the run as a rollback; all the deadlocked processes become victims
    st.lostCpu = st.dead.reduce((a, i) => a + LAB.ckpt[i], 0); st.lostOut = st.dead.reduce((a, i) => a + LAB.ckOut[i], 0);  // the losses are only the work done since each checkpoint, not everything the process ever did
    st.dead = []; st.done = true;  // after the rollback nobody is deadlocked, so the lab is done
  }  // ends labRollback
  /* labRun(strategy, crit): a whole recovery run without animation, for the comparison table */
  function labRun(strategy, crit) {  // labRun(strategy, crit): runs a whole recovery in one go for the comparison table
    const st = labState();  // starts from a fresh lab
    if (strategy === 'all') labAbort(st, st.dead.slice());  // strategy "all": aborts every deadlocked process at once
    else if (strategy === 'roll') labRollback(st);  // strategy "roll": rolls all of them back to their checkpoints
    else while (!st.done) labAbort(st, [labPick(st, crit)]);  // otherwise: aborts one victim at a time, chosen by crit, until the deadlock is gone
    return st;  // returns the final state, with victims and losses
  }  // ends labRun

  /* Quiz states: the numbers in the questions come from running the same detect() used by the steps. */
  const QZ = { names: ['P1', 'P2', 'P3', 'P4'], res: RES(3), A: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0]], Q: [[0, 1, 0], [1, 0, 0], [0, 0, 0], [0, 0, 2]], V: [0, 0, 1] };  // QZ: a small four-process, three-resource state used by the quiz; its answer is computed, not typed
  QZ.run = detect(QZ.A, QZ.Q, QZ.V);  // runs the real detection algorithm on it, so the quiz answer always matches the algorithm
  QZ.code = ['      A = held     Q = requested', '      R1 R2 R3     R1 R2 R3']  // QZ.code: the state printed as aligned text for the quiz; these are its two heading lines
    .concat(QZ.names.map((nm, i) => `  ${nm}  ${QZ.A[i].map((x) => String(x).padStart(2)).join(' ')}     ${QZ.Q[i].map((x) => String(x).padStart(2)).join(' ')}`))  // one line per process: its row of A, then its row of Q, each number padded to two characters so columns line up
    .concat([`  Available V = ${vec(QZ.V)}`]).join('\n');  // a last line with the available vector V; join puts a line break between all the lines
  const OVH = { costMs: 5, everyS: 2 };  // OVH: numbers for the overhead quiz question: one detection run costs 5 ms and runs every 2 seconds
  OVH.pct = +((OVH.costMs / (OVH.everyS * 1000)) * 100).toFixed(4);  // pct: the share of processor time spent on detection, as a percentage rounded to 4 decimal places

  /* Helpers for the study notes, so every table and number in them comes from the same data and code as the steps. */
  const nTable = (head, rows) => '<table><tr>' + head.map((x) => `<th>${x}</th>`).join('') + '</tr>' + rows.map((r) => '<tr>' + r.map((x) => `<td>${x}</td>`).join('') + '</tr>').join('') + '</table>';  // nTable(head, rows): writes a plain HTML table as text for the study notes
  function nState(names, res, A, Q) {  // nState(...): a notes table of a state: one row per process with its A columns and then its Q columns
    return nTable(['', ...res.map((r) => 'A ' + r), ...res.map((r) => 'Q ' + r)], names.map((nm, i) => [nm, ...A[i], ...Q[i]]));  // builds the headings "A R1", "A R2" ... then "Q R1" ..., and one row per process
  }  // ends nState
  function nTrace(names, res, A, Q, V) {  // nTrace(...): writes a numbered, step-by-step trace of the detection algorithm for the notes
    const run = detect(A, Q, V), items = [];  // runs the real algorithm; items collects one sentence per numbered step
    let fails = [];  // fails gathers the processes that did not fit in the current round, to mention them together
    const nf = () => `${list(fails)} ${fails.length > 1 ? 'do' : 'does'} not fit`;  // nf(): a phrase such as "P1 (needs R2) and P3 (needs R4) do not fit", with "does" for a single process
    run.events.forEach((e) => {  // goes through the algorithm's log, event by event
      if (e.t === 'zero') items.push(`Step 1: ${e.list.length ? `mark ${list(e.list.map((i) => names[i]))} (row of A all zeros)` : 'no row of A is all zeros'}.`);  // step 1 event: names the processes marked for holding nothing, or says no row of A is all zeros
      else if (e.t === 'init') items.push(`Step 2: W = V = ${vec(e.W)}.`);  // step 2 event: shows W starting equal to V
      else if (e.t === 'test' && !e.ok) fails.push(`${names[e.i]} (needs ${res[e.bad]})`);  // a failed test is not printed alone; it is saved in fails for the next sentence
      else if (e.t === 'test') { items.push(`Step 3: ${fails.length ? nf() + '; ' : ''}${names[e.i]} ${isZero(Q[e.i]) ? 'asks for nothing' : 'asks for ' + vec(Q[e.i])} and fits.`); fails = []; }  // a passing test: mentions the failures before it, then names the process that fits and what it asks for
      else if (e.t === 'mark') items.push(`Step 4: mark ${names[e.i]}; W = ${vec(e.before)} + ${vec(A[e.i])} = ${vec(e.W)}.`);  // a mark event: shows the step 4 sum, W before plus what the process held equals the new W
      else { items.push(`Step 3: ${nf()}, so the algorithm stops.`); fails = []; }  // the final "none" event: lists the processes that do not fit and says the algorithm stops
    });  // ends the walk through the log
    return '<ol>' + items.map((x) => `<li>${x}</li>`).join('') + `</ol><p>Result: ${run.dead.length ? `${list(run.dead.map((i) => names[i]))} ${run.dead.length > 1 ? 'are' : 'is'} unmarked, so deadlocked (${stuck(A, Q, run.W, run.dead, names, res).map((x) => x.text).join('; ')}).` : 'every process is marked, so there is no deadlock.'}</p>`;  // returns the numbered list and a result line: who is deadlocked and why (from stuck), or that there is no deadlock
  }  // ends nTrace

  /* The detection-versus-banker example: unsafe for the banker's test, yet not deadlocked. */
  const CMP = { names: ['P1', 'P2', 'P3'], res: RES(3), total: [4, 2, 2], A: [[2, 0, 1], [1, 1, 0], [0, 1, 1]], C: [[3, 1, 1], [2, 2, 1], [3, 2, 1]], Qnow: [[0, 0, 0], [0, 0, 1], [2, 0, 0]] };  // CMP: the comparison example; C is the claim matrix (most each process may ever ask for), Qnow what each waits for now
  CMP.V = sub(CMP.total, colSum(CMP.A));  // V: free units = total minus everything held
  CMP.need = CMP.C.map((r, i) => sub(r, CMP.A[i]));  // need: what each process might still ask for, its claim minus what it holds; the banker's test uses this instead of Q
  Guide.section({  // registers this section with the guide shell; everything below is one big settings object
    id: '6.4',  // the section number, used in links, saved progress and the CSS class sec-6-4
    title: 'Deadlock Detection',  // the section title shown in headings and the contents list
    short: 'Detection',  // a shorter name used in lists of sections where the full title might not fit on one line
    summary: 'Grant every request you can, look for deadlocked processes now and then, and break any deadlock you find.',  // one-sentence summary shown next to the title in the chapter's list of sections
    objectives: [  // learning objectives, listed at the start of the section
      'Explain how deadlock detection differs from prevention and avoidance, and weigh how often to run it.',  // objective 1: compare detection with prevention and avoidance, and judge how often to run it
      'Run the detection algorithm by hand on an allocation matrix, a request matrix and an available vector, and name the deadlocked processes.',  // objective 2: run the detection algorithm by hand on A, Q and V
      'Explain how the detection algorithm differs from the banker\'s safety test, and why it is called optimistic.',  // objective 3: contrast detection with the banker's safety test and explain "optimistic"
      'Find a deadlock with a wait-for graph when every resource type has a single unit.',  // objective 4: use a wait-for graph when every resource has one unit
      'Compare the four recovery strategies and choose a victim using the standard criteria.',  // objective 5: compare the recovery strategies and pick a victim
    ],  // closes the objectives list
    terms: [  // glossary terms for this section: each entry is [term, definition]; they feed the glossary panel
      ['Deadlock detection', 'An approach to deadlock in which the operating system grants every request it can, runs an algorithm from time to time to find deadlocked processes, and then recovers.'],  // glossary entry: defines deadlock detection as grant first, check later, then recover
      ['Detection algorithm', 'The procedure that looks at who holds what and who is waiting for what, marks every process it can show is not deadlocked, and reports the processes left unmarked as deadlocked.'],  // glossary entry: the detection algorithm, which marks the processes it can clear and reports the rest
      ['Allocation matrix (A)', 'A table with one row per process and one column per resource type. Entry A[i][j] is how many units of resource j process i holds right now.'],  // glossary entry: the allocation matrix A, units held per process and resource type
      ['Request matrix (Q)', 'A table with one row per process and one column per resource type. Entry Q[i][j] is how many units of resource j process i has asked for and is still waiting to receive.'],  // glossary entry: the request matrix Q, units still waited for per process and resource type
      ['Available vector (V)', 'One number per resource type: how many units of that resource are free right now, held by no process.'],  // glossary entry: the available vector V, the free units of each resource type
      ['Work vector (W)', 'A scratch copy of the available vector that the detection algorithm grows as it pretends that marked processes finish and hand back what they hold.'],  // glossary entry: the work vector W, the scratch copy of V that grows as processes are marked
      ['Marked process', 'A process the detection algorithm has shown is not deadlocked: it holds nothing, or everything it is waiting for could be supplied.'],  // glossary entry: a marked process, one shown not to be deadlocked
      ['Wait-for graph', 'A graph with one node per process and an arrow from Pi to Pj whenever Pi is waiting for a resource that Pj holds. When every resource type has one unit, a cycle in it means deadlock.'],  // glossary entry: the wait-for graph, arrows from a waiting process to the holder
      ['Circular wait', 'A closed chain of processes in which each one holds a resource that the next one in the chain is waiting for.'],  // glossary entry: circular wait, the closed chain of holding and waiting
      ['Resource allocation graph', 'A drawing of processes (circles) and resource types (boxes with one dot per unit), with an arrow for every request and for every unit held.'],  // glossary entry: the resource allocation graph with circles, boxes and unit dots
      ['Deadlock recovery', 'What the operating system does after it finds a deadlock: abort processes, roll them back, or take resources away until the circular wait is broken.'],  // glossary entry: deadlock recovery, the ways the OS breaks a deadlock once found
      ['Checkpoint', 'A saved copy of a process\'s state at one moment, so the process can later be restarted from that point instead of from the beginning.'],  // glossary entry: a checkpoint, a saved state a process can restart from
      ['Rollback', 'Returning a process to an earlier checkpoint: everything it did after that point is thrown away and it starts again from there.'],  // glossary entry: rollback, restarting a process from an earlier checkpoint
      ['Victim', 'The process chosen to be aborted, rolled back, or stripped of a resource so that a deadlock can be broken.'],  // glossary entry: the victim, the process sacrificed to break a deadlock
      ['Resource preemption', 'Taking a resource away from the process holding it before that process has finished with it.'],  // glossary entry: resource preemption, taking a resource away before the holder is done
      ['Deadlock prevention', 'Designing the system so that one of the conditions for deadlock can never hold, which makes deadlock impossible.'],  // glossary entry: deadlock prevention, ruling out one of the deadlock conditions by design
      ['Deadlock avoidance', 'Deciding at each request, from the current state and each process\'s declared maximum needs, whether granting it could lead to deadlock, and making the process wait if it could.'],  // glossary entry: deadlock avoidance, judging each request against declared maximum needs
      ['Banker\'s algorithm', 'The classic avoidance method: grant a request only if the state afterwards is still safe, judged against each process\'s maximum claim.'],  // glossary entry: the banker's algorithm, grant only if the result is still a safe state
      ['Claim matrix (C)', 'In deadlock avoidance, the table of the largest number of units of each resource type that each process may ever ask for.'],  // glossary entry: the claim matrix C, the most each process may ever request
    ],  // closes the glossary terms
    css: ` /* css: style rules for this section only; every selector starts with .sec-6-4 so other sections are not affected */
      .sec-6-4 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; } /* .narr: the explanation box that describes what just happened, with a coloured bar on its left edge */
      .sec-6-4 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* .narr.bad: red version of the box, used when a deadlock is reported */
      .sec-6-4 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* .narr.ok: green version, used when the outcome is safe or the deadlock is gone */
      .sec-6-4 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* .narr.warn: an amber version, kept for cautionary messages (no step in this section uses it right now) */
      .sec-6-4 table.mx { border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; } /* table.mx: the matrix tables; tabular-nums gives every digit the same width so columns line up */
      .sec-6-4 table.mx th, .sec-6-4 table.mx td { padding: 3px 7px; text-align: center; font-size: 15px; } /* matrix cells are small and centred so a 5 x 5 table fits beside another one */
      .sec-6-4 table.mx td { font-family: var(--mono); font-weight: 700; min-width: 30px; } /* number cells use the fixed-width code font in bold, with a minimum width so single digits do not look cramped */
      .sec-6-4 table.mx th.rn { text-align: left; } /* the process-name cells at the start of each row line up on the left */
      .sec-6-4 table.mx td.zero { color: var(--muted); font-weight: 500; } /* zero cells are grey and lighter, so the non-zero numbers stand out */
      .sec-6-4 table.mx td.pass { background: var(--ok-bg); color: var(--ok); } /* .pass: a green cell, a request that fits in W */
      .sec-6-4 table.mx td.fail { background: var(--bad-bg); color: var(--bad); outline: 2px solid var(--bad); outline-offset: -2px; } /* .fail: a red, outlined cell, the request that does not fit and blocks this process */
      .sec-6-4 table.mx td.add { background: var(--mem-bg); color: var(--mem); } /* .add: a cell coloured like memory, showing units that flow from a marked process into W */
      .sec-6-4 table.mx tr.mk th.rn, .sec-6-4 table.mx tr.mk td { background: var(--ok-bg); } /* a marked row (mk) gets a green background */
      .sec-6-4 table.mx tr.dl th.rn, .sec-6-4 table.mx tr.dl td { background: var(--bad-bg); } /* a deadlocked row (dl) gets a red background */
      .sec-6-4 table.mx tr.cur th.rn, .sec-6-4 table.mx tr.cur td { box-shadow: inset 0 2px 0 var(--accent), inset 0 -2px 0 var(--accent); } /* the row being tested (cur) gets a coloured line above and below it, drawn inside the cells */
      .sec-6-4 .mxcap { font-size: 13px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin: 0 0 3px; } /* .mxcap: the small capital-letter caption above each table, such as "A · allocation" */
      .sec-6-4 .algo { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0 !important; list-style: none; } /* .algo: the numbered list of algorithm steps, as a column of boxes without bullets */
      .sec-6-4 .algo li { border: 1px solid var(--line); border-left: 5px solid var(--line-2); border-radius: 10px; padding: 5px 10px; background: var(--panel); margin: 0; font-size: 15.5px; line-height: 1.4; } /* each step box has a thicker left edge and a white panel background */
      .sec-6-4 .algo li.on { border-color: var(--accent); border-left-color: var(--accent); background: var(--accent-bg); } /* the step being carried out right now (on) is highlighted in the accent colour */
      .sec-6-4 .algo .sn { font-weight: 900; color: var(--chc); margin-right: 6px; } /* .sn: the bold step number at the start of each box */
      .sec-6-4 .algo .wy { display: block; font-size: 13.5px; color: var(--ink-2); line-height: 1.35; margin-top: 2px; } /* .wy: a smaller grey line under each step explaining why the step is there */
      .sec-6-4 .tile { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; min-width: 0; } /* .tile: a small panel showing one number with a label, used for the counters */
      .sec-6-4 .tile .v { font-size: 28px; font-weight: 900; line-height: 1.1; font-variant-numeric: tabular-nums; } /* the tile's big number */
      .sec-6-4 .tile .k { font-size: 13px; font-weight: 700; color: var(--muted); } /* the tile's small grey label */
      .sec-6-4 .qb { font: inherit; font-family: var(--mono); font-weight: 800; font-size: 15px; width: 34px; height: 26px; border-radius: 7px; border: 1px solid var(--line-2); background: var(--panel); color: var(--ink); cursor: pointer; padding: 0; } /* .qb: the small clickable number buttons in the request editor, one per Q cell */
      .sec-6-4 .qb:hover { border-color: var(--accent); color: var(--accent); } /* a button's border and number take the accent colour when the pointer is over it */
      .sec-6-4 .qb.chg { background: var(--hl); } /* .chg: a highlighted button, a value the student has changed from the original */
      .sec-6-4 .qb:disabled { opacity: .35; cursor: default; } /* a disabled button (a resource with no units to ask for) is faded and does not show a pointer */
      .sec-6-4 .grid-2 > *, .sec-6-4 .mw0 > * { min-width: 0; } /* lets the items of these two-column grids shrink, so wide tables do not push the layout past the screen edge */
      .sec-6-4 .pc { border: 2px solid var(--proc); background: var(--proc-bg); border-radius: 12px; padding: 7px 9px; display: flex; flex-direction: column; gap: 5px; min-width: 0; } /* .pc: a process card in the recovery lab, with a process-coloured border, stacking its contents */
      .sec-6-4 .pc.dl { border-color: var(--bad); background: var(--bad-bg); } /* a deadlocked process card turns red */
      .sec-6-4 .pc.gone { border-color: var(--line); background: var(--panel-2); opacity: .62; } /* an aborted process card is greyed out and faded */
      .sec-6-4 .pc .btn { width: 100%; } /* the button inside a process card spans the card's full width */
      .sec-6-4 table.pst { width: 100%; border-collapse: collapse; font-size: 13px; } /* table.pst: the small table of a process's numbers inside its card */
      .sec-6-4 table.pst td { padding: 1px 3px; white-space: nowrap; } /* its cells are tight and never wrap */
      .sec-6-4 table.pst td:last-child { text-align: right; font-family: var(--mono); font-weight: 700; white-space: nowrap; } /* the last column (the values) is right-aligned in the bold code font */
      .sec-6-4 table.pst tr.on td { background: var(--hl); } /* the row for the criterion in use (on) is highlighted */
      .sec-6-4 table.cmp th, .sec-6-4 table.cmp td { font-size: 13px; padding: 4px 7px; white-space: nowrap; } /* table.cmp: the strategy comparison table, small type and no wrapping */
      .sec-6-4 table.cmp td:nth-child(2) { white-space: normal; } /* except the second column (the victims), which may wrap */
      .sec-6-4 .cmp-tables { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(0, .8fr); gap: 12px; } /* .cmp-tables: four matrix tables side by side plus a slightly smaller fifth column, in the detection-versus-banker step */
      .sec-6-4 .cmp-tables table.mx th, .sec-6-4 .cmp-tables table.mx td { padding: 1px 6px; font-size: 14px; } /* the tables in that row use tighter padding and smaller type so all of them fit */
      .sec-6-4 .appr { border: 1px solid var(--line); border-radius: 10px; padding: 5px 9px; background: var(--panel); font-size: 13.5px; line-height: 1.3; } /* .appr: the three small boxes naming the approaches (prevention, avoidance, detection) */
      .sec-6-4 .appr b { display: block; font-size: 14.5px; } /* the approach name is bold on its own line */
      .sec-6-4 .appr span { color: var(--ink-2); } /* the short description under it is a softer grey */
      .sec-6-4 .appr.on { border-color: var(--accent); background: var(--accent-bg); } /* the box for this section's approach (on) is highlighted in the accent colour */
      .sec-6-4 .appr.on b { color: var(--accent); } /* and its name takes the accent colour too */
    `,  // end of the CSS text
    steps: [  // steps: the slides of this section, in order
      {  // step 1 begins
        title: 'Say yes now, look for trouble later',  // step 1 title: detection grants requests first and checks later
        kind: 'story',  // kind "story" puts the label "Big Picture" above the title
        html: `${/* html: the fixed page structure of step 1; render() below fills in the empty boxes */''}
          <div class="split fill" style="grid-template-columns:minmax(0,10fr) minmax(0,11fr)">${/* two-column layout, the right column slightly wider */''}
            <div class="stack" style="gap:10px">${/* left column: the explanation, stacked with small gaps */''}
              <p class="lead m0">Prevention and avoidance pay a price all the time so that deadlock can never happen. <span class="t">Deadlock detection</span> makes the opposite bet.</p>${/* opening paragraph: detection is the opposite bet to prevention and avoidance */''}
              <p class="m0">The operating system puts <b>no limits</b> on what processes may request or hold. If the units a process asks for are free, it gets them at once; if not, it waits, as usual. Every so often the OS runs a <span class="t">detection algorithm</span> over the current state to see whether some group of processes is stuck in a <span class="t">circular wait</span>. If one is, the OS breaks it: that is <span class="t">deadlock recovery</span>.</p>${/* paragraph: how detection works: no limits, grant if free, check from time to time, recover if stuck */''}
              <div class="callout analogy m0" data-label="Analogy">A library lends books freely. Each night a librarian scans the hold list: Ana waits for a book Ben has out, Ben waits for one Ana has out, and each keeps their own book until they get the other. Nobody will ever move, so the librarian steps in.</div>${/* analogy box: a librarian finding two borrowers each waiting for the other's book */''}
              <div class="callout why m0" data-label="Why it matters">Deadlocks are rare in many systems. Paying only when one really happens can cost far less than slowing down every request.</div>${/* "why it matters" box: deadlocks are rare, so paying only when one happens can be cheaper */''}
              <div class="row gap-s"><span class="chip os">run the algorithm</span><span class="chip proc">edit a request</span><span class="chip intr">find cycles</span><span class="chip warn">choose victims</span></div>${/* four coloured chips previewing what the student will do in this section */''}
            </div>${/* ends the left column */''}
            <div class="card stack" style="gap:8px">${/* right column: a card holding the loop diagram */''}
              <h4 class="m0">The detect-and-recover loop</h4>${/* card heading: the detect-and-recover loop */''}
              <p class="small muted m0">Click each stage of the loop.</p>${/* hint under the card heading: the stages of the loop are clickable */''}
              <div class="card white tight loop-box"></div>${/* empty box where render() below draws the loop diagram */''}
              <div class="card white tight loop-detail" style="min-height:112px"></div>${/* empty box where the explanation of the clicked stage appears; its minimum height stops the card from jumping */''}
              <div class="grid-3" style="gap:8px">${/* a row of three small boxes comparing the three approaches to deadlock */''}
                <div class="appr"><b>Prevention</b><span>in advance: rule a condition out</span></div>${/* approach box: prevention, which acts in advance */''}
                <div class="appr"><b>Avoidance</b><span>at each request: refuse risky ones</span></div>${/* approach box: avoidance, which judges each request */''}
                <div class="appr on"><b>Detection</b><span>afterwards: find and repair</span></div>${/* approach box: detection, highlighted (on) because it is this section's topic */''}
              </div>${/* ends the row of approach boxes */''}
            </div>${/* ends the right-hand card */''}
          </div>`,  // ends the two-column layout and the html text of step 1
        render(el, ctx) {  // render(el, ctx): runs when step 1 is shown; el is the step's box and ctx the shell's toolbox
          const { h, s } = ctx;  // takes the builders: h makes page elements, s makes SVG (the browser's drawing format) elements
          const stages = [  // stages: the three stages of the loop, with position, labels, colour class and the explanation shown when clicked
            { x: 10, label: 'Grant', sub: 'if the units are free', cls: 's-proc', title: '1 · Grant whatever can be granted',  // stage 1, Grant: x is its left edge in the wide layout; s-proc colours it like a process
              text: 'A process asks for units of a resource. If enough are free, it gets them immediately. The OS does not ask about future needs and never refuses free units just to be careful. If not enough are free, the process blocks and waits, as it would on any system.' },  // explanation for Grant: free units are handed out at once, and a process waits only when they are not free
            { x: 225, label: 'Detect', sub: 'now and then', cls: 's-os', title: '2 · Run the detection algorithm',  // stage 2, Detect: coloured like the operating system
              text: 'From time to time (at every request, on a timer, or when the processor seems strangely idle) the OS runs the detection algorithm on a snapshot of the state: what each process holds and what each is waiting for. The answer is a list of deadlocked processes, often empty.' },  // explanation for Detect: when the check may run and what it returns, a list of deadlocked processes
            { x: 440, label: 'Recover', sub: 'break the cycle', cls: 's-intr', title: '3 · Recover',  // stage 3, Recover: coloured like an interrupt
              text: 'If the algorithm reports deadlocked processes, the OS breaks the deadlock: it aborts some of them, rolls them back to a saved checkpoint, or takes resources away from them. Then normal operation resumes and the loop starts again.' },  // explanation for Recover: abort, roll back or take resources away, then carry on
          ];  // closes the stages list
          /* two layouts: three stages in a row on wide screens, a column on small screens (bigger text there) */
          const slim = ctx.narrow;  // slim is true on a phone-width screen, where the three stages stack in a column
          const at = (i) => (slim ? [90, 10 + i * 104] : [stages[i].x, 66]);  // at(i): the top-left corner of stage i's box in the current layout
          const svg = s('svg', { viewBox: slim ? '0 0 320 286' : '0 0 590 200', width: '100%' });  // svg: the drawing; its viewBox (the coordinate area the drawing uses) differs between the two layouts
          const detail = ctx.$('.loop-detail');  // detail: the box under the diagram that shows the chosen stage's explanation
          let cur = 0;  // cur: the stage currently selected, the first one to start with
          const nodes = stages.map((st, i) => {  // nodes: one clickable shape per stage
            const [x, y] = at(i);  // x, y: where this stage's box goes
            const g = s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': st.title, style: 'cursor:pointer' },  // g groups the box and its two labels; role, tabindex and aria-label make it work as a button for keyboards and screen readers
              s('rect', { x, y, width: 140, height: 62, rx: 14, class: st.cls, 'stroke-width': 2 }),  // the rounded box, coloured by the stage's class
              s('text', { x: x + 70, y: y + 26, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17 }, (i + 1) + ' ' + st.label),  // the stage number and name, bold and centred in the box
              s('text', { x: x + 70, y: y + 48, 'text-anchor': 'middle', class: 's-sub', 'font-size': slim ? 14 : 13 }, st.sub));  // the short grey subtitle under the name, slightly larger on small screens
            g.addEventListener('click', () => show(i));  // clicking a stage shows its explanation
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } });  // pressing Enter or Space on a focused stage does the same; preventDefault stops Space from scrolling the page
            return g;  // hands the finished group to the nodes list
          });  // ends the map over the stages
          const ring = s('rect', { x: 0, y: 60, width: 152, height: 74, rx: 18, fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 3 });  // ring: an accent-coloured outline that moves to surround whichever stage is selected
          const arrow = (d) => s('path', { d, fill: 'none', class: 's-line', 'stroke-width': 2, 'marker-end': 'url(#arr)' });  // arrow(d): a line along path d with an arrowhead at its end (the arrowhead shape is defined by the shell)
          const lab = (x, y, t, rot) => s('text', { x, y, 'text-anchor': 'middle', 'font-size': slim ? 14 : 13, class: 's-sub', transform: rot ? `rotate(${rot} ${x} ${y})` : null }, t);  // lab(x, y, t, rot): a small grey label on an arrow, turned by rot degrees when given (for labels running up a side)
          if (slim) svg.append(arrow('M160 72 L160 110'), arrow('M160 176 L160 214'), s('text', { x: 172, y: 200, 'font-size': 14, class: 's-sub' }, 'found'),  // column layout: arrows down from Grant to Detect and from Detect to Recover, labelled "found"
            arrow('M90 145 C 34 145, 34 41, 86 41'), lab(30, 93, 'nothing found', -90),  // a curved arrow on the left from Detect back to Grant, with a sideways "nothing found" label
            arrow('M230 249 C 300 249, 300 41, 234 41'), lab(300, 145, 'deadlock broken', 90), ...nodes, ring);  // a curved arrow on the right from Recover back to Grant, then the boxes and the ring drawn last so they sit on top
          else svg.append(arrow('M152 97 L221 97'), arrow('M367 97 L436 97'), lab(402, 88, 'found'),  // row layout: arrows from Grant to Detect and from Detect to Recover, labelled "found"
            arrow('M295 64 C 295 14, 80 14, 80 60'), lab(188, 16, 'nothing found: carry on'),  // a curved arrow over the top from Detect back to Grant: nothing found, carry on
            arrow('M510 130 C 510 190, 80 190, 80 134'), lab(295, 194, 'deadlock broken: back to normal'), ...nodes, ring);  // a curved arrow underneath from Recover back to Grant, then the boxes and the ring on top
          ctx.$('.loop-box').append(svg);  // puts the finished drawing into its card
          function show(i) {  // show(i): selects stage i
            cur = i;  // remembers the selection
            ring.setAttribute('x', at(i)[0] - 6); ring.setAttribute('y', at(i)[1] - 6);  // moves the ring so it sits 6 units outside stage i's box on every side
            detail.innerHTML = '';  // empties the explanation box
            detail.append(h('div', { class: 'b', style: { fontSize: '17px', marginBottom: '4px' } }, stages[i].title), h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: 1.45 } }, stages[i].text));  // fills it with the stage's title in bold and its explanation paragraph
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');  // restarts the fade-in: reading offsetWidth makes the browser apply the class removal before the class is added again
          }  // ends show
          show(cur);  // shows the first stage when the step opens
        },  // ends render() for step 1
      },  // ends step 1
      {  // step 2 begins: how often detection should run
        title: 'How often should the OS look?',  // step 2 title
        kind: 'explore',  // kind "explore": an interactive slide where the student changes settings and watches the result
        render(el, ctx) {  // render(el, ctx): builds the simulation when step 2 is shown
          const { h, s } = ctx;  // takes the HTML and SVG builders
          const SPAN = 120, REQ = 400, INC_MS = 0.05, FULL_MS = 6;  // SPAN: 120 seconds simulated; REQ: 400 requests a second; INC_MS: cost of one quick per-request check; FULL_MS: cost of one full check
          const IV = [0.5, 1, 2, 5, 10, 20, 30, 60, 120];  // IV: the timer intervals the slider offers, in seconds
          const MOMENTS = [47.3, 88.2, 31.8, 58.6, 95.1, 24.5];  // MOMENTS: the times (in seconds) at which the deadlock forms; the "Move the deadlock" button steps through them
          let mode = 'timer', iv = 4, theta = 50, mi = 0;  // starting settings: timer mode, interval IV[4] = 10 s, idle threshold 50 percent, the first deadlock moment
          const base = (t) => 85 - Math.max(0, 33 * (1 - Math.abs(t - 16) / 3)) - Math.max(0, 23 * (1 - Math.abs(t - 75) / 3));  // base(t): normal processor use, 85 percent busy, with two short innocent dips (around 16 s and 75 s) that can fool the idle check
          const sick = (t, t0) => Math.min(base(t), Math.max(22, 85 - 6 * (t - t0)));  // sick(t, t0): after a deadlock forms at t0, use falls 6 points a second down to 22 percent, as work stalls behind the stuck processes
          /* simulate(): when the deadlock is found, which checks ran, and the utilization curve, all for the current settings */
          function simulate() {  // simulate(): computes everything the drawing and the tiles need for the current settings
            const t0 = MOMENTS[mi], T = IV[iv];  // t0: when the deadlock forms; T: the chosen timer interval
            let found = null, checks = [];  // found: when the deadlock is discovered (null until then); checks: the times at which a check runs
            if (mode === 'req') found = t0;  // checking at every request finds the deadlock at the very request that forms it
            else if (mode === 'timer') { for (let k = 1; k * T <= SPAN + 1e-9; k++) checks.push(+(k * T).toFixed(2)); found = checks.find((c) => c >= t0 - 1e-9); }  // timer mode: checks at T, 2T, 3T ... up to 120 s; the deadlock is found by the first check at or after t0 (1e-9 absorbs rounding)
            else {  // idle mode: a check runs whenever processor use drops below the threshold
              let below = false;  // below remembers whether use was already under the threshold, so one dip counts as only one check
              for (let k = 0; k <= SPAN * 20; k++) {  // samples the curve 20 times a second over the whole span
                const t = k / 20, u = found == null && t >= t0 ? sick(t, t0) : base(t);  // u: processor use at time t, the falling deadlock curve while the deadlock is undiscovered, otherwise the normal curve
                if (u < theta && !below) { checks.push(t); if (t >= t0 && found == null) found = t; }  // on a fresh drop below the threshold a check runs; the first check after t0 finds the deadlock
                below = u < theta;  // records whether use is under the threshold for the next sample
              }  // ends the sampling loop
            }  // ends idle mode
            const pts = [];  // pts: points of the processor-use curve for the drawing
            for (let k = 0; k <= SPAN * 2; k++) { const t = k / 2; pts.push([t, t >= t0 && (found == null || t < found) ? sick(t, t0) : base(t)]); }  // one point every half second: the falling curve between the deadlock and its discovery, the normal curve otherwise
            const cpu = mode === 'req' ? REQ * INC_MS / 1000 : mode === 'timer' ? FULL_MS / 1000 / T : checks.length * FULL_MS / 1000 / SPAN;  // cpu: the share of processor time spent checking: per request, per timer tick, or per idle-triggered check
            const nChecks = mode === 'req' ? REQ * SPAN : checks.length;  // nChecks: how many checks ran in the 120 s (400 a second when checking at every request)
            const wasted = mode === 'idle' ? checks.filter((c) => c !== found).length : null;  // wasted: in idle mode, the checks that found nothing (false alarms)
            return { t0, T, found, checks, pts, cpu, nChecks, delay: found - t0, wasted };  // returns the results; delay is how long the deadlock went unnoticed
          }  // ends simulate
          const VW = ctx.narrow ? 380 : 600, TICK = ctx.narrow ? 40 : 20;  // VW: the drawing's width (smaller on phone-width screens); TICK: the spacing of time labels on the axis
          const X = (t) => 34 + t * ((VW - 64) / SPAN), Y = (u) => 132 - u * 1.08;  // X(t) turns a time into a horizontal position; Y(u) turns a busy percentage into a height (100 percent near the top)
          const svg = s('svg', { viewBox: `0 0 ${VW} 220`, width: '100%' });  // svg: the drawing of processor use over time
          const tiles = h('div', { class: 'grid-3', style: { gap: '10px' } });  // tiles: a row of three number tiles under the drawing
          const narr = h('div', { class: 'narr', style: { minHeight: '96px' } });  // narr: the explanation box for the chosen strategy
          const pct = (x) => (x >= 0.01 ? (x * 100).toFixed(1) : x >= 0.001 ? (x * 100).toFixed(2) : (x * 100).toFixed(3)) + '%';  // pct(x): writes a fraction as a percentage, with more decimal places for very small values
          function draw() {  // draw(): redraws the chart, the tiles and the explanation for the current settings
            const r = simulate(), kids = [];  // r: the simulation results; kids collects the SVG pieces to draw
            kids.push(s('text', { x: 34, y: 14, 'font-size': 13, class: 's-sub' }, 'processor busy (%)'));  // the axis title in the top-left corner
            [0, 50, 100].forEach((u) => kids.push(s('line', { x1: X(0), y1: Y(u), x2: X(SPAN), y2: Y(u), class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 4' }),  // faint dotted guide lines at 0, 50 and 100 percent busy
              s('text', { x: 28, y: Y(u) + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(u))));  // and their numbers at the left edge
            if (mode === 'idle') kids.push(s('line', { x1: X(0), y1: Y(theta), x2: X(SPAN), y2: Y(theta), style: 'stroke:var(--warn)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),  // idle mode only: a dashed amber line at the threshold
              s('text', { x: X(SPAN), y: Y(theta) - 5, 'text-anchor': 'end', 'font-size': 13, style: 'fill:var(--warn)', 'font-weight': 700 }, 'threshold ' + theta + '%'));  // the threshold's label, in amber at the right end of its line
            kids.push(s('polyline', { points: r.pts.map(([t, u]) => X(t).toFixed(1) + ',' + Y(u).toFixed(1)).join(' '), fill: 'none', style: 'stroke:var(--cpu)', 'stroke-width': 2, opacity: mode === 'idle' ? 1 : 0.55 }));  // the processor-use curve as one connected line; it is faded except in idle mode, where the curve itself triggers the checks
            kids.push(s('line', { x1: X(0), y1: 160, x2: X(SPAN), y2: 160, class: 's-line', 'stroke-width': 1.5 }));  // the time axis under the chart
            for (let t = 0; t <= SPAN; t += TICK) kids.push(s('line', { x1: X(t), y1: 160, x2: X(t), y2: 165, class: 's-line' }), s('text', { x: X(t), y: 178, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, t + ' s'));  // a tick mark and a label such as "20 s" every TICK seconds along the axis
            if (mode === 'req') kids.push(s('rect', { x: X(0), y: 151, width: X(SPAN) - X(0), height: 8, style: 'fill:var(--accent)', opacity: 0.35 }));  // checking at every request: a solid band along the axis, since checks run all the time
            else r.checks.forEach((c) => kids.push(s('line', { x1: X(c), y1: 149, x2: X(c), y2: 159, style: 'stroke:var(--accent)', 'stroke-width': r.checks.length > 60 ? 1 : 2.5 })));  // otherwise one short accent-coloured mark per check, drawn thinner when there are more than 60 so they stay apart
            kids.push(s('line', { x1: X(r.t0), y1: 140, x2: X(r.t0), y2: 196, style: 'stroke:var(--bad)', 'stroke-width': 2 }));  // a red vertical line at the moment the deadlock forms
            kids.push(s('line', { x1: X(r.found), y1: 140, x2: X(r.found), y2: 196, style: 'stroke:var(--ok)', 'stroke-width': 2.5 }));  // a green vertical line at the check that finds it
            kids.push(s('rect', { x: X(r.t0), y: 185, width: Math.max(3, X(r.found) - X(r.t0)), height: 11, rx: 3, class: 's-bad', 'stroke-width': 1 }));  // a red bar between the two lines shows how long it went unnoticed; at least 3 units wide so a zero delay still shows
            const lx = Math.min(Math.max((X(r.t0) + X(r.found)) / 2, 160), VW - 160);  // lx: the label's centre, halfway between the two lines but kept 160 units from either edge so the text is not cut off
            kids.push(s('text', { x: lx, y: 214, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--bad)' }, `deadlock forms at ${r.t0} s · found at ${+r.found.toFixed(1)} s`));  // the label: when the deadlock formed and when it was found
            svg.replaceChildren(...kids);  // swaps the old drawing for the new pieces in one go
            const tile = (k, v, cls) => h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v', style: cls ? { color: `var(--${cls})` } : {} }, v));  // tile(k, v, cls): a number tile with a small label k, a big value v and an optional colour
            tiles.replaceChildren(  // replaces the three tiles
              tile('CPU time spent checking', pct(r.cpu), r.cpu >= 0.005 ? 'warn' : 'ok'),  // tile: the share of processor time spent checking, amber from 0.5 percent up, green below
              tile('Deadlock went unnoticed for', (+r.delay.toFixed(1)) + ' s', r.delay > 10 ? 'bad' : r.delay > 0 ? 'warn' : 'ok'),  // tile: how long the deadlock went unnoticed, red above 10 s, amber above 0, green when caught at once
              tile('Checks in these two minutes', r.nChecks.toLocaleString('en-US') + (r.wasted ? ` (${r.wasted} found nothing)` : '')));  // tile: how many checks ran in the two minutes (with thousands separators) and, in idle mode, how many found nothing
            if (mode === 'req') narr.innerHTML = `<b>Check at every request.</b> Each request changes the state in just one place, so the check can be <b>incremental</b>: it only asks whether that one change closes a cycle, which keeps the algorithm simple. The deadlock is caught by the very request that creates it. The price is work on all ${REQ} requests a second, here ${pct(r.cpu)} of the processor.`;  // explanation for checking at every request: cheap incremental checks, instant discovery, but a cost on every request
            else if (mode === 'timer') narr.innerHTML = `<b>Check every ${r.T} s.</b> A full check costs ${FULL_MS} ms, so ${FULL_MS} ms out of every ${r.T} s is ${pct(r.cpu)} of the processor. This deadlock sat unnoticed for <b>${+r.delay.toFixed(1)} s</b>, with its processes and their resources frozen. On average a deadlock waits half an interval (${r.T / 2} s), at worst a whole one (${r.T} s).`;  // explanation for the timer: the cost is one full check per interval, and the wait is half an interval on average
            else narr.innerHTML = `<b>Check when the processor goes quiet.</b> Deadlocked processes stop doing work and others soon queue behind them, so utilization falls. Checks are rare and cheap, but innocent dips, such as a burst of disk transfers, also set them off: ${r.wasted ? `${r.wasted} false alarm${r.wasted === 1 ? '' : 's'} here` : 'no false alarm this time'}. A higher threshold catches the deadlock sooner (${+r.delay.toFixed(1)} s now) but raises more false alarms.`;  // explanation for idle checks: rare and cheap, but innocent dips cause false alarms; the threshold trades speed for alarms
          }  // ends draw
          const ivSl = ctx.ui.slider({ label: 'Check every', min: 0, max: IV.length - 1, value: iv, format: (v) => IV[v] + ' s', onInput: (v) => { iv = v; draw(); } });  // ivSl: the timer slider; its positions 0 to 8 pick an interval from IV, and moving it redraws
          const thSl = ctx.ui.slider({ label: 'Check when busy drops below', min: 30, max: 70, step: 5, value: theta, format: (v) => v + '%', onInput: (v) => { theta = v; draw(); } });  // thSl: the idle-threshold slider, from 30 to 70 percent in steps of 5
          const showSliders = () => { ivSl.style.display = mode === 'timer' ? '' : 'none'; thSl.style.display = mode === 'idle' ? '' : 'none'; };  // showSliders(): shows only the slider that belongs to the chosen mode
          const seg = ctx.ui.seg([{ value: 'req', label: 'At every request' }, { value: 'timer', label: 'On a timer' }, { value: 'idle', label: 'When the CPU goes quiet' }], mode, (v) => { mode = v; showSliders(); draw(); });  // seg: a three-way switch for when to check; choosing one updates the mode, the sliders and the drawing
          const move = h('button', { class: 'btn sm', type: 'button', onclick: () => { mi = (mi + 1) % MOMENTS.length; draw(); } }, 'Move the deadlock to another moment');  // move: a button that moves the deadlock to the next moment in MOMENTS, wrapping back to the first
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: '22px' } },  // the page layout: two columns, the right one wider
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: text and controls
              h('p', { class: 'm0', html: 'Detection is only as good as its timing. Check constantly and you spend processor time on checks that almost always find nothing. Check rarely and a <span class="t">deadlock</span> sits unnoticed, freezing its processes and every resource they hold.' }),  // intro paragraph: the trade-off between checking too often and too rarely
              h('div', { class: 'small b' }, 'When does the OS run the check?'), seg, ivSl, thSl, move,  // a small heading, then the mode switch, the two sliders and the move button
              h('div', { class: 'callout tip small m0', 'data-label': 'Try this' }, 'On a timer, drag from 0.5 s to 120 s and watch the two costs trade places. Then move the deadlock: with a long interval, the delay depends on luck.'),  // "Try this" box: drag the interval across its range, then move the deadlock to see the role of luck
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' }, 'There is no free choice. Early detection costs processor time on every request; cheap detection leaves deadlocks in place longer. Real systems pick a middle ground that suits how often their deadlocks happen.')),  // "Why it matters" box: every choice costs something, so real systems choose a middle ground; closes the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the chart and its results
              h('div', { class: 'card white tight' }, svg,  // a white card holding the chart
                h('div', { class: 'row gap-s xs', style: { justifyContent: 'center' } }, h('span', { class: 'chip accent' }, '| a check runs'), h('span', { class: 'chip bad' }, 'red line: deadlock forms'), h('span', { class: 'chip ok' }, 'green line: the check that finds it'))),  // a key under the chart: the check marks, the red line and the green line; closes the card
              tiles, narr)));  // the tiles and the explanation box; closes the right column and the whole layout
          showSliders();  // shows the right slider for the starting mode
          draw();  // draws the chart for the starting settings
        },  // ends render() for step 2
      },  // ends step 2
      {  // step 3 begins: the detection algorithm played one move at a time
        title: 'The detection algorithm, one move at a time',  // step 3 title
        kind: 'explore',  // an interactive explore slide
        core: true,  // core: true keeps this step on the shorter core route through the section
        render(el, ctx) {  // render(el, ctx): builds the step-through when step 3 is shown
          const { h } = ctx;  // takes the HTML builder
          const { names, res, A, Q, V } = EX;  // takes the names, A, Q and V of the worked example EX
          const run = detect(A, Q, V);  // runs the detection algorithm once; every frame of the animation comes from its log
          const frames = [{ t: 'start' }, ...run.events, { t: 'result' }];  // frames: an opening frame, one frame per logged move, and a closing result frame
          const STEPS = [  // STEPS: the algorithm's steps as listed on screen, each as [label, instruction, why]
            ['Step 1', 'Mark each process whose row of <b>A</b> is all zeros.', 'It holds nothing, so nobody can be waiting on it.'],  // list item for step 1: mark processes whose row of A is all zeros
            ['Step 2', 'Set a scratch vector <b>W</b> = <b>V</b>.', 'W: the units we could count on. V itself never changes.'],  // list item for step 2: copy V into the scratch vector W
            ['Step 3', 'Find an unmarked process <i>i</i> whose row of <b>Q</b> is ≤ <b>W</b> in every column. If none, stop.', 'Everything it waits for could be handed over.'],  // list item for step 3: find an unmarked process whose request fits in W, or stop
            ['Step 4', 'Mark <i>i</i>, add its row of <b>A</b> to <b>W</b>, go to step 3.', 'Optimistic guess: it finishes and returns all it holds.'],  // list item for step 4: mark it, add its holdings to W, repeat; the optimistic guess
            ['End', 'Every unmarked process is deadlocked.', 'No order of finishing can ever free what they wait for.'],  // list item for the end: every unmarked process is deadlocked
          ];  // closes STEPS
          const lis = STEPS.map(([n, txt, why]) => h('li', {}, h('span', { class: 'sn' }, n), h('span', { html: txt }), h('span', { class: 'wy' }, why)));  // lis: one list item per step: the bold label, the instruction (which contains HTML) and the grey why line
          const failsOf = (W, marked) => { const f = {}; marked.forEach((m, i) => { if (!m) f[i] = Q[i].findIndex((x, j) => x > W[j]); }); return f; };  // failsOf(W, marked): for each unmarked process, the first column where it asks for more than W, to draw in red
          function stateOf(f) {  // stateOf(f): turns one logged move into the display state that matrixView draws
            const st = { marked: f.marked || Array(names.length).fill(false), W: f.W || null, cur: null, test: false, add: null, fails: null, dead: null, step: -1 };  // starting point: the marks and W from the move, nothing tested, nothing added, no step highlighted (-1)
            if (f.t === 'zero') st.step = 0;  // a step 1 move highlights the first item of the steps list
            else if (f.t === 'init') st.step = 1;  // a step 2 move highlights the second item
            else if (f.t === 'test') { st.step = 2; st.cur = f.i; st.test = true; }  // a test highlights step 3 and outlines the row being tested, colouring its cells pass or fail
            else if (f.t === 'mark') { st.step = 3; st.cur = f.i; st.add = f.i; }  // a mark highlights step 4, outlines the row, and colours its held units that flow into W
            else if (f.t === 'none') { st.step = 2; st.fails = failsOf(f.W, f.marked); }  // the final "nothing fits" move stays on step 3 and shows each remaining process's blocking cell in red
            else if (f.t === 'result') { st.step = 4; st.marked = run.marked; st.W = run.W; st.dead = run.dead; st.fails = failsOf(run.W, run.marked); }  // the result frame highlights the end item and shows the final marks, W, the deadlocked rows and why they are stuck
            return st;  // hands the state back
          }  // ends stateOf
          function caption(f) {  // caption(f): the explanation for each frame, shown in the player's caption box above its buttons
            const P = f.i != null ? names[f.i] : '';  // P: the name of the process this move is about, if there is one
            if (f.t === 'start') return 'This is the state at the moment the check runs. <b>A</b> says what each process holds, <b>Q</b> what each is waiting for, and <b>V</b> what is free (the total minus everything held). Nothing is marked yet. Press <b>Next</b> or <b>Play</b>.';  // caption for the opening frame: what A, Q and V mean and how to start
            if (f.t === 'zero') {  // step 1 captions
              if (!f.list.length) return '<b>Step 1.</b> No row of A is all zeros, so nothing is marked yet.';  // when no row of A is all zeros
              const nm = f.list.map((i) => names[i]), waiting = f.list.filter((i) => !isZero(Q[i])).map((i) => names[i]);  // nm: the processes marked in step 1; waiting: those of them that are still waiting for something
              return `<b>Step 1.</b> ${list(nm)} ${nm.length > 1 ? 'hold' : 'holds'} nothing: the row of A is all zeros. A process that holds nothing cannot be keeping anyone waiting, so it is marked straight away${waiting.length ? `, even though ${list(waiting)} ${waiting.length > 1 ? 'are' : 'is'} itself waiting for something` : ''}.`;  // explains why holding nothing means a process is marked, even if it is itself waiting
            }  // ends the step 1 case
            if (f.t === 'init') return `<b>Step 2.</b> Copy V into W: W = ${vec(f.W)}. Right now W holds only the units that are actually free. It will grow as processes are marked.`;  // caption for step 2: W starts as a copy of V and will grow
            if (f.t === 'test') {  // step 3 captions
              if (isZero(Q[f.i])) return `<b>Step 3.</b> ${P}'s row of Q is all zeros: it is not waiting for anything, it is simply running. An empty request always fits, so ${P} is chosen.`;  // an all-zero request: the process is simply running, so it always fits
              if (f.ok) return `<b>Step 3.</b> Does ${P}'s request ${vec(Q[f.i])} fit in W = ${vec(f.W)}? <b>Yes</b>, in every column, so ${P} could be given everything it is waiting for.`;  // a request that fits in every column
              return `<b>Step 3.</b> Does ${P}'s request ${vec(Q[f.i])} fit in W = ${vec(f.W)}? <b>No</b>: it needs ${Q[f.i][f.bad]} × ${res[f.bad]} and W has ${f.W[f.bad]}. Try the next unmarked process.`;  // a request that does not fit: names the resource, how many are needed and how many W has
            }  // ends the step 3 case
            if (f.t === 'mark') return `<b>Step 4.</b> Mark ${P} and assume it finishes and returns what it holds: W = ${vec(f.before)} + ${vec(A[f.i])} = <b>${vec(f.W)}</b>. Back to step 3, scanning from the top again.`;  // caption for step 4: the sum that grows W, then back to step 3 from the top
            if (f.t === 'none') {  // the final "nothing fits" move
              const um = f.marked.map((m, i) => (m ? null : i)).filter((i) => i != null);  // um: the processes still unmarked
              return `<b>Step 3.</b> None of the unmarked requests fits in W = ${vec(f.W)}: ${um.map((i) => { const j = Q[i].findIndex((x, k) => x > f.W[k]); return `${names[i]} needs ${res[j]}`; }).join(', ')}. No process can be found, so the algorithm <b>stops</b>.`;  // lists what each of them needs and says the algorithm stops
            }  // ends that case
            if (!run.dead.length) return '<b>Result.</b> Every process is marked: there is no deadlock.';  // result caption when nobody is deadlocked
            const why = stuck(A, Q, run.W, run.dead, names, res).map((x) => x.text).join('; ');  // why: one sentence per deadlocked process saying what it waits for and who holds it
            const zw = run.zero.filter((i) => !isZero(Q[i])).map((i) => names[i]);  // zw: processes marked in step 1 that still wait for something
            return `<b>Result.</b> ${list(run.dead.map((i) => names[i]))} ${run.dead.length > 1 ? 'are' : 'is'} still unmarked, so ${run.dead.length > 1 ? 'they are' : 'it is'} <b>deadlocked</b>: ${why}. That is a circular wait.${zw.length ? ` ${list(zw)} also waits, but holds nothing, so it is not part of the cycle.` : ''}`;  // result caption naming the deadlocked processes and the circular wait, noting any waiter that holds nothing
          }  // ends caption
          const side = (st) => h('div', {},  // side(st): the panel beside the vector table, showing the marks and a colour key
            h('div', { class: 'mxcap' }, 'Marks'),  // its small caption, "Marks"
            h('div', { class: 'row gap-s' }, ...names.map((nm, i) => h('span', { class: 'chip ' + (st.marked[i] ? 'ok' : st.dead && st.dead.includes(i) ? 'bad' : '') }, (st.marked[i] ? '✓ ' : st.dead && st.dead.includes(i) ? '✗ ' : '') + nm))),  // one chip per process: green with a tick when marked, red with a cross when deadlocked, plain otherwise
            h('div', { class: 'row gap-s xs', style: { marginTop: '8px' } }, h('span', { class: 'chip ok' }, 'fits'), h('span', { class: 'chip bad' }, 'does not fit'), h('span', { class: 'chip mem' }, 'added to W')));  // a colour key: green fits, red does not fit, memory colour added to W
          const mv = matrixView(ctx, { names, res, A, Q, V, total: EX.total, side });  // mv: builds the A, Q and vector tables for the worked example, with the side panel
          const player = ctx.ui.player({ count: frames.length, interval: 2600, render: (k) => {  // player: the shell's animation player, one frame per entry, 2.6 seconds per frame when playing; render(k) draws frame k
            const st = stateOf(frames[k]);  // st: the display state for frame k
            mv.draw(st);  // redraws the tables for that state
            lis.forEach((li, j) => li.classList.toggle('on', j === st.step));  // highlights the matching item in the list of algorithm steps and switches the highlight off on the others
            return caption(frames[k]);  // returns the caption, which the player shows for this frame
          } });  // ends the frame render function and the player settings
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 410px) minmax(0, 1fr)', gap: '20px' } },  // the page layout: the steps list on the left (at most 410 pixels wide), the tables and player on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column
              h('p', { class: 'm0 small', html: 'The algorithm tries to show that each process is <b>not</b> deadlocked, and marks it when it can. It reads the <span class="t">allocation matrix</span> A, the <span class="t">request matrix</span> Q and the <span class="t">available vector</span> V, and keeps a <span class="t">work vector</span> W.' }),  // intro paragraph: the algorithm marks what it can prove is not deadlocked, using A, Q, V and W
              h('ol', { class: 'algo' }, ...lis),  // the numbered list of algorithm steps built above
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Mixing up the rows. Test the row of Q (what it waits for) against W; then add the row of A (what it gives back).')),  // "Common mistake" box: testing with the wrong matrix; closes the left column
            h('div', { class: 'stack', style: { gap: '10px' } }, mv.el, player.el)));  // right column: the matrix tables, then the player; closes the layout
          player.caption.style.minHeight = '96px';  // gives the caption box a fixed minimum height so the tables do not jump as captions change length
        },  // ends render() for step 3
      },  // ends step 3
      {  // step 4 begins: the request editor
        title: 'Change one request, change the verdict',  // step 4 title: one changed request can change the verdict
        kind: 'lab',  // kind "lab": labelled "Hands-on Lab" above the title
        render(el, ctx) {  // render(el, ctx): builds the editor when step 4 is shown
          const { h } = ctx;  // takes the HTML builder
          const { names, res, A, total, V } = EX;  // takes the worked example's names, A, totals and V; Q is copied below so the student can change it
          const Q0 = EX.Q.map((r) => r.slice());  // Q0: an untouched copy of the original requests, for comparison and for the reset button
          const Q = Q0.map((r) => r.slice());  // Q: the working copy that the student's clicks change
          const cap = (i, j) => total[j] - A[i][j];  // cap(i, j): the most process i can ask for of resource j, the total minus what it already holds
          const P = (arr) => arr.map((i) => names[i]);  // P(arr): turns a list of process numbers into their names
          const verdict = h('div', { class: 'narr', style: { minHeight: '120px' } });  // verdict: the box that says whether there is a deadlock, and why
          const warn = h('div', { class: 'small', style: { minHeight: '20px' } });  // warn: a small line for a note about requests that could be granted right away
          const chal = h('div', { class: 'stack', style: { gap: '6px' } });  // chal: the list of goals for the student
          const counter = h('span', { class: 'chip' });  // counter: a chip counting how many cells differ from the original
          const trace = h('div', { class: 'small', style: { lineHeight: 1.7 } });  // trace: a one-line summary of the algorithm's moves for the current Q
          const done = [false, false];  // done: whether goals 1 and 2 have been reached; once true they stay true
          let run = null;  // run: the latest detection result, refreshed by update()
          const qCell = (i, j) => {  // qCell(i, j): the clickable button that shows one Q cell in the editor
            const c = cap(i, j);  // c: the largest request allowed for this cell
            return h('button', { class: 'qb' + (Q[i][j] !== Q0[i][j] ? ' chg' : ''), type: 'button', disabled: c === 0,  // the button; it is highlighted (chg) when changed and disabled when c is 0 because the process holds every unit
              title: c === 0 ? `${names[i]} already holds every unit of ${res[j]}` : `${names[i]} asks for ${Q[i][j]} of ${res[j]}; click to change (0 to ${c})`,  // tooltip: explains why the cell is locked, or what the request is and the range it can take
              'aria-label': `Request of ${names[i]} for ${res[j]}: ${Q[i][j]}`,  // a label for screen readers, read out with the current value
              onclick: () => { Q[i][j] = (Q[i][j] + 1) % (c + 1); update(); } }, String(Q[i][j]));  // a click raises the request by one, wrapping back to 0 after c, then re-runs detection
          };  // ends qCell
          const side = () => h('div', {},  // side(): the panel beside the vector table, listing the order in which processes were marked
            h('div', { class: 'mxcap' }, 'Marking order'),  // its small caption
            h('div', { class: 'row gap-s' },  // a row of chips
              ...run.zero.map((i) => h('span', { class: 'chip ok', title: 'marked in step 1: holds nothing' }, '✓ ' + names[i] + ' (step 1)')),  // first the processes marked in step 1, tagged "(step 1)", with a tooltip saying they hold nothing
              ...run.order.map((i) => h('span', { class: 'chip ok' }, '✓ ' + names[i])),  // then the processes marked in steps 3 and 4, in the order they were marked
              ...run.dead.map((i) => h('span', { class: 'chip bad' }, '✗ ' + names[i]))));  // then the deadlocked ones, in red with a cross
          const mv = matrixView(ctx, { names, res, A, Q, V, total, side, qCell });  // mv: the matrix tables for this step, with the order panel and clickable Q cells
          function update() {  // update(): runs after every change; re-runs detection and refreshes everything on screen
            run = detect(A, Q, V);  // runs the real detection algorithm on the current requests
            const fails = {};  // fails will hold the blocking resource of each deadlocked process
            run.dead.forEach((i) => { fails[i] = Q[i].findIndex((x, j) => x > run.W[j]); });  // for each deadlocked process, the first column where it asks for more than the final W
            mv.draw({ marked: run.marked, W: run.W, dead: run.dead, fails, cur: null, add: null, test: false });  // draws the final state: marks, W, deadlocked rows in red and their blocking cells; no row is mid-test
            trace.innerHTML = run.events.map((e) => {  // builds the one-line trace from the algorithm's log
              if (e.t === 'zero') return e.list.length ? `<b>1:</b> mark ${list(P(e.list))}` : '<b>1:</b> no empty rows';  // step 1: names the processes marked for holding nothing, or says there are none
              if (e.t === 'init') return `<b>2:</b> W = ${vec(e.W)}`;  // step 2: the starting W
              if (e.t === 'test') return e.ok ? `<span style="color:var(--ok)">${names[e.i]} ✓</span>` : `<span style="color:var(--bad)">${names[e.i]} ✗</span>`;  // a test: the process name with a green tick if it fits, a red cross if not
              if (e.t === 'mark') return `W = <b>${vec(e.W)}</b>`;  // a mark: the new value of W
              return '<b>stop</b>';  // the final "nothing fits": stop
            }).join(' · ');  // joins the pieces with dots between them
            const diffs = Q.reduce((n, r, i) => n + r.filter((x, j) => x !== Q0[i][j]).length, 0);  // diffs: how many cells of Q differ from the original
            counter.textContent = `${diffs} change${diffs === 1 ? '' : 's'} from the original`;  // shows that count in the counter chip, with "change" or "changes"
            if (run.dead.length) {  // if anyone is deadlocked
              verdict.className = 'narr bad';  // the verdict box turns red
              verdict.innerHTML = `<b>Deadlock.</b> ${list(P(run.dead))} ${run.dead.length > 1 ? 'are' : 'is'} left unmarked, so ${run.dead.length > 1 ? 'they are' : 'it is'} deadlocked.<br>` +  // it names the deadlocked processes
                stuck(A, Q, run.W, run.dead, names, res).map((x) => '· ' + x.text + '.').join('<br>');  // and adds one line per process saying what it waits for and who holds it
            } else {  // otherwise
              verdict.className = 'narr ok';  // the verdict box turns green
              verdict.innerHTML = `<b>No deadlock.</b> Every process gets marked${run.zero.length ? `: ${list(P(run.zero))} in step 1 (holding nothing)` : ''}${run.order.length ? `, then ${P(run.order).join(' → ')} as W grows` : ''}. Some order of finishing lets everyone complete.`;  // it lists the processes marked in step 1 and then the marking order, showing every process can finish
            }  // ends the verdict
            const early = names.map((_, i) => i).filter((i) => !isZero(Q[i]) && fits(Q[i], V));  // early: processes asking only for units that are free right now, which a real OS would already have granted
            warn.innerHTML = early.length ? `<span class="chip warn">Note</span> ${list(P(early))} ${early.length > 1 ? 'ask' : 'asks'} only for units that are free right now. A real OS would grant that at once, so read it as a request that has only just arrived.` : '';  // shows a note about them, so the student reads such a request as one that has only just arrived; empty otherwise
            if (!run.dead.length && diffs === 1) done[0] = true;  // goal 1 is met when a single change leaves nobody deadlocked
            if ([0, 1, 2, 3].every((i) => run.dead.includes(i)) && diffs === 1) done[1] = true;  // goal 2 is met when a single change deadlocks P1, P2, P3 and P4 together
            const goal = (k, txt) => h('div', { class: 'row gap-s nw', style: { alignItems: 'flex-start' } }, h('span', { class: 'chip ' + (done[k] ? 'ok' : '') }, done[k] ? '✓ done' : 'goal ' + (k + 1)), h('span', { class: 'small' }, txt));  // goal(k, txt): one goal line: a chip saying "goal 1" or "done", then the goal text
            chal.replaceChildren(  // rebuilds the goals list
              goal(0, 'Break the deadlock by changing a single number in Q.'),  // goal 1: break the deadlock with one change
              goal(1, 'With a single change, deadlock P1, P2, P3 and P4 all at once.'),  // goal 2: deadlock the four processes P1 to P4 with one change
              h('div', { class: 'row gap-s nw', style: { alignItems: 'flex-start' } }, h('span', { class: 'chip' }, 'goal 3'), h('span', { class: 'small' }, 'Make P5 deadlocked. Try it, then reveal why.')));  // goal 3, which is impossible on purpose: make P5 deadlocked; it never gets a done chip
          }  // ends update
          const resetBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { Q0.forEach((r, i) => r.forEach((x, j) => { Q[i][j] = x; })); update(); } }, 'Back to the original');  // resetBtn: puts every request back to its original value and re-runs detection
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 13fr) minmax(0, 9fr)', gap: '20px' } },  // the page layout: tables on the left, verdict and goals on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column
              h('p', { class: 'm0 small', html: 'Same state as before. <b>Click any number in Q</b> to change that request (it counts up, then wraps to 0); detection re-runs after every click. Greyed cells cannot grow: that process already holds every unit.' }),  // instructions: click any Q number to change it; detection re-runs, and greyed cells cannot grow
              mv.el,  // the matrix tables with clickable Q cells
              h('div', { class: 'card tight' }, h('div', { class: 'mxcap' }, 'Trace of this run (✓ fits in W, ✗ does not)'), trace)),  // a small card with the one-line trace; closes the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Verdict'), counter),  // a heading row: "Verdict" on the left, the changes counter on the right
              verdict, warn,  // the verdict box and the note line
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('b', {}, 'Your goals'), chal,  // a card with the goals list
                ctx.ui.reveal('Why goal 3 is impossible', '<p class="small m0">P5 holds nothing, so step 1 marks it before any request is looked at. No other process can be waiting on P5, so it can never be part of a circular wait. If it waits for units that only deadlocked processes hold, it is stuck too, but as a bystander: breaking the deadlock frees it.</p>')),  // a hidden explanation the student can open: P5 holds nothing, so it is marked in step 1 and is at most a bystander
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, resetBtn,  // a bottom row with the reset button
                h('span', { class: 'xs muted' }, 'Yellow cells differ from the original.')))));  // and a reminder that yellow cells differ from the original; closes the right column and the layout
          update();  // draws everything once for the original requests
        },  // ends render() for step 4
      },  // ends step 4
      {  // step 5 begins: detection compared with the banker's safety test
        title: 'Detection versus the banker\'s safety test',  // step 5 title
        kind: 'compare',  // kind "compare": labelled "Compare" above the title
        render(el, ctx) {  // render(el, ctx): builds the comparison when step 5 is shown
          const { h } = ctx;  // takes the HTML builder
          const { names, res, A, C, V, need, Qnow } = CMP;  // takes the comparison example's data: holdings, claims, free units, remaining needs and current requests
          const SCEN = {  // SCEN: the three request scenarios the student can switch between
            now: { label: 'What they ask for now', Q: Qnow },  // scenario "now": the requests the processes are really waiting for
            p1: { label: 'P1 asks for the rest of its claim', Q: [need[0], Qnow[1], Qnow[2]] },  // scenario "p1": P1 asks for everything left in its claim, while the others keep their current requests
            all: { label: 'Everyone asks for the rest', Q: need },  // scenario "all": every process asks for everything left in its claim, C − A
          };  // closes SCEN
          let scen = 'now';  // scen: the scenario currently chosen, "now" to start with
          const tbl = (title, M, hl) => h('div', {}, h('div', { class: 'mxcap', html: title }),  // tbl(title, M, hl): one captioned matrix table; hl, when given, picks the cells to highlight
            mtable(ctx, { names, cols: res, cell: (i, j) => ({ text: M[i][j], cls: hl && hl(i, j) ? 'add' : M[i][j] === 0 ? 'zero' : '' }) }));  // highlighted cells take the "add" colour, zeros are grey, everything else plain
          const tables = h('div', { class: 'cmp-tables', style: ctx.narrow ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : {} });  // tables: the row of five tables; on a phone-width screen it switches to two tables per row
          const panels = h('div', { class: 'grid-2', style: { gap: '14px' } });  // panels: the two result cards, side by side
          const narr = h('div', { class: 'narr' });  // narr: the explanation box under the cards
          const traceOf = (run, M) => run.events.map((e) => {  // traceOf(run, M): a one-line summary of one run's moves (M is passed in but not needed)
            if (e.t === 'zero') return e.list.length ? `mark ${list(e.list.map((i) => names[i]))} (holds nothing)` : '';  // a step 1 mark, or an empty piece when nothing was marked
            if (e.t === 'init') return `W = ${vec(e.W)}`;  // the starting W
            if (e.t === 'test') return e.ok ? `<span style="color:var(--ok)">${names[e.i]} ✓</span>` : `<span style="color:var(--bad)">${names[e.i]} ✗ (${res[e.bad]} short)</span>`;  // a test: a green tick, or a red cross naming the resource that is short
            if (e.t === 'mark') return `W = <b>${vec(e.W)}</b>`;  // a mark: the new W
            return '<b>stop</b>';  // the final "nothing fits": stop
          }).filter(Boolean).join(' · ');  // drops empty pieces and joins the rest with dots
          function panel(kind, run, M) {  // panel(kind, run, M): the result card for one of the two tests
            const bank = kind === 'bank';  // bank: true for the banker's card
            const ok = !run.dead.length;  // ok: true when every process was marked
            const verdictTxt = bank ? (ok ? 'SAFE' : 'UNSAFE') : (ok ? 'NO DEADLOCK' : 'DEADLOCK');  // the verdict word: SAFE or UNSAFE for the banker's test, NO DEADLOCK or DEADLOCK for detection
            const detail = ok ? `order: ${[...run.zero, ...run.order].map((i) => names[i]).join(' → ')}` : `${bank ? 'cannot vouch for' : 'deadlocked'}: ${list(run.dead.map((i) => names[i]))}`;  // detail: the finishing order when ok, otherwise the processes the test could not clear
            return h('div', { class: 'card white tight stack', style: { gap: '6px' } },  // the card itself
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // its heading row
                h('b', { html: bank ? '<span class="t" data-t="banker\'s algorithm">Banker\'s</span> safety test' : 'Detection algorithm' }),  // the test's name; the banker's name is tagged as a glossary term
                h('span', { class: 'chip ' + (bank ? 'os' : 'proc') }, bank ? 'compares with C − A' : 'compares with Q')),  // a chip naming what the test compares W with: C − A for the banker's test, Q for detection
              h('div', { class: 'small', style: { lineHeight: 1.5, minHeight: '42px' }, html: traceOf(run, M) }),  // the trace line, with a minimum height so both cards line up
              h('div', { class: 'row gap-s' }, h('span', { class: 'chip ' + (ok ? 'ok' : 'bad'), style: { fontSize: '15px' } }, verdictTxt), h('span', { class: 'small' }, detail)));  // the verdict chip, green or red, and the detail; closes the card
          }  // ends panel
          function draw() {  // draw(): recomputes both tests and redraws for the chosen scenario
            const Q = SCEN[scen].Q;  // Q: the requests in the chosen scenario
            const bank = detect(A, need, V, { zeroRule: false }), det = detect(A, Q, V);  // bank runs the banker's test (detect on C − A, with step 1 off); det runs detection on Q
            tables.replaceChildren(  // replaces the row of tables
              tbl('A · held', A), tbl('<span class="t" data-t="claim matrix">C</span> · max claim', C), tbl('C − A · may still ask', need),  // the A table, the claim matrix C (tagged as a glossary term) and C − A, what each may still ask for
              tbl('Q · asking for now', Q, (i, j) => Q[i][j] !== Qnow[i][j]),  // the Q table, highlighting cells that differ from what the processes ask for now
              h('div', {}, h('div', { class: 'mxcap' }, 'V · free'), h('table', { class: 'tbl compact mx' }, h('thead', {}, h('tr', {}, ...res.map((r) => h('th', {}, r)))), h('tbody', {}, h('tr', {}, ...V.map((x) => h('td', {}, String(x))))))));  // the free vector V as a one-row table; closes the row
            panels.replaceChildren(panel('bank', bank, need), panel('det', det, Q));  // replaces the two result cards
            const dl = list(det.dead.map((i) => names[i]));  // dl: the deadlocked processes written as words
            if (scen === 'now') narr.innerHTML = `The banker's test says <b>unsafe</b>: if every process asked for all it may still claim, no process could be sure to finish, so an avoidance system would never have let the state get here. Detection looks only at what processes are <b>actually</b> waiting for: P1 is running, and its units let P2 and then P3 finish. <b>Unsafe does not mean deadlocked.</b>`;  // explanation for "now": the banker's test says unsafe, yet detection finds no deadlock
            else if (scen === 'p1') narr.innerHTML = `Instead of finishing, P1 now asks for the rest of its claim. The optimistic guess was wrong, and this time it matters: no request fits, so ${dl} are <b>deadlocked</b>. Detection was not mistaken before; it reports the deadlocks that exist, and its next run catches this new one.`;  // explanation for "p1": the optimistic guess failed, so now there is a real deadlock, found on the next run
            else narr.innerHTML = `When every process asks for everything it may still claim, Q equals C − A, and since no process here holds nothing (step 1 marks no one), the two tests make exactly the same moves. The banker's test is the detection algorithm run on the <b>worst case</b>, ahead of time; detection runs on what <b>really</b> happened.`;  // explanation for "all": when Q equals C − A the two tests make the same moves
          }  // ends draw
          const seg = ctx.ui.seg(Object.keys(SCEN).map((k) => ({ value: k, label: SCEN[k].label })), scen, (v) => { scen = v; draw(); });  // seg: the switch between the three scenarios; choosing one redraws
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // the page layout: one column
            h('p', { class: 'm0 small', html: 'Both tests start from what is free and pretend processes finish one at a time. The <span class="t">banker\'s algorithm</span> (avoidance) asks whether each could get <b>everything it may still claim</b>. Detection is <b>optimistic</b>: it asks only about what each is <b>asking for now</b>, and assumes it then finishes without asking for more.' }),  // intro paragraph: both tests pretend processes finish; detection is optimistic because it looks only at current requests
            tables,  // the row of tables
            h('div', { class: 'row' }, h('span', { class: 'small b' }, 'What are the processes asking for?'), seg),  // a small question label with the scenario switch beside it
            panels, narr,  // the two result cards and the explanation box
            h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Treating “unsafe” as “deadlocked”. Unsafe means a deadlock could happen in the worst case; detection reports one only when today\'s requests can never be met.')));  // "Common mistake" box: unsafe is a risk, not a deadlock; closes the layout
          draw();  // draws the starting scenario
        },  // ends render() for step 5
      },  // ends step 5
      {  // step 6 begins: the wait-for graph
        title: 'One unit per resource: hunt for a cycle',  // step 6 title: with one unit per resource, a cycle means deadlock
        kind: 'explore',  // an interactive explore slide
        render(el, ctx) {  // render(el, ctx): builds the graph when step 6 is shown
          const { h, s } = ctx;  // takes the HTML and SVG builders
          const names = ['P1', 'P2', 'P3', 'P4', 'P5'];  // the five processes, one circle each
          const holds = ['R1', 'R2', 'R3, R6', 'R4', 'R5'];  // holds: the single-unit resources each process holds, written beside its circle
          const big = ctx.narrow, FS = big ? 17 : 13;  // big is true on a phone-width screen, where the text is drawn larger (FS is the font size)
          const C0 = [250, 195], RAD = big ? 136 : 150, NR = big ? 31 : 28;  // C0: the centre of the drawing; RAD: how far the circles sit from it; NR: each circle's radius
          const pos = names.map((_, k) => { const a = (-90 + k * 72) * Math.PI / 180; return [C0[0] + RAD * Math.cos(a), C0[1] + RAD * Math.sin(a)]; });  // pos: the circles' centres, five points evenly spaced round a ring, 72 degrees apart, the first at the top
          const holdAt = [[NR + 10, 6, 'start'], [NR + 10, 6, 'start'], [0, NR + 24, 'middle'], [0, NR + 24, 'middle'], [-NR - 10, 6, 'end']];  // holdAt: where each "holds" label sits beside its circle (offset and text alignment): right, below or left, clear of the arrows
          const EDGES = [[0, 1, 'R2'], [1, 2, 'R3'], [2, 0, 'R1'], [2, 3, 'R4'], [3, 4, 'R5'], [4, 2, 'R6'], [4, 0, 'R1']];  // EDGES: every possible arrow as [waiting process, holder, resource], e.g. P1 waits for R2 held by P2
          const START = [true, true, false, true, true, false, false];  // START: which arrows are on at first: a chain of waits with no cycle
          const on = START.slice();  // on: the current on or off state of each arrow, changed by the student
          const svg = s('svg', { viewBox: '0 0 500 372', width: '100%' });  // svg: the drawing of the graph
          const btns = h('div', { class: 'grid-2', style: { gap: '6px' } });  // btns: a grid of buttons, one per arrow, to switch it on or off
          const narr = h('div', { class: 'narr', style: { minHeight: '98px' } });  // narr: the explanation box under the graph
          /* analyse(): strongly connected groups of size > 1 are exactly the processes that lie on a cycle */
          function analyse() {  // analyse(): finds which processes are on a cycle, which are stuck behind one, and lists every cycle
            const n = names.length, adj = names.map(() => []);  // n: the number of processes; adj lists, for each process, the processes it waits for
            EDGES.forEach(([a, b], k) => { if (on[k]) adj[a].push(b); });  // fills adj from the arrows that are switched on
            let idx = 0; const index = Array(n).fill(-1), low = Array(n).fill(0), onSt = Array(n).fill(false), st = [], comp = Array(n).fill(-1), comps = [];  // bookkeeping for the cycle search: visit numbers, lowest reachable numbers, a stack and a group number for each process
            function sc(v) {  // sc(v): a depth-first search (following arrows as far as possible before backing up) that groups processes that can reach each other
              index[v] = low[v] = idx++; st.push(v); onSt[v] = true;  // gives v the next visit number and puts it on the stack
              adj[v].forEach((w) => { if (index[w] < 0) { sc(w); low[v] = Math.min(low[v], low[w]); } else if (onSt[w]) low[v] = Math.min(low[v], index[w]); });  // follows each arrow from v; the lowest visit number reachable from v is passed back up the search
              if (low[v] === index[v]) { const c = []; let w; do { w = st.pop(); onSt[w] = false; comp[w] = comps.length; c.push(w); } while (w !== v); comps.push(c); }  // if nothing reachable leads back above v, v and everything above it on the stack form one group
            }  // ends sc
            for (let v = 0; v < n; v++) if (index[v] < 0) sc(v);  // starts a search from every process not yet visited
            const onCyc = names.map((_, v) => comps[comp[v]].length > 1);  // onCyc: a process lies on a cycle exactly when its group has more than one member
            const reach = (v, seen = new Set()) => { if (onCyc[v]) return true; if (seen.has(v)) return false; seen.add(v); return adj[v].some((w) => reach(w, seen)); };  // reach(v): whether following arrows from v leads into a cycle; seen stops it going round in circles
            const behind = names.map((_, v) => !onCyc[v] && adj[v].length > 0 && reach(v));  // behind: processes not on a cycle that wait on a chain leading into one, so they are stuck too
            const cycles = [];  // cycles: every cycle listed by name, for the explanation
            for (let s0 = 0; s0 < n; s0++) {  // tries each process as the starting point
              const path = [s0];  // path: the chain of processes followed so far
              const dfs = (v) => adj[v].forEach((w) => { if (w === s0) cycles.push(path.slice()); else if (w > s0 && !path.includes(w)) { path.push(w); dfs(w); path.pop(); } });  // following an arrow back to the start records a cycle; only higher-numbered processes are explored, so each cycle is listed once
              dfs(s0);  // starts the search from s0
            }  // ends the loop over starting points
            const cycEdge = EDGES.map(([a, b], k) => on[k] && onCyc[a] && onCyc[b] && comp[a] === comp[b]);  // cycEdge: an arrow is part of a cycle when it is on and both its ends are in the same cycle group
            return { adj, onCyc, behind, cycles, cycEdge };  // returns all the findings
          }  // ends analyse
          function toggle(k) { on[k] = !on[k]; draw(); }  // toggle(k): switches arrow k on or off and redraws
          function draw() {  // draw(): redraws the graph, the buttons and the explanation
            const r = analyse(), kids = [];  // r: the analysis of the current arrows; kids collects the SVG pieces
            EDGES.forEach(([a, b, rn], k) => {  // draws each arrow
              const [x1, y1] = pos[a], [x2, y2] = pos[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;  // the two circle centres, the distance between them and the unit direction from one to the other
              const sx = x1 + ux * (NR + 2), sy = y1 + uy * (NR + 2), ex = x2 - ux * (NR + 6), ey = y2 - uy * (NR + 6);  // the arrow starts just outside the first circle and stops short of the second, leaving room for the arrowhead
              let nx = -uy, ny = ux; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;  // nx, ny: a direction at right angles to the arrow; mx, my: the arrow's midpoint
              if ((mx - C0[0]) * nx + (my - C0[1]) * ny < 0) { nx = -nx; ny = -ny; }  // flips that direction if needed so it points away from the centre of the drawing
              const cls = !on[k] ? 's-muted' : r.cycEdge[k] ? '' : 's-line';  // line style: faint when the arrow is off, red (set just below) when on a cycle, ordinary otherwise
              const sty = !on[k] ? '' : r.cycEdge[k] ? 'stroke:var(--bad)' : '';  // sty: the red stroke for arrows that are part of a cycle
              const g = s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': `${on[k] ? 'Remove' : 'Add'} the wait ${names[a]} to ${names[b]}`, style: 'cursor:pointer' },  // g groups one arrow so it works as a button; its screen-reader label says whether a click adds or removes that wait
                s('line', { x1: sx, y1: sy, x2: ex, y2: ey, stroke: 'transparent', 'stroke-width': 18 }),  // an invisible line 18 units thick along the arrow, so the arrow is easy to click
                s('line', { x1: sx, y1: sy, x2: ex, y2: ey, class: cls, style: sty, 'stroke-width': on[k] ? 3 : 1.5, 'stroke-dasharray': on[k] ? null : '6 5', 'marker-end': on[k] ? (r.cycEdge[k] ? 'url(#arr-bad)' : 'url(#arr)') : 'url(#arr-muted)' }),  // the visible arrow: thick with a red or dark head when on, thin, dashed and pale when off
                s('text', { x: mx + nx * 15, y: my + ny * 15 + 5, 'text-anchor': 'middle', 'font-size': FS, 'font-weight': 700, style: `paint-order:stroke;stroke:var(--panel);stroke-width:4px;${on[k] ? '' : 'fill:var(--muted)'}` }, rn));  // the resource name beside the arrow, pushed 15 units outward; the panel-coloured outline keeps it readable over lines
              g.addEventListener('click', () => toggle(k));  // clicking the arrow switches it
              g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(k); } });  // Enter or Space on a focused arrow does the same, without scrolling the page
              kids.push(g);  // adds the arrow's group to the drawing
            });  // ends the loop over arrows
            names.forEach((nm, v) => {  // draws each process, after the arrows so the circles sit on top
              const [x, y] = pos[v], cls = r.onCyc[v] ? 's-bad' : r.behind[v] ? 's-warn' : r.adj[v].length ? 's-proc' : 's-ok';  // colour: red on a cycle, amber stuck behind one, process colour if waiting, green if not waiting at all
              kids.push(s('circle', { cx: x, cy: y, r: NR, class: cls, 'stroke-width': 2.5 }), s('text', { x, y: y + 7, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': big ? 22 : 18 }, nm));  // the circle and the process name in it, larger on small screens
              kids.push(s('text', { x: x + holdAt[v][0], y: y + holdAt[v][1], 'text-anchor': holdAt[v][2], 'font-size': FS, class: 's-sub' }, 'holds ' + holds[v]));  // the "holds ..." label, placed beside the circle as holdAt says
            });  // ends the loop over processes
            svg.replaceChildren(...kids);  // swaps in the new drawing
            btns.replaceChildren(...EDGES.map(([a, b, rn], k) => h('button', { class: 'btn sm' + (on[k] ? ' on' : ''), type: 'button', 'aria-pressed': String(on[k]), onclick: () => toggle(k) }, `${names[a]} → ${names[b]} (wants ${rn})`)));  // rebuilds the buttons, one per arrow; an arrow that is on gets the "on" look and aria-pressed for screen readers
            const P = (arr) => arr.map((v) => names[v]);  // P(arr): turns process numbers into names
            const cyc = r.onCyc.map((x, v) => (x ? v : -1)).filter((v) => v >= 0), beh = r.behind.map((x, v) => (x ? v : -1)).filter((v) => v >= 0);  // cyc: the processes on a cycle; beh: the processes stuck behind one
            if (!r.cycles.length) {  // when there is no cycle
              narr.className = 'narr ok';  // the explanation box turns green
              narr.innerHTML = '<b>No cycle, so no deadlock.</b> Every chain of waits ends at a process that is not waiting (green). That process will finish and release its resource, and the chain unwinds one link at a time.';  // explains that every chain of waits ends at a process that can finish, so the chain unwinds
            } else {  // otherwise
              narr.className = 'narr bad';  // the explanation box turns red
              narr.innerHTML = `<b>Deadlock.</b> Cycle${r.cycles.length > 1 ? 's' : ''} found: ${list(r.cycles.map((c) => P([...c, c[0]]).join(' → ')))}. ${list(P(cyc))} ${cyc.length > 1 ? 'are' : 'is'} deadlocked: each waits for the next, all the way round.` +  // names each cycle, written as a loop back to where it started, and the processes on it
                (beh.length ? ` ${list(P(beh))} ${beh.length > 1 ? 'wait' : 'waits'} on the cycle without being on it: stuck too, and freed as soon as the cycle is broken.` : '');  // and, if any, the bystanders that wait on the cycle and are freed once it is broken
            }  // ends the explanation
          }  // ends draw
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 10fr) minmax(0, 11fr)', gap: '20px' } },  // the page layout: the graph on the left, text and buttons on the right
            h('div', { class: 'stack', style: { gap: '6px' } },  // left column
              h('div', { class: 'card white tight', style: { padding: '4px 8px' } }, svg),  // a white card holding the graph
              h('div', { class: 'row gap-s xs', style: { justifyContent: 'center' } }, h('span', { class: 'chip ok' }, 'not waiting'), h('span', { class: 'chip proc' }, 'waiting'), h('span', { class: 'chip warn' }, 'stuck behind a cycle'), h('span', { class: 'chip bad' }, 'on a cycle')),  // a colour key for the circles
              h('div', { class: 'callout analogy small m0', 'data-label': 'Try this' }, 'Add P3 → P1 and watch three processes turn red. Remove it and add P5 → P1 instead: one big cycle through all five. Then remove any one red arrow.')),  // "Try this" box: arrows to add and remove to make and break cycles; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column
              h('p', { class: 'm0 small', html: 'When every resource type has exactly <b>one</b> unit, a waiting process can be released only by the single process holding that unit. So drop the resource boxes from the <span class="t">resource allocation graph</span> and draw arrows straight between processes: a <span class="t">wait-for graph</span>, where P<sub>i</sub> → P<sub>j</sub> means “P<sub>i</sub> waits for a resource P<sub>j</sub> holds”. <b>Deadlock exists exactly when this graph has a cycle.</b>' }),  // paragraph: with one unit per resource the boxes can be dropped, giving a wait-for graph; a cycle means deadlock
              h('div', { class: 'small b' }, 'Click an arrow (or a button) to add or remove that wait.'), btns, narr,  // the instruction line, the toggle buttons and the explanation box
              h('div', { class: 'callout tip small m0', 'data-label': 'How the search works' }, 'Follow arrows depth first from each process, remembering the current path. Reaching a process that is already on the path closes a cycle. Each process and arrow is handled once, so the cost grows with the number of arrows (at most about n² for n processes).'))));  // "How the search works" box: following arrows depth first finds cycles at a cost that grows with the arrows; closes the layout
          draw();  // draws the starting graph
        },  // ends render() for step 6
      },  // ends step 6
      {  // step 7 begins: the four ways to recover
        title: 'Four ways to break a deadlock',  // step 7 title
        kind: 'learn',  // kind "learn": labelled "Learn" above the title
        render(el, ctx) {  // render(el, ctx): builds the recovery picker when step 7 is shown
          const { h, s } = ctx;  // takes the HTML and SVG builders
          const OPTS = [  // OPTS: the four recovery strategies, each with what it does, what it needs, its catch, and a caption for the after picture
            { name: 'Abort every deadlocked process', short: 'Abort all',  // strategy 1: abort every deadlocked process
              does: 'Terminate every process in the deadlocked set. All their resources return to the pool and the deadlock vanishes at once.',  // what it does: terminates the whole deadlocked set at once
              needs: 'Nothing special: the OS can always terminate a process.',  // what it needs: nothing special
              cost: 'Everything those processes did is lost and must be redone from the start. Crude, yet it is the most common choice in real operating systems.',  // its catch: all their work is lost, though this is the most common choice in practice
              after: 'all three aborted · R1, R2, R3 free' },  // caption under the after picture for strategy 1
            { name: 'Roll back to checkpoints and restart', short: 'Roll back all',  // strategy 2: roll back to checkpoints and restart
              does: 'Return each deadlocked process to the last <span class="t">checkpoint</span> it saved, and restart it from there.',  // what it does: returns each process to its last saved checkpoint
              needs: 'Checkpoint and <span class="t">rollback</span> support: the system must save each process\'s state from time to time.',  // what it needs: the system must save checkpoints from time to time
              cost: 'Only the work since each checkpoint is lost, but the same deadlock may form again. Usually it does not, because small timing differences on the rerun send the processes down a different path.',  // its catch: the same deadlock may form again, though timing differences usually prevent it
              after: 'all three restart from their checkpoints' },  // caption for strategy 2
            { name: 'Abort one at a time until it is gone', short: 'Abort one by one',  // strategy 3: abort one victim at a time, re-running detection after each
              does: 'Abort the cheapest <span class="t">victim</span> by some criterion, then rerun the detection algorithm. Repeat until no deadlock remains.',  // what it does: removes the cheapest victim, then checks again
              needs: 'A way to rank processes by cost, and a detection run after every abort.',  // what it needs: a way to rank processes, and a detection run after every abort
              cost: 'Several detection runs. The cheapest victim may not sit where it breaks the cycle, so more processes may die than strictly necessary.',  // its catch: several runs, and possibly more victims than strictly needed
              after: 'P2 aborted · rerun detection: no cycle' },  // caption for strategy 3
            { name: 'Preempt resources one at a time', short: 'Preempt one by one',  // strategy 4: take resources away one at a time
              does: '<span class="t">Resource preemption</span>: take one resource at a time away from a victim and give it to a waiting process, rerunning detection after each, until the deadlock is gone.',  // what it does: moves a resource from a victim to a waiting process, checking after each move
              needs: 'The victim must be rolled back to a point before it acquired that resource, and the resource\'s state must be safe to hand over.',  // what it needs: the victim rolled back to before it got the resource, and a resource that is safe to hand over
              cost: 'If the same process is picked every time it may never finish (starvation), so a fair policy counts how often each process has been a victim.',  // its catch: the same victim picked again and again may never finish (starvation), so victim counts are kept
              after: 'R2 moved from P2 to P1 · P2 rolled back' },  // caption for strategy 4
          ];  // closes OPTS
          let cur = 0;  // cur: the strategy currently shown
          const slim = ctx.narrow;  // slim is true on a phone-width screen, where the before and after pictures stack vertically
          const svg = s('svg', { viewBox: slim ? '0 0 290 480' : '0 0 560 232', width: '100%' });  // svg: the before-and-after drawing, tall in the column layout and wide in the row layout
          const info = h('div', { class: 'stack', style: { gap: '6px' } });  // info: the box listing what the strategy does, needs and costs
          const title = h('div', { class: 'b', style: { fontSize: '18px' } });  // title: the strategy's name in bold
          const P3 = [[0, 0], [72, 118], [-72, 118]];  // P3: where the three processes sit in a triangle: one at the top, two below to the right and left
          /* tri(ox, oy, nodes, edges, cap, capCls): three processes in a triangle; nodes[k] = { cls, mark }, edges = [from, to, label, cls] */
          function tri(ox, oy, nodes, edges, cap, capCls) {  // tri(ox, oy, nodes, edges, cap, capCls): draws three processes in a triangle with arrows and a caption, centred at ox
            const kids = [], at = (k) => [ox + P3[k][0], oy + 46 + P3[k][1]];  // kids collects the pieces; at(k) gives the centre of process k
            edges.forEach(([a, b, lab, cls]) => {  // draws each arrow
              const [x1, y1] = at(a), [x2, y2] = at(b), L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;  // the two centres, the distance between them and the unit direction
              kids.push(s('line', { x1: x1 + ux * 27, y1: y1 + uy * 27, x2: x2 - ux * 32, y2: y2 - uy * 32, style: `stroke:var(--${cls})`, 'stroke-width': 2.5, 'marker-end': cls === 'ink' ? 'url(#arr)' : `url(#arr-${cls})` }));  // the line runs from just outside one circle to just short of the other, in the arrow's colour with a matching arrowhead (dark ink uses the default one)
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, side = mx < ox - 5 ? -1 : mx > ox + 5 ? 1 : 0;  // the arrow's midpoint, and which side of the triangle it is on (left, right, or the bottom edge)
              kids.push(s('text', { x: mx + side * 14, y: side ? my : my + 22, 'text-anchor': side < 0 ? 'end' : side > 0 ? 'start' : 'middle', 'font-size': 13, class: 's-sub' }, lab));  // the arrow's label: outward to the left or right, or under the bottom edge
            });  // ends the loop over arrows
            nodes.forEach((nd, k) => {  // draws each process
              const [x, y] = at(k);  // its centre
              kids.push(s('circle', { cx: x, cy: y, r: 24, class: nd.cls, 'stroke-width': 2.5, opacity: nd.fade ? 0.45 : 1 }), s('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, 'P' + (k + 1)));  // the circle (faded for a process that is gone) and its name P1, P2 or P3
              if (nd.mark) kids.push(s('text', { x: x + 22, y: y - 14, 'font-size': 18, 'font-weight': 900, style: `fill:var(--${nd.markCls || 'bad'})` }, nd.mark));  // an optional mark at its top right, such as a cross for aborted or a circular arrow for restarted, red unless told otherwise
            });  // ends the loop over processes
            kids.push(s('text', { x: ox, y: oy + 226, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, style: capCls ? `fill:var(--${capCls})` : '' }, cap));  // the caption under the triangle, coloured when a colour is given
            return kids;  // hands the pieces back
          }  // ends tri
          const CYC = [[0, 1, 'wants R2', 'bad'], [1, 2, 'wants R3', 'bad'], [2, 0, 'wants R1', 'bad']];  // CYC: the "before" picture: P1, P2 and P3 each waiting for the next, in a red cycle
          const AFTER = [  // AFTER: the "after" picture for each strategy, in the same order as OPTS
            { nodes: [0, 1, 2].map(() => ({ cls: 's-muted', fade: true, mark: '✗' })), edges: [] },  // abort all: three faded processes marked with a cross, and no arrows left
            { nodes: [0, 1, 2].map(() => ({ cls: 's-proc', mark: '↺', markCls: 'os' })), edges: [] },  // roll back: three processes with a restart mark, and no arrows
            { nodes: [{ cls: 's-ok' }, { cls: 's-muted', fade: true, mark: '✗' }, { cls: 's-proc' }], edges: [[2, 0, 'wants R1', 'line']] },  // abort one by one: P2 aborted, P1 can now run (green), and P3 just waits for P1
            { nodes: [{ cls: 's-ok' }, { cls: 's-proc', mark: '↺', markCls: 'os' }, { cls: 's-proc' }], edges: [[1, 0, 'wants R2', 'line'], [2, 0, 'wants R1', 'line']] },  // preempt: P1 runs with R2 (green), P2 is rolled back and waits for R2, P3 waits for R1, with no cycle
          ];  // closes AFTER
          function draw() {  // draw(): redraws the pictures and the text for the chosen strategy
            const o = OPTS[cur], a = AFTER[cur];  // o: the chosen strategy; a: its after picture
            const G = slim ? { bx: 145, ax: 145, ay: 244, sep: [10, 240, 280, 240] } : { bx: 140, ax: 420, ay: 0, sep: [280, 24, 280, 206] };  // G: positions for the layout: centres of the before and after pictures, and the dividing line between them
            svg.replaceChildren(  // replaces the drawing
              s('text', { x: G.bx, y: 16, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'Before'),  // the "Before" heading
              s('text', { x: G.ax, y: G.ay + 16, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'After'),  // the "After" heading
              s('line', { x1: G.sep[0], y1: G.sep[1], x2: G.sep[2], y2: G.sep[3], class: 's-muted', 'stroke-dasharray': '4 5' }),  // a faint dashed line separating the two pictures
              ...tri(G.bx, 0, [0, 1, 2].map(() => ({ cls: 's-bad' })), CYC, 'a circular wait: P1 → P2 → P3 → P1', 'bad'),  // the before picture: all three processes red, in the cycle, with its caption in red
              ...tri(G.ax, G.ay, a.nodes, a.edges.map((e) => (e[3] === 'line' ? [e[0], e[1], e[2], 'ink'] : e)), o.after, 'ok'));  // the after picture for the chosen strategy, with ordinary waits drawn in dark ink and the caption in green
            title.textContent = `${cur + 1} · ${o.name}`;  // the card title: the strategy's number and name
            const row = (lab, txt, cls) => h('div', { class: 'row nw', style: { alignItems: 'flex-start', gap: '10px' } }, h('span', { class: 'chip ' + cls, style: { minWidth: '92px', justifyContent: 'center' } }, lab), h('span', { style: { fontSize: '15px', lineHeight: 1.4 }, html: txt }));  // row(lab, txt, cls): one line of the info box, a coloured label chip and its text
            info.replaceChildren(row('What it does', o.does, 'os'), row('What it needs', o.needs, 'proc'), row('The catch', o.cost, 'warn'));  // fills the info box: what the strategy does, what it needs, and its catch
            btns.forEach((b, k) => b.classList.toggle('on', k === cur));  // highlights the button of the chosen strategy
          }  // ends draw
          const btns = OPTS.map((o, k) => h('button', { class: 'btn', type: 'button', style: { justifyContent: 'flex-start', height: 'auto', padding: '7px 12px', whiteSpace: 'normal', textAlign: 'left' }, onclick: () => { cur = k; draw(); } },  // btns: one large button per strategy; clicking it shows that strategy
            h('span', { class: 'chip accent' }, String(k + 1)), h('span', {}, o.name)));  // each button shows the strategy's number in a chip and then its name
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 8fr)', gap: '22px' } },  // the page layout: buttons on the left, the picture card on the right
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column
              h('p', { class: 'm0', html: 'Once detection names the deadlocked processes, the OS has to break the cycle. That is <span class="t">deadlock recovery</span>. The options run from the crudest to the most refined:' }),  // intro paragraph: recovery breaks the cycle; the options run from crude to refined
              ...btns,  // the four strategy buttons
              h('div', { class: 'xs muted', style: { textAlign: 'center' } }, '↑ crude, cheap to build · refined, more machinery ↓'),  // a small note on the scale: the top options are crude and cheap to build, the bottom ones more refined
              h('div', { class: 'callout why small m0', 'data-label': 'In practice' }, 'Most operating systems simply abort. Rolling back is common in database systems, which already log their work and can undo a transaction.'),  // "In practice" box: most systems simply abort; databases often roll back
              h('div', { class: 'card tight small', style: { lineHeight: 1.45 } }, h('b', {}, 'Picking a victim (options 3 and 4). '), 'Usual criteria: least processor time used so far, least output produced so far, most estimated time remaining, fewest resources held, lowest priority. The next step lets you try each one.')),  // a card listing the usual victim-selection criteria, which the next step lets the student try; closes the left column
            h('div', { class: 'card white stack', style: { gap: '8px' } }, title, svg, info)));  // right column: a white card with the title, the before-and-after drawing and the info box; closes the layout
          draw();  // draws the first strategy
        },  // ends render() for step 7
      },  // ends step 7
      {  // step 8 begins: the recovery lab
        title: 'Recovery lab: choose the victims, count the cost',  // step 8 title
        kind: 'lab',  // a hands-on lab slide
        core: true,  // core: true keeps the lab on the shorter core route
        render(el, ctx) {  // render(el, ctx): builds the lab when step 8 is shown
          const { h } = ctx;  // takes the HTML builder
          const { names, res } = LAB;  // the lab's process and resource names
          const STRAT = { all: 'Abort all', roll: 'Roll back all', one: 'One at a time' };  // STRAT: display names for the three recovery strategies
          let strategy = 'one', crit = 'cpu', st = labState(), gen = 0, busy = false;  // starting settings: one at a time, least CPU first, a fresh lab; gen counts runs (to cancel old animations); busy is true while one plays
          const rows = {};  // rows: the results of finished runs, keyed by strategy or criterion, for the comparison table
          const cards = h('div', { class: 'grid-4', style: { gap: '10px' } });  // cards: a row of four process cards
          const narr = h('div', { class: 'narr', style: { minHeight: '92px' } });  // narr: the explanation of the latest move
          const tally = h('div', { class: 'row gap-s' });  // tally: chips counting what is deadlocked, how many victims, and what was lost
          const critCard = h('div', { class: 'card tight small', style: { lineHeight: 1.45, minHeight: '96px' } });  // critCard: a card explaining the chosen criterion or strategy
          const tbody = h('tbody');  // tbody: the body of the comparison table
          const goBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => step() });  // goBtn: the main action button; its label depends on the strategy
          const runBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => runToEnd() }, '▶ Run to the end');  // runBtn: plays a one-at-a-time run through to the end
          const P = (arr) => arr.map((i) => names[i]);  // P(arr): turns process numbers into names
          const vic = (arr) => (arr.length === names.length ? 'all four' : P(arr).join(', '));  // vic(arr): the victims as text, or "all four" when every process was a victim
          const units = (i) => list(LAB.A[i].map((x, j) => (x ? `${x} × ${res[j]}` : null)).filter(Boolean));  // units(i): what process i holds, in words, e.g. "1 × R1 and 2 × R5"
          const metric = { cpu: ['CPU used (s)', 'CPU used', ' s'], out: ['Output (lines)', 'output', ' lines'], left: ['Time left (s)', 'time left', ' s'], held: ['Holds (units)', 'holds', ' units'], prio: ['Priority', 'priority', ''], ckpt: ['Unsaved work (s)', 'unsaved work', ' s'] };  // metric: the rows of each card's table: [table label, short name, unit] for each number the criteria use
          function status(i) {  // status(i): process i's status text and colour
            if (st.rolled && st.victims.includes(i)) return ['rolled back', 'os'];  // rolled back, if a rollback included it
            if (st.gone[i]) return ['aborted', ''];  // aborted, if it has been removed
            if (st.dead.includes(i)) return ['deadlocked', 'bad'];  // deadlocked, if detection still reports it
            return ['can finish', 'ok'];  // otherwise it can finish
          }  // ends status
          function draw() {  // draw(): redraws the cards, the tally, the buttons, the criterion card and the comparison table
            const hl = strategy === 'one' && crit !== 'you' ? CRIT[crit].key : strategy === 'roll' ? 'ckpt' : null;  // hl: the card row to highlight: the chosen criterion in automatic one-at-a-time mode, unsaved work for a rollback
            cards.replaceChildren(...names.map((nm, i) => {  // rebuilds the four process cards
              const [stt, cls] = status(i), gone = st.gone[i];  // this process's status, colour, and whether it is gone
              const j = LAB.Q[i].findIndex((x) => x > 0), holder = names.find((_, k) => k !== i && !st.gone[k] && LAB.A[k][j] > 0);  // j: the resource it waits for; holder: a remaining process holding a unit of it
              return h('div', { class: 'pc' + (gone ? ' gone' : '') + (cls === 'bad' ? ' dl' : '') },  // the card, faded when aborted and red when deadlocked
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, nm), h('span', { class: 'chip ' + cls }, stt)),  // the card's top line: the process name and its status chip
                h('table', { class: 'pst' }, h('tbody', {}, ...Object.keys(metric).map((k) => h('tr', { class: k === hl ? 'on' : '' }, h('td', {}, metric[k][0]), h('td', {}, String(LAB[k][i])))))),  // the table of its numbers, with the criterion in use highlighted
                h('div', { class: 'xs', style: { minHeight: '17px' } }, gone ? 'resources returned' : st.dead.includes(i) ? `waits for ${res[j]}${holder ? ' (' + holder + ')' : ''}` : 'can get what it needs'),  // a line saying its resources were returned, what it waits for and who holds it, or that it can get what it needs
                strategy === 'one' && crit === 'you' ? h('button', { class: 'btn sm', type: 'button', disabled: busy || !st.dead.includes(i), onclick: () => abort(i, null) }, 'Abort ' + nm) : null);  // in "you pick" mode each card gets an Abort button, usable only while it is deadlocked and nothing is playing
            }));  // ends the card and the list of cards
            tally.replaceChildren(h('span', { class: 'chip ' + (st.done ? 'ok' : 'bad') }, st.done ? 'deadlock gone' : `${st.dead.length} deadlocked`),  // tally chips: "deadlock gone" or how many are still deadlocked
              h('span', { class: 'chip' }, `${st.victims.length} ${st.rolled ? 'rolled back' : 'aborted'}`), h('span', { class: 'chip warn' }, `CPU lost: ${st.lostCpu} s`), h('span', { class: 'chip warn' }, `output lost: ${st.lostOut} lines`));  // then how many victims, and the processor time and output lost
            goBtn.textContent = strategy === 'all' ? 'Abort all deadlocked' : strategy === 'roll' ? 'Roll back all deadlocked' : 'Next victim';  // the main button's label for the chosen strategy
            goBtn.disabled = st.done || busy;  // it is disabled once the deadlock is gone or while a run plays
            goBtn.style.display = strategy === 'one' && crit === 'you' ? 'none' : '';  // it is hidden in "you pick" mode, where the Abort buttons on the cards are used instead
            runBtn.disabled = st.done || busy || strategy !== 'one' || crit === 'you';  // the run-to-the-end button works only in automatic one-at-a-time mode, while something is left to do
            runBtn.style.display = strategy === 'one' && crit !== 'you' ? '' : 'none';  // and is shown only in that mode
            if (strategy === 'one' && crit !== 'you') { const c = CRIT[crit]; critCard.innerHTML = `<b>${c.long}.</b> ${c.rule} ${c.why}`; }  // criterion card for an automatic criterion: its full name, its rule and why it makes sense
            else if (strategy === 'one') critCard.innerHTML = '<b>You pick.</b> Click <b>Abort</b> on any deadlocked process. Detection re-runs after each abort. Can you break the deadlock while losing as little processor time as possible?';  // criterion card for "you pick": the challenge to break the deadlock losing as little processor time as possible
            else if (strategy === 'all') critCard.innerHTML = '<b>Abort all.</b> Every deadlocked process is terminated at once. Simple and certain, but every second of their work is lost.';  // criterion card for abort all
            else critCard.innerHTML = '<b>Roll back all.</b> Every deadlocked process restarts from its last <span class="t">checkpoint</span>, so only its unsaved work (done since then) is lost. The same deadlock might form again on the rerun.';  // criterion card for roll back all
            const order = ['all', 'roll', 'cpu', 'out', 'left', 'held', 'prio', 'you'];  // order: the fixed row order of the comparison table
            const best = Math.min(...Object.values(rows).map((r) => r.cpu));  // best: the smallest processor time lost among the finished runs
            tbody.replaceChildren(...order.filter((k) => rows[k]).map((k) => { const r = rows[k]; return h('tr', { class: r.cpu === best ? 'on' : '' }, h('td', {}, r.label), h('td', {}, r.victims), h('td', { class: 'mono' }, r.cpu + ' s'), h('td', { class: 'mono' }, r.out + ' lines')); }));  // one table row per finished run, in that order; the cheapest is highlighted
            if (!tbody.children.length) tbody.append(h('tr', {}, h('td', { colspan: 4, class: 'muted' }, 'Finish a run, or fill in every strategy.')));  // until a run finishes, a single placeholder row asks for one
          }  // ends draw
          function record() {  // record(): saves the finished run's result into rows for the comparison table
            const key = strategy === 'one' ? crit : strategy;  // key: the criterion for one-at-a-time runs, otherwise the strategy
            const label = strategy === 'one' ? (crit === 'you' ? 'Your choice' : CRIT[crit].label) : STRAT[strategy];  // label: the row's name in the table
            rows[key] = { label, victims: vic(st.victims), cpu: st.lostCpu, out: st.lostOut };  // stores the victims and the losses
          }  // ends record
          function abort(i, why) {  // abort(i, why): aborts process i and explains the result; why is an optional opening sentence
            const before = st.dead.slice(), r = labAbort(st, [i]);  // before: who was deadlocked; r: the result of the abort, including who was freed
            narr.className = 'narr' + (st.done ? ' ok' : '');  // the explanation turns green once the deadlock is gone
            narr.innerHTML = `${why || `You abort <b>${names[i]}</b>.`} Its ${units(i)} return to the pool, so V = ${vec(st.V)}. Detection runs again: ` +  // says what the victim's units add to the pool and that detection runs again
              (r.freed.length ? `${list(P(r.freed))} can now finish` : 'nobody new can finish') +  // then who can now finish, if anyone
              (st.done ? `. <b>The deadlock is gone</b> after ${st.victims.length} abort${st.victims.length > 1 ? 's' : ''}, losing ${st.lostCpu} s of processor time.` : `; ${list(P(st.dead))} ${st.dead.length > 1 ? 'are' : 'is'} still deadlocked.`);  // then either that the deadlock is gone and what it cost, or who is still deadlocked
            if (before.length && st.done) record();  // a run that ends the deadlock is recorded for the comparison table
            draw();  // redraws the lab
          }  // ends abort
          function step() {  // step(): what the main button does
            if (st.done) return;  // nothing to do once the deadlock is gone
            if (strategy === 'all') {  // abort all
              const v = st.dead.slice(); labAbort(st, v); record();  // aborts every deadlocked process at once and records the run
              narr.className = 'narr ok'; narr.innerHTML = `All ${v.length} deadlocked processes are aborted at once and every resource returns to the pool. Certain and simple, but ${st.lostCpu} s of processor time and ${st.lostOut} lines of output are thrown away.`;  // explains that everything returns to the pool, and what was lost
            } else if (strategy === 'roll') {  // roll back all
              labRollback(st); record();  // rolls every deadlocked process back and records the run
              narr.className = 'narr ok'; narr.innerHTML = `Each process returns to its last checkpoint and restarts. Only the work done since then is lost: ${st.lostCpu} s and ${st.lostOut} lines. The rerun will probably take a different timing path, but the same deadlock <b>could</b> form again.`;  // explains that only unsaved work is lost, and that the deadlock could form again
            } else {  // one at a time with an automatic criterion
              const c = CRIT[crit], i = labPick(st, crit), others = st.dead.filter((k) => k !== i);  // c: the criterion; i: the victim it picks; others: the rest of the deadlocked processes
              abort(i, `<b>${c.label}</b> picks <b>${names[i]}</b> (${metric[c.key][1]} ${LAB[c.key][i]}${metric[c.key][2]}${others.length ? `; ${others.map((k) => names[k] + ' ' + LAB[c.key][k]).join(', ')}` : ''}) and aborts it.`);  // aborts that victim, with an opening sentence giving the criterion, the victim's value and the other candidates' values
              return;  // abort() has already redrawn, so step stops here
            }  // ends the one-at-a-time case
            draw();  // redraws after abort all or roll back all
          }  // ends step
          async function runToEnd() {  // runToEnd(): presses Next victim again and again, with a pause between moves, until the deadlock is gone
            const g = ++gen; busy = true; draw();  // g: this run's number; gen goes up so any older run stops itself; busy disables the buttons while it plays
            while (!st.done) {  // repeats while anyone is deadlocked
              step(); busy = !st.done; draw();  // makes one move; busy stays true unless that move finished the run
              if (st.done) break;  // stops at once when the deadlock is gone
              await ctx.sleep(1400);  // waits 1.4 seconds so the student can read the result (ctx.sleep pauses without freezing the page)
              if (!ctx.alive || g !== gen) return;  // quits if the student left the slide or a reset or newer run replaced this one
            }  // ends the loop
            busy = false; draw();  // the run is over: the buttons come back
          }  // ends runToEnd
          function reset(msg) {  // reset(msg): starts the lab again from the fully deadlocked state, with an optional message
            gen++; busy = false; st = labState();  // gen goes up so any playing run stops; nothing is busy; a fresh lab state
            narr.className = 'narr';  // the explanation box goes back to its neutral colour
            narr.innerHTML = msg || 'All four processes are deadlocked: P1 and P2 wait for each other, P4 waits for P2, and P3 waits for P4. Pick a strategy, then press the button to recover. After every abort, detection re-runs on the processes that remain to decide who is still deadlocked.';  // shows msg, or the default description of who waits for whom and what to do
            draw();  // redraws everything
          }  // ends reset
          const critSeg = ctx.ui.seg([...Object.keys(CRIT).map((k) => ({ value: k, label: CRIT[k].label })), { value: 'you', label: 'You pick' }], crit, (v) => { crit = v; reset(); });  // critSeg: a switch for the victim criterion, the five from CRIT plus "You pick"; changing it restarts the lab
          const stratSeg = ctx.ui.seg(Object.keys(STRAT).map((k) => ({ value: k, label: STRAT[k] })), strategy, (v) => { strategy = v; critSeg.style.display = v === 'one' ? '' : 'none'; reset(); });  // stratSeg: a switch for the strategy; the criterion switch shows only for one at a time; changing it restarts the lab
          const fill = h('button', { class: 'btn sm', type: 'button', onclick: () => {  // fill: a button that runs every strategy and criterion without animation and fills the whole comparison table
            ['all', 'roll'].forEach((k) => { const r = labRun(k); rows[k] = { label: STRAT[k], victims: vic(r.victims), cpu: r.lostCpu, out: r.lostOut }; });  // runs abort all and roll back all, and stores their results
            Object.keys(CRIT).forEach((k) => { const r = labRun('one', k); rows[k] = { label: CRIT[k].label, victims: vic(r.victims), cpu: r.lostCpu, out: r.lostOut }; });  // runs one at a time with each of the five criteria, and stores their results
            draw();  // redraws so the table shows them
          } }, 'Fill in every strategy');  // ends the fill button's click handler and names the button
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '18px' } },  // the page layout: the lab on the left (wider), explanation and comparison on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Strategy'), stratSeg),  // a row with the "Strategy" label and the strategy switch
              critSeg, cards, narr,  // the criterion switch, the process cards and the explanation box
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'row gap-s' }, goBtn, runBtn, h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset')), tally)),  // a bottom row: the action buttons and Reset on the left, the tally chips on the right; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column
              critCard,  // the criterion card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Compare strategies'), fill),  // a heading row: "Compare strategies" and the fill button
              h('table', { class: 'tbl compact cmp' }, h('thead', {}, h('tr', {}, h('th', {}, 'Strategy'), h('th', {}, 'Victims'), h('th', {}, 'CPU lost'), h('th', {}, 'Output lost'))), tbody),  // the comparison table with its four column headings and the body filled by draw()
              h('p', { class: 'xs muted m0' }, 'Highlighted: least processor time lost. Rolling back loses only unsaved work, but it needs checkpoints and the deadlock may form again.'))));  // a note under the table: the highlight marks the least processor time lost, and the catch with rolling back; closes the layout
          reset();  // sets up the lab for the first time
        },  // ends render() for step 8
      },  // ends step 8
      {  // step 9 begins: the recap
        title: 'Recap: eight things to remember',  // step 9 title
        kind: 'recap',  // kind "recap": labelled "Recap" above the title
        render(el, ctx) {  // render(el, ctx): builds the recap cards
          const { h } = ctx;  // takes the HTML builder
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // a single column for the page
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // the instruction to answer each card aloud before turning it over
            ctx.ui.flipcards([  // ctx.ui.flipcards: the shell's grid of cards that turn over when clicked; each entry is [front, back]
              ['Detection\'s bargain', 'Grant every request that can be granted, look for deadlock now and then, and recover when one is found. No limits and no advance knowledge of needs.'],  // card: detection's bargain, no limits now and recovery later
              ['How often to check?', 'At every request: caught at once by a simple incremental check, but it costs time on every request. Less often (timer, quiet CPU): cheaper, but deadlocks sit unnoticed longer.'],  // card: how often to check and the cost on each side
              ['A, Q, V and W', 'A: units each process holds. Q: units each is waiting for. V: units free now. W: a scratch copy of V that grows as processes are marked.'],  // card: what A, Q, V and W mean
              ['The four steps', '1 mark every all-zero row of A. 2 W = V. 3 find an unmarked i with Q row ≤ W; if none, stop. 4 mark i, add its A row to W, back to 3. Unmarked = deadlocked.'],  // card: the four steps of the algorithm in short form
              ['Versus the banker\'s test', 'The banker\'s test uses C − A (the worst case) before granting. Detection uses Q (what is asked now) and assumes a satisfied process finishes: it is optimistic.'],  // card: how detection differs from the banker's safety test
              ['One unit per type', 'Draw a wait-for graph: Pi → Pj when Pi waits for what Pj holds. A cycle means deadlock; a depth-first search finds it.'],  // card: the wait-for graph for single-unit resources
              ['Recovery, crude to refined', 'Abort all (most common). Roll back to checkpoints. Abort one at a time, rerunning detection. Preempt resources one at a time, rolling the victim back.'],  // card: the four recovery strategies from crude to refined
              ['Choosing a victim', 'Least CPU used, least output, most time left, fewest resources held, lowest priority. No single criterion wins on every cost.'],  // card: the usual victim criteria, none of which wins on every cost
            ], { cols: 4, height: 190 }),  // closes the card list; the cards sit in four columns, each at least 190 pixels tall
            h('div', { class: 'callout warn m0', 'data-label': 'The two classic traps' }, 'Calling an unsafe state deadlocked (unsafe is only a risk), and forgetting that a process holding nothing is marked in step 1 even while it waits.')));  // warning box: the two classic mistakes, unsafe versus deadlocked and the step 1 rule; closes the page
        },  // ends render() for step 9
      },  // ends step 9
      {  // step 10 begins: the section quiz
        title: 'Check yourself',  // step 10 title
        kind: 'check',  // kind "check": labelled "Check Yourself" above the title
        quiz: [  // quiz: the questions; the shell's quiz engine shows them one at a time and scores them
          { q: 'An operating system handles deadlock by detection. A process asks for two units of a resource, and three units are free. What does the OS do?',  // question 1 (multiple choice): what the OS does with a request whose units are free
            choices: ['First checks whether the resulting state would be safe', 'Refuses unless the process has declared its maximum needs', 'Grants the two units immediately', 'Runs the detection algorithm before deciding'], answer: 2,  // choices: three distractors drawn from avoidance and one correct answer, granting at once (answer: 2, counting from 0)
            feedback: ['Checking for a safe state before granting is avoidance (the banker\'s algorithm), not detection.', 'Declared maximum claims are an avoidance requirement. Detection needs no advance information about future needs.', null, 'Detection runs separately, every so often; it never holds up a request that can be granted.'],  // feedback for each wrong pick, explaining which idea it mixes up; null for the right answer
            why: 'Detection puts no limits on requests: if the units are free, they are granted. The OS looks for deadlocks later and recovers if it finds one.' },  // explanation shown after the question: detection never limits a request that can be granted
          { type: 'multi', q: 'Which statements about running the detection algorithm at <b>every</b> resource request are true?',  // question 2 (select all): the facts about checking at every request
            choices: ['A deadlock is caught by the very request that creates it', 'The check can be incremental, which keeps the algorithm simple', 'It costs processor time on every request', 'It requires every process to declare its maximum claim', 'A deadlock can sit unnoticed until the next timer tick'], answer: [0, 1, 2],  // choices: three true (instant, incremental, costly) and two that belong to avoidance or to timer checks
            why: 'Checking at each request finds a deadlock as soon as it forms, and since only one request changed the state, the check can be incremental. The price is work on every request. Maximum claims belong to avoidance, and timer delays belong to periodic checking.' },  // explanation: why the first three hold and where the other two belong
          { type: 'order', q: 'Put the steps of the deadlock detection algorithm in order.',  // question 3 (put in order): the steps of the detection algorithm
            items: ['Mark every process whose row of the allocation matrix is all zeros', 'Set a temporary vector W equal to the available vector V', 'Find an unmarked process whose row of the request matrix is ≤ W; if there is none, stop', 'Mark that process, add its row of the allocation matrix to W, and search again', 'Report every process that is still unmarked as deadlocked'],  // the five steps, listed here in their correct order (the quiz shuffles them)
            why: 'Processes holding nothing are marked first. W starts as the free units, grows each time a process is marked (it is assumed to finish and release what it holds), and whoever is left unmarked when no request fits is deadlocked.' },  // explanation: how W grows and why the leftovers are deadlocked
          { type: 'num', q: 'The detection algorithm runs on this state (four processes, three resource types). How many processes are deadlocked?', code: QZ.code, answer: QZ.run.dead.length, tol: 0,  // question 4 (calculate): how many processes are deadlocked in the QZ state, printed as a code block; the answer is computed
            hint: 'Mark rows of A that are all zeros first. Then repeatedly find a row of Q that fits in W.',  // hint: start with the all-zero rows of A, then look for requests that fit
            why: `P4 holds nothing and is marked in step 1. W = ${vec(QZ.V)}. P3 asks for nothing, so it is marked and W becomes ${vec(QZ.run.W)}. Neither P1 (needs R2) nor P2 (needs R1) fits, so ${QZ.run.dead.length} processes, ${list(QZ.run.dead.map((i) => QZ.names[i]))}, are deadlocked: each waits for what the other holds.` },  // explanation: the full trace, with the numbers filled in from the real run
          { type: 'tf', q: 'When the deadlock detection algorithm stops, the processes left unmarked are exactly the deadlocked processes.', answer: true,  // question 5 (true or false): unmarked processes are exactly the deadlocked ones
            why: 'Every marked process can be shown to finish in some order. A process left unmarked waits for units that no sequence of finishing processes can ever free, so it is deadlocked.' },  // explanation: marked processes can finish in some order; unmarked ones can never be freed
          { type: 'tf', q: 'If the banker\'s safety test calls a state unsafe, the detection algorithm will report a deadlock in that same state.', answer: false,  // question 6 (true or false): an unsafe state always contains a deadlock (false)
            why: 'Unsafe only means a deadlock could happen if processes asked for everything they may still claim. Detection looks only at the requests that exist now, and in an unsafe state it may still find that every process can finish.' },  // explanation: unsafe is only a worst-case risk
          { q: 'Why is the deadlock detection algorithm called <b>optimistic</b>?',  // question 7 (multiple choice): why detection is called optimistic
            choices: ['It assumes any process whose current request fits will finish without asking for more', 'It assumes deadlocks are impossible, so it can never report a deadlocked process', 'It grants requests even when the units are not free, expecting them to be freed soon', 'It assumes every process will soon ask for its whole maximum claim before it finishes'], answer: 0,  // choices: the right answer first, then three wrong assumptions
            feedback: [null, 'It does find deadlocks; that is its whole job.', 'No algorithm can hand out units that are not free; a process that cannot be served waits.', 'That is the pessimistic assumption of the banker\'s safety test.'],  // feedback for each wrong pick, including that full claims are the banker's pessimistic view
            why: 'When a request fits in W, the algorithm marks the process and adds everything it holds to W, as if it will run to completion. If the process later asks for more, any new deadlock is caught by a later run.' },  // explanation: a process that fits is treated as if it runs to completion
          { q: 'Every resource type in a system has exactly one unit. Which finding proves that a deadlock exists?',  // question 8 (multiple choice): what proves a deadlock when every resource has one unit
            choices: ['A process with two outgoing arrows in the wait-for graph', 'A process with no outgoing arrows', 'More arrows than processes', 'A cycle in the wait-for graph'], answer: 3,  // choices: three patterns that do not prove deadlock, and a cycle
            feedback: ['A process can wait for two resources at once without any cycle; it is released when both holders finish.', 'A process with no outgoing arrow is not waiting at all.', 'Many arrows can still form chains that end at a running process, with no cycle.', null],  // feedback for each wrong pick, explaining why it is not enough
            why: 'With one unit per type, Pi → Pj means only Pj can release what Pi needs. A cycle is a closed loop of such waits, so nobody in it can ever proceed.' },  // explanation: a cycle is a closed loop of waits that only its own members could release
          { type: 'match', q: 'Match each recovery strategy to the description that fits it.',  // question 9 (match): each recovery strategy with its description
            pairs: [['Abort all deadlocked processes', 'The simplest and most common choice; all their work is lost'], ['Roll back to checkpoints and restart', 'Needs saved states, and the same deadlock may form again'], ['Abort processes one at a time', 'Reruns the detection algorithm after each abort'], ['Preempt resources one at a time', 'The victim is rolled back to before it acquired the resource']],  // the four strategy and description pairs
            why: 'The strategies run from crude to refined: abort everyone, roll everyone back, abort the cheapest victims one by one, or take resources away one by one.' },  // explanation: the strategies run from crude to refined
          { type: 'bucket', q: 'Choosing a victim: for each measure, does the usual criterion pick the process with the smallest value or the largest?', buckets: ['Pick the smallest', 'Pick the largest'],  // question 10 (sort into groups): whether each victim criterion picks the smallest or the largest value
            items: [['Processor time consumed so far', 0], ['Output produced so far', 0], ['Estimated time remaining', 1], ['Resources allocated so far', 0], ['Priority', 0]],  // the five measures with their correct group (0 = smallest, 1 = largest)
            why: 'The aim is to lose the least: least computing time, least output, fewest resources, lowest priority. Time remaining is the exception: pick the process furthest from finishing, so nearly-done work is spared.' },  // explanation: lose the least; time remaining is the exception
          { type: 'num', q: `One full run of the detection algorithm costs ${OVH.costMs} ms of processor time. The OS runs it once every ${OVH.everyS} seconds. What percentage of the processor's time goes to detection?`, answer: OVH.pct, tol: 0.01, unit: '%',  // question 11 (calculate): the share of processor time spent on detection, from the OVH numbers; within 0.01 percent
            why: `${OVH.costMs} ms out of every ${OVH.everyS * 1000} ms is ${OVH.costMs} / ${OVH.everyS * 1000} = ${OVH.pct / 100}, which is ${OVH.pct}%. Checking less often lowers this cost, but a deadlock then waits up to ${OVH.everyS} s to be found.` },  // explanation: the division worked through, plus the trade-off with how long a deadlock waits
          { q: 'Recovery by aborting deadlocked processes one at a time: why does the OS rerun the detection algorithm after each abort?',  // question 12 (multiple choice): why detection re-runs after each abort
            choices: ['To restart the aborted process from its most recent saved checkpoint', 'To find out whether the deadlock is gone or another victim is needed', 'To recompute each remaining process\'s maximum claim after the abort', 'To give the aborted process its resources back once the others finish'], answer: 1,  // choices: three wrong reasons and the right one, to see whether the deadlock is gone
            feedback: ['Aborting does not restart anything; restarting from a checkpoint is the rollback strategy.', null, 'Detection never uses maximum claims.', 'The aborted process\'s resources go to the free pool, not back to it.'],  // feedback for each wrong pick: rollback, maximum claims and returning resources are all mix-ups
            why: 'Freeing one victim\'s resources may or may not break the cycle. Rerunning detection tells the OS whether it can stop or must choose the next victim.' },  // explanation: detection after each abort decides whether to stop or pick another victim
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list
    notes: `${/* notes: the study notes for this section, written as HTML and opened from the Notes button */''}
<h3>Deadlock detection: grant now, look later</h3>${/* notes heading: what deadlock detection is */''}
<p>Prevention and avoidance pay a price all the time so that deadlock can never happen. <b>Deadlock detection</b> makes the opposite bet. The operating system puts no limits on what processes request or hold: if the units a process asks for are free, it gets them at once, and if not, it waits as usual. Every so often the OS runs a <b>detection algorithm</b> over the current state to find processes caught in a circular wait. If it finds any, it breaks the deadlock (<b>deadlock recovery</b>). The loop is: grant, detect, recover if needed, carry on.</p>${/* notes paragraph: detection's bargain and the grant, detect, recover loop */''}
<table>${/* notes table comparing the three approaches to deadlock */''}
  <tr><th>Approach</th><th>When it acts</th><th>Needs in advance</th><th>Main cost</th></tr>${/* table header: approach, when it acts, what it needs in advance, its main cost */''}
  <tr><td>Prevention</td><td>by design: a condition is ruled out</td><td>a policy all obey</td><td>idle resources, constrained programs</td></tr>${/* table row: prevention */''}
  <tr><td>Avoidance</td><td>at each request: refuse risky ones</td><td>maximum claims</td><td>waits even when units are free</td></tr>${/* table row: avoidance */''}
  <tr><td>Detection</td><td>afterwards: find, then recover</td><td>nothing</td><td>the checks, plus work lost in recovery</td></tr>${/* table row: detection */''}
</table>${/* end of the comparison table */''}
<h3>How often to run the check</h3>${/* notes heading: how often to run the check */''}
<ul>${/* start of the list of checking schedules */''}
  <li><b>At every request</b>. A deadlock is caught by the very request that creates it, and because only that one request changed the state since the last check, the algorithm can be incremental and simple. The price is processor time on every request.</li>${/* list item: checking at every request, instant and incremental but paid on every request */''}
  <li><b>Less often</b>: on a timer, or when processor utilization drops (deadlocked processes stop working and others pile up behind them). Far cheaper, but a deadlock sits unnoticed until the next check, freezing its processes and their resources. Innocent utilization dips (a burst of disk transfers) trigger checks that find nothing.</li>${/* list item: checking on a timer or when the processor goes quiet, cheaper but slower and prone to false alarms */''}
</ul>${/* end of the list */''}
<p><b>Worked example.</b> A full check costs 6 ms. Run every 10 s, it uses 6 / 10,000 = 0.06% of the processor, and a deadlock waits on average half an interval (5 s), at worst a whole one (10 s). Checking each of 400 requests a second at 0.05 ms each costs 20 ms per second, 2% of the processor, but finds the deadlock at once.</p>${/* worked example paragraph: the processor cost and the delay of a timer, against checking every request */''}
<h3>The data the algorithm reads</h3>${/* notes heading: the data the algorithm reads */''}
<ul>${/* start of the list of the four data structures */''}
  <li><b>Allocation matrix A</b>: one row per process, one column per resource type; A[i][j] = units of resource j that process i holds.</li>${/* list item: the allocation matrix A */''}
  <li><b>Request matrix Q</b>: Q[i][j] = units of resource j that process i has asked for and is still waiting to receive (all zeros means it is not waiting).</li>${/* list item: the request matrix Q */''}
  <li><b>Available vector V</b>: free units of each type, which is the total minus everything held.</li>${/* list item: the available vector V */''}
  <li><b>Work vector W</b>: a scratch copy of V that grows as the algorithm pretends processes finish.</li>${/* list item: the work vector W */''}
</ul>${/* end of the list */''}
<h3>The detection algorithm</h3>${/* notes heading: the detection algorithm */''}
<p>The algorithm marks every process it can show is <b>not</b> deadlocked.</p>${/* paragraph: the algorithm marks what it can prove is not deadlocked */''}
<ol>${/* start of the numbered steps */''}
  <li>Mark every process whose row of A is all zeros. It holds nothing, so nobody can be waiting on it, and it cannot be part of a deadlock.</li>${/* step 1: mark processes that hold nothing */''}
  <li>Set W = V.</li>${/* step 2: W starts as V */''}
  <li>Find an unmarked process i whose row of Q is ≤ W in every column. If there is none, stop.</li>${/* step 3: find an unmarked process whose request fits, or stop */''}
  <li>Mark i and add its row of A to W (assume it gets what it asked for, finishes and releases everything). Go back to step 3.</li>${/* step 4: mark it and add its holdings to W, then repeat */''}
</ol>${/* end of the numbered steps */''}
<p>A deadlock exists if and only if some processes are still unmarked at the end, and the unmarked processes are exactly the deadlocked ones. The order in which fitting processes are chosen does not change the verdict, because W only ever grows.</p>${/* paragraph: unmarked means deadlocked, and the choice of order does not change the answer because W only grows */''}
<h4>Worked example (5 processes, 5 resource types)</h4>${/* subheading for the worked example */''}
<p>Totals ${vec(EX.total)}, so V = ${vec(EX.V)}.</p>${/* the example's totals and free vector, filled in from the EX data when the page loads */''}
${nState(EX.names, EX.res, EX.A, EX.Q)}${/* the example's A and Q table, built by nState from the same data the steps use */''}
${nTrace(EX.names, EX.res, EX.A, EX.Q, EX.V)}${/* the step-by-step trace, built by nTrace from a real run of detect() */''}
<p>P5 waits too, but holds nothing, so it is not part of the cycle. A waiting process's request never fits in V (the OS would simply have granted it), so it can be marked only after others add their units to W. A row of Q that is all zeros means the process is running.</p>${/* paragraph: why P5 is not on the cycle, and what an all-zero row of Q means */''}
<h3>Detection versus the banker's safety test</h3>${/* notes heading: detection versus the banker's safety test */''}
<p>Both start from what is free and pretend processes finish one at a time, growing W. They differ in what they assume each process still needs:</p>${/* paragraph: both pretend processes finish one at a time, but assume different remaining needs */''}
<ul>${/* start of the comparison list */''}
  <li><b>Banker's safety test (avoidance)</b> compares each process's remaining claim C − A (the worst case: everything it may still ask for) with W. It runs <b>before</b> a request is granted and answers “is the state safe?”.</li>${/* list item: the banker's test compares the worst case C − A with W, before granting */''}
  <li><b>Detection</b> compares each process's current request Q with W. It is <b>optimistic</b>: it assumes a process whose request can be met will finish without asking for more. It runs <b>afterwards</b> and answers “which processes are deadlocked now?”. It needs no maximum claims, and it marks processes holding nothing outright.</li>${/* list item: detection compares current requests Q with W, afterwards, and is optimistic */''}
</ul>${/* end of the list */''}
<p><b>Example.</b> Totals ${vec(CMP.total)}, held A = ${CMP.A.map(vec).join(', ')}, so V = ${vec(CMP.V)}. Remaining claims C − A = ${CMP.need.map(vec).join(', ')}: none fits in V, so the banker's test says <b>unsafe</b>. Current requests Q = ${CMP.Qnow.map(vec).join(', ')}: detection marks ${list(detect(CMP.A, CMP.Qnow, CMP.V).order.map((i) => CMP.names[i]))} in turn, so there is <b>no deadlock</b>. Unsafe does not mean deadlocked. If P1 then asks for the rest of its claim instead of finishing, ${list(detect(CMP.A, [CMP.need[0], CMP.Qnow[1], CMP.Qnow[2]], CMP.V).dead.map((i) => CMP.names[i]))} become deadlocked, and the next detection run catches it. When every process asks for its whole remaining claim (Q = C − A) and no row of A is all zeros, the two tests make exactly the same moves.</p>${/* example paragraph: the CMP state is unsafe yet not deadlocked; the names and vectors come from real detect() runs */''}
<h3>Special case: one unit of each resource type</h3>${/* notes heading: the single-unit special case */''}
<p>When every resource type has a single unit, a waiting process can be released only by the one process holding that unit. Collapse the resource allocation graph into a <b>wait-for graph</b>: one node per process, an arrow Pi → Pj when Pi waits for a resource that Pj holds. <b>A deadlock exists exactly when the wait-for graph contains a cycle</b>; the processes on the cycle are deadlocked, and a process whose arrows lead into a cycle is stuck as well until the cycle is broken. A depth-first search finds cycles (reaching a process already on the current path closes one); it handles each process and arrow once, at most about n² work for n processes. With several units per type a cycle alone does not prove deadlock, so the general case needs the matrix algorithm.</p>${/* paragraph: the wait-for graph, why a cycle means deadlock here, how the search finds it and what it costs */''}
<h3>Recovery, from crude to refined</h3>${/* notes heading: recovery strategies */''}
<ol>${/* start of the numbered strategies */''}
  <li><b>Abort all deadlocked processes.</b> Needs nothing special; all their work is lost. The most common choice in real operating systems.</li>${/* strategy 1: abort all */''}
  <li><b>Roll back each deadlocked process to a checkpoint and restart it.</b> Needs checkpoint and rollback support. Only work since the checkpoint is lost, but the same deadlock may recur; timing differences usually prevent it.</li>${/* strategy 2: roll back to checkpoints */''}
  <li><b>Abort deadlocked processes one at a time</b>, cheapest first, rerunning the detection algorithm after each abort, until no deadlock remains.</li>${/* strategy 3: abort one at a time */''}
  <li><b>Preempt resources one at a time</b>, rerunning detection after each preemption. The victim must be rolled back to a point before it acquired the resource. If the same process is always chosen it may starve, so a fair policy counts how often each has been a victim.</li>${/* strategy 4: preempt resources one at a time, with the starvation risk */''}
</ol>${/* end of the strategies */''}
<h4>Choosing a victim (for options 3 and 4)</h4>${/* subheading: choosing a victim */''}
<ul>${/* start of the criteria list */''}
  <li>Least processor time consumed so far (easy: the OS accounts it).</li>${/* criterion: least processor time used */''}
  <li>Least output produced so far (fairly easy to count).</li>${/* criterion: least output produced */''}
  <li>Most estimated time remaining (hard: only an estimate; spares nearly finished work).</li>${/* criterion: most time remaining */''}
  <li>Fewest total resources allocated so far (easy, but freeing little may not break the cycle).</li>${/* criterion: fewest resources held */''}
  <li>Lowest priority (easy where priorities exist; ignores how much work is lost).</li>${/* criterion: lowest priority */''}
</ul>${/* end of the criteria list */''}
<p><b>Lab results.</b> Four deadlocked processes (P1 and P2 wait for each other, P4 waits for P2, P3 waits for P4), choosing victims greedily and rerunning detection after each abort:</p>${/* paragraph introducing the lab results table */''}
${nTable(['Strategy', 'Victims', 'CPU time lost', 'Output lost'], [['Abort all', null, 'all'], ['Roll back all', null, 'roll'], ...Object.keys(CRIT).map((k) => [CRIT[k].long, k, 'one'])].map(([lab, k, how]) => { const r = labRun(how, k); return [lab, r.victims.map((i) => LAB.names[i]).join(', '), r.lostCpu + ' s', r.lostOut + ' lines']; }))}${/* the lab results table, computed by running labRun for every strategy and criterion when the page loads */''}
<p>No criterion wins on every measure, and a cheap victim off the cycle only adds aborts. Rerunning detection after each abort tells the OS when to stop.</p>`,  // closing paragraph: no criterion wins everywhere, and re-running detection says when to stop; end of the notes text
  });  // ends the settings object and the Guide.section call
})();  // ends the function that wraps the section and runs it immediately
